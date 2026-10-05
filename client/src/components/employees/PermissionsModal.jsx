import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Lock,
  Unlock,
  Eye,
  Edit3,
  LayoutDashboard,
  ShoppingBag,
  ArrowLeftRight,
  Smartphone,
  Package,
  Truck,
  Users,
  FileSpreadsheet,
  ReceiptText,
  RotateCcw,
  Shield,
  UserCheck
} from 'lucide-react';
import { apiFetch } from '../../services/api';

// Metadata for all 12 modules in the Employee Portal
export const EMPLOYEE_MODULES = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Store daily performance metrics, sales stats, and quick actions',
    icon: LayoutDashboard,
    route: '/employee/dashboard',
    supportsEdit: false
  },
  {
    key: 'pos',
    label: 'POS / New Sale',
    description: 'Retail billing checkout, cash/UPI payment collection, and exchange valuation',
    icon: ShoppingBag,
    route: '/employee/pos',
    supportsEdit: true
  },
  {
    key: 'exchanged_phones',
    label: 'Exchanged Phones',
    description: 'Customer trade-in devices, IMEI grading, and exchange logbook',
    icon: ArrowLeftRight,
    route: '/employee/exchanged-phones',
    supportsEdit: true
  },
  {
    key: 'inventory',
    label: 'Store Inventory',
    description: 'Certified phone stock catalog with IMEIs, pricing, and specs',
    icon: Smartphone,
    route: '/employee/inventory',
    supportsEdit: true
  },
  {
    key: 'accessories',
    label: 'Accessories (New)',
    description: 'Brand-new 18% GST-inclusive accessories catalog and stock units',
    icon: Package,
    route: '/employee/accessories',
    supportsEdit: true
  },
  {
    key: 'stock_entry',
    label: 'Stock Entry',
    description: 'Intake and receiving of incoming phone and accessory shipments',
    icon: Truck,
    route: '/employee/stock-entry',
    supportsEdit: true
  },
  {
    key: 'customers',
    label: 'Customers Directory',
    description: 'Customer KYC details, contact records, and purchasing history',
    icon: Users,
    route: '/employee/customers',
    supportsEdit: true
  },
  {
    key: 'sales',
    label: 'Sales History',
    description: 'Store transaction logbook with cashier and payment method details',
    icon: FileSpreadsheet,
    route: '/employee/sales',
    supportsEdit: false
  },
  {
    key: 'invoices',
    label: 'Invoices & Bills',
    description: 'View customer tax invoices, reprint receipts, and share PDF bills',
    icon: ReceiptText,
    route: '/employee/invoices',
    supportsEdit: true
  },
  {
    key: 'returns',
    label: 'Returns & Refunds',
    description: 'Process device warranty replacements, repair claims, and customer returns',
    icon: RotateCcw,
    route: '/employee/returns',
    supportsEdit: true
  },
  {
    key: 'warranty',
    label: 'Warranty Check',
    description: 'Lookup 6-month certified warranty coverage and validity by IMEI',
    icon: Shield,
    route: '/employee/warranty',
    supportsEdit: false
  },
  {
    key: 'profile',
    label: 'My Profile',
    description: 'Employee personal information and store assignment credentials',
    icon: UserCheck,
    route: '/employee/profile',
    supportsEdit: true
  }
];

export const ADMIN_DELETE_MODULES = [
  { key: 'invoices', label: 'Permanent Delete Invoices' },
  { key: 'inventory', label: 'Delete Stock / Inventory' },
  { key: 'accessories', label: 'Delete Accessories' },
  { key: 'returns', label: 'Delete Returns Records' },
  { key: 'exchanged_phones', label: 'Delete Exchanged Phones' },
  { key: 'customers', label: 'Delete Customers' },
  { key: 'expenses', label: 'Delete Expenses' },
  { key: 'transfers', label: 'Delete Stock Transfers' }
];

