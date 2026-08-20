// Code gate for /guide/* — the guest Welcome Guide.
//
// Everything under /guide (the page and its images) is held behind a short
// access code. The code lives in the GUIDE_CODE environment variable; the
// fallback below keeps the gate working if the variable was never set.
//
// Cloudflare Pages env vars are read at request time, so changing GUIDE_CODE
// in the dashboard takes effect on the next deploy of this project.

import { parseCookies, sha256hex } from '../lib/util.js';

const COOKIE = 'pb_guide';
const MAX_AGE = 60 * 60 * 24 * 90; // 90 days

function guideCode(env) {
  return String(env.GUIDE_CODE || 'SXM2026').trim();
}

// Compared case-insensitively: phone keyboards love to auto-capitalise, and a
// guest fumbling the case of a code we gave them is not a security event.
function sameCode(given, expected) {
  return given.toLowerCase() === expected.toLowerCase();
}

// The cookie never contains the code itself, only an opaque digest of it.
// Rotating GUIDE_CODE therefore invalidates every cookie already issued.
async function tokenFor(env) {
  return await sha256hex('pb-guide|v2|' + guideCode(env) + '|' + (env.GUIDE_SALT || 'pelican-bay'));
}

function gatePage(error) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>Pelican Bay — Welcome Guide</title>
<style>
  :root{--navy:#16354a;--aqua:#16899a;--paper:#fbfaf7;--line:#ddd6ca;--muted:#6a747c}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:linear-gradient(160deg,#16354a,#0d5f6c);padding:24px;
       font-family:Arial,Helvetica,sans-serif;color:#25313a}
  .card{background:var(--paper);border-radius:18px;padding:40px 34px;width:100%;max-width:400px;
        box-shadow:0 18px 50px rgba(0,0,0,.28);text-align:center}
  .kicker{text-transform:uppercase;letter-spacing:3px;color:var(--aqua);font-size:11px;font-weight:800}
  h1{font-family:Georgia,'Times New Roman',serif;color:var(--navy);font-size:30px;margin:10px 0 6px}
  p.lead{color:var(--muted);font-size:14px;line-height:1.5;margin:0 0 24px}
  input{width:100%;padding:15px;font-size:21px;text-align:center;letter-spacing:3px;
        border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--navy);font-weight:700}
  input::placeholder{letter-spacing:0;font-weight:400;color:#a7aeb3;font-size:16px}
  input:focus{outline:none;border-color:var(--aqua);box-shadow:0 0 0 3px rgba(22,137,154,.16)}
  button{width:100%;margin-top:14px;padding:14px;font-size:15px;font-weight:800;letter-spacing:.4px;
         color:#fff;background:var(--navy);border:0;border-radius:999px;cursor:pointer}
  button:hover{background:#0d5f6c}
  .err{color:#b3382a;font-size:13px;font-weight:700;margin:0 0 14px}
  .foot{margin-top:22px;font-size:11.5px;color:var(--muted);line-height:1.5}
  .foot a{color:var(--aqua);font-weight:700;text-decoration:none}
</style>
</head>
<body>
  <main class="card">
    <div class="kicker">Pelican Bay &middot; Sint Maarten</div>
    <h1>Welcome Guide</h1>
    <p class="lead">This guide is for our guests. Please enter the access code we sent you.</p>
    ${error ? `<p class="err">${error}</p>` : ''}
    <form method="POST" autocomplete="off">
      <input name="code" type="text" maxlength="32" spellcheck="false"
             autocapitalize="characters" autocorrect="off"
             aria-label="Access code" placeholder="Access code" autofocus required/>
      <button type="submit">Open the guide</button>
    </form>
    <p class="foot">Lost your code? Message Olivier on
      <a href="https://wa.me/33652703232">WhatsApp</a>.</p>
  </main>
</body>
</html>`;
}

function html(body, status) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}

export async function onRequest(context) {
  const { request, env, next } = context;

  if (request.method === 'POST') {
    let given = '';
    try {
      const form = await request.formData();
      given = String(form.get('code') || '').trim();
    } catch (e) {
      given = '';
    }
    if (given && sameCode(given, guideCode(env))) {
      return new Response(null, {
        status: 303,
        headers: {
          Location: '/guide/',
          'Set-Cookie': `${COOKIE}=${await tokenFor(env)}; Path=/guide; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`,
        },
      });
    }
    // Small delay so the gate is not a free high-speed oracle.
    await new Promise((r) => setTimeout(r, 700));
    return html(gatePage('That code is not right. Please try again.'), 401);
  }

  if (parseCookies(request)[COOKIE] === (await tokenFor(env))) {
    const res = await next();
    const out = new Response(res.body, res);
    out.headers.set('x-robots-tag', 'noindex, nofollow');
    return out;
  }

  return html(gatePage(''), 401);
}
