import express from "express";
import path from "path";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { menuItems as seedMenu } from "./src/data/menu";
import { isDatabaseConfigured, query } from "./db";
import { loadState } from "./db/state";
import {
  createMenuItem,
  deleteMenuItem,
  updateMenuItem,
} from "./db/repositories/menu";
import { createOrder, updateOrderStatus } from "./db/repositories/orders";
import { updateTable } from "./db/repositories/tables";
import { createBooking, updateBookingStatus } from "./db/repositories/bookings";
import { createEmployee, deleteEmployee, updateEmployee } from "./db/repositories/employees";
import { adjustStock, findInventoryItem, updateInventoryItem } from "./db/repositories/inventory";
import { createCoupon } from "./db/repositories/coupons";
import { listOrders } from "./db/repositories/orders";
import { listLowStock } from "./db/repositories/inventory";
import { todayCash } from "./db/repositories/finance";
import { listCustomers } from "./db/repositories/customers";
import { listCoupons } from "./db/repositories/coupons";
import { writeAudit } from "./db/repositories/admin";
import { attachAdminSession, registerAuthRoutes, requireAdmin } from "./server/auth";
import { attachCustomerSession, registerCustomerRoutes } from "./server/customer-auth";

dotenv.config();

const app = express();
// Atrás do proxy do Vercel (e de qualquer proxy) os IPs vêm em x-forwarded-for.
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));

const PORT = Number(process.env.PORT ?? 3000);

// Initialize Google GenAI
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// --------------------------------------------------------
// Helpers
// --------------------------------------------------------

/** Express 4 não apanha rejeições de handlers async: este wrapper trata disso. */
const ah =
  (handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    handler(req, res).catch(next);
  };

const PG_VALIDATION_CODES = new Set(["23514", "23503", "22P02", "22001", "23502", "22007", "22008"]);

/** Converte erros do banco/validações em respostas HTTP claras. */
function fail(res: Response, error: unknown, fallback = "Não foi possível concluir a operação.") {
  const e = error as { code?: string; message?: string; constraint?: string };
  const message = e?.message ?? String(error);

  if (e?.code === "23505") {
    return res.status(409).json({ error: "Já existe um registo com estes dados.", detail: message });
  }
  if (e?.code && PG_VALIDATION_CODES.has(e.code)) {
    return res.status(400).json({ error: "Dados inválidos para esta operação.", detail: message });
  }
  if (!e?.code && /DATABASE_URL|password|scrypt/i.test(message)) {
    console.error("[api] erro inesperado:", message);
    return res.status(500).json({ error: fallback });
  }
  if (!e?.code) {
    // Erros de validação lançados pelos repositórios (mensagens em português).
    return res.status(400).json({ error: message });
  }

  console.error("[api] erro do banco:", message, e.constraint ?? "");
  return res.status(500).json({ error: fallback });
}

const requireDb: RequestHandler = (_req, res, next) => {
  if (!isDatabaseConfigured()) {
    return res
      .status(503)
      .json({ error: "Base de dados não configurada (DATABASE_URL em falta)." });
  }
  next();
};

const audit = (req: Request, action: string, entity: string, entityId: string, metadata?: Record<string, unknown>) =>
  writeAudit({
    adminUserId: req.admin?.user.id ?? null,
    action,
    entity,
    entityId,
    metadata,
  }).catch(() => undefined);

// --------------------------------------------------------
// AUTENTICAÇÃO (pública: login/logout/me)
// --------------------------------------------------------

app.use(attachAdminSession);
app.use(attachCustomerSession);
registerAuthRoutes(app);
registerCustomerRoutes(app);

// --------------------------------------------------------
// REST API
// --------------------------------------------------------

/**
 * Estado do sistema.
 *  - sem sessão: apenas o que o portal do cliente precisa (cardápio, mesas, pedidos
 *    para acompanhamento). Funcionários, estoque, financeiro, CRM e cupões são
 *    dados de gestão e ficam escondidos.
 *  - com sessão de admin: o estado completo.
 */
