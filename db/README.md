# Banco de dados — Opala (Neon / PostgreSQL)

Camada de dados do painel e do portal. Substitui os arrays em memória do
`server.ts` por Postgres no [Neon](https://neon.tech).

> Status: **arquitetura pronta e testada contra um Postgres real (PGlite)**.
> Falta apenas a connection string para criar as tabelas na sua conta Neon.

---

## 1. Criar o projeto no Neon

1. Entre em <https://console.neon.tech> → **New Project**
   - Nome: `opala`
   - Região: a mais próxima de Luanda (ex.: `aws-eu-central-1` / Frankfurt)
   - Versão do Postgres: 16 ou 17
2. No painel do projeto, abra **Connect** e copie a **connection string**:
   - use a opção **Pooled connection** (o host termina em `-pooler`)
   - formato: `postgresql://user:senha@ep-xxxx-pooler.regiao.aws.neon.tech/neondb?sslmode=require`
3. Cole no `.env` (nunca no Git):

```bash
cp .env.example .env
# edite .env e preencha DATABASE_URL="..."
```

## 2. Comandos

| Comando | O que faz |
|---|---|
| `npm run db:migrate` | Cria/atualiza tabelas, enums, índices, triggers e views |
| `npm run db:seed` | Importa o cardápio de `src/data/menu.ts` + mesas, estoque, equipa, cupões |
| `npm run db:seed:demo` | Dados de demonstração (pedidos, reservas, clientes). Opcional |
| `npm run db:setup` | `db:migrate` + `db:seed` (instalação de raiz) |
| `npm run db:check` | Diagnóstico: ligação, contagens, caixa do dia, estoque em alerta |
| `npm run admin:create -- --email <e-mail>` | Gera credenciais fortes de administrador |

Instalação completa de raiz:

```bash
npm install
cp .env.example .env          # preencher DATABASE_URL
npm run db:setup
npm run admin:create -- --email dono@opala.co.ao --name "Dono"
npm run dev
```

## 3. Mapa do schema

`db/schema.sql` é idempotente — pode ser aplicado várias vezes. O checksum fica
registado em `schema_migrations`.

### Tabelas

| Tabela | Papel |
|---|---|
| `menu_items` | Cardápio (107 pratos). `id` é slug e casa com o nome do ficheiro da foto |
| `restaurant_tables` | Mesas do salão + pedido em curso |
| `orders` / `order_items` | Pedidos. Itens guardam **snapshot** de nome e preço |
| `bookings` | Reservas, com mesa atribuída quando há disponibilidade |
| `customers` | CRM / fidelidade |
| `employees` | Equipa e permissões |
| `inventory_items` / `inventory_movements` | Estoque + histórico de movimentos |
| `financial_records` | Receitas e despesas |
| `coupons` | Cupões de desconto |
| `restaurant_settings` | Linha única de configuração (taxa de serviço, etc.) |
| `customer_accounts` | Contas de cliente do site (hash scrypt), ligadas a `customers` |
| `customer_sessions` | Sessões de cliente (SHA-256 do token, validade em dias) |
| `admin_users` | Credenciais do painel (hash scrypt). **Só e-mails aqui presentes, com `is_active`, entram no painel** |
| `admin_sessions` | Sessões (guardadas como SHA-256 do token) |
| `admin_audit_log` | Registo de ações administrativas |
| `schema_migrations` | Controlo de migrações |

### Views

`v_daily_revenue`, `v_today_cash`, `v_low_stock`, `v_table_overview`,
`v_customer_stats`.

### Regras aplicadas na base de dados

Regras que antes viviam só no browser passam a ser garantidas pelo Postgres:

- **`orders_total_matches_parts`** — `total = subtotal + tax − desconto`. Um
  pedido incoerente é rejeitado, mesmo que a API falhe.
- **Preços recalculados no servidor** — `createOrder` ignora qualquer valor
  enviado pelo cliente e lê os preços de `menu_items`.
- **Cupões** — só aplicam se existirem, estiverem ativos e atingirem o consumo
  mínimo; desconto percentual nunca passa de 100%; desconto nunca excede o valor.
- **Estoque** — a quantidade só muda por `inventory_movements`; um trigger aplica
  o delta com piso em **zero** e regista quem/o quê mexeu.
- **Enums** — categoria, estado de pedido, forma de pagamento, tipo de cupão, etc.
  não aceitam valores inventados.
- **CHECKs** — quantidades > 0, valores ≥ 0, capacidade de mesa > 0, e-mail de
  reserva válido, 1–40 pessoas por reserva.
- **Credenciais** — `password_hash` só aceita o formato `scrypt$…`: guardar uma
  palavra-passe em texto claro é impossível.
- **Unicidade** — e-mail de admin é único (case-insensitive); código de cupão em
  maiúsculas.
- **FKs** — apagar um prato não quebra o histórico (`ON DELETE SET NULL` +
  snapshot); apagar um pedido leva os itens (`ON DELETE CASCADE`).
- **`updated_at` automático** por trigger em todas as tabelas editáveis.
- **Remoção lógica** — pratos e funcionários são desativados (`is_active`), não
  apagados.

### Sobre RLS

O Neon é acedido por uma única role de aplicação (a da connection string) e toda
a exposição passa pela API Express. RLS só faria sentido com uma role por
utilizador final; a proteção vive nos GRANTs dessa role e na autenticação da API.
Se quiser uma role dedicada com menos privilégios, crie-a no SQL Editor do Neon e
gere uma connection string para ela.

## 4. Segurança das credenciais

- Hash **scrypt** (N=16384, r=8, p=1, salt 16 bytes) de `node:crypto` — sem
  dependências nativas.
- Palavra-passe mínima: 12 caracteres, maiúsculas, minúsculas, algarismo, símbolo;
  palavras previsíveis (`opala`, `admin`, `password`…) são recusadas.
- `npm run admin:create` gera 24 caracteres aleatórios e mostra-os **uma única vez**.
- Login admite 5 tentativas; a conta fica bloqueada 15 minutos.
- Sessões: token de 32 bytes em cookie (a BD só guarda o SHA-256), validade de
  `ADMIN_SESSION_TTL_HOURS` (8h por omissão); rodar a palavra-passe invalida todas.

## 5. Estrutura de ficheiros

```
db/
├── schema.sql              DDL completo (tabelas, regras, índices, triggers, views)
├── index.ts                pool pg, query/queryOne, transações, health check
├── state.ts                loadState() → mesmo formato do antigo GET /api/state
├── migrate.ts              aplica schema.sql + schema_migrations
├── seed.ts                 catálogo e configuração base
├── seed-demo.ts            dados de demonstração
├── check.ts                diagnóstico
├── create-admin.ts         credenciais de administrador
└── repositories/
    ├── menu.ts       orders.ts      tables.ts     bookings.ts
    ├── employees.ts  inventory.ts   finance.ts    customers.ts
    ├── coupons.ts    settings.ts    admin.ts
lib/
└── password.ts             scrypt, força de palavra-passe, tokens
```

## 6. O que falta (próximo passo)

1. Ligar o `server.ts` aos repositórios (`isDatabaseConfigured()` permite manter
   o modo memória como fallback).
2. Middleware de autenticação nas rotas `/api/*` + tela de login no painel.
3. Criar as credenciais do dono (`npm run admin:create`).
