(() => {
  'use strict';
  if (!document.getElementById('finance-app')) return;

  // ==========================================
  // CONFIGURAÇÕES GLOBAIS
  // ==========================================
  const TOPIC_ID_PERFORMANCE = '36745'; 
  const TOPIC_ID_GRUPOS = '36766'; 
  const FIXED_GROUP = 'Professores';
  const DRAFT_STORAGE_KEY = 'FINANCAS_PROF_RASCUNHOS_V3';
  const LEADERSHIP_BASE_DAYS = 30;
  const LEADERSHIP_BASE_MEDALS = 65;
  const FORUM_POST_INTERVAL_MS = 15000;
  const FORUM_MAX_ATTEMPTS = 4;
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
    const signature = [payload.responsible, payload.cargo, payload.nicks, payload.medals, payload.periodText].map(normalize).join('|');
    if(state.drafts.some(i => i.signature === signature)){ toast('Esse lançamento já está no rascunho.', 'warning'); return false; }
    state.drafts.push({id:draftId(), signature, origin, createdAt:new Date().toISOString(), ...payload}); saveDrafts();
    toast(`${payload.cargo} adicionado à fila de envios.`, 'success'); return true;
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

  function performanceEntry(line){
    const statuses = /(CASO ESPECIAL|EXCELENTE|ÓTIMO|OTIMO|BOM|REGULAR|IRREGULAR|RUIM)/i, raw = line.trim(); if(!raw) return null;
    let nick = '', status = '';
    if(raw.includes('\t')){ const cols=raw.split('\t').map(clean); nick=cols[0]; for(let i=cols.length-1; i>=1; i--){ const m=cols[i].match(statuses); if(m){ status=m[1]; break; } } }
    else{ const m=raw.match(/(.*?)(CASO ESPECIAL|EXCELENTE|ÓTIMO|OTIMO|BOM|REGULAR|IRREGULAR|RUIM)/i); if(m){ nick=m[1]; status=m[2]; } }
    nick = clean(nick).replace(/[^a-zA-Z0-9_.:\-?!,]/g,''); return nick && status ? {nick, status:normalize(status)} : null;
  }

  function processPerformance(){
    const performance = clean($('prof-desempenho').value); if(!performance){ toast('Cole a consulta de desempenho.','warning'); return; }
    const active = new Set(extractActiveMembers($('prof-ativos').value)), groups = {positive:[], negative:[], special:[]};
    
    performance.split(/\r?\n/).forEach(line => {
        const entry = performanceEntry(line); if(!entry) return;
        if(active.size && !active.has(normalize(entry.nick))) return;
        if(['excelente','otimo','bom','regular'].includes(entry.status)) groups.positive.push(entry.nick);
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
  function syncLeaderDays(){ const days=leadershipDays(); if(days) document.querySelectorAll('.leader-days').forEach(i=>i.value=days); }
  
  function addLeaderRow(values={}){
    const row = document.createElement('tr'); row.className = 'leader-row';
    row.innerHTML = `<td><input class="leader-nick" type="text" placeholder="Nickname" value="${esc(values.nick||'')}"></td><td><input class="leader-role" type="text" placeholder="Ex.: Líder" value="${esc(values.role||'Líder')}"></td><td><input class="leader-days" type="number" min="1" max="366" value="${Number(values.days)||leadershipDays()||30}"></td><td><button class="remove-row" type="button" title="Remover"><i class="ti ti-trash"></i></button></td>`;
    row.querySelector('.remove-row').onclick = () => row.remove();
    $('leader-rows').append(row);
  }

  function calculateLeadership(){
    const data = requiredPostingData('lider'); if(!data) return;
    const entries = [];
    document.querySelectorAll('.leader-row').forEach(row => {
        const nick=clean(row.querySelector('.leader-nick').value), role=clean(row.querySelector('.leader-role').value)||'Líder', days=Math.max(0,Number(row.querySelector('.leader-days').value)||0);
        if(!nick||!days) return;
        entries.push({nick, role, days, medals:Math.round(days*LEADERSHIP_BASE_MEDALS/LEADERSHIP_BASE_DAYS)});
    });
    if(!entries.length){ toast('Preencha os dados de liderança.','warning'); return; }
    
    $('leader-results').innerHTML = entries.map((e, idx) => `
      <article class="leader-card"><header><div><h3>${esc(e.nick)}</h3><small>${esc(e.role)}</small></div><i class="ti ti-medal"></i></header>
      <strong class="medal-total">+${e.medals}</strong><p>${e.days} dia(s) × ${LEADERSHIP_BASE_MEDALS} ÷ ${LEADERSHIP_BASE_DAYS} = ${e.medals} medalhas</p>
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
      const ano = new Date().getFullYear(), inf = meses[mesNome];
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
              let html = `<div style="background: rgba(0,0,0,0.3); border-left: 4px solid #a855f7; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
                          <h4 style="color: #a855f7; margin-top: 0; margin-bottom: 15px;">${sub}</h4>`;
              chaves.forEach(qtd => {
                  const cor = qtd > 0 ? '#10b981' : '#ef4444';
                  html += `<div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px; margin-bottom: 10px;">
                              <div style="flex: 1; padding-right: 15px;">
                                  <span style="display: block; color: ${cor}; font-weight: bold; font-size: 0.85rem;">${qtd > 0 ? '+' : ''}${qtd} MEDALHAS</span>
                                  <span style="color: #ccc; font-family: monospace; font-size: 0.85rem;">${dados[qtd].join(' / ')}</span>
                              </div>
                              <button type="button" class="btn-nexus" style="background: ${cor}; color: white; border:none; padding:8px 15px; border-radius:8px; cursor:pointer;" onclick="window.addGrupoDraft('${sub}', ${qtd})">
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

  function draftCard(item, index){
    const nomeParaExibir = item.origin === 'grupos' ? `Grupo Interno (${item.cargo})` : item.cargo;
    return `<article class="draft-card ${Number(item.medals)<0?'negative':'positive'}">
      <header><div><h3>${index}. ${esc(nomeParaExibir)}</h3><p>Grupo: ${item.origin==='grupos'?'Grupos Internos':FIXED_GROUP}</p></div>
      <strong class="draft-medals">${Number(item.medals)>0?'+':''}${Number(item.medals)}</strong></header>
      <div class="draft-details"><span>Responsável <strong>${esc(item.responsible)}</strong></span><span>Período <strong>${esc(item.periodText)}</strong></span></div>
      <p class="draft-nicks">${esc(item.nicks)}</p>
      <div class="draft-actions">
        <button class="secondary-button preview-draft" type="button" data-id="${esc(item.id)}"><i class="ti ti-eye"></i> Visualizar</button>
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
    
    document.querySelectorAll('.remove-draft').forEach(b=>b.onclick=()=> { state.drafts=state.drafts.filter(i=>i.id!==b.dataset.id); saveDrafts(); toast('Removido.', 'success'); });
    document.querySelectorAll('.preview-draft').forEach(b=>b.onclick=()=> openPreview([b.dataset.id]));
  }

  function openPreview(ids=null){
    const selected = Array.isArray(ids) ? state.drafts.filter(i=>ids.includes(i.id)) : state.drafts; 
    if(!selected.length){ toast('Sem rascunhos.','warning'); return; }
    let position = 0;
    $('preview-list').innerHTML = groupedDrafts(selected).map(group => `<section class="preview-group"><header class="preview-group-header"><strong>${esc(group.label)}</strong><small>${group.items.length} ${group.items.length===1?'postagem separada':'postagens separadas'}</small></header>${group.items.map(item => {
      const nomeParaExibir = item.origin === 'grupos' ? `Grupo Interno (${item.cargo})` : item.cargo;
      return `<article class="preview-item"><header><h3>Postagem ${++position} · ${esc(nomeParaExibir)}</h3><span>${Number(item.medals)>0?'+':''}${Number(item.medals)} medalhas</span></header><pre>${esc(medalBBCode(item))}</pre></article>`;
    }).join('')}</section>`).join('');
    $('send-all-drafts').hidden = Array.isArray(ids); 
    $('preview-dialog').showModal();
  }

  // ENVIO PRO FÓRUM SOMENTE (Sem salvar no Firebase local)
  function wait(milliseconds){ return new Promise(resolve => setTimeout(resolve, milliseconds)); }

  function forumResponseError(html, finalUrl, topicID){
    const plain = clean(html).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/\s+/g,' ');
    if(/\/(login|login_register|connexion)/i.test(finalUrl) || /você deve estar conectado|you must be logged/i.test(plain)) return {message:'Sua sessão do fórum expirou.', retry:false};
    if(/flood|mensagem tão rapidamente|mensagem tao rapidamente|aguarde.+antes de enviar|esperar.+segundos|wait.+seconds/i.test(plain)) return {message:'O Forumeiros ativou a proteção entre postagens.', retry:true};
    if(/tópico bloqueado|topico bloqueado|não tem permissão|nao tem permissao|não pode responder|nao pode responder/i.test(plain)) return {message:'O tópico está bloqueado ou sua conta não tem permissão para responder.', retry:false};
    return null;
  }

  async function topicSnapshot(topicID){
    const response = await fetch(`/t${topicID}-?view=newest&_=${Date.now()}`, {credentials:'same-origin', cache:'no-store', redirect:'follow'});
    const html = await response.text();
    const rejected = forumResponseError(html, response.url, topicID);
    if(!response.ok) throw Object.assign(Error(`Não foi possível conferir o tópico ${topicID} (HTTP ${response.status}).`), {retry:false});
    if(rejected) throw Object.assign(Error(rejected.message), {retry:false});
    const ids = [];
    for(const pattern of [
      /\bid=["']p(\d+)["']/gi,
      /\bid=["']post[-_]?(\d+)["']/gi,
      /\bdata-post-id=["'](\d+)["']/gi,
      /\bname=["'](\d+)["']/gi,
      /\/p(\d+)(?:[-/?#]|$)/gi,
      /\/t\d+(?:p\d+)?-[^"'\s#]+#(\d+)/gi
    ]){
      let match;
      while((match = pattern.exec(html)) !== null) ids.push(Number(match[1]));
    }
    return {latestPostID:ids.length ? Math.max(...ids) : 0, html, finalUrl:response.url};
  }

  async function forumSubmit(item){
    const topicID = item.origin === 'grupos' ? TOPIC_ID_GRUPOS : TOPIC_ID_PERFORMANCE;
    const before = await topicSnapshot(topicID);
    let lastError = null;
    for(let attempt=1; attempt<=FORUM_MAX_ATTEMPTS; attempt++){
      const body = new URLSearchParams({t:topicID, message:medalBBCode(item), mode:'reply', post:'Enviar'});
      try{
        const response = await fetch('/post', {method:'POST', credentials:'same-origin', cache:'no-store', redirect:'follow', headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'}, body:body.toString()});
        const html = await response.text();
        if(!response.ok) throw Object.assign(Error(`O fórum respondeu com HTTP ${response.status}.`), {retry:response.status>=500||response.status===429});
        const rejected = forumResponseError(html, response.url, topicID);
        if(rejected) throw Object.assign(Error(rejected.message), {retry:rejected.retry});
        await wait(900);
        const after = await topicSnapshot(topicID);
        if(after.latestPostID > before.latestPostID) return {topicID, finalUrl:after.finalUrl, postID:after.latestPostID};
        throw Object.assign(Error(`O envio terminou, mas nenhuma nova postagem apareceu no tópico ${topicID}. O rascunho foi preservado para conferência.`), {retry:false});
      }catch(error){
        lastError = error;
        if(error.retry !== true || attempt === FORUM_MAX_ATTEMPTS) break;
        await wait(FORUM_POST_INTERVAL_MS);
      }
    }
    throw lastError || Error('O fórum não confirmou a postagem.');
  }

  async function sendAllDrafts(){
    if(state.posting||!state.drafts.length) return; 
    const button=$('send-all-drafts'), queue=groupedDrafts(state.drafts).flatMap(group=>group.items);
    state.posting=true; setBusy(button,true,`Enviando 0/${queue.length}…`); 
    let sent=0; const failed=[];

    try{
      for(let index=0; index<queue.length; index++){
          const item=queue[index];
          if(index>0){
            button.innerHTML = `<span class="button-loader"></span>Aguardando proteção do fórum · ${index}/${queue.length}`;
            await wait(FORUM_POST_INTERVAL_MS);
          }
          button.innerHTML = `<span class="button-loader"></span>Enviando ${index+1}/${queue.length} · ${esc(item.cargo)}…`;
          try{
          await forumSubmit(item);
          sent++; 
          state.drafts = state.drafts.filter(d => d.id !== item.id); 
          saveDrafts();
          }catch(error){
            console.error(`Falha ao publicar o rascunho ${item.id}:`,error);
            failed.push({item,error});
            toast(`${item.cargo}: ${error.message} O rascunho foi mantido.`, 'error');
          }
      }
      $('preview-dialog').close();
      if(!failed.length){
        toast(`Pronto! As ${sent} postagens foram confirmadas pelo fórum.`, 'success');
      }else{
        toast(`${sent} de ${queue.length} postagens confirmadas. ${failed.length} permaneceram nos rascunhos para nova tentativa.`, 'warning');
      }
    }finally{
      state.posting=false; setBusy(button,false);
      renderDrafts();
    }
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
      ativos:valueOf('prof-ativos'),
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
      'prof-ativos':saved.ativos,
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
    const labels={lideranca:'Cálculo da Liderança',grupos:'Grupos Internos',rascunhos:'Rascunhos e envio'};
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
    click('send-all-drafts',sendAllDrafts);
    const dialog=$('preview-dialog');
    if(dialog) dialog.addEventListener('click',event=>{ if(event.target===dialog) dialog.close(); });
  }

  async function init(){
    try{
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
        'lider-inicio':toIsoDate(sunday),'lider-fim':toIsoDate(saturday)
      };
      Object.entries(values).forEach(([id,value])=>{ const input=$(id); if(input) input.value=value; });

      addLeaderRow();
      const initialView=location.hash.slice(1);
      const validInitialView=Boolean(PERFORMANCE_VIEWS[initialView]||['lideranca','grupos','rascunhos'].includes(initialView));
      navigate(validInitialView?initialView:'professores');
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
