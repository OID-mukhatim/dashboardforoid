CREATE TABLE public.partnerships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  name_en     TEXT,
  type        TEXT NOT NULL DEFAULT 'operational',
  status      TEXT NOT NULL DEFAULT 'active',
  geography   TEXT,
  linked_orgs TEXT[] NOT NULL DEFAULT '{}',
  start_date  DATE,
  end_date    DATE,
  description TEXT,
  outcomes    TEXT[],
  contact     TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.quarterly_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id    UUID REFERENCES public.uploads(id) ON DELETE SET NULL,
  org_id       TEXT NOT NULL,
  year         INTEGER NOT NULL DEFAULT 2026,
  quarter      TEXT NOT NULL DEFAULT 'Q1',
  title        TEXT NOT NULL,
  kpi_code     TEXT,
  target       TEXT,
  achieved     TEXT,
  pct          NUMERIC,
  beneficiaries TEXT,
  budget       NUMERIC DEFAULT 0,
  cost         NUMERIC DEFAULT 0,
  deviation    NUMERIC DEFAULT 0,
  status       TEXT DEFAULT 'inProgress',
  report_type  TEXT DEFAULT 'achievement',
  raw          JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, year, quarter, title)
);

CREATE TABLE public.timeline_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       TEXT NOT NULL,
  domain       TEXT NOT NULL,
  period       TEXT NOT NULL,
  period_order NUMERIC NOT NULL,
  value        NUMERIC NOT NULL,
  recorded_at  TIMESTAMPTZ DEFAULT now(),
  note         TEXT,
  UNIQUE (org_id, domain, period)
);

CREATE TABLE public.institutions (
  id              TEXT PRIMARY KEY,
  name_ar         TEXT NOT NULL,
  name_en         TEXT,
  founded         TEXT,
  license_number  TEXT,
  license_expiry  DATE,
  address         TEXT,
  website         TEXT,
  exec_name_ar    TEXT,
  exec_phone      TEXT,
  exec_email      TEXT,
  deputy_name_ar  TEXT,
  deputy_phone    TEXT,
  deputy_email    TEXT,
  staff_male      INTEGER,
  staff_female    INTEGER,
  staff_total     INTEGER,
  budget          NUMERIC,
  sector          TEXT,
  excellence      TEXT,
  branches        TEXT,
  logo_url        TEXT,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT ON public.partnerships TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partnerships TO authenticated;
GRANT ALL ON public.partnerships TO service_role;

GRANT SELECT ON public.quarterly_reports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quarterly_reports TO authenticated;
GRANT ALL ON public.quarterly_reports TO service_role;

GRANT SELECT ON public.timeline_entries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timeline_entries TO authenticated;
GRANT ALL ON public.timeline_entries TO service_role;

GRANT SELECT ON public.institutions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.institutions TO authenticated;
GRANT ALL ON public.institutions TO service_role;

ALTER TABLE public.partnerships      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quarterly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutions      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_partnerships"  ON public.partnerships      FOR SELECT USING (true);
CREATE POLICY "read_quarterly"     ON public.quarterly_reports FOR SELECT USING (true);
CREATE POLICY "read_timeline"      ON public.timeline_entries  FOR SELECT USING (true);
CREATE POLICY "read_institutions"  ON public.institutions      FOR SELECT USING (true);

CREATE POLICY "write_partnerships" ON public.partnerships
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'developer'))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'developer'));

CREATE POLICY "write_quarterly" ON public.quarterly_reports
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'developer'))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'developer'));

CREATE POLICY "write_timeline" ON public.timeline_entries
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'developer'))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'developer'));

CREATE POLICY "write_institutions" ON public.institutions
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'developer'))
  WITH CHECK (private.has_role(auth.uid(), 'admin') OR private.has_role(auth.uid(), 'developer'));

CREATE INDEX ON public.partnerships      (status);
CREATE INDEX ON public.quarterly_reports (org_id, year, quarter);
CREATE INDEX ON public.timeline_entries  (org_id, domain);

