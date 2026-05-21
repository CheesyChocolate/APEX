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

    box_override = None
    if (
        req.box_center
        and req.box_size
        and len(req.box_center) == 3
        and len(req.box_size) == 3
    ):
        box_override = {
            "center_x": req.box_center[0],
            "center_y": req.box_center[1],
            "center_z": req.box_center[2],
            "size_x": req.box_size[0],
            "size_y": req.box_size[1],
            "size_z": req.box_size[2],
        }

    try:
        results = docking_runner.run(
            receptor_path, req.smiles_list, req.uniprot_id, box_override
        )
    except DockingError as e:
        raise HTTPException(status_code=500, detail=str(e))

    return [DockingResult(**r) for r in results]
