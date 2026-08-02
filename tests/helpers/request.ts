import request from 'supertest';
import app from '../../src/app';

export const api = request(app);

export async function loginAs(role: 'owner' | 'tenant'): Promise<string> {
  const email =
    role === 'owner' ? 'owner.test@kosku.dev' : 'tenant.test@kosku.dev';

  const res = await api
    .post('/api/v1/auth/login')
    .send({ email, password: 'Password1!', role });

  return res.body.data.access_token;
}