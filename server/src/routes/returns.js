const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { authenticateToken, requireAdmin, requireSuperAdmin, requireDeletePermission, logAudit } = require('../middleware/auth');
const { enforceStoreContext } = require('../middleware/storeContext');

async function getNextReturnNumber() {
  const currentYear = new Date().getFullYear();
  const prefix = `RET-\${currentYear}-`;

  const last = await prisma.return.findFirst({
    where: {
      returnNumber: {
        startsWith: prefix
      }
    },
    orderBy: {
      id: 'desc'
    }
  });

  let nextSeq = 1;
  if (last && last.returnNumber) {
    const parts = last.returnNumber.split('-');
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) nextSeq = parsed + 1;
    }
  }
  return `\${prefix}\${String(nextSeq).padStart(6, '0')}`;
}

// GET /api/returns
router.get('/', authenticateToken, enforceStoreContext, async (req, res) => {
  try {
    const whereClause = {};

    if (!req.storeContext.isAllStores) {
      whereClause.storeId = req.storeContext.store_id;
    }

    const returns = await prisma.return.findMany({
      where: whereClause,
      include: {
        store: true,
        customer: true,
        processor: true
      },
      orderBy: { id: 'desc' }
    });

    const mappedReturns = returns.map(r => ({
      id: r.id,
      return_number: r.returnNumber,
      sale_id: r.saleId,
      invoice_number: r.invoiceNumber,
      store_id: r.storeId,
      customer_id: r.customerId,
      return_date: r.returnDate,
      reason: r.reason,
      status: r.status,
      refund_amount: r.refundAmount,
      refund_method: r.refundMethod,
      notes: r.notes,
      processed_by: r.processedBy,
      created_at: r.createdAt,
      
      store_name: r.store?.name,
      store_code: r.store?.code,
      
      customer_name: r.customer?.fullName,
      customer_phone: r.customer?.phone,
      
      processed_by_name: r.processor?.fullName
    }));

    res.json({ success: true, returns: mappedReturns });
  } catch (error) {
    console.error('Error fetching returns:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// POST /api/returns (Initiate Return)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { invoice_number, imei, reason, refund_method, condition_received, notes } = req.body;

    if (!invoice_number || !imei || !reason) {
      return res.status(400).json({ success: false, message: 'Invoice number, IMEI, and reason are required.' });
    }

    const cleanImei = String(imei).trim();
    if (!/^\\d{15}$/.test(cleanImei)) {
      return res.status(400).json({ success: false, message: 'Device IMEI must be exactly 15 numeric digits.' });
    }

    // Find the sale
    const sale = await prisma.sale.findUnique({
      where: { invoiceNumber: invoice_number.trim() }
    });

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    if (req.user.role !== 'admin' && req.user.assigned_store_id !== sale.storeId) {
      return res.status(403).json({ success: false, message: 'Returns can only be processed at the store where the device was purchased, or by Admin.' });
    }

    const saleItem = await prisma.saleItem.findFirst({
      where: { saleId: sale.id, imei1: imei.trim() },
      include: { phone: true }
    });

    if (!saleItem) {
      return res.status(404).json({ success: false, message: `Device with IMEI \${imei} was not found on this invoice.` });
    }

    const returnNumber = await getNextReturnNumber();
    const newStatus = reason.toLowerCase().includes('defect') ? 'DEFECTIVE' : 'RETURNED';

    const result = await prisma.$transaction(async (tx) => {
      const retInsert = await tx.return.create({
        data: {
          returnNumber,
          saleId: sale.id,
          invoiceNumber: sale.invoiceNumber,
          storeId: sale.storeId,
          customerId: sale.customerId,
          reason,
          status: 'Approved',
          refundAmount: saleItem.finalPrice,
          refundMethod: refund_method || 'Store Credit / Refund',
          notes: notes || '',
          processedBy: req.user.id,
          items: {
            create: {
              phoneId: saleItem.phoneId,
              imei1: saleItem.imei1,
              saleItemId: saleItem.id,
              conditionReceived: condition_received || 'Inspected'
            }
          }
        }
      });

      // Update phone inventory to RETURNED or DEFECTIVE
      const existingNotes = saleItem.phone?.notes || '';
      const newNotes = existingNotes + (existingNotes ? ' ' : '') + `[Returned via \${returnNumber}]`;
      
      await tx.phoneInventory.update({
        where: { id: saleItem.phoneId },
        data: {
          stockStatus: newStatus,
          notes: newNotes
        }
      });

      // Mark warranty as Claimed/Void
      await tx.warranty.updateMany({
        where: { phoneId: saleItem.phoneId, saleId: sale.id },
        data: { status: 'Void' }
      });

      return { returnId: retInsert.id, returnNumber, refundAmount: saleItem.finalPrice };
    });

    await logAudit(req.user.id, req.user.username, 'PROCESS_RETURN', sale.storeId, 'RETURN', String(result.returnId), { returnNumber, imei, refundAmount: result.refundAmount }, req);

    res.status(201).json({
      success: true,
      message: 'Return processed and inventory status updated.',
      data: result
    });
  } catch (error) {
    console.error('Error processing return:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/returns/:id (Admin only)
router.delete('/:id', authenticateToken, requireDeletePermission('returns'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.return.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Return record not found' });

    await prisma.$transaction(async (tx) => {
      await tx.returnItem.deleteMany({ where: { returnId: id } });
      await tx.return.delete({ where: { id } });
    });

    await logAudit(req.user.id, req.user.username, 'DELETE_RETURN', existing.storeId, 'RETURN', String(id), { returnNumber: existing.returnNumber }, req);

    res.json({ success: true, message: 'Return record deleted successfully.' });
  } catch (error) {
    console.error('Error deleting return:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
