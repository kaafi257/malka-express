# Malka Express

A digital document-copy service for truck drivers at **Malka Jebdu Dry Port, Dire Dawa**.
Drivers upload their Waybill / T1 from their phone, pay at the desk, and collect the printed copies with a one-time PIN. Staff manage the whole queue from one screen.

**Stack:** React 19 · TypeScript · Vite · Supabase (Postgres, Auth, Storage) · Vercel
**Languages in the app:** English · አማርኛ · Afaan Oromoo

---

## How it works

```
Driver                       Staff (manager / owner)         Staff (employee)
──────                       ───────────────────────         ────────────────
1. Registers (phone+password)
2. Uploads Waybill/T1 photos
                             3. Reviews, sets price (ETB)
4. Sees price, pays at desk  5. Records payment (cash/Telebirr/CBE/…)
                                                             6. Starts printing
                                                             7. Marks ready  → PIN generated
8. Sees 6-digit PIN in app                                   9. Driver shows PIN → staff enters → handed over
```

Order status: `pending_review → awaiting_payment → paid → printing → ready → collected` (or `cancelled`).

### Roles
| Role | Can do |
|---|---|
| **driver** | Create requests, upload documents, see own orders + PIN, cancel before payment |
| **employee** | View all orders & documents, start printing, mark ready, verify PIN & hand over |
| **manager** | Everything an employee can + set prices, record payments, cancel, issue new PIN |
| **owner** | Everything a manager can + activate/deactivate staff |

---

## Security model (why this is safe to run in production)

* **Row Level Security on every table.** Clients can only *read*, and only what their role allows.
* **No direct writes.** Every change goes through a database function that checks the caller's role **and** the order's current status — the browser cannot set a price, mark an order paid, or skip a step.
* **Payments are atomic.** The payment record and the order status change happen in one transaction.
* **Collection PIN is secret from staff.** It is stored in a separate table only the driver can read. Staff can only *verify* it; after 5 wrong attempts it locks and a manager must issue a new one.
* **Private file storage.** Documents are in a private bucket (JPG/PNG/WebP/PDF, 10 MB max). Staff open them with 5-minute signed links.
* **Audit log.** Every state change is recorded in `order_events`.
* Only the public *anon* key is used in the browser. Never use the `service_role` key here.

The SQL in `supabase/migrations/` was tested against PostgreSQL 16 for the full order flow, role restrictions, PIN lockout and anonymous access.

---

## Setup (about 15 minutes)

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → paste the whole file `supabase/migrations/20261110000000_initial_schema.sql` → **Run**.
3. **Authentication → Providers → Email:** turn **OFF** "Confirm email". *(Drivers sign in with phone + password; no email is ever sent, so confirmation must be off.)*
4. **Authentication → Users → Add user → Create new user** for the owner (email + strong password, tick *Auto Confirm User*).
5. Open `supabase/bootstrap_owner.sql`, put the owner's email and name in, and run it in the SQL Editor. Repeat for every staff member (set `role` to `manager` or `employee`).
6. **Project Settings → API:** copy the **Project URL** and the **anon / publishable key**.

### 2. GitHub
Drag and drop every file and folder from this project into your repository (`kaafi257/malka-express`) — **not** `node_modules`, `dist` or any `.env` file (they are already excluded by `.gitignore`).

### 3. Vercel
1. **Add New → Project** → import the GitHub repository (framework is auto-detected as Vite).
2. Add environment variables:
   * `VITE_SUPABASE_URL` = your Project URL
   * `VITE_SUPABASE_ANON_KEY` = your anon / publishable key
3. **Deploy.** Open the link, sign in as staff with the owner account, and test with a driver account on your phone.

### Local development
```bash
npm install
cp .env.example .env     # fill in the two Supabase values
npm run dev              # http://localhost:5173
npm run typecheck && npm test && npm run build
```

---

## Project structure
```
src/
  lib/            supabase client, API calls, errors, i18n (en/am/om), auth + toast providers, helpers
  hooks/          useOrders (loads + auto-refreshes every 30 s)
  components/     OrderCard, NewRequestForm, DocumentList, ProgressTracker, Header, …
  pages/          LoginPage, DriverDashboard, StaffDashboard, ConfigMissing
supabase/
  migrations/     database schema, RLS policies, storage rules, business functions
  bootstrap_owner.sql   create staff accounts
docs/             operations guide
.github/workflows CI: typecheck + tests + build on every push
```

## Notes & known limits
* **Driver sign-in** uses phone + password (the phone is mapped to a private id; nothing is emailed). There is no self-service password reset yet — a manager can reset it in Supabase → Authentication → Users. SMS-based sign-in can be added later once an SMS provider is chosen.
* **Payments** are recorded by staff at the desk (cash, Telebirr, CBE Birr, bank transfer). Automatic online payment (Telebirr API) is a future step.
* **Refunds** for cancelled paid orders are handled outside the app.
* **Translations** (Amharic, Afaan Oromoo) should be reviewed by a native speaker before launch; all text lives in `src/lib/i18n/`.
* `src/lib/i18n/en.ts` is the source of truth; TypeScript will refuse to build if a translation key is missing.
