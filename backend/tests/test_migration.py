"""
Tests for Phase 3 — Migration Engine.

Covers:
  1. Payload creation
  2. Dual signing
  3. Dual signature verification
  4. Happy-path end-to-end migration
  5. Replay-attack prevention (nonce reuse)
  6. Expiry window enforcement
  7. Double-migration prevention (already-migrated wallet)
  8. Zero-balance migration attempt
  9. Old wallet spend-disabled after migration
  10. New wallet is functional after migration
"""

import time
import pytest
from app.crypto.ecdsa_wallet import ECDSAWallet
from app.crypto.mldsa_wallet import MLDSAWallet
from app.blockchain.chain import Blockchain
from app.blockchain.transaction import Transaction
from app.migration.engine import MigrationEngine


@pytest.fixture
def ecdsa_wallet():
    return ECDSAWallet()

@pytest.fixture
def mldsa_wallet():
    return MLDSAWallet()

@pytest.fixture
def blockchain():
    return Blockchain()

@pytest.fixture
def engine():
    return MigrationEngine()

@pytest.fixture
def funded_chain(blockchain, ecdsa_wallet):
    """A blockchain where the ECDSA wallet already has 100 coins."""
    blockchain.fund_wallet(ecdsa_wallet.address, 100.0)
    blockchain.create_block()
    return blockchain


# ------------------------------------------------------------------ #
#  Basic construction
# ------------------------------------------------------------------ #

def test_payload_creation(engine, ecdsa_wallet, mldsa_wallet):
    payload = engine.create_migration_payload(
        old_address=ecdsa_wallet.address,
        new_address=mldsa_wallet.address,
        new_pubkey=mldsa_wallet.public_key_hex,
        amount=100.0,
    )
    assert payload.old_address == ecdsa_wallet.address
    assert payload.new_address == mldsa_wallet.address
    assert payload.amount == 100.0
    assert payload.nonce  # non-empty
    assert payload.expiry > payload.timestamp


def test_dual_signing(engine, ecdsa_wallet, mldsa_wallet):
    payload = engine.create_migration_payload(
        old_address=ecdsa_wallet.address,
        new_address=mldsa_wallet.address,
        new_pubkey=mldsa_wallet.public_key_hex,
        amount=100.0,
    )
    mtx = engine.sign_migration(payload, ecdsa_wallet, mldsa_wallet)

    assert mtx.ecdsa_signature
    assert mtx.mldsa_signature
    assert mtx.migration_tx_hash


def test_dual_verification(engine, ecdsa_wallet, mldsa_wallet):
    payload = engine.create_migration_payload(
        old_address=ecdsa_wallet.address,
        new_address=mldsa_wallet.address,
        new_pubkey=mldsa_wallet.public_key_hex,
        amount=100.0,
    )
    mtx = engine.sign_migration(payload, ecdsa_wallet, mldsa_wallet)

    valid, err = engine.verify_migration(mtx)
    assert valid is True
    assert err == ""


# ------------------------------------------------------------------ #
#  Happy-path end-to-end migration
# ------------------------------------------------------------------ #

def test_successful_migration(engine, funded_chain, ecdsa_wallet, mldsa_wallet):
    bc = funded_chain
    assert bc.get_balance(ecdsa_wallet.address) == 100.0

    payload = engine.create_migration_payload(
        old_address=ecdsa_wallet.address,
        new_address=mldsa_wallet.address,
        new_pubkey=mldsa_wallet.public_key_hex,
        amount=100.0,
    )
    mtx = engine.sign_migration(payload, ecdsa_wallet, mldsa_wallet)

    ok, msg = engine.execute_migration(bc, mtx)
    assert ok is True, msg

    # Old wallet drained
    assert bc.get_balance(ecdsa_wallet.address) == 0.0
    # New wallet funded
    assert bc.get_balance(mldsa_wallet.address) == 100.0
    # Old wallet disabled in the chain ledger
    assert ecdsa_wallet.address in bc.migrated_addresses
    # Migration is a real on-chain transaction
    assert bc.chain[-1].transactions[-1]["tx_type"] == "migration"
    assert bc.validate_chain() is True
    # Migration recorded
    assert len(engine.migration_records) == 1
    assert engine.migration_records[0]["status"] == "executed"


# ------------------------------------------------------------------ #
#  Replay-attack prevention
# ------------------------------------------------------------------ #

def test_replay_attack_blocked(engine, funded_chain, ecdsa_wallet, mldsa_wallet):
    bc = funded_chain
    payload = engine.create_migration_payload(
        old_address=ecdsa_wallet.address,
        new_address=mldsa_wallet.address,
        new_pubkey=mldsa_wallet.public_key_hex,
        amount=100.0,
    )
    mtx = engine.sign_migration(payload, ecdsa_wallet, mldsa_wallet)

    ok, _ = engine.execute_migration(bc, mtx)
    assert ok is True

    # Try the exact same migration transaction again
    ok2, msg2 = engine.execute_migration(bc, mtx)
    assert ok2 is False
    assert "Nonce already used" in msg2


# ------------------------------------------------------------------ #
#  Expiry enforcement
# ------------------------------------------------------------------ #

