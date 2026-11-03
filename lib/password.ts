/**
 * Hash e verificação de palavras-passe do painel admin.
 *
 * Usa scrypt do módulo nativo `node:crypto` — sem dependências nativas
 * (bcrypt/argon2 precisam de build) e sem nunca guardar a palavra-passe.
 *
 * Formato guardado:  scrypt$<N>$<r>$<p>$<saltBase64>$<hashBase64>
 * O schema (db/schema.sql) tem CHECK (password_hash LIKE 'scrypt$%'),
 * por isso uma palavra-passe em texto claro é rejeitada pela própria BD.
 */

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

const PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 } as const;
const SALT_BYTES = 16;

/** Palavra-passe mínima aceitável (regra da app, além do hash). */
export const MIN_PASSWORD_LENGTH = 12;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scrypt(password.normalize("NFKC"), salt, PARAMS.keylen, {
    N: PARAMS.N,
    r: PARAMS.r,
    p: PARAMS.p,
    maxmem: 128 * PARAMS.N * PARAMS.r * 2,
  });
  return [
    "scrypt",
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64"),
    hash.toString("base64"),
  ].join("$");
}

/** Comparação em tempo constante. Nunca lança: devolve `false` se o hash for inválido. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, n, r, p, saltB64, hashB64] = stored.split("$");
    if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;

    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const actual = await scrypt(password.normalize("NFKC"), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 128 * Number(n) * Number(r) * 2,
    });

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export interface PasswordProblem {
  ok: boolean;
  problems: string[];
}

/** Regras de força usadas ao criar/rotacionar credenciais. */
export function checkPasswordStrength(password: string): PasswordProblem {
  const problems: string[] = [];
  if (password.length < MIN_PASSWORD_LENGTH) {
    problems.push(`precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres`);
  }
  if (!/[a-z]/.test(password)) problems.push("precisa de letras minúsculas");
  if (!/[A-Z]/.test(password)) problems.push("precisa de letras maiúsculas");
  if (!/[0-9]/.test(password)) problems.push("precisa de algarismos");
  if (!/[^A-Za-z0-9]/.test(password)) problems.push("precisa de um símbolo (ex.: ! @ # $ %)");
  if (/(.)\1{2,}/.test(password)) problems.push("não pode repetir o mesmo caractere 3+ vezes");

  const weak = ["opala", "admin", "password", "123456", "restaurante", "luanda", "qwerty"];
  const lower = password.toLowerCase();
  if (weak.some((w) => lower.includes(w))) {
    problems.push("não pode conter palavras previsíveis (opala, admin, password, ...)");
  }

  return { ok: problems.length === 0, problems };
}

/**
 * Gera uma palavra-passe forte (sem caracteres ambíguos como O/0, l/1).
 * 24 caracteres ≈ 143 bits de entropia.
 */
export function generateStrongPassword(length = 24): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%*-_+=";
  const bytes = randomBytes(length * 2);
  let password = "";
  for (let i = 0; password.length < length && i < bytes.length; i++) {
    const byte = bytes[i];
    // rejeição simples para evitar viés de módulo
    if (byte >= 256 - (256 % alphabet.length)) continue;
    password += alphabet[byte % alphabet.length];
  }
  // garante que cumpre todas as regras
  const required = ["A", "a", "2", "!"];
  for (const char of required) {
    if (!password.includes(char)) password = char + password.slice(1);
  }
  return password;
}

/** Token opaco para cookies de sessão (64 hex chars = 32 bytes). */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}
