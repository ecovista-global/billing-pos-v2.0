import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StoreProvider } from './context/StoreContext';

import Layout from './components/layout/Layout';
import Login from './pages/auth/Login';

// Admin Pages
import Dashboard from './pages/admin/Dashboard';
import Stores from './pages/admin/Stores';
import Employees from './pages/admin/Employees';
import Inventory from './pages/admin/Inventory';
import Purchases from './pages/admin/Purchases';
import Transfers from './pages/admin/Transfers';
import POS from './pages/admin/POS';
import Customers from './pages/admin/Customers';
import Invoices from './pages/admin/Invoices';
import Returns from './pages/admin/Returns';
import Warranties from './pages/admin/Warranties';
import Expenses from './pages/admin/Expenses';
import ProfitLoss from './pages/admin/ProfitLoss';
import Reports from './pages/admin/Reports';
import AuditLogs from './pages/admin/AuditLogs';
import Settings from './pages/admin/Settings';
import ExchangedPhones from './pages/admin/ExchangedPhones';
import Accessories from './pages/admin/Accessories';

// Employee Pages
import EmployeeDashboard from './pages/employee/Dashboard';
import EmployeeProfile from './pages/employee/Profile';

function ProtectedRoute({ children, requireAdmin, moduleKey }) {
  const { user, loading, isAdmin, canAccess } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/employee/dashboard" replace />;
  }

  // If route is restricted by administrator for this employee
  if (moduleKey && !isAdmin && canAccess && !canAccess(moduleKey)) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4 sm:p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center space-y-4 animate-in fade-in zoom-in duration-150">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 mx-auto flex items-center justify-center shadow-xs">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 uppercase tracking-wider mb-2">
              Access Restricted
            </span>
            <h2 className="text-lg font-extrabold text-slate-900">Module Access Blocked</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Your administrator has restricted your staff account from opening this portal section. If you believe this is a mistake, please contact your store manager.
            </p>
          </div>
          <div className="pt-2">
            <a
              href="/employee/dashboard"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs"
            >
              Return to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return children;
}

function RootRedirect() {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={isAdmin ? "/admin/dashboard" : "/employee/dashboard"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Protected Routes Wrapper */}
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<RootRedirect />} />

              {/* Admin Routes */}
              <Route path="admin/dashboard" element={<ProtectedRoute requireAdmin><Dashboard /></ProtectedRoute>} />
              <Route path="admin/stores" element={<ProtectedRoute requireAdmin><Stores /></ProtectedRoute>} />
              <Route path="admin/employees" element={<ProtectedRoute requireAdmin><Employees /></ProtectedRoute>} />
              <Route path="admin/inventory" element={<ProtectedRoute requireAdmin><Inventory /></ProtectedRoute>} />
              <Route path="admin/accessories" element={<ProtectedRoute requireAdmin><Accessories /></ProtectedRoute>} />
              <Route path="admin/purchases" element={<ProtectedRoute requireAdmin><Purchases /></ProtectedRoute>} />
              <Route path="admin/stock-entry" element={<ProtectedRoute requireAdmin><Purchases /></ProtectedRoute>} />
              <Route path="admin/transfers" element={<ProtectedRoute requireAdmin><Transfers /></ProtectedRoute>} />
              <Route path="admin/pos" element={<ProtectedRoute requireAdmin><POS /></ProtectedRoute>} />
              <Route path="admin/exchanged-phones" element={<ProtectedRoute requireAdmin><ExchangedPhones /></ProtectedRoute>} />
              <Route path="admin/customers" element={<ProtectedRoute requireAdmin><Customers /></ProtectedRoute>} />
              <Route path="admin/invoices" element={<ProtectedRoute requireAdmin><Invoices /></ProtectedRoute>} />
              <Route path="admin/returns" element={<ProtectedRoute requireAdmin><Returns /></ProtectedRoute>} />
              <Route path="admin/warranties" element={<ProtectedRoute requireAdmin><Warranties /></ProtectedRoute>} />
              <Route path="admin/expenses" element={<ProtectedRoute requireAdmin><Expenses /></ProtectedRoute>} />
              <Route path="admin/profit-loss" element={<ProtectedRoute requireAdmin><ProfitLoss /></ProtectedRoute>} />
              <Route path="admin/reports" element={<ProtectedRoute requireAdmin><Reports /></ProtectedRoute>} />
              <Route path="admin/audit-logs" element={<ProtectedRoute requireAdmin><AuditLogs /></ProtectedRoute>} />
              <Route path="admin/settings" element={<ProtectedRoute requireAdmin><Settings /></ProtectedRoute>} />

              {/* Employee Routes (Restricted by Module) */}
              <Route path="employee/dashboard" element={<ProtectedRoute moduleKey="dashboard"><EmployeeDashboard /></ProtectedRoute>} />
              <Route path="employee/pos" element={<ProtectedRoute moduleKey="pos"><POS /></ProtectedRoute>} />
              <Route path="employee/exchanged-phones" element={<ProtectedRoute moduleKey="exchanged_phones"><ExchangedPhones /></ProtectedRoute>} />
              <Route path="employee/inventory" element={<ProtectedRoute moduleKey="inventory"><Inventory /></ProtectedRoute>} />
              <Route path="employee/accessories" element={<ProtectedRoute moduleKey="accessories"><Accessories /></ProtectedRoute>} />
              <Route path="employee/stock-entry" element={<ProtectedRoute moduleKey="stock_entry"><Purchases /></ProtectedRoute>} />
              <Route path="employee/purchases" element={<ProtectedRoute moduleKey="stock_entry"><Purchases /></ProtectedRoute>} />
              <Route path="employee/customers" element={<ProtectedRoute moduleKey="customers"><Customers /></ProtectedRoute>} />
              <Route path="employee/sales" element={<ProtectedRoute moduleKey="sales"><Invoices /></ProtectedRoute>} />
              <Route path="employee/invoices" element={<ProtectedRoute moduleKey="invoices"><Invoices /></ProtectedRoute>} />
              <Route path="employee/returns" element={<ProtectedRoute moduleKey="returns"><Returns /></ProtectedRoute>} />
              <Route path="employee/warranty" element={<ProtectedRoute moduleKey="warranty"><Warranties /></ProtectedRoute>} />
              <Route path="employee/profile" element={<ProtectedRoute moduleKey="profile"><EmployeeProfile /></ProtectedRoute>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </StoreProvider>
    </AuthProvider>
  );
}
