import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Truck, 
  Plus, 
  Search, 
  Building2, 
  Package, 
  Smartphone, 
  Calendar, 
  FileText, 
  CheckCircle,
  ArrowLeft,
  X,
  Sparkles,
  Check,
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import BulkUploadModal from '../../components/inventory/BulkUploadModal';

export default function Purchases() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successModal, setSuccessModal] = useState(null);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // Form
  const [purchaseData, setPurchaseData] = useState({
    supplier_id: '',
    store_id: user?.assigned_store_id || 1,
    invoice_number: `INW-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    purchase_date: new Date().toISOString().split('T')[0],
    notes: 'Standard certified inward batch'
  });

  const [phones, setPhones] = useState([
    {
      brand: 'Apple',
      model: 'iPhone 13',
      variant: '128GB',
      ram: '4GB',
      storage: '128GB',
      color: 'Midnight',
      imei1: '',
      imei2: '',
      serial_number: '',
      condition_grade: 'Grade A',
      battery_health: '92%',
      purchase_price: 25000,
      refurbishment_cost: 1200,
      additional_cost: 300,
      selling_price: 39000,
      discount: 0,
      tax_rate: 18.0,
      warranty_period_months: 6
    }
  ]);

  const presets = [
    { brand: 'Apple', model: 'iPhone 13', variant: '128GB', ram: '4GB', storage: '128GB', color: 'Midnight', condition_grade: 'Grade A', battery_health: '92%', purchase_price: 25000, refurbishment_cost: 1200, additional_cost: 300, selling_price: 39000 },
    { brand: 'Apple', model: 'iPhone 14', variant: '128GB', ram: '6GB', storage: '128GB', color: 'Starlight', condition_grade: 'Grade A', battery_health: '95%', purchase_price: 32000, refurbishment_cost: 1000, additional_cost: 300, selling_price: 49000 },
    { brand: 'Apple', model: 'iPhone 15', variant: '128GB', ram: '6GB', storage: '128GB', color: 'Black', condition_grade: 'Like New', battery_health: '98%', purchase_price: 42000, refurbishment_cost: 800, additional_cost: 400, selling_price: 59900 },
    { brand: 'Samsung', model: 'Galaxy S23', variant: '256GB', ram: '8GB', storage: '256GB', color: 'Phantom Black', condition_grade: 'Grade A', battery_health: '94%', purchase_price: 28000, refurbishment_cost: 1100, additional_cost: 300, selling_price: 42000 },
    { brand: 'OnePlus', model: '11 5G', variant: '256GB', ram: '16GB', storage: '256GB', color: 'Titan Black', condition_grade: 'Grade A', battery_health: '93%', purchase_price: 23000, refurbishment_cost: 900, additional_cost: 300, selling_price: 34500 }
  ];

  useEffect(() => {
    async function loadData() {
      try {
        const [metaRes, storeRes] = await Promise.all([
          apiFetch('/inventory/meta/catalog'),
          apiFetch('/stores')
        ]);
        if (metaRes.success) {
          setSuppliers(metaRes.suppliers || []);
          if (metaRes.suppliers.length) setPurchaseData(p => ({ ...p, supplier_id: metaRes.suppliers[0].id }));
        }
        if (storeRes.success) {
          setStores(storeRes.stores || []);
          if (!isAdmin && user?.assigned_store_id) {
            setPurchaseData(p => ({ ...p, store_id: user.assigned_store_id }));
          }
        }
      } catch (e) {}
    }
    loadData();
  }, [user, isAdmin]);

  const applyPreset = (index, preset) => {
    const updated = [...phones];
    updated[index] = {
      ...updated[index],
      ...preset,
      imei1: updated[index].imei1,
      imei2: updated[index].imei2,
      serial_number: updated[index].serial_number
    };
    setPhones(updated);
  };

  const addPhoneRow = () => {
    setPhones([
      ...phones,
      {
        brand: 'Apple',
        model: 'iPhone 14',
        variant: '128GB',
        ram: '6GB',
        storage: '128GB',
        color: 'Starlight',
        imei1: '',
        imei2: '',
        serial_number: '',
        condition_grade: 'Grade A',
        battery_health: '95%',
        purchase_price: 32000,
        refurbishment_cost: 1000,
        additional_cost: 300,
        selling_price: 49000,
        discount: 0,
        tax_rate: 18.0,
        warranty_period_months: 6
      }
    ]);
  };

  const removeRow = (index) => {
    if (phones.length <= 1) return;
    setPhones(phones.filter((_, i) => i !== index));
  };

  const updatePhoneField = (index, field, val) => {
    const updated = [...phones];
    updated[index][field] = val;
    setPhones(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      const imeiSet = new Set();
      for (let i = 0; i < phones.length; i++) {
        const ph = phones[i];
        const imei = (ph.imei1 || '').trim();
        if (!imei) {
          throw new Error(`Device #${i + 1} is missing IMEI 1.`);
        }
        if (!/^\d{15}$/.test(imei)) {
          throw new Error(`Device #${i + 1} Primary IMEI 1 ("${imei}") must be exactly 15 numeric digits.`);
        }
        if (ph.imei2 && ph.imei2.trim()) {
          const imei2 = ph.imei2.trim();
          if (!/^\d{15}$/.test(imei2)) {
            throw new Error(`Device #${i + 1} Secondary IMEI 2 ("${imei2}") must be exactly 15 numeric digits.`);
          }
        }
        if (imeiSet.has(imei)) {
          throw new Error(`Duplicate IMEI 1 ("${imei}") found within this batch.`);
        }
        imeiSet.add(imei);
      }

      for (const ph of phones) {
        const res = await apiFetch('/inventory', {
          method: 'POST',
          body: JSON.stringify({
            ...ph,
            supplier_id: purchaseData.supplier_id,
            purchase_date: purchaseData.purchase_date,
            current_store_id: purchaseData.store_id,
            notes: `Purchase Batch ${purchaseData.invoice_number} - ${purchaseData.notes}`
          })
        });

        if (!res.success) {
          throw new Error(res.message || 'Failed to save device to inventory.');
        }
      }

      const storeObj = stores.find(s => s.id === parseInt(purchaseData.store_id));
      const storeName = storeObj ? storeObj.name : 'Store';

      setSuccessModal({
        count: phones.length,
        storeName,
        invoiceNumber: purchaseData.invoice_number
      });
    } catch (err) {
      setError(err.message || 'Error occurred while saving batch stock.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSuccessModal(null);
    setError('');
    setPurchaseData(p => ({
      ...p,
      invoice_number: `INW-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    }));
    setPhones([
      {
        brand: 'Apple',
        model: 'iPhone 13',
        variant: '128GB',
        ram: '4GB',
        storage: '128GB',
        color: 'Midnight',
        imei1: '',
        imei2: '',
        serial_number: '',
        condition_grade: 'Grade A',
        battery_health: '92%',
        purchase_price: 25000,
        refurbishment_cost: 1200,
        additional_cost: 300,
        selling_price: 39000,
        discount: 0,
        tax_rate: 18.0,
        warranty_period_months: 6
      }
    ]);
  };

  const totalBatchCost = phones.reduce((acc, p) => acc + ((parseFloat(p.purchase_price) || 0) + (parseFloat(p.refurbishment_cost) || 0) + (parseFloat(p.additional_cost) || 0)), 0);

  return (
    <div className="space-y-5">
      {}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Truck className="w-5 h-5 text-emerald-600" />
              Stock Entry — Add Refurbished Phone(s)
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              Inward
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Log supplier purchases of refurbished smartphones with automated cost aggregation & IMEI assignment
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition cursor-pointer"
            title="Upload Excel or CSV file to add multiple phones at once"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Bulk Excel Upload</span>
          </button>
          <button
            type="button"
            onClick={() => navigate(isAdmin ? '/admin/inventory' : '/employee/inventory')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Inventory</span>
          </button>
        </div>
      </div>

      {}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <p className="font-bold">Cannot Complete Stock Entry</p>
            <p className="text-rose-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {}
      <form onSubmit={handleSubmit} className="space-y-4">
        {}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Wholesale Supplier *</label>
            <select
              value={purchaseData.supplier_id}
              onChange={(e) => setPurchaseData({ ...purchaseData, supplier_id: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border rounded-lg font-medium"
            >
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.city})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Receiving Branch Store *</label>
            {isAdmin ? (
              <select
                value={purchaseData.store_id}
                onChange={(e) => setPurchaseData({ ...purchaseData, store_id: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-50 border rounded-lg font-medium"
              >
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            ) : (
              <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg font-bold text-slate-800">
                {user?.store_name || 'Assigned Branch'}
              </div>
            )}
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Supplier Invoice Number</label>
            <input
              type="text"
              placeholder="e.g. INV-SUPP-8839"
              value={purchaseData.invoice_number}
              onChange={(e) => setPurchaseData({ ...purchaseData, invoice_number: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Purchase Date</label>
            <input
              type="date"
              value={purchaseData.purchase_date}
              onChange={(e) => setPurchaseData({ ...purchaseData, purchase_date: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
            />
          </div>
        </div>

        {}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Devices In This Inward Batch ({phones.length})
            </span>
            <button
              type="button"
              onClick={addPhoneRow}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200 transition"
            >
              + Add Another Device
            </button>
          </div>

          <div className="space-y-3">
            {phones.map((phone, idx) => {
              const unitCost = (parseFloat(phone.purchase_price) || 0) + (parseFloat(phone.refurbishment_cost) || 0) + (parseFloat(phone.additional_cost) || 0);
              const unitSell = parseFloat(phone.selling_price) || 0;
              const unitProfit = unitSell - unitCost;
              const unitMargin = unitSell > 0 ? ((unitProfit / unitSell) * 100).toFixed(1) : 0;

              return (
                <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b pb-2 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">Device #{idx + 1}</span>
                      <span className="text-[11px] text-slate-500 font-medium">{phone.brand} {phone.model}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="text-slate-400 font-medium flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        Quick Preset:
                      </span>
                      {presets.map((pre, pidx) => (
                        <button
                          key={pidx}
                          type="button"
                          onClick={() => applyPreset(idx, pre)}
                          className="px-2 py-0.5 rounded bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 text-[10px] font-medium transition cursor-pointer"
                        >
                          {pre.model}
                        </button>
                      ))}

                      {phones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="text-rose-600 hover:text-rose-700 font-medium ml-2 cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="text-slate-500 block mb-0.5">Brand *</label>
                      <input
                        type="text"
                        required
                        value={phone.brand}
                        onChange={(e) => updatePhoneField(idx, 'brand', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border rounded font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-0.5">Model *</label>
                      <input
                        type="text"
                        required
                        value={phone.model}
                        onChange={(e) => updatePhoneField(idx, 'model', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border rounded font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-0.5">Variant</label>
                      <input
                        type="text"
                        value={phone.variant}
                        onChange={(e) => updatePhoneField(idx, 'variant', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border rounded"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-0.5">Grade</label>
                      <select
                        value={phone.condition_grade}
                        onChange={(e) => updatePhoneField(idx, 'condition_grade', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border rounded font-medium"
                      >
                        <option value="Like New">Like New</option>
                        <option value="Grade A">Grade A</option>
                        <option value="Grade B">Grade B</option>
                        <option value="Grade C">Grade C</option>
                        <option value="Fair">Fair</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-emerald-50/40 p-2.5 rounded-lg border border-emerald-100">
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-emerald-900 font-bold">Primary IMEI 1 *</label>
                        <span className="text-[10px] text-emerald-700 font-mono">
                          {phone.imei1 ? `${phone.imei1.length}/15 digits` : '15 digits required'}
                        </span>
                      </div>
                      <input
                        type="text"
                        required
                        inputMode="numeric"
                        maxLength={15}
                        placeholder="15-digit unique IMEI"
                        value={phone.imei1}
                        onChange={(e) => updatePhoneField(idx, 'imei1', e.target.value.replace(/\D/g, '').slice(0, 15))}
                        className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded font-mono font-bold text-emerald-900 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-slate-500 block">Secondary IMEI 2</label>
                        {phone.imei2 && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            {phone.imei2.length}/15 digits
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={15}
                        placeholder="Optional second IMEI (15 digits)"
                        value={phone.imei2}
                        onChange={(e) => updatePhoneField(idx, 'imei2', e.target.value.replace(/\D/g, '').slice(0, 15))}
                        className="w-full px-2.5 py-1.5 bg-white border rounded font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                    <div>
                      <label className="text-slate-500 block mb-0.5">Purchase Cost (₹) *</label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={phone.purchase_price}
                        onChange={(e) => updatePhoneField(idx, 'purchase_price', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border rounded font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-0.5">Refurb Cost (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={phone.refurbishment_cost}
                        onChange={(e) => updatePhoneField(idx, 'refurbishment_cost', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border rounded"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-0.5">Selling Price (₹) *</label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={phone.selling_price}
                        onChange={(e) => updatePhoneField(idx, 'selling_price', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-emerald-50 border border-emerald-300 rounded font-bold text-emerald-900"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-0.5">Battery Health</label>
                      <input
                        type="text"
                        value={phone.battery_health}
                        onChange={(e) => updatePhoneField(idx, 'battery_health', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border rounded"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-0.5">Expected Margin</label>
                      <div className={`px-2.5 py-1.5 rounded font-bold ${unitProfit >= 0 ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}`}>
                        {formatCurrency(unitProfit)} ({unitMargin}%)
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              Total Inward Value: <strong className="text-slate-900 text-sm font-extrabold">{formatCurrency(totalBatchCost)}</strong>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(isAdmin ? '/admin/inventory' : '/employee/inventory')}
                className="px-4 py-2 border rounded-xl text-slate-600 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{loading ? 'Adding Stock...' : `Complete Stock Entry (${phones.length} Device${phones.length > 1 ? 's' : ''})`}</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {}
      {successModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 text-center animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-bold text-slate-900">Stock Entry Successful!</h3>
            <p className="text-xs text-slate-600 mt-1">
              <strong>{successModal.count} refurbished device(s)</strong> have been successfully added to <strong>{successModal.storeName}</strong>.
            </p>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mt-4 text-xs font-mono text-slate-700">
              Batch Reference: {successModal.invoiceNumber}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => navigate(isAdmin ? '/admin/inventory' : '/employee/inventory')}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition cursor-pointer"
              >
                View in Inventory
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
              >
                Inward More Phones
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      <BulkUploadModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        stores={stores}
        suppliers={suppliers}
        onSuccess={() => {
          navigate(isAdmin ? '/admin/inventory' : '/employee/inventory');
        }}
      />
    </div>
  );
}