def test_expired_migration_rejected(engine, funded_chain, ecdsa_wallet, mldsa_wallet):
    bc = funded_chain
    payload = engine.create_migration_payload(
        old_address=ecdsa_wallet.address,
        new_address=mldsa_wallet.address,
        new_pubkey=mldsa_wallet.public_key_hex,
        amount=100.0,
    )
    # Force the payload to already be expired
    payload.expiry = time.time() - 1

    mtx = engine.sign_migration(payload, ecdsa_wallet, mldsa_wallet)

    ok, msg = engine.execute_migration(bc, mtx)
    assert ok is False
    assert "expired" in msg.lower()


# ------------------------------------------------------------------ #
#  Double-migration prevention
# ------------------------------------------------------------------ #

def test_double_migration_blocked(engine, funded_chain, ecdsa_wallet, mldsa_wallet):
    bc = funded_chain

    # First migration succeeds
    payload1 = engine.create_migration_payload(
        old_address=ecdsa_wallet.address,
        new_address=mldsa_wallet.address,
        new_pubkey=mldsa_wallet.public_key_hex,
        amount=100.0,
    )
    mtx1 = engine.sign_migration(payload1, ecdsa_wallet, mldsa_wallet)
    ok1, _ = engine.execute_migration(bc, mtx1)
    assert ok1 is True

    # Second migration with a *different* nonce but same old address
    new_mldsa = MLDSAWallet()
    payload2 = engine.create_migration_payload(
        old_address=ecdsa_wallet.address,
        new_address=new_mldsa.address,
        new_pubkey=new_mldsa.public_key_hex,
        amount=1.0,
    )
    mtx2 = engine.sign_migration(payload2, ecdsa_wallet, new_mldsa)
    ok2, msg2 = engine.execute_migration(bc, mtx2)
    assert ok2 is False
    assert "already been migrated" in msg2


# ------------------------------------------------------------------ #
#  Zero-balance migration attempt
# ------------------------------------------------------------------ #

def test_zero_balance_rejected(engine, blockchain, mldsa_wallet):
    bc = blockchain
    empty_ecdsa = ECDSAWallet()  # never funded

    payload = engine.create_migration_payload(
        old_address=empty_ecdsa.address,
        new_address=mldsa_wallet.address,
        new_pubkey=mldsa_wallet.public_key_hex,
        amount=1.0,
    )
    mtx = engine.sign_migration(payload, empty_ecdsa, mldsa_wallet)

    ok, msg = engine.execute_migration(bc, mtx)
    assert ok is False
    assert "no balance" in msg.lower()


# ------------------------------------------------------------------ #
#  Post-migration: old wallet is spend-disabled
# ------------------------------------------------------------------ #

def test_old_wallet_disabled_after_migration(engine, funded_chain, ecdsa_wallet, mldsa_wallet):
    bc = funded_chain

    payload = engine.create_migration_payload(
        old_address=ecdsa_wallet.address,
        new_address=mldsa_wallet.address,
        new_pubkey=mldsa_wallet.public_key_hex,
        amount=100.0,
    )
    mtx = engine.sign_migration(payload, ecdsa_wallet, mldsa_wallet)
    engine.execute_migration(bc, mtx)

    assert ecdsa_wallet.address in bc.migrated_addresses
    assert bc.get_balance(ecdsa_wallet.address) == 0.0


# ------------------------------------------------------------------ #
#  Post-migration: new ML-DSA wallet can transact
# ------------------------------------------------------------------ #

def test_new_wallet_functional_after_migration(engine, funded_chain, ecdsa_wallet, mldsa_wallet):
    bc = funded_chain

    payload = engine.create_migration_payload(
        old_address=ecdsa_wallet.address,
        new_address=mldsa_wallet.address,
        new_pubkey=mldsa_wallet.public_key_hex,
        amount=100.0,
    )
    mtx = engine.sign_migration(payload, ecdsa_wallet, mldsa_wallet)
    engine.execute_migration(bc, mtx)

    # Now send funds FROM the new ML-DSA wallet
    recipient = ECDSAWallet()
    tx = Transaction.create(
        sender=mldsa_wallet.address,
        recipient=recipient.address,
        amount=30.0,
        public_key=mldsa_wallet.public_key_hex,
        sig_algo="mldsa",
        wallet=mldsa_wallet,
    )

    assert bc.add_transaction(tx) is True
    bc.create_block()

    assert bc.get_balance(mldsa_wallet.address) == 70.0
    assert bc.get_balance(recipient.address) == 30.0


# ------------------------------------------------------------------ #
#  Security regression: another key must not authorize a migration
# ------------------------------------------------------------------ #

def test_wrong_key_cannot_migrate(engine, funded_chain, ecdsa_wallet):
    bc = funded_chain
    attacker = ECDSAWallet()
    attacker_new = MLDSAWallet()

    payload = engine.create_migration_payload(
        old_address=ecdsa_wallet.address,
        new_address=attacker_new.address,
        new_pubkey=attacker_new.public_key_hex,
        amount=100.0,
    )
    mtx = engine.sign_migration(payload, attacker, attacker_new)

    valid, err = engine.verify_migration(mtx)
    assert valid is False
    assert "does not match" in err

    ok, msg = engine.execute_migration(bc, mtx)
    assert ok is False
    assert bc.get_balance(ecdsa_wallet.address) == 100.0
    assert bc.get_balance(attacker_new.address) == 0.0
