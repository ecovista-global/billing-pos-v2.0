const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../db/prisma');
const { authenticateToken, requireAdmin, logAudit } = require('../middleware/auth');
const { parseUserPermissions } = require('../utils/permissions');

// GET /api/employees (Admin only or profile view)
router.get('/', authenticateToken, async (req, res) => {
  try {
    let employeesRaw;

    if (!['admin', 'super_admin'].includes(req.user.role)) {
      employeesRaw = await prisma.$queryRaw`
        SELECT u.id, u.employee_id, u.username, u.full_name, u.phone, u.email, u.address,
               u.role, u.assigned_store_id, u.status, u.permissions, u.created_at,
               u.failed_login_attempts, u.locked_until,
               s.name as store_name, s.code as store_code, s.city as store_city,
               (SELECT COUNT(*) FROM sales WHERE employee_id = u.id AND status = 'COMPLETED') as sales_count,
               (SELECT COALESCE(SUM(grand_total), 0) FROM sales WHERE employee_id = u.id AND status = 'COMPLETED') as total_revenue
        FROM users u
        LEFT JOIN stores s ON u.assigned_store_id = s.id
        WHERE u.assigned_store_id = ${req.user.assigned_store_id} AND u.role = 'employee'
      `;
    } else {
      employeesRaw = await prisma.$queryRaw`
        SELECT u.id, u.employee_id, u.username, u.full_name, u.phone, u.email, u.address,
               u.role, u.assigned_store_id, u.status, u.permissions, u.created_at,
               u.failed_login_attempts, u.locked_until,
               s.name as store_name, s.code as store_code, s.city as store_city,
               (SELECT COUNT(*) FROM sales WHERE employee_id = u.id AND status = 'COMPLETED') as sales_count,
               (SELECT COALESCE(SUM(grand_total), 0) FROM sales WHERE employee_id = u.id AND status = 'COMPLETED') as total_revenue
        FROM users u
        LEFT JOIN stores s ON u.assigned_store_id = s.id
        ORDER BY u.id ASC
      `;
    }

    const mapped = employeesRaw.map(e => {
      const emp = { ...e };
      if (typeof emp.sales_count === 'bigint') emp.sales_count = Number(emp.sales_count);
      emp.permissions = parseUserPermissions(emp.permissions, emp.role);
      return emp;
    });

    res.json({ success: true, employees: mapped });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/employees/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (!['admin', 'super_admin'].includes(req.user.role) && req.user.id !== id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const employee = await prisma.user.findUnique({
      where: { id },
      include: { assignedStore: true }
    });

    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    const sales = await prisma.sale.findMany({
      where: { employeeId: id },
      select: {
        id: true,
        saleNumber: true,
        invoiceNumber: true,
        saleDate: true,
        grandTotal: true,
        paymentStatus: true,
        status: true
      },
      orderBy: { saleDate: 'desc' },
      take: 20
    });

    const statsAgg = await prisma.sale.aggregate({
      where: { employeeId: id, status: 'COMPLETED' },
      _count: { _all: true },
      _sum: { grandTotal: true }
    });

    const mappedEmployee = {
      id: employee.id,
      employee_id: employee.employeeId,
      username: employee.username,
      full_name: employee.fullName,
      phone: employee.phone,
      email: employee.email,
      address: employee.address,
      role: employee.role,
      assigned_store_id: employee.assignedStoreId,
      status: employee.status,
      permissions: parseUserPermissions(employee.permissions, employee.role),
      created_at: employee.createdAt,
      store_name: employee.assignedStore?.name,
      store_code: employee.assignedStore?.code,
      store_city: employee.assignedStore?.city
    };

    const mappedSales = sales.map(s => ({
      id: s.id,
      sale_number: s.saleNumber,
      invoice_number: s.invoiceNumber,
      sale_date: s.saleDate,
      grand_total: s.grandTotal,
      payment_status: s.paymentStatus,
      status: s.status
    }));

    res.json({
      success: true,
      employee: mappedEmployee,
      sales: mappedSales,
      stats: {
        total_sales: statsAgg._count._all,
        total_revenue: statsAgg._sum.grandTotal || 0
      }
    });
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

function isValidPassword(password) {
  if (!password || password.length < 8) return false;
  const hasNumber = /\d/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>_=+\[\]\\/;'~-]/.test(password);
  return Boolean(hasNumber && hasUpper && hasSpecial);
}

// POST /api/employees (Admin only)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { employee_id, username, password, full_name, phone, email, address, role, assigned_store_id, status } = req.body;

    if (!username || !password || !full_name) {
      return res.status(400).json({ success: false, message: 'Username, password, and full name are required.' });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long and contain at least 1 uppercase letter, 1 number, and 1 special character.'
      });
    }

    let cleanPhone = null;
    if (phone) {
      cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        return res.status(400).json({ success: false, message: 'Employee phone number must be exactly 10 digits.' });
      }
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    const generatedId = employee_id || `ECO-EMP-${Math.floor(100 + Math.random() * 900)}`;
    const initialStatus = ['active', 'inactive', 'disabled', 'suspended'].includes(status) ? status : 'active';
    const empRole = role || 'employee';

    let parsedStoreId = null;
    if (assigned_store_id !== undefined && assigned_store_id !== null && assigned_store_id !== '' && assigned_store_id !== 'null') {
      parsedStoreId = parseInt(assigned_store_id, 10);
      if (isNaN(parsedStoreId)) parsedStoreId = null;
    }

    if (empRole === 'employee' && !parsedStoreId) {
      return res.status(400).json({ success: false, message: 'Store staff must be assigned to an active store branch.' });
    }

    const newEmployee = await prisma.user.create({
      data: {
        employeeId: generatedId,
        username: username.trim(),
        passwordHash: hash,
        fullName: full_name.trim(),
        phone: cleanPhone,
        email: email || null,
        address: address || null,
        role: empRole,
        assignedStoreId: parsedStoreId,
        status: initialStatus
      }
    });

    await logAudit(req.user.id, req.user.username, 'CREATE_EMPLOYEE', parsedStoreId, 'USER', String(newEmployee.id), { username, role: empRole, status: initialStatus, assignedStoreId: parsedStoreId }, req);

    res.status(201).json({ success: true, message: 'Employee created successfully.', id: newEmployee.id });
  } catch (err) {
    console.error('Create Employee Error:', err);
    res.status(400).json({ success: false, message: err.code === 'P2002' ? 'Username or Employee ID already exists.' : err.message });
  }
});

