/**
 * Pedidos.
 *
 * REGRA CENTRAL: os preços e totais são SEMPRE recalculados no servidor a
 * partir do cardápio na base de dados. O cliente não decide quanto paga —
 * antes, o `total` vinha do browser e podia ser adulterado.
 */

import type { CartItem, MenuItem, Order, OrderStatus } from "../../src/types";
import { query, queryOne, withTransaction } from "../index";
import { toMenuItem } from "./menu";
import { evaluateCoupon } from "./coupons";
import type { PoolClient } from "pg";

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export interface NewOrderItem {
  menuItemId: string;
  quantity: number;
  selectedExtras?: { name: string; price: number }[];
  selectedSauce?: string;
  notes?: string;
}

export interface NewOrderInput {
  items: NewOrderItem[];
  paymentMethod: Order["paymentMethod"];
  tableId?: string;
  customerName?: string;
  notes?: string;
  discount?: number;
  couponCode?: string;
}

const ORDER_SELECT = `
  SELECT id, table_id AS "tableId", customer_id AS "customerId",
         customer_name AS "customerName", subtotal, tax, discount, total,
         payment_method AS "paymentMethod", status, notes, created_at AS "createdAt"
    FROM orders
`;

type OrderRow = {
  id: string;
  tableId: string | null;
  customerId: string | null;
  customerName: string | null;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: Order["paymentMethod"];
  status: OrderStatus;
  notes: string;
  createdAt: Date;
};

type OrderItemRow = {
  orderId: string;
  unitPrice: number;
  quantity: number;
  extras: { name: string; price: number }[];
  selectedSauce: string;
  notes: string;
  menuItemId: string | null;
  menuId: string | null;
  menuName: string | null;
  menuDescription: string | null;
  menuPrice: number | null;
  menuCategory: MenuItem["category"] | null;
  menuImage: string | null;
  menuAverageTime: number | null;
  menuIngredients: string[] | null;
  menuSauces: string[] | null;
  menuTags: MenuItem["tags"] | null;
  menuExtras: { name: string; price: number }[] | null;
  menuNutrition: MenuItem["nutritionalValue"] | null;
  itemName: string;
};

const ITEM_SELECT = `
  SELECT oi.order_id AS "orderId",
         oi.unit_price AS "unitPrice",
         oi.quantity,
         oi.extras,
         oi.selected_sauce AS "selectedSauce",
         oi.notes,
         oi.menu_item_id AS "menuItemId",
         oi.item_name AS "itemName",
         m.id AS "menuId",
         m.name AS "menuName",
         m.description AS "menuDescription",
         m.price AS "menuPrice",
         m.category AS "menuCategory",
         m.image AS "menuImage",
         m.average_time AS "menuAverageTime",
         m.ingredients AS "menuIngredients",
         m.sauces AS "menuSauces",
         m.tags AS "menuTags",
         m.extras AS "menuExtras",
         m.nutrition AS "menuNutrition"
    FROM order_items oi
    LEFT JOIN menu_items m ON m.id = oi.menu_item_id
   WHERE oi.order_id = ANY($1::text[])
   ORDER BY oi.order_id, oi.position
`;

function toCartItem(row: OrderItemRow): CartItem {
  const menuItem: MenuItem = row.menuId
    ? toMenuItem({
        id: row.menuId,
        name: row.menuName ?? row.itemName,
        description: row.menuDescription ?? "",
        price: Number(row.menuPrice ?? row.unitPrice),
        category: row.menuCategory ?? "principais",
        image: row.menuImage ?? "",
        averageTime: Number(row.menuAverageTime ?? 0),
        ingredients: row.menuIngredients ?? [],
        sauces: row.menuSauces ?? [],
        tags: (row.menuTags ?? []) as MenuItem["tags"],
        extras: row.menuExtras ?? [],
        nutrition: row.menuNutrition,
        isActive: true,
      })
    : // prato apagado do cardápio: reconstrói a partir do snapshot histórico
      {
        id: row.menuItemId ?? "removido",
        name: row.itemName,
        description: "",
        price: Number(row.unitPrice),
        category: "principais",
        image: "",
        ingredients: [],
        averageTime: 0,
        tags: [],
        extras: [],
        sauces: [],
      };

  return {
    menuItem,
    quantity: row.quantity,
    selectedExtras: (row.extras ?? []).map((e) => ({ name: e.name, price: Number(e.price) })),
    selectedSauce: row.selectedSauce,
    notes: row.notes,
  };
}

function toOrder(row: OrderRow, items: CartItem[]): Order {
  return {
    id: row.id,
    tableId: row.tableId ?? "",
    items,
    subtotal: Number(row.subtotal),
    tax: Number(row.tax),
    discount: Number(row.discount),
    total: Number(row.total),
    paymentMethod: row.paymentMethod,
    status: row.status,
    timestamp: row.createdAt.toISOString(),
    notes: row.notes,
    customerName: row.customerName ?? undefined,
  };
}

