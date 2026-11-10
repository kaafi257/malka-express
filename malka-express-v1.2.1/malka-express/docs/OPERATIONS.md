# Operations guide

## Daily work at the desk
1. **Staff dashboard → "New"** filter shows requests waiting for review. Open the driver's documents (**Open**) to check they are readable.
2. *Manager/owner:* enter the price in ETB and press **Set price**. The driver now sees the amount.
3. When the driver pays: *manager/owner* chooses the method (cash, Telebirr, CBE Birr, bank transfer) and presses **Record payment**. For non-cash, type the transaction reference.
4. *Anyone on staff:* **Start printing**, then **Mark ready**. The driver's app now shows a 6-digit PIN.
5. When the driver arrives: ask for the PIN, type it, press **Hand over**.
   * Wrong PIN 5 times → locked. A manager presses **New PIN** (driver sees the new one in their app).

## Managing staff
* Add a person: Supabase → Authentication → Users → Add user, then run `supabase/bootstrap_owner.sql` with their email and role.
* Deactivate someone: Supabase → Table Editor → `staff_profiles` → set `active` to `false`. They lose access to all data immediately.
* Change a driver's forgotten password: Supabase → Authentication → Users → the driver's row (their id looks like `251911223344@drivers.malkaexpress.app`) → send/reset password.

## Reports (SQL Editor)
```sql
-- Revenue per day (ETB)
select date_trunc('day', created_at) as day, sum(amount) as revenue, count(*) as payments
from payments group by 1 order by 1 desc;

-- Revenue per payment method
select method, sum(amount) from payments group by 1;

-- Orders per status
select status, count(*) from orders group by 1;

-- Average minutes from request to ready
select round(avg(extract(epoch from (ready_at - created_at)) / 60)) as minutes from orders where ready_at is not null;
```

## Backups
Supabase Pro includes daily backups. On the free plan, export the database regularly (Project Settings → Database → Backups) — payments and documents are your business records.