// PUT /api/employees/:id (Admin only - Update profile & Re-assign Store)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { full_name, phone, email, address, role, assigned_store_id, status } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    if (existingUser.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only CEO / Super Admin can edit Super Admin accounts.' });
    }

    let cleanPhone = null;
    if (phone) {
      cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length !== 10) {
        return res.status(400).json({ success: false, message: 'Employee phone number must be exactly 10 digits.' });
      }
    }

    let parsedStoreId = null;
    if (assigned_store_id !== undefined && assigned_store_id !== null && assigned_store_id !== '' && assigned_store_id !== 'null') {
      parsedStoreId = parseInt(assigned_store_id, 10);
      if (isNaN(parsedStoreId)) parsedStoreId = null;
    }

    const targetRole = role || existingUser.role;
    if (targetRole === 'employee' && !parsedStoreId) {
      return res.status(400).json({ success: false, message: 'Store staff must be assigned to an active store branch.' });
    }

    await prisma.user.update({
      where: { id },
      data: {
        fullName: full_name !== undefined ? full_name.trim() : existingUser.fullName,
        phone: cleanPhone,
        email: email !== undefined ? (email ? email.trim() : null) : existingUser.email,
        address: address !== undefined ? (address ? address.trim() : null) : existingUser.address,
        role: targetRole,
        assignedStoreId: parsedStoreId,
        status: status || existingUser.status
      }
    });

    await logAudit(
      req.user.id,
      req.user.username,
      'UPDATE_EMPLOYEE',
      parsedStoreId,
      'USER',
      String(id),
      {
        fullName: full_name,
        role: targetRole,
        previousStoreId: existingUser.assignedStoreId,
        newStoreId: parsedStoreId,
        status
      },
      req
    );

    res.json({ success: true, message: 'Employee details and store branch assignment updated successfully.' });
  } catch (err) {
    console.error('Update Employee Error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH /api/employees/:id/reset-password (Admin only)
router.patch('/:id/reset-password', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { new_password } = req.body;

    if (!isValidPassword(new_password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long and contain at least 1 uppercase letter, 1 number, and 1 special character.'
      });
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(new_password, salt);

    await prisma.user.update({
      where: { id },
      data: {
        passwordHash: hash,
        failedLoginAttempts: 0,
        lockedUntil: null
      }
    });

    await logAudit(req.user.id, req.user.username, 'RESET_PASSWORD', null, 'USER', String(id), 'Admin reset user password and unlocked account', req);

    res.json({ success: true, message: 'Password reset successfully and account unlocked.' });
  } catch (err) {
    console.error('Reset Password Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// PATCH /api/employees/:id/status (Admin only)
router.patch('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;

    if (!['active', 'inactive', 'suspended', 'disabled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    if (req.user.id === id && (status === 'inactive' || status === 'disabled' || status === 'suspended')) {
      return res.status(400).json({ success: false, message: 'You cannot disable your own administrator account.' });
    }

    const updateData = { status };
    if (status === 'active') {
      updateData.failedLoginAttempts = 0;
      updateData.lockedUntil = null;
    }

    await prisma.user.update({
      where: { id },
      data: updateData
    });

    await logAudit(req.user.id, req.user.username, 'TOGGLE_EMPLOYEE_STATUS', null, 'USER', String(id), { status }, req);

    res.json({ success: true, message: `Account status updated to ${status}.` });
  } catch (err) {
    console.error('Toggle Employee Status Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// PATCH /api/employees/:id/unlock (Admin only)
router.patch('/:id/unlock', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const employee = await prisma.user.findUnique({ where: { id } });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    await prisma.user.update({
      where: { id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        status: 'active'
      }
    });

    await logAudit(req.user.id, req.user.username, 'UNLOCK_ACCOUNT', employee.assignedStoreId, 'USER', String(id), {
      action: 'Admin unlocked account and reset failed login attempts'
    }, req);

    res.json({ success: true, message: `Account for ${employee.username} has been unlocked successfully.` });
  } catch (err) {
    console.error('Unlock Account Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// PUT /api/employees/:id/permissions (Admin only)
router.put('/:id/permissions', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { permissions } = req.body;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    if (target.role === 'super_admin') {
      return res.status(403).json({ success: false, message: 'CEO / Top Super Admin permissions cannot be modified.' });
    }

    if (target.role === 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Only the CEO can modify Sub-Admin permissions.' });
    }

    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ success: false, message: 'Valid permissions object is required.' });
    }

    const permissionsJson = JSON.stringify(permissions);

    await prisma.user.update({
      where: { id },
      data: { permissions: permissionsJson }
    });

    await logAudit(
      req.user.id,
      req.user.username,
      'UPDATE_EMPLOYEE_PERMISSIONS',
      target.assignedStoreId,
      'USER',
      String(id),
      { targetUser: target.username, permissionsSummary: permissions },
      req
    );

    const updatedPermissions = parseUserPermissions(permissionsJson, 'employee');
    res.json({
      success: true,
      message: `Access permissions for ${target.fullName} (${target.username}) updated successfully.`,
      permissions: updatedPermissions
    });
  } catch (err) {
    console.error('Update Permissions Error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
