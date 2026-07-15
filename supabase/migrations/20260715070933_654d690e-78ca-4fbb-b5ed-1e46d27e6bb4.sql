-- تنظيف الاستخراجات المشوّهة من مستندات Word السابقة، وتحديد الملفات
-- كـ"مرفوعة" ليعاد تحليلها بعد تحسين مستخرج DOCX.
DELETE FROM public.document_extractions
 WHERE kind = 'document';

UPDATE public.uploads
   SET status = 'uploaded',
       extracted_summary = NULL,
       error_message = NULL
 WHERE lower(file_name) LIKE '%.docx'
    OR lower(file_name) LIKE '%.pdf'
    OR lower(file_name) LIKE '%.pptx';