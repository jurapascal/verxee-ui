/*! Verxee UI — runtime: configure, app shell, modal, confirm, popover, toast, theme. No dependencies. */
(function () {
  'use strict';

  var root = document.documentElement, KEY = 'verxee-ui-theme';

  // ── helpers ──
  function emit(name, detail) { document.dispatchEvent(new CustomEvent(name, { detail: detail })); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function icon(name) { var i = el('i', 'ti ti-' + String(name).replace(/^ti[- ]/, '')); i.setAttribute('aria-hidden', 'true'); return i; }
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Node); }
  function merge(t, s) {
    Object.keys(s || {}).forEach(function (k) { if (isObj(s[k]) && isObj(t[k])) merge(t[k], s[k]); else t[k] = s[k]; });
    return t;
  }
  function $(sel) { return typeof sel === 'string' ? document.querySelector(sel) : sel; }
  // Defence in depth: strips scripts, iframes, on* handlers and javascript:/data: URLs from HTML you pass in.
  // It is NOT a substitute for escaping user data — use text/label options for that.
  function sanitize(html) {
    var d = new DOMParser().parseFromString('<body>' + html, 'text/html');
    [].slice.call(d.querySelectorAll('script,iframe,frame,object,embed,link,meta,base,style,svg script')).forEach(function (n) { n.remove(); });
    [].slice.call(d.body.querySelectorAll('*')).forEach(function (n) {
      [].slice.call(n.attributes).forEach(function (a) {
        var nm = a.name.toLowerCase();
        if (/^on/.test(nm) || nm === 'srcdoc' || (/^(href|src|xlink:href|action|formaction|poster)$/.test(nm) && /^\s*(javascript|vbscript|data):/i.test(a.value) && !/^\s*data:image\/(png|jpe?g|gif|webp);/i.test(a.value))) n.removeAttribute(a.name);
      });
      if (n.tagName === 'A' && n.target === '_blank') n.rel = 'noopener noreferrer';
    });
    return d.body.innerHTML;
  }
  function safeHref(h) { h = h == null ? '#' : String(h); return /^\s*(javascript|vbscript|data):/i.test(h) ? '#' : h; }
  function fill(node, o) { // content: html (sanitized unless security.trustHtml) | text | Node
    if (o.html != null) node.innerHTML = defaults.security.trustHtml ? o.html : sanitize(o.html);
    else if (o.content instanceof Node) node.appendChild(o.content);
    else if (o.text != null) node.textContent = o.text;
  }

  // ── Defaults (change with VerxeeUI.configure) ──
  var defaults = {
    security: { trustHtml: false, csrf: { header: 'X-CSRF-Token', token: null } },
    toast: { duration: 2500, position: 'bottom-right' },
    confirm: {
      title: 'Are you sure?', confirmText: 'Confirm', cancelText: 'Cancel', variant: 'warning',
      icons: { danger: 'trash', warning: 'alert-triangle', info: 'info-circle' }
    },
    modal: { size: 'md', closable: true, closeOnBackdrop: true, okText: 'OK', cancelText: 'Cancel' },
    // Button variants → CSS classes. Add your own: configure({ buttons: { brand: 'btn-primary my-brand' } })
    buttons: {
      primary: 'btn-primary', secondary: 'btn-secondary', ghost: 'btn-ghost-secondary', danger: 'btn-outline-danger',
      'ghost-danger': 'btn-ghost-danger', warning: 'btn-outline-warning', link: 'btn-link'
    }
  };

  // ── Theme (light / dark) ──
  var theme = {
    get: function () { return root.getAttribute('data-coreui-theme') === 'dark' ? 'dark' : 'light'; },
    set: function (mode, persist) {
      mode = mode === 'dark' ? 'dark' : 'light';
      root.setAttribute('data-coreui-theme', mode);
      if (persist !== false) { try { localStorage.setItem(KEY, mode); } catch (e) {} }
      emit('verxee:themechange', { theme: mode });
      return mode;
    },
    toggle: function () { return theme.set(theme.get() === 'dark' ? 'light' : 'dark'); }
  };
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved) theme.set(saved, false);
  else if (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) theme.set('dark', false);

  // ── configure ──
  // configure({ theme: { accent, accentHover, radius: 'sharp|default|round', density: 'compact|default|comfortable',
  //                      font, sidebarWidth, mode: 'light|dark' }, toast, confirm, modal, buttons })
  function configure(c) {
    c = c || {};
    var t = c.theme || {}, s = root.style;
    if (t.accent) {
      s.setProperty('--admin-accent', t.accent);
      s.setProperty('--admin-action', t.accent);
      s.setProperty('--admin-action-hover', t.accentHover || 'color-mix(in srgb, ' + t.accent + ' 82%, #000)');
    }
    if ('radius' in t) { if (t.radius && t.radius !== 'default') root.setAttribute('data-vx-radius', t.radius); else root.removeAttribute('data-vx-radius'); }
    if ('density' in t) { if (t.density && t.density !== 'default') root.setAttribute('data-vx-density', t.density); else root.removeAttribute('data-vx-density'); }
    if (t.font) s.setProperty('--admin-font', t.font);
    if (t.sidebarWidth) s.setProperty('--sidebar-w', typeof t.sidebarWidth === 'number' ? t.sidebarWidth + 'px' : t.sidebarWidth);
    if (t.mode) theme.set(t.mode, false);
    ['toast', 'confirm', 'modal', 'buttons', 'security'].forEach(function (k) { if (c[k]) merge(defaults[k], c[k]); });
    var stack = document.querySelector('.toast-stack'); if (stack) placeStack(stack);
    return defaults;
  }

  // ── Buttons & actions ──
  // Action spec: { label, icon, href, variant, size: 'sm|lg', title, badge, disabled, onClick, confirm: {...}, type: 'menu', items: [...] }
  function button(a) {
    if (typeof a === 'string') a = { label: a };
    var cls = defaults.buttons[a.variant || 'secondary'] || a.variant;
    var n = el(a.href ? 'a' : 'button', 'btn ' + cls + (a.size ? ' btn-' + a.size : '') + (a.label ? '' : ' btn--icon') + (a.className ? ' ' + a.className : ''));
    if (a.href) n.setAttribute('href', safeHref(a.href)); else n.type = 'button';
    if (a.icon) n.appendChild(icon(a.icon));
    if (a.label) n.appendChild(document.createTextNode(a.label));
    if (a.badge != null) n.appendChild(el('span', 'status status--info', a.badge));
    if (a.title || !a.label) n.setAttribute('aria-label', a.title || a.label || a.icon || 'Action');
    if (a.title) n.title = a.title;
    if (a.disabled) n.disabled = true;
    if (a.id) n.id = a.id;
    bindAction(n, a);
    return n;
  }
  function bindAction(n, a) {
    if (!a.onClick && !a.confirm) return;
    n.addEventListener('click', function (ev) {
      if (a.confirm) {
        ev.preventDefault();
        confirmDialog(a.confirm).then(function (ok) { if (ok && a.onClick) a.onClick(ev, a); else if (ok && a.href) location.href = safeHref(a.href); });
      } else a.onClick(ev, a);
    });
  }
  function menuItem(i) {
    if (i.divider) return el('hr', 'dropdown-divider');
    var n = el(i.href ? 'a' : 'button', 'dropdown-item' + (i.danger ? ' text-danger' : ''));
    if (i.href) n.href = safeHref(i.href); else n.type = 'button';
    if (i.icon) { n.appendChild(icon(i.icon)); n.appendChild(document.createTextNode(' ')); }
    n.appendChild(document.createTextNode(i.label || ''));
    bindAction(n, i);
    return n;
  }
  function menu(a) { // dropdown menu (needs CoreUI JS, loaded as usual)
    var wrap = el('div', 'dropdown');
    var b = button({ label: a.label, icon: a.icon, variant: a.variant || 'ghost', size: a.size, title: a.title });
    b.setAttribute('data-coreui-toggle', 'dropdown'); b.setAttribute('aria-expanded', 'false');
    var m = el('div', 'dropdown-menu' + (a.align === 'end' ? ' dropdown-menu-end' : ''));
    (a.items || []).forEach(function (i) { m.appendChild(menuItem(i)); });
    wrap.appendChild(b); wrap.appendChild(m);
    return wrap;
  }

  // ── Topbar ──
  function notifications(a) {
    var wrap = el('div', 'dropdown');
    var b = el('button', 'btn btn-ghost-secondary btn-sm icon-btn'); b.type = 'button';
    b.setAttribute('data-coreui-toggle', 'dropdown'); b.setAttribute('aria-label', a.title || 'Notifications');
    b.appendChild(icon(a.icon || 'bell')); b.lastChild.className += ' fs-5';
    var unread = (a.items || []).filter(function (n) { return n.unread; }).length;
    var dot = el('span', 'dot', unread); dot.hidden = !unread; b.appendChild(dot);
    var m = el('div', 'dropdown-menu dropdown-menu-end notif-menu');
    m.appendChild(el('div', 'px-2 py-1')).appendChild(el('strong', '', a.title || 'Notifications'));
    if (!(a.items || []).length) m.appendChild(el('div', 'px-2 py-3 muted', a.emptyText || 'Nothing new'));
    (a.items || []).forEach(function (n) {
      var i = el('a', 'notif-item' + (n.unread ? ' unread' : '')); i.href = safeHref(n.href);
      var ico = el('span', 'ico'); ico.appendChild(icon(n.icon || 'bell'));
      var tx = el('span'); tx.appendChild(el('div', 't', n.title)); if (n.body) tx.appendChild(el('div', 'b', n.body));
      i.appendChild(ico); i.appendChild(tx); bindAction(i, n); m.appendChild(i);
    });
    wrap.appendChild(b); wrap.appendChild(m);
    return wrap;
  }
  function user(a) {
    var wrap = el('div', 'dropdown');
    var b = el('button', 'btn btn-ghost-secondary btn-sm d-flex align-items-center gap-2'); b.type = 'button';
    b.setAttribute('data-coreui-toggle', 'dropdown'); b.setAttribute('aria-label', a.name || a.email || 'Account');
    var initials = a.initials || String(a.name || a.email || '?').split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
    b.appendChild(el('span', 'avatar', initials));
    if (a.name || a.email) b.appendChild(el('span', 'hide-xs', a.name || a.email));
    var m = el('div', 'dropdown-menu dropdown-menu-end');
    (a.menu || (authCfg ? [{ label: 'Sign out', icon: 'logout', danger: true, onClick: function () { logout(); } }] : [])).forEach(function (i) { m.appendChild(menuItem(i)); });
    wrap.appendChild(b); wrap.appendChild(m);
    return wrap;
  }
  // topbar: { left: [blocks], center: [blocks], right: [blocks] } — any block type works here (see register()).
  function buildTopbar(cfg, brandCfg) {
    var bar = el('nav', 'admin-topbar'); bar.setAttribute('aria-label', 'Top bar');
    var m = button({ icon: 'menu-2', variant: 'ghost', size: 'sm', title: 'Menu', className: 'd-lg-none me-2' }); m.setAttribute('data-sidebar-toggle', '');
    bar.appendChild(m);
    var b = brandCfg || {}, brand = el('div', 'brand me-3'), a = el('a'); a.href = safeHref(b.href);
    var logo = el('span', 'brand-logo');
    if (b.logo) { var im = el('img'); im.src = safeHref(b.logo); im.alt = ''; im.style.cssText = 'width:100%;height:100%;object-fit:contain'; logo.appendChild(im); } else logo.appendChild(icon(b.icon || 'layout-dashboard'));
    a.appendChild(logo); a.appendChild(el('span', 'hide-xs', b.name || 'App')); brand.appendChild(a); bar.appendChild(brand);
    var ctx = { area: 'topbar' };
    renderAll(cfg.left, bar, ctx);
    if (cfg.center) renderAll(cfg.center, bar.appendChild(el('div', 'd-flex align-items-center gap-2 mx-auto')), ctx);
    renderAll(cfg.right || (authCfg ? ['theme', 'user'] : ['theme']), bar.appendChild(el('div', 'd-flex align-items-center gap-2 ms-auto')), ctx);
    return bar;
  }

  // ── Sidebar ──
  // items: { title: 'Heading' } | { divider: true } | { label, icon, href, badge, active, children: [...] }
  function isActive(it) {
    if (it.active != null) return it.active;
    if (!it.href) return false;
    if (it.href.charAt(0) === '#') return location.hash === it.href;
    try { return new URL(it.href, location.href).pathname === location.pathname; } catch (e) { return false; }
  }
  function navLink(it, child) {
    var a = el('a', 'nav-link' + (isActive(it) ? ' active' : '')); a.href = safeHref(it.href);
    if (it.icon) { var i = icon(it.icon); i.className += ' nav-icon'; a.appendChild(i); }
    else if (child) a.appendChild(el('span', 'nav-icon nav-icon-bullet'));
    a.appendChild(document.createTextNode(it.label || ''));
    if (it.badge != null) a.appendChild(el('span', 'status status--info ms-auto', it.badge));
    bindAction(a, it);
    return a;
  }
  function navItem(it) {
    if (it.title) return el('li', 'nav-title', it.title);
    if (it.divider) return el('li', 'border-top my-2');
    var li = el('li', 'nav-item');
    if (it.children && it.children.length) {
      li.className = 'nav-group' + (it.children.some(isActive) ? ' show' : '');
      var t = navLink(it); t.className = t.className.replace(' active', '') + ' nav-group-toggle'; t.removeAttribute('href'); t.setAttribute('role', 'button');
      var ul = el('ul', 'nav-group-items');
      it.children.forEach(function (c) { var ci = el('li', 'nav-item'); ci.appendChild(navLink(c, true)); ul.appendChild(ci); });
      li.appendChild(t); li.appendChild(ul);
    } else li.appendChild(navLink(it));
    return li;
  }
  // ═══════════════════════════════════════════
  // BLOCKS — one vocabulary for topbar, sidebar and page
  // render(spec, { area: 'topbar' | 'sidebar' | 'page' }) → Node.  Every spec accepts: can, hidden, id, className.
  // ═══════════════════════════════════════════
  var blocks = {};
  function register(type, areas, fn) { blocks[type] = { areas: areas, render: fn }; }
  var AREA_DEFAULTS = {
    topbar: { variant: 'ghost', size: 'sm' },
    sidebar: { size: 'sm', className: 'w-100 justify-content-start' },
    page: {}
  };
  function typeOf(spec, area) {
    if (spec.type) return spec.type;
    if (spec.divider) return area === 'sidebar' ? 'nav' : 'divider';
    if (area === 'sidebar' && (spec.title || spec.label || spec.children)) return 'nav';
    return 'button';
  }
  function render(spec, ctx) {
    ctx = ctx || { area: 'page' };
    if (spec instanceof Node) return spec;
    if (typeof spec === 'string') spec = blocks[spec] ? { type: spec } : { label: spec };
    if (spec.can != null && !can(spec.can)) return document.createComment('vx: not permitted');
    var type = typeOf(spec, ctx.area), b = blocks[type];
    if (!b) { console.warn('Verxee UI: unknown block type "' + type + '"'); return document.createComment('vx: unknown ' + type); }
    if (b.areas.indexOf(ctx.area) < 0) console.warn('Verxee UI: block "' + type + '" is meant for ' + b.areas.join('/') + ', not ' + ctx.area);
    var n = b.render(spec, ctx);
    if (n.nodeType === 1) {
      if (spec.className) spec.className.split(/\s+/).forEach(function (c) { if (c) n.classList.add(c); });
      if (spec.hidden) n.hidden = true;
      if (spec.id) n.id = spec.id;
    }
    return n;
  }
  function renderAll(list, parent, ctx) { (list || []).forEach(function (s) { parent.appendChild(render(s, ctx)); }); return parent; }
  function mount(target, list) { target = $(target); target.textContent = ''; return renderAll(list, target, { area: 'page' }); }
  function listBlocks() { return Object.keys(blocks).map(function (k) { return { type: k, areas: blocks[k].areas.slice() }; }); }
  var ALL = ['topbar', 'sidebar', 'page'];

  // ── Shared blocks (topbar + sidebar + page) ──
  register('button', ALL, function (s, c) { return button(merge(merge({}, AREA_DEFAULTS[c.area]), s)); });
  register('menu', ALL, function (s, c) { return menu(merge(merge({}, AREA_DEFAULTS[c.area]), s)); });
  register('theme', ALL, function (s, c) { var t = button(merge(merge({ icon: 'moon', title: 'Toggle theme' }, AREA_DEFAULTS[c.area]), s)); t.setAttribute('data-theme-toggle', ''); return t; });
  register('notifications', ALL, function (s) { return notifications(s); });
  register('user', ALL, function (s) { return user(merge(merge({}, currentUser || {}), s)); });
  register('logout', ALL, function (s, c) { return button(merge(merge({ label: 'Sign out', icon: 'logout', variant: 'ghost', onClick: function () { logout(); } }, AREA_DEFAULTS[c.area]), s)); });
  register('search', ALL, function (s) {
    var g = el('div', 'input-group'), i = el('span', 'input-group-text'); i.appendChild(icon('search'));
    var inp = el('input', 'form-control'); inp.type = 'search'; inp.placeholder = s.placeholder || 'Search…'; inp.setAttribute('aria-label', s.placeholder || 'Search');
    if (s.name) inp.name = s.name; if (s.value) inp.value = s.value; if (s.width) g.style.width = typeof s.width === 'number' ? s.width + 'px' : s.width;
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && s.onSearch) s.onSearch(inp.value, e); });
    if (s.onInput) inp.addEventListener('input', function (e) { s.onInput(inp.value, e); });
    g.appendChild(i); g.appendChild(inp); return g;
  });
  register('badge', ALL, function (s) { return el('span', 'status status--' + (s.variant || 'neutral'), s.label || s.text); });
  register('avatar', ALL, function (s) { return el('span', 'avatar' + (s.size === 'lg' ? ' avatar-lg' : ''), s.initials || String(s.name || '?').split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase()); });
  register('text', ALL, function (s) { return el(s.tag || 'span', s.muted ? 'muted' : '', s.text); });
  register('link', ALL, function (s) { var a = el('a'); a.href = safeHref(s.href); if (s.icon) { a.appendChild(icon(s.icon)); a.appendChild(document.createTextNode(' ')); } a.appendChild(document.createTextNode(s.label || '')); bindAction(a, s); return a; });
  register('html', ALL, function (s) { var d = el('div'); fill(d, { html: s.html }); return d; });
  register('divider', ALL, function (s, c) { return c.area === 'topbar' ? el('span', 'border-start align-self-stretch my-2') : el('hr', 'my-2'); });
  register('spacer', ALL, function () { var d = el('div'); d.style.flex = '1 1 auto'; return d; });

  // ── Sidebar-only block ──
  register('nav', ['sidebar'], function (s) { return navItem(s); });

  // ── Page blocks ──
  function kids(list, parent, area) { return renderAll(list, parent, { area: area || 'page' }); }
  register('heading', ['page'], function (s) {
    var h = el('div', 'page-head'), t = el('h1'); if (s.icon) t.appendChild(icon(s.icon)); t.appendChild(document.createTextNode(s.title || ''));
    if (s.status) t.appendChild(el('span', 'status status--' + (s.status.variant || 'neutral'), s.status.label));
    h.appendChild(t); kids(s.actions, h.appendChild(el('div', 'actions'))); return h;
  });
  register('stats', ['page'], function (s) {
    var strip = el('div', 'stats-strip');
    (s.items || []).forEach(function (it) {
      var st = el('div', 'stat' + (it.alert ? ' stat--alert' : '')), l = el('div', 'stat-label');
      if (it.icon) l.appendChild(icon(it.icon)); l.appendChild(document.createTextNode(it.label || ''));
      st.appendChild(l); st.appendChild(el('div', 'stat-value', it.value)); if (it.sub != null) st.appendChild(el('div', 'stat-sub', it.sub));
      if (it.onClick) { st.setAttribute('role', 'button'); st.tabIndex = 0; st.addEventListener('click', it.onClick); }
      strip.appendChild(st);
    });
    return strip;
  });
  register('kpi', ['page'], function (s) {
    var g = el('div', 'grid-3');
    (s.items || []).forEach(function (it) { var c = el('div', 'card kpi'); c.appendChild(el('div', 'kpi-label', it.label)); c.appendChild(el('div', 'kpi-value', it.value)); if (it.sub != null) c.appendChild(el('div', 'kpi-sub', it.sub)); g.appendChild(c); });
    return g;
  });
  register('card', ['page', 'sidebar'], function (s) {
    var c = el('div', 'card'); if (s.title) c.appendChild(el('div', 'card-header', s.title));
    var body = s.flush ? c : c.appendChild(el('div', 'card-body'));
    if (s.html != null || s.text != null) fill(body, s); kids(s.body, body, 'page');
    if (s.footer) kids(s.footer, c.appendChild(el('div', 'card-footer d-flex gap-2')));
    return c;
  });
  register('grid', ['page'], function (s) {
    var g = el('div', s.cols === 2 || !s.cols ? 'grid-2' : s.cols === 3 ? 'grid-3' : '');
    if (s.cols > 3) { g.style.display = 'grid'; g.style.gap = '16px'; g.style.gridTemplateColumns = 'repeat(' + s.cols + ', 1fr)'; }
    return kids(s.items, g);
  });
  register('tabs', ['page'], function (s) {
    var t = el('div', 'tabs-line');
    (s.items || []).forEach(function (it) { var a = el('a', it.active ? 'active' : '', it.label); a.href = safeHref(it.href || '#'); bindAction(a, it); t.appendChild(a); });
    return t;
  });
  register('table', ['page'], function (s) {
    var card = el('div', 'card'), wrap = card.appendChild(el('div', 'table-responsive')), t = wrap.appendChild(el('table', 'table table-hover mb-0'));
    var cols = s.columns || [], hr = t.appendChild(el('thead')).appendChild(el('tr'));
    cols.forEach(function (c) { hr.appendChild(el('th', c.className || '', c.label)); });
    var tb = t.appendChild(el('tbody'));
    (s.rows || []).forEach(function (row) {
      var tr = tb.appendChild(el('tr', s.onRowClick ? 'row-link' : ''));
      if (s.onRowClick) tr.addEventListener('click', function (e) { if (!e.target.closest('a,button')) s.onRowClick(row); });
      cols.forEach(function (c) {
        var td = tr.appendChild(el('td', (c.align === 'end' ? 'text-end ' : '') + (c.tabular ? 'text-tabular' : '')));
        var v = c.render ? c.render(row) : row[c.key];
        if (c.status && c.status[v]) td.appendChild(el('span', 'status status--' + c.status[v], v));
        else if (v instanceof Node) td.appendChild(v); else if (v && typeof v === 'object') td.appendChild(render(v)); else td.textContent = v == null ? '' : v;
      });
    });
    if (!(s.rows || []).length) { var e = s.empty || {}; var d = el('div', 'empty'); d.appendChild(icon(e.icon || 'inbox')).className += ' empty-icon'; d.appendChild(el('div', 'empty-title', e.title || 'Nothing here yet')); if (e.text) d.appendChild(el('div', 'empty-subtitle', e.text)); card.appendChild(d); }
    return card;
  });
  register('list', ['page', 'sidebar'], function (s) {
    var c = el('div', 'card');
    (s.items || []).forEach(function (it) {
      var r = el(it.href ? 'a' : 'div', 'list-row'); if (it.href) { r.href = safeHref(it.href); r.style.textDecoration = 'none'; r.style.color = 'inherit'; }
      if (it.dot) r.appendChild(el('span', 'dot dot-' + it.dot));
      var g = r.appendChild(el('div', 'grow truncate')); g.appendChild(document.createTextNode(it.title || '')); if (it.sub) g.appendChild(el('div', 'help', it.sub));
      if (it.right != null) r.appendChild(el('span', 'muted', it.right)); bindAction(r, it); c.appendChild(r);
    });
    return c;
  });
  register('timeline', ['page'], function (s) {
    var u = el('ul', 'timeline');
    (s.items || []).forEach(function (it) { var li = u.appendChild(el('li')); li.appendChild(el('span', 'dot dot-' + (it.dot || 'info'))); li.appendChild(el('span', 'grow', it.title)); if (it.time) li.appendChild(el('span', 'help', it.time)); });
    return u;
  });
  register('empty', ['page'], function (s) {
    var c = el('div', 'card'), d = c.appendChild(el('div', 'empty')); d.appendChild(icon(s.icon || 'inbox')).className += ' empty-icon';
    d.appendChild(el('div', 'empty-title', s.title || 'Nothing here yet')); if (s.text) d.appendChild(el('div', 'empty-subtitle', s.text));
    if (s.action) d.appendChild(el('div', 'empty-action')).appendChild(button(merge({ variant: 'primary', size: 'sm' }, s.action)));
    return c;
  });
  register('progress', ['page', 'sidebar'], function (s) { var p = el('div', 'progress-thin'), b = p.appendChild(el('span')); b.style.width = Math.max(0, Math.min(100, +s.value || 0)) + '%'; p.setAttribute('role', 'progressbar'); p.setAttribute('aria-valuenow', s.value); return p; });
  register('form', ['page', 'sidebar'], function (s) {
    var f = el('form'), inputs = {}; f.noValidate = false;
    (s.fields || []).forEach(function (fd, i) { var r = buildField(fd, 'vx-f' + Date.now() + i); inputs[fd.name] = { el: r.input, f: fd }; f.appendChild(r.row); });
    var bar = f.appendChild(el('div', 'd-flex gap-2 mt-3')); bar.appendChild(button({ label: s.submitText || 'Save', variant: 'primary' })).type = 'submit';
    f.addEventListener('submit', function (e) { e.preventDefault(); var v = readFields(inputs); if (v && s.onSubmit) s.onSubmit(v, f); });
    return f;
  });

  // ═══════════════════════════════════════════
  // AUTH — a UI for YOUR backend. The server owns identity, sessions, rate limiting and every permission check.
  // ═══════════════════════════════════════════
  var currentUser = null, authCfg = null, authCtl = null, chan = null;

  function can(p) { // UI convenience only — hiding an element is not access control; enforce on the server
    if (p == null) return true;
    if (typeof p === 'function') return !!p(currentUser);
    if (!authCfg && !currentUser) return true;
    var perms = (currentUser && currentUser.permissions) || [];
    return perms.indexOf('*') > -1 || [].concat(p).some(function (x) { return perms.indexOf(x) > -1; });
  }
  function csrfToken() {
    var s = defaults.security.csrf || {};
    if (typeof s.token === 'function') return s.token();
    var m = document.querySelector('meta[name="csrf-token"]'); if (m) return m.getAttribute('content');
    var c = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/); return c ? decodeURIComponent(c[1]) : null;
  }
  // fetch() with same-origin cookies, CSRF header on unsafe methods, optional { json }, and a 401 → "session expired" screen
  function vxFetch(url, o) {
    o = merge({}, o || {}); var h = new Headers(o.headers || {}), m = (o.method || 'GET').toUpperCase(), name = (defaults.security.csrf || {}).header || 'X-CSRF-Token';
    if (m !== 'GET' && m !== 'HEAD') { var t = csrfToken(); if (t && !h.has(name)) h.set(name, t); }
    if (o.json !== undefined) { h.set('Content-Type', 'application/json'); o.body = JSON.stringify(o.json); delete o.json; }
    o.headers = h; o.credentials = o.credentials || 'same-origin';
    return fetch(url, o).then(function (r) { if (r.status === 401 && authCtl) authCtl.expired(); return r; });
  }
  function adapter(a) {
    var u = a.urls || {};
    function post(url) { return function (v) { return vxFetch(url, { method: 'POST', json: v || {}, headers: { Accept: 'application/json' } }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.message || ''); return d; }); }); }; }
    return {
      session: a.session || (u.session ? function () { return vxFetch(u.session, { headers: { Accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : null; }); } : function () { return Promise.resolve(null); }),
      login: a.login || (u.login ? post(u.login) : null),
      verify2fa: a.verify2fa || (u.verify2fa ? post(u.verify2fa) : null),
      forgot: a.forgot || (u.forgot ? post(u.forgot) : null),
      logout: a.logout || (u.logout ? post(u.logout) : function () { return Promise.resolve(); })
    };
  }
  function logout(reason) { if (authCtl) return authCtl.logout(reason); }

  var TEXTS = {
    title: 'Sign in', subtitle: 'Welcome back.', identifier: 'E-mail', identifierType: 'email', password: 'Password', submit: 'Sign in',
    forgotLink: 'Forgot your password?', invalid: 'Sign-in failed. Check your details and try again.', network: 'Could not reach the server. Try again.',
    codeTitle: 'Two-step verification', codeSub: 'Enter the 6-digit code from your authenticator app.', codeLabel: 'Code', verify: 'Verify',
    forgotTitle: 'Reset your password', forgotSub: 'Enter your e-mail and we will send you instructions.', send: 'Send instructions',
    sent: 'If an account exists for that address, instructions are on their way.', back: 'Back to sign in',
    locked: 'Too many attempts. Try again in {s} s.', expired: 'Your session has expired. Please sign in again.', signedOut: 'You have been signed out.',
    idle: 'You were signed out due to inactivity.', loading: 'Loading…'
  };
  function authScreen(o, T, brand) {
    var shell = el('div', 'auth-shell'); shell.id = 'vx-auth';
    var card = shell.appendChild(el('div', 'auth-card')), br = card.appendChild(el('div', 'auth-brand')), lg = br.appendChild(el('span', 'logo'));
    if (brand && brand.logo) { var im = el('img'); im.src = safeHref(brand.logo); im.alt = ''; im.style.cssText = 'width:100%;height:100%;object-fit:contain'; lg.appendChild(im); } else lg.appendChild(icon((brand && brand.icon) || 'layout-dashboard'));
    br.appendChild(document.createTextNode((brand && brand.name) || 'App'));
    var c = card.appendChild(el('div', 'card')).appendChild(el('div', 'card-body'));
    c.appendChild(el('div', 'auth-title', o.title)); if (o.sub) c.appendChild(el('div', 'auth-sub', o.sub));
    var msg = c.appendChild(el('div', 'invalid-msg mb-3')); msg.setAttribute('role', 'alert'); msg.hidden = !o.error; if (o.error) msg.textContent = o.error;
    if (o.notice) c.appendChild(el('div', 'explain mb-3', o.notice));
    var f = c.appendChild(el('form')); f.setAttribute('novalidate', ''); var inputs = {}, first = null;
    (o.fields || []).forEach(function (fd, i) {
      var row = f.appendChild(el('div', 'vx-field')), id = 'vx-a' + i, lab = row.appendChild(el('label', 'form-label', fd.label)); lab.setAttribute('for', id);
      var inp = row.appendChild(el('input', 'form-control' + (fd.otp ? ' otp-input' : ''))); inp.id = id; inp.name = fd.name; inp.type = fd.type || 'text'; inp.required = true;
      inp.setAttribute('autocomplete', fd.autocomplete || 'off'); if (fd.inputmode) inp.setAttribute('inputmode', fd.inputmode); if (fd.maxlength) inp.maxLength = fd.maxlength;
      inp.setAttribute('autocapitalize', 'none'); inp.spellcheck = false; inputs[fd.name] = inp; first = first || inp;
    });
    var sub = f.appendChild(el('button', 'btn btn-primary w-100 mt-3', o.submit)); sub.type = 'submit';
    f.addEventListener('submit', function (e) {
      e.preventDefault(); if (sub.disabled) return;
      var v = {}, bad = false; Object.keys(inputs).forEach(function (k) { v[k] = inputs[k].value; if (!inputs[k].value.trim()) { bad = true; inputs[k].classList.add('is-invalid'); } else inputs[k].classList.remove('is-invalid'); });
      if (bad) return;
      msg.hidden = true; sub.disabled = true; sub.textContent = T.loading;
      Promise.resolve(o.onSubmit(v)).then(function () {}, function (err) { msg.textContent = (err && err.message) || o.fail; msg.hidden = false; })
        .then(function () { if (document.body.contains(sub)) { sub.disabled = false; sub.textContent = o.submit; if (o.clear) Object.keys(inputs).forEach(function (k) { inputs[k].value = ''; }); } });
    });
    (o.links || []).forEach(function (l) { var p = c.appendChild(el('div', 'text-center mt-3')), a = p.appendChild(el('a', '', l.label)); a.href = '#'; a.addEventListener('click', function (e) { e.preventDefault(); l.onClick(); }); });
    if (o.foot) card.appendChild(el('div', 'auth-foot', o.foot));
    return { node: shell, focus: function () { if (first) first.focus(); }, lock: function (s) { sub.disabled = true; msg.hidden = false; msg.textContent = T.locked.replace('{s}', s); } };
  }

  // ── Sidebar ──
  function wrapBlock(n) { var d = el('div', 'sidebar-block'); d.appendChild(n); return d; }
  function fillSidebar(sb, c) {
    sb.textContent = '';
    function put(list, parent, flat) {
      var ul = null;
      (list || []).forEach(function (s) {
        if (s instanceof Node) { ul = null; parent.appendChild(wrapBlock(s)); return; }
        if (typeof s === 'string') s = blocks[s] ? { type: s } : { label: s };
        if (s.can != null && !can(s.can)) return;
        if (typeOf(s, 'sidebar') === 'nav') {
          if (flat) { if (!s.title && !s.divider) { var l = navLink(s); l.className += ' fs-sm'; parent.appendChild(l); } return; }
          if (!ul) { ul = el('ul', 'sidebar-nav'); ul.setAttribute('data-coreui', 'navigation'); parent.appendChild(ul); }
          ul.appendChild(render(s, { area: 'sidebar' }));
        } else { ul = null; parent.appendChild(wrapBlock(render(s, { area: 'sidebar' }))); }
      });
    }
    if ((c.sidebarHeader || []).length) put(c.sidebarHeader, sb.appendChild(el('div', 'sidebar-top')));
    put(c.sidebar, sb);
    var f = el('div', 'sidebar-footer border-top'); put(c.sidebarFooter, f, true); if (f.childNodes.length) sb.appendChild(f);
  }

  // ── App shell ──
  // app({ brand, topbar: { left, center, right }, sidebarHeader, sidebar, sidebarFooter, page, auth, theme, … defaults })
  function app(cfg) {
    cfg = cfg || {};
    configure(cfg);
    var main = document.getElementById('main') || el('main');
    if (!main.parentNode) document.body.appendChild(main);
    main.id = 'main'; main.classList.add('admin-content');
    var wrap = document.querySelector('.admin-wrapper');
    if (!wrap) { wrap = el('div', 'admin-wrapper'); main.parentNode.insertBefore(wrap, main); wrap.appendChild(main); }
    var held = document.createDocumentFragment();
    function park() { if (cfg.page) main.textContent = ''; else while (main.firstChild) held.appendChild(main.firstChild); }
    var T = merge(merge({}, TEXTS), (cfg.auth && cfg.auth.texts) || {}), bar, sb, ctl, hooksBound = false, fails = 0, lockUntil = 0;
    if (cfg.user) currentUser = cfg.user;

    function clearShell() { ['.admin-topbar', '.sidebar', '.sidebar-backdrop', '.skip-link', '#vx-auth'].forEach(function (s) { var o = document.querySelector(s); if (o) o.remove(); }); }
    function buildShell() {
      clearShell();
      var skip = el('a', 'skip-link visually-hidden-focusable', 'Skip to content'); skip.href = '#main';
      bar = buildTopbar(cfg.topbar || {}, cfg.brand);
      sb = el('div', 'sidebar sidebar-fixed'); sb.id = 'sidebar'; fillSidebar(sb, cfg);
      var bd = el('div', 'sidebar-backdrop'); bd.setAttribute('data-sidebar-toggle', '');
      [skip, bar, sb, bd].forEach(function (n) { document.body.insertBefore(n, wrap); });
      wrap.hidden = false; ctl.topbar = bar; ctl.sidebar = sb;
      if (cfg.page) { main.textContent = ''; renderAll(cfg.page, main, { area: 'page' }); } else main.appendChild(held);
      if (!hooksBound) { hooksBound = true; window.addEventListener('hashchange', function () { if (sb && document.body.contains(sb)) { fillSidebar(sb, cfg); sidebar.close(); } }); }
    }

    ctl = {
      main: main, topbar: null, sidebar: null,
      setSidebar: function (items, footer, header) { cfg.sidebar = items; if (footer) cfg.sidebarFooter = footer; if (header) cfg.sidebarHeader = header; if (sb) fillSidebar(sb, cfg); },
      setTopbar: function (t, brand) { cfg.topbar = t; if (brand) cfg.brand = brand; if (!bar) return; var n = buildTopbar(cfg.topbar, cfg.brand); bar.replaceWith(n); bar = n; ctl.topbar = n; },
      setPage: function (list) { cfg.page = list; main.textContent = ''; renderAll(list, main, { area: 'page' }); },
      get user() { return currentUser; }
    };

    if (!cfg.auth) { buildShell(); return ctl; }

    // — auth flow —
    var A = authCfg = cfg.auth, ad = adapter(A), idleT = null, lastAct = Date.now();
    try { chan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('verxee-auth') : null; } catch (e) { chan = null; }
    if (chan) chan.onmessage = function (e) { if (e.data === 'logout' && currentUser) { currentUser = null; stopIdle(); show('login', T.signedOut); } else if (e.data === 'login' && !currentUser) location.reload(); };

    function stopIdle() { clearInterval(idleT); }
    function startIdle() {
      stopIdle(); if (!A.idleTimeout) return;
      var ms = A.idleTimeout * 60000; lastAct = Date.now();
      idleT = setInterval(function () { if (Date.now() - lastAct > ms) ctl.logout(T.idle); }, 15000);
    }
    ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, function () { lastAct = Date.now(); }, { passive: true, capture: true }); });

    function enter(u) {
      currentUser = u && u.user ? u.user : u; fails = 0; buildShell(); startIdle();
      emit('verxee:login', { user: currentUser });
    }
    function show(view, note) {
      stopIdle(); wrap.hidden = true; park(); clearShell(); currentUser = view === '2fa' ? currentUser : null;
      var s;
      if (view === '2fa') s = authScreen({ title: T.codeTitle, sub: T.codeSub, submit: T.verify, fail: T.invalid, clear: true,
        fields: [{ name: 'code', label: T.codeLabel, autocomplete: 'one-time-code', inputmode: 'numeric', maxlength: 8, otp: true }],
        onSubmit: function (v) { return ad.verify2fa(v).then(function (d) { enter(d); if (chan) chan.postMessage('login'); }); },
        links: [{ label: T.back, onClick: function () { show('login'); } }] }, T, cfg.brand);
      else if (view === 'forgot') s = authScreen({ title: T.forgotTitle, sub: T.forgotSub, submit: T.send, fail: T.network,
        fields: [{ name: 'identifier', label: T.identifier, type: T.identifierType, autocomplete: 'username' }],
        onSubmit: function (v) { return ad.forgot({ identifier: v.identifier, email: v.identifier }).then(function () { show('login', T.sent); }); },
        links: [{ label: T.back, onClick: function () { show('login'); } }] }, T, cfg.brand);
      else s = authScreen({ title: A.title || T.title, sub: A.subtitle || T.subtitle, submit: T.submit, fail: T.invalid, notice: note, foot: A.footer,
        fields: [{ name: 'identifier', label: T.identifier, type: T.identifierType, autocomplete: 'username' }, { name: 'password', label: T.password, type: 'password', autocomplete: 'current-password' }],
        onSubmit: function (v) {
          var left = Math.ceil((lockUntil - Date.now()) / 1000); if (left > 0) { s.lock(left); return Promise.reject(new Error(T.locked.replace('{s}', left))); } // UX only — the server must rate-limit
          return ad.login({ identifier: v.identifier, email: v.identifier, username: v.identifier, password: v.password }).then(function (d) {
            if (d && d.twoFactor) { currentUser = null; show('2fa'); return; }
            enter(d); if (chan) chan.postMessage('login');
          }, function (err) { if (++fails >= 5) { fails = 0; lockUntil = Date.now() + 30000; } throw err; });
        },
        links: ad.forgot ? [{ label: T.forgotLink, onClick: function () { show('forgot'); } }] : [] }, T, cfg.brand);
      document.body.appendChild(s.node); s.focus();
    }
    ctl.logout = function (reason) {
      var done = function () { currentUser = null; stopIdle(); if (chan) chan.postMessage('logout'); emit('verxee:logout', {}); show('login', reason && typeof reason === 'string' ? reason : T.signedOut); };
      var go = function () { return Promise.resolve(ad.logout()).then(done, done); };
      return A.confirmLogout ? confirmDialog({ title: 'Sign out?', variant: 'info', confirmText: 'Sign out' }).then(function (ok) { if (ok) return go(); }) : go();
    };
    ctl.expired = function () { if (currentUser) { currentUser = null; stopIdle(); show('login', T.expired); } };
    authCtl = ctl;

    wrap.hidden = true; park();
    Promise.resolve(ad.session()).then(function (u) { if (u) enter(u); else show('login'); }, function () { show('login', T.network); });
    return ctl;
  }

  // ── Sidebar toggling (mobile) ──
  function sb() { return document.getElementById('sidebar'); }
  var sidebar = {
    open: function () { var s = sb(); if (s) s.classList.add('show'); },
    close: function () { var s = sb(); if (s) s.classList.remove('show'); },
    toggle: function () { var s = sb(); if (s) s.classList.toggle('show'); }
  };

  // ── Overlay (shared by confirm + modal) ──
  var stack = [];
  function openOverlay(box, dismiss, backdrop) {
    var prev = document.activeElement, ov = el('div', 'admin-confirm-overlay');
    ov.appendChild(box); document.body.appendChild(ov); stack.push(ov);
    function key(e) {
      if (stack[stack.length - 1] !== ov) return;
      if (e.key === 'Escape') { e.preventDefault(); dismiss(); }
      else if (e.key === 'Tab') {
        var f = [].slice.call(box.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(function (x) { return !x.disabled; });
        if (!f.length) return;
        e.preventDefault();
        f[(f.indexOf(document.activeElement) + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    }
    document.addEventListener('keydown', key, true);
    if (backdrop !== false) ov.addEventListener('mousedown', function (e) { if (e.target === ov) dismiss(); });
    return function close() {
      document.removeEventListener('keydown', key, true);
      stack.splice(stack.indexOf(ov), 1); ov.remove();
      if (prev && prev.focus) prev.focus();
    };
  }

  // ── Confirm dialog ──
  // confirm({ title, description, confirmText, cancelText, variant: 'danger|warning|info' }) → Promise<boolean>
  function confirmDialog(o) {
    var d = defaults.confirm; o = o || {};
    if (typeof o === 'string') o = { title: o };
    var variant = d.icons[o.variant || d.variant] ? (o.variant || d.variant) : 'warning';
    return new Promise(function (resolve) {
      var box = el('div', 'admin-confirm-box'), id = 'vx-c' + Date.now();
      box.setAttribute('role', 'alertdialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', id);
      var ic = el('div', 'admin-confirm-icon admin-confirm-icon--' + variant); ic.appendChild(icon(o.icon || d.icons[variant]));
      var title = el('h2', 'admin-confirm-title', o.title || d.title); title.id = id;
      var actions = el('div', 'admin-confirm-actions');
      var cancel = button({ label: o.cancelText || d.cancelText, variant: 'secondary' });
      var ok = button({ label: o.confirmText || d.confirmText, variant: variant === 'danger' ? 'danger' : 'primary' });
      actions.appendChild(cancel); actions.appendChild(ok);
      box.appendChild(ic); box.appendChild(title);
      if (o.description) box.appendChild(el('p', 'admin-confirm-desc', o.description));
      box.appendChild(actions);
      function done(r) { close(); resolve(r); }
      var close = openOverlay(box, function () { done(false); });
      ok.focus();
      ok.addEventListener('click', function () { done(true); });
      cancel.addEventListener('click', function () { done(false); });
    });
  }

  function buildField(f, fid) {
    var row = el('div', 'vx-field'), lab = el('label', 'form-label', f.label || f.name); lab.setAttribute('for', fid);
    var inp = f.type === 'textarea' ? el('textarea', 'form-control') : f.type === 'select' ? el('select', 'form-select') : el('input', 'form-control');
    if (f.type === 'select') (f.options || []).forEach(function (op) { var v = isObj(op) ? op.value : op; var oe = el('option', '', isObj(op) ? op.label : op); oe.value = v; inp.appendChild(oe); });
    else if (f.type !== 'textarea') inp.type = f.type || 'text';
    inp.id = fid; inp.name = f.name; if (f.placeholder) inp.placeholder = f.placeholder; if (f.value != null) inp.value = f.value; if (f.autocomplete) inp.setAttribute('autocomplete', f.autocomplete);
    row.appendChild(lab); row.appendChild(inp); if (f.hint) row.appendChild(el('div', 'form-hint', f.hint));
    return { row: row, input: inp };
  }
  function readFields(inputs) { // → values object, or null when a required field is empty
    var out = {}, bad = false;
    Object.keys(inputs).forEach(function (k) { var i = inputs[k]; i.el.classList.remove('is-invalid'); if (i.f.required && !i.el.value.trim()) { i.el.classList.add('is-invalid'); bad = true; } out[k] = i.el.value; });
    return bad ? null : out;
  }

  // ── Modal ──
  // modal({ title, text | html | content, size: 'sm|md|lg', fields: [{ name, label, type, value, placeholder, required, options }],
  //         buttons: [{ label, variant, value, onClick }] }) → Promise
  //   no fields: resolves with the pressed button's value (OK = true, Cancel = false, dismissed = null)
  //   with fields: resolves with { name: value, … } on OK, null otherwise
  function modal(o) {
    var d = defaults.modal; o = o || {};
    return new Promise(function (resolve) {
      var box = el('div', 'vx-modal-box vx-modal-box--' + (o.size || d.size)), id = 'vx-m' + Date.now();
      box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', id);
      var head = el('div', 'vx-modal-head'), title = el('h2', 'vx-modal-title', o.title || ''); title.id = id; head.appendChild(title);
      var closable = o.closable != null ? o.closable : d.closable;
      if (closable) { var x = button({ icon: 'x', variant: 'ghost', size: 'sm', title: 'Close' }); x.addEventListener('click', function () { done(null); }); head.appendChild(x); }
      var body = el('div', 'vx-modal-body'); fill(body, o);
      var inputs = {};
      (o.fields || []).forEach(function (f, i) { var r = buildField(f, id + '-f' + i); inputs[f.name] = { el: r.input, f: f }; body.appendChild(r.row); });
      var foot = el('div', 'vx-modal-foot');
      var btns = o.buttons || [{ label: o.cancelText || d.cancelText, variant: 'secondary', value: false }, { label: o.okText || d.okText, variant: 'primary', value: true, submit: true }];
      var first = null;
      btns.forEach(function (bt) {
        var b = button(bt); foot.appendChild(b); if (bt.submit || bt.variant === 'primary') first = first || b;
        b.addEventListener('click', function () {
          var val = bt.value;
          if (bt.submit || (o.fields && val === true)) {
            var out = readFields(inputs);
            if (!out) return;
            val = o.fields ? out : val;
          } else if (o.fields) val = null;
          Promise.resolve(bt.onClick ? bt.onClick(val) : undefined).then(function (r) { if (r !== false) done(val); });
        });
      });
      box.appendChild(head); box.appendChild(body); box.appendChild(foot);
      function done(r) { close(); resolve(r); }
      var close = openOverlay(box, function () { if (closable) done(null); }, o.closeOnBackdrop != null ? o.closeOnBackdrop : d.closeOnBackdrop);
      var firstInput = box.querySelector('input,textarea,select'); (firstInput || first || box).focus();
      box.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && first) first.click(); });
    });
  }

  // ── Popover ──
  // popover(anchor, { title, text | html | content, actions: [button specs], placement: 'bottom|top' }) → { close }
  var openPop = null;
  function popover(anchor, o) {
    anchor = $(anchor); o = o || {};
    if (openPop) openPop.close();
    var p = el('div', 'admin-popover pop-fixed vx-popover'); p.setAttribute('role', 'dialog');
    if (o.title) p.appendChild(el('div', 'vx-popover-title', o.title));
    var body = el('div'); fill(body, o); p.appendChild(body);
    if (o.actions && o.actions.length) {
      var ac = el('div', 'vx-popover-actions');
      o.actions.forEach(function (a) { a = merge({ size: 'sm' }, a); var b = button(a); b.addEventListener('click', function () { api.close(); }); ac.appendChild(b); });
      p.appendChild(ac);
    }
    p.style.position = 'fixed'; p.style.visibility = 'hidden'; document.body.appendChild(p);
    var r = anchor.getBoundingClientRect(), h = p.offsetHeight, w = p.offsetWidth;
    var below = o.placement === 'top' ? false : (r.bottom + 8 + h < innerHeight || r.top - 8 - h < 0);
    p.style.top = Math.max(8, below ? r.bottom + 8 : r.top - 8 - h) + 'px';
    p.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px'; p.style.visibility = '';
    function onDown(e) { if (!p.contains(e.target) && !anchor.contains(e.target)) api.close(); }
    function onKey(e) { if (e.key === 'Escape') api.close(); }
    document.addEventListener('mousedown', onDown, true); document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', api_close);
    var api = { element: p, close: function () { document.removeEventListener('mousedown', onDown, true); document.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', api_close); p.remove(); if (openPop === api) openPop = null; } };
    function api_close() { api.close(); }
    openPop = api;
    return api;
  }

  // ── Toast ──
  // toast('Saved') · toast('Failed', { type: 'critical', duration: 5000 }); type: success|warning|critical|info; duration 0 = sticky
  function placeStack(s) {
    var pos = defaults.toast.position || 'bottom-right';
    s.style.top = /top/.test(pos) ? '16px' : 'auto'; s.style.bottom = /top/.test(pos) ? 'auto' : '16px';
    s.style.left = /left/.test(pos) ? '16px' : /center/.test(pos) ? '50%' : 'auto';
    s.style.right = /left|center/.test(pos) ? 'auto' : '16px';
    s.style.transform = /center/.test(pos) ? 'translateX(-50%)' : '';
  }
  function toast(message, opts) {
    opts = opts || {};
    var s = document.querySelector('.toast-stack');
    if (!s) { s = el('div', 'toast-stack'); s.setAttribute('role', 'status'); s.setAttribute('aria-live', 'polite'); document.body.appendChild(s); }
    placeStack(s);
    var t = el('div', 'toast-msg' + (opts.type ? ' toast-msg--' + opts.type : ''), message);
    s.appendChild(t);
    function close() { if (t.parentNode) t.parentNode.removeChild(t); }
    var ms = opts.duration == null ? defaults.toast.duration : opts.duration;
    if (ms > 0) setTimeout(close, ms);
    t.addEventListener('click', close);
    return { close: close, element: t };
  }

  // ── Declarative hooks ──
  // [data-theme-toggle] · [data-sidebar-toggle] · [data-confirm="Message"] (+ data-confirm-title / -ok / -variant)
  // [data-vx-popover="Text"] (+ data-vx-popover-title)
  document.addEventListener('click', function (ev) {
    if (ev.target.closest('[data-theme-toggle]')) theme.toggle();
    if (ev.target.closest('[data-sidebar-toggle]')) sidebar.toggle();
    var pp = ev.target.closest('[data-vx-popover]');
    if (pp) { if (openPop && openPop.anchor === pp) { openPop.close(); } else { var pr = popover(pp, { title: pp.getAttribute('data-vx-popover-title'), text: pp.getAttribute('data-vx-popover') }); pr.anchor = pp; } }
    var c = ev.target.closest('[data-confirm]');
    if (c) {
      if (c._vxConfirmed) { c._vxConfirmed = false; return; }
      ev.preventDefault(); ev.stopPropagation();
      confirmDialog({
        title: c.getAttribute('data-confirm-title') || c.getAttribute('data-confirm'),
        description: c.getAttribute('data-confirm-title') ? c.getAttribute('data-confirm') : '',
        confirmText: c.getAttribute('data-confirm-ok') || undefined,
        variant: c.getAttribute('data-confirm-variant') || 'danger'
      }).then(function (yes) { if (yes) { c._vxConfirmed = true; c.click(); } });
    }
  }, true);

  // Zero-JS setup: <script type="application/json" data-verxee-config>{ … }</script>
  function autoConfig() {
    var s = document.querySelector('script[type="application/json"][data-verxee-config]');
    if (s) { try { app(JSON.parse(s.textContent)); } catch (e) { console.error('Verxee UI: invalid data-verxee-config JSON', e); } }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoConfig); else autoConfig();

  window.VerxeeUI = {
    version: '2.2.0', defaults: defaults, configure: configure, app: app, render: render, mount: mount, register: register, blocks: listBlocks,
    can: can, fetch: vxFetch, sanitize: sanitize, logout: logout, get user() { return currentUser; },
    theme: theme, sidebar: sidebar, button: button, toast: toast, confirm: confirmDialog, modal: modal, popover: popover
  };
})();
