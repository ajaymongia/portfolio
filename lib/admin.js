'use strict';

const express = require('express');
const content = require('./content');
const auth = require('./auth');
const { upload, webPath } = require('./uploads');
const F = require('./forms');

const router = express.Router();

// Local machine only — before anything else, including the login screen.
router.use(auth.localOnly);

/* ------------------------------------------------------------- helpers */

function render(res, view, locals = {}) {
  res.render(`admin/${view}`, { layout: null, ...locals });
}

/** Move an item within a list; returns true when it moved. */
function move(list, index, dir) {
  const target = index + (dir === 'up' ? -1 : 1);
  if (index < 0 || target < 0 || target >= list.length) return false;
  const [item] = list.splice(index, 1);
  list.splice(target, 0, item);
  return true;
}

function findIndex(list, id) {
  return list.findIndex((item) => String(item.id) === String(id));
}

/** Keep an existing image unless a new one was uploaded or it was cleared. */
function imageField(req, current, field = 'remove_image') {
  if (req.body[field] === '1') return null;
  return webPath(req.file) || current || null;
}

function flash(req, message) {
  req.session.flash = message;
}

/* ------------------------------------------------------- card lists
   Six things are edited the same way: a list of cards you can add to,
   edit in place, reorder and delete. Rather than write that six times,
   `cardList` registers the four routes for one of them.

   `key` addresses a list nested inside a file — clients and nav live in
   site.json, tools and footer links in their own. */

function getList(file, key) {
  const doc = content.read(file);
  return key ? doc[key] : doc;
}

function putList(file, key, list) {
  if (!key) return content.write(file, list);
  const doc = content.read(file);
  doc[key] = list;
  return content.write(file, doc);
}

function cardList(mount, { file, key = null, redirect, build, hasImage = false, label = 'Item' }) {
  const save = hasImage ? upload.single('image') : (req, res, next) => next();

  router.post(`${mount}/:id`, save, (req, res) => {
    const list = getList(file, key);
    const index = req.params.id === 'new' ? -1 : findIndex(list, req.params.id);
    const existing = index === -1 ? {} : list[index];

    const item = build(req, existing, list);
    item.id = existing.id || content.nextId(list);
    if (hasImage) item.logo = imageField(req, existing.logo, 'remove_image');

    if (index === -1) list.push(item);
    else list[index] = item;

    putList(file, key, list);
    flash(req, `${label} saved.`);
    res.redirect(redirect);
  });

  router.post(`${mount}/:id/delete`, (req, res) => {
    const list = getList(file, key);
    const index = findIndex(list, req.params.id);
    if (index !== -1) {
      list.splice(index, 1);
      putList(file, key, list);
      flash(req, `${label} deleted.`);
    }
    res.redirect(redirect);
  });

  router.post(`${mount}/:id/move`, (req, res) => {
    const list = getList(file, key);
    if (move(list, findIndex(list, req.params.id), req.body.dir)) putList(file, key, list);
    res.redirect(redirect);
  });
}

/* --------------------------------------------------------------- login */

router.get('/login', (req, res) => {
  if (req.session.admin) return res.redirect('/admin');
  render(res, 'login', {
    title: 'Sign in',
    error: req.query.error ? 'Wrong username or password.' : null,
    configured: auth.isConfigured()
  });
});

