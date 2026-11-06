/**
 * Função serverless do Vercel.
 *
 * O `vercel.json` reescreve /api/* para aqui; a app Express é a mesma do
 * servidor local, mas sem `listen` e sem servir ficheiros estáticos (o Vercel
 * serve o `dist/` do Vite).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import app from "../server";

type Handler = (req: IncomingMessage, res: ServerResponse) => unknown;

export default function handler(req: IncomingMessage, res: ServerResponse) {
  // Normalmente o caminho chega intacto ("/api/customer/login"). Se algum dia
  // chegar já reescrito ("/customer/login"), devolvemos o prefixo para as
  // rotas do Express continuarem a casar.
  const url = req.url ?? "/";
  if (!url.startsWith("/api")) {
    req.url = `/api${url.startsWith("/") ? url : `/${url}`}`;
  }

  return (app as unknown as Handler)(req, res);
}
