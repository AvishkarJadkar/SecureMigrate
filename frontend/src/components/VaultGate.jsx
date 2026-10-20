import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  LockKeyhole,
  KeyRound,
  ArrowLeft,
  Eye,
  EyeOff,
  Fingerprint,
} from 'lucide-react';
import { useVault } from '../context/VaultContext';

export default function VaultGate() {
  const { status, busy, setupVault, unlockVault } = useVault();
  const isSetup = status === 'setup';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (isSetup && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    try {
      if (isSetup) {
        await setupVault(password);
      } else {
        await unlockVault(password);
      }
    } catch {
      setError(
        isSetup
          ? 'Could not create the vault. Check that browser storage is available.'
          : 'That password could not unlock this vault.',
      );
    }
  };

  return (
    <div className="vault-screen">
      <div className="vault-orb vault-orb-one" />
      <div className="vault-orb vault-orb-two" />

      <Link to="/" className="brand brand-standalone">
        <span className="brand-mark">
          <ShieldCheck size={20} />
        </span>
        SecureMigrate
      </Link>

      <div className="vault-shell">
        <section className="vault-info">
          <div className="eyebrow">Local key custody</div>
          <h1>{isSetup ? 'Create your private vault.' : 'Welcome back.'}</h1>
          <p>
            {isSetup
              ? 'Your signing keys are generated here, encrypted here, and never sent to the server.'
              : 'Unlock the encrypted key vault stored in this browser to continue.'}
          </p>

          <ul className="feature-list">
            <li>
              <LockKeyhole size={17} />
              AES-256-GCM encryption with a PBKDF2-derived key
            </li>
            <li>
              <KeyRound size={17} />
              Keys stay in this browser — the API only receives public keys
            </li>
            <li>
              <Fingerprint size={17} />
              Every transaction is signed locally before submission
            </li>
          </ul>

          <div className="vault-quote">
            The server verifies signatures. It never holds the keys that create them.
          </div>
        </section>

        <form className="vault-card" onSubmit={submit}>
          <div className="vault-card-icon">
            {isSetup ? <KeyRound size={22} /> : <LockKeyhole size={22} />}
          </div>
          <h2>{isSetup ? 'Set a vault password' : 'Unlock your vault'}</h2>
          <p className="muted">
            {isSetup
              ? 'This password encrypts the private keys in this browser. It is not sent anywhere.'
              : 'Enter the password you created for this browser.'}
          </p>

          <label className="field">
            <span>Password</span>
            <div className="input-with-action">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isSetup ? 'At least 8 characters' : 'Your vault password'}
                autoComplete={isSetup ? 'new-password' : 'current-password'}
                autoFocus
              />
              <button
                type="button"
                className="input-action"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          {isSetup && (
            <label className="field">
              <span>Confirm password</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="Repeat your password"
                autoComplete="new-password"
              />
            </label>
          )}

          {error && <div className="form-error">{error}</div>}

          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy
              ? 'Working…'
              : isSetup
                ? 'Create encrypted vault'
                : 'Unlock vault'}
          </button>

          <p className="vault-footnote">
            {isSetup
              ? 'There is no password reset. If you lose this password, the local keys cannot be recovered.'
              : 'Lost the password? The local keys are unrecoverable by design.'}
          </p>

          <Link to="/" className="back-link">
            <ArrowLeft size={15} /> Back to landing page
          </Link>
        </form>
      </div>
    </div>
  );
}
