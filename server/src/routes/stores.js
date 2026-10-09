const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { authenticateToken, requireAdmin, requireSuperAdmin, logAudit } = require('../middleware/auth');

// GET /api/stores
router.get('/', authenticateToken, async (req, res) => {
  try {
    let storesRaw;

    if (!['admin', 'super_admin'].includes(req.user.role)) {
      storesRaw = await prisma.$queryRaw`
        SELECT s.*, 
          (SELECT COUNT(*) FROM phone_inventory p WHERE p.current_store_id = s.id AND p.stock_status = 'AVAILABLE') as available_inventory_count,
          (SELECT COUNT(*) FROM phone_inventory p WHERE p.current_store_id = s.id AND p.stock_status = 'SOLD') as total_sold_count,
          (SELECT COUNT(*) FROM users u WHERE u.assigned_store_id = s.id AND u.status = 'active') as employee_count,
          (SELECT COALESCE(SUM(sa.grand_total), 0) FROM sales sa WHERE sa.store_id = s.id AND sa.status = 'COMPLETED') as total_revenue,
          (SELECT COALESCE(SUM((si.selling_price * (CASE WHEN si.accessory_quantity > 0 THEN si.accessory_quantity ELSE 1 END) - COALESCE(si.discount, 0)) - (si.unit_cost * (CASE WHEN si.accessory_quantity > 0 THEN si.accessory_quantity ELSE 1 END))), 0) 
           FROM sale_items si 
           JOIN sales sa ON si.sale_id = sa.id 
           WHERE sa.store_id = s.id AND sa.status = 'COMPLETED') as total_profit
        FROM stores s
        WHERE s.id = ${req.user.assigned_store_id} AND s.status != 'archived'
      `;
    } else {
      storesRaw = await prisma.$queryRaw`
        SELECT s.*, 
          (SELECT COUNT(*) FROM phone_inventory p WHERE p.current_store_id = s.id AND p.stock_status = 'AVAILABLE') as available_inventory_count,
          (SELECT COUNT(*) FROM phone_inventory p WHERE p.current_store_id = s.id AND p.stock_status = 'SOLD') as total_sold_count,
          (SELECT COUNT(*) FROM users u WHERE u.assigned_store_id = s.id AND u.status = 'active') as employee_count,
          (SELECT COALESCE(SUM(sa.grand_total), 0) FROM sales sa WHERE sa.store_id = s.id AND sa.status = 'COMPLETED') as total_revenue,
          (SELECT COALESCE(SUM((si.selling_price * (CASE WHEN si.accessory_quantity > 0 THEN si.accessory_quantity ELSE 1 END) - COALESCE(si.discount, 0)) - (si.unit_cost * (CASE WHEN si.accessory_quantity > 0 THEN si.accessory_quantity ELSE 1 END))), 0) 
           FROM sale_items si 
           JOIN sales sa ON si.sale_id = sa.id 
           WHERE sa.store_id = s.id AND sa.status = 'COMPLETED') as total_profit
        FROM stores s
        WHERE s.status != 'archived'
        ORDER BY s.id ASC
      `;
    }

    // Convert BigInt counts from queryRaw to Numbers if necessary
    const stores = storesRaw.map(store => {
      const s = { ...store };
      for (const key in s) {
        if (typeof s[key] === 'bigint') {
          s[key] = Number(s[key]);
        }
      }
      return s;
    });

    res.json({ success: true, stores });
  } catch (error) {
    console.error('Error fetching stores:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/stores/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const storeId = parseInt(req.params.id);

    if (!['admin', 'super_admin'].includes(req.user.role) && req.user.assigned_store_id !== storeId) {
      return res.status(403).json({ success: false, message: 'Access denied to other stores.' });
    }

    const storesRaw = await prisma.$queryRaw`
      SELECT s.*,
        (SELECT COUNT(*) FROM phone_inventory p WHERE p.current_store_id = s.id AND p.stock_status = 'AVAILABLE') as available_inventory_count,
        (SELECT COUNT(*) FROM users u WHERE u.assigned_store_id = s.id) as employee_count,
        (SELECT COALESCE(SUM(grand_total), 0) FROM sales WHERE store_id = s.id AND status = 'COMPLETED') as total_revenue
      FROM stores s
      WHERE s.id = ${storeId}
    `;

    if (!storesRaw || storesRaw.length === 0) {
      return res.status(404).json({ success: false, message: 'Store not found.' });
    }

    const store = { ...storesRaw[0] };
    for (const key in store) {
      if (typeof store[key] === 'bigint') store[key] = Number(store[key]);
    }

    const employees = await prisma.user.findMany({
      where: { assignedStoreId: storeId },
      select: {
        id: true,
        employeeId: true,
        username: true,
        fullName: true,
        role: true,
        status: true,
        phone: true,
        email: true
      }
    });

    // Map properties to snake_case for frontend
    const mappedEmployees = employees.map(emp => ({
      id: emp.id,
      employee_id: emp.employeeId,
      username: emp.username,
      full_name: emp.fullName,
      role: emp.role,
      status: emp.status,
      phone: emp.phone,
      email: emp.email
    }));

    res.json({ success: true, store, employees: mappedEmployees });
  } catch (error) {
    console.error('Error fetching store:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// POST /api/stores (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, code, address, city, state, pincode, phone, email, gstin, manager } = req.body;

    if (!name || !code || !city || !state) {
      return res.status(400).json({ success: false, message: 'Name, code, city, and state are required.' });
    }

    let cleanPhone = null;
    if (phone) {
      cleanPhone = phone.replace(/\\D/g, '');
      if (cleanPhone.length !== 10) {
        return res.status(400).json({ success: false, message: 'Store phone number must be exactly 10 digits.' });
      }
    }

    const newStore = await prisma.store.create({
      data: {
        name,
        code,
        address: address || null,
        city,
        state,
        pincode: pincode || null,
        phone: cleanPhone,
        email: email || null,
        gstin: gstin || null,
        manager: manager || null,
        status: 'active'
      }
    });

    await logAudit(req.user.id, req.user.username, 'CREATE_STORE', newStore.id, 'STORE', String(newStore.id), { name, code, city }, req);

    res.status(201).json({ success: true, message: 'Store created successfully.', storeId: newStore.id });
  } catch (err) {
    console.error('Create Store Error:', err);
    res.status(400).json({ success: false, message: err.code === 'P2002' ? 'Store code already exists.' : err.message });
  }
});

// PUT /api/stores/:id (Admin only)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const storeId = parseInt(req.params.id);
    const { name, code, address, city, state, pincode, phone, email, gstin, manager, status } = req.body;

    let cleanPhone = null;
    if (phone) {
      cleanPhone = phone.replace(/\\D/g, '');
      if (cleanPhone.length !== 10) {
        return res.status(400).json({ success: false, message: 'Store phone number must be exactly 10 digits.' });
      }
    }

    await prisma.store.update({
      where: { id: storeId },
      data: {
        name,
        code,
        address,
        city,
        state,
        pincode,
        phone: cleanPhone,
        email,
        gstin,
        manager,
        status: status || 'active'
      }
    });

    await logAudit(req.user.id, req.user.username, 'UPDATE_STORE', storeId, 'STORE', String(storeId), { name, code, status }, req);

    res.json({ success: true, message: 'Store updated successfully.' });
  } catch (err) {
    console.error('Update Store Error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH /api/stores/:id/status
router.patch('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const storeId = parseInt(req.params.id);
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    await prisma.store.update({
      where: { id: storeId },
      data: { status }
    });

    await logAudit(req.user.id, req.user.username, 'TOGGLE_STORE_STATUS', storeId, 'STORE', String(storeId), { status }, req);

    res.json({ success: true, message: `Store marked as ${status}.` });
  } catch (err) {
    console.error('Toggle Store Status Error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/stores/:id (Super Admin only - Soft Delete/Archive)
router.delete('/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const storeId = parseInt(req.params.id);
    
    // Prevent deleting the main/primary store if it's store ID 1 (optional safety check)
    if (storeId === 1) {
      return res.status(400).json({ success: false, message: 'Primary store (ID 1) cannot be deleted.' });
    }

    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      return res.status(404).json({ success: false, message: 'Store not found.' });
    }
    if (store.status === 'archived') {
      return res.status(400).json({ success: false, message: 'Store is already archived/deleted.' });
    }

    await prisma.store.update({
      where: { id: storeId },
      data: {
        status: 'archived',
        deletedAt: new Date()
      }
    });

    // Also mark all employees associated with this store as inactive
    await prisma.user.updateMany({
      where: { assignedStoreId: storeId },
      data: { status: 'inactive' }
    });

    await logAudit(req.user.id, req.user.username, 'DELETE_STORE', storeId, 'STORE', String(storeId), { name: store.name }, req);

    res.json({ success: true, message: 'Store has been deleted/archived successfully.' });
  } catch (err) {
    console.error('Delete Store Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
