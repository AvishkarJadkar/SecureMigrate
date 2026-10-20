import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { VaultProvider } from './context/VaultContext';
import AppLayout from './components/AppLayout';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import WalletsPage from './pages/WalletsPage';
import SendPage from './pages/SendPage';
import MigratePage from './pages/MigratePage';
import ActivityPage from './pages/ActivityPage';
import BenchmarkPage from './pages/BenchmarkPage';

function App() {
  return (
    <BrowserRouter>
      <VaultProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="wallets" element={<WalletsPage />} />
            <Route path="send" element={<SendPage />} />
            <Route path="migrate" element={<MigratePage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="benchmark" element={<BenchmarkPage />} />
          </Route>
          <Route path="/wallets" element={<Navigate to="/app/wallets" replace />} />
          <Route path="/send" element={<Navigate to="/app/send" replace />} />
          <Route path="/transactions" element={<Navigate to="/app/activity" replace />} />
          <Route path="/migrate" element={<Navigate to="/app/migrate" replace />} />
          <Route path="/benchmark" element={<Navigate to="/app/benchmark" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </VaultProvider>
    </BrowserRouter>
  );
}

export default App;
