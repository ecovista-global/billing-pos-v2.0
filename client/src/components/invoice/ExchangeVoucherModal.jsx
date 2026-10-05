import React from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, ShieldCheck, Smartphone, User, ArrowLeftRight } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

export default function ExchangeVoucherModal({ exchange, onClose }) {
  if (!exchange) return null;

  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 voucher-modal-backdrop invoice-modal-backdrop print:p-0 print:m-0 print:static print:bg-white print:overflow-visible">
      {}
      <style type="text/css" media="print">
        {`
          @page { 
            size: A4 portrait; 
            margin: 10mm 12mm; 
          }
        `}
      </style>

      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full p-6 text-xs space-y-4 voucher-modal-dialog invoice-modal-dialog print:p-0 print:m-0 print:shadow-none print:border-none print:max-w-none print:max-h-none print:overflow-visible print:rounded-none">
        
        {}
        <div className="flex items-center justify-between border-b pb-3 no-print">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-sm text-slate-900">Customer Trade-In & Handover Voucher</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Voucher</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {}
        <div 
          id="printable-voucher" 
          className="border border-slate-300 rounded-xl p-6 bg-white space-y-4 text-slate-800 a4-voucher-container print-avoid-break print:border-none print:p-0 print:space-y-4"
        >
          
          {}
          <div className="flex justify-between items-start border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-sm">
                  E
                </div>
                <h2 className="text-base font-black uppercase text-slate-900 tracking-tight">ECOFONE ELECTRONICS</h2>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Certified Pre-Owned Premium Smartphones & Accessories</p>
              <p className="text-[10px] text-slate-700 font-semibold mt-0.5">
                {exchange.store_name || 'Ecofone Store'} {exchange.store_city ? `(${exchange.store_city})` : ''}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Voucher Ref:</span>
              <span className="text-xs font-mono font-black text-slate-900">{exchange.exchange_number}</span>
              <div className="text-[10px] text-slate-500 mt-0.5">{formatDateTime(exchange.exchange_date)}</div>
            </div>
          </div>

          {}
          <div className="text-center py-1.5 bg-slate-100 rounded-lg text-slate-800 font-extrabold uppercase tracking-wide text-[11px] border border-slate-200/60">
            DEVICE EXCHANGE & OWNERSHIP TRANSFER DECLARATION
          </div>

          {}
          <div className="grid grid-cols-2 gap-4 text-xs">
            
            {}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Customer Information</span>
              <p className="font-bold text-slate-900 text-sm">{exchange.customer_name}</p>
              <p className="text-slate-600 font-medium">Phone: {exchange.customer_phone}</p>
              {exchange.customer_id_proof_number && (
                <p className="text-[10px] font-mono font-semibold text-slate-700 pt-0.5">
                  KYC: {exchange.customer_id_proof_type || 'ID Proof'} — {exchange.customer_id_proof_number}
                </p>
              )}
            </div>

            {}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Exchanged Device Details</span>
              <p className="font-bold text-slate-900 text-sm">{exchange.brand} {exchange.model}</p>
              <p className="font-mono text-slate-800 font-bold text-xs">IMEI: {exchange.imei1}</p>
              <p className="text-slate-600 text-[11px]">
                Condition: <span className="font-semibold text-slate-800">{exchange.condition_grade}</span> {exchange.battery_health ? `• Battery: ${exchange.battery_health}%` : ''}
              </p>
              {exchange.diagnostic_remarks && (
                <p className="text-[10px] text-slate-500 italic">
                  Note: {exchange.diagnostic_remarks}
                </p>
              )}
            </div>

          </div>

          {}
          <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center print:bg-emerald-50/80">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 block">
                Agreed Exchange Valuation / Credit
              </span>
              <span className="text-[10px] text-emerald-700 font-medium">
                Credited against Sale Bill #{exchange.sale_invoice_number || 'Direct Trade-In'}
              </span>
            </div>
            <div className="text-xl font-black text-emerald-800 tracking-tight">
              {formatCurrency(exchange.exchange_value)}
            </div>
          </div>

          {}
          <div className="text-[9.5px] text-slate-600 leading-relaxed border-t border-slate-200 pt-3 space-y-1">
            <p className="font-bold text-slate-800">Customer Declaration & Ownership Transfer:</p>
            <p className="text-justify">
              I hereby declare that I am the legal and sole owner of the aforementioned mobile device. The device has not been stolen, blacklisted, or subjected to any insurance claim or legal dispute. All personal data, accounts, and locks (iCloud / Google FRP / Passcode) have been completely removed by me prior to handing over the device to Ecofone. I voluntarily transfer full ownership of this device to Ecofone in exchange for the agreed credit valuation noted above.
            </p>
          </div>

          {}
          <div className="grid grid-cols-2 gap-8 pt-10 border-t border-dashed border-slate-300 print:pt-8">
            <div className="text-center">
              <div className="border-t border-slate-400 w-3/4 mx-auto mb-1"></div>
              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Customer Signature</span>
              <div className="text-[9px] text-slate-400 mt-0.5">{exchange.customer_name}</div>
            </div>
            <div className="text-center">
              <div className="border-t border-slate-400 w-3/4 mx-auto mb-1"></div>
              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">Authorized Ecofone Representative</span>
              <div className="text-[9px] text-slate-500 mt-0.5">({exchange.employee_name || 'Authorized Staff'})</div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
