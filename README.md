# 🎯 Retrospective Meeting App

A modern, real-time collaborative retrospective meeting platform built with React, TypeScript, and Supabase. Create engaging retrospective sessions with your team, add notes, collaborate in real-time, and automatically generate meeting summaries.

![Live Demo](https://snazzy-salamander-804858.netlify.app)

## ✨ Features

### 🔄 Real-time Collaboration
- **Live editing**: See team members typing in real-time
- **Instant updates**: Notes appear immediately for all participants
- **Live participant tracking**: Know who's currently active in the meeting
- **Drag & drop**: Move notes between categories collaboratively

### 📝 Meeting Management
- **Easy meeting creation**: Generate unique meeting codes instantly
- **Join with codes**: Simple 6-character codes for quick access
- **Auto-expiration**: Meetings automatically end after 2 hours
- **Meeting history**: Track all your past and active meetings
- **Host controls**: End meetings and manage participants

### 📋 Note Categories
- **What went well?** (Glad) - Celebrate successes
- **What didn't go well?** (Mad) - Identify problems
- **What could we do differently?** (Sad) - Lessons learned
- **Action Items** (Action) - Next steps and commitments

### 👥 User Management
- **Google OAuth**: Secure authentication
- **User profiles**: Customizable display names and avatars
- **Role-based access**: Host and contributor permissions
- **Contributors tracking**: See who participated in each meeting

### 📧 Communication
- **Email invitations**: Send meeting invites with direct links
- **Meeting summaries**: Automatically email detailed reports
- **CSV exports**: Download meeting data for analysis
- **Notification system**: Real-time status updates

### 🎨 Rich Content
- **Emoji support**: Express emotions with emojis
- **Image uploads**: Add screenshots and diagrams
- **Markdown links**: Clickable URLs in notes
- **Like system**: Vote on important notes

## 🛠 Tech Stack

### Frontend
- **React 18** - Modern UI library
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **React Beautiful DnD** - Drag and drop functionality
- **Lucide React** - Beautiful icons

### Backend
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Real-time subscriptions
  - Authentication (Google OAuth)
  - Row Level Security (RLS)
  - Edge Functions
  - File storage

### Email & Deployment
- **Resend API** - Transactional emails
- **Netlify** - Static site hosting
- **Netlify Functions** - Serverless functions

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- Resend account (for emails)
- Google Cloud Console project (for OAuth)

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd grepsr-retro
npm install
```

### 2. Set Up Supabase
1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings → API
3. Copy your project URL and anon key

### 3. Configure Environment Variables
Create a `.env.local` file:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_NODE_ENV=development
```

### 4. Set Up Database
```bash
# Install Supabase CLI
npm install -g @supabase/cli

# Link to your project
npx supabase link --project-ref your_project_ref

# Run migrations
npx supabase db push
```

### 5. Configure Authentication
1. In Supabase Dashboard → Authentication → Providers
2. Enable Google OAuth
3. Add your domain to redirect URLs:
   - `http://localhost:5173` (development)
   - `https://your-domain.com` (production)

### 6. Set Up Email Service
1. Create account at [resend.com](https://resend.com)
2. Get your API key
3. Add to Supabase Edge Function environment variables:
```bash
npx supabase secrets set RESEND_API_KEY=your_resend_api_key
```

### 7. Deploy Edge Functions
```bash
npx supabase functions deploy send-meeting-summary
npx supabase functions deploy send-meeting-invitations
```

### 8. Start Development
```bash
npm run dev
```

Visit `http://localhost:5173` to see your app!

## 📦 Deployment

### Netlify Deployment
1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variables in Netlify dashboard
5. Deploy!

### Environment Variables for Production
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_NODE_ENV=production
```

## 📖 Usage Guide

### Creating a Meeting
1. Click "Create Meeting" on the dashboard
2. Enter a descriptive title
3. Share the generated meeting code with participants
4. Start collaborating!

### Joining a Meeting
1. Use "Join Meeting" with a meeting code, OR
2. Click an invitation link from email

### Adding Notes
1. Click "Add" button in any column
2. Type your note (supports emojis and images)
3. Press Enter to save
4. Drag notes between columns as needed

### Managing Meetings
- **Host**: Can end meetings and send summaries
- **Contributors**: Can add, edit, and like notes
- **Everyone**: Can export data and invite others

## 🏗 Project Structure

```
src/
├── components/          # React components
│   ├── AuthForm.tsx    # Authentication UI
│   ├── Dashboard.tsx   # Main dashboard
│   ├── MeetingBoard.tsx # Meeting interface
│   ├── NoteColumn.tsx  # Note column component
│   ├── InviteModal.tsx # Invitation system
│   └── ...
├── contexts/           # React contexts
│   └── AuthContext.tsx # Authentication state
├── lib/               # Utilities and services
│   ├── supabase.ts    # Supabase client
│   └── emailService.ts # Email functionality
└── ...

supabase/
├── migrations/        # Database schema
├── functions/         # Edge functions
│   ├── send-meeting-summary/
│   └── send-meeting-invitations/
└── config.toml       # Supabase configuration
```

## 🔧 Key Features Implementation

### Real-time Updates
- Uses Supabase real-time subscriptions
- Optimistic UI updates for better UX
- Presence tracking for active users

### Security
- Row Level Security (RLS) policies
- User-based data isolation
- Secure authentication with Google OAuth

### Performance
- Efficient React patterns
- Optimized database queries
- CDN deployment with Netlify

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Supabase** - For the amazing backend platform
- **Resend** - For reliable email delivery
- **Netlify** - For seamless deployment
- **React Beautiful DnD** - For smooth drag & drop

## 📞 Support

For questions or support:
- Create an issue in this repository
- Contact: raj.maharjan98@gmail.com

---

**Built with ❤️ for better team retrospectives** 