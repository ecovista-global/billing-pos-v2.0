import React, { useState } from 'react';
import { X, Zap, AlertTriangle } from 'lucide-react';

const BRANDS = ['Apple', 'Samsung', 'OnePlus', 'Vivo', 'Oppo', 'Realme', 'Xiaomi', 'Poco', 'Motorola', 'Nokia', 'Google', 'Nothing', 'iQOO', 'Other'];

export default function QuickBillModal({ onClose, onAdd, systemTaxRate }) {
  const [itemType, setItemType] = useState('phone'); // 'phone' | 'accessory'
  const [form, setForm] = useState({
    brand: 'Samsung',
    customBrand: '',
    model: '',
    variant: '',
    imei1: '',
    condition_grade: 'Grade A',
    selling_price: ''
  });
  const [error, setError] = useState('');

  const handleAdd = () => {
    setError('');
    const finalBrand = form.brand === 'Other' ? form.customBrand : form.brand;
    if (!finalBrand.trim() || !form.model.trim()) {
      setError('Brand and Model are required.');
      return;
    }
    const sp = parseFloat(form.selling_price);
    if (!sp || sp <= 0) {
      setError('Please enter a valid Selling Price.');
      return;
    }
    if (itemType === 'phone') {
      if (!form.imei1 || !/^\d{15}$/.test(form.imei1.replace(/\D/g, ''))) {
        setError('IMEI must be exactly 15 digits.');
        return;
      }
    }

    onAdd({
      ...form,
      brand: finalBrand,
      item_type: itemType === 'phone' ? 'quick_bill' : 'quick_bill_accessory',
      id: `QB-${Date.now()}`, // local cart key
      selling_price: sp,
      purchase_price: 0,
      tax_rate: itemType === 'phone' ? 5.0 : 18.0,
      quantity: 1,
      price_includes_gst: 1,
      discount: 0,
      discount_mode: 'fixed',
      discount_value: ''
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-amber-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Quick Bill Item</h3>
              <p className="text-[10px] text-slate-500">Bill now, update purchase cost later</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Type Toggle */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => { setItemType('phone'); }}
            className={`flex-1 py-3 text-xs font-bold transition ${itemType === 'phone' ? 'text-amber-600 border-b-2 border-amber-500' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Mobile Phone
          </button>
          <button
            onClick={() => { setItemType('accessory'); }}
            className={`flex-1 py-3 text-xs font-bold transition ${itemType === 'accessory' ? 'text-amber-600 border-b-2 border-amber-500' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Accessory
          </button>
        </div>

        {/* Warning */}
        <div className="mx-6 mt-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-amber-800 leading-relaxed">
            <span className="font-bold">No inventory entry required.</span> This item will be billed at the selling price. 
            The purchase cost must be entered later from the <strong>Quick Bills Reconciliation</strong> panel.
          </p>
        </div>

        {/* Form */}
        <div className="px-6 py-4 space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            {/* Brand */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Brand *</label>
              {itemType === 'accessory' ? (
                <input
                  type="text"
                  placeholder="e.g. Sony, Boat, Generic"
                  value={form.brand}
                  onChange={e => setForm({ ...form, brand: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none"
                />
              ) : (
                <div className="space-y-2">
                  <select
                    value={form.brand}
                    onChange={e => setForm({ ...form, brand: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none"
                  >
                    {BRANDS.map(b => <option key={b}>{b}</option>)}
                  </select>
                  {form.brand === 'Other' && (
                    <input
                      type="text"
                      placeholder="Enter brand name"
                      value={form.customBrand}
                      onChange={e => setForm({ ...form, customBrand: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Model */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">{itemType === 'accessory' ? 'Name (Model) *' : 'Model *'}</label>
              <input
                type="text"
                placeholder={itemType === 'accessory' ? 'e.g. 20W Charger' : 'e.g. Galaxy S23'}
                value={form.model}
                onChange={e => setForm({ ...form, model: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Variant */}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Variant / Storage</label>
              <input
                type="text"
                placeholder={itemType === 'accessory' ? 'e.g. Black / Type-C' : 'e.g. 256GB / 8GB RAM'}
                value={form.variant}
                onChange={e => setForm({ ...form, variant: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none"
              />
            </div>

            {/* Condition - Only for Phones */}
            {itemType === 'phone' && (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Condition</label>
                <select
                  value={form.condition_grade}
                  onChange={e => setForm({ ...form, condition_grade: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none"
                >
                  <option>Grade A</option>
                  <option>Grade B</option>
                  <option>Grade C</option>
                  <option>Brand New</option>
                </select>
              </div>
            )}
          </div>

          {/* IMEI - Only for Phones */}
          {itemType === 'phone' && (
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">IMEI 1 *</label>
              <input
                type="text"
                placeholder="15-digit IMEI"
                maxLength={15}
                value={form.imei1}
                onChange={e => setForm({ ...form, imei1: e.target.value.replace(/\D/g, '').slice(0, 15) })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-amber-400 outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Selling Price (Incl. GST) (₹) *
            </label>
            <input
              type="number"
              min="1"
              placeholder="e.g. 25000"
              value={form.selling_price}
              onChange={e => setForm({ ...form, selling_price: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 outline-none font-mono"
            />
          </div>

          {error && (
            <p className="text-[11px] text-rose-600 font-semibold bg-rose-50 px-3 py-2 rounded-lg border border-rose-200">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center gap-3 justify-end border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-sm transition"
          >
            <Zap className="w-3.5 h-3.5" />
            Add to Bill
          </button>
        </div>
      </div>
    </div>
  );
}
