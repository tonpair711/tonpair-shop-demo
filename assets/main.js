const themeToggle=document.getElementById("themeToggle");function syncThemeIcon(){const isDark="dark"===document.documentElement.getAttribute("data-theme");themeToggle&&(themeToggle.textContent=isDark?"☀️":"🌙")}function syncTurnstileTheme(){if(!window.turnstile||"function"!=typeof window.turnstile.render)return;const isDark="dark"===document.documentElement.getAttribute("data-theme");document.querySelectorAll(".cf-turnstile[id]").forEach(el=>{const sitekey=el.getAttribute("data-sitekey");if(!sitekey)return;const lang=el.getAttribute("data-language")||"zh-tw";try{window.turnstile.remove(el.id)}catch(e){}el.innerHTML="";try{window.turnstile.render("#"+el.id,{sitekey:sitekey,language:lang,theme:isDark?"dark":"light"})}catch(e){}})}syncThemeIcon(),themeToggle&&themeToggle.addEventListener("click",()=>{"dark"===document.documentElement.getAttribute("data-theme")?(document.documentElement.removeAttribute("data-theme"),localStorage.setItem("hunglun-theme","light")):(document.documentElement.setAttribute("data-theme","dark"),localStorage.setItem("hunglun-theme","dark")),syncThemeIcon(),syncTurnstileTheme()});const toggle=document.querySelector(".nav-toggle"),nav=document.querySelector(".main-nav");toggle&&nav&&toggle.addEventListener("click",()=>{const open=nav.classList.toggle("open");toggle.setAttribute("aria-expanded",open?"true":"false"),toggle.setAttribute("aria-label",open?"關閉選單":"開啟選單")}),function(){var sel=".bot-table-scroll, .spec-table-wrap, .cert-gallery";function sync(){document.querySelectorAll(sel).forEach(function(el){var scrollable=el.scrollWidth>el.clientWidth+1;if(scrollable&&!el.hasAttribute("tabindex")){if(el.setAttribute("tabindex","0"),el.setAttribute("role","group"),!el.getAttribute("aria-label")){for(var prev=el.previousElementSibling,title="";prev&&!title;)/^H[1-6]$/.test(prev.tagName)&&(title=prev.textContent.trim()),prev=prev.previousElementSibling;el.setAttribute("aria-label",(title?title+"：":"")+"可左右捲動的內容")}}else scrollable||"0"!==el.getAttribute("tabindex")||(el.removeAttribute("tabindex"),el.removeAttribute("role"),el.removeAttribute("aria-label"))})}if(sync(),window.addEventListener("resize",sync),document.fonts&&document.fonts.ready&&document.fonts.ready.then(sync),window.ResizeObserver){var ro=new ResizeObserver(sync);document.querySelectorAll(sel).forEach(function(el){ro.observe(el)})}}();const io=new IntersectionObserver(entries=>{entries.forEach(e=>{e.isIntersecting&&(e.target.classList.add("in"),io.unobserve(e.target))})},{threshold:.12});const rv=[...document.querySelectorAll(".reveal")],rs=rv.map(el=>el.getBoundingClientRect());rv.forEach((el,i)=>{const r=rs[i];r.top<innerHeight&&r.bottom>0?(el.style.transition="none",el.classList.add("in")):io.observe(el)}),setTimeout(()=>{document.querySelectorAll(".reveal:not(.in)").forEach(el=>el.classList.add("in"))},3e3),function(){const nums=[...document.querySelectorAll(".stat .num")].filter(el=>/^\d/.test(el.textContent.trim()));if(!nums.length)return;if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;const numIo=new IntersectionObserver(entries=>{entries.forEach(e=>{e.isIntersecting&&(!function(el){const m=el.textContent.trim().match(/^(\d+)(.*)$/);if(!m)return;const target=parseInt(m[1],10),suffix=m[2],t0=performance.now();el.style.minWidth=el.getBoundingClientRect().width+"px",el.textContent="0"+suffix,requestAnimationFrame(function step(now){const p=Math.min((now-t0)/1100,1),eased=1-Math.pow(1-p,3);el.textContent=Math.round(target*eased)+suffix,p<1?requestAnimationFrame(step):el.style.minWidth=""})}(e.target),numIo.unobserve(e.target))})},{threshold:.6});nums.forEach(el=>numIo.observe(el))}(),document.querySelectorAll("img.lightbox").forEach(img=>{function open(){const opener=document.activeElement,overlay=document.createElement("div");overlay.className="lightbox-overlay",overlay.setAttribute("role","dialog"),overlay.setAttribute("aria-modal","true"),overlay.setAttribute("aria-label",img.alt||"圖片放大檢視"),overlay.innerHTML=`<button class="lightbox-close" aria-label="關閉">✕</button><img src="${img.src}" alt="${img.alt}">`;const closeBtn=overlay.querySelector(".lightbox-close");function onKey(e){"Escape"!==e.key?"Tab"===e.key&&(e.preventDefault(),closeBtn.focus()):close()}function close(){overlay.remove(),document.removeEventListener("keydown",onKey),opener&&opener.focus&&opener.focus()}overlay.addEventListener("click",e=>{e.target!==overlay&&e.target!==closeBtn||close()}),document.addEventListener("keydown",onKey),document.body.appendChild(overlay),closeBtn.focus()}img.setAttribute("tabindex","0"),img.setAttribute("role","button"),img.getAttribute("aria-label")||img.setAttribute("aria-label",(img.alt||"圖片")+"（放大檢視）"),img.addEventListener("click",open),img.addEventListener("keydown",e=>{"Enter"!==e.key&&" "!==e.key||(e.preventDefault(),open())})});const visitCountEl=document.getElementById("visitCount");if(visitCountEl){var today=(new Date).toDateString(),cachedDate=null,cachedCount=null;try{cachedDate=localStorage.getItem("hunglun-visit-date"),cachedCount=localStorage.getItem("hunglun-visit-count")}catch(e){}cachedDate===today&&cachedCount?visitCountEl.textContent=Number(cachedCount).toLocaleString():Promise.reject(new Error("off")).then(r=>r.json()).then(data=>{visitCountEl.textContent=data.count.toLocaleString();try{localStorage.setItem("hunglun-visit-date",today),localStorage.setItem("hunglun-visit-count",String(data.count))}catch(e){}}).catch(()=>{visitCountEl.textContent=cachedCount?Number(cachedCount).toLocaleString():"409,260"})}!function(){var COLORS=["#4285f4","#ea4335","#fbbc05","#4285f4","#34a853","#ea4335"];document.querySelectorAll("h1, h2, h3, .stat .num, .l-eyebrow, .eyebrow").forEach(function(el){if(!el.closest(".site-header, .site-footer")){for(var walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),nodes=[];walker.nextNode();)-1!==walker.currentNode.nodeValue.indexOf("Google")&&nodes.push(walker.currentNode);nodes.forEach(function(node){var frag=document.createDocumentFragment();node.nodeValue.split(/(Google)/).forEach(function(part){if("Google"===part){var word=document.createElement("span");word.className="g-word",word.setAttribute("aria-label","Google"),word.setAttribute("role","img");for(var i=0;i<6;i++){var letter=document.createElement("span");letter.style.color=COLORS[i],letter.textContent=part[i],letter.setAttribute("aria-hidden","true"),word.appendChild(letter)}frag.appendChild(word)}else frag.appendChild(document.createTextNode(part))}),node.parentNode.replaceChild(frag,node)})}})}(),document.addEventListener("click",function(e){var btn=e.target.closest?e.target.closest(".fc-copy"):null;if(btn){e.preventDefault();var text=btn.getAttribute("data-copy")||"",label=btn.getAttribute("data-label")||"複製";navigator.clipboard&&window.isSecureContext?navigator.clipboard.writeText(text).then(done,fallback):fallback()}function done(){btn.textContent="已複製",btn.classList.add("copied"),setTimeout(function(){btn.textContent=label,btn.classList.remove("copied")},1600)}function fallback(){var ta=document.createElement("textarea");ta.value=text,ta.setAttribute("readonly",""),ta.style.position="fixed",ta.style.top="-1000px",document.body.appendChild(ta),ta.select();try{document.execCommand("copy"),done()}catch(err){}document.body.removeChild(ta)}});;(function(){
  "use strict";
  var inner=document.querySelector(".header-inner");
  if(!inner) return;
  var btn=document.createElement("button");
  btn.type="button";btn.className="site-search-btn";
  btn.setAttribute("aria-label","搜尋網站");btn.setAttribute("title","搜尋網站");
  btn.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><span class="ssb-text">搜尋</span>';
  var themeBtn=inner.querySelector(".theme-toggle");
  if(themeBtn) inner.insertBefore(btn,themeBtn); else inner.appendChild(btn);

  var HOT=["Google Classroom","Gemini","Google Flow","Google Vids","Chromebook","Google AI Pro","NotebookLM","AI 出題","研習","共同供應契約"];
  var overlay,input,list,status,hot,idx=null,loading=false,lastFocus=null;

  function build(){
    overlay=document.createElement("div");
    overlay.className="site-search-overlay";overlay.hidden=true;
    overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");
    overlay.setAttribute("aria-label","站內搜尋");
    overlay.innerHTML=''
      +'<div class="ss-panel">'
      +'<div class="ss-bar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>'
      +'<input type="search" class="ss-input" placeholder="想找什麼？例如 Classroom" enterkeyhint="search" autocomplete="off" aria-label="搜尋關鍵字" aria-controls="ss-results">'
      +'<button type="button" class="ss-close" aria-label="關閉搜尋">✕</button></div>'
      +'<p class="ss-status" aria-live="polite"></p>'
      +'<div class="ss-hot"><p class="ss-hot-t">大家常搜尋（點一下直接搜）</p><div class="ss-hot-list">'+HOT.map(function(w){return '<button type="button" class="ss-chip" data-q="'+w+'">'+w+'</button>';}).join('')+'</div></div>'
      +'<ul class="ss-results" id="ss-results"></ul></div>';
    document.body.appendChild(overlay);
    input=overlay.querySelector(".ss-input");
    list=overlay.querySelector(".ss-results");
    status=overlay.querySelector(".ss-status");
    hot=overlay.querySelector(".ss-hot");
    hot.addEventListener("click",function(e){var b=e.target.closest(".ss-chip");if(!b)return;input.value=b.getAttribute("data-q");render(input.value);input.focus();});
    input.addEventListener("input",function(){render(input.value);});
    overlay.querySelector(".ss-close").addEventListener("click",close);
    overlay.addEventListener("mousedown",function(e){if(e.target===overlay)close();});
    overlay.addEventListener("keydown",function(e){if(e.key==="Escape"){e.preventDefault();e.stopPropagation();close();}});
  }

  function load(){
    if(idx||loading) return;
    loading=true;status.textContent="載入中…";
    fetch("/search-index.json").then(function(r){return r.json();}).then(function(d){
      idx=d;loading=false;render(input.value);
    }).catch(function(){loading=false;status.textContent="搜尋索引載入失敗，請稍後再試。";});
  }

  function esc(s){return s.replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}

  function render(q){
    q=(q||"").trim().toLowerCase();
    if(hot)hot.hidden=!!q;
    if(!idx){status.textContent=loading?"載入中…":"";list.innerHTML="";return;}
    if(!q){status.textContent="輸入關鍵字，或直接點下面的熱門詞。";list.innerHTML="";return;}
    var terms=q.split(/\s+/).filter(Boolean);
    var hits=[];
    for(var i=0;i<idx.length;i++){
      var it=idx[i],hay=(it.t+" "+it.d+" "+it.c).toLowerCase();
      var ok=true,score=0;
      for(var j=0;j<terms.length;j++){
        if(hay.indexOf(terms[j])<0){ok=false;break;}
        if(it.t.toLowerCase().indexOf(terms[j])>=0)score+=3;
        else if(it.c.toLowerCase().indexOf(terms[j])>=0)score+=2;
        else score+=1;
      }
      if(ok)hits.push({it:it,s:score});
    }
    hits.sort(function(a,b){return b.s-a.s;});
    status.textContent=hits.length?("找到 "+hits.length+" 筆"):"找不到符合的頁面，換個關鍵字試試。";
    list.innerHTML=hits.slice(0,12).map(function(h){
      var it=h.it;
      return '<li><a class="ss-item" href="'+esc(it.u)+'">'
        +'<span class="ss-item-top"><span class="ss-t">'+esc(it.t)+'</span>'
        +(it.c?'<span class="ss-c">'+esc(it.c)+'</span>':'')+'</span>'
        +'<span class="ss-d">'+esc(it.d)+'</span></a></li>';
    }).join("");
  }

  function open(){
    if(!overlay)build();
    lastFocus=document.activeElement;
    overlay.hidden=false;document.documentElement.style.overflow="hidden";
    load();
    setTimeout(function(){input.focus();render(input.value);},20);
  }
  function close(){
    if(!overlay||overlay.hidden)return;
    overlay.hidden=true;document.documentElement.style.overflow="";
    if(lastFocus&&lastFocus.focus)lastFocus.focus();
  }

  btn.addEventListener("click",open);
  document.addEventListener("keydown",function(e){
    if(e.key==="Escape"&&overlay&&!overlay.hidden){e.preventDefault();close();return;}
    if(e.key==="/"&&!/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName||""))&&!e.target.isContentEditable){
      e.preventDefault();open();
    }
  });
})();

