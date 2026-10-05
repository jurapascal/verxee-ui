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
  function fill(node, o) { // content: html (trusted) | text | Node
    if (o.html != null) node.innerHTML = o.html;
    else if (o.content instanceof Node) node.appendChild(o.content);
    else if (o.text != null) node.textContent = o.text;
  }

  // ── Defaults (change with VerxeeUI.configure) ──
  var defaults = {
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
    ['toast', 'confirm', 'modal', 'buttons'].forEach(function (k) { if (c[k]) merge(defaults[k], c[k]); });
    var stack = document.querySelector('.toast-stack'); if (stack) placeStack(stack);
    return defaults;
  }

  // ── Buttons & actions ──
  // Action spec: { label, icon, href, variant, size: 'sm|lg', title, badge, disabled, onClick, confirm: {...}, type: 'menu', items: [...] }
  function button(a) {
    if (typeof a === 'string') a = { label: a };
    var cls = defaults.buttons[a.variant || 'secondary'] || a.variant;
    var n = el(a.href ? 'a' : 'button', 'btn ' + cls + (a.size ? ' btn-' + a.size : '') + (a.label ? '' : ' btn--icon') + (a.className ? ' ' + a.className : ''));
    if (a.href) n.setAttribute('href', a.href); else n.type = 'button';
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
        confirmDialog(a.confirm).then(function (ok) { if (ok && a.onClick) a.onClick(ev, a); else if (ok && a.href) location.href = a.href; });
      } else a.onClick(ev, a);
    });
  }
  function menuItem(i) {
    if (i.divider) return el('hr', 'dropdown-divider');
    var n = el(i.href ? 'a' : 'button', 'dropdown-item' + (i.danger ? ' text-danger' : ''));
    if (i.href) n.href = i.href; else n.type = 'button';
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
      var i = el('a', 'notif-item' + (n.unread ? ' unread' : '')); i.href = n.href || '#';
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
    b.setAttribute('data-coreui-toggle', 'dropdown'); b.setAttribute('aria-label', a.name || 'Account');
    var initials = a.initials || String(a.name || '?').split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
    b.appendChild(el('span', 'avatar', initials));
    if (a.name) b.appendChild(el('span', 'hide-xs', a.name));
    var m = el('div', 'dropdown-menu dropdown-menu-end');
    (a.menu || []).forEach(function (i) { m.appendChild(menuItem(i)); });
    wrap.appendChild(b); wrap.appendChild(m);
    return wrap;
  }
  function topbarItem(a) {
    if (a === 'theme') a = { type: 'theme' };
    switch (a.type) {
      case 'theme': var t = button({ icon: 'moon', variant: 'ghost', size: 'sm', title: 'Toggle theme' }); t.setAttribute('data-theme-toggle', ''); return t;
      case 'notifications': return notifications(a);
      case 'user': return user(a);
      case 'menu': return menu(a);
      case 'html': var h = el('div'); h.innerHTML = a.html; return h;
      default: return button(merge({ variant: 'ghost', size: 'sm' }, a));
    }
  }
  // topbar: { brand: { name, icon, href, logo (html/img url) }, left: [...], right: [...] }
  function buildTopbar(cfg, brandCfg) {
    var bar = el('nav', 'admin-topbar'); bar.setAttribute('aria-label', 'Top bar');
    var m = button({ icon: 'menu-2', variant: 'ghost', size: 'sm', title: 'Menu', className: 'd-lg-none me-2' }); m.setAttribute('data-sidebar-toggle', '');
    bar.appendChild(m);
    var b = brandCfg || {}, brand = el('div', 'brand me-3'), a = el('a'); a.href = b.href || '#';
    var logo = el('span', 'brand-logo');
    if (b.logo) logo.innerHTML = '<img src="' + String(b.logo).replace(/"/g, '&quot;') + '" alt="" style="width:100%;height:100%;object-fit:contain">'; else logo.appendChild(icon(b.icon || 'layout-dashboard'));
    a.appendChild(logo); a.appendChild(el('span', 'hide-xs', b.name || 'App')); brand.appendChild(a); bar.appendChild(brand);
    (cfg.left || []).forEach(function (x) { bar.appendChild(topbarItem(x)); });
    var right = el('div', 'd-flex align-items-center gap-2 ms-auto');
    (cfg.right || ['theme']).forEach(function (x) { right.appendChild(topbarItem(x)); });
    bar.appendChild(right);
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
    var a = el('a', 'nav-link' + (isActive(it) ? ' active' : '')); a.href = it.href || '#';
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
  function fillSidebar(sb, items, footer) {
    sb.textContent = '';
    var ul = el('ul', 'sidebar-nav'); ul.setAttribute('data-coreui', 'navigation');
    (items || []).forEach(function (it) { ul.appendChild(navItem(it)); });
    sb.appendChild(ul);
    if (footer && footer.length) {
      var f = el('div', 'sidebar-footer border-top');
      footer.forEach(function (it) { var l = navLink(it); l.className += ' fs-sm'; f.appendChild(l); });
      sb.appendChild(f);
    }
  }

  // ── App shell ──
  // app({ brand, topbar: { left, right }, sidebar: [...], sidebarFooter: [...], theme, ...defaults }) — wraps <main id="main">
  function app(cfg) {
    cfg = cfg || {};
    configure(cfg);
    var main = document.getElementById('main') || el('main', '', null);
    if (!main.parentNode) document.body.appendChild(main);
    main.id = 'main'; main.classList.add('admin-content');
    var wrap = document.querySelector('.admin-wrapper');
    if (!wrap) { wrap = el('div', 'admin-wrapper'); main.parentNode.insertBefore(wrap, main); wrap.appendChild(main); }
    ['.admin-topbar', '.sidebar', '.sidebar-backdrop'].forEach(function (s) { var o = document.querySelector(s); if (o) o.remove(); });
    var skip = el('a', 'skip-link visually-hidden-focusable', 'Skip to content'); skip.href = '#main';
    var bar = buildTopbar(cfg.topbar || {}, cfg.brand);
    var sb = el('div', 'sidebar sidebar-fixed'); sb.id = 'sidebar';
    fillSidebar(sb, cfg.sidebar, cfg.sidebarFooter);
    var bd = el('div', 'sidebar-backdrop'); bd.setAttribute('data-sidebar-toggle', '');
    [skip, bar, sb, bd].forEach(function (n) { document.body.insertBefore(n, wrap); });
    window.addEventListener('hashchange', function () { fillSidebar(sb, cfg.sidebar, cfg.sidebarFooter); sidebar.close(); });
    return {
      main: main, topbar: bar, sidebar: sb,
      setSidebar: function (items, footer) { cfg.sidebar = items; if (footer) cfg.sidebarFooter = footer; fillSidebar(sb, cfg.sidebar, cfg.sidebarFooter); },
      setTopbar: function (t, brand) { var n = buildTopbar(t, brand || cfg.brand); bar.replaceWith(n); bar = n; this.topbar = n; }
    };
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
      (o.fields || []).forEach(function (f, i) {
        var row = el('div', 'vx-field'), fid = id + '-f' + i, lab = el('label', 'form-label', f.label || f.name); lab.setAttribute('for', fid);
        var inp = f.type === 'textarea' ? el('textarea', 'form-control') : f.type === 'select' ? el('select', 'form-select') : el('input', 'form-control');
        if (f.type === 'select') (f.options || []).forEach(function (op) { var v = isObj(op) ? op.value : op; var oe = el('option', '', isObj(op) ? op.label : op); oe.value = v; inp.appendChild(oe); });
        else if (f.type !== 'textarea') inp.type = f.type || 'text';
        inp.id = fid; if (f.placeholder) inp.placeholder = f.placeholder; if (f.value != null) inp.value = f.value;
        inputs[f.name] = { el: inp, f: f };
        row.appendChild(lab); row.appendChild(inp); if (f.hint) row.appendChild(el('div', 'form-hint', f.hint)); body.appendChild(row);
      });
      var foot = el('div', 'vx-modal-foot');
      var btns = o.buttons || [{ label: o.cancelText || d.cancelText, variant: 'secondary', value: false }, { label: o.okText || d.okText, variant: 'primary', value: true, submit: true }];
      var first = null;
      btns.forEach(function (bt) {
        var b = button(bt); foot.appendChild(b); if (bt.submit || bt.variant === 'primary') first = first || b;
        b.addEventListener('click', function () {
          var val = bt.value;
          if (bt.submit || (o.fields && val === true)) {
            var out = {}, bad = false;
            Object.keys(inputs).forEach(function (k) { var i = inputs[k]; i.el.classList.remove('is-invalid'); if (i.f.required && !i.el.value.trim()) { i.el.classList.add('is-invalid'); bad = true; } out[k] = i.el.value; });
            if (bad) return;
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
    version: '2.1.0', defaults: defaults, configure: configure, app: app,
    theme: theme, sidebar: sidebar, button: button, toast: toast, confirm: confirmDialog, modal: modal, popover: popover
  };
})();
