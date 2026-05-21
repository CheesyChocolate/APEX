from app.core.exceptions import DockingError, StructureFetchError
from app.core.logging import get_logger
from app.schemas.models import DockingRequest, DockingResult
from app.services import docking_runner, structure_fetcher
from fastapi import APIRouter, HTTPException

logger = get_logger(__name__)
router = APIRouter(prefix="/docking", tags=["docking"])


@router.post("/", response_model=list[DockingResult])
def run_docking(req: DockingRequest):
    try:
        receptor_path = structure_fetcher.fetch(req.uniprot_id, req.pdb_id)
    except StructureFetchError as e:
        raise HTTPException(status_code=404, detail=f"Structure unavailable: {e}")

    try:
        results = docking_runner.run(receptor_path, req.smiles_list)
    except DockingError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return [DockingResult(**r) for r in results]
