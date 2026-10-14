/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ECOFONE ONLINE ORDER INTEGRATION — Backend Route
 * POST /api/online/order        → Create order from App (Razorpay payment done)
 * POST /api/online/webhook      → Razorpay webhook (payment.captured event)
 * GET  /api/online/invoice/:inv → Public invoice fetch by invoice number
 * GET  /api/online/orders       → Admin: list all online orders
 * GET  /api/online/reconcile    → Admin: Razorpay reconciliation view
 * ─────────────────────────────────────────────────────────────────────────────
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const prisma = require('../db/prisma');
const { authenticateToken, requireAdmin, logAudit } = require('../middleware/auth');

// ─── Constants ───────────────────────────────────────────────────────────────
const ONLINE_STORE_CODE = process.env.ONLINE_STORE_CODE || 'ECO-ONLINE';
const ONLINE_API_KEY    = process.env.ONLINE_API_KEY    || null;  // Set in .env
const RZP_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || null;
const ONLINE_EMPLOYEE_USERNAME = process.env.ONLINE_EMPLOYEE_USERNAME || 'online_system';

// ─── Middleware: verify app API key (for App → POS calls) ────────────────────
function requireApiKey(req, res, next) {
  if (!ONLINE_API_KEY) {
    return res.status(503).json({ success: false, message: 'Online integration not configured (ONLINE_API_KEY not set).' });
  }
  const key = req.headers['x-api-key'];
  if (!key || key !== ONLINE_API_KEY) {
    return res.status(401).json({ success: false, message: 'Invalid or missing API key.' });
  }
  next();
}

// ─── Helper: Invoice Number (same logic as POS) ──────────────────────────────
async function getNextInvoiceNumber(tx) {
  const year = new Date().getFullYear();
  const prefix = `ECO-${year}-`;
  const last = await tx.sale.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { id: 'desc' },
    select: { invoiceNumber: true }
  });
  let seq = 1;
  if (last?.invoiceNumber) {
    const p = last.invoiceNumber.split('-');
    if (p.length === 3) {
      const n = parseInt(p[2], 10);
      if (!isNaN(n)) seq = n + 1;
    }
  }
  return `${prefix}${String(seq).padStart(6, '0')}`;
}

async function getNextSaleNumber(tx) {
  const year = new Date().getFullYear();
  const prefix = `SL-${year}-`;
  const last = await tx.sale.findFirst({
    where: { saleNumber: { startsWith: prefix } },
    orderBy: { id: 'desc' },
    select: { saleNumber: true }
  });
  let seq = 1;
  if (last?.saleNumber) {
    const p = last.saleNumber.split('-');
    if (p.length === 3) {
      const n = parseInt(p[2], 10);
      if (!isNaN(n)) seq = n + 1;
    }
  }
  return `${prefix}${String(seq).padStart(6, '0')}`;
}

// ─── Core: Create a Sale from Online Order ───────────────────────────────────
/**
 * Creates a complete POS-compatible sale from an online order.
 * Called internally from both /order and /webhook endpoints.
 * 
 * @param {Object} params
 * @param {Object} params.customer       - { full_name, phone, email, address, city, state, pincode }
 * @param {Object} params.item           - { phone_id?, brand, model, variant, storage, color, grade, selling_price, imei? }
 * @param {Object} params.payment        - { razorpay_payment_id, razorpay_order_id, amount }
 * @param {String} params.orderId        - Unique online order reference
 * @param {String} params.channel        - 'APP', 'WEBSITE' etc.
 * @returns {Object}                     - { saleId, invoiceNumber, saleNumber, grandTotal }
 */
