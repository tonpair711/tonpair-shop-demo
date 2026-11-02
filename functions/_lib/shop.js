// 前台 API：商品、會員、收藏、下單、訂單查詢、詢問
import {
  HttpError, json, now, randHex, hashPassword, safeEqual, validPassword, validEmail, validPhone, validTaxid,
  text, readBody, clientIp, rateLimit, createSession, clearCookie, sessionSubject, destroySession, settings
} from './util.js';

const PAYS = ['公文採購（請款單）', 'ATM 轉帳'];

const pub = p => ({
  id: p.id, name: p.name, cat: p.cat, price: p.price, oldPrice: p.old_price || null, img: p.img,
  tag: p.tag, desc: p.description, spec: p.spec, stock: p.stock, soldOut: p.stock !== null && p.stock <= 0
});
const publicUser = u => ({ id: u.id, email: u.email, name: u.name, org: u.org, phone: u.phone, addr: u.addr, taxid: u.taxid, created: u.created });
const orderOut = o => ({
  no: o.no, status: o.status, pay: o.pay, sub: o.sub, disc: o.disc, ship: o.ship, total: o.total, coupon: o.coupon,
  items: JSON.parse(o.items), info: JSON.parse(o.info), note: o.note, created: o.created
});

async function currentUser(env, request) {
  const id = await sessionSubject(env, request, 'user');
  return id ? await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first() : null;
}
async function requireUser(env, request) {
  const u = await currentUser(env, request);
  if (!u) throw new HttpError(401, '請先登入');
  return u;
}

/* ---------- 優惠碼與金額（下單與試算共用，一律以伺服端價格為準） ---------- */
async function applyCoupon(env, code, subtotal) {
  if (!code) return { disc: 0, coupon: null };
  const c = await env.DB.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').bind(String(code).toUpperCase()).first();
  if (!c) throw new HttpError(400, '這組優惠碼無效或已停用');
  if (subtotal < c.min_amount) throw new HttpError(400, `這組優惠碼需消費滿 NT$${c.min_amount.toLocaleString('en-US')}`);
  const disc = c.type === 'percent' ? Math.round(subtotal * c.value / 100) : Math.min(c.value, subtotal);
  return { disc, coupon: c };
}

function shippingFee(cfg, afterDiscount, count) {
  return count === 0 ? 0 : (afterDiscount >= cfg.freeShipping ? 0 : cfg.shippingFee);
}

async function loadItems(env, raw) {
  if (!Array.isArray(raw) || !raw.length || raw.length > 30) throw new HttpError(400, '購物車是空的');
  const qtyById = new Map();
  for (const it of raw) {
    const q = Number(it.qty);
    if (!it || typeof it.id !== 'string' || !Number.isInteger(q) || q < 1 || q > 999) throw new HttpError(400, '商品數量不正確');
    qtyById.set(it.id, (qtyById.get(it.id) || 0) + q);
  }
  const items = [];
  for (const [id, qty] of qtyById) {
    const p = await env.DB.prepare('SELECT * FROM products WHERE id = ? AND active = 1').bind(id).first();
    if (!p) throw new HttpError(400, '部分商品已下架，請重新整理頁面');
    if (p.stock !== null && p.stock < qty) throw new HttpError(409, `「${p.name}」庫存不足（剩 ${Math.max(0, p.stock)}）`);
    items.push({ id: p.id, name: p.name, price: p.price, qty });
  }
  return items;
}

