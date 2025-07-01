import React, { useState, useRef, useEffect } from 'react';
import { User, ChevronDown, Edit3, LogOut, Home } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Logo } from './Logo';
import { Avatar } from './Avatar';

interface TopNavBarProps {
  currentPage?: 'dashboard' | 'meeting';
  onNavigateToDashboard?: () => void;
  onEditProfile?: () => void;
  pageTitle?: string;
}

interface UserProfile {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export function TopNavBar({ 
  currentPage = 'dashboard',
  onNavigateToDashboard,
  onEditProfile,
  pageTitle
}: TopNavBarProps) {
  const { user, signOut } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch user profile data and set up real-time subscription
  useEffect(() => {
    if (user) {
      fetchUserProfile();

      // Set up real-time subscription for profile updates
      const profileSubscription = supabase
        .channel('user_profile_changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_profiles',
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            console.log('👤 User profile updated:', payload);
            setUserProfile(payload.new as UserProfile);
          }
        )
        .subscribe();

      return () => {
        profileSubscription.unsubscribe();
      };
    }
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user profile:', error);
      } else if (data) {
        setUserProfile(data);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  const getDisplayName = () => {
    // Prioritize profile display name, then user metadata, then email
    if (userProfile?.display_name) {
      return userProfile.display_name;
    }
    if (user?.user_metadata?.display_name) {
      return user.user_metadata.display_name;
    }
    return user?.email?.split('@')[0] || 'User';
  };

  const getAvatarUrl = () => {
    // Prioritize custom uploaded avatar, then Google OAuth avatar
    return userProfile?.avatar_url || user?.user_metadata?.avatar_url || null;
  };

  const handleEditProfile = () => {
    setShowUserDropdown(false);
    if (onEditProfile) {
      onEditProfile();
    }
  };

  const handleNavigateToDashboard = () => {
    setShowUserDropdown(false);
    if (onNavigateToDashboard) {
      onNavigateToDashboard();
    }
  };

  const handleSignOut = async () => {
    setShowUserDropdown(false);
    await signOut();
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 md:px-6">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Left Section - Logo */}
        <div className="flex items-center">
          <Logo size="sm" />
        </div>

        {/* Center Section - Navigation & Page Title */}
        <div className="flex items-center gap-6">
          {currentPage === 'meeting' && onNavigateToDashboard && (
            <button
              onClick={handleNavigateToDashboard}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
          )}
          
          {pageTitle && (
            <div className="text-lg font-medium text-gray-800 hidden md:block">
              {pageTitle}
            </div>
          )}
        </div>

        {/* Right Section - User Menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-3 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg transition-all"
          >
            <Avatar
              src={getAvatarUrl()}
              alt={`${getDisplayName()}'s avatar`}
              size="sm"
              userId={user?.id}
            />
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-gray-900">{getDisplayName()}</p>
              <p className="text-xs text-gray-600">{user?.email}</p>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown Menu */}
          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
              {/* Mobile user info - only show on small screens */}
              <div className="sm:hidden px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{getDisplayName()}</p>
                <p className="text-xs text-gray-600">{user?.email}</p>
              </div>
              
              {/* Profile & Settings */}
              {onEditProfile && (
                <button
                  onClick={handleEditProfile}
                  className="w-full flex items-center gap-3 px-4 py-2 text-left text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit Profile
                </button>
              )}
              
              {/* Sign Out */}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-2 text-left text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
} 