/**
 * Função serverless do Vercel.
 *
 * O `vercel.json` reescreve /api/* para aqui; a app Express é a mesma do
 * servidor local, mas sem `listen` e sem servir ficheiros estáticos (o Vercel
 * serve o `dist/` do Vite).
 *
 * A app é carregada com `import()` de caminho explícito ("../server.js") para
 * funcionar tanto em CommonJS como em ESM no runtime do Vercel, e para que uma
 * falha de arranque devolva o erro em JSON em vez de um 500 opaco.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

type Handler = (req: IncomingMessage, res: ServerResponse) => unknown;

let appPromise: Promise<Handler> | null = null;

function loadApp(): Promise<Handler> {
  appPromise ??= import("../server.js").then((mod) => mod.default as Handler);
  return appPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  // Normalmente o caminho chega intacto ("/api/customer/login"). Se chegar já
  // reescrito ("/customer/login"), devolvemos o prefixo para as rotas do
  // Express continuarem a casar.
  const url = req.url ?? "/";
  if (!url.startsWith("/api")) {
    req.url = `/api${url.startsWith("/") ? url : `/${url}`}`;
  }

  try {
    const app = await loadApp();
    return app(req, res);
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error("[api] falha ao carregar a aplicação:", error);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify({ error: "API indisponível.", detail: message }));
  }
}