/* ---------- 路由 ---------- */
export async function handleShop(request, env, path) {
  const method = request.method;
  const ip = clientIp(request);

  if (path === 'shop' && method === 'GET') {
    const [cfg, { results }] = await Promise.all([
      settings(env), env.DB.prepare('SELECT * FROM products WHERE active = 1 ORDER BY sort, rowid').all()
    ]);
    const cats = [...new Set(results.map(p => p.cat))];
    return json({ settings: { name: cfg.name, freeShipping: cfg.freeShipping, shippingFee: cfg.shippingFee, notice: cfg.notice },
      categories: ['全部', ...cats], products: results.map(pub) });
  }

  if (path === 'coupon' && method === 'POST') {
    const b = await readBody(request);
    await rateLimit(env, 'coupon:' + ip, 60, 600);
    const items = await loadItems(env, b.items);
    const sub = items.reduce((s, i) => s + i.price * i.qty, 0);
    const { disc, coupon } = await applyCoupon(env, b.code, sub);
    return json({ code: coupon.code, label: coupon.label, type: coupon.type, value: coupon.value, minAmount: coupon.min_amount, disc });
  }

  /* 會員註冊與登入 */
  if (path === 'register' && method === 'POST') {
    const b = await readBody(request);
    await rateLimit(env, 'reg:' + ip, 10, 3600);
    const email = text(b.email, 120, 'Email').toLowerCase();
    if (!validEmail(email)) throw new HttpError(400, 'Email 格式不正確');
    const name = text(b.name, 40, '聯絡人'), org = text(b.org, 80, '單位名稱');
    const phone = text(b.phone, 20, '手機');
    if (!validPhone(phone)) throw new HttpError(400, '手機格式不正確');
    if (!validPassword(b.password)) throw new HttpError(400, '密碼至少 8 碼，且要有英文與數字');
    if (await env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first()) throw new HttpError(409, '這個 Email 已經註冊過，請直接登入');
    const salt = randHex(16);
    const r = await env.DB.prepare('INSERT INTO users (email, name, org, phone, salt, hash, created) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(email, name, org, phone, salt, await hashPassword(b.password, salt), now()).run();
    const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(r.meta.last_row_id).first();
    return json({ user: publicUser(u), favs: [] }, 201, { 'set-cookie': await createSession(env, 'user', u.id) });
  }

  if (path === 'login' && method === 'POST') {
    const b = await readBody(request);
    const email = text(b.email, 120, 'Email').toLowerCase();
    await rateLimit(env, `login:${ip}:${email}`, 8, 900);
    const u = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    const ok = u && safeEqual(await hashPassword(String(b.password || ''), u.salt), u.hash);
    if (!ok) throw new HttpError(401, 'Email 或密碼不正確');
    const favs = (await env.DB.prepare('SELECT product_id FROM favs WHERE user_id = ?').bind(u.id).all()).results.map(r => r.product_id);
    return json({ user: publicUser(u), favs }, 200, { 'set-cookie': await createSession(env, 'user', u.id) });
  }

  if (path === 'logout' && method === 'POST') {
    await destroySession(env, request, 'user');
    return json({ ok: true }, 200, { 'set-cookie': clearCookie('user') });
  }

  if (path === 'me' && method === 'GET') {
    const u = await currentUser(env, request);
    if (!u) return json({ user: null });
    const favs = (await env.DB.prepare('SELECT product_id FROM favs WHERE user_id = ?').bind(u.id).all()).results.map(r => r.product_id);
    return json({ user: publicUser(u), favs });
  }

  if (path === 'me' && method === 'PUT') {
    const u = await requireUser(env, request), b = await readBody(request);
    const phone = text(b.phone, 20, '手機', false), taxid = text(b.taxid, 8, '統一編號', false);
    if (phone && !validPhone(phone)) throw new HttpError(400, '手機格式不正確');
    if (!validTaxid(taxid)) throw new HttpError(400, '統一編號要 8 碼數字');
    await env.DB.prepare('UPDATE users SET name = ?, org = ?, phone = ?, addr = ?, taxid = ? WHERE id = ?')
      .bind(text(b.name, 40, '聯絡人'), text(b.org, 80, '單位名稱'), phone, text(b.addr, 200, '地址', false), taxid, u.id).run();
    return json({ user: publicUser(await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(u.id).first()) });
  }

  if (path === 'me/password' && method === 'POST') {
    const u = await requireUser(env, request), b = await readBody(request);
    await rateLimit(env, 'pw:' + u.id, 8, 900);
    if (!safeEqual(await hashPassword(String(b.old || ''), u.salt), u.hash)) throw new HttpError(400, '目前密碼不正確');
    if (!validPassword(b.password)) throw new HttpError(400, '新密碼至少 8 碼，且要有英文與數字');
    const salt = randHex(16);
    await env.DB.prepare('UPDATE users SET salt = ?, hash = ? WHERE id = ?').bind(salt, await hashPassword(b.password, salt), u.id).run();
    return json({ ok: true });
  }

  if (path === 'me/orders' && method === 'GET') {
    const u = await requireUser(env, request);
    const { results } = await env.DB.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created DESC LIMIT 100').bind(u.id).all();
    return json({ orders: results.map(orderOut) });
  }

  /* 收藏 */
  const fav = path.match(/^favs\/([\w-]{1,40})$/);
  if (fav && (method === 'PUT' || method === 'DELETE')) {
    const u = await requireUser(env, request);
    if (method === 'PUT') {
      if (!await env.DB.prepare('SELECT 1 FROM products WHERE id = ?').bind(fav[1]).first()) throw new HttpError(404, '找不到商品');
      await env.DB.prepare('INSERT OR IGNORE INTO favs (user_id, product_id) VALUES (?, ?)').bind(u.id, fav[1]).run();
    } else {
      await env.DB.prepare('DELETE FROM favs WHERE user_id = ? AND product_id = ?').bind(u.id, fav[1]).run();
    }
    return json({ ok: true });
  }

  /* 下單 */
  if (path === 'orders' && method === 'POST') {
    const b = await readBody(request);
    await rateLimit(env, 'order:' + ip, 20, 3600);
    const user = await currentUser(env, request);
    const i = b.info || {};
    const info = {
      org: text(i.org, 80, '單位名稱'), name: text(i.name, 40, '聯絡人'), phone: text(i.phone, 20, '手機'),
      email: text(i.email, 120, 'Email').toLowerCase(), addr: text(i.addr, 200, '送貨地址'), taxid: text(i.taxid, 8, '統一編號', false)
    };
    if (!validPhone(info.phone)) throw new HttpError(400, '手機格式不正確');
    if (!validEmail(info.email)) throw new HttpError(400, 'Email 格式不正確');
    if (!validTaxid(info.taxid)) throw new HttpError(400, '統一編號要 8 碼數字');
    if (!PAYS.includes(b.pay)) throw new HttpError(400, '請選擇付款方式');
    const note = text(b.note, 300, '備註', false);

    const cfg = await settings(env);
    const items = await loadItems(env, b.items);
    const sub = items.reduce((s, x) => s + x.price * x.qty, 0);
    const { disc, coupon } = await applyCoupon(env, b.coupon, sub);
    const ship = shippingFee(cfg, sub - disc, items.length);
    const total = sub - disc + ship;

    // 先扣庫存（條件式更新，庫存不足就整筆回復）
    const taken = [];
    try {
      for (const it of items) {
        const r = await env.DB.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock IS NOT NULL AND stock >= ?').bind(it.qty, it.id, it.qty).run();
        if (r.meta.changes) taken.push(it);
        else {
          const p = await env.DB.prepare('SELECT stock FROM products WHERE id = ?').bind(it.id).first();
          if (p && p.stock !== null) throw new HttpError(409, `「${it.name}」庫存不足，請調整數量`);
        }
      }
      const ymd = new Date(Date.now() + 8 * 3600e3).toISOString().slice(2, 10).replace(/-/g, '');
      let no = '';
      for (let n = 0; n < 5; n++) {
        no = `HL${ymd}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
        if (!await env.DB.prepare('SELECT 1 FROM orders WHERE no = ?').bind(no).first()) break;
      }
      const t = now();
      await env.DB.prepare('INSERT INTO orders (no, user_id, status, pay, sub, disc, ship, total, coupon, info, items, note, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(no, user ? user.id : null, '待確認', b.pay, sub, disc, ship, total, coupon ? coupon.code : '', JSON.stringify(info), JSON.stringify(items), note, t, t).run();
      if (coupon) await env.DB.prepare('UPDATE coupons SET used = used + 1 WHERE code = ?').bind(coupon.code).run();
      if (user) {
        const fill = { org: user.org || info.org, phone: user.phone || info.phone, addr: user.addr || info.addr, taxid: user.taxid || info.taxid };
        await env.DB.prepare('UPDATE users SET org = ?, phone = ?, addr = ?, taxid = ? WHERE id = ?').bind(fill.org, fill.phone, fill.addr, fill.taxid, user.id).run();
      }
      return json({ order: { no, status: '待確認', pay: b.pay, sub, disc, ship, total, coupon: coupon ? coupon.code : '', items, info, created: t }, bankInfo: b.pay === 'ATM 轉帳' ? cfg.bankInfo : '' }, 201);
    } catch (e) {
      for (const it of taken) await env.DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(it.qty, it.id).run();
      throw e;
    }
  }

  /* 訪客用訂單編號＋Email 查詢 */
  if (path === 'orders/lookup' && method === 'POST') {
    const b = await readBody(request);
    await rateLimit(env, 'lookup:' + ip, 15, 900);
    const o = await env.DB.prepare('SELECT * FROM orders WHERE no = ?').bind(text(b.no, 30, '訂單編號').toUpperCase()).first();
    if (!o || JSON.parse(o.info).email !== text(b.email, 120, 'Email').toLowerCase()) throw new HttpError(404, '找不到符合的訂單，請確認訂單編號與下單時的 Email');
    return json({ order: orderOut(o) });
  }

  /* 詢問 */
  if (path === 'contact' && method === 'POST') {
    const b = await readBody(request);
    if (b.website) return json({ ok: true }, 201); // 蜜罐欄位有填＝機器人，假裝成功不存
    await rateLimit(env, 'contact:' + ip, 5, 3600);
    // 官網詢問表單用 message／topic，商城頁用 msg：兩種都收
    if (b.message && !b.msg) b.msg = (b.topic ? '【' + String(b.topic).slice(0, 60) + '】' : '') + b.message;
    const email = text(b.email, 120, 'Email', false).toLowerCase(), phone = text(b.phone, 20, '電話', false);
    if (!email && !phone) throw new HttpError(400, '請至少留下 Email 或電話，方便我們回覆');
    if (email && !validEmail(email)) throw new HttpError(400, 'Email 格式不正確');
    await env.DB.prepare('INSERT INTO messages (org, name, phone, email, msg, created) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(text(b.org, 80, '單位名稱', false), text(b.name, 40, '聯絡人'), phone, email, text(b.msg, 2000, '詢問內容'), now()).run();
    return json({ ok: true }, 201);
  }

  return null;
}
