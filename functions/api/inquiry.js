// Public contact form: stores every inquiry in D1 and emails it to the owner via Resend.
import { json, bad, escapeHtml } from '../lib/util.js';
import { sendEmail } from '../lib/email.js';

const MAX = { name: 120, email: 200, phone: 60, dates: 120, guests: 120, message: 5000 };
const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

export async function ensureInquiriesTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS inquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, dates TEXT, guests TEXT,
      cat_friendly INTEGER DEFAULT 0, message TEXT, emailed INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL)`
  ).run();
}

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return bad('Invalid request'); }
  // Honeypot: bots fill the hidden "company" field. Pretend success.
  if (b.company) return json({ ok: true });

  const d = {
    name: clip(b.name, MAX.name), email: clip(b.email, MAX.email), phone: clip(b.phone, MAX.phone),
    dates: clip(b.dates, MAX.dates), guests: clip(b.guests, MAX.guests), message: clip(b.message, MAX.message),
    cat: b.catFriendly ? 1 : 0,
  };
  if (!d.name) return bad('Please enter your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return bad('Please enter a valid email address.');

  const to = env.INQUIRY_TO || 'olivier@attia.com';
  const row = (k, v) => `<tr><td style="padding:4px 12px 4px 0;color:#6b6b6b">${k}</td><td style="padding:4px 0">${escapeHtml(v || '—')}</td></tr>`;
  const html = `<h2 style="font-family:Georgia,serif;color:#0F2E3D">New Pelican Bay inquiry</h2>
    <table style="font-family:Arial,sans-serif;font-size:14px">${row('Name', d.name)}${row('Email', d.email)}${row('Phone', d.phone)}${row('Preferred dates', d.dates)}${row('Guests', d.guests)}${row('Cat-friendly', d.cat ? 'Yes' : 'Not confirmed')}</table>
    <p style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap">${escapeHtml(d.message || '')}</p>
    <p style="font-family:Arial,sans-serif;font-size:12px;color:#6b6b6b">Reply to this email to answer the guest directly.</p>`;

  const mail = await sendEmail(env, to, `Pelican Bay inquiry from ${d.name}`, html, { replyTo: d.email });

  let stored = false;
  if (env.DB) {
    try {
      await ensureInquiriesTable(env);
      await env.DB.prepare(
        'INSERT INTO inquiries (name, email, phone, dates, guests, cat_friendly, message, emailed, created_at) VALUES (?,?,?,?,?,?,?,?,?)'
      ).bind(d.name, d.email, d.phone, d.dates, d.guests, d.cat, d.message, mail.sent ? 1 : 0, Date.now()).run();
      stored = true;
    } catch (e) { stored = false; }
  }

  if (!mail.sent && !stored) return bad('Sorry, your message could not be sent. Please try again shortly.', 503);
  return json({ ok: true });
}
