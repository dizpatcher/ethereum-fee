#!/bin/bash
# GasForecast — запуск бэкенда и фронтенда

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Запуск бэкенда (FastAPI)..."
cd "$ROOT/backend"
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "🌐 Запуск фронтенда (Vite)..."
cd "$ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Нажмите Ctrl+C для остановки."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
