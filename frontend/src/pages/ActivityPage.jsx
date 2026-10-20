import { useEffect, useState } from 'react';
import { Activity, ArrowDownLeft, ArrowUpRight, Filter } from 'lucide-react';
import api from '../api';
import { useVault } from '../context/VaultContext';
import {
  Badge,
  CopyButton,
  EmptyState,
  Notice,
  PageHeader,
  Spinner,
  TypeBadge,
  formatAmount,
  formatTime,
  shortAddress,
} from '../components/ui';

const FILTERS = ['all', 'transfer', 'migration'];

export default function ActivityPage() {
  const { wallets: localWallets } = useVault();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const load = async () => {
    try {
      const response = await api.get('/transactions?limit=100');
      setTransactions(response.data);
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

  const localAddresses = new Set(localWallets.map((wallet) => wallet.address));
  const visible =
    filter === 'all'
      ? transactions
      : transactions.filter((transaction) => transaction.tx_type === filter);

  if (loading) return <Spinner label="Loading chain activity…" />;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="On-chain history"
        title="Activity"
        subtitle="Transfers and migrations recorded by this node. Your own wallets are marked."
        actions={
          <div className="filter-group">
            <Filter size={15} />
            {FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                className={`filter-chip ${filter === value ? 'active' : ''}`}
                onClick={() => setFilter(value)}
              >
                {value === 'all'
                  ? 'All'
                  : value === 'transfer'
                    ? 'Transfers'
                    : 'Migrations'}
              </button>
            ))}
          </div>
        }
      />

      {error && <Notice tone="danger">{error}</Notice>}

      <div className="activity-summary">
        <div>
          <span>Total transactions</span>
          <strong>{transactions.length}</strong>
        </div>
        <div>
          <span>Transfers</span>
          <strong>
            {transactions.filter((transaction) => transaction.tx_type === 'transfer').length}
          </strong>
        </div>
        <div>
          <span>Migrations</span>
          <strong>
            {transactions.filter((transaction) => transaction.tx_type === 'migration').length}
          </strong>
        </div>
      </div>

      <section className="panel">
        {visible.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Nothing here yet"
            text="Transfers and migrations will appear here after they are mined."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Direction</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Amount</th>
                  <th>Block</th>
                  <th>Time</th>
                  <th>Hash</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((transaction) => {
                  const isMine =
                    localAddresses.has(transaction.sender) ||
                    localAddresses.has(transaction.recipient);
                  return (
                    <tr key={transaction.tx_hash}>
                      <td>
                        <TypeBadge
                          type={transaction.tx_type}
                          algo={transaction.sig_algo}
                        />
                      </td>
                      <td>
                        {isMine ? (
                          localAddresses.has(transaction.sender) ? (
                            <span className="direction direction-out">
                              <ArrowUpRight size={14} /> Out
                            </span>
                          ) : (
                            <span className="direction direction-in">
                              <ArrowDownLeft size={14} /> In
                            </span>
                          )
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <code>{shortAddress(transaction.sender)}</code>
                      </td>
                      <td>
                        <code>{shortAddress(transaction.recipient)}</code>
                      </td>
                      <td className="amount-cell">
                        {formatAmount(transaction.amount)}
                      </td>
                      <td>
                        <Badge tone="neutral">#{transaction.block_index}</Badge>
                      </td>
                      <td className="muted">{formatTime(transaction.timestamp)}</td>
                      <td>
                        <div className="hash-cell">
                          <code>{shortAddress(transaction.tx_hash, 8, 6)}</code>
                          <CopyButton value={transaction.tx_hash} label="" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
