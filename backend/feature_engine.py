"""
Вычисление множества всех нужных ML-признаков из кэша загруженных блоков.
Каждая модель LightGBM выбирает нужные ей функции с помощью model.feature_name_.
"""

from datetime import datetime

import numpy as np


def compute_all_features(blocks: list[dict]) -> dict:
    if len(blocks) < 2:
        return {}

    blocks = sorted(blocks, key=lambda b: b["height"])
    n = len(blocks)
    current = blocks[-1]
    now = datetime.utcnow()

    # ------------------------------------------------------------------
    # Сырые массивы
    # ------------------------------------------------------------------
    base_fees = np.array([b["base_fee_per_gas"] for b in blocks], dtype=float)
    utilization = np.array([b["block_utilization"] for b in blocks], dtype=float)
    gas_used = np.array([b["gas_used"] for b in blocks], dtype=float)
    tx_count = np.array([b["transaction_count"] for b in blocks], dtype=float)
    p25 = np.array([b["priority_p25"] for b in blocks], dtype=float)
    p50 = np.array([b["priority_p50"] for b in blocks], dtype=float)
    p90 = np.array([b["priority_p90"] for b in blocks], dtype=float)
    p95 = np.array([b["priority_p95"] for b in blocks], dtype=float)
    eth_prices = np.array([b["last_eth_price"] for b in blocks], dtype=float)

    f: dict = {}

    # ------------------------------------------------------------------
    # Общие фичи по текущему блоку
    # ------------------------------------------------------------------
    f["size"] = float(current.get("size", 150_000))
    f["gas_limit"] = float(current["gas_limit"])
    f["gas_used"] = float(current["gas_used"])
    f["transaction_count"] = float(current["transaction_count"])
    f["base_fee_per_gas"] = float(current["base_fee_per_gas"])
    f["last_eth_price"] = float(current["last_eth_price"])
    f["block_utilization"] = float(current["block_utilization"])
    f["gas_pressure"] = float(current["gas_pressure"])
    f["tx_per_gas"] = float(tx_count[-1] / gas_used[-1]) if gas_used[-1] > 0 else 0.0

    # Priority fee для текущего блока
    f["priority_min"] = 0.0
    f["priority_p25"] = float(p25[-1])
    f["priority_p50"] = float(p50[-1])
    f["priority_p90"] = float(p90[-1])
    f["priority_p95"] = float(p95[-1])
    f["priority_max"] = float(p95[-1]) * 2.5  # приблизительно
    f["priority_spread"] = float(p95[-1] - p25[-1])
    f["priority_tail"] = f["priority_max"] - float(p95[-1])
    f["fee_ratio"] = float(p50[-1] / base_fees[-1]) if base_fees[-1] > 0 else 0.0
    f["fee_diff"] = float(p50[-1] - base_fees[-1])

    # ------------------------------------------------------------------
    # Временные признаки
    # ------------------------------------------------------------------
    f["month"] = float(now.month)
    f["day"] = float(now.day)
    f["hour"] = float(now.hour)
    f["day_of_week"] = float(now.weekday())
    f["is_weekend"] = 1.0 if now.weekday() >= 5 else 0.0
    f["week_of_year"] = float(now.isocalendar()[1])
    f["hour_sin"] = float(np.sin(2 * np.pi * now.hour / 24))
    f["hour_cos"] = float(np.cos(2 * np.pi * now.hour / 24))

    def lag(arr, k):  # helper
        idx = max(0, n - 1 - k)
        return float(arr[idx])

    # Base fee лаши
    for k in [1, 2, 3, 5, 10, 20, 50, 100, 300]:
        f[f"base_fee_lag_{k}"] = lag(base_fees, k)

    # Utilization лаги
    for k in [1, 2, 3, 5, 10, 20]:
        f[f"utilization_lag_{k}"] = lag(utilization, k)

    # Priority fee лаги (p50 в качестве репрезентативного значения)
    for k in [1, 2, 3, 5, 10, 50, 100, 300]:
        f[f"priority_lag_{k}"] = lag(p50, k)
    for k in [1, 2, 3, 5, 10]:
        f[f"util_lag_{k}"] = lag(utilization, k)

    # ------------------------------------------------------------------
    # Скользящие средние и волатильности
    # ------------------------------------------------------------------
    def ma(arr, w):
        return float(np.mean(arr[max(0, n - w) :]))

    def vol(arr, w):
        data = arr[max(0, n - w) :]
        return float(np.std(data)) if len(data) > 1 else 0.0

    for w in [5, 10, 20, 50, 100, 300]:
        f[f"base_fee_ma_{w}"] = ma(base_fees, w)
        f[f"base_fee_vol_{w}"] = vol(base_fees, w)
        f[f"utilization_ma_{w}"] = ma(utilization, w)
        f[f"util_ma_{w}"] = ma(utilization, w)
        f[f"priority_ma_{w}"] = ma(p50, w)
        f[f"priority_vol_{w}"] = vol(p50, w)

    # Spread / tail скользящие средние
    spreads = p95 - p25
    f["spread_ma_50"] = float(np.mean(spreads[max(0, n - 50) :]))
    f["tail_ma_50"] = f["priority_tail"]  # simplified
    f["spread_change"] = (
        float((spreads[-1] - spreads[-2]) / spreads[-2])
        if n > 1 and spreads[-2] != 0
        else 0.0
    )
    f["tail_change"] = 0.0

    for lb in [1, 5, 10, 20, 50]:  # "Change" признаки
        prev = lag(base_fees, lb)
        f[f"base_fee_change_{lb}"] = (base_fees[-1] - prev) / prev if prev > 0 else 0.0

    prev_gas = float(gas_used[-2]) if n > 1 else float(gas_used[-1])
    f["gas_used_change"] = (
        (float(gas_used[-1]) - prev_gas) / prev_gas if prev_gas > 0 else 0.0
    )

    prev_tx = float(tx_count[-2]) if n > 1 else float(tx_count[-1])
    f["tx_change"] = (float(tx_count[-1]) - prev_tx) / prev_tx if prev_tx > 0 else 0.0

    # ------------------------------------------------------------------
    # Признаки на основе цены ETH
    # В Ethereum 1 блок выпускается каждые 12с:
    #   1 мин    ≈  5 блоков
    #   10 мин   ≈  50 блоков
    #   1 час    ≈  300 блоков
    # ------------------------------------------------------------------
    def eth_return(lookback_blocks: int) -> float:
        idx = max(0, n - 1 - lookback_blocks)
        p_then = float(eth_prices[idx])
        p_now = float(eth_prices[-1])
        return (p_now - p_then) / p_then if p_then > 0 else 0.0

    def eth_vol(lookback_blocks: int) -> float:
        data = eth_prices[max(0, n - lookback_blocks) :]
        if len(data) < 2:
            return 0.0
        rets = np.diff(data) / data[:-1]
        return float(np.std(rets) * np.sqrt(max(len(data), 1)))

    f["eth_return_1m"] = eth_return(5)
    f["eth_return_10m"] = eth_return(50)
    f["eth_return_1h"] = eth_return(300)
    f["eth_volatility_1h"] = eth_vol(300)
    f["eth_vol_1h"] = eth_vol(300)
    f["eth_return_1d"] = eth_return(n - 1)
    f["eth_vol_1d"] = eth_vol(n) * np.sqrt(max(7200 / n, 1))
    f["eth_return_7d"] = eth_return(n - 1)
    f["eth_vol_7d"] = f["eth_vol_1d"] * np.sqrt(7)

    # ------------------------------------------------------------------
    # Ежедневные/еженедельные агрегаты
    # Полностью корректный lag_1d должен быть 7200 блоков назад. Берём последний доступный
    # блок как приближение (в кэше ~400 блоков / ~80 мин).
    # ------------------------------------------------------------------
    f["lag_1d"] = float(base_fees[0])
    f["lag_2d"] = float(base_fees[0])
    f["ma_1d"] = float(np.mean(base_fees))
    f["ma_3d"] = float(np.mean(base_fees))
    f["ma_7d"] = float(np.mean(base_fees))
    f["trend_1d"] = float((base_fees[-1] - base_fees[0]) / n) if n > 1 else 0.0
    f["trend_week"] = f["trend_1d"]
    f["vol_1d"] = float(np.std(base_fees))
    f["vol_7d"] = f["vol_1d"]
    f["util_ma_1d"] = float(np.mean(utilization))
    f["util_ma_3d"] = float(np.mean(utilization))
    f["util_ma_7d"] = float(np.mean(utilization))

    # Еженедельные/ежедневные фичи о приоритетных комиссиях
    f["spread_1d"] = float(np.mean(spreads))
    f["tail_1d"] = float(np.mean(p95) * 1.5)
    f["spread_7d"] = f["spread_1d"]
    f["tail_7d"] = f["tail_1d"]
    f["vol_1d_priority"] = float(np.std(p50)) if n > 1 else 0.0
    f["vol_7d_priority"] = f["vol_1d_priority"]

    return f
