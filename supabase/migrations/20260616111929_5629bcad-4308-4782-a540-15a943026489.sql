CREATE TABLE public.document_extractions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id uuid REFERENCES public.uploads(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  text_preview text,
  entities jsonb DEFAULT '[]'::jsonb,
  org_mentions jsonb DEFAULT '[]'::jsonb,
  numbers_found jsonb DEFAULT '[]'::jsonb,
  summary text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_extractions TO authenticated;
GRANT ALL ON public.document_extractions TO service_role;

ALTER TABLE public.document_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Editors manage document_extractions" ON public.document_extractions
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'developer'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'developer'::app_role));

CREATE POLICY "Users read document_extractions" ON public.document_extractions
  FOR SELECT
  TO authenticated
  USING (true);