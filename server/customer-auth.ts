/**
 * Autenticação do site (contas de cliente).
 *
 * Um único formulário serve os dois mundos:
 *  - se o e-mail pertencer a um administrador ativo (`admin_users`), a sessão
 *    criada é a do painel (cookie `opala_admin`) — é assim que o dono entra;
 *  - caso contrário, entra na conta de cliente (cookie `opala_cliente`), que
 *    só dá acesso ao site: reservas, histórico e dados pré-preenchidos.
 *
 * Criar conta no site nunca cria administradores: o papel de admin vive
 * exclusivamente em `admin_users`.
 */

import { createHash } from "node:crypto";
import type { Express, NextFunction, Request, Response } from "express";
import { isDatabaseConfigured } from "../db";
import {
  createSession as createAdminSession,
  findAdminByEmail,
  registerFailedLogin as registerAdminFailedLogin,
  registerSuccessfulLogin as registerAdminSuccessfulLogin,
  writeAudit,
} from "../db/repositories/admin";
import {
  createCustomerAccount,
  createCustomerSession,
  findAccountByEmail,
  findValidCustomerSession,
  registerFailedLogin,
  registerSuccessfulLogin,
  revokeCustomerSession,
  sessionTtlDays,
  toPublicAccount,
  type CustomerAccount,
} from "../db/repositories/customer-accounts";
import { checkPasswordStrength, generateSessionToken, hashPassword, verifyPassword } from "../lib/password";

export const CUSTOMER_COOKIE = "opala_cliente";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      customer?: { account: CustomerAccount; expiresAt: string };
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
  const token = parseCookies(req.headers.cookie)[CUSTOMER_COOKIE];
  return token && token.length >= 32 ? token : null;
}

function isSecureRequest(req: Request): boolean {
  if (req.secure) return true;
  const proto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim();
  if (proto === "https") return true;
  return /^https:/.test(process.env.APP_URL ?? "");
}

function setSessionCookie(req: Request, res: Response, token: string, expiresAt: string) {
  const maxAge = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  res.cookie(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: isSecureRequest(req),
    path: "/",
    maxAge,
  });
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Anexa `req.customer` quando existe um cookie de sessão de cliente válido. */
export async function attachCustomerSession(req: Request, _res: Response, next: NextFunction) {
  req.customer = undefined;
  const token = sessionToken(req);
  if (!token || !isDatabaseConfigured()) return next();

  try {
    const session = await findValidCustomerSession(sha256(token));
    if (session) req.customer = session;
    next();
  } catch (error) {
    next(error);
  }
}