/* 中文排版補強（2026-10-20 iPhone 實機截圖後加）
   ① 相鄰標點擠緊：「）。」「」，」這類收尾標點右半是空白，後面再接標點就空出一大格。
      字型子集沒有 halt／chws，Chrome 與 Safari 都不會自動擠，所以把前一個標點包起來縮半格。
   ② 防孤字：Safari 不套 text-wrap:pretty（會每行提早換行），Chrome 的 pretty 在中文也擋不完；
      把段落最後三個字綁在同一行，最後一行至少三個字。只動畫面，原始 HTML 與爬蟲讀到的文字不變。 */
(function(){
  var main=document.querySelector("main");
  if(!main)return;
  var CLOSE_LEFT="）」』》〉】",OPEN="（「『《〈【",PUNCT="）」』》〉】。，、；：！？（「『《〈【";
  var SKIP="script,style,code,pre,kbd,samp,textarea,input,select,svg,.g-word,.nowrap,[aria-hidden='true']";

  function textNodes(root,skip){
    var out=[],w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),n;skip=skip||SKIP;
    while((n=w.nextNode())){if(n.nodeValue.trim()&&!n.parentElement.closest(skip))out.push(n);}
    return out;
  }

  // ① 收尾標點（墨在左半）後面接標點，或任何標點後面接開頭標點（墨在右半），前一個縮半格
  function squeeze(node){
    var s=node.nodeValue,re=/[）」』》〉】。，、；：！？](?=[）」』》〉】。，、；：！？（「『《〈【])/g,m,last=0,frag=null;
    while((m=re.exec(s))){
      var a=m[0],b=s.charAt(m.index+1);
      if(CLOSE_LEFT.indexOf(a)<0&&OPEN.indexOf(b)<0)continue;  // 「。」」置中標點後接收尾標點：兩邊都有字身空白，不縮
      frag=frag||document.createDocumentFragment();
      frag.appendChild(document.createTextNode(s.slice(last,m.index)));
      var sp=document.createElement("span");sp.className="pt-half";sp.textContent=a;frag.appendChild(sp);
      last=m.index+1;
    }
    if(!frag)return;
    frag.appendChild(document.createTextNode(s.slice(last)));
    node.parentNode.replaceChild(frag,node);
  }
  textNodes(main).forEach(function(n){if(/[）」』》〉】。，、；：！？][）」』》〉】。，、；：！？（「『《〈【]/.test(n.nodeValue))squeeze(n);});

  // ③ 網址（flow.google.com、takeout.google.com/transfer）中間沒有斷點，整串掉到下一行，上一行左右對齊會被撐很開；
  //    在「.」「/」後面插 <wbr>（不會被複製進網址）；<code> 裡的網址也要處理
  textNodes(main,"script,style,pre,textarea,input,select,svg,.nowrap,[aria-hidden='true']").forEach(function(n){
    var s=n.nodeValue,re=/[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?:\/[A-Za-z0-9._~%\/-]*)?/g,m,last=0,frag=null;
    while((m=re.exec(s))){
      if(m[0].length<12||!/[a-z]/i.test(m[0]))continue;
      frag=frag||document.createDocumentFragment();
      frag.appendChild(document.createTextNode(s.slice(last,m.index)));
      m[0].split(/(?<=[.\/])/).forEach(function(part,k){if(k)frag.appendChild(document.createElement("wbr"));frag.appendChild(document.createTextNode(part));});
      last=m.index+m[0].length;
    }
    if(!frag)return;
    frag.appendChild(document.createTextNode(s.slice(last)));
    n.parentNode.replaceChild(frag,n);
  });

  // ② 段落最後幾個字綁在一起。Safari 不套 pretty，Chrome 的 pretty 在中文也擋不完（360 寬實測 20 處），所以全部瀏覽器都做
  // 從結尾往回數「單位」：一個中文字或一串英數字算一個，湊滿三個就停（不夠三個但有兩個也綁），中間的空白與標點一起綁
  // 綁太長（含英文或數字時）上一行會空一大塊：估計寬度超過 6 個中文字就改綁兩個單位，還是太寬就不綁（英數約半個字寬）
  function wid(t){var w=0;for(var k=0;k<t.length;k++)w+=/[\u2e80-\uffef]/.test(t.charAt(k))?1:0.55;return w;}
  // 結尾有標點時綁兩個字＋標點就夠（最後一行已有三格寬），少綁一個字，上一行左右對齊時撐開的字距也少一點
  function tailOf(s){var n=/[。，、；：！？）」』》〉】.,!?)]$/.test(s)?2:3,t=tailN(s,n);if(wid(t)>6)t=tailN(s,2);return wid(t)>6?"":t;}
  function tailN(s,want){
    var units=0,i=s.length;
    while(i>0&&units<want){
      var c=s.charAt(i-1);
      if(/[A-Za-z0-9]/.test(c)){while(i>0&&/[A-Za-z0-9.\/\-]/.test(s.charAt(i-1)))i--;units++;}
      else{if(/[\u3400-\u9fff]/.test(c))units++;i--;}
    }
    return units<2?"":s.slice(i);
  }
  main.querySelectorAll("p,li,dd,figcaption,.faq-a,.kn-d,.section-sub,.svc-pager a").forEach(function(el){
    if(el.closest(SKIP))return;
    var ns=textNodes(el),i=ns.length-1;
    // 結尾只有標點的節點（例如連結後的「。」）往前找：標點本來就不會放在行首，會跟著前一個字走
    while(i>=0&&/^[\s）」』》〉】。，、；：！？.,)]*$/.test(ns[i].nodeValue))i--;
    if(i<0)return;
    // 段落真正的結尾在 <code>、英文品牌字這類跳過的元素裡：綁前面的字沒有意義，不綁
    var all=textNodes(el,"script,style"),j=all.length-1;
    while(j>=0&&/^[\s）」』》〉】。，、；：！？.,)]*$/.test(all[j].nodeValue))j--;
    if(all[j]!==ns[i])return;
    var node=ns[i],s=node.nodeValue.replace(/\s+$/,""),tail=tailOf(s);
    if(!tail||tail.length>=s.length&&node===ns[0])return;  // 整個區塊就這幾個字，不用綁
    var sp=document.createElement("span");sp.className="nowrap";sp.textContent=tail;
    node.nodeValue=s.slice(0,s.length-tail.length);
    node.parentNode.insertBefore(sp,node.nextSibling);
  });
})();

