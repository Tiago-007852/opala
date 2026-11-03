/**
 * Camada de dados da autenticação do painel admin.
 * As palavras-passe chegam aqui já em hash (ver lib/password.ts) e os tokens
 * de sessão apenas como SHA-256 — o valor em claro só existe no cookie.
 */

import { query, queryOne } from "../index";

export type AdminRole = "owner" | "manager" | "staff";

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminUserWithSecret extends AdminUser {
  passwordHash: string;
  failedAttempts: number;
  lockedUntil: string | null;
}

const PUBLIC_FIELDS = `
  id, email, name, role, is_active AS "isActive",
  last_login_at AS "lastLoginAt", created_at AS "createdAt"
`;

type AdminRow = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  passwordHash?: string;
  failedAttempts?: number;
  lockedUntil?: Date | null;
};

function toAdmin(row: AdminRow): AdminUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    isActive: row.isActive,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function countAdmins(): Promise<number> {
  const row = await queryOne<{ total: number }>("SELECT count(*)::int AS total FROM admin_users");
  return row?.total ?? 0;
}

export async function listAdmins(): Promise<AdminUser[]> {
  const rows = await query<AdminRow>(`SELECT ${PUBLIC_FIELDS} FROM admin_users ORDER BY created_at`);
  return rows.map(toAdmin);
}

/** Inclui o hash — usar só no fluxo de login. */
export async function findAdminByEmail(email: string): Promise<AdminUserWithSecret | null> {
  const row = await queryOne<AdminRow>(
    `SELECT ${PUBLIC_FIELDS},
            password_hash AS "passwordHash",
            failed_attempts AS "failedAttempts",
            locked_until AS "lockedUntil"
       FROM admin_users
      WHERE lower(btrim(email)) = lower(btrim($1))`,
    [email]
  );
  if (!row?.passwordHash) return null;

  return {
    ...toAdmin(row),
    passwordHash: row.passwordHash,
    failedAttempts: row.failedAttempts ?? 0,
    lockedUntil: row.lockedUntil ? row.lockedUntil.toISOString() : null,
  };
}

export async function createAdminUser(input: {
  email: string;
  name?: string;
  passwordHash: string;
  role?: AdminRole;
}): Promise<AdminUser> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("E-mail inválido.");
  if (!input.passwordHash.startsWith("scrypt$")) throw new Error("O hash da palavra-passe é inválido.");

  const row = await queryOne<AdminRow>(
    `INSERT INTO admin_users (email, name, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${PUBLIC_FIELDS}`,
    [email, input.name?.trim() ?? "", input.passwordHash, input.role ?? "owner"]
  );
  if (!row) throw new Error("Não foi possível criar o administrador.");
  return toAdmin(row);
}

export async function setAdminPassword(email: string, passwordHash: string): Promise<boolean> {
  if (!passwordHash.startsWith("scrypt$")) throw new Error("O hash da palavra-passe é inválido.");
  const rows = await query<{ id: string }>(
    `UPDATE admin_users
        SET password_hash = $2,
            password_changed_at = now(),
            failed_attempts = 0,
            locked_until = NULL
      WHERE lower(btrim(email)) = lower(btrim($1))
      RETURNING id`,
    [email, passwordHash]
  );
  if (rows.length > 0) {
    await revokeAllSessions(rows[0].id);
    return true;
  }
  return false;
}

