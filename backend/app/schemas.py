from pydantic import BaseModel, ConfigDict, Field
from typing import Literal, Optional, List, Dict, Any


# ── Wallet ──────────────────────────────────────────────────────────

class RegisterWalletRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    wallet_type: Literal["ecdsa", "mldsa"]
    public_key: str = Field(min_length=2)

class WalletInfo(BaseModel):
    address: str
    public_key: str
    wallet_type: str
    balance: float = 0.0
    is_migrated: bool = False
    migrated_to: Optional[str] = None


# ── Transaction ─────────────────────────────────────────────────────

class TransferPrepareRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sender_address: str
    recipient_address: str
    amount: float = Field(gt=0)

class TransferPrepareResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sender: str
    recipient: str
    amount: float
    public_key: str
    sig_algo: Literal["ecdsa", "mldsa"]
    timestamp: float
    tx_hash: str
    tx_type: Literal["transfer"] = "transfer"
    chain_id: str

class SubmitTransferRequest(TransferPrepareResponse):
    signature: str

class TransactionResponse(BaseModel):
    tx_hash: str
    sender: str
    recipient: str
    amount: float
    sig_algo: str
    tx_type: str = "transfer"
    block_index: Optional[int] = None
    timestamp: float


# ── Migration ───────────────────────────────────────────────────────

class MigrationPrepareRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    old_address: str
    new_address: str

class MigrationPrepareResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sender: str
    recipient: str
    amount: float
    public_key: str
    new_public_key: str
    nonce: str
    timestamp: float
    expiry: float
    chain_id: str
    tx_hash: str
    tx_type: Literal["migration"] = "migration"

class SubmitMigrationRequest(MigrationPrepareResponse):
    signature: str
    new_signature: str

class MigrateWalletResponse(BaseModel):
    old_address: str
    new_address: str
    new_public_key: str
    migration_tx_hash: str
    amount_migrated: float
    block_index: Optional[int] = None
    status: str

class MigrationInfo(BaseModel):
    id: int
    old_address: str
    new_address: str
    old_wallet_type: str
    new_wallet_type: str
    migration_tx_hash: str
    amount: float
    timestamp: float
    status: str
    block_index: Optional[int] = None


# ── Blockchain ──────────────────────────────────────────────────────

class ChainStatus(BaseModel):
    chain_length: int
    latest_block_hash: str
    latest_block_index: int
    total_transactions: int
    pending_transactions: int
    is_valid: bool

class FaucetRequest(BaseModel):
    address: str
    amount: float = Field(gt=0)

class MineResponse(BaseModel):
    block_index: int
    block_hash: str
    tx_count: int

class BlockInfo(BaseModel):
    index: int
    timestamp: float
    previous_hash: str
    hash: str
    tx_count: int
    transactions: List[Dict[str, Any]]


# ── Benchmark ───────────────────────────────────────────────────────

class BenchmarkRequest(BaseModel):
    iterations: int = Field(default=50, ge=1, le=500)

class AlgorithmBenchmark(BaseModel):
    algorithm: str
    key_size_bytes: int
    private_key_size_bytes: int = 0
    signature_size_bytes: int
    keygen_avg_ms: float
    sign_avg_ms: float
    verify_avg_ms: float
    keygen_median_ms: float = 0.0
    sign_median_ms: float = 0.0
    verify_median_ms: float = 0.0
    keygen_std_ms: float = 0.0
    sign_std_ms: float = 0.0
    verify_std_ms: float = 0.0
    correctness_ok: bool = True
    keygen_times: List[float]
    sign_times: List[float]
    verify_times: List[float]

class BenchmarkResponse(BaseModel):
    iterations: int
    ecdsa: AlgorithmBenchmark
    mldsa: AlgorithmBenchmark
    comparison: Dict[str, Any]
