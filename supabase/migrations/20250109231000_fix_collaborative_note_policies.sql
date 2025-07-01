-- Fix Collaborative Note Moving Policies
-- Replace conflicting policies with a single permissive policy

-- Drop the conflicting policies
DROP POLICY IF EXISTS "Note creators can update content" ON notes;
DROP POLICY IF EXISTS "Anyone can move notes between sections" ON notes;

-- Create a single policy that allows any authenticated user to update notes in active meetings
-- But we'll handle the content vs type restrictions in the application layer
CREATE POLICY "Users can update notes in active meetings"
  ON notes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = notes.meeting_id 
      AND meetings.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meetings 
      WHERE meetings.id = notes.meeting_id 
      AND meetings.status = 'active'
    )
  );

-- Ensure proper permissions
GRANT UPDATE ON notes TO authenticated;

-- Add comment explaining the approach
COMMENT ON POLICY "Users can update notes in active meetings" ON notes IS 'Allow any participant to move notes and creators to edit content in active meetings'; 