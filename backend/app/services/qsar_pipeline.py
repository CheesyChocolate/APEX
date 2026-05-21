import pickle
from pathlib import Path

import numpy as np
from app.core.config import MODELS_DIR
from app.core.exceptions import QSARError
from app.core.logging import get_logger
from rdkit.Chem import (
    Descriptors,
    MolFromSmiles,
    rdFingerprintGenerator,
    rdMolDescriptors,
)
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import f1_score, roc_auc_score
from sklearn.model_selection import cross_val_score

logger = get_logger(__name__)

MODELS_DIR = Path(MODELS_DIR)
FP_RADIUS = 2
FP_BITS = 1024
_morgan_gen = rdFingerprintGenerator.GetMorganGenerator(
    radius=FP_RADIUS, fpSize=FP_BITS
)


def _mol(smiles: str):
    mol = MolFromSmiles(smiles)
    if mol is None:
        raise QSARError(f"Invalid SMILES: {smiles[:40]}")
    return mol


def featurize(smiles_list: list[str]) -> np.ndarray:
    rows = []
    for smi in smiles_list:
        mol = _mol(smi)
        fp = list(_morgan_gen.GetFingerprintAsNumPy(mol))
        desc = [
            Descriptors.MolWt(mol),
            Descriptors.MolLogP(mol),
            Descriptors.NumHDonors(mol),
            Descriptors.NumHAcceptors(mol),
            Descriptors.NumRotatableBonds(mol),
            rdMolDescriptors.CalcNumAromaticRings(mol),
        ]
        rows.append(fp + desc)
    return np.array(rows, dtype=float)


def train(
    smiles_train: list[str],
    y_train: np.ndarray,
    smiles_test: list[str],
    y_test: np.ndarray,
    target_id: str,
) -> Path:
    logger.info("Featurizing %d training compounds...", len(smiles_train))
    X_train = featurize(smiles_train)
    X_test = featurize(smiles_test)

    logger.info("Training RandomForest classifier...")
    model = RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1)
    cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring="roc_auc")
    logger.info("CV ROC-AUC: %.3f ± %.3f", cv_scores.mean(), cv_scores.std())

    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    f1 = f1_score(y_test, y_pred, zero_division=0)
    auc = roc_auc_score(y_test, y_prob)
    logger.info("Test F1: %.3f  ROC-AUC: %.3f", f1, auc)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODELS_DIR / f"{target_id}.pkl"
    with open(model_path, "wb") as f:
        pickle.dump(model, f)
    logger.info("Model saved: %s", model_path)
    return model_path


def predict(smiles_list: list[str], model_path: Path) -> list[dict]:
    with open(model_path, "rb") as f:
        model = pickle.load(f)

    results = []
    valid_smiles, mols = [], []
    for smi in smiles_list:
        mol = MolFromSmiles(smi)
        if mol is not None:
            valid_smiles.append(smi)
            mols.append(mol)

    X = featurize(valid_smiles)
    probs = model.predict_proba(X)[:, 1]
    labels = model.predict(X)

    for smi, mol, prob, label in zip(valid_smiles, mols, probs, labels):
        results.append(
            {
                "smiles": smi,
                "activity_probability": round(float(prob), 4),
                "predicted_active": bool(label),
                "mw": round(Descriptors.MolWt(mol), 2),
                "logp": round(Descriptors.MolLogP(mol), 2),
                "hbd": int(Descriptors.NumHDonors(mol)),
                "hba": int(Descriptors.NumHAcceptors(mol)),
                "tpsa": round(Descriptors.TPSA(mol), 1),
            }
        )
    results.sort(key=lambda r: r["activity_probability"], reverse=True)
    return results


# ── Lipinski Rule of Five ──────────────────────────────────────────────────


def _passes_lipinski(p: dict) -> bool:
    mw = p.get("mw")
    logp = p.get("logp")
    hbd = p.get("hbd")
    hba = p.get("hba")
    tpsa = p.get("tpsa")
    return (
        (mw is None or mw <= 500)
        and (logp is None or logp <= 5)
        and (hbd is None or hbd <= 5)
        and (hba is None or hba <= 10)
        and (tpsa is None or tpsa <= 140)
    )


def _tanimoto(a: np.ndarray, b: np.ndarray) -> float:
    inter = float(np.dot(a, b))
    union = float(a.sum() + b.sum() - inter)
    return inter / union if union > 0 else 1.0


def select_diverse_top_n(predictions: list[dict], n: int) -> list[dict]:
    """
    From predicted-active compounds:
    1. Filter by Lipinski Rule of Five (drug-likeness gate)
    2. Select the most structurally diverse n using max-min Tanimoto greedy selection
    """
    actives = [p for p in predictions if p["predicted_active"]]
    if not actives:
        return []

    drug_like = [p for p in actives if _passes_lipinski(p)]
    # Fall back to all actives only if nothing passes Lipinski
    pool = drug_like if drug_like else actives
    logger.info(
        "Top-N selection: %d actives → %d pass Lipinski → selecting up to %d diverse",
        len(actives),
        len(drug_like),
        n,
    )

    if len(pool) <= n:
        return pool

    # Build fingerprint array for each pooled compound
    fps, valid = [], []
    for p in pool:
        mol = MolFromSmiles(p["smiles"])
        if mol is not None:
            fps.append(_morgan_gen.GetFingerprintAsNumPy(mol).astype(float))
            valid.append(p)

    if len(valid) <= n:
        return valid

    # Greedy max-min: start from the highest-probability compound (index 0,
    # pool is already sorted by predict()), then iteratively pick the compound
    # that is most dissimilar to all already-selected ones.
    selected = [0]
    selected_set = {0}
    while len(selected) < n:
        best_i, best_dist = -1, -1.0
        for i in range(len(valid)):
            if i in selected_set:
                continue
            min_sim = min(_tanimoto(fps[i], fps[j]) for j in selected)
            dist = 1.0 - min_sim
            if dist > best_dist:
                best_dist, best_i = dist, i
        if best_i < 0:
            break
        selected.append(best_i)
        selected_set.add(best_i)

    return [valid[i] for i in selected]
