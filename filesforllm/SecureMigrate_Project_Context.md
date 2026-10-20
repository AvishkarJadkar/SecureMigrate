# SecureMigrate — Project Context & LLM Instructions

## What this document is
Full context on a final-year engineering capstone project. Give this file to any LLM/assistant before asking it to help with code, slides, reports, or patent material for this project, so it doesn't have to be re-explained from scratch.

---

## 1. Project identity

- **Title:** SecureMigrate — A Framework for Migrating Blockchain Digital Signatures from ECDSA to Post-Quantum ML-DSA
- **College:** Pune Vidyarthi Griha's College of Engineering Technology and Management, Pune-09, Dept. of Information Technology
- **Guide:** Prof. N. R. Sonawane
- **Team:** Avishkar Jadkar (23123096), Sharvari Kale (23013055), Kshitij Dixit (23123095), Snehal Narale (23013010)
- **Team reality:** 4 members on paper; effectively 2 people (Avishkar + one other) are doing the serious work. Timeline: ~6 months of real build time.
- **Status:** Past synopsis approval and a patent-review presentation to a college-affiliated patent consultancy. Currently in MVP build phase.

## 2. Problem statement

Blockchain wallets authenticate transactions with ECDSA (elliptic-curve discrete-log security). A sufficiently powerful quantum computer running Shor's algorithm can derive an ECDSA private key from its exposed public key, letting an attacker forge transactions. This isn't an active threat today (no cryptographically-relevant quantum computer exists yet), but standards bodies (NIST) already recommend migrating ahead of the threat. NIST finalized **ML-DSA (FIPS 204, based on CRYSTALS-Dilithium)** in August 2024 as the primary post-quantum signature standard — believed quantum-resistant because its underlying Module-LWE/Module-SIS lattice problems have no known periodicity for Shor's algorithm to exploit (unlike ECDSA's group structure).

**The actual gap SecureMigrate targets:** no existing framework provides a secure, benchmarked, *implemented* migration path for wallets going from ECDSA to ML-DSA — only isolated pieces exist (PQC blockchain prototypes with no migration path, PQC surveys with no implementation, Dilithium-based deterministic wallets with no ECDSA transition logic, benchmarking tools with no transition strategy).

## 3. What "migration" means here (important framing)

Migration is **not** a data-copy operation. A wallet's balance isn't stored data — it's a value the blockchain derives from transaction history. Migrating means: prove ownership of the old (ECDSA) wallet → generate a new (ML-DSA) wallet → transfer the balance via a normal on-chain transaction → retire the old wallet (spend-disabled, kept for audit). This is the same established pattern as Bitcoin address-format upgrades or TLS certificate rotation, applied to a post-quantum context — not a novel mechanic.

## 4. System architecture

```
[React UI] → [FastAPI backend] → [Crypto module (ECDSA + ML-DSA sign/verify/keygen)]
                                → [Custom single-node blockchain (SHA-256-linked blocks, ledger)]
                                → [DB: wallets, encrypted keys, migration records, tx history]
```
Flow: **User → Wallet → Blockchain → Risk Assessment → Migration → Dashboard**

### Core components
1. **Custom blockchain** — single-node, no consensus/mining/networking (deliberately out of scope — isolates cryptographic overhead as the variable being studied). Blocks: index, timestamp, transactions, previous_hash, hash (SHA-256).
2. **ECDSA wallet** — keygen/sign/verify via Python's `cryptography` library.
3. **ML-DSA wallet** — keygen/sign/verify via `liboqs-python`. **Important recent detail:** liboqs removed the old `Dilithium2/3/5` names as of v0.15.0 (Nov 2025) — use `ML-DSA-44` / `ML-DSA-65` / `ML-DSA-87` only.
4. **Migration engine (the core contribution)** — dual-signed atomic migration transaction:
   - Payload: `{old_address, new_address, new_pubkey, amount, nonce, timestamp, expiry, chain_id}`
   - Signed by BOTH the old ECDSA private key (proves old-wallet ownership) AND the new ML-DSA private key (proves the destination is legitimately controlled, blocking redirection by anyone who only compromises the old key)
   - Nonce + short expiry window → replay protection
   - Atomic execution: balance transfer + legacy-wallet spend-disable + migration-record log succeed or roll back together — never partial
   - Known, stated limitation: does not protect against a live CRQC racing the migration tx itself, or against endpoint/device compromise tricking the user into signing a bad migration target. These are explicitly out of scope and should be stated as limitations, not solved.
