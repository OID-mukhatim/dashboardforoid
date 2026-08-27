-- ===== إغلاق السياسات المفتوحة على جدول الرفعات =====
DROP POLICY IF EXISTS "open_insert_uploads" ON public.uploads;
DROP POLICY IF EXISTS "open_update_uploads" ON public.uploads;
DROP POLICY IF EXISTS "open_delete_uploads" ON public.uploads;
DROP POLICY IF EXISTS "editors insert uploads" ON public.uploads;
DROP POLICY IF EXISTS "editors update uploads" ON public.uploads;
DROP POLICY IF EXISTS "editors delete uploads" ON public.uploads;

-- سياسة إدراج صارمة: المسؤول أو المطوّر فقط
CREATE POLICY "auth_insert_uploads" ON public.uploads
  FOR INSERT TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::app_role) OR
    private.has_role(auth.uid(), 'developer'::app_role)
  );

-- سياسة تحديث: صاحب الملف أو المسؤول
CREATE POLICY "auth_update_uploads" ON public.uploads
  FOR UPDATE TO authenticated
  USING (
    uploaded_by = auth.uid() OR
    private.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::app_role) OR
    uploaded_by = auth.uid()
  );

-- سياسة حذف: المسؤول فقط
CREATE POLICY "auth_delete_uploads" ON public.uploads
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- ===== تعيين uploaded_by تلقائياً عند الإدراج =====
DROP TRIGGER IF EXISTS uploads_set_uploaded_by ON public.uploads;
DROP FUNCTION IF EXISTS public.set_uploaded_by();

CREATE OR REPLACE FUNCTION public.set_uploaded_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.uploaded_by = auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER uploads_set_uploaded_by
  BEFORE INSERT ON public.uploads
  FOR EACH ROW EXECUTE FUNCTION public.set_uploaded_by();

-- ===== فرض RLS على جداول الشبكة =====
ALTER TABLE public.partnerships      FORCE ROW LEVEL SECURITY;
ALTER TABLE public.quarterly_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_entries  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.institutions      FORCE ROW LEVEL SECURITY;