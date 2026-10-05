const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { authenticateToken, requireAdmin, requireSuperAdmin, requireDeletePermission, logAudit } = require('../middleware/auth');
const { enforceStoreContext } = require('../middleware/storeContext');

// GET /api/expenses
router.get('/', authenticateToken, enforceStoreContext, async (req, res) => {
  try {
    const { store_id, category, date_from, date_to } = req.query;

    const whereClause = {};

    if (!req.storeContext.isAllStores) {
      whereClause.OR = [
        { storeId: req.storeContext.store_id },
        { storeId: null }
      ];
    } else if (store_id) {
      whereClause.storeId = parseInt(store_id);
    }

    if (category) {
      whereClause.category = category;
    }

    if (date_from || date_to) {
      whereClause.expenseDate = {};
      if (date_from) whereClause.expenseDate.gte = new Date(date_from);
      if (date_to) whereClause.expenseDate.lte = new Date(date_to);
    }

    const expenses = await prisma.expense.findMany({
      where: whereClause,
      include: {
        store: true,
        creator: true
      },
      orderBy: [
        { expenseDate: 'desc' },
        { id: 'desc' }
      ]
    });

    const mappedExpenses = expenses.map(e => ({
      id: e.id,
      store_id: e.storeId,
      category: e.category,
      description: e.description,
      amount: e.amount,
      expense_date: e.expenseDate,
      receipt_number: e.receiptNumber,
      created_by: e.createdBy,
      notes: e.notes,
      created_at: e.createdAt,
      store_name: e.store?.name,
      store_code: e.store?.code,
      created_by_name: e.creator?.fullName
    }));

    const categorySummaryRaw = await prisma.expense.groupBy({
      by: ['category'],
      where: whereClause,
      _sum: {
        amount: true
      },
      orderBy: {
        _sum: {
          amount: 'desc'
        }
      }
    });

    const categorySummary = categorySummaryRaw.map(cat => ({
      category: cat.category,
      total_amount: cat._sum.amount || 0
    }));

    res.json({ success: true, expenses: mappedExpenses, categorySummary });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// POST /api/expenses
router.post('/', authenticateToken, enforceStoreContext, async (req, res) => {
  try {
    const { store_id, category, description, amount, expense_date, receipt_number, notes } = req.body;

    if (!category || !description || !amount || !expense_date) {
      return res.status(400).json({ success: false, message: 'Category, description, amount, and date are required.' });
    }

    const targetStoreId = req.user.role === 'admin' ? (store_id ? parseInt(store_id) : null) : req.storeContext.store_id;

    const newExpense = await prisma.expense.create({
      data: {
        storeId: targetStoreId,
        category,
        description,
        amount: parseFloat(amount),
        expenseDate: new Date(expense_date),
        receiptNumber: receipt_number || null,
        createdBy: req.user.id,
        notes: notes || null
      }
    });

    await logAudit(req.user.id, req.user.username, 'ADD_EXPENSE', targetStoreId, 'EXPENSE', String(newExpense.id), { category, amount, description }, req);

    res.status(201).json({ success: true, message: 'Expense logged successfully.', id: newExpense.id });
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/expenses/:id (Admin only)
router.delete('/:id', authenticateToken, enforceStoreContext, requireDeletePermission('expenses'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    await prisma.expense.delete({
      where: { id }
    });

    await logAudit(req.user.id, req.user.username, 'DELETE_EXPENSE', null, 'EXPENSE', String(id), 'Deleted expense record', req);
    
    res.json({ success: true, message: 'Expense record deleted.' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