5. **Quantum risk assessment module** — rule-based scoring (not ML-based, deliberately — there's no real quantum-threat measurement to calibrate against). Baseline rule: ECDSA + public key exposed (has sent ≥1 tx) = high risk; ECDSA + never spent = medium; ML-DSA = low. An optional weighted-score variant exists but must be labeled a project-defined heuristic, not empirically calibrated.
6. **Benchmark/analytics dashboard** — compares ECDSA vs ML-DSA on key size, signature size, keygen/sign/verify time, using repeated timed trials (`time.perf_counter()`, NIST KATs for correctness) on the *same* hardware for a fair comparison.
7. **AES-256 private-key encryption** — stretch goal, not in MVP.

## 5. MVP scope (strict — do not expand without being asked)

**In scope:** custom chain, both wallet types, the dual-sign migration flow (nonce + atomicity), minimal FastAPI endpoints (create_wallet, send_transaction, migrate_wallet, get_balance, get_history), a bare-functional React UI, one benchmark script/chart.

**Explicitly out of scope for MVP** (only add if time remains): user auth/login, AES-256 key encryption, quantum risk-scoring module, full analytics dashboard, MongoDB (use SQLite for MVP), commit-reveal scheme, UI polish.

Do not suggest scope additions unless asked — this project has already been deliberately cut down for a 2-person, ~6-month effective timeline.

## 6. Tech stack

- Backend: FastAPI (Python)
- DB: SQLite for MVP → MongoDB only if/when justified
- Crypto: `cryptography` (ECDSA), `liboqs-python` (ML-DSA)
- Blockchain: custom, Python, SHA-256
- Frontend: React.js
- Analytics: Pandas, Matplotlib
- Encryption (stretch): AES-256

## 7. Research grounding (cite these, don't invent others without checking)

1. D. Dinu, "Migration to Post-Quantum Cryptography: From ECDSA to ML-DSA," IACR ePrint 2025/2025 — implementation-attack (side-channel/fault-injection) comparison of ECDSA vs ML-DSA signing.
2. M. Seck & A. Roux-Langlois, "Towards Post-Quantum Bitcoin Blockchain using Dilithium Signature," IACR Communications in Cryptology, vol. 2, no. 3, 2025 — DilithiumRK, rerandomizable-key deterministic wallets, formal unforgeability/unlinkability proofs.
3. T. Jain, "Performance Analysis of Quantum-Secure Digital Signature Algorithms in Blockchain," Univ. of Tartu, arXiv:2601.17785, Jan. 2026 — prototype blockchain benchmarking ML-DSA/Falcon/Hawk signature schemes.
4. T. M. Fernández-Caramés & P. Fraga-Lamas, "Towards Post-Quantum Blockchain: A Review on Blockchain Cryptography Resistant to Quantum Computing Attacks," IEEE Access, vol. 8, 2020 — broad PQC-for-blockchain survey.
5. NIST FIPS 204 (Module-Lattice-Based Digital Signature Standard, Aug. 2024) and NSA CNSA 2.0 advisory — standards grounding.

**Research gap this project fills:** no reviewed paper implements a complete migration framework combining (a) real ECDSA+ML-DSA crypto, (b) an explicit dual-signed migration transaction on a working chain, (c) legacy-wallet audit retention, and (d) an integrated benchmarking dashboard.

## 8. Patent angle — critical constraint

A patent consultant reviewed this project and flagged that **pure software is not patentable in India** (Patents Act §3(k) excludes "computer programs per se"). As currently scoped, this project is 100% software and would need a hardware-tied element to be patentable. Realistic options discussed (not yet committed to):
1. Move key storage/dual-signing into a hardware boundary — a TPM, HSM, or secure element — and claim the system around that hardware boundary.
2. A hardware-accelerated (FPGA/microcontroller) ML-DSA signing/verification component.
3. An embedded/IoT hardware wallet device running part of the migration logic.

If no hardware element is added, the fallback protections are copyright (of the code) and trade secret — not patent. **When asked about patentability, do not claim the current software-only design is patentable in India — say plainly it isn't, per §3(k), unless a hardware component has since been added.**

## 9. Existing deliverables already produced (check before regenerating)

- A full project synopsis (college format: Title, Abstract, Introduction, Literature Survey w/ tables, Proposed Work, System Requirements, Expected Result, References) — as a `.docx`.
- A patent-review PPTX (`SecureMigrate_Patent_Review`) — 10-11 slides: title, problem statement, motivation, system architecture, DFD Level-0, scope, literature survey/gap, novelty, trade-offs, thank-you. An "Areas of Application" slide has been added (icon-grid style matching the deck's existing visual language), inserted after the Novelty slide.
- A separate, longer general-project PPTX (`secure_migratee`) — 13 slides, broader deck (not the patent-focused one).

## 10. Instructions for the assistant

- **Don't re-relitigate settled scope decisions** (MVP cuts, single-node/no-consensus chain, SQLite-for-now, no auth) — treat them as fixed unless the user raises changing them.
- **Give direct, honest technical/viability assessments** — no inflated praise, no hedging softeners. If something is a bad idea, say so plainly and explain why.
- **Be precise about what's real vs. simulated** in this project: real cryptography, real signing/verification, a real (if toy, single-node) blockchain — but not a live quantum attack, not a production network, not empirically-calibrated risk scores.
- **On patentability**, always apply the §3(k)/hardware-tie constraint above — don't tell the user "your software idea is patentable" without that caveat.
- **Match existing citation set** for literature-survey content; if adding a new paper, say explicitly that it's new, don't blend it in silently.
- **Keep responses concise and action-oriented** — this user wants direct technical guidance, not padded explanations, and has explicitly asked for fewer tokens in responses.
- **For documents/slides**, prefer matching the existing deck's/synopsis's visual and structural style over introducing a new template, unless asked to redesign.
