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
import './index.css';

function AuthGuard({ children }: { children: ReactNode }) {
  const user = localStorage.getItem('user');
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
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
              <Route path="admin" element={<AdminBusinesses />} />
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
