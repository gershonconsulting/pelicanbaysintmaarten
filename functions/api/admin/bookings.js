import { json, bad, currentUser, isAdmin, escapeHtml } from '../../lib/util.js';
import { sendEmail } from '../../lib/email.js';
import { insertBooking } from '../../lib/google.js';

export async function onRequestGet({ request, env }) {
  const u = await currentUser(request, env);
  if (!isAdmin(u, env)) return json({ error: 'forbidden' }, 403);
  const { results } = await env.DB.prepare('SELECT * FROM bookings ORDER BY created_at DESC').all();
  return json({ bookings: results || [] });
}

export async function onRequestPost({ request, env }) {
  const u = await currentUser(request, env);
  if (!isAdmin(u, env)) return json({ error: 'forbidden' }, 403);
  let b;
  try { b = await request.json(); } catch { return bad('Invalid request'); }
  if (!b.id || !['approve', 'deny'].includes(b.action)) return bad('Invalid request');
  const bk = await env.DB.prepare('SELECT * FROM bookings WHERE id = ?').bind(b.id).first();
  if (!bk) return bad('Not found', 404);

  if (b.action === 'deny') {
    await env.DB.prepare("UPDATE bookings SET status = 'denied' WHERE id = ?").bind(b.id).run();
    await sendEmail(env, bk.email, 'Update on your Pelican Bay request',
      `<p>Hi ${escapeHtml(bk.name)}, unfortunately your request for <strong>${bk.checkin} → ${bk.checkout}</strong> can't be confirmed this time. Please feel free to pick other dates.</p>`);
    return json({ ok: true });
  }

  let gcal = { written: false };
  try { gcal = await insertBooking(env, bk); } catch {}
  await env.DB.prepare("UPDATE bookings SET status = 'approved', gcal_event_id = ? WHERE id = ?").bind(gcal.id || null, b.id).run();
  await sendEmail(env, bk.email, 'Your Pelican Bay stay is confirmed',
    `<p>Hi ${escapeHtml(bk.name)}, your stay <strong>${bk.checkin} → ${bk.checkout}</strong> (${bk.rooms} bedroom(s)) is confirmed. We can't wait to host you!</p>`);
  return json({ ok: true, gcal });
}
