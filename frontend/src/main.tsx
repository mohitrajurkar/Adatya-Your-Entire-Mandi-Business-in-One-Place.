import React, { StrictMode, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Farmers from './pages/Farmers';
import Purchases from './pages/Purchases';
import NewPurchase from './pages/NewPurchase';
import Invoice from './pages/Invoice';
import Login from './pages/Login';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Inventory from './pages/Inventory';
import AdminBusinesses from './pages/AdminBusinesses';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { isAuthenticated, getStoredUser } from './lib/api';
import './index.css';

function AuthGuard({ children }: { children: ReactNode }) {
  // Requires an actual access token. A cached "user" object alone used to be
  // enough, which anyone could fabricate in browser devtools. The token is
  // still verified server-side on every request.
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

/**
 * Keeps the admin portal out of an ordinary trader's way.
 *
 * This is presentation only: the server returns 403 for /api/admin/** to
 * anyone without the SUPER_ADMIN role, and that remains the real control.
 * Without this guard the page still rendered its shell with empty figures,
 * which looks broken rather than off-limits.
 */
function SuperAdminGuard({ children }: { children: ReactNode }) {
  if (getStoredUser()?.role !== 'SUPER_ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<AuthGuard><DashboardLayout /></AuthGuard>}>
              <Route index element={<Dashboard />} />
              <Route path="admin" element={<SuperAdminGuard><AdminBusinesses /></SuperAdminGuard>} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="farmers" element={<Farmers />} />
              <Route path="purchases" element={<Purchases />} />
              <Route path="purchases/new" element={<NewPurchase />} />
              <Route path="reports" element={<Reports />} />
              <Route path="profile" element={<Profile />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            {/* Invoice has no layout, just the printable view */}
            <Route path="/invoice/:id" element={<AuthGuard><Invoice /></AuthGuard>} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </LanguageProvider>
  </StrictMode>,
);
