import { api, loginAs } from '../helpers/request';
import {
  cleanDatabase,
  createTestOwner,
  createTestTenant,
  createTestProperty,
  createTestRoom,
  createTestContract,
} from '../helpers/setup';
import { prisma } from '../../src/config/database';

let ownerToken: string;
let billId: string;

beforeAll(async () => {
  await cleanDatabase();

  const owner = await createTestOwner();
  const tenant = await createTestTenant();
  const property = await createTestProperty(owner.id);
  const room = await createTestRoom(property.id);
  await createTestContract(room.id, tenant.id, owner.id, property.id);

  ownerToken = await loginAs('owner');

  const bills = await prisma.bill.findMany({ take: 1 });
  billId = bills[0].id;
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('POST /api/v1/bills/:billId/payments — Idempotency', () => {
  const idempotencyKey = `test-key-${Date.now()}`;

  const paymentPayload = {
    idempotency_key: idempotencyKey,
    amount: 1000000,
    payment_method: 'BANK_TRANSFER',
    payment_date: new Date().toISOString().split('T')[0],
  };

  it('request pertama: berhasil catat pembayaran', async () => {
    const res = await api
      .post(`/api/v1/bills/${billId}/payments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(paymentPayload);

    expect(res.status).toBe(201);
    expect(res.body.data.is_duplicate_request).toBe(false);
    expect(res.body.data.bill_status).toBe('PAID');
  });

  it('request kedua (duplikat): return data lama, tidak buat record baru', async () => {
    const res = await api
      .post(`/api/v1/bills/${billId}/payments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(paymentPayload);

    expect(res.status).toBe(201);
    expect(res.body.data.is_duplicate_request).toBe(true);

    // Verifikasi database: tetap hanya ada 1 payment record
    const payments = await prisma.payment.findMany({
      where: { billId },
    });
    expect(payments).toHaveLength(1);
  });

  it('gagal bayar bill yang sudah PAID dengan key baru', async () => {
    const res = await api
      .post(`/api/v1/bills/${billId}/payments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        idempotency_key: 'key-baru-berbeda',
        amount: 1000000,
        payment_method: 'CASH',
        payment_date: new Date().toISOString().split('T')[0],
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BILL_ALREADY_PAID');
  });
});