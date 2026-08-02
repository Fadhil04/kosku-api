import { prisma } from '../../src/config/database';
import bcrypt from 'bcryptjs';

export async function cleanDatabase() {
  // Hapus berurutan sesuai foreign key dependency
  await prisma.auditLog.deleteMany();
  await prisma.complaintResponse.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.room.deleteMany();
  await prisma.property.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.owner.deleteMany();
}

export async function createTestOwner() {
  const passwordHash = await bcrypt.hash('Password1!', 12);
  return prisma.owner.create({
    data: {
      email: 'owner.test@kosku.dev',
      passwordHash,
      fullName: 'Owner Test',
      phoneNumber: '081234567890',
      isVerified: true,
    },
  });
}

export async function createTestTenant() {
  const passwordHash = await bcrypt.hash('Password1!', 12);
  return prisma.tenant.create({
    data: {
      email: 'tenant.test@kosku.dev',
      passwordHash,
      fullName: 'Tenant Test',
      phoneNumber: '082111222333',
    },
  });
}

export async function createTestProperty(ownerId: string) {
  return prisma.property.create({
    data: {
      ownerId,
      name: 'Kos Test',
      address: 'Jl. Test No. 1',
      city: 'Jakarta',
      province: 'DKI Jakarta',
    },
  });
}

export async function createTestRoom(propertyId: string) {
  return prisma.room.create({
    data: {
      propertyId,
      roomNumber: 'T01',
      type: 'Standard',
      basePrice: 1000000,
      status: 'AVAILABLE',
    },
  });
}

export async function createTestContract(
  roomId: string,
  tenantId: string,
  ownerId: string,
  propertyId: string,
) {
  const start = new Date();
  const end = new Date();
  end.setFullYear(end.getFullYear() + 1);

  const contract = await prisma.contract.create({
    data: {
      roomId,
      tenantId,
      ownerId,
      startDate: start,
      endDate: end,
      monthlyRent: 1000000,
      billingDate: 1,
      status: 'ACTIVE',
    },
  });

  // Update status room
  await prisma.room.update({
    where: { id: roomId },
    data: { status: 'OCCUPIED' },
  });

  // Buat satu bill untuk bulan ini
  const now = new Date();
  await prisma.bill.create({
    data: {
      contractId: contract.id,
      tenantId,
      roomId,
      propertyId,
      periodMonth: now.getMonth() + 1,
      periodYear: now.getFullYear(),
      dueDate: new Date(now.getFullYear(), now.getMonth(), 1),
      baseRent: 1000000,
      additionalCharges: [],
      totalAmount: 1000000,
      status: 'UNPAID',
    },
  });

  return contract;
}