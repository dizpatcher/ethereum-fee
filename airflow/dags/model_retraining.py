"""
DAG 2: Еженедельное переобучение моделей LightGBM на актуальных данных.

Расписание: каждое воскресенье в 06:00 UTC.

Задачи:
  build_common_features       — временны́е и сетевые признаки
  build_base_fee_datasets     — 5 датасетов для моделей base fee
  build_priority_datasets     — 5 датасетов для моделей priority fee
  train_base_{horizon}        — 5 параллельных задач обучения (base fee)
  train_priority_{horizon}    — 5 параллельных задач обучения (priority fee)
  deploy_models               — замена production-моделей новыми

Фичи соответствуют структуре из notebooks/base_fee_learn.ipynb
и notebooks/priority_fee_learn.ipynb, чтобы backend/feature_engine.py
мог удовлетворить model.feature_name_ для каждой модели.
"""

from __future__ import annotations

import logging
import os
import shutil
from datetime import datetime, timedelta
from pathlib import Path

from airflow import DAG
from airflow.operators.python import PythonOperator

logger = logging.getLogger(__name__)

DATA_DIR = Path(os.environ.get("ETH_DATA_DIR", "/opt/airflow/eth_data"))
MODELS_DIR = Path(os.environ.get("ETH_MODELS_DIR", "/opt/airflow/eth_models"))
HORIZONS = ["next_block", "10m", "1h", "1d", "1w"]


def build_common_features(**kwargs) -> None:
    """
    Загружает мастер-датасет, добавляет общие признаки и сохраняет
    промежуточный файл features_common.parquet.
    """
    import numpy as np
    import pandas as pd

    master = DATA_DIR / "master_dataset.parquet"
    if not master.exists():
        raise FileNotFoundError(
            f"Master dataset not found: {master}. Run eth_data_collection first."
        )

    df = pd.read_parquet(master)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("height").reset_index(drop=True)
    logger.info("Loaded master dataset: %d rows", len(df))

    # Временны́е признаки
    df["hour"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    df["month"] = df["timestamp"].dt.month
    df["day"] = df["timestamp"].dt.day
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
    df["week_of_year"] = df["timestamp"].dt.isocalendar().week.astype(int)
    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)

    # Priority-fee распределение
    df["priority_spread"] = df["priority_p95"] - df["priority_p50"]
    df["priority_tail"] = df["priority_max"] - df["priority_p95"]
    df["fee_ratio"] = df["priority_p50"] / (df["base_fee_per_gas"] + 1e-9)
    df["fee_diff"] = df["priority_p50"] - df["base_fee_per_gas"]

    out = DATA_DIR / "features_common.parquet"
    df.to_parquet(out, index=False)
    logger.info(
        "Common features saved: %s (%d rows, %d cols)", out, len(df), len(df.columns)
    )


