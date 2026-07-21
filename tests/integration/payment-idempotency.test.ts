import { prisma } from '../../src/config/database';
import { paymentsService } from '../../src/modules/payments/payments.service';

// Test ini butuh database test yang sudah di-setup dan ada data bill
// Untuk kebutuhan chat ini, kita tunjukkan strukturnya saja
// Implementasi penuh butuh setup/teardown data terlebih dahulu

describe('Payment Idempotency (Integration)', () => {
  let billId: string;
  let ownerId: string;

  beforeAll(async () => {
    // Create test data: owner, property, room, contract, and bill
    const owner = await prisma.owner.create({
      data: {
        email: 'payment-test-owner@test.com',
        passwordHash: 'hash',
        fullName: 'Test Owner',
      },
    });
    ownerId = owner.id;

    const property = await prisma.property.create({
      data: {
        ownerId,
        name: 'Test Property',
        address: 'Test Address',
        city: 'Test City',
        province: 'Test Province',
        postalCode: '12345',
      },
    });

    const room = await prisma.room.create({
      data: {
        propertyId: property.id,
        roomNumber: '101',
        type: 'Standard',
        basePrice: 1000000,
        status: 'AVAILABLE',
      },
    });

    const tenant = await prisma.tenant.create({
      data: {
        email: 'payment-test-tenant@test.com',
        passwordHash: 'hash',
        fullName: 'Test Tenant',
      },
    });

    const contract = await prisma.contract.create({
      data: {
        roomId: room.id,
        tenantId: tenant.id,
        ownerId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        monthlyRent: 1000000,
        status: 'ACTIVE',
      },
    });

    const bill = await prisma.bill.create({
      data: {
        contractId: contract.id,
        roomId: room.id,
        propertyId: property.id,
        tenantId: tenant.id,
        periodMonth: new Date().getMonth() + 1,
        periodYear: new Date().getFullYear(),
        baseRent: 1000000,
        totalAmount: 1000000,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'UNPAID',
      },
    });
    billId = bill.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.payment.deleteMany({ where: { bill: { id: billId } } });
    await prisma.bill.deleteMany({ where: { id: billId } });
    await prisma.contract.deleteMany({ where: { ownerId } });
    await prisma.room.deleteMany({});
    await prisma.property.deleteMany({ where: { ownerId } });
    await prisma.tenant.deleteMany({});
    await prisma.owner.deleteMany({ where: { id: ownerId } });
  });

  it('request pembayaran dengan idempotency key sama tidak membuat record ganda', async () => {
    const paymentInput = {
      idempotency_key: 'idempotency-test-key-001',
      amount: 100000,
      payment_method: 'CASH' as const,
      payment_date: new Date(),
    };

    // Panggil dua kali dengan input yang identik
    const result1 = await paymentsService.createPayment(billId, ownerId, paymentInput);
    const result2 = await paymentsService.createPayment(billId, ownerId, paymentInput);

    expect(result1.is_duplicate_request).toBe(false);
    expect(result2.is_duplicate_request).toBe(true);
    expect(result1.payment.id).toBe(result2.payment.id);

    // Verifikasi langsung ke database — harus hanya ada 1 record
    const allPayments = await prisma.payment.findMany({
      where: { idempotencyKey: 'idempotency-test-key-001' },
    });

    expect(allPayments).toHaveLength(1);
  });
});
