import { api } from '../helpers/request';
import { cleanDatabase, createTestProperty } from '../helpers/setup';
import { prisma } from '../../src/config/database';
import bcrypt from 'bcryptjs';

let owner1Token: string;
let owner2Token: string;
let owner1PropertyId: string;

beforeAll(async () => {
  await cleanDatabase();

  const passwordHash = await bcrypt.hash('Password1!', 12);

  const owner1 = await prisma.owner.create({
    data: {
      email: 'owner1@test.com',
      passwordHash,
      fullName: 'Owner Satu',
      isVerified: true,
    },
  });

  const owner2 = await prisma.owner.create({
    data: {
      email: 'owner2@test.com',
      passwordHash,
      fullName: 'Owner Dua',
      isVerified: true,
    },
  });

  const property = await createTestProperty(owner1.id);
  owner1PropertyId = property.id;

  const login1 = await api.post('/api/v1/auth/login').send({
    email: 'owner1@test.com',
    password: 'Password1!',
    role: 'owner',
  });
  owner1Token = login1.body.data.access_token;

  const login2 = await api.post('/api/v1/auth/login').send({
    email: 'owner2@test.com',
    password: 'Password1!',
    role: 'owner',
  });
  owner2Token = login2.body.data.access_token;
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('Multi-tenant Data Isolation', () => {
  it('owner 2 tidak bisa akses properti milik owner 1', async () => {
    const res = await api
      .get(`/api/v1/properties/${owner1PropertyId}`)
      .set('Authorization', `Bearer ${owner2Token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PROPERTY_NOT_FOUND');
  });

  it('owner 2 tidak bisa buat kamar di properti milik owner 1', async () => {
    const res = await api
      .post(`/api/v1/properties/${owner1PropertyId}/rooms`)
      .set('Authorization', `Bearer ${owner2Token}`)
      .send({
        room_number: 'HACK01',
        type: 'Standard',
        base_price: 1000000,
      });

    expect(res.status).toBe(404);
  });

  it('owner 2 tidak bisa lihat laporan properti milik owner 1', async () => {
    const res = await api
      .get(`/api/v1/reports/revenue`)
      .query({ property_id: owner1PropertyId })
      .set('Authorization', `Bearer ${owner2Token}`);

    expect(res.status).toBe(404);
  });

  it('owner 1 tetap bisa akses propertinya sendiri', async () => {
    const res = await api
      .get(`/api/v1/properties/${owner1PropertyId}`)
      .set('Authorization', `Bearer ${owner1Token}`);

    expect(res.status).toBe(200);
  });
});