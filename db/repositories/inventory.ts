/**
 * Estoque.
 *
 * REGRA: a quantidade nunca é escrita directamente. Todo o ajuste passa por
 * um movimento em `inventory_movements`, e o trigger da BD aplica o delta
 * (com piso em zero) e atualiza `updated_at`. Fica sempre o rasto de quem/o
 * quê mexeu no stock.
 */

import type { InventoryItem } from "../../src/types";
import { query, queryOne, withTransaction } from "../index";

const SELECT = `
  SELECT id, name, quantity, unit, min_limit AS "minLimit",
         category, updated_at AS "lastUpdated"
    FROM inventory_items
`;

type InventoryRow = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  minLimit: number;
  category: string;
  lastUpdated: Date;
};

function toItem(row: InventoryRow): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    quantity: Number(row.quantity),
    unit: row.unit,
    minLimit: Number(row.minLimit),
    category: row.category,
    lastUpdated: row.lastUpdated.toISOString(),
  };
}

export async function listInventory(): Promise<InventoryItem[]> {
  const rows = await query<InventoryRow>(`${SELECT} ORDER BY name`);
  return rows.map(toItem);
}

export async function listLowStock(): Promise<InventoryItem[]> {
  const rows = await query<InventoryRow>(`${SELECT} WHERE quantity <= min_limit ORDER BY name`);
  return rows.map(toItem);
}

export async function findInventoryItem(id: string): Promise<InventoryItem | null> {
  const row = await queryOne<InventoryRow>(`${SELECT} WHERE id = $1`, [id]);
  return row ? toItem(row) : null;
}

export interface InventoryPatch {
  name?: string;
  unit?: string;
  minLimit?: number;
  category?: string;
}

/** Ajusta dados cadastrais (nome, unidade, mínimo). Não mexe na quantidade. */
export async function updateInventoryItem(id: string, patch: InventoryPatch): Promise<InventoryItem | null> {
  const columns: Record<string, string> = {
    name: "name",
    unit: "unit",
    minLimit: "min_limit",
    category: "category",
  };

  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of Object.entries(columns)) {
    const value = (patch as Record<string, unknown>)[key];
    if (value === undefined) continue;
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  }
  if (sets.length === 0) return findInventoryItem(id);

  const row = await queryOne<InventoryRow>(
    `UPDATE inventory_items SET ${sets.join(", ")} WHERE id = $${params.length + 1}
     RETURNING id, name, quantity, unit, min_limit AS "minLimit",
               category, updated_at AS "lastUpdated"`,
    [...params, id]
  );
  return row ? toItem(row) : null;
}

/**
 * Aplica um movimento de stock (positivo = entrada, negativo = consumo).
 * `delta` nunca deixa o stock abaixo de zero — o trigger faz GREATEST(...,0).
 */
export async function adjustStock(input: {
  itemId: string;
  delta: number;
  reason?: string;
  orderId?: string | null;
}): Promise<InventoryItem | null> {
  const delta = Number(input.delta);
  if (!Number.isFinite(delta) || delta === 0) throw new Error("O movimento de stock não pode ser zero.");

  await query(
    `INSERT INTO inventory_movements (item_id, delta, reason, order_id)
     VALUES ($1, $2, $3, $4)`,
    [input.itemId, delta, input.reason ?? "", input.orderId ?? null]
  );

  return findInventoryItem(input.itemId);
}

export interface InventoryMovement {
  id: number;
  itemId: string;
  delta: number;
  reason: string;
  orderId: string | null;
  createdAt: string;
}

export async function listMovements(itemId?: string, limit = 100): Promise<InventoryMovement[]> {
  const rows = await query<{
    id: number;
    itemId: string;
    delta: number;
    reason: string;
    orderId: string | null;
    createdAt: Date;
  }>(
    `SELECT id, item_id AS "itemId", delta, reason, order_id AS "orderId", created_at AS "createdAt"
       FROM inventory_movements
      WHERE ($1::text IS NULL OR item_id = $1)
      ORDER BY created_at DESC
      LIMIT $2`,
    [itemId ?? null, limit]
  );

  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

/** Cria o item já com a quantidade inicial registada como movimento. */
export async function createInventoryItem(input: {
  id?: string;
  name: string;
  unit?: string;
  minLimit?: number;
  category?: string;
  initialQuantity?: number;
}): Promise<InventoryItem> {
  if (!input.name?.trim()) throw new Error("O nome do insumo é obrigatório.");

  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO inventory_items (id, name, unit, min_limit, category, quantity)
       VALUES (COALESCE($1, 'i' || nextval('inventory_id_seq')), $2, $3, $4, $5, 0)
       RETURNING id`,
      [input.id ?? null, input.name.trim(), input.unit ?? "un",
       Number(input.minLimit ?? 0), input.category ?? "Geral"]
    );
    const id = rows[0].id;

    const initial = Number(input.initialQuantity ?? 0);
    if (initial > 0) {
      await client.query(
        "INSERT INTO inventory_movements (item_id, delta, reason) VALUES ($1, $2, 'stock inicial')",
        [id, initial]
      );
    }

    const { rows: created } = await client.query<InventoryRow>(
      `SELECT id, name, quantity, unit, min_limit AS "minLimit",
              category, updated_at AS "lastUpdated"
         FROM inventory_items WHERE id = $1`,
      [id]
    );
    return toItem(created[0]);
  });
}
