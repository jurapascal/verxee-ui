// Reference backend for the Verxee UI auth screen — zero dependencies, Node 18+.  `node examples/server.mjs`
// It exists to show WHAT THE SERVER MUST DO. Port the ideas to your stack (PHP, Laravel, Express, …); don't ship the demo user.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || 8080, SECURE = process.env.COOKIE_SECURE === '1'; // set COOKIE_SECURE=1 behind HTTPS
const hash = (pw, salt) => scryptSync(pw, salt, 64);
const salt = randomBytes(16);
const USER = { email: 'admin@example.com', name: 'Jane Admin', permissions: ['orders.view', 'orders.edit'], hash: hash('correct horse battery', salt) };

const sessions = new Map();          // sid-hash → { user, created, last }
const fails = new Map();             // ip → { n, until }
const IDLE = 15 * 60e3, ABSOLUTE = 8 * 3600e3;
const sidHash = (sid) => createHash('sha256').update(sid).digest('hex'); // never keep raw session ids server-side

const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map((c) => { const i = c.indexOf('='); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
const flags = `Path=/; SameSite=Strict${SECURE ? '; Secure' : ''}`;
const send = (res, code, body, extra = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra }); res.end(JSON.stringify(body)); };
const readJson = (req) => new Promise((ok) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 10_000) req.destroy(); }); req.on('end', () => { try { ok(JSON.parse(b || '{}')); } catch { ok({}); } }); });
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

function session(req) {
  const sid = cookies(req).vx_sid; if (!sid) return null;
  const s = sessions.get(sidHash(sid)); if (!s) return null;
  if (Date.now() - s.last > IDLE || Date.now() - s.created > ABSOLUTE) { sessions.delete(sidHash(sid)); return null; }
  s.last = Date.now(); return s;
}
const pub = (u) => ({ email: u.email, name: u.name, permissions: u.permissions });

const SEC = { // security headers for every response
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
};
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.json': 'application/json' };

createServer(async (req, res) => {
  for (const [k, v] of Object.entries(SEC)) res.setHeader(k, v);
  const url = new URL(req.url, 'http://x'), ip = req.socket.remoteAddress;
  if (url.pathname.startsWith('/api/')) {
    const c = cookies(req); let csrf = c['XSRF-TOKEN']; const extra = [];
    if (!csrf) { csrf = randomBytes(24).toString('hex'); extra.push(`XSRF-TOKEN=${csrf}; ${flags}`); } // readable by JS on purpose (double-submit)
    const h = extra.length ? { 'Set-Cookie': extra } : {};
    if (url.pathname === '/api/me' && req.method === 'GET') { const s = session(req); return s ? send(res, 200, pub(s.user), h) : send(res, 401, { message: 'unauthenticated' }, h); }
    if (req.method !== 'POST') return send(res, 405, {});
    if (!same(req.headers['x-csrf-token'] || '', csrf) || !c['XSRF-TOKEN']) return send(res, 403, { message: 'Bad CSRF token.' }, h);
    if (url.pathname === '/api/login') {
      const f = fails.get(ip) || { n: 0, until: 0 };
      if (f.until > Date.now()) return send(res, 429, { message: 'Too many attempts. Try again later.' }, h);
      const { identifier = '', password = '' } = await readJson(req);
      const ok = same(identifier.toLowerCase(), USER.email) & timingSafeEqual(hash(String(password), salt), USER.hash); // always hash — no timing oracle
      if (!ok) { f.n++; if (f.n >= 5) { f.until = Date.now() + 15 * 60e3; f.n = 0; } fails.set(ip, f); return send(res, 401, { message: 'Sign-in failed. Check your details and try again.' }, h); } // same message for every failure
      fails.delete(ip);
      const sid = randomBytes(32).toString('hex'); sessions.set(sidHash(sid), { user: USER, created: Date.now(), last: Date.now() }); // new id on login (no fixation)
      return send(res, 200, pub(USER), { 'Set-Cookie': [`vx_sid=${sid}; HttpOnly; ${flags}`, ...extra.map((x) => x)] });
    }
    if (url.pathname === '/api/logout') {
      const sid = cookies(req).vx_sid; if (sid) sessions.delete(sidHash(sid));
      return send(res, 200, {}, { 'Set-Cookie': [`vx_sid=; Max-Age=0; HttpOnly; ${flags}`] });
    }
    if (url.pathname === '/api/forgot') { await readJson(req); return send(res, 200, {}, h); } // identical reply whether or not the account exists
    return send(res, 404, {});
  }
  // static files (path traversal safe)
  const p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ''), file = join(root, p.endsWith('/') ? p + 'index.html' : p);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  try { const d = await readFile(file); res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(d); } catch { res.writeHead(404); res.end('Not found'); }
}).listen(PORT, () => console.log(`Verxee UI example on http://localhost:${PORT}/examples/auth.html  (admin@example.com / correct horse battery)`));
