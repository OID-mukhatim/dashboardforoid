DROP POLICY IF EXISTS uploads_read   ON storage.objects;
DROP POLICY IF EXISTS uploads_insert ON storage.objects;
DROP POLICY IF EXISTS uploads_update ON storage.objects;
DROP POLICY IF EXISTS uploads_delete ON storage.objects;

CREATE POLICY uploads_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'uploads');

CREATE POLICY uploads_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'uploads'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'))
  );

CREATE POLICY uploads_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'uploads'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'))
  );

CREATE POLICY uploads_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'uploads'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'))
  );