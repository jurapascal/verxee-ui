/*! Verxee UI hub bridge | MIT | github.com/jurapascal/verxee-ui
 * Standalone (no Verxee UI needed) for server-rendered apps that run inside a hub (e.g. alba-rosa.cz/hub).
 *   <script src="hub-bridge.js" data-hub="https://alba-rosa.cz" data-logout="logout.php" defer></script>
 * Optional: data-login-required on the tag (sign-in page after a failed silent sign-in) tells the hub to sign the person in;
 * data-title="…" overrides the title sent to the hub. API: window.VerxeeHub.post(type, data), .setBadge(n), .setTitle(t).
 * Messages are { vx: 1, type, … } with an explicit target origin; incoming ones are checked against data-hub.
 */
(function () {
  'use strict';
  var tag = document.currentScript;
  if (!tag || window.parent === window) return;
  var allowed = (tag.getAttribute('data-hub') || '').split(/[\s,]+/).filter(Boolean).map(function (u) { try { return new URL(u).origin; } catch (e) { return ''; } });
  var anc = location.ancestorOrigins && location.ancestorOrigins.length ? location.ancestorOrigins[0] : '';
  var target = allowed.indexOf(anc) > -1 ? anc : (allowed.length === 1 ? allowed[0] : '');
  if (!target) return;
  function post(type, data) { var m = { vx: 1, type: type }; for (var k in (data || {})) m[k] = data[k]; try { window.parent.postMessage(m, target); } catch (e) {} }
  window.addEventListener('message', function (e) {
    if (e.source !== window.parent || e.origin !== target || !e.data || e.data.vx !== 1) return;
    if (e.data.type === 'logout' && tag.getAttribute('data-logout')) location.href = tag.getAttribute('data-logout');
    if (e.data.type === 'navigate' && typeof e.data.url === 'string') { var u = new URL(e.data.url, location.href); if (u.origin === location.origin) location.href = u.href; }
    if (e.data.type === 'theme' || e.data.type === 'hello') document.documentElement.setAttribute('data-hub-theme', e.data.theme === 'dark' ? 'dark' : 'light');
  });
  document.documentElement.classList.add('vx-embedded');
  post('ready', { title: tag.getAttribute('data-title') || document.title, url: location.origin + location.pathname + location.hash });
  if (tag.hasAttribute('data-login-required')) post('login-required', {});
  window.VerxeeHub = { post: post, setBadge: function (n) { post('badge', { count: +n || 0 }); }, setTitle: function (t) { post('title', { title: String(t) }); } };
})();
