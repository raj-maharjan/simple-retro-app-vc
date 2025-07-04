import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthForm } from '../AuthForm';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock AuthContext
const mockSignUp = vi.fn();
const mockSignIn = vi.fn();
const mockSignInWithGoogle = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    signUp: mockSignUp,
    signIn: mockSignIn,
    signInWithGoogle: mockSignInWithGoogle,
    loading: false,
    user: null,
  }),
}));

describe('AuthForm', () => {
  const mockOnToggleMode = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock development environment
    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost' },
      writable: true,
    });
  });

  describe('Sign In Mode', () => {
    it('renders sign in form correctly', () => {
      render(<AuthForm mode="signin" onToggleMode={mockOnToggleMode} />);
      
      expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    });

    it('submits sign in form with valid data', async () => {
      const user = userEvent.setup();
      mockSignIn.mockResolvedValue({ error: null });

      render(<AuthForm mode="signin" onToggleMode={mockOnToggleMode} />);
      
      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('shows toggle to sign up mode', async () => {
      const user = userEvent.setup();
      render(<AuthForm mode="signin" onToggleMode={mockOnToggleMode} />);
      
      await user.click(screen.getByRole('button', { name: /sign up/i }));
      expect(mockOnToggleMode).toHaveBeenCalled();
    });
  });

  describe('Sign Up Mode', () => {
    it('renders sign up form correctly in development', () => {
      render(<AuthForm mode="signup" onToggleMode={mockOnToggleMode} />);
      
      expect(screen.getByRole('heading', { name: /create account/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
      
      // Should not show restriction message in development
      expect(screen.queryByText(/sign up is restricted to @grepsr.com/i)).not.toBeInTheDocument();
    });

    it('submits sign up form with valid data in development', async () => {
      const user = userEvent.setup();
      mockSignUp.mockResolvedValue({ error: null });

      render(<AuthForm mode="signup" onToggleMode={mockOnToggleMode} />);
      
      await user.type(screen.getByLabelText(/display name/i), 'Test User');
      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith('test@example.com', 'password123', 'Test User');
      });
    });

    it('shows restriction message in production', () => {
      // Mock production environment
      Object.defineProperty(window, 'location', {
        value: { hostname: 'retro.grepsr.net' },
        writable: true,
      });

      render(<AuthForm mode="signup" onToggleMode={mockOnToggleMode} />);
      
      expect(screen.getByText(/sign up is restricted to @grepsr.com/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toHaveAttribute(
        'placeholder', 
        'Enter your @grepsr.com email'
      );
    });
  });

  describe('Google OAuth', () => {
    it('handles Google sign in', async () => {
      const user = userEvent.setup();
      mockSignInWithGoogle.mockResolvedValue({ error: null });

      render(<AuthForm mode="signin" onToggleMode={mockOnToggleMode} />);
      
      await user.click(screen.getByRole('button', { name: /continue with google/i }));

      expect(mockSignInWithGoogle).toHaveBeenCalled();
    });
  });

  describe('Form Validation', () => {
    it('prevents submission with empty fields', async () => {
      const user = userEvent.setup();
      render(<AuthForm mode="signin" onToggleMode={mockOnToggleMode} />);
      
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(mockSignIn).not.toHaveBeenCalled();
    });

    it('validates email format', async () => {
      const user = userEvent.setup();
      render(<AuthForm mode="signin" onToggleMode={mockOnToggleMode} />);
      
      const emailInput = screen.getByLabelText(/email address/i);
      await user.type(emailInput, 'invalid-email');
      
      expect(emailInput).toHaveValue('invalid-email');
      expect(emailInput).toBeInvalid();
    });

    it('enforces minimum password length', async () => {
      const user = userEvent.setup();
      render(<AuthForm mode="signup" onToggleMode={mockOnToggleMode} />);
      
      const passwordInput = screen.getByLabelText(/password/i);
      await user.type(passwordInput, '123');
      
      expect(passwordInput).toHaveValue('123');
      expect(passwordInput).toBeInvalid();
    });
  });

  describe('Password Visibility', () => {
    it('toggles password visibility', async () => {
      const user = userEvent.setup();
      render(<AuthForm mode="signin" onToggleMode={mockOnToggleMode} />);
      
      const passwordInput = screen.getByLabelText(/password/i);
      const toggleButton = screen.getByRole('button', { name: '' }); // Eye icon button
      
      expect(passwordInput).toHaveAttribute('type', 'password');
      
      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');
      
      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  describe('Error Handling', () => {
    it('displays authentication errors', async () => {
      const user = userEvent.setup();
      const mockError = { message: 'Invalid email or password' };
      mockSignIn.mockResolvedValue({ error: mockError });

      render(<AuthForm mode="signin" onToggleMode={mockOnToggleMode} />);
      
      await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
      await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading state during authentication', async () => {
      const user = userEvent.setup();
      
      // Mock AuthContext with loading state
      vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue({
        signIn: mockSignIn,
        signUp: mockSignUp,
        signInWithGoogle: mockSignInWithGoogle,
        loading: true,
        user: null,
      });

      render(<AuthForm mode="signin" onToggleMode={mockOnToggleMode} />);
      
      expect(screen.getByText(/signing in.../i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /signing in.../i })).toBeDisabled();
    });
  });
}); 