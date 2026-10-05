// The whole app: login screen, session handling, logout, sidebar/topbar/page — from one config. No inline scripts (CSP-safe).
VerxeeUI.app({
  brand: { name: 'Acme Admin', icon: 'bolt' },
  auth: {
    urls: { session: '/api/me', login: '/api/login', logout: '/api/logout', forgot: '/api/forgot' },
    idleTimeout: 15,                 // minutes without activity → signed out
    footer: 'Protected area'
  },
  sidebarHeader: [{ type: 'search', placeholder: 'Search…', onSearch: (q) => VerxeeUI.toast('Search: ' + q) }],
  sidebar: [
    { label: 'Dashboard', icon: 'layout-dashboard', href: '#/dashboard' },
    { label: 'Orders', icon: 'shopping-cart', href: '#/orders', can: 'orders.view' },
    { label: 'Billing', icon: 'credit-card', href: '#/billing', can: 'billing.view' },   // hidden: this user lacks the permission
    { title: 'Account' },
    { type: 'button', label: 'Invite teammate', icon: 'user-plus', onClick: () => VerxeeUI.toast('Invite sent', { type: 'success' }) }
  ],
  topbar: { center: [{ type: 'badge', label: 'Beta', variant: 'info' }],
    right: [{ type: 'button', icon: 'plus', label: 'New', variant: 'primary', size: 'sm' }, 'theme', 'user'] },
  page: [
    { type: 'heading', icon: 'layout-dashboard', title: 'Dashboard', actions: [{ label: 'Export', variant: 'secondary', size: 'sm' }] },
    { type: 'stats', items: [{ icon: 'shopping-cart', label: 'Orders', value: 128, sub: 'this month' }, { icon: 'coin', label: 'Revenue', value: '48 200 Kč' }] },
    { type: 'grid', cols: 2, items: [
      { type: 'card', title: 'Recent orders', flush: true, body: [{ type: 'table', columns: [{ key: 'id', label: 'Order' }, { key: 'who', label: 'Customer' }, { key: 'st', label: 'Status', status: { Paid: 'success', Pending: 'warning' } }],
        rows: [{ id: '#1042', who: 'Jane Doe', st: 'Paid' }, { id: '#1041', who: 'John Smith', st: 'Pending' }] }] },
      { type: 'card', title: 'Quick form', body: [{ type: 'form', fields: [{ name: 'note', label: 'Note', required: true }], onSubmit: (v) => VerxeeUI.toast('Saved: ' + v.note) }] }
    ] }
  ]
});
