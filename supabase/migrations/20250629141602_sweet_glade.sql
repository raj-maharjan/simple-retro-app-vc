/*
  # Fix Meeting Deletion Issues

  1. Foreign Key Constraints
    - Update foreign key constraints to allow proper deletion
    - Ensure cascading deletes work correctly
  
  2. RLS Policies
    - Update policies to allow meeting creators to delete their meetings
    - Ensure proper access control
*/

-- First, let's check and fix the foreign key constraints

-- Drop existing foreign key constraint for ended_by if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'meetings_ended_by_fkey'
    AND table_name = 'meetings'
  ) THEN
    ALTER TABLE meetings DROP CONSTRAINT meetings_ended_by_fkey;
  END IF;
END $$;

-- Recreate the foreign key constraint with proper cascading
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'meetings_ended_by_fkey'
    AND table_name = 'meetings'
  ) THEN
    ALTER TABLE meetings ADD CONSTRAINT meetings_ended_by_fkey 
    FOREIGN KEY (ended_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Ensure the created_by foreign key constraint allows proper deletion
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'meetings_created_by_fkey'
    AND table_name = 'meetings'
  ) THEN
    ALTER TABLE meetings DROP CONSTRAINT meetings_created_by_fkey;
  END IF;
  
  -- Recreate with proper cascading
  ALTER TABLE meetings ADD CONSTRAINT meetings_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

-- Update RLS policies for meetings to allow creators to delete their meetings
DROP POLICY IF EXISTS "Users can delete their own meetings" ON meetings;
CREATE POLICY "Users can delete their own meetings"
  ON meetings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Ensure the notes foreign key constraint properly cascades when meetings are deleted
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notes_meeting_id_fkey'
    AND table_name = 'notes'
  ) THEN
    ALTER TABLE notes DROP CONSTRAINT notes_meeting_id_fkey;
  END IF;
  
  -- Recreate with CASCADE delete
  ALTER TABLE notes ADD CONSTRAINT notes_meeting_id_fkey 
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE;
END $$;

-- Ensure notes created_by foreign key constraint is properly set
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notes_created_by_fkey'
    AND table_name = 'notes'
  ) THEN
    ALTER TABLE notes DROP CONSTRAINT notes_created_by_fkey;
  END IF;
  
  -- Recreate with CASCADE delete
  ALTER TABLE notes ADD CONSTRAINT notes_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;