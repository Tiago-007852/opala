/**
 * Seed base — catálogo e configuração do restaurante.
 *
 *   npm run db:seed
 *
 * Idempotente (ON CONFLICT DO NOTHING): pode correr em produção quantas vezes
 * quiser, nunca duplica nem sobrescreve o que o admin já alterou.
 *
 * O cardápio vem de src/data/menu.ts (fonte única). Pratos novos acrescentados
 * lá são importados; preços alterados na BD são preservados.
 */

import { menuItems as seedMenu } from "../src/data/menu";
import { closePool, databaseUrl, describeDbError, query } from "./index";

const TABLES: { id: string; capacity: number }[] = [
  { id: "01", capacity: 2 },
  { id: "02", capacity: 4 },
  { id: "03", capacity: 2 },
  { id: "04", capacity: 6 },
  { id: "05", capacity: 4 },
  { id: "06", capacity: 2 },
  { id: "07", capacity: 4 },
  { id: "08", capacity: 2 },
  { id: "09", capacity: 4 },
  { id: "10", capacity: 8 },
];

const INVENTORY = [
  { name: "Galinha do Campo (un)", quantity: 45, unit: "un", minLimit: 15, category: "Proteínas" },
  { name: "Lagosta do Kwanza (kg)", quantity: 12, unit: "kg", minLimit: 8, category: "Frutos do Mar" },
  { name: "Garoupa Fresca (kg)", quantity: 45, unit: "kg", minLimit: 20, category: "Frutos do Mar" },
  { name: "Óleo de Palma (l)", quantity: 8.5, unit: "l", minLimit: 10, category: "Laticínios e Especiarias" },
  { name: "Farinha de Mandioca (kg)", quantity: 25, unit: "kg", minLimit: 10, category: "Mercearia" },
  { name: "Bebida Kissangua (l)", quantity: 18, unit: "l", minLimit: 5, category: "Bebidas Alcoólicas" },
  { name: "Doce de Coco Cocada (kg)", quantity: 3.2, unit: "kg", minLimit: 5, category: "Confeitaria" },
];

const EMPLOYEES = [
  {
    id: "E-01",
    name: "João Neto",
    role: "Garçom Líder",
    photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    shift: "Noite (17:00 - 01:00)",
    phone: "+244 923 722 113",
    email: "joao.neto@opala.co.ao",
    permissions: ["Visualizar Pedidos", "Atualizar Status Mesa", "Lançar Descontos"],
  },
  {
    id: "E-02",
    name: "Paula Ndalu",
    role: "Garçonete Senior",
    photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
    shift: "Noite (17:00 - 01:00)",
    phone: "+244 923 123 456",
    email: "paula.ndalu@opala.co.ao",
    permissions: ["Visualizar Pedidos", "Atualizar Status Mesa"],
  },
  {
    id: "E-03",
    name: "Chef Rui de Sá",
    role: "Chef Executivo",
    photo: "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=150&auto=format&fit=crop&q=80",
    shift: "Tarde/Noite (14:00 - 23:00)",
    phone: "+244 912 191 000",
    email: "chef.rui@opala.co.ao",
    permissions: ["Gestão de Cardápio", "Gestão de Estoque", "Acesso Completo"],
  },
];

const COUPONS = [
  { code: "OPALA10", discount: 10, type: "percentage", minSpend: 15000 },
  { code: "VIPGOLD", discount: 5000, type: "fixed", minSpend: 30000 },
  { code: "BEMVINDO", discount: 15, type: "percentage", minSpend: 0 },
];

async function main() {
  if (!databaseUrl()) {
    console.error("✖ DATABASE_URL não está definida (ver .env.example).");
    process.exitCode = 1;
    return;
  }

  try {
    const exists = await query<{ ok: boolean }>(
      "SELECT to_regclass('public.menu_items') IS NOT NULL AS ok"
    );
    if (!exists[0]?.ok) {
      console.error("✖ As tabelas não existem. Corra primeiro: npm run db:migrate");
      process.exitCode = 1;
      return;
    }

    // Configurações (linha única)
    await query(
      `INSERT INTO restaurant_settings (id, name, service_fee_pct, currency, phone, city)
       VALUES (1, 'Restaurante Opala', 10, 'AOA', '+244 923 888 888', 'Ilha de Luanda, Luanda')
       ON CONFLICT (id) DO NOTHING`
    );

    // Cardápio
    let menuInserted = 0;
    for (const item of seedMenu) {
      const rows = await query<{ id: string }>(
        `INSERT INTO menu_items
           (id, name, description, price, category, image, average_time,
            ingredients, sauces, tags, extras, nutrition)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)
         ON CONFLICT (id) DO NOTHING
         RETURNING id`,
        [
          item.id,
          item.name,
          item.description ?? "",
          item.price,
          item.category,
          item.image ?? "",
          item.averageTime ?? 0,
          item.ingredients ?? [],
          item.sauces ?? [],
          item.tags ?? [],
          JSON.stringify(item.extras ?? []),
          item.nutritionalValue ? JSON.stringify(item.nutritionalValue) : null,
        ]
      );
      if (rows.length > 0) menuInserted++;
    }

    // Mesas
    let tablesInserted = 0;
    for (const table of TABLES) {
      const rows = await query<{ id: string }>(
        `INSERT INTO restaurant_tables (id, capacity) VALUES ($1, $2)
         ON CONFLICT (id) DO NOTHING RETURNING id`,
        [table.id, table.capacity]
      );
      if (rows.length > 0) tablesInserted++;
    }

    // Estoque (stock inicial escrito directamente porque ainda não há movimentos)
    let inventoryInserted = 0;
    for (const item of INVENTORY) {
      const rows = await query<{ id: string }>(
        `INSERT INTO inventory_items (name, quantity, unit, min_limit, category)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (name) DO NOTHING RETURNING id`,
        [item.name, item.quantity, item.unit, item.minLimit, item.category]
      );
      if (rows.length > 0) inventoryInserted++;
    }

    // Equipa
    let employeesInserted = 0;
    for (const employee of EMPLOYEES) {
      const rows = await query<{ id: string }>(
        `INSERT INTO employees (id, name, role, photo, shift, phone, email, permissions)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO NOTHING RETURNING id`,
        [employee.id, employee.name, employee.role, employee.photo, employee.shift,
         employee.phone, employee.email, employee.permissions]
      );
      if (rows.length > 0) employeesInserted++;
    }

    // Cupões
    let couponsInserted = 0;
    for (const coupon of COUPONS) {
      const rows = await query<{ code: string }>(
        `INSERT INTO coupons (code, discount, type, min_spend)
         VALUES ($1,$2,$3,$4) ON CONFLICT (code) DO NOTHING RETURNING code`,
        [coupon.code, coupon.discount, coupon.type, coupon.minSpend]
      );
      if (rows.length > 0) couponsInserted++;
    }

    console.log("✓ Seed base aplicado");
    console.log(`  cardápio:      +${menuInserted} (${seedMenu.length} no total em src/data/menu.ts)`);
    console.log(`  mesas:         +${tablesInserted}`);
    console.log(`  estoque:       +${inventoryInserted}`);
    console.log(`  funcionários:  +${employeesInserted}`);
    console.log(`  cupões:        +${couponsInserted}`);
    console.log("  Dados de demonstração (opcional): npm run db:seed:demo");
  } catch (error) {
    console.error("✖ Falha no seed:", describeDbError(error));
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main();
