import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendMeetingSummaryEmails, prepareMeetingEmailData, MeetingSummaryData } from '../emailService';

// Mock Supabase
const mockSupabaseClient = {
  auth: {
    getSession: vi.fn()
  },
  functions: {
    invoke: vi.fn()
  }
};

vi.mock('../supabase', () => ({
  supabase: mockSupabaseClient
}));

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('prepareMeetingEmailData', () => {
    const mockMeeting = {
      id: 'meeting-123',
      title: 'Sprint 1 Retrospective',
      meeting_code: 'ABC123',
      created_by: 'host-123',
      created_at: '2024-01-01T10:00:00.000Z',
      ended_at: '2024-01-01T11:30:00.000Z',
      status: 'ended'
    };

    const mockNotes = [
      {
        id: 'note-1',
        content: 'Great teamwork!',
        type: 'glad',
        created_by: 'user-1',
        created_at: '2024-01-01T10:15:00.000Z',
        like_count: 2
      },
      {
        id: 'note-2',
        content: 'Communication issues',
        type: 'mad',
        created_by: 'user-2',
        created_at: '2024-01-01T10:20:00.000Z',
        like_count: 1
      },
      {
        id: 'note-3',
        content: 'Try daily standups',
        type: 'action',
        created_by: 'user-1',
        created_at: '2024-01-01T10:25:00.000Z',
        like_count: 3
      }
    ];

    const mockUserProfiles = {
      'host-123': {
        id: 'host-123',
        display_name: 'John Host',
        email: 'john@grepsr.com',
        avatar_url: null
      },
      'user-1': {
        id: 'user-1',
        display_name: 'Alice Developer',
        email: 'alice@grepsr.com',
        avatar_url: null
      },
      'user-2': {
        id: 'user-2',
        display_name: 'Bob Tester',
        email: 'bob@grepsr.com',
        avatar_url: null
      }
    };

    it('prepares meeting email data correctly', async () => {
      const result = await prepareMeetingEmailData(
        mockMeeting,
        mockNotes,
        mockUserProfiles,
        'john@grepsr.com'
      );

      expect(result).toEqual({
        meetingId: 'meeting-123',
        meetingCode: 'ABC123',
        meetingTitle: 'Sprint 1 Retrospective',
        hostEmail: 'john@grepsr.com',
        hostName: 'John Host',
        startDate: '2024-01-01T10:00:00.000Z',
        endDate: '2024-01-01T11:30:00.000Z',
        endedBy: 'john@grepsr.com',
        participantCount: 2, // Only Alice and Bob (excluding host from participants list)
        notes: [
          {
            type: 'glad',
            content: 'Great teamwork!',
            created_by: 'user-1',
            created_at: '2024-01-01T10:15:00.000Z',
            like_count: 2,
            author_name: 'Alice Developer'
          },
          {
            type: 'mad',
            content: 'Communication issues',
            created_by: 'user-2',
            created_at: '2024-01-01T10:20:00.000Z',
            like_count: 1,
            author_name: 'Bob Tester'
          },
          {
            type: 'action',
            content: 'Try daily standups',
            created_by: 'user-1',
            created_at: '2024-01-01T10:25:00.000Z',
            like_count: 3,
            author_name: 'Alice Developer'
          }
        ],
        participants: [
          { email: 'alice@grepsr.com', name: 'Alice Developer' },
          { email: 'bob@grepsr.com', name: 'Bob Tester' }
        ]
      });
    });

    it('handles missing user profiles gracefully', async () => {
      const incompleteProfiles = {
        'host-123': {
          id: 'host-123',
          display_name: 'John Host',
          email: 'john@grepsr.com',
          avatar_url: null
        }
        // Missing profiles for user-1 and user-2
      };

      const result = await prepareMeetingEmailData(
        mockMeeting,
        mockNotes,
        incompleteProfiles,
        'john@grepsr.com'
      );

      expect(result.notes[0].author_name).toBe('Unknown User');
      expect(result.notes[1].author_name).toBe('Unknown User');
      expect(result.participants).toEqual([]); // No valid emails for unknown users
    });

    it('uses email prefix as fallback for display name', async () => {
      const profilesWithoutDisplayName = {
        'host-123': {
          id: 'host-123',
          display_name: null,
          email: 'john.smith@grepsr.com',
          avatar_url: null
        },
        'user-1': {
          id: 'user-1',
          display_name: null,
          email: 'alice.developer@grepsr.com',
          avatar_url: null
        }
      };

      const result = await prepareMeetingEmailData(
        mockMeeting,
        [mockNotes[0]], // Only first note
        profilesWithoutDisplayName,
        'john.smith@grepsr.com'
      );

      expect(result.hostName).toBe('john.smith');
      expect(result.notes[0].author_name).toBe('alice.developer');
      expect(result.participants[0].name).toBe('alice.developer');
    });

    it('handles empty notes array', async () => {
      const result = await prepareMeetingEmailData(
        mockMeeting,
        [],
        mockUserProfiles,
        'john@grepsr.com'
      );

      expect(result.notes).toEqual([]);
      expect(result.participants).toEqual([]);
      expect(result.participantCount).toBe(0);
    });

    it('filters out participants without valid emails', async () => {
      const profilesWithInvalidEmails = {
        'host-123': mockUserProfiles['host-123'],
        'user-1': {
          id: 'user-1',
          display_name: 'Alice Developer',
          email: null, // No email
          avatar_url: null
        },
        'user-2': mockUserProfiles['user-2']
      };

      const result = await prepareMeetingEmailData(
        mockMeeting,
        mockNotes,
        profilesWithInvalidEmails,
        'john@grepsr.com'
      );

      expect(result.participants).toEqual([
        { email: 'bob@grepsr.com', name: 'Bob Tester' }
      ]);
      expect(result.participantCount).toBe(1);
    });
  });

  describe('sendMeetingSummaryEmails', () => {
    const mockEmailData: MeetingSummaryData = {
      meetingId: 'meeting-123',
      meetingCode: 'ABC123',
      meetingTitle: 'Sprint 1 Retrospective',
      hostEmail: 'john@grepsr.com',
      hostName: 'John Host',
      startDate: '2024-01-01T10:00:00.000Z',
      endDate: '2024-01-01T11:30:00.000Z',
      endedBy: 'john@grepsr.com',
      participantCount: 2,
      notes: [
        {
          type: 'glad',
          content: 'Great teamwork!',
          created_by: 'user-1',
          created_at: '2024-01-01T10:15:00.000Z',
          like_count: 2,
          author_name: 'Alice Developer'
        }
      ],
      participants: [
        { email: 'alice@grepsr.com', name: 'Alice Developer' },
        { email: 'bob@grepsr.com', name: 'Bob Tester' }
      ]
    };

    it('successfully sends meeting summary emails', async () => {
      const mockSession = {
        access_token: 'test-token',
        user: { id: 'host-123' }
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: {
          success: true,
          emailsSent: 2,
          totalParticipants: 2,
          failures: 0
        },
        error: null
      });

      const result = await sendMeetingSummaryEmails(mockEmailData);

      expect(result).toEqual({
        success: true,
        emailsSent: 2,
        totalParticipants: 2,
        failures: 0
      });

      expect(mockSupabaseClient.functions.invoke).toHaveBeenCalledWith(
        'send-meeting-summary',
        {
          body: mockEmailData,
          headers: {
            Authorization: 'Bearer test-token'
          }
        }
      );
    });

    it('handles authentication errors', async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await sendMeetingSummaryEmails(mockEmailData);

      expect(result).toEqual({
        success: false,
        error: 'No authenticated session'
      });

      expect(mockSupabaseClient.functions.invoke).not.toHaveBeenCalled();
    });

    it('handles edge function errors', async () => {
      const mockSession = {
        access_token: 'test-token',
        user: { id: 'host-123' }
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Edge function failed' }
      });

      const result = await sendMeetingSummaryEmails(mockEmailData);

      expect(result).toEqual({
        success: false,
        error: 'Edge function failed'
      });
    });

    it('handles partial email sending failures', async () => {
      const mockSession = {
        access_token: 'test-token',
        user: { id: 'host-123' }
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: {
          success: true,
          emailsSent: 1,
          totalParticipants: 2,
          failures: 1
        },
        error: null
      });

      const result = await sendMeetingSummaryEmails(mockEmailData);

      expect(result).toEqual({
        success: true,
        emailsSent: 1,
        totalParticipants: 2,
        failures: 1
      });
    });

    it('handles unexpected errors', async () => {
      mockSupabaseClient.auth.getSession.mockRejectedValue(
        new Error('Network error')
      );

      const result = await sendMeetingSummaryEmails(mockEmailData);

      expect(result).toEqual({
        success: false,
        error: 'Network error'
      });
    });

    it('handles edge function returning malformed data', async () => {
      const mockSession = {
        access_token: 'test-token',
        user: { id: 'host-123' }
      };

      mockSupabaseClient.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      mockSupabaseClient.functions.invoke.mockResolvedValue({
        data: null, // Malformed response
        error: null
      });

      const result = await sendMeetingSummaryEmails(mockEmailData);

      expect(result).toEqual({
        success: false,
        error: 'Failed to send emails'
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles meeting without end date', async () => {
      const meetingWithoutEndDate = {
        id: 'meeting-123',
        title: 'Active Meeting',
        meeting_code: 'ABC123',
        created_by: 'host-123',
        created_at: '2024-01-01T10:00:00.000Z',
        ended_at: null,
        status: 'active'
      };

      const result = await prepareMeetingEmailData(
        meetingWithoutEndDate,
        [],
        { 'host-123': { id: 'host-123', display_name: 'Host', email: 'host@grepsr.com', avatar_url: null } },
        'host@grepsr.com'
      );

      expect(result.endDate).toBeDefined();
      expect(new Date(result.endDate)).toBeInstanceOf(Date);
    });

    it('handles very long meeting content', async () => {
      const longNote = {
        id: 'note-1',
        content: 'A'.repeat(10000), // Very long content
        type: 'glad' as const,
        created_by: 'user-1',
        created_at: '2024-01-01T10:15:00.000Z',
        like_count: 0
      };

      const mockProfiles = {
        'host-123': { id: 'host-123', display_name: 'Host', email: 'host@grepsr.com', avatar_url: null },
        'user-1': { id: 'user-1', display_name: 'User1', email: 'user1@grepsr.com', avatar_url: null }
      };

      const result = await prepareMeetingEmailData(
        {
          id: 'meeting-123',
          title: 'Test Meeting',
          meeting_code: 'ABC123',
          created_by: 'host-123',
          created_at: '2024-01-01T10:00:00.000Z',
          ended_at: '2024-01-01T11:00:00.000Z',
          status: 'ended'
        },
        [longNote],
        mockProfiles,
        'host@grepsr.com'
      );

      expect(result.notes[0].content).toBe('A'.repeat(10000));
      expect(result.notes[0].author_name).toBe('User1');
    });
  });
}); 