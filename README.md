# APEX (Activity Prediction and docking EXamination)

Automated web platform for computational drug discovery. Select any biological target; APEX fetches bioactivity data from ChEMBL, trains a QSAR model to predict compound activity, retrieves the target's 3D structure (AlphaFold → PDB fallback), and docks top candidates with AutoDock Vina — returning a ranked hit list with binding scores.

## Prerequisites

- Python ≥ 3.11
- [uv](https://github.com/astral-sh/uv)
- AutoDock Vina (`vina` on PATH)

## Quickstart

```bash
uv sync
cp .env.example .env
uv run uvicorn backend.app.main:app --reload
```

API runs at `http://localhost:8000`. Docs at `http://localhost:8000/docs`.

## Pipeline

```
Target search → ChEMBL bioactivity fetch (SQLite cache) → QSAR screening → Structure fetch → Docking → Ranked hits
```
