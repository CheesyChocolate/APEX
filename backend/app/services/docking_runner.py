import io
import subprocess
import sys
import tempfile
from pathlib import Path

import requests
from app.core.config import VINA_EXHAUSTIVENESS
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


def _box_from_rcsb_cocrystal(uniprot_id: str) -> dict | None:
    """
    Query RCSB for any co-crystal PDB entry of this target that contains a bound
    small-molecule ligand, then return the ligand centroid as the docking box centre.
    Returns None on any failure so the caller falls back gracefully.
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
            logger.info(
                "Binding site sourced from PDB %s (UniProt %s)", pdb_id, uniprot_id
            )
            return {
                "center_x": float(center[0]),
                "center_y": float(center[1]),
                "center_z": float(center[2]),
                "size_x": _BOX_SIZE_LIGAND,
                "size_y": _BOX_SIZE_LIGAND,
                "size_z": _BOX_SIZE_LIGAND,
            }
        except Exception as exc:
            logger.debug("Skipping PDB %s: %s", pdb_id, exc)

    logger.info("No usable co-crystal ligand found in RCSB for %s", uniprot_id)
    return None


def _get_box(receptor_pdb: Path, uniprot_id: str | None = None) -> dict:
    """
    Resolve docking search box with a three-tier priority:
      1. HETATM ligand in the supplied receptor PDB (co-crystal structure).
      2. RCSB lookup: find a related PDB entry with a bound ligand (used when the
         receptor is an AlphaFold model with no co-crystal ligand).
      3. Protein geometric centroid — last resort, logs a WARNING.
    """
    import numpy as np
    from Bio.PDB import PDBParser

    parser = PDBParser(QUIET=True)
    structure = parser.get_structure("rec", str(receptor_pdb))

    # Tier 1 — ligand already present in the receptor file
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
        }

    # Tier 2 — look up a co-crystal PDB on RCSB for this UniProt target
    if uniprot_id:
        box = _box_from_rcsb_cocrystal(uniprot_id)
        if box:
            return box

    # Tier 3 — fall back to protein centroid (AlphaFold with no known ligand)
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
    }


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
        logger.info("Using user-supplied docking box")
    else:
        box = _get_box(receptor_pdb, uniprot_id)
    logger.info(
        "Docking box: center=(%.1f, %.1f, %.1f) size=(%.1f, %.1f, %.1f)",
        box["center_x"],
        box["center_y"],
        box["center_z"],
        box["size_x"],
        box["size_y"],
        box["size_z"],
    )

    with tempfile.TemporaryDirectory() as tmp:
        work_dir = Path(tmp)
        try:
            receptor_pdbqt = _receptor_to_pdbqt(receptor_pdb, work_dir)
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
