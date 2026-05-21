import subprocess
import tempfile
from pathlib import Path

from app.core.config import VINA_BINARY, VINA_EXHAUSTIVENESS
from app.core.exceptions import DockingError
from app.core.logging import get_logger
from rdkit.Chem import AddHs, MolFromSmiles, MolToMolBlock
from rdkit.Chem.AllChem import EmbedMolecule, MMFFOptimizeMolecule

logger = get_logger(__name__)


def _smiles_to_pdbqt(smiles: str, work_dir: Path) -> Path:
    mol = MolFromSmiles(smiles)
    if mol is None:
        raise DockingError(f"Invalid SMILES: {smiles[:40]}")
    mol = AddHs(mol)
    if EmbedMolecule(mol, randomSeed=42) != 0:
        raise DockingError(f"3D embedding failed for: {smiles[:40]}")
    MMFFOptimizeMolecule(mol)

    # Write SDF then convert to pdbqt via obabel
    sdf_path = work_dir / "ligand.sdf"
    pdbqt_path = work_dir / "ligand.pdbqt"
    sdf_path.write_text(MolToMolBlock(mol))

    result = subprocess.run(
        ["obabel", str(sdf_path), "-O", str(pdbqt_path), "--gen3d"],
        capture_output=True,
        text=True,
    )
    if not pdbqt_path.exists():
        raise DockingError(f"obabel failed to convert ligand: {result.stderr[:200]}")
    return pdbqt_path


def _receptor_to_pdbqt(receptor_pdb: Path, work_dir: Path) -> Path:
    pdbqt_path = work_dir / "receptor.pdbqt"
    result = subprocess.run(
        ["obabel", str(receptor_pdb), "-O", str(pdbqt_path), "-xr"],
        capture_output=True,
        text=True,
    )
    if not pdbqt_path.exists():
        raise DockingError(f"obabel failed to convert receptor: {result.stderr[:200]}")
    return pdbqt_path


def _parse_vina_score(output: str) -> float:
    for line in output.splitlines():
        parts = line.split()
        if parts and parts[0] == "1":
            try:
                return float(parts[1])
            except (IndexError, ValueError):
                pass
    raise DockingError(f"Could not parse Vina score from output:\n{output[:300]}")


def _get_box(receptor_pdb: Path) -> dict:
    """Estimate docking box from receptor atom coordinates."""
    from Bio.PDB import PDBParser

    parser = PDBParser(QUIET=True)
    structure = parser.get_structure("rec", str(receptor_pdb))
    coords = [atom.coord for atom in structure.get_atoms()]
    if not coords:
        raise DockingError("No atoms found in receptor PDB")
    import numpy as np

    arr = np.array(coords)
    center = arr.mean(axis=0)
    size = (arr.max(axis=0) - arr.min(axis=0)) + 10  # 10 Å padding
    size = size.clip(max=30)  # cap at 30 Å per axis
    return {
        "center_x": float(center[0]),
        "center_y": float(center[1]),
        "center_z": float(center[2]),
        "size_x": float(size[0]),
        "size_y": float(size[1]),
        "size_z": float(size[2]),
    }


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
                out_pdbqt = lig_dir / "out.pdbqt"

                cmd = [
                    VINA_BINARY,
                    "--receptor",
                    str(receptor_pdbqt),
                    "--ligand",
                    str(ligand_pdbqt),
                    "--out",
                    str(out_pdbqt),
                    "--exhaustiveness",
                    str(VINA_EXHAUSTIVENESS),
                    "--center_x",
                    str(box["center_x"]),
                    "--center_y",
                    str(box["center_y"]),
                    "--center_z",
                    str(box["center_z"]),
                    "--size_x",
                    str(box["size_x"]),
                    "--size_y",
                    str(box["size_y"]),
                    "--size_z",
                    str(box["size_z"]),
                ]
                proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
                score = _parse_vina_score(proc.stdout)
                results.append({"smiles": smiles, "affinity_kcal_mol": score})
                logger.debug(
                    "Docked %d/%d: %.2f kcal/mol", i + 1, len(smiles_list), score
                )

            except (DockingError, subprocess.TimeoutExpired, FileNotFoundError) as e:
                logger.warning("Docking failed for compound %d: %s", i, e)
                results.append(
                    {"smiles": smiles, "affinity_kcal_mol": None, "error": str(e)}
                )

    results.sort(key=lambda r: r["affinity_kcal_mol"] or 0)
    for rank, r in enumerate(results, 1):
        r["rank"] = rank
    return results
