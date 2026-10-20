import hashlib
import binascii

def hash_data(data: bytes) -> str:
    """Returns SHA-256 hex digest of the given bytes."""
    return hashlib.sha256(data).hexdigest()

def generate_address(public_key_hex: str) -> str:
    """
    Generates a deterministic address from a public key hex string.
    Takes the SHA-256 hash of the public key and returns the first 40 characters (20 bytes).
    Prepends '0x' to make it look like a standard blockchain address.
    """
    pub_key_bytes = binascii.unhexlify(public_key_hex)
    full_hash = hash_data(pub_key_bytes)
    return "0x" + full_hash[:40]
