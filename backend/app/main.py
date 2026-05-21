from app.core.config import CORS_ORIGINS
from app.core.logging import get_logger
from app.routers import compounds, docking, qsar, structures, targets
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logger = get_logger(__name__)

app = FastAPI(
    title="APEX",
    description="Automated computational drug discovery platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(targets.router)
app.include_router(compounds.router)
app.include_router(qsar.router)
app.include_router(structures.router)
app.include_router(docking.router)


@app.get("/health")
def health():
    return {"status": "ok"}
