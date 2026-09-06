'use strict';

const path = require('path');
const fs = require('fs');

// Minimal .env loader — avoids a dependency for four variables.
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8')
    .split(/\r?\n/)
    .forEach((line) => {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    });
} catch (err) {
  if (err.code !== 'ENOENT') console.warn('  could not read .env:', err.message);
}
const express = require('express');

const content = require('./lib/content');
const adminRouter = require('./lib/admin');

// Pick up hand-edits to content/*.json without a restart.
content.watch();
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Cache-busting stamp for static assets. In production this is fixed at boot,
// so a deploy invalidates the cache; in development it changes every request.
const BOOT = Date.now().toString(36);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
const IS_PROD = process.env.NODE_ENV === 'production';
const ASSET_VERSION = () => (IS_PROD ? BOOT : Date.now().toString(36));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: IS_PROD ? '7d' : 0, etag: true }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));

// Configured media is only referenced if the file is actually there, so a
// missing file falls back gracefully instead of rendering as broken.
function resolveAsset(webPath) {
  if (!webPath) return null;
  const onDisk = path.join(__dirname, 'public', webPath.replace(/^\//, ''));
  return fs.existsSync(onDisk) ? webPath : null;
}

/** The site's content, read fresh so admin edits need no restart. */
function load() {
  const site = content.read('site');
  const projects = content.read('projects');
  const footer = content.read('footer');

  // "Also delivered for" is not a second list to maintain — it is the
  // clients that have no case study of their own. Linking a client to a
  // project removes it here automatically, and a client pointing at a
  // project that has since been deleted comes back rather than vanishing.
  const projectIds = new Set(projects.map((p) => p.id));
  const alsoFor = site.clients.filter((c) => !c.projectId || !projectIds.has(c.projectId));

  // Hiding a section would otherwise leave menu and footer links pointing at
  // an anchor that is no longer on the page, so those links are dropped too.
  const sections = content.read('sections');
  const liveAnchor = (href) => {
    if (!href || !href.startsWith('#')) return true;
    const key = href.slice(1);
    if (key === 'top') return true;
    return !sections[key] || sections[key].visible !== false;
  };
  const recommendations = content
    .read('recommendations')
    .slice()
    // The featured quote leads the carousel.
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));

  return {
    site: {
      ...site,
      alsoFor,
      nav: site.nav.filter((item) => liveAnchor(item.href)),
      portrait: resolveAsset(site.portrait),
      portraitVideo: resolveAsset(site.portraitVideo)
    },
    sections,
    projects,
    visuals: content.read('visuals').filter((v) => v.src),
    services: content.read('services'),
    experience: content.read('experience'),
    recommendations,
    scrapbook: content.read('scrapbook'),
    tools: content.read('tools'),
    footer: { ...footer, links: footer.links.filter((l) => liveAnchor(l.href)) }
  };
}

/* ---------------------------------------------------------------- admin */

const FileStore = require('./lib/session-store');

app.use(
  session({
    name: 'portfolio.sid',
    store: new FileStore(path.join(__dirname, '.sessions.json')),
    secret: process.env.SESSION_SECRET || require('crypto').randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 14 }
  })
);
// Local editing tool: never mounted in a production process.
if (!IS_PROD) {
  app.use('/admin', adminRouter);
}

// Values every template can rely on.
app.use((req, res, next) => {
  res.locals.site = load().site;
  res.locals.path = req.path;
  res.locals.year = new Date().getFullYear();
  res.locals.onePage = req.path === '/';
  res.locals.v = ASSET_VERSION();
  next();
});

/* ---------------------------------------------------------------- pages */

// Everything lives on one page; /work/:slug case studies are optional depth.
app.get('/', (req, res) => {
  const c = load();
  res.render('index', {
    title: `${c.site.name} — ${c.site.role}`,
    description: c.site.tagline,
    ...c
  });
});

// Old multi-page URLs now point at the matching section.
const SECTION_REDIRECTS = {
  '/work': '/#work',
  '/projects': '/#work',
  '/services': '/#services',
  '/about': '/#about',
  '/contact': '/#contact'
};
Object.entries(SECTION_REDIRECTS).forEach(([from, to]) => {
  app.get(from, (req, res) => res.redirect(301, to));
});

app.get('/work/:slug', (req, res, next) => {
  const c = load();
  const internal = c.projects.filter((p) => !p.link);
  const index = internal.findIndex((p) => p.slug === req.params.slug);
  if (index === -1) return next();

  res.render('project', {
    title: `${internal[index].title} — ${c.site.name}`,
    description: internal[index].summary,
    project: internal[index],
    next: internal[(index + 1) % internal.length],
    footer: c.footer
  });
});

/* ------------------------------------------------------------ resources */

app.get('/resume', (req, res) => res.redirect('/resume.pdf'));

app.get('/sitemap.xml', (req, res) => {
  const base = process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
  const urls = ['/'].concat(load().projects.filter((p) => !p.link).map((p) => `/work/${p.slug}`));
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls.map((u) => `  <url><loc>${base}${u}</loc></url>`).join('\n') +
      `\n</urlset>\n`
  );
});

app.get('/robots.txt', (req, res) => {
  const base = process.env.SITE_URL || `${req.protocol}://${req.get('host')}`;
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
});

/* ------------------------------------------------------------ fallbacks */

app.use((req, res) => {
  const c = load();
  res.status(404).render('404', { title: `Not found — ${c.site.name}`, description: 'That page does not exist.', footer: c.footer });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('404', {
    title: 'Something broke',
    description: 'An unexpected error occurred.',
    footer: load().footer
  });
});

// Only listen when run directly — `build.js` imports the app instead.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  ${load().site.name} — portfolio`);
    console.log(`  site   http://localhost:${PORT}`);
    console.log(`  admin  http://localhost:${PORT}/admin\n`);
  });
}

module.exports = app;
