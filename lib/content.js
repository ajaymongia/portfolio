'use strict';

/**
 * The content store.
 *
 * Every piece of site copy lives in content/*.json. The public site reads
 * through here; the admin panel writes through here. Reads are cached and
 * the cache is dropped on write, so an edit shows up on the next request
 * without a restart.
 */

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'content');

const FILES = [
  'site',
  'sections',
  'projects',
  'visuals',
  'services',
  'experience',
  'recommendations',
  'scrapbook',
  'tools',
  'footer'
];

const cache = new Map();

function file(name) {
  if (!FILES.includes(name)) throw new Error(`Unknown content file: ${name}`);
  return path.join(DIR, `${name}.json`);
}

function read(name) {
  if (cache.has(name)) return cache.get(name);
  const value = JSON.parse(fs.readFileSync(file(name), 'utf8'));
  cache.set(name, value);
  return value;
}

/** Write atomically — a crash mid-write must not leave a truncated file. */
function write(name, value) {
  const dest = file(name);
  const tmp = `${dest}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, dest);
  cache.delete(name);
  return value;
}

/** Everything at once, for rendering a page. */
function all() {
  return FILES.reduce((acc, name) => {
    acc[name] = read(name);
    return acc;
  }, {});
}

function clearCache() {
  cache.clear();
}

/**
 * Editing a content file by hand while the server is running would
 * otherwise keep serving the cached copy. Watching the directory means
 * both routes into the data — the admin and a text editor — behave the
 * same way. Watching is best-effort; the admin does not depend on it.
 */
function watch() {
  try {
    fs.watch(DIR, { persistent: false }, (event, filename) => {
      if (!filename) return clearCache();
      const name = filename.replace(/\.json$/, '');
      if (FILES.includes(name)) cache.delete(name);
    });
  } catch (err) {
    // Not fatal: the admin clears the cache on every write anyway.
    console.warn('  could not watch content/:', err.message);
  }
}

/* ------------------------------------------------------------ helpers */

/** Stable-ish id for list items, so edit URLs survive reordering. */
function nextId(list, key = 'id') {
  const used = new Set(list.map((item) => item[key]).filter(Boolean));
  let n = list.length + 1;
  let id;
  do {
    id = `item-${n++}`;
  } while (used.has(id));
  return id;
}

/** Every list item gets an id the admin can address it by. */
function ensureIds(name) {
  const list = read(name);
  if (!Array.isArray(list)) return list;
  let changed = false;
  list.forEach((item) => {
    if (!item.id) {
      item.id = item.slug || nextId(list);
      changed = true;
    }
  });
  if (changed) write(name, list);
  return list;
}

module.exports = { read, write, all, clearCache, watch, ensureIds, nextId, FILES, DIR };
