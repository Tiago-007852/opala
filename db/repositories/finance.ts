/** Lançamentos financeiros e KPIs de caixa (corrige o "receita de hoje" antigo). */

import type { FinancialRecord } from "../../src/types";
import { query, queryOne } from "../index";

const SELECT = `
  SELECT id, description, amount, type, category, occurred_at AS date
    FROM financial_records
`;

type FinancialRow = {
  id: string;
  description: string;
  amount: number;
  type: FinancialRecord["type"];
  category: string;
  date: Date;
};

function toRecord(row: FinancialRow): FinancialRecord {
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    type: row.type,
    category: row.category,
    date: row.date.toISOString(),
  };
}

export async function listFinancialRecords(limit = 200): Promise<FinancialRecord[]> {
  const rows = await query<FinancialRow>(`${SELECT} ORDER BY occurred_at DESC LIMIT $1`, [limit]);
  return rows.map(toRecord);
}

export interface NewFinancialRecord {
  description: string;
  amount: number;
  type: FinancialRecord["type"];
  category?: string;
  occurredAt?: string;
  orderId?: string | null;
  customerId?: string | null;
}

export async function createFinancialRecord(input: NewFinancialRecord): Promise<FinancialRecord> {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("O valor tem de ser maior que zero.");
  if (!input.description?.trim()) throw new Error("A descrição é obrigatória.");
  if (!["receita", "despesa"].includes(input.type)) throw new Error(`Tipo inválido: "${input.type}".`);

  const row = await queryOne<FinancialRow>(
    `INSERT INTO financial_records
       (id, description, amount, type, category, order_id, customer_id, occurred_at)
     VALUES ('f-' || nextval('financial_id_seq'), $1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, now()))
     RETURNING id, description, amount, type, category, occurred_at AS date`,
    [
      input.description.trim(),
      amount,
      input.type,
      input.category ?? "Geral",
      input.orderId ?? null,
      input.customerId ?? null,
      input.occurredAt ?? null,
    ]
  );
  if (!row) throw new Error("Não foi possível registar o lançamento.");
  return toRecord(row);
}

export interface CashSummary {
  revenue: number;
  expenses: number;
  net: number;
  records: number;
}

/** Receita/despesa de HOJE (antes somava todo o histórico e chamava-lhe "hoje"). */
export async function todayCash(): Promise<CashSummary> {
  const className = "v_today_cash";
  const row = await queryOne<CashSummary>(
    `SELECT revenue, expenses, revenue - expenses AS net, records FROM ${className}`
  );
  return {
    revenue: Number(row?.revenue ?? 0),
    expenses: Number(row?.expenses ?? 0),
    net: Number(row?.net ?? 0),
    records: Number(row?.records ?? 0),
  };
}

export interface DailyRevenue {
  day: string;
  revenue: number;
  expenses: number;
  net: number;
  records: number;
}

export async function dailyRevenue(days = 30): Promise<DailyRevenue[]> {
  const rows = await query<Omit<DailyRevenue, "day"> & { day: Date | string }>(
    `SELECT day, revenue, expenses, net, records
       FROM v_daily_revenue
      WHERE day >= current_date - ($1::int - 1)
      ORDER BY day DESC`,
    [days]
  );
  return rows.map((row) => ({
    ...row,
    day: row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day).slice(0, 10),
  }));
}
