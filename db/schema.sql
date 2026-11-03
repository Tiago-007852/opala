-- =====================================================================
-- RESTAURANTE OPALA — ESQUEMA DO BANCO (PostgreSQL / Neon)
-- =====================================================================
-- Aplicar com:  npm run db:migrate
--
-- Este ficheiro é IDEMPOTENTE: pode ser executado várias vezes sem erro,
-- por isso serve tanto para a primeira criação como para evoluir o schema.
-- É executado dentro de uma transação por db/migrate.ts.
--
-- Convenções:
--   * dinheiro  -> numeric(12,2)  (nunca float)
--   * datas     -> timestamptz (UTC); dias -> date; horas -> time
--   * ids       -> text com prefixo legível (OP-, BK-, E-, c-, f-, i-)
--                  ou slug para o cardápio (o front usa o id para achar a foto)
-- =====================================================================

-- Sem extensões: gen_random_uuid() é nativo no Postgres 13+ (Neon roda 16/17).

-- ---------------------------------------------------------------- TIPOS
-- Enums espelham src/types.ts e evitam lixo vindo do cliente.

DO $$ BEGIN
  CREATE TYPE menu_category AS ENUM (
    'pequeno-almoco', 'entradas', 'petiscos', 'principais',
    'massas', 'carnes', 'peixes', 'fastfood', 'sobremesas', 'bebidas'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE menu_tag AS ENUM (
    'Novo', 'Mais vendido', 'Promoção', 'Vegano', 'Sem Glúten', 'Picante'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('recebido', 'preparando', 'pronto', 'entregue', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cartao', 'transferência', 'dinheiro', 'online');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('confirmado', 'cancelado', 'concluido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE table_status AS ENUM ('livre', 'ocupada', 'reservada', 'pagamento');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE financial_type AS ENUM ('receita', 'despesa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE coupon_type AS ENUM ('percentage', 'fixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE admin_role AS ENUM ('owner', 'manager', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------ SEQUÊNCIAS
-- Mantêm o formato dos ids que o front já exibe (OP-9001, BK-2001, ...).

CREATE SEQUENCE IF NOT EXISTS orders_id_seq     START WITH 9001;
CREATE SEQUENCE IF NOT EXISTS bookings_id_seq   START WITH 2001;
CREATE SEQUENCE IF NOT EXISTS employees_id_seq  START WITH 10;
CREATE SEQUENCE IF NOT EXISTS inventory_id_seq  START WITH 10;
CREATE SEQUENCE IF NOT EXISTS financial_id_seq  START WITH 100;

-- ------------------------------------------------------------- FUNÇÕES

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------------- TABELAS

-- ============================ CARDÁPIO ================================
CREATE TABLE IF NOT EXISTS menu_items (
  id            text PRIMARY KEY,
  name          text NOT NULL CHECK (length(btrim(name)) > 0),
  description   text NOT NULL DEFAULT '',
  price         numeric(12,2) NOT NULL CHECK (price >= 0),
  category      menu_category NOT NULL,
  image         text NOT NULL DEFAULT '',
  average_time  integer NOT NULL DEFAULT 0 CHECK (average_time >= 0),
  ingredients   text[] NOT NULL DEFAULT '{}',
  sauces        text[] NOT NULL DEFAULT '{}',
  tags          menu_tag[] NOT NULL DEFAULT '{}',
  -- extras: [{"name":"Quiabos salteados","price":2500}] — bloco editado em conjunto
  extras        jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(extras) = 'array'),
  -- nutrition: {"calories":0,"protein":0,"carbs":0,"fat":0} (opcional)
  nutrition     jsonb,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================ CLIENTES ================================
CREATE TABLE IF NOT EXISTS customers (
  id              text PRIMARY KEY,
  name            text NOT NULL CHECK (length(btrim(name)) > 0),
  email           text NOT NULL DEFAULT '',
  phone           text NOT NULL DEFAULT '',
  total_spent     numeric(12,2) NOT NULL DEFAULT 0 CHECK (total_spent >= 0),
  visits          integer NOT NULL DEFAULT 0 CHECK (visits >= 0),
  favorite_dish   text NOT NULL DEFAULT '',
  -- texto livre por compatibilidade com o painel ("10 de Outubro", "Não informado")
  birthday        text NOT NULL DEFAULT '',
  loyalty_points  integer NOT NULL DEFAULT 0 CHECK (loyalty_points >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_name_idx  ON customers (lower(name));
CREATE INDEX IF NOT EXISTS customers_email_idx ON customers (lower(email));

-- ============================= CUPÕES =================================
CREATE TABLE IF NOT EXISTS coupons (
  code        text PRIMARY KEY CHECK (code = upper(code) AND length(code) BETWEEN 3 AND 32),
  discount    numeric(12,2) NOT NULL CHECK (discount > 0),
  type        coupon_type NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  min_spend   numeric(12,2) NOT NULL DEFAULT 0 CHECK (min_spend >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coupons_percentage_max CHECK (type <> 'percentage' OR discount <= 100)
);

-- =========================== FUNCIONÁRIOS =============================
CREATE TABLE IF NOT EXISTS employees (
  id           text PRIMARY KEY,
  name         text NOT NULL CHECK (length(btrim(name)) > 0),
  role         text NOT NULL DEFAULT '',
  photo        text NOT NULL DEFAULT '',
  shift        text NOT NULL DEFAULT '',
  phone        text NOT NULL DEFAULT '',
  email        text NOT NULL DEFAULT '',
  permissions  text[] NOT NULL DEFAULT '{}',
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================== ESTOQUE ===============================
CREATE TABLE IF NOT EXISTS inventory_items (
  id          text PRIMARY KEY DEFAULT ('i' || nextval('inventory_id_seq'::regclass)),
  name        text NOT NULL UNIQUE CHECK (length(btrim(name)) > 0),
  quantity    numeric(12,2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit        text NOT NULL DEFAULT 'un',
  min_limit   numeric(12,2) NOT NULL DEFAULT 0 CHECK (min_limit >= 0),
  category    text NOT NULL DEFAULT 'Geral',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================== MESAS ================================
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id               text PRIMARY KEY,
  status           table_status NOT NULL DEFAULT 'livre',
  capacity         integer NOT NULL CHECK (capacity > 0),
  waiter_name      text,
  -- ponteiro denormalizado para o pedido em curso (FK criada após "orders")
  active_order_id  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ============================== PEDIDOS ===============================
CREATE TABLE IF NOT EXISTS orders (
  id              text PRIMARY KEY,
  table_id        text REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  customer_id     text REFERENCES customers(id) ON DELETE SET NULL,
  customer_name   text,
  subtotal        numeric(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax             numeric(12,2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  discount        numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total           numeric(12,2) NOT NULL CHECK (total >= 0),
  payment_method  payment_method NOT NULL,
  status          order_status NOT NULL DEFAULT 'recebido',
  notes           text NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- REGRA: o total tem de fechar com as parcelas (evita pedido inconsistente)
  CONSTRAINT orders_total_matches_parts
    CHECK (round(total, 2) = round(subtotal + tax - discount, 2))
);

CREATE INDEX IF NOT EXISTS orders_status_idx      ON orders (status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx  ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_table_id_idx    ON orders (table_id);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders (customer_id);

-- ---------------------------------------------------------------------
-- Itens do pedido.
-- Guardam SNAPSHOT de nome e preço: se o prato mudar de preço ou for
-- apagado do cardápio, o histórico continua correto.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id    text REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name       text NOT NULL CHECK (length(btrim(item_name)) > 0),
  unit_price      numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  quantity        integer NOT NULL CHECK (quantity > 0),
  -- extras: [{"name":"Quiabos","price":2500}] congelados no momento do pedido
  extras          jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(extras) = 'array'),
  selected_sauce  text NOT NULL DEFAULT '',
  notes           text NOT NULL DEFAULT '',
  line_total      numeric(12,2) NOT NULL CHECK (line_total >= 0),
  position        integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id);

-- FK circular: mesas -> pedido em curso
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restaurant_tables_active_order_fk') THEN
    ALTER TABLE restaurant_tables
      ADD CONSTRAINT restaurant_tables_active_order_fk
      FOREIGN KEY (active_order_id) REFERENCES orders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================== RESERVAS ==============================
CREATE TABLE IF NOT EXISTS bookings (
  id             text PRIMARY KEY,
  name           text NOT NULL CHECK (length(btrim(name)) > 0),
  phone          text NOT NULL DEFAULT '',
  email          text NOT NULL DEFAULT '',
  booking_date   date NOT NULL,
  booking_time   time NOT NULL,
  people         integer NOT NULL CHECK (people BETWEEN 1 AND 40),
  table_id       text REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  notes          text NOT NULL DEFAULT '',
  status         booking_status NOT NULL DEFAULT 'confirmado',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_email_format
    CHECK (email = '' OR email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

CREATE INDEX IF NOT EXISTS bookings_date_idx   ON bookings (booking_date);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings (status);

-- ============================ FINANCEIRO ==============================
CREATE TABLE IF NOT EXISTS financial_records (
  id           text PRIMARY KEY,
  description  text NOT NULL CHECK (length(btrim(description)) > 0),
  amount       numeric(12,2) NOT NULL CHECK (amount > 0),
  type         financial_type NOT NULL,
  category     text NOT NULL DEFAULT 'Geral',
  order_id     text REFERENCES orders(id) ON DELETE SET NULL,
  customer_id  text REFERENCES customers(id) ON DELETE SET NULL,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financial_records_occurred_idx ON financial_records (occurred_at DESC);
CREATE INDEX IF NOT EXISTS financial_records_type_idx     ON financial_records (type);

-- ------------------- MOVIMENTOS DE ESTOQUE (auditoria) ----------------
CREATE TABLE IF NOT EXISTS inventory_movements (
  id          bigserial PRIMARY KEY,
  item_id     text NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  delta       numeric(12,2) NOT NULL,
  reason      text NOT NULL DEFAULT '',
  order_id    text REFERENCES orders(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_movements_delta_not_zero CHECK (delta <> 0)
);

CREATE INDEX IF NOT EXISTS inventory_movements_item_idx ON inventory_movements (item_id, created_at DESC);

-- REGRA: a quantidade do estoque é sempre a soma dos movimentos.
-- Nunca se ajusta "à mão" sem deixar rasto; o stock nunca fica negativo.
CREATE OR REPLACE FUNCTION apply_inventory_movement() RETURNS trigger AS $$
BEGIN
  UPDATE inventory_items
     SET quantity = GREATEST(quantity + NEW.delta, 0),
         updated_at = now()
   WHERE id = NEW.item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de estoque % inexistente', NEW.item_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_apply_inventory_movement ON inventory_movements;
CREATE TRIGGER trg_apply_inventory_movement
  AFTER INSERT ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION apply_inventory_movement();

-- ========================== CONFIGURAÇÕES =============================
-- Linha única (id = 1). Alimenta a aba "Configurações" do painel.
CREATE TABLE IF NOT EXISTS restaurant_settings (
  id                     smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name                   text NOT NULL DEFAULT 'Restaurante Opala',
  service_fee_pct        numeric(5,2) NOT NULL DEFAULT 10 CHECK (service_fee_pct BETWEEN 0 AND 100),
  currency               text NOT NULL DEFAULT 'AOA',
  phone                  text NOT NULL DEFAULT '',
  city                   text NOT NULL DEFAULT '',
  loyalty_points_per_100 numeric(6,2) NOT NULL DEFAULT 1 CHECK (loyalty_points_per_100 >= 0),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- ===================== ADMINISTRAÇÃO / AUTENTICAÇÃO ===================
-- O painel admin passa a ter credenciais reais. A palavra-passe NUNCA é
-- guardada em texto: só o hash scrypt (ver lib/password.ts).
CREATE TABLE IF NOT EXISTS admin_users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text NOT NULL,
  name                text NOT NULL DEFAULT '',
  password_hash       text NOT NULL CHECK (password_hash LIKE 'scrypt$%'),
  role                admin_role NOT NULL DEFAULT 'owner',
  is_active           boolean NOT NULL DEFAULT true,
  failed_attempts     integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until        timestamptz,
  last_login_at       timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_key ON admin_users (lower(btrim(email)));

CREATE TABLE IF NOT EXISTS admin_sessions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id  uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  -- guarda apenas o SHA-256 do token do cookie (nunca o token em claro)
  token_hash     text NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  revoked_at     timestamptz,
  ip             text,
  user_agent     text,
  CONSTRAINT admin_sessions_expiry_order CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS admin_sessions_user_idx    ON admin_sessions (admin_user_id);
CREATE INDEX IF NOT EXISTS admin_sessions_expires_idx ON admin_sessions (expires_at);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id             bigserial PRIMARY KEY,
  admin_user_id  uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  action         text NOT NULL CHECK (length(btrim(action)) > 0),
  entity         text NOT NULL DEFAULT '',
  entity_id      text NOT NULL DEFAULT '',
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log (created_at DESC);

-- ===================== CONTAS DO SITE (CLIENTES) =====================
-- Um cliente do site cria conta com e-mail + palavra-passe. A conta liga-se ao
-- registo de CRM (`customers`) para o histórico de reservas/pedidos seguir a
-- mesma pessoa. NÃO dá acesso ao painel: quem manda no painel é `admin_users`,
-- e só o e-mail que lá existir com is_active = true pode entrar.

CREATE TABLE IF NOT EXISTS customer_accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         text NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  email               text NOT NULL,
  password_hash       text NOT NULL CHECK (password_hash LIKE 'scrypt$%'),
  failed_attempts     integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until        timestamptz,
  last_login_at       timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_accounts_email_format
    CHECK (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

-- um e-mail = uma conta (sem distinguir maiúsculas)
CREATE UNIQUE INDEX IF NOT EXISTS customer_accounts_email_key
  ON customer_accounts (lower(btrim(email)));

CREATE TABLE IF NOT EXISTS customer_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  -- SHA-256 do token do cookie; o token em claro só vive no browser
  token_hash          text NOT NULL UNIQUE CHECK (length(token_hash) = 64),
  created_at          timestamptz NOT NULL DEFAULT now(),
  last_seen_at        timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  revoked_at          timestamptz,
  ip                  text,
  user_agent          text,
  CONSTRAINT customer_sessions_expiry_order CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS customer_sessions_account_idx ON customer_sessions (customer_account_id);
CREATE INDEX IF NOT EXISTS customer_sessions_expires_idx ON customer_sessions (expires_at);

-- a reserva passa a ficar ligada à conta (dados preenchidos automaticamente)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_id text REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS bookings_customer_id_idx ON bookings (customer_id);

-- ---------------------------------------------- updated_at automático
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'menu_items', 'customers', 'coupons', 'employees', 'inventory_items',
    'restaurant_tables', 'orders', 'bookings', 'restaurant_settings', 'admin_users',
    'customer_accounts'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t
    );
  END LOOP;
END $$;

-- =============================== VIEWS ================================
-- Leitura agregada para o dashboard. Repositórios podem usar estas views
-- em vez de repetir a aritmética de dinheiro.

CREATE OR REPLACE VIEW v_low_stock AS
SELECT id, name, quantity, unit, min_limit, category,
       (quantity <= min_limit) AS below_minimum,
       updated_at
  FROM inventory_items
 WHERE quantity <= min_limit;

CREATE OR REPLACE VIEW v_daily_revenue AS
SELECT date_trunc('day', occurred_at)::date AS day,
       SUM(CASE WHEN type = 'receita' THEN amount ELSE 0 END)  AS revenue,
       SUM(CASE WHEN type = 'despesa' THEN amount ELSE 0 END)  AS expenses,
       SUM(CASE WHEN type = 'receita' THEN amount ELSE -amount END) AS net,
       COUNT(*) AS records
  FROM financial_records
 GROUP BY 1;

CREATE OR REPLACE VIEW v_table_overview AS
SELECT t.id,
       t.status,
       t.capacity,
       t.waiter_name,
       t.active_order_id,
       o.status  AS order_status,
       o.total   AS order_total,
       o.created_at AS order_created_at
  FROM restaurant_tables t
  LEFT JOIN orders o ON o.id = t.active_order_id;

CREATE OR REPLACE VIEW v_customer_stats AS
SELECT c.id,
       c.name,
       c.email,
       c.visits,
       c.total_spent,
       c.loyalty_points,
       COUNT(o.id)               AS orders_count,
       COALESCE(AVG(o.total), 0) AS avg_ticket,
       MAX(o.created_at)         AS last_order_at
  FROM customers c
  LEFT JOIN orders o ON o.customer_id = c.id AND o.status <> 'cancelado'
 GROUP BY c.id;

-- Cash do dia (substitui o cálculo "revenueToday" que somava tudo).
CREATE OR REPLACE VIEW v_today_cash AS
SELECT COALESCE(SUM(CASE WHEN type = 'receita' THEN amount ELSE 0 END), 0) AS revenue,
       COALESCE(SUM(CASE WHEN type = 'despesa' THEN amount ELSE 0 END), 0) AS expenses,
       COUNT(*) AS records
  FROM financial_records
 WHERE occurred_at >= date_trunc('day', now())
   AND occurred_at <  date_trunc('day', now()) + interval '1 day';

-- ---------------------------------------------------------------- NOTA
-- Sobre RLS: o Neon é acedido por uma única role de aplicação (a da
-- connection string) e toda a exposição passa pela API Express, que é o
-- único ponto de acesso. RLS só faria sentido com uma role por utilizador
-- final; por isso a proteção vive nos GRANTs (uma role "app" sem
-- superuser, documentada em db/README.md) e na camada de autenticação.