def build_base_fee_datasets(**kwargs) -> None:
    """
    Строит 5 датасетов для обучения моделей base fee.
    Структура фич соответствует notebooks/base_fee_learn.ipynb.
    """
    import numpy as np
    import pandas as pd

    df = pd.read_parquet(DATA_DIR / "features_common.parquet")
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("height")
    n = len(df)
    logger.info("Building base fee datasets from %d rows", n)

    bf = df["base_fee_per_gas"]
    ut = df["block_utilization"]
    ep = df["last_eth_price"]

    # --- Общие лаги и скользящие для всех горизонтов ---
    for k in [1, 2, 3, 5, 10, 20, 50, 100, 300]:
        df[f"base_fee_lag_{k}"] = bf.shift(k)
    for k in [1, 2, 3, 5, 10, 20]:
        df[f"utilization_lag_{k}"] = ut.shift(k)
    for w in [5, 20, 50, 100, 300]:
        df[f"base_fee_ma_{w}"] = bf.rolling(w).mean()
        df[f"base_fee_vol_{w}"] = bf.rolling(w).std()
        df[f"utilization_ma_{w}"] = ut.rolling(w).mean()
    for lb in [1, 5, 10, 20, 50]:
        df[f"base_fee_change_{lb}"] = bf.pct_change(lb)
    df["gas_used_change"] = df["gas_used"].pct_change(1)
    df["tx_change"] = df["transaction_count"].pct_change(1)
    # ETH-price фичи
    df["eth_return_1m"] = ep.pct_change(5)
    df["eth_return_10m"] = ep.pct_change(50)
    df["eth_return_1h"] = ep.pct_change(300)
    df["eth_volatility_1h"] = ep.rolling(300).std()
    df["eth_vol_1h"] = df["eth_volatility_1h"]

    horizon_cfg = {
        # shift, extra_cols (длинные горизонты добавляют свои признаки)
        "next_block": {"shift": 1, "extra": {}},
        "10m": {"shift": 50, "extra": {}},
        "1h": {"shift": 300, "extra": {}},
        "1d": {
            "shift": 7200,
            "extra": {
                "lag_1d": lambda d: d["base_fee_per_gas"].shift(7200),
                "lag_2d": lambda d: d["base_fee_per_gas"].shift(14400),
                "ma_1d": lambda d: d["base_fee_per_gas"].rolling(7200).mean(),
                "ma_3d": lambda d: d["base_fee_per_gas"].rolling(21600).mean(),
                "trend_1d": lambda d: d["base_fee_per_gas"].rolling(7200).mean()
                - d["base_fee_per_gas"].rolling(7200).mean().shift(7200),
                "vol_1d": lambda d: d["base_fee_per_gas"].rolling(7200).std(),
                "util_ma_1d": lambda d: d["block_utilization"].rolling(7200).mean(),
                "eth_return_1d": lambda d: d["last_eth_price"].pct_change(7200),
                "eth_vol_1d": lambda d: d["last_eth_price"].rolling(7200).std(),
            },
        },
        "1w": {
            "shift": 50400,
            "extra": {
                "lag_1d": lambda d: d["base_fee_per_gas"].shift(7200),
                "lag_1w": lambda d: d["base_fee_per_gas"].shift(50400),
                "ma_1d": lambda d: d["base_fee_per_gas"].rolling(7200).mean(),
                "ma_7d": lambda d: d["base_fee_per_gas"].rolling(50400).mean(),
                "trend_week": lambda d: d["base_fee_per_gas"].rolling(7200).mean()
                - d["base_fee_per_gas"].rolling(50400).mean(),
                "vol_1d": lambda d: d["base_fee_per_gas"].rolling(7200).std(),
                "vol_7d": lambda d: d["base_fee_per_gas"].rolling(50400).std(),
                "util_ma_1d": lambda d: d["block_utilization"].rolling(7200).mean(),
                "util_ma_7d": lambda d: d["block_utilization"].rolling(50400).mean(),
                "eth_return_7d": lambda d: d["last_eth_price"].pct_change(50400),
                "eth_vol_7d": lambda d: d["last_eth_price"].rolling(50400).std(),
            },
        },
    }

    drop_raw = ["timestamp", "unix_ts"]

    for h_name, cfg in horizon_cfg.items():
        ds = df.copy()
        ds["target"] = ds["base_fee_per_gas"].shift(-cfg["shift"])
        for col, fn in cfg["extra"].items():
            ds[col] = fn(ds)
        ds = ds.drop(columns=[c for c in drop_raw if c in ds.columns], errors="ignore")
        ds = ds.replace([np.inf, -np.inf], np.nan).dropna()
        # target последней колонкой
        cols = [c for c in ds.columns if c != "target"] + ["target"]
        ds = ds[cols]
        out = DATA_DIR / "train" / "base" / f"base_{h_name}.parquet"
        out.parent.mkdir(parents=True, exist_ok=True)
        ds.to_parquet(out, index=False)
        logger.info(
            "base/%s: %d rows × %d features", h_name, len(ds), len(ds.columns) - 1
        )


