from app.core.exceptions import ChEMBLError
from app.core.logging import get_logger
from app.schemas.models import TargetResult
from app.services import chembl_client
from fastapi import APIRouter, HTTPException, Query

logger = get_logger(__name__)
router = APIRouter(prefix="/targets", tags=["targets"])


@router.get("/search", response_model=list[TargetResult])
def search_targets(q: str = Query(..., min_length=2)):
    try:
        raw = chembl_client.search_targets(q)
    except ChEMBLError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return [
        TargetResult(
            target_chembl_id=t.get("target_chembl_id", ""),
            pref_name=t.get("pref_name"),
            target_type=t.get("target_type"),
            organism=t.get("organism"),
        )
        for t in raw
    ]
