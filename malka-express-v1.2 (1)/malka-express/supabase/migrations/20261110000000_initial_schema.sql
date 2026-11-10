-- =============================================================================
-- Malka Express — initial database schema
-- Run once in: Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Design rules
--   1. Row Level Security (RLS) is ON for every table.
--   2. Clients can only READ tables. Every state change (create order, set price,
--      record payment, print, ready, collect, cancel) goes through a
--      SECURITY DEFINER function that checks role + current status.
--   3. The collection PIN lives in its own table: drivers can read their own,
--      staff can never read it — they can only verify it through collect_order().
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.staff_role     as enum ('owner', 'manager', 'employee');
create type public.document_type  as enum ('waybill', 't1');
create type public.order_status   as enum
  ('pending_review', 'awaiting_payment', 'paid', 'printing', 'ready', 'collected', 'cancelled');
create type public.payment_status as enum ('unpaid', 'paid');
create type public.payment_method as enum ('cash', 'telebirr', 'cbe_birr', 'bank_transfer', 'other');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.staff_profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null check (char_length(trim(full_name)) >= 2),
  phone      text,
  role       public.staff_role not null default 'employee',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.driver_profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null check (char_length(trim(full_name)) >= 2),
  -- Stored as 2519XXXXXXXX / 2517XXXXXXXX (digits only, no plus sign)
  phone      text not null unique check (phone ~ '^251[79][0-9]{8}$'),
  created_at timestamptz not null default now()
);

create sequence public.order_reference_seq start 1000;

create table public.orders (
  id           uuid primary key default gen_random_uuid(),
  reference    text not null unique
               default ('MX-' || lpad(nextval('public.order_reference_seq')::text, 6, '0')),
  driver_id    uuid not null references public.driver_profiles (id) on delete restrict,
  document_type public.document_type not null,
  description  text check (description is null or char_length(description) <= 500),
  status       public.order_status not null default 'pending_review',
  quoted_price numeric(10, 2) check (quoted_price is null or quoted_price > 0),
  payment_status public.payment_status not null default 'unpaid',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  paid_at      timestamptz,
  ready_at     timestamptz,
  collected_at timestamptz,
  collected_by uuid references public.staff_profiles (id)
);
create index orders_driver_idx  on public.orders (driver_id, created_at desc);
create index orders_status_idx  on public.orders (status, created_at desc);

create table public.order_documents (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  uploaded_by  uuid not null references auth.users (id),
  file_name    text not null,
  storage_path text not null unique,
  mime_type    text,
  file_size    bigint check (file_size is null or file_size <= 10485760),
  created_at   timestamptz not null default now()
);
create index order_documents_order_idx on public.order_documents (order_id);

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete restrict,
  amount      numeric(10, 2) not null check (amount > 0),
  method      public.payment_method not null,
  reference   text,
  recorded_by uuid not null references public.staff_profiles (id),
  created_at  timestamptz not null default now()
);
create unique index payments_one_per_order on public.payments (order_id);

create table public.order_pins (
  order_id        uuid primary key references public.orders (id) on delete cascade,
  pin             text not null check (pin ~ '^[0-9]{6}$'),
  failed_attempts int  not null default 0,
  created_at      timestamptz not null default now()
);

create table public.order_events (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  actor_id    uuid,
  event       text not null,
  from_status public.order_status,
  to_status   public.order_status,
  note        text,
  created_at  timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so RLS policies never recurse)
-- ---------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_profiles where id = auth.uid() and active);
$$;

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff_profiles
    where id = auth.uid() and active and role in ('owner', 'manager')
  );
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff_profiles where id = auth.uid() and active and role = 'owner'
  );
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Driver self-registration: creates the driver profile from sign-up metadata.
-- Staff are NEVER created this way (see supabase/bootstrap_owner.sql).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.raw_user_meta_data ->> 'account_type' = 'driver' then
    insert into public.driver_profiles (id, full_name, phone)
    values (
      new.id,
      trim(new.raw_user_meta_data ->> 'full_name'),
      new.raw_user_meta_data ->> 'phone'
    );
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.staff_profiles  enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.orders          enable row level security;
alter table public.order_documents enable row level security;
alter table public.payments        enable row level security;
alter table public.order_pins      enable row level security;
alter table public.order_events    enable row level security;

-- Nobody is anonymous in this app, and nobody writes tables directly.
revoke all on public.staff_profiles, public.driver_profiles, public.orders,
              public.order_documents, public.payments, public.order_pins,
              public.order_events
  from anon, authenticated;
grant select on public.staff_profiles, public.driver_profiles, public.orders,
                public.order_documents, public.payments, public.order_pins,
                public.order_events
  to authenticated;
grant insert on public.order_documents to authenticated;  -- guarded by policy below
grant update (role, active) on public.staff_profiles to authenticated;  -- owner only, by policy

create policy staff_read on public.staff_profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());

