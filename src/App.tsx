import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthForm } from './components/AuthForm';
import { Dashboard } from './components/Dashboard';
import { MeetingBoard } from './components/MeetingBoard';
import { supabase } from './lib/supabase';

// Function to check for expired meetings on app startup
const checkExpiredMeetingsOnStartup = async () => {
  try {
    console.log('🚀 App startup: Checking for expired meetings...');
    
    // Get all active meetings older than 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    
    const { data: expiredMeetings, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('status', 'active')
      .lt('created_at', twoHoursAgo);

    if (error) {
      console.error('❌ App startup error checking expired meetings:', error);
      return;
    }

    if (expiredMeetings && expiredMeetings.length > 0) {
      console.log(`⏰ App startup: Found ${expiredMeetings.length} expired meetings, auto-ending them...`);
      
      // Auto-end expired meetings
      for (const meeting of expiredMeetings) {
        console.log(`📝 Auto-ending meeting: ${meeting.title} (${meeting.meeting_code})`);
        
        const { error: updateError } = await supabase
          .from('meetings')
          .update({
            status: 'ended',
            ended_at: new Date().toISOString(),
            ended_by: null, // null indicates auto-ended
          })
          .eq('id', meeting.id);

        if (updateError) {
          console.error(`❌ Failed to auto-end meeting ${meeting.meeting_code}:`, updateError);
        } else {
          console.log(`✅ Auto-ended meeting ${meeting.meeting_code}`);
        }
      }
    } else {
      console.log('✅ App startup: No expired meetings found');
    }
  } catch (err) {
    console.error('💥 App startup error in checkExpiredMeetingsOnStartup:', err);
  }
};

function AppContent() {
  const { user, loading } = useAuth();
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [currentView, setCurrentView] = useState<'dashboard' | 'meeting'>('dashboard');
  const [currentMeetingCode, setCurrentMeetingCode] = useState<string>('');

  useEffect(() => {
    // Check for meeting code in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const meetingCode = urlParams.get('meeting');
    
    if (meetingCode && user) {
      setCurrentMeetingCode(meetingCode);
      setCurrentView('meeting');
    }
  }, [user]);

  const handleJoinMeeting = (meetingCode: string) => {
    setCurrentMeetingCode(meetingCode);
    setCurrentView('meeting');
    
    // Update URL without page reload
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('meeting', meetingCode);
    window.history.pushState({}, '', newUrl.toString());
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setCurrentMeetingCode('');
    
    // Clear URL params
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('meeting');
    window.history.pushState({}, '', newUrl.toString());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthForm
        mode={authMode}
        onToggleMode={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
      />
    );
  }

  if (currentView === 'meeting' && currentMeetingCode) {
    return (
      <MeetingBoard
        meetingCode={currentMeetingCode}
        onBack={handleBackToDashboard}
      />
    );
  }

  return <Dashboard onJoinMeeting={handleJoinMeeting} />;
}

function App() {
  useEffect(() => {
    // Check for expired meetings when the app starts (page load)
    checkExpiredMeetingsOnStartup();
  }, []);

  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;