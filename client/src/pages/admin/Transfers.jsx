import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, Plus, CheckCircle, XCircle, Search, Building2, Package, Eye, AlertCircle, X } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatDate, getStatusBadge } from '../../utils/formatters';

export default function Transfers() {
  const { user, isAdmin } = useAuth();
  const [transfers, setTransfers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Transfer Modal
  const [showModal, setShowModal] = useState(false);
  const [fromStoreId, setFromStoreId] = useState(user?.assigned_store_id || 1);
  const [toStoreId, setToStoreId] = useState(2);
  const [availablePhones, setAvailablePhones] = useState([]);
  const [selectedPhoneIds, setSelectedPhoneIds] = useState([]);
  const [notes, setNotes] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  // Details Modal
  const [selectedTransfer, setSelectedTransfer] = useState(null);

  const fetchTransfers = async () => {
    setLoading(true);
    try {
      const [tRes, sRes] = await Promise.all([
        apiFetch('/transfers'),
        apiFetch('/stores')
      ]);
      if (tRes.success) setTransfers(tRes.transfers || []);
      if (sRes.success) setStores(sRes.stores || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  // When fromStoreId changes, load available phones in that store
  useEffect(() => {
    async function loadStoreStock() {
      if (!fromStoreId) return;
      setModalLoading(true);
      try {
        const res = await apiFetch(`/inventory?store_id=${fromStoreId}&stock_status=AVAILABLE&limit=50`);
        if (res.success) {
          setAvailablePhones(res.phones || []);
          setSelectedPhoneIds([]);
        }
      } catch (e) {}
      finally {
        setModalLoading(false);
      }
    }
    if (showModal) loadStoreStock();
  }, [fromStoreId, showModal]);

  const handleInitiate = async (e) => {
    e.preventDefault();
    if (!selectedPhoneIds.length) {
      alert('Please select at least one phone to transfer.');
      return;
    }

    try {
      const res = await apiFetch('/transfers', {
        method: 'POST',
        body: JSON.stringify({
          from_store_id: fromStoreId,
          to_store_id: toStoreId,
          phone_ids: selectedPhoneIds,
          notes
        })
      });

      if (res.success) {
        setShowModal(false);
        fetchTransfers();
        alert('Stock transfer initiated! Devices are now marked In Transit.');
      } else {
        alert(res.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleReceive = async (transferId) => {
    if (!window.confirm('Confirm that this stock shipment has arrived and been physically inspected at the destination store?')) return;

    try {
      const res = await apiFetch(`/transfers/${transferId}/receive`, {
        method: 'PATCH'
      });
      if (res.success) {
        fetchTransfers();
        alert('Stock received and added to store inventory successfully!');
      } else {
        alert(res.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCancel = async (transferId) => {
    if (!window.confirm('Cancel this transfer? Phones will revert to Available stock at the source store.')) return;

    try {
      const res = await apiFetch(`/transfers/${transferId}/cancel`, {
        method: 'PATCH'
      });
      if (res.success) {
        fetchTransfers();
        alert('Transfer cancelled and inventory restored.');
      } else {
        alert(res.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const viewTransferDetails = async (id) => {
    try {
      const res = await apiFetch(`/transfers/${id}`);
      if (res.success) setSelectedTransfer(res);
    } catch (e) {}
  };

  return (
    <div className="space-y-5">
      {}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-emerald-600" />
            Inter-Store Stock Transfers
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Logistical stock movement across all 12 physical branches with two-step handoff verification
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Stock Transfer</span>
        </button>
      </div>

      {}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">Loading stock transfers...</div>
        ) : transfers.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700 text-sm">No transfer records</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-4">Transfer #</th>
                  <th className="py-3 px-3">Dispatch Date</th>
                  <th className="py-3 px-3">Source Store</th>
                  <th className="py-3 px-3">Destination Store</th>
                  <th className="py-3 px-3 text-center">Devices</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transfers.map(trf => {
                  const badge = getStatusBadge(trf.status);
                  const isDestinationEmployee = !isAdmin && user?.assigned_store_id === trf.to_store_id;
                  const canReceive = (isAdmin || isDestinationEmployee) && (trf.status === 'In Transit' || trf.status === 'Pending');

                  return (
                    <tr key={trf.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-emerald-800">{trf.transfer_number}</span>
                        <div className="text-[10px] text-slate-400 mt-0.5">By: {trf.initiated_by_name}</div>
                      </td>

                      <td className="py-3 px-3 text-slate-600 font-medium">
                        {formatDate(trf.transfer_date)}
                      </td>

                      <td className="py-3 px-3 font-medium text-slate-800">
                        {trf.from_store_name}
                      </td>

                      <td className="py-3 px-3 font-medium text-slate-800">
                        {trf.to_store_name}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-slate-100 text-slate-800 border">
                          {trf.item_count || 1} Phones
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${badge.bg}`}>
                          {trf.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => viewTransferDetails(trf.id)}
                            className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                            title="View Phones in Transfer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {canReceive && (
                            <button
                              onClick={() => handleReceive(trf.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg shadow-xs transition"
                            >
                              Receive Stock
                            </button>
                          )}

                          {isAdmin && trf.status !== 'Received' && trf.status !== 'Cancelled' && (
                            <button
                              onClick={() => handleCancel(trf.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                              title="Cancel Transfer"
                            >
                              <XCircle className="w-4 h-4" />
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
      </div>

      {}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-xl w-full p-6 text-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">Initiate Inter-Store Stock Transfer</h3>
              <button onClick={() => setShowModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <form onSubmit={handleInitiate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Source Store *</label>
                  <select
                    disabled={!isAdmin}
                    value={fromStoreId}
                    onChange={(e) => setFromStoreId(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg font-medium"
                  >
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Destination Store *</label>
                  <select
                    value={toStoreId}
                    onChange={(e) => setToStoreId(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border rounded-lg font-medium"
                  >
                    {stores.filter(s => s.id !== parseInt(fromStoreId)).map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {}
              <div>
                <label className="font-bold text-slate-600 block mb-1">
                  Select Phones to Dispatch ({selectedPhoneIds.length} selected)
                </label>
                {modalLoading ? (
                  <div className="p-4 text-center text-slate-400">Loading store stock...</div>
                ) : availablePhones.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-lg">No available phones in source store to transfer.</div>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 p-1">
                    {availablePhones.map(phone => {
                      const selected = selectedPhoneIds.includes(phone.id);
                      return (
                        <label key={phone.id} className="p-2 hover:bg-slate-50 flex items-center justify-between cursor-pointer">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedPhoneIds([...selectedPhoneIds, phone.id]);
                                else setSelectedPhoneIds(selectedPhoneIds.filter(id => id !== phone.id));
                              }}
                              className="rounded text-emerald-600"
                            />
                            <div>
                              <span className="font-bold text-slate-900">{phone.brand} {phone.model}</span>
                              <span className="text-[10px] text-slate-400 font-mono ml-2">IMEI: {phone.imei1}</span>
                            </div>
                          </div>
                          <span className="font-bold text-emerald-700">{phone.condition_grade}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-600 block mb-1">Logistics / Transfer Notes</label>
                <input
                  type="text"
                  placeholder="e.g. BlueDart Courier AWB #449292"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border rounded-lg"
                />
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
                  disabled={!selectedPhoneIds.length}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold rounded-lg"
                >
                  Dispatch Shipment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {}
      {selectedTransfer && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-lg w-full p-6 text-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Transfer Details — {selectedTransfer.transfer.transfer_number}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {selectedTransfer.transfer.from_store_name} ➔ {selectedTransfer.transfer.to_store_name}
                </p>
              </div>
              <button onClick={() => setSelectedTransfer(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="space-y-2">
              <span className="font-bold text-slate-600 block uppercase text-[10px]">Transferred Devices</span>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-48 overflow-y-auto p-1">
                {selectedTransfer.items && selectedTransfer.items.map(it => (
                  <div key={it.id} className="p-2 flex justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{it.brand} {it.model}</div>
                      <div className="text-[10px] font-mono text-emerald-700">IMEI: {it.imei1}</div>
                    </div>
                    <span className="font-semibold text-slate-600">{it.condition_grade}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t flex justify-end">
              <button
                onClick={() => setSelectedTransfer(null)}
                className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
