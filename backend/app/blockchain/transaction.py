import json
import time
from dataclasses import dataclass
from typing import Literal

from app.config import CHAIN_ID
from app.crypto.utils import hash_data, generate_address
from app.crypto.ecdsa_wallet import ECDSAWallet
from app.crypto.mldsa_wallet import MLDSAWallet


@dataclass
class Transaction:
    sender: str
    recipient: str
    amount: float
    public_key: str
    sig_algo: Literal["ecdsa", "mldsa"]
    signature: str = ""
    timestamp: float = 0.0
    tx_hash: str = ""
    tx_type: Literal["transfer", "migration", "faucet"] = "transfer"
    new_public_key: str = ""
    new_signature: str = ""
    nonce: str = ""
    expiry: float = 0.0
    chain_id: str = CHAIN_ID

    def __post_init__(self):
        self.amount = round(float(self.amount), 8)

    def _hash_fields(self) -> dict:
        return {
            "sender": self.sender,
            "recipient": self.recipient,
            "amount": self.amount,
            "public_key": self.public_key,
            "sig_algo": self.sig_algo,
            "timestamp": self.timestamp,
            "tx_type": self.tx_type,
            "new_public_key": self.new_public_key,
            "nonce": self.nonce,
            "expiry": self.expiry,
            "chain_id": self.chain_id,
        }

    def compute_hash(self) -> str:
        """SHA-256 over the signed transaction payload (not the signatures)."""
        return hash_data(json.dumps(self._hash_fields(), sort_keys=True).encode("utf-8"))

    def sign(self, wallet) -> None:
        """Sign a transfer transaction with the sender wallet."""
        self.timestamp = time.time()
        self.tx_hash = self.compute_hash()
        self.signature = wallet.sign(self.tx_hash.encode("utf-8"))

    def verify(self) -> bool:
        """Verify structure, address binding, and signatures."""
        if self.chain_id != CHAIN_ID:
            return False
        if self.tx_type == "faucet":
            return (
                self.sender == "FAUCET"
                and self.recipient != "FAUCET"
                and self.amount > 0
                and self.public_key == ""
                and self.signature == "FAUCET_SIG"
                and self.tx_hash == self.compute_hash()
            )

        if self.sender == "FAUCET" or self.amount <= 0:
            return False
        if self.tx_hash != self.compute_hash():
            return False
        if not self.public_key or generate_address(self.public_key) != self.sender:
            return False

        message = self.tx_hash.encode("utf-8")

        if self.tx_type == "transfer":
            if self.sig_algo == "ecdsa":
                return ECDSAWallet.verify(self.public_key, message, self.signature)
            if self.sig_algo == "mldsa":
                return MLDSAWallet.verify(self.public_key, message, self.signature)
            return False

        if self.tx_type == "migration":
            if self.sig_algo != "ecdsa":
                return False
            if not self.nonce or self.expiry <= 0:
                return False
            if self.recipient == self.sender:
                return False
            if not self.new_public_key:
                return False
            if generate_address(self.new_public_key) != self.recipient:
                return False
            if not ECDSAWallet.verify(self.public_key, message, self.signature):
                return False
            return MLDSAWallet.verify(self.new_public_key, message, self.new_signature)

        return False

    @classmethod
    def create(
        cls,
        sender: str,
        recipient: str,
        amount: float,
        public_key: str,
        sig_algo: str,
        wallet,
    ) -> "Transaction":
        """Create and sign a normal transfer."""
        tx = cls(
            sender=sender,
            recipient=recipient,
            amount=amount,
            public_key=public_key,
            sig_algo=sig_algo,
        )
        tx.sign(wallet)
        return tx

    @classmethod
    def create_migration(cls, payload, old_wallet, new_wallet) -> "Transaction":
        """Create a dual-signed migration transaction from a MigrationPayload."""
        tx = cls(
            sender=payload.old_address,
            recipient=payload.new_address,
            amount=payload.amount,
            public_key=old_wallet.public_key_hex,
            sig_algo="ecdsa",
            timestamp=payload.timestamp,
            tx_type="migration",
            new_public_key=new_wallet.public_key_hex,
            nonce=payload.nonce,
            expiry=payload.expiry,
            chain_id=payload.chain_id,
        )
        tx.tx_hash = tx.compute_hash()
        message = tx.tx_hash.encode("utf-8")
        tx.signature = old_wallet.sign(message)
        tx.new_signature = new_wallet.sign(message)
        return tx
