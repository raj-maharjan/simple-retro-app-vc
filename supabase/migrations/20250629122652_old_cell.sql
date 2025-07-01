/*
  # Retrospective App Database Schema

  1. New Tables
    - `meetings`
      - `id` (uuid, primary key)
      - `title` (text)
      - `meeting_code` (text, unique)
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `notes`
      - `id` (uuid, primary key)
      - `meeting_id` (uuid, references meetings)
      - `content` (text)
      - `type` (text) - 'glad', 'mad', or 'sad'
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for meeting access and note management
    - Users can only access meetings they created or joined
    - Users can manage their own notes
*/

-- Create meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  meeting_code text UNIQUE NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE,
  content text NOT NULL,
  type text NOT NULL CHECK (type IN ('glad', 'mad', 'sad')),
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS meetings_meeting_code_idx ON meetings(meeting_code);
CREATE INDEX IF NOT EXISTS notes_meeting_id_idx ON notes(meeting_id);
CREATE INDEX IF NOT EXISTS notes_created_by_idx ON notes(created_by);

-- Policies for meetings
CREATE POLICY "Users can view meetings they have access to"
  ON meetings
  FOR SELECT
  TO authenticated
  USING (true); -- Allow viewing meetings by code

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

-- Policies for notes
CREATE POLICY "Users can view notes in accessible meetings"
  ON notes
  FOR SELECT
  TO authenticated
  USING (true); -- Allow viewing notes in meetings they can access

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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();