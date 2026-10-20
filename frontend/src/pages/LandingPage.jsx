import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Blocks,
  CheckCircle2,
  Cpu,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

function SectionHeading({ eyebrow, title, text }) {
  return (
    <div className="section-heading">
      <div className="eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="landing">
      <div className="landing-orb landing-orb-one" />
      <div className="landing-orb landing-orb-two" />
      <div className="landing-grid" />

      <nav className="landing-nav">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <ShieldCheck size={19} />
          </span>
          <span>
            SecureMigrate
            <small>post-quantum custody</small>
          </span>
        </Link>
        <div className="landing-links">
          <a href="#how">How it works</a>
          <a href="#security">Security</a>
          <a href="#stack">Stack</a>
        </div>
        <Link to="/app" className="btn btn-primary btn-sm">
          Open app <ArrowRight size={15} />
        </Link>
      </nav>

      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <div className="hero-badge">
              <Sparkles size={14} />
              FIPS 204 · ML-DSA-65
            </div>
            <h1>
              Your keys.
              <br />
              <span className="gradient-text">Quantum-ready.</span>
            </h1>
            <p className="hero-lead">
              Move value from legacy ECDSA wallets to post-quantum ML-DSA without
              handing your private keys to a server. Sign locally. Verify on-chain.
            </p>
            <div className="hero-actions">
              <Link to="/app" className="btn btn-primary btn-lg">
                Launch SecureMigrate <ArrowRight size={17} />
              </Link>
              <a href="#how" className="btn btn-secondary btn-lg">
                See the flow
              </a>
            </div>
            <div className="hero-meta">
              <span>
                <CheckCircle2 size={15} /> Client-custody keys
              </span>
              <span>
                <CheckCircle2 size={15} /> Dual-signed migration
              </span>
              <span>
                <CheckCircle2 size={15} /> Real liboqs backend
              </span>
            </div>
          </div>

          <div className="hero-visual" aria-label="ECDSA to ML-DSA migration preview">
            <div className="visual-ring visual-ring-one" />
            <div className="visual-ring visual-ring-two" />
            <div className="visual-card">
              <div className="visual-head">
                <div>
                  <div className="visual-kicker">Migration preview</div>
                  <div className="visual-title">One transaction, two signatures</div>
                </div>
                <span className="badge badge-green">client-signed</span>
              </div>

              <div className="key-card key-card-amber">
                <div className="key-icon">
                  <KeyRound size={18} />
                </div>
                <div className="key-body">
                  <div className="key-label">Source wallet</div>
                  <div className="key-type">ECDSA · secp256k1</div>
                </div>
                <span className="key-status">signs</span>
              </div>

              <div className="flow-arrow">
                <span />
                <ArrowRight size={16} />
              </div>

              <div className="key-card key-card-green">
                <div className="key-icon">
                  <Fingerprint size={18} />
                </div>
                <div className="key-body">
                  <div className="key-label">Destination wallet</div>
                  <div className="key-type">ML-DSA-65 · FIPS 204</div>
                </div>
                <span className="key-status">signs</span>
              </div>

              <div className="visual-proof">
                <div>
                  <span className="proof-dot" />
                  Server verifies only
                </div>
                <code>0x7a3f…91c2</code>
              </div>
            </div>
          </div>
        </section>

        <section className="trust-strip" aria-label="Security properties">
          <span>
            <LockKeyhole size={15} /> Private keys never reach the API
          </span>
          <span>
            <ScanLine size={15} /> Every signature verified server-side
          </span>
          <span>
            <Blocks size={15} /> Migration recorded on-chain
          </span>
          <span>
            <Cpu size={15} /> FIPS 204 ML-DSA-65
          </span>
        </section>

        <section id="how" className="landing-section">
          <SectionHeading
            eyebrow="How it works"
            title="Three clean steps."
            text="The server builds the canonical unsigned transaction. Your browser signs it. The chain verifies it."
          />
          <div className="landing-steps">
            <article className="landing-step">
              <span className="step-number">01</span>
              <div className="step-icon">
                <KeyRound size={20} />
              </div>
              <h3>Create keys locally</h3>
              <p>
                Your ECDSA and ML-DSA keypairs are generated in the browser and
                encrypted in a password-protected vault.
              </p>
            </article>
            <article className="landing-step">
              <span className="step-number">02</span>
              <div className="step-icon">
                <Fingerprint size={20} />
              </div>
              <h3>Review and sign</h3>
              <p>
                The server returns the exact transaction hash. You inspect the
                details, then sign the hash on your device.
              </p>
            </article>
            <article className="landing-step">
              <span className="step-number">03</span>
              <div className="step-icon">
                <ShieldCheck size={20} />
              </div>
              <h3>Verify on-chain</h3>
              <p>
                The API validates both signatures, mines the migration, and
                permanently disables the old ECDSA wallet.
              </p>
            </article>
          </div>
        </section>

        <section id="security" className="landing-section security-section">
          <SectionHeading
            eyebrow="Security model"
            title="Custody stays where it belongs."
            text="A migration should not require trusting a server with the keys it is meant to protect."
          />
          <div className="security-grid">
            <article className="security-card security-card-wide">
              <div className="security-icon">
                <LockKeyhole size={20} />
              </div>
              <h3>Client-side key custody</h3>
              <p>
                Keys are generated with audited JavaScript cryptography and stored in
                an AES-256-GCM vault. The API stores public keys only — never private
                keys, seeds, or passphrases.
              </p>
              <div className="security-tags">
                <span>@noble/curves</span>
                <span>@noble/post-quantum</span>
                <span>WebCrypto</span>
              </div>
            </article>
            <article className="security-card">
              <div className="security-icon">
                <Fingerprint size={20} />
              </div>
              <h3>Dual-signature migration</h3>
              <p>
                The old ECDSA key and the new ML-DSA key both authorize the same
                canonical transaction hash.
              </p>
            </article>
            <article className="security-card">
              <div className="security-icon">
                <Blocks size={20} />
              </div>
              <h3>Auditable on-chain</h3>
              <p>
                Nonces, expiry, public-key binding, and replay protection are checked
                before a migration is accepted.
              </p>
            </article>
            <article className="security-card security-card-wide">
              <div className="security-icon">
                <ScanLine size={20} />
              </div>
              <h3>Server verifies, never signs</h3>
              <p>
                Prepare → review → sign → submit. The API reconstructs the transaction
                and verifies every signature, but it has nothing to sign with.
              </p>
            </article>
          </div>
        </section>

        <section id="stack" className="landing-section stack-section">
          <div className="stack-copy">
            <div className="eyebrow">Under the hood</div>
            <h2>A small, inspectable stack.</h2>
            <p>
              React and FastAPI around a single-node Python blockchain. Real liboqs
              ML-DSA-65 on the server, browser-native signing on the client.
            </p>
            <Link to="/app" className="text-link">
              Open the workspace <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="stack-list">
            <div>
              <span>Client</span>
              <strong>React · Vite · noble</strong>
            </div>
            <div>
              <span>API</span>
              <strong>FastAPI · SQLAlchemy · SQLite</strong>
            </div>
            <div>
              <span>Crypto</span>
              <strong>secp256k1 · ML-DSA-65</strong>
            </div>
            <div>
              <span>Chain</span>
              <strong>PoW demo · persistent blocks</strong>
            </div>
          </div>
        </section>

        <section className="landing-cta">
          <div>
            <div className="eyebrow">Ready when you are</div>
            <h2>Create a vault. Keep your keys.</h2>
            <p>No signup. No server-side key storage. Just a browser and a password.</p>
          </div>
          <Link to="/app" className="btn btn-primary btn-lg">
            Launch the app <ArrowRight size={17} />
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="brand brand-small">
          <span className="brand-mark">
            <ShieldCheck size={17} />
          </span>
          SecureMigrate
        </div>
        <p>ECDSA → ML-DSA migration framework · local demo build</p>
      </footer>
    </div>
  );
}
