/**
 * Contas de cliente do site.
 *
 * Separadas das contas de administração (`db/repositories/admin.ts`):
 *  - criar conta no site NUNCA dá acesso ao painel;
 *  - o painel continua a ser decidido por `admin_users` (is_active = true),
 *    por isso só o e-mail lá registado tem acesso total;
 *  - a conta liga-se ao registo de CRM (`customers`) para o histórico seguir
 *    a mesma pessoa, e para o formulário de reserva vir preenchido.
 */

import { query, queryOne, withTransaction } from "../index";

export interface CustomerAccount {
  id: string;
  customerId: string;
  email: string;
  name: string;
  phone: string;
}

interface AccountRow extends CustomerAccount {
  passwordHash: string;
  failedAttempts: number;
  lockedUntil: Date | string | null;
}

const ACCOUNT_SELECT = `
  SELECT a.id,
         a.customer_id AS "customerId",
         a.email,
         c.name,
         c.phone,
         a.password_hash AS "passwordHash",
         a.failed_attempts AS "failedAttempts",
         a.locked_until AS "lockedUntil"
    FROM customer_accounts a
    JOIN customers c ON c.id = a.customer_id
`;

export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export function sessionTtlDays(): number {
  const value = Number(process.env.CUSTOMER_SESSION_DAYS);
  return Number.isFinite(value) && value > 0 && value <= 365 ? value : 30;
}

export function toPublicAccount(row: CustomerAccount): CustomerAccount {
  return { id: row.id, customerId: row.customerId, email: row.email, name: row.name, phone: row.phone };
}

export async function findAccountByEmail(email: string): Promise<AccountRow | null> {
  return queryOne<AccountRow>(`${ACCOUNT_SELECT} WHERE lower(btrim(a.email)) = lower(btrim($1))`, [email]);
}

export async function findAccountById(id: string): Promise<AccountRow | null> {
  return queryOne<AccountRow>(`${ACCOUNT_SELECT} WHERE a.id = $1`, [id]);
}

/**
 * Cria a conta e o respetivo registo de CRM.
 * Se já existir um cliente com o mesmo e-mail (vindo de uma reserva antiga),
 * a conta é ligada a esse registo em vez de duplicar a pessoa.
 */
export async function createCustomerAccount(input: {
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
}): Promise<CustomerAccount> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  return withTransaction(async (client) => {
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM customers
        WHERE lower(btrim(email)) = $1
        ORDER BY created_at LIMIT 1`,
      [email]
    );

    let customerId = existing.rows[0]?.id;
    if (customerId) {
      await client.query(
        `UPDATE customers
            SET name  = CASE WHEN length(btrim(name)) = 0 THEN $2 ELSE name END,
                phone = CASE WHEN length(btrim(phone)) = 0 THEN $3 ELSE phone END
          WHERE id = $1`,
        [customerId, name, input.phone ?? ""]
      );
    } else {
      const created = await client.query<{ id: string }>(
        `INSERT INTO customers (id, name, email, phone)
         VALUES ('c-' || gen_random_uuid(), $1, $2, $3)
         RETURNING id`,
        [name, email, input.phone ?? ""]
      );
      customerId = created.rows[0].id;
    }

    const account = await client.query<{ id: string }>(
      `INSERT INTO customer_accounts (customer_id, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [customerId, email, input.passwordHash]
    );

    const { rows } = await client.query<AccountRow>(`${ACCOUNT_SELECT} WHERE a.id = $1`, [account.rows[0].id]);
    return toPublicAccount(rows[0]);
  });
}

export async function registerFailedLogin(email: string): Promise<{
  attemptsLeft: number;
  locked: boolean;
  lockedUntil: string | null;
}> {
  const rows = await query<{ failedAttempts: number; lockedUntil: Date | null }>(
    `UPDATE customer_accounts
        SET failed_attempts = failed_attempts + 1,
            locked_until = CASE WHEN failed_attempts + 1 >= $2
                                THEN now() + ($3 || ' minutes')::interval
                                ELSE locked_until END
      WHERE lower(btrim(email)) = lower(btrim($1))
      RETURNING failed_attempts AS "failedAttempts", locked_until AS "lockedUntil"`,
    [email, MAX_ATTEMPTS, String(LOCK_MINUTES)]
  );

  const row = rows[0];
  if (!row) return { attemptsLeft: MAX_ATTEMPTS, locked: false, lockedUntil: null };

  return {
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - row.failedAttempts),
    locked: Boolean(row.lockedUntil) && new Date(row.lockedUntil!).getTime() > Date.now(),
    lockedUntil: row.lockedUntil ? new Date(row.lockedUntil).toISOString() : null,
  };
}

export async function registerSuccessfulLogin(id: string): Promise<void> {
  await query(
    `UPDATE customer_accounts
        SET failed_attempts = 0, locked_until = NULL, last_login_at = now()
      WHERE id = $1`,
    [id]
  );
}

export async function createCustomerSession(input: {
  accountId: string;
  tokenHash: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ account: CustomerAccount; expiresAt: string }> {
  const days = sessionTtlDays();
  const rows = await query<{ expiresAt: Date }>(
    `INSERT INTO customer_sessions (customer_account_id, token_hash, expires_at, ip, user_agent)
     VALUES ($1, $2, now() + ($3 || ' days')::interval, $4, $5)
     RETURNING expires_at AS "expiresAt"`,
    [input.accountId, input.tokenHash, String(days), input.ip ?? null, input.userAgent ?? null]
  );

  const account = await findAccountById(input.accountId);
  if (!account) throw new Error("Conta não encontrada.");

  return { account: toPublicAccount(account), expiresAt: rows[0].expiresAt.toISOString() };
}

export async function findValidCustomerSession(tokenHash: string): Promise<{
  account: CustomerAccount;
  expiresAt: string;
} | null> {
  const row = await queryOne<AccountRow & { expiresAt: Date }>(
    `SELECT a.id,
            a.customer_id AS "customerId",
            a.email,
            c.name,
            c.phone,
            a.password_hash AS "passwordHash",
            a.failed_attempts AS "failedAttempts",
            a.locked_until AS "lockedUntil",
            s.expires_at AS "expiresAt"
       FROM customer_sessions s
       JOIN customer_accounts a ON a.id = s.customer_account_id
       JOIN customers c ON c.id = a.customer_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()`,
    [tokenHash]
  );
  if (!row) return null;

  // toque de "visto por último" sem bloquear a resposta
  query("UPDATE customer_sessions SET last_seen_at = now() WHERE token_hash = $1", [tokenHash]).catch(() => undefined);

  return { account: toPublicAccount(row), expiresAt: row.expiresAt.toISOString() };
}

export async function revokeCustomerSession(tokenHash: string): Promise<void> {
  await query(
    `UPDATE customer_sessions SET revoked_at = now()
      WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash]
  );
}
