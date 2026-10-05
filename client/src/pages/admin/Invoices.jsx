import React, { useState, useEffect } from 'react';
import { Receipt, Search, Eye, Ban, Printer, Building2, Calendar, FileText, X, Trash2 } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateTime, getStatusBadge } from '../../utils/formatters';
import InvoiceModal from '../../components/invoice/InvoiceModal';

export default function Invoices() {
  const { user, isAdmin } = useAuth();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Selected Invoice Modal
  const [selectedInvoiceData, setSelectedInvoiceData] = useState(null);

  // Void Modal
  const [voidSale, setVoidSale] = useState(null);
  const [voidReason, setVoidReason] = useState('');

  const fetchSales = async () => {
    setLoading(true);
    try {
      let q = `/sales?page=${page}&limit=25`;
      if (search) q += `&search=${encodeURIComponent(search)}`;
      if (dateFrom) q += `&date_from=${dateFrom}`;
      if (dateTo) q += `&date_to=${dateTo}`;

      const res = await apiFetch(q);
      if (res.success) {
        setSales(res.sales || []);
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages || 1);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [page, dateFrom, dateTo]);

  const viewInvoice = async (id) => {
    try {
      const res = await apiFetch(`/sales/${id}`);
      if (res.success) {
        setSelectedInvoiceData(res);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleVoidInvoice = async (e) => {
    e.preventDefault();
    if (!voidSale) return;

    try {
      const res = await apiFetch(`/sales/${voidSale.id}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason: voidReason })
      });
      if (res.success) {
        setVoidSale(null);
        setVoidReason('');
        fetchSales();
        alert('Invoice successfully voided and inventory restored.');
      } else {
        alert(res.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteInvoice = async (sale) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete this Tax Invoice?\n\n` +
      `Invoice #: ${sale.invoice_number}\n` +
      `Customer: ${sale.customer_name || 'N/A'}\n` +
      `Amount: ${formatCurrency(sale.grand_total)}\n\n` +
      `This will completely remove the bill, payments, warranty, and sale records without restrictions.`
    );
    if (!confirmDelete) return;

    try {
      const res = await apiFetch(`/sales/${sale.id}`, {
        method: 'DELETE'
      });
      if (res.success) {
        alert(res.message || 'Invoice deleted permanently.');
        fetchSales();
      } else {
        alert(res.message || 'Failed to delete invoice.');
      }
    } catch (err) {
      alert(err.message || 'Error occurred while deleting invoice.');
    }
  };

  return (
    <div className="space-y-5">
      {}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            Tax Invoices & Billing Archive
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Sequential invoices, GST breakdown, printable bills, and transaction records
          </p>
        </div>
      </div>

      {}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search invoice number (e.g. ECO-2026-000001) or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchSales()}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
          />
        </div>
      </div>

      {}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">Loading billing archives...</div>
        ) : sales.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <Receipt className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700 text-sm">No invoices found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-3">Date & Time</th>
                  <th className="py-3 px-3">Customer</th>
                  <th className="py-3 px-3">Branch Store</th>
                  <th className="py-3 px-3 text-right">Taxable</th>
                  <th className="py-3 px-3 text-right">GST Tax</th>
                  <th className="py-3 px-3 text-right">Grand Total</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map(sale => {
                  const badge = getStatusBadge(sale.status);
                  return (
                    <tr key={sale.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-emerald-800">{sale.invoice_number}</span>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{sale.sale_number}</div>
                      </td>

                      <td className="py-3 px-3 text-slate-600 font-medium">
                        {formatDateTime(sale.sale_date)}
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{sale.customer_name}</div>
                        <div className="text-[11px] text-slate-400">{sale.customer_phone}</div>
                      </td>

                      <td className="py-3 px-3 font-medium text-slate-700">
                        {sale.store_name}
                      </td>

                      <td className="py-3 px-3 text-right text-slate-600 font-medium">
                        {formatCurrency(sale.taxable_amount)}
                      </td>

                      <td className="py-3 px-3 text-right text-slate-600 font-medium">
                        {formatCurrency(sale.total_tax)}
                      </td>

                      <td className="py-3 px-3 text-right font-extrabold text-slate-900 text-sm">
                        {formatCurrency(sale.grand_total)}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${badge.bg}`}>
                          {sale.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => viewInvoice(sale.id)}
                            className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                            title="View & Print Invoice"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isAdmin && sale.status === 'COMPLETED' && (
                            <button
                              onClick={() => setVoidSale(sale)}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                              title="Void Invoice"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}

                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteInvoice(sale)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Delete Bill Permanently"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {}
      {selectedInvoiceData && (
        <InvoiceModal
          invoiceData={selectedInvoiceData}
          onClose={() => setSelectedInvoiceData(null)}
        />
      )}

      {}
      {voidSale && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 text-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 text-rose-700 flex items-center gap-2">
              <Ban className="w-4 h-4" />
              Void Invoice #{voidSale.invoice_number}
            </h3>
            <p className="text-slate-600">
              Voiding this invoice will mark the financial record as VOID and immediately return all sold smartphones back into available stock.
            </p>

            <form onSubmit={handleVoidInvoice} className="space-y-3">
              <div>
                <label className="font-bold text-slate-600 block mb-1">Reason for voiding *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Customer billing error / Order cancellation"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVoidSale(null)}
                  className="px-3 py-1.5 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg"
                >
                  Confirm Void
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
