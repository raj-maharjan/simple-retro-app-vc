import React, { useState, useEffect } from 'react';
import { X, Mail, UserPlus, Search, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingCode?: string;
  meetingTitle?: string;
  onInvitesSent?: (count: number) => void;
}

interface UserProfile {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export function InviteModal({ 
  isOpen, 
  onClose, 
  meetingCode, 
  meetingTitle = 'Retrospective Meeting',
  onInvitesSent 
}: InviteModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'emails' | 'users'>('emails');
  const [emailInput, setEmailInput] = useState('');
  const [emailList, setEmailList] = useState<string[]>([]);
  const [existingUsers, setExistingUsers] = useState<UserProfile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchExistingUsers();
    }
  }, [isOpen]);

  const fetchExistingUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, display_name, email, avatar_url')
        .not('id', 'eq', user?.id) // Exclude current user
        .not('email', 'is', null)
        .order('display_name');

      if (error) {
        console.error('Error fetching users:', error);
        setError('Failed to load existing users');
      } else {
        setExistingUsers(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load existing users');
    } finally {
      setLoading(false);
    }
  };

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (email && !emailList.includes(email) && isValidEmail(email)) {
      setEmailList([...emailList, email]);
      setEmailInput('');
    }
  };

  const removeEmail = (email: string) => {
    setEmailList(emailList.filter(e => e !== email));
  };

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const filteredUsers = existingUsers.filter(user => {
    const query = searchQuery.toLowerCase();
    return (
      user.display_name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    );
  });

  const handleSendInvites = async () => {
    setSending(true);
    setError('');

    try {
      // Collect all emails to invite
      const emailsToInvite: string[] = [...emailList];
      
      // Add emails from selected users
      selectedUsers.forEach(userId => {
        const userProfile = existingUsers.find(u => u.id === userId);
        if (userProfile?.email && !emailsToInvite.includes(userProfile.email)) {
          emailsToInvite.push(userProfile.email);
        }
      });

      if (emailsToInvite.length === 0) {
        setError('Please add at least one email address or select users to invite');
        return;
      }

      console.log('📧 Sending invitations to:', emailsToInvite);
      console.log('Meeting details:', { meetingCode, meetingTitle });

      // Get current user info for the invitation
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in to send invitations');
      }

      // Get current user's profile for display name
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('display_name, email')
        .eq('user_id', user.id)
        .single();

      const inviterName = profile?.display_name || user.email || 'A colleague';
      const inviterEmail = profile?.email || user.email || '';

      // Prepare meeting URL
      const meetingUrl = meetingCode 
        ? `${window.location.origin}/meeting/${meetingCode}`
        : window.location.origin;

      // Prepare payload for the edge function
      const payload = {
        meeting_title: meetingTitle || 'Retrospective Meeting',
        meeting_code: meetingCode,
        meeting_url: meetingUrl,
        inviter_name: inviterName,
        inviter_email: inviterEmail,
        invitee_emails: emailsToInvite,
        invitation_message: 'Come join our retrospective meeting! We\'ll be sharing insights and planning improvements together.'
      };

      // Call the edge function to send emails
      const { data, error } = await supabase.functions.invoke('send-meeting-invitations', {
        body: payload
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to send invitations');
      }

      if (!data?.success) {
        throw new Error(data?.message || 'Failed to send invitations');
      }

      // Show success message with details
      const { sent_count, total_count, failed_count } = data;
      let message = `✅ Successfully sent ${sent_count} invitation${sent_count !== 1 ? 's' : ''}!`;
      
      if (failed_count > 0) {
        message += `\n⚠️ ${failed_count} email${failed_count !== 1 ? 's' : ''} failed to send.`;
      }
      
      alert(message);
      
      // Callback to parent component
      if (onInvitesSent) {
        onInvitesSent(sent_count);
      }
      
      // Reset form and close modal
      handleClose();

    } catch (err) {
      console.error('Error sending invitations:', err);
      setError('Failed to send invitations. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setActiveTab('emails');
    setEmailInput('');
    setEmailList([]);
    setSelectedUsers(new Set());
    setSearchQuery('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  const totalInvites = emailList.length + selectedUsers.size;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 rounded-full p-2">
              <UserPlus className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Invite to Meeting</h3>
              <p className="text-sm text-gray-600">
                {meetingCode ? `Invite others to join "${meetingTitle}"` : 'Invite users to join retrospective meetings'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={sending}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('emails')}
            className={`flex-1 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'emails'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Mail className="w-4 h-4 inline mr-2" />
            Add Email Addresses
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserPlus className="w-4 h-4 inline mr-2" />
            Select Existing Users
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {activeTab === 'emails' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Addresses
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addEmail();
                      }
                    }}
                    placeholder="Enter email address"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={sending}
                  />
                  <button
                    onClick={addEmail}
                    disabled={!emailInput.trim() || !isValidEmail(emailInput.trim()) || sending}
                    className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Press Enter or click Add to include the email
                </p>
              </div>

              {/* Email List */}
              {emailList.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email List ({emailList.length})
                  </label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {emailList.map((email, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <span className="text-sm text-gray-800">{email}</span>
                        <button
                          onClick={() => removeEmail(email)}
                          disabled={sending}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Users
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or email"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={sending}
                  />
                </div>
              </div>

              {/* User List */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Users ({selectedUsers.size} selected)
                </label>
                
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <UserPlus className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>No users found</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {filteredUsers.map((userProfile) => (
                      <label
                        key={userProfile.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-blue-50 rounded-lg cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(userProfile.id)}
                          onChange={() => toggleUserSelection(userProfile.id)}
                          disabled={sending}
                          className="w-4 h-4 text-blue-600 border-blue-300 rounded focus:ring-blue-500 focus:ring-2"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {userProfile.display_name || 'No Name'}
                          </p>
                          <p className="text-xs text-gray-600 truncate">
                            {userProfile.email}
                          </p>
                        </div>
                        {selectedUsers.has(userProfile.id) && (
                          <Check className="w-4 h-4 text-blue-600" />
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            {totalInvites > 0 ? (
              <span>Ready to send {totalInvites} invitation{totalInvites > 1 ? 's' : ''}</span>
            ) : (
              <span>No recipients selected</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={sending}
              className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSendInvites}
              disabled={totalInvites === 0 || sending}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Sending...
                </div>
              ) : (
                `Send Invitation${totalInvites > 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 