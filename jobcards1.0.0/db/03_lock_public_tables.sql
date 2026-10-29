-- SUPABASE ONLY - run once after db:migrate (and after adding tables).
-- Supabase publishes every `public` table over a REST API reachable with the public anon key.
-- RLS with no policies blocks that; our API connects as a privileged role, which bypasses RLS.
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
