const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { enforceStoreContext } = require('../middleware/storeContext');

// Helper to sanitize parameters for raw queries
function mapBigIntToNumber(obj) {
  if (!obj) return obj;
  const newObj = { ...obj };
  for (const key in newObj) {
    if (typeof newObj[key] === 'bigint') {
      newObj[key] = Number(newObj[key]);
    } else if (newObj[key] !== null && typeof newObj[key] === 'object' && !(newObj[key] instanceof Date)) {
      newObj[key] = mapBigIntToNumber(newObj[key]);
    }
  }
  return newObj;
}

// GET /api/reports/sales
router.get('/sales', authenticateToken, enforceStoreContext, async (req, res) => {
  try {
    const { store_id, date_from, date_to, group_by = 'day' } = req.query;

    let where = `WHERE sa.status = 'COMPLETED'`;
    
    if (!req.storeContext.isAllStores) {
      where += ` AND sa.store_id = \${req.storeContext.store_id}`;
    } else if (store_id) {
      where += ` AND sa.store_id = \${parseInt(store_id)}`;
    }

    if (date_from) {
      where += ` AND DATE(sa.sale_date, '+5 hours', '+30 minutes') >= '\${date_from}'`;
    }
    if (date_to) {
      where += ` AND DATE(sa.sale_date, '+5 hours', '+30 minutes') <= '\${date_to}'`;
    }

    // Aggregate stats
    const totalsRaw = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*) as total_invoices,
        COALESCE(SUM(sa.subtotal), 0) as subtotal,
        COALESCE(SUM(sa.discount_total), 0) as discounts,
        COALESCE(SUM(sa.taxable_amount), 0) as taxable_amount,
        COALESCE(SUM(sa.total_tax), 0) as total_tax,
        COALESCE(SUM(sa.grand_total), 0) as grand_total,
        (SELECT COUNT(*) FROM sale_items si JOIN sales s ON si.sale_id = s.id \${where}) as total_units_sold
      FROM sales sa
      \${where}
    `);
    const totals = mapBigIntToNumber(totalsRaw[0] || {});

    // Time-series breakdown
    let timeFormat = '%Y-%m-%d';
    if (group_by === 'month') timeFormat = '%Y-%m';
    if (group_by === 'year') timeFormat = '%Y';

    const timelineRaw = await prisma.$queryRawUnsafe(`
      SELECT 
        STRFTIME('\${timeFormat}', sa.sale_date, '+5 hours', '+30 minutes') as period,
        COUNT(sa.id) as sales_count,
        SUM(sa.grand_total) as revenue,
        SUM(sa.total_tax) as tax,
        SUM((si.selling_price * COALESCE(si.quantity, 1) - COALESCE(si.discount, 0)) - (si.unit_cost * COALESCE(si.quantity, 1))) as profit
      FROM sales sa
      JOIN sale_items si ON sa.id = si.sale_id
      \${where}
      GROUP BY period
      ORDER BY period ASC
    `);
    const timeline = timelineRaw.map(mapBigIntToNumber);

    // Store-wise performance
    let storeBreakdown = [];
    if (req.user.role === 'admin') {
      let storeDateFilter = '';
      if (date_from) storeDateFilter += ` AND DATE(sa.sale_date, '+5 hours', '+30 minutes') >= '\${date_from}'`;
      if (date_to) storeDateFilter += ` AND DATE(sa.sale_date, '+5 hours', '+30 minutes') <= '\${date_to}'`;

      const storeBreakdownRaw = await prisma.$queryRawUnsafe(`
        SELECT 
          s.id, s.name as store_name, s.code as store_code, s.city,
          COUNT(DISTINCT sa.id) as sales_count,
          COUNT(si.id) as units_sold,
          COALESCE(SUM(sa.grand_total), 0) as revenue,
          COALESCE(SUM((si.selling_price * COALESCE(si.quantity, 1) - COALESCE(si.discount, 0)) - (si.unit_cost * COALESCE(si.quantity, 1))), 0) as gross_profit
        FROM stores s
        LEFT JOIN sales sa ON s.id = sa.store_id AND sa.status = 'COMPLETED' \${storeDateFilter}
        LEFT JOIN sale_items si ON sa.id = si.sale_id
        GROUP BY s.id
        ORDER BY revenue DESC
      `);
      storeBreakdown = storeBreakdownRaw.map(mapBigIntToNumber);
    }

    // Brand-wise performance
    const brandBreakdownRaw = await prisma.$queryRawUnsafe(`
      SELECT 
        si.brand,
        COUNT(si.id) as units_sold,
        SUM(si.final_price) as revenue,
        SUM((si.selling_price * COALESCE(si.quantity, 1) - COALESCE(si.discount, 0)) - (si.unit_cost * COALESCE(si.quantity, 1))) as gross_profit
      FROM sale_items si
      JOIN sales sa ON si.sale_id = sa.id
      \${where}
      GROUP BY si.brand
      ORDER BY units_sold DESC
    `);
    const brandBreakdown = brandBreakdownRaw.map(mapBigIntToNumber);

    res.json({
      success: true,
      totals,
      timeline,
      storeBreakdown,
      brandBreakdown
    });
  } catch (error) {
    console.error('Error fetching sales report:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/reports/profit-loss (P&L Management)
router.get('/profit-loss', authenticateToken, enforceStoreContext, requireAdmin, async (req, res) => {
  try {
    const { store_id, date_from, date_to } = req.query;

    let saleWhere = `WHERE sa.status = 'COMPLETED'`;
    let expWhere = `WHERE 1=1`;

    if (store_id) {
      saleWhere += ` AND sa.store_id = \${parseInt(store_id)}`;
      expWhere += ` AND (e.store_id = \${parseInt(store_id)} OR e.store_id IS NULL)`;
    }

    if (date_from) {
      saleWhere += ` AND DATE(sa.sale_date, '+5 hours', '+30 minutes') >= '\${date_from}'`;
      expWhere += ` AND DATE(e.expense_date) >= '\${date_from}'`;
    }

    if (date_to) {
      saleWhere += ` AND DATE(sa.sale_date, '+5 hours', '+30 minutes') <= '\${date_to}'`;
      expWhere += ` AND DATE(e.expense_date) <= '\${date_to}'`;
    }

    const salesMetricsRaw = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(DISTINCT sa.id) as total_orders,
        COUNT(si.id) as total_phones_sold,
        COALESCE(SUM(si.selling_price * COALESCE(si.quantity, 1) - COALESCE(si.discount, 0)), 0) as net_sales_revenue,
        COALESCE(SUM(si.total_tax), 0) as tax_collected,
        COALESCE(SUM(si.final_price), 0) as total_gross_billed,
        COALESCE(SUM(si.unit_cost * COALESCE(si.quantity, 1)), 0) as total_cogs,
        COALESCE(SUM((si.selling_price * COALESCE(si.quantity, 1) - COALESCE(si.discount, 0)) - (si.unit_cost * COALESCE(si.quantity, 1))), 0) as gross_profit
      FROM sales sa
      JOIN sale_items si ON sa.id = si.sale_id
      \${saleWhere}
    `);
    const salesMetrics = mapBigIntToNumber(salesMetricsRaw[0] || {
      net_sales_revenue: 0, total_cogs: 0, gross_profit: 0, total_phones_sold: 0, tax_collected: 0
    });

    const expenseMetricsRaw = await prisma.$queryRawUnsafe(`
      SELECT 
        COALESCE(SUM(e.amount), 0) as total_expenses
      FROM expenses e
      \${expWhere}
    `);
    const expenseMetrics = mapBigIntToNumber(expenseMetricsRaw[0] || { total_expenses: 0 });

    const expensesByCategoryRaw = await prisma.$queryRawUnsafe(`
      SELECT category, COALESCE(SUM(amount), 0) as amount
      FROM expenses e
      \${expWhere}
      GROUP BY category
      ORDER BY amount DESC
    `);
    const expensesByCategory = expensesByCategoryRaw.map(mapBigIntToNumber);

    const netRevenue = salesMetrics.net_sales_revenue;
    const cogs = salesMetrics.total_cogs;
    const grossProfit = salesMetrics.gross_profit;
    const totalExpenses = expenseMetrics.total_expenses;
    const netProfit = grossProfit - totalExpenses;
    const grossMargin = netRevenue > 0 ? ((grossProfit / netRevenue) * 100).toFixed(1) : 0;
    const netMargin = netRevenue > 0 ? ((netProfit / netRevenue) * 100).toFixed(1) : 0;

    let storeDateFilterSales = '';
    let storeDateFilterExp = '';
    if (date_from) {
      storeDateFilterSales += ` AND DATE(sa.sale_date, '+5 hours', '+30 minutes') >= '\${date_from}'`;
      storeDateFilterExp += ` AND DATE(e.expense_date) >= '\${date_from}'`;
    }
    if (date_to) {
      storeDateFilterSales += ` AND DATE(sa.sale_date, '+5 hours', '+30 minutes') <= '\${date_to}'`;
      storeDateFilterExp += ` AND DATE(e.expense_date) <= '\${date_to}'`;
    }

    const storePlTableRaw = await prisma.$queryRawUnsafe(`
      SELECT 
        s.id as store_id, s.name as store_name, s.code as store_code, s.city,
        COUNT(DISTINCT sa.id) as total_sales,
        COUNT(si.id) as phones_sold,
        COALESCE(SUM(si.selling_price * COALESCE(si.quantity, 1) - COALESCE(si.discount, 0)), 0) as revenue,
        COALESCE(SUM(si.unit_cost * COALESCE(si.quantity, 1)), 0) as cost_of_goods,
        COALESCE(SUM((si.selling_price * COALESCE(si.quantity, 1) - COALESCE(si.discount, 0)) - (si.unit_cost * COALESCE(si.quantity, 1))), 0) as gross_profit,
        (SELECT COALESCE(SUM(e.amount), 0) FROM expenses e WHERE e.store_id = s.id \${storeDateFilterExp}) as store_expenses
      FROM stores s
      LEFT JOIN sales sa ON s.id = sa.store_id AND sa.status = 'COMPLETED' \${storeDateFilterSales}
      LEFT JOIN sale_items si ON sa.id = si.sale_id
      GROUP BY s.id
      ORDER BY gross_profit DESC
    `);
    
    const storePlComputed = storePlTableRaw.map(rowRaw => {
      const row = mapBigIntToNumber(rowRaw);
      return {
        ...row,
        net_profit: row.gross_profit - (row.store_expenses || 0),
        margin: row.revenue > 0 ? ((row.gross_profit / row.revenue) * 100).toFixed(1) : 0
      };
    });

    res.json({
      success: true,
      summary: {
        netRevenue,
        cogs,
        grossProfit,
        grossMargin: `\${grossMargin}%`,
        totalExpenses,
        netProfit,
        netMargin: `\${netMargin}%`,
        phonesSold: salesMetrics.total_phones_sold,
        taxCollected: salesMetrics.tax_collected
      },
      expensesByCategory,
      storePlTable: storePlComputed
    });
  } catch (error) {
    console.error('Error fetching P&L report:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/reports/taxes (Tax / GST Reports)
router.get('/taxes', authenticateToken, enforceStoreContext, requireAdmin, async (req, res) => {
  try {
    const { date_from, date_to, store_id } = req.query;

    let where = `WHERE sa.status = 'COMPLETED'`;

    if (store_id) {
      where += ` AND sa.store_id = \${parseInt(store_id)}`;
    }
    if (date_from) {
      where += ` AND DATE(sa.sale_date, '+5 hours', '+30 minutes') >= '\${date_from}'`;
    }
    if (date_to) {
      where += ` AND DATE(sa.sale_date, '+5 hours', '+30 minutes') <= '\${date_to}'`;
    }

    const taxSummaryRaw = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*) as total_taxable_invoices,
        COALESCE(SUM(sa.taxable_amount), 0) as total_taxable_value,
        COALESCE(SUM(sa.cgst), 0) as total_cgst,
        COALESCE(SUM(sa.sgst), 0) as total_sgst,
        COALESCE(SUM(sa.igst), 0) as total_igst,
        COALESCE(SUM(sa.total_tax), 0) as total_gst_collected,
        COALESCE(SUM(sa.grand_total), 0) as total_gross_turnover
      FROM sales sa
      \${where}
    `);
    const taxSummary = mapBigIntToNumber(taxSummaryRaw[0] || {});

    let storeDateFilter = '';
    if (date_from) storeDateFilter += ` AND DATE(sa.sale_date, '+5 hours', '+30 minutes') >= '\${date_from}'`;
    if (date_to) storeDateFilter += ` AND DATE(sa.sale_date, '+5 hours', '+30 minutes') <= '\${date_to}'`;

    const storeTaxTableRaw = await prisma.$queryRawUnsafe(`
      SELECT 
        s.id, s.name as store_name, s.code as store_code, s.gstin, s.state,
        COUNT(sa.id) as invoice_count,
        COALESCE(SUM(sa.taxable_amount), 0) as taxable_value,
        COALESCE(SUM(sa.cgst), 0) as cgst,
        COALESCE(SUM(sa.sgst), 0) as sgst,
        COALESCE(SUM(sa.igst), 0) as igst,
        COALESCE(SUM(sa.total_tax), 0) as total_tax
      FROM stores s
      LEFT JOIN sales sa ON s.id = sa.store_id AND sa.status = 'COMPLETED' \${storeDateFilter}
      GROUP BY s.id
      ORDER BY total_tax DESC
    `);
    const storeTaxTable = storeTaxTableRaw.map(mapBigIntToNumber);

    res.json({
      success: true,
      taxSummary,
      storeTaxTable
    });
  } catch (error) {
    console.error('Error fetching tax report:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/reports/employee-performance
router.get('/employee-performance', authenticateToken, enforceStoreContext, requireAdmin, async (req, res) => {
  try {
    const performanceRaw = await prisma.$queryRawUnsafe(`
      SELECT 
        u.id, u.employee_id, u.full_name, u.username,
        s.name as store_name, s.city as store_city,
        COUNT(sa.id) as total_sales_count,
        COUNT(si.id) as phones_sold,
        COALESCE(SUM(sa.grand_total), 0) as total_revenue,
        COALESCE(SUM(sa.discount_total), 0) as total_discounts_given,
        COALESCE(AVG(sa.grand_total), 0) as average_ticket_size,
        COALESCE(SUM((si.selling_price * COALESCE(si.quantity, 1) - COALESCE(si.discount, 0)) - (si.unit_cost * COALESCE(si.quantity, 1))), 0) as gross_profit_generated
      FROM users u
      JOIN stores s ON u.assigned_store_id = s.id
      LEFT JOIN sales sa ON u.id = sa.employee_id AND sa.status = 'COMPLETED'
      LEFT JOIN sale_items si ON sa.id = si.sale_id
      WHERE u.role = 'employee'
      GROUP BY u.id
      ORDER BY total_revenue DESC
    `);
    
    const performance = performanceRaw.map(mapBigIntToNumber);

    res.json({ success: true, performance });
  } catch (error) {
    console.error('Error fetching employee performance:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
