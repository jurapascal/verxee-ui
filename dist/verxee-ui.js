/*! Verxee UI — runtime: theme, sidebar, toast, confirm. No dependencies. */
(function () {
  'use strict';

  var root = document.documentElement, KEY = 'verxee-ui-theme';

  function emit(name, detail) {
    document.dispatchEvent(new CustomEvent(name, { detail: detail }));
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ── Theme ──
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

  // No saved choice yet → follow the OS preference.
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved) theme.set(saved, false);
  else if (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) theme.set('dark', false);

  // ── Sidebar (mobile off-canvas) ──
  function sb() { return document.getElementById('sidebar'); }
  var sidebar = {
    open: function () { var s = sb(); if (s) s.classList.add('show'); },
    close: function () { var s = sb(); if (s) s.classList.remove('show'); },
    toggle: function () { var s = sb(); if (s) s.classList.toggle('show'); }
  };

  // ── Toast ──
  // toast('Saved') · toast('Failed', { type: 'critical', duration: 5000 })
  // type: success | warning | critical | info (omit for the neutral dark toast). duration 0 = sticky.
  function toast(message, opts) {
    opts = opts || {};
    var stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = el('div', 'toast-stack');
      stack.setAttribute('role', 'status');
      stack.setAttribute('aria-live', 'polite');
      document.body.appendChild(stack);
    }
    var t = el('div', 'toast-msg' + (opts.type ? ' toast-msg--' + opts.type : ''), message);
    stack.appendChild(t);
    function close() { if (t.parentNode) t.parentNode.removeChild(t); }
    var ms = opts.duration == null ? 2500 : opts.duration;
    if (ms > 0) setTimeout(close, ms);
    t.addEventListener('click', close);
    return { close: close, element: t };
  }

  // ── Confirm dialog ──
  // confirm({ title, description, confirmText, cancelText, variant: 'danger'|'warning'|'info' }) → Promise<boolean>
  var ICONS = { danger: 'ti-trash', warning: 'ti-alert-triangle', info: 'ti-info-circle' };
  function confirmDialog(o) {
    o = o || {};
    var variant = ICONS[o.variant] ? o.variant : 'warning';
    return new Promise(function (resolve) {
      var prev = document.activeElement;
      var overlay = el('div', 'admin-confirm-overlay');
      var box = el('div', 'admin-confirm-box');
      box.setAttribute('role', 'alertdialog');
      box.setAttribute('aria-modal', 'true');
      var icon = el('div', 'admin-confirm-icon admin-confirm-icon--' + variant);
      icon.innerHTML = '<i class="ti ' + ICONS[variant] + '"></i>';
      var title = el('h2', 'admin-confirm-title', o.title || 'Are you sure?');
      title.id = 'vx-confirm-title';
      box.setAttribute('aria-labelledby', title.id);
      var actions = el('div', 'admin-confirm-actions');
      var cancel = el('button', 'btn btn-secondary', o.cancelText || 'Cancel');
      var ok = el('button', 'btn ' + (variant === 'danger' ? 'btn-outline-danger' : 'btn-primary'), o.confirmText || 'Confirm');
      cancel.type = ok.type = 'button';
      actions.appendChild(cancel); actions.appendChild(ok);
      box.appendChild(icon); box.appendChild(title);
      if (o.description) box.appendChild(el('p', 'admin-confirm-desc', o.description));
      box.appendChild(actions); overlay.appendChild(box);
      document.body.appendChild(overlay);
      ok.focus();

      function done(result) {
        document.removeEventListener('keydown', onKey, true);
        overlay.remove();
        if (prev && prev.focus) prev.focus();
        resolve(result);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); done(false); }
        else if (e.key === 'Tab') { // keep focus inside the dialog
          var f = [cancel, ok], i = f.indexOf(document.activeElement);
          e.preventDefault();
          f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
        }
      }
      document.addEventListener('keydown', onKey, true);
      ok.addEventListener('click', function () { done(true); });
      cancel.addEventListener('click', function () { done(false); });
      overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) done(false); });
    });
  }

  // ── Declarative hooks ──
  // [data-theme-toggle] · [data-sidebar-toggle] · [data-confirm="Message"] (+ data-confirm-title / -ok / -variant)
  document.addEventListener('click', function (ev) {
    if (ev.target.closest('[data-theme-toggle]')) theme.toggle();
    if (ev.target.closest('[data-sidebar-toggle]')) sidebar.toggle();

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

  window.VerxeeUI = { version: '2.0.0', theme: theme, sidebar: sidebar, toast: toast, confirm: confirmDialog };
})();
