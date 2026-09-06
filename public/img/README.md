# Images

## portrait.png — your cut-out illustration

Save the 3D character illustration here as `portrait.png`, with a
transparent background. It is used in two places automatically:

- the **hero**, standing at the right, bleeding to the bottom edge
- the **scrapbook polaroid**, cropped to head and shoulders

`data/site.js` already points at it (`portrait: '/img/portrait.png'`), and
the server checks the file exists on boot — until it is there the page
falls back to the "AM" monogram rather than showing a broken image, so
nothing looks wrong in the meantime.

Any portrait aspect ratio works; taller than wide looks best in the hero.

## work/ — project thumbnails

See `work/README.md`.

## portrait.mp4 — optional looping clip

A short loop of the same character, on a **pure black background** (no alpha
needed). It is fetched only after the page has loaded and fades in over the
still; `mix-blend-mode: lighten` removes the black against the dark page.

Keep it muted-friendly, a few seconds, and as small as you can — it is
deferred, but it is still a download.
