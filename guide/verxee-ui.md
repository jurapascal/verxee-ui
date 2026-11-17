# Building screens with Verxee UI

Full reference: the docs site (`docs/`, source in `docs-src/`). This guide is what an agent needs to build correctly.
Back to [`AGENTS.md`](../AGENTS.md).

## 1. Loading

Load **CoreUI first, then Verxee UI**, always from a **pinned version tag** (never `@main` in anything that ships):

```html
<html lang="cs" data-coreui-theme="light">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/jurapascal/verxee-ui@v2.5.1/vendor/coreui/coreui.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/jurapascal/verxee-ui@v2.5.1/vendor/tabler-icons/css/tabler-icons.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/jurapascal/verxee-ui@v2.5.1/dist/verxee-ui.min.css">
<script defer src="https://cdn.jsdelivr.net/gh/jurapascal/verxee-ui@v2.5.1/vendor/coreui/coreui.bundle.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/gh/jurapascal/verxee-ui@v2.5.1/dist/verxee-ui.min.js"></script>
```

- Company installations **self-host** the same files (copy `dist/`, `vendor/`, `fonts/` of the pinned tag into the app), so the app works without a CDN and under a strict CSP. From the CDN, use the SRI hashes in `dist/sri.json`.
- Icons are Tabler Icons (`ti ti-<name>`); in blocks just write `icon: 'shopping-cart'`.
- Server-rendered pages without the shell can still use the CSS classes, and `js/hub-bridge.js` alone for the hub.

## 2. The app shell — `VerxeeUI.app({...})`

Build topbar, sidebar and page from one config. **Do not hand-write topbar/sidebar markup.**

```js
const shell = VerxeeUI.app({
  brand:   { name: 'Acme', icon: 'bolt' },
  theme:   { accent: '#2563EB', radius: 'default', density: 'default' },
  topbar:  { left: ['search'], right: ['theme', 'notifications', 'user'] },
  sidebarHeader: [ /* blocks */ ],
  sidebar: [
    { label: 'Dashboard', icon: 'home', href: '#/' },
    { title: 'Sales' },
    { label: 'Orders', icon: 'shopping-cart', href: '#/orders', can: 'orders.view', badge: 3 },
    { label: 'Settings', icon: 'settings', can: 'settings.view', children: [
      { label: 'Users', href: '#/settings/users', can: 'users.manage' } ] }
  ],
  sidebarFooter: [ /* blocks */ ],
  page: [ { type: 'heading', title: 'Dashboard' }, { type: 'stats', items: [{ label: 'Orders', value: 128 }] } ],
  auth: { /* section 6 — phase 3 */ },
  rolePreview: { /* role-preview.md — phase 1 */ },
  hub: { origin: 'https://alba-rosa.cz' } // hub-sso.md
});

shell.setPage([...]);  shell.setSidebar([...]);  shell.setTopbar({...});
shell.user;  shell.role;  shell.setRole('viewer');  shell.logout();  shell.expired();
```

Zero-JS alternative: the same config as JSON in `<script type="application/json" data-verxee-config>…</script>`.

## 3. Blocks — one vocabulary for topbar, sidebar and page

Every piece of UI is a block spec `{ type, … }`. A plain string is shorthand (`'theme'`, `'user'`); a plain string as `body` is a paragraph. Blocks nest (`card.body`, `grid.items`).

| Block | Topbar | Sidebar | Page | Key options |
|---|:-:|:-:|:-:|---|
| `button` (default) | ✓ | ✓ | ✓ | `label icon variant size href onClick confirm badge` |
| `menu` | ✓ | ✓ | ✓ | `label icon items[] align` |
| `search` | ✓ | ✓ | ✓ | `placeholder width onSearch(q) onInput(q)` |
| `theme`, `notifications`, `user`, `logout`, `rolepreview` | ✓ | ✓ | ✓ | toggle · `items[]` · from the signed-in user · sign-out · role dropdown |
| `badge`, `avatar`, `text`, `link`, `html`, `divider`, `spacer` | ✓ | ✓ | ✓ | `html` is sanitized |
| `nav` (link / group / heading) | | ✓ | | `label icon href badge children[]`, `{ title }`, `{ divider: true }` — default in the sidebar |
| `card`, `list`, `progress`, `form` | | ✓ | ✓ | `title body[] footer[]` · `items[{title, sub, dot, right, href}]` · `value` · `fields[] onSubmit(values)` |
| `heading` | | | ✓ | `title icon status actions[]` |
| `stats`, `kpi` | | | ✓ | `items[{label, value, sub, icon, alert, onClick}]` |
| `grid`, `tabs` | | | ✓ | `cols items[]` · `items[{label, href, active}]` |
| `table` | | | ✓ | `columns[{key, label, render, status, align}] rows[] onRowClick empty` |
| `timeline`, `empty` | | | ✓ | `items[{title, time, dot}]` · `icon title text action` |