app.get(
  "/api/state",
  ah(async (req, res) => {
    if (!isDatabaseConfigured()) {
      return res.json({
        menuItems: seedMenu,
        orders: [],
        tables: [],
        bookings: [],
        employees: [],
        inventory: [],
        financialRecords: [],
        customers: [],
        coupons: [],
      });
    }

    const state = await loadState();
    res.set("Cache-Control", "no-store");

    if (!req.admin) {
      return res.json({
        menuItems: state.menuItems,
        tables: state.tables,
        orders: state.orders,
        bookings: [],
        employees: [],
        inventory: [],
        financialRecords: [],
        customers: [],
        coupons: [],
      });
    }

    res.json(state);
  })
);

// ---- Cardápio (admin) ----

app.post(
  "/api/menu",
  requireAdmin,
  ah(async (req, res) => {
    const item = await createMenuItem(req.body ?? {});
    await audit(req, "menu_create", "menu_item", item.id);
    res.status(201).json(item);
  })
);

app.put(
  "/api/menu/:id",
  requireAdmin,
  ah(async (req, res) => {
    const item = await updateMenuItem(req.params.id, req.body ?? {});
    if (!item) return res.status(404).json({ error: "Prato não encontrado" });
    await audit(req, "menu_update", "menu_item", item.id);
    res.json(item);
  })
);

app.delete(
  "/api/menu/:id",
  requireAdmin,
  ah(async (req, res) => {
    const ok = await deleteMenuItem(req.params.id);
    if (!ok) return res.status(404).json({ error: "Prato não encontrado" });
    await audit(req, "menu_delete", "menu_item", req.params.id);
    res.json({ success: true });
  })
);

// ---- Pedidos ----

/** Público: é o cliente que faz o pedido. Os totais são recalculados no servidor. */
app.post(
  "/api/orders",
  requireDb,
  ah(async (req, res) => {
    const body = req.body ?? {};
    const rawItems: unknown[] = Array.isArray(body.items) ? body.items : [];

    const items = rawItems
      .map((raw) => {
        const item = raw as {
          menuItem?: { id?: string };
          menuItemId?: string;
          quantity?: number;
          selectedExtras?: { name: string; price: number }[];
          selectedSauce?: string;
          notes?: string;
        };
        return {
          menuItemId: String(item?.menuItem?.id ?? item?.menuItemId ?? ""),
          quantity: Number(item?.quantity ?? 0),
          selectedExtras: Array.isArray(item?.selectedExtras) ? item.selectedExtras : [],
          selectedSauce: item?.selectedSauce ?? "",
          notes: item?.notes ?? "",
        };
      })
      .filter((item) => item.menuItemId !== "");

    if (items.length === 0) {
      return res.status(400).json({ error: "O pedido precisa de pelo menos um item." });
    }

    const order = await createOrder({
      items,
      paymentMethod: body.paymentMethod,
      tableId: body.tableId ? String(body.tableId) : undefined,
      customerName: body.customerName ? String(body.customerName) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
      couponCode: body.couponCode ? String(body.couponCode) : body.coupon?.code,
    });

    res.status(201).json(order);
  })
);

app.put(
  "/api/orders/:id",
  requireAdmin,
  ah(async (req, res) => {
    const status = req.body?.status;
    const allowed = ["recebido", "preparando", "pronto", "entregue", "cancelado"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Estado inválido. Use: ${allowed.join(", ")}.` });
    }
    const order = await updateOrderStatus(req.params.id, status);
    if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
    await audit(req, "order_status", "order", order.id, { status });
    res.json(order);
  })
);

// ---- Mesas (admin) ----

app.put(
  "/api/tables/:id",
  requireAdmin,
  ah(async (req, res) => {
    const { status, capacity, waiterName, activeOrderId } = req.body ?? {};
    const allowed = ["livre", "ocupada", "reservada", "pagamento"];
    if (status !== undefined && !allowed.includes(status)) {
      return res.status(400).json({ error: `Estado inválido. Use: ${allowed.join(", ")}.` });
    }

    const table = await updateTable(req.params.id, { status, capacity, waiterName, activeOrderId });
    if (!table) return res.status(404).json({ error: "Mesa não encontrada" });
    await audit(req, "table_update", "restaurant_table", table.id, { status });
    res.json(table);
  })
);

// ---- Reservas ----

/** Público: formulário de reserva do site. */
app.post(
  "/api/bookings",
  requireDb,
  ah(async (req, res) => {
    const body = req.body ?? {};
    const booking = await createBooking({
      name: String(body.name ?? ""),
      phone: body.phone ? String(body.phone) : undefined,
      email: body.email ? String(body.email) : undefined,
      date: String(body.date ?? ""),
      time: String(body.time ?? ""),
      people: Number(body.people ?? 0),
      notes: body.notes ? String(body.notes) : undefined,
      // vem da sessão, nunca do corpo do pedido
      customerId: req.customer?.account.customerId ?? null,
    });
    res.status(201).json(booking);
  })
);

app.put(
  "/api/bookings/:id",
  requireAdmin,
  ah(async (req, res) => {
    const status = req.body?.status;
    const allowed = ["confirmado", "cancelado", "concluido"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Estado inválido. Use: ${allowed.join(", ")}.` });
    }
    const booking = await updateBookingStatus(req.params.id, status);
    if (!booking) return res.status(404).json({ error: "Reserva não encontrada" });
    await audit(req, "booking_status", "booking", booking.id, { status });
    res.json(booking);
  })
);

