import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthForm } from './components/AuthForm';
import { Dashboard } from './components/Dashboard';
import { MeetingBoard } from './components/MeetingBoard';

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
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;