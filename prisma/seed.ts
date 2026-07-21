import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Hapus data lama
  await prisma.auditLog.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.room.deleteMany();
  await prisma.property.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.owner.deleteMany();

  const passwordHash = await bcrypt.hash('Password1!', 12);

  // Buat owner
  const owner = await prisma.owner.create({
    data: {
      email: 'owner@kosku.dev',
      passwordHash,
      fullName: 'Budi Santoso',
      phoneNumber: '081234567890',
      isVerified: true,
    },
  });

  console.log(`Owner dibuat: ${owner.email}`);

  // Buat tenant
  const tenant1 = await prisma.tenant.create({
    data: {
      email: 'andi@kosku.dev',
      passwordHash,
      fullName: 'Andi Pratama',
      phoneNumber: '082111222333',
      idCardNumber: '3175123456780001',
      emergencyContactName: 'Siti Pratama',
      emergencyContactPhone: '081333444555',
    },
  });

  const tenant2 = await prisma.tenant.create({
    data: {
      email: 'dewi@kosku.dev',
      passwordHash,
      fullName: 'Dewi Lestari',
      phoneNumber: '083222333444',
      idCardNumber: '3175123456780002',
    },
  });

  console.log(`Tenant dibuat: ${tenant1.email}, ${tenant2.email}`);

  // Buat properti
  const property = await prisma.property.create({
    data: {
      ownerId: owner.id,
      name: 'Kos Pak Budi Tangerang',
      address: 'Jl. Merpati No. 12, RT 003/RW 005',
      city: 'Tangerang',
      province: 'Banten',
      postalCode: '15111',
      description: 'Kos eksklusif dekat stasiun Tangerang, lingkungan aman dan nyaman',
      rules: 'Tidak boleh membawa tamu menginap. Bayar sebelum tanggal 5.',
      facilities: ['wifi', 'parking', 'security_24h', 'cctv'],
    },
  });

  console.log(`Properti dibuat: ${property.name}`);

  // Buat kamar-kamar
  const rooms = await Promise.all([
    prisma.room.create({
      data: {
        propertyId: property.id,
        roomNumber: '101',
        floor: 1,
        type: 'Standard',
        sizeSqm: 12,
        basePrice: 1200000,
        facilities: ['ac', 'private_bathroom', 'wardrobe', 'desk'],
        status: 'OCCUPIED',
      },
    }),
    prisma.room.create({
      data: {
        propertyId: property.id,
        roomNumber: '102',
        floor: 1,
        type: 'Standard',
        sizeSqm: 12,
        basePrice: 1200000,
        facilities: ['ac', 'private_bathroom', 'wardrobe', 'desk'],
        status: 'OCCUPIED',
      },
    }),
    prisma.room.create({
      data: {
        propertyId: property.id,
        roomNumber: '201',
        floor: 2,
        type: 'Deluxe',
        sizeSqm: 16,
        basePrice: 1500000,
        facilities: ['ac', 'private_bathroom', 'wardrobe', 'desk', 'tv', 'refrigerator'],
        status: 'AVAILABLE',
      },
    }),
    prisma.room.create({
      data: {
        propertyId: property.id,
        roomNumber: '202',
        floor: 2,
        type: 'Deluxe',
        sizeSqm: 16,
        basePrice: 1500000,
        facilities: ['ac', 'private_bathroom', 'wardrobe', 'desk', 'tv'],
        status: 'NEEDS_MAINTENANCE',
        notes: 'Kipas AC perlu diganti',
      },
    }),
  ]);

  console.log(`${rooms.length} kamar dibuat`);

  // Buat kontrak aktif untuk kamar 101
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const endDate = new Date(now.getFullYear() + 1, now.getMonth() - 2, 0);

  const contract1 = await prisma.contract.create({
    data: {
      roomId: rooms[0].id,
      tenantId: tenant1.id,
      ownerId: owner.id,
      startDate,
      endDate,
      monthlyRent: 1200000,
      depositAmount: 1200000,
      depositStatus: 'PAID',
      billingDate: 1,
      additionalCharges: [
        { name: 'Air', amount: 25000 },
        { name: 'Iuran Kebersihan', amount: 20000 },
      ],
      status: 'ACTIVE',
    },
  });

  // Generate beberapa bill untuk kontrak pertama
  const billsData = [];
  for (let i = 2; i >= 0; i--) {
    const billDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = billDate.getMonth() + 1;
    const year = billDate.getFullYear();
    const dueDate = new Date(year, month - 1, 1);

    billsData.push({
      contractId: contract1.id,
      tenantId: tenant1.id,
      roomId: rooms[0].id,
      propertyId: property.id,
      periodMonth: month,
      periodYear: year,
      dueDate,
      baseRent: 1200000,
      additionalCharges: [
        { name: 'Air', amount: 25000 },
        { name: 'Iuran Kebersihan', amount: 20000 },
      ],
      totalAmount: 1245000,
      status: i > 0 ? ('PAID' as const) : ('UNPAID' as const),
      paidAt: i > 0 ? new Date(year, month - 1, 3) : null,
    });
  }

  await prisma.bill.createMany({ data: billsData });

  console.log('Bills dibuat untuk kontrak 1');
  console.log('\n✅ Seeding selesai!');
  console.log('\nAkun untuk testing:');
  console.log('  Owner  → owner@kosku.dev / Password1!');
  console.log('  Tenant → andi@kosku.dev  / Password1!');
  console.log('  Tenant → dewi@kosku.dev  / Password1!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });