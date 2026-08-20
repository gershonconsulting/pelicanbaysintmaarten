import { json, currentUser, isAdmin } from '../../lib/util.js';
import { fetchCalendarEvents, isReservation } from '../../lib/google.js';

const nights = (e) => Math.round((new Date(e.end + 'T00:00:00Z') - new Date(e.start + 'T00:00:00Z')) / 864e5);

// Admin-only: reservations (tagged, block availability) + untagged multi-night stays to review.
export async function onRequestGet({ request, env }) {
  const u = await currentUser(request, env);
  if (!isAdmin(u, env)) return json({ error: 'forbidden' }, 403);
  let events = [];
  try { events = await fetchCalendarEvents(env); } catch {}
  const today = new Date().toISOString().slice(0, 10);
  events = events
    .filter((e) => (e.end || e.start) > today)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const reservations = events.filter((e) => isReservation(e.tags));
  const untagged = events.filter((e) => !isReservation(e.tags) && nights(e) >= 2);
  return json({ reservations, untagged });
}
