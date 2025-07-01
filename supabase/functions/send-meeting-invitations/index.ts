import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InvitationPayload {
  meeting_title: string;
  meeting_code?: string;
  meeting_url: string;
  inviter_name: string;
  inviter_email: string;
  invitee_emails: string[];
  invitation_message: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the request is authenticated
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Parse the request body
    const payload: InvitationPayload = await req.json()

    // Get Resend API key from environment
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured')
    }

    // Create email content
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>You're Invited to Join ${payload.meeting_title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 30px; }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 10px 0 0 0; opacity: 0.9; }
          .invitation-card { background: #f8f9fa; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
          .invitation-card h2 { margin: 0 0 15px 0; color: #667eea; font-size: 18px; }
          .meeting-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e9ecef; }
          .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f1f3f4; }
          .detail-row:last-child { border-bottom: none; }
          .detail-label { font-weight: bold; color: #495057; }
          .detail-value { color: #212529; }
          .cta-section { text-align: center; margin: 30px 0; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; transition: transform 0.2s; }
          .cta-button:hover { transform: translateY(-2px); }
          .meeting-code { background: #e3f2fd; color: #1976d2; padding: 10px 15px; border-radius: 6px; font-family: monospace; font-size: 18px; font-weight: bold; letter-spacing: 2px; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; color: #6c757d; font-size: 12px; border-top: 1px solid #e9ecef; margin-top: 30px; }
          .info-box { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .info-box strong { color: #856404; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎉 You're Invited!</h1>
          <p>Join us for a retrospective meeting</p>
        </div>

        <div class="invitation-card">
          <h2>💌 Personal Invitation</h2>
          <p>Hi there!</p>
          <p><strong>${payload.inviter_name}</strong> has invited you to join a retrospective meeting:</p>
          <p style="font-style: italic; margin: 15px 0; padding: 15px; background: white; border-radius: 6px;">
            "${payload.invitation_message}"
          </p>
        </div>

        ${payload.meeting_code ? `
        <div class="meeting-details">
          <h2>📋 Meeting Details</h2>
          <div class="detail-row">
            <span class="detail-label">Meeting Title:</span>
            <span class="detail-value">${payload.meeting_title}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Meeting Code:</span>
            <span class="detail-value">
              <div class="meeting-code">${payload.meeting_code}</div>
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Invited By:</span>
            <span class="detail-value">${payload.inviter_name} (${payload.inviter_email})</span>
          </div>
        </div>
        ` : `
        <div class="meeting-details">
          <h2>📋 Invitation Details</h2>
          <div class="detail-row">
            <span class="detail-label">Platform:</span>
            <span class="detail-value">Retrospective Meeting System</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Invited By:</span>
            <span class="detail-value">${payload.inviter_name} (${payload.inviter_email})</span>
          </div>
        </div>
        `}

        <div class="cta-section">
          <a href="${payload.meeting_url}" class="cta-button">
            ${payload.meeting_code ? '🚀 Join Meeting Now' : '🚀 Get Started'}
          </a>
        </div>

        ${payload.meeting_code ? `
        <div class="info-box">
          <strong>💡 How to Join:</strong>
          <ol>
            <li>Click the "Join Meeting Now" button above</li>
            <li>Or visit the retrospective platform and enter meeting code: <strong>${payload.meeting_code}</strong></li>
            <li>Sign in with your Google account or create an account</li>
            <li>Start collaborating with your team!</li>
          </ol>
        </div>
        ` : `
        <div class="info-box">
          <strong>💡 Getting Started:</strong>
          <ol>
            <li>Click the "Get Started" button above</li>
            <li>Sign in with your Google account or create an account</li>
            <li>Create or join retrospective meetings</li>
            <li>Collaborate with your team in real-time!</li>
          </ol>
        </div>
        `}

        <div class="footer">
          <p>This invitation was sent via the Retrospective Meeting System</p>
          <p>If you're having trouble with the button above, copy and paste this URL into your browser:</p>
          <p style="word-break: break-all; color: #667eea;">${payload.meeting_url}</p>
        </div>
      </body>
      </html>
    `

    const emailText = `
You're Invited to Join: ${payload.meeting_title}

${payload.inviter_name} has invited you to join a retrospective meeting.

${payload.invitation_message}

${payload.meeting_code ? `
Meeting Details:
- Title: ${payload.meeting_title}
- Code: ${payload.meeting_code}
- Invited by: ${payload.inviter_name} (${payload.inviter_email})

To join:
1. Visit: ${payload.meeting_url}
2. Enter meeting code: ${payload.meeting_code}
3. Sign in and start collaborating!
` : `
Getting Started:
- Platform: Retrospective Meeting System
- Invited by: ${payload.inviter_name} (${payload.inviter_email})

To get started:
1. Visit: ${payload.meeting_url}
2. Sign in with your account
3. Create or join meetings!
`}

Meeting URL: ${payload.meeting_url}
    `

    // Send emails to all invitees
    const emailPromises = payload.invitee_emails.map(async (email) => {
      const emailSubject = payload.meeting_code 
        ? `You're invited to join "${payload.meeting_title}" - Meeting Code: ${payload.meeting_code}`
        : `You're invited to join the Retrospective Meeting Platform`

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Retrospective Team <noreply@grepsr.com>',
          to: [email],
          subject: emailSubject,
          html: emailHtml,
          text: emailText,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to send email to ${email}: ${response.status} ${errorText}`)
      }

      const result = await response.json()
      console.log(`✅ Email sent to ${email}:`, result.id)
      
      return { email, success: true, id: result.id }
    })

    // Wait for all emails to be sent
    const results = await Promise.allSettled(emailPromises)
    
    const successfulEmails = results.filter(result => result.status === 'fulfilled').length
    const failedEmails = results.filter(result => result.status === 'rejected')
    
    console.log(`📧 Invitation emails sent: ${successfulEmails}/${payload.invitee_emails.length}`)
    
    if (failedEmails.length > 0) {
      console.error('❌ Failed emails:', failedEmails.map(f => f.reason))
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully sent ${successfulEmails} invitation emails`,
        sent_count: successfulEmails,
        total_count: payload.invitee_emails.length,
        failed_count: failedEmails.length,
        details: results.map((result, index) => ({
          email: payload.invitee_emails[index],
          success: result.status === 'fulfilled',
          error: result.status === 'rejected' ? result.reason : null
        }))
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('❌ Error sending invitation emails:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Failed to send invitation emails'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
}) 