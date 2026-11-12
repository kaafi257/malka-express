-- Run once in Supabase -> SQL Editor.
-- Lets a driver order and pay on one page: the price is calculated automatically.

create table if not exists public.doc_prices (
  document_type public.document_type primary key,
  price_per_copy numeric(10, 2) not null check (price_per_copy > 0)
);

-- Price per copy in ETB. Change these numbers any time (see the UPDATE example below).
insert into public.doc_prices (document_type, price_per_copy)
values ('waybill', 150), ('t1', 100)
on conflict (document_type) do nothing;

alter table public.doc_prices enable row level security;
drop policy if exists prices_read on public.doc_prices;
create policy prices_read on public.doc_prices for select to authenticated using (true);

-- Driver prices their OWN new request: copies x price per copy, then it waits for payment.
create or replace function public.driver_quote(p_order_id uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders;
  v_unit numeric;
  v_total numeric;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.driver_id <> auth.uid() then raise exception 'order_not_found'; end if;
  if v_order.status <> 'pending_review' then raise exception 'invalid_status'; end if;
  if not exists (select 1 from public.order_documents where order_id = p_order_id) then
    raise exception 'documents_required';
  end if;

  select price_per_copy into v_unit from public.doc_prices where document_type = v_order.document_type;
  if v_unit is null then raise exception 'invalid_price'; end if;

  v_total := round(v_unit * v_order.copies, 2);
  update public.orders set quoted_price = v_total, status = 'awaiting_payment' where id = p_order_id;
  perform public.log_event(p_order_id, 'price_set', 'pending_review', 'awaiting_payment', v_total::text);
  return v_total;
end;
$$;

revoke all on function public.driver_quote(uuid) from public, anon;
grant execute on function public.driver_quote(uuid) to authenticated;

-- To change a price later:
-- update public.doc_prices set price_per_copy = 120 where document_type = 'waybill';
