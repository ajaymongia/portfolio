'use strict';

/**
 * Pre-renders the site to ./dist so it can be hosted as static files.
 *
 * Rather than duplicating the route logic, this starts the real Express app
 * on an ephemeral port and fetches every page from it — so what gets written
 * is exactly what the server renders.
 *
 *   SITE_URL=https://your-domain.com npm run build
 */

// Must be set before the app loads: it pins one asset-version stamp for the
// whole build, so every page references the same /css/style.css?v=… and the
// browser caches it once rather than per page.
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const fs = require('fs');
const path = require('path');

const app = require('./server');
const projects = require('./lib/content').read('projects');

const OUT = path.join(__dirname, 'dist');
const PUBLIC = path.join(__dirname, 'public');

// Every page the site serves. Case studies with an external `link` have no
// internal page, so they are skipped.
const pages = [
  { url: '/', file: 'index.html' },
  { url: '/sitemap.xml', file: 'sitemap.xml' },
  { url: '/robots.txt', file: 'robots.txt' },
  { url: '/__not-found__', file: '404.html', expect: 404 }
].concat(
  projects
    .filter((p) => !p.link)
    .map((p) => ({ url: `/work/${p.slug}`, file: path.join('work', `${p.slug}.html`) }))
);

/** The admin has no place in a static export. */
function assertNoAdmin(dir) {
  const stray = fs.existsSync(path.join(dir, 'admin'));
  if (stray) throw new Error('dist/admin exists — the admin must not be exported');
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else if (entry.name !== 'README.md') fs.copyFileSync(src, dest);
  }
}

async function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  let bytes = 0;
  for (const page of pages) {
    const res = await fetch(`http://127.0.0.1:${port}${page.url}`);
    if (res.status !== (page.expect || 200)) {
      throw new Error(`${page.url} returned ${res.status}, expected ${page.expect || 200}`);
    }
    const body = await res.text();
    const dest = path.join(OUT, page.file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, body);
    bytes += Buffer.byteLength(body);
    console.log(`  ${page.url.padEnd(28)} → dist/${page.file}`);
  }

  server.close();

  copyDir(PUBLIC, OUT);
  // Uploaded media ships with the build; the admin itself does not.
  assertNoAdmin(OUT);
  console.log(`\n  ${pages.length} pages (${Math.round(bytes / 1024)} KB) + assets → dist/`);
  console.log(`  sitemap origin: ${process.env.SITE_URL || '(not set — pass SITE_URL to fix absolute URLs)'}\n`);
}

build().catch((err) => {
  console.error('\n  Build failed:', err.message, '\n');
  process.exit(1);
});
