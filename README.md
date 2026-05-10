# ETH Fee Prediction

Сервис прогнозирования транзакционных издержек в сети Ethereum с использованием MLOps-практик.

Предсказывает `base fee` и `priority fee` на 5 горизонтов: следующий блок (~12 с), +10 мин, +1 час, +1 день, +1 неделю. Позволяет операторам цифровых платформ принять решение — провести транзакцию сейчас или подождать снижения комиссий.

---

## Возможности

- Прогноз комиссий на 5 временны́х горизонтов (10 моделей LightGBM)
- Отображение стоимости транзакций в ETH, USD и RUB
- Оценка стоимости для 10 типов транзакций (перевод ETH, swap, NFT mint и др.)
- Интеграция с Web3-кошельками MetaMask и Rabby Wallet через EIP-1193
- Автозаполнение `maxFeePerGas` / `maxPriorityFeePerGas` из предсказания модели
- Автоматическое обновление данных каждые 15 секунд

---

## Стек технологий

| Слой | Технологии |
|------|-----------|
| ML | LightGBM, pandas, numpy, scikit-learn |
| Backend | FastAPI, uvicorn, httpx |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts |
| MLOps | Apache Airflow 2, DVC |
| Data | Google BigQuery, Ethereum RPC (`eth_feeHistory`), CoinGecko API |
| Infra | Docker, Docker Compose, nginx |

---

## Архитектура

```
┌─────────────────────────────────────────────────────────┐
│                      Пользователь                       │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTP :8765
                            ▼
┌───────────────────── nginx (frontend) ──────────────────┐
│  React SPA          proxy /api/ → backend:8000          │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
┌─────────────────── FastAPI (backend) ───────────────────┐
│  GET /api/gas-data                                      │
│  ┌──────────────┐   ┌──────────────┐  ┌─────────────┐  │
│  │ data_fetcher │   │feature_engine│  │  predictor  │  │
│  │ eth_feeHist. │──▶│  129 фичей   │─▶│ 10 LightGBM │  │
│  │ CoinGecko    │   │              │  │   моделей   │  │
│  └──────────────┘   └──────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────┘

┌─────────────────── MLOps Pipeline ──────────────────────┐
│                                                         │
│  Airflow DAG 1 (ежедневно 07:00 МСК)                   │
│  BigQuery → blocks + priority fees + ETH price         │
│  → merge → master_dataset.parquet                      │
│                                                         │
│  Airflow DAG 2 (воскресенье 09:00 МСК)                 │
│  build features → train 10 models → deploy             │
│                                                         │
│  DVC — версионирование моделей (~27 MB)                 │
└─────────────────────────────────────────────────────────┘
```

---

## Структура проекта

```
fee_prediction/
├── backend/
│   ├── main.py             — FastAPI-приложение, эндпоинты
│   ├── data_fetcher.py     — eth_feeHistory + CoinGecko, кэш 400 блоков
│   ├── feature_engine.py   — вычисление 129 признаков из блоков
│   ├── predictor.py        — загрузка 10 LightGBM-моделей, predict_all()
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx              — шапка, цена ETH, переключатель валюты
│   │   │   ├── StatsRow.tsx            — текущий газ, стоимость перевода
│   │   │   ├── PredictionGrid.tsx      — 5 карточек прогноза
│   │   │   ├── FeeChart.tsx            — stacked bar chart (Recharts)
│   │   │   └── TransactionEstimator.tsx — калькулятор + MetaMask/Rabby
│   │   ├── hooks/
│   │   │   ├── useGasData.ts           — опрос API каждые 15 с
│   │   │   └── useWallet.ts            — EIP-1193 кошелёк
│   │   └── api/gasApi.ts
│   ├── nginx.conf
│   └── Dockerfile
├── airflow/
│   └── dags/
│       ├── eth_data_collection.py      — DAG ежедневного сбора данных
│       └── model_retraining.py         — DAG еженедельного переобучения
├── notebooks/
│   ├── base_fee_data.ipynb             — сбор и EDA данных base fee
│   ├── base_fee_learn.ipynb            — обучение 5 моделей base fee
│   ├── priority_fee_data.ipynb         — сбор и EDA данных priority fee
│   ├── priority_fee_learn.ipynb        — обучение 5 моделей priority fee
│   └── models/                         — production-модели (DVC)
│       ├── next_block_lgbm_model.pkl
│       ├── 10m_lgbm_model.pkl
│       ├── 1h_lgbm_model.pkl
│       ├── 1d_lgbm_model.pkl
│       ├── 1w_lgbm_model.pkl
│       └── priority/
│           ├── next_block_priority_lgbm.pkl
│           ├── 10m_priority_lgbm.pkl
│           ├── 1h_priority_lgbm.pkl
│           ├── 1d_priority_lgbm.pkl
│           └── 1w_priority_lgbm.pkl
├── docker-compose.yml
├── .env.example
├── notebooks/models.dvc
└── start.sh
```

---

## Быстрый старт (локальная разработка)

### Требования

- Python 3.11+
- Node.js 20+

### Установка и запуск

