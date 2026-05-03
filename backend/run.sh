#!/bin/bash
# Fix macOS/homebrew Python expat linking issue
export DYLD_LIBRARY_PATH="/opt/homebrew/opt/expat/lib:$DYLD_LIBRARY_PATH"
exec python3.12 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload "$@"
