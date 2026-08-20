import { json, currentUser } from '../lib/util.js';
import { fetchCalendarBusy } from '../lib/google.js';

// Returns { blocked: ['YYYY-MM-DD', ...] } — nights unavailable (calendar + live requests).
export async function onRequestGet({ request, env }) {
  const u = await currentUser(request, env);
  if (!u || u.status !== 'approved') return json({ error: 'unauthorized' }, 401);

  let ranges = [];
  try { ranges = await fetchCalendarBusy(env); } catch {}
  try {
    const { results } = await env.DB.prepare("SELECT checkin, checkout FROM bookings WHERE status IN ('approved','pending')").all();
    for (const b of results || []) ranges.push({ start: b.checkin, end: b.checkout });
  } catch {}

  const set = new Set();
  for (const r of ranges) {
    if (!r.start) continue;
    let d = new Date(r.start + 'T00:00:00Z');
    const end = r.end ? new Date(r.end + 'T00:00:00Z') : new Date(d.getTime() + 864e5);
    let i = 0;
    while (d < end && i < 800) { set.add(d.toISOString().slice(0, 10)); d = new Date(d.getTime() + 864e5); i++; }
  }
  return json({ blocked: [...set] });
}
