import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Dashboard } from '../Dashboard';
import { useAuth } from '../../contexts/AuthContext';

// Mock the AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn()
}));

// Mock the UserProfile component
vi.mock('../UserProfile', () => ({
  UserProfile: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="user-profile-modal">
      <button onClick={onClose}>Close Profile</button>
    </div>
  )
}));

// Mock the ConfirmationModal component
vi.mock('../ConfirmationModal', () => ({
  ConfirmationModal: ({ isOpen, onClose, onConfirm, title }: any) => 
    isOpen ? (
      <div data-testid="confirmation-modal">
        <h2>{title}</h2>
        <button onClick={() => onConfirm(true)}>Confirm</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    ) : null
}));

// Mock the InviteModal component
vi.mock('../InviteModal', () => ({
  InviteModal: ({ isOpen, onClose }: any) => 
    isOpen ? (
      <div data-testid="invite-modal">
        <button onClick={onClose}>Close Invite</button>
      </div>
    ) : null
}));

// Mock the Logo component
vi.mock('../Logo', () => ({
  Logo: () => <div data-testid="logo">Logo</div>
}));

// Mock the email service
vi.mock('../../lib/emailService', () => ({
  sendMeetingSummaryEmails: vi.fn().mockResolvedValue({
    success: true,
    emailsSent: 1,
    totalParticipants: 1
  }),
  prepareMeetingEmailData: vi.fn().mockResolvedValue({
    meetingId: 'test-meeting-id',
    meetingCode: 'TEST123',
    meetingTitle: 'Test Meeting',
    hostEmail: 'test@grepsr.com',
    hostName: 'Test User',
    startDate: '2024-01-01T00:00:00.000Z',
    endDate: '2024-01-01T01:00:00.000Z',
    endedBy: 'test-user-id',
    participantCount: 1,
    notes: [],
    participants: [{ email: 'test@grepsr.com', name: 'Test User' }]
  })
}));

const mockUser = {
  id: 'test-user-id',
  email: 'test@grepsr.com',
  user_metadata: {
    display_name: 'Test User'
  }
};

const mockUseAuth = useAuth as any;

