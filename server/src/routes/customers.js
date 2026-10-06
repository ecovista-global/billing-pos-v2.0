const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { authenticateToken, requireAdmin, requireSuperAdmin, requireDeletePermission, logAudit } = require('../middleware/auth');
const { enforceStoreContext } = require('../middleware/storeContext');

// GET /api/customers
router.get('/', authenticateToken, enforceStoreContext, async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;

    const whereClause = {};

    if (!req.storeContext.isAllStores) {
      whereClause.storeId = req.storeContext.store_id;
    }

    if (search) {
      const st = search.trim();
      whereClause.OR = [
        { fullName: { contains: st } },
        { phone: { contains: st } },
        { email: { contains: st } },
        { customerCode: { contains: st } }
      ];
    }

    const total = await prisma.customer.count({ where: whereClause });

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const customers = await prisma.customer.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { sales: true }
        }
      },
      orderBy: { id: 'desc' },
      skip: offset,
      take: parseInt(limit)
    });

    const mappedCustomers = customers.map(c => ({
      id: c.id,
      customer_code: c.customerCode,
      full_name: c.fullName,
      phone: c.phone,
      email: c.email,
      address: c.address,
      city: c.city,
      state: c.state,
      pincode: c.pincode,
      gstin: c.gstin,
      id_proof_type: c.idProofType,
      id_proof_number: c.idProofNumber,
      total_purchases: c.totalPurchases,
      total_spent: c.totalSpent,
      store_id: c.storeId,
      created_at: c.createdAt,
      updated_at: c.updatedAt,
      invoice_count: c._count.sales
    }));

    res.json({
      success: true,
      customers: mappedCustomers,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/customers/:id
router.get('/:id', authenticateToken, enforceStoreContext, async (req, res) => {
  try {
    const customerId = parseInt(req.params.id);

    const whereClause = { id: customerId };
    if (!req.storeContext.isAllStores) {
      whereClause.storeId = req.storeContext.store_id;
    }

    const customer = await prisma.customer.findFirst({
      where: whereClause
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found or access denied.' });
    }

    const purchases = await prisma.sale.findMany({
      where: { customerId },
      include: { store: true },
      orderBy: { saleDate: 'desc' }
    });

    const mappedPurchases = purchases.map(sa => ({
      id: sa.id,
      invoice_number: sa.invoiceNumber,
      sale_date: sa.saleDate,
      grand_total: sa.grandTotal,
      payment_status: sa.paymentStatus,
      status: sa.status,
      store_name: sa.store?.name
    }));

    const devices = await prisma.saleItem.findMany({
      where: { sale: { customerId } },
      include: { sale: true },
      orderBy: { sale: { saleDate: 'desc' } }
    });

    const mappedDevices = devices.map(si => ({
      id: si.id,
      sale_id: si.saleId,
      phone_id: si.phoneId,
      item_type: si.itemType,
      imei1: si.imei1,
      brand: si.brand,
      model: si.model,
      variant: si.variant,
      condition_grade: si.conditionGrade,
      unit_cost: si.unitCost,
      selling_price: si.sellingPrice,
      discount: si.discount,
      taxable_amount: si.taxableAmount,
      tax_rate: si.taxRate,
      accessory_quantity: si.accessoryQuantity,
      cgst: si.cgst,
      sgst: si.sgst,
      igst: si.igst,
      total_tax: si.totalTax,
      final_price: si.finalPrice,
      is_exchange_item: si.isExchangeItem,
      warranty_period_months: si.warrantyPeriodMonths,
      warranty_expiry: si.warrantyExpiry,
      created_at: si.createdAt,
      invoice_number: si.sale?.invoiceNumber,
      sale_date: si.sale?.saleDate
    }));

    const warranties = await prisma.warranty.findMany({
      where: { customerId },
      include: { phone: true },
      orderBy: { id: 'desc' }
    });

    const mappedWarranties = warranties.map(w => ({
      id: w.id,
      phone_id: w.phoneId,
      imei1: w.imei1,
      customer_id: w.customerId,
      sale_id: w.saleId,
      invoice_number: w.invoiceNumber,
      warranty_period_months: w.warrantyPeriodMonths,
      start_date: w.startDate,
      end_date: w.endDate,
      status: w.status,
      created_at: w.createdAt,
      brand: w.phone?.brand,
      model: w.phone?.model,
      variant: w.phone?.variant
    }));

    // Map customer to snake_case
    const mappedCustomer = {
      id: customer.id,
      customer_code: customer.customerCode,
      full_name: customer.fullName,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      pincode: customer.pincode,
      gstin: customer.gstin,
      id_proof_type: customer.idProofType,
      id_proof_number: customer.idProofNumber,
      total_purchases: customer.totalPurchases,
      total_spent: customer.totalSpent,
      store_id: customer.storeId,
      created_at: customer.createdAt,
      updated_at: customer.updatedAt
    };

    res.json({
      success: true,
      customer: mappedCustomer,
      purchases: mappedPurchases,
      devices: mappedDevices,
      warranties: mappedWarranties
    });
  } catch (error) {
    console.error('Error fetching customer details:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// POST /api/customers
router.post('/', authenticateToken, enforceStoreContext, async (req, res) => {
  try {
    const { full_name, phone, email, address, city, state, pincode, gstin, id_proof_type, id_proof_number } = req.body;

    if (!full_name || !phone) {
      return res.status(400).json({ success: false, message: 'Full name and phone number are required.' });
    }

    const cleanPhone = phone.replace(/\\D/g, '');
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, message: 'Phone number must be exactly 10 digits.' });
    }

    let cleanIdProof = null;
    if (id_proof_number) {
      cleanIdProof = id_proof_number.replace(/\\D/g, '');
      if (cleanIdProof.length !== 12) {
        return res.status(400).json({ success: false, message: 'ID proof number must be exactly 12 digits.' });
      }
    }

    const existing = await prisma.customer.findFirst({
      where: { phone: cleanPhone }
    });

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        message: `Customer with phone ${cleanPhone} already exists (${existing.fullName}).`, 
        customerId: existing.id 
      });
    }

    const cCount = await prisma.customer.count();
    const customerCode = `CUST-${String(cCount + 1).padStart(4, '0')}`;

    const targetStoreId = req.user.role === 'admin' ? (req.body.store_id || null) : req.storeContext.store_id;

    const newCustomer = await prisma.customer.create({
      data: {
        customerCode,
        fullName: full_name.trim(),
        phone: cleanPhone,
        email: email || null,
        address: address || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        gstin: gstin || null,
        idProofType: id_proof_type || null,
        idProofNumber: cleanIdProof,
        storeId: targetStoreId
      }
    });

    res.status(201).json({
      success: true,
      message: 'Customer registered successfully.',
      customer: {
        id: newCustomer.id,
        customer_code: customerCode,
        full_name,
        phone
      }
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/customers/:id (Admin only)
router.delete('/:id', authenticateToken, requireDeletePermission('customers'), async (req, res) => {
  try {
    const customerId = parseInt(req.params.id);
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    await prisma.$transaction(async (tx) => {
      await tx.warranty.deleteMany({ where: { customerId } });
      await tx.returnItem.deleteMany({ where: { return: { customerId } } });
      await tx.return.deleteMany({ where: { customerId } });
      await tx.exchangedPhone.deleteMany({ where: { customerId } });
      
      const sales = await tx.sale.findMany({ where: { customerId }, select: { id: true } });
      for (const s of sales) {
        await tx.payment.deleteMany({ where: { saleId: s.id } });
        await tx.saleItem.deleteMany({ where: { saleId: s.id } });
      }
      await tx.sale.deleteMany({ where: { customerId } });
      await tx.customer.delete({ where: { id: customerId } });
    });

    await logAudit(req.user.id, req.user.username, 'DELETE_CUSTOMER', customer.storeId, 'CUSTOMER', String(customerId), { customerCode: customer.customerCode, fullName: customer.fullName }, req);

    res.json({ success: true, message: `Customer ${customer.fullName} (${customer.customerCode}) deleted successfully.` });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
