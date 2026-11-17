# Infrastructure: every company has its own two VPS

Reference: Pendulum `INSTALL.md`, `tools/install.php`, `Dockerfile`, `docker/entrypoint.sh`.
Back to [`AGENTS.md`](../AGENTS.md). Gate: `vx-infra` (plus `vx-db` for anything about the database).

Each company (customer) gets **its own installation on its own two servers**. Companies never share a server, a database or a secret.

```
            company A                                   company B
  ┌──────────────────────────┐              ┌──────────────────────────┐
  │ APP VPS (frontend + PHP) │              │ APP VPS (frontend + PHP) │
  │ app.company-a.cz, HTTPS  │              │ app.company-b.cz, HTTPS  │
  │ Coolify/Docker or Apache │              │ …                        │
  └────────────┬─────────────┘              └────────────┬─────────────┘
       private network / WireGuard                 private network
  ┌────────────┴─────────────┐              ┌────────────┴─────────────┐
  │ DB VPS (MariaDB only)    │              │ DB VPS (MariaDB only)    │
  └──────────────────────────┘              └──────────────────────────┘
        both pull releases from GitHub; nothing is pushed to them
```

## 1. DB VPS — database only

- **MariaDB 10.11+**, database `utf8mb4` / `utf8mb4_czech_ci`. Nothing else runs there: no web server, no app code.
- Port **3306 reachable only from the company's app VPS** (firewall on its IP, ideally a private network or WireGuard). Never open to the internet.
- Two DB users: the **app user** (`SELECT, INSERT, UPDATE, DELETE`) and the **admin user** (`DB_ADMIN_*`, plus `CREATE, ALTER, INDEX, DROP, REFERENCES`) only for migrations and creating companies. Or one user with all privileges on that one database.
- **Backups on the DB VPS** (daily dump, also kept off the server), in addition to the pre-update dump the app VPS makes. A backup counts only after a test restore into an empty database worked.
- User files are stored in the database, so a database backup is a complete backup of the data.

## 2. App VPS — frontend and PHP

- Serves the app over **HTTPS** on the company's domain (A record → app VPS or its proxy). Behind a proxy it must send `X-Forwarded-Proto: https`; with Cloudflare add its ranges to `TRUSTED_PROXIES`.
- Runs **Coolify / Docker** (recommended: image from the app's `Dockerfile`, settings from environment variables, persistent volume on `/var/www/html`) or **Apache + PHP 8.2+** with `.htaccess`.
- **Cron every minute** (`php cron.php`; inside the container in Docker).
- Persistent: `config.php`, `.sessions/` (sign-ins survive restarts), `.ops/` (maintenance flag, backups, update state), `.well-known/`.
- Outbound: HTTPS to GitHub (releases, plugin catalog), integrations, SMTP. The sender domain has **SPF, DKIM, DMARC**.
- `DB_HOST` = the private address of the company's DB VPS, never `localhost` on a company installation.

## 3. Setting up a new company

Follow the app's `INSTALL.md` (Pendulum: `php tools/install.php --check | --env | --owner | --import file.sql`). Per company:

1. Two VPS; private network or firewall between them.
2. Database and users on the DB VPS.
3. Domain, TLS, SMTP mailbox with SPF/DKIM/DMARC.
4. `config.php` / environment with **freshly generated** tokens. `SECRETS_KEY` must never change afterwards (integration secrets are encrypted with it).
5. Release webhook on GitHub (repo admin) + read-only `UPDATE_GITHUB_TOKEN` and `EXT_MARKET_TOKEN`.
6. Hub client if the company signs in through the hub ([`hub-sso.md`](hub-sso.md)).
7. Work through the "Done when" checklist in `INSTALL.md`, including one backup restore.

## 4. Rules for agents

- Never log in to a company VPS to change code, data or configuration. Read-only diagnosis (logs, `install.php --check`) only when the owner asks, and report what you found.
- Never copy data or secrets between companies. Moving a company to a new installation uses the export/import tools, into an **empty** database only.
- Ask the owner before anything that deletes data, restarts a production database or changes firewall rules.
- Changes to server requirements go into `INSTALL.md` and the release notes in the same version (`vx-release` checks it).
