
-- 1) Create private schema not exposed via PostgREST
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- 2) Recreate has_role in private schema
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 3) Drop policies that reference public.has_role and recreate using private.has_role

-- user_roles
DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- kpis
DROP POLICY IF EXISTS "editors insert kpis" ON public.kpis;
DROP POLICY IF EXISTS "editors update kpis" ON public.kpis;
DROP POLICY IF EXISTS "editors delete kpis" ON public.kpis;
CREATE POLICY "editors insert kpis" ON public.kpis
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'developer'::public.app_role));
CREATE POLICY "editors update kpis" ON public.kpis
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'developer'::public.app_role));
CREATE POLICY "editors delete kpis" ON public.kpis
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'developer'::public.app_role));

-- uploads
DROP POLICY IF EXISTS "editors insert uploads" ON public.uploads;
DROP POLICY IF EXISTS "editors update uploads" ON public.uploads;
DROP POLICY IF EXISTS "editors delete uploads" ON public.uploads;
CREATE POLICY "editors insert uploads" ON public.uploads
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'developer'::public.app_role));
CREATE POLICY "editors update uploads" ON public.uploads
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'developer'::public.app_role));
CREATE POLICY "editors delete uploads" ON public.uploads
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'developer'::public.app_role));

-- storage.objects (uploads bucket)
DROP POLICY IF EXISTS "uploads_insert" ON storage.objects;
DROP POLICY IF EXISTS "uploads_update" ON storage.objects;
DROP POLICY IF EXISTS "uploads_delete" ON storage.objects;
CREATE POLICY "uploads_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK ((bucket_id = 'uploads'::text) AND (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'developer'::public.app_role)));
CREATE POLICY "uploads_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING ((bucket_id = 'uploads'::text) AND (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'developer'::public.app_role)));
CREATE POLICY "uploads_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING ((bucket_id = 'uploads'::text) AND (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'developer'::public.app_role)));

-- document_extractions
DROP POLICY IF EXISTS "Editors manage document_extractions" ON public.document_extractions;
CREATE POLICY "Editors manage document_extractions" ON public.document_extractions
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'developer'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'developer'::public.app_role));

-- initiatives
DROP POLICY IF EXISTS "Editors can insert initiatives" ON public.initiatives;
DROP POLICY IF EXISTS "Editors can update initiatives" ON public.initiatives;
DROP POLICY IF EXISTS "Editors can delete initiatives" ON public.initiatives;
CREATE POLICY "Editors can insert initiatives" ON public.initiatives
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'developer'::public.app_role));
CREATE POLICY "Editors can update initiatives" ON public.initiatives
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'developer'::public.app_role));
CREATE POLICY "Editors can delete initiatives" ON public.initiatives
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'developer'::public.app_role));

-- 4) Finally, drop the public-exposed function
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
