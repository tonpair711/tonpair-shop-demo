// /api/* 入口：分派到前台或後台，統一處理錯誤與來源檢查
import { HttpError, json, checkOrigin } from '../_lib/util.js';
import { handleShop } from '../_lib/shop.js';
import { handleAdmin } from '../_lib/admin.js';

export async function onRequest({ request, env, params }) {
  try {
    const path = (Array.isArray(params.path) ? params.path : [params.path || '']).join('/');
    checkOrigin(request);
    const res = path.startsWith('admin/') ? await handleAdmin(request, env, path) : await handleShop(request, env, path);
    return res || json({ error: '找不到這個功能' }, 404);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error('api error', e && e.stack || e);
    return json({ error: '系統忙碌，請稍後再試' }, 500);
  }
}
