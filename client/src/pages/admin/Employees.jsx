import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Key, UserCheck, UserX, Phone, Mail, Building2, Eye, EyeOff, Copy, Check, X, ShieldAlert, ShieldCheck, Unlock } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import PermissionsModal from '../../components/employees/PermissionsModal';

const checkPasswordRequirements = (pw) => {
  const password = pw || '';
  return {
    minLength: password.length >= 8,
    hasNumber: /\d/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>\-_=+[\]\\/;'`~]/.test(password),
  };
};

const isPasswordValid = (pw) => {
  const reqs = checkPasswordRequirements(pw);
  return reqs.minLength && reqs.hasNumber && reqs.hasUpper && reqs.hasSpecial;
};

function PasswordHint({ password }) {
  const reqs = checkPasswordRequirements(password);
  return (
    <div className="mt-1.5 p-2 bg-slate-50 rounded-lg border border-slate-200 text-[11px] space-y-1">
      <div className="font-semibold text-slate-600 flex items-center justify-between">
        <span>Password requirements:</span>
        <span className="text-[10px] text-slate-400">Must satisfy all 4</span>
      </div>
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
        <div className={`flex items-center gap-1.5 ${reqs.minLength ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${reqs.minLength ? 'bg-emerald-100 text-emerald-700 font-bold' : 'bg-slate-200 text-slate-500'}`}>
            {reqs.minLength ? '✓' : '•'}
          </span>
          <span>At least 8 characters</span>
        </div>
        <div className={`flex items-center gap-1.5 ${reqs.hasUpper ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${reqs.hasUpper ? 'bg-emerald-100 text-emerald-700 font-bold' : 'bg-slate-200 text-slate-500'}`}>
            {reqs.hasUpper ? '✓' : '•'}
          </span>
          <span>1 uppercase letter (A-Z)</span>
        </div>
        <div className={`flex items-center gap-1.5 ${reqs.hasNumber ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${reqs.hasNumber ? 'bg-emerald-100 text-emerald-700 font-bold' : 'bg-slate-200 text-slate-500'}`}>
            {reqs.hasNumber ? '✓' : '•'}
          </span>
          <span>1 number (0-9)</span>
        </div>
        <div className={`flex items-center gap-1.5 ${reqs.hasSpecial ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] ${reqs.hasSpecial ? 'bg-emerald-100 text-emerald-700 font-bold' : 'bg-slate-200 text-slate-500'}`}>
            {reqs.hasSpecial ? '✓' : '•'}
          </span>
          <span>1 special char (!@#$...)</span>
        </div>
      </div>
    </div>
  );
}

export default function Employees() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Password Visibility States
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [viewPasswordModalUser, setViewPasswordModalUser] = useState(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [permissionsTargetEmp, setPermissionsTargetEmp] = useState(null);
  const [targetUser, setTargetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showResetPasswordInput, setShowResetPasswordInput] = useState(false);

  const togglePasswordVisibility = (id) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleCopyPassword = (id, password) => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    phone: '',
    email: '',
    address: '',
    role: 'employee',
    assigned_store_id: 1,
    status: 'active'
  });

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const [empRes, storeRes] = await Promise.all([
        apiFetch('/employees'),
        apiFetch('/stores')
      ]);
      if (empRes.success) setEmployees(empRes.employees || []);
      if (storeRes.success) setStores(storeRes.stores || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleToggleStatus = async (emp) => {
    if (emp.role === 'admin' && emp.id === user?.id) {
      alert('You cannot disable your own administrator account.');
      return;
    }
    const isCurrentlyActive = emp.status === 'active';
    const nextStatus = isCurrentlyActive ? 'inactive' : 'active';
    const actionVerb = isCurrentlyActive ? 'DISABLE' : 'ENABLE';

    const confirmAction = window.confirm(
      `Are you sure you want to ${actionVerb} this employee account?\n\n` +
      `Employee: ${emp.full_name} (${emp.username})\n` +
      `Role: ${emp.role === 'super_admin' ? 'CEO' : (emp.role === 'admin' ? 'Super Admin' : 'Store Staff')}\n` +
      `Branch: ${emp.store_name || 'Headquarters'}\n\n` +
      (isCurrentlyActive
        ? '⚠️ If disabled, this employee will be IMMEDIATELY blocked from logging in or making sales.'
        : '✅ If enabled, this employee will regain access to log in with their credentials.')
    );
    if (!confirmAction) return;

    try {
      const res = await apiFetch(`/employees/${emp.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.success) {
        fetchEmployees();
      } else {
        alert(res.message || 'Failed to update employee status.');
      }
    } catch (err) {
      alert(err.message || 'Error occurred while updating employee status.');
    }
  };

  const handleUnlock = async (emp) => {
    const confirmUnlock = window.confirm(
      `Are you sure you want to UNLOCK this employee account?\n\n` +
      `Employee: ${emp.full_name} (${emp.username})\n` +
      `This will immediately clear the 24-hour lockout and reset failed password attempts.`
    );
    if (!confirmUnlock) return;

    try {
      const res = await apiFetch(`/employees/${emp.id}/unlock`, { method: 'PATCH' });
      if (res.success) {
        alert(`Account for ${emp.username} has been unlocked successfully!`);
        fetchEmployees();
      } else {
        alert(res.message || 'Failed to unlock employee account.');
      }
    } catch (err) {
      alert(err.message || 'Error occurred while unlocking account.');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    if (!isPasswordValid(formData.password)) {
      alert('Password must be at least 8 characters long and contain at least 1 uppercase letter, 1 number, and 1 special character.');
      return;
    }

    if (formData.phone) {
      const cleanPhone = formData.phone.replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        alert('Phone number must be exactly 10 digits.');
        return;
      }
    }

    try {
      const res = await apiFetch('/employees', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          phone: formData.phone ? formData.phone.replace(/\D/g, '').slice(0, 10) : ''
        })
      });
      if (res.success) {
        setShowAddModal(false);
        setFormData({
          username: '',
          password: '',
          full_name: '',
          phone: '',
          email: '',
          address: '',
          role: 'employee',
          assigned_store_id: stores[0]?.id || 1,
          status: 'active'
        });
        fetchEmployees();
        alert('Employee created successfully!');
      } else {
        alert(res.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!isPasswordValid(newPassword)) {
      alert('Password must be at least 8 characters long and contain at least 1 uppercase letter, 1 number, and 1 special character.');
      return;
    }

    try {
      const res = await apiFetch(`/employees/${targetUser.id}/reset-password`, {
        method: 'PATCH',
        body: JSON.stringify({ new_password: newPassword })
      });
      if (res.success) {
        setShowResetModal(false);
        alert(`Password for ${targetUser.username} has been reset successfully.`);
      } else {
        alert(res.message || 'Failed to reset password');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const activeCount = employees.filter(e => e.status === 'active').length;
  const disabledCount = employees.filter(e => e.status !== 'active').length;

  const filteredEmployees = employees.filter(emp => {
    const matchSearch = emp.full_name.toLowerCase().includes(search.toLowerCase()) ||
                        emp.username.toLowerCase().includes(search.toLowerCase()) ||
                        emp.employee_id.toLowerCase().includes(search.toLowerCase());
    const matchStore = !selectedStore || emp.assigned_store_id === parseInt(selectedStore);
    const matchStatus = !selectedStatus || (selectedStatus === 'active' ? emp.status === 'active' : emp.status !== 'active');
    return matchSearch && matchStore && matchStatus;
  });

  return (
    <div className="space-y-5">
      {}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            Staff & Employee Management ({employees.length})
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Total: {employees.length}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Active: {activeCount}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              Disabled: {disabledCount}
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Employee</span>
        </button>
      </div>

      {}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search employee name, username, or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
          />
        </div>

        <select
          value={selectedStore}
          onChange={(e) => setSelectedStore(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
        >
          <option value="">All Stores</option>
          {stores.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
        >
          <option value="">All Statuses ({employees.length})</option>
          <option value="active">Active Only ({activeCount})</option>
          <option value="inactive">Disabled Only ({disabledCount})</option>
        </select>
      </div>

      {}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-3">Username & ID</th>
                <th className="py-3 px-3">
                  <div className="flex items-center gap-1.5">
                    <span>Password</span>
                    <button
                      type="button"
                      onClick={() => setShowAllPasswords(prev => !prev)}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border transition ${
                        showAllPasswords
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-white text-slate-500 border-slate-200 hover:text-slate-800'
                      }`}
                      title={showAllPasswords ? "Hide all passwords" : "Show all passwords"}
                    >
                      {showAllPasswords ? <EyeOff className="w-3 h-3 text-amber-700" /> : <Eye className="w-3 h-3" />}
                      <span>{showAllPasswords ? 'Hide All' : 'Show All'}</span>
                    </button>
                  </div>
                </th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Assigned Branch</th>
                <th className="py-3 px-3 text-right">Invoices Billed</th>
                <th className="py-3 px-3 text-right">Revenue Generated</th>
                <th className="py-3 px-3 text-center">Account Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.map(emp => (
                <tr
                  key={emp.id}
                  className={`transition ${emp.status !== 'active' ? 'bg-slate-50/70 opacity-80' : 'hover:bg-slate-50/70'}`}
                >
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                      <span>{emp.full_name}</span>
                      {emp.locked_until && new Date(emp.locked_until) > new Date() ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-rose-600" />
                          <span>Locked (24h)</span>
                        </span>
                      ) : (
                        emp.status !== 'active' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700">Disabled</span>
                        )
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400">{emp.phone} • {emp.email}</div>
                  </td>

                  <td className="py-3 px-3">
                    <span className="font-bold text-slate-800 font-mono">{emp.username}</span>
                    <span className="text-[10px] text-slate-400 block font-mono">{emp.employee_id}</span>
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs px-2 py-0.5 rounded border select-none bg-slate-100/70 text-slate-400 tracking-widest border-slate-200">
                        ••••••••
                      </span>
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    {emp.role === 'super_admin' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-indigo-50 text-indigo-700 border-indigo-200">
                        CEO / Super Admin
                      </span>
                    ) : emp.role === 'admin' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-purple-50 text-purple-700 border-purple-200">
                        Admin (Sub-Admin)
                      </span>
                    ) : (
                      <div className="space-y-1">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-slate-100 text-slate-700 border-slate-200 inline-block">
                          Store Staff
                        </span>
                        {(() => {
                          const perms = emp.permissions || {};
                          const allowedCount = Object.values(perms).filter(p => p.view !== false).length;
                          if (allowedCount === 12) {
                            return (
                              <span className="block text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 w-fit">
                                Full Access (12/12)
                              </span>
                            );
                          } else if (allowedCount === 0) {
                            return (
                              <span className="block text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200 w-fit">
                                Blocked (0/12)
                              </span>
                            );
                          } else {
                            return (
                              <span className="block text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 w-fit">
                                Custom ({allowedCount}/12)
                              </span>
                            );
                          }
                        })()}
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-3 font-medium text-slate-700">
                    {emp.store_name ? (
                      <div>
                        <span>{emp.store_name}</span>
                        <span className="text-[10px] text-slate-400 block">{emp.store_city} ({emp.store_code})</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Headquarters</span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-right font-semibold text-slate-700">
                    {emp.sales_count || 0}
                  </td>

                  <td className="py-3 px-3 text-right font-extrabold text-emerald-700">
                    {formatCurrency(emp.total_revenue || 0)}
                  </td>

                  <td className="py-3 px-3 text-center">
                    {emp.locked_until && new Date(emp.locked_until) > new Date() ? (
                      <button
                        type="button"
                        onClick={() => handleUnlock(emp)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 transition shadow-2xs cursor-pointer"
                        title="Account locked for 24h due to 3 wrong password attempts. Click to Unlock now."
                      >
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                        <span>Locked (24h)</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(emp)}
                        disabled={emp.role === 'admin' && emp.id === user?.id}
                        title={
                          emp.role === 'admin' && emp.id === user?.id
                            ? 'Cannot disable own admin account'
                            : emp.status === 'active'
                            ? 'Click to Disable Employee Account'
                            : 'Click to Enable Employee Account'
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition shadow-2xs ${
                          emp.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                        } ${emp.role === 'admin' && emp.id === user?.id ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            emp.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        ></span>
                        <span>{emp.status === 'active' ? 'Active' : 'Disabled'}</span>
                      </button>
                    )}
                  </td>

                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {}
                      {emp.locked_until && new Date(emp.locked_until) > new Date() && (
                        <button
                          type="button"
                          onClick={() => handleUnlock(emp)}
                          className="p-1.5 text-amber-700 hover:text-white hover:bg-amber-600 rounded-lg transition border border-amber-300 bg-amber-50 shadow-2xs"
                          title="Account is locked for 24h. Click to Unlock immediately."
                        >
                          <Unlock className="w-4 h-4" />
                        </button>
                      )}

                      {}
                      <button
                        onClick={() => handleToggleStatus(emp)}
                        disabled={emp.role === 'admin' && emp.id === user?.id}
                        className={`p-1.5 rounded-lg transition ${
                          emp.status === 'active'
                            ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                            : 'text-rose-600 hover:text-emerald-600 hover:bg-emerald-50'
                        } ${emp.role === 'admin' && emp.id === user?.id ? 'opacity-30 cursor-not-allowed' : ''}`}
                        title={emp.status === 'active' ? 'Disable Employee Account' : 'Enable Employee Account'}
                      >
                        {emp.status === 'active' ? (
                          <UserX className="w-4 h-4" />
                        ) : (
                          <UserCheck className="w-4 h-4" />
                        )}
                      </button>

                      {}
                      <button
                        onClick={() => setViewPasswordModalUser(emp)}
                        className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                        title="View Full Credentials & Password"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {}
                      <button
                        onClick={() => { setTargetUser(emp); setShowResetModal(true); }}
                        className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                        title="Reset Password"
                      >
                        <Key className="w-4 h-4" />
                      </button>

                      {}
                      {(emp.role === 'employee' || (emp.role === 'admin' && user?.is_super_admin)) && (
                        <button
                          onClick={() => {
                            setPermissionsTargetEmp(emp);
                            setShowPermissionsModal(true);
                          }}
                          className="p-1.5 text-emerald-600 hover:text-white hover:bg-emerald-600 rounded-lg transition border border-emerald-200 bg-emerald-50/60 shadow-2xs"
                          title="Manage Portal Permissions & Access Control"
                        >
                          <ShieldCheck className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-lg w-full p-6 text-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">Register New Staff Member</h3>
              <button onClick={() => setShowAddModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Phone (10 Digits)</label>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="10-digit mobile"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => {
                      const newRole = e.target.value;
                      setFormData({ 
                        ...formData, 
                        role: newRole,
                        assigned_store_id: (newRole === 'admin' || newRole === 'super_admin') ? null : (stores[0]?.id || 1)
                      });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                  >
                    <option value="employee">Store Employee</option>
                    <option value="admin">Admin (Sub-Admin)</option>
                    {user?.is_super_admin && <option value="super_admin">Super Admin / CEO</option>}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Initial Password *</label>
                <div className="relative">
                  <input
                    type={showCreatePassword ? "text" : "password"}
                    required
                    placeholder="Enter strong password..."
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-3 pr-10 py-2 bg-slate-50 border rounded-lg font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                    title={showCreatePassword ? "Hide password" : "View password 👁️"}
                  >
                    {showCreatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordHint password={formData.password} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Assigned Branch *</label>
                  <select
                    value={formData.assigned_store_id || ''}
                    onChange={(e) => setFormData({ ...formData, assigned_store_id: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                  >
                    {(formData.role === 'admin' || formData.role === 'super_admin') && (
                      <option value="">Headquarters / All Stores</option>
                    )}
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Initial Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                  >
                    <option value="active">Active (Enabled)</option>
                    <option value="inactive">Inactive (Disabled)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg"
                >
                  Create Staff Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {}
      {showResetModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 text-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Reset Password for {targetUser?.full_name}</h3>
            
            {}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Existing / Current Password:</span>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-slate-800 text-xs">
                  [Encrypted in Database]
                </span>
              </div>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="font-bold text-slate-600 block mb-1">New Password *</label>
                <div className="relative">
                  <input
                    type={showResetPasswordInput ? "text" : "password"}
                    required
                    placeholder="Enter new strong password..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 bg-slate-50 border rounded-lg font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPasswordInput(!showResetPasswordInput)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                    title={showResetPasswordInput ? "Hide password" : "View password 👁️"}
                  >
                    {showResetPasswordInput ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordHint password={newPassword} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-3 py-1.5 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {}
      {viewPasswordModalUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Account Credentials</h3>
                  <p className="text-[10px] text-slate-400">{viewPasswordModalUser.full_name}</p>
                </div>
              </div>
              <button
                onClick={() => setViewPasswordModalUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Username</span>
                <span className="font-mono font-bold text-slate-800 text-xs">{viewPasswordModalUser.username}</span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Employee ID</span>
                <span className="font-mono text-slate-700 text-xs">{viewPasswordModalUser.employee_id}</span>
              </div>

              <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">Active Password</span>
                  <span className="text-[9px] font-medium text-amber-700">Confidential</span>
                </div>
                <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-lg border border-amber-200">
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    [Encrypted]
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Branch</span>
                <span className="text-slate-700 font-medium text-xs">
                  {viewPasswordModalUser.store_name ? `${viewPasswordModalUser.store_name} (${viewPasswordModalUser.store_code})` : 'Central Headquarters'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const emp = viewPasswordModalUser;
                  setViewPasswordModalUser(null);
                  setTargetUser(emp);
                  setShowResetModal(true);
                }}
                className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 font-bold"
              >
                Change Password
              </button>
              <button
                type="button"
                onClick={() => setViewPasswordModalUser(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {showPermissionsModal && permissionsTargetEmp && (
        <PermissionsModal
          employee={permissionsTargetEmp}
          onClose={() => {
            setShowPermissionsModal(false);
            setPermissionsTargetEmp(null);
          }}
          onUpdated={(updatedPerms) => {
            setEmployees(prev => prev.map(e => e.id === permissionsTargetEmp.id ? { ...e, permissions: updatedPerms } : e));
          }}
        />
      )}
    </div>
  );
}
