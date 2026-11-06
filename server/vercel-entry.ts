/**
 * Entrypoint da função serverless do Vercel.
 *
 * Este ficheiro NÃO é deployado diretamente: o `npm run build:api` empacota-o
 * (com a app Express e as dependências) num único CommonJS em `api/index.cjs`.
 * Assim o runtime do Vercel não precisa de resolver imports de TypeScript.
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

  return (app as unknown as Handler)(req, res);
}
