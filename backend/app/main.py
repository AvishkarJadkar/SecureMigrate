"""
SecureMigrate — FastAPI Backend
A framework for migrating blockchain digital signatures from ECDSA to ML-DSA.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import API_PREFIX, CHAIN_ID, CORS_ORIGINS
from app.database import SessionLocal, init_db
from app.blockchain.chain import Blockchain
from app.chain_store import load_chain, save_chain
from app.crypto.mldsa_wallet import MLDSAWallet
from app.migration.engine import MigrationEngine
from app.models import WalletModel
from app.routes import wallets, transactions, migration
from app.routes import benchmark
from app.routes import blockchain as blockchain_routes


def purge_legacy_private_keys() -> int:
    """Remove encrypted server-side keys left by the pre-client-custody build."""
    db = SessionLocal()
    try:
        count = (
            db.query(WalletModel)
            .filter(WalletModel.private_key.isnot(None), WalletModel.private_key != "")
            .update({WalletModel.private_key: ""}, synchronize_session=False)
        )
        db.commit()
        return count
    finally:
        db.close()

# ── Global state (single-node, persisted chain) ─────────────────────
blockchain = Blockchain(persist_callback=save_chain)
migration_engine = MigrationEngine()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    global blockchain
    init_db()
    purged = purge_legacy_private_keys()
    if purged:
        print(f"[OK] Purged {purged} legacy server-side private key(s)")

    # Fail closed: never silently reset a persisted chain on load failure.
    loaded = load_chain()
    if loaded is not None:
        blockchain = loaded
    blockchain.persist_callback = save_chain

    print("[OK] Database initialized")
    print(f"[OK] Blockchain ready ({len(blockchain.chain)} block(s), "
          f"tip: {blockchain.last_block.hash[:16]}...)")
    print(f"[OK] PQC backend: {'liboqs ML-DSA-65' if not MLDSAWallet.is_mock else 'MOCK'}")
    yield
    print("Shutting down SecureMigrate...")


app = FastAPI(
    title="SecureMigrate API",
    description="A framework for migrating blockchain digital signatures from ECDSA to post-quantum ML-DSA (FIPS 204).",
    version="1.1.0",
    lifespan=lifespan,
)

# ── CORS ────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ──────────────────────────────────────────────────────────
app.include_router(wallets.router, prefix=API_PREFIX)
app.include_router(transactions.router, prefix=API_PREFIX)
app.include_router(migration.router, prefix=API_PREFIX)
app.include_router(blockchain_routes.router, prefix=API_PREFIX)
app.include_router(benchmark.router, prefix=API_PREFIX)


@app.get("/")
def root():
    return {
        "project": "SecureMigrate",
        "description": "ECDSA → ML-DSA Migration Framework",
        "docs": "/docs",
        "api_prefix": API_PREFIX,
    }


@app.get(f"{API_PREFIX}/health")
def health():
    return {
        "status": "healthy",
        "pqc_backend": "liboqs" if not MLDSAWallet.is_mock else "mock",
        "chain_id": CHAIN_ID,
        "custody": "client",
        "chain_length": len(blockchain.chain),
        "is_valid": blockchain.validate_chain(),
    }
