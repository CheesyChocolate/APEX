from pydantic import BaseModel


class TargetResult(BaseModel):
    target_chembl_id: str
    pref_name: str | None
    target_type: str | None
    organism: str | None


class QSARRequest(BaseModel):
    chembl_target_id: str
    max_records: int = 5000


class QSARPrediction(BaseModel):
    smiles: str
    activity_probability: float
    predicted_active: bool
    mw: float | None = None
    logp: float | None = None
    hbd: int | None = None
    hba: int | None = None
    tpsa: float | None = None


class QSARResponse(BaseModel):
    chembl_target_id: str
    model_path: str
    predictions: list[QSARPrediction]
    top_n: list[QSARPrediction]


class StructureResponse(BaseModel):
    uniprot_id: str
    path: str
    size_bytes: int


class DockingRequest(BaseModel):
    uniprot_id: str
    pdb_id: str | None = None
    smiles_list: list[str]


class DockingResult(BaseModel):
    smiles: str
    affinity_kcal_mol: float | None
    rank: int
    conformers: int | None = None
    rmsd: float | None = None
    error: str | None = None
