'use strict';

const fs = require('fs');
const path = require('path');
const { Store } = require('express-session');

/**
 * A session store backed by one JSON file.
 *
 * The default memory store drops everything on restart, which means every
 * code change signs you out. This is a single-user local tool, so a small
 * file is plenty — and it keeps you signed in across restarts.
 */
class FileStore extends Store {
  constructor(file) {
    super();
    this.file = file;
    this.sessions = new Map();
    this.load();
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      const now = Date.now();
      Object.entries(raw).forEach(([sid, entry]) => {
        // Drop anything already expired rather than carrying it forward.
        if (!entry.expires || entry.expires > now) this.sessions.set(sid, entry);
      });
    } catch (err) {
      if (err.code !== 'ENOENT') console.warn('  session store unreadable, starting fresh');
    }
  }

  persist() {
    const out = {};
    this.sessions.forEach((entry, sid) => { out[sid] = entry; });
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(out));
    } catch (err) {
      console.warn('  could not write session store:', err.message);
    }
  }

  get(sid, cb) {
    const entry = this.sessions.get(sid);
    if (!entry) return cb(null, null);
    if (entry.expires && entry.expires < Date.now()) {
      this.sessions.delete(sid);
      return cb(null, null);
    }
    cb(null, entry.data);
  }

  set(sid, session, cb) {
    const maxAge = session.cookie && session.cookie.maxAge;
    this.sessions.set(sid, {
      data: session,
      expires: maxAge ? Date.now() + maxAge : null
    });
    this.persist();
    cb(null);
  }

  destroy(sid, cb) {
    this.sessions.delete(sid);
    this.persist();
    cb(null);
  }

  touch(sid, session, cb) {
    this.set(sid, session, cb);
  }
}

module.exports = FileStore;
