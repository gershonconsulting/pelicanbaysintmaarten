import { json, bad, currentUser, isAdmin, escapeHtml } from '../../lib/util.js';
import { sendEmail } from '../../lib/email.js';

export async function onRequestGet({ request, env }) {
  const u = await currentUser(request, env);
  if (!isAdmin(u, env)) return json({ error: 'forbidden' }, 403);
  const { results } = await env.DB.prepare('SELECT id, name, email, status, is_admin, created_at FROM users ORDER BY created_at DESC').all();
  return json({ users: results || [] });
}

export async function onRequestPost({ request, env }) {
  const u = await currentUser(request, env);
  if (!isAdmin(u, env)) return json({ error: 'forbidden' }, 403);
  let b;
  try { b = await request.json(); } catch { return bad('Invalid request'); }
  if (!b.id || !['approve', 'deny'].includes(b.action)) return bad('Invalid request');
  const target = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(b.id).first();
  if (!target) return bad('Not found', 404);
  const status = b.action === 'approve' ? 'approved' : 'denied';
  await env.DB.prepare('UPDATE users SET status = ? WHERE id = ?').bind(status, b.id).run();
  if (b.action === 'approve') {
    await sendEmail(env, target.email, "You're approved — Pelican Bay Friends",
      `<p>Hi ${escapeHtml(target.name)}, you've been approved. Sign in and reserve your dates:</p>
       <p><a href="https://pelicanbaysintmaarten.com/friends">pelicanbaysintmaarten.com/friends</a></p>`);
  }
  return json({ ok: true });
}
