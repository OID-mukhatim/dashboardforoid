-- 1. Enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'developer', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. Policies on user_roles
DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Tighten kpis policies
DROP POLICY IF EXISTS open_select_kpis ON public.kpis;
DROP POLICY IF EXISTS open_insert_kpis ON public.kpis;
DROP POLICY IF EXISTS open_update_kpis ON public.kpis;
DROP POLICY IF EXISTS open_delete_kpis ON public.kpis;

REVOKE ALL ON public.kpis FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpis TO authenticated;
GRANT ALL ON public.kpis TO service_role;

CREATE POLICY "authenticated read kpis" ON public.kpis
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "editors insert kpis" ON public.kpis
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'));
CREATE POLICY "editors update kpis" ON public.kpis
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'));
CREATE POLICY "editors delete kpis" ON public.kpis
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'));

-- 6. Tighten uploads policies
DROP POLICY IF EXISTS open_select_uploads ON public.uploads;
DROP POLICY IF EXISTS open_insert_uploads ON public.uploads;
DROP POLICY IF EXISTS open_update_uploads ON public.uploads;
DROP POLICY IF EXISTS open_delete_uploads ON public.uploads;

REVOKE ALL ON public.uploads FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uploads TO authenticated;
GRANT ALL ON public.uploads TO service_role;

CREATE POLICY "authenticated read uploads" ON public.uploads
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "editors insert uploads" ON public.uploads
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'));
CREATE POLICY "editors update uploads" ON public.uploads
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'));
CREATE POLICY "editors delete uploads" ON public.uploads
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'));
