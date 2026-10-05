import React, { useState, useEffect } from 'react';
import { Store, Plus, Search, Building2, MapPin, Phone, Mail, FileText, CheckCircle, X } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';

export default function Stores() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editStore, setEditStore] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
    email: '',
    gstin: '',
    manager: '',
    status: 'active'
  });

  const fetchStores = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/stores');
      if (res.success) {
        setStores(res.stores || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const openAddModal = () => {
    setEditStore(null);
    setFormData({
      name: '',
      code: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      phone: '',
      email: '',
      gstin: '',
      manager: '',
      status: 'active'
    });
    setShowModal(true);
  };

  const openEditModal = (st) => {
    setEditStore(st);
    setFormData({
      name: st.name,
      code: st.code,
      address: st.address || '',
      city: st.city,
      state: st.state,
      pincode: st.pincode || '',
      phone: st.phone || '',
      email: st.email || '',
      gstin: st.gstin || '',
      manager: st.manager || '',
      status: st.status || 'active'
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.phone) {
      const cleanPhone = formData.phone.replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        alert('Store phone number must be exactly 10 digits.');
        return;
      }
    }

    try {
      const url = editStore ? `/stores/${editStore.id}` : '/stores';
      const method = editStore ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify({
          ...formData,
          phone: formData.phone ? formData.phone.replace(/\D/g, '').slice(0, 10) : ''
        })
      });

      if (res.success) {
        setShowModal(false);
        fetchStores();
        alert(res.message);
      } else {
        alert(res.message || 'Error saving store.');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredStores = stores.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.city.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Store className="w-5 h-5 text-emerald-600" />
            Physical Store Network ({stores.length} Outlets)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage all 12 physical branches across metropolitan hubs in India
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Branch</span>
          </button>
        </div>
      </div>

      {}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs max-w-md">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search store name, city, or branch code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
          />
        </div>
      </div>

      {}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStores.map(store => (
          <div key={store.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
                    {store.code}
                  </span>
                  <h3 className="font-extrabold text-slate-900 text-sm mt-0.5 leading-tight">
                    {store.name}
                  </h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {store.city}, {store.state}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${store.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                  {store.status}
                </span>
              </div>

              {}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs text-center">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Stock</span>
                  <span className="font-extrabold text-slate-800 text-sm">{store.available_inventory_count || 0}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Sold</span>
                  <span className="font-extrabold text-slate-800 text-sm">{store.total_sold_count || 0}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Staff</span>
                  <span className="font-extrabold text-slate-800 text-sm">{store.employee_count || 0}</span>
                </div>
              </div>

              {}
              <div className="mt-3 p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-100 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">Total Revenue</span>
                  <span className="font-extrabold text-slate-900">{formatCurrency(store.total_revenue || 0)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Gross Margin</span>
                  <span className="font-extrabold text-emerald-700">{formatCurrency(store.total_profit || 0)}</span>
                </div>
              </div>

              {}
              <div className="mt-3 text-[11px] text-slate-400 space-y-0.5">
                {store.phone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {store.phone}</div>}
                {store.manager && <div>Manager: <strong className="text-slate-600">{store.manager}</strong></div>}
                {store.gstin && <div>GSTIN: <span className="font-mono text-slate-500">{store.gstin}</span></div>}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => openEditModal(store)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition"
              >
                Edit Store Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-lg w-full p-6 text-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                {editStore ? `Edit Branch: ${editStore.name}` : 'Register New Physical Branch'}
              </h3>
              <button onClick={() => setShowModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Branch Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Branch Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Pincode</label>
                  <input
                    type="text"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Phone (10 Digits)</label>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="10-digit phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Branch GSTIN</label>
                  <input
                    type="text"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Store Manager</label>
                  <input
                    type="text"
                    value={formData.manager}
                    onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg"
                >
                  Save Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
