import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailPayload {
  meetingId: string;
  meetingCode: string;
  meetingTitle: string;
  hostEmail: string;
  hostName: string;
  startDate: string;
  endDate: string;
  endedBy: string | null; // null if auto-ended
  participantCount: number;
  notes: Array<{
    type: string;
    content: string;
    created_by: string;
    created_at: string;
    like_count: number;
    author_name: string;
  }>;
  participants: Array<{
    email: string;
    name: string;
  }>;
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
    const payload: EmailPayload = await req.json()

    // Create CSV content
    const csvContent = [
      ['Type', 'Content', 'Created By', 'Created At', 'Likes'],
      ...payload.notes.map(note => [
        note.type,
        `"${note.content.replace(/"/g, '""')}"`, // Escape quotes in content
        note.author_name,
        new Date(note.created_at).toLocaleString(),
        note.like_count.toString()
      ])
    ]
    .map(row => row.join(','))
    .join('\n')

    // Convert CSV to base64 for attachment
    const csvBase64 = btoa(unescape(encodeURIComponent(csvContent)))

    // Get Resend API key from environment
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured')
    }

    // Create email content
    const endedByText = payload.endedBy 
      ? `by ${payload.endedBy === payload.hostEmail ? payload.hostName + ' (host)' : payload.endedBy}`
      : 'automatically after 2 hours'

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Meeting Summary - ${payload.meetingTitle}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; text-align: center; margin-bottom: 30px; }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 10px 0 0 0; opacity: 0.9; }
          .section { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
          .section h2 { margin: 0 0 15px 0; color: #667eea; font-size: 18px; }
          .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 15px 0; }
          .info-item { background: white; padding: 12px; border-radius: 6px; border: 1px solid #e9ecef; }
          .info-label { font-weight: bold; color: #495057; font-size: 12px; text-transform: uppercase; margin-bottom: 5px; }
          .info-value { color: #212529; }
          .stats { display: flex; justify-content: space-around; margin: 20px 0; }
          .stat { text-align: center; padding: 15px; background: white; border-radius: 8px; border: 1px solid #e9ecef; }
          .stat-number { font-size: 24px; font-weight: bold; color: #667eea; }
          .stat-label { font-size: 12px; color: #6c757d; text-transform: uppercase; }
          .participants { margin: 15px 0; }
          .participant { display: inline-block; background: #e3f2fd; color: #1976d2; padding: 5px 10px; margin: 3px; border-radius: 15px; font-size: 12px; }
          .footer { text-align: center; padding: 20px; color: #6c757d; font-size: 12px; border-top: 1px solid #e9ecef; margin-top: 30px; }
          .attachment-note { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .attachment-note strong { color: #856404; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📋 Meeting Summary</h1>
          <p>${payload.meetingTitle}</p>
        </div>

        <div class="section">
          <h2>📅 Meeting Details</h2>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Meeting Code</div>
              <div class="info-value">${payload.meetingCode}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Host</div>
              <div class="info-value">${payload.hostName}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Started</div>
              <div class="info-value">${new Date(payload.startDate).toLocaleString()}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Ended</div>
              <div class="info-value">${new Date(payload.endDate).toLocaleString()}</div>
            </div>
          </div>
          <p style="margin: 15px 0 0 0; color: #6c757d;">
            <em>This meeting was ended ${endedByText}</em>
          </p>
        </div>

        <div class="section">
          <h2>📊 Meeting Statistics</h2>
          <div class="stats">
            <div class="stat">
              <div class="stat-number">${payload.participantCount}</div>
              <div class="stat-label">Participants</div>
            </div>
            <div class="stat">
              <div class="stat-number">${payload.notes.length}</div>
              <div class="stat-label">Total Notes</div>
            </div>
            <div class="stat">
              <div class="stat-number">${payload.notes.reduce((sum, note) => sum + note.like_count, 0)}</div>
              <div class="stat-label">Total Likes</div>
            </div>
            <div class="stat">
              <div class="stat-number">${Math.round((new Date(payload.endDate).getTime() - new Date(payload.startDate).getTime()) / (1000 * 60))}m</div>
              <div class="stat-label">Duration</div>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>👥 Participants</h2>
          <div class="participants">
            ${payload.participants.map(p => `<span class="participant">${p.name}</span>`).join('')}
          </div>
        </div>

        <div class="attachment-note">
          <strong>📎 Attachment Included:</strong> A detailed CSV file with all meeting notes is attached to this email. You can open it in Excel, Google Sheets, or any spreadsheet application to analyze the retrospective data.
        </div>

        <div class="footer">
          <p>This email was automatically generated by the Retrospective Meeting System</p>
          <p>Meeting Code: ${payload.meetingCode} • Generated on ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `

    const emailText = `
Meeting Summary: ${payload.meetingTitle}

Meeting Details:
- Code: ${payload.meetingCode}
- Host: ${payload.hostName}
- Started: ${new Date(payload.startDate).toLocaleString()}
- Ended: ${new Date(payload.endDate).toLocaleString()}
- Ended ${endedByText}

Statistics:
- Participants: ${payload.participantCount}
- Total Notes: ${payload.notes.length}
- Total Likes: ${payload.notes.reduce((sum, note) => sum + note.like_count, 0)}
- Duration: ${Math.round((new Date(payload.endDate).getTime() - new Date(payload.startDate).getTime()) / (1000 * 60))} minutes

Participants: ${payload.participants.map(p => p.name).join(', ')}

A detailed CSV file with all meeting notes is attached to this email.

---
This email was automatically generated by the Retrospective Meeting System
Meeting Code: ${payload.meetingCode}
    `

    // Send emails to all participants
    const emailPromises = payload.participants.map(async (participant) => {
      const emailData = {
        from: 'Grepsr Retro <noreply@retro.grepsr.net>',
        to: [participant.email],
        subject: `📋 Meeting Summary: ${payload.meetingTitle} (${payload.meetingCode})`,
        html: emailHtml,
        text: emailText,
        attachments: [
          {
            filename: `${payload.meetingTitle.replace(/[^a-zA-Z0-9]/g, '_')}_retrospective.csv`,
            content: csvBase64,
            content_type: 'text/csv',
          }
        ]
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Failed to send email to ${participant.email}:`, errorText)
        throw new Error(`Failed to send email to ${participant.email}: ${errorText}`)
      }

      return await response.json()
    })

    // Wait for all emails to be sent
    const results = await Promise.allSettled(emailPromises)
    
    // Check for failures
    const failures = results.filter(result => result.status === 'rejected')
    if (failures.length > 0) {
      console.error('Some emails failed to send:', failures)
    }

    const successCount = results.filter(result => result.status === 'fulfilled').length

    console.log(`Successfully sent ${successCount}/${payload.participants.length} emails for meeting ${payload.meetingCode}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent: successCount,
        totalParticipants: payload.participants.length,
        failures: failures.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Error in send-meeting-summary function:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
}) 