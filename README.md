# Ajay Mongia — Portfolio

Single-page portfolio site with optional per-project case-study pages.
Node + Express + EJS, no build step.

```bash
npm install
npm run dev      # http://localhost:3000, restarts on change
npm start        # production
```

Set `NODE_ENV=production` in production — it turns on long-lived static
caching with a boot-time cache-busting stamp.

## Structure

```
server.js            the site's routes; also mounts the admin in development
build.js             pre-renders every page into ./dist for deployment
content/*.json       ALL site copy — written by the admin, read by the site
lib/
  content.js         the read/write layer both the site and admin go through
  admin.js           admin routes
  auth.js            login + the local-only lock
  uploads.js         image handling
  forms.js           turns textarea content into structured data
views/
  index.ejs          the single page
  project.ejs        a case-study page
  admin/             the admin panel
public/
  css/style.css      the site
  css/admin.css      the admin
  js/main.js         the motion layer
  img/portrait.png   hero + polaroid still
  img/portrait.mp4   optional looping clip that fades in over it
  img/visual/        visual design gallery images
  img/clients/       client logos for the carousel
  img/work/          project thumbnails
  uploads/           anything uploaded through the admin
  resume.pdf         served at /resume.pdf
```

Nothing is hard-coded in the templates any more. Every heading, label, list
and link comes from `content/*.json`.

## The admin panel

```bash
npm run admin        # then open http://localhost:3000/admin
```

Sign in with the credentials in `.env`. You can edit:

| Page | What it covers |
|---|---|
| Your details | Name, role, contact, hero copy, portrait, stats, résumé PDF |
| Navigation | Brand name, and menu links as reorderable cards |
| Sections | Show or hide any section, and edit its heading and intro line |
| Projects | Add, edit, reorder, delete case studies — including thumbnails |
| Visual designs | The image gallery, with uploads |
| Services | The numbered list; tags are chips |
| Clients | One list feeding both the brand strip and “Also delivered for” |
| Tools | The collage tool list — name, caption and logo per card |
| Experience | Roles, bullet points, recognition |
| About collage | All the scrapbook copy |
| Recommendations | Quotes, plus a photo for each person |
| Footer | Sign-off line, and links as reorderable cards |

### How the editors work

**Chips** — tags on services and projects, and the collage's big words. Type
and press Enter to add one, click × to remove, Backspace on an empty field
removes the last. Pasting `a, b, c` adds three at once. Underneath it is
still a plain textarea, so with JavaScript off the field keeps working.

**Cards** — menu links, footer links, clients and tools. Each is its own
card with Edit, ↑, ↓ and Delete. Links have separate Text and Link fields
rather than one combined line. Clients and tools take a logo upload; the
brand strip shows the logo when there is one and the name when there is not,
and the logo carousel falls back to a placeholder tile.

**Full-line lists** stay as textareas on purpose — case-study outcomes and
role bullet points are whole sentences, which read badly as chips.

### Showing and hiding sections

Every section has a switch on the **Sections** page — including the blocks
with no heading of their own (the stats row, the brand strip, the about
collage, the client logo carousel).

Hiding a section also drops any menu or footer link pointing at its anchor,
so turning off About cannot leave a “About” link jumping to nothing. Turn it
back on and the link returns.

### Clients are connected to projects

There is one client list, not two. Every client appears **by name** in the
scrolling brand strip — that row is set in large display type, so it never
uses logos. Each client can optionally be linked to a project, and **“Also
delivered for” is simply the clients that are not** — so it can never drift
out of step with your work:

- Add a case study for a client and link it → that client leaves the carousel
- Delete the project → the client returns to the carousel
- A link pointing at a deleted project counts as unlinked, so nothing ever
  vanishes from both places at once

The link is a dropdown on each client card. Nothing is matched by name, so
renaming a client or a project cannot break it.

A client's **logo is only used in the “Also delivered for” carousel**. Upload
one for a client that has a case study and it will go unused — the admin says
so on the card rather than letting you wonder.

### It is deliberately local-only

The admin is an editing tool for your machine, not a hosted service. Three
separate things keep it that way:

1. It is only mounted when `NODE_ENV` is not `production`.
2. Requests from anything but localhost get a 404 — including any request
   that arrives through a proxy.
3. Without `ADMIN_PASSWORD` set, it refuses every login.

So deploying this repo cannot expose it. To publish what you changed:

```bash
npm run build
git add -A && git commit -m "Update content" && git push
```

### Credentials

Copy `.env.example` to `.env` and fill it in:

```
ADMIN_USER=you
ADMIN_PASSWORD=something-long
SESSION_SECRET=any-long-random-string
SITE_URL=https://your-domain.com
```

`.env` is gitignored. Never commit it.

## Case studies: internal page or external link

Each project in `data/projects.js` has a `link` field:

```js
link: null,                          // -> opens the built-in case study
link: 'https://figma.com/proto/...', // -> opens that URL in a new tab
linkLabel: 'View the Figma prototype'
```

So you can keep the written case study for projects you want to explain,
and point straight at Figma, Behance or a PDF for the rest. Mix freely —
`sitemap.xml` only lists projects that still have an internal page.

## Project thumbnails

Each project also has a `thumb`:

```js
thumb: '/img/work/kfc.jpg',   // real cover image
thumb: null,                  // generated abstract cover (the default)
```

Drop images in `public/img/work/` (1600 × 1000 works well) and point `thumb`
at them. Anything still `null` keeps the generated cover built from that
project's `accent` / `accentB` colours and `mark`, so the grid never has a
hole in it while you are collecting artwork.

## Your portrait: still and clip

Both live in `public/img/` and are already wired up in `data/site.js`:

