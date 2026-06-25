
ALTER TABLE public.document_extractions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'document',
  ADD COLUMN IF NOT EXISTS entity_code text,
  ADD COLUMN IF NOT EXISTS payload jsonb;

CREATE INDEX IF NOT EXISTS document_extractions_kind_entity_idx
  ON public.document_extractions(kind, entity_code);

CREATE INDEX IF NOT EXISTS document_extractions_upload_idx
  ON public.document_extractions(upload_id);
