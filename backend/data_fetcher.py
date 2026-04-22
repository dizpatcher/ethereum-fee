"""
Извлечение данных о блоках Ethereum в режиме реального времени с помощью RPC-вызова eth_feeHistory.
Поддержка постоянного кэша в памяти для последних ~400 блоков.
"""

import asyncio
import logging
import os
from collections import deque
from datetime import datetime

import httpx

logger = logging.getLogger(__name__)

EL_NODE_URL = os.getenv("EL_NODE_URL", "")
COINGECKO_API_KEY = os.getenv("COINGECKO_API_KEY", "")

# Установить MOCK_MODE=1 в .env чтобы не делать реальные запросы к RPC и CoinGecko
MOCK_MODE = os.getenv("MOCK_MODE", "0") == "1"

# Общее состояние — импортируется main.py и predictor.py
block_cache: deque = deque(maxlen=500)
eth_price_cache: dict = {"usd": 0.0, "rub": 0.0, "updated_at": None}
_update_counter = 0


# Замоканные данные
def _mock_blocks(count: int, start_height: int = 24_900_000) -> list[dict]:
    """Генерирует синтетические блоки с реалистичными значениями."""
    import random

    base_fee = 40_000_000_000  # 40 Gwei
    blocks = []
    for i in range(count):
        # Имитируем небольшие флуктуации base fee
        base_fee = int(base_fee * random.uniform(0.97, 1.03))
        base_fee = max(1_000_000_000, min(200_000_000_000, base_fee))
        gas_limit = 60_000_000
        utilization = random.uniform(0.4, 0.8)
        gas_used = int(gas_limit * utilization)
        blocks.append(
            {
                "height": start_height + i,
                "base_fee_per_gas": base_fee,
                "gas_limit": gas_limit,
                "gas_used": gas_used,
                "transaction_count": random.randint(100, 300),
                "block_utilization": round(utilization, 6),
                "gas_pressure": gas_used - gas_limit // 2,
                "tx_per_gas": random.randint(100, 300) / max(gas_used, 1),
                "size": random.randint(80_000, 250_000),
                "priority_p25": random.randint(1_000_000, 10_000_000),
                "priority_p50": random.randint(10_000_000, 50_000_000),
                "priority_p90": random.randint(50_000_000, 500_000_000),
                "priority_p95": random.randint(500_000_000, 2_000_000_000),
                "last_eth_price": 2350.0,
            }
        )
    return blocks


