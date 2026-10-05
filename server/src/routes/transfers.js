const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { authenticateToken, requireAdmin, requireSuperAdmin, requireDeletePermission, logAudit } = require('../middleware/auth');

async function getNextTransferNumber() {
  const currentYear = new Date().getFullYear();
  const prefix = `TRF-\${currentYear}-`;

  const last = await prisma.stockTransfer.findFirst({
    where: {
      transferNumber: {
        startsWith: prefix
      }
    },
    orderBy: { id: 'desc' },
    select: { transferNumber: true }
  });

  let nextSeq = 1;
  if (last && last.transferNumber) {
    const parts = last.transferNumber.split('-');
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) nextSeq = parsed + 1;
    }
  }
  return `\${prefix}\${String(nextSeq).padStart(6, '0')}`;
}

// GET /api/transfers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const whereClause = {};

    if (req.user.role !== 'admin') {
      whereClause.OR = [
        { fromStoreId: req.user.assigned_store_id },
        { toStoreId: req.user.assigned_store_id }
      ];
    }

    const transfers = await prisma.stockTransfer.findMany({
      where: whereClause,
      include: {
        fromStore: true,
        toStore: true,
        initiator: true,
        receiver: true,
        _count: {
          select: { items: true }
        }
      },
      orderBy: { id: 'desc' }
    });

    const mappedTransfers = transfers.map(t => ({
      id: t.id,
      transfer_number: t.transferNumber,
      from_store_id: t.fromStoreId,
      to_store_id: t.toStoreId,
      transfer_date: t.transferDate,
      received_date: t.receivedDate,
      initiated_by: t.initiatedBy,
      received_by: t.receivedBy,
      status: t.status,
      notes: t.notes,
      created_at: t.createdAt,
      updated_at: t.updatedAt,
      
      from_store_name: t.fromStore?.name,
      from_store_code: t.fromStore?.code,
      
      to_store_name: t.toStore?.name,
      to_store_code: t.toStore?.code,
      
      initiated_by_name: t.initiator?.fullName,
      received_by_name: t.receiver?.fullName,
      
      item_count: t._count.items
    }));

    res.json({ success: true, transfers: mappedTransfers });
  } catch (error) {
    console.error('Error fetching transfers:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/transfers/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const transferId = parseInt(req.params.id);

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id: transferId },
      include: {
        fromStore: true,
        toStore: true,
        initiator: true,
        receiver: true,
        items: {
          include: {
            phone: true
          }
        }
      }
    });

    if (!transfer) {
      return res.status(404).json({ success: false, message: 'Transfer record not found.' });
    }

    const mappedTransfer = {
      id: transfer.id,
      transfer_number: transfer.transferNumber,
      from_store_id: transfer.fromStoreId,
      to_store_id: transfer.toStoreId,
      transfer_date: transfer.transferDate,
      received_date: transfer.receivedDate,
      initiated_by: transfer.initiatedBy,
      received_by: transfer.receivedBy,
      status: transfer.status,
      notes: transfer.notes,
      created_at: transfer.createdAt,
      updated_at: transfer.updatedAt,
      
      from_store_name: transfer.fromStore?.name,
      from_store_code: transfer.fromStore?.code,
      to_store_name: transfer.toStore?.name,
      to_store_code: transfer.toStore?.code,
      initiated_by_name: transfer.initiator?.fullName,
      received_by_name: transfer.receiver?.fullName
    };

    const mappedItems = transfer.items.map(ti => ({
      id: ti.id,
      transfer_id: ti.transferId,
      phone_id: ti.phoneId,
      imei1: ti.imei1,
      brand: ti.phone?.brand,
      model: ti.phone?.model,
      variant: ti.phone?.variant,
      condition_grade: ti.phone?.conditionGrade,
      selling_price: ti.phone?.sellingPrice
    }));

    res.json({ success: true, transfer: mappedTransfer, items: mappedItems });
  } catch (error) {
    console.error('Error fetching transfer details:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// POST /api/transfers (Initiate Stock Transfer)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { from_store_id, to_store_id, phone_ids, notes } = req.body;

    if (!from_store_id || !to_store_id || !phone_ids || !phone_ids.length) {
      return res.status(400).json({ success: false, message: 'Source store, destination store, and at least one device are required.' });
    }

    if (parseInt(from_store_id) === parseInt(to_store_id)) {
      return res.status(400).json({ success: false, message: 'Source and destination store cannot be the same.' });
    }

    if (req.user.role !== 'admin' && req.user.assigned_store_id !== parseInt(from_store_id)) {
      return res.status(403).json({ success: false, message: 'You can only transfer stock out of your assigned store.' });
    }

    const transferNumber = await getNextTransferNumber();

    const result = await prisma.$transaction(async (tx) => {
      for (const phoneId of phone_ids) {
        const phone = await tx.phoneInventory.findUnique({ where: { id: phoneId } });
        if (!phone) throw new Error(`Phone ID \${phoneId} not found.`);
        if (phone.currentStoreId !== parseInt(from_store_id)) {
          throw new Error(`Device \${phone.brand} \${phone.model} (IMEI: \${phone.imei1}) is not in the source store.`);
        }
        if (phone.stockStatus !== 'AVAILABLE') {
          throw new Error(`Device (IMEI: \${phone.imei1}) is not available (Status: \${phone.stockStatus}).`);
        }
      }

      const tRes = await tx.stockTransfer.create({
        data: {
          transferNumber,
          fromStoreId: parseInt(from_store_id),
          toStoreId: parseInt(to_store_id),
          transferDate: new Date(),
          initiatedBy: req.user.id,
          status: 'In Transit',
          notes: notes || ''
        }
      });

      for (const phoneId of phone_ids) {
        const phone = await tx.phoneInventory.findUnique({ where: { id: phoneId } });
        
        await tx.stockTransferItem.create({
          data: {
            transferId: tRes.id,
            phoneId,
            imei1: phone.imei1
          }
        });

        await tx.phoneInventory.update({
          where: { id: phoneId },
          data: { stockStatus: 'IN_TRANSIT' }
        });
      }

      return tRes;
    });

    await logAudit(req.user.id, req.user.username, 'INITIATE_TRANSFER', parseInt(from_store_id), 'TRANSFER', String(result.id), { transferNumber, count: phone_ids.length, to_store_id }, req);

    res.status(201).json({ success: true, message: 'Stock transfer initiated. Phones are now In Transit.', data: { transferId: result.id, transferNumber } });
  } catch (error) {
    console.error('Error initiating transfer:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// PATCH /api/transfers/:id/receive
router.patch('/:id/receive', authenticateToken, async (req, res) => {
  try {
    const transferId = parseInt(req.params.id);

    const transfer = await prisma.stockTransfer.findUnique({ where: { id: transferId } });
    if (!transfer) {
      return res.status(404).json({ success: false, message: 'Transfer not found.' });
    }

    if (transfer.status === 'Received') {
      return res.status(400).json({ success: false, message: 'Transfer has already been received.' });
    }

    if (req.user.role !== 'admin' && req.user.assigned_store_id !== transfer.toStoreId) {
      return res.status(403).json({ success: false, message: 'Only employees of the destination store or admin can receive stock.' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: 'Received',
          receivedDate: new Date(),
          receivedBy: req.user.id
        }
      });

      const items = await tx.stockTransferItem.findMany({ where: { transferId } });
      for (const item of items) {
        await tx.phoneInventory.update({
          where: { id: item.phoneId },
          data: {
            currentStoreId: transfer.toStoreId,
            stockStatus: 'AVAILABLE'
          }
        });
      }
    });

    await logAudit(req.user.id, req.user.username, 'RECEIVE_TRANSFER', transfer.toStoreId, 'TRANSFER', String(transferId), { transferNumber: transfer.transferNumber }, req);

    res.json({ success: true, message: 'Stock received successfully. Inventory has been updated at destination store.' });
  } catch (error) {
    console.error('Error receiving transfer:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// PATCH /api/transfers/:id/cancel
router.patch('/:id/cancel', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const transferId = parseInt(req.params.id);

    const transfer = await prisma.stockTransfer.findUnique({ where: { id: transferId } });
    if (!transfer) return res.status(404).json({ success: false, message: 'Transfer not found.' });
    if (transfer.status === 'Received') return res.status(400).json({ success: false, message: 'Cannot cancel an already received transfer.' });

    await prisma.$transaction(async (tx) => {
      await tx.stockTransfer.update({
        where: { id: transferId },
        data: { status: 'Cancelled' }
      });

      const items = await tx.stockTransferItem.findMany({ where: { transferId } });
      for (const item of items) {
        await tx.phoneInventory.update({
          where: { id: item.phoneId },
          data: { stockStatus: 'AVAILABLE' }
        });
      }
    });

    await logAudit(req.user.id, req.user.username, 'CANCEL_TRANSFER', transfer.fromStoreId, 'TRANSFER', String(transferId), { transferNumber: transfer.transferNumber }, req);

    res.json({ success: true, message: 'Transfer cancelled and phones returned to source store stock.' });
  } catch (error) {
    console.error('Error cancelling transfer:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/transfers/:id (Admin only)
router.delete('/:id', authenticateToken, requireDeletePermission('transfers'), async (req, res) => {
  try {
    const transferId = parseInt(req.params.id);
    const transfer = await prisma.stockTransfer.findUnique({ where: { id: transferId } });
    if (!transfer) return res.status(404).json({ success: false, message: 'Transfer not found.' });

    await prisma.$transaction(async (tx) => {
      await tx.stockTransferItem.deleteMany({ where: { transferId } });
      await tx.stockTransfer.delete({ where: { id: transferId } });
    });

    await logAudit(req.user.id, req.user.username, 'DELETE_TRANSFER', transfer.fromStoreId, 'TRANSFER', String(transferId), { transferNumber: transfer.transferNumber }, req);

    res.json({ success: true, message: 'Transfer record deleted successfully.' });
  } catch (error) {
    console.error('Error deleting transfer:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
