import { Pool, types, type PoolClient, type QueryResultRow } from 'pg';

// DATE -> 'YYYY-MM-DD' string (no timezone shifting), NUMERIC/BIGINT -> number,
// TIMESTAMPTZ -> ISO string (safe to pass from server to client components).
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1184, (v) => new Date(v).toISOString());

const g = globalThis as unknown as { __pgPool?: Pool };

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  const pool = new Pool({ connectionString, max: 10 });
  pool.on('error', (err) => {
    console.error(JSON.stringify({ level: 'error', msg: 'pg pool error', err: String(err) }));
  });
  return pool;
}

export function getPool(): Pool {
  if (!g.__pgPool) g.__pgPool = createPool();
  return g.__pgPool;
}

export type Queryable = { query: PoolClient['query'] };

export async function q<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
  client?: Queryable,
): Promise<T[]> {
  const runner = client ?? getPool();
  const res = await runner.query<T>(text, params);
  return res.rows;
}

export async function q1<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
  client?: Queryable,
): Promise<T | null> {
  const rows = await q<T>(text, params, client);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}
