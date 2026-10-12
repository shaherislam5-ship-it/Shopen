const crypto = require('crypto');
const U = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL, T = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN, H = { Authorization: 'Bearer ' + T };
const PASS = process.env.ADMIN_PASSWORD || 'admin123', SECRET = process.env.JWT_SECRET || PASS + '-shopen';
const mem = (global.__m = global.__m || {});
const rget = async k => (U ? (await fetch(U + '/get/' + k, { headers: H }).then(r => r.json())).result : mem[k]);
const rset = async (k, v) => { if (U) await fetch(U, { method: 'POST', headers: H, body: JSON.stringify(['SET', k, v]) }); else mem[k] = v; };
const P = (id, name, category, brand, price, oldPrice, stock, badge, featured, description, specs) => ({ id, name, category, brand, price, oldPrice, stock, badge, featured, active: true, description, specs, images: [], video: '' });
const seed = () => ({
  settings: { storeName: 'SHOPEN', tagline: 'Smart shopping, premium feel.', heroTitle: 'Premium finds, delivered to your door.', heroText: 'Electronics, fashion and home essentials chosen for quality, with cash on delivery across Bangladesh.', currency: '৳', shipping: 80, freeShippingOver: 3000, phone: '+880 1700-000000', whatsapp: '8801700000000', email: 'hello@shopen.com', address: 'Comilla, Bangladesh', facebook: '', bkash: '01700-000000', nagad: '01700-000000', notice: 'Free delivery on orders over ৳3000' },
  products: [
    P('p1', 'Wireless Earbuds Pro', 'Electronics', 'Shopen Tech', 2490, 3290, 25, 'Best seller', true, 'Noise-cancelling earbuds with deep bass, clear calls and a charging case that lasts all week.', 'Battery: 30 hours\nBluetooth: 5.3\nWater resistance: IPX5\nWarranty: 6 months'),
    P('p2', 'Smart Watch Series X', 'Electronics', 'Shopen Tech', 4990, 5990, 12, 'New', true, 'AMOLED display with heart-rate, sleep and step tracking. Works with Android and iOS.', 'Display: 1.8" AMOLED\nBattery: 7 days\nWater resistance: IP68\nWarranty: 1 year'),
    P('p3', 'Leather Everyday Wallet', 'Fashion', 'Shopen Life', 1290, 0, 40, '', false, 'Slim genuine leather wallet with RFID protection and six card slots.', 'Material: Genuine leather\nCard slots: 6\nColor: Brown'),
    P('p4', 'Minimal Backpack', 'Fashion', 'Shopen Life', 2190, 2690, 18, 'Sale', true, 'Water-resistant 20L backpack with padded laptop sleeve and hidden zip pocket.', 'Capacity: 20L\nLaptop fit: up to 15.6"\nMaterial: Nylon'),
    P('p5', 'Aroma Desk Lamp', 'Home', 'Shopen Home', 1790, 0, 15, '', false, 'Warm-light touch lamp with three brightness levels and a USB charging port.', 'Power: 12W\nModes: 3\nPort: USB-A'),
    P('p6', 'Steel Water Bottle', 'Home', 'Shopen Home', 690, 890, 60, '', false, 'Double-wall vacuum bottle that keeps drinks cold for 24 hours and hot for 12.', 'Capacity: 750ml\nMaterial: 304 steel')
  ],
  orders: [], coupons: [{ code: 'WELCOME10', type: 'percent', value: 10, min: 1000, active: true }]
});
async function load() { const r = await rget('shopen'); const d = r ? JSON.parse(r) : seed(); d.settings = { ...seed().settings, ...d.settings }; d.coupons = d.coupons || []; return d; }
const save = d => rset('shopen', JSON.stringify(d));
const sign = s => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
const makeToken = () => { const e = String(Date.now() + 864e5); return e + '.' + sign(e); };
const okToken = t => { if (!t) return false; const [e, s] = t.split('.'); return s === sign(e) && Date.now() < +e; };
const str = (v, n = 300) => String(v ?? '').slice(0, n);
const disc = (d, code, sub) => { const c = d.coupons.find(c => c.active && c.code === String(code || '').toUpperCase()); if (!c || sub < c.min) return null; return { c, amount: Math.min(sub, c.type === 'percent' ? Math.round(sub * c.value / 100) : c.value) }; };

