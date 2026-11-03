/** Mesas do salão. O estado da mesa acompanha o pedido em curso. */

import type { Table } from "../../src/types";
import { query, queryOne } from "../index";

const SELECT = `
  SELECT id, status, capacity,
         active_order_id AS "activeOrderId",
         waiter_name     AS "waiterName"
    FROM restaurant_tables
`;

type TableRow = {
  id: string;
  status: Table["status"];
  capacity: number;
  activeOrderId: string | null;
  waiterName: string | null;
};

function toTable(row: TableRow): Table {
  const table: Table = { id: row.id, status: row.status, capacity: row.capacity };
  if (row.activeOrderId) table.activeOrderId = row.activeOrderId;
  if (row.waiterName) table.waiterName = row.waiterName;
  return table;
}

export async function listTables(): Promise<Table[]> {
  const rows = await query<TableRow>(`${SELECT} ORDER BY id`);
  return rows.map(toTable);
}

export async function findTable(id: string): Promise<Table | null> {
  const row = await queryOne<TableRow>(`${SELECT} WHERE id = $1`, [id]);
  return row ? toTable(row) : null;
}

export interface TablePatch {
  status?: Table["status"];
  capacity?: number;
  waiterName?: string | null;
  activeOrderId?: string | null;
}

export async function updateTable(id: string, patch: TablePatch): Promise<Table | null> {
  if (patch.capacity !== undefined && (!Number.isInteger(patch.capacity) || patch.capacity <= 0)) {
    throw new Error("Capacidade da mesa tem de ser um inteiro maior que zero.");
  }

  const sets: string[] = [];
  const params: unknown[] = [];

  if (patch.status !== undefined) { params.push(patch.status); sets.push(`status = $${params.length}`); }
  if (patch.capacity !== undefined) { params.push(patch.capacity); sets.push(`capacity = $${params.length}`); }
  if (patch.waiterName !== undefined) { params.push(patch.waiterName); sets.push(`waiter_name = $${params.length}`); }
  if (patch.activeOrderId !== undefined) { params.push(patch.activeOrderId); sets.push(`active_order_id = $${params.length}`); }

  // Libertar a mesa limpa sempre o pedido em curso.
  if (patch.status === "livre" && patch.activeOrderId === undefined) {
    sets.push("active_order_id = NULL");
  }

  if (sets.length === 0) return findTable(id);

  const row = await queryOne<{ id: string }>(
    `UPDATE restaurant_tables SET ${sets.join(", ")} WHERE id = $${params.length + 1} RETURNING id`,
    [...params, id]
  );
  return row ? findTable(row.id) : null;
}

/** Primeira mesa livre com lugares suficientes (usada pelas reservas). */
export async function findFreeTableFor(people: number): Promise<Table | null> {
  const row = await queryOne<TableRow>(
    `${SELECT} WHERE status = 'livre' AND capacity >= $1 ORDER BY capacity, id LIMIT 1`,
    [people]
  );
  return row ? toTable(row) : null;
}

export async function createTable(id: string, capacity: number): Promise<Table> {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new Error("Capacidade da mesa tem de ser um inteiro maior que zero.");
  }
  const row = await queryOne<{ id: string }>(
    "INSERT INTO restaurant_tables (id, capacity) VALUES ($1, $2) RETURNING id",
    [id, capacity]
  );
  const table = row ? await findTable(row.id) : null;
  if (!table) throw new Error(`Não foi possível criar a mesa ${id}.`);
  return table;
}