// ---- Estoque (admin) ----

/**
 * A quantidade NUNCA é escrita directamente: passa a ser um movimento de stock,
 * para ficar registado quem/quando/o quê e para o trigger garantir o piso zero.
 */
app.put(
  "/api/inventory/:id",
  requireAdmin,
  ah(async (req, res) => {
    const body = req.body ?? {};
    const current = await findInventoryItem(req.params.id);
    if (!current) return res.status(404).json({ error: "Item de estoque não encontrado" });

    if (body.name !== undefined || body.unit !== undefined || body.minLimit !== undefined || body.category !== undefined) {
      await updateInventoryItem(req.params.id, {
        name: body.name,
        unit: body.unit,
        minLimit: body.minLimit !== undefined ? Number(body.minLimit) : undefined,
        category: body.category,
      });
    }

    if (body.quantity !== undefined) {
      const target = Number(body.quantity);
      if (!Number.isFinite(target) || target < 0) {
        return res.status(400).json({ error: "Quantidade inválida." });
      }
      const delta = Number((target - current.quantity).toFixed(3));
      if (delta !== 0) {
        await adjustStock({
          itemId: req.params.id,
          delta,
          reason: "ajuste manual no painel",
        });
      }
    }

    const updated = await findInventoryItem(req.params.id);
    await audit(req, "inventory_update", "inventory_item", req.params.id);
    res.json(updated);
  })
);

// ---- Funcionários (admin) ----

app.post(
  "/api/employees",
  requireAdmin,
  ah(async (req, res) => {
    const employee = await createEmployee(req.body ?? {});
    await audit(req, "employee_create", "employee", employee.id);
    res.status(201).json(employee);
  })
);

app.put(
  "/api/employees/:id",
  requireAdmin,
  ah(async (req, res) => {
    const employee = await updateEmployee(req.params.id, req.body ?? {});
    if (!employee) return res.status(404).json({ error: "Funcionário não encontrado" });
    await audit(req, "employee_update", "employee", employee.id);
    res.json(employee);
  })
);

/** Remoção lógica: mantém o histórico de quem serviu cada pedido. */
app.delete(
  "/api/employees/:id",
  requireAdmin,
  ah(async (req, res) => {
    const ok = await deleteEmployee(req.params.id);
    if (!ok) return res.status(404).json({ error: "Funcionário não encontrado" });
    await audit(req, "employee_delete", "employee", req.params.id);
    res.json({ success: true });
  })
);

// ---- Cupões (admin) ----

app.post(
  "/api/coupons",
  requireAdmin,
  ah(async (req, res) => {
    const body = req.body ?? {};
    const coupon = await createCoupon({
      code: String(body.code ?? ""),
      discount: Number(body.discount ?? 0),
      type: body.type === "fixed" ? "fixed" : "percentage",
      active: body.active !== false,
      minSpend: Number(body.minSpend ?? 0),
    });
    await audit(req, "coupon_create", "coupon", coupon.code);
    res.status(201).json(coupon);
  })
);

// --------------------------------------------------------
// ASSISTENTE IA (dados de gestão → exige sessão)
// --------------------------------------------------------

