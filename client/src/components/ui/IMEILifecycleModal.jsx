import React, { useState, useEffect } from 'react';
import { 
  X, 
  Smartphone, 
  Truck, 
  ShoppingBag, 
  ShieldCheck, 
  RotateCcw, 
  ArrowLeftRight, 
  IndianRupee, 
  Building2, 
  User,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { formatCurrency, formatDate, getStatusBadge } from '../../utils/formatters';

export default function IMEILifecycleModal({ imei, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchLifecycle() {
      if (!imei) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/inventory/imei/${encodeURIComponent(imei.trim())}`);
        if (res.success) {
          setData(res);
        } else {
          setError(res.message || 'Device not found.');
        }
      } catch (err) {
        setError(err.message || 'Failed to retrieve device lifecycle history.');
      } finally {
        setLoading(false);
      }
    }

    fetchLifecycle();
  }, [imei]);

  if (!imei) return null;

  const phone = data?.phone;
  const badge = getStatusBadge(phone?.stock_status);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
        
        {}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                  Device Lifecycle & Traceability
                </h3>
                {phone && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                    {phone.stock_status}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                IMEI 1: {imei} {phone?.imei2 ? `| IMEI 2: ${phone.imei2}` : ''}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="py-12 text-center text-slate-500 text-sm">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-3"></div>
              <p>Scanning blockchain-grade device history...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {phone && (
            <>
              {}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Model</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">{phone.brand} {phone.model}</span>
                  <span className="text-slate-500 text-[11px]">{phone.variant}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Condition & Battery</span>
                  <span className="font-semibold text-slate-800 text-xs mt-0.5 block">{phone.condition_grade}</span>
                  <span className="text-emerald-700 font-medium text-[11px]">Health: {phone.battery_health || '90%+'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Current Store</span>
                  <span className="font-semibold text-slate-800 text-xs mt-0.5 block">{phone.store_name}</span>
                  <span className="text-slate-500 text-[11px]">{phone.store_city} ({phone.store_code})</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Retail Price</span>
                  <span className="font-bold text-emerald-700 text-sm mt-0.5 block">{formatCurrency(phone.selling_price)}</span>
                  <span className="text-[10px] text-slate-400">ID: {phone.internal_product_id}</span>
                </div>
              </div>

              {}
              <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <IndianRupee className="w-4 h-4 text-emerald-600" />
                  Cost & Margin Structure (True Cost Basis)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 text-[11px] block">Purchase Price</span>
                    <span className="font-bold text-slate-800 text-sm">{formatCurrency(phone.purchase_price)}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 text-[11px] block">Refurbishment Cost</span>
                    <span className="font-bold text-slate-800 text-sm">{formatCurrency(phone.refurbishment_cost)}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-slate-400 text-[11px] block">Other Expenses</span>
                    <span className="font-bold text-slate-800 text-sm">{formatCurrency(phone.additional_cost)}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                    <span className="text-emerald-700 text-[11px] font-semibold block">Total Cost of Goods</span>
                    <span className="font-extrabold text-emerald-900 text-sm">{formatCurrency(phone.total_cost)}</span>
                  </div>
                </div>
                {phone.supplier_name && (
                  <div className="text-[11px] text-slate-500 mt-2.5 pt-2 border-t border-slate-100">
                    Sourced from: <strong className="text-slate-700">{phone.supplier_name}</strong> on {formatDate(phone.purchase_date)}
                  </div>
                )}
              </div>

              {}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Lifecycle Event History
                </h4>

                <div className="relative border-l-2 border-emerald-500 ml-3 space-y-4 pl-4 py-1 text-xs">
                  {}
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1 w-3 h-3 bg-emerald-600 rounded-full ring-4 ring-emerald-100"></div>
                    <div className="font-bold text-slate-900">Added to Inventory</div>
                    <div className="text-slate-500 text-[11px]">
                      Device passed 64-point certified diagnostic check and graded as {phone.condition_grade}. Added on {formatDate(phone.date_added)}.
                    </div>
                  </div>

                  {}
                  {data?.transfers && data.transfers.map(trf => (
                    <div key={trf.id} className="relative">
                      <div className="absolute -left-[21px] top-1 w-3 h-3 bg-amber-500 rounded-full ring-4 ring-amber-100"></div>
                      <div className="font-bold text-slate-900">
                        Inter-Store Transfer ({trf.transfer_number}) — <span className="text-amber-600">{trf.status}</span>
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        From: {trf.from_store_name} ➔ To: {trf.to_store_name} | Dispatched by {trf.initiated_by_name} on {formatDate(trf.transfer_date)}.
                        {trf.received_date && ` Received by ${trf.received_by_name} on ${formatDate(trf.received_date)}.`}
                      </div>
                    </div>
                  ))}

                  {}
                  {data?.saleInfo ? (
                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 w-3 h-3 bg-blue-600 rounded-full ring-4 ring-blue-100"></div>
                      <div className="font-bold text-slate-900">
                        Sold & Invoiced ({data.saleInfo.invoice_number})
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        Sold to <strong className="text-slate-800">{data.saleInfo.customer_name}</strong> (Phone: {data.saleInfo.customer_phone}) by {data.saleInfo.sold_by_employee} for {formatCurrency(data.saleInfo.final_price)} on {formatDate(data.saleInfo.sale_date)}.
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 w-3 h-3 bg-emerald-500 rounded-full ring-4 ring-emerald-100"></div>
                      <div className="font-bold text-emerald-700">Ready for Sale</div>
                      <div className="text-slate-500 text-[11px]">Currently in stock and ready at {phone.store_name}.</div>
                    </div>
                  )}

                  {}
                  {data?.warrantyInfo && (
                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 w-3 h-3 bg-purple-600 rounded-full ring-4 ring-purple-100"></div>
                      <div className="font-bold text-slate-900">
                        Certified Ecofone Warranty ({data.warrantyInfo.status})
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        Coverage valid from {formatDate(data.warrantyInfo.start_date)} to {formatDate(data.warrantyInfo.end_date)} ({data.warrantyInfo.warranty_period_months} Months).
                      </div>
                    </div>
                  )}

                  {}
                  {data?.returnInfo && data.returnInfo.length > 0 && data.returnInfo.map(ret => (
                    <div key={ret.id} className="relative">
                      <div className="absolute -left-[21px] top-1 w-3 h-3 bg-rose-600 rounded-full ring-4 ring-rose-100"></div>
                      <div className="font-bold text-rose-800">
                        Sales Return Processed ({ret.return_number})
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        Reason: {ret.reason}. Refunded: {formatCurrency(ret.refund_amount)} on {formatDate(ret.return_date)}.
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition"
          >
            Close Overview
          </button>
        </div>

      </div>
    </div>
  );
}
