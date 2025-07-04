import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
  writable: true,
});

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
    getRandomValues: vi.fn((arr) => arr.map(() => Math.floor(Math.random() * 256))),
  },
  writable: true,
});

// Enhanced Supabase mock
const mockSupabaseClient = {
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn().mockResolvedValue({
      data: { session: { access_token: 'mock-token', user: { id: 'test-user-id' } } },
      error: null
    }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    })
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    // Add count support for note_likes
    then: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 })
  })),
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockResolvedValue('SUBSCRIBED'),
    track: vi.fn(),
    send: vi.fn(),
    presenceState: vi.fn().mockReturnValue({}),
    unsubscribe: vi.fn()
  })),
  removeChannel: vi.fn(),
  functions: {
    invoke: vi.fn().mockResolvedValue({
      data: { success: true, emailsSent: 1, totalParticipants: 1 },
      error: null
    })
  },
  realtime: true
};

vi.mock('../lib/supabase', () => ({
  supabase: mockSupabaseClient
}));

// Enhanced React Beautiful DnD mock
vi.mock('react-beautiful-dnd', () => ({
  DragDropContext: ({ children, onDragEnd }: any) => children,
  Droppable: ({ children }: any) => children({
    draggableProps: {},
    dragHandleProps: {},
    innerRef: vi.fn(),
    placeholder: null,
    snapshot: {
      isDraggingOver: false,
      draggingOverWith: null,
      draggingFromThisWith: null,
      isUsingPlaceholder: false
    }
  }, {
    isDraggingOver: false,
    draggingOverWith: null,
    draggingFromThisWith: null,
    isUsingPlaceholder: false
  }),
  Draggable: ({ children }: any) => children({
    draggableProps: {
      style: {},
      'data-rbd-draggable-context-id': 'test',
      'data-rbd-draggable-id': 'test'
    },
    dragHandleProps: {
      'data-rbd-drag-handle-draggable-id': 'test',
      'data-rbd-drag-handle-context-id': 'test',
      'aria-describedby': 'test',
      tabIndex: 0,
      draggable: false,
      onDragStart: vi.fn()
    },
    innerRef: vi.fn(),
    placeholder: null,
    snapshot: {
      isDragging: false,
      isDropAnimating: false,
      dropAnimation: null,
      draggingOver: null,
      combineWith: null,
      combineTargetFor: null,
      mode: null
    }
  }, {
    isDragging: false,
    isDropAnimating: false
  })
}));

// Add URL mock for CSV export functionality
global.URL.createObjectURL = vi.fn(() => 'mock-blob-url');
global.URL.revokeObjectURL = vi.fn();

// Mock environment variables
vi.stubEnv('NODE_ENV', 'development');
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key'); 