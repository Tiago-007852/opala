/**
 * Conexão com o banco (Neon / PostgreSQL) e helpers de query.
 *
 * Uso:
 *   import { query, queryOne, withTransaction } from "./db";
 *
 * O pool é criado de forma preguiçosa: importar este módulo NÃO falha quando
 * ainda não existe DATABASE_URL, o que permite correr a app em modo memória.
 */

// Carrega .env antes de qualquer leitura de process.env (scripts CLI e servidor).
import "dotenv/config";
import { Pool, types, type PoolClient, type QueryResultRow } from "pg";

// ---------------------------------------------------------------- parsers
// Sem isto o driver devolve numeric como string ("24500.00"), o que quebraria
// toda a matemática de dinheiro e os tipos do front.
types.setTypeParser(1700 /* numeric */, (v) => Number(v));
types.setTypeParser(20 /* int8  */, (v) => Number(v));
types.setTypeParser(1082 /* date  */, (v) => v);            // "2026-07-15"
types.setTypeParser(1083 /* time  */, (v) => v.slice(0, 5)); // "20:30"

let pool: Pool | null = null;

export function databaseUrl(): string | null {
  const url = process.env.DATABASE_URL?.trim();
  return url ? url : null;
}

/** `true` quando existe DATABASE_URL (a API deve usar o banco). */
export function isDatabaseConfigured(): boolean {
  return databaseUrl() !== null;
}

export function getPool(): Pool {
  if (pool) return pool;

  const connectionString = databaseUrl();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não configurada. Copie .env.example para .env e cole a connection string do Neon (ver db/README.md)."
    );
  }

  const usesSsl =
    /neon\.tech/.test(connectionString) ||
    /sslmode=(require|verify-full|verify-ca)/.test(connectionString);
  const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";

  pool = new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: "opala-api",
    ssl: usesSsl ? { rejectUnauthorized } : undefined,
  });

  // Um erro num cliente ocioso não pode derrubar o processo.
  pool.on("error", (err) => {
    console.error("[db] erro em cliente ocioso:", err.message);
  });

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await getPool().query<T>(sql, params as unknown[]);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/**
 * Cliente SQL: aceita tanto o pool como um cliente de transação.
 * Funções que possam correr dentro de uma transação recebem `db?: SqlClient`
 * para reutilizarem a MESMA conexão (evita deadlock e leituras fora do snapshot).
 */
export type SqlClient = Pool | PoolClient;

interface RawExecutor {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
}

export async function runQuery<T extends QueryResultRow = QueryResultRow>(
  db: SqlClient,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await (db as unknown as RawExecutor).query(sql, params);
  return result.rows as T[];
}

export async function runQueryOne<T extends QueryResultRow = QueryResultRow>(
  db: SqlClient,
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await runQuery<T>(db, sql, params);
  return rows[0] ?? null;
}

/** Executa `fn` dentro de uma transação; rollback em qualquer exceção. */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* conexão já perdida: o erro original é o que interessa */
    }
    throw error;
  } finally {
    client.release();
  }
}

/** Várias leituras no mesmo snapshot (estado consistente para /api/state). */
export function withReadTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withTransaction(async (client) => {
    await client.query("SET TRANSACTION READ ONLY, ISOLATION LEVEL REPEATABLE READ");
    return fn(client);
  });
}

export interface DatabaseHealth {
  ok: boolean;
  latencyMs: number;
  version?: string;
  database?: string;
  error?: string;
}

export async function healthCheck(): Promise<DatabaseHealth> {
  const startedAt = Date.now();
  try {
    const row = await queryOne<{ version: string; database: string }>(
      "SELECT version(), current_database() AS database"
    );
    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
      version: row?.version,
      database: row?.database,
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function closePool(): Promise<void> {
  if (!pool) return;
  const current = pool;
  pool = null;
  await current.end();
}

/** Mensagem de erro útil (constraint, tabela, detalhe) sem vazar SQL inteiro. */
export function describeDbError(error: unknown): string {
  const e = error as { message?: string; code?: string; constraint?: string; detail?: string };
  const parts = [e?.message ?? String(error)];
  if (e?.code) parts.push(`[${e.code}]`);
  if (e?.constraint) parts.push(`constraint=${e.constraint}`);
  if (e?.detail) parts.push(e.detail);
  return parts.join(" ");
}
