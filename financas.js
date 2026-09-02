(() => {
  'use strict';
  if (!document.getElementById('finance-app')) return;

  const TOPIC_ID = '36745';
  const TOPIC_URL = `/t${TOPIC_ID}-?view=newest`;
  const FIXED_GROUP = 'Professores';
  const DRAFT_STORAGE_KEY = 'FINANCAS_PROF_RASCUNHOS_V1';
  const LEADERSHIP_BASE_DAYS = 30;
  const LEADERSHIP_BASE_MEDALS = 65;
  const CARGO_CONFIG = Object.freeze({Professor:10,Coordenador:10,Graduador:25,Estagiário:15,Conselheiro:15});
  const state = {positive:[],negative:[],special:[],drafts:[],posting:false};
  const $ = id => document.getElementById(id);
  const clean = value => String(value ?? '').trim();
  const esc = value => String(value ?? '').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const normalize = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');

  function toast(message,type='info'){
    const labels={success:'Sucesso',error:'Erro',warning:'Atenção',info:'Informação'};
    const icons={success:'ti-circle-check',error:'ti-circle-x',warning:'ti-alert-triangle',info:'ti-info-circle'};
    const element=document.createElement('div');element.className='toast';element.dataset.type=type;
    element.innerHTML=`<i class="ti ${icons[type]||icons.info}"></i><div><strong>${labels[type]||labels.info}</strong><span>${esc(message)}</span></div>`;
    $('toast-container').append(element);setTimeout(()=>element.remove(),type==='error'?7000:4800);
  }

  function setBusy(button,on,label='Enviando…'){
    if(!button)return;
    if(on){button.dataset.original=button.innerHTML;button.disabled=true;button.innerHTML=`<span class="button-loader"></span>${esc(label)}`;}
    else{button.disabled=false;if(button.dataset.original)button.innerHTML=button.dataset.original;delete button.dataset.original;}
  }

  function validNick(value){const nick=clean(value);return nick&&!['convidado','guest','anonymous','anônimo','anonimo'].includes(normalize(nick))?nick:'';}
  function decodeForumValue(value){const decoded=clean(value).replace(/\\x([0-9a-f]{2})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16))).replace(/\\u([0-9a-f]{4})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16))).replace(/\\(['"\\])/g,'$1');const area=document.createElement('textarea');area.innerHTML=decoded;return validNick(area.value);}

  async function forumNick(){
    const data=window._userdata||{},direct=validNick(data.username);
    if(direct&&Number(data.session_logged_in)!==0&&Number(data.user_id)!==-1)return direct;
    try{
      const response=await fetch('/forum',{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw Error(`HTTP ${response.status}`);
      const html=await response.text();
      const patterns=[/_userdata\s*\[\s*['"]username['"]\s*\]\s*=\s*['"]([^'"]+)['"]/i,/_userdata\.username\s*=\s*['"]([^'"]+)['"]/i,/["']username["']\s*:\s*["']([^"']+)["']/i];
      for(const pattern of patterns){const match=html.match(pattern),nick=match?decodeForumValue(match[1]):'';if(nick)return nick;}
    }catch(error){console.warn('Usuário do fórum não identificado:',error);}
    return '';
  }

  function toIsoDate(date){const pad=value=>String(value).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;}
  function parseIso(value){const parts=clean(value).split('-').map(Number);return parts.length===3&&parts.every(Number.isFinite)?new Date(parts[0],parts[1]-1,parts[2],12):null;}
  function inclusiveDays(startValue,endValue){const start=parseIso(startValue),end=parseIso(endValue);if(!start||!end||end<start)return 0;return Math.floor((end-start)/86400000)+1;}
  function formatForumDate(value){const date=parseIso(value);if(!date)return '';const months=['Jan.','Fev.','Mar.','Abr.','Mai.','Jun.','Jul.','Ago.','Set.','Out.','Nov.','Dez.'];return `${String(date.getDate()).padStart(2,'0')} ${months[date.getMonth()]} ${date.getFullYear()}`;}
  function period(start,end){return `${formatForumDate(start)} até ${formatForumDate(end)}`;}

  function initDates(){
    const today=new Date(),day=today.getDay(),sunday=new Date(today);sunday.setDate(today.getDate()-day);
    const saturday=new Date(sunday);saturday.setDate(sunday.getDate()+6);
    $('prof-inicio').value=toIsoDate(sunday);$('prof-fim').value=toIsoDate(saturday);
    const thirtyStart=new Date(today);thirtyStart.setDate(today.getDate()-29);
    $('lider-inicio').value=toIsoDate(thirtyStart);$('lider-fim').value=toIsoDate(today);
  }

  function extractActiveMembers(text){
    const ranks=['soldado','cabo','sargento','subtenente','tenente','capitão','capitao','major','coronel','general','marechal','comandante','presidente','chanceler','vip','acionista','trainee','assessor','secretário','secretario','analista','supervisor','inspetor','coordenador','superintendente','aspirante'];
    const members=[];
    clean(text).split(/\r?\n/).forEach(line=>{const columns=line.trim().split('\t').map(clean);if(columns.length<2)return;const offset=/^-?[\d.]+$/.test(columns[0])&&columns.length>=3?1:0;const nick=columns[offset],rank=normalize(columns[offset+1]);if(nick&&ranks.some(item=>rank.includes(normalize(item))))members.push(nick.replace(/[^a-zA-Z0-9_.:\-?!,]/g,''));});
    return [...new Set(members.filter(Boolean).map(normalize))];
  }

  function performanceEntry(line){
    const statuses=/(CASO ESPECIAL|EXCELENTE|ÓTIMO|OTIMO|BOM|REGULAR|IRREGULAR|RUIM)/i,raw=line.trim();if(!raw)return null;
    let nick='',status='';
    if(raw.includes('\t')){const columns=raw.split('\t').map(clean);nick=columns[0];for(let index=columns.length-1;index>=1;index--){const match=columns[index].match(statuses);if(match){status=match[1];break;}}}
    else{const match=raw.match(/(.*?)(CASO ESPECIAL|EXCELENTE|ÓTIMO|OTIMO|BOM|REGULAR|IRREGULAR|RUIM)/i);if(match){nick=match[1];status=match[2];}}
    nick=clean(nick).replace(/[^a-zA-Z0-9_.:\-?!,]/g,'');return nick&&status?{nick,status:normalize(status)}:null;
  }

  function processPerformance(){
    const performance=clean($('prof-desempenho').value);if(!performance){toast('Cole a consulta de desempenho antes de processar.','warning');return;}
    const active=new Set(extractActiveMembers($('prof-ativos').value)),groups={positive:[],negative:[],special:[]};
    performance.split(/\r?\n/).forEach(line=>{const entry=performanceEntry(line);if(!entry)return;if(active.size&&!active.has(normalize(entry.nick)))return;if(['excelente','otimo','bom','regular'].includes(entry.status))groups.positive.push(entry.nick);else if(['irregular','ruim'].includes(entry.status))groups.negative.push(entry.nick);else if(entry.status==='caso especial')groups.special.push(entry.nick);});
    Object.keys(groups).forEach(key=>state[key]=[...new Map(groups[key].map(nick=>[normalize(nick),nick])).values()]);
    $('prof-positivos').value=state.positive.join(' / ');$('prof-negativos').value=state.negative.join(' / ');$('prof-especiais').value=state.special.join(' / ');
    $('post-prof-positivos').disabled=!state.positive.length;$('post-prof-negativos').disabled=!state.negative.length;
    toast(`${state.positive.length} positivo(s), ${state.negative.length} negativo(s) e ${state.special.length} caso(s) especial(is).`,'success');
  }

  function requiredPostingData(prefix){
    const responsible=clean($(`${prefix}-responsavel`).value),start=$(`${prefix}-inicio`).value,end=$(`${prefix}-fim`).value;
    if(!responsible||!start||!end){toast('Preencha responsável, data inicial e data final.','warning');return null;}
    if(!inclusiveDays(start,end)){toast('A data final deve ser igual ou posterior à data inicial.','warning');return null;}
    return {responsible,start,end,period:period(start,end)};
  }

  function medalBBCode({responsible,cargo,nicks,medals,periodText,positive=true}){
    const color=medals>0?'green':'red',motive=positive?`Cumprimento de suas obrigações como ${cargo}.`:`Não cumprimento de suas obrigações como ${cargo}.`;
    return `[font=Poppins][color=#004d1a][b][size=17]✗ DADOS DO RESPONSÁVEL[/size][/b][/color]\n\n[b]Nickname:[/b] ${responsible}\n[b]Grupo de tarefas:[/b] ${FIXED_GROUP}\n[b]Cargo referente:[/b] ${cargo}\n\n[color=#004d1a][b][size=17]✗ MEDALHAS ATRIBUÍDAS[/size][/b][/color]\n\n[b]Período de referência:[/b] ${periodText}\n[b]Policiais:[/b] ${nicks}\n[b]Número de medalhas:[/b] [color=${color}](${medals})[/color]\n\n[b]Motivo:[/b] ${motive}[/font]`;
  }

  function draftId(){return typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():`rascunho_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;}
  function loadDrafts(){try{const parsed=JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY)||'[]');state.drafts=Array.isArray(parsed)?parsed.filter(item=>item&&item.id&&item.cargo&&item.nicks&&Number.isFinite(Number(item.medals))):[];}catch(_){state.drafts=[];}}
  function saveDrafts(){localStorage.setItem(DRAFT_STORAGE_KEY,JSON.stringify(state.drafts));renderDrafts();}

  function addDraft(payload,origin){
    const signature=[payload.responsible,payload.cargo,payload.nicks,payload.medals,payload.periodText,payload.positive].map(normalize).join('|');
    if(state.drafts.some(item=>item.signature===signature)){toast('Esse lançamento já está no rascunho.','warning');return false;}
    state.drafts.push({id:draftId(),signature,origin,createdAt:new Date().toISOString(),...payload});saveDrafts();
    toast(`${payload.cargo} adicionado ao rascunho como uma postagem separada.`,'success');return true;
  }

  function addPerformanceDraft(type){
    const data=requiredPostingData('prof');if(!data)return;const positive=type==='positive',list=positive?state.positive:state.negative;
    if(!list.length){toast('Processe a consulta antes de adicionar ao rascunho.','warning');return;}
    const cargo=$('prof-cargo').value,base=CARGO_CONFIG[cargo],medals=positive?base:-base;
    addDraft({responsible:data.responsible,cargo,nicks:list.join(' / '),medals,periodText:data.period,positive},'desempenho');
  }

  function renderDrafts(){
    const count=state.drafts.length;$('draft-nav-count').textContent=count;$('draft-hero-count').textContent=`${count} ${count===1?'rascunho':'rascunhos'}`;$('review-drafts').disabled=!count;$('clear-drafts').disabled=!count;
    if(!count){$('draft-grid').innerHTML='<div class="empty"><i class="ti ti-notes-off"></i><h3>Nenhum rascunho preparado</h3><p>Adicione resultados de desempenho ou da Liderança.</p></div>';return;}
    $('draft-grid').innerHTML=state.drafts.map((item,index)=>`<article class="draft-card ${Number(item.medals)<0?'negative':'positive'}"><header><div><h3>${index+1}. ${esc(item.cargo)}</h3><p>Grupo: ${FIXED_GROUP} · postagem separada</p></div><strong class="draft-medals">${Number(item.medals)>0?'+':''}${Number(item.medals)}</strong></header><div class="draft-details"><span>Responsável <strong>${esc(item.responsible)}</strong></span><span>Período <strong>${esc(item.periodText)}</strong></span></div><p class="draft-nicks">${esc(item.nicks)}</p><div class="draft-actions"><button class="secondary-button preview-draft" type="button" data-id="${esc(item.id)}"><i class="ti ti-eye"></i> Visualizar</button><button class="danger-button remove-draft" type="button" data-id="${esc(item.id)}"><i class="ti ti-trash"></i> Excluir</button></div></article>`).join('');
    document.querySelectorAll('.remove-draft').forEach(button=>button.onclick=()=>removeDraft(button.dataset.id));document.querySelectorAll('.preview-draft').forEach(button=>button.onclick=()=>openPreview([button.dataset.id]));
  }

  function removeDraft(id){state.drafts=state.drafts.filter(item=>item.id!==id);saveDrafts();toast('Rascunho removido.','success');}
  function previewItems(items){$('preview-list').innerHTML=items.map((item,index)=>`<article class="preview-item"><header><h3>Postagem ${index+1} · ${esc(item.cargo)}</h3><span>${Number(item.medals)>0?'+':''}${Number(item.medals)} medalhas</span></header><pre>${esc(medalBBCode(item))}</pre></article>`).join('');}

  function openPreview(ids=null){
    const selected=Array.isArray(ids)?state.drafts.filter(item=>ids.includes(item.id)):state.drafts;if(!selected.length){toast('Não há rascunhos para revisar.','warning');return;}
    previewItems(selected);$('send-all-drafts').hidden=Array.isArray(ids);$('preview-dialog').showModal();
  }

  async function forumSubmit(item){
    const body=new URLSearchParams({t:TOPIC_ID,message:medalBBCode(item),mode:'reply',post:'1'});
    const response=await fetch('/post',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:body.toString()});
    if(!response.ok)throw Error(`O fórum respondeu com HTTP ${response.status}.`);if(/\/(login|login_register|connexion)/i.test(response.url))throw Error('Sua sessão do fórum expirou. Entre novamente antes de postar.');
  }

  async function sendAllDrafts(){
    if(state.posting||!state.drafts.length)return;const button=$('send-all-drafts'),queue=state.drafts.slice();state.posting=true;setBusy(button,true,`Enviando 0/${queue.length}…`);let sent=0;
    try{
      for(const item of queue){button.innerHTML=`<span class="button-loader"></span>Enviando ${sent+1}/${queue.length}…`;await forumSubmit(item);sent++;state.drafts=state.drafts.filter(draft=>draft.id!==item.id);localStorage.setItem(DRAFT_STORAGE_KEY,JSON.stringify(state.drafts));if(sent<queue.length)await new Promise(resolve=>setTimeout(resolve,650));}
      renderDrafts();$('preview-dialog').close();toast(`${sent} postagem(ns) enviada(s) separadamente. Abrindo o tópico…`,'success');setTimeout(()=>window.location.assign(TOPIC_URL),850);
    }catch(error){console.error('Falha no envio dos rascunhos:',error);renderDrafts();toast(`${sent} postagem(ns) enviada(s). ${queue.length-sent} permaneceram no rascunho. ${error.message||''}`,'error');state.posting=false;setBusy(button,false);}
  }

  function leadershipDays(){return inclusiveDays($('lider-inicio').value,$('lider-fim').value);}
  function addLeaderRow(values={}){const row=document.createElement('tr');row.className='leader-row';row.innerHTML=`<td><input class="leader-nick" type="text" maxlength="40" placeholder="Nickname" value="${esc(values.nick||'')}"></td><td><input class="leader-role" type="text" maxlength="60" placeholder="Ex.: Líder" value="${esc(values.role||'Líder')}"></td><td><input class="leader-days" type="number" min="1" max="366" value="${Number(values.days)||leadershipDays()||30}"></td><td><button class="remove-row" type="button" title="Remover membro"><i class="ti ti-trash"></i></button></td>`;row.querySelector('.remove-row').onclick=()=>row.remove();$('leader-rows').append(row);}
  function syncLeaderDays(){const days=leadershipDays();if(days)document.querySelectorAll('.leader-days').forEach(input=>input.value=days);}

  function calculateLeadership(){
    const data=requiredPostingData('lider');if(!data)return;const entries=[];
    document.querySelectorAll('.leader-row').forEach(row=>{const nick=clean(row.querySelector('.leader-nick').value),role=clean(row.querySelector('.leader-role').value)||'Líder',days=Math.max(0,Number(row.querySelector('.leader-days').value)||0);if(!nick||!days)return;entries.push({nick,role,days,medals:Math.round(days*LEADERSHIP_BASE_MEDALS/LEADERSHIP_BASE_DAYS)});});
    if(!entries.length){toast('Adicione pelo menos um membro com nickname e dias válidos.','warning');return;}
    $('leader-results').innerHTML=entries.map((entry,index)=>`<article class="leader-card"><header><div><h3>${esc(entry.nick)}</h3><small>${esc(entry.role)}</small></div><i class="ti ti-medal"></i></header><strong class="medal-total">+${entry.medals}</strong><p>${entry.days} dia(s) × 65 ÷ 30 = ${entry.medals} medalhas</p><button class="success-button draft-leader" type="button" data-index="${index}"><i class="ti ti-notes"></i> Adicionar ao rascunho</button></article>`).join('');
    document.querySelectorAll('.draft-leader').forEach(button=>button.onclick=()=>{const entry=entries[Number(button.dataset.index)];addDraft({responsible:data.responsible,cargo:entry.role,nicks:entry.nick,medals:entry.medals,periodText:data.period,positive:true},'lideranca');});toast('Regra de três calculada com sucesso.','success');
  }

  function resetPerformanceResults(){state.positive=[];state.negative=[];state.special=[];$('prof-positivos').value='';$('prof-negativos').value='';$('prof-especiais').value='';$('post-prof-positivos').disabled=true;$('post-prof-negativos').disabled=true;}
  function updateCargoUI(reset=true){const cargo=$('prof-cargo').value,medals=CARGO_CONFIG[cargo];$('positive-medal-label').textContent=`+${medals} medalhas`;$('negative-medal-label').textContent=`-${medals} medalhas`;if(reset)resetPerformanceResults();}

  function navigate(view){
    document.querySelectorAll('.view').forEach(section=>section.hidden=section.id!==`view-${view}`);document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===view));
    const labels={professores:'Desempenho por cargo',lideranca:'Cálculo da Liderança',rascunhos:'Rascunhos e envio'};$('page-label').textContent=labels[view]||'Central de Finanças';$('sidebar').classList.remove('open');document.querySelector('.stage').scrollTop=0;
  }

  function bind(){
    document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>navigate(button.dataset.view));$('menu-button').onclick=()=>$('sidebar').classList.toggle('open');$('sidebar-overlay').onclick=()=>$('sidebar').classList.remove('open');
    $('theme-button').onclick=()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;localStorage.setItem('FINANCAS_THEME',theme);$('theme-button').innerHTML=`<i class="ti ${theme==='dark'?'ti-sun':'ti-moon'}"></i>`;document.querySelector('meta[name="theme-color"]').content=theme==='dark'?'#0f0512':'#821f88';};
    $('process-professores').onclick=processPerformance;$('prof-cargo').onchange=()=>updateCargoUI(true);$('post-prof-positivos').onclick=()=>addPerformanceDraft('positive');$('post-prof-negativos').onclick=()=>addPerformanceDraft('negative');
    $('add-leader').onclick=()=>addLeaderRow();$('calculate-leaders').onclick=calculateLeadership;$('lider-inicio').onchange=syncLeaderDays;$('lider-fim').onchange=syncLeaderDays;
    $('review-drafts').onclick=()=>openPreview();$('clear-drafts').onclick=()=>{if(state.drafts.length&&window.confirm('Excluir todos os rascunhos salvos?')){state.drafts=[];saveDrafts();toast('Todos os rascunhos foram excluídos.','success');}};
    $('close-preview').onclick=()=>$('preview-dialog').close();$('cancel-preview').onclick=()=>$('preview-dialog').close();$('send-all-drafts').onclick=sendAllDrafts;$('preview-dialog').addEventListener('click',event=>{if(event.target===$('preview-dialog'))$('preview-dialog').close();});
  }

  async function init(){
    bind();initDates();loadDrafts();renderDrafts();updateCargoUI(false);const theme=localStorage.getItem('FINANCAS_THEME')==='dark'?'dark':'light';document.documentElement.dataset.theme=theme;$('theme-button').innerHTML=`<i class="ti ${theme==='dark'?'ti-sun':'ti-moon'}"></i>`;addLeaderRow();
    const nick=await forumNick();if(nick){$('current-nick').textContent=nick;$('prof-responsavel').value=nick;$('lider-responsavel').value=nick;$('current-avatar').src=`https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(nick)}&direction=2&head_direction=3&gesture=sml&size=m&headonly=1`;}else{$('current-nick').textContent='Preencha o responsável';toast('Não foi possível identificar o usuário automaticamente. Preencha o responsável antes de criar os rascunhos.','warning');}navigate('professores');
  }

  init();
})();
