// 共用工具：回應、密碼雜湊、session、限流、驗證
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
  });
}

export const now = () => new Date().toISOString();

export function randHex(bytes) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return [...a].map(x => x.toString(16).padStart(2, '0')).join('');
}

export async function sha256(text) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Workers 的 PBKDF2 迭代上限是 100000
export async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100000 }, key, 256);
  return [...new Uint8Array(bits)].map(x => x.toString(16).padStart(2, '0')).join('');
}

export function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export function validPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8 && pw.length <= 100 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}
export const validEmail = e => typeof e === 'string' && e.length <= 120 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
export const validPhone = p => typeof p === 'string' && /^(09\d{8}|0\d{1,2}-?\d{6,8})$/.test(p.replace(/\s/g, ''));
export const validTaxid = t => t === '' || /^\d{8}$/.test(t);

export function text(v, max, name, required = true) {
  const s = (v == null ? '' : String(v)).trim();
  if (required && !s) throw new HttpError(400, `請填寫${name}`);
  if (s.length > max) throw new HttpError(400, `${name}太長（最多 ${max} 字）`);
  return s;
}

export async function readBody(request) {
  if (!(request.headers.get('content-type') || '').includes('application/json')) throw new HttpError(415, '格式錯誤');
  try { return await request.json(); } catch (e) { throw new HttpError(400, '資料格式錯誤'); }
}

// 非 GET 一律要求同網域來源，擋跨站偽造請求
export function checkOrigin(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return;
  const origin = request.headers.get('origin');
  if (!origin || new URL(origin).host !== new URL(request.url).host) throw new HttpError(403, '來源不被允許');
}

export function clientIp(request) {
  return request.headers.get('cf-connecting-ip') || 'unknown';
}

export async function rateLimit(env, key, max, windowSec) {
  const t = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare('SELECT count, reset FROM rl WHERE key = ?').bind(key).first();
  if (!row || row.reset <= t) {
    await env.DB.prepare('INSERT INTO rl (key, count, reset) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, reset = excluded.reset')
      .bind(key, t + windowSec).run();
    return;
  }
  if (row.count >= max) throw new HttpError(429, '操作太頻繁，請稍後再試');
  await env.DB.prepare('UPDATE rl SET count = count + 1 WHERE key = ?').bind(key).run();
}

/* ---------- session（隨機 token，資料庫只存雜湊） ---------- */
const COOKIE = { user: 'hl_s', admin: 'hl_a' };
const TTL = { user: 30 * 86400, admin: 12 * 3600 };

export function readCookie(request, name) {
  const m = (request.headers.get('cookie') || '').match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
  return m ? m[1] : '';
}

export async function createSession(env, kind, subjectId) {
  const token = randHex(32);
  const exp = Math.floor(Date.now() / 1000) + TTL[kind];
  await env.DB.prepare('INSERT INTO sessions (token_hash, kind, subject_id, expires) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), kind, subjectId, exp).run();
  await env.DB.prepare('DELETE FROM sessions WHERE expires < ?').bind(Math.floor(Date.now() / 1000)).run();
  return `${COOKIE[kind]}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${TTL[kind]}`;
}

export function clearCookie(kind) {
  return `${COOKIE[kind]}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function sessionSubject(env, request, kind) {
  const token = readCookie(request, COOKIE[kind]);
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const row = await env.DB.prepare('SELECT subject_id, expires FROM sessions WHERE token_hash = ? AND kind = ?')
    .bind(await sha256(token), kind).first();
  if (!row || row.expires < Math.floor(Date.now() / 1000)) return null;
  return row.subject_id;
}

export async function destroySession(env, request, kind) {
  const token = readCookie(request, COOKIE[kind]);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
}

export async function settings(env) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const s = {};
  for (const r of results) s[r.key] = r.value;
  return {
    name: s.name || '鴻綸科技教育商城',
    freeShipping: Number(s.freeShipping ?? 30000),
    shippingFee: Number(s.shippingFee ?? 300),
    bankInfo: s.bankInfo || '',
    notice: s.notice || ''
  };
}
