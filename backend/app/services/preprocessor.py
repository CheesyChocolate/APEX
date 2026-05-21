import numpy as np
import pandas as pd
from app.core.config import ACTIVE_THRESHOLD_NM
from app.core.exceptions import QSARError
from app.core.logging import get_logger
from rdkit.Chem import MolFromSmiles, rdFingerprintGenerator
from sklearn.model_selection import train_test_split

_morgan_gen = rdFingerprintGenerator.GetMorganGenerator(radius=2, fpSize=1024)

logger = get_logger(__name__)


def preprocess(records: list[dict]) -> tuple:
    """
    Convert raw ChEMBL bioactivity records to train/test splits.

    Returns (X_train, X_test, y_train, y_test, smiles_train, smiles_test)
    where X_* are placeholder arrays (featurization happens in qsar_pipeline).
    """
    if not records:
        raise QSARError("No bioactivity records to preprocess")

    df = pd.DataFrame(records)

    required = {"canonical_smiles", "standard_value"}
    missing = required - set(df.columns)
    if missing:
        raise QSARError(f"Missing columns in bioactivity data: {missing}")

    initial = len(df)
    df = df.dropna(subset=["canonical_smiles", "standard_value"])
    df["standard_value"] = pd.to_numeric(df["standard_value"], errors="coerce")
    df = df.dropna(subset=["standard_value"])
    logger.info("Dropped %d rows with null SMILES or IC50", initial - len(df))

    # Validate SMILES via RDKit
    df["_mol"] = df["canonical_smiles"].apply(MolFromSmiles)
    dropped = df["_mol"].isna().sum()
    if dropped:
        logger.info("Dropped %d rows with invalid SMILES", dropped)
    df = df[df["_mol"].notna()].copy()

    # Deduplicate by Morgan fingerprint (catches same compound with different SMILES)
    before_dedup = len(df)
    df["_fp"] = df["_mol"].apply(
        lambda mol: _morgan_gen.GetFingerprint(mol).ToBitString()
    )
    df = df.drop_duplicates(subset="_fp").reset_index(drop=True)
    logger.info("Deduplication: %d → %d unique compounds", before_dedup, len(df))
    df = df.drop(columns=["_mol", "_fp"])

    if len(df) < 10:
        raise QSARError(f"Too few valid records after cleaning: {len(df)}")

    # Drop borderline intermediates (1000–10000 nM) to reduce label noise;
    # keep only clear actives and clear inactives.
    INACTIVE_THRESHOLD_NM = 10_000
    intermediates = (
        (df["standard_value"] > ACTIVE_THRESHOLD_NM)
        & (df["standard_value"] <= INACTIVE_THRESHOLD_NM)
    ).sum()
    if intermediates > 0:
        df = df[
            (df["standard_value"] <= ACTIVE_THRESHOLD_NM)
            | (df["standard_value"] > INACTIVE_THRESHOLD_NM)
        ].copy()
        logger.info("Dropped %d intermediate compounds (1–10 µM IC50)", intermediates)

    # IC50 → binary label
    df["label"] = (df["standard_value"] <= ACTIVE_THRESHOLD_NM).astype(int)
    active = df["label"].sum()
    logger.info(
        "Label distribution: %d active (%.1f%%), %d inactive",
        active,
        100 * active / len(df),
        len(df) - active,
    )

    if active == 0 or active == len(df):
        raise QSARError("All labels are the same class — cannot train a classifier")

    smiles = df["canonical_smiles"].tolist()
    labels = df["label"].values

    # Stratified split
    idx = np.arange(len(smiles))
    idx_train, idx_test = train_test_split(
        idx, test_size=0.2, stratify=labels, random_state=42
    )

    smiles_train = [smiles[i] for i in idx_train]
    smiles_test = [smiles[i] for i in idx_test]
    y_train = labels[idx_train]
    y_test = labels[idx_test]

    logger.info("Split: %d train / %d test", len(smiles_train), len(smiles_test))
    return smiles_train, smiles_test, y_train, y_test