create policy staff_owner_manage on public.staff_profiles for update to authenticated
  using (public.is_owner() and id <> auth.uid())
  with check (public.is_owner() and id <> auth.uid());

create policy driver_read on public.driver_profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());

create policy orders_read on public.orders for select to authenticated
  using (driver_id = auth.uid() or public.is_staff());

create policy documents_read on public.order_documents for select to authenticated
  using (
    public.is_staff()
    or exists (select 1 from public.orders o where o.id = order_id and o.driver_id = auth.uid())
  );

create policy documents_driver_insert on public.order_documents for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and storage_path like order_id::text || '/%'
    and exists (
      select 1 from public.orders o
      where o.id = order_id and o.driver_id = auth.uid() and o.status = 'pending_review'
    )
  );

create policy payments_read on public.payments for select to authenticated
  using (
    public.is_staff()
    or exists (select 1 from public.orders o where o.id = order_id and o.driver_id = auth.uid())
  );

-- Only the driver who owns the order can read its PIN. Staff cannot.
create policy pins_driver_read on public.order_pins for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.driver_id = auth.uid()));

create policy events_read on public.order_events for select to authenticated
  using (
    public.is_staff()
    or exists (select 1 from public.orders o where o.id = order_id and o.driver_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Storage: private bucket for uploaded documents (10 MB, images + PDF only)
-- Object path convention: <order_id>/<uuid>-<file name>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-documents', 'order-documents', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "drivers upload to own pending orders" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'order-documents'
    and exists (
      select 1 from public.orders o
      where o.id::text = (storage.foldername(name))[1]
        and o.driver_id = auth.uid() and o.status = 'pending_review'
    )
  );

create policy "drivers remove from own pending orders" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'order-documents'
    and exists (
      select 1 from public.orders o
      where o.id::text = (storage.foldername(name))[1]
        and o.driver_id = auth.uid() and o.status = 'pending_review'
    )
  );

