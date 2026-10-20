"""Benchmark ECDSA vs real ML-DSA-65 on the same hardware."""

import statistics
import time
from typing import Callable

from app.crypto.ecdsa_wallet import ECDSAWallet
from app.crypto.mldsa_wallet import MLDSAWallet


def _stats(times: list[float]) -> dict:
    return {
        "avg": round(statistics.mean(times), 4),
        "median": round(statistics.median(times), 4),
        "std": round(statistics.pstdev(times), 4),
        "times": [round(t, 4) for t in times],
    }


def _benchmark(
    name: str,
    keygen: Callable,
    sign: Callable,
    verify: Callable,
    key_size: Callable,
    private_key_size: Callable,
    signature_size: Callable,
    iterations: int,
) -> dict:
    message = b"Benchmark test message for SecureMigrate performance comparison"

    # Warm-up: exclude first-call/import/cache effects from measurements.
    for _ in range(3):
        warm = keygen()
        sig = sign(warm, message)
        assert verify(warm, message, sig) is True

    keygen_times = []
    for _ in range(iterations):
        start = time.perf_counter()
        keygen()
        keygen_times.append((time.perf_counter() - start) * 1000)

    wallet = keygen()

    sign_times = []
    signatures = []
    for _ in range(iterations):
        start = time.perf_counter()
        signatures.append(sign(wallet, message))
        sign_times.append((time.perf_counter() - start) * 1000)

    verify_times = []
    correctness_ok = True
    for signature in signatures:
        start = time.perf_counter()
        ok = verify(wallet, message, signature)
        verify_times.append((time.perf_counter() - start) * 1000)
        correctness_ok = correctness_ok and ok
    if not correctness_ok:
        raise RuntimeError(f"{name} produced a signature that failed verification")

    kg, sg, vf = _stats(keygen_times), _stats(sign_times), _stats(verify_times)
    return {
        "algorithm": name,
        "key_size_bytes": key_size(wallet),
        "private_key_size_bytes": private_key_size(wallet),
        "signature_size_bytes": signature_size(signatures[0]),
        "keygen_avg_ms": kg["avg"],
        "sign_avg_ms": sg["avg"],
        "verify_avg_ms": vf["avg"],
        "keygen_median_ms": kg["median"],
        "sign_median_ms": sg["median"],
        "verify_median_ms": vf["median"],
        "keygen_std_ms": kg["std"],
        "sign_std_ms": sg["std"],
        "verify_std_ms": vf["std"],
        "correctness_ok": correctness_ok,
        "keygen_times": kg["times"],
        "sign_times": sg["times"],
        "verify_times": vf["times"],
    }


def run_benchmark(iterations: int = 50) -> dict:
    if iterations < 1:
        raise ValueError("iterations must be at least 1")
    if MLDSAWallet.is_mock:
        raise RuntimeError("ML-DSA benchmark requires the real liboqs backend, not a mock")

    ecdsa = _benchmark(
        "ECDSA (SECP256K1)",
        keygen=ECDSAWallet,
        sign=lambda w, m: w.sign(m),
        verify=lambda w, m, s: ECDSAWallet.verify(w.public_key_hex, m, s),
        key_size=lambda w: len(bytes.fromhex(w.public_key_hex)),
        private_key_size=lambda w: len(bytes.fromhex(w.private_key_hex)),
        signature_size=lambda s: len(bytes.fromhex(s)),
        iterations=iterations,
    )

    mldsa = _benchmark(
        "ML-DSA-65 (FIPS 204)",
        keygen=MLDSAWallet,
        sign=lambda w, m: w.sign(m),
        verify=lambda w, m, s: MLDSAWallet.verify(w.public_key_hex, m, s),
        key_size=lambda w: len(bytes.fromhex(w.public_key_hex)),
        private_key_size=lambda w: len(bytes.fromhex(w.private_key_hex)),
        signature_size=lambda s: len(bytes.fromhex(s)),
        iterations=iterations,
    )

    def ratio(a: float, b: float) -> float:
        return round(a / max(b, 0.0001), 2)

    keygen_ratio = ratio(mldsa["keygen_avg_ms"], ecdsa["keygen_avg_ms"])
    sign_ratio = ratio(mldsa["sign_avg_ms"], ecdsa["sign_avg_ms"])
    verify_ratio = ratio(mldsa["verify_avg_ms"], ecdsa["verify_avg_ms"])
    key_ratio = ratio(mldsa["key_size_bytes"], ecdsa["key_size_bytes"])
    sig_ratio = ratio(mldsa["signature_size_bytes"], ecdsa["signature_size_bytes"])

    def word(r: float) -> str:
        return "slower" if r >= 1 else "faster"

    comparison = {
        "pqc_backend": "liboqs",
        "correctness_ok": ecdsa["correctness_ok"] and mldsa["correctness_ok"],
        "keygen_speedup": keygen_ratio,
        "sign_speedup": sign_ratio,
        "verify_speedup": verify_ratio,
        "key_size_ratio": key_ratio,
        "sig_size_ratio": sig_ratio,
        "summary": (
            f"ML-DSA public keys are {key_ratio:.2f}x larger and signatures are "
            f"{sig_ratio:.2f}x larger. ML-DSA keygen is {keygen_ratio:.2f}x "
            f"{word(keygen_ratio)}, signing is {sign_ratio:.2f}x {word(sign_ratio)}, "
            f"and verification is {verify_ratio:.2f}x {word(verify_ratio)}."
        ),
    }

    return {
        "iterations": iterations,
        "ecdsa": ecdsa,
        "mldsa": mldsa,
        "comparison": comparison,
    }
