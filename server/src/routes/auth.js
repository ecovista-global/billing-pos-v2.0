const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const prisma = require('../db/prisma');
const { authenticateToken, JWT_SECRET, logAudit } = require('../middleware/auth');
const { parseUserPermissions } = require('../utils/permissions');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const user = await prisma.user.findUnique({
      where: { username: username.trim() },
      include: { assignedStore: true }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });
    }

    // Check 24-hour lockout status
    if (user.lockedUntil) {
      const lockExpiry = new Date(user.lockedUntil);
      const now = new Date();

      if (lockExpiry > now) {
        const remainingMs = lockExpiry.getTime() - now.getTime();
        const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
        return res.status(403).json({
          success: false,
          accountLocked: true,
          lockedUntil: user.lockedUntil,
          message: `This account has been disabled for 24 hours due to 3 consecutive wrong password attempts. Please try again in ${remainingHours} hour${remainingHours > 1 ? 's' : ''} or contact an Administrator.`
        });
      } else {
        // 24 hours have elapsed: automatically clear lock
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null }
        });
        user.failedLoginAttempts = 0;
        user.lockedUntil = null;
      }
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Your account is disabled. Please contact Admin.' });
    }

    const match = bcrypt.compareSync(password, user.passwordHash);
    if (!match) {
      const currentAttempts = (user.failedLoginAttempts || 0) + 1;

      if (currentAttempts >= 3) {
        // Lock for 24 hours
        const lockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: currentAttempts, lockedUntil: lockUntil }
        });

        await logAudit(user.id, user.username, 'ACCOUNT_LOCKED', user.assignedStoreId, 'USER', String(user.id), {
          reason: 'Account disabled for 24 hours after 3 wrong password attempts',
          locked_until: lockUntil.toISOString()
        }, req);

        return res.status(403).json({
          success: false,
          accountLocked: true,
          lockedUntil: lockUntil,
          message: 'Password entered incorrectly 3 times. This account has been disabled for 24 hours. Please contact an Administrator.'
        });
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: currentAttempts }
        });

        const remaining = 3 - currentAttempts;
        return res.status(401).json({
          success: false,
          failedAttempts: currentAttempts,
          remainingAttempts: remaining,
          message: `Invalid username or password. You have ${remaining} attempt${remaining > 1 ? 's' : ''} remaining before your account is disabled for 24 hours.`
        });
      }
    }

    // Password matches: reset failed attempts if any
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null }
      });
    }

    // If user is super_admin, trigger 2FA step
    if (user.role === 'super_admin') {
      const tempToken = jwt.sign(
        { id: user.id, isTemp2FA: true },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      await logAudit(user.id, user.username, '2FA_CHALLENGE_ISSUED', user.assignedStoreId, 'USER', String(user.id), '2FA challenge issued to Super Admin', req);

      if (!user.twoFactorSecret) {
        const secret = speakeasy.generateSecret({ name: 'EcoFone (' + user.username + ')' });
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

        return res.json({
          success: true,
          require2fa: true,
          setupRequired: true,
          qrCodeUrl,
          tempSecret: secret.base32,
          tempToken,
          message: 'Setup Google Authenticator 2FA.'
        });
      }

      return res.json({
        success: true,
        require2fa: true,
        setupRequired: false,
        tempToken,
        message: 'Enter your 6-digit Authenticator code.'
      });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, is2faVerified: false, storeId: user.assignedStoreId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logAudit(user.id, user.username, 'LOGIN', user.assignedStoreId, 'USER', String(user.id), 'User logged in successfully', req);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        employee_id: user.employeeId,
        username: user.username,
        full_name: user.fullName,
        role: user.role,
        is_super_admin: user.role === 'super_admin',
        is2faVerified: false,
        assigned_store_id: user.assignedStoreId,
        store_name: user.assignedStore?.name,
        store_code: user.assignedStore?.code,
        store_city: user.assignedStore?.city,
        store_state: user.assignedStore?.state,
        email: user.email,
        phone: user.phone,
        permissions: parseUserPermissions(user.permissions, user.role)
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// POST /api/auth/verify-2fa (Super Admin 2FA verification)
router.post('/verify-2fa', async (req, res) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      return res.status(400).json({ success: false, message: 'Temporary token and 6-digit 2FA code are required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ success: false, message: '2FA session expired. Please log in again.' });
    }

    if (!decoded.isTemp2FA || !decoded.id) {
      return res.status(400).json({ success: false, message: 'Invalid 2FA challenge token.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { assignedStore: true }
    });

    if (!user || user.status !== 'active' || user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const cleanCode = String(code).trim();
    let isVerified = false;
    let newSecret = null;

    if (!user.twoFactorSecret) {
      if (!req.body.tempSecret) {
         return res.status(400).json({ success: false, message: 'Temp secret required for setup.' });
      }
      isVerified = speakeasy.totp.verify({
        secret: req.body.tempSecret,
        encoding: 'base32',
        token: cleanCode
      });
      if (isVerified) newSecret = req.body.tempSecret;
    } else {
      isVerified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: cleanCode,
        window: 1
      });
    }

    if (!isVerified) {
      await logAudit(user.id, user.username, '2FA_VERIFICATION_FAILED', user.assignedStoreId, 'USER', String(user.id), 'Invalid Authenticator code', req);
      return res.status(401).json({ success: false, message: 'Invalid Authenticator code.' });
    }

    if (newSecret) {
      await prisma.user.update({
        where: { id: user.id },
        data: { twoFactorSecret: newSecret }
      });
    }

    const fullToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role, is2faVerified: true, storeId: user.assignedStoreId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logAudit(user.id, user.username, '2FA_VERIFIED_LOGIN', user.assignedStoreId, 'USER', String(user.id), 'Super Admin successfully authenticated with 2FA', req);

    res.json({
      success: true,
      token: fullToken,
      user: {
        id: user.id,
        employee_id: user.employeeId,
        username: user.username,
        full_name: user.fullName,
        role: user.role,
        is_super_admin: true,
        is2faVerified: true,
        assigned_store_id: user.assignedStoreId,
        store_name: user.assignedStore?.name,
        store_code: user.assignedStore?.code,
        store_city: user.assignedStore?.city,
        store_state: user.assignedStore?.state,
        email: user.email,
        phone: user.phone,
        permissions: parseUserPermissions(user.permissions, user.role)
      }
    });
  } catch (error) {
    console.error('2FA Verification Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

function isValidPassword(password) {
  if (!password || password.length < 8) return false;
  const hasNumber = /\d/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>\-_=+[\]\\/;'`~]/.test(password);
  return Boolean(hasNumber && hasUpper && hasSpecial);
}

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Current and new password required.' });
    }

    if (!isValidPassword(new_password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long and contain at least 1 uppercase letter, 1 number, and 1 special character.'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { passwordHash: true }
    });
    
    if (!user || !bcrypt.compareSync(current_password, user.passwordHash)) {
      return res.status(400).json({ success: false, message: 'Incorrect current password.' });
    }

    const newHash = bcrypt.hashSync(new_password, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash: newHash }
    });
    
    await logAudit(req.user.id, req.user.username, 'CHANGE_PASSWORD', req.user.storeId, 'USER', String(req.user.id), 'Password changed', req);

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change Password Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