```bash
git clone https://github.com/dizpatcher/eth-fee-prediction.git
cd eth-fee-prediction

# Получить модели через DVC
dvc pull

# Настроить переменные окружения
cp .env.example .env
# отредактировать .env: добавить EL_NODE_URL и COINGECKO_API_KEY

# Установить зависимости бэкенда
cd backend && pip install -r requirements.txt && cd ..

# Установить зависимости фронтенда
cd frontend && npm install && cd ..

# Запустить оба сервиса
./start.sh
```

Приложение будет доступно на `http://localhost:5173`

> Для быстрого теста без RPC-ноды установите `MOCK_MODE=1` в `.env` — бэкенд сгенерирует синтетические данные.

---

## Запуск через Docker

### Локально

```bash
cp .env.example .env
# заполнить .env

docker compose up -d
```

Приложение: `http://localhost:8765`

### На сервере (VPS)

```bash
# 1. Скопировать файлы на сервер
scp docker-compose.yml .env user@your-server:~/fee-prediction/
scp -r notebooks/models user@your-server:~/fee-prediction/models/

# 2. На сервере
ssh user@your-server
cd ~/fee-prediction
docker compose up -d
```

Приложение: `http://<IP>:8765`

### Обновление до новой версии

```bash
docker compose pull && docker compose up -d
```

---

## Переменные окружения

| Переменная | Описание | Пример |
|-----------|----------|--------|
| `EL_NODE_URL` | HTTPS-эндпоинт Ethereum RPC | `https://eth-mainnet.g.alchemy.com/v2/KEY` |
| `COINGECKO_API_KEY` | Demo API key CoinGecko | `CG-xxx` |
| `MOCK_MODE` | `1` — синтетические данные, `0` — реальные | `0` |

Бесплатные RPC-ноды: [Alchemy](https://alchemy.com) или [Infura](https://infura.io).  
Бесплатный API key CoinGecko: [coingecko.com/api](https://www.coingecko.com/en/api).

---

## API

### `GET /api/gas-data`

Возвращает текущее состояние сети и прогнозы на все горизонты.

```json
{
  "eth_price_usd": 2354.0,
  "eth_price_rub": 215241.0,
  "current": {
    "base_fee_gwei": 12.4,
    "priority_fee_gwei": 0.05,
    "total_gwei": 12.45,
    "block_number": 21900401,
    "block_utilization": 52.3
  },
  "predictions": {
    "next_block": { "base_fee_gwei": 12.6, "priority_fee_gwei": 0.05, "total_gwei": 12.65, "label": "Следующий блок (~12 с)" },
    "10m":        { "base_fee_gwei": 11.8, ... },
    "1h":         { ... },
    "1d":         { ... },
    "1w":         { ... }
  },
  "gas_units": {
    "eth_transfer":   { "label": "Перевод ETH", "gas": 21000 },
    "token_swap":     { "label": "Обмен токенов (Uniswap / DEX)", "gas": 150000 }
  },
  "updated_at": "2026-05-10T10:00:00Z"
}
```

### `GET /api/health`

```json
{ "status": "ok", "blocks_cached": 400, "eth_price_usd": 2354.0 }
```

---

## MLOps Pipeline

### Сбор данных (`eth_data_collection` DAG)

Запускается **ежедневно в 07:00 МСК**. Три задачи выполняются параллельно:

```
fetch_blocks ──┐
fetch_priority_fees ──┼──▶ merge_daily_data ──▶ append_to_master
fetch_eth_prices ──┘
```

- **`fetch_blocks`** — блоки Ethereum из `bigquery-public-data.crypto_ethereum.blocks`
- **`fetch_priority_fees`** — перцентили priority fee (p25/p50/p90/p95) из `crypto_ethereum.transactions`
- **`fetch_eth_prices`** — почасовая цена ETH/USD из CoinGecko
- **`merge_daily_data`** — объединение через `pd.merge_asof(direction="backward")` без утечки будущего
- **`append_to_master`** — дозапись в единый `master_dataset.parquet` с дедупликацией

### Переобучение моделей (`model_retraining` DAG)

Запускается **каждое воскресенье в 09:00 МСК**.

```
build_common_features
        │
        ├──▶ build_base_fee_datasets ──▶ train_base_{next_block,10m,1h,1d,1w} ──┐
        │                                                                         ├──▶ deploy_models
        └──▶ build_priority_datasets ──▶ train_priority_{next_block,10m,1h,1d,1w} ┘
```

Параметры LightGBM: `n_estimators=5000, learning_rate=0.01, max_depth=50, subsample=0.8`, ранняя остановка при отсутствии улучшения на валидации в течение 50 итераций. Разбивка: 80% train / 10% val / 10% test — хронологически, без перемешивания.

### Версионирование моделей (DVC)

```bash
# Загрузить текущие production-модели
dvc pull

# После переобучения зафиксировать новую версию
dvc add notebooks/models
git add notebooks/models.dvc
git commit -m "update models"
dvc push
```

---

## Docker Hub

| Образ | Описание |
|-------|----------|
| [`dizpatcher/eth-fee-backend`](https://hub.docker.com/r/dizpatcher/eth-fee-backend) | FastAPI + LightGBM (multi-platform: amd64/arm64) |
| [`dizpatcher/eth-fee-frontend`](https://hub.docker.com/r/dizpatcher/eth-fee-frontend) | React SPA + nginx |

---

## Автор

Артём Выродов — выпускная квалификационная работа, программа DevOps24-1м,  
Финансовый университет при Правительстве Российской Федерации, 2026.
