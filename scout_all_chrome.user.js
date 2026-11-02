// ==UserScript==
// @name         【Chrome用】スカウト統合ツール
// @namespace    co-llabo.scout-all
// @version      7.5.0
// @updateURL    https://raw.githubusercontent.com/sakaisho1rodesu-sys/korabo-scout-full/main/scout_all_chrome.user.js
// @downloadURL  https://raw.githubusercontent.com/sakaisho1rodesu-sys/korabo-scout-full/main/scout_all_chrome.user.js
// @description  エン転職・エン転職ダイレクト・マイナビ転職・dodaダイレクトの絞り込みと、エン転職の候補者抽出・一括スカウト・レポートを1本にまとめた版。EdgeでもChromeでも同じファイルを使う。マイナビは全ページ抽出・配信連携・保存リスト画面・全ページ集計に対応。社名を隠すモードは4媒体共通。
// @author       こらぼ
// @match        https://employment.en-japan.com/company/scout/search_result_list/*
// @match        https://employment.en-japan.com/company/scout/folder_list/*
// @match        https://employment.en-japan.com/company/scout/scout_list/*
// @match        https://employment.en-japan.com/company/apply/list/*
// @match        https://employment.en-japan.com/company/appcontrol/*
// @match        https://employment.en-japan.com/company/scout/search_condition_update/*
// @match        https://employment.en-japan.com/endirect/*
// @match        https://tenshoku.mynavi.jp/client/scout/index.cfm*
// @match        https://tenshoku.mynavi.jp/client/scoutcommunication/index.cfm*
// @match        *://assist.doda.jp/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/* =====================================================================
   構成（1ファイルに2つの部品が入っています。互いに干渉しないよう別々に動きます）
   ・前半：絞り込み部品（エン転職ダイレクト／マイナビ転職／dodaダイレクト）
   ・後半：エン転職 統合ツール（候補者抽出・一括スカウト・レポート。旧 v7.8 相当）
   エン転職（/company/）では後半だけが動き、前半は何もしません。
   ===================================================================== */
window.__SF_EN_BY_TOOL__ = true;

(function(){
  "use strict";
  if(window.__SCOUT_FILTER__){ console.warn('[スカウト絞り込み] すでに起動しています'); return; }
  window.__SCOUT_FILTER__='7.5';
  /* ===== v6.1：マイナビ専用の付属機能（メール確認画面の余剰除去） =====
     配信の確認画面（ctsn_setMailView_form）では、選んだ人以外のチェックを外して件数を合わせる。
     選んだ人の記録は、一覧側が localStorage（_mn_sel_<chkcd>）へ残したものを使う。 */
  (function(){
    if(!/(^|\.)tenshoku\.mynavi\.jp$/.test(location.hostname)) return;
    var sp=new URLSearchParams(location.search);
    if(sp.get('fuseaction')!=='ctsn_setMailView_form') return;
    window.__SF_MAILVIEW__=true;
    var chk=sp.get('chkcd')||'default';
    var saved=[];
    try{ var r=localStorage.getItem('_mn_sel_'+chk); if(r) saved=JSON.parse(r)||[]; }catch(e){}
    function banner(msg,color,detail){
      var old=document.getElementById('_mn_mail_banner'); if(old) old.remove();
      var b=document.createElement('div'); b.id='_mn_mail_banner';
      b.style.cssText='position:sticky;top:0;z-index:9999;background:'+color+';color:#fff;padding:10px 16px;font-family:sans-serif;font-size:13px;font-weight:bold;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;flex-direction:column;gap:4px;';
      var d1=document.createElement('div'); d1.textContent=msg; b.appendChild(d1);
      if(detail){ var d2=document.createElement('div'); d2.style.cssText='font-size:11px;font-weight:normal;opacity:.9;'; d2.textContent=detail; b.appendChild(d2); }
      document.body.insertBefore(b, document.body.firstChild);
    }
    function run(){
      var cbs=qsa('input[name="member_id"]');
      if(!cbs.length) return;
      if(!saved.length){
        banner('ℹ️ 絞り込みの選択記録がありません', '#607d8b', '配信対象: '+qsa('input[name="member_id"]:checked').length+'名 ／ 手動で確認してください');
        return;
      }
      var set={}; saved.forEach(function(id){ set[id]=1; });
      var extras=[], page={};
      cbs.forEach(function(c){ page[c.value]=1; });
      cbs.forEach(function(c){ if(!set[c.value]){ c.checked=false; extras.push(c.value); } else c.checked=true; });
      var missing=saved.filter(function(id){ return !page[id]; });
      var n=qsa('input[name="member_id"]:checked').length;
      var ds=document.querySelector('input[name="delivery_su"]'); if(ds) ds.value=n;
      if(!extras.length && !missing.length) banner('✅ 配信対象が正確です（'+n+'名）','#34a853','選択: '+saved.length+'名 → 確定: '+n+'名');
      else{
        var m=[];
        if(extras.length) m.push('余剰'+extras.length+'名を除外: '+extras.join(', '));
        if(missing.length) m.push('送信できない'+missing.length+'名: '+missing.join(', '));
        banner('🔧 自動で整えました（'+n+'名）', missing.length?'#e65100':'#1565c0', m.join(' ／ '));
      }
    }
    var tries=0, t=setInterval(function(){
      tries++;
      if(qsa('input[name="member_id"]').length){ clearInterval(t); run(); }
      else if(tries>40){ clearInterval(t); run(); }
    },200);
  })();
  if(window.__SF_MAILVIEW__) return;


  /* ===== 共通の小道具 ===== */
  function qsa(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }
  function el(tag, css, txt){ var e=document.createElement(tag); if(css)e.style.cssText=css; if(txt!=null)e.textContent=txt; return e; }
  /* カードの文字を取る。textContent は要素のあいだに区切りが入らず
     「会員No.EN10001」と「28歳」がつながって読み違えるため、innerText を優先する。
     非表示のあいだ innerText は空になるので、そのときだけ textContent に落とす。 */
  function cardText(node){
    if(!node) return '';
    var t=node.innerText;
    if(t && t.trim()) return t;
    return node.textContent||'';
  }
  function txtOf(node){ return ((node && (node.innerText||node.textContent))||'').replace(/\s+/g,' ').trim(); }
  function num(v){ var n=parseInt(String(v).replace(/[^0-9]/g,''),10); return isNaN(n)?-1:n; }
  var PREF_RE=/(北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/;
  function prefOf(t){ var m=String(t||'').match(PREF_RE); return m?m[1]:''; }
  /* 媒体ごとに「男」「女性」など表記が違うので、ここで必ず 男性／女性 に寄せる */
  function normSex(v){
    var s=String(v||'');
    if(/女/.test(s)) return '女性';
    if(/男/.test(s)) return '男性';
    return '';
  }

  function makeADP_en(){
  /* =========================================================
     媒体アダプタ：エン転職
     この枠の中だけが媒体ごとに違います。下の共通コアは4媒体で同じです。
     ========================================================= */

  var EN_PATH=location.pathname;
  var EN_MODE=/\/folder_list\//.test(EN_PATH) ? 'folder'
            : /\/scout_list\//.test(EN_PATH) ? 'sent'
            : /\/search_result_list\//.test(EN_PATH) ? 'search'
            : /\/search_condition_update\//.test(EN_PATH) ? 'cond' : '';

  var EN_COND_KEY='scoutFilterEnPending_v1';
  var EN_SEX={'指定なし':'0','男性':'1','女性':'2'};

  function enCondChangeLink(){
    var as=qsa('a'), i;
    for(i=0;i<as.length;i++){ if(txtOf(as[i]).replace(/\s+/g,'')==='検索条件の変更') return as[i]; }
    for(i=0;i<as.length;i++){ if(/search_condition_update\/form/.test(as[i].getAttribute('href')||'')) return as[i]; }
    return null;
  }
  function enCondFormOnPage(){
    var fs=qsa('form');
    for(var i=0;i<fs.length;i++){ if(fs[i].querySelector('[name="AgeLow"]')) return fs[i]; }
    return null;
  }
  /* 検索条件の変更ページ側。前の画面で預けた値を入れて実フォーム送信する。
     fetch の POST では 404 になるため、必ずブラウザのフォーム送信で通すこと。 */
  function enRunPending(){
    var raw=null; try{ raw=localStorage.getItem(EN_COND_KEY); }catch(e){}
    if(!raw) return;
    try{ localStorage.removeItem(EN_COND_KEY); }catch(e){}
    var d=null; try{ d=JSON.parse(raw); }catch(e){}
    if(!d || (Date.now()-(d.ts||0))>300000) return;
    var f=enCondFormOnPage();
    if(!f){ alert('検索条件の変更フォームが見つかりませんでした。お手数ですが手動で年齢・性別を設定してください。'); return; }
    /* 日付種別には代入しない。送信直前に前後を比べ、変わっていたら中止する */
    var dt=f.querySelector('[name="SearchRangeDivisionDateType"]');
    var before=dt?String(dt.value):'';
    var lo=f.querySelector('[name="AgeLow"]'), hi=f.querySelector('[name="AgeHigh"]'), sx=f.querySelector('[name="Sex"]');
    if(lo) lo.value=String(d.lo);
    if(hi) hi.value=String(d.hi);
    if(sx) sx.value=String(d.sex);
    if(before!==(dt?String(dt.value):'')){ alert('日付種別が変わってしまうため中止しました。手動でご確認ください。'); return; }
    var n=el('div','position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#e8500e;color:#fff;padding:10px;font-size:14px;font-weight:bold;text-align:center');
    n.textContent='エン転職の検索条件を反映しています…（性別 '+(d.sexLabel||'指定なし')
      +' ／ 年齢 '+(String(d.lo)==='0'?'指定なし':d.lo)+'〜'+(String(d.hi)==='0'?'指定なし':d.hi)+'）';
    document.body.appendChild(n);
    setTimeout(function(){ f.submit(); }, 500);
  }

  /* 一覧のHTMLから、画面には出ていない最終学歴・その他言語まで読み取る */
  function enDeep(){
    var map={}, n=0;
    try{
      var doc=new DOMParser().parseFromString(document.documentElement.outerHTML,'text/html');
      var t=(doc.body.textContent||'').replace(/[ 　]+/g,' ');
      t.split(/会員No\./).slice(1).forEach(function(b){
        var h=b.match(/^(\d+)\s*\/\s*(男性|女性)\s*\/\s*(\d+)歳\s*\/\s*([^\/]+?)\s*\/\s*(在職中|離職中)/);
        if(!h) return;
        function g(re){ var m=b.match(re); return m?String(m[1]).trim():''; }
        map[h[1]]={ id:h[1], sex:h[2], age:parseInt(h[3],10), addr:h[4].trim(),
          jyo:(h[5]==='在職中'?'在職':'離職'),
          gaku:g(/最終学歴\s*([^\/●]{0,26})/), lang:g(/その他言語\s*([^●]{0,20})/),
          raw:b.replace(/\s+/g,' ').slice(0,3000) };
        n++;
      });
    }catch(e){}
    EN_DEEP=map; EN_DEEP_N=n;
  }
  var EN_DEEP={}, EN_DEEP_N=0;

  var ADP={
    site:'en',
    label:'エン転職',
    color:'#e8500e',
    abort:(EN_MODE==='cond' || !EN_MODE),
    hasScout:false,
    hasGaku:true,
    note:'',
    col5:{ head:'在職', get:function(r){ return {text:r.jyo||'-', color:(r.jyo==='在職'?'#27ae60':'#c0392b')}; } },
    wideReason:'この画面には「検索条件の変更」が無いため、ページごとの絞り込みになります',
    /* 一覧が無いと分かっている画面。ここではパネルもボタンも出さない */
    notList:/scout_input|scout_confirm|scout_complete|search_condition_update/i,

    prescan:function(){
      enDeep();
      ADP.hasGaku=(EN_DEEP_N>0);
      ADP.note=EN_DEEP_N?'':'※この画面は学歴・語学の詳細が読めないため、判定は本文の語句だけになります';
    },
    rows:function(){
      if(EN_MODE==='folder' || EN_MODE==='sent'){ var t=document.querySelector('table.scoutList'); return t?qsa('tbody tr', t):[]; }
      return qsa('div.personBox');
    },
    /* 画面の作りが変わってもチェックボックスを見失わないよう、順に試す */
    cb:function(row){
      if(EN_MODE==='sent') return null;   /* 送信済みリストには行のチェックボックスが無い */
      if(EN_MODE==='folder'){
        return row.querySelector('input[name="UserID[]"]')
            || row.querySelector('td.check input[type=checkbox]')
            || row.querySelector('input[type=checkbox]');
      }
      return row.querySelector('input.userCheck[type=checkbox]')
          || row.querySelector('input.userCheck')
          || row.querySelector('input[name="UserID[]"]')
          || row.querySelector('input[type=checkbox]');
    },
    setVisible:function(row, on){ row.style.display=on?'':'none'; },
    parse:function(row){
      var no='';
      if(EN_MODE==='folder' || EN_MODE==='sent'){
        var td=row.querySelector('td.num');
        var m0=(txtOf(td)||txtOf(row)).match(/([0-9]{5,})/); no=m0?m0[1]:'';
      }else{
        var uc=row.querySelector('input.userCheck[user-id]');
        no=(uc && uc.getAttribute('user-id')) || ((txtOf(row).match(/会員No\.?\s*([0-9]+)/)||[])[1]||'');
      }
      var t=txtOf(row), b=EN_DEEP[no]||{};
      /* 一覧は「27歳 / 男性 / 東京都 / 学校名 年収… / 在職中」の並び */
      var m=t.match(/(\d{1,2})\s*歳\s*\/\s*(男性|女性)\s*\/\s*([^\/]+?)\s*\/\s*([\s\S]*?)\s*\/?\s*(在職中|離職中)/);
      var age=(b.age!=null)?b.age:num((m?m[1]:((t.match(/(\d{1,2})\s*歳/)||[])[1]||'')));
      return {
        id:String(no||''),
        age:age,
        sex:b.sex||(m?m[2]:((t.match(/(男性|女性)/)||[])[1]||'')),
        addr:b.addr||(m?m[3]:prefOf(t)),
        jyo:b.jyo||(m?(m[5]==='在職中'?'在職':'離職'):(/在職/.test(t)?'在職':(/離職/.test(t)?'離職':''))),
        gaku:b.gaku||(m?String(m[4]).replace(/年収[\s\S]*$/,'').trim():''),
        lang:b.lang||'',
        scout:-1,
        text:((b.raw||'')+' '+t)
      };
    },
    siteTotal:function(){
      var t=(document.body.innerText||'').replace(/\s+/g,' ');
      var m=t.match(/検索結果[^0-9]{0,12}([\d,]+)\s*[名件人]/) || t.match(/該当[^0-9]{0,8}([\d,]+)\s*[名件人]/);
      return m?parseInt(m[1].replace(/,/g,''),10):0;
    },
    siteWide:{
      available:function(){ return !!enCondChangeLink(); },
      run:function(c, log, saveLast){
        var a=enCondChangeLink();
        if(!a){ log('この画面には「検索条件の変更」がありません','#c0392b'); return; }
        var sv=EN_SEX[c.sex]||'0';
        var lo=(c.lo>0)?c.lo:0;
        var hi=(c.hi>0 && c.hi<99)?c.hi:0;
        if(!confirm('エン転職の検索条件そのものを次の内容に変更します。\n\n性別：'+c.sex
          +'\n年齢：'+(lo?lo+'歳':'指定なし')+' 〜 '+(hi?hi+'歳':'指定なし')
          +'\n\n検索条件の変更画面を経由して自動で送信します。日付種別など他の条件は変更しません。\nページをめくっても条件は続きます。よろしいですか？')) return;
        try{ localStorage.setItem(EN_COND_KEY, JSON.stringify({sex:sv, sexLabel:c.sex, lo:String(lo), hi:String(hi), ts:Date.now()})); }catch(e){}
        saveLast();
        log('検索条件の変更画面へ移動しています…');
        location.href=a.href;
      }
    }
  };
  if(EN_MODE==='cond'){ enRunPending(); }

    return ADP;
  }

  function makeADP_endirect(){
  /* =========================================================
     媒体アダプタ：エン転職ダイレクト（/endirect/）
     通常のエン転職スカウト（/company/scout/）とは別のサイトなので分けてある。
     dodaダイレクトと同じく、年齢・性別・スカウト受信数で絞り込む。
     画面の作りが変わりやすいので、決め打ちのセレクタは使わず、
     「年齢の表記」と「チェックボックスまたは会員番号」を手がかりに候補者の枠を探す。
     ========================================================= */

  var ED_HAS_GAKU=false;

  /* 項目名と値が別の行に分かれる画面があるため、行を見て値を取り出す。
     値が空で、次の行が別の項目名なら、その項目は空として扱う。 */
  var ED_LABELS=/^\s*(最終学歴|その他言語|語学|言語|職務経歴|経験職種|希望[^\s]*|会員No|ダイレクト|エン転職スカウト|資格|在職|離職|居住地|年収)/;
  function edField(raw, re){
    var lines=String(raw||'').split(/\n/);
    for(var i=0;i<lines.length;i++){
      var m=lines[i].match(re);
      if(!m) continue;
      var v=String(m[1]||'').trim();
      if(v) return v;
      var nx=(lines[i+1]||'').trim();
      if(!nx || ED_LABELS.test(nx)) return '';
      return nx;
    }
    return '';
  }

  function edLooksCard(node){
    var t=cardText(node);
    if(!/\d{1,2}\s*歳/.test(t)) return false;
    if(t.length>4000) return false;                       /* 一覧全体を1件と誤認しない */
    if(/会員No|会員番号|ID/.test(t)) return true;
    return !!node.querySelector('input[type="checkbox"]');
  }

  function edCards(){
    var out=[], seen=[];
    function push(list){ list.forEach(function(s){ if(seen.indexOf(s)<0){ seen.push(s); out.push(s); } }); }
    try{
      /* チェックボックスを起点に、同じ形の兄弟が並んでいる階層まで上がる */
      var boxes=qsa('input[type="checkbox"]');
      for(var i=0;i<boxes.length;i++){
        var c=boxes[i];
        var idn=((c.id||'')+' '+(c.name||'')+' '+(c.className||'')).toLowerCase();
        if(/all|every|select-?all|toggle/.test(idn)) continue;
        var e=c.parentElement, depth=0;
        while(e && e!==document.body && depth<10){
          var p=e.parentElement;
          if(!p) break;
          if(edLooksCard(e)){
            var sibs=Array.prototype.filter.call(p.children, edLooksCard);
            if(sibs.length>=2){ push(sibs); return out; }
            push([e]);
            break;
          }
          e=p; depth++;
        }
      }
      /* チェックボックスが見つからない画面向けの保険。年齢表記から探す */
      if(!out.length){
        var walker=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), node;
        while((node=walker.nextNode())){
          if(!/\d{1,2}\s*歳/.test(String(node.textContent||''))) continue;
          var el2=node.parentElement, d2=0;
          while(el2 && el2!==document.body && d2<10){
            var p2=el2.parentElement;
            if(!p2) break;
            var s2=Array.prototype.filter.call(p2.children, edLooksCard);
            if(s2.length>=2){ push(s2); return out; }
            el2=p2; d2++;
          }
        }
      }
    }catch(e){}
    return out;
  }

  var ADP={
    site:'endirect',
    label:'エン転職ダイレクト',
    color:'#e8500e',
    abort:false,
    hasScout:true,
    hasGaku:false,
    note:'',
    /* 左がダイレクト受信、右がエン転職スカウト。絞り込みは左の数字で行う */
    col5:{ head:'受信', get:function(r){
      if(r.scout<0) return {text:'-', color:'#555'};
      return {text:r.scout+(r.scout2>=0?('/'+r.scout2):''), color:(r.scout<=5)?'#27ae60':'#555'};
    } },
    wideReason:'エン転職ダイレクトは検索条件に年齢・受信数の指定が無いため、ページごとの絞り込みになります',
    /* 一覧が無いと分かっている画面。ここではパネルもボタンも出さない */
    notList:/send|mail|message|complete|confirm|preview|detail/i,
    /* v4.6：応募管理では何も出さず、何も操作しない。v4.7：スカウト送信済の人材（scout-list）、v4.8：予約中のスカウト（booking-list）、v4.9：求人一覧（work）も同様 */
    blocked:/^\/endirect\/(applicant|work|human\/scout-list|human\/booking-list)/,

    prescan:function(){
      var cs=edCards();
      ED_HAS_GAKU=cs.some(function(c){ return /最終学歴/.test(c.textContent||''); });
      ADP.hasGaku=ED_HAS_GAKU;
      ADP.note=ED_HAS_GAKU?'':'※この画面は学歴が読めないため、判定は本文の語句だけになります';
    },
    rows:edCards,
    cb:function(card){
      var list=qsa('input[type="checkbox"]', card);
      for(var i=0;i<list.length;i++){
        var idn=((list[i].id||'')+' '+(list[i].name||'')+' '+(list[i].className||'')).toLowerCase();
        if(/all|every|select-?all|toggle/.test(idn)) continue;
        return list[i];
      }
      return null;
    },
    setVisible:function(card, on){
      card.style.setProperty('display', on?'':'none', 'important');
      if(!on) qsa('input[type="checkbox"]', card).forEach(function(c){ if(c.checked) c.click(); });
    },
    parse:function(card){
      var raw=cardText(card);
      /* 空白を詰めきると会員番号と年齢がつながって読み違えるため、単一スペースに揃える */
      var t=raw.replace(/\s+/g,' ');
      var id=((t.match(/会員No\.?\s*([A-Za-z0-9\-]+)/)||[])[1])
          || ((t.match(/会員番号\s*[:：]?\s*([A-Za-z0-9\-]+)/)||[])[1]) || '';
      var age=-1, m=t.match(/(?:^|[^0-9])(\d{1,2})\s*歳/); if(m) age=parseInt(m[1],10);
      var sex='';
      var g=t.match(/\d{1,2}\s*歳\s*[\/／・|]?\s*(男性|女性)/) || t.match(/\d{1,2}\s*歳\s*[\/／・|]?\s*(男|女)(?![性])/);
      if(g) sex=g[1];
      else if(/(?:^|[^活躍歓迎募集多])女性/.test(t)) sex='女性';
      else if(/(?:^|[^活躍歓迎募集多])男性/.test(t)) sex='男性';
      /* エン転職ダイレクトは受信の内訳が2つ出る。
         「ダイレクト◯件」＝他社からのダイレクト受信。dodaの「スカウト受信数」に当たるのはこちら。
         「エン転職スカウト◯件」＝エン転職の通常スカウトの受信件数。参考として横に出すだけ。
         絞り込みはダイレクト受信の件数で行う。 */
      var sc=t.match(/ダイレクト\s*(\d+)\s*件/)
          || t.match(/スカウト受信数\s*(\d+)\s*通/) || t.match(/受信数\s*(\d+)\s*通/)
          || t.match(/スカウト受信\s*(\d+)\s*通/) || t.match(/受信\s*(\d+)\s*通/);
      var sc2=t.match(/エン転職スカウト\s*(\d+)\s*件/);
      function gg(re){ var x=t.match(re); return x?String(x[1]).trim():''; }
      return {
        id:id,
        age:age,
        sex:sex,
        addr:prefOf(raw),
        jyo:(/在職中/.test(t)?'在職':(/離職中/.test(t)?'離職':'')),
        gaku:edField(raw, /^\s*最終学歴\s*[:：]?\s*(.*)$/),
        /* 「言語」「語学」の欄は空のことがある。空なら外国籍の手がかりにしない。
           値が次の行に回る作りもあるので、次の行が別の項目名なら空として扱う */
        lang:edField(raw, /^\s*(?:その他言語|語学|言語)\s*[:：]?\s*(.*)$/),
        /* 判定に使うのは学歴・語学・資格の行だけ。
           職務経歴に出てくる国名などで誤判定しないようにする */
        judgeText:raw.split(/\n+/).filter(function(line){
          return /学歴|学校|大学|大學|専門|高校|高等|短大|高専|語学|言語|資格|検定/.test(line);
        }).join(' '),
        scout:sc?parseInt(sc[1],10):-1,
        scout2:sc2?parseInt(sc2[1],10):-1,
        text:t
      };
    },
    siteTotal:function(){
      var t=(document.body.innerText||'').replace(/\s+/g,' ');
      var m=t.match(/検索結果[^0-9]{0,12}([\d,]+)\s*[名件人]/)
         || t.match(/該当[^0-9]{0,8}([\d,]+)\s*[名件人]/)
         || t.match(/([\d,]+)\s*[名件人]\s*(?:が)?\s*該当/);
      return m?parseInt(m[1].replace(/,/g,''),10):0;
    },
    siteWide:null
  };

    return ADP;
  }

  function makeADP_mynavi(){
  /* =========================================================
     媒体アダプタ：マイナビ転職
     この枠の中だけが媒体ごとに違います。下の共通コアは4媒体で同じです。
     ========================================================= */

  var MN_HAS_GAKU=false;

  /* 候補者の本文は h2 の次に来る表。次の要素が表でないときは触らない。
     コンタクトメール画面には配信ボタンの枠が並んでおり、無条件に隠すと
     ボタンごと消えてしまうため。 */
  function mnCard(h2){
    var n=h2.nextElementSibling;
    return (n && n.tagName==='TABLE') ? n : null;
  }
  function mnText(h2){ return txtOf(h2)+' '+txtOf(mnCard(h2)); }

  /* 候補者の枠かどうか。検索条件の入力画面にも同じ h2.brdbB（「対象の求人を検索する」）が
     あり、これを候補者として拾うと、条件の入力欄まで絞り込みの対象になってしまう。
     一括操作用のチェックボックスを持つ h2 だけを候補者として扱う。 */
  function mnIsCand(h2){
    return !!h2.querySelector('input[name="batch_optn"], input[name="batch_optn_off"]');
  }
  /* 表の見出し（th）から、その行の値（td）を読む。
     マイナビの最終学歴は「2013年～2017年(卒業・修了)」の次の行に学校名が来るため、
     見出しの直後の数文字だけを読むと在学年しか取れず、学校名で判定できなかった。 */
  function mnField(tb, label){
    if(!tb) return null;
    var ths=qsa('th', tb);
    for(var i=0;i<ths.length;i++){
      if(txtOf(ths[i])===label){
        var td=ths[i].nextElementSibling;
        return td ? cardText(td).replace(/\u00a0/g,' ') : '';
      }
    }
    return null;
  }

  /* マイナビの一括操作は form[name=main_form] の「隠し」batch_optn を見る。
     行を display:none で隠すと、その行のチェックボックスまで jQuery の :hidden に
     該当してしまい、本来の隠しフィールドより先に拾われて誤配信の原因になる。
     そのため、隠す行のチェックボックスは name を batch_optn_off へ退避する。 */
  function mnSetVisible(h2, on){
    var tb=mnCard(h2);
    h2.style.display=on?'':'none';
    if(tb) tb.style.display=on?'':'none';
    var boxes=qsa('input[type="checkbox"]', h2).concat(tb?qsa('input[type="checkbox"]', tb):[]);
    boxes.forEach(function(c){
      if(on){ if(c.name==='batch_optn_off') c.name='batch_optn'; }
      else{ if(c.checked) mnSetCheck(c,false); if(c.name==='batch_optn') c.name='batch_optn_off'; }
    });
  }

  /* チェックの入れ外し。マイナビ側の画面処理（配信ボタンの表示など）が走るよう、
     実際のクリックとして扱う。クリックが効かない場合だけ値を入れて change を送る。 */
  function mnSetCheck(c, on){
    if(!c || c.disabled) return;
    if(!!c.checked !== !!on){ try{ c.click(); }catch(e){} }
    if(!!c.checked !== !!on){
      c.checked=!!on;
      try{ c.dispatchEvent(new Event('click',{bubbles:true})); }catch(e){}
    }
    try{ c.dispatchEvent(new Event('change',{bubbles:true})); }catch(e){}
  }

  /* マイナビ標準の「一括チェック」は非表示の行まで選んでしまうので、
     表示中の行だけを対象にするよう差し替える */
  function mnPatchCheckAll(){
    var btn=document.getElementById('checkAll');
    /* 検索履歴・保存条件の一覧にも同じ id の「一括チェック」がある。
       候補者の一覧でない画面では差し替えない（マイナビ本来の動きを残す） */
    if(!qsa('h2.brdbB').some(mnIsCand)) return;
    if(!btn || btn.dataset.sfPatched==='1') return;
    btn.dataset.sfPatched='1'; btn.dataset.sfOn='0';
    var nb=btn.cloneNode(true);
    btn.parentNode.replaceChild(nb, btn);
    nb.addEventListener('click', function(ev){
      ev.preventDefault(); ev.stopImmediatePropagation();
      var on=(this.dataset.sfOn==='1');
      qsa('h2.brdbB').forEach(function(h2){
        var c=h2.querySelector('input[name="batch_optn"]');
        if(c) mnSetCheck(c, (h2.style.display==='none') ? false : !on);
      });
      this.dataset.sfOn = on?'0':'1';
      this.textContent = on?'一括チェック':'一括解除';
      return false;
    }, true);
  }

  var ADP={
    site:'mynavi',
    label:'マイナビ転職',
    color:'#0b6cbf',
    abort:false,
    hasScout:true,
    hasGaku:false,
    note:'',
    col5:{ head:'受信', get:function(r){ return {text:(r.scout>=0? r.scout+'通' : '-'), color:(r.scout>=0 && r.scout<=5)?'#27ae60':'#555'}; } },
    wideReason:'マイナビ転職は検索条件に年齢・スカウト受信数の指定が無いため、ページごとの絞り込みになります',
    /* 一覧が無いと分かっている画面。ここではパネルもボタンも出さない */
    notList:/setMailView|MailView|scoutcommunication|ctsm_searchScouttarget_form|ctsm_chkSearchScouttarget|ctsm_listPickupAll_form|ctsm_listSearchHistory_form/i,

    prescan:function(){
      mnPatchCheckAll();
      ADP.skipBulkIntercept=!!document.getElementById('checkAll');
      MN_HAS_GAKU=qsa('h2.brdbB').filter(mnIsCand).some(function(h2){ return /最終学歴/.test(mnText(h2)); });
      ADP.hasGaku=MN_HAS_GAKU;
      ADP.note=MN_HAS_GAKU?'':'※この画面は学歴が読めないため、判定は本文の語句だけになります';
    },
    rows:function(){ return qsa('h2.brdbB').filter(mnIsCand); },
    cb:function(h2){
      var tb=mnCard(h2);
      return h2.querySelector('input[name="batch_optn"], input[name="batch_optn_off"]')
          || (tb?tb.querySelector('input[name="batch_optn"], input[name="batch_optn_off"]'):null);
    },
    /* 標準の「一括チェック」がある画面では差し替え済みなので共通側の横取りは不要。
       コンタクトメール画面のようにボタンが無い画面では、共通側のボタンを出す。
       prescan で毎回見直す。 */
    skipBulkIntercept:true,
    setVisible:mnSetVisible,
    /* 値を代入するだけだと、マイナビ側が数えている選択件数に反映されず、
       配信ボタンが出ないことがある。実際のクリックとして入れる。 */
    clickCb:mnSetCheck,
    parse:function(h2){
      var link=h2.querySelector('a');
      var id=link?txtOf(link):'';
      var tb=mnCard(h2);
      var fs=tb?qsa('.fs24', tb):[];
      var age=-1, sex='', scout=-1;
      for(var i=0;i<fs.length;i++){
        var nx=fs[i].nextSibling ? String(fs[i].nextSibling.textContent||'').trim() : '';
        if(nx.indexOf('才')===0 && age<0){
          age=num(txtOf(fs[i]));
          sex=nx.indexOf('男性')>-1?'男性':(nx.indexOf('女性')>-1?'女性':'');
        }
        if(nx.indexOf('通')===0 && scout<0) scout=num(txtOf(fs[i]));
      }
      /* 保存リスト画面など、受信数が「直近30日のスカウト受信」の行にある表にも対応 */
      if(scout<0 && tb){
        qsa('tr', tb).some(function(tr){
          if(txtOf(tr).indexOf('直近30日のスカウト受信')>-1){ var f=tr.querySelector('.fs24'); if(f){ scout=num(txtOf(f)); return true; } }
          return false;
        });
      }
      var card=txtOf(tb);
      var all=txtOf(h2)+' '+card;
      /* 最終学歴：在学年の行を除いた学校名の部分だけを判定に使う */
      var gRaw=mnField(tb,'最終学歴');
      var gaku=(gRaw==null)?'':String(gRaw)
        .replace(/\d{4}年\s*[～~〜-]\s*(\d{4}年)?\s*(\([^)]*\))?/g,' ')
        .replace(/\s+/g,' ').trim();
      /* 語学：TOEIC・TOEFL・英検の欄は全員に出るので、それ以外の言語が書かれているときだけ拾う */
      var lRaw=mnField(tb,'語学');
      var lang=(lRaw==null)?'':String(lRaw)
        .replace(/(TOEIC|TOEFL|英検)\s*[:：]\s*[^\s]*/g,' ')
        .replace(/[-－―\s\/／]+/g,' ').trim();
      return {
        id:id,
        age:age,
        sex:sex,
        addr:prefOf(card),
        jyo:(/再|予約中|送信済|辞退/.test(txtOf(h2))?'送信済':''),
        gaku:gaku,
        lang:lang,
        scout:scout,
        text:all
      };
    },
    siteTotal:function(){
      var t=(document.body.innerText||'').replace(/\s+/g,' ');
      var m=t.match(/検索結果[^0-9]{0,12}([\d,]+)\s*人/)
         || t.match(/該当[^0-9]{0,8}([\d,]+)\s*人/)
         || t.match(/([\d,]+)\s*人\s*が?\s*該当/);
      return m?parseInt(m[1].replace(/,/g,''),10):0;
    },
    siteWide:null
  };

    return ADP;
  }

  function makeADP_doda(){
  /* =========================================================
     媒体アダプタ：dodaダイレクト
     この枠の中だけが媒体ごとに違います。下の共通コアは4媒体で同じです。
     dodaは画面内で一覧が差し替わる作りなので、行が増えたら自動でかけ直します。
     ========================================================= */

  var DD_HAS_GAKU=false;

  /* 「会員No.」と年齢の両方を持つ要素の兄弟をひとかたまりの一覧と見なす。
     doda はクラス名が変わることがあるため、決め打ちのセレクタは使わない。 */
  function ddCards(){
    var out=[], seen=[];
    function push(list){
      list.forEach(function(s){ if(seen.indexOf(s)<0){ seen.push(s); out.push(s); } });
    }
    function looksCard(node){
      var t=node.textContent||'';
      return t.indexOf('会員No.')>-1 && /\d+歳/.test(t);
    }
    try{
      var walker=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      var node;
      while((node=walker.nextNode())){
        if(String(node.textContent||'').indexOf('会員No.')<0) continue;
        var e=node.parentElement, depth=0;
        while(e && e!==document.body && depth<8){
          var p=e.parentElement;
          if(!p) break;
          var sibs=Array.prototype.filter.call(p.children, looksCard);
          if(sibs.length>=2){ push(sibs); return out; }
          e=p; depth++;
        }
      }
      if(!out.length){
        qsa('input[type="checkbox"]').forEach(function(c){
          var idn=((c.id||'')+' '+(c.name||'')).toLowerCase();
          if(/all|select/.test(idn)) return;
          var e=c.parentElement, depth=0;
          while(e && e!==document.body && depth<8){
            if(looksCard(e)){
              var p=e.parentElement;
              if(p){
                var sibs=Array.prototype.filter.call(p.children, looksCard);
                if(sibs.length>=2){ push(sibs); return; }
              }
              push([e]);
              break;
            }
            e=e.parentElement; depth++;
          }
        });
      }
    }catch(e){}
    return out;
  }

  var ADP={
    site:'doda',
    label:'dodaダイレクト',
    color:'#0b8a5b',
    abort:false,
    hasScout:true,
    hasSalary:true,
    hasGaku:false,
    note:'',
    col5:{ head:'受信', get:function(r){ return {text:(r.scout>=0? r.scout+'通' : '-'), color:(r.scout>=0 && r.scout<=5)?'#27ae60':'#555'}; } },
    wideReason:'dodaダイレクトは検索条件に年齢・受信数の指定が無いため、ページごとの絞り込みになります',
    /* 一覧が無いと分かっている画面。ここではパネルもボタンも出さない */
    notList:/ScoutSendCreate|ScoutSend|SendComplete|MailCreate|Preview/i,
    /* v7.4：応募者管理は一覧を扱わない画面。何も出さない */
    blocked:/ApplicantManagement/i,

    prescan:function(){
      var cs=ddCards();
      DD_HAS_GAKU=cs.some(function(c){ return /最終学歴/.test(c.textContent||''); });
      ADP.hasGaku=DD_HAS_GAKU;
      ADP.note=DD_HAS_GAKU?'':'※この画面は学歴が読めないため、判定は本文の語句だけになります';
    },
    rows:ddCards,
    cb:function(card){
      var list=qsa('input[type="checkbox"]', card);
      for(var i=0;i<list.length;i++){
        var idn=((list[i].id||'')+' '+(list[i].name||'')).toLowerCase();
        if(/all|select/.test(idn)) continue;
        return list[i];
      }
      return null;
    },
    setVisible:function(card, on){
      card.style.setProperty('display', on?'':'none', 'important');
      if(!on) qsa('input[type="checkbox"]', card).forEach(function(c){ c.checked=false; });
    },
    parse:function(card){
      var raw=cardText(card);
      /* 空白を詰めきると「会員No.100129歳」のように会員番号と年齢がつながって
         読み違えるため、1つの半角スペースに揃えるだけにして桁も2桁までに限る。 */
      var t=raw.replace(/\s+/g,' ');
      var id=((t.match(/会員No\.?\s*([A-Za-z0-9\-]+)/)||[])[1])||'';
      var age=-1, m=t.match(/(?:^|[^0-9])(\d{1,2})\s*歳/); if(m) age=parseInt(m[1],10);
      /* 性別は年齢のすぐ隣の表記を最優先で採る。本文の「男性活躍中」などに
         引っ張られて女性候補者を男性と誤判定しないようにするため。 */
      var sex='';
      var g=t.match(/\d{1,2}\s*歳\s*[\/／・]?\s*(男性|女性)/) || t.match(/\d{1,2}\s*歳\s*[\/／・]?\s*(男|女)(?![性])/);
      if(g) sex=g[1];
      else if(/(?:^|[^活躍歓迎募集多])女性/.test(t)) sex='女性';
      else if(/(?:^|[^活躍歓迎募集多])男性/.test(t)) sex='男性';
      /* 一覧の「岐阜県／400万円／在職中／…」の金額が現年収。在職状況の直前を優先する */
      var sal=-1, sm=t.match(/(\d{2,4})\s*万円\s*[／\/]\s*(?:在職中|離職中|在学中)/) || t.match(/[／\/]\s*(\d{2,4})\s*万円\s*[／\/]/);
      if(sm) sal=parseInt(sm[1],10);
      var sc=t.match(/スカウト受信数\s*(\d+)\s*通/) || t.match(/受信数\s*(\d+)\s*通/) || t.match(/受信\s*(\d+)\s*通/);
      function gg(re){ var x=t.match(re); return x?String(x[1]).trim():''; }
      return {
        id:id,
        age:age,
        sex:sex,
        addr:prefOf(raw),
        jyo:'',
        gaku:gg(/最終学歴\s*[:：]?\s*([^\s]{0,26})/),
        lang:gg(/その他言語\s*[:：]?\s*([^\s]{0,20})/),
        scout:sc?parseInt(sc[1],10):-1,
        sal:sal,
        text:t
      };
    },
    siteTotal:function(){
      var t=(document.body.innerText||'').replace(/\s+/g,' ');
      var m=t.match(/検索結果[^0-9]{0,12}([\d,]+)\s*[名件人]/)
         || t.match(/該当[^0-9]{0,8}([\d,]+)\s*[名件人]/)
         || t.match(/([\d,]+)\s*[名件人]\s*が?\s*該当/);
      return m?parseInt(m[1].replace(/,/g,''),10):0;
    },
    siteWide:null
  };

    return ADP;
  }

  /* ===== 開いているサイトを見て、使うアダプタを決める ===== */
  var HOST=location.hostname;
  var ADP = /(^|\.)en-japan\.com$/.test(HOST)     ? (/\/endirect\//.test(location.pathname) ? makeADP_endirect() : makeADP_en())
          : /(^|\.)mynavi\.jp$/.test(HOST)        ? makeADP_mynavi()
          : /(^|\.)doda\.jp$/.test(HOST)          ? makeADP_doda()
          : null;
  /* エン転職（/company/）は、同じファイルの後半にある「エン統合ツール」が担当する */
  if(window.__SF_EN_BY_TOOL__ && ADP && ADP.site==='en') return;
  if(!ADP || ADP.abort) return;

  /* =========================================================
     ここから下は4媒体すべて同じコードです。
     媒体ごとに違うのは、上のアダプタ（行の探し方・値の読み方）だけ。
     画面の並び、ボタンの文言、判定の考え方は4媒体で完全に揃えてあります。
     ========================================================= */

  /* ---------- 外国籍の要確認判定（4媒体で共通） ----------
     日本語能力試験・JLPT を最優先に見る。日本語を母語としない人しか受けない試験なので
     誤検出が少ない。次に学歴のキーワード、英字2語以上の校名、その他言語、学歴空欄の順。
     あくまで「確認してください」という目印であって、国籍を断定するものではない。 */
  var FOREIGN_HINTS = ['インドネシア','ベトナム','フィリピン','ネパール','ミャンマー','カンボジア','ラオス',
    'モンゴル','スリランカ','バングラデシュ','パキスタン','ウズベキスタン','キルギス','マレーシア',
    'ブラジル','ペルー','ボリビア','ロシア','ウクライナ','日本語学校','語学院','大學','國際','國立',
    'ジャパンキャンパス','日本校','インターナショナルスクール','日本語学科','日本語別科','外国語学校','華僑',
    'University','College','Institute','Universidad','Universitas'];

  function foreignHint(text){
    if(!text) return '';
    for(var i=0;i<FOREIGN_HINTS.length;i++){
      if(text.indexOf(FOREIGN_HINTS[i])>-1) return FOREIGN_HINTS[i];
    }
    if(/[•·][ァ-ヶー]/.test(text)) return '学校名にカタカナ区切り';
    /* 日本の学校名は漢字・かな表記が原則。英字の単語が2つ以上並ぶ校名は要確認とする。
       「ECC国際外語専門学校」「NHK学園」のような英字1語の日本の学校は対象外。 */
    var w=String(text).match(/[A-Za-z][A-Za-z'.\-]*/g);
    if(w){
      var n=0;
      for(var j=0;j<w.length;j++){ if(w[j].length>=2) n++; }
      if(n>=2) return '学校名が英字表記';
    }
    return '';
  }

  function judge(r){
    var all=r.text||'';
    if(/日本語能力試験|JLPT/.test(all)) return '日本語能力試験';
    if(ADP.hasGaku){
      var h=foreignHint(r.gaku);
      if(h) return h;
      if(r.lang && !/^-+$/.test(r.lang)) return 'その他言語 '+String(r.lang).slice(0,10);
      if(!r.gaku || /^-+$/.test(r.gaku)) return '学歴の記載なし';
    }else{
      var hg=foreignHint(r.gaku||'');
      if(hg) return hg;
    }
    /* 本文からの拾い読みは誤判定が出やすい（職務経歴に国名が出るなど）。
       アダプタが判定用の範囲を渡してきたら、そこだけを見る。 */
    var scope=(r.judgeText!=null)?r.judgeText:all;
    if(!scope) return '';
    var h2=foreignHint(scope.slice(0,4000));
    if(h2 && h2!=='学校名が英字表記') return h2;
    return '';
  }

  /* ---------- 状態 ---------- */
  var VER='7.5';   /* build.py が差し込む */
  var LAST_KEY='scoutFilterCond_'+ADP.site;
  var LIST=[], VIEW=[], logEl=null, panel=null;

  function scan(){
    if(ADP.prescan) ADP.prescan();
    /* 読み取りの前に、こちらが隠した行だけ表示に戻す。
       媒体側がページ送りのために隠している行は、この画面にいない人なので触らない。
       （dodaは1ページ分だけ表示して残りを隠す作りのため、ここを区別しないと
         画面外の人まで一覧に出てきて、一括チェックで選ばれてしまう） */
    ADP.rows().forEach(function(row){ if(row.dataset && row.dataset.sfHidden==='1') setVis(row, true); });
    LIST=ADP.rows().filter(visibleNow).map(function(row){
      var r=ADP.parse(row)||{};
      r.el=row;
      r.sex=normSex(r.sex);
      r.hint=judge(r);
      return r;
    });
    return LIST.length;
  }
  /* いま画面に出ている行かどうか。媒体側がページ送りのために隠している行と、
     こちらが絞り込みで隠した行を区別するため、隠したときに印を付けておく。 */
  function visibleNow(row){
    try{ return getComputedStyle(row).display!=='none'; }catch(e){ return true; }
  }
  function setVis(row, on){
    try{
      ADP.setVisible(row, on);
      if(row.dataset){ if(on) delete row.dataset.sfHidden; else row.dataset.sfHidden='1'; }
    }catch(e){}
  }
  function cbOf(r){ try{ return ADP.cb(r.el); }catch(e){ return null; } }
  function isChecked(r){ var c=cbOf(r); return !!(c && !c.disabled && c.checked); }
  function setCheck(r, on){
    var c=cbOf(r);
    if(!c || c.disabled) return false;
    if(!!c.checked !== !!on){ if(ADP.clickCb) ADP.clickCb(c, on); else c.click(); }
    return true;
  }
  function clearAllChecks(){
    ADP.rows().forEach(function(row){
      var c=null; try{ c=ADP.cb(row); }catch(e){}
      if(c && !c.disabled && c.checked){ if(ADP.clickCb) ADP.clickCb(c,false); else c.click(); }
    });
  }
  function pageChecked(){
    var n=0;
    ADP.rows().forEach(function(row){
      var c=null; try{ c=ADP.cb(row); }catch(e){}
      if(c && !c.disabled && c.checked) n++;
    });
    return n;
  }
  /* 判定バッジから、その人の位置まで画面を動かす */
  function jumpTo(r){
    if(!r || !r.el) return;
    setVis(r.el, true);
    try{ r.el.scrollIntoView({behavior:'smooth', block:'center'}); }catch(e){ r.el.scrollIntoView(); }
    var o=r.el.style.outline, f=r.el.style.outlineOffset;
    r.el.style.outline='4px solid #e8500e'; r.el.style.outlineOffset='2px';
    setTimeout(function(){ r.el.style.outline=o||''; r.el.style.outlineOffset=f||''; }, 4000);
  }

  /* 候補者一覧そのものに目印を付ける。パネルを見に行かなくても、
     一覧をスクロールしているだけで要確認の人が分かるようにする。 */
  function markRows(){
    qsa('.sfFlagTag').forEach(function(t){ t.remove(); });
    LIST.forEach(function(r){
      if(!r.el) return;
      if(!r.flag){ if(r._marked){ r.el.style.boxShadow=''; r._marked=false; } return; }
      var tag=el('span','display:inline-block;background:#e8500e;color:#fff;font-size:11px;font-weight:bold;line-height:1.6;padding:1px 9px;border-radius:3px;margin:4px 8px 4px 0;font-family:sans-serif;vertical-align:middle','要確認: '+(r.flagTxt||r.hint));
      tag.className='sfFlagTag';
      try{ r.el.insertBefore(tag, r.el.firstChild); }catch(e){ return; }
      r.el.style.boxShadow='inset 4px 0 0 #e8500e';
      r._marked=true;
    });
  }
  function log(m, color){ if(logEl){ logEl.textContent=m; logEl.style.color=color||'#0b6cbf'; } }
  function fmtN(n){ return (n==null?0:n).toLocaleString(); }

  /* ---------- パネル ---------- */
  var PRESET_KEY='scoutFilterPresets_v1';
  /* v6.0 社名を隠すモード（画面共有用）。ONの間は、プリセット名を「候補1」「候補2」…で表示する（保存名はそのまま）。 */
  var MASK_KEY='scoutFilterMask_v1';
  function maskOn(){ try{ return localStorage.getItem(MASK_KEY)==='1'; }catch(e){ return false; } }
  function dispName(n){
    if(!n || !maskOn()) return n||'';
    var names=Object.keys(loadPresets()).sort(), i=names.indexOf(n);
    return i>=0 ? '候補'+(i+1) : '候補';
  }
  function loadPresets(){ try{ return JSON.parse(localStorage.getItem(PRESET_KEY)||'{}'); }catch(e){ return {}; } }
  function savePresets(o){ try{ localStorage.setItem(PRESET_KEY, JSON.stringify(o)); }catch(e){} }

  panel=el('div','position:fixed;top:60px;right:14px;width:452px;max-height:calc(100vh - 76px);overflow-y:auto;z-index:2147483646;background:#fff;border:2px solid '+ADP.color+';border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.25);font-family:sans-serif;font-size:12px;color:#333;line-height:1.5');
  panel.id='scoutFilterPanel';
  panel.innerHTML=
      '<div id="sfHead" style="background:'+ADP.color+';color:#fff;padding:8px 10px;border-radius:5px 5px 0 0;display:flex;flex-wrap:nowrap;white-space:nowrap;align-items:center;cursor:move;position:sticky;top:0;z-index:2">'
    + '<b id="sfHeadTitle" style="font-size:13px;flex:none">スカウト絞り込み</b>'
    + '<span id="sfHeadPre" style="display:none;margin-left:8px;font-size:14px;font-weight:bold;background:#fff;color:'+ADP.color+';padding:1px 10px;border-radius:10px;min-width:0;flex:0 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>'
    + '<span id="sfHeadLab" title="'+ADP.label+' ／ v'+VER+'" style="margin-left:8px;font-size:10px;opacity:.9;flex:none">'+ADP.label+'</span>'
    + '<span id="sfHeadCount" title="絞り込みの結果／この画面の人数" style="margin-left:auto;flex:none;font-size:11px;font-weight:bold;background:rgba(255,255,255,.22);padding:1px 9px;border-radius:10px;white-space:nowrap">—</span>'
    + '<span id="sfOff" title="この画面だけ絞り込みを止めて、全員を表示に戻します" style="cursor:pointer;flex:none;margin-left:6px;padding:1px 9px;border-radius:9px;background:rgba(255,255,255,.28);font-size:11px">解除</span>'
    + '<span id="sfMin" title="小さくする" style="cursor:pointer;padding:0 7px;font-size:15px">−</span>'
    + '<span id="sfClose" title="閉じる（絞り込みはそのまま続きます）" style="cursor:pointer;padding:0 5px;font-size:15px">×</span></div>'

    + '<div id="sfBody" style="padding:10px">'

    /* STEP1 */
    + '<div style="padding:9px;background:#f7f9fb;border:1px solid #dde5ec;border-radius:5px">'
    + '<div style="font-size:11px;font-weight:bold;color:#55606b;margin-bottom:6px">STEP1　条件を入れる<span id="sfPreNow" style="margin-left:8px;padding:2px 10px;border-radius:3px;background:#e3eefa;color:#0b6cbf;font-size:14px;display:none"></span></div>'
    /* 4媒体とも同じ並び。1行に収まるよう幅を詰めてある */
    + '<div style="display:flex;gap:5px;align-items:center;white-space:nowrap;font-size:11px">'
    + '<b>性別</b><select id="sfSex" style="padding:2px;width:68px;font-size:11px"><option>指定なし</option><option>男性</option><option>女性</option></select>'
    + '<b style="margin-left:4px">年齢</b><input type="number" id="sfLo" value="20" style="width:40px;padding:2px;font-size:11px">〜<input type="number" id="sfHi" value="29" style="width:40px;padding:2px;font-size:11px">歳'
    + '<span id="sfScoutWrap"'+(ADP.hasScout?'':' style="display:none"')+'><b style="margin-left:4px">受信</b><input type="number" id="sfScout" value="" placeholder="―" style="width:44px;padding:2px;font-size:11px">通以下</span>'
    + '<span id="sfSalWrap"'+(ADP.hasSalary?'':' style="display:none"')+'><b style="margin-left:4px">年収</b><input type="number" id="sfSal" value="" placeholder="―" step="10" min="0" style="width:52px;padding:2px;font-size:11px">万円以下<select id="sfSalStep" title="矢印キーで増減する幅" style="padding:1px;font-size:11px;margin-left:2px"><option value="10">10刻み</option><option value="50">50刻み</option></select></span>'
    + '</div>'
    + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:6px">'
    + '<span style="font-size:11px">除外ワード</span><input type="text" id="sfNg" placeholder="卒業見込み 在学中" style="flex:1;min-width:120px;padding:3px">'
    + '<label style="font-size:11px;cursor:pointer"><input type="checkbox" id="sfFor" checked> 外国籍の可能性を判定</label>'
    + '</div>'
    /* プリセット：クライアントごとの条件を名前を付けて覚えておく */
    + '<div style="display:flex;flex-wrap:nowrap;gap:4px;align-items:center;margin-top:7px;padding-top:7px;border-top:1px dashed #dde5ec;font-size:11px;line-height:1.2">'
    + '<b style="flex:none;white-space:nowrap">プリセット</b><select id="sfPre" style="padding:4px;flex:none;width:130px;max-width:130px;font-size:13px;font-weight:bold;text-overflow:ellipsis"><option value="">選択してください</option></select>'
    + '<input type="text" id="sfPreName" placeholder="名前（社名など）" style="flex:1 1 70px;min-width:60px;padding:4px;font-size:12px">'
    + '<button id="sfPreSave" style="flex:none;white-space:nowrap;padding:3px 9px;background:#55606b;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px">保存</button>'
    + '<button id="sfPreDel" style="flex:none;white-space:nowrap;padding:3px 8px;cursor:pointer;font-size:11px">削除</button>'
    + '<button id="sfPreMask" type="button" style="flex:none;white-space:nowrap;padding:3px 7px;cursor:pointer;font-size:11px;border:1px solid #bbb;border-radius:3px;background:#fff"></button>'
    + '</div></div>'

    /* STEP2 */
    + '<div style="padding:9px;background:#fff7ec;border:1px solid #f0d3a8;border-radius:5px;margin-top:8px">'
    + '<div style="font-size:11px;font-weight:bold;color:#8a6a2a;margin-bottom:6px">STEP2　絞り込む</div>'
    + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
    + '<button id="sfRun" style="padding:6px 16px;background:#0b6cbf;color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer">このページで絞り込み</button>'
    + '<span id="sfCount" style="font-size:13px;font-weight:bold;color:#0b6cbf"></span>'
    + '</div>'
    + '<div style="font-size:10px;color:#8a7a55;margin-top:6px;line-height:1.7">4媒体とも、条件に合わない人をこのページから非表示にします。元の一覧から消すわけではありません。</div>'
    /* エン転職だけに備わっている追加機能。基本操作と同じ見た目にすると
       媒体ごとに手順が違うように見えるので、一段下げた扱いにしてある。 */
    + '<div id="sfWideWrap" style="'+(ADP.siteWide?'display:flex':'display:none')+';margin-top:8px;padding-top:8px;border-top:1px dashed #e6cfa8;gap:8px;align-items:center;flex-wrap:wrap">'
    + '<span style="font-size:10px;font-weight:bold;color:#8a6a2a;background:#f6e4c6;padding:2px 7px;border-radius:3px">追加機能</span>'
    + '<button id="sfWide" style="padding:5px 13px;background:#fff;color:#e8500e;border:1px solid #e8500e;border-radius:4px;font-weight:bold;cursor:pointer">サイト全体へ反映</button>'
    + '<span style="font-size:10px;color:#8a7a55;flex:1;min-width:150px">検索条件そのものを年齢・性別で書き換えます。ページをめくっても条件が続き、件数自体が減ります。</span>'
    + '</div>'
    + '<div id="sfStat" style="margin-top:7px;font-size:11px;color:#12463a;background:#eef7f2;border-left:4px solid #0b8a5b;padding:5px 8px;border-radius:3px;display:none"></div>'
    + '<div id="sfLog" style="margin-top:6px;font-size:11px;min-height:15px"></div>'
    + '</div>'

    /* STEP3 */
    + '<div style="padding:9px;background:#f2faf6;border:1px solid #c4e6d5;border-radius:5px;margin-top:8px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:11px;font-weight:bold;color:#12463a">STEP3　上から選ぶ</span><span id="sfSel" style="font-weight:bold;color:#333;font-size:12px">チェック 0名</span></div>'
    + '<div style="display:flex;gap:4px;align-items:center;flex-wrap:nowrap;white-space:nowrap">'
    + '<span style="font-size:11px;color:#555">上から <input type="number" id="sfTopN" value="30" style="width:50px;padding:3px"> 件</span>'
    + '<button id="sfTop" style="padding:5px 8px;font-size:11px;background:#0b8a5b;color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer">この件数にチェック</button>'
    + '<button id="sfAll" style="padding:5px 8px;font-size:11px;cursor:pointer;border:1px solid #0b8a5b;background:#fff;color:#0b8a5b;border-radius:4px">表示中の全員</button>'
    + '<button id="sfClr" style="padding:5px 8px;font-size:11px;cursor:pointer">チェックを外す</button>'
    + '</div></div>'

    /* 一覧 */
    + '<div style="display:grid;grid-template-columns:28px 1fr 34px 34px 46px 1.2fr;background:#ecf0f1;padding:4px 6px;font-weight:bold;color:#556;font-size:10px;margin-top:9px">'
    + '<span>#</span><span>会員No／居住地</span><span>年齢</span><span>性別</span><span>'+ADP.col5.head+'</span><span>判定</span></div>'
    + '<div id="sfList" style="max-height:360px;overflow:auto;border:1px solid #eee"><div style="padding:16px;color:#999;text-align:center;font-size:11px">STEP2 の「このページで絞り込み」を押してください</div></div>'

    + '<div style="font-size:10px;color:#8a94a0;margin-top:5px;line-height:1.7">チェックのボタンは、押すたびに画面のチェックを一度すべて外してから入れ直します。押すほど増えることはありません。外国籍の可能性がある人には自動でチェックを入れません。該当する方には、候補者一覧そのものにもオレンジの「要確認」ラベルが付きます。パネルを閉じていてもラベルは残るので、一覧を見ながら確認できます。パネルの「要確認」を押すと、その人のところまで画面がスクロールします。行をクリックすると個別に選び外しができ、選んだ行は青くなります。<br>このツールは候補者を選ぶところまでで、送信や登録は行いません。元の一覧から人を削除することもありません。</div>'
    + '</div>';

  document.body.appendChild(panel);
  logEl=panel.querySelector('#sfLog');
  /* v4.4：年齢・性別・受信数・除外ワードは、変えた時点で保存する（絞り込みを押さずに閉じても残る） */
  ['#sfSex','#sfLo','#sfHi','#sfScout','#sfSal','#sfSalStep','#sfNg','#sfFor'].forEach(function(id){
    var e=panel.querySelector(id); if(!e) return;
    e.addEventListener('change', function(){ try{ saveLast(); }catch(x){} });
    e.addEventListener('input', function(){ try{ saveLast(); }catch(x){} });
  });
  function q(id){ return panel.querySelector(id); }
  (function(){
    var st=q('#sfSalStep'), sl=q('#sfSal'); if(!st||!sl) return;
    function ap(){ sl.step=st.value; }
    st.addEventListener('change', ap); ap();
  })();

  /* 候補者の一覧が無い画面（スカウト送信画面やポップアップなど）ではパネルを出さない。
     代わりに小さなボタンだけ置き、一覧が出てきたら自動でパネルに切り替える。
     開いたまま／閉じたままはページを移動しても引き継ぐ。閉じていても絞り込みは効いたまま。 */
  var OPEN_KEY='scoutFilterOpen_'+ADP.site;
  var MIN_KEY='scoutFilterMin_'+ADP.site;
  function wantOpen(){ try{ return localStorage.getItem(OPEN_KEY)!=='0'; }catch(e){ return true; } }
  function setWantOpen(v){ try{ localStorage.setItem(OPEN_KEY, v?'1':'0'); }catch(e){} }
  function wantMin(){ try{ return localStorage.getItem(MIN_KEY)==='1'; }catch(e){ return false; } }
  function setWantMin(v){ try{ localStorage.setItem(MIN_KEY, v?'1':'0'); }catch(e){} }

  /* 右下のボタンの位置。dodaダイレクトは画面右下に媒体側のボタンがあり重なるため、
     dodaだけ左下を初期位置にする。どの媒体でもボタンをつかんで動かせ、置いた場所は覚える。 */
  var CHIP_KEY='scoutFilterChipPos_'+ADP.site;
  var chipSide=(ADP.site==='doda')?'left:14px':'right:14px';
  var chip=el('div','position:fixed;bottom:14px;'+chipSide+';z-index:2147483646;background:'+ADP.color+';color:#fff;padding:5px 12px;border-radius:16px;font-family:sans-serif;font-size:13px;line-height:1.3;font-weight:bold;white-space:nowrap;max-width:min(420px,calc(100vw - 28px));cursor:grab;box-shadow:0 2px 8px rgba(0,0,0,.3);display:none;align-items:center;gap:8px');
  chip.title='クリックでパネルを開きます（ドラッグで移動できます）';
  /* v5.0：右下のボタンに「解除」を付けた。この画面だけ絞り込みを止めて全員を表示に戻す */
  var chipLab=el('span','min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap','スカウト絞り込み');
  var chipOff=el('span','background:rgba(255,255,255,.28);padding:1px 9px;border-radius:9px;font-size:11px;cursor:pointer;white-space:nowrap;flex:none','解除');
  chipOff.id='sfChipOff';
  chipOff.title='この画面だけ絞り込みを止めて、全員を表示に戻します';
  chip.appendChild(chipLab); chip.appendChild(chipOff);
  document.body.appendChild(chip);
  /* 前に動かした位置があれば、そこに戻す */
  (function(){
    var pos=null;
    try{ pos=JSON.parse(localStorage.getItem(CHIP_KEY)||'null'); }catch(e){}
    if(pos && pos.left!=null && pos.top!=null){
      chip.style.left=pos.left+'px'; chip.style.top=pos.top+'px';
      chip.style.right='auto'; chip.style.bottom='auto';
    }
  })();
  /* ドラッグで移動。少しでも動かしたときはパネルを開かない */
  (function(){
    var dx=0, dy=0, drag=false, moved=false;
    chip.addEventListener('mousedown', function(ev){
      drag=true; moved=false;
      var rc=chip.getBoundingClientRect();
      dx=ev.clientX-rc.left; dy=ev.clientY-rc.top;
      ev.preventDefault();
    });
    document.addEventListener('mousemove', function(ev){
      if(!drag) return;
      moved=true;
      var x=Math.max(0, Math.min(window.innerWidth-40, ev.clientX-dx));
      var y=Math.max(0, Math.min(window.innerHeight-24, ev.clientY-dy));
      chip.style.left=x+'px'; chip.style.top=y+'px';
      chip.style.right='auto'; chip.style.bottom='auto';
    });
    document.addEventListener('mouseup', function(){
      if(!drag) return;
      drag=false;
      if(!moved) return;
      var rc=chip.getBoundingClientRect();
      try{ localStorage.setItem(CHIP_KEY, JSON.stringify({left:Math.round(rc.left), top:Math.round(rc.top)})); }catch(e){}
      chip._justDragged=true;
      setTimeout(function(){ chip._justDragged=false; }, 200);
    });
  })();
  chip.onclick=function(ev){
    if(blockedHere()) return;
    if(chip._justDragged) return;        /* 動かしただけのときは開かない */
    if(ev && ev.target===chipOff){ pauseHere(true); return; }
    if(pausedHere()){ pauseHere(false); return; }
    setWantOpen(true); syncVisible(true); doRun();
  };

  var hasList=false;
  /* 一覧が見つからない画面の扱い。スカウト送信画面のように一覧が無いと分かっている
     ところでは何も出さない。それ以外は、読み取りに失敗したときの入口として
     右下のボタンだけ残しておく。 */
  /* v4.6：応募管理のように、このツールを一切働かせない画面。
     パネルもボタンも出さず、絞り込み・チェック操作・画面の書き換えをしない。
     画面内で遷移する作りのため、読み込み時だけでなく毎回見直す。 */
  function blockedHere(){ return !!(ADP.blocked && ADP.blocked.test(location.pathname)); }
  /* v5.0：この画面（URLのパス）だけ、絞り込みを止める。
     検討中人材リストのように、絞り込みが要らない画面で使う。止めた画面は覚えておき、
     右下のボタンを押すと再開する。止めている間は、隠した行を元に戻して何も操作しない。 */
  var OFF_KEY='scoutFilterOffPaths_'+ADP.site;
  function offList(){ try{ var a=JSON.parse(localStorage.getItem(OFF_KEY)||'[]'); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
  function pausedHere(){ return offList().indexOf(location.pathname)>-1; }
  function releaseAll(){
    try{
      ADP.rows().forEach(function(row){ if(row.dataset && row.dataset.sfHidden==='1') setVis(row, true); });
      LIST.forEach(function(r){ if(r.el && r._marked){ r.el.style.boxShadow=''; r._marked=false; } });
    }catch(e){}
    qsa('.sfFlagTag').forEach(function(x){ x.remove(); });
  }
  function pauseHere(on){
    var a=offList().filter(function(p){ return p!==location.pathname; });
    if(on) a.push(location.pathname);
    try{ localStorage.setItem(OFF_KEY, JSON.stringify(a)); }catch(e){}
    if(on){ releaseAll(); applied=false; lastN=-1; syncVisible(true); }
    else{ applied=false; lastN=-1; setWantOpen(true); syncVisible(true); tick(); }
  }
  function silentHere(){ return !!(ADP.notList && ADP.notList.test(location.pathname + location.search)); }
  function syncVisible(force){
    /* v7.1/v6.2 dodaの送信画面（ScoutSendCreate等）は、画面に候補者が1人載っていて「1/1」と判定されるため
       パネルとボタンが出ていた。notListに当たる画面ではdodaに限り何も出さない。 */
    if(ADP.site==='doda' && silentHere()){
      panel.style.display='none'; chip.style.display='none';
      qsa('.sfFlagTag').forEach(function(x){ x.remove(); });
      var swS=document.getElementById('sfSideWrap'); if(swS) swS.style.display='none';
      return;
    }
    if(blockedHere()){
      panel.style.display='none'; chip.style.display='none';
      qsa('.sfFlagTag').forEach(function(x){ x.remove(); });
      var sw=document.getElementById('sfSideWrap'); if(sw) sw.style.display='none';
      return;
    }
    if(pausedHere()){
      /* v7.3：停止中の表示は、候補者の一覧が出ている画面（検索結果）だけに出す。
         一覧が無い画面（トップ・条件入力・送信画面など）では何も出さない。 */
      if(!hasList){
        panel.style.display='none'; chip.style.display='none';
        qsa('.sfFlagTag').forEach(function(x){ x.remove(); });
        var swP=document.getElementById('sfSideWrap'); if(swP) swP.style.display='none';
        return;
      }
      panel.style.display='none';
      chipLab.textContent=(preName()?preName()+'　':'')+'絞り込み停止中（クリックで再開）';
      setTabTitle((preName()?preName()+' ':'')+'解除中');
      chipOff.style.display='none';
      chip.style.display='flex'; chip.style.background='#8a94a0';
      qsa('.sfFlagTag').forEach(function(x){ x.remove(); });
      var sw3=document.getElementById('sfSideWrap'); if(sw3) sw3.style.display='none';
      return;
    }
    chip.style.background=ADP.color; chipOff.style.display='';
    var sw2=document.getElementById('sfSideWrap'); if(sw2) sw2.style.display='block';
    if(!hasList && !force){
      panel.style.display='none';
      /* v7.4：dodaダイレクト／エン転職ダイレクトは、候補者一覧が出ている画面（検索結果）だけで表示する。
         トップ・応募管理など一覧が無い画面では、ボタンもサイドの枠も出さない。 */
      var onlyList=(ADP.site==='doda'||ADP.site==='endirect');
      chip.style.display=(silentHere()||onlyList)?'none':'flex';
      if(onlyList && sw2) sw2.style.display='none';
      return;
    }
    var open=wantOpen();
    panel.style.display=open?'block':'none';
    chip.style.display=open?'none':'flex';
    var b=panel.querySelector('#sfBody'), m=panel.querySelector('#sfMin');
    if(b){ var mini=wantMin(); b.style.display=mini?'none':'block'; if(m) m.textContent=mini?'＋':'−'; }
  }
  syncVisible(false);

  /* サイト全体へ反映：対応していない媒体ではボタンを残したまま理由を出す */
  (function(){
    var b=q('#sfWide');
    /* この媒体に無い機能なら、枠ごと出さない（上の sfWideWrap で非表示にしてある）。
       同じ媒体でも画面によって使えないときだけ、理由を添えてグレーにする。 */
    if(!ADP.siteWide) return;
    var ok=ADP.siteWide.available();
    if(!ok){
      b.disabled=true;
      b.style.background='#f2f3f5'; b.style.color='#9aa1a8'; b.style.borderColor='#d6d9dd'; b.style.cursor='not-allowed';
      b.title=ADP.wideReason||'この画面では使えません';
      b.onclick=function(){ log(ADP.wideReason||'この画面では使えません', '#c0392b'); };
      return;
    }
    b.onclick=function(){ ADP.siteWide.run(cond(), log, saveLast); };
  })();

  /* ---------- 条件 ---------- */
  function words(v){ return String(v||'').split(/[\s,、|]+/).filter(Boolean); }
  function cond(){
    var lo=parseInt(q('#sfLo').value,10); if(isNaN(lo)) lo=0;
    var hi=parseInt(q('#sfHi').value,10); if(isNaN(hi)) hi=99;
    var sc=parseInt(q('#sfScout').value,10);
    var sal=ADP.hasSalary?parseInt(q('#sfSal').value,10):NaN;
    return {sex:q('#sfSex').value, lo:lo, hi:hi,
            scoutMax:(isNaN(sc)?-1:sc),
            salMax:(isNaN(sal)?-1:sal),
            salStep:(q('#sfSalStep')?q('#sfSalStep').value:'10'),
            ng:words(q('#sfNg').value),
            useFor:q('#sfFor').checked,
            pre:(q('#sfPre')?q('#sfPre').value:'')};
  }
  /* v4.3：いま使っているプリセット名（社名）を STEP1 の見出しに出す */
  function showPreNow(name){
    var e=q('#sfPreNow'); if(!e) return;
    if(name){ e.textContent='適用中：'+dispName(name); e.style.display='inline-block'; }
    else { e.textContent=''; e.style.display='none'; }
    refreshPreLabels();
  }
  /* v6.0：社名を隠すモードを追加（dodaフィルターの機能を取り込み）。プリセット名・見出し・右下のボタン・タブのタイトルを「候補1」などに置き換える。 */
  /* v5.6：STEP3のボタンを1行に収め（チェック数は見出しの右へ）、一覧でShift+クリックの範囲選択に対応。 */
  /* v5.5：プルダウンが最長の社名に引っ張られて横に伸び、削除ボタンが下へ落ちていたため、プルダウンを幅130pxに固定して1行に収めた。 */
  /* v5.4：プリセット行の「プリセット」が縦に折れて行間が広がる不具合を修正（ラベルは折り返さず、入力欄・ボタンは必要なら次の行へ回す）。 */
  /* v5.2：社名（プリセット名）を見出し・右下のボタン・タブのタイトルにも出す */
  var _origTitle=document.title, _lastTitle='', _lastShort='';
  function preName(){ var s=q('#sfPre'); return s?dispName(s.value):''; }
  function setTabTitle(t){ _lastTitle=t; try{ document.title=t; }catch(e){} }
  function refreshPreLabels(){
    try{
      var n=preName();
      var hp=q('#sfHeadPre');
      if(hp){ hp.textContent=n; hp.title=n; hp.style.display=n?'inline-block':'none'; }
      /* 社名が入っているときは見出しの「スカウト絞り込み」を隠し、1行に収める */
      var ht=q('#sfHeadTitle'); if(ht) ht.style.display=n?'none':'';
      if(typeof chipLab!=='undefined' && chipLab && _lastShort){
        chipLab.textContent=(n?n+'　':'スカウト絞り込み ')+_lastShort;
      }
      if(_lastShort) setTabTitle((n?n+' ':'')+_lastShort);
    }catch(e){}
  }
  setInterval(function(){ if(_lastTitle && document.title!==_lastTitle) document.title=_lastTitle; }, 3000);
  function saveLast(){
    var c=cond(); c.ts=Date.now();
    try{ localStorage.setItem(LAST_KEY, JSON.stringify(c)); }catch(e){}
  }
  function loadLast(){
    try{
      var c=JSON.parse(localStorage.getItem(LAST_KEY)||'null');
      /* v4.4：年齢などの条件は期限なしで覚える。閉じて開き直しても前回の設定から始まる */
      if(!c) return null;
      return c;
    }catch(e){ return null; }
  }
  /* 条件を画面に入れ直す。プリセットの読み込みとページ移動後の復元で使う */
  function setCond(c){
    if(!c) return;
    q('#sfSex').value=c.sex||'指定なし';
    if(c.lo!=null) q('#sfLo').value=c.lo;
    if(c.hi!=null) q('#sfHi').value=c.hi;
    q('#sfScout').value=(c.scoutMax!=null && c.scoutMax>=0)?c.scoutMax:'';
    q('#sfSal').value=(c.salMax!=null && c.salMax>=0)?c.salMax:'';
    if(c.salStep){ q('#sfSalStep').value=c.salStep; q('#sfSal').step=c.salStep; }
    q('#sfNg').value=(c.ng&&c.ng.length)?c.ng.join(' '):'';
    q('#sfFor').checked=(c.useFor!==false);
  }
  function drawPresets(sel){
    var o=loadPresets(), s=q('#sfPre');
    var names=Object.keys(o).sort();
    s.innerHTML='<option value="">選択してください</option>'+names.map(function(n){
      return '<option value="'+n.replace(/"/g,'&quot;')+'">'+dispName(n)+'</option>';
    }).join('');
    if(sel && o[sel]) s.value=sel;
    showPreNow(s.value);
  }
  function selCount(){
    var n=0; LIST.forEach(function(r){ if(isChecked(r)) n++; });
    var e=q('#sfSel');
    if(e){
      var pg=pageChecked();
      e.textContent='チェック '+n+'名';
      e.style.color=(n===pg)?'#333':'#c0392b';
    }
  }

  /* ---------- 件数の見せ方（3媒体で同じ文言） ---------- */
  function showStat(matched, shown, hidden){
    var total=0;
    try{ total=ADP.siteTotal()||0; }catch(e){}
    var t=[];
    if(total) t.push('検索結果全体 '+fmtN(total)+'名');
    t.push('条件に合う '+fmtN(matched)+'名');
    t.push('このページ '+fmtN(shown)+' / '+fmtN(shown+hidden)+'名を表示');
    var e=q('#sfStat');
    e.style.display='block';
    var c=cond();
    var head='条件：性別 '+(c.sex||'指定なし')+' ／ 年齢 '+c.lo+'〜'+c.hi+'歳'
           +((ADP.hasScout && c.scoutMax>=0)?(' ／ 受信 '+c.scoutMax+'通以下'):'')
           +((ADP.hasSalary && c.salMax>=0)?(' ／ 年収 '+c.salMax+'万円以下'):'');
    e.textContent=head+'　｜　'+t.join('　→　');
    /* 性別を指定していないときは色を変えて気づけるようにする。
       ページを移動したあとに条件が消えていた場合の見落とし防止。 */
    if(c.sex==='指定なし'){
      e.style.color='#7a4a10'; e.style.background='#fff5e6'; e.style.borderLeftColor='#e8500e';
    }else{
      e.style.color='#12463a'; e.style.background='#eef7f2'; e.style.borderLeftColor='#0b8a5b';
    }
  }

  /* ---------- 描画 ---------- */
  function render(){
    var c=cond(), body=q('#sfList');
    if(!LIST.length){ body.innerHTML='<div style="padding:16px;color:#999;text-align:center;font-size:11px">この画面に候補者の一覧が見つかりませんでした</div>'; return; }
    var cutAge=0, cutSex=0, cutScout=0, cutNg=0, cutSal=0;
    VIEW=LIST.filter(function(r){
      if(c.sex!=='指定なし' && r.sex && r.sex!==c.sex){ cutSex++; return false; }
      if(r.age!=null && r.age>=0 && (r.age<c.lo || r.age>c.hi)){ cutAge++; return false; }
      if(c.scoutMax>=0 && r.scout!=null && r.scout>=0 && r.scout>c.scoutMax){ cutScout++; return false; }
      if(ADP.hasSalary && c.salMax>=0 && r.sal!=null && r.sal>=0 && r.sal>c.salMax){ cutSal++; return false; }
      if(c.ng.length && c.ng.some(function(k){ return (r.text||'').indexOf(k)>-1; })){ cutNg++; return false; }
      if(ADP.extraCut && ADP.extraCut(r)){ cutNg++; return false; }
      return true;
    });
    LIST.forEach(function(r){ r.flag=false; });
    VIEW.forEach(function(r){
      var sh=(ADP.hasSalary && c.salMax>=0 && (r.sal==null || r.sal<0))?'年収の記載なし':'';
      var fh=(c.useFor && r.hint)?r.hint:'';
      r.flag=!!(fh||sh); r.flagTxt=fh||sh;
    });

    /* 画面側も条件外を隠す。隠す行にチェックが付いていたら外す */
    VIEW.forEach(function(r){ r._in=1; });
    var shown=0, hidden=0;
    LIST.forEach(function(r){
      if(r._in){ setVis(r.el, true); shown++; r._in=0; r.hidden=false; return; }
      setVis(r.el, false); hidden++; r.hidden=true;
      var x=cbOf(r);
      if(x && x.checked && !x.disabled){ if(ADP.clickCb) ADP.clickCb(x,false); else x.click(); }
    });
    showStat(VIEW.length, shown, hidden);

    body.innerHTML=VIEW.map(function(r,i){
      var on=isChecked(r);
      var bg=on?'#eaf3fb':(r.flag?'#fff3ea':(i%2?'#fafbfc':'#fff'));
      var c5=ADP.col5.get(r);
      return '<div class="sfRow" data-i="'+i+'" style="display:grid;grid-template-columns:28px 1fr 34px 34px 46px 1.2fr;padding:4px 6px;border-bottom:1px solid #eee;align-items:center;font-size:11px;cursor:pointer;user-select:none;-webkit-user-select:none;background:'+bg+(on?';box-shadow:inset 3px 0 0 #0b6cbf':'')+'">'
        +'<span style="color:#aaa">'+(i+1)+'</span>'
        +'<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(r.id||'-')+'　'+(r.addr||'')+'</span>'
        +'<span style="text-align:center">'+((r.age==null||r.age<0)?'-':r.age)+'</span>'
        +'<span style="text-align:center">'+(r.sex||'-')+'</span>'
        +'<span style="text-align:center;color:'+(c5.color||'#555')+'">'+(c5.text||'-')+'</span>'
        +'<span>'+(r.flag?'<span class="sfJump" data-i="'+i+'" title="クリックでこの人の位置へスクロール" style="padding:1px 6px;border-radius:3px;background:#e8500e;color:#fff;font-size:9px;cursor:pointer">要確認: '+(r.flagTxt||r.hint)+' ▶</span>':'<span style="color:#bbb;font-size:10px">—</span>')+'</span>'
        +'</div>';
    }).join('') || '<div style="padding:16px;color:#999;text-align:center;font-size:11px">条件に合う人がいません</div>';

    /* v5.6：Shiftを押しながらクリックすると、前回クリックした行との間をまとめて選ぶ／外す（4媒体共通）。
       範囲選択では要確認（外国籍の可能性）の人にはチェックを入れない。外すときは対象に含める。 */
    var rowEls=qsa('.sfRow', body);
    var lastIdx=-1;
    function paintRow(d, r, on){
      d.style.boxShadow=on?'inset 3px 0 0 #0b6cbf':'none';
      d.style.background=on?'#eaf3fb':(r.flag?'#fff3ea':(((+d.dataset.i)%2)?'#fafbfc':'#fff'));
    }
    rowEls.forEach(function(d){
      var r=VIEW[+d.dataset.i];
      d.onclick=function(ev){
        if(ev.target && ev.target.classList && ev.target.classList.contains('sfJump')) return;
        var i=+d.dataset.i;
        var next=!isChecked(r);
        if(ev.shiftKey && lastIdx>=0 && lastIdx!==i){
          var a=Math.min(lastIdx,i), b=Math.max(lastIdx,i), skipFlag=0, fail=0, k, rk;
          for(k=a;k<=b;k++){
            rk=VIEW[k];
            if(k!==i && next && rk.flag){ skipFlag++; continue; }
            if(isChecked(rk)!==next && !setCheck(rk, next)){ fail++; continue; }
            paintRow(rowEls[k], rk, next);
          }
          log((a+1)+'〜'+(b+1)+'行目を'+(next?'まとめてチェックしました':'まとめて外しました')
            +(skipFlag?'（要確認の '+skipFlag+'名は飛ばしました）':'')+(fail?'（'+fail+'名は選べませんでした）':''), '#0b8a5b');
        } else {
          if(!setCheck(r, next)){ log('この行は選択できません（チェックボックスが見つかりません）','#c0392b'); return; }
          paintRow(d, r, next);
        }
        lastIdx=i;
        selCount();
      };
    });
    qsa('.sfJump', body).forEach(function(b){
      b.onclick=function(ev){ ev.stopPropagation(); jumpTo(VIEW[+b.dataset.i]); };
    });
    markRows();
    try{ placeSideBtn(); }catch(e){}

    var nFlag=VIEW.filter(function(r){ return r.flag; }).length;
    /* 小さくしていても分かるよう、見出しと右下のボタンにも件数を出す */
    var short=VIEW.length+' / '+LIST.length+'名';
    var hc=q('#sfHeadCount'); if(hc) hc.textContent=short;
    _lastShort=short;
    refreshPreLabels();
    q('#sfCount').textContent=VIEW.length+' / '+LIST.length+'名'
      +(nFlag?('　うち要確認 '+nFlag+'名（差引 '+(VIEW.length-nFlag)+'名）'):'');
    var msg=[];
    if(cutSex) msg.push('性別で除外 '+cutSex+'名');
    if(cutAge) msg.push('年齢で除外 '+cutAge+'名');
    if(cutScout) msg.push('受信数で除外 '+cutScout+'名');
    if(cutSal) msg.push('年収で除外 '+cutSal+'名');
    if(c.scoutMax>=0 && !LIST.some(function(r){ return r.scout!=null && r.scout>=0; }))
      msg.push('※この画面にはスカウト受信数の記載が無いため、受信数の条件は効いていません');
    if(cutNg) msg.push('除外ワードで除外 '+cutNg+'名');
    if(ADP.note) msg.push(ADP.note);
    log(msg.join('　／　')||'条件に合う人を表示しています');
    selCount();
    saveLast();
  }

  function doRun(){
    if(!scan()){ log('この画面に候補者の一覧が見つかりませんでした','#c0392b'); return false; }
    render();
    return true;
  }

  /* ---------- ボタン ---------- */
  q('#sfRun').onclick=doRun;

  /* 直前にこのボタンで選んだ対象と同じ集合が、いまも全員チェック済みなら
     「もう一度押す」＝外す、という意味に取る。対象が変わっていたら
     （絞り込み条件を変えた・件数を変えた等）普通にチェックし直す。
     チェックした後にサイト側が行のDOMを作り直す媒体があるため、判定の前に
     必ず scan() で行要素を取り直す（古い要素のままだと、実際には外れて
     見えているのに外れない、という不具合になる）。 */
  q('#sfTop').onclick=function(){
    if(!LIST.length){ log('先に STEP2 の「このページで絞り込み」を押してください','#c0392b'); return; }
    if(!scan()){ log('この画面に候補者の一覧が見つかりませんでした','#c0392b'); return; }
    render();
    if(!VIEW.length){ log('条件に合う人がいません','#c0392b'); return; }
    var want=parseInt(q('#sfTopN').value,10); if(isNaN(want)||want<1) want=30;
    var targets=[], skip=0;
    for(var i=0;i<VIEW.length && targets.length<want;i++){
      var r=VIEW[i];
      if(r.flag){ skip++; continue; }
      targets.push(r);
    }
    if(targets.length && targets.every(function(r){ return isChecked(r); })){
      var off=0;
      targets.forEach(function(r){ if(setCheck(r, false)) off++; });
      render();
      log('上から '+off+'名のチェックを外しました（画面のチェックは '+pageChecked()+'名）');
      return;
    }
    clearAllChecks();
    var n=0;
    targets.forEach(function(r){ if(setCheck(r, true)) n++; });
    render();
    log('上から '+n+'名にチェックしました（画面のチェックも '+pageChecked()+'名）'
      +(skip?('　／　途中の要確認 '+skip+'名は飛ばしています'):'')
      +(n<want?('　／　条件に合う人が '+n+'名しかいませんでした'):''), '#0b8a5b');
  };

  q('#sfAll').onclick=function(){
    if(!LIST.length){ log('先に STEP2 の「このページで絞り込み」を押してください','#c0392b'); return; }
    if(!scan()){ log('この画面に候補者の一覧が見つかりませんでした','#c0392b'); return; }
    render();
    if(!VIEW.length){ log('条件に合う人がいません','#c0392b'); return; }
    var targets=VIEW.filter(function(r){ return !r.flag; });
    if(targets.length && targets.every(function(r){ return isChecked(r); })){
      var off=0;
      targets.forEach(function(r){ if(setCheck(r, false)) off++; });
      render();
      log('表示 '+VIEW.length+'名のチェックを外しました（画面のチェックは '+pageChecked()+'名）');
      return;
    }
    clearAllChecks();
    var n=0, skip=VIEW.length-targets.length, ng=0;
    targets.forEach(function(r){
      if(setCheck(r, true)) n++; else ng++;
    });
    render();
    log('表示 '+VIEW.length+'名のうち '+n+'名にチェックしました（画面のチェックも '+pageChecked()+'名）'
      +(skip?('　／　要確認の '+skip+'名は外しています'):'')
      +(ng?('　／　チェックできない行 '+ng+'件'):''), '#0b8a5b');
  };

  q('#sfClr').onclick=function(){
    clearAllChecks();
    if(VIEW.length) render();
    log('この画面のチェックをすべて外しました（画面のチェック '+pageChecked()+'名）');
  };

  ['#sfLo','#sfHi','#sfNg','#sfTopN','#sfScout','#sfSal'].forEach(function(sel){
    var e=q(sel); if(!e) return;
    e.onkeydown=function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); LIST.length?render():doRun(); } };
  });
  q('#sfSex').onchange=function(){ if(LIST.length) render(); };
  q('#sfFor').onchange=function(){ if(LIST.length) render(); };

  /* ---------- プリセット ---------- */
  function paintMaskBtn(){
    var b=q('#sfPreMask'); if(!b) return;
    var on=maskOn();
    b.textContent=on?'🙈 隠中':'👁 表示';
    b.title=on?'社名を隠しています（クリックで表示に戻す）':'クリックすると、社名を「候補1」などの表示に変えます（画面共有用）';
    b.style.background=on?'#55606b':'#fff'; b.style.color=on?'#fff':'#333';
  }
  q('#sfPreMask').onclick=function(){
    try{ localStorage.setItem(MASK_KEY, maskOn()?'0':'1'); }catch(e){}
    var cur=(q('#sfPre')||{}).value||'';
    drawPresets(cur);
    if(maskOn()){ q('#sfPreName').value=''; } else if(cur){ q('#sfPreName').value=cur; }
    paintMaskBtn(); refreshPreLabels();
    log(maskOn()?'社名を隠しました（「候補1」などの表示になります）':'社名の表示に戻しました');
  };
  paintMaskBtn();
  drawPresets();
  q('#sfPre').onchange=function(){
    var name=this.value;
    if(!name){ showPreNow(''); return; }
    var o=loadPresets();
    if(!o[name]) return;
    setCond(o[name]);
    q('#sfPreName').value=maskOn()?'':name;
    showPreNow(name);
    if(LIST.length) render(); else doRun();
    log('プリセット「'+dispName(name)+'」を読み込みました');
  };
  q('#sfPreSave').onclick=function(){
    var name=(q('#sfPreName').value||'').trim();
    if(!name){ log('保存する名前を入れてください（社名など）','#c0392b'); q('#sfPreName').focus(); return; }
    var o=loadPresets();
    var exists=!!o[name];
    if(exists && !confirm('「'+name+'」はすでにあります。いまの条件で上書きしますか？')) return;
    var c=cond(); delete c.ts; delete c.pre;
    o[name]=c; savePresets(o);
    drawPresets(name);
    log('プリセット「'+dispName(name)+'」を'+(exists?'更新':'保存')+'しました', '#0b8a5b');
  };
  q('#sfPreDel').onclick=function(){
    var name=q('#sfPre').value;
    if(!name){ log('削除するプリセットを選んでください','#c0392b'); return; }
    if(!confirm('プリセット「'+dispName(name)+'」を削除します。よろしいですか？')) return;
    var o=loadPresets(); delete o[name]; savePresets(o);
    drawPresets(); q('#sfPreName').value='';
    log('プリセット「'+dispName(name)+'」を削除しました');
  };

  q('#sfMin').onclick=function(){
    var b=q('#sfBody');
    var on=(b.style.display==='none');   /* いま小さい状態なら開く */
    b.style.display=on?'block':'none';
    this.textContent=on?'−':'＋';
    setWantMin(!on);
  };
  q('#sfOff').onclick=function(){ pauseHere(true); };
  q('#sfClose').onclick=function(){
    setWantOpen(false);
    syncVisible(true);
  };

  /* ヘッダーをつかんで移動 */
  (function(){
    var h=q('#sfHead'), dx=0, dy=0, drag=false;
    h.addEventListener('mousedown', function(ev){
      if(ev.target.id==='sfMin' || ev.target.id==='sfOff') return;
      drag=true;
      var rc=panel.getBoundingClientRect();
      dx=ev.clientX-rc.left; dy=ev.clientY-rc.top;
      ev.preventDefault();
    });
    /* v4.5：パネルが画面の外へ出ないようにする。小さい画面でパネルが画面より高いと、
       下の方を見ようとして上へ動かした結果、STEP1 が画面の上に隠れて戻せなくなっていた */
    function clampPanel(){
      if(!panel.style.left && !panel.style.top.replace('60px','')) return;
      var rc=panel.getBoundingClientRect();
      var x=Math.max(0, Math.min(window.innerWidth-120, rc.left));
      var y=Math.max(0, Math.min(window.innerHeight-40, rc.top));
      if(x!==rc.left || y!==rc.top){ panel.style.left=x+'px'; panel.style.top=y+'px'; panel.style.right='auto'; }
    }
    document.addEventListener('mousemove', function(ev){
      if(!drag) return;
      panel.style.left=(ev.clientX-dx)+'px';
      panel.style.top=(ev.clientY-dy)+'px';
      panel.style.right='auto';
      clampPanel();
    });
    document.addEventListener('mouseup', function(){ drag=false; clampPanel(); });
    window.addEventListener('blur', function(){ drag=false; });
    window.addEventListener('resize', clampPanel);
  })();

  /* 媒体側の一括チェックの横に、こちらのボタンを並べて置く。
     横取りだけだと押したときの動きが分かりにくいので、押せる場所を目に見える形で出す。 */
  var sideBtn=null, sideWrap=null;
  function findBulkControl(){
    var best=null;
    qsa('label,button,a,div,span').some(function(e){
      if(panel.contains(e)) return false;
      if(sideWrap && (e===sideWrap || sideWrap.contains(e))) return false;
      var cls=String((e.className&&e.className.baseVal!==undefined?e.className.baseVal:e.className)||'')+' '+String(e.id||'');
      var txt=String(e.textContent||'').replace(/\s+/g,'');
      var hit=/check-?all|select-?all|checkall|selectall|bulk-?check/i.test(cls)
           || (txt.length<=8 && /^(全選択|すべて選択|全件選択|一括チェック|一括選択)$/.test(txt));
      if(hit && e.getClientRects().length){ best=e; return true; }
      return false;
    });
    return best;
  }
  function placeSideBtn(){
    if(ADP.skipBulkIntercept) return;
    var host=findBulkControl();
    if(!host || !host.parentElement) return;
    if(!sideBtn){
      sideBtn=el('button','padding:4px 12px;background:'+ADP.color+';color:#fff;border:none;border-radius:4px;font-size:12px;font-weight:bold;cursor:pointer;vertical-align:middle;font-family:sans-serif','絞り込み後にチェック');
      sideBtn.id='sfSideBtn';
      sideBtn.type='button';
      sideBtn.title='絞り込みに残った人だけにチェックを入れます（要確認の人は外します）';
      sideBtn.onclick=function(ev){
        ev.preventDefault(); ev.stopPropagation();
        bulkCheckVisible();
      };
    }
    /* 全選択と同じ枠の中に入れて、その下の行に置く。
       横に並べると、枠が両端揃えのときに離れた場所に飛ぶため。 */
    if(!sideWrap){
      sideWrap=el('div','display:block;width:100%;flex-basis:100%;margin-top:6px;text-align:left');
      sideWrap.id='sfSideWrap';
      sideWrap.appendChild(sideBtn);
    }
    /* label の中に入れるとチェックボックスを巻き込んで押してしまうので、
       label が相手のときは、その直後に置く。 */
    var inLabel=(host.tagName==='LABEL') || !!(host.closest && host.closest('label'));
    var target=inLabel?(host.closest('label')||host):host;
    /* v5.1：エン転職の検索結果は、一括チェックの吹き出し（.checkArea）の下に最初の候補者の
       「未読」ラベルがあり、下の行に置くと重なる。吹き出しの右隣（同じ高さ）に置く。 */
    var ca=(host.closest && host.closest('.checkArea'));
    if(ca && ca.parentElement){
      sideWrap.style.cssText='display:block;float:left;margin:4px 0 0 12px';
      if(sideWrap.previousElementSibling!==ca || sideWrap.parentElement!==ca.parentElement){
        try{ ca.parentElement.insertBefore(sideWrap, ca.nextSibling); }catch(e){}
      }
    }else
    if(inLabel){
      if(sideWrap.previousElementSibling!==target || sideWrap.parentElement!==target.parentElement){
        try{ target.parentElement.insertBefore(sideWrap, target.nextSibling); }catch(e){}
      }
    }else if(sideWrap.parentElement!==host){
      try{ host.appendChild(sideWrap); }catch(e){
        try{ host.parentElement.insertBefore(sideWrap, host.nextSibling); }catch(e2){}
      }
    }
    var sbTargets=VIEW.filter(function(r){ return !r.flag; });
    var sbAllOn=sbTargets.length>0 && sbTargets.every(function(r){ return isChecked(r); });
    sideBtn.textContent=sbAllOn ? ('チェックを外す（'+sbTargets.length+'名）') : ('絞り込み後の '+VIEW.length+'名にチェック');
  }
  /* このボタンも、もう一度押すと外す。チェックした直後にサイト側が行のDOMを
     作り直す媒体（doda等）があるため、判定の前に scan()+render() で
     行要素を取り直してから、いま本当にチェックされているかを見る。 */
  function bulkCheckVisible(){
    if(!LIST.length){ log('先に STEP2 の「このページで絞り込み」を押してください','#c0392b'); return; }
    if(!scan()){ log('この画面に候補者の一覧が見つかりませんでした','#c0392b'); return; }
    render();
    if(!VIEW.length){ log('条件に合う人がいません','#c0392b'); return; }
    var targets=VIEW.filter(function(r){ return !r.flag; });
    if(targets.length && targets.every(function(r){ return isChecked(r); })){
      var off=0;
      targets.forEach(function(r){ if(setCheck(r, false)) off++; });
      render();
      log('絞り込み後の '+off+'名のチェックを外しました（画面のチェック '+pageChecked()+'名）');
      return;
    }
    clearAllChecks();
    var n=0, skip=0;
    VIEW.forEach(function(r){
      if(r.flag){ skip++; return; }
      if(setCheck(r, true)) n++;
    });
    render();
    log('絞り込み後の '+n+'名にチェックしました（画面のチェック '+pageChecked()+'名）'
      +(skip?('　／　要確認の '+skip+'名は外しています'):''), '#0b8a5b');
  }

  /* ---------- ページを移動したあとの自動復元 ----------
     どの媒体でも、直前の条件を覚えていて（期限なし）自動でかけ直す。
     エン転職はこれに加えて検索条件そのものが書き換わっているので二重に効く。 */
  function autoApply(quiet){
    var c=loadLast();
    if(!c){ doRun(); return; }
    setCond(c);
    /* v4.3：ページを移動しても、どのプリセット（社名）で絞っているかを残す */
    if(c.pre && loadPresets()[c.pre]){ drawPresets(c.pre); q('#sfPreName').value=maskOn()?'':c.pre; }
    /* 先に出しておく。絞り込みの結果や注意書きがあれば、そちらで上書きされる */
    if(!quiet) log('前回の条件（'+(c.pre?dispName(c.pre)+' ／ ':'')+(c.sex||'指定なし')+' ／ '+c.lo+'〜'+c.hi+'歳）で絞り込みました');
    doRun();
  }
  /* 一覧が出てくるまで待つ。dodaのように画面内で一覧が差し替わる媒体では
     読み込みが終わったあとに一覧が現れるため、最初の1回だけでは間に合わない。
     v3.10：行数だけを見ていたため、1ページ目と2ページ目の人数が同じときに
     かけ直しが起きず、2ページ目が絞り込まれないまま出ていた。
     行数に加えて、URLの変化・入れ替わった行・隠したはずの行が戻っていないかを見る。 */
  var lastN=-1, applied=false, lastHref=location.href;
  var KNOWN=(typeof WeakSet==='function')?new WeakSet():null;
  function remember(rows){
    if(!KNOWN) return;
    rows.forEach(function(row){ try{ KNOWN.add(row); }catch(e){} });
  }
  /* かけ直しが要るかどうか。
     ・見たことのない行が出ている（ページ送り・一覧の差し替え）
     ・こちらが隠した行が表示に戻っている（媒体側の再描画） */
  function needsRerun(rows){
    for(var i=0;i<rows.length;i++){
      var row=rows[i];
      if(row.dataset && row.dataset.sfHidden==='1' && visibleNow(row)) return true;
      if(KNOWN && visibleNow(row) && !KNOWN.has(row)) return true;
    }
    return false;
  }
  function tick(){
    if(blockedHere()){ hasList=false; syncVisible(false); applied=false; lastN=-1; return; }
    if(pausedHere()){ try{ hasList=(ADP.rows().length>0); }catch(e){ hasList=false; } releaseAll(); syncVisible(false); applied=false; lastN=-1; return; }
    var rows=[];
    try{ rows=ADP.rows(); }catch(e){}
    var n=rows.length;
    var moved=(location.href!==lastHref);
    if(moved) lastHref=location.href;
    var changed=(n!==lastN) || moved || needsRerun(rows);
    lastN=n;
    hasList=(n>0);
    syncVisible(false);
    if(!n) return;
    if(!applied){ applied=true; autoApply(false); remember(ADP.rows()); return; }
    if(!changed) return;
    /* パネルを閉じていても絞り込みは続ける */
    doRun();
    remember(ADP.rows());
  }
  setTimeout(tick, 400);
  setTimeout(tick, 1200);
  setInterval(tick, 1500);

  /* 媒体側の「一括チェック」「全選択」を押したときに、絞り込みで隠れている人まで
     選ばれてしまわないようにする。ボタンの作りは媒体ごとに違ううえ、同じ媒体でも
     変わることがあるので、ボタンを探しにいかず、押されたあとを見て直す形にしてある。 */
  var SWEEP_WARNED=false;
  function sweepHidden(){
    /* 一覧でない画面（検索条件の入力画面など）では何もしない。
       条件の入力画面には、居住地や職種の選択が「見えないチェックボックス」として
       大量に入っており、ここで外すと読み込んだ条件が消えて検索できなくなる。 */
    if(blockedHere() || silentHere() || pausedHere()) return 0;
    if(!LIST.length) return 0;
    var n=0, miss=0;
    /* こちらが隠した人だけでなく、媒体側が隠している人（別ページの人）も対象にする。
       画面に出ていない人が選ばれている状態を作らない。 */
    ADP.rows().forEach(function(row){
      if(visibleNow(row)) return;
      var r={el:row};
      var c=cbOf(r);
      if(!c){ miss++; return; }
      if(!c.checked || c.disabled) return;
      /* 値を書き換えるだけだと媒体側の選択数に反映されないことがあるので、
         実際のクリックとして外す。あわせて change も送る。 */
      if(ADP.clickCb) ADP.clickCb(c, false); else c.click();
      if(c.checked) c.checked=false;
      try{ c.dispatchEvent(new Event('change',{bubbles:true})); }catch(e){}
      n++;
    });
    /* 候補者の枠として拾えていないチェックボックスへの保険。
       一覧の入れ物の中にあって、画面に描画されていないものは外す。
       （媒体によっては、別ページの人のチェックボックスだけが残っていることがある） */
    try{
      var box=LIST[0] && LIST[0].el && LIST[0].el.parentElement;
      /* 候補者のチェックボックスと同じ name のものだけを対象にする。
         同じ入れ物の中にある検索条件などのチェックを巻き込まないため。 */
      var NAMES={};
      LIST.forEach(function(r){ var x=cbOf(r); if(x && x.name) NAMES[x.name]=1; });
      if(box && Object.keys(NAMES).length){
        qsa('input[type="checkbox"]', box).forEach(function(c){
          if(!c.checked || c.disabled) return;
          if(!NAMES[c.name]) return;
          var idn=((c.id||'')+' '+(c.name||'')+' '+(c.className||'')).toLowerCase();
          if(/all|every|select-?all|toggle/.test(idn)) return;
          if(c.getClientRects().length) return;      /* 画面に出ているものは触らない */
          c.click();
          if(c.checked) c.checked=false;
          try{ c.dispatchEvent(new Event('change',{bubbles:true})); }catch(e2){}
          n++;
        });
      }
    }catch(e){}
    if(n){
      log('画面に出ていない '+n+'名のチェックを外しました（画面のチェック '+pageChecked()+'名）', '#c0392b');
      selCount();
    }
    if(miss && !SWEEP_WARNED){
      SWEEP_WARNED=true;
      log('この画面では '+miss+'名のチェックボックスが読み取れませんでした。媒体側の一括チェックは使わず、STEP3 のボタンで選んでください。', '#c0392b');
    }
    return n;
  }
  /* 媒体側の「全選択」を、絞り込み後の人だけを選ぶ動きに置き換える。
     エン転職ダイレクトのように、画面のチェックとは別に選択人数を内部で持っている
     媒体があり、押されたあとにチェックを外しても向こうの数が減らないため、
     そもそも押させずにこちらの選択に差し替える。絞り込んでいないときは素通しする。 */
  function bulkControlAt(node){
    var e=node, d=0;
    while(e && e!==document.body && d<4){
      var sig=String((e.className&&e.className.baseVal!==undefined?e.className.baseVal:e.className)||'')
            +' '+String(e.id||'')+' '+String((e.getAttribute&&e.getAttribute('data-testid'))||'');
      if(/check-?all|select-?all|checkall|selectall|bulk-?check/i.test(sig)) return e;
      var txt=String(e.textContent||'').replace(/\s+/g,'');
      if(txt.length<=8 && /^(全選択|すべて選択|全件選択|一括チェック|一括選択)$/.test(txt)) return e;
      e=e.parentElement; d++;
    }
    return null;
  }
  document.addEventListener('click', function(ev){
    if(panel.contains(ev.target)) return;
    if(blockedHere() || silentHere() || pausedHere()) return;
    if(LIST.length && VIEW.length<LIST.length && !ADP.skipBulkIntercept && bulkControlAt(ev.target)){
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
      bulkCheckVisible();
      return;
    }
    /* それ以外のクリックは、押されたあとに画面外のチェックを外しに行く */
    [0, 80, 250, 600].forEach(function(ms){ setTimeout(sweepHidden, ms); });
  }, true);
  setInterval(sweepHidden, 700);

  /* ===== v6.1：マイナビ専用の付属機能（全ページ抽出・配信連携・余剰除去） =====
     v4.29 の「全ページから未送信を抽出」と、配信／保存リスト登録時の余剰除去を移した部分。
     絞り込み条件は STEP1 の入力（cond）をそのまま使う。別の設定画面は持たない。 */
  (function(){
    if(ADP.site!=='mynavi') return;
    var FA=new URLSearchParams(location.search).get('fuseaction')||'';
    var isScout=(FA==='ctsm_listScoutTarget_form'), isBook=(FA==='ctsm_listTemporaryDetails_form'), isContact=(FA==='ctsm_listContactMail_form');
    if(!isScout && !isBook && !isContact) return;
    var chk=new URLSearchParams(location.search).get('chkcd')||'default';
    var SEL_KEY='_mn_sel_'+chk;       /* 確認画面が読む「選んだ人」 */
    var PANEL_SEL_KEY='_mnx_sel_'+chk; /* 抽出パネルのチェック状態 */
    var HIDE_KEY='scoutFilterHideSent_'+(isBook?'book':'scout');

    /* コンタクトメール画面：浮いている配信バーを、表示中のチェック数に合わせる（v4.28の機能） */
    if(isContact){
      var syncBar=function(){
        var fb=document.getElementById('floating_contact-mail'); if(!fb) return;
        var ids=qsa('h2.brdbB input[name="batch_optn"]:checked').filter(function(c){ return c.closest('h2.brdbB').style.display!=='none'; }).map(function(c){ return c.value; });
        fb.style.display=ids.length?'block':'none';
        var hb=document.querySelector('form[name="batch_optn_form"] input[name="batch_optn"]'); if(hb) hb.value=ids.join(',');
        qsa('[class*="count"], [class*="num"], [class*="select"]', fb).forEach(function(e){ if(/^\d+$/.test((e.innerText||'').trim())) e.innerText=ids.length; });
      };
      document.addEventListener('click', function(){ [100,400].forEach(function(ms){ setTimeout(syncBar, ms); }); }, false);
      setTimeout(syncBar, 600);
      return;
    }
    var MAX=isBook?300:100;
    var xList=[], xSel=null, xIds=null, xStopped=false, xPages=1, xTotal=0;

    function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function saveIds(ids){ try{ localStorage.setItem(SEL_KEY, JSON.stringify(ids)); }catch(e){} }
    function loadIds(){ try{ var a=JSON.parse(localStorage.getItem(SEL_KEY)||'[]'); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
    function loadXSel(){ if(xSel) return xSel; try{ var r=localStorage.getItem(PANEL_SEL_KEY); if(r){ xSel=JSON.parse(r); return xSel; } }catch(e){} return null; }
    function saveXSel(ids){ xSel=ids.slice(); try{ localStorage.setItem(PANEL_SEL_KEY, JSON.stringify(xSel)); }catch(e){} }
    function visibleCheckedIds(){
      return qsa('h2.brdbB input[name="batch_optn"]:checked')
        .filter(function(c){ return c.closest('h2.brdbB').style.display!=='none'; })
        .map(function(c){ return c.value; });
    }

    /* ---------- 配信／保存リスト登録の確認画面から余剰者を除く ---------- */
    function notice(doc, count, removed){
      if(doc.getElementById('_mn_iframe_notice')) return;
      var n=doc.createElement('div'); n.id='_mn_iframe_notice';
      n.style.cssText='background:'+(removed>0?'#1565c0':'#2e7d32')+';color:#fff;padding:5px 10px;font-size:11px;font-family:sans-serif;border-radius:4px;margin-bottom:6px;';
      n.textContent=removed>0 ? ('✅ 自動修正：余剰'+removed+'名を除去 → 登録対象 '+count+'名') : ('✅ 対象人数が正確です（'+count+'名）');
      if(doc.body.firstChild) doc.body.insertBefore(n, doc.body.firstChild);
    }
    function cleanFancybox(ids){
      var fb=document.getElementById('fancybox-frame'); if(!fb) return;
      var doc; try{ doc=fb.contentDocument; }catch(e){ return; }
      if(!doc || !doc.body) return;
      var bi=doc.querySelector('input[name="batch_optn"]');
      if(!bi || bi.dataset.mnCleaned==='1') return;
      bi.dataset.mnCleaned='1';
      var use=(ids&&ids.length)?ids:visibleCheckedIds();
      if(!use.length) return;
      var raw=bi.value, prefix=raw.indexOf('=')===0?'=':'';
      var cur=raw.replace(/^=/,'').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
      var set={}; use.forEach(function(i){ set[i]=1; });
      var keep=cur.filter(function(i){ return set[i]; });
      var extra=cur.length-keep.length;
      if(!extra){ notice(doc, keep.length, 0); return; }
      bi.value=prefix+keep.join(',');
      var w=doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null, false), nd;
      while((nd=w.nextNode())){
        if(nd.textContent.indexOf(cur.length+'人')>-1){ nd.textContent=nd.textContent.replace(cur.length+'人', keep.length+'人'); break; }
      }
      notice(doc, keep.length, extra);
    }
    function waitFancybox(ids){
      var tried=0, t=setInterval(function(){
        tried++;
        try{
          var fb=document.getElementById('fancybox-frame');
          var fd=fb && fb.contentDocument;
          var bi=fd && fd.body && fd.querySelector('input[name="batch_optn"]');
          if(bi && bi.value && bi.value.replace(/^=/,'').split(',').filter(Boolean).length){ clearInterval(t); cleanFancybox(ids); return; }
        }catch(e){}
        if(tried>50) clearInterval(t);
      },100);
    }
    document.addEventListener('click', function(e){
      var b=e.target.closest && e.target.closest('button, input[type="button"]');
      if(!b || (b.id!=='btn_select_act' && b.id!=='num_bulk_op')) return;
      var op='';
      qsa('#bulk_op, #bottom_bulk_op').some(function(s){ if(s.value){ op=s.value; return true; } return false; });
      var ids=(xIds && xIds.length)?xIds.slice():visibleCheckedIds();
      if(op==='1'){ saveIds(ids); }
      else if(op==='3' || op==='4'){ saveIds(ids); waitFancybox(ids); }
      xIds=null;
    }, true);
    try{
      new MutationObserver(function(){
        try{
          var fb=document.getElementById('fancybox-frame'); if(!fb) return;
          var fd=fb.contentDocument; if(!fd || !fd.body) return;
          var bi=fd.querySelector('input[name="batch_optn"]');
          if(!bi || bi.dataset.mnCleaned==='1') return;
          if(bi.value.replace(/^=/,'').split(',').filter(Boolean).length){
            var ids=visibleCheckedIds();
            setTimeout(function(){ cleanFancybox(ids.length?ids:loadIds()); }, 200);
          }
        }catch(e){}
      }).observe(document.body,{childList:true,subtree:true,attributes:true});
    }catch(e){}

    /* ---------- 全ページ抽出 ---------- */
    function isCand(h2){ return !!h2.querySelector('input[name="batch_optn"], input[name="batch_optn_off"]'); }
    function hideSent(){ try{ var v=localStorage.getItem(HIDE_KEY); return v==null ? isBook : v==='1'; }catch(e){ return isBook; } }
    ADP.extraCut=function(r){ return hideSent() && r.jyo==='送信済'; };
    function keep(r, c, ignoreSent){
      if(!ignoreSent && r.jyo==='送信済') return false;
      if(r.age==null || r.age<0) return false;
      if(c.sex!=='指定なし' && r.sex && r.sex!==c.sex) return false;
      if(r.age<c.lo || r.age>c.hi) return false;
      if(c.scoutMax>=0 && r.scout>=0 && r.scout>c.scoutMax) return false;
      if(c.ng.length && c.ng.some(function(k){ return (r.text||'').indexOf(k)>-1; })) return false;
      return true;
    }
    function expOf(card){
      var me=String(card||'').match(/(\d+)\s*社経験（([^）]*)）/);
      if(me) return me[1]+'社（'+me[2]+'）';
      return /未経験|社会人経験なし/.test(card||'') ? '未経験' : '';
    }
    function jobOf(card){ var m=String(card||'').match(/経験職種\s*([^\s　]+?)\s*\d+\s*年/); return m?m[1]:''; }
    function cityOf(card){ var m=String(card||'').match(/([^\s　]+?[都道府県])\s*([^\s　]+?[市区町村])/); return m?(m[1]+m[2]):''; }
    async function extractAll(c, status){
      var seenRaw={}, seen={}, list=[];
      function scanDoc(doc, pageNo){
        var hs=qsa('h2.brdbB', doc).filter(isCand), newRaw=0;
        hs.forEach(function(h2){
          var r=ADP.parse(h2)||{};
          if(!r.id) return;
          if(!seenRaw[r.id]){ seenRaw[r.id]=1; newRaw++; }
          r.sex=normSex(r.sex);
          if(!keep(r,c) || seen[r.id]) return;
          seen[r.id]=1;
          r.hint=judge(r);
          r.flag=(c.useFor && !!r.hint);
          r.page=pageNo;
          r.exp=expOf(r.text); r.job=jobOf(r.text); r.city=cityOf(r.text)||r.addr;
          delete r.text;
          list.push(r);
        });
        return {raw:hs.length, newRaw:newRaw};
      }
      xStopped=false; xPages=1;
      status('抽出中… 1ページ目（0/'+MAX+'名）');
      if(ADP.prescan) ADP.prescan();
      /* 現在のページは、こちらが隠した行も含めて読む必要があるので、一時的に戻してから読む */
      var cur=qsa('h2.brdbB').filter(isCand);
      var hid=cur.filter(function(h){ return h.style.display==='none'; });
      hid.forEach(function(h){ var t=h.nextElementSibling; h.style.display=''; if(t&&t.tagName==='TABLE') t.style.display=''; });
      scanDoc(document,1);
      hid.forEach(function(h){ var t=h.nextElementSibling; h.style.display='none'; if(t&&t.tagName==='TABLE') t.style.display='none'; });
      if(list.length>=MAX) xStopped=true;
      var base=location.href.replace(/[&?]page=\d+/,'');
      var total=ADP.siteTotal?ADP.siteTotal():0;
      var cap=Math.max(40, total?Math.ceil(total/(cur.length||50)):0);
      for(var p=2; p<=cap && !xStopped; p++){
        xPages=p;
        status('抽出中… '+p+'ページ目（'+list.length+'/'+MAX+'名）');
        try{
          var resp=await fetch(base+'&page='+p,{credentials:'include'});
          var buf=await resp.arrayBuffer();
          var doc=new DOMParser().parseFromString(new TextDecoder('shift_jis').decode(buf),'text/html');
          var s=scanDoc(doc,p);
          if(s.raw===0 || s.newRaw===0) break;
          if(list.length>=MAX){ xStopped=true; break; }
        }catch(e){ break; }
      }
      list.sort(function(a,b){ return (a.scout<0?1e9:a.scout)-(b.scout<0?1e9:b.scout); });
      xTotal=list.length;
      return list.slice(0,MAX);
    }

    /* 抽出した人を、マイナビ標準の配信／保存リスト登録へ渡す */
    function fire(ids, op){
      qsa('form[name="main_form"] input[type="checkbox"][name="batch_optn"]').forEach(function(c){
        var hid=(c.offsetWidth===0 && c.offsetHeight===0 && c.getClientRects().length===0);
        if(hid) c.name='batch_optn_off'; else c.checked=false;
      });
      var mh=document.querySelector('form[name="main_form"] input[type="hidden"][name="batch_optn"]');
      if(mh) mh.value=ids.join(',');
      saveIds(ids);
      xIds=ids.slice();
      var sel=document.getElementById('bulk_op'), btn=document.getElementById('btn_select_act'), ok=false;
      if(sel && btn){ sel.value=op; btn.click(); ok=true; }
      setTimeout(function(){
        qsa('form[name="main_form"] input[type="checkbox"][name="batch_optn_off"]').forEach(function(c){
          /* こちらが絞り込みで隠している行は、名前を戻さない */
          var h=c.closest('h2.brdbB');
          if(h && h.style.display==='none') return;
          c.name='batch_optn';
        });
        var m2=document.querySelector('form[name="main_form"] input[type="hidden"][name="batch_optn"]');
        if(m2) m2.value='';
      },150);
      return ok;
    }

    /* ---------- パネル ---------- */
    var xp=null;
    function xChecked(){ return qsa('._mnx_row:checked', xp).map(function(c){ return c.dataset.id; }); }
    function xCount(){
      var n=xChecked().length;
      xp.querySelector('#_mnx_count').textContent='抽出 '+xList.length+'名 ／ 選択 '+n+'名';
    }
    function xRender(){
      var s=loadXSel(), map=null;
      if(s){ map={}; s.forEach(function(i){ map[i]=1; }); }
      var rows=xList.map(function(r){
        var on=map?!!map[r.id]:!r.flag;
        return '<tr class="_mnx_tr" style="border-bottom:1px solid #eee;'+(r.flag?'background:#fff3ea;':'')+'">'
          +'<td style="padding:3px 6px"><input type="checkbox" class="_mnx_row" data-id="'+esc(r.id)+'"'+(on?' checked':'')+'></td>'
          +'<td style="padding:3px 6px;font-family:monospace">'+esc(r.id)+'</td>'
          +'<td style="padding:3px 6px;white-space:nowrap">'+(r.age>=0?r.age+'才':'-')+esc(r.sex||'')+'</td>'
          +'<td style="padding:3px 6px;white-space:nowrap">'+esc(r.city||r.addr||'-')+'</td>'
          +'<td style="padding:3px 6px;white-space:nowrap;'+(r.exp==='未経験'?'color:#c0392b;font-weight:bold':'')+'">'+esc(r.exp||'-')+'</td>'
          +'<td style="padding:3px 6px">'+esc(r.job||'-')+'</td>'
          +'<td style="padding:3px 6px;text-align:right">'+(r.scout>=0?r.scout:'-')+'</td>'
          +'<td style="padding:3px 6px;font-size:11px">'+(r.flag?'<span style="background:#e8500e;color:#fff;border-radius:3px;padding:1px 6px">要確認 '+esc(r.hint)+'</span>':'')+'</td>'
          +'<td style="padding:3px 6px;text-align:center;color:#888">'+r.page+'P</td></tr>';
      }).join('');
      xp.querySelector('#_mnx_body').innerHTML=
        '<table style="width:100%;border-collapse:collapse;font-size:12px;user-select:none"><thead><tr style="background:#fff3e0;position:sticky;top:0">'
        +'<th></th><th style="text-align:left;padding:4px 6px">会員番号</th><th>年齢性別</th><th style="text-align:left">居住地</th><th style="text-align:left">経験</th><th style="text-align:left">経験職種</th><th>受信</th><th style="text-align:left">確認</th><th>頁</th></tr></thead><tbody>'+rows+'</tbody></table>';
      xCount();
    }
    function build(){
      if(xp) return;
      xp=document.createElement('div'); xp.id='_mnx_panel';
      xp.style.cssText='position:fixed;top:60px;right:16px;bottom:16px;width:760px;max-width:96vw;z-index:2147483000;background:#fff;border:2px solid #f57c00;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.25);display:none;flex-direction:column;font-family:sans-serif;color:#222';
      xp.innerHTML=
        '<div style="background:#f57c00;color:#fff;padding:9px 14px;display:flex;align-items:center;gap:10px;border-radius:6px 6px 0 0"><b style="font-size:14px">全ページ抽出（検索結果）</b><span id="_mnx_count" style="font-size:12px"></span><span id="_mnx_close" style="margin-left:auto;cursor:pointer;font-size:18px">×</span></div>'
        +'<div style="padding:8px 12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;border-bottom:1px solid #eee;font-size:12px">'
        +'<button id="_mnx_all" style="padding:5px 10px;background:#fff3e0;color:#f57c00;border:1px solid #f57c00;border-radius:4px;cursor:pointer">全選択</button>'
        +'<button id="_mnx_none" style="padding:5px 10px;background:#f3f3f3;border:1px solid #ccc;border-radius:4px;cursor:pointer">全解除</button>'
        +'<button id="_mnx_save" style="margin-left:auto;padding:6px 12px;background:#1a6fc4;color:#fff;border:0;border-radius:4px;font-weight:bold;cursor:pointer">選択を保存リストに登録</button>'
        +'<button id="_mnx_set" style="padding:6px 12px;background:#34a853;color:#fff;border:0;border-radius:4px;font-weight:bold;cursor:pointer">選択を配信（確認画面を開く）</button></div>'
        +'<div style="padding:5px 12px;font-size:11px;color:#666;background:#fffdf3;border-bottom:1px solid #eee">条件は STEP1 の入力を使用。要確認の人は初期状態で外れています。Shift＋クリックで範囲選択できます。</div>'
        +'<div id="_mnx_body" style="flex:1;overflow:auto;padding:0 4px"></div>';
      document.body.appendChild(xp);
      xp.querySelector('#_mnx_close').onclick=function(){ xp.style.display='none'; };
      xp.querySelector('#_mnx_all').onclick=function(){ qsa('._mnx_row', xp).forEach(function(c){ c.checked=true; }); xCount(); saveXSel(xChecked()); };
      xp.querySelector('#_mnx_none').onclick=function(){ qsa('._mnx_row', xp).forEach(function(c){ c.checked=false; }); xCount(); saveXSel(xChecked()); };
      var last=-1;
      xp.querySelector('#_mnx_body').addEventListener('click', function(e){
        var tr=e.target.closest('._mnx_tr'); if(!tr) return;
        var rows=qsa('._mnx_tr', xp), i=rows.indexOf(tr);
        var cb=tr.querySelector('._mnx_row');
        if(e.target!==cb){ cb.checked=!cb.checked; }
        if(e.shiftKey && last>=0 && last!==i){
          var a=Math.min(last,i), b=Math.max(last,i), st=cb.checked;
          for(var k=a;k<=b;k++){
            var x=rows[k].querySelector('._mnx_row');
            var fl=xList[k] && xList[k].flag;
            if(st && fl) continue;   /* 範囲でチェックを入れるときは要確認を飛ばす */
            x.checked=st;
          }
        }
        last=i; xCount(); saveXSel(xChecked());
      });
      function go(op){
        var ids=xChecked();
        if(!ids.length){ alert('対象を1名以上選択してください'); return; }
        fire(ids, op);
        xp.style.display='none';
      }
      xp.querySelector('#_mnx_set').onclick=function(){ go('1'); };
      xp.querySelector('#_mnx_save').onclick=function(){ go('3'); };
    }
    function addButtons(){
      var host=panel.querySelector('#sfStat');
      if(!host || panel.querySelector('#_mnx_btn')) return;
      build();
      var wrap=document.createElement('div');
      wrap.style.cssText='margin-top:8px;padding-top:8px;border-top:1px dashed #e6cfa8;display:flex;gap:6px;align-items:center;flex-wrap:wrap';
      wrap.innerHTML=
        '<span style="font-size:10px;font-weight:bold;color:#8a6a2a;background:#f6e4c6;padding:2px 7px;border-radius:3px">追加機能</span>'
        +'<button id="_mnx_btn" type="button" style="padding:5px 10px;background:#e65100;color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer;font-size:11px">🔎 全ページから抽出</button>'
        +'<button id="_mnx_re" type="button" style="padding:5px 10px;background:#8d6e63;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px">📋 リスト再表示</button>'
        +'<button id="_mnx_tally" type="button" style="padding:5px 10px;background:#f57c00;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px">🔍 全ページ集計</button>'
        +'<button id="_mnx_sort" type="button" style="padding:5px 10px;background:#fff;color:#0b6cbf;border:1px solid #0b6cbf;border-radius:4px;cursor:pointer;font-size:11px">📊 受信が少ない順に並べ替え</button>'
        +'<label style="font-size:11px;cursor:pointer;color:#555"><input type="checkbox" id="_mnx_hs"> 送信済みを非表示</label>'
        +'<span id="_mnx_status" style="font-size:10px;color:#555;flex:1 1 100%;line-height:1.6"></span>';
      host.parentNode.insertBefore(wrap, host);
      var btn=wrap.querySelector('#_mnx_btn'), re=wrap.querySelector('#_mnx_re'), st=wrap.querySelector('#_mnx_status');
      re.onclick=function(){
        if(!xList.length){ alert('先に「全ページから抽出」を実行してください'); return; }
        xRender(); xp.style.display='flex';
      };
      var hs=wrap.querySelector('#_mnx_hs');
      hs.checked=hideSent();
      hs.onchange=function(){
        try{ localStorage.setItem(HIDE_KEY, hs.checked?'1':'0'); }catch(e){}
        if(LIST.length) render(); else doRun();
      };
      /* 受信が少ない順に並べ替え（保存リスト画面のv2.0の機能）。表示中の人を上に、隠れている人を下に置く */
      wrap.querySelector('#_mnx_sort').onclick=function(){
        var rows=ADP.rows(); if(!rows.length) return;
        var parent=rows[0].parentNode, anchor=rows[0].previousElementSibling;
        var recs=rows.map(function(h){ var p=ADP.parse(h)||{}; return {h:h, t:h.nextElementSibling, s:(p.scout!=null&&p.scout>=0)?p.scout:1e9, hid:h.style.display==='none'}; });
        recs.sort(function(a,b){ if(a.hid!==b.hid) return a.hid?1:-1; return a.s-b.s; });
        var frag=document.createDocumentFragment();
        recs.forEach(function(r){ frag.appendChild(r.h); if(r.t && r.t.tagName==='TABLE') frag.appendChild(r.t); });
        if(anchor && anchor.parentNode===parent) parent.insertBefore(frag, anchor.nextSibling); else parent.insertBefore(frag, parent.firstChild);
        st.textContent='このページを受信が少ない順に並べ替えました（隠れている人は下）';
      };
      /* 全ページ集計：条件に合う人が検索結果全体で何人いるかを数える（v4.28の機能。送信済みも数に含める） */
      wrap.querySelector('#_mnx_tally').onclick=async function(){
        var b=this; b.disabled=true;
        try{
          var c=cond(), seen={}, matched=0, tot=0, skip=0, scanned=0, p1m=0, p1t=0;
          function one(doc, first){
            var rowsN=0, fresh=0;
            qsa('h2.brdbB', doc).filter(isCand).forEach(function(h2){
              rowsN++;
              var r=ADP.parse(h2)||{}; if(!r.id) return;
              if(seen[r.id]) return; seen[r.id]=1; fresh++;
              r.sex=normSex(r.sex);
              if(r.age==null || r.age<0){ skip++; return; }
              tot++; var ok=keep(r,c,true); if(ok) matched++;
              if(first){ p1t++; if(ok) p1m++; }
            });
            return {rows:rowsN, fresh:fresh};
          }
          var siteTotal=ADP.siteTotal?ADP.siteTotal():0;
          var perPage=qsa('h2.brdbB').filter(isCand).length||50;
          var pg=document.querySelector('.pagination'), nums=[];
          if(pg) ((pg.innerText||'').match(/\d+/g)||[]).forEach(function(n){ n=parseInt(n,10); if(n>1) nums.push(n); });
          var pages=Math.max(nums.length?Math.max.apply(null,nums):1, siteTotal?Math.ceil(siteTotal/perPage):1, 1);
          /* 現在のページは、こちらが隠した行も含めて読む */
          var curH=qsa('h2.brdbB').filter(isCand).filter(function(h){ return h.style.display==='none'; });
          curH.forEach(function(h){ var tb=h.nextElementSibling; h.style.display=''; if(tb&&tb.tagName==='TABLE') tb.style.display=''; });
          one(document,true);
          curH.forEach(function(h){ var tb=h.nextElementSibling; h.style.display='none'; if(tb&&tb.tagName==='TABLE') tb.style.display='none'; });
          var done=1, base=location.href.replace(/[&?]page=\d+/,'');
          for(var p=2;p<=pages;p++){
            st.textContent='集計中… '+p+'/'+pages+'ページ';
            try{
              var resp=await fetch(base+'&page='+p,{credentials:'include'});
              var doc=new DOMParser().parseFromString(new TextDecoder('shift_jis').decode(await resp.arrayBuffer()),'text/html');
              var o=one(doc,false);
              if(o.rows===0 || o.fresh===0) break;
              done=p;
            }catch(e){ break; }
          }
          scanned=tot+skip;
          var basis=siteTotal||scanned, gap=basis-scanned, pct=basis?Math.round(matched/basis*100):0;
          st.textContent='検索結果全体 '+basis.toLocaleString()+'人 → 条件に合う '+matched.toLocaleString()+'人（'+pct+'%）／ このページ '+p1m+' / '+p1t+'人\n'
            +'走査 '+done+'/'+pages+'ページ・'+scanned.toLocaleString()+'人ぶんを読み取り'
            +(skip?'（年齢が読めず判定できなかった '+skip+'人）':'')
            +(gap>0?'　※サイト表示より '+gap+'人少ない：末尾ページが取れていない可能性があります':(gap<0?'　※サイト表示より '+(-gap)+'人多い':'　※サイト表示と一致'));
          st.style.whiteSpace='pre-line';
        }catch(e){ st.textContent='集計でエラー: '+e.message; }
        b.disabled=false;
      };
      btn.onclick=async function(){
        btn.disabled=true; var old=btn.textContent; btn.textContent='抽出中...';
        try{
          xList=await extractAll(cond(), function(t){ st.textContent=t; });
          saveXSel(xList.filter(function(r){ return !r.flag; }).map(function(r){ return r.id; }));
          st.textContent=xStopped
            ? ('上限'+MAX+'名に到達：'+xPages+'ページ目までで打ち切り（受信が少ない順）')
            : ('抽出完了：全体 '+(ADP.siteTotal?ADP.siteTotal():'—')+'人 → 条件に合う '+xList.length+'人（'+xPages+'ページ走査）');
          xRender(); xp.style.display='flex';
        }catch(e){ st.textContent='エラー: '+e.message; }
        btn.textContent=old; btn.disabled=false;
      };
    }
    var tries=0, tm=setInterval(function(){ tries++; addButtons(); if(panel.querySelector('#_mnx_btn')||tries>30) clearInterval(tm); },500);
  })();

  console.log('[スカウト絞り込み v'+VER+'] '+ADP.label+' で起動しました');

})();

/* ======================= ここから エン転職 統合ツール ======================= */
(function(){
  "use strict";
  /* v4.2: 旧バージョンが二重に入っていると古い画面が先に出てしまうため、
     先に起動したものがいたら後から動くほうは何もしない。コンソールに警告を出す。 */
  var VER='7.1';
  if(window.__EN_SCOUT_ALL_VER__){
    console.warn('[エン転職スカウト統合ツール] すでに v'+window.__EN_SCOUT_ALL_VER__+' が動いています。v'+VER+' は起動しません。Tampermonkeyの一覧で古いバージョンを削除してください。');
    return;
  }
  window.__EN_SCOUT_ALL_VER__=VER;
  /* ===== 特典（免除・優遇・イベント）定義：ラベル文字で照合 ===== */
  var PERKS = [
    { cat:'免除',   items:['書類選考免除','一次面接免除','一次・二次面接免除','いきなり役員面接','いきなり社長面接'] },
    { cat:'優遇',   items:['管理職採用','前給保証','面接交通費支給'] },
    { cat:'イベント', items:['食事会の開催','出張面接','上司・同僚との面談設定','社内見学','体験入社'] }
  ];
  /* 旧スクリプトとプリセットを共有（既存の保存内容をそのまま使える） */
  var STORE_KEY = 'enBulkRescoutPresets_v1';
  /* 社名を隠すモード（画面共有用）。4媒体の絞り込み側と同じ設定を共有する。 */
  var MASK_KEY2='scoutFilterMask_v1';
  function maskOn(){ try{ return localStorage.getItem(MASK_KEY2)==='1'; }catch(e){ return false; } }
  function dispPreset(n){
    if(!n || !maskOn()) return n||'';
    var names=Object.keys(loadPresets()).sort(), i=names.indexOf(n);
    return i>=0 ? '候補'+(i+1) : '候補';
  }
  var LAST_KEY  = 'enScoutAllLast_v1';   /* モード別の直前設定 */
  var MIN_KEY   = 'enScoutAllMin_v1';    /* 最小化状態 */
  function qsa(sel, root){ return Array.prototype.slice.call((root||document).querySelectorAll(sel)); }

  /* v6.9: 年齢・性別を3か所（一括送信タブ上部 sb／この画面を絞り込む qk／抽出タブ内部 fd）で共通にする。
     どれかを変えたら全部に同じ値を入れ、その場で画面へ反映する。プリセットにも保存する。 */
  var COND_KEY='enScoutAllCond_v1';
  var COND_IDS={ sb:['sbSex','sbLo','sbHi'], qk:['qkSex','qkLo','qkHi'], fd:['fdSex','fdAmin','fdAmax'] };
  var COND_HOOKS={};
  function loadCondStore(){ try{ return JSON.parse(localStorage.getItem(COND_KEY)||'null'); }catch(e){ return null; } }
  function readCondFrom(src){
    var ids=COND_IDS[src], g=function(i){ return document.getElementById(i); };
    var a=g(ids[0]), b=g(ids[1]), c=g(ids[2]);
    if(!a||!b||!c) return null;
    var lo=parseInt(b.value,10); if(isNaN(lo)||lo<0) lo=0;
    var hi=parseInt(c.value,10); if(isNaN(hi)||hi<=0) hi=99;
    return { sex:a.value||'指定なし', lo:lo, hi:hi };
  }
  function readCondAny(){
    return readCondFrom('sb')||readCondFrom('qk')||readCondFrom('fd')||loadCondStore()||{sex:'指定なし',lo:20,hi:29};
  }
  function setCondEverywhere(c){
    if(!c) return;
    var sex=(c.sex==null||c.sex==='')?'指定なし':c.sex;
    var lo=(c.lo==null||isNaN(parseInt(c.lo,10)))?20:parseInt(c.lo,10);
    var hi=(c.hi==null||isNaN(parseInt(c.hi,10)))?29:parseInt(c.hi,10);
    Object.keys(COND_IDS).forEach(function(k){
      var ids=COND_IDS[k];
      var a=document.getElementById(ids[0]), b=document.getElementById(ids[1]), d=document.getElementById(ids[2]);
      if(a) a.value=sex;
      if(b) b.value=lo;
      if(d) d.value=hi;
    });
    try{ localStorage.setItem(COND_KEY, JSON.stringify({sex:sex,lo:lo,hi:hi})); }catch(e){}
    updateGoLabel();
  }
  function updateGoLabel(){
    var g=document.getElementById('sbGo'), c=readCondFrom('sb');
    if(g && c) g.textContent=(c.sex==='指定なし'?'性別不問':c.sex)+' '+c.lo+'〜'+c.hi+'歳 でサイト全体へ反映';
  }
  function condNoteAll(msg){
    ['sbNote','qkLog'].forEach(function(id){ var e=document.getElementById(id); if(e) e.textContent=msg; });
  }
  function fireCond(){
    var handled=false;
    Object.keys(COND_HOOKS).forEach(function(k){ try{ if(COND_HOOKS[k]()) handled=true; }catch(e){} });
    if(handled) return;
    var c=readCondAny();
    var r;
    try{ r=screenCondFilter(c.sex, c.lo, c.hi); }catch(e){ r=null; }
    if(!r || !r.total){ condNoteAll('この画面に一覧が見つかりませんでした'); return; }
    var label=(c.sex==='指定なし'?'性別不問':c.sex)+' '+c.lo+'〜'+c.hi+'歳';
    var pn=(presetSel && presetSel.value)?('プリセット「'+dispPreset(presetSel.value)+'」　'):'';
    var ctxT=0; try{ if(mode==='search'){ var cx=currentSearchCtx(); if(cx && cx.ok) ctxT=cx.total; } }catch(e){}
    var st0={pageOnly:true, total:ctxT, matched:r.shown, shown:r.shown, hidden:r.hidden, page:currentPageNo(), preset:(presetSel && presetSel.value)||'', label:label.replace(/\s+/g,'')};
    screenStat(st0);
    try{ localStorage.setItem('enScoutAllCondScr','1'); }catch(e){}
    var rs=document.getElementById('sbResult');
    if(rs){ rs.textContent='絞り込み　'+((presetSel && presetSel.value)?(dispPreset(presetSel.value)+'　'):'')+r.shown+'/'+r.total+'名　'+label.replace(/\s+/g,''); rs.style.color=r.shown?'#0b8a5b':'#c0392b'; }
    condNoteAll('このページの'+r.total+'名のうち、'+label+'の'+r.shown+'名を表示（'+r.hidden+'名を非表示）。');
    try{ updateCount(); }catch(e){}
  }
  function onCondChanged(src){
    var c=readCondFrom(src); if(!c) return;
    setCondEverywhere(c);
    fireCond();
  }
  function wireCond(src, withEnter){
    var ids=COND_IDS[src];
    ids.forEach(function(i,idx){
      var e=document.getElementById(i); if(!e) return;
      e.addEventListener('change', function(){ onCondChanged(src); });
      if(idx>0 && withEnter) e.addEventListener('keydown', function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); onCondChanged(src); } });
    });
  }
  /* 表組み（検討人材リスト／送信済リスト）の1行をプレビュー用にまとめる。
     td.profile は「年齢 / 性別 / 地域 / 学校名」＋「年収 / 在職状況」の2行構成。
     学校名は外国籍かどうかの判断材料になるので必ず出す。 */
  function rowSummaryFromCells(row){
    var prof=row.querySelector('td.profile');
    var c=row.querySelector('td.count'), ca=row.querySelector('td.countAll');
    var st=row.querySelector('td.scoutStatus');
    var lines=((prof?prof.innerText:row.innerText)||'').split('\n')
      .map(function(s){ return s.replace(/\s+/g,' ').trim(); }).filter(Boolean);
    var parts=[];
    if(c && c.innerText.trim())  parts.push('当該'+c.innerText.trim()+'回');
    if(ca && ca.innerText.trim())parts.push('全'+ca.innerText.trim()+'回');
    if(st && st.innerText.trim())parts.push(st.innerText.replace(/\s+/g,'').slice(0,12));
    var head=(lines[0]||'');
    return {
      main: head.slice(0,90),
      sub:  ((lines.slice(1).join(' ')||'') + (parts.length?('  ['+parts.join(' / ')+']'):'')).slice(0,110),
      hint: foreignHint(head)   /* 学校名が main 側に入っているのでそこから判定 */
    };
  }
  /* 外国籍の可能性を示すヒント語（学校名から推測。あくまで目印で、断定はしない） */
  var FOREIGN_HINTS = ['インドネシア','ベトナム','フィリピン','ネパール','ミャンマー','カンボジア','ラオス',
    'モンゴル','スリランカ','バングラデシュ','パキスタン','ウズベキスタン','キルギス','マレーシア',
    'ブラジル','ペルー','ボリビア','ロシア','ウクライナ','日本語学校','語学院','大學','國際','國立',
    'University','College','Institute','Universidad','Universitas'];
  function foreignHint(text){
    if(!text) return '';
    for(var i=0;i<FOREIGN_HINTS.length;i++){
      if(text.indexOf(FOREIGN_HINTS[i])>-1) return FOREIGN_HINTS[i];
    }
    if(/[•·][ァ-ヶー]/.test(text)) return '学校名にカタカナ区切り';
    /* v3.6: キーワードに無い海外校を拾う。日本の学校名は漢字・かな表記が原則なので、
       英字の単語が2つ以上並ぶ校名は要確認とする。
       「ECC国際外語専門学校」「NHK学園」のような英字1語の日本の学校は対象外。 */
    var w=String(text).match(/[A-Za-z][A-Za-z'.\-]*/g);
    if(w){
      var n=0;
      for(var j=0;j<w.length;j++){ if(w[j].length>=2) n++; }
      if(n>=2) return '学校名が英字表記';
    }
    return '';
  }
  /* ラベルセル（●最終学歴 など）の右隣のセルの値を取り出す */
  function valueByLabel(root, label){
    var cells=qsa('th,td', root);
    for(var i=0;i<cells.length;i++){
      var t=(cells[i].innerText||'').replace(/[\s●・:：]/g,'');
      if(t===label && cells[i+1]) return (cells[i+1].innerText||'').replace(/\s+/g,' ').trim();
    }
    return '';
  }
  /* =========================================================
     モード定義：ページごとに違うのは「行の探し方」だけ
     ========================================================= */
  var MODES = {
    search: {
      label: '検索結果から一括スカウト',
      color: '#e8500e',
      linkRe: /スカウトを送信|スカウト送信/,
      useNative: true,   /* ページ標準のチェックボックスをそのまま選択に使う */
      topN: true,        /* v2.5: 再開。エン転職側の一括チェックは検討人材リスト追加とセットなので使わない */
      hint: '「上から◯件」で行のチェックだけを入れます（検討人材リストには追加しません）。エン転職側の一括チェックは検討人材リストへの追加とセットなので、送信だけしたいときはこちらをお使いください。チェックを付けたら「スクリーニング」で外国籍の可能性がある人をあぶり出せます。重複送信を避けるには、上部の絞り込みで スカウト送信状況＝未送信 などに絞ってからどうぞ。',
      rows: function(){ return qsa('div.personBox'); },
      nativeCb: function(row){ return row.querySelector('input.userCheck[type=checkbox]'); },
      memberNo: function(row){
        var uc = row.querySelector('input.userCheck[user-id]');
        if(uc && uc.getAttribute('user-id')) return uc.getAttribute('user-id');
        var m=(row.innerText||'').match(/会員No\.?\s*([0-9]+)/); return m?m[1]:'';
      },
      isSent: function(row){
        if(row.querySelector('span.profileIcon.scout')) return true;
        var s=row.querySelector('.profileIconSet');
        return /スカウト済/.test((s?s.innerText:'')||'');
      },
      summary: function(row){
        var lines=(row.innerText||'').split('\n').map(function(s){return s.trim();}).filter(Boolean);
        var head=lines.filter(function(s){ return /会員No/.test(s); })[0] || lines[0] || '';
        var badge=row.querySelector('.profileIconSet');
        var b=badge?badge.innerText.replace(/\s+/g,''):'';
        var tbl=row.querySelector('table.userData') || row;
        var gaku=valueByLabel(tbl, '最終学歴');
        var lang=valueByLabel(tbl, 'その他言語');
        var eng =valueByLabel(tbl, '英語');
        var sub=[];
        if(gaku) sub.push('学歴: '+gaku);
        if(lang && !/^-+$/.test(lang)) sub.push('その他言語: '+lang);
        if(eng && !/^(会話-+\/読解-+\/作文-+|-+)$/.test(eng.replace(/\s/g,''))) sub.push('英語: '+eng);
        var hint = foreignHint(gaku);
        if(!hint && lang && !/^-+$/.test(lang)) hint = 'その他言語あり';
        if(!hint && (!gaku || /^-+$/.test(gaku))) hint = '学歴の記載なし';
        return {
          main: (b?('['+b+'] '):'') + head.replace(/（\s*詳しく見る\s*）/,'').replace(/\s+/g,' ').slice(0,90),
          sub:  sub.join('　／　').slice(0,140),
          hint: hint
        };
      }
    },
    folder: {
      label: '検討人材リストから一括スカウト',
      color: '#0b8a5b',
      linkRe: /スカウトを送信|スカウト送信/,
      useNative: true,   /* ページ標準のチェックボックスをそのまま選択に使う */
      topN: true,        /* v2.4: この画面には上からの一括チェックが無いのでスクリプト側で出す */
      hint: 'この画面にはエン転職側の一括チェックが無いので、「上から◯件」で行のチェックをまとめてONにできます。チェックを付けたら「スクリーニング」で外国籍の可能性がある人をあぶり出せます。過去の送信分と混ざる場合は「スカウト送信状況」で絞り込んでからどうぞ。',
      rows: function(){ var t=document.querySelector('table.scoutList'); return t?qsa('tbody tr', t):[]; },
      nativeCb: function(row){ return row.querySelector('input[name="UserID[]"]') || row.querySelector('td.check input[type=checkbox]'); },
      memberNo: function(row){
        var td=row.querySelector('td.num');
        var m=((td?td.innerText:row.innerText)||'').match(/([0-9]{5,})/); return m?m[1]:'';
      },
      isSent: function(row){
        var td=row.querySelector('td.num');
        return /スカウト済/.test((td?td.innerText:'')||'');
      },
      summary: rowSummaryFromCells
    },
    rescout: {
      label: '送信済リストから一括再スカウト',
      color: '#0b6cbf',
      linkRe: /再スカウト/,
      useNative: false,  /* このページには行選択のチェックボックスが無い */
      topN: true,        /* v2.4: チェックボックスが無いので「上から◯件」が唯一の指定方法 */
      hint: 'このページには行選択のチェックボックスが無いので、「上から◯件」を対象にします。誰を外すかは「スクリーニング」または「開始」を押したあとの一覧で選んでください。',
      rows: function(){ var t=document.querySelector('table.scoutList'); return t?qsa('tbody tr', t):[]; },
      nativeCb: function(){ return null; },
      memberNo: function(row){
        var td=row.querySelector('td.num');
        var m=((td?td.innerText:row.innerText)||'').match(/([0-9]{5,})/); return m?m[1]:'';
      },
      isSent: function(){ return false; },  /* 送信済リストは全員送信済みなので警告しない */
      summary: rowSummaryFromCells
    }
  };
  MODES.apply = {
    label: '応募管理（レポート）',
    color: '#6b4fa0',
    linkRe: /(?!)/,
    useNative: false,
    topN: false,
    hint: 'この画面では一括送信は使えません。抽出／レポートタブの STEP3 で応募管理のCSVを出力できます。',
    rows: function(){ return []; },
    nativeCb: function(){ return null; },
    memberNo: function(){ return ''; },
    isSent: function(){ return false; },
    summary: function(){ return {main:'', sub:'', hint:''}; }
  };
  function detectMode(){
    var p = location.pathname;
    if(/\/scout_list\//.test(p))        return 'rescout';
    if(/\/folder_list\//.test(p))       return 'folder';
    if(/\/search_result_list\//.test(p))return 'search';
    if(/\/search_condition_update\//.test(p)) return 'cond';
    if(/\/company\/(apply|appcontrol)\//.test(p)) return 'apply';
    return '';
  }
  var mode = detectMode();
  var M = MODES[mode];
  var API = {}; window.__enScoutBulkAll = API;
  var Q = [], qi = -1, running = false, stage = '';
  var lastPerkReport = '';
  var sentOK = 0, sentFail = 0;
  var booted = false;
  var autoSend = false;        /* 1件目の確認が済んだら true。以降は自動送信 */
  var SEND_DELAY = 1200;       /* 自動送信までの待ち時間（ms）。停止を押す猶予でもある */
  /* v2.0: 待ち時間を Web Worker のタイマーで刻む（バックグラウンド対策の本命）
     実測（2026-08-01、このページを7分間 裏に回して計測）:
       メインスレッドの setTimeout(1200ms) … 実際は 2000ms、最大 60000ms（1分に1回まで抑制）
       Worker 内の      setTimeout(1200ms) … 実際は 1201ms（最大1257ms／抑制なし）
     Chrome はバックグラウンドのタブでメインスレッドのタイマーを強く抑制するが、
     Worker のタイマーは抑制しない。そこで待ちは Worker に任せ、
     発火の通知（postMessage）を受けてメインスレッドで操作する。
     これで別ウィンドウで作業していても送信が進む。 */
  var BG = (function(){
    var w=null, seq=0, cbs={};
    try{
      var src = "var T={};onmessage=function(e){var d=e.data;"
              + "if(d.cmd==='t'){T[d.id]=setTimeout(function(){delete T[d.id];postMessage({id:d.id});},d.ms);}"
              + "else if(d.cmd==='c'){clearTimeout(T[d.id]);delete T[d.id];}};";
      w=new Worker(URL.createObjectURL(new Blob([src],{type:'text/javascript'})));
      w.onmessage=function(e){
        var id=e.data && e.data.id, f=cbs[id];
        if(f){ delete cbs[id]; try{ f(); }catch(err){} }
      };
    }catch(e){ w=null; }
    return {
      ok: !!w,
      /* Worker が使えない環境では素の setTimeout に自動で落ちる */
      wait: function(ms, fn){
        if(!w){ setTimeout(fn, ms); return null; }
        var id=++seq; cbs[id]=fn; w.postMessage({cmd:'t', id:id, ms:ms}); return id;
      },
      every: function(ms, fn){
        var self=this, stopped=false;
        (function loop(){ self.wait(ms, function(){ if(stopped) return; try{ fn(); }catch(e){} loop(); }); })();
        return { stop:function(){ stopped=true; } };
      }
    };
  })();
  /* v1.9: 途中停止の対策（ストール検知＆自動復帰）
     Worker タイマーでも、iframe の読み込みが返ってこない等で止まることはあり得る。
     一定時間 段階が進まなければ自動で復帰を試み、駄目ならその人を飛ばして次へ進む。 */
  var STALL_MS   = 30000;      /* この時間 段階が進まなければストールとみなす */
  var WATCH_MS   = 5000;       /* 監視の間隔 */
  var MAX_RETRY  = 3;          /* 同じ人での復帰試行の上限 */
  var lastTick = 0, stallRetry = 0, watchTimer = null, skipped = [];
  /* ===== 現在のページ番号 ===== */
  function currentPageNo(){
    try{
      var sp = new URLSearchParams(location.search);
      /* v5.9: エン転職の検索結果は pagenum=0/50/100… というオフセット指定 */
      var pnum = sp.get('pagenum');
      if(pnum && /^\d+$/.test(pnum)) return Math.floor(parseInt(pnum,10)/50)+1;
      var keys = ['page','Page','pageNo','PageNo','pageNum','PageNum','p','P'];
      for(var i=0;i<keys.length;i++){
        var v = sp.get(keys[i]);
        if(v && /^\d+$/.test(v)){ var n=parseInt(v,10); if(n>0) return n; }
      }
      var m = location.pathname.match(/(?:search_result_list|folder_list|scout_list)\/(\d+)/);
      if(m){ var n2=parseInt(m[1],10); if(n2>0) return n2; }
    }catch(e){}
    try{
      var cur = document.querySelector('.pager .current, .pager strong, .m_pager .current, ul.pager li.active, .pagerArea .current');
      if(cur){ var mm=(cur.textContent||'').match(/\d+/); if(mm){ var n3=parseInt(mm[0],10); if(n3>0) return n3; } }
    }catch(e){}
    return 1;
  }
  /* ===== パネルの表示／最小化 ===== */
  function loadMin(){ try{ return localStorage.getItem(MIN_KEY)==='1'; }catch(e){ return false; } }
  function saveMin(v){ try{ localStorage.setItem(MIN_KEY, v?'1':'0'); }catch(e){} }
  function showPanel(){ if(!panel) return; panel.style.display='block'; var lc=document.getElementById('ensbaLauncher'); if(lc) lc.style.display='none'; }
  function hidePanel(){ if(!panel) return; panel.style.display='none'; var lc=document.getElementById('ensbaLauncher'); if(lc) lc.style.display='flex'; }
  function setMinimized(v){
    if(!panel) return;
    var body=document.getElementById('ensbaBody');
    var btn=document.getElementById('ensbaMinBtn');
    if(body) body.style.display = v ? 'none' : 'block';
    if(btn) btn.textContent = v ? '□' : '―';
    panel.style.width = v ? '320px' : '680px';
    saveMin(v);
  }
  function isMinimized(){ var b=document.getElementById('ensbaBody'); return !!(b && b.style.display==='none'); }
  function ensureVisible(){ if(!panel) return; if(panel.style.display==='none') showPanel(); if(isMinimized()) setMinimized(false); }
  /* ===== 行の取得（モード共通インターフェース） ===== */
  function sendLink(row){
    return qsa('a', row).filter(function(a){ return M.linkRe.test(a.textContent||''); })[0] || null;
  }
  function getRows(){
    if(!M) return [];
    return M.rows().filter(function(r){ return !!sendLink(r); });
  }
  /* v7.6: 非表示の行にチェックが入っていたら外す。サイト側の「全選択」は非表示の行まで押してしまうため。
     外すときは値の代入ではなく実クリックにして、サイト側の選択数も合わせる。 */
  function uncheckHidden(){
    try{
      if(!M || !M.useNative) return 0;
      var n=0;
      getRows().forEach(function(r){
        if(r.style.display!=='none') return;
        var c=usableCb(r);
        if(c && c.checked){ c.click(); n++; }
        var k=rowKey(r); if(k && extraSel[k]) delete extraSel[k];
      });
      if(n) updateCount();
      return n;
    }catch(e){ return 0; }
  }
  var HIDDEN_WATCH=false;
  function startHiddenWatch(){
    if(HIDDEN_WATCH) return; HIDDEN_WATCH=true;
    function burst(){ [0,80,250,600,1200].forEach(function(ms){ setTimeout(uncheckHidden, ms); }); }
    document.addEventListener('click', function(ev){ if(ev.isTrusted) burst(); }, true);
    document.addEventListener('change', function(ev){ if(ev.isTrusted) burst(); }, true);
    setInterval(uncheckHidden, 700);
  }
  /* v7.5: 送信の対象にできる行 ＝ 絞り込みで非表示にされていない行だけ */
  function sendRows(){
    return getRows().filter(function(r){ return r.style.display!=='none'; });
  }
  /* --------------------------------------------------------------
     選択のしかたは画面によって2通り。ページ側のDOMには何も足さない。
      ・ページ標準のチェックボックスがある画面（検索結果・検討人材リスト）
          → そのチェックをそのまま使う
      ・チェックボックスが無い画面（送信済リスト）
          → 「上から N 件」を対象とみなす。細かい取捨選択は
            開始後のプレビュー（右のパネル）のチェックで行う
     -------------------------------------------------------------- */
  var GO_SEND=null;   /* v6.4: 抽出タブから送信タブへ切り替える */
  var topCount = 0;   /* チェックボックスが無い画面での対象件数 */
  /* v1.8: ページ標準チェックが disabled（span.check.checkDead ＝ 既に検討人材リストに
     入っている人材）だと ON にできず、対象から漏れてしまう。
     そこで「押せないチェックの人」はスクリプト側の内部選択（extraSel）で保持し、
     ページ標準チェック ∪ 内部選択 を対象とする。ページのDOMは一切書き換えない。 */
  var extraSel = {};  /* 会員No → true（ページ標準チェックが使えない行の選択） */
  function usableCb(row){ var c=M.nativeCb?M.nativeCb(row):null; return (c && !c.disabled) ? c : null; }
  function deadCb(row){ var c=M.nativeCb?M.nativeCb(row):null; return (c && c.disabled) ? c : null; }
  function rowKey(row){ return M.memberNo(row) || ''; }
  function isRowOn(row){
    var c=usableCb(row);
    if(c) return c.checked;
    var k=rowKey(row);
    return !!(k && extraSel[k]);
  }
  function checkedRows(){
    var rows=sendRows();
    if(M.useNative) return rows.filter(isRowOn);
    return rows.slice(0, topCount);
  }
  /* v2.2: 選択件数は「上から◯件」の行末（全解除の右）に置く。
     下段に同じ数字を再掲していたのをやめ、1箇所だけにした。
     手動でチェックを外せばこの数字がそのまま減るので、実数はここで確認できる。 */
  function updateCount(){
    var el=document.getElementById('ensbaCount');
    if(!el) return;
    var sel=checkedRows().length;
    var viaScript=M.useNative ? checkedRows().filter(function(r){ return !usableCb(r); }).length : 0;
    var vis=sendRows().length, hid=getRows().length-vis;
    el.textContent = (sel ? (sel + '件選択中' + (viaScript ? ('（うち ' + viaScript + ' 件はパネル側）') : '')) : '未選択')
      + (hid>0 ? ('　／　このページ '+vis+'名が対象、絞り込みで外れた '+hid+'名は送りません') : '');
  }
  /* 上からN件を選択（ページ標準チェックはclickでページ側のイベントも発火させる） */
  function checkTopN(n){
    var allRows=getRows();
    var rows=sendRows();
    if(M.useNative){
      if(!rows.length){ setStatus('このページに対象が見つかりません。'); return; }
      /* いったん全解除（非表示の行も含めて外す） */
      allRows.forEach(function(r){ var c=usableCb(r); if(c && c.checked) c.click(); });
      extraSel={};
      var target=rows.slice(0, Math.max(0,n));
      var viaPage=0, viaScript=0;
      target.forEach(function(r){
        var c=usableCb(r);
        if(c){ if(!c.checked) c.click(); viaPage++; }
        else { var k=rowKey(r); if(k){ extraSel[k]=true; viaScript++; } }
      });
      var msg=(viaPage+viaScript)+' 件を対象にしました';
      if(n>rows.length) msg+='（絞り込み後のこのページは '+rows.length+' 件のみ）';
      if(viaScript) msg+='。うち '+viaScript+' 件はリスト追加済でページのチェックが押せないため、パネル側で選択しています';
      setStatus(msg+'。');
    } else {
      topCount = Math.max(0, Math.min(n, rows.length));
      setStatus('上から '+topCount+' 件を対象にしました'+(n>rows.length?('（絞り込み後のこのページは '+rows.length+' 件のみ）'):'')+'。「開始」を押すと一覧で確認できます。');
    }
    updateCount();
  }
  function clearAll(){
    if(M.useNative){
      getRows().forEach(function(r){ var c=usableCb(r); if(c && c.checked) c.click(); });
      extraSel={};
    } else {
      topCount = 0;
    }
    updateCount(); setStatus('全解除しました。');
  }
  /* ページ標準チェックの変化（手動クリック含む）を件数表示に反映 */
  function watchNative(){
    if(!M.useNative) return;
    document.addEventListener('click', function(ev){
      var t=ev.target;
      if(t && t.tagName==='INPUT' && t.type==='checkbox') setTimeout(updateCount, 0);
    }, true);
  }
  /* 本日のスカウト可能数（残数） */
  function dailyRemaining(){
    var tables=qsa('table');
    for(var i=0;i<tables.length;i++){
      var ths=qsa('th', tables[i]);
      var idx=-1; for(var j=0;j<ths.length;j++){ if(/本日のスカウト可能数/.test(ths[j].textContent||'')){ idx=j; break; } }
      if(idx>-1){
        var dr=tables[i].querySelector('tbody tr');
        if(dr && dr.cells[idx]){ var m=(dr.cells[idx].innerText||'').replace(/,/g,'').match(/\d+/); if(m) return parseInt(m[0],10); }
      }
    }
    return null;
  }
  /* ===== テンプレ取得 ===== */
  function loadTemplates(cb){
    /* v6.8: 送信リンクを複数順に試し、fetch で読めなければ iframe でも試す。
       取れなかったときは理由を添えて返し、前回取得分があればそれを使う */
    var TPL_CACHE='enScoutTplCache_v1';
    function cacheKey(){ try{ return (new URLSearchParams(location.search).get('WorkID'))||'x'; }catch(e){ return 'x'; } }
    function readCache(){ try{ var o=JSON.parse(localStorage.getItem(TPL_CACHE)||'{}'); return o[cacheKey()]||null; }catch(e){ return null; } }
    function writeCache(opts){ try{ var o=JSON.parse(localStorage.getItem(TPL_CACHE)||'{}'); o[cacheKey()]={ts:Date.now(), opts:opts}; localStorage.setItem(TPL_CACHE, JSON.stringify(o)); }catch(e){} }
    function pickSelect(d){
      var sel=d.querySelector('select[name=template]')
           || qsa('select', d).filter(function(x){ return /templ/i.test((x.name||'')+(x.id||'')); })[0]
           || qsa('select', d).filter(function(x){ return qsa('option', x).some(function(o){ return /テンプレ|スカウト文|メッセージ/.test(o.textContent||''); }); })[0];
      return sel;
    }
    function optsOf(sel){ return qsa('option', sel).map(function(o){ return {value:o.value, text:(o.textContent||'').trim()}; }); }
    var urls=[];
    function addUrl(u){ if(u && urls.indexOf(u)<0) urls.push(u); }
    getRows().slice(0,3).forEach(function(r){ var a=sendLink(r); if(a) addUrl(a.getAttribute('href')); });
    try{ (FIND_ROWS||[]).concat(FIND_RAW||[]).slice(0,3).forEach(function(r){ addUrl(r && r.sendUrl); }); }catch(e){}
    qsa('a').filter(function(a){ return /scout_message\/form/.test(a.getAttribute('href')||''); }).slice(0,2).forEach(function(a){ addUrl(a.getAttribute('href')); });
    function fail(why){
      var c=readCache();
      if(c && c.opts && c.opts.length){ cb(c.opts, '前回取得分を表示しています（'+why+'）', true); }
      else cb([], why, false);
    }
    if(!urls.length){ fail('この画面に送信リンクが見つかりません'); return; }
    var idx=0, lastWhy='';
    function viaIframe(url){
      var ifr=document.createElement('iframe'); ifr.style.display='none';
      var done=false;
      ifr.onload=function(){
        setTimeout(function(){
          if(done) return; done=true;
          var opts=[];
          try{ var sel=pickSelect(ifr.contentDocument); if(sel) opts=optsOf(sel); }catch(e){ lastWhy='フォームを読み取れませんでした'; }
          ifr.remove();
          if(opts.length){ writeCache(opts); cb(opts,'',false); } else { idx++; next(); }
        }, 400);
      };
      ifr.src=url; document.body.appendChild(ifr);
      setTimeout(function(){ if(!done){ done=true; try{ ifr.remove(); }catch(e){} lastWhy='フォームの読み込みがタイムアウトしました'; idx++; next(); } }, 15000);
    }
    function next(){
      if(idx>=urls.length){ fail(lastWhy||'送信フォームにテンプレート欄が見つかりません'); return; }
      var url=urls[idx];
      fFetch(url, 15000).then(function(html){
        var d=new DOMParser().parseFromString(html,'text/html');
        var sel=pickSelect(d);
        var opts=sel?optsOf(sel):[];
        if(opts.length){ writeCache(opts); cb(opts,'',false); }
        else { lastWhy='送信フォームにテンプレート欄がありません'; viaIframe(url); }
      }).catch(function(){ lastWhy='送信フォームを取得できませんでした'; viaIframe(url); });
    }
    next();
  }
  /* ===== 特典ラベル→フォーム内チェックボックス照合 ===== */
  function labelOf(d, cb){
    var t='';
    if(cb.id){ var l=d.querySelector('label[for="'+cb.id+'"]'); if(l) t=l.textContent; }
    if(!t){ var p=cb.closest('label'); if(p) t=p.textContent; }
    if(!t && cb.parentElement){ t=cb.parentElement.textContent; }
    return (t||'').replace(/\s/g,'');
  }
  function applyPerks(d, selected){
    var report=[];
    var cbs = qsa('input[type=checkbox], input[type=radio]', d);
    selected.forEach(function(want){
      var w=want.replace(/\s/g,'');
      var hit = cbs.filter(function(c){ return labelOf(d,c)===w; })[0];
      if(!hit) hit = cbs.filter(function(c){ return labelOf(d,c).indexOf(w)>-1; })[0];
      if(hit){
        if(!hit.checked){ hit.checked=true; hit.dispatchEvent(new Event('click',{bubbles:true})); hit.dispatchEvent(new Event('change',{bubbles:true})); }
        report.push('○'+want);
      } else { report.push('×'+want); }
    });
    return report.join(' ');
  }
  /* ===== プリセット ===== */
  function loadPresets(){ try{ return JSON.parse(localStorage.getItem(STORE_KEY)||'{}'); }catch(e){ return {}; } }
  function savePresets(o){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(o)); }catch(e){} }
  function currentConfig(){
    return {
      template: tplSel.value,
      templateText: tplSel.options[tplSel.selectedIndex] ? tplSel.options[tplSel.selectedIndex].textContent : '',
      count: numIn ? (parseInt(numIn.value,10)||0) : 0,
      perks: selectedPerks(),
      sex: readCondAny().sex, lo: readCondAny().lo, hi: readCondAny().hi
    };
  }
  function findCondFor(name){
    try{
      var all=findPresets(), ks=Object.keys(all);
      var k=ks.filter(function(x){ return x===name; })[0] || ks.filter(function(x){ return x.indexOf(name)>-1 || name.indexOf(x)>-1; })[0];
      return k?all[k]:null;
    }catch(e){ return null; }
  }
  function applyConfig(c, name){
    if(!c) return;
    if(c.sex==null && name){
      var fc=findCondFor(name);
      if(fc && fc.sex!=null){ c=Object.assign({}, c, {sex:fc.sex, lo:fc.ageMin, hi:fc.ageMax, _fromFind:true}); }
    }
    if(c.template!=null){
      tplSel.value=c.template;
      if(tplSel.value!==c.template && c.templateText){
        for(var ti=0; ti<tplSel.options.length; ti++){ if(tplSel.options[ti].textContent===c.templateText){ tplSel.selectedIndex=ti; break; } }
      }
    }
    if(c.count && numIn) numIn.value=c.count;
    if(c.sex!=null){ setCondEverywhere({sex:c.sex, lo:c.lo, hi:c.hi}); try{ fireCond(); }catch(e){} }
    var set={}; (c.perks||[]).forEach(function(p){ set[p]=1; });
    qsa('.ensbaPerk', panel).forEach(function(cb){ cb.checked = !!set[cb.value]; });
  }
  function selectedPerks(){ return qsa('.ensbaPerk', panel).filter(function(c){return c.checked;}).map(function(c){return c.value;}); }
  function refreshPresetList(){
    var ps=loadPresets();
    presetSel.innerHTML='<option value="">― プリセット選択 ―</option>';
    Object.keys(ps).forEach(function(name){
      var op=document.createElement('option'); op.value=name; op.textContent=dispPreset(name); presetSel.appendChild(op);
    });
  }
  /* ===== 直前設定（モード別に保存） ===== */
  function loadLastAll(){ try{ return JSON.parse(localStorage.getItem(LAST_KEY)||'{}'); }catch(e){ return {}; } }
  function loadLast(){ var all=loadLastAll(); return all[mode]||null; }
  function saveLast(){
    if(!booted) return;
    try{
      var all=loadLastAll();
      var c=currentConfig();
      c.presetName=(presetSel && presetSel.value)||'';
      all[mode]=c;
      localStorage.setItem(LAST_KEY, JSON.stringify(all));
    }catch(e){}
  }
  /* ===== UI ===== */
  function el(tag, css, txt){ var e=document.createElement(tag); if(css)e.style.cssText=css; if(txt!=null)e.textContent=txt; return e; }
  var reloadTemplates=function(){};
  var panel, statusEl, tplSel, numIn, frame, nextBtn, presetSel, previewBox, screenBox;
  var previewHead, previewGo;
  var pending = [];   /* プレビュー中の送信候補（p.on = 送信対象かどうか） */
  function buildPanel(){
    panel=el('div','position:fixed;top:10px;right:10px;width:680px;max-height:95vh;overflow:auto;background:#fff;border:2px solid '+M.color+';border-radius:8px;z-index:2147483647;box-shadow:0 4px 18px rgba(0,0,0,.3);font-size:13px;font-family:sans-serif');
    panel.id='enScoutBulkAllPanel';
    var head=el('div','background:'+M.color+';color:#fff;padding:8px 10px;font-weight:bold;display:flex;justify-content:space-between;align-items:center;cursor:move');
    head.id='ensbaHead';
    var title=el('span','font-size:12px','エン転職 スカウト統合ツール v7.8');
    title.id='ensbaTitle';
    head.appendChild(title);
    var btns=el('div','display:flex;gap:10px;align-items:center');
    var minBtn=el('span','cursor:pointer;font-size:16px;line-height:1;user-select:none','―');
    minBtn.id='ensbaMinBtn'; minBtn.title='最小化／元に戻す';
    minBtn.onclick=function(){ setMinimized(!isMinimized()); };
    btns.appendChild(minBtn);
    var close=el('span','cursor:pointer;font-size:18px;line-height:1;user-select:none','×');
    close.title='閉じる（右下のボタンで再表示）';
    close.onclick=function(){ hidePanel(); };
    btns.appendChild(close);
    head.appendChild(btns); panel.appendChild(head);
    var body=el('div','padding:10px'); body.id='ensbaBody';
    /* v3.0: タブ（一括送信 / 候補者抽出・レポート） */
    var tabBar=el('div','display:flex;gap:6px;margin-bottom:8px;border-bottom:2px solid '+M.color+';padding-bottom:6px');
    var tabSend=el('button','padding:5px 14px;border:1px solid '+M.color+';background:'+M.color+';color:#fff;border-radius:4px 4px 0 0;cursor:pointer;font-weight:bold;font-size:12px','一括送信');
    var tabFind=el('button','padding:5px 14px;border:1px solid #0b6cbf;background:#fff;color:#0b6cbf;border-radius:4px 4px 0 0;cursor:pointer;font-weight:bold;font-size:12px','取り込んで詳しく');
    tabBar.appendChild(tabSend); tabBar.appendChild(tabFind);
    body.appendChild(tabBar);
    var sendWrap=el('div'); sendWrap.id='ensbaSendTab';
    /* 旧スクリプトが同時に動いていたら警告 */
    if(window.__enBulkRescout || window.__enSearchBulkScout || document.getElementById('bulkCheckPanel')){
      sendWrap.appendChild(el('div','margin-bottom:8px;padding:6px 8px;background:#ffecec;border:1px solid #e0a0a0;border-radius:4px;font-size:11px;color:#a02020',
        '旧スクリプト（一括再スカウト／検索結果 一括スカウト／上位N名一括チェック）が同時に動いています。ボタンが重なるので、Tampermonkeyで旧スクリプトを無効化してください。'));
    }
    /* モード表示＋注意書き */
    var note=el('div','margin-bottom:8px;padding:6px 8px;background:#f7f7f7;border:1px solid #ddd;border-radius:4px;font-size:11px;color:#444');
    note.appendChild(el('div','font-weight:bold;color:'+M.color+';margin-bottom:2px','モード：'+M.label+'（ページから自動判別）'));
    note.appendChild(el('div',null, M.hint));
    sendWrap.appendChild(note);
    var guardBox=el('div'); guardBox.id='ensbaGuard'; sendWrap.appendChild(guardBox);

    /* v5.6: 年齢・性別をエン転職の検索条件そのものに反映する枠（一括送信タブの上部） */
    var condBar=el('div','margin-bottom:8px;padding:7px 9px;background:#fff7ec;border:1px solid #f0d3a8;border-radius:4px');
    condBar.id='ensbaCondBar';
    condBar.innerHTML='<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
      +'<b style="font-size:11px">対象の絞り込み</b>'
      +' <span style="font-size:11px">性別</span> <select id="sbSex" style="padding:3px"><option>指定なし</option><option>男性</option><option>女性</option></select>'
      +' <span style="font-size:11px">年齢</span> <input type="number" id="sbLo" value="20" style="width:50px;padding:3px">〜<input type="number" id="sbHi" value="29" style="width:50px;padding:3px">'
      +' <button id="sbGo" style="padding:5px 14px;background:#e8500e;color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer">サイト全体へ反映</button>'
      +' <button id="sbClr" style="padding:5px 10px;background:#fff;color:#555;border:1px solid #bbb;border-radius:4px;cursor:pointer">表示を戻す</button>'
      +'<span id="sbNote" style="font-size:10px;color:#8a7a55"></span></div>'
      +'<div id="sbResult" style="margin-top:6px;font-size:13px;font-weight:bold;color:#0b8a5b;min-height:18px;line-height:1.6"></div>'
      +'<div style="font-size:10px;color:#8a7a55;margin-top:5px;line-height:1.6">エン転職の検索条件そのものを年齢・性別だけ書き換えます。検索条件の変更画面を経由して送信するので、ページをめくっても条件が続き、母集団の件数自体が減ります。日付種別など他の条件は触りません。</div>';
    sendWrap.appendChild(condBar);
    setTimeout(function(){
      var go=document.getElementById('sbGo'), note=document.getElementById('sbNote');
      wireCond('sb', true);
      updateGoLabel();
      var clr=document.getElementById('sbClr');
      if(clr) clr.onclick=function(){ var n=screenCondClear(); condNoteAll('絞り込みを解除しました（'+n+'名を表示）'); };
      if(!go) return;
      if(!condChangeLink()){
        go.style.display='none';
        if(note) note.textContent='この画面には「検索条件の変更」が無いため、エン転職側の条件は変えられません（検索結果一覧で使えます）';
        return;
      }
      go.onclick=function(){
        var sexName=document.getElementById('sbSex').value;
        var sv={'指定なし':'0','男性':'1','女性':'2'}[sexName]||'0';
        var lo=parseInt(document.getElementById('sbLo').value,10); if(isNaN(lo)||lo<0) lo=0;
        var hi=parseInt(document.getElementById('sbHi').value,10); if(isNaN(hi)||hi<0||hi>=99) hi=0;
        var a=condChangeLink();
        if(!a){ alert('「検索条件の変更」リンクが見つかりませんでした'); return; }
        if(!confirm('エン転職の検索条件そのものを次の内容に変更します。\n\n性別：'+sexName
          +'\n年齢：'+(lo?lo+'歳':'指定なし')+' 〜 '+(hi?hi+'歳':'指定なし')
          +'\n\n検索条件の変更画面を経由して自動で送信します。日付種別など他の条件は変更しません。\nページをめくっても条件は続きます。よろしいですか？')) return;
        try{ localStorage.setItem(COND_PENDING_KEY, JSON.stringify({sex:sv, lo:String(lo), hi:String(hi), ts:Date.now()})); }catch(e){}
        setStatus('検索条件の変更画面へ移動しています…');
        location.href=a.href;
      };
    },0);
    /* プリセット行 */
    var rp=el('div','margin-bottom:8px;padding:6px;background:#f0f4f8;border-radius:4px');
    rp.appendChild(el('span','font-weight:bold','プリセット：'));
    presetSel=el('select','max-width:200px;padding:3px'); rp.appendChild(presetSel);
    presetSel.addEventListener('change', function(){
      var ps0=loadPresets();
      if(presetSel.value && ps0[presetSel.value]){ applyConfig(ps0[presetSel.value], presetSel.value); }
      saveLast(); drawGuard();
    });
    var loadBtn=el('button','padding:3px 8px;margin-left:4px;cursor:pointer','読込');
    loadBtn.onclick=function(){
      var ps=loadPresets(), nm=presetSel.value;
      if(!nm || !ps[nm]){ setStatus('プリセットを選んでから「読込」を押してください'); return; }
      var raw=ps[nm], had=(raw.sex!=null);
      applyConfig(raw, nm);
      saveLast();
      var c=readCondAny(), fb=(!had && findCondFor(nm));
      setStatus('プリセット「'+dispPreset(nm)+'」を読み込みました（'+(c.sex==='指定なし'?'性別不問':c.sex)+' '+c.lo+'〜'+c.hi+'歳'
        +(had?'':(fb?'・抽出タブの保存条件から補いました':'・このプリセットには年齢・性別が保存されていません。設定してから「現状を保存」で上書きしてください'))+'）');
      var on=document.getElementById('sbSiteOn'), go=document.getElementById('sbGo');
      if(on && on.checked && go && go.style.display!=='none' && (had||fb)) go.click();
    };
    rp.appendChild(loadBtn);
    var siteLab=el('label','margin-left:8px;font-size:11px;cursor:pointer');
    siteLab.innerHTML='<input type="checkbox" id="sbSiteOn"> 読込時にサイト全体へも反映（確認あり）';
    rp.appendChild(siteLab);
    setTimeout(function(){
      var cb=document.getElementById('sbSiteOn'); if(!cb) return;
      try{ cb.checked=(localStorage.getItem('enScoutAllSiteOn')==='1'); }catch(e){ cb.checked=false; }
      cb.onchange=function(){ try{ localStorage.setItem('enScoutAllSiteOn', cb.checked?'1':'0'); }catch(e){} };
    },0);
    var saveBtn=el('button','padding:3px 8px;margin-left:4px;cursor:pointer','現状を保存');
    saveBtn.onclick=function(){ var name=prompt('プリセット名を入力（同名は上書き）'); if(!name) return; var ps=loadPresets(); ps[name]=currentConfig(); savePresets(ps); refreshPresetList(); presetSel.value=name; saveLast(); };
    rp.appendChild(saveBtn);
    var delBtn=el('button','padding:3px 8px;margin-left:4px;cursor:pointer','削除');
    delBtn.onclick=function(){ if(!presetSel.value) return; if(!confirm('プリセット「'+dispPreset(presetSel.value)+'」を削除しますか？')) return; var ps=loadPresets(); delete ps[presetSel.value]; savePresets(ps); refreshPresetList(); saveLast(); };
    rp.appendChild(delBtn);
    var maskBtn=el('button','padding:3px 8px;margin-left:4px;cursor:pointer;border-radius:10px');
    function paintMask(){ var on=maskOn(); maskBtn.textContent=on?'🙈 社名を隠す中':'👁 社名表示中'; maskBtn.style.background=on?'#005bac':'#eee'; maskBtn.style.color=on?'#fff':'#555'; maskBtn.style.border='1px solid '+(on?'#005bac':'#ccc'); }
    maskBtn.title='画面共有のとき、プリセット名（社名）を「候補1」などに置き換えます';
    maskBtn.onclick=function(){ var v=presetSel.value; try{ localStorage.setItem(MASK_KEY2, maskOn()?'0':'1'); }catch(e){} refreshPresetList(); presetSel.value=v; paintMask(); };
    paintMask();
    rp.appendChild(maskBtn);
    sendWrap.appendChild(rp);
    sendWrap.insertBefore(rp, guardBox);        /* v7.4: プリセットを一番上、その下に対象の絞り込み */
    sendWrap.insertBefore(condBar, guardBox);
    /* テンプレ */
    var r1=el('div','margin-bottom:8px');
    r1.appendChild(el('span','font-weight:bold','テンプレート：'));
    tplSel=el('select','max-width:420px;padding:3px'); tplSel.innerHTML='<option>読み込み中…</option>';
    tplSel.addEventListener('change', function(){ saveLast(); drawGuard(); });
    r1.appendChild(tplSel);
    var tplReBtn=el('button','padding:3px 8px;margin-left:4px;cursor:pointer','再取得'); tplReBtn.title='スカウト文章（テンプレート）の一覧を読み込み直します'; tplReBtn.onclick=function(){ reloadTemplates(); };
    r1.appendChild(tplReBtn); sendWrap.appendChild(r1);
    /* 特典 */
    var rk=el('div','margin-bottom:8px;padding:6px;border:1px solid #ddd;border-radius:4px');
    rk.appendChild(el('div','font-weight:bold;margin-bottom:4px','特典（フォームで自動チェック）'));
    PERKS.forEach(function(g){
      var row=el('div','display:flex;align-items:flex-start;margin-bottom:6px');
      row.appendChild(el('span','flex:0 0 64px;color:#555;font-weight:bold;padding-top:4px','・'+g.cat));
      var items=el('div','flex:1;display:flex;flex-wrap:wrap;gap:5px 6px');
      g.items.forEach(function(lab){
        var w=el('label','display:inline-flex;align-items:center;white-space:nowrap;cursor:pointer;border:1px solid #cfd8e3;border-radius:4px;padding:2px 8px;background:#f7fafd');
        var cb=el('input'); cb.type='checkbox'; cb.className='ensbaPerk'; cb.value=lab; cb.style.margin='0 4px 0 0';
        cb.addEventListener('change', saveLast);
        w.appendChild(cb); w.appendChild(document.createTextNode(lab));
        items.appendChild(w);
      });
      row.appendChild(items); rk.appendChild(row);
    });
    sendWrap.appendChild(rk);
    /* v2.4〜v2.5: 選択行はページごとに出し分ける（MODES の topN）。現状は3画面とも表示。
       検索結果 … エン転職側の一括チェックは検討人材リスト追加とセットなので、こちらを使う
       検討人材リスト … 一括チェックが無いので出す（ページ標準チェックをまとめてONにする）
       送信済リスト … 行チェック自体が無いので出す（topCount で対象を決める） */
    var r2=el('div','margin-bottom:6px;display:flex;align-items:center;flex-wrap:wrap;gap:6px');
    if(M.topN){
      r2.appendChild(el('span','font-weight:bold','上から'));
      numIn=el('input','width:60px;padding:3px;text-align:center'); numIn.type='number'; numIn.min='1'; numIn.value='30';
      numIn.addEventListener('input', saveLast);
      numIn.addEventListener('keydown', function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); checkTopN(parseInt(numIn.value,10)||0); saveLast(); } });
      numIn.addEventListener('change', function(){ checkTopN(parseInt(numIn.value,10)||0); saveLast(); });
      numIn.title='数字を入力して Enter で適用されます';
      r2.appendChild(numIn); r2.appendChild(el('span',null,'件'));
      var allBtn=el('button','padding:3px 10px;cursor:pointer;border:1px solid #0b8a5b;background:#0b8a5b;color:#fff;border-radius:4px;font-weight:bold','絞り込み後の全員');
      allBtn.title='絞り込みで表示されている人を全員、対象にします（非表示の人は含みません）';
      allBtn.onclick=function(){ var n=sendRows().length; if(!n){ setStatus('対象になる人がいません。'); return; } numIn.value=n; checkTopN(n); saveLast(); };
      r2.appendChild(allBtn);
      [30,50,80].forEach(function(n){
        var b=el('button','padding:3px 8px;cursor:pointer;border:1px solid '+M.color+';background:#fff;color:'+M.color+';border-radius:4px', n+'');
        b.onclick=function(){ numIn.value=n; checkTopN(n); saveLast(); };
        r2.appendChild(b);
      });
    }
    /* v2.3: スクリーニングを独立ボタンに。チェック済みの人材だけを対象にする。 */
    var scrBtn=el('button','padding:4px 12px;cursor:pointer;border:1px solid #164e8a;background:#164e8a;color:#fff;border-radius:4px;font-weight:bold','スクリーニング');
    scrBtn.title='チェックを付けた人材の学歴・語学欄を見て、外国籍の可能性がある人を一覧にします';
    scrBtn.onclick=runScreen;
    r2.appendChild(scrBtn);
    var clrBtn2=el('button','padding:3px 10px;cursor:pointer;border:1px solid #999;background:#fff;color:#555;border-radius:4px','全解除');
    clrBtn2.onclick=clearAll;
    r2.appendChild(clrBtn2);
    /* v2.2: 選択件数はこの行の末尾に置く（下段への再掲を廃止） */
    var cnt=el('span','color:#333;font-weight:bold;margin-left:4px','未選択'); cnt.id='ensbaCount';
    r2.appendChild(cnt);
    sendWrap.appendChild(r2);
    /* v2.2: 下段は「送信 ｜ 残数」だけ。選択件数は上の行に統合済み。
       ステータス文はさらにその下へ分けて、数字と文章が続けて読まれないようにする。 */
    var r3=el('div','margin-bottom:8px');
    var line1=el('div','font-weight:bold;margin-bottom:4px');
    var prog=el('span','color:#333;display:none',''); prog.id='ensbaProg';
    var rem=el('span','color:'+M.color,''); rem.id='ensbaRemain';
    line1.appendChild(prog); line1.appendChild(rem);
    statusEl=el('div','color:#555;font-weight:normal;line-height:1.5','');
    r3.appendChild(line1); r3.appendChild(statusEl); sendWrap.appendChild(r3);
    var r4=el('div','margin-bottom:8px');
    var startBtn=el('button','padding:6px 16px;background:'+M.color+';color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer','開始'); startBtn.onclick=start; r4.appendChild(startBtn);
    nextBtn=el('button','padding:6px 12px;margin-left:6px;border-radius:4px;cursor:pointer;display:none','次の候補へ（送信後）'); nextBtn.onclick=function(){ advance(); }; r4.appendChild(nextBtn);
    var skipBtn=el('button','padding:6px 12px;margin-left:6px;border-radius:4px;cursor:pointer;display:none','この人をスキップ'); skipBtn.id='ensbaSkip'; skipBtn.onclick=function(){ advance(); }; r4.appendChild(skipBtn);
    var stopBtn=el('button','padding:6px 12px;margin-left:6px;border-radius:4px;cursor:pointer','停止'); stopBtn.onclick=stop; r4.appendChild(stopBtn);
    sendWrap.appendChild(r4);
    sendWrap.appendChild(el('div','font-size:11px;color:#666;margin-bottom:6px','対象を選び（検索結果はページ側の一括チェック、検討人材リスト／送信済リストはパネルの「上から◯件」）、「スクリーニング」で外国籍の可能性がある人を確認してから「開始」を押す流れです。「開始」を押すと送信対象の一覧が出ます。送りたくない人はチェックを外してください（外した人はもう一度チェックすれば戻せます）。1件目は目視で送信ボタンを押す方式、2件目以降は自動送信です。途中はいつでも「停止」で止められます。／パネルは基本非表示です（右下のボタンで開閉）。ヘッダーをドラッグで移動、「―」で最小化できます。'));
    /* 送信対象プレビュー（開始を押すとここに一覧が出る） */
    previewBox=el('div','display:none;margin-bottom:8px;border:2px solid '+M.color+';border-radius:6px;overflow:hidden');
    previewBox.id='ensbaPreview';
    sendWrap.appendChild(previewBox);
    /* v2.3: スクリーニング結果（外国籍の可能性がある人の一覧） */
    screenBox=el('div','display:none;margin-bottom:8px;border:2px solid #164e8a;border-radius:6px;overflow:hidden');
    screenBox.id='ensbaScreen';
    sendWrap.appendChild(screenBox);
    frame=el('iframe','width:100%;height:470px;border:1px solid #ccc;border-radius:4px;display:none'); frame.addEventListener('load', onFrameLoad);
    sendWrap.appendChild(frame);
    body.appendChild(sendWrap);
    var findWrap=buildFindTab();
    body.appendChild(findWrap);
    function showTab(which){
      sendWrap.style.display = (which==='send')?'block':'none';
      findWrap.style.display = (which==='find')?'block':'none';
      tabSend.style.background = (which==='send')?M.color:'#fff';   tabSend.style.color = (which==='send')?'#fff':M.color;
      tabFind.style.background = (which==='find')?'#0b6cbf':'#fff'; tabFind.style.color = (which==='find')?'#fff':'#0b6cbf';
      panel.style.width = '680px';
    }
    GO_SEND=function(){ showTab('send'); };
    tabSend.onclick=function(){ if(mode==='apply'){ alert('この画面では一括送信は使えません。'); return; } showTab('send'); };
    tabFind.onclick=function(){ showTab('find'); };
    showTab(mode==='apply' ? 'find' : 'send');
    panel.appendChild(body); document.body.appendChild(panel);
    var launcher=el('div','position:fixed;bottom:16px;right:16px;z-index:2147483646;width:44px;height:44px;border-radius:50%;background:'+M.color+';color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.35);user-select:none','✉');
    launcher.id='ensbaLauncher';
    launcher.title='エン転職 一括スカウトを開く（'+M.label+'）';
    launcher.onclick=function(){ showPanel(); };
    document.body.appendChild(launcher);
    /* ヘッダーをドラッグしてパネルを移動 */
    (function(){
      var dragging=false, sx=0, sy=0, ox=0, oy=0;
      head.addEventListener('mousedown', function(ev){
        if(ev.target===minBtn || ev.target===close) return;
        dragging=true; sx=ev.clientX; sy=ev.clientY;
        var r=panel.getBoundingClientRect(); ox=r.left; oy=r.top;
        panel.style.left=ox+'px'; panel.style.top=oy+'px'; panel.style.right='auto';
        ev.preventDefault();
      });
      document.addEventListener('mousemove', function(ev){
        if(!dragging) return;
        panel.style.left=Math.max(0,(ox+ev.clientX-sx))+'px';
        panel.style.top =Math.max(0,(oy+ev.clientY-sy))+'px';
      });
      document.addEventListener('mouseup', function(){ dragging=false; });
    })();
  }
  /* =========================================================
     v2.3 スクリーニング
     ページ標準の一括チェックで選んだ人材だけを対象に、学歴・語学の記載から
     外国籍の可能性がある人をあぶり出す。自動では外さず、一覧から人が判断する。
     ページのDOMには要素を足さない（該当行へジャンプする時だけ一時的に枠線を出す）。
     ========================================================= */
  var screenHits = [];
  function rowOfMember(no){
    var rows=getRows();
    for(var i=0;i<rows.length;i++){ if(M.memberNo(rows[i])===no) return rows[i]; }
    return null;
  }
  /* チェックを外す：押せるチェックはclickでページ側のイベントも発火。
     押せない（リスト追加済で disabled）行はパネル側の内部選択を消す。 */
  function uncheckRow(row){
    if(!row) return false;
    if(M.useNative){
      var c=usableCb(row);
      if(c){ if(c.checked) c.click(); }
      else { var k=rowKey(row); if(k) delete extraSel[k]; }
      updateCount();
      return true;
    }
    return false;
  }
  function flashRow(row){
    if(!row) return;
    try{
      row.scrollIntoView({behavior:'smooth', block:'center'});
      var prev=row.style.outline, prev2=row.style.outlineOffset;
      row.style.outline='3px solid #164e8a'; row.style.outlineOffset='-3px';
      setTimeout(function(){ row.style.outline=prev; row.style.outlineOffset=prev2; }, 2500);
    }catch(e){}
  }
  function runScreen(){
    var rows=checkedRows();
    if(!rows.length){
      screenBox.style.display='none';
      alert(M.topN
        ? 'チェックが付いている人材がいません。\n「上から◯件」で対象を決めてから押してください。'
        : 'チェックが付いている人材がいません。\nページ上部の一括チェック、または各行のチェックで対象を選んでから押してください。');
      return;
    }
    screenHits=[];
    rows.forEach(function(row){
      var s2=M.summary(row);
      if(typeof s2==='string') s2={main:s2, sub:'', hint:''};
      if(s2 && s2.hint) screenHits.push({ no:M.memberNo(row)||'', sum:s2, row:row });
    });
    renderScreen(rows.length);
  }
  function renderScreen(total){
    ensureVisible();
    screenBox.innerHTML='';
    screenBox.style.display='block';
    previewBox.style.display='none';
    var head=el('div','background:#164e8a;color:#fff;padding:6px 10px;font-weight:bold;font-size:12px',
      'スクリーニング結果：チェック '+total+' 件中、要確認 '+screenHits.length+' 件');
    screenBox.appendChild(head);
    if(!screenHits.length){
      screenBox.appendChild(el('div','padding:10px;background:#fff;font-size:12px;color:#333',
        'チェック中の '+total+' 件には、学校名や語学の記載から外国籍の可能性を示す手がかりは見つかりませんでした（学歴欄が空欄の人材も要確認として拾う設定です）。'));
      var f0=el('div','padding:8px 10px;background:#f7f7f7');
      var cl0=el('button','padding:5px 12px;border:1px solid #999;background:#fff;color:#555;border-radius:4px;cursor:pointer','閉じる');
      cl0.onclick=function(){ screenBox.style.display='none'; };
      f0.appendChild(cl0); screenBox.appendChild(f0);
      setStatus('スクリーニング：該当なし（チェック '+total+' 件）。');
      return;
    }
    var tools=el('div','padding:6px 10px;background:#eaf3ff;border-bottom:1px solid #d6e4f5;display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:11px;color:#164e8a');
    tools.appendChild(el('span',null,'学校名や語学の記載からの目印です。断定はできないので、行をクリックして本人の学歴欄をご確認ください。'));
    screenBox.appendChild(tools);
    var list=el('div','max-height:300px;overflow:auto;background:#fff');
    screenHits.forEach(function(h, idx){
      var r=el('div','display:flex;align-items:flex-start;gap:8px;padding:6px 8px;border-bottom:1px solid #eee;font-size:11px;background:#eef5ff');
      h._row=r;
      r.appendChild(el('span','flex:0 0 20px;color:#888;text-align:right;padding-top:1px',(idx+1)+'.'));
      var col=el('div','flex:1;min-width:0;cursor:pointer');
      col.title='クリックすると、この人材の行までスクロールします';
      col.onclick=function(){ flashRow(h.row); };
      var l1=el('div','color:#222;overflow:hidden;text-overflow:ellipsis;white-space:nowrap');
      l1.appendChild(el('span','font-weight:bold;color:#333;margin-right:6px','No.'+(h.no||'—')));
      l1.appendChild(document.createTextNode(h.sum.main||''));
      l1.appendChild(el('span','margin-left:6px;padding:0 6px;border-radius:8px;background:#164e8a;color:#fff;font-size:10px','要確認: '+h.sum.hint));
      col.appendChild(l1);
      if(h.sum.sub) col.appendChild(el('div','color:#666;margin-top:2px;line-height:1.4;word-break:break-all', h.sum.sub));
      r.appendChild(col);
      var btn=el('button','flex:0 0 auto;padding:3px 8px;border:1px solid #b23;background:#fff;color:#b23;border-radius:3px;cursor:pointer;font-size:11px','チェックを外す');
      btn.onclick=function(){
        if(uncheckRow(h.row)){
          h.off=true;
          r.style.opacity='0.45';
          btn.textContent='外しました';
          btn.disabled=true;
          btn.style.borderColor='#999'; btn.style.color='#888';
          head.textContent='スクリーニング結果：チェック '+checkedRows().length+' 件中、要確認 '+screenHits.length+' 件（'+screenHits.filter(function(x){return x.off;}).length+' 件を除外済み）';
        } else {
          alert('この画面はページ側のチェックボックスが無いため、ここでは外せません。\n「開始」を押したあとの一覧でチェックを外してください。');
        }
      };
      if(!M.useNative){ btn.disabled=true; btn.style.borderColor='#999'; btn.style.color='#888'; btn.title='この画面はチェックボックスが無いので、開始後の一覧で外してください'; }
      r.appendChild(btn);
      list.appendChild(r);
    });
    screenBox.appendChild(list);
    var foot=el('div','padding:8px 10px;background:#f7f7f7;display:flex;align-items:center;flex-wrap:wrap;gap:8px');
    if(M.useNative){
      var allOff=el('button','padding:5px 14px;background:#164e8a;color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer','該当 '+screenHits.length+' 件をまとめて外す');
      allOff.onclick=function(){
        if(!confirm('要確認の '+screenHits.length+' 件のチェックをまとめて外します。\nよろしいですか？')) return;
        screenHits.forEach(function(h){ if(!h.off && uncheckRow(h.row)){ h.off=true; if(h._row) h._row.style.opacity='0.45'; } });
        qsa('button', list).forEach(function(b){ if(!b.disabled){ b.textContent='外しました'; b.disabled=true; b.style.borderColor='#999'; b.style.color='#888'; } });
        head.textContent='スクリーニング結果：チェック '+checkedRows().length+' 件中、要確認 '+screenHits.length+' 件（すべて除外済み）';
        setStatus('要確認の '+screenHits.length+' 件をチェックから外しました。現在のチェックは '+checkedRows().length+' 件です。');
      };
      foot.appendChild(allOff);
    }
    var re=el('button','padding:5px 12px;border:1px solid #164e8a;background:#fff;color:#164e8a;border-radius:4px;cursor:pointer','再スクリーニング');
    re.onclick=runScreen;
    foot.appendChild(re);
    var cl=el('button','padding:5px 12px;border:1px solid #999;background:#fff;color:#555;border-radius:4px;cursor:pointer','閉じる');
    cl.onclick=function(){ screenBox.style.display='none'; };
    foot.appendChild(cl);
    screenBox.appendChild(foot);
    setStatus('スクリーニング：チェック '+total+' 件中 '+screenHits.length+' 件が要確認です。行をクリックすると該当者までスクロールします。');
  }
  function setStatus(t){ if(statusEl) statusEl.textContent=t; }
  /* v2.1: 送信の進捗。分母はチェック（承認）した人数。送信中だけ表示する。 */
  function setProgress(i, n){
    var p=document.getElementById('ensbaProg');
    if(!p) return;
    if(!n){ p.style.display='none'; p.textContent=''; syncRemainSep(); return; }
    p.style.display='inline';
    p.textContent='送信 '+i+'/'+n+'件';
    syncRemainSep();
  }
  /* v2.2: 下段の先頭に区切り「｜」が来ないよう、残数側の区切りを出し分ける */
  function syncRemainSep(){
    var p=document.getElementById('ensbaProg');
    var r=document.getElementById('ensbaRemain');
    if(!r) return;
    var R=r.getAttribute('data-remain');
    if(R==null||R===''){ r.textContent=''; return; }
    var progShown = !!(p && p.style.display!=='none' && p.textContent);
    r.textContent=(progShown?'　｜　':'')+'本日の残数 '+R+'件';
  }
  /* ===== フロー =====
     開始 → 対象者プレビュー（個別除外できる）→ 送信開始
     送信は1件目だけ手動クリック、2件目以降は自動。 */
  /* ===== v5.5: 誤送信ガード =====
     画面右上の社名と、選択中のプリセット名・テンプレート名を突き合わせる。
     一致しないときは赤い帯を出し、開始時に確認ダイアログを挟む。 */
  function pageCompanyName(){
    var t=((document.body.innerText||document.body.textContent||'')+'').replace(/\s+/g,' ');
    var m=t.match(/([^\s]{2,30}?)\s*管理者\s*[：:]/);
    if(m) return m[1].trim();
    m=t.match(/(株式会社[^\s]{1,20}|[^\s]{1,20}株式会社|有限会社[^\s]{1,20})/);
    return m?m[1].trim():'';
  }
  function normName(v){
    return String(v||'')
      .replace(/[（(][^）)]*[)）]/g,'')
      .replace(/株式会社|有限会社|合同会社|合資会社|㈱|㈲/g,'')
      .replace(/[\s　・,、.。\-−ー_\/|]/g,'')
      .toLowerCase();
  }
  /* true=一致 false=不一致 null=判定できない */
  function nameMatches(company, label){
    var a=normName(company), b=normName(label);
    if(!a || b.length<2) return null;
    if(a.indexOf(b)>-1 || b.indexOf(a)>-1) return true;
    /* テンプレート名は「A社_製造_1回目」のように区切られていることがある */
    var parts=String(label||'').split(/[\s_＿\-−ー\/|｜、,（(]+/).map(normName).filter(function(x){ return x.length>=2; });
    for(var i=0;i<parts.length;i++){ if(a.indexOf(parts[i])>-1) return true; }
    return false;
  }
  function guardState(){
    var comp=pageCompanyName();
    var preset=(presetSel && presetSel.value)?presetSel.value:'';
    var tplText=(tplSel && tplSel.options[tplSel.selectedIndex])?tplSel.options[tplSel.selectedIndex].textContent:'';
    if(/読み込み中|取得失敗|^-+$/.test(tplText)) tplText='';
    var okP=preset?nameMatches(comp, preset):null;
    var okT=tplText?nameMatches(comp, tplText):null;
    return {comp:comp, preset:preset, tpl:tplText, okP:okP, okT:okT, bad:(okP===false || okT===false)};
  }
  function drawGuard(){
    var box=document.getElementById('ensbaGuard'); if(!box) return;
    var g=guardState();
    box.style.padding='6px 8px';
    box.style.borderRadius='4px';
    box.style.fontSize='11px';
    box.style.marginBottom='8px';
    box.style.lineHeight='1.6';
    box.style.background = g.bad?'#ffecec':'#eefaf2';
    box.style.border = '1px solid '+(g.bad?'#e0a0a0':'#bfe0d0');
    box.style.color = g.bad?'#a02020':'#0b6b4a';
    box.innerHTML='<b>送信先の確認</b>　この画面の会社：<b>'+(g.comp||'（読み取れません）')+'</b>'
      +'　／　プリセット：'+(g.preset||'未選択')
      +'　／　テンプレート：'+(g.tpl||'未選択')
      +(g.bad?'<br><b>社名と一致していません。別の会社あての文面になっていないか確認してください。</b>':'');
  }

  /* v6.4: ext に {url,no,sum} の配列を渡すと、画面の行ではなくその人たちを対象にする（抽出タブから） */
  /* v6.8: 抽出タブで選んだ人（全ページ分）を送信用の一覧にする */
  function extFromFindSel(){
    var sel=(FIND_ROWS||[]).filter(function(r){ return FIND_SEL[r.id] && !r.noCheck && r.sendUrl; });
    return sel.map(function(r){
      return { ext:true, url:r.sendUrl, no:r.id,
        sum:{ main:r.id+'　'+(r.addr||'')+'　'+r.age+'歳　'+(r.sex||''),
              sub:((r.gaku||'')+'　['+(r.cur>=0?(r.cur===0?'未送信':r.cur+'回送信済'):'回数不明')+(r.last?'／最終送信 '+r.last:'')+']').slice(0,110),
              hint:r.hint||'' } };
    });
  }
  function findSelCount(){ try{ return Object.keys(FIND_SEL||{}).filter(function(k){ return FIND_SEL[k]; }).length; }catch(e){ return 0; } }
  function start(ext){
    if(!Array.isArray(ext)) ext=null;
    ensureVisible();
    var g=guardState();
    if(g.bad){
      if(!confirm('社名と、選択中のプリセット／テンプレートが一致していません。\n\n'
        +'この画面の会社：'+(g.comp||'（読み取れません）')+'\n'
        +'プリセット：'+(g.preset||'（未選択）')+'\n'
        +'テンプレート：'+(g.tpl||'（未選択）')+'\n\n'
        +'別の会社あての文面を送ろうとしていませんか。\nこのまま進めますか？')){
        setStatus('送信先の確認のため中止しました。プリセットとテンプレートを選び直してください。');
        return;
      }
    }
    var usedFind=false;
    if(!ext && findSelCount()>0){
      var fx=extFromFindSel();
      if(fx.length){ ext=fx; usedFind=true; }
    }
    var rows=ext?ext:checkedRows();
    if(!rows.length){
      alert(M.topN
        ? '対象が0件です。「上から◯件」に件数を入れて Enter（または 30/50/80 のボタン）で対象を決めてから開始してください。'
        : '対象が0件です。ページ上部の一括チェック、または各行のチェックで対象を選んでから開始してください。');
      return;
    }
    var remain=dailyRemaining();
    if(remain===0){ alert('本日のスカウト送信可能数が残っていません（残り0件）。明日以降に実行してください。'); return; }
    if(remain!=null && rows.length>remain){
      if(!confirm('本日の残数は '+remain+' 件です。\n選択中の '+rows.length+' 件のうち、上から '+remain+' 件のみ処理します（残りは翌日以降）。\n続けますか？')) return;
      rows=rows.slice(0, remain);
    }
    if(!tplSel.value || tplSel.value==='0'){ if(!confirm('テンプレート未選択（---）です。テンプレートなしで進めますか？')) return; }
    pending = rows.map(function(row){
      if(ext) return { url:row.url, no:row.no, sum:row.sum, sent:false, on:true };
      var s = M.summary ? M.summary(row) : {main:'',sub:'',hint:''};
      if(typeof s==='string') s={main:s, sub:'', hint:''};
      return { url:sendLink(row).getAttribute('href'), no:M.memberNo(row), sum:s, sent:M.isSent(row), on:true };
    });
    renderPreview();
    if(usedFind) setStatus('抽出タブで選んだ '+rows.length+'名（全ページ分）を対象にしました。確認のうえ「送信を開始」を押してください。');
  }
  /* ---- 対象者プレビュー ---- */
  function selectedPending(){ return pending.filter(function(p){ return p.on; }); }
  /* チェックの状態を画面に反映（一覧は作り直さないので、外した人を戻せる） */
  function refreshPreviewState(){
    pending.forEach(function(p){
      if(!p._row) return;
      if(p._cb) p._cb.checked = !!p.on;
      p._row.style.opacity = p.on ? '1' : '0.45';
      p._row.style.textDecoration = 'none';
    });
    var n=selectedPending().length;
    if(previewHead) previewHead.textContent = previewHeadText(n);
    if(previewGo)   previewGo.textContent   = n>0 ? ('この '+n+' 件に送信を開始') : '対象が0件です';
    setStatus('送信する人を確認してください（'+n+'件／一覧 '+pending.length+'件）。');
  }
  function previewHeadText(n){
    var tplText=tplSel.options[tplSel.selectedIndex]?tplSel.options[tplSel.selectedIndex].textContent:'';
    var perks=selectedPerks();
    return '送信対象の確認：'+n+' 件（一覧 '+pending.length+' 件）　｜　テンプレート「'+tplText+'」'+(perks.length?('＋特典 '+perks.join('/')):'');
  }
  function renderPreview(){
    previewBox.innerHTML='';
    previewBox.style.display='block';
    if(screenBox) screenBox.style.display='none';
    frame.style.display='none';
    var sentMarked=pending.filter(function(p){ return p.sent; }).length;
    var hintMarked=pending.filter(function(p){ return p.sum && p.sum.hint; });
    previewHead=el('div','background:'+M.color+';color:#fff;padding:6px 10px;font-weight:bold;font-size:12px','');
    previewBox.appendChild(previewHead);
    /* 一括操作 */
    var tools=el('div','padding:6px 10px;background:#f7f7f7;border-bottom:1px solid #e2e2e2;display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:11px');
    var allOn=el('button','padding:2px 10px;cursor:pointer;border:1px solid #666;background:#fff;color:#333;border-radius:3px;font-size:11px','すべて選択');
    allOn.onclick=function(){ pending.forEach(function(p){ p.on=true; }); refreshPreviewState(); };
    tools.appendChild(allOn);
    var allOff=el('button','padding:2px 10px;cursor:pointer;border:1px solid #666;background:#fff;color:#333;border-radius:3px;font-size:11px','すべて解除');
    allOff.onclick=function(){ pending.forEach(function(p){ p.on=false; }); refreshPreviewState(); };
    tools.appendChild(allOff);
    if(hintMarked.length>0){
      var exBtn=el('button','padding:2px 10px;cursor:pointer;border:1px solid #164e8a;background:#fff;color:#164e8a;border-radius:3px;font-size:11px','要確認の '+hintMarked.length+' 件を外す');
      exBtn.onclick=function(){ hintMarked.forEach(function(p){ p.on=false; }); refreshPreviewState(); };
      tools.appendChild(exBtn);
    }
    if(sentMarked>0){
      var exSent=el('button','padding:2px 10px;cursor:pointer;border:1px solid #a07000;background:#fff;color:#7a5b00;border-radius:3px;font-size:11px','スカウト済の '+sentMarked+' 件を外す');
      exSent.onclick=function(){ pending.forEach(function(p){ if(p.sent) p.on=false; }); refreshPreviewState(); };
      tools.appendChild(exSent);
    }
    tools.appendChild(el('span','color:#666','　チェックを外した人は、もう一度チェックすれば戻せます。'));
    previewBox.appendChild(tools);
    if(hintMarked.length>0){
      previewBox.appendChild(el('div','padding:6px 10px;background:#eaf3ff;color:#164e8a;font-size:11px;border-bottom:1px solid #eee',
        '学校名や語学の記載、学歴欄の空欄から、要確認の人が '+hintMarked.length+' 件います（青色の行）。あくまで目印ですので、学歴欄をご覧のうえご判断ください。'));
    }
    var list=el('div','max-height:320px;overflow:auto;background:#fff;user-select:none;-webkit-user-select:none');
    var prevLast=-1; /* v7.8 Shift範囲選択の起点 */
    pending.forEach(function(p, idx){
      var s=p.sum||{main:'',sub:'',hint:''};
      var bg = s.hint ? ';background:#eef5ff' : (p.sent?';background:#fffaf0':'');
      var r=el('label','display:flex;align-items:flex-start;gap:8px;padding:5px 8px;border-bottom:1px solid #eee;font-size:11px;cursor:pointer'+bg);
      p._row=r;
      var cb=el('input','flex:0 0 auto;margin:1px 0 0 0;transform:scale(1.2);cursor:pointer');
      cb.type='checkbox'; cb.checked=!!p.on;
      cb.addEventListener('click', function(ev){
        /* v7.8 Shift+クリックで、前回クリックした行との間をまとめて同じ状態にする（チェック済みなら範囲を外す） */
        if(ev.shiftKey && prevLast>=0 && prevLast!==idx){
          var lo=Math.min(prevLast,idx), hi=Math.max(prevLast,idx);
          for(var k=lo;k<=hi;k++){ if(pending[k]) pending[k].on=cb.checked; }
        } else { p.on=cb.checked; }
        prevLast=idx; refreshPreviewState();
      });
      p._cb=cb;
      r.appendChild(cb);
      r.appendChild(el('span','flex:0 0 24px;color:#888;text-align:right;padding-top:1px',(idx+1)+'.'));
      r.appendChild(el('span','flex:0 0 96px;font-weight:bold;color:#333;padding-top:1px','No.'+(p.no||'—')));
      var col=el('div','flex:1;min-width:0');
      var l1=el('div','color:#222;overflow:hidden;text-overflow:ellipsis;white-space:nowrap');
      l1.appendChild(document.createTextNode(s.main||''));
      if(s.hint){
        l1.appendChild(el('span','margin-left:6px;padding:0 6px;border-radius:8px;background:#164e8a;color:#fff;font-size:10px','要確認: '+s.hint));
      }
      col.appendChild(l1);
      if(s.sub) col.appendChild(el('div','color:#666;margin-top:2px;line-height:1.4;word-break:break-all', s.sub));
      r.appendChild(col);
      list.appendChild(r);
    });
    previewBox.appendChild(list);
    var foot=el('div','padding:8px 10px;background:#f7f7f7;display:flex;align-items:center;flex-wrap:wrap;gap:8px');
    previewGo=el('button','padding:5px 14px;background:'+M.color+';color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer','');
    previewGo.onclick=function(){
      var list2=selectedPending();
      if(!list2.length){ alert('チェックされた対象がいません。'); return; }
      var tplText=tplSel.options[tplSel.selectedIndex]?tplSel.options[tplSel.selectedIndex].textContent:'';
      var perks=selectedPerks();
      if(!confirm('['+M.label+']\n'+list2.length+' 件にスカウトを送信します。\nテンプレート「'+tplText+'」'+(perks.length?('＋特典 '+perks.join('/')):'')+'\n\n1件目は内容を確認して手動で送信、2件目以降は自動送信です。\n\n'+(BG.ok?'※別のウィンドウやタブで作業していても進みます。このタブを閉じたり、別のページに移動したりしないでください。':'※このブラウザではバックグラウンド対策が使えません。送信中はこのタブを表にしたままにしてください。')+'\n開始しますか？')) return;
      beginSend(list2);
    };
    foot.appendChild(previewGo);
    var cancel=el('button','padding:5px 12px;border:1px solid #999;background:#fff;color:#555;border-radius:4px;cursor:pointer','やめる');
    cancel.onclick=function(){ pending=[]; previewBox.style.display='none'; setProgress(0,0); setStatus('中止しました。'); };
    foot.appendChild(cancel);
    previewBox.appendChild(foot);
    refreshPreviewState();
  }
  function beginSend(list){
    Q = (list || selectedPending()).slice();
    pending = [];
    previewBox.style.display='none';
    sentOK=0; sentFail=0; autoSend=false; skipped=[];
    qi=-1; running=true; frame.style.display='block'; document.getElementById('ensbaSkip').style.display='inline-block';
    tick(); startWatch();
    advance();
  }
  /* ---- ストール検知（v1.9） ---- */
  function tick(){ lastTick=Date.now(); stallRetry=0; }
  function tickSoft(){ lastTick=Date.now(); }
  function startWatch(){
    stopWatch();
    /* 監視も Worker タイマーで回す（裏に回っても止まらない） */
    watchTimer=BG.every(WATCH_MS, function(){
      if(!running) return;
      if(Date.now()-lastTick < STALL_MS) return;
      recover();
    });
  }
  function stopWatch(){ if(watchTimer){ try{ watchTimer.stop(); }catch(e){} watchTimer=null; } }
  function finalSendBtn(d){
    return qsa('a,button,input', d).filter(function(b){ return /スカウトメッセージの送信/.test((b.textContent||'')+(b.value||'')); })[0];
  }
  function hardSkip(reason){
    if(Q[qi]) skipped.push(Q[qi].no||'?');
    setStatus(reason+'ため、この人を飛ばして次へ進みます。');
    advance();
  }
  function recover(){
    if(!running) return;
    var d=null; try{ d=frame.contentDocument; }catch(e){ d=null; }
    if(!d){ hardSkip('画面を読めない'); return; }
    var fs=finalSendBtn(d);
    if(stage==='waitSend'){
      /* 1件目（＝人が目視で押す場面）は待っているだけなので、絶対に自動クリックしない */
      if(qi===0 || !autoSend){ tickSoft(); return; }
      if(fs){
        /* 確認画面のまま止まっている＝まだ送信されていないので、押し直しても二重送信にならない */
        stallRetry++;
        if(stallRetry>MAX_RETRY){ hardSkip('送信ボタンが反応しない'); return; }
        setStatus('反応が無いので送信を再試行します（'+stallRetry+'回目）…');
        tickSoft();
        try{ fs.click(); }catch(e){}
      } else {
        /* 既に画面が変わっている＝load イベントを取りこぼした可能性。判定し直す */
        tickSoft(); onFrameLoad();
      }
      return;
    }
    if(stage==='form' || stage==='confirming'){
      stallRetry++;
      if(stallRetry>MAX_RETRY){ hardSkip('フォームが開かない'); return; }
      setStatus('進まないのでフォームを開き直します（'+stallRetry+'回目）…');
      stage='form'; tickSoft(); frame.src=Q[qi].url;
    }
  }
  /* タブを表に戻した瞬間に、止まっていないかを即座に見る */
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState==='visible' && running && Date.now()-lastTick>=STALL_MS) recover();
    /* v2.0: 待ちは Worker タイマーなので、裏に回っても進む。警告は出さない。 */
  });
  function advance(){
    if(!running) return;
    qi++; nextBtn.style.display='none';
    if(qi>=Q.length){
      setProgress(Q.length, Q.length);
      setStatus('完了：送信成功 '+sentOK+' 件'+(sentFail?(' / 失敗 '+sentFail+' 件'):'')+(skipped.length?(' / 未送信 '+skipped.length+' 件（会員No. '+skipped.join(', ')+'）'):'')+'（対象 '+Q.length+' 件）。');
      running=false; stopWatch(); frame.style.display='none'; document.getElementById('ensbaSkip').style.display='none'; return;
    }
    tick();
    stage='form';
    setProgress(qi+1, Q.length);
    setStatus((Q[qi].no?('会員No.'+Q[qi].no+' の'):'')+'フォームを開いています…');
    frame.src=Q[qi].url;
  }
  function stop(){
    running=false; stage=''; autoSend=false; stopWatch();
    setStatus('停止しました。'+(qi>=0?('送信成功 '+sentOK+' 件 / 残り '+Math.max(0,Q.length-qi-1)+' 件は未処理。'+(skipped.length?('飛ばした会員No. '+skipped.join(', ')):'')):''));
    frame.style.display='none'; nextBtn.style.display='none';
    var s=document.getElementById('ensbaSkip'); if(s) s.style.display='none';
    if(previewBox) previewBox.style.display='none';
    if(screenBox) screenBox.style.display='none';
    pending=[];
  }
  function onFrameLoad(){
    if(!running) return;
    var d; try{ d=frame.contentDocument; }catch(e){ return; } if(!d) return;
    var hasTemplate=!!d.querySelector('select[name=template]');
    var finalSend=qsa('a,button,input', d).filter(function(b){ return /スカウトメッセージの送信/.test((b.textContent||'')+(b.value||'')); })[0];
    if(hasTemplate && stage==='form'){
      stage='confirming'; tick();
      try{
        var sel=d.querySelector('select[name=template]');
        if(tplSel.value && tplSel.value!=='0'){ sel.value=tplSel.value; sel.dispatchEvent(new Event('change',{bubbles:true})); }
        var perks=selectedPerks();
        BG.wait(750, function(){
          if(perks.length){ lastPerkReport = applyPerks(d, perks); }
          var confirmBtn=qsa('a,button,input', d).filter(function(b){ return /送信内容の確認/.test((b.textContent||'')+(b.value||'')); })[0];
          if(confirmBtn){ setStatus('確認画面へ進んでいます…'+(lastPerkReport?('　特典 '+lastPerkReport):'')); confirmBtn.click(); }
          else { setStatus('「送信内容の確認」ボタンが見つかりません。'); }
        }, 750);
      }catch(e){ setStatus('エラー：'+e.message); }
      return;
    }
    if(finalSend && !hasTemplate && stage==='confirming'){
      stage='waitSend'; tick();
      try{ finalSend.style.outline='4px solid #e8500e'; finalSend.style.outlineOffset='2px'; finalSend.scrollIntoView({block:'center'}); }catch(e){}
      if(qi===0 || !autoSend){
        /* 1件目は必ず目視。文面・特典が正しいことを確認してから手動で送信 */
        ensureVisible();
        setStatus('1件目です。内容を確認して、赤枠の「スカウトメッセージの送信」を押してください（2件目以降は自動送信になります）。');
        nextBtn.style.display='inline-block';
      } else {
        /* 2件目以降は自動クリック。停止ボタンで即座に止められる */
        setStatus('自動送信します…'+(lastPerkReport?('　特典 '+lastPerkReport):''));
        BG.wait(SEND_DELAY, function(){
          if(!running || stage!=='waitSend') return;
          try{ finalSend.click(); }catch(e){ setStatus('自動送信に失敗：'+e.message); }
        });
      }
      return;
    }
    if(stage==='waitSend' && !finalSend){
      stage='sent'; tick();
      var txt=''; try{ txt=d.body.innerText||''; }catch(e){}
      var fail=/送信できませんでした|送信に失敗|可能数を超え|上限に達し|エラーが発生しました/.test(txt);
      if(fail){
        sentFail++;
        running=false; stopWatch(); frame.style.display='none'; nextBtn.style.display='none';
        var s=document.getElementById('ensbaSkip'); if(s) s.style.display='none';
        setStatus('送信できませんでした（本日の上限などの可能性）。送信成功 '+sentOK+' 件で停止。残り '+(Q.length-qi-1)+' 件は未処理です。');
        return;
      }
      sentOK++;
      /* 1件目の送信が終わった時点で、残りを自動送信してよいか一度だけ確認する */
      if(qi===0 && Q.length>1 && !autoSend){
        setStatus('1件目の送信が完了しました。');
        if(confirm('1件目の送信が完了しました。\n内容に問題がなければ、残り '+(Q.length-1)+' 件を自動送信します。\n\n自動送信を開始しますか？\n（キャンセルすると、ここで停止します。途中でも「停止」ボタンでいつでも止められます）')){
          autoSend=true;
        } else {
          running=false; stopWatch(); frame.style.display='none'; nextBtn.style.display='none';
          var s2=document.getElementById('ensbaSkip'); if(s2) s2.style.display='none';
          setStatus('1件だけ送信して停止しました。残り '+(Q.length-1)+' 件は未処理です。');
          return;
        }
      }
      setStatus('送信完了（成功 '+sentOK+' 件）。次へ進みます。');
      BG.wait(600, advance); return;
    }
  }
  /* =========================================================
     v3.0 追加：候補者抽出モジュール
     複数条件の横断スキャン／経験職種の絞り込み／通勤圏判定／
     外国籍の要確認フラグ／検討人材リストへの一括登録／レポート用CSV
     ページのDOMは書き換えず、fetch で一覧HTMLを読むだけ。
     ========================================================= */
  var JOB_GROUPS = {
    '営業系': /営業|渉外|外商|カウンターセールス|セールス/,
    '販売・サービス系': /販売|接客|ホールスタッフ|店長|売り場|調理|キッチン|ホテル|美容|エステ|ブライダル|葬祭|フロント/,
    '製造・技能工系': /製造|生産|組立|加工|溶接|塗装|板金|機械オペ|技能工|設備保全|品質管理|生産技術|生産管理/,
    '運輸・物流系': /ドライバー|配送|運転|倉庫|物流|フォークリフト|梱包|仕分/,
    '事務・管理系': /事務|総務|人事|労務|経理|財務|法務|秘書|受付|データ入力|貿易事務/,
    '介護・福祉系': /介護|福祉|ヘルパー|生活相談員|生活支援|児童指導|保育|ケアマネ/,
    '専門技術系': /エンジニア|プログラマ|設計|施工管理|電気|電子|建築|土木|研究|開発|IT/
  };
  function jobGroupOf(txt){
    for(var k in JOB_GROUPS){ if(JOB_GROUPS[k].test(txt||'')) return k; }
    return 'その他';
  }
  var FIND_KEY='enFindPresets_v1', FIND_CUR='enFindCur_v1';
  var FIND_DEFAULT={
    name:'', workId:'', conditions:'',
    jobGroups:[], keywords:'', ngKeywords:'',
    sex:'指定なし', ageMin:20, ageMax:35, incomeMax:0,
    priorityWish:'',
    commuteAddr:''
  };
  function findPresets(){ try{ return JSON.parse(localStorage.getItem(FIND_KEY)||'{}'); }catch(e){ return {}; } }
  function saveFindPresets(o){ try{ localStorage.setItem(FIND_KEY, JSON.stringify(o)); }catch(e){} }
  function findCur(){ try{ return JSON.parse(localStorage.getItem(FIND_CUR)||'null') || FIND_DEFAULT; }catch(e){ return FIND_DEFAULT; } }
  function saveFindCur(o){ try{ localStorage.setItem(FIND_CUR, JSON.stringify(o)); }catch(e){} }

  function fEsc(v){ return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'; }
  function fSleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  function fDl(name, rows){
    var blob=new Blob(['﻿'+rows.join('\n')], {type:'text/csv;charset=utf-8;'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
    document.body.appendChild(a); a.click(); a.remove();
  }
  function fFetch(url, ms, opt){
    ms=ms||20000;
    var ac=new AbortController(); var t=setTimeout(function(){ ac.abort(); }, ms);
    var o=Object.assign({credentials:'include', signal:ac.signal}, opt||{});
    return fetch(url,o).then(function(r){ return r.text(); }).finally(function(){ clearTimeout(t); });
  }
  var findLogEl=null;
  function fLog(m){
    if(findLogEl) findLogEl.textContent=m;
    var sub=document.getElementById('fdResultSub');
    if(sub) sub.textContent=m;
  }

  var PREF_RE=/(北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/;
  function prefOf(addr){ var m=String(addr||'').match(PREF_RE); return m?m[1]:'その他'; }
  /* 一覧に送信回数の記載があれば拾う。無い媒体表示のときは空文字を返し、ボタン自体を出さない */
  function sentLabelOf(b){
    var m=b.match(/スカウト送信\s*(\d+)\s*回/)||b.match(/送信回数\s*(\d+)\s*回/)||b.match(/送信済[^0-9]{0,4}(\d+)\s*回/);
    if(m){ var n=parseInt(m[1],10); return n<=0?'未送信':(n===1?'1回':(n===2?'2回':'3回以上')); }
    if(/未送信/.test(b)) return '未送信';
    return '';
  }

  function parseListHtml(html){
    var doc=new DOMParser().parseFromString(html,'text/html');
    var t=(doc.body.textContent||'').replace(/[ 　]+/g,' ');
    return t.split(/会員No\./).slice(1).map(function(b){
      var h=b.match(/^(\d+)\s*\/\s*(男性|女性)\s*\/\s*(\d+)歳\s*\/\s*([^\/]+?)\s*\/\s*(在職中|離職中)/);
      if(!h) return null;
      var inc=b.match(/直近の年収\s*(\d+)\s*[～〜]\s*(\d+)\s*万円/)||b.match(/直近の年収\s*(\d+)\s*万円/);
      function g(re){ var m=b.match(re); return m?String(m[1]).trim():''; }
      return {
        id:h[1], sex:h[2], age:parseInt(h[3],10), addr:h[4].trim(),
        jyo:(h[5]==='在職中'?'在職':'離職'),
        inc: inc?parseInt(inc[1],10):null,
        gaku: g(/最終学歴\s*([^\/●]{0,26})/),
        job:  g(/経験職種\s*([\s\S]{0,200}?)●/),
        wish: g(/希望勤務地\s*([\s\S]{0,300}?)●/),
        wishJob: g(/希望職種\s*([\s\S]{0,200}?)●/),
        lang: g(/その他言語\s*([^●]{0,20})/),
        tn:   g(/転職回数\s*(なし|\d+回)/),
        login:g(/最終ログイン日\s*(\d\d\/\d\d\/\d\d)/)||'-',
        pref: prefOf(h[4].trim()),
        sentLabel: sentLabelOf(b),
        raw: b.replace(/\s+/g,' ').slice(0,3000)   /* v5.3: 会員No以降の本文。キーワード判定に使う（3000字で打ち切り） */
      };
    }).filter(Boolean);
  }

  function openCondition(workId, cno){
    var q=new URLSearchParams({WorkID:workId, ConditionNo:cno, save:1, updatecond:1});
    return fFetch('/company/scout/search_result_list/?'+q).then(function(html){
      var doc=new DOMParser().parseFromString(html,'text/html');
      var p2=qsa('a',doc).filter(function(a){ return a.textContent.trim()==='2'; })[0];
      var txt=(doc.body.textContent||'').replace(/\s+/g,' ');
      var m=txt.match(/([\d,]+)\s*人[^。]{0,10}見つかりました/);
      var total=m?parseInt(m[1].replace(/,/g,''),10):0;
      var PK=null, pp=null;
      if(p2){ var u=new URL(p2.href, location.origin); PK=u.searchParams.get('PK'); pp=u.searchParams.get('_pp_'); }
      else { var e2=doc.querySelector('input[name="PK"]'); PK=e2?e2.value:null; }
      return {PK:PK, pp:pp, total:total, firstHtml:html};
    });
  }

  async function scanCandidates(cfg){
    var conds=String(cfg.conditions).split(/[,、\s]+/).filter(Boolean);
    var map=new Map();
    for(var ci=0; ci<conds.length; ci++){
      var cno=conds[ci];
      fLog('条件No.'+cno+' を確認中…');
      var info=await openCondition(cfg.workId, cno);
      if(!info.PK){ fLog('条件No.'+cno+' のPKが取得できませんでした'); continue; }
      var pages=Math.ceil(info.total/50);
      if(info.total>=3000) fLog('条件No.'+cno+' は上限3000件です。条件の分割を検討してください');
      for(var i=0;i<pages;i++){
        var rows=[], tries=0;
        while(tries<4){
          var html = (i===0 && tries===0) ? info.firstHtml
            : await fFetch('/company/scout/search_result_list/?'+new URLSearchParams({WorkID:cfg.workId, ConditionNo:cno, _pp_:info.pp||'', PK:info.PK, pagenum:i*50}));
          rows=parseListHtml(html);
          if(rows.length) break;
          tries++;
          if(tries<4){ fLog('条件No.'+cno+'：'+(i+1)+'ページ目が取得できませんでした。'+(tries*2)+'秒待って再試行します（'+tries+'/3）'); await fSleep(tries*2000); }
        }
        if(!rows.length){ fLog('条件No.'+cno+'：'+(i+1)+'ページ目を3回試しても取得できませんでした。ここで打ち切ります（累計 '+map.size+'名）'); break; }
        rows.forEach(function(r){
          var cur=map.get(r.id);
          if(cur){ if(cur.from.indexOf(cno)<0) cur.from.push(cno); }
          else { r.from=[cno]; r.PK=info.PK; r.pg=(i+1); map.set(r.id, r); }
        });
        fLog('条件No.'+cno+'：'+(i+1)+'/'+pages+'ページ（累計 '+map.size+'名）');
        await fSleep(600);
      }
    }
    return Array.from(map.values());
  }

  function applyFindFilter(rows, cfg){
    var kw=(cfg.keywords||'').split(/[,、\s]+/).filter(Boolean);
    var ng=(cfg.ngKeywords||'').split(/[,、\s]+/).filter(Boolean);
    var areaW=(cfg.priorityWish||'').split(/[|,、\s]+/).filter(Boolean);
    var reWish=areaW.length?new RegExp(areaW.map(function(w){ return w.replace(/[.*+?^${}()\\[\]]/g,'\\$&'); }).join('|')):null;
    var areaOn=(cfg.areaOnly!==false) && !!reWish;
    var reAddr=cfg.commuteAddr?new RegExp(cfg.commuteAddr):null;
    return rows.filter(function(r){
      if(cfg.sex && cfg.sex!=='指定なし' && r.sex!==cfg.sex) return false;
      if(r.age<cfg.ageMin || r.age>cfg.ageMax) return false;
      if(cfg.incomeMax && r.inc!==null && r.inc>cfg.incomeMax) return false;
      if(areaOn){
        var hay=(r.addr||'')+' '+(r.wish||'');
        if(!reWish.test(hay) && !(reAddr && reAddr.test(r.addr||''))) return false;
      }
      var g=jobGroupOf(r.job);
      if(cfg.jobGroups.length && !r.fromList && cfg.jobGroups.indexOf(g)<0) return false;
      var all=(r.raw||'')+' '+r.job+' '+r.wishJob+' '+(r.gaku||'')+' '+(r.wish||'')+' '+(r.addr||'');
      if(kw.length && !kw.some(function(k){
        /* v6.3: 一覧から取り込んだ人は居住地だけを見る（学校名に県名が入っていても拾わない） */
        if(r.fromList) return (r.addr||'').indexOf(k)>-1 || (r.job||'').indexOf(k)>-1;
        return r.job.indexOf(k)>-1 || r.wishJob.indexOf(k)>-1 || (r.gaku||'').indexOf(k)>-1;
      })) return false;
      /* v5.7: 除外は広く。卒業見込み・在学中などは学歴欄にしか出ないため本文全体を見る */
      if(ng.length && ng.some(function(k){ return all.indexOf(k)>-1; })) return false;
      return true;
    }).map(function(r){
      var p=3, label='その他', color='#7f8c8d';
      if(reWish && r.fromList && reWish.test(r.addr||'')){ p=1; label='居住地一致'; color='#c0392b'; }
      else if(reWish && reWish.test(r.wish||'')){ p=1; label='勤務地希望'; color='#c0392b'; }
      else if(reAddr && reAddr.test(r.addr)){ p=2; label='通勤圏'; color='#e67e22'; }
      var hint=foreignHint(r.gaku), kind=hint?'foreign':'';
      if(!hint && r.lang && !/^-+$/.test(r.lang)){ hint='その他言語あり'; kind='lang'; }
      if(!hint && (!r.gaku || /^-+$/.test(r.gaku))){ hint='学歴の記載なし'; kind='unknown'; }
      r.p=p; r.label=label; r.color=color; r.group=jobGroupOf(r.job); r.hint=hint; r.hintKind=kind;
      return r;
    }).sort(function(a,b){ return a.p-b.p || a.addr.localeCompare(b.addr); });
  }

  function csrfToken(){
    var e=document.querySelector('input[name="E13CT"]');
    return e?e.value:'';
  }
  async function appendExamine(workId, PK, ids, token){
    var ok=0;
    for(var i=0;i<ids.length;i+=50){
      var chunk=ids.slice(i,i+50);
      var body=new URLSearchParams();
      body.set('WorkID', workId); body.set('PK', PK); body.set('E13CT', token);
      chunk.forEach(function(id){ body.append('UserID[]', id); });
      var res=await fetch('/company/api/examine_append_api/run', {
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},
        body:body
      });
      if(res.ok) ok+=chunk.length;
      fLog('検討人材リスト登録 '+ok+'/'+ids.length);
      await fSleep(400);
    }
    return ok;
  }

  /* 抽出結果のうち、いま表示中のページにある人のチェックをONにする（v2.5の送信フローへ橋渡し） */
  function markOnPage(ids){
    if(!M || !M.useNative) return {on:0, miss:ids.length};
    var set={}; ids.forEach(function(i){ set[i]=1; });
    var on=0, viaScript=0;
    getRows().forEach(function(row){
      var no=M.memberNo(row);
      if(!set[no]) return;
      var c=usableCb(row);
      if(c){ if(!c.checked) c.click(); on++; }
      else { if(no){ extraSel[no]=true; viaScript++; } }
    });
    updateCount();
    return {on:on+viaScript, miss:ids.length-(on+viaScript)};
  }

  /* ===== レポート用CSV ===== */
  async function reportStep1(){
    var q=new URLSearchParams(location.search);
    var WorkID=q.get('WorkID'), PK=q.get('PK');
    if(!WorkID||!PK){ alert('送信済みリストのページで実行してください'); return; }
    var BASE='/company/scout/scout_list/?WorkID='+WorkID+'&PK='+PK+'&pagenum=';
    var h0=await fFetch(BASE+'0');
    var total=parseInt(((h0.match(/全<em[^>]*>([\d,]+)<\/em>/)||[0,'0'])[1]).replace(/,/g,''),10);
    var pages=Math.ceil(total/50);
    var out=['会員NO,年齢,性別,都道府県,学歴,年収,状況,回数,送信日,ステータス'];
    for(var p=0;p<pages;p++){
      var doc=new DOMParser().parseFromString(await fFetch(BASE+p*50),'text/html');
      qsa('table tbody tr',doc).forEach(function(tr){
        var td=qsa('td',tr).map(function(x){ return (x.innerText||x.textContent||'').replace(/\s+/g,' ').trim(); });
        if(td.length) out.push(td.map(fEsc).join(','));
      });
      fLog('STEP1 '+(p+1)+'/'+pages);
      await fSleep(250);
    }
    fDl('step1_'+new Date().toISOString().slice(0,10)+'.csv', out);
    fLog('STEP1 完了 '+(out.length-1)+'件');
  }

  async function reportStep2(){
    var q=new URLSearchParams(location.search);
    var WorkID=q.get('WorkID'), PK=q.get('PK');
    if(!WorkID||!PK){ alert('送信済みリストのページで実行してください'); return; }
    var BASE='/company/scout/scout_list/?WorkID='+WorkID+'&PK='+PK+'&pagenum=';
    var h0=await fFetch(BASE+'0');
    var total=parseInt(((h0.match(/全<em[^>]*>([\d,]+)<\/em>/)||[0,'0'])[1]).replace(/,/g,''),10);
    var pages=Math.ceil(total/50);
    var targets=[], seen={};
    for(var p=0;p<pages;p++){
      var doc=new DOMParser().parseFromString(await fFetch(BASE+p*50),'text/html');
      qsa('table tbody tr',doc).forEach(function(tr){
        var t=(tr.innerText||tr.textContent||'');
        if(!((t.indexOf('打診中')>-1 && t.indexOf('未読')<0) || t.indexOf('応募済')>-1)) return;
        var td=tr.querySelectorAll('td');
        var id=((td[1]?(td[1].innerText||td[1].textContent):'')||'').replace(/\s+/g,'').trim();
        if(!id || seen[id]) return; seen[id]=1;
        var a=td[1]?td[1].querySelector('a'):null;
        targets.push({id:id, url:a?a.href:'', oubo:(t.indexOf('応募済')>-1?'応募済':''), cnt:((td[5]?(td[5].innerText||td[5].textContent):'')||'').replace(/\s+/g,'').trim()});
      });
      fLog('STEP2 一覧 '+(p+1)+'/'+pages);
    }
    var out=['会員NO,詳細職種,詳細住所,雇用形態,職種大分類,応募フラグ,送信回数'], done=0;
    async function worker(list){
      for(var i=0;i<list.length;i++){
        var x=list[i], job='職種不明（詳細取得不可）', addr='', emp='';
        if(x.url){
          try{
            var d=new DOMParser().parseFromString(await fFetch(x.url),'text/html');
            var gv=function(ls){
              var th=qsa('th,td.label,dt',d).filter(function(e2){ return ls.some(function(l){ return (e2.innerText||e2.textContent||'').trim().indexOf(l)>-1; }); })[0];
              return (th && th.nextElementSibling) ? (th.nextElementSibling.innerText||th.nextElementSibling.textContent||'').trim().replace(/\s+/g,' ') : '';
            };
            job=gv(['経験職種','現在の職種'])||'職種不明';
            addr=gv(['住所','現住所']).replace(/〒\s*[\d-]+\s*/,'');
            emp=((d.body.innerText||d.body.textContent||'').indexOf('正社員')>-1)?'正社員':'その他';
          }catch(e){ job='取得エラー'; }
        }
        out.push([x.id, job, addr, emp, jobGroupOf(job), x.oubo, x.cnt].map(fEsc).join(','));
        done++; if(done%10===0) fLog('STEP2 詳細 '+done+'/'+targets.length);
        await fSleep(400);
      }
    }
    var N=3, buckets=[];
    for(var b=0;b<N;b++) buckets.push(targets.filter(function(_,j){ return j%N===b; }));
    await Promise.all(buckets.map(worker));
    fDl('step2_'+new Date().toISOString().slice(0,10)+'.csv', out);
    fLog('STEP2 完了 '+(out.length-1)+'件');
  }

  async function reportStep3(){
    var PK=new URLSearchParams(location.search).get('PK');
    if(!PK){ alert('URLに PK が付いたエン転職の管理画面で実行してください'); return; }
    var LIST='/company/appcontrol/applicant_list/';
    var jobs=[], hereW=new URLSearchParams(location.search).get('WorkID');
    if(LIST.replace(/\/$/,'')===location.pathname.replace(/\/$/,'') && hereW){
      jobs=[hereW];
    }else{
      var top=new DOMParser().parseFromString(await fFetch('/company/appcontrol/?PK='+encodeURIComponent(PK)),'text/html');
      var sw={};
      qsa('a[href*="applicant_list"]',top).forEach(function(a){
        var m=(a.getAttribute('href')||'').match(/WorkID=(\d+)/);
        if(m && !sw[m[1]]){ sw[m[1]]=1; jobs.push(m[1]); }
      });
      if(!jobs.length && hereW) jobs=[hereW];
    }
    if(!jobs.length){ alert('応募者一覧が見つかりませんでした。応募管理の画面を開いてから実行してください'); return; }
    var out=['募集ID,応募日,氏名,性別,年齢,都道府県,応募区分,対応状況,未読,要返信'], seen={}, total=0;
    for(var i=0;i<jobs.length;i++){
      var wid=jobs[i];
      var visited={}, queue=[LIST+'?WorkID='+wid+'&PK='+encodeURIComponent(PK)], guard=0;
      while(queue.length && guard<60){
        guard++;
        var u=queue.shift(); if(visited[u]) continue; visited[u]=1;
        var html='';
        try{ html=await fFetch(u); }catch(e){ fLog('STEP3 取得エラー 募集'+wid); break; }
        var doc=new DOMParser().parseFromString(html,'text/html');
        (function(wid2){
          qsa('tr.js_applyTr',doc).forEach(function(tr){
            var g=function(sel){ var e=tr.querySelector(sel); return e?((e.innerText||e.textContent||'').replace(/\s+/g,' ').trim()):''; };
            var dtxt=g('td.date'), ntxt=g('td.name');
            var dm=dtxt.match(/(\d{2,4})\/(\d{1,2})\/(\d{1,2})/);
            if(!dm||!ntxt) return;
            var y=dm[1].length===2?('20'+dm[1]):dm[1];
            var dt=y+'/'+('0'+dm[2]).slice(-2)+'/'+('0'+dm[3]).slice(-2);
            var kbn=dtxt.replace(/\d{2,4}\/\d{1,2}\/\d{1,2}/,'').replace(/\s+/g,'').trim();
            var nm=ntxt.replace(/(男性|女性)[\s\S]*$/,'').replace(/\s+/g,' ').trim();
            var sex=(ntxt.match(/(男性|女性)/)||[])[1]||'';
            var age=(ntxt.match(/(\d+)\s*歳/)||[])[1]||'';
            var pref=(ntxt.match(PREF_RE)||[])[1]||'';
            var all=(tr.innerText||tr.textContent||'');
            var key=wid2+'|'+dt+'|'+nm+'|'+age;
            if(seen[key]) return; seen[key]=1;
            out.push([wid2, dt, nm, sex, age, pref, kbn,
                      g('td.progress').replace(/評価[\s\S]*$/,'').replace(/[-—]{2,}/,'').trim(),
                      /未読/.test(all)?'未読':'', /要返信/.test(all)?'要返信':''].map(fEsc).join(','));
            total++;
          });
        })(wid);
        qsa('a[href*="applicant_list"]',doc).forEach(function(a){
          var t=(a.innerText||a.textContent||'').replace(/\s+/g,'');
          if(!(/^\d+$/.test(t) || /次/.test(t))) return;
          var h=a.getAttribute('href')||'';
          if(h.indexOf('WorkID='+wid)<0) return;
          var abs=(h.charAt(0)==='/')?h:(LIST+h.replace(/^\.?\/?/,''));
          if(!visited[abs] && queue.indexOf(abs)<0) queue.push(abs);
        });
        fLog('STEP3 募集 '+(i+1)+'/'+jobs.length+'（ID'+wid+'） 取得 '+total+' 件');
        await fSleep(300);
      }
    }
    if(total===0){ alert('応募者を1件も取得できませんでした。応募管理の応募者一覧を開いた状態で、もう一度お試しください'); fLog('STEP3 0件'); return; }
    fDl('step3_oubo_'+new Date().toISOString().slice(0,10)+'.csv', out);
    fLog('STEP3 完了 '+total+'件（募集'+jobs.length+'件分）');
  }

  /* ===== 抽出タブのUI（v3.5でレイアウト再構成） ===== */
  var FIND_ROWS=[], FIND_VIEW=[], FIND_SEL={}, FIND_RAW=[], FIND_BASE=[], FIND_CTX=null;
  var FIND_FACET={pref:{}, group:{}, jyo:{}, sent:{}};
  var LIST_SC={t:'all', f:1, to:5};   /* v7.0: 取り込み範囲（all／page／range） */
  var FIND_SORT='login';
  var FOR_MODES=['判定しない','学校名で判定','学校名＋語学欄','学校名＋語学欄＋学歴なし'];
  var FOR_ACTS =['一覧から除外する','一覧に残してチェックしない'];

  var SORTS={
    login:  {label:'ログインが新しい順', fn:function(a,b){ return String(b.login).localeCompare(String(a.login)); }},
    commute:{label:'通勤圏が近い順',     fn:function(a,b){ return a.p-b.p || String(b.login).localeCompare(String(a.login)); }},
    last:   {label:'最終送信が新しい順', fn:function(a,b){ return String(b.last||'').localeCompare(String(a.last||'')); }},
    cnt:    {label:'送信回数が多い順',   fn:function(a,b){ return (b.cur||0)-(a.cur||0) || String(b.last||'').localeCompare(String(a.last||'')); }},
    age:    {label:'年齢が若い順',       fn:function(a,b){ return a.age-b.age; }},
    inc:    {label:'年収が低い順',       fn:function(a,b){ return (a.inc==null?9999:a.inc)-(b.inc==null?9999:b.inc); }}
  };

  /* いま開いている検索結果の識別情報を、URL・ページ送りリンク・hidden から集める */
  function currentSearchCtx(){
    var q=new URLSearchParams(location.search);
    var ctx={WorkID:q.get('WorkID')||'', ConditionNo:q.get('ConditionNo')||'', PK:q.get('PK')||'', pp:q.get('_pp_')||''};
    if(!ctx.WorkID || !ctx.PK){
      var links=qsa('a').filter(function(a){
        var h=a.getAttribute('href')||'';
        return h.indexOf('search_result_list')>-1 && h.indexOf('pagenum=')>-1;
      });
      if(links.length){
        var u=new URL(links[0].href, location.origin);
        ctx.WorkID      = ctx.WorkID      || u.searchParams.get('WorkID')||'';
        ctx.ConditionNo = ctx.ConditionNo || u.searchParams.get('ConditionNo')||'';
        ctx.PK          = ctx.PK          || u.searchParams.get('PK')||'';
        ctx.pp          = ctx.pp          || u.searchParams.get('_pp_')||'';
      }
    }
    if(!ctx.PK){ var eP=document.querySelector('input[name="PK"]'); if(eP) ctx.PK=eP.value; }
    if(!ctx.WorkID){ var eW=document.querySelector('input[name="WorkID"]'); if(eW) ctx.WorkID=eW.value; }
    var txt=(document.body.textContent||'').replace(/\s+/g,' ');
    var m=txt.match(/([\d,]+)\s*人[^。]{0,10}見つかりました/);
    ctx.total = m ? parseInt(m[1].replace(/,/g,''),10) : 0;
    ctx.capped = /3000\s*人以上/.test(txt) || ctx.total>=3000;
    ctx.ok = !!(ctx.WorkID && ctx.PK && ctx.total);
    return ctx;
  }

  /* いま開いている検索結果をページ送りしながら全件取り込む */
  async function scanCurrent(ctx){
    var map=new Map(), pages=Math.ceil((ctx.total||0)/50)||1;
    for(var i=0;i<pages;i++){
      var rows=[], tries=0;
      while(tries<4){
        var qs=new URLSearchParams();
        qs.set('WorkID', ctx.WorkID);
        if(ctx.ConditionNo) qs.set('ConditionNo', ctx.ConditionNo);
        if(ctx.pp) qs.set('_pp_', ctx.pp);
        if(ctx.PK) qs.set('PK', ctx.PK);
        qs.set('pagenum', i*50);
        var html=await fFetch('/company/scout/search_result_list/?'+qs);
        rows=parseListHtml(html);
        if(rows.length) break;
        tries++;
        if(tries<4){ fLog((i+1)+'ページ目が取得できませんでした。'+(tries*2)+'秒待って再試行します（'+tries+'/3）'); await fSleep(tries*2000); }
      }
      if(!rows.length){ fLog((i+1)+'ページ目を3回試しても取得できませんでした。ここで打ち切ります（累計 '+map.size+'名）'); break; }
      rows.forEach(function(r){
        if(map.has(r.id)) return;
        r.PK=ctx.PK; r.from=[ctx.ConditionNo||''];
        r.pg=(i+1);
        map.set(r.id, r);
      });
      fLog('取り込み中… '+map.size+' / '+ctx.total+'名');
      await fSleep(600);
    }
    return Array.from(map.values());
  }

  /* ===== v6.2: 検討人材リスト・送信済みリストの取り込み（抽出タブ用） ===== */
  function findFromRow(elm, remote){
    var no=String((M && M.memberNo)?(M.memberNo(elm)||''):'');
    if(!no) return null;
    var t=quickRowText(elm, remote);
    var m=t.match(/(\d{1,2})\s*歳\s*\/\s*(男性|女性)\s*\/\s*([^\/]+?)\s*\/\s*([\s\S]*?)\s*\/?\s*(在職中|離職中)/);
    var age=parseInt(m?m[1]:((t.match(/(\d{1,2})\s*歳/)||[])[1]),10);
    if(isNaN(age)) return null;
    var addr=(m?m[3]:((t.match(PREF_RE)||[])[1]||'')).trim();
    var inc=t.match(/年収\s*(\d+)\s*[～〜~]\s*(\d+)\s*万円/)||t.match(/年収\s*(\d+)\s*万円/);
    var c1=elm.querySelector('td.count'), c2=elm.querySelector('td.countAll');
    var mm=t.match(/(在職中|離職中)\s*(\d{2}\/\d{2}\/\d{2}|---)\s+(\d+)\s+(\d+)/);
    var cur=c1?parseInt(c1.textContent,10):(mm?parseInt(mm[3],10):NaN);
    var all=c2?parseInt(c2.textContent,10):(mm?parseInt(mm[4],10):NaN);
    return { id:no, sex:m?m[2]:((t.match(/(男性|女性)/)||[])[1]||''), age:age, addr:addr,
      jyo:m?(m[5]==='在職中'?'在職':'離職'):(/在職/.test(t)?'在職':'離職'),
      inc:inc?parseInt(inc[1],10):null,
      gaku:m?String(m[4]).replace(/年収[\s\S]*$/,'').trim():'',
      job:'', wish:'', wishJob:'', lang:'', tn:'', login:'-',
      pref:prefOf(addr),
      sentLabel:isNaN(cur)?'':(cur<=0?'未送信':(cur>=4?'4回以上':cur+'回')),
      sendUrl:(function(){ var a=(typeof sendLink==='function')?sendLink(elm):null; return a?(a.getAttribute('href')||''):''; })(),
      cur:isNaN(cur)?-1:cur, all:isNaN(all)?-1:all,
      last:(mm&&/\d/.test(mm[2]))?mm[2]:(((t.match(/(?:在職中|離職中)[\s\S]*?(\d{2}\/\d{2}\/\d{2})/)||[])[1])||''),
      raw:t.slice(0,3000), PK:'', from:[''], pg:1, fromList:true };
  }
  /* scope: 'page'＝いま開いているページだけ／'all'＝pagenum を進めて全ページ */
  async function scanListRows(scope, log){
    var out=[], seen={};
    function add(elm, remote, pg){ var r=findFromRow(elm, remote); if(!r || seen[r.id]) return false; seen[r.id]=1; r.pg=pg; out.push(r); return true; }
    var rng=(scope && typeof scope==='object')?scope:null;
    var live=(M && M.rows)?M.rows():[];
    if(!rng){ live.forEach(function(e){ add(e,false,currentPageNo()); }); if(scope!=='all') return out; }
    var size=live.length||50, base=new URLSearchParams(location.search), cur=parseInt(base.get('pagenum')||'0',10)||0, p;
    try{
      var b0=new URLSearchParams(location.search); b0.set('pagenum','0');
      var d0=new DOMParser().parseFromString(await fFetch(location.pathname+'?'+b0.toString()),'text/html');
      var t0=d0.querySelector('table.scoutList'); var n0=t0?t0.querySelectorAll('tbody tr').length:0;
      if(n0) size=n0;
    }catch(e0){}
    for(p=(rng?rng.from-1:0); p<(rng?rng.to:200); p++){
      var off=p*size;
      if(off===cur){ if(rng) live.forEach(function(e){ add(e,false,p+1); }); continue; }
      base.set('pagenum', String(off));
      var html;
      try{ html=await fFetch(location.pathname+'?'+base.toString()); }catch(e){ log((p+1)+'ページ目の取得に失敗したため、ここで止めました（'+out.length+'名）'); break; }
      var doc=new DOMParser().parseFromString(html,'text/html');
      var t=doc.querySelector('table.scoutList');
      var rows=t?Array.prototype.slice.call(t.querySelectorAll('tbody tr')):[];
      if(!rows.length) break;
      var fresh=0;
      rows.forEach(function(e){ if(add(e,true,p+1)) fresh++; });
      log('取り込み中… '+(p+1)+'ページ目まで／ '+out.length+'名');
      if(!fresh) break;
      await fSleep(400);
    }
    return out;
  }

  /* 取り込んだデータから、実際に含まれる値だけを件数付きで数える */
  function buildFacets(rows){
    function cnt(fn){ var m={}; rows.forEach(function(r){ var k=fn(r); if(k==null||k==='') return; m[k]=(m[k]||0)+1; }); return m; }
    return {
      pref:  cnt(function(r){ return r.pref; }),
      group: cnt(function(r){ return r.group; }),
      jyo:   cnt(function(r){ return r.jyo; }),
      sent:  cnt(function(r){ return r.sentLabel; })
    };
  }
  function facetPass(r){
    var ks=['pref','group','jyo','sent'];
    for(var i=0;i<ks.length;i++){
      var sel=FIND_FACET[ks[i]], on=Object.keys(sel);
      if(!on.length) continue;
      var v = ks[i]==='pref'?r.pref : ks[i]==='group'?r.group : ks[i]==='jyo'?r.jyo : r.sentLabel;
      if(!sel[v]) return false;
    }
    return true;
  }

  /* 外国籍の判定にあてはまるか。断定はできないため、あくまで要確認の扱い */
  function foreignHit(r, forMode){
    if(forMode===FOR_MODES[1]) return r.hintKind==='foreign';
    if(forMode===FOR_MODES[2]) return r.hintKind==='foreign' || r.hintKind==='lang';
    if(forMode===FOR_MODES[3]) return !!r.hint;
    return false;
  }

  /* ===== エン転職側の検索条件を書き換える（年齢・性別のみ） ===== */
  var DT_LABEL={'1':'WEB履歴書の更新日','2':'会員登録日','3':'最終ログイン日'};
  function condForm(){
    var fs=qsa('form');
    for(var i=0;i<fs.length;i++){ if(fs[i].querySelector('[name="AgeLow"]')) return fs[i]; }
    return null;
  }
  function setField(form, name, val){
    var els=qsa('[name="'+name+'"]', form);
    if(!els.length) return false;
    var e0=els[0];
    if(e0.tagName==='SELECT' || (e0.tagName==='INPUT' && e0.type!=='radio' && e0.type!=='checkbox')){
      e0.value=String(val);
      try{ e0.dispatchEvent(new Event('change',{bubbles:true})); }catch(x){}
      return String(e0.value)===String(val);
    }
    var hit=false;
    els.forEach(function(e){
      if(e.type!=='radio') return;
      if(String(e.value)===String(val)){ e.checked=true; hit=true; try{ e.dispatchEvent(new Event('change',{bubbles:true})); }catch(x){} }
    });
    return hit;
  }

  /* ===== 管理画面そのものへの反映（条件外を非表示） ===== */
  var SCREEN_KEY='enFindScreen_v1';
  function loadScreen(){ try{ return JSON.parse(localStorage.getItem(SCREEN_KEY)||'null'); }catch(e){ return null; } }
  function saveScreen(o){ try{ if(o) localStorage.setItem(SCREEN_KEY, JSON.stringify(o)); else localStorage.removeItem(SCREEN_KEY); }catch(e){} }
  /* v5.9: 件数の見せ方をマイナビ転職に寄せる。
     「検索結果全体 ◯名 → 条件に合う ◯名 → このページ ◯/◯名を表示」を
     左下のバッジと、候補者一覧の直上の帯の2か所に同じ文言で出す。
     ページを移動しても localStorage の保存値から同じ帯を出し直す。 */
  var SCREEN_STAT=null;
  function fmtN(n){ return (n==null?0:n).toLocaleString(); }
  function statText(st){
    var t=[];
    if(st.pageOnly){
      return '絞り込み　'+(st.preset?(st.preset+'　'):'')+st.shown+'/'+(st.shown+st.hidden)+'名　'+(st.label||'');
    }
    if(st.total) t.push('検索結果全体 '+fmtN(st.total)+'名');
    t.push('条件に合う '+fmtN(st.matched)+'名'+(st.total?('（'+Math.round(st.matched/st.total*100)+'%）'):''));
    t.push('このページ '+fmtN(st.shown)+' / '+fmtN(st.shown+st.hidden)+'名を表示'+(st.hidden?('（'+fmtN(st.hidden)+'名を非表示）'):''));
    return t.join('　→　');
  }
  function screenBadge(st){
    var id='ensbaScreenBadge', b=document.getElementById(id);
    if(!st){ if(b) b.remove(); return; }
    if(!b){
      b=el('div','position:fixed;bottom:10px;left:10px;z-index:2147483646;background:#0b8a5b;color:#fff;padding:6px 12px;border-radius:16px;font-size:12px;font-family:sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3)');
      b.id=id; document.body.appendChild(b);
    }
    b.innerHTML=(st.pageOnly?'':'絞り込み中　')+statText(st)+' <span id="ensbaScreenOff" style="margin-left:8px;text-decoration:underline;cursor:pointer">解除</span>';
    var x=document.getElementById('ensbaScreenOff');
    if(x) x.onclick=function(){ clearScreen(); };
  }
  function screenBar(st){
    var id='ensbaCountBar', bar=document.getElementById(id);
    if(!st){ if(bar) bar.remove(); return; }
    var rows=(M&&M.rows)?M.rows():[];
    if(!rows.length){ if(bar) bar.remove(); return; }
    if(mode==='folder' || mode==='rescout'){ if(bar) bar.remove(); return; }   /* v7.3: 検討人材リスト・送信済みリストでは帯を出さない */
    var first=rows[0];
    if(first && first.closest){ var tb0=first.closest('table'); if(tb0) first=tb0; }   /* v7.3: 表の中ではなく表の直前に置く */
    if(!first || !first.parentNode) return;
    if(!bar){
      bar=el('div','display:block;width:100%;box-sizing:border-box;white-space:normal;word-break:normal;margin:10px 0;padding:8px 12px;background:#eef7f2;border:1px solid #0b8a5b;border-left:6px solid #0b8a5b;border-radius:4px;font-size:13px;font-family:sans-serif;color:#12463a;line-height:1.8');
      bar.id=id;
    }
    if(bar.nextSibling!==first || bar.parentNode!==first.parentNode){
      try{ first.parentNode.insertBefore(bar, first); }catch(e){ return; }
    }
    var pgTxt='';
    if(st.page){
      pgTxt='　｜　'+st.page+'ページ目';
      if(st.pgMap && st.pgMap[st.page]!=null) pgTxt+='（取り込み時の該当 '+fmtN(st.pgMap[st.page])+'名）';
    }
    if(st.pageOnly){ pgTxt=''; }
    bar.innerHTML=(st.pageOnly?'<b>'+statText(st)+'</b>':'<b>絞り込み中</b>　'+statText(st)+pgTxt)
      +' <span id="ensbaBarOff" style="margin-left:10px;font-size:12px;text-decoration:underline;cursor:pointer;color:#0b6cbf">絞り込みを解除</span>';
    var off=document.getElementById('ensbaBarOff');
    if(off) off.onclick=function(){ clearScreen(); };
  }
  function screenStat(st){ SCREEN_STAT=st||null; screenBadge(st); screenBar(st); }
  /* ページを移動したあと、右パネルの結果表示が空になるのを補う */
  function showSavedSummary(){
    var res=document.getElementById('fdResult');
    if(!res) return;
    if(FIND_RAW && FIND_RAW.length) return;
    var s=loadScreen();
    if(!s || !s.ids || !s.ids.length) return;
    var st=SCREEN_STAT||{};
    res.textContent='別のページで取り込んだ結果を表示中：取り込み '+fmtN(s.raw||s.ids.length)+'名 → 条件に合う '+fmtN(s.matched||s.ids.length)+'名'
      + (st.shown!=null?('　／　このページは '+fmtN(st.shown)+' / '+fmtN(st.shown+st.hidden)+'名だけ表示'):'');
  }
  /* v4.6: エン転職側の検索条件そのものを年齢・性別だけ書き換える。
     検索結果一覧には AgeLow のフォームが無いので、「検索条件の変更」ページへ移動し、
     そこで値を差し替えて実フォーム送信する。ページを移動しても条件が維持される。 */
  var COND_PENDING_KEY='enCondPending_v1';
  var SEX_LABEL={'0':'指定なし','1':'男性','2':'女性'};
  function condChangeLink(){
    var as=qsa('a'), i;
    for(i=0;i<as.length;i++){ if(((as[i].textContent||'')+'').replace(/\s+/g,'')==='検索条件の変更') return as[i]; }
    for(i=0;i<as.length;i++){ if(/search_condition_update\/form/.test(as[i].getAttribute('href')||'')) return as[i]; }
    return null;
  }
  function condFormOnPage(){
    var fs=qsa('form');
    for(var i=0;i<fs.length;i++){ if(fs[i].querySelector('[name="AgeLow"]')) return fs[i]; }
    return null;
  }
  /* 検索条件の変更ページ側。前の画面で predetermined した値を入れて送信する */
  function runCondPending(){
    var raw=null; try{ raw=localStorage.getItem(COND_PENDING_KEY); }catch(e){}
    if(!raw) return false;
    try{ localStorage.removeItem(COND_PENDING_KEY); }catch(e){}
    var d=null; try{ d=JSON.parse(raw); }catch(e){}
    if(!d || (Date.now()-(d.ts||0))>300000) return false;
    var f=condFormOnPage();
    if(!f){ alert('検索条件の変更フォームが見つかりませんでした。お手数ですが手動で年齢・性別を設定してください。'); return false; }
    var dt=f.querySelector('[name="SearchRangeDivisionDateType"]');
    var before=dt?String(dt.value):'';
    var lo=f.querySelector('[name="AgeLow"]'), hi=f.querySelector('[name="AgeHigh"]'), sx=f.querySelector('[name="Sex"]');
    if(lo) lo.value=String(d.lo);
    if(hi) hi.value=String(d.hi);
    if(sx) sx.value=String(d.sex);
    var after=dt?String(dt.value):'';
    if(before!==after){ alert('日付種別が変わってしまうため中止しました。手動でご確認ください。'); return false; }
    var n=document.createElement('div');
    n.style.cssText='position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#0b6cbf;color:#fff;padding:10px;font-size:14px;font-weight:bold;text-align:center';
    n.textContent='エン転職の検索条件を反映しています…（性別 '+(SEX_LABEL[String(d.sex)]||'指定なし')
      +' ／ 年齢 '+(String(d.lo)==='0'?'指定なし':d.lo)+'〜'+(String(d.hi)==='0'?'指定なし':d.hi)+'）';
    document.body.appendChild(n);
    setTimeout(function(){ f.submit(); }, 500);
    return true;
  }

  /* v4.4: 検索結果以外の画面（検討人材リスト・送信済リスト）でも、
     いま表示されている一覧そのものに年齢・性別の絞り込みをかける。 */
  var SCREEN_COND=false;
  function screenCondFilter(sex, lo, hi){
    var rows=(M && M.rows)?M.rows():[];
    var shown=0, hidden=0;
    rows.forEach(function(row){
      var t=((row.innerText||row.textContent||'')+'').replace(/\s+/g,' ');
      var am=t.match(/(\d{1,2})\s*歳/);
      var age=am?parseInt(am[1],10):NaN;
      var sx=(t.match(/(男性|女性)/)||[])[1]||'';
      var ok=true;
      if(sex && sex!=='指定なし' && sx && sx!==sex) ok=false;
      if(!isNaN(age) && (age<lo || age>hi)) ok=false;
      if(ok){ row.style.display=''; shown++; return; }
      row.style.display='none'; hidden++;
      var c=(M && M.nativeCb)?M.nativeCb(row):null;
      if(c && c.checked && !c.disabled) c.click();
    });
    SCREEN_COND=(hidden>0);
    return {total:rows.length, shown:shown, hidden:hidden};
  }
  function screenCondClear(){
    var rows=(M && M.rows)?M.rows():[];
    rows.forEach(function(row){ row.style.display=''; });
    SCREEN_COND=false;
    try{ localStorage.setItem('enScoutAllCondScr','0'); }catch(e){}
    screenStat(null);
    var rs0=document.getElementById('sbResult'); if(rs0) rs0.textContent='';
    return rows.length;
  }

  function applyScreen(ids, meta){
    if(!M || mode!=='search') return {shown:0, hidden:0};
    var set={}; (ids||[]).forEach(function(i){ set[i]=1; });
    var shown=0, hidden=0;
    getRows().forEach(function(row){
      var no=M.memberNo(row);
      if(set[no]){ row.style.display=''; shown++; return; }
      row.style.display='none'; hidden++;
      var c=M.nativeCb(row);
      if(c && c.checked && !c.disabled) c.click();
      if(no && extraSel[no]) delete extraSel[no];
    });
    updateCount();
    var m=meta||{};
    var st={ total:m.total||0, raw:m.raw||0, pgMap:m.pgMap||null,
             matched:(m.matched!=null?m.matched:(ids||[]).length),
             shown:shown, hidden:hidden, page:currentPageNo() };
    screenStat((shown+hidden)?st:null);
    return {shown:shown, hidden:hidden};
  }
  function clearScreen(){
    if(M && mode==='search') getRows().forEach(function(row){ row.style.display=''; });
    saveScreen(null); screenStat(null); updateCount();
    try{ screenCondClear(); }catch(e){}
  }
  /* ページを移動したあと、保存しておいた絞り込み結果を自動でかけ直す */
  function restoreScreen(){
    if(mode!=='search') return;
    var s=loadScreen();
    if(!s || !s.ids || !s.ids.length) return;
    if(s.ts && (Date.now()-s.ts) > 6*60*60*1000){ saveScreen(null); return; }
    var q=new URLSearchParams(location.search);
    var w=q.get('WorkID')||'';
    if(s.workId && w && s.workId!==w){ return; }
    applyScreen(s.ids, {total:s.total||0, matched:s.matched||s.ids.length, raw:s.raw||0, pgMap:s.pgMap||null});
    setTimeout(showSavedSummary, 800);
  }
  API.restoreScreen=restoreScreen;


  /* ===== v4.8: 「この画面を絞り込む」タブ =====
     いま開いているページの候補者だけを対象に、年齢・性別で絞り込み、
     外国籍の可能性を判定して一覧に出す。一覧のチェックはページ標準の
     チェックボックスに直結しているので、そのまま一括送信タブへ進める。 */
  var QUICK=[], quickLogEl=null, quickHidden=false, QUICK_DEEP=0;
  function qLog(m, color){ if(quickLogEl){ quickLogEl.textContent=m; quickLogEl.style.color=color||'#0b6cbf'; } }
  /* v6.1: 取り込んだ別ページの行（remote=true）は画面上に無いのでチェックはできない。一覧・絞り込み・コピーだけ使える */
  function quickRowText(elm, remote){
    if(!remote) return ((elm.innerText||elm.textContent||'')+'').replace(/\s+/g,' ');
    var cells=elm.querySelectorAll?elm.querySelectorAll('td'):[];
    if(!cells.length) return ((elm.textContent||'')+'').replace(/\s+/g,' ');
    return Array.prototype.map.call(cells,function(c){ return ((c.textContent||'')+'').replace(/\s+/g,' ').trim(); }).join(' ');
  }
  function quickMake(elm, byId, remote){
      var no=(M && M.memberNo)?String(M.memberNo(elm)||''):'';
      var t=quickRowText(elm, remote);
      var b=byId[no]||{};
      /* 表形式の一覧は「27歳 / 男性 / 東京都 / 学校名 年収… / 在職中」の並び */
      var row1=t.match(/(\d{1,2})\s*歳\s*\/\s*(男性|女性)\s*\/\s*([^\/]+?)\s*\/\s*([\s\S]*?)\s*\/?\s*(在職中|離職中)/);
      var age=(b.age!=null)?b.age:parseInt(row1?row1[1]:((t.match(/(\d{1,2})\s*歳/)||[])[1]),10);
      var gaku=b.gaku||(row1?String(row1[4]).replace(/年収[\s\S]*$/,'').trim():'');
      var r={ el:elm, remote:!!remote, id:no, text:((b.raw||'')+' '+t+' '+((elm.textContent||'')+'').replace(/\s+/g,' ')),
        age:(isNaN(age)?null:age),
        sex:b.sex||(row1?row1[2]:((t.match(/(男性|女性)/)||[])[1]||''))||'',
        addr:b.addr||(row1?row1[3]:((t.match(PREF_RE)||[])[1]||''))||'',
        jyo:b.jyo||(row1?(row1[5]==='在職中'?'在職':'離職'):(/在職/.test(t)?'在職':(/離職/.test(t)?'離職':''))),
        gaku:gaku, lang:b.lang||'' };
      /* v6.0: スカウト回数（検討人材リスト・送信済リストの td.count / td.countAll）。無い画面は -1 */
      (function(){
        var c1=elm.querySelector&&elm.querySelector('td.count'), c2=elm.querySelector&&elm.querySelector('td.countAll');
        var m=t.match(/(在職中|離職中)\s*(\d{2}\/\d{2}\/\d{2}|---)\s+(\d+)\s+(\d+)/);
        var a=c1?parseInt(c1.innerText,10):(m?parseInt(m[3],10):NaN), b2=c2?parseInt(c2.innerText,10):(m?parseInt(m[4],10):NaN);
        r.cur=isNaN(a)?-1:a; r.all=isNaN(b2)?-1:b2;
      })();
      var hint=foreignHint(r.gaku), kind=hint?'foreign':'';
      if(!hint && r.lang && !/^-+$/.test(r.lang)){ hint='その他言語 '+String(r.lang).slice(0,10); kind='lang'; }
      if(!hint && (!r.gaku || /^-+$/.test(r.gaku))){ hint='学歴の記載なし'; kind='unknown'; }
      /* 本文に外国籍を思わせる語があれば拾う（学歴欄に出ない場合の保険） */
      if(!hint){
        var h2=foreignHint(r.text.slice(0,4000));
        if(h2 && h2!=='学校名が英字表記'){ hint=h2; kind='foreign'; }
      }
      r.hint=hint; r.hintKind=kind;
      return r;
  }
  function quickScan(){
    var list=(M && M.rows)?M.rows():[];
    var byId={}, deep=0;
    try{ parseListHtml(document.documentElement.outerHTML).forEach(function(r){ byId[r.id]=r; deep++; }); }catch(e){}
    QUICK_DEEP=deep;
    QUICK=list.map(function(elm){ return quickMake(elm, byId, false); });
    return QUICK.length;
  }
  /* 全ページ取り込み。pagenum をオフセットとして進め、行が無い／既出だけのページで止める */
  async function quickScanAll(log){
    var live=quickScan(), seen={}, size=live||50, p, added=0;
    /* 最終ページなど端数のページから始めても1ページの件数を取り違えないよう、先頭ページの件数を基準にする */
    try{
      var b0=new URLSearchParams(location.search); b0.set('pagenum','0');
      var d0=new DOMParser().parseFromString(await fFetch(location.pathname+'?'+b0.toString()),'text/html');
      var t0=d0.querySelector('table.scoutList');
      var n0=t0?t0.querySelectorAll('tbody tr').length:0;
      if(n0) size=n0;
    }catch(e0){}
    QUICK.forEach(function(r){ if(r.id) seen[r.id]=1; });
    var base=new URLSearchParams(location.search);
    var cur=parseInt(base.get('pagenum')||'0',10)||0;
    var pages=[];
    for(p=0;p<200;p++){
      var off=p*size;
      if(off===cur) continue;
      base.set('pagenum', String(off));
      var html;
      try{ html=await fFetch(location.pathname+'?'+base.toString()); }catch(e){ log('取得に失敗したため '+(p+1)+'ページ目で止めました'); break; }
      var doc=new DOMParser().parseFromString(html,'text/html');
      var t=doc.querySelector('table.scoutList');
      var rows=t?Array.prototype.slice.call(t.querySelectorAll('tbody tr')):[];
      if(!rows.length) break;
      var byId={}; try{ parseListHtml(html).forEach(function(r){ byId[r.id]=r; }); }catch(e2){}
      var fresh=0;
      rows.forEach(function(elm){
        var no=String(M.memberNo(elm)||'');
        if(no && seen[no]) return;
        if(no) seen[no]=1; fresh++;
        QUICK.push(quickMake(elm, byId, true));
      });
      added+=fresh;
      log('取り込み中… '+(p+1)+'ページ目まで／ '+QUICK.length+'名');
      if(!fresh) break;
      await fSleep(300);
    }
    return QUICK.length;
  }
  function quickCb(r){ try{ return (M && M.nativeCb)?M.nativeCb(r.el):null; }catch(e){ return null; } }
  function quickIsChecked(r){
    if(r.remote) return false;
    var c=quickCb(r);
    if(c && !c.disabled) return !!c.checked;
    return !!(r.id && extraSel[r.id]);
  }
  function quickSetCheck(r, on){
    if(r.remote) return false;
    var c=quickCb(r);
    if(c && !c.disabled){ if(!!c.checked !== !!on) c.click(); return true; }
    if(!r.id) return false;
    if(on) extraSel[r.id]=true; else delete extraSel[r.id];
    return true;
  }
  /* v5.4: 画面に実際に入っているチェックの数。パネルの表示と突き合わせる */
  function quickPageChecked(){
    var list=(M && M.rows)?M.rows():[], n=0;
    list.forEach(function(row){
      var c=null;
      try{ c=M.nativeCb?M.nativeCb(row):null; }catch(e){}
      if(c && !c.disabled){ if(c.checked) n++; return; }
      var k='';
      try{ k=M.memberNo?M.memberNo(row):''; }catch(e2){}
      if(k && extraSel[k]) n++;
    });
    return n;
  }
  function quickClearAll(){
    var list=(M && M.rows)?M.rows():[];
    list.forEach(function(row){
      var c=null;
      try{ c=M.nativeCb?M.nativeCb(row):null; }catch(e){}
      if(c && !c.disabled){ if(c.checked) c.click(); return; }
      var k='';
      try{ k=M.memberNo?M.memberNo(row):''; }catch(e2){}
      if(k) delete extraSel[k];
    });
  }
  function quickJump(r){
    if(r.remote) return;
    if(r.el.style.display==='none') r.el.style.display='';
    try{ r.el.scrollIntoView({behavior:'smooth', block:'center'}); }catch(e){ r.el.scrollIntoView(); }
    var o=r.el.style.outline, f=r.el.style.outlineOffset;
    r.el.style.outline='4px solid #e8500e'; r.el.style.outlineOffset='2px';
    setTimeout(function(){ r.el.style.outline=o||''; r.el.style.outlineOffset=f||''; }, 4000);
  }

  function buildQuickTab(){
    var wrap=document.createElement('div');
    wrap.id='ensbaQuickTab';
    wrap.style.display='none';
    wrap.innerHTML=
      '<div style="padding:9px;background:#fff7ec;border:1px solid #f0d3a8;border-radius:5px;margin-bottom:9px">'

      + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
      + '<b style="font-size:11px">性別</b> <select id="qkSex" style="padding:3px"><option>指定なし</option><option>男性</option><option>女性</option></select>'
      + ' <b style="font-size:11px">年齢</b> <input type="number" id="qkLo" value="20" style="width:50px;padding:3px">〜<input type="number" id="qkHi" value="29" style="width:50px;padding:3px">'
      + ' <button id="qkEn" style="padding:6px 14px;background:#e8500e;color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer;display:none">サイト全体へ反映</button>'
      + '<label style="font-size:11px;margin-left:auto;cursor:pointer"><input type="checkbox" id="qkFor" checked> 外国籍の可能性を判定</label>'
      + '</div>'

      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">'
      + '<div style="flex:2;min-width:200px;font-size:11px"><b>含むキーワード</b>'
      + '<input type="text" id="qkKw" placeholder="茨城　営業|施工管理" style="width:100%;padding:4px;margin-top:3px"></div>'
      + '<div style="flex:1;min-width:150px;font-size:11px"><b>除外ワード</b>'
      + '<input type="text" id="qkNg" placeholder="卒業見込み 在学中" style="width:100%;padding:4px;margin-top:3px"></div>'
      + '</div>'

      + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px;font-size:11px">'
      + '<b>居住地</b> <input type="text" id="qkPref" placeholder="茨城 栃木" style="width:110px;padding:3px">'
      + ' <b>スカウト回数</b> <select id="qkCntB" style="padding:3px"><option value="cur">当該募集</option><option value="all">全募集</option></select>'
      + ' <select id="qkCnt" style="padding:3px"><option value="">すべて</option><option value="0">0回（未送信）</option><option value="1">1回（2回目の対象）</option><option value="2">2回（3回目の対象）</option><option value="3">3回以上</option></select>'
      + '</div>'

      + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px">'
      + ((mode==='folder'||mode==='rescout')?'<select id="qkScope" style="padding:5px"><option value="page">このページだけ</option><option value="all">全ページを取り込む</option></select>':'')
      + '<button id="qkRun" style="padding:6px 16px;background:#0b6cbf;color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer">取り込んで絞り込み</button>'
      + '<button id="qkCopy" style="padding:6px 12px;cursor:pointer">表示中の一覧をコピー</button>'
      + '<span id="qkCount" style="font-size:14px;font-weight:bold;color:#0b6cbf"></span>'
      + '</div>'

      + '<div id="qkLog" style="margin-top:7px;font-size:11px;color:#7a5c00;min-height:15px;line-height:1.6"></div>'
      + '<div style="font-size:10px;color:#8a7a55;margin-top:5px;line-height:1.7">オレンジの「サイト全体へ反映」は、エン転職の検索条件そのものを年齢・性別で書き換えます。ページをめくっても条件が続き、母集団の件数自体が減ります。日付種別など他の条件は触りません。<br>青の「このページで絞り込み」は、いま開いているページの中だけを絞り込みます。キーワードはエン転職側に対応する検索条件が無いため、ページ内だけの扱いです。<br>キーワードが見るのは一覧に書かれている文字だけです。検討人材リストのように一覧に学歴の詳細が出ない画面では、卒業見込みなどのワードは拾えません。</div>'
      + '</div>'

      + '<div style="display:grid;grid-template-columns:24px 30px 1fr 34px 34px 40px 1.1fr;background:#ecf0f1;padding:4px 6px;font-weight:bold;color:#556;font-size:10px">'
      + '<span></span><span>#</span><span>会員No／居住地</span><span>年齢</span><span>性別</span><span>在職</span><span>判定</span></div>'
      + '<div id="qkBody" style="max-height:430px;overflow:auto;border:1px solid #eee"><div style="padding:16px;color:#999;text-align:center;font-size:11px">「取り込んで絞り込み」を押してください</div></div>'

      + '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px">'
      + '<button id="qkCheck" style="padding:5px 12px;background:#0b8a5b;color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer">表示中の全員にチェック</button>'
      + '<span style="font-size:11px;color:#555">上から <input type="number" id="qkTopN" value="30" style="width:50px;padding:3px"> 件</span>'
      + '<button id="qkTop" style="padding:5px 12px;cursor:pointer;border:1px solid #0b8a5b;background:#fff;color:#0b8a5b;border-radius:4px">この件数だけチェック</button>'
      + '<button id="qkUncheck" style="padding:5px 12px;cursor:pointer">チェックを外す</button>'
      + '<span id="qkSel" style="font-weight:bold;color:#333;margin-left:auto">チェック 0名</span></div>'
      + '<div style="font-size:10px;color:#8a94a0;margin-top:4px;line-height:1.6">「表示中の全員」「上から◯件」は、押すたびにこの画面のチェックを一度すべて外してから入れ直します。押すほど増えることはありません。行をクリックでチェック。外国籍の可能性がある人には自動でチェックを入れません。オレンジの「要確認」を押すと、その人のところまで画面がスクロールします。</div>';

    quickLogEl=wrap.querySelector('#qkLog');
    function qq(id){ return wrap.querySelector(id); }
    function words(v){ return String(v||'').split(/[\s,、|]+/).filter(Boolean); }
    function cond(){
      var lo=parseInt(qq('#qkLo').value,10); if(isNaN(lo)) lo=0;
      var hi=parseInt(qq('#qkHi').value,10); if(isNaN(hi)) hi=99;
      return {sex:qq('#qkSex').value, lo:lo, hi:hi, useFor:qq('#qkFor').checked,
              kw:words(qq('#qkKw').value), ng:words(qq('#qkNg').value),
              pref:words(qq('#qkPref').value), cntB:qq('#qkCntB').value, cnt:qq('#qkCnt').value};
    }
    function selCountQ(){
      var n=0;
      QUICK.forEach(function(r){ if(quickIsChecked(r)) n++; });
      var pg=quickPageChecked();
      var e=qq('#qkSel');
      if(e){
        e.textContent='チェック '+n+'名（画面 '+pg+'名）';
        e.style.color=(n===pg)?'#333':'#c0392b';
      }
      try{ updateCount(); }catch(e2){}
    }
    var VIEW=[];
    function renderQuick(){
      var c=cond(), body=qq('#qkBody');
      if(!QUICK.length){ body.innerHTML='<div style="padding:16px;color:#999;text-align:center;font-size:11px">この画面に一覧が見つかりませんでした</div>'; return; }
      var cutAge=0, cutSex=0, cutKw=0, cutNg=0, cutPref=0, cutCnt=0, tally=[0,0,0,0], hasCnt=QUICK.some(function(r){ return r[c.cntB]>=0; });
      VIEW=QUICK.filter(function(r){
        var t=r.text||'';
        if(c.sex!=='指定なし' && r.sex && r.sex!==c.sex){ cutSex++; return false; }
        if(r.age!=null && (r.age<c.lo || r.age>c.hi)){ cutAge++; return false; }
        if(c.kw.length && !c.kw.some(function(k){ return t.indexOf(k)>-1; })){ cutKw++; return false; }
        if(c.ng.length && c.ng.some(function(k){ return t.indexOf(k)>-1; })){ cutNg++; return false; }
        if(c.pref.length && !c.pref.some(function(k){ return String(r.addr||'').indexOf(k)>-1; })){ cutPref++; return false; }
        var n=r[c.cntB];
        if(n>=0) tally[n>=3?3:n]++;
        if(c.cnt!=='' && hasCnt && n>=0 && (c.cnt==='3'?n<3:n!==+c.cnt)){ cutCnt++; return false; }
        return true;
      });
      VIEW.forEach(function(r){ r.flag=(c.useFor && !!r.hint); });
      body.innerHTML = VIEW.map(function(r, i){
        var on=quickIsChecked(r);
        var bg=r.flag?'#fff3ea':(i%2?'#fafbfc':'#fff');
        return '<div class="qkRow" data-i="'+i+'" style="display:grid;grid-template-columns:24px 30px 1fr 34px 34px 40px 1.1fr;padding:4px 6px;border-bottom:1px solid #eee;align-items:center;font-size:11px;cursor:pointer;background:'+bg+(on?';box-shadow:inset 3px 0 0 #0b6cbf':'')+'">'
          +'<span><input type="checkbox" class="qkCk"'+(on?' checked':'')+'></span>'
          +'<span style="color:#aaa">'+(i+1)+'</span>'
          +'<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(r.id||'-')+'　'+(r.addr||'')+(r.cur>=0?'　<span style="color:'+(r.cur===0?'#888':r.cur===1?'#2e86de':r.cur===2?'#e8500e':'#c0392b')+';font-weight:bold">'+(r.cur===0?'未送信':r.cur+'回送信済')+(r.all>r.cur?'（全'+r.all+'）':'')+'</span>':'')+'</span>'
          +'<span style="text-align:center">'+(r.age==null?'-':r.age)+'</span>'
          +'<span style="text-align:center">'+(r.sex||'-')+'</span>'
          +'<span style="text-align:center;color:'+(r.jyo==='在職'?'#27ae60':'#c0392b')+'">'+(r.jyo||'-')+'</span>'
          +'<span>'+(r.flag?'<span class="qkJump" data-i="'+i+'" title="クリックでこの人の位置へスクロール" style="padding:1px 6px;border-radius:8px;background:#e8500e;color:#fff;font-size:9px;cursor:pointer">要確認: '+r.hint+' ▶</span>':'<span style="color:#bbb;font-size:10px">—</span>')+'</span>'
          +'</div>';
      }).join('') || '<div style="padding:16px;color:#999;text-align:center;font-size:11px">条件に合う人がいません</div>';

      var QLAST=-1;
      qsa('.qkRow', body).forEach(function(d){
        var r=VIEW[+d.dataset.i];
        d.onclick=function(ev){
          if(ev.target && ev.target.classList && ev.target.classList.contains('qkJump')) return;
          if(ev.shiftKey && QLAST>=0){
            /* v7.8 クリックした行の「新しい状態」に範囲を揃える（チェック済みの行をShift+クリックすると範囲を外す） */
            var qi=+d.dataset.i, lo=Math.min(QLAST,qi), hi=Math.max(QLAST,qi), c2=0, nextQ=!quickIsChecked(VIEW[qi]);
            for(var k=lo;k<=hi;k++){ if(VIEW[k] && quickSetCheck(VIEW[k], nextQ)) c2++; }
            qsa('.qkRow', body).forEach(function(e){ var rr=VIEW[+e.dataset.i]; if(!rr) return; var on=quickIsChecked(rr); var bx=e.querySelector('.qkCk'); if(bx) bx.checked=on; e.style.boxShadow=on?'inset 3px 0 0 #0b6cbf':'none'; });
            QLAST=qi; selCountQ(); qLog((lo+1)+'〜'+(hi+1)+'番目のうち '+c2+'名を'+(nextQ?'チェックしました':'外しました')); return;
          }
          QLAST=+d.dataset.i;
          var next=!quickIsChecked(r);
          if(!quickSetCheck(r, next)){ qLog('この行はチェックできません（別ページから取り込んだ人、または会員Noが読み取れません）'); return; }
          var box=d.querySelector('.qkCk'); if(box) box.checked=next;
          d.style.boxShadow=next?'inset 3px 0 0 #0b6cbf':'none';
          selCountQ();
        };
      });
      qsa('.qkJump', body).forEach(function(b){
        b.onclick=function(ev){ ev.stopPropagation(); quickJump(VIEW[+b.dataset.i]); };
      });

      var nFlag=VIEW.filter(function(r){ return r.flag; }).length;
      qq('#qkCount').textContent=VIEW.length+' / '+QUICK.length+'名'
        + (nFlag?('　うち要確認 '+nFlag+'名はチェックしません（差引 '+(VIEW.length-nFlag)+'名）'):'');
      var msg=[];
      if(cutAge) msg.push('年齢で除外 '+cutAge+'名');
      if(cutSex) msg.push('性別で除外 '+cutSex+'名');
      if(cutKw)  msg.push('キーワードに当たらず除外 '+cutKw+'名');
      msg.push('除外ワードで除外 '+cutNg+'名');
      if(cutPref) msg.push('居住地で除外 '+cutPref+'名');
      if(cutCnt)  msg.push('スカウト回数で除外 '+cutCnt+'名');
      if(hasCnt)  msg.push('（'+(c.cntB==='all'?'全募集':'当該募集')+'の内訳 0回:'+tally[0]+' 1回:'+tally[1]+' 2回:'+tally[2]+' 3回以上:'+tally[3]+'）');
      else if(c.cnt!=='') msg.push('※この画面にはスカウト回数の列が無いため回数では絞れません');
      if(!QUICK_DEEP) msg.push('※この画面は学歴・語学の詳細が読めないため、外国籍の判定は学校名だけになります');
      qLog(msg.join('　／　'));
      selCountQ();
    }

    (function(){
      var enBtn=qq('#qkEn');
      if(condChangeLink()) enBtn.style.display='';
      enBtn.onclick=function(){
        var a=condChangeLink();
        if(!a){ qLog('この画面には「検索条件の変更」がないため、エン転職側の条件は変えられません'); return; }
        var c=cond();
        var sv={'指定なし':'0','男性':'1','女性':'2'}[c.sex]||'0';
        var lo=(c.lo>0)?c.lo:0;
        var hi=(c.hi>0 && c.hi<99)?c.hi:0;
        if(!confirm('エン転職の検索条件そのものを次の内容に変更します。\n\n性別：'+c.sex
          +'\n年齢：'+(lo?lo+'歳':'指定なし')+' 〜 '+(hi?hi+'歳':'指定なし')
          +'\n\n検索条件の変更画面を経由して自動で送信します。日付種別など他の条件は変更しません。\nページをめくっても条件は続きます。よろしいですか？')) return;
        try{ localStorage.setItem(COND_PENDING_KEY, JSON.stringify({sex:sv, lo:String(lo), hi:String(hi), ts:Date.now()})); }catch(e){}
        qLog('検索条件の変更画面へ移動しています…');
        location.href=a.href;
      };
    })();

    qq('#qkRun').onclick=async function(){
      var sc=qq('#qkScope'), btn=qq('#qkRun'), n;
      if(sc && sc.value==='all'){
        btn.disabled=true;
        try{ n=await quickScanAll(qLog); }catch(e){ qLog('全ページの取り込みに失敗しました：'+e); n=QUICK.length; }
        btn.disabled=false;
        if(!n){ qLog('この画面に一覧が見つかりませんでした'); return; }
        renderQuick();
        qLog('全ページを取り込みました（'+n+'名）。他のページの人は一覧と一覧コピーだけ使えます（チェックはこのページの人のみ）');
        return;
      }
      n=quickScan();
      if(!n){ qLog('この画面に一覧が見つかりませんでした'); return; }
      renderQuick();
    };
    qq('#qkCopy').onclick=function(){
      if(!VIEW.length){ qLog('先に「取り込んで絞り込み」を押してください'); return; }
      var txt=['会員No\t年齢\t性別\t居住地\t当該募集回数\t全募集回数'].concat(VIEW.map(function(r){ return [r.id,r.age==null?'':r.age,r.sex,r.addr,r.cur>=0?r.cur:'',r.all>=0?r.all:''].join('\t'); })).join('\n');
      var ok=function(){ qLog('表示中の '+VIEW.length+'名をコピーしました（表形式）'); };
      if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok,function(){ qLog('コピーできませんでした'); }); else qLog('この環境ではコピーできません');
    };
    qq('#qkCheck').onclick=function(){
      if(!VIEW.length){ qLog('先に「取り込んで絞り込み」を押してください'); return; }
      quickClearAll();            /* v5.4: 前のチェックを持ち越さない */
      var n=0, skip=0, ng=0;
      VIEW.forEach(function(r){
        if(r.flag){ skip++; return; }
        if(quickSetCheck(r, true)) n++; else ng++;
      });
      var total=VIEW.length, pg=quickPageChecked();
      renderQuick();
      qLog('表示 '+total+'名のうち '+n+'名にチェックしました（画面のチェックも '+pg+'名）'
        +(skip?('　／　要確認の '+skip+'名は外しています'):'')
        +(ng?('　／　チェックできない行 '+ng+'件'):''));
    };
    qq('#qkTop').onclick=function(){
      if(!VIEW.length){ qLog('先に「取り込んで絞り込み」を押してください'); return; }
      var want=parseInt(qq('#qkTopN').value,10); if(isNaN(want)||want<1) want=30;
      quickClearAll();            /* v5.4: 先に全部外すので、押すたびに増えることがない */
      var n=0, skip=0;
      for(var i=0;i<VIEW.length && n<want;i++){
        var r=VIEW[i];
        if(r.flag){ skip++; continue; }
        if(quickSetCheck(r, true)) n++;
      }
      var pg=quickPageChecked();
      renderQuick();
      qLog('上から '+n+'名にチェックしました（画面のチェックも '+pg+'名）'
        +(skip?('　／　途中の要確認 '+skip+'名は飛ばしています'):'')
        +(n<want?('　／　条件に合う人が '+n+'名しかいませんでした'):''));
    };
    qq('#qkUncheck').onclick=function(){
      quickClearAll();
      renderQuick();
      qLog('この画面のチェックをすべて外しました（画面のチェック '+quickPageChecked()+'名）');
    };
    ['#qkLo','#qkHi','#qkKw','#qkNg','#qkPref','#qkTopN'].forEach(function(sel){
      var e=qq(sel);
      e.onkeydown=function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); if(QUICK.length) renderQuick(); else qq('#qkRun').click(); } };
    });
    COND_HOOKS.qk=function(){ if(QUICK.length){ renderQuick(); return true; } return false; };
    ['#qkSex','#qkLo','#qkHi'].forEach(function(sel){
      var e=qq(sel); if(!e) return;
      e.addEventListener('change', function(){ onCondChanged('qk'); });
    });
    qq('#qkCnt').onchange=function(){ if(QUICK.length) renderQuick(); };
    qq('#qkCntB').onchange=function(){ if(QUICK.length) renderQuick(); };
    qq('#qkFor').onchange=function(){ if(QUICK.length) renderQuick(); };
    wrap.__refresh=function(){ if(!QUICK.length) qq('#qkRun').click(); else renderQuick(); };
    return wrap;
  }

  function buildFindTab(){
    var cfg=findCur();
    var wrap=el('div','display:none');
    wrap.id='ensbaFindTab';
    var ps=findPresets();
    function sec(label, inner, css){
      return '<div style="margin-bottom:9px">'
        +'<span style="font-size:10px;color:#8a94a0;letter-spacing:.04em;display:block;margin-bottom:3px">'+label+'</span>'
        +'<div style="padding:8px 10px;border-radius:4px;'+(css||'border:1px solid #e3e7ea')+'">'+inner+'</div></div>';
    }
    wrap.innerHTML =
      /* 性別・年齢の枠は v4.9 で「この画面を絞り込む」タブへ移した。
         readCfg が参照する入力を残すため、中身は作るが表示しない。 */
      '<div id="fdCond" style="display:none"></div>'

      /* v7.0 ① 条件を入れる */
      + sec('① 条件を入れる',
          '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:7px">'
          + '<span style="font-size:11px;color:#556">保存した条件</span>'
          + '<select id="fdPre" style="max-width:200px;padding:3px"><option value="">― 選択 ―</option>'
          + Object.keys(ps).map(function(k){ return '<option>'+k+'</option>'; }).join('')
          + '</select></div>'

          + '<div style="font-size:11px;margin-bottom:6px"><b>勤務地のキーワード（居住地・希望勤務地）</b>'
          + '<input type="text" id="fdPw" value="'+cfg.priorityWish+'" placeholder="茨城 栃木（スペースか | で区切る）" style="width:100%;padding:4px;margin-top:3px">'
          + '<label style="font-size:11px;cursor:pointer;display:block;margin-top:3px"><input type="checkbox" id="fdAreaOn"'+(cfg.areaOnly!==false?' checked':'')+'> 当たる人だけ残す（外すと、当たる人を上に並べるだけにします）</label></div>'

          + '<div style="font-size:11px;margin-bottom:6px"><b>経験・スキルのキーワード</b>'
          + '<input type="text" id="fdKw" value="'+cfg.keywords+'" placeholder="営業 法人営業 ルート" style="width:100%;padding:4px;margin-top:3px">'
          + '<span style="font-size:10px;color:#8a94a0">スペース区切り。どれかに当たれば残ります（経験職種・希望職種を見ます）</span></div>'

          + '<div style="font-size:11px;margin-bottom:6px"><b>除外するキーワード</b><input type="text" id="fdNg" value="'+cfg.ngKeywords+'" placeholder="卒業見込み 在学中" style="width:100%;padding:4px;margin-top:3px"><span style="font-size:10px;color:#8a94a0">プロフィール本文すべてを見ます（学歴欄の卒業見込みも拾います）</span></div>'

          + '<details style="margin-bottom:7px"><summary style="cursor:pointer;font-size:10px;color:#8a94a0">職種グループ・通勤圏の住所でも絞る</summary>'
          + '<div id="fdGroups" style="margin:6px 0;display:flex;flex-wrap:wrap;gap:4px 10px">'
          + Object.keys(JOB_GROUPS).concat(['その他']).map(function(g){ return '<label style="font-size:11px;white-space:nowrap"><input type="checkbox" value="'+g+'"'+(cfg.jobGroups.indexOf(g)>-1?' checked':'')+'>'+g+'</label>'; }).join('')
          + '</div><div style="font-size:11px"><b>通勤圏の住所キーワード</b><input type="text" id="fdCa" value="'+cfg.commuteAddr+'" style="width:100%;padding:3px;margin-top:3px"><span style="font-size:10px;color:#8a94a0">「当たる人だけ残す」のときは、この住所に当たる人も残ります</span></div></details>'

          + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'
          + '<label style="font-size:11px;cursor:pointer"><input type="checkbox" id="fdForOn"'+(((cfg.forMode||FOR_MODES[3])!==FOR_MODES[0])?' checked':'')+'> 外国籍の可能性がある人はチェックを外す</label>'
          + '<span style="font-size:10px;color:#8a94a0">取り込み後は、条件を変えると自動で抽出し直します</span>'
          + '</div>',
          'background:#f7f8f9;border:1px solid #e3e7ea')

      /* v7.0 ② 取り込む範囲を選んで抽出 */
      + sec('② 取り込む範囲を選んで抽出する',
          '<div id="fdCtxBar"></div>'
          + '<div id="fdResult" style="margin-top:8px;font-size:14px;font-weight:bold;color:#0b6cbf;min-height:18px"></div>'
          + '<div id="fdResultSub" style="margin-top:3px;font-size:11px;color:#7a5c00;min-height:15px;line-height:1.6"></div>'
          + '<details style="margin-top:6px"><summary style="cursor:pointer;font-size:10px;color:#8a94a0">複数の条件Noをまとめて取り込む</summary>'
          + '<div style="margin-top:6px;font-size:11px">3000名の上限に当たるときは、検索条件を分けて保存し、その条件Noをカンマ区切りで並べてください。会員Noで名寄せして合算します。<br>'
          + '<b>WorkID</b> <input type="text" id="fdWid" value="'+(cfg.workId||'')+'" style="width:80px;padding:3px">'
          + ' <b>条件No</b> <input type="text" id="fdCno" value="'+(cfg.conditions||'')+'" style="width:120px;padding:3px" placeholder="11,12,13">'
          + ' <button id="fdScan" style="padding:3px 10px;cursor:pointer">この条件Noで取り込む</button></div></details>',
          'background:#eef4fa;border:1px solid #b9d3ea')

      + '<div id="fdFacets" style="margin-bottom:9px"></div>'
      + '<div id="fdSortBar" style="margin-bottom:9px;font-size:11px"></div>'
      + '<div id="fdTabs" style="margin-bottom:9px;display:flex;gap:6px;flex-wrap:wrap"></div>'

      /* 一覧の操作 */
      + ((mode==='folder'||mode==='rescout')?sec('スカウト文章を決めて送信',
          '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px;font-size:11px">'
          + '<b>プリセット</b> <select id="fdSPre" style="max-width:190px;padding:3px"></select>'
          + '<b>テンプレート</b> <select id="fdSTpl" style="max-width:300px;padding:3px"></select> <button id="fdSTplRe" style="padding:3px 8px;cursor:pointer">再取得</button></div>'
          + '<div id="fdSPerk" style="font-size:11px;color:#555;margin-bottom:6px"></div>'
          + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
          + '<button id="fdSend" style="padding:6px 16px;background:#c0392b;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold">この文章で、選んだ人にまとめて送信</button>'
          + '<span style="font-size:10px;color:#8a94a0">押すと送信タブに対象の確認画面が出ます。そこで「この◯件に送信を開始」を押すまでは送信されません。特典は送信タブで変更できます。</span></div>',
          'background:#fdf3f2;border:1px solid #efc4bf'):'')
      + sec('一覧の操作',
          '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:7px">'
          + '<button id="fdAll" style="padding:3px 10px;cursor:pointer">全部チェック</button>'
          + '<button id="fdNone" style="padding:3px 10px;cursor:pointer">解除</button>'
          + '<span style="font-size:11px;color:#555">上から <input type="number" id="fdTopN" value="50" style="width:50px;padding:3px"> 件</span>'
          + '<button id="fdTop" style="padding:3px 10px;cursor:pointer;border:1px solid #0b8a5b;background:#fff;color:#0b8a5b;border-radius:3px">この件数だけ</button>'
          + '<button id="fdHint" style="padding:3px 10px;cursor:pointer;border:1px solid #164e8a;background:#fff;color:#164e8a;border-radius:3px">要確認を外す</button>'
          + '<span id="fdSel" style="font-weight:bold;color:#333;margin-left:auto">選択 0名</span></div>'
          + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:7px;padding:5px 6px;background:#f4f8fc;border:1px solid #d5e2f0;border-radius:4px">'
          + '<span style="font-size:11px;color:#164e8a">範囲指定</span>'
          + '<input type="number" id="fdRFrom" min="1" placeholder="例 33" style="width:56px;padding:3px"><span style="font-size:11px">番目 〜</span>'
          + '<input type="number" id="fdRTo" min="1" placeholder="例 67" style="width:56px;padding:3px"><span style="font-size:11px">番目</span>'
          + '<button id="fdRng" style="padding:3px 10px;cursor:pointer;border:1px solid #164e8a;background:#fff;color:#164e8a;border-radius:3px">この範囲だけチェック</button>'
          + '<button id="fdRngAdd" style="padding:3px 10px;cursor:pointer;border:1px solid #164e8a;background:#fff;color:#164e8a;border-radius:3px">範囲を追加</button>'
          + '<span style="font-size:11px;color:#555;margin-left:6px">真ん中の <input type="number" id="fdMidN" value="35" style="width:50px;padding:3px"> 件</span>'
          + '<button id="fdMid" style="padding:3px 10px;cursor:pointer;border:1px solid #164e8a;background:#fff;color:#164e8a;border-radius:3px">真ん中だけチェック</button>'
          + '<span style="font-size:10px;color:#8a94a0;width:100%">番号は現在の表示順（行の左の番号）です。一覧でShift＋クリックしても範囲を選べます。</span></div>'
          + '<div style="display:none">'
          + '<span id="fdSel" style="font-weight:bold;color:#333;margin-left:auto">選択 0名</span></div>'
          + '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">'
          + '<button id="fdMark" style="padding:4px 10px;background:#0b8a5b;color:#fff;border:none;border-radius:4px;cursor:pointer">このページのチェックに反映</button>'
          + '<button id="fdReg" style="padding:4px 10px;background:#0b6cbf;color:#fff;border:none;border-radius:4px;cursor:pointer">検討人材リストに一括登録</button>'
          + '<button id="fdPop" style="padding:4px 10px;background:#5b4a8a;color:#fff;border:none;border-radius:4px;cursor:pointer">一覧を大きく表示</button></div>',
          'background:#f3faf6;border:1px solid #bfe0d0')

      + '<div id="fdListWrap">'
      + '<div id="fdHead" style="display:grid;grid-template-columns:24px 30px 1fr 34px 34px 52px 74px 50px;background:#ecf0f1;padding:4px 6px;font-weight:bold;color:#556;font-size:10px">'
      + '<span></span><span>#</span><span>居住地／職種</span><span>年齢</span><span>在職</span><span>年収</span><span>'+((mode==='folder'||mode==='rescout')?'回数／最終送信':'ログイン')+'</span><span>送信</span></div>'
      + '<div id="fdBody" style="max-height:320px;overflow:auto;border:1px solid #eee"></div>'
      + '<div style="font-size:10px;color:#8a94a0;margin-top:4px;line-height:1.6">行をクリックでチェック。ドラッグ、Shift＋クリックで範囲選択。オレンジの「要確認」を押すと、その人のところまで画面がスクロールします。<br>選択はエン転職の全ページぶんです。実際にチェックが入るのは、いま開いているページに居る人だけになります（「うちこのページ◯名」がその数）。次のページへ進んで、また「このページのチェックに反映」を押してください。</div>'
      + '</div>'
      + '<div id="fdListAnchor"></div>'

      /* 保存 */
      + sec('いまの条件を保存する',
          '<input type="text" id="fdName" placeholder="社名" value="'+(cfg.name||'')+'" style="width:170px;padding:4px">'
          + ' <button id="fdSave" style="padding:4px 14px;cursor:pointer;font-weight:bold">保存</button>'
          + ' <button id="fdDel" style="padding:4px 10px;cursor:pointer">選択中のプリセットを削除</button>'
          + '<div style="font-size:10px;color:#8a94a0;margin-top:4px">保存すると、上の「保存した条件」から呼び出せます。</div>',
          'background:#f7f8f9;border:1px solid #e3e7ea')

      + '<div style="margin-top:9px;padding:7px 10px;background:#eef4fa;border-radius:4px">'
      + '<b style="font-size:11px">レポート用CSV</b> '
      + '<button id="fdS1" style="padding:3px 9px;cursor:pointer">STEP1 送信済み全件</button> '
      + '<button id="fdS2" style="padding:3px 9px;cursor:pointer">STEP2 既読詳細</button> '
      + '<button id="fdS3" style="padding:3px 9px;cursor:pointer">STEP3 応募管理</button></div>'
      + '<div id="fdLog" style="margin-top:7px;padding:6px 9px;background:#fffbe6;border:1px solid #ecd98a;border-radius:4px;color:#7a5c00;font-size:11px;min-height:16px;line-height:1.6"></div>';

    setTimeout(function(){
      findLogEl=wrap.querySelector('#fdLog');

      function q(id){ return wrap.querySelector(id) || document.querySelector(id); }
      function readCfg(){
        var sexEl=q('#fdSex'), loEl=q('#fdAmin'), hiEl=q('#fdAmax');
        return {
          name: q('#fdName').value.trim(),
          workId: q('#fdWid').value.trim(),
          conditions: q('#fdCno').value.trim(),
          sex: sexEl?sexEl.value:'指定なし',
          ageMin: loEl?(parseInt(loEl.value,10)||0):0,
          ageMax: hiEl?(parseInt(hiEl.value,10)||99):99,
          incomeMax: 0,
          jobGroups: qsa('#fdGroups input:checked',wrap).map(function(c){ return c.value; }),
          keywords: q('#fdKw').value.trim(),
          ngKeywords: q('#fdNg').value.trim(),
          priorityWish: q('#fdPw').value.trim(),
          areaOnly: (function(){ var e=q('#fdAreaOn'); return e?e.checked:true; })(),
          commuteAddr: q('#fdCa').value.trim(),
          forMode: (function(){ var e=q('#fdForOn'); if(!e) return cfg.forMode||FOR_MODES[3]; return e.checked?FOR_MODES[3]:FOR_MODES[0]; })(),
          forAct: FOR_ACTS[1]
        };
      }
      function selCount(){
        var n=Object.keys(FIND_SEL).length;
        var here=0;
        try{
          getRows().forEach(function(row){ var no=M.memberNo(row); if(no && FIND_SEL[no]) here++; });
        }catch(e){}
        var txt='選択 '+n+'名（うちこのページ '+here+'名）';
        var a=q('#fdSel'); if(a) a.textContent=txt;
        var b=document.getElementById('fdPopSel'); if(b) b.textContent=txt;
      }

      /* ---- 検索条件（性別・年齢。エン転職側にも反映する） ---- */
      function drawCond(){
        var box=q('#fdCond');
        var f=(mode==='search')?condForm():null;
        var dt=f?f.querySelector('[name="SearchRangeDivisionDateType"]'):null;
        var dtName=dt?(DT_LABEL[String(dt.value)]||'現在の設定'):'現在の設定';
        var cur=findCur();
        box.innerHTML='<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
          +'<b style="font-size:11px">性別</b> <select id="fdSex" style="padding:3px">'
          + ['指定なし','男性','女性'].map(function(s){ return '<option'+(s===cur.sex?' selected':'')+'>'+s+'</option>'; }).join('')
          +'</select>'
          +' <b style="font-size:11px">年齢</b> <input type="number" id="fdAmin" value="'+cur.ageMin+'" style="width:52px;padding:3px">〜<input type="number" id="fdAmax" value="'+cur.ageMax+'" style="width:52px;padding:3px">'
          +'</div>'
          +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:7px">'
          + ((mode==='search')?' <button id="fdCondGo2" style="padding:6px 14px;background:#e8500e;color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer">エン転職の検索条件を変える（全ページに効く）</button>':'')
          + (f?' <button id="fdCondGo" style="padding:6px 14px;background:#e8500e;color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer">エン転職に反映</button>':'')
          +' <button id="fdCondApply" style="padding:6px 14px;background:#0b6cbf;color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer">このページの表示だけ絞る</button>'
          +' <button id="fdCondClear" style="padding:6px 12px;background:#fff;color:#555;border:1px solid #bbb;border-radius:4px;cursor:pointer">表示を戻す</button>'
          +'</div>'
          +'<div id="fdCondNote" style="margin-top:6px;font-size:12px;font-weight:bold;color:#0b6cbf;min-height:15px"></div>'
          + '<div style="font-size:10px;color:#8a7a55;margin-top:6px;line-height:1.7">'
          + ((mode==='search')
            ?'上のオレンジのボタンは、エン転職の検索条件そのものを年齢・性別だけ書き換えます。検索条件の変更画面を経由して自動で送信するので、ページをめくっても条件が続きます。日付種別など他の条件はそのままです。<br>'
            :'この画面ではエン転職側の検索条件は変えられません。<br>')
          + '青いボタンは、いま画面に出ている人だけを対象に表示を絞ります。ページを移動すると元に戻ります。取り込み済みのデータがあるときは、そちらに対して絞り込みます。</div>';
        var ap=q('#fdCondApply');
        if(ap) ap.onclick=function(){ runCondFilter(); };
        var g2=q('#fdCondGo2');
        if(g2) g2.onclick=onCondGoViaPage;
        var cc=q('#fdCondClear');
        if(cc) cc.onclick=function(){ var n=screenCondClear(); condNote('絞り込みを解除しました（'+n+'名を表示）', '#555'); fLog('画面の絞り込みを解除しました'); };
        var sx=q('#fdSex');
        COND_HOOKS.fd=function(){ if(FIND_RAW.length){ applyAll(); return true; } return false; };
        if(sx) sx.onchange=function(){ onCondChanged('fd'); };
        ['#fdAmin','#fdAmax'].forEach(function(sel){
          var e=q(sel);
          if(!e) return;
          e.onkeydown=function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); runCondFilter(); } };
        });
        var go=q('#fdCondGo');
        if(go) go.onclick=onCondGo;
      }
      function onCondGoViaPage(){
        var a=condChangeLink();
        if(!a){ condNote('「検索条件の変更」リンクが見つかりませんでした。検索結果の一覧ページで実行してください', '#a33'); return; }
        var sexName=q('#fdSex')?q('#fdSex').value:'指定なし';
        var sv={'指定なし':'0','男性':'1','女性':'2'}[sexName]||'0';
        var lo=parseInt(q('#fdAmin')?q('#fdAmin').value:'',10); if(isNaN(lo)||lo<0) lo=0;
        var hi=parseInt(q('#fdAmax')?q('#fdAmax').value:'',10); if(isNaN(hi)||hi<0) hi=0;
        if(!confirm('エン転職の検索条件そのものを次の内容に変更します。\n\n性別：'+sexName
          +'\n年齢：'+(lo?lo+'歳':'指定なし')+' 〜 '+(hi?hi+'歳':'指定なし')
          +'\n\n検索条件の変更画面を経由して自動で送信します。日付種別など他の条件は変更しません。\nよろしいですか？')) return;
        try{ localStorage.setItem(COND_PENDING_KEY, JSON.stringify({sex:sv, lo:String(lo), hi:String(hi), ts:Date.now()})); }catch(e){}
        saveFindCur(readCfg());
        condNote('検索条件の変更画面へ移動しています…', '#e8500e');
        location.href=a.href;
      }
      function condNote(msg, color){
        var n=q('#fdCondNote');
        if(n){ n.textContent=msg; n.style.color=color||'#0b6cbf'; }
      }
      function runCondFilter(){
        if(FIND_RAW.length){ applyAll(); condNote('取り込み済みの '+FIND_RAW.length+'名に対して絞り込みました（下の一覧をご覧ください）', '#0b6cbf'); return; }
        var sexName=q('#fdSex')?q('#fdSex').value:'指定なし';
        var lo=parseInt(q('#fdAmin')?q('#fdAmin').value:'',10); if(isNaN(lo)) lo=0;
        var hi=parseInt(q('#fdAmax')?q('#fdAmax').value:'',10); if(isNaN(hi)) hi=99;
        var r=screenCondFilter(sexName, lo, hi);
        if(!r.total){ condNote('この画面に一覧が見つかりませんでした', '#a33'); fLog('一覧が見つかりません'); return; }
        var cond=(sexName==='指定なし'?'性別不問':sexName)+' '+lo+'〜'+hi+'歳';
        condNote('このページの'+r.total+'名のうち、'+cond+' の'+r.shown+'名だけ表示しました（'+r.hidden+'名を非表示）。ページを移動すると戻ります。', r.shown?'#0b6cbf':'#a33');
        fLog('画面の絞り込み：'+r.shown+'名を表示、'+r.hidden+'名を非表示にしました。ページを移動すると解除されます'
             +(mode==='search'?'。全ページを対象にするときは「この検索結果を取り込む」を先に押してください':''));
      }
      function onCondGo(){
        var f2=condForm(); if(!f2){ fLog('検索条件の変更フォームが見つかりません'); return; }
        var dt2=f2.querySelector('[name="SearchRangeDivisionDateType"]');
        var before=dt2?String(dt2.value):'';
        var sexName=q('#fdSex').value;
        var sv={'指定なし':'0','男性':'1','女性':'2'}[sexName];
        var lo=String(q('#fdAmin').value||'').trim();
        var hi=String(q('#fdAmax').value||'').trim();
        saveFindCur(readCfg());
        var okS=setField(f2,'Sex',sv);
        var okL=lo?setField(f2,'AgeLow',lo):true;
        var okH=hi?setField(f2,'AgeHigh',hi):true;
        if(!okL || !okH){ fLog('年齢の値がフォームの選択肢にありません（'+lo+'〜'+hi+'）。選べる値をご確認ください'); return; }
        if(!okS){ fLog('性別の項目に反映できませんでした'); return; }
        var after=dt2?String(dt2.value):'';
        if(before!==after){ fLog('日付種別が変わってしまうため中止しました。手動でご確認ください'); return; }
        if(!confirm('エン転職の検索条件を次の内容に変更して、検索し直します。\n\n性別：'+sexName+'\n年齢：'+(lo||'指定なし')+' 〜 '+(hi||'指定なし')
          +'\n\n日付種別は現在の設定（'+(DT_LABEL[before]||'現在の設定')+'）のまま変更しません。\nページが再読み込みされます。よろしいですか？')) return;
        clearScreen();
        fLog('検索条件を反映しています…');
        f2.submit();
      }

      /* ---- 対象バー ---- */
      function drawCtxBar(){
        var bar=q('#fdCtxBar');
        if(mode==='folder' || mode==='rescout'){
          var totM=(document.documentElement.innerHTML.match(/全\s*<em[^>]*>([\d,]+)<\/em>/)||[])[1];
          var totN=parseInt(String(totM||'').replace(/,/g,''),10)||0, pgN=totN?Math.ceil(totN/50):0;
          bar.innerHTML='<div style="font-size:13px;margin-bottom:6px"><b>'+(mode==='folder'?'検討人材リスト':'送信済みリスト')+(totM?' 全体 '+totM+'名':'')+'</b>'
            +(pgN?'<span style="font-size:11px;color:#667"> （1ページ50名として約'+pgN+'ページ）</span>':'')+'</div>'
            +'<div style="font-size:11px;color:#556;margin-bottom:3px">どこまで取り込むか</div>'
            +'<div style="display:flex;gap:6px 16px;flex-wrap:wrap;align-items:center;font-size:12px;margin-bottom:8px">'
            +'<label style="cursor:pointer"><input type="radio" name="fdSc" value="all"> 全ページ</label>'
            +'<label style="cursor:pointer"><input type="radio" name="fdSc" value="page"> このページだけ（'+currentPageNo()+'ページ目）</label>'
            +'<label style="cursor:pointer"><input type="radio" name="fdSc" value="range"> ページ指定 <input type="number" id="fdPf" min="1" style="width:56px;padding:3px"> 〜 <input type="number" id="fdPt" min="1" style="width:56px;padding:3px"> ページ目</label></div>'
            +'<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
            +'<button id="fdTakeL" style="padding:6px 18px;background:#0b6cbf;color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer">この条件で取り込んで抽出する</button>'
            +(FIND_RAW.length?'<span style="font-size:11px;color:#0b8a5b;font-weight:bold">取り込み済み '+FIND_RAW.length+'名</span>':'<span style="font-size:11px;color:#666">上の条件を入れてから押してください</span>')
            +'</div>'
            +'<div style="font-size:10px;color:#8a94a0;margin-top:4px">例：1〜10 なら最初の10ページ（約500名）だけを取り込みます。範囲を絞るほど速く終わります。</div>';
          qsa('input[name="fdSc"]', bar).forEach(function(r){ r.checked=(r.value===LIST_SC.t); r.onchange=readScope; });
          q('#fdPf').value=LIST_SC.f; q('#fdPt').value=LIST_SC.to;
          ['#fdPf','#fdPt'].forEach(function(sel){ var e=q(sel); e.onfocus=function(){ var rr=qsa('input[name="fdSc"]',bar).filter(function(x){ return x.value==='range'; })[0]; if(rr){ rr.checked=true; } readScope(); }; e.onchange=readScope; });
          q('#fdTakeL').onclick=onTakeList;
          return;
        }
        if(mode!=='search'){
          bar.innerHTML='<div style="font-size:11px;color:#555">この画面では取り込みができません。スカウトの<b>検索結果一覧</b>を開いてから、このタブをご利用ください。（応募管理ページではレポート用CSVのSTEP3のみ使えます）</div>';
          return;
        }
        FIND_CTX=currentSearchCtx();
        if(!FIND_CTX.ok){
          bar.innerHTML='<div style="font-size:11px;color:#a33">検索結果の情報が読み取れませんでした。一覧が表示された状態で、パネルを開き直してください。</div>';
          return;
        }
        bar.innerHTML='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
          +'<span style="font-size:13px"><b>検索結果全体 '+FIND_CTX.total.toLocaleString()+'名</b></span>'
          +'<button id="fdTake" style="padding:5px 16px;background:#0b6cbf;color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer">全体を取り込んで抽出する</button>'
          +(FIND_RAW.length?'<span style="font-size:11px;color:#0b8a5b;font-weight:bold">取り込み済み '+FIND_RAW.length+'名</span>':'<span style="font-size:11px;color:#666">上の条件を入れてから押してください</span>')+'</div>'
          +(FIND_CTX.capped?'<div style="margin-top:6px;padding:5px 8px;background:#fff3f3;border:1px solid #e6b8b8;border-radius:3px;font-size:11px;color:#a33">上限の3000名に達しています。このまま取り込むと上位3000名だけになり、母集団に偏りが出ます。先に上の検索条件で年齢を分けることをおすすめします。</div>':'');
        q('#fdTake').onclick=onTake;
        setTimeout(showSavedSummary, 0);
      }

      /* ---- 絞り込みボタン群 ---- */
      function drawFacets(){
        var box=q('#fdFacets');
        if(!FIND_BASE.length){ box.innerHTML=''; return; }
        var f=buildFacets(FIND_BASE);
        function grp(key, title){
          var keys=Object.keys(f[key]);
          if(!keys.length) return '';
          var ORD=['未送信','1回','2回','3回','4回以上','3回以上'];
          if(key==='sent') keys.sort(function(a,b){ return ORD.indexOf(a)-ORD.indexOf(b); });
          else keys.sort(function(a,b){ return f[key][b]-f[key][a]; });
          return '<div style="margin-bottom:4px;display:flex;gap:4px;flex-wrap:wrap;align-items:center">'
            +'<span style="font-size:10px;color:#8a94a0;width:78px;flex:none">'+title+'</span>'
            + keys.map(function(k){
                var on=!!FIND_FACET[key][k];
                return '<button data-fk="'+key+'" data-fv="'+k+'" style="padding:2px 9px;font-size:11px;cursor:pointer;border:1px solid '+(on?'#0b6cbf':'#ccc')+';background:'+(on?'#0b6cbf':'#fff')+';color:'+(on?'#fff':'#333')+';border-radius:12px">'+k+' '+f[key][k]+'</button>';
              }).join('')
            +'</div>';
        }
        box.innerHTML='<span style="font-size:10px;color:#8a94a0;letter-spacing:.04em;display:block;margin-bottom:3px">取り込んだ結果から絞り込む</span>'
          +'<div style="padding:8px 10px;border:1px solid #e3e7ea;border-radius:4px">'
          + grp('pref','都道府県') + grp('group','経験職種') + grp('jyo','在職／離職') + grp('sent','送信回数')
          + '<div style="margin-top:4px"><button id="fdFacetClear" style="padding:2px 9px;font-size:11px;cursor:pointer">絞り込みボタンをすべて解除</button></div></div>';
        qsa('button[data-fk]',box).forEach(function(b){
          b.onclick=function(){
            var k=b.dataset.fk, v=b.dataset.fv;
            if(FIND_FACET[k][v]) delete FIND_FACET[k][v]; else FIND_FACET[k][v]=1;
            applyAll();
          };
        });
        var cl=box.querySelector('#fdFacetClear');
        if(cl) cl.onclick=function(){ FIND_FACET={pref:{},group:{},jyo:{},sent:{}}; applyAll(); };
      }

      /* ---- 並べ替え ---- */
      function drawSort(){
        var box=q('#fdSortBar');
        if(!FIND_BASE.length){ box.innerHTML=''; return; }
        box.innerHTML='<span style="color:#8a94a0;font-size:10px;margin-right:6px">並べ替え</span>'
          + Object.keys(SORTS).filter(function(k){ var isL=(mode==='folder'||mode==='rescout'); return isL ? (k!=='login' && k!=='commute') : (k!=='last' && k!=='cnt'); }).map(function(k){
              var on=(FIND_SORT===k);
              return '<button data-sk="'+k+'" style="padding:2px 9px;margin-right:4px;font-size:11px;cursor:pointer;border:1px solid '+(on?'#0b8a5b':'#ccc')+';background:'+(on?'#0b8a5b':'#fff')+';color:'+(on?'#fff':'#333')+';border-radius:12px">'+SORTS[k].label+'</button>';
            }).join('');
        qsa('button[data-sk]',box).forEach(function(b){
          b.onclick=function(){ FIND_SORT=b.dataset.sk; applyAll(); };
        });
      }

      function render(p){
        FIND_VIEW = (p==null) ? FIND_ROWS : FIND_ROWS.filter(function(r){ return r.p===p; });
        var wid=(FIND_CTX&&FIND_CTX.WorkID)||readCfg().workId;
        q('#fdBody').innerHTML = FIND_VIEW.map(function(r,i){
          var url='/company/scout/scout_message/form/?WorkID='+wid+'&UserID='+r.id
                +'&_pp_='+encodeURIComponent('rtn=1|WorkID='+wid+'|ConditionNo='+r.from[0])+'&PK='+r.PK;
          var bg = r.noCheck ? '#f6f4fb' : (r.hint?'#eef5ff':(i%2?'#fafbfc':'#fff'));
          return '<div class="fdRow" data-idx="'+i+'" style="display:grid;grid-template-columns:24px 30px 1fr 34px 34px 52px 74px 50px;padding:4px 6px;border-bottom:1px solid #eee;align-items:center;font-size:11px;cursor:default;background:'+bg+'">'
            +'<span><input type="checkbox" class="fdCk" data-id="'+r.id+'"'+(FIND_SEL[r.id]?' checked':'')+'></span>'
            +'<span style="color:#aaa">'+(i+1)+'</span>'
            +'<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+r.addr+'／希望勤務地: '+r.wish+'／'+r.job+'">'+r.addr
            +'<span style="color:#888;font-size:10px">／'+r.group+'</span>'
            +(r.hint?'<span class="fdJump" data-uid="'+r.id+'" title="クリックするとこの人の位置までスクロールします" style="margin-left:4px;padding:1px 6px;border-radius:8px;background:'+(r.noCheck?'#e8500e':'#164e8a')+';color:#fff;font-size:9px;cursor:pointer">要確認: '+r.hint+(r.noCheck?'／対象外':'')+' ▶</span>':'')+'</span>'
            +'<span style="text-align:center">'+r.age+'</span>'
            +'<span style="text-align:center;color:'+(r.jyo==='在職'?'#27ae60':'#c0392b')+'">'+r.jyo+'</span>'
            +'<span style="text-align:center;font-size:10px">'+(r.inc==null?'-':r.inc+'~')+'</span>'
            +(r.fromList
              ?'<span style="text-align:center;font-size:10px;line-height:1.3;color:#555"><b style="color:'+(r.cur===0?'#888':r.cur===1?'#2e86de':r.cur===2?'#e8500e':r.cur>2?'#c0392b':'#999')+'">'+(r.cur<0?'回数不明':(r.cur===0?'未送信':r.cur+'回'))+(r.all>r.cur&&r.cur>=0?'<span style="font-weight:normal;color:#999">(全'+r.all+')</span>':'')+'</b><br>'+(r.last||'-')+'</span>'
              :'<span style="text-align:center;font-size:10px;color:#777">'+r.login+'</span>')
            +'<a href="'+url+'" target="_blank" style="background:#c0392b;color:#fff;padding:2px 4px;border-radius:3px;text-decoration:none;font-size:10px;text-align:center">送信▶</a></div>';
        }).join('') || '<div style="padding:16px;color:#999;text-align:center;font-size:11px">該当なし</div>';
        bindRows(); paintRows();
      }

      /* ---- 一覧の選択（クリック・ドラッグ・Shift＋クリックの範囲選択） ---- */
      var LAST_IDX=-1, DRAGGING=false, DRAG_ON=true, DRAG_FROM=-1, DRAG_MOVED=false;
      function rowSet(i, on){
        var r=FIND_VIEW[i]; if(!r) return;
        if(on){ if(r.noCheck) return; FIND_SEL[r.id]=1; }
        else delete FIND_SEL[r.id];
      }
      function rowRange(a, b, on){
        var lo=Math.min(a,b), hi=Math.max(a,b);
        for(var i=lo;i<=hi;i++) rowSet(i,on);
      }
      function paintRows(){
        qsa('.fdRow', document).forEach(function(d){
          var r=FIND_VIEW[+d.dataset.idx]; if(!r) return;
          var c=d.querySelector('.fdCk');
          var on=!!FIND_SEL[r.id];
          if(c) c.checked=on;
          d.style.boxShadow = on ? 'inset 3px 0 0 #0b6cbf' : 'none';
        });
        selCount();
      }
      /* v4.7: 要確認バッジから、管理画面のその人の位置までスクロールする */
      function gotoPerson(uid){
        var list=(M && M.rows)?M.rows():[];
        var hit=null;
        for(var i=0;i<list.length;i++){
          var no=(M && M.memberNo)?M.memberNo(list[i]):'';
          if(String(no)===String(uid)){ hit=list[i]; break; }
        }
        if(!hit){
          var r0=null;
          for(var j=0;j<FIND_VIEW.length;j++){ if(FIND_VIEW[j].id===uid){ r0=FIND_VIEW[j]; break; } }
          fLog('会員No.'+uid+' はいま開いているページにいません'+((r0&&r0.pg)?('（取り込んだときは '+r0.pg+'ページ目）'):'')+'。そのページを開いてから、もう一度バッジを押してください');
          return;
        }
        if(hit.style.display==='none') hit.style.display='';
        try{ hit.scrollIntoView({behavior:'smooth', block:'center'}); }catch(e){ hit.scrollIntoView(); }
        var old=hit.style.outline, oldOff=hit.style.outlineOffset;
        hit.style.outline='4px solid #e8500e'; hit.style.outlineOffset='2px';
        setTimeout(function(){ hit.style.outline=old||''; hit.style.outlineOffset=oldOff||''; }, 4000);
        fLog('会員No.'+uid+' の位置へ移動しました。オレンジの枠がその人です');
      }
      function bindJumps(){
        qsa('.fdJump', document).forEach(function(el){
          el.onmousedown=function(ev){ ev.stopPropagation(); };
          el.onclick=function(ev){ ev.stopPropagation(); ev.preventDefault(); gotoPerson(el.dataset.uid); };
        });
      }
      function bindRows(){
        bindJumps();
        var body=q('#fdBody'); if(!body) return;
        qsa('.fdRow', body).forEach(function(d){
          var i=+d.dataset.idx;
          var cb=d.querySelector('.fdCk');
          if(cb){
            cb.onclick=function(ev){ ev.stopPropagation(); };
            cb.onchange=function(){
              rowSet(i, cb.checked);
              LAST_IDX=i; paintRows();
            };
          }
          d.onmousedown=function(ev){
            if(ev.button!==0) return;
            var t=ev.target;
            if(t.tagName==='A' || t.tagName==='INPUT') return;
            ev.preventDefault();
            var r=FIND_VIEW[i]; if(!r) return;
            if(ev.shiftKey && LAST_IDX>=0){
              rowRange(LAST_IDX, i, true);
              LAST_IDX=i; paintRows();
              return;
            }
            DRAGGING=true; DRAG_MOVED=false; DRAG_FROM=i;
            DRAG_ON = !FIND_SEL[r.id];
            rowSet(i, DRAG_ON);
            LAST_IDX=i; paintRows();
            document.body.style.userSelect='none';
          };
          d.onmouseenter=function(){
            if(!DRAGGING) return;
            DRAG_MOVED=true;
            rowRange(DRAG_FROM, i, DRAG_ON);
            LAST_IDX=i; paintRows();
          };
        });
      }
      document.addEventListener('mouseup', function(){
        if(!DRAGGING) return;
        DRAGGING=false; DRAG_MOVED=false;
        document.body.style.userSelect='';
      });

      /* ---- 一覧を大きく表示（左側に切り出す） ---- */
      var POP_KEY='enFindPop_v1', POPW_KEY='enFindPopWide_v1', popBox=null;
      function popWide(){ try{ return localStorage.getItem(POPW_KEY)==='1'; }catch(e){ return false; } }
      function popSize(){
        if(!popBox) return;
        popBox.style.width = popWide() ? 'calc(100vw - 20px)' : (Math.max(560, window.innerWidth-720)+'px');
        var t=document.getElementById('fdPopWide');
        if(t) t.textContent = popWide() ? 'パネルを避ける' : '画面いっぱいに広げる';
      }
      function popOpen(){
        if(popBox) return;
        var listWrap=q('#fdListWrap'); if(!listWrap) return;
        popBox=el('div','position:fixed;top:10px;left:10px;background:#fff;border:2px solid #5b4a8a;border-radius:8px;z-index:2147483647;box-shadow:0 4px 18px rgba(0,0,0,.3);font-size:13px;font-family:sans-serif;display:flex;flex-direction:column;max-height:calc(100vh - 20px)');
        popBox.id='ensbaListPop';
        var bar=el('div','display:flex;align-items:center;gap:10px;padding:7px 10px;background:#5b4a8a;color:#fff;border-radius:5px 5px 0 0;flex:none');
        bar.innerHTML='<b style="font-size:12px">候補者一覧</b><span id="fdPopSel" style="font-size:12px">選択 0名</span>'
          +'<span style="font-size:10px;opacity:.85">クリック／ドラッグ／Shift＋クリックで範囲選択</span>'
          +'<span style="flex:1"></span>'
          +'<button id="fdPopWide" style="padding:3px 12px;cursor:pointer;border:none;border-radius:4px;background:#fff;color:#5b4a8a;font-weight:bold">画面いっぱいに広げる</button>'
          +'<button id="fdPopClose" style="padding:3px 12px;cursor:pointer;border:none;border-radius:4px;background:#fff;color:#5b4a8a;font-weight:bold">パネルに戻す</button>';
        popBox.appendChild(bar);
        var inner=el('div','padding:8px 10px;overflow:auto;flex:1');
        inner.id='ensbaListPopInner';
        popBox.appendChild(inner);
        document.body.appendChild(popBox);
        inner.appendChild(listWrap);
        var bd=q('#fdBody'); if(bd) bd.style.maxHeight='calc(100vh - 130px)';
        popBox.querySelector('#fdPopClose').onclick=function(){ popClose(); };
        popBox.querySelector('#fdPopWide').onclick=function(){
          try{ if(popWide()) localStorage.removeItem(POPW_KEY); else localStorage.setItem(POPW_KEY,'1'); }catch(e){}
          popSize();
        };
        popSize();
        try{ localStorage.setItem(POP_KEY,'1'); }catch(e){}
        var pb=q('#fdPop'); if(pb) pb.textContent='一覧をパネルに戻す';
        paintRows();
      }
      function popClose(){
        if(!popBox) return;
        var listWrap=q('#fdListWrap');
        if(listWrap){
          var anchor=wrap.querySelector('#fdListAnchor');
          if(anchor) anchor.parentNode.insertBefore(listWrap, anchor);
          else wrap.appendChild(listWrap);
        }
        var bd=q('#fdBody'); if(bd) bd.style.maxHeight='320px';
        popBox.remove(); popBox=null;
        try{ localStorage.removeItem(POP_KEY); }catch(e){}
        var pb=q('#fdPop'); if(pb) pb.textContent='一覧を大きく表示';
        paintRows();
      }

      function renderTabs(){
        var c1=FIND_ROWS.filter(function(r){return r.p===1;}).length;
        var c2=FIND_ROWS.filter(function(r){return r.p===2;}).length;
        var c3=FIND_ROWS.filter(function(r){return r.p===3;}).length;
        var ch=FIND_ROWS.filter(function(r){return r.hint;}).length;
        var t=q('#fdTabs');
        t.innerHTML='<button data-f="1" style="padding:4px 10px;cursor:pointer;border:1px solid #c0392b;background:#fff;color:#c0392b;border-radius:4px;font-size:11px">勤務地希望 '+c1+'名</button>'
          +'<button data-f="2" style="padding:4px 10px;cursor:pointer;border:1px solid #e67e22;background:#fff;color:#e67e22;border-radius:4px;font-size:11px">通勤圏 '+c2+'名</button>'
          +'<button data-f="3" style="padding:4px 10px;cursor:pointer;border:1px solid #7f8c8d;background:#fff;color:#7f8c8d;border-radius:4px;font-size:11px">その他 '+c3+'名</button>'
          +'<button data-f="" style="padding:4px 10px;cursor:pointer;border:1px solid #0b6cbf;background:#0b6cbf;color:#fff;border-radius:4px;font-size:11px">全て '+FIND_ROWS.length+'</button>'
          +'<span style="font-size:11px;color:#164e8a;align-self:center">要確認 '+ch+'件</span>';
        qsa('button',t).forEach(function(b){
          b.onclick=function(){
            qsa('button',t).forEach(function(x){ x.style.background='#fff'; x.style.color=x.style.borderColor; });
            b.style.background=b.style.borderColor; b.style.color='#fff';
            render(b.dataset.f===''?null:parseInt(b.dataset.f,10));
          };
        });
      }

      /* ---- 絞り込みと並べ替えをまとめて反映 ---- */
      function applyAll(quiet){
        var cfg2=readCfg(); saveFindCur(cfg2);
        FIND_BASE=applyFindFilter(FIND_RAW, cfg2);
        var mode2=cfg2.forMode||FOR_MODES[0], act=cfg2.forAct||FOR_ACTS[1], nFor=0;
        FIND_BASE.forEach(function(r){ r.noCheck=false; });
        if(mode2!==FOR_MODES[0]){
          if(act===FOR_ACTS[0]){
            var b0=FIND_BASE.length;
            FIND_BASE=FIND_BASE.filter(function(r){ return !foreignHit(r, mode2); });
            nFor=b0-FIND_BASE.length;
          }else{
            FIND_BASE.forEach(function(r){ if(foreignHit(r, mode2)){ r.noCheck=true; nFor++; } });
          }
        }
        FIND_ROWS=FIND_BASE.filter(facetPass).slice().sort(SORTS[FIND_SORT].fn);
        FIND_SEL={};
        drawFacets(); drawSort(); renderTabs(); render(null); selCount();
        var res=document.getElementById('fdResult');
        var pageTxt='';
        if(mode==='search' && FIND_RAW.length){
          var ids2=FIND_ROWS.map(function(r){ return r.id; });
          var q3=new URLSearchParams(location.search);
          var pgMap={}; FIND_ROWS.forEach(function(r){ if(r.pg) pgMap[r.pg]=(pgMap[r.pg]||0)+1; });
          var meta={ total:(FIND_CTX&&FIND_CTX.total)||FIND_RAW.length, matched:ids2.length, raw:FIND_RAW.length, pgMap:pgMap };
          saveScreen({ids:ids2, workId:q3.get('WorkID')||'', ts:Date.now(),
                      total:meta.total, matched:meta.matched, raw:meta.raw, pgMap:pgMap});
          var sc=applyScreen(ids2, meta);
          pageTxt='　／　このページは '+sc.shown+' / '+(sc.shown+sc.hidden)+'名だけ表示';
        }
        if(res) res.textContent='取り込み '+FIND_RAW.length+'名 → 条件に合う '+FIND_ROWS.length+'名'+pageTxt;
        if(!quiet){
          var msg='取り込み '+FIND_RAW.length+'名 → 条件一致 '+FIND_BASE.length+'名 → 表示 '+FIND_ROWS.length+'名（'+SORTS[FIND_SORT].label+'）';
          if(nFor) msg += act===FOR_ACTS[0]
            ? '　外国籍の可能性がある '+nFor+'名を一覧から除外しました'
            : '　外国籍の可能性がある '+nFor+'名は一覧に残し、チェックの対象から外しています';
          fLog(msg);
        }
      }

      /* ---- 取り込み ---- */
      function readScope(){
        var r=qsa('input[name="fdSc"]:checked',wrap)[0];
        if(r) LIST_SC.t=r.value;
        var f=parseInt((q('#fdPf')||{}).value,10), t=parseInt((q('#fdPt')||{}).value,10);
        if(!isNaN(f)) LIST_SC.f=f;
        if(!isNaN(t)) LIST_SC.to=t;
      }
      async function onTakeList(){
        readScope();
        if(LIST_SC.t==='range' && (LIST_SC.f<1 || LIST_SC.to<LIST_SC.f)){ fLog('ページ指定は「開始 ≦ 終了」になるよう、1以上の数字で入れてください'); return; }
        var btn=q('#fdTakeL'); if(btn) btn.disabled=true;
        fLog('取り込みを開始します…');
        try{
          FIND_RAW=await scanListRows(LIST_SC.t==='range'?{from:LIST_SC.f,to:LIST_SC.to}:LIST_SC.t, fLog);
          FIND_CTX={WorkID:'', ConditionNo:'', PK:'', pp:'', total:FIND_RAW.length, capped:false, ok:true};
          FIND_FACET={pref:{},group:{},jyo:{},sent:{}};
          FIND_SORT='last';
          if(!FIND_RAW.length){ fLog('この画面から読み取れる人がいませんでした'); }
          else applyAll();
        }catch(e){ fLog('取り込みに失敗しました：'+e.message); }
        drawCtxBar();
      }
      async function onTake(){
        FIND_CTX=currentSearchCtx();
        if(!FIND_CTX.ok){ fLog('検索結果の情報が読み取れませんでした。一覧を表示した状態でお試しください'); return; }
        if(FIND_CTX.capped){
          fLog('上限の3000名に達しています。取り込みを止めました');
          var go=confirm('この検索結果は上限の3000名に達しています。\n\n上位3000名だけを取り込むことになり、母集団に偏りが出ます。\n先に上の検索条件で年齢を分けるか、条件Noを分けて保存する方法をおすすめします。\n\nこのまま上位3000名だけ取り込みますか？');
          if(!go){ fLog('取り込みを中止しました。検索条件を分けてから、もう一度お試しください'); return; }
        }
        fLog('取り込みを開始します…');
        try{
          FIND_RAW=await scanCurrent(FIND_CTX);
          FIND_FACET={pref:{},group:{},jyo:{},sent:{}};
          applyAll();
        }catch(e){ fLog('取り込みに失敗しました：'+e.message); }
      }

      drawCond();
      drawCtxBar();

      /* ---- 条件Noを指定した取り込み ---- */
      q('#fdScan').onclick=async function(){
        var cfg2=readCfg(); saveFindCur(cfg2);
        if(!cfg2.workId || !cfg2.conditions){
          var c=currentSearchCtx();
          if(c.WorkID){ q('#fdWid').value=c.WorkID; cfg2.workId=c.WorkID; }
          if(!cfg2.workId || !cfg2.conditions){ fLog('WorkIDと条件Noを入力してください'); return; }
        }
        fLog('条件Noから取り込み中…');
        try{
          FIND_RAW=await scanCandidates(cfg2);
          FIND_CTX={WorkID:cfg2.workId, ConditionNo:'', PK:(FIND_RAW[0]||{}).PK||'', pp:'', total:FIND_RAW.length, capped:false, ok:true};
          FIND_FACET={pref:{},group:{},jyo:{},sent:{}};
          applyAll();
        }catch(e){ fLog('取り込みに失敗しました：'+e.message); }
      };

      /* v6.5: 送信タブのプリセット・テンプレートと連動する選択欄 */
      (function(){
        var fp=q('#fdSPre'), ft=q('#fdSTpl'), fk=q('#fdSPerk');
        if(!fp || !ft) return;
        function cp(dst, src){
          if(!src) return;
          var sig=Array.prototype.map.call(src.options,function(o){ return o.value+'|'+o.textContent; }).join('\n');
          if(dst.__sig!==sig){
            dst.innerHTML='';
            Array.prototype.forEach.call(src.options,function(o){ var n=document.createElement('option'); n.value=o.value; n.textContent=o.textContent; dst.appendChild(n); });
            dst.__sig=sig;
          }
          if(document.activeElement!==dst) dst.value=src.value;
        }
        function syncS(){
          cp(fp, presetSel); cp(ft, tplSel);
          if(fk){ var pk=selectedPerks(); fk.textContent='特典：'+(pk.length?pk.join('／'):'なし'); }
        }
        fp.onchange=function(){
          presetSel.value=fp.value;
          try{ var ps=loadPresets(); if(fp.value && ps[fp.value]) applyConfig(ps[fp.value]); }catch(e){}
          saveLast(); drawGuard(); syncS();
        };
        ft.onchange=function(){ tplSel.value=ft.value; saveLast(); drawGuard(); syncS(); };
        var reB=q('#fdSTplRe'); if(reB) reB.onclick=function(){ reloadTemplates(); };
        syncS(); setInterval(syncS, 1000);
      })();
      var sendB=q('#fdSend');
      if(sendB) sendB.onclick=function(){
        var sel=FIND_ROWS.filter(function(r){ return FIND_SEL[r.id] && !r.noCheck; });
        if(!sel.length){ fLog('先に一覧で、送る人にチェックを入れてください（「全部チェック」「上から◯件」も使えます）'); return; }
        var ok=sel.filter(function(r){ return r.sendUrl; });
        var miss=sel.length-ok.length;
        var list=ok.map(function(r){
          return { ext:true, url:r.sendUrl, no:r.id,
            sum:{ main:r.id+'　'+(r.addr||'')+'　'+r.age+'歳　'+(r.sex||''),
                  sub:((r.gaku||'')+'　['+(r.cur>=0?(r.cur===0?'未送信':r.cur+'回送信済'):'回数不明')+(r.last?'／最終送信 '+r.last:'')+']').slice(0,110),
                  hint:r.hint||'' } };
        });
        if(!list.length){ fLog('チェックした人の送信リンクが読み取れませんでした'); return; }
        if(!tplSel || !tplSel.value || tplSel.value==='0' || tplSel.value==='読み込み中…'){
          fLog('先に「スカウト文章を決めて送信」のテンプレートを選んでください（チェックは残っています）');
          return;
        }
        if(GO_SEND) GO_SEND();
        fLog('チェックした '+sel.length+'名のうち '+list.length+'名を送信タブへ渡しました（まだ送信はしていません。送信タブの確認画面で件数をご確認ください）'+(miss?('（送信リンクが無い '+miss+'名は除きました）'):'')+'。テンプレートを選んで、確認画面で送信を開始してください');
        start(list);
      };
      q('#fdPop').onclick=function(){ if(popBox) popClose(); else popOpen(); };
      try{ if(localStorage.getItem(POP_KEY)) setTimeout(popOpen,0); }catch(e){}

      /* v5.8: 条件を変えたら自動で抽出し直す（抽出ボタンは廃止） */
      ['#fdKw','#fdNg','#fdPw','#fdCa'].forEach(function(sel){
        var e=q(sel); if(!e) return;
        e.onchange=function(){ if(FIND_RAW.length) applyAll(); };
        e.onkeydown=function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); if(FIND_RAW.length) applyAll(); } };
      });
      qsa('#fdGroups input', wrap).forEach(function(c){
        c.onchange=function(){ if(FIND_RAW.length) applyAll(); };
      });
      q('#fdForOn').onchange=function(){ if(FIND_RAW.length) applyAll(); };
      q('#fdAreaOn').onchange=function(){ if(FIND_RAW.length) applyAll(); };

      q('#fdAll').onclick=function(){
        var n=0, skip=0;
        FIND_VIEW.forEach(function(r){ if(r.noCheck){ skip++; return; } FIND_SEL[r.id]=1; n++; });
        render(null); selCount();
        fLog(n+'名を選択しました'+(skip?('。外国籍の可能性がある '+skip+'名は対象から外しています'):''));
      };
      q('#fdNone').onclick=function(){ FIND_SEL={}; render(null); selCount(); };
      q('#fdTop').onclick=function(){
        var n=parseInt(q('#fdTopN').value,10)||0;
        if(n<=0){ fLog('件数を入力してください'); return; }
        if(!FIND_VIEW.length){ fLog('先に取り込みと絞り込みを行ってください'); return; }
        var pool=FIND_VIEW.filter(function(r){ return !r.noCheck; });
        var skip=FIND_VIEW.length-pool.length;
        var list=pool.slice(0,n);
        FIND_SEL={};
        list.forEach(function(r){ FIND_SEL[r.id]=1; });
        var msg='上から '+list.length+'名を選択しました'+(skip?('（外国籍の可能性がある '+skip+'名は対象外）'):'')+'。';
        if(M && M.useNative){
          var r2=markOnPage(list.map(function(x){ return x.id; }));
          msg+='このページのチェックに入ったのは '+r2.on+'名です'+(r2.miss?('。残り '+r2.miss+'名は別ページにいるため、検討人材リストへの登録をご利用ください'):'');
        }else{
          msg+='この画面ではページのチェックに反映できないため、検討人材リストへの登録をご利用ください';
        }
        render(null); selCount(); fLog(msg);
      };
      function rngDo(lo,hi,keep){
        if(!FIND_VIEW.length){ fLog('先に取り込みと絞り込みを行ってください'); return; }
        var N=FIND_VIEW.length;
        lo=Math.max(1,lo); hi=Math.min(N,hi);
        if(!(lo<=hi)){ fLog('範囲を確認してください（表示は '+N+'名です）'); return; }
        if(!keep) FIND_SEL={};
        var n=0, skip=0;
        for(var i=lo-1;i<=hi-1;i++){
          if(FIND_VIEW[i].noCheck){ skip++; continue; }
          FIND_SEL[FIND_VIEW[i].id]=1; n++;
        }
        render(null); selCount();
        fLog(lo+'〜'+hi+'番目のうち '+n+'名を'+(keep?'追加で':'')+'チェックしました'+(skip?('（外国籍の可能性がある '+skip+'名は対象外）'):''));
      }
      q('#fdRng').onclick=function(){ rngDo(parseInt(q('#fdRFrom').value,10)||0, parseInt(q('#fdRTo').value,10)||0, false); };
      q('#fdRngAdd').onclick=function(){ rngDo(parseInt(q('#fdRFrom').value,10)||0, parseInt(q('#fdRTo').value,10)||0, true); };
      q('#fdMid').onclick=function(){
        var N=FIND_VIEW.length, m=parseInt(q('#fdMidN').value,10)||0;
        if(!N){ fLog('先に取り込みと絞り込みを行ってください'); return; }
        if(m<=0){ fLog('件数を入力してください'); return; }
        if(m>N) m=N;
        var lo=Math.floor((N-m)/2)+1;
        q('#fdRFrom').value=lo; q('#fdRTo').value=lo+m-1;
        rngDo(lo, lo+m-1, false);
      };
      q('#fdHint').onclick=function(){
        var n=0;
        FIND_ROWS.forEach(function(r){ if(r.hint && FIND_SEL[r.id]){ delete FIND_SEL[r.id]; n++; } });
        render(null); selCount(); fLog('要確認 '+n+'名を選択から外しました');
      };
      q('#fdMark').onclick=function(){
        var ids=Object.keys(FIND_SEL);
        if(!ids.length){ fLog('選択されていません'); return; }
        var r=markOnPage(ids);
        fLog('このページのチェックに '+r.on+'名を反映しました'+(r.miss?('（'+r.miss+'名は別ページのため、検討人材リストへの登録をご利用ください）'):'')+'。一括送信タブへ切り替えて「開始」を押してください。');
      };
      if(q('#fdScreen')) q('#fdScreen').onclick=function(){
        if(mode!=='search'){ fLog('検索結果一覧のページでご利用ください'); return; }
        if(!FIND_ROWS.length){ fLog('先に取り込みと絞り込みを行ってください'); return; }
        var ids=FIND_ROWS.map(function(r){ return r.id; });
        var q2=new URLSearchParams(location.search);
        var pgMap2={}; FIND_ROWS.forEach(function(r){ if(r.pg) pgMap2[r.pg]=(pgMap2[r.pg]||0)+1; });
        var meta2={ total:(FIND_CTX&&FIND_CTX.total)||FIND_RAW.length, matched:ids.length, raw:FIND_RAW.length, pgMap:pgMap2 };
        saveScreen({ids:ids, workId:q2.get('WorkID')||'', ts:Date.now(),
                    total:meta2.total, matched:meta2.matched, raw:meta2.raw, pgMap:pgMap2});
        var r=applyScreen(ids, meta2);
        fLog('画面に反映しました：このページの表示 '+r.shown+'名／非表示 '+r.hidden+'名。ページを移動しても同じ絞り込みがかかります');
      };
      if(q('#fdScreenOff')) q('#fdScreenOff').onclick=function(){ clearScreen(); fLog('画面の絞り込みを解除しました'); };
      if(q('#fdMarkShown')) q('#fdMarkShown').onclick=function(){
        if(mode!=='search'){ fLog('検索結果一覧のページでご利用ください'); return; }
        var noCk={}; FIND_ROWS.forEach(function(r){ if(r.noCheck) noCk[r.id]=1; });
        var vis=getRows().filter(function(row){ return row.style.display!=='none'; });
        var ids=vis.map(function(row){ return M.memberNo(row); }).filter(function(i){ return i && !noCk[i]; });
        if(!ids.length){ fLog('表示中の対象者がいません'); return; }
        ids.forEach(function(i){ FIND_SEL[i]=1; });
        var r=markOnPage(ids);
        render(null); selCount();
        fLog('表示中の '+r.on+'名にチェックを入れました。一括送信タブへ切り替えて「開始」を押してください');
      };
      q('#fdReg').onclick=async function(){
        var ids=Object.keys(FIND_SEL);
        if(!ids.length){ fLog('選択されていません'); return; }
        if(!confirm(ids.length+'名を検討人材リストに登録します。スカウト送信は行いません。よろしいですか？')) return;
        var cfg2=readCfg();
        var first=FIND_ROWS.filter(function(r){ return FIND_SEL[r.id]; })[0];
        var token=csrfToken();
        if(!token){ fLog('トークンが取得できませんでした。検索結果ページで実行してください'); return; }
        var wid=(FIND_CTX&&FIND_CTX.WorkID)||cfg2.workId;
        var n=await appendExamine(wid, first.PK, ids, token);
        fLog('検討人材リストへ '+n+'名を登録しました。検討人材リストの画面へ移動し、一括送信タブから送信してください');
      };
      q('#fdSave').onclick=function(){
        var cfg2=readCfg();
        if(!cfg2.name){ fLog('社名を入力してください'); return; }
        var all=findPresets(); all[cfg2.name]=cfg2; saveFindPresets(all); saveFindCur(cfg2);
        var sel=q('#fdPre');
        if(!qsa('option',sel).some(function(o){ return o.value===cfg2.name; })){
          var op=document.createElement('option'); op.textContent=cfg2.name; sel.appendChild(op);
        }
        sel.value=cfg2.name;
        fLog('プリセット「'+cfg2.name+'」を保存しました');
      };
      q('#fdDel').onclick=function(){
        var sel=q('#fdPre'); var k=sel.value; if(!k) return;
        if(!confirm('プリセット「'+k+'」を削除しますか？')) return;
        var all=findPresets(); delete all[k]; saveFindPresets(all);
        qsa('option',sel).forEach(function(o){ if(o.value===k) o.remove(); });
        fLog('プリセット「'+k+'」を削除しました');
      };
      q('#fdPre').onchange=function(e){
        var all=findPresets(); var v=all[e.target.value]; if(!v) return;
        saveFindCur(v);
        q('#fdName').value=v.name||'';
        q('#fdWid').value=v.workId||'';
        q('#fdCno').value=v.conditions||'';
        q('#fdKw').value=v.keywords||'';
        q('#fdNg').value=v.ngKeywords||'';
        q('#fdPw').value=v.priorityWish||'';
        q('#fdCa').value=v.commuteAddr||'';
        var fo=q('#fdForOn'); if(fo) fo.checked = ((v.forMode||FOR_MODES[3])!==FOR_MODES[0]);
        var ao=q('#fdAreaOn'); if(ao) ao.checked = (v.areaOnly!==false);
        qsa('#fdGroups input',wrap).forEach(function(c){ c.checked=(v.jobGroups||[]).indexOf(c.value)>-1; });
        drawCond();
        if(v.sex!=null){ setCondEverywhere({sex:v.sex, lo:v.ageMin, hi:v.ageMax}); }
        fLog('プリセット「'+v.name+'」を読み込みました（性別 '+(v.sex||'指定なし')+' ／ 年齢 '+(v.ageMin||0)+'〜'+(v.ageMax||99)+'）');
        if(FIND_RAW.length) applyAll(); else if(v.sex!=null) fireCond();
      };
      q('#fdS1').onclick=reportStep1;
      q('#fdS2').onclick=reportStep2;
      q('#fdS3').onclick=reportStep3;
    }, 0);
    return wrap;
  }

  /* ===== 起動 ===== */
  API.show=function(){ showPanel(); };
  API.mode=function(){ return mode; };
  function boot(){
    if(mode==='cond'){ runCondPending(); return; }   /* v4.6: 検索条件の変更ページ */
    if(!M) return;                       /* 対象外ページ */
    if(mode!=='apply' && !getRows().length){ return setTimeout(boot, 800); }
    buildPanel(); watchNative(); updateCount(); refreshPresetList();
    try{ var cs=loadCondStore(); if(cs) setCondEverywhere(cs); }catch(e){}
    restoreScreen();   /* v3.3: 保存しておいた画面の絞り込みをかけ直す */
    startHiddenWatch();
    try{ if(localStorage.getItem('enScoutAllCondScr')==='1' && (mode==='search'||mode==='folder'||mode==='rescout')) setTimeout(function(){ try{ fireCond(); }catch(e){} }, 400); }catch(e){}
    var titleEl=document.getElementById('ensbaTitle');
    if(titleEl) titleEl.textContent='エン転職 統合ツール v7.8｜'+M.label+'（'+currentPageNo()+'ページ目 / 表示 '+getRows().length+' 件）';
    setMinimized(loadMin());
    hidePanel();
    var last=loadLast();
    if(last){
      if(last.presetName){
        for(var pi=0;pi<presetSel.options.length;pi++){ if(presetSel.options[pi].value===last.presetName){ presetSel.selectedIndex=pi; break; } }
      }
      if(last.count && numIn) numIn.value=last.count;
      var set={}; (last.perks||[]).forEach(function(p){ set[p]=1; });
      qsa('.ensbaPerk', panel).forEach(function(cb){ cb.checked = !!set[cb.value]; });
    }
    var R=dailyRemaining(); var remEl=document.getElementById('ensbaRemain');
    if(remEl){ remEl.setAttribute('data-remain', (R!=null?String(R):'')); syncRemainSep(); }
    if(mode==='apply'){ booted=true; setStatus('応募管理ページです。抽出／レポートタブのSTEP3で応募者CSVを出力できます。'); return; }
    drawGuard();
    setStatus('テンプレート取得中…');
    function applyTplOpts(opts, why, fromCache){
      tplSel.innerHTML='';
      if(!opts.length){ tplSel.innerHTML='<option value="">（取得失敗）</option>'; setStatus('テンプレート取得に失敗しました（'+(why||'原因不明')+'）。「再取得」を押してください。'); booted=true; return; }
      opts.forEach(function(o){ var op=document.createElement('option'); op.value=o.value; op.textContent=o.text; tplSel.appendChild(op); });
      var restored=false;
      var lastT=loadLast();
      if(lastT && lastT.template!=null && lastT.template!==''){
        for(var k=0;k<tplSel.options.length;k++){ if(tplSel.options[k].value===lastT.template){ tplSel.selectedIndex=k; restored=true; break; } }
      }
      if(!restored){
        for(var i=0;i<tplSel.options.length;i++){ if(tplSel.options[i].value && tplSel.options[i].value!=='0'){ tplSel.selectedIndex=i; break; } }
      }
      booted=true; saveLast(); drawGuard();
      setStatus(fromCache ? why+'。「再取得」で最新を読み込めます。' : '準備OK。'+(restored?'前回の設定を復元しました。':'テンプレ/特典/件数を選んで「開始」。'));
    }
    reloadTemplates=function(){
      setStatus('テンプレート取得中…');
      tplSel.innerHTML='<option>読み込み中…</option>';
      loadTemplates(applyTplOpts);
    };
    loadTemplates(applyTplOpts);
  }
  boot();
})();