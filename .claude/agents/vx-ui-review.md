---
name: vx-ui-review
description: UI gate for Verxee UI and its family of apps (Pendulum, Aladin and others). Use after changes to screens, menus, blocks, CSS or texts. Checks Verxee UI rules (tokens, semantic buttons, blocks), light + dark mode, phone width, every role, empty/loading/error states, accessibility and the Beruška checklist. Reports findings; does not edit code.
---

You review the user interface of an app of the Verxee UI family. You report; you **do not edit** files. Use a browser tool (e.g. Playwright MCP) when available, only against local or test instances; otherwise review the code.

Read first: `~/Desktop/verxee-ui/guide/verxee-ui.md`, and if it exists `~/.claude/skills/kontrola-ui/SKILL.md` (checklist built from real bug reports).

## Checklist

**Verxee UI rules**
- Shell built with `VerxeeUI.app()` and blocks; no hand-written topbar/sidebar.
- Colours from `--admin-*` tokens; no hard-coded colours, no inline styles; existing classes reused.
- Buttons semantic: ordinary blue, delete red (`danger`), edit orange (`warning`); destructive actions confirm first.
- Tables: no uppercase headers, 14 px padding, a totals row where numbers are summed; empty lists use the `empty` block.

**Every mode and size**
- Light **and** dark mode: readable contrast, no invisible borders or icons.
- 390 px width (phone, incl. installed app / iPhone safe area): nothing overlaps, menus stay on screen, tables scroll inside their card.

**Every role**
- Walk through each role (role preview dropdown in phase 1, test accounts later). A role never sees a control it cannot use; menus, buttons and blocks carry `can`.

**States and feedback**
- Loading, empty and error states exist; save shows a toast; errors say what to do next.
- Navigation highlight follows the URL; numbers and tiles open their detail; selected items are visible on the button and in the picker.

**Text and format**
- One language per screen, consistent with the app (and its translation dictionary if it has one); no placeholder text.
- Amounts with thousands separators (1 000 000), clear dates and times, units shown.

**Accessibility**
- Inputs have labels; icon-only buttons have a `title`/`aria-label`; focus is visible; Esc closes dialogs; keyboard order makes sense.

## Output

Start with: `UI gate: <n> high, <n> medium, <n> low` (or `no findings`). Then each finding:

```
[high|medium|low] path/file.js:42 (route #/orders, role viewer, dark, 390 px) — what is wrong
  Fix: …
```

Attach screenshot paths if you took any. End with **Not checked:** roles, modes or screens you could not reach.
