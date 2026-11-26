-- Private storage for public feedback form attachments.
-- Run this once in the Supabase SQL editor before enabling attachments.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'phan-anh-dinh-kem',
  'phan-anh-dinh-kem',
  false,
  8388608,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "feedback_attachments_public_upload" on storage.objects;
create policy "feedback_attachments_public_upload"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id = 'phan-anh-dinh-kem'
  and (storage.foldername(name))[1] = 'feedbacks'
);

drop policy if exists "feedback_attachments_admin_read" on storage.objects;
create policy "feedback_attachments_admin_read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'phan-anh-dinh-kem'
  and (storage.foldername(name))[1] = 'feedbacks'
);
