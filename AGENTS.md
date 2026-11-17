# Instructions for AI agents

Entry point for every agent working on **Verxee UI or any app built with it** (Pendulum and the rest of the family).
Read this file completely. Then read only the guide for the phase and area you are working on.

## Always

1. **Work in versions.** One small, working, shippable version at a time (`v0.1`, `v0.2` … `v1.0`). Never build everything in one go.
2. **Follow the phases** below. Do not skip a phase and do not start the next one before the current one is done.
3. **Run the gates.** After building, the subagents that match your change review it. Nothing ships with an open blocker.
4. **Same code for everybody.** Installations differ in configuration only, never in code. Per-company behaviour is a setting, a feature switch or a plugin.
5. **Everything through GitHub.** Commit, push, release. Never edit files on a server (FTP, SSH, Coolify terminal). If a server differs from the repo, stop and report it.
6. **The server enforces every permission.** `can` in the UI only hides things.
7. **Secrets never in git.** Configuration files with secrets live on servers or in repository secrets.
8. **Ask before anything irreversible:** publishing a release, updating a company installation, deleting data or accounts, touching a production database or firewall.
9. **Report honestly.** Say what was tested, what was not, and which gates ran.

## Phases of an app

Every app goes through these phases in order. Each phase is one or more versions. Details, deliverables and exit criteria: [`guide/phases.md`](guide/phases.md).

| # | Phase | Versions | Result | Gates (subagents) |
|---|---|---|---|---|
| 0 | **Plan** | — | Roles × permissions matrix, data model, screens, version plan approved by the owner | `vx-planner` |
| 1 | **Clickable prototype** | `v0.1`+ | Verxee UI shell, mock data, **role preview**, `can` everywhere, "Test mode" badge | `vx-ui-review`, `vx-tester` |
| 2 | **Real backend** | `v0.x` | API + database + migrations, permissions checked on the server, test data only | `vx-security`, `vx-db`, `vx-tester` |
| 3 | **Real sign-in** | `v0.x` | Hub SSO + app login, 2FA, sessions; role preview removed | `vx-security`, `vx-tester` |
| 4 | **Production on our hosting** | `v1.0` | Live on alba-rosa.cz from `main`, backups, error reporting | `vx-release`, `vx-infra`, `vx-security` |
| 5 | **Company installations** | `v1.x` | Release packages, self-update, `INSTALL.md`, two VPS per company | `vx-release`, `vx-infra`, `vx-db` |
| 6 | **Extensions** | any | Plugin and theme catalog | `vx-market`, `vx-security` |

## How every task runs

```
1 PLAN  →  2 BUILD  →  3 VERIFY (gates in parallel)  →  4 FIX  →  5 RELEASE (on request)  →  6 REPORT
             ↑                                              │
             └──────── re-run only the gates that failed ───┘
```

1. **Plan** — one version, written scope (in / out), which gates will run. Large or unclear work: `vx-planner` first.
2. **Build** — the main agent writes the code, tests and docs.
3. **Verify** — start the matching gates **in parallel** (see the table below). Reviewers report; they do not fix.
4. **Fix** — blockers and high findings before merging; re-run only the gates that failed.
5. **Release** — only when the owner asks ([`guide/releases.md`](guide/releases.md)).
6. **Report** — what changed, gates run and their results, what was not tested.

## Subagents (gates)

Definitions live in [`.claude/agents/`](.claude/agents/). They are Claude Code subagents; other tools read the same file and follow it as a checklist.

| Subagent | Run it when the change touches | It never |
|---|---|---|
| `vx-planner` | a new app, a new phase, a request bigger than one version, unclear scope | writes code |
| `vx-tester` | **any code** | changes app code to make a test pass, deletes or weakens tests |
| `vx-security` | auth, sessions, permissions, API endpoints, input/output, uploads, outbound HTTP, webhooks, secrets, SSO, plugins, headers | fixes code, attacks a live server |
| `vx-ui-review` | screens, menus, blocks, CSS, texts | approves without checking light + dark + phone width + every role |
| `vx-db` | migrations, schema, queries on large tables, tenant/company data, import/export, backups | runs anything against a production database |
| `vx-release` | version, changelog, `config.example.php`, `INSTALL.md`, deploy/release workflows, anything installations must do | publishes a release or updates an installation without the owner's explicit request |
| `vx-infra` | `Dockerfile`, entrypoint, `.github/`, deploy config, cron, server requirements | logs in to a company server to change something |
| `vx-market` | `market/` (plugins, themes, `market.json`) | passes an item whose version was not bumped |

**Sizing** — run what the change needs, not everything:

- **S** (text, copy, a style tweak): `vx-tester` (lint/build only) + `vx-ui-review` if visible.
- **M** (a feature or a fix): `vx-tester` + every gate whose area the change touches.
- **L** (auth, permissions, data model, release, infrastructure): every gate of the current phase plus every area touched.

**Briefing a gate:** give it the base commit or diff range, the version goal in one sentence, the app's test command and any app-specific invariants from the app's own `AGENTS.md`. Give it the code, **not your conclusion** — a reviewer told "this is safe" tends to agree. Start independent gates in one message so they run at the same time.

**Findings:** `blocker` (stop, fix now) · `high` (fix before merge) · `medium` (fix before the release, or a tracked follow-up) · `low` (note). Severity comes from the reviewer; only the owner may accept a blocker or high finding.

## Guides

| Read when you are … | Guide |
|---|---|
| building screens with Verxee UI (loading, `app()`, blocks, tokens, JS API, security) | [`guide/verxee-ui.md`](guide/verxee-ui.md) |
| in phase 1 (role preview, no sign-in) | [`guide/role-preview.md`](guide/role-preview.md) |
| connecting sign-in through the hub (phase 3) | [`guide/hub-sso.md`](guide/hub-sso.md) |
| versioning, beta releases, required releases, updating installations (phases 4–5) | [`guide/releases.md`](guide/releases.md) |
| setting up or changing servers (two VPS per company) | [`guide/infrastructure.md`](guide/infrastructure.md) |
| building plugins or themes (phase 6) | [`guide/plugins-themes.md`](guide/plugins-themes.md) |
| planning phases, running gates, writing the report | [`guide/phases.md`](guide/phases.md) |
| changing Verxee UI itself | [`CONTRIBUTING.md`](CONTRIBUTING.md) |

## Working in an app repo

This guide lives in `jurapascal/verxee-ui` (local clone `~/Desktop/verxee-ui`). Every app repo keeps its own **short** `AGENTS.md` with only what is specific to it:

```md
# <App> — instructions for AI agents
Family rules, phases and gates: https://github.com/jurapascal/verxee-ui/blob/main/AGENTS.md
- Current phase: <0–6>, version <X.Y.Z>, version constant in <file>
- Delivery: <our hosting from main | company installations from Releases>
- Tests: <command>, needs <MariaDB on 127.0.0.1:3417 …>
- Invariants the gates must check: <tenant helper q(), view-as read-only routes, …>
```

**Nothing to install.** The main agent sends the gates itself. In an app repo the `vx-*` agents are not registered, so for each gate read its definition (`~/Desktop/verxee-ui/.claude/agents/vx-<name>.md`, or the same file on GitHub) and start a general-purpose subagent with that file as its instructions plus the briefing (diff range, version goal, test command, app invariants). Start the gates of one change in a single message so they run in parallel. Where the `vx-*` agents are registered (inside verxee-ui), use them by name.
