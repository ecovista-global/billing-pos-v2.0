import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, CheckCircle, Smartphone, Building, User, Receipt, Phone, Mail, FileText, Check } from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime, numberToWordsINR } from '../../utils/formatters';

export default function InvoiceModal({ invoiceData, onClose, onNewSale }) {
  const [printFormat, setPrintFormat] = useState('a4'); // 'a4' | 'thermal'

  if (!invoiceData) return null;
  const { sale, items = [], payments = [], exchange, company = {} } = invoiceData;

  // Split items into phones and accessories for precise tax & margin breakdown
  const phoneItems = items.filter(i => i.item_type !== 'accessory' && !i.accessory_id);
  const accessoryItems = items.filter(i => i.item_type === 'accessory' || i.accessory_id);
  const hasPhones = phoneItems.length > 0;
  const hasAccessories = accessoryItems.length > 0;

  const phoneTax = phoneItems.reduce((acc, i) => acc + (parseFloat(i.total_tax) || 0), 0);

  const accessoryTaxable = accessoryItems.reduce((acc, i) => acc + (parseFloat(i.taxable_amount) || 0), 0);
  const accessoryTax = accessoryItems.reduce((acc, i) => acc + (parseFloat(i.total_tax) || 0), 0);

  const handlePrint = (format) => {
    setPrintFormat(format);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 invoice-modal-backdrop print:p-0 print:m-0 print:static print:bg-white print:overflow-visible">
      {/* Injected @page dynamic rule for perfect margins */}
      {printFormat === 'a4' ? (
        <style type="text/css" media="print">
          {`
            @page { 
              size: A4 portrait; 
              margin: 6mm 8mm; 
            }
          `}
        </style>
      ) : (
        <style type="text/css" media="print">
          {`@page { size: 80mm auto; margin: 3mm 2mm; }`}
        </style>
      )}

      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150 invoice-modal-dialog print:shadow-none print:border-none print:max-w-none print:max-h-none print:overflow-visible print:rounded-none">
        
        {/* Modal Top Bar (Hidden during print) */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Tax Invoice — {sale?.invoice_number}
            </span>
            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
              PAID
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePrint('a4')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition ${
                printFormat === 'a4' 
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print A4 Invoice</span>
            </button>
            <button
              onClick={() => handlePrint('thermal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                printFormat === 'thermal'
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 text-amber-400" />
              <span>Print Thermal (80mm)</span>
            </button>
            {onNewSale && (
              <button
                onClick={onNewSale}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition ml-2"
              >
                + New Sale
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Bill Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50/50 invoice-modal-content print:p-0 print:m-0 print:bg-white print:overflow-visible">
          
          {/* Printable Invoice Container */}
          <div 
            id="printable-invoice" 
            className={`bg-white mx-auto print:border-none print:shadow-none print:p-0 print:m-0 ${
              printFormat === 'thermal' 
                ? 'thermal-receipt-container max-w-[340px] p-4 border border-slate-300 rounded-xl shadow-xs' 
                : 'a4-invoice-container max-w-3xl p-6 sm:p-8 border border-slate-200 rounded-2xl shadow-xs'
            }`}
          >
            
            {printFormat === 'thermal' ? (
              /* ================= 80mm THERMAL RECEIPT LAYOUT ================= */
              <div className="text-slate-900 font-mono text-[11px] leading-relaxed">
                <div className="text-center pb-2 border-b border-dashed border-slate-400">
                  <div className="font-extrabold text-sm tracking-wider uppercase">{company.company_name || 'ECOFONE'}</div>
                  <div className="text-[10px] text-slate-600">{company.company_tagline || 'Luxury within reach'}</div>
                  <div className="text-[10px] font-semibold mt-1">{sale?.store_name}</div>
                  <div className="text-[9px] text-slate-500">{sale?.store_address}, {sale?.store_city}</div>
                  <div className="text-[9px] font-bold text-slate-700">GSTIN: {sale?.store_gstin || company.company_gstin}</div>
                </div>

                <div className="py-2 border-b border-dashed border-slate-400 text-[10px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>INVOICE:</span>
                    <span className="font-bold">{sale?.invoice_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DATE:</span>
                    <span>{formatDateTime(sale?.sale_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CASHIER:</span>
                    <span>{sale?.employee_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>CUSTOMER:</span>
                    <span className="font-bold">{sale?.customer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>PHONE:</span>
                    <span>{sale?.customer_phone}</span>
                  </div>
                </div>

                {/* Items */}
                <div className="py-2 border-b border-dashed border-slate-400 space-y-2 text-[10px]">
                  {items.map((item, idx) => {
                    const isAccessory = item.item_type === 'accessory' || item.accessory_id;
                    return (
                      <div key={idx} className="space-y-0.5">
                        <div className="font-bold flex justify-between items-start">
                          <span>{item.brand ? `${item.brand} ` : ''}{item.model} {item.variant ? `(${item.variant})` : ''}</span>
                          {isAccessory && <span className="text-[8px] font-semibold bg-emerald-100 text-emerald-800 px-1 rounded ml-1">NEW</span>}
                        </div>
                        {isAccessory ? (
                          <div className="text-[9px] text-slate-600 flex justify-between">
                            <span>Qty: {item.quantity || 1} × {formatCurrency(item.selling_price)} (Incl. 18% GST)</span>
                            <span className="font-bold text-slate-900">{formatCurrency(item.final_price)}</span>
                          </div>
                        ) : (
                          <>
                            <div className="text-[9px] text-slate-600">IMEI: {item.imei1}</div>
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[8px] font-bold uppercase bg-amber-100 text-amber-900 border border-amber-300 px-1 py-0.2 rounded leading-tight">
                                  Refurbished
                                </span>
                                <span className="font-mono text-[9px] font-semibold text-slate-700">HSN: {item.hsn_code || '8517'}</span>
                              </div>
                              <span className="font-bold text-slate-900">{formatCurrency(item.final_price)}</span>
                            </div>
                          </>
                        )}
                        {item.discount > 0 && (
                          <div className="flex justify-between text-[9px] text-rose-600">
                            <span>Discount:</span>
                            <span>-{formatCurrency(item.discount)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Financials */}
                <div className="py-2 border-b border-dashed border-slate-400 text-[10px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(sale?.subtotal)}</span>
                  </div>
                  {phoneTax > 0 && (
                    <div className="flex justify-between text-[9px] text-emerald-700">
                      <span>Phone (GST 5%) :</span>
                      <span>+{formatCurrency(phoneTax)}</span>
                    </div>
                  )}
                  {accessoryTaxable > 0 && (
                    <div className="flex justify-between text-[9px] text-slate-600">
                      <span>Accessory Taxable Val:</span>
                      <span>{formatCurrency(accessoryTaxable)}</span>
                    </div>
                  )}
                  {accessoryTax > 0 && (
                    <div className="flex justify-between text-[9px] text-emerald-700">
                      <span>GST (18% Incl. in Acc):</span>
                      <span>{formatCurrency(accessoryTax)}</span>
                    </div>
                  )}
                  {sale?.total_tax > 0 && (
                    <div className="flex justify-between text-[9px] text-slate-700 font-semibold pt-0.5 border-t border-dotted border-slate-300">
                      <span>Total GST:</span>
                      <span>+{formatCurrency(sale?.total_tax)}</span>
                    </div>
                  )}
                  {sale?.discount_total > 0 && (
                    <div className="flex justify-between text-rose-600 font-semibold">
                      <span>Discount (on Total):</span>
                      <span>-{formatCurrency(sale?.discount_total)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-extrabold text-xs pt-1 border-t border-slate-400">
                    <span>{sale?.exchange_amount > 0 ? 'BILL TOTAL:' : 'TOTAL:'}</span>
                    <span>{formatCurrency(sale?.grand_total)}</span>
                  </div>
                  {sale?.exchange_amount > 0 && (
                    <div className="space-y-0.5 pt-0.5 border-t border-dashed border-slate-400">
                      <div className="flex justify-between text-[9px] text-emerald-800 font-bold">
                        <span>EXCHANGE CREDIT:</span>
                        <span>-{formatCurrency(sale.exchange_amount)}</span>
                      </div>
                      {exchange && (
                        <div className="text-[8px] text-slate-500 italic">
                          ({exchange.brand} {exchange.model} • IMEI: {exchange.imei1})
                        </div>
                      )}
                      <div className="flex justify-between font-black text-xs pt-0.5 border-t border-slate-400">
                        <span>NET PAID:</span>
                        <span>{formatCurrency(sale.net_payable !== undefined && sale.net_payable !== null ? sale.net_payable : Math.max(0, sale.grand_total - sale.exchange_amount))}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between text-[9px] pt-0.5">
                    <span>PAID VIA:</span>
                    <span className="font-bold uppercase">{payments[0]?.payment_method || 'CASH'}</span>
                  </div>
                </div>

                <div className="pt-2 text-center text-[9px] text-slate-600 space-y-1">
                  {hasPhones ? (
                    <p className="font-bold text-slate-800">6 MONTHS ECOFONE CERTIFIED WARRANTY</p>
                  ) : (
                    <p className="font-bold text-slate-800">BRAND NEW 100% GENUINE ACCESSORIES</p>
                  )}
                  <p className="text-[8px] text-slate-500">
                    {hasAccessories && 'Acc. prices include 18% GST. '}
                    {hasPhones && 'Phones taxed under Rule 32(5) Margin Scheme.'}
                  </p>
                  <p className="pt-0.5 font-semibold text-slate-800">Thank you for visiting Ecofone!</p>
                  <p className="text-[10px] font-bold">www.ecofone.in</p>
                </div>
              </div>
            ) : (
              /* ================= FULL A4 TAX INVOICE LAYOUT (STRICT SINGLE PAGE) ================= */
              <div className="space-y-2.5 print:space-y-1.5 text-slate-800 text-xs a4-invoice-container">
                
                {/* Header: Branding & Store info */}
                <div className="flex items-start justify-between border-b border-slate-300 pb-2.5 print:pb-1.5 print-avoid-break">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 print:w-10 print:h-10 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-xs shrink-0">
                      <img src="/logo.png" alt="Ecofone Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <h1 className="text-lg print:text-base font-black tracking-tight text-slate-900 leading-tight">
                        {company.company_name || 'Ecofone'}
                      </h1>
                      <p className="text-[11px] print:text-[10px] font-bold text-amber-600">
                        {company.company_tagline || 'Luxury within reach'}
                      </p>
                      <p className="text-[10px] print:text-[9.5px] text-slate-600 max-w-md mt-0.5 leading-snug">
                        {sale?.store_address ? `${sale.store_address}, ${sale.store_city}` : company.company_address}
                      </p>
                      <p className="text-[10px] print:text-[9.5px] text-slate-700 mt-0.5">
                        GSTIN: <span className="font-bold text-slate-900">{sale?.store_gstin || company.company_gstin}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="inline-block px-2.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded text-[11px] font-black uppercase tracking-wider">
                      TAX INVOICE
                    </div>
                    <div className="text-[11px] font-bold text-slate-900 mt-1">
                      Invoice #: <span className="font-mono text-emerald-800 font-extrabold">{sale?.invoice_number}</span>
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">
                      Date: <span className="font-medium text-slate-900">{formatDateTime(sale?.sale_date)}</span>
                    </div>
                    <div className="text-[10px] text-slate-600">
                      Store: <span className="font-semibold text-slate-900">{sale?.store_name} ({sale?.store_code})</span>
                    </div>
                    <div className="text-[10px] text-slate-600">
                      Cashier: <span className="font-medium text-slate-900">{sale?.employee_name}</span>
                    </div>
                  </div>
                </div>

                {/* Customer Details & Payment Box */}
                <div className="grid grid-cols-2 gap-3 p-2.5 print:p-2 border border-slate-200 rounded-xl bg-slate-50/80 text-[11px] print-avoid-break">
                  <div>
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 block">Billed To (Customer):</span>
                    <span className="font-bold text-slate-900 block text-xs mt-0.5">{sale?.customer_name}</span>
                    <span className="text-slate-700 block mt-0.5">Phone: <strong>{sale?.customer_phone}</strong></span>
                    {sale?.customer_email && <span className="text-slate-600 block text-[10px]">Email: {sale.customer_email}</span>}
                    {sale?.customer_address && <span className="text-slate-600 block text-[10px]">Address: {sale.customer_address}</span>}
                  </div>
                  <div className="text-right">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 block">Payment Details:</span>
                    <span className="text-slate-700 block mt-0.5">
                      Mode: <strong className="text-slate-900 uppercase">{payments[0]?.payment_method || 'Cash'}</strong>
                    </span>
                    {payments[0]?.reference_number && (
                      <span className="text-slate-600 block text-[10px] font-mono">Ref/Txn: {payments[0].reference_number}</span>
                    )}
                    <span className="inline-block mt-0.5 px-2 py-0.2 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[9px]">
                      STATUS: FULLY PAID
                    </span>
                  </div>
                </div>

                {/* Product Details Table */}
                <div className="print-avoid-break overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-300 bg-slate-100 text-slate-700 uppercase text-[9.5px] tracking-wider font-bold">
                        <th className="py-1.5 px-1.5 text-center w-7">#</th>
                        <th className="py-1.5 px-1.5">Item Description & Details</th>
                        <th className="py-1.5 px-1.5 text-center w-28">HSN / Category</th>
                        <th className="py-1.5 px-1.5 text-center w-8">Qty</th>
                        <th className="py-1.5 px-1.5 text-right w-20">Unit Price</th>
                        <th className="py-1.5 px-1.5 text-right w-14">Disc.</th>
                        <th className="py-1.5 px-1.5 text-right w-16">GST</th>
                        <th className="py-1.5 px-1.5 text-right w-20">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {items.map((item, idx) => {
                        const isAccessory = item.item_type === 'accessory' || item.accessory_id;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-1.5 px-1.5 text-center text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                            <td className="py-1.5 px-1.5">
                              {isAccessory ? (
                                <>
                                  <div className="font-bold text-slate-900 text-xs">
                                    {item.brand ? `${item.brand} ` : ''}{item.model}
                                  </div>
                                  <div className="text-[9.5px] text-slate-600">
                                    {item.accessory_category || item.category || 'Accessory'} {item.variant ? `• ${item.variant}` : ''}
                                  </div>
                                  <div className="text-[8.5px] text-emerald-700 font-semibold">
                                    Brand New • 18% GST Incl.
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="font-bold text-slate-900 text-xs">
                                    {item.brand} {item.model}
                                  </div>
                                  <div className="text-[9.5px] text-slate-600">
                                    {item.variant} {item.color ? `• ${item.color}` : ''}
                                  </div>
                                  <div className="text-[9.5px] font-mono text-emerald-800 font-bold">
                                    IMEI 1: {item.imei1}
                                  </div>
                                  <div className="text-[8.5px] text-slate-500">
                                    Warranty: 6 Months Ecofone Certified
                                  </div>
                                </>
                              )}
                            </td>
                            <td className="py-1.5 px-1.5 text-center">
                              {isAccessory ? (
                                <span className="text-slate-300 font-mono text-xs">—</span>
                              ) : (
                                <div className="flex flex-col items-center justify-center gap-0.5">
                                  <span className="px-1.5 py-0.5 text-[8px] font-extrabold uppercase rounded bg-amber-50 text-amber-800 border border-amber-300 inline-block leading-none tracking-wide">
                                    Refurbished
                                  </span>
                                  <span className="font-mono text-[10.5px] font-bold text-slate-800 tracking-wider">
                                    {item.hsn_code || '8517'}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="py-1.5 px-1.5 text-center font-bold text-slate-800 text-xs">
                              {isAccessory ? (item.quantity || 1) : 1}
                            </td>
                            <td className="py-1.5 px-1.5 text-right font-medium text-slate-700 text-xs">
                              <div>{formatCurrency(item.selling_price)}</div>
                              {isAccessory && (
                                <div className="text-[7.5px] text-slate-400 font-medium">(Incl. GST)</div>
                              )}
                            </td>
                            <td className="py-1.5 px-1.5 text-right font-medium text-xs">
                              {item.discount > 0 ? (
                                <div>
                                  <div className="text-rose-600 font-bold">-{formatCurrency(item.discount)}</div>
                                </div>
                              ) : (
                                <span className="text-slate-400">₹0</span>
                              )}
                            </td>
                            <td className="py-1.5 px-1.5 text-right text-slate-600 text-xs">
                              <div className="font-semibold text-emerald-800">+{formatCurrency(item.total_tax)}</div>
                              <div className="text-[7.5px] text-slate-400">
                                {isAccessory ? '(18% Incl.)' : `(${item.tax_rate || 5}%)`}
                              </div>
                            </td>
                            <td className="py-1.5 px-1.5 text-right font-bold text-slate-900 text-xs">
                              {formatCurrency(item.final_price)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Financial Breakdown & Amount in Words */}
                <div className="mt-2.5 print:mt-1.5 pt-2 print:pt-1 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 print:gap-2 print-avoid-break">
                  <div>
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      Amount Chargeable (in words):
                    </span>
                    <p className="text-[11px] font-bold text-slate-800 italic bg-slate-50 p-1.5 rounded-lg border border-slate-200 leading-snug">
                      {numberToWordsINR(sale?.exchange_amount > 0 ? (sale.net_payable !== undefined && sale.net_payable !== null ? sale.net_payable : Math.max(0, sale.grand_total - sale.exchange_amount)) : sale?.grand_total)}
                    </p>

                    {/* Exchanged Device Details Box */}
                    {sale?.exchange_amount > 0 && exchange && (
                      <div className="mt-1.5 p-1.5 rounded-lg bg-amber-50/80 border border-amber-200 text-[9.5px] text-amber-950 leading-tight">
                        <span className="font-bold block text-amber-900 mb-0.5">Exchange Device Credited:</span>
                        <div className="font-semibold text-slate-800">{exchange.brand} {exchange.model} {exchange.variant ? `(${exchange.variant})` : ''}</div>
                        <div className="text-[8.5px] text-slate-600">
                          IMEI: <span className="font-mono font-bold text-slate-800">{exchange.imei1}</span>
                        </div>
                        <div className="text-[8.5px] font-bold text-emerald-700 mt-0.5">
                          Credit: {formatCurrency(sale.exchange_amount)}
                        </div>
                      </div>
                    )}

                    <div className="mt-1.5 p-1.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-[9px] text-emerald-950 flex items-center gap-1.5 leading-snug">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-bold block">
                          {hasPhones ? '64-Point Quality Certified & Tested' : '100% Genuine Brand New Products'}
                        </span>
                        <span>
                          {hasPhones 
                            ? '6 Months Ecofone Certified Replacement / Repair Warranty' 
                            : 'Manufacturer warranty policies applicable'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-0.5 text-[11px] sm:ml-auto w-full sm:max-w-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal (Items):</span>
                      <span className="font-medium">{formatCurrency(sale?.subtotal)}</span>
                    </div>
                    {phoneTax > 0 && (
                      <div className="flex justify-between text-slate-600 text-[10px]">
                        <span>Phone (GST 5%) :</span>
                        <span className="font-semibold text-emerald-800">+{formatCurrency(phoneTax)}</span>
                      </div>
                    )}
                    {accessoryTaxable > 0 && (
                      <div className="flex justify-between text-slate-700 font-medium">
                        <span>Taxable Value (Accessories):</span>
                        <span className="font-semibold">{formatCurrency(accessoryTaxable)}</span>
                      </div>
                    )}
                    {accessoryTax > 0 && (
                      <div className="flex justify-between text-slate-600 text-[10px]">
                        <span>Accessory GST (18% Inclusive):</span>
                        <span className="font-semibold text-emerald-800">+{formatCurrency(accessoryTax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-700 pt-0.5 border-t border-slate-200">
                      <span>Total GST:</span>
                      <span className="font-bold text-emerald-800">+{formatCurrency(sale?.total_tax)}</span>
                    </div>
                    <div className="flex justify-between text-slate-800 font-semibold">
                      <span>Total (Items + GST):</span>
                      <span>{formatCurrency((sale?.subtotal || 0) + (sale?.total_tax || 0))}</span>
                    </div>
                    {sale?.discount_total > 0 && (
                      <div className="flex justify-between text-rose-600 font-medium">
                        <span>Discount (Applied on Total):</span>
                        <span className="font-bold">-{formatCurrency(sale?.discount_total)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs sm:text-sm font-black text-slate-900 pt-1 border-t border-slate-900">
                      <span>Grand Total:</span>
                      <span className="text-emerald-800">{formatCurrency(sale?.grand_total)}</span>
                    </div>

                    {/* Exchange Deduction Breakdown */}
                    {sale?.exchange_amount > 0 && (
                      <>
                        <div className="flex justify-between text-emerald-800 font-bold text-[11px] pt-0.5 border-t border-dashed border-slate-300">
                          <span>Less: Exchange Credit:</span>
                          <span>-{formatCurrency(sale.exchange_amount)}</span>
                        </div>
                        <div className="flex justify-between text-xs sm:text-sm font-black text-slate-900 pt-0.5 border-t-2 border-slate-900">
                          <span>Net Payable / Paid:</span>
                          <span className="text-emerald-900">{formatCurrency(sale.net_payable !== undefined && sale.net_payable !== null ? sale.net_payable : Math.max(0, sale.grand_total - sale.exchange_amount))}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Terms & Conditions & Authorized Sign */}
                <div className="mt-2.5 print:mt-1 pt-1.5 border-t border-slate-200 grid grid-cols-3 gap-4 text-[9px] print:text-[8.5px] text-slate-500 print-avoid-break">
                  <div className="col-span-2">
                    <span className="font-bold text-slate-700 uppercase tracking-wider block mb-0.5">Terms & Conditions:</span>
                    <p className="whitespace-pre-line leading-tight text-slate-600">
                      {company.invoice_terms || '1. 6 Months certified hardware warranty included on phones.\n2. Warranty void if liquid/physical damage or unauthorized repair.\n3. Original tax invoice required for warranty claims.\n4. Disputes subject to store local jurisdiction.'}
                    </p>
                  </div>
                  <div className="text-center flex flex-col justify-end">
                    <div className="border-b border-slate-300 pb-4"></div>
                    <span className="font-bold text-slate-800 uppercase tracking-wider mt-0.5 block text-[9px]">Authorized Signatory</span>
                    <span className="text-slate-500 text-[8px]">{company.company_name || 'Ecofone India Pvt Ltd'}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-1.5 text-center text-[8px] text-slate-400 border-t border-slate-100 pt-1 print-avoid-break leading-snug">
                  {company.invoice_footer || 'Computer generated tax invoice under Section 31 of CGST Act, 2017. All accessory prices are inclusive of applicable 18% GST. Refurbished phones are taxed under Rule 32(5) Margin Scheme (5% GST on selling price - purchase price). Thank you for choosing Ecofone! For warranty visit www.ecofone.in'}
                </div>

              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
}
