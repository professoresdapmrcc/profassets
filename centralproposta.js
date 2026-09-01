(() => {
  'use strict';
  if (!document.getElementById('proposal-central-app')) return;

  // ========================================================
  // 🧪 MODO SIMULADOR (TESTE OFF-LINE) 🧪
  // ========================================================
  
  // EDITAR AQUI: Coloque os nicks exatos do seu fórum para testar
  const MEU_NICK = "Sr.Gabriel."; // Seu nick para ter acesso de Liderança no painel
  const NICK_PUNIDO = "Sr.Gabriel."; // Nick que vai RECEBER a MP de advertência (pode ser o seu mesmo) 
  const NICK_PUNIDO = "Pegas"; // Nick que vai RECEBER a MP de advertência (pode ser o seu mesmo)

  // Banco de Dados Fictício (Em Memória)
  const state = {
    nick: MEU_NICK,
    profile: { cargo: 'Vice-Líder', status: 'Ativo' },
    cycle: { id: 'ciclo_simulacao_01', status: 'aberto' },
    proposals: [
        { id: 'p1', ordem: 9001, autor: 'AutorTeste1', tipo: 'Sugestão', titulo: 'Proposta Teste 1 (Votada)', conteudo: 'Esta proposta foi votada por todos e será aprovada/reprovada normalmente.' },
        { id: 'p2', ordem: 9002, autor: 'AutorTeste2', tipo: 'Projeto', titulo: 'Proposta Teste 2 (Esquecida)', conteudo: 'Ninguém votou nessa proposta. Quando você encerrar o ciclo, o sistema vai gerar uma advertência por causa dela.' }
    ],
    votes: [
        // O membro punido votou apenas na 9001. A 9002 ficou vazia.
        { id: 'v1', Nick: NICK_PUNIDO, Ordem: 9001, Veredito: 'Aprovada', Comentario: 'Voto fictício de teste.' }
    ],
    members: [
        { id: 'm1', name: MEU_NICK, cargo: 'Vice-Líder', status: 'Ativo' },
        { id: 'm2', name: NICK_PUNIDO, cargo: 'Conselheiro(a)', status: 'Ativo' }
    ],
    council: [],
    licenses: new Set(),
    search: '',
    busy: false
  };

  const $ = id => document.getElementById(id);
  const clean = value => String(value ?? '').trim();
  const low = value => clean(value).toLocaleLowerCase('pt-BR');
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const orderOf = p => Number(p.ordem ?? p.Ordem ?? 0);
  const voteOrder = v => Number(v.Ordem ?? v.ordem ?? 0);
  function isLideranca() { return ['Líder', 'Vice-Líder', 'Liderança'].includes(state.profile.cargo); }

  function toast(message, type='info', title=''){
    const labels = {success:'Sucesso', error:'Erro', warning:'Atenção', info:'Informação'}, icons = {success:'ti-circle-check', error:'ti-circle-x', warning:'ti-alert-triangle', info:'ti-info-circle'};
    const el = document.createElement('div'); el.className = 'toast'; el.dataset.type = type;
    el.innerHTML = `<i class="ti ${icons[type]||icons.info}"></i><div><strong>${esc(title||labels[type])}</strong><span>${esc(message)}</span></div>`;
    $('toast-container').append(el); setTimeout(() => el.remove(), 5000);
  }
  function busy(btn, on, label='Processando…'){ if(!btn) return; if(on){ btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="loader" style="width:17px;height:17px;border-width:2px"></span>${esc(label)}`; }else{ btn.disabled = false; btn.innerHTML = btn.dataset.html; } }
  function ask(title, message, label='Confirmar', danger=true){ const d=$('confirm-dialog'); $('confirm-title').textContent=title; $('confirm-message').textContent=message; $('confirm-yes').textContent=label; $('confirm-yes').className=danger?'danger-button':'primary-button'; d.showModal(); return new Promise(resolve=>d.addEventListener('close',()=>resolve(d.returnValue==='confirm'),{once:true})); }

  // ==========================================
  // LÓGICA DE AVALIAÇÃO FAKE E UI
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

  function leaderNicks(){ return new Set(state.council.filter(m => ['Líder','Vice-Líder','Liderança'].includes(m.cargo)).map(m => low(m.name))); }

  function renderCouncil(){
      if(!state.council.length) return;
      const orders = new Set(state.proposals.map(orderOf)), relevant = state.votes.filter(v => orders.has(voteOrder(v)));
      $('council-grid').innerHTML = state.council.map(m => {
          const nick = clean(m.name), list = relevant.filter(v => low(v.Nick||v.nick)===low(nick)), leave = state.licenses.has(low(nick));
          let fav=0, rep=0, neu=0;
          list.forEach(v => { const x = low(v.Veredito||v.veredito); if(x.includes('aprovada')) fav++; else if(x.includes('reprovada')) rep++; else neu++; });
          const stats = leave ? '<span class="warning">Licença ativa</span>' : list.length ? `<span class="success">✓ ${fav}</span><span class="danger">× ${rep}</span><span class="info-text">– ${neu}</span>` : '<span class="danger">Pendente</span>';
          return `<article class="member-card" data-state="${leave?'leave':list.length?'done':'pending'}"><img src="https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(nick)}&direction=2&head_direction=2&gesture=sml&size=s&headonly=1" alt=""><div class="member-copy"><strong>${esc(nick)}</strong><small>${esc(m.cargo)}</small><div class="member-stats">${stats}</div></div></article>`;
      }).join('');
  }

  function card(p){
      const list = state.votes.filter(v => voteOrder(v)===orderOf(p)), result = decision(p, list, leaderNicks()), order = orderOf(p), title = clean(p.titulo), author = clean(p.autor), type = clean(p.tipo), content = clean(p.conteudo), encoded = encodeURIComponent(JSON.stringify(list));
      let btnForcar = '';
      if (isLideranca()) {
          btnForcar = `<button type="button" onclick="abrirModalForcarVoto(${order})" title="Forçar Veredito da Liderança" style="margin-left:8px; font-size:10px; background:rgba(192, 38, 211, 0.2); color:#e879f9; padding:3px 8px; border-radius:6px; border:1px solid #d946ef; font-weight:bold; cursor:pointer;"><i class="ti ti-hammer"></i> Forçar</button>`;
      }
      return `<article class="proposal-card" data-status="${result.status}"><div class="card-top"><div class="card-id"><span class="number">Nº ${order}</span><div class="card-title"><span>${esc(type)}</span><h3>${esc(title)}</h3><p>Por ${esc(author)}</p></div></div><button class="trash" onclick="removeActive(${order})" title="Excluir proposta"><i class="ti ti-trash"></i></button></div><div style="display:flex; align-items:center; margin-bottom:12px;"><span class="status" style="margin-bottom:0;">${esc(result.label)}</span>${btnForcar}</div><p class="content">${esc(content)}</p><footer class="card-footer"><small>Simulação</small><button onclick="showVotes('${encoded}',${order})"><i class="ti ti-messages"></i> ${list.length} parecer(es)</button></footer></article>`;
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

  window.removeActive = async(order) => { 
      if(!await ask(`Excluir proposta nº ${order}?`, 'A proposta simulada será apagada.', 'Excluir')) return; 
      state.proposals = state.proposals.filter(p => orderOf(p) !== order);
      state.votes = state.votes.filter(v => voteOrder(v) !== order);
      renderProposals(); renderCouncil(); toast('Proposta simulada excluída.', 'success'); 
  };

  // ==========================================
  // FORÇAR VOTO (MODAL)
  // ==========================================
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
      
      // Remove voto antigo liderança se houver e adiciona o novo
      state.votes = state.votes.filter(v => !(voteOrder(v) === Number(ordem) && low(v.Nick) === low(state.nick)));
      state.votes.push({ Nick: state.nick, Ordem: Number(ordem), Comentario: comentario, Veredito: veredito });
      
      renderProposals(); renderCouncil(); toast("Resultado simulado forçado com sucesso!", "success");
  };

  // ==========================================
  // LÓGICA REAL DE ADVERTÊNCIAS (FÓRUM)
  // ==========================================
  function validAttachmentUrl(value){ try{ const url = new URL(clean(value)); return ['http:','https:'].includes(url.protocol) ? url.href : ''; }catch(_){ return ''; } }

  function missingCouncilAssessments(){
      const requiredOrders = [...new Set(state.proposals.map(orderOf))];
      if(!requiredOrders.length) return [];
      return state.council.map(member => {
          const nick = clean(member.name);
          if(!nick || state.licenses.has(low(nick))) return null;
          const answered = new Set(state.votes.filter(vote => low(vote.Nick) === low(nick)).map(voteOrder));
          const missing = requiredOrders.filter(order => !answered.has(order));
          return missing.length ? { nick, cargo: clean(member.cargo), missing, answered: answered.size, total: requiredOrders.length } : null;
      }).filter(Boolean);
  }

  function requestWarningAttachment(members){
      let dialog = $('warning-attachment-dialog');
      if(!dialog){
          dialog = document.createElement('dialog'); dialog.id = 'warning-attachment-dialog'; dialog.className = 'dialog';
          dialog.innerHTML = `<div class="dialog-card"><header><div><p class="eyebrow">Conselho da Assistência</p><h2>Advertências do ciclo</h2></div><button id="warning-attachment-close" class="icon-button" type="button"><i class="ti ti-x"></i></button></header><div class="dialog-body"><p>Os membros abaixo não avaliaram todas as propostas e receberão MP/Tópico no fórum (Simulação Real).</p><div id="warning-member-list" class="access-list"></div><label class="field wide" style="margin-top:18px"><span>Link do print comprobatório</span><input id="warning-attachment-url" type="url" placeholder="https://i.imgur.com/exemplo.png" required></label><p id="warning-attachment-error" style="color:#ef6b78;display:none;margin-top:8px">Informe um link válido de imagem.</p></div><footer><button id="warning-attachment-cancel" class="secondary-button" type="button">Cancelar</button><button id="warning-attachment-confirm" class="primary-button" type="button"><i class="ti ti-alert-triangle"></i> Enviar Advertências no Fórum!</button></footer></div>`;
          document.body.appendChild(dialog);
      }
      $('warning-member-list').innerHTML = members.map(m => `<span class="access-chip"><span>${esc(m.cargo)} ${esc(m.nick)} · ${m.answered}/${m.total} avaliadas</span></span>`).join('');
      $('warning-attachment-url').value = ''; $('warning-attachment-error').style.display = 'none'; dialog.showModal();
      return new Promise(resolve => {
          let finished = false;
          const finish = value => { if(finished) return; finished = true; if(dialog.open) dialog.close(); resolve(value); };
          $('warning-attachment-confirm').onclick = () => { const url = validAttachmentUrl($('warning-attachment-url').value); if(!url){ $('warning-attachment-error').style.display = 'block'; return; } finish(url); };
          $('warning-attachment-cancel').onclick = () => finish(''); $('warning-attachment-close').onclick = () => finish(''); dialog.addEventListener('cancel', e => { e.preventDefault(); finish(''); }, {once:true});
      });
  }

  async function forumSubmit(path, data){
      const body = new URLSearchParams();
      Object.entries(data).forEach(([key,value]) => body.append(key, clean(value)));
      const response = await fetch(path, { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'}, body:body.toString() });
      if(!response.ok) throw new Error(`Erro no Fórum HTTP ${response.status}`);
  }

  function warningTopicBBCode(member){
      const today = new Intl.DateTimeFormat('pt-BR', {timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date());
      return `[font=Poppins][size=18][center][color=#560c7e][b]ADVERTÊNCIA INTERNA[/b][/color][/center][/size]\n\n[justify][b]Cargo e nick do(a) advertido(a):[/b] ${member.cargo} ${member.nick}\n[b]Motivo(s):[/b] Não avaliou às propostas em tempo hábil.\n[b]Data:[/b] ${today}\n[b]Permissão:[/b] Conselho da Assistência\n[/justify][/font]`;
  }

  function warningPrivateMessageBBCode(member, attachment){
      return `[font=Poppins]<div style="border:1.5rem solid #821F88;border-radius:8px;font-family:Poppins;">[table][tr][td][center][img]https://i.imgur.com/hU7bn8R.gif[/img][/center]\n\n[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][center][img]https://i.imgur.com/QL68H2C.png[/img][/center][size=20][font=Poppins][color=white][b]CARTA DE ADVERTÊNCIA INTERNA[/b][/color][/font][/size][/td][/tr][/table]\n<div style="padding:1.5%;border:1px solid #bdbdbd;border-radius:8px;">[justify]Saudações, [b]${member.nick}[/b].\n\nInforma-se que você [b]recebeu uma advertência interna[/b] na companhia pelo(s) seguinte(s) motivo(s):\n\n[b]Não respondeu às propostas durante o ciclo semanal.[/b]\n\n[color=#821F88][b]COMENTÁRIOS:[/b][/color] O membro não registrou seu parecer nas propostas do período e não possuía licença ativa.\n\n[color=#821F88][b]ANEXOS:[/b][/color] ${attachment}.\n\nLeia as documentações que regem a companhia [url=https://sites.google.com/view/nexusprof/documenta%C3%A7%C3%B5es?authuser=3]clicando aqui[/url] e procure manter-se atento para evitar mais punições. Caso queira recorrer da punição recebida, procure a Liderança apresentando argumentos factuais e plausíveis.[/justify]</div>[/td][/tr][/table]</div>[/font]\n[font=Poppins][center]Atentamente,\n[img]https://i.imgur.com/1kZvQHs.png[/img][/center][/font]`;
  }

  // ==========================================
  // SIMULAÇÃO DO FECHAMENTO (CHAMA O FÓRUM REAL)
  // ==========================================
  async function closeCycle(){
      if(state.busy) return;
      const ok=await ask('Simular Fechamento?', 'Essa ação vai abrir o popup de advertência e, caso você confirme o anexo, o sistema VAI ENVIAR DE VERDADE a MP e postar no Tópico.');
      if(!ok) return;

      state.busy=true; busy($('close-cycle'),true,'Conferindo…');
      try{
          const warningTargets = missingCouncilAssessments();
          let attachment='';

          if(warningTargets.length){
              busy($('close-cycle'),false);
              attachment = await requestWarningAttachment(warningTargets);
              if(!attachment){ toast('Fechamento cancelado: informe o link do print para aplicar as advertências.','warning'); return; }
              busy($('close-cycle'),true,'Fechando e Postando no Fórum…');
              
              toast("Disparando BBCode no Fórum...", "loading");
              for(const member of warningTargets){
                  // DISPARA NO TÓPICO REAL (Mude o ID 32246 se quiser testar em outro tópico)
                  await forumSubmit('/post', {t:'32246', message:warningTopicBBCode(member), mode:'reply', post:'Enviar'});
                  // DISPARA MENSAGEM PRIVADA REAL
                  await forumSubmit('/privmsg', {folder:'inbox', mode:'post', post:'1', 'username[]':member.nick, subject:'[PROF] CARTA DE ADVERTÊNCIA INTERNA', message:warningPrivateMessageBBCode(member, attachment)});
              }
          }

          // Limpa a tela simulando que fechou
          state.proposals = [];
          state.votes = [];
          renderProposals();
          renderCouncil();
          $('cycle-label').textContent = 'Novo Ciclo Iniciado';
          toast('Teste de fechamento concluído! Verifique a sua caixa de Mensagens Privadas.', 'success');
      }catch(e){
          toast(e.message||'Interrompido.','error');
      }finally{
          state.busy=false; busy($('close-cycle'),false);
      }
  }

  // ==========================================
  // INICIALIZAÇÃO
  // ==========================================
  function navigate(name){ document.querySelectorAll('.view').forEach(v => v.hidden = v.id!==`view-${name}`); document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view===name)); const labels = {propostas:'Central de Propostas', historico:'Histórico de Propostas', configuracoes:'Configurações da Central'}; $('page-label').textContent = labels[name]; }
  
  function bind(){
      document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.view)));
      $('open-launch').onclick=()=>$('launch-dialog').showModal();
      document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
      $('launch-form').onsubmit=(e)=>{ e.preventDefault(); toast("Lançamento simulado desativado.", "warning"); };
      $('proposal-search').oninput=e=>{ state.search=e.target.value; renderProposals(); };
      $('close-cycle').onclick=closeCycle;
      document.querySelectorAll('.dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d) d.close();}));
  }

  setTimeout(() => {
      $('access-screen').hidden = true;
      $('current-nick').textContent = state.nick;
      $('current-role').textContent = state.profile.cargo;
      $('current-avatar').src = `https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(state.nick)}&direction=2&head_direction=3&gesture=sml&size=m&headonly=1`;
      $('cycle-label').textContent = 'Ciclo de Simulação';
      
      state.council = state.members;
      bind();
      renderProposals();
      renderCouncil();
      navigate('propostas');
      toast("Modo Simulador de Fechamento Iniciado!", "warning");
  }, 1000);

})();