export async function listOrders(limit = 200): Promise<Order[]> {
  const orders = await query<OrderRow>(`${ORDER_SELECT} ORDER BY created_at DESC LIMIT $1`, [limit]);
  if (orders.length === 0) return [];

  const items = await query<OrderItemRow>(ITEM_SELECT, [orders.map((o) => o.id)]);
  const byOrder = new Map<string, CartItem[]>();
  for (const row of items) {
    const list = byOrder.get(row.orderId) ?? [];
    list.push(toCartItem(row));
    byOrder.set(row.orderId, list);
  }

  return orders.map((order) => toOrder(order, byOrder.get(order.id) ?? []));
}

export async function findOrder(id: string): Promise<Order | null> {
  const row = await queryOne<OrderRow>(`${ORDER_SELECT} WHERE id = $1`, [id]);
  if (!row) return null;
  const items = await query<OrderItemRow>(ITEM_SELECT, [[row.id]]);
  return toOrder(row, items.map(toCartItem));
}

async function loadSettings(client: PoolClient) {
  const { rows } = await client.query<{ serviceFee: number; loyaltyPer100: number }>(
    `SELECT service_fee_pct AS "serviceFee", loyalty_points_per_100 AS "loyaltyPer100"
       FROM restaurant_settings WHERE id = 1`
  );
  return { serviceFee: Number(rows[0]?.serviceFee ?? 10), loyaltyPer100: Number(rows[0]?.loyaltyPer100 ?? 1) };
}

