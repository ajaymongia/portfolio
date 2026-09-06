'use strict';

const crypto = require('crypto');

/**
 * Single-user auth for the admin panel. Credentials come from the
 * environment, never from a file in the repo.
 */

const USER = process.env.ADMIN_USER || 'admin';
const PASS = process.env.ADMIN_PASSWORD || '';

/** Constant-time compare, so a wrong password cannot be found by timing. */
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  // Hash first: timingSafeEqual throws on length mismatch, which itself leaks.
  const ha = crypto.createHash('sha256').update(ba).digest();
  const hb = crypto.createHash('sha256').update(bb).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function check(user, password) {
  if (!PASS) return false; // no password configured: admin stays closed
  return safeEqual(user, USER) && safeEqual(password, PASS);
}

function isConfigured() {
  return Boolean(PASS);
}

/**
 * The admin is a local editing tool, not a hosted service. This refuses any
 * request that did not come from the machine the server is running on, so
 * the panel stays closed even if the app is ever deployed somewhere public.
 * Set ADMIN_ALLOW_REMOTE=1 only if you deliberately want otherwise.
 */
function localOnly(req, res, next) {
  if (process.env.ADMIN_ALLOW_REMOTE === '1') return next();

  const ip = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  const isLoopback = ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';

  // A forwarding header means a proxy is in front of us — not local.
  const proxied = req.headers['x-forwarded-for'] || req.headers['x-real-ip'];

  if (isLoopback && !proxied) return next();

  res.status(404).type('text/plain').send('Not found');
}

/** Gate for every admin route except the login screen itself. */
function requireLogin(req, res, next) {
  if (req.session && req.session.admin) return next();
  if (req.method === 'GET') req.session.returnTo = req.originalUrl;
  return res.redirect('/admin/login');
}

module.exports = { check, isConfigured, requireLogin, localOnly, USER };
