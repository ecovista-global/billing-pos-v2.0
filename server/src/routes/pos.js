const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { authenticateToken, requireAdmin, requireSuperAdmin, requireDeletePermission, logAudit } = require('../middleware/auth');
const { enforceStoreContext } = require('../middleware/storeContext');
const exchangeRouter = require('./exchanges');

// Helper to generate next unique sequential invoice number (Rule 5)
async function getNextInvoiceNumber(prismaClient = prisma) {
  const currentYear = new Date().getFullYear();
  const prefix = `ECO-${currentYear}-`;

  const lastSale = await prismaClient.sale.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { id: 'desc' },
    select: { invoiceNumber: true }
  });

  let nextSequence = 1;
  if (lastSale && lastSale.invoiceNumber) {
    const parts = lastSale.invoiceNumber.split('-');
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) {
        nextSequence = parsed + 1;
      }
    }
  }

  return `${prefix}${String(nextSequence).padStart(6, '0')}`;
}

// Helper to generate sale number
async function getNextSaleNumber(prismaClient = prisma) {
  const currentYear = new Date().getFullYear();
  const prefix = `SL-${currentYear}-`;

  const last = await prismaClient.sale.findFirst({
    where: { saleNumber: { startsWith: prefix } },
    orderBy: { id: 'desc' },
    select: { saleNumber: true }
  });

  let nextSequence = 1;
  if (last && last.saleNumber) {
    const parts = last.saleNumber.split('-');
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) {
        nextSequence = parsed + 1;
      }
    }
  }

  return `${prefix}${String(nextSequence).padStart(6, '0')}`;
}

