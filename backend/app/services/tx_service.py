import time

from sqlalchemy.orm import Session

from app.blockchain.chain import Blockchain
from app.blockchain.transaction import Transaction
from app.config import CHAIN_ID
from app.models import TransactionModel, WalletModel


def _get_sender(db: Session, address: str) -> WalletModel:
    wallet = db.query(WalletModel).filter(WalletModel.address == address).first()
    if not wallet:
        raise ValueError(f"Sender wallet not found: {address}")
    if wallet.is_migrated:
        raise ValueError("Sender wallet has been migrated and is spend-disabled")
    return wallet


def prepare_transfer(
    db: Session,
    blockchain: Blockchain,
    sender_address: str,
    recipient_address: str,
    amount: float,
) -> dict:
    """Build the canonical unsigned transfer. The client signs tx_hash locally."""
    sender = _get_sender(db, sender_address)
    if recipient_address == sender_address:
        raise ValueError("Sender and recipient must be different")
    if amount <= 0:
        raise ValueError("Amount must be positive")
    balance = blockchain.get_balance(sender_address)
    if amount > balance:
        raise ValueError(f"Insufficient balance: {balance}")

    tx = Transaction(
        sender=sender_address,
        recipient=recipient_address,
        amount=amount,
        public_key=sender.public_key,
        sig_algo=sender.wallet_type,
        timestamp=time.time(),
        tx_type="transfer",
        chain_id=CHAIN_ID,
    )
    tx.tx_hash = tx.compute_hash()
    return {
        "sender": tx.sender,
        "recipient": tx.recipient,
        "amount": tx.amount,
        "public_key": tx.public_key,
        "sig_algo": tx.sig_algo,
        "timestamp": tx.timestamp,
        "tx_hash": tx.tx_hash,
        "tx_type": tx.tx_type,
        "chain_id": tx.chain_id,
    }


def submit_transfer(db: Session, blockchain: Blockchain, req) -> dict:
    """Verify a client-signed transfer, mine it, and persist it."""
    sender = _get_sender(db, req.sender)
    if sender.wallet_type != req.sig_algo or sender.public_key != req.public_key:
        raise ValueError("Transaction public key does not match the sender wallet")

    tx = Transaction(
        sender=req.sender,
        recipient=req.recipient,
        amount=req.amount,
        public_key=req.public_key,
        sig_algo=req.sig_algo,
        signature=req.signature,
        timestamp=req.timestamp,
        tx_hash=req.tx_hash,
        tx_type="transfer",
        chain_id=req.chain_id,
    )
    if tx.tx_hash != tx.compute_hash():
        raise ValueError("Transaction hash mismatch")
    if not tx.verify():
        raise ValueError("Invalid transaction signature")

    block = blockchain.submit_and_mine(tx)

    try:
        db.add(
            TransactionModel(
                tx_hash=tx.tx_hash,
                sender=tx.sender,
                recipient=tx.recipient,
                amount=tx.amount,
                signature=tx.signature,
                sig_algo=tx.sig_algo,
                public_key=tx.public_key,
                block_index=block.index,
                timestamp=tx.timestamp,
                tx_type=tx.tx_type,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        blockchain.rollback_last_block()
        raise

    return {
        "tx_hash": tx.tx_hash,
        "sender": tx.sender,
        "recipient": tx.recipient,
        "amount": tx.amount,
        "sig_algo": tx.sig_algo,
        "tx_type": tx.tx_type,
        "block_index": block.index,
        "timestamp": tx.timestamp,
    }


def get_all_transactions(db: Session, limit: int = 50) -> list[TransactionModel]:
    return db.query(TransactionModel).order_by(
        TransactionModel.id.desc()
    ).limit(limit).all()


def get_transaction_by_hash(db: Session, tx_hash: str) -> TransactionModel | None:
    return db.query(TransactionModel).filter(
        TransactionModel.tx_hash == tx_hash
    ).first()