export async function setAdminActive(email: string, active: boolean): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE admin_users SET is_active = $2 WHERE lower(btrim(email)) = lower(btrim($1)) RETURNING id`,
    [email, active]
  );
  return rows.length > 0;
}

/**
 * Conta uma tentativa falhada e bloqueia a conta após MAX_FAILED_ATTEMPTS.
 * Devolve o estado resultante para a API poder responder com clareza.
 */
export async function registerFailedLogin(
  email: string
): Promise<{ locked: boolean; lockedUntil: string | null; attemptsLeft: number }> {
  const row = await queryOne<{ failedAttempts: number; lockedUntil: Date | null }>(
    `UPDATE admin_users
        SET failed_attempts = failed_attempts + 1,
            locked_until = CASE
              WHEN failed_attempts + 1 >= $2 THEN now() + ($3 || ' minutes')::interval
              ELSE locked_until
            END
      WHERE lower(btrim(email)) = lower(btrim($1))
      RETURNING failed_attempts AS "failedAttempts", locked_until AS "lockedUntil"`,
    [email, MAX_FAILED_ATTEMPTS, LOCK_MINUTES]
  );

  if (!row) return { locked: false, lockedUntil: null, attemptsLeft: MAX_FAILED_ATTEMPTS };

  const lockedUntil = row.lockedUntil ? row.lockedUntil.toISOString() : null;
  return {
    locked: lockedUntil !== null && new Date(lockedUntil).getTime() > Date.now(),
    lockedUntil,
    attemptsLeft: Math.max(0, MAX_FAILED_ATTEMPTS - row.failedAttempts),
  };
}

export async function registerSuccessfulLogin(id: string): Promise<void> {
  await query(
    `UPDATE admin_users
        SET failed_attempts = 0,
            locked_until = NULL,
            last_login_at = now()
      WHERE id = $1`,
    [id]
  );
}

export function sessionTtlHours(): number {
  const hours = Number(process.env.ADMIN_SESSION_TTL_HOURS ?? 8);
  return Number.isFinite(hours) && hours > 0 ? hours : 8;
}

export interface AdminSession {
  sessionId: string;
  expiresAt: string;
  user: AdminUser;
}

export async function createSession(input: {
  adminUserId: string;
  tokenHash: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<AdminSession> {
  const row = await queryOne<{
    id: string;
    expiresAt: Date;
    adminId: string;
    email: string;
    name: string;
    role: AdminRole;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
  }>(
    `WITH s AS (
       INSERT INTO admin_sessions (admin_user_id, token_hash, expires_at, ip, user_agent)
       VALUES ($1, $2, now() + ($3 || ' hours')::interval, $4, $5)
       RETURNING id, expires_at
     )
     SELECT s.id, s.expires_at AS "expiresAt",
            u.id AS "adminId", u.email, u.name, u.role,
            u.is_active AS "isActive", u.last_login_at AS "lastLoginAt",
            u.created_at AS "createdAt"
       FROM s JOIN admin_users u ON u.id = $1`,
    [input.adminUserId, input.tokenHash, sessionTtlHours(), input.ip ?? null, input.userAgent ?? null]
  );
  if (!row) throw new Error("Não foi possível criar a sessão.");

  return {
    sessionId: row.id,
    expiresAt: row.expiresAt.toISOString(),
    user: {
      id: row.adminId,
      email: row.email,
      name: row.name,
      role: row.role,
      isActive: row.isActive,
      lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    },
  };
}

/** Sessão válida: não revogada, não expirada, utilizador ativo. */
export async function findValidSessionByTokenHash(tokenHash: string): Promise<AdminSession | null> {
  const row = await queryOne<{
    sessionId: string;
    expiresAt: Date;
    adminId: string;
    email: string;
    name: string;
    role: AdminRole;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
  }>(
    `SELECT s.id AS "sessionId", s.expires_at AS "expiresAt",
            u.id AS "adminId", u.email, u.name, u.role,
            u.is_active AS "isActive", u.last_login_at AS "lastLoginAt",
            u.created_at AS "createdAt"
       FROM admin_sessions s
       JOIN admin_users u ON u.id = s.admin_user_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
        AND u.is_active`,
    [tokenHash]
  );
  if (!row) return null;

  return {
    sessionId: row.sessionId,
    expiresAt: row.expiresAt.toISOString(),
    user: {
      id: row.adminId,
      email: row.email,
      name: row.name,
      role: row.role,
      isActive: row.isActive,
      lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    },
  };
}

export async function touchSession(sessionId: string): Promise<void> {
  await query("UPDATE admin_sessions SET last_seen_at = now() WHERE id = $1", [sessionId]);
}

export async function revokeSession(tokenHash: string): Promise<void> {
  await query(
    "UPDATE admin_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
    [tokenHash]
  );
}

export async function revokeAllSessions(adminUserId: string): Promise<number> {
  const rows = await query<{ id: string }>(
    "UPDATE admin_sessions SET revoked_at = now() WHERE admin_user_id = $1 AND revoked_at IS NULL RETURNING id",
    [adminUserId]
  );
  return rows.length;
}

export async function purgeExpiredSessions(): Promise<number> {
  const rows = await query<{ id: string }>(
    "DELETE FROM admin_sessions WHERE expires_at < now() - interval '7 days' RETURNING id"
  );
  return rows.length;
}

export async function writeAudit(input: {
  adminUserId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO admin_audit_log (admin_user_id, action, entity, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [
      input.adminUserId ?? null,
      input.action,
      input.entity ?? "",
      input.entityId ?? "",
      JSON.stringify(input.metadata ?? {}),
    ]
  );
}

export async function listAudit(limit = 100) {
  return query<{
    id: number;
    action: string;
    entity: string;
    entityId: string;
    adminEmail: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>(
    `SELECT a.id, a.action, a.entity, a.entity_id AS "entityId",
            u.email AS "adminEmail", a.metadata, a.created_at AS "createdAt"
       FROM admin_audit_log a
       LEFT JOIN admin_users u ON u.id = a.admin_user_id
      ORDER BY a.created_at DESC
      LIMIT $1`,
    [limit]
  );
}
