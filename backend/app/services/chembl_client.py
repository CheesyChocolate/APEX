import time

import requests
from app.core.exceptions import ChEMBLError
from app.core.logging import get_logger
from app.services import chembl_cache

logger = get_logger(__name__)

BASE_URL = "https://www.ebi.ac.uk/chembl/api/data"
# Bioactivity fetch can be very slow; 90s covers most cases
BIOACTIVITY_TIMEOUT = 90
SEARCH_TIMEOUT = 30
MAX_RETRIES = 3
RETRY_BACKOFF = 5  # seconds between retries


def _get(url: str, params: dict, timeout: int) -> dict:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = requests.get(url, params=params, timeout=timeout)
            if r.status_code == 200:
                return r.json()
            logger.warning(
                "ChEMBL %s returned %s (attempt %d/%d)",
                url,
                r.status_code,
                attempt,
                MAX_RETRIES,
            )
        except requests.Timeout:
            logger.warning(
                "ChEMBL %s timed out (attempt %d/%d)", url, attempt, MAX_RETRIES
            )
        except requests.RequestException as e:
            logger.warning(
                "ChEMBL request error (attempt %d/%d): %s", attempt, MAX_RETRIES, e
            )
        if attempt < MAX_RETRIES:
            time.sleep(RETRY_BACKOFF * attempt)
    raise ChEMBLError(f"ChEMBL API unavailable after {MAX_RETRIES} attempts: {url}")


def search_targets(query: str) -> list[dict]:
    cached = chembl_cache.get_target_search(query)
    if cached is not None:
        logger.info("Target search '%s': cache hit (%d results)", query, len(cached))
        return cached

    logger.info("Target search '%s': fetching from ChEMBL...", query)
    t0 = time.time()
    data = _get(
        f"{BASE_URL}/target/search.json",
        params={"q": query, "limit": 20},
        timeout=SEARCH_TIMEOUT,
    )
    targets = data.get("targets", [])
    logger.info(
        "Target search '%s': %d results in %.2fs", query, len(targets), time.time() - t0
    )

    chembl_cache.set_target_search(query, targets)
    return targets


def fetch_bioactivity(chembl_target_id: str, max_records: int = 5000) -> list[dict]:
    cached = chembl_cache.get_bioactivity(chembl_target_id)
    if cached is not None:
        logger.info(
            "Bioactivity '%s': cache hit (%d records)", chembl_target_id, len(cached)
        )
        return cached

    logger.info("Bioactivity '%s': fetching from ChEMBL (slow)...", chembl_target_id)
    t0 = time.time()
    all_records: list[dict] = []
    limit = 100
    offset = 0

    while len(all_records) < max_records:
        data = _get(
            f"{BASE_URL}/activity.json",
            params={
                "target_chembl_id": chembl_target_id,
                "standard_type": "IC50",
                "standard_units": "nM",
                "assay_type": "B",
                "limit": limit,
                "offset": offset,
            },
            timeout=BIOACTIVITY_TIMEOUT,
        )
        page = data.get("activities", [])
        all_records.extend(page)
        total = data.get("page_meta", {}).get("total_count", 0)

        if len(page) < limit or len(all_records) >= total:
            break
        offset += limit
        logger.debug(
            "Bioactivity '%s': fetched %d/%d so far",
            chembl_target_id,
            len(all_records),
            total,
        )

    elapsed = time.time() - t0
    logger.info(
        "Bioactivity '%s': %d records fetched in %.2fs",
        chembl_target_id,
        len(all_records),
        elapsed,
    )
    chembl_cache.set_bioactivity(chembl_target_id, all_records)
    return all_records
