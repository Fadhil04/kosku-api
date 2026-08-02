import { env } from './env';

export function getRedisConnection() {
  const url = new URL(env.REDIS_URL!);
  return {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    username: url.username || undefined,
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
  };
}