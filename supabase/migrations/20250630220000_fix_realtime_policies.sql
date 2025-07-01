-- Fix Real-time Policies for Notes and Likes
-- This enables proper real-time synchronization across all participants

-- Enable RLS on tables if not already enabled
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_likes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view all notes" ON notes;
DROP POLICY IF EXISTS "Users can create notes" ON notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON notes;

DROP POLICY IF EXISTS "Users can view all note_likes" ON note_likes;
DROP POLICY IF EXISTS "Users can create note_likes" ON note_likes;
DROP POLICY IF EXISTS "Users can delete their own note_likes" ON note_likes;

-- Notes policies - Allow all authenticated users to see all notes (for real-time sync)
CREATE POLICY "Users can view all notes"
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

-- Note likes policies - Allow all authenticated users to see all likes (for real-time sync)
CREATE POLICY "Users can view all note_likes"
  ON note_likes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create note_likes"
  ON note_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own note_likes"
  ON note_likes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Enable real-time for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE note_likes;

-- Grant necessary permissions for real-time
GRANT SELECT, INSERT, UPDATE, DELETE ON notes TO authenticated;
GRANT SELECT, INSERT, DELETE ON note_likes TO authenticated; 