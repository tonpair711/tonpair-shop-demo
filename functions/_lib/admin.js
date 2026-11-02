// 後台 API（/api/admin/*）：全部要管理員登入，登入除外
import {
  HttpError, json, now, randHex, hashPassword, safeEqual, validPassword, validEmail,
  text, readBody, clientIp, rateLimit, createSession, clearCookie, sessionSubject, destroySession, settings
} from './util.js';

export const STATUSES = ['待確認', '已確認', '已出貨', '已完成', '已取消'];

const orderRow = o => ({
  no: o.no, status: o.status, pay: o.pay, sub: o.sub, disc: o.disc, ship: o.ship, total: o.total, coupon: o.coupon,
  items: JSON.parse(o.items), info: JSON.parse(o.info), note: o.note, adminNote: o.admin_note, userId: o.user_id,
  created: o.created, updated: o.updated
});
const productRow = p => ({
  id: p.id, name: p.name, cat: p.cat, price: p.price, oldPrice: p.old_price, img: p.img, tag: p.tag,
  desc: p.description, spec: p.spec, stock: p.stock, active: !!p.active, sort: p.sort
});

function productInput(b) {
  const price = Number(b.price), old = b.oldPrice === '' || b.oldPrice == null ? null : Number(b.oldPrice);
  const stock = b.stock === '' || b.stock == null ? null : Number(b.stock);
  if (!Number.isInteger(price) || price < 0 || price > 99999999) throw new HttpError(400, '價格要是 0 以上的整數');
  if (old !== null && (!Number.isInteger(old) || old < 0)) throw new HttpError(400, '原價要是整數');
  if (stock !== null && (!Number.isInteger(stock) || stock < 0)) throw new HttpError(400, '庫存要是 0 以上的整數，留空代表不限量');
  const img = text(b.img, 300, '圖片網址', false);
  if (img && !/^(images\/[\w./-]+|https:\/\/[^\s"'<>]+)$/.test(img)) throw new HttpError(400, '圖片只能是 images/ 開頭的檔案或 https 網址');
  return {
    name: text(b.name, 80, '商品名稱'), cat: text(b.cat, 20, '分類'), price, oldPrice: old, img, tag: text(b.tag, 12, '標籤', false),
    desc: text(b.desc, 600, '商品說明', false), spec: text(b.spec, 120, '規格', false), stock,
    active: b.active === false || b.active === 0 ? 0 : 1, sort: Number.isInteger(Number(b.sort)) ? Number(b.sort) : 0
  };
}

async function requireAdmin(env, request) {
  const id = await sessionSubject(env, request, 'admin');
  const a = id ? await env.DB.prepare('SELECT * FROM admins WHERE id = ?').bind(id).first() : null;
  if (!a) throw new HttpError(401, '請先登入後台');
  return a;
}

async function restock(env, order) {
  for (const it of JSON.parse(order.items)) {
    await env.DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ? AND stock IS NOT NULL').bind(it.qty, it.id).run();
  }
}

export async function handleAdmin(request, env, path) {
  const method = request.method;
  const ip = clientIp(request);

  if (path === 'admin/login' && method === 'POST') {
    const b = await readBody(request);
    const email = text(b.email, 120, 'Email').toLowerCase();
    await rateLimit(env, `alogin:${ip}`, 8, 900);
    const a = await env.DB.prepare('SELECT * FROM admins WHERE email = ?').bind(email).first();
    const ok = a && safeEqual(await hashPassword(String(b.password || ''), a.salt), a.hash);
    if (!ok) throw new HttpError(401, '帳號或密碼不正確');
    return json({ admin: { email: a.email, name: a.name } }, 200, { 'set-cookie': await createSession(env, 'admin', a.id) });
  }
  if (path === 'admin/logout' && method === 'POST') {
    await destroySession(env, request, 'admin');
    return json({ ok: true }, 200, { 'set-cookie': clearCookie('admin') });
  }

  const admin = await requireAdmin(env, request);

  if (path === 'admin/me' && method === 'GET') return json({ admin: { email: admin.email, name: admin.name } });

  if (path === 'admin/password' && method === 'POST') {
    const b = await readBody(request);
    await rateLimit(env, 'apw:' + admin.id, 8, 900);
    if (!safeEqual(await hashPassword(String(b.old || ''), admin.salt), admin.hash)) throw new HttpError(400, '目前密碼不正確');
    if (!validPassword(b.password)) throw new HttpError(400, '新密碼至少 8 碼，且要有英文與數字');
    const salt = randHex(16);
    await env.DB.prepare('UPDATE admins SET salt = ?, hash = ? WHERE id = ?').bind(salt, await hashPassword(b.password, salt), admin.id).run();
    return json({ ok: true });
  }

  /* 總覽 */
  if (path === 'admin/stats' && method === 'GET') {
    const q = async (sql, ...a) => await env.DB.prepare(sql).bind(...a).first();
    const byStatus = (await env.DB.prepare('SELECT status, COUNT(*) n FROM orders GROUP BY status').all()).results;
    const since = new Date(Date.now() - 30 * 86400e3).toISOString();
    const rev = await q("SELECT COALESCE(SUM(total),0) s, COUNT(*) n FROM orders WHERE status != '已取消'");
    const rev30 = await q("SELECT COALESCE(SUM(total),0) s, COUNT(*) n FROM orders WHERE status != '已取消' AND created >= ?", since);
    const users = await q('SELECT COUNT(*) n FROM users');
    const msgs = await q("SELECT COUNT(*) n FROM messages WHERE status = '未讀'");
    const low = (await env.DB.prepare('SELECT id, name, stock FROM products WHERE active = 1 AND stock IS NOT NULL AND stock <= 5 ORDER BY stock').all()).results;
    const recent = (await env.DB.prepare('SELECT * FROM orders ORDER BY created DESC LIMIT 8').all()).results.map(orderRow);
    const daily = (await env.DB.prepare("SELECT substr(created,1,10) d, COUNT(*) n, SUM(total) s FROM orders WHERE status != '已取消' AND created >= ? GROUP BY d ORDER BY d").bind(since).all()).results;
    return json({ byStatus, revenue: rev, revenue30: rev30, users: users.n, unreadMessages: msgs.n, lowStock: low, recent, daily });
  }

  /* 訂單 */
  if (path === 'admin/orders' && method === 'GET') {
    const u = new URL(request.url), status = u.searchParams.get('status') || '', kw = (u.searchParams.get('q') || '').trim().slice(0, 40);
    const all = u.searchParams.get('all') === '1', page = Math.max(1, Number(u.searchParams.get('page')) || 1), size = 20;
    const where = [], args = [];
    if (STATUSES.includes(status)) { where.push('status = ?'); args.push(status); }
    if (kw) { where.push('(no LIKE ? OR info LIKE ?)'); args.push(`%${kw}%`, `%${kw}%`); }
    const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const total = (await env.DB.prepare(`SELECT COUNT(*) n FROM orders ${w}`).bind(...args).first()).n;
    const sql = `SELECT * FROM orders ${w} ORDER BY created DESC ` + (all ? 'LIMIT 5000' : `LIMIT ${size} OFFSET ${(page - 1) * size}`);
    const { results } = await env.DB.prepare(sql).bind(...args).all();
    return json({ total, page, size, orders: results.map(orderRow) });
  }
  const ord = path.match(/^admin\/orders\/([\w-]{1,30})$/);
  if (ord && method === 'PATCH') {
    const o = await env.DB.prepare('SELECT * FROM orders WHERE no = ?').bind(ord[1]).first();
    if (!o) throw new HttpError(404, '找不到訂單');
    const b = await readBody(request);
    let status = o.status;
    if (b.status !== undefined) {
      if (!STATUSES.includes(b.status)) throw new HttpError(400, '狀態不正確');
      if (o.status === '已取消' && b.status !== '已取消') throw new HttpError(400, '已取消的訂單不能恢復，請請客戶重新下單');
      if (b.status === '已取消' && o.status !== '已取消') await restock(env, o);
      status = b.status;
    }
    const adminNote = b.adminNote === undefined ? o.admin_note : text(b.adminNote, 500, '內部備註', false);
    await env.DB.prepare('UPDATE orders SET status = ?, admin_note = ?, updated = ? WHERE no = ?').bind(status, adminNote, now(), o.no).run();
    return json({ order: orderRow(await env.DB.prepare('SELECT * FROM orders WHERE no = ?').bind(o.no).first()) });
  }

  /* 商品 */
  if (path === 'admin/products' && method === 'GET') {
    return json({ products: (await env.DB.prepare('SELECT * FROM products ORDER BY sort, rowid').all()).results.map(productRow) });
  }
  if (path === 'admin/products' && method === 'POST') {
    const p = productInput(await readBody(request));
    const id = 'p' + randHex(4);
    await env.DB.prepare('INSERT INTO products (id, name, cat, price, old_price, img, tag, description, spec, stock, active, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, p.name, p.cat, p.price, p.oldPrice, p.img, p.tag, p.desc, p.spec, p.stock, p.active, p.sort).run();
    return json({ product: productRow(await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first()) }, 201);
  }
  const prod = path.match(/^admin\/products\/([\w-]{1,40})$/);
  if (prod && method === 'PUT') {
    const p = productInput(await readBody(request));
    const r = await env.DB.prepare('UPDATE products SET name=?, cat=?, price=?, old_price=?, img=?, tag=?, description=?, spec=?, stock=?, active=?, sort=? WHERE id = ?')
      .bind(p.name, p.cat, p.price, p.oldPrice, p.img, p.tag, p.desc, p.spec, p.stock, p.active, p.sort, prod[1]).run();
    if (!r.meta.changes) throw new HttpError(404, '找不到商品');
    return json({ product: productRow(await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(prod[1]).first()) });
  }
  if (prod && method === 'DELETE') {
    await env.DB.prepare('DELETE FROM favs WHERE product_id = ?').bind(prod[1]).run();
    await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(prod[1]).run();
    return json({ ok: true });
  }

  /* 優惠碼 */
  if (path === 'admin/coupons' && method === 'GET') {
    return json({ coupons: (await env.DB.prepare('SELECT * FROM coupons ORDER BY rowid').all()).results.map(c => ({ ...c, active: !!c.active })) });
  }
  const couponIn = b => {
    const type = b.type === 'amount' ? 'amount' : 'percent', value = Number(b.value), min = Number(b.minAmount || 0);
    if (!Number.isInteger(value) || value < 1 || (type === 'percent' && value > 90)) throw new HttpError(400, type === 'percent' ? '折扣百分比要是 1 到 90' : '折抵金額要是正整數');
    if (!Number.isInteger(min) || min < 0) throw new HttpError(400, '最低消費要是 0 以上的整數');
    return { type, value, min, label: text(b.label, 30, '顯示名稱'), active: b.active === false ? 0 : 1 };
  };
  if (path === 'admin/coupons' && method === 'POST') {
    const b = await readBody(request), code = text(b.code, 20, '優惠碼').toUpperCase();
    if (!/^[A-Z0-9_-]{3,20}$/.test(code)) throw new HttpError(400, '優惠碼只能用英文、數字、底線與減號，3 到 20 碼');
    if (await env.DB.prepare('SELECT 1 FROM coupons WHERE code = ?').bind(code).first()) throw new HttpError(409, '這組優惠碼已存在');
    const c = couponIn(b);
    await env.DB.prepare('INSERT INTO coupons (code, type, value, label, min_amount, active) VALUES (?, ?, ?, ?, ?, ?)').bind(code, c.type, c.value, c.label, c.min, c.active).run();
    return json({ ok: true }, 201);
  }
  const cp = path.match(/^admin\/coupons\/([\w-]{1,20})$/);
  if (cp && method === 'PUT') {
    const c = couponIn(await readBody(request));
    await env.DB.prepare('UPDATE coupons SET type=?, value=?, label=?, min_amount=?, active=? WHERE code = ?').bind(c.type, c.value, c.label, c.min, c.active, cp[1]).run();
    return json({ ok: true });
  }
  if (cp && method === 'DELETE') {
    await env.DB.prepare('DELETE FROM coupons WHERE code = ?').bind(cp[1]).run();
    return json({ ok: true });
  }

  /* 會員 */
  if (path === 'admin/users' && method === 'GET') {
    const { results } = await env.DB.prepare(`SELECT u.id, u.email, u.name, u.org, u.phone, u.taxid, u.created,
      (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders,
      (SELECT COALESCE(SUM(total),0) FROM orders o WHERE o.user_id = u.id AND o.status != '已取消') AS spent
      FROM users u ORDER BY u.created DESC LIMIT 2000`).all();
    return json({ users: results });
  }

  /* 詢問 */
  if (path === 'admin/messages' && method === 'GET') {
    return json({ messages: (await env.DB.prepare('SELECT * FROM messages ORDER BY created DESC LIMIT 500').all()).results });
  }
  const msg = path.match(/^admin\/messages\/(\d{1,10})$/);
  if (msg && method === 'PATCH') {
    const b = await readBody(request);
    if (!['未讀', '已讀', '已回覆'].includes(b.status)) throw new HttpError(400, '狀態不正確');
    await env.DB.prepare('UPDATE messages SET status = ? WHERE id = ?').bind(b.status, Number(msg[1])).run();
    return json({ ok: true });
  }
  if (msg && method === 'DELETE') {
    await env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(Number(msg[1])).run();
    return json({ ok: true });
  }

  /* 設定 */
  if (path === 'admin/settings' && method === 'GET') return json({ settings: await settings(env) });
  if (path === 'admin/settings' && method === 'PUT') {
    const b = await readBody(request);
    const fs = Number(b.freeShipping), sf = Number(b.shippingFee);
    if (!Number.isInteger(fs) || fs < 0 || !Number.isInteger(sf) || sf < 0) throw new HttpError(400, '免運門檻與運費要是 0 以上的整數');
    const rows = { name: text(b.name, 40, '商城名稱'), freeShipping: String(fs), shippingFee: String(sf), bankInfo: text(b.bankInfo, 400, '匯款資訊', false), notice: text(b.notice, 200, '公告', false) };
    for (const [k, v] of Object.entries(rows)) {
      await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v).run();
    }
    return json({ settings: await settings(env) });
  }

  return null;
}
