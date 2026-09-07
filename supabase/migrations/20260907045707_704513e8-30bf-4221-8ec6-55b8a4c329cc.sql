CREATE TABLE public.governance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'missing',
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  UNIQUE (policy_id, org_id)
);

GRANT SELECT ON public.governance_policies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.governance_policies TO authenticated;
GRANT ALL ON public.governance_policies TO service_role;

ALTER TABLE public.governance_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_gov" ON public.governance_policies FOR SELECT USING (true);
CREATE POLICY "write_gov" ON public.governance_policies FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'developer'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'developer'));

CREATE TABLE public.gap_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  domain_index INTEGER NOT NULL,
  domain_name TEXT NOT NULL,
  score NUMERIC NOT NULL CHECK (score >= 0 AND score <= 5),
  period TEXT NOT NULL DEFAULT 'Q2-2026',
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  UNIQUE (org_id, domain_index, period)
);

GRANT SELECT ON public.gap_scores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gap_scores TO authenticated;
GRANT ALL ON public.gap_scores TO service_role;

ALTER TABLE public.gap_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_gaps" ON public.gap_scores FOR SELECT USING (true);
CREATE POLICY "write_gaps" ON public.gap_scores FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'developer'))
  WITH CHECK (private.has_role(auth.uid(),'admin') OR private.has_role(auth.uid(),'developer'));

CREATE INDEX ON public.governance_policies (org_id);
CREATE INDEX ON public.governance_policies (policy_id);
CREATE INDEX ON public.gap_scores (org_id, period);

CREATE TRIGGER governance_policies_set_updated_at BEFORE UPDATE ON public.governance_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER gap_scores_set_updated_at BEFORE UPDATE ON public.gap_scores
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.governance_policies (policy_id, org_id, status) VALUES
  ('GP-01','ZF','review'),('GP-01','ZAD','review'),('GP-01','TAYO','review'),('GP-01','KAFI','active'),('GP-01','ZUST','active'),('GP-01','HAMDI','pending'),
  ('GP-02','ZF','review'),('GP-02','ZAD','missing'),('GP-02','TAYO','missing'),('GP-02','KAFI','missing'),('GP-02','ZUST','inactive'),('GP-02','HAMDI','pending'),
  ('GP-03','ZF','active'),('GP-03','ZAD','review'),('GP-03','TAYO','inactive'),('GP-03','KAFI','active'),('GP-03','ZUST','active'),('GP-03','HAMDI','pending'),
  ('GP-04','ZF','missing'),('GP-04','ZAD','missing'),('GP-04','TAYO','missing'),('GP-04','KAFI','inDev'),('GP-04','ZUST','missing'),('GP-04','HAMDI','pending'),
  ('GP-05','ZF','review'),('GP-05','ZAD','inDev'),('GP-05','TAYO','review'),('GP-05','KAFI','active'),('GP-05','ZUST','review'),('GP-05','HAMDI','pending'),
  ('GP-06','ZF','inactive'),('GP-06','ZAD','missing'),('GP-06','TAYO','review'),('GP-06','KAFI','active'),('GP-06','ZUST','missing'),('GP-06','HAMDI','pending'),
  ('GP-07','ZF','active'),('GP-07','ZAD','inactive'),('GP-07','TAYO','review'),('GP-07','KAFI','active'),('GP-07','ZUST','active'),('GP-07','HAMDI','pending'),
  ('GP-08','ZF','active'),('GP-08','ZAD','active'),('GP-08','TAYO','review'),('GP-08','KAFI','active'),('GP-08','ZUST','active'),('GP-08','HAMDI','pending'),
  ('GP-09','ZF','active'),('GP-09','ZAD','missing'),('GP-09','TAYO','missing'),('GP-09','KAFI','active'),('GP-09','ZUST','inDev'),('GP-09','HAMDI','pending'),
  ('GP-10','ZF','active'),('GP-10','ZAD','missing'),('GP-10','TAYO','review'),('GP-10','KAFI','active'),('GP-10','ZUST','missing'),('GP-10','HAMDI','pending'),
  ('GP-11','ZF','active'),('GP-11','ZAD','inactive'),('GP-11','TAYO','missing'),('GP-11','KAFI','active'),('GP-11','ZUST','missing'),('GP-11','HAMDI','pending'),
  ('GP-12','ZF','active'),('GP-12','ZAD','inactive'),('GP-12','TAYO','missing'),('GP-12','KAFI','active'),('GP-12','ZUST','review'),('GP-12','HAMDI','pending'),
  ('GP-13','ZF','active'),('GP-13','ZAD','inactive'),('GP-13','TAYO','missing'),('GP-13','KAFI','inDev'),('GP-13','ZUST','active'),('GP-13','HAMDI','pending'),
  ('GP-14','ZF','active'),('GP-14','ZAD','inactive'),('GP-14','TAYO','active'),('GP-14','KAFI','active'),('GP-14','ZUST','active'),('GP-14','HAMDI','pending'),
  ('GP-15','ZF','active'),('GP-15','ZAD','missing'),('GP-15','TAYO','review'),('GP-15','KAFI','active'),('GP-15','ZUST','inDev'),('GP-15','HAMDI','pending')
