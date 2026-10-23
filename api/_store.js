const { put, list, del } = require('@vercel/blob');
const crypto = require('crypto');
const key = email => 'signups/' + crypto.createHash('sha256').update(email).digest('hex').slice(0, 32) + '.json';
async function all() {
  const out = []; let cursor;
  do {
    const r = await list({ prefix: 'signups/', cursor }); cursor = r.cursor;
    for (const b of r.blobs) {
      const res = await fetch(b.downloadUrl || b.url, { headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` } });
      if (res.ok) out.push(await res.json());
    }
  } while (cursor);
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
}
const save = s => put(key(s.email), JSON.stringify(s), { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
module.exports = { all, save, key, del };
