-- FORMA — initial schema (personal style analysis for men)
-- Money is stored as integer paise (1 INR = 100 paise). Rates are stored in basis points (1800 = 18.00%).
-- All application access is server-side through DATABASE_URL. Row Level Security is enabled on every
-- table with no policies for Supabase's `anon` / `authenticated` roles (see 20261120000002_lockdown.sql).

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------------------------------------------------------------- enums
create type user_role as enum ('stylist', 'admin');
create type analysis_status as enum ('preview', 'paid', 'released', 'revision_requested');
create type observation_source as enum ('ai', 'quiz');
create type order_status as enum ('awaiting_payment', 'paid', 'payment_failed', 'expired', 'refunded');
create type plan_code as enum ('standard', 'priority');
create type discount_type as enum ('percent', 'fixed');
create type email_status as enum ('logged', 'sent', 'failed');
create type revision_status as enum ('open', 'resolved');

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------------- staff accounts (stylists & admins)
-- Customers never need an account: each analysis is reached through a secret link.
create table profiles (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique check (length(email) <= 254),
  password_hash text not null,
  full_name text not null check (length(full_name) between 1 and 120),
  role user_role not null default 'stylist',
  is_disabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on profiles for each row execute function set_updated_at();

create table sessions (
  token_hash text primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  user_agent text
);
create index sessions_user_idx on sessions(user_id);

create table password_reset_tokens (
  token_hash text primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- analyses
create sequence analysis_ref_seq start 10001;

create table analyses (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,                       -- human reference shown to customer & support, e.g. FM-10001
  token_hash text not null unique,                -- sha256 of the secret link token, used for lookups
  token_sealed text not null,                     -- the token encrypted with APP_SECRET, so "find my report" can re-send it
  status analysis_status not null default 'preview',
  first_name text not null check (length(first_name) between 1 and 60),
  email citext check (email is null or length(email) <= 254),
  phone text check (phone is null or phone ~ '^[6-9][0-9]{9}$'),
  marketing_consent boolean not null default false,
  quiz jsonb not null,
  observations jsonb not null,                    -- frame, colouring, face shape etc. used to build the report
  observation_source observation_source not null,
  ai_model text,
  ai_notes text,                                  -- why AI was not used (no photos, not configured, refused, error)
  overrides jsonb not null default '{}',          -- stylist corrections to observations
  report jsonb,                                   -- full generated (and possibly stylist-edited) report
  report_edited boolean not null default false,
  stylist_note text check (length(stylist_note) <= 4000),
  reviewed_by uuid references profiles(id) on delete set null,
  plan plan_code,
  due_at timestamptz,                             -- stylist review deadline, set at payment
  paid_at timestamptz,
  released_at timestamptz,
  headshot_path text,
  fullbody_path text,
  photo_consent_at timestamptz,
  photos_deleted_at timestamptz,
  source jsonb not null default '{}',             -- utm_* attribution captured at start
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index analyses_status_idx on analyses(status, due_at);
create index analyses_email_idx on analyses(email);
create index analyses_created_idx on analyses(created_at desc);
create trigger analyses_updated before update on analyses for each row execute function set_updated_at();

create table analysis_events (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references analyses(id) on delete cascade,
  message text not null,
  customer_visible boolean not null default false,
  actor_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index analysis_events_idx on analysis_events(analysis_id, created_at);

create table revision_requests (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references analyses(id) on delete cascade,
  message text not null check (length(message) between 10 and 2000),
  status revision_status not null default 'open',
  response text,
  resolved_by uuid references profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index revision_requests_analysis_idx on revision_requests(analysis_id);
create unique index revision_requests_one_open on revision_requests(analysis_id) where status = 'open';

-- ---------------------------------------------------------------- discounts
create table discounts (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique check (code ~ '^[A-Za-z0-9_-]{3,30}$'),
  description text,
  type discount_type not null,
  value int not null check (value > 0), -- percent: basis points (1000 = 10%); fixed: paise
  max_uses int check (max_uses > 0),
  used_count int not null default 0 check (used_count >= 0),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (type <> 'percent' or value <= 10000)
);

-- ---------------------------------------------------------------- orders & payments
create sequence order_number_seq start 5001;

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  analysis_id uuid not null references analyses(id) on delete restrict,
  plan plan_code not null,
  contact_name text not null,
  contact_email citext not null,
  contact_phone text not null check (contact_phone ~ '^[6-9][0-9]{9}$'),
  list_price_paise int not null check (list_price_paise > 0),
  discount_paise int not null default 0 check (discount_paise >= 0),
  discount_code citext,
  total_paise int not null check (total_paise > 0),
  tax_rate_bp int not null default 0 check (tax_rate_bp between 0 and 4000),
  tax_paise int not null default 0 check (tax_paise >= 0),  -- GST included in total_paise
  status order_status not null default 'awaiting_payment',
  razorpay_order_id text unique,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_paise = list_price_paise - discount_paise)
);
create index orders_analysis_idx on orders(analysis_id);
create index orders_status_idx on orders(status, created_at desc);
create trigger orders_updated before update on orders for each row execute function set_updated_at();

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  provider text not null check (provider in ('razorpay', 'mock')),
  provider_order_id text,
  provider_payment_id text unique,
  amount_paise int not null,
  status text not null,
  method text,
  fee_paise int,
  error_description text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on payments(order_id);
create trigger payments_updated before update on payments for each row execute function set_updated_at();

create table refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  amount_paise int not null check (amount_paise > 0),
  provider_refund_id text unique,
  status text not null,
  reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (provider, event_id)
);

-- ---------------------------------------------------------------- operations
create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

create table audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  metadata jsonb not null default '{}',
  ip text,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on audit_logs(created_at desc);

create table email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email citext not null,
  template text not null,
  subject text not null,
  html text not null,
  text_body text not null,
  status email_status not null,
  provider_message_id text,
  error text,
  analysis_id uuid references analyses(id) on delete set null,
  created_at timestamptz not null default now()
);
create index email_outbox_created_idx on email_outbox(created_at desc);

create table rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null
);
