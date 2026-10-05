import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, ShieldAlert, CheckCircle2, Clock, AlertCircle, Smartphone, Building2 } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { formatDate } from '../../utils/formatters';

export default function Warranties() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [allWarranties, setAllWarranties] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    async function loadWarranties() {
      setLoading(true);
      try {
        const res = await apiFetch('/warranties');
        if (res.success) setAllWarranties(res.warranties || []);
      } catch (e) {
      } finally {
        setLoading(false);
      }
    }
    loadWarranties();
  }, []);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setHasSearched(true);
    try {
      const res = await apiFetch(`/warranties/check?query=${encodeURIComponent(searchQuery.trim())}`);
      if (res.success) {
        setResults(res.warranties || []);
      } else {
        setResults([]);
      }
    } catch (e) {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const displayList = hasSearched ? results : allWarranties;

  return (
    <div className="space-y-5">
      {}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            Ecofone Certified Warranty Verification
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Instant 6-Month warranty coverage status by device IMEI, invoice number, or customer mobile
          </p>
        </div>
      </div>

      {/* Search Bar Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">Check Device Warranty Coverage</h3>
        <form onSubmit={handleSearch} className="flex gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              placeholder="Enter 15-digit IMEI, Invoice # (e.g. ECO-2026-000001), or customer phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-xs"
          >
            {searching ? 'Checking...' : 'Verify Status'}
          </button>
        </form>
      </div>

      {}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            {hasSearched ? `Search Results (${results.length})` : `All Active Device Warranties (${allWarranties.length})`}
          </span>
          {hasSearched && (
            <button
              onClick={() => { setHasSearched(false); setSearchQuery(''); }}
              className="text-xs text-emerald-600 font-semibold hover:underline"
            >
              Reset to All
            </button>
          )}
        </div>

        {displayList.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <ShieldAlert className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700 text-sm">No warranty record found</p>
            <p className="mt-0.5">Please check that the IMEI or invoice number was entered correctly.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-4">Smartphone Model</th>
                  <th className="py-3 px-3">Device IMEI</th>
                  <th className="py-3 px-3">Customer & Phone</th>
                  <th className="py-3 px-3">Invoice #</th>
                  <th className="py-3 px-3">Coverage Period</th>
                  <th className="py-3 px-3 text-center">Remaining</th>
                  <th className="py-3 px-4 text-center">Warranty Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayList.map(w => {
                  const isActive = w.status === 'Active' || w.computed_status === 'Active';
                  return (
                    <tr key={w.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {w.brand} {w.model}
                        <span className="text-[11px] text-slate-500 font-normal block">{w.variant}</span>
                      </td>

                      <td className="py-3 px-3 font-mono text-emerald-800 font-bold">
                        {w.imei1}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-800">{w.customer_name}</div>
                        <div className="text-[11px] text-slate-400">{w.customer_phone}</div>
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-700 font-medium">
                        {w.invoice_number}
                      </td>

                      <td className="py-3 px-3 text-slate-600">
                        <div>{formatDate(w.start_date)} ➔ {formatDate(w.end_date)}</div>
                        <div className="text-[10px] text-slate-400">{w.warranty_period_months} Months Total</div>
                      </td>

                      <td className="py-3 px-3 text-center font-bold text-slate-800">
                        {w.days_remaining !== undefined ? `${w.days_remaining} Days` : '-'}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                          {isActive ? <CheckCircle2 className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                          {isActive ? 'COVERED / ACTIVE' : 'EXPIRED / VOID'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
