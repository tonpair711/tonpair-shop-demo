/* 後台：總覽、訂單、商品庫存、優惠碼、會員、詢問、設定 */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var STATUSES = ['待確認', '已確認', '已出貨', '已完成', '已取消'];
  var ST = { '待確認': 'wait', '已確認': 'wait', '已出貨': 'ship', '已完成': 'ok', '已取消': 'cancel' };
  var TABS = [['dash', '總覽'], ['orders', '訂單'], ['products', '商品與庫存'], ['coupons', '優惠碼'], ['users', '會員'], ['messages', '詢問信'], ['settings', '設定']];
  var cur = 'dash', badge = { orders: 0, messages: 0 }, ordState = { status: '', q: '', page: 1 };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { return 'NT$' + Math.round(n || 0).toLocaleString('en-US'); }
  function dt(iso) { var d = new Date(iso); if (isNaN(d)) return ''; var p = function (n) { return ('0' + n).slice(-2); }; return d.getFullYear() + '/' + p(d.getMonth() + 1) + '/' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 2200); }
  function stTag(s) { return '<span class="st st-' + ST[s] + '">' + esc(s) + '</span>'; }
  function table(heads, rows, empty) {
    if (!rows.length) return '<div class="tbl-wrap"><div class="empty">' + (empty || '目前沒有資料') + '</div></div>';
    return '<div class="tbl-wrap"><table><thead><tr>' + heads.map(function (h) { return '<th' + (h[1] ? ' class="num"' : '') + '>' + h[0] + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
  }

  /* ---------- 對話框（不使用瀏覽器內建 confirm／alert） ---------- */
  function dialog(html, mount) {
    $('#dlgBox').innerHTML = html; $('#dlg').hidden = false;
    if (mount) mount($('#dlgBox'));
  }
  function closeDlg() { $('#dlg').hidden = true; $('#dlgBox').innerHTML = ''; }
  function askConfirm(msg, okText) {
    return new Promise(function (res) {
      dialog('<h3>請確認</h3><p>' + esc(msg) + '</p><div class="dlg-foot"><button class="btn ghost" data-x="0">取消</button><button class="btn danger" data-x="1">' + (okText || '確定') + '</button></div>', function (b) {
        b.onclick = function (e) { var x = e.target.dataset.x; if (x !== undefined) { closeDlg(); res(x === '1'); } };
      });
    });
  }
  $('#dlg').addEventListener('click', function (e) { if (e.target.id === 'dlg') closeDlg(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#dlg').hidden) closeDlg(); });

  /* ---------- 登入與框架 ---------- */
  function showLogin() { $('#app').hidden = true; $('#login').hidden = false; }
  function showApp() { $('#login').hidden = true; $('#app').hidden = false; renderNav(); go(cur); }
  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, err = $('#loginErr'); err.hidden = true;
    api('admin/login', { method: 'POST', body: { email: f.elements.email.value, password: f.elements.password.value } })
      .then(function () { f.reset(); return refreshBadges(); }).then(showApp)
      .catch(function (er) { err.hidden = false; err.textContent = er.message; });
  });
  $('#logout').onclick = function () { api('admin/logout', { method: 'POST', body: {} }).catch(function () {}).then(showLogin); };
  function renderNav() {
    $('#nav').innerHTML = TABS.map(function (t) {
      var n = badge[t[0]] || 0;
      return '<button data-tab="' + t[0] + '" aria-current="' + (t[0] === cur) + '">' + t[1] + (n ? '<span class="n">' + n + '</span>' : '') + '</button>';
    }).join('');
  }
  $('#nav').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab); });
  function refreshBadges() {
    return api('admin/stats').then(function (d) {
      var wait = 0; d.byStatus.forEach(function (s) { if (s.status === '待確認') wait = s.n; });
      badge.orders = wait; badge.messages = d.unreadMessages; return d;
    });
  }
  var VIEWS = { dash: viewDash, orders: viewOrders, products: viewProducts, coupons: viewCoupons, users: viewUsers, messages: viewMessages, settings: viewSettings };
  function go(tab) {
    cur = tab; $('#title').textContent = TABS.filter(function (t) { return t[0] === tab; })[0][1];
    $('#barAct').innerHTML = ''; $('#view').innerHTML = '<p class="muted">載入中…</p>';
    VIEWS[tab]().then(function () { return refreshBadges(); }).then(renderNav).catch(fail);
  }
  function fail(er) {
    if (er.status === 401) return showLogin();
    $('#view').innerHTML = '<p class="err">' + esc(er.message) + '</p>';
  }

  /* ---------- 總覽 ---------- */
  function viewDash() {
    return api('admin/stats').then(function (d) {
      var wait = 0; d.byStatus.forEach(function (s) { if (s.status === '待確認') wait = s.n; });
      var max = Math.max.apply(null, d.daily.map(function (x) { return x.s; }).concat([1]));
      $('#view').innerHTML = '<div class="cards">' +
        '<div class="stat' + (wait ? ' alert' : '') + '"><b>' + wait + '</b><span>待確認訂單</span></div>' +
        '<div class="stat"><b>' + money(d.revenue30.s) + '</b><span>近 30 天營收（' + d.revenue30.n + ' 筆）</span></div>' +
        '<div class="stat"><b>' + money(d.revenue.s) + '</b><span>累計營收（' + d.revenue.n + ' 筆）</span></div>' +
        '<div class="stat"><b>' + d.users + '</b><span>會員數</span></div>' +
        '<div class="stat' + (d.unreadMessages ? ' alert' : '') + '"><b>' + d.unreadMessages + '</b><span>未讀詢問</span></div></div>' +
        '<div class="panel"><h2>近 30 天每日營收</h2>' + (d.daily.length ? '<div class="chart">' + d.daily.map(function (x) { return '<i style="height:' + Math.max(2, x.s / max * 100) + '%" title="' + x.d + '：' + money(x.s) + '（' + x.n + ' 筆）"></i>'; }).join('') + '</div>' : '<p class="muted">還沒有訂單。</p>') + '</div>' +
        '<div class="panel"><h2>庫存偏低（5 件以下）</h2>' + (d.lowStock.length ? d.lowStock.map(function (p) { return '<div>' + esc(p.name) + '：<b>' + p.stock + '</b> 件</div>'; }).join('') : '<p class="muted">沒有庫存偏低的商品。</p>') + '</div>' +
        '<div class="panel"><h2>最新訂單</h2>' + table([['訂單編號'], ['時間'], ['單位／聯絡人'], ['金額', 1], ['狀態']], d.recent.map(function (o) {
          return '<tr><td><a href="#" data-order="' + esc(o.no) + '">' + esc(o.no) + '</a></td><td>' + dt(o.created) + '</td><td>' + esc(o.info.org) + ' ' + esc(o.info.name) + '</td><td class="num">' + money(o.total) + '</td><td>' + stTag(o.status) + '</td></tr>';
        }), '還沒有訂單') + '</div>';
      $('#view').querySelectorAll('[data-order]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); openOrder(a.dataset.order, d.recent); }; });
    });
  }

  /* ---------- 訂單 ---------- */
  function viewOrders() {
    $('#barAct').innerHTML = '<select id="fStatus"><option value="">全部狀態</option>' + STATUSES.map(function (s) { return '<option' + (ordState.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
      '<input id="fQ" type="search" placeholder="搜尋訂單編號、姓名、單位" value="' + esc(ordState.q) + '"><button class="btn ghost" id="exp" type="button">匯出 Excel</button>';
    $('#fStatus').onchange = function () { ordState.status = this.value; ordState.page = 1; go('orders'); };
    $('#fQ').onkeydown = function (e) { if (e.key === 'Enter') { ordState.q = this.value; ordState.page = 1; go('orders'); } };
    $('#exp').onclick = exportOrders;
    return api('admin/orders?status=' + encodeURIComponent(ordState.status) + '&q=' + encodeURIComponent(ordState.q) + '&page=' + ordState.page).then(function (d) {
      var pages = Math.max(1, Math.ceil(d.total / d.size));
      $('#view').innerHTML = table([['訂單編號'], ['時間'], ['單位'], ['聯絡人'], ['電話'], ['品項'], ['金額', 1], ['付款'], ['狀態'], ['']], d.orders.map(function (o) {
        return '<tr><td>' + esc(o.no) + '</td><td>' + dt(o.created) + '</td><td>' + esc(o.info.org) + '</td><td>' + esc(o.info.name) + '</td><td>' + esc(o.info.phone) + '</td>' +
          '<td class="wrap">' + o.items.map(function (i) { return esc(i.name) + ' × ' + i.qty; }).join('<br>') + '</td><td class="num">' + money(o.total) + '</td><td>' + esc(o.pay) + '</td>' +
          '<td><select data-st="' + esc(o.no) + '">' + STATUSES.map(function (s) { return '<option' + (s === o.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></td>' +
          '<td><button class="btn sm ghost" data-order="' + esc(o.no) + '">詳情</button></td></tr>';
      }), '沒有符合的訂單') + '<div class="pager"><button class="btn sm ghost" id="pp"' + (ordState.page <= 1 ? ' disabled' : '') + '>上一頁</button><span>第 ' + d.page + ' / ' + pages + ' 頁，共 ' + d.total + ' 筆</span><button class="btn sm ghost" id="pn"' + (ordState.page >= pages ? ' disabled' : '') + '>下一頁</button></div>';
      $('#pp').onclick = function () { ordState.page--; go('orders'); };
      $('#pn').onclick = function () { ordState.page++; go('orders'); };
      $('#view').querySelectorAll('[data-order]').forEach(function (b) { b.onclick = function () { openOrder(b.dataset.order, d.orders); }; });
      $('#view').querySelectorAll('[data-st]').forEach(function (s) {
        s.dataset.prev = s.value;
        s.onchange = function () { changeStatus(s.dataset.st, s.value, s); };
      });
    });
  }
  function changeStatus(no, status, sel) {
    var go2 = function () { return api('admin/orders/' + no, { method: 'PATCH', body: { status: status } }).then(function () { toast('訂單 ' + no + ' 已改為「' + status + '」'); go(cur); }).catch(function (er) { toast(er.message); if (sel) sel.value = sel.dataset.prev; }); };
    if (status === '已取消') askConfirm('取消訂單 ' + no + '？庫存會自動補回，取消後無法恢復。', '取消訂單').then(function (ok) { ok ? go2() : (sel && (sel.value = sel.dataset.prev)); });
    else go2();
  }
  function openOrder(no, list) {
    var o = (list || []).filter(function (x) { return x.no === no; })[0];
    var show = function (o) {
      dialog('<h3>訂單 ' + esc(o.no) + ' ' + stTag(o.status) + '</h3><dl class="kv"><dt>下單時間</dt><dd>' + dt(o.created) + '</dd><dt>單位</dt><dd>' + esc(o.info.org) + '</dd><dt>聯絡人</dt><dd>' + esc(o.info.name) + '　' + esc(o.info.phone) + '</dd><dt>Email</dt><dd>' + esc(o.info.email) + '</dd><dt>送貨地址</dt><dd>' + esc(o.info.addr) + '</dd><dt>統一編號</dt><dd>' + esc(o.info.taxid || '無') + '</dd><dt>付款方式</dt><dd>' + esc(o.pay) + '</dd><dt>客戶備註</dt><dd>' + esc(o.note || '無') + '</dd>' + (o.userId ? '<dt>會員</dt><dd>是（編號 ' + o.userId + '）</dd>' : '<dt>會員</dt><dd>訪客</dd>') + '</dl>' +
        table([['品項'], ['單價', 1], ['數量', 1], ['小計', 1]], o.items.map(function (i) { return '<tr><td>' + esc(i.name) + '</td><td class="num">' + money(i.price) + '</td><td class="num">' + i.qty + '</td><td class="num">' + money(i.price * i.qty) + '</td></tr>'; })) +
        '<p>小計 ' + money(o.sub) + (o.disc ? '，優惠 -' + money(o.disc) + '（' + esc(o.coupon) + '）' : '') + '，運費 ' + money(o.ship) + '，<b>應付 ' + money(o.total) + '</b></p>' +
        '<label>狀態<select id="oStatus">' + STATUSES.map(function (s) { return '<option' + (s === o.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label>' +
        '<label style="margin-top:8px">內部備註（客戶看不到）<textarea id="oNote" rows="3" maxlength="500">' + esc(o.adminNote) + '</textarea></label>' +
        '<div class="dlg-foot"><button class="btn ghost" data-x="close">關閉</button><button class="btn" data-x="save">儲存</button></div>', function (b) {
          b.onclick = function (e) {
            var x = e.target.dataset.x; if (!x) return;
            if (x === 'close') return closeDlg();
            var st = $('#oStatus').value, doSave = function () { api('admin/orders/' + o.no, { method: 'PATCH', body: { status: st, adminNote: $('#oNote').value } }).then(function () { closeDlg(); toast('已儲存'); go(cur); }).catch(function (er) { toast(er.message); }); };
            if (st === '已取消' && o.status !== '已取消') askConfirm('取消訂單 ' + o.no + '？庫存會自動補回，取消後無法恢復。', '取消訂單').then(function (ok) { if (ok) doSave(); else show(o); });
            else doSave();
          };
        });
    };
    if (o) show(o); else api('admin/orders?q=' + encodeURIComponent(no)).then(function (d) { if (d.orders[0]) show(d.orders[0]); });
  }
  function exportOrders() {
    api('admin/orders?all=1&status=' + encodeURIComponent(ordState.status) + '&q=' + encodeURIComponent(ordState.q)).then(function (d) {
      var rows = d.orders.map(function (o) {
        return { 訂單編號: o.no, 下單時間: dt(o.created), 狀態: o.status, 單位: o.info.org, 聯絡人: o.info.name, 電話: o.info.phone, Email: o.info.email, 地址: o.info.addr, 統一編號: o.info.taxid,
          品項: o.items.map(function (i) { return i.name + ' × ' + i.qty; }).join('；'), 小計: o.sub, 優惠: o.disc, 運費: o.ship, 應付: o.total, 付款方式: o.pay, 客戶備註: o.note, 內部備註: o.adminNote };
      });
      var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), '訂單');
      XLSX.writeFile(wb, '訂單_' + new Date().toISOString().slice(0, 10) + '.xlsx');
    }).catch(function (er) { toast(er.message); });
  }

  /* ---------- 商品 ---------- */
  function viewProducts() {
    $('#barAct').innerHTML = '<button class="btn" id="addP" type="button">新增商品</button>';
    return api('admin/products').then(function (d) {
      $('#view').innerHTML = table([['商品'], ['分類'], ['單價', 1], ['原價', 1], ['庫存', 1], ['標籤'], ['上架'], ['排序', 1], ['']], d.products.map(function (p) {
        return '<tr><td class="' + (p.active ? '' : 'off') + '">' + esc(p.name) + '</td><td>' + esc(p.cat) + '</td><td class="num">' + money(p.price) + '</td><td class="num">' + (p.oldPrice ? money(p.oldPrice) : '') + '</td><td class="num">' + (p.stock == null ? '不限量' : p.stock) + '</td><td>' + esc(p.tag) + '</td><td>' + (p.active ? '上架中' : '已下架') + '</td><td class="num">' + p.sort + '</td>' +
          '<td><div class="row-act"><button class="btn sm ghost" data-edit="' + p.id + '">編輯</button><button class="btn sm danger" data-del="' + p.id + '">刪除</button></div></td></tr>';
      }), '還沒有商品');
      var byId = {}; d.products.forEach(function (p) { byId[p.id] = p; });
      $('#addP').onclick = function () { productForm(null); };
      $('#view').querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { productForm(byId[b.dataset.edit]); }; });
      $('#view').querySelectorAll('[data-del]').forEach(function (b) {
        b.onclick = function () { askConfirm('刪除「' + byId[b.dataset.del].name + '」？已成立的訂單不受影響，但商品會從商城消失（若只是暫停販售，請改用「下架」）。', '刪除').then(function (ok) { if (ok) api('admin/products/' + b.dataset.del, { method: 'DELETE', body: {} }).then(function () { toast('已刪除'); go('products'); }).catch(function (er) { toast(er.message); }); }); };
      });
    });
  }
  function productForm(p) {
    p = p || { name: '', cat: '', price: '', oldPrice: '', img: 'images/', tag: '', desc: '', spec: '', stock: null, active: true, sort: 0 };
    dialog('<h3>' + (p.id ? '編輯商品' : '新增商品') + '</h3><form id="pf" class="grid2" novalidate>' +
      '<label class="full">商品名稱<input name="name" maxlength="80" value="' + esc(p.name) + '" required></label>' +
      '<label>分類<input name="cat" maxlength="20" value="' + esc(p.cat) + '" required></label><label>標籤（選填，如 熱銷）<input name="tag" maxlength="12" value="' + esc(p.tag) + '"></label>' +
      '<label>單價（元）<input name="price" inputmode="numeric" value="' + esc(p.price) + '" required></label><label>原價（特價時填，選填）<input name="oldPrice" inputmode="numeric" value="' + esc(p.oldPrice || '') + '"></label>' +
      '<label>庫存（留空＝不限量）<input name="stock" inputmode="numeric" value="' + esc(p.stock == null ? '' : p.stock) + '"></label><label>排序（小的在前）<input name="sort" inputmode="numeric" value="' + esc(p.sort) + '"></label>' +
      '<label class="full">圖片（images/檔名.jpg 或 https 網址）<input name="img" maxlength="300" value="' + esc(p.img) + '"></label>' +
      '<label class="full">商品說明<textarea name="desc" rows="3" maxlength="600">' + esc(p.desc) + '</textarea></label>' +
      '<label class="full">規格（一行文字）<input name="spec" maxlength="120" value="' + esc(p.spec) + '"></label>' +
      '<label class="full" style="grid-auto-flow:column;justify-content:start;gap:8px;align-items:center"><input type="checkbox" name="active"' + (p.active ? ' checked' : '') + '> 上架販售</label>' +
      '<p class="err full" id="pfErr" hidden></p></form><div class="dlg-foot"><button class="btn ghost" data-x="close">取消</button><button class="btn" data-x="save">儲存</button></div>', function (b) {
        b.onclick = function (e) {
          var x = e.target.dataset.x; if (!x) return; if (x === 'close') return closeDlg();
          var f = $('#pf').elements, body = { name: f.name.value, cat: f.cat.value, tag: f.tag.value, price: f.price.value, oldPrice: f.oldPrice.value, stock: f.stock.value, sort: f.sort.value, img: f.img.value, desc: f.desc.value, spec: f.spec.value, active: f.active.checked };
          api(p.id ? 'admin/products/' + p.id : 'admin/products', { method: p.id ? 'PUT' : 'POST', body: body })
            .then(function () { closeDlg(); toast('已儲存'); go('products'); }).catch(function (er) { var m = $('#pfErr'); m.hidden = false; m.textContent = er.message; });
        };
      });
  }

  /* ---------- 優惠碼 ---------- */
  function viewCoupons() {
    $('#barAct').innerHTML = '<button class="btn" id="addC" type="button">新增優惠碼</button>';
    return api('admin/coupons').then(function (d) {
      $('#view').innerHTML = table([['優惠碼'], ['名稱'], ['內容'], ['最低消費', 1], ['已使用', 1], ['狀態'], ['']], d.coupons.map(function (c) {
        return '<tr><td>' + esc(c.code) + '</td><td>' + esc(c.label) + '</td><td>' + (c.type === 'percent' ? '折 ' + c.value + '%' : '折抵 ' + money(c.value)) + '</td><td class="num">' + money(c.min_amount) + '</td><td class="num">' + c.used + '</td><td>' + (c.active ? '啟用中' : '已停用') + '</td>' +
          '<td><div class="row-act"><button class="btn sm ghost" data-edit="' + esc(c.code) + '">編輯</button><button class="btn sm danger" data-del="' + esc(c.code) + '">刪除</button></div></td></tr>';
      }), '還沒有優惠碼');
      var by = {}; d.coupons.forEach(function (c) { by[c.code] = c; });
      $('#addC').onclick = function () { couponForm(null); };
      $('#view').querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { couponForm(by[b.dataset.edit]); }; });
      $('#view').querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { askConfirm('刪除優惠碼 ' + b.dataset.del + '？', '刪除').then(function (ok) { if (ok) api('admin/coupons/' + b.dataset.del, { method: 'DELETE', body: {} }).then(function () { toast('已刪除'); go('coupons'); }); }); }; });
    });
  }
  function couponForm(c) {
    c = c || { code: '', type: 'percent', value: '', label: '', min_amount: 0, active: true };
    dialog('<h3>' + (c.code ? '編輯優惠碼 ' + esc(c.code) : '新增優惠碼') + '</h3><form id="cf" class="grid2" novalidate>' +
      (c.code ? '' : '<label class="full">優惠碼（英數字，3 到 20 碼）<input name="code" maxlength="20" required></label>') +
      '<label class="full">顯示名稱（客人看得到，如 學校專案價 95 折）<input name="label" maxlength="30" value="' + esc(c.label) + '" required></label>' +
      '<label>類型<select name="type"><option value="percent"' + (c.type === 'percent' ? ' selected' : '') + '>百分比折扣</option><option value="amount"' + (c.type === 'amount' ? ' selected' : '') + '>固定金額折抵</option></select></label>' +
      '<label>折扣值（百分比填 1 到 90；金額填元）<input name="value" inputmode="numeric" value="' + esc(c.value) + '" required></label>' +
      '<label>最低消費（元，0＝不限）<input name="minAmount" inputmode="numeric" value="' + esc(c.min_amount) + '"></label>' +
      '<label style="grid-auto-flow:column;justify-content:start;gap:8px;align-items:center"><input type="checkbox" name="active"' + (c.active ? ' checked' : '') + '> 啟用</label>' +
      '<p class="err full" id="cfErr" hidden></p></form><div class="dlg-foot"><button class="btn ghost" data-x="close">取消</button><button class="btn" data-x="save">儲存</button></div>', function (b) {
        b.onclick = function (e) {
          var x = e.target.dataset.x; if (!x) return; if (x === 'close') return closeDlg();
          var f = $('#cf').elements, body = { code: f.code ? f.code.value : c.code, label: f.label.value, type: f.type.value, value: f.value.value, minAmount: f.minAmount.value, active: f.active.checked };
          api(c.code ? 'admin/coupons/' + c.code : 'admin/coupons', { method: c.code ? 'PUT' : 'POST', body: body })
            .then(function () { closeDlg(); toast('已儲存'); go('coupons'); }).catch(function (er) { var m = $('#cfErr'); m.hidden = false; m.textContent = er.message; });
        };
      });
  }

  /* ---------- 會員 ---------- */
  function viewUsers() {
    return api('admin/users').then(function (d) {
      $('#barAct').innerHTML = '<button class="btn ghost" id="expU" type="button">匯出 Excel</button>';
      $('#expU').onclick = function () {
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.users.map(function (u) { return { Email: u.email, 聯絡人: u.name, 單位: u.org, 電話: u.phone, 統一編號: u.taxid, 加入時間: dt(u.created), 訂單數: u.orders, 累計消費: u.spent }; })), '會員');
        XLSX.writeFile(wb, '會員_' + new Date().toISOString().slice(0, 10) + '.xlsx');
      };
      $('#view').innerHTML = table([['Email'], ['聯絡人'], ['單位'], ['電話'], ['統編'], ['加入時間'], ['訂單數', 1], ['累計消費', 1]], d.users.map(function (u) {
        return '<tr><td>' + esc(u.email) + '</td><td>' + esc(u.name) + '</td><td>' + esc(u.org) + '</td><td>' + esc(u.phone) + '</td><td>' + esc(u.taxid) + '</td><td>' + dt(u.created) + '</td><td class="num">' + u.orders + '</td><td class="num">' + money(u.spent) + '</td></tr>';
      }), '還沒有會員註冊');
    });
  }

  /* ---------- 詢問信 ---------- */
  function viewMessages() {
    return api('admin/messages').then(function (d) {
      $('#view').innerHTML = table([['時間'], ['聯絡人'], ['單位'], ['電話'], ['Email'], ['內容'], ['狀態'], ['']], d.messages.map(function (m) {
        return '<tr><td>' + dt(m.created) + '</td><td>' + esc(m.name) + '</td><td>' + esc(m.org) + '</td><td>' + esc(m.phone) + '</td><td>' + (m.email ? '<a href="mailto:' + esc(m.email) + '">' + esc(m.email) + '</a>' : '') + '</td><td class="wrap">' + esc(m.msg).replace(/\n/g, '<br>') + '</td>' +
          '<td><select data-ms="' + m.id + '">' + ['未讀', '已讀', '已回覆'].map(function (s) { return '<option' + (s === m.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></td><td><button class="btn sm danger" data-del="' + m.id + '">刪除</button></td></tr>';
      }), '還沒有詢問信');
      $('#view').querySelectorAll('[data-ms]').forEach(function (s) { s.onchange = function () { api('admin/messages/' + s.dataset.ms, { method: 'PATCH', body: { status: s.value } }).then(function () { toast('已更新'); refreshBadges().then(renderNav); }); }; });
      $('#view').querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { askConfirm('刪除這封詢問？', '刪除').then(function (ok) { if (ok) api('admin/messages/' + b.dataset.del, { method: 'DELETE', body: {} }).then(function () { toast('已刪除'); go('messages'); }); }); }; });
    });
  }

  /* ---------- 設定 ---------- */
  function viewSettings() {
    return api('admin/settings').then(function (d) {
      var s = d.settings;
      $('#view').innerHTML = '<div class="panel"><h2>商城設定</h2><form id="sf" class="dlg-form" novalidate style="display:grid;gap:10px;max-width:560px">' +
        '<label>商城名稱<input name="name" maxlength="40" value="' + esc(s.name) + '"></label>' +
        '<label>免運門檻（折扣後滿多少元免運）<input name="freeShipping" inputmode="numeric" value="' + esc(s.freeShipping) + '"></label>' +
        '<label>運費（元）<input name="shippingFee" inputmode="numeric" value="' + esc(s.shippingFee) + '"></label>' +
        '<label>ATM 匯款資訊（訂單完成頁會顯示給選 ATM 轉帳的客人；可換行）<textarea name="bankInfo" rows="4" maxlength="400">' + esc(s.bankInfo) + '</textarea></label>' +
        '<label>前台公告（顯示在網頁最上方，留空就不顯示）<input name="notice" maxlength="200" value="' + esc(s.notice) + '"></label>' +
        '<p class="err" id="sfErr" hidden></p><div><button class="btn" type="submit">儲存設定</button></div></form></div>' +
        '<div class="panel"><h2>變更後台密碼</h2><form id="pf2" novalidate style="display:grid;gap:10px;max-width:360px"><label>目前密碼<input name="old" type="password" autocomplete="current-password"></label><label>新密碼（至少 8 碼，含英文與數字）<input name="pw" type="password" autocomplete="new-password"></label><p class="err" id="pfErr2" hidden></p><div><button class="btn ghost" type="submit">更新密碼</button></div></form></div>';
      $('#sf').onsubmit = function (e) {
        e.preventDefault(); var f = e.target.elements;
        api('admin/settings', { method: 'PUT', body: { name: f.name.value, freeShipping: f.freeShipping.value, shippingFee: f.shippingFee.value, bankInfo: f.bankInfo.value, notice: f.notice.value } })
          .then(function () { $('#sfErr').hidden = true; toast('設定已儲存'); }).catch(function (er) { var m = $('#sfErr'); m.hidden = false; m.textContent = er.message; });
      };
      $('#pf2').onsubmit = function (e) {
        e.preventDefault(); var f = e.target.elements, m = $('#pfErr2');
        api('admin/password', { method: 'POST', body: { old: f.old.value, password: f.pw.value } })
          .then(function () { e.target.reset(); m.hidden = true; toast('密碼已更新'); }).catch(function (er) { m.hidden = false; m.textContent = er.message; });
      };
    });
  }

  /* ---------- 啟動 ---------- */
  api('admin/me').then(function () { return refreshBadges(); }).then(showApp).catch(function () { showLogin(); });
})();
