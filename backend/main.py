"""
Бэкенд (FastAPI) для прогнозирования комиссий в Ethereum.

Эндпоинты:
  GET /api/gas-данные о текущем газе, прогнозы, цена ETH
  GET /api/health     — проверка работоспособности
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from data_fetcher import block_cache, eth_price_cache, init_cache, update_cache
from predictor import get_current_gas, predict_all

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Словарь сколько примерно нужно газа в зависимости от типа транзакции
GAS_UNITS = {
    "eth_transfer": {"label": "Перевод ETH", "gas": 21_000},
    "erc20_transfer": {"label": "Перевод ERC-20 токена", "gas": 65_000},
    "erc20_approve": {"label": "Одобрение токена (Approve)", "gas": 46_000},
    "nft_mint": {"label": "Выпуск NFT (Mint)", "gas": 120_000},
    "nft_transfer": {"label": "Передача NFT", "gas": 85_000},
    "token_swap": {"label": "Обмен токенов (Uniswap / DEX)", "gas": 150_000},
    "add_liquidity": {"label": "Добавление ликвидности в пул", "gas": 220_000},
    "eth_stake": {"label": "Стейкинг ETH (Lido / RocketPool)", "gas": 65_000},
    "bridge_l2": {"label": "Бридж на L2 (Arbitrum / Optimism)", "gas": 100_000},
    "contract_deploy": {"label": "Деплой смарт-контракта", "gas": 400_000},
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Запуска API-сервиса предсказания комиссий в Ethereum…")
    await init_cache()

    async def _poll():
        while True:
            await asyncio.sleep(12)
            try:
                await update_cache()
            except Exception as exc:
                logger.error("Не удалось обновить кэш: %s", exc)

    task = asyncio.create_task(_poll())
    yield
    task.cancel()


app = FastAPI(
    title="Сервис предсказания комиссий в Ethereum", version="1.0.0", lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/gas-data")
async def gas_data():
    blocks = list(block_cache)
    if not blocks:
        return {"error": "Кэш прогревается, повторите попытку через несколько секунд"}

    return {
        "eth_price_usd": eth_price_cache.get("usd"),
        "eth_price_rub": eth_price_cache.get("rub"),
        "current": get_current_gas(blocks),
        "predictions": predict_all(blocks),
        "gas_units": GAS_UNITS,
        "updated_at": datetime.utcnow().isoformat() + "Z",
    }


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "blocks_cached": len(block_cache),
        "eth_price": eth_price_cache.get("price"),
    }
