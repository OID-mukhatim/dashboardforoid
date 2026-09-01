ALTER TABLE public.office_tasks ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE public.office_tasks ADD COLUMN IF NOT EXISTS source_ref TEXT;

CREATE INDEX IF NOT EXISTS office_tasks_status_idx ON public.office_tasks (status);
CREATE INDEX IF NOT EXISTS office_tasks_org_id_idx ON public.office_tasks (org_id);
CREATE INDEX IF NOT EXISTS office_tasks_due_date_idx ON public.office_tasks (due_date);