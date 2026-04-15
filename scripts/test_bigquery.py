"""
Quick test: BigQuery connectivity + crypto_ethereum dataset.

Usage:
    # Authenticate first (one-time):
    gcloud auth application-default login

    # Run:
    python scripts/test_bigquery.py --project YOUR_GCP_PROJECT_ID
"""

import argparse
from google.cloud import bigquery


def test_connection(project_id: str) -> None:
    client = bigquery.Client(project=project_id)
    print(f"Connected to project: {project_id}\n")

    # 1. Check dataset access
    query = """
        SELECT COUNT(*) AS total_blocks
        FROM `bigquery-public-data.crypto_ethereum.blocks`
        WHERE TIMESTAMP_TRUNC(timestamp, DAY) = TIMESTAMP("2026-04-12")
    """
    print("Test 1: Count total blocks...")
    row = next(iter(client.query(query).result()))
    print(f"  Total blocks in dataset: {row.total_blocks:,}\n")

    # 2. Fetch a small sample of recent blocks
    # query = """
    #     SELECT
    #         number,
    #         TIMESTAMP_SECONDS(timestamp) AS block_time,
    #         base_fee_per_gas,
    #         gas_used,
    #         gas_limit,
    #         transaction_count
    #     FROM `bigquery-public-data.crypto_ethereum.blocks`
    #     ORDER BY number DESC
    #     LIMIT 5
    # """
    # print("Test 2: Fetch 5 most recent blocks...")
    # rows = list(client.query(query).result())
    # for row in rows:
    #     base_fee_gwei = (row.base_fee_per_gas or 0) / 1e9
    #     print(
    #         f"  Block {row.number} | {row.block_time} | "
    #         f"base_fee={base_fee_gwei:.2f} gwei | "
    #         f"txns={row.transaction_count}"
    #     )

    print("\nAll tests passed. BigQuery integration is working.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True, help="GCP project ID")
    args = parser.parse_args()
    test_connection(args.project)
