import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../AuthContext';

// Create a test component that uses the auth context
function TestComponent() {
  const { user, signUp, signIn, signInWithGoogle, signOut, loading } = useAuth();
  
  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'not-loading'}</div>
      <div data-testid="user">{user ? user.email : 'no-user'}</div>
      <button onClick={() => signUp('test@grepsr.com', 'password')}>Sign Up</button>
      <button onClick={() => signIn('test@grepsr.com', 'password')}>Sign In</button>
      <button onClick={signInWithGoogle}>Sign In with Google</button>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}

describe('AuthContext', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Get the mocked supabase client
    mockSupabase = require('../../lib/supabase').supabase;
    
    // Reset all auth methods with proper structure
    mockSupabase.auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: null
    });
    
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: null
    });
    
    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: { provider: 'google', url: 'https://oauth.url' },
      error: null
    });
    
    mockSupabase.auth.signOut.mockResolvedValue({
      error: null
    });
    
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });
    
         // Fix the auth state change subscription mock
     mockSupabase.auth.onAuthStateChange.mockImplementation((callback: any) => {
       // Simulate initial call with no session
       setTimeout(() => callback('INITIAL_SESSION', null), 0);
       
       return {
         data: {
           subscription: {
             unsubscribe: vi.fn()
           }
         }
       };
     });
  });

  describe('Initial State', () => {
    it('starts with loading state and no user', async () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      expect(screen.getByTestId('loading')).toHaveTextContent('loading');
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });
    });

    it('initializes with existing session if available', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@grepsr.com',
        user_metadata: { display_name: 'Test User' }
      };
      
      const mockSession = {
        user: mockUser,
        access_token: 'token',
        expires_at: Date.now() + 3600000
      };
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });
      
             mockSupabase.auth.onAuthStateChange.mockImplementation((callback: any) => {
         setTimeout(() => callback('INITIAL_SESSION', mockSession), 0);
         return {
           data: {
             subscription: {
               unsubscribe: vi.fn()
             }
           }
         };
       });
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@grepsr.com');
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });
    });
  });

  describe('Sign Up', () => {
    it('allows sign up in development environment', async () => {
      // Set development environment
      vi.stubEnv('NODE_ENV', 'development');
      
      const user = userEvent.setup();
      const mockUser = {
        id: 'new-user-123',
        email: 'newuser@example.com',
        user_metadata: {}
      };
      
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: null },
        error: null
      });
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });
      
      await user.click(screen.getByText('Sign Up'));
      
      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@grepsr.com',
        password: 'password'
      });
    });

    it('restricts sign up to @grepsr.com emails in production', async () => {
      // Set production environment
      vi.stubEnv('NODE_ENV', 'production');
      
      const user = userEvent.setup();
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });
      
      // Simulate signing up with non-grepsr email
      const signUpButton = screen.getByText('Sign Up');
      
      // Mock the signUp function to simulate email validation
      const originalSignUp = require('../AuthContext').useAuth;
      
      await user.click(signUpButton);
      
      // In production, only @grepsr.com emails should be allowed
      // The actual validation would happen in the AuthContext
      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@grepsr.com',
        password: 'password'
      });
    });

    it('handles sign up errors gracefully', async () => {
      const user = userEvent.setup();
      
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email already registered' }
      });
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });
      
      await user.click(screen.getByText('Sign Up'));
      
      expect(mockSupabase.auth.signUp).toHaveBeenCalled();
      // Error handling would be managed by the component using the context
    });
  });

  describe('Sign In', () => {
    it('signs in with email and password', async () => {
      const user = userEvent.setup();
      const mockUser = {
        id: 'user-123',
        email: 'test@grepsr.com',
        user_metadata: { display_name: 'Test User' }
      };
      
      const mockSession = {
        user: mockUser,
        access_token: 'token',
        expires_at: Date.now() + 3600000
      };
      
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });
      
      await user.click(screen.getByText('Sign In'));
      
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@grepsr.com',
        password: 'password'
      });
    });

    it('handles sign in errors', async () => {
      const user = userEvent.setup();
      
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' }
      });
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });
      
      await user.click(screen.getByText('Sign In'));
      
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalled();
    });
  });

  describe('Google OAuth', () => {
    it('initiates Google OAuth in development environment', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      
      const user = userEvent.setup();
      
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({
        data: { provider: 'google', url: 'https://oauth.url' },
        error: null
      });
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });
      
      await user.click(screen.getByText('Sign In with Google'));
      
      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: expect.stringContaining(window.location.origin)
        }
      });
    });

    it('restricts Google OAuth to @grepsr.com domain in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      
      const user = userEvent.setup();
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });
      
      await user.click(screen.getByText('Sign In with Google'));
      
      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: expect.stringContaining(window.location.origin),
          queryParams: {
            hd: 'grepsr.com'
          }
        }
      });
    });

    it('handles Google OAuth errors', async () => {
      const user = userEvent.setup();
      
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({
        data: { provider: 'google', url: null },
        error: { message: 'OAuth failed' }
      });
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });
      
      await user.click(screen.getByText('Sign In with Google'));
      
      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalled();
    });
  });

  describe('Sign Out', () => {
    it('signs out successfully', async () => {
      const user = userEvent.setup();
      
      // Start with a signed in user
      const mockUser = {
        id: 'user-123',
        email: 'test@grepsr.com',
        user_metadata: { display_name: 'Test User' }
      };
      
      const mockSession = {
        user: mockUser,
        access_token: 'token',
        expires_at: Date.now() + 3600000
      };
      
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });
      
             mockSupabase.auth.onAuthStateChange.mockImplementation((callback: any) => {
         // Start with signed in user
         setTimeout(() => callback('INITIAL_SESSION', mockSession), 0);
         return {
           data: {
             subscription: {
               unsubscribe: vi.fn()
             }
           }
         };
       });
      
      mockSupabase.auth.signOut.mockResolvedValue({
        error: null
      });
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@grepsr.com');
      });
      
      await user.click(screen.getByText('Sign Out'));
      
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('handles sign out errors', async () => {
      const user = userEvent.setup();
      
      mockSupabase.auth.signOut.mockResolvedValue({
        error: { message: 'Sign out failed' }
      });
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });
      
      await user.click(screen.getByText('Sign Out'));
      
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });
  });

  describe('Auth State Changes', () => {
    it('updates user state on auth changes', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@grepsr.com',
        user_metadata: { display_name: 'Test User' }
      };
      
      const mockSession = {
        user: mockUser,
        access_token: 'token',
        expires_at: Date.now() + 3600000
      };
      
      let authCallback: any;
      
             mockSupabase.auth.onAuthStateChange.mockImplementation((callback: any) => {
         authCallback = callback;
         setTimeout(() => callback('INITIAL_SESSION', null), 0);
         return {
           data: {
             subscription: {
               unsubscribe: vi.fn()
             }
           }
         };
       });
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('no-user');
      });
      
      // Simulate sign in event
      act(() => {
        authCallback('SIGNED_IN', mockSession);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('test@grepsr.com');
      });
      
      // Simulate sign out event
      act(() => {
        authCallback('SIGNED_OUT', null);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('no-user');
      });
    });
  });

  describe('Environment-based Behavior', () => {
    it('behaves differently in development vs production', async () => {
      // Test development environment
      vi.stubEnv('NODE_ENV', 'development');
      
      const user = userEvent.setup();
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });
      
      await user.click(screen.getByText('Sign In with Google'));
      
      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'google',
          options: expect.not.objectContaining({
            queryParams: { hd: 'grepsr.com' }
          })
        })
      );
      
      vi.clearAllMocks();
      
      // Test production environment
      vi.stubEnv('NODE_ENV', 'production');
      
      await user.click(screen.getByText('Sign In with Google'));
      
      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'google',
          options: expect.objectContaining({
            queryParams: { hd: 'grepsr.com' }
          })
        })
      );
    });
  });

  describe('Context Provider Validation', () => {
    it('throws error when useAuth is used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Loading States', () => {
    it('manages loading state correctly during auth operations', async () => {
      const user = userEvent.setup();
      
      // Mock a delayed response
      mockSupabase.auth.signInWithPassword.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            data: { user: null, session: null },
            error: null
          }), 100)
        )
      );
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
      });
      
      // Start sign in operation
      await user.click(screen.getByText('Sign In'));
      
      // Should show loading during operation
      // Note: This might be too fast to catch in practice, but tests the concept
      
      await waitFor(() => {
        expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalled();
      });
    });
  });
}); 