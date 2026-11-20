-- Row Level Security lockdown.
-- The application talks to Postgres only from the server (DATABASE_URL), as a role that owns the tables
-- and therefore bypasses RLS. Supabase additionally exposes every table in `public` through its REST
-- API to the `anon` and `authenticated` roles. Enabling RLS with NO policies for those roles denies
-- them every row, so neither customer data nor confidential supplier costs can leak through that API.

do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('alter table public.%I force row level security', t.tablename);
  end loop;
end $$;

-- FORCE RLS would also apply to the owner, so give the owning (application) role an explicit pass-through
-- policy. Supabase's anon/authenticated roles get nothing.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format(
      'create policy app_server_all on public.%I as permissive for all to %I using (true) with check (true)',
      t.tablename, current_user
    );
  end loop;
end $$;

-- Revoke direct privileges from Supabase API roles where they exist (they do not exist in plain Postgres).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
    execute 'revoke all on all sequences in schema public from anon';
    execute 'alter default privileges in schema public revoke all on tables from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from authenticated';
    execute 'revoke all on all sequences in schema public from authenticated';
    execute 'alter default privileges in schema public revoke all on tables from authenticated';
  end if;
end $$;
