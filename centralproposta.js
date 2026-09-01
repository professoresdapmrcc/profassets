(() => {
  'use strict';
  if (!document.getElementById('proposal-central-app')) return;

  const FIREBASE_CONFIG = Object.freeze({apiKey:'AIzaSyDo4DagZchii1cPKFighZU5KAjppp98HJE',authDomain:'nexusprof.firebaseapp.com',projectId:'nexusprof',storageBucket:'nexusprof.appspot.com',messagingSenderId:'268861178598',appId:'1:268861178598:web:9686b81bb003f9514fb127',measurementId:'G-MY150DZMTM'});
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzTHOBFaiSFvtbIhfEwU_14F53LDhOV2H_pw6qj6dy9EmS4LkHUZhrImG_2GWgjup9p/exec';
  const ROLES = ['Estagiário(a)','Conselheiro(a)','Líder','Vice-Líder','Liderança'];
  const COUNCIL_LIST_EXCLUDED_NICKS = new Set(['pmjrcc']);
  
  const state = {db:null, auth:null, nick:'', profile:null, access:[], cycle:null, pending:null, proposals:[], votes:[], members:[], council:[], licenses:new Set(), backups:new Map(), search:'', busy:false, unsubs:[]};
  
  const $ = id => document.getElementById(id);
  const clean = value => String(value ?? '').trim();
  const low = value => clean(value).toLocaleLowerCase('pt-BR');
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const ts = () => firebase.firestore.FieldValue.serverTimestamp();

  function withTimeout(operation, milliseconds, message){
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    });
    return Promise.race([Promise.resolve(operation), timeout]).finally(() => clearTimeout(timer));
  }

  function accessStatus(title, message){
    const titleElement = $('access-title'), messageElement = $('access-message');
    if(titleElement) titleElement.textContent = title;
    if(messageElement) messageElement.textContent = message;
  }
  
  const orderOf = p => Number(p.ordem ?? p.Ordem ?? 0);
  const voteOrder = v => Number(v.Ordem ?? v.ordem ?? 0);
  const idOf = p => clean(p.id || p.ordemId || orderOf(p));
  
  const proposals = () => state.db.collection('nexus_config').doc('Propostas').collection('lista_propostas');
  const votes = () => state.db.collection('nexus_config').doc('Propostas').collection('votos_conselho');
  const cycles = () => state.db.collection('nexus_config').doc('Propostas').collection('ciclos');
  const currentCycle = () => state.db.collection('nexus_config').doc('Propostas').collection('configuracoes').doc('ciclo_atual');
  const accessDoc = () => state.db.collection('nexus_config').doc('Propostas').collection('configuracoes').doc('acessos');
  const backups = () => state.db.collection('nexus_config').doc('backup_respostas').collection('historico');

  // ==========================================
  // AUTENTICAÇÃO INFALÍVEL COM O FÓRUM
  // ==========================================
  function validForumNick(value){
    const nick = clean(value), blocked = ['ANONYMOUS','ANÔNIMO','ANONIMO','CONVIDADO','GUEST'];
    return nick && !blocked.includes(nick.toLocaleUpperCase('pt-BR')) ? nick : '';
  }
  
  function decodeForumNick(value){
    const unescaped = clean(value)
      .replace(/\\x([0-9a-f]{2})/gi, (_,hex) => String.fromCharCode(parseInt(hex,16)))
      .replace(/\\u([0-9a-f]{4})/gi, (_,hex) => String.fromCharCode(parseInt(hex,16)))
      .replace(/\\(['"\\])/g, '$1');
    const decoder = document.createElement('textarea'); decoder.innerHTML = unescaped;
    return validForumNick(decoder.value);
  }
  
  async function forumNick(){
    const data = window._userdata || {};
    const direct = validForumNick(data.username);
    const explicitlyGuest = Number(data.session_logged_in) === 0 || Number(data.user_id) === -1;
    if(direct && !explicitlyGuest) return direct;

    try{
      // Lê ativamente a conexão da raiz do fórum para evitar bloqueios
      const response = await withTimeout(
          fetch('/forum', {credentials:'same-origin', cache:'no-store'}),
          10000,
          'O fórum demorou demais para confirmar sua sessão.'
      );
      if(!response.ok) throw Error(`HTTP ${response.status}`);
      const html = await response.text();
      const patterns = [
        /_userdata\s*\[\s*['"]username['"]\s*\]\s*=\s*['"]([^'"]+)['"]/i,
        /_userdata\.username\s*=\s*['"]([^'"]+)['"]/i,
        /["']username["']\s*:\s*["']([^"']+)["']/i
      ];
      for(const pattern of patterns){
          const match = html.match(pattern);
          const nick = match ? decodeForumNick(match[1]) : '';
          if(nick) return nick;
      }
      throw Error('Usuário não localizado no HTML.');
    }catch(error){
      console.error('Falha ao identificar usuário:', error);
      return '';
    }
  }

  // ==========================================
  // REGRAS DE CARGOS E ACESSOS
  // ==========================================
  function roleAllowed(role){
    const cargo = clean(role);
    if(low(cargo).includes('ex-') || low(cargo).startsWith('ex ')) return false;
    return ROLES.some(item => cargo === item || cargo.includes(item));
  }
  function normalized(value){
    return low(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }
  function councilParticipant(member){
    const nick = normalized(member?.name || member?.nick);
    const role = normalized(member?.cargo);
    if(!nick || COUNCIL_LIST_EXCLUDED_NICKS.has(nick)) return false;
    if(role === 'lider' || role === 'vice-lider') return false;
    return roleAllowed(member?.cargo);
  }
  function councilParticipantOrder(first, second){
    const roleWeight = member => {
      const role = normalized(member?.cargo);
      if(role.includes('conselheiro')) return 0;
      if(role.includes('estagiario')) return 1;
      if(role === 'lideranca') return 2;
      return 3;
    };
    return roleWeight(first) - roleWeight(second)
      || clean(first?.name || first?.nick).localeCompare(clean(second?.name || second?.nick),'pt-BR',{sensitivity:'base'});
  }
  function nickAllowed(nick){ return state.access.some(item => low(item) === low(nick)); }
  function isLideranca() { return ['Líder', 'Vice-Líder', 'Liderança'].includes(clean(state.profile?.cargo)); }

  function formatDate(value, time=false){
      if(!value) return 'Data indisponível';
      const d = typeof value.toDate==='function' ? value.toDate() : new Date(value);
      if(isNaN(d)) return 'Data indisponível';
      return new Intl.DateTimeFormat('pt-BR', time ? {timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'} : {timeZone:'America/Sao_Paulo',day:'2-digit',month:'short',year:'numeric'}).format(d);
  }
  function friday(){ return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',weekday:'long'}).format(new Date()).toLowerCase().startsWith('sexta'); }
  function cycleId(){ return `ciclo_${Date.now()}_${clean(state.auth.currentUser?.uid).slice(0,6)||'forum'}`; }
  function nextFriday(){ const d=new Date(); let n=(5-d.getDay()+7)%7; if(!n) n=7; d.setDate(d.getDate()+n); d.setHours(23,59,59,999); return d.toISOString(); }

  // Componentes de UI
  function toast(message, type='info', title=''){
    const labels = {success:'Sucesso', error:'Erro', warning:'Atenção', info:'Informação'}, icons = {success:'ti-circle-check', error:'ti-circle-x', warning:'ti-alert-triangle', info:'ti-info-circle'};
    const el = document.createElement('div'); el.className = 'toast'; el.dataset.type = type;
    el.innerHTML = `<i class="ti ${icons[type]||icons.info}"></i><div><strong>${esc(title||labels[type])}</strong><span>${esc(message)}</span></div>`;
    $('toast-container').append(el);
    setTimeout(() => el.remove(), type==='error' ? 7000 : 4800);
  }
  function busy(button, on, label='Processando…'){ if(!button) return; if(on){ button.dataset.html = button.innerHTML; button.disabled = true; button.innerHTML = `<span class="loader" style="width:17px;height:17px;border-width:2px"></span>${esc(label)}`; }else{ button.disabled = false; if(button.dataset.html) button.innerHTML = button.dataset.html; delete button.dataset.html; } }
  function ask(title, message, label='Confirmar', danger=true){ const d=$('confirm-dialog'); $('confirm-title').textContent=title; $('confirm-message').textContent=message; $('confirm-yes').textContent=label; $('confirm-yes').className=danger?'danger-button':'primary-button'; d.showModal(); return new Promise(resolve=>d.addEventListener('close',()=>resolve(d.returnValue==='confirm'),{once:true})); }
  function deny(title, message){ $('access-title').textContent=title; $('access-message').textContent=message; const l=$('access-screen').querySelector('.loader'); if(l) l.hidden=true; }
  
  function allow(){ 
      $('current-nick').textContent = state.nick;
      $('current-role').textContent = clean(state.profile?.cargo) || 'Acesso adicional';
      $('current-avatar').src = `https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(state.nick)}&direction=2&head_direction=3&gesture=sml&size=m&headonly=1`;
      $('access-screen').classList.add('hidden');
      setTimeout(() => $('access-screen').hidden = true, 220);
  }

  // ==========================================
  // FIREBASE E INICIALIZAÇÃO
  // ==========================================
  async function firebaseSession(){
    if(typeof firebase === 'undefined') throw new Error('As bibliotecas do Firebase não foram carregadas.');
    if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    state.auth = firebase.auth(); state.db = firebase.firestore();
    if(!state.auth.currentUser){
        const credential = await withTimeout(
            state.auth.signInAnonymously(),
            15000,
            'O Firebase Authentication não respondeu em 15 segundos.'
        );
        if(!credential || !credential.user) throw new Error('O Firebase não criou a sessão anônima.');
    }
  }
  
  async function loadIdentity(){
    if(!state.nick) state.nick = await forumNick();
    if(!state.nick){
        deny('Acesso negado', 'Não foi possível identificar sua conta. Conecte-se ao fórum e tente novamente.');
        return false;
    }
    accessStatus('Validando permissão', `Usuário identificado: ${state.nick}. Consultando seus acessos…`);
    const [byName, byNick, access] = await withTimeout(
        Promise.all([
            state.db.collection('users').where('name','==',state.nick).limit(1).get(),
            state.db.collection('users').where('nick','==',state.nick).limit(1).get(),
            accessDoc().get()
        ]),
        15000,
        'O Firestore não respondeu durante a validação do acesso.'
    );
    const doc = !byName.empty ? byName.docs[0] : (!byNick.empty ? byNick.docs[0] : null);
    state.profile = doc ? {id: doc.id, ...doc.data()} : null;
    state.access = access.exists && Array.isArray(access.data().nicknames) ? access.data().nicknames : [];
    
    if(!roleAllowed(state.profile?.cargo) && !nickAllowed(state.nick)){
        deny('Acesso bloqueado', 'Seu cargo ou nickname não possui permissão para acessar esta Central.');
        return false;
    }
    return true;
  }

  async function ensureCycle(){
    state.cycle = await state.db.runTransaction(async tx => {
        const ref = currentCycle(), snap = await tx.get(ref);
        if(snap.exists && snap.data().status==='aberto' && snap.data().id) return snap.data();
        const id = cycleId(), data = {id, status:'aberto', inicioEm:ts(), inicioIso:new Date().toISOString(), previsaoFimIso:nextFriday(), abertoPor:state.nick, abertoPorUid:state.auth.currentUser.uid, atualizadoEm:ts()};
        tx.set(ref, data); tx.set(cycles().doc(id), data); return data;
    });
    renderCycle(); return state.cycle;
  }
  
  async function migrateLegacy(){
      const snap = await proposals().get(); let batch = state.db.batch(), count = 0, total = 0;
      for(const doc of snap.docs){
          if(doc.data().cicloId) continue;
          batch.update(doc.ref, {cicloId:state.cycle.id, ordemId:clean(doc.data().ordemId||doc.id), atualizadoEm:ts()});
          count++; total++;
          if(count===400){ await batch.commit(); batch=state.db.batch(); count=0; }
      }
      if(count) await batch.commit();
      if(total) toast(`${total} propostas antigas vinculadas.`, 'info');
  }
  
  function renderCycle(){ $('cycle-label').textContent = state.cycle ? `${formatDate(state.cycle.inicioEm||state.cycle.inicioIso)} → próxima sexta` : 'Preparando…'; }

  // ==========================================
  // BANCO DE DADOS EM TEMPO REAL
  // ==========================================
  async function loadPeople(){
      const [u, l] = await Promise.all([state.db.collection('users').get(), state.db.collection('licencas').where('status_licenca','==','Ativa').get()]);
      
      // FILTRO RIGOROSO: Apenas Status 'Ativo'
      state.members = u.docs.map(d => ({id: d.id, ...d.data()})).filter(m => m.status === 'Ativo');
      
      state.council = state.members
          .filter(councilParticipant)
          .sort(councilParticipantOrder);
      state.licenses = new Set(l.docs.map(d => low(d.data().nickname)).filter(Boolean));
      
      $('member-list').innerHTML = state.members.map(m => clean(m.name||m.nick)).filter(Boolean).sort((a,b)=>a.localeCompare(b,'pt-BR')).map(n => `<option value="${esc(n)}"></option>`).join('');
      renderCouncil();
  }
  
  function startLive(){
      state.unsubs.forEach(fn=>fn());
      state.unsubs = [
        currentCycle().onSnapshot(s => {if(s.exists){state.cycle=s.data(); renderCycle(); renderProposals(); renderCouncil();}}),
        proposals().orderBy('ordem','desc').onSnapshot(s => {state.proposals=s.docs.map(d=>({id:d.id,...d.data()})); renderProposals(); renderCouncil();}, liveError),
        votes().onSnapshot(s => {state.votes=s.docs.map(d=>({id:d.id,...d.data()})); renderProposals(); renderCouncil();}, liveError),
        accessDoc().onSnapshot(s => {
            state.access = s.exists && Array.isArray(s.data().nicknames) ? s.data().nicknames : [];
            if(!roleAllowed(state.profile?.cargo) && !nickAllowed(state.nick)){
                deny('Acesso removido','Seu nickname não possui mais acesso.');
                $('access-screen').hidden=false; $('access-screen').classList.remove('hidden');
                state.unsubs.forEach(fn=>fn());
            }
            renderAccess();
        }, liveError),
        cycles().where('status','in',['fechando','erro']).onSnapshot(s => {
            const d = s.docs[0]; state.pending = d ? {id:d.id, ...d.data()} : null; renderRecovery();
        }, liveError)
      ];
  }
  function liveError(error){ console.error(error); toast('Falha na sincronização em tempo real.', 'error'); }
  function activeProposals(){ return state.cycle ? state.proposals.filter(p => p.cicloId===state.cycle.id) : []; }
  function votesFor(p, list=state.votes){ return list.filter(v => voteOrder(v)===orderOf(p)); }

  // ==========================================
  // ADVERTÊNCIAS POR AVALIAÇÃO INCOMPLETA
  // ==========================================
  function missingCouncilAssessments(proposalList=activeProposals(), voteList=state.votes){
      const requiredOrders = [...new Set(proposalList.map(orderOf).filter(order => order > 0))];
      if(!requiredOrders.length) return [];

      return state.council.map(member => {
          const nick = clean(member.name || member.nick);
          if(!nick || state.licenses.has(low(nick))) return null;
          const answered = new Set(
              voteList
                  .filter(vote => low(vote.Nick || vote.nick) === low(nick))
                  .map(voteOrder)
                  .filter(order => order > 0)
          );
          const missing = requiredOrders.filter(order => !answered.has(order));
          return missing.length ? {
              nick,
              cargo: clean(member.cargo || 'Membro'),
              missing,
              answered: requiredOrders.length - missing.length,
              total: requiredOrders.length
          } : null;
      }).filter(Boolean);
  }

  function validAttachmentUrl(value){
      try{
          const url = new URL(clean(value));
          return ['http:','https:'].includes(url.protocol) ? url.href : '';
      }catch(_){
          return '';
      }
  }

  function requestWarningAttachment(members){
      let dialog = $('warning-attachment-dialog');
      if(!dialog){
          dialog = document.createElement('dialog');
          dialog.id = 'warning-attachment-dialog';
          dialog.className = 'dialog';
          dialog.innerHTML = `
              <div class="dialog-card">
                  <header>
                      <div><p class="eyebrow">Conselho da Assistência</p><h2>Advertências do ciclo</h2></div>
                      <button id="warning-attachment-close" class="icon-button" type="button"><i class="ti ti-x"></i></button>
                  </header>
                  <div class="dialog-body">
                      <p>Os membros abaixo não avaliaram todas as propostas e não estão de licença.</p>
                      <div id="warning-member-list" class="access-list"></div>
                      <label class="field wide" style="margin-top:18px">
                          <span>Link do print comprobatório</span>
                          <input id="warning-attachment-url" type="url" placeholder="https://i.imgur.com/exemplo.png" required>
                      </label>
                      <p id="warning-attachment-error" style="color:#ef6b78;display:none;margin-top:8px">Informe um endereço começando com http:// ou https://.</p>
                  </div>
                  <footer>
                      <button id="warning-attachment-cancel" class="secondary-button" type="button">Cancelar</button>
                      <button id="warning-attachment-confirm" class="primary-button" type="button"><i class="ti ti-alert-triangle"></i> Continuar fechamento</button>
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
          const finish = value => {
              if(finished) return;
              finished = true;
              if(dialog.open) dialog.close();
              resolve(value);
          };
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

  async function forumSubmit(path, data){
      const body = new URLSearchParams();
      Object.entries(data).forEach(([key,value]) => body.append(key, clean(value)));
      const response = await withTimeout(fetch(path, {
          method:'POST',
          credentials:'same-origin',
          headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
          body:body.toString()
      }), 20000, `O fórum não respondeu ao enviar ${path}.`);
      if(!response.ok) throw new Error(`O fórum recusou ${path} (HTTP ${response.status}).`);
      if(/\/(login|login_register|connexion)/i.test(response.url)) throw new Error('A sessão do fórum expirou durante o envio das advertências.');
  }

  function postingDate(){
      return new Intl.DateTimeFormat('pt-BR', {timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date());
  }

  function assistanceDateFields(){
      const formatted=postingDate(),parts=formatted.split('/').map(Number);
      const start=new Date(Date.UTC(parts[2],parts[1]-1,parts[0]));
      const end=new Date(start);end.setUTCDate(end.getUTCDate()+30);
      const pad=value=>String(value).padStart(2,'0');
      return {
          formatted,
          iso:`${parts[2]}-${pad(parts[1])}-${pad(parts[0])}`,
          end:`${pad(end.getUTCDate())}/${pad(end.getUTCMonth()+1)}/${end.getUTCFullYear()}`
      };
  }

  async function sendWarningToAssistance(member,cycle,attachment){
      const dates=assistanceDateFields();
      const safeNick=member.nick.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,80)||'membro';
      const safeCycle=clean(cycle).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100)||'ciclo';
      const recordId=`proposta_${safeCycle}_${safeNick}`.slice(0,190);
      const record={
          cargo:member.cargo,
          nick:member.nick,
          punicao:'ADVERTÊNCIA INTERNA',
          motivo:'Não avaliou às propostas em tempo hábil.',
          permissao:'Conselho da Assistência',
          data_formatada:dates.formatted,
          data_iso:dates.iso,
          data_termino:dates.end,
          decisao:'PENDENTE',
          observacao:'',
          carta_enviada:true,
          autor_postagem:state.nick,
          sincronizado_sheets:false,
          tipo_ocorrencia:'adv_interna',
          origem:'central_propostas',
          ciclo_id:cycle,
          anexo:attachment,
          propostas_nao_avaliadas:member.missing,
          quantidade_avaliadas:member.answered,
          quantidade_propostas:member.total,
          timestamp:ts()
      };
      await withTimeout(
          state.db.collection('assistencia_registros').doc(recordId).set(record),
          15000,
          'O Firebase não respondeu ao registrar a advertência na Assistência.'
      );
  }

  function warningTopicBBCode(member){
      const today = postingDate();
      return `[font=Poppins][size=18][center][color=#560c7e][b]ADVERTÊNCIA INTERNA[/b][/color][/center][/size]\n\n[justify][b]Cargo e nick do(a) advertido(a):[/b] ${member.cargo} ${member.nick}\n[b]Motivo(s):[/b] Não avaliou às propostas em tempo hábil.\n[b]Data:[/b] ${today}\n[b]Permissão:[/b] Conselho da Assistência\n[/justify][/font]`;
  }

  function warningPrivateMessageBBCode(member, attachment){
      return `[font=Poppins]<div style="border:1.5rem solid #821F88;border-radius:8px;font-family:Poppins;">[table][tr][td][center][img]https://i.imgur.com/hU7bn8R.gif[/img][/center]\n\n[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][center][img]https://i.imgur.com/QL68H2C.png[/img][/center][size=20][font=Poppins][color=white][b]CARTA DE ADVERTÊNCIA INTERNA[/b][/color][/font][/size][/td][/tr][/table]\n<div style="padding:1.5%;border:1px solid #bdbdbd;border-radius:8px;">[justify]Saudações, [b]${member.nick}[/b].\n\nInforma-se que você [b]recebeu uma advertência interna[/b] na companhia pelo(s) seguinte(s) motivo(s):\n\n[b]Não respondeu às propostas durante o ciclo semanal.[/b]\n\n[color=#821F88][b]COMENTÁRIOS:[/b][/color] O membro não registrou seu parecer nas propostas do período e não possuía licença ativa.\n\n[color=#821F88][b]ANEXOS:[/b][/color] ${attachment}.\n\nLeia as documentações que regem a companhia [url=https://sites.google.com/view/nexusprof/documenta%C3%A7%C3%B5es?authuser=3]clicando aqui[/url] e procure manter-se atento para evitar mais punições. Caso queira recorrer da punição recebida, procure a Liderança apresentando argumentos factuais e plausíveis.[/justify]</div>[/td][/tr][/table]</div>[/font]\n[font=Poppins][center]Atentamente,\n[img]https://i.imgur.com/1kZvQHs.png[/img][/center][/font]`;
  }

  async function sendMissingAssessmentWarnings(cycle, proposalList, voteList, attachment='', storedMembers=null){
      const members = Array.isArray(storedMembers) ? storedMembers : missingCouncilAssessments(proposalList, voteList);
      if(!members.length) return 0;
      let proof = validAttachmentUrl(attachment);
      if(!proof) proof = await requestWarningAttachment(members);
      if(!proof) throw new Error('O fechamento foi pausado porque o link do print não foi informado.');

      const cycleRef = cycles().doc(cycle);
      await cycleRef.set({advertenciaAnexo:proof,advertenciasPrevistas:members.length},{merge:true});
      const cycleSnapshot = await cycleRef.get(), cycleData = cycleSnapshot.data() || {};
      const assistanceSent = new Set(Array.isArray(cycleData.advertenciasAssistenciaEnviada) ? cycleData.advertenciasAssistenciaEnviada.map(low) : []);
      const topicSent = new Set(Array.isArray(cycleData.advertenciasTopicoEnviado) ? cycleData.advertenciasTopicoEnviado.map(low) : []);
      const pmSent = new Set(Array.isArray(cycleData.advertenciasMpEnviada) ? cycleData.advertenciasMpEnviada.map(low) : []);

      for(const member of members){
          // O registro da Assistência é obrigatório e acontece antes de qualquer
          // postagem no tópico ou envio de Mensagem Privada.
          if(!assistanceSent.has(low(member.nick))){
              await sendWarningToAssistance(member,cycle,proof);
              await cycleRef.set({advertenciasAssistenciaEnviada:firebase.firestore.FieldValue.arrayUnion(member.nick)},{merge:true});
              assistanceSent.add(low(member.nick));
          }
          if(!topicSent.has(low(member.nick))){
              await forumSubmit('/post', {t:'32246',message:warningTopicBBCode(member),mode:'reply',post:'Enviar'});
              await cycleRef.set({advertenciasTopicoEnviado:firebase.firestore.FieldValue.arrayUnion(member.nick)},{merge:true});
              topicSent.add(low(member.nick));
          }
          if(!pmSent.has(low(member.nick))){
              await forumSubmit('/privmsg', {folder:'inbox',mode:'post',post:'1','username[]':member.nick,subject:'[PROF] CARTA DE ADVERTÊNCIA INTERNA',message:warningPrivateMessageBBCode(member,proof)});
              await cycleRef.set({advertenciasMpEnviada:firebase.firestore.FieldValue.arrayUnion(member.nick)},{merge:true});
              pmSent.add(low(member.nick));
          }
      }
      await cycleRef.set({advertenciasConcluidas:members.length,advertenciasFinalizadasEm:ts(),advertenciasFinalizadasPor:state.nick},{merge:true});
      return members.length;
  }

  // ==========================================
  // RENDERIZAÇÃO
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
      list.forEach(v => {
          const x = low(v.Veredito||v.veredito);
          if(x.includes('aprovada')) c.approved++; else if(x.includes('reprovada')) c.rejected++; else if(x.includes('tutela')) c.tutela++; else if(x.includes('reuni')) c.reuniao++; else if(x.includes('lideran')) c.lideranca++; else if(x.includes('autoria')) c.autoria++;
      });
      const max = Math.max(...Object.values(c)), w = Object.keys(c).filter(k => c[k]===max && max>0);
      if(w.length!==1) return {key:'tie', label:'Empate técnico', status:'pending'};
      const key = w[0], labels = {approved:'Maioria aprovou', rejected:'Maioria reprovou', tutela:'Encaminhada à tutela', reuniao:'Encaminhada à reunião', lideranca:'Pendente da Liderança', autoria:'Retorno à autoria'};
      return {key, label:labels[key], status:key==='approved'?'approved':key==='rejected'?'rejected':'attention'};
  }
  
  function leaderNicks(){ return new Set(state.members.filter(m => ['Líder','Vice-Líder','Liderança'].includes(clean(m.cargo))).flatMap(m => [low(m.name),low(m.nick)]).filter(Boolean)); }
  
  function renderCouncil(){
      if(!state.council.length) return;
      const orders = new Set(activeProposals().map(orderOf)), relevant = state.votes.filter(v => orders.has(voteOrder(v)));
      $('council-grid').innerHTML = state.council.map(m => {
          const nick = clean(m.name||m.nick||'Desconhecido'), list = relevant.filter(v => low(v.Nick||v.nick)===low(nick)), leave = state.licenses.has(low(nick));
          let fav=0, rep=0, neu=0;
          list.forEach(v => { const x = low(v.Veredito||v.veredito); if(x.includes('aprovada')) fav++; else if(x.includes('reprovada')) rep++; else neu++; });
          const stats = leave ? '<span class="warning">Licença ativa</span>' : list.length ? `<span class="success">✓ ${fav}</span><span class="danger">× ${rep}</span><span class="info-text">– ${neu}</span>` : '<span class="danger">Pendente</span>';
          return `<article class="member-card" data-state="${leave?'leave':list.length?'done':'pending'}"><img src="https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(nick)}&direction=2&head_direction=2&gesture=sml&size=s&headonly=1" alt=""><div class="member-copy"><strong>${esc(nick)}</strong><small>${esc(m.cargo||'Membro')}</small><div class="member-stats">${stats}</div></div></article>`;
      }).join('');
  }

  function card(p, opt={}){
      const list = opt.votes || votesFor(p), result = decision(p, list, leaderNicks()), order = orderOf(p), title = clean(p.titulo||p.Titulo||'Sem tema'), author = clean(p.autor||p.Autor||'Não informado'), type = clean(p.tipo||p.Categoria||'Proposta'), content = clean(p.conteudo||p.Conteudo||'Nenhum conteúdo detalhado.'), encoded = encodeURIComponent(JSON.stringify(list)), action = opt.backup ? `removeHistory('${esc(opt.backup)}','${esc(idOf(p))}',${order})` : `removeActive('${esc(idOf(p))}',${order})`;
      
      // BOTÃO DA LIDERANÇA
      let btnForcar = '';
      if (isLideranca()) {
          const backupStr = opt.backup ? `'${esc(opt.backup)}'` : 'null';
          btnForcar = `<button type="button" onclick="abrirModalForcarVoto(${order}, ${backupStr})" title="Forçar Veredito da Liderança" style="margin-left:8px; font-size:10px; background:rgba(192, 38, 211, 0.2); color:#e879f9; padding:3px 8px; border-radius:6px; border:1px solid #d946ef; font-weight:bold; cursor:pointer;"><i class="ti ti-hammer"></i> Forçar</button>`;
      }

      return `<article class="proposal-card" data-status="${result.status}"><div class="card-top"><div class="card-id"><span class="number">Nº ${order||'—'}</span><div class="card-title"><span>${esc(type)}</span><h3 title="${esc(title)}">${esc(title)}</h3><p>Por ${esc(author)}</p></div></div><button class="trash" onclick="${action}" title="Excluir proposta"><i class="ti ti-trash"></i></button></div><div style="display:flex; align-items:center; margin-bottom:12px;"><span class="status" style="margin-bottom:0;">${esc(result.label)}</span>${btnForcar}</div><p class="content">${esc(content)}</p><footer class="card-footer"><small>${esc(formatDate(p.criadoEm||p.data||p.Data,true))}</small><button onclick="showVotes('${encoded}',${order})"><i class="ti ti-messages"></i> ${list.length} parecer${list.length===1?'':'es'}</button></footer></article>`;
  }
  
  function renderProposals(){
      const q = low(state.search), list = activeProposals().filter(p => !q || [orderOf(p), p.autor, p.titulo, p.tipo].some(v => low(v).includes(q)));
      $('proposal-count').textContent = `${list.length} proposta${list.length===1?'':'s'}`;
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
  
  window.removeActive = async(id, order) => { if(!await ask(`Excluir proposta nº ${order}?`, 'A proposta e todos os pareceres vinculados serão apagados.', 'Excluir proposta')) return; try{ const b=state.db.batch(); b.delete(proposals().doc(id)); state.votes.filter(v=>voteOrder(v)===order).forEach(v=>b.delete(votes().doc(v.id))); await b.commit(); toast('Proposta excluída.', 'success'); }catch(e){ toast('Falha ao excluir.', 'error'); } };
  window.removeHistory = async(backup, id, order) => { if(!await ask(`Excluir proposta nº ${order} do histórico?`, 'Será removida apenas deste backup.', 'Excluir do histórico')) return; try{ const ref=backups().doc(backup); await state.db.runTransaction(async tx=>{ const s=await tx.get(ref); if(!s.exists) throw Error(); const d=s.data(), ps=(d.propostas||[]).filter(p=>idOf(p)!==id&&orderOf(p)!==order), vs=(d.votos||[]).filter(v=>voteOrder(v)!==order); tx.update(ref,{propostas:ps, votos:vs, quantidadePropostas:ps.length, quantidadeVotos:vs.length, atualizadoEm:ts()}); }); await loadBackups(backup); toast('Removida do histórico.', 'success'); }catch(e){ toast('Falha ao alterar o histórico.', 'error'); } };

  // ==========================================
  // MODAL FORÇAR VOTO (LIDERANÇA)
  // ==========================================
  window.abrirModalForcarVoto = function(ordem, backupId = null) {
      let dialog = document.getElementById('force-vote-dialog');
      if (!dialog) {
          dialog = document.createElement('dialog');
          dialog.id = 'force-vote-dialog';
          dialog.className = 'dialog';
          dialog.innerHTML = `
              <div class="dialog-card">
                  <header>
                      <div>
                          <p class="eyebrow">Veredito da Liderança</p>
                          <h2>Forçar Resultado</h2>
                      </div>
                      <button class="icon-button" type="button" onclick="document.getElementById('force-vote-dialog').close()"><i class="ti ti-x"></i></button>
                  </header>
                  <div class="dialog-body form-grid">
                      <input type="hidden" id="forcar-ordem">
                      <input type="hidden" id="forcar-backup">
                      <label class="field wide">
                          <span>Decisão Soberana</span>
                          <select id="forcar-veredito" required>
                              <option value="Aprovada">Aprovada</option>
                              <option value="Reprovada">Reprovada</option>
                          </select>
                      </label>
                      <label class="field wide">
                          <span>Comentário / Justificativa</span>
                          <textarea id="forcar-comentario" rows="4" required>Decisão final decretada via painel de Liderança.</textarea>
                      </label>
                  </div>
                  <footer>
                      <button class="secondary-button" type="button" onclick="document.getElementById('force-vote-dialog').close()">Cancelar</button>
                      <button onclick="salvarVotoForcado()" class="primary-button" type="button"><i class="ti ti-hammer"></i> Decretar Veredito</button>
                  </footer>
              </div>
          `;
          document.body.appendChild(dialog);
      }
      document.getElementById('forcar-ordem').value = ordem;
      document.getElementById('forcar-backup').value = backupId || '';
      document.getElementById('forcar-veredito').value = 'Aprovada';
      document.getElementById('forcar-comentario').value = 'Decisão final decretada via painel de Liderança.';
      dialog.showModal();
  };

  window.salvarVotoForcado = async function() {
      const ordem = document.getElementById('forcar-ordem').value;
      const backupId = document.getElementById('forcar-backup').value;
      const veredito = document.getElementById('forcar-veredito').value;
      const comentario = document.getElementById('forcar-comentario').value.trim();

      if (!comentario) { toast("O comentário é obrigatório.", "error"); return; }

      const safeNick = state.nick.replace(/[^a-zA-Z0-9_]/g, '');
      const votoId = `voto_${ordem}_${safeNick}`;
      const novoVoto = { Nick: state.nick, Ordem: parseInt(ordem), Comentario: comentario, Veredito: veredito, Timestamp: new Date().toISOString() };

      document.getElementById('force-vote-dialog').close();
      toast("Forçando veredito...", "info");

      try {
          if (backupId) {
              const docRef = backups().doc(backupId);
              await state.db.runTransaction(async tx => {
                  const doc = await tx.get(docRef);
                  if (!doc.exists) throw Error("Backup não encontrado.");
                  let votos = doc.data().votos || [];
                  votos = votos.filter(v => !(parseInt(v.Ordem) === parseInt(ordem) && low(v.Nick || v.nick) === low(state.nick)));
                  votos.push(novoVoto);
                  tx.update(docRef, { votos });
              });
              toast("Resultado alterado no cofre de backup!", "success");
              renderBackup(backupId); 
          } else {
              await votes().doc(votoId).set({ ...novoVoto, Timestamp: ts() });
              toast("Resultado ativo alterado com sucesso!", "success");
          }
      } catch (err) {
          console.error(err); toast("Erro ao forçar decisão.", "error");
      }
  };

  // ==========================================
  // FUNÇÕES DE BACKUP E FECHAMENTO DE CICLO
  // ==========================================
  async function saveManual(e){ e.preventDefault(); const btn=$('save-proposal'), order=Number($('form-number').value); busy(btn,true,'Salvando…'); try{ await ensureCycle(); const ref=proposals().doc(String(order)), cycleRef=currentCycle(); await state.db.runTransaction(async tx=>{ const cycleSnap=await tx.get(cycleRef), proposalSnap=await tx.get(ref); if(proposalSnap.exists) throw Error('Já existe uma proposta com esse número.'); if(!cycleSnap.exists||cycleSnap.data().status!=='aberto') throw Error('O ciclo não está aberto.'); tx.set(ref,{ordem:order, ordemId:String(order), autor:clean($('form-author').value), autorUid:state.auth.currentUser.uid, tipo:$('form-type').value, titulo:clean($('form-title').value), conteudo:clean($('form-content').value), data:new Date().toISOString(), origem:'central-forumeiros', enviadoLideranca:false, cicloId:cycleSnap.data().id, criadoEm:ts()}); }); e.target.reset(); $('launch-dialog').close(); toast('Proposta adicionada.', 'success'); }catch(err){ toast(err.message, 'error'); }finally{ busy(btn,false); } }
  
  async function switchCycle(attachment='', warningTargets=[]){ return state.db.runTransaction(async tx=>{ const ref=currentCycle(), s=await tx.get(ref); if(!s.exists||s.data().status!=='aberto') throw Error('Ciclo não está aberto.'); const old=s.data(), id=cycleId(), now=new Date().toISOString(), next={id, status:'aberto', inicioEm:ts(), inicioIso:now, previsaoFimIso:nextFriday(), abertoPor:state.nick, abertoPorUid:state.auth.currentUser.uid, atualizadoEm:ts()}, closing={...old, status:'fechando', fechadoEm:ts(), fechadoIso:now, fechadoPor:state.nick, fechadoPorUid:state.auth.currentUser.uid, advertenciasAlvos:warningTargets}; if(attachment) closing.advertenciaAnexo=attachment; tx.set(cycles().doc(old.id), closing, {merge:true}); tx.set(cycles().doc(id), next); tx.set(ref, next); return {old:old.id, next:id}; }); }
  
  async function reward(p, cycle){ for(const nickname of clean(p.autor).split('/').map(clean).filter(Boolean)){ const member=state.members.find(m=>low(m.name||m.nick)===low(nickname)); if(!member) continue; const safe=`proposta_${cycle}_${idOf(p)}`.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,190), user=state.db.collection('users').doc(member.id), history=user.collection('historico').doc(safe), notification=state.db.collection('notificacoes').doc(`${safe}_${member.id}`.slice(0,220)); await state.db.runTransaction(async tx=>{ const h=await tx.get(history); if(h.exists) return; const u=await tx.get(user), count=Number(u.data()?.propostas)||0; tx.update(user,{propostas:count+1}); tx.set(history,{titulo:'Proposta Aprovada pelo Conselho', timestamp:ts(), data:formatDate(new Date()), autor:state.nick, conteudo:`<b>Tipo:</b> ${esc(p.tipo)}<br><b>Ordem:</b> ${p.ordem}<br><b>Título:</b> ${esc(p.titulo)}<br><br><b>Síntese:</b> ${esc(p.conteudo)}`, dados:{departamento:'Companhia', tipo:p.tipo, ordem:p.ordem, titulo:p.titulo, sintese:p.conteudo, parceiros:p.autor, cicloId:cycle}}); tx.set(notification,{tipo:'companhia_ouvidoria', dados:{nomeUsuario:nickname, tipoProposta:p.tipo}, link:`/membros/${encodeURIComponent(nickname)}`, userId:member.id, lida:false, timestamp:ts(), cicloId:cycle, propostaId:idOf(p)}); }); } }
  
  async function processCycle(cycle, next=state.cycle?.id){
      const ref=cycles().doc(cycle);
      try{
          await ref.set({status:'fechando',processamentoPor:state.nick,processamentoEm:ts()},{merge:true});
          const backupRef=backups().doc(cycle);
          const [ps,vs,bk,cycleSnapshot]=await Promise.all([
              proposals().where('cicloId','==',cycle).get(),
              votes().get(),
              backupRef.get(),
              ref.get()
          ]);
          const cycleData=cycleSnapshot.data()||{};
          const live=ps.docs.map(d=>({id:d.id,...d.data()}));
          const orders=new Set(live.map(orderOf));
          const liveVotes=vs.docs.map(d=>({id:d.id,...d.data()})).filter(v=>orders.has(voteOrder(v)));
          const props=bk.exists?(bk.data().propostas||[]):live;
          const allVotes=bk.exists?(bk.data().votos||[]):liveVotes;

          if(!bk.exists) await backupRef.set({nome_backup:props.length?`Nº ${Math.min(...props.map(orderOf))} a ${Math.max(...props.map(orderOf))}`:'Ciclo sem propostas',data_formatada:formatDate(new Date()),timestamp:new Date().toISOString(),cicloId:cycle,propostas:props,votos:allVotes,quantidadePropostas:props.length,quantidadeVotos:allVotes.length,criadoEm:ts(),criadoPor:state.nick});

          const warningCount=await sendMissingAssessmentWarnings(
              cycle,
              props,
              allVotes,
              cycleData.advertenciaAnexo||'',
              Array.isArray(cycleData.advertenciasAlvos)?cycleData.advertenciasAlvos:null
          );

          const leaders=leaderNicks(),approved=[],resolved=new Set(),resolvedOrders=new Set(),pending=[];
          props.forEach(p=>{const d=decision(p,votesFor(p,allVotes),leaders);if(d.key==='approved'){approved.push(p);resolved.add(idOf(p));resolvedOrders.add(orderOf(p));}else if(d.key==='rejected'){resolved.add(idOf(p));resolvedOrders.add(orderOf(p));}else pending.push(p);});
          for(const p of approved) await reward(p,cycle);

          const cs=await ref.get();
          if(approved.length&&cs.data()?.tratamentoEnviado!==true){
              const response=await fetch(APPS_SCRIPT_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'enviarTratamento',cicloId:cycle,dados:approved.map(p=>({ordem:p.ordem,autor:p.autor,categoria:p.tipo,titulo:p.titulo,conteudo:p.conteudo}))})});
              if(!response.ok) throw Error('Planilha de tratamento não confirmou.');
              await ref.set({tratamentoEnviado:true,tratamentoEnviadoEm:ts()},{merge:true});
          }

          const b=state.db.batch();
          props.forEach(p=>{const proposalRef=proposals().doc(idOf(p));if(resolved.has(idOf(p)))b.delete(proposalRef);else b.set(proposalRef,{cicloId:next,carregadoDoCiclo:cycle,atualizadoEm:ts()},{merge:true});});
          vs.docs.forEach(d=>{if(resolvedOrders.has(voteOrder(d.data())))b.delete(d.ref);});
          await b.commit();
          await ref.set({status:'fechado',finalizadoEm:ts(),finalizadoPor:state.nick,totalPropostas:props.length,totalAprovadas:approved.length,totalResolvidas:resolved.size,totalTransferidas:pending.length,totalAdvertencias:warningCount,backupId:cycle},{merge:true});
          toast(`${resolved.size} resolvida(s), ${pending.length} transferida(s) e ${warningCount} advertência(s) enviada(s).`,'success');
      }catch(e){
          console.error(e);
          await ref.set({status:'erro',erro:clean(e.message||e),erroEm:ts()},{merge:true}).catch(()=>{});
          throw e;
      }
  }
  
  async function closeCycle(){
      if(state.busy) return;
      const isFriday=friday();
      const ok=await ask(
          isFriday?'Encerrar o ciclo atual?':'Fechamento fora da sexta-feira',
          isFriday?'O corte acontecerá agora. Quem não avaliou todas as propostas e não está de licença receberá advertência.':'Hoje não é sexta. O fechamento será extraordinário e as avaliações incompletas gerarão advertência.',
          isFriday?'Encerrar ciclo':'Fechamento extraordinário',
          !isFriday
      );
      if(!ok) return;

      state.busy=true;
      busy($('close-cycle'),true,'Conferindo…');
      try{
          await withTimeout(loadPeople(),15000,'Não foi possível atualizar membros e licenças antes do fechamento.');
          const [proposalSnapshot,voteSnapshot]=await withTimeout(
              Promise.all([
                  proposals().where('cicloId','==',state.cycle.id).get(),
                  votes().get()
              ]),
              15000,
              'Não foi possível conferir as avaliações antes do fechamento.'
          );
          const currentProposals=proposalSnapshot.docs.map(doc=>({id:doc.id,...doc.data()}));
          const currentOrders=new Set(currentProposals.map(orderOf));
          const currentVotes=voteSnapshot.docs.map(doc=>({id:doc.id,...doc.data()})).filter(vote=>currentOrders.has(voteOrder(vote)));
          const warningTargets=missingCouncilAssessments(currentProposals,currentVotes);
          let attachment='';

          if(warningTargets.length){
              busy($('close-cycle'),false);
              attachment=await requestWarningAttachment(warningTargets);
              if(!attachment){
                  toast('Fechamento cancelado: informe o link do print para aplicar as advertências.','warning');
                  return;
              }
              busy($('close-cycle'),true,'Fechando…');
          }

          const result=await switchCycle(attachment,warningTargets);
          await processCycle(result.old,result.next);
      }catch(e){
          toast(e.message||'Interrompido.','error');
      }finally{
          state.busy=false;
          busy($('close-cycle'),false);
      }
  }
  function renderRecovery(){ $('recovery-panel').hidden = !state.pending; if(state.pending) $('recovery-text').textContent = state.pending.status==='erro' ? `O ciclo ${state.pending.id} parou com erro.` : `Ciclo ${state.pending.id} em processamento.`; }
  async function resume(){ if(!state.pending||state.busy) return; if(!await ask('Retomar fechamento?','A Central continuará o ciclo pendente.','Retomar',false)) return; state.busy=true; busy($('resume-cycle'),true,'Retomando…'); try{ await processCycle(state.pending.id, state.cycle.id); }catch(e){ toast(e.message||'Falha ao retomar.', 'error'); }finally{ state.busy=false; busy($('resume-cycle'),false); } }

  async function loadBackups(selected=''){ const s=await backups().orderBy('timestamp','desc').get(); state.backups=new Map(s.docs.map(d=>[d.id,{id:d.id,...d.data()}])); $('backup-select').innerHTML='<option value="" disabled selected>Selecione um backup</option>'+Array.from(state.backups.values()).map(b=>`<option value="${esc(b.id)}">${esc(b.nome_backup||b.data_formatada||b.id)} · ${esc(b.data_formatada||'')}</option>`).join(''); if(selected&&state.backups.has(selected)){ $('backup-select').value=selected; renderBackup(selected); }else{ $('restore-panel').hidden=true; } }
  window.renderBackup = function(id){ const b=state.backups.get(id); if(!b) return; $('restore-panel').hidden=false; const ps=b.propostas||[]; $('history-grid').innerHTML=ps.length ? ps.map(p=>card(p,{backup:id, votes:votesFor(p,b.votos||[])})).join('') : '<div class="empty"><i class="ti ti-file-off"></i><h3>Backup sem propostas</h3></div>'; }
  async function restore(){ const id=$('backup-select').value, bk=state.backups.get(id); if(!bk||!await ask('Restaurar este backup?','As propostas voltarão para o ciclo atual.','Restaurar',false)) return; busy($('restore-backup'),true,'Restaurando…'); try{ const b=state.db.batch(); (bk.propostas||[]).forEach(p=>{ const data={...p}; delete data.id; b.set(proposals().doc(idOf(p)), {...data, ordem:orderOf(p), ordemId:idOf(p), cicloId:state.cycle.id, restauradoDoBackup:id, restauradoEm:ts(), restauradoPor:state.nick}, {merge:true}); }); (bk.votos||[]).forEach(v=>{ const data={...v}, doc=clean(v.id||`voto_${voteOrder(v)}_${clean(v.Nick||v.nick).replace(/[^a-zA-Z0-9_]/g,'')}`); delete data.id; b.set(votes().doc(doc), {...data, restauradoDoBackup:id}, {merge:true}); }); await b.commit(); toast('Backup restaurado.', 'success'); navigate('propostas'); }catch(e){ toast('Não foi possível restaurar.', 'error'); }finally{ busy($('restore-backup'),false); } }

  function renderAccess(){ $('access-list').innerHTML = state.access.length ? state.access.slice().sort((a,b)=>a.localeCompare(b,'pt-BR')).map(n=>`<span class="access-chip"><span>${esc(n)}</span><button onclick="removeAccess('${encodeURIComponent(n)}')" title="Remover acesso"><i class="ti ti-x"></i></button></span>`).join('') : '<p class="empty compact" style="min-height:45px">Nenhum nickname adicional.</p>'; }
  async function addAccess(e){ e.preventDefault(); const input=$('access-nick'), m=state.members.find(x=>low(x.name||x.nick)===low(input.value)); if(!m){ toast('Nickname não encontrado.', 'warning'); return; } const nick=clean(m.name||m.nick); if(roleAllowed(m.cargo)||nickAllowed(nick)){ toast('Membro já possui acesso.', 'info'); return; } busy($('add-access'),true,'Adicionando…'); try{ await accessDoc().set({nicknames:firebase.firestore.FieldValue.arrayUnion(nick), atualizadoEm:ts(), atualizadoPor:state.nick, atualizadoPorUid:state.auth.currentUser.uid},{merge:true}); input.value=''; toast(`${nick} autorizado.`, 'success'); }catch(e){ toast('Falha ao autorizar.', 'error'); }finally{ busy($('add-access'),false); } }
  window.removeAccess = async encoded => { const nick=decodeURIComponent(encoded); if(!await ask(`Remover acesso de ${nick}?`,'O membro perderá o acesso.','Remover')) return; try{ await accessDoc().update({nicknames:firebase.firestore.FieldValue.arrayRemove(nick), atualizadoEm:ts(), atualizadoPor:state.nick, atualizadoPorUid:state.auth.currentUser.uid}); toast('Acesso removido.', 'success'); }catch(e){ toast('Falha ao remover.', 'error'); } };

  // ==========================================
  // VIEW E INICIALIZAÇÃO
  // ==========================================
  function navigate(name){ document.querySelectorAll('.view').forEach(v => v.hidden = v.id!==`view-${name}`); document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view===name)); const labels = {propostas:'Central de Propostas', historico:'Histórico de Propostas', configuracoes:'Configurações da Central'}; $('page-label').textContent = labels[name]; location.hash = name; sidebar(false); document.querySelector('.stage').scrollTop = 0; if(name==='historico') loadBackups().catch(()=>{}); }
  function sidebar(open){ $('sidebar').classList.toggle('open', open); }
  function themeVision(){ const applyTheme=(v,s=false)=>{ document.documentElement.dataset.theme=v; $('theme-button').innerHTML=`<i class="ti ${v==='dark'?'ti-sun':'ti-moon'}"></i>`; document.querySelector('meta[name=theme-color]').content = v==='dark'?'#0f0512':'#821f88'; if(s) localStorage.setItem('PROPOSTAS_THEME',v); }; applyTheme(localStorage.getItem('PROPOSTAS_THEME')==='light'?'light':'dark'); $('theme-button').onclick = () => applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark',true); const applyVision=(sc,c,s=false)=>{ document.documentElement.dataset.scale=sc; document.documentElement.dataset.contrast=c?'high':'standard'; document.querySelectorAll('[data-scale]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scale===sc))); $('contrast-state').textContent=c?'Ativado':'Desativado'; if(s) localStorage.setItem('PROPOSTAS_VISION',JSON.stringify({scale:sc,contrast:c})); }; let pref={}; try{ pref=JSON.parse(localStorage.getItem('PROPOSTAS_VISION')||'{}'); }catch(_){} applyVision(pref.scale||'normal',pref.contrast===true); $('vision-button').onclick=()=>{ $('vision-panel').hidden=!$('vision-panel').hidden; }; document.querySelectorAll('[data-scale]').forEach(b=>b.onclick=()=>applyVision(b.dataset.scale,document.documentElement.dataset.contrast==='high',true)); $('contrast-button').onclick=()=>applyVision(document.documentElement.dataset.scale,document.documentElement.dataset.contrast!=='high',true); $('vision-reset').onclick=()=>applyVision('normal',false,true); }
  function bind(){ document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.view))); $('menu-button').onclick=()=>sidebar(!$('sidebar').classList.contains('open')); $('sidebar-overlay').onclick=()=>sidebar(false); $('open-launch').onclick=()=>$('launch-dialog').showModal(); document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close()); $('launch-form').onsubmit=saveManual; $('proposal-search').oninput=e=>{ state.search=e.target.value; renderProposals(); }; $('close-cycle').onclick=closeCycle; $('resume-cycle').onclick=resume; $('refresh-button').onclick=()=>loadPeople().then(()=>toast('Dados atualizados.', 'success')).catch(()=>toast('Falha ao atualizar.', 'error')); $('backup-select').onchange=e=>renderBackup(e.target.value); $('restore-backup').onclick=restore; $('access-form').onsubmit=addAccess; document.querySelectorAll('.dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d) d.close();})); }
  
  async function init(){
      const watchdog = setTimeout(() => {
          deny('A inicialização demorou demais', 'Recarregue a página. Se continuar, verifique o Authentication e as regras do Firebase.');
      }, 60000);
      try{
          bind(); themeVision();
          accessStatus('Identificando sua sessão', 'Consultando o usuário conectado no fórum…');
          state.nick = await forumNick();
          if(!state.nick){
              deny('Acesso negado', 'Não foi possível identificar sua sessão do fórum. Recarregue a página após confirmar que está conectado.');
              return;
          }
          accessStatus('Conectando ao Firebase', `Sessão de ${state.nick} localizada. Preparando o banco de dados…`);
          await firebaseSession();
          if(!await loadIdentity()) return;
          accessStatus('Preparando o ciclo', 'Verificando o período atual das propostas…');
          await withTimeout(ensureCycle(), 15000, 'O Firestore não respondeu ao preparar o ciclo atual.');
          accessStatus('Carregando a Central', 'Buscando propostas, membros e licenças…');
          await withTimeout(
              Promise.all([loadPeople(), migrateLegacy()]),
              20000,
              'O Firestore não respondeu ao carregar os dados da Central.'
          );
          startLive();
          renderAccess();
          navigate(['propostas','historico','configuracoes'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'propostas');
          allow();
      }catch(e){
          console.error('Falha ao iniciar a Central:', e);
          const code = e && e.code ? ` (${e.code})` : '';
          deny('Falha ao iniciar', `${e.message||'Não foi possível conectar ao sistema.'}${code}`);
      }finally{
          clearTimeout(watchdog);
      }
  }
  
  init();
})();
