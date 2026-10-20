import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import api from '../api';
import { useVault } from '../context/VaultContext';
import { generateWallet, signTxHash } from '../lib/crypto';
import {
  Badge,
  CopyButton,
  EmptyState,
  Notice,
  PageHeader,
  Spinner,
  StepPills,
  TypeBadge,
  formatAmount,
  formatTime,
  shortAddress,
} from '../components/ui';

const STEPS = ['Choose', 'Review', 'Done'];

export default function MigratePage() {
  const { wallets: localWallets, addWallet, getWallet } = useVault();
  const [serverWallets, setServerWallets] = useState([]);
  const [migrations, setMigrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [oldAddress, setOldAddress] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [prepared, setPrepared] = useState(null);
  const [result, setResult] = useState(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);

  const load = async () => {
    try {
      const [walletsResponse, migrationsResponse] = await Promise.all([
        api.get('/wallets'),
        api.get('/migrate/migrations'),
      ]);
      setServerWallets(walletsResponse.data);
      setMigrations(migrationsResponse.data);
      setError('');
    } catch {
      setError('Cannot reach the API. Start the backend and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const serverByAddress = new Map(serverWallets.map((wallet) => [wallet.address, wallet]));
  const myWallets = localWallets.map((wallet) => ({
    ...wallet,
    ...(serverByAddress.get(wallet.address) || {}),
  }));
  const oldOptions = myWallets.filter(
    (wallet) =>
      wallet.walletType === 'ecdsa' &&
      !wallet.is_migrated &&
      Number(wallet.balance || 0) > 0,
  );
  const newOptions = myWallets.filter(
    (wallet) => wallet.walletType === 'mldsa' && !wallet.is_migrated,
  );
  const effectiveOld = oldAddress || oldOptions[0]?.address || '';
  const effectiveNew = newAddress || newOptions[0]?.address || '';
  const oldWallet = myWallets.find((wallet) => wallet.address === effectiveOld);

  const reset = () => {
    setStep(0);
    setPrepared(null);
    setResult(null);
    setError('');
    setNotice(null);
  };

  const createDestination = async () => {
    setCreating(true);
    setError('');
    setNotice(null);
    try {
      const wallet = await generateWallet('mldsa');
      const response = await api.post('/wallets', {
        wallet_type: 'mldsa',
        public_key: wallet.publicKey,
      });
      if (response.data.address !== wallet.address) {
        throw new Error('The server returned a different address for this key.');
      }
      await addWallet(wallet);
      setNewAddress(wallet.address);
      setNotice({
        tone: 'success',
        text: 'ML-DSA destination created. Its private key is encrypted in your vault.',
      });
      await load();
    } catch (err) {
      setError(
        err.response?.data?.detail || err.message || 'Could not create destination wallet.',
      );
    } finally {
      setCreating(false);
    }
  };

  const review = async (event) => {
    event.preventDefault();
    setError('');
    if (!effectiveOld || !effectiveNew) {
      setError('Choose both a source and a destination wallet.');
      return;
    }
    if (effectiveOld === effectiveNew) {
      setError('Source and destination must be different wallets.');
      return;
    }
    setBusy(true);
    try {
      const response = await api.post('/migrate/prepare', {
        old_address: effectiveOld,
        new_address: effectiveNew,
      });
      setPrepared(response.data);
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not prepare the migration.');
    } finally {
      setBusy(false);
    }
  };

  const signAndMigrate = async () => {
    setBusy(true);
    setError('');
    try {
      const oldLocal = getWallet(prepared.sender);
      const newLocal = getWallet(prepared.recipient);
      if (!oldLocal || !newLocal) {
        throw new Error('One of the private keys is not in this vault.');
      }
      const oldSignature = signTxHash('ecdsa', oldLocal.privateKey, prepared.tx_hash);
      const newSignature = signTxHash('mldsa', newLocal.privateKey, prepared.tx_hash);
      const response = await api.post('/migrate', {
        ...prepared,
        signature: oldSignature,
        new_signature: newSignature,
      });
      setResult(response.data);
      setStep(2);
      await load();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          'Migration signing or submission failed. Nothing was mined.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner label="Loading migration data…" />;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Post-quantum upgrade"
        title="Migrate an ECDSA wallet"
        subtitle="Both the old ECDSA key and the new ML-DSA key sign one canonical hash. The server only verifies."
        actions={<StepPills steps={STEPS} current={step} />}
      />

      {error && <Notice tone="danger">{error}</Notice>}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      {oldOptions.length === 0 && step === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No funded ECDSA wallet"
          text="Migration moves the full balance of an ECDSA wallet. Create one and add test coins first."
          action={
            <Link to="/app/wallets" className="btn btn-primary btn-sm">
              Go to wallets
            </Link>
          }
        />
      ) : (
        <div className="migrate-layout">
          <div className="panel">
            {step === 0 && (
              <form className="flow-form" onSubmit={review}>
                <div className="panel-head">
                  <div>
                    <div className="eyebrow">Step 1</div>
                    <h2>Choose source and destination</h2>
                  </div>
                </div>

                <label className="field">
                  <span>Source ECDSA wallet</span>
                  <select
                    value={effectiveOld}
                    onChange={(event) => setOldAddress(event.target.value)}
                  >
                    {oldOptions.map((wallet) => (
                      <option key={wallet.address} value={wallet.address}>
                        {shortAddress(wallet.address)} · {formatAmount(wallet.balance)} coins
                      </option>
                    ))}
                  </select>
                </label>

                {oldWallet && (
                  <div className="balance-line">
                    <span>Full balance to migrate</span>
                    <strong>{formatAmount(oldWallet.balance)} coins</strong>
                  </div>
                )}

                <div className="field">
                  <span>Destination ML-DSA wallet</span>
                  {newOptions.length > 0 ? (
                    <select
                      value={effectiveNew}
                      onChange={(event) => setNewAddress(event.target.value)}
                    >
                      {newOptions.map((wallet) => (
                        <option key={wallet.address} value={wallet.address}>
                          {shortAddress(wallet.address)} · {formatAmount(wallet.balance)} coins
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="inline-empty">
                      <span>No local ML-DSA destination yet.</span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={createDestination}
                        disabled={creating}
                      >
                        <Plus size={15} />
                        {creating ? 'Generating…' : 'Create ML-DSA wallet'}
                      </button>
                    </div>
                  )}
                </div>

                {newOptions.length > 0 && (
                  <button
                    type="button"
                    className="text-link text-link-button"
                    onClick={createDestination}
                    disabled={creating}
                  >
                    <Plus size={15} />
                    {creating ? 'Generating ML-DSA keys…' : 'Create another destination'}
                  </button>
                )}

                <div className="warning-box">
                  <AlertTriangle size={17} />
                  <p>
                    The full balance moves to the destination. The old ECDSA wallet is
                    spend-disabled after migration and this action cannot be undone.
                  </p>
                </div>

                <button
                  className="btn btn-primary btn-block"
                  disabled={busy || !effectiveOld || !effectiveNew}
                >
                  {busy ? 'Preparing…' : 'Review migration'}
                  {!busy && <ArrowRight size={16} />}
                </button>
              </form>
            )}

            {step === 1 && prepared && (
              <div className="flow-form">
                <div className="panel-head">
                  <div>
                    <div className="eyebrow">Step 2</div>
                    <h2>Review dual-signed migration</h2>
                  </div>
                  <Badge tone="amber">2 signatures required</Badge>
                </div>

                <div className="migration-visual">
                  <div className="migration-key">
                    <KeyRound size={18} />
                    <span>ECDSA</span>
                    <code>{shortAddress(prepared.sender, 8, 6)}</code>
                  </div>
                  <div className="migration-arrow">
                    <ArrowRight size={18} />
                  </div>
                  <div className="migration-key migration-key-new">
                    <Fingerprint size={18} />
                    <span>ML-DSA-65</span>
                    <code>{shortAddress(prepared.recipient, 8, 6)}</code>
                  </div>
                </div>

                <div className="review-amount">
                  <span>Full balance moving</span>
                  <strong>{formatAmount(prepared.amount)} coins</strong>
                </div>

                <dl className="review-list">
                  <div>
                    <dt>Nonce</dt>
                    <dd>
                      <code>{prepared.nonce}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Transaction hash</dt>
                    <dd>
                      <code>{prepared.tx_hash}</code>
                      <CopyButton value={prepared.tx_hash} label="" />
                    </dd>
                  </div>
                  <div>
                    <dt>Expires</dt>
                    <dd>{formatTime(prepared.expiry)}</dd>
                  </div>
                  <div>
                    <dt>Chain</dt>
                    <dd>
                      <code>{prepared.chain_id}</code>
                    </dd>
                  </div>
                </dl>

                <div className="sign-note">
                  <LockKeyhole size={17} />
                  <p>
                    The source ECDSA key and destination ML-DSA key will sign the same
                    hash in your browser. Both private keys stay in this vault.
                  </p>
                </div>

                <div className="inline-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setStep(0);
                      setPrepared(null);
                    }}
                    disabled={busy}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={signAndMigrate}
                    disabled={busy}
                  >
                    <ShieldCheck size={16} />
                    {busy ? 'Signing & migrating…' : 'Sign & migrate'}
                  </button>
                </div>
              </div>
            )}

            {step === 2 && result && (
              <div className="flow-form">
                <div className="success-mark">
                  <CheckCircle2 size={30} />
                </div>
                <div className="panel-head">
                  <div>
                    <div className="eyebrow">Done</div>
                    <h2>Migration executed on-chain</h2>
                  </div>
                  <Badge tone="green">Confirmed</Badge>
                </div>

                <div className="review-amount">
                  <span>Migrated</span>
                  <strong>{formatAmount(result.amount_migrated)} coins</strong>
                </div>

                <dl className="review-list">
                  <div>
                    <dt>Destination</dt>
                    <dd>
                      <code>{result.new_address}</code>
                      <CopyButton value={result.new_address} label="" />
                    </dd>
                  </div>
                  <div>
                    <dt>Transaction</dt>
                    <dd>
                      <code>{result.migration_tx_hash}</code>
                      <CopyButton value={result.migration_tx_hash} label="" />
                    </dd>
                  </div>
                  <div>
                    <dt>Block</dt>
                    <dd>#{result.block_index}</dd>
                  </div>
                </dl>

                <div className="sign-note success-note">
                  <LockKeyhole size={17} />
                  <p>
                    The new ML-DSA private key is in your local vault. The old ECDSA
                    wallet is now spend-disabled on-chain.
                  </p>
                </div>

                <div className="inline-actions">
                  <Link to="/app/wallets" className="btn btn-secondary">
                    View wallets
                  </Link>
                  <button type="button" className="btn btn-primary" onClick={reset}>
                    Migrate another
                  </button>
                </div>
              </div>
            )}
          </div>

          <aside className="side-panel">
            <div className="side-panel-head">
              <ShieldCheck size={18} />
              <h3>Why dual-sign?</h3>
            </div>
            <ol className="mini-steps">
              <li>
                <span>1</span>
                <div>
                  <strong>Prove old ownership</strong>
                  <p>The ECDSA key authorizes moving the existing balance.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Bind the new key</strong>
                  <p>The ML-DSA key signs the same hash, proving possession.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Disable replay</strong>
                  <p>A nonce, expiry, and chain ID make the migration single-use.</p>
                </div>
              </li>
            </ol>
            <div className="security-footnote">
              <LockKeyhole size={16} />
              The API never receives either private key.
            </div>
          </aside>
        </div>
      )}

      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">On-chain record</div>
            <h2>Migration history</h2>
          </div>
          <Badge tone="neutral">{migrations.length} total</Badge>
        </div>

        {migrations.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No migrations yet"
            text="Your completed migrations will be listed here with their block and transaction hash."
          />
        ) : (
          <div className="migration-list">
            {migrations.map((migration) => (
              <div className="migration-row" key={migration.id}>
                <div className="migration-row-main">
                  <TypeBadge type="migration" />
                  <div>
                    <div>
                      <code>{shortAddress(migration.old_address)}</code>
                      <ArrowRight size={13} />
                      <code>{shortAddress(migration.new_address)}</code>
                    </div>
                    <span>{formatTime(migration.timestamp)}</span>
                  </div>
                </div>
                <div className="migration-row-amount">
                  {formatAmount(migration.amount)} coins
                </div>
                <Badge tone="green">Block {migration.block_index}</Badge>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
