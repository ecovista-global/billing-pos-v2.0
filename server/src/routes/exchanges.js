const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { authenticateToken, requireAdmin, requireSuperAdmin, requireDeletePermission, logAudit } = require('../middleware/auth');

async function getNextExchangeNumber() {
  const currentYear = new Date().getFullYear();
  const prefix = `EXC-${currentYear}-`;

  const last = await prisma.exchangedPhone.findFirst({
    where: {
      exchangeNumber: {
        startsWith: prefix
      }
    },
    orderBy: { id: 'desc' },
    select: { exchangeNumber: true }
  });

  let nextSeq = 1;
  if (last && last.exchangeNumber) {
    const parts = last.exchangeNumber.split('-');
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) {
        nextSeq = parsed + 1;
      }
    }
  }

  return `${prefix}${String(nextSeq).padStart(6, '0')}`;
}

// GET /api/exchanges (List all exchanged phones with filters and summary stats)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { store_id, status, condition_grade, date_from, date_to, search, page = 1, limit = 50 } = req.query;

    const whereClause = {};

    if (req.user.role !== 'admin') {
      whereClause.storeId = req.user.assigned_store_id;
    } else if (store_id) {
      whereClause.storeId = parseInt(store_id);
    }

    if (status) whereClause.status = status;
    if (condition_grade) whereClause.conditionGrade = condition_grade;

    if (date_from || date_to) {
      whereClause.exchangeDate = {};
      if (date_from) whereClause.exchangeDate.gte = new Date(date_from);
      if (date_to) whereClause.exchangeDate.lte = new Date(`${date_to}T23:59:59.999Z`);
    }

    if (search) {
      const st = search.trim();
      whereClause.OR = [
        { exchangeNumber: { contains: st } },
        { imei1: { contains: st } },
        { imei2: { contains: st } },
        { brand: { contains: st } },
        { model: { contains: st } },
        { customerName: { contains: st } },
        { customerPhone: { contains: st } },
        { invoiceNumber: { contains: st } }
      ];
    }

    const total = await prisma.exchangedPhone.count({ where: whereClause });
    
    const valueAgg = await prisma.exchangedPhone.aggregate({
      where: whereClause,
      _sum: { exchangeValue: true }
    });

    // KPI stats using queryRaw for complex conditional sums
    let kpiWhere = req.user.role !== 'admin' ? `WHERE store_id = ${req.user.assigned_store_id}` : (store_id ? `WHERE store_id = ${parseInt(store_id)}` : '');
    
    const kpisRaw = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*) as total_devices,
        COALESCE(SUM(exchange_value), 0) as total_valuation,
        SUM(CASE WHEN CAST(exchange_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS DATE) = CAST(NOW() AT TIME ZONE 'Asia/Kolkata' AS DATE) THEN 1 ELSE 0 END) as today_count,
        SUM(CASE WHEN status = 'IN_STOCK' THEN 1 ELSE 0 END) as in_stock_count,
        SUM(CASE WHEN status = 'ADDED_TO_INVENTORY' THEN 1 ELSE 0 END) as converted_to_inventory_count
      FROM exchanged_phones
      ${kpiWhere}
    `);
    
    const kpis = { ...kpisRaw[0] };
    for (const key in kpis) {
      if (typeof kpis[key] === 'bigint') kpis[key] = Number(kpis[key]);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const exchanges = await prisma.exchangedPhone.findMany({
      where: whereClause,
      include: {
        store: true,
        employee: true,
        sale: true
      },
      orderBy: { id: 'desc' },
      skip: offset,
      take: parseInt(limit)
    });

    const mappedExchanges = exchanges.map(ep => ({
      id: ep.id,
      exchange_number: ep.exchangeNumber,
      sale_id: ep.saleId,
      invoice_number: ep.invoiceNumber,
      store_id: ep.storeId,
      employee_id: ep.employeeId,
      customer_id: ep.customerId,
      customer_name: ep.customerName,
      customer_phone: ep.customerPhone,
      customer_email: ep.customerEmail,
      customer_address: ep.customerAddress,
      customer_id_proof_type: ep.customerIdProofType,
      customer_id_proof_number: ep.customerIdProofNumber,
      brand: ep.brand,
      model: ep.model,
      variant: ep.variant,
      color: ep.color,
      imei1: ep.imei1,
      imei2: ep.imei2,
      serial_number: ep.serialNumber,
      condition_grade: ep.conditionGrade,
      battery_health: ep.batteryHealth,
      device_condition: ep.deviceCondition,
      functional_issues: ep.functionalIssues,
      accessories_included: ep.accessoriesIncluded,
      exchange_value: ep.exchangeValue,
      status: ep.status,
      phone_inventory_id: ep.phoneInventoryId,
      exchange_date: ep.exchangeDate,
      notes: ep.notes,
      created_at: ep.createdAt,
      updated_at: ep.updatedAt,
      
      store_name: ep.store?.name,
      store_code: ep.store?.code,
      store_city: ep.store?.city,
      employee_name: ep.employee?.fullName,
      employee_code: ep.employee?.employeeId,
      sale_number: ep.sale?.saleNumber,
      sale_invoice_number: ep.sale?.invoiceNumber,
      sale_grand_total: ep.sale?.grandTotal
    }));

    res.json({
      success: true,
      exchanges: mappedExchanges,
      kpis: {
        totalDevices: kpis.total_devices || 0,
        totalValuation: kpis.total_valuation || 0,
        todayCount: kpis.today_count || 0,
        inStockCount: kpis.in_stock_count || 0,
        convertedCount: kpis.converted_to_inventory_count || 0
      },
      pagination: {
        total: total,
        totalValue: valueAgg._sum.exchangeValue || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching exchanges:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/exchanges/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const ep = await prisma.exchangedPhone.findUnique({
      where: { id },
      include: {
        store: true,
        employee: true,
        sale: true
      }
    });

    if (!ep) {
      return res.status(404).json({ success: false, message: 'Exchanged phone record not found.' });
    }

    if (req.user.role !== 'admin' && req.user.assigned_store_id !== ep.storeId) {
      return res.status(403).json({ success: false, message: 'Access denied to records from other stores.' });
    }

    const settingsRows = await prisma.setting.findMany();
    const settingsObj = {};
    settingsRows.forEach(s => settingsObj[s.key] = s.value);

    const mappedExchange = {
      id: ep.id,
      exchange_number: ep.exchangeNumber,
      sale_id: ep.saleId,
      invoice_number: ep.invoiceNumber,
      store_id: ep.storeId,
      employee_id: ep.employeeId,
      customer_id: ep.customerId,
      customer_name: ep.customerName,
      customer_phone: ep.customerPhone,
      customer_email: ep.customerEmail,
      customer_address: ep.customerAddress,
      customer_id_proof_type: ep.customerIdProofType,
      customer_id_proof_number: ep.customerIdProofNumber,
      brand: ep.brand,
      model: ep.model,
      variant: ep.variant,
      color: ep.color,
      imei1: ep.imei1,
      imei2: ep.imei2,
      serial_number: ep.serialNumber,
      condition_grade: ep.conditionGrade,
      battery_health: ep.batteryHealth,
      device_condition: ep.deviceCondition,
      functional_issues: ep.functionalIssues,
      accessories_included: ep.accessoriesIncluded,
      exchange_value: ep.exchangeValue,
      status: ep.status,
      phone_inventory_id: ep.phoneInventoryId,
      exchange_date: ep.exchangeDate,
      notes: ep.notes,
      created_at: ep.createdAt,
      updated_at: ep.updatedAt,
      
      store_name: ep.store?.name,
      store_code: ep.store?.code,
      store_address: ep.store?.address,
      store_city: ep.store?.city,
      store_state: ep.store?.state,
      store_phone: ep.store?.phone,
      
      employee_name: ep.employee?.fullName,
      employee_code: ep.employee?.employeeId,
      
      sale_number: ep.sale?.saleNumber,
      sale_invoice_number: ep.sale?.invoiceNumber,
      sale_date: ep.sale?.saleDate,
      sale_grand_total: ep.sale?.grandTotal,
      sale_exchange_amount: ep.sale?.exchangeAmount,
      sale_net_payable: ep.sale?.netPayable
    };

    res.json({
      success: true,
      exchange: mappedExchange,
      company: settingsObj
    });
  } catch (error) {
    console.error('Error fetching exchange:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// PATCH /api/exchanges/:id/status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, notes } = req.body;

    const validStatuses = ['IN_STOCK', 'REFURBISHING', 'ADDED_TO_INVENTORY', 'SCRAPPED', 'SOLD'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const existing = await prisma.exchangedPhone.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Exchanged phone record not found.' });
    }

    if (req.user.role !== 'admin' && req.user.assigned_store_id !== existing.storeId) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const updateData = { status };
    if (notes !== undefined) updateData.notes = notes || null;

    await prisma.exchangedPhone.update({
      where: { id },
      data: updateData
    });

    await logAudit(req.user.id, req.user.username, 'UPDATE_EXCHANGE_STATUS', existing.storeId, 'EXCHANGE', String(id), { oldStatus: existing.status, newStatus: status, notes }, req);

    res.json({ success: true, message: `Status updated to ${status}.` });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// POST /api/exchanges/:id/move-to-inventory
router.post('/:id/move-to-inventory', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { selling_price, condition_grade, notes } = req.body;

    const exchange = await prisma.exchangedPhone.findUnique({ where: { id } });
    if (!exchange) {
      return res.status(404).json({ success: false, message: 'Exchanged phone record not found.' });
    }

    if (exchange.status === 'ADDED_TO_INVENTORY' && exchange.phoneInventoryId) {
      return res.status(400).json({ success: false, message: 'This phone has already been transferred to main inventory.' });
    }

    const existingImei = await prisma.phoneInventory.findFirst({
      where: { imei1: exchange.imei1 }
    });
    if (existingImei && existingImei.stockStatus === 'AVAILABLE') {
      return res.status(400).json({
        success: false,
        message: `A device with IMEI ${exchange.imei1} already exists in available inventory (ID #${existingImei.id}).`
      });
    }

    const defaultTaxSetting = await prisma.setting.findUnique({ where: { key: 'default_tax_rate' } });
    const taxRate = defaultTaxSetting && !isNaN(parseFloat(defaultTaxSetting.value)) ? parseFloat(defaultTaxSetting.value) : 5.0;

    const purchasePrice = parseFloat(exchange.exchangeValue) || 0;
    const suggestedSellingPrice = parseFloat(selling_price) || (purchasePrice > 0 ? Math.round(purchasePrice * 1.25) : 10000);
    const difference = Math.max(0, suggestedSellingPrice - purchasePrice);
    const taxAmount = Math.round((difference * (taxRate / 100)) * 100) / 100;
    const finalPrice = suggestedSellingPrice + taxAmount;

    const internalProductId = `ECO-EXC-${Math.floor(10000 + Math.random() * 90000)}`;

    const newInventoryId = await prisma.$transaction(async (tx) => {
      const inv = await tx.phoneInventory.create({
        data: {
          internalProductId,
          brand: exchange.brand,
          model: exchange.model,
          variant: exchange.variant || 'Standard',
          ram: '',
          storage: exchange.variant || '',
          color: exchange.color || 'Standard',
          imei1: exchange.imei1,
          imei2: exchange.imei2 || null,
          serialNumber: exchange.serialNumber || null,
          conditionGrade: condition_grade || exchange.conditionGrade || 'Grade B',
          batteryHealth: exchange.batteryHealth || null,
          purchasePrice,
          refurbishmentCost: 0,
          additionalCost: 0,
          totalCost: purchasePrice,
          sellingPrice: suggestedSellingPrice,
          discount: 0,
          taxRate,
          finalSellingPrice: finalPrice,
          currentStoreId: exchange.storeId,
          stockStatus: 'AVAILABLE',
          notes: notes || `Acquired via Customer Exchange #${exchange.exchangeNumber} from ${exchange.customerName}`
        }
      });

      await tx.exchangedPhone.update({
        where: { id },
        data: {
          status: 'ADDED_TO_INVENTORY',
          phoneInventoryId: inv.id
        }
      });

      return inv.id;
    });

    await logAudit(
      req.user.id,
      req.user.username,
      'EXCHANGE_TO_INVENTORY',
      exchange.storeId,
      'INVENTORY',
      String(newInventoryId),
      { exchange_id: id, imei1: exchange.imei1, internal_product_id: internalProductId, cost: purchasePrice, selling_price: suggestedSellingPrice },
      req
    );

    res.json({
      success: true,
      message: `Device successfully converted to sellable inventory (ID #${newInventoryId})!`,
      phone_inventory_id: newInventoryId
    });
  } catch (error) {
    console.error('Error moving exchange to inventory:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/exchanges/:id (Admin only deletion - Unrestricted)
router.delete('/:id', authenticateToken, requireDeletePermission('exchanged_phones'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const existing = await prisma.exchangedPhone.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Exchanged phone record not found.' });
    }

    await prisma.exchangedPhone.delete({ where: { id } });

    await logAudit(
      req.user.id,
      req.user.username,
      'DELETE_EXCHANGE_RECORD',
      existing.storeId,
      'EXCHANGE',
      String(id),
      { exchange_number: existing.exchangeNumber, imei1: existing.imei1 },
      req
    );

    res.json({ success: true, message: 'Exchanged phone record removed permanently.' });
  } catch (error) {
    console.error('Error deleting exchange:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
  }
});

router.getNextExchangeNumber = getNextExchangeNumber;
module.exports = router;
