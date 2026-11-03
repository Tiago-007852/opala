/** CRM / fidelidade. Os saldos de total_spent/visits/points são mantidos pelos pedidos. */

import type { Customer } from "../../src/types";
import { query, queryOne } from "../index";

const SELECT = `
  SELECT id, name, email, phone,
         total_spent AS "totalSpent",
         visits,
         favorite_dish AS "favoriteDish",
         birthday,
         loyalty_points AS "loyaltyPoints"
    FROM customers
`;

export async function listCustomers(limit = 500): Promise<Customer[]> {
  return query<Customer>(`${SELECT} ORDER BY name LIMIT $1`, [limit]);
}

export async function findCustomer(id: string): Promise<Customer | null> {
  return queryOne<Customer>(`${SELECT} WHERE id = $1`, [id]);
}

export async function findCustomerByName(name: string): Promise<Customer | null> {
  return queryOne<Customer>(`${SELECT} WHERE lower(name) = lower($1) LIMIT 1`, [name.trim()]);
}

export async function createCustomer(input: {
  name: string;
  email?: string;
  phone?: string;
  favoriteDish?: string;
  birthday?: string;
}): Promise<Customer> {
  if (!input.name?.trim()) throw new Error("O nome do cliente é obrigatório.");

  const row = await queryOne<Customer>(
    `INSERT INTO customers (id, name, email, phone, favorite_dish, birthday)
     VALUES ('c-' || gen_random_uuid(), $1, $2, $3, $4, $5)
     RETURNING id, name, email, phone, total_spent AS "totalSpent", visits,
               favorite_dish AS "favoriteDish", birthday, loyalty_points AS "loyaltyPoints"`,
    [
      input.name.trim(),
      input.email ?? "",
      input.phone ?? "",
      input.favoriteDish ?? "",
      input.birthday ?? "",
    ]
  );
  if (!row) throw new Error("Não foi possível criar o cliente.");
  return row;
}

export async function updateCustomer(
  id: string,
  patch: Partial<Pick<Customer, "name" | "email" | "phone" | "favoriteDish" | "birthday">>
): Promise<Customer | null> {
  const columns: Record<string, string> = {
    name: "name",
    email: "email",
    phone: "phone",
    favoriteDish: "favorite_dish",
    birthday: "birthday",
  };

  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of Object.entries(columns)) {
    const value = (patch as Record<string, unknown>)[key];
    if (value === undefined) continue;
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  }
  if (sets.length === 0) return findCustomer(id);

  return queryOne<Customer>(
    `UPDATE customers SET ${sets.join(", ")} WHERE id = $${params.length + 1}
     RETURNING id, name, email, phone, total_spent AS "totalSpent", visits,
               favorite_dish AS "favoriteDish", birthday, loyalty_points AS "loyaltyPoints"`,
    [...params, id]
  );
}

export interface CustomerStats {
  id: string;
  name: string;
  ordersCount: number;
  avgTicket: number;
  lastOrderAt: string | null;
}

export async function customerStats(limit = 50): Promise<CustomerStats[]> {
  const rows = await query<Omit<CustomerStats, "lastOrderAt"> & { lastOrderAt: Date | null }>(
    `SELECT id, name, orders_count AS "ordersCount", avg_ticket AS "avgTicket", last_order_at AS "lastOrderAt"
       FROM v_customer_stats
      ORDER BY total_spent DESC
      LIMIT $1`,
    [limit]
  );
  return rows.map((row) => ({
    ...row,
    avgTicket: Number(row.avgTicket),
    lastOrderAt: row.lastOrderAt ? row.lastOrderAt.toISOString() : null,
  }));
}
