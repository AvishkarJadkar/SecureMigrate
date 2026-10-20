from sqlalchemy.orm import Session

from app.crypto.ecdsa_wallet import ECDSAWallet
from app.crypto.mldsa_wallet import MLDSAWallet
from app.crypto.utils import generate_address
from app.models import WalletModel


def _normalize(public_key_hex: str) -> str:
    return public_key_hex.strip().lower().removeprefix("0x")


def validate_public_key(wallet_type: str, public_key_hex: str) -> str:
    public_key = _normalize(public_key_hex)
    if wallet_type == "ecdsa":
        valid = ECDSAWallet.validate_public_key(public_key)
    elif wallet_type == "mldsa":
        valid = MLDSAWallet.validate_public_key(public_key)
    else:
        valid = False
    if not valid:
        raise ValueError(f"Invalid {wallet_type} public key")
    return public_key


def register_wallet(db: Session, wallet_type: str, public_key_hex: str) -> WalletModel:
    """Register a client-generated public key. Private keys never reach the server."""
    public_key = validate_public_key(wallet_type, public_key_hex)
    address = generate_address(public_key)

    existing = get_wallet_by_address(db, address)
    if existing:
        if existing.public_key != public_key or existing.wallet_type != wallet_type:
            raise ValueError("Address is already registered with a different key")
        return existing

    wallet = WalletModel(
        address=address,
        public_key=public_key,
        # Empty, not a key: keeps compatibility with older SQLite schemas that
        # declared this legacy column NOT NULL. No secret material is stored.
        private_key="",
        wallet_type=wallet_type,
    )
    db.add(wallet)
    db.commit()
    db.refresh(wallet)
    return wallet


def get_wallet_by_address(db: Session, address: str) -> WalletModel | None:
    return db.query(WalletModel).filter(WalletModel.address == address).first()


def get_all_wallets(db: Session) -> list[WalletModel]:
    return db.query(WalletModel).order_by(WalletModel.id.asc()).all()


def mark_wallet_migrated(db: Session, old_address: str, new_address: str):
    wallet = get_wallet_by_address(db, old_address)
    if wallet:
        wallet.is_migrated = True
        wallet.migrated_to = new_address
        db.flush()
