import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  Droplets,
  Fingerprint,
  LockKeyhole,
  Send,
  ShieldCheck,
} from 'lucide-react';
import api from '../api';
import { useVault } from '../context/VaultContext';
import { signTxHash } from '../lib/crypto';
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
  shortAddress,
} from '../components/ui';

const STEPS = ['Compose', 'Review', 'Signed'];

export default function SendPage() {
  const { wallets: localWallets, getWallet } = useVault();
  const [serverWallets, setServerWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [senderAddress, setSenderAddress] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [prepared, setPrepared] = useState(null);
  const [result, setResult] = useState(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const response = await api.get('/wallets');
      setServerWallets(response.data);
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
  const activeWallets = myWallets.filter((wallet) => !wallet.is_migrated);
  const effectiveSender = senderAddress || activeWallets[0]?.address || '';
  const sender = myWallets.find((wallet) => wallet.address === effectiveSender);
  const available = Number(sender?.balance || 0);
  const recipientOptions = serverWallets.filter(
    (wallet) => wallet.address !== effectiveSender,
  );

  const reset = () => {
    setStep(0);
    setPrepared(null);
    setResult(null);
    setRecipient('');
    setAmount('');
    setError('');
  };

  const review = async (event) => {
    event.preventDefault();
    setError('');
    if (!effectiveSender || !recipient || !amount) {
      setError('Choose a sender, recipient, and amount.');
      return;
    }
    setBusy(true);
    try {
      const response = await api.post('/transactions/prepare', {
        sender_address: effectiveSender,
        recipient_address: recipient.trim(),
        amount: Number(amount),
      });
      setPrepared(response.data);
      setStep(1);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not prepare the transaction.');
    } finally {
      setBusy(false);
    }
  };

  const signAndSend = async () => {
    setBusy(true);
    setError('');
    try {
      const localWallet = getWallet(prepared.sender);
      if (!localWallet) {
        throw new Error('The sender private key is not in this vault.');
      }
      const signature = signTxHash(
        localWallet.walletType,
        localWallet.privateKey,
        prepared.tx_hash,
      );
      const response = await api.post('/transactions', {
        ...prepared,
        signature,
      });
      setResult(response.data);
      setStep(2);
      await load();
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          'Signing or submission failed. The transaction was not mined.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Spinner label="Loading wallets…" />;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Transfer"
        title="Send coins"
        subtitle="The API prepares the canonical transaction. You review it and sign the hash locally."
        actions={<StepPills steps={STEPS} current={step} />}
      />

      {error && <Notice tone="danger">{error}</Notice>}

      {activeWallets.length === 0 ? (
        <EmptyState
          icon={Send}
          title="No spending wallet available"
          text="Create and fund a wallet first. Migrated wallets cannot send in this demo."
          action={
            <Link to="/app/wallets" className="btn btn-primary btn-sm">
              Go to wallets
            </Link>
          }
        />
      ) : (
        <div className="send-layout">
          <div className="panel">
            {step === 0 && (
              <form className="flow-form" onSubmit={review}>
                <div className="panel-head">
                  <div>
                    <div className="eyebrow">Step 1</div>
                    <h2>Compose transfer</h2>
                  </div>
                </div>

                <label className="field">
                  <span>From wallet</span>
                  <select
                    value={effectiveSender}
                    onChange={(event) => setSenderAddress(event.target.value)}
                  >
                    {activeWallets.map((wallet) => (
                      <option key={wallet.address} value={wallet.address}>
                        {wallet.walletType === 'mldsa' ? 'ML-DSA' : 'ECDSA'} ·{' '}
                        {shortAddress(wallet.address)} · {formatAmount(wallet.balance)} coins
                      </option>
                    ))}
                  </select>
                </label>

                {sender && (
                  <div className="balance-line">
                    <span>
                      <TypeBadge type={sender.walletType} /> Available
                    </span>
                    <strong>{formatAmount(available)} coins</strong>
                  </div>
                )}

                <label className="field">
                  <span>Recipient address</span>
                  <input
                    list="recipient-options"
                    value={recipient}
                    onChange={(event) => setRecipient(event.target.value)}
                    placeholder="0x…"
                  />
                  <datalist id="recipient-options">
                    {recipientOptions.map((wallet) => (
                      <option key={wallet.address} value={wallet.address}>
                        {wallet.wallet_type === 'mldsa' ? 'ML-DSA' : 'ECDSA'} wallet
                      </option>
                    ))}
                  </datalist>
                </label>

                <label className="field">
                  <span>Amount</span>
                  <div className="input-with-action">
                    <input
                      type="number"
                      min="0.00000001"
                      step="any"
                      max={available}
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="0.00"
                    />
                    <button
                      type="button"
                      className="input-action text-action"
                      onClick={() => setAmount(String(available))}
                    >
                      Max
                    </button>
                  </div>
                </label>

                <button className="btn btn-primary btn-block" disabled={busy}>
                  {busy ? 'Preparing…' : 'Review transaction'}
                  {!busy && <ArrowRight size={16} />}
                </button>
              </form>
            )}

            {step === 1 && prepared && (
              <div className="flow-form">
                <div className="panel-head">
                  <div>
                    <div className="eyebrow">Step 2</div>
                    <h2>Review before signing</h2>
                  </div>
                  <Badge tone="cyan">{prepared.sig_algo.toUpperCase()}</Badge>
                </div>

                <div className="review-amount">
                  <span>You are sending</span>
                  <strong>{formatAmount(prepared.amount)} coins</strong>
                </div>

                <dl className="review-list">
                  <div>
                    <dt>From</dt>
                    <dd>
                      <code>{prepared.sender}</code>
                      <CopyButton value={prepared.sender} label="" />
                    </dd>
                  </div>
                  <div>
                    <dt>To</dt>
                    <dd>
                      <code>{prepared.recipient}</code>
                      <CopyButton value={prepared.recipient} label="" />
                    </dd>
                  </div>
                  <div>
                    <dt>Signature algorithm</dt>
                    <dd>
                      <TypeBadge type={prepared.sig_algo} />
                    </dd>
                  </div>
                  <div>
                    <dt>Transaction hash</dt>
                    <dd>
                      <code>{prepared.tx_hash}</code>
                      <CopyButton value={prepared.tx_hash} label="" />
                    </dd>
                  </div>
                </dl>

                <div className="sign-note">
                  <LockKeyhole size={17} />
                  <p>
                    Your {prepared.sig_algo === 'mldsa' ? 'ML-DSA' : 'ECDSA'} private
                    key will sign this exact hash in your browser.
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
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={signAndSend}
                    disabled={busy}
                  >
                    <Fingerprint size={16} />
                    {busy ? 'Signing & submitting…' : 'Sign & send'}
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
                    <div className="eyebrow">Step 3</div>
                    <h2>Transfer signed and mined</h2>
                  </div>
                  <Badge tone="green">Confirmed</Badge>
                </div>

                <div className="review-amount">
                  <span>Sent</span>
                  <strong>{formatAmount(result.amount)} coins</strong>
                </div>

                <dl className="review-list">
                  <div>
                    <dt>Transaction</dt>
                    <dd>
                      <code>{result.tx_hash}</code>
                      <CopyButton value={result.tx_hash} label="" />
                    </dd>
                  </div>
                  <div>
                    <dt>Block</dt>
                    <dd>#{result.block_index}</dd>
                  </div>
                  <div>
                    <dt>Signature</dt>
                    <dd>
                      <TypeBadge type={result.sig_algo} />
                    </dd>
                  </div>
                </dl>

                <div className="inline-actions">
                  <Link to="/app/activity" className="btn btn-secondary">
                    View activity
                  </Link>
                  <button type="button" className="btn btn-primary" onClick={reset}>
                    Send another
                  </button>
                </div>
              </div>
            )}
          </div>

          <aside className="side-panel">
            <div className="side-panel-head">
              <ArrowRightLeft size={18} />
              <h3>What happens next</h3>
            </div>
            <ol className="mini-steps">
              <li>
                <span>1</span>
                <div>
                  <strong>Prepare</strong>
                  <p>The API returns the exact fields and transaction hash.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Verify</strong>
                  <p>You check the amount, recipient, and hash.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Sign locally</strong>
                  <p>The private key signs the hash inside your vault.</p>
                </div>
              </li>
              <li>
                <span>4</span>
                <div>
                  <strong>Mine & verify</strong>
                  <p>The server verifies the signature and adds a block.</p>
                </div>
              </li>
            </ol>
            {available <= 0 && (
              <Link to="/app/wallets" className="btn btn-secondary btn-block btn-sm">
                <Droplets size={15} /> Fund a wallet
              </Link>
            )}
            <div className="security-footnote">
              <ShieldCheck size={16} />
              No private key is included in any API request.
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
