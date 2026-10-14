import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';
import {
  LayoutDashboard,
  Store,
  Users,
  Smartphone,
  Truck,
  ArrowLeftRight,
  ReceiptText,
  FileSpreadsheet,
  RotateCcw,
  ShieldAlert,
  Wallet,
  TrendingUp,
  BarChart3,
  History,
  Settings,
  LogOut,
  UserCheck,
  ShoppingBag,
  Package,
  Activity,
  Globe
} from 'lucide-react';

export default function Sidebar({ isOpen, setIsOpen }) {
  const { user, logout, isAdmin, canAccess } = useAuth();
  const [storesCount, setStoresCount] = useState(null);
  const [quickBillsCount, setQuickBillsCount] = useState(null);
  const location = useLocation();

  useEffect(() => {
    if (isAdmin) {
      apiFetch('/stores')
        .then(res => {
          if (res.success && Array.isArray(res.stores)) {
            setStoresCount(res.stores.length);
          }
        })
        .catch(() => {});
        
      apiFetch('/sales/quick-bills')
        .then(res => {
          if (res.success && Array.isArray(res.quick_bills)) {
            setQuickBillsCount(res.quick_bills.length);
          }
        })
        .catch(() => {});
    }
  }, [isAdmin, location.pathname]);

  // Admin Nav items according to Section 28
  const adminNav = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { 
      label: storesCount !== null ? `Stores (${storesCount})` : 'Stores', 
      path: '/admin/stores', 
      icon: Store 
    },
    { label: 'Employees', path: '/admin/employees', icon: Users },
    { label: 'Inventory (IMEI)', path: '/admin/inventory', icon: Smartphone },
    { label: 'Accessories (New)', path: '/admin/accessories', icon: Package },
    { label: 'Stock Entry', path: '/admin/stock-entry', icon: Truck },
    { label: 'Stock Transfers', path: '/admin/transfers', icon: ArrowLeftRight },
    { label: 'POS / New Sale', path: '/admin/pos', icon: ShoppingBag, highlight: true },
    { label: 'Exchanged Phones', path: '/admin/exchanged-phones', icon: ArrowLeftRight },
    { label: 'Customers', path: '/admin/customers', icon: Users },
    { label: 'Invoices & Bills', path: '/admin/invoices', icon: ReceiptText },
    { label: 'Returns & Refunds', path: '/admin/returns', icon: RotateCcw },
    { label: 'Warranty Check', path: '/admin/warranties', icon: ShieldAlert },
    { label: 'Expenses', path: '/admin/expenses', icon: Wallet },
    { label: 'Profit & Loss', path: '/admin/profit-loss', icon: TrendingUp },
    { label: 'Business Reports', path: '/admin/reports', icon: BarChart3 },
    { label: 'Bill Reconciliation', path: '/admin/quick-bills', icon: Activity, badge: quickBillsCount > 0 ? quickBillsCount : null },
    { label: 'Online Orders & App', path: '/admin/online-orders', icon: Globe },
    { label: 'Audit Logs', path: '/admin/audit-logs', icon: History },
    { label: 'Company Settings', path: '/admin/settings', icon: Settings },
  ];

  // Employee Nav items according to Section 29 with moduleKey for permission checking
  const employeeNav = [
    { label: 'Dashboard', path: '/employee/dashboard', icon: LayoutDashboard, moduleKey: 'dashboard' },
    { label: 'POS / New Sale', path: '/employee/pos', icon: ShoppingBag, highlight: true, moduleKey: 'pos' },
    { label: 'Exchanged Phones', path: '/employee/exchanged-phones', icon: ArrowLeftRight, moduleKey: 'exchanged_phones' },
    { label: 'Store Inventory', path: '/employee/inventory', icon: Smartphone, moduleKey: 'inventory' },
    { label: 'Accessories', path: '/employee/accessories', icon: Package, moduleKey: 'accessories' },
    { label: 'Stock Entry', path: '/employee/stock-entry', icon: Truck, moduleKey: 'stock_entry' },
    { label: 'Customers', path: '/employee/customers', icon: Users, moduleKey: 'customers' },
    { label: 'Sales History', path: '/employee/sales', icon: FileSpreadsheet, moduleKey: 'sales' },
    { label: 'Invoices & Bills', path: '/employee/invoices', icon: ReceiptText, moduleKey: 'invoices' },
    { label: 'Returns', path: '/employee/returns', icon: RotateCcw, moduleKey: 'returns' },
    { label: 'Warranty Check', path: '/employee/warranty', icon: ShieldAlert, moduleKey: 'warranty' },
    { label: 'My Profile', path: '/employee/profile', icon: UserCheck, moduleKey: 'profile' },
  ];

  // If employee has a module blocked, hide it from navigation
  const allowedEmployeeNav = employeeNav.filter(item => !canAccess || canAccess(item.moduleKey));

  const navItems = isAdmin ? adminNav : allowedEmployeeNav;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)} 
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Main Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white text-slate-800 flex flex-col
        transition-transform duration-300 ease-in-out border-r border-slate-200/90 shadow-sm
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo and Brand */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/80 p-1 flex items-center justify-center shadow-xs shrink-0">
            <img 
              src="/logo.png" 
              alt="Ecofone Logo" 
              className="w-full h-full object-contain"
              onError={(e) => { e.target.src = 'https://placehold.co/100x100?text=EF'; }}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-slate-900">EcoFone</span>
              <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">POS</span>
            </div>
            <p className="text-[11px] text-amber-600 font-medium tracking-wide">Luxury within reach</p>
          </div>
        </div>

        {/* User Info Bar */}
        <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs"></div>
            <div className="text-xs truncate font-semibold text-slate-800">
              {isAdmin ? (user?.full_name?.includes('Gaurav') ? 'CEO' : 'Super Admin') : user?.store_code || 'Store Employee'}
            </div>
          </div>
          <div className="text-[11px] text-slate-500 truncate mt-0.5 font-normal">
            {user?.full_name || (isAdmin ? 'Central Administration' : user?.store_name)}
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150
                  ${item.highlight ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold shadow-xs hover:from-emerald-700 hover:to-teal-700' : ''}
                  ${!item.highlight && isActive 
                    ? 'bg-emerald-50 text-emerald-700 font-semibold border-l-2 border-emerald-600' 
                    : !item.highlight && 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'}
                `}
              >
                <Icon className={`w-4 h-4 shrink-0 ${item.highlight ? 'text-white' : ''}`} />
                <span className="truncate flex-1">{item.label}</span>
                {item.badge && (
                  <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-[20px] text-center shrink-0">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/30">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
