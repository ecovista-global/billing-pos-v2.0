import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Smartphone, Receipt, IndianRupee, Building2, User, Eye } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import StatCard from '../../components/ui/StatCard';
import InvoiceModal from '../../components/invoice/InvoiceModal';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      try {
        const res = await apiFetch('/dashboard');
        if (res.success) setData(res);
      } catch (e) {
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  const viewInvoice = async (id) => {
    try {
      const res = await apiFetch(`/sales/${id}`);
      if (res.success) setSelectedInvoice(res);
    } catch (e) {}
  };

  const today = data?.today || {};
  const inventory = data?.inventory || {};

  return (
    <div className="space-y-6">
      {}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-800 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-xs rounded-full text-[11px] font-bold tracking-wide uppercase mb-2">
            🏬 {user?.store_name} ({user?.store_code})
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Welcome, {user?.full_name}
          </h1>
          <p className="text-emerald-100 text-xs sm:text-sm mt-1 max-w-lg">
            Ready for retail operations. Fast checkout, warranty activations, and instant inventory lookups for your physical store.
          </p>
        </div>

        <button
          onClick={() => navigate('/employee/pos')}
          className="px-6 py-3.5 bg-white hover:bg-emerald-50 text-emerald-900 rounded-2xl text-xs sm:text-sm font-extrabold shadow-md hover:shadow-xl transition active:scale-95 flex items-center gap-2 shrink-0"
        >
          <ShoppingBag className="w-5 h-5 text-emerald-700" />
          <span>Launch POS & Billing</span>
        </button>
      </div>

      {}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Today's Store Sales"
          value={formatCurrency(today.today_revenue || 0)}
          subtitle={`${today.today_phones_sold || 0} phones sold today`}
          icon={IndianRupee}
          color="emerald"
        />
        <StatCard
          title="Available Phones In Store"
          value={`${inventory.available_phones || 0} Units`}
          subtitle="Ready in showroom display"
          icon={Smartphone}
          color="blue"
        />
        <StatCard
          title="Total Store Revenue"
          value={formatCurrency(data?.overview?.total_revenue || 0)}
          subtitle={`${data?.overview?.total_sales_count || 0} lifetime invoices`}
          icon={Receipt}
          color="purple"
        />
        <StatCard
          title="In Transit to Store"
          value={`${inventory.in_transit_phones || 0} Devices`}
          subtitle="Incoming stock transfers"
          icon={Building2}
          color="amber"
        />
      </div>

      {}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-sm text-slate-900">Recent Invoices Billed At This Store</h3>
            <p className="text-xs text-slate-500">Live transaction history</p>
          </div>
          <button
            onClick={() => navigate('/employee/sales')}
            className="text-xs font-bold text-emerald-600 hover:underline"
          >
            View Full Sales History ➔
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {data?.recentSales && data.recentSales.slice(0, 6).map(sale => (
            <div key={sale.id} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 px-2 rounded-lg transition">
              <div>
                <div className="font-bold text-slate-900 flex items-center gap-2">
                  <span className="font-mono text-emerald-700">{sale.invoice_number}</span>
                  <span className="text-slate-300">•</span>
                  <span>{sale.customer_name}</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {formatDateTime(sale.sale_date)}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-extrabold text-slate-900">
                  {formatCurrency(sale.grand_total)}
                </span>
                <button
                  onClick={() => viewInvoice(sale.id)}
                  className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                  title="View & Print Bill"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedInvoice && (
        <InvoiceModal
          invoiceData={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}
