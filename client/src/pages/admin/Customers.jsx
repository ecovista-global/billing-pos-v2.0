import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, Phone, Mail, MapPin, Eye, FileText, X } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Customer Profile Modal
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Add Customer Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCust, setNewCust] = useState({
    full_name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gstin: '',
    id_proof_type: 'Aadhaar',
    id_proof_number: ''
  });

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      let q = `/customers?page=${page}&limit=25`;
      if (search) q += `&search=${encodeURIComponent(search)}`;
      const res = await apiFetch(q);
      if (res.success) {
        setCustomers(res.customers || []);
        if (res.pagination) setTotalPages(res.pagination.totalPages || 1);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [page]);

  const viewCustomerProfile = async (id) => {
    setProfileLoading(true);
    try {
      const res = await apiFetch(`/customers/${id}`);
      if (res.success) setSelectedCustomer(res);
    } catch (e) {
      console.error(e);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();

    const cleanPhone = (newCust.phone || '').replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      alert('Phone number must be exactly 10 digits.');
      return;
    }

    const cleanId = (newCust.id_proof_number || '').replace(/\D/g, '');
    if (newCust.id_proof_number && cleanId.length !== 12) {
      alert('ID Proof number must be exactly 12 digits.');
      return;
    }

    try {
      const res = await apiFetch('/customers', {
        method: 'POST',
        body: JSON.stringify({
          ...newCust,
          phone: cleanPhone,
          id_proof_number: cleanId || null
        })
      });
      if (res.success) {
        setShowAddModal(false);
        fetchCustomers();
        alert('Customer registered successfully!');
      } else {
        alert(res.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-5">
      {}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            Customer Relationship Management (CRM)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Profiles, purchased smartphones, invoice history, and warranty records
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Customer</span>
        </button>
      </div>

      {}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs max-w-md">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name, mobile, email, or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchCustomers()}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
          />
        </div>
      </div>

      {}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">Loading customer directory...</div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">No customers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3">Location</th>
                  <th className="py-3 px-3 text-center">Phones Purchased</th>
                  <th className="py-3 px-3 text-right">Total Spent</th>
                  <th className="py-3 px-4 text-center">History</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 text-sm">{c.full_name}</div>
                      <div className="text-[10px] font-mono text-emerald-700">{c.customer_code}</div>
                    </td>

                    <td className="py-3 px-3 text-slate-600 font-medium">
                      <div>{c.phone}</div>
                      {c.email && <div className="text-[11px] text-slate-400">{c.email}</div>}
                    </td>

                    <td className="py-3 px-3 text-slate-600">
                      {c.city ? `${c.city}, ${c.state || ''}` : '-'}
                    </td>

                    <td className="py-3 px-3 text-center font-bold text-slate-800">
                      {c.total_purchases || c.invoice_count || 0}
                    </td>

                    <td className="py-3 px-3 text-right font-extrabold text-emerald-700 text-sm">
                      {formatCurrency(c.total_spent || 0)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => viewCustomerProfile(c.id)}
                        className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                        title="View Purchase History & Warranties"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full p-6 text-xs space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">{selectedCustomer.customer.full_name}</h3>
                <p className="text-[11px] text-slate-500 font-mono">
                  {selectedCustomer.customer.customer_code} • {selectedCustomer.customer.phone}
                  {selectedCustomer.customer.id_proof_number && ` • ${selectedCustomer.customer.id_proof_type || 'ID'}: ${selectedCustomer.customer.id_proof_number}`}
                </p>
              </div>
              <button onClick={() => setSelectedCustomer(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            {}
            <div>
              <span className="font-bold text-slate-700 uppercase text-[10px] block mb-2">Purchase Transactions</span>
              <div className="divide-y border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                {selectedCustomer.purchases && selectedCustomer.purchases.length > 0 ? (
                  selectedCustomer.purchases.map(p => (
                    <div key={p.id} className="p-2.5 flex justify-between items-center hover:bg-slate-50">
                      <div>
                        <div className="font-mono font-bold text-emerald-800">{p.invoice_number}</div>
                        <div className="text-[10px] text-slate-400">{p.store_name} • {formatDateTime(p.sale_date)}</div>
                      </div>
                      <span className="font-extrabold text-slate-900">{formatCurrency(p.grand_total)}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-slate-400">No purchases recorded yet.</div>
                )}
              </div>
            </div>

            {}
            <div>
              <span className="font-bold text-slate-700 uppercase text-[10px] block mb-2">Smartphones Purchased</span>
              <div className="divide-y border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                {selectedCustomer.devices && selectedCustomer.devices.length > 0 ? (
                  selectedCustomer.devices.map(d => (
                    <div key={d.id} className="p-2.5 flex justify-between items-center hover:bg-slate-50">
                      <div>
                        <div className="font-bold text-slate-900">{d.brand} {d.model} ({d.variant})</div>
                        <div className="font-mono text-[10px] text-emerald-700">IMEI: {d.imei1}</div>
                      </div>
                      <span className="font-bold text-slate-700">{formatCurrency(d.final_price)}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-slate-400">No devices owned.</div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t flex justify-end">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 text-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">Register New Customer</h3>
              <button onClick={() => setShowAddModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-3">
              <div>
                <label className="font-bold text-slate-600 block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newCust.full_name}
                  onChange={(e) => setNewCust({ ...newCust, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Mobile Phone (10 Digits) *</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="Enter 10-digit mobile number"
                  value={newCust.phone}
                  onChange={(e) => setNewCust({ ...newCust, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Email</label>
                <input
                  type="email"
                  value={newCust.email}
                  onChange={(e) => setNewCust({ ...newCust, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">ID Proof Type</label>
                  <select
                    value={newCust.id_proof_type}
                    onChange={(e) => setNewCust({ ...newCust, id_proof_type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                  >
                    <option value="Aadhaar">Aadhaar Card</option>
                    <option value="PAN">PAN Card</option>
                    <option value="Driving License">Driving License</option>
                    <option value="Voter ID">Voter ID</option>
                    <option value="Passport">Passport</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">ID Proof Number (12 Digits)</label>
                  <input
                    type="text"
                    maxLength={12}
                    placeholder="12-digit ID number"
                    value={newCust.id_proof_number}
                    onChange={(e) => setNewCust({ ...newCust, id_proof_number: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">City</label>
                  <input
                    type="text"
                    value={newCust.city}
                    onChange={(e) => setNewCust({ ...newCust, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">State (for GST)</label>
                  <input
                    type="text"
                    value={newCust.state}
                    onChange={(e) => setNewCust({ ...newCust, state: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg"
                >
                  Register Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