create policy "staff and owners read order documents" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'order-documents'
    and (
      public.is_staff()
      or exists (
        select 1 from public.orders o
        where o.id::text = (storage.foldername(name))[1] and o.driver_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Business functions (the ONLY way to change an order)
-- Errors are raised as short machine codes; the frontend translates them.
-- ---------------------------------------------------------------------------
create or replace function public.log_event(
  p_order uuid, p_event text, p_from public.order_status, p_to public.order_status, p_note text default null
) returns void language sql security definer set search_path = public as $$
  insert into public.order_events (order_id, actor_id, event, from_status, to_status, note)
  values (p_order, auth.uid(), p_event, p_from, p_to, p_note);
$$;
revoke all on function public.log_event(uuid, text, public.order_status, public.order_status, text) from public, anon, authenticated;

create or replace function public.new_pin()
returns text language sql volatile as $$
  select lpad(
    ((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint) % 1000000)::text,
    6, '0');
$$;
revoke all on function public.new_pin() from public, anon, authenticated;

-- Driver: create a new request. Documents are attached right after.
create or replace function public.create_order(p_document_type public.document_type, p_description text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.driver_profiles where id = auth.uid()) then
    raise exception 'driver_only';
  end if;
  if (select count(*) from public.orders
      where driver_id = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limited';
  end if;

  insert into public.orders (driver_id, document_type, description)
  values (auth.uid(), p_document_type, nullif(trim(coalesce(p_description, '')), ''))
  returning id into v_id;

  perform public.log_event(v_id, 'created', null, 'pending_review');
  return v_id;
end;
$$;

-- Manager/owner: quote a price (ETB). Requires at least one uploaded document.
create or replace function public.set_price(p_order_id uuid, p_price numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.order_status;
begin
  if not public.is_manager() then raise exception 'unauthorized'; end if;
  if p_price is null or p_price <= 0 or p_price > 1000000 then raise exception 'invalid_price'; end if;

  select status into v_status from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_status not in ('pending_review', 'awaiting_payment') then raise exception 'invalid_status'; end if;
  if not exists (select 1 from public.order_documents where order_id = p_order_id) then
    raise exception 'documents_required';
  end if;

  update public.orders set quoted_price = round(p_price, 2), status = 'awaiting_payment'
   where id = p_order_id;
  perform public.log_event(p_order_id, 'price_set', v_status, 'awaiting_payment', p_price::text);
end;
$$;

-- Manager/owner: record the payment atomically (payment row + order update).
create or replace function public.record_payment(
  p_order_id uuid, p_method public.payment_method, p_reference text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders;
begin
  if not public.is_manager() then raise exception 'unauthorized'; end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_order.status <> 'awaiting_payment' or v_order.quoted_price is null then
    raise exception 'invalid_status';
  end if;
  if p_method <> 'cash' and nullif(trim(coalesce(p_reference, '')), '') is null then
    raise exception 'payment_reference_required';
  end if;

  insert into public.payments (order_id, amount, method, reference, recorded_by)
  values (p_order_id, v_order.quoted_price, p_method, nullif(trim(coalesce(p_reference, '')), ''), auth.uid());

  update public.orders set status = 'paid', payment_status = 'paid', paid_at = now()
   where id = p_order_id;
  perform public.log_event(p_order_id, 'payment_recorded', 'awaiting_payment', 'paid', p_method::text);
end;
$$;

-- Any active staff: paid → printing → ready. Generates the PIN when ready.
create or replace function public.advance_order(p_order_id uuid, p_to public.order_status)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.order_status;
begin
  if not public.is_staff() then raise exception 'unauthorized'; end if;

  select status into v_status from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;

  if not ((v_status = 'paid' and p_to = 'printing') or (v_status = 'printing' and p_to = 'ready')) then
    raise exception 'invalid_status';
  end if;

  update public.orders
     set status = p_to,
         ready_at = case when p_to = 'ready' then now() else ready_at end
   where id = p_order_id;

  if p_to = 'ready' then
    insert into public.order_pins (order_id, pin) values (p_order_id, public.new_pin())
    on conflict (order_id) do update set pin = excluded.pin, failed_attempts = 0;
  end if;
  perform public.log_event(p_order_id, 'status_changed', v_status, p_to);
end;
$$;

-- Any active staff: hand over the copies after verifying the driver's PIN.
-- Returns 'collected' | 'wrong_pin' | 'locked'. (Returns instead of raising so the
-- failed-attempt counter is not rolled back.)
create or replace function public.collect_order(p_order_id uuid, p_pin text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_status public.order_status;
  v_pin public.order_pins;
begin
  if not public.is_staff() then raise exception 'unauthorized'; end if;

  select status into v_status from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_status <> 'ready' then raise exception 'invalid_status'; end if;

  select * into v_pin from public.order_pins where order_id = p_order_id for update;
  if not found then raise exception 'pin_not_ready'; end if;
  if v_pin.failed_attempts >= 5 then return 'locked'; end if;

  if v_pin.pin <> trim(coalesce(p_pin, '')) then
    update public.order_pins set failed_attempts = failed_attempts + 1 where order_id = p_order_id;
    perform public.log_event(p_order_id, 'pin_failed', v_status, v_status);
    return 'wrong_pin';
  end if;

  update public.orders
     set status = 'collected', collected_at = now(), collected_by = auth.uid()
   where id = p_order_id;
  perform public.log_event(p_order_id, 'collected', 'ready', 'collected');
  return 'collected';
end;
$$;

-- Manager/owner: issue a fresh PIN (e.g. after 5 wrong attempts or a lost PIN).
create or replace function public.regenerate_pin(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_status public.order_status;
begin
  if not public.is_manager() then raise exception 'unauthorized'; end if;

  select status into v_status from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if v_status <> 'ready' then raise exception 'invalid_status'; end if;

  insert into public.order_pins (order_id, pin) values (p_order_id, public.new_pin())
  on conflict (order_id) do update set pin = excluded.pin, failed_attempts = 0;
  perform public.log_event(p_order_id, 'pin_regenerated', v_status, v_status);
end;
$$;

-- Driver (own order, before payment) or manager/owner (any open order).
-- Refunds for paid orders are handled outside the app.
create or replace function public.cancel_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;

  if v_order.driver_id = auth.uid() then
    if v_order.status not in ('pending_review', 'awaiting_payment') then raise exception 'invalid_status'; end if;
  elsif public.is_manager() then
    if v_order.status not in ('pending_review', 'awaiting_payment', 'paid', 'printing', 'ready') then
      raise exception 'invalid_status';
    end if;
  else
    raise exception 'unauthorized';
  end if;

  update public.orders set status = 'cancelled' where id = p_order_id;
  perform public.log_event(p_order_id, 'cancelled', v_order.status, 'cancelled');
end;
$$;

-- Expose only the business functions to signed-in users.
revoke all on function public.create_order(public.document_type, text)                from public, anon;
revoke all on function public.set_price(uuid, numeric)                                from public, anon;
revoke all on function public.record_payment(uuid, public.payment_method, text)       from public, anon;
revoke all on function public.advance_order(uuid, public.order_status)                from public, anon;
revoke all on function public.collect_order(uuid, text)                               from public, anon;
revoke all on function public.regenerate_pin(uuid)                                    from public, anon;
revoke all on function public.cancel_order(uuid)                                      from public, anon;

grant execute on function public.create_order(public.document_type, text)            to authenticated;
grant execute on function public.set_price(uuid, numeric)                             to authenticated;
grant execute on function public.record_payment(uuid, public.payment_method, text)    to authenticated;
grant execute on function public.advance_order(uuid, public.order_status)             to authenticated;
grant execute on function public.collect_order(uuid, text)                            to authenticated;
grant execute on function public.regenerate_pin(uuid)                                 to authenticated;
grant execute on function public.cancel_order(uuid)                                   to authenticated;
