const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { authenticateToken, requireAdmin, requireSuperAdmin, requireDeletePermission, logAudit } = require('../middleware/auth');
const { calculateInclusiveGst, calculateAccessoryPurchaseBatch } = require('../utils/tax');

// Helper to generate next unique sequential accessory ID
async function getNextAccessoryId() {
  const last = await prisma.accessory.findFirst({
    orderBy: { id: 'desc' },
    select: { accessoryId: true }
  });
  
  let nextSeq = 1;
  if (last && last.accessoryId) {
    const parts = last.accessoryId.split('-');
    if (parts.length === 2) {
      const parsed = parseInt(parts[1], 10);
      if (!isNaN(parsed)) nextSeq = parsed + 1;
    }
  }
  return `ACC-${String(nextSeq).padStart(5, '0')}`;
}

// GET /api/accessories (List accessories with filters)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { store_id, category, status, search, page = 1, limit = 50 } = req.query;

    const whereClause = {};

    if (!['admin', 'super_admin'].includes(req.user.role)) {
      whereClause.storeId = req.user.assigned_store_id;
    } else if (store_id) {
      whereClause.storeId = parseInt(store_id);
    }

    if (category) whereClause.category = category;
    if (status) whereClause.status = status;

    if (search) {
      const st = search.trim();
      whereClause.OR = [
        { name: { contains: st } },
        { sku: { contains: st } },
        { barcode: { contains: st } },
        { brand: { contains: st } },
        { variant: { contains: st } }
      ];
    }

    const total = await prisma.accessory.count({ where: whereClause });
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const accessories = await prisma.accessory.findMany({
      where: whereClause,
      include: { store: true, supplier: true },
      orderBy: { id: 'desc' },
      skip: offset,
      take: parseInt(limit)
    });

    const mappedAccessories = accessories.map(a => ({
      id: a.id, accessory_id: a.accessoryId, sku: a.sku, barcode: a.barcode,
      name: a.name, category: a.category, brand: a.brand, variant: a.variant,
      description: a.description, supplier_id: a.supplierId, supplier_name: a.supplierName,
      purchase_price_inclusive: a.purchasePriceInclusive, purchase_taxable_value: a.purchaseTaxableValue,
      purchase_gst: a.purchaseGst, mrp_inclusive: a.mrpInclusive, selling_price_inclusive: a.sellingPriceInclusive,
      selling_taxable_value: a.sellingTaxableValue, selling_gst: a.sellingGst, gst_rate: a.gstRate,
      price_includes_gst: a.priceIncludesGst, quantity: a.quantity, minimum_stock: a.minimumStock,
      reorder_level: a.reorderLevel, store_id: a.storeId, warranty_period: a.warrantyPeriod,
      status: a.status, created_at: a.createdAt, updated_at: a.updatedAt,
      store_name: a.store?.name, store_code: a.store?.code, store_city: a.store?.city,
      db_supplier_name: a.supplier?.name
    }));

    const categoriesRaw = await prisma.accessory.findMany({
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' }
    });
    const categories = categoriesRaw.map(c => c.category);

    res.json({
      success: true, accessories: mappedAccessories, categories,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    console.error('Error fetching accessories:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/accessories/categories
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    const categoriesRaw = await prisma.accessory.findMany({
      where: { category: { not: '' } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' }
    });
    res.json({ success: true, categories: categoriesRaw.filter(c => c.category).map(c => c.category) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/accessories/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const a = await prisma.accessory.findUnique({
      where: { id },
      include: { store: true, supplier: true }
    });
    if (!a) return res.status(404).json({ success: false, message: 'Accessory not found' });

    const purchasesRaw = await prisma.accessoryPurchase.findMany({
      where: { accessoryId: id },
      include: { store: true },
      orderBy: { id: 'desc' },
      take: 10
    });

    const mappedAccessory = {
      id: a.id, accessory_id: a.accessoryId, sku: a.sku, barcode: a.barcode,
      name: a.name, category: a.category, brand: a.brand, variant: a.variant,
      description: a.description, supplier_id: a.supplierId, supplier_name: a.supplierName,
      purchase_price_inclusive: a.purchasePriceInclusive, purchase_taxable_value: a.purchaseTaxableValue,
      purchase_gst: a.purchaseGst, mrp_inclusive: a.mrpInclusive, selling_price_inclusive: a.sellingPriceInclusive,
      selling_taxable_value: a.sellingTaxableValue, selling_gst: a.sellingGst, gst_rate: a.gstRate,
      price_includes_gst: a.priceIncludesGst, quantity: a.quantity, minimum_stock: a.minimumStock,
      reorder_level: a.reorderLevel, store_id: a.storeId, warranty_period: a.warrantyPeriod,
      status: a.status, created_at: a.createdAt, updated_at: a.updatedAt,
      store_name: a.store?.name, store_code: a.store?.code, store_city: a.store?.city,
      db_supplier_name: a.supplier?.name
    };

    const purchases = purchasesRaw.map(p => ({
      id: p.id, purchase_order_no: p.purchaseOrderNo, supplier_id: p.supplierId,
      supplier_name: p.supplierName, accessory_id: p.accessoryId, quantity: p.quantity,
      purchase_price_inclusive: p.purchasePriceInclusive, taxable_value_per_unit: p.taxableValuePerUnit,
      gst_per_unit: p.gstPerUnit, total_purchase_value: p.totalPurchaseValue,
      total_taxable_value: p.totalTaxableValue, total_gst: p.totalGst,
      purchase_date: p.purchaseDate, store_id: p.storeId, store_name: p.store?.name
    }));

    res.json({ success: true, accessory: mappedAccessory, purchases });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// POST /api/accessories
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      name, category, brand, variant, description, sku, barcode,
      supplier_id, supplier_name, purchase_price_inclusive, mrp_inclusive,
      selling_price_inclusive, quantity = 0, minimum_stock = 5,
      reorder_level = 10, store_id, warranty_period = '6 Months'
    } = req.body;

    if (!name || !category || !brand) return res.status(400).json({ success: false, message: 'Product Name, Category, and Brand are required.' });

    const targetStoreId = ['admin', 'super_admin'].includes(req.user.role) ? (store_id || req.user.assigned_store_id) : req.user.assigned_store_id;
    if (!targetStoreId) return res.status(400).json({ success: false, message: 'Target store is required.' });

    const pInclusive = Math.max(0, parseFloat(purchase_price_inclusive) || 0);
    const sInclusive = Math.max(0, parseFloat(selling_price_inclusive) || 0);
    const mInclusive = Math.max(sInclusive, parseFloat(mrp_inclusive) || sInclusive);

    const pCalc = calculateInclusiveGst(pInclusive, 18.0);
    const sCalc = calculateInclusiveGst(sInclusive, 18.0);

    const accessoryId = await getNextAccessoryId();
    const generatedSku = sku && sku.trim() ? sku.trim().toUpperCase() : `SKU-${category.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`;
    const cleanBarcode = barcode && barcode.trim() ? barcode.trim() : null;

    const existingSku = await prisma.accessory.findFirst({ where: { sku: generatedSku } });
    if (existingSku) return res.status(400).json({ success: false, message: `An accessory with SKU "${generatedSku}" already exists.` });

    const qty = Math.max(0, parseInt(quantity, 10) || 0);
    let status = 'In Stock';
    if (qty === 0) status = 'Out of Stock';
    else if (qty <= (parseInt(minimum_stock, 10) || 5)) status = 'Low Stock';

    let targetSupplierId = null;
    if (supplier_id) {
      const validSup = await prisma.supplier.findUnique({ where: { id: parseInt(supplier_id) } });
      if (validSup) targetSupplierId = validSup.id;
    }

    const result = await prisma.$transaction(async (tx) => {
      const newAcc = await tx.accessory.create({
        data: {
          accessoryId, sku: generatedSku, barcode: cleanBarcode, name: name.trim(),
          category: category.trim(), brand: brand.trim(), variant: variant ? variant.trim() : null,
          description: description ? description.trim() : null, supplierId: targetSupplierId,
          supplierName: supplier_name || null, purchasePriceInclusive: pCalc.inclusivePrice,
          purchaseTaxableValue: pCalc.taxableValue, purchaseGst: pCalc.gstAmount, mrpInclusive: mInclusive,
          sellingPriceInclusive: sCalc.inclusivePrice, sellingTaxableValue: sCalc.taxableValue,
          sellingGst: sCalc.gstAmount, gstRate: 18.0, priceIncludesGst: 1, quantity: qty,
          minimumStock: parseInt(minimum_stock, 10) || 5, reorderLevel: parseInt(reorder_level, 10) || 10,
          storeId: parseInt(targetStoreId), warrantyPeriod: warranty_period, status
        }
      });

      if (qty > 0 && pInclusive > 0) {
        const batch = calculateAccessoryPurchaseBatch(qty, pInclusive, 18.0);
        await tx.accessoryPurchase.create({
          data: {
            purchaseOrderNo: `PO-INIT-${Date.now().toString().slice(-6)}`, supplierId: targetSupplierId,
            supplierName: supplier_name || 'Initial Stock Entry', accessoryId: newAcc.id, quantity: qty,
            purchasePriceInclusive: batch.unit_purchase_price_inclusive, taxableValuePerUnit: batch.unit_taxable_value,
            gstPerUnit: batch.unit_gst, totalPurchaseValue: batch.total_purchase_value, totalTaxableValue: batch.total_taxable_value,
            totalGst: batch.total_gst, storeId: parseInt(targetStoreId)
          }
        });
      }
      return newAcc;
    });

    await logAudit(req.user.id, req.user.username, 'CREATE_ACCESSORY', targetStoreId, 'accessories', String(result.id), `Created accessory ${result.name} (${result.sku}) - Price: ₹${result.sellingPriceInclusive} (18% GST Included)`, req.ip);

    res.status(201).json({ success: true, message: 'Accessory added successfully (18% GST Inclusive)', accessory: result });
  } catch (error) {
    console.error('Error creating accessory:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// POST /api/accessories/bulk-upload
router.post('/bulk-upload', authenticateToken, async (req, res) => {
  try {
    const { accessories: items, default_store_id, default_supplier_name } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ success: false, message: 'No accessory records provided in upload.' });

    const fallbackStoreId = (['admin', 'super_admin'].includes(req.user.role) && default_store_id) ? parseInt(default_store_id, 10) : (req.user.assigned_store_id || 1);

    const allStores = await prisma.store.findMany({ select: { id: true, code: true, name: true } });
    const storeMap = {};
    allStores.forEach(s => {
      storeMap[String(s.id)] = s.id;
      if (s.code) storeMap[s.code.toUpperCase()] = s.id;
      if (s.name) storeMap[s.name.toUpperCase()] = s.id;
    });

    const existingRows = await prisma.accessory.findMany({ select: { sku: true, barcode: true } });
    const existingSkuSet = new Set();
    existingRows.forEach(r => { if (r.sku) existingSkuSet.add(r.sku.trim().toUpperCase()); });

    const importedAccessories = [];
    const failedRows = [];

    const lastAccessory = await prisma.accessory.findFirst({
      orderBy: { id: 'desc' },
      select: { accessoryId: true }
    });
    
    let nextSeq = 1;
    if (lastAccessory && lastAccessory.accessoryId) {
      const parts = lastAccessory.accessoryId.split('-');
      if (parts.length === 2) {
        const parsed = parseInt(parts[1], 10);
        if (!isNaN(parsed)) nextSeq = parsed + 1;
      }
    }

    await prisma.$transaction(async (tx) => {
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const rowNum = idx + 1;
        const name = item.name ? String(item.name).trim() : '';
        const category = item.category ? String(item.category).trim() : 'Other Accessories';
        const brand = item.brand ? String(item.brand).trim() : 'Generic';
        const variant = item.variant ? String(item.variant).trim() : '';
        const description = item.description ? String(item.description).trim() : '';

        if (!name) { failedRows.push({ row: rowNum, item: name || `Row ${rowNum}`, error: 'Missing product name' }); continue; }

        const parsePrice = (v) => {
          if (v === null || v === undefined || v === '') return 0;
          if (typeof v === 'number') return isNaN(v) ? 0 : v;
          let str = String(v).trim().replace(/^(₹|rs\\.?|inr|\\$)\\s*/i, '').replace(/,/g, '');
          const m = str.match(/-?\\d+(\\.\\d+)?/);
          return m ? parseFloat(m[0]) : 0;
        };

        const pInclusive = Math.max(0, parsePrice(item.purchase_price_inclusive ?? item.purchase_price ?? item.cost));
        const sInclusive = Math.max(0, parsePrice(item.selling_price_inclusive ?? item.selling_price ?? item.price));
        const mInclusive = Math.max(sInclusive, parsePrice(item.mrp_inclusive ?? item.mrp) || sInclusive);

        if (sInclusive <= 0) { failedRows.push({ row: rowNum, item: name, error: 'Selling price must be greater than ₹0' }); continue; }

        const pCalc = calculateInclusiveGst(pInclusive, 18.0);
        const sCalc = calculateInclusiveGst(sInclusive, 18.0);

        let storeId = fallbackStoreId;
        if (item.store_code) { const matched = storeMap[String(item.store_code).trim().toUpperCase()]; if (matched) storeId = matched; }
        else if (item.store_id) { const matched = storeMap[String(item.store_id).trim()]; if (matched) storeId = matched; }

        const supplierName = item.supplier_name || item.supplier || default_supplier_name || 'Direct Wholesale';

        let finalSku = item.sku ? String(item.sku).trim().toUpperCase() : '';
        if (!finalSku) {
          const brandCode = brand.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'ECO';
          const catCode = category.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'ACC';
          finalSku = `${brandCode}-${catCode}-${String(nextSeq).padStart(4, '0')}`;
        }

        let skuCandidate = finalSku;
        let counter = 1;
        while (existingSkuSet.has(skuCandidate)) { skuCandidate = `${finalSku}-${counter}`; counter++; }
        finalSku = skuCandidate;
        existingSkuSet.add(finalSku);

        const barcode = item.barcode ? String(item.barcode).trim() : null;
        const accessoryId = `ACC-${String(nextSeq).padStart(5, '0')}`;
        nextSeq++;

        const qty = Math.max(0, parseInt(item.quantity, 10) || 10);
        const minStock = Math.max(1, parseInt(item.minimum_stock, 10) || 5);
        const reorderLevel = Math.max(minStock, parseInt(item.reorder_level, 10) || 10);
        const warranty = item.warranty_period ? String(item.warranty_period).trim() : '6 Months Brand Warranty';

        let status = 'In Stock';
        if (qty === 0) status = 'Out of Stock';
        else if (qty <= minStock) status = 'Low Stock';

        const insertRes = await tx.accessory.create({
          data: {
            accessoryId, sku: finalSku, barcode, name, category, brand, variant, description,
            supplierId: null, supplierName: supplierName,
            purchasePriceInclusive: pCalc.inclusivePrice, purchaseTaxableValue: pCalc.taxableValue, purchaseGst: pCalc.gstAmount,
            mrpInclusive: mInclusive, sellingPriceInclusive: sCalc.inclusivePrice, sellingTaxableValue: sCalc.taxableValue,
            sellingGst: sCalc.gstAmount, gstRate: 18.0, priceIncludesGst: 1, quantity: qty,
            minimumStock: minStock, reorderLevel: reorderLevel, storeId: storeId, warrantyPeriod: warranty, status
          }
        });

        if (qty > 0 && pInclusive > 0) {
          const batch = calculateAccessoryPurchaseBatch(qty, pInclusive, 18.0);
          await tx.accessoryPurchase.create({
            data: {
              purchaseOrderNo: `PO-BULK-${Date.now().toString().slice(-6)}-${idx + 1}`, supplierId: null,
              supplierName: supplierName, accessoryId: insertRes.id, quantity: qty,
              purchasePriceInclusive: batch.unit_purchase_price_inclusive, taxableValuePerUnit: batch.unit_taxable_value,
              gstPerUnit: batch.unit_gst, totalPurchaseValue: batch.total_purchase_value, totalTaxableValue: batch.total_taxable_value,
              totalGst: batch.total_gst, storeId: storeId
            }
          });
        }

        importedAccessories.push({ id: insertRes.id, accessory_id: accessoryId, sku: finalSku, name, category, brand, selling_price_inclusive: sCalc.inclusivePrice, quantity: qty, store_id: storeId });
      }
    }, {
      maxWait: 15000,
      timeout: 60000
    });

    await logAudit(req.user.id, req.user.username, 'BULK_UPLOAD_ACCESSORIES', fallbackStoreId, 'accessories', null, `Bulk uploaded ${importedAccessories.length} accessories (${failedRows.length} failed). All 18% GST-inclusive.`, req.ip);

    res.json({ success: true, message: `Successfully imported ${importedAccessories.length} accessories.`, importedCount: importedAccessories.length, failedCount: failedRows.length, imported: importedAccessories, failed: failedRows });
  } catch (error) {
    console.error('Bulk upload transaction failed:', error);
    res.status(500).json({ success: false, message: 'Database transaction error during bulk upload: ' + error.message });
  }
});

// PUT /api/accessories/:id
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.accessory.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Accessory not found' });

    if (!['admin', 'super_admin'].includes(req.user.role) && req.user.assigned_store_id !== existing.storeId) {
      return res.status(403).json({ success: false, message: 'You can only edit accessories in your assigned store.' });
    }

    const {
      name, category, brand, variant, description, barcode, supplier_id, supplier_name,
      purchase_price_inclusive, mrp_inclusive, selling_price_inclusive, quantity,
      minimum_stock, reorder_level, store_id, warranty_period
    } = req.body;

    const pInclusive = purchase_price_inclusive !== undefined ? Math.max(0, parseFloat(purchase_price_inclusive) || 0) : existing.purchasePriceInclusive;
    const sInclusive = selling_price_inclusive !== undefined ? Math.max(0, parseFloat(selling_price_inclusive) || 0) : existing.sellingPriceInclusive;
    const mInclusive = mrp_inclusive !== undefined ? Math.max(sInclusive, parseFloat(mrp_inclusive) || sInclusive) : existing.mrpInclusive;

    const pCalc = calculateInclusiveGst(pInclusive, 18.0);
    const sCalc = calculateInclusiveGst(sInclusive, 18.0);

    const newQty = quantity !== undefined ? Math.max(0, parseInt(quantity, 10) || 0) : existing.quantity;
    const minStock = minimum_stock !== undefined ? Math.max(1, parseInt(minimum_stock, 10) || 5) : existing.minimumStock;
    const reorder = reorder_level !== undefined ? Math.max(minStock, parseInt(reorder_level, 10) || 10) : existing.reorderLevel;

    let newStatus = 'In Stock';
    if (newQty === 0) newStatus = 'Out of Stock';
    else if (newQty <= minStock) newStatus = 'Low Stock';

    let targetStoreId = existing.storeId;
    if (['admin', 'super_admin'].includes(req.user.role) && store_id) {
      const validStore = await prisma.store.findUnique({ where: { id: parseInt(store_id) } });
      if (validStore) targetStoreId = validStore.id;
    }

    let targetSupplierId = null;
    if (supplier_id) {
      const validSup = await prisma.supplier.findUnique({ where: { id: parseInt(supplier_id) } });
      if (validSup) targetSupplierId = validSup.id;
    } else if (existing.supplierId) {
      targetSupplierId = existing.supplierId;
    }

    const updated = await prisma.accessory.update({
      where: { id },
      data: {
        name: name ? name.trim() : existing.name,
        category: category ? category.trim() : existing.category,
        brand: brand ? brand.trim() : existing.brand,
        variant: variant !== undefined ? variant : existing.variant,
        description: description !== undefined ? description : existing.description,
        barcode: barcode !== undefined ? barcode : existing.barcode,
        supplierId: targetSupplierId,
        supplierName: supplier_name !== undefined ? supplier_name : existing.supplierName,
        purchasePriceInclusive: pCalc.inclusivePrice,
        purchaseTaxableValue: pCalc.taxableValue,
        purchaseGst: pCalc.gstAmount,
        mrpInclusive: mInclusive,
        sellingPriceInclusive: sCalc.inclusivePrice,
        sellingTaxableValue: sCalc.taxableValue,
        sellingGst: sCalc.gstAmount,
        quantity: newQty,
        minimumStock: minStock,
        reorderLevel: reorder,
        storeId: targetStoreId,
        warrantyPeriod: warranty_period !== undefined ? warranty_period : existing.warrantyPeriod,
        status: newStatus
      }
    });

    await logAudit(req.user.id, req.user.username, 'UPDATE_ACCESSORY', updated.storeId, 'accessories', String(existing.id), `Updated accessory ${updated.name} (${updated.sku}) - Qty: ${updated.quantity}`, req.ip);

    res.json({ success: true, message: 'Accessory updated successfully', accessory: updated });
  } catch (error) {
    console.error('Error updating accessory:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// DELETE /api/accessories/:id
router.delete('/:id', authenticateToken, requireDeletePermission('accessories'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.accessory.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Accessory not found' });

    const soldCount = await prisma.saleItem.count({ where: { accessoryId: existing.id } });
    if (soldCount > 0 && req.user.role !== 'super_admin' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: `Permission Denied: ${soldCount} unit(s) of this accessory have already been sold in tax invoices. Only the Master Super Admin with 2FA authorization can delete sold items.`
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.saleItem.deleteMany({ where: { accessoryId: existing.id } });
      await tx.accessoryPurchase.deleteMany({ where: { accessoryId: existing.id } });
      await tx.accessory.delete({ where: { id: existing.id } });
    });

    await logAudit(req.user.id, req.user.username, 'DELETE_ACCESSORY', existing.storeId, 'accessories', String(existing.id), `Deleted accessory ${existing.name} (${existing.sku})`, req.ip);

    res.json({ success: true, message: 'Accessory deleted permanently' });
  } catch (error) {
    console.error('Error deleting accessory:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
  }
});

// POST /api/accessories/purchase
router.post('/purchase', authenticateToken, async (req, res) => {
  try {
    const { accessory_id, quantity, purchase_price_inclusive, purchase_order_no, supplier_id, supplier_name, notes } = req.body;
    if (!accessory_id) return res.status(400).json({ success: false, message: 'Accessory ID is required.' });

    const accessory = await prisma.accessory.findUnique({ where: { id: parseInt(accessory_id) } });
    if (!accessory) return res.status(404).json({ success: false, message: 'Accessory not found.' });

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) return res.status(400).json({ success: false, message: 'Purchase quantity must be at least 1.' });

    const pInclusive = purchase_price_inclusive !== undefined ? Math.max(0, parseFloat(purchase_price_inclusive) || 0) : accessory.purchasePriceInclusive;
    const batch = calculateAccessoryPurchaseBatch(qty, pInclusive, 18.0);
    const poNumber = purchase_order_no && purchase_order_no.trim() ? purchase_order_no.trim() : `PO-ACC-${Date.now().toString().slice(-6)}`;

    const { newQty, newStatus } = await prisma.$transaction(async (tx) => {
      await tx.accessoryPurchase.create({
        data: {
          purchaseOrderNo: poNumber, supplierId: supplier_id || accessory.supplierId || null,
          supplierName: supplier_name || accessory.supplierName || 'Direct Supplier', accessoryId: accessory.id,
          quantity: batch.quantity, purchasePriceInclusive: batch.unit_purchase_price_inclusive,
          taxableValuePerUnit: batch.unit_taxable_value, gstPerUnit: batch.unit_gst,
          totalPurchaseValue: batch.total_purchase_value, totalTaxableValue: batch.total_taxable_value,
          totalGst: batch.total_gst, storeId: accessory.storeId
        }
      });

      const nextQty = accessory.quantity + batch.quantity;
      let nextStatus = 'In Stock';
      if (nextQty <= accessory.minimumStock) nextStatus = 'Low Stock';

      await tx.accessory.update({
        where: { id: accessory.id },
        data: { quantity: nextQty, status: nextStatus, purchasePriceInclusive: batch.unit_purchase_price_inclusive, purchaseTaxableValue: batch.unit_taxable_value, purchaseGst: batch.unit_gst }
      });

      return { newQty: nextQty, newStatus: nextStatus };
    });

    await logAudit(req.user.id, req.user.username, 'RESTOCK_ACCESSORY', accessory.storeId, 'accessories', String(accessory.id), `Restocked ${qty} units of ${accessory.name} at ₹${pInclusive} (Incl. GST) each. Total Value: ₹${batch.total_purchase_value} (Taxable: ₹${batch.total_taxable_value}, GST: ₹${batch.total_gst})`, req.ip);

    res.status(201).json({
      success: true, message: `Restocked ${qty} units successfully. New stock: ${newQty}`,
      batchSummary: { accessoryName: accessory.name, quantityAdded: batch.quantity, unitPurchasePriceInclusive: batch.unit_purchase_price_inclusive, unitTaxableValue: batch.unit_taxable_value, unitGst: batch.unit_gst, totalPurchaseValue: batch.total_purchase_value, totalTaxableValue: batch.total_taxable_value, totalGst: batch.total_gst, newTotalStock: newQty, status: newStatus }
    });
  } catch (error) {
    console.error('Error restocking accessory:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/accessories/reports/valuation
router.get('/reports/valuation', authenticateToken, async (req, res) => {
  try {
    const { store_id } = req.query;
    let targetStore = null;
    if (!['admin', 'super_admin'].includes(req.user.role)) targetStore = req.user.assigned_store_id;
    else if (store_id) targetStore = parseInt(store_id);

    let queryCondition = targetStore ? `AND a.store_id = ${targetStore}` : '';

    const totalsRaw = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*) as total_items,
        COALESCE(SUM(a.quantity), 0) as total_units_in_stock,
        COALESCE(SUM(a.quantity * a.purchase_price_inclusive), 0) as total_inventory_cost_inclusive,
        COALESCE(SUM(a.quantity * a.purchase_taxable_value), 0) as total_inventory_cost_taxable,
        COALESCE(SUM(a.quantity * a.purchase_gst), 0) as total_inventory_purchase_gst,
        COALESCE(SUM(a.quantity * a.selling_price_inclusive), 0) as total_retail_value_inclusive
      FROM accessories a WHERE 1=1 ${queryCondition}
    `);

    const categoryBreakdownRaw = await prisma.$queryRawUnsafe(`
      SELECT 
        a.category, COUNT(a.id) as item_count, SUM(a.quantity) as total_qty,
        SUM(a.quantity * a.purchase_price_inclusive) as cost_inclusive,
        SUM(a.quantity * a.purchase_taxable_value) as cost_taxable,
        SUM(a.quantity * a.selling_price_inclusive) as retail_value_inclusive
      FROM accessories a WHERE 1=1 ${queryCondition} GROUP BY a.category ORDER BY retail_value_inclusive DESC
    `);

    const totals = { ...totalsRaw[0] };
    for (const key in totals) if (typeof totals[key] === 'bigint') totals[key] = Number(totals[key]);

    const categoryBreakdown = categoryBreakdownRaw.map(cat => {
      const c = { ...cat };
      for (const key in c) if (typeof c[key] === 'bigint') c[key] = Number(c[key]);
      return c;
    });

    res.json({ success: true, summary: totals, categoryBreakdown });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/accessories/reports/sales
router.get('/reports/sales', authenticateToken, async (req, res) => {
  try {
    const { store_id, date_from, date_to } = req.query;
    let targetStore = null;
    if (!['admin', 'super_admin'].includes(req.user.role)) targetStore = req.user.assigned_store_id;
    else if (store_id) targetStore = parseInt(store_id);

    let queryCondition = `WHERE sa.status = 'COMPLETED' AND si.item_type = 'accessory'`;
    if (targetStore) queryCondition += ` AND sa.store_id = ${targetStore}`;
    if (date_from) queryCondition += ` AND CAST(sa.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS DATE) >= '${date_from}'`;
    if (date_to) queryCondition += ` AND CAST(sa.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS DATE) <= '${date_to}'`;

    const reportRaw = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(DISTINCT sa.id) as total_transactions, COALESCE(SUM(si.quantity), 0) as total_accessories_sold,
        COALESCE(SUM(si.final_price), 0) as total_sales_inclusive, COALESCE(SUM(si.taxable_amount), 0) as taxable_sales,
        COALESCE(SUM(si.total_tax), 0) as gst_collected, COALESCE(SUM(si.cgst), 0) as total_cgst,
        COALESCE(SUM(si.sgst), 0) as total_sgst, COALESCE(SUM(si.igst), 0) as total_igst,
        COALESCE(SUM(si.unit_cost * si.quantity), 0) as total_cogs_taxable,
        COALESCE(SUM(si.taxable_amount - (si.unit_cost * si.quantity)), 0) as gross_profit
      FROM sales sa JOIN sale_items si ON sa.id = si.sale_id ${queryCondition}
    `);

    const report = { ...reportRaw[0] };
    for (const key in report) if (typeof report[key] === 'bigint') report[key] = Number(report[key]);

    res.json({
      success: true,
      report: {
        customerAmount: { totalTransactions: report.total_transactions, totalUnitsSold: report.total_accessories_sold, totalSalesInclusive: report.total_sales_inclusive },
        accountingBreakdown: {
          taxableSales: report.taxable_sales, gstCollected: report.gst_collected, cgst: report.total_cgst, sgst: report.total_sgst, igst: report.total_igst,
          costOfGoodsTaxable: report.total_cogs_taxable, grossProfit: report.gross_profit, profitMargin: report.taxable_sales > 0 ? `${((report.gross_profit / report.taxable_sales) * 100).toFixed(1)}%` : '0%'
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
