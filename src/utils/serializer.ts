/**
 * Konversi object dari Prisma (camelCase) ke snake_case
 * agar konsisten dengan konvensi REST API yang digunakan frontend.
 *
 * Hanya key top-level dan nested 1 level yang dikonversi.
 * Array item juga di-serialize.
 */

type PlainObject = Record<string, unknown>;

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, (letter) => `_${letter.toLowerCase()}`)
    .replace(/^_/, '');
}

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === 'object') return serializeObject(value as PlainObject);
  return value;
}

function serializeObject(obj: PlainObject): PlainObject {
  const result: PlainObject = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = toSnakeCase(key);
    result[snakeKey] = serializeValue(value);
  }
  return result;
}

/**
 * Serialize satu record Prisma ke snake_case.
 * Gunakan di controller sebelum mengirim response.
 */
export function serialize<T extends PlainObject>(data: T): PlainObject {
  return serializeObject(data);
}

/**
 * Serialize array record Prisma ke snake_case.
 */
export function serializeArray<T extends PlainObject>(data: T[]): PlainObject[] {
  return data.map((item) => serializeObject(item));
}
