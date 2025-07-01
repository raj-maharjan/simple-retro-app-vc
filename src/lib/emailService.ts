import { supabase } from './supabase';

export interface MeetingSummaryData {
  meetingId: string;
  meetingCode: string;
  meetingTitle: string;
  hostEmail: string;
  hostName: string;
  startDate: string;
  endDate: string;
  endedBy: string | null;
  participantCount: number;
  notes: Array<{
    type: string;
    content: string;
    created_by: string;
    created_at: string;
    like_count: number;
    author_name: string;
  }>;
  participants: Array<{
    email: string;
    name: string;
  }>;
}

export async function sendMeetingSummaryEmails(data: MeetingSummaryData): Promise<{
  success: boolean;
  emailsSent?: number;
  totalParticipants?: number;
  failures?: number;
  error?: string;
}> {
  try {
    console.log('📧 Sending meeting summary emails for:', data.meetingTitle);
    
    // Get the current session token for authentication
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No authenticated session');
    }

    // Call the Supabase Edge Function
    const { data: result, error } = await supabase.functions.invoke('send-meeting-summary', {
      body: data,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      console.error('❌ Edge function error:', error);
      throw new Error(error.message || 'Failed to send emails');
    }

    console.log('✅ Email sending completed:', result);
    return result;

  } catch (error: any) {
    console.error('💥 Error sending meeting summary emails:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}

export async function prepareMeetingEmailData(
  meeting: any,
  notes: any[],
  userProfiles: Record<string, any>,
  endedBy: string | null
): Promise<MeetingSummaryData> {
  console.log('🔄 Preparing meeting email data...');

  // Get unique participants from notes
  const participantIds = [...new Set(notes.map(note => note.created_by))];
  
  // Get host information
  const hostProfile = userProfiles[meeting.created_by];
  const hostName = hostProfile?.display_name || hostProfile?.email?.split('@')[0] || 'Unknown Host';
  const hostEmail = hostProfile?.email || 'unknown@example.com';

  // Prepare participants data
  const participants = participantIds.map(userId => {
    const profile = userProfiles[userId];
    return {
      email: profile?.email || 'unknown@example.com',
      name: profile?.display_name || profile?.email?.split('@')[0] || 'Unknown User',
    };
  }).filter(p => p.email !== 'unknown@example.com'); // Filter out users without valid emails

  // Prepare notes data with author names
  const notesWithAuthors = notes.map(note => ({
    type: note.type,
    content: note.content,
    created_by: note.created_by,
    created_at: note.created_at,
    like_count: note.like_count || 0,
    author_name: userProfiles[note.created_by]?.display_name || 
                 userProfiles[note.created_by]?.email?.split('@')[0] || 
                 'Unknown User',
  }));

  const emailData: MeetingSummaryData = {
    meetingId: meeting.id,
    meetingCode: meeting.meeting_code,
    meetingTitle: meeting.title,
    hostEmail,
    hostName,
    startDate: meeting.created_at,
    endDate: meeting.ended_at || new Date().toISOString(),
    endedBy: endedBy,
    participantCount: participants.length,
    notes: notesWithAuthors,
    participants,
  };

  console.log('📋 Prepared email data:', {
    participants: participants.length,
    notes: notesWithAuthors.length,
    meetingCode: meeting.meeting_code,
  });

  return emailData;
} 