# Role preview — phase 1 (no sign-in)

Back to [`AGENTS.md`](../AGENTS.md) · phases: [`phases.md`](phases.md).

**The first versions of every app ship without real authentication.** Instead there is a **role dropdown in the topbar** that switches the acting role on the fly, so access rules can be tested by clicking:

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

## Rules

1. Use the roles and permissions from the phase 0 matrix (ask the owner if there is none). Each role gets a realistic permission list; one role sees everything (`'*'`), one has the least access.
2. Every menu item, button, page block and action that depends on the role carries a `can`. Check each role in the dropdown: sidebar, topbar and page change as expected, and **a role never sees a control it cannot use**.
3. Role-gated *data* and *actions* are also checked by the stub or mock, not only hidden in the UI, so phase 1 already models what the server enforces in phase 2. Use the same permission names the API will use.
4. `rolePreview` skips authentication completely — it is **test mode**. Show a visible "Test mode" badge, never deploy it as a live app with real data and never release it to a company installation.
5. Real sign-in comes in phase 3. In that version remove `rolePreview` and the badge; the `can` rules already in place keep working unchanged.

## Testing

- From tests: `shell.setRole('viewer')`, listen for `verxee:rolechange`. The chosen role is kept per tab in `sessionStorage` (`vx-role`).
- `vx-ui-review` walks through every role; `vx-tester` checks that the stub refuses actions a role does not have.