export function registerCustomerRoutes(app: Express) {
  /** Quem está autenticado neste browser (cliente, admin, ou ninguém). */
  app.get("/api/customer/me", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({
      customer: req.customer ? toPublicAccount(req.customer.account) : null,
      admin: req.admin ? req.admin.user : null,
      sessionDays: sessionTtlDays(),
    });
  });

  /** Criar conta no site. */
  app.post("/api/customer/register", async (req, res) => {
    if (!isDatabaseConfigured()) {
      return res.status(503).json({ error: "Base de dados não configurada." });
    }

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    res.set("Cache-Control", "no-store");

    if (name.length < 2) return res.status(400).json({ error: "Indique o seu nome." });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "E-mail inválido." });

    const strength = checkPasswordStrength(password);
    if (!strength.ok) {
      return res.status(400).json({ error: `Palavra-passe fraca: ${strength.problems.join("; ")}.` });
    }

    try {
      // O e-mail da administração já tem credencial própria (a do painel).
      // Em vez de recusar, tentamos entrar com a palavra-passe indicada: quem
      // sabe a palavra-passe do painel fica logo autenticado como admin; os
      // outros não conseguem criar uma conta nova nem tomar a conta.
      const admin = await findAdminByEmail(email);
      if (admin) {
        if (admin.isActive && (await verifyPassword(password, admin.passwordHash))) {
          await registerAdminSuccessfulLogin(admin.id);
          const token = generateSessionToken();
          const session = await createAdminSession({
            adminUserId: admin.id,
            tokenHash: sha256(token),
            ip: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
          });

          const maxAge = Math.max(0, new Date(session.expiresAt).getTime() - Date.now());
          res.cookie("opala_admin", token, {
            httpOnly: true,
            sameSite: "strict",
            secure: isSecureRequest(req),
            path: "/",
            maxAge,
          });
          await writeAudit({
            adminUserId: admin.id,
            action: "login_success",
            entity: "admin_user",
            entityId: admin.id,
            metadata: { via: "site" },
          }).catch(() => undefined);

          return res.json({ kind: "admin", admin: session.user, expiresAt: session.expiresAt });
        }

        return res.status(409).json({
          error:
            "Este e-mail já é a conta de administração. Escreva a palavra-passe do painel no campo «Palavra-passe» e volte a submeter para entrar — não é preciso criar conta.",
          code: "admin_email",
        });
      }

      if (await findAccountByEmail(email)) {
        return res.status(409).json({
          error: "Já existe uma conta com este e-mail. Use “Entrar”.",
          code: "email_taken",
        });
      }

      const account = await createCustomerAccount({
        name,
        email,
        phone,
        passwordHash: await hashPassword(password),
      });

      const token = generateSessionToken();
      const session = await createCustomerSession({
        accountId: account.id,
        tokenHash: sha256(token),
        ip: req.ip ?? null,
        userAgent: req.get("user-agent") ?? null,
      });

      setSessionCookie(req, res, token, session.expiresAt);
      return res.status(201).json({ kind: "customer", customer: session.account, expiresAt: session.expiresAt });
    } catch (error) {
      console.error("[customer-auth] erro no registo:", error);
      return res.status(500).json({ error: "Não foi possível criar a conta." });
    }
  });

  /** Entrar: administrador primeiro, depois conta de cliente. */
  app.post("/api/customer/login", async (req, res) => {
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
      // ---- 1. administração (só os e-mails de admin_users entram aqui) ----
      const admin = await findAdminByEmail(email);
      if (admin && admin.isActive) {
        if (admin.lockedUntil && new Date(admin.lockedUntil).getTime() > Date.now()) {
          return res.status(423).json({
            error: "Conta temporariamente bloqueada por demasiadas tentativas. Tente mais tarde.",
            lockedUntil: admin.lockedUntil,
          });
        }

        if (await verifyPassword(password, admin.passwordHash)) {
          await registerAdminSuccessfulLogin(admin.id);
          const token = generateSessionToken();
          const session = await createAdminSession({
            adminUserId: admin.id,
            tokenHash: sha256(token),
            ip: req.ip ?? null,
            userAgent: req.get("user-agent") ?? null,
          });

          // mesma mecânica de cookie do painel (server/auth.ts)
          const maxAge = Math.max(0, new Date(session.expiresAt).getTime() - Date.now());
          res.cookie("opala_admin", token, {
            httpOnly: true,
            sameSite: "strict",
            secure: isSecureRequest(req),
            path: "/",
            maxAge,
          });

          return res.json({ kind: "admin", admin: session.user, expiresAt: session.expiresAt });
        }

        const failure = await registerAdminFailedLogin(admin.email);
        return res.status(failure.locked ? 423 : 401).json({
          error: failure.locked
            ? "Demasiadas tentativas falhadas. A conta foi bloqueada temporariamente."
            : "E-mail ou palavra-passe incorretos.",
          attemptsLeft: failure.attemptsLeft,
          lockedUntil: failure.lockedUntil,
        });
      }

      // ---- 2. conta de cliente ----
      const account = await findAccountByEmail(email);
      if (!account) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        return res.status(401).json({ error: "E-mail ou palavra-passe incorretos." });
      }

      if (account.lockedUntil && new Date(account.lockedUntil).getTime() > Date.now()) {
        return res.status(423).json({
          error: "Conta temporariamente bloqueada por demasiadas tentativas. Tente mais tarde.",
          lockedUntil: new Date(account.lockedUntil).toISOString(),
        });
      }

      if (!(await verifyPassword(password, account.passwordHash))) {
        const failure = await registerFailedLogin(account.email);
        return res.status(failure.locked ? 423 : 401).json({
          error: failure.locked
            ? "Demasiadas tentativas falhadas. A conta foi bloqueada temporariamente."
            : "E-mail ou palavra-passe incorretos.",
          attemptsLeft: failure.attemptsLeft,
          lockedUntil: failure.lockedUntil,
        });
      }

      await registerSuccessfulLogin(account.id);

      const token = generateSessionToken();
      const session = await createCustomerSession({
        accountId: account.id,
        tokenHash: sha256(token),
        ip: req.ip ?? null,
        userAgent: req.get("user-agent") ?? null,
      });

      setSessionCookie(req, res, token, session.expiresAt);
      return res.json({ kind: "customer", customer: session.account, expiresAt: session.expiresAt });
    } catch (error) {
      console.error("[customer-auth] erro no login:", error);
      return res.status(500).json({ error: "Não foi possível iniciar sessão." });
    }
  });

  /** Sair do site (a sessão do painel, se existir, é terminada em /api/auth/logout). */
  app.post("/api/customer/logout", async (req, res) => {
    const token = sessionToken(req);
    try {
      if (token && isDatabaseConfigured()) await revokeCustomerSession(sha256(token));
    } catch (error) {
      console.error("[customer-auth] erro ao terminar sessão:", error);
    }
    res.clearCookie(CUSTOMER_COOKIE, { path: "/" });
    res.json({ success: true });
  });
}
