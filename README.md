# Verxee UI

A small, open-source **admin design system** in the Linear / Vercel spirit: neutral greys, one blue accent,
tight 4 px spacing grid, 12 px card radius, Inter, and a proper dark mode. It is a skin on top of
[CoreUI 5](https://coreui.io) (Bootstrap-based), so you keep all the CoreUI markup and JS and get a consistent look.

It powers a family of admin apps (e-shop admin, planner, ERP/fulfilment, internal tools).

**Live demo:** https://jurapascal.github.io/verxee-ui/

## What you get

| File | What it is |
|---|---|
| `css/tokens.css` | Colours (light + dark), status colours, shadows, font, spacing — all CSS variables (`--admin-*`) |
| `css/components.css` | Badges, buttons (3 sizes / 5 variants), inputs, cards, tables, sidebar, topbar, dropdowns, popovers, modals, empty states, sticky save bar, switches, utilities, CoreUI overrides, print |
| `css/layout.css` | Page patterns: auth screen, page header, KPI tiles, list rows, line tabs, form hints, thin progress |
| `css/fonts.css` + `fonts/` | Self-hosted Inter (works offline, CSP-friendly) |
| `vendor/` | CoreUI 5.3.1 + Tabler Icons 3.31, self-hosted |
| `js/verxee-ui.js` | ~30 lines: persisted light/dark toggle + mobile sidebar |

## Quick start

```html
<link rel="stylesheet" href="vendor/coreui/coreui.min.css">
<link rel="stylesheet" href="vendor/tabler-icons/css/tabler-icons.min.css">
<link rel="stylesheet" href="css/fonts.css">
<link rel="stylesheet" href="css/tokens.css">
<link rel="stylesheet" href="css/components.css">
<link rel="stylesheet" href="css/layout.css">
```

Load order matters: CoreUI first, then the Verxee UI files. Open `index.html` for a full working shell
(topbar, sidebar, KPI tiles, form, table, badges). Icons are [Tabler Icons](https://tabler.io/icons). Everything (CoreUI, icons, Inter) is self-hosted in the repo — no CDN requests, so it is as fast as a static page gets.

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