CREATE TRIGGER partnerships_set_updated_at BEFORE UPDATE ON public.partnerships FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER quarterly_reports_set_updated_at BEFORE UPDATE ON public.quarterly_reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER institutions_set_updated_at BEFORE UPDATE ON public.institutions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.partnerships (name, type, status, geography, linked_orgs) VALUES
  ('الهيئة الخيرية الإسلامية — قطر', 'استراتيجية', 'فاعلة', 'عربي', ARRAY['KAFI']),
  ('مركز بناء للتدريب', 'تشغيلية', 'فاعلة', 'محلي — الصومال', ARRAY['KAFI']),
  ('IHHNL', 'استراتيجية', 'فاعلة', 'دولي', ARRAY['ZAD']),
  ('AHAD — منتدى التعاون والتنمية', 'استراتيجية', 'فاعلة', 'دولي', ARRAY['ZAD']),
  ('Zad Turkey', 'مذكرة تفاهم', 'فاعلة', 'دولي', ARRAY['ZAD']),
  ('MyCare', 'تشغيلية', 'فاعلة', 'دولي', ARRAY['ZAD']),
  ('رابطة الجامعات الأفريقية (AAU)', 'عضوية', 'فاعلة', 'إقليمي — أفريقيا', ARRAY['ZUST']),
  ('رابطة الجامعات العربية (AARU)', 'عضوية', 'فاعلة', 'عربي', ARRAY['ZUST']),
  ('رابطة الجامعات الصومالية (ASU)', 'عضوية', 'فاعلة', 'محلي — الصومال', ARRAY['ZUST']),
  ('TIKA — الوكالة التركية للتعاون', 'تنموية', 'فاعلة', 'دولي', ARRAY['ZUST']),
  ('المجلس النرويجي للاجئين (NRC)', 'تنموية', 'فاعلة', 'دولي', ARRAY['ZUST']),
  ('جامعة توكات غازي عثمان باشا', 'أكاديمية', 'فاعلة', 'دولي', ARRAY['ZUST']),
  ('جامعة جيبوتي', 'أكاديمية', 'فاعلة', 'إقليمي — أفريقيا', ARRAY['ZUST']);

INSERT INTO public.institutions (id, name_ar, name_en, founded, license_number, license_expiry, address, exec_name_ar, exec_phone, exec_email, staff_total, budget, sector) VALUES
  ('ZF', 'مؤسسة زمزم', 'Zamzam Foundation', NULL, NULL, NULL, 'مقديشو، الصومال', NULL, '+252770500031', 'info@zamzamsom.org', NULL, NULL, 'تنمية إنسانية شاملة'),
  ('ZUST', 'جامعة زمزم للعلوم والتكنولوجيا', 'ZUST', 'أغسطس 2014', 'وزارة التربية', NULL, 'كم 11، طريق أفجوي، مقديشو', 'حسن محمد محمد', '+252612224054', 'Rector@zust.edu.so', 87, 1166083, 'تعليم عالٍ وبحث'),
  ('ZAD', 'زاد للتنمية', 'Zad for Development', '20/12/2005', 'MoIFAR/NGOD/0681', '2026-10-23', 'حي هدن، مقديشو', 'عمر عبدالرزاق يوسف', '0615583258', 'omar@zadsom.org', 14, 1800000, 'صحة وتعليم وتمكين'),
  ('TAYO', 'تيو للتعليم', 'Tayo for Education', '05/09/2017', '/0123NGOD/MoIFAR', '2027-02-21', 'ياقشيد، مقديشو', 'علي معلم حسن', '+252618454544', 'tayoeducation7@gmail.com', 289, 914668, 'تعليم أساسي وثانوي'),
  ('KAFI', 'كافي للتنمية', 'Kafi for Development', '01/02/2020', '508O/NGOD/MoIEAR', '2026-10-07', 'حي هدن، مجمع سفاري، مقديشو', 'عبد الرحمن بشر السنوسي محمد', '+252614293111', 'info@kafii.org', 4, 1423000, 'تنمية مجتمعية وتمويل'),
  ('HAMDI', 'منظمة حمدي للرعاية والتنمية', 'Hamdi Organization', 'مارس 1993', '0287/2020', '2021-12-09', 'شارع المطار، حي ودجر، مقديشو', 'د. زعيمة عبد الله حاج عبد الله', '+252615372878', 'xordorg@gmail.com', 59, 170000, 'تعليم وإغاثة');