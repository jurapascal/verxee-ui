# Versions, releases and updates — phases 4 and 5

Reference implementation: **Pendulum** (`lib.php` `APP_VERSION`, `.github/workflows/release.yml`, `hook.php`, `inc/api_update.php`, `tools/update.php`, `INSTALL.md` → *Aktualizace*).
Back to [`AGENTS.md`](../AGENTS.md). Gates: `vx-release` always, `vx-db` when migrations changed, `vx-infra` when the workflows or server requirements changed.

## 1. Versions

- **Semantic versioning** `MAJOR.MINOR.PATCH`: patch = bug fixes only; minor = new features, data and settings stay compatible; major = installations must prepare for something (say what). Before `1.0` use `0.x`.
- **One source of truth** for the version in the code (Pendulum: `const APP_VERSION` in `lib.php`; JS libraries: `package.json` + the runtime constant). The release tag is `v` + that version, exactly.
- **Changelog** (`CHANGELOG.md` or the release notes): new, fixed, deliberately not done yet, and **anything an installation must do** (new setting, token, cron, PHP extension).
- Never skip the changelog or the version bump. Never reuse or move a released tag.

## 2. Two delivery channels

| Channel | Who | How code gets there |
|---|---|---|
| **Our hosting** (`alba-rosa.cz/<app>`) | our own instances | merge to `main` → GitHub Actions **Deploy** (FTPS, only changed files, protected paths in `.github/deploy.json`) → migrations run automatically. `UPDATE_WEBHOOK_SECRET` is empty there, so the update bar is off. |
| **Company installations** (own two VPS) | every customer company | **only from a published GitHub Release.** Never from `main`, never by copying files. |

## 3. Staged rollout

A version reaches companies in stages; each stage must be healthy before the next.

| Stage | What happens | Move on when |
|---|---|---|
| 1. **Merge** | gates green, merged to `main` | — |
| 2. **Canary: our hosting** | the deploy puts it on alba-rosa.cz; real use by our own people | no new errors in Beruška / logs for at least one working day (patch releases: a few hours) |
| 3. **Release** | `vx-release` checks readiness, the owner approves, the Release is published | the Release workflow attached the package |
| 4. **Pilot company** | one company's administrator updates first (agreed with them) | the pilot runs a day without problems |
| 5. **Everybody** | other administrators update when they choose | — |

