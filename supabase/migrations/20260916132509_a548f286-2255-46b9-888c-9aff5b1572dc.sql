-- تحديث قيم دور المؤشر من الصيغ القديمة إلى الجديدة
UPDATE public.kpis SET
  indicator_role = CASE indicator_role
    WHEN 'leading' THEN 'driving'
    WHEN 'lagging' THEN 'output'
    ELSE indicator_role
  END
WHERE indicator_role IN ('leading', 'lagging');