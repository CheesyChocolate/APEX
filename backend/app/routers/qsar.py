from pathlib import Path

from app.core.config import MODELS_DIR, TOP_N_FOR_DOCKING
from app.core.exceptions import ChEMBLError, QSARError
from app.core.logging import get_logger
from app.schemas.models import QSARPrediction, QSARResponse
from app.services import chembl_client, preprocessor, qsar_pipeline
from fastapi import APIRouter, HTTPException

logger = get_logger(__name__)
router = APIRouter(prefix="/qsar", tags=["qsar"])
MODELS_DIR = Path(MODELS_DIR)


@router.post("/{chembl_target_id}", response_model=QSARResponse)
def run_qsar(chembl_target_id: str):
    try:
        records = chembl_client.fetch_bioactivity(chembl_target_id)
    except ChEMBLError as e:
        raise HTTPException(status_code=503, detail=str(e))

    try:
        smiles_train, smiles_test, y_train, y_test = preprocessor.preprocess(records)
        model_path = qsar_pipeline.train(
            smiles_train, y_train, smiles_test, y_test, chembl_target_id
        )
        all_smiles = smiles_train + smiles_test
        predictions = qsar_pipeline.predict(all_smiles, model_path)
    except QSARError as e:
        raise HTTPException(status_code=422, detail=str(e))

    top_n = [p for p in predictions if p["predicted_active"]][:TOP_N_FOR_DOCKING]
    return QSARResponse(
        chembl_target_id=chembl_target_id,
        model_path=str(model_path),
        predictions=[QSARPrediction(**p) for p in predictions],
        top_n=[QSARPrediction(**p) for p in top_n],
    )
