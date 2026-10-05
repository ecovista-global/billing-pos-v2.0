const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { authenticateToken, requireAdmin, logAudit } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

// GET /api/settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    let rows = await prisma.setting.findMany();

    // If settings table is unexpectedly empty (cold lambda), restore from backup
    if (!rows || rows.length === 0) {
      const backupPaths = [
        '/tmp/settings_backup.json',
        path.resolve(__dirname, '../../data/settings_backup.json'),
        path.resolve(process.cwd(), 'server/data/settings_backup.json')
      ];
      for (const bp of backupPaths) {
        if (fs.existsSync(bp)) {
          try {
            const raw = fs.readFileSync(bp, 'utf-8');
            const parsed = JSON.parse(raw);
            
            await prisma.$transaction(
              Object.entries(parsed).map(([k, v]) => 
                prisma.setting.upsert({
                  where: { key: k },
                  update: { value: String(v) },
                  create: { key: k, value: String(v), groupName: 'general' }
                })
              )
            );

            rows = await prisma.setting.findMany();
            break;
          } catch (e) {}
        }
      }
    }

    const settings = {};
    if (rows && rows.length > 0) {
      rows.forEach(r => settings[r.key] = r.value);
    }

    const taxRates = await prisma.taxRate.findMany();
    const grades = await prisma.grade.findMany();

    // Map Prisma objects back to snake_case for frontend
    const mappedTaxRates = taxRates.map(tr => ({
      id: tr.id,
      name: tr.name,
      rate: tr.rate,
      cgst_rate: tr.cgstRate,
      sgst_rate: tr.sgstRate,
      igst_rate: tr.igstRate,
      is_default: tr.isDefault,
      status: tr.status
    }));

    res.json({ success: true, settings, taxRates: mappedTaxRates, grades });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// PUT /api/settings (Admin only)
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { settings } = req.body;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'Settings object required.' });
    }

    const txOperations = [];

    for (const [key, val] of Object.entries(settings)) {
      txOperations.push(
        prisma.setting.upsert({
          where: { key: key },
          update: { value: String(val) },
          create: { key: key, value: String(val), groupName: 'general' }
        })
      );
    }

    if (settings.default_tax_rate !== undefined && settings.default_tax_rate !== null && !isNaN(parseFloat(settings.default_tax_rate))) {
      const newRate = parseFloat(settings.default_tax_rate);
      
      txOperations.push(
        prisma.phoneInventory.updateMany({
          where: { stockStatus: 'AVAILABLE' },
          data: { taxRate: newRate }
        })
      );

      txOperations.push(
        prisma.taxRate.updateMany({
          where: { isDefault: 1 },
          data: {
            rate: newRate,
            cgstRate: Math.round((newRate / 2) * 10) / 10,
            sgstRate: Math.round((newRate / 2) * 10) / 10,
            igstRate: newRate
          }
        })
      );
    }

    await prisma.$transaction(txOperations);

    // Persist backup JSON to filesystem
    try {
      const backupJson = JSON.stringify(settings);
      fs.writeFileSync('/tmp/settings_backup.json', backupJson);
      const dataDir = path.resolve(__dirname, '../../data');
      if (fs.existsSync(dataDir)) {
        fs.writeFileSync(path.join(dataDir, 'settings_backup.json'), backupJson);
      }
    } catch (e) {}

    await logAudit(req.user.id, req.user.username, 'UPDATE_SETTINGS', null, 'SETTINGS', null, 'Company and invoice settings updated', req);

    res.json({ success: true, message: 'Settings saved successfully.' });
  } catch (error) {
    console.error('Update Settings Error:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/settings/audit-logs
router.get('/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { action, limit = 100 } = req.query;

    const queryOptions = {
      orderBy: { id: 'desc' },
      take: parseInt(limit)
    };

    if (action) {
      queryOptions.where = { action };
    }

    const logs = await prisma.auditLog.findMany(queryOptions);

    // Map to snake_case
    const mappedLogs = logs.map(log => ({
      id: log.id,
      user_id: log.userId,
      username: log.username,
      action: log.action,
      store_id: log.storeId,
      entity_type: log.entityType,
      entity_id: log.entityId,
      details: log.details,
      ip_address: log.ipAddress,
      created_at: log.createdAt
    }));

    res.json({ success: true, logs: mappedLogs });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/settings/notifications
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const storeId = req.user.assigned_store_id;

    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { storeId: storeId || null },
          { storeId: null }
        ]
      },
      orderBy: { id: 'desc' },
      take: 20
    });

    // Map to snake_case
    const mappedNotifications = notifications.map(notif => ({
      id: notif.id,
      user_id: notif.userId,
      store_id: notif.storeId,
      type: notif.type,
      title: notif.title,
      message: notif.message,
      is_read: notif.isRead,
      link: notif.link,
      created_at: notif.createdAt
    }));

    res.json({ success: true, notifications: mappedNotifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
