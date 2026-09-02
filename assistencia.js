(() => {
  'use strict';
  if (!document.getElementById('assistance-app')) return;

  const FIREBASE_CONFIG = Object.freeze({
    apiKey: 'AIzaSyDo4DagZchii1cPKFighZU5KAjppp98HJE',
    authDomain: 'nexusprof.firebaseapp.com',
    projectId: 'nexusprof',
    storageBucket: 'nexusprof.appspot.com',
    messagingSenderId: '268861178598',
    appId: '1:268861178598:web:9686b81bb003f9514fb127',
    measurementId: 'G-MY150DZMTM'
  });
  const RECORDS = 'assistencia_registros';
  const OPERATIONS = 'assistencia_acumulos';
  const SETTINGS_KEY = 'PROF_ASSISTENCIA_ACUMULOS';
  const THEME_KEY = 'PROF_ASSISTENCIA_THEME';
  const ACTIVE_LAYOUT_KEY = 'PROF_ASSISTENCIA_ACTIVE_LAYOUT';
  const ACTIVE_DECISIONS = new Set(['pendente', 'aprovada']);
  const ELIGIBLE_ROLES = new Set(['estagiario', 'conselheiro', 'vice lider', 'lider']);
  const state = { db: null, auth: null, nick: '', profile: null, records: [], recommendations: [], selected: null, activeLayout:localStorage.getItem(ACTIVE_LAYOUT_KEY)==='list'?'list':'cards', busy: false, unsubscribe: null };

  const $ = id => document.getElementById(id);
  const clean = value => String(value ?? '').trim();
  const low = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const forumAvatar = nick => `https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(nick)}&direction=2&head_direction=3&gesture=sml&size=m&headonly=1`;
  const serverTime = () => firebase.firestore.FieldValue.serverTimestamp();
  const nowDate = () => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
  const todayIso = () => { const [day, month, year] = nowDate().split('/'); return `${year}-${month}-${day}`; };
  const normalizeRole = value => low(value).replace(/\(a\)/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  const isEligibleRole = value => ELIGIBLE_ROLES.has(normalizeRole(value));
  const activeDecision = record => ACTIVE_DECISIONS.has(low(record.decisao || record.status || 'PENDENTE')) && record.consumido_em_acumulo !== true;
  const recordType = record => {
    const value = low(record.punicao || record.tipo_ocorrencia || record.tipo || record.motivo);
    if (value.includes('notifica')) return 'notificacao';
    if (value.includes('advert') && value.includes('interna')) return 'advertencia';
    if (value.includes('erro')) return 'erro';
    return 'outro';
  };
  const recordDate = record => record.data_formatada || record.data || 'Sem data';
  const validUrl = value => { try { const url = new URL(clean(value)); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch (_) { return ''; } };
  const hash = value => { let result = 2166136261; for (let i = 0; i < value.length; i += 1) { result ^= value.charCodeAt(i); result = Math.imul(result, 16777619); } return (result >>> 0).toString(36); };

  function toast(message, type = 'info') {
    const labels = { info: 'Informação', success: 'Sucesso', warning: 'Atenção', error: 'Erro' };
    const icons = { info: 'ti-info-circle', success: 'ti-circle-check', warning: 'ti-alert-triangle', error: 'ti-circle-x' };
    const element = document.createElement('div');
    element.className = 'toast'; element.dataset.type = type;
    element.innerHTML = `<i class="ti ${icons[type]}"></i><div><strong>${labels[type]}</strong><span>${esc(message)}</span></div>`;
    $('toast-container').append(element); setTimeout(() => element.remove(), 6500);
  }
  function setBusy(button, enabled, label = 'Processando…') {
    if (!button) return;
    if (enabled) { button.dataset.original = button.innerHTML; button.disabled = true; button.innerHTML = `<i class="ti ti-loader-2"></i> ${esc(label)}`; }
    else { button.disabled = false; if (button.dataset.original) button.innerHTML = button.dataset.original; delete button.dataset.original; }
  }
  function deny(title, message) {
    $('access-title').textContent = title; $('access-message').textContent = message;
    document.querySelector('.access-loader')?.remove();
  }

  async function forumUsername() {
    const direct = clean(window._userdata?.username || window._userdata?.['username']);
    if (direct && low(direct) !== 'convidado') return direct;
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch('/forum', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const patterns = [
        /_userdata\[['"]username['"]\]\s*=\s*['"]([^'"]+)['"]/i,
        /_userdata\.username\s*=\s*['"]([^'"]+)['"]/i,
        /"username"\s*:\s*"([^"]+)"/i,
        /<a[^>]+href=["'][^"']*\/u\d+[^"']*["'][^>]*>([^<]+)<\/a>/i
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern); if (!match?.[1]) continue;
        const decoder = document.createElement('textarea'); decoder.innerHTML = match[1];
        const nick = clean(decoder.value); if (nick && low(nick) !== 'convidado') return nick;
      }
      throw new Error('Usuário não localizado no HTML do fórum.');
    } finally { clearTimeout(timeout); }
  }

  async function findProfile(nick) {
    const users = state.db.collection('users');
    const fields = ['name', 'nick', 'nickname', 'username'];
    for (const field of fields) {
      const snapshot = await users.where(field, '==', nick).limit(1).get();
      if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }
    const snapshot = await users.get();
    const doc = snapshot.docs.find(item => [item.data().name, item.data().nick, item.data().nickname, item.data().username].some(value => low(value) === low(nick)));
    return doc ? { id: doc.id, ...doc.data() } : null;
  }

  function toMillis(value, fallback = 0) {
    if (!value) return fallback;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (value instanceof Date) return value.getTime();
    const parsed = Date.parse(value); return Number.isNaN(parsed) ? fallback : parsed;
  }
  function bestHistoryMillis(record) {
    const timestamp = record.statusAlteradoEm || record.atualizadoEm || record.timestamp;
    const direct = toMillis(timestamp); if (direct) return direct;
    const match = clean(record.data_formatada || record.data).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime() : 0;
  }
  function dateGroup(millis) { return millis ? new Intl.DateTimeFormat('pt-BR', { timeZone:'America/Sao_Paulo', day:'2-digit', month:'long', year:'numeric' }).format(new Date(millis)) : 'Data não informada'; }

  function recordCard(record) {
    const type = recordType(record), nick = clean(record.nick || record.nickname || 'Não identificado');
    return `<article class="record-card" data-type="${type}"><div class="record-head"><div class="person"><img src="${forumAvatar(nick)}" alt=""><div><strong>${esc(nick)}</strong><small>${esc(record.cargo || 'Cargo não informado')}</small></div></div><span class="type-badge">${esc(record.punicao || 'Ocorrência')}</span></div><p class="record-motive">${esc(record.motivo || 'Motivo não informado.')}</p><div class="record-meta"><span>Data<strong>${esc(recordDate(record))}</strong></span><span>Situação<strong>${esc(record.decisao || 'PENDENTE')}</strong></span></div></article>`;
  }
  function renderActive() {
    const query = low($('active-search').value);
    const active = state.records.filter(activeDecision).filter(record => !query || [record.nick, record.cargo, record.punicao, record.motivo].some(value => low(value).includes(query)));
    const total = state.records.filter(activeDecision).length;
    $('active-nav-count').textContent = total; $('active-hero-count').textContent = `${total} ocorrência${total === 1 ? '' : 's'}`;
    $('active-grid').classList.toggle('list-mode', state.activeLayout === 'list');
    $('active-cards-button').classList.toggle('active', state.activeLayout === 'cards');
    $('active-list-button').classList.toggle('active', state.activeLayout === 'list');
    $('active-grid').innerHTML = active.length ? active.map(recordCard).join('') : `<div class="empty"><i class="ti ti-shield-check"></i><h3>Nenhum registro ativo</h3><p>Não há ocorrências vigentes correspondentes à pesquisa.</p></div>`;
  }
  function renderHistory() {
    const query = low($('history-search').value);
    const history = state.records.filter(record => !activeDecision(record)).filter(record => !query || [record.nick, record.cargo, record.punicao, record.motivo, record.decisao].some(value => low(value).includes(query))).sort((a,b) => bestHistoryMillis(b) - bestHistoryMillis(a));
    $('history-hero-count').textContent = `${history.length} registro${history.length === 1 ? '' : 's'}`;
    if (!history.length) { $('history-timeline').innerHTML = `<div class="empty"><i class="ti ti-history-off"></i><h3>Nenhum histórico</h3><p>Os registros encerrados ou consumidos aparecerão aqui.</p></div>`; return; }
    const groups = new Map(); history.forEach(record => { const label = dateGroup(bestHistoryMillis(record)); if (!groups.has(label)) groups.set(label, []); groups.get(label).push(record); });
    $('history-timeline').innerHTML = [...groups].map(([label, items]) => `<section class="history-group"><header><h3>${esc(label)}</h3></header><div class="history-items">${items.map(record => `<article class="history-item"><strong>${esc(record.nick || 'Não identificado')}</strong><span>${esc(record.punicao || 'Ocorrência')}</span><p>${esc(record.motivo || 'Sem motivo informado.')}</p><b class="status-badge">${esc(record.decisao || 'ENCERRADO')}</b></article>`).join('')}</div></section>`).join('');
  }

  function recommendation(type, sources, index) {
    const first = sources[0], internal = type === 'notificacao';
    const sourceName = internal ? 'notificações' : 'erros';
    const punishment = internal ? 'ADVERTÊNCIA INTERNA' : 'NOTIFICAÇÃO';
    const ids = sources.map(item => item.id).sort();
    return { id: `acumulo_${hash(`${type}|${ids.join('|')}`)}`, nick: clean(first.nick), cargo: clean(first.cargo), sourceType: type, sourceName, punishment, kind: internal ? 'adv_interna' : 'adv_verbal', internal, sources, sequence: index + 1 };
  }
  function analyze() {
    const eligible = state.records.filter(record => activeDecision(record) && ['erro','notificacao'].includes(recordType(record)));
    const groups = new Map();
    eligible.forEach(record => { const key = low(record.nick); if (!key) return; if (!groups.has(key)) groups.set(key, { erro: [], notificacao: [] }); groups.get(key)[recordType(record)].push(record); });
    const result = [];
    groups.forEach(bucket => {
      ['notificacao', 'erro'].forEach(type => {
        const records = bucket[type].sort((a,b) => bestHistoryMillis(a) - bestHistoryMillis(b));
        for (let index = 0; index + 2 < records.length; index += 3) result.push(recommendation(type, records.slice(index, index + 3), index / 3));
      });
    });
    state.recommendations = result; renderRecommendations();
    $('analysis-status').textContent = result.length ? `${result.length} punição${result.length === 1 ? '' : 'ões'} pronta${result.length === 1 ? '' : 's'}` : 'Nenhum acúmulo encontrado';
    toast(result.length ? `${result.length} recomendação(ões) preparada(s). Revise e publique manualmente.` : 'Nenhum conjunto completo de três foi localizado.', result.length ? 'success' : 'info');
  }
  function renderRecommendations() {
    $('accumulation-nav-count').textContent = state.recommendations.length;
    $('accumulation-grid').innerHTML = state.recommendations.length ? state.recommendations.map(item => `<article class="accumulation-card ${item.internal ? 'internal' : ''}"><div class="accumulation-head"><div class="person"><img src="${forumAvatar(item.nick)}" alt=""><div><strong>${esc(item.nick)}</strong><small>${esc(item.cargo)}</small></div></div><span class="type-badge">3 ${esc(item.sourceName)}</span></div><h3 class="accumulation-title">${esc(item.punishment)}</h3><p class="accumulation-reason">Motivo: Acúmulo de 3 ${esc(item.sourceName)}</p><div class="source-mini-list">${item.sources.map((source, i) => `<span><b>#${i + 1} · ${esc(source.punicao || source.tipo_ocorrencia || 'Ocorrência')}</b><small>${esc(recordDate(source))}</small></span>`).join('')}</div><button class="primary-button" type="button" data-open-accumulation="${item.id}"><i class="ti ti-eye-check"></i> Revisar e postar</button></article>`).join('') : `<div class="empty"><i class="ti ti-scan"></i><h3>Nenhuma análise preparada</h3><p>Clique em “Analisar agora”. A análise não realiza nenhuma postagem automaticamente.</p></div>`;
    document.querySelectorAll('[data-open-accumulation]').forEach(button => button.onclick = () => openAccumulation(button.dataset.openAccumulation));
  }

  function letterTemplate(internal) {
    const heading = internal ? 'CARTA DE ADVERTÊNCIA INTERNA' : 'CARTA DE NOTIFICAÇÃO';
    const intro = internal ? 'Informa-se que você [b]recebeu uma advertência interna[/b] na companhia pelo(s) seguinte(s) motivo(s):' : 'Informa-se que você foi [b]notificado(a)[/b] na companhia pelo(s) seguinte(s) motivo(s):';
    return `[font=Poppins]<div style="border:1.5rem solid #821F88;border-radius:8px;font-family:Poppins;">[table][tr][td][center][img]https://i.imgur.com/hU7bn8R.gif[/img][/center]\n\n[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][center][img]https://i.imgur.com/QL68H2C.png[/img][/center][size=20][font=Poppins][color=white][b]${heading}[/b][/color][/font][/size][/td][/tr][/table]\n<div style="padding:1.5%;border:1px solid #bdbdbd;border-radius:8px;">[justify]Saudações, [b]{USERNAME}[/b].\n\n${intro}\n\n[b]{MOTIVO}[/b]\n\n[color=#821F88][b]COMENTÁRIOS:[/b][/color] {COMENTARIO}\n[color=#821F88][b]ANEXOS:[/b][/color] {ANEXO}\n\nLeia as documentações que regem a companhia [url=https://nexusprof.netlify.app/documentos/regimento]clicando aqui[/url] e procure manter-se atento para evitar mais punições. Caso queira recorrer da punição recebida, procure a Liderança apresentando argumentos factuais e plausíveis.[/justify]</div>[/td][/tr][/table]</div>[/font]\n[font=Poppins][center]Atentamente,\n[img]https://i.imgur.com/1kZvQHs.png[/img][/center][/font]`;
  }
  function topicBBCode(item) {
    const person = item.internal ? 'advertido(a)' : 'notificado(a)';
    return `[font=Poppins][size=18][center][color=#560c7e][b]${item.punishment}[/b][/color][/center][/size]\n\n[justify][b]Cargo e nick do(a) ${person}:[/b] ${item.cargo} ${item.nick}\n[b]Motivo:[/b] Acúmulo de 3 ${item.sourceName}\n[b]Data:[/b] ${nowDate()}\n[b]Permissão:[/b] Conselho da Assistência\n[/justify][/font]`;
  }
  function pmBBCode(item, proof, comment) { return letterTemplate(item.internal).replaceAll('{USERNAME}', item.nick).replaceAll('{MOTIVO}', `Acúmulo de 3 ${item.sourceName}`).replaceAll('{COMENTARIO}', comment).replaceAll('{ANEXO}', proof || '[link do print]'); }
  function updatePreviews() {
    if (!state.selected) return;
    $('topic-preview').textContent = topicBBCode(state.selected);
    $('pm-preview').textContent = pmBBCode(state.selected, clean($('proof-url').value), clean($('letter-comment').value));
  }
  function openAccumulation(id) {
    const item = state.recommendations.find(entry => entry.id === id); if (!item) return;
    state.selected = item;
    $('dialog-title').textContent = item.punishment;
    $('dialog-description').textContent = `${item.cargo} ${item.nick} · Acúmulo de 3 ${item.sourceName}`;
    $('proof-label').textContent = `Print do acúmulo de ${item.nick}`;
    $('dialog-sources').innerHTML = item.sources.map((source, index) => `<div class="source-item"><b>${index + 1}</b><span><strong>${esc(source.punicao || 'Ocorrência')}</strong><small>${esc(source.motivo || 'Sem motivo informado')}</small></span><time>${esc(recordDate(source))}</time></div>`).join('');
    $('proof-url').value = ''; $('letter-comment').value = `Punição aplicada após a identificação do acúmulo de 3 ${item.sourceName}.`;
    $('dialog-error').hidden = true; updatePreviews(); $('accumulation-dialog').showModal();
  }

  function endDateFields() {
    const formatted = nowDate(), [day, month, year] = formatted.split('/').map(Number);
    const end = new Date(Date.UTC(year, month - 1, day)); end.setUTCDate(end.getUTCDate() + 30);
    const pad = value => String(value).padStart(2, '0');
    return { formatted, iso: `${year}-${pad(month)}-${pad(day)}`, end: `${pad(end.getUTCDate())}/${pad(end.getUTCMonth()+1)}/${end.getUTCFullYear()}` };
  }
  async function forumSubmit(path, data) {
    const body = new URLSearchParams(); Object.entries(data).forEach(([key, value]) => body.append(key, clean(value)));
    const response = await fetch(path, { method:'POST', credentials:'same-origin', redirect:'follow', headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'}, body:body.toString() });
    if (!response.ok) throw new Error(`O fórum recusou o envio (HTTP ${response.status}).`);
    const html = await response.text();
    if (/Você deve estar conectado|You must be logged|mode=login/i.test(html) && /login|conect/i.test(html)) throw new Error('A sessão do fórum expirou. Recarregue a página e entre novamente.');
    return true;
  }
  async function finishFirebase(item, proof, comment, operationRef) {
    const dates = endDateFields(), recordRef = state.db.collection(RECORDS).doc(item.id);
    await state.db.runTransaction(async transaction => {
      for (const source of item.sources) {
        const ref = state.db.collection(RECORDS).doc(source.id), snapshot = await transaction.get(ref);
        if (!snapshot.exists || snapshot.data().consumido_em_acumulo === true) throw new Error('Um dos registros já foi utilizado por outro acúmulo. Atualize a página.');
      }
      transaction.set(recordRef, {
        cargo:item.cargo, nick:item.nick, punicao:item.punishment, motivo:`Acúmulo de 3 ${item.sourceName}`,
        permissao:'Conselho da Assistência', data_formatada:dates.formatted, data_iso:dates.iso, data_termino:dates.end,
        decisao:'PENDENTE', observacao:comment, carta_enviada:true, autor_postagem:state.nick,
        sincronizado_sheets:false, tipo_ocorrencia:item.kind, origem:'acumulo_assistencia', anexo:proof,
        acumulo_id:item.id, registros_origem:item.sources.map(source => source.id), timestamp:serverTime(), atualizadoEm:serverTime()
      }, { merge:true });
      item.sources.forEach(source => transaction.update(state.db.collection(RECORDS).doc(source.id), {
        decisao:'ACÚMULO', status_anterior:source.decisao || 'PENDENTE', consumido_em_acumulo:true,
        acumulo_id:item.id, statusAlteradoEm:serverTime(), statusAlteradoPor:state.nick, atualizadoEm:serverTime()
      }));
      transaction.set(operationRef, { status:'concluido', registroGeradoId:item.id, concluidoEm:serverTime(), atualizadoEm:serverTime() }, { merge:true });
    });
  }
  async function postSelected() {
    if (state.busy || !state.selected) return;
    const item = state.selected, proof = validUrl($('proof-url').value), comment = clean($('letter-comment').value);
    if (!proof) { $('dialog-error').textContent = 'Informe um link válido começando com http:// ou https://.'; $('dialog-error').hidden = false; return; }
    if (!comment) { $('dialog-error').textContent = 'O comentário da carta é obrigatório.'; $('dialog-error').hidden = false; return; }
    const topicId = clean($('topic-id').value || '32246'); if (!/^\d+$/.test(topicId)) { toast('Configure um ID de tópico válido.', 'error'); return; }
    state.busy = true; setBusy($('confirm-accumulation'), true, 'Publicando…');
    const operationRef = state.db.collection(OPERATIONS).doc(item.id);
    try {
      let operation = (await operationRef.get()).data() || {};
      if (operation.status === 'concluido') throw new Error('Este acúmulo já foi concluído. Atualize os dados.');
      await operationRef.set({ id:item.id, status:'preparado', nick:item.nick, cargo:item.cargo, punicao:item.punishment, tipoOrigem:item.sourceName, registrosOrigem:item.sources.map(source => source.id), anexo:proof, comentario:comment, autor:state.nick, criadoEm:operation.criadoEm || serverTime(), atualizadoEm:serverTime() }, { merge:true });
      if (operation.topicoEnviado !== true) {
        await forumSubmit('/post', { t:topicId, message:topicBBCode(item), mode:'reply', post:'Enviar' });
        await operationRef.set({ topicoEnviado:true, topicoEnviadoEm:serverTime(), atualizadoEm:serverTime() }, { merge:true });
      }
      operation = (await operationRef.get()).data() || {};
      if (operation.mpEnviada !== true) {
        const subject = item.internal ? '[PROF] CARTA DE ADVERTÊNCIA INTERNA' : '[PROF] CARTA DE NOTIFICAÇÃO';
        await forumSubmit('/privmsg', { folder:'inbox', mode:'post', post:'1', 'username[]':item.nick, subject, message:pmBBCode(item, proof, comment) });
        await operationRef.set({ mpEnviada:true, mpEnviadaEm:serverTime(), atualizadoEm:serverTime() }, { merge:true });
      }
      await finishFirebase(item, proof, comment, operationRef);
      state.recommendations = state.recommendations.filter(entry => entry.id !== item.id); renderRecommendations();
      $('accumulation-dialog').close(); state.selected = null;
      toast(`${item.punishment} publicada para ${item.nick}, com MP e atualização do Firebase.`, 'success');
    } catch (error) { console.error(error); toast(error.message || 'Não foi possível concluir a postagem.', 'error'); }
    finally { state.busy = false; setBusy($('confirm-accumulation'), false); }
  }

  function manualDateFields(isoValue) {
    const match = clean(isoValue).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const start = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 30);
    const pad = value => String(value).padStart(2, '0');
    return {
      iso: `${match[1]}-${match[2]}-${match[3]}`,
      formatted: `${match[3]}/${match[2]}/${match[1]}`,
      end: `${pad(end.getUTCDate())}/${pad(end.getUTCMonth() + 1)}/${end.getUTCFullYear()}`
    };
  }

  async function saveManualRecord(event) {
    event.preventDefault();
    if (state.busy || !state.db) return;
    const cargo = clean($('manual-cargo').value), nick = clean($('manual-nick').value), type = clean($('manual-type').value);
    const reason = clean($('manual-reason').value), observation = clean($('manual-observation').value);
    const rawAttachment = clean($('manual-attachment').value), attachment = rawAttachment ? validUrl(rawAttachment) : '';
    const dates = manualDateFields($('manual-date').value);
    if (!cargo || !nick || !type || !reason || !dates) return toast('Preencha todos os campos obrigatórios.', 'warning');
    if (rawAttachment && !attachment) return toast('O link do anexo deve começar com http:// ou https://.', 'warning');
    const punishmentByType = { erro:'ERRO', adv_verbal:'NOTIFICAÇÃO', adv_interna:'ADVERTÊNCIA INTERNA' };
    if (!punishmentByType[type]) return toast('Selecione um tipo de ocorrência válido.', 'warning');
    const recordId = `manual_${Date.now()}_${hash(`${nick}|${type}|${reason}`)}`.slice(0, 190);
    const button = $('save-manual-record'); state.busy = true; setBusy(button, true, 'Salvando…');
    try {
      await state.db.collection(RECORDS).doc(recordId).set({
        cargo, nick, punicao:punishmentByType[type], motivo:reason,
        permissao:'Conselho da Assistência', data_formatada:dates.formatted,
        data_iso:dates.iso, data_termino:dates.end, decisao:'PENDENTE',
        observacao:observation, carta_enviada:false, autor_postagem:state.nick,
        sincronizado_sheets:false, tipo_ocorrencia:type, origem:'manual_assistencia',
        anexo:attachment, timestamp:serverTime(), atualizadoEm:serverTime()
      });
      event.currentTarget.reset(); $('manual-date').value = todayIso();
      toast(`Registro de ${nick} salvo no Firebase.`, 'success'); navigate('ativos');
    } catch (error) { console.error(error); toast(`Não foi possível salvar: ${error.message}`, 'error'); }
    finally { state.busy = false; setBusy(button, false); }
  }

  function subscribeRecords() {
    if (state.unsubscribe) state.unsubscribe();
    state.unsubscribe = state.db.collection(RECORDS).onSnapshot(snapshot => {
      state.records = snapshot.docs.map(doc => ({ id:doc.id, ...doc.data() })); renderActive(); renderHistory();
    }, error => { console.error(error); toast(`Falha ao carregar os registros: ${error.message}`, 'error'); });
  }
  function navigate(view) {
    document.querySelectorAll('.view').forEach(element => { element.hidden = element.id !== `view-${view}`; });
    document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
    const labels = { ativos:'Registros ativos', novo:'Novo registro', acumulos:'Análise de acúmulos', historico:'Histórico', configuracoes:'Configurações' };
    $('page-label').textContent = labels[view] || labels.ativos; $('sidebar').classList.remove('open'); location.hash = view;
  }
  function bind() {
    document.querySelectorAll('[data-view]').forEach(button => button.onclick = () => navigate(button.dataset.view));
    $('menu-button').onclick = () => $('sidebar').classList.toggle('open'); $('sidebar-overlay').onclick = () => $('sidebar').classList.remove('open');
    $('active-search').oninput = renderActive; $('history-search').oninput = renderHistory; $('analyze-button').onclick = analyze;
    $('active-cards-button').onclick = () => { state.activeLayout='cards'; localStorage.setItem(ACTIVE_LAYOUT_KEY,'cards'); renderActive(); };
    $('active-list-button').onclick = () => { state.activeLayout='list'; localStorage.setItem(ACTIVE_LAYOUT_KEY,'list'); renderActive(); };
    $('manual-record-form').onsubmit = saveManualRecord;
    $('refresh-button').onclick = () => { state.recommendations = []; renderRecommendations(); $('analysis-status').textContent = 'Clique em analisar'; toast('Os dados em tempo real já estão atualizados.', 'info'); };
    $('close-dialog').onclick = $('cancel-dialog').onclick = () => { if (!state.busy) $('accumulation-dialog').close(); };
    $('proof-url').oninput = $('letter-comment').oninput = updatePreviews; $('confirm-accumulation').onclick = postSelected;
    document.querySelectorAll('[data-preview]').forEach(button => button.onclick = () => { document.querySelectorAll('[data-preview]').forEach(item => item.classList.toggle('active', item === button)); $('topic-preview').hidden = button.dataset.preview !== 'topic'; $('pm-preview').hidden = button.dataset.preview !== 'pm'; });
    $('save-settings').onclick = () => { const id = clean($('topic-id').value); if (!/^\d+$/.test(id)) return toast('Informe somente o número do tópico.', 'error'); localStorage.setItem(SETTINGS_KEY, JSON.stringify({ topicId:id })); toast('Configuração salva.', 'success'); };
    $('theme-button').onclick = () => { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next; localStorage.setItem(THEME_KEY, next); $('theme-button').innerHTML = `<i class="ti ${next === 'dark' ? 'ti-sun' : 'ti-moon'}"></i>`; };
  }

  async function init() {
    bind(); renderRecommendations();
    const theme = localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; $('theme-button').innerHTML = `<i class="ti ${theme === 'dark' ? 'ti-sun' : 'ti-moon'}"></i>`;
    try { const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); if (settings.topicId) $('topic-id').value = settings.topicId; } catch (_) {}
    $('manual-date').value = todayIso();
    try {
      state.nick = await forumUsername();
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      state.auth = firebase.auth(); state.db = firebase.firestore();
      if (!state.auth.currentUser) await state.auth.signInAnonymously();
      state.profile = await findProfile(state.nick);
      if (!state.profile) return deny('Acesso não localizado', `O nickname ${state.nick} não foi encontrado no cadastro de membros.`);
      const profileRole = state.profile.cargo || state.profile.cargoAtual || state.profile.funcao || state.profile.role;
      if (!isEligibleRole(profileRole)) return deny('Acesso negado', 'Esta página é exclusiva para Estagiário(a), Conselheiro(a), Vice-Líder e Líder.');
      state.profile.cargo = profileRole;
      $('current-nick').textContent = state.nick; $('current-role').textContent = profileRole; $('current-avatar').src = forumAvatar(state.nick);
      subscribeRecords();
      $('access-screen').classList.add('hidden'); setTimeout(() => { $('access-screen').hidden = true; }, 230);
      navigate(location.hash.slice(1) || 'ativos');
    } catch (error) { console.error(error); deny('Não foi possível entrar', error.message || 'Confira sua sessão do fórum e as configurações do Firebase.'); }
  }
  init();
})();
