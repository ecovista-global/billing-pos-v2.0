const jwt = require('jsonwebtoken');
const prisma = require('../db/prisma');
const { parseUserPermissions } = require('../utils/permissions');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables.");
  process.exit(1);
}

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { assignedStore: true }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Account is inactive or suspended.' });
    }

    // Map Prisma result back to legacy object format for compatibility with other routes
    const userObj = {
      id: user.id,
      employee_id: user.employeeId,
      username: user.username,
      full_name: user.fullName,
      role: user.role,
      is_super_admin: user.role === 'super_admin',
      is2faVerified: decoded.is2faVerified || user.role !== 'super_admin',
      assigned_store_id: user.assignedStoreId,
      status: user.status,
      permissions: parseUserPermissions(user.permissions, user.role),
      store_name: user.assignedStore?.name,
      store_code: user.assignedStore?.code,
      store_city: user.assignedStore?.city,
      store_state: user.assignedStore?.state
    };

    req.user = userObj;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid or expired session token.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin')) {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Access denied. Admin privileges required.' });
  }
}

function requireSuperAdmin(req, res, next) {
  if (req.user && req.user.role === 'super_admin' && req.user.is2faVerified) {
    next();
  } else if (req.user && req.user.role === 'super_admin' && !req.user.is2faVerified) {
    res.status(403).json({ success: false, message: 'Super Admin 2FA verification required for this operation.', require2fa: true });
  } else {
    res.status(403).json({ success: false, message: 'Access denied. Super Admin privileges required. Regular admins cannot perform permanent deletions or security modifications.' });
  }
}

function requireDeletePermission(moduleKey) {
  return (req, res, next) => {
    if (req.user && req.user.role === 'super_admin' && req.user.is2faVerified) {
      return next();
    }
    if (req.user && req.user.role === 'super_admin' && !req.user.is2faVerified) {
      return res.status(403).json({ success: false, message: 'Super Admin 2FA verification required for this operation.', require2fa: true });
    }
    
    // Allow normal admin to delete by default, unless explicitly denied
    if (req.user && req.user.role === 'admin') {
      const userPerms = typeof req.user.permissions === 'object' ? req.user.permissions : {};
      if (moduleKey && userPerms[moduleKey] && userPerms[moduleKey].delete === false) {
        return res.status(403).json({ success: false, message: `Access denied. You have been restricted from deleting ${moduleKey}.` });
      }
      return next();
    }

    res.status(403).json({ success: false, message: `Access denied. CEO privileges or specific '${moduleKey}' Delete permission required.` });
  };
}

async function logAudit(userId, username, action, storeId, entityType, entityId, details, req) {
  try {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') : '';
    await prisma.auditLog.create({
      data: {
        userId,
        username,
        action,
        storeId: storeId || null,
        entityType,
        entityId: entityId ? String(entityId) : null,
        details: typeof details === 'object' ? JSON.stringify(details) : details,
        ipAddress: ip
      }
    });
  } catch (e) {
    console.error('Audit log error:', e);
  }
}

module.exports = { authenticateToken, requireAdmin, requireSuperAdmin, requireDeletePermission, logAudit, JWT_SECRET };
