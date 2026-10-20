import threading
import time
from dataclasses import asdict
from typing import List, Dict, Optional

from .block import Block
from .transaction import Transaction


class Blockchain:
    """Single-node chain with an in-memory ledger and optional persistence."""

    def __init__(self, persist_callback=None):
        self.chain: List[Block] = [Block.genesis()]
        self.pending_transactions: List[Transaction] = []
        self.balances: Dict[str, float] = {}
        self.migrated_addresses: set = set()
        self.used_nonces: set = set()
        self.persist_callback = persist_callback
        self._lock = threading.RLock()

    @property
    def last_block(self) -> Block:
        return self.chain[-1]

    def _tx_exists(self, tx_hash: str) -> bool:
        if any(tx.tx_hash == tx_hash for tx in self.pending_transactions):
            return True
        return any(
            tx.get("tx_hash") == tx_hash
            for block in self.chain
            for tx in block.transactions
        )

    def _pending_outgoing(self, address: str) -> float:
        return sum(
            tx.amount
            for tx in self.pending_transactions
            if tx.sender == address and tx.tx_type != "faucet"
        )

    def add_transaction(self, tx: Transaction, allow_faucet: bool = False) -> bool:
        """Validate and queue a transaction."""
        with self._lock:
            if tx.tx_type == "faucet" and not allow_faucet:
                return False
            if not tx.verify():
                return False
            if self._tx_exists(tx.tx_hash):
                return False
            if tx.sender in self.migrated_addresses:
                return False

            if tx.tx_type == "migration":
                if tx.nonce in self.used_nonces:
                    return False
                if any(t.sender == tx.sender for t in self.pending_transactions):
                    return False
                if self.get_balance(tx.sender) != tx.amount:
                    return False
                if time.time() > tx.expiry:
                    return False
            else:
                available = self.get_balance(tx.sender) - self._pending_outgoing(tx.sender)
                if available < tx.amount:
                    return False

            self.pending_transactions.append(tx)
            return True

    def _apply(self, tx: Transaction, balances: Dict[str, float], migrated: set,
               nonces: set, enforce_expiry: bool = True) -> bool:
        """Apply one transaction to a ledger. Returns False if invalid."""
        if not tx.verify():
            return False

        if tx.tx_type == "faucet":
            if tx.sender != "FAUCET" or tx.amount <= 0:
                return False
            balances[tx.recipient] = round(balances.get(tx.recipient, 0.0) + tx.amount, 8)
            return True

        if tx.amount <= 0 or tx.sender in migrated:
            return False

        sender_balance = balances.get(tx.sender, 0.0)

        if tx.tx_type == "migration":
            if tx.nonce in nonces or tx.recipient == tx.sender:
                return False
            if sender_balance != tx.amount:
                return False
            if enforce_expiry and time.time() > tx.expiry:
                return False
            balances[tx.sender] = 0.0
            balances[tx.recipient] = round(balances.get(tx.recipient, 0.0) + tx.amount, 8)
            migrated.add(tx.sender)
            nonces.add(tx.nonce)
            return True

        if sender_balance + 1e-9 < tx.amount:
            return False
        balances[tx.sender] = round(sender_balance - tx.amount, 8)
        balances[tx.recipient] = round(balances.get(tx.recipient, 0.0) + tx.amount, 8)
        return True

    def create_block(self) -> Block:
        """Mine all pending transactions as one block."""
        with self._lock:
            if not self.pending_transactions:
                raise ValueError("No pending transactions to mine")

            balances = dict(self.balances)
            migrated = set(self.migrated_addresses)
            nonces = set(self.used_nonces)
            for tx in self.pending_transactions:
                if not self._apply(tx, balances, migrated, nonces, enforce_expiry=True):
                    raise ValueError(f"Invalid pending transaction: {tx.tx_hash}")

            pending = self.pending_transactions[:]
            new_block = Block(
                index=len(self.chain),
                timestamp=time.time(),
                transactions=[asdict(tx) for tx in pending],
                previous_hash=self.last_block.hash,
                nonce=0,
            )
            new_block.hash = new_block.compute_hash()

            for tx in pending:
                self._apply(
                    tx, self.balances, self.migrated_addresses,
                    self.used_nonces, enforce_expiry=True,
                )

            self.chain.append(new_block)
            self.pending_transactions = []

            if self.persist_callback:
                try:
                    self.persist_callback(self)
                except Exception:
                    self.chain.pop()
                    self.pending_transactions = pending
                    self._rebuild_state()
                    raise

            return new_block

    def submit_and_mine(self, tx: Transaction) -> Block:
        """Atomically queue and mine one transaction."""
        with self._lock:
            if not self.add_transaction(tx):
                raise ValueError("Transaction rejected by blockchain")
            try:
                return self.create_block()
            except Exception:
                self.pending_transactions = [
                    pending for pending in self.pending_transactions
                    if pending.tx_hash != tx.tx_hash
                ]
                raise

    def validate_chain(self) -> bool:
        """Validate hashes, links, signatures, and the replayed ledger."""
        with self._lock:
            if not self.chain:
                return False
            genesis = self.chain[0]
            if genesis.index != 0 or genesis.previous_hash != "0" * 64:
                return False
            if genesis.transactions or genesis.hash != genesis.compute_hash():
                return False

            balances: Dict[str, float] = {}
            migrated: set = set()
            nonces: set = set()

            for i, block in enumerate(self.chain):
                if block.index != i:
                    return False
                if block.hash != block.compute_hash():
                    return False
                if i > 0 and block.previous_hash != self.chain[i - 1].hash:
                    return False
                for tx_dict in block.transactions:
                    try:
                        tx = Transaction(**tx_dict)
                    except TypeError:
                        return False
                    if not self._apply(
                        tx, balances, migrated, nonces, enforce_expiry=False
                    ):
                        return False

            return (
                balances == self.balances
                and migrated == self.migrated_addresses
                and nonces == self.used_nonces
            )

    def _rebuild_state(self) -> None:
        """Replay the chain to rebuild balances, migrated addresses, and nonces."""
        balances: Dict[str, float] = {}
        migrated: set = set()
        nonces: set = set()
        for block in self.chain:
            for tx_dict in block.transactions:
                tx = Transaction(**tx_dict)
                if not self._apply(
                    tx, balances, migrated, nonces, enforce_expiry=False
                ):
                    raise ValueError("Persisted chain contains an invalid transaction")
        self.balances = balances
        self.migrated_addresses = migrated
        self.used_nonces = nonces

    def rollback_last_block(self) -> Optional[Block]:
        """Remove the most recent block and rebuild state from the chain."""
        with self._lock:
            if len(self.chain) <= 1:
                return None
            removed = self.chain.pop()
            self._rebuild_state()
            if self.persist_callback:
                self.persist_callback(self)
            return removed

    def get_balance(self, address: str) -> float:
        with self._lock:
            return self.balances.get(address, 0.0)

    def fund_wallet(self, address: str, amount: float) -> Transaction:
        """Test faucet: mint funds without a user signature."""
        with self._lock:
            if address in self.migrated_addresses:
                raise ValueError("Cannot fund a migrated wallet")
            if amount <= 0:
                raise ValueError("Faucet amount must be positive")
            tx = Transaction(
                sender="FAUCET",
                recipient=address,
                amount=amount,
                public_key="",
                sig_algo="ecdsa",
                signature="FAUCET_SIG",
                timestamp=time.time(),
                tx_type="faucet",
            )
            tx.tx_hash = tx.compute_hash()
            self.pending_transactions.append(tx)
            return tx

    def fund_and_mine(self, address: str, amount: float) -> Block:
        with self._lock:
            self.fund_wallet(address, amount)
            return self.create_block()

    def get_history(self, address: str) -> List[Dict]:
        with self._lock:
            history = []
            for block in self.chain:
                for tx in block.transactions:
                    if tx["sender"] == address or tx["recipient"] == address:
                        tx_info = dict(tx)
                        tx_info["block_index"] = block.index
                        history.append(tx_info)
            return history

    def to_dict(self) -> dict:
        with self._lock:
            return {"chain": [asdict(block) for block in self.chain]}

    @classmethod
    def from_dict(cls, data: dict, persist_callback=None) -> "Blockchain":
        bc = cls(persist_callback=persist_callback)
        chain = [Block(**block) for block in data.get("chain", [])]
        if not chain:
            return bc
        bc.chain = chain
        bc._rebuild_state()
        if not bc.validate_chain():
            raise ValueError("Persisted chain failed validation")
        return bc
