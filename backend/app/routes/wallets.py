from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import RegisterWalletRequest, WalletInfo
from app.services import wallet_service

router = APIRouter(prefix="/wallets", tags=["Wallets"])


def _get_blockchain():
    """Import here to avoid circular imports — blockchain is set on app state."""
    from app.main import blockchain
    return blockchain


@router.post("", response_model=WalletInfo, status_code=201)
def register_wallet(req: RegisterWalletRequest, db: Session = Depends(get_db)):
    try:
        w = wallet_service.register_wallet(db, req.wallet_type, req.public_key)
        return WalletInfo(
            address=w.address,
            public_key=w.public_key,
            wallet_type=w.wallet_type,
            balance=0.0,
            is_migrated=w.is_migrated,
            migrated_to=w.migrated_to,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=list[WalletInfo])
def list_wallets(db: Session = Depends(get_db)):
    bc = _get_blockchain()
    wallets = wallet_service.get_all_wallets(db)
    return [
        WalletInfo(
            address=w.address,
            public_key=w.public_key,
            wallet_type=w.wallet_type,
            balance=bc.get_balance(w.address),
            is_migrated=w.is_migrated,
            migrated_to=w.migrated_to,
        )
        for w in wallets
    ]


@router.get("/{address}", response_model=WalletInfo)
def get_wallet(address: str, db: Session = Depends(get_db)):
    bc = _get_blockchain()
    w = wallet_service.get_wallet_by_address(db, address)
    if not w:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return WalletInfo(
        address=w.address,
        public_key=w.public_key,
        wallet_type=w.wallet_type,
        balance=bc.get_balance(w.address),
        is_migrated=w.is_migrated,
        migrated_to=w.migrated_to,
    )


@router.get("/{address}/history")
def get_wallet_history(address: str, db: Session = Depends(get_db)):
    bc = _get_blockchain()
    w = wallet_service.get_wallet_by_address(db, address)
    if not w:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return bc.get_history(address)
