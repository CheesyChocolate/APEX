from pathlib import Path

from app.core.config import MODELS_DIR, TOP_N_FOR_DOCKING
from app.core.exceptions import ChEMBLError, QSARError
from app.core.logging import get_logger
from app.schemas.models import QSARBody, QSARPrediction, QSARResponse
from app.services import chembl_client, preprocessor, qsar_pipeline
from fastapi import APIRouter, Body, HTTPException

logger = get_logger(__name__)
router = APIRouter(prefix="/qsar", tags=["qsar"])
MODELS_DIR = Path(MODELS_DIR)


@router.post("/{chembl_target_id}", response_model=QSARResponse)
def run_qsar(
    chembl_target_id: str,
    body: QSARBody = Body(default=QSARBody()),
):
    try:
        records = chembl_client.fetch_bioactivity(chembl_target_id)
    except ChEMBLError as e:
        raise HTTPException(status_code=503, detail=str(e))

    try:
        smiles_train, smiles_test, y_train, y_test = preprocessor.preprocess(records)
        model_path = qsar_pipeline.train(
            smiles_train, y_train, smiles_test, y_test, chembl_target_id
        )

        if body.screening_smiles:
            screen_on = body.screening_smiles
            screening_mode = "virtual_screen"
            logger.info(
                "Virtual screening mode: %d user-provided compounds", len(screen_on)
            )
        else:
            screen_on = smiles_test
            screening_mode = "demo"
            logger.info(
                "Demo mode: predicting on %d test-set compounds", len(screen_on)
            )

        predictions = qsar_pipeline.predict(screen_on, model_path)
    except QSARError as e:
        raise HTTPException(status_code=422, detail=str(e))

    top_n = [p for p in predictions if p["predicted_active"]][:TOP_N_FOR_DOCKING]
    return QSARResponse(
        chembl_target_id=chembl_target_id,
        model_path=str(model_path),
        predictions=[QSARPrediction(**p) for p in predictions],
        top_n=[QSARPrediction(**p) for p in top_n],
        screening_mode=screening_mode,
    )
