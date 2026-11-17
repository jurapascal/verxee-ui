# Plugins and themes — phase 6

Features only some companies want, and company-specific looks, are **plugins and themes** — never branches or `if`s in the core.
Reference implementation: Pendulum (`market/`, `market/README.md`, `inc/api_addons.php`, `assets/js/core/addons.js`, `tests/test_addons.php`).
Back to [`AGENTS.md`](../AGENTS.md). Gates: `vx-market`, plus `vx-security` for a new plugin or a plugin that uses the API in a new way.

## 1. How it works

- The **catalog lives in the app's repo** in `market/`: `market.json` (index only: id, name, description, author, version, icon, `path`), `pluginy/<id>/` (plugins), `motivy/<id>/` (themes). `php market/tools/build-market.php` regenerates `market.json`.
- An installation downloads an item **from GitHub when an admin clicks Install** (`EXT_MARKET_REPO`, `EXT_MARKET_PATH`, read-only `EXT_MARKET_TOKEN`). **A new plugin or plugin update needs no app release**: push to `main` and it is in every installation's catalog within ~10 minutes. Pushes that change only `market/` skip the app deploy (`paths-ignore`).
- **Each company has its own plugins and themes** (Settings → Plugins and themes, owner/admin of that company). Installed files are stored in that company's database (`tf_addons`), so deploys and updates never overwrite them and companies never mix.
- **Updates like WordPress:** a higher `version` in the catalog shows *"Updates available"* with **Update all**, per-item **Update**, and bulk actions (update / enable / disable / remove selected). The plugin's `zmeny` list is shown after an update.
- The platform administrator can switch the whole feature off for a company.

## 2. Plugin

- Folder `market/pluginy/<id>/` (`id`: `a-z 0-9 . _ -`, max 64), manifest `plugin.json`: `name, version, description, author, main, style, ikona, zmeny`.
- JavaScript in the app window **with the signed-in person's rights**. After install it is **off**; switching it on needs a confirmation.
- It registers through the app's plugin API, e.g. `PendulumPlugins.register('<id>', api => { api.action(…); api.page(…); api.settings(…); api.on('task:changed', …); api.call('projects'); api.storage.set(…); })`.
- It uses only the public plugin API and the app's API with the person's rights; it never gets more. Anything needing new server permissions, tables or cron jobs belongs in the core behind a per-company switch that the plugin turns on (Pendulum's *Tickets* plugin works like that).
- Allowed files: `.js .css .json .svg .png .jpg .webp .woff2 .woff`; max 1 MB per file, 3 MB per item, 60 files. Nothing runs at install time.
- No remote scripts, no `eval`, no calls to third-party servers without the owner's approval; no secrets in `api.storage`.
- UI inside a plugin uses Verxee UI (blocks, tokens, toasts) like the rest of the app.

## 3. Theme

- Folder `market/motivy/<id>/`, manifest `motiv.json`: `name, version, description, author, nahled` (3–5 `#rrggbb` swatches), `barvy: { light: {…}, dark: {…} }`, optional `style` (CSS file; fonts and images next to it, referenced relatively).
- **CSS variables only, no script.** In a Verxee UI app a theme overrides the **`--admin-*` tokens** (`--admin-action`, `--admin-accent`, `--admin-bg`, `--admin-surface`, radius tokens …) — always for **both light and dark**. Values are colours, lengths or fonts; `url()` in variables is rejected.
- The company enables a theme; **each person picks one** in their profile. Built-in looks stay available.

## 4. Releasing a plugin or theme

1. Change the files, **bump `version` in the manifest**, fill `zmeny` (what is new, in the users' language).
2. `php market/tools/build-market.php`; commit `feat(market): <id> X.Y.Z …`; push to `main` — only after `vx-market` (and `vx-security` if needed) are green.
3. In a test company: the item shows "update available"; update, enable, disable and remove work. Run `tests/test_addons.php`.
4. If it needs a newer app version, say so in its description and `zmeny`, and release the app first ([`releases.md`](releases.md)).
