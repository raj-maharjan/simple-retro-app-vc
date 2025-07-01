/*
  # Add Note Likes Functionality

  1. New Tables
    - `note_likes`
      - `id` (uuid, primary key)
      - `note_id` (uuid, references notes)
      - `user_id` (uuid, references auth.users)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on note_likes table
    - Add policies for like management
    - Users can like/unlike notes in active meetings

  3. Indexes
    - Composite index on note_id and user_id for performance
    - Index on note_id for counting likes
*/

-- Create note_likes table
CREATE TABLE IF NOT EXISTS note_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(note_id, user_id)
);

-- Enable RLS
ALTER TABLE note_likes ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS note_likes_note_id_idx ON note_likes(note_id);
CREATE INDEX IF NOT EXISTS note_likes_user_id_idx ON note_likes(user_id);
CREATE INDEX IF NOT EXISTS note_likes_note_user_idx ON note_likes(note_id, user_id);

-- Policies for note_likes
CREATE POLICY "Users can view all note likes"
  ON note_likes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can like notes in active meetings"
  ON note_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM notes 
      JOIN meetings ON notes.meeting_id = meetings.id
      WHERE notes.id = note_likes.note_id 
      AND meetings.status = 'active'
    )
  );

CREATE POLICY "Users can unlike their own likes"
  ON note_likes
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM notes 
      JOIN meetings ON notes.meeting_id = meetings.id
      WHERE notes.id = note_likes.note_id 
      AND meetings.status = 'active'
    )
  );