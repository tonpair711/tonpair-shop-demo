/* 商店主程式：商品列表、購物車、結帳、頁面切換。資料一律來自 /api（價格以伺服端為準） */
(function () {
  var S = { name: '', freeShipping: 30000, shippingFee: 300, products: [], categories: ['全部'], notice: '' };
  var $ = function (s) { return document.querySelector(s); };
  var KEY = 'hl-edu-shop-cart-v1';
  var state = { cat: '全部', q: '', sort: 'def', cart: load(), coupon: null, modalId: null, modalQty: 1, busy: false };

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state.cart)); } catch (e) {} }
  function money(n) { return 'NT$' + Math.round(n).toLocaleString('en-US'); }
  function prod(id) { return S.products.filter(function (p) { return p.id === id; })[0]; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function maxQty(p) { return p.stock == null ? 99 : Math.max(0, Math.min(99, p.stock)); }
  function cartItems() { return state.cart.map(function (l) { return { id: l.id, qty: l.qty }; }); }

  /* ---------- 金額（顯示用，下單時伺服端會重算） ---------- */
  function totals() {
    var sub = 0, count = 0;
    state.cart.forEach(function (l) { var p = prod(l.id); if (p) { sub += p.price * l.qty; count += l.qty; } });
    var disc = 0, c = state.coupon;
    if (c && sub >= (c.minAmount || 0)) disc = c.type === 'percent' ? Math.round(sub * c.value / 100) : Math.min(c.value, sub);
    var after = sub - disc;
    var ship = count === 0 ? 0 : (after >= S.freeShipping ? 0 : S.shippingFee);
    return { sub: sub, count: count, disc: disc, ship: ship, total: after + ship, after: after };
  }

  /* ---------- 商品列表 ---------- */
  function renderTabs() {
    $('#tabs').innerHTML = S.categories.map(function (c) {
      return '<button role="tab" aria-selected="' + (c === state.cat) + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>';
    }).join('');
  }
  function favBtn(id) {
    var on = window.Member && Member.isFav(id);
    return '<button class="fav" data-fav="' + id + '" aria-pressed="' + !!on + '" aria-label="' + (on ? '取消收藏' : '加入收藏') + '">' + (on ? '♥' : '♡') + '</button>';
  }
  function renderGrid() {
    var q = state.q.trim().toLowerCase();
    var list = S.products.filter(function (p) {
      return (state.cat === '全部' || p.cat === state.cat) && (!q || (p.name + p.cat + p.desc).toLowerCase().indexOf(q) > -1);
    });
    if (state.sort === 'low') list.sort(function (a, b) { return a.price - b.price; });
    if (state.sort === 'high') list.sort(function (a, b) { return b.price - a.price; });
    $('#grid').innerHTML = list.map(function (p) {
      return '<article class="card">' + favBtn(p.id) + '<button class="pic" data-open="' + p.id + '" aria-label="查看 ' + esc(p.name) + '">' +
        '<img loading="lazy" src="' + esc(p.img) + '" alt="' + esc(p.name) + '" width="300" height="300">' +
        (p.soldOut ? '<span class="badge sold">已售完</span>' : (p.tag ? '<span class="badge">' + esc(p.tag) + '</span>' : '')) + '</button>' +
        '<div class="body"><p class="cat">' + esc(p.cat) + '</p><h3>' + esc(p.name) + '</h3>' +
        '<p class="price">' + money(p.price) + (p.oldPrice ? '<s>' + money(p.oldPrice) + '</s>' : '') + '</p>' +
        (p.stock != null && p.stock > 0 && p.stock <= 5 ? '<p class="low">僅剩 ' + p.stock + ' 件</p>' : '') +
        (p.soldOut ? '<button class="btn" disabled>已售完</button>' : '<button class="btn" data-add="' + p.id + '">加入購物車</button>') + '</div></article>';
    }).join('');
    $('#empty').hidden = list.length > 0 || !S.products.length;
  }

  /* ---------- 購物車 ---------- */
  function addToCart(id, qty) {
    var p = prod(id); if (!p || p.soldOut) return;
    var l = state.cart.filter(function (x) { return x.id === id; })[0], cap = maxQty(p), had = l ? l.qty : 0;
    var next = Math.min(cap, had + qty);
    if (l) l.qty = next; else state.cart.push({ id: id, qty: next });
    toast(next === had ? '已達庫存上限' : '已加入購物車：' + p.name);
    save(); renderCart();
  }
  function renderCart() {
    var t = totals();
    $('#cartCount').textContent = t.count;
    if (!state.cart.length) {
      $('#dBody').innerHTML = '<div class="empty-cart">購物車還是空的<br>去挑幾樣喜歡的吧</div>';
      $('#dFoot').innerHTML = '<button class="btn wide ghost" data-close>繼續購物</button>';
      return;
    }
    $('#dBody').innerHTML = state.cart.map(function (l) {
      var p = prod(l.id);
      return '<div class="line"><img src="' + esc(p.img) + '" alt="" width="72" height="72"><div><h4>' + esc(p.name) + '</h4>' +
        '<div class="qty"><button data-dec="' + p.id + '" aria-label="減少">−</button><span>' + l.qty + '</span><button data-inc="' + p.id + '" aria-label="增加">+</button></div>' +
        '<button class="rm" data-rm="' + p.id + '">移除</button></div><b>' + money(p.price * l.qty) + '</b></div>';
    }).join('');
    var need = S.freeShipping - t.after;
    var hint = need > 0
      ? '再買 ' + money(need) + ' 就免運<div class="bar"><i style="width:' + Math.min(100, t.after / S.freeShipping * 100) + '%"></i></div>'
      : '已達免運門檻';
    var cp = state.coupon;
    $('#dFoot').innerHTML = '<div class="ship-hint">' + hint + '</div>' +
      '<form class="coupon" id="cpForm"><input id="cpIn" placeholder="優惠碼" value="' + esc(cp ? cp.code : '') + '" aria-label="優惠碼"><button>' + (cp ? '更換' : '套用') + '</button></form>' +
      '<div class="row"><span>小計</span><span>' + money(t.sub) + '</span></div>' +
      (cp && t.disc ? '<div class="row"><span>優惠：' + esc(cp.label) + '</span><span>-' + money(t.disc) + '</span></div>' : '') +
      (cp && !t.disc ? '<div class="row"><span class="muted">「' + esc(cp.label) + '」需消費滿 ' + money(cp.minAmount) + '</span><span></span></div>' : '') +
      '<div class="row"><span>運費</span><span>' + (t.ship ? money(t.ship) : '免運') + '</span></div>' +
      '<div class="row total"><span>合計</span><span>' + money(t.total) + '</span></div>' +
      '<button class="btn wide" data-go="checkout">前往結帳</button>';
  }
  function setQty(id, d) {
    var l = state.cart.filter(function (x) { return x.id === id; })[0], p = prod(id);
    if (!l || !p) return;
    l.qty = Math.min(maxQty(p), l.qty + d);
    if (l.qty <= 0) state.cart = state.cart.filter(function (x) { return x.id !== id; });
    save(); renderCart(); if (!$('#view-checkout').hidden) renderCheckout();
  }
  function openCart(on) {
    $('#drawer').hidden = !on; $('#mask').hidden = !on;
    document.body.style.overflow = on ? 'hidden' : '';
  }

  /* ---------- 商品彈窗 ---------- */
  function openModal(id) {
    var p = prod(id); if (!p) return; state.modalId = id; state.modalQty = 1;
    $('#mImg').src = p.img; $('#mImg').alt = p.name;
    $('#mCat').textContent = p.cat; $('#mTitle').textContent = p.name;
    $('#mPrice').innerHTML = money(p.price) + (p.oldPrice ? '<s>' + money(p.oldPrice) + '</s>' : '');
    $('#mDesc').textContent = p.desc; $('#mSpec').textContent = p.spec; $('#mQty').textContent = 1;
    $('#mAdd').disabled = !!p.soldOut; $('#mAdd').textContent = p.soldOut ? '已售完' : '加入購物車';
    $('#modal').hidden = false; document.body.style.overflow = 'hidden';
  }
  function closeModal() { $('#modal').hidden = true; document.body.style.overflow = ''; }

  /* ---------- 頁面切換 ---------- */
  function go(view) {
    if (view === 'member' && !Member.user()) { openCart(false); closeModal(); return Member.openAuth('login', 'member'); }
    var page = view.indexOf('p-') === 0 ? view.slice(2) : null, vid = page ? 'page' : view;
    ['shop', 'checkout', 'done', 'member', 'page'].forEach(function (v) { $('#view-' + v).hidden = v !== vid; });
    if (!page) document.title = Pages.title + '｜Chromebook、CEU 授權、Google AI 校園研習';
    if (page) Pages.render(page);
    openCart(false); closeModal(); Member.closeAuth();
    if (view === 'checkout') { if (!state.cart.length) return go('shop'); renderCheckout(); }
    if (view === 'member') Member.renderCenter();
    window.scrollTo(0, 0);
  }
  function summaryHtml(o, title) {
    return '<h3>' + title + '</h3>' + o.items.map(function (i) {
      return '<div class="sum-item"><span>' + esc(i.name) + ' × ' + i.qty + '</span><span>' + money(i.price * i.qty) + '</span></div>';
    }).join('') + '<hr style="border:0;border-top:1px solid var(--line)">' +
      '<div class="row"><span>小計</span><span>' + money(o.sub) + '</span></div>' +
      (o.disc ? '<div class="row"><span>優惠' + (o.label ? '：' + esc(o.label) : '') + '</span><span>-' + money(o.disc) + '</span></div>' : '') +
      '<div class="row"><span>運費</span><span>' + (o.ship ? money(o.ship) : '免運') + '</span></div>' +
      '<div class="row total"><span>應付金額</span><span>' + money(o.total) + '</span></div>';
  }
  function renderCheckout() {
    var t = totals();
    $('#coSummary').innerHTML = summaryHtml({ items: state.cart.map(function (l) { var p = prod(l.id); return { name: p.name, price: p.price, qty: l.qty }; }),
      sub: t.sub, disc: t.disc, ship: t.ship, total: t.total, label: state.coupon && state.coupon.label }, '訂單明細');
    Member.prefill($('#coForm'));
    $('#coLogin').hidden = !!Member.user();
  }

  function submitOrder(e) {
    e.preventDefault();
    if (state.busy) return;
    var f = e.target, bad = [], err = $('#coErr');
    ['org', 'name', 'phone', 'email', 'addr'].forEach(function (k) {
      var el = f.elements[k], v = el.value.trim(), ok = !!v;
      if (k === 'phone') ok = /^(09\d{8}|0\d{1,2}-?\d{6,8})$/.test(v.replace(/\s/g, ''));
      if (k === 'email') ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
      el.classList.toggle('bad', !ok); if (!ok) bad.push(el.labels[0].firstChild.textContent);
    });
    var tax = f.elements.taxid.value.trim();
    if (tax && !/^\d{8}$/.test(tax)) bad.push('統一編號（8 碼數字）');
    if (bad.length) { err.hidden = false; err.textContent = '請檢查：' + bad.join('、'); return; }
    err.hidden = true;
    var btn = f.querySelector('button[type=submit]'); state.busy = true; btn.disabled = true; btn.textContent = '送出中…';
    var label = state.coupon && state.coupon.label;
    api('orders', { method: 'POST', body: {
      items: cartItems(), coupon: state.coupon ? state.coupon.code : '', pay: f.elements.pay.value, note: f.elements.note.value.trim(),
      info: { org: f.elements.org.value.trim(), name: f.elements.name.value.trim(), phone: f.elements.phone.value.trim(), email: f.elements.email.value.trim(), addr: f.elements.addr.value.trim(), taxid: tax }
    } }).then(function (res) {
      var o = res.order;
      $('#orderNo').textContent = o.no;
      $('#doneInfo').textContent = o.info.org + ' ' + o.info.name + ' 您好，我們已收到您的訂單，會盡快與您確認品項、數量與交期，聯絡 Email：' + o.info.email + '。';
      $('#doneBank').innerHTML = res.bankInfo ? '<h3>匯款資訊</h3><p>' + esc(res.bankInfo).replace(/\n/g, '<br>') + '</p>' : (o.pay === 'ATM 轉帳' ? '<p class="muted">訂單確認後，我們會提供匯款帳號。</p>' : '');
      $('#doneSummary').innerHTML = summaryHtml({ items: o.items, sub: o.sub, disc: o.disc, ship: o.ship, total: o.total, label: label }, '訂單內容');
      state.cart = []; state.coupon = null; save(); renderCart(); f.reset(); Member.invalidate();
      go('done'); refreshProducts();
    }).catch(function (er) {
      err.hidden = false; err.textContent = er.message;
      if (er.status === 409 || er.status === 400) refreshProducts();
    }).then(function () { state.busy = false; btn.disabled = false; btn.textContent = '送出訂單'; });
  }

  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }

  /* ---------- 載入商品 ---------- */
  function refreshProducts() {
    return api('shop').then(function (d) {
      S.name = d.settings.name; S.freeShipping = d.settings.freeShipping; S.shippingFee = d.settings.shippingFee; S.notice = d.settings.notice;
      S.products = d.products; S.categories = d.categories;
      if (S.categories.indexOf(state.cat) < 0) state.cat = '全部';
      // 已下架或售完的商品從購物車移除，數量超過庫存的調降
      state.cart = state.cart.filter(function (l) { var p = prod(l.id); return p && !p.soldOut; });
      state.cart.forEach(function (l) { l.qty = Math.max(1, Math.min(l.qty, maxQty(prod(l.id)))); });
      save(); renderTabs(); renderGrid(); renderCart();
      var nb = $('#notice'); nb.hidden = !S.notice; nb.textContent = S.notice;
    });
  }

  /* ---------- 事件 ---------- */
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-fav]')) { Member.toggleFav(e.target.closest('[data-fav]').dataset.fav); return; }
    var el = e.target.closest('[data-cat],[data-open],[data-add],[data-inc],[data-dec],[data-rm],[data-go],[data-close]');
    if (!el) return;
    var d = el.dataset;
    if (d.cat) { state.cat = d.cat; renderTabs(); renderGrid(); }
    else if (d.open) openModal(d.open);
    else if (d.add) addToCart(d.add, 1);
    else if (d.inc) setQty(d.inc, 1);
    else if (d.dec) setQty(d.dec, -1);
    else if (d.rm) setQty(d.rm, -99);
    else if (d.go) { e.preventDefault(); go(d.go); }
    else if ('close' in d) { closeModal(); openCart(false); }
  });
  $('#openCart').onclick = function () { openCart(true); };
  $('#mask').onclick = function () { openCart(false); };
  $('#modal').onclick = function (e) { if (e.target.id === 'modal') closeModal(); };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeModal(); openCart(false); } });
  $('#mMinus').onclick = function () { state.modalQty = Math.max(1, state.modalQty - 1); $('#mQty').textContent = state.modalQty; };
  $('#mPlus').onclick = function () { var p = prod(state.modalId); state.modalQty = Math.min(maxQty(p) || 1, state.modalQty + 1); $('#mQty').textContent = state.modalQty; };
  $('#mAdd').onclick = function () { addToCart(state.modalId, state.modalQty); closeModal(); openCart(true); };
  $('#q').oninput = function (e) { state.q = e.target.value; renderGrid(); };
  $('#sort').onchange = function (e) { state.sort = e.target.value; renderGrid(); };
  $('#coForm').addEventListener('submit', submitOrder);
  document.addEventListener('submit', function (e) {
    if (e.target.id !== 'cpForm') return;
    e.preventDefault();
    var code = $('#cpIn').value.trim().toUpperCase();
    if (!code) { state.coupon = null; renderCart(); return; }
    api('coupon', { method: 'POST', body: { code: code, items: cartItems() } }).then(function (r) {
      state.coupon = { code: r.code, label: r.label, type: r.type, value: r.value, minAmount: r.minAmount };
      renderCart(); toast('已套用優惠碼 ' + r.code);
    }).catch(function (er) { toast(er.message); });
  });

  window.ShopApp = { go: go, toast: toast, money: money, prod: prod, esc: esc, addToCart: addToCart, renderGrid: renderGrid, openCart: openCart, refresh: refreshProducts };
  /* 從官網其他頁面連過來：/shop/#cart 開購物車、#member 會員中心、#track 訂單查詢 */
  function fromHash() {
    var h = (location.hash || '').slice(1);
    if (h === 'cart') openCart(true);
    else if (h === 'member') go('member');
    else if (h === 'track' || h === 'faq' || h === 'shipping' || h === 'returns' || h === 'privacy' || h === 'terms' || h === 'about') go('p-' + h);
  }
  window.addEventListener('hashchange', fromHash);
  Promise.all([Member.init(), refreshProducts()]).then(function () { renderGrid(); renderCart(); fromHash(); }).catch(function (er) {
    $('#grid').innerHTML = '<p class="empty">商品載入失敗：' + esc(er.message) + '</p>';
  });
})();
