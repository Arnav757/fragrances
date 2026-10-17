-- NOIR & NOTES — initial schema
-- Money is stored as integer paise (1 INR = 100 paise). Rates are stored in basis points (1800 = 18.00%).
-- All application access is server-side through DATABASE_URL. Row Level Security is enabled on every
-- table with no policies for Supabase's `anon` / `authenticated` roles, so the auto-generated public
-- REST API cannot read or write anything (see 20261015000002_lockdown.sql).

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------- enums
create type user_role as enum ('customer', 'admin');
create type product_type as enum ('authentic_branded', 'inspired_fragrance', 'other');
create type availability_status as enum ('available', 'awaiting_supplier_confirmation', 'out_of_stock', 'discontinued');
create type payment_method as enum ('razorpay', 'cod');
create type payment_status as enum ('pending', 'authorized', 'paid', 'failed', 'cod_pending', 'cod_collected', 'refunded', 'partially_refunded', 'cancelled');
create type order_status as enum (
  'awaiting_payment', 'confirmed', 'awaiting_supplier_purchase', 'supplier_ordered', 'supplier_confirmed',
  'shipped', 'delivered', 'cancellation_requested', 'cancelled', 'return_requested', 'returned', 'refunded', 'payment_failed'
);
create type po_status as enum ('draft', 'ordered', 'confirmed', 'dispatched', 'delivered', 'cancelled', 'issue');
create type request_type as enum ('cancellation', 'return', 'refund');
create type request_status as enum ('requested', 'approved', 'rejected', 'completed');
create type refund_status as enum ('pending', 'processed', 'failed', 'recorded_manually');
create type review_status as enum ('pending', 'approved', 'rejected');
create type discount_type as enum ('percent', 'fixed');
create type email_status as enum ('logged', 'sent', 'failed');

-- ---------------------------------------------------------------- helpers
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------------- users & auth
create table profiles (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique check (length(email) <= 254),
  password_hash text not null,
  full_name text not null check (length(full_name) between 1 and 120),
  phone text check (phone ~ '^[6-9][0-9]{9}$'),
  role user_role not null default 'customer',
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

create table addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  label text check (length(label) <= 40),
  full_name text not null,
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  line1 text not null,
  line2 text,
  landmark text,
  city text not null,
  state text not null,
  pincode text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_user_idx on addresses(user_id);
create trigger addresses_updated before update on addresses for each row execute function set_updated_at();

-- ---------------------------------------------------------------- catalogue
create table brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique,
  origin text,
  description text,
  is_middle_eastern boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text,
  is_featured boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table tax_classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  hsn_code text,
  gst_rate_bp int not null check (gst_rate_bp between 0 and 4000),
  is_verified boolean not null default false, -- must be confirmed by the owner / tax adviser before live use
  notes text,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(name) between 1 and 160),
  brand_id uuid not null references brands(id),
  product_type product_type not null,
  description text not null default '',
  size_ml int check (size_ml > 0 and size_ml <= 1000),
  concentration text check (concentration in ('Parfum', 'Extrait de Parfum', 'Eau de Parfum', 'Eau de Toilette', 'Eau de Cologne', 'Attar / Perfume Oil', 'Body Mist', 'Other')),
  fragrance_family text check (fragrance_family in ('Fresh', 'Woody', 'Amber', 'Oud', 'Sweet', 'Spicy', 'Floral', 'Citrus', 'Aquatic', 'Musk', 'Leather', 'Fougere')),
  top_notes text[] not null default '{}',
  heart_notes text[] not null default '{}',
  base_notes text[] not null default '{}',
  notes_verified boolean not null default false, -- notes are only shown publicly when verified
  gender text check (gender in ('Men', 'Women', 'Unisex')),
  occasions text[] not null default '{}',
  selling_price_paise int not null check (selling_price_paise > 0),
  mrp_paise int check (mrp_paise > 0),
  mrp_verified boolean not null default false, -- MRP / strike-through is only shown when verified
  tax_class_id uuid references tax_classes(id),
  availability availability_status not null default 'awaiting_supplier_confirmation',
  is_active boolean not null default false,
  is_featured boolean not null default false,
  is_demo boolean not null default false,
  max_per_order int not null default 5 check (max_per_order between 1 and 50),
  search_vector tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mrp_not_below_price check (mrp_paise is null or mrp_paise >= selling_price_paise),
  constraint occasions_valid check (occasions <@ array['Office', 'Everyday', 'Date Night', 'Evening', 'Summer', 'Winter']::text[])
);
create index products_brand_idx on products(brand_id);
create index products_listing_idx on products(is_active, availability, created_at desc);
create index products_search_idx on products using gin(search_vector);
create index products_name_trgm_idx on products using gin(name gin_trgm_ops);
create trigger products_updated before update on products for each row execute function set_updated_at();