ON CONFLICT (policy_id, org_id) DO NOTHING;

INSERT INTO public.gap_scores (org_id, domain_index, domain_name, score, period) VALUES
  ('ZF',0,'الاستراتيجية',3.27,'Q2-2026'),('ZF',1,'القيادة والكفاءات',3.00,'Q2-2026'),('ZF',2,'الأداء والنتائج',3.85,'Q2-2026'),('ZF',3,'العمليات والأنظمة',3.20,'Q2-2026'),('ZF',4,'الموارد المالية',3.40,'Q2-2026'),('ZF',5,'البنية التحتية',3.93,'Q2-2026'),('ZF',6,'الحوكمة والامتثال',3.67,'Q2-2026'),
  ('ZAD',0,'الاستراتيجية',3.54,'Q2-2026'),('ZAD',1,'القيادة والكفاءات',2.75,'Q2-2026'),('ZAD',2,'الأداء والنتائج',3.35,'Q2-2026'),('ZAD',3,'العمليات والأنظمة',1.95,'Q2-2026'),('ZAD',4,'الموارد المالية',3.25,'Q2-2026'),('ZAD',5,'البنية التحتية',3.40,'Q2-2026'),('ZAD',6,'الحوكمة والامتثال',0.87,'Q2-2026'),
  ('TAYO',0,'الاستراتيجية',4.22,'Q2-2026'),('TAYO',1,'القيادة والكفاءات',4.35,'Q2-2026'),('TAYO',2,'الأداء والنتائج',4.35,'Q2-2026'),('TAYO',3,'العمليات والأنظمة',1.80,'Q2-2026'),('TAYO',4,'الموارد المالية',2.85,'Q2-2026'),('TAYO',5,'البنية التحتية',3.48,'Q2-2026'),('TAYO',6,'الحوكمة والامتثال',2.17,'Q2-2026'),
  ('KAFI',0,'الاستراتيجية',3.94,'Q2-2026'),('KAFI',1,'القيادة والكفاءات',4.25,'Q2-2026'),('KAFI',2,'الأداء والنتائج',4.93,'Q2-2026'),('KAFI',3,'العمليات والأنظمة',2.75,'Q2-2026'),('KAFI',4,'الموارد المالية',4.00,'Q2-2026'),('KAFI',5,'البنية التحتية',4.48,'Q2-2026'),('KAFI',6,'الحوكمة والامتثال',4.40,'Q2-2026'),
  ('ZUST',0,'الاستراتيجية',3.80,'Q2-2026'),('ZUST',1,'القيادة والكفاءات',3.95,'Q2-2026'),('ZUST',2,'الأداء والنتائج',4.40,'Q2-2026'),('ZUST',3,'العمليات والأنظمة',2.30,'Q2-2026'),('ZUST',4,'الموارد المالية',3.55,'Q2-2026'),('ZUST',5,'البنية التحتية',4.48,'Q2-2026'),('ZUST',6,'الحوكمة والامتثال',3.11,'Q2-2026')
ON CONFLICT (org_id, domain_index, period) DO NOTHING;