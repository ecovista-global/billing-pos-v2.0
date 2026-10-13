import React, { useState, useEffect } from 'react';
import { Wallet, Plus, Trash2, Building2, Calendar, Tag, X } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useStoreContext } from '../../context/StoreContext';
import { formatCurrency, formatDate } from '../../utils/formatters';

export default function Expenses() {
  const { user, isAdmin } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const { selectedStoreId } = useStoreContext();
  const [selectedCategory, setSelectedCategory] = useState('');

  // Add Modal
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    store_id: user?.assigned_store_id || '',
    category: 'Rent',
    description: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    receipt_number: '',
    notes: ''
  });

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      let q = '/expenses?';
      if (selectedStoreId) q += `&store_id=${selectedStoreId}`;
      if (selectedCategory) q += `&category=${encodeURIComponent(selectedCategory)}`;

      const [expRes, storeRes] = await Promise.all([
        apiFetch(q),
        apiFetch('/stores')
      ]);

      if (expRes.success) {
        setExpenses(expRes.expenses || []);
        setCategories(expRes.categorySummary || []);
      }
      if (storeRes.success) setStores(storeRes.stores || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [selectedStoreId, selectedCategory]);

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/expenses', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      if (res.success) {
        setShowModal(false);
        fetchExpenses();
        alert('Expense recorded successfully.');
      } else {
        alert(res.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense record?')) return;
    try {
      const res = await apiFetch(`/expenses/${id}`, { method: 'DELETE' });
      if (res.success) fetchExpenses();
    } catch (e) {}
  };

  const totalExpenseSum = expenses.reduce((a, b) => a + (b.amount || 0), 0);
  const currentStoreName = stores.find(s => String(s.id) === String(selectedStoreId))?.name;

  const displayCategories = React.useMemo(() => {
    const list = [...categories];
    const standardCategories = ['Rent', 'Marketing', 'Packaging', 'Electricity', 'Salaries', 'Transportation'];
    for (const name of standardCategories) {
      if (list.length >= 4) break;
      if (!list.some(c => c.category?.toLowerCase() === name.toLowerCase())) {
        list.push({ category: name, total_amount: 0 });
      }
    }
    return list.slice(0, 4);
  }, [categories]);

  return (
    <div className="space-y-5">
      {}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-600" />
            Operating Expenses Tracker
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Log store showroom rent, utility bills, staff salaries, packaging, and logistics for true net P&L
          </p>
        </div>

        <button
          onClick={() => {
            setFormData(prev => ({
              ...prev,
              store_id: selectedStoreId || user?.assigned_store_id || ''
            }));
            setShowModal(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Record Expense</span>
        </button>
      </div>

      {}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            {selectedStoreId ? (
              <span>Category Breakdown: <strong className="text-emerald-700">{currentStoreName || 'Selected Store'}</strong></span>
            ) : (
              <span className="text-slate-500">Category Breakdown — <strong className="text-slate-800">All Stores (Company-Wide)</strong></span>
            )}
          </span>
          {selectedStoreId && (
            <span className="text-[11px] text-emerald-600 font-semibold cursor-pointer">
              Store selected in header
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {displayCategories.map(cat => (
            <div key={cat.category} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">{cat.category}</span>
              <span className="font-extrabold text-slate-900 text-base mt-0.5 block">{formatCurrency(cat.total_amount)}</span>
            </div>
          ))}
        </div>
      </div>

      {}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">


            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border rounded-lg"
            >
              <option value="">All Categories</option>
              {['Rent', 'Electricity', 'Salaries', 'Marketing', 'Transportation', 'Repairs', 'Packaging', 'Internet', 'Other'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="text-right font-bold text-slate-900">
            Total Filtered: <span className="text-emerald-700 font-extrabold">{formatCurrency(totalExpenseSum)}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3">Store Branch</th>
                <th className="py-3 px-3 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Receipt / Ref</th>
                {isAdmin && <th className="py-3 px-3 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="py-12 text-center text-slate-400 font-medium">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading expense records...</span>
                    </div>
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="py-12 text-center text-slate-400 font-medium">
                    No expense records found.
                  </td>
                </tr>
              ) : (
                expenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {formatDate(exp.expense_date)}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-800">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] border">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900">
                      {exp.description}
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-medium">
                      {exp.store_name || 'Company HQ'}
                    </td>
                    <td className="py-3 px-3 text-right font-extrabold text-slate-900 text-sm">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-[10px] text-slate-400">
                      {exp.receipt_number || '-'}
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleDelete(exp.id)}
                          className="text-slate-400 hover:text-rose-600 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 text-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">Record Operational Expense</h3>
              <button onClick={() => setShowModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="font-bold text-slate-600 block mb-1">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                >
                  {['Rent', 'Electricity', 'Salaries', 'Marketing', 'Transportation', 'Repairs', 'Packaging', 'Internet', 'Other'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monthly rent for showroom"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Expense Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.expense_date}
                    onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                  />
                </div>
              </div>

              {isAdmin && (
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Assign to Store Branch</label>
                  <select
                    value={formData.store_id}
                    onChange={(e) => setFormData({ ...formData, store_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                  >
                    <option value="">Company-Wide / Central HQ</option>
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-600 block mb-1">Receipt / Voucher Number</label>
                <input
                  type="text"
                  placeholder="e.g. RCP-2026-99"
                  value={formData.receipt_number}
                  onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                />
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg"
                >
                  Log Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
