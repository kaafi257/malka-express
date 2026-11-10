-- =============================================================================
-- Create staff accounts (run AFTER the initial migration)
--
-- 1. Supabase Dashboard → Authentication → Users → "Add user" → "Create new user"
--    Enter the staff member's email + a strong password, tick "Auto Confirm User".
-- 2. Edit the email / name / role below, then run this in the SQL Editor.
--
-- Roles:
--   owner    – everything, including activating/deactivating staff
--   manager  – set prices, record payments, cancel, regenerate PINs, + employee tasks
--   employee – print, mark ready, verify PIN and hand over copies
--
-- Run it once per person. The very first account should be 'owner'.
-- =============================================================================

insert into public.staff_profiles (id, full_name, phone, role)
select id, 'Owner Full Name', '+251911000000', 'owner'
from auth.users
where email = 'owner@example.com'
on conflict (id) do update
  set full_name = excluded.full_name,
      phone     = excluded.phone,
      role      = excluded.role,
      active    = true;
