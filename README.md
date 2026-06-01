# pelicanbaysintmaarten.com

Static marketing site for the Pelican Bay (Sint Maarten) vacation rental.

- **Live URL:** https://pelicanbaysintmaarten.com
- **Host:** Cloudflare Pages (project `pelicanbaysintmaarten`)
- **DNS/SSL/CDN:** Cloudflare
- **Deploy:** push to `main` → Cloudflare Pages auto-builds (static, no build step)

## Structure
- `index.html` — single-page site (~61 KB, clean static, no worker)
- `assets/` — 19 extracted JPEG images
- `Pelican-Bay-7-Day-Guide.pdf` — downloadable itinerary guide

## Notes
The previous outage was caused by a Direct-Upload deployment that bundled a
`_worker.js` returning HTTP 500 on WebP-capable requests. This repo is
static-only by design — do not add a `_worker.js`.
