# Phases and gates

How an app of the Verxee family grows from an idea to company installations, and how every single task inside a phase is verified.
Short version: [`AGENTS.md`](../AGENTS.md).

## Contents

- [App phases 0–6](#app-phases)
- [The task loop](#the-task-loop)
- [Which gate runs when](#which-gate-runs-when)
- [Briefing and running gates](#briefing-and-running-gates)
- [Findings and severity](#findings-and-severity)
- [The final report](#the-final-report)

---

## App phases

Each phase has a goal, a scope it must **not** go beyond, deliverables and exit criteria. A phase is done only when every exit criterion is met and its gates have no open `blocker` or `high` finding. Moving to the next phase is the owner's decision.

### Phase 0 — Plan

- **Goal:** know what to build before building it.
- **Deliverables** (in the app repo, e.g. `docs/plan.md`, or in the first issue):
  - who uses the app and for what, in 3–5 sentences;
  - **roles × permissions matrix** (`resource.action`), one role with `'*'`, one with the least access;
  - data model sketch (entities, relations, what belongs to a company);
  - list of screens and the blocks they use;
  - **version plan**: what goes into `v0.1`, `v0.2` … `v1.0`, each one shippable;
  - open questions for the owner.
- **Out of scope:** any code.
- **Exit:** the owner approved the matrix and the version plan.
- **Gate:** `vx-planner`.

### Phase 1 — Clickable prototype (`v0.1`+)

- **Goal:** the owner can click through the whole app as every role.
- **Build:** `VerxeeUI.app()` shell, blocks, mock data in the browser or a JSON stub, `rolePreview` with the roles from phase 0, `can` on every role-dependent menu item, button, block and action, mock enforcement of the same rules in the stub, a visible **"Test mode"** badge. See [`role-preview.md`](role-preview.md).
- **Out of scope:** real database, real login, real data.
- **Exit:** every role checked in the dropdown; a role never sees a control it cannot use; light + dark + phone width look right.
- **Gates:** `vx-ui-review`, `vx-tester`.

### Phase 2 — Real backend (`v0.x`)

- **Goal:** the prototype works on a real server with a real database.
- **Build:** API (one permission per endpoint, checked on the server, matching the `can` names), schema and numbered migrations, company/tenant isolation from day one, tests for every endpoint and every role. Role preview still drives the UI, but the server already checks the role it gets.
- **Out of scope:** real users, production data, real sign-in.
- **Exit:** API tests green; a lower role gets **403 from the server** (not just a hidden button); one company cannot read another's data by ID.
- **Gates:** `vx-security`, `vx-db`, `vx-tester`.

### Phase 3 — Real sign-in (`v0.x`)

- **Goal:** people sign in for real.
- **Build:** app login and/or hub SSO ([`hub-sso.md`](hub-sso.md)), 2FA, session handling, sign-out everywhere, rate limiting. Remove `rolePreview` and the "Test mode" badge in the same version.
- **Out of scope:** production data until phase 4.
- **Exit:** every role signs in on a test instance; 2FA cannot be skipped by any path (password, SSO, linked company); session expiry and sign-out work in all tabs.
- **Gates:** `vx-security`, `vx-tester`.

### Phase 4 — Production on our hosting (`v1.0`)

- **Goal:** the app runs live on `alba-rosa.cz/<app>` with real people and data.
- **Build:** deploy from `main` (GitHub Actions, protected paths), migrations run by the deploy, backups, error reporting (Beruška / Verxee Debug), maintenance mode, `README.md` with how it is deployed.
- **Exit:** a deploy from a clean `main` works; a backup was restored once into an empty database; `v1.0` tagged with a changelog.
- **Gates:** `vx-release`, `vx-infra`, `vx-security`.

### Phase 5 — Company installations (`v1.x`)

- **Goal:** a company can run its own copy on its own two VPS and update it with one click.
- **Build:** version constant, Release workflow building the package, webhook + update bar + scheduled update with backup and rollback of code, `INSTALL.md`, install script, Docker image. See [`releases.md`](releases.md) and [`infrastructure.md`](infrastructure.md).
- **Exit:** a fresh install from `INSTALL.md` on two empty VPS works; an update from the previous release works and a failed migration rolls the code back.
- **Gates:** `vx-release`, `vx-infra`, `vx-db`.

### Phase 6 — Extensions (any version after phase 4)

- **Goal:** optional features and company looks without forking the app.
- **Build:** `market/` catalog, plugin API, theme support, install/update/enable/disable per company. See [`plugins-themes.md`](plugins-themes.md).
- **Gates:** `vx-market`, `vx-security`.

---

## The task loop

Every task, in every phase, follows the same loop.

### 1. Plan

- One version. Write the goal in one sentence and the scope as **in / out** lists.
- Note the base commit (`git rev-parse HEAD`) — gates review the diff from there.
- Decide the size (S / M / L) and which gates will run (next section).
- Large, unclear or cross-cutting work → run `vx-planner` and follow its plan. If the plan needs more than one version, do only the first one now.

### 2. Build

- Code, tests for the new behaviour, docs, changelog line.
- Keep the change limited to the scope. Unrelated improvements are a separate task.

### 3. Verify

- Start all matching gates **in one message** so they run in parallel.
- While they run, do not change the code they are reviewing.

### 4. Fix

- Fix `blocker` and `high` findings, then re-run **only** the gates that reported them (plus `vx-tester` if code changed).
- Disagree with a finding? Write down why in the report; do not silently skip it.

### 5. Release

- Only when the owner asks. `vx-release` checks readiness and drafts the release notes first. See [`releases.md`](releases.md).

### 6. Report

- See [The final report](#the-final-report).

---

## Which gate runs when

| Change touches … | Gates |
|---|---|
| any code | `vx-tester` |
| sign-in, sessions, 2FA, SSO, passwords, tokens | `vx-security`, `vx-tester` |
| permissions, roles, `can`, a new API action or endpoint | `vx-security`, `vx-tester` (+ `vx-ui-review` if the UI changes) |
| input handling, HTML output, file upload/download, outbound HTTP, webhooks | `vx-security` |
| screens, menus, blocks, CSS, texts, translations | `vx-ui-review` |
| `migrations/`, schema, company/tenant data, import/export, heavy queries | `vx-db`, `vx-tester` |
| version, changelog, `config.example.php`, `INSTALL.md`, update code | `vx-release` |
| `Dockerfile`, `docker/`, `.github/`, deploy config, cron, server requirements | `vx-infra` (+ `vx-release` if installations are affected) |
| `market/` | `vx-market` (+ `vx-security` for a new plugin or a plugin that calls the API in a new way) |
| a new app or phase, or work bigger than one version | `vx-planner` first |

**Size:**

| Size | Examples | Gates |
|---|---|---|
| **S** | text, typo, one style rule | `vx-tester` (lint/build only), `vx-ui-review` if visible |
| **M** | a feature, a bug fix | `vx-tester` + every gate from the table above |
| **L** | auth, permissions model, data model, release, infrastructure | every gate of the current phase + every gate from the table above |

When in doubt between two sizes, take the larger one.

---

## Briefing and running gates

A gate only knows what you give it. Every brief contains:

1. **Repo and diff:** path, base commit, `git diff <base>...HEAD` is the change under review.
2. **Goal:** the version goal in one sentence and the in/out scope.
3. **How to run things:** the app's test command and what it needs (e.g. MariaDB on `127.0.0.1:3417`).
4. **App invariants:** from the app's own `AGENTS.md` (tenant helper, read-only routes, protected files …).
5. **Phase:** which phase the app is in.

Do **not** include your own verdict ("this should be fine", "I already checked security"). Give the code, ask for findings.

Claude Code example — three gates at once, in one message:

```text
Agent(subagent_type="vx-security",  prompt="Repo ~/Desktop/pendulum, review git diff 1a2b3c4...HEAD. Goal: … Invariants: …")
Agent(subagent_type="vx-tester",    prompt="Repo ~/Desktop/pendulum, change = git diff 1a2b3c4...HEAD. Tests: tests/run.sh (MariaDB on 127.0.0.1:3417) …")
Agent(subagent_type="vx-ui-review", prompt="Repo ~/Desktop/pendulum, screens changed: #/tickety … roles: owner, admin, member, guest …")
```

Other tools: open the definition in `.claude/agents/<name>.md` and work through it as a separate pass with a fresh look at the diff.

---

## Findings and severity

Every gate reports findings in this shape:

```
[severity] file:line — what is wrong
  Scenario: concrete input/state → wrong result
  Fix: what to change
```

| Severity | Meaning | Rule |
|---|---|---|
| `blocker` | data loss, data of another company exposed, auth bypass, broken update, secret in git | stop, fix now |
| `high` | a role can do or see what it must not, a failing test, a migration that breaks the previous code | fix before merge |
| `medium` | wrong in an edge case, missing test, UI rule broken | fix before the release or open a tracked follow-up |
| `low` | style, naming, nice to have | note |

Only the owner may accept an open `blocker` or `high` finding, and the acceptance goes into the report.

---

## The final report

Write it for the owner, in their language, short:

1. **What changed** — the version and its goal, in user terms.
2. **Gates** — which ran, findings per severity, what was fixed, what is open and why.
3. **Tests** — the commands that ran and their result; anything not tested and why.
4. **Next step** — what needs the owner (merge, release, update an installation, a decision).
