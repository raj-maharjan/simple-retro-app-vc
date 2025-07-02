import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Handle Google sign-in domain restriction (only in production)
      if (event === 'SIGNED_IN' && session?.user) {
        const email = session.user.email;
        const isGoogleProvider = session.user.app_metadata?.provider === 'google';
        
        // Check if we're in development environment
        const isDevelopment = import.meta.env.DEV || 
                             import.meta.env.VITE_NODE_ENV === 'development' ||
                             window.location.hostname === 'localhost' ||
                             window.location.hostname === '127.0.0.1';
        
        // If it's a Google sign-in and not from grepsr.com domain, sign them out (only in production)
        if (!isDevelopment && isGoogleProvider && email && !email.endsWith('@grepsr.com')) {
          await supabase.auth.signOut();
          alert('Access restricted: Only @grepsr.com email addresses are allowed to sign in with Google.');
          return;
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const getRedirectUrl = () => {
    // Check if we're in development
    // if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    //   return window.location.origin;
    // }
    
    // For production, use your Netlify domain
    // You can also use window.location.origin if you want it to be dynamic
    // but for OAuth consistency, a fixed production URL is often better
    return window.location.origin;
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    // Check if we're in development environment
    const isDevelopment = import.meta.env.DEV || 
                         import.meta.env.VITE_NODE_ENV === 'development' ||
                         window.location.hostname === 'localhost' ||
                         window.location.hostname === '127.0.0.1';

    // Prevent email/password signup in production
    if (!isDevelopment) {
      return { 
        error: { 
          message: 'Email/password sign up is disabled in production. Please use Google OAuth.',
          name: 'AuthError',
          status: 403
        } as AuthError 
      };
    }

    // Check domain restriction for email signup (skip in development)
    if (!isDevelopment && !email.endsWith('@grepsr.com')) {
      return { 
        error: { 
          message: 'Sign up is restricted to @grepsr.com email addresses only',
          name: 'AuthError',
          status: 400
        } as AuthError 
      };
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName || email.split('@')[0],
        },
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    // Check if we're in development environment
    const isDevelopment = import.meta.env.DEV || 
                         import.meta.env.VITE_NODE_ENV === 'development' ||
                         window.location.hostname === 'localhost' ||
                         window.location.hostname === '127.0.0.1';

    // Prevent email/password login in production
    if (!isDevelopment) {
      return { 
        error: { 
          message: 'Email/password authentication is disabled in production. Please use Google OAuth.',
          name: 'AuthError',
          status: 403
        } as AuthError 
      };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    console.log("redirecting to ", getRedirectUrl());
    
    // Check if we're in development environment
    const isDevelopment = import.meta.env.DEV || 
                         import.meta.env.VITE_NODE_ENV === 'development' ||
                         window.location.hostname === 'localhost' ||
                         window.location.hostname === '127.0.0.1';
    
    try {
      const oauthOptions: any = {
        redirectTo: getRedirectUrl(),
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      };
      
      // Only restrict domain in production
      if (!isDevelopment) {
        oauthOptions.queryParams.hd = 'grepsr.com';
      }
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: oauthOptions
      });
      
      return { error };
    } catch (err: any) {
      console.error('Google OAuth error:', err);
      return { 
        error: { 
          message: 'Google sign-in is currently unavailable. Please use email and password to sign in, or contact support if this issue persists.',
          name: 'AuthError',
          status: 400
        } as AuthError 
      };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}