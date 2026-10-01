/* Verxee UI — tiny helpers: theme toggle (persisted) + mobile sidebar. No dependencies. */
(function () {
  var root = document.documentElement, KEY = 'verxee-ui-theme';

  function setTheme(mode) {
    root.setAttribute('data-coreui-theme', mode);
    try { localStorage.setItem(KEY, mode); } catch (e) {}
  }

  // No saved choice yet → follow the OS preference.
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (!saved && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) {
    root.setAttribute('data-coreui-theme', 'dark');
  }

  document.addEventListener('click', function (ev) {
    if (ev.target.closest('[data-theme-toggle]')) {
      setTheme(root.getAttribute('data-coreui-theme') === 'dark' ? 'light' : 'dark');
    }
    if (ev.target.closest('[data-sidebar-toggle]')) {
      var sb = document.getElementById('sidebar');
      if (sb) sb.classList.toggle('show');
    }
  });
})();
