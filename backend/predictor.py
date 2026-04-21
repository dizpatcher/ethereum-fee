"""
Загрузка всех LightGBM-моделей и получение новых данных с predict_all() / get_current_gas().
Каждая модель выбирает свои признаки с помощью model.feature_name_
"""

import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from feature_engine import compute_all_features

logger = logging.getLogger(__name__)

MODELS_DIR = Path(__file__).parent.parent / "notebooks" / "models"


def _load(path: Path):
    try:
        m = joblib.load(path)
        logger.info("Loaded %s", path.name)
        return m
    except Exception as exc:
        logger.error("Cannot load %s: %s", path, exc)
        return None


# Загружается однажды на старте
BASE_MODELS = {
    "next_block": _load(MODELS_DIR / "next_block_lgbm_model.pkl"),
    "10m": _load(MODELS_DIR / "10m_lgbm_model.pkl"),
    "1h": _load(MODELS_DIR / "1h_lgbm_model.pkl"),
    "1d": _load(MODELS_DIR / "1d_lgbm_model.pkl"),
    "1w": _load(MODELS_DIR / "1w_lgbm_model.pkl"),
}

PRIORITY_MODELS = {
    "next_block": _load(MODELS_DIR / "priority" / "next_block_priority_lgbm.pkl"),
    "10m": _load(MODELS_DIR / "priority" / "10m_priority_lgbm.pkl"),
    "1h": _load(MODELS_DIR / "priority" / "1h_priority_lgbm.pkl"),
    "1d": _load(MODELS_DIR / "priority" / "1d_priority_lgbm.pkl"),
    "1w": _load(MODELS_DIR / "priority" / "1w_priority_lgbm.pkl"),
}

HORIZON_LABELS = {
    "next_block": "Следующий блок (~12 с)",
    "10m": "Через 10 минут",
    "1h": "Через 1 час",
    "1d": "Через 1 день",
    "1w": "Через 1 неделю",
}


def _run(model, features: dict) -> float | None:
    if model is None:
        return None
    try:
        names = model.feature_name_
        row = {n: features.get(n, 0.0) for n in names}
        df = pd.DataFrame([row])
        val = float(model.predict(df)[0])
        return max(0.0, val)
    except Exception as exc:
        logger.error("Prediction error: %s", exc)
        return None


def _gwei(wei: float) -> float:
    return round(wei / 1e9, 4)


def predict_all(blocks: list) -> dict:
    features = compute_all_features(blocks)
    if not features:
        return {}

    result = {}
    for horizon in ["next_block", "10m", "1h", "1d", "1w"]:
        base_wei = _run(BASE_MODELS[horizon], features)
        prio_wei = _run(PRIORITY_MODELS[horizon], features)

        if base_wei is not None and prio_wei is not None:
            result[horizon] = {
                "label": HORIZON_LABELS[horizon],
                "base_fee_gwei": _gwei(base_wei),
                "priority_fee_gwei": _gwei(prio_wei),
                "total_gwei": _gwei(base_wei + prio_wei),
                "base_fee_wei": int(base_wei),
                "priority_fee_wei": int(prio_wei),
            }

    return result


def get_current_gas(blocks: list) -> dict:
    if not blocks:
        return {}
    blk = sorted(blocks, key=lambda b: b["height"])[-1]
    base = blk["base_fee_per_gas"]
    prio = blk["priority_p50"]
    return {
        "base_fee_gwei": _gwei(base),
        "priority_fee_gwei": _gwei(prio),
        "total_gwei": _gwei(base + prio),
        "base_fee_wei": int(base),
        "priority_fee_wei": int(prio),
        "block_number": blk["height"],
        "block_utilization": round(blk["block_utilization"] * 100, 1),
    }
