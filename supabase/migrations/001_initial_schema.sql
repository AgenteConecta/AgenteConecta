create extension if not exists "pgcrypto";

create type lead_type as enum ('learner', 'professional', 'business', 'unknown');
create type market_awareness as enum ('unaware', 'problem_aware', 'automation_aware', 'solution_aware', 'professional_integrator', 'competing_solution_user');
create type geography_tier as enum ('tier_1', 'tier_2', 'tier_3');
create type channel_owner as enum ('browser', 'meta_api', 'whatsapp', 'human', 'none');
create type job_status as enum ('queued', 'running', 'completed', 'dead', 'cancelled');
create type claim_status as enum ('pending', 'verified', 'blocked', 'expired');
create type cnpj_status as enum ('unknown', 'not_provided', 'pending', 'verified', 'invalid');

create table leads (
  id uuid primary key default gen_random_uuid(),
  instagram_username text unique,
  instagram_id text unique,
  display_name text,
  bio text,
  category text,
  city text,
  state text,
  country text default 'Brasil',
  website text,
  phone text,
  email text,
  company_name text,
  business_type text,
  estimated_role text,
  market_awareness market_awareness default 'unaware',
  lead_type lead_type default 'unknown',
  lead_score integer default 0 check (lead_score between 0 and 100),
  commercial_value_score integer default 0 check (commercial_value_score between 0 and 100),
  geography_tier geography_tier default 'tier_3',
  territory_opportunity_score integer default 0,
  project_readiness text default 'unknown',
  discovery_source text,
  discovery_keyword text,
  channel_state text default 'none',
  channel_owner channel_owner default 'none',
  human_review_required boolean default false,
  do_not_contact boolean default false,
  discovered_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index leads_phone_unique on leads (phone) where phone is not null;
create unique index leads_email_unique on leads (lower(email)) where email is not null;
create unique index leads_website_unique on leads (lower(website)) where website is not null;
create unique index leads_company_unique on leads (lower(company_name)) where company_name is not null;

create table lead_profiles (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  public_snapshot jsonb not null default '{}'::jsonb,
  posts jsonb not null default '[]'::jsonb,
  analyzed_at timestamptz,
  created_at timestamptz default now()
);

create table lead_scores (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  raw_lead_score integer not null,
  lead_score integer not null check (lead_score between 0 and 100),
  commercial_value_score integer not null check (commercial_value_score between 0 and 100),
  explanation jsonb not null default '[]'::jsonb,
  commercial_explanation jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

create table lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  event_type text not null,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  channel channel_owner not null,
  external_conversation_id text,
  status text default 'open',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (channel, external_conversation_id)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  channel channel_owner not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  message_variant text,
  provider_message_id text,
  browser_job_id uuid,
  result text,
  screenshot_on_error text,
  page_url text,
  sent_at timestamptz,
  received_at timestamptz,
  created_at timestamptz default now(),
  unique (channel, provider_message_id)
);

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  objective text not null,
  status text default 'draft',
  created_at timestamptz default now()
);

create table campaign_leads (
  campaign_id uuid references campaigns(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  assigned_at timestamptz default now(),
  primary key (campaign_id, lead_id)
);

create table experiments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  variable text not null,
  status text default 'active',
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create table experiment_assignments (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references experiments(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  variant text not null,
  assigned_at timestamptz default now(),
  unique (experiment_id, lead_id)
);

create table claims (
  id uuid primary key default gen_random_uuid(),
  claim text not null,
  claim_type text not null,
  source text,
  status claim_status default 'pending',
  verified_at timestamptz,
  expires_at timestamptz,
  requires_revalidation boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  status job_status default 'queued',
  idempotency_key text not null unique,
  attempts integer default 0,
  max_attempts integer default 3,
  locked_by text,
  locked_until timestamptz,
  run_after timestamptz default now(),
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table job_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  attempt_number integer not null,
  result text not null,
  error text,
  started_at timestamptz default now(),
  finished_at timestamptz
);

create table ai_calls (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  model text not null,
  operation text not null,
  input_tokens integer default 0,
  output_tokens integer default 0,
  estimated_cost numeric(12, 6) default 0,
  created_at timestamptz default now()
);

create table channel_locks (
  lead_id uuid primary key references leads(id) on delete cascade,
  owner channel_owner not null,
  locked_until timestamptz,
  reason text,
  updated_at timestamptz default now()
);

create table do_not_contact (
  lead_id uuid primary key references leads(id) on delete cascade,
  reason text not null,
  source_message_id uuid references messages(id) on delete set null,
  created_at timestamptz default now()
);

create table offers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  price_brl numeric(12, 2),
  credentialing boolean default false,
  requirements jsonb not null default '[]'::jsonb,
  active boolean default true,
  updated_at timestamptz default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  offer_id uuid references offers(id),
  amount_brl numeric(12, 2) not null,
  status text not null,
  checkout_id text,
  ordered_at timestamptz default now(),
  unique (checkout_id)
);

create table credentialing (
  lead_id uuid primary key references leads(id) on delete cascade,
  training_completed boolean default false,
  certification_status text default 'pending',
  certification_score numeric(5, 2),
  cnpj_status cnpj_status default 'unknown',
  kit_purchased boolean default false,
  credentialing_status text default 'not_started',
  credentialed_at timestamptz,
  first_order_at timestamptz,
  active_reseller_at timestamptz,
  updated_at timestamptz default now()
);

create table certifications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  score numeric(5, 2),
  status text not null,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table territories (
  id uuid primary key default gen_random_uuid(),
  state text unique not null,
  tier geography_tier not null,
  opportunity_score integer not null,
  metrics jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create or replace function acquire_channel_lock(target_lead_id uuid, target_owner channel_owner, lock_reason text)
returns boolean as $$
declare
  current_owner channel_owner;
begin
  select owner into current_owner
  from channel_locks
  where lead_id = target_lead_id
  for update;

  if current_owner is null then
    insert into channel_locks (lead_id, owner, reason)
    values (target_lead_id, target_owner, lock_reason)
    on conflict (lead_id) do update set owner = excluded.owner, reason = excluded.reason, updated_at = now();
    update leads set channel_owner = target_owner, updated_at = now() where id = target_lead_id;
    return true;
  end if;

  if current_owner = target_owner or current_owner = 'none' then
    update channel_locks set owner = target_owner, reason = lock_reason, updated_at = now() where lead_id = target_lead_id;
    update leads set channel_owner = target_owner, updated_at = now() where id = target_lead_id;
    return true;
  end if;

  return false;
end;
$$ language plpgsql;

insert into offers (code, name, price_brl, credentialing, requirements)
values
  ('basic_training', 'Treinamento de Automação Residencial', 164, false, '[]'::jsonb),
  ('credentialing', 'Treinamento Completo + Credenciamento Newtek', 297, true, '["complete_training","pass_certification_test","have_cnpj"]'::jsonb)
on conflict (code) do nothing;
