import { env } from './env';

const redisUrl = env.REDIS_TLS_URL || env.REDIS_URL;

export function getRedisConnection() {
  if (redisUrl) {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
      username: url.username || undefined,
      password: url.password || undefined,
      tls: url.protocol === 'rediss:' ? {} : undefined,
    };
  }

  if (!env.REDIS_HOST || !env.REDIS_PORT) {
    throw new Error(
      'Redis connection not configured: set REDIS_URL/REDIS_TLS_URL or REDIS_HOST and REDIS_PORT',
    );
  }

  return {
    host: env.REDIS_HOST,
    port: parseInt(env.REDIS_PORT, 10),
    password: env.REDIS_PASSWORD || undefined,
    tls: env.REDIS_TLS_URL ? {} : undefined,
  };
}