export default function PermissionsModal({ employee, onClose, onUpdated }) {
  if (!employee) return null;

  // Initialize permissions state from employee record or full defaults
  const [permissions, setPermissions] = useState(() => {
    const initial = {};
    for (const mod of EMPLOYEE_MODULES) {
      const empMod = employee.permissions?.[mod.key] || {};
      initial[mod.key] = {
        view: empMod.view !== false,
        edit: mod.supportsEdit ? (empMod.edit !== false) : false
      };
    }
    return initial;
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Toggle View / Open Option
  const handleToggleView = (moduleKey) => {
    setPermissions(prev => {
      const current = prev[moduleKey] || { view: false, edit: false };
      const nextView = !current.view;
      return {
        ...prev,
        [moduleKey]: {
          view: nextView,
          edit: nextView ? current.edit : false
        }
      };
    });
    setSuccessMsg('');
  };

  // Toggle Edit Permission
  const handleToggleEdit = (moduleKey) => {
    setPermissions(prev => {
      const current = prev[moduleKey] || { view: false, edit: false };
      return {
        ...prev,
        [moduleKey]: {
          ...current,
          edit: !current.edit
        }
      };
    });
    setSuccessMsg('');
  };

  // Toggle Delete Permission (Admin Only)
  const handleToggleDelete = (moduleKey) => {
    setPermissions(prev => {
      const current = prev[moduleKey] || { view: true, edit: true, delete: false };
      return {
        ...prev,
        [moduleKey]: {
          ...current,
          delete: !current.delete
        }
      };
    });
    setSuccessMsg('');
  };

  // Quick Preset Handlers
  const applyPresetFull = () => {
    const full = {};
    for (const mod of EMPLOYEE_MODULES) {
      full[mod.key] = {
        view: true,
        edit: mod.supportsEdit ? true : false
      };
    }
    setPermissions(full);
    setSuccessMsg('Applied preset: Full Access to all modules.');
  };

  const applyPresetCashier = () => {
    const cashier = {};
    for (const mod of EMPLOYEE_MODULES) {
      if (['dashboard', 'pos', 'invoices', 'sales', 'customers'].includes(mod.key)) {
        cashier[mod.key] = {
          view: true,
          edit: mod.supportsEdit ? true : false
        };
      } else {
        cashier[mod.key] = { view: false, edit: false };
      }
    }
    setPermissions(cashier);
    setSuccessMsg('Applied preset: Cashier & Sales only.');
  };

  const applyPresetReadOnly = () => {
    const ro = {};
    for (const mod of EMPLOYEE_MODULES) {
      ro[mod.key] = {
        view: true,
        edit: false
      };
    }
    setPermissions(ro);
    setSuccessMsg('Applied preset: View Only (All edit actions restricted).');
  };

  const applyPresetBlockAll = () => {
    const blocked = {};
    for (const mod of EMPLOYEE_MODULES) {
      blocked[mod.key] = { view: false, edit: false };
    }
    setPermissions(blocked);
    setSuccessMsg('Applied preset: Block all modules.');
  };

  // Save changes via API
  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await apiFetch(`/employees/${employee.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions })
      });

      if (res.success) {
        setSuccessMsg(res.message || 'Permissions updated successfully!');
        if (onUpdated) onUpdated(res.permissions);
        setTimeout(() => {
          onClose();
        }, 700);
      } else {
        setError(res.message || 'Failed to save permissions.');
      }
    } catch (err) {
      setError(err.message || 'Network error while saving permissions.');
    } finally {
      setSaving(false);
    }
  };

  const accessibleCount = Object.values(permissions).filter(p => p.view).length;
  const editableCount = Object.values(permissions).filter(p => p.edit).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Portal Permissions & Access Control
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Staff: <span className="text-white font-semibold">{employee.full_name}</span> ({employee.username}) • Branch: {employee.store_name || 'Headquarters'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">Quick Presets:</span>
            <button
              type="button"
              onClick={applyPresetFull}
              className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold hover:bg-emerald-100 transition shadow-2xs cursor-pointer"
            >
              🟢 Grant Full Access
            </button>
            <button
              type="button"
              onClick={applyPresetCashier}
              className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-bold hover:bg-blue-100 transition shadow-2xs cursor-pointer"
            >
              🔵 Cashier / POS Only
            </button>
            <button
              type="button"
              onClick={applyPresetReadOnly}
              className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-bold hover:bg-amber-100 transition shadow-2xs cursor-pointer"
            >
              🟡 View Only All
            </button>
            <button
              type="button"
              onClick={applyPresetBlockAll}
              className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-bold hover:bg-rose-100 transition shadow-2xs cursor-pointer"
            >
              🔴 Block All
            </button>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="px-2 py-0.5 rounded-md bg-emerald-100/80 text-emerald-800 font-bold border border-emerald-200">
              {accessibleCount} of 12 Open
            </span>
            <span className="px-2 py-0.5 rounded-md bg-indigo-100/80 text-indigo-800 font-bold border border-indigo-200">
              {editableCount} Editable
            </span>
          </div>
        </div>

        {}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {EMPLOYEE_MODULES.map((mod) => {
              const Icon = mod.icon;
              const perm = permissions[mod.key] || { view: false, edit: false };
              const isBlocked = !perm.view;

              return (
                <div
                  key={mod.key}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isBlocked
                      ? 'bg-slate-50/80 border-slate-200 opacity-70'
                      : 'bg-white border-slate-200 shadow-2xs hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isBlocked
                          ? 'bg-slate-200 text-slate-500'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{mod.label}</span>
                          {isBlocked ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700">Blocked</span>
                          ) : (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">Allowed</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-1">{mod.description}</p>
                      </div>
                    </div>
                  </div>

                  {}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    {}
                    <button
                      type="button"
                      onClick={() => handleToggleView(mod.key)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition border cursor-pointer ${
                        perm.view
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                      }`}
                      title={perm.view ? 'Click to Block Option from Employee' : 'Click to Open Option for Employee'}
                    >
                      {perm.view ? <Unlock className="w-3 h-3 text-emerald-600" /> : <Lock className="w-3 h-3 text-slate-400" />}
                      <span>{perm.view ? 'Can Open' : 'Blocked'}</span>
                    </button>

                    {}
                    {mod.supportsEdit ? (
                      <button
                        type="button"
                        disabled={!perm.view}
                        onClick={() => handleToggleEdit(mod.key)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition border cursor-pointer ${
                          !perm.view
                            ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                            : perm.edit
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        }`}
                        title={!perm.view ? 'Open access must be enabled first' : (perm.edit ? 'Click to set View-Only mode' : 'Click to enable editing')}
                      >
                        {perm.edit ? <Edit3 className="w-3 h-3 text-indigo-600" /> : <Eye className="w-3 h-3 text-amber-600" />}
                        <span>{perm.edit ? 'Can Edit' : 'View Only'}</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic px-2">View-only module</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {employee.role === 'admin' && (
            <div className="mt-8 border-t border-slate-200 pt-6">
              <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                Advanced Delete Permissions (Admin Only)
              </h4>
              <p className="text-[11px] text-slate-500 mb-4">
                Grant specific delete privileges to this normal admin. Only grant these to highly trusted administrators.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {ADMIN_DELETE_MODULES.map(mod => {
                  const perm = permissions[mod.key] || {};
                  const canDelete = !!perm.delete;
                  return (
                    <div key={mod.key} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white">
                      <span className="text-xs font-bold text-slate-700">{mod.label}</span>
                      <button
                        type="button"
                        onClick={() => handleToggleDelete(mod.key)}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition ${
                          canDelete ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {canDelete ? 'Can Delete' : 'No Access'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-slate-500">
            Changes take effect immediately on employee's next page view or refresh.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-white transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <span>Saving Permissions...</span>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Save Permissions</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