export async function createOrder(input: NewOrderInput): Promise<Order> {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error("O pedido precisa de pelo menos um item.");
  }
  const paymentMethods: Order["paymentMethod"][] = ["cartao", "transferência", "dinheiro", "online"];
  if (!paymentMethods.includes(input.paymentMethod)) {
    throw new Error(`Forma de pagamento inválida: "${input.paymentMethod}".`);
  }

  const orderId = await withTransaction(async (client) => {
    const settings = await loadSettings(client);

    // 1) preços oficiais, vindos da BD (nunca do cliente)
    const ids = [...new Set(input.items.map((i) => i.menuItemId))];
    const { rows: menuRows } = await client.query<{
      id: string; name: string; price: number; category: MenuItem["category"]; image: string;
      averageTime: number; ingredients: string[]; sauces: string[]; tags: MenuItem["tags"];
      extras: { name: string; price: number }[]; nutrition: MenuItem["nutritionalValue"] | null;
    }>(
      `SELECT id, name, price, category, image, average_time AS "averageTime",
              ingredients, sauces, tags, extras, nutrition
         FROM menu_items WHERE id = ANY($1::text[]) AND is_active`,
      [ids]
    );
    const menuById = new Map(menuRows.map((row) => [row.id, row]));

    const missing = ids.filter((id) => !menuById.has(id));
    if (missing.length > 0) {
      throw new Error(`Prato indisponível no cardápio: ${missing.join(", ")}.`);
    }

    // 2) linhas + subtotal
    const lines = input.items.map((item, index) => {
      const menuItem = menuById.get(item.menuItemId)!;
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error(`Quantidade inválida para "${menuItem.name}".`);
      }
      const extras = (item.selectedExtras ?? [])
        .filter((e) => e && typeof e.name === "string")
        .map((e) => ({ name: e.name, price: Number(e.price) || 0 }));
      const unitPrice = round2(Number(menuItem.price));
      const lineTotal = round2((unitPrice + extras.reduce((sum, e) => sum + e.price, 0)) * quantity);

      return {
        menuItemId: menuItem.id,
        itemName: menuItem.name,
        unitPrice,
        quantity,
        extras,
        selectedSauce: item.selectedSauce ?? "",
        notes: item.notes ?? "",
        lineTotal,
        position: index,
      };
    });

    const subtotal = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));
    const tax = round2((subtotal * settings.serviceFee) / 100);

    // 3) desconto: cupão tem prioridade; senão, desconto manual validado
    let discount = 0;
    if (input.couponCode) {
      // usa a MESMA conexão da transação (cupão e desconto no mesmo snapshot)
      const check = await evaluateCoupon(input.couponCode, subtotal, client);
      if (!check.valid) throw new Error(check.reason ?? "Cupão inválido.");
      discount = check.discount;
    } else if (input.discount) {
      discount = round2(Math.max(0, Number(input.discount)));
      if (!Number.isFinite(discount)) throw new Error("Desconto inválido.");
      if (discount > subtotal + tax) throw new Error("Desconto maior que o valor do pedido.");
    }

    const total = round2(subtotal + tax - discount);

    // 4) mesa
    let tableId: string | null = input.tableId?.trim() || null;
    if (tableId) {
      const { rows } = await client.query<{ id: string }>(
        "SELECT id FROM restaurant_tables WHERE id = $1",
        [tableId]
      );
      if (rows.length === 0) throw new Error(`Mesa "${tableId}" não existe.`);
    } else {
      tableId = null;
    }

    // 5) CRM
    let customerId: string | null = null;
    const customerName = input.customerName?.trim() || null;
    if (customerName) {
      const { rows: existing } = await client.query<{ id: string }>(
        "SELECT id FROM customers WHERE lower(name) = lower($1) LIMIT 1",
        [customerName]
      );
      const points = Math.floor((total / 100) * settings.loyaltyPer100);

      if (existing[0]) {
        customerId = existing[0].id;
        await client.query(
          `UPDATE customers
              SET total_spent = total_spent + $2,
                  visits = visits + 1,
                  loyalty_points = loyalty_points + $3
            WHERE id = $1`,
          [customerId, total, points]
        );
      } else {
        const email = `${customerName.toLowerCase().replace(/\s+/g, ".")}@cliente.co.ao`;
        const { rows: created } = await client.query<{ id: string }>(
          `INSERT INTO customers (id, name, email, total_spent, visits, favorite_dish, loyalty_points)
           VALUES ('c-' || gen_random_uuid(), $1, $2, $3, 1, $4, $5)
           RETURNING id`,
          [customerName, email, total, lines[0]?.itemName ?? "", points]
        );
        customerId = created[0]?.id ?? null;
      }
    }

    // 6) pedido + linhas
    const { rows: idRows } = await client.query<{ id: string }>(
      "SELECT 'OP-' || nextval('orders_id_seq') AS id"
    );
    const id = idRows[0].id;

    await client.query(
      `INSERT INTO orders
         (id, table_id, customer_id, customer_name, subtotal, tax, discount, total,
          payment_method, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'recebido',$10)`,
      [id, tableId, customerId, customerName, subtotal, tax, discount, total,
       input.paymentMethod, input.notes ?? ""]
    );

    for (const line of lines) {
      await client.query(
        `INSERT INTO order_items
           (order_id, menu_item_id, item_name, unit_price, quantity, extras,
            selected_sauce, notes, line_total, position)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)`,
        [id, line.menuItemId, line.itemName, line.unitPrice, line.quantity,
         JSON.stringify(line.extras), line.selectedSauce, line.notes,
         line.lineTotal, line.position]
      );
    }

    // 7) mesa ocupada
    if (tableId) {
      await client.query(
        `UPDATE restaurant_tables
            SET status = 'ocupada', active_order_id = $2
          WHERE id = $1`,
        [tableId, id]
      );
    }

    // 8) financeiro (a constraint exige amount > 0)
    if (total > 0) {
      await client.query(
        `INSERT INTO financial_records
           (id, description, amount, type, category, order_id, customer_id)
         VALUES ('f-' || nextval('financial_id_seq'), $1, $2, 'receita', 'Alimentação', $3, $4)`,
        [`Pedido ${id} - Mesa ${tableId ?? "Delivery"}`, total, id, customerId]
      );
    }

    return id;
  });

  const order = await findOrder(orderId);
  if (!order) throw new Error("Pedido criado mas não foi possível lê-lo de volta.");
  return order;
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order | null> {
  const valid: OrderStatus[] = ["recebido", "preparando", "pronto", "entregue", "cancelado"];
  if (!valid.includes(status)) throw new Error(`Estado de pedido inválido: "${status}".`);

  await withTransaction(async (client) => {
    const { rows } = await client.query<{ tableId: string | null }>(
      "SELECT table_id AS \"tableId\" FROM orders WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (rows.length === 0) throw new Error(`Pedido "${id}" não encontrado.`);

    await client.query("UPDATE orders SET status = $2 WHERE id = $1", [id, status]);

    const tableId = rows[0].tableId;
    if (!tableId) return;

    if (status === "entregue") {
      await client.query(
        "UPDATE restaurant_tables SET status = 'pagamento' WHERE id = $1 AND active_order_id = $2",
        [tableId, id]
      );
    } else if (status === "cancelado") {
      await client.query(
        "UPDATE restaurant_tables SET status = 'livre', active_order_id = NULL WHERE id = $1 AND active_order_id = $2",
        [tableId, id]
      );
    } else {
      await client.query(
        "UPDATE restaurant_tables SET status = 'ocupada' WHERE id = $1 AND active_order_id = $2",
        [tableId, id]
      );
    }
  });

  return findOrder(id);
}

/** Fecha a conta da mesa e liberta-a. */
export async function closeTable(tableId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE restaurant_tables SET status = 'livre', active_order_id = NULL
      WHERE id = $1 RETURNING id`,
    [tableId]
  );
  return rows.length > 0;
}
