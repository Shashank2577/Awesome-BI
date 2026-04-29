from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
from app.api.endpoints import router

app = FastAPI(title="Reporting Orchestration API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(router)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "Reporting Orchestration API is running"}
