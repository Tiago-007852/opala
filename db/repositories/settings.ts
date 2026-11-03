/** Configurações operacionais (linha única). Alimenta a aba "Configurações". */

import { query, queryOne } from "../index";

export interface RestaurantSettings {
  name: string;
  serviceFeePct: number;
  currency: string;
  phone: string;
  city: string;
  loyaltyPointsPer100: number;
  updatedAt: string;
}

const SELECT = `
  SELECT name, service_fee_pct AS "serviceFeePct", currency, phone, city,
         loyalty_points_per_100 AS "loyaltyPointsPer100", updated_at AS "updatedAt"
    FROM restaurant_settings WHERE id = 1
`;

export async function getSettings(): Promise<RestaurantSettings> {
  const row = await queryOne<RestaurantSettings & { updatedAt: Date }>(SELECT);
  if (row) return { ...row, updatedAt: row.updatedAt.toISOString() };

  // fallback: cria a linha por omissão
  await query("INSERT INTO restaurant_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING");
  const created = await queryOne<RestaurantSettings & { updatedAt: Date }>(SELECT);
  if (!created) throw new Error("Configurações do restaurante indisponíveis.");
  return { ...created, updatedAt: created.updatedAt.toISOString() };
}

export async function updateSettings(patch: {
  name?: string;
  serviceFeePct?: number;
  currency?: string;
  phone?: string;
  city?: string;
  loyaltyPointsPer100?: number;
}): Promise<RestaurantSettings> {
  if (patch.serviceFeePct !== undefined) {
    const fee = Number(patch.serviceFeePct);
    if (!Number.isFinite(fee) || fee < 0 || fee > 100) {
      throw new Error("Taxa de serviço tem de estar entre 0 e 100%.");
    }
  }

  const columns: Record<string, string> = {
    name: "name",
    serviceFeePct: "service_fee_pct",
    currency: "currency",
    phone: "phone",
    city: "city",
    loyaltyPointsPer100: "loyalty_points_per_100",
  };

  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of Object.entries(columns)) {
    const value = (patch as Record<string, unknown>)[key];
    if (value === undefined) continue;
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  }

  if (sets.length > 0) {
    // garante que a linha existe antes do UPDATE
    await query("INSERT INTO restaurant_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING");
    await query(`UPDATE restaurant_settings SET ${sets.join(", ")} WHERE id = 1`, params);
  }

  return getSettings();
}
