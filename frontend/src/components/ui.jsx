import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export const shortAddress = (address, head = 8, tail = 6) => {
  if (!address) return '—';
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
};

export const formatAmount = (value) =>
  Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  });

export const formatTime = (timestamp) => {
  if (!timestamp) return '—';
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function CopyButton({ value, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button type="button" className="btn btn-ghost btn-xs" onClick={copy}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? 'Copied' : label}
    </button>
  );
}

export function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function TypeBadge({ type, algo }) {
  const value = type || algo || 'transfer';
  const tone =
    value === 'mldsa' || value === 'migration'
      ? 'green'
      : value === 'ecdsa'
        ? 'amber'
        : 'cyan';
  const label =
    value === 'mldsa'
      ? 'ML-DSA'
      : value === 'ecdsa'
        ? 'ECDSA'
        : value.toUpperCase();
  return <Badge tone={tone}>{label}</Badge>;
}

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'cyan' }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon stat-icon-${tone}`}>{Icon && <Icon size={18} />}</div>
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </div>
  );
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="spinner-wrap">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="empty-state">
      {Icon && (
        <div className="empty-icon">
          <Icon size={22} />
        </div>
      )}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Notice({ tone = 'info', children }) {
  return <div className={`notice notice-${tone}`}>{children}</div>;
}

export function StepPills({ steps, current = 0 }) {
  return (
    <div className="step-pills">
      {steps.map((step, index) => (
        <div
          key={step}
          className={`step-pill ${index === current ? 'active' : ''} ${
            index < current ? 'done' : ''
          }`}
        >
          <span>{index < current ? '✓' : index + 1}</span>
          {step}
        </div>
      ))}
    </div>
  );
}