create or replace function products_search_refresh() returns trigger language plpgsql as $$
declare b text;
begin
  select name into b from brands where id = new.brand_id;
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(b, '')), 'A') ||
    setweight(to_tsvector('simple', array_to_string(new.top_notes || new.heart_notes || new.base_notes, ' ')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.fragrance_family, '')), 'C');
  return new;
end $$;
create trigger products_search before insert or update on products for each row execute function products_search_refresh();

create table product_collections (
  product_id uuid not null references products(id) on delete cascade,
  collection_id uuid not null references collections(id) on delete cascade,
  primary key (product_id, collection_id)
);

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  url text not null,
  storage_path text,
  alt text not null default '',
  position int not null default 0,
  usage_rights_confirmed boolean not null default false, -- admin confirms they may use this image
  created_at timestamptz not null default now()
);
create index product_images_product_idx on product_images(product_id, position);

-- ---------------------------------------------------------------- suppliers (CONFIDENTIAL)
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact_name text,
  phone text,
  whatsapp text,
  email citext,
  address text,
  gstin text,
  payment_terms text,
  dispatch_estimate text,
  shipping_charge_paise int not null default 0 check (shipping_charge_paise >= 0),
  shipping_charge_includes_gst boolean not null default false,
  return_policy text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger suppliers_updated before update on suppliers for each row execute function set_updated_at();

-- Supplier offers per product. Supplier cost lives ONLY here and in supplier purchase orders.
create table product_supplier_offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete restrict,
  supplier_sku text,
  supplier_reference text,
  cost_paise int check (cost_paise >= 0),
  cost_includes_gst boolean not null default false,
  gst_rate_bp int check (gst_rate_bp between 0 and 4000),
  itc_eligible boolean not null default false,
  is_preferred boolean not null default false,
  last_confirmed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, supplier_id)
);
create index pso_product_idx on product_supplier_offers(product_id);
create trigger pso_updated before update on product_supplier_offers for each row execute function set_updated_at();

-- ---------------------------------------------------------------- carts
create table carts (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique,
  user_id uuid unique references profiles(id) on delete cascade,
  discount_code citext,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (token_hash is not null or user_id is not null)
);
create trigger carts_updated before update on carts for each row execute function set_updated_at();

