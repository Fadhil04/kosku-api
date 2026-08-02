import { api, loginAs } from '../helpers/request';
import {
  cleanDatabase,
  createTestOwner,
  createTestTenant,
  createTestProperty,
  createTestRoom,
} from '../helpers/setup';
import { prisma } from '../../src/config/database';

let ownerToken: string;
let propertyId: string;
let roomId: string;
let tenantId: string;

beforeAll(async () => {
  await cleanDatabase();

  const owner = await createTestOwner();
  const tenant = await createTestTenant();
  const property = await createTestProperty(owner.id);
  const room = await createTestRoom(property.id);

  tenantId = tenant.id;
  propertyId = property.id;
  roomId = room.id;

  ownerToken = await loginAs('owner');
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('POST /api/v1/contracts', () => {
  it('berhasil buat kontrak dan generate bills otomatis', async () => {
    const startDate = new Date();
    // endDate: bulan terakhir yang berbeda dari startDate agar tepat 12 bulan
    // Misal start Juli 2026 → end Juni 2027 (hari terakhir bulan ke-11 setelah start)
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 11);
    endDate.setDate(28); // gunakan tanggal aman yang ada di semua bulan

    const res = await api
      .post('/api/v1/contracts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        room_id: roomId,
        tenant_id: tenantId,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        monthly_rent: 1000000,
        billing_date: 1,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.bills_generated).toBe(12);

    // Verifikasi langsung di database
    const billsInDb = await prisma.bill.findMany({
      where: { contractId: res.body.data.id },
    });
    expect(billsInDb).toHaveLength(12);

    // Verifikasi status room berubah
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    expect(room?.status).toBe('OCCUPIED');
  });

  it('gagal buat kontrak untuk kamar yang sedang OCCUPIED', async () => {
    // Buat tenant baru karena tenant sebelumnya sudah punya kontrak aktif
    const passwordHash = require('bcryptjs').hashSync('Password1!', 12);
    const anotherTenant = await prisma.tenant.create({
      data: {
        email: 'another@test.com',
        passwordHash,
        fullName: 'Another Tenant',
      },
    });

    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);

    const res = await api
      .post('/api/v1/contracts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        room_id: roomId, // room yang sudah OCCUPIED
        tenant_id: anotherTenant.id,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        monthly_rent: 1000000,
        billing_date: 1,
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('ROOM_NOT_AVAILABLE');
  });
});