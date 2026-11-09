-- MALKA EXPRESS schema (run in Supabase SQL editor)
create extension if not exists pgcrypto;
do $$ begin create type public.staff_role as enum ('owner','manager','employee','collection'); exception when duplicate_object then null; end $$;
do $$ begin create type public.order_status as enum ('submitted','reviewing','quoted','awaiting_payment','paid','printing','ready','collected','cancelled'); exception when duplicate_object then null; end $$;

create table if not exists public.drivers (
  id uuid primary key references auth.users(id) on delete cascade,
  driver_code text unique not null default lpad((floor(random()*10000))::text,4,'0'),
  full_name text not null,
  phone text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.staff_role not null default 'employee',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers(id),
  document_type text not null check(document_type in ('Waybill','T1')),
  copies integer not null check(copies between 1 and 100),
  page_count integer not null default 1 check(page_count between 1 and 100),
  status public.order_status not null default 'submitted',
  quoted_price numeric(12,2),
  payment_method text check(payment_method in ('Telebirr','CBE Birr','Bank transfer','Cash')),
  payment_reference text,
  payment_verified boolean not null default false,
  collection_pin_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  collected_at timestamptz,
  collected_by uuid references public.staff_profiles(user_id)
);
create table if not exists public.order_documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  storage_path text not null,
  page_number integer not null,
  created_at timestamptz not null default now(),
  unique(order_id,page_number)
);
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  order_id uuid references public.orders(id),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.business_settings (
  id boolean primary key default true check(id),
  price_per_copy numeric(12,2) not null default 3,
  payment_instructions text not null default 'Please pay via Telebirr, CBE Birr, or bank transfer. Staff will verify payment.',
  updated_at timestamptz not null default now()
);
insert into public.business_settings(id) values(true) on conflict do nothing;

alter table public.drivers enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_documents enable row level security;
alter table public.audit_logs enable row level security;
alter table public.business_settings enable row level security;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.staff_profiles s where s.user_id=auth.uid() and s.active=true); $$;
create or replace function public.staff_role()
returns public.staff_role language sql stable security definer set search_path=public
as $$ select role from public.staff_profiles s where s.user_id=auth.uid() and s.active=true limit 1; $$;

-- Drivers can only read/update their own profile, and create/read their own orders.
create policy "driver self select" on public.drivers for select to authenticated using (id=auth.uid() or public.is_staff());
create policy "driver self insert" on public.drivers for insert to authenticated with check (id=auth.uid() and auth.uid() is not null);
create policy "driver self update" on public.drivers for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
create policy "staff profiles readable by staff" on public.staff_profiles for select to authenticated using (user_id=auth.uid() or public.staff_role()='owner' or public.staff_role()='manager');
create policy "owner manages staff" on public.staff_profiles for all to authenticated using (public.staff_role()='owner') with check (public.staff_role()='owner');
create policy "driver own orders select" on public.orders for select to authenticated using (driver_id=auth.uid() or public.is_staff());
create policy "driver own order insert" on public.orders for insert to authenticated with check (driver_id=auth.uid());
create policy "staff updates orders" on public.orders for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff can see docs" on public.order_documents for select to authenticated using (public.is_staff() or exists(select 1 from public.orders o where o.id=order_id and o.driver_id=auth.uid()));
create policy "driver can add docs to own order" on public.order_documents for insert to authenticated with check (exists(select 1 from public.orders o where o.id=order_id and o.driver_id=auth.uid()));
create policy "audit staff read" on public.audit_logs for select to authenticated using (public.staff_role() in ('owner','manager'));
create policy "audit staff insert" on public.audit_logs for insert to authenticated with check (public.is_staff() and actor_id=auth.uid());
create policy "settings read authenticated" on public.business_settings for select to authenticated using (true);
create policy "owner settings update" on public.business_settings for update to authenticated using (public.staff_role()='owner') with check (public.staff_role()='owner');

-- Private bucket and object rules: object path is <order UUID>/<filename>
insert into storage.buckets(id,name,public) values('order-documents','order-documents',false) on conflict(id) do nothing;
create policy "staff view private documents" on storage.objects for select to authenticated using (bucket_id='order-documents' and public.is_staff());
create policy "driver upload own order docs" on storage.objects for insert to authenticated with check (bucket_id='order-documents' and exists(select 1 from public.orders o where o.id=(storage.foldername(name))[1]::uuid and o.driver_id=auth.uid()));
create policy "driver read own docs" on storage.objects for select to authenticated using (bucket_id='order-documents' and exists(select 1 from public.orders o where o.id=(storage.foldername(name))[1]::uuid and o.driver_id=auth.uid()));

-- NOTE: production hardening should move quote, payment-verification and PIN validation into Edge Functions.
