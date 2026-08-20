import { json, parseCookies, sha256hex, clearCookie } from '../lib/util.js';

export async function onRequestPost({ request, env }) {
  const token = parseCookies(request)['pb_session'];
  if (token) { try { await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256hex(token)).run(); } catch {} }
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });
}