async function createOnlineSale({ customer, item, payment, orderId, channel = 'APP' }) {
  // 1. Get online store
  const store = await prisma.store.findFirst({
    where: { code: ONLINE_STORE_CODE, status: 'active' }
  });
  if (!store) throw new Error(`Online store (code: ${ONLINE_STORE_CODE}) not found or inactive. Please create it in the POS admin panel.`);

  // 2. Get system employee (online bot account)
  const sysEmployee = await prisma.user.findFirst({
    where: { username: ONLINE_EMPLOYEE_USERNAME, status: 'active' }
  });
  if (!sysEmployee) throw new Error(`System employee '${ONLINE_EMPLOYEE_USERNAME}' not found. Create it in Employees section.`);

  // 3. Clean & validate phone number
  const cleanPhone = (customer.phone || '').replace(/\D/g, '').slice(-10);
  if (cleanPhone.length !== 10) throw new Error('Customer phone must be 10 digits.');

  // 4. Idempotency — if Razorpay payment ID already exists as a sale reference, skip
  const existing = await prisma.payment.findFirst({
    where: { referenceNumber: payment.razorpay_payment_id }
  });
  if (existing) {
    const existingSale = await prisma.sale.findUnique({ where: { id: existing.saleId } });
    return {
      saleId: existing.saleId,
      invoiceNumber: existingSale?.invoiceNumber,
      saleNumber: existingSale?.saleNumber,
      grandTotal: existingSale?.grandTotal,
      alreadyExisted: true
    };
  }

  let retries = 0;
  while (retries < 3) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 5. Resolve or create customer
        let custRecord = await tx.customer.findFirst({ where: { phone: cleanPhone } });
        if (!custRecord) {
          const lastCust = await tx.customer.findFirst({ orderBy: { id: 'desc' } });
          const seq = lastCust ? lastCust.id + 1 : 1;
          custRecord = await tx.customer.create({
            data: {
              customerCode: `CUST-${String(seq).padStart(6, '0')}`,
              fullName: customer.full_name.trim(),
              phone: cleanPhone,
              email: customer.email || '',
              address: customer.address || '',
              city: customer.city || store.city,
              state: customer.state || store.state,
              pincode: customer.pincode || '',
              storeId: store.id
            }
          });
        }

        // 6. Determine IMEI / phone inventory record
        let phoneRecord = null;
        const sellingPrice = parseFloat(payment.amount); // Amount paid via Razorpay

        if (item.phone_id) {
          // Specific phone_id provided (for confirmed IMEI dispatch flow)
          phoneRecord = await tx.phoneInventory.findUnique({ where: { id: parseInt(item.phone_id) } });
          if (!phoneRecord) throw new Error(`Phone ID ${item.phone_id} not found in inventory.`);
          if (phoneRecord.stockStatus !== 'AVAILABLE') throw new Error(`Phone (${phoneRecord.brand} ${phoneRecord.model}) is not available. Status: ${phoneRecord.stockStatus}`);
          if (phoneRecord.currentStoreId !== store.id) throw new Error(`Phone is not in online store. Transfer it to ${ONLINE_STORE_CODE} first.`);
        } else if (item.imei) {
          // IMEI provided
          phoneRecord = await tx.phoneInventory.findFirst({
            where: { imei1: item.imei, stockStatus: 'AVAILABLE', currentStoreId: store.id }
          });
          if (!phoneRecord) throw new Error(`No available phone found with IMEI ${item.imei}.`);
        } else {
          // Auto FIFO: find oldest matching available phone in online store
          const query = {
            stockStatus: 'AVAILABLE',
            currentStoreId: store.id,
            brand: item.brand ? { equals: item.brand, mode: 'insensitive' } : undefined,
            model: item.model ? { equals: item.model, mode: 'insensitive' } : undefined,
            storage: item.storage || undefined,
            color: item.color || undefined,
            conditionGrade: item.grade || undefined
          };
          // Remove undefined keys
          Object.keys(query).forEach(k => query[k] === undefined && delete query[k]);

          phoneRecord = await tx.phoneInventory.findFirst({
            where: query,
            orderBy: { dateAdded: 'asc' } // FIFO: oldest stock first
          });
          if (!phoneRecord) throw new Error(`No available ${item.brand} ${item.model} ${item.storage || ''} ${item.grade || ''} found in online store stock.`);
        }

        // 7. GST Calculation (Margin scheme for refurbished phones)
        const purchasePrice = parseFloat(phoneRecord.purchasePrice) || 0;
        const totalCost = parseFloat(phoneRecord.totalCost) || 0;
        const taxRate = parseFloat(phoneRecord.taxRate) || 5.0;

        const inclusiveDifference = Math.max(0, sellingPrice - totalCost);
        const taxableMargin = inclusiveDifference / (1 + (taxRate / 100));
        const taxAmount = Math.round((taxableMargin * (taxRate / 100)) * 100) / 100;
        const taxableAmountVal = Math.round(taxableMargin * 100) / 100;

        const isInterState = customer.state && store.state &&
          customer.state.toLowerCase() !== store.state.toLowerCase();

        let cgst = 0, sgst = 0, igst = 0;
        if (isInterState) {
          igst = taxAmount;
        } else {
          cgst = Math.round((taxAmount / 2) * 100) / 100;
          sgst = Math.round((taxAmount - cgst) * 100) / 100;
        }

        // 8. Invoice & Sale Numbers
        const invoiceNumber = await getNextInvoiceNumber(tx);
        const saleNumber = await getNextSaleNumber(tx);

        // 9. Create Sale record
        const saleInsert = await tx.sale.create({
          data: {
            saleNumber,
            invoiceNumber,
            saleDate: new Date(),
            storeId: store.id,
            employeeId: sysEmployee.id,
            customerId: custRecord.id,
            subtotal: sellingPrice,
            discountTotal: 0,
            taxableAmount: taxableAmountVal,
            cgst,
            sgst,
            igst,
            totalTax: taxAmount,
            grandTotal: sellingPrice,
            exchangeAmount: 0,
            netPayable: sellingPrice,
            paymentStatus: 'PAID',
            status: 'COMPLETED',
            notes: `Online Order | Channel: ${channel} | Order Ref: ${orderId} | Razorpay: ${payment.razorpay_payment_id}`
          }
        });

        // 10. Create SaleItem
        const warrantyMonths = phoneRecord.warrantyPeriodMonths || 6;
        const warrantyExpiry = new Date(Date.now() + warrantyMonths * 30 * 24 * 60 * 60 * 1000);

        await tx.saleItem.create({
          data: {
            saleId: saleInsert.id,
            itemType: 'phone',
            phoneId: phoneRecord.id,
            imei1: phoneRecord.imei1,
            brand: phoneRecord.brand,
            model: phoneRecord.model,
            variant: phoneRecord.variant || '',
            conditionGrade: phoneRecord.conditionGrade,
            unitCost: totalCost,
            sellingPrice: sellingPrice,
            discount: 0,
            taxableAmount: taxableAmountVal,
            taxRate,
            cgst,
            sgst,
            igst,
            totalTax: taxAmount,
            finalPrice: sellingPrice,
            quantity: 1,
            warrantyPeriodMonths: warrantyMonths,
            warrantyExpiry
          }
        });

        // 11. Mark inventory SOLD
        await tx.phoneInventory.update({
          where: { id: phoneRecord.id },
          data: { stockStatus: 'SOLD', dateSold: new Date() }
        });

        // 12. Create Warranty record
        await tx.warranty.create({
          data: {
            phoneId: phoneRecord.id,
            imei1: phoneRecord.imei1,
            customerId: custRecord.id,
            saleId: saleInsert.id,
            invoiceNumber,
            warrantyPeriodMonths: warrantyMonths,
            startDate: new Date(),
            endDate: warrantyExpiry,
            status: 'Active'
          }
        });

        // 13. Record Payment (Razorpay)
        await tx.payment.create({
          data: {
            saleId: saleInsert.id,
            paymentMethod: 'RAZORPAY',
            amount: sellingPrice,
            referenceNumber: payment.razorpay_payment_id,
            paymentDate: new Date()
          }
        });

        // 14. Update Customer stats
        await tx.customer.update({
          where: { id: custRecord.id },
          data: {
            totalPurchases: { increment: 1 },
            totalSpent: { increment: sellingPrice }
          }
        });

        return {
          saleId: saleInsert.id,
          invoiceNumber,
          saleNumber,
          grandTotal: sellingPrice,
          phoneRecord: {
            brand: phoneRecord.brand,
            model: phoneRecord.model,
            imei1: phoneRecord.imei1,
            conditionGrade: phoneRecord.conditionGrade
          }
        };
      }, { maxWait: 15000, timeout: 30000 });

      return result;
    } catch (err) {
      if (err.message.includes('Unique constraint failed') && retries < 2) {
        retries++;
        continue;
      }
      throw err;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/online/order
 * Called by the Ecofone App backend AFTER Razorpay payment is confirmed.
 * Secured by ONLINE_API_KEY header.
 * 
 * Body: {
 *   customer: { full_name, phone, email, address, city, state, pincode },
 *   item: { brand, model, storage, color, grade, phone_id?, imei? },
 *   payment: { razorpay_payment_id, razorpay_order_id, amount },
 *   order_id: "ORD-APP-123",
 *   channel: "APP"
 * }
 */
router.post('/order', requireApiKey, async (req, res) => {
  try {
    const { customer, item, payment, order_id, channel } = req.body;

    if (!customer?.full_name || !customer?.phone) {
      return res.status(400).json({ success: false, message: 'Customer name and phone are required.' });
    }
    if (!item?.brand || !item?.model) {
      return res.status(400).json({ success: false, message: 'Item brand and model are required.' });
    }
    if (!payment?.razorpay_payment_id || !payment?.amount) {
      return res.status(400).json({ success: false, message: 'Razorpay payment_id and amount are required.' });
    }
    if (!order_id) {
      return res.status(400).json({ success: false, message: 'order_id is required for idempotency.' });
    }

    const result = await createOnlineSale({ customer, item, payment, orderId: order_id, channel: channel || 'APP' });

    // Log audit
    await logAudit(
      null, 'online_api', 'ONLINE_ORDER_CREATED', null, 'SALE',
      String(result.saleId),
      { invoiceNumber: result.invoiceNumber, orderId: order_id, razorpayId: payment.razorpay_payment_id, amount: payment.amount },
      req
    );

    return res.status(201).json({
      success: true,
      message: result.alreadyExisted
        ? 'Order already processed (idempotent response).'
        : 'Online order created and invoice generated successfully.',
      data: {
        sale_id: result.saleId,
        invoice_number: result.invoiceNumber,
        sale_number: result.saleNumber,
        grand_total: result.grandTotal,
        phone: result.phoneRecord,
        invoice_url: `/api/online/invoice/${result.invoiceNumber}`,
        already_existed: result.alreadyExisted || false
      }
    });
  } catch (error) {
    console.error('[Online Order] Error:', error.message);
    return res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/online/webhook
 * Razorpay Webhook endpoint — receives payment.captured event.
 * Secured by HMAC signature verification using RAZORPAY_WEBHOOK_SECRET.
 * 
 * Set this URL in Razorpay Dashboard → Webhooks:
 *   https://your-domain.com/api/online/webhook
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  // 1. Verify Razorpay HMAC signature
  const signature = req.headers['x-razorpay-signature'];
  if (RZP_WEBHOOK_SECRET) {
    const bodyStr = req.body.toString();
    const expectedSig = crypto
      .createHmac('sha256', RZP_WEBHOOK_SECRET)
      .update(bodyStr)
      .digest('hex');

    if (signature !== expectedSig) {
      console.warn('[Webhook] Invalid Razorpay signature');
      return res.status(400).json({ success: false, message: 'Invalid webhook signature.' });
    }
  }

  let event;
  try {
    event = JSON.parse(req.body.toString());
  } catch {
    return res.status(400).json({ success: false, message: 'Invalid JSON payload.' });
  }

  // 2. Only handle payment.captured
  if (event.event !== 'payment.captured') {
    return res.status(200).json({ success: true, message: `Event '${event.event}' ignored.` });
  }

  const paymentEntity = event.payload?.payment?.entity;
  if (!paymentEntity) {
    return res.status(400).json({ success: false, message: 'No payment entity in webhook payload.' });
  }

  try {
    // 3. Extract order metadata from Razorpay notes
    const notes = paymentEntity.notes || {};
    const customer = {
      full_name: notes.customer_name || 'Online Customer',
      phone: notes.customer_phone || '',
      email: notes.customer_email || paymentEntity.email || '',
      address: notes.customer_address || '',
      city: notes.customer_city || '',
      state: notes.customer_state || '',
      pincode: notes.customer_pincode || ''
    };

    const item = {
      brand: notes.brand || '',
      model: notes.model || '',
      storage: notes.storage || '',
      color: notes.color || '',
      grade: notes.grade || '',
      phone_id: notes.phone_id ? parseInt(notes.phone_id) : undefined,
      imei: notes.imei || undefined
    };

    const payment = {
      razorpay_payment_id: paymentEntity.id,
      razorpay_order_id: paymentEntity.order_id,
      amount: parseFloat(paymentEntity.amount) / 100 // Razorpay amount is in paise
    };

    const orderId = paymentEntity.order_id || `RZP-${paymentEntity.id}`;

    const result = await createOnlineSale({
      customer, item, payment,
      orderId,
      channel: 'RAZORPAY_WEBHOOK'
    });

    console.log(`[Webhook] Sale created: Invoice ${result.invoiceNumber} for payment ${paymentEntity.id}`);

    await logAudit(
      null, 'razorpay_webhook', 'WEBHOOK_ORDER_CREATED', null, 'SALE',
      String(result.saleId),
      { invoiceNumber: result.invoiceNumber, razorpayPaymentId: paymentEntity.id, amount: payment.amount },
      req
    );

    return res.status(200).json({ success: true, invoice_number: result.invoiceNumber });
  } catch (error) {
    console.error('[Webhook] Error processing payment:', error.message);
    // Return 200 to Razorpay to prevent retries for business logic errors
    return res.status(200).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/online/invoice/:invoiceNumber
 * Public endpoint — returns full invoice data by invoice number.
 * Used by the App to show in-app bill to customer.
 * No auth required (invoice number is unguessable — ECO-2026-000452 pattern).
 */
router.get('/invoice/:invoiceNumber', async (req, res) => {
  try {
    const { invoiceNumber } = req.params;

    const sa = await prisma.sale.findFirst({
      where: { invoiceNumber },
      include: {
        store: true,
        employee: true,
        customer: true,
        saleItems: { include: { phone: true, accessory: true } },
        payments: true
      }
    });

    if (!sa) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    // Only expose online orders on this public endpoint
    // (sales with RAZORPAY payment method or notes containing 'Online Order')
    const isOnlineOrder = sa.payments.some(p => p.paymentMethod === 'RAZORPAY') ||
      (sa.notes || '').includes('Online Order');

    if (!isOnlineOrder) {
      return res.status(403).json({ success: false, message: 'This invoice is not accessible via the public endpoint.' });
    }

    const settingsRows = await prisma.setting.findMany();
    const settingsObj = {};
    settingsRows.forEach(s => settingsObj[s.key] = s.value);

    const items = sa.saleItems.map(si => ({
      item_type: si.itemType,
      brand: si.brand,
      model: si.model,
      variant: si.variant,
      imei1: si.imei1,
      condition_grade: si.conditionGrade,
      selling_price: si.sellingPrice,
      discount: si.discount,
      taxable_amount: si.taxableAmount,
      tax_rate: si.taxRate,
      cgst: si.cgst,
      sgst: si.sgst,
      igst: si.igst,
      total_tax: si.totalTax,
      final_price: si.finalPrice,
      quantity: si.quantity,
      warranty_period_months: si.warrantyPeriodMonths,
      warranty_expiry: si.warrantyExpiry,
      storage: si.phone?.storage,
      color: si.phone?.color,
      ram: si.phone?.ram
    }));

    return res.json({
      success: true,
      sale: {
        id: sa.id,
        invoice_number: sa.invoiceNumber,
        sale_number: sa.saleNumber,
        sale_date: sa.saleDate,
        subtotal: sa.subtotal,
        discount_total: sa.discountTotal,
        taxable_amount: sa.taxableAmount,
        cgst: sa.cgst,
        sgst: sa.sgst,
        igst: sa.igst,
        total_tax: sa.totalTax,
        grand_total: sa.grandTotal,
        net_payable: sa.netPayable,
        payment_status: sa.paymentStatus,
        status: sa.status,
        notes: sa.notes,

        store_name: sa.store?.name,
        store_address: sa.store?.address,
        store_city: sa.store?.city,
        store_state: sa.store?.state,
        store_pincode: sa.store?.pincode,
        store_phone: sa.store?.phone,
        store_email: sa.store?.email,
        store_gstin: sa.store?.gstin,

        customer_name: sa.customer?.fullName,
        customer_phone: sa.customer?.phone,
        customer_email: sa.customer?.email,
        customer_address: sa.customer?.address,
        customer_city: sa.customer?.city,
        customer_state: sa.customer?.state
      },
      items,
      payments: sa.payments.map(p => ({
        payment_method: p.paymentMethod,
        amount: p.amount,
        reference_number: p.referenceNumber,
        payment_date: p.paymentDate
      })),
      company: settingsObj
    });
  } catch (error) {
    console.error('[Online Invoice] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

/**
 * GET /api/online/orders
 * Admin-only: list all online (Razorpay) orders with pagination.
 * Used by POS admin reconciliation panel.
 */
router.get('/orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, date_from, date_to, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Find sales with RAZORPAY payment method
    const razorpaySaleIds = await prisma.payment.findMany({
      where: { paymentMethod: 'RAZORPAY' },
      select: { saleId: true }
    });
    const saleIds = razorpaySaleIds.map(p => p.saleId);

    const whereClause = {
      id: { in: saleIds }
    };

    if (date_from || date_to) {
      whereClause.saleDate = {};
      if (date_from) whereClause.saleDate.gte = new Date(date_from);
      if (date_to) whereClause.saleDate.lte = new Date(`${date_to}T23:59:59.999Z`);
    }

    if (search) {
      whereClause.OR = [
        { invoiceNumber: { contains: search } },
        { customer: { fullName: { contains: search, mode: 'insensitive' } } },
        { customer: { phone: { contains: search } } }
      ];
    }

    const total = await prisma.sale.count({ where: whereClause });

    const sales = await prisma.sale.findMany({
      where: whereClause,
      include: {
        customer: true,
        store: true,
        payments: true,
        saleItems: { include: { phone: true } }
      },
      orderBy: { id: 'desc' },
      skip: offset,
      take: parseInt(limit)
    });

    const mapped = sales.map(sa => ({
      id: sa.id,
      invoice_number: sa.invoiceNumber,
      sale_number: sa.saleNumber,
      sale_date: sa.saleDate,
      grand_total: sa.grandTotal,
      payment_status: sa.paymentStatus,
      status: sa.status,
      notes: sa.notes,
      customer_name: sa.customer?.fullName,
      customer_phone: sa.customer?.phone,
      store_name: sa.store?.name,
      razorpay_payment_id: sa.payments.find(p => p.paymentMethod === 'RAZORPAY')?.referenceNumber,
      items: sa.saleItems.map(si => ({
        brand: si.brand,
        model: si.model,
        imei1: si.imei1,
        condition_grade: si.conditionGrade,
        final_price: si.finalPrice
      }))
    }));

    return res.json({
      success: true,
      orders: mapped,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('[Online Orders] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

/**
 * GET /api/online/reconcile
 * Admin-only: summary view of all Razorpay online orders for reconciliation.
 * Returns totals, counts, and per-order details for the reconciliation panel.
 */
router.get('/reconcile', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { date_from, date_to } = req.query;

    // All Razorpay payments
    const rzpPayments = await prisma.payment.findMany({
      where: { paymentMethod: 'RAZORPAY' },
      include: {
        sale: {
          include: {
            customer: true,
            saleItems: { include: { phone: true } }
          }
        }
      },
      orderBy: { paymentDate: 'desc' }
    });

    let filtered = rzpPayments;
    if (date_from) {
      filtered = filtered.filter(p => new Date(p.paymentDate) >= new Date(date_from));
    }
    if (date_to) {
      filtered = filtered.filter(p => new Date(p.paymentDate) <= new Date(`${date_to}T23:59:59.999Z`));
    }

    const totalCollected = filtered.reduce((sum, p) => sum + p.amount, 0);
    const orderCount = filtered.length;
    // Razorpay fee estimate: ~2% + GST = ~2.36%
    const estimatedRzpFee = Math.round(totalCollected * 0.0236 * 100) / 100;
    const estimatedNetSettlement = Math.round((totalCollected - estimatedRzpFee) * 100) / 100;

    const records = filtered.map(p => ({
      payment_id: p.referenceNumber,
      sale_id: p.saleId,
      invoice_number: p.sale?.invoiceNumber,
      customer_name: p.sale?.customer?.fullName,
      customer_phone: p.sale?.customer?.phone,
      amount: p.amount,
      payment_date: p.paymentDate,
      sale_status: p.sale?.status,
      item: p.sale?.saleItems?.[0] ? `${p.sale.saleItems[0].brand} ${p.sale.saleItems[0].model} (${p.sale.saleItems[0].imei1})` : 'N/A'
    }));

    return res.json({
      success: true,
      summary: {
        total_orders: orderCount,
        total_collected: totalCollected,
        estimated_razorpay_fee: estimatedRzpFee,
        estimated_net_settlement: estimatedNetSettlement,
        period: { date_from: date_from || null, date_to: date_to || null }
      },
      records
    });
  } catch (error) {
    console.error('[Reconcile] Error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
