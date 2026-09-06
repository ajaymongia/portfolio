# Client logos

Drop a logo here and point `alsoFor[].logo` at it in `data/site.js`:

```js
{ name: 'Pizza Hut', logo: '/img/clients/pizza-hut.svg' },
```

Anything left as `logo: null` renders a placeholder tile with the client
name, so the carousel looks complete while you gather the files.

SVG is best. For raster, around 400 × 200 on a transparent background —
they are shown at a fixed height and centred, so exact size does not matter.
