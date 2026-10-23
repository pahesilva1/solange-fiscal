const { save } = require('./_store');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'método' });
  const d = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  if (d.website) return res.json({ ok: true }); // honeypot
  const email = String(d.email || '').trim().toLowerCase().slice(0, 200), phone = String(d.phone || '').replace(/\D/g, '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Confere seu e-mail.' });
  if (!/^\d{10,11}$/.test(phone)) return res.status(400).json({ error: 'Confere seu WhatsApp com DDD.' });
  try { await save({ email, phone, created_at: new Date().toISOString() }); res.json({ ok: true }); }
  catch (e) { console.error(e); res.status(500).json({ error: 'Deu ruim aqui. Tenta de novo?' }); }
};
