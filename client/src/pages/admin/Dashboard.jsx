import React, { useState, useEffect } from 'react';
import { 
  IndianRupee, 
  ShoppingBag, 
  Smartphone, 
  Store, 
  TrendingUp, 
  Wallet, 
  Receipt, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight,
  Building2,
  Calendar,
  Filter,
  Eye
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useStoreContext } from '../../context/StoreContext';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import StatCard from '../../components/ui/StatCard';
import InvoiceModal from '../../components/invoice/InvoiceModal';
import IMEILifecycleModal from '../../components/ui/IMEILifecycleModal';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { selectedStoreId, setSelectedStoreId, stores } = useStoreContext();
  const [period, setPeriod] = useState('all'); // 'today', 'yesterday', '7days', '30days', 'this_month', 'all', 'custom'
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortKey, setSortKey] = useState('revenue');
  const [sortDesc, setSortDesc] = useState(true);

  // Modals
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedIMEI, setSelectedIMEI] = useState(null);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      let url = `/dashboard?period=${period}&store_id=${selectedStoreId || ''}`;
      if (period === 'custom') {
        if (!startDate || !endDate) {
          setLoading(false);
          return;
        }
        url += `&start_date=${startDate}&end_date=${endDate}`;
      }
      const res = await apiFetch(url);
      if (res.success) {
        setData(res);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (period === 'custom' && (!startDate || !endDate)) return;
    fetchDashboard();
  }, [period, selectedStoreId, startDate, endDate]);

  const viewInvoice = async (saleId) => {
    try {
      const res = await apiFetch(`/sales/${saleId}?store_id=${selectedStoreId || ''}`);
      if (res.success) {
        setSelectedInvoice(res);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const storeComparisonList = [...(data?.storeComparison || [])].sort((a, b) => {
    const factor = sortDesc ? -1 : 1;
    return (a[sortKey] > b[sortKey] ? 1 : -1) * factor;
  });

  if (loading && !data) {
    return (
      <div className="py-24 text-center">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mb-3"></div>
        <p className="text-sm font-medium text-slate-500">Loading Ecofone Business Intelligence...</p>
      </div>
    );
  }

  const today = data?.today || {};
  const overview = data?.overview || {};
  const inventory = data?.inventory || {};

  return (
    <div className="space-y-6">
      
      {}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Executive Business Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time analytics across all active Ecofone smartphone retail stores in India
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-slate-400" />
            <select
              value={selectedStoreId || ''}
              onChange={(e) => setSelectedStoreId(e.target.value ? Number(e.target.value) : null)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 py-1.5 px-3 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="">All Stores (Consolidated)</option>
              {stores.filter(s => s.status !== 'archived').map(store => (
                <option key={store.id} value={store.id}>
                  {store.name} ({store.code})
                </option>
              ))}
            </select>
          </div>
        )}

        {}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: '7days', label: 'Last 7 Days' },
            { id: '30days', label: 'Last 30 Days' },
            { id: 'this_month', label: 'This Month' },
            { id: 'all', label: 'All Time' },
            { id: 'custom', label: 'Custom' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition ${period === p.id ? 'bg-white shadow-xs text-emerald-800 font-bold' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Picker */}
      {period === 'custom' && (
        <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-400" />
            <span className="text-sm font-semibold text-slate-700">Custom Date Range:</span>
          </div>
          <div className="flex items-center gap-3">
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <span className="text-slate-400 text-sm">to</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        </div>
      )}

      {}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Period Sales Revenue"
          value={formatCurrency(overview.total_revenue || 0)}
          subtitle={`${overview.total_sales_count || 0} customer invoices`}
          icon={IndianRupee}
          color="emerald"
        />
        <StatCard
          title="Phones Sold"
          value={`${overview.total_phones_sold || 0} Units`}
          subtitle="Certified refurbished"
          icon={Smartphone}
          color="blue"
        />
        <StatCard
          title="Gross Profit"
          value={formatCurrency(overview.total_profit || 0)}
          subtitle="True cost basis (Rule 8)"
          icon={TrendingUp}
          color="emerald"
        />
        <StatCard
          title="GST Tax Collected"
          value={formatCurrency(overview.total_tax || 0)}
          subtitle="CGST, SGST & IGST"
          icon={Receipt}
          color="purple"
        />
        <StatCard
          title="Available Inventory"
          value={`${inventory.available_phones || 0} Phones`}
          subtitle={`Valued at ${formatCurrency(inventory.total_inventory_cost || 0)}`}
          icon={Smartphone}
          color="amber"
        />
        <StatCard
          title="Active Stores"
          value={`${data?.activeStoresCount ?? (data?.storePerformance?.length || 1)} Outlets`}
          subtitle="Connected across India"
          icon={Store}
          color="slate"
        />
        <StatCard
          title="Today's Cashflow"
          value={formatCurrency(today.today_revenue || 0)}
          subtitle={`${today.today_phones_sold || 0} phones sold today`}
          icon={ShoppingBag}
          color="emerald"
        />
        <StatCard
          title="Pending Transfers"
          value={`${data?.pendingTransfers || 0} In Transit`}
          subtitle="Inter-store logistical stock"
          icon={AlertTriangle}
          color="rose"
        />
      </div>

      {}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600" />
              Store Performance & Inventory Comparison
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live multi-store ranking by sales revenue, gross margins, phones sold, and on-hand inventory
            </p>
          </div>

          <div className="text-xs text-slate-400 font-medium">
            Click column headers to sort highest / lowest
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3 px-4">Store Name</th>
                <th className="py-3 px-3">City</th>
                <th 
                  onClick={() => handleSort('sales_count')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-emerald-700 select-none"
                >
                  Invoices {sortKey === 'sales_count' && (sortDesc ? '▼' : '▲')}
                </th>
                <th 
                  onClick={() => handleSort('phones_sold')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-emerald-700 select-none"
                >
                  Phones Sold {sortKey === 'phones_sold' && (sortDesc ? '▼' : '▲')}
                </th>
                <th 
                  onClick={() => handleSort('revenue')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-emerald-700 select-none"
                >
                  Revenue {sortKey === 'revenue' && (sortDesc ? '▼' : '▲')}
                </th>
                <th 
                  onClick={() => handleSort('cost')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-emerald-700 select-none"
                >
                  COGS (Cost) {sortKey === 'cost' && (sortDesc ? '▼' : '▲')}
                </th>
                <th 
                  onClick={() => handleSort('profit')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-emerald-700 select-none font-bold text-emerald-800"
                >
                  Gross Profit {sortKey === 'profit' && (sortDesc ? '▼' : '▲')}
                </th>
                <th 
                  onClick={() => handleSort('inventory_count')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-emerald-700 select-none"
                >
                  Available Stock {sortKey === 'inventory_count' && (sortDesc ? '▼' : '▲')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {storeComparisonList.map((store, idx) => (
                <tr key={store.store_id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    <span>{store.store_name}</span>
                    <span className="text-[10px] font-mono text-slate-400 font-normal">({store.store_code})</span>
                  </td>
                  <td className="py-3.5 px-3 text-slate-600 font-medium">
                    {store.store_city}
                  </td>
                  <td className="py-3.5 px-3 text-right font-medium text-slate-700">
                    {store.sales_count}
                  </td>
                  <td className="py-3.5 px-3 text-right font-semibold text-slate-800">
                    {store.phones_sold}
                  </td>
                  <td className="py-3.5 px-3 text-right font-bold text-slate-900">
                    {formatCurrency(store.revenue)}
                  </td>
                  <td className="py-3.5 px-3 text-right text-slate-500 font-medium">
                    {formatCurrency(store.cost)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-extrabold text-emerald-700">
                    {formatCurrency(store.profit)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] ${store.inventory_count < 5 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                      {store.inventory_count} Devices
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Top Selling Smartphone Brands
            </h4>
            <span className="text-[10px] text-slate-400">By sales volume</span>
          </div>

          <div className="space-y-3">
            {data?.charts?.brandShare && data.charts.brandShare.map((b, i) => {
              const total = data.charts.brandShare.reduce((a, c) => a + c.count, 0) || 1;
              const pct = Math.round((b.count / total) * 100);
              return (
                <div key={b.brand} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-slate-800">{b.brand}</span>
                    <span className="text-slate-500 font-medium">{b.count} units ({formatCurrency(b.revenue)})</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${i === 0 ? 'bg-emerald-600' : i === 1 ? 'bg-teal-500' : i === 2 ? 'bg-blue-500' : 'bg-slate-400'}`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Recent Transactions Across Stores
            </h4>
            <span className="text-[10px] text-slate-400">Live invoices</span>
          </div>

          <div className="divide-y divide-slate-100">
            {data?.recentSales && data.recentSales.map(sale => (
              <div key={sale.id} className="py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 px-2 rounded-lg transition">
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="font-mono text-emerald-700">{sale.invoice_number}</span>
                    <span className="text-slate-300">•</span>
                    <span>{sale.customer_name}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {sale.store_name} • {formatDateTime(sale.sale_date)}
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

      </div>

      {}
      {selectedInvoice && (
        <InvoiceModal
          invoiceData={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}

      {}
      {selectedIMEI && (
        <IMEILifecycleModal
          imei={selectedIMEI}
          onClose={() => setSelectedIMEI(null)}
        />
      )}

    </div>
  );
}
