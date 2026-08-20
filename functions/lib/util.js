// Shared helpers: JSON responses, password hashing, sessions, auth.
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}
export function bad(message, status = 400) { return json({ error: message }, status); }

const enc = new TextEncoder();
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
function fromHex(hex) {
  const a = new Uint8Array(hex.length / 2);
  for (let i = 0; i < a.length; i++) a[i] = parseInt(hex.substr(i * 2, 2), 16);
  return a;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
  return toHex(salt) + ':' + toHex(bits);
}
export async function verifyPassword(password, stored) {
  if (!stored || stored.indexOf(':') < 0) return false;
  const [saltHex, hashHex] = stored.split(':');
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: fromHex(saltHex), iterations: 100000, hash: 'SHA-256' }, key, 256);
  return toHex(bits) === hashHex;
}
export async function sha256hex(str) { return toHex(await crypto.subtle.digest('SHA-256', enc.encode(str))); }

export function parseCookies(req) {
  const out = {};
  (req.headers.get('Cookie') || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
export function sessionCookie(token, maxAge = 60 * 60 * 24 * 30) {
  return `pb_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
export function clearCookie() { return 'pb_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'; }

export function newToken() {
  const a = crypto.getRandomValues(new Uint8Array(32));
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function currentUser(req, env) {
  const token = parseCookies(req)['pb_session'];
  if (!token) return null;
  const th = await sha256hex(token);
  return await env.DB.prepare(
    'SELECT u.id, u.name, u.email, u.status, u.is_admin FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?'
  ).bind(th, Date.now()).first();
}
export function adminEmails(env) {
  return (env.ADMIN_EMAIL || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
}
export function isAdmin(user, env) {
  if (!user) return false;
  if (user.is_admin) return true;
  return adminEmails(env).includes((user.email || '').toLowerCase());
}
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
