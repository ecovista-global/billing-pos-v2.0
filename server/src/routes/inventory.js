const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticateToken, requireAdmin, logAudit } = require('../middleware/auth');

// Robust, collision-free internal product ID generator
function generateNextPhoneProductId(database) {
  const row = database.prepare(`
    SELECT MAX(seq) as max_seq FROM (
      SELECT id as seq FROM phone_inventory
      UNION ALL
      SELECT CAST(SUBSTR(internal_product_id, 8) AS INTEGER) as seq 
      FROM phone_inventory 
      WHERE internal_product_id LIKE 'ECO-PH-%'
    )
  `).get();

  let nextSeq = (row && row.max_seq && !isNaN(row.max_seq)) ? Number(row.max_seq) + 1 : 1;
  let candidate = `ECO-PH-${String(nextSeq).padStart(5, '0')}`;

  while (database.prepare(`SELECT 1 FROM phone_inventory WHERE internal_product_id = ?`).get(candidate)) {
    nextSeq++;
    candidate = `ECO-PH-${String(nextSeq).padStart(5, '0')}`;
  }
  return candidate;
}

function getNextPhoneSeq(database) {
  const row = database.prepare(`
    SELECT MAX(seq) as max_seq FROM (
      SELECT id as seq FROM phone_inventory
      UNION ALL
      SELECT CAST(SUBSTR(internal_product_id, 8) AS INTEGER) as seq 
      FROM phone_inventory 
      WHERE internal_product_id LIKE 'ECO-PH-%'
    )
  `).get();

  return (row && row.max_seq && !isNaN(row.max_seq)) ? Number(row.max_seq) + 1 : 1;
}

// GET /api/inventory (List with filters)
router.get('/', authenticateToken, (req, res) => {
  const { store_id, brand, condition_grade, stock_status, search, page = 1, limit = 50 } = req.query;

  let baseQuery = `
    SELECT p.*, s.name as store_name, s.code as store_code, s.city as store_city,
           sup.name as supplier_name
    FROM phone_inventory p
    LEFT JOIN stores s ON p.current_store_id = s.id
    LEFT JOIN suppliers sup ON p.supplier_id = sup.id
    WHERE 1=1
  `;
  const params = [];

  // Employee restricted to their store
  if (req.user.role !== 'admin') {
    baseQuery += ` AND p.current_store_id = ?`;
    params.push(req.user.assigned_store_id);
  } else if (store_id) {
    baseQuery += ` AND p.current_store_id = ?`;
    params.push(parseInt(store_id));
  }

  if (brand) {
    baseQuery += ` AND p.brand = ?`;
    params.push(brand);
  }

  if (condition_grade) {
    baseQuery += ` AND p.condition_grade = ?`;
    params.push(condition_grade);
  }

  if (stock_status) {
    baseQuery += ` AND p.stock_status = ?`;
    params.push(stock_status);
  }

  if (search) {
    baseQuery += ` AND (p.imei1 LIKE ? OR p.imei2 LIKE ? OR p.serial_number LIKE ? OR p.internal_product_id LIKE ? OR p.model LIKE ? OR p.brand LIKE ?)`;
    const sTerm = `%${search.trim()}%`;
    params.push(sTerm, sTerm, sTerm, sTerm, sTerm, sTerm);
  }

  // Count query
  const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery})`;
  const countResult = db.prepare(countQuery).get(...params);

  // Pagination
  const offset = (parseInt(page) - 1) * parseInt(limit);
  baseQuery += ` ORDER BY p.id DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);

  const phones = db.prepare(baseQuery).all(...params);

  res.json({
    success: true,
    phones,
    pagination: {
      total: countResult.total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(countResult.total / parseInt(limit))
    }
  });
});

// GET /api/inventory/stats (Overview metrics)
router.get('/stats', authenticateToken, (req, res) => {
  let whereClause = '';
  const params = [];

  if (req.user.role !== 'admin') {
    whereClause = ' WHERE current_store_id = ?';
    params.push(req.user.assigned_store_id);
  }

  const overall = db.prepare(`
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
  `).get(...params);

  // Store-wise breakdown (Admin only)
  let storeWise = [];
  if (req.user.role === 'admin') {
    storeWise = db.prepare(`
      SELECT s.id, s.name, s.code, s.city,
        COUNT(p.id) as total_devices,
        SUM(CASE WHEN p.stock_status = 'AVAILABLE' THEN 1 ELSE 0 END) as available_devices,
        SUM(CASE WHEN p.stock_status = 'SOLD' THEN 1 ELSE 0 END) as sold_devices,
        COALESCE(SUM(CASE WHEN p.stock_status = 'AVAILABLE' THEN p.total_cost ELSE 0 END), 0) as inventory_cost
      FROM stores s
      LEFT JOIN phone_inventory p ON s.id = p.current_store_id
      GROUP BY s.id
      ORDER BY s.id ASC
    `).all();
  }

  res.json({ success: true, overall, storeWise });
});

