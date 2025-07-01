import React, { useState, useEffect, useRef } from 'react';
import { Plus, Calendar, Users, ExternalLink, Copy, CheckCircle, Trash2, StopCircle, User, UserPlus, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { sendMeetingSummaryEmails, prepareMeetingEmailData } from '../lib/emailService';
import { Logo } from './Logo';
import { UserProfile } from './UserProfile';
import { ConfirmationModal } from './ConfirmationModal';
import { InviteModal } from './InviteModal';

interface Meeting {
  id: string;
  title: string;
  meeting_code: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'ended';
  ended_at: string | null;
  ended_by: string | null;
  user_role?: 'host' | 'contributor';
  contributors?: UserProfileData[];
  contributorCount?: number;
}

interface UserProfileData {
  id: string;
  display_name: string | null;
  email: string | null;
}

interface DashboardProps {
  onJoinMeeting: (meetingCode: string) => void;
}

export function Dashboard({ onJoinMeeting }: DashboardProps) {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');
  const [endingMeeting, setEndingMeeting] = useState<string | null>(null);
  const [deletingMeeting, setDeletingMeeting] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<{ id: string; title: string } | null>(null);
  const [meetingToEnd, setMeetingToEnd] = useState<{ id: string; title: string } | null>(null);
  const [showContributors, setShowContributors] = useState<{ [meetingId: string]: boolean }>({});
  const [meetingProfiles, setMeetingProfiles] = useState<{ [meetingId: string]: UserProfileData[] }>({});
  const [inviteMeetingCode, setInviteMeetingCode] = useState<string | null>(null);
  const [inviteMeetingTitle, setInviteMeetingTitle] = useState<string | null>(null);
  
  const contributorsRefs = useRef<{ [meetingId: string]: HTMLDivElement | null }>({});
  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchMeetings();
      
      // Set up real-time subscription for meetings changes
      console.log('🔄 Setting up real-time subscription for user:', user.id);
      
      const meetingsSubscription = supabase
        .channel(`user_meetings:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'meetings'
            // Remove the filter to listen to all meetings, we'll filter in the callback
          },
          (payload) => {
            console.log('Meeting updated in real-time:', payload);
            const updatedMeeting = payload.new as Meeting;
            
            // Check if this meeting is in our current list (either hosted or contributed)
            setMeetings(prev => {
              const existingMeetingIndex = prev.findIndex(meeting => meeting.id === updatedMeeting.id);
              if (existingMeetingIndex >= 0) {
                // Update the existing meeting while preserving the user_role
                const updatedMeetings = [...prev];
                updatedMeetings[existingMeetingIndex] = {
                  ...updatedMeeting,
                  user_role: updatedMeetings[existingMeetingIndex].user_role
                };
                return updatedMeetings;
              }
              return prev;
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'meetings'
            // Listen to all new meetings, we'll check if user created it
          },
          (payload) => {
            console.log('Meeting created in real-time:', payload);
            const newMeeting = payload.new as Meeting;
            
            // Only add if the user created this meeting
            if (newMeeting.created_by === user.id) {
              setMeetings(prev => [{ ...newMeeting, user_role: 'host' as const }, ...prev]);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'meetings'
            // Removed filter for DELETE events as they sometimes don't work with filters
          },
          (payload) => {
            console.log('🗑️ Meeting deleted in real-time:', payload);
            console.log('Delete payload old:', payload.old);
            
            // Handle case where payload.old might be null or undefined  
            const deletedMeetingId = payload.old?.id;
            
            if (deletedMeetingId) {
              console.log('Removing meeting from UI:', deletedMeetingId);
              // Remove the deleted meeting from the list if it exists
              setMeetings(prev => {
                const newMeetings = prev.filter(meeting => meeting.id !== deletedMeetingId);
                if (newMeetings.length !== prev.length) {
                  console.log('Updated meetings list:', newMeetings.length, 'meetings');
                }
                return newMeetings;
              });
            } else {
              console.error('No meeting ID found in delete payload');
            }
          }
        )
        .subscribe(
          (status) => {
            console.log('📡 Real-time subscription status:', status);
          }
        );
      
      // Set up interval to check for expired meetings every minute
      const interval = setInterval(checkExpiredMeetings, 60000);
      
      return () => {
        clearInterval(interval);
        supabase.removeChannel(meetingsSubscription);
      };
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      setProfile(data);
    }
  };

  const fetchMeetingContributors = async (meetingId: string) => {
    try {
      // Get unique user IDs who have added notes to this meeting
      const { data: noteCreators, error: notesError } = await supabase
        .from('notes')
        .select('created_by')
        .eq('meeting_id', meetingId);

      if (notesError) {
        console.error('Error fetching note creators:', notesError);
        return [];
      }

      // Get unique user IDs
      const uniqueUserIds = [...new Set(noteCreators?.map(note => note.created_by) || [])];
      
      if (uniqueUserIds.length === 0) {
        return [];
      }

      // Fetch user profiles for contributors
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, display_name, email')
        .in('id', uniqueUserIds);

      if (profilesError) {
        console.error('Error fetching contributor profiles:', profilesError);
        return [];
      }

      return profiles || [];
    } catch (error) {
      console.error('Error fetching meeting contributors:', error);
      return [];
    }
  };

  const fetchMeetings = async () => {
    if (!user) return;

    console.log('Fetching meetings for user:', user.id);
    
    try {
      // First, get meetings where user is the host
      const { data: hostedMeetings, error: hostedError } = await supabase
        .from('meetings')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (hostedError) {
        console.error('Error fetching hosted meetings:', hostedError);
        return;
      }

      // Then, get meetings where user has contributed (has notes)
      const { data: contributedMeetingIds, error: contributedError } = await supabase
        .from('notes')
        .select('meeting_id')
        .eq('created_by', user.id);

      if (contributedError) {
        console.error('Error fetching contributed meetings:', contributedError);
        setMeetings((hostedMeetings || []).map(meeting => ({ ...meeting, user_role: 'host' as const })));
        return;
      }

      // Get unique meeting IDs where user contributed
      const contributedIds = [...new Set(contributedMeetingIds?.map(note => note.meeting_id) || [])];
      
      // Filter out meetings where user is already the host
      const nonHostedContributedIds = contributedIds.filter(id => 
        !hostedMeetings?.some(meeting => meeting.id === id)
      );

      let contributedMeetings: Meeting[] = [];
      if (nonHostedContributedIds.length > 0) {
        const { data: fetchedContributedMeetings, error: fetchError } = await supabase
          .from('meetings')
          .select('*')
          .in('id', nonHostedContributedIds)
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('Error fetching contributed meetings details:', fetchError);
        } else {
          contributedMeetings = fetchedContributedMeetings || [];
        }
      }

      // Combine and mark roles
      const allMeetings = [
        ...(hostedMeetings || []).map(meeting => ({ ...meeting, user_role: 'host' as const })),
        ...contributedMeetings.map(meeting => ({ ...meeting, user_role: 'contributor' as const }))
      ];

      // Sort by created_at descending
      allMeetings.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Fetch contributor counts for all meetings
      const meetingsWithContributorCounts = await Promise.all(
        allMeetings.map(async (meeting) => {
          try {
            const { data: noteCreators, error } = await supabase
              .from('notes')
              .select('created_by')
              .eq('meeting_id', meeting.id);

            if (error) {
              console.error('Error fetching contributor count for meeting:', meeting.id, error);
              return { ...meeting, contributorCount: 0 };
            }

            const uniqueContributors = [...new Set(noteCreators?.map(note => note.created_by) || [])];
            return { ...meeting, contributorCount: uniqueContributors.length };
          } catch (error) {
            console.error('Error processing contributor count for meeting:', meeting.id, error);
            return { ...meeting, contributorCount: 0 };
          }
        })
      );

      console.log('Fetched all meetings with contributor counts:', meetingsWithContributorCounts);
      setMeetings(meetingsWithContributorCounts);
    } catch (error) {
      console.error('Error in fetchMeetings:', error);
      setMeetings([]);
    }
  };

  const checkExpiredMeetings = async () => {
    if (!user) return;

    try {
      // Get active meetings older than 2 hours
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      
      const { data: expiredMeetings, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('created_by', user.id)
        .eq('status', 'active')
        .lt('created_at', twoHoursAgo);

      if (error) {
        console.error('Error checking expired meetings:', error);
        return;
      }

      if (expiredMeetings && expiredMeetings.length > 0) {
        console.log('Auto-ending expired meetings:', expiredMeetings.map(m => m.title));
        
        // Auto-end expired meetings and send summary emails
        for (const meeting of expiredMeetings) {
          const { data: updatedMeeting } = await supabase
            .from('meetings')
            .update({
              status: 'ended',
              ended_at: new Date().toISOString(),
              ended_by: null, // null indicates auto-ended
            })
            .eq('id', meeting.id)
            .select()
            .single();

          if (updatedMeeting) {
            // Send meeting summary emails for auto-expired meeting
            console.log(`📧 Auto-expired meeting ${meeting.meeting_code}, sending summary emails...`);
            try {
              // Fetch meeting notes and participants
              const { data: notesData } = await supabase
                .from('notes')
                .select('*')
                .eq('meeting_id', meeting.id);

              if (notesData && notesData.length > 0) {
                // Get notes with like counts
                const notesWithLikes = await Promise.all(
                  notesData.map(async (note) => {
                    const { count: likeCount } = await supabase
                      .from('note_likes')
                      .select('*', { count: 'exact', head: true })
                      .eq('note_id', note.id);

                    return {
                      ...note,
                      like_count: likeCount || 0,
                    };
                  })
                );

                // Fetch user profiles for participants
                const participantIds = [...new Set(notesData.map(note => note.created_by))];
                const { data: profilesData } = await supabase
                  .from('user_profiles')
                  .select('*')
                  .in('id', participantIds);

                const userProfiles: Record<string, any> = {};
                profilesData?.forEach(profile => {
                  userProfiles[profile.id] = profile;
                });

                // Add host profile if not already included
                if (!userProfiles[updatedMeeting.created_by]) {
                  const { data: hostProfile } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('id', updatedMeeting.created_by)
                    .single();
                  
                  if (hostProfile) {
                    userProfiles[updatedMeeting.created_by] = hostProfile;
                  }
                }

                const emailData = await prepareMeetingEmailData(updatedMeeting, notesWithLikes, userProfiles, null);
                const emailResult = await sendMeetingSummaryEmails(emailData);
                
                if (emailResult.success) {
                  console.log(`✅ Auto-expiration emails sent to ${emailResult.emailsSent}/${emailResult.totalParticipants} participants for meeting ${meeting.meeting_code}`);
                } else {
                  console.error(`❌ Failed to send auto-expiration emails for meeting ${meeting.meeting_code}:`, emailResult.error);
                }
              }
            } catch (emailError) {
              console.error(`💥 Error sending auto-expiration emails for meeting ${meeting.meeting_code}:`, emailError);
            }
          }
        }
        
        // Note: No need to call fetchMeetings() here since real-time subscription will update the UI
      }
    } catch (err) {
      console.error('Error in checkExpiredMeetings:', err);
    }
  };

  const generateMeetingCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const createMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const meetingCode = generateMeetingCode();
    
    const { data, error } = await supabase
      .from('meetings')
      .insert([
        {
          title: newMeetingTitle,
          meeting_code: meetingCode,
          created_by: user?.id,
          status: 'active',
        },
      ])
      .select()
      .single();

    if (!error && data) {
      // Real-time subscription will handle updating the meetings list
      setNewMeetingTitle('');
      setShowCreateForm(false);
      onJoinMeeting(meetingCode);
    } else {
      console.error('Error creating meeting:', error);
      alert('Failed to create meeting. Please try again.');
    }

    setLoading(false);
  };

  const handleJoinMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim()) {
      onJoinMeeting(joinCode.trim().toUpperCase());
    }
  };

  const copyMeetingLink = (meetingCode: string) => {
    const link = `${window.location.origin}?meeting=${meetingCode}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(meetingCode);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  const handleEndMeetingClick = (meetingId: string, meetingTitle: string) => {
    setMeetingToEnd({ id: meetingId, title: meetingTitle });
    setShowEndModal(true);
  };

  const handleEndMeetingConfirm = async (sendEmail: boolean = true) => {
    if (!meetingToEnd || !user) return;

    setEndingMeeting(meetingToEnd.id);

    try {
      const { data, error } = await supabase
        .from('meetings')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          ended_by: user.id,
        })
        .eq('id', meetingToEnd.id)
        .eq('created_by', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error ending meeting:', error);
        alert('Failed to end meeting. Please try again.');
      } else {
        // Real-time subscription will handle updating the meetings list
        setShowEndModal(false);
        setMeetingToEnd(null);

        // Conditionally send meeting summary emails based on checkbox
        if (sendEmail) {
          console.log('📧 Meeting ended from dashboard, preparing to send summary emails...');
          try {
            // Fetch meeting notes and participants
            const { data: notesData, error: notesError } = await supabase
              .from('notes')
              .select('*')
              .eq('meeting_id', meetingToEnd.id);

            if (notesError) {
              console.error('Error fetching notes for email:', notesError);
              throw new Error('Failed to fetch meeting notes');
            }

            // Get notes with like counts
            const notesWithLikes = await Promise.all(
              (notesData || []).map(async (note) => {
                const { count: likeCount } = await supabase
                  .from('note_likes')
                  .select('*', { count: 'exact', head: true })
                  .eq('note_id', note.id);

                return {
                  ...note,
                  like_count: likeCount || 0,
                };
              })
            );

            // Fetch user profiles for participants
            const participantIds = [...new Set((notesData || []).map(note => note.created_by))];
            const { data: profilesData } = await supabase
              .from('user_profiles')
              .select('*')
              .in('id', participantIds);

            const userProfiles: Record<string, any> = {};
            profilesData?.forEach(profile => {
              userProfiles[profile.id] = profile;
            });

            // Add host profile if not already included
            if (!userProfiles[data.created_by]) {
              const { data: hostProfile } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', data.created_by)
                .single();
              
              if (hostProfile) {
                userProfiles[data.created_by] = hostProfile;
              }
            }

            const emailData = await prepareMeetingEmailData(data, notesWithLikes, userProfiles, user.email || user.id);
            const emailResult = await sendMeetingSummaryEmails(emailData);
            
            if (emailResult.success) {
              console.log(`✅ Meeting summary emails sent to ${emailResult.emailsSent}/${emailResult.totalParticipants} participants`);
              
              // Show success notification to user
              if (emailResult.emailsSent && emailResult.emailsSent > 0) {
                alert(`✅ Meeting ended successfully! Summary emails sent to ${emailResult.emailsSent} participant${emailResult.emailsSent > 1 ? 's' : ''}.`);
              } else {
                alert('✅ Meeting ended successfully!');
              }
            } else {
              console.error('❌ Failed to send meeting summary emails:', emailResult.error);
              alert('⚠️ Meeting ended successfully, but failed to send summary emails.');
            }
          } catch (emailError) {
            console.error('💥 Error sending meeting summary emails:', emailError);
            alert('⚠️ Meeting ended successfully, but failed to send summary emails.');
          }
        } else {
          console.log('📧 Email sending skipped by user choice');
          alert('✅ Meeting ended successfully! No email notifications were sent.');
        }
      }
    } catch (err) {
      console.error('Error ending meeting:', err);
      alert('Failed to end meeting. Please try again.');
    } finally {
      setEndingMeeting(null);
    }
  };

  const handleEndModalClose = () => {
    setShowEndModal(false);
    setMeetingToEnd(null);
  };

  const handleDeleteMeetingClick = (meetingId: string, meetingTitle: string) => {
    setMeetingToDelete({ id: meetingId, title: meetingTitle });
    setShowDeleteModal(true);
  };

  const handleDeleteMeetingConfirm = async () => {
    if (!meetingToDelete || !user) return;

    setDeletingMeeting(meetingToDelete.id);

    try {
      console.log('Attempting to delete meeting:', meetingToDelete.id, 'for user:', user.id);
      
      // First, let's try to delete all notes associated with this meeting
      const { error: notesError } = await supabase
        .from('notes')
        .delete()
        .eq('meeting_id', meetingToDelete.id);

      if (notesError) {
        console.error('Error deleting notes:', notesError);
        // Continue anyway, as the meeting deletion might cascade
      }

      // Now delete the meeting
      console.log('🗑️ Attempting to delete meeting from database:', meetingToDelete.id);
      const { data: deletedData, error: meetingError } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingToDelete.id)
        .eq('created_by', user.id)
        .select(); // Add select to get the deleted data

      if (meetingError) {
        console.error('Error deleting meeting:', meetingError);
        alert(`Failed to delete meeting: ${meetingError.message}`);
      } else {
        console.log('✅ Meeting deleted successfully from database:', deletedData);
        console.log('Waiting for real-time subscription to update UI...');
        
        // Add a timeout fallback in case real-time doesn't work
        const fallbackTimeout = setTimeout(() => {
          console.log('⚠️ Real-time update not received, forcing UI update');
          setMeetings(prev => prev.filter(meeting => meeting.id !== meetingToDelete.id));
        }, 3000);
        
        // Clear timeout if real-time update comes through
        const tempMeetingId = meetingToDelete.id;
        const checkForUpdate = setInterval(() => {
          setMeetings(current => {
            const stillExists = current.some(meeting => meeting.id === tempMeetingId);
            if (!stillExists) {
              // Meeting was removed by real-time, clear the timeout
              clearTimeout(fallbackTimeout);
              clearInterval(checkForUpdate);
            }
            return current;
          });
        }, 100);
        
        setShowDeleteModal(false);
        setMeetingToDelete(null);
      }
    } catch (err) {
      console.error('Error deleting meeting:', err);
      alert('Failed to delete meeting. Please try again.');
    } finally {
      setDeletingMeeting(null);
    }
  };

  const handleDeleteModalClose = () => {
    setShowDeleteModal(false);
    setMeetingToDelete(null);
  };

  const handleEditProfile = () => {
    setShowProfile(true);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const getDisplayName = () => {
    return profile?.display_name || user?.email?.split('@')[0] || 'User';
  };

  const getDeleteModalMessage = () => {
    if (!meetingToDelete) return '';
    
    return `⚠️ PERMANENT DELETION WARNING ⚠️

You are about to permanently delete:
"${meetingToDelete.title}"

This action will:
• Delete the meeting permanently
• Delete ALL notes and data associated with this meeting
• Remove access for all participants
• Cannot be undone or recovered

Are you absolutely sure you want to proceed?`;
  };

  const getEndModalMessage = () => {
    if (!meetingToEnd) return '';
    
    return `🛑 END MEETING CONFIRMATION

You are about to end the meeting:
"${meetingToEnd.title}"

This action will:
• Stop the active retrospective session
• Prevent participants from adding or editing notes
• Preserve all existing notes and data for viewing/export
• Allow you to restart the meeting later if needed

The meeting data will remain accessible but no further changes can be made.

Are you sure you want to end this meeting?`;
  };

  const getMeetingTimeInfo = (meeting: Meeting) => {
    const createdAt = new Date(meeting.created_at);
    const now = new Date();
    const twoHoursFromCreation = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000);
    
      if (meeting.status === 'active' && now < twoHoursFromCreation) {
        const timeLeft = twoHoursFromCreation.getTime() - now.getTime();
        const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        
        let timeLeftText = '';
        if (hoursLeft > 0) {
          timeLeftText = `${hoursLeft}h ${minutesLeft}m left`;
        } else {
          timeLeftText = `${minutesLeft}m left`;
        }
        
        return {
          timeLeftText,
          isExpiringSoon: timeLeft < 30 * 60 * 1000 // Less than 30 minutes
        };
    }
    
    return null;
  };

  const getMeetingDuration = (meeting: Meeting) => {
    if (meeting.status === 'ended' && meeting.ended_at) {
      const createdAt = new Date(meeting.created_at);
      const endedAt = new Date(meeting.ended_at);
      const duration = endedAt.getTime() - createdAt.getTime();
      
      const hours = Math.floor(duration / (1000 * 60 * 60));
      const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours > 0) {
        return `${hours}h ${minutes}m duration`;
      } else {
        return `${minutes}m duration`;
      }
    }
    return null;
  };

  const toggleContributors = async (meetingId: string) => {
    // If we're opening the dropdown and don't have contributors data, fetch it
    if (!showContributors[meetingId] && !meetingProfiles[meetingId]) {
      const contributors = await fetchMeetingContributors(meetingId);
      setMeetingProfiles(prev => ({
        ...prev,
        [meetingId]: contributors
      }));
    }

    setShowContributors(prev => ({
      ...prev,
      [meetingId]: !prev[meetingId]
    }));
  };

  const handleInviteClick = (meetingCode: string, meetingTitle: string) => {
    setInviteMeetingCode(meetingCode);
    setInviteMeetingTitle(meetingTitle);
    setShowInviteModal(true);
  };

  const handleInviteModalClose = () => {
    setShowInviteModal(false);
    setInviteMeetingCode(null);
    setInviteMeetingTitle(null);
  };

  const getUserDisplayName = (userId: string, profiles: UserProfileData[]) => {
    const profile = profiles.find(p => p.id === userId);
    return profile?.display_name || profile?.email || 'Unknown User';
  };

  // Click outside handler for contributors dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside any contributors dropdown
      Object.keys(showContributors).forEach(meetingId => {
        if (showContributors[meetingId] && contributorsRefs.current[meetingId]) {
          if (!contributorsRefs.current[meetingId]?.contains(event.target as Node)) {
            setShowContributors(prev => ({
              ...prev,
              [meetingId]: false
            }));
          }
        }
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showContributors]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                Welcome back, {getDisplayName()}!
              </h1>
              <p className="text-gray-600">Manage your retrospective meetings</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleEditProfile}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title="Edit Profile"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Profile</span>
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                title="Sign Out"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Create Meeting */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center mb-4">
              <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-full w-12 h-12 flex items-center justify-center mr-4">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Create Meeting</h3>
                <p className="text-gray-600">Start a new retrospective session</p>
              </div>
            </div>
            
            {showCreateForm ? (
              <form onSubmit={createMeeting} className="space-y-4">
                <input
                  type="text"
                  value={newMeetingTitle}
                  onChange={(e) => setNewMeetingTitle(e.target.value)}
                  placeholder="Meeting title (e.g., Sprint 23 Retrospective)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold py-3 rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Creating...' : 'Create & Join'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold py-3 rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all"
              >
                Create New Meeting
              </button>
            )}
          </div>

          {/* Join Meeting */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center mb-4">
              <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-full w-12 h-12 flex items-center justify-center mr-4">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Join Meeting</h3>
                <p className="text-gray-600">Enter a meeting code to join</p>
              </div>
            </div>
            
            <form onSubmit={handleJoinMeeting} className="space-y-4">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter meeting code (e.g., ABC123)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                required
              />
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold py-3 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all"
              >
                Join Meeting
              </button>
            </form>
          </div>
        </div>

        {/* Auto-expiration Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800 text-sm">
            ⏰ <strong>Auto-Expiration:</strong> Active meetings automatically end after 2 hours to prevent resource waste. You can manually end meetings anytime or restart them as needed.
          </p>
        </div>

        {/* Recent Meetings */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-2xl font-semibold text-gray-900 mb-6 flex items-center">
            <Calendar className="w-6 h-6 mr-3" />
            Your Meetings
          </h3>
          
          {meetings.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-gray-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-12 h-12 text-gray-400" />
              </div>
              <h4 className="text-xl font-semibold text-gray-600 mb-2">No meetings yet</h4>
              <p className="text-gray-500">Create your first retrospective meeting to get started</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {meetings.map((meeting) => {
                const timeInfo = getMeetingTimeInfo(meeting);
                const duration = getMeetingDuration(meeting);
                return (
                  <div key={meeting.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900">{meeting.title}</h4>
                          
                          {/* User Role Chip */}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            meeting.user_role === 'host'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {meeting.user_role === 'host' ? 'Host' : 'Contributor'}
                          </span>
                          
                          {/* Meeting Status Chip */}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            meeting.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {meeting.status === 'active' ? 'Active' : 'Ended'}
                          </span>
                          
                          {/* Show time info for active meetings or duration for ended meetings */}
                          {meeting.status === 'active' && timeInfo && (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              timeInfo.isExpiringSoon 
                                ? 'bg-orange-100 text-orange-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {timeInfo.timeLeftText}
                            </span>
                          )}
                          {meeting.status === 'ended' && duration && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              {duration}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-sm mb-2">
                          Created {new Date(meeting.created_at).toLocaleDateString()}
                          {meeting.ended_at && (
                            <span className="ml-2">
                              • Ended {new Date(meeting.ended_at).toLocaleDateString()}
                              {meeting.ended_by === null && (
                                <span className="text-orange-600 ml-1">(auto-expired)</span>
                              )}
                            </span>
                          )}
                        </p>
                        <p className="text-gray-700 font-mono text-sm bg-gray-100 rounded px-2 py-1 inline-block">
                          Code: {meeting.meeting_code}
                        </p>
                        
                        {/* Contributors Info */}
                        <div className="flex items-center gap-2 mt-2">
                          <div className="relative" ref={(el) => { contributorsRefs.current[meeting.id] = el; }}>
                            <button
                              onClick={() => toggleContributors(meeting.id)}
                              className="flex items-center gap-2 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm"
                            >
                              <Users className="w-4 h-4 text-gray-500" />
                              <span className="text-gray-600">
                                {meeting.contributorCount || 0} contributor{(meeting.contributorCount || 0) !== 1 ? 's' : ''}
                              </span>
                              <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${showContributors[meeting.id] ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Contributors Dropdown Menu */}
                            {showContributors[meeting.id] && (
                              <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
                                <div className="px-3 py-2 border-b border-gray-100">
                                  <h4 className="font-medium text-gray-900">Contributors</h4>
                                  <p className="text-xs text-gray-500">Participants who have added notes</p>
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                  {meetingProfiles[meeting.id] && meetingProfiles[meeting.id].length > 0 ? (
                                    meetingProfiles[meeting.id].map(contributor => (
                                      <div key={contributor.id} className="px-3 py-2 hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                                            <Users className="w-4 h-4 text-white" />
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-gray-900 truncate">
                                              {contributor.display_name || contributor.email || 'Unknown User'}
                                              {contributor.id === meeting.created_by && (
                                                <span className="text-green-600 ml-1">(Host)</span>
                                              )}
                                            </p>
                                            {contributor.email && (
                                              <p className="text-xs text-gray-500 truncate">
                                                {contributor.email}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="px-3 py-2 text-center text-gray-500">
                                      <p className="text-sm">No notes added yet</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => copyMeetingLink(meeting.meeting_code)}
                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Copy meeting link"
                        >
                          {copiedCode === meeting.meeting_code ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <Copy className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => onJoinMeeting(meeting.meeting_code)}
                          className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Join meeting"
                        >
                          <ExternalLink className="w-5 h-5" />
                        </button>
                        {meeting.status === 'active' && (
                          <button
                            onClick={() => handleInviteClick(meeting.meeting_code, meeting.title)}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Invite others to join this meeting"
                          >
                            <UserPlus className="w-5 h-5" />
                          </button>
                        )}
                        {meeting.status === 'active' && (
                          <button
                            onClick={() => handleEndMeetingClick(meeting.id, meeting.title)}
                            disabled={endingMeeting === meeting.id}
                            className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="End meeting (stop active session)"
                          >
                            {endingMeeting === meeting.id ? (
                              <div className="w-5 h-5 animate-spin rounded-full border-2 border-orange-600 border-t-transparent"></div>
                            ) : (
                              <StopCircle className="w-5 h-5" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteMeetingClick(meeting.id, meeting.title)}
                          disabled={deletingMeeting === meeting.id}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete meeting permanently (⚠️ Cannot be undone)"
                        >
                          {deletingMeeting === meeting.id ? (
                            <div className="w-5 h-5 animate-spin rounded-full border-2 border-red-600 border-t-transparent"></div>
                          ) : (
                            <Trash2 className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* User Profile Modal */}
      {showProfile && (
        <UserProfile onClose={() => setShowProfile(false)} />
      )}

      {/* Invite Modal */}
      <InviteModal
        isOpen={showInviteModal}
        onClose={handleInviteModalClose}
        meetingCode={inviteMeetingCode || undefined}
        meetingTitle={inviteMeetingTitle || undefined}
        onInvitesSent={(count) => {
          console.log(`Dashboard: ${count} invitations sent for meeting ${inviteMeetingTitle}`);
        }}
      />

      {/* End Meeting Confirmation Modal */}
      <ConfirmationModal
        isOpen={showEndModal}
        onClose={handleEndModalClose}
        onConfirm={handleEndMeetingConfirm}
        title="End Meeting"
        message={getEndModalMessage()}
        confirmText="End Meeting"
        cancelText="Keep Active"
        type="warning"
        requireTextConfirmation={false}
        loading={endingMeeting !== null}
        showEmailCheckbox={true}
        emailCheckboxLabel="Send meeting summary email to all participants"
        emailCheckboxDefaultChecked={true}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={handleDeleteModalClose}
        onConfirm={handleDeleteMeetingConfirm}
        title="Delete Meeting"
        message={getDeleteModalMessage()}
        confirmText="Delete Permanently"
        cancelText="Cancel"
        type="danger"
        requireTextConfirmation={true}
        textToConfirm={meetingToDelete?.title || ''}
        loading={deletingMeeting !== null}
      />


    </div>
  );
}