```js
portrait:      '/img/portrait.png',   // shown first
portraitVideo: '/img/portrait.mp4',   // fades in over it once playing
```

They appear in two places — the **hero**, standing at the right and bleeding
to the bottom edge, and the **scrapbook polaroid**.

**How the swap works.** The still renders immediately. The `<video>` is not
in the markup at all — it is built in JavaScript after `load`, kept out of
the document until a frame has actually been decoded, and only then inserted
and faded in. That ordering is deliberate: a `<video>` with no decoded frame
paints as an opaque black rectangle, so keeping it out of the tree is what
prevents a black patch on first load.

The still stays put if the clip errors, if autoplay is refused by policy, if
the visitor prefers reduced motion, or if the browser reports a metered or
2G connection. A browser pausing the clip to save power is *not* treated as
a failure — it resumes when the page is on screen. The polaroid clip waits
until it scrolls near the viewport, and pauses when it leaves.

**Why it composites cleanly.** The clip has a pure-black backdrop and no
alpha channel, so it is blended with `mix-blend-mode: lighten` — black falls
back to the page, everything brighter survives. No transparent video needed,
and no visible rectangle edge.

One constraint this places on the layout: `mix-blend-mode` only blends
against the backdrop up to the nearest ancestor that forms a **stacking
context**. Adding `z-index`, `transform`, `filter` or `opacity` to
`.hero-figure` or any ancestor isolates the clip and its black background
becomes opaque again. That is why the hero gradient sits at `z-index: -1`
rather than the figure being pushed above it.

The server checks both files exist at boot. Missing ones are logged and
skipped, so the page falls back to the still, and then to the "AM" monogram,
rather than ever showing something broken.

> The clip is currently ~8 MB. It is deferred so it never blocks the page,
> but compressing it (or serving a WebM alongside) is worth doing before
> launch.

## Hero copy

The headline lives in `data/site.js` under `hero`. `highlight` is the phrase
that gets the hand-drawn underline, so keep it short enough to sit on one
line:

```js
hero: {
  eyebrow: 'Senior UX/UI Designer · Design Lead',
  lead: 'I design complex products that',
  highlight: 'feel obvious',
  tail: 'to use.',
  sub: '...'
}
```

## Page sections

Hero → stats → brand strip → background collage → work → visual design →
services → experience → recognition → recommendations → contact.

Sections are plain blocks in `views/index.ejs`; delete or reorder them
freely. Headings carry no small label above them — the only two that remain
are on the brand marquee and the client logo strip, which have no heading of
their own.

## Carousels

One implementation covers all three. Add `data-autoscroll="<px per second>"`
to make a track drift continuously:

```html
<div class="carousel" data-carousel data-autoscroll="22">
```

Auto-scrolling tracks duplicate their slides once so the wrap is seamless,
turn off scroll-snap (mandatory snap fights a continuous scroll), and hide
the progress bar — a loop has no start or end. They pause on hover, on
focus, while off screen, while the tab is hidden, and for a few seconds
after any manual interaction. `prefers-reduced-motion` skips the drift and
the duplication entirely, leaving an ordinary manual carousel.

Currently: the visual gallery at 16 px/s, recommendations at 22 px/s, and
the client logo strip at 30 px/s. Slower reads as calmer — the gallery is
the slowest because those slides are meant to be looked at.

## Contact

The contact section is direct links only — email, phone, LinkedIn, résumé.
There is no form and no server-side form handling to maintain.

## Motion

`public/js/main.js` handles hero word reveals, scroll reveals with stagger,
stat count-up, scroll parallax, card tilt with a spotlight, magnetic
buttons, the scroll progress bar, scrollspy and smooth anchors.

All of it is progressive enhancement: with JavaScript off the page is fully
readable, and `prefers-reduced-motion: reduce` disables the animation.

## Deploying to Vercel

Nothing on the site is dynamic any more, so it is pre-rendered to static
files. That avoids serverless cold starts and function size limits, and runs
free on Vercel's Hobby plan.

```bash
npm run build      # renders every page into ./dist
npm run preview    # serves ./dist at http://localhost:4000 to check it
```

`build.js` starts the real Express app on an ephemeral port and fetches every
page from it, so the output is exactly what the server renders — there is no
second copy of the routing logic to keep in sync.

`vercel.json` sets the build command, the output directory, clean URLs, the
old-path redirects, and a one-year cache header for static assets.

### First deploy

1. Push the project to a GitHub repository.
2. On vercel.com: **Add New → Project**, import that repository.
3. Vercel reads `vercel.json`, so leave the framework preset as **Other** and
   do not override the build command or output directory.
4. Under **Environment Variables**, add `SITE_URL` set to your final domain
   (e.g. `https://ajaymongia.com`). This is only used for absolute URLs in
   `sitemap.xml` and `robots.txt`.
5. **Deploy.**

Every push to the default branch redeploys. Pull requests get their own
preview URL.

### Or from the terminal

```bash
npx vercel        # preview deploy, prompts through first-time setup
npx vercel --prod # production deploy
```

### A note on weight

`public/img/portrait.mp4` is around 8 MB and `public/img/visual/*.png` about
1.9 MB together. They are deferred and lazy-loaded, so they never block the
page, but compressing them before launch is worth the effort — the video
especially. Nothing else needs to change if you replace the files in place.

## Deploying elsewhere

The `dist/` folder is plain static files, so Netlify, Cloudflare Pages,
GitHub Pages or any static host works — build command `npm run build`,
publish directory `dist`.

To run it as a live Node server instead (needed only if you add something
dynamic back, like a contact form):

```bash
NODE_ENV=production npm start
```
