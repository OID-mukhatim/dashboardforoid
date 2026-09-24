CREATE TABLE public.section_order (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  sections JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.section_order TO authenticated;
GRANT ALL ON public.section_order TO service_role;
ALTER TABLE public.section_order ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_own_order" ON public.section_order FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "write_own_order" ON public.section_order FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER section_order_set_updated_at BEFORE UPDATE ON public.section_order FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();