function getLocalResponse(prompt: string, stats: any): string {
  let localResponse = "";
  const lower = prompt.toLowerCase();

  if (lower.includes("quanto vendemos") || lower.includes("receita") || lower.includes("faturamento")) {
    localResponse = `### Relatório Financeiro Rápido (Análise Local)
Hoje, o restaurante Opala registrou um faturamento total de **Kz ${stats.revenueToday.toFixed(2)}**, impulsionado principalmente pelo prato mais vendido: *${stats.mostPopularDish}*.
- **Pedidos ativos na cozinha:** ${stats.activeOrdersCount}
- **Pedidos concluídos:** ${stats.completedOrdersCount}
- **Ticket médio estimado:** Kz ${stats.averageTicket.toFixed(2)}

*Sugestão do Assistente:* Considere lançar um push de marketing às 18h com o cupom **${stats.activeCoupons[0] ?? "OPALA10"}** para capturar clientes corporativos da Ilha de Luanda e aumentar o faturamento do jantar em até 15%.`;
  } else if (lower.includes("vende mais") || lower.includes("popular") || lower.includes("prato")) {
    localResponse = `### Análise de Pratos e Saídas
Com base no histórico operacional actual, o prato de maior destaque é o **${stats.mostPopularDish}**.

**Pedidos registados:** ${stats.completedOrdersCount + stats.activeOrdersCount}
**Receita registada hoje:** Kz ${stats.revenueToday.toFixed(2)}

*Recomendação:* cruze as vendas por prato no separador Financeiro antes de decidir que campanha lançar — a base de dados já guarda o preço unitário de cada linha de pedido.`;
  } else if (lower.includes("estoque") || lower.includes("comprar amanhã") || lower.includes("comprar amanha") || lower.includes("comprar")) {
    const list = stats.lowStockItems.length
      ? stats.lowStockItems.map((item: string, index: number) => `${index + 1}. **${item}**`).join("\n")
      : "Nenhum insumo abaixo do mínimo de segurança.";
    localResponse = `### Relatório de Compras e Estoque Crítico
${list}

*Recomendação de Pedido:* reponha apenas o necessário para 3 dias de operação e registe a entrada de stock no painel, para que o histórico de movimentos fique completo.`;
  } else if (lower.includes("promoção") || lower.includes("promocao") || lower.includes("cupom") || lower.includes("cupão")) {
    localResponse = `### Campanha de Marketing
Cupões activos neste momento: **${stats.activeCoupons.length ? stats.activeCoupons.join(", ") : "nenhum"}**.

Para lançar uma campanha, use o separador Marketing e crie o cupão no painel: o desconto passa a ser validado no servidor a cada pedido, com mínimo de consumo e limite de 100% para percentagens.`;
  } else {
    localResponse = `### Relatório Analítico Opala IA (Luanda)
Olá! Sou o assistente de inteligência artificial do restaurante Opala, na Ilha de Luanda. Analisando os dados reais da base de dados:

1. **Financeiro:** receita registada hoje de **Kz ${stats.revenueToday.toFixed(2)}** e despesa de **Kz ${stats.expensesToday.toFixed(2)}**.
2. **Operação:** ${stats.activeOrdersCount} pedidos activos e ${stats.completedOrdersCount} concluídos.
3. **CRM:** ${stats.activeCustomersCount} clientes registados.
4. **Estoque:** ${stats.lowStockItems.length} alertas de stock baixo.

Pergunte algo mais específico, como *"Quais insumos comprar amanhã?"* ou *"Criar um cupão de marketing"*.`;
  }
  return localResponse;
}

