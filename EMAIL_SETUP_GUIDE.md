# 📧 Email Notification System Setup Guide

This guide will help you set up the automatic email notification system that sends meeting summaries with CSV attachments to all participants when a meeting ends.

## 🚀 Overview

When a meeting ends (either manually by the host or automatically after 2 hours), the system will:
- ✅ Send a beautiful HTML email to all participants
- ✅ Include meeting details (title, code, host, duration, participants)
- ✅ Attach a CSV file with all meeting notes
- ✅ Show statistics (notes count, likes, duration)
- ✅ Work for both manual and automatic meeting endings

## 📋 Prerequisites

1. **Supabase Project**: You need an active Supabase project
2. **Resend Account**: Free account at [resend.com](https://resend.com) (free tier allows 3,000 emails/month)
3. **Domain**: Optional but recommended for professional emails

## 🔧 Step 1: Set Up Resend Account

1. **Create Account**:
   - Go to [resend.com](https://resend.com)
   - Sign up for a free account
   - Verify your email address

2. **Get API Key**:
   - Go to [API Keys](https://resend.com/api-keys) in your Resend dashboard
   - Click "Create API Key"
   - Name it "Retrospective App"
   - Copy the API key (starts with `re_`)

3. **Add Domain (Optional but Recommended)**:
   - Go to [Domains](https://resend.com/domains)
   - Add your domain and verify DNS records
   - This allows sending from `noreply@yourdomain.com` instead of generic addresses

## 🚀 Step 2: Deploy the Edge Function

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link Your Project**:
   ```bash
   supabase link --project-ref YOUR_PROJECT_ID
   ```

4. **Deploy the Edge Function**:
   ```bash
   supabase functions deploy send-meeting-summary
   ```

## 🔐 Step 3: Set Environment Variables

You need to set the Resend API key as a secret in your Supabase project:

1. **Using Supabase CLI**:
   ```bash
   supabase secrets set RESEND_API_KEY=re_your_api_key_here
   ```

2. **Or via Supabase Dashboard**:
   - Go to your project dashboard
   - Navigate to **Settings** → **Edge Functions**
   - Add a new secret:
     - Name: `RESEND_API_KEY`
     - Value: Your Resend API key

## 🗄️ Step 4: Set Up Storage Buckets

Run these SQL scripts in your Supabase SQL Editor:

### 4.1 Note Images Storage (if not already set up)
Copy and run the contents of `supabase/setup_note_images_storage.sql`:

```sql
-- Note Images Storage Setup Script
-- Run this in your Supabase SQL Editor to set up note image uploads

-- First, create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('note-images', 'note-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the note-images bucket
-- [Full script content in the file]
```

## 🧪 Step 5: Test the System

1. **Create a Test Meeting**:
   - Create a new retrospective meeting
   - Add some notes with different participants
   - Add likes to some notes

2. **End the Meeting**:
   - Click "End Meeting" button
   - Confirm the action
   - You should see a success message indicating emails were sent

3. **Check Email**:
   - All participants should receive an email with:
     - Meeting summary
     - CSV attachment with notes
     - Professional HTML formatting

## 📊 Email Content

The emails will include:

### Meeting Details
- Meeting title and code
- Host name
- Start and end times
- How the meeting was ended (by host or auto-expired)

### Statistics
- Number of participants
- Total notes created
- Total likes given
- Meeting duration

### Participants List
- Names of all meeting participants

### CSV Attachment
- Complete export of all meeting notes
- Same format as the manual CSV download
- Can be opened in Excel, Google Sheets, etc.

## 🔧 Customization Options

### Change Email Sender
In `supabase/functions/send-meeting-summary/index.ts`, update the `from` field:

```typescript
from: 'Your Team <noreply@yourdomain.com>',
```

### Customize Email Template
The HTML email template is in the edge function. You can modify:
- Colors and styling
- Content structure
- Company branding
- Footer information

### Add More Data
You can extend the email to include:
- Meeting categories/tags
- Note attachments/images
- Action item summaries
- Meeting analytics

## 🚨 Troubleshooting

### Common Issues

1. **"RESEND_API_KEY not configured"**:
   - Ensure you've set the secret correctly
   - Redeploy the edge function after setting secrets

2. **"Failed to send emails"**:
   - Check your Resend account limits
   - Verify API key is valid
   - Check Supabase function logs

3. **No emails received**:
   - Check spam/junk folders
   - Verify participant email addresses in user profiles
   - Check Resend dashboard for delivery status

4. **Permission errors**:
   - Ensure storage buckets are set up correctly
   - Verify RLS policies are active

### Debugging

1. **Check Function Logs**:
   ```bash
   supabase functions logs send-meeting-summary
   ```

2. **Check Browser Console**:
   - Look for email service related errors
   - Check for network issues

3. **Test Edge Function Directly**:
   ```bash
   supabase functions invoke send-meeting-summary --data @test-payload.json
   ```

## 💰 Cost Considerations

### Resend Pricing (as of 2024)
- **Free Tier**: 3,000 emails/month, 100 emails/day
- **Pro Tier**: $20/month for 50,000 emails
- **Business Tier**: $85/month for 200,000 emails

### Typical Usage
- Small team (5-10 people): ~50-100 emails/month
- Medium team (20-30 people): ~200-500 emails/month
- Large organization: Consider business tier

## 🔒 Security Notes

- ✅ Emails are only sent to authenticated participants
- ✅ Meeting data is only included for users who participated
- ✅ API keys are stored securely as Supabase secrets
- ✅ Edge function validates user authentication
- ✅ No sensitive data is logged in email service

## 📝 Next Steps

After setup is complete:

1. **Inform Your Team**: Let participants know they'll receive automatic meeting summaries
2. **Monitor Usage**: Keep an eye on Resend usage and Supabase function invocations
3. **Customize Branding**: Update the email template with your organization's branding
4. **Set Up Monitoring**: Consider adding error tracking for production use

## 🎉 Success!

You should now have a fully functional email notification system that automatically sends meeting summaries to all participants when meetings end. The system works for both manual and automatic meeting endings, ensuring no retrospective data is lost and all participants stay informed.

For any issues or questions, check the troubleshooting section above or review the function logs for detailed error information. 