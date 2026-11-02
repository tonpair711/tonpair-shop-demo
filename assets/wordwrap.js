/* 不在詞中間換行（2026-10-30）
   中文瀏覽器可以在任兩字之間斷行，常把「夥伴」「驗收」拆成兩行。用 Intl.Segmenter 斷詞，
   詞與詞之間插 <wbr>（不改文字，複製、爬蟲讀到的內容不變），再讓內容區套 word-break:keep-all，
   只在 <wbr> 與標點處換行。只在漢字詞界、標點後（非標點前）插，避免標點被推到行首。
   沒有 Intl.Segmenter 就整段不做，維持原本斷法。獨立一支，沒有 main.js 的頁面也能單獨載入。 */
(function(){
  if(typeof Intl==="undefined"||!Intl.Segmenter)return;
  var root=document.querySelector("main")||document.body;
  var SKIP="script,style,code,pre,kbd,samp,textarea,input,select,svg,.g-word,.nowrap,.pt-half,[aria-hidden='true']";
  var seg=new Intl.Segmenter("zh-TW",{granularity:"word"}),HAN=/[\u3400-\u9fff]/,SHUT="，。、；：！？）」』》〉】",OPEN="（「『《〈【";
  // 能在 i 前面斷：漢字接漢字（詞界）、收尾標點後接非收尾標點、非開頭標點後接開頭標點；keep-all 下標點旁不會自己斷，要補
  function gap(s,i,len){
    var a=s.charAt(i-1),b=s.charAt(i);
    if(HAN.test(a)&&HAN.test(b))return len>1||i+len<s.length;  // 結尾的單字（量、的）黏在前一個詞後面，不單獨成一行
    if(SHUT.indexOf(a)>=0&&SHUT.indexOf(b)<0&&OPEN.indexOf(b)<0&&b.trim())return true;
    return OPEN.indexOf(b)>=0&&OPEN.indexOf(a)<0&&a.trim()&&SHUT.indexOf(a)<0;
  }
  // main.js 綁在段尾的 .nowrap 片語可能把一個詞從中間切開（採｜購設備）：先把被切到的詞整個併進片語（最多搬 3 字），
  // 片語本身不拆，但它跟前一個詞之間要能換行，不然「課程＋整理在一起」會連成一大塊。要在下面分詞之前做
  root.querySelectorAll("span.nowrap").forEach(function(sp){
    var p=sp.previousSibling;
    if(!p||p.nodeType!==3||sp.children.length||!HAN.test(p.nodeValue.slice(-1))||!HAN.test(sp.textContent.charAt(0)))return;
    var a=p.nodeValue,t=sp.textContent;
    for(var g of seg.segment(a+t)){
      if(g.index<a.length&&g.index+g.segment.length>a.length){
        var k=a.length-g.index;
        if(k<=3){sp.textContent=a.slice(g.index)+t;p.nodeValue=a.slice(0,g.index);}
        break;
      }
    }
    if(HAN.test(p.nodeValue.slice(-1)))sp.parentNode.insertBefore(document.createElement("wbr"),sp);
  });
  var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),n,list=[];
  while((n=w.nextNode())){if(HAN.test(n.nodeValue)&&!n.parentElement.closest(SKIP))list.push(n);}
  list.forEach(function(n){
    var s=n.nodeValue,frag=null,last=0;
    for(var g of seg.segment(s)){
      var i=g.index;
      if(!i||!gap(s,i,g.segment.length))continue;
      frag=frag||document.createDocumentFragment();
      frag.appendChild(document.createTextNode(s.slice(last,i)));
      frag.appendChild(document.createElement("wbr"));
      last=i;
    }
    if(!frag)return;
    frag.appendChild(document.createTextNode(s.slice(last)));
    n.parentNode.replaceChild(frag,n);
  });
  var st=document.createElement("style");
  // 內文不用 pretty：它為了不留短尾行會把整個詞推到下一行，keep-all 下一行就空出一大塊；尾段防孤字交給 main.js 的 .nowrap
  st.textContent=".wb-root{word-break:keep-all;overflow-wrap:break-word}.wb-root :is(p,li,dd,figcaption,.faq-a,.kn-d,.section-sub){text-wrap:wrap}";
  document.head.appendChild(st);
  root.classList.add("wb-root");
})();
