// 產生全部一鍵轉換檔：每台一個資料夾（模擬、正式、清出C槽空間三個 bat），外加清冊與說明。
// 模板是官網上的最新版（intune-flex-deploy/build_site_page.py 從正本複製到 /tools/downloads/tpl/），
// 只換設定那四行，其他一個字不動；換不到就整批停下，不產生半成品。
(() => {
  const psq = (s) => s.replace(/'/g, "''");   // PowerShell 單引號字串裡，單引號寫成兩個

  function setLine(text, name, value) {
    const re = new RegExp('^\\$' + name + " = ('[^\\r\\n]*'|\\$true|\\$false)\\r?$", 'm');
    if (!re.test(text)) throw new Error('模板格式變了（找不到 $' + name + ' 那一行），請聯絡技術人員。');
    return text.replace(re, () => '$' + name + ' = ' + value + '\r');   // 用函式回傳，密碼裡有 $& 也不會被當特殊符號
  }

  async function getText(url) {
    const r = await fetch(url + '?v=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('讀不到模板（' + r.status + '），請重新整理頁面，或重新登入。');
    // git 存檔會把換行改成 LF（2026-10-07 線上實測），cmd 讀 LF 的 bat 可能解析錯，一律換回 CRLF
    return (await r.text()).replace(/\r?\n/g, '\r\n');
  }

  // 每列的錯誤訊息；全部沒問題才產生
  function check(list) {
    const errs = [], seen = {};
    list.forEach((r) => {
      const n = r.name.trim(), at = '「' + n + '」';
      if (/[\\/:*?"<>|]/.test(n)) errs.push(at + '電腦名稱不能有 \\ / : * ? " < > |');
      if (seen[n.toLowerCase()]) errs.push(at + '電腦名稱重複'); seen[n.toLowerCase()] = 1;
      const t = r.token.trim();
      if (!t) errs.push(at + '沒有填註冊權杖');
      else if (/\s|'/.test(t) || t.length < 10) errs.push(at + '權杖格式不對（不能有空白或單引號，也不該這麼短）');
      if (r.net === 'wifi') {
        if (!r.ssid.trim()) errs.push(at + '沒有填 Wi-Fi 名稱（插網路線請改選「網路線」）');
        if (r.pass.length < 8 || r.pass.length > 63) errs.push(at + 'Wi-Fi 密碼要 8～63 個字');
      }
    });
    return errs;
  }

  function batsFor(r, convert) {
    let base = setLine(convert, 'ENROLLMENT_TOKEN', "'" + psq(r.token.trim()) + "'");
    // 網路線：Wi-Fi 兩行留空，一鍵轉換檔會自動寫官方的有線網路設定
    base = setLine(base, 'WIFI_SSID', "'" + (r.net === 'wifi' ? psq(r.ssid) : '') + "'");
    base = setLine(base, 'WIFI_PASSWORD', "'" + (r.net === 'wifi' ? psq(r.pass) : '') + "'");
    return { sim: setLine(base, 'ONLY_TEST', '$true'), real: setLine(base, 'ONLY_TEST', '$false') };
  }

  const README = [
    'Flex 權杖版一鍵轉換檔（一台一個資料夾）',
    '',
    '每台電腦：',
    '1. 先準備整包（https://www.hunglun.com/tools/downloads/ 下載一次即可），解壓縮得到 flex 資料夾',
    '2. 把這台資料夾裡的三個 bat 複製到 flex 資料夾，取代舊的（frd-latest.zip、vector.zip 要在同一個資料夾）',
    '3. 空間不夠先跑「清出C槽空間.bat」',
    '4. 跑「一鍵轉換Flex-模擬.bat」，看到「官方檢查項目通過 5/5」',
    '5. 跑「一鍵轉換Flex-正式.bat」，轉完會自動註冊到學校網域',
    '6. 桌面的「Flex結果-電腦名稱-時間.zip」收回來，拖進 Flex 大量部署系統更新狀態',
    '',
    '注意：bat 裡有註冊權杖和 Wi-Fi 密碼（明文），只交給要操作的人。',
  ].join('\r\n') + '\r\n';

  async function buildAll() {
    const list = FE.rows.filter((r) => r.name.trim());
    if (!list.length) return FE.log('表格裡還沒有電腦，先填電腦名稱。', 'warn');
    const errs = check(list);
    if (errs.length) { errs.forEach((e) => FE.log(e, 'err')); return FE.log('有 ' + errs.length + ' 個問題，修好再按一次。', 'err'); }

    const btn = document.getElementById('btnBuild'); btn.disabled = true;
    try {
      FE.log('讀取最新版模板...');
      const [convert, space] = await Promise.all([getText('/tools/downloads/tpl/flex-convert.bat'), getText('/tools/downloads/tpl/free-space.bat')]);
      const zip = new JSZip();
      list.forEach((r) => {
        const b = batsFor(r, convert), dir = zip.folder(r.name.trim());
        dir.file('一鍵轉換Flex-模擬.bat', b.sim);
        dir.file('一鍵轉換Flex-正式.bat', b.real);
        dir.file('清出C槽空間.bat', space);
      });
      zip.file('請先讀我.txt', README);
      zip.file('Flex清冊.xlsx', XLSX.write(FE.exportXlsx(list, false), { type: 'array', bookType: 'xlsx' }));
      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'flex-enroll-' + FE.today() + '-' + list.length + '台.zip';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      FE.log('已產生 ' + list.length + ' 台的一鍵轉換檔：' + a.download, 'ok');
    } catch (e) {
      FE.log(e.message, 'err');
    } finally { btn.disabled = false; }
  }

  document.getElementById('btnBuild').addEventListener('click', buildAll);
})();
