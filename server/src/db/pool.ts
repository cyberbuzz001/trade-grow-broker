import { Pool, PoolClient, QueryResultRow } from 'pg';


/**
 * PostgreSQL Connection Pool
 * P0-1 FIX: Replaces SQLite with PostgreSQL for multi-user concurrent load support.
 *
 * Pool sizing:
 *   - max: 20 connections for 100 concurrent users
 *   - idleTimeoutMillis: 30s — release idle connections
 *   - connectionTimeoutMillis: 5s — fail fast if pool exhausted
 */

function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    return new Pool({
      connectionString: databaseUrl,
      max: parseInt(process.env.PG_POOL_MAX || '20'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false
    });
  }

  // Individual env vars (local development)
  return new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    database: process.env.PG_DATABASE || 'stocksharp',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
    max: parseInt(process.env.PG_POOL_MAX || '20'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    ssl: false
  });
}

export const pool = createPool();

pool.on('error', (err) => {
  if (err.message?.includes('connection') || err.message?.includes('timeout') || (err as any).code === 'ECONNRESET') {
    // Suppress transient TCP idle timeout pool error
    return;
  }
  console.error('[PostgreSQL] Pool error:', err.message);
});

pool.on('connect', () => {
  // Connection acquired
});

/**
 * Execute a query and return all rows.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: any[]): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

/**
 * Execute a query and return the first row or null.
 */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(text: string, params?: any[]): Promise<T | null> {
  const result = await pool.query<T>(text, params);
  return result.rows[0] ?? null;
}

/**
 * Execute a query and return the row count affected.
 */
export async function execute(text: string, params?: any[]): Promise<number> {
  const result = await pool.query(text, params);
  return result.rowCount ?? 0;
}

/**
 * Run multiple queries in a single transaction.
 * Automatically rolls back on error.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Check if the database is reachable.
 */
export async function checkDatabaseHealth(): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    return { healthy: true, latencyMs: Date.now() - start };
  } catch (err: any) {
    return { healthy: false, latencyMs: Date.now() - start, error: err.message };
  }
}
