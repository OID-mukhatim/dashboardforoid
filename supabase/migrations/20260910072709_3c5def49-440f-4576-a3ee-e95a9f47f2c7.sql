ALTER TABLE public.kpis ADD COLUMN IF NOT EXISTS fiscal_year_type TEXT NOT NULL DEFAULT 'calendar';
ALTER TABLE public.quarterly_reports ADD COLUMN IF NOT EXISTS fiscal_year_type TEXT NOT NULL DEFAULT 'calendar';
ALTER TABLE public.timeline_entries ADD COLUMN IF NOT EXISTS fiscal_year_type TEXT NOT NULL DEFAULT 'calendar';
ALTER TABLE public.document_extractions ADD COLUMN IF NOT EXISTS fiscal_year_type TEXT NOT NULL DEFAULT 'calendar';

UPDATE public.quarterly_reports SET quarter = 'Q4' WHERE org_id IN ('ZUST','TAYO','HAMDI') AND year = 2026 AND quarter = 'Q3';
UPDATE public.quarterly_reports SET quarter = 'Q3' WHERE org_id IN ('ZUST','TAYO','HAMDI') AND year = 2026 AND quarter = 'Q2';
UPDATE public.quarterly_reports SET quarter = 'Q2' WHERE org_id IN ('ZUST','TAYO','HAMDI') AND year = 2026 AND quarter = 'Q1';

UPDATE public.timeline_entries SET period = 'Q4-2026' WHERE org_id IN ('ZUST','TAYO','HAMDI') AND period = 'Q3-2026';
UPDATE public.timeline_entries SET period = 'Q3-2026' WHERE org_id IN ('ZUST','TAYO','HAMDI') AND period = 'Q2-2026';
UPDATE public.timeline_entries SET period = 'Q2-2026' WHERE org_id IN ('ZUST','TAYO','HAMDI') AND period = 'Q1-2026';

UPDATE public.document_extractions
SET payload = jsonb_set(payload, '{quarter}',
  CASE payload->>'quarter' WHEN 'Q1' THEN '"Q2"'::jsonb WHEN 'Q2' THEN '"Q3"'::jsonb WHEN 'Q3' THEN '"Q4"'::jsonb ELSE payload->'quarter' END)
WHERE entity_code IN ('ZUST','TAYO','HAMDI')
  AND payload IS NOT NULL
  AND payload->>'quarter' IN ('Q1','Q2','Q3')
  AND COALESCE((payload->>'year')::int, 2026) = 2026;

UPDATE public.kpis SET fiscal_year_type = 'academic' WHERE entity_code IN ('ZUST','TAYO','HAMDI');
UPDATE public.quarterly_reports SET fiscal_year_type = 'academic' WHERE org_id IN ('ZUST','TAYO','HAMDI');
UPDATE public.timeline_entries SET fiscal_year_type = 'academic' WHERE org_id IN ('ZUST','TAYO','HAMDI');
UPDATE public.document_extractions SET fiscal_year_type = 'academic' WHERE entity_code IN ('ZUST','TAYO','HAMDI');