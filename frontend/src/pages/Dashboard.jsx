import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowRightLeft,
  Coins,
  Droplets,
  KeyRound,
  Link2,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import api from '../api';
import { useVault } from '../context/VaultContext';
import {
  Badge,
  EmptyState,
  Notice,
  PageHeader,
  Spinner,
  StatCard,
  TypeBadge,
  formatAmount,
  formatTime,
  shortAddress,
} from '../components/ui';

export default function Dashboard() {
  const { wallets: localWallets } = useVault();
  const [serverWallets, setServerWallets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [status, setStatus] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState('');
  const [funding, setFunding] = useState('');

  const load = async () => {
    try {
      const [walletsResponse, txResponse, statusResponse, healthResponse] =
        await Promise.all([
          api.get('/wallets'),
          api.get('/transactions?limit=6'),
          api.get('/chain/status'),
          api.get('/health'),
        ]);
      setServerWallets(walletsResponse.data);
      setTransactions(txResponse.data);
      setStatus(statusResponse.data);
      setHealth(healthResponse.data);
      setError('');
    } catch {
      setError('Cannot reach the local API. Start the FastAPI backend and refresh.');
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
  const totalBalance = myWallets.reduce(
    (sum, wallet) => sum + Number(wallet.balance || 0),
    0,
  );
  const localAddresses = new Set(localWallets.map((wallet) => wallet.address));
  const myTransactions = transactions.filter(
    (tx) => localAddresses.has(tx.sender) || localAddresses.has(tx.recipient),
  );
  const hasFunded = myWallets.some((wallet) => Number(wallet.balance || 0) > 0);
  const hasMlDsa = myWallets.some((wallet) => wallet.walletType === 'mldsa');

  const fund = async (address) => {
    setFunding(address);
    setNotice(null);
    try {
      await api.post('/chain/faucet', { address, amount: 100 });
      setNotice({ tone: 'success', text: 'Added 100 test coins to your wallet.' });
      await load();
    } catch (err) {
      setNotice({
        tone: 'danger',
        text: err.response?.data?.detail || 'Faucet could not fund this wallet.',
      });
    } finally {
      setFunding('');
    }
  };

  if (loading) return <Spinner label="Loading your workspace…" />;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Overview"
        title="Your post-quantum workspace."
        subtitle="Keys live in your browser. The chain only sees public keys and signed transactions."
        actions={
          <Link to="/app/send" className="btn btn-primary">
            <ArrowRightLeft size={16} /> Send funds
          </Link>
        }
      />

      {error && <Notice tone="danger">{error}</Notice>}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      <div className="stat-grid">
        <StatCard
          icon={Coins}
          label="Local balance"
          value={`${formatAmount(totalBalance)} coins`}
          hint={`${myWallets.length} client-custody wallets`}
          tone="green"
        />
        <StatCard
          icon={Wallet}
          label="Active wallets"
          value={myWallets.filter((wallet) => !wallet.is_migrated).length}
          hint={`${myWallets.filter((wallet) => wallet.walletType === 'mldsa').length} ML-DSA`}
          tone="cyan"
        />
        <StatCard
          icon={Link2}
          label="Chain height"
          value={status?.chain_length ?? '—'}
          hint={status?.is_valid ? 'Chain verified' : 'Chain check failed'}
          tone="indigo"
        />
        <StatCard
          icon={ShieldCheck}
          label="PQC backend"
          value={health?.pqc_backend === 'liboqs' ? 'liboqs' : 'mock'}
          hint={`Chain ID · ${health?.chain_id || '—'}`}
          tone="amber"
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <div className="eyebrow">Client custody</div>
              <h2>Your wallets</h2>
            </div>
            <Link to="/app/wallets" className="text-link">
              Manage <ArrowRight size={15} />
            </Link>
          </div>

          {myWallets.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title="No local wallets yet"
              text="Create an ECDSA wallet, fund it from the faucet, and migrate it to ML-DSA when you are ready."
              action={
                <Link to="/app/wallets" className="btn btn-primary btn-sm">
                  Create your first wallet
                </Link>
              }
            />
          ) : (
            <div className="wallet-list">
              {myWallets.map((wallet) => (
                <div className="wallet-row" key={wallet.address}>
                  <div className="wallet-row-top">
                    <div className="wallet-identity">
                      <TypeBadge type={wallet.walletType} />
                      <code>{shortAddress(wallet.address)}</code>
                    </div>
                    <Badge tone={wallet.is_migrated ? 'neutral' : 'green'}>
                      {wallet.is_migrated ? 'Migrated' : 'Active'}
                    </Badge>
                  </div>
                  <div className="wallet-row-bottom">
                    <span className="wallet-balance">
                      {formatAmount(wallet.balance)} <small>coins</small>
                    </span>
                    <div className="row-actions">
                      {!wallet.is_migrated && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => fund(wallet.address)}
                          disabled={funding === wallet.address}
                        >
                          <Droplets size={14} />
                          {funding === wallet.address ? 'Funding…' : 'Faucet'}
                        </button>
                      )}
                      {!wallet.is_migrated && (
                        <Link to="/app/send" className="btn btn-ghost btn-xs">
                          Send
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel getting-started">
          <div className="panel-head">
            <div>
              <div className="eyebrow">First run</div>
              <h2>Getting started</h2>
            </div>
          </div>
          <ol className="checklist">
            <li className={myWallets.length > 0 ? 'done' : 'current'}>
              <span>{myWallets.length > 0 ? '✓' : '1'}</span>
              <div>
                <strong>Create a client-custody wallet</strong>
                <p>Generate the keypair in your browser.</p>
              </div>
            </li>
            <li className={hasFunded ? 'done' : myWallets.length > 0 ? 'current' : ''}>
              <span>{hasFunded ? '✓' : '2'}</span>
              <div>
                <strong>Fund it from the faucet</strong>
                <p>Get test coins without exposing a key.</p>
              </div>
            </li>
            <li className={hasMlDsa ? 'done' : hasFunded ? 'current' : ''}>
              <span>{hasMlDsa ? '✓' : '3'}</span>
              <div>
                <strong>Migrate to ML-DSA</strong>
                <p>Dual-sign one transaction and retire the old key.</p>
              </div>
            </li>
          </ol>
          <Link to="/app/migrate" className="btn btn-secondary btn-block">
            <ShieldCheck size={16} /> Open migration flow
          </Link>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">On-chain history</div>
            <h2>Recent activity</h2>
          </div>
          <Link to="/app/activity" className="text-link">
            View all <ArrowRight size={15} />
          </Link>
        </div>

        {myTransactions.length === 0 ? (
          <EmptyState
            icon={ArrowRightLeft}
            title="No activity from your wallets yet"
            text="Send a transfer or run a migration and it will appear here."
          />
        ) : (
          <div className="activity-list">
            {myTransactions.map((tx) => (
              <div className="activity-row" key={tx.tx_hash}>
                <div className="activity-type">
                  <TypeBadge type={tx.tx_type} algo={tx.sig_algo} />
                </div>
                <div className="activity-main">
                  <div>
                    {localAddresses.has(tx.sender) ? 'Sent to' : 'Received from'}{' '}
                    <code>
                      {shortAddress(
                        localAddresses.has(tx.sender) ? tx.recipient : tx.sender,
                      )}
                    </code>
                  </div>
                  <span>{formatTime(tx.timestamp)}</span>
                </div>
                <div className="activity-amount">
                  {localAddresses.has(tx.sender) ? '−' : '+'}
                  {formatAmount(tx.amount)} coins
                </div>
                <Badge tone="neutral">Block {tx.block_index}</Badge>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
