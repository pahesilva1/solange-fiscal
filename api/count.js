const { list } = require('@vercel/blob');
module.exports = async (req, res) => {
  let n = 0, cursor; try { do { const r = await list({ prefix: 'signups/', cursor }); n += r.blobs.length; cursor = r.cursor; } while (cursor); } catch {}
  res.setHeader('Cache-Control', 's-maxage=60'); res.json({ count: n });
};
