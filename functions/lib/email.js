// Email via Resend. No-op (graceful) if RESEND_API_KEY is not configured.
export async function sendEmail(env, to, subject, html) {
  if (!env.RESEND_API_KEY || !to) return { sent: false, reason: 'not_configured' };
  const from = env.EMAIL_FROM || 'Pelican Bay <onboarding@resend.dev>';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
    });
    return { sent: r.ok };
  } catch (e) {
    return { sent: false, reason: 'error' };
  }
}
