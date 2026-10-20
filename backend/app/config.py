import os
from pathlib import Path

# Project root
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Database
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'securemigrate.db'}")

# API
API_PREFIX = "/api"
CHAIN_ID = os.getenv("CHAIN_ID", "securemigrate-v1")

# CORS — explicit dev-server origins, configurable for deployment
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

# Benchmark defaults
BENCHMARK_ITERATIONS = 50
