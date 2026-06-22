
CREATE TABLE public.initiatives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT,
  priority TEXT NOT NULL DEFAULT 'متوسط',
  status TEXT NOT NULL DEFAULT 'مقترح',
  domain TEXT,
  title TEXT NOT NULL,
  objective TEXT,
  gap TEXT,
  orgs TEXT[] NOT NULL DEFAULT '{}',
  timeline TEXT,
  cost TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.initiatives TO authenticated;
GRANT ALL ON public.initiatives TO service_role;

ALTER TABLE public.initiatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view initiatives"
  ON public.initiatives FOR SELECT TO authenticated USING (true);

CREATE POLICY "Editors can insert initiatives"
  ON public.initiatives FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'));

CREATE POLICY "Editors can update initiatives"
  ON public.initiatives FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'));

CREATE POLICY "Editors can delete initiatives"
  ON public.initiatives FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'developer'));

CREATE TRIGGER initiatives_set_updated_at
  BEFORE UPDATE ON public.initiatives
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