Stage 4 may use a **beta** ([section 4](#4-test-releases-beta)); announcements still come only from the stable release. A **draft** is ignored by every installation, so notes can be reviewed safely.

## 4. Test releases (beta)

- A test version is a GitHub **pre-release** with tag `vX.Y.Z-beta.N` (or `-rc.N`); the version constant carries the same suffix, so the Release workflow's tag check still passes. Draft = notes under review, never visible.
- **Every installation can see a beta, but nobody is told about it.** It is listed in the update settings (*Test versions*, with a warning) and the server administrator may install it by hand. It never shows the update bar, never notifies anybody, never counts as "a new version", is never scheduled or installed automatically and is never *Required*.
- **Announcements come only from stable releases** (`vX.Y.Z`, no suffix): update bar for all users, notification, required marker. A beta has no release notes for users — the notes are for the administrator who opens it.
- An installation on a beta is offered the next stable release as usual; there is no downgrade. Migrations of a beta are final: once a beta ran on a company database, the stable release must contain the same migrations (no rewriting a published migration).
- Promote a beta to stable by publishing a **new** tag `vX.Y.Z` (never rename or move a tag). `vx-release` checks that nothing but the version changed since the last beta, or lists what did.
- *Build status:* Pendulum ignores pre-releases today (`inc/api_update.php`); the *Test versions* list is a version to plan (`vx-planner`).

## 5. Required releases

Some versions (security fixes, a change the other versions cannot work with) must reach **every** installation.

- **Marker:** the first lines of the release notes contain `Required: <days>d` (e.g. `Required: 7d`). The owner decides; `vx-release` proposes it and explains why. No marker = optional.
- **What an installation does:** all users see the update bar as before; the administrator sees *"Required until <date>"* and may postpone until then, or update or schedule earlier. When the deadline passes, the installation updates **itself** at the next night window (cron, same procedure as section 8, including the database backup). A failed update rolls the code back and keeps the administrator warned each day.
- A security fix: use `Required: 1d` to `3d`; say in the notes what is fixed without publishing an exploit. Never put secrets or details of an unfixed hole in notes.
- Required status is **not** inherited: a later optional release does not cancel it; installations on the newest version just do nothing.
- *Build status:* parsing the marker, the deadline and the night-window auto-update are not in Pendulum yet — a version to plan.

## 6. Skipping versions

An installation may jump straight to the newest release (1.1 → 1.4). Therefore:

- Migrations are numbered and chain from **any** older version; `vx-db` checks the whole path from the oldest supported release, not only the last step.
- A **major** release that needs a manual step may name a **minimum version** in its notes; the update bar then offers the stepping-stone version first.
- Required releases cover everything between: a company that skipped a required release gets it with the next update.

## 7. Shipping a version (the agent's part)

1. Work on a branch, gates green, merge to `main` (stage 2 starts).
2. Bump the version constant, write the changelog entry, commit `chore(release): version X.Y.Z (…)`.
3. Run `vx-release`: it checks readiness, proposes beta or stable and `Required:`, and drafts the release notes **for the people who use the app** (they see them in the update bar).
4. **Only when the owner asks:** publish the GitHub Release with tag `vX.Y.Z`, e.g. `gh release create vX.Y.Z --title "<App> X.Y.Z" --notes-file notes.md`.
5. The **Release** workflow checks that the tag matches the version constant, builds the package (with `vendor/`, without tests and dev files) and attaches `<app>-vX.Y.Z.zip`. If the tag does not match, it fails: fix the version, never edit the zip by hand.
6. GitHub sends the `release` webhook to every installation (`https://<installation>/hook.php?p=github`, signed with that installation's `UPDATE_WEBHOOK_SECRET`). The repo admin adds each installation's webhook once, event *Releases* only.

## 8. What an installation does (already built — keep it working)

1. All users see *"A new version is available"* with the release notes.
2. The **server administrator** (e-mail in `PLATFORM_ADMINS`, signed in to the main company) chooses **Update now** or **Schedule** (day and hour); everybody sees the scheduled time.
3. At that time cron runs `tools/update.php`: database backup (`.ops/zalohy/`, last 5) → download the package with a **read-only** token (`UPDATE_GITHUB_TOKEN`) → maintenance mode → code backup → swap files → migrations → maintenance off.
4. If migrations fail, the **previous code comes back** and the administrator sees the error. **The database is not rolled back** (the backup is for a manual restore).
5. `config.php`, `sso.config.php`, sessions, `.ops/`, `.well-known/` and all data are never touched by an update.
6. Docker / Coolify: `/var/www/html` is a persistent volume and updates itself the same way; auto-deploy from git is **off**. A manual redeploy with a newer image runs the same update when the container starts.
7. By hand on a server without cron: `php tools/update.php X.Y.Z`, or `--dir <folder>` for an unpacked package.

## 9. Rules that keep updates safe

- **Migrations are forward-only, numbered and additive** (`migrations/NNNN_name.sql`). Add tables and columns with defaults; do not drop or rename in the version that stops using them — drop in a later version. Because the database is not rolled back, **the previous release must still run on the migrated database.**
- Migrations run for **every company in the installation** and are safe to run twice.
- A new setting has a safe default in code and is listed in `config.example.php` and the release notes. An update never needs a manual step to keep running.
- New outbound connections, cron jobs, PHP extensions or server requirements = a **major** change for installations: document them in `INSTALL.md` and the release notes.
- A hotfix is a patch release through the same pipeline. Never copy files to a company server to "quickly fix" something.
- Updating a company installation is **that company's administrator's decision**. Agents never trigger it unless the owner explicitly asks for that specific installation.
