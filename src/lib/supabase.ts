import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Database = {
  public: {
    Tables: {
      meetings: {
        Row: {
          id: string;
          title: string;
          meeting_code: string;
          created_by: string;
          created_at: string;
          updated_at: string;
          status: 'active' | 'ended';
          ended_at: string | null;
          ended_by: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          meeting_code: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          status?: 'active' | 'ended';
          ended_at?: string | null;
          ended_by?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          meeting_code?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          status?: 'active' | 'ended';
          ended_at?: string | null;
          ended_by?: string | null;
        };
      };
      notes: {
        Row: {
          id: string;
          meeting_id: string;
          content: string;
          type: 'glad' | 'mad' | 'sad' | 'action';
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          meeting_id: string;
          content: string;
          type: 'glad' | 'mad' | 'sad' | 'action';
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          meeting_id?: string;
          content?: string;
          type?: 'glad' | 'mad' | 'sad' | 'action';
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          display_name: string | null;
          email: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};