from app.core.exceptions import StructureFetchError
from app.core.logging import get_logger
from app.schemas.models import StructureResponse
from app.services import structure_fetcher
from fastapi import APIRouter, HTTPException, Query

logger = get_logger(__name__)
router = APIRouter(prefix="/structures", tags=["structures"])


@router.get("/{uniprot_id}", response_model=StructureResponse)
def get_structure(uniprot_id: str, pdb_id: str | None = Query(None)):
    try:
        path = structure_fetcher.fetch(uniprot_id, pdb_id)
    except StructureFetchError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return StructureResponse(
        uniprot_id=uniprot_id,
        path=str(path),
        size_bytes=path.stat().st_size,
    )
