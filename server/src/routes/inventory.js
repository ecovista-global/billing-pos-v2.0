const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { authenticateToken, requireAdmin, requireSuperAdmin, requireDeletePermission, logAudit } = require('../middleware/auth');
const { enforceStoreContext } = require('../middleware/storeContext');

// Robust, collision-free internal product ID generator
async function generateNextPhoneProductId() {
  const result = await prisma.$queryRawUnsafe(`
    SELECT MAX(seq) as max_seq FROM (
      SELECT id as seq FROM phone_inventory
      UNION ALL
      SELECT CAST(SUBSTR(internal_product_id, 8) AS INTEGER) as seq 
      FROM phone_inventory 
      WHERE internal_product_id LIKE 'ECO-PH-%'
    )
  `);
  
  const maxSeqObj = result[0];
  let nextSeq = (maxSeqObj && maxSeqObj.max_seq !== null) ? Number(maxSeqObj.max_seq) + 1 : 1;
  let candidate = `ECO-PH-${String(nextSeq).padStart(5, '0')}`;

  while (await prisma.phoneInventory.findFirst({ where: { internalProductId: candidate } })) {
    nextSeq++;
    candidate = `ECO-PH-${String(nextSeq).padStart(5, '0')}`;
  }
  return candidate;
}

async function getNextPhoneSeq() {
  const result = await prisma.$queryRawUnsafe(`
    SELECT MAX(seq) as max_seq FROM (
      SELECT id as seq FROM phone_inventory
      UNION ALL
      SELECT CAST(SUBSTR(internal_product_id, 8) AS INTEGER) as seq 
      FROM phone_inventory 
      WHERE internal_product_id LIKE 'ECO-PH-%'
    )
  `);
  
  const maxSeqObj = result[0];
  return (maxSeqObj && maxSeqObj.max_seq !== null) ? Number(maxSeqObj.max_seq) + 1 : 1;
}

