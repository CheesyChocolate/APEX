import io
import subprocess
import sys
import tempfile
from pathlib import Path

import requests
from app.core.config import STRUCTURES_DIR, VINA_EXHAUSTIVENESS
from app.core.exceptions import DockingError
from app.core.logging import get_logger
from rdkit.Chem import AddHs, MolFromSmiles, MolToMolBlock
from rdkit.Chem.AllChem import EmbedMolecule, MMFFOptimizeMolecule

logger = get_logger(__name__)

_RCSB_SEARCH_URL = "https://search.rcsb.org/rcsbsearch/v2/query"
_RCSB_PDB_URL = "https://files.rcsb.org/download/{pdb_id}.pdb"

# Use the obabel binary bundled in the project's own venv.
_VENV_BIN = Path(sys.executable).parent
_OBABEL = str(_VENV_BIN / "obabel")


def _smiles_to_pdbqt(smiles: str, work_dir: Path) -> Path:
    mol = MolFromSmiles(smiles)
    if mol is None:
        raise DockingError(f"Invalid SMILES: {smiles[:40]}")
    mol = AddHs(mol)
    if EmbedMolecule(mol, randomSeed=42) != 0:
        raise DockingError(f"3D embedding failed for: {smiles[:40]}")
    MMFFOptimizeMolecule(mol)

    sdf_path = work_dir / "ligand.sdf"
    pdbqt_path = work_dir / "ligand.pdbqt"
    sdf_path.write_text(MolToMolBlock(mol))

    result = subprocess.run(
        [_OBABEL, str(sdf_path), "-O", str(pdbqt_path), "--gen3d"],
        capture_output=True,
        text=True,
    )
    if not pdbqt_path.exists():
        raise DockingError(f"obabel failed to convert ligand: {result.stderr[:200]}")
    return pdbqt_path


def _receptor_to_pdbqt(receptor_pdb: Path, work_dir: Path) -> Path:
    pdbqt_path = work_dir / "receptor.pdbqt"
    result = subprocess.run(
        [_OBABEL, str(receptor_pdb), "-O", str(pdbqt_path), "-xr"],
        capture_output=True,
        text=True,
    )
    if not pdbqt_path.exists():
        raise DockingError(f"obabel failed to convert receptor: {result.stderr[:200]}")
    return pdbqt_path


_HETATM_EXCLUDE = {"HOH", "WAT", "SO4", "PO4", "GOL", "EDO", "PEG", "MPD"}
_BOX_SIZE_LIGAND = 22.5  # Å — standard search space around a known binding site


def _hetatm_centroid(structure):
    """Return centroid of non-solvent HETATM atoms, or None if none exist."""
    import numpy as np

    coords = [
        atom.coord
        for residue in structure.get_residues()
        if residue.id[0] not in (" ", "W") and residue.resname not in _HETATM_EXCLUDE
        for atom in residue.get_atoms()
    ]
    if not coords:
        return None
    logger.info("Binding box from co-crystal ligand (%d HETATM atoms)", len(coords))
    return np.array(coords).mean(axis=0)


