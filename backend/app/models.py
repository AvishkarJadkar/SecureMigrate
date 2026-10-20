from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.sql import func
from .database import Base


class WalletModel(Base):
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    address = Column(String, unique=True, index=True, nullable=False)
    public_key = Column(String, nullable=False)
    private_key = Column(String, nullable=True)  # never stored for client-custody wallets
    wallet_type = Column(String, nullable=False)   # "ecdsa" | "mldsa"
    is_migrated = Column(Boolean, default=False)
    migrated_to = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class TransactionModel(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tx_hash = Column(String, unique=True, index=True, nullable=False)
    sender = Column(String, index=True, nullable=False)
    recipient = Column(String, index=True, nullable=False)
    amount = Column(Float, nullable=False)
    signature = Column(String, nullable=False)
    sig_algo = Column(String, nullable=False)
    public_key = Column(String, nullable=False)
    block_index = Column(Integer, nullable=True)
    timestamp = Column(Float, nullable=False)
    tx_type = Column(String, nullable=False, default="transfer")


class MigrationModel(Base):
    __tablename__ = "migrations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    old_address = Column(String, index=True, nullable=False)
    new_address = Column(String, index=True, nullable=False)
    old_wallet_type = Column(String, default="ecdsa")
    new_wallet_type = Column(String, default="mldsa")
    migration_tx_hash = Column(String, unique=True, nullable=False)
    amount = Column(Float, nullable=False)
    timestamp = Column(Float, nullable=False)
    status = Column(String, default="executed")
    block_index = Column(Integer, nullable=True)
    old_public_key = Column(String, nullable=True)
    new_public_key = Column(String, nullable=True)
    ecdsa_signature = Column(String, nullable=True)
    mldsa_signature = Column(String, nullable=True)
    nonce = Column(String, nullable=True)
    expiry = Column(Float, nullable=True)


class BlockModel(Base):
    __tablename__ = "blocks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    index = Column(Integer, unique=True, nullable=False)
    timestamp = Column(Float, nullable=False)
    previous_hash = Column(String, nullable=False)
    hash = Column(String, unique=True, nullable=False)
    tx_count = Column(Integer, default=0)


class ChainStateModel(Base):
    __tablename__ = "chain_state"

    id = Column(Integer, primary_key=True)
    data = Column(Text, nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
