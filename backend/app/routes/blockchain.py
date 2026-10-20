from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from dataclasses import asdict

from app.database import get_db
from app.schemas import ChainStatus, FaucetRequest, MineResponse, BlockInfo
from app.services import wallet_service

router = APIRouter(prefix="/chain", tags=["Blockchain"])


def _get_blockchain():
    from app.main import blockchain
    return blockchain


@router.get("", response_model=list[BlockInfo])
def get_chain():
    bc = _get_blockchain()
    return [
        BlockInfo(
            index=b.index,
            timestamp=b.timestamp,
            previous_hash=b.previous_hash,
            hash=b.hash,
            tx_count=len(b.transactions),
            transactions=b.transactions,
        )
        for b in bc.chain
    ]


@router.get("/status", response_model=ChainStatus)
def get_chain_status():
    bc = _get_blockchain()
    total_txs = sum(len(b.transactions) for b in bc.chain)
    return ChainStatus(
        chain_length=len(bc.chain),
        latest_block_hash=bc.last_block.hash,
        latest_block_index=bc.last_block.index,
        total_transactions=total_txs,
        pending_transactions=len(bc.pending_transactions),
        is_valid=bc.validate_chain(),
    )


@router.post("/mine", response_model=MineResponse)
def mine_block():
    bc = _get_blockchain()
    if not bc.pending_transactions:
        raise HTTPException(status_code=400, detail="No pending transactions to mine")
    try:
        block = bc.create_block()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return MineResponse(
        block_index=block.index,
        block_hash=block.hash,
        tx_count=len(block.transactions),
    )


@router.post("/faucet")
def faucet(req: FaucetRequest, db: Session = Depends(get_db)):
    bc = _get_blockchain()

    # Check wallet exists in DB
    w = wallet_service.get_wallet_by_address(db, req.address)
    if not w:
        raise HTTPException(status_code=404, detail="Wallet not found. Create it first.")

    try:
        block = bc.fund_and_mine(req.address, req.amount)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {
        "message": f"Funded {req.address} with {req.amount} coins",
        "balance": bc.get_balance(req.address),
        "block_index": block.index,
    }
