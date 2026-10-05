import React, { useState, useEffect } from 'react';
import {
  Zap, AlertTriangle, CheckCircle2, RefreshCw,
  Store, User, Receipt, Package, IndianRupee, X
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

function formatCurrency(val) {
  return `₹${(parseFloat(val) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

function formatDate(dt) {
  if (!dt) return '-';
  return new Date(dt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function QuickBillsReconciliation() {
  const { isAdmin } = useAuth();
  const [quickBills, setQuickBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reconcileTarget, setReconcileTarget] = useState(null);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [reconcileNotes, setReconcileNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const loadQuickBills = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/sales/quick-bills');
      if (res.success) setQuickBills(res.quick_bills || []);
      else setError(res.message || 'Failed to load quick bills.');
    } catch (e) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadQuickBills(); }, []);

  const handleReconcile = async () => {
    if (!reconcileTarget) return;
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch(`/sales/quick-bills/${reconcileTarget.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          purchase_price: parseFloat(purchasePrice),
          notes: reconcileNotes
        })
      });
      if (res.success) {
        setSuccessMsg(res.message);
        setReconcileTarget(null);
        setPurchasePrice('');
        setReconcileNotes('');
        loadQuickBills();
      } else {
        setError(res.message || 'Failed to reconcile.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-2xl flex items-center justify-center shadow">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900">Quick Bill Reconciliation</h1>
            <p className="text-xs text-slate-500">Items billed without inventory entry — update purchase cost here</p>
          </div>
        </div>
        <button onClick={loadQuickBills} className="p-2 rounded-xl hover:bg-slate-100 transition" title="Refresh">
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* Warning Banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800">
          <p className="font-bold mb-1">Purchase Cost Pending — Profit/Loss Calculations May Be Inaccurate</p>
          <p>These items were billed via Quick Bill without a purchase cost entry. Please enter the actual purchase price to complete reconciliation and get accurate profit figures.</p>
        </div>
      </div>

      {/* Success Message */}
      {successMsg && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl px-4 py-3 mb-4">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMsg}
          <button onClick={() => setSuccessMsg('')} className="ml-auto"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 mb-4">{error}</div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-sm text-slate-500">Loading quick bills...</div>
      ) : quickBills.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-emerald-200">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">All Caught Up!</p>
          <p className="text-xs text-slate-500 mt-1">No pending Quick Bills to reconcile.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quickBills.map(item => {
            const margin = item.sellingPrice - item.unitCost;
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-4">
                    {/* Quick Bill Badge */}
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                      <Zap className="w-5 h-5 text-amber-600" />
                    </div>

                    {/* Item Info */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{item.brand} {item.model}</span>
                        {item.variant && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-medium">{item.variant}</span>}
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold uppercase">Quick Bill</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1"><Receipt className="w-3 h-3" /> {item.sale?.invoiceNumber}</span>
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {item.sale?.customer?.fullName}</span>
                        <span className="flex items-center gap-1"><Store className="w-3 h-3" /> {item.sale?.store?.name}</span>
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Prices */}
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-[10px] text-slate-400 mb-0.5">Selling Price</p>
                      <p className="text-sm font-black text-emerald-700">{formatCurrency(item.sellingPrice)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 mb-0.5">Purchase Cost</p>
                      <p className="text-sm font-black text-rose-500">{formatCurrency(item.unitCost)} <span className="text-[9px] text-rose-400">(pending)</span></p>
                    </div>
                    <button
                      onClick={() => { setReconcileTarget(item); setPurchasePrice(''); setReconcileNotes(''); }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition shadow-sm"
                    >
                      <IndianRupee className="w-3.5 h-3.5" />
                      Update Cost
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reconcile Modal */}
      {reconcileTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-100">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Reconcile Purchase Cost</h3>
                <p className="text-[11px] text-slate-500">{reconcileTarget.brand} {reconcileTarget.model} — Invoice {reconcileTarget.sale?.invoiceNumber}</p>
              </div>
              <button onClick={() => setReconcileTarget(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-slate-400 mb-1">Sold For</p>
                  <p className="font-black text-emerald-700 text-base">{formatCurrency(reconcileTarget.sellingPrice)}</p>
                </div>
                <div className="bg-amber-50 p-3 rounded-xl">
                  <p className="text-amber-500 mb-1">Billed Date</p>
                  <p className="font-bold text-slate-700">{formatDate(reconcileTarget.createdAt)}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Actual Purchase Price (₹) *</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Enter the cost you paid for this device"
                  value={purchasePrice}
                  onChange={e => setPurchasePrice(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none font-mono"
                  autoFocus
                />
                {purchasePrice && parseFloat(purchasePrice) > 0 && (
                  <p className={`mt-1.5 text-[11px] font-bold ${reconcileTarget.sellingPrice - parseFloat(purchasePrice) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    Profit / Loss: {formatCurrency(Math.abs(reconcileTarget.sellingPrice - parseFloat(purchasePrice)))} {reconcileTarget.sellingPrice - parseFloat(purchasePrice) >= 0 ? '✓ Profit' : '✗ Loss'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Notes <span className="font-normal text-slate-400">(optional)</span></label>
                <input
                  type="text"
                  placeholder="e.g. Purchased from XYZ supplier"
                  value={reconcileNotes}
                  onChange={e => setReconcileNotes(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-400 outline-none"
                />
              </div>

              {error && (
                <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl">{error}</p>
              )}
            </div>

            <div className="px-6 pb-5 flex items-center gap-3 justify-end border-t border-slate-100 pt-4">
              <button onClick={() => setReconcileTarget(null)} className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition">
                Cancel
              </button>
              <button
                onClick={handleReconcile}
                disabled={saving || !purchasePrice || parseFloat(purchasePrice) <= 0}
                className="flex items-center gap-1.5 px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition"
              >
                {saving ? 'Saving...' : 'Confirm & Reconcile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
