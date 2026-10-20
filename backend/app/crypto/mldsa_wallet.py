import binascii
import os
from pathlib import Path

from .utils import generate_address

# Prefer the project-local liboqs build, if present.
_LOCAL_OQS = Path(__file__).resolve().parents[2] / "liboqs"
if _LOCAL_OQS.exists() and "OQS_INSTALL_PATH" not in os.environ:
    os.environ["OQS_INSTALL_PATH"] = str(_LOCAL_OQS)

try:
    import oqs
except Exception as exc:  # pragma: no cover - environment failure
    raise RuntimeError(
        "liboqs native library is required. Build liboqs and set "
        "OQS_INSTALL_PATH, or install it via liboqs-python. "
        f"Original error: {exc}"
    ) from exc

ML_DSA_ALG = "ML-DSA-65"
PUBLIC_KEY_BYTES = 1952
PRIVATE_KEY_BYTES = 4032
SIGNATURE_BYTES = 3309


class MLDSAWallet:
    """ML-DSA-65 wallet backed by the real liboqs implementation."""

    sig_alg = ML_DSA_ALG
    is_mock = False

    def __init__(self, private_key_hex: str = None, public_key_hex: str = None):
        if private_key_hex:
            self._private_key = binascii.unhexlify(private_key_hex)
            if len(self._private_key) != PRIVATE_KEY_BYTES:
                raise ValueError(
                    f"Invalid ML-DSA-65 private key length: {len(self._private_key)} bytes "
                    f"(expected {PRIVATE_KEY_BYTES}). Legacy mock keys must be regenerated."
                )
            if not public_key_hex:
                raise ValueError("public_key_hex is required when loading an ML-DSA wallet")
            self._public_key = binascii.unhexlify(public_key_hex)
            if len(self._public_key) != PUBLIC_KEY_BYTES:
                raise ValueError(
                    f"Invalid ML-DSA-65 public key length: {len(self._public_key)} bytes "
                    f"(expected {PUBLIC_KEY_BYTES})"
                )
        else:
            with oqs.Signature(self.sig_alg) as signer:
                self._public_key = signer.generate_keypair()
                self._private_key = signer.export_secret_key()

    @property
    def private_key_hex(self) -> str:
        return binascii.hexlify(self._private_key).decode("utf-8")

    @property
    def public_key_hex(self) -> str:
        return binascii.hexlify(self._public_key).decode("utf-8")

    @property
    def address(self) -> str:
        return generate_address(self.public_key_hex)

    def sign(self, message: bytes) -> str:
        with oqs.Signature(self.sig_alg, secret_key=self._private_key) as signer:
            signature = signer.sign(message)
        return binascii.hexlify(signature).decode("utf-8")

    @staticmethod
    def validate_public_key(public_key_hex: str) -> bool:
        try:
            public_key = binascii.unhexlify(public_key_hex)
            return len(public_key) == PUBLIC_KEY_BYTES
        except (ValueError, TypeError):
            return False

    @staticmethod
    def verify(public_key_hex: str, message: bytes, signature_hex: str) -> bool:
        try:
            public_key = binascii.unhexlify(public_key_hex)
            signature = binascii.unhexlify(signature_hex)
            if len(public_key) != PUBLIC_KEY_BYTES or len(signature) != SIGNATURE_BYTES:
                return False
            with oqs.Signature(ML_DSA_ALG) as verifier:
                return verifier.verify(message, signature, public_key)
        except Exception:
            return False
