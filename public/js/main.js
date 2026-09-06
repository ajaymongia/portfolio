/* =================================================================
   Motion layer.
   Everything here is an enhancement: with JS off, or with
   prefers-reduced-motion, the page is fully readable and usable.
   ================================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var raf = window.requestAnimationFrame.bind(window);

  /* ---------------------------------------------------- utilities */

  function onScroll(fn) {
    var ticking = false;
    var run = function () {
      fn();
      ticking = false;
    };
    var handler = function () {
      if (ticking) return;
      ticking = true;
      raf(run);
    };
    window.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('resize', handler, { passive: true });
    fn();
  }

  function observe(elements, cb, options) {
    if (!('IntersectionObserver' in window)) {
      elements.forEach(cb);
      return null;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        cb(entry.target);
        io.unobserve(entry.target);
      });
    }, options || { rootMargin: '0px 0px -10% 0px', threshold: 0 });
    elements.forEach(function (el) { io.observe(el); });
    return io;
  }

  /* --------------------------------------------- word-level splitting
     Wraps every word in the element in a clipping span so headings can
     rise into view line by line. Preserves nested markup and <br>. */

  function splitWords(el) {
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue.trim()) nodes.push(node);
    }

    nodes.forEach(function (textNode) {
      var frag = document.createDocumentFragment();
      var parts = textNode.nodeValue.split(/(\s+)/);

      parts.forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(' '));
          return;
        }
        var outer = document.createElement('span');
        outer.className = 'word';
        var inner = document.createElement('span');
        inner.className = 'word-inner';
        inner.textContent = part;
        outer.appendChild(inner);
        frag.appendChild(outer);
      });

      textNode.parentNode.replaceChild(frag, textNode);
    });

    var words = el.querySelectorAll('.word-inner');
    Array.prototype.forEach.call(words, function (w, i) {
      w.style.transitionDelay = i * 42 + 'ms';
    });
    el.classList.add('is-split');
    return words.length;
  }

  /* ------------------------------------------------------ hero entry */

  function heroEntry() {
    var hero = document.querySelector('.hero-title');
    if (hero) splitWords(hero);

    // Nothing waits on scroll — the hero animates the moment it is ready.
    // rAF is paused in background tabs, so a timer backs it up.
    var ready = function () { root.classList.add('is-ready'); };
    raf(function () { raf(ready); });
    window.setTimeout(ready, 120);
  }

  /* ------------------------------------------------- scroll reveals */

  function reveals() {
    // Headings that split into rising words.
    var splits = document.querySelectorAll('[data-split]');
    Array.prototype.forEach.call(splits, function (el) {
      splitWords(el);
      el.classList.add('reveal-split');
    });
    observe(Array.prototype.slice.call(splits), function (el) { el.classList.add('is-in'); });

    // Plain fade-and-rise.
    var fades = document.querySelectorAll('[data-reveal]');
    Array.prototype.forEach.call(fades, function (el) { el.classList.add('reveal'); });
    observe(Array.prototype.slice.call(fades), function (el) { el.classList.add('is-in'); });

    // Children revealed in sequence.
    var groups = document.querySelectorAll('[data-stagger]');
    Array.prototype.forEach.call(groups, function (group) {
      var kids = group.children;
      Array.prototype.forEach.call(kids, function (kid, i) {
        kid.classList.add('reveal');
        kid.style.transitionDelay = Math.min(i, 8) * 70 + 'ms';
      });
    });
    observe(Array.prototype.slice.call(groups), function (group) {
      Array.prototype.forEach.call(group.children, function (kid) { kid.classList.add('is-in'); });
    });

    // Safety net: nothing may stay invisible if an observer misbehaves.
    window.setTimeout(function () {
      var hidden = document.querySelectorAll('.reveal:not(.is-in), .reveal-split:not(.is-in)');
      Array.prototype.forEach.call(hidden, function (el) {
        var box = el.getBoundingClientRect();
        if (box.top < window.innerHeight * 2) el.classList.add('is-in');
      });
    }, 3000);
  }

  /* --------------------------------------------------- number count */

  function counters() {
    var els = document.querySelectorAll('[data-count]');
    observe(Array.prototype.slice.call(els), function (el) {
      var raw = el.getAttribute('data-count');
      var target = parseInt(raw.replace(/\D/g, ''), 10);
      if (!target || REDUCED) return;

      var suffix = raw.replace(/[0-9]/g, '');
      var duration = 1100;
      var start = null;

      var step = function (now) {
        if (start === null) start = now;
        var p = Math.min((now - start) / duration, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) raf(step);
        else el.textContent = raw;
      };

      el.textContent = '0' + suffix;
      raf(step);
    }, { threshold: 0.4 });
  }

  /* -------------------------------------------------------- parallax */

  function parallax() {
    if (REDUCED) return;
    var layers = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
    var covers = Array.prototype.slice.call(document.querySelectorAll('.project-card .cover svg'));
    if (!layers.length && !covers.length) return;

    onScroll(function () {
      var vh = window.innerHeight;

      layers.forEach(function (el) {
        var rate = parseFloat(el.getAttribute('data-parallax')) || 0.2;
        var box = el.getBoundingClientRect();
        if (box.bottom < -vh || box.top > vh * 2) return;
        // Only the offset — the transform itself stays in CSS, so the
        // element's own positioning is never clobbered.
        el.style.setProperty('--py', (-box.top * rate).toFixed(1) + 'px');
      });

      // Cover art drifts inside its frame as the card passes through view.
      covers.forEach(function (svg) {
        var box = svg.parentNode.getBoundingClientRect();
        if (box.bottom < 0 || box.top > vh) return;
        var progress = (box.top + box.height / 2 - vh / 2) / vh; // -1 … 1
        svg.style.setProperty('--drift', (progress * -18).toFixed(1) + 'px');
      });
    });
  }

  /* ----------------------------------------------------- card tilt */

  function tilt() {
    if (REDUCED || window.matchMedia('(hover: none)').matches) return;
    var cards = document.querySelectorAll('[data-tilt]');

    Array.prototype.forEach.call(cards, function (card) {
      var frame = null;

      card.addEventListener('pointermove', function (e) {
        if (frame) return;
        frame = raf(function () {
          frame = null;
          var box = card.getBoundingClientRect();
          var x = (e.clientX - box.left) / box.width;
          var y = (e.clientY - box.top) / box.height;
          card.style.setProperty('--rx', ((0.5 - y) * 5).toFixed(2) + 'deg');
          card.style.setProperty('--ry', ((x - 0.5) * 6).toFixed(2) + 'deg');
          card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
          card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
        });
      });

      card.addEventListener('pointerleave', function () {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* ------------------------------------------------ magnetic buttons */

  function magnetic() {
    if (REDUCED || window.matchMedia('(hover: none)').matches) return;
    var targets = document.querySelectorAll('.btn-accent, .nav-mark');

    Array.prototype.forEach.call(targets, function (el) {
      el.addEventListener('pointermove', function (e) {
        var box = el.getBoundingClientRect();
        var dx = (e.clientX - (box.left + box.width / 2)) * 0.18;
        var dy = (e.clientY - (box.top + box.height / 2)) * 0.28;
        el.style.setProperty('--mag-x', dx.toFixed(1) + 'px');
        el.style.setProperty('--mag-y', dy.toFixed(1) + 'px');
      });
      el.addEventListener('pointerleave', function () {
        el.style.setProperty('--mag-x', '0px');
        el.style.setProperty('--mag-y', '0px');
      });
    });
  }

  /* ------------------------------------------- scroll progress bar */

  function progress() {
    var bar = document.querySelector('.scroll-progress span');
    if (!bar) return;
    onScroll(function () {
      var max = document.body.scrollHeight - window.innerHeight;
      var p = max > 0 ? window.scrollY / max : 0;
      bar.style.transform = 'scaleX(' + Math.min(Math.max(p, 0), 1).toFixed(4) + ')';
    });
  }

  /* ------------------------------------------------- nav + scrollspy */

  function nav() {
    var wrap = document.querySelector('.nav-wrap');
    if (wrap) {
      onScroll(function () {
        wrap.classList.toggle('nav-scrolled', window.scrollY > 24);
      });
    }

    var toggle = document.querySelector('.nav-toggle');
    var menu = document.getElementById('mobile-menu');
    if (toggle && menu) {
      var setOpen = function (open) {
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        menu.hidden = !open;
        void menu.offsetHeight; // flush layout so the transition has a start value
        menu.classList.toggle('is-open', open);
      };

      toggle.addEventListener('click', function () {
        setOpen(toggle.getAttribute('aria-expanded') !== 'true');
      });
      menu.addEventListener('click', function (e) {
        if (e.target.tagName === 'A') setOpen(false);
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') setOpen(false);
      });
      document.addEventListener('click', function (e) {
        if (!menu.hidden && !menu.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
      });
    }

    // Scrollspy — highlight the section currently in view.
    var links = Array.prototype.slice.call(document.querySelectorAll('.nav-link[data-spy]'));
    if (!links.length) return;

    var sections = links
      .map(function (link) {
        return { link: link, el: document.getElementById(link.getAttribute('data-spy')) };
      })
      .filter(function (s) { return s.el; });

    onScroll(function () {
      var marker = window.scrollY + window.innerHeight * 0.32;
      var active = null;
      sections.forEach(function (s) {
        if (s.el.offsetTop <= marker) active = s;
      });
      links.forEach(function (l) { l.classList.remove('is-active'); });
      if (active) active.link.classList.add('is-active');
    });
  }

  /* --------------------------------------------------- smooth anchors */

  function anchors() {
    // A page loaded at #section can land in the wrong place once webfonts
    // swap in and change the measure. Re-apply the offset after it settles.
    if (location.hash.length > 1) {
      var landing = document.getElementById(location.hash.slice(1));
      if (landing) {
        var settle = function () {
          window.scrollTo({ top: landing.getBoundingClientRect().top + window.scrollY - 90, behavior: 'auto' });
        };
        window.setTimeout(settle, 60);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
      }
    }

    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;
      var id = link.getAttribute('href').slice(1);
      if (!id) return;
      var target = document.getElementById(id);
      if (!target) return;

      e.preventDefault();
      var top = id === 'top' ? 0 : target.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: top, behavior: REDUCED ? 'auto' : 'smooth' });
      history.replaceState(null, '', id === 'top' ? location.pathname : '#' + id);
    });
  }

  /* -------------------------------------------------------- carousels
     Native horizontal scrolling with snap points, plus buttons, drag,
     and a progress bar. With JS off it is still a scrollable strip. */

  function carousels() {
    var roots = document.querySelectorAll('[data-carousel]');

    Array.prototype.forEach.call(roots, function (root) {
      var viewport = root.querySelector('.carousel-viewport');
      var track = root.querySelector('.carousel-track');
      var prev = root.querySelector('[data-carousel-prev]');
      var next = root.querySelector('[data-carousel-next]');
      var bar = root.querySelector('[data-carousel-bar]');
      if (!viewport || !track) return;

      root.classList.add('is-enhanced');

      /* Metrics are cached so the scroll handler never forces layout, and
         so `update` can run synchronously rather than waiting on rAF
         (which is paused while the tab is not painting). */
      var max = 0;
      var stepBy = 0;
      var EDGE = 4; // snap points and sub-pixel rounding land near, not on, the edge

      var measure = function () {
        max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);

        var item = track.firstElementChild;
        if (item) {
          var gap = parseFloat(getComputedStyle(track).columnGap || '0') || 0;
          var one = item.getBoundingClientRect().width + gap;
          // Advance by whole items, but never more than a viewport at a time.
          var fit = Math.max(1, Math.floor(viewport.clientWidth / one));
          stepBy = one * fit;
        } else {
          stepBy = viewport.clientWidth;
        }
      };

      var update = function () {
        var x = viewport.scrollLeft;
        var atStart = x <= EDGE;
        var atEnd = x >= max - EDGE;

        if (prev) prev.disabled = atStart;
        if (next) next.disabled = atEnd;
        root.classList.toggle('at-start', atStart);
        root.classList.toggle('at-end', atEnd);
        // Nothing to scroll: hide the controls entirely.
        root.classList.toggle('is-static', max < 2);
        if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(x / max, 1) : 1).toFixed(4) + ')';
      };

      var remeasure = function () {
        measure();
        update();
      };

      var go = function (dir) {
        viewport.scrollBy({ left: dir * stepBy, behavior: REDUCED ? 'auto' : 'smooth' });
      };

      if (prev) prev.addEventListener('click', function () { go(-1); });
      if (next) next.addEventListener('click', function () { go(1); });

      viewport.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', remeasure, { passive: true });

      viewport.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      });

      /* drag to scroll, pointer only — touch already scrolls natively */
      var dragging = false;
      var startX = 0;
      var startScroll = 0;
      var moved = 0;

      viewport.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'touch') return;
        dragging = true;
        moved = 0;
        startX = e.clientX;
        startScroll = viewport.scrollLeft;
        root.classList.add('is-dragging');
      });

      viewport.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        var dx = e.clientX - startX;
        moved = Math.abs(dx);
        if (moved > 3) viewport.setPointerCapture(e.pointerId);
        viewport.scrollLeft = startScroll - dx;
      });

      var endDrag = function () {
        if (!dragging) return;
        dragging = false;
        root.classList.remove('is-dragging');
      };
      viewport.addEventListener('pointerup', endDrag);
      viewport.addEventListener('pointercancel', endDrag);
      viewport.addEventListener('pointerleave', endDrag);

      // A drag should not follow a link inside a slide.
      viewport.addEventListener('click', function (e) {
        if (moved > 5) { e.preventDefault(); e.stopPropagation(); }
      }, true);

      /* ---- optional auto-scroll ----
         The track is duplicated once so the drift can wrap seamlessly.
         Snapping is turned off while looping — mandatory snap fights a
         continuous scroll. Manual controls keep working throughout. */
      var loopSpeed = parseFloat(root.getAttribute('data-autoscroll'));

      if (loopSpeed > 0 && !REDUCED) {
        var originals = Array.prototype.slice.call(track.children);
        originals.forEach(function (item) {
          var clone = item.cloneNode(true);
          clone.setAttribute('aria-hidden', 'true');
          // Cloned slides must not be reachable by keyboard or screen readers.
          Array.prototype.forEach.call(clone.querySelectorAll('a, button, input, video'), function (el) {
            el.setAttribute('tabindex', '-1');
          });
          track.appendChild(clone);
        });

        root.classList.add('is-looping');

        var paused = false;
        var offScreen = false;
        var resumeTimer = null;
        var last = 0;

        var holdOff = function (ms) {
          paused = true;
          window.clearTimeout(resumeTimer);
          resumeTimer = window.setTimeout(function () { paused = false; }, ms || 2500);
        };

        ['pointerenter', 'focusin'].forEach(function (evt) {
          root.addEventListener(evt, function () { paused = true; window.clearTimeout(resumeTimer); });
        });
        ['pointerleave', 'focusout'].forEach(function (evt) {
          root.addEventListener(evt, function () { holdOff(600); });
        });
        // Any manual interaction wins for a while.
        viewport.addEventListener('wheel', function () { holdOff(); }, { passive: true });
        viewport.addEventListener('touchstart', function () { holdOff(); }, { passive: true });
        if (prev) prev.addEventListener('click', function () { holdOff(6000); });
        if (next) next.addEventListener('click', function () { holdOff(6000); });

        /* Visibility is measured here rather than through an
           IntersectionObserver. An observer that misses its callback
           leaves the track paused for good; a rect read cannot get stuck.
           It is throttled to four times a second, so the cost is trivial. */
        var visCheckedAt = 0;
        var checkOnScreen = function (now) {
          if (now - visCheckedAt < 250) return;
          visCheckedAt = now;
          var box = root.getBoundingClientRect();
          offScreen = box.bottom < 0 || box.top > window.innerHeight;
        };

        // scrollLeft is not guaranteed to keep sub-pixel precision, so the
        // position is tracked here and written out, not read back.
        var pos = viewport.scrollLeft;

        var drift = function (now) {
          var dt = last ? Math.min(now - last, 64) : 16;
          last = now;
          checkOnScreen(now);

          if (!paused && !offScreen && document.visibilityState !== 'hidden') {
            var half = viewport.scrollWidth / 2;
            // A manual scroll or drag moves the viewport out from under us.
            if (Math.abs(viewport.scrollLeft - pos) > 2) pos = viewport.scrollLeft;
            pos += (loopSpeed * dt) / 1000;
            // Wrap into the duplicate, which is pixel-identical, so the
            // jump is invisible.
            if (half > 0 && pos >= half) pos -= half;
            viewport.scrollLeft = pos;
          }
          raf(drift);
        };
        raf(drift);
      }

      remeasure();
      // Slide widths shift once webfonts and lazy images have settled.
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
      window.addEventListener('load', remeasure);
      if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(track);
    });
  }

  /* ------------------------------------------------------- video swap
     The still is what renders. The clip is built in JavaScript, kept out
     of the document until a frame has actually been decoded, and only
     then inserted and faded in. A <video> with no decoded frame paints as
     an opaque black rectangle, so keeping it out of the tree until it has
     something to show is what stops the black patch on first load.

     The still stays if anything goes wrong: no clip, blocked autoplay,
     reduced motion, or a metered connection. */

  function videoSwap() {
    var hosts = Array.prototype.slice.call(document.querySelectorAll('[data-video-swap]'));
    if (!hosts.length || REDUCED) return;

    var conn = navigator.connection;
    if (conn && (conn.saveData || /^(slow-)?2g$/.test(conn.effectiveType || ''))) return;

    function build(host) {
      var src = host.getAttribute('data-video-src');
      if (!src || host._videoStarted) return;
      host._videoStarted = true;

      var video = document.createElement('video');
      video.className = host.getAttribute('data-video-class') || '';
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('aria-hidden', 'true');
      video.tabIndex = -1;
      video.preload = 'auto';

      var settled = false;

      var fail = function () {
        if (settled) return;
        settled = true;
        video.removeAttribute('src');
        video.load();
      };

      // Only now is there something to look at.
      var present = function () {
        if (settled) return;
        settled = true;
        host.appendChild(video);
        // Let the browser paint the frame before the fade begins.
        raf(function () {
          raf(function () { host.classList.add('video-ready'); });
        });
        watchVisibility(host, video);
      };

      video.addEventListener('error', fail);

      video.src = src;

      var tryPlay = function () {
        var attempt = video.play();
        if (!attempt || !attempt.catch) return;
        attempt.catch(function (err) {
          // Only a policy refusal means we should give up and keep the
          // still. An AbortError is the browser pausing video-only media
          // to save power on a background tab — the media is loaded and
          // fine, and it gets started again once it is on screen.
          if (err && err.name === 'NotAllowedError') fail();
        });
      };
      tryPlay();

      // Power-saving pauses are lifted when the page is looked at again.
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible' && video.paused && video.isConnected) tryPlay();
      });

      if ('requestVideoFrameCallback' in video) {
        // Fires once a frame is decoded and ready to present — exactly the
        // moment the element has real pixels rather than black.
        video.requestVideoFrameCallback(present);
      }

      // Backstop for browsers without the frame callback, and for anywhere
      // frame presentation is throttled (a background tab, an embedded
      // view). HAVE_FUTURE_DATA means a frame is decoded and ready, which
      // is the guarantee that matters — the clock need not have moved.
      var poll = function () {
        if (settled) return;
        if (video.readyState >= 3) return present();
        window.setTimeout(poll, 120);
      };
      window.setTimeout(poll, 120);

      // Give up only on a genuinely stalled download. If the data has
      // arrived and presentation is merely deferred (a hidden tab), keep
      // waiting rather than tearing the clip down for good.
      window.setTimeout(function () {
        if (settled || video.readyState >= 2) return;
        fail();
      }, 20000);
    }

    // Off-screen clips should not keep decoding.
    function watchVisibility(host, video) {
      if (!('IntersectionObserver' in window)) return;
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var p = video.play();
            if (p && p.catch) p.catch(function () {});
          } else {
            video.pause();
          }
        });
      }, { threshold: 0.1 }).observe(host);
    }

    function begin() {
      hosts.forEach(function (host) {
        if (!host.hasAttribute('data-in-view-only')) return build(host);

        if (!('IntersectionObserver' in window)) return build(host);
        var io = new IntersectionObserver(function (entries) {
          if (!entries[0].isIntersecting) return;
          io.disconnect();
          build(host);
        }, { rootMargin: '300px' });
        io.observe(host);
      });
    }

    var kickOff = function () { window.setTimeout(begin, 200); };

    // Never compete with the page's own load. Deliberately not gated on
    // `visibilityState`: some embedded views report `hidden` while the
    // page is plainly on screen, and gating there would leave the clip
    // permanently unplayed.
    if (document.readyState === 'complete') kickOff();
    else window.addEventListener('load', kickOff);
  }

  /* ------------------------------------------------------------ boot */

  heroEntry();
  reveals();
  counters();
  parallax();
  tilt();
  magnetic();
  progress();
  nav();
  anchors();
  carousels();
  videoSwap();
})();
