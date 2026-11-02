/* 會員功能：登入註冊、會員中心（訂單、收藏、資料、密碼）。資料在伺服端，登入狀態用 HttpOnly Cookie。 */
window.Member = (function () {
  var me = null, favs = [], pendingGo = null, pendingFav = null, tab = 'orders', orders = null, authVer = 0;
  function $(s) { return document.querySelector(s); }
  function A() { return window.ShopApp; }
  function esc(s) { return A().esc(s); }

  function user() { return me; }

  /* ---------- 初始化 ---------- */
  function init() {
    $('#acctBtn').onclick = function () { me ? A().go('member') : openAuth('login'); };
    $('#logoutBtn').onclick = logout;
    $('#authForm').addEventListener('submit', submitAuth);
    document.addEventListener('click', function (e) {
      var o = e.target.closest('[data-auth-open]'), c = e.target.closest('[data-auth-close]'), t = e.target.closest('[data-auth]'), m = e.target.closest('[data-mtab]'), a = e.target.closest('[data-m]');
      if (o) { e.preventDefault(); openAuth(o.dataset.authOpen); }
      else if (c || e.target.id === 'auth') closeAuth();
      else if (t) renderAuth(t.dataset.auth);
      else if (m) { tab = m.dataset.mtab; renderCenter(); }
      else if (a) memberAction(a.dataset.m, a.dataset.id);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAuth(); });
    $('#mcBody').addEventListener('submit', memberForm);
    var v0 = authVer; // 這個請求回來前如果已經登入或登出，就不要蓋掉較新的狀態
    return api('me').then(function (d) { if (v0 !== authVer) return; me = d.user; favs = d.favs || []; renderHeader(); }).catch(function () { renderHeader(); });
  }
  function renderHeader() { $('#acctBtn').textContent = me ? (me.name || '會員') + ' 的帳戶' : '登入／註冊'; }
  function setUser(d) { authVer++; me = d.user; favs = d.favs || []; orders = null; tab = 'orders'; renderHeader(); }

  /* ---------- 登入與註冊視窗 ---------- */
  function openAuth(mode, after) {
    pendingGo = after || null;
    $('#auth').hidden = false; document.body.style.overflow = 'hidden';
    renderAuth(mode);
  }
  function closeAuth() { $('#auth').hidden = true; document.body.style.overflow = ''; pendingGo = null; pendingFav = null; }
  function field(label, name, type, extra) {
    return '<label>' + label + '<input name="' + name + '" type="' + (type || 'text') + '" ' + (extra || '') + '></label>';
  }
  function renderAuth(mode) {
    var reg = mode === 'register';
    $('#authTitle').textContent = reg ? '建立會員帳號' : '會員登入';
    $('#authTabs').innerHTML = '<button type="button" role="tab" aria-selected="' + !reg + '" data-auth="login">登入</button><button type="button" role="tab" aria-selected="' + reg + '" data-auth="register">註冊</button>';
    var f = $('#authForm'); f.dataset.mode = mode;
    f.innerHTML = reg
      ? field('單位名稱（學校或機關）', 'org', 'text', 'required maxlength="80" autocomplete="organization"') + field('聯絡人', 'name', 'text', 'required maxlength="40" autocomplete="name"') +
        field('Email（登入帳號）', 'email', 'email', 'required autocomplete="email"') + field('手機', 'phone', 'tel', 'required inputmode="tel" autocomplete="tel"') +
        field('密碼（至少 8 碼，含英文與數字）', 'pw', 'password', 'required autocomplete="new-password"') + field('再輸入一次密碼', 'pw2', 'password', 'required autocomplete="new-password"') +
        '<label class="radio"><input type="checkbox" name="agree"> 我已閱讀並同意<a href="#" data-go="p-terms">服務條款</a>與<a href="#" data-go="p-privacy">隱私權政策</a></label>'
      : field('Email', 'email', 'email', 'required autocomplete="username"') + field('密碼', 'pw', 'password', 'required autocomplete="current-password"') +
        '<div class="auth-links"><button type="button" class="link" data-m="forgot">忘記密碼？</button></div>';
    f.innerHTML += '<p class="err" id="authErr" role="alert" hidden></p><button class="btn wide" type="submit">' + (reg ? '建立帳號' : '登入') + '</button>';
    var first = f.querySelector('input'); if (first) setTimeout(function () { first.focus(); }, 30);
  }
  function authErr(msg) { var e = $('#authErr'); e.hidden = !msg; e.textContent = msg || ''; }

  function submitAuth(e) {
    e.preventDefault();
    var f = e.target, v = function (k) { return f.elements[k] ? f.elements[k].value.trim() : ''; }, btn = f.querySelector('button[type=submit]');
    authErr('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('email'))) return authErr('Email 格式不正確');
    var req;
    if (f.dataset.mode === 'register') {
      if (!v('org') || !v('name')) return authErr('請填寫單位名稱與聯絡人');
      if (!/^(09\d{8}|0\d{1,2}-?\d{6,8})$/.test(v('phone').replace(/\s/g, ''))) return authErr('手機格式不正確');
      var pw = f.elements.pw.value;
      if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return authErr('密碼至少 8 碼，且要有英文與數字');
      if (pw !== f.elements.pw2.value) return authErr('兩次密碼不一樣');
      if (!f.elements.agree.checked) return authErr('請勾選同意服務條款與隱私權政策');
      req = api('register', { method: 'POST', body: { org: v('org'), name: v('name'), email: v('email'), phone: v('phone'), password: pw } });
    } else {
      req = api('login', { method: 'POST', body: { email: v('email'), password: f.elements.pw.value } });
    }
    btn.disabled = true;
    req.then(function (d) { finishLogin(d, f.dataset.mode === 'register' ? '註冊成功，歡迎加入' : '登入成功'); })
      .catch(function (er) { authErr(er.message); }).then(function () { btn.disabled = false; });
  }
  function finishLogin(d, msg) {
    var go = pendingGo, fav = pendingFav;
    closeAuth(); setUser(d); A().renderGrid(); A().toast(msg);
    if (fav) toggleFav(fav);
    if (go) A().go(go);
    A().refresh();
  }
  function logout() {
    api('logout', { method: 'POST', body: {} }).catch(function () {}).then(function () {
      authVer++; me = null; favs = []; orders = null; tab = 'orders'; renderHeader(); A().renderGrid(); A().go('shop'); A().toast('已登出');
    });
  }

  /* ---------- 收藏與結帳帶入 ---------- */
  function isFav(id) { return !!me && favs.indexOf(id) > -1; }
  function toggleFav(id) {
    if (!me) { pendingFav = id; A().toast('請先登入才能收藏'); return openAuth('login'); }
    var had = isFav(id);
    api('favs/' + id, { method: had ? 'DELETE' : 'PUT', body: {} }).then(function () {
      if (had) favs.splice(favs.indexOf(id), 1); else favs.push(id);
      A().renderGrid(); A().toast(had ? '已取消收藏' : '已加入收藏');
      if (!$('#view-member').hidden) renderCenter();
    }).catch(function (er) { A().toast(er.message); });
  }
  function prefill(form) {
    if (!me) return;
    ['org', 'name', 'phone', 'email', 'addr', 'taxid'].forEach(function (k) {
      var el = form.elements[k]; if (el && !el.value) el.value = me[k] || '';
    });
  }

  /* ---------- 會員中心 ---------- */
  function renderCenter() {
    if (!me) return;
    $('#mcName').textContent = (me.org ? me.org + '　' : '') + me.name;
    $('#mcMail').textContent = me.email + '　｜　加入於 ' + fmtDate(me.created);
    var tabs = [['orders', '訂單紀錄' + (orders ? ' (' + orders.length + ')' : '')], ['favs', '收藏清單 (' + favs.length + ')'], ['profile', '個人資料']];
    $('#mcTabs').innerHTML = tabs.map(function (t) { return '<button role="tab" aria-selected="' + (tab === t[0]) + '" data-mtab="' + t[0] + '">' + t[1] + '</button>'; }).join('');
    if (tab === 'orders') {
      if (orders) { $('#mcBody').innerHTML = ordersHtml(); return; }
      $('#mcBody').innerHTML = '<p class="muted">載入中…</p>';
      api('me/orders').then(function (d) { orders = d.orders; if (tab === 'orders') renderCenter(); })
        .catch(function (er) { $('#mcBody').innerHTML = '<p class="err">' + esc(er.message) + '</p>'; });
    } else $('#mcBody').innerHTML = tab === 'favs' ? favsHtml() : profileHtml();
  }
  var ST = { '待確認': 'wait', '已確認': 'wait', '已出貨': 'ship', '已完成': 'ok', '已取消': 'cancel' };
  function ordersHtml() {
    if (!orders.length) return '<div class="empty-cart">還沒有訂單<br><button class="btn" data-go="shop" style="margin-top:12px">去選購</button></div>';
    return orders.map(function (o) {
      return '<article class="ord"><div class="ord-top"><div><b>' + esc(o.no) + '</b><span class="muted"> ' + fmtDate(o.created) + '　' + esc(o.pay) + '</span></div><span class="st st-' + ST[o.status] + '">' + esc(o.status) + '</span></div>' +
        o.items.map(function (i) { return '<div class="sum-item"><span>' + esc(i.name) + ' × ' + i.qty + '</span><span>' + A().money(i.price * i.qty) + '</span></div>'; }).join('') +
        '<div class="ord-bot"><b>' + A().money(o.total) + '</b><button class="btn ghost" data-m="rebuy" data-id="' + esc(o.no) + '">再買一次</button></div></article>';
    }).join('');
  }
  function favsHtml() {
    var rows = favs.map(function (id) {
      var p = A().prod(id); if (!p) return '';
      return '<div class="line fav-line"><img src="' + esc(p.img) + '" alt="" width="72" height="72"><div><h4>' + esc(p.name) + '</h4><span class="price">' + A().money(p.price) + '</span></div>' +
        '<div class="fav-act">' + (p.soldOut ? '<span class="muted">已售完</span>' : '<button class="btn" data-m="addfav" data-id="' + id + '">加入購物車</button>') + '<button class="rm" data-m="unfav" data-id="' + id + '">取消收藏</button></div></div>';
    }).join('');
    return rows || '<div class="empty-cart">還沒有收藏商品<br>在商品卡片右上角按愛心就會收進來</div>';
  }
  function profileHtml() {
    return '<div class="prof-wrap"><form class="co-form" id="profForm" novalidate><fieldset><legend>基本資料</legend>' +
      '<label>Email（登入帳號）<input value="' + esc(me.email) + '" disabled></label>' +
      field('單位名稱', 'org', 'text', 'maxlength="80" value="' + esc(me.org) + '"') + field('聯絡人', 'name', 'text', 'maxlength="40" value="' + esc(me.name) + '"') +
      field('手機', 'phone', 'tel', 'value="' + esc(me.phone) + '"') + field('常用送貨地址', 'addr', 'text', 'maxlength="200" value="' + esc(me.addr) + '"') +
      field('統一編號（選填）', 'taxid', 'text', 'maxlength="8" value="' + esc(me.taxid) + '"') +
      '</fieldset><p class="err" id="profMsg" role="status" hidden></p><button class="btn" type="submit">儲存資料</button></form>' +
      '<form class="co-form" id="pwForm" novalidate><fieldset><legend>變更密碼</legend>' + field('目前密碼', 'old', 'password', 'autocomplete="current-password"') +
      field('新密碼（至少 8 碼，含英數）', 'pw', 'password', 'autocomplete="new-password"') +
      '</fieldset><p class="err" id="pwMsg" role="status" hidden></p><button class="btn ghost" type="submit">更新密碼</button></form></div>';
  }
  function msg(id, text, ok) { var e = $(id); e.hidden = false; e.textContent = text; e.style.color = ok ? 'var(--ok)' : '#c0392b'; }

  function memberForm(e) {
    e.preventDefault(); var f = e.target;
    if (f.id === 'profForm') {
      api('me', { method: 'PUT', body: { org: f.elements.org.value, name: f.elements.name.value, phone: f.elements.phone.value, addr: f.elements.addr.value, taxid: f.elements.taxid.value } })
        .then(function (d) { me = d.user; renderHeader(); renderCenter(); A().toast('資料已儲存'); }).catch(function (er) { msg('#profMsg', er.message); });
    } else if (f.id === 'pwForm') {
      api('me/password', { method: 'POST', body: { old: f.elements.old.value, password: f.elements.pw.value } })
        .then(function () { f.reset(); msg('#pwMsg', '密碼已更新', true); }).catch(function (er) { msg('#pwMsg', er.message); });
    }
  }
  function memberAction(act, id) {
    if (act === 'forgot') return authErr('請來信 gfeh@hunglun.com 或來電 06-6371192，由專人協助重設密碼。');
    if (act === 'addfav') A().addToCart(id, 1);
    else if (act === 'unfav') toggleFav(id);
    else if (act === 'rebuy') {
      var o = (orders || []).filter(function (x) { return x.no === id; })[0];
      if (o) { o.items.forEach(function (i) { if (A().prod(i.id)) A().addToCart(i.id, i.qty); }); A().openCart(true); }
    }
  }

  return { init: init, user: user, openAuth: openAuth, closeAuth: closeAuth, isFav: isFav, toggleFav: toggleFav, prefill: prefill, renderCenter: renderCenter, invalidate: function () { orders = null; } };
})();
