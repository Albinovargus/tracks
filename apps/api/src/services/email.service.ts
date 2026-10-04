import { Resend } from 'resend';

const resendApiKey = process.env['RESEND_API_KEY'];
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!resend) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RESEND_API_KEY is required in production');
    }
    console.log('[email] RESEND_API_KEY not set, skipping:', options.subject, 'to:', options.to);
    return;
  }

  const { error } = await resend.emails.send({
    from: 'Tracks <noreply@tracks.com>',
    ...options,
  });

  if (error) throw error;
}
