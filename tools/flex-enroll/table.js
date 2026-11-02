// 表格、清冊、儀表板、執行記錄。build.js、results.js 都透過這裡的 FE 物件存取資料。
// 權杖與 Wi-Fi 密碼不寫進瀏覽器儲存、不放進匯出的清冊（機密只留在畫面上）。
const FE = (() => {
  const STORE = 'flexEnrollRows';
  const SECRET = ['token', 'pass'];
  const STATUS = ['待處理', '模擬通過', '已開始轉換', '已註冊完成', '模擬失敗', '轉換失敗', '無法判斷'];
  const OK = ['模擬通過', '已開始轉換', '已註冊完成'];
  const BAD = ['模擬失敗', '轉換失敗', '無法判斷'];
  // 清冊欄位：匯出與匯入用同一組標題，匯出的檔案可以直接改完再匯入
  const COLS = [['name', '電腦名稱'], ['room', '教室／位置'], ['model', '型號'], ['serial', '序號'], ['net', '網路'],
                ['ssid', 'Wi-Fi 名稱'], ['status', '狀態'], ['note', '說明'], ['token', '註冊權杖'], ['pass', 'Wi-Fi 密碼']];
  const $ = (id) => document.getElementById(id);
  let rows = [];

  const blank = () => ({ name: '', room: '', model: '', serial: '', token: '', net: 'wifi', ssid: '', pass: '', status: '待處理', note: '' });

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(rows.map((r) => ({ ...r, token: '', pass: '' })))); } catch (e) {}
  }
  function load() {
    try { rows = (JSON.parse(localStorage.getItem(STORE) || '[]') || []).map((r) => ({ ...blank(), ...r })); } catch (e) { rows = []; }
    if (!rows.length) rows = Array.from({ length: 5 }, blank);
  }

  function log(text, kind) {
    const el = $('log'), line = document.createElement('div');
    const t = new Date().toLocaleTimeString('zh-TW', { hour12: false, timeZone: 'Asia/Taipei' });
    line.textContent = '[' + t + '] ' + text;
    if (kind) line.className = kind;
    el.appendChild(line); el.scrollTop = el.scrollHeight;
  }

  function statusClass(s) { return OK.includes(s) ? 'st-ok' : BAD.includes(s) ? 'st-bad' : s === '待處理' ? '' : 'st-run'; }

  // 每格都要有報讀名稱（「第 3 台 序號」）：表格欄位沒有 <label>，螢幕報讀軟體只會念「編輯文字」（2026-10-29 axe）
  const NAME = Object.fromEntries(COLS);
  const lab = (i, key) => ' aria-label="第 ' + (i + 1) + ' 台 ' + NAME[key] + '"';

  function cell(i, key, type) {
    const r = rows[i];
    if (key === 'net') {
      return '<select data-i="' + i + '" data-k="net"' + lab(i, 'net') + '><option value="wifi"' + (r.net === 'wifi' ? ' selected' : '') + '>Wi-Fi</option>' +
             '<option value="lan"' + (r.net === 'lan' ? ' selected' : '') + '>網路線</option></select>';
    }
    if (key === 'status') {
      return '<select class="' + statusClass(r.status) + '" data-i="' + i + '" data-k="status"' + lab(i, 'status') + '>' +
             STATUS.map((s) => '<option' + (s === r.status ? ' selected' : '') + '>' + s + '</option>').join('') + '</select>';
    }
    const off = r.net === 'lan' && (key === 'ssid' || key === 'pass') ? ' disabled placeholder="（網路線不用）"' : '';
    return '<input type="' + (type || 'text') + '" data-i="' + i + '" data-k="' + key + '" spellcheck="false"' + lab(i, key) + ' value="' + esc(r[key]) + '"' + off + '>';
  }
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  function render() {
    $('rows').innerHTML = rows.map((r, i) => '<tr>' +
      '<td class="num">' + (i + 1) + '</td>' +
      ['name', 'room', 'model', 'serial', 'token', 'net', 'ssid'].map((k) => '<td>' + cell(i, k) + '</td>').join('') +
      '<td>' + cell(i, 'pass', 'password') + '</td><td>' + cell(i, 'status') + '</td>' +
      '<td class="note" title="' + esc(r.note) + '"><div>' + esc(r.note) + '</div></td>' +
      '<td class="del"><button data-del="' + i + '" title="刪除這列">✕</button></td></tr>').join('');
    counts(); save();
  }

  function counts() {
    const used = rows.filter((r) => r.name.trim());
    $('cTotal').textContent = used.length;
    $('cOk').textContent = used.filter((r) => OK.includes(r.status)).length;
    $('cBad').textContent = used.filter((r) => BAD.includes(r.status)).length;
    $('cWait').textContent = used.filter((r) => r.status === '待處理').length;
  }

  // 「填滿」：拿第一個有填的值套用到每一列，跟零接觸工具的用法一樣
  function fill(key) {
    const src = rows.find((r) => String(r[key]).trim());
    if (!src) return log('「' + key + '」這欄還沒有任何一列填值，先在第一列填好再按填滿。', 'warn');
    rows.forEach((r) => { r[key] = src[key]; });
    render(); log('已把「' + src[key].toString().replace(/./g, (c, i) => (SECRET.includes(key) && i > 3 ? '*' : c)) + '」填滿到 ' + rows.length + ' 列。');
  }

  // 自訂確認框（不用瀏覽器內建 confirm）
  function askConfirm(title, text) {
    return new Promise((done) => {
      $('mTitle').textContent = title; $('mText').textContent = text; $('modal').classList.add('on');
      const close = (v) => { $('modal').classList.remove('on'); $('mYes').onclick = $('mNo').onclick = null; done(v); };
      $('mYes').onclick = () => close(true); $('mNo').onclick = () => close(false);
    });
  }

  function exportXlsx(list, withSecrets) {
    const cols = COLS.filter(([k]) => withSecrets || !SECRET.includes(k));
    const data = [cols.map(([, h]) => h)].concat(list.map((r) => cols.map(([k]) => (k === 'net' ? (r.net === 'lan' ? '網路線' : 'Wi-Fi') : r[k]))));
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = cols.map(([k]) => ({ wch: k === 'note' ? 50 : k === 'token' ? 30 : 16 }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Flex 清冊');
    return wb;
  }

  function importXlsx(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wb = XLSX.read(reader.result, { type: 'array' });
        const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
        const head = (aoa[0] || []).map((h) => String(h).trim());
        const idx = Object.fromEntries(COLS.map(([k, h]) => [k, head.indexOf(h)]));
        if (idx.name < 0) return log('匯入失敗：第一列要有「電腦名稱」這個標題（可以先按「匯出清冊」拿範本）。', 'err');
        const got = aoa.slice(1).filter((a) => String(a[idx.name]).trim()).map((a) => {
          const r = blank();
          COLS.forEach(([k]) => { if (idx[k] >= 0 && String(a[idx[k]]).trim() !== '') r[k] = String(a[idx[k]]).trim(); });
          r.net = /線|lan/i.test(r.net) ? 'lan' : 'wifi';
          if (!STATUS.includes(r.status)) r.status = '待處理';
          return r;
        });
        rows = rows.filter((r) => r.name.trim()).concat(got);
        render(); log('已匯入 ' + got.length + ' 台。', 'ok');
      } catch (e) { log('匯入失敗：' + e.message, 'err'); }
    };
    reader.readAsArrayBuffer(file);
  }

  function bind() {
    $('rows').addEventListener('input', (e) => {
      const { i, k } = e.target.dataset; if (i === undefined) return;
      rows[i][k] = e.target.value;
      if (k === 'net' || k === 'status') render(); else { counts(); save(); }
    });
    $('rows').addEventListener('click', async (e) => {
      const i = e.target.dataset.del; if (i === undefined) return;
      const r = rows[i];
      if (r.name.trim() && !(await askConfirm('刪除這一列？', '第 ' + (+i + 1) + ' 列「' + r.name + '」'))) return;
      rows.splice(i, 1); if (!rows.length) rows.push(blank()); render();
    });
    document.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
      for (let n = 0; n < +b.dataset.add; n++) rows.push(blank());
      render(); log('新增 ' + b.dataset.add + ' 列，共 ' + rows.length + ' 列。');
    }));
    document.querySelectorAll('[data-fill]').forEach((b) => b.addEventListener('click', () => fill(b.dataset.fill)));
    $('btnClear').addEventListener('click', async () => {
      if (!(await askConfirm('清空整張表？', '所有列和狀態都會刪掉，無法復原。\n要留紀錄請先按「匯出清冊」。'))) return;
      rows = Array.from({ length: 5 }, blank); render(); log('已清空。', 'warn');
    });
    $('btnImport').addEventListener('click', () => $('fileImport').click());
    $('fileImport').addEventListener('change', (e) => { if (e.target.files[0]) importXlsx(e.target.files[0]); e.target.value = ''; });
    $('btnExport').addEventListener('click', () => {
      const list = rows.filter((r) => r.name.trim());
      if (!list.length) return log('表格是空的，沒有東西可以匯出。', 'warn');
      XLSX.writeFile(exportXlsx(list, false), 'Flex清冊-' + FE.today() + '.xlsx');
      log('已匯出清冊（不含權杖與 Wi-Fi 密碼）。', 'ok');
    });
  }

  const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }).replace(/-/g, '');

  load(); render(); bind();
  log('系統準備就緒。一列一台電腦，填好後按「產生全部一鍵轉換檔」。');
  return { get rows() { return rows; }, render, log, askConfirm, exportXlsx, blank, today, STATUS };
})();
