/** Cupões de desconto. A validação de desconto vive aqui (regra de negócio). */

import type { Coupon } from "../../src/types";
import { query, queryOne, runQueryOne, type SqlClient } from "../index";

const SELECT = `
  SELECT code, discount, type, active, min_spend AS "minSpend"
    FROM coupons
`;

type CouponRow = {
  code: string;
  discount: number;
  type: Coupon["type"];
  active: boolean;
  minSpend: number;
};

function toCoupon(row: CouponRow): Coupon {
  const coupon: Coupon = {
    code: row.code,
    discount: Number(row.discount),
    type: row.type,
    active: row.active,
  };
  if (Number(row.minSpend) > 0) coupon.minSpend = Number(row.minSpend);
  return coupon;
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export async function listCoupons(): Promise<Coupon[]> {
  const rows = await query<CouponRow>(`${SELECT} ORDER BY code`);
  return rows.map(toCoupon);
}

export async function findCoupon(code: string, db?: SqlClient): Promise<Coupon | null> {
  const sql = `${SELECT} WHERE code = $1`;
  const params = [normalizeCode(code)];
  const row = db
    ? await runQueryOne<CouponRow>(db, sql, params)
    : await queryOne<CouponRow>(sql, params);
  return row ? toCoupon(row) : null;
}

export async function createCoupon(input: {
  code: string;
  discount: number;
  type: Coupon["type"];
  active?: boolean;
  minSpend?: number;
}): Promise<Coupon> {
  const code = normalizeCode(input.code);
  if (code.length < 3) throw new Error("O código do cupão precisa de 3 caracteres no mínimo.");

  const discount = Number(input.discount);
  if (!Number.isFinite(discount) || discount <= 0) throw new Error("Desconto inválido.");
  if (input.type === "percentage" && discount > 100) {
    throw new Error("Desconto percentual não pode ser maior que 100%.");
  }

  const row = await queryOne<CouponRow>(
    `INSERT INTO coupons (code, discount, type, active, min_spend)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (code) DO UPDATE
       SET discount = EXCLUDED.discount,
           type = EXCLUDED.type,
           active = EXCLUDED.active,
           min_spend = EXCLUDED.min_spend
     RETURNING code, discount, type, active, min_spend AS "minSpend"`,
    [code, discount, input.type, input.active ?? true, Number(input.minSpend ?? 0)]
  );
  if (!row) throw new Error("Não foi possível criar o cupão.");
  return toCoupon(row);
}

export async function setCouponActive(code: string, active: boolean): Promise<boolean> {
  const rows = await query<{ code: string }>(
    "UPDATE coupons SET active = $2 WHERE code = $1 RETURNING code",
    [normalizeCode(code), active]
  );
  return rows.length > 0;
}

export interface CouponCheck {
  valid: boolean;
  reason?: string;
  discount: number;
  coupon?: Coupon;
}

/**
 * Calcula o desconto de um cupão sobre um subtotal.
 * Regras: tem de existir, estar ativo, atingir o consumo mínimo e não
 * exceder o próprio subtotal.
 */
export async function evaluateCoupon(
  code: string,
  subtotal: number,
  db?: SqlClient
): Promise<CouponCheck> {
  const coupon = await findCoupon(code, db);
  if (!coupon) return { valid: false, discount: 0, reason: "Cupão inexistente." };
  if (!coupon.active) return { valid: false, discount: 0, reason: "Cupão inativo." };

  const minSpend = coupon.minSpend ?? 0;
  if (subtotal < minSpend) {
    return {
      valid: false,
      discount: 0,
      reason: `Cupão exige consumo mínimo de Kz ${minSpend.toFixed(2)}.`,
    };
  }

  const raw =
    coupon.type === "percentage" ? (subtotal * Number(coupon.discount)) / 100 : Number(coupon.discount);

  return {
    valid: true,
    discount: Math.min(Math.round(raw * 100) / 100, subtotal),
    coupon,
  };
}
