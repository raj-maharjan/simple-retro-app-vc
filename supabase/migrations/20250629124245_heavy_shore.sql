/*
  # Fix authentication references

  1. Changes
    - Update foreign key references to use auth.users instead of users table
    - Fix RLS policies to use proper auth functions
    - Ensure proper permissions for authenticated users

  2. Security
    - Maintain RLS on both tables
    - Fix policies to work with Supabase auth
*/

-- Drop existing foreign key constraints
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_created_by_fkey;
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_created_by_fkey;

-- Add correct foreign key constraints referencing auth.users
ALTER TABLE meetings 
ADD CONSTRAINT meetings_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE notes 
ADD CONSTRAINT notes_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update RLS policies to use proper auth functions
DROP POLICY IF EXISTS "Users can create meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update their own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can view meetings they have access to" ON meetings;

DROP POLICY IF EXISTS "Users can create notes" ON notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON notes;
DROP POLICY IF EXISTS "Users can view notes in accessible meetings" ON notes;

-- Recreate policies with proper auth functions
CREATE POLICY "Users can view meetings they have access to"
  ON meetings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create meetings"
  ON meetings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own meetings"
  ON meetings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Users can view notes in accessible meetings"
  ON notes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create notes"
  ON notes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own notes"
  ON notes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own notes"
  ON notes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);