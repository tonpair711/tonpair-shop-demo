/* 內容頁：關於、常見問題、聯絡、配送付款、退換貨、隱私權、服務條款 */
window.Pages = (function () {
  var TEL = '06-6371192', MAIL = 'gfeh@hunglun.com';
  var BASE = '鴻綸科技教育商城';

  function faq(items) {
    return items.map(function (i) { return '<details><summary>' + i[0] + '</summary><p>' + i[1] + '</p></details>'; }).join('');
  }
  function doc(title, lead, body) { return '<h1>' + title + '</h1>' + (lead ? '<p class="lead">' + lead + '</p>' : '') + body; }

  var P = {
    about: ['關於鴻綸', function () {
      return doc('關於鴻綸科技', '鴻綸科技股份有限公司，2013 年創立於台南新營，專注教育與企業 IT 系統整合，是服務全台的教育科技公司。',
        '<h2>我們做什麼</h2><p>從 Chromebook 與智慧教室設備、ChromeOS 教育升級版 CEU 授權，到 Google Workspace for Education 導入、Google AI 校園研習與數位學習軟體代理，鴻綸科技協助學校把設備、授權與教師培訓一次接起來。</p>' +
        '<h2>官方資歷</h2><ul class="tick"><li>2017 年成為 Google 官方授權在台教育合作發展夥伴</li><li>2019 年取得專業化夥伴資格</li><li>2026 年取得高等教育（大學端）專業發展夥伴資格，名列 Google 官方全球名冊</li><li>設有官方認證國際講師培訓中心，具五位 Google 認證講師與兩位 Google 認證網域管理員</li><li>教育部國中小行動教育推動計畫指定廠商、台灣銀行共同供應契約供應商</li></ul>' +
        '<h2>公司資料</h2><table class="info"><tr><th>公司名稱</th><td>鴻綸科技股份有限公司（Hunglun Technology Co., Ltd.）</td></tr><tr><th>統一編號</th><td>54072037</td></tr><tr><th>地址</th><td>台南市新營區綠川路 10 號</td></tr><tr><th>電話／傳真</th><td>' + TEL + '／06-6371112</td></tr><tr><th>Email</th><td><a href="mailto:' + MAIL + '">' + MAIL + '</a></td></tr></table>' +
        '<p><a class="btn" href="https://www.hunglun.com/">前往鴻綸科技官網</a></p>');
    }],
    faq: ['常見問題', function () {
      return doc('常見問題', '採購、付款、交貨與售後的常見問題。找不到答案，請直接聯絡我們。',
        '<h2>採購與付款</h2>' + faq([
          ['學校可以用公文採購嗎？', '可以。結帳時選「公文採購」並填寫單位名稱與統一編號，我們會開立報價單與請款單，依貴單位流程辦理。'],
          ['可以開統一編號發票嗎？', '可以。請在結帳時填寫統一編號，我們會依訂單開立發票。'],
          ['有哪些付款方式？', '提供公文採購（請款單）與 ATM 轉帳。訂單確認後，我們會提供匯款資訊。'],
          ['優惠碼怎麼使用？', '在購物車側欄的「優惠碼」欄位輸入即可，每筆訂單可套用一組。']]) +
        '<h2>商品與交貨</h2>' + faq([
          ['可以先借 Chromebook 試用嗎？', '學校單位可免費借用 Chromebook 評估試用，請來電或來信預約。'],
          ['運費怎麼算？', '訂單折扣後滿 NT$30,000 免運費，未滿收取運費 NT$300。'],
          ['授權與研習類商品怎麼交付？', '授權類商品於訂單確認後開通並以 Email 通知；研習課程由專人與您排定日期與場地。'],
          ['Chromebook 有保固嗎？', '載具設備含 1 年保固，詳細條件依商品頁與原廠規定為準。']]) +
        '<h2>導入與售後</h2>' + faq([
          ['舊電腦可以改裝成 ChromeOS 嗎？', '可以。ChromeOS Flex 舊電腦升級服務讓既有 Windows 或 Mac 電腦不必換機，改裝後可搭配 CEU 授權統一納管。'],
          ['CEU 是一次買斷嗎？', '是。ChromeOS 教育升級版（CEU）一台一份，永久授權一次買斷。'],
          ['需要教師培訓怎麼辦？', '鴻綸科技有 Google 認證講師，可到校授課，內容涵蓋 Gemini 備課、AI 出題與評量、行政減負與 AI 素養。']]));
    }],
    contact: ['聯絡我們', function () {
      return doc('聯絡我們', '週一至週五 08:30–17:30，上班時間以電子郵件回覆，通常一個工作天內回覆。',
        '<div class="ct-grid"><div class="ct-cards">' +
        '<div class="ct-card"><b>電話</b><a href="tel:+88666371192">' + TEL + '</a></div>' +
        '<div class="ct-card"><b>Email</b><a href="mailto:' + MAIL + '">' + MAIL + '</a></div>' +
        '<div class="ct-card"><b>LINE 官方帳號</b>@gdm6961p（在 LINE 搜尋此 ID 加入）</div>' +
        '<div class="ct-card"><b>地址</b><a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('台南市新營區綠川路10號 鴻綸科技') + '" target="_blank" rel="noopener">台南市新營區綠川路 10 號</a></div></div>' +
        '<form class="co-form" id="ctForm" novalidate><fieldset><legend>來信詢問</legend>' +
        '<label>單位名稱<input name="org" autocomplete="organization"></label><label>聯絡人<input name="name" required autocomplete="name"></label>' +
        '<label>聯絡電話<input name="phone" inputmode="tel" autocomplete="tel"></label><label>Email<input name="email" type="email" autocomplete="email"></label>' +
        '<label>想詢問的內容<textarea name="msg" rows="5" required></textarea></label></fieldset>' +
        '<p class="err" id="ctErr" role="alert" hidden></p><button class="btn" type="submit">寄出詢問</button>' +
        '</form></div>');
    }],
    track: ['訂單查詢', function () {
      return doc('訂單查詢', '輸入訂單編號與下單時填寫的 Email，即可查看訂單狀態。會員也可以在會員中心查看所有訂單。',
        '<form class="co-form track-form" id="trackForm" novalidate><fieldset><legend>查詢訂單</legend><label>訂單編號<input name="no" required placeholder="HL261102-1234"></label><label>Email<input name="email" type="email" required></label></fieldset><button class="btn" type="submit">查詢</button></form><div id="trackOut" class="track-out"></div>');
    }],
    shipping: ['配送與付款', function () {
      return doc('配送與付款', '',
        '<h2>配送方式</h2><ul class="tick"><li>設備類商品以物流配送至指定地址，一般於訂單確認後安排出貨，實際交期依庫存與數量而定，由專人與您確認。</li><li>訂單折扣後滿 NT$30,000 免運費，未滿收取運費 NT$300。</li><li>授權、軟體與研習類商品不需配送，授權以 Email 通知開通，研習由專人排定日期。</li></ul>' +
        '<h2>付款方式</h2><ul class="tick"><li>公文採購：開立報價單與請款單，依貴單位核銷流程付款。</li><li>ATM 轉帳：訂單確認後提供匯款帳號，款項確認後出貨或開通。</li></ul>' +
        '<h2>發票</h2><p>結帳時填寫統一編號，即開立統一編號發票；未填寫則開立二聯式發票。</p>');
    }],
    returns: ['退換貨說明', function () {
      return doc('退換貨說明', '',
        '<h2>設備類商品</h2><p>收到商品時請當面檢查外箱與數量，如有破損、缺件或與訂單不符，請於收貨後 7 日內來電或來信告知，我們將協助換貨或處理。商品需保持全新、配件與包裝完整。</p>' +
        '<h2>授權、軟體與研習</h2><p>授權與軟體開通後，因屬數位服務，原則上無法退換；研習課程如需改期，請於預定日期 7 日前聯絡我們安排。</p>' +
        '<h2>保固</h2><p>載具設備含 1 年保固，依原廠保固條款辦理，保固期間的送修，請聯絡客服協助。</p>' +
        '<p>聯絡電話 ' + TEL + '，或來信 <a href="mailto:' + MAIL + '">' + MAIL + '</a>。</p>');
    }],
    privacy: ['隱私權政策', function () {
      return doc('隱私權政策', '鴻綸科技股份有限公司重視您的隱私，說明我們如何蒐集與使用您的個人資料。',
        '<h2>蒐集的資料</h2><p>當您註冊會員、下單或來信詢問時，我們會蒐集單位名稱、聯絡人、電話、Email、送貨地址與統一編號等資料。</p>' +
        '<h2>使用目的</h2><p>僅用於訂單處理、出貨與開通、開立發票、客戶服務與售後聯繫，不會出售或任意提供給第三方；因出貨或開立發票所需，才會提供給配送業者或相關服務單位。</p>' +
        '<h2>資料保存與您的權利</h2><p>您可以隨時於會員中心查詢與修改資料，也可以來信要求查閱、更正或刪除您的個人資料。</p>' +
        '<h2>聯絡我們</h2><p>對隱私權有任何疑問，請來信 <a href="mailto:' + MAIL + '">' + MAIL + '</a>。</p>');
    }],
    terms: ['服務條款', function () {
      return doc('服務條款', '使用鴻綸科技教育商城前，請先閱讀以下條款。',
        '<h2>訂單成立</h2><p>您送出訂單後，我們將與您確認品項、數量、價格與交期，經雙方確認後訂單才正式成立。商品價格與庫存以確認時為準。</p>' +
        '<h2>會員帳號</h2><p>請妥善保管您的登入密碼，帳號下的操作視為本人所為。如發現帳號遭冒用，請立即聯絡我們。</p>' +
        '<h2>智慧財產權</h2><p>本網站所有內容，包含文字、圖片與標誌，均屬鴻綸科技股份有限公司或原權利人所有，未經同意不得轉載或使用。</p>' +
        '<h2>條款修改</h2><p>我們可能隨時調整本條款，修改後的內容將公布於本頁。</p>');
    }]
  };

  function render(key) {
    var p = P[key] || P.about;
    document.getElementById('pageBody').innerHTML = p[1]();
    document.title = p[0] + '｜' + BASE;
    var f = document.getElementById('ctForm');
    if (f) f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (k) { return f.elements[k].value.trim(); }, err = document.getElementById('ctErr'), btn = f.querySelector('button[type=submit]');
      if (!v('name') || !v('msg')) { err.hidden = false; err.textContent = '請填寫聯絡人與想詢問的內容'; return; }
      if (!v('email') && !v('phone')) { err.hidden = false; err.textContent = '請至少留下 Email 或電話，方便我們回覆'; return; }
      err.hidden = true; btn.disabled = true;
      api('contact', { method: 'POST', body: { org: v('org'), name: v('name'), phone: v('phone'), email: v('email'), msg: v('msg') } }).then(function () {
        f.innerHTML = '<fieldset><legend>已收到您的詢問</legend><p>謝謝您的來信，我們會在上班時間盡快以電話或 Email 回覆您。</p></fieldset>';
      }).catch(function (er) { err.hidden = false; err.textContent = er.message; btn.disabled = false; });
    });
    var tf = document.getElementById('trackForm');
    if (tf) tf.addEventListener('submit', function (e) {
      e.preventDefault();
      var out = document.getElementById('trackOut'), btn = tf.querySelector('button[type=submit]');
      btn.disabled = true; out.innerHTML = '';
      api('orders/lookup', { method: 'POST', body: { no: tf.elements.no.value, email: tf.elements.email.value } }).then(function (d) {
        var o = d.order, money = ShopApp.money, esc = ShopApp.esc;
        out.innerHTML = '<article class="ord"><div class="ord-top"><div><b>' + esc(o.no) + '</b><span class="muted"> ' + fmtDate(o.created) + '　' + esc(o.pay) + '</span></div><span class="st st-' + ({ '待確認': 'wait', '已確認': 'wait', '已出貨': 'ship', '已完成': 'ok', '已取消': 'cancel' })[o.status] + '">' + esc(o.status) + '</span></div>' +
          o.items.map(function (i) { return '<div class="sum-item"><span>' + esc(i.name) + ' × ' + i.qty + '</span><span>' + money(i.price * i.qty) + '</span></div>'; }).join('') +
          '<div class="ord-bot"><b>' + money(o.total) + '</b><span class="muted">含運費 ' + money(o.ship) + '</span></div></article>';
      }).catch(function (er) { out.innerHTML = '<p class="err">' + ShopApp.esc(er.message) + '</p>'; }).then(function () { btn.disabled = false; });
    });
  }
  return { render: render, title: BASE };
})();
