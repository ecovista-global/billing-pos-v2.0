const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { authenticateToken } = require('../middleware/auth');

// GET /api/warranties/check (Lookup by IMEI, invoice number, or customer phone)
router.get('/check', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || !query.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide an IMEI, invoice number, or customer phone.' });
    }

    const q = query.trim();

    const warranties = await prisma.warranty.findMany({
      where: {
        OR: [
          { imei1: q },
          { invoiceNumber: q },
          { customer: { phone: q } }
        ]
      },
      include: {
        phone: true,
        customer: true,
        sale: {
          include: {
            store: true
          }
        }
      },
      orderBy: { id: 'desc' }
    });

    const today = new Date().toISOString().split('T')[0];

    const parsed = warranties.map(w => {
      // Prisma returns dates as Date objects. Convert to YYYY-MM-DD for comparison.
      const endDateStr = w.endDate.toISOString().split('T')[0];
      const isExpired = endDateStr < today || w.status === 'Void';
      const daysRemaining = Math.max(0, Math.ceil((w.endDate.getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)));
      
      return {
        id: w.id,
        phone_id: w.phoneId,
        imei1: w.imei1,
        customer_id: w.customerId,
        sale_id: w.saleId,
        invoice_number: w.invoiceNumber,
        warranty_period_months: w.warrantyPeriodMonths,
        start_date: w.startDate,
        end_date: w.endDate,
        status: w.status,
        created_at: w.createdAt,
        
        brand: w.phone?.brand,
        model: w.phone?.model,
        variant: w.phone?.variant,
        condition_grade: w.phone?.conditionGrade,
        color: w.phone?.color,
        
        customer_name: w.customer?.fullName,
        customer_phone: w.customer?.phone,
        
        store_name: w.sale?.store?.name,
        store_code: w.sale?.store?.code,

        computed_status: w.status === 'Void' ? 'Void' : (isExpired ? 'Expired' : 'Active'),
        days_remaining: isExpired ? 0 : daysRemaining
      };
    });

    res.json({ success: true, count: parsed.length, warranties: parsed });
  } catch (error) {
    console.error('Error checking warranties:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// GET /api/warranties (List all)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const warranties = await prisma.warranty.findMany({
      include: {
        phone: true,
        customer: true,
        sale: {
          include: {
            store: true
          }
        }
      },
      orderBy: { id: 'desc' },
      take: 100
    });

    const parsed = warranties.map(w => ({
      id: w.id,
      phone_id: w.phoneId,
      imei1: w.imei1,
      customer_id: w.customerId,
      sale_id: w.saleId,
      invoice_number: w.invoiceNumber,
      warranty_period_months: w.warrantyPeriodMonths,
      start_date: w.startDate,
      end_date: w.endDate,
      status: w.status,
      created_at: w.createdAt,
      
      brand: w.phone?.brand,
      model: w.phone?.model,
      variant: w.phone?.variant,
      
      customer_name: w.customer?.fullName,
      customer_phone: w.customer?.phone,
      
      store_name: w.sale?.store?.name
    }));

    res.json({ success: true, warranties: parsed });
  } catch (error) {
    console.error('Error fetching warranties:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

module.exports = router;
