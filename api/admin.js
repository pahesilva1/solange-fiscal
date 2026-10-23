const crypto = require('crypto'); const { all } = require('./_store');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
module.exports = async (req, res) => {
  const K = process.env.ADMIN_KEY || '', k = String(req.query.key || '');
  if (!K || k.length !== K.length || !crypto.timingSafeEqual(Buffer.from(k), Buffer.from(K))) return res.status(401).send('não autorizado');
  const rows = await all();
  res.setHeader('Cache-Control', 'no-store');
  if (req.query.csv) {
    const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return res.send(['email,whatsapp,criado_em', ...rows.map(r => [r.email, r.phone, r.created_at].map(q).join(','))].join('\n'));
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width"><title>Cadastros</title><style>body{font:14px system-ui;padding:16px}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left}</style><h1>${rows.length} pré-cadastros</h1><p><a href="/admin.csv?key=${encodeURIComponent(k)}">Baixar CSV</a></p><table><tr><th>E-mail<th>WhatsApp<th>Quando</tr>${rows.map(r => `<tr><td>${esc(r.email)}<td>${esc(r.phone)}<td>${new Date(r.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</tr>`).join('')}</table>`);
};
