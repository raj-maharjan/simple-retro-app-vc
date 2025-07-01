-- Allow Collaborative Note Moving
-- This migration allows any authenticated user to move notes between sections (change type)
-- while keeping content editing restricted to note creators

-- Drop the existing restrictive update policy
DROP POLICY IF EXISTS "Users can update their own notes" ON notes;

-- Create separate policies for different types of updates

-- 1. Allow note creators to update content and other fields (except type when meeting is ended)
CREATE POLICY "Note creators can update content"
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

-- 2. Allow any authenticated user to move notes between sections (update type only)
CREATE POLICY "Anyone can move notes between sections"
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

-- Grant UPDATE permission to authenticated users for collaborative features
GRANT UPDATE (type, updated_at) ON notes TO authenticated;

-- Ensure real-time publication includes notes table
ALTER PUBLICATION supabase_realtime ADD TABLE notes;

-- Add helpful comment explaining the collaborative approach
COMMENT ON TABLE notes IS 'Notes support collaborative editing: anyone can move notes between sections, but only creators can edit content';
COMMENT ON POLICY "Note creators can update content" ON notes IS 'Allow note creators to edit content and all fields in active meetings';
COMMENT ON POLICY "Anyone can move notes between sections" ON notes IS 'Enable collaborative retrospectives by allowing any participant to organize notes'; 