from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    SubmitTransferRequest,
    TransactionResponse,
    TransferPrepareRequest,
    TransferPrepareResponse,
)
from app.services import tx_service

router = APIRouter(prefix="/transactions", tags=["Transactions"])


def _get_blockchain():
    from app.main import blockchain
    return blockchain


@router.post("/prepare", response_model=TransferPrepareResponse)
def prepare_transaction(req: TransferPrepareRequest, db: Session = Depends(get_db)):
    bc = _get_blockchain()
    try:
        return tx_service.prepare_transfer(
            db=db,
            blockchain=bc,
            sender_address=req.sender_address,
            recipient_address=req.recipient_address,
            amount=req.amount,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("", response_model=TransactionResponse)
def submit_transaction(req: SubmitTransferRequest, db: Session = Depends(get_db)):
    bc = _get_blockchain()
    try:
        return tx_service.submit_transfer(db=db, blockchain=bc, req=req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=list[TransactionResponse])
def list_transactions(limit: int = 50, db: Session = Depends(get_db)):
    txs = tx_service.get_all_transactions(db, limit)
    return [
        TransactionResponse(
            tx_hash=t.tx_hash,
            sender=t.sender,
            recipient=t.recipient,
            amount=t.amount,
            sig_algo=t.sig_algo,
            tx_type=t.tx_type,
            block_index=t.block_index,
            timestamp=t.timestamp,
        )
        for t in txs
    ]


@router.get("/{tx_hash}", response_model=TransactionResponse)
def get_transaction(tx_hash: str, db: Session = Depends(get_db)):
    t = tx_service.get_transaction_by_hash(db, tx_hash)
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return TransactionResponse(
        tx_hash=t.tx_hash,
        sender=t.sender,
        recipient=t.recipient,
        amount=t.amount,
        sig_algo=t.sig_algo,
        tx_type=t.tx_type,
        block_index=t.block_index,
        timestamp=t.timestamp,
    )
