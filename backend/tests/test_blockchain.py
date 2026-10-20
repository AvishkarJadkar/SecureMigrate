import pytest
from app.crypto.ecdsa_wallet import ECDSAWallet
from app.crypto.mldsa_wallet import MLDSAWallet
from app.blockchain.chain import Blockchain
from app.blockchain.transaction import Transaction

@pytest.fixture
def blockchain():
    return Blockchain()

@pytest.fixture
def ecdsa_wallet():
    return ECDSAWallet()

@pytest.fixture
def mldsa_wallet():
    return MLDSAWallet()

def test_genesis_block(blockchain):
    assert len(blockchain.chain) == 1
    assert blockchain.chain[0].index == 0
    assert blockchain.chain[0].previous_hash == "0" * 64

def test_faucet_funding(blockchain, ecdsa_wallet):
    # Fund the wallet
    blockchain.fund_wallet(ecdsa_wallet.address, 100.0)
    assert len(blockchain.pending_transactions) == 1
    
    # Mine block
    block = blockchain.create_block()
    assert len(blockchain.chain) == 2
    assert block.index == 1
    
    # Verify balance
    assert blockchain.get_balance(ecdsa_wallet.address) == 100.0

def test_ecdsa_transaction(blockchain, ecdsa_wallet, mldsa_wallet):
    # Fund sender
    blockchain.fund_wallet(ecdsa_wallet.address, 100.0)
    blockchain.create_block()
    
    # Send transaction
    tx = Transaction.create(
        sender=ecdsa_wallet.address,
        recipient=mldsa_wallet.address,
        amount=25.0,
        public_key=ecdsa_wallet.public_key_hex,
        sig_algo="ecdsa",
        wallet=ecdsa_wallet
    )
    
    assert tx.verify() is True
    assert blockchain.add_transaction(tx) is True
    
    # Mine block
    blockchain.create_block()
    
    # Verify balances
    assert blockchain.get_balance(ecdsa_wallet.address) == 75.0
    assert blockchain.get_balance(mldsa_wallet.address) == 25.0

def test_mldsa_transaction(blockchain, mldsa_wallet, ecdsa_wallet):
    # Fund sender
    blockchain.fund_wallet(mldsa_wallet.address, 50.0)
    blockchain.create_block()
    
    # Send transaction
    tx = Transaction.create(
        sender=mldsa_wallet.address,
        recipient=ecdsa_wallet.address,
        amount=10.0,
        public_key=mldsa_wallet.public_key_hex,
        sig_algo="mldsa",
        wallet=mldsa_wallet
    )
    
    assert tx.verify() is True
    assert blockchain.add_transaction(tx) is True
    
    # Mine block
    blockchain.create_block()
    
    # Verify balances
    assert blockchain.get_balance(mldsa_wallet.address) == 40.0
    assert blockchain.get_balance(ecdsa_wallet.address) == 10.0

def test_invalid_transaction(blockchain, ecdsa_wallet):
    blockchain.fund_wallet(ecdsa_wallet.address, 100.0)
    blockchain.create_block()
    
    # Create valid tx
    tx = Transaction.create(
        sender=ecdsa_wallet.address,
        recipient="some_other_address",
        amount=25.0,
        public_key=ecdsa_wallet.public_key_hex,
        sig_algo="ecdsa",
        wallet=ecdsa_wallet
    )
    
    # Tamper with it
    tx.amount = 999.0
    
    # Verify should fail
    assert tx.verify() is False
    assert blockchain.add_transaction(tx) is False

def test_insufficient_funds(blockchain, ecdsa_wallet):
    # Sender has 0 balance
    tx = Transaction.create(
        sender=ecdsa_wallet.address,
        recipient="some_other_address",
        amount=25.0,
        public_key=ecdsa_wallet.public_key_hex,
        sig_algo="ecdsa",
        wallet=ecdsa_wallet
    )
    
    # Verify passes (signature is valid)
    assert tx.verify() is True
    
    # But adding to chain fails due to balance check
    assert blockchain.add_transaction(tx) is False

def test_chain_validation(blockchain, ecdsa_wallet):
    blockchain.fund_wallet(ecdsa_wallet.address, 100.0)
    blockchain.create_block()
    
    tx = Transaction.create(
        sender=ecdsa_wallet.address,
        recipient="some_address",
        amount=10.0,
        public_key=ecdsa_wallet.public_key_hex,
        sig_algo="ecdsa",
        wallet=ecdsa_wallet
    )
    blockchain.add_transaction(tx)
    blockchain.create_block()
    
    assert blockchain.validate_chain() is True
    
    # Tamper with chain history
    blockchain.chain[1].transactions[0]["amount"] = 999.0
    assert blockchain.validate_chain() is False


def test_sender_public_key_binding(blockchain, ecdsa_wallet):
    """A key must not be able to spend from an address it does not control."""
    blockchain.fund_wallet(ecdsa_wallet.address, 100.0)
    blockchain.create_block()

    attacker = ECDSAWallet()
    tx = Transaction.create(
        sender=ecdsa_wallet.address,
        recipient=attacker.address,
        amount=100.0,
        public_key=attacker.public_key_hex,
        sig_algo="ecdsa",
        wallet=attacker,
    )

    assert tx.verify() is False
    assert blockchain.add_transaction(tx) is False
    assert blockchain.get_balance(ecdsa_wallet.address) == 100.0


def test_negative_amount_rejected(blockchain, ecdsa_wallet, mldsa_wallet):
    blockchain.fund_wallet(ecdsa_wallet.address, 100.0)
    blockchain.create_block()

    tx = Transaction.create(
        sender=ecdsa_wallet.address,
        recipient=mldsa_wallet.address,
        amount=-50.0,
        public_key=ecdsa_wallet.public_key_hex,
        sig_algo="ecdsa",
        wallet=ecdsa_wallet,
    )

    assert tx.verify() is False
    assert blockchain.add_transaction(tx) is False