async def _rpc(client: httpx.AsyncClient, method: str, params: list):
    resp = await client.post(
        EL_NODE_URL,
        json={"jsonrpc": "2.0", "method": method, "params": params, "id": 1},
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        raise RuntimeError(f"RPC error: {data['error']}")
    return data["result"]


async def _fetch_eth_price(client: httpx.AsyncClient) -> tuple[float, float]:
    """Возвращает (usd, rub) — один запрос, две валюты."""
    try:
        resp = await client.get(
            "https://api.coingecko.com/api/v3/simple/price",
            params={"ids": "ethereum", "vs_currencies": "usd,rub"},
            headers={"x-cg-demo-api-key": COINGECKO_API_KEY},
            timeout=10,
        )
        data = resp.json()["ethereum"]
        return float(data["usd"]), float(data["rub"])
    except Exception as exc:
        logger.warning("CoinGecko price fetch failed: %s", exc)
        return (
            float(eth_price_cache.get("usd") or 2394.94),
            float(eth_price_cache.get("rub") or 179857.0),
        )


async def _build_blocks(client: httpx.AsyncClient, block_count: int) -> list[dict]:
    """
    Один вызов eth_feeHistory метода возвращает базовую комиссию, использованный газ
    и награду валидатору (=priority fees) персентили (P25/P50/P90/P95) для последних N блоков.
    https://www.quicknode.com/docs/ethereum/eth_feeHistory
    """
    fee_hist = await _rpc(
        client,
        "eth_feeHistory",
        [hex(block_count), "latest", [25, 50, 90, 95]],
    )
    latest_blk = await _rpc(client, "eth_getBlockByNumber", ["latest", False])

    oldest_block = int(fee_hist["oldestBlock"], 16)
    base_fees = [int(bf, 16) for bf in fee_hist["baseFeePerGas"][:-1]]
    gas_ratios = fee_hist["gasUsedRatio"]
    rewards = fee_hist.get("reward", [])

    gas_limit = int(latest_blk["gasLimit"], 16)
    tx_count = len(latest_blk["transactions"])
    size = int(latest_blk.get("size", "0x25000"), 16)
    eth_price = float(eth_price_cache.get("usd") or 2394.0)

    blocks = []
    for i, (bf, ratio) in enumerate(zip(base_fees, gas_ratios)):
        reward = rewards[i] if i < len(rewards) else ["0x0", "0x0", "0x0", "0x0"]
        gas_used = int(ratio * gas_limit)

        blocks.append(
            {
                "height": oldest_block + i,
                "base_fee_per_gas": bf,
                "gas_limit": gas_limit,
                "gas_used": gas_used,
                "transaction_count": tx_count,
                "block_utilization": ratio,
                "gas_pressure": gas_used - gas_limit / 2,
                "tx_per_gas": tx_count / gas_used if gas_used > 0 else 0.0,
                "size": size,
                "priority_p25": int(reward[0], 16) if len(reward) > 0 else 0,
                "priority_p50": int(reward[1], 16) if len(reward) > 1 else 0,
                "priority_p90": int(reward[2], 16) if len(reward) > 2 else 0,
                "priority_p95": int(reward[3], 16) if len(reward) > 3 else 0,
                "last_eth_price": eth_price,
            }
        )
    return blocks


async def init_cache() -> None:
    """Вызывается единожды только на старте —
    изначально заполняет кэш блоков с ~400 историческими блоками"""

    if MOCK_MODE:
        logger.warning("MOCK_MODE=1: реальные запросы к RPC и CoinGecko отключены")
        eth_price_cache["usd"] = 2350.0
        eth_price_cache["rub"] = 215_000.0
        eth_price_cache["updated_at"] = datetime.utcnow()
        block_cache.extend(_mock_blocks(400))
        logger.info("Block cache initialised (mock): %d blocks", len(block_cache))
        return

    async with httpx.AsyncClient() as client:
        # сначала получаем цену ETH чтобы добавить её в данные блока
        usd, rub = await _fetch_eth_price(client)
        eth_price_cache["usd"] = usd
        eth_price_cache["rub"] = rub
        eth_price_cache["updated_at"] = datetime.utcnow()

        blocks = await _build_blocks(client, 400)
        # проставляем цену ETH в блок
        for b in blocks:
            b["last_eth_price"] = usd
        block_cache.extend(blocks)

    logger.info("Block cache initialised: %d blocks", len(block_cache))


async def update_cache() -> None:
    """Вызов каждый ~12 секунд  — добавляем инфо о новых блоках и цену ETH"""
    global _update_counter
    _update_counter += 1

    if MOCK_MODE:
        # В режиме заглушки добавляем 1 синтетический блок поверх последнего
        last_height = block_cache[-1]["height"] if block_cache else 24_900_000
        block_cache.extend(_mock_blocks(1, start_height=last_height + 1))
        return

    async with httpx.AsyncClient() as client:
        # Обновляем цену ETH каждый ~5 мин (25 × 12 с)
        if _update_counter % 25 == 0:
            usd, rub = await _fetch_eth_price(client)
            eth_price_cache["usd"] = usd
            eth_price_cache["rub"] = rub
            eth_price_cache["updated_at"] = datetime.utcnow()

        new_blocks = await _build_blocks(client, 5)

    if not block_cache:
        block_cache.extend(new_blocks)
        return

    latest_cached = block_cache[-1]["height"]
    eth_price = float(eth_price_cache.get("usd") or 2394.0)
    added = 0
    for blk in new_blocks:
        if blk["height"] > latest_cached:
            blk["last_eth_price"] = eth_price
            block_cache.append(blk)
            added += 1

    if added:
        logger.info("Added %d block(s), cache size: %d", added, len(block_cache))
