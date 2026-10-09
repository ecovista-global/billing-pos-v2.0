import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  Package,
  Building2,
  Trash2,
  RefreshCw,
  Info,
  Sparkles
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';

export default function AccessoryBulkUploadModal({ isOpen, onClose, stores = [], onSuccess }) {
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [targetStoreId, setTargetStoreId] = useState(stores[0]?.id || 1);
  const [defaultSupplierName, setDefaultSupplierName] = useState('Apex Mobile Distribution Hub');
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [parseError, setParseError] = useState('');

  useEffect(() => {
    if (stores && stores.length > 0) {
      if (!targetStoreId || !stores.some(s => String(s.id) === String(targetStoreId))) {
        setTargetStoreId(stores[0].id);
      }
    }
  }, [stores, targetStoreId]);

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

  const cleanInteger = (val, defaultVal = 0) => {
    if (val === null || val === undefined || val === '') return defaultVal;
    if (typeof val === 'number') return isNaN(val) ? defaultVal : Math.round(val);
    let str = String(val).trim().replace(/,/g, '');
    const match = str.match(/-?\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      return isNaN(num) ? defaultVal : num;
    }
    return defaultVal;
  };

  // Key normalization dictionary (robust matching for any template or user header format)
  const normalizeKeys = (row) => {
    const normalized = {};
    for (const rawKey of Object.keys(row)) {
      const key = rawKey.trim();
      const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      const val = row[rawKey];

      // 1. Product Name
      if (
        cleanKey === 'productname' ||
        cleanKey === 'name' ||
        cleanKey === 'accessoryname' ||
        cleanKey === 'itemname' ||
        cleanKey === 'title' ||
        cleanKey === 'product'
      ) {
        normalized.name = val ? String(val).trim() : '';
      } 
      // 2. Category
      else if (
        cleanKey === 'category' ||
        cleanKey === 'cat' ||
        cleanKey === 'type' ||
        cleanKey === 'productcategory'
      ) {
        normalized.category = val ? String(val).trim() : 'Chargers';
      } 
      // 3. Brand
      else if (
        cleanKey === 'brand' ||
        cleanKey === 'make' ||
        cleanKey === 'manufacturer' ||
        cleanKey === 'company'
      ) {
        normalized.brand = val ? String(val).trim() : '';
      } 
      // 4. Variant / Model
      else if (
        cleanKey === 'variant' ||
        cleanKey === 'model' ||
        cleanKey === 'variantmodel' ||
        cleanKey === 'color' ||
        cleanKey === 'specification' ||
        cleanKey === 'specs'
      ) {
        normalized.variant = val ? String(val).trim() : '';
      } 
      // 5. Quantity
      else if (
        cleanKey === 'quantity' ||
        cleanKey === 'qty' ||
        cleanKey === 'units' ||
        cleanKey === 'stock' ||
        cleanKey === 'stockqty' ||
        cleanKey === 'openingstock' ||
        cleanKey === 'initialstock'
      ) {
        normalized.quantity = cleanInteger(val, 10);
      } 
      // 6. Purchase Price (checked before general 'price')
      else if (
        cleanKey.includes('purchase') ||
        cleanKey.includes('cost') ||
        cleanKey.includes('buying') ||
        cleanKey === 'pp' ||
        cleanKey === 'purchaseprice'
      ) {
        normalized.purchase_price_inclusive = cleanNumber(val, 0);
      } 
      // 7. Selling Price
      else if (
        cleanKey.includes('selling') ||
        cleanKey.includes('sales') ||
        cleanKey.includes('retail') ||
        cleanKey === 'sp' ||
        cleanKey === 'sellingprice' ||
        cleanKey === 'price' ||
        cleanKey === 'rate'
      ) {
        normalized.selling_price_inclusive = cleanNumber(val, 0);
      } 
      // 8. MRP
      else if (
        cleanKey.startsWith('mrp') ||
        cleanKey.includes('listprice') ||
        cleanKey.includes('maximumretailprice')
      ) {
        normalized.mrp_inclusive = cleanNumber(val, 0);
      } 
      // 9. SKU
      else if (
        cleanKey === 'sku' ||
        cleanKey === 'skucode' ||
        cleanKey === 'productcode' ||
        cleanKey === 'itemcode' ||
        cleanKey === 'code'
      ) {
        normalized.sku = val ? String(val).trim().toUpperCase() : '';
      } 
      // 10. Barcode / EAN
      else if (
        cleanKey.includes('barcode') ||
        cleanKey === 'ean' ||
        cleanKey === 'upc' ||
        cleanKey === 'barcodeean'
      ) {
        normalized.barcode = val ? String(val).trim() : '';
      } 
      // 11. Minimum Stock
      else if (
        cleanKey.includes('minstock') ||
        cleanKey.includes('minimumstock') ||
        cleanKey === 'min' ||
        cleanKey === 'minimumqty'
      ) {
        normalized.minimum_stock = cleanInteger(val, 5);
      } 
      // 12. Reorder Level
      else if (
        cleanKey.includes('reorder')
      ) {
        normalized.reorder_level = cleanInteger(val, 10);
      } 
      // 13. Warranty Period
      else if (
        cleanKey.includes('warranty')
      ) {
        normalized.warranty_period = val ? String(val).trim() : '6 Months Brand Warranty';
      } 
      // 14. Store Code / Branch
      else if (
        cleanKey.includes('store') ||
        cleanKey.includes('branch')
      ) {
        normalized.store_code = val ? String(val).trim() : '';
      } 
      // 15. Supplier Name
      else if (
        cleanKey.includes('supplier') ||
        cleanKey.includes('vendor') ||
        cleanKey.includes('distributor')
      ) {
        normalized.supplier_name = val ? String(val).trim() : '';
      } 
      // 16. Description / Notes
      else if (
        cleanKey.includes('description') ||
        cleanKey.includes('notes') ||
        cleanKey.includes('remarks') ||
        cleanKey.includes('details')
      ) {
        normalized.description = val ? String(val).trim() : '';
      } 
      else {
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

        const processed = rawJson.map((row, idx) => {
          const norm = normalizeKeys(row);
          const errors = [];

          if (!norm.name) errors.push('Missing product name');
          if (!norm.brand) errors.push('Missing brand');

          const sPrice = cleanNumber(norm.selling_price_inclusive, 0);
          if (sPrice <= 0) errors.push('Selling price must be > ₹0');

          const pPrice = cleanNumber(norm.purchase_price_inclusive, 0);
          const qty = cleanInteger(norm.quantity, 10);

          // Compute 18% inclusive GST for preview
          const sellingTaxable = Math.round((sPrice * 100 / 118) * 100) / 100;
          const sellingGst = Math.round((sPrice - sellingTaxable) * 100) / 100;

          const purchaseTaxable = Math.round((pPrice * 100 / 118) * 100) / 100;
          const purchaseGst = Math.round((pPrice - purchaseTaxable) * 100) / 100;

          return {
            _index: idx + 1,
            _isValid: errors.length === 0,
            _errors: errors,
            name: norm.name || '',
            category: norm.category || 'Chargers',
            brand: norm.brand || '',
            variant: norm.variant || '',
            sku: norm.sku || '',
            barcode: norm.barcode || '',
            quantity: qty,
            purchase_price_inclusive: pPrice,
            purchase_taxable_value: purchaseTaxable,
            purchase_gst: purchaseGst,
            selling_price_inclusive: sPrice,
            selling_taxable_value: sellingTaxable,
            selling_gst: sellingGst,
            mrp_inclusive: cleanNumber(norm.mrp_inclusive, sPrice),
            minimum_stock: cleanInteger(norm.minimum_stock, 5),
            reorder_level: cleanInteger(norm.reorder_level, 10),
            store_code: norm.store_code || '',
            supplier_name: norm.supplier_name || defaultSupplierName,
            warranty_period: norm.warranty_period || '6 Months Brand Warranty',
            description: norm.description || ''
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
        'Product Name': '65W GaN Fast Charger Dual Port',
        'Category': 'Chargers',
        'Brand': 'Ecofone Power',
        'Variant / Model': 'Type-C + USB-A White',
        'Quantity': 25,
        'Purchase Price (Incl 18% GST)': 1180,
        'Selling Price (Incl 18% GST)': 1999,
        'MRP (Incl 18% GST)': 2499,
        'SKU': 'ECO-CHG-65W',
        'Barcode / EAN': '890123450001',
        'Store Code': stores[0]?.code || 'MAIN-01',
        'Supplier Name': 'Apex Mobile Distribution Hub',
        'Minimum Stock': 5,
        'Reorder Level': 10,
        'Warranty Period': '6 Months Brand Warranty',
        'Description / Notes': '65W GaN adapter, dual fast charging output'
      },
      {
        'Product Name': 'Braided Type-C to Lightning Cable 1.5m',
        'Category': 'Cables',
        'Brand': 'Apple',
        'Variant / Model': '1.5m Grey Braided',
        'Quantity': 50,
        'Purchase Price (Incl 18% GST)': 590,
        'Selling Price (Incl 18% GST)': 999,
        'MRP (Incl 18% GST)': 1299,
        'SKU': 'APL-CBL-15M',
        'Barcode / EAN': '890123450002',
        'Store Code': stores[0]?.code || 'MAIN-01',
        'Supplier Name': 'Apex Mobile Distribution Hub',
        'Minimum Stock': 10,
        'Reorder Level': 20,
        'Warranty Period': '6 Months Brand Warranty',
        'Description / Notes': 'PD fast charging support up to 27W'
      },
      {
        'Product Name': '10000mAh Magnetic Wireless Power Bank',
        'Category': 'Power Banks',
        'Brand': 'Anker',
        'Variant / Model': '10000mAh MagSafe Black',
        'Quantity': 15,
        'Purchase Price (Incl 18% GST)': 2124,
        'Selling Price (Incl 18% GST)': 3499,
        'MRP (Incl 18% GST)': 3999,
        'SKU': 'ANK-PB-10K',
        'Barcode / EAN': '890123450003',
        'Store Code': stores[0]?.code || 'MAIN-01',
        'Supplier Name': 'Nordic Devices India',
        'Minimum Stock': 3,
        'Reorder Level': 8,
        'Warranty Period': '1 Year Manufacturer Warranty',
        'Description / Notes': '15W wireless, 20W PD Type-C input/output'
      },
      {
        'Product Name': '9H Edge-to-Edge Tempered Glass Screen Protector',
        'Category': 'Screen Protectors',
        'Brand': 'Ecofone Shield',
        'Variant / Model': 'iPhone 15 / 15 Pro',
        'Quantity': 60,
        'Purchase Price (Incl 18% GST)': 118,
        'Selling Price (Incl 18% GST)': 499,
        'MRP (Incl 18% GST)': 699,
        'SKU': 'ECO-SCR-IP15',
        'Barcode / EAN': '890123450004',
        'Store Code': stores[0]?.code || 'MAIN-01',
        'Supplier Name': 'Apex Mobile Distribution Hub',
        'Minimum Stock': 15,
        'Reorder Level': 30,
        'Warranty Period': 'No Warranty',
        'Description / Notes': 'Oleophobic anti-fingerprint coating'
      },
      {
        'Product Name': 'True Wireless Earbuds with ANC 30H Playtime',
        'Category': 'TWS Earbuds & Audio',
        'Brand': 'Boat',
        'Variant / Model': 'Airdopes 441 Pro / Matte Blue',
        'Quantity': 20,
        'Purchase Price (Incl 18% GST)': 1062,
        'Selling Price (Incl 18% GST)': 1899,
        'MRP (Incl 18% GST)': 2990,
        'SKU': 'BOT-TWS-441',
        'Barcode / EAN': '890123450005',
        'Store Code': stores[0]?.code || 'MAIN-01',
        'Supplier Name': 'Direct Wholesale',
        'Minimum Stock': 5,
        'Reorder Level': 10,
        'Warranty Period': '1 Year Brand Warranty',
        'Description / Notes': 'Active noise cancellation, IPX7 water resistance'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);

    const colWidths = [
      { wch: 35 }, // Product Name
      { wch: 18 }, // Category
      { wch: 16 }, // Brand
      { wch: 22 }, // Variant
      { wch: 10 }, // Quantity
      { wch: 24 }, // Purchase Price (Incl 18% GST)
      { wch: 24 }, // Selling Price (Incl 18% GST)
      { wch: 18 }, // MRP (Incl 18% GST)
      { wch: 16 }, // SKU
      { wch: 18 }, // Barcode
      { wch: 12 }, // Store Code
      { wch: 26 }, // Supplier Name
      { wch: 14 }, // Min Stock
      { wch: 14 }, // Reorder Level
      { wch: 22 }, // Warranty
      { wch: 35 }  // Description
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Accessories_Import');
    XLSX.writeFile(workbook, 'Ecofone_Accessories_Bulk_Import_Template.xlsx');
  };

  // Submit Bulk Ingestion to API
  const handleUploadAccessories = async () => {
    const validRows = parsedRows.filter((r) => r._isValid);
    if (validRows.length === 0) {
      alert('No valid accessory records found to import.');
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const res = await apiFetch('/accessories/bulk-upload', {
        method: 'POST',
        body: JSON.stringify({
          accessories: validRows,
          default_store_id: parseInt(targetStoreId, 10),
          default_supplier_name: defaultSupplierName
        })
      });

      if (res.success) {
        setUploadResult(res);
        if (onSuccess) onSuccess();
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        alert(res.message || 'Bulk upload failed.');
      }
    } catch (err) {
      alert(err.message || 'An error occurred during bulk upload.');
    } finally {
      setUploading(false);
    }
  };

  const validCount = parsedRows.filter((r) => r._isValid).length;
  const invalidCount = parsedRows.filter((r) => !r._isValid).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white text-slate-900 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Bulk Upload Accessories</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Import dozens or hundreds of accessories at once via Excel (.xlsx, .xls) or CSV.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          
          {}
          <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-start gap-3 text-xs text-indigo-950 leading-relaxed">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-indigo-900 mb-0.5">Critical Accessories Business Rules:</span>
              <span>
                1. All accessories uploaded are <strong>Brand New</strong> (no refurbishment/used grading fields).<br />
                2. Both <strong>Purchase Price</strong> and <strong>Selling Price</strong> entered in Excel are strictly <strong>18% GST-inclusive</strong>. The system will auto-extract the 18% GST and taxable components without double-charging tax.
              </span>
            </div>
          </div>

          {}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Default Target Store
              </label>
              <select
                value={targetStoreId}
                onChange={(e) => setTargetStoreId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Applied if row leaves Store Code blank
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Default Supplier / Vendor
              </label>
              <input
                type="text"
                value={defaultSupplierName}
                onChange={(e) => setDefaultSupplierName(e.target.value)}
                placeholder="e.g. Apex Mobile Hub"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Applied if row leaves Supplier blank
              </span>
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold transition shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Download Excel Template</span>
              </button>
              <span className="text-[10px] text-center text-slate-400 mt-0.5 block">
                Pre-formatted columns with sample data
              </span>
            </div>
          </div>

          {}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
              dragActive
                ? 'border-indigo-500 bg-indigo-50/50 scale-[0.99]'
                : selectedFile
                ? 'border-emerald-400 bg-emerald-50/30'
                : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={(e) => e.target.files && handleFile(e.target.files[0])}
              className="hidden"
            />

            <div className="max-w-md mx-auto space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-xs border border-indigo-100">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-800 block">
                  {selectedFile ? selectedFile.name : 'Click to select or drag & drop Excel sheet'}
                </span>
                <span className="text-xs text-slate-400 mt-0.5 block">
                  Supports Microsoft Excel (.xlsx, .xls) and CSV spreadsheets
                </span>
              </div>

              {selectedFile && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-slate-200 text-xs text-slate-600 shadow-xs">
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                  <span>•</span>
                  <span className="font-bold text-emerald-700">{parsedRows.length} Rows Parsed</span>
                </div>
              )}
            </div>
          </div>

          {}
          {parseError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{parseError}</span>
            </div>
          )}

          {}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Data Preview ({parsedRows.length} items)
                  </h3>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                      {validCount} Valid
                    </span>
                    {invalidCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold">
                        {invalidCount} Needs Attention
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setParsedRows([]);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-xs text-slate-400 hover:text-rose-600 transition flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-h-72 overflow-y-auto shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 z-10">
                    <tr>
                      <th className="py-2 px-2.5 text-center w-10">#</th>
                      <th className="py-2 px-2.5 text-center w-16">Status</th>
                      <th className="py-2 px-3">Product Name & Variant</th>
                      <th className="py-2 px-2.5">Category</th>
                      <th className="py-2 px-2.5">Brand</th>
                      <th className="py-2 px-2.5 text-center">Qty</th>
                      <th className="py-2 px-3 text-right">Purchase (Incl 18%)</th>
                      <th className="py-2 px-3 text-right">Selling (Incl 18%)</th>
                      <th className="py-2 px-2.5 text-right">18% GST</th>
                      <th className="py-2 px-2.5">SKU / Code</th>
                      <th className="py-2 px-2 text-center w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((r) => (
                      <tr key={r._index} className={r._isValid ? 'hover:bg-slate-50/60' : 'bg-rose-50/40'}>
                        <td className="py-2 px-2.5 text-center font-mono text-[10px] text-slate-400">
                          {r._index}
                        </td>
                        <td className="py-2 px-2.5 text-center">
                          {r._isValid ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                              Valid
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 text-rose-800"
                              title={r._errors.join(', ')}
                            >
                              Invalid
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900">{r.name || '—'}</div>
                          {r.variant && <div className="text-[10px] text-slate-500">{r.variant}</div>}
                          {!r._isValid && (
                            <div className="text-[10px] text-rose-600 font-semibold mt-0.5">
                              {r._errors.join(' • ')}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2.5">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium text-[10px]">
                            {r.category}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 font-semibold text-slate-800">{r.brand || '—'}</td>
                        <td className="py-2 px-2.5 text-center font-bold text-slate-800">{r.quantity}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600">
                          <div>{formatCurrency(r.purchase_price_inclusive)}</div>
                          <div className="text-[9px] text-slate-400">
                            (Taxable: {formatCurrency(r.purchase_taxable_value)})
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800">
                          <div>{formatCurrency(r.selling_price_inclusive)}</div>
                          <div className="text-[9px] text-slate-400 font-normal">
                            (Taxable: {formatCurrency(r.selling_taxable_value)})
                          </div>
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-xs text-amber-700 font-medium">
                          +{formatCurrency(r.selling_gst)}
                        </td>
                        <td className="py-2 px-2.5 font-mono text-[10px] text-slate-500">
                          {r.sku || '<Auto>'}
                        </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => setParsedRows(prev => prev.filter((item) => item._index !== r._index))}
                          className="p-1 text-slate-300 hover:text-rose-600 rounded transition"
                          title="Discard row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {}
          {uploadResult && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{uploadResult.message}</span>
              </div>
              <p className="text-xs text-emerald-800">
                Successfully imported <strong>{uploadResult.importedCount}</strong> accessories with automatic 18% GST calculation and stock allocation.
              </p>
              {uploadResult.failedCount > 0 && (
                <div className="text-xs text-rose-700 bg-white/80 p-2 rounded-lg border border-rose-200">
                  {uploadResult.failedCount} records failed validation or duplicate checks.
                </div>
              )}
            </div>
          )}

        </div>

        {}
        <div className="px-6 py-4 border-t border-slate-200 bg-white rounded-b-2xl flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {parsedRows.length > 0 && (
              <span>
                Ready to import <strong>{validCount}</strong> valid accessories into inventory.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={validCount === 0 || uploading}
              onClick={handleUploadAccessories}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow-md transition transform active:scale-98"
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Importing Accessories...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Import {validCount} Accessories</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
