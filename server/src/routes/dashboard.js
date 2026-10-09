const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { authenticateToken } = require('../middleware/auth');
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

// GET /api/dashboard
router.get('/', authenticateToken, enforceStoreContext, async (req, res) => {
  try {
    const { period = 'all', start_date, end_date } = req.query; // 'today', '7days', '30days', 'this_month', 'all', 'custom'
    const storeId = (req.user.role === 'admin' || req.user.role === 'super_admin') ? null : req.user.assigned_store_id;

    let dateFilter = '';
    if (period === 'today') {
      dateFilter = `AND CAST(sa.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS DATE) = CAST(NOW() AT TIME ZONE 'Asia/Kolkata' AS DATE)`;
    } else if (period === 'yesterday') {
      dateFilter = `AND CAST(sa.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS DATE) = CAST(NOW() AT TIME ZONE 'Asia/Kolkata' AS DATE) - INTERVAL '1 day'`;
    } else if (period === '7days') {
      dateFilter = `AND CAST(sa.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS DATE) >= CAST(NOW() AT TIME ZONE 'Asia/Kolkata' AS DATE) - INTERVAL '7 days'`;
    } else if (period === '30days') {
      dateFilter = `AND CAST(sa.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS DATE) >= CAST(NOW() AT TIME ZONE 'Asia/Kolkata' AS DATE) - INTERVAL '30 days'`;
    } else if (period === 'this_month') {
      dateFilter = `AND TO_CHAR(sa.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') = TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM')`;
    } else if (period === 'custom' && start_date && end_date) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(start_date) && /^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
        dateFilter = `AND CAST(sa.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS DATE) BETWEEN CAST('${start_date}' AS DATE) AND CAST('${end_date}' AS DATE)`;
      }
    }

    const storeFilter = storeId ? `AND sa.store_id = ${parseInt(storeId)}` : '';
    const invStoreFilter = storeId ? `WHERE current_store_id = ${parseInt(storeId)}` : '';
    const expStoreFilter = storeId ? `AND (store_id = ${parseInt(storeId)} OR store_id IS NULL)` : '';
    const currentStoreIdCond = storeId ? `AND p.current_store_id = ${parseInt(storeId)}` : '';

    // 1. Today's stats
    const todayRaw = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(DISTINCT sa.id) as today_sales_count,
        COUNT(si.id) as today_phones_sold,
        COALESCE(SUM(sa.grand_total), 0) as today_revenue,
        COALESCE(SUM(sa.total_tax), 0) as today_tax,
        COALESCE(SUM((si.selling_price * COALESCE(si.quantity, 1) - COALESCE(si.discount, 0)) - (si.unit_cost * COALESCE(si.quantity, 1))), 0) as today_profit
      FROM sales sa
      LEFT JOIN sale_items si ON sa.id = si.sale_id
      WHERE sa.status = 'COMPLETED' 
        AND CAST(sa.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS DATE) = CAST(NOW() AT TIME ZONE 'Asia/Kolkata' AS DATE) 
        ${storeFilter}
        AND NOT EXISTS (SELECT 1 FROM sale_items sq WHERE sq.sale_id = sa.id AND sq.is_quick_bill = 1)
    `);
    const today = mapBigIntToNumber(todayRaw[0] || {});

    // Today's expenses
    const todayExpensesRaw = await prisma.$queryRawUnsafe(`
      SELECT COALESCE(SUM(amount), 0) as today_expenses
      FROM expenses
      WHERE CAST(expense_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS DATE) = CAST(NOW() AT TIME ZONE 'Asia/Kolkata' AS DATE) ${expStoreFilter}
    `);
    const todayExpenses = mapBigIntToNumber(todayExpensesRaw[0] || { today_expenses: 0 });

    // 2. Selected Period / All-time Business Overview
    const overviewRaw = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(DISTINCT sa.id) as total_sales_count,
        COUNT(si.id) as total_phones_sold,
        COALESCE(SUM(sa.grand_total), 0) as total_revenue,
        COALESCE(SUM(sa.total_tax), 0) as total_tax,
        COALESCE(SUM(si.unit_cost * COALESCE(si.quantity, 1)), 0) as total_cogs,
        COALESCE(SUM((si.selling_price * COALESCE(si.quantity, 1) - COALESCE(si.discount, 0)) - (si.unit_cost * COALESCE(si.quantity, 1))), 0) as total_profit
      FROM sales sa
      LEFT JOIN sale_items si ON sa.id = si.sale_id
      WHERE sa.status = 'COMPLETED' 
        ${dateFilter} 
        ${storeFilter}
        AND NOT EXISTS (SELECT 1 FROM sale_items sq WHERE sq.sale_id = sa.id AND sq.is_quick_bill = 1)
    `);
    const overview = mapBigIntToNumber(overviewRaw[0] || {});

    // Inventory stats
    const inventoryRaw = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*) as total_inventory,
        COALESCE(SUM(CASE WHEN stock_status = 'AVAILABLE' THEN 1 ELSE 0 END), 0) as available_phones,
        COALESCE(SUM(CASE WHEN stock_status = 'SOLD' THEN 1 ELSE 0 END), 0) as sold_phones,
        COALESCE(SUM(CASE WHEN stock_status = 'IN_TRANSIT' THEN 1 ELSE 0 END), 0) as in_transit_phones,
        COALESCE(SUM(CASE WHEN stock_status = 'DEFECTIVE' THEN 1 ELSE 0 END), 0) as defective_phones,
        COALESCE(SUM(CASE WHEN stock_status = 'AVAILABLE' THEN total_cost ELSE 0 END), 0) as total_inventory_cost,
        COALESCE(SUM(CASE WHEN stock_status = 'AVAILABLE' THEN final_selling_price ELSE 0 END), 0) as total_inventory_value
      FROM phone_inventory
      ${invStoreFilter}
    `);
    const inventory = mapBigIntToNumber(inventoryRaw[0] || {});

    // Active stores count
    const activeStoresCount = await prisma.store.count({ where: { status: 'active' } });

    // Pending transfers count
    const pendingTransfers = await prisma.stockTransfer.count({ where: { status: { in: ['Pending', 'In Transit'] } } });

    // Low stock alert (models with count <= 1 in store)
    const lowStockRaw = await prisma.$queryRawUnsafe(`
      SELECT brand, model, COUNT(*) as qty, s.name as store_name
      FROM phone_inventory p
      JOIN stores s ON p.current_store_id = s.id
      WHERE p.stock_status = 'AVAILABLE' ${currentStoreIdCond}
      GROUP BY p.current_store_id, brand, model, s.name
      HAVING COUNT(*) <= 1
      LIMIT 6
    `);
    const lowStock = lowStockRaw.map(mapBigIntToNumber);

    // 3. Store Comparison Table (Admin only)
    let storeComparison = [];
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      const storeComparisonRaw = await prisma.$queryRawUnsafe(`
        SELECT 
          s.id as store_id,
          s.name as store_name,
          s.code as store_code,
          s.city as store_city,
          s.status as store_status,
          COUNT(DISTINCT sa.id) as sales_count,
          COUNT(si.id) as phones_sold,
          COALESCE(SUM(sa.grand_total), 0) as revenue,
          COALESCE(SUM(si.unit_cost * COALESCE(si.quantity, 1)), 0) as cost,
          COALESCE(SUM((si.selling_price * COALESCE(si.quantity, 1) - COALESCE(si.discount, 0)) - (si.unit_cost * COALESCE(si.quantity, 1))), 0) as profit,
          (SELECT COUNT(*) FROM phone_inventory p WHERE p.current_store_id = s.id AND p.stock_status = 'AVAILABLE') as inventory_count
        FROM stores s
        LEFT JOIN sales sa ON s.id = sa.store_id AND sa.status = 'COMPLETED' ${dateFilter} 
          AND NOT EXISTS (SELECT 1 FROM sale_items sq WHERE sq.sale_id = sa.id AND sq.is_quick_bill = 1)
        LEFT JOIN sale_items si ON sa.id = si.sale_id
        GROUP BY s.id
        ORDER BY revenue DESC
      `);
      storeComparison = storeComparisonRaw.map(mapBigIntToNumber);
    }

    // 4. Chart Data: Daily Sales / Revenue
    const salesChartRaw = await prisma.$queryRawUnsafe(`
      SELECT 
        CAST(sa.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS DATE) as date,
        COUNT(DISTINCT sa.id) as orders,
        SUM(sa.grand_total) as revenue,
        SUM((si.selling_price * COALESCE(si.quantity, 1) - COALESCE(si.discount, 0)) - (si.unit_cost * COALESCE(si.quantity, 1))) as profit
      FROM sales sa
      JOIN sale_items si ON sa.id = si.sale_id
      WHERE sa.status = 'COMPLETED' AND sa.sale_date >= (NOW() AT TIME ZONE 'Asia/Kolkata') - INTERVAL '30 days' ${storeFilter}
        AND NOT EXISTS (SELECT 1 FROM sale_items sq WHERE sq.sale_id = sa.id AND sq.is_quick_bill = 1)
      GROUP BY CAST(sa.sale_date AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata' AS DATE)
      ORDER BY date ASC
    `);
    const salesTimeline = salesChartRaw.map(mapBigIntToNumber);

    // Category/Brand share
    const brandShareRaw = await prisma.$queryRawUnsafe(`
      SELECT si.brand, COUNT(*) as count, SUM(si.final_price) as revenue
      FROM sale_items si
      JOIN sales sa ON si.sale_id = sa.id
      WHERE sa.status = 'COMPLETED' ${storeFilter}
      GROUP BY si.brand
      ORDER BY count DESC
      LIMIT 6
    `);
    const brandShare = brandShareRaw.map(mapBigIntToNumber);

    // Recent Sales using Prisma API for better relations support where possible, but keeping queryRaw for simplicity if preferred.
    // We'll use Prisma API for recentSales.
    const recentSalesPrisma = await prisma.sale.findMany({
      where: {
        status: 'COMPLETED',
        ...(storeId ? { storeId: parseInt(storeId) } : {})
      },
      include: {
        customer: true,
        store: true
      },
      orderBy: { saleDate: 'desc' },
      take: 8
    });

    const recentSales = recentSalesPrisma.map(sa => ({
      id: sa.id,
      invoice_number: sa.invoiceNumber,
      sale_date: sa.saleDate,
      grand_total: sa.grandTotal,
      payment_status: sa.paymentStatus,
      customer_name: sa.customer?.fullName,
      store_name: sa.store?.name
    }));

    res.json({
      success: true,
      today: {
        ...today,
        today_expenses: todayExpenses.today_expenses
      },
      overview,
      inventory,
      activeStoresCount,
      pendingTransfers,
      lowStock,
      storeComparison,
      charts: {
        salesTimeline,
        brandShare
      },
      recentSales
    });
  } catch (error) {
    console.error('Error loading dashboard:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
