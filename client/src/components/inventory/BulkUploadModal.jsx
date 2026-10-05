import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Smartphone, 
  Building2, 
  Layers, 
  Trash2, 
  RefreshCw,
  Info
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';

export default function BulkUploadModal({ isOpen, onClose, stores = [], suppliers = [], onSuccess }) {
  const fileInputRef = useRef(null);
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [targetStoreId, setTargetStoreId] = useState(stores[0]?.id || 1);
  const [targetSupplierId, setTargetSupplierId] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [parseError, setParseError] = useState('');

  if (!isOpen) return null;

  // Helper to parse numbers with currency symbols, commas, spaces
  const cleanNumber = (val, defaultVal = 0) => {
    if (val === null || val === undefined || val === '') return defaultVal;
    if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
    let str = String(val).trim().replace(/^(₹|rs\.?|inr|\$)\s*/i, '').replace(/,/g, '');
    const match = str.match(/-?\d+(\.\d+)?/);
    if (match) {
      const num = parseFloat(match[0]);
      return isNaN(num) ? defaultVal : num;
    }
    return defaultVal;
  };

  // Key normalization dictionary
  const normalizeKeys = (row) => {
    const normalized = {};
    for (const rawKey of Object.keys(row)) {
      const cleanKey = rawKey.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const val = row[rawKey];

      if (cleanKey === 'brand' || cleanKey === 'make' || cleanKey === 'manufacturer') {
        normalized.brand = val;
      } else if (cleanKey === 'model' || cleanKey === 'phonemodel' || cleanKey === 'modelname' || cleanKey === 'devicemodel') {
        normalized.model = val;
      } else if (cleanKey === 'imei' || cleanKey === 'imei1' || cleanKey === 'primaryimei') {
        normalized.imei1 = String(val).trim();
      } else if (cleanKey === 'imei2' || cleanKey === 'secondaryimei') {
        normalized.imei2 = String(val).trim();
      } else if (cleanKey === 'variant' || cleanKey === 'storagevariant') {
        normalized.variant = val;
      } else if (cleanKey === 'ram') {
        normalized.ram = val;
      } else if (cleanKey === 'storage' || cleanKey === 'rom') {
        normalized.storage = val;
      } else if (cleanKey === 'color' || cleanKey === 'colour') {
        normalized.color = val;
      } else if (cleanKey === 'serialnumber' || cleanKey === 'serial' || cleanKey === 'sn') {
        normalized.serial_number = val;
      } else if (cleanKey === 'conditiongrade' || cleanKey === 'grade' || cleanKey === 'condition') {
        normalized.condition_grade = val;
      } else if (cleanKey.includes('battery')) {
        normalized.battery_health = val;
      } else if (cleanKey.includes('purchase') || cleanKey.includes('buying') || cleanKey === 'cost' || cleanKey === 'purchasecost') {
        normalized.purchase_price = cleanNumber(val, 0);
      } else if (cleanKey.includes('refurb')) {
        normalized.refurbishment_cost = cleanNumber(val, 0);
      } else if (cleanKey.includes('additional') || cleanKey.includes('othercost')) {
        normalized.additional_cost = cleanNumber(val, 0);
      } else if (cleanKey.includes('selling') || cleanKey.includes('sales') || cleanKey.includes('retail') || cleanKey === 'price' || cleanKey === 'mrp') {
        normalized.selling_price = cleanNumber(val, 0);
      } else if (cleanKey === 'taxrate' || cleanKey === 'gst' || cleanKey === 'tax') {
        normalized.tax_rate = cleanNumber(val, 18.0);
      } else if (cleanKey.includes('store') || cleanKey.includes('branch')) {
        normalized.store_code = val;
      } else if (cleanKey.includes('supplier') || cleanKey.includes('vendor')) {
        normalized.supplier_name = String(val).trim();
        normalized.supplier_info = String(val).trim();
      } else if (cleanKey === 'supplierid') {
        normalized.supplier_id = val;
      } else if (cleanKey.includes('warranty')) {
        const m = String(val).match(/\d+/);
        normalized.warranty_period_months = m ? parseInt(m[0], 10) : 6;
      } else if (cleanKey.includes('note') || cleanKey.includes('remark') || cleanKey.includes('comment')) {
        normalized.notes = val;
      } else {
        normalized[cleanKey] = val;
      }
    }
    return normalized;
  };

  // Parse Excel / CSV File
  const handleFile = (file) => {
    setParseError('');
    setUploadResult(null);

    if (!file) return;

    const fileExt = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(fileExt)) {
      setParseError('Please upload an Excel spreadsheet (.xlsx, .xls) or CSV file.');
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          setParseError('The uploaded spreadsheet contains no data rows.');
          return;
        }

        const seenImeis = new Set();
        const processed = rawJson.map((row, idx) => {
          const item = normalizeKeys(row);
          const errors = [];

          if (!item.brand || !String(item.brand).trim()) {
            errors.push('Missing Brand');
          }
          if (!item.model || !String(item.model).trim()) {
            errors.push('Missing Model');
          }
          if (!item.imei1 || String(item.imei1).trim().length < 8) {
            errors.push('Invalid IMEI 1 (min 8 digits)');
          } else {
            const imeiClean = String(item.imei1).trim();
            if (seenImeis.has(imeiClean)) {
              errors.push('Duplicate IMEI in file');
            } else {
              seenImeis.add(imeiClean);
            }
          }
          if (!item.selling_price || isNaN(item.selling_price) || item.selling_price <= 0) {
            errors.push('Invalid Selling Price');
          }

          return {
            ...item,
            _rowIndex: idx + 2, // Excel row index
            _isValid: errors.length === 0,
            _errors: errors
          };
        });

        setParsedRows(processed);
      } catch (err) {
        console.error('File parsing error:', err);
        setParseError('Failed to parse Excel file. Please ensure it is a valid spreadsheet.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Drag & Drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Download Sample Template .xlsx
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Brand': 'Apple',
        'Model': 'iPhone 14 Pro',
        'Variant': '128GB',
        'RAM': '6GB',
        'Storage': '128GB',
        'Color': 'Space Black',
        'IMEI 1': '864920051234567',
        'IMEI 2': '864920051234568',
        'Serial Number': 'F2LZN10X0M9Q',
        'Condition Grade': 'Grade A',
        'Battery Health': '98%',
        'Purchase Price': 45000,
        'Refurbishment Cost': 1200,
        'Additional Cost': 300,
        'Selling Price': 62000,
        'Tax Rate': 18,
        'Store Code': stores[0]?.code || 'MUM-BKC',
        'Supplier Info': suppliers[0]?.name || 'ReTech Global Wholesale',
        'Warranty Months': 6,
        'Notes': '64-point certified tested'
      },
      {
        'Brand': 'Samsung',
        'Model': 'Galaxy S23 Ultra',
        'Variant': '256GB / 12GB',
        'RAM': '12GB',
        'Storage': '256GB',
        'Color': 'Phantom Black',
        'IMEI 1': '864920059876543',
        'IMEI 2': '',
        'Serial Number': 'R5CT90AB12D',
        'Condition Grade': 'Grade A',
        'Battery Health': '95%',
        'Purchase Price': 42000,
        'Refurbishment Cost': 800,
        'Additional Cost': 200,
        'Selling Price': 58000,
        'Tax Rate': 18,
        'Store Code': stores[0]?.code || 'MUM-BKC',
        'Supplier Info': suppliers[1]?.name || 'Apex Mobile Recyclers',
        'Warranty Months': 6,
        'Notes': 'Pristine display, S-Pen included'
      },
      {
        'Brand': 'OnePlus',
        'Model': 'OnePlus 11 5G',
        'Variant': '128GB / 8GB',
        'RAM': '8GB',
        'Storage': '128GB',
        'Color': 'Eternal Green',
        'IMEI 1': '864920054567890',
        'IMEI 2': '',
        'Serial Number': '',
        'Condition Grade': 'Grade B',
        'Battery Health': '91%',
        'Purchase Price': 22000,
        'Refurbishment Cost': 500,
        'Additional Cost': 150,
        'Selling Price': 32000,
        'Tax Rate': 18,
        'Store Code': stores[0]?.code || 'MUM-BKC',
        'Supplier Info': suppliers[2]?.name || 'Nordic Devices India',
        'Warranty Months': 6,
        'Notes': 'Minor bezel scratch'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);

    // Auto-size columns
    const colWidths = [
      { wch: 12 }, // Brand
      { wch: 20 }, // Model
      { wch: 15 }, // Variant
      { wch: 8 },  // RAM
      { wch: 10 }, // Storage
      { wch: 14 }, // Color
      { wch: 18 }, // IMEI 1
      { wch: 18 }, // IMEI 2
      { wch: 16 }, // Serial
      { wch: 15 }, // Grade
      { wch: 14 }, // Battery
      { wch: 14 }, // Purchase Price
      { wch: 16 }, // Refurb Cost
      { wch: 14 }, // Additional Cost
      { wch: 14 }, // Selling Price
      { wch: 10 }, // Tax Rate
      { wch: 12 }, // Store Code
      { wch: 24 }, // Supplier Info
      { wch: 15 }, // Warranty
      { wch: 25 }, // Notes
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock_Import_Template');
    XLSX.writeFile(workbook, 'Ecofone_Inventory_Bulk_Import_Template.xlsx');
  };

  // Submit Bulk Ingestion to API
  const handleUploadStock = async () => {
    const validRows = parsedRows.filter(r => r._isValid);
    if (validRows.length === 0) {
      alert('No valid device records found to import.');
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const res = await apiFetch('/inventory/bulk-upload', {
        method: 'POST',
        body: JSON.stringify({
          devices: validRows,
          default_store_id: parseInt(targetStoreId),
          default_supplier_id: targetSupplierId ? parseInt(targetSupplierId) : null,
          default_purchase_date: new Date().toISOString().split('T')[0]
        })
      });

      if (res.success) {
        setUploadResult(res);
        if (onSuccess) onSuccess();
      } else {
        alert(res.message || 'Bulk upload failed.');
      }
    } catch (err) {
      alert(err.message || 'An error occurred during bulk upload.');
    } finally {
      setUploading(false);
    }
  };

  const validCount = parsedRows.filter(r => r._isValid).length;
  const invalidCount = parsedRows.length - validCount;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-xs">
        
        {}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-white">Bulk Excel Stock Upload</h3>
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Fast Inward
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Upload .xlsx, .xls, or .csv files to instantly ingest batches of phones into inventory
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-xs"
              title="Download formatted Excel spreadsheet template"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Excel Template</span>
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          
          {}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Assign To Store Outlet *
              </label>
              <select
                value={targetStoreId}
                onChange={(e) => setTargetStoreId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
              >
                {stores.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code}) - {s.city}</option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Applied to all rows unless overridden in the Excel "Store Code" column
              </span>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Default Supplier / Source
              </label>
              <select
                value={targetSupplierId}
                onChange={(e) => setTargetSupplierId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700"
              >
                <option value="">None / Corporate Purchase</option>
                {suppliers.map(sup => (
                  <option key={sup.id} value={sup.id}>{sup.name} ({sup.city || 'Vendor'})</option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Vendor attribution for inward accounting
              </span>
            </div>
          </div>

          {}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer ${
              dragActive 
                ? 'border-emerald-500 bg-emerald-50/50' 
                : selectedFile 
                ? 'border-emerald-400 bg-emerald-50/20' 
                : 'border-slate-300 hover:border-emerald-400 bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => handleFile(e.target.files[0])}
              className="hidden"
            />
            
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2.5">
              <Upload className="w-6 h-6" />
            </div>

            {selectedFile ? (
              <div>
                <p className="font-extrabold text-sm text-slate-900">{selectedFile.name}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {(selectedFile.size / 1024).toFixed(1)} KB • Click or drag another file to replace
                </p>
              </div>
            ) : (
              <div>
                <p className="font-extrabold text-sm text-slate-800">
                  Drag & drop your Excel spreadsheet here, or <span className="text-emerald-600 underline">browse</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Supports .xlsx, .xls, and .csv files formatted with standard device columns
                </p>
              </div>
            )}
          </div>

          {}
          {parseError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {}
          {uploadResult && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>{uploadResult.message}</span>
              </div>
              <div className="flex gap-4 text-xs text-emerald-800 font-medium">
                <span>Successfully Ingested: <strong>{uploadResult.importedCount} devices</strong></span>
                {uploadResult.failedCount > 0 && (
                  <span className="text-rose-700">Skipped: <strong>{uploadResult.failedCount} rows</strong></span>
                )}
              </div>
              {uploadResult.failedRows && uploadResult.failedRows.length > 0 && (
                <div className="mt-2 text-[11px] bg-white p-2.5 rounded-lg border border-emerald-100 space-y-1">
                  <span className="font-bold text-slate-700 block">Skipped Details:</span>
                  {uploadResult.failedRows.map((f, i) => (
                    <div key={i} className="text-slate-600">
                      Row {f.row} ({f.imei}): <span className="text-rose-600 font-medium">{f.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {}
          {parsedRows.length > 0 && !uploadResult && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                    Spreadsheet Preview ({parsedRows.length} rows)
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    {validCount} Valid
                  </span>
                  {invalidCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                      {invalidCount} Errors
                    </span>
                  )}
                </div>

                <button
                  onClick={() => {
                    setParsedRows([]);
                    setSelectedFile(null);
                  }}
                  className="text-slate-400 hover:text-rose-600 text-[11px] flex items-center gap-1 font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>

              {}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-[11px] divide-y divide-slate-100">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[9px] sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Brand & Model</th>
                      <th className="py-2 px-3">IMEI 1</th>
                      <th className="py-2 px-3">Variant / Grade</th>
                      <th className="py-2 px-3">Supplier Info</th>
                      <th className="py-2 px-3">Purchase Cost</th>
                      <th className="py-2 px-3">Selling Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {parsedRows.map((row, i) => (
                      <tr key={i} className={`hover:bg-slate-50 ${row._isValid ? '' : 'bg-rose-50/40'}`}>
                        <td className="py-2 px-3">
                          {row._isValid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[10px]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              Valid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-700 font-bold text-[10px]" title={row._errors.join(', ')}>
                              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                              {row._errors[0]}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          {row.brand} {row.model}
                        </td>
                        <td className="py-2 px-3 font-mono font-medium text-slate-700">
                          {row.imei1 || <span className="text-rose-500 italic">Missing</span>}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {row.variant || 'Standard'} • <span className="font-semibold">{row.condition_grade || 'Grade A'}</span>
                        </td>
                        <td className="py-2 px-3">
                          {row.supplier_name ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-semibold text-[10px]">
                              {row.supplier_name}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px] italic">
                              {suppliers.find(s => String(s.id) === String(targetSupplierId))?.name || 'Default Supplier'}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-700">
                          {formatCurrency(row.purchase_price || 0)}
                        </td>
                        <td className="py-2 px-3 font-bold text-emerald-700">
                          {formatCurrency(row.selling_price || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <Info className="w-3.5 h-3.5" />
            <span>Only valid rows with unique IMEIs will be imported into available stock.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              {uploadResult ? 'Done' : 'Cancel'}
            </button>

            {parsedRows.length > 0 && !uploadResult && (
              <button
                type="button"
                onClick={handleUploadStock}
                disabled={uploading || validCount === 0}
                className={`px-5 py-2 rounded-xl font-bold text-white shadow-md transition flex items-center gap-2 ${
                  uploading || validCount === 0
                    ? 'bg-slate-300 cursor-not-allowed shadow-none'
                    : 'bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99]'
                }`}
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Importing {validCount} Devices...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Ingest {validCount} Devices</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
