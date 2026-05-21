import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.core.config import CACHE_DB_PATH, CACHE_TTL_DAYS
from app.core.logging import get_logger

logger = get_logger(__name__)

CACHE_DB_PATH = Path(CACHE_DB_PATH)


def _init_db(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS target_search (
            query      TEXT PRIMARY KEY,
            result     TEXT NOT NULL,
            cached_at  TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS bioactivity (
            chembl_target_id  TEXT PRIMARY KEY,
            result            TEXT NOT NULL,
            cached_at         TEXT NOT NULL
        );
    """)
    conn.commit()


@contextmanager
def _get_conn():
    CACHE_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(CACHE_DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        _init_db(conn)
        yield conn
    finally:
        conn.close()


def _is_fresh(cached_at: str, ttl_days: int = CACHE_TTL_DAYS) -> bool:
    age = datetime.now(timezone.utc) - datetime.fromisoformat(cached_at).replace(
        tzinfo=timezone.utc
    )
    return age < timedelta(days=ttl_days)


def get_target_search(query: str) -> list[dict] | None:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT result, cached_at FROM target_search WHERE query = ?", (query,)
        ).fetchone()
        if row and _is_fresh(row["cached_at"]):
            logger.debug("Cache HIT: target_search '%s'", query)
            return json.loads(row["result"])
        if row:
            logger.debug("Cache STALE: target_search '%s'", query)
    return None


def set_target_search(query: str, result: list[dict]) -> None:
    with _get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO target_search"
            " (query, result, cached_at) VALUES (?, ?, ?)",
            (query, json.dumps(result), datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
    logger.debug("Cache SET: target_search '%s'", query)


def get_bioactivity(chembl_target_id: str) -> list[dict] | None:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT result, cached_at FROM bioactivity WHERE chembl_target_id = ?",
            (chembl_target_id,),
        ).fetchone()
        if row and _is_fresh(row["cached_at"]):
            logger.debug("Cache HIT: bioactivity '%s'", chembl_target_id)
            return json.loads(row["result"])
        if row:
            logger.debug("Cache STALE: bioactivity '%s'", chembl_target_id)
    return None


def set_bioactivity(chembl_target_id: str, result: list[dict]) -> None:
    with _get_conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO bioactivity"
            " (chembl_target_id, result, cached_at) VALUES (?, ?, ?)",
            (
                chembl_target_id,
                json.dumps(result),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        conn.commit()
    logger.debug("Cache SET: bioactivity '%s'", chembl_target_id)
