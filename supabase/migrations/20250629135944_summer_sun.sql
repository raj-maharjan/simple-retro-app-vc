/*
  # Add Meeting Status and End Functionality

  1. New Columns
    - `status` (text) - Meeting status: 'active' or 'ended'
    - `ended_at` (timestamptz) - When the meeting was ended
    - `ended_by` (uuid) - Who ended the meeting (references auth.users)

  2. Security Updates
    - Update RLS policies to only allow note modifications in active meetings
    - Add index for status queries

  3. Data Migration
    - Set all existing meetings to 'active' status
*/

-- Add status column to meetings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings' AND column_name = 'status'
  ) THEN
    ALTER TABLE meetings ADD COLUMN status text DEFAULT 'active' CHECK (status IN ('active', 'ended'));
  END IF;
END $$;

-- Add ended_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings' AND column_name = 'ended_at'
  ) THEN
    ALTER TABLE meetings ADD COLUMN ended_at timestamptz;
  END IF;
END $$;

-- Add ended_by column (references auth.users, not users table)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meetings' AND column_name = 'ended_by'
  ) THEN
    ALTER TABLE meetings ADD COLUMN ended_by uuid;
  END IF;
END $$;

-- Add foreign key constraint for ended_by (references auth.users)
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

-- Update existing meetings to have 'active' status
UPDATE meetings SET status = 'active' WHERE status IS NULL;

-- Create index for status queries
CREATE INDEX IF NOT EXISTS meetings_status_idx ON meetings(status);

-- Update RLS policies for notes to only allow modifications in active meetings
DROP POLICY IF EXISTS "Users can create notes" ON notes;
CREATE POLICY "Users can create notes"
  ON notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = notes.meeting_id 
      AND meetings.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can update their own notes" ON notes;
CREATE POLICY "Users can update their own notes"
  ON notes
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = notes.meeting_id 
      AND meetings.status = 'active'
    )
  )
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = notes.meeting_id 
      AND meetings.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users can delete their own notes" ON notes;
CREATE POLICY "Users can delete their own notes"
  ON notes
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = notes.meeting_id 
      AND meetings.status = 'active'
    )
  );