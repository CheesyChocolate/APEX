import subprocess
import sys
import tempfile
from pathlib import Path

from app.core.config import VINA_EXHAUSTIVENESS
from app.core.exceptions import DockingError
from app.core.logging import get_logger
from rdkit.Chem import AddHs, MolFromSmiles, MolToMolBlock
from rdkit.Chem.AllChem import EmbedMolecule, MMFFOptimizeMolecule

logger = get_logger(__name__)

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


def _get_box(receptor_pdb: Path) -> dict:
    """Estimate docking box from receptor Cα centroid."""
    import numpy as np
    from Bio.PDB import PDBParser

    parser = PDBParser(QUIET=True)
    structure = parser.get_structure("rec", str(receptor_pdb))
    coords = [atom.coord for atom in structure.get_atoms()]
    if not coords:
        raise DockingError("No atoms found in receptor PDB")
    arr = np.array(coords)
    center = arr.mean(axis=0)
    size = (arr.max(axis=0) - arr.min(axis=0)) + 10  # 10 Å padding
    size = size.clip(max=30)
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


def run(receptor_pdb: Path, smiles_list: list[str]) -> list[dict]:
    if not smiles_list:
        return []

    results = []
    box = _get_box(receptor_pdb)
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
