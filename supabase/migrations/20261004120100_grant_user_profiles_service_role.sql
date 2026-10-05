-- Hosted Supabase no longer auto-grants new public tables to the Data API
-- roles, so the API's service-role client needs an explicit grant.
-- Existing RLS policies and the set_updated_at trigger are unchanged.
grant select, insert, update, delete on table public.user_profiles to service_role;