def build_priority_datasets(**kwargs) -> None:
    """
    Строит 5 датасетов для обучения моделей priority fee.
    Структура фич соответствует notebooks/priority_fee_learn.ipynb.
    """
    import numpy as np
    import pandas as pd

    df = pd.read_parquet(DATA_DIR / "features_common.parquet")
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values("height")
    logger.info("Building priority fee datasets from %d rows", len(df))

    p50 = df["priority_p50"]
    p90 = df["priority_p90"]
    ep = df["last_eth_price"]

    # Лаги и скользящие по p90 (как в ноутбуке)
    for k in [1, 2, 3, 5, 10, 20, 50, 100]:
        df[f"priority_p90_lag_{k}"] = p90.shift(k)
    for w in [5, 20, 50, 300]:
        df[f"priority_p90_ma_{w}"] = p90.rolling(w).mean()
        df[f"priority_p90_vol_{w}"] = p90.rolling(w).std()
    for lb in [1, 5, 20]:
        df[f"priority_p90_change_{lb}"] = p90.pct_change(lb)
    df["utilization_change"] = df["block_utilization"].pct_change(1)
    df["gas_used_change"] = df["gas_used"].pct_change(1)
    df["tx_change"] = df["transaction_count"].pct_change(1)
    df["eth_price_change_5m"] = ep.pct_change(25)
    df["eth_price_change_1h"] = ep.pct_change(300)
    df["eth_vol_5m"] = ep.rolling(25).std()
    df["eth_vol_1h"] = ep.rolling(300).std()

    horizon_shifts = {
        "next_block": 1,
        "10m": 50,
        "1h": 300,
        "1d": 7200,
        "1w": 50400,
    }
    horizon_extra = {
        "10m": {
            "spread_change": lambda d: d["priority_spread"].pct_change(10),
            "tail_change": lambda d: d["priority_tail"].pct_change(50),
        },
        "1h": {
            "spread_ma_50": lambda d: d["priority_spread"].rolling(100).mean(),
            "tail_ma_50": lambda d: d["priority_tail"].rolling(300).mean(),
        },
        "1d": {
            "lag_1d": lambda d: d["priority_p50"].shift(7200),
            "lag_2d": lambda d: d["priority_p50"].shift(14400),
            "ma_1d": lambda d: d["priority_p50"].rolling(7200).mean(),
            "ma_3d": lambda d: d["priority_p50"].rolling(21600).mean(),
            "vol_1d": lambda d: d["priority_p50"].rolling(7200).std(),
            "spread_1d": lambda d: d["priority_spread"].rolling(7200).mean(),
            "tail_1d": lambda d: d["priority_tail"].rolling(7200).mean(),
            "eth_return_1d": lambda d: d["last_eth_price"].pct_change(7200),
            "eth_vol_1d": lambda d: d["last_eth_price"].rolling(7200).std(),
        },
        "1w": {
            "lag_1d": lambda d: d["priority_p50"].shift(7200),
            "lag_1w": lambda d: d["priority_p50"].shift(50400),
            "ma_1d": lambda d: d["priority_p50"].rolling(7200).mean(),
            "ma_7d": lambda d: d["priority_p50"].rolling(50400).mean(),
            "trend_week": lambda d: d["priority_p50"].rolling(7200).mean()
            - d["priority_p50"].rolling(50400).mean(),
            "vol_1d": lambda d: d["priority_p50"].rolling(7200).std(),
            "vol_7d": lambda d: d["priority_p50"].rolling(50400).std(),
            "spread_7d": lambda d: d["priority_spread"].rolling(50400).mean(),
            "tail_7d": lambda d: d["priority_tail"].rolling(50400).mean(),
            "eth_return_7d": lambda d: d["last_eth_price"].pct_change(50400),
            "eth_vol_7d": lambda d: d["last_eth_price"].rolling(50400).std(),
        },
    }

    drop_raw = ["timestamp", "unix_ts"]

    for h_name, shift in horizon_shifts.items():
        ds = df.copy()
        ds["target"] = p50.shift(-shift)
        for col, fn in horizon_extra.get(h_name, {}).items():
            ds[col] = fn(ds)
        ds = ds.drop(columns=[c for c in drop_raw if c in ds.columns], errors="ignore")
        ds = ds.replace([np.inf, -np.inf], np.nan).dropna()
        cols = [c for c in ds.columns if c != "target"] + ["target"]
        ds = ds[cols]
        out = DATA_DIR / "train" / "priority" / f"priority_{h_name}.parquet"
        out.parent.mkdir(parents=True, exist_ok=True)
        ds.to_parquet(out, index=False)
        logger.info(
            "priority/%s: %d rows × %d features", h_name, len(ds), len(ds.columns) - 1
        )


def _train_lgbm(dataset_path: Path, model_out: Path, label: str) -> None:
    """Обучает LightGBM и сохраняет модель. Гиперпараметры из jupyter-ноутбуков."""

    import numpy as np
    import pandas as pd
    import joblib
    from lightgbm import LGBMRegressor, early_stopping, log_evaluation
    from sklearn.metrics import mean_absolute_error, mean_squared_error

    df = pd.read_parquet(dataset_path)
    if "height" in df.columns:
        df = df.drop(columns=["height"])
    df = df.sort_index()

    n = len(df)
    train_end = int(n * 0.8)
    val_end = int(n * 0.9)

    train, val, test = (
        df.iloc[:train_end],
        df.iloc[train_end:val_end],
        df.iloc[val_end:],
    )
    X_train, y_train = train.drop(columns=["target"]), train["target"]
    X_val, y_val = val.drop(columns=["target"]), val["target"]
    X_test, y_test = test.drop(columns=["target"]), test["target"]

    model = LGBMRegressor(
        n_estimators=5000,
        learning_rate=0.01,
        max_depth=50,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
    )
    model.fit(
        X_train,
        y_train,
        eval_set=[(X_val, y_val)],
        eval_metric="rmse",
        callbacks=[early_stopping(50, verbose=False), log_evaluation(200)],
    )

    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    rmse = float(np.sqrt(mean_squared_error(y_test, preds)))

    model_out.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, model_out)
    logger.info(
        "[%s] MAE=%.0f  RMSE=%.0f  n_train=%d → %s",
        label,
        mae,
        rmse,
        len(X_train),
        model_out.name,
    )


