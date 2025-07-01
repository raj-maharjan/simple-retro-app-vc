import React, { useState, useEffect, useRef } from 'react';
import { User, Edit3, Check, X, Mail, Camera, Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Avatar } from './Avatar';

interface UserProfile {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface UserProfileProps {
  onClose: () => void;
}

export function UserProfile({ onClose }: UserProfileProps) {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        // If profile doesn't exist, create one
        if (error.code === 'PGRST116') {
          await createProfile();
        } else {
          setError('Failed to load profile');
        }
      } else {
        setProfile(data);
        setDisplayName(data.display_name || '');
        setAvatarUrl(data.avatar_url || '');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .insert([
          {
            id: user.id,
            email: user.email,
            display_name: user.email?.split('@')[0] || 'User',
            avatar_url: user.user_metadata?.avatar_url || null,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Error creating profile:', error);
        setError('Failed to create profile');
      } else {
        setProfile(data);
        setDisplayName(data.display_name || '');
        setAvatarUrl(data.avatar_url || '');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to create profile');
    }
  };

  const handleSave = async () => {
    if (!user || !profile) return;

    setSaving(true);
    setError('');

    try {
      const { data: savedProfile, error } = await supabase
        .from('user_profiles')
        .update({
          display_name: displayName.trim() || null,
          avatar_url: avatarUrl.trim() || null,
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating profile:', error);
        setError('Failed to update profile');
      } else {
        setProfile(savedProfile);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDisplayName(profile?.display_name || '');
    setAvatarUrl(profile?.avatar_url || '');
    setIsEditing(false);
    setError('');
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // Create unique filename with user ID folder structure for RLS
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      console.log('🔄 Starting upload...', { fileName, fileSize: file.size, fileType: file.type });

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      console.log('📤 Upload result:', { data: uploadData, error: uploadError });

      if (uploadError) {
        console.error('❌ Upload error details:', uploadError);
        setError(`Upload failed: ${uploadError.message}`);
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      console.log('🔗 Public URL:', urlData.publicUrl);
      
      // Update local state
      setAvatarUrl(urlData.publicUrl);
      
      // Immediately save to database
      const { data: profileData, error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Error saving avatar to database:', updateError);
        setError('Upload successful, but failed to save. Please try again.');
        return;
      }

      // Update profile state to reflect the change
      if (profileData) {
        setProfile(profileData);
      }
      
      console.log('✅ Upload and database save successful!');
    } catch (err: any) {
      console.error('💥 Unexpected error uploading image:', err);
      setError(`Failed to upload image: ${err.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  // Get the avatar URL to display (from profile, Google OAuth, or user metadata)
  const getAvatarUrl = () => {
    return avatarUrl || profile?.avatar_url || user?.user_metadata?.avatar_url || null;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">User Profile</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Profile Avatar */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <Avatar 
                src={getAvatarUrl()} 
                alt={`${profile?.display_name || user?.email}'s avatar`}
                size="xl"
                userId={user?.id}
              />
              
              {/* Upload button overlay */}
              <button
                onClick={handleAvatarClick}
                disabled={uploading}
                className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
                title="Change profile picture"
              >
                {uploading ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </button>
            </div>
            
            <div className="text-center">
              <button
                onClick={handleAvatarClick}
                disabled={uploading}
                className="text-sm text-purple-600 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <Upload className="w-4 h-4" />
                {uploading ? 'Uploading...' : 'Upload new photo'}
              </button>
              <p className="text-xs text-gray-500 mt-1">JPG, PNG, GIF up to 5MB</p>
            </div>
            
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {/* Email (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={user?.email || ''}
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                disabled
              />
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display Name
            </label>
            {isEditing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your display name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  maxLength={50}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Check className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 border border-gray-300 rounded-lg bg-gray-50">
                <span className="text-gray-900">
                  {profile?.display_name || 'Not set'}
                </span>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                  title="Edit display name"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              This name will be shown to other users in meetings
            </p>
          </div>

          {/* Account Info */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Account</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                <span className="font-medium">Member since:</span>{' '}
                {profile ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}
              </p>
              {profile?.updated_at !== profile?.created_at && profile?.updated_at && (
                <p>
                  <span className="font-medium">Last updated:</span>{' '}
                  {new Date(profile.updated_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          {/* Sign Out */}
          <div className="border-t pt-6">
            <button
              onClick={signOut}
              className="w-full px-4 py-3 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}