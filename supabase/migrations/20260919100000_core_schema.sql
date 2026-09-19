-- Ajyal Academy — core schema. Contract: docs/04-data-model.md
--
-- Conventions
--   * Money is integer FILS (1 BD = 1000 fils) in columns named *_fils.
--   * Percent discounts are stored as basis points (10% = 1000); fixed discounts as fils.
--   * Soft delete: players.deleted_at, subscriptions.cancelled_at.
--   * Application errors raised by functions use the message format 'ajyal:<code>'.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'coach');
create type public.discount_type as enum ('percent', 'fixed');
create type public.payment_method as enum ('cash', 'benefit', 'bank_transfer', 'other');
create type public.attendance_status as enum ('present', 'absent');
create type public.expense_category as enum (
  'coach_salary', 'field_rent', 'transportation', 'equipment', 'other'
);

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users; rows are created by the create-coach Edge Function / seed)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  email text not null,
  role public.user_role not null,
  phone text,
  monthly_salary_fils integer not null default 0 check (monthly_salary_fils >= 0),
  active boolean not null default true,
  preferred_language text not null default 'ar' check (preferred_language in ('ar', 'en')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------------
create table public.players (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) > 0),
  cpr text not null check (cpr ~ '^[0-9]{9}$'),
  date_of_birth date not null,
  address text,
  school text,
  phone text not null check (length(trim(phone)) > 0),
  has_disease boolean not null default false,
  disease_description text,
  coach_id uuid references public.profiles (id) on delete set null,
  created_by uuid default auth.uid () references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null,
  constraint players_disease_description_required check (
    (has_disease and length(trim(coalesce(disease_description, ''))) > 0)
    or (not has_disease and disease_description is null)
  )
);

-- CPR is unique among players that have not been removed.
create unique index players_cpr_active_key on public.players (cpr) where deleted_at is null;
create index players_coach_idx on public.players (coach_id) where deleted_at is null;
create index players_full_name_trgm_idx on public.players using gin (full_name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- plans and settings (reference data — inserted here so every environment has it)
-- ---------------------------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('solo', 'duo', 'trio', 'quad')),
  player_count smallint not null unique check (player_count between 1 and 4),
  price_fils integer not null check (price_fils >= 0),
  active boolean not null default true
);

insert into public.plans (code, player_count, price_fils) values
  ('solo', 1, 20000),
  ('duo', 2, 35000),
  ('trio', 3, 50000),
  ('quad', 4, 60000);

create table public.settings (
  id boolean primary key default true check (id), -- single-row table
  -- PLACEHOLDERS until the owner confirms the real amounts (docs/08-decisions.md Q-001, Q-002).
  tshirt_fee_fils integer not null default 5000 check (tshirt_fee_fils >= 0),
  transport_fee_fils integer not null default 10000 check (transport_fee_fils >= 0),
  expiring_soon_days integer not null default 7 check (expiring_soon_days >= 0)
);

insert into public.settings default values;

-- ---------------------------------------------------------------------------
-- discounts
-- ---------------------------------------------------------------------------
create table public.discounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  code text not null check (length(trim(code)) > 0),
  type public.discount_type not null,
  value integer not null check (value > 0),
  valid_from date,
  valid_to date,
  max_uses integer check (max_uses is null or max_uses > 0),
  active boolean not null default true,
  created_by uuid default auth.uid () references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint discounts_percent_range check (type <> 'percent' or value <= 10000),
  constraint discounts_valid_dates check (valid_from is null or valid_to is null or valid_to >= valid_from)
);

create unique index discounts_code_key on public.discounts (lower(code));

-- ---------------------------------------------------------------------------
-- subscriptions, their players, and payments
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id),
  start_date date not null,
  end_date date not null,
  plan_price_fils integer not null check (plan_price_fils >= 0),
  tshirt_total_fils integer not null default 0 check (tshirt_total_fils >= 0),
  transport_total_fils integer not null default 0 check (transport_total_fils >= 0),
  discount_id uuid references public.discounts (id),
  discount_type public.discount_type,
  discount_value integer,
  discount_reason text,
  discount_fils integer not null default 0 check (discount_fils >= 0),
  total_fils integer not null check (total_fils >= 0),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  cancel_reason text,
  created_by uuid default auth.uid () references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint subscriptions_dates check (end_date >= start_date),
  -- The stored total must always equal its parts (business rule in docs/05-business-rules.md).
  constraint subscriptions_total_matches check (
    total_fils = plan_price_fils + tshirt_total_fils + transport_total_fils - discount_fils
  ),
  constraint subscriptions_discount_consistent check (
    (discount_type is null and discount_value is null and discount_fils = 0)
    or (discount_type is not null and discount_value is not null)
  ),
  -- A manual discount (no discount_id) must explain itself.
  constraint subscriptions_manual_discount_reason check (
    discount_type is null
    or discount_id is not null
    or length(trim(coalesce(discount_reason, ''))) > 0
  )
);

create index subscriptions_dates_idx on public.subscriptions (start_date, end_date);

create table public.subscription_players (
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  player_id uuid not null references public.players (id),
  tshirt_fee_fils integer not null default 0 check (tshirt_fee_fils >= 0),
  transport_fee_fils integer not null default 0 check (transport_fee_fils >= 0),
  primary key (subscription_id, player_id)
);

create index subscription_players_player_idx on public.subscription_players (player_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id),
  amount_fils integer not null check (amount_fils > 0),
  paid_at date not null default current_date,
  method public.payment_method not null default 'cash',
  note text,
  received_by uuid default auth.uid () references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index payments_paid_at_idx on public.payments (paid_at);
create index payments_subscription_idx on public.payments (subscription_id);

-- ---------------------------------------------------------------------------
-- training sessions and attendance
-- ---------------------------------------------------------------------------
create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null,
  start_time time not null,
  end_time time not null,
  coach_id uuid not null references public.profiles (id),
  location text,
  notes text,
  cancelled_at timestamptz,
  created_by uuid default auth.uid () references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint training_sessions_time_order check (end_time > start_time)
);

create index training_sessions_date_idx on public.training_sessions (session_date);
create index training_sessions_coach_idx on public.training_sessions (coach_id, session_date);

create table public.attendance (
  session_id uuid not null references public.training_sessions (id) on delete cascade,
  player_id uuid not null references public.players (id),
  status public.attendance_status not null,
  marked_by uuid default auth.uid () references public.profiles (id) on delete set null,
  marked_at timestamptz not null default now(),
  primary key (session_id, player_id)
);

create index attendance_player_idx on public.attendance (player_id);

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  category public.expense_category not null,
  amount_fils integer not null check (amount_fils > 0),
  expense_date date not null default current_date,
  coach_id uuid references public.profiles (id) on delete set null,
  description text,
  created_by uuid default auth.uid () references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint expenses_salary_has_coach check (category <> 'coach_salary' or coach_id is not null),
  constraint expenses_only_salary_has_coach check (category = 'coach_salary' or coach_id is null)
);

create index expenses_date_idx on public.expenses (expense_date);

-- ---------------------------------------------------------------------------
-- activity_log — written only by SECURITY DEFINER functions (see activity migration)
-- ---------------------------------------------------------------------------
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  -- Snapshot for display (actor_name, player_name, …) so removed rows still render.
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_created_idx on public.activity_log (created_at desc);
create index activity_log_actor_idx on public.activity_log (actor_id, created_at desc);
