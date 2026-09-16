import { json, currentUser, isAdmin } from '../../lib/util.js';
import { ensureInquiriesTable } from '../inquiry.js';

export async function onRequestGet({ request, env }) {
  const u = await currentUser(request, env);
  if (!isAdmin(u, env)) return json({ error: 'forbidden' }, 403);
  await ensureInquiriesTable(env);
  const { results } = await env.DB.prepare(
    'SELECT id, name, email, phone, dates, guests, cat_friendly, message, emailed, created_at FROM inquiries ORDER BY created_at DESC LIMIT 200'
  ).all();
  return json({ inquiries: results || [] });
}
