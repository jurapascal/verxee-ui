# Shared sign-in through the hub — phase 3

Apps of the family sign people in through **one hub** (OpenID Connect provider at `https://alba-rosa.cz/hub`) and run inside it as iframes. Full guide: `docs/sso.html`.
Back to [`AGENTS.md`](../AGENTS.md). Gates for this work: `vx-security`, `vx-tester`.

## Rules

1. **Identity from the hub, roles from the app.** The hub says *who* (verified e-mail + `sub`). The app looks the person up in its own users table and keeps its own roles, permissions and 2FA. Store `provider` + `sub` next to the user on first sign-in; match by e-mail only for that first link. SSO never creates accounts on its own.
2. **Server side = `server/php/VerxeeSso.php`** (copy the single file into the app or load it from a tag of this repo). Start from `examples/php/auth.php`. One callback URL **per app and per installation**, registered exactly in the hub. Providers: `hub` always, `google` when the app wants it.
3. **Secrets never in git.** `sso.config.php` (client secret) is in `.gitignore`, protected in the deploy (`.github/deploy.json` → `protect`) and kept by the updater. Put it on each server once by hand. Without it SSO is fully off (no button, `sso.php` → 404).
4. **2FA still applies.** Signing in through the hub goes through the same 2FA step as a password sign-in.
5. **Embedding:** on app pages send `Content-Security-Policy: frame-ancestors 'self' https://alba-rosa.cz` (and remove `X-Frame-Options: DENY` there; keep `DENY` on the API). Session cookie `SameSite=Lax` (`VerxeeSso::sessionStart()`). Apps on another domain — every company installation — use `crossSiteFrame: true`.
6. **Front end:** `app({ hub: { origin: 'https://alba-rosa.cz' }, auth: { providers: ['hub', 'google'] } })`; on plain PHP pages `js/hub-bridge.js` or `VerxeeUI.hub.connect({...})`.
7. **Do not lock people out.** Keep the old login until the hub login is verified for every role in production; remove it in a separate version. Ask the owner before deleting any accounts or passwords.
8. **Version it.** The migration gets its own version and changelog entry ("Sign in with Alba Rosa Hub").

## What the gates check

- `vx-security`: state, nonce and PKCE handled by `VerxeeSso`, safe return paths, account matched by `sub`, no account creation from SSO, 2FA not skipped, frame headers only on app pages, secrets not in git.
- `vx-tester`: sign-in for every role on a test instance, silent sign-in in the hub, failed sign-in falls back to the login page, sign-out from the hub signs out the app.
