(function (root) {
  'use strict';

  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyDo4DagZchii1cPKFighZU5KAjppp98HJE', authDomain: 'nexusprof.firebaseapp.com',
    projectId: 'nexusprof', storageBucket: 'nexusprof.appspot.com', messagingSenderId: '268861178598',
    appId: '1:268861178598:web:9686b81bb003f9514fb127'
  };
  const CONFIG_PATH = 'nexus_config/pontos_internos';
  const DEFAULT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbw-aFf6jgeqFFdO9ZAxkg9gtwwU2ISOmZYNFuIj-kjQmmd6lIHEKhQ5_6r6rOQjsIlLqw/exec';
  const ROLES = ['estagiario', 'conselheiro', 'vice lider', 'lider'];
  const CATEGORY_NAMES = { A: '[A] OUVIDORIA', B: '[B] DESTAQUE', C: '[C] HIERARQUIA & METAS', D: '[D] DIVERSOS' };
  const POINT_TYPES = [
    ['A','PROJETO APROVADO NA OUVIDORIA'],['A','SUGESTÃO APROVADA NA OUVIDORIA'],['A','CORREÇÃO APROVADA NA OUVIDORIA'],
    ['A','PROJETO APROVADO EM GRUPO INTERNO'],['A','SUGESTÃO APROVADA EM GRUPO INTERNO'],['A','CORREÇÃO APROVADA EM GRUPO INTERNO'],
    ['B','DESTAQUE (PROFESSOR)'],['B','DESTAQUE (COORDENADOR)'],['B','DESTAQUE (GRADUADOR)'],['B','DESTAQUE (DA)'],
    ['C','PROMOÇÃO'],['C','META CUMPRIDA (PROFESSOR)'],['C','META CUMPRIDA (COORDENADOR)'],['C','META CUMPRIDA (GRADUADOR)'],['C','META CUMPRIDA (ESTAGIÁRIO)'],['C','PROMOÇÃO EM GRUPO INTERNO'],['C','META CUMPRIDA (GRUPO INTERNO)'],['C','REBAIXAMENTO'],['C','META NEGATIVA (PROFESSOR)'],['C','META NEGATIVA (COORDENADOR)'],['C','META NEGATIVA (GRADUADOR)'],['C','META NEGATIVA (ESTAGIÁRIO)'],['C','REBAIXAMENTO EM GRUPO INTERNO'],['C','META NEGATIVA (GRUPO INTERNO)'],
    ['D','MINISTRAÇÃO DE AULA GERAL'],['D','PRESENÇA EM REUNIÃO GERAL'],['D','PRESENÇA EM EVENTO INTERNO'],['D','QUEBRA DE RECORDE'],['D','ADVERTÊNCIA INTERNA'],['D','ADVERTÊNCIA EM GRUPO INTERNO'],['D','NOTIFICAÇÃO NA COMPANHIA'],['D','NOTIFICAÇÃO EM GRUPO INTERNO']
  ];
  const SOURCES = [
    { id:'professores', name:'Professores', kind:'paste', threshold:100, metaLabel:'META CUMPRIDA (PROFESSOR)', negativeLabel:'META NEGATIVA (PROFESSOR)', highlightLabel:'DESTAQUE (PROFESSOR)', highlightCount:2 },
    { id:'coordenadores', name:'Coordenadores', kind:'paste', threshold:100, metaLabel:'META CUMPRIDA (COORDENADOR)', negativeLabel:'META NEGATIVA (COORDENADOR)', highlightLabel:'DESTAQUE (COORDENADOR)', highlightCount:1 },
    { id:'graduadores', name:'Graduadores', kind:'paste', threshold:2, metaLabel:'META CUMPRIDA (GRADUADOR)', negativeLabel:'META NEGATIVA (GRADUADOR)', highlightLabel:'DESTAQUE (GRADUADOR)', highlightCount:1 },
    { id:'estagiarios', name:'Estagiários', kind:'paste', roleFilter:'estagi', metaLabel:'META CUMPRIDA (ESTAGIÁRIO)', negativeLabel:'META NEGATIVA (ESTAGIÁRIO)' },
    { id:'conselheiros', name:'Conselheiros', kind:'paste', roleFilter:'conselh', metaLabel:'META CUMPRIDA (GRUPO INTERNO)', negativeLabel:'META NEGATIVA (GRUPO INTERNO)' },
    { id:'da', name:'Dept. de Aplicação', kind:'paste', metaLabel:'META CUMPRIDA (GRUPO INTERNO)', negativeLabel:'META NEGATIVA (GRUPO INTERNO)', highlightLabel:'DESTAQUE (DA)', highlightCount:1 },
    { id:'cdc', name:'Comissão de Desen. Cultural', kind:'paste', metaLabel:'META CUMPRIDA (GRUPO INTERNO)', negativeLabel:'META NEGATIVA (GRUPO INTERNO)' },
    { id:'spp', name:'Serv. de Proteção dos Professores', kind:'paste', metaLabel:'META CUMPRIDA (GRUPO INTERNO)', negativeLabel:'META NEGATIVA (GRUPO INTERNO)' },
    { id:'propostas', name:'Propostas', kind:'proposals' }
  ];

  function plain(value) { return String(value == null ? '' : value).trim(); }
  function normalizeText(value) { return plain(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g,' '); }
  function normalizeNick(value) { return normalizeText(value); }
  function slug(value) { return normalizeText(value).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
  function splitNicks(value) { return plain(value).split(/\r?\n|\s+\/\s+/).map(plain).filter(Boolean); }
  function selectHighlights(rows, limit) { return rows.map((row,index)=>({...row,__index:index})).sort((a,b)=>(Number(b.score)||0)-(Number(a.score)||0)||a.__index-b.__index).slice(0,Math.max(0,limit)).map(({__index,...row})=>row); }
  function duplicateKey(entry) { return [entry.sourceId,entry.periodId,entry.category,normalizeText(entry.label),normalizeNick(entry.nick)].join('|'); }
  function approximateKey(entry) { return [entry.category,normalizeText(entry.label),normalizeNick(entry.nick)].join('|'); }
  function markDuplicates(candidates, history, sheetRows) {
    const exact = new Map((history||[]).flatMap(receipt=>(receipt.candidates||[]).map(item=>[duplicateKey(item),receipt])));
    const approx = new Set();
    (sheetRows||[]).forEach(row=>splitNicks(row.nicks||row[2]).forEach(nick=>approx.add(approximateKey({nick,category:row.category||categoryCode(row[3]),label:row.label||[row[4],row[5],row[6],row[7]].find(Boolean)}))));
    return (candidates||[]).map(item=>{ const receipt=exact.get(duplicateKey(item)); const kind=receipt?'exact':approx.has(approximateKey(item))?'possible':''; return {...item,duplicate:kind,duplicateReceipt:receipt||null,selected:kind?false:item.selected!==false}; });
  }
  function groupSelected(items) {
    const groups=new Map();
    (items||[]).filter(item=>item.selected).forEach(item=>{ const key=[item.category,normalizeText(item.label),plain(item.print)].join('|'); const group=groups.get(key)||{category:item.category,label:item.label,print:plain(item.print),nickList:[]}; if(!group.nickList.some(n=>normalizeNick(n)===normalizeNick(item.nick))) group.nickList.push(plain(item.nick)); groups.set(key,group); });
    return [...groups.values()].map(group=>({...group,nicks:group.nickList.join(' / ')}));
  }
  function parseCsv(text) {
    const rows=[]; let row=[],cell='',quoted=false; const input=String(text||'').replace(/^\uFEFF/,'');
    for(let i=0;i<input.length;i++){ const ch=input[i]; if(ch==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(ch===','&&!quoted){row.push(cell);cell='';}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&input[i+1]==='\n')i++;row.push(cell);if(row.some(v=>plain(v)))rows.push(row);row=[];cell='';}else cell+=ch; }
    row.push(cell); if(row.some(v=>plain(v)))rows.push(row); return rows;
  }
  function findHeader(rows, aliases) { for(let r=0;r<Math.min(rows.length,30);r++){ const norm=rows[r].map(normalizeText); const indexes={}; Object.entries(aliases).forEach(([key,names])=>{indexes[key]=norm.findIndex(v=>names.some(name=>v===normalizeText(name)||v.includes(normalizeText(name))));}); if(indexes.nick>=0&&(indexes.score>=0||indexes.status>=0))return {row:r,indexes}; } return null; }
  function parsePerformanceRows(rows, source, periodId) {
    const header=findHeader(rows,{nick:['nickname','nick','militar','membro','nome'],score:['pontuação','pontuacao','pontos','total'],status:['situação','situacao','status','resultado']});
    if(!header) throw new Error('A estrutura da fonte mudou: não encontrei as colunas de nick e desempenho.');
    const records=rows.slice(header.row+1).map((row,index)=>({nick:plain(row[header.indexes.nick]),score:Number(plain(row[header.indexes.score]).replace(',','.'))||0,status:normalizeText(row[header.indexes.status]),index})).filter(r=>r.nick&&!['nickname','nick','militar','membro','nome'].includes(normalizeText(r.nick)));
    if(!records.length) return [];
    const passed=records.filter(r=>r.status?/(cumpr|aprov|positivo|ating)/.test(r.status):r.score>=Number(source.threshold||1));
    const failed=records.filter(r=>r.status?/(nao cumpr|reprov|negativo|nao ating)/.test(r.status):r.score<Number(source.threshold||1));
    const candidates=[]; const base={sourceId:source.id,sourceName:source.name,periodId:periodId||'latest',category:'C'};
    passed.forEach(r=>candidates.push({...base,nick:r.nick,label:source.metaLabel,score:r.score}));
    failed.forEach(r=>candidates.push({...base,nick:r.nick,label:source.negativeLabel,score:r.score}));
    if(source.highlightLabel&&source.highlightCount) selectHighlights(passed,source.highlightCount).forEach(r=>candidates.push({...base,nick:r.nick,category:'B',label:source.highlightLabel,score:r.score,highlight:true}));
    return candidates;
  }
  const MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const MONTH_TOKENS={Janeiro:['jan','janeiro'],Fevereiro:['fev','fevereiro'],Março:['mar','marco'],Abril:['abr','abril'],Maio:['mai','maio'],Junho:['jun','junho'],Julho:['jul','julho'],Agosto:['ago','agosto'],Setembro:['set','setembro'],Outubro:['out','outubro'],Novembro:['nov','novembro'],Dezembro:['dez','dezembro']};
  function toNumber(value){const number=Number(plain(value).replace('%','').replace(',','.'));return Number.isFinite(number)?number:0;}
  function parsePerformanceWeeks(csv,source,month){
    const rows=parseCsv(csv),header=rows[0]||[],metrics=source.metrics||[];
    const starts=header.map((cell,index)=>({cell,index})).filter(({cell,index})=>/nick/i.test(cell)&&normalizeText(header[index+1])===normalizeText(metrics[0]));
    if(!starts.length)throw new Error(`A estrutura da fonte ${source.name} mudou: os blocos semanais não foram encontrados.`);
    const tokens=MONTH_TOKENS[month]||[];
    return starts.map(({cell,index},weekIndex)=>{
      const label=plain(cell.replace(/nick/gi,'').replace(/\s+/g,' '))||`Semana ${weekIndex+1}`;
      const entries=rows.slice(1).flatMap(row=>{const nick=plain(row[index]);if(!nick||normalizeText(nick)==='total')return[];const totalIndex=index+1+metrics.length,total=plain(row[totalIndex]);return[{nick,total,totalValue:toNumber(total),status:plain(row[totalIndex+1])||'Sem classificação',motivo:plain(row[totalIndex+2])}];});
      return{id:`${month}-${weekIndex}-${slug(label)}`,label,month,entries};
    }).filter(week=>week.entries.length>0&&(!tokens.length||tokens.some(token=>new RegExp(`\\b${token}\\b`,'i').test(normalizeText(week.label)))));
  }
  function dateFromCells(cells){const text=cells.map(plain).filter(Boolean).join(' ').replace(/\s+/g,' ');const match=text.match(/\d{1,2}\s+[A-Za-zÀ-ÿ.]+\s+\d{4}\s+(?:a|A)\s+\d{1,2}\s+(?:de\s+)?[A-Za-zÀ-ÿ.]+\s+\d{4}/);return match?match[0]:'';}
  function parseGroupWeeks(csv,source,month){
    const rows=parseCsv(csv),top=rows[0]||[],layout=source.layout||{},width=Number(layout.width)||6,starts=[];
    if(layout.spp){for(let start=1;start<top.length;start+=width){const label=dateFromCells(top.slice(start,start+width));if(label)starts.push({start,label});}}
    else top.forEach((cell,start)=>{const label=dateFromCells([cell]);if(label)starts.push({start,label});});
    if(!starts.length)throw new Error(`A estrutura da fonte ${source.name} mudou: as datas semanais não foram encontradas.`);
    const tokens=MONTH_TOKENS[month]||[];
    return starts.map(({start,label},weekIndex)=>{const headerRow=rows[1]||[],hasHeader=normalizeText(headerRow[start+Number(layout.nick||1)])==='nick',from=hasHeader?2:1;const entries=rows.slice(from).flatMap(row=>{const nick=plain(row[start+Number(layout.nick||1)]),status=plain(row[start+Number(layout.status||2)]),motivo=plain(row[start+Number(layout.motive||3)]);if(!nick||normalizeText(nick)==='nick'||!status)return[];return[{nick,status,motivo,totalValue:normalizeText(status).includes('destaque')?1:0}];});return{id:`${month}-${weekIndex}-${slug(label)}`,label,month,entries};}).filter(week=>week.entries.length>0&&(!tokens.length||tokens.some(token=>new RegExp(`\\b${token}\\b`,'i').test(normalizeText(week.label)))));
  }
  function candidatesFromWeek(week,source){
    const eligible=week.entries.filter(entry=>!normalizeText(entry.status).includes('caso especial'));
    const positiveStatus=entry=>/^(regular|excelente|otimo|destaque)\b/.test(normalizeText(entry.status));
    const negativeStatus=entry=>/^(irregular|negativ|reprov)/.test(normalizeText(entry.status));
    const statusBased=source.kind==='groupweekly'||source.kind==='paste';
    const passed=statusBased?eligible.filter(entry=>positiveStatus(entry)||(!negativeStatus(entry)&&plain(entry.total)&&entry.totalValue>=Number(source.threshold||1))):eligible.filter(entry=>entry.totalValue>=Number(source.threshold||1));
    const failed=statusBased?eligible.filter(entry=>negativeStatus(entry)||(!positiveStatus(entry)&&plain(entry.total)&&entry.totalValue<Number(source.threshold||1))):eligible.filter(entry=>entry.totalValue<Number(source.threshold||1));
    const base={sourceId:source.id,sourceName:source.name,periodId:week.id,periodLabel:week.label,category:'C'};const candidates=[];
    passed.forEach(entry=>candidates.push({...base,nick:entry.nick,label:source.metaLabel,score:entry.totalValue,status:entry.status}));
    failed.forEach(entry=>candidates.push({...base,nick:entry.nick,label:source.negativeLabel,score:entry.totalValue,status:entry.status}));
    if(source.highlightLabel&&source.highlightCount){const explicit=passed.filter(entry=>normalizeText(entry.status).includes('destaque'));selectHighlights(explicit.length?explicit:passed,source.highlightCount).forEach(entry=>candidates.push({...base,nick:entry.nick,category:'B',label:source.highlightLabel,score:entry.totalValue,status:entry.status,highlight:true}));}
    return candidates;
  }
  function parsePastedTable(text){return String(text||'').split(/\r?\n/).map(line=>line.split('\t').map(plain)).filter(row=>row.some(Boolean));}
  function parsePastedPerformance(text,source,periodId){
    const rows=parsePastedTable(text);if(!rows.length)throw new Error('Cole o desempenho copiado da planilha.');
    const headerIndex=rows.findIndex(row=>row.some(cell=>normalizeText(cell)==='nick'||normalizeText(cell)==='nickname'));
    if(headerIndex<0)throw new Error('Não encontrei a coluna NICK no conteúdo colado. Copie também a linha de cabeçalho.');
    const header=rows[headerIndex].map(normalizeText),nickIndex=header.findIndex(cell=>cell==='nick'||cell==='nickname'),statusIndex=header.findIndex(cell=>cell==='status'||cell==='situacao'),cargoIndex=header.findIndex(cell=>cell==='cargo'),totalIndex=header.findIndex(cell=>cell==='total'||cell.includes('total (%)')||cell==='%');
    if(nickIndex<0||statusIndex<0)throw new Error('O conteúdo precisa conter as colunas NICK e STATUS.');
    const entries=rows.slice(headerIndex+1).flatMap(row=>{const nick=plain(row[nickIndex]),status=plain(row[statusIndex]),cargo=cargoIndex>=0?plain(row[cargoIndex]):'',total=totalIndex>=0?plain(row[totalIndex]):'';if(!nick||!status)return[];if(source.roleFilter&&!normalizeText(cargo).includes(source.roleFilter))return[];return[{nick,status,cargo,total,totalValue:toNumber(total)}];});
    const week={id:periodId||new Date().toISOString().slice(0,10),label:periodId||'Colagem manual',entries};
    return candidatesFromWeek(week,{...source,kind:'paste'});
  }
  function verdictValue(value){const v=normalizeText(value);if(/aprov|favor|sim/.test(v))return 'approved';if(/reprov|contra|nao/.test(v))return 'rejected';return 'pending';}
  function evaluateProposal(proposal,votes,leaderNicks){const valid=(votes||[]).filter(v=>normalizeText(v.status)!=='rascunho'&&(plain(v.proposalId)===plain(proposal.id)||Number(v.order)===Number(proposal.order)));const leader=valid.find(v=>(leaderNicks||new Set()).has(normalizeNick(v.nick)));if(leader)return verdictValue(leader.verdict||leader.vote||leader.voto);let yes=0,no=0;valid.forEach(v=>verdictValue(v.verdict||v.vote||v.voto)==='approved'?yes++:verdictValue(v.verdict||v.vote||v.voto)==='rejected'?no++:0);return yes===no?'pending':yes>no?'approved':'rejected';}
  function proposalLabel(type,group){const t=normalizeText(type);const suffix=group?' EM GRUPO INTERNO':' NA OUVIDORIA';if(t.includes('sugest'))return 'SUGESTÃO APROVADA'+suffix;if(t.includes('corre'))return 'CORREÇÃO APROVADA'+suffix;return 'PROJETO APROVADO'+suffix;}
  function categoryCode(value){const match=plain(value).match(/\[([A-D])\]/i);return match?match[1].toUpperCase():plain(value).toUpperCase();}
  function removePointType(item){return {...item,active:false};}
  function toSheetRow(entry,now){const row=[now,entry.responsible,entry.nicks,CATEGORY_NAMES[entry.category],'','','','',plain(entry.print)];row[4+'ABCD'.indexOf(entry.category)]=entry.label;return row;}

  const api={normalizeNick,splitNicks,selectHighlights,duplicateKey,markDuplicates,groupSelected,parseCsv,parsePerformanceRows,parsePerformanceWeeks,parseGroupWeeks,parsePastedPerformance,candidatesFromWeek,evaluateProposal,proposalLabel,removePointType,toSheetRow,categoryCode,POINT_TYPES,SOURCES,CATEGORY_NAMES};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  if(!root.document) return;

  const ASSET_BASE = 'https://professoresdapmrcc.github.io/profassets/';
  function addStyle(href,id){if(document.getElementById(id))return;const link=document.createElement('link');link.id=id;link.rel='stylesheet';link.href=href;document.head.appendChild(link);}
  function loadScript(src){return new Promise((resolve,reject)=>{const found=[...document.scripts].find(x=>x.src===src);if(found){if(root.firebase)return resolve();found.addEventListener('load',resolve,{once:true});found.addEventListener('error',reject,{once:true});return;}const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(new Error(`Não foi possível carregar ${src}`));document.head.appendChild(script);});}
  function mountShell(){
    addStyle('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Poppins:wght@400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap','pi-fonts');
    addStyle('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css','pi-icons');
    addStyle(`${ASSET_BASE}pontosinternos.css`,'pi-styles');
    let rootNode=document.getElementById('pi-root');if(!rootNode){rootNode=document.createElement('div');rootNode.id='pi-root';document.body.appendChild(rootNode);}
    rootNode.innerHTML=`
      <div id="pi-app" class="pi-app">
        <header class="pi-header"><div><span class="pi-kicker">NEXUS PROF</span><h1>Central de Pontos Internos</h1><p>Importe, confira e envie os lançamentos para a planilha oficial.</p></div><div class="pi-user"><span id="pi-user-avatar">?</span><div><small>Responsável</small><strong id="pi-user-name">Carregando...</strong></div></div></header>
        <div id="pi-alert" class="pi-alert" hidden></div>
        <nav class="pi-tabs" aria-label="Áreas da Central"><button class="active" data-view="generate"><i class="fa-solid fa-wand-magic-sparkles"></i> Gerar</button><button data-view="manual"><i class="fa-solid fa-pen-to-square"></i> Manual</button><button data-view="history"><i class="fa-solid fa-clock-rotate-left"></i> Histórico</button><button data-view="settings"><i class="fa-solid fa-gear"></i> Configurações</button></nav>
        <main>
          <section class="pi-view active" data-panel="generate"><div class="pi-grid pi-grid-generate">
            <aside class="pi-card pi-source-card"><div class="pi-card-title"><div><span>01</span><h2>Origem</h2></div></div><label>Lista<select id="pi-source"></select></label><div id="pi-paste-fields"><label>Período do desempenho<input id="pi-period-text" type="text" placeholder="Ex.: 04 OUT 2026 A 10 OUT 2026"></label><label>Cole o desempenho<textarea id="pi-performance-paste" rows="12" placeholder="Copie a tabela incluindo os cabeçalhos NICK, STATUS e, quando existir, CARGO e TOTAL."></textarea></label><p class="pi-help">Cole diretamente da planilha. As colunas separadas por tabulação serão identificadas automaticamente.</p></div><div id="pi-proposal-mode" hidden><label>Lote de propostas<select id="pi-proposal-mode-select"><option value="latest">Último lote com backup</option><option value="partial">Resultado parcial da votação atual</option></select></label></div><button id="pi-generate" class="pi-primary"><i class="fa-solid fa-bolt"></i> Gerar prévia</button><p class="pi-help">A Central não calcula pontos: envia o rótulo exato e a própria planilha faz a conversão.</p></aside>
            <section class="pi-card pi-preview-card"><div class="pi-card-title pi-between"><div><span>02</span><h2>Conferência</h2></div><div class="pi-actions"><button id="pi-select-new" class="pi-quiet">Marcar novos</button><button id="pi-clear-selection" class="pi-quiet">Desmarcar</button></div></div><div id="pi-preview-empty" class="pi-empty"><i class="fa-solid fa-inbox"></i><strong>Nenhuma prévia gerada</strong><span>Escolha a fonte e clique em “Gerar prévia”.</span></div><div id="pi-preview" class="pi-preview"></div><div id="pi-submit-bar" class="pi-submit-bar" hidden><div><strong id="pi-selected-count">0 selecionados</strong><span id="pi-group-count">0 linhas serão criadas</span></div><button id="pi-submit" class="pi-primary"><i class="fa-solid fa-paper-plane"></i> Enviar à planilha</button></div></section>
          </div></section>
          <section class="pi-view" data-panel="manual"><div class="pi-card pi-form-card"><div class="pi-card-title"><div><span>+</span><h2>Novo lançamento manual</h2></div></div><div class="pi-form-grid"><label class="pi-span-2">Nicks<textarea id="pi-manual-nicks" rows="5" placeholder="Um por linha ou separados por / "></textarea><small>A grafia será preservada.</small></label><label>Categoria<select id="pi-manual-category"><option value="A">[A] OUVIDORIA</option><option value="B">[B] DESTAQUE</option><option value="C">[C] HIERARQUIA &amp; METAS</option><option value="D">[D] DIVERSOS</option></select></label><label>Tipo de ponto<select id="pi-manual-label"></select></label><label class="pi-span-2">Print (opcional)<input id="pi-manual-print" type="url" placeholder="https://..."></label></div><button id="pi-add-manual" class="pi-primary"><i class="fa-solid fa-plus"></i> Adicionar à prévia</button></div></section>
          <section class="pi-view" data-panel="history"><div class="pi-card"><div class="pi-card-title pi-between"><div><span><i class="fa-solid fa-clock"></i></span><h2>Histórico de envios</h2></div><button id="pi-refresh-history" class="pi-quiet">Atualizar</button></div><div id="pi-history" class="pi-list pi-empty">Nenhum envio registrado.</div></div></section>
          <section class="pi-view" data-panel="settings"><div class="pi-settings-grid">
            <div class="pi-card"><div class="pi-card-title"><div><span><i class="fa-solid fa-table-list"></i></span><h2>Tipos de ponto</h2></div></div><form id="pi-type-form" class="pi-inline-form"><input id="pi-type-id" type="hidden"><select id="pi-type-category"><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select><input id="pi-type-label" required placeholder="Nome exatamente como na planilha"><button class="pi-primary">Salvar</button></form><div id="pi-types" class="pi-list"></div></div>
            <div class="pi-card"><div class="pi-card-title"><div><span><i class="fa-solid fa-link"></i></span><h2>Integração</h2></div></div><form id="pi-integration-form" class="pi-stack"><label>URL do Apps Script<input id="pi-endpoint" type="url" placeholder="https://script.google.com/macros/s/.../exec"></label><label>Chave de acesso<input id="pi-access-key" type="password" autocomplete="off"></label><button class="pi-primary">Salvar integração</button></form></div>
            <div class="pi-card"><div class="pi-card-title"><div><span><i class="fa-solid fa-user-shield"></i></span><h2>Nicks avulsos</h2></div></div><form id="pi-extra-form" class="pi-inline-form"><input id="pi-extra-nick" required placeholder="Nickname"><button class="pi-primary">Adicionar</button></form><div id="pi-extra-list" class="pi-list"></div></div>
            <div class="pi-card"><div class="pi-card-title"><div><span><i class="fa-solid fa-database"></i></span><h2>Fontes</h2></div></div><p class="pi-help">As fontes oficiais já vêm cadastradas.</p><div id="pi-sources" class="pi-list"></div></div>
          </div></section>
        </main>
      </div><div id="pi-loading" class="pi-loading"><div class="pi-spinner"></div><strong>Preparando a Central...</strong></div>`;
  }
  async function loadDependencies(){if(root.firebase)return;await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js');await loadScript('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js');}

  const S={db:null,user:'',profile:null,types:[],sources:[],extras:[],candidates:[],history:[],sheetRows:[],loadedWeeks:[],loadedSource:'',config:{},busy:false};
  const $=id=>document.getElementById(id); const esc=v=>plain(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function alertUser(message,type=''){const el=$('pi-alert');el.textContent=message;el.className='pi-alert '+type;el.hidden=false;clearTimeout(alertUser.timer);alertUser.timer=setTimeout(()=>el.hidden=true,7000);}
  async function forumUser(){
    const fromPage=root._userdata&&root._userdata.username;
    if(root._userdata&&root._userdata.session_logged_in&&fromPage&&!/^(Anonymous|Convidado|Guest)$/i.test(fromPage))return plain(fromPage);
    if(!/(^|\.)policiarcc\.com$/i.test(location.hostname))throw new Error('Abra esta página dentro do Forumeiros para identificar sua conta.');
    const response=await fetch('/forum',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Não foi possível confirmar sua sessão no fórum.');
    const html=await response.text();
    const logged=html.match(/_userdata\s*\[\s*["']session_logged_in["']\s*\]\s*=\s*(\d)/i);
    const match=html.match(/_userdata\s*\[\s*["']username["']\s*\]\s*=\s*["']([^"']+)["']/i)||html.match(/_userdata\.username\s*=\s*["']([^"']+)["']/i);
    if(!logged||logged[1]!=='1'||!match||/^(Anonymous|Convidado|Guest)$/i.test(match[1]))throw new Error('Entre na sua conta do fórum para acessar a Central.');
    const decoder=document.createElement('textarea');decoder.innerHTML=match[1];return plain(decoder.value);
  }
  function profileNick(user){return plain(user.name||user.nick||user.nickname||user.usuario||user.username||user.nome);}
  async function loadProfile(){S.user=await forumUser();if(!S.user)throw new Error('Entre no fórum antes de abrir a Central.');const snap=await S.db.collection('users').get();const matches=snap.docs.map(d=>({id:d.id,...d.data()})).filter(u=>normalizeNick(profileNick(u))===normalizeNick(S.user));S.profile=matches.find(u=>normalizeText(u.status)==='ativo')||matches[0];if(!S.profile)throw new Error('Seu nickname não está cadastrado no Nexus.');const extras=await S.db.doc(CONFIG_PATH).collection('extra_nicks').get();S.extras=extras.docs.map(d=>({id:d.id,...d.data()}));const role=normalizeText(S.profile.cargo).replace(/-/g,' ');if(!ROLES.some(r=>role.includes(r))&&!S.extras.some(x=>x.active!==false&&normalizeNick(x.nick)===normalizeNick(S.user)))throw new Error(`O cargo ${plain(S.profile.cargo)||'não informado'} não possui acesso a esta Central.`);}
  async function seed(){const rootRef=S.db.doc(CONFIG_PATH),snap=await rootRef.get();if(!snap.exists)await rootRef.set({version:1,createdAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});const batch=S.db.batch();for(const [category,label] of POINT_TYPES){const ref=rootRef.collection('tipos').doc(`${category.toLowerCase()}-${slug(label)}`),current=await ref.get();if(!current.exists)batch.set(ref,{category,label,active:true,usageCount:0,seed:true});}for(const source of SOURCES){const ref=rootRef.collection('fontes').doc(source.id),current=await ref.get();if(!current.exists||current.data().seed===true)batch.set(ref,{...source,active:current.exists?current.data().active!==false:true,seed:true});}await batch.commit();}
  async function loadConfig(){const rootRef=S.db.doc(CONFIG_PATH);const [rootSnap,types,sources,extras]=await Promise.all([rootRef.get(),rootRef.collection('tipos').get(),rootRef.collection('fontes').get(),rootRef.collection('extra_nicks').get()]);S.config=rootSnap.exists?rootSnap.data():{};S.types=types.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>a.category.localeCompare(b.category)||a.label.localeCompare(b.label));const sourceMap=new Map(sources.docs.map(d=>[d.id,{id:d.id,...d.data()}]));S.sources=SOURCES.map(seedSource=>sourceMap.get(seedSource.id)||seedSource).filter(x=>x.active!==false);S.extras=extras.docs.map(d=>({id:d.id,...d.data()}));renderConfig();}
  async function audit(action,target,before,after){return S.db.doc(CONFIG_PATH).collection('auditoria').add({action,target,before:before||null,after:after||null,author:S.user,createdAt:firebase.firestore.FieldValue.serverTimestamp()});}
  function renderConfig(){
    $('pi-source').innerHTML=S.sources.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
    $('pi-types').innerHTML=S.types.map(x=>`<div class="pi-list-row"><div><strong>${esc(x.label)}</strong><small>Categoria ${x.category} · ${x.active===false?'Inativo':'Ativo'}</small></div><div class="pi-row-actions"><button class="pi-quiet" data-edit-type="${esc(x.id)}">Editar</button><button class="pi-quiet" data-toggle-type="${esc(x.id)}">${x.active===false?'Ativar':'Desativar'}</button></div></div>`).join('');
    $('pi-sources').innerHTML=S.sources.map(x=>`<div class="pi-list-row"><div><strong>${esc(x.name)}</strong><small>${esc(x.kind)}${x.sheetId?' · '+esc(x.sheetId):''}</small></div></div>`).join('');
    $('pi-extra-list').innerHTML=S.extras.length?S.extras.map(x=>`<div class="pi-list-row"><strong>${esc(x.nick)}</strong><button class="pi-quiet" data-remove-extra="${esc(x.id)}">Remover</button></div>`).join(''):'<p class="pi-help">Nenhum nick avulso cadastrado.</p>';
    $('pi-endpoint').value=plain(S.config.endpoint)||DEFAULT_ENDPOINT; $('pi-access-key').value=plain(S.config.accessKey); fillManualLabels();
  }
  function fillManualLabels(){const category=$('pi-manual-category').value;$('pi-manual-label').innerHTML=S.types.filter(x=>x.active!==false&&x.category===category).map(x=>`<option value="${esc(x.label)}">${esc(x.label)}</option>`).join('');}
  function csvUrl(source){return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(source.sheetId)}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(source.gid||0)}&_=${Date.now()}`;}
  function monthCandidates(){const result=[];const date=new Date();for(let offset=0;offset<12;offset++){const value=new Date(date.getFullYear(),date.getMonth()-offset,1);result.push({month:MONTHS[value.getMonth()],year:value.getFullYear()});}return result;}
  async function loadWeeklySource(source){
    for(const period of monthCandidates()){
      const url=`https://docs.google.com/spreadsheets/d/${encodeURIComponent(source.sheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(period.month)}&_=${Date.now()}`;
      const response=await fetch(url);if(!response.ok)continue;
      try{const csv=await response.text(),weeks=source.kind==='groupweekly'?parseGroupWeeks(csv,source,period.month):parsePerformanceWeeks(csv,source,period.month);if(weeks.length)return weeks.map(week=>({...week,year:period.year}));}catch(error){if(offsetIsCurrentStructureError(error))console.warn(error.message);}
    }
    return[];
  }
  function offsetIsCurrentStructureError(error){return /estrutura da fonte/i.test(String(error&&error.message));}
  async function loadProposals(mode){
    const proposalRoot=S.db.collection('nexus_config').doc('Propostas');
    const usersSnap=await S.db.collection('users').get();
    const leaders=new Set(usersSnap.docs.map(d=>d.data()).filter(user=>/(lider|admin)/.test(normalizeText(user.cargo))).map(user=>normalizeNick(profileNick(user))));
    let rawProposals=[],rawVotes=[],periodId='ciclo-atual';
    if(mode==='latest'){
      const backups=await S.db.collection('nexus_config').doc('backup_respostas').collection('historico').get();
      const ordered=backups.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>{const time=value=>value&&typeof value.toMillis==='function'?value.toMillis():Date.parse(value)||0;return time(b.timestamp||b.criadoEm)-time(a.timestamp||a.criadoEm)||plain(b.id).localeCompare(plain(a.id));});
      const latest=ordered[0];if(!latest)throw new Error('Nenhum lote de propostas com backup foi encontrado.');rawProposals=latest.propostas||[];rawVotes=latest.votos||[];periodId=plain(latest.nome_backup||latest.data_formatada||latest.id);
    }else{
      const [proposalsSnap,votesSnap]=await Promise.all([proposalRoot.collection('lista_propostas').get(),proposalRoot.collection('votos_conselho').get()]);rawProposals=proposalsSnap.docs.map(d=>({id:d.id,...d.data()}));rawVotes=votesSnap.docs.map(d=>({id:d.id,...d.data()}));
    }
    const votes=rawVotes.map((data,index)=>({id:plain(data.id)||String(index),...data,order:Number(data.Ordem??data.ordem)||0,nick:plain(data.Nick??data.nick),verdict:plain(data.Veredito??data.veredito)})).filter(v=>normalizeText(v.status)!=='rascunho');
    const proposals=rawProposals.map((data,index)=>({id:plain(data.id)||String(data.ordem??data.Ordem??index),...data,order:Number(data.ordem??data.Ordem)||Number(data.id)||0,autor:plain(data.autor??data.Autor),tipo:plain(data.tipo??data.Categoria)}));
    return proposals.flatMap(proposal=>evaluateProposal(proposal,votes,leaders)==='approved'?[{nick:proposal.autor,sourceId:'propostas',sourceName:'Propostas',periodId,category:'A',label:proposalLabel(proposal.tipo,proposal.grupoInterno),partial:mode==='partial'}]:[]).filter(item=>item.nick);
  }
  async function loadSheetRows(){const endpoint=plain(S.config.endpoint)||DEFAULT_ENDPOINT;try{const url=new URL(endpoint);url.searchParams.set('action','listRows');url.searchParams.set('accessKey',S.config.accessKey||'');const data=await fetch(url.toString()).then(r=>r.json());return data.ok?(data.rows||[]):[];}catch{return [];}}
  async function generate(){const source=S.sources.find(x=>x.id===$('pi-source').value);if(!source)return;setBusy(true);try{let candidates=[];if(source.kind==='proposals')candidates=await loadProposals($('pi-proposal-mode-select').value);else{const pasted=$('pi-performance-paste').value,period=plain($('pi-period-text').value)||dateFromCells([pasted]);if(!period)throw new Error('Informe o período do desempenho antes de gerar.');candidates=parsePastedPerformance(pasted,source,period);}S.sheetRows=await loadSheetRows();candidates=markDuplicates(candidates,S.history,S.sheetRows);S.candidates=candidates;renderPreview();if(!candidates.length)alertUser('Nenhum lançamento pontuável foi identificado. Casos especiais e cargos diferentes da lista são ignorados.');else alertUser(`${candidates.length} lançamentos encontrados para conferência.`,'success');}catch(error){S.candidates=[];renderPreview();alertUser(error.message||'Não foi possível interpretar o conteúdo colado.','error');}finally{setBusy(false);}}
  function renderPreview(){const target=$('pi-preview'),empty=$('pi-preview-empty'),bar=$('pi-submit-bar');empty.style.display=S.candidates.length?'none':'flex';target.innerHTML=S.candidates.map((x,i)=>`<label class="pi-candidate ${x.duplicate?'duplicate':''}"><input type="checkbox" data-candidate="${i}" ${x.selected?'checked':''}><div><strong>${esc(x.nick)}</strong><small>${esc(x.label)} · ${esc(x.sourceName||x.sourceId)} · ${esc(x.periodId)}</small>${x.duplicate?`<small>Já encontrado${x.duplicate==='exact'?' neste mesmo período e fonte':' na planilha atual'}.</small>`:''}</div><span class="pi-badge ${x.duplicate?'duplicate':'new'}">${x.duplicate?'Duplicado':'Novo'}</span></label>`).join('');bar.hidden=!S.candidates.length;updateCounts();}
  function updateCounts(){const selected=S.candidates.filter(x=>x.selected);$('pi-selected-count').textContent=`${selected.length} selecionado${selected.length===1?'':'s'}`;$('pi-group-count').textContent=`${groupSelected(selected).length} linha${groupSelected(selected).length===1?'':'s'} será${groupSelected(selected).length===1?'':'ão'} criada${groupSelected(selected).length===1?'':'s'}`;$('pi-submit').disabled=!selected.length||S.busy;}
  function addManual(){const nicks=splitNicks($('pi-manual-nicks').value),category=$('pi-manual-category').value,label=$('pi-manual-label').value,print=plain($('pi-manual-print').value);if(!nicks.length)return alertUser('Informe ao menos um nickname.','error');if(print&&!/^https:\/\//i.test(print))return alertUser('O print precisa ser um link HTTPS.','error');const period=new Date().toISOString().slice(0,10);const candidates=nicks.map(nick=>({nick,sourceId:'manual',sourceName:'Manual',periodId:period,category,label,print}));S.candidates=markDuplicates(candidates,S.history,S.sheetRows);showView('generate');renderPreview();alertUser('Lançamento manual adicionado à prévia.','success');}
  function uuid(){return root.crypto&&crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;}
  async function submit(){if(S.busy)return;const groups=groupSelected(S.candidates);if(!groups.length)return;const endpoint=plain(S.config.endpoint)||DEFAULT_ENDPOINT;let pending;try{pending=JSON.parse(localStorage.getItem('pi-pending')||'null');}catch{}if(!pending||JSON.stringify(pending.rows)!==JSON.stringify(groups))pending={requestId:uuid(),rows:groups};localStorage.setItem('pi-pending',JSON.stringify(pending));setBusy(true);try{const payload={action:'appendPoints',accessKey:S.config.accessKey||'',requestId:pending.requestId,responsible:S.user,rows:pending.rows};const result=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)}).then(r=>r.json());if(!result.ok)throw new Error(result.error||'A planilha recusou o lote.');const receipt={...result,author:S.user,sourceIds:[...new Set(S.candidates.filter(x=>x.selected).map(x=>x.sourceId))],candidates:S.candidates.filter(x=>x.selected),groups:pending.rows,createdAt:firebase.firestore.FieldValue.serverTimestamp()};await S.db.doc(CONFIG_PATH).collection('recibos').doc(pending.requestId).set(receipt);localStorage.removeItem('pi-pending');S.candidates=[];renderPreview();await loadHistory();alertUser(`Enviado para conferência na planilha. ${result.rowCount} linha(s), a partir da linha ${result.firstRow}.`,'success');}catch(error){alertUser(error.message||'Falha no envio. O mesmo lote será reutilizado na próxima tentativa.','error');}finally{setBusy(false);}}
  async function loadHistory(){const snap=await S.db.doc(CONFIG_PATH).collection('recibos').orderBy('createdAt','desc').limit(100).get();S.history=snap.docs.map(d=>({id:d.id,...d.data()}));$('pi-history').className='pi-list'+(S.history.length?'':' pi-empty');$('pi-history').innerHTML=S.history.length?S.history.map(x=>`<div class="pi-list-row"><div><strong>${esc(x.author||'—')}</strong><small>${(x.groups||[]).length} lançamento(s) · linhas ${x.firstRow||'—'}–${x.firstRow&&x.rowCount?x.firstRow+x.rowCount-1:'—'}</small></div><span class="pi-badge new">Enviado</span></div>`).join(''):'Nenhum envio registrado.';}
  function setBusy(value){S.busy=value;$('pi-generate').disabled=value;$('pi-submit').disabled=value||!S.candidates.some(x=>x.selected);}
  function showView(name){document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x.dataset.view===name));document.querySelectorAll('[data-panel]').forEach(x=>x.classList.toggle('active',x.dataset.panel===name));}
  function bind(){document.querySelectorAll('[data-view]').forEach(btn=>btn.onclick=()=>showView(btn.dataset.view));$('pi-source').onchange=()=>{const proposals=$('pi-source').value==='propostas';$('pi-proposal-mode').hidden=!proposals;$('pi-paste-fields').hidden=proposals;};$('pi-generate').onclick=generate;$('pi-preview').onchange=e=>{if(e.target.dataset.candidate!=null){S.candidates[Number(e.target.dataset.candidate)].selected=e.target.checked;updateCounts();}};$('pi-select-new').onclick=()=>{S.candidates.forEach(x=>x.selected=!x.duplicate);renderPreview();};$('pi-clear-selection').onclick=()=>{S.candidates.forEach(x=>x.selected=false);renderPreview();};$('pi-submit').onclick=submit;$('pi-manual-category').onchange=fillManualLabels;$('pi-add-manual').onclick=addManual;$('pi-refresh-history').onclick=loadHistory;
    $('pi-integration-form').onsubmit=async e=>{e.preventDefault();const before={...S.config};const after={endpoint:plain($('pi-endpoint').value),accessKey:plain($('pi-access-key').value),updatedBy:S.user,updatedAt:firebase.firestore.FieldValue.serverTimestamp()};await S.db.doc(CONFIG_PATH).set(after,{merge:true});await audit('save-integration','root',before,{endpoint:after.endpoint});await loadConfig();alertUser('Integração salva.','success');};
    $('pi-type-form').onsubmit=async e=>{e.preventDefault();const id=plain($('pi-type-id').value)||`${$('pi-type-category').value.toLowerCase()}-${slug($('pi-type-label').value)}`;const ref=S.db.doc(CONFIG_PATH).collection('tipos').doc(id),old=await ref.get(),after={category:$('pi-type-category').value,label:plain($('pi-type-label').value).toUpperCase(),active:true,updatedBy:S.user};await ref.set(after,{merge:true});await audit('save-type',id,old.exists?old.data():null,after);e.target.reset();await loadConfig();};
    $('pi-types').onclick=async e=>{const edit=e.target.dataset.editType,toggle=e.target.dataset.toggleType;if(edit){const x=S.types.find(v=>v.id===edit);$('pi-type-id').value=x.id;$('pi-type-category').value=x.category;$('pi-type-label').value=x.label;}if(toggle){const x=S.types.find(v=>v.id===toggle),after={...x,active:x.active===false};delete after.id;await S.db.doc(CONFIG_PATH).collection('tipos').doc(toggle).set(after,{merge:true});await audit('toggle-type',toggle,x,after);await loadConfig();}};
    $('pi-extra-form').onsubmit=async e=>{e.preventDefault();const nick=plain($('pi-extra-nick').value),id=slug(nick);if(!nick)return;await S.db.doc(CONFIG_PATH).collection('extra_nicks').doc(id).set({nick,active:true,updatedBy:S.user},{merge:true});await audit('add-extra',id,null,{nick});e.target.reset();await loadConfig();};$('pi-extra-list').onclick=async e=>{const id=e.target.dataset.removeExtra;if(!id)return;const x=S.extras.find(v=>v.id===id);await S.db.doc(CONFIG_PATH).collection('extra_nicks').doc(id).set({active:false,updatedBy:S.user},{merge:true});await audit('remove-extra',id,x,{...x,active:false});await loadConfig();};
  }
  async function init(){try{if(!firebase.apps.length)firebase.initializeApp(FIREBASE_CONFIG);S.db=firebase.firestore();if(!firebase.auth().currentUser)await firebase.auth().signInAnonymously();await loadProfile();$('pi-user-name').textContent=S.user;$('pi-user-avatar').textContent=S.user.slice(0,1).toUpperCase();await seed();await Promise.all([loadConfig(),loadHistory()]);bind();$('pi-source').dispatchEvent(new Event('change'));}catch(error){alertUser(error.message||'Não foi possível abrir a Central.','error');document.querySelector('main').innerHTML=`<div class="pi-card pi-empty"><i class="fa-solid fa-lock"></i><strong>Acesso indisponível</strong><span>${esc(error.message)}</span></div>`;}finally{$('pi-loading').classList.add('done');}}
  async function bootstrap(){mountShell();try{await loadDependencies();await init();}catch(error){const loading=document.getElementById('pi-loading');if(loading)loading.classList.add('done');const main=document.querySelector('main');if(main)main.innerHTML=`<div class="pi-card pi-empty"><i class="fa-solid fa-triangle-exclamation"></i><strong>Falha ao carregar</strong><span>${esc(error.message)}</span></div>`;}}
  root.PontosInternos=api;if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrap);else bootstrap();
})(typeof window!=='undefined'?window:globalThis);
