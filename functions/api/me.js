import { json, currentUser, isAdmin } from '../lib/util.js';

export async function onRequestGet({ request, env }) {
  const u = await currentUser(request, env);
  if (!u) return json({ user: null });
  return json({ user: { name: u.name, email: u.email, status: u.status, is_admin: isAdmin(u, env) ? 1 : 0 } });
}
