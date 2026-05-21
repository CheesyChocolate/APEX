import os
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[3]

# Logging
LOG_LEVEL = os.getenv("APEX_LOG_LEVEL", "INFO")  # DEBUG | INFO | WARNING | ERROR
LOG_FILE = ROOT_DIR / "logs" / "apex.log"

# Server
HOST = os.getenv("APEX_HOST", "127.0.0.1")
PORT = int(os.getenv("APEX_PORT", "8000"))
CORS_ORIGINS = os.getenv(
    "APEX_CORS_ORIGINS", "http://localhost:3000,http://localhost:5173"
).split(",")

# Storage paths
CACHE_DB_PATH = ROOT_DIR / "backend" / "data" / "cache" / "chembl.db"
MODELS_DIR = ROOT_DIR / "backend" / "data" / "models"
STRUCTURES_DIR = ROOT_DIR / "backend" / "data" / "structures"

# Pipeline
STRUCTURE_FETCH_ORDER = ["alphafold", "pdb", "rdkit"]
ACTIVE_THRESHOLD_NM = 1000  # IC50 ≤ this → active (label=1)
TOP_N_FOR_DOCKING = 20  # top QSAR candidates passed to docking

# Docking
VINA_BINARY = os.getenv("APEX_VINA_BINARY", "vina")
VINA_EXHAUSTIVENESS = 8

# Cache TTL
CACHE_TTL_DAYS = 7
