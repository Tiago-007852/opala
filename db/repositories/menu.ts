/**
 * Cardápio. As leituras devolvem exatamente o tipo `MenuItem` do front
 * (src/types.ts), para a API poder substituir o seed sem mudar o cliente.
 */

import type { MenuItem } from "../../src/types";
import { query, queryOne } from "../index";

export const MENU_CATEGORIES = [
  "pequeno-almoco", "entradas", "petiscos", "principais",
  "massas", "carnes", "peixes", "fastfood", "sobremesas", "bebidas",
] as const;

export const MENU_TAGS = [
  "Novo", "Mais vendido", "Promoção", "Vegano", "Sem Glúten", "Picante",
] as const;

const SELECT = `
  SELECT id, name, description, price, category, image,
         average_time AS "averageTime", ingredients, sauces, tags,
         extras, nutrition, is_active AS "isActive"
    FROM menu_items
`;

type MenuRow = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: MenuItem["category"];
  image: string;
  averageTime: number;
  ingredients: string[];
  sauces: string[];
  tags: MenuItem["tags"];
  extras: { name: string; price: number }[];
  nutrition: MenuItem["nutritionalValue"] | null;
  isActive: boolean;
};

/**
 * Arrays de tipos próprios (menu_tag[]) não têm parser no driver: o `pg`
 * devolve o literal do Postgres ("{Novo,\"Mais vendido\"}"). Sem isto, o front
 * recebia uma string em vez de uma lista.
 */
function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== "string") return [];

  const raw = value.trim();
  if (raw === "" || raw === "{}") return [];

  return raw
    .replace(/^\{/, "")
    .replace(/\}$/, "")
    .match(/("(?:[^"\\]|\\.)*"|[^,]+)/g)
    ?.map((part) => part.trim().replace(/^"(.*)"$/, "$1").replace(/\\"/g, '"')) as T[];
}

export function toMenuItem(row: MenuRow): MenuItem {
  const item: MenuItem = {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    category: row.category,
    image: row.image,
    ingredients: asArray<string>(row.ingredients),
    averageTime: row.averageTime ?? 0,
    tags: asArray<MenuItem["tags"][number]>(row.tags),
    extras: (row.extras ?? []).map((e) => ({ name: String(e.name), price: Number(e.price) })),
    sauces: asArray<string>(row.sauces),
  };
  if (row.nutrition) item.nutritionalValue = row.nutrition;
  return item;
}

export async function listMenuItems(options: { includeInactive?: boolean } = {}): Promise<MenuItem[]> {
  const where = options.includeInactive ? "" : " WHERE is_active";
  const rows = await query<MenuRow>(`${SELECT}${where} ORDER BY category, name`);
  return rows.map(toMenuItem);
}

export async function findMenuItem(id: string): Promise<MenuItem | null> {
  const row = await queryOne<MenuRow>(`${SELECT} WHERE id = $1`, [id]);
  return row ? toMenuItem(row) : null;
}

/** Mesmo formato de id do cardápio original: "carnes-picanha-na-tabua". */
export function makeMenuId(category: string, name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${category}-${slug || "item"}`;
}

export interface MenuItemInput {
  id?: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  image?: string;
  averageTime?: number;
  ingredients?: string[];
  tags?: string[];
  extras?: { name: string; price: number }[];
  sauces?: string[];
  nutritionalValue?: { calories: number; protein: number; carbs: number; fat: number };
  isActive?: boolean;
}

function assertCategory(category: string): asserts category is MenuItem["category"] {
  if (!(MENU_CATEGORIES as readonly string[]).includes(category)) {
    throw new Error(`Categoria inválida: "${category}". Válidas: ${MENU_CATEGORIES.join(", ")}.`);
  }
}

function cleanExtras(extras: MenuItemInput["extras"]) {
  if (!Array.isArray(extras)) return [];
  return extras
    .filter((e) => e && typeof e.name === "string")
    .map((e) => ({ name: e.name, price: Number(e.price) || 0 }));
}

function cleanTags(tags: MenuItemInput["tags"]) {
  if (!Array.isArray(tags)) return [];
  return tags.filter((t) => (MENU_TAGS as readonly string[]).includes(t));
}

export async function createMenuItem(input: MenuItemInput): Promise<MenuItem> {
  assertCategory(input.category);
  if (!input.name?.trim()) throw new Error("O nome do prato é obrigatório.");
  if (!Number.isFinite(Number(input.price)) || Number(input.price) < 0) {
    throw new Error("Preço inválido.");
  }

  const baseId = input.id?.trim() || makeMenuId(input.category, input.name.trim());
  const params = [
    input.name.trim(), input.description ?? "", Number(input.price), input.category,
    input.image ?? "", Number(input.averageTime ?? 0), input.ingredients ?? [],
    input.sauces ?? [], cleanTags(input.tags), JSON.stringify(cleanExtras(input.extras)),
    input.nutritionalValue ? JSON.stringify(input.nutritionalValue) : null,
    input.isActive ?? true,
  ];

  const insertSql = `
    INSERT INTO menu_items
      (id, name, description, price, category, image, average_time,
       ingredients, sauces, tags, extras, nutrition, is_active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13)
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;

  for (let attempt = 0; attempt < 2; attempt++) {
    const id = attempt === 0 ? baseId : `${baseId}-${Date.now().toString(36).slice(-4)}`;
    const created = await queryOne<{ id: string }>(insertSql, [id, ...params]);
    if (created) {
      const item = await findMenuItem(created.id);
      if (item) return item;
    }
  }

  throw new Error(`Já existe um prato com o id "${baseId}".`);
}

type UpdatePatch = Partial<Omit<MenuItemInput, "id">>;

const UPDATE_COLUMNS: Record<keyof UpdatePatch, string> = {
  name: "name",
  price: "price",
  category: "category",
  description: "description",
  image: "image",
  averageTime: "average_time",
  ingredients: "ingredients",
  tags: "tags",
  extras: "extras",
  sauces: "sauces",
  nutritionalValue: "nutrition",
  isActive: "is_active",
};

export async function updateMenuItem(id: string, patch: UpdatePatch): Promise<MenuItem | null> {
  if (patch.category !== undefined) assertCategory(String(patch.category));

  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of Object.entries(UPDATE_COLUMNS) as [keyof UpdatePatch, string][]) {
    const value = patch[key];
    if (value === undefined) continue;
    let prepared: unknown = value;
    if (key === "price") prepared = Number(value);
    if (key === "averageTime") prepared = Number(value);
    if (key === "tags") prepared = cleanTags(value as MenuItemInput["tags"]);
    if (key === "extras") prepared = JSON.stringify(cleanExtras(value as MenuItemInput["extras"]));
    if (key === "nutritionalValue") {
      prepared = value ? JSON.stringify(value) : null;
    }
    params.push(prepared);
    sets.push(`${column} = $${params.length}${column === "extras" || column === "nutrition" ? "::jsonb" : ""}`);
  }

  if (sets.length === 0) return findMenuItem(id);

  const row = await queryOne<{ id: string }>(
    `UPDATE menu_items SET ${sets.join(", ")} WHERE id = $${params.length + 1} RETURNING id`,
    [...params, id]
  );
  return row ? findMenuItem(row.id) : null;
}

/**
 * Remoção lógica (is_active = false): o histórico de pedidos e as fotos
 * continuam válidos e o admin pode reativar o prato.
 */
export async function deleteMenuItem(id: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    "UPDATE menu_items SET is_active = false WHERE id = $1 RETURNING id",
    [id]
  );
  return rows.length > 0;
}
