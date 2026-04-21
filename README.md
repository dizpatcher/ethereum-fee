# Сервис для прогнозирования транзакционных издержек в операциях с цифровыми валютами с использованием MLOps практик

Структура проекта

```
fee_prediction/
├── backend/
│   ├── main.py           — FastAPI сервер
│   ├── data_fetcher.py   — eth_feeHistory + CoinGecko
│   ├── feature_engine.py — вычисление фичей для моделей
│   ├── predictor.py      — загрузка 10 моделей + предсказания
│   ├── requirements.txt
│   └── .env
├── notebooks/
├── airflow/
├── scripts/
```

Как запустить

```
cd backend && python3 -m uvicorn main:app --reload
```