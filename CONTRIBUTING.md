# Contributing

Verxee UI is used by every app of the family, so a change here is a change everywhere. Be conservative.
The phases, gates and subagents in [`AGENTS.md`](AGENTS.md) apply here too.

## Sources and build

- Edit sources only: `css/tokens.css`, `css/components.css`, `css/layout.css`, `js/verxee-ui.js`, `js/hub-bridge.js`, `server/php/VerxeeSso.php`. Never edit `dist/` or `css/verxee-ui.css` by hand.
- Docs pages live in `docs-src/*.html`. Wrap live examples in `<!--example-->…<!--/example-->` and the build renders them plus a code block. Every new option, block or token is documented in the same commit.
- `node scripts/build.mjs` (Node 18+, no dependencies) regenerates `dist/` (SRI hashes in `dist/sri.json`), `css/verxee-ui.css` and `docs/`. Commit the generated files.
- Use `--admin-*` tokens, not hard-coded colours. Anything user-visible in the docs and demo is in English; commit messages in English.

## Gates

| Change | Gates |
|---|---|
| CSS, tokens, components, docs pages | `vx-ui-review` (light, dark, 390 px, `index.html` + `examples/`), `vx-tester` (build) |
| `js/verxee-ui.js` (runtime, blocks, auth, hub) | `vx-tester`, `vx-ui-review`, `vx-security` for sanitizing, URLs, auth, hub messages |
| `server/php/VerxeeSso.php`, `js/hub-bridge.js` | `vx-security`, `vx-tester` (`php tests/sso/run.php`) |
| `AGENTS.md`, `guide/`, `.claude/agents/` | none — a careful read by the owner |

## Compatibility

Existing class names, tokens, block options and events keep working in minor versions. Removing or renaming anything is a **major** version with a migration note in the changelog.

## Release

1. Bump `version` in `package.json` **and** `version` in the `window.VerxeeUI` object in `js/verxee-ui.js`; update the version in the README quick start.
2. Add a `CHANGELOG.md` entry; run `node scripts/build.mjs`.
3. Commit (`feat: vX.Y.Z …` / `fix: vX.Y.Z …`), tag `vX.Y.Z`, push the tag (jsDelivr serves tags), publish a GitHub Release with the changelog entry — only when the owner asks.
4. Apps pick the new version up only when someone updates their pinned tag ([`guide/verxee-ui.md`](guide/verxee-ui.md) → *Updating Verxee UI inside an app*).
