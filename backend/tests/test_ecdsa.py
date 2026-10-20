import pytest
from app.crypto.ecdsa_wallet import ECDSAWallet
from app.crypto.utils import hash_data

def test_ecdsa_keygen():
    wallet = ECDSAWallet()
    assert wallet.private_key_hex is not None
    assert wallet.public_key_hex is not None
    assert wallet.public_key_hex.startswith("04")
    assert wallet.address.startswith("0x")
    
def test_ecdsa_sign_verify():
    wallet = ECDSAWallet()
    message = b"Test transaction payload"
    signature = wallet.sign(message)
    
    # Valid signature
    assert ECDSAWallet.verify(wallet.public_key_hex, message, signature) is True
    
    # Invalid message
    assert ECDSAWallet.verify(wallet.public_key_hex, b"Tampered message", signature) is False
    
    # Invalid signature
    fake_sig = "a" * len(signature)
    assert ECDSAWallet.verify(wallet.public_key_hex, message, fake_sig) is False
