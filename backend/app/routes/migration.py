from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.migration.engine import MigrationPayload, MigrationTransaction
from app.models import MigrationModel, TransactionModel
from app.schemas import (
    MigrateWalletResponse,
    MigrationInfo,
    MigrationPrepareRequest,
    MigrationPrepareResponse,
    SubmitMigrationRequest,
)
from app.services import wallet_service

router = APIRouter(prefix="/migrate", tags=["Migration"])


def _get_blockchain():
    from app.main import blockchain
    return blockchain


def _get_migration_engine():
    from app.main import migration_engine
    return migration_engine


def _migration_info(r: MigrationModel) -> MigrationInfo:
    return MigrationInfo(
        id=r.id,
        old_address=r.old_address,
        new_address=r.new_address,
        old_wallet_type=r.old_wallet_type,
        new_wallet_type=r.new_wallet_type,
        migration_tx_hash=r.migration_tx_hash,
        amount=r.amount,
        timestamp=r.timestamp,
        status=r.status,
        block_index=r.block_index,
    )


def _load_migration_wallets(db: Session, old_address: str, new_address: str):
    old_wallet = wallet_service.get_wallet_by_address(db, old_address)
    if not old_wallet:
        raise HTTPException(status_code=404, detail="Old wallet not found")
    if old_wallet.wallet_type != "ecdsa":
        raise HTTPException(status_code=400, detail="Only ECDSA wallets can be migrated")
    if old_wallet.is_migrated:
        raise HTTPException(status_code=400, detail="Wallet has already been migrated")

    new_wallet = wallet_service.get_wallet_by_address(db, new_address)
    if not new_wallet or new_wallet.wallet_type != "mldsa":
        raise HTTPException(status_code=404, detail="Destination ML-DSA wallet not found")
    if new_wallet.is_migrated:
        raise HTTPException(status_code=400, detail="Destination wallet is migrated")
    if old_wallet.address == new_wallet.address:
        raise HTTPException(status_code=400, detail="Source and destination must differ")
    return old_wallet, new_wallet


@router.post("/prepare", response_model=MigrationPrepareResponse)
def prepare_migration(req: MigrationPrepareRequest, db: Session = Depends(get_db)):
    bc = _get_blockchain()
    engine = _get_migration_engine()
    old_wallet, new_wallet = _load_migration_wallets(
        db, req.old_address, req.new_address
    )

    balance = bc.get_balance(old_wallet.address)
    if balance <= 0:
        raise HTTPException(status_code=400, detail="Wallet has no balance to migrate")

    payload = engine.create_migration_payload(
        old_address=old_wallet.address,
        new_address=new_wallet.address,
        new_pubkey=new_wallet.public_key,
        amount=balance,
    )
    tx = engine.build_unsigned_migration(
        payload, old_wallet.public_key, new_wallet.public_key
    )
    return MigrationPrepareResponse(
        sender=tx.sender,
        recipient=tx.recipient,
        amount=tx.amount,
        public_key=tx.public_key,
        new_public_key=tx.new_public_key,
        nonce=tx.nonce,
        timestamp=tx.timestamp,
        expiry=tx.expiry,
        chain_id=tx.chain_id,
        tx_hash=tx.tx_hash,
        tx_type=tx.tx_type,
    )


@router.post("", response_model=MigrateWalletResponse)
def migrate_wallet(req: SubmitMigrationRequest, db: Session = Depends(get_db)):
    bc = _get_blockchain()
    engine = _get_migration_engine()
    old_wallet, new_wallet = _load_migration_wallets(
        db, req.sender, req.recipient
    )

    if req.tx_type != "migration":
        raise HTTPException(status_code=400, detail="Invalid transaction type")
    if req.public_key != old_wallet.public_key:
        raise HTTPException(status_code=400, detail="Old public key mismatch")
    if req.new_public_key != new_wallet.public_key:
        raise HTTPException(status_code=400, detail="New public key mismatch")

    payload = MigrationPayload(
        old_address=req.sender,
        new_address=req.recipient,
        new_pubkey=req.new_public_key,
        amount=req.amount,
        nonce=req.nonce,
        timestamp=req.timestamp,
        expiry=req.expiry,
        chain_id=req.chain_id,
    )
    mtx = MigrationTransaction(
        payload=payload,
        ecdsa_signature=req.signature,
        mldsa_signature=req.new_signature,
        old_pubkey=req.public_key,
        new_pubkey=req.new_public_key,
        migration_tx_hash=req.tx_hash,
    )

    ok, msg = engine.execute_migration(bc, mtx)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)

    try:
        wallet_service.mark_wallet_migrated(
            db, old_wallet.address, new_wallet.address
        )
        db.add(
            TransactionModel(
                tx_hash=mtx.migration_tx_hash,
                sender=old_wallet.address,
                recipient=new_wallet.address,
                amount=payload.amount,
                signature=mtx.ecdsa_signature,
                sig_algo="ecdsa",
                public_key=mtx.old_pubkey,
                block_index=mtx.block_index,
                timestamp=payload.timestamp,
                tx_type="migration",
            )
        )
        db.add(
            MigrationModel(
                old_address=old_wallet.address,
                new_address=new_wallet.address,
                old_wallet_type="ecdsa",
                new_wallet_type="mldsa",
                migration_tx_hash=mtx.migration_tx_hash,
                amount=payload.amount,
                timestamp=payload.timestamp,
                status="executed",
                block_index=mtx.block_index,
                old_public_key=mtx.old_pubkey,
                new_public_key=mtx.new_pubkey,
                ecdsa_signature=mtx.ecdsa_signature,
                mldsa_signature=mtx.mldsa_signature,
                nonce=payload.nonce,
                expiry=payload.expiry,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        bc.rollback_last_block()
        raise HTTPException(
            status_code=500,
            detail="Migration was mined but the database write failed; chain rolled back",
        )

    return MigrateWalletResponse(
        old_address=old_wallet.address,
        new_address=new_wallet.address,
        new_public_key=new_wallet.public_key,
        migration_tx_hash=mtx.migration_tx_hash,
        amount_migrated=payload.amount,
        block_index=mtx.block_index,
        status="executed",
    )


@router.get("/migrations", response_model=list[MigrationInfo])
def list_migrations(db: Session = Depends(get_db)):
    records = db.query(MigrationModel).order_by(MigrationModel.id.desc()).all()
    return [_migration_info(r) for r in records]


@router.get("/migrations/{migration_id}", response_model=MigrationInfo)
def get_migration(migration_id: int, db: Session = Depends(get_db)):
    r = db.query(MigrationModel).filter(MigrationModel.id == migration_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Migration record not found")
    return _migration_info(r)