def _box_from_rcsb_cocrystal(uniprot_id: str) -> tuple[dict, Path] | None:
    """
    Query RCSB for a co-crystal PDB entry with a bound small-molecule ligand.

    Returns (box, saved_pdb_path) so the caller can dock into the *same* structure
    the box coordinates came from — critical to avoid coordinate-frame mismatch when
    the primary receptor is an AlphaFold model with different atom coordinates.
    Returns None on any failure.
    """
    from Bio.PDB import PDBParser

    query = {
        "query": {
            "type": "group",
            "logical_operator": "and",
            "nodes": [
                {
                    "type": "terminal",
                    "service": "text",
                    "parameters": {
                        "attribute": (
                            "rcsb_polymer_entity_container_identifiers"
                            ".reference_sequence_identifiers.database_accession"
                        ),
                        "operator": "exact_match",
                        "value": uniprot_id,
                    },
                },
                {
                    "type": "terminal",
                    "service": "text",
                    "parameters": {
                        "attribute": "rcsb_entry_info.nonpolymer_entity_count",
                        "operator": "greater",
                        "value": 0,
                    },
                },
            ],
        },
        "return_type": "entry",
        "request_options": {"paginate": {"start": 0, "rows": 10}},
    }

    try:
        resp = requests.post(_RCSB_SEARCH_URL, json=query, timeout=15)
        if resp.status_code != 200:
            logger.warning("RCSB search %d for %s", resp.status_code, uniprot_id)
            return None
        hits = resp.json().get("result_set", [])
    except Exception as exc:
        logger.warning("RCSB binding-site lookup failed: %s", exc)
        return None

    if not hits:
        logger.info("No PDB co-crystal entries found for UniProt %s", uniprot_id)
        return None

    parser = PDBParser(QUIET=True)
    structures_dir = Path(STRUCTURES_DIR)
    structures_dir.mkdir(parents=True, exist_ok=True)

    for hit in hits:
        pdb_id = hit["identifier"]
        try:
            pdb_resp = requests.get(_RCSB_PDB_URL.format(pdb_id=pdb_id), timeout=30)
            if pdb_resp.status_code != 200:
                continue
            structure = parser.get_structure(pdb_id, io.StringIO(pdb_resp.text))
            center = _hetatm_centroid(structure)
            if center is None:
                continue

            # Save so we can dock into this exact structure (same coordinate frame)
            pdb_path = structures_dir / f"{uniprot_id}_cocrystal_{pdb_id}.pdb"
            pdb_path.write_text(pdb_resp.text)
            logger.info(
                "Co-crystal receptor %s saved → %s; will dock into this structure",
                pdb_id,
                pdb_path.name,
            )
            box = {
                "center_x": float(center[0]),
                "center_y": float(center[1]),
                "center_z": float(center[2]),
                "size_x": _BOX_SIZE_LIGAND,
                "size_y": _BOX_SIZE_LIGAND,
                "size_z": _BOX_SIZE_LIGAND,
            }
            return box, pdb_path
        except Exception as exc:
            logger.debug("Skipping PDB %s: %s", pdb_id, exc)

    logger.info("No usable co-crystal ligand found in RCSB for %s", uniprot_id)
    return None


def _get_box(receptor_pdb: Path, uniprot_id: str | None = None) -> tuple[dict, Path]:
    """
    Resolve docking search box and the receptor file to dock into.

    Returns (box, receptor_path) — the receptor_path may differ from receptor_pdb
    when an RCSB co-crystal is used, because box coordinates and receptor MUST be
    from the same structure (different PDB files have independent coordinate frames).

    Three-tier priority:
      1. HETATM ligand in the supplied receptor PDB → box + same file as receptor.
      2. RCSB co-crystal lookup → box + that PDB saved locally as receptor.
      3. Protein centroid fallback → box + original receptor (logs WARNING).
    """
    import numpy as np
    from Bio.PDB import PDBParser

    parser = PDBParser(QUIET=True)
    structure = parser.get_structure("rec", str(receptor_pdb))

    # Tier 1 — ligand already in the receptor file; coordinates are consistent
    center = _hetatm_centroid(structure)
    if center is not None:
        all_coords = np.array([atom.coord for atom in structure.get_atoms()])
        size = (all_coords.max(0) - all_coords.min(0)) * 0.5 + 10
        size = size.clip(max=_BOX_SIZE_LIGAND)
        return {
            "center_x": float(center[0]),
            "center_y": float(center[1]),
            "center_z": float(center[2]),
            "size_x": float(size[0]),
            "size_y": float(size[1]),
            "size_z": float(size[2]),
        }, receptor_pdb

    # Tier 2 — fetch a co-crystal PDB from RCSB; dock into THAT file
    if uniprot_id:
        result = _box_from_rcsb_cocrystal(uniprot_id)
        if result is not None:
            box, cocrystal_path = result
            return box, cocrystal_path

    # Tier 3 — no known binding site; use protein centroid of the original receptor
    all_coords = [atom.coord for atom in structure.get_atoms()]
    if not all_coords:
        raise DockingError("No atoms found in receptor PDB")
    arr = np.array(all_coords)
    center = arr.mean(axis=0)
    size = (arr.max(0) - arr.min(0)) * 0.5 + 10
    size = size.clip(max=30)
    logger.warning(
        "Docking box falls back to protein centroid — binding site unknown for %s",
        uniprot_id or receptor_pdb.name,
    )
    return {
        "center_x": float(center[0]),
        "center_y": float(center[1]),
        "center_z": float(center[2]),
        "size_x": float(size[0]),
        "size_y": float(size[1]),
        "size_z": float(size[2]),
    }, receptor_pdb


