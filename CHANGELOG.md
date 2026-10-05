# Changelog

## 2.0.0 — framework release
- **Docs site** in `docs/` (built from `docs-src/`): installation, theming, tokens, every component, patterns, JS API.
- **JS runtime** `VerxeeUI`: `theme`, `sidebar`, `toast(msg, {type, duration})`, `confirm({...})` → Promise, `data-confirm` attribute, `verxee:themechange` event.
- **Build** (`node scripts/build.mjs`, no dependencies): `dist/verxee-ui(.min).css|js`; `css/verxee-ui.css` stays as the unminified bundle for existing CDN URLs.
- `package.json` (npm/GitHub install), toast type variants, confirm dialog focus handling.

## 1.0.0
Initial release — tokens, components, layout, demo.
