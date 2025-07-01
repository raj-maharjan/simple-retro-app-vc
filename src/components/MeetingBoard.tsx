import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Download, Users, Share2, Copy, CheckCircle, StopCircle, ChevronDown, UserPlus } from 'lucide-react';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { sendMeetingSummaryEmails, prepareMeetingEmailData } from '../lib/emailService';
import { NoteColumn } from './NoteColumn';
import { Logo } from './Logo';
import { ConfirmationModal } from './ConfirmationModal';
import { InviteModal } from './InviteModal';

import { TopNavBar } from './TopNavBar';
import { UserProfile as UserProfileComponent } from './UserProfile';

interface Note {
  id: string;
  content: string;
  type: 'glad' | 'mad' | 'sad' | 'action';
  created_by: string;
  created_at: string;
  updated_at: string;
  like_count: number;
  user_liked: boolean;
  liked_by?: Array<{ user_id: string; user_name: string; created_at: string }>;
}

interface Meeting {
  id: string;
  title: string;
  meeting_code: string;
  created_by: string;
  status: 'active' | 'ended';
  ended_at: string | null;
  ended_by: string | null;
  created_at: string;
}

interface UserProfile {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

interface MeetingBoardProps {
  meetingCode: string;
  onBack: () => void;
}

export function MeetingBoard({ meetingCode, onBack }: MeetingBoardProps) {
  const { user } = useAuth();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [endingMeeting, setEndingMeeting] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('');
  const [showParticipants, setShowParticipants] = useState(false);
  const [realTimeStatus, setRealTimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [activeParticipants, setActiveParticipants] = useState<number>(0);
  const [liveParticipants, setLiveParticipants] = useState<string[]>([]);
  const [showLiveParticipants, setShowLiveParticipants] = useState(false);
  const [typingIndicators, setTypingIndicators] = useState<Record<string, { userId: string; userName: string; timestamp: number }>>({});
  const participantsRef = useRef<HTMLDivElement>(null);
  const liveParticipantsRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const channelRef = useRef<any>(null);

  useEffect(() => {
    fetchMeeting();
  }, [meetingCode]);

  useEffect(() => {
    if (meeting) {
      fetchNotes();
      const cleanup = subscribeToNotes();
      
      // Set up interval to check for auto-expiration
      const expirationInterval = setInterval(checkMeetingExpiration, 60000);
      
      return () => {
        cleanup();
        clearInterval(expirationInterval);
      };
    }
  }, [meeting]);

  // Real-time elapsed time update
  useEffect(() => {
    if (!meeting || meeting.status === 'ended') {
      setElapsedTime('');
      return;
    }

    const updateElapsedTime = () => {
      const createdAt = new Date(meeting.created_at);
      const now = new Date();
      const elapsed = now.getTime() - createdAt.getTime();
      
      const hours = Math.floor(elapsed / (1000 * 60 * 60));
      const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);
      
      if (hours > 0) {
        setElapsedTime(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setElapsedTime(`${minutes}m ${seconds}s`);
      } else {
        setElapsedTime(`${seconds}s`);
      }
    };

    // Update immediately
    updateElapsedTime();
    
    // Update every second
    const interval = setInterval(updateElapsedTime, 1000);
    
    return () => clearInterval(interval);
  }, [meeting]);

  // Click outside handler for participants dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (participantsRef.current && !participantsRef.current.contains(event.target as Node)) {
        setShowParticipants(false);
      }
      if (liveParticipantsRef.current && !liveParticipantsRef.current.contains(event.target as Node)) {
        setShowLiveParticipants(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const checkMeetingExpiration = async () => {
    if (!meeting || meeting.status === 'ended') return;

    const createdAt = new Date(meeting.created_at);
    const now = new Date();
    const twoHoursFromCreation = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000);

          if (now >= twoHoursFromCreation) {
      // Auto-end the meeting
      try {
        const { data, error } = await supabase
          .from('meetings')
          .update({
            status: 'ended',
            ended_at: new Date().toISOString(),
            ended_by: null, // null indicates auto-ended
          })
          .eq('id', meeting.id)
          .select()
          .single();

        if (!error && data) {
          setMeeting(data);
          
          // Send meeting summary emails
          console.log('📧 Auto-ended meeting, sending summary emails...');
          try {
            const emailData = await prepareMeetingEmailData(data, notes, userProfiles, null);
            const emailResult = await sendMeetingSummaryEmails(emailData);
            
            if (emailResult.success) {
              console.log(`✅ Meeting summary emails sent to ${emailResult.emailsSent}/${emailResult.totalParticipants} participants`);
            } else {
              console.error('❌ Failed to send meeting summary emails:', emailResult.error);
            }
          } catch (emailError) {
            console.error('💥 Error sending meeting summary emails:', emailError);
          }
        }
      } catch (err) {
        console.error('Error auto-ending meeting:', err);
      }
    }
  };

  const fetchMeeting = async () => {
    console.log('Fetching meeting with code:', meetingCode);
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('meeting_code', meetingCode)
      .single();

    if (error) {
      console.error('Error fetching meeting:', error);
      setError('Meeting not found');
      setLoading(false);
      return;
    }

    console.log('Meeting found:', data);
    setMeeting(data);
    setLoading(false);
  };

  const fetchNotes = async () => {
    if (!meeting || !user) return;

    console.log('Fetching notes for meeting:', meeting.id);
    
    try {
      // First, get all notes for the meeting
      const { data: basicNotes, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .eq('meeting_id', meeting.id)
        .order('created_at', { ascending: true });

      if (notesError) {
        console.error('Error fetching notes:', notesError);
        return;
      }

      console.log('Fetched basic notes:', basicNotes);

      if (!basicNotes || basicNotes.length === 0) {
        setNotes([]);
        return;
      }

      // Then, get like counts and user likes for each note
      const notesWithLikes = await Promise.all(
        basicNotes.map(async (note) => {
          try {
            // Get like count
            const { count: likeCount, error: countError } = await supabase
              .from('note_likes')
              .select('*', { count: 'exact', head: true })
              .eq('note_id', note.id);

            if (countError) {
              console.error('Error getting like count for note:', note.id, countError);
            }

            // Check if current user liked this note
            const { data: userLike, error: likeError } = await supabase
              .from('note_likes')
              .select('id')
              .eq('note_id', note.id)
              .eq('user_id', user.id)
              .maybeSingle(); // Use maybeSingle to avoid error when no rows found

            if (likeError) {
              console.error('Error checking user like for note:', note.id, likeError);
            }

            return {
              ...note,
              like_count: likeCount || 0,
              user_liked: !!userLike
            };
          } catch (err) {
            console.error('Error processing note likes:', err);
            return {
              ...note,
              like_count: 0,
              user_liked: false
            };
          }
        })
      );

      console.log('Notes with likes processed:', notesWithLikes);
      setNotes(notesWithLikes);
      
      // Fetch user profiles for all note creators
      const userIds = [...new Set(basicNotes.map(note => note.created_by))];
      if (userIds.length > 0) {
        fetchUserProfiles(userIds);
      }
    } catch (err) {
      console.error('Error in fetchNotes:', err);
      setNotes([]);
    }
  };

  const fetchUserProfiles = async (userIds: string[]) => {
    console.log('Fetching user profiles for:', userIds);
    
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .in('id', userIds);

    if (error) {
      console.error('Error fetching user profiles:', error);
    } else {
      const profilesMap: Record<string, UserProfile> = {};
      data?.forEach(profile => {
        profilesMap[profile.id] = profile;
      });
      
      // Add fallback profiles for users without profiles
      userIds.forEach(id => {
        if (!profilesMap[id]) {
          profilesMap[id] = {
            id,
            display_name: id === user?.id ? 'You' : 'Anonymous User',
            email: id === user?.id ? (user.email ?? null) : null,
            avatar_url: null,
          };
        }
      });
      
      setUserProfiles(prev => ({ ...prev, ...profilesMap }));
    }
  };

  const fetchNoteWithLikes = async (note: any): Promise<Note> => {
    if (!user) {
      return {
        ...note,
        like_count: 0,
        user_liked: false
      };
    }

    try {
      // Get like count for this note
      const { count: likeCount, error: countError } = await supabase
        .from('note_likes')
        .select('*', { count: 'exact', head: true })
        .eq('note_id', note.id);

      if (countError) {
        console.error('Error fetching like count:', countError);
      }

      // Check if current user liked this note
      const { data: userLike, error: userLikeError } = await supabase
        .from('note_likes')
        .select('id')
        .eq('note_id', note.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (userLikeError) {
        console.error('Error checking user like:', userLikeError);
      }

      return {
        ...note,
        like_count: likeCount || 0,
        user_liked: !!userLike
      };
    } catch (err) {
      console.error('Error in fetchNoteWithLikes:', err);
      return {
        ...note,
        like_count: 0,
        user_liked: false
      };
    }
  };

  const subscribeToNotes = () => {
    if (!meeting || !user) return () => {};

    console.log('🔗 Setting up real-time subscriptions for meeting:', meeting.id, 'user:', user.id);
    console.log('🔗 Real-time enabled:', !!supabase.realtime);
    
    // Create a unique channel for this meeting with broadcast capabilities
    const channelName = `meeting:${meeting.id}`;
    console.log('🔗 Channel name:', channelName);
    
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false }, // Don't receive our own broadcasts
        presence: { key: user.id },
      },
    });

    // Store channel reference for broadcasting
    channelRef.current = channel;

    // Listen for database changes on notes table
    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notes',
          filter: `meeting_id=eq.${meeting.id}`,
        },
        async (payload) => {
          console.log('🟢 Real-time NOTE INSERT:', payload);
          const newNote = payload.new as any;
          
          try {
            // Fetch complete note with likes
            const noteWithLikes = await fetchNoteWithLikes(newNote);
            console.log('📝 Adding note with likes:', noteWithLikes);
            
            setNotes(prev => {
              // Skip if note already exists (avoid duplicates)
              if (prev.some(note => note.id === newNote.id)) {
                console.log('⚠️ Note already exists, skipping');
                return prev;
              }

              // Replace optimistic note if it exists
              const optimisticIndex = prev.findIndex(note => 
                note.id.startsWith('temp-') && 
                note.content === newNote.content && 
                note.type === newNote.type &&
                note.created_by === newNote.created_by
              );
              
              if (optimisticIndex !== -1) {
                console.log('🔄 Replacing optimistic note with real note');
                const updated = [...prev];
                updated[optimisticIndex] = noteWithLikes;
                return updated;
              }
              
              console.log('✅ Adding new note to state');
              return [...prev, noteWithLikes];
            });
            
            // Ensure user profile is available
            if (!userProfiles[newNote.created_by]) {
              fetchUserProfiles([newNote.created_by]);
            }
          } catch (error) {
            console.error('❌ Error processing note insert:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notes',
          filter: `meeting_id=eq.${meeting.id}`,
        },
        async (payload) => {
          console.log('🟡 Real-time NOTE UPDATE:', payload);
          const updatedNote = payload.new as any;
          
          try {
            const noteWithLikes = await fetchNoteWithLikes(updatedNote);
            console.log('📝 Updating note with likes:', noteWithLikes);
            
            setNotes(prev => prev.map(note => 
              note.id === updatedNote.id ? noteWithLikes : note
            ));
          } catch (error) {
            console.error('❌ Error processing note update:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notes',
          // Remove filter for DELETE events as they might not include full row data
        },
        (payload) => {
          console.log('🔴 Real-time NOTE DELETE:', payload);
          const deletedNote = payload.old as any;
          
          if (deletedNote?.id) {
            setNotes(prev => {
              // Only remove if this note belongs to our meeting
              const noteToRemove = prev.find(note => note.id === deletedNote.id);
              if (noteToRemove) {
                console.log('🗑️ Removing note from current meeting:', deletedNote.id);
                return prev.filter(note => note.id !== deletedNote.id);
              } else {
                console.log('🔍 Deleted note not in current meeting, ignoring');
                return prev;
              }
            });
          } else {
            console.error('❌ DELETE event missing note ID:', payload);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'note_likes',
        },
        async (payload) => {
          console.log('❤️ Real-time LIKE change:', payload);
          const likeData = (payload.new || payload.old) as { note_id?: string; user_id?: string };
          
          if (likeData?.note_id) {
            try {
              // Find the note and refresh its like data
              setNotes(prev => {
                const noteIndex = prev.findIndex(note => note.id === likeData.note_id);
                if (noteIndex === -1) return prev;
                
                // Refresh the specific note's like information
                fetchNoteWithLikes(prev[noteIndex]).then(updatedNote => {
                  setNotes(current => current.map(note => 
                    note.id === likeData.note_id ? updatedNote : note
                  ));
                });
                
                return prev; // Return current state while async update happens
              });
            } catch (error) {
              console.error('❌ Error processing like change:', error);
            }
          }
        }
      )
      .subscribe(async (status) => {
         console.log('📡 Subscription status:', status);
         
         if (status === 'SUBSCRIBED') {
           console.log('✅ Successfully subscribed to real-time updates');
           setRealTimeStatus('connected');
         } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
           console.error('❌ Subscription error, attempting reconnection...');
           setRealTimeStatus('disconnected');
           setTimeout(() => {
             if (meeting) {
               console.log('🔄 Retrying subscription...');
               setRealTimeStatus('connecting');
               fetchNotes(); // Fallback refresh
             }
           }, 2000);
         }
       });

    // Set up presence tracking for active participants
    channel.on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState();
      const participantCount = Object.keys(presenceState).length;
      console.log('👥 Active participants:', participantCount, presenceState);
      setActiveParticipants(participantCount);
      
      // Extract user IDs from presence state
      const liveUserIds: string[] = [];
      Object.values(presenceState).forEach((presences: any) => {
        presences.forEach((presence: any) => {
          if (presence.user_id && !liveUserIds.includes(presence.user_id)) {
            liveUserIds.push(presence.user_id);
          }
        });
      });
      setLiveParticipants(liveUserIds);
      
      // Fetch profiles for all live participants to ensure we have their display names
      if (liveUserIds.length > 0) {
        fetchUserProfiles(liveUserIds);
      }
    });

    // Listen for typing indicators via broadcast
    channel.on('broadcast', { event: 'typing' }, (payload) => {
      const { noteId, userId, userName, isTyping } = payload.payload;
      console.log('⌨️ Typing event:', { noteId, userId, userName, isTyping });
      
      // Don't show typing indicator for current user
      if (userId === user.id) return;
      
      if (isTyping) {
        setTypingIndicators(prev => ({
          ...prev,
          [noteId]: { userId, userName, timestamp: Date.now() }
        }));
        
        // Clear typing indicator after 3 seconds of inactivity
        if (typingTimeoutRef.current[noteId]) {
          clearTimeout(typingTimeoutRef.current[noteId]);
        }
        
        typingTimeoutRef.current[noteId] = setTimeout(() => {
          setTypingIndicators(prev => {
            const updated = { ...prev };
            delete updated[noteId];
            return updated;
          });
          delete typingTimeoutRef.current[noteId];
        }, 3000);
      } else {
        // User stopped typing
        setTypingIndicators(prev => {
          const updated = { ...prev };
          delete updated[noteId];
          return updated;
        });
        
        if (typingTimeoutRef.current[noteId]) {
          clearTimeout(typingTimeoutRef.current[noteId]);
          delete typingTimeoutRef.current[noteId];
        }
      }
    });

    // Track this user as present
    channel.track({
      user_id: user.id,
      online_at: new Date().toISOString(),
    });

    // Set up separate subscription for user profile updates (avatars, names)
    const profileChannel = supabase.channel('user_profiles_updates');
    profileChannel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles',
        },
        (payload) => {
          console.log('👤 Real-time USER PROFILE UPDATE in meeting:', payload);
          const updatedProfile = payload.new as UserProfile;
          
          setUserProfiles(prev => {
            // Only update if this user is part of the current meeting
            if (prev[updatedProfile.id]) {
              console.log('✅ Updating profile for user in meeting:', updatedProfile.id);
              return {
                ...prev,
                [updatedProfile.id]: updatedProfile
              };
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      console.log('🔌 Cleaning up real-time subscriptions');
      supabase.removeChannel(channel);
      supabase.removeChannel(profileChannel);
    };
  };

  // Broadcast typing indicator functions
  const broadcastTypingStart = (noteId: string) => {
    if (!channelRef.current || !user || !meeting) return;
    
    const userName = getUserDisplayName(user.id);
    console.log('⌨️ Broadcasting typing start:', { noteId, userName });
    
    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        noteId,
        userId: user.id,
        userName,
        isTyping: true
      }
    });
  };

  const broadcastTypingStop = (noteId: string) => {
    if (!channelRef.current || !user || !meeting) return;
    
    const userName = getUserDisplayName(user.id);
    console.log('⌨️ Broadcasting typing stop:', { noteId, userName });
    
    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        noteId,
        userId: user.id,
        userName,
        isTyping: false
      }
    });
  };

  // Cleanup typing timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(typingTimeoutRef.current).forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, []);

  const addNote = async (type: 'glad' | 'mad' | 'sad' | 'action', content: string) => {
    if (!meeting || !user) {
      console.error('❌ Missing meeting or user:', { meeting: !!meeting, user: !!user });
      return;
    }

    if (meeting.status === 'ended') {
      console.error('❌ Meeting has ended');
      alert('This meeting has ended. You can no longer add notes.');
      return;
    }

    console.log('📝 Adding note:', { meeting_id: meeting.id, content, type, created_by: user.id });

    // Create optimistic note with temporary ID
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticNote: Note = {
      id: tempId,
      content,
      type,
      created_by: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      like_count: 0,
      user_liked: false
    };

    console.log('🔄 Adding optimistic note:', optimisticNote);
    // Add optimistic note immediately
    setNotes(prev => {
      console.log('🔄 Current notes count:', prev.length);
      const newNotes = [...prev, optimisticNote];
      console.log('🔄 New notes count:', newNotes.length);
      return newNotes;
    });

    console.log('💾 Inserting note to database...');
    const { data, error } = await supabase
      .from('notes')
      .insert([
        {
          meeting_id: meeting.id,
          content,
          type,
          created_by: user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ Error adding note to database:', error);
      // Remove optimistic note on error
      setNotes(prev => {
        console.log('🔄 Removing optimistic note due to error');
        return prev.filter(note => note.id !== tempId);
      });
      
      if (error.message.includes('active')) {
        alert('This meeting has ended. You can no longer add notes.');
      } else {
        alert('Failed to add note: ' + error.message);
      }
    } else {
      console.log('✅ Note added to database successfully:', data);
      // Replace optimistic note with real note (with correct ID)
      setNotes(prev => {
        console.log('🔄 Replacing optimistic note with real note:', data.id);
        return prev.map(note => 
          note.id === tempId 
            ? { ...data, like_count: 0, user_liked: false }
            : note
        );
      });
      
      // Ensure current user profile is available
      if (!userProfiles[user.id]) {
        console.log('👤 Adding current user profile');
        setUserProfiles(prev => ({
          ...prev,
          [user.id]: {
            id: user.id,
            display_name: 'You',
            email: user.email ?? null,
            avatar_url: null
          }
        }));
      }
    }
  };

  const updateNote = async (noteId: string, content: string) => {
    if (!meeting || meeting.status === 'ended') {
      alert('This meeting has ended. You can no longer edit notes.');
      return;
    }

    console.log('Updating note:', { noteId, content, userId: user?.id });

    // Store original note for rollback
    const originalNote = notes.find(note => note.id === noteId);
    
    // Optimistically update the note
    setNotes(prev => prev.map(note => 
      note.id === noteId 
        ? { ...note, content, updated_at: new Date().toISOString() }
        : note
    ));

    const { data, error } = await supabase
      .from('notes')
      .update({ content })
      .eq('id', noteId)
      .eq('created_by', user?.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating note:', error);
      // Rollback optimistic update
      if (originalNote) {
        setNotes(prev => prev.map(note => 
          note.id === noteId ? originalNote : note
        ));
      }
      
      if (error.message.includes('active')) {
        alert('This meeting has ended. You can no longer edit notes.');
      } else {
        alert('Failed to update note: ' + error.message);
      }
    } else {
      console.log('Note updated successfully:', data);
      // Real-time subscription will handle the final update
    }
  };

  const updateNoteType = async (noteId: string, newType: 'glad' | 'mad' | 'sad' | 'action') => {
    if (!meeting || meeting.status === 'ended') {
      alert('This meeting has ended. You can no longer move notes.');
      return;
    }

    console.log('Updating note type:', { noteId, newType, userId: user?.id });

    // Store original note for rollback
    const originalNote = notes.find(note => note.id === noteId);
    
    // Optimistically update the note type
    setNotes(prev => prev.map(note => 
      note.id === noteId 
        ? { ...note, type: newType, updated_at: new Date().toISOString() }
        : note
    ));

    const { data, error } = await supabase
      .from('notes')
      .update({ type: newType })
      .eq('id', noteId)
      .select()
      .single();

    if (error) {
      console.error('Error updating note type:', error);
      // Rollback optimistic update
      if (originalNote) {
        setNotes(prev => prev.map(note => 
          note.id === noteId ? originalNote : note
        ));
      }
      
      if (error.message.includes('active')) {
        alert('This meeting has ended. You can no longer move notes.');
      } else {
        alert('Failed to move note: ' + error.message);
      }
    } else {
      console.log('Note type updated successfully:', data);
      // Real-time subscription will handle the final update
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!meeting || meeting.status === 'ended') {
      alert('This meeting has ended. You can no longer delete notes.');
      return;
    }

    console.log('Deleting note:', { noteId, userId: user?.id });

    // Store original note for rollback
    const originalNote = notes.find(note => note.id === noteId);
    
    // Optimistically remove the note
    setNotes(prev => prev.filter(note => note.id !== noteId));

    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId)
      .eq('created_by', user?.id);

    if (error) {
      console.error('Error deleting note:', error);
      // Rollback optimistic delete
      if (originalNote) {
        setNotes(prev => [...prev, originalNote]);
      }
      
      if (error.message.includes('active')) {
        alert('This meeting has ended. You can no longer delete notes.');
      } else {
        alert('Failed to delete note: ' + error.message);
      }
    } else {
      console.log('Note deleted successfully');
      // Real-time subscription will confirm the deletion
    }
  };

  const toggleNoteLike = async (noteId: string) => {
    if (!meeting || !user || meeting.status === 'ended') {
      if (meeting?.status === 'ended') {
        alert('This meeting has ended. You can no longer like notes.');
      }
      return;
    }

    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    console.log('Toggling like for note:', { noteId, userId: user.id, currentlyLiked: note.user_liked });

    try {
      if (note.user_liked) {
        // Unlike the note
        const { error } = await supabase
          .from('note_likes')
          .delete()
          .eq('note_id', noteId)
          .eq('user_id', user.id);

        if (error) {
          console.error('Error unliking note:', error);
          alert('Failed to unlike note: ' + error.message);
        } else {
          console.log('Note unliked successfully');
          // Real-time subscription will handle updating the like count
        }
      } else {
        // Like the note
        const { error } = await supabase
          .from('note_likes')
          .insert([
            {
              note_id: noteId,
              user_id: user.id,
            },
          ]);

        if (error) {
          console.error('Error liking note:', error);
          if (error.message.includes('active')) {
            alert('This meeting has ended. You can no longer like notes.');
          } else {
            alert('Failed to like note: ' + error.message);
          }
        } else {
          console.log('Note liked successfully');
          // Real-time subscription will handle updating the like count
        }
      }
    } catch (err) {
      console.error('Error toggling like:', err);
      alert('Failed to toggle like. Please try again.');
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!meeting || meeting.status === 'ended') {
      alert('This meeting has ended. You can no longer move notes.');
      return;
    }

    const { destination, source, draggableId } = result;

    // If dropped outside a droppable area
    if (!destination) {
      return;
    }

    // If dropped in the same position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const noteId = draggableId;
    const newType = destination.droppableId as 'glad' | 'mad' | 'sad' | 'action';
    
    // Find the note being moved
    const noteToMove = notes.find(note => note.id === noteId);
    if (!noteToMove) return;

    // Update the note type in the database (updateNoteType includes optimistic updates)
    updateNoteType(noteId, newType);
  };

  const exportToCSV = () => {
    if (!meeting) return;

    const csvContent = [
      ['Type', 'Content', 'Created By', 'Created At', 'Likes'],
      ...notes.map(note => [
        note.type,
        note.content,
        getUserDisplayName(note.created_by),
        new Date(note.created_at).toLocaleString(),
        note.like_count.toString()
      ])
    ];

    const csvString = csvContent
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meeting.title.replace(/[^a-zA-Z0-9]/g, '_')}_retrospective.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyMeetingLink = () => {
    const link = `${window.location.origin}?meeting=${meetingCode}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleEndMeetingClick = () => {
    setShowEndModal(true);
  };

  const handleEndMeetingConfirm = async (sendEmail: boolean = true) => {
    if (!meeting || !user || meeting.created_by !== user.id) {
      alert('Only the meeting host can end the meeting.');
      return;
    }

    setEndingMeeting(true);

    try {
      const { data, error } = await supabase
        .from('meetings')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          ended_by: user.id,
        })
        .eq('id', meeting.id)
        .eq('created_by', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error ending meeting:', error);
        alert('Failed to end meeting. Please try again.');
      } else {
        setMeeting(data);
        setShowEndModal(false);

        // Conditionally send meeting summary emails based on checkbox
        if (sendEmail) {
          console.log('📧 Meeting ended by host, sending summary emails...');
          try {
            const emailData = await prepareMeetingEmailData(data, notes, userProfiles, user.email || user.id);
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
              alert('⚠️ Meeting ended successfully, but failed to send summary emails. You can still export the data manually.');
            }
          } catch (emailError) {
            console.error('💥 Error sending meeting summary emails:', emailError);
            alert('⚠️ Meeting ended successfully, but failed to send summary emails. You can still export the data manually.');
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
      setEndingMeeting(false);
    }
  };

  const handleEndModalClose = () => {
    setShowEndModal(false);
  };

  const handleEditProfile = () => {
    setShowProfile(true);
  };

  const getUserDisplayName = (userId: string) => {
    const profile = userProfiles[userId];
    if (profile?.display_name) {
      return profile.display_name;
    }
    // Fallback to email prefix if available
    if (profile?.email) {
      return profile.email.split('@')[0];
    }
    return 'Unknown User';
  };

  const getUserAvatarUrl = (userId: string): string | null => {
    const profile = userProfiles[userId];
    return profile?.avatar_url || null;
  };

  const getUserEmail = (userId: string) => {
    if (userId === user?.id) return user.email;
    const profile = userProfiles[userId];
    return profile?.email || 'Unknown';
  };

  const getEndModalMessage = () => {
    if (!meeting) return '';
    
    return `🛑 END MEETING CONFIRMATION

You are about to end the meeting:
"${meeting.title}"

This action will:
• Stop the active retrospective session
• Prevent participants from adding or editing notes

Are you sure you want to end this meeting?`;
  };

  // Test function for debugging real-time (can be called from console)
  const testRealTime = () => {
    console.log('🧪 Testing real-time connection...');
    console.log('Meeting:', meeting?.id);
    console.log('User:', user?.id);
    console.log('Real-time status:', realTimeStatus);
    console.log('Active participants:', activeParticipants);
    console.log('Live participants:', liveParticipants);
    console.log('Notes count:', notes.length);
    
    if (typeof window !== 'undefined') {
      (window as any).debugMeeting = {
        meeting,
        user,
        realTimeStatus,
        activeParticipants,
        liveParticipants,
        notes,
        testRealTime
      };
      console.log('🔧 Debug info available at window.debugMeeting');
    }
  };

  // Make test function available in development
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      (window as any).testRealTime = testRealTime;
      console.log('🔧 Run testRealTime() in console to debug');
    }
  }, [meeting, user, realTimeStatus, activeParticipants, liveParticipants, notes]);

  // Fetch who liked each note
  const fetchNoteLikes = async (noteId: string): Promise<Array<{ user_id: string; user_name: string; created_at: string }>> => {
    try {
      const { data: likesData, error } = await supabase
        .from('note_likes')
        .select('user_id, created_at')
        .eq('note_id', noteId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching note likes:', error);
        return [];
      }

      // Convert user IDs to display names
      const likesWithNames = likesData?.map(like => ({
        user_id: like.user_id,
        user_name: getUserDisplayName(like.user_id),
        created_at: like.created_at
      })) || [];

      return likesWithNames;
    } catch (err) {
      console.error('Error in fetchNoteLikes:', err);
      return [];
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading meeting...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <div className="bg-red-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Meeting Not Found</h2>
          <p className="text-gray-600 mb-6">The meeting code you entered doesn't exist or has expired.</p>
          <button
            onClick={onBack}
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const gladNotes = notes.filter(note => note.type === 'glad');
  const madNotes = notes.filter(note => note.type === 'mad');
  const sadNotes = notes.filter(note => note.type === 'sad');
  const actionNotes = notes.filter(note => note.type === 'action');

  // Get unique participants
  const participants = [...new Set(notes.map(note => note.created_by))];
  const isHost = meeting && user && meeting.created_by === user.id;
  const isMeetingEnded = meeting?.status === 'ended';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      {/* Top Navigation Bar */}
      <TopNavBar 
        currentPage="meeting"
        onNavigateToDashboard={onBack}
        onEditProfile={handleEditProfile}
      />
      
      <div className="max-w-8xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center">
              <div className="flex items-center gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{meeting?.title}</h1>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      isMeetingEnded 
                        ? 'bg-gray-100 text-gray-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {isMeetingEnded ? 'Ended' : 'Active'}
                    </span>
                    {/* Real-time Status Indicator with Live Participants Tooltip */}
                    {!isMeetingEnded && (
                      <div className="relative" ref={liveParticipantsRef}>
                        <span 
                          className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-all ${
                            realTimeStatus === 'connected' 
                              ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' 
                              : realTimeStatus === 'connecting'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                          onMouseEnter={() => realTimeStatus === 'connected' && activeParticipants > 0 && setShowLiveParticipants(true)}
                          onMouseLeave={() => setShowLiveParticipants(false)}
                          onClick={() => realTimeStatus === 'connected' && activeParticipants > 0 && setShowLiveParticipants(!showLiveParticipants)}
                          title={realTimeStatus === 'connected' ? 'Click to see who\'s online' : undefined}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            realTimeStatus === 'connected' 
                              ? 'bg-blue-500 animate-pulse' 
                              : realTimeStatus === 'connecting'
                              ? 'bg-yellow-500 animate-bounce'
                              : 'bg-red-500'
                          }`} />
                          {realTimeStatus === 'connected' 
                            ? `Live (${activeParticipants})` 
                            : realTimeStatus === 'connecting'
                            ? 'Connecting'
                            : 'Offline'
                          }
                        </span>

                        {/* Live Participants Tooltip */}
                        {showLiveParticipants && realTimeStatus === 'connected' && liveParticipants.length > 0 && (
                          <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-20">
                            <div className="px-3 py-2 border-b border-gray-100">
                              <h4 className="font-medium text-gray-900">Currently Online</h4>
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                              {liveParticipants.map(participantId => (
                                <div key={participantId} className="px-3 py-2 hover:bg-gray-50 transition-colors">
                                  <div className="flex items-center gap-3">
                                    <div className="bg-gradient-to-r from-green-500 to-blue-500 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-gray-900 truncate">
                                        {getUserDisplayName(participantId)}
                                        {participantId === meeting?.created_by && (
                                          <span className="text-green-600 ml-1">(Host)</span>
                                        )}
                                      </p>
                                      <p className="text-xs text-gray-500 truncate">
                                        {getUserEmail(participantId)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Real-time Elapsed Time Display */}
                    {!isMeetingEnded && elapsedTime && (
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 font-mono">
                        ⏱️ {elapsedTime}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 font-mono text-sm">Code: {meetingCode}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {/* Contributors Dropdown */}
                    <div className="relative" ref={participantsRef}>
                      <button
                        onClick={() => setShowParticipants(!showParticipants)}
                        className="flex items-center gap-2 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm"
                      >
                        <Users className="w-4 h-4 text-gray-500" />
                        <span className="text-gray-600">
                          {participants.length} contributor{participants.length !== 1 ? 's' : ''}
                        </span>
                        <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${showParticipants ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Contributors Dropdown Menu */}
                      {showParticipants && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
                          <div className="px-3 py-2 border-b border-gray-100">
                            <h4 className="font-medium text-gray-900">Contributors</h4>
                            <p className="text-xs text-gray-500">Participants who have added notes</p>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {participants.length > 0 ? participants.map(participantId => (
                              <div key={participantId} className="px-3 py-2 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                                    <Users className="w-4 h-4 text-white" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                      {getUserDisplayName(participantId)}
                                      {participantId === meeting?.created_by && (
                                        <span className="text-green-600 ml-1">(Host)</span>
                                      )}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">
                                      {getUserEmail(participantId)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )) : (
                              <div className="px-3 py-2 text-center text-gray-500">
                                <p className="text-sm">No notes added yet</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {isHost && (
                    <div className="mt-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Host
                      </span>
                    </div>
                  )}
                  {isMeetingEnded && meeting?.ended_at && (
                    <p className="text-sm text-gray-500 mt-1">
                      Ended on {new Date(meeting.ended_at).toLocaleString()}
                      {meeting.ended_by === null && (
                        <span className="text-orange-600 ml-1">(auto-expired after 2 hours)</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={copyMeetingLink}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                title="Copy meeting link"
              >
                {linkCopied ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-green-600">Copied!</span>
                  </>
                ) : (
                  <Share2 className="w-5 h-5" />
                )}
              </button>
              
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                title="Export to CSV"
              >
                <Download className="w-5 h-5" />
              </button>

              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                title="Invite others to join this meeting"
              >
                <UserPlus className="w-5 h-5" />
              </button>

              {/* Host Actions - Only End Meeting Button */}
              {isHost && !isMeetingEnded && (
                <button
                  onClick={handleEndMeetingClick}
                  disabled={endingMeeting}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="End meeting (stop active session)"
                >
                  {endingMeeting ? (
                    <div className="w-5 h-5 animate-spin rounded-full border-2 border-orange-600 border-t-transparent"></div>
                  ) : (
                    <StopCircle className="w-5 h-5" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Meeting Status Banner */}
        {isMeetingEnded ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <p className="text-gray-800 text-sm">
              📋 <strong>Meeting Ended:</strong> This retrospective session has been ended. You can view and export the notes, but no further changes can be made.
              {meeting?.ended_by === null && (
                <span className="text-orange-600 ml-2">
                  (This meeting was automatically ended after 2 hours)
                </span>
              )}
            </p>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-blue-800 text-sm">
              💡 <strong>Tip:</strong> You can drag and drop notes between columns to move them to different categories!
              {isHost && (
                <span className="ml-2 font-medium">
                  As the host, you can end this meeting using the "End Meeting" button above.
                </span>
              )}
            </p>
          </div>
        )}

        {/* Retrospective Board */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
            <NoteColumn
              title="What went well?"
              subtitle="Celebrate successes"
              type="glad"
              notes={gladNotes}
              onAddNote={addNote}
              onUpdateNote={updateNote}
              onDeleteNote={deleteNote}
              onToggleLike={toggleNoteLike}
              currentUserId={user?.id || ''}
              getUserDisplayName={getUserDisplayName}
              getUserAvatarUrl={getUserAvatarUrl}
              color="green"
              disabled={isMeetingEnded}
              typingIndicators={typingIndicators}
              onTypingStart={broadcastTypingStart}
              onTypingStop={broadcastTypingStop}
              likedBy={fetchNoteLikes}
            />
            
            <NoteColumn
              title="What didn't go well?"
              subtitle="Areas for improvement"
              type="mad"
              notes={madNotes}
              onAddNote={addNote}
              onUpdateNote={updateNote}
              onDeleteNote={deleteNote}
              onToggleLike={toggleNoteLike}
              currentUserId={user?.id || ''}
              getUserDisplayName={getUserDisplayName}
              getUserAvatarUrl={getUserAvatarUrl}
              color="red"
              disabled={isMeetingEnded}
              typingIndicators={typingIndicators}
              onTypingStart={broadcastTypingStart}
              onTypingStop={broadcastTypingStop}
              likedBy={fetchNoteLikes}
            />
            
            <NoteColumn
              title="What could we do differently?"
              subtitle="Lessons and insights"
              type="sad"
              notes={sadNotes}
              onAddNote={addNote}
              onUpdateNote={updateNote}
              onDeleteNote={deleteNote}
              onToggleLike={toggleNoteLike}
              currentUserId={user?.id || ''}
              getUserDisplayName={getUserDisplayName}
              getUserAvatarUrl={getUserAvatarUrl}
              color="yellow"
              disabled={isMeetingEnded}
              typingIndicators={typingIndicators}
              onTypingStart={broadcastTypingStart}
              onTypingStop={broadcastTypingStop}
              likedBy={fetchNoteLikes}
            />

            <NoteColumn
              title="Actions"
              subtitle="What will we do next?"
              type="action"
              notes={actionNotes}
              onAddNote={addNote}
              onUpdateNote={updateNote}
              onDeleteNote={deleteNote}
              onToggleLike={toggleNoteLike}
              currentUserId={user?.id || ''}
              getUserDisplayName={getUserDisplayName}
              getUserAvatarUrl={getUserAvatarUrl}
              color="blue"
              disabled={isMeetingEnded}
              typingIndicators={typingIndicators}
              onTypingStart={broadcastTypingStart}
              onTypingStop={broadcastTypingStop}
              likedBy={fetchNoteLikes}
            />
          </div>
        </DragDropContext>
      </div>

      {/* User Profile Modal */}
      {showProfile && (
        <UserProfileComponent onClose={() => setShowProfile(false)} />
      )}

      {/* Invite Modal */}
      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        meetingCode={meetingCode}
        meetingTitle={meeting?.title}
        onInvitesSent={(count) => {
          console.log(`MeetingBoard: ${count} invitations sent for meeting ${meetingCode}`);
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
        loading={endingMeeting}
        showEmailCheckbox={true}
        emailCheckboxLabel="Send meeting summary email to all participants"
        emailCheckboxDefaultChecked={true}
      />

      {/* Real-time Debugger - Disabled (functionality working) */}
      {/* {process.env.NODE_ENV === 'development' && (
  
      )} */}
    </div>
  );
}