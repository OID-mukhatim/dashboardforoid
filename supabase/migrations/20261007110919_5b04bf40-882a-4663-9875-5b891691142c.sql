CREATE TABLE public.advisor_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  period_order integer NOT NULL,
  timeline_title text NOT NULL,
  done boolean NOT NULL DEFAULT true,
  assessment jsonb,
  program jsonb,
  source_upload_id uuid UNIQUE REFERENCES public.uploads(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.advisor_snapshots TO authenticated;
GRANT ALL ON public.advisor_snapshots TO service_role;
ALTER TABLE public.advisor_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read advisor snapshots" ON public.advisor_snapshots FOR SELECT TO authenticated USING (true);
CREATE INDEX advisor_snapshots_order_idx ON public.advisor_snapshots(period_order);
CREATE TRIGGER advisor_snapshots_set_updated_at BEFORE UPDATE ON public.advisor_snapshots FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();