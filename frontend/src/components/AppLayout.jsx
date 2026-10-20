import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Activity,
  ArrowRightLeft,
  Gauge,
  Home,
  LockKeyhole,
  Menu,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import api from '../api';
import { useVault } from '../context/VaultContext';
import VaultGate from './VaultGate';

const NAV_ITEMS = [
  { to: '/app', label: 'Overview', icon: Home, end: true },
  { to: '/app/wallets', label: 'Wallets', icon: Wallet },
  { to: '/app/send', label: 'Send', icon: ArrowRightLeft },
  { to: '/app/migrate', label: 'Migrate', icon: ShieldCheck },
  { to: '/app/activity', label: 'Activity', icon: Activity },
  { to: '/app/benchmark', label: 'Benchmark', icon: Gauge },
];

const PAGE_TITLES = {
  '/app': ['Overview', 'Your wallets and network at a glance'],
  '/app/wallets': ['Wallets', 'Create and manage client-custody keys'],
  '/app/send': ['Send', 'Review, sign locally, then submit'],
  '/app/migrate': ['Migrate', 'Move value from ECDSA to ML-DSA'],
  '/app/activity': ['Activity', 'Transfers and migrations on this chain'],
  '/app/benchmark': ['Benchmark', 'ECDSA versus ML-DSA-65 on this machine'],
};

export default function AppLayout() {
  const { status, wallets, lockVault } = useVault();
  const [menuOpen, setMenuOpen] = useState(false);
  const [health, setHealth] = useState(null);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (status !== 'unlocked') return;
    let active = true;
    api
      .get('/health')
      .then((response) => {
        if (active) setHealth(response.data);
      })
      .catch(() => {
        if (active) setHealth(null);
      });
    return () => {
      active = false;
    };
  }, [status]);

  if (status !== 'unlocked') return <VaultGate />;

  const [title, subtitle] = PAGE_TITLES[location.pathname] || PAGE_TITLES['/app'];

  return (
    <div className="app-shell">
      {menuOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-top">
          <Link to="/app" className="brand">
            <span className="brand-mark">
              <ShieldCheck size={19} />
            </span>
            <span>
              SecureMigrate
              <small>post-quantum custody</small>
            </span>
          </Link>
          <button
            type="button"
            className="icon-button sidebar-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="app-nav">
          <div className="nav-label">Workspace</div>
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="vault-panel">
            <div className="vault-panel-head">
              <span className="status-dot status-dot-green" />
              Vault unlocked
            </div>
            <p>
              {wallets.length} local {wallets.length === 1 ? 'key' : 'keys'} encrypted in
              this browser
            </p>
            <div className="vault-panel-actions">
              <button type="button" className="btn btn-ghost btn-xs" onClick={lockVault}>
                <LockKeyhole size={14} /> Lock
              </button>
              <Link to="/" className="btn btn-ghost btn-xs">
                Landing page
              </Link>
            </div>
          </div>
          <div className="sidebar-note">FIPS 204 · ML-DSA-65</div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-title">
            <button
              type="button"
              className="icon-button mobile-menu"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div>
              <div className="topbar-eyebrow">{title}</div>
              <div className="topbar-subtitle">{subtitle}</div>
            </div>
          </div>
          <div className="topbar-actions">
            <span className={`network-pill ${health ? 'online' : 'offline'}`}>
              <span className="status-dot" />
              {health ? `API · ${health.pqc_backend === 'liboqs' ? 'liboqs' : 'mock'}` : 'API offline'}
            </span>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
