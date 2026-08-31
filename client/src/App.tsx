import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { TourProvider } from './components/Tour';
import { DashboardPage } from './pages/Dashboard';
import { InvoicePage } from './pages/Invoice';
import { JournalPage } from './pages/Journal';
import { SettingsPage } from './pages/Settings';
import { AboutPage } from './pages/About';
import './App.css';

export default function App() {
  return (
    <HashRouter>
      <TourProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="/" element={<Layout />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="invoice" element={<InvoicePage />} />
          <Route path="invoice/:id" element={<InvoicePage />} />
          <Route path="journal" element={<JournalPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="about" element={<AboutPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </TourProvider>
    </HashRouter>
  );
}
