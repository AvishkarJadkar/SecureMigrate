"""Dual-signed, on-chain ECDSA -> ML-DSA migration engine."""

import time
import uuid
from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any

from app.config import CHAIN_ID
from app.crypto.utils import hash_data, generate_address
from app.crypto.ecdsa_wallet import ECDSAWallet
from app.crypto.mldsa_wallet import MLDSAWallet
from app.blockchain.transaction import Transaction


@dataclass
class MigrationPayload:
    old_address: str
    new_address: str
    new_pubkey: str
    amount: float
    nonce: str
    timestamp: float
    expiry: float
    chain_id: str = CHAIN_ID

    def canonical_bytes(self) -> bytes:
        import json
        return json.dumps(asdict(self), sort_keys=True).encode("utf-8")

    def compute_hash(self) -> str:
        return hash_data(self.canonical_bytes())


@dataclass
class MigrationTransaction:
    payload: MigrationPayload
    ecdsa_signature: str
    mldsa_signature: str
    old_pubkey: str
    new_pubkey: str
    migration_tx_hash: str = ""
    status: str = "pending"
    block_index: Optional[int] = None

    def to_chain_transaction(self) -> Transaction:
        tx = Transaction(
            sender=self.payload.old_address,
            recipient=self.payload.new_address,
            amount=self.payload.amount,
            public_key=self.old_pubkey,
            sig_algo="ecdsa",
            signature=self.ecdsa_signature,
            timestamp=self.payload.timestamp,
            tx_type="migration",
            new_public_key=self.new_pubkey,
            new_signature=self.mldsa_signature,
            nonce=self.payload.nonce,
            expiry=self.payload.expiry,
            chain_id=self.payload.chain_id,
        )
        tx.tx_hash = tx.compute_hash()
        return tx


class MigrationEngine:
    """Orchestrates a migration that is submitted as a normal chain transaction."""

    DEFAULT_EXPIRY_SECONDS = 300

    def __init__(self):
        self.migration_records: list[Dict[str, Any]] = []

    def create_migration_payload(
        self,
        old_address: str,
        new_address: str,
        new_pubkey: str,
        amount: float,
        chain_id: str = CHAIN_ID,
    ) -> MigrationPayload:
        now = time.time()
        return MigrationPayload(
            old_address=old_address,
            new_address=new_address,
            new_pubkey=new_pubkey,
            amount=round(float(amount), 8),
            nonce=uuid.uuid4().hex,
            timestamp=now,
            expiry=now + self.DEFAULT_EXPIRY_SECONDS,
            chain_id=chain_id,
        )

    def build_unsigned_migration(
        self,
        payload: MigrationPayload,
        old_pubkey: str,
        new_pubkey: str,
    ) -> Transaction:
        """Build the canonical unsigned migration. Clients sign tx_hash locally."""
        tx = Transaction(
            sender=payload.old_address,
            recipient=payload.new_address,
            amount=payload.amount,
            public_key=old_pubkey,
            sig_algo="ecdsa",
            timestamp=payload.timestamp,
            tx_type="migration",
            new_public_key=new_pubkey,
            nonce=payload.nonce,
            expiry=payload.expiry,
            chain_id=payload.chain_id,
        )
        tx.tx_hash = tx.compute_hash()
        return tx

    def sign_migration(
        self,
        payload: MigrationPayload,
        old_ecdsa_wallet: ECDSAWallet,
        new_mldsa_wallet: MLDSAWallet,
    ) -> MigrationTransaction:
        # The chain transaction is the single source of truth for the signed payload.
        tx = Transaction.create_migration(payload, old_ecdsa_wallet, new_mldsa_wallet)
        return MigrationTransaction(
            payload=payload,
            ecdsa_signature=tx.signature,
            mldsa_signature=tx.new_signature,
            old_pubkey=old_ecdsa_wallet.public_key_hex,
            new_pubkey=new_mldsa_wallet.public_key_hex,
            migration_tx_hash=tx.tx_hash,
        )

    def verify_migration(self, mtx: MigrationTransaction) -> tuple[bool, str]:
        if generate_address(mtx.old_pubkey) != mtx.payload.old_address:
            return False, "Old public key does not match old address"
        if generate_address(mtx.new_pubkey) != mtx.payload.new_address:
            return False, "New public key does not match new address"
        if mtx.payload.new_pubkey != mtx.new_pubkey:
            return False, "Payload public key does not match signing key"

        tx = mtx.to_chain_transaction()
        if tx.tx_hash != mtx.migration_tx_hash:
            return False, "Migration hash mismatch"
        if not tx.verify():
            return False, "Dual signature verification failed"
        return True, ""

    def execute_migration(
        self,
        blockchain,
        mtx: MigrationTransaction,
    ) -> tuple[bool, str]:
        payload = mtx.payload

        valid, err = self.verify_migration(mtx)
        if not valid:
            mtx.status = "failed"
            return False, f"Signature check failed: {err}"

        if payload.nonce in blockchain.used_nonces:
            mtx.status = "failed"
            return False, "Nonce already used (replay attack blocked)"

        if time.time() > payload.expiry:
            mtx.status = "expired"
            return False, "Migration transaction has expired"

        if payload.old_address in blockchain.migrated_addresses:
            mtx.status = "failed"
            return False, "Old wallet has already been migrated"

        old_balance = blockchain.get_balance(payload.old_address)
        if old_balance <= 0:
            mtx.status = "failed"
            return False, "Old wallet has no balance to migrate"

        if old_balance != payload.amount:
            mtx.status = "failed"
            return False, (
                f"Migration amount ({payload.amount}) does not match "
                f"wallet balance ({old_balance}). Full balance migration required."
            )

        tx = mtx.to_chain_transaction()
        try:
            block = blockchain.submit_and_mine(tx)
        except ValueError as exc:
            mtx.status = "failed"
            return False, str(exc)

        mtx.status = "executed"
        mtx.migration_tx_hash = tx.tx_hash
        mtx.block_index = block.index
        self.migration_records.append(
            {
                "old_address": payload.old_address,
                "new_address": payload.new_address,
                "amount": old_balance,
                "migration_tx_hash": tx.tx_hash,
                "block_index": block.index,
                "timestamp": time.time(),
                "status": "executed",
            }
        )
        return True, f"Migration successful. {old_balance} transferred in block {block.index}."
