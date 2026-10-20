# SecureMigrate

ECDSA → ML-DSA-65 wallet migration on a single-node blockchain, with
**client-side key custody**. Private keys are generated and used in the browser;
the API only receives public keys and signed transactions.

## What is real

- ECDSA (secp256k1) keygen/sign/verify via `cryptography` and `@noble/curves`.
- ML-DSA-65 (FIPS 204) keygen/sign/verify via **liboqs** and
  `@noble/post-quantum`. Mock mode has been removed.
- Client-generated public keys are registered with the server.
- Dual-signed migration transactions are verified, mined, and persisted.
- Address ownership, nonces, expiry, chain ID, and replay protection are checked.
- Chain state, balances, migrated addresses, and migration records persist in SQLite.
- The landing page lives at `/`; the workspace lives under `/app`.

## Security model

1. The browser generates an ECDSA or ML-DSA-65 keypair.
2. Private keys are encrypted locally with **AES-256-GCM** using a
   **PBKDF2-SHA256** key (210,000 iterations). The encrypted vault is stored in
   this browser's `localStorage`; the vault password only exists in memory while
   the vault is unlocked.
3. The API stores the public key, derives the address, and never receives a
   private key.
4. For a transfer or migration, the API builds the canonical unsigned
   transaction and returns its `tx_hash`.
5. The client reviews the fields and signs the **ASCII hex `tx_hash`** locally.
6. The client submits the signed fields. The server reconstructs the transaction,
   recomputes the hash, verifies every signature, and mines it.

Signing formats:

- ECDSA: DER-encoded secp256k1 signature, SHA-256 prehash (noble default).
- ML-DSA-65: raw FIPS 204 signature over the message bytes.

Request models use `extra="forbid"`, so legacy `private_key` fields are rejected
with HTTP 422 rather than silently accepted. On startup, the backend also clears
any encrypted private-key values left by the old server-custody build.

## API

Base URL: `http://127.0.0.1:8000/api`

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/wallets` | Register `{wallet_type, public_key}` |
| `GET` | `/wallets` | List public wallets and balances |
| `POST` | `/chain/faucet` | Mint test coins to a registered address |
| `POST` | `/transactions/prepare` | Build unsigned transfer + `tx_hash` |
| `POST` | `/transactions` | Submit transfer fields + `signature` |
| `POST` | `/migrate/prepare` | Build unsigned ECDSA → ML-DSA migration |
| `POST` | `/migrate` | Submit migration fields + both signatures |
| `GET` | `/migrate/migrations` | List migration records |
| `GET` | `/transactions` | List mined transactions |
| `POST` | `/benchmark/run` | Run ECDSA vs ML-DSA benchmark |

Interactive docs: <http://127.0.0.1:8000/docs>

## Setup

### 1. Python

```powershell
python -m venv venv
.\venv\Scripts\pip install -r backend\requirements.txt
```

### 2. Build liboqs (required)

With CMake and the MSVC Build Tools installed:

```powershell
.\scripts\build_liboqs.ps1
```

This produces `backend/liboqs/bin/oqs.dll`. `mldsa_wallet.py` points
`OQS_INSTALL_PATH` at `backend/liboqs` automatically.

### 3. Run the backend

```powershell
cd backend
..\venv\Scripts\uvicorn app.main:app --reload --port 8000
```

### 4. Run the frontend

```powershell
cd frontend
npm install
npm run dev
```

Open <http://127.0.0.1:5173>. The UI defaults to `http://127.0.0.1:8000/api`;
override with `VITE_API_URL`.

On first launch, create a vault password. Then create an ECDSA wallet, fund it
from the faucet, create an ML-DSA destination, and run the dual-signed migration.
Reloading the page locks the vault; no password or private key is persisted in
plaintext.

## Tests

```powershell
cd backend
..\venv\Scripts\python -m pytest
```

The tests use the real liboqs backend and fail rather than silently falling back
to a mock.

Frontend checks:

```powershell
cd frontend
npm run lint
npm run build
```

## Database notes

- The schema keeps the legacy `private_key` column for compatibility, but new
  wallets store only an empty string there. All non-empty legacy values are
  purged on backend startup.
- `data/.master.key` is legacy from the old server-custody build. No current
  code reads it; delete it if you no longer need the old mock-era backup.
- Chain state lives in the same SQLite database. If you need a clean demo, back
  up `data/securemigrate.db` and remove it before starting the backend.
- The old mock-era database remains at `data/securemigrate.db.mock-backup`.

## Demo limitations

- Single-node chain; no consensus, networking, or peer validation.
- The unauthenticated faucet mints test funds. Do not expose it publicly.
- There is no user login or server-side access control.
- Browser `localStorage` is not protection against a compromised/XSS page; the
  vault protects keys at rest, not a fully compromised browser.
- Intended for local demonstration, not production custody.
