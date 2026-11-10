(() => {
  'use strict';
  if (!document.getElementById('finance-app')) return;

  // ==========================================
  // CONFIGURAÇÕES GLOBAIS
  // ==========================================
  const COFRE_URL = 'https://www.policiarcc.com/h17-postagem-de-medalhas-af'; 
  const FIXED_GROUP = 'Professores';
  const DRAFT_STORAGE_KEY = 'FINANCAS_PROF_RASCUNHOS_V3';

  const LEADERSHIP_BASE_MEDALS = 65;


  const CARGO_CONFIG = Object.freeze({Professor:10, Coordenador:10, Graduador:25, Estagiário:15, Conselheiro:15});
  const PERFORMANCE_VIEWS = Object.freeze({
    professores:{cargo:'Professor', label:'Professores', display:'Professor(a)'},
    coordenadores:{cargo:'Coordenador', label:'Coordenadores', display:'Coordenador(a)'},
    graduadores:{cargo:'Graduador', label:'Graduadores', display:'Graduador(a)'},
    estagiarios:{cargo:'Estagiário', label:'Estagiários', display:'Estagiário(a)'},
    conselho:{cargo:'Conselheiro', label:'Conselho', display:'Conselheiro(a)'}
  });
  const DRAFT_GROUP_ORDER = Object.freeze([
    {key:'professores', label:'Professores'},
    {key:'coordenadores', label:'Coordenadores'},
    {key:'graduadores', label:'Graduadores'},
    {key:'estagiarios', label:'Estagiários'},
    {key:'conselho', label:'Conselho'},
    {key:'lideranca', label:'Liderança'},
    {key:'grupos-internos', label:'Grupos Internos'}
  ]);
  
  const state = { positive:[], negative:[], special:[], drafts:[], posting:false, gruposGlobais:{}, gruposTotais:[], activePerformanceView:null, performanceByView:{} };
  const $ = id => document.getElementById(id);
  const clean = value => String(value ?? '').trim();
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const normalize = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');

  function toast(message, type='info'){
    const labels={success:'Sucesso', error:'Erro', warning:'Atenção', info:'Informação'};
    const icons={success:'ti-circle-check', error:'ti-circle-x', warning:'ti-alert-triangle', info:'ti-info-circle'};
    const element = document.createElement('div'); element.className = 'toast'; element.dataset.type = type;
    element.innerHTML = `<i class="ti ${icons[type]||icons.info}"></i><div><strong>${labels[type]||labels.info}</strong><span>${esc(message)}</span></div>`;
    $('toast-container').append(element); setTimeout(() => element.remove(), type==='error'?7000:4800);
  }

  function setBusy(button, on, label='Enviando…'){
    if(!button) return;
    if(on){ button.dataset.original = button.innerHTML; button.disabled = true; button.innerHTML = `<span class="button-loader"></span>${esc(label)}`; }
    else{ button.disabled = false; if(button.dataset.original) button.innerHTML = button.dataset.original; delete button.dataset.original; }
  }

  // ==========================================
  // IDENTIFICAÇÃO NO FÓRUM
  // ==========================================
  function validNick(value){ const nick=clean(value); return nick&&!['convidado','guest','anonymous','anônimo','anonimo'].includes(normalize(nick)) ? nick : ''; }
  function decodeForumValue(value){ const decoded=clean(value).replace(/\\x([0-9a-f]{2})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16))).replace(/\\u([0-9a-f]{4})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16))).replace(/\\(['"\\])/g,'$1'); const area=document.createElement('textarea'); area.innerHTML=decoded; return validNick(area.value); }

  async function forumNick(){
    const data = window._userdata||{}, direct = validNick(data.username);
    if(direct && Number(data.session_logged_in)!==0 && Number(data.user_id)!==-1) return direct;
    try{
      const response = await fetch('/',{credentials:'same-origin',cache:'no-store'}); if(!response.ok) throw Error(`HTTP ${response.status}`);
      const html = await response.text();
      const patterns = [/_userdata\s*\[\s*['"]username['"]\s*\]\s*=\s*['"]([^'"]+)['"]/i, /_userdata\.username\s*=\s*['"]([^'"]+)['"]/i, /["']username["']\s*:\s*["']([^"']+)["']/i];
      for(const pattern of patterns){ const match=html.match(pattern), nick=match?decodeForumValue(match[1]):''; if(nick) return nick; }
    }catch(error){ console.warn('Usuário do fórum não identificado:',error); }
    return '';
  }

  // ==========================================
  // UTILITÁRIOS DE DATA E RASCUNHOS
  // ==========================================
  function toIsoDate(date){ const pad=v=>String(v).padStart(2,'0'); return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`; }
  function parseIso(value){ const parts=clean(value).split('-').map(Number); return parts.length===3&&parts.every(Number.isFinite) ? new Date(parts[0],parts[1]-1,parts[2],12) : null; }
  function inclusiveDays(startValue, endValue){ const start=parseIso(startValue), end=parseIso(endValue); if(!start||!end||end<start) return 0; return Math.floor((end-start)/86400000)+1; }
  function formatForumDate(value){ const date=parseIso(value); if(!date) return ''; const months=['Jan.','Fev.','Mar.','Abr.','Mai.','Jun.','Jul.','Ago.','Set.','Out.','Nov.','Dez.']; return `${String(date.getDate()).padStart(2,'0')} ${months[date.getMonth()]} ${date.getFullYear()}`; }
  function period(start, end){ return `${formatForumDate(start)} até ${formatForumDate(end)}`; }

  function draftId(){ return typeof crypto!=='undefined'&&crypto.randomUUID ? crypto.randomUUID() : `rascunho_${Date.now()}_${Math.random().toString(36).slice(2,9)}`; }
  function loadDrafts(){ try{ const parsed=JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY)||'[]'); state.drafts=Array.isArray(parsed)?parsed.filter(i=>i&&i.id&&i.cargo&&i.nicks&&Number.isFinite(Number(i.medals))):[]; }catch(_){ state.drafts=[]; } }
  function saveDrafts(){ localStorage.setItem(DRAFT_STORAGE_KEY,JSON.stringify(state.drafts)); renderDrafts(); }

  function addDraft(payload, origin){
    payload.motive = payload.motive || (payload.medals > 0 ? 'meta' : 'nao-meta');
    const signature = [payload.motive, origin, payload.responsible, payload.cargo, payload.nicks, payload.medals, payload.periodText].map(normalize).join('|');
    if(state.drafts.some(i => i.signature === signature)){ toast('Esse lançamento já está no rascunho.', 'warning'); return false; }
    state.drafts.push({id:draftId(), signature, origin, createdAt:new Date().toISOString(), ...payload}); saveDrafts();
    toast(`${payload.cargo} adicionado aos rascunhos para o cofre.`, 'success'); return true;
  }

  // ==========================================
  // ABA 1: DESEMPENHO DOS PROFESSORES
  // ==========================================
  function extractActiveMembers(text){
    const ranks = ['soldado','cabo','sargento','subtenente','tenente','capitão','major','coronel','general','vip','acionista','trainee','assessor','analista','supervisor','inspetor','coordenador','aspirante'];
    const members = [];
    clean(text).split(/\r?\n/).forEach(line => {
        const cols = line.trim().split('\t').map(clean); if(cols.length<2) return;
        const offset = /^-?[\d.]+$/.test(cols[0]) && cols.length>=3 ? 1 : 0;
        const nick = cols[offset], rank = normalize(cols[offset+1]);
        if(nick && ranks.some(i => rank.includes(normalize(i)))) members.push(nick.replace(/[^a-zA-Z0-9_.:\-?!,]/g,''));
    });
    return [...new Set(members.filter(Boolean).map(normalize))];
  }

  const MEMBERS_STORAGE_KEY = 'FINANCAS_MEMBROS_ATIVOS_V1';
  function setupMembersView(){
    if($('view-listagem'))return;
    const input=$('prof-ativos'), nav=document.querySelector('.sidebar-nav'), page=document.querySelector('.page');
    if(!input||!nav||!page)return;
    const section=document.createElement('section');section.id='view-listagem';section.className='view';section.hidden=true;
    section.innerHTML='<header class="hero"><div><p class="eyebrow">Primeiro passo</p><h1>Importar listagem.</h1><p>Cole a listagem completa do RCCSystem uma vez para usar em todos os cargos de desempenho.</p></div></header><section class="panel"><header class="panel-header"><h2>Membros ativos</h2></header><div id="members-import-fields"></div><p>A lista fica salva neste navegador. Substitua o conteúdo quando houver mudanças; apague para remover o filtro.</p><button class="primary-button" type="button" data-view="professores">Continuar para Professores</button></section>';
    page.prepend(section);
    $('members-import-fields').append(input.closest('label'));
    const status=$('active-members-status');if(status)$('members-import-fields').append(status);
    const button=document.createElement('button');button.className='nav-item';button.type='button';button.dataset.view='listagem';
    button.innerHTML='<i class="ti ti-users"></i><span>Importar listagem</span>';nav.prepend(button);
  }
  function sharedMembersStatus(saved=true){
    const input=$('prof-ativos'); if(!input) return;
    let status=$('active-members-status');
    if(!status){
      status=document.createElement('small'); status.id='active-members-status';
      status.setAttribute('aria-live','polite'); input.insertAdjacentElement('afterend',status);
    }
    const count=extractActiveMembers(input.value).length;
    status.textContent=clean(input.value)
      ? (count ? `${count} membros reconhecidos. Lista compartilhada entre todos os cargos de desempenho.` : 'Lista não reconhecida. Cole a listagem do RCCSystem com as colunas de nickname e patente.')
      : 'Sem lista: todos os membros da consulta serão considerados.';
    status.textContent+=saved ? ' Salvo automaticamente neste navegador.' : ' Não foi possível salvar neste navegador; a lista vale somente nesta página.';
  }
  function saveSharedMembers(){
    Object.values(state.performanceByView).forEach(saved=>{
      saved.positive=[];saved.negative=[];saved.special=[];
      saved.positivos='';saved.negativos='';saved.especiais='';
    });
    clearPerformanceResults();
    let saved=true;
    try{localStorage.setItem(MEMBERS_STORAGE_KEY,$('prof-ativos').value);}catch(_){saved=false;}
    sharedMembersStatus(saved);
  }
  function loadSharedMembers(){
    const input=$('prof-ativos'); if(!input) return;
    let saved=true;
    try{const value=localStorage.getItem(MEMBERS_STORAGE_KEY);if(value!==null)input.value=value;}catch(_){saved=false;}
    sharedMembersStatus(saved);
  }

  function performanceEntry(line){
    const statuses = /(CASO ESPECIAL|EXCELENTE|ÓTIMO|OTIMO|MELHOR|DESTAQUE|BOM|IRREGULAR|REGULAR|RUIM)/i, raw = line.trim(); if(!raw) return null;
    let nick = '', status = '';
    if(raw.includes('\t')){ const cols=raw.split('\t').map(clean); nick=cols[0]; for(let i=cols.length-1; i>=1; i--){ const m=cols[i].match(statuses); if(m){ status=m[1]; break; } } }
    else{ const m=raw.match(/(.*?)(CASO ESPECIAL|EXCELENTE|ÓTIMO|OTIMO|MELHOR|DESTAQUE|BOM|IRREGULAR|REGULAR|RUIM)/i); if(m){ nick=m[1]; status=m[2]; } }
    nick = clean(nick).replace(/[^a-zA-Z0-9_.:\-?!,]/g,''); return nick && status ? {nick, status:normalize(status)} : null;
  }

  function processPerformance(){
    const performance = clean($('prof-desempenho').value); if(!performance){ toast('Cole a consulta de desempenho.','warning'); return; }
    const active = new Set(extractActiveMembers($('prof-ativos').value)), groups = {positive:[], negative:[], special:[]};
    if(clean($('prof-ativos').value)&&!active.size){clearPerformanceResults();toast('A lista de ativos não foi reconhecida. Corrija a listagem antes de processar.','warning');return;}
    
    performance.split(/\r?\n/).forEach(line => {
        const entry = performanceEntry(line); if(!entry) return;
        if(active.size && !active.has(normalize(entry.nick))) return;
        if(['excelente','otimo','melhor','destaque','bom','regular'].includes(entry.status)) groups.positive.push(entry.nick);
        else if(['irregular','ruim'].includes(entry.status)) groups.negative.push(entry.nick);
        else if(entry.status==='caso especial') groups.special.push(entry.nick);
    });
    
    Object.keys(groups).forEach(key => state[key]=[...new Map(groups[key].map(n=>[normalize(n),n])).values()]);
    $('prof-positivos').value = state.positive.join(' / '); $('prof-negativos').value = state.negative.join(' / ');
    const specialOutput=$('prof-especiais'); if(specialOutput) specialOutput.value=state.special.join(' / ');
    $('post-prof-positivos').disabled = !state.positive.length; $('post-prof-negativos').disabled = !state.negative.length;
    toast(`Filtro concluído: ${state.positive.length} Positivos, ${state.negative.length} Negativos.`, 'success');
  }

  function requiredPostingData(prefix){
    const responsible=clean($(`${prefix}-responsavel`).value), start=$(`${prefix}-inicio`).value, end=$(`${prefix}-fim`).value;
    if(!responsible||!start||!end){ toast('Preencha responsável, data inicial e final no topo da página.','warning'); return null; }
    if(!inclusiveDays(start,end)){ toast('A data final deve ser igual ou posterior à inicial.','warning'); return null; }
    return {responsible, start, end, period:period(start,end)};
  }

  function addPerformanceDraft(type){
    const data = requiredPostingData('prof'); if(!data) return;
    const positive = type === 'positive', list = positive ? state.positive : state.negative;
    if(!list.length){ toast('Processe a consulta primeiro.','warning'); return; }
    const cargo = $('prof-cargo').value, base = CARGO_CONFIG[cargo], medals = positive ? base : -base;
    addDraft({responsible:data.responsible, cargo, nicks:list.join(' / '), medals, periodText:data.period, positive}, 'desempenho');
  }

  // ==========================================
  // ABA 2: LIDERANÇA
  // ==========================================
  function leadershipDays(){ return inclusiveDays($('lider-inicio').value, $('lider-fim').value); }
  function selectedMonthDays(){
    const start=parseIso($('lider-inicio').value);
    return start?new Date(start.getFullYear(),start.getMonth()+1,0).getDate():0;
  }
  function syncLeaderDays(){
    const days=leadershipDays(), monthDays=selectedMonthDays();
    document.querySelectorAll('.leader-days').forEach(i=>{if(days)i.value=days;if(monthDays)i.max=monthDays;});
    const chip=document.querySelector('.formula-chip');
    if(chip&&monthDays)chip.innerHTML=`<strong>${monthDays} dias</strong><span>Mês identificado automaticamente · ${LEADERSHIP_BASE_MEDALS} medalhas por mês completo.</span>`;
  }
  
  function addLeaderRow(values={}){
    const row = document.createElement('tr'); row.className = 'leader-row';
    row.innerHTML = `<td><input class="leader-nick" type="text" placeholder="Nickname" value="${esc(values.nick||'')}"></td><td><input class="leader-role" type="text" placeholder="Ex.: Líder" value="${esc(values.role||'Líder')}"></td><td><input class="leader-days" type="number" min="1" max="366" value="${Number(values.days)||leadershipDays()||30}"></td><td><button class="remove-row" type="button" title="Remover"><i class="ti ti-trash"></i></button></td>`;
    row.querySelector('.remove-row').onclick = () => row.remove();
    $('leader-rows').append(row);
    row.querySelector('.leader-days').max=selectedMonthDays()||31;
  }

  function calculateLeadership(){
    const data = requiredPostingData('lider'); if(!data) return;
    const start=parseIso(data.start), end=parseIso(data.end);
    if(start.getMonth()!==end.getMonth()||start.getFullYear()!==end.getFullYear()){toast('Selecione um único mês de referência para a liderança.','warning');return;}
    const monthDays=new Date(start.getFullYear(),start.getMonth()+1,0).getDate();
    const entries = [];let invalid=false;
    document.querySelectorAll('.leader-row').forEach(row => {
        const nick=clean(row.querySelector('.leader-nick').value), role=clean(row.querySelector('.leader-role').value)||'Líder', days=Number(row.querySelector('.leader-days').value);
        if(!nick) return;
        if(!Number.isFinite(days)||!Number.isInteger(days)||days<0||days>monthDays){invalid=true;return;}
        if(!days)return;
        entries.push({nick, role, days, medals:Math.round(days*LEADERSHIP_BASE_MEDALS/monthDays)});
    });
    if(invalid){toast(`Os dias ativos devem ser inteiros entre 0 e ${monthDays}.`,'warning');return;}
    if(!entries.length){ toast('Preencha os dados de liderança.','warning'); return; }
    
    $('leader-results').innerHTML = entries.map((e, idx) => `
      <article class="leader-card"><header><div><h3>${esc(e.nick)}</h3><small>${esc(e.role)}</small></div><i class="ti ti-medal"></i></header>
      <strong class="medal-total">+${e.medals}</strong><p>${e.days} dia(s) × ${LEADERSHIP_BASE_MEDALS} ÷ ${monthDays} = ${e.medals} medalhas</p>
      <button class="success-button draft-leader" type="button" data-index="${idx}"><i class="ti ti-notes"></i> Adicionar ao rascunho</button></article>`
    ).join('');
    
    document.querySelectorAll('.draft-leader').forEach(btn => btn.onclick = () => {
        const e = entries[Number(btn.dataset.index)];
        addDraft({responsible:data.responsible, cargo:e.role, nicks:e.nick, medals:e.medals, periodText:data.period, positive:true}, 'lideranca');
    });
    toast('Cálculo da liderança concluído.', 'success');
  }

  // ==========================================
  // ABA 3: GRUPOS INTERNOS
  // ==========================================
  function getMetaPeriodoMes(mesNome) {
      const meses = {'Janeiro':{m:0,'a':'Jan'}, 'Fevereiro':{m:1,'a':'Fev'}, 'Março':{m:2,'a':'Mar'}, 'Abril':{m:3,'a':'Abr'}, 'Maio':{m:4,'a':'Mai'}, 'Junho':{m:5,'a':'Jun'}, 'Julho':{m:6,'a':'Jul'}, 'Agosto':{m:7,'a':'Ago'}, 'Setembro':{m:8,'a':'Set'}, 'Outubro':{m:9,'a':'Out'}, 'Novembro':{m:10,'a':'Nov'}, 'Dezembro':{m:11,'a':'Dez'}};
      const ano = Number($('grupos-ano')?.value)||new Date().getFullYear(), inf = meses[mesNome];
      if(!inf) return `Mês de ${mesNome}`;
      const ud = new Date(ano, inf.m + 1, 0).getDate();
      return `01 ${inf.a} ${ano} até ${ud} ${inf.a} ${ano}`;
  }

  function extrairDadosGrupos(texto) {
      const linhas = texto.split('\n'), map = {};
      linhas.forEach(linha => {
          const col = linha.split('\t');
          if (col.length >= 2) {
              let nick = col[0].trim(), v = col[col.length-1].trim().replace(/[^0-9\-]/g,'');
              if (nick && nick.toUpperCase() !== "NICK" && v !== "") {
                  let qtd = parseInt(v);
                  if (qtd !== 0 && !isNaN(qtd)) {
                      let nn = normalize(nick);
                      if(!map[nn]) map[nn] = { nick, qtd: 0 };
                      map[nn].nick = nick;
                      map[nn].qtd += qtd;
                  }
              }
          }
      });
      return map;
  }

  function processarGruposInternos() {
      const resp = clean($('grupos-responsavel').value);
      if(!resp){ toast('Preencha o responsável no topo da página.','warning'); return; }

      const td = $('grupos-da').value, tc = $('grupos-cdc').value, ts = $('grupos-spp').value;
      if (!td && !tc && !ts) { toast("Cole os dados em pelo menos um subgrupo.", "warning"); return; }

      const originais = { 'DA': extrairDadosGrupos(td), 'CDC': extrairDadosGrupos(tc), 'SPP': extrairDadosGrupos(ts) };
      const subgrupos = Object.keys(originais), membrosGlobais = {}, ajustados = Object.fromEntries(subgrupos.map(sub => [sub, {}]));

      subgrupos.forEach(sub => {
          Object.entries(originais[sub]).forEach(([nn, reg]) => {
              if(!membrosGlobais[nn]) membrosGlobais[nn] = {nick:reg.nick, valores:{DA:0, CDC:0, SPP:0}};
              membrosGlobais[nn].nick = reg.nick;
              membrosGlobais[nn].valores[sub] += reg.qtd;
          });
      });

      state.gruposTotais = Object.entries(membrosGlobais).map(([nn, membro]) => {
          const valoresOriginais = {...membro.valores};
          const positivos = subgrupos.filter(sub => valoresOriginais[sub] > 0);
          const quantidadeGrupos = positivos.length;
          const tetoPorGrupo = quantidadeGrupos >= 3 ? 10 : (quantidadeGrupos === 2 ? 15 : 20);
          const totalAcumulado = subgrupos.reduce((total, sub) => total + valoresOriginais[sub], 0);
          const valoresAjustados = {...valoresOriginais};

          positivos.forEach(sub => {
              valoresAjustados[sub] = totalAcumulado >= 25
                  ? tetoPorGrupo
                  : Math.min(valoresOriginais[sub], tetoPorGrupo);
          });

          const totalReceber = subgrupos.reduce((total, sub) => total + valoresAjustados[sub], 0);
          subgrupos.forEach(sub => {
              const qtd = valoresAjustados[sub];
              if(qtd === 0) return;
              if(!ajustados[sub][qtd]) ajustados[sub][qtd] = [];
              ajustados[sub][qtd].push(membro.nick);
          });

          return {normalizado:nn, nick:membro.nick, totalAcumulado, totalReceber, valoresOriginais, valoresAjustados};
      }).sort((a,b) => b.totalReceber - a.totalReceber || a.nick.localeCompare(b.nick, 'pt-BR'));

      state.gruposGlobais = ajustados;
      const c = $('grupos-results-container'); c.innerHTML = '';
      const totais = $('grupos-total-container');
      if(totais){
          totais.innerHTML = state.gruposTotais.length ? `<div class="table-wrap"><table class="leader-table grupos-total-table"><thead><tr><th>Nick</th><th>DA</th><th>CDC</th><th>SPP</th><th>Acumulado</th><th>A receber</th></tr></thead><tbody>${state.gruposTotais.map(membro => `<tr><td><strong>${esc(membro.nick)}</strong></td><td>${membro.valoresAjustados.DA > 0 ? '+' : ''}${membro.valoresAjustados.DA}</td><td>${membro.valoresAjustados.CDC > 0 ? '+' : ''}${membro.valoresAjustados.CDC}</td><td>${membro.valoresAjustados.SPP > 0 ? '+' : ''}${membro.valoresAjustados.SPP}</td><td>${membro.totalAcumulado}</td><td><strong class="${membro.totalReceber < 0 ? 'total-negative' : 'total-positive'}">${membro.totalReceber > 0 ? '+' : ''}${membro.totalReceber}${membro.totalReceber === 30 ? '*' : ''}</strong></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><h3>Nenhum membro processado</h3></div>';
      }
      let gerou = false;

      Object.entries(ajustados).forEach(([sub, dados]) => {
          const chaves = Object.keys(dados).map(Number).sort((a,b) => b - a);
          if (chaves.length > 0) {
              gerou = true;
              let html = `<div class="finance-subgroup">
                          <h4 class="finance-subgroup-title">${sub}</h4>`;
              chaves.forEach(qtd => {
                  const cor = qtd > 0 ? '#10b981' : '#ef4444';
                  html += `<div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px; margin-bottom: 10px;">
                              <div style="flex: 1; padding-right: 15px;">
                                  <span style="display: block; color: ${cor}; font-weight: bold; font-size: 0.85rem;">${qtd > 0 ? '+' : ''}${qtd} MEDALHAS</span>
                                  <span class="finance-subgroup-nicks">${dados[qtd].join(' / ')}</span>
                              </div>
                              <button type="button" class="secondary-button" onclick="window.addGrupoDraft('${sub}', ${qtd})">
                                  <i class="ti ti-notes"></i> Adicionar
                              </button>
                           </div>`;
              });
              html += `</div>`;
              c.innerHTML += html;
          }
      });
      if(!gerou) c.innerHTML = '<div class="empty"><h3>Nenhum membro processado</h3></div>';
      else toast('Medalhas agrupadas e calculadas com sucesso.', 'success');
  }

  window.addGrupoDraft = function(subgrupo, qtdMedalhas) {
      const resp = clean($('grupos-responsavel').value);
      const mes = $('grupos-mes').value;
      if(!resp){ toast("Preencha o responsável no topo antes de enviar.","error"); return; }
      
      const nicks = state.gruposGlobais[subgrupo][qtdMedalhas].join(' / ');
      const periodoStr = getMetaPeriodoMes(mes);

      addDraft({
          responsible: resp,
          cargo: subgrupo,
          nicks: nicks,
          medals: qtdMedalhas,
          periodText: periodoStr,
          positive: (qtdMedalhas > 0)
      }, 'grupos');
  }


  // ==========================================
  // ABA 4: RASCUNHOS, BBCODE E DISPARO FINAL
  // ==========================================
  function medalBBCode(item){
    const color = item.medals > 0 ? 'green' : 'red';
    const formattedMedals = item.medals > 0 ? `+${item.medals}` : `${item.medals}`;

    if (item.origin === 'grupos') {
        const mapNomes = {
            'DA': 'Departamento de Aplicação - Professores',
            'CDC': 'Comissão de Desenvolvimento Cultural',
            'SPP': 'Serviço de Proteção dos Professores'
        };
        const nomeLongo = mapNomes[item.cargo] || item.cargo;

        return `[font=Poppins][color=#004d1a][b][size=17]✗ DADOS DO RESPONSÁVEL[/size][/b][/color]\n\n[b]Nickname:[/b] ${item.responsible}\n[b]Grupo de tarefas:[/b] ${nomeLongo}\n\n[color=#004d1a][b][size=17]✗ MEDALHAS ATRIBUÍDAS[/size][/b][/color]\n\n[b]Período de referência:[/b] ${item.periodText}\n[b]Policiais:[/b] ${item.nicks}\n[b]Número de medalhas:[/b] [color=${color}](${formattedMedals})[/color][/font]`;
    } 
    else {
        const motive = item.medals > 0 ? `Cumprimento de suas obrigações como ${item.cargo}.` : `Não cumprimento de suas obrigações como ${item.cargo}.`;
        
        return `[font=Poppins][color=#004d1a][b][size=17]✗ DADOS DO RESPONSÁVEL[/size][/b][/color]\n\n[b]Nickname:[/b] ${item.responsible}\n[b]Grupo de tarefas:[/b] Professores\n[b]Cargo referente:[/b] ${item.cargo}\n\n[color=#004d1a][b][size=17]✗ MEDALHAS ATRIBUÍDAS[/size][/b][/color]\n\n[b]Período de referência:[/b] ${item.periodText}\n[b]Policiais:[/b] ${item.nicks}\n[b]Número de medalhas:[/b] [color=${color}](${formattedMedals})[/color]\n\n[b]Motivo:[/b] ${motive}[/font]`;
    }
  }

  function draftGroupKey(item){
    if(item.origin === 'lideranca') return 'lideranca';
    if(item.origin === 'grupos') return 'grupos-internos';
    const cargo = normalize(item.cargo);
    if(cargo.includes('coordenador')) return 'coordenadores';
    if(cargo.includes('graduador')) return 'graduadores';
    if(cargo.includes('estagiario')) return 'estagiarios';
    if(cargo.includes('conselheiro') || cargo === 'conselho') return 'conselho';
    if(cargo.includes('lider') || cargo.includes('vice lider')) return 'lideranca';
    return 'professores';
  }

  function groupedDrafts(items){
    const groups = new Map(DRAFT_GROUP_ORDER.map(group => [group.key, []]));
    items.forEach(item => groups.get(draftGroupKey(item)).push(item));
    return DRAFT_GROUP_ORDER.map(group => ({...group, items:groups.get(group.key)})).filter(group => group.items.length);
  }

  function draftSignature(item){
    return [item.motive||'', item.origin, item.responsible, item.cargo, item.nicks, item.medals, item.periodText].map(normalize).join('|');
  }

  function draftNickList(value){
    const unique = new Map();
    clean(value).split(/\s*\/\s*|\r?\n/).map(clean).filter(Boolean).forEach(nick => unique.set(normalize(nick), nick));
    return [...unique.values()];
  }

  function validateGroupDraftLimit(candidate, editingID){
    if(candidate.origin !== 'grupos') return '';
    const totals = new Map();
    const items = state.drafts.filter(item => item.origin === 'grupos' && item.id !== editingID).concat(candidate);
    items.filter(item => item.periodText === candidate.periodText).forEach(item => {
      draftNickList(item.nicks).forEach(nick => {
        const key = normalize(nick);
        totals.set(key, {nick, total:(totals.get(key)?.total || 0) + Number(item.medals)});
      });
    });
    const exceeded = [...totals.values()].filter(member => member.total > 30);
    return exceeded.length ? `A alteração faria ${exceeded.map(member => `${member.nick} (+${member.total})`).join(', ')} ultrapassar o limite mensal de 30 medalhas.` : '';
  }

  function openDraftEditor(id){
    const item = state.drafts.find(draft => draft.id === id), dialog = $('edit-draft-dialog');
    if(!item || !dialog) return;
    $('edit-draft-id').value = item.id;
    $('edit-draft-responsible').value = item.responsible;
    $('edit-draft-cargo').value = item.cargo;
    $('edit-draft-period').value = item.periodText;
    $('edit-draft-medals').value = item.medals;
    $('edit-draft-nicks').value = item.nicks;
    $('edit-draft-motive').value=item.motive||(item.medals>0?'meta':'nao-meta');
    dialog.showModal();
  }

  function saveDraftEdit(event){
    event.preventDefault();
    const id = $('edit-draft-id').value, index = state.drafts.findIndex(item => item.id === id);
    if(index < 0) return;
    const old = state.drafts[index], medals = Number($('edit-draft-medals').value);
    const candidate = {
      ...old,
      motive:$('edit-draft-motive').value,
      responsible:clean($('edit-draft-responsible').value),
      cargo:clean($('edit-draft-cargo').value),
      periodText:clean($('edit-draft-period').value),
      medals,
      nicks:draftNickList($('edit-draft-nicks').value).join(' / '),
      positive:medals > 0
    };
    if(!candidate.responsible || !candidate.cargo || !candidate.periodText || !candidate.nicks || !Number.isInteger(medals) || medals === 0){
      toast('Preencha todos os campos e informe uma quantidade diferente de zero.', 'warning');
      return;
    }
    const fixed={rebaixamento:-50,saida:-50,expulsao:-100};
    if(fixed[candidate.motive])candidate.medals=fixed[candidate.motive];
    if(candidate.motive==='infracao')candidate.medals=-Math.abs(medals);
    if(candidate.motive==='meta'&&candidate.medals<1){toast('Cumprimento de meta exige valor positivo.','warning');return;}
    if(candidate.motive==='nao-meta')candidate.medals=-Math.abs(medals);
    candidate.positive=candidate.medals>0;
    if(candidate.motive==='meta' && candidate.origin === 'grupos' && medals > 20){
      toast('Em um único subgrupo, a quantidade positiva não pode ultrapassar 20 medalhas.', 'warning');
      return;
    }
    const limitError = candidate.motive==='meta'?validateGroupDraftLimit(candidate, id):'';
    if(limitError){ toast(limitError, 'error'); return; }
    candidate.signature = draftSignature(candidate);
    if(state.drafts.some(item => item.id !== id && item.signature === candidate.signature)){
      toast('Já existe um rascunho igual a este.', 'warning');
      return;
    }
    state.drafts[index] = candidate;
    saveDrafts();
    $('edit-draft-dialog').close();
    toast('Resumo atualizado com sucesso.', 'success');
  }

  function removeDraft(id, reopenPreview=false){
    const item = state.drafts.find(draft => draft.id === id);
    if(!item || !confirm(`Excluir o rascunho de ${item.cargo}?`)) return;
    state.drafts = state.drafts.filter(draft => draft.id !== id);
    saveDrafts();
    if(reopenPreview){
      const dialog = $('preview-dialog');
      if(dialog?.open) dialog.close();
      if(state.drafts.length) openPreview();
    }
    toast('Rascunho excluído.', 'success');
  }

  function draftCard(item, index){
    const nomeParaExibir = item.origin === 'grupos' ? `Grupo Interno (${item.cargo})` : item.cargo;
    return `<article class="draft-card ${Number(item.medals)<0?'negative':'positive'}">
      <header><div><h3>${index}. ${esc(nomeParaExibir)}</h3><p>Grupo: ${item.origin==='grupos'?'Grupos Internos':FIXED_GROUP}</p></div>
      <strong class="draft-medals">${Number(item.medals)>0?'+':''}${Number(item.medals)}</strong></header>
      <div class="draft-details"><span>Responsável <strong>${esc(item.responsible)}</strong></span><span>Período <strong>${esc(item.periodText)}</strong></span></div>
      <p class="cofre-help">Motivo: ${esc(MOTIVES[item.motive]||MOTIVES[item.medals>0?'meta':'nao-meta'])}${['nao-meta','rebaixamento','saida','expulsao'].includes(item.motive|| (item.medals>0?'meta':'nao-meta'))?' · Valor definido pelo formulário oficial':''}</p>
      <p class="draft-nicks">${esc(item.nicks)}</p>
      ${cofreActions(item)}<div class="draft-actions">
        <button class="secondary-button preview-draft" type="button" data-id="${esc(item.id)}"><i class="ti ti-eye"></i> Visualizar</button>
        <button class="secondary-button edit-draft" type="button" data-id="${esc(item.id)}"><i class="ti ti-pencil"></i> Editar</button>
        <button class="danger-button remove-draft" type="button" data-id="${esc(item.id)}"><i class="ti ti-trash"></i> Excluir</button>
      </div>
    </article>`;
  }

  function renderDrafts(){
    const count = state.drafts.length; 
    $('draft-nav-count').textContent = count; $('draft-hero-count').textContent = `${count} ${count===1?'rascunho':'rascunhos'}`; 
    $('review-drafts').disabled = !count; $('clear-drafts').disabled = !count;
    if(!count){ $('draft-grid').innerHTML='<div class="empty"><i class="ti ti-notes-off"></i><h3>Nenhum rascunho preparado</h3></div>'; return; }
    
    let position = 0;
    $('draft-grid').innerHTML = groupedDrafts(state.drafts).map(group => `<section class="draft-group" data-group="${group.key}"><header class="draft-group-header"><div><span>${esc(group.label)}</span><small>${group.items.length} ${group.items.length===1?'postagem':'postagens'}</small></div></header><div class="draft-group-items">${group.items.map(item => draftCard(item, ++position)).join('')}</div></section>`).join('');
    
    bindCofreActions($('draft-grid'));
    document.querySelectorAll('.remove-draft').forEach(b=>b.onclick=()=>removeDraft(b.dataset.id));
    document.querySelectorAll('.edit-draft').forEach(b=>b.onclick=()=>openDraftEditor(b.dataset.id));
    document.querySelectorAll('.preview-draft').forEach(b=>b.onclick=()=> openPreview([b.dataset.id]));
  }

  function openPreview(ids=null){
    const selected = Array.isArray(ids) ? state.drafts.filter(i=>ids.includes(i.id)) : state.drafts; 
    if(!selected.length){ toast('Sem rascunhos.','warning'); return; }
    let position = 0;
    $('preview-list').innerHTML = groupedDrafts(selected).map(group => `<section class="preview-group"><header class="preview-group-header"><strong>${esc(group.label)}</strong><small>${group.items.length} ${group.items.length===1?'postagem separada':'postagens separadas'}</small></header>${group.items.map(item => {
      const nomeParaExibir = item.origin === 'grupos' ? `Grupo Interno (${item.cargo})` : item.cargo;
      return `<article class="preview-item"><header><h3>Postagem ${++position} · ${esc(nomeParaExibir)}</h3><span>${Number(item.medals)>0?'+':''}${Number(item.medals)} medalhas</span></header><pre>${esc(`Grupo: ${FIXED_GROUP}\n${item.origin==='grupos'?'Subgrupo':'Cargo'}: ${item.cargo}\nMotivo: ${MOTIVES[item.motive]||MOTIVES[item.medals>0?'meta':'nao-meta']}\nPeríodo: ${item.periodText}\nResponsável: ${item.responsible}\nPoliciais: ${item.nicks}`)}</pre>${cofreActions(item)}<div class="preview-item-actions"><button class="secondary-button edit-preview-draft" type="button" data-id="${esc(item.id)}"><i class="ti ti-pencil"></i> Editar</button><button class="danger-button remove-preview-draft" type="button" data-id="${esc(item.id)}"><i class="ti ti-trash"></i> Excluir</button></div></article>`;
    }).join('')}</section>`).join('');
    $('send-all-drafts').hidden = true; 
    bindCofreActions($('preview-list'));
    $('preview-dialog').showModal();
    document.querySelectorAll('.edit-preview-draft').forEach(button => button.onclick=()=>{
      $('preview-dialog').close();
      openDraftEditor(button.dataset.id);
    });
    document.querySelectorAll('.remove-preview-draft').forEach(button => button.onclick=()=>removeDraft(button.dataset.id, !$('send-all-drafts').hidden));
  }

  const MOTIVES={meta:'Cumprimento de meta','nao-meta':'Não cumprimento de meta',rebaixamento:'Rebaixamento',saida:'Saída precoce',expulsao:'Expulsão',infracao:'Infração',correcao:'Correção de medalhas'};
  function officialLink(item){
    const motive=item.motive|| (item.medals>0?'meta':'nao-meta');
    if(!MOTIVES[motive])throw Error('Selecione um motivo válido.');
    if(!clean(item.cargo)||!clean(item.periodText)||!clean(item.nicks))throw Error('Complete cargo/subgrupo, período e policiais.');
    const value=Number(item.medals);if(!Number.isInteger(value)||value===0)throw Error('Informe medalhas inteiras diferentes de zero.');
    if(motive==='meta'&&value<0)throw Error('Cumprimento de meta exige valor positivo.');
    const url=new URL(COFRE_URL);
    const params={grupo:FIXED_GROUP,motivo:motive,periodo:item.periodText,policiais:draftNickList(item.nicks).join(' / '),responsavel:item.responsible};
    params[item.origin==='grupos'?'subgrupo':'cargo']=item.cargo;
    if(!['nao-meta','rebaixamento','saida','expulsao'].includes(motive))params.medalhas=String(motive==='infracao'?Math.abs(value):value);
    Object.entries(params).forEach(([key,value])=>{if(clean(value))url.searchParams.set(key,value);});return url.href;
  }
  function cofreActions(item){
    try{return `<div class="cofre-actions"><a class="primary-button open-cofre" data-id="${esc(item.id)}" href="${esc(officialLink(item))}" target="_blank" rel="noopener noreferrer">Abrir formulário do cofre</a><button type="button" class="secondary-button copy-cofre" data-id="${esc(item.id)}">Copiar link</button></div><small class="cofre-help">Confira os dados e conclua a postagem no formulário oficial. Abrir o link não envia nem apaga este rascunho.</small>`;}
    catch(error){return `<p class="cofre-help">${esc(error.message)} Edite este rascunho.</p>`;}
  }
  function bindCofreActions(container){
    container.querySelectorAll('.copy-cofre').forEach(button=>button.onclick=async()=>{
      const item=state.drafts.find(d=>d.id===button.dataset.id);if(!item)return;
      try{await navigator.clipboard.writeText(officialLink(item));toast('Link copiado.','success');}catch(error){toast('Não foi possível copiar. Use o botão Abrir formulário do cofre.','warning');}
    });
  }
  function setupOfficialFlow(){
    const yearBase=$('grupos-mes');if(yearBase&&!$('grupos-ano')){const label=document.createElement('label');label.className='field';label.innerHTML=`<span>Ano de referência</span><input id="grupos-ano" type="number" min="2000" max="2100" value="${new Date().getFullYear()}">`;yearBase.closest('label')?.after(label);}
    const form=$('edit-draft-form');if(form&&!$('edit-draft-motive')){const label=document.createElement('label');label.className='field';label.innerHTML='<span>Motivo da postagem</span><select id="edit-draft-motive">'+Object.entries(MOTIVES).map(([v,t])=>`<option value="${v}">${t}</option>`).join('')+'</select>';const target=form.querySelector('.edit-draft-fields')||form;target.append(label);}
    const send=$('send-all-drafts');if(send){send.hidden=true;send.disabled=true;}
    const review=$('review-drafts');if(review)review.textContent='Conferir formulários';
    const chip=document.querySelector('.formula-chip');if(chip)chip.innerHTML='<strong>65</strong><span>Base mensal atual · proporcional aos dias ativos no mês. Confira o limite do cargo no formulário oficial.</span>';
  }

  // ==========================================
  // NAVEGAÇÃO E BINDINGS
  // ==========================================
  function updateCargoUI(){ 
      const cargo = $('prof-cargo').value;
      let medals = CARGO_CONFIG[cargo];
      
      const lblPos = document.getElementById('positive-medal-label');
      const lblNeg = document.getElementById('negative-medal-label');
      if(lblPos) lblPos.textContent=`+${medals} medalhas`; 
      if(lblNeg) lblNeg.textContent=`-${medals} medalhas`; 
  }

  function clearPerformanceResults(){
    state.positive=[]; state.negative=[]; state.special=[];
    const fields={
      'prof-positivos':'',
      'prof-negativos':'',
      'prof-especiais':''
    };
    Object.entries(fields).forEach(([id,value])=>{ const field=$(id); if(field) field.value=value; });
    const positiveButton=$('post-prof-positivos'), negativeButton=$('post-prof-negativos');
    if(positiveButton) positiveButton.disabled=true;
    if(negativeButton) negativeButton.disabled=true;
  }

  function savePerformanceView(view){
    if(!view||!PERFORMANCE_VIEWS[view]) return;
    const valueOf=id=>{ const field=$(id); return field?field.value:''; };
    state.performanceByView[view]={
      desempenho:valueOf('prof-desempenho'),
      positivos:valueOf('prof-positivos'),
      negativos:valueOf('prof-negativos'),
      especiais:valueOf('prof-especiais'),
      positive:[...state.positive],
      negative:[...state.negative],
      special:[...state.special]
    };
  }

  function restorePerformanceView(view){
    const saved=state.performanceByView[view]||{ativos:'',desempenho:'',positivos:'',negativos:'',especiais:'',positive:[],negative:[],special:[]};
    const values={
      'prof-desempenho':saved.desempenho,
      'prof-positivos':saved.positivos,
      'prof-negativos':saved.negativos,
      'prof-especiais':saved.especiais
    };
    Object.entries(values).forEach(([id,value])=>{ const field=$(id); if(field) field.value=value||''; });
    state.positive=Array.isArray(saved.positive)?[...saved.positive]:[];
    state.negative=Array.isArray(saved.negative)?[...saved.negative]:[];
    state.special=Array.isArray(saved.special)?[...saved.special]:[];
    const positiveButton=$('post-prof-positivos'), negativeButton=$('post-prof-negativos');
    if(positiveButton) positiveButton.disabled=!state.positive.length;
    if(negativeButton) negativeButton.disabled=!state.negative.length;
  }

  function selectPerformanceView(view){
    const config=PERFORMANCE_VIEWS[view]; if(!config) return;
    if(state.activePerformanceView&&state.activePerformanceView!==view) savePerformanceView(state.activePerformanceView);
    const cargoSelect=$('prof-cargo');
    if(cargoSelect) cargoSelect.value=config.cargo;
    if(state.activePerformanceView!==view) restorePerformanceView(view);
    state.activePerformanceView=view;
    updateCargoUI();
    const title=$('performance-title'), description=$('performance-description'), chip=$('performance-chip');
    if(title) title.textContent=`Medalhas de ${config.label}.`;
    if(description) description.textContent=`Esta área gera exclusivamente as postagens referentes ao cargo de ${config.display}.`;
    if(chip) chip.textContent=config.display;
  }
  
  function navigate(view){
    const performance=PERFORMANCE_VIEWS[view];
    const target=$(performance?'view-professores':`view-${view}`);
    if(!target){ console.warn(`Aba não encontrada: ${view}`); return; }
    if(performance) selectPerformanceView(view);
    document.querySelectorAll('.view').forEach(section=>{ section.hidden=section!==target; });
    document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===view));
    const labels={listagem:'Importar listagem',lideranca:'Cálculo da Liderança',grupos:'Grupos Internos',rascunhos:'Rascunhos e envio'};
    const pageLabel=$('page-label'), selectedCargo=$('selected-cargo-label'), sidebar=$('sidebar'), stage=document.querySelector('.stage');
    if(pageLabel) pageLabel.textContent=performance?`Desempenho · ${performance.label}`:(labels[view]||'Central de Finanças');
    if(selectedCargo) selectedCargo.textContent=performance?performance.display:(view==='lideranca'?'Liderança':view==='grupos'?'Grupos Internos':'Todos os cargos');
    if(sidebar) sidebar.classList.remove('open');
    if(stage) stage.scrollTop=0;
    try{ history.replaceState(null,'',`#${view}`); }catch(_){}
  }

  function bind(){
    document.querySelectorAll('[data-view]').forEach(button=>{
      button.addEventListener('click',()=>navigate(button.dataset.view));
    });
    const click=(id,handler)=>{ const element=$(id); if(element) element.addEventListener('click',handler); };
    const change=(id,handler)=>{ const element=$(id); if(element) element.addEventListener('change',handler); };

    click('menu-button',()=>{ const sidebar=$('sidebar'); if(sidebar) sidebar.classList.toggle('open'); });
    click('sidebar-overlay',()=>{ const sidebar=$('sidebar'); if(sidebar) sidebar.classList.remove('open'); });
    click('theme-button',()=>{
      const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';
      document.documentElement.dataset.theme=theme;
      try{ localStorage.setItem('FINANCAS_THEME',theme); }catch(_){}
      const button=$('theme-button'), meta=document.querySelector('meta[name="theme-color"]');
      if(button) button.innerHTML=`<i class="ti ${theme==='dark'?'ti-sun':'ti-moon'}"></i>`;
      if(meta) meta.content=theme==='dark'?'#0f0512':'#821f88';
    });

    click('process-professores',processPerformance);
    const activeInput=$('prof-ativos');
    if(activeInput) activeInput.addEventListener('input',()=>saveSharedMembers());
    change('prof-cargo',updateCargoUI);
    click('post-prof-positivos',()=>addPerformanceDraft('positive'));
    click('post-prof-negativos',()=>addPerformanceDraft('negative'));

    click('add-leader',()=>addLeaderRow());
    click('calculate-leaders',calculateLeadership);
    change('lider-inicio',syncLeaderDays);
    change('lider-fim',syncLeaderDays);

    click('process-grupos',processarGruposInternos);

    click('review-drafts',()=>openPreview());
    click('clear-drafts',()=>{
      if(state.drafts.length&&confirm('Excluir todos os rascunhos salvos?')){
        state.drafts=[]; saveDrafts(); toast('Excluídos.','success');
      }
    });
    click('close-preview',()=>{ const dialog=$('preview-dialog'); if(dialog) dialog.close(); });
    click('cancel-preview',()=>{ const dialog=$('preview-dialog'); if(dialog) dialog.close(); });

    click('close-edit-draft',()=>{ const dialog=$('edit-draft-dialog'); if(dialog) dialog.close(); });
    click('cancel-edit-draft',()=>{ const dialog=$('edit-draft-dialog'); if(dialog) dialog.close(); });
    const editDraftForm=$('edit-draft-form'); if(editDraftForm) editDraftForm.addEventListener('submit',saveDraftEdit);
    const dialog=$('preview-dialog');
    if(dialog) dialog.addEventListener('click',event=>{ if(event.target===dialog) dialog.close(); });
  }

  async function init(){
    try{
      setupOfficialFlow();
      setupMembersView();
      loadSharedMembers();
      bind();
      loadDrafts();
      renderDrafts();
      updateCargoUI();

      const storedTheme=(()=>{ try{return localStorage.getItem('FINANCAS_THEME');}catch(_){return '';} })();
      const theme=storedTheme==='dark'?'dark':'light';
      document.documentElement.dataset.theme=theme;
      const themeButton=$('theme-button');
      if(themeButton) themeButton.innerHTML=`<i class="ti ${theme==='dark'?'ti-sun':'ti-moon'}"></i>`;

      const today=new Date(), day=today.getDay(), sunday=new Date(today);
      sunday.setDate(today.getDate()-day);
      const saturday=new Date(sunday); saturday.setDate(sunday.getDate()+6);
      const values={
        'prof-inicio':toIsoDate(sunday),'prof-fim':toIsoDate(saturday),
        'lider-inicio':toIsoDate(new Date(today.getFullYear(),today.getMonth(),1)),'lider-fim':toIsoDate(new Date(today.getFullYear(),today.getMonth()+1,0))
      };
      Object.entries(values).forEach(([id,value])=>{ const input=$(id); if(input) input.value=value; });

      addLeaderRow();
      syncLeaderDays();
      const initialView=location.hash.slice(1);
      const validInitialView=Boolean(PERFORMANCE_VIEWS[initialView]||['listagem','lideranca','grupos','rascunhos'].includes(initialView));
      navigate(extractActiveMembers($('prof-ativos').value).length&&validInitialView?initialView:'listagem');
    }catch(error){
      console.error('Falha ao preparar a Central de Finanças:',error);
      navigate('professores');
      toast(`A interface foi recuperada, mas um recurso não iniciou: ${error.message}`,'warning');
    }

    const currentNick=$('current-nick');
    if(currentNick) currentNick.textContent='Identificando...';

    const nick=await Promise.race([
      forumNick(),
      new Promise(resolve=>setTimeout(()=>resolve(''),8000))
    ]);
    if(nick){
      if(currentNick) currentNick.textContent=nick;
      ['prof-responsavel','lider-responsavel','grupos-responsavel'].forEach(id=>{ const input=$(id); if(input) input.value=nick; });
      const avatar=$('current-avatar');
      if(avatar) avatar.src=`https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(nick)}&direction=2&head_direction=3&gesture=sml&size=m&headonly=1`;
    }else{
      if(currentNick) currentNick.textContent='Preencha o responsável';
      toast('Não foi possível identificar o usuário automaticamente. Preencha o responsável antes de criar os rascunhos.','warning');
    }
  }

  init();
})();
