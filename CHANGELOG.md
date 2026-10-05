# Changelog

## 2.3.0 — toasts
- Toast position is per toast and global (6 corners, independent stacks); five looks (`dark`, `light`, `soft`, `solid`, `accent`); type icons, `title`, `closable`, countdown `progress`, `max`, and identical toasts merge into one with a `×N` counter.

## 2.2.0 — blocks, login, security
- **Blocks**: one spec vocabulary for topbar, sidebar and page (button, menu, search, notifications, user, badge, card, table, stats, kpi, grid, form, list, tabs, timeline, empty, …); nestable; `VerxeeUI.render/mount/register/blocks`. `can` permission filter on any block.
- **Auth**: `app({ auth })` — sign-in screen, two-step code, password reset, sign-out (user menu / `logout` block), session check, 401 → "session expired", idle timeout, sign-out in all tabs; backend-agnostic adapter (`urls` or functions).
- **Security**: HTML sanitizer for every `html` option (`security.trustHtml` to opt out), unsafe-URL blocking, `VerxeeUI.fetch` with CSRF header, CSP-compatible runtime, SRI hashes (`dist/sri.json`).
- `examples/server.mjs` reference backend (scrypt, HttpOnly SameSite cookies, CSRF, rate limit, CSP) + `examples/auth.html`; docs: Blocks, Login & sessions, Security.

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
