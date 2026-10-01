/* Verxee UI demo — hash-routed single page with randomly generated data. Not part of the design system. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (v) { return String(v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  // ── Seeded random data (new every page load) ──
  var seed = Date.now() % 2147483647;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function int(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
  function pick(a) { return a[int(0, a.length - 1)]; }
  function money(n) { return n.toLocaleString('cs-CZ') + ' Kč'; }
  function ago(days) { var d = new Date(Date.now() - days * 864e5 - int(0, 80000) * 1000); return d.toLocaleDateString('en-GB') + ' ' + d.toTimeString().slice(0, 5); }

  var FIRST = ['Jane', 'John', 'Eva', 'Tomáš', 'Lucie', 'Martin', 'Anna', 'Petr', 'Klára', 'Jakub', 'Marie', 'Ondřej'];
  var LAST = ['Doe', 'Smith', 'Nováková', 'Svoboda', 'Dvořáková', 'Černý', 'Procházka', 'Kučera', 'Veselá', 'Horák'];
  var PRODUCTS = [['T-shirt', 590], ['Hoodie', 1290], ['Cap', 390], ['Mug', 250], ['Poster A2', 320], ['Sticker pack', 90], ['Tote bag', 340]];
  var STATUS = { paid: 'success', pending: 'warning', shipped: 'info', review: 'pending', refunded: 'critical', draft: 'neutral' };

  var customers = [];
  for (var i = 0; i < 14; i++) {
    var fn = pick(FIRST), ln = pick(LAST);
    customers.push({ id: i + 1, name: fn + ' ' + ln, email: (fn + '.' + ln).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '@example.com', city: pick(['Brno', 'Praha', 'Olomouc', 'Ostrava', 'Plzeň']), orders: [] });
  }
  var orders = [];
  for (var o = 0; o < 28; o++) {
    var c = pick(customers), items = [], total = 0, n = int(1, 3);
    for (var k = 0; k < n; k++) { var p = pick(PRODUCTS), q = int(1, 3); items.push({ name: p[0], qty: q, price: p[1] }); total += p[1] * q; }
    var ord = { id: 1042 - o, customer: c, items: items, total: total, status: pick(Object.keys(STATUS)), date: ago(o * 0.7), log: [] };
    ord.log.push(['Order created', ord.date]);
    c.orders.push(ord); orders.push(ord);
  }
  function orderById(id) { return orders.filter(function (x) { return x.id === +id; })[0]; }

  var notifs = [];
  ['paid', 'shipped', 'refunded', 'pending'].forEach(function (s, j) {
    var ord = orders[j * 2];
    notifs.push({ icon: { paid: 'credit-card', shipped: 'truck-delivery', refunded: 'receipt-refund', pending: 'clock' }[s], title: 'Order #' + ord.id + ' ' + s, body: ord.customer.name + ' · ' + money(ord.total), href: '#/orders/' + ord.id, unread: j < 3 });
  });

  // ── Views ──
  function badge(s) { return '<span class="status status--' + STATUS[s] + '">' + s[0].toUpperCase() + s.slice(1) + '</span>'; }
  function head(icon, title, actions) { return '<div class="page-head"><h1><i class="ti ti-' + icon + '"></i>' + title + '</h1><div class="actions">' + (actions || '') + '</div></div>'; }
  function orderRows(list) {
    return list.map(function (x) {
      return '<tr class="row-link" data-href="#/orders/' + x.id + '"><td><a href="#/orders/' + x.id + '">#' + x.id + '</a></td><td>' + esc(x.customer.name) + '</td><td>' + x.date + '</td><td>' + money(x.total) + '</td><td>' + badge(x.status) + '</td></tr>';
    }).join('');
  }
  var ORDER_TABLE = '<div class="card"><div class="table-responsive"><table class="table table-hover mb-0"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th></tr></thead><tbody>';

  var views = {
    dashboard: function () {
      var rev = orders.reduce(function (a, x) { return a + (x.status === 'refunded' ? 0 : x.total); }, 0);
      var wait = orders.filter(function (x) { return x.status === 'paid'; }).length;
      return head('layout-dashboard', 'Dashboard', '<a class="btn btn-primary btn-sm" href="#/orders"><i class="ti ti-shopping-cart"></i> All orders</a>') +
        '<div class="grid-3 mb-4">' +
        '<div class="card kpi"><div class="kpi-label">Revenue</div><div class="kpi-value">' + money(rev) + '</div><div class="kpi-sub">+' + int(3, 24) + ' % vs. last month</div></div>' +
        '<div class="card kpi"><div class="kpi-label">Orders</div><div class="kpi-value">' + orders.length + '</div><div class="kpi-sub">' + wait + ' waiting for shipment</div></div>' +
        '<div class="card kpi"><div class="kpi-label">Conversion</div><div class="kpi-value">' + (rnd() * 3 + 1.5).toFixed(1) + ' %</div><div class="kpi-sub">' + pick(['stable', 'rising', 'falling']) + '</div></div></div>' +
        '<div class="grid-2 mb-4"><div class="card"><div class="card-body"><h2 class="section-title">Buttons &amp; badges</h2>' +
        '<div class="d-flex flex-wrap gap-2 mb-3"><button class="btn btn-primary">Primary</button><button class="btn btn-outline-secondary">Secondary</button><button class="btn btn-ghost-secondary">Ghost</button><button class="btn btn-outline-danger">Delete</button></div>' +
        '<div class="d-flex flex-wrap gap-2">' + Object.keys(STATUS).map(badge).join('') + '</div></div></div>' +
        '<div class="card"><div class="card-body"><h2 class="section-title">Recent activity</h2>' +
        orders.slice(0, 4).map(function (x) { return '<div class="list-row px-0"><span class="dot dot-' + STATUS[x.status] + '"></span><div class="grow truncate"><a href="#/orders/' + x.id + '">#' + x.id + '</a> · ' + esc(x.customer.name) + '</div><span class="muted">' + money(x.total) + '</span></div>'; }).join('') +
        '</div></div></div>' +
        '<h2 class="section-title">Latest orders</h2>' + ORDER_TABLE + orderRows(orders.slice(0, 5)) + '</tbody></table></div></div>';
    },
    orders: function () {
      return head('shopping-cart', 'Orders', '<input class="form-control" id="q" placeholder="Search…" style="width:200px"><select class="form-select" id="st" style="width:150px"><option value="">All statuses</option>' + Object.keys(STATUS).map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select>') +
        ORDER_TABLE + '</tbody></table></div><div class="empty-state p-4 text-center muted" id="none" hidden>No orders match.</div></div>';
    },
    order: function (id) {
      var x = orderById(id); if (!x) return head('shopping-cart', 'Order not found');
      return head('receipt', 'Order #' + x.id + ' ' + badge(x.status), '<a class="btn btn-ghost-secondary btn-sm" href="#/orders"><i class="ti ti-arrow-left"></i> Back</a>' +
        '<button class="btn btn-outline-secondary btn-sm" data-set="paid">Mark paid</button><button class="btn btn-primary btn-sm" data-set="shipped"><i class="ti ti-truck-delivery"></i> Mark shipped</button>') +
        '<div class="grid-2"><div class="card"><div class="table-responsive"><table class="table mb-0"><thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead><tbody>' +
        x.items.map(function (i) { return '<tr><td>' + i.name + '</td><td>' + i.qty + '</td><td>' + money(i.price * i.qty) + '</td></tr>'; }).join('') +
        '<tr><td colspan="2"><strong>Total</strong></td><td><strong>' + money(x.total) + '</strong></td></tr></tbody></table></div></div>' +
        '<div class="card"><div class="card-body"><h2 class="section-title">Customer</h2><div class="d-flex align-items-center gap-2 mb-2"><span class="avatar">' + x.customer.name.split(' ').map(function (w) { return w[0]; }).join('') + '</span><a href="#/customers/' + x.customer.id + '">' + esc(x.customer.name) + '</a></div><div class="muted">' + x.customer.email + ' · ' + x.customer.city + '</div>' +
        '<h2 class="section-title mt-4">Timeline</h2><ul class="timeline">' + x.log.map(function (l) { return '<li><span class="dot dot-info"></span><span class="grow">' + l[0] + '</span><span class="help">' + l[1] + '</span></li>'; }).join('') + '</ul></div></div></div>';
    },
    customers: function () {
      return head('users', 'Customers') + '<div class="card"><div class="table-responsive"><table class="table table-hover mb-0"><thead><tr><th>Name</th><th>E-mail</th><th>City</th><th>Orders</th></tr></thead><tbody>' +
        customers.map(function (c) { return '<tr class="row-link" data-href="#/customers/' + c.id + '"><td><a href="#/customers/' + c.id + '">' + esc(c.name) + '</a></td><td>' + c.email + '</td><td>' + c.city + '</td><td>' + c.orders.length + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    },
    customer: function (id) {
      var c = customers.filter(function (x) { return x.id === +id; })[0]; if (!c) return head('users', 'Customer not found');
      return head('user', esc(c.name), '<a class="btn btn-ghost-secondary btn-sm" href="#/customers"><i class="ti ti-arrow-left"></i> Back</a>') +
        '<p class="muted">' + c.email + ' · ' + c.city + '</p>' + (c.orders.length ? ORDER_TABLE + orderRows(c.orders) + '</tbody></table></div></div>' : '<div class="card"><div class="card-body muted">No orders yet.</div></div>');
    },
    permissions: function () {
      var roles = ['Owner', 'Manager', 'Support', 'Viewer'], perms = ['orders.view', 'orders.edit', 'customers.view', 'customers.export', 'settings.manage', 'audit.view'];
      return head('shield-lock', 'Permissions') + '<div class="card"><div class="table-responsive"><table class="table matrix mb-0"><thead><tr><th>Permission</th>' + roles.map(function (r) { return '<th>' + r + '</th>'; }).join('') + '</tr></thead><tbody>' +
        perms.map(function (p, pi) { return '<tr><td>' + p + '</td>' + roles.map(function (r, ri) { return '<td><div class="form-check form-switch d-inline-block m-0"><input class="form-check-input" type="checkbox" aria-label="' + r + ' ' + p + '"' + (ri === 0 || (ri === 1 && pi < 4) || (ri === 2 && pi < 3) || (ri === 3 && pi % 2 === 0 && pi < 3) ? ' checked' : '') + '></div></td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div></div>';
    },
    audit: function () {
      var acts = [['edit', 'updated order'], ['login', 'signed in'], ['trash', 'deleted draft'], ['download', 'exported customers'], ['settings', 'changed settings']];
      var rows = ''; for (var i = 0; i < 12; i++) { var a = pick(acts); rows += '<div class="list-row"><i class="ti ti-' + a[0] + ' muted"></i><div class="grow truncate"><strong>' + pick(FIRST) + '</strong> ' + a[1] + (a[0] === 'edit' ? ' <a href="#/orders/' + pick(orders).id + '">#' + pick(orders).id + '</a>' : '') + '</div><span class="help">' + ago(i * 0.4) + '</span></div>'; }
      return head('history', 'Audit log') + '<div class="card">' + rows + '</div>';
    },
    settings: function () {
      return head('settings', 'Settings') + '<div class="card" style="max-width:560px"><div class="card-body"><label class="form-label" for="s1">Store name</label><input id="s1" class="form-control" value="Demo Store"><div class="form-hint">Shown in e-mails and on invoices.</div>' +
        '<label class="form-label mt-3" for="s2">Currency</label><select id="s2" class="form-select"><option>CZK</option><option>EUR</option></select>' +
        '<div class="form-check form-switch mt-3"><input class="form-check-input" type="checkbox" id="s3" checked><label class="form-check-label" for="s3">E-mail me about new orders</label></div>' +
        '<div class="mt-4"><button class="btn btn-primary" data-save>Save changes</button></div></div></div>';
    }
  };

  // ── Router ──
  function route() {
    var parts = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/'), name = parts[0], id = parts[1];
    var key = id ? { orders: 'order', customers: 'customer' }[name] : name;
    var view = views[key] || views.dashboard;
    $('#main').innerHTML = view(id);
    document.querySelectorAll('[data-route]').forEach(function (a) { a.classList.toggle('active', a.dataset.route === name); });
    document.title = 'Verxee UI — ' + name;
    var sb = $('#sidebar'); if (sb) sb.classList.remove('show');
    window.scrollTo(0, 0);
    if (name === 'orders' && !id) bindOrders();
    if (key === 'order') bindOrder(id);
  }
  function bindOrders() {
    var q = $('#q'), st = $('#st'), body = $('#main tbody');
    function draw() {
      var t = q.value.toLowerCase(), s = st.value;
      var list = orders.filter(function (x) { return (!s || x.status === s) && (!t || (x.customer.name + ' ' + x.id).toLowerCase().indexOf(t) > -1); });
      body.innerHTML = orderRows(list); $('#none').hidden = list.length > 0;
    }
    q.addEventListener('input', draw); st.addEventListener('change', draw); draw();
  }
  function bindOrder(id) {
    document.querySelectorAll('[data-set]').forEach(function (b) {
      b.addEventListener('click', function () {
        var x = orderById(id); x.status = b.dataset.set; x.log.push(['Status → ' + x.status, ago(0)]);
        toast('Order #' + x.id + ' marked ' + x.status); route();
      });
    });
  }
  function toast(msg) {
    var el = document.createElement('div'); el.className = 'toast-msg'; el.textContent = msg;
    $('#toasts').appendChild(el); setTimeout(function () { el.remove(); }, 2500);
  }

  // ── Notifications ──
  function drawNotifs() {
    $('#notifList').innerHTML = notifs.map(function (n, i) {
      return '<a class="notif-item' + (n.unread ? ' unread' : '') + '" href="' + n.href + '" data-n="' + i + '"><span class="ico"><i class="ti ti-' + n.icon + '"></i></span><span><div class="t">' + esc(n.title) + '</div><div class="b">' + esc(n.body) + '</div></span></a>';
    }).join('');
    var c = notifs.filter(function (n) { return n.unread; }).length;
    $('#notifDot').hidden = !c; $('#notifDot').textContent = c;
  }
  document.addEventListener('click', function (e) {
    var n = e.target.closest('[data-n]'); if (n) { notifs[+n.dataset.n].unread = false; drawNotifs(); }
    if (e.target.closest('#notifReadAll')) { e.preventDefault(); notifs.forEach(function (x) { x.unread = false; }); drawNotifs(); }
    var row = e.target.closest('tr[data-href]'); if (row && !e.target.closest('a')) location.hash = row.dataset.href;
    if (e.target.closest('[data-save]')) toast('Settings saved');
  });

  window.addEventListener('hashchange', route);
  drawNotifs(); route();
})();
