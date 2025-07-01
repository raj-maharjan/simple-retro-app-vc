-- Add avatar support to user profiles
-- Migration: 20250630235900_add_user_avatars
-- Date: June 30, 2025

-- Add avatar_url column to user_profiles table
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Create index for avatar_url
CREATE INDEX IF NOT EXISTS user_profiles_avatar_url_idx ON user_profiles(avatar_url);

-- Update the handle_new_user function to sync Google OAuth profile images
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name', 
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing profiles to sync Google OAuth avatars
UPDATE user_profiles 
SET avatar_url = auth_users.raw_user_meta_data->>'avatar_url'
FROM auth.users auth_users
WHERE user_profiles.id = auth_users.id 
  AND auth_users.raw_user_meta_data->>'avatar_url' IS NOT NULL
  AND user_profiles.avatar_url IS NULL; 