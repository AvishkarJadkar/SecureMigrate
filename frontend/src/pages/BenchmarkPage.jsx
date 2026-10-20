import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Gauge,
  KeyRound,
  Play,
  ShieldCheck,
} from 'lucide-react';
import api from '../api';
import {
  Badge,
  Notice,
  PageHeader,
  Spinner,
  StatCard,
} from '../components/ui';

const formatMs = (value) => `${Number(value || 0).toFixed(3)} ms`;

function MetricBar({ label, ecdsa, mldsa }) {
  const max = Math.max(Number(ecdsa) || 0, Number(mldsa) || 0, 0.001);
  return (
    <div className="metric-bar">
      <div className="metric-bar-head">
        <span>{label}</span>
        <span className="muted">
          {formatMs(ecdsa)} vs {formatMs(mldsa)}
        </span>
      </div>
      <div className="bar-pair">
        <div className="bar-track">
          <div
            className="bar-fill bar-ecdsa"
            style={{ width: `${(Number(ecdsa) / max) * 100}%` }}
          />
        </div>
        <div className="bar-track">
          <div
            className="bar-fill bar-mldsa"
            style={{ width: `${(Number(mldsa) / max) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function BenchmarkPage() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [iterations, setIterations] = useState(50);
  const [error, setError] = useState('');

  const fetchResults = async () => {
    try {
      const response = await api.get('/benchmark/results');
      setResult(response.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Benchmark backend is unavailable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  const runBenchmark = async () => {
    setRunning(true);
    setError('');
    try {
      const response = await api.post('/benchmark/run', {
        iterations: Math.max(1, Math.min(500, Number(iterations) || 50)),
      });
      setResult(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not run the benchmark. Is the real liboqs backend available?',
      );
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <Spinner label="Loading benchmark results…" />;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Performance"
        title="ECDSA vs ML-DSA-65"
        subtitle="Measured on the backend machine using the real liboqs implementation."
        actions={
          <div className="benchmark-controls">
            <label>
              Iterations
              <input
                type="number"
                min="1"
                max="500"
                value={iterations}
                onChange={(event) => setIterations(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn btn-primary"
              onClick={runBenchmark}
              disabled={running}
            >
              <Play size={16} /> {running ? 'Running…' : 'Run benchmark'}
            </button>
          </div>
        }
      />

      {error && <Notice tone="danger">{error}</Notice>}
      {running && (
        <Notice tone="info">
          Running {iterations} iterations. ML-DSA signing and verification are
          intentionally slower than ECDSA.
        </Notice>
      )}

      {result ? (
        <>
          <div className="stat-grid">
            <StatCard
              icon={Gauge}
              label="Iterations"
              value={result.iterations}
              hint="per algorithm"
              tone="indigo"
            />
            <StatCard
              icon={ShieldCheck}
              label="Correctness"
              value={result.comparison?.correctness_ok ? 'PASS' : 'FAIL'}
              hint="sign + verify self-check"
              tone={result.comparison?.correctness_ok ? 'green' : 'amber'}
            />
            <StatCard
              icon={Cpu}
              label="PQC backend"
              value={result.comparison?.pqc_backend || 'liboqs'}
              hint="ML-DSA-65"
              tone="cyan"
            />
            <StatCard
              icon={KeyRound}
              label="Signature size"
              value={`${result.mldsa.signature_size_bytes} B`}
              hint={`ECDSA: ${result.ecdsa.signature_size_bytes} B`}
              tone="amber"
            />
          </div>

          <div className="panel benchmark-summary">
            <div className="benchmark-summary-head">
              <div className="security-icon">
                <Gauge size={19} />
              </div>
              <div>
                <div className="eyebrow">Summary</div>
                <h2>What the numbers mean</h2>
              </div>
              <Badge tone={result.comparison?.correctness_ok ? 'green' : 'amber'}>
                {result.comparison?.correctness_ok ? 'verified' : 'check failed'}
              </Badge>
            </div>
            <p>{result.comparison?.summary}</p>
            <div className="benchmark-legend">
              <span>
                <i className="legend-dot legend-ecdsa" /> ECDSA
              </span>
              <span>
                <i className="legend-dot legend-mldsa" /> ML-DSA-65
              </span>
            </div>
            <div className="metric-bars">
              <MetricBar
                label="Key generation"
                ecdsa={result.ecdsa.keygen_avg_ms}
                mldsa={result.mldsa.keygen_avg_ms}
              />
              <MetricBar
                label="Signing"
                ecdsa={result.ecdsa.sign_avg_ms}
                mldsa={result.mldsa.sign_avg_ms}
              />
              <MetricBar
                label="Verification"
                ecdsa={result.ecdsa.verify_avg_ms}
                mldsa={result.mldsa.verify_avg_ms}
              />
            </div>
          </div>

          <div className="benchmark-grid">
            {[
              { key: 'ecdsa', title: 'ECDSA', detail: 'secp256k1', tone: 'amber' },
              { key: 'mldsa', title: 'ML-DSA-65', detail: 'FIPS 204', tone: 'green' },
            ].map((algorithm) => {
              const data = result[algorithm.key];
              return (
                <section className="panel" key={algorithm.key}>
                  <div className="panel-head">
                    <div>
                      <div className="eyebrow">{algorithm.detail}</div>
                      <h2>{algorithm.title}</h2>
                    </div>
                    <Badge tone={algorithm.tone}>{algorithm.title}</Badge>
                  </div>
                  <dl className="benchmark-list">
                    <div>
                      <dt>Key generation</dt>
                      <dd>{formatMs(data.keygen_avg_ms)}</dd>
                    </div>
                    <div>
                      <dt>Signing</dt>
                      <dd>{formatMs(data.sign_avg_ms)}</dd>
                    </div>
                    <div>
                      <dt>Verification</dt>
                      <dd>{formatMs(data.verify_avg_ms)}</dd>
                    </div>
                    <div>
                      <dt>Public key</dt>
                      <dd>{data.key_size_bytes} bytes</dd>
                    </div>
                    <div>
                      <dt>Signature</dt>
                      <dd>{data.signature_size_bytes} bytes</dd>
                    </div>
                  </dl>
                  <div
                    className={`benchmark-correctness ${
                      data.correctness_ok ? 'ok' : 'bad'
                    }`}
                  >
                    {data.correctness_ok ? (
                      <CheckCircle2 size={15} />
                    ) : (
                      <AlertTriangle size={15} />
                    )}
                    {data.correctness_ok
                      ? 'Signatures verify correctly'
                      : 'Correctness check failed'}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      ) : (
        <div className="panel">
          <p className="muted">No benchmark results yet. Run one above.</p>
        </div>
      )}
    </div>
  );
}
