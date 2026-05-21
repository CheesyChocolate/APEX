from app.core.exceptions import ChEMBLError, QSARError
from app.core.logging import get_logger
from app.services import chembl_client, preprocessor
from fastapi import APIRouter, HTTPException, Query

logger = get_logger(__name__)
router = APIRouter(prefix="/compounds", tags=["compounds"])


@router.get("/{chembl_target_id}")
def get_compounds(
    chembl_target_id: str, max_records: int = Query(5000, ge=10, le=50000)
):
    try:
        records = chembl_client.fetch_bioactivity(chembl_target_id, max_records)
    except ChEMBLError as e:
        raise HTTPException(status_code=503, detail=str(e))

    try:
        smiles_train, smiles_test, y_train, y_test = preprocessor.preprocess(records)
    except QSARError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return {
        "chembl_target_id": chembl_target_id,
        "total_records": len(records),
        "train_size": len(smiles_train),
        "test_size": len(smiles_test),
        "active_fraction": float(y_train.sum() + y_test.sum())
        / (len(y_train) + len(y_test)),
    }
