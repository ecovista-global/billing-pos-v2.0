import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/api';
import {
  Package,
  Plus,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Tag,
  Sparkles,
  Truck,
  Info,
  X,
  Edit2,
  Trash2,
  Layers,
  ArrowUpRight,
  Receipt,
  FileSpreadsheet,
  Upload
} from 'lucide-react';
import AccessoryBulkUploadModal from '../../components/accessories/AccessoryBulkUploadModal';

const DEFAULT_ACCESSORY_CATEGORIES = [
  'Chargers',
  'Cables',
  'Cases & Covers',
  'Screen Protectors',
  'Power Banks',
  'TWS Earbuds & Audio',
  'Car Mounts & Chargers',
  'Smartwatch Bands & Straps',
  'Memory Cards & Adapters',
  'Stands & Holders',
  'Other Accessories'
];

export default function Accessories() {
  const { user, isAdmin } = useAuth();

  const [accessories, setAccessories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [selectedStoreId, setSelectedStoreId] = useState(isAdmin ? '' : user?.assigned_store_id || '');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [editingAccessory, setEditingAccessory] = useState(null);
  const [selectedForRestock, setSelectedForRestock] = useState(null);
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    name: '',
    category: DEFAULT_ACCESSORY_CATEGORIES[0],
    brand: '',
    variant: '',
    description: '',
    sku: '',
    barcode: '',
    supplier_name: '',
    purchase_price_inclusive: '',
    mrp_inclusive: '',
    selling_price_inclusive: '',
    quantity: '10',
    minimum_stock: '5',
    reorder_level: '10',
    store_id: '',
    warranty_period: '6 Months Brand Warranty'
  });

  // Form State for Batch Restock
  const [restockData, setRestockData] = useState({
    quantity: '50',
    purchase_price_inclusive: '',
    purchase_order_no: '',
    supplier_name: ''
  });

  // Load Initial Stores & Categories
  useEffect(() => {
    async function loadStores() {
      try {
        const res = await apiFetch('/stores');
        if (res.success) {
          setStores(res.stores || []);
          if (isAdmin && !selectedStoreId && res.stores.length > 0) {
            // Default to empty for all stores, or specific store
          }
        }
      } catch (err) {
        console.error('Failed to load stores:', err);
      }
    }
    loadStores();
  }, [isAdmin]);

  // Fetch Accessories
  const fetchAccessories = async () => {
    setLoading(true);
    setError('');
    try {
      let query = `/accessories?page=1&limit=100`;
      if (selectedStoreId) query += `&store_id=${selectedStoreId}`;
      if (selectedCategory) query += `&category=${encodeURIComponent(selectedCategory)}`;
      if (selectedStatus) query += `&status=${encodeURIComponent(selectedStatus)}`;
      if (searchTerm.trim()) query += `&search=${encodeURIComponent(searchTerm.trim())}`;

      const res = await apiFetch(query);
      if (res.success) {
        setAccessories(res.accessories || []);
        if (res.categories) setCategories(res.categories);
      } else {
        setError(res.message || 'Failed to fetch accessories.');
      }
    } catch (err) {
      setError(err.message || 'Network error fetching accessories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccessories();
  }, [selectedStoreId, selectedCategory, selectedStatus]);

  // Live Math calculations for form preview
  const formSellingInclusive = parseFloat(formData.selling_price_inclusive) || 0;
  const formSellingTaxable = Math.round((formSellingInclusive * 100 / 118) * 100) / 100;
  const formSellingGst = Math.round((formSellingInclusive - formSellingTaxable) * 100) / 100;

  const formPurchaseInclusive = parseFloat(formData.purchase_price_inclusive) || 0;
  const formPurchaseTaxable = Math.round((formPurchaseInclusive * 100 / 118) * 100) / 100;
  const formPurchaseGst = Math.round((formPurchaseInclusive - formPurchaseTaxable) * 100) / 100;

  // Merged categories from defaults, database, and current item
  const allCategoryOptions = Array.from(new Set([
    ...DEFAULT_ACCESSORY_CATEGORIES,
    ...categories,
    ...(formData.category ? [formData.category] : [])
  ])).filter(Boolean);

  // Open Create Modal
  const openCreateModal = () => {
    setEditingAccessory(null);
    setIsCustomCategory(false);
    setFormData({
      name: '',
      category: DEFAULT_ACCESSORY_CATEGORIES[0],
      brand: '',
      variant: '',
      description: '',
      sku: '',
      barcode: '',
      supplier_name: 'Apex Mobile Distribution Hub',
      purchase_price_inclusive: '',
      mrp_inclusive: '',
      selling_price_inclusive: '',
      quantity: '10',
      minimum_stock: '5',
      reorder_level: '10',
      store_id: selectedStoreId || (stores[0]?.id ? String(stores[0].id) : ''),
      warranty_period: '6 Months Brand Warranty'
    });
    setShowAddModal(true);
  };

  // Open Edit Modal
  const openEditModal = (acc) => {
    setEditingAccessory(acc);
    setIsCustomCategory(false);
    setFormData({
      name: acc.name,
      category: acc.category || DEFAULT_ACCESSORY_CATEGORIES[0],
      brand: acc.brand,
      variant: acc.variant || '',
      description: acc.description || '',
      sku: acc.sku,
      barcode: acc.barcode || '',
      supplier_name: acc.supplier_name || '',
      supplier_id: acc.supplier_id ? String(acc.supplier_id) : '',
      purchase_price_inclusive: String(acc.purchase_price_inclusive),
      mrp_inclusive: String(acc.mrp_inclusive),
      selling_price_inclusive: String(acc.selling_price_inclusive),
      quantity: String(acc.quantity),
      minimum_stock: String(acc.minimum_stock),
      reorder_level: String(acc.reorder_level),
      store_id: String(acc.store_id),
      warranty_period: acc.warranty_period || '6 Months'
    });
    setShowAddModal(true);
  };

  // Open Restock Modal
  const openRestockModal = (acc) => {
    setSelectedForRestock(acc);
    setRestockData({
      quantity: '50',
      purchase_price_inclusive: String(acc.purchase_price_inclusive),
      purchase_order_no: `PO-ACC-${Date.now().toString().slice(-6)}`,
      supplier_name: acc.supplier_name || 'Apex Mobile Distribution Hub'
    });
    setShowRestockModal(true);
  };

  // Save (Create / Update)
  const handleSaveAccessory = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        ...formData,
        purchase_price_inclusive: parseFloat(formData.purchase_price_inclusive) || 0,
        mrp_inclusive: parseFloat(formData.mrp_inclusive) || parseFloat(formData.selling_price_inclusive) || 0,
        selling_price_inclusive: parseFloat(formData.selling_price_inclusive) || 0,
        quantity: parseInt(formData.quantity, 10) || 0,
        minimum_stock: parseInt(formData.minimum_stock, 10) || 5,
        reorder_level: parseInt(formData.reorder_level, 10) || 10,
        store_id: parseInt(formData.store_id, 10),
        supplier_id: formData.supplier_id ? parseInt(formData.supplier_id, 10) : null
      };

      let res;
      if (editingAccessory) {
        res = await apiFetch(`/accessories/${editingAccessory.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        res = await apiFetch('/accessories', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      if (res.success) {
        setSuccessMsg(editingAccessory ? 'Accessory updated successfully!' : 'Brand new accessory added successfully!');
        setShowAddModal(false);
        fetchAccessories();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setError(res.message || 'Failed to save accessory.');
      }
    } catch (err) {
      setError(err.message || 'Error saving accessory.');
    }
  };

  // Handle Restock Batch Submit
  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const qty = parseInt(restockData.quantity, 10);
      const pPrice = parseFloat(restockData.purchase_price_inclusive);

      const res = await apiFetch('/accessories/purchase', {
        method: 'POST',
        body: JSON.stringify({
          accessory_id: selectedForRestock.id,
          quantity: qty,
          purchase_price_inclusive: pPrice,
          purchase_order_no: restockData.purchase_order_no,
          supplier_name: restockData.supplier_name
        })
      });

      if (res.success) {
        setSuccessMsg(`Restocked ${qty} units of ${selectedForRestock.name} successfully!`);
        setShowRestockModal(false);
        fetchAccessories();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setError(res.message || 'Failed to restock accessory.');
      }
    } catch (err) {
      setError(err.message || 'Error during restock.');
    }
  };

  // Handle Delete Accessory (Super Admin)
  const handleDeleteAccessory = async (acc) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete this accessory?\n\n` +
      `Product: ${acc.name} (${acc.brand})\n` +
      `SKU: ${acc.sku}\n` +
      `In-Stock: ${acc.quantity} units\n\n` +
      `This will permanently remove the accessory item and all its sales records.`
    );
    if (!confirmDelete) return;

    try {
      const res = await apiFetch(`/accessories/${acc.id}`, {
        method: 'DELETE'
      });
      if (res.success) {
        setSuccessMsg(res.message || 'Accessory deleted permanently.');
        fetchAccessories();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        setError(res.message || 'Failed to delete accessory.');
      }
    } catch (err) {
      setError(err.message || 'Error deleting accessory.');
    }
  };

  // Format currency
  const formatINR = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(Number(val) || 0);
  };

  // Summary Metrics
  const totalUnits = accessories.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalRetailValue = accessories.reduce((sum, item) => sum + (item.quantity * item.selling_price_inclusive || 0), 0);
  const totalTaxableCost = accessories.reduce((sum, item) => sum + (item.quantity * item.purchase_taxable_value || 0), 0);
  const lowStockCount = accessories.filter(item => item.quantity <= item.minimum_stock).length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Summary Cards */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
              <Package className="w-6 h-6 text-emerald-600" />
              Accessories Management
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              All accessory purchase and selling prices are strictly <strong>18% GST-inclusive</strong>. 
              The system automatically extracts taxable values without ever double-charging GST to customers.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchAccessories}
              className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition shadow-xs"
              title="Refresh Catalog"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowBulkUploadModal(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition shadow-xs"
              title="Import accessories in bulk via Excel spreadsheet"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Bulk Upload</span>
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition transform active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Accessory</span>
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">Total SKUs</span>
            <span className="text-xl font-bold text-slate-900">{accessories.length}</span>
          </div>
          <div className="bg-emerald-50/60 rounded-xl p-3.5 border border-emerald-100/80">
            <span className="text-[11px] font-semibold text-emerald-700 block uppercase tracking-wider">In-Stock Units</span>
            <span className="text-xl font-bold text-emerald-700">{totalUnits.toLocaleString()}</span>
          </div>
          <div className="bg-indigo-50/50 rounded-xl p-3.5 border border-indigo-100/70">
            <span className="text-[11px] font-semibold text-indigo-700 block uppercase tracking-wider">Retail Value (Incl. 18% GST)</span>
            <span className="text-xl font-bold text-indigo-900">{formatINR(totalRetailValue)}</span>
          </div>
          <div className="bg-amber-50/50 rounded-xl p-3.5 border border-amber-100/70">
            <span className="text-[11px] font-semibold text-amber-700 block uppercase tracking-wider">Low Stock Alerts</span>
            <span className={`text-xl font-bold ${lowStockCount > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
              {lowStockCount} items
            </span>
          </div>
        </div>
      </div>

      {}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3 text-sm font-medium">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-3 text-sm font-medium">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[300px]">
          {}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Product Name, SKU, Barcode, Brand..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchAccessories()}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-indigo-500 focus:outline-hidden"
            />
          </div>

          {}
          {isAdmin && (
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-hidden"
            >
              <option value="">All Stores</option>
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          )}

          {}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-hidden"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-hidden"
          >
            <option value="">All Stock Status</option>
            <option value="In Stock">In Stock</option>
            <option value="Low Stock">Low Stock</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
        </div>

        <button
          onClick={fetchAccessories}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition"
        >
          Apply Filters
        </button>
      </div>

      {}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Product Details</th>
                <th className="py-3 px-4">Category / Brand</th>
                <th className="py-3 px-4 text-center">Store</th>
                <th className="py-3 px-4 text-right">Purchase Price (Incl. 18% GST)</th>
                <th className="py-3 px-4 text-right">Selling Price (Incl. 18% GST)</th>
                <th className="py-3 px-4 text-center">Stock</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>Loading accessories catalog...</span>
                  </td>
                </tr>
              ) : accessories.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600">No accessories found.</p>
                    <p className="text-xs text-slate-400 mt-1">Try changing your filters or add a new accessory.</p>
                  </td>
                </tr>
              ) : (
                accessories.map((acc) => {
                  const isLowStock = acc.quantity <= acc.minimum_stock && acc.quantity > 0;
                  const isOutOfStock = acc.quantity === 0;

                  return (
                    <tr key={acc.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm">{acc.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                            {acc.sku}
                          </span>
                          {acc.barcode && (
                            <span className="font-mono text-[10px] text-slate-500">
                              Barcode: {acc.barcode}
                            </span>
                          )}
                        </div>
                        {acc.variant && (
                          <div className="text-[11px] text-slate-500 mt-0.5">{acc.variant}</div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-medium rounded-md text-[11px] inline-block mb-1">
                          {acc.category}
                        </span>
                        <div className="text-[11px] font-semibold text-slate-800">{acc.brand}</div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="text-[11px] font-medium text-slate-700 block">{acc.store_name}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">{acc.store_code}</span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="font-bold text-slate-800">{formatINR(acc.purchase_price_inclusive)}</div>
                        <div className="text-[10px] text-slate-500">
                          Taxable: {formatINR(acc.purchase_taxable_value)} + GST: {formatINR(acc.purchase_gst)}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="font-extrabold text-emerald-700 text-sm">
                          {formatINR(acc.selling_price_inclusive)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Taxable: {formatINR(acc.selling_taxable_value)} + GST: {formatINR(acc.selling_gst)}
                        </div>
                        {acc.mrp_inclusive > acc.selling_price_inclusive && (
                          <div className="text-[9px] text-slate-400 line-through">
                            MRP: {formatINR(acc.mrp_inclusive)}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="font-extrabold text-slate-900 text-sm block">
                          {acc.quantity} units
                        </span>
                        <span className="text-[10px] text-slate-400 block">Min: {acc.minimum_stock}</span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                          isOutOfStock 
                            ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                            : isLowStock 
                              ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {acc.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openRestockModal(acc)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] border border-indigo-200 transition flex items-center gap-1"
                            title="Restock units"
                          >
                            <Truck className="w-3 h-3" />
                            <span>Restock</span>
                          </button>
                          <button
                            onClick={() => openEditModal(acc)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            title="Edit Details & Pricing"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteAccessory(acc)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition"
                              title="Delete Accessory Permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full uppercase tracking-wider mb-1 inline-block">
                  Brand New Accessory
                </span>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-600" />
                  {editingAccessory ? 'Edit Accessory Product' : 'Add Brand New Accessory'}
                </h2>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAccessory} className="space-y-4">
              {}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">1. Basic Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 65W GaN Fast Charger"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">Category *</label>
                      {isCustomCategory ? (
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomCategory(false);
                            setFormData({ ...formData, category: allCategoryOptions[0] || 'Chargers' });
                          }}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition"
                        >
                          ← Choose from standard list
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomCategory(true);
                            setFormData({ ...formData, category: '' });
                          }}
                          className="text-[11px] font-medium text-slate-500 hover:text-indigo-600 transition"
                        >
                          + Custom
                        </button>
                      )}
                    </div>

                    {!isCustomCategory ? (
                      <select
                        required
                        value={formData.category}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setIsCustomCategory(true);
                            setFormData({ ...formData, category: '' });
                          } else {
                            setFormData({ ...formData, category: e.target.value });
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                      >
                        <option value="" disabled>Select Category</option>
                        {allCategoryOptions.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                        <option value="__custom__" className="font-semibold text-indigo-600">
                          + Add New Custom Category...
                        </option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        placeholder="Type new custom category..."
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-indigo-300 rounded-xl text-xs font-medium focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                        autoFocus
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Brand *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ecofone Power, Apple, Samsung"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Model / Variant</label>
                    <input
                      type="text"
                      placeholder="e.g. Dual Port Type-C / 1.2m Black"
                      value={formData.variant}
                      onChange={(e) => setFormData({ ...formData, variant: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">SKU / Code</label>
                    <input
                      type="text"
                      placeholder="Leave empty to auto-generate"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Barcode / EAN</label>
                    <input
                      type="text"
                      placeholder="e.g. 8901234567890"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Warranty Period</label>
                    <input
                      type="text"
                      placeholder="e.g. 1 Year Brand Warranty"
                      value={formData.warranty_period}
                      onChange={(e) => setFormData({ ...formData, warranty_period: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">2. Pricing & 18% GST (Inclusive)</h3>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Tax Included: YES (18%)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Purchase Price (Incl. 18% GST) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="e.g. 826"
                        value={formData.purchase_price_inclusive}
                        onChange={(e) => setFormData({ ...formData, purchase_price_inclusive: e.target.value })}
                        className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      MRP (Incl. 18% GST)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 1499"
                        value={formData.mrp_inclusive}
                        onChange={(e) => setFormData({ ...formData, mrp_inclusive: e.target.value })}
                        className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-emerald-800 mb-1">
                      Selling Price (Incl. 18% GST) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 font-bold text-xs">₹</span>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="e.g. 1180"
                        value={formData.selling_price_inclusive}
                        onChange={(e) => setFormData({ ...formData, selling_price_inclusive: e.target.value })}
                        className="w-full pl-7 pr-3 py-2 bg-emerald-50/50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-950 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {}
                {formSellingInclusive > 0 && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between text-slate-700">
                      <span>Customer Total Payable:</span>
                      <span className="font-extrabold text-emerald-700">{formatINR(formSellingInclusive)} (GST Included)</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Taxable Value (100/118):</span>
                      <span>{formatINR(formSellingTaxable)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Extracted 18% GST (CGST 9% + SGST 9%):</span>
                      <span>{formatINR(formSellingGst)}</span>
                    </div>
                    {formPurchaseInclusive > 0 && (
                      <div className="flex justify-between text-[11px] text-indigo-700 font-semibold pt-1 border-t border-slate-200">
                        <span>Gross Accounting Profit (Taxable SP - Taxable PP):</span>
                        <span>{formatINR(formSellingTaxable - formPurchaseTaxable)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">3. Stock & Location</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Store *</label>
                    <select
                      required
                      value={formData.store_id}
                      onChange={(e) => setFormData({ ...formData, store_id: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden"
                    >
                      <option value="">Select Store</option>
                      {stores.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.city})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {editingAccessory ? 'Stock Quantity' : 'Initial Quantity'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Reorder Level</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.reorder_level}
                      onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition"
                >
                  {editingAccessory ? 'Save Changes' : 'Create Accessory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {}
      {showRestockModal && selectedForRestock && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-indigo-600" />
                  Restock Accessory Units
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedForRestock.name}</p>
              </div>
              <button
                onClick={() => setShowRestockModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Purchase Order No.</label>
                <input
                  type="text"
                  required
                  value={restockData.purchase_order_no}
                  onChange={(e) => setRestockData({ ...restockData, purchase_order_no: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quantity to Add</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={restockData.quantity}
                  onChange={(e) => setRestockData({ ...restockData, quantity: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Purchase Price per Unit (Incl. 18% GST)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={restockData.purchase_price_inclusive}
                    onChange={(e) => setRestockData({ ...restockData, purchase_price_inclusive: e.target.value })}
                    className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supplier</label>
                <input
                  type="text"
                  value={restockData.supplier_name}
                  onChange={(e) => setRestockData({ ...restockData, supplier_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden"
                />
              </div>

              {}
              {parseFloat(restockData.purchase_price_inclusive) > 0 && parseInt(restockData.quantity, 10) > 0 && (
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-1 text-slate-800">
                  <div className="flex justify-between font-bold">
                    <span>Total Purchase Value:</span>
                    <span>{formatINR(parseFloat(restockData.purchase_price_inclusive) * parseInt(restockData.quantity, 10))}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Total Taxable Value (500 per ₹590):</span>
                    <span>{formatINR(Math.round(((parseFloat(restockData.purchase_price_inclusive) * 100 / 118) * parseInt(restockData.quantity, 10)) * 100) / 100)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-600">
                    <span>Total GST Component:</span>
                    <span>{formatINR(Math.round(((parseFloat(restockData.purchase_price_inclusive) - (parseFloat(restockData.purchase_price_inclusive) * 100 / 118)) * parseInt(restockData.quantity, 10)) * 100) / 100)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRestockModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm"
                >
                  Confirm Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {}
      <AccessoryBulkUploadModal
        isOpen={showBulkUploadModal}
        onClose={() => setShowBulkUploadModal(false)}
        stores={stores}
        onSuccess={() => {
          fetchAccessories();
          setSuccessMsg('Bulk accessories imported successfully!');
          setTimeout(() => setSuccessMsg(''), 4000);
        }}
      />
    </div>
  );
}