def train_base_model(horizon: str, **kwargs) -> None:
    dataset = DATA_DIR / "train" / "base" / f"base_{horizon}.parquet"
    out_name = f"{horizon}_lgbm_model.pkl"
    _train_lgbm(dataset, MODELS_DIR / "new" / out_name, f"base/{horizon}")


def train_priority_model(horizon: str, **kwargs) -> None:
    dataset = DATA_DIR / "train" / "priority" / f"priority_{horizon}.parquet"
    out_name = f"{horizon}_priority_lgbm.pkl"
    _train_lgbm(
        dataset, MODELS_DIR / "new" / "priority" / out_name, f"priority/{horizon}"
    )


def deploy_models(**kwargs) -> None:
    """
    Перемещаем новые модели из MODELS_DIR/new/ → MODELS_DIR/.
    Старые модели сохраняются в MODELS_DIR/backup/ с timestamp-суффиксом.
    """
    import time

    new_dir = MODELS_DIR / "new"
    prod_dir = MODELS_DIR
    bak_dir = MODELS_DIR / "backup"
    bak_dir.mkdir(exist_ok=True)
    ts = int(time.time())

    # Бэкап текущих моделей
    for pkl in prod_dir.glob("*.pkl"):
        shutil.copy2(pkl, bak_dir / f"{pkl.stem}_{ts}.pkl")
    prio_prod = prod_dir / "priority"
    if prio_prod.exists():
        for pkl in prio_prod.glob("*.pkl"):
            shutil.copy2(pkl, bak_dir / f"{pkl.stem}_{ts}.pkl")

    # Раскладываем новые модели
    deployed = 0
    for pkl in (new_dir).glob("*.pkl"):
        shutil.move(str(pkl), str(prod_dir / pkl.name))
        logger.info("Deployed: %s", pkl.name)
        deployed += 1

    prio_new = new_dir / "priority"
    if prio_new.exists():
        prio_prod.mkdir(exist_ok=True)
        for pkl in prio_new.glob("*.pkl"):
            shutil.move(str(pkl), str(prio_prod / pkl.name))
            logger.info("Deployed priority: %s", pkl.name)
            deployed += 1

    logger.info("Deployment complete: %d models updated", deployed)


default_args = {
    "owner": "airflow",
    "retries": 1,
    "retry_delay": timedelta(minutes=15),
}

with DAG(
    dag_id="model_retraining",
    description="Еженедельное переобучение LightGBM-моделей на актуальных данных Ethereum",
    start_date=datetime(2026, 4, 27),
    schedule="0 6 * * 0",  # каждое воскресенье в 9 мск
    catchup=False,
    default_args=default_args,
    tags=["ethereum", "ml", "retraining", "mlops"],
) as dag:

    t_common = PythonOperator(
        task_id="build_common_features",
        python_callable=build_common_features,
        execution_timeout=timedelta(minutes=30),
    )

    t_base_ds = PythonOperator(
        task_id="build_base_fee_datasets",
        python_callable=build_base_fee_datasets,
        execution_timeout=timedelta(hours=1),
    )

    t_prio_ds = PythonOperator(
        task_id="build_priority_datasets",
        python_callable=build_priority_datasets,
        execution_timeout=timedelta(hours=1),
    )

    # 5 задач обучения base fee — выполняются параллельно
    base_tasks = [
        PythonOperator(
            task_id=f"train_base_{h}",
            python_callable=train_base_model,
            op_kwargs={"horizon": h},
            execution_timeout=timedelta(hours=2),
        )
        for h in HORIZONS
    ]

    # 5 задач обучения priority fee — выполняются параллельно
    prio_tasks = [
        PythonOperator(
            task_id=f"train_priority_{h}",
            python_callable=train_priority_model,
            op_kwargs={"horizon": h},
            execution_timeout=timedelta(hours=2),
        )
        for h in HORIZONS
    ]

    t_deploy = PythonOperator(
        task_id="deploy_models",
        python_callable=deploy_models,
    )

    t_common >> [t_base_ds, t_prio_ds]
    t_base_ds >> base_tasks
    t_prio_ds >> prio_tasks
    (base_tasks + prio_tasks) >> t_deploy
