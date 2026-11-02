// 前端呼叫後端 API 的共用函式。出錯時丟 Error（message 是給使用者看的中文）
window.api = function (path, opt) {
  opt = opt || {};
  var o = { method: opt.method || 'GET', credentials: 'same-origin', headers: {} };
  if (opt.body !== undefined) { o.headers['content-type'] = 'application/json'; o.body = JSON.stringify(opt.body); }
  return fetch('/api/' + path, o).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (d) {
      if (!r.ok) { var e = new Error(d.error || '系統忙碌，請稍後再試'); e.status = r.status; throw e; }
      return d;
    });
  }, function () { throw new Error('網路連線異常，請檢查網路後再試'); });
};
window.fmtDate = function (iso) {
  var d = new Date(iso); if (isNaN(d)) return '';
  return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
};
