-- Check Real-time Configuration
-- Run this in Supabase SQL Editor to verify real-time setup

-- 1. Check if tables are in real-time publication
SELECT 
    schemaname, 
    tablename,
    CASE 
        WHEN tablename = ANY(
            SELECT unnest(
                string_to_array(
                    replace(
                        replace(pubtables, '{', ''), 
                        '}', ''
                    ), 
                    ','
                )
            )
            FROM pg_publication 
            WHERE pubname = 'supabase_realtime'
        ) THEN '✅ Enabled'
        ELSE '❌ Not enabled'
    END as realtime_status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('notes', 'note_likes', 'meetings', 'user_profiles')
ORDER BY tablename;

-- 2. Check RLS policies for notes table
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    roles,
    CASE 
        WHEN qual IS NOT NULL THEN 'Has USING clause'
        ELSE 'No USING clause'
    END as using_clause,
    CASE 
        WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
        ELSE 'No WITH CHECK clause'
    END as with_check_clause
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'notes'
ORDER BY policyname;

-- 3. Check real-time publication details
SELECT 
    pubname,
    pubtables,
    pubinsert,
    pubupdate,
    pubdelete
FROM pg_publication 
WHERE pubname = 'supabase_realtime';

-- 4. Show recent notes to verify data access
SELECT 
    id,
    content,
    type,
    created_by,
    created_at,
    meeting_id
FROM notes 
ORDER BY created_at DESC 
LIMIT 5; 