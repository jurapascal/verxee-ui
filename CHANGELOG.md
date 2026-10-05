# Changelog

## 2.1.0 — configurable
- `VerxeeUI.app({...})`: sidebar, topbar (buttons, menus, notifications, user), brand built from one config (or JSON in `data-verxee-config`).
- `VerxeeUI.modal` (with form fields), `VerxeeUI.popover`, `VerxeeUI.button`; `data-vx-popover`.
- `VerxeeUI.configure`: accent, radius (sharp/default/round), density, font, sidebar width; defaults for toast (position, duration), confirm (texts, icons), modal, and custom button variants.
- New tokens `--radius-sm/md/lg/xl`, `--control-h*`, `--sidebar-w`; docs pages Configuration and Customizer; `examples/app.html`.

## 2.0.0 — framework release
- **Docs site** in `docs/` (built from `docs-src/`): installation, theming, tokens, every component, patterns, JS API.
- **JS runtime** `VerxeeUI`: `theme`, `sidebar`, `toast(msg, {type, duration})`, `confirm({...})` → Promise, `data-confirm` attribute, `verxee:themechange` event.
- **Build** (`node scripts/build.mjs`, no dependencies): `dist/verxee-ui(.min).css|js`; `css/verxee-ui.css` stays as the unminified bundle for existing CDN URLs.
- `package.json` (npm/GitHub install), toast type variants, confirm dialog focus handling.

## 1.0.0
Initial release — tokens, components, layout, demo.
