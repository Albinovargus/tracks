-- Athlete avatar appearance, one row per user. Allowed IDs are enforced by the
-- API's Zod catalog (packages/types/src/avatar.schema.ts), not by enums or CHECK
-- constraints: the API's service-role client is the only reader and writer.
create table public.avatars (
  user_id uuid primary key references auth.users(id) on delete cascade,
  skin_tone text not null,
  hair_style text not null,
  hair_color text not null,
  top text not null,
  bottom text not null,
  shoes text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS on with no policies, and no Data API privileges for anon or
-- authenticated (ADR-002). Grants are explicit because hosted Supabase no
-- longer auto-grants new public tables to the Data API roles.
alter table public.avatars enable row level security;
revoke all on table public.avatars from anon, authenticated;
grant select, insert, update, delete on table public.avatars to service_role;

create trigger set_updated_at
  before update on public.avatars
  for each row execute function public.set_updated_at();
