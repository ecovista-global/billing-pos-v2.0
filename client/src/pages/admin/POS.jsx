import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Trash2, 
  CreditCard, 
  CheckCircle, 
  UserPlus, 
  User, 
  Percent, 
  Smartphone, 
  Plus, 
  AlertCircle,
  Building2,
  Receipt,
  ArrowLeftRight,
  RefreshCw,
  Check,
  Package,
  Zap
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import InvoiceModal from '../../components/invoice/InvoiceModal';
import QuickBillModal from '../../components/pos/QuickBillModal';

export default function POS() {
  const { user, isAdmin, canEdit } = useAuth();
  const canEditPOS = isAdmin || (canEdit ? canEdit('pos') : true);

  // Stores list for admin selector
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(user?.assigned_store_id || 1);

  // Search & Catalog State
  const [searchTerm, setSearchTerm] = useState('');
  const [catalogTab, setCatalogTab] = useState('all'); // 'all' | 'phones' | 'accessories'
  const [availablePhones, setAvailablePhones] = useState([]);
  const [availableAccessories, setAvailableAccessories] = useState([]);
  const [searching, setSearching] = useState(false);

  // Cart
  const [cart, setCart] = useState([]);

  // Customer
  const [customerMode, setCustomerMode] = useState('new'); // 'new' | 'existing'
  const [existingCustomers, setExistingCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customer, setCustomer] = useState({
    id: null,
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

  // Exchange / Trade-In State
  const [hasExchange, setHasExchange] = useState(false);
  const [exchangeDevice, setExchangeDevice] = useState({
    brand: 'Apple',
    model: '',
    variant: '',
    color: '',
    imei1: '',
    imei2: '',
    serial_number: '',
    condition_grade: 'Grade B',
    battery_health: '',
    device_condition: '',
    functional_issues: '',
    accessories_included: ['Box'],
    exchange_value: '',
    customer_id_proof_type: 'Aadhaar',
    customer_id_proof_number: '',
    notes: ''
  });

  // Payment
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [saleNotes, setSaleNotes] = useState('');

  // Processing & Completed Invoice State
  const [showQuickBillModal, setShowQuickBillModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [completedInvoice, setCompletedInvoice] = useState(null);

  // System GST Tax Rate from Company Settings (initialized from persistent cache)
  const [systemTaxRate, setSystemTaxRate] = useState(() => {
    try {
      const saved = localStorage.getItem('ecofone_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.default_tax_rate !== undefined && parsed.default_tax_rate !== '') {
          const rate = parseFloat(parsed.default_tax_rate);
          if (!isNaN(rate)) return rate;
        }
      }
    } catch (e) {}
    return 5.0;
  });

  // Load stores & system settings on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [storesRes, settingsRes] = await Promise.all([
          apiFetch('/stores'),
          apiFetch('/settings')
        ]);

        if (storesRes.success && storesRes.stores) {
          setStores(storesRes.stores);
          if (!isAdmin && user?.assigned_store_id) {
            setSelectedStoreId(user.assigned_store_id);
          } else if (isAdmin && storesRes.stores.length > 0) {
            // Admin: default to first store if current selection doesn't exist in the list
            setSelectedStoreId(prev => {
              const exists = storesRes.stores.some(s => s.id === prev);
              return exists ? prev : storesRes.stores[0].id;
            });
          }
        }

        if (settingsRes && settingsRes.success) {
          if (settingsRes.settings && settingsRes.settings.default_tax_rate !== undefined && settingsRes.settings.default_tax_rate !== '') {
            const parsedRate = parseFloat(settingsRes.settings.default_tax_rate);
            if (!isNaN(parsedRate)) {
              setSystemTaxRate(parsedRate);
              try {
                const current = JSON.parse(localStorage.getItem('ecofone_settings') || '{}');
                current.default_tax_rate = String(parsedRate);
                localStorage.setItem('ecofone_settings', JSON.stringify(current));
              } catch (e) {}
            }
          } else {
            // If server settings are empty, sync cached settings to server
            try {
              const saved = localStorage.getItem('ecofone_settings');
              if (saved) {
                apiFetch('/settings', {
                  method: 'PUT',
                  body: JSON.stringify({ settings: JSON.parse(saved) })
                }).catch(() => {});
              }
            } catch (e) {}
          }
        }
      } catch (e) {
        console.error('Failed to load stores or settings:', e);
      }
    }
    loadInitialData();
  }, [isAdmin, user]);

  // Keep cart items' tax_rate synchronized with systemTaxRate from Company Settings (phones only, accessories stay 18%)
  useEffect(() => {
    setCart(prevCart => {
      if (!prevCart || !prevCart.length) return prevCart;
      return prevCart.map(item => ({
        ...item,
        tax_rate: item.item_type === 'accessory' ? 18.0 : systemTaxRate
      }));
    });
  }, [systemTaxRate]);

  // Search available phones and accessories in selected store
  const searchInventory = async () => {
    setSearching(true);
    setError('');
    try {
      const [phonesRes, accRes] = await Promise.all([
        apiFetch(`/inventory?store_id=${selectedStoreId}&stock_status=AVAILABLE&search=${encodeURIComponent(searchTerm)}&limit=30`),
        apiFetch(`/accessories?store_id=${selectedStoreId}&status=In Stock&search=${encodeURIComponent(searchTerm)}&limit=30`)
      ]);
      if (phonesRes.success) {
        setAvailablePhones(phonesRes.phones || []);
      }
      if (accRes.success) {
        setAvailableAccessories(accRes.accessories || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to search store catalog.');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    searchInventory();
  }, [selectedStoreId]);

  // Handle customer search
  useEffect(() => {
    if (!customerSearch.trim()) return;
    const delay = setTimeout(async () => {
      try {
        const res = await apiFetch(`/customers?search=${encodeURIComponent(customerSearch)}&limit=5`);
        if (res.success) setExistingCustomers(res.customers || []);
      } catch (e) {}
    }, 300);
    return () => clearTimeout(delay);
  }, [customerSearch]);

  const selectExistingCustomer = (c) => {
    setCustomer({
      id: c.id,
      full_name: c.full_name,
      phone: c.phone,
      email: c.email || '',
      address: c.address || '',
      city: c.city || '',
      state: c.state || '',
      pincode: c.pincode || '',
      gstin: c.gstin || ''
    });
    setCustomerMode('existing');
  };

  // Add phone to cart
  const addToCart = (phone) => {
    if (cart.find(item => item.item_type !== 'accessory' && item.id === phone.id)) {
      setError(`Device (IMEI: ${phone.imei1}) is already in cart.`);
      return;
    }

    setCart([...cart, {
      ...phone,
      item_type: 'phone',
      quantity: 1,
      selling_price: parseFloat(phone.selling_price) || 0,
      purchase_price: parseFloat(phone.purchase_price !== undefined && phone.purchase_price !== null && parseFloat(phone.purchase_price) > 0 ? phone.purchase_price : (phone.total_cost || 0)),
      discount_mode: 'percent',
      discount_value: '',
      discount: 0,
      tax_rate: systemTaxRate,
      price_includes_gst: 0
    }]);
    setError('');
  };

  // Add accessory to cart (18% GST INCLUSIVE)
  const addAccessoryToCart = (acc) => {
    const existingIndex = cart.findIndex(item => item.item_type === 'accessory' && item.id === acc.id);
    if (existingIndex > -1) {
      setCart(cart.map((item, idx) => {
        if (idx === existingIndex) {
          const newQ = (item.quantity || 1) + 1;
          if (newQ > acc.quantity) {
            setError(`Only ${acc.quantity} units available in stock for ${acc.name}.`);
            return item;
          }
          return { ...item, quantity: newQ };
        }
        return item;
      }));
    } else {
      if (acc.quantity <= 0) {
        setError(`Accessory "${acc.name}" is currently out of stock.`);
        return;
      }
      setCart([...cart, {
        ...acc,
        item_type: 'accessory',
        quantity: 1,
        max_quantity: acc.quantity,
        selling_price: parseFloat(acc.selling_price_inclusive) || 0,
        purchase_price: parseFloat(acc.purchase_price_inclusive) || 0,
        purchase_taxable_value: parseFloat(acc.purchase_taxable_value) || 0,
        discount_mode: 'fixed',
        discount_value: '',
        discount: 0,
        tax_rate: 18.0,
        price_includes_gst: 1
      }]);
    }
    setError('');
  };

  // Update accessory quantity in cart
  const updateCartQuantity = (itemId, newQty) => {
    if (newQty <= 0) {
      removeFromCart(itemId, 'accessory');
      return;
    }
    setCart(cart.map(item => {
      if (item.item_type === 'accessory' && item.id === itemId) {
        if (item.max_quantity && newQty > item.max_quantity) {
          setError(`Only ${item.max_quantity} units available in stock.`);
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (itemId, itemType = 'phone') => {
    setCart(cart.filter(item => !(item.id === itemId && (item.item_type || 'phone') === itemType)));
  };

  // Item-level discount updater (applied on item total after GST for phones, and on inclusive price for accessories)
  const updateItemDiscount = (itemId, val, mode, itemType = 'phone') => {
    setCart(cart.map(item => {
      if (item.id === itemId && (item.item_type || 'phone') === itemType) {
        const itemMode = mode !== undefined ? mode : (item.discount_mode || 'fixed');
        const rawVal = val !== undefined ? val : (item.discount_value || '');
        const numVal = parseFloat(rawVal) || 0;

        let grossTotalWithTax = 0;

        if (item.item_type === 'accessory' || item.item_type === 'quick_bill_accessory') {
          // Accessory: Entered selling price already includes 18% GST (Rule 10: Discount applied on GST-inclusive price)
          const sPrice = (parseFloat(item.selling_price) || 0) * (item.quantity || 1);
          grossTotalWithTax = sPrice;
        } else {
          // Refurbished Phone: SP + 5% GST on Margin
          const sPrice = parseFloat(item.selling_price) || 0;
          const pPrice = parseFloat(item.purchase_price !== undefined && item.purchase_price !== null && parseFloat(item.purchase_price) > 0
            ? item.purchase_price
            : (item.total_cost || 0));
          const diff = Math.max(0, sPrice - pPrice);
          const tRate = (item.tax_rate !== undefined && item.tax_rate !== null && !isNaN(parseFloat(item.tax_rate)))
            ? parseFloat(item.tax_rate)
            : systemTaxRate;
          let itemTax = 0;
          if (item.price_includes_gst == 1) {
            grossTotalWithTax = sPrice;
          } else {
            itemTax = Math.round((diff * (tRate / 100)) * 100) / 100;
            grossTotalWithTax = sPrice + itemTax;
          }
        }

        let rupeeDiscount = 0;
        if (itemMode === 'percent') {
          const clampedPercent = Math.min(100, Math.max(0, numVal));
          rupeeDiscount = Math.round(((grossTotalWithTax * clampedPercent) / 100) * 100) / 100;
        } else {
          rupeeDiscount = Math.min(grossTotalWithTax, Math.max(0, numVal));
        }

        return {
          ...item,
          discount_mode: itemMode,
          discount_value: rawVal,
          discount: rupeeDiscount
        };
      }
      return item;
    }));
  };

  // Compute item margins and GST according to respective tax rules:
  // - Phones: Rule 32(5) Margin Scheme (5% on Difference)
  // - Accessories: 18% GST-Inclusive (Taxable = Final * 100 / 118, GST = Final - Taxable)
  const cartWithMargin = cart.map(item => {
    if (item.item_type === 'accessory' || item.item_type === 'quick_bill_accessory') {
      const unitPrice = parseFloat(item.selling_price) || 0;
      const qty = item.quantity || 1;
      const sPrice = Math.round(unitPrice * qty * 100) / 100;
      const pPrice = (parseFloat(item.purchase_price) || 0) * qty;

      const grossPriceWithTax = sPrice; // Already inclusive
      const disc = Math.min(grossPriceWithTax, parseFloat(item.discount) || 0);
      const finalPrice = Math.max(0, Math.round((grossPriceWithTax - disc) * 100) / 100);

      const gstRate = 18.0;
      const taxable = Math.round((finalPrice * 100 / (100 + gstRate)) * 100) / 100;
      const itemTax = Math.round((finalPrice - taxable) * 100) / 100;

      return {
        ...item,
        sPrice,
        pPrice,
        difference: taxable, // Extracted taxable value for accounting
        tRate: gstRate,
        itemTax,
        grossPriceWithTax,
        disc,
        finalPrice,
        taxable
      };
    } else {
      // Phone Margin Scheme (ALWAYS GST-INCLUSIVE)
      const sPrice = parseFloat(item.selling_price) || 0;
      const pPrice = parseFloat(item.purchase_price !== undefined && item.purchase_price !== null && parseFloat(item.purchase_price) > 0
        ? item.purchase_price
        : (item.total_cost || 0));
      
      const tRate = (item.tax_rate !== undefined && item.tax_rate !== null && !isNaN(parseFloat(item.tax_rate)))
        ? parseFloat(item.tax_rate)
        : systemTaxRate;

      // Calculate discount first based on entered sPrice
      const numVal = parseFloat(item.discount_value) || 0;
      let discAmount = 0;
      if (item.discount_mode === 'percent') {
        const clampedPercent = Math.min(100, Math.max(0, numVal));
        discAmount = Math.round(((sPrice * clampedPercent) / 100) * 100) / 100;
      } else {
        discAmount = Math.min(sPrice, Math.max(0, numVal));
      }

      // Customer pays this final amount
      const finalPrice = Math.max(0, sPrice - discAmount);

      // Now calculate margin from final customer price (inclusive of GST)
      const inclusiveDifference = Math.max(0, finalPrice - pPrice);
      const taxableMargin = inclusiveDifference / (1 + (tRate / 100));
      const itemTax = Math.round((taxableMargin * (tRate / 100)) * 100) / 100;
      const taxable = Math.round(taxableMargin * 100) / 100;

      return {
        ...item,
        sPrice,
        pPrice,
        difference: taxableMargin, 
        tRate,
        itemTax,
        grossPriceWithTax: sPrice,
        disc: discAmount,
        finalPrice,
        taxable
      };
    }
  });

  // Financial Subtotals
  const phoneItems = cartWithMargin.filter(i => i.item_type !== 'accessory' && i.item_type !== 'quick_bill_accessory');
  const accessoryItems = cartWithMargin.filter(i => i.item_type === 'accessory' || i.item_type === 'quick_bill_accessory');

  const phoneSubtotal = phoneItems.reduce((acc, i) => acc + i.sPrice, 0);
  const phoneTax = phoneItems.reduce((acc, i) => acc + i.itemTax, 0);

  const accSubtotalInclusive = accessoryItems.reduce((acc, i) => acc + i.sPrice, 0);
  const accTaxableTotal = accessoryItems.reduce((acc, i) => acc + i.taxable, 0);
  const accTaxTotal = accessoryItems.reduce((acc, i) => acc + i.itemTax, 0);

  const totalDiscount = cartWithMargin.reduce((acc, item) => acc + item.disc, 0);
  const grandTotal = cartWithMargin.reduce((acc, item) => acc + item.finalPrice, 0);

  // Exchange Valuation & Net Amount Payable
  const exchangeValueNum = hasExchange ? Math.max(0, parseFloat(exchangeDevice.exchange_value) || 0) : 0;
  const netPayable = Math.max(0, grandTotal - exchangeValueNum);

  // Complete Sale Execution
  const handleCompleteSale = async () => {
    setError('');

    if (!canEditPOS) {
      setError('View Only Mode: You do not have permission to checkout sales. Please contact your administrator.');
      return;
    }

    if (!customer.full_name.trim() || !customer.phone.trim()) {
      setError('Please provide customer name and phone number.');
      return;
    }

    const cleanPhone = customer.phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('Customer phone number must be exactly 10 digits.');
      return;
    }

    if (!cart.length) {
      setError('Cart is empty. Please select at least one smartphone.');
      return;
    }

    if (hasExchange) {
      if (!exchangeDevice.brand.trim() || !exchangeDevice.model.trim()) {
        setError('Please provide the Brand and Model of the exchanged device.');
        return;
      }
      const cleanExchangeImei = exchangeDevice.imei1.trim().replace(/\D/g, '');
      if (cleanExchangeImei.length !== 15) {
        setError('Please provide a valid 15-digit Primary IMEI for the exchanged device.');
        return;
      }
      if (exchangeDevice.imei2 && exchangeDevice.imei2.trim()) {
        const cleanExchangeImei2 = exchangeDevice.imei2.trim().replace(/\D/g, '');
        if (cleanExchangeImei2.length !== 15) {
          setError('Exchanged device Secondary IMEI 2 must be exactly 15 numeric digits.');
          return;
        }
      }
      if (exchangeDevice.customer_id_proof_number) {
        const cleanIdProof = exchangeDevice.customer_id_proof_number.replace(/\D/g, '');
        if (cleanIdProof.length !== 12) {
          setError('Customer ID proof number must be exactly 12 digits.');
          return;
        }
      }
      if (exchangeValueNum <= 0) {
        setError('Please enter an Agreed Exchange Value (valuation) greater than 0.');
        return;
      }
    }

    setSubmitting(true);

    try {
      const payload = {
        store_id: selectedStoreId,
        customer: {
          ...customer,
          id_proof_type: exchangeDevice.customer_id_proof_type || customer.id_proof_type,
          id_proof_number: exchangeDevice.customer_id_proof_number || customer.id_proof_number
        },
        items: cart.map(item => ({
          item_type: item.item_type || 'phone',
          phone_id: (item.item_type === 'accessory' || item.item_type === 'quick_bill' || item.item_type === 'quick_bill_accessory') ? null : item.id,
          accessory_id: item.item_type === 'accessory' ? item.id : null,
          quantity: (item.item_type === 'accessory' || item.item_type === 'quick_bill_accessory') ? (item.quantity || 1) : 1,
          selling_price: item.selling_price,
          discount: item.discount,
          tax_rate: (item.item_type === 'accessory' || item.item_type === 'quick_bill_accessory')
            ? 18.0
            : ((item.tax_rate !== undefined && item.tax_rate !== null && !isNaN(parseFloat(item.tax_rate)))
              ? parseFloat(item.tax_rate)
              : systemTaxRate),
          brand: item.brand,
          model: item.model,
          variant: item.variant,
          imei1: item.imei1,
          condition_grade: item.condition_grade
        })),
        exchange_device: hasExchange ? {
          ...exchangeDevice,
          exchange_value: exchangeValueNum
        } : null,
        payment_method: paymentMethod,
        reference_number: referenceNumber,
        notes: saleNotes
      };

      const res = await apiFetch('/sales', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success && res.data) {
        // Fetch full invoice details for modal
        const fullInvoiceRes = await apiFetch(`/sales/${res.data.saleId}`);
        if (fullInvoiceRes.success) {
          setCompletedInvoice(fullInvoiceRes);
        }
        // Reset Cart and refresh inventory
        setCart([]);
        setHasExchange(false);
        setExchangeDevice({
          brand: 'Apple',
          model: '',
          variant: '',
          color: '',
          imei1: '',
          imei2: '',
          serial_number: '',
          condition_grade: 'Grade B',
          battery_health: '',
          device_condition: '',
          functional_issues: '',
          accessories_included: ['Box'],
          exchange_value: '',
          customer_id_proof_type: 'Aadhaar',
          customer_id_proof_number: '',
          notes: ''
        });
        searchInventory();
      } else {
        setError(res.message || 'Failed to complete sale.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during billing checkout.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentStoreObj = stores.find(s => s.id === parseInt(selectedStoreId)) || { name: 'Store Outlet' };

  return (
    <div className="space-y-4">
      
      {}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
              Retail Point of Sale (POS)
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Scan or search IMEI • Certified device checkout • Instant GST billing
            </p>
          </div>
        </div>

        {}
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Store:</span>
          {isAdmin ? (
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(parseInt(e.target.value))}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-emerald-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              {stores.map(st => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.code})
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
              {user?.store_name || 'Assigned Store'}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {}
        <div className="lg:col-span-7 space-y-4">
          
          {}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchInventory()}
                  placeholder="Scan or enter IMEI / Brand / Model / Serial Number..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={searchInventory}
                disabled={searching}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
              <button
                onClick={() => setShowQuickBillModal(true)}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 whitespace-nowrap"
              >
                <Zap className="w-4 h-4" />
                Quick Bill
              </button>
            </div>
          </div>

          {}
          <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200 shadow-xs">
            <button
              onClick={() => setCatalogTab('all')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                catalogTab === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>All Catalog</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-700/60 text-slate-200">
                {availablePhones.length + availableAccessories.length}
              </span>
            </button>
            <button
              onClick={() => setCatalogTab('phones')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                catalogTab === 'phones'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Phones</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${catalogTab === 'phones' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {availablePhones.length}
              </span>
            </button>
            <button
              onClick={() => setCatalogTab('accessories')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                catalogTab === 'accessories'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Accessories (New)</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${catalogTab === 'accessories' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {availableAccessories.length}
              </span>
            </button>
          </div>

          {}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {catalogTab === 'accessories' ? 'Brand-New Accessories (18% GST Incl.)' : catalogTab === 'phones' ? 'Certified Refurbished Phones' : 'Available In Store'}
              </span>
              <span className="text-[11px] text-slate-400">Click card to add to bill</span>
            </div>

            {}
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {}
              {(catalogTab === 'all' || catalogTab === 'phones') && availablePhones.length > 0 && (
                <div className="space-y-2">
                  {catalogTab === 'all' && (
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Refurbished Phones ({availablePhones.length})</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {availablePhones.map((phone) => {
                      const inCart = cart.some(item => item.item_type !== 'accessory' && item.id === phone.id);
                      return (
                        <div
                          key={phone.id}
                          onClick={() => !inCart && addToCart(phone)}
                          className={`
                            p-3 rounded-xl border text-left transition relative cursor-pointer
                            ${inCart 
                              ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed' 
                              : 'bg-white hover:bg-emerald-50/50 border-slate-200 hover:border-emerald-300 hover:shadow-xs'}
                          `}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                {phone.condition_grade}
                              </span>
                              <h4 className="font-bold text-slate-900 text-xs mt-1 leading-tight">
                                {phone.brand} {phone.model}
                              </h4>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {phone.variant} {phone.color ? `• ${phone.color}` : ''}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="font-extrabold text-slate-900 text-xs block">
                                {formatCurrency(phone.selling_price)}
                              </span>
                              <span className="text-[9px] text-slate-400 block mt-0.5">
                                Bat: {phone.battery_health || '90%+'}
                              </span>
                            </div>
                          </div>

                          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                            <span className="font-mono text-[9px] text-slate-400 truncate max-w-[130px]">
                              IMEI: {phone.imei1}
                            </span>
                            <span className={`font-bold ${inCart ? 'text-slate-400' : 'text-emerald-600'}`}>
                              {inCart ? 'In Cart' : '+ Add'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {}
              {(catalogTab === 'all' || catalogTab === 'accessories') && availableAccessories.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  {catalogTab === 'all' && (
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-indigo-600" />
                      <span>New Accessories • 18% GST Included ({availableAccessories.length})</span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {availableAccessories.map((acc) => {
                      const cartItem = cart.find(item => item.item_type === 'accessory' && item.id === acc.id);
                      const inCartQty = cartItem ? cartItem.quantity : 0;
                      return (
                        <div
                          key={acc.id}
                          onClick={() => addAccessoryToCart(acc)}
                          className="p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 bg-white transition cursor-pointer text-left shadow-2xs hover:shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                                  {acc.category}
                                </span>
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded">
                                  Brand New
                                </span>
                              </div>
                              <h4 className="font-bold text-slate-900 text-xs mt-1 leading-tight">
                                {acc.name}
                              </h4>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {acc.brand} {acc.variant ? `• ${acc.variant}` : ''}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="font-extrabold text-indigo-900 text-xs block">
                                {formatCurrency(acc.selling_price_inclusive)}
                              </span>
                              <span className="text-[9px] text-emerald-700 font-medium block">
                                GST Included
                              </span>
                            </div>
                          </div>

                          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                            <span className="text-[9px] text-slate-500">
                              Stock: <strong>{acc.quantity}</strong> units
                            </span>
                            <span className="font-bold text-indigo-600 flex items-center gap-1">
                              {inCartQty > 0 ? (
                                <span className="bg-indigo-600 text-white px-1.5 py-0.2 rounded-full text-[9px]">
                                  {inCartQty} in cart
                                </span>
                              ) : (
                                '+ Add'
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {}
              {availablePhones.length === 0 && availableAccessories.length === 0 && (
                <div className="py-12 text-center text-slate-400 text-xs">
                  <Package className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p>No products found matching query in this store.</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {}
        <div className="lg:col-span-5 space-y-4">
          
          {}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-600" />
                Customer Details
              </span>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-semibold">
                <button
                  onClick={() => setCustomerMode('new')}
                  className={`px-2 py-0.5 rounded-md ${customerMode === 'new' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'}`}
                >
                  New
                </button>
                <button
                  onClick={() => setCustomerMode('existing')}
                  className={`px-2 py-0.5 rounded-md ${customerMode === 'existing' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'}`}
                >
                  Lookup
                </button>
              </div>
            </div>

            {customerMode === 'existing' ? (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Search existing customer by phone or name..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
                {existingCustomers.length > 0 && (
                  <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                    {existingCustomers.map(c => (
                      <div
                        key={c.id}
                        onClick={() => selectExistingCustomer(c)}
                        className="p-2 hover:bg-emerald-50 cursor-pointer flex justify-between"
                      >
                        <span className="font-bold text-slate-800">{c.full_name}</span>
                        <span className="text-slate-500">{c.phone}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <input
                  type="text"
                  required
                  placeholder="Full Name *"
                  value={customer.full_name}
                  onChange={(e) => setCustomer({ ...customer, full_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                />
              </div>
              <div>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="10-digit Phone No *"
                  value={customer.phone}
                  onChange={(e) => setCustomer({ ...customer, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium font-mono"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="email"
                  placeholder="Email Address (optional for digital invoice)"
                  value={customer.email}
                  onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="City"
                  value={customer.city}
                  onChange={(e) => setCustomer({ ...customer, city: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="State (for GST)"
                  value={customer.state}
                  onChange={(e) => setCustomer({ ...customer, state: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                />
              </div>
            </div>
          </div>

          {}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Cart Items ({cart.length})
              </span>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-[11px] text-rose-600 hover:text-rose-700 font-medium"
                >
                  Clear All
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <p>No devices added to cart yet.</p>
                <p className="text-[11px] text-slate-300 mt-0.5">Select devices from the left inventory panel.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {cartWithMargin.map((item) => {
                  const isAccessory = item.item_type === 'accessory' || item.item_type === 'quick_bill_accessory';
                  const itemSellingPrice = item.sPrice;
                  const itemGrossPriceWithTax = item.grossPriceWithTax;
                  const itemDiscount = item.disc;
                  const itemPercent = itemGrossPriceWithTax > 0 ? ((itemDiscount / itemGrossPriceWithTax) * 100) : 0;
                  const itemDifference = item.difference;
                  const itemTax = item.itemTax;
                  const itemFinalPrice = item.finalPrice;
                  const itemTaxRate = item.tRate;

                  return (
                    <div key={`${item.item_type || 'phone'}-${item.id}`} className={`p-3 rounded-xl border text-xs space-y-2 ${isAccessory ? 'bg-indigo-50/30 border-indigo-200/80' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {isAccessory ? (
                              <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100/70 px-1.5 py-0.2 rounded border border-indigo-200 flex items-center gap-1">
                                <Package className="w-2.5 h-2.5" /> Brand New Accessory
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded border border-emerald-200">
                                {item.condition_grade || 'Grade A'}
                              </span>
                            )}
                            <span className="text-[9px] font-bold text-slate-500">
                              {isAccessory ? '18% GST Incl.' : '5% Margin GST'}
                            </span>
                          </div>

                          <div className="font-bold text-slate-900 text-sm">
                            {isAccessory ? item.name : `${item.brand} ${item.model}`}
                          </div>
                          
                          <div className="text-[11px] text-slate-500">
                            {isAccessory ? `${item.brand} ${item.variant ? `• ${item.variant}` : ''}` : `${item.variant} ${item.color ? `• ${item.color}` : ''}`}
                          </div>

                          {!isAccessory && (
                            <div className="font-mono text-[10px] text-emerald-700 font-medium mt-0.5">IMEI: {item.imei1}</div>
                          )}

                          {}
                          <div className="flex items-center gap-1.5 text-[10px] mt-1">
                            {isAccessory ? (
                              <>
                                <span className="bg-indigo-100/60 text-indigo-900 border border-indigo-200 font-semibold px-1.5 py-0.5 rounded text-[9px]">
                                  Taxable: {formatCurrency(item.taxable)}
                                </span>
                                <span className="text-slate-600 text-[10px]">
                                  GST (18% Incl): <strong className="text-indigo-900">{formatCurrency(itemTax)}</strong>
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-semibold px-1.5 py-0.5 rounded text-[9px]">
                                  Diff: {formatCurrency(itemDifference)}
                                </span>
                                <span className="text-slate-500 text-[10px]">
                                  GST ({itemTaxRate}%{item.price_includes_gst ? ' Incl' : ''}): <strong className="text-slate-800">{!item.price_includes_gst ? '+' : ''}{formatCurrency(itemTax)}</strong>
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            {}
                            {isAccessory && (
                              <div className="flex items-center justify-end gap-1 mb-1">
                                <button
                                  type="button"
                                  onClick={() => updateCartQuantity(item.id, (item.quantity || 1) - 1)}
                                  className="w-5 h-5 rounded bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 flex items-center justify-center text-xs"
                                >
                                  -
                                </button>
                                <span className="font-extrabold text-slate-900 px-1 text-xs">
                                  {item.quantity || 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateCartQuantity(item.id, (item.quantity || 1) + 1)}
                                  className="w-5 h-5 rounded bg-slate-200 hover:bg-slate-300 font-bold text-slate-700 flex items-center justify-center text-xs"
                                >
                                  +
                                </button>
                              </div>
                            )}

                            {itemDiscount > 0 ? (
                              <div>
                                <span className="line-through text-slate-400 text-[10px] block">
                                  {formatCurrency(itemGrossPriceWithTax)}
                                </span>
                                <span className="font-extrabold text-emerald-700 text-xs block">
                                  {formatCurrency(itemFinalPrice)}
                                </span>
                              </div>
                            ) : (
                              <span className="font-extrabold text-slate-900 text-xs block">
                                {formatCurrency(itemFinalPrice)}
                              </span>
                            )}
                            <span className="text-[9px] text-slate-400 block font-normal">
                              {isAccessory ? '(incl. 18% GST)' : '(incl. 5% GST)'}
                            </span>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id, item.item_type || 'phone')}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-slate-200/50 transition"
                            title="Remove from cart"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {}
                      <div className="pt-2 border-t border-slate-200/70 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Discount:</span>
                            {}
                            <div className="inline-flex items-center bg-slate-200/70 p-0.5 rounded-lg text-[10px] font-bold">
                              <button
                                type="button"
                                onClick={() => updateItemDiscount(item.id, item.discount_value, 'percent', item.item_type || 'phone')}
                                className={`px-2 py-0.5 rounded transition ${item.discount_mode === 'percent' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                              >
                                %
                              </button>
                              <button
                                type="button"
                                onClick={() => updateItemDiscount(item.id, item.discount_value, 'fixed', item.item_type || 'phone')}
                                className={`px-2 py-0.5 rounded transition ${item.discount_mode === 'fixed' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                              >
                                ₹
                              </button>
                            </div>
                          </div>

                          {}
                          <div className="relative flex items-center">
                            <input
                              type="number"
                              min="0"
                              max={item.discount_mode === 'percent' ? 100 : itemGrossPriceWithTax}
                              value={item.discount_value !== undefined ? item.discount_value : (item.discount || '')}
                              onChange={(e) => updateItemDiscount(item.id, e.target.value, item.discount_mode, item.item_type || 'phone')}
                              placeholder="0"
                              className="w-20 pl-2 pr-5 py-1 text-[11px] bg-white border border-slate-200 rounded-lg text-right font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                            />
                            <span className="absolute right-2 text-[10px] font-bold text-slate-400 pointer-events-none">
                              {item.discount_mode === 'percent' ? '%' : '₹'}
                            </span>
                          </div>
                        </div>

                        {}
                        <div className="flex items-center justify-between gap-1 text-[10px]">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 text-[9px]">Quick:</span>
                            {item.discount_mode === 'percent' ? (
                              [5, 10, 15].map(pct => (
                                <button
                                  key={pct}
                                  type="button"
                                  onClick={() => updateItemDiscount(item.id, pct.toString(), 'percent', item.item_type || 'phone')}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition ${
                                    item.discount_value === pct.toString() && item.discount_mode === 'percent'
                                      ? 'bg-emerald-600 text-white border-emerald-600'
                                      : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                                  }`}
                                >
                                  {pct}%
                                </button>
                              ))
                            ) : (
                              (isAccessory ? [50, 100, 200] : [500, 1000, 2000]).map(amt => (
                                <button
                                  key={amt}
                                  type="button"
                                  onClick={() => updateItemDiscount(item.id, amt.toString(), 'fixed', item.item_type || 'phone')}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition ${
                                    item.discount_value === amt.toString() && item.discount_mode === 'fixed'
                                      ? 'bg-emerald-600 text-white border-emerald-600'
                                      : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                                  }`}
                                >
                                  ₹{amt}
                                </button>
                              ))
                            )}
                            {(item.discount > 0 || item.discount_value) && (
                              <button
                                type="button"
                                onClick={() => updateItemDiscount(item.id, '', item.discount_mode, item.item_type || 'phone')}
                                className="text-[9px] text-rose-500 hover:text-rose-700 font-semibold px-1"
                              >
                                Clear
                              </button>
                            )}
                          </div>

                          {itemDiscount > 0 && (
                            <span className="text-[10px] font-bold text-rose-600">
                              Saved: -{formatCurrency(itemDiscount)} ({itemPercent.toFixed(1).replace(/\.0$/, '')}%)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {}
            <div className={`rounded-xl border transition-all duration-200 overflow-hidden ${
              hasExchange 
                ? 'bg-amber-50/40 border-amber-300 shadow-xs' 
                : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
            }`}>
              {}
              <div 
                onClick={() => setHasExchange(!hasExchange)}
                className="p-3 flex items-center justify-between cursor-pointer select-none"
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                    hasExchange ? 'bg-amber-500 text-white shadow-xs' : 'bg-slate-200 text-slate-600'
                  }`}>
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">Exchange / Trade-In Old Phone</span>
                      {hasExchange && exchangeValueNum > 0 && (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                          -{formatCurrency(exchangeValueNum)}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      {hasExchange ? 'Trade-in details active • Value will be credited against total' : 'Customer exchanging an old device? Click to add trade-in details'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={hasExchange}
                    onChange={(e) => setHasExchange(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              {}
              {hasExchange && (
                <div className="p-3 pt-0 border-t border-amber-200/80 space-y-2.5 text-xs animate-in fade-in duration-150">
                  
                  {}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Device Brand *
                    </label>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {['Apple', 'Samsung', 'OnePlus', 'Xiaomi', 'Vivo', 'Oppo', 'Realme', 'Google', 'Other'].map(b => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setExchangeDevice(prev => ({ ...prev, brand: b }))}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition ${
                            exchangeDevice.brand === b
                              ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400'
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                    {exchangeDevice.brand === 'Other' && (
                      <input
                        type="text"
                        placeholder="Enter brand name..."
                        value={exchangeDevice.brand === 'Other' ? '' : exchangeDevice.brand}
                        onChange={(e) => setExchangeDevice(prev => ({ ...prev, brand: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs mt-1"
                      />
                    )}
                  </div>

                  {}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Model Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. iPhone 11 / Galaxy S21"
                        value={exchangeDevice.model}
                        onChange={(e) => setExchangeDevice(prev => ({ ...prev, model: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Storage / Variant
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 128GB / 8GB RAM"
                        value={exchangeDevice.variant}
                        onChange={(e) => setExchangeDevice(prev => ({ ...prev, variant: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  {}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Primary IMEI 1 *
                      </label>
                      <input
                        type="text"
                        required
                        inputMode="numeric"
                        maxLength={15}
                        placeholder="15-digit IMEI 1"
                        value={exchangeDevice.imei1}
                        onChange={(e) => setExchangeDevice(prev => ({ ...prev, imei1: e.target.value.replace(/\D/g, '').slice(0, 15) }))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono tracking-wider"
                      />
                      {exchangeDevice.imei1 && exchangeDevice.imei1.length === 15 ? (
                        <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5 mt-0.5">
                          ✓ Valid 15-digit IMEI
                        </span>
                      ) : exchangeDevice.imei1 ? (
                        <span className="text-[9px] text-amber-600 font-medium block mt-0.5">
                          {exchangeDevice.imei1.length}/15 digits
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Color
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Black, Midnight"
                        value={exchangeDevice.color}
                        onChange={(e) => setExchangeDevice(prev => ({ ...prev, color: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  {}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Condition Grade
                      </label>
                      <select
                        value={exchangeDevice.condition_grade}
                        onChange={(e) => setExchangeDevice(prev => ({ ...prev, condition_grade: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      >
                        <option value="Grade A">Grade A (Like New / Flawless)</option>
                        <option value="Grade B">Grade B (Minor Scratches)</option>
                        <option value="Grade C">Grade C (Heavy Scratches / Dents)</option>
                        <option value="Defective">Defective / Minor Fault</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Battery Health (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="e.g. 86"
                        value={exchangeDevice.battery_health}
                        onChange={(e) => setExchangeDevice(prev => ({ ...prev, battery_health: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  {}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Accessories Handed Over
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {['Original Box', 'Original Charger', 'Data Cable', 'Purchase Bill / Receipt'].map(acc => {
                        const isChecked = exchangeDevice.accessories_included.includes(acc);
                        return (
                          <button
                            key={acc}
                            type="button"
                            onClick={() => {
                              setExchangeDevice(prev => ({
                                ...prev,
                                accessories_included: isChecked
                                  ? prev.accessories_included.filter(a => a !== acc)
                                  : [...prev.accessories_included, acc]
                              }));
                            }}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition ${
                              isChecked
                                ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {isChecked ? '✓ ' : '+ '}{acc}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-200/60">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        Customer ID Proof
                      </label>
                      <select
                        value={exchangeDevice.customer_id_proof_type}
                        onChange={(e) => setExchangeDevice(prev => ({ ...prev, customer_id_proof_type: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      >
                        <option value="Aadhaar">Aadhaar Card</option>
                        <option value="PAN">PAN Card</option>
                        <option value="Driving License">Driving License</option>
                        <option value="Voter ID">Voter ID</option>
                        <option value="Passport">Passport</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        ID Proof Number (12 Digits)
                      </label>
                      <input
                        type="text"
                        maxLength={12}
                        placeholder="12-digit ID number"
                        value={exchangeDevice.customer_id_proof_number}
                        onChange={(e) => setExchangeDevice(prev => ({ ...prev, customer_id_proof_number: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>

                  {}
                  <div className="pt-2 border-t border-amber-200">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-extrabold uppercase tracking-wider text-amber-950">
                        Agreed Exchange Value / Credit (₹) *
                      </label>
                      <span className="text-[10px] font-bold text-emerald-700">
                        Deducts from bill total
                      </span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={exchangeDevice.exchange_value}
                        onChange={(e) => setExchangeDevice(prev => ({ ...prev, exchange_value: e.target.value }))}
                        className="w-full pl-7 pr-3 py-2 text-sm font-bold text-emerald-800 bg-white border-2 border-amber-400 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-500"
                      />
                    </div>
                    {}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {[3000, 5000, 8000, 10000, 15000, 20000].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setExchangeDevice(prev => ({ ...prev, exchange_value: String(val) }))}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white border border-slate-200 hover:border-amber-400 text-slate-700 transition"
                        >
                          ₹{val.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>

            {}
            <div className="border-t border-slate-200 pt-3 space-y-1.5 text-xs">
              {phoneItems.length > 0 && (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>Phones Total (Margin GST Incl.):</span>
                    <span>{formatCurrency(phoneSubtotal)}</span>
                  </div>
                </>
              )}

              {accessoryItems.length > 0 && (
                <>
                  <div className="flex justify-between text-indigo-900 font-medium pt-1 border-t border-slate-100">
                    <span>Accessories Total (18% GST Incl.):</span>
                    <span>{formatCurrency(accSubtotalInclusive)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Accessory Taxable Value (100/118):</span>
                    <span>{formatCurrency(accTaxableTotal)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-indigo-700">
                    <span>Accessory 18% GST (Included in Price):</span>
                    <span className="font-semibold">{formatCurrency(accTaxTotal)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between text-slate-800 font-semibold pt-1 border-t border-slate-200">
                <span>Total Amount before Discount:</span>
                <span>{formatCurrency(phoneSubtotal + accSubtotalInclusive)}</span>
              </div>

              {totalDiscount > 0 && (
                <div className="flex justify-between text-rose-600 font-medium">
                  <span>Discount Applied on Total:</span>
                  <span className="font-bold">-{formatCurrency(totalDiscount)}</span>
                </div>
              )}

              <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                <span>Bill Grand Total:</span>
                <span className="text-slate-900">{formatCurrency(grandTotal)}</span>
              </div>

              {}
              {hasExchange && exchangeValueNum > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold pt-1.5 border-t border-dashed border-slate-200">
                  <span>Exchange Credit ({exchangeDevice.brand} {exchangeDevice.model}):</span>
                  <span>-{formatCurrency(exchangeValueNum)}</span>
                </div>
              )}

              {}
              <div className="flex justify-between text-base font-black text-slate-900 pt-1.5 border-t-2 border-slate-900">
                <span>Net Payable:</span>
                <span className="text-emerald-700">{formatCurrency(netPayable)}</span>
              </div>
            </div>

            {}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Payment Method (for {formatCurrency(netPayable)})
              </label>
              <div className="grid grid-cols-4 gap-1.5 text-xs font-semibold">
                {['UPI', 'Card', 'Cash', 'Bank Transfer'].map(method => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`
                      py-2 px-1 rounded-lg text-center border transition truncate
                      ${paymentMethod === method 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}
                    `}
                  >
                    {method}
                  </button>
                ))}
              </div>

              {['UPI', 'Card', 'Bank Transfer'].includes(paymentMethod) && (
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Transaction Reference / Auth Code (optional)"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              )}
            </div>

            {}
            {!canEditPOS && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-2">
                <span>🔒 View Only Mode: Sales checkout is restricted by administrator.</span>
              </div>
            )}
            <button
              onClick={handleCompleteSale}
              disabled={submitting || cart.length === 0 || !canEditPOS}
              className={`
                w-full py-3.5 rounded-xl font-bold text-xs tracking-wide shadow-md transition active:scale-[0.99] flex items-center justify-center gap-2 text-white
                ${submitting || cart.length === 0 || !canEditPOS
                  ? 'bg-slate-300 cursor-not-allowed shadow-none' 
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500'}
              `}
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : !canEditPOS ? (
                <span>Checkout Restricted (View Only Mode)</span>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Complete Sale & Generate Bill ({formatCurrency(netPayable)})</span>
                </>
              )}
            </button>
          </div>

        </div>

      </div>

      {}
      {completedInvoice && (
        <InvoiceModal
          invoiceData={completedInvoice}
          onClose={() => setCompletedInvoice(null)}
          onNewSale={() => {
            setCompletedInvoice(null);
            setCustomer({ id: null, full_name: '', phone: '', email: '', address: '', city: '', state: '', pincode: '', gstin: '' });
          }}
        />
      )}

      {showQuickBillModal && (
        <QuickBillModal
          onClose={() => setShowQuickBillModal(false)}
          onAdd={(item) => {
            setCart([...cart, item]);
          }}
          systemTaxRate={systemTaxRate}
        />
      )}

    </div>
  );
}
