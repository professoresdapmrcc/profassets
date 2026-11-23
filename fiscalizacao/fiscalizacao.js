(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const assetBase = new URL('.', document.currentScript.src);
  const preview = new URLSearchParams(location.search).has('previa');
  const forumOrigin = 'https://www.policiarcc.com';
  let session = null;
  let controller;
  let flow;
  const loaded = new Set();
  const notify = text => { $('fc-access').hidden = false; $('fc-access').textContent = text; };
  function view(name) {
    if(name==='results')$('fc-results').scrollIntoView({block:'start',behavior:'smooth'});
  }
  document.querySelectorAll('[data-fc-view]').forEach(button => button.addEventListener('click', () => view(button.dataset.fcView)));
  $('fc-close-status').onclick=()=>$('fc-send-status').close();
  let theme = 'light';
  try { theme = localStorage.getItem('PROF_FISCAL_THEME_V2') || 'light'; } catch { /* preference is optional */ }
  function setTheme(value) { document.documentElement.dataset.theme = value; document.documentElement.classList.toggle('dark', value === 'dark'); }
  setTheme(theme);
  $('fc-theme').onclick = () => { theme = document.documentElement.classList.contains('dark') ? 'light' : 'dark'; setTheme(theme); try { localStorage.setItem('PROF_FISCAL_THEME_V2', theme); } catch {} };
  function script(src) {
    return new Promise((resolve, reject) => {
      if (loaded.has(src)) return resolve();
      const element = document.createElement('script'); element.src = new URL(src, assetBase).href;
      element.onload = () => { loaded.add(src); resolve(); };
      element.onerror = () => reject(new Error('Não foi possível carregar ' + src));
      document.body.append(element);
    });
  }
  async function conferido() {
    const next = await controller.conferir();
    if (!next.podeEditar) throw new Error('Sua conta não consta nos grupos autorizados para a fiscalização.');
    if (session && next.usuario.id !== session.usuario.id) throw new Error('A conta logada mudou. Atualize a página antes de continuar.');
    session = next;
    $('fc-user').textContent = next.usuario.nick;
    $('fc-role').textContent = next.perfil.cargo || 'Cargo no NEXUS indisponível';
    $('fc-session-status').textContent = 'Sessão do fórum';
    window.FiscalMotor?.setActor(next.usuario.nick);
    return next;
  }
  const parse = html => new DOMParser().parseFromString(html, 'text/html');
  async function nativeSend(path, fields, tipo) {
    let submitted = false;
    try {
      if (location.origin !== forumOrigin) throw new Error('Abra a ferramenta no fórum para enviar.');
      const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(20000) });
      const doc = parse(await response.text());
      if (!response.ok || new URL(response.url).pathname.startsWith('/login')) throw new Error('Entre no fórum e confira suas permissões.');
      const form = doc.querySelector('textarea[name="message"]')?.closest('form');
      if (!form) throw new Error('O formulário de envio não está disponível para esta conta.');
      const action = new URL(form.getAttribute('action') || path, forumOrigin);
      if (action.origin !== forumOrigin || !['/post', '/privmsg'].includes(action.pathname)) throw new Error('O formulário apontou para um destino inesperado.');
      const body = new FormData(form);
      for (const name of ['preview', 'disable_html', 'username', 'username[]']) body.delete(name);
      for (const [name, value] of Object.entries(fields)) body.set(name, value);
      body.set('post', '1');
      submitted = true;
      const posted = await fetch(action.href, { method: 'POST', credentials: 'same-origin', body, signal: AbortSignal.timeout(25000) });
      const result = parse(await posted.text());
      if (!posted.ok) throw new Error('O fórum não confirmou o envio (' + posted.status + ').');
      const resultUrl=new URL(posted.url);
      if(resultUrl.pathname.startsWith('/login'))throw new Error('A sessão do fórum expirou durante o envio. Confira o destino.');
      if((resultUrl.pathname==='/post'||(resultUrl.pathname==='/privmsg'&&resultUrl.searchParams.get('mode')==='post'))&&result.querySelector('textarea[name="message"]'))throw new Error('O formulário permaneceu aberto. O fórum não confirmou o envio.');
      const text = result.body.textContent.replace(/\s+/g, ' ');
      const failure = result.querySelector('.error, .alert-error, .block-error');
      if (failure?.textContent.trim()) throw new Error(failure.textContent.trim());
      const success = /(?:mensagem|message).{0,45}(?:enviada|publicada|inserida|sent|posted)|(?:enviada|publicada).{0,35}(?:sucesso|successfully)/i.test(text);
      const urls = [posted.url, ...[...result.querySelectorAll('a[href]')].map(a => new URL(a.getAttribute('href'), forumOrigin).href)];
      const destination = urls.some(href => {
        const url = new URL(href);
        if (url.origin !== forumOrigin) return false;
        if (tipo === 'mp') return url.pathname === '/privmsg' && ['outbox', 'sentbox'].includes(url.searchParams.get('folder'));
        return (url.pathname.startsWith('/t' + fields.t + '-') || url.searchParams.get('t') === String(fields.t)) && url.hash.length > 1;
      });
      if (!success && !destination) throw new Error('O fórum não apresentou uma confirmação de envio. Confira o destino antes de tentar novamente.');
    } catch (error) { if (!submitted) error.naoEnviado = true; throw error; }
  }
  async function firebase({ route, payload }) {
    if (!['rebaixamento', 'saida'].includes(route)) { const error = new Error('Ação do NEXUS não reconhecida.'); error.naoEnviado = true; throw error; }
    const response = await fetch('https://api-7ljxwrvhpa-uc.a.run.app/' + route, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error('O NEXUS não confirmou a atualização (' + response.status + '). Confira o cadastro antes de reenviar.');
    // The existing endpoint may return JSON or plain text; reject explicit application errors.
    const text = await response.text();
    try { const data = JSON.parse(text); if (data.ok === false || data.success === false || data.error) throw new Error(data.error || data.message || 'O NEXUS recusou a alteração.'); }
    catch (error) { if (!(error instanceof SyntaxError)) throw error; if (/<html|<!doctype/i.test(text)) throw new Error('O NEXUS retornou uma página inesperada. Confira o cadastro.'); }
  }
  function markMP(ids) {
    ids.split(',').forEach(id => {
      const mp = $(id.replace('chk-req-', 'chk-mp-').replace('chk-expulsao-conflito-', 'chk-mp-conflito-'));
      if (mp && mp.id !== id) { mp.checked = true; mp.disabled = true; }
    });
  }
  function historyLabel(key) {
    if (key === 'forum') return 'Requerimento no fórum';
    if (key === 'planilha') return 'Planilha · envio pelo fluxo anterior';
    return key.startsWith('firebase') ? 'NEXUS / Firebase' : 'Carta por MP';
  }
  function renderHistory() {
    const container = $('fc-history-list'); container.replaceChildren();
    let rows = [];
    try { rows = flow?.historico() || []; } catch (error) { notify(error.message); }
    if (!rows.length) { const p = document.createElement('p'); p.className = 'fc-empty'; p.textContent = 'Os envios desta ferramenta aparecerão aqui. O histórico da planilha continua disponível no botão acima.'; container.append(p); return; }
    for (const record of rows) {
      const card = document.createElement('article'); card.className = 'fc-history-card';
      const title = document.createElement('h3'); title.textContent = record.operacoes.map(a => a.nicks.join(' / ')).join(' · ');
      const meta = document.createElement('p'); meta.textContent = record.autor + ' · ' + new Date(record.criadoEm).toLocaleString('pt-BR');
      const stages = document.createElement('ul');
      for (const [key, state] of Object.entries(record.etapas)) { const li=document.createElement('li'); li.dataset.state=state; li.textContent=historyLabel(key)+' — '+({concluido:key==='planilha'?'enviado, sem confirmação de gravação':'concluído',incerto:'conferir no destino',enviando:'resultado pendente',pendente:'não enviado'}[state] || state); stages.append(li); }
      card.append(title,meta,stages);
      if (record.erro) { const p=document.createElement('p'); p.className='fc-error'; p.textContent=record.erro; card.append(p); }
      const link=document.createElement('a'); link.href=forumOrigin+'/t'+record.topic+'-?view=newest'; link.target='_blank'; link.rel='noopener noreferrer'; link.textContent='Conferir requerimento no fórum'; card.append(link);
      if (!record.concluido && !Object.values(record.etapas).some(s=>['incerto','enviando'].includes(s))) {
        const button=document.createElement('button'); button.type='button'; button.textContent='Continuar etapas pendentes'; button.onclick=async()=>{button.disabled=true;try{const current=await conferido();if(current.usuario.nick!==record.autor)throw new Error('Esta operação pertence a outra conta.');await flow.enviar(record);notify('Etapas pendentes concluídas.');}catch(e){notify(e.message);}finally{button.disabled=false;renderHistory();}};card.append(button);
      }
      container.append(card);
    }
  }
  function setupActions() {
    const motor=window.FiscalMotor;
    flow = window.FluxoFiscalizacao.criar({ storage: localStorage,
      postar: (topic,codigo)=>nativeSend('/post?t='+Number(topic)+'&mode=reply',{t:String(topic),mode:'reply',message:codigo},'forum'),
      firebase,
      carta: async(nick,tipo,motivo,info)=>{
        const template=tipo==='expulsao'?motor.TEMPLATE_MP_EXPULSAO:motor.TEMPLATE_MP_REBAIXAMENTO;
        const values={USERNAME:nick,MOTIVO:motivo,CONSIDERACOES:info.comentarios||'Conforme fiscalização e requerimento publicado.',LINK_PROVA:info.provas||forumOrigin+'/t32243-?view=newest'};
        const mensagem=template.replace(/\{(USERNAME|MOTIVO|CONSIDERACOES|LINK_PROVA)\}/g,(_m,key)=>values[key]);
        await nativeSend('/privmsg?mode=post',{'username[]':nick,mode:'post',subject:'[PROF] Carta de '+(tipo==='expulsao'?'Expulsão':'Rebaixamento'),message:mensagem},'mp');
      },
      planilha: async()=>{motor.salvarEstadoAtual();}, onChange:()=>{if($('fc-send-status').open)renderHistory();},
    });
    window.postarAcao = (btn,encoded,topic,ids) => {
      const codigo=decodeURIComponent(encoded);
      const operacoes=window.FluxoFiscalizacao.acoes(codigo);
      if(!operacoes.length){notify('Não foi possível identificar a ação. Gere novamente o requerimento para revisar.');return;}
      let present;
      try{present=flow.historico().find(r=>r.codigo===codigo&&r.concluido);}catch(error){notify(error.message);return;}
      if(present){notify('Este requerimento e suas integrações já foram concluídos.');return;}
      window.abrirModalRevisaoBBCode('Revisar requerimento, NEXUS e carta',codigo,async()=>{
        const informacoesCarta={comentarios:$('fc-letter-comments')?.value||'',provas:$('fc-letter-proof')?.value||''};
        window.fecharModalRevisaoBBCode();btn.disabled=true;
        try {
          const current=await conferido();
          notify('Enviando requerimento. Depois serão atualizados NEXUS, cartas e o registro da planilha.');
          await flow.enviar({codigo,topic:Number(topic),autor:current.usuario.nick,operacoes,informacoesCarta});
          motor.complete(ids);markMP(ids);motor.salvarEstadoAtual();btn.textContent='Envio concluído';
          notify('Requerimento, NEXUS e cartas concluídos. Registro da planilha encaminhado pelo fluxo existente.');
        }catch(error){notify(error.message);renderHistory();$('fc-send-status').showModal();btn.textContent='Consultar andamento';}
        finally{btn.disabled=false;}
      });
      let letterFields=$('fc-letter-fields');
      if(!letterFields){letterFields=document.createElement('div');letterFields.id='fc-letter-fields';letterFields.className='fc-letter-fields';$('bbcode-revisao-conteudo').after(letterFields);}
      letterFields.replaceChildren();
      if(operacoes.some(a=>['rebaixamento','expulsao'].includes(a.tipo))){
        for(const [id,labelText,type]of [['fc-letter-comments','Comentários para a carta (opcional)','text'],['fc-letter-proof','Link das provas (opcional)','url']]){
          const label=document.createElement('label');label.textContent=labelText;const input=document.createElement('input');input.id=id;input.type=type;label.append(input);letterFields.append(label);
        }
      }
    };
    function openCofre(btn,nick,tipo,cargo) {
      try {
        const url=window.FluxoFiscalizacao.cofre({nick,tipo,cargo,responsavel:session.usuario.nick,periodo:new Date().toLocaleDateString('pt-BR')});
        window.open(url,'_blank','noopener,noreferrer');
        notify('Formulário do cofre aberto. Confira e conclua lá; nenhuma medalha foi marcada como postada.');
      }catch(error){notify(error.message);}
    }
    window.postarMedalha=(btn,nick,tipo,_motivo,cargo)=>openCofre(btn,nick,tipo,cargo);
    window.postarCofreConflito=(btn,idx)=>{
      const dados=typeof obterDadosCardConflito==='function'?obterDadosCardConflito(idx):null;
      if(!dados){notify('Abra o cofre pelo cartão do membro, após conferir nick e cargo.');return;}
      openCofre(btn,dados.nick,'expulsao',dados.cargo);
    };
    const oldMP=window.abrirModalMP;
    window.abrirModalMP=(nick,tipo,...args)=>{
      if(tipo==='aviso-perfil')return oldMP(nick,tipo,...args);
      notify('A carta de '+(tipo==='expulsao'?'expulsão':'rebaixamento')+' é enviada junto do requerimento, depois da atualização do NEXUS.');
    };
    window.iniciarMPLote=()=>notify('As cartas são enviadas junto com os requerimentos. Use Postar Requerimentos.');
    const oldVerifier=window.abrirModalVerificador;
    window.abrirModalVerificador=()=>{oldVerifier();const field=$('input-verificador-nick');field.value=session.usuario.nick;field.readOnly=true;};
    const oldConfirm=window.confirmarVerificador;
    window.confirmarVerificador=async()=>{try{await conferido();$('input-verificador-nick').value=session.usuario.nick;oldConfirm();}catch(error){notify(error.message);}};
    const originalTab=window.alternarTab;
    window.alternarTab=(...args)=>{view('results');return originalTab(...args);};
    const observer=new MutationObserver(()=>{
      for(const a of document.querySelectorAll('#container-resultados a[href*="policiarcc.com/g"]')){
        if(a.dataset.fcManaged)continue;a.dataset.fcManaged='true';a.classList.add('fc-manage-group');a.textContent='Gerenciar no fórum';a.target='_blank';a.rel='noopener noreferrer';a.removeAttribute('onclick');a.title='Abrir o grupo. A retirada é feita no fórum.';
      }
    });
    observer.observe($('container-resultados'),{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    // Automatically display results without affecting the existing verification logic.
    const resultObserver=new MutationObserver(()=>{if(!$('container-resultados').classList.contains('hidden'))view('results');});
    resultObserver.observe($('container-resultados'),{attributes:true,attributeFilter:['class']});
    setTheme(theme);
  }
  function previewUI() {
    $('fc-preview').hidden=false;$('fc-access').hidden=true;$('fc-workspace').hidden=false;
    $('fc-user').textContent='Membro demonstrativo';$('fc-role').textContent='Conselheiro(a)';$('fc-session-status').textContent='Prévia da interface';
    const counts={'inativos':3,'graduacao':2,'offline':4,'perfil-irregular':1,'remover-forum':2,'retirar-grupos':0,'outros':1,'erros':0};
    for(const [key,count]of Object.entries(counts)){const badge=$('badge-count-'+key);if(badge)badge.textContent=String(count);const countEl=$('contador-'+key);if(countEl)countEl.textContent=count+' encontrados';}
    $('botaoVerificar').onclick=()=>{$('container-resultados').classList.remove('hidden');view('results');};
    for(const panel of document.querySelectorAll('.tab-content'))panel.style.display=panel.id==='content-inativos'?'block':'none';
    for(const tab of document.querySelectorAll('.tab-btn')){
      tab.removeAttribute('onclick');tab.onclick=()=>{document.querySelectorAll('.tab-btn').forEach(b=>{b.classList.toggle('active',b===tab);b.setAttribute('aria-selected',String(b===tab));});document.querySelectorAll('.tab-content').forEach(p=>p.style.display=p.id===tab.getAttribute('aria-controls')?'block':'none');};
    }
    const list=$('lista-inativos');
    for(const [i,nick]of ['Professor.Exemplo','Membro.Demo','Nome.Ilustrativo'].entries()){
      const li=document.createElement('li');li.className='fc-demo-member';li.innerHTML='<span class="fc-demo-avatar"><i class="fa-solid fa-user" aria-hidden="true"></i></span><div><strong></strong><p>Professor(a) · Não consta na lista ativa do System</p></div><span class="fc-state">Revisão pendente</span>';li.querySelector('strong').textContent=nick;list.append(li);
    }
    $('progresso-fontes').textContent='Pronto para importar · 4 fontes';
    $('texto-status-forum').textContent='Na versão do fórum, as listas serão consultadas automaticamente.';
    // Keep the full original UI visible, but neutralize every legacy action in this preview.
    for(const el of document.querySelectorAll('[onclick],[onchange]')){el.removeAttribute('onclick');el.removeAttribute('onchange');}
    for(const button of document.querySelectorAll('button:not([data-fc-view]):not(.tab-btn):not(#fc-theme):not(#botaoVerificar)'))button.addEventListener('click',()=>notify('Esta é uma prévia visual. Os envios ficam disponíveis apenas no fórum, após a conferência do acesso.'));
  }
  async function boot() {
    if(preview){previewUI();return;}
    if(location.origin!==forumOrigin){$('fc-session-status').textContent='Acesso pelo fórum';notify('Abra esta ferramenta dentro de www.policiarcc.com com sua conta conectada. Para visualizar o layout localmente, use ?previa=1.');return;}
    // Verify the viewer before loading the legacy engine or querying the task lists.
    await script('./parser-grupos-acesso.js');
    controller=window.AcessoFiscalizacao.criarControlador({conferirGrupo:async(group,user)=>{
      const result=await window.ParserAcessoFiscal.buscarTodosMembrosDoGrupo(group,{fetchFn:(url,options)=>fetch(url,{...options,credentials:'same-origin',cache:'no-store'}),delayMs:0});
      return result.membros.some(nick=>String(nick).normalize('NFC').toLocaleLowerCase('pt-BR')===user.nick.normalize('NFC').toLocaleLowerCase('pt-BR'));
    }});
    await conferido();$('fc-workspace').hidden=false;$('fc-access').hidden=true;
    await script('./motor-fiscalizacao.js');
    await script('./parser_grupos_forum.js');
    window.FiscalMotor.setActor(session.usuario.nick);setupActions();
    setInterval(async()=>{try{await conferido();}catch(error){$('fc-workspace').hidden=true;notify(error.message);}},300000);
  }
  boot().catch(error=>notify(error.message));
})();
