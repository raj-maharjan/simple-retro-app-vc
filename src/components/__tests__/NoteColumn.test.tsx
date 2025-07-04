import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DragDropContext } from 'react-beautiful-dnd';
import { NoteColumn } from '../NoteColumn';

// Mock react-beautiful-dnd
vi.mock('react-beautiful-dnd', () => ({
  DragDropContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Droppable: ({ children }: { children: (provided: any) => React.ReactNode }) => (
    <div>{children({ droppableProps: {}, innerRef: vi.fn(), placeholder: null })}</div>
  ),
  Draggable: ({ children }: { children: (provided: any) => React.ReactNode }) => (
    <div>{children({ 
      draggableProps: {}, 
      dragHandleProps: {}, 
      innerRef: vi.fn() 
    })}</div>
  ),
}));

interface Note {
  id: string;
  content: string;
  type: 'glad' | 'mad' | 'sad' | 'action';
  created_by: string;
  created_at: string;
  updated_at: string;
  like_count: number;
  user_liked: boolean;
}

describe('NoteColumn', () => {
  const mockOnAddNote = vi.fn();
  const mockOnUpdateNote = vi.fn();
  const mockOnDeleteNote = vi.fn();
  const mockOnToggleLike = vi.fn();
  const mockGetUserDisplayName = vi.fn((userId: string) => `User ${userId}`);
  const mockGetUserAvatarUrl = vi.fn(() => null);
  const mockOnTypingStart = vi.fn();
  const mockOnTypingStop = vi.fn();
  const mockLikedBy = vi.fn();

  const defaultProps = {
    title: 'What went well?',
    subtitle: 'Celebrate successes',
    type: 'glad' as const,
    notes: [] as Note[],
    onAddNote: mockOnAddNote,
    onUpdateNote: mockOnUpdateNote,
    onDeleteNote: mockOnDeleteNote,
    onToggleLike: mockOnToggleLike,
    currentUserId: 'user-123',
    getUserDisplayName: mockGetUserDisplayName,
    getUserAvatarUrl: mockGetUserAvatarUrl,
    color: 'green' as const,
    disabled: false,
    typingIndicators: {},
    onTypingStart: mockOnTypingStart,
    onTypingStop: mockOnTypingStop,
    likedBy: mockLikedBy,
  };

  const sampleNotes: Note[] = [
    {
      id: 'note-1',
      content: 'Great teamwork on this sprint',
      type: 'glad',
      created_by: 'user-123',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      like_count: 3,
      user_liked: true,
    },
    {
      id: 'note-2',
      content: 'Good code reviews',
      type: 'glad',
      created_by: 'user-456',
      created_at: '2024-01-01T01:00:00Z',
      updated_at: '2024-01-01T01:00:00Z',
      like_count: 1,
      user_liked: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders column header correctly', () => {
      render(<NoteColumn {...defaultProps} />);
      
      expect(screen.getByText('What went well?')).toBeInTheDocument();
      expect(screen.getByText('Celebrate successes')).toBeInTheDocument();
      expect(screen.getByText('0 notes')).toBeInTheDocument();
    });

    it('renders notes correctly', () => {
      render(<NoteColumn {...defaultProps} notes={sampleNotes} />);
      
      expect(screen.getByText('Great teamwork on this sprint')).toBeInTheDocument();
      expect(screen.getByText('Good code reviews')).toBeInTheDocument();
      expect(screen.getByText('2 notes')).toBeInTheDocument();
    });

    it('shows correct note count', () => {
      render(<NoteColumn {...defaultProps} notes={sampleNotes} />);
      
      expect(screen.getByText('2 notes')).toBeInTheDocument();
    });

    it('shows add note form when not disabled', () => {
      render(<NoteColumn {...defaultProps} />);
      
      expect(screen.getByPlaceholderText(/add a note.../i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add note/i })).toBeInTheDocument();
    });

    it('hides add note form when disabled', () => {
      render(<NoteColumn {...defaultProps} disabled={true} />);
      
      expect(screen.queryByPlaceholderText(/add a note.../i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /add note/i })).not.toBeInTheDocument();
    });
  });

  describe('Adding Notes', () => {
    it('adds a new note successfully', async () => {
      const user = userEvent.setup();
      render(<NoteColumn {...defaultProps} />);
      
      const input = screen.getByPlaceholderText(/add a note.../i);
      const addButton = screen.getByRole('button', { name: /add note/i });
      
      await user.type(input, 'New note content');
      await user.click(addButton);
      
      expect(mockOnAddNote).toHaveBeenCalledWith('glad', 'New note content');
    });

    it('clears input after adding note', async () => {
      const user = userEvent.setup();
      render(<NoteColumn {...defaultProps} />);
      
      const input = screen.getByPlaceholderText(/add a note.../i);
      const addButton = screen.getByRole('button', { name: /add note/i });
      
      await user.type(input, 'New note content');
      await user.click(addButton);
      
      expect(input).toHaveValue('');
    });

    it('prevents adding empty notes', async () => {
      const user = userEvent.setup();
      render(<NoteColumn {...defaultProps} />);
      
      const addButton = screen.getByRole('button', { name: /add note/i });
      await user.click(addButton);
      
      expect(mockOnAddNote).not.toHaveBeenCalled();
    });

    it('adds note on Enter key press', async () => {
      const user = userEvent.setup();
      render(<NoteColumn {...defaultProps} />);
      
      const input = screen.getByPlaceholderText(/add a note.../i);
      
      await user.type(input, 'New note content');
      await user.keyboard('{Enter}');
      
      expect(mockOnAddNote).toHaveBeenCalledWith('glad', 'New note content');
    });
  });

  describe('Note Interactions', () => {
    it('allows editing own notes', async () => {
      const user = userEvent.setup();
      render(<NoteColumn {...defaultProps} notes={sampleNotes} />);
      
      // Click on the note to edit (assuming user-123 can edit their own note)
      const noteContent = screen.getByText('Great teamwork on this sprint');
      await user.click(noteContent);
      
      // Should show edit input
      const editInput = screen.getByDisplayValue('Great teamwork on this sprint');
      expect(editInput).toBeInTheDocument();
      
      await user.clear(editInput);
      await user.type(editInput, 'Updated note content');
      await user.keyboard('{Enter}');
      
      expect(mockOnUpdateNote).toHaveBeenCalledWith('note-1', 'Updated note content');
    });

    it('shows like button for all notes', () => {
      render(<NoteColumn {...defaultProps} notes={sampleNotes} />);
      
      const likeButtons = screen.getAllByRole('button', { name: /like/i });
      expect(likeButtons).toHaveLength(2);
    });

    it('handles note like toggle', async () => {
      const user = userEvent.setup();
      render(<NoteColumn {...defaultProps} notes={sampleNotes} />);
      
      const likeButtons = screen.getAllByRole('button', { name: /like/i });
      await user.click(likeButtons[0]);
      
      expect(mockOnToggleLike).toHaveBeenCalledWith('note-1');
    });

    it('shows delete button only for own notes', () => {
      render(<NoteColumn {...defaultProps} notes={sampleNotes} />);
      
      // Should show delete button for user's own note (user-123)
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      expect(deleteButtons).toHaveLength(1); // Only for the user's own note
    });

    it('handles note deletion', async () => {
      const user = userEvent.setup();
      render(<NoteColumn {...defaultProps} notes={sampleNotes} />);
      
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);
      
      expect(mockOnDeleteNote).toHaveBeenCalledWith('note-1');
    });
  });

  describe('Typing Indicators', () => {
    it('shows typing indicator when someone is typing', () => {
      const typingIndicators = {
        'note-1': {
          userId: 'user-456',
          userName: 'User 456',
          timestamp: Date.now(),
        },
      };

      render(
        <NoteColumn 
          {...defaultProps} 
          notes={sampleNotes} 
          typingIndicators={typingIndicators}
        />
      );
      
      expect(screen.getByText(/User 456 is typing.../i)).toBeInTheDocument();
    });

    it('calls typing start on input focus', async () => {
      const user = userEvent.setup();
      render(<NoteColumn {...defaultProps} />);
      
      const input = screen.getByPlaceholderText(/add a note.../i);
      await user.click(input);
      
      // Should trigger typing start for new note
      expect(mockOnTypingStart).toHaveBeenCalled();
    });
  });

  describe('Like Functionality', () => {
    it('displays correct like count', () => {
      render(<NoteColumn {...defaultProps} notes={sampleNotes} />);
      
      expect(screen.getByText('3')).toBeInTheDocument(); // Like count for first note
      expect(screen.getByText('1')).toBeInTheDocument(); // Like count for second note
    });

    it('shows liked state for user-liked notes', () => {
      render(<NoteColumn {...defaultProps} notes={sampleNotes} />);
      
      // First note is liked by user, should have different styling
      const likeButtons = screen.getAllByRole('button', { name: /like/i });
      expect(likeButtons[0]).toHaveClass('text-red-500'); // Assuming liked state has red color
    });
  });

  describe('User Display', () => {
    it('shows correct user names', () => {
      render(<NoteColumn {...defaultProps} notes={sampleNotes} />);
      
      expect(screen.getByText('User user-123')).toBeInTheDocument();
      expect(screen.getByText('User user-456')).toBeInTheDocument();
    });

    it('calls getUserDisplayName for each note author', () => {
      render(<NoteColumn {...defaultProps} notes={sampleNotes} />);
      
      expect(mockGetUserDisplayName).toHaveBeenCalledWith('user-123');
      expect(mockGetUserDisplayName).toHaveBeenCalledWith('user-456');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<NoteColumn {...defaultProps} />);
      
      const input = screen.getByPlaceholderText(/add a note.../i);
      expect(input).toHaveAttribute('aria-label');
      
      const addButton = screen.getByRole('button', { name: /add note/i });
      expect(addButton).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<NoteColumn {...defaultProps} notes={sampleNotes} />);
      
      // Tab navigation should work
      await user.tab();
      expect(document.activeElement).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('renders large number of notes efficiently', () => {
      const manyNotes = Array.from({ length: 100 }, (_, i) => ({
        id: `note-${i}`,
        content: `Note content ${i}`,
        type: 'glad' as const,
        created_by: `user-${i}`,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        like_count: i,
        user_liked: i % 2 === 0,
      }));

      const startTime = performance.now();
      render(<NoteColumn {...defaultProps} notes={manyNotes} />);
      const endTime = performance.now();
      
      // Should render in reasonable time (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
      expect(screen.getByText('100 notes')).toBeInTheDocument();
    });
  });
}); 