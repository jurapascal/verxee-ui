# Instructions for AI agents

Read this before building an app with, or changing, Verxee UI. Humans: it is also a short summary of how we work.

## Using Verxee UI to build an app

- Load CoreUI first, then Verxee UI (see README quick start). Pin a version tag, never `@main`, in anything that ships.
- Build the shell with `VerxeeUI.app({...})` and the *blocks* vocabulary; do not hand-write topbar/sidebar markup.
- Use `--admin-*` tokens and the existing classes. No hard-coded colours, no inline styles. Check light **and** dark mode.
- Buttons are semantic: ordinary → blue, delete → red, edit → orange. Tables: no uppercase headers.
- Permissions are expressed with `can: 'resource.action'` on blocks and sidebar items. Hiding an element is a convenience, never access control — the server enforces every permission.

## We work in versions

Every app is delivered in numbered versions (`v0.1`, `v0.2` … `v1.0`), each one small, working and shippable. Do not build everything in one go.

- Keep a changelog; every version has an entry saying what is new and what is deliberately not done yet.
- Tag releases `vX.Y.Z`. Do not skip the changelog or the version bump.

## First versions must have role preview (no sign-in)

**Version 1 of any app ships without real authentication.** Instead it has a **role dropdown in the topbar** that switches the acting role on the fly, so access rules can be tested by clicking, with no login:

```js
VerxeeUI.app({
  rolePreview: {
    initial: 'admin',
    roles: {
      admin:   { label: 'Admin',   name: 'Anna Admin',    permissions: ['*'] },
      manager: { label: 'Manager', name: 'Marek Manager', permissions: ['orders.view', 'orders.edit'] },
      viewer:  { label: 'Viewer',  name: 'Viola Viewer',  permissions: ['orders.view'] }
    }
  },
  sidebar: [ { label: 'Orders', href: '#/orders', can: 'orders.view' } /* … */ ],
  page: [ /* … */ ]
});
```

Rules:

1. Define the real roles of the app up front (ask the owner if unclear) and give each a realistic permission list. Include one role that sees everything (`'*'`) and one with the least access.
2. Every menu item, button, page block and action that is role-dependent carries a `can`. Check each role in the dropdown: the sidebar, topbar and page must change as expected, and a role must never see a control it cannot use.
3. Role-gated *data* and *actions* are also checked by a stub or mock in the app, not only hidden in the UI, so the first version already models what the server will enforce later.
4. `rolePreview` skips authentication completely — it is **test mode**. Mark the build as such (e.g. a visible "Test mode" badge) and never deploy it as a live, production app with real data.
5. Real login (`auth` + server) comes in a later version. When adding it, remove `rolePreview`; the `can` rules already in place keep working unchanged.

You can switch role from tests with `shell.setRole('viewer')` and listen for `verxee:rolechange`.

## Changing Verxee UI itself

- Edit sources in `css/tokens.css`, `components.css`, `layout.css`, `js/verxee-ui.js` — never `dist/` or `css/verxee-ui.css` by hand.
- Docs live in `docs-src/*.html`; run `node scripts/build.mjs` and commit the generated `dist/`, `css/verxee-ui.css` and `docs/`.
- Bump `version` in `package.json`, add a `CHANGELOG.md` entry, tag `vX.Y.Z`.
- Anything user-visible in the docs and demo is in English; commit messages in English.
