import React, { useState, useEffect } from 'react';
import { RotateCcw, Plus, Search, AlertTriangle, CheckCircle, Smartphone, Receipt, X } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateTime, getStatusBadge } from '../../utils/formatters';

export default function Returns() {
  const { user, isAdmin } = useAuth();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    invoice_number: '',
    imei: '',
    reason: 'Functional Defect',
    refund_method: 'Original Payment Method',
    condition_received: 'Inspected with original box',
    notes: ''
  });

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/returns');
      if (res.success) setReturns(res.returns || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, []);

  const handleProcessReturn = async (e) => {
    e.preventDefault();
    const cleanImei = String(formData.imei || '').trim().replace(/\D/g, '');
    if (cleanImei.length !== 15) {
      alert('Device IMEI must be exactly 15 numeric digits.');
      return;
    }
    try {
      const res = await apiFetch('/returns', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          imei: cleanImei
        })
      });
      if (res.success) {
        setShowModal(false);
        fetchReturns();
        alert('Return processed successfully! Phone has been removed from sold state.');
      } else {
        alert(res.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-5">
      {}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-emerald-600" />
            Customer Returns & Refund Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Process device returns, warranty claims, defective replacements, and inventory status transitions
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>Process Return</span>
        </button>
      </div>

      {}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">Loading returns archive...</div>
        ) : returns.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <RotateCcw className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700 text-sm">No return records logged</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-4">Return #</th>
                  <th className="py-3 px-3">Original Invoice</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Branch Store</th>
                  <th className="py-3 px-3">Reason</th>
                  <th className="py-3 px-3 text-right">Refund Amount</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4">Processed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {returns.map(ret => {
                  const badge = getStatusBadge(ret.status);
                  return (
                    <tr key={ret.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-bold font-mono text-rose-700">
                        {ret.return_number}
                      </td>

                      <td className="py-3 px-3 font-mono font-medium text-emerald-800">
                        {ret.invoice_number}
                      </td>

                      <td className="py-3 px-3 font-medium text-slate-900">
                        <div>{ret.customer_name}</div>
                        <div className="text-[10px] text-slate-400">{ret.customer_phone}</div>
                      </td>

                      <td className="py-3 px-3 text-slate-700 font-medium">
                        {ret.store_name}
                      </td>

                      <td className="py-3 px-3 text-slate-600">
                        {ret.reason}
                      </td>

                      <td className="py-3 px-3 text-right font-extrabold text-slate-900 text-sm">
                        {formatCurrency(ret.refund_amount)}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${badge.bg}`}>
                          {ret.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-500">
                        <div>{ret.processed_by_name}</div>
                        <div className="text-[10px] text-slate-400">{formatDateTime(ret.return_date)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 text-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 text-rose-700">
                <RotateCcw className="w-4 h-4" />
                Process Device Return / Claim
              </h3>
              <button onClick={() => setShowModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <form onSubmit={handleProcessReturn} className="space-y-3">
              <div>
                <label className="font-bold text-slate-600 block mb-1">Invoice Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ECO-2026-000001"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-lg font-mono font-medium"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-600 block">Device IMEI *</label>
                  <span className="text-[10px] font-mono text-slate-500">
                    {formData.imei ? `${formData.imei.length}/15 digits` : '15 digits'}
                  </span>
                </div>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  maxLength={15}
                  placeholder="15-digit IMEI of the returned phone"
                  value={formData.imei}
                  onChange={(e) => setFormData({ ...formData, imei: e.target.value.replace(/\D/g, '').slice(0, 15) })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-lg font-mono font-medium"
                />
                {formData.imei && formData.imei.length === 15 && (
                  <span className="text-[10px] text-emerald-600 font-bold block mt-0.5">✓ Valid 15-digit IMEI</span>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Return Reason *</label>
                <select
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                >
                  <option value="Functional Defect">Functional Hardware Defect</option>
                  <option value="Battery Degradation">Battery Degradation / Overheating</option>
                  <option value="Cosmetic Mismatch">Cosmetic Grade Mismatch</option>
                  <option value="Customer Exchange">Customer Exchange Policy (7 Days)</option>
                  <option value="Warranty Claim">Certified Warranty Claim</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Refund / Settlement Method</label>
                <select
                  value={formData.refund_method}
                  onChange={(e) => setFormData({ ...formData, refund_method: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                >
                  <option value="Original Payment Method">Original Payment Method (UPI / Bank)</option>
                  <option value="Store Credit">Store Credit Voucher</option>
                  <option value="Replacement Device">Replacement Device Exchange</option>
                  <option value="Cash Refund">Cash Refund</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Condition When Received Back</label>
                <input
                  type="text"
                  placeholder="e.g. Scratched screen / Pristine condition / No water damage"
                  value={formData.condition_received}
                  onChange={(e) => setFormData({ ...formData, condition_received: e.target.value })}
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
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg"
                >
                  Approve & Refund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
