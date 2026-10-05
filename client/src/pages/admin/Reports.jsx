import React, { useState, useEffect } from 'react';
import { BarChart3, FileSpreadsheet, Receipt, Users, Smartphone, Download, Calendar, Filter } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useStoreContext } from '../../context/StoreContext';
import { formatCurrency, formatDate } from '../../utils/formatters';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('sales'); // 'sales' | 'taxes' | 'employees' | 'inventory'
  const [salesData, setSalesData] = useState(null);
  const [taxData, setTaxData] = useState(null);
  const [employeeData, setEmployeeData] = useState([]);
  const [invData, setInvData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { selectedStoreId } = useStoreContext();

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    try {
      if (activeTab === 'sales') {
        let q = '/reports/sales?';
        if (dateFrom) q += `&date_from=${dateFrom}`;
        if (dateTo) q += `&date_to=${dateTo}`;
        if (selectedStoreId) q += `&store_id=${selectedStoreId}`;
        const res = await apiFetch(q);
        if (res.success) setSalesData(res);
      } else if (activeTab === 'taxes') {
        let q = '/reports/taxes?';
        if (dateFrom) q += `&date_from=${dateFrom}`;
        if (dateTo) q += `&date_to=${dateTo}`;
        if (selectedStoreId) q += `&store_id=${selectedStoreId}`;
        const res = await apiFetch(q);
        if (res.success) setTaxData(res);
      } else if (activeTab === 'employees') {
        const res = await apiFetch(`/reports/employee-performance?store_id=${selectedStoreId || ''}`);
        if (res.success) setEmployeeData(res.performance || []);
      } else if (activeTab === 'inventory') {
        const res = await apiFetch(`/inventory/stats?store_id=${selectedStoreId || ''}`);
        if (res.success) setInvData(res);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [activeTab, dateFrom, dateTo, selectedStoreId]);

  return (
    <div className="space-y-5">
      {}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            Business Intelligence & Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-ready reporting for sales turnover, GST filing, employee productivity, and inventory valuation
          </p>
        </div>

        {}
        <div className="flex items-center gap-2 text-xs">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border rounded-lg text-xs"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border rounded-lg text-xs"
          />
        </div>
      </div>

      {}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-bold">
        {[
          { id: 'sales', label: 'Sales & Turnovers', icon: FileSpreadsheet },
          { id: 'taxes', label: 'Tax & GST Filing', icon: Receipt },
          { id: 'employees', label: 'Employee Productivity', icon: Users },
          { id: 'inventory', label: 'Inventory Valuation', icon: Smartphone }
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition ${active ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">Generating report data...</div>
        ) : activeTab === 'sales' && salesData ? (
          <div className="space-y-6 text-xs">
            {}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border">
                <span className="text-slate-400 uppercase text-[10px] font-bold block">Gross Turnover</span>
                <span className="font-extrabold text-slate-900 text-base">{formatCurrency(salesData.totals?.grand_total || 0)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border">
                <span className="text-slate-400 uppercase text-[10px] font-bold block">Units Sold</span>
                <span className="font-extrabold text-slate-900 text-base">{salesData.totals?.total_units_sold || 0} Phones</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border">
                <span className="text-slate-400 uppercase text-[10px] font-bold block">Tax Collected</span>
                <span className="font-extrabold text-emerald-700 text-base">{formatCurrency(salesData.totals?.total_tax || 0)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border">
                <span className="text-slate-400 uppercase text-[10px] font-bold block">Total Invoices</span>
                <span className="font-extrabold text-slate-900 text-base">{salesData.totals?.total_invoices || 0} Billed</span>
              </div>
            </div>

            {}
            <div>
              <h4 className="font-bold text-slate-800 text-sm mb-2">Store-Wise Turnover</h4>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b text-[10px] font-bold text-slate-600 uppercase">
                    <th className="py-2.5 px-3">Branch Store</th>
                    <th className="py-2.5 px-3">City</th>
                    <th className="py-2.5 px-3 text-right">Invoices</th>
                    <th className="py-2.5 px-3 text-right">Phones Sold</th>
                    <th className="py-2.5 px-3 text-right">Gross Revenue</th>
                    <th className="py-2.5 px-3 text-right">Gross Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salesData.storeBreakdown?.map(st => (
                    <tr key={st.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{st.store_name}</td>
                      <td className="py-2.5 px-3 text-slate-600">{st.city}</td>
                      <td className="py-2.5 px-3 text-right font-medium">{st.sales_count}</td>
                      <td className="py-2.5 px-3 text-right font-medium">{st.units_sold}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatCurrency(st.revenue)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">{formatCurrency(st.gross_profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'taxes' && taxData ? (
          <div className="space-y-6 text-xs">
            {}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border">
                <span className="text-slate-400 uppercase text-[10px] font-bold block">Taxable Sales</span>
                <span className="font-extrabold text-slate-900 text-base">{formatCurrency(taxData.taxSummary?.total_taxable_value || 0)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border">
                <span className="text-slate-400 uppercase text-[10px] font-bold block">CGST (Central Tax)</span>
                <span className="font-extrabold text-slate-900 text-base">{formatCurrency(taxData.taxSummary?.total_cgst || 0)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border">
                <span className="text-slate-400 uppercase text-[10px] font-bold block">SGST (State Tax)</span>
                <span className="font-extrabold text-slate-900 text-base">{formatCurrency(taxData.taxSummary?.total_sgst || 0)}</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-emerald-700 uppercase text-[10px] font-bold block">Total GST Collected</span>
                <span className="font-extrabold text-emerald-900 text-base">{formatCurrency(taxData.taxSummary?.total_gst_collected || 0)}</span>
              </div>
            </div>

            {}
            <div>
              <h4 className="font-bold text-slate-800 text-sm mb-2">Store-Wise GST Breakdown</h4>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b text-[10px] font-bold text-slate-600 uppercase">
                    <th className="py-2.5 px-3">Branch Store</th>
                    <th className="py-2.5 px-3">GSTIN</th>
                    <th className="py-2.5 px-3 text-right">Taxable Turnover</th>
                    <th className="py-2.5 px-3 text-right">CGST</th>
                    <th className="py-2.5 px-3 text-right">SGST</th>
                    <th className="py-2.5 px-3 text-right font-bold text-emerald-800">Total Tax</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {taxData.storeTaxTable?.map(st => (
                    <tr key={st.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{st.store_name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{st.gstin || 'N/A'}</td>
                      <td className="py-2.5 px-3 text-right font-medium">{formatCurrency(st.taxable_value)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{formatCurrency(st.cgst)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{formatCurrency(st.sgst)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">{formatCurrency(st.total_tax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'employees' ? (
          <div className="text-xs">
            <h4 className="font-bold text-slate-800 text-sm mb-3">Employee Sales Productivity & Commissions</h4>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b text-[10px] font-bold text-slate-600 uppercase">
                  <th className="py-2.5 px-3">Employee Name</th>
                  <th className="py-2.5 px-3">Branch Store</th>
                  <th className="py-2.5 px-3 text-right">Invoices Billed</th>
                  <th className="py-2.5 px-3 text-right">Phones Sold</th>
                  <th className="py-2.5 px-3 text-right">Revenue Generated</th>
                  <th className="py-2.5 px-3 text-right font-bold text-emerald-800">Gross Profit Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employeeData.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{emp.full_name} ({emp.username})</td>
                    <td className="py-2.5 px-3 text-slate-600">{emp.store_name}</td>
                    <td className="py-2.5 px-3 text-right font-medium">{emp.total_sales_count}</td>
                    <td className="py-2.5 px-3 text-right font-medium">{emp.phones_sold}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatCurrency(emp.total_revenue)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700">{formatCurrency(emp.gross_profit_generated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : activeTab === 'inventory' && invData ? (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border">
                <span className="text-slate-400 uppercase text-[10px] font-bold block">Available Units</span>
                <span className="font-extrabold text-slate-900 text-base">{invData.overall?.available_devices || 0} Phones</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border">
                <span className="text-slate-400 uppercase text-[10px] font-bold block">Total Inventory Cost</span>
                <span className="font-extrabold text-slate-900 text-base">{formatCurrency(invData.overall?.available_inventory_cost || 0)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border">
                <span className="text-slate-400 uppercase text-[10px] font-bold block">Estimated Retail Value</span>
                <span className="font-extrabold text-emerald-700 text-base">{formatCurrency(invData.overall?.available_inventory_value || 0)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border">
                <span className="text-slate-400 uppercase text-[10px] font-bold block">Sold to Date</span>
                <span className="font-extrabold text-slate-900 text-base">{invData.overall?.sold_devices || 0} Units</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
