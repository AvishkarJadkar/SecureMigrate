import binascii
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric.utils import Prehashed
from cryptography.exceptions import InvalidSignature
from .utils import generate_address

class ECDSAWallet:
    def __init__(self, private_key_hex: str = None):
        """
        Initialize an ECDSA wallet on the SECP256K1 curve.
        If private_key_hex is provided, loads the existing wallet.
        Otherwise, generates a new keypair.
        """
        if private_key_hex:
            private_value = int(private_key_hex, 16)
            self._private_key = ec.derive_private_key(private_value, ec.SECP256K1())
        else:
            self._private_key = ec.generate_private_key(ec.SECP256K1())
            
        self._public_key = self._private_key.public_key()
        
    @property
    def private_key_hex(self) -> str:
        """Returns the private key as a hex string."""
        private_value = self._private_key.private_numbers().private_value
        return hex(private_value)[2:].zfill(64)
        
    @property
    def public_key_hex(self) -> str:
        """Returns the uncompressed public key as a hex string."""
        public_numbers = self._public_key.public_numbers()
        x_hex = hex(public_numbers.x)[2:].zfill(64)
        y_hex = hex(public_numbers.y)[2:].zfill(64)
        return "04" + x_hex + y_hex
        
    @property
    def address(self) -> str:
        """Returns the deterministic address for this wallet."""
        return generate_address(self.public_key_hex)
        
    def sign(self, message: bytes) -> str:
        """
        Signs a message using ECDSA and SHA256.
        Returns the signature as a hex string.
        """
        signature = self._private_key.sign(
            message,
            ec.ECDSA(hashes.SHA256())
        )
        return binascii.hexlify(signature).decode('utf-8')
        
    @staticmethod
    def validate_public_key(public_key_hex: str) -> bool:
        try:
            pub_key_bytes = binascii.unhexlify(public_key_hex)
            if len(pub_key_bytes) != 65 or pub_key_bytes[0] != 4:
                return False
            ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256K1(), pub_key_bytes)
            return True
        except (ValueError, TypeError):
            return False

    @staticmethod
    def verify(public_key_hex: str, message: bytes, signature_hex: str) -> bool:
        """
        Verifies a signature given the public key hex, message, and signature hex.
        Returns True if valid, False otherwise.
        """
        try:
            pub_key_bytes = binascii.unhexlify(public_key_hex)
            signature_bytes = binascii.unhexlify(signature_hex)
            if len(pub_key_bytes) != 65 or pub_key_bytes[0] != 4:
                return False

            x = int.from_bytes(pub_key_bytes[1:33], byteorder="big")
            y = int.from_bytes(pub_key_bytes[33:], byteorder="big")
            public_key = ec.EllipticCurvePublicNumbers(
                x, y, ec.SECP256K1()
            ).public_key()

            public_key.verify(signature_bytes, message, ec.ECDSA(hashes.SHA256()))
            return True
        except (InvalidSignature, ValueError, TypeError):
            return False
