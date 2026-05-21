from pathlib import Path

import requests
from app.core.config import STRUCTURE_FETCH_ORDER, STRUCTURES_DIR
from app.core.exceptions import StructureFetchError
from app.core.logging import get_logger

logger = get_logger(__name__)

STRUCTURES_DIR = Path(STRUCTURES_DIR)
ALPHAFOLD_API = "https://alphafold.ebi.ac.uk/api/prediction/{uniprot_id}"
RCSB_URL = "https://files.rcsb.org/download/{pdb_id}.pdb"
TIMEOUT = 30


def _alphafold(uniprot_id: str) -> bytes:
    api_url = ALPHAFOLD_API.format(uniprot_id=uniprot_id)
    meta = requests.get(api_url, timeout=TIMEOUT)
    if meta.status_code != 200:
        raise StructureFetchError(f"AlphaFold API {meta.status_code} for {uniprot_id}")
    entries = meta.json()
    if not entries:
        raise StructureFetchError(f"No AlphaFold entry for {uniprot_id}")
    pdb_url = entries[0]["pdbUrl"]
    r = requests.get(pdb_url, timeout=60)
    if r.status_code != 200:
        raise StructureFetchError(f"AlphaFold PDB download {r.status_code}: {pdb_url}")
    return r.content


def _pdb(pdb_id: str) -> bytes:
    url = RCSB_URL.format(pdb_id=pdb_id)
    r = requests.get(url, timeout=TIMEOUT)
    if r.status_code != 200 or not r.content:
        raise StructureFetchError(f"RCSB PDB {r.status_code} for {pdb_id}")
    return r.content


def _rdkit_generate(uniprot_id: str) -> bytes:
    # Last resort — RDKit cannot generate full protein structures.
    # This stub raises so the caller knows all methods failed.
    raise StructureFetchError(
        f"Structure generation not implemented for {uniprot_id}. "
        "AlphaFold and PDB both failed."
    )


def fetch(uniprot_id: str, pdb_id: str | None = None) -> Path:
    STRUCTURES_DIR.mkdir(parents=True, exist_ok=True)
    cached = STRUCTURES_DIR / f"{uniprot_id}.pdb"
    if cached.exists():
        logger.info("Structure cache HIT: %s", uniprot_id)
        return cached

    for method in STRUCTURE_FETCH_ORDER:
        try:
            if method == "alphafold":
                logger.info("Fetching structure via AlphaFold: %s", uniprot_id)
                content = _alphafold(uniprot_id)
            elif method == "pdb":
                if not pdb_id:
                    logger.debug("Skipping PDB fallback — no pdb_id provided")
                    continue
                logger.info("Fetching structure via RCSB PDB: %s", pdb_id)
                content = _pdb(pdb_id)
            elif method == "rdkit":
                logger.warning(
                    "Attempting RDKit structure generation for %s", uniprot_id
                )
                content = _rdkit_generate(uniprot_id)
            else:
                continue

            cached.write_bytes(content)
            logger.info("Structure saved: %s", cached)
            return cached

        except StructureFetchError as e:
            logger.warning("Structure fetch failed (%s): %s", method, e)

    raise StructureFetchError(f"All structure fetch methods failed for {uniprot_id}")
