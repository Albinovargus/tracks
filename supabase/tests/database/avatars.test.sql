-- pgTAP checks for public.avatars and the user_profiles service_role grant.
-- Local only (not part of pnpm test): supabase db reset && pnpm test:db

begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- Fixtures, inserted as postgres. now() is fixed for the whole test
-- transaction, so the 2000-01-01 timestamps make "moved forward" observable.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'avatar-test-a@example.test'),
  ('00000000-0000-4000-8000-00000000000b', 'avatar-test-b@example.test');

insert into public.avatars
  (user_id, skin_tone, hair_style, hair_color, top, bottom, shoes, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000000000a', 'tone-1', 'short', 'black',
   'starter-tee-red', 'starter-shorts-navy', 'starter-shoes-white',
   '2000-01-01 00:00:00+00', '2000-01-01 00:00:00+00'),
  ('00000000-0000-4000-8000-00000000000b', 'tone-2', 'curly', 'blonde',
   'starter-tee-blue', 'starter-shorts-black', 'starter-shoes-black',
   '2000-01-01 00:00:00+00', '2000-01-01 00:00:00+00');

-- 1. RLS is enabled (with no policies, nothing but a bypassrls role sees rows)
select ok(
  (select relrowsecurity from pg_class where oid = 'public.avatars'::regclass),
  'RLS is enabled on public.avatars'
);

-- 2-3. Regression guard for the user_profiles service_role grant. Supabase CLI
-- 2.98.1 auto-grants new public tables to service_role, so these pass locally
-- with or without the grant migration. They only fail on hosted projects or on
-- a stack without auto-grant.
select ok(
  has_table_privilege('service_role', 'public.user_profiles', 'select'),
  'service_role has select on public.user_profiles'
);
select ok(
  has_table_privilege('service_role', 'public.user_profiles', 'update'),
  'service_role has update on public.user_profiles'
);

-- 4-6. authenticated (as user A) holds no table privileges, even on A's own row
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}',
  true
);

select throws_ok(
  $$ select * from public.avatars where user_id = '00000000-0000-4000-8000-00000000000a' $$,
  '42501',
  'permission denied for table avatars',
  'authenticated cannot select its own avatar'
);
select throws_ok(
  $$ insert into public.avatars (user_id, skin_tone, hair_style, hair_color, top, bottom, shoes)
     values ('00000000-0000-4000-8000-00000000000a', 'tone-3', 'ponytail', 'red',
             'starter-tee-green', 'starter-shorts-gray', 'starter-shoes-red') $$,
  '42501',
  'permission denied for table avatars',
  'authenticated cannot insert its own avatar'
);
select throws_ok(
  $$ update public.avatars set hair_style = 'ponytail'
     where user_id = '00000000-0000-4000-8000-00000000000a' $$,
  '42501',
  'permission denied for table avatars',
  'authenticated cannot update its own avatar'
);

-- 7. anon holds no table privileges
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok(
  $$ select * from public.avatars $$,
  '42501',
  'permission denied for table avatars',
  'anon cannot select avatars'
);

-- 8-12. service_role (the API's client) reads and upserts. As with tests 2-3,
-- the local auto-grant means these do not prove the explicit avatars grant.
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select results_eq(
  $$ select user_id from public.avatars order by user_id $$,
  $$ values ('00000000-0000-4000-8000-00000000000a'::uuid),
            ('00000000-0000-4000-8000-00000000000b'::uuid) $$,
  'service_role can select every avatar'
);

-- Same statement shape PostgREST builds for supabase-js
-- .upsert({ user_id, ...appearance }, { onConflict: 'user_id' }):
-- created_at and updated_at are never sent.
select lives_ok(
  $$ insert into public.avatars (user_id, skin_tone, hair_style, hair_color, top, bottom, shoes)
     values ('00000000-0000-4000-8000-00000000000a', 'tone-1', 'curly', 'black',
             'starter-tee-red', 'starter-shorts-navy', 'starter-shoes-white')
     on conflict (user_id) do update set
       skin_tone = excluded.skin_tone,
       hair_style = excluded.hair_style,
       hair_color = excluded.hair_color,
       top = excluded.top,
       bottom = excluded.bottom,
       shoes = excluded.shoes $$,
  'service_role can upsert an avatar on user_id'
);

select is(
  (select hair_style from public.avatars
   where user_id = '00000000-0000-4000-8000-00000000000a'),
  'curly',
  'upsert changed hair_style'
);
select is(
  (select created_at from public.avatars
   where user_id = '00000000-0000-4000-8000-00000000000a'),
  '2000-01-01 00:00:00+00'::timestamptz,
  'upsert kept created_at'
);
select ok(
  (select updated_at from public.avatars
   where user_id = '00000000-0000-4000-8000-00000000000a') > '2000-01-01 00:00:00+00'::timestamptz,
  'set_updated_at trigger moved updated_at forward'
);

select * from finish();
rollback;
