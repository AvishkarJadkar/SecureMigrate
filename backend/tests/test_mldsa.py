import pytest
from app.crypto.mldsa_wallet import MLDSAWallet

def test_mldsa_keygen():
    wallet = MLDSAWallet()
    assert MLDSAWallet.is_mock is False
    assert len(bytes.fromhex(wallet.private_key_hex)) == 4032
    assert len(bytes.fromhex(wallet.public_key_hex)) == 1952
    assert wallet.address.startswith("0x")
    
def test_mldsa_sign_verify():
    wallet = MLDSAWallet()
    message = b"Test transaction payload for ML-DSA"
    signature = wallet.sign(message)
    
    # Valid signature
    assert MLDSAWallet.verify(wallet.public_key_hex, message, signature) is True
    
    # Invalid message
    assert MLDSAWallet.verify(wallet.public_key_hex, b"Tampered message", signature) is False
    
    # Invalid signature
    fake_sig = "a" * len(signature)
    assert MLDSAWallet.verify(wallet.public_key_hex, message, fake_sig) is False
