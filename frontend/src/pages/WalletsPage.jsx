import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Copy,
  Droplets,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import api from '../api';
import { useVault } from '../context/VaultContext';
import { generateWallet } from '../lib/crypto';
import {
  Badge,
  EmptyState,
  Notice,
  PageHeader,
  Spinner,
  TypeBadge,
  formatAmount,
  shortAddress,
  CopyButton,
} from '../components/ui';

export default function WalletsPage() {
  const { wallets: localWallets, addWallet } = useVault();
  const [serverWallets, setServerWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState('');
  const [funding, setFunding] = useState('');
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const response = await api.get('/wallets');
      setServerWallets(response.data);
      setError('');
    } catch {
      setError('Cannot reach the API. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (walletType) => {
    setCreating(walletType);
    setNotice(null);
    try {
      const wallet = await generateWallet(walletType);
      const response = await api.post('/wallets', {
        wallet_type: walletType,
        public_key: wallet.publicKey,
      });
      if (response.data.address !== wallet.address) {
        throw new Error('The server returned a different address for this key.');
      }
      await addWallet(wallet);
      setNotice({
        tone: 'success',
        text: `${walletType === 'mldsa' ? 'ML-DSA' : 'ECDSA'} wallet created. The private key is encrypted in your local vault.`,
      });
      await load();
    } catch (err) {
      setNotice({
        tone: 'danger',
        text:
          err.response?.data?.detail ||
          err.message ||
          'Could not create the wallet. Try again.',
      });
    } finally {
      setCreating('');
    }
  };

  const fund = async (address) => {
    setFunding(address);
    setNotice(null);
    try {
      await api.post('/chain/faucet', { address, amount: 100 });
      setNotice({ tone: 'success', text: 'Added 100 test coins.' });
      await load();
    } catch (err) {
      setNotice({
        tone: 'danger',
        text: err.response?.data?.detail || 'Faucet request failed.',
      });
    } finally {
      setFunding('');
    }
  };

  const serverByAddress = new Map(serverWallets.map((wallet) => [wallet.address, wallet]));
  const localAddresses = new Set(localWallets.map((wallet) => wallet.address));
  const myWallets = localWallets.map((wallet) => ({
    ...wallet,
    ...(serverByAddress.get(wallet.address) || {}),
  }));
  const externalWallets = serverWallets.filter(
    (wallet) => !localAddresses.has(wallet.address),
  );

  if (loading) return <Spinner label="Loading wallets…" />;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Client custody"
        title="Wallets"
        subtitle="Generate keys in your browser, register only the public key, and keep the private key encrypted locally."
        actions={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => create('ecdsa')}
              disabled={Boolean(creating)}
            >
              <Plus size={16} /> ECDSA
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => create('mldsa')}
              disabled={Boolean(creating)}
            >
              <Fingerprint size={16} /> ML-DSA
            </button>
          </>
        }
      />

      {error && <Notice tone="danger">{error}</Notice>}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {creating && (
        <Notice tone="info">
          Generating {creating === 'mldsa' ? 'ML-DSA-65' : 'ECDSA'} keys in your
          browser. This can take a moment.
        </Notice>
      )}

      <div className="split-note">
        <div className="split-note-icon">
          <LockKeyhole size={18} />
        </div>
        <div>
          <strong>Private keys never leave this device.</strong>
          <p>
            The API stores public keys and verifies signatures. Your encrypted vault
            is protected by the password you set at unlock.
          </p>
        </div>
      </div>

      <section>
        <div className="section-row">
          <div>
            <div className="eyebrow">Local keys</div>
            <h2>My wallets</h2>
          </div>
          <Badge tone="green">{myWallets.length} in vault</Badge>
        </div>

        {myWallets.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Create your first wallet"
            text="Start with ECDSA if you want to try the migration flow. ML-DSA is the post-quantum destination."
            action={
              <div className="inline-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => create('ecdsa')}
                  disabled={Boolean(creating)}
                >
                  <Plus size={15} /> Create ECDSA
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => create('mldsa')}
                  disabled={Boolean(creating)}
                >
                  <Fingerprint size={15} /> Create ML-DSA
                </button>
              </div>
            }
          />
        ) : (
          <div className="wallet-grid">
            {myWallets.map((wallet) => (
              <article
                className={`wallet-card ${wallet.is_migrated ? 'wallet-card-muted' : ''}`}
                key={wallet.address}
              >
                <div className="wallet-card-head">
                  <div className="wallet-card-icon">
                    {wallet.walletType === 'mldsa' ? (
                      <Fingerprint size={19} />
                    ) : (
                      <KeyRound size={19} />
                    )}
                  </div>
                  <div>
                    <TypeBadge type={wallet.walletType} />
                    <div className="wallet-address">
                      <code>{shortAddress(wallet.address, 10, 8)}</code>
                      <CopyButton value={wallet.address} label="" />
                    </div>
                  </div>
                  <Badge tone={wallet.is_migrated ? 'neutral' : 'green'}>
                    {wallet.is_migrated ? 'Migrated' : 'Local key'}
                  </Badge>
                </div>

                <div className="wallet-card-balance">
                  <span>{formatAmount(wallet.balance)}</span>
                  <small>coins</small>
                </div>

                {wallet.is_migrated && wallet.migrated_to && (
                  <div className="wallet-migrated-to">
                    Migrated to <code>{shortAddress(wallet.migrated_to)}</code>
                  </div>
                )}

                <div className="wallet-card-actions">
                  {!wallet.is_migrated && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => fund(wallet.address)}
                      disabled={funding === wallet.address}
                    >
                      <Droplets size={15} />
                      {funding === wallet.address ? 'Funding…' : 'Faucet 100'}
                    </button>
                  )}
                  {!wallet.is_migrated && (
                    <Link to="/app/send" className="btn btn-ghost btn-sm">
                      Send <ArrowRight size={14} />
                    </Link>
                  )}
                  {wallet.walletType === 'ecdsa' && !wallet.is_migrated && (
                    <Link to="/app/migrate" className="btn btn-ghost btn-sm">
                      <ShieldCheck size={14} /> Migrate
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {externalWallets.length > 0 && (
        <section>
          <div className="section-row">
            <div>
              <div className="eyebrow">Registered on this node</div>
              <h2>Other wallets</h2>
            </div>
            <Badge tone="neutral">View only</Badge>
          </div>
          <div className="wallet-grid">
            {externalWallets.map((wallet) => (
              <article className="wallet-card wallet-card-muted" key={wallet.address}>
                <div className="wallet-card-head">
                  <div className="wallet-card-icon">
                    <Wallet size={19} />
                  </div>
                  <div>
                    <TypeBadge type={wallet.wallet_type} />
                    <div className="wallet-address">
                      <code>{shortAddress(wallet.address, 10, 8)}</code>
                      <CopyButton value={wallet.address} label="" />
                    </div>
                  </div>
                  <Badge tone="neutral">No local key</Badge>
                </div>
                <div className="wallet-card-balance">
                  <span>{formatAmount(wallet.balance)}</span>
                  <small>coins</small>
                </div>
                <p className="muted small">
                  This public key is registered, but the private key is not in this
                  browser vault.
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="info-grid">
        <article className="info-card">
          <KeyRound size={18} />
          <h3>ECDSA</h3>
          <p>Legacy secp256k1 wallet. Use it to try the dual-signed migration flow.</p>
        </article>
        <article className="info-card">
          <Fingerprint size={18} />
          <h3>ML-DSA-65</h3>
          <p>Post-quantum FIPS 204 wallet. This is the destination for migrations.</p>
        </article>
        <article className="info-card">
          <Copy size={18} />
          <h3>Vault encrypted</h3>
          <p>
            Keys are encrypted with AES-256-GCM. The password only exists in memory
            while the vault is unlocked.
          </p>
        </article>
      </div>
    </div>
  );
}
