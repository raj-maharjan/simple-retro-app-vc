/*
  # Fix Database References and Meeting Status

  1. Foreign Key Fixes
    - Ensure all foreign keys properly reference auth.users
    - Fix any broken constraints safely

  2. Meeting Status Updates
    - Auto-end meetings older than 2 hours
    - Set proper ended_at timestamps

  3. Performance Improvements
    - Add missing indexes
    - Optimize query performance
*/

-- Auto-end meetings that are older than 2 hours and still active
UPDATE meetings 
SET 
  status = 'ended',
  ended_at = COALESCE(ended_at, created_at + INTERVAL '2 hours'),
  ended_by = COALESCE(ended_by, NULL)
WHERE 
  status = 'active' 
  AND created_at < NOW() - INTERVAL '2 hours';

-- Ensure all meetings have a proper status
UPDATE meetings 
SET status = 'active' 
WHERE status IS NULL;

-- Add missing indexes for better performance
CREATE INDEX IF NOT EXISTS meetings_created_by_idx ON meetings(created_by);
CREATE INDEX IF NOT EXISTS meetings_status_created_at_idx ON meetings(status, created_at);
CREATE INDEX IF NOT EXISTS notes_meeting_id_created_by_idx ON notes(meeting_id, created_by);

-- Verify and fix foreign key constraints one by one
DO $$
DECLARE
    constraint_exists boolean;
BEGIN
    -- Check and fix meetings.created_by constraint
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'meetings_created_by_fkey' 
        AND table_name = 'meetings'
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
        -- Check if the constraint references the wrong table
        IF EXISTS (
            SELECT 1 FROM information_schema.referential_constraints rc
            JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
            WHERE tc.constraint_name = 'meetings_created_by_fkey'
            AND rc.unique_constraint_name NOT LIKE '%auth_users%'
        ) THEN
            ALTER TABLE meetings DROP CONSTRAINT meetings_created_by_fkey;
            ALTER TABLE meetings ADD CONSTRAINT meetings_created_by_fkey 
            FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
    ELSE
        ALTER TABLE meetings ADD CONSTRAINT meetings_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Check and fix meetings.ended_by constraint
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'meetings_ended_by_fkey' 
        AND table_name = 'meetings'
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.referential_constraints rc
            JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
            WHERE tc.constraint_name = 'meetings_ended_by_fkey'
            AND rc.unique_constraint_name NOT LIKE '%auth_users%'
        ) THEN
            ALTER TABLE meetings DROP CONSTRAINT meetings_ended_by_fkey;
            ALTER TABLE meetings ADD CONSTRAINT meetings_ended_by_fkey 
            FOREIGN KEY (ended_by) REFERENCES auth.users(id) ON DELETE SET NULL;
        END IF;
    ELSE
        ALTER TABLE meetings ADD CONSTRAINT meetings_ended_by_fkey 
        FOREIGN KEY (ended_by) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    -- Check and fix notes.created_by constraint
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'notes_created_by_fkey' 
        AND table_name = 'notes'
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.referential_constraints rc
            JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
            WHERE tc.constraint_name = 'notes_created_by_fkey'
            AND rc.unique_constraint_name NOT LIKE '%auth_users%'
        ) THEN
            ALTER TABLE notes DROP CONSTRAINT notes_created_by_fkey;
            ALTER TABLE notes ADD CONSTRAINT notes_created_by_fkey 
            FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
    ELSE
        ALTER TABLE notes ADD CONSTRAINT notes_created_by_fkey 
        FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Check and fix note_likes.user_id constraint
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'note_likes_user_id_fkey' 
        AND table_name = 'note_likes'
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.referential_constraints rc
            JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
            WHERE tc.constraint_name = 'note_likes_user_id_fkey'
            AND rc.unique_constraint_name NOT LIKE '%auth_users%'
        ) THEN
            ALTER TABLE note_likes DROP CONSTRAINT note_likes_user_id_fkey;
            ALTER TABLE note_likes ADD CONSTRAINT note_likes_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
    ELSE
        ALTER TABLE note_likes ADD CONSTRAINT note_likes_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Check and fix user_profiles.id constraint
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_profiles_id_fkey' 
        AND table_name = 'user_profiles'
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.referential_constraints rc
            JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
            WHERE tc.constraint_name = 'user_profiles_id_fkey'
            AND rc.unique_constraint_name NOT LIKE '%auth_users%'
        ) THEN
            ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_id_fkey;
            ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_id_fkey 
            FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
        END IF;
    ELSE
        ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_id_fkey 
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Refresh RLS policies to ensure they work properly
DROP POLICY IF EXISTS "Users can view meetings they have access to" ON meetings;
CREATE POLICY "Users can view meetings they have access to"
  ON meetings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create meetings" ON meetings;
CREATE POLICY "Users can create meetings"
  ON meetings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can update their own meetings" ON meetings;
CREATE POLICY "Users can update their own meetings"
  ON meetings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Users can delete their own meetings" ON meetings;
CREATE POLICY "Users can delete their own meetings"
  ON meetings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);