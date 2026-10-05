# Verxee UI

A small, open-source **admin design system** in the Linear / Vercel spirit: neutral greys, one blue accent,
tight 4 px spacing grid, 12 px card radius, Inter, and a proper dark mode. It is a skin on top of
[CoreUI 5](https://coreui.io) (Bootstrap-based), so you keep all the CoreUI markup and JS and get a consistent look.

It powers a family of admin apps (e-shop admin, planner, ERP/fulfilment, internal tools).

**Documentation:** https://jurapascal.github.io/verxee-ui/docs/ · **Live demo:** https://jurapascal.github.io/verxee-ui/

## What you get

| File | What it is |
|---|---|
| `css/tokens.css` | Colours (light + dark), status colours, shadows, font, spacing — all CSS variables (`--admin-*`) |
| `css/components.css` | Badges, buttons (3 sizes / 5 variants), inputs, cards, tables, sidebar, topbar, dropdowns, popovers, modals, empty states, sticky save bar, switches, utilities, CoreUI overrides, print |
| `css/layout.css` | Page patterns: auth screen, page header, KPI tiles, list rows, line tabs, form hints, thin progress |
| `css/verxee-ui.css` | All of the above in one file (fonts + tokens + components + layout) |
| `css/fonts.css` + `fonts/` | Self-hosted Inter (works offline, CSP-friendly) |
| `vendor/` | CoreUI 5.3.1 + Tabler Icons 3.31, self-hosted |
| `dist/` | Built + minified CSS and JS (use these) |
| `js/verxee-ui.js` | Runtime: `VerxeeUI.theme`, `toast()`, `confirm()`, sidebar |
| `docs/` | Documentation site (source in `docs-src/`) |

## Quick start

Straight from GitHub via [jsDelivr](https://www.jsdelivr.com/) — no download, no build:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/jurapascal/verxee-ui@v2.0.0/vendor/coreui/coreui.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/jurapascal/verxee-ui@v2.0.0/vendor/tabler-icons/css/tabler-icons.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/jurapascal/verxee-ui@v2.0.0/dist/verxee-ui.min.css">
<script defer src="https://cdn.jsdelivr.net/gh/jurapascal/verxee-ui@v2.0.0/vendor/coreui/coreui.bundle.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/gh/jurapascal/verxee-ui@v2.0.0/dist/verxee-ui.min.js"></script>
```

Set `<html data-coreui-theme="light">` and you are done. `css/verxee-ui.css` is fonts + tokens + components + layout in one file;
pin a version tag (as above) so updates never surprise you, or use `@main` for the latest.

Prefer self-hosting? Clone the repo and use the same files from `css/` and `vendor/` (load CoreUI first, then Verxee UI).
Open `index.html` for a full working shell. Icons are [Tabler Icons](https://tabler.io/icons).

## JavaScript

```js
VerxeeUI.toast('Saved', { type: 'success' });
if (await VerxeeUI.confirm({ title: 'Delete?', variant: 'danger' })) { /* … */ }
VerxeeUI.theme.toggle();
```

Full reference in the [docs](https://jurapascal.github.io/verxee-ui/docs/javascript.html). Build from source: `node scripts/build.mjs`; see [CONTRIBUTING](CONTRIBUTING.md).

## Theming

Everything is driven by variables in `tokens.css`. Switch theme with
`<html data-coreui-theme="dark">`. To rebrand, change the accent in one place:

```css
:root { --admin-action: #7C3AED; --admin-action-hover: #6D28D9; --admin-accent: #7C3AED; }
```

Status colours: `--admin-success / warning / critical / info / pending`. Badges: `.status--success`, `--warning`,
`--critical`, `--info`, `--pending`, `--neutral`.

## Conventions

- Heights: badges 22 px, buttons 28 / 34 / 40 px, inputs 34 px, topbar 48 px, sidebar 240 px.
- Buttons are semantic: ordinary → blue, delete → red, edit → orange.
- Tables: 14 px cell padding, no uppercase headers.
- Prefer classes over inline styles — `components.css` has a utilities section for the common cases.

## Credits & licence

MIT — see [LICENSE](LICENSE). Bundles Inter (OFL 1.1, see `fonts/README.md`). Bundles CoreUI 5.3.1 (MIT) and Tabler Icons 3.31 (MIT) in `vendor/`.