describe('Dashboard', () => {
  const mockOnJoinMeeting = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: mockUser,
      signOut: vi.fn()
    });

    // Mock supabase responses for dashboard operations
    const { supabase } = require('../../lib/supabase');
    
    // Mock profile fetch
    supabase.from.mockImplementation((table: string) => {
      if (table === 'user_profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'test-user-id',
              display_name: 'Test User',
              email: 'test@grepsr.com'
            },
            error: null
          }),
          insert: vi.fn().mockReturnThis(),
          upsert: vi.fn().mockReturnThis()
        };
      }
      
      if (table === 'meetings') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'test-meeting-id',
              title: 'Test Meeting',
              meeting_code: 'TEST123',
              created_by: 'test-user-id',
              status: 'active',
              created_at: '2024-01-01T00:00:00.000Z',
              ended_at: null,
              ended_by: null
            },
            error: null
          }),
          then: vi.fn().mockResolvedValue({
            data: [],
            error: null
          })
        };
      }
      
      if (table === 'notes') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          then: vi.fn().mockResolvedValue({
            data: [],
            error: null
          })
        };
      }
      
      // Default mock for other tables
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: vi.fn().mockResolvedValue({ data: [], error: null })
      };
    });
  });

  describe('Basic Rendering', () => {
    it('renders the main dashboard elements', async () => {
      render(<Dashboard onJoinMeeting={mockOnJoinMeeting} />);
      
      // Check for welcome message with user's display name
      await waitFor(() => {
        expect(screen.getByText(/Welcome back, Test User!/)).toBeInTheDocument();
      });
      
      // Check for main sections
      expect(screen.getByText('Create Meeting')).toBeInTheDocument();
      expect(screen.getByText('Join Meeting')).toBeInTheDocument();
      expect(screen.getByText('Your Meetings')).toBeInTheDocument();
      
      // Check for action buttons
      expect(screen.getByText('Create New Meeting')).toBeInTheDocument();
      expect(screen.getByText('Join Meeting')).toBeInTheDocument();
    });

    it('displays the user profile and sign out buttons', async () => {
      render(<Dashboard onJoinMeeting={mockOnJoinMeeting} />);
      
      await waitFor(() => {
        expect(screen.getByTitle('Edit Profile')).toBeInTheDocument();
        expect(screen.getByTitle('Sign Out')).toBeInTheDocument();
      });
    });

    it('shows empty state when no meetings exist', async () => {
      render(<Dashboard onJoinMeeting={mockOnJoinMeeting} />);
      
      await waitFor(() => {
        expect(screen.getByText('No meetings yet')).toBeInTheDocument();
        expect(screen.getByText('Create your first retrospective meeting to get started')).toBeInTheDocument();
      });
    });
  });

  describe('Create Meeting', () => {
    it('toggles create meeting form', async () => {
      const user = userEvent.setup();
      render(<Dashboard onJoinMeeting={mockOnJoinMeeting} />);
      
      await waitFor(() => {
        expect(screen.getByText('Create New Meeting')).toBeInTheDocument();
      });
      
      // Click to show form
      await user.click(screen.getByText('Create New Meeting'));
      
      expect(screen.getByPlaceholderText(/Meeting title/)).toBeInTheDocument();
      expect(screen.getByText('Create & Join')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      
      // Click cancel to hide form
      await user.click(screen.getByText('Cancel'));
      
      expect(screen.getByText('Create New Meeting')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/Meeting title/)).not.toBeInTheDocument();
    });

    it('creates a meeting with valid input', async () => {
      const user = userEvent.setup();
      const { supabase } = require('../../lib/supabase');
      
      // Mock successful meeting creation
      supabase.from.mockImplementation((table: string) => {
        if (table === 'meetings') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'new-meeting-id',
                title: 'New Test Meeting',
                meeting_code: 'ABC123',
                created_by: 'test-user-id',
                status: 'active'
              },
              error: null
            })
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          then: vi.fn().mockResolvedValue({ data: [], error: null })
        };
      });
      
      render(<Dashboard onJoinMeeting={mockOnJoinMeeting} />);
      
      // Open create form
      await user.click(screen.getByText('Create New Meeting'));
      
      // Fill in meeting title
      const titleInput = screen.getByPlaceholderText(/Meeting title/);
      await user.type(titleInput, 'New Test Meeting');
      
      // Submit form
      await user.click(screen.getByText('Create & Join'));
      
      await waitFor(() => {
        expect(mockOnJoinMeeting).toHaveBeenCalledWith('ABC123');
      });
    });

    it('validates meeting title is required', async () => {
      const user = userEvent.setup();
      render(<Dashboard onJoinMeeting={mockOnJoinMeeting} />);
      
      // Open create form
      await user.click(screen.getByText('Create New Meeting'));
      
      // Try to submit without title
      const submitButton = screen.getByText('Create & Join');
      await user.click(submitButton);
      
      // Form should prevent submission due to HTML5 validation
      expect(mockOnJoinMeeting).not.toHaveBeenCalled();
    });
  });

  describe('Join Meeting', () => {
    it('allows joining with a meeting code', async () => {
      const user = userEvent.setup();
      render(<Dashboard onJoinMeeting={mockOnJoinMeeting} />);
      
      // Find join code input
      const codeInput = screen.getByPlaceholderText(/Enter meeting code/);
      await user.type(codeInput, 'test123');
      
      // Submit form
      await user.click(screen.getByRole('button', { name: 'Join Meeting' }));
      
      expect(mockOnJoinMeeting).toHaveBeenCalledWith('TEST123');
    });

    it('converts meeting code to uppercase', async () => {
      const user = userEvent.setup();
      render(<Dashboard onJoinMeeting={mockOnJoinMeeting} />);
      
      const codeInput = screen.getByPlaceholderText(/Enter meeting code/);
      
      await user.type(codeInput, 'abc123');
      expect(codeInput).toHaveValue('ABC123');
    });

    it('validates meeting code is required', async () => {
      const user = userEvent.setup();
      render(<Dashboard onJoinMeeting={mockOnJoinMeeting} />);
      
      // Try to submit without code
      const submitButton = screen.getByRole('button', { name: 'Join Meeting' });
      await user.click(submitButton);
      
      // Form should prevent submission due to HTML5 validation
      expect(mockOnJoinMeeting).not.toHaveBeenCalled();
    });
  });

  describe('Profile Management', () => {
    it('opens profile modal when profile button is clicked', async () => {
      const user = userEvent.setup();
      render(<Dashboard onJoinMeeting={mockOnJoinMeeting} />);
      
      await user.click(screen.getByTitle('Edit Profile'));
      
      expect(screen.getByTestId('user-profile-modal')).toBeInTheDocument();
    });

    it('closes profile modal', async () => {
      const user = userEvent.setup();
      render(<Dashboard onJoinMeeting={mockOnJoinMeeting} />);
      
      // Open profile modal
      await user.click(screen.getByTitle('Edit Profile'));
      expect(screen.getByTestId('user-profile-modal')).toBeInTheDocument();
      
      // Close profile modal
      await user.click(screen.getByText('Close Profile'));
      expect(screen.queryByTestId('user-profile-modal')).not.toBeInTheDocument();
    });
  });

  describe('Meeting List Display', () => {
    it('displays meetings when they exist', async () => {
      const { supabase } = require('../../lib/supabase');
      
      const mockMeetings = [
        {
          id: 'meeting-1',
          title: 'Sprint 1 Retro',
          meeting_code: 'ABC123',
          created_by: 'test-user-id',
          status: 'active',
          created_at: '2024-01-01T00:00:00.000Z',
          user_role: 'host'
        },
        {
          id: 'meeting-2',
          title: 'Sprint 2 Retro',
          meeting_code: 'DEF456',
          created_by: 'other-user-id',
          status: 'ended',
          created_at: '2024-01-02T00:00:00.000Z',
          ended_at: '2024-01-02T01:00:00.000Z',
          user_role: 'contributor'
        }
      ];
      
      // Mock meetings fetch to return test data
      supabase.from.mockImplementation((table: string) => {
        if (table === 'meetings') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            then: vi.fn().mockResolvedValue({
              data: mockMeetings,
              error: null
            })
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null })
        };
      });
      
      render(<Dashboard onJoinMeeting={mockOnJoinMeeting} />);
      
      await waitFor(() => {
        expect(screen.getByText('Sprint 1 Retro')).toBeInTheDocument();
        expect(screen.getByText('Sprint 2 Retro')).toBeInTheDocument();
      });
      
      // Check status badges
      expect(screen.getByText('Host')).toBeInTheDocument();
      expect(screen.getByText('Contributor')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Ended')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles authentication errors gracefully', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        signOut: vi.fn()
      });
      
      render(<Dashboard onJoinMeeting={mockOnJoinMeeting} />);
      
      // Should still render basic structure even without user
      expect(screen.getByText('Create Meeting')).toBeInTheDocument();
      expect(screen.getByText('Join Meeting')).toBeInTheDocument();
    });

    it('handles API errors when fetching meetings', async () => {
      const { supabase } = require('../../lib/supabase');
      
      supabase.from.mockImplementation((table: string) => {
        if (table === 'meetings') {
          return {
            select: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            then: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null })
        };
      });
      
      render(<Dashboard onJoinMeeting={mockOnJoinMeeting} />);
      
      // Should show empty state even with errors
      await waitFor(() => {
        expect(screen.getByText('No meetings yet')).toBeInTheDocument();
      });
    });
  });

  describe('Auto-expiration Info', () => {
    it('displays auto-expiration information banner', async () => {
      render(<Dashboard onJoinMeeting={mockOnJoinMeeting} />);
      
      await waitFor(() => {
        expect(screen.getByText(/Auto-Expiration:/)).toBeInTheDocument();
        expect(screen.getByText(/Active meetings automatically end after 2 hours/)).toBeInTheDocument();
      });
    });
  });
}); 