// 右下角 LINE 鈕：電腦版（有滑鼠）lin.ee 開不了對話，改彈小卡片顯示 ID＋複製鈕；手機照舊直接開 LINE
(function(){
  var a=document.querySelector(".contact-fab .fab-line");
  if(!a||!window.matchMedia("(hover: hover) and (pointer: fine)").matches)return;
  var id="@gdm6961p",pop=null;
  function close(){if(pop){pop.remove();pop=null}}
  a.addEventListener("click",function(e){
    e.preventDefault();
    if(pop)return close();
    pop=document.createElement("div");
    pop.className="fab-pop";
    pop.innerHTML='<b></b><button type="button" class="fc-copy" data-label="複製 ID">複製 ID</button><small>電腦版請在 LINE 搜尋 ID 加入</small><a href="'+a.href+'" target="_blank" rel="noopener">或用手機開啟</a>';
    pop.querySelector("b").textContent=id;
    pop.querySelector(".fc-copy").setAttribute("data-copy",id);
    document.querySelector(".contact-fab").appendChild(pop);
  });
  document.addEventListener("click",function(e){if(pop&&!e.target.closest(".fab-pop")&&!e.target.closest(".fab-line"))close()});
  document.addEventListener("keydown",function(e){if(e.key==="Escape")close()});
})();

