#!/bin/bash
set -e

# Kill any existing instances on our ports
echo "Cleaning up old processes..."
pkill -9 -f "next dev" 2>/dev/null || true
pkill -9 -f "npm run dev" 2>/dev/null || true
lsof -ti :8000 | xargs kill -9 2>/dev/null || true
lsof -ti :3006 | xargs kill -9 2>/dev/null || true
sleep 1

# Backend
echo "Starting backend on :8000..."
export DYLD_LIBRARY_PATH="/opt/homebrew/opt/expat/lib:$DYLD_LIBRARY_PATH"
(cd "$(dirname "$0")/backend" && python3.12 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload) &
BACKEND_PID=$!

# Wait for backend to be ready
until curl -s http://localhost:8000/ >/dev/null 2>&1; do sleep 0.5; done
echo "Backend ready (PID $BACKEND_PID)"

# Frontend
echo "Starting frontend on :3006..."
(cd "$(dirname "$0")/frontend-v2" && npm run dev -- -p 3006) &
FRONTEND_PID=$!

echo ""
echo "Services running:"
echo "  Backend:  http://localhost:8000  (PID $BACKEND_PID)"
echo "  Frontend: http://localhost:3006  (PID $FRONTEND_PID)"
echo ""
echo "Press Ctrl+C to stop both"

# Stop both on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; pkill -9 -f 'next dev' 2>/dev/null || true; echo 'Stopped.'" EXIT
wait