module.exports = async (req, res) => {
  const send = (c, o) => res.status(c).json(o);
  try {
    const url = new URL(req.url, 'http://x'), path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, ''), m = req.method, b = req.body || {};
    if (path === 'login' && m === 'POST') return b.password === PASS ? send(200, { token: makeToken() }) : send(401, { error: 'Wrong password' });
    if (path.startsWith('img/')) { const d = await rget('img:' + path.slice(4).replace(/\W/g, '')); const x = d && /^data:(image\/\w+);base64,(.*)$/.exec(d); if (!x) return res.status(404).end(); res.setHeader('Content-Type', x[1]); res.setHeader('Cache-Control', 'public,max-age=31536000,immutable'); return res.status(200).send(Buffer.from(x[2], 'base64')); }
    const db = await load();
    if (path === 'store' && m === 'GET') { const s = { ...db.settings }; return send(200, { settings: s, products: db.products.filter(p => p.active) }); }
    if (path === 'coupon' && m === 'POST') { const r = disc(db, b.code, +b.subtotal || 0); return r ? send(200, { coupon: r.c }) : send(400, { error: 'Coupon is invalid or the order is below the minimum.' }); }
    if (path === 'track' && m === 'GET') {
      const o = db.orders.find(o => o.id === url.searchParams.get('id')?.trim().toUpperCase());
      const ph = x => String(x).replace(/\D/g, '').slice(-6);
      return o && ph(o.phone) === ph(url.searchParams.get('phone') || 'x') ? send(200, { order: { id: o.id, date: o.date, status: o.status, total: o.total, items: o.items } }) : send(404, { error: 'No order found for that ID and phone number.' });
    }
    if (path === 'orders' && m === 'POST') {
      if (!b.name || !b.phone || !b.address || !Array.isArray(b.items) || !b.items.length) return send(400, { error: 'Please fill in name, phone, address and add items.' });
      const pay = ['COD', 'bKash', 'Nagad'].includes(b.payment) ? b.payment : 'COD';
      if (pay !== 'COD' && !b.trx) return send(400, { error: 'Enter the transaction ID of your ' + pay + ' payment.' });
      const items = [];
      for (const i of b.items) {
        const p = db.products.find(x => x.id === i.id && x.active), q = Math.max(1, parseInt(i.qty) || 1);
        if (!p) return send(400, { error: 'An item is no longer available.' });
        if (p.stock < q) return send(400, { error: `Only ${p.stock} left of ${p.name}.` });
        items.push({ id: p.id, name: p.name, price: p.price, qty: q });
      }
      items.forEach(i => (db.products.find(p => p.id === i.id).stock -= i.qty));
      const sub = items.reduce((s, i) => s + i.price * i.qty, 0), s = db.settings, dc = disc(db, b.coupon, sub);
      const shipping = sub >= s.freeShippingOver ? 0 : +s.shipping, discount = dc ? dc.amount : 0;
      const order = { id: 'SHP-' + Date.now().toString(36).toUpperCase(), date: new Date().toISOString(), name: str(b.name, 80), phone: str(b.phone, 30), address: str(b.address, 250), note: str(b.note, 250), payment: pay, trx: str(b.trx, 40), coupon: dc ? dc.c.code : '', items, subtotal: sub, discount, shipping, total: sub - discount + shipping, status: 'Pending' };
      db.orders.unshift(order); await save(db);
      return send(200, { order });
    }
    if (!path.startsWith('admin/')) return send(404, { error: 'Not found' });
    if (!okToken((req.headers.authorization || '').replace('Bearer ', ''))) return send(401, { error: 'Unauthorized' });
    const [, a, id] = path.split('/');
    if (a === 'data' && m === 'GET') return send(200, db);
    if (a === 'upload' && m === 'POST') {
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(b.data || '') || b.data.length > 900000) return send(400, { error: 'Image is invalid or too large.' });
      const k = crypto.randomBytes(6).toString('hex'); await rset('img:' + k, b.data); return send(200, { url: '/api/img/' + k });
    }
    if (a === 'products' && m === 'POST') {
      const p = { id: b.id || 'p' + Date.now().toString(36), name: str(b.name, 120), category: str(b.category, 40) || 'General', brand: str(b.brand, 40), price: +b.price || 0, oldPrice: +b.oldPrice || 0, stock: parseInt(b.stock) || 0, badge: str(b.badge, 20), featured: !!b.featured, active: b.active !== false, description: str(b.description, 3000), specs: str(b.specs, 1500), images: (Array.isArray(b.images) ? b.images : []).slice(0, 8).map(u => str(u, 600)), video: str(b.video, 300) };
      if (!p.name) return send(400, { error: 'Product name required' });
      const i = db.products.findIndex(x => x.id === p.id); i >= 0 ? (db.products[i] = p) : db.products.unshift(p);
    } else if (a === 'products' && m === 'DELETE') db.products = db.products.filter(p => p.id !== id);
    else if (a === 'orders' && m === 'PATCH') { const o = db.orders.find(o => o.id === id); if (o) o.status = str(b.status, 20); }
    else if (a === 'orders' && m === 'DELETE') db.orders = db.orders.filter(o => o.id !== id);
    else if (a === 'coupons' && m === 'POST') { const c = { code: str(b.code, 20).toUpperCase().replace(/\s/g, ''), type: b.type === 'flat' ? 'flat' : 'percent', value: +b.value || 0, min: +b.min || 0, active: true }; if (!c.code || !c.value) return send(400, { error: 'Code and value required' }); db.coupons = [c, ...db.coupons.filter(x => x.code !== c.code)]; }
    else if (a === 'coupons' && m === 'DELETE') db.coupons = db.coupons.filter(c => c.code !== id);
    else if (a === 'settings' && m === 'PUT') { const s = db.settings; for (const k of Object.keys(s)) if (b[k] !== undefined) s[k] = typeof s[k] === 'number' ? +b[k] || 0 : str(b[k], 250); }
    else return send(404, { error: 'Not found' });
    await save(db); send(200, db);
  } catch (e) { send(500, { error: 'Server error: ' + e.message }); }
};