// Google Analytics 4（資源「hunglun.com」，評估 ID 由 Steve 於 2026-10-27 建立）＋聯絡按鈕點擊事件
// 事件名稱：line_click／line_id_copy／facebook_click／map_click／email_click／phone_click
// 參數 placement：fab（右下角浮動鈕）／footer（頁尾）／content（頁面內文）；device：touch／mouse
(function(){
  var GA_ID="G-98E81H81F6";
  // 只在正式網域送資料：本機測試（localhost）與 .pages.dev 預覽網址不記，避免污染數字
  if(!/(^|\.)hunglun\.com$/.test(location.hostname))return;
  window.dataLayer=window.dataLayer||[];
  window.gtag=function(){window.dataLayer.push(arguments)};
  window.gtag("js",new Date());
  window.gtag("config",GA_ID);
  var s=document.createElement("script");
  s.async=true;
  s.src="https://www.googletagmanager.com/gtag/js?id="+encodeURIComponent(GA_ID);
  document.head.appendChild(s);

  var mouse=window.matchMedia&&window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  function eventFor(el){
    if(el.closest(".fab-pop .fc-copy"))return"line_id_copy";
    if(el.closest(".fc-has-copy .fc-copy")){var c=el.closest(".fc-copy").getAttribute("data-copy")||"";return c.charAt(0)==="@"?"line_id_copy":null}
    var a=el.closest("a");
    if(!a)return null;
    var h=a.getAttribute("href")||"";
    if(a.classList.contains("fab-line")||/lin\.ee|line\.me/.test(h))return"line_click";
    if(a.classList.contains("fab-form"))return"form_click";
    if(/facebook\.com\/hungluntechnology/.test(h))return"facebook_click";
    if(/google\.[a-z.]+\/maps|maps\.app\.goo\.gl/.test(h))return"map_click";
    if(/^mailto:|mail\.google\.com/.test(h))return"email_click";
    if(/^tel:/.test(h))return"phone_click";
    return null;
  }
  function placementFor(el){
    if(el.closest(".contact-fab"))return"fab";
    if(el.closest(".site-footer"))return"footer";
    return"content";
  }
  document.addEventListener("click",function(e){
    if(!e.target||!e.target.closest||typeof window.gtag!=="function")return;
    var name=eventFor(e.target);
    if(!name)return;
    window.gtag("event",name,{placement:placementFor(e.target),device:mouse?"mouse":"touch",page_path:location.pathname});
  },true);
})();
