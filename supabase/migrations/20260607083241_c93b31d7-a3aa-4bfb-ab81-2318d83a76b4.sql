
CREATE TABLE public.uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  data_type TEXT NOT NULL DEFAULT 'all',
  org_id TEXT NOT NULL DEFAULT 'all',
  period TEXT NOT NULL DEFAULT 'all',
  status TEXT NOT NULL DEFAULT 'pending',
  rows_extracted INTEGER DEFAULT 0,
  error_message TEXT,
  extracted_summary JSONB,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uploads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uploads TO anon;
GRANT ALL ON public.uploads TO service_role;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open_select_uploads" ON public.uploads FOR SELECT USING (true);
CREATE POLICY "open_insert_uploads" ON public.uploads FOR INSERT WITH CHECK (true);
CREATE POLICY "open_update_uploads" ON public.uploads FOR UPDATE USING (true);
CREATE POLICY "open_delete_uploads" ON public.uploads FOR DELETE USING (true);

-- Storage RLS for the 'uploads' bucket (open temporarily)
CREATE POLICY "uploads_read" ON storage.objects FOR SELECT USING (bucket_id = 'uploads');
CREATE POLICY "uploads_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'uploads');
CREATE POLICY "uploads_update" ON storage.objects FOR UPDATE USING (bucket_id = 'uploads');
CREATE POLICY "uploads_delete" ON storage.objects FOR DELETE USING (bucket_id = 'uploads');