// GET /api/inventory/imei/:imei (Complete Lifecycle Search)
router.get('/imei/:imei', authenticateToken, (req, res) => {
  const imei = req.params.imei.trim();

  const phone = db.prepare(`
    SELECT p.*, s.name as store_name, s.code as store_code, s.city as store_city, s.state as store_state,
           sup.name as supplier_name, sup.phone as supplier_phone, sup.contact_person as supplier_contact
    FROM phone_inventory p
    LEFT JOIN stores s ON p.current_store_id = s.id
    LEFT JOIN suppliers sup ON p.supplier_id = sup.id
    WHERE p.imei1 = ? OR p.imei2 = ?
  `).get(imei, imei);

  if (!phone) {
    return res.status(404).json({ success: false, message: 'Device with specified IMEI not found.' });
  }

  // Employee store access verification
  if (req.user.role !== 'admin' && phone.current_store_id !== req.user.assigned_store_id && phone.stock_status === 'AVAILABLE') {
    return res.status(403).json({ success: false, message: 'This device belongs to another store.' });
  }

  // Find Sale info if sold
  const saleInfo = db.prepare(`
    SELECT si.*, sa.invoice_number, sa.sale_number, sa.sale_date, sa.grand_total,
           c.full_name as customer_name, c.phone as customer_phone, c.email as customer_email,
           u.full_name as sold_by_employee
    FROM sale_items si
    JOIN sales sa ON si.sale_id = sa.id
    LEFT JOIN customers c ON sa.customer_id = c.id
    LEFT JOIN users u ON sa.employee_id = u.id
    WHERE si.phone_id = ?
    ORDER BY sa.sale_date DESC
    LIMIT 1
  `).get(phone.id);

  // Warranty info
  const warrantyInfo = db.prepare(`
    SELECT * FROM warranties WHERE phone_id = ? ORDER BY id DESC LIMIT 1
  `).get(phone.id);

  // Transfers history
  const transfers = db.prepare(`
    SELECT t.*, 
           fs.name as from_store_name, ts.name as to_store_name,
           u1.full_name as initiated_by_name, u2.full_name as received_by_name
    FROM stock_transfer_items ti
    JOIN stock_transfers t ON ti.transfer_id = t.id
    LEFT JOIN stores fs ON t.from_store_id = fs.id
    LEFT JOIN stores ts ON t.to_store_id = ts.id
    LEFT JOIN users u1 ON t.initiated_by = u1.id
    LEFT JOIN users u2 ON t.received_by = u2.id
    WHERE ti.phone_id = ?
    ORDER BY t.created_at DESC
  `).all(phone.id);

  // Return history
  const returnInfo = db.prepare(`
    SELECT r.*, c.full_name as customer_name
    FROM return_items ri
    JOIN returns r ON ri.return_id = r.id
    LEFT JOIN customers c ON r.customer_id = c.id
    WHERE ri.phone_id = ?
    ORDER BY r.created_at DESC
  `).all(phone.id);

  res.json({
    success: true,
    phone,
    saleInfo,
    warrantyInfo,
    transfers,
    returnInfo
  });
});

