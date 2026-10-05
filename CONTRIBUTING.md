# Contributing

- Edit sources in `css/tokens.css`, `components.css`, `layout.css` and `js/verxee-ui.js` — never `dist/` or `css/verxee-ui.css` by hand.
- Run `node scripts/build.mjs` (Node 18+) to regenerate `dist/`, `css/verxee-ui.css` and `docs/`; commit the output.
- Docs pages live in `docs-src/*.html`. Wrap markup in `<!--example-->…<!--/example-->` and the build renders it live plus a code block.
- Use `--admin-*` tokens, not hard-coded colours; check light and dark mode.
- Bump `version` in `package.json`, add a `CHANGELOG.md` entry, tag `vX.Y.Z` (jsDelivr serves tags).
