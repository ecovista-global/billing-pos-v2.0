import React, { useState, useEffect } from 'react';
import { Globe, RefreshCw, IndianRupee, Package, ChevronRight, Eye, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import InvoiceModal from '../../components/invoice/InvoiceModal';

export default function OnlineOrders() {
  const [orders, setOrders] = useState([]);
  const [reconcile, setReconcile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      let q = `/online/orders?page=${page}&limit=50`;
      if (search) q += `&search=${encodeURIComponent(search)}`;
      if (dateFrom) q += `&date_from=${dateFrom}`;
      if (dateTo) q += `&date_to=${dateTo}`;
      const res = await apiFetch(q);
      if (res.success) {
        setOrders(res.orders || []);
        setPagination(res.pagination);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchReconcile = async () => {
    setLoading(true);
    try {
      let q = `/online/reconcile?`;
      if (dateFrom) q += `&date_from=${dateFrom}`;
      if (dateTo) q += `&date_to=${dateTo}`;
      const res = await apiFetch(q);
      if (res.success) setReconcile(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'orders') fetchOrders();
    else fetchReconcile();
  }, [activeTab, page, dateFrom, dateTo]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  const viewInvoice = async (saleId) => {
    try {
      const res = await apiFetch(`/sales/${saleId}`);
      if (res.success) setSelectedInvoice(res);
    } catch (e) {}
  };

  const statusBadge = (status) => {
    if (status === 'COMPLETED') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle className="w-3 h-3" /> Completed
      </span>
    );
    if (status === 'VOID') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        <AlertCircle className="w-3 h-3" /> Voided
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
        <Clock className="w-3 h-3" /> {status}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            Online Orders & Razorpay Reconciliation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            All App/Website orders processed via Razorpay, auto-synced with POS invoices
          </p>
        </div>
        <button
          onClick={() => activeTab === 'orders' ? fetchOrders() : fetchReconcile()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {['orders', 'reconcile'].map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
              activeTab === tab
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab === 'orders' ? '📦 All Online Orders' : '🔄 Razorpay Reconciliation'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-end text-xs">
        {activeTab === 'orders' && (
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search invoice, customer, phone..."
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg w-64"
            />
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 cursor-pointer">
              Search
            </button>
          </form>
        )}
        <div className="flex items-center gap-2">
          <label className="font-semibold text-slate-600">From:</label>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <label className="font-semibold text-slate-600">To:</label>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg" />
        </div>
      </div>

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Item</th>
                  <th className="py-3 px-3">Razorpay ID</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        Loading online orders...
                      </div>
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No online orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-blue-700 text-[11px]">{order.invoice_number}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{formatDate(order.sale_date)}</td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{order.customer_name}</div>
                        <div className="text-slate-400 text-[10px]">{order.customer_phone}</div>
                      </td>
                      <td className="py-3 px-3">
                        {order.items?.[0] ? (
                          <div>
                            <div className="font-semibold text-slate-900">{order.items[0].brand} {order.items[0].model}</div>
                            <div className="text-slate-400 text-[10px]">IMEI: {order.items[0].imei1 || 'Pending'}</div>
                          </div>
                        ) : <span className="text-slate-400">-</span>}
                      </td>
                      <td className="py-3 px-3 font-mono text-[10px] text-slate-500">
                        {order.razorpay_payment_id || '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-slate-900 text-sm">
                        {formatCurrency(order.grand_total)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {statusBadge(order.status)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => viewInvoice(order.id)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="View Invoice"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-slate-50 cursor-pointer">← Prev</button>
                <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
                  className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-slate-50 cursor-pointer">Next →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reconciliation Tab */}
      {activeTab === 'reconcile' && (
        <div className="space-y-4">
          {/* Summary Cards */}
          {reconcile && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Online Orders', value: reconcile.summary.total_orders, icon: Package, color: 'blue' },
                { label: 'Total Collected (Razorpay)', value: formatCurrency(reconcile.summary.total_collected), icon: IndianRupee, color: 'emerald' },
                { label: 'Est. Razorpay Fee (2.36%)', value: formatCurrency(reconcile.summary.estimated_razorpay_fee), icon: AlertCircle, color: 'amber' },
                { label: 'Est. Net Settlement', value: formatCurrency(reconcile.summary.estimated_net_settlement), icon: CheckCircle, color: 'green' }
              ].map(card => (
                <div key={card.label} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  <div className={`text-[10px] uppercase font-bold text-slate-400`}>{card.label}</div>
                  <div className={`font-extrabold text-slate-900 text-base mt-0.5`}>{card.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Reconciliation Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">Razorpay Payment Ledger</h3>
              <p className="text-xs text-slate-500 mt-0.5">Match each Razorpay payment with its POS invoice for accounting reconciliation</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                    <th className="py-3 px-4">Razorpay Payment ID</th>
                    <th className="py-3 px-3">Invoice #</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Item</th>
                    <th className="py-3 px-3 text-right">Amount</th>
                    <th className="py-3 px-3 text-center">Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          Loading reconciliation data...
                        </div>
                      </td>
                    </tr>
                  ) : !reconcile?.records?.length ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">No reconciliation data found.</td>
                    </tr>
                  ) : (
                    reconcile.records.map((rec, i) => (
                      <tr key={i} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono text-[10px] text-blue-700">{rec.payment_id || '-'}</td>
                        <td className="py-3 px-3 font-mono font-bold text-emerald-700">{rec.invoice_number}</td>
                        <td className="py-3 px-3 text-slate-600">{formatDate(rec.payment_date)}</td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">{rec.customer_name}</div>
                          <div className="text-slate-400 text-[10px]">{rec.customer_phone}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-700">{rec.item}</td>
                        <td className="py-3 px-3 text-right font-extrabold text-slate-900">{formatCurrency(rec.amount)}</td>
                        <td className="py-3 px-3 text-center">
                          {rec.invoice_number ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle className="w-3 h-3" /> Matched
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertCircle className="w-3 h-3" /> Unmatched
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {selectedInvoice && (
        <InvoiceModal
          invoiceData={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}
