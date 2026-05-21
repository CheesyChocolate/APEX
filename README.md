# APEX (Activity Prediction and docking EXamination)

Automated web platform for computational drug discovery. Select any biological target; APEX fetches bioactivity data from ChEMBL, trains a QSAR model to predict compound activity, retrieves the target's 3D structure (AlphaFold → PDB fallback), and docks top candidates with AutoDock Vina — returning a ranked hit list with binding scores.

## Prerequisites

- Python ≥ 3.11
- [uv](https://github.com/astral-sh/uv)

AutoDock Vina and Open Babel are installed automatically into the project's virtual environment — no system-level installation required.

## Quickstart

```bash
uv sync
cp .env.example .env
PYTHONPATH=backend uv run uvicorn app.main:app --reload
```

API runs at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

Open `frontend/index.html` directly in a browser to use the web interface (no build step needed).

## Pipeline

```
Target selection
    → ChEMBL bioactivity fetch (SQLite cache, 7-day TTL)
    → Preprocessing (SMILES validation, IC50 → binary label)
    → QSAR screening (Morgan FP + descriptors → Random Forest)
    → Structure fetch (AlphaFold → RCSB PDB)
    → Molecular docking (AutoDock Vina)
    → Ranked hit list
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/targets/search?q=` | Search ChEMBL targets by name or ID |
| GET | `/compounds/{chembl_target_id}` | Fetch and preprocess bioactivity records |
| POST | `/qsar/{chembl_target_id}` | Train QSAR model and predict activity |
| GET | `/structures/{uniprot_id}` | Fetch AlphaFold/PDB structure |
| POST | `/docking/` | Dock compounds against target structure |
| GET | `/health` | Health check |

## Project Layout

```
backend/app/
├── core/          config, logging, exceptions
├── routers/       FastAPI route handlers
├── services/      chembl_client, qsar_pipeline, docking_runner, ...
└── schemas/       Pydantic request/response models

frontend/          Standalone React UI (CDN deps, no build step)
docs/
├── figs/          Matplotlib figure scripts + generated PNGs
├── data/          Pipeline outputs (gitignored)
└── presentation/  Beamer slides + Teleprompter.md
```

## Configuration

Application constants live in `backend/app/core/config.py`. Environment-specific values (API keys, custom paths) go in `.env` — see `.env.example`.

Key settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `ACTIVE_THRESHOLD_NM` | 1000 | IC50 ≤ this (nM) → active label |
| `TOP_N_FOR_DOCKING` | 20 | Top QSAR candidates forwarded to docking |
| `VINA_EXHAUSTIVENESS` | 8 | Vina search exhaustiveness |
| `CACHE_TTL_DAYS` | 7 | ChEMBL cache TTL |
