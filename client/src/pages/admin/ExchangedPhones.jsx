import React, { useState, useEffect } from 'react';
import { 
  ArrowLeftRight, 
  Smartphone, 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  Printer, 
  CheckCircle2, 
  Building2, 
  User, 
  Calendar, 
  Receipt, 
  RotateCcw, 
  PackageCheck, 
  X, 
  AlertTriangle,
  FileText,
  ShieldCheck,
  Check,
  ChevronRight,
  ExternalLink,
  Trash2
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import InvoiceModal from '../../components/invoice/InvoiceModal';
import ExchangeVoucherModal from '../../components/invoice/ExchangeVoucherModal';

export default function ExchangedPhones() {
  const { user, isAdmin } = useAuth();

  const [exchanges, setExchanges] = useState([]);
  const [kpis, setKpis] = useState({
    totalDevices: 0,
    totalValuation: 0,
    todayCount: 0,
    inStockCount: 0,
    convertedCount: 0
  });
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedStore, setSelectedStore] = useState(isAdmin ? '' : String(user?.assigned_store_id || ''));
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modals
  const [selectedExchange, setSelectedExchange] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveSellingPrice, setMoveSellingPrice] = useState('');
  const [moveGrade, setMoveGrade] = useState('Grade B');
  const [moving, setMoving] = useState(false);

  // Linked Invoice Viewer
  const [invoiceModalData, setInvoiceModalData] = useState(null);

  const fetchExchanges = async () => {
    setLoading(true);
    try {
      let query = `/exchanges?page=1&limit=100`;
      if (selectedStore) query += `&store_id=${selectedStore}`;
      if (selectedStatus) query += `&status=${selectedStatus}`;
      if (selectedGrade) query += `&condition_grade=${encodeURIComponent(selectedGrade)}`;
      if (dateFrom) query += `&date_from=${dateFrom}`;
      if (dateTo) query += `&date_to=${dateTo}`;
      if (search) query += `&search=${encodeURIComponent(search.trim())}`;

      const res = await apiFetch(query);
      if (res.success) {
        setExchanges(res.exchanges || []);
        if (res.kpis) setKpis(res.kpis);
      }
    } catch (e) {
      console.error('Failed to fetch exchanged phones:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const res = await apiFetch('/stores');
      if (res.success) setStores(res.stores || []);
    } catch (e) {}
  };

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    fetchExchanges();
  }, [selectedStore, selectedStatus, selectedGrade, dateFrom, dateTo]);

  // Debounced search
  useEffect(() => {
    const delay = setTimeout(() => {
      fetchExchanges();
    }, 300);
    return () => clearTimeout(delay);
  }, [search]);

  // View linked sale invoice
  const handleViewInvoice = async (saleId) => {
    if (!saleId) return;
    try {
      const res = await apiFetch(`/sales/${saleId}`);
      if (res.success) {
        setInvoiceModalData(res);
      } else {
        alert(res.message || 'Invoice details not available.');
      }
    } catch (err) {
      alert(err.message || 'Failed to load sale invoice.');
    }
  };

  // Status update handler
  const handleUpdateStatus = async (exchangeId, newStatus) => {
    try {
      const res = await apiFetch(`/exchanges/${exchangeId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      if (res.success) {
        fetchExchanges();
        if (selectedExchange?.id === exchangeId) {
          setSelectedExchange(prev => ({ ...prev, status: newStatus }));
        }
      } else {
        alert(res.message || 'Failed to update status.');
      }
    } catch (err) {
      alert(err.message || 'Error updating status.');
    }
  };

  // Convert to regular sellable inventory
  const handleMoveToInventory = async (e) => {
    e.preventDefault();
    if (!selectedExchange) return;

    setMoving(true);
    try {
      const res = await apiFetch(`/exchanges/${selectedExchange.id}/move-to-inventory`, {
        method: 'POST',
        body: JSON.stringify({
          selling_price: moveSellingPrice,
          condition_grade: moveGrade
        })
      });

      if (res.success) {
        alert(res.message || 'Device added to inventory successfully!');
        setShowMoveModal(false);
        fetchExchanges();
      } else {
        alert(res.message || 'Failed to transfer device to inventory.');
      }
    } catch (err) {
      alert(err.message || 'Error converting to inventory.');
    } finally {
      setMoving(false);
    }
  };

  // Delete exchanged phone record (Super Admin)
  const handleDeleteExchange = async (item) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete this trade-in record?\n\n` +
      `Exchange #: ${item.exchange_number}\n` +
      `Device: ${item.brand} ${item.model} (IMEI: ${item.imei1})\n` +
      `Customer: ${item.customer_name}\n` +
      `Valuation: ${formatCurrency(item.exchange_value)}\n\n` +
      `This action cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      const res = await apiFetch(`/exchanges/${item.id}`, {
        method: 'DELETE'
      });
      if (res.success) {
        alert(res.message || 'Exchanged phone record deleted permanently.');
        fetchExchanges();
      } else {
        alert(res.message || 'Failed to delete record.');
      }
    } catch (err) {
      alert(err.message || 'Error deleting trade-in record.');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'IN_STOCK':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">In Store Stock</span>;
      case 'REFURBISHING':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">Refurbishing</span>;
      case 'ADDED_TO_INVENTORY':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">In Sellable Stock</span>;
      case 'SCRAPPED':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Scrapped / Parts</span>;
      case 'SOLD':
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Resold</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Exchanged Phones
              </h1>
              <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Customer Trade-Ins
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Track customer buybacks • Inspect device hardware • Manage trade-in valuations & inventory intakes
            </p>
          </div>
        </div>

        {}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchExchanges}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Total Exchanged
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{kpis.totalDevices}</span>
            <span className="text-xs font-semibold text-slate-500">devices</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Across all store outlets</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Total Valuations Credited
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-emerald-700">
              {formatCurrency(kpis.totalValuation)}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Credited against bills</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Today's Trade-Ins
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600">{kpis.todayCount}</span>
            <span className="text-xs font-semibold text-slate-500">received</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">New exchanges today</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            In Store Stock
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-700">{kpis.inStockCount}</span>
            <span className="text-xs font-semibold text-slate-500">devices</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Awaiting evaluation / repair</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 lg:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Moved to Regular Inventory
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-teal-700">{kpis.convertedCount}</span>
            <span className="text-xs font-semibold text-slate-500">re-stocked</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Available for customer sale</p>
        </div>
      </div>

      {}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
          
          {}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by IMEI, Customer Name, Phone, Brand, Model, Invoice #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white transition"
            />
          </div>

          {}
          {isAdmin && (
            <div>
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
              >
                <option value="">All Store Outlets (12)</option>
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
          )}

          {}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
            >
              <option value="">All Statuses</option>
              <option value="IN_STOCK">In Store Stock</option>
              <option value="REFURBISHING">Under Refurbishment</option>
              <option value="ADDED_TO_INVENTORY">In Sellable Stock</option>
              <option value="SCRAPPED">Scrapped / Parts Only</option>
            </select>
          </div>

          {}
          <div>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700"
            >
              <option value="">All Condition Grades</option>
              <option value="Grade A">Grade A (Like New)</option>
              <option value="Grade B">Grade B (Minor wear)</option>
              <option value="Grade C">Grade C (Scratched/Dent)</option>
              <option value="Defective">Defective</option>
            </select>
          </div>

        </div>

        {}
        {(search || selectedStatus || selectedGrade || (isAdmin && selectedStore)) && (
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            <span>Filtered results</span>
            <button
              onClick={() => {
                setSearch('');
                setSelectedStatus('');
                setSelectedGrade('');
                if (isAdmin) setSelectedStore('');
              }}
              className="text-amber-700 hover:underline font-bold"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Exchanged Device</th>
                <th className="py-3 px-4">IMEI & Specs</th>
                <th className="py-3 px-4">Customer Details</th>
                <th className="py-3 px-4">Exchange Value</th>
                <th className="py-3 px-4">Linked Bill / Date</th>
                <th className="py-3 px-4">Store Outlet</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <div className="inline-block w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p>Loading exchanged devices...</p>
                  </td>
                </tr>
              ) : exchanges.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <Smartphone className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-600">No exchanged phones found</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      When customers trade-in an old phone on the POS billing page, they will appear here automatically.
                    </p>
                  </td>
                </tr>
              ) : (
                exchanges.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition group">
                    
                    {}
                    <td className="py-3.5 px-4 font-medium">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
                          <Smartphone className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <span>{item.brand} {item.model}</span>
                            {item.variant && (
                              <span className="text-[10px] font-normal text-slate-500">
                                ({item.variant})
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {item.color || 'Standard'} • <span className="font-mono text-slate-500">#{item.exchange_number}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {}
                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      <div className="text-slate-900 font-bold tracking-tight">
                        {item.imei1}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 font-sans">
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 text-slate-700">
                          {item.condition_grade || 'Grade B'}
                        </span>
                        {item.battery_health && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700">
                            ⚡ {item.battery_health}%
                          </span>
                        )}
                      </div>
                    </td>

                    {}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{item.customer_name}</div>
                      <div className="text-[11px] text-slate-500">{item.customer_phone}</div>
                      {item.customer_id_proof_number && (
                        <div className="text-[9px] text-amber-800 font-mono mt-0.5">
                          {item.customer_id_proof_type || 'ID'}: {item.customer_id_proof_number}
                        </div>
                      )}
                    </td>

                    {}
                    <td className="py-3.5 px-4 font-bold text-emerald-800 text-sm">
                      {formatCurrency(item.exchange_value)}
                    </td>

                    {}
                    <td className="py-3.5 px-4 text-[11px]">
                      {item.sale_invoice_number ? (
                        <button
                          type="button"
                          onClick={() => handleViewInvoice(item.sale_id)}
                          className="font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline text-left"
                          title="Click to view full sale invoice"
                        >
                          <span>{item.sale_invoice_number}</span>
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </button>
                      ) : (
                        <span className="text-slate-400">Direct Trade-In</span>
                      )}
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {formatDate(item.exchange_date)}
                      </div>
                    </td>

                    {}
                    <td className="py-3.5 px-4 text-[11px]">
                      <div className="font-semibold text-slate-800">{item.store_name}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <span>Staff:</span>
                        <span className="text-slate-600 font-medium">{item.employee_name}</span>
                      </div>
                    </td>

                    {}
                    <td className="py-3.5 px-4 text-center">
                      {getStatusBadge(item.status)}
                    </td>

                    {}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        
                        {}
                        <button
                          onClick={() => {
                            setSelectedExchange(item);
                            setShowDetailModal(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                          title="View Full Device Inspection & KYC"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {}
                        <button
                          onClick={() => {
                            setSelectedExchange(item);
                            setShowVoucherModal(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                          title="Print Customer Handover & Trade-In Voucher"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {}
                        {item.status !== 'ADDED_TO_INVENTORY' ? (
                          <button
                            onClick={() => {
                              setSelectedExchange(item);
                              const purchase = parseFloat(item.exchange_value) || 0;
                              setMoveSellingPrice(purchase > 0 ? String(Math.round(purchase * 1.25)) : '10000');
                              setMoveGrade(item.condition_grade || 'Grade B');
                              setShowMoveModal(true);
                            }}
                            className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition"
                            title="Add Device to Regular Sellable Inventory"
                          >
                            <PackageCheck className="w-4 h-4" />
                          </button>
                        ) : (
                          <span
                            className="p-1.5 text-slate-300 cursor-not-allowed"
                            title="Already transferred to Inventory"
                          >
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          </span>
                        )}

                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteExchange(item)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete Trade-In Record Permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {}
      {showDetailModal && selectedExchange && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-lg w-full p-6 text-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Trade-In Device: {selectedExchange.brand} {selectedExchange.model}
                </h3>
              </div>
              <button onClick={() => setShowDetailModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Exchange Reference</span>
                <span className="font-mono font-bold text-slate-800">#{selectedExchange.exchange_number}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Exchange Valuation</span>
                <span className="font-bold text-emerald-700 text-sm">{formatCurrency(selectedExchange.exchange_value)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Primary IMEI 1</span>
                <span className="font-mono font-bold text-slate-800">{selectedExchange.imei1}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Secondary IMEI 2 / Serial</span>
                <span className="font-mono text-slate-700">{selectedExchange.imei2 || selectedExchange.serial_number || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Condition Grade</span>
                <span className="font-bold text-slate-800">{selectedExchange.condition_grade}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Battery Health</span>
                <span className="font-bold text-slate-800">{selectedExchange.battery_health ? `${selectedExchange.battery_health}%` : 'Not recorded'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Variant & Color</span>
                <span className="text-slate-800">{selectedExchange.variant || 'Standard'} • {selectedExchange.color || 'Standard'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Accessories Handed Over</span>
                <span className="text-slate-800 font-medium">{selectedExchange.accessories_included || 'Device Only'}</span>
              </div>
            </div>

            {}
            <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/60 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block mb-1">
                Customer KYC & Handover Details
              </span>
              <div className="grid grid-cols-2 gap-2 text-slate-700">
                <div>
                  <span className="text-slate-400 block text-[10px]">Name:</span>
                  <span className="font-bold text-slate-900">{selectedExchange.customer_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Phone:</span>
                  <span className="font-semibold text-slate-900">{selectedExchange.customer_phone}</span>
                </div>
                {selectedExchange.customer_id_proof_number && (
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px]">ID Proof:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {selectedExchange.customer_id_proof_type || 'ID'}: {selectedExchange.customer_id_proof_number}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {}
            <div>
              <label className="font-bold text-slate-600 block mb-1">Update Stock / Refurbishment Status</label>
              <div className="flex gap-2">
                {['IN_STOCK', 'REFURBISHING', 'SCRAPPED'].map(st => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleUpdateStatus(selectedExchange.id, st)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                      selectedExchange.status === st
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {st.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {showMoveModal && selectedExchange && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 text-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900">
                  Transfer to Sellable Inventory
                </h3>
              </div>
              <button onClick={() => setShowMoveModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <p className="text-slate-600 leading-relaxed">
              This will add <strong className="text-slate-900">{selectedExchange.brand} {selectedExchange.model}</strong> (IMEI: <span className="font-mono font-bold text-slate-800">{selectedExchange.imei1}</span>) into your store's regular active inventory catalog with cost set to the exchange valuation ({formatCurrency(selectedExchange.exchange_value)}).
            </p>

            <form onSubmit={handleMoveToInventory} className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Selling Price (₹) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    min="1"
                    required
                    value={moveSellingPrice}
                    onChange={(e) => setMoveSellingPrice(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 text-sm"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Original Trade-in Acquisition Cost: {formatCurrency(selectedExchange.exchange_value)}
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Certified Grade *</label>
                <select
                  value={moveGrade}
                  onChange={(e) => setMoveGrade(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                >
                  <option value="Grade A">Grade A (Like New / Flawless)</option>
                  <option value="Grade B">Grade B (Good Condition / Minor scratches)</option>
                  <option value="Grade C">Grade C (Fair / Visible wear)</option>
                </select>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowMoveModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={moving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-sm"
                >
                  {moving ? 'Transferring...' : 'Confirm & Add to Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {}
      {showVoucherModal && selectedExchange && (
        <ExchangeVoucherModal
          exchange={selectedExchange}
          onClose={() => setShowVoucherModal(false)}
        />
      )}

      {}
      {invoiceModalData && (
        <InvoiceModal
          invoiceData={invoiceModalData}
          onClose={() => setInvoiceModalData(null)}
        />
      )}

    </div>
  );
}
