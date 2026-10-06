require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const prisma = require('./db/prisma');
const { createBackup } = require('./utils/backup');

// WAL Checkpoint every 5 minutes (SQLite only)
if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('file:')) {
  setInterval(() => {
    try {
      prisma.$executeRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)');
    } catch(e) {
      console.error('WAL checkpoint error:', e);
    }
  }, 5 * 60 * 1000);
}

const authRoutes = require('./routes/auth');
const storeRoutes = require('./routes/stores');
const employeeRoutes = require('./routes/employees');
const inventoryRoutes = require('./routes/inventory');
const posRoutes = require('./routes/pos');
const transferRoutes = require('./routes/transfers');
const customerRoutes = require('./routes/customers');
const returnRoutes = require('./routes/returns');
const warrantyRoutes = require('./routes/warranties');
const expenseRoutes = require('./routes/expenses');
const reportRoutes = require('./routes/reports');
const dashboardRoutes = require('./routes/dashboard');
const settingsRoutes = require('./routes/settings');
const exchangeRoutes = require('./routes/exchanges');
const accessoryRoutes = require('./routes/accessories');

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root landing route
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Ecofone POS API Server is Live & Running!',
    healthCheck: '/api/health'
  });
});

// Health Check
app.get('/api/health', async (req, res) => {
  try {
    const count = await prisma.store.count({ where: { status: 'active' } });
    res.json({
      status: 'healthy',
      database: 'connected',
      application: 'Ecofone POS & Multi-Store Management Backend',
      version: '1.0.0',
      storesCount: count,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      database: 'unavailable',
      message: 'Database connection failed'
    });
  }
});

const { enforceStoreContext } = require('./middleware/storeContext');

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', posRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/warranties', warrantyRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/exchanges', exchangeRoutes);
app.use('/api/accessories', accessoryRoutes);

// Serve static frontend build if present (Unified Single-Port Deployment)
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