// POST /api/inventory (Add phone to inventory)
router.post('/', authenticateToken, (req, res) => {
  const {
    brand, model, variant, ram, storage, color,
    imei1, imei2, serial_number, condition_grade, battery_health,
    purchase_price, refurbishment_cost, additional_cost,
    selling_price, discount, tax_rate,
    supplier_id, purchase_date, warranty_period_months,
    current_store_id, notes
  } = req.body;

  if (!brand || !model || !imei1 || !selling_price) {
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

  // Check IMEI Uniqueness (Rule 1)
  const existing = db.prepare(`SELECT id, imei1, stock_status FROM phone_inventory WHERE imei1 = ? OR (imei2 IS NOT NULL AND imei2 = ?)`).get(cleanImei1, cleanImei1);
  if (existing) {
    return res.status(400).json({ success: false, message: `IMEI ${cleanImei1} already exists in the system (Status: ${existing.stock_status}).` });
  }

  if (cleanImei2) {
    const existing2 = db.prepare(`SELECT id, imei1 FROM phone_inventory WHERE imei1 = ? OR imei2 = ?`).get(cleanImei2, cleanImei2);
    if (existing2) {
      return res.status(400).json({ success: false, message: `Secondary IMEI ${cleanImei2} already exists in the system.` });
    }
  }

  const pCost = parseFloat(purchase_price || 0);
  const rCost = parseFloat(refurbishment_cost || 0);
  const aCost = parseFloat(additional_cost || 0);
  const totalCost = pCost + rCost + aCost;

  const sPrice = parseFloat(selling_price);
  const disc = parseFloat(discount || 0);
  const defaultTaxRow = db.prepare(`SELECT value FROM settings WHERE key = 'default_tax_rate'`).get();
  const fallbackTaxRate = defaultTaxRow && !isNaN(parseFloat(defaultTaxRow.value)) ? parseFloat(defaultTaxRow.value) : 5.0;
  const tRate = (tax_rate !== undefined && tax_rate !== null && !isNaN(parseFloat(tax_rate))) ? parseFloat(tax_rate) : fallbackTaxRate;
  const difference = Math.max(0, sPrice - pCost);
  const taxAmount = Math.round((difference * (tRate / 100)) * 100) / 100;
  const finalPrice = Math.max(0, (sPrice + taxAmount) - disc);

  const targetStoreId = (req.user.role === 'admin' && current_store_id) ? parseInt(current_store_id) : req.user.assigned_store_id;
  if (!targetStoreId) {
    return res.status(400).json({ success: false, message: 'Store must be assigned.' });
  }

  // Generate guaranteed unique internal product ID
  const internalId = generateNextPhoneProductId(db);

  try {
    const info = db.prepare(`
      INSERT INTO phone_inventory (
        internal_product_id, brand, model, variant, ram, storage, color,
        imei1, imei2, serial_number, condition_grade, battery_health,
        purchase_price, refurbishment_cost, additional_cost, total_cost,
        selling_price, discount, tax_rate, final_selling_price,
        supplier_id, purchase_date, warranty_period_months,
        current_store_id, stock_status, date_added, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', DATE('now'), ?)
    `).run(
      internalId, brand, model, variant || '', ram || '', storage || '', color || '',
      imei1.trim(), imei2 ? imei2.trim() : null, serial_number || '', condition_grade || 'Grade A', battery_health || '90%',
      pCost, rCost, aCost, totalCost,
      sPrice, disc, tRate, finalPrice,
      supplier_id || null, purchase_date || null, parseInt(warranty_period_months || 6),
      targetStoreId, notes || ''
    );

    logAudit(req.user.id, req.user.username, 'ADD_INVENTORY', targetStoreId, 'PHONE', info.lastInsertRowid, { internalId, imei1, brand, model, totalCost }, req);

    res.status(201).json({
      success: true,
      message: 'Phone added to inventory successfully.',
      phoneId: info.lastInsertRowid,
      internal_product_id: internalId
    });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed: phone_inventory.imei1')) {
      return res.status(400).json({ success: false, message: `IMEI 1 "${imei1}" is already registered in inventory.` });
    }
    if (err.message && err.message.includes('UNIQUE constraint failed: phone_inventory.imei2')) {
      return res.status(400).json({ success: false, message: `IMEI 2 "${imei2}" is already registered in inventory.` });
    }
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST /api/inventory/bulk-upload (Bulk Excel/CSV Upload)
router.post('/bulk-upload', authenticateToken, (req, res) => {
  const { devices, default_store_id, default_supplier_id, default_purchase_date } = req.body;

  if (!Array.isArray(devices) || devices.length === 0) {
    return res.status(400).json({ success: false, message: 'No device records provided in upload.' });
  }

  // Determine fallback store
  const fallbackStoreId = (req.user.role === 'admin' && default_store_id)
    ? parseInt(default_store_id)
    : (req.user.assigned_store_id || 1);

  // System Tax rate
  const defaultTaxRow = db.prepare(`SELECT value FROM settings WHERE key = 'default_tax_rate'`).get();
  const systemTaxRate = defaultTaxRow && !isNaN(parseFloat(defaultTaxRow.value)) ? parseFloat(defaultTaxRow.value) : 5.0;

  // Stores cache for resolving store by name or code if specified in excel
  const allStores = db.prepare(`SELECT id, code, name FROM stores`).all();
  const storeMap = {};
  allStores.forEach(s => {
    storeMap[String(s.id)] = s.id;
    storeMap[s.code.toUpperCase()] = s.id;
    storeMap[s.name.toUpperCase()] = s.id;
  });

  // Suppliers cache for resolving supplier by name or ID if specified per phone in excel
  const allSuppliers = db.prepare(`SELECT id, name FROM suppliers`).all();
  const supplierMap = {};
  allSuppliers.forEach(s => {
    supplierMap[String(s.id)] = s.id;
    supplierMap[s.name.trim().toUpperCase()] = s.id;
    supplierMap[s.name.trim().toUpperCase().replace(/\s+/g, '')] = s.id;
  });

  const insertSupplierStmt = db.prepare(`
    INSERT INTO suppliers (name, status) VALUES (?, 'active')
  `);

  // Fetch all existing IMEIs in memory set for ultra-fast lookup
  const existingImeisRows = db.prepare(`SELECT imei1, imei2 FROM phone_inventory`).all();
  const existingImeiSet = new Set();
  existingImeisRows.forEach(row => {
    if (row.imei1) existingImeiSet.add(row.imei1.trim().toUpperCase());
    if (row.imei2) existingImeiSet.add(row.imei2.trim().toUpperCase());
  });

  const importedDevices = [];
  const failedRows = [];
  const seenInBatch = new Set();

  let nextSeq = getNextPhoneSeq(db);

  const insertStmt = db.prepare(`
    INSERT INTO phone_inventory (
      internal_product_id, brand, model, variant, ram, storage, color,
      imei1, imei2, serial_number, condition_grade, battery_health,
      purchase_price, refurbishment_cost, additional_cost, total_cost,
      selling_price, discount, tax_rate, final_selling_price,
      supplier_id, purchase_date, warranty_period_months,
      current_store_id, stock_status, date_added, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', DATE('now'), ?)
  `);

  try {
    const executeBulk = db.transaction(() => {
      devices.forEach((dev, idx) => {
        const rowNum = idx + 1;
        const brand = dev.brand ? String(dev.brand).trim() : '';
        const model = dev.model ? String(dev.model).trim() : '';
        const rawImei1 = dev.imei1 ? String(dev.imei1).replace(/\s/g, '').trim() : '';
        const rawImei2 = dev.imei2 ? String(dev.imei2).replace(/\s/g, '').trim() : '';
        const sellingPrice = parseFloat(dev.selling_price || dev.price);

        if (!brand) {
          failedRows.push({ row: rowNum, imei: rawImei1 || 'N/A', reason: 'Missing required Brand' });
          return;
        }
        if (!model) {
          failedRows.push({ row: rowNum, imei: rawImei1 || 'N/A', reason: 'Missing required Model' });
          return;
        }
        if (!rawImei1 || !/^\d{15}$/.test(rawImei1)) {
          failedRows.push({ row: rowNum, imei: rawImei1 || 'N/A', reason: 'IMEI 1 must be exactly 15 numeric digits' });
          return;
        }
        if (isNaN(sellingPrice) || sellingPrice <= 0) {
          failedRows.push({ row: rowNum, imei: rawImei1, reason: 'Invalid or missing Selling Price' });
          return;
        }

        const imei1Upper = rawImei1.toUpperCase();
        if (seenInBatch.has(imei1Upper)) {
          failedRows.push({ row: rowNum, imei: rawImei1, reason: 'Duplicate IMEI 1 in this uploaded file' });
          return;
        }
        if (existingImeiSet.has(imei1Upper)) {
          failedRows.push({ row: rowNum, imei: rawImei1, reason: `IMEI 1 already exists in inventory database` });
          return;
        }

        if (rawImei2) {
          if (!/^\d{15}$/.test(rawImei2)) {
            failedRows.push({ row: rowNum, imei: rawImei2, reason: `Secondary IMEI 2 (${rawImei2}) must be exactly 15 numeric digits` });
            return;
          }
          const imei2Upper = rawImei2.toUpperCase();
          if (seenInBatch.has(imei2Upper) || existingImeiSet.has(imei2Upper)) {
            failedRows.push({ row: rowNum, imei: rawImei2, reason: `Secondary IMEI 2 (${rawImei2}) already exists` });
            return;
          }
          seenInBatch.add(imei2Upper);
        }

        seenInBatch.add(imei1Upper);
        existingImeiSet.add(imei1Upper);

        // Resolve store
        let targetStoreId = fallbackStoreId;
        if (dev.store_id) {
          targetStoreId = parseInt(dev.store_id);
        } else if (dev.store_code && storeMap[String(dev.store_code).toUpperCase()]) {
          targetStoreId = storeMap[String(dev.store_code).toUpperCase()];
        } else if (dev.store_name && storeMap[String(dev.store_name).toUpperCase()]) {
          targetStoreId = storeMap[String(dev.store_name).toUpperCase()];
        }

        // Resolve supplier per phone row
        let targetSupplierId = default_supplier_id ? parseInt(default_supplier_id) : null;
        const rawSupplier = dev.supplier_name || dev.supplier_info || dev.supplier || dev.supplier_id || '';

        if (rawSupplier) {
          const supStr = String(rawSupplier).trim();
          const supUpper = supStr.toUpperCase();
          const supClean = supUpper.replace(/\s+/g, '');

          if (supplierMap[supStr]) {
            targetSupplierId = supplierMap[supStr];
          } else if (supplierMap[supUpper]) {
            targetSupplierId = supplierMap[supUpper];
          } else if (supplierMap[supClean]) {
            targetSupplierId = supplierMap[supClean];
          } else if (supStr.length > 1) {
            // Auto-register new supplier if provided in the Excel sheet
            try {
              const newSupInfo = insertSupplierStmt.run(supStr);
              targetSupplierId = newSupInfo.lastInsertRowid;
              supplierMap[String(targetSupplierId)] = targetSupplierId;
              supplierMap[supUpper] = targetSupplierId;
              supplierMap[supClean] = targetSupplierId;
            } catch (e) {
              // Retain fallback if failed
            }
          }
        }

        const pCost = Math.max(0, parseFloat(dev.purchase_price || dev.cost || 0));
        const rCost = Math.max(0, parseFloat(dev.refurbishment_cost || 0));
        const aCost = Math.max(0, parseFloat(dev.additional_cost || 0));
        const totalCost = pCost + rCost + aCost;

        const disc = Math.max(0, parseFloat(dev.discount || 0));
        const tRate = (dev.tax_rate !== undefined && dev.tax_rate !== null && !isNaN(parseFloat(dev.tax_rate)))
          ? parseFloat(dev.tax_rate)
          : systemTaxRate;
        const difference = Math.max(0, sellingPrice - pCost);
        const taxAmount = Math.round((difference * (tRate / 100)) * 100) / 100;
        const finalPrice = Math.max(0, (sellingPrice + taxAmount) - disc);
        let internalId = `ECO-PH-${String(nextSeq++).padStart(5, '0')}`;
        while (db.prepare(`SELECT 1 FROM phone_inventory WHERE internal_product_id = ?`).get(internalId)) {
          internalId = `ECO-PH-${String(nextSeq++).padStart(5, '0')}`;
        }
        const conditionGrade = dev.condition_grade || dev.grade || 'Grade A';
        const batteryHealth = dev.battery_health ? String(dev.battery_health).trim() : '90%';
        const variant = dev.variant || dev.storage || '';
        const ram = dev.ram || '';
        const storage = dev.storage || dev.variant || '';
        const color = dev.color || 'Standard';
        const serial = dev.serial_number || dev.serial || '';
        const warranty = parseInt(dev.warranty_period_months || dev.warranty || 6);
        const notes = dev.notes || 'Bulk Excel Ingestion';

        const info = insertStmt.run(
          internalId, brand, model, variant, ram, storage, color,
          rawImei1, rawImei2 || null, serial, conditionGrade, batteryHealth,
          pCost, rCost, aCost, totalCost,
          sellingPrice, disc, tRate, finalPrice,
          targetSupplierId,
          dev.purchase_date || default_purchase_date || null,
          warranty,
          targetStoreId,
          notes
        );

        importedDevices.push({
          id: info.lastInsertRowid,
          internal_product_id: internalId,
          brand,
          model,
          imei1: rawImei1,
          selling_price: sellingPrice,
          supplier_id: targetSupplierId
        });
      });
    });

    executeBulk();

    if (importedDevices.length > 0) {
      logAudit(
        req.user.id,
        req.user.username,
        'BULK_STOCK_UPLOAD',
        fallbackStoreId,
        'INVENTORY',
        importedDevices[0].id,
        {
          totalProcessed: devices.length,
          importedCount: importedDevices.length,
          failedCount: failedRows.length
        },
        req
      );
    }

    res.json({
      success: true,
      message: `Successfully imported ${importedDevices.length} device(s) into inventory!${failedRows.length > 0 ? ` (${failedRows.length} skipped due to duplicates or validation errors)` : ''}`,
      importedCount: importedDevices.length,
      failedCount: failedRows.length,
      totalProcessed: devices.length,
      failedRows
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/inventory/meta (Brands, models, grades, suppliers)
router.get('/meta/catalog', authenticateToken, (req, res) => {
  const brands = db.prepare(`SELECT * FROM brands ORDER BY name ASC`).all();
  const models = db.prepare(`SELECT m.*, b.name as brand_name FROM phone_models m JOIN brands b ON m.brand_id = b.id ORDER BY m.name ASC`).all();
  const grades = db.prepare(`SELECT * FROM grades ORDER BY id ASC`).all();
  const suppliers = db.prepare(`SELECT id, name, contact_person, phone, city FROM suppliers WHERE status = 'active'`).all();
  const stores = db.prepare(`SELECT id, name, code, city FROM stores WHERE status = 'active'`).all();

  res.json({ success: true, brands, models, grades, suppliers, stores });
});

// PUT /api/inventory/:id (Update Phone Details)
router.put('/:id', authenticateToken, (req, res) => {
  const phoneId = parseInt(req.params.id);
  const existing = db.prepare(`SELECT * FROM phone_inventory WHERE id = ?`).get(phoneId);
  if (!existing) {
    return res.status(404).json({ success: false, message: 'Device not found.' });
  }

  // Employee restricted to their store
  if (req.user.role !== 'admin' && existing.current_store_id !== req.user.assigned_store_id) {
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
  if (!/^\d{15}$/.test(cleanImei1)) {
    return res.status(400).json({ success: false, message: 'IMEI 1 must be exactly 15 numeric digits.' });
  }

  const cleanImei2 = imei2 && String(imei2).trim() ? String(imei2).trim() : null;
  if (cleanImei2 && !/^\d{15}$/.test(cleanImei2)) {
    return res.status(400).json({ success: false, message: 'Secondary IMEI 2 must be exactly 15 numeric digits.' });
  }

  // Check IMEI Uniqueness excluding this phone
  const dupImei1 = db.prepare(`
    SELECT id, imei1, stock_status FROM phone_inventory 
    WHERE (imei1 = ? OR (imei2 IS NOT NULL AND imei2 = ?)) AND id != ?
  `).get(cleanImei1, cleanImei1, phoneId);

  if (dupImei1) {
    return res.status(400).json({ success: false, message: `IMEI ${cleanImei1} is already registered on another device (ID #${dupImei1.id}, Status: ${dupImei1.stock_status}).` });
  }

  if (cleanImei2) {
    const dupImei2 = db.prepare(`
      SELECT id, imei1 FROM phone_inventory 
      WHERE (imei1 = ? OR imei2 = ?) AND id != ?
    `).get(cleanImei2, cleanImei2, phoneId);
    if (dupImei2) {
      return res.status(400).json({ success: false, message: `Secondary IMEI ${cleanImei2} is already registered on another device.` });
    }
  }

  const pCost = parseFloat(purchase_price !== undefined ? purchase_price : existing.purchase_price);
  const rCost = parseFloat(refurbishment_cost !== undefined ? refurbishment_cost : existing.refurbishment_cost);
  const aCost = parseFloat(additional_cost !== undefined ? additional_cost : existing.additional_cost);
  const totalCost = pCost + rCost + aCost;

  const sPrice = parseFloat(selling_price !== undefined ? selling_price : existing.selling_price);
  const disc = parseFloat(discount !== undefined ? discount : existing.discount);
  const defaultTaxRow = db.prepare(`SELECT value FROM settings WHERE key = 'default_tax_rate'`).get();
  const fallbackTaxRate = defaultTaxRow && !isNaN(parseFloat(defaultTaxRow.value)) ? parseFloat(defaultTaxRow.value) : 5.0;
  const tRate = (tax_rate !== undefined && tax_rate !== null && !isNaN(parseFloat(tax_rate))) ? parseFloat(tax_rate) : fallbackTaxRate;
  const difference = Math.max(0, sPrice - pCost);
  const taxAmount = Math.round((difference * (tRate / 100)) * 100) / 100;
  const finalPrice = Math.max(0, (sPrice + taxAmount) - disc);

  const targetStoreId = (req.user.role === 'admin' && current_store_id) ? parseInt(current_store_id) : (existing.current_store_id || req.user.assigned_store_id);
  const updatedStatus = stock_status || existing.stock_status || 'AVAILABLE';

  try {
    db.prepare(`
      UPDATE phone_inventory SET
        brand = ?, model = ?, variant = ?, ram = ?, storage = ?, color = ?,
        imei1 = ?, imei2 = ?, serial_number = ?, condition_grade = ?, battery_health = ?,
        purchase_price = ?, refurbishment_cost = ?, additional_cost = ?, total_cost = ?,
        selling_price = ?, discount = ?, tax_rate = ?, final_selling_price = ?,
        supplier_id = ?, purchase_date = ?, warranty_period_months = ?,
        current_store_id = ?, stock_status = ?, notes = ?
      WHERE id = ?
    `).run(
      brand.trim(), model.trim(), variant || '', ram || '', storage || '', color || '',
      imei1.trim(), imei2 ? imei2.trim() : null, serial_number || '', condition_grade || 'Grade A', battery_health || '90%',
      pCost, rCost, aCost, totalCost,
      sPrice, disc, tRate, finalPrice,
      supplier_id ? parseInt(supplier_id) : null, purchase_date || null, parseInt(warranty_period_months || 6),
      targetStoreId, updatedStatus, notes || '',
      phoneId
    );

    logAudit(req.user.id, req.user.username, 'UPDATE_INVENTORY', targetStoreId, 'PHONE', phoneId, { imei: imei1, brand, model, totalCost, selling_price: sPrice, stock_status: updatedStatus }, req);

    res.json({ success: true, message: 'Stock data updated successfully.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/inventory/:id (Delete stock item)
router.delete('/:id', authenticateToken, (req, res) => {
  const phoneId = parseInt(req.params.id);
  const phone = db.prepare(`SELECT * FROM phone_inventory WHERE id = ?`).get(phoneId);
  if (!phone) {
    return res.status(404).json({ success: false, message: 'Device not found.' });
  }

  // Employee restricted to their store
  if (req.user.role !== 'admin' && phone.current_store_id !== req.user.assigned_store_id) {
    return res.status(403).json({ success: false, message: 'Access denied to delete inventory in other stores.' });
  }

  // Rule: Cannot delete phone if linked to a completed sale/invoice
  const saleItem = db.prepare(`SELECT sale_id FROM sale_items WHERE phone_id = ? LIMIT 1`).get(phoneId);
  if (saleItem) {
    return res.status(400).json({
      success: false,
      message: `Cannot delete device because it is linked to an existing Tax Invoice (Sale #${saleItem.sale_id}). You can change its status or void the invoice instead.`
    });
  }

  // Rule: Check if linked to active transfer
  const activeTransfer = db.prepare(`
    SELECT t.status FROM stock_transfer_items ti
    JOIN stock_transfers t ON ti.transfer_id = t.id
    WHERE ti.phone_id = ? AND t.status = 'PENDING'
    LIMIT 1
  `).get(phoneId);

  if (activeTransfer) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete device while it has a pending stock transfer. Please complete or cancel the transfer first.'
    });
  }

  try {
    db.prepare(`DELETE FROM warranties WHERE phone_id = ?`).run(phoneId);
    db.prepare(`DELETE FROM stock_transfer_items WHERE phone_id = ?`).run(phoneId);
    db.prepare(`DELETE FROM return_items WHERE phone_id = ?`).run(phoneId);
    db.prepare(`DELETE FROM phone_inventory WHERE id = ?`).run(phoneId);

    logAudit(req.user.id, req.user.username, 'DELETE_INVENTORY', phone.current_store_id, 'PHONE', phoneId, { imei: phone.imei1, brand: phone.brand, model: phone.model }, req);

    res.json({ success: true, message: `Device ${phone.brand} ${phone.model} (IMEI: ${phone.imei1}) deleted successfully.` });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
