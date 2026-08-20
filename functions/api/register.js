import { json, bad, hashPassword, adminEmails, escapeHtml } from '../lib/util.js';
import { sendEmail } from '../lib/email.js';

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return bad('Invalid request'); }
  const name = (b.name || '').trim();
  const email = (b.email || '').trim().toLowerCase();
  const password = b.password || '';
  if (!name || !email || !password) return bad('Name, email and password are required');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad('Enter a valid email address');
  if (password.length < 8) return bad('Password must be at least 8 characters');

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return bad('An account with that email already exists');

  const ph = await hashPassword(password);
  const isAdm = adminEmails(env).includes(email) ? 1 : 0;
  const status = isAdm ? 'approved' : 'pending';
  await env.DB.prepare('INSERT INTO users (name, email, password_hash, status, is_admin, created_at) VALUES (?,?,?,?,?,?)')
    .bind(name, email, ph, status, isAdm, Date.now()).run();

  const admin = (env.ADMIN_EMAIL || '').split(',')[0].trim();
  if (admin && !isAdm) {
    await sendEmail(env, admin, 'New friend registration — Pelican Bay',
      `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) requested access to the Friends booking page.</p>
       <p>Approve or deny here: <a href="https://pelicanbaysintmaarten.com/friends/admin">pelicanbaysintmaarten.com/friends/admin</a></p>`);
  }
  return json({ ok: true, status });
}
