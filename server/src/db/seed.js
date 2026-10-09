const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedSuperAdmin() {
  try {
    const adminExists = await prisma.user.findFirst({
      where: { role: 'super_admin' }
    });

    if (adminExists) {
      console.log('Admin user already exists!');
      return;
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync('Admin@Ecofone#2026!', salt);

    const newAdmin = await prisma.user.create({
      data: {
        employeeId: 'ECO-ADM-001',
        username: 'EcoMasterAdmin',
        passwordHash: passwordHash,
        fullName: 'Super Admin',
        phone: '+91 0000000000',
        email: 'admin@ecofone.in',
        address: 'HQ',
        role: 'super_admin',
        status: 'active',
        permissions: JSON.stringify({
          dashboard: { view: true },
          pos: { view: true, edit: true },
          exchanged_phones: { view: true, edit: true },
          inventory: { view: true, edit: true },
          accessories: { view: true, edit: true },
          stock_entry: { view: true, edit: true },
          customers: { view: true, edit: true },
          sales: { view: true },
          invoices: { view: true, edit: true },
          returns: { view: true, edit: true },
          warranty: { view: true },
          profile: { view: true, edit: true }
        })
      }
    });

    console.log('Super Admin created successfully!');
    console.log('Username: EcoMasterAdmin');
    console.log('Password: Admin@Ecofone#2026!');

  } catch (error) {
    console.error('Error seeding admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedSuperAdmin();
