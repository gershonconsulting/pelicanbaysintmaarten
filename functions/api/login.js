import { json, bad, verifyPassword, sha256hex, newToken, sessionCookie, isAdmin } from '../lib/util.js';

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return bad('Invalid request'); }
  const email = (b.email || '').trim().toLowerCase();
  const password = b.password || '';
  if (!email || !password) return bad('Email and password are required');

  const u = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (!u || !(await verifyPassword(password, u.password_hash))) return bad('Incorrect email or password', 401);
  if (u.status === 'pending') return bad('Your account is awaiting approval', 403);
  if (u.status === 'denied') return bad('This account is not authorized', 403);

  const token = newToken();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)')
    .bind(await sha256hex(token), u.id, Date.now() + 1000 * 60 * 60 * 24 * 30).run();

  return json({ ok: true, user: { name: u.name, email: u.email, is_admin: isAdmin(u, env) ? 1 : 0 } },
    200, { 'Set-Cookie': sessionCookie(token) });
}