Every block also accepts `can`, `hidden`, `id`, `className`. Own blocks: `VerxeeUI.register(type, areas, render)`; render with `VerxeeUI.render(spec)` / `VerxeeUI.mount(target, list)`; list them with `VerxeeUI.blocks()`.

**Prefer an existing block, then a new registered block, then hand-written markup with Verxee classes** — in that order.

## 4. Look: tokens, theming, conventions

- Colours, radius, font and spacing come from **`--admin-*` tokens** (`css/tokens.css`): `--admin-bg`, `--admin-surface`, `--admin-surface-hover`, `--admin-surface-selected`, `--admin-border(-subtle|-strong)`, `--admin-text(-secondary|-disabled)`, `--admin-action(-hover|-text)`, `--admin-accent`, status `--admin-success | warning | critical | info | pending`, plus `--radius-sm/md/lg/xl`, `--control-h*`, `--sidebar-w`, `--admin-font`.
- **No hard-coded colours, no inline styles.** Use tokens and existing classes (utilities in `components.css`). A missing class goes into Verxee UI ([`CONTRIBUTING.md`](../CONTRIBUTING.md)), not into one app.
- **Light and dark mode** both: `<html data-coreui-theme="dark">`, `VerxeeUI.theme.toggle()`, event `verxee:themechange`.
- Rebranding is one call: `VerxeeUI.configure({ theme: { accent, accentHover, radius: 'sharp|default|round', density: 'compact|default|comfortable', font, sidebarWidth, mode } })`. Company-specific looks are **themes** ([`plugins-themes.md`](plugins-themes.md)), not code changes.
- Sizes: badges 22 px, buttons 28/34/40 px, inputs 34 px, topbar 48 px, sidebar 240 px; 4 px grid; 12 px card radius.
- **Buttons are semantic:** ordinary → blue (`primary` / `secondary`), delete → red (`danger`, `ghost-danger`), edit → orange (`warning`). Status badges `.status--success | warning | critical | info | pending | neutral`.
- **Tables:** 14 px cell padding, no uppercase headers. Empty lists use the `empty` block.
- **Phone:** the sidebar collapses (`VerxeeUI.sidebar.open() / close()`); test at 390 px width.

## 5. JavaScript helpers

```js
VerxeeUI.toast('Saved', { type: 'success' });
if (await VerxeeUI.confirm({ title: 'Delete order?', variant: 'danger' })) { … }
const values = await VerxeeUI.modal({ title: 'New client', fields: [{ name: 'name', label: 'Name', required: true }] });
VerxeeUI.popover(anchorEl, { … });
await VerxeeUI.fetch('/api/orders', { method: 'POST', json: { … } }); // adds the CSRF header
```

- `data-confirm="Really delete?"` on a link/button asks before the click goes through.
- Defaults for toast / confirm / modal / buttons / security: `VerxeeUI.configure({ … })`.
- Events: `verxee:themechange`, `verxee:login`, `verxee:logout`, `verxee:rolechange`.

## 6. Sign-in, permissions, security

- `auth: { urls: { session, login, logout, verify2fa, forgot }, idleTimeout: 15, providers: ['hub', 'google'], password: true }` gives the sign-in screen, 2FA step, password reset, sign-out in all tabs, idle timeout and "session expired" on 401. The adapter takes URLs or functions.
- Permissions: `can: 'orders.view'`, `['a', 'b']` (any of) or `(user) => bool`; the user object carries `permissions: [...]`, `'*'` = everything.
- **Hiding is not access control.** The server checks every permission on every request.
- Every `html` option is sanitized (`security.trustHtml` only for HTML you generated yourself). `javascript:` / `data:` links are blocked. The runtime works under a strict CSP. Send state-changing requests with `VerxeeUI.fetch` (CSRF header) and verify the token on the server.
- Reference servers: `examples/server.mjs` (Node), `examples/php/auth.php` (PHP + hub).

## 7. Updating Verxee UI inside an app

1. Read `CHANGELOG.md` between the pinned tag and the new one.
2. Change the tag everywhere in one commit (or replace the self-hosted copy).
3. Gates: `vx-ui-review` (light, dark, phone, every role) and `vx-tester`.
4. It is a normal app version with a changelog line ("Verxee UI 2.5.1 → 2.6.0").
