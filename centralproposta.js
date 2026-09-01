(() => {
  'use strict';
  if (!document.getElementById('proposal-central-app')) return;

  // ========================================================
  // 🧪 CONFIGURAÇÕES DO SIMULADOR COMPLETO (EDITAR AQUI) 🧪
  // ========================================================
  const MEU_NICK = "Sr.Gabriel."; // Seu nick para ter botões de Liderança liberados
  
  // Membros que levarão a punição no teste (VÃO RECEBER MP E SAIR NO TÓPICO!)
  const NICK_TESTE_1 = "Sr.Gabriel."; 
  const NICK_TESTE_2 = "Pegas";       

  const FIREBASE_CONFIG = Object.freeze({apiKey:'AIzaSyDo4DagZchii1cPKFighZU5KAjppp98HJE',authDomain:'nexusprof.firebaseapp.com',projectId:'nexusprof',storageBucket:'nexusprof.appspot.com',messagingSenderId:'268861178598',appId:'1:268861178598:web:9686b81bb003f9514fb127',measurementId:'G-MY150DZMTM'});

  const state = {
    db: null,
    nick: MEU_NICK,
    profile: { cargo: 'Liderança', status: 'Ativo' },
    cycle: { id: 'ciclo_simulado_02', status: 'aberto', inicioIso: new Date().toISOString() },
    search: '',
    busy: false,
    licenses: new Set(),
    backups: new Map(),
    // 2 Propostas falsas
    proposals: [
        { ordem: 101, autor: 'Sistema', tipo: 'Sugestão', titulo: 'Proposta Teste 1', conteudo: 'Esta proposta foi votada.', criadoEm: new Date().toISOString() },
        { ordem: 102, autor: 'Sistema', tipo: 'Projeto', titulo: 'Proposta Teste 2 (Esquecida)', conteudo: 'Nesta proposta ninguém votou. Vai gerar advertência para todos!', criadoEm: new Date().toISOString() }
    ],
    // Votos falsos (Os membros votaram na 101, mas ESQUECERAM a 102)
    votes: [
        { Nick: NICK_TESTE_1, Ordem: 101, Veredito: 'Aprovada', Comentario: 'Voto simulado' },
        { Nick: NICK_TESTE_2, Ordem: 101, Veredito: 'Aprovada', Comentario: 'Voto simulado' }
    ],
    // Membros falsos
    members: [
        { name: NICK_TESTE_1, nick: NICK_TESTE_1, cargo: 'Vice-Líder', status: 'Ativo' },
        { name: NICK_TESTE_2, nick: NICK_TESTE_2, cargo: 'Vice-Líder', status: 'Ativo' }
    ],
    council: []
  };

  const $ = id => document.getElementById(id);
  const clean = value => String(value ?? '').trim();
  const low = value => clean(value).toLocaleLowerCase('pt-BR');
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const orderOf = p => Number(p.ordem ?? p.Ordem ?? 0);
  const voteOrder = v => Number(v.Ordem ?? v.ordem ?? 0);
  const idOf = p => clean(p.id || p.ordemId || orderOf(p));
  function isLideranca() { return ['Líder', 'Vice-Líder', 'Liderança'].includes(clean(state.profile?.cargo)); }
  function postingDate() { return new Intl.DateTimeFormat('pt-BR', {timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date()); }

  // INICIALIZAÇÃO FIREBASE (Apenas para testar o envio à assistência)
  if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  state.db = firebase.firestore();

  // Componentes de UI
  function toast(message, type='info', title=''){
    const labels = {success:'Sucesso', error:'Erro', warning:'Atenção', info:'Informação'}, icons = {success:'ti-circle-check', error:'ti-circle-x', warning:'ti-alert-triangle', info:'ti-info-circle'};
    const el = document.createElement('div'); el.className = 'toast'; el.dataset.type = type;
    el.innerHTML = `<i class="ti ${icons[type]||icons.info}"></i><div><strong>${esc(title||labels[type])}</strong><span>${esc(message)}</span></div>`;
    $('toast-container').append(el); setTimeout(() => el.remove(), 6000);
  }
  function busy(button, on, label='Processando…'){ if(!button) return; if(on){ button.dataset.html = button.innerHTML; button.disabled = true; button.innerHTML = `<span class="loader" style="width:17px;height:17px;border-width:2px"></span>${esc(label)}`; }else{ button.disabled = false; if(button.dataset.html) button.innerHTML = button.dataset.html; delete button.dataset.html; } }
  function ask(title, message, label='Confirmar', danger=true){ const d=$('confirm-dialog'); $('confirm-title').textContent=title; $('confirm-message').textContent=message; $('confirm-yes').textContent=label; $('confirm-yes').className=danger?'danger-button':'primary-button'; d.showModal(); return new Promise(resolve=>d.addEventListener('close',()=>resolve(d.returnValue==='confirm'),{once:true})); }

  // ==========================================
  // LÓGICA DE DADOS, AVALIAÇÃO E UI
  // ==========================================
  function decision(p, list, leaders){
      if(!list.length) return {key:'none', label:'Sem pareceres', status:'neutral'};
      const leader = list.find(v => leaders.has(low(v.Nick||v.nick)));
      if(leader){
          const verdict = low(leader.Veredito||leader.veredito);
          if(verdict.includes('aprovada')) return {key:'approved', label:'Aprovada pela Liderança', status:'approved'};
          if(verdict.includes('reprovada')) return {key:'rejected', label:'Reprovada pela Liderança', status:'rejected'};
      }
      const c = {approved:0, rejected:0, tutela:0, reuniao:0, lideranca:0, autoria:0};
      list.forEach(v => { const x = low(v.Veredito||v.veredito); if(x.includes('aprovada')) c.approved++; else if(x.includes('reprovada')) c.rejected++; else if(x.includes('tutela')) c.tutela++; else if(x.includes('reuni')) c.reuniao++; else if(x.includes('lideran')) c.lideranca++; else if(x.includes('autoria')) c.autoria++; });
      const max = Math.max(...Object.values(c)), w = Object.keys(c).filter(k => c[k]===max && max>0);
      if(w.length!==1) return {key:'tie', label:'Empate técnico', status:'pending'};
      const key = w[0], labels = {approved:'Maioria aprovou', rejected:'Maioria reprovou', tutela:'Encaminhada à tutela', reuniao:'Encaminhada à reunião', lideranca:'Pendente da Liderança', autoria:'Retorno à autoria'};
      return {key, label:labels[key], status:key==='approved'?'approved':key==='rejected'?'rejected':'attention'};
  }
  
  function leaderNicks(){ return new Set(state.council.filter(m => ['Líder','Vice-Líder','Liderança'].includes(m.cargo)).flatMap(m => [low(m.name),low(m.nick)]).filter(Boolean)); }
  
  function renderCouncil(){
      if(!state.council.length) return;
      const orders = new Set(state.proposals.map(orderOf)), relevant = state.votes.filter(v => orders.has(voteOrder(v)));
      $('council-grid').innerHTML = state.council.map(m => {
          const nick = clean(m.name||m.nick||'Desconhecido'), list = relevant.filter(v => low(v.Nick||v.nick)===low(nick)), leave = state.licenses.has(low(nick));
          let fav=0, rep=0, neu=0;
          list.forEach(v => { const x = low(v.Veredito||v.veredito); if(x.includes('aprovada')) fav++; else if(x.includes('reprovada')) rep++; else neu++; });
          const stats = leave ? '<span class="warning">Licença ativa</span>' : list.length ? `<span class="success">✓ ${fav}</span><span class="danger">× ${rep}</span><span class="info-text">– ${neu}</span>` : '<span class="danger">Pendente</span>';
          return `<article class="member-card" data-state="${leave?'leave':list.length?'done':'pending'}"><img src="https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(nick)}&direction=2&head_direction=2&gesture=sml&size=s&headonly=1" alt=""><div class="member-copy"><strong>${esc(nick)}</strong><small>${esc(m.cargo||'Membro')}</small><div class="member-stats">${stats}</div></div></article>`;
      }).join('');
  }

  function card(p){
      const list = state.votes.filter(v => voteOrder(v)===orderOf(p)), result = decision(p, list, leaderNicks()), order = orderOf(p), title = clean(p.titulo||p.Titulo), author = clean(p.autor||p.Autor), type = clean(p.tipo||p.Categoria), content = clean(p.conteudo||p.Conteudo), encoded = encodeURIComponent(JSON.stringify(list));
      let btnForcar = '';
      if (isLideranca()) {
          btnForcar = `<button type="button" onclick="abrirModalForcarVoto(${order})" title="Forçar Veredito da Liderança" style="margin-left:8px; font-size:10px; background:rgba(192, 38, 211, 0.2); color:#e879f9; padding:3px 8px; border-radius:6px; border:1px solid #d946ef; font-weight:bold; cursor:pointer;"><i class="ti ti-hammer"></i> Forçar</button>`;
      }
      return `<article class="proposal-card" data-status="${result.status}"><div class="card-top"><div class="card-id"><span class="number">Nº ${order||'—'}</span><div class="card-title"><span>${esc(type)}</span><h3 title="${esc(title)}">${esc(title)}</h3><p>Por ${esc(author)}</p></div></div><button class="trash" onclick="removeActive(${order})" title="Excluir proposta"><i class="ti ti-trash"></i></button></div><div style="display:flex; align-items:center; margin-bottom:12px;"><span class="status" style="margin-bottom:0;">${esc(result.label)}</span>${btnForcar}</div><p class="content">${esc(content)}</p><footer class="card-footer"><small>SIMULAÇÃO OFF</small><button onclick="showVotes('${encoded}',${order})"><i class="ti ti-messages"></i> ${list.length} parecer(es)</button></footer></article>`;
  }
  
  function renderProposals(){
      const q = low(state.search), list = state.proposals.filter(p => !q || [orderOf(p), p.autor, p.titulo, p.tipo].some(v => low(v).includes(q)));
      $('proposal-count').textContent = `${list.length} proposta(s)`;
      $('proposal-grid').innerHTML = list.length ? list.map(p => card(p)).join('') : '<div class="empty"><i class="ti ti-file-off"></i><h3>Nenhuma proposta encontrada</h3></div>';
  }
  
  window.showVotes = (encoded, order) => {
      let list=[]; try{ list=JSON.parse(decodeURIComponent(encoded)); }catch(_){}
      $('votes-title').textContent = `Pareceres · Proposta nº ${order}`;
      $('votes-content').innerHTML = list.length ? list.map(v => {
          const verdict = clean(v.Veredito||v.veredito||'Sem veredito'), cls = low(verdict).includes('aprovada') ? 'success' : low(verdict).includes('reprovada') ? 'danger' : 'warning';
          return `<article class="vote"><div><strong>${esc(v.Nick||v.nick||'Não identificado')}</strong><span class="${cls}">${esc(verdict)}</span></div><p>${esc(v.Comentario||v.comentario||'Sem comentário.')}</p></article>`;
      }).join('') : '<div class="empty compact"><i class="ti ti-message-off"></i><h3>Nenhum parecer</h3></div>';
      $('votes-dialog').showModal();
  };
  
  // MODAL FORÇAR VOTO 
  window.removeActive = async(order) => { 
      if(!await ask(`Excluir proposta nº ${order}?`, 'A proposta simulada será apagada.', 'Excluir')) return; 
      state.proposals = state.proposals.filter(p => orderOf(p) !== order);
      state.votes = state.votes.filter(v => voteOrder(v) !== order);
      renderProposals(); renderCouncil(); toast('Proposta excluída.', 'success'); 
  };

  window.abrirModalForcarVoto = function(ordem) {
      let dialog = document.getElementById('force-vote-dialog');
      if (!dialog) {
          dialog = document.createElement('dialog'); dialog.id = 'force-vote-dialog'; dialog.className = 'dialog';
          dialog.innerHTML = `<div class="dialog-card"><header><div><p class="eyebrow">Veredito da Liderança</p><h2>Forçar Resultado</h2></div><button class="icon-button" type="button" onclick="document.getElementById('force-vote-dialog').close()"><i class="ti ti-x"></i></button></header><div class="dialog-body form-grid"><input type="hidden" id="forcar-ordem"><label class="field wide"><span>Decisão Soberana</span><select id="forcar-veredito" required><option value="Aprovada">Aprovada</option><option value="Reprovada">Reprovada</option></select></label><label class="field wide"><span>Comentário / Justificativa</span><textarea id="forcar-comentario" rows="4" required>Decisão final decretada via painel de Liderança.</textarea></label></div><footer><button class="secondary-button" type="button" onclick="document.getElementById('force-vote-dialog').close()">Cancelar</button><button onclick="salvarVotoForcado()" class="primary-button" type="button"><i class="ti ti-hammer"></i> Decretar Veredito</button></footer></div>`;
          document.body.appendChild(dialog);
      }
      document.getElementById('forcar-ordem').value = ordem;
      dialog.showModal();
  };

  window.salvarVotoForcado = function() {
      const ordem = document.getElementById('forcar-ordem').value;
      const veredito = document.getElementById('forcar-veredito').value;
      const comentario = document.getElementById('forcar-comentario').value.trim();
      if (!comentario) { toast("O comentário é obrigatório.", "error"); return; }
      document.getElementById('force-vote-dialog').close();
      state.votes = state.votes.filter(v => !(voteOrder(v) === Number(ordem) && low(v.Nick) === low(state.nick)));
      state.votes.push({ Nick: state.nick, Ordem: Number(ordem), Comentario: comentario, Veredito: veredito });
      renderProposals(); renderCouncil(); toast("Resultado simulado forçado com sucesso!", "success");
  };

  async function saveManual(e){ 
      e.preventDefault(); 
      const order=Number($('form-number').value); 
      state.proposals.push({ordem:order, autor:$('form-author').value, tipo:$('form-type').value, titulo:$('form-title').value, conteudo:$('form-content').value});
      e.target.reset(); $('launch-dialog').close(); 
      renderProposals(); renderCouncil(); toast('Proposta simulada adicionada.', 'success'); 
  }

  // ==========================================
  // DISPARO NO FÓRUM E FIREBASE (MÓDULO REAL)
  // ==========================================
  function validAttachmentUrl(value){ try{ const url = new URL(clean(value)); return ['http:','https:'].includes(url.protocol) ? url.href : ''; }catch(_){ return ''; } }

  function assistanceDateFields(){
      const formatted = postingDate(), parts = formatted.split('/').map(Number);
      const start = new Date(Date.UTC(parts[2], parts[1]-1, parts[0]));
      const end = new Date(start); end.setUTCDate(end.getUTCDate()+30);
      const pad = value => String(value).padStart(2,'0');
      return {
          formatted, iso: `${parts[2]}-${pad(parts[1])}-${pad(parts[0])}`, end: `${pad(end.getUTCDate())}/${pad(end.getUTCMonth()+1)}/${end.getUTCFullYear()}`
      };
  }

  // 1. INJEÇÃO REAL NO FIREBASE (ASSISTÊNCIA_REGISTROS)
  async function sendWarningToAssistance(member, cycle, attachment){
      const dates = assistanceDateFields();
      const safeNick = member.nick.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,80) || 'membro';
      const safeCycle = clean(cycle).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100) || 'ciclo';
      const recordId = `proposta_${safeCycle}_${safeNick}`.slice(0,190);
      
      const record = {
          cargo: member.cargo,
          nick: member.nick,
          punicao: 'ADVERTÊNCIA INTERNA',
          motivo: 'Não avaliou às propostas em tempo hábil.',
          permissao: 'Conselho da Assistência',
          data_formatada: dates.formatted,
          data_iso: dates.iso,
          data_termino: dates.end,
          decisao: 'PENDENTE',
          observacao: '',
          carta_enviada: true,
          autor_postagem: state.nick,
          sincronizado_sheets: false,
          tipo_ocorrencia: 'adv_interna',
          origem: 'teste_simulador', // MARCAÇÃO DE TESTE NO BANCO!
          ciclo_id: cycle,
          anexo: attachment,
          propostas_nao_avaliadas: member.missing,
          quantidade_avaliadas: member.answered,
          quantidade_propostas: member.total,
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
      };

      try {
          await state.db.collection('assistencia_registros').doc(recordId).set(record);
      } catch (err) {
          throw new Error('Falha ao enviar para o Firebase Assistência: ' + err.message);
      }
  }

  function missingCouncilAssessments(){
      const requiredOrders = [...new Set(state.proposals.map(orderOf))];
      if(!requiredOrders.length) return [];
      return state.council.map(member => {
          const nick = clean(member.name || member.nick);
          if(!nick || state.licenses.has(low(nick))) return null;
          const answered = new Set(state.votes.filter(vote => low(vote.Nick || vote.nick) === low(nick)).map(voteOrder));
          const missing = requiredOrders.filter(order => !answered.has(order));
          return missing.length ? { nick, cargo: clean(member.cargo), missing, answered: answered.size, total: requiredOrders.length } : null;
      }).filter(Boolean);
  }

  function requestWarningAttachment(members){
      let dialog = $('warning-attachment-dialog');
      if(!dialog){
          dialog = document.createElement('dialog'); dialog.id = 'warning-attachment-dialog'; dialog.className = 'dialog';
          dialog.innerHTML = `
              <div class="dialog-card">
                  <header>
                      <div><p class="eyebrow">Conselho da Assistência</p><h2>Advertências do ciclo (SIMULAÇÃO)</h2></div>
                      <button id="warning-attachment-close" class="icon-button" type="button"><i class="ti ti-x"></i></button>
                  </header>
                  <div class="dialog-body">
                      <p>Os membros abaixo receberão as MPs e Postagens reais no Fórum + Firebase para validar o fluxo.</p>
                      <div id="warning-member-list" class="access-list"></div>
                      <label class="field wide" style="margin-top:18px">
                          <span>Link do print comprobatório</span>
                          <input id="warning-attachment-url" type="url" placeholder="https://i.imgur.com/exemplo.png" required>
                      </label>
                      <p id="warning-attachment-error" style="color:#ef6b78;display:none;margin-top:8px">Informe um endereço começando com http:// ou https://.</p>
                  </div>
                  <footer>
                      <button id="warning-attachment-cancel" class="secondary-button" type="button">Cancelar</button>
                      <button id="warning-attachment-confirm" class="primary-button" type="button"><i class="ti ti-alert-triangle"></i> Enviar tudo (Ação Real!)</button>
                  </footer>
              </div>`;
          document.body.appendChild(dialog);
      }

      $('warning-member-list').innerHTML = members.map(member =>
          `<span class="access-chip"><span>${esc(member.cargo)} ${esc(member.nick)} · ${member.answered}/${member.total} avaliadas</span></span>`
      ).join('');
      $('warning-attachment-url').value = '';
      $('warning-attachment-error').style.display = 'none';
      dialog.showModal();

      return new Promise(resolve => {
          let finished = false;
          const finish = value => { if(finished) return; finished = true; if(dialog.open) dialog.close(); resolve(value); };
          $('warning-attachment-confirm').onclick = () => {
              const url = validAttachmentUrl($('warning-attachment-url').value);
              if(!url){ $('warning-attachment-error').style.display = 'block'; return; }
              finish(url);
          };
          $('warning-attachment-cancel').onclick = () => finish('');
          $('warning-attachment-close').onclick = () => finish('');
          dialog.addEventListener('cancel', event => { event.preventDefault(); finish(''); }, {once:true});
      });
  }

  // 2. DISPARO REAL PARA O FÓRUM
  async function forumSubmit(path, data){
      const body = new URLSearchParams();
      Object.entries(data).forEach(([key,value]) => body.append(key, clean(value)));
      const response = await fetch(path, {
          method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'}, body:body.toString()
      });
      if(!response.ok) throw new Error(`O fórum recusou ${path} (HTTP ${response.status}).`);
  }

  function warningTopicBBCode(member){
      const today = postingDate();
      return `[font=Poppins][size=18][center][color=#560c7e][b]ADVERTÊNCIA INTERNA (TESTE DO SISTEMA)[/b][/color][/center][/size]\n\n[justify][b]Cargo e nick do(a) advertido(a):[/b] ${member.cargo} ${member.nick}\n[b]Motivo(s):[/b] Não avaliou às propostas em tempo hábil.\n[b]Data:[/b] ${today}\n[b]Permissão:[/b] Conselho da Assistência\n[/justify][/font]`;
  }

  function warningPrivateMessageBBCode(member, attachment){
      return `[font=Poppins]<div style="border:1.5rem solid #821F88;border-radius:8px;font-family:Poppins;">[table][tr][td][center][img]https://i.imgur.com/hU7bn8R.gif[/img][/center]\n\n[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][center][img]https://i.imgur.com/QL68H2C.png[/img][/center][size=20][font=Poppins][color=white][b]CARTA DE ADVERTÊNCIA INTERNA[/b][/color][/font][/size][/td][/tr][/table]\n<div style="padding:1.5%;border:1px solid #bdbdbd;border-radius:8px;">[justify]Saudações, [b]${member.nick}[/b].\n\nIsto é uma mensagem gerada pelo Simulador do Sistema NEXUS para atestar o funcionamento completo de fechamento de ciclo.\n\n[b]Motivo do Teste:[/b] Validar o disparo de MP após advertência em massa.\n\n[color=#821F88][b]COMENTÁRIOS:[/b][/color] O membro não registrou seu parecer nas propostas do período simulado.\n\n[color=#821F88][b]ANEXOS:[/b][/color] ${attachment}.\n[/justify]</div>[/td][/tr][/table]</div>[/font]\n[font=Poppins][center]Atentamente,\n[img]https://i.imgur.com/1kZvQHs.png[/img][/center][/font]`;
  }

  async function closeCycle(){
      if(state.busy) return;
      const ok=await ask(
          'Iniciar Teste Real de Disparos?', 
          `Isto vai injetar registros na Assistência do Firebase, postar 2 respostas no Tópico e mandar 2 MPs reais (para ${NICK_TESTE_1} e ${NICK_TESTE_2}).`, 
          'Iniciar Disparos', false
      );
      if(!ok) return;

      state.busy=true;
      busy($('close-cycle'),true,'Conferindo…');
      try{
          const warningTargets = missingCouncilAssessments();
          let attachment='';

          if(warningTargets.length){
              busy($('close-cycle'),false);
              attachment = await requestWarningAttachment(warningTargets);
              if(!attachment){ toast('Cancelado: link do print obrigatório.','warning'); return; }
              busy($('close-cycle'),true,'Disparando Firebase e Fórum…');
              
              for(const member of warningTargets){
                  toast(`Enviando ${member.nick} para o Firebase Assistência...`, "info");
                  await sendWarningToAssistance(member, state.cycle.id, attachment);

                  toast(`Disparando Fórum para ${member.nick}...`, "info");
                  await forumSubmit('/post', {t:'32246',message:warningTopicBBCode(member),mode:'reply',post:'Enviar'});
                  await forumSubmit('/privmsg', {folder:'inbox',mode:'post',post:'1','username[]':member.nick,subject:'[PROF] TESTE DE MENSAGEM DO SISTEMA',message:warningPrivateMessageBBCode(member,attachment)});
              }
          }

          // Simula encerramento limpando a tela
          state.proposals = [];
          state.votes = [];
          renderProposals(); renderCouncil();
          $('cycle-label').textContent = 'Fechamento Simulado Concluído';
          toast('Fluxo concluído com sucesso! Veja o Firebase, sua MP e o Tópico.', 'success');

      }catch(e){
          toast(e.message||'Interrompido.','error');
      }finally{
          state.busy=false; busy($('close-cycle'),false);
      }
  }

  // ==========================================
  // INICIALIZAÇÃO DA INTERFACE SIMULADA
  // ==========================================
  function navigate(name){ document.querySelectorAll('.view').forEach(v => v.hidden = v.id!==`view-${name}`); document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view===name)); const labels = {propostas:'Central de Propostas', historico:'Histórico de Propostas', configuracoes:'Configurações da Central'}; $('page-label').textContent = labels[name]; location.hash = name; sidebar(false); document.querySelector('.stage').scrollTop = 0; }
  function sidebar(open){ $('sidebar').classList.toggle('open', open); }
  function themeVision(){ const applyTheme=(v,s=false)=>{ document.documentElement.dataset.theme=v; $('theme-button').innerHTML=`<i class="ti ${v==='dark'?'ti-sun':'ti-moon'}"></i>`; document.querySelector('meta[name=theme-color]').content = v==='dark'?'#0f0512':'#821f88'; if(s) localStorage.setItem('PROPOSTAS_THEME',v); }; applyTheme(localStorage.getItem('PROPOSTAS_THEME')==='light'?'light':'dark'); $('theme-button').onclick = () => applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark',true); const applyVision=(sc,c,s=false)=>{ document.documentElement.dataset.scale=sc; document.documentElement.dataset.contrast=c?'high':'standard'; document.querySelectorAll('[data-scale]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scale===sc))); $('contrast-state').textContent=c?'Ativado':'Desativado'; if(s) localStorage.setItem('PROPOSTAS_VISION',JSON.stringify({scale:sc,contrast:c})); }; let pref={}; try{ pref=JSON.parse(localStorage.getItem('PROPOSTAS_VISION')||'{}'); }catch(_){} applyVision(pref.scale||'normal',pref.contrast===true); $('vision-button').onclick=()=>{ $('vision-panel').hidden=!$('vision-panel').hidden; }; document.querySelectorAll('[data-scale]').forEach(b=>b.onclick=()=>applyVision(b.dataset.scale,document.documentElement.dataset.contrast==='high',true)); $('contrast-button').onclick=()=>applyVision(document.documentElement.dataset.scale,document.documentElement.dataset.contrast!=='high',true); $('vision-reset').onclick=()=>applyVision('normal',false,true); }
  
  function bind(){ 
      document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.view))); 
      $('menu-button').onclick=()=>sidebar(!$('sidebar').classList.contains('open')); 
      $('sidebar-overlay').onclick=()=>sidebar(false); 
      $('open-launch').onclick=()=>$('launch-dialog').showModal(); 
      document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close()); 
      $('launch-form').onsubmit=saveManual; 
      $('proposal-search').oninput=e=>{ state.search=e.target.value; renderProposals(); }; 
      $('close-cycle').onclick=closeCycle; 
      document.querySelectorAll('.dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d) d.close();})); 
  }
  
  function init() {
      bind(); themeVision();
      state.council = state.members.filter(m => ['Estagiário(a)','Conselheiro(a)','Líder','Vice-Líder','Liderança'].includes(m.cargo));
      
      $('current-nick').textContent = state.nick;
      $('current-role').textContent = state.profile.cargo;
      $('current-avatar').src = `https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(state.nick)}&direction=2&head_direction=3&gesture=sml&size=m&headonly=1`;
      $('access-screen').classList.add('hidden');
      setTimeout(() => $('access-screen').hidden = true, 220);
      $('cycle-label').textContent = 'Modo Simulação c/ Disparos Reais';

      renderProposals();
      renderCouncil();
      navigate('propostas');
      toast("Simulador Integrado! O fechamento fará disparos reais.", "warning");
  }

  init();
})();
