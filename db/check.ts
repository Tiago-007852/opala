/**
 * Diagnóstico rápido da ligação e do conteúdo do banco.
 *
 *   npm run db:check
 */

import { closePool, databaseUrl, describeDbError, healthCheck, query } from "./index";

const COUNTED_TABLES = [
  "menu_items",
  "restaurant_tables",
  "orders",
  "order_items",
  "bookings",
  "customers",
  "employees",
  "inventory_items",
  "financial_records",
  "coupons",
  "admin_users",
  "admin_sessions",
];

async function main() {
  if (!databaseUrl()) {
    console.error("✖ DATABASE_URL não está definida (ver .env.example).");
    process.exitCode = 1;
    return;
  }

  const health = await healthCheck();
  if (!health.ok) {
    console.error("✖ Sem ligação ao banco:", health.error);
    process.exitCode = 1;
    await closePool();
    return;
  }

  console.log("✓ Ligação OK");
  console.log(`  host:    ${new URL(databaseUrl()!).host}`);
  console.log(`  base:    ${health.database} · ${health.latencyMs} ms`);
  console.log(`  versão:  ${health.version?.split(",")[0]}`);

  try {
    const migrations = await query<{ version: string; applied_at: Date }>(
      "SELECT version, applied_at FROM schema_migrations ORDER BY version"
    );
    console.log(
      migrations.length > 0
        ? `\n  Migrações aplicadas: ${migrations.map((m) => m.version).join(", ")}`
        : "\n  ⚠ Nenhuma migração registada — corra npm run db:migrate"
    );
  } catch {
    console.error("\n  ⚠ Tabela schema_migrations inexistente — corra npm run db:migrate");
    await closePool();
    return;
  }

  console.log("\n  Registos:");
  for (const table of COUNTED_TABLES) {
    try {
      const rows = await query<{ total: number }>(`SELECT count(*)::int AS total FROM ${table}`);
      console.log(`    ${table.padEnd(20)} ${rows[0].total}`);
    } catch {
      console.log(`    ${table.padEnd(20)} (tabela ausente)`);
    }
  }

  try {
    const cash = await query<{ revenue: number; expenses: number; records: number }>(
      "SELECT revenue, expenses, records FROM v_today_cash"
    );
    const low = await query<{ name: string }>("SELECT name FROM v_low_stock ORDER BY name");
    console.log(`\n  Caixa de hoje: receita ${cash[0].revenue} · despesa ${cash[0].expenses}`);
    console.log(
      `  Estoque em alerta (${low.length}): ${low.map((l) => l.name).join(", ") || "nenhum"}`
    );
  } catch (error) {
    console.error("  ⚠ Views indisponíveis:", describeDbError(error));
  }

  const admins = await query<{ total: number }>("SELECT count(*)::int AS total FROM admin_users");
  if (admins[0].total === 0) {
    console.log("\n  ⚠ Nenhum administrador criado. Use: npm run admin:create -- --email <e-mail>");
  } else {
    console.log(`\n  Administradores: ${admins[0].total}`);
  }

  await closePool();
}

main();
