// Google Calendar: read availability + write approved bookings.
// Availability works with either CALENDAR_ICS_URL (private iCal address) or OAuth.
// Write-back needs OAuth (GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN + GOOGLE_CALENDAR_ID).
export async function getAccessToken(env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REFRESH_TOKEN) return null;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!r.ok) throw new Error('google_token_failed');
  return (await r.json()).access_token;
}

function icsDate(v) {
  const m = String(v).match(/(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// Returns [{start:'YYYY-MM-DD', end:'YYYY-MM-DD' (exclusive)}]
export async function fetchCalendarBusy(env) {
  const out = [];
  if (env.CALENDAR_ICS_URL) {
    const r = await fetch(env.CALENDAR_ICS_URL, { cf: { cacheTtl: 900, cacheEverything: true } });
    if (r.ok) {
      const text = await r.text();
      for (const ev of text.split('BEGIN:VEVENT').slice(1)) {
        const s = ev.match(/DTSTART[^:\r\n]*:([0-9TZ]+)/);
        const e = ev.match(/DTEND[^:\r\n]*:([0-9TZ]+)/);
        if (s) {
          const start = icsDate(s[1]);
          const end = e ? icsDate(e[1]) : start;
          if (start) out.push({ start, end: end || start });
        }
      }
    }
    return out;
  }
  const token = await getAccessToken(env).catch(() => null);
  if (token && env.GOOGLE_CALENDAR_ID) {
    const timeMin = new Date(Date.now() - 864e5).toISOString();
    const timeMax = new Date(Date.now() + 864e5 * 400).toISOString();
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(env.GOOGLE_CALENDAR_ID)}/events?singleEvents=true&orderBy=startTime&maxResults=2500&timeMin=${timeMin}&timeMax=${timeMax}`;
    const r = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (r.ok) {
      const j = await r.json();
      for (const it of j.items || []) {
        const start = (it.start && (it.start.date || (it.start.dateTime || '').slice(0, 10))) || null;
        const end = (it.end && (it.end.date || (it.end.dateTime || '').slice(0, 10))) || start;
        if (start) out.push({ start, end: end || start });
      }
    }
  }
  return out;
}

export async function insertBooking(env, b) {
  const token = await getAccessToken(env).catch(() => null);
  if (!token || !env.GOOGLE_CALENDAR_ID) return { written: false, reason: 'google_not_configured' };
  const body = {
    summary: `Friend stay — ${b.name}`,
    description: `Booked via the Friends page. ${b.rooms} bedroom(s). Guest: ${b.name} <${b.email}>.`,
    start: { date: b.checkin },
    end: { date: b.checkout },
  };
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(env.GOOGLE_CALENDAR_ID)}/events`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) return { written: false, reason: 'insert_failed' };
  const j = await r.json();
  return { written: true, id: j.id };
}
