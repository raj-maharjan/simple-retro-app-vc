-- Note Images Storage Setup Script
-- Run this in your Supabase SQL Editor to set up note image uploads

-- First, create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('note-images', 'note-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the note-images bucket

-- 1. Allow authenticated users to upload their own files
CREATE POLICY "Users can upload note images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'note-images' AND
    (auth.uid()::text) = (storage.foldername(name))[1]
);

-- 2. Allow public read access to note images
CREATE POLICY "Note images are publicly accessible" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'note-images');

-- 3. Allow users to update their own note image files
CREATE POLICY "Users can update their own note images" ON storage.objects
FOR UPDATE TO authenticated
USING (
    bucket_id = 'note-images' AND
    (auth.uid()::text) = (storage.foldername(name))[1]
)
WITH CHECK (
    bucket_id = 'note-images' AND
    (auth.uid()::text) = (storage.foldername(name))[1]
);

-- 4. Allow users to delete their own note image files
CREATE POLICY "Users can delete their own note images" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'note-images' AND
    (auth.uid()::text) = (storage.foldername(name))[1]
);

-- Set bucket size limits and allowed MIME types
UPDATE storage.buckets 
SET 
    file_size_limit = 10485760,  -- 10MB limit
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
WHERE id = 'note-images';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Note images storage setup completed successfully!';
    RAISE NOTICE 'Bucket: note-images (public: true)';
    RAISE NOTICE 'File size limit: 10MB';
    RAISE NOTICE 'Allowed types: JPEG, PNG, GIF, WebP';
    RAISE NOTICE 'RLS policies: Upload own files, Public read, Update/Delete own files';
END $$; 