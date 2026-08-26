CREATE UNIQUE INDEX IF NOT EXISTS timeline_entries_org_domain_period_key
  ON public.timeline_entries (org_id, domain, period);

INSERT INTO public.timeline_entries (org_id, domain, period, period_order, value, note) VALUES
 ('ZF','gap','H2-2025',1,3.30,'تقييم تأسيسي'),
 ('ZF','gap','Q1-2026',2,3.44,'تحديث ربع أول'),
 ('ZUST','gap','H2-2025',1,3.55,'تقييم تأسيسي'),
 ('ZUST','gap','Q1-2026',2,3.72,'تحديث ربع أول'),
 ('ZUST','governance','2026-01',1,2.80,'أول تقييم حوكمي'),
 ('ZUST','governance','2026-04',2,3.11,'بعد ورش العمل'),
 ('ZUST','financial','Q4-2025',1,2.50,'تقييم تأسيسي'),
 ('ZUST','financial','Q1-2026',2,3.00,'اعتماد QuickBooks'),
 ('ZUST','financial','Q2-2026',3,3.20,'تقدم دليل السياسات'),
 ('ZAD','gap','H2-2025',1,2.85,'تقييم تأسيسي'),
 ('ZAD','gap','Q1-2026',2,3.04,'تحديث ربع أول'),
 ('ZAD','governance','2026-01',1,0.70,'أول تقييم حوكمي'),
 ('ZAD','governance','2026-04',2,0.87,'تحديث أبريل'),
 ('TAYO','gap','H2-2025',1,3.30,'تقييم تأسيسي'),
 ('TAYO','gap','Q1-2026',2,3.49,'تحديث ربع أول'),
 ('TAYO','financial','Q4-2025',1,1.80,'قبل QuickBooks'),
 ('TAYO','financial','Q1-2026',2,2.50,'اعتماد دليل الحسابات'),
 ('TAYO','financial','Q2-2026',3,2.90,'تحديث Q2'),
 ('KAFI','gap','H2-2025',1,3.90,'تقييم تأسيسي'),
 ('KAFI','gap','Q1-2026',2,4.06,'تحديث ربع أول'),
 ('KAFI','governance','2026-01',1,4.20,'تقييم أولي'),
 ('KAFI','governance','2026-04',2,4.40,'تحديث أبريل')
ON CONFLICT (org_id, domain, period) DO NOTHING;