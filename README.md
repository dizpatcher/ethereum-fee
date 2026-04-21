# Сервис для прогнозирования транзакционных издержек в операциях с цифровыми валютами с использованием MLOps практик

Структура проекта

```
fee_prediction/
├── notebooks/
├── airflow/
├── scripts/
├── backend/
│   ├── main.py           — FastAPI сервер
│   ├── data_fetcher.py   — eth_feeHistory + CoinGecko
│   ├── feature_engine.py — вычисление фичей для моделей
│   ├── predictor.py      — загрузка 10 моделей + предсказания
│   ├── requirements.txt
│   └── .env
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Header.tsx         — шапка + кнопка кошелька
│       │   ├── StatsRow.tsx       — ETH цена / текущий газ / стоимость трансфера
│       │   ├── PredictionGrid.tsx — карточки прогноза
│       │   ├── FeeChart.tsx       — stacked bar chart (Recharts)
│       │   └── TransactionEstimator.tsx — форма + MetaMask/Rabby
│       ├── hooks/useGasData.ts   — опрос API каждые 15 с
│       └── hooks/useWallet.ts    — подключение кошелька по EIP-1193
└── start.sh              — запуск обоих сервисов
```

Как запустить

```
cd backend && python3 -m uvicorn main:app --reload
```