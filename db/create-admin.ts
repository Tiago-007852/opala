/**
 * Cria (ou roda) as credenciais de um administrador do painel.
 *
 *   npm run admin:create -- --email dono@opala.co.ao --name "Dono" --role owner
 *   npm run admin:create -- --email dono@opala.co.ao --update      # roda a palavra-passe
 *
 * A palavra-passe pode vir de ADMIN_PASSWORD (recomendado em automação).
 * Se não vier, é gerada aqui uma palavra-passe forte e mostrada UMA única vez.
 *
 * Nada é guardado em texto: para a BD vai apenas o hash scrypt (lib/password.ts).
 */

import {
  checkPasswordStrength,
  generateStrongPassword,
  hashPassword,
} from "../lib/password";
import { closePool, databaseUrl, describeDbError, query } from "./index";
import {
  createAdminUser,
  findAdminByEmail,
  setAdminPassword,
  type AdminRole,
  writeAudit,
} from "./repositories/admin";

interface Args {
  email?: string;
  name?: string;
  role?: AdminRole;
  update: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { update: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    if (arg === "--email" || arg === "-e") args.email = next();
    else if (arg === "--name" || arg === "-n") args.name = next();
    else if (arg === "--role" || arg === "-r") args.role = next() as AdminRole;
    else if (arg === "--update") args.update = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
  }
  return args;
}

function usage() {
  console.log(`
Cria credenciais de administrador do painel Opala.

  npm run admin:create -- --email <e-mail> [--name "Nome"] [--role owner|manager|staff] [--update]

  --update   roda a palavra-passe de um administrador já existente
             (invalidando todas as sessões abertas)

A palavra-passe vem da variável ADMIN_PASSWORD. Se não existir, é gerada
uma palavra-passe forte de 24 caracteres, mostrada apenas uma vez.
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) return usage();

  if (!args.email) {
    console.error("✖ Falta --email.");
    usage();
    process.exitCode = 1;
    return;
  }

  const email = args.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error("✖ E-mail inválido.");
    process.exitCode = 1;
    return;
  }

  if (!databaseUrl()) {
    console.error("✖ DATABASE_URL não está definida (ver .env.example).");
    process.exitCode = 1;
    return;
  }

  const role = (args.role ?? "owner") as AdminRole;
  if (!["owner", "manager", "staff"].includes(role)) {
    console.error("✖ --role tem de ser owner, manager ou staff.");
    process.exitCode = 1;
    return;
  }

  try {
    const tables = await query<{ ok: boolean }>(
      "SELECT to_regclass('public.admin_users') IS NOT NULL AS ok"
    );
    if (!tables[0]?.ok) {
      console.error("✖ Tabelas em falta. Corra primeiro: npm run db:migrate");
      process.exitCode = 1;
      return;
    }

    const existing = await findAdminByEmail(email);
    if (existing && !args.update) {
      console.error(`✖ Já existe um administrador com ${email}.`);
      console.error("  Para rodar a palavra-passe: npm run admin:create -- --email", email, "--update");
      process.exitCode = 1;
      return;
    }

    // ------------------------------------------------ palavra-passe
    const fromEnv = process.env.ADMIN_PASSWORD;
    const generated = !fromEnv;
    const password = fromEnv ?? generateStrongPassword(24);

    const strength = checkPasswordStrength(password);
    if (!strength.ok) {
      console.error("✖ Palavra-passe fraca:");
      for (const problem of strength.problems) console.error("   •", problem);
      if (generated) {
        console.error("  Isto não devia acontecer com a palavra-passe gerada — reporte o bug.");
      } else {
        console.error("  Retire ADMIN_PASSWORD do ambiente para gerar uma automaticamente.");
      }
      process.exitCode = 1;
      return;
    }

    const passwordHash = await hashPassword(password);

    // ------------------------------------------------------- gravar
    if (existing) {
      const updated = await setAdminPassword(email, passwordHash);
      if (!updated) throw new Error("Não foi possível atualizar a palavra-passe.");
      await writeAudit({
        adminUserId: existing.id,
        action: "admin.password_rotated",
        entity: "admin_users",
        entityId: existing.id,
        metadata: { email },
      });
      console.log(`✓ Palavra-passe de ${email} atualizada. Sessões anteriores foram invalidadas.`);
    } else {
      const created = await createAdminUser({
        email,
        name: args.name ?? "",
        passwordHash,
        role,
      });
      await writeAudit({
        adminUserId: created.id,
        action: "admin.created",
        entity: "admin_users",
        entityId: created.id,
        metadata: { email, role },
      });
      console.log(`✓ Administrador criado: ${created.email} (${created.role})`);
    }

    if (generated) {
      console.log("\n─────────────────────────────────────────────");
      console.log("  PALAVRA-PASSE (mostrada apenas esta vez):");
      console.log("  " + password);
      console.log("─────────────────────────────────────────────");
      console.log("  Guarde-a agora no seu gestor de palavras-passe.");
      console.log("  Não é possível recuperá-la depois — só rodá-la.\n");
    } else {
      console.log("  (palavra-passe recebida via ADMIN_PASSWORD — não guardada em ficheiros)");
    }
  } catch (error) {
    console.error("✖ Falha ao criar administrador:", describeDbError(error));
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}

main();