router.post('/login', express.urlencoded({ extended: false }), (req, res) => {
  if (!auth.check(req.body.username, req.body.password)) {
    return res.redirect('/admin/login?error=1');
  }
  req.session.admin = true;
  const back = req.session.returnTo || '/admin';
  delete req.session.returnTo;
  res.redirect(back);
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

/* ---------------------------------------------- everything below is gated */

router.use(auth.requireLogin);
router.use(express.urlencoded({ extended: false, limit: '2mb' }));

// Values every admin view relies on.
router.use((req, res, next) => {
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.path = req.baseUrl + req.path;
  res.locals.counts = {
    projects: content.read('projects').length,
    clients: content.read('site').clients.length,
    tools: content.read('tools').length,
    visuals: content.read('visuals').length,
    services: content.read('services').length,
    recommendations: content.read('recommendations').length,
    roles: content.read('experience').roles.length
  };
  next();
});

router.get('/', (req, res) => {
  render(res, 'dashboard', { title: 'Dashboard', site: content.read('site') });
});

/* ---------------------------------------------------------- navigation */

router.get('/navigation', (req, res) => {
  render(res, 'navigation', { title: 'Navigation', site: content.read('site') });
});

router.post('/navigation/brand', (req, res) => {
  const site = content.read('site');
  site.shortName = F.str(req.body.shortName, site.shortName);
  content.write('site', site);
  flash(req, 'Brand name saved.');
  res.redirect('/admin/navigation');
});

cardList('/navigation/links', {
  file: 'site',
  key: 'nav',
  redirect: '/admin/navigation',
  label: 'Menu link',
  build: (req) => ({ label: F.str(req.body.label, 'Link'), href: F.str(req.body.href, '#') })
});

/* ---------------------------------------------------- site / identity */

router.get('/site', (req, res) => {
  render(res, 'site', { title: 'Your details', site: content.read('site'), F });
});

router.post('/site', upload.single('portrait'), (req, res) => {
  const site = content.read('site');
  const b = req.body;

  site.name = F.str(b.name, site.name);
  site.shortName = F.str(b.shortName, site.shortName);
  site.role = F.str(b.role, site.role);
  site.tagline = F.str(b.tagline, site.tagline);
  site.location = F.str(b.location, site.location);
  site.email = F.str(b.email, site.email);
  site.phone = F.str(b.phone, site.phone);
  site.phoneHref = F.str(b.phoneHref, site.phoneHref);
  site.yearsExperience = F.str(b.yearsExperience, site.yearsExperience);

  site.hero = {
    eyebrow: F.str(b.hero_eyebrow),
    lead: F.str(b.hero_lead),
    highlight: F.str(b.hero_highlight),
    tail: F.str(b.hero_tail),
    sub: F.str(b.hero_sub)
  };

  site.stats = F.lines(b.stats)
    .map((line) => {
      const idx = line.indexOf('|');
      if (idx === -1) return null;
      return { value: line.slice(0, idx).trim(), label: line.slice(idx + 1).trim() };
    })
    .filter(Boolean);

  site.socials = F.pairs(b.socials);

  site.portrait = imageField(req, site.portrait, 'remove_portrait');
  site.portraitVideo = F.orNull(b.portraitVideo);

  content.write('site', site);
  flash(req, 'Your details are saved.');
  res.redirect('/admin/site');
});

/* --------------------------------------------------- section headings */

router.get('/sections', (req, res) => {
  render(res, 'sections', { title: 'Sections', sections: content.read('sections') });
});

const SECTIONS_WITH_COPY = ['work', 'visuals', 'services', 'experience', 'recognition', 'recommendations', 'contact'];
const SECTIONS_PLAIN = ['stats', 'brands', 'about', 'alsoFor'];

router.post('/sections', (req, res) => {
  const s = content.read('sections');

  SECTIONS_WITH_COPY.forEach((key) => {
    s[key] = {
      visible: req.body[`${key}_visible`] === '1',
      heading: F.str(req.body[`${key}_heading`]),
      note: F.str(req.body[`${key}_note`])
    };
  });
  SECTIONS_PLAIN.forEach((key) => {
    s[key] = { visible: req.body[`${key}_visible`] === '1' };
  });

  s.marqueeLabel = F.str(req.body.marqueeLabel);
  s.alsoForLabel = F.str(req.body.alsoForLabel);
  content.write('sections', s);

  const off = [...SECTIONS_WITH_COPY, ...SECTIONS_PLAIN].filter((k) => !s[k].visible);
  flash(req, off.length ? `Saved. Hidden: ${off.join(', ')}.` : 'Saved. All sections are visible.');
  res.redirect('/admin/sections');
});

/* -------------------------------------------------------------- footer */

router.get('/footer', (req, res) => {
  render(res, 'footer', { title: 'Footer', footer: content.read('footer') });
});

router.post('/footer', (req, res) => {
  const footer = content.read('footer');
  footer.hand = F.str(req.body.hand);
  content.write('footer', footer);
  flash(req, 'Footer saved.');
  res.redirect('/admin/footer');
});

cardList('/footer/links', {
  file: 'footer',
  key: 'links',
  redirect: '/admin/footer',
  label: 'Footer link',
  build: (req) => ({ label: F.str(req.body.label, 'Link'), href: F.str(req.body.href, '#') })
});

/* ------------------------------------------------------------ projects */

router.get('/projects', (req, res) => {
  render(res, 'projects', { title: 'Projects', projects: content.ensureIds('projects') });
});

router.get('/projects/new', (req, res) => {
  render(res, 'project-edit', { title: 'New project', project: null, F });
});

router.get('/projects/:id', (req, res, next) => {
  const list = content.ensureIds('projects');
  const project = list[findIndex(list, req.params.id)];
  if (!project) return next();
  render(res, 'project-edit', { title: project.title, project, F });
});

router.post('/projects/:id', upload.single('thumb'), (req, res) => {
  const list = content.ensureIds('projects');
  const isNew = req.params.id === 'new';
  const index = isNew ? -1 : findIndex(list, req.params.id);
  const existing = index === -1 ? {} : list[index];
  const b = req.body;

  const project = {
    ...existing,
    id: existing.id || content.nextId(list),
    slug: F.slugify(b.slug || b.title, existing.slug || 'project'),
    title: F.str(b.title, 'Untitled'),
    subtitle: F.str(b.subtitle),
    mark: F.str(b.mark) || F.str(b.title).slice(0, 3).toUpperCase(),
    categories: F.lines(b.categories),
    year: F.str(b.year),
    role: F.str(b.role),
    company: F.str(b.company),
    platform: F.str(b.platform),
    accent: F.str(b.accent, '#F4224E'),
    accentB: F.str(b.accentB, '#FF8A00'),
    featured: b.featured === '1',
    link: F.orNull(b.link),
    linkLabel: F.str(b.linkLabel, 'View case study'),
    summary: F.str(b.summary),
    context: F.str(b.context),
    challenge: F.str(b.challenge),
    approach: F.blocks(b.approach),
    outcomes: F.lines(b.outcomes),
    contributions: F.lines(b.contributions),
    thumb: imageField(req, existing.thumb, 'remove_thumb')
  };

  if (index === -1) list.push(project);
  else list[index] = project;

  content.write('projects', list);
  flash(req, `“${project.title}” saved.`);
  res.redirect(`/admin/projects/${project.id}`);
});

router.post('/projects/:id/delete', (req, res) => {
  const list = content.ensureIds('projects');
  const index = findIndex(list, req.params.id);
  if (index !== -1) {
    const [removed] = list.splice(index, 1);
    content.write('projects', list);
    flash(req, `“${removed.title}” deleted.`);
  }
  res.redirect('/admin/projects');
});

router.post('/projects/:id/move', (req, res) => {
  const list = content.ensureIds('projects');
  if (move(list, findIndex(list, req.params.id), req.body.dir)) content.write('projects', list);
  res.redirect('/admin/projects');
});

/* ------------------------------------------------------ visual designs */

router.get('/visuals', (req, res) => {
  render(res, 'visuals', { title: 'Visual designs', visuals: content.ensureIds('visuals') });
});

router.post('/visuals/:id', upload.single('image'), (req, res) => {
  const list = content.ensureIds('visuals');
  const isNew = req.params.id === 'new';
  const index = isNew ? -1 : findIndex(list, req.params.id);
  const existing = index === -1 ? {} : list[index];

  const item = {
    ...existing,
    id: existing.id || content.nextId(list),
    title: F.str(req.body.title, 'Untitled'),
    tag: F.str(req.body.tag),
    caption: F.str(req.body.caption),
    src: imageField(req, existing.src, 'remove_image')
  };

  if (index === -1) list.push(item);
  else list[index] = item;
  content.write('visuals', list);
  flash(req, `“${item.title}” saved.`);
  res.redirect('/admin/visuals');
});

router.post('/visuals/:id/delete', (req, res) => {
  const list = content.ensureIds('visuals');
  const index = findIndex(list, req.params.id);
  if (index !== -1) { list.splice(index, 1); content.write('visuals', list); flash(req, 'Deleted.'); }
  res.redirect('/admin/visuals');
});

router.post('/visuals/:id/move', (req, res) => {
  const list = content.ensureIds('visuals');
  if (move(list, findIndex(list, req.params.id), req.body.dir)) content.write('visuals', list);
  res.redirect('/admin/visuals');
});

/* ----------------------------------------------------- recommendations */

router.get('/recommendations', (req, res) => {
  render(res, 'recommendations', { title: 'Recommendations', recommendations: content.ensureIds('recommendations') });
});

router.post('/recommendations/:id', upload.single('image'), (req, res) => {
  const list = content.ensureIds('recommendations');
  const isNew = req.params.id === 'new';
  const index = isNew ? -1 : findIndex(list, req.params.id);
  const existing = index === -1 ? {} : list[index];

  const item = {
    ...existing,
    id: existing.id || content.nextId(list),
    name: F.str(req.body.name, 'Unnamed'),
    role: F.str(req.body.role),
    quote: F.str(req.body.quote),
    featured: req.body.featured === '1',
    image: imageField(req, existing.image, 'remove_image')
  };

  if (index === -1) list.push(item);
  else list[index] = item;
  content.write('recommendations', list);
  flash(req, `${item.name} saved.`);
  res.redirect('/admin/recommendations');
});

router.post('/recommendations/:id/delete', (req, res) => {
  const list = content.ensureIds('recommendations');
  const index = findIndex(list, req.params.id);
  if (index !== -1) { list.splice(index, 1); content.write('recommendations', list); flash(req, 'Deleted.'); }
  res.redirect('/admin/recommendations');
});

router.post('/recommendations/:id/move', (req, res) => {
  const list = content.ensureIds('recommendations');
  if (move(list, findIndex(list, req.params.id), req.body.dir)) content.write('recommendations', list);
  res.redirect('/admin/recommendations');
});

/* ------------------------------------------------------------ services */

router.get('/services', (req, res) => {
  render(res, 'services', { title: 'Services', services: content.ensureIds('services'), F });
});

router.post('/services/:id', (req, res) => {
  const list = content.ensureIds('services');
  const isNew = req.params.id === 'new';
  const index = isNew ? -1 : findIndex(list, req.params.id);
  const existing = index === -1 ? {} : list[index];

  const item = {
    ...existing,
    id: existing.id || content.nextId(list),
    title: F.str(req.body.title, 'Untitled'),
    blurb: F.str(req.body.blurb),
    items: F.lines(req.body.items)
  };

  if (index === -1) list.push(item);
  else list[index] = item;
  content.write('services', list);
  flash(req, `“${item.title}” saved.`);
  res.redirect('/admin/services');
});

router.post('/services/:id/delete', (req, res) => {
  const list = content.ensureIds('services');
  const index = findIndex(list, req.params.id);
  if (index !== -1) { list.splice(index, 1); content.write('services', list); flash(req, 'Deleted.'); }
  res.redirect('/admin/services');
});

router.post('/services/:id/move', (req, res) => {
  const list = content.ensureIds('services');
  if (move(list, findIndex(list, req.params.id), req.body.dir)) content.write('services', list);
  res.redirect('/admin/services');
});

/* ------------------------------------------------------------- clients */

router.get('/clients', (req, res) => {
  const projects = content.ensureIds('projects');
  const projectIds = new Set(projects.map((p) => p.id));
  const clients = content.read('site').clients.map((c) => {
    const project = projects.find((p) => p.id === c.projectId);
    return {
      ...c,
      // A link to a deleted project reads as unlinked, which is also how
      // the site treats it.
      projectId: c.projectId && projectIds.has(c.projectId) ? c.projectId : null,
      projectTitle: project ? project.title : null
    };
  });

  render(res, 'clients', { title: 'Clients', clients, projects });
});

cardList('/clients/brands', {
  file: 'site',
  key: 'clients',
  redirect: '/admin/clients',
  label: 'Client',
  hasImage: true,
  build: (req) => ({
    name: F.str(req.body.name, 'Untitled'),
    projectId: F.orNull(req.body.projectId)
  })
});

/* --------------------------------------------------------------- tools */

router.get('/tools', (req, res) => {
  render(res, 'tools', {
    title: 'Tools',
    tools: content.read('tools'),
    intro: content.read('scrapbook').tools.intro
  });
});

router.post('/tools/intro', (req, res) => {
  const s = content.read('scrapbook');
  s.tools = { intro: F.str(req.body.intro) };
  content.write('scrapbook', s);
  flash(req, 'Intro saved.');
  res.redirect('/admin/tools');
});

cardList('/tools/items', {
  file: 'tools',
  redirect: '/admin/tools',
  label: 'Tool',
  hasImage: true,
  build: (req) => ({ name: F.str(req.body.name, 'Untitled'), note: F.str(req.body.note) })
});

/* ---------------------------------------------------------- experience */

router.get('/experience', (req, res) => {
  render(res, 'experience', { title: 'Experience', experience: content.read('experience'), F });
});

router.post('/experience', (req, res) => {
  const b = req.body;
  const roles = [];
  // Roles arrive as parallel arrays from repeated field names.
  const titles = [].concat(b.role_title || []);
  titles.forEach((title, i) => {
    if (!F.str(title)) return;
    roles.push({
      title: F.str(title),
      company: F.str([].concat(b.role_company || [])[i]),
      location: F.str([].concat(b.role_location || [])[i]),
      period: F.str([].concat(b.role_period || [])[i]),
      current: [].concat(b.role_current || [])[i] === '1',
      points: F.lines([].concat(b.role_points || [])[i])
    });
  });

  const recognition = F.blocks(b.recognition).map((item) => {
    // "Title | Org" on the first line, detail underneath.
    const idx = item.title.indexOf('|');
    return {
      title: idx === -1 ? item.title : item.title.slice(0, idx).trim(),
      org: idx === -1 ? '' : item.title.slice(idx + 1).trim(),
      detail: item.body
    };
  });

  content.write('experience', { roles, recognition });
  flash(req, 'Experience saved.');
  res.redirect('/admin/experience');
});

/* ----------------------------------------------------------- scrapbook */

router.get('/scrapbook', (req, res) => {
  render(res, 'scrapbook', { title: 'About collage', scrapbook: content.read('scrapbook'), F });
});

router.post('/scrapbook', (req, res) => {
  const b = req.body;
  const s = content.read('scrapbook');
  content.write('scrapbook', {
    ...s,
    heading: F.str(b.heading),
    sub: F.str(b.sub),
    intro: { greeting: F.str(b.greeting), role: F.str(b.introRole), line: F.str(b.introLine) },
    located: F.str(b.located),
    notes: F.lines(b.notes).map((text) => ({ text })),
    funFact: {
      title: F.str(b.fun_title),
      items: F.lines(b.fun_items),
      kicker: F.str(b.fun_kicker),
      flow: F.str(b.fun_flow)
    },
    overlap: { caption: F.str(b.overlap_caption), words: F.lines(b.overlap_words) },
    photoCaption: F.str(b.photoCaption),
    tools: { intro: F.str(b.tools_intro) },
    badge: { label: F.str(b.badge_label), org: F.str(b.badge_org) }
  });
  flash(req, 'Collage saved.');
  res.redirect('/admin/scrapbook');
});

/* -------------------------------------------------------------- résumé */

router.post('/resume', upload.single('resume'), (req, res) => {
  if (req.file) {
    const fs = require('fs');
    const path = require('path');
    fs.copyFileSync(
      path.join(__dirname, '..', 'public', 'uploads', req.file.filename),
      path.join(__dirname, '..', 'public', 'resume.pdf')
    );
    flash(req, 'Résumé replaced.');
  } else {
    flash(req, 'No file was selected.');
  }
  res.redirect('/admin/site');
});

module.exports = router;
