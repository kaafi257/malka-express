# Malka Express — GitHub-ready app

Mobile-first document-copying workflow for Malka Jebdu, Dire Dawa. Driver portal, shop dashboard, owner/staff roles, private page uploads, quote/payment workflow, and collection PIN.

## Add to GitHub (drag and drop)
1. Download and unzip `malka-express-github.zip`.
2. Create a GitHub repository.
3. On the repository page choose **Add file → Upload files**.
4. Drag all files/folders from the unzipped project (including `src`, `supabase`, and `public`) into the upload area. Commit.
5. For Vercel: Import repository, framework Vite. Add env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from Supabase Project Settings → API. Deploy.

## Connect Supabase
1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql` in full.
3. Storage bucket `order-documents` is created by SQL as private.
4. Create staff users in Supabase Authentication → Users (email/password). Then insert matching staff profile in SQL editor, replacing UUID/email/role:
   `insert into public.staff_profiles(user_id, full_name, role) values ('AUTH-USER-UUID','Owner Name','owner');`
   Roles: `owner`, `manager`, `employee`, `collection`.
5. In Auth settings, enable **Anonymous Sign-Ins** for driver registration. Driver identity is anonymous-session based; phone/name are profile fields and phone ownership is NOT verified (no OTP per plan). Driver account recovery across devices is not implemented in this MVP.
6. Configure RLS/storage policies from schema. Never put service-role key in frontend.

## Important payment & privacy notes
- Payment methods show manual Telebirr / CBE Birr / bank transfer instructions; this is NOT a payment-provider API integration. Staff must verify payment before marking paid.
- Uploaded transport documents are private. Staff access requires a signed-in role. Configure retention/deletion procedures before launch.
- Four-digit collection PIN is randomly generated for order and is shown to driver when order reaches READY; shop verifies it at collection. Add server-side rate limiting/Edge Function before public production use.
- This is an MVP. Phone-only access without OTP is inherently weaker. Restrict pilot usage and validate your process.

## Local preview
`npm install` then `npm run dev`
