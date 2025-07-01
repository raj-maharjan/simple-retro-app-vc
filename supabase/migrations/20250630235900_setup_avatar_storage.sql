-- Avatar Storage Setup Script
-- Run this in your Supabase SQL Editor to set up avatar image uploads

-- First, create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the avatars bucket

-- 1. Allow authenticated users to upload their own files
CREATE POLICY "Users can upload avatar images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'avatars' AND
    (auth.uid()::text) = (storage.foldername(name))[1]
);

-- 2. Allow public read access to avatar images
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'avatars');

-- 3. Allow users to update their own avatar files
CREATE POLICY "Users can update their own avatars" ON storage.objects
FOR UPDATE TO authenticated
USING (
    bucket_id = 'avatars' AND
    (auth.uid()::text) = (storage.foldername(name))[1]
)
WITH CHECK (
    bucket_id = 'avatars' AND
    (auth.uid()::text) = (storage.foldername(name))[1]
);

-- 4. Allow users to delete their own avatar files
CREATE POLICY "Users can delete their own avatars" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'avatars' AND
    (auth.uid()::text) = (storage.foldername(name))[1]
);

-- Verification queries (run these to check if everything is set up correctly)
/*
-- Check if bucket exists:
SELECT * FROM storage.buckets WHERE id = 'avatars';

-- Check RLS policies:
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';

-- Test bucket access (should return empty result, not error):
SELECT * FROM storage.objects WHERE bucket_id = 'avatars' LIMIT 1;
*/

-- Optional: Set bucket size limits and allowed MIME types
UPDATE storage.buckets 
SET 
    file_size_limit = 5242880,  -- 5MB limit
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
WHERE id = 'avatars';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Avatar storage setup completed successfully!';
    RAISE NOTICE 'Bucket: avatars (public: true)';
    RAISE NOTICE 'File size limit: 5MB';
    RAISE NOTICE 'Allowed types: JPEG, PNG, GIF, WebP';
    RAISE NOTICE 'RLS policies: Upload own files, Public read, Update/Delete own files';
END $$; 