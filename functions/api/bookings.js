import { json, bad, currentUser, escapeHtml } from '../lib/util.js';
import { sendEmail } from '../lib/email.js';

export async function onRequestGet({ request, env }) {
  const u = await currentUser(request, env);
  if (!u || u.status !== 'approved') return json({ error: 'unauthorized' }, 401);
  const { results } = await env.DB.prepare('SELECT id, checkin, checkout, rooms, status, created_at FROM bookings WHERE user_id = ? ORDER BY checkin').bind(u.id).all();
  return json({ bookings: results || [] });
}

export async function onRequestPost({ request, env }) {
  const u = await currentUser(request, env);
  if (!u || u.status !== 'approved') return json({ error: 'unauthorized' }, 401);
  let b;
  try { b = await request.json(); } catch { return bad('Invalid request'); }
  const checkin = b.checkin, checkout = b.checkout, rooms = parseInt(b.rooms || 3, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkin || '') || !/^\d{4}-\d{2}-\d{2}$/.test(checkout || '')) return bad('Pick valid dates');
  if (checkout <= checkin) return bad('Check-out must be after check-in');
  if (rooms < 1 || rooms > 3) return bad('Choose 1 to 3 bedrooms');

  const { results } = await env.DB.prepare("SELECT checkin, checkout FROM bookings WHERE status IN ('approved','pending')").all();
  for (const r of results || []) { if (checkin < r.checkout && checkout > r.checkin) return bad('Those dates overlap an existing reservation'); }

  await env.DB.prepare('INSERT INTO bookings (user_id, name, email, checkin, checkout, rooms, status, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .bind(u.id, u.name, u.email, checkin, checkout, rooms, 'pending', Date.now()).run();

  const admin = (env.ADMIN_EMAIL || '').split(',')[0].trim();
  if (admin) {
    await sendEmail(env, admin, 'New booking request — Pelican Bay',
      `<p><strong>${escapeHtml(u.name)}</strong> requested <strong>${checkin} → ${checkout}</strong> (${rooms} bedroom(s)).</p>
       <p>Approve or deny: <a href="https://pelicanbaysintmaarten.com/friends/admin">pelicanbaysintmaarten.com/friends/admin</a></p>`);
  }
  await sendEmail(env, u.email, 'We received your Pelican Bay request',
    `<p>Hi ${escapeHtml(u.name)}, we received your request for <strong>${checkin} → ${checkout}</strong>. You'll get an email as soon as it's confirmed.</p>`);
  return json({ ok: true });
}
