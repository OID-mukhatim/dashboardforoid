ALTER TABLE public.kpis
  ADD COLUMN IF NOT EXISTS measurement_nature TEXT,
  ADD COLUMN IF NOT EXISTS indicator_role TEXT;

UPDATE public.kpis SET
  measurement_nature = CASE
    WHEN COALESCE(unit,'') LIKE '%\%%' OR kpi_type ILIKE '%نسب%' OR kpi_type ILIKE '%مئو%' OR kpi_type ILIKE '%ratio%' OR kpi_type ILIKE '%percent%' OR kpi_type LIKE '%\%%'
      THEN 'quantitative_ratio'
    WHEN kpi_type ILIKE '%عدد%' OR kpi_type ILIKE '%number%' OR kpi_type ILIKE '%count%'
      THEN 'quantitative_number'
    WHEN kpi_type ILIKE '%نوع%' OR kpi_type ILIKE '%qualit%' OR kpi_type ILIKE '%ليكرت%'
      THEN 'qualitative'
    ELSE 'quantitative_ratio'
  END,
  indicator_role = CASE
    WHEN kpi_type ILIKE '%قائد%' OR kpi_type ILIKE '%قياد%' OR kpi_type ILIKE '%leading%'
      THEN 'leading'
    ELSE 'lagging'
  END
WHERE measurement_nature IS NULL OR indicator_role IS NULL;

ALTER TABLE public.kpis
  ALTER COLUMN measurement_nature SET DEFAULT 'quantitative_ratio',
  ALTER COLUMN indicator_role SET DEFAULT 'lagging';