// GET /api/sales (List sales with filters)
router.get('/', authenticateToken, enforceStoreContext, async (req, res) => {
  try {
    const { store_id, date_from, date_to, search, page = 1, limit = 50 } = req.query;

    const whereClause = {};

    if (!req.storeContext.isAllStores) {
      whereClause.storeId = req.storeContext.store_id;
    } else if (store_id) {
      whereClause.storeId = parseInt(store_id);
    }

    if (date_from || date_to) {
      whereClause.saleDate = {};
      if (date_from) whereClause.saleDate.gte = new Date(date_from);
      if (date_to) whereClause.saleDate.lte = new Date(`${date_to}T23:59:59.999Z`);
    }

    if (search) {
      const st = search.trim();
      whereClause.OR = [
        { invoiceNumber: { contains: st } },
        { saleNumber: { contains: st } },
        { customer: { fullName: { contains: st } } },
        { customer: { phone: { contains: st } } }
      ];
    }

    const total = await prisma.sale.count({ where: whereClause });
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const sales = await prisma.sale.findMany({
      where: whereClause,
      include: {
        store: true,
        employee: true,
        customer: true
      },
      orderBy: { id: 'desc' },
      skip: offset,
      take: parseInt(limit)
    });

    const mappedSales = sales.map(sa => ({
      id: sa.id,
      sale_number: sa.saleNumber,
      invoice_number: sa.invoiceNumber,
      sale_date: sa.saleDate,
      store_id: sa.storeId,
      employee_id: sa.employeeId,
      customer_id: sa.customerId,
      subtotal: sa.subtotal,
      discount_total: sa.discountTotal,
      taxable_amount: sa.taxableAmount,
      cgst: sa.cgst,
      sgst: sa.sgst,
      igst: sa.igst,
      total_tax: sa.totalTax,
      grand_total: sa.grandTotal,
      exchange_amount: sa.exchangeAmount,
      net_payable: sa.netPayable,
      payment_status: sa.paymentStatus,
      status: sa.status,
      notes: sa.notes,
      
      store_name: sa.store?.name,
      store_code: sa.store?.code,
      store_city: sa.store?.city,
      employee_name: sa.employee?.fullName,
      customer_name: sa.customer?.fullName,
      customer_phone: sa.customer?.phone
    }));

    res.json({
      success: true,
      sales: mappedSales,
      pagination: {
        total: total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/sales/:id (Full Invoice Details)
router.get('/:id', authenticateToken, enforceStoreContext, async (req, res) => {
  try {
    const saleId = parseInt(req.params.id);

    const sa = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        store: true,
        employee: true,
        customer: true,
        saleItems: {
          include: {
            phone: true,
            accessory: true
          }
        },
        payments: true,
        exchangedPhones: true
      }
    });

    if (!sa) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    if (!req.storeContext.isAllStores && req.storeContext.store_id !== sa.storeId) {
      return res.status(403).json({ success: false, message: 'Access denied to invoices from other stores.' });
    }

    const mappedSale = {
      id: sa.id,
      sale_number: sa.saleNumber,
      invoice_number: sa.invoiceNumber,
      sale_date: sa.saleDate,
      store_id: sa.storeId,
      employee_id: sa.employeeId,
      customer_id: sa.customerId,
      subtotal: sa.subtotal,
      discount_total: sa.discountTotal,
      taxable_amount: sa.taxableAmount,
      cgst: sa.cgst,
      sgst: sa.sgst,
      igst: sa.igst,
      total_tax: sa.totalTax,
      grand_total: sa.grandTotal,
      exchange_amount: sa.exchangeAmount,
      net_payable: sa.netPayable,
      payment_status: sa.paymentStatus,
      status: sa.status,
      notes: sa.notes,

      store_name: sa.store?.name,
      store_code: sa.store?.code,
      store_address: sa.store?.address,
      store_city: sa.store?.city,
      store_state: sa.store?.state,
      store_pincode: sa.store?.pincode,
      store_phone: sa.store?.phone,
      store_email: sa.store?.email,
      store_gstin: sa.store?.gstin,

      employee_name: sa.employee?.fullName,
      employee_code: sa.employee?.employeeId,

      customer_name: sa.customer?.fullName,
      customer_phone: sa.customer?.phone,
      customer_email: sa.customer?.email,
      customer_address: sa.customer?.address,
      customer_city: sa.customer?.city,
      customer_state: sa.customer?.state,
      customer_gstin: sa.customer?.gstin
    };

    const mappedItems = sa.saleItems.map(si => ({
      id: si.id,
      sale_id: si.saleId,
      item_type: si.itemType,
      phone_id: si.phoneId,
      accessory_id: si.accessoryId,
      imei1: si.imei1,
      brand: si.brand,
      model: si.model,
      variant: si.variant,
      condition_grade: si.conditionGrade,
      unit_cost: si.unitCost,
      selling_price: si.sellingPrice,
      discount: si.discount,
      purchase_price: si.purchasePrice,
      taxable_amount: si.taxableAmount,
      tax_rate: si.taxRate,
      price_includes_gst: 0,
      cgst: si.cgst,
      sgst: si.sgst,
      igst: si.igst,
      total_tax: si.totalTax,
      final_price: si.finalPrice,
      quantity: si.quantity,
      warranty_period_months: si.warrantyPeriodMonths,
      warranty_expiry: si.warrantyExpiry,

      ram: si.phone?.ram,
      storage: si.phone?.storage,
      color: si.phone?.color,
      serial_number: si.phone?.serialNumber,
      internal_product_id: si.phone?.internalProductId,

      accessory_sku: si.accessory?.sku,
      accessory_barcode: si.accessory?.barcode,
      accessory_category: si.accessory?.category,
      accessory_warranty: si.accessory?.warrantyPeriod
    }));

    const mappedPayments = sa.payments.map(p => ({
      id: p.id,
      sale_id: p.saleId,
      payment_method: p.paymentMethod,
      amount: p.amount,
      reference_number: p.referenceNumber,
      payment_date: p.paymentDate
    }));

    const settingsRows = await prisma.setting.findMany();
    const settingsObj = {};
    settingsRows.forEach(s => settingsObj[s.key] = s.value);

    let mappedExchange = null;
    if (sa.exchanges && sa.exchanges.length > 0) {
      const ex = sa.exchanges[0];
      mappedExchange = {
        id: ex.id,
        exchange_number: ex.exchangeNumber,
        brand: ex.brand,
        model: ex.model,
        imei1: ex.imei1,
        exchange_value: ex.exchangeValue
      };
    }

    res.json({
      success: true,
      sale: mappedSale,
      items: mappedItems,
      payments: mappedPayments,
      exchange: mappedExchange,
      company: settingsObj
    });
  } catch (error) {
    console.error('Error fetching invoice details:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// POST /api/sales (COMPLETE SALE / POS BILLING)
router.post('/', authenticateToken, enforceStoreContext, async (req, res) => {
  try {
    const { customer, items, payment_method, reference_number, notes, exchange_device } = req.body;

    if (!customer || !items || !items.length || !payment_method) {
      return res.status(400).json({ success: false, message: 'Customer details, products, and payment method are required.' });
    }

    const storeId = req.user.role === 'admin' ? (req.body.store_id || req.user.assigned_store_id || 1) : req.user.assigned_store_id;
    if (!storeId) return res.status(400).json({ success: false, message: 'Valid store assignment required.' });

    const store = await prisma.store.findUnique({ where: { id: parseInt(storeId) } });
    if (!store || store.status !== 'active') return res.status(400).json({ success: false, message: 'Selected store is currently inactive.' });

    const cleanPhone = (customer.phone || '').replace(/\\D/g, '');
    if (cleanPhone.length !== 10) return res.status(400).json({ success: false, message: 'Customer phone number must be exactly 10 digits.' });

    const rawIdProof = exchange_device?.customer_id_proof_number || customer.id_proof_number || null;
    let cleanIdProof = null;
    if (rawIdProof) {
      cleanIdProof = rawIdProof.replace(/\\D/g, '');
      if (cleanIdProof.length !== 12) return res.status(400).json({ success: false, message: 'Customer ID proof number must be exactly 12 digits.' });
    }

    let result;
    let attempts = 0;
    const maxRetries = 3;

    while (attempts < maxRetries) {
      try {
        result = await prisma.$transaction(async (tx) => {
          // 1. Resolve or Create Customer
          let customerId = customer.id;
          let custRecord = null;
          
          if (!customerId) {
            const existingCustomer = await tx.customer.findFirst({ where: { phone: cleanPhone } });
            if (existingCustomer) {
              customerId = existingCustomer.id;
              custRecord = existingCustomer;
            } else {
              const lastCust = await tx.customer.findFirst({ orderBy: { id: 'desc' } });
              const nextCustSeq = lastCust ? lastCust.id + 1 : 1;
              const custCode = `CUST-${String(nextCustSeq).padStart(6, '0')}`;
              const cRes = await tx.customer.create({
                data: {
                  customerCode: custCode,
                  fullName: customer.full_name.trim(),
                  phone: cleanPhone,
                  email: customer.email || '',
                  address: customer.address || '',
                  city: customer.city || store.city,
                  state: customer.state || store.state,
                  pincode: customer.pincode || '',
                  gstin: customer.gstin || null,
                  idProofType: customer.id_proof_type || exchange_device?.customer_id_proof_type || null,
                  idProofNumber: cleanIdProof
                }
              });
              customerId = cRes.id;
              custRecord = cRes;
            }
          } else {
            custRecord = await tx.customer.findUnique({ where: { id: parseInt(customerId) } });
          }

          if (customer.id_proof_type || cleanIdProof || exchange_device?.customer_id_proof_type) {
            await tx.customer.update({
              where: { id: customerId },
              data: {
                idProofType: exchange_device?.customer_id_proof_type || customer.id_proof_type || custRecord.idProofType,
                idProofNumber: cleanIdProof || custRecord.idProofNumber
              }
            });
            custRecord = await tx.customer.findUnique({ where: { id: parseInt(customerId) } });
          }

          // 2. Validate all phones & accessories
          const defaultTaxSetting = await tx.setting.findUnique({ where: { key: 'default_tax_rate' } });
          const systemDefaultTaxRate = defaultTaxSetting && !isNaN(parseFloat(defaultTaxSetting.value)) ? parseFloat(defaultTaxSetting.value) : 5.0;

          let subtotal = 0;
          let discountTotal = 0;
          let taxableAmountTotal = 0;
          let cgstTotal = 0;
          let sgstTotal = 0;
          let igstTotal = 0;
          let totalTaxAll = 0;
          let grandTotalAll = 0;
          const validatedItems = [];

          for (const item of items) {
            const isAccessory = item.item_type === 'accessory' || Boolean(item.accessory_id);
            const isQuickBill = item.item_type === 'quick_bill';
            const isQuickBillAccessory = item.item_type === 'quick_bill_accessory';

            if (isQuickBill || isQuickBillAccessory) {
              // Quick Bill: create a placeholder inventory record
              const sPrice = parseFloat(item.selling_price);
              if (!sPrice || sPrice <= 0) throw new Error('Quick Bill item must have a valid selling price.');
              if (!item.brand || !item.model) throw new Error('Quick Bill item must have a Brand and Model.');
              
              if (isQuickBill && (!item.imei1 || !/^\d{15}$/.test(item.imei1))) {
                throw new Error('Quick Bill phone must have a valid 15-digit IMEI.');
              }

              const isInterState = custRecord.state && store.state && custRecord.state.toLowerCase() !== store.state.toLowerCase();
              let taxAmount = 0;
              let difference = 0;
              let grossPriceWithTax = 0;
              let disc = 0;
              let finalPrice = 0;
              let cgst = 0, sgst = 0, igst = 0;
              const tRate = (item.tax_rate !== undefined && item.tax_rate !== null && !isNaN(parseFloat(item.tax_rate))) ? parseFloat(item.tax_rate) : (isQuickBillAccessory ? 18.0 : systemDefaultTaxRate);
              let qty = isQuickBillAccessory ? Math.max(1, parseInt(item.quantity, 10) || 1) : 1;
              let quickAcc = null;
              let quickPhone = null;

              if (isQuickBillAccessory) {
                const itemGrossInclusive = Math.round(sPrice * qty * 100) / 100;
                disc = Math.min(itemGrossInclusive, Math.max(0, parseFloat(item.discount || 0)));
                finalPrice = Math.max(0, Math.round((itemGrossInclusive - disc) * 100) / 100);
                difference = Math.round((finalPrice * 100 / (100 + tRate)) * 100) / 100;
                taxAmount = Math.round((finalPrice - difference) * 100) / 100;
                
                const tempId = `QBA-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
                quickAcc = await tx.accessory.create({
                  data: {
                    accessoryId: tempId,
                    sku: tempId,
                    name: item.model.trim(),
                    category: 'Quick Bill',
                    brand: item.brand.trim(),
                    variant: item.variant || '',
                    purchasePriceInclusive: 0,
                    purchaseTaxableValue: 0,
                    purchaseGst: 0,
                    mrpInclusive: sPrice,
                    sellingPriceInclusive: sPrice,
                    sellingTaxableValue: Math.round((sPrice * 100 / (100 + tRate)) * 100) / 100,
                    sellingGst: sPrice - Math.round((sPrice * 100 / (100 + tRate)) * 100) / 100,
                    gstRate: tRate,
                    priceIncludesGst: 1,
                    quantity: 0,
                    minimumStock: 0,
                    reorderLevel: 0,
                    storeId: parseInt(storeId),
                    status: 'QUICK_BILLED'
                  }
                });
              } else {
                const existingPhone = await tx.phoneInventory.findUnique({ where: { imei1: item.imei1 } });
                if (existingPhone) {
                  throw new Error(`IMEI ${item.imei1} already exists in inventory (Status: ${existingPhone.stockStatus}). Please add it from the regular inventory panel, or check the IMEI.`);
                }

                const pPrice = 0;
                disc = Math.min(sPrice, Math.max(0, parseFloat(item.discount || 0)));
                finalPrice = Math.max(0, sPrice - disc);
                
                const inclusiveDifference = Math.max(0, finalPrice - pPrice);
                const taxableMargin = inclusiveDifference / (1 + (tRate / 100));
                taxAmount = Math.round((taxableMargin * (tRate / 100)) * 100) / 100;
                difference = Math.round(taxableMargin * 100) / 100;
                
                const tempProdId = `QB-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
                quickPhone = await tx.phoneInventory.create({
                  data: {
                    internalProductId: tempProdId,
                    brand: item.brand.trim(),
                    model: item.model.trim(),
                    variant: item.variant || '',
                    imei1: item.imei1,
                    conditionGrade: item.condition_grade || 'Grade A',
                    purchasePrice: 0,
                    totalCost: 0,
                    sellingPrice: sPrice,
                    finalSellingPrice: sPrice,
                    currentStoreId: parseInt(storeId),
                    stockStatus: 'QUICK_BILLED',
                    notes: `Quick Bill - Purchase price to be updated. Invoice will be linked.`,
                    dateAdded: new Date()
                  }
                });
              }

              if (isInterState) igst = taxAmount;
              else {
                cgst = Math.round((taxAmount / 2) * 100) / 100;
                sgst = Math.round((taxAmount - cgst) * 100) / 100;
              }

              subtotal += isQuickBillAccessory ? sPrice * qty : sPrice;
              discountTotal += disc;
              taxableAmountTotal += difference;
              cgstTotal += cgst;
              sgstTotal += sgst;
              igstTotal += igst;
              totalTaxAll += taxAmount;
              grandTotalAll += finalPrice;

              if (isQuickBillAccessory) {
                validatedItems.push({
                  item_type: 'quick_bill_accessory', accessory: quickAcc, quantity: qty,
                  unit_cost: 0, selling_price: sPrice,
                  discount: disc, taxable_amount: difference, tax_rate: tRate,
                  price_includes_gst: 1, cgst, sgst, igst, total_tax: taxAmount, final_price: finalPrice
                });
              } else {
                validatedItems.push({
                  item_type: 'quick_bill', phone: quickPhone, quantity: 1,
                  unit_cost: 0, selling_price: sPrice,
                  discount: disc, purchase_price: 0, taxable_amount: difference,
                  tax_rate: tRate, price_includes_gst: 1, cgst, sgst, igst, total_tax: taxAmount, final_price: finalPrice
                });
              }

            } else if (isAccessory) {
              const accessoryId = item.accessory_id || item.id;
              const accessory = await tx.accessory.findUnique({ where: { id: parseInt(accessoryId) } });
              if (!accessory) throw new Error(`Accessory ID ${accessoryId} does not exist.`);
              
              const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
              if (accessory.quantity < qty) throw new Error(`Insufficient stock for accessory "${accessory.name}". Requested: ${qty}, Available: ${accessory.quantity}`);
              if (accessory.storeId !== storeId) throw new Error(`Accessory "${accessory.name}" belongs to another store.`);

              const unitSellingPriceInclusive = parseFloat(item.selling_price || accessory.sellingPriceInclusive);
              const itemGrossInclusive = Math.round(unitSellingPriceInclusive * qty * 100) / 100;
              const disc = Math.min(itemGrossInclusive, Math.max(0, parseFloat(item.discount || 0)));
              const finalPrice = Math.max(0, Math.round((itemGrossInclusive - disc) * 100) / 100);

              const gstRate = 18.0;
              const taxableAmount = Math.round((finalPrice * 100 / (100 + gstRate)) * 100) / 100;
              const taxAmount = Math.round((finalPrice - taxableAmount) * 100) / 100;

              const isInterState = custRecord.state && store.state && custRecord.state.toLowerCase() !== store.state.toLowerCase();
              let cgst = 0, sgst = 0, igst = 0;
              if (isInterState) igst = taxAmount;
              else {
                cgst = Math.round((taxAmount / 2) * 100) / 100;
                sgst = Math.round((taxAmount - cgst) * 100) / 100;
              }

              subtotal += itemGrossInclusive;
              discountTotal += disc;
              taxableAmountTotal += taxableAmount;
              cgstTotal += cgst;
              sgstTotal += sgst;
              igstTotal += igst;
              totalTaxAll += taxAmount;
              grandTotalAll += finalPrice;

              validatedItems.push({
                item_type: 'accessory', accessory, quantity: qty,
                unit_cost: accessory.purchaseTaxableValue, selling_price: unitSellingPriceInclusive,
                discount: disc, taxable_amount: taxableAmount, tax_rate: gstRate,
                price_includes_gst: 1, cgst, sgst, igst, total_tax: taxAmount, final_price: finalPrice
              });
            } else {
              const phone = await tx.phoneInventory.findUnique({ where: { id: parseInt(item.phone_id) } });
              if (!phone) throw new Error(`Device ID ${item.phone_id} does not exist in inventory.`);
              if (phone.stockStatus !== 'AVAILABLE') throw new Error(`Device ${phone.brand} ${phone.model} (IMEI: ${phone.imei1}) is currently ${phone.stockStatus}. Cannot be sold again!`);
              if (phone.currentStoreId !== storeId) throw new Error(`Device (IMEI: ${phone.imei1}) is registered under a different store. Please initiate a stock transfer first.`);

              const sPrice = parseFloat(item.selling_price || phone.sellingPrice);
              const pPrice = parseFloat(phone.purchasePrice !== undefined && phone.purchasePrice !== null && parseFloat(phone.purchasePrice) > 0 ? phone.purchasePrice : (phone.totalCost || 0));
              const tRate = (item.tax_rate !== undefined && item.tax_rate !== null && !isNaN(parseFloat(item.tax_rate))) ? parseFloat(item.tax_rate) : systemDefaultTaxRate;
              
              const disc = Math.min(sPrice, Math.max(0, parseFloat(item.discount || 0)));
              const finalPrice = Math.max(0, sPrice - disc);
              
              const inclusiveDifference = Math.max(0, finalPrice - pPrice);
              const taxableMargin = inclusiveDifference / (1 + (tRate / 100));
              const taxAmount = Math.round((taxableMargin * (tRate / 100)) * 100) / 100;
              const difference = Math.round(taxableMargin * 100) / 100;

              const isInterState = custRecord.state && store.state && custRecord.state.toLowerCase() !== store.state.toLowerCase();
              let cgst = 0, sgst = 0, igst = 0;
              if (isInterState) igst = taxAmount;
              else {
                cgst = Math.round((taxAmount / 2) * 100) / 100;
                sgst = Math.round((taxAmount - cgst) * 100) / 100;
              }

              subtotal += sPrice;
              discountTotal += disc;
              taxableAmountTotal += difference;
              cgstTotal += cgst;
              sgstTotal += sgst;
              igstTotal += igst;
              totalTaxAll += taxAmount;
              grandTotalAll += finalPrice;

              validatedItems.push({
                item_type: 'phone', phone, quantity: 1,
                unit_cost: phone.totalCost, selling_price: sPrice,
                discount: disc, purchase_price: pPrice, taxable_amount: difference,
                tax_rate: tRate, price_includes_gst: 1, cgst, sgst, igst, total_tax: taxAmount, final_price: finalPrice
              });
            }
          }

          // 3. Handle Exchange Device
          let exchangeAmount = 0;
          let exchangeNumber = null;
          let exchangeRecordInfo = null;

          if (exchange_device && exchange_device.brand && exchange_device.model && exchange_device.imei1) {
            exchangeAmount = Math.max(0, parseFloat(exchange_device.exchange_value) || 0);
            const imeiClean = String(exchange_device.imei1).trim();
            if (!/^\\d{15}$/.test(imeiClean)) throw new Error('Exchange device IMEI must be exactly 15 numeric digits.');
            if (exchange_device.imei2 && String(exchange_device.imei2).trim()) {
              if (!/^\\d{15}$/.test(String(exchange_device.imei2).trim())) throw new Error('Exchange device secondary IMEI 2 must be exactly 15 numeric digits.');
            }

            const existingInStock = await tx.phoneInventory.findFirst({ where: { imei1: imeiClean, stockStatus: 'AVAILABLE' } });
            if (existingInStock) throw new Error(`Device with IMEI ${imeiClean} is already registered in active store inventory.`);

            exchangeNumber = await exchangeRouter.getNextExchangeNumber();
          }

          const netPayable = Math.max(0, grandTotalAll - exchangeAmount);
          const invoiceNumber = await getNextInvoiceNumber(tx);
          const saleNumber = await getNextSaleNumber(tx);

          // 5. Insert Sale
          const saleInsert = await tx.sale.create({
            data: {
              saleNumber, invoiceNumber, saleDate: new Date(), storeId: parseInt(storeId),
              employeeId: req.user.id, customerId,
              subtotal, discountTotal, taxableAmount: taxableAmountTotal,
              cgst: cgstTotal, sgst: sgstTotal, igst: igstTotal, totalTax: totalTaxAll,
              grandTotal: grandTotalAll, exchangeAmount, netPayable,
              paymentStatus: 'PAID', status: 'COMPLETED', notes: notes || ''
            }
          });
          const saleId = saleInsert.id;

          if (exchangeNumber) {
            const accessoriesStr = Array.isArray(exchange_device.accessories_included) ? exchange_device.accessories_included.join(', ') : (exchange_device.accessories_included || '');
            const exInsert = await tx.exchangedPhone.create({
              data: {
                exchangeNumber, saleId, invoiceNumber, storeId: parseInt(storeId), employeeId: req.user.id, customerId,
                customerName: custRecord.fullName || customer.full_name, customerPhone: custRecord.phone || customer.phone,
                customerEmail: custRecord.email || customer.email || '', customerAddress: custRecord.address || customer.address || '',
                customerIdProofType: exchange_device.customer_id_proof_type || custRecord.idProofType || customer.id_proof_type || null,
                customerIdProofNumber: cleanIdProof || custRecord.idProofNumber || null,
                brand: exchange_device.brand.trim(), model: exchange_device.model.trim(), variant: exchange_device.variant ? exchange_device.variant.trim() : '',
                color: exchange_device.color ? exchange_device.color.trim() : '',
                imei1: exchange_device.imei1.trim(), imei2: exchange_device.imei2 ? exchange_device.imei2.trim() : null,
                serialNumber: exchange_device.serial_number ? exchange_device.serial_number.trim() : null,
                conditionGrade: exchange_device.condition_grade || 'Grade B', batteryHealth: exchange_device.battery_health ? String(exchange_device.battery_health).trim() : null,
                deviceCondition: exchange_device.device_condition || '', functionalIssues: exchange_device.functional_issues || '',
                accessoriesIncluded: accessoriesStr, exchangeValue: exchangeAmount, status: 'IN_STOCK',
                notes: exchange_device.notes || `Exchanged against Bill #${invoiceNumber}`, exchangeDate: new Date()
              }
            });
            exchangeRecordInfo = { id: exInsert.id, exchange_number: exchangeNumber, exchange_value: exchangeAmount };
          }

          // 6. Insert Sale Items
          for (const v of validatedItems) {
            if (v.item_type === 'accessory') {
              await tx.saleItem.create({
                data: {
                  saleId, itemType: 'accessory', accessoryId: v.accessory.id, brand: v.accessory.brand,
                  model: v.accessory.name, variant: v.accessory.variant, conditionGrade: 'Brand New',
                  unitCost: v.unit_cost, sellingPrice: v.selling_price, discount: v.discount,
                  taxableAmount: v.taxable_amount, taxRate: v.tax_rate,
                  cgst: v.cgst, sgst: v.sgst, igst: v.igst, totalTax: v.total_tax, finalPrice: v.final_price,
                  quantity: v.quantity, warrantyPeriodMonths: 0
                }
              });

              const newQty = v.accessory.quantity - v.quantity;
              let newStatus = 'In Stock';
              if (newQty <= 0) newStatus = 'Out of Stock';
              else if (newQty <= v.accessory.minimumStock) newStatus = 'Low Stock';
              
              await tx.accessory.update({
                where: { id: v.accessory.id },
                data: { quantity: newQty, status: newStatus }
              });
            } else if (v.item_type === 'quick_bill_accessory') {
              await tx.saleItem.create({
                data: {
                  saleId, itemType: 'quick_bill_accessory', accessoryId: v.accessory.id, brand: v.accessory.brand,
                  model: v.accessory.name, variant: v.accessory.variant, conditionGrade: 'Brand New',
                  unitCost: 0, sellingPrice: v.selling_price, discount: v.discount,
                  taxableAmount: v.taxable_amount, taxRate: v.tax_rate,
                  cgst: v.cgst, sgst: v.sgst, igst: v.igst, totalTax: v.total_tax, finalPrice: v.final_price,
                  quantity: v.quantity, isQuickBill: 1, warrantyPeriodMonths: 0
                }
              });
            } else if (v.item_type === 'quick_bill') {
              await tx.saleItem.create({
                data: {
                  saleId, itemType: 'quick_bill', phoneId: v.phone.id, imei1: v.phone.imei1,
                  brand: v.phone.brand, model: v.phone.model, variant: v.phone.variant || '',
                  conditionGrade: v.phone.conditionGrade || 'Grade A',
                  unitCost: 0, sellingPrice: v.selling_price, discount: v.discount,
                  taxableAmount: v.taxable_amount, taxRate: v.tax_rate,
                  cgst: v.cgst, sgst: v.sgst, igst: v.igst, totalTax: v.total_tax, finalPrice: v.final_price,
                  quantity: 1, isQuickBill: 1, warrantyPeriodMonths: 0
                }
              });

              // Mark the placeholder inventory as QUICK_BILLED & sold
              await tx.phoneInventory.update({
                where: { id: v.phone.id },
                data: { stockStatus: 'QUICK_BILLED', dateSold: new Date() }
              });
            } else {
              const warrantyExpiry = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
              await tx.saleItem.create({
                data: {
                  saleId, itemType: 'phone', phoneId: v.phone.id, imei1: v.phone.imei1,
                  brand: v.phone.brand, model: v.phone.model, variant: v.phone.variant, conditionGrade: v.phone.conditionGrade,
                  unitCost: v.unit_cost, sellingPrice: v.selling_price, discount: v.discount,
                  taxableAmount: v.taxable_amount, taxRate: v.tax_rate,
                  cgst: v.cgst, sgst: v.sgst, igst: v.igst, totalTax: v.total_tax, finalPrice: v.final_price,
                  quantity: 1, warrantyPeriodMonths: v.phone.warrantyPeriodMonths || 6, warrantyExpiry
                }
              });

              await tx.phoneInventory.update({
                where: { id: v.phone.id },
                data: { stockStatus: 'SOLD', dateSold: new Date() }
              });

              await tx.warranty.create({
                data: {
                  phoneId: v.phone.id, imei1: v.phone.imei1, customerId, saleId, invoiceNumber,
                  warrantyPeriodMonths: v.phone.warrantyPeriodMonths || 6, startDate: new Date(),
                  endDate: new Date(new Date().setMonth(new Date().getMonth() + (v.phone.warrantyPeriodMonths || 6))),
                  status: 'Active'
                }
              });
            }
          }

          // 7. Record Payment
          await tx.payment.create({
            data: {
              saleId, paymentMethod: payment_method, amount: netPayable, referenceNumber: reference_number || null, paymentDate: new Date()
            }
          });

          // 8. Update Customer
          await tx.customer.update({
            where: { id: customerId },
            data: {
              totalPurchases: { increment: validatedItems.length },
              totalSpent: { increment: grandTotalAll }
            }
          });

          return {
            saleId, invoiceNumber, saleNumber, grandTotal: grandTotalAll, exchangeAmount, netPayable, exchange: exchangeRecordInfo
          };
        }, {
          maxWait: 15000,
          timeout: 30000
        });
        
        break; // break out of retry loop if successful
      } catch (err) {
        if (err.message.includes('Unique constraint failed') && attempts < maxRetries - 1) {
          attempts++;
        } else {
          throw err;
        }
      }
    }

    await logAudit(req.user.id, req.user.username, 'COMPLETE_SALE', storeId, 'SALE', String(result.saleId), { invoiceNumber: result.invoiceNumber, grandTotal: result.grandTotal, netPayable: result.netPayable, payment_method }, req);
    
    res.status(201).json({ success: true, message: 'Sale completed successfully!', data: result });
  } catch (error) {
    console.error('Error completing sale:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// POST /api/sales/:id/void (Void Invoice - Admin only)
router.post('/:id/void', authenticateToken, enforceStoreContext, requireAdmin, async (req, res) => {
  try {
    const saleId = parseInt(req.params.id);
    const { reason } = req.body;

    const sale = await prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found.' });
    if (sale.status === 'VOID') return res.status(400).json({ success: false, message: 'This invoice has already been voided.' });

    await prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: saleId },
        data: { status: 'VOID', notes: (sale.notes || '') + ` [VOIDED: ${reason || 'Admin voided'}]` }
      });

      const saleItems = await tx.saleItem.findMany({ where: { saleId } });
      for (const it of saleItems) {
        if (it.phoneId) {
          await tx.phoneInventory.update({
            where: { id: it.phoneId },
            data: { stockStatus: 'AVAILABLE', dateSold: null }
          });
        } else if (it.accessoryId) {
          const acc = await tx.accessory.findUnique({ where: { id: it.accessoryId } });
          if (acc) {
            const newQty = acc.quantity + it.quantity;
            await tx.accessory.update({
              where: { id: acc.id },
              data: { quantity: newQty, status: newQty > acc.minimumStock ? 'In Stock' : (newQty > 0 ? 'Low Stock' : 'Out of Stock') }
            });
          }
        }
      }

      await tx.warranty.updateMany({
        where: { saleId },
        data: { status: 'Void' }
      });

      const customer = await tx.customer.findUnique({ where: { id: sale.customerId } });
      if (customer) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: {
            totalPurchases: Math.max(0, customer.totalPurchases - saleItems.length),
            totalSpent: Math.max(0, customer.totalSpent - sale.grandTotal)
          }
        });
      }
    });

    await logAudit(req.user.id, req.user.username, 'VOID_INVOICE', sale.storeId, 'SALE', String(saleId), { invoiceNumber: sale.invoiceNumber, reason }, req);

    res.json({ success: true, message: 'Invoice voided and inventory successfully restored.' });
  } catch (error) {
    console.error('Error voiding invoice:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/sales/:id (Permanent Delete Bill / Invoice - Admin only)
router.delete('/:id', authenticateToken, enforceStoreContext, requireDeletePermission('invoices'), async (req, res) => {
  try {
    const saleId = parseInt(req.params.id);
    const sale = await prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) return res.status(404).json({ success: false, message: 'Sale invoice not found.' });

    await prisma.$transaction(async (tx) => {
      // 1. Delete linked warranties
      await tx.warranty.deleteMany({ where: { saleId } });
      
      // 2. Delete linked returns and return items
      const rets = await tx.return.findMany({ where: { saleId }, select: { id: true } });
      if (rets.length > 0) {
        const retIds = rets.map(r => r.id);
        await tx.returnItem.deleteMany({ where: { returnId: { in: retIds } } });
        await tx.return.deleteMany({ where: { saleId } });
      }

      // 3. Delete or unlink exchanged phones linked to this invoice
      await tx.exchangedPhone.deleteMany({ where: { saleId } });

      // 4. Delete payments
      await tx.payment.deleteMany({ where: { saleId } });

      // 5. Delete sale items
      const saleItems = await tx.saleItem.findMany({ where: { saleId } });
      await tx.saleItem.deleteMany({ where: { saleId } });

      // 6. Adjust customer statistics if customer exists
      const customer = await tx.customer.findUnique({ where: { id: sale.customerId } });
      if (customer) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: {
            totalPurchases: Math.max(0, customer.totalPurchases - saleItems.length),
            totalSpent: Math.max(0, customer.totalSpent - sale.grandTotal)
          }
        });
      }

      // 7. Delete the sale record itself
      await tx.sale.delete({ where: { id: saleId } });
    });

    await logAudit(req.user.id, req.user.username, 'DELETE_INVOICE', sale.storeId, 'SALE', String(saleId), { invoiceNumber: sale.invoiceNumber, grandTotal: sale.grandTotal }, req);

    res.json({ success: true, message: `Invoice ${sale.invoiceNumber} deleted permanently.` });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// GET /api/sales/quick-bills - List all unreconciled Quick Bill items (Admin only)
router.get('/quick-bills', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { store_id } = req.query;
    const where = { isQuickBill: 1 };
    if (store_id) {
      where.sale = { storeId: parseInt(store_id) };
    } else if (!req.user.is_super_admin && req.user.assigned_store_id) {
      where.sale = { storeId: req.user.assigned_store_id };
    }

    const quickBillItems = await prisma.saleItem.findMany({
      where,
      include: {
        sale: {
          include: {
            store: true,
            customer: true,
            employee: true
          }
        },
        phone: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, quick_bills: quickBillItems });
  } catch (error) {
    console.error('Error fetching quick bills:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT /api/sales/quick-bills/:saleItemId - Reconcile Quick Bill by updating purchase cost (Admin only)
router.put('/quick-bills/:saleItemId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const saleItemId = parseInt(req.params.saleItemId);
    const { purchase_price, supplier_id, notes } = req.body;

    if (!purchase_price || parseFloat(purchase_price) <= 0) {
      return res.status(400).json({ success: false, message: 'A valid purchase price is required to reconcile.' });
    }

    const saleItem = await prisma.saleItem.findUnique({
      where: { id: saleItemId },
      include: { phone: true, sale: true }
    });

    if (!saleItem) return res.status(404).json({ success: false, message: 'Quick Bill item not found.' });
    if (!saleItem.isQuickBill) return res.status(400).json({ success: false, message: 'This item is not a Quick Bill entry.' });

    const pPrice = parseFloat(purchase_price);

    await prisma.$transaction(async (tx) => {
      if (saleItem.itemType === 'quick_bill_accessory' || saleItem.accessoryId) {
        // Update the placeholder accessory record
        await tx.accessory.update({
          where: { id: saleItem.accessoryId },
          data: {
            purchasePriceInclusive: pPrice,
            purchaseTaxableValue: Math.round((pPrice * 100 / (100 + saleItem.taxRate)) * 100) / 100,
            purchaseGst: pPrice - Math.round((pPrice * 100 / (100 + saleItem.taxRate)) * 100) / 100,
            supplierId: supplier_id ? parseInt(supplier_id) : null
          }
        });
      } else {
        // Update the placeholder phone inventory record with actual purchase cost
        await tx.phoneInventory.update({
          where: { id: saleItem.phoneId },
          data: {
            purchasePrice: pPrice,
            totalCost: pPrice,
            supplierId: supplier_id ? parseInt(supplier_id) : null,
            notes: notes || `Reconciled: Purchase price ₹${pPrice} updated by ${req.user.username}`
          }
        });
      }

      // Mark the sale item as reconciled (unit cost updated)
      await tx.saleItem.update({
        where: { id: saleItemId },
        data: { unitCost: pPrice, isQuickBill: 0 }
      });
    });

    await logAudit(req.user.id, req.user.username, 'RECONCILE_QUICK_BILL', saleItem.sale.storeId, 'SALE_ITEM', String(saleItemId), {
      brand: saleItem.brand, model: saleItem.model, sellingPrice: saleItem.sellingPrice, purchasePrice: pPrice
    }, req);

    res.json({ success: true, message: `Quick Bill reconciled. Purchase cost of ₹${pPrice.toLocaleString('en-IN')} recorded for ${saleItem.brand} ${saleItem.model}.` });
  } catch (error) {
    console.error('Error reconciling quick bill:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;

