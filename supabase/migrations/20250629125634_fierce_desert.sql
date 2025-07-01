/*
  # Add Actions type to retrospective board

  1. Changes
    - Update the notes table type constraint to include 'action'
    - This allows users to add action items alongside glad/mad/sad notes

  2. Security
    - No changes to RLS policies needed as they already handle all note types
*/

-- Update the check constraint to include 'action' type
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_type_check;
ALTER TABLE notes ADD CONSTRAINT notes_type_check CHECK (type = ANY (ARRAY['glad'::text, 'mad'::text, 'sad'::text, 'action'::text]));