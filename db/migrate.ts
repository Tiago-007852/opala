/**
 * Aplica db/schema.sql ao banco apontado por DATABASE_URL.
 *
 *   npm run db:migrate
 *
 * O schema é idempotente, mas guardamos o checksum em `schema_migrations`
 * para registar o que já foi aplicado e detetar edições manuais.
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { closePool, databaseUrl, describeDbError, getPool } from "./index";

// Caminho relativo à raiz do projeto (os scripts correm sempre de lá).
const SCHEMA_FILE = path.join(process.cwd(), "db", "schema.sql");
const VERSION = "0002_contas_clientes";

async function main() {
  if (!databaseUrl()) {
    console.error("✖ DATABASE_URL não está definida.");
    console.error("  Crie um ficheiro .env (ver .env.example) e cole a connection string do Neon.");
    process.exitCode = 1;
    return;
  }

  const sql = await readFile(SCHEMA_FILE, "utf8");
  const checksum = createHash("sha256").update(sql).digest("hex").slice(0, 16);

  const client = await getPool().connect();
  try {
    console.log("→ A aplicar schema em", new URL(databaseUrl()!).host, "…");

    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version     text PRIMARY KEY,
        checksum    text NOT NULL,
        applied_at  timestamptz NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query<{ checksum: string; applied_at: Date }>(
      "SELECT checksum, applied_at FROM schema_migrations WHERE version = $1",
      [VERSION]
    );

    if (rows[0]?.checksum === checksum) {
      console.log(`✓ Schema já aplicado (${VERSION}, checksum ${checksum}). Nada a fazer.`);
    } else {
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)
           ON CONFLICT (version) DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = now()`,
          [VERSION, checksum]
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
      console.log(`✓ Schema aplicado (${VERSION}, checksum ${checksum}).`);
    }

    const { rows: tables } = await client.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    );
    const { rows: views } = await client.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM information_schema.views WHERE table_schema = 'public'`
    );
    console.log(`  ${tables[0].total} tabelas · ${views[0].total} views`);
    console.log("  Próximo passo: npm run db:seed");
  } catch (error) {
    console.error("✖ Falha ao aplicar o schema:", describeDbError(error));
    process.exitCode = 1;
  } finally {
    client.release();
    await closePool();
  }
}

main();
