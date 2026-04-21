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

Запуск:

```
cd fee_prediction
./start.sh
```

Или по отдельности:
```
### терминал 1
cd backend && python3 -m uvicorn main:app --reload
```

```
# терминал 2
cd frontend && npm run dev
```

Как работает бэкенд: при старте делает eth_feeHistory(400, 'latest', [25,50,90,95]) — один RPC вызов даёт данные по последним 400 блокам (base fee + priority fee percentiles). Каждые 12 секунд догружает новые блоки. Модели выбирают нужные фичи автоматически через model.feature_name_.

Интеграция крипто-кошельков: кнопки "Открыть в кошельке" вызывают window.ethereum.request({ method: 'eth_sendTransaction' }) с предзаполненными maxFeePerGas и maxPriorityFeePerGas из предсказания модели. Работает с MetaMask и Rabby Wallet (оба реализуют EIP-1193).