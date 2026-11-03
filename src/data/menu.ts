import type { MenuItem } from "../types";

// ------------------------------------------------------------------
// CARDÁPIO OFICIAL DO RESTAURANTE OPALA
// Fonte única de dados: o servidor (server.ts) e o site (App.tsx)
// usam este ficheiro. Para mudar um preço ou prato, edite aqui.
// ------------------------------------------------------------------

type Category = MenuItem["category"];

const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const mk = (category: Category, name: string, price: number, description = ""): MenuItem => ({
  id: `${category}-${slug(name)}`,
  name,
  description,
  price,
  category,
  image: "",
  ingredients: [],
  averageTime: 0,
  tags: [],
  extras: [],
  sauces: [],
});

const pequenoAlmoco = (n: string, p: number, d = "") => mk("pequeno-almoco", n, p, d);
const entrada = (n: string, p: number, d = "") => mk("entradas", n, p, d);
const petisco = (n: string, p: number, d = "") => mk("petiscos", n, p, d);
const carne = (n: string, p: number, d = "") => mk("carnes", n, p, d);
const peixe = (n: string, p: number, d = "") => mk("peixes", n, p, d);
const massa = (n: string, p: number, d = "") => mk("massas", n, p, d);
const fast = (n: string, p: number, d = "") => mk("fastfood", n, p, d);
const sobremesa = (n: string, p: number, d = "") => mk("sobremesas", n, p, d);
const bebida = (n: string, p: number, tipo: string) => mk("bebidas", n, p, tipo);

