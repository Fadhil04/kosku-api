import { api } from '../helpers/request';
import { cleanDatabase, createTestOwner } from '../helpers/setup';
import { prisma } from '../../src/config/database';

beforeAll(async () => {
  await cleanDatabase();
  await createTestOwner();
});

afterAll(async () => {
  await cleanDatabase();
  await prisma.$disconnect();
});

describe('POST /api/v1/auth/register/owner', () => {
  it('berhasil register owner baru', async () => {
    const res = await api.post('/api/v1/auth/register/owner').send({
      email: 'baru@test.com',
      password: 'Password1!',
      full_name: 'Owner Baru',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('baru@test.com');
  });

  it('gagal jika email sudah terdaftar', async () => {
    await api.post('/api/v1/auth/register/owner').send({
      email: 'duplikat@test.com',
      password: 'Password1!',
      full_name: 'Test',
    });

    const res = await api.post('/api/v1/auth/register/owner').send({
      email: 'duplikat@test.com',
      password: 'Password1!',
      full_name: 'Test',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('AUTH_EMAIL_ALREADY_EXISTS');
  });

  it('gagal jika password lemah', async () => {
    const res = await api.post('/api/v1/auth/register/owner').send({
      email: 'test@test.com',
      password: 'lemah',
      full_name: 'Test',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('POST /api/v1/auth/login', () => {
  it('berhasil login dengan kredensial yang benar', async () => {
    const res = await api.post('/api/v1/auth/login').send({
      email: 'owner.test@kosku.dev',
      password: 'Password1!',
      role: 'owner',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.access_token).toBeDefined();
    expect(res.body.data.refresh_token).toBeDefined();
    expect(res.body.data.user.role).toBe('owner');
  });

  it('gagal dengan password salah', async () => {
    const res = await api.post('/api/v1/auth/login').send({
      email: 'owner.test@kosku.dev',
      password: 'SalahPassword1!',
      role: 'owner',
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_LOGIN_INVALID_CREDENTIALS');
  });

  it('gagal login sebagai role yang salah', async () => {
    const res = await api.post('/api/v1/auth/login').send({
      email: 'owner.test@kosku.dev',
      password: 'Password1!',
      role: 'tenant', // owner coba login sebagai tenant
    });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('berhasil ambil profil dengan token yang valid', async () => {
    const loginRes = await api.post('/api/v1/auth/login').send({
      email: 'owner.test@kosku.dev',
      password: 'Password1!',
      role: 'owner',
    });

    const token = loginRes.body.data.access_token;

    const res = await api
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('owner.test@kosku.dev');
    expect(res.body.data.role).toBe('owner');
  });

  it('gagal tanpa token', async () => {
    const res = await api.get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_TOKEN_MISSING');
  });

  it('gagal dengan token tidak valid', async () => {
    const res = await api
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer token.palsu.ini');

    expect(res.status).toBe(401);
  });
});