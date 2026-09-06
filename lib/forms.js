'use strict';

/**
 * Turning textarea content into structured data.
 *
 * Everything in the admin is a textarea, so these define the small
 * conventions that give lists and grouped items back.
 */

/** One item per line. Blank lines are ignored. */
function lines(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** A list back into textarea form. */
function toLines(list) {
  return (list || []).join('\n');
}

/**
 * Blocks separated by a blank line. The first line of each block is the
 * title, everything after it is the body:
 *
 *   Mapped the journey
 *   Walked the live flow on every platform…
 *
 *   Separated choosing from configuring
 *   Browsing and configuring were competing…
 */
function blocks(value) {
  return String(value || '')
    .split(/\r?\n\s*\r?\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [title, ...rest] = chunk.split(/\r?\n/);
      return { title: title.trim(), body: rest.join(' ').trim() };
    })
    .filter((item) => item.title);
}

function toBlocks(list) {
  return (list || []).map((item) => `${item.title}\n${item.body || ''}`).join('\n\n');
}

/** "Label | href" per line, for nav and footer links. */
function pairs(value, keyA = 'label', keyB = 'href') {
  return lines(value)
    .map((line) => {
      const idx = line.indexOf('|');
      if (idx === -1) return null;
      return { [keyA]: line.slice(0, idx).trim(), [keyB]: line.slice(idx + 1).trim() };
    })
    .filter((item) => item && item[keyA]);
}

function toPairs(list, keyA = 'label', keyB = 'href') {
  return (list || []).map((item) => `${item[keyA]} | ${item[keyB] || ''}`).join('\n');
}

/** Trimmed string, or a fallback when empty. */
function str(value, fallback = '') {
  const s = String(value == null ? '' : value).trim();
  return s || fallback;
}

/** Empty string becomes null, so "no value" is stored consistently. */
function orNull(value) {
  const s = str(value);
  return s || null;
}

/** URL-safe slug. */
function slugify(value, fallback = 'item') {
  const s = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || fallback;
}

module.exports = { lines, toLines, blocks, toBlocks, pairs, toPairs, str, orNull, slugify };
