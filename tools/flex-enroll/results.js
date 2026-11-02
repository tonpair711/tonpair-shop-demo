// 匯入各台傳回的「Flex結果-電腦名稱-月日-時分.zip」，讀出狀態寫回表格。
// zip 裡：convert-log.txt（畫面記錄，UTF-8 含 BOM）、agent-dryrun.log（FRD 模擬記錄）、cert-check.log（認證清單比對）。
// 2026-10-07 以前的一鍵轉換檔只看檢查名稱、會把空間不足誤判成 5/5，所以一律再看 agent-dryrun.log 有沒有 ERROR。
(() => {
  const NAME_RE = /Flex結果-(.+)-\d{4}-\d{4}\.zip$/i;

  async function readText(zip, name) {
    const f = Object.values(zip.files).find((x) => x.name.split('/').pop().toLowerCase() === name.toLowerCase());
    if (!f) return '';
    const b = await f.async('uint8array');
    const utf16 = b[0] === 0xff && b[1] === 0xfe;
    return new TextDecoder(utf16 ? 'utf-16le' : 'utf-8').decode(b).replace(/^\uFEFF/, '');
  }

  // 回傳 { status, note, model }
  function judge(conv, dry, cert) {
    const stop = (conv.match(/\[停止\]\s*(.+)/) || [])[1];
    const model = ((conv.match(/型號：(.+)/) || [])[1] || '').trim();
    const passed = (conv.match(/官方檢查項目(?:通過|完成)\s*(\d)\/5/) || [])[1];
    const dryBad = /level=ERROR|failed checks/.test(dry);
    const disk = dry.match(/insufficient disk space.*?spaceIfWeShrink=(\d+).*?spaceRequired=(\d+)/);
    const certLine = cert.split(/\r?\n/).find((l) => l.trim()) || '';
    let status, note;
    if (/轉換已經開始/.test(conv)) { status = '已開始轉換'; note = '已觸發轉換，等那台開機到 Flex 歡迎畫面'; }
    else if (stop) { status = /正式執行前/.test(stop) ? '轉換失敗' : '模擬失敗'; note = stop.trim(); }
    else if (dryBad) {
      status = '模擬失敗';
      note = disk ? 'C 槽只能縮出 ' + (disk[1] / 2 ** 30).toFixed(1) + ' GB，需要 ' + (disk[2] / 2 ** 30).toFixed(1) + ' GB，先跑清出C槽空間.bat'
                  : '模擬記錄裡有錯誤（舊版一鍵轉換檔可能誤判通過），看 agent-dryrun.log';
    }
    else if (/模擬測試完成/.test(conv)) { status = '模擬通過'; note = '官方檢查 ' + (passed || '?') + '/5'; }
    else { status = '無法判斷'; note = '結果檔裡沒有完整記錄，請看 convert-log.txt'; }
    if (certLine) note += '｜' + certLine.trim().replace(/^認證清單：/, '');
    return { status, note, model };
  }

  async function importOne(file) {
    const m = file.name.match(NAME_RE);
    if (!m) return FE.log('略過「' + file.name + '」：檔名不是 Flex結果-電腦名稱-時間.zip', 'warn');
    const pc = m[1];
    let zip;
    try { zip = await JSZip.loadAsync(file); } catch (e) { return FE.log('「' + file.name + '」打不開：' + e.message, 'err'); }
    const [conv, dry, real, cert] = await Promise.all(['convert-log.txt', 'agent-dryrun.log', 'agent.log', 'cert-check.log'].map((n) => readText(zip, n)));
    // 正式那次被 FRD 擋下時，空間不足的細節在 agent.log，兩份一起看
    const r0 = judge(conv, dry + '\n' + real, cert);
    let row = FE.rows.find((r) => r.name.trim().toLowerCase() === pc.toLowerCase());
    if (!row) {
      row = FE.rows.find((r) => !r.name.trim());
      if (!row) { row = FE.blank(); FE.rows.push(row); }
      row.name = pc;
      FE.log('「' + pc + '」不在表格裡，已新增一列。', 'warn');
    }
    row.status = r0.status; row.note = r0.note;
    if (!row.model && r0.model) row.model = r0.model;
    const kind = ['模擬通過', '已開始轉換'].includes(r0.status) ? 'ok' : r0.status === '無法判斷' ? 'warn' : 'err';
    FE.log(pc + '：' + r0.status + '｜' + r0.note, kind);
  }

  async function importAll(files) {
    const list = [...files].filter((f) => /\.zip$/i.test(f.name));
    if (!list.length) return FE.log('沒有 .zip 檔。', 'warn');
    // 同一台有多份時，依檔名的時間排序，最新的最後套用
    list.sort((a, b) => a.name.localeCompare(b.name));
    for (const f of list) await importOne(f);
    FE.render();
    FE.log('結果檔處理完畢，共 ' + list.length + ' 個。', 'ok');
  }

  const drop = document.getElementById('drop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('on'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('on'); }));
  drop.addEventListener('drop', (e) => importAll(e.dataTransfer.files));
  document.getElementById('btnResults').addEventListener('click', () => document.getElementById('fileResults').click());
  document.getElementById('fileResults').addEventListener('change', (e) => { importAll(e.target.files); e.target.value = ''; });
})();