export const menuItems: MenuItem[] = [
  // ---------------- PEQUENO-ALMOÇO ----------------
  pequenoAlmoco("Sopa de Feijão", 1000),
  pequenoAlmoco("Sopa de Legumes", 1000),
  pequenoAlmoco("Creme de Abóbora", 1200),
  pequenoAlmoco("Caldo Verde", 1000),
  pequenoAlmoco("Omelete Verde", 1000),
  pequenoAlmoco("Omelete Simples", 1500),
  pequenoAlmoco("Omelete Composto", 3000, "Ovo, queijo, fiambre, legumes, batata e pão"),
  pequenoAlmoco("Pequeno-Almoço Americano", 12000, "Bacon, chouriço, salada de frutas, salsichas, ovo mexido ou estrelado, pão e broa e chá de ananás"),
  pequenoAlmoco("Sandes Mista Prata", 1500, "Queijo e fiambre"),
  pequenoAlmoco("Sandes Mista Ouro", 2500, "Queijo, fiambre, chouriço e ovo estrelado"),
  pequenoAlmoco("Tosta Simples", 500),
  pequenoAlmoco("Tosta Composta", 1500),
  pequenoAlmoco("Chá Natural", 500),
  pequenoAlmoco("Leite", 1000),
  pequenoAlmoco("Galão", 1500),
  pequenoAlmoco("Chá", 1000),
  pequenoAlmoco("Café", 1000),

  // ---------------- ENTRADAS ----------------
  entrada("Patê de Atum", 4000),
  entrada("Patê de Frango", 4000),
  entrada("Azeitonas ao Alho", 3000),
  entrada("Ginguba Torrada", 500),
  entrada("Choco Frito", 4500),
  entrada("Pica-Pau", 4500),
  entrada("Conchinhas", 500),
  entrada("Rissóis", 500),
  entrada("Pastéis de Natas", 500),
  entrada("Trio de Frutos do Mar", 6000),
  entrada("Salada de Queijo", 4000),

  // ---------------- PETISCOS ----------------
  petisco("Azinhas no Espeto", 4500),
  petisco("Fitinhas", 4500),
  petisco("Vaquité", 5000),
  petisco("Franguité", 5000),
  petisco("Mine Misto", 7500),
  petisco("Choco Frito", 7000),
  petisco("Lulas", 7000),
  petisco("Mão de Vaca", 5000),
  petisco("Dobradinha", 5000),
  petisco("Petisco do Chefe", 10000),

  // ---------------- PRATOS DE CARNE ----------------
  carne("Lombo de Carne", 7000, "Lombo de porco com molho de cogumelos (batata frita, arroz, salada e ovo estrelado)"),
  carne("Bifana no Prato", 4000, "Bife, batata frita e ovo estrelado"),
  carne("Composto", 6500, "Bife, batata frita, ovo estrelado, arroz e salada"),
  carne("Prego no Prato", 4000, "Bife, batata frita e ovo estrelado"),
  carne("Vazia à Moda da Casa", 8500, "Molho da casa, batata frita e pão tostado"),
  carne("Bife Opaliano", 10500, "Arroz, purê de batata, bacon, queijo, fiambre, ovo estrelado e molho demi-glacé"),
  carne("Grelhada Mista Opala", 25000, "Batata frita, salada e ovo estrelado"),
  carne("Parrilhada de Carnes", 35000, "Entrecosto, entremeada, costeleta de porco, pojadouro, linguiça ou chouriço, frango, legumes grelhados e ananás. Guarnições: salada verde, batata frita, feijão preto e arroz"),
  carne("Trio de Carnes do Chefe", 20000, "Entrecosto na grelha, bisteca de porco e picanha. Guarnições: legumes no sauté ou salada da horta, batata frita, arroz e feijão preto"),
  carne("Picanha na Tábua", 15000, "Picanha, arroz branco, farofa, feijão preto e molho vinagrete, ananás grelhado, banana-pão e couves fritas"),
  carne("Maminha Grelhada", 10000, "Molho demi-glace, batata frita, legumes salteados e arroz"),
  carne("T-Bone", 8500, "Arroz do chefe, batata frita, molho demi-glacé e esparregado de espinafre ou couves"),
  carne("Bife à Portuguesa", 8500, "Arroz do chefe, batata frita salteada, bife, ovo estrelado e presunto"),

  // ---------------- PRATOS DE PEIXE ----------------
  peixe("Polvo à Lagareiro", 8500, "Batata, legumes salteados, molho de alho e pimenta"),
  peixe("Bacalhau à Lagareiro", 10500, "Batata aos murros, legumes salteados, molho de alho e pimenta"),
  peixe("Mix de Mariscos", 6500, "Acompanhado com batata cozida, legumes à camponesa, quitutes e molho de alho"),

  // ---------------- PRATOS DE MASSA ----------------
  massa("Massa à Bolonhesa", 7500, "Molho à bolonhesa e queijo parmesão ralado ou mozarela"),
  massa("Massa à Carbonara", 9000, "Bacon, molho branco e queijo parmesão ou mozarela ralado"),
  massa("Linguine Negro", 13000, "Com frutos do mar e queijo parmesão ralado ou mozarela"),

  // ---------------- FAST-FOOD ----------------
  fast("Hambúrguer Prata", 2000, "Fiambre, ovo estrelado, batata palha, salada e molho da casa"),
  fast("Hambúrguer Opala", 2800, "Queijo, fiambre, bacon, batata palha, salada, creme de abacate e ananás grelhado"),
  fast("Hambúrguer de Frango", 1800, "Fiambre, queijo, ovo, batata palha, salada, molho da casa e chouriço"),
  fast("Cachorro Quente Prata", 1500, "Salsicha, ovo estrelado, batata palha e molhos"),
  fast("Cachorro Quente Ouro Opala", 2000, "Salsicha, ovo estrelado, batata palha, queijo e bacon"),
  fast("Fahita Mista", 3000, "Mix de carne de vaca, frango, queijo, legumes e molhos"),
  fast("Fahita de Frango", 2000, "Frango, queijo, legumes e molhos"),
  // TODO: falta o preço da Fahita de Carne (carne de vaca, queijo, legumes e molhos)
  // fast("Fahita de Carne", ???, "Carne de vaca, queijo, legumes e molhos"),
  fast("Churrasco de Frango na Tábua", 11500, "Frango, batata frita, salada da horta e molho vinagrete"),
  fast("Churrasco de Galinha Nacional", 15000, "Galinha nacional, batata frita, salada, molho vinagrete e arroz"),
  fast("Meio Churrasco de Galinha Nacional", 7500, "Meia galinha nacional, batata frita, salada, molho vinagrete e arroz"),
  fast("Doze de Batata", 1000, "Batata frita"),

  // ---------------- SOBREMESAS ----------------
  sobremesa("Panacotas Diversas", 3500),
  sobremesa("Iogurte com Granolas", 1000),
  sobremesa("Salada de Frutas", 3000),
  sobremesa("Bolo de Ginguba", 1500),
  sobremesa("Bolo de Chocolate", 1500),
  sobremesa("Peti Gatô", 3500),
  sobremesa("Frutas da Época", 500),
  sobremesa("Mousse", 2000),
  sobremesa("Pudim", 1500),

  // ---------------- BEBIDAS ----------------
  // Cervejas (Cuca, Eka, Doppel e Booster aparecem só aqui, sem duplicar)
  bebida("Cuca", 450, "Cerveja"),
  bebida("Eka", 450, "Cerveja"),
  bebida("Doppel", 450, "Cerveja"),
  bebida("Booster Garrafa Cidra", 400, "Cerveja"),
  bebida("Booster Manga", 400, "Cerveja"),
  bebida("Booster Morango", 1000, "Cerveja"),
  // Outras bebidas alcoólicas
  bebida("Smirnoff Preta", 1000, "Bebida alcoólica"),
  bebida("Smirnoff Branca", 1000, "Bebida alcoólica"),
  bebida("Fino Longo Drink", 600, "Bebida alcoólica"),
  bebida("Fino Taça", 1200, "Bebida alcoólica"),
  bebida("Scap", 1000, "Bebida alcoólica"),
  bebida("Gin Rosé", 1000, "Bebida alcoólica"),
  bebida("Welwitschia Guaraná", 800, "Bebida alcoólica"),
  bebida("Welwitschia Normal", 800, "Bebida alcoólica"),
  bebida("Gin Tónico", 4500, "Bebida alcoólica"),
  bebida("Sangria", 5000, "Bebida alcoólica"),
  bebida("Vody", 1500, "Bebida alcoólica"),
  // Vinhos
  bebida("JP", 8500, "Vinho"),
  bebida("Mariana", 16000, "Vinho"),
  bebida("Silk e Spice", 18000, "Vinho"),
  // Refrigerantes
  bebida("Coca-Cola Lata", 1000, "Refrigerante"),
  bebida("Fanta Lata", 1000, "Refrigerante"),
  bebida("Sprite Lata", 800, "Refrigerante"),
  bebida("Refrigerante Nacional", 400, "Refrigerante"),
  bebida("Sumol", 1000, "Refrigerante"),
  bebida("Compal", 800, "Refrigerante"),
  bebida("Nutry", 800, "Refrigerante"),
  // Sumos e águas
  bebida("Sumos Naturais", 1500, "Sumo natural"),
  bebida("Água", 300, "Água"),
  bebida("Água com Gás", 350, "Água"),
];