async function gatherAiStats() {
  const [cash, lowStock, orders, customers, coupons] = await Promise.all([
    todayCash(),
    listLowStock(),
    listOrders(200),
    listCustomers(500),
    listCoupons(),
  ]);

  const activeOrders = orders.filter((o) => o.status !== "entregue" && o.status !== "cancelado");
  const completed = orders.filter((o) => o.status === "entregue");
  const revenueToday = Number(cash.revenue ?? 0);

  // Prato mais vendido: vem do histórico real de linhas de pedido.
  const topSellers = await query<{ itemName: string; sold: number }>(
    `SELECT item_name AS "itemName", sum(quantity)::int AS sold
       FROM order_items GROUP BY item_name ORDER BY sold DESC LIMIT 1`
  );

  return {
    revenueToday,
    expensesToday: Number(cash.expenses ?? 0),
    activeOrdersCount: activeOrders.length,
    completedOrdersCount: completed.length,
    averageTicket: completed.length ? revenueToday / completed.length : 0,
    lowStockItems: lowStock.map((i) => `${i.name}: ${i.quantity} ${i.unit} (mínimo ${i.minLimit} ${i.unit})`),
    mostPopularDish: topSellers[0]?.itemName ?? "ainda sem vendas registadas",
    activeCustomersCount: customers.length,
    activeCoupons: coupons.filter((c) => c.active).map((c) => c.code),
  };
}

app.post(
  "/api/gemini/query",
  requireAdmin,
  ah(async (req, res) => {
    const { prompt } = req.body ?? {};
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "O prompt é obrigatório." });
    }

    const [stats, state] = await Promise.all([gatherAiStats(), loadState()]);

    const contextData = `
    DADOS ATUAIS DO RESTAURANTE OPALA (ILHA DE LUANDA, ANGOLA):
    - Moeda oficial do restaurante: Kwanza de Angola (Kz)
    - Receita Total Registrada Hoje: Kz ${stats.revenueToday.toFixed(2)}
    - Pedidos Ativos na Cozinha: ${stats.activeOrdersCount}
    - Pedidos Concluídos: ${stats.completedOrdersCount}
    - Prato Mais Vendido: ${stats.mostPopularDish}
    - Clientes Ativos Cadastrados no CRM: ${stats.activeCustomersCount}
    - Cupons Ativos de Marketing: ${stats.activeCoupons.join(", ")}
    - Produtos em Alerta de Estoque Baixo: ${stats.lowStockItems.length > 0 ? stats.lowStockItems.join(", ") : "Nenhum no momento"}

    LISTA DE PRODUTOS NO CARDÁPIO:
    ${state.menuItems.map((m) => `- ${m.name} (Kz ${m.price.toFixed(2)}), Categoria: ${m.category}, Tags: ${m.tags.join(", ")}`).join("\n")}
  `;

    try {
      if (ai) {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Você é o Assistente de Inteligência Artificial do restaurante luxuoso "Opala", localizado na Ilha de Luanda, Angola.
Seu tom de voz deve ser extremamente profissional, analítico, requintado, corporativo e acolhedor.
Responda de forma completa em português de Angola / Portugal baseado exclusivamente nos dados do restaurante e em kwanza (Kz), criando soluções requintadas quando solicitado.

${contextData}

Pergunta ou Comando do Administrador:
"${prompt}"`,
        });

        const responseText = response.text || "Desculpe, não consegui processar as informações no momento.";
        return res.json({ response: responseText });
      }

      return res.json({ response: getLocalResponse(prompt, stats) });
    } catch (error: any) {
      console.error("Gemini Error:", error?.message ?? error);
      const localResponse = getLocalResponse(prompt, stats);
      const fallbackMessage = `*(Nota: Ativando assistente local Opala IA em modo de contingência offline devido à alta demanda do servidor Gemini)*\n\n${localResponse}`;
      return res.json({ response: fallbackMessage });
    }
  })
);

// --------------------------------------------------------
// Handler de erros (inclui rejeições dos handlers async)
// --------------------------------------------------------

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  fail(res, error);
});

// Vite Middleware & Static Server Settings
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Import dinâmico: em produção/servless o `vite` (devDependency) não é
    // carregado para dentro do pacote da função.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    console.log(
      isDatabaseConfigured()
        ? "Base de dados: Neon/PostgreSQL (DATABASE_URL configurada)"
        : "Base de dados: NÃO configurada — a API serve apenas o cardápio estático"
    );
  });
}

/**
 * A app Express é exportada para poder ser usada por uma função serverless
 * (Vercel), onde não há `listen` nem ficheiros estáticos a servir.
 */
export default app;

// No Vercel quem trata do HTTP é a função em api/index.ts.
if (!process.env.VERCEL) {
  startServer();
}