// GET /api/inventory (List with filters)
router.get('/', authenticateToken, enforceStoreContext, async (req, res) => {
  try {
    const { store_id, brand, condition_grade, stock_status, search, page = 1, limit = 50 } = req.query;

    const whereClause = {};

    if (!req.storeContext.isAllStores) {
      whereClause.currentStoreId = req.storeContext.store_id;
    } else if (store_id) {
      whereClause.currentStoreId = parseInt(store_id);
    }

    if (brand) whereClause.brand = brand;
    if (condition_grade) whereClause.conditionGrade = condition_grade;
    if (stock_status) whereClause.stockStatus = stock_status;

    if (search) {
      const sTerm = search.trim();
      whereClause.OR = [
        { imei1: { contains: sTerm } },
        { imei2: { contains: sTerm } },
        { serialNumber: { contains: sTerm } },
        { internalProductId: { contains: sTerm } },
        { model: { contains: sTerm } },
        { brand: { contains: sTerm } }
      ];
    }

    const total = await prisma.phoneInventory.count({ where: whereClause });
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const phonesRaw = await prisma.phoneInventory.findMany({
      where: whereClause,
      include: {
        currentStore: true,
        supplier: true
      },
      orderBy: { id: 'desc' },
      skip: offset,
      take: parseInt(limit)
    });

    const phones = phonesRaw.map(p => ({
      id: p.id,
      internal_product_id: p.internalProductId,
      brand: p.brand,
      model: p.model,
      variant: p.variant,
      ram: p.ram,
      storage: p.storage,
      color: p.color,
      imei1: p.imei1,
      imei2: p.imei2,
      serial_number: p.serialNumber,
      condition_grade: p.conditionGrade,
      battery_health: p.batteryHealth,
      purchase_price: p.purchasePrice,
      refurbishment_cost: p.refurbishmentCost,
      additional_cost: p.additionalCost,
      total_cost: p.totalCost,
      selling_price: p.sellingPrice,
      discount: p.discount,
      tax_rate: p.taxRate,
      final_selling_price: p.finalSellingPrice,
      supplier_id: p.supplierId,
      purchase_date: p.purchaseDate,
      warranty_period_months: p.warrantyPeriodMonths,
      current_store_id: p.currentStoreId,
      stock_status: p.stockStatus,
      date_added: p.dateAdded,
      notes: p.notes,
      created_at: p.createdAt,
      updated_at: p.updatedAt,

      store_name: p.currentStore?.name,
      store_code: p.currentStore?.code,
      store_city: p.currentStore?.city,
      supplier_name: p.supplier?.name
    }));

    res.json({
      success: true,
      phones,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/inventory/stats (Overview metrics)
router.get('/stats', authenticateToken, enforceStoreContext, async (req, res) => {
  try {
    let whereClause = '';
    const params = [];

    if (!req.storeContext.isAllStores) {
      whereClause = `WHERE current_store_id = ${req.storeContext.store_id}`;
    }

    const overallRaw = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*) as total_devices,
        COALESCE(SUM(CASE WHEN stock_status = 'AVAILABLE' THEN 1 ELSE 0 END), 0) as available_devices,
        COALESCE(SUM(CASE WHEN stock_status = 'SOLD' THEN 1 ELSE 0 END), 0) as sold_devices,
        COALESCE(SUM(CASE WHEN stock_status = 'IN_TRANSIT' THEN 1 ELSE 0 END), 0) as in_transit_devices,
        COALESCE(SUM(CASE WHEN stock_status = 'DEFECTIVE' THEN 1 ELSE 0 END), 0) as defective_devices,
        COALESCE(SUM(CASE WHEN stock_status = 'AVAILABLE' THEN total_cost ELSE 0 END), 0) as available_inventory_cost,
        COALESCE(SUM(CASE WHEN stock_status = 'AVAILABLE' THEN final_selling_price ELSE 0 END), 0) as available_inventory_value
      FROM phone_inventory
      ${whereClause}
    `);
    const overall = { ...overallRaw[0] };
    for (const key in overall) if (typeof overall[key] === 'bigint') overall[key] = Number(overall[key]);

    let storeWise = [];
    if (req.user.role === 'admin') {
      const storeWiseRaw = await prisma.$queryRawUnsafe(`
        SELECT s.id, s.name, s.code, s.city,
          COUNT(p.id) as total_devices,
          SUM(CASE WHEN p.stock_status = 'AVAILABLE' THEN 1 ELSE 0 END) as available_devices,
          SUM(CASE WHEN p.stock_status = 'SOLD' THEN 1 ELSE 0 END) as sold_devices,
          COALESCE(SUM(CASE WHEN p.stock_status = 'AVAILABLE' THEN p.total_cost ELSE 0 END), 0) as inventory_cost
        FROM stores s
        LEFT JOIN phone_inventory p ON s.id = p.current_store_id
        GROUP BY s.id
        ORDER BY s.id ASC
      `);
      storeWise = storeWiseRaw.map(row => {
        const r = { ...row };
        for (const key in r) if (typeof r[key] === 'bigint') r[key] = Number(r[key]);
        return r;
      });
    }

    res.json({ success: true, overall, storeWise });
  } catch (error) {
    console.error('Error fetching inventory stats:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/inventory/imei/:imei (Complete Lifecycle Search)
router.get('/imei/:imei', authenticateToken, enforceStoreContext, async (req, res) => {
  try {
    const imei = req.params.imei.trim();

    const p = await prisma.phoneInventory.findFirst({
      where: {
        OR: [
          { imei1: imei },
          { imei2: imei }
        ]
      },
      include: {
        currentStore: true,
        supplier: true
      }
    });

    if (!p) {
      return res.status(404).json({ success: false, message: 'Device with specified IMEI not found.' });
    }

    if (!req.storeContext.isAllStores && p.currentStoreId !== req.storeContext.store_id && p.stockStatus === 'AVAILABLE') {
      return res.status(403).json({ success: false, message: 'This device belongs to another store.' });
    }

    const mappedPhone = {
      id: p.id,
      internal_product_id: p.internalProductId,
      brand: p.brand,
      model: p.model,
      variant: p.variant,
      ram: p.ram,
      storage: p.storage,
      color: p.color,
      imei1: p.imei1,
      imei2: p.imei2,
      serial_number: p.serialNumber,
      condition_grade: p.conditionGrade,
      battery_health: p.batteryHealth,
      purchase_price: p.purchasePrice,
      refurbishment_cost: p.refurbishmentCost,
      additional_cost: p.additionalCost,
      total_cost: p.totalCost,
      selling_price: p.sellingPrice,
      discount: p.discount,
      tax_rate: p.taxRate,
      final_selling_price: p.finalSellingPrice,
      supplier_id: p.supplierId,
      purchase_date: p.purchaseDate,
      warranty_period_months: p.warrantyPeriodMonths,
      current_store_id: p.currentStoreId,
      stock_status: p.stockStatus,
      date_added: p.dateAdded,
      notes: p.notes,
      
      store_name: p.currentStore?.name,
      store_code: p.currentStore?.code,
      store_city: p.currentStore?.city,
      store_state: p.currentStore?.state,
      supplier_name: p.supplier?.name,
      supplier_phone: p.supplier?.phone,
      supplier_contact: p.supplier?.contactPerson
    };

    const saleInfoRaw = await prisma.saleItem.findFirst({
      where: { phoneId: p.id },
      include: {
        sale: {
          include: { customer: true, employee: true }
        }
      },
      orderBy: { id: 'desc' }
    });

    let saleInfo = null;
    if (saleInfoRaw && saleInfoRaw.sale) {
      saleInfo = {
        ...saleInfoRaw,
        invoice_number: saleInfoRaw.sale.invoiceNumber,
        sale_number: saleInfoRaw.sale.saleNumber,
        sale_date: saleInfoRaw.sale.saleDate,
        grand_total: saleInfoRaw.sale.grandTotal,
        customer_name: saleInfoRaw.sale.customer?.fullName,
        customer_phone: saleInfoRaw.sale.customer?.phone,
        customer_email: saleInfoRaw.sale.customer?.email,
        sold_by_employee: saleInfoRaw.sale.employee?.fullName
      };
    }

    const warrantyInfoRaw = await prisma.warranty.findFirst({
      where: { phoneId: p.id },
      orderBy: { id: 'desc' }
    });
    const warrantyInfo = warrantyInfoRaw ? {
      ...warrantyInfoRaw,
      start_date: warrantyInfoRaw.startDate,
      end_date: warrantyInfoRaw.endDate,
      phone_id: warrantyInfoRaw.phoneId,
      sale_id: warrantyInfoRaw.saleId
    } : null;

    const transfersRaw = await prisma.stockTransferItem.findMany({
      where: { phoneId: p.id },
      include: {
        transfer: {
          include: { fromStore: true, toStore: true, initiator: true, receiver: true }
        }
      },
      orderBy: { id: 'desc' }
    });
    
    const transfers = transfersRaw.map(ti => ({
      ...ti.transfer,
      transfer_number: ti.transfer.transferNumber,
      transfer_date: ti.transfer.transferDate,
      received_date: ti.transfer.receivedDate,
      from_store_name: ti.transfer.fromStore?.name,
      to_store_name: ti.transfer.toStore?.name,
      initiated_by_name: ti.transfer.initiator?.fullName,
      received_by_name: ti.transfer.receiver?.fullName
    }));

    const returnInfoRaw = await prisma.returnItem.findMany({
      where: { phoneId: p.id },
      include: {
        returnRecord: {
          include: { customer: true }
        }
      },
      orderBy: { id: 'desc' }
    });
    
    const returnInfo = returnInfoRaw.map(ri => ({
      ...ri.returnRecord,
      return_number: ri.returnRecord.returnNumber,
      return_date: ri.returnRecord.returnDate,
      customer_name: ri.returnRecord.customer?.fullName
    }));

    res.json({ success: true, phone: mappedPhone, saleInfo, warrantyInfo, transfers, returnInfo });
  } catch (error) {
    console.error('Error fetching imei history:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// POST /api/inventory (Add phone to inventory)
router.post('/', authenticateToken, enforceStoreContext, async (req, res) => {
  try {
    const {
      brand, model, variant, ram, storage, color,
      imei1, imei2, serial_number, condition_grade, battery_health,
      purchase_price, refurbishment_cost, additional_cost,
      selling_price, discount, tax_rate,
      supplier_id, purchase_date, warranty_period_months,
      current_store_id, notes
    } = req.body;

    if (!brand || !model || !imei1 || selling_price === undefined) {
      return res.status(400).json({ success: false, message: 'Brand, model, IMEI 1, and selling price are required.' });
    }

    const cleanImei1 = String(imei1).trim();
    if (!/^\d{15}$/.test(cleanImei1)) {
      return res.status(400).json({ success: false, message: 'IMEI 1 must be exactly 15 numeric digits.' });
    }

    const cleanImei2 = imei2 && String(imei2).trim() ? String(imei2).trim() : null;
    if (cleanImei2 && !/^\d{15}$/.test(cleanImei2)) {
      return res.status(400).json({ success: false, message: 'Secondary IMEI 2 must be exactly 15 numeric digits.' });
    }

    const existing1 = await prisma.phoneInventory.findFirst({
      where: { OR: [{ imei1: cleanImei1 }, { imei2: cleanImei1 }] }
    });
    if (existing1) return res.status(400).json({ success: false, message: `IMEI ${cleanImei1} already exists in the system (Status: ${existing1.stockStatus}).` });

    if (cleanImei2) {
      const existing2 = await prisma.phoneInventory.findFirst({
        where: { OR: [{ imei1: cleanImei2 }, { imei2: cleanImei2 }] }
      });
      if (existing2) return res.status(400).json({ success: false, message: `Secondary IMEI ${cleanImei2} already exists in the system.` });
    }

    const pCost = parseFloat(purchase_price || 0);
    const rCost = parseFloat(refurbishment_cost || 0);
    const aCost = parseFloat(additional_cost || 0);
    const totalCost = pCost + rCost + aCost;

    const sPrice = parseFloat(selling_price);
    const disc = parseFloat(discount || 0);
    const defaultTaxSetting = await prisma.setting.findUnique({ where: { key: 'default_tax_rate' } });
    const fallbackTaxRate = defaultTaxSetting && !isNaN(parseFloat(defaultTaxSetting.value)) ? parseFloat(defaultTaxSetting.value) : 5.0;
    const tRate = (tax_rate !== undefined && tax_rate !== null && !isNaN(parseFloat(tax_rate))) ? parseFloat(tax_rate) : fallbackTaxRate;
    const difference = Math.max(0, sPrice - pCost);
    const taxAmount = Math.round((difference * (tRate / 100)) * 100) / 100;
    const finalPrice = Math.max(0, (sPrice + taxAmount) - disc);

    const targetStoreId = (req.user.role === 'admin' && current_store_id) ? parseInt(current_store_id) : req.user.assigned_store_id;
    if (!targetStoreId) return res.status(400).json({ success: false, message: 'Store must be assigned.' });

    const internalId = await generateNextPhoneProductId();

    const info = await prisma.phoneInventory.create({
      data: {
        internalProductId: internalId, brand, model, variant: variant || '', ram: ram || '', storage: storage || '', color: color || '',
        imei1: cleanImei1, imei2: cleanImei2, serialNumber: serial_number || '', conditionGrade: condition_grade || 'Grade A', batteryHealth: battery_health || '90%',
        purchasePrice: pCost, refurbishmentCost: rCost, additionalCost: aCost, totalCost,
        sellingPrice: sPrice, discount: disc, taxRate: tRate, finalSellingPrice: finalPrice,
        supplierId: supplier_id ? parseInt(supplier_id) : null, purchaseDate: purchase_date ? new Date(purchase_date) : null, warrantyPeriodMonths: parseInt(warranty_period_months || 6),
        currentStoreId: targetStoreId, stockStatus: 'AVAILABLE', dateAdded: new Date(), notes: notes || ''
      }
    });

    await logAudit(req.user.id, req.user.username, 'ADD_INVENTORY', targetStoreId, 'PHONE', String(info.id), { internalId, imei1: cleanImei1, brand, model, totalCost }, req);

    res.status(201).json({ success: true, message: 'Phone added to inventory successfully.', phoneId: info.id, internal_product_id: internalId });
  } catch (error) {
    console.error('Error adding inventory:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// POST /api/inventory/bulk-upload (Bulk Excel/CSV Upload)
router.post('/bulk-upload', authenticateToken, enforceStoreContext, async (req, res) => {
  try {
    const { devices, default_store_id, default_supplier_id, default_purchase_date } = req.body;

    if (!Array.isArray(devices) || devices.length === 0) {
      return res.status(400).json({ success: false, message: 'No device records provided in upload.' });
    }

    const fallbackStoreId = (req.user.role === 'admin' && default_store_id) ? parseInt(default_store_id) : (req.user.assigned_store_id || 1);
    
    const defaultTaxSetting = await prisma.setting.findUnique({ where: { key: 'default_tax_rate' } });
    const systemTaxRate = defaultTaxSetting && !isNaN(parseFloat(defaultTaxSetting.value)) ? parseFloat(defaultTaxSetting.value) : 5.0;

    const allStores = await prisma.store.findMany({ select: { id: true, code: true, name: true } });
    const storeMap = {};
    allStores.forEach(s => {
      storeMap[String(s.id)] = s.id;
      if (s.code) storeMap[s.code.toUpperCase()] = s.id;
      if (s.name) storeMap[s.name.toUpperCase()] = s.id;
    });

    const allSuppliers = await prisma.supplier.findMany({ select: { id: true, name: true } });
    const supplierMap = {};
    allSuppliers.forEach(s => {
      supplierMap[String(s.id)] = s.id;
      supplierMap[s.name.trim().toUpperCase()] = s.id;
      supplierMap[s.name.trim().toUpperCase().replace(/\\s+/g, '')] = s.id;
    });

    const existingImeisRows = await prisma.phoneInventory.findMany({ select: { imei1: true, imei2: true } });
    const existingImeiSet = new Set();
    existingImeisRows.forEach(row => {
      if (row.imei1) existingImeiSet.add(row.imei1.trim().toUpperCase());
      if (row.imei2) existingImeiSet.add(row.imei2.trim().toUpperCase());
    });

    const importedDevices = [];
    const failedRows = [];
    const seenInBatch = new Set();
    let nextSeq = await getNextPhoneSeq();

    await prisma.$transaction(async (tx) => {
      for (let idx = 0; idx < devices.length; idx++) {
        const dev = devices[idx];
        const rowNum = idx + 1;
        const brand = dev.brand ? String(dev.brand).trim() : '';
        const model = dev.model ? String(dev.model).trim() : '';
        const rawImei1 = dev.imei1 ? String(dev.imei1).replace(/\\s/g, '').trim() : '';
        const rawImei2 = dev.imei2 ? String(dev.imei2).replace(/\\s/g, '').trim() : '';
        const sellingPrice = parseFloat(dev.selling_price || dev.price);

        if (!brand) { failedRows.push({ row: rowNum, imei: rawImei1 || 'N/A', reason: 'Missing required Brand' }); continue; }
        if (!model) { failedRows.push({ row: rowNum, imei: rawImei1 || 'N/A', reason: 'Missing required Model' }); continue; }
        if (!rawImei1 || !/^\d{15}$/.test(rawImei1)) { failedRows.push({ row: rowNum, imei: rawImei1 || 'N/A', reason: 'IMEI 1 must be exactly 15 numeric digits' }); continue; }
        if (isNaN(sellingPrice) || sellingPrice <= 0) { failedRows.push({ row: rowNum, imei: rawImei1, reason: 'Invalid or missing Selling Price' }); continue; }

        const imei1Upper = rawImei1.toUpperCase();
        if (seenInBatch.has(imei1Upper)) { failedRows.push({ row: rowNum, imei: rawImei1, reason: 'Duplicate IMEI 1 in this uploaded file' }); continue; }
        if (existingImeiSet.has(imei1Upper)) { failedRows.push({ row: rowNum, imei: rawImei1, reason: 'IMEI 1 already exists in inventory database' }); continue; }

        if (rawImei2) {
          if (!/^\d{15}$/.test(rawImei2)) { failedRows.push({ row: rowNum, imei: rawImei2, reason: 'Secondary IMEI 2 must be exactly 15 numeric digits' }); continue; }
          const imei2Upper = rawImei2.toUpperCase();
          if (seenInBatch.has(imei2Upper) || existingImeiSet.has(imei2Upper)) { failedRows.push({ row: rowNum, imei: rawImei2, reason: 'Secondary IMEI 2 already exists' }); continue; }
          seenInBatch.add(imei2Upper);
        }

        seenInBatch.add(imei1Upper);
        existingImeiSet.add(imei1Upper);

        let targetStoreId = fallbackStoreId;
        if (dev.store_id) targetStoreId = parseInt(dev.store_id);
        else if (dev.store_code && storeMap[String(dev.store_code).toUpperCase()]) targetStoreId = storeMap[String(dev.store_code).toUpperCase()];
        else if (dev.store_name && storeMap[String(dev.store_name).toUpperCase()]) targetStoreId = storeMap[String(dev.store_name).toUpperCase()];

        let targetSupplierId = default_supplier_id ? parseInt(default_supplier_id) : null;
        const rawSupplier = dev.supplier_name || dev.supplier_info || dev.supplier || dev.supplier_id || '';
        
        if (rawSupplier) {
          const supStr = String(rawSupplier).trim();
          const supUpper = supStr.toUpperCase();
          const supClean = supUpper.replace(/\\s+/g, '');
          if (supplierMap[supStr]) targetSupplierId = supplierMap[supStr];
          else if (supplierMap[supUpper]) targetSupplierId = supplierMap[supUpper];
          else if (supplierMap[supClean]) targetSupplierId = supplierMap[supClean];
          else if (supStr.length > 1) {
            const newSupInfo = await tx.supplier.create({ data: { name: supStr, status: 'active' } });
            targetSupplierId = newSupInfo.id;
            supplierMap[String(targetSupplierId)] = targetSupplierId;
            supplierMap[supUpper] = targetSupplierId;
            supplierMap[supClean] = targetSupplierId;
          }
        }

        const pCost = Math.max(0, parseFloat(dev.purchase_price || dev.cost || 0));
        const rCost = Math.max(0, parseFloat(dev.refurbishment_cost || 0));
        const aCost = Math.max(0, parseFloat(dev.additional_cost || 0));
        const totalCost = pCost + rCost + aCost;

        const disc = Math.max(0, parseFloat(dev.discount || 0));
        const tRate = (dev.tax_rate !== undefined && dev.tax_rate !== null && !isNaN(parseFloat(dev.tax_rate))) ? parseFloat(dev.tax_rate) : systemTaxRate;
        const difference = Math.max(0, sellingPrice - pCost);
        const taxAmount = Math.round((difference * (tRate / 100)) * 100) / 100;
        const finalPrice = Math.max(0, (sellingPrice + taxAmount) - disc);
        
        let internalId = `ECO-PH-${String(nextSeq++).padStart(5, '0')}`;
        
        const info = await tx.phoneInventory.create({
          data: {
            internalProductId: internalId, brand, model, variant: dev.variant || dev.storage || '', ram: dev.ram || '', storage: dev.storage || dev.variant || '', color: dev.color || 'Standard',
            imei1: rawImei1, imei2: rawImei2 || null, serialNumber: dev.serial_number || dev.serial || '', conditionGrade: dev.condition_grade || dev.grade || 'Grade A', batteryHealth: dev.battery_health ? String(dev.battery_health).trim() : '90%',
            purchasePrice: pCost, refurbishmentCost: rCost, additionalCost: aCost, totalCost,
            sellingPrice: sellingPrice, discount: disc, taxRate: tRate, finalSellingPrice: finalPrice,
            supplierId: targetSupplierId, purchaseDate: dev.purchase_date || default_purchase_date ? new Date(dev.purchase_date || default_purchase_date) : null, warrantyPeriodMonths: parseInt(dev.warranty_period_months || dev.warranty || 6),
            currentStoreId: targetStoreId, stockStatus: 'AVAILABLE', dateAdded: new Date(), notes: dev.notes || 'Bulk Excel Ingestion'
          }
        });

        importedDevices.push({
          id: info.id,
          internal_product_id: internalId,
          brand, model, imei1: rawImei1, selling_price: sellingPrice, supplier_id: targetSupplierId
        });
      }
    }, {
      timeout: 20000 // Allow extra time for large batch inserts
    });

    if (importedDevices.length > 0) {
      await logAudit(req.user.id, req.user.username, 'BULK_STOCK_UPLOAD', fallbackStoreId, 'INVENTORY', String(importedDevices[0].id), { totalProcessed: devices.length, importedCount: importedDevices.length, failedCount: failedRows.length }, req);
    }

    res.json({
      success: true,
      message: `Successfully imported ${importedDevices.length} device(s) into inventory!${failedRows.length > 0 ? ' (' + failedRows.length + ' skipped due to duplicates or validation errors)' : ''}`,
      importedCount: importedDevices.length, failedCount: failedRows.length, totalProcessed: devices.length, failedRows
    });
  } catch (error) {
    console.error('Error during bulk upload:', error);
    res.status(500).json({ success: false, message: 'Database transaction error during bulk upload: ' + error.message });
  }
});

// GET /api/inventory/meta/catalog (Brands, models, grades, suppliers)
router.get('/meta/catalog', authenticateToken, enforceStoreContext, async (req, res) => {
  try {
    const brands = await prisma.brand.findMany({ orderBy: { name: 'asc' } });
    const modelsRaw = await prisma.phoneModel.findMany({ include: { brand: true }, orderBy: { name: 'asc' } });
    const models = modelsRaw.map(m => ({ ...m, brand_id: m.brandId, brand_name: m.brand?.name }));
    const grades = await prisma.grade.findMany({ orderBy: { id: 'asc' } });
    const suppliers = await prisma.supplier.findMany({ where: { status: 'active' }, select: { id: true, name: true, contactPerson: true, phone: true, city: true } });
    const stores = await prisma.store.findMany({ where: { status: 'active' }, select: { id: true, name: true, code: true, city: true } });

    res.json({ success: true, brands, models, grades, suppliers, stores });
  } catch (error) {
    console.error('Error fetching meta catalog:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// PUT /api/inventory/:id (Update Phone Details)
router.put('/:id', authenticateToken, enforceStoreContext, async (req, res) => {
  try {
    const phoneId = parseInt(req.params.id);
    const existing = await prisma.phoneInventory.findUnique({ where: { id: phoneId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Device not found.' });

    if (req.user.role !== 'admin' && existing.currentStoreId !== req.user.assigned_store_id) {
      return res.status(403).json({ success: false, message: 'Access denied to update inventory in other stores.' });
    }

    const {
      brand, model, variant, ram, storage, color,
      imei1, imei2, serial_number, condition_grade, battery_health,
      purchase_price, refurbishment_cost, additional_cost,
      selling_price, discount, tax_rate,
      supplier_id, purchase_date, warranty_period_months,
      current_store_id, stock_status, notes
    } = req.body;

    if (!brand || !model || !imei1 || selling_price === undefined) {
      return res.status(400).json({ success: false, message: 'Brand, model, IMEI 1, and selling price are required.' });
    }

    const cleanImei1 = String(imei1).trim();
    if (!/^\d{15}$/.test(cleanImei1)) return res.status(400).json({ success: false, message: 'IMEI 1 must be exactly 15 numeric digits.' });

    const cleanImei2 = imei2 && String(imei2).trim() ? String(imei2).trim() : null;
    if (cleanImei2 && !/^\d{15}$/.test(cleanImei2)) return res.status(400).json({ success: false, message: 'Secondary IMEI 2 must be exactly 15 numeric digits.' });

    const dupImei1 = await prisma.phoneInventory.findFirst({
      where: { OR: [{ imei1: cleanImei1 }, { imei2: cleanImei1 }], NOT: { id: phoneId } }
    });
    if (dupImei1) return res.status(400).json({ success: false, message: `IMEI ${cleanImei1} is already registered on another device (ID #${dupImei1.id}, Status: ${dupImei1.stockStatus}).` });

    if (cleanImei2) {
      const dupImei2 = await prisma.phoneInventory.findFirst({
        where: { OR: [{ imei1: cleanImei2 }, { imei2: cleanImei2 }], NOT: { id: phoneId } }
      });
      if (dupImei2) return res.status(400).json({ success: false, message: `Secondary IMEI ${cleanImei2} is already registered on another device.` });
    }

    const pCost = parseFloat(purchase_price !== undefined ? purchase_price : existing.purchasePrice);
    const rCost = parseFloat(refurbishment_cost !== undefined ? refurbishment_cost : existing.refurbishmentCost);
    const aCost = parseFloat(additional_cost !== undefined ? additional_cost : existing.additionalCost);
    const totalCost = pCost + rCost + aCost;

    const sPrice = parseFloat(selling_price !== undefined ? selling_price : existing.sellingPrice);
    const disc = parseFloat(discount !== undefined ? discount : existing.discount);
    const defaultTaxSetting = await prisma.setting.findUnique({ where: { key: 'default_tax_rate' } });
    const fallbackTaxRate = defaultTaxSetting && !isNaN(parseFloat(defaultTaxSetting.value)) ? parseFloat(defaultTaxSetting.value) : 5.0;
    const tRate = (tax_rate !== undefined && tax_rate !== null && !isNaN(parseFloat(tax_rate))) ? parseFloat(tax_rate) : fallbackTaxRate;
    const difference = Math.max(0, sPrice - pCost);
    const taxAmount = Math.round((difference * (tRate / 100)) * 100) / 100;
    const finalPrice = Math.max(0, (sPrice + taxAmount) - disc);

    const targetStoreId = (req.user.role === 'admin' && current_store_id) ? parseInt(current_store_id) : (existing.currentStoreId || req.user.assigned_store_id);
    let updatedStatus = stock_status || existing.stockStatus || 'AVAILABLE';

    await prisma.$transaction(async (tx) => {
      // Auto-transition QUICK_BILLED to SOLD if cost is updated
      let costUpdated = false;
      if (existing.stockStatus === 'QUICK_BILLED') {
        if (totalCost > 0) {
          updatedStatus = 'SOLD';
          costUpdated = true;
        } else {
          updatedStatus = 'QUICK_BILLED';
        }
      }

      await tx.phoneInventory.update({
        where: { id: phoneId },
        data: {
          brand: brand.trim(), model: model.trim(), variant: variant || '', ram: ram || '', storage: storage || '', color: color || '',
          imei1: cleanImei1, imei2: cleanImei2, serialNumber: serial_number || '', conditionGrade: condition_grade || 'Grade A', batteryHealth: battery_health || '90%',
          purchasePrice: pCost, refurbishmentCost: rCost, additionalCost: aCost, totalCost,
          sellingPrice: sPrice, discount: disc, taxRate: tRate, finalSellingPrice: finalPrice,
          supplierId: supplier_id ? parseInt(supplier_id) : null, purchaseDate: purchase_date ? new Date(purchase_date) : null, warrantyPeriodMonths: parseInt(warranty_period_months || 6),
          currentStoreId: targetStoreId, stockStatus: updatedStatus, notes: notes || ''
        }
      });

      if (costUpdated) {
        // Find the sale item linked to this phone (Quick Billed)
        const saleItem = await tx.saleItem.findFirst({
          where: { phoneId: phoneId },
          include: { sale: true }
        });

        if (saleItem) {
          const itemSPrice = parseFloat(saleItem.sellingPrice);
          const itemTRate = parseFloat(saleItem.taxRate);
          
          // Using Margin Scheme logic for Quick Bill phones
          const inclusiveDifference = Math.max(0, itemSPrice - totalCost);
          const taxableMargin = inclusiveDifference / (1 + (itemTRate / 100));
          const newTaxAmount = Math.round((taxableMargin * (itemTRate / 100)) * 100) / 100;
          const newTaxableAmount = Math.round(taxableMargin * 100) / 100;
          
          const isInterState = saleItem.igst > 0;
          let newCgst = 0, newSgst = 0, newIgst = 0;
          if (isInterState) newIgst = newTaxAmount;
          else {
            newCgst = Math.round((newTaxAmount / 2) * 100) / 100;
            newSgst = Math.round((newTaxAmount - newCgst) * 100) / 100;
          }

          const oldTaxAmount = parseFloat(saleItem.totalTax);
          const oldTaxableAmount = parseFloat(saleItem.taxableAmount);

          await tx.saleItem.update({
            where: { id: saleItem.id },
            data: {
              unitCost: totalCost,
              taxableAmount: newTaxableAmount,
              totalTax: newTaxAmount,
              cgst: newCgst,
              sgst: newSgst,
              igst: newIgst
            }
          });

          await tx.sale.update({
            where: { id: saleItem.saleId },
            data: {
              totalTax: { increment: newTaxAmount - oldTaxAmount },
              taxableAmount: { increment: newTaxableAmount - oldTaxableAmount }
            }
          });
        }
      }
    });

    await logAudit(req.user.id, req.user.username, 'UPDATE_INVENTORY', targetStoreId, 'PHONE', String(phoneId), { imei: cleanImei1, brand, model, totalCost, selling_price: sPrice, stock_status: updatedStatus }, req);

    res.json({ success: true, message: 'Stock data updated successfully.' });
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/inventory/:id (Delete stock item - Unrestricted for Admin)
router.delete('/:id', authenticateToken, enforceStoreContext, requireDeletePermission('inventory'), async (req, res) => {
  try {
    const phoneId = parseInt(req.params.id);
    const phone = await prisma.phoneInventory.findUnique({ where: { id: phoneId } });
    if (!phone) return res.status(404).json({ success: false, message: 'Device not found.' });

    const isSuperAdmin = req.user.role === 'super_admin';
    const isRegularAdmin = req.user.role === 'admin';

    if (!isSuperAdmin && !isRegularAdmin && phone.currentStoreId !== req.user.assigned_store_id) {
      return res.status(403).json({ success: false, message: 'Access denied to delete inventory in other stores.' });
    }

    // Only Super Admin can delete SOLD or INVOICED devices
    const saleItem = await prisma.saleItem.findFirst({ where: { phoneId } });
    if ((saleItem || phone.stockStatus === 'SOLD') && !isSuperAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: `Permission Denied: Device is linked to an invoice (or marked as SOLD). Only the Master Super Admin with 2FA authorization can permanently delete sold items.` 
      });
    }

    if (!isSuperAdmin) {
      const activeTransfer = await prisma.stockTransferItem.findFirst({
        where: { phoneId, transfer: { status: 'PENDING' } }
      });
      if (activeTransfer) {
        return res.status(400).json({ success: false, message: 'Cannot delete device while it has a pending stock transfer. Please complete or cancel the transfer first.' });
      }
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete linked warranties
      await tx.warranty.deleteMany({ where: { phoneId } });
      // 2. Delete linked return items
      await tx.returnItem.deleteMany({ where: { phoneId } });
      // 3. Delete linked stock transfer items
      await tx.stockTransferItem.deleteMany({ where: { phoneId } });
      // 4. Delete linked sale items (if sold / billed)
      await tx.saleItem.deleteMany({ where: { phoneId } });
      // 5. Unlink from exchanged phones if referenced
      await tx.exchangedPhone.updateMany({
        where: { phoneInventoryId: phoneId },
        data: { phoneInventoryId: null }
      });
      // 6. Delete the phone inventory itself
      await tx.phoneInventory.delete({ where: { id: phoneId } });
    });

    await logAudit(req.user.id, req.user.username, 'DELETE_INVENTORY', phone.currentStoreId, 'PHONE', String(phoneId), { imei: phone.imei1, brand: phone.brand, model: phone.model, stock_status: phone.stockStatus }, req);

    res.json({ success: true, message: `Device ${phone.brand} ${phone.model} (IMEI: ${phone.imei1}) deleted permanently.` });
  } catch (error) {
    console.error('Error deleting inventory:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
