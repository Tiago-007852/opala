import type { MenuItem } from "../types";
import { menuItems as seedMenu } from "../data/menu";

// ---------------------------------------------------------------
// FOTOS DOS PRATOS
//
// 1) Foto REAL de um prato: coloque o ficheiro em  src/assets/pratos/
//    com o nome igual ao id do prato (ver lista em src/data/menu.ts),
//    por exemplo:  src/assets/pratos/carnes-picanha-na-tabua.jpg
//    (aceita .jpg, .jpeg, .png e .webp). Aparece sozinha no site.
//
// 1b) Fotos de banco de imagens: mesma regra de nome, mas na pasta
//    src/assets/pratos-banco/ (aparecem com a nota "Imagem ilustrativa").
//
// 2) Sem foto própria, o site usa uma foto da categoria (as fotos
//    dos menus impressos, em src/assets/categorias/) com a nota
//    "Imagem ilustrativa".
// ---------------------------------------------------------------

const categoryFiles = import.meta.glob("../assets/categorias/*.jpg", {
  eager: true, query: "?url", import: "default",
}) as Record<string, string>;

const dishFiles = import.meta.glob("../assets/pratos/*.{jpg,jpeg,png,webp}", {
  eager: true, query: "?url", import: "default",
}) as Record<string, string>;

// Fotos de banco de imagens (Unsplash, Pexels...) — mostradas com a nota "Imagem ilustrativa".
const stockFiles = import.meta.glob("../assets/pratos-banco/*.{jpg,jpeg,png,webp}", {
  eager: true, query: "?url", import: "default",
}) as Record<string, string>;

// Mude para false para esconder a nota "Imagem ilustrativa" também nas fotos de banco de imagens.
export const SHOW_STOCK_LABEL = true;

const fileName = (path: string) => path.split("/").pop()!.replace(/\.[a-z]+$/i, "");

const byCategory: Record<string, string[]> = {};
for (const [path, url] of Object.entries(categoryFiles)) {
  const cat = fileName(path).replace(/-\d+$/, "");
  (byCategory[cat] ||= []).push(url);
}
for (const k of Object.keys(byCategory)) byCategory[k].sort();

const byDish: Record<string, string> = {};
for (const [path, url] of Object.entries(dishFiles)) byDish[fileName(path)] = url;

const byStock: Record<string, string> = {};
for (const [path, url] of Object.entries(stockFiles)) byStock[fileName(path)] = url;

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

// Para pratos cujo tipo coincide com uma das fotos disponíveis, usa-se essa foto.
// (nome da foto sem extensão, em src/assets/categorias/)
const bestMatch: Record<string, string> = {
  "fastfood-churrasco-de-frango-na-tabua": "carnes-2",
  "fastfood-churrasco-de-galinha-nacional": "carnes-2",
  "fastfood-meio-churrasco-de-galinha-nacional": "carnes-2",
  "fastfood-hamburguer-opala": "fastfood-2",
  "fastfood-hamburguer-prata": "fastfood-1",
  "fastfood-hamburguer-de-frango": "fastfood-1",
  "fastfood-doze-de-batata": "fastfood-1",
  "entradas-azeitonas-ao-alho": "entradas-1",
  "pequeno-almoco-cafe": "pequeno-almoco-2",
  "pequeno-almoco-sandes-mista-prata": "pequeno-almoco-3",
  "pequeno-almoco-sandes-mista-ouro": "pequeno-almoco-3",
  "pequeno-almoco-tosta-simples": "pequeno-almoco-3",
  "pequeno-almoco-tosta-composta": "pequeno-almoco-3",
  "sobremesas-salada-de-frutas": "entradas-2",
  "sobremesas-frutas-da-epoca": "entradas-3",
  "sobremesas-mousse": "sobremesas-2",
  "sobremesas-bolo-de-chocolate": "sobremesas-2",
  "sobremesas-panacotas-diversas": "sobremesas-1",
};
const byFile: Record<string, string> = {};
for (const [path, url] of Object.entries(categoryFiles)) byFile[fileName(path)] = url;

// posição de cada prato dentro da sua categoria (para alternar as fotos)
const position: Record<string, number> = {};
const counters: Record<string, number> = {};
for (const it of seedMenu) position[it.id] = counters[it.category] = (counters[it.category] ?? -1) + 1;

export type DishPhotoInfo = { src: string | null; real: boolean; fit: "cover" | "contain" };

export function getDishPhoto(item: Pick<MenuItem, "id" | "image" | "category">): DishPhotoInfo {
  if (item.image) return { src: item.image, real: true, fit: "cover" };
  if (byDish[item.id]) return { src: byDish[item.id], real: true, fit: "cover" };
  if (byStock[item.id]) return { src: byStock[item.id], real: !SHOW_STOCK_LABEL, fit: "cover" };
  if (bestMatch[item.id] && byFile[bestMatch[item.id]]) return { src: byFile[bestMatch[item.id]], real: false, fit: "contain" };
  const pool = byCategory[item.category];
  if (pool?.length) return { src: pool[(position[item.id] ?? hash(item.id)) % pool.length], real: false, fit: "contain" };
  return { src: null, real: false, fit: "contain" };
}

export const getCategoryCover = (category: string): string | null => byCategory[category]?.[0] ?? null;
