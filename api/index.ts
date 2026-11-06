/**
 * Função serverless do Vercel.
 *
 * O `vercel.json` reescreve /api/* para aqui; a app Express é a mesma do
 * servidor local, mas sem `listen` e sem servir ficheiros estáticos (o Vercel
 * serve o `dist/` do Vite).
 *
 * Import estático de propósito: o projeto não usa `"type": "module"`, por isso
 * a função corre como CommonJS e os imports relativos sem extensão resolvem
 * (em ESM o Vercel falha com "Directory import ... is not supported").
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import app from "../server";

type Handler = (req: IncomingMessage, res: ServerResponse) => unknown;

export default function handler(req: IncomingMessage, res: ServerResponse) {
  // Normalmente o caminho chega intacto ("/api/customer/login"). Se chegar já
  // reescrito ("/customer/login"), devolvemos o prefixo para as rotas do
  // Express continuarem a casar.
  const url = req.url ?? "/";
  if (!url.startsWith("/api")) {
    req.url = `/api${url.startsWith("/") ? url : `/${url}`}`;
  }

  try {
    return (app as unknown as Handler)(req, res);
  } catch (error) {
    const isProd = process.env.VERCEL_ENV === "production";
    console.error("[api] erro na função:", error);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(
      JSON.stringify({
        error: "API indisponível.",
        ...(isProd ? {} : { detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }),
      })
    );
  }
}
