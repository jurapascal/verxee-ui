// Verxee UI build — zero dependencies. `node scripts/build.mjs`
// 1) css/verxee-ui.css  = fonts + tokens + components + layout (bundle, kept for CDN URLs)
// 2) dist/              = bundle + minified css, runtime js + minified js
// 3) docs/              = documentation site built from docs-src/ (pages wrapped in docs-src/_layout.html)
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const r = (p) => readFileSync(join(root, p), 'utf8');
const w = (p, s) => { mkdirSync(dirname(join(root, p)), { recursive: true }); writeFileSync(join(root, p), s); };
const pkg = JSON.parse(r('package.json'));
const banner = `/*! Verxee UI v${pkg.version} | MIT | github.com/jurapascal/verxee-ui */\n`;

// ── CSS ──
const bundle = ['fonts', 'tokens', 'components', 'layout'].map((n) => r(`css/${n}.css`).trim()).join('\n\n') + '\n';
const minCss = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s*([{};,>])\s*/g, '$1')
  .replace(/:\s+/g, ':')
  .replace(/;}/g, '}')
  .trim();
w('css/verxee-ui.css', bundle);
w('dist/verxee-ui.css', banner + bundle);
w('dist/verxee-ui.min.css', banner + minCss(bundle) + '\n');

// ── JS ── (conservative minify: strip comments/indent only, keeps it safe without a parser)
const js = r('js/verxee-ui.js');
const minJs = js.replace(/^\s*\/\/.*$/gm, '').replace(/\n\s*\n/g, '\n').replace(/^[ \t]+/gm, '');
w('dist/verxee-ui.js', js);
w('dist/verxee-ui.min.js', banner + minJs);

// Subresource Integrity hashes for the CDN snippets in the docs
const sri = (f) => 'sha384-' + createHash('sha384').update(readFileSync(join(root, f))).digest('base64');
const SRI = { css: sri('dist/verxee-ui.min.css'), js: sri('dist/verxee-ui.min.js') };
w('dist/sri.json', JSON.stringify(SRI, null, 2) + '\n');

console.log('css + dist built, v' + pkg.version);

// ── Docs ──
// Page syntax: first line `<!-- title: ... | group: ... | order: n -->`.
// `<!--example-->…<!--/example-->` renders the live markup and appends an escaped code block.
{
  const layout = r('docs-src/_layout.html');
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const dedent = (s) => {
    const lines = s.replace(/^\n+|\s+$/g, '').split('\n');
    const pad = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
    return lines.map((l) => l.slice(pad)).join('\n');
  };
  const pages = readdirSync(join(root, 'docs-src')).filter((f) => f.endsWith('.html') && !f.startsWith('_')).map((f) => {
    const src = r('docs-src/' + f);
    const meta = Object.fromEntries((src.match(/^<!--(.*?)-->/)?.[1] || '').split('|').map((x) => x.split(/:(.*)/s).map((y) => y.trim())).filter((x) => x[0]));
    return { file: f, src: src.replace(/^<!--.*?-->\s*/, ''), title: meta.title || f, group: meta.group || 'Other', order: +meta.order || 99 };
  }).sort((a, b) => a.order - b.order);
  w('docs/docs.css', r('docs-src/docs.css'));
  const groups = [...new Set(pages.map((p) => p.group))];
  for (const p of pages) {
    const body = p.src.replace(/<!--example(?:\s+([^>]*?))?-->([\s\S]*?)<!--\/example-->/g, (_, opt, code) => {
      const c = dedent(code);
      const cls = 'example-preview' + (opt && opt.includes('stack') ? ' example-stack' : '');
      return `<div class="example"><div class="${cls}">${c}</div><pre class="example-code"><code>${esc(c)}</code></pre></div>`;
    });
    const nav = groups.map((g) => `<li class="nav-title">${g}</li>` + pages.filter((x) => x.group === g).map((x) =>
      `<li class="nav-item"><a class="nav-link${x === p ? ' active' : ''}" href="${x.file}">${x.title}</a></li>`).join('')).join('');
    w('docs/' + p.file, layout.replace('{{title}}', p.title).replace('{{nav}}', nav).replace('{{body}}', body).replace(/\{\{version\}\}/g, pkg.version).replace(/\{\{sri_css\}\}/g, SRI.css).replace(/\{\{sri_js\}\}/g, SRI.js));
  }
  console.log('docs built: ' + pages.length + ' pages');
}