create table cart_items (
  cart_id uuid not null references carts(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity int not null check (quantity between 1 and 50),
  added_price_paise int not null, -- price when added, used to flag price changes
  created_at timestamptz not null default now(),
  primary key (cart_id, product_id)
);

-- ---------------------------------------------------------------- discounts
create table discounts (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique check (code ~ '^[A-Za-z0-9_-]{3,30}$'),
  description text,
  type discount_type not null,
  value int not null check (value > 0), -- percent: basis points (1000 = 10%); fixed: paise
  min_subtotal_paise int not null default 0 check (min_subtotal_paise >= 0),
  max_discount_paise int check (max_discount_paise > 0),
  max_uses int check (max_uses > 0),
  used_count int not null default 0 check (used_count >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (type <> 'percent' or value <= 10000)
);

-- ---------------------------------------------------------------- orders
create sequence order_number_seq start 1001;

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid references profiles(id) on delete set null,
  idempotency_key text not null unique,
  cart_id uuid, -- cart to clear once an online payment succeeds
  contact_name text not null,
  contact_email citext not null,
  contact_phone text not null check (contact_phone ~ '^[6-9][0-9]{9}$'),
  shipping_address jsonb not null,
  billing_address jsonb,
  customer_notes text check (length(customer_notes) <= 500),
  payment_method payment_method not null,
  payment_status payment_status not null default 'pending',
  status order_status not null default 'awaiting_payment',
  currency char(3) not null default 'INR',
  subtotal_paise int not null check (subtotal_paise >= 0),          -- sum of line gross (tax-inclusive when prices include tax)
  discount_paise int not null default 0 check (discount_paise >= 0),
  discount_code citext,
  shipping_paise int not null default 0 check (shipping_paise >= 0),
  cod_fee_paise int not null default 0 check (cod_fee_paise >= 0),
  taxable_value_paise int not null check (taxable_value_paise >= 0), -- total excluding GST
  tax_paise int not null check (tax_paise >= 0),
  cgst_paise int not null default 0,
  sgst_paise int not null default 0,
  igst_paise int not null default 0,
  total_paise int not null check (total_paise >= 0),
  prices_include_tax boolean not null,
  tax_config_verified boolean not null,
  seller_state text,
  place_of_supply text not null,
  razorpay_order_id text unique,
  paid_at timestamptz,
  cancelled_at timestamptz,
  delivered_at timestamptz,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_paise = subtotal_paise - discount_paise + shipping_paise + cod_fee_paise + case when prices_include_tax then 0 else tax_paise end)
);
create index orders_user_idx on orders(user_id, created_at desc);
create index orders_status_idx on orders(status, created_at desc);
create index orders_payment_idx on orders(payment_status);
create index orders_email_idx on orders(contact_email);
create trigger orders_updated before update on orders for each row execute function set_updated_at();

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  -- snapshot of what was sold
  product_name text not null,
  product_slug text,
  brand_name text not null,
  product_type product_type not null,
  size_ml int,
  concentration text,
  unit_price_paise int not null check (unit_price_paise >= 0),
  quantity int not null check (quantity > 0),
  line_gross_paise int not null,
  discount_alloc_paise int not null default 0,
  taxable_value_paise int not null,
  tax_rate_bp int not null,
  tax_paise int not null,
  hsn_code text,
  tax_class_name text,
  image_url text
);
create index order_items_order_idx on order_items(order_id);
create index order_items_product_idx on order_items(product_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  provider text not null check (provider in ('razorpay', 'mock', 'cod')),
  provider_order_id text,
  provider_payment_id text unique,
  amount_paise int not null,
  status text not null,
  method text,
  fee_paise int,
  fee_tax_paise int,
  error_code text,
  error_description text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on payments(order_id);
create trigger payments_updated before update on payments for each row execute function set_updated_at();

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

-- ---------------------------------------------------------------- fulfillment
create table supplier_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  supplier_id uuid not null references suppliers(id),
  supplier_reference text,
  status po_status not null default 'draft',
  product_cost_paise int not null default 0 check (product_cost_paise >= 0),
  shipping_cost_paise int not null default 0 check (shipping_cost_paise >= 0),
  costs_include_gst boolean not null default false,
  gst_on_costs_paise int not null default 0 check (gst_on_costs_paise >= 0),
  itc_eligible boolean not null default false,
  supplier_invoice_number text,
  cost_is_actual boolean not null default false, -- false = estimate from catalogue, true = from supplier invoice
  customer_data_shared_at timestamptz,
  customer_data_shared_by uuid references profiles(id),
  ordered_at timestamptz,
  confirmed_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  issue text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index spo_order_idx on supplier_purchase_orders(order_id);
create trigger spo_updated before update on supplier_purchase_orders for each row execute function set_updated_at();

create table supplier_po_items (
  po_id uuid not null references supplier_purchase_orders(id) on delete cascade,
  order_item_id uuid not null references order_items(id) on delete cascade,
  quantity int not null check (quantity > 0),
  unit_cost_paise int not null check (unit_cost_paise >= 0),
  primary key (po_id, order_item_id)
);

create table shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  po_id uuid references supplier_purchase_orders(id) on delete set null,
  courier text not null,
  tracking_number text not null,
  tracking_url text check (tracking_url is null or tracking_url ~ '^https://'),
  shipped_at timestamptz not null default now(),
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create index shipments_order_idx on shipments(order_id);

create table fulfillment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  from_status order_status,
  to_status order_status,
  message text,
  customer_visible boolean not null default false,
  actor_id uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index fulfillment_events_order_idx on fulfillment_events(order_id, created_at);

-- ---------------------------------------------------------------- returns / refunds
create table order_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  type request_type not null,
  reason text not null check (length(reason) between 5 and 1000),
  status request_status not null default 'requested',
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index order_requests_order_idx on order_requests(order_id);
create unique index order_requests_open_unique on order_requests(order_id, type) where status = 'requested';
create trigger order_requests_updated before update on order_requests for each row execute function set_updated_at();

create table refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  request_id uuid references order_requests(id) on delete set null,
  amount_paise int not null check (amount_paise > 0),
  status refund_status not null default 'pending',
  provider_refund_id text unique,
  reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index refunds_order_idx on refunds(order_id);
create trigger refunds_updated before update on refunds for each row execute function set_updated_at();

-- ---------------------------------------------------------------- reviews (verified purchases only)
create table reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  order_item_id uuid not null references order_items(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  title text check (length(title) <= 120),
  body text not null check (length(body) between 10 and 2000),
  status review_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (order_item_id)
);
create index reviews_product_idx on reviews(product_id, status);

-- ---------------------------------------------------------------- operations
create table expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('advertising', 'packaging', 'shipping', 'software', 'other')),
  description text not null,
  amount_paise int not null check (amount_paise > 0),
  gst_paise int not null default 0 check (gst_paise >= 0),
  itc_eligible boolean not null default false,
  incurred_on date not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

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

create table newsletter_subscribers (
  email citext primary key,
  consent_text text not null,
  source text,
  consented_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

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
  order_id uuid references orders(id) on delete set null,
  created_at timestamptz not null default now()
);
create index email_outbox_created_idx on email_outbox(created_at desc);

create table rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count int not null
);
