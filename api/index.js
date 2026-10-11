const crypto = require('crypto');
const U = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const T = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const PASS = process.env.ADMIN_PASSWORD || 'admin123';
const SECRET = process.env.JWT_SECRET || PASS + '-shopen';
const P = (id, name, category, price, stock, description) => ({ id, name, category, price, stock, description, image: '', active: true });
const seed = () => ({
  settings: { storeName: 'SHOPEN', tagline: 'Smart shopping, premium feel.', currency: '৳', shipping: 80, freeShippingOver: 3000, phone: '+880 1700-000000', email: 'hello@shopen.com', address: 'Comilla, Bangladesh', notice: 'Free delivery on orders over ৳3000' },
  products: [
    P('p1', 'Wireless Earbuds Pro', 'Electronics', 2490, 25, 'Noise-cancelling earbuds with 30-hour battery life.'),
    P('p2', 'Smart Watch Series X', 'Electronics', 4990, 12, 'Heart-rate, sleep tracking and 7-day battery.'),
    P('p3', 'Leather Everyday Wallet', 'Fashion', 1290, 40, 'Slim genuine leather wallet with RFID protection.'),
    P('p4', 'Minimal Backpack', 'Fashion', 2190, 18, 'Water-resistant 20L backpack with laptop sleeve.'),
    P('p5', 'Aroma Desk Lamp', 'Home', 1790, 15, 'Warm-light touch lamp with USB charging port.'),
    P('p6', 'Steel Water Bottle', 'Home', 690, 60, 'Keeps drinks cold for 24 hours, hot for 12.')
  ],
  orders: []
});
async function load() {
  if (U) { const r = await fetch(U + '/get/shopen', { headers: { Authorization: 'Bearer ' + T } }).then(r => r.json()); if (r.result) return JSON.parse(r.result); }
  else if (global.__db) return global.__db;
  return seed();
}
async function save(d) {
  if (U) await fetch(U, { method: 'POST', headers: { Authorization: 'Bearer ' + T }, body: JSON.stringify(['SET', 'shopen', JSON.stringify(d)]) });
  else global.__db = d;
}
const sign = s => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
const makeToken = () => { const e = String(Date.now() + 864e5); return e + '.' + sign(e); };
const okToken = t => { if (!t) return false; const [e, s] = t.split('.'); return s === sign(e) && Date.now() < +e; };
const str = (v, n = 300) => String(v ?? '').slice(0, n);

module.exports = async (req, res) => {
  const send = (c, o) => res.status(c).json(o);
  try {
    const path = req.url.split('?')[0].replace(/^\/api\/?/, '').replace(/\/$/, '');
    const m = req.method, b = req.body || {};
    if (path === 'login' && m === 'POST') return b.password === PASS ? send(200, { token: makeToken() }) : send(401, { error: 'Wrong password' });
    const db = await load();
    if (path === 'store' && m === 'GET') return send(200, { settings: db.settings, products: db.products.filter(p => p.active) });
    if (path === 'orders' && m === 'POST') {
      if (!b.name || !b.phone || !b.address || !Array.isArray(b.items) || !b.items.length) return send(400, { error: 'Please fill in name, phone, address and add items.' });
      const items = [];
      for (const i of b.items) {
        const p = db.products.find(x => x.id === i.id && x.active), q = Math.max(1, parseInt(i.qty) || 1);
        if (!p) return send(400, { error: 'An item is no longer available.' });
        if (p.stock < q) return send(400, { error: `Only ${p.stock} left of ${p.name}.` });
        items.push({ id: p.id, name: p.name, price: p.price, qty: q });
      }
      items.forEach(i => (db.products.find(p => p.id === i.id).stock -= i.qty));
      const sub = items.reduce((s, i) => s + i.price * i.qty, 0), s = db.settings;
      const shipping = sub >= s.freeShippingOver ? 0 : +s.shipping;
      const order = { id: 'SHP-' + Date.now().toString(36).toUpperCase(), date: new Date().toISOString(), name: str(b.name, 80), phone: str(b.phone, 30), address: str(b.address, 250), note: str(b.note, 250), payment: 'Cash on delivery', items, subtotal: sub, shipping, total: sub + shipping, status: 'Pending' };
      db.orders.unshift(order); await save(db);
      return send(200, { order });
    }
    if (!path.startsWith('admin/')) return send(404, { error: 'Not found' });
    if (!okToken((req.headers.authorization || '').replace('Bearer ', ''))) return send(401, { error: 'Unauthorized' });
    const [, a, id] = path.split('/');
    if (a === 'data' && m === 'GET') return send(200, db);
    if (a === 'products' && m === 'POST') {
      const p = { id: b.id || 'p' + Date.now().toString(36), name: str(b.name, 120), category: str(b.category, 40) || 'General', price: +b.price || 0, stock: parseInt(b.stock) || 0, description: str(b.description, 600), image: String(b.image || '').slice(0, 400000), active: b.active !== false };
      if (!p.name) return send(400, { error: 'Product name required' });
      const i = db.products.findIndex(x => x.id === p.id); i >= 0 ? (db.products[i] = p) : db.products.unshift(p);
    } else if (a === 'products' && m === 'DELETE') db.products = db.products.filter(p => p.id !== id);
    else if (a === 'orders' && m === 'PATCH') { const o = db.orders.find(o => o.id === id); if (o) o.status = str(b.status, 20); }
    else if (a === 'orders' && m === 'DELETE') db.orders = db.orders.filter(o => o.id !== id);
    else if (a === 'settings' && m === 'PUT') { const s = db.settings; for (const k of Object.keys(s)) if (b[k] !== undefined) s[k] = typeof s[k] === 'number' ? +b[k] || 0 : str(b[k], 200); }
    else return send(404, { error: 'Not found' });
    await save(db); send(200, db);
  } catch (e) { send(500, { error: 'Server error: ' + e.message }); }
};
