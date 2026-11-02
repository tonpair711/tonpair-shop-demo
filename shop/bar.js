/* 官網每一頁的商城入口：表頭加「線上商城」、購物車（顯示件數）、會員；表尾加商城連結。
   購物車內容讀 localStorage（跟商城頁同一把 key），不打 API。 */
(function () {
  var KEY = 'hl-edu-shop-cart-v1';
  function count() {
    try { return (JSON.parse(localStorage.getItem(KEY)) || []).reduce(function (n, l) { return n + (l.qty || 0); }, 0); } catch (e) { return 0; }
  }
  var css = document.createElement('style');
  css.textContent =
    '.hl-tools{display:inline-flex;align-items:center;gap:6px;margin-left:8px}' +
    '.hl-tools a{position:relative;display:inline-flex;align-items:center;gap:4px;padding:6px 10px;border-radius:999px;color:inherit;text-decoration:none;font-size:.9rem;white-space:nowrap}' +
    '.hl-tools a:hover{background:rgba(30,58,95,.1)}' +
    '.hl-tools .hl-n{background:#1e3a5f;color:#fff;border-radius:999px;font-size:.72rem;line-height:1;padding:3px 6px;min-width:18px;text-align:center}' +
    '.hl-tools .hl-n[hidden]{display:none}' +
    '.header-visit-counter{display:none!important}' +
    '@media(max-width:900px){.hl-tools a span.hl-t{display:none}}';
  document.head.appendChild(css);

  var nav = document.querySelector('.main-nav');
  if (nav && !nav.querySelector('[data-hl-shop]')) {
    var a = document.createElement('a');
    a.href = '/shop/'; a.textContent = '線上商城'; a.setAttribute('data-hl-shop', '');
    nav.insertBefore(a, nav.firstChild);
  }
  var anchor = document.getElementById('themeToggle');
  if (anchor && !document.querySelector('.hl-tools')) {
    var box = document.createElement('div');
    box.className = 'hl-tools';
    box.innerHTML =
      '<a href="/shop/#cart" aria-label="購物車" title="購物車">🛒<b class="hl-n" id="hlCartN" hidden>0</b></a>' +
      '<a href="/shop/#member" aria-label="會員登入" title="會員登入">👤<span class="hl-t">會員</span></a>';
    anchor.parentNode.insertBefore(box, anchor);
  }
  function paint() {
    var n = count(), el = document.getElementById('hlCartN');
    if (!el) return;
    el.textContent = n > 99 ? '99+' : n; el.hidden = !n;
  }
  paint();
  window.addEventListener('storage', paint);
  window.addEventListener('pageshow', paint);

  var fl = document.querySelector('.footer-nav');
  if (fl && !fl.querySelector('[data-hl-shop]')) {
    var li = document.createElement('li');
    li.innerHTML = '<a href="/shop/" data-hl-shop>線上商城</a>';
    fl.insertBefore(li, fl.firstChild);
  }
  /* 商城頁自己的購物車變動也同步 */
  if (window.ShopApp) setInterval(paint, 1000);
})();
