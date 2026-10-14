/**
 * Setup script to ensure Online Store (ECO-ONLINE) and system employee (online_system)
 * exist in the database for the Mobile App integration.
 */
const prisma = require('./prisma');
const bcrypt = require('bcryptjs');

async function setupOnlineStore() {
  console.log('--- Verifying Online Store Configuration ---');

  // 1. Online Store
  let store = await prisma.store.findFirst({
    where: { code: 'ECO-ONLINE' }
  });

  if (!store) {
    console.log('Creating Online Store (ECO-ONLINE)...');
    store = await prisma.store.create({
      data: {
        name: 'EcoFone Online Store',
        code: 'ECO-ONLINE',
        address: 'EcoFone Cloud Fulfillment Center',
        city: 'Indore',
        state: 'Madhya Pradesh',
        pincode: '452001',
        phone: '9876543210',
        email: 'online@ecofone.in',
        status: 'active'
      }
    });
    console.log('✓ Online Store created with ID:', store.id);
  } else {
    console.log('✓ Online Store already exists (ID: ' + store.id + ')');
  }

  // 2. Online Bot User
  let bot = await prisma.user.findFirst({
    where: { username: 'online_system' }
  });

  if (!bot) {
    console.log('Creating Online System Bot (online_system)...');
    const dummyHash = await bcrypt.hash('EcoFone@OnlineBot2026!', 10);
    bot = await prisma.user.create({
      data: {
        employeeId: 'EMP-ONLINE-BOT',
        username: 'online_system',
        passwordHash: dummyHash,
        fullName: 'EcoFone Online Bot',
        role: 'EMPLOYEE',
        assignedStoreId: store.id,
        status: 'active',
        permissions: JSON.stringify({ all: true })
      }
    });
    console.log('✓ Online System Bot created with ID:', bot.id);
  } else {
    console.log('✓ Online System Bot already exists (ID: ' + bot.id + ')');
  }

  console.log('--- Online Integration Ready! ---');
}

setupOnlineStore()
  .catch(err => {
    console.error('Setup error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
