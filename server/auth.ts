/**
 * Autenticação do painel admin.
 *
 * Modelo:
 *  - login por e-mail + palavra-passe (scrypt, ver lib/password.ts)
 *  - sessão em BD (admin_sessions) identificada por um token aleatório
 *  - o browser só recebe o token, num cookie httpOnly + SameSite=Strict;
 *    a BD guarda apenas o SHA-256 do token (uma fuga da BD não dá sessões)
 *  - bloqueio temporário após 5 tentativas falhadas (lógica em db/repositories/admin.ts)
 *  - tudo auditado em admin_audit_log
 */

import { createHash } from "node:crypto";
import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import { isDatabaseConfigured } from "../db";
import {
  createSession,
  findAdminByEmail,
  findValidSessionByTokenHash,
  registerFailedLogin,
  registerSuccessfulLogin,
  revokeSession,
  sessionTtlHours,
  writeAudit,
  type AdminSession,
} from "../db/repositories/admin";
import { generateSessionToken, verifyPassword } from "../lib/password";

export const SESSION_COOKIE = "opala_admin";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminSession;
    }
  }
}

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      cookies[name] = part.slice(index + 1).trim();
    }
  }
  return cookies;
}

function sessionToken(req: Request): string | null {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  return token && token.length >= 32 ? token : null;
}

function cookieValue(res: Response, token: string, expiresAt: string, secure: boolean) {
  const maxAge = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure,
    path: "/",
    maxAge,
  });
}

function isSecureRequest(req: Request): boolean {
  if (req.secure) return true;
  const proto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim();
  if (proto === "https") return true;
  return /^https:/.test(process.env.APP_URL ?? "");
}

/** Anexa `req.admin` quando existe um cookie de sessão válido. */
export async function attachAdminSession(req: Request, _res: Response, next: NextFunction) {
  req.admin = undefined;
  const token = sessionToken(req);
  if (!token || !isDatabaseConfigured()) return next();

  try {
    const session = await findValidSessionByTokenHash(sha256(token));
    if (session) req.admin = session;
    next();
  } catch (error) {
    next(error);
  }
}

/** Só deixa passar administradores autenticados. */
export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!isDatabaseConfigured()) {
    return res.status(503).json({ error: "Base de dados não configurada." });
  }
  if (!req.admin) {
    return res.status(401).json({ error: "Sessão inválida ou expirada. Inicie sessão no painel." });
  }
  next();
};

export function registerAuthRoutes(app: Express) {
  app.get("/api/auth/me", (req, res) => {
    if (!req.admin) return res.status(401).json({ error: "Não autenticado." });
    res.set("Cache-Control", "no-store");
    res.json({
      admin: req.admin.user,
      expiresAt: req.admin.expiresAt,
      ttlHours: sessionTtlHours(),
    });
  });

  app.post("/api/auth/login", async (req, res) => {
    if (!isDatabaseConfigured()) {
      return res.status(503).json({ error: "Base de dados não configurada." });
    }

    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!email || !password) {
      return res.status(400).json({ error: "E-mail e palavra-passe são obrigatórios." });
    }

    res.set("Cache-Control", "no-store");

    try {
      const admin = await findAdminByEmail(email);

      // E-mail inexistente: mesma resposta e mesma latência aproximada, para
      // não revelar que contas existem.
      if (!admin) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        await writeAudit({ action: "login_failed", entity: "admin_user", metadata: { email } });
        return res.status(401).json({ error: "Credenciais inválidas." });
      }

      if (!admin.isActive) {
        await writeAudit({
          adminUserId: admin.id,
          action: "login_blocked_inactive",
          entity: "admin_user",
          entityId: admin.id,
        });
        return res.status(403).json({ error: "Esta conta está desativada." });
      }

      if (admin.lockedUntil && new Date(admin.lockedUntil).getTime() > Date.now()) {
        return res.status(423).json({
          error: "Conta temporariamente bloqueada por demasiadas tentativas. Tente mais tarde.",
          lockedUntil: admin.lockedUntil,
        });
      }

      const ok = await verifyPassword(password, admin.passwordHash);
      if (!ok) {
        const failure = await registerFailedLogin(admin.email);
        await writeAudit({
          adminUserId: admin.id,
          action: "login_failed",
          entity: "admin_user",
          entityId: admin.id,
          metadata: { attemptsLeft: failure.attemptsLeft },
        });

        if (failure.locked) {
          return res.status(423).json({
            error: "Demasiadas tentativas falhadas. A conta foi bloqueada temporariamente.",
            lockedUntil: failure.lockedUntil,
          });
        }
        return res.status(401).json({
          error: "Credenciais inválidas.",
          attemptsLeft: failure.attemptsLeft,
        });
      }

      await registerSuccessfulLogin(admin.id);

      const token = generateSessionToken();
      const session = await createSession({
        adminUserId: admin.id,
        tokenHash: sha256(token),
        ip: req.ip ?? null,
        userAgent: req.get("user-agent") ?? null,
      });

      cookieValue(res, token, session.expiresAt, isSecureRequest(req));
      await writeAudit({
        adminUserId: admin.id,
        action: "login_success",
        entity: "admin_user",
        entityId: admin.id,
      });

      return res.json({ admin: session.user, expiresAt: session.expiresAt });
    } catch (error) {
      console.error("[auth] erro no login:", error);
      return res.status(500).json({ error: "Não foi possível iniciar sessão." });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const token = sessionToken(req);
    try {
      if (token && isDatabaseConfigured()) {
        await revokeSession(sha256(token));
      }
    } catch (error) {
      console.error("[auth] erro ao terminar sessão:", error);
    }
    if (req.admin) {
      await writeAudit({
        adminUserId: req.admin.user.id,
        action: "logout",
        entity: "admin_user",
        entityId: req.admin.user.id,
      }).catch(() => undefined);
    }
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.json({ success: true });
  });

  /** Registo de auditoria — só para administradores. */
  app.get("/api/admin/audit", requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 100) || 100));
      const { listAudit } = await import("../db/repositories/admin");
      res.set("Cache-Control", "no-store");
      res.json(await listAudit(limit));
    } catch (error) {
      console.error("[auth] erro ao ler auditoria:", error);
      res.status(500).json({ error: "Não foi possível ler o registo de auditoria." });
    }
  });
}