_N_POSES = 5


def _dock_one(receptor_pdbqt: Path, ligand_pdbqt: Path, box: dict) -> dict:
    from vina import Vina

    v = Vina(sf_name="vina", verbosity=0)
    v.set_receptor(str(receptor_pdbqt))
    v.set_ligand_from_file(str(ligand_pdbqt))
    v.compute_vina_maps(
        center=[box["center_x"], box["center_y"], box["center_z"]],
        box_size=[box["size_x"], box["size_y"], box["size_z"]],
    )
    v.dock(exhaustiveness=VINA_EXHAUSTIVENESS, n_poses=_N_POSES)
    energies = v.energies(n_poses=_N_POSES)
    n = len(energies)
    best_score = float(energies[0][0])
    # RMSD of second-best pose from best (pose diversity); None if only one pose
    rmsd = float(energies[1][1]) if n > 1 else None
    return {"affinity_kcal_mol": best_score, "conformers": n, "rmsd": rmsd}


def run(
    receptor_pdb: Path,
    smiles_list: list[str],
    uniprot_id: str | None = None,
    box_override: dict | None = None,
) -> list[dict]:
    if not smiles_list:
        return []

    results = []
    if box_override:
        box = box_override
        receptor_to_use = receptor_pdb
        logger.info("Using user-supplied docking box")
    else:
        box, receptor_to_use = _get_box(receptor_pdb, uniprot_id)
    logger.info(
        "Docking box: center=(%.1f, %.1f, %.1f) size=(%.1f, %.1f, %.1f)",
        box["center_x"],
        box["center_y"],
        box["center_z"],
        box["size_x"],
        box["size_y"],
        box["size_z"],
    )
    if receptor_to_use != receptor_pdb:
        logger.info("Receptor switched to co-crystal: %s", receptor_to_use.name)

    with tempfile.TemporaryDirectory() as tmp:
        work_dir = Path(tmp)
        try:
            receptor_pdbqt = _receptor_to_pdbqt(receptor_to_use, work_dir)
        except DockingError as e:
            raise DockingError(f"Receptor preparation failed: {e}") from e

        for i, smiles in enumerate(smiles_list):
            lig_dir = work_dir / f"lig_{i}"
            lig_dir.mkdir()
            try:
                ligand_pdbqt = _smiles_to_pdbqt(smiles, lig_dir)
                pose = _dock_one(receptor_pdbqt, ligand_pdbqt, box)
                results.append({"smiles": smiles, **pose})
                logger.debug(
                    "Docked %d/%d: %.2f kcal/mol (%d poses)",
                    i + 1,
                    len(smiles_list),
                    pose["affinity_kcal_mol"],
                    pose["conformers"],
                )
            except Exception as e:
                logger.warning("Docking failed for compound %d: %s", i, e)
                results.append(
                    {"smiles": smiles, "affinity_kcal_mol": None, "error": str(e)}
                )

    results.sort(key=lambda r: r["affinity_kcal_mol"] or 0)
    for rank, r in enumerate(results, 1):
        r["rank"] = rank
    return results
