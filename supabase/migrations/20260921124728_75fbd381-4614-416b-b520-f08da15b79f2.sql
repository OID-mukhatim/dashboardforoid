CREATE TABLE public.terminology (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT NOT NULL UNIQUE,
  ar         TEXT NOT NULL,
  en         TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'general',
  notes      TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.terminology TO authenticated;
GRANT ALL ON public.terminology TO service_role;
ALTER TABLE public.terminology ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_terminology" ON public.terminology
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "write_terminology" ON public.terminology
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'))
  WITH CHECK (private.has_role(auth.uid(),'admin'));

CREATE TABLE public.translations_cache (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_text  TEXT NOT NULL,
  source_lang  TEXT NOT NULL,
  target_lang  TEXT NOT NULL,
  translated   TEXT NOT NULL,
  table_name   TEXT,
  record_id    TEXT,
  field_name   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_text, source_lang, target_lang)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.translations_cache TO authenticated;
GRANT ALL ON public.translations_cache TO service_role;
ALTER TABLE public.translations_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_translations" ON public.translations_cache
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "write_translations" ON public.translations_cache
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS preferred_lang TEXT DEFAULT 'ar';
ALTER TABLE public.kpis ADD COLUMN IF NOT EXISTS input_lang TEXT DEFAULT 'ar';

CREATE INDEX terminology_key_idx ON public.terminology (key);
CREATE INDEX terminology_category_idx ON public.terminology (category);
CREATE INDEX translations_cache_lookup_idx ON public.translations_cache (source_text, source_lang, target_lang);
CREATE INDEX translations_cache_record_idx ON public.translations_cache (record_id, field_name);

CREATE TRIGGER terminology_set_updated_at BEFORE UPDATE ON public.terminology
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.terminology (key, ar, en, category) VALUES
  ('perspective.stakeholders',  'أصحاب المصلحة',    'Stakeholders',       'perspective'),
  ('perspective.internal',      'العمليات الداخلية', 'Internal Processes', 'perspective'),
  ('perspective.learning',      'التعلم والنمو',     'Learning & Growth',  'perspective'),
  ('perspective.financial',     'المالي',            'Financial',          'perspective'),
  ('section.dashboard',     'لوحة القيادة',             'Dashboard',               'section'),
  ('section.kpis',          'مؤشرات الأداء',            'KPIs',                    'section'),
  ('section.quarterly',     'التقارير الربعية',          'Quarterly Reports',        'section'),
  ('section.gaps',          'تحليل الفجوات',            'Gap Analysis',            'section'),
  ('section.governance',    'الحوكمة والامتثال',         'Governance & Compliance', 'section'),
  ('section.financial',     'المستشار المالي',           'Financial Advisor',       'section'),
  ('section.partnerships',  'الشراكات الاستراتيجية',    'Strategic Partnerships',  'section'),
  ('section.profiles',      'البيانات المؤسسية',         'Institutional Profiles',  'section'),
  ('section.initiatives',   'المبادرات التطويرية',       'Development Initiatives', 'section'),
  ('section.office',        'أعمال المكتب',             'Office Work',             'section'),
  ('section.upload',        'رفع البيانات',              'Data Upload',             'section'),
  ('section.terminology',   'إدارة المصطلحات',           'Terminology Management',  'section'),
  ('maturity.1', 'مبتدئ',  'Initial',    'maturity'),
  ('maturity.2', 'ناشئ',   'Emerging',   'maturity'),
  ('maturity.3', 'متطور',  'Developing', 'maturity'),
  ('maturity.4', 'متقدم',  'Advanced',   'maturity'),
  ('maturity.5', 'ريادي',  'Leading',    'maturity'),
  ('kpi.nature.ratio',    'كمي نسبي',         'Quantitative Ratio',  'kpi'),
  ('kpi.nature.number',   'كمي عددي',         'Quantitative Number', 'kpi'),
  ('kpi.nature.quality',  'نوعي',             'Qualitative',         'kpi'),
  ('kpi.role.driving',    'موجهات',           'Driving',             'kpi'),
  ('kpi.role.output',     'مخرجات',           'Output',              'kpi'),
  ('kpi.polarity.asc',    'تصاعدي',           'Ascending',           'kpi'),
  ('kpi.polarity.desc',   'تنازلي',           'Descending',          'kpi'),
  ('office.name.ar', 'مكتب الإشراف والتطوير المؤسسي', 'Oversight & Institutional Development', 'general'),
  ('office.abbr',    'OID',                            'OID',                                   'general'),
  ('org.ZF',    'مؤسسة زمزم',                      'Zamzam Foundation',                    'institution'),
  ('org.ZUST',  'جامعة زمزم للعلوم والتكنولوجيا', 'Zamzam University of Science & Technology', 'institution'),
  ('org.ZAD',   'زاد للتنمية',                     'Zad for Development',                 'institution'),
  ('org.TAYO',  'تيو للتعليم',                     'Tayo for Education',                  'institution'),
  ('org.KAFI',  'كافي للتنمية',                    'Kafi for Development',                'institution'),
  ('org.HAMDI', 'منظمة حمدي للرعاية والتنمية',    'Hamdi Organization for Relief & Development', 'institution')
ON CONFLICT (key) DO NOTHING;