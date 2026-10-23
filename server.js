const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { Pool } = require('pg');
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes('render.com') ? { rejectUnauthorized: false } : false }) : null;
const ADMIN_KEY = process.env.ADMIN_KEY || '';
// Sem DATABASE_URL: guarda em arquivo local (efêmero no Render free) só até o banco ser conectado.
const FILE = path.join(__dirname, 'signups.json');
const mem = new Map((fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE)) : []).map(r => [r.email, { ...r, created_at: new Date(r.created_at) }]));
const PUB = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

async function init() {
  if (!pool) return console.warn('DATABASE_URL ausente: cadastros não serão salvos');
  await pool.query(`CREATE TABLE IF NOT EXISTS signups (
    id serial PRIMARY KEY, name text, email text UNIQUE NOT NULL, uf text, politicians text,
    created_at timestamptz DEFAULT now())`);
  await pool.query('ALTER TABLE signups ALTER COLUMN name DROP NOT NULL');
}

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const okKey = k => ADMIN_KEY && k && k.length === ADMIN_KEY.length && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(ADMIN_KEY));

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'POST' && url.pathname === '/api/signup') {
      let raw = ''; for await (const c of req) { raw += c; if (raw.length > 5000) return send(res, 413, { error: 'grande demais' }); }
      const d = JSON.parse(raw || '{}');
      const name = String(d.name || '').trim().slice(0, 120), email = String(d.email || '').trim().toLowerCase().slice(0, 200);
      if (d.website) return send(res, 200, { ok: true }); // honeypot
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { error: 'Confere seu e-mail.' });
      if (!pool) { mem.set(email, { id: mem.size + 1, name, email, uf: d.uf || null, politicians: d.politicians || null, created_at: new Date() }); fs.writeFileSync(FILE, JSON.stringify([...mem.values()])); return send(res, 200, { ok: true }); }
      await pool.query(`INSERT INTO signups (name,email,uf,politicians) VALUES ($1,$2,$3,$4)
        ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, uf=EXCLUDED.uf, politicians=EXCLUDED.politicians`,
        [name || null, email, String(d.uf || '').slice(0, 2) || null, String(d.politicians || '').trim().slice(0, 500) || null]);
      return send(res, 200, { ok: true });
    }
    if (url.pathname === '/api/count') {
      const r = pool ? await pool.query('SELECT count(*)::int n FROM signups') : { rows: [{ n: mem.size }] };
      return send(res, 200, { count: r.rows[0].n });
    }
    if (url.pathname === '/admin' || url.pathname === '/admin.csv') {
      if (!okKey(url.searchParams.get('key'))) return send(res, 401, 'não autorizado', 'text/plain');
      const { rows } = pool ? await pool.query('SELECT * FROM signups ORDER BY created_at DESC') : { rows: [...mem.values()].reverse() };
      if (url.pathname === '/admin.csv') {
        const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
        return send(res, 200, ['id,nome,email,uf,politicos,criado_em', ...rows.map(r => [r.id, r.name, r.email, r.uf, r.politicians, r.created_at.toISOString()].map(q).join(','))].join('\n'), 'text/csv; charset=utf-8');
      }
      return send(res, 200, `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width"><title>Cadastros</title><style>body{font:14px system-ui;padding:16px}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left}</style><h1>${rows.length} pré-cadastros</h1><p><a href="/admin.csv?key=${encodeURIComponent(url.searchParams.get('key'))}">Baixar CSV</a></p><table><tr><th>Nome<th>E-mail<th>UF<th>Políticos<th>Quando</tr>${rows.map(r => `<tr><td>${esc(r.name)}<td>${esc(r.email)}<td>${esc(r.uf)}<td>${esc(r.politicians)}<td>${r.created_at.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</tr>`).join('')}</table>`, 'text/html; charset=utf-8');
    }
    if (url.pathname === '/healthz') return send(res, 200, 'ok', 'text/plain');
    let p = path.normalize(path.join(PUB, url.pathname === '/' ? 'index.html' : url.pathname));
    if (!p.startsWith(PUB) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(PUB, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'public, max-age=300' });
    fs.createReadStream(p).pipe(res);
  } catch (e) { console.error(e); send(res, 500, { error: 'Deu ruim aqui. Tenta de novo?' }); }
}).listen(process.env.PORT || 3000, () => init().catch(console.error));
