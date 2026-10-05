import React, { useState, useEffect } from 'react';
import { TrendingUp, IndianRupee, Wallet, Building2, Calendar, ArrowUpRight, ArrowDownRight, FileSpreadsheet } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import StatCard from '../../components/ui/StatCard';

export default function ProfitLoss() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchPL = async () => {
    setLoading(true);
    try {
      let q = '/reports/profit-loss?';
      if (selectedStore) q += `&store_id=${selectedStore}`;
      if (dateFrom) q += `&date_from=${dateFrom}`;
      if (dateTo) q += `&date_to=${dateTo}`;

      const [plRes, storeRes] = await Promise.all([
        apiFetch(q),
        apiFetch('/stores')
      ]);

      if (plRes.success) setData(plRes);
      if (storeRes.success) setStores(storeRes.stores || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPL();
  }, [selectedStore, dateFrom, dateTo]);

  const summary = data?.summary || {};

  return (
    <div className="space-y-6">
      {}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Profit & Loss Management (Rule 8)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            True stored cost accounting: Net Revenue - Total Cost of Goods Sold = Gross Profit - Operating Expenses = Net Profit
          </p>
        </div>

        {}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
          >
            <option value="">All Stores Combined</option>
            {stores.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Net Sales Revenue"
          value={formatCurrency(summary.netRevenue || 0)}
          subtitle={`${summary.phonesSold || 0} phones sold`}
          icon={IndianRupee}
          color="blue"
        />
        <StatCard
          title="Cost of Goods (COGS)"
          value={formatCurrency(summary.cogs || 0)}
          subtitle="Purchase + refurb + logistics"
          icon={Wallet}
          color="slate"
        />
        <StatCard
          title="Gross Profit"
          value={formatCurrency(summary.grossProfit || 0)}
          subtitle={`Gross Margin: ${summary.grossMargin || '0%'}`}
          icon={TrendingUp}
          color="emerald"
        />
        <StatCard
          title="Net Profit"
          value={formatCurrency(summary.netProfit || 0)}
          subtitle={`After ${formatCurrency(summary.totalExpenses || 0)} expenses`}
          icon={TrendingUp}
          color={summary.netProfit >= 0 ? 'emerald' : 'rose'}
        />
      </div>

      {}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200">
          <h3 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-600" />
            Store-Wise Profit & Loss Breakdown
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Individual profitability comparison across all physical branches
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3 px-4">Branch Store</th>
                <th className="py-3 px-3">City</th>
                <th className="py-3 px-3 text-right">Phones Sold</th>
                <th className="py-3 px-3 text-right">Net Revenue</th>
                <th className="py-3 px-3 text-right">Cost of Goods</th>
                <th className="py-3 px-3 text-right font-bold text-slate-800">Gross Profit</th>
                <th className="py-3 px-3 text-right text-rose-600">Store Expenses</th>
                <th className="py-3 px-3 text-right font-extrabold text-emerald-800">Net Profit</th>
                <th className="py-3 px-4 text-right">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.storePlTable && data.storePlTable.map(row => (
                <tr key={row.store_id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {row.store_name}
                    <span className="text-[10px] text-slate-400 font-mono block font-normal">{row.store_code}</span>
                  </td>
                  <td className="py-3 px-3 text-slate-600 font-medium">
                    {row.city}
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-slate-800">
                    {row.phones_sold}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900">
                    {formatCurrency(row.revenue)}
                  </td>
                  <td className="py-3 px-3 text-right text-slate-500 font-medium">
                    {formatCurrency(row.cost_of_goods)}
                  </td>
                  <td className="py-3 px-3 text-right font-bold text-emerald-700">
                    {formatCurrency(row.gross_profit)}
                  </td>
                  <td className="py-3 px-3 text-right text-rose-600 font-medium">
                    {formatCurrency(row.store_expenses)}
                  </td>
                  <td className="py-3 px-3 text-right font-extrabold text-emerald-800">
                    {formatCurrency(row.net_profit)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-700">
                    {row.margin}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Wallet className="w-4 h-4 text-emerald-600" />
          Operating Expenses Breakdown
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {data?.expensesByCategory && data.expensesByCategory.map(cat => (
            <div key={cat.category} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">
                {cat.category}
              </span>
              <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">
                {formatCurrency(cat.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
