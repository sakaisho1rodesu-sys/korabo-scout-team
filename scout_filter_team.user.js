// ==UserScript==
// @name         スカウト絞り込み 4媒体共通版 v6.9
// @namespace    co-llabo.scout-filter
// @version      6.9.0
// @updateURL    https://raw.githubusercontent.com/sakaisho1rodesu-sys/korabo-scout-team/main/scout_filter_team.user.js
// @downloadURL  https://raw.githubusercontent.com/sakaisho1rodesu-sys/korabo-scout-team/main/scout_filter_team.user.js
// @description  エン転職・エン転職ダイレクト・マイナビ転職・dodaダイレクトを1本のスクリプトでまかなう絞り込みツール。STEP1 条件を入れる → STEP2 絞り込む → STEP3 上から◯件にチェック、の3手だけで使えます。外国籍の要確認判定つき。候補者を選ぶところまでで、送信・登録・一覧からの削除は行いません。開いているサイトを見て、その媒体用の読み取りに自動で切り替わります。
// @author       こらぼ
// @match        https://employment.en-japan.com/company/scout/search_result_list/*
// @match        https://employment.en-japan.com/company/scout/folder_list/*
// @match        https://employment.en-japan.com/company/scout/scout_list/*
// @match        https://employment.en-japan.com/company/scout/search_condition_update/*
// @match        https://tenshoku.mynavi.jp/client/scout/index.cfm*
// @match        https://tenshoku.mynavi.jp/client/scoutcommunication/index.cfm*
// @match        *://assist.doda.jp/*
// @match        https://employment.en-japan.com/endirect/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function(){
  "use strict";
  if(window.__SCOUT_FILTER__){ console.warn('[スカウト絞り込み] すでに起動しています'); return; }
  window.__SCOUT_FILTER__='6.9';
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
    /* v6.5：応募者管理は一覧を扱わない画面。何も出さない */
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
  var VER='6.9';   /* build.py が差し込む */
  var LAST_KEY='scoutFilterCond_'+ADP.site;
  /* v6.9: エン転職では、前回の条件を会社ごとに分けて覚える（別の会社へログインし直したとき、前の会社の性別・年齢・プリセットを引きずらない）。
     社名は画面の「〇〇 管理者：」から読む。読めないとき・他の媒体では従来どおり媒体ごとに1つ。 */
  var _compKey='';
  function normComp(v){
    return String(v||'').replace(/[（(][^）)]*[)）]/g,'').replace(/株式会社|有限会社|合同会社|合資会社|㈱|㈲/g,'').replace(/[\s　・,、.。\-−ー_\/|]/g,'').toLowerCase();
  }
  function compKey(){
    if(ADP.site!=='en') return '';
    if(!_compKey){
      try{
        var t=((document.body.innerText||document.body.textContent||'')+'').replace(/\s+/g,' ');
        var m=t.match(/([^\s]{2,30}?)\s*管理者\s*[：:]/);
        _compKey=m?normComp(m[1]):'';
      }catch(e){ _compKey=''; }
    }
    return _compKey;
  }
  function lastKey(){ var c=compKey(); return c?(LAST_KEY+'@'+c):LAST_KEY; }
  function presetForCompany(){
    var c=compKey(); if(!c) return '';
    var o=loadPresets();
    return Object.keys(o).sort().filter(function(n){ var b=normComp(n); return b.length>=2 && (c.indexOf(b)>-1 || b.indexOf(c)>-1); })[0]||'';
  }
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
    + '<div style="display:flex;flex-wrap:wrap;gap:4px 5px;align-items:center;white-space:nowrap;font-size:11px">'
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
      /* v6.4：停止中の表示は、候補者の一覧が出ている画面（検索結果）だけに出す。
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
      /* v6.5：dodaダイレクト／エン転職ダイレクトは、候補者一覧が出ている画面（検索結果）だけで表示する。
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
    try{ localStorage.setItem(lastKey(), JSON.stringify(c)); }catch(e){}
  }
  function loadLast(){
    try{
      var c=JSON.parse(localStorage.getItem(lastKey())||'null');
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
  /* 社名欄：ページ側のフォーカス制御・キー入力の横取りに負けないようにする */
  (function(){
    var inp=q('#sfPreName'); if(!inp) return;
    try{ inp.setAttribute('autocomplete','off'); inp.removeAttribute('disabled'); inp.removeAttribute('readonly'); }catch(e){}
    function keep(ev){ if(ev.target===inp) ev.stopImmediatePropagation(); }
    ['focusin','focusout','focus','blur','keydown','keypress','keyup','beforeinput','input','paste','compositionstart','compositionupdate','compositionend'].forEach(function(t){
      window.addEventListener(t, keep, true);
    });
    inp.addEventListener('mousedown', function(ev){
      ev.stopPropagation();
      setTimeout(function(){ if(document.activeElement!==inp){ try{ inp.focus(); }catch(e){} } }, 0);
    });
    inp.addEventListener('click', function(ev){ ev.stopPropagation(); });
  })();
  q('#sfPreSave').onclick=function(){
    var name=(q('#sfPreName').value||'').trim();
    /* 社名欄に入力できないとき（ページ側の入力制限など）は、入力ダイアログで名前を受け取る */
    if(!name){
      try{ name=(window.prompt('保存する名前（社名など）を入力してください。同じ名前は上書きします', '')||'').trim(); }catch(e){ name=''; }
      if(!name){ log('保存する名前を入れてください（社名など）','#c0392b'); return; }
      q('#sfPreName').value=maskOn()?'':name;
    }
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
    if(!c){
      /* v6.9: この会社で初めて開いたときは、社名に合うプリセットを自動で選ぶ */
      var nm0=''; try{ nm0=presetForCompany(); }catch(e){}
      if(nm0){
        setCond(loadPresets()[nm0]); drawPresets(nm0); q('#sfPreName').value=maskOn()?'':nm0;
        if(!quiet) log('社名に合わせてプリセット「'+dispName(nm0)+'」を選びました');
      }
      doRun(); return;
    }
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
    if(!/ctsm_listScoutTarget_form/.test(location.search)) return;
    var chk=new URLSearchParams(location.search).get('chkcd')||'default';
    var SEL_KEY='_mn_sel_'+chk;       /* 確認画面が読む「選んだ人」 */
    var PANEL_SEL_KEY='_mnx_sel_'+chk; /* 抽出パネルのチェック状態 */
    var MAX=100;
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
    function keep(r, c){
      if(r.jyo==='送信済') return false;
      if(r.age==null || r.age<0) return false;
      if(c.sex!=='指定なし' && r.sex && r.sex!==c.sex) return false;
      if(r.age<c.lo || r.age>c.hi) return false;
      if(c.scoutMax>=0 && r.scout>=0 && r.scout>c.scoutMax) return false;
      if(c.ng.length && c.ng.some(function(k){ return (r.text||'').indexOf(k)>-1; })) return false;
      return true;
    }
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
          +'<td style="padding:3px 6px;white-space:nowrap">'+esc(r.addr||'-')+'</td>'
          +'<td style="padding:3px 6px;text-align:right">'+(r.scout>=0?r.scout:'-')+'</td>'
          +'<td style="padding:3px 6px;font-size:11px">'+(r.flag?'<span style="background:#e8500e;color:#fff;border-radius:3px;padding:1px 6px">要確認 '+esc(r.hint)+'</span>':'')+'</td>'
          +'<td style="padding:3px 6px;text-align:center;color:#888">'+r.page+'P</td></tr>';
      }).join('');
      xp.querySelector('#_mnx_body').innerHTML=
        '<table style="width:100%;border-collapse:collapse;font-size:12px;user-select:none"><thead><tr style="background:#fff3e0;position:sticky;top:0">'
        +'<th></th><th style="text-align:left;padding:4px 6px">会員番号</th><th>年齢性別</th><th style="text-align:left">居住地</th><th>受信</th><th style="text-align:left">確認</th><th>頁</th></tr></thead><tbody>'+rows+'</tbody></table>';
      xCount();
    }
    function build(){
      if(xp) return;
      xp=document.createElement('div'); xp.id='_mnx_panel';
      xp.style.cssText='position:fixed;top:60px;right:16px;bottom:16px;width:640px;max-width:96vw;z-index:2147483000;background:#fff;border:2px solid #f57c00;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.25);display:none;flex-direction:column;font-family:sans-serif;color:#222';
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
        +'<span id="_mnx_status" style="font-size:10px;color:#555;flex:1;min-width:120px"></span>';
      host.parentNode.insertBefore(wrap, host);
      var btn=wrap.querySelector('#_mnx_btn'), re=wrap.querySelector('#_mnx_re'), st=wrap.querySelector('#_mnx_status');
      re.onclick=function(){
        if(!xList.length){ alert('先に「全ページから抽出」を実行してください'); return; }
        xRender(); xp.style.display='flex';
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
