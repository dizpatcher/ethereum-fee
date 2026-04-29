"""
DAG Ежедневного сбора данных Ethereum из BigQuery и CoinGecko.

Расписание: каждый день в 7 МСК.
Собирает данные за вчерашний день (ds = execution_date).

Задачи:
  fetch_blocks          — блоки из BigQuery
  fetch_priority_fees   — percentiles priority fee из BigQuery (транзакции)
  fetch_eth_prices      — цена ETH из CoinGecko
  merge_daily_data      — объединение трёх источников в один Parquet-файл
  append_to_master      — дозапись в единый мастер-датасет
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta
from pathlib import Path

from airflow import DAG
from airflow.operators.python import PythonOperator

logger = logging.getLogger(__name__)

DATA_DIR = Path(os.environ.get("ETH_DATA_DIR", "/opt/airflow/eth_data"))
GCP_PROJECT = os.environ.get("GCP_PROJECT_ID", "")
COINGECKO_KEY = os.environ.get("COINGECKO_API_KEY", "")


def fetch_blocks(date: str, **kwargs) -> str:
    """Загружает данные о блоках из BigQuery за указанную дату."""
    from google.cloud import bigquery
    import pandas as pd

    out = DATA_DIR / "blocks" / f"blocks_{date}.parquet"
    out.parent.mkdir(parents=True, exist_ok=True)

    client = bigquery.Client(project=GCP_PROJECT)
    query = f"""
        SELECT
            CAST(UNIX_SECONDS(timestamp) AS INT64) AS unix_ts,
            TIMESTAMP_TRUNC(timestamp, SECOND) AS timestamp,
            number AS height,
            size,
            gas_limit,
            gas_used,
            transaction_count,
            base_fee_per_gas
        FROM `bigquery-public-data.crypto_ethereum.blocks`
        WHERE DATE(timestamp) = DATE('{date}')
        ORDER BY number
    """
    logger.info("BigQuery: fetching blocks for %s …", date)
    df = client.query(query).to_dataframe()
    logger.info("Fetched %d blocks for %s", len(df), date)
    df.to_parquet(out, index=False)
    return str(out)


def fetch_priority_fees(date: str, **kwargs) -> str:
    """
    Загружает percentiles priority fee из BigQuery за указанную дату.

    Запрос аналогичен тому, что использовался при сборе обучающих данных
    в notebooks/priority_fee_data.ipynb.
    """
    from google.cloud import bigquery

    out = DATA_DIR / "priority_fees" / f"priority_{date}.parquet"
    out.parent.mkdir(parents=True, exist_ok=True)

    client = bigquery.Client(project=GCP_PROJECT)
    query = f"""
        WITH blocks AS (
            SELECT timestamp, number AS height, base_fee_per_gas
            FROM `bigquery-public-data.crypto_ethereum.blocks`
            WHERE DATE(timestamp) = DATE('{date}')
        )
        SELECT
            b.timestamp            AS block_timestamp,
            b.height               AS block_number,
            MIN(t.receipt_effective_gas_price - b.base_fee_per_gas)                                            AS priority_min,
            APPROX_QUANTILES(t.receipt_effective_gas_price - b.base_fee_per_gas, 100)[OFFSET(25)]  AS priority_p25,
            APPROX_QUANTILES(t.receipt_effective_gas_price - b.base_fee_per_gas, 100)[OFFSET(50)]  AS priority_p50,
            APPROX_QUANTILES(t.receipt_effective_gas_price - b.base_fee_per_gas, 100)[OFFSET(90)]  AS priority_p90,
            APPROX_QUANTILES(t.receipt_effective_gas_price - b.base_fee_per_gas, 100)[OFFSET(95)]  AS priority_p95,
            MAX(t.receipt_effective_gas_price - b.base_fee_per_gas)                                            AS priority_max
        FROM `bigquery-public-data.crypto_ethereum.transactions` t
        LEFT JOIN blocks b ON b.height = t.block_number
        WHERE DATE(t.block_timestamp) = DATE('{date}')
          AND b.height IS NOT NULL
        GROUP BY b.timestamp, b.height
        ORDER BY b.height
    """
    logger.info("BigQuery: fetching priority fees for %s …", date)
    df = client.query(query).to_dataframe()
    logger.info("Fetched priority fees for %d blocks", len(df))
    df.to_parquet(out, index=False)
    return str(out)


def fetch_eth_prices(date: str, **kwargs) -> str:
    """
    Загружает почасовые цены ETH/USD из CoinGecko за указанную дату.
    Используется тот же ключ, что и в backend/data_fetcher.py.
    """
    import requests
    import pandas as pd
    from datetime import timezone

    out = DATA_DIR / "eth_prices" / f"prices_{date}.parquet"
    out.parent.mkdir(parents=True, exist_ok=True)

    dt = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    from_ts = int(dt.timestamp())
    to_ts = int((dt + timedelta(days=1)).timestamp())

    url = "https://api.coingecko.com/api/v3/coins/ethereum/market_chart/range"
    params = {"vs_currency": "usd", "from": from_ts, "to": to_ts}
    headers = {"x-cg-demo-api-key": COINGECKO_KEY} if COINGECKO_KEY else {}

    resp = requests.get(url, params=params, headers=headers, timeout=30)
    resp.raise_for_status()
    prices = resp.json().get("prices", [])

    df = pd.DataFrame(prices, columns=["timestamp_ms", "close"])
    df["datetime"] = pd.to_datetime(
        df["timestamp_ms"], unit="ms", utc=True
    ).dt.tz_localize(None)
    df = (
        df.drop(columns=["timestamp_ms"]).sort_values("datetime").reset_index(drop=True)
    )

    df.to_parquet(out, index=False)
    logger.info("Saved %d price points for %s", len(df), date)
    return str(out)


def merge_daily(date: str, **kwargs) -> str:
    """
    Объединяет три источника данных в единый дневной Parquet-файл.
    Формат идентичен notebooks/data/priority_with_price_until_april.csv.
    """
    import pandas as pd

    blocks = pd.read_parquet(DATA_DIR / "blocks" / f"blocks_{date}.parquet")
    fees = pd.read_parquet(DATA_DIR / "priority_fees" / f"priority_{date}.parquet")
    prices = pd.read_parquet(DATA_DIR / "eth_prices" / f"prices_{date}.parquet")

    # Нормализуем временные зоны
    blocks["timestamp"] = pd.to_datetime(blocks["timestamp"]).dt.tz_localize(None)
    fees["block_timestamp"] = pd.to_datetime(fees["block_timestamp"]).dt.tz_localize(
        None
    )
    prices["datetime"] = pd.to_datetime(prices["datetime"]).dt.tz_localize(None)

    # Объединяем блоки с priority fees
    merged = blocks.merge(
        fees[
            [
                "block_number",
                "priority_min",
                "priority_p25",
                "priority_p50",
                "priority_p90",
                "priority_p95",
                "priority_max",
            ]
        ],
        left_on="height",
        right_on="block_number",
        how="inner",
    ).drop(columns=["block_number"])

    # Добавляем цену ETH: берём последнее известное значение (merge_asof)
    merged = merged.sort_values("timestamp")
    prices = prices.sort_values("datetime")
    merged = (
        pd.merge_asof(
            merged,
            prices[["datetime", "close"]],
            left_on="timestamp",
            right_on="datetime",
            direction="backward",
        )
        .drop(columns=["datetime"])
        .rename(columns={"close": "last_eth_price"})
    )

    # Производные признаки
    merged["block_utilization"] = merged["gas_used"] / merged["gas_limit"]
    merged["gas_pressure"] = merged["gas_used"] - merged["gas_limit"] / 2
    merged["tx_per_gas"] = merged["transaction_count"] / (merged["gas_used"] + 1)

    out = DATA_DIR / "daily" / f"daily_{date}.parquet"
    out.parent.mkdir(parents=True, exist_ok=True)
    merged.to_parquet(out, index=False)
    logger.info("Merged daily data: %d rows → %s", len(merged), out)
    return str(out)


def append_to_master(date: str, **kwargs) -> None:
    """Добавляет дневной файл к мастер-датасету, убирая дубли по height."""
    import pandas as pd

    daily = pd.read_parquet(DATA_DIR / "daily" / f"daily_{date}.parquet")
    master_path = DATA_DIR / "master_dataset.parquet"

    if master_path.exists():
        master = pd.read_parquet(master_path)
        master = master[~master["height"].isin(daily["height"])]
        master = pd.concat([master, daily], ignore_index=True)
    else:
        master = daily

    master = master.sort_values("height").reset_index(drop=True)
    master.to_parquet(master_path, index=False)
    logger.info("Master dataset updated: %d rows total", len(master))


default_args = {
    "owner": "airflow",
    "retries": 2,
    "retry_delay": timedelta(minutes=10),
}

with DAG(
    dag_id="eth_data_collection",
    description="Ежедневный сбор данных Ethereum из BigQuery и CoinGecko",
    start_date=datetime(2026, 4, 29),
    schedule="0 4 * * *",  # каждый день в 7 мск
    catchup=False,
    default_args=default_args,
    tags=["ethereum", "data-collection", "mlops"],
) as dag:

    t_blocks = PythonOperator(
        task_id="fetch_blocks",
        python_callable=fetch_blocks,
        op_kwargs={"date": "{{ ds }}"},
    )

    t_fees = PythonOperator(
        task_id="fetch_priority_fees",
        python_callable=fetch_priority_fees,
        op_kwargs={"date": "{{ ds }}"},
    )

    t_prices = PythonOperator(
        task_id="fetch_eth_prices",
        python_callable=fetch_eth_prices,
        op_kwargs={"date": "{{ ds }}"},
    )

    t_merge = PythonOperator(
        task_id="merge_daily_data",
        python_callable=merge_daily,
        op_kwargs={"date": "{{ ds }}"},
    )

    t_append = PythonOperator(
        task_id="append_to_master",
        python_callable=append_to_master,
        op_kwargs={"date": "{{ ds }}"},
    )

    # fetch_blocks, fetch_priority_fees, fetch_eth_prices выполняются параллельно
    [t_blocks, t_fees, t_prices] >> t_merge >> t_append
