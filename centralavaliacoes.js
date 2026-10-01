(() => {
  'use strict';

  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyDo4DagZchii1cPKFighZU5KAjppp98HJE',
    authDomain: 'nexusprof.firebaseapp.com',
    projectId: 'nexusprof',
    storageBucket: 'nexusprof.appspot.com',
    messagingSenderId: '268861178598',
    appId: '1:268861178598:web:9686b81bb003f9514fb127',
  };
  const THEME_KEY = 'NEXUS_CENTRAL_AVALIACOES_THEME';
  const PROMOTION_RANKS = ['professor', 'coordenador', 'graduador'];
  const PROPOSAL_VERDICTS = [
    ['Aprovada', 'fa-check'],
    ['Aprovada com alterações', 'fa-check-double'],
    ['Reprovada', 'fa-xmark'],
    ['Reunião', 'fa-users'],
    ['Tutela', 'fa-shield-halved'],
    ['Enviado à liderança', 'fa-arrow-up'],
    ['Autoria própria', 'fa-pen'],
  ];
  const S = {
    db: null,
    nick: '',
    profile: null,
    users: [],
    promotions: [],
    proposals: [],
    promotionVotes: [],
    proposalVotes: [],
    licenses: [],
    cycle: null,
    screen: 'home',
    selectedPromotion: 0,
    selectedProposal: 0,
    promotionFilter: 'todos',
    compare: [],
    performance: new Map(),
    saveTimer: null,
    saveState: 'idle',
    busy: false,
  };

  let root;
  const norm = value => String(value ?? '').trim().toLocaleLowerCase('pt-BR');
  const plain = value => norm(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const clean = (value, fallback = '') => {
    const text = String(value ?? '').trim();
    return text || fallback;
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const key = value => plain(value).replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'registro';
  const nickOf = user => clean(user?.name || user?.nick || user?.nickname);
  const dataOf = doc => ({ id: doc.id, ...doc.data() });
  const sent = record => Boolean(record && (record.status === 'enviado' || (!record.status && (record.veredito || record.Veredito))));
  const avatar = (nick, headOnly = true) => `https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(nick)}&direction=2&head_direction=2&gesture=sml&size=m&headonly=${headOnly ? 1 : 0}&img_format=png`;
  const serverTime = () => firebase.firestore.FieldValue.serverTimestamp();
  const docTime = value => {
    if (value?.toDate) return value.toDate();
    if (typeof value === 'number') return new Date(value);
    const text = clean(value);
    const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const brDate = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const normalized = isoDate
      ? `${isoDate[1]}-${isoDate[2]}-${isoDate[3]}T12:00:00-03:00`
      : brDate
        ? `${brDate[3]}-${brDate[2]}-${brDate[1]}T12:00:00-03:00`
        : value || NaN;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const dateLabel = value => {
    const date = docTime(value);
    return date ? date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Não informado';
  };
  const daysSince = value => {
    const date = docTime(value);
    if (!date) return 'Não informado';
    const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
    if (days < 30) return `${days} dia${days === 1 ? '' : 's'}`;
    const months = Math.floor(days / 30);
    return `${months} ${months === 1 ? 'mês' : 'meses'}`;
  };
  const normalizeCargo = value => {
    const cargo = plain(value);
    if (cargo.includes('professor')) return 'professor';
    if (cargo.includes('coordenador')) return 'coordenador';
    if (cargo.includes('graduador')) return 'graduador';
    return '';
  };
  const cargoLabel = cargo => ({ professor: 'Professor', coordenador: 'Coordenador', graduador: 'Graduador' }[cargo] || clean(cargo, 'Membro'));
  const firstValue = (...values) => values.find(value => value !== undefined && value !== null && String(value).trim() !== '');
  const numberLabel = value => {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString('pt-BR') : 'Não disponível';
  };
  const percentLabel = value => {
    const raw = firstValue(value);
    if (raw === undefined) return 'Não disponível';
    const text = String(raw).trim();
    return text.includes('%') ? text : `${text}%`;
  };
  const bestWeekLabel = performance => clean(
    firstValue(
      performance.melhorSemanaLabel,
      performance.semanaMaiorPorcentagem,
      performance.melhorSemana,
      performance.semanaDestaque,
    ),
    'Não disponível',
  );
  const allowedRole = value => {
    const cargo = plain(value).replace(/\(a\)/g, '');
    return cargo.includes('estagiari') || cargo.includes('conselheir') || cargo.includes('vice-lider') || cargo === 'lider' || cargo.includes('lider da companhia');
  };
  const cycleOpen = () => {
    if (!S.cycle) return true;
    if (S.cycle.status && !['open', 'aberto', 'ativo'].includes(plain(S.cycle.status))) return false;
    const start = docTime(S.cycle.start || S.cycle.inicio);
    const end = docTime(S.cycle.end || S.cycle.fim);
    return (!start || Date.now() >= start.getTime()) && (!end || Date.now() <= end.getTime());
  };
  const ownPromotionVote = item => S.promotionVotes.find(v => norm(v.avaliador) === norm(S.nick) && norm(v.nick_avaliado) === norm(item.nick) && normalizeCargo(v.cargo) === item.cargo);
  const promotionVotesFor = item => S.promotionVotes.filter(v => sent(v) && norm(v.nick_avaliado) === norm(item.nick) && normalizeCargo(v.cargo) === item.cargo);
  const ownProposalVote = item => S.proposalVotes.find(v => norm(v.Nick ?? v.nick) === norm(S.nick) && Number(v.Ordem ?? v.ordem) === item.ordem);
  const proposalVotesFor = item => S.proposalVotes.filter(v => sent(v) && Number(v.Ordem ?? v.ordem) === item.ordem);

  function toast(message, error = false) {
    const node = document.getElementById('nca-toast');
    if (!node) return;
    node.className = `nca-toast is-visible${error ? ' is-error' : ''}`;
    node.innerHTML = `<i class="fa-solid ${error ? 'fa-triangle-exclamation' : 'fa-circle-info'}"></i><span>${esc(message)}</span>`;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('is-visible'), 5500);
  }

  function stateScreen(icon, title, message, retry = false) {
    root.innerHTML = `<div class="nca-app"><div class="nca-topline"></div><main class="nca-state"><section class="nca-state-card"><i class="fa-solid ${icon}"></i><h1>${esc(title)}</h1><p>${esc(message)}</p>${retry ? '<button id="nca-retry" class="nca-button nca-button--primary"><i class="fa-solid fa-rotate-right"></i>Tentar novamente</button>' : ''}</section></main></div>`;
    document.getElementById('nca-retry')?.addEventListener('click', init);
  }

  async function forumUser() {
    const fromPage = window._userdata?.username;
    if (window._userdata?.session_logged_in && fromPage && !/^(Anonymous|Convidado|Guest)$/i.test(fromPage)) return clean(fromPage);
    if (!/(^|\.)policiarcc\.com$/i.test(location.hostname)) throw new Error('Abra esta página dentro do Forumeiros para identificar sua conta.');
    const response = await fetch('/forum', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Não foi possível confirmar sua sessão no fórum.');
    const html = await response.text();
    const logged = html.match(/_userdata\s*\[\s*["']session_logged_in["']\s*\]\s*=\s*(\d)/i);
    const match = html.match(/_userdata\s*\[\s*["']username["']\s*\]\s*=\s*["']([^"']+)["']/i) || html.match(/_userdata\.username\s*=\s*["']([^"']+)["']/i);
    if (!logged || logged[1] !== '1' || !match || /^(Anonymous|Convidado|Guest)$/i.test(match[1])) throw new Error('Entre na sua conta do fórum para acessar a Central.');
    const decoder = document.createElement('textarea');
    decoder.innerHTML = match[1];
    return clean(decoder.value);
  }

  async function safeGet(promise, fallback = []) {
    try { return await promise; } catch (error) { console.warn('Leitura opcional indisponível:', error); return fallback; }
  }

  async function load() {
    const usersSnap = await S.db.collection('users').get();
    S.users = usersSnap.docs.map(dataOf);
    const matches = S.users.filter(user => norm(nickOf(user)) === norm(S.nick));
    if (matches.length !== 1) throw new Error('Seu nickname não foi localizado de forma única no Nexus.');
    S.profile = matches[0];
    if (plain(S.profile.status) !== 'ativo') throw new Error('Seu cadastro no Nexus não está ativo.');
    if (!allowedRole(S.profile.cargo)) throw new Error(`O cargo ${clean(S.profile.cargo, 'não informado')} não possui acesso a esta Central.`);

    const settings = S.db.collection('nexus_config').doc('avaliacoes').collection('configuracoes').doc('ciclo');
    const proposalRoot = S.db.collection('nexus_config').doc('Propostas');
    const [listsSnap, promotionVotesSnap, proposalsSnap, proposalVotesSnap, licensesSnap, cycleSnap] = await Promise.all([
      S.db.collection('listas_promocao').get(),
      S.db.collection('avaliacoes_nexus').get(),
      proposalRoot.collection('lista_propostas').get(),
      proposalRoot.collection('votos_conselho').get(),
      safeGet(S.db.collection('licencas').get(), null),
      safeGet(settings.get(), null),
    ]);
    const lists = listsSnap.docs.map(dataOf);
    S.promotions = lists.flatMap(list => {
      const cargo = normalizeCargo(list.id);
      if (!cargo || !Array.isArray(list.nicks)) return [];
      return list.nicks.map(nick => ({ nick: clean(nick), cargo, vagas: Number(list.vagas || 0) })).filter(item => item.nick);
    });
    S.promotionVotes = promotionVotesSnap.docs.map(dataOf);
    S.proposals = proposalsSnap.docs.map(doc => {
      const data = dataOf(doc);
      return {
        ...data,
        ordem: Number(data.ordem ?? data.Ordem ?? doc.id) || 0,
        titulo: clean(data.titulo ?? data.Titulo, 'Proposta sem título'),
        autor: clean(data.autor ?? data.Autor, 'Autor não informado'),
        tipo: clean(data.tipo ?? data.categoria ?? data.Categoria, 'Proposta'),
        conteudo: clean(data.conteudo ?? data.texto ?? data.descricao, 'Conteúdo não informado.'),
        data: data.data ?? data.Data,
      };
    }).filter(item => item.ordem).sort((a, b) => b.ordem - a.ordem);
    S.proposalVotes = proposalVotesSnap.docs.map(dataOf);
    S.licenses = licensesSnap?.docs?.map(dataOf) || [];
    S.cycle = cycleSnap?.exists ? cycleSnap.data() : null;
  }

  function header() {
    return `<header class="nca-header"><div class="nca-brand"><span class="nca-brand-mark">N</span><div><strong>NEXUS</strong><small>Central de avaliações</small></div></div><div class="nca-actions"><button id="nca-home" class="nca-icon-button" title="Voltar ao início"><i class="fa-solid fa-house"></i></button><button id="nca-theme" class="nca-icon-button" title="Alternar tema"><i class="fa-solid ${document.documentElement.dataset.theme === 'light' ? 'fa-moon' : 'fa-sun'}"></i></button><div class="nca-user"><img src="${avatar(S.nick)}" alt=""><div><strong>${esc(S.nick)}</strong><small>${esc(S.profile?.cargo)}</small></div></div></div></header>`;
  }

  function progress() {
    const ownPromotions = S.promotions.filter(item => sent(ownPromotionVote(item))).length;
    const ownProposals = S.proposals.filter(item => sent(ownProposalVote(item))).length;
    const total = S.promotions.length + S.proposals.length;
    const done = ownPromotions + ownProposals;
    const percentage = total ? Math.round((done / total) * 100) : 0;
    return `<aside class="nca-progress-card"><div class="nca-progress-head"><span>Seu progresso</span><strong>${done} de ${total}</strong></div><div class="nca-progress-track"><span style="width:${percentage}%"></span></div><small>${percentage}% das avaliações disponíveis foram enviadas.</small></aside>`;
  }

  function shell(content, title = 'Central de <em>Avaliações.</em>', description = 'Analise propostas e candidatos sem sair do Forumeiros.') {
    root.innerHTML = `<div class="nca-app"><div class="nca-topline"></div><div class="nca-shell">${header()}<section class="nca-hero"><div><p class="nca-kicker">Conselho da Companhia dos Professores</p><h1>${title}</h1><p class="nca-hero-copy">${esc(description)}</p></div>${progress()}</section>${content}</div><div id="nca-toast" class="nca-toast" aria-live="polite"></div><div id="nca-modal" class="nca-modal" hidden></div></div>`;
    document.getElementById('nca-home').onclick = () => { S.screen = 'home'; render(); };
    document.getElementById('nca-theme').onclick = toggleTheme;
  }

  function renderHome() {
    const promotionReady = cycleOpen() && S.promotions.length > 0;
    const proposalReady = S.proposals.length > 0;
    const promotionDone = S.promotions.filter(item => sent(ownPromotionVote(item))).length;
    const proposalDone = S.proposals.filter(item => sent(ownProposalVote(item))).length;
    shell(`<section class="nca-home-grid"><button class="nca-entry" data-open="promotions" ${promotionReady ? '' : 'disabled'}><span class="nca-entry-icon"><i class="fa-solid fa-user-graduate"></i></span><span class="nca-entry-meta">${promotionReady ? `${promotionDone}/${S.promotions.length}` : 'Indisponível'}</span><h2>Avaliação de promoções</h2><p>${promotionReady ? 'Avalie os candidatos, consulte os pareceres e compare até três membros.' : 'Não há um ciclo de promoções aberto com candidatos cadastrados.'}</p></button><button class="nca-entry" data-open="proposals" ${proposalReady ? '' : 'disabled'}><span class="nca-entry-icon"><i class="fa-solid fa-file-signature"></i></span><span class="nca-entry-meta">${proposalReady ? `${proposalDone}/${S.proposals.length}` : 'Indisponível'}</span><h2>Avaliação de propostas</h2><p>${proposalReady ? 'Leia as propostas ativas e registre o parecer obrigatório.' : 'Não há propostas disponíveis para avaliação.'}</p></button></section>`);
    root.querySelectorAll('[data-open]').forEach(button => button.onclick = () => { S.screen = button.dataset.open; render(); });
  }

  function memberProfile(item) {
    return S.users.find(user => norm(nickOf(user)) === norm(item.nick)) || {};
  }

  function activeLicense(nick) {
    return S.licenses.find(item => norm(item.nickname ?? item.nick ?? item.name) === norm(nick) && (!item.status_licenca || plain(item.status_licenca) === 'ativa'));
  }

  async function loadPerformance(item) {
    const id = key(item.nick).replace(/[/\\#[\].]/g, '_');
    if (S.performance.has(id)) return S.performance.get(id);
    try {
      const snapshot = await S.db.collection('desempenho_membros').doc(id).get();
      const data = snapshot.exists ? snapshot.data() : {};
      S.performance.set(id, data);
      return data;
    } catch (error) {
      console.warn('Desempenho indisponível:', error);
      S.performance.set(id, {});
      return {};
    }
  }

  function promotionItems() {
    return S.promotionFilter === 'todos' ? S.promotions : S.promotions.filter(item => item.cargo === S.promotionFilter);
  }

  function promotionIndex(items, active) {
    const filters = [['todos', 'Todos'], ['professor', 'Professores'], ['coordenador', 'Coordenadores'], ['graduador', 'Graduadores']];
    return `<aside class="nca-index"><div class="nca-index-head"><h2>Candidatos</h2><p>${items.length} membro${items.length === 1 ? '' : 's'} nesta visualização</p><div class="nca-filters">${filters.map(([value, label]) => `<button class="nca-filter ${S.promotionFilter === value ? 'is-active' : ''}" data-filter="${value}">${label}</button>`).join('')}</div></div><div class="nca-index-list">${items.map((item, index) => { const vote = ownPromotionVote(item); return `<button class="nca-index-item ${index === active ? 'is-active' : ''}" data-index="${index}"><img src="${avatar(item.nick)}" alt=""><span><strong>${esc(item.nick)}</strong><small>${cargoLabel(item.cargo)}</small></span><i class="nca-dot ${sent(vote) ? 'is-done' : vote?.rascunho ? 'is-draft' : ''}"></i></button>`; }).join('')}</div></aside>`;
  }

  function promotionEditor(item, performance = {}) {
    const profile = memberProfile(item);
    const vote = ownPromotionVote(item) || {};
    const draft = vote.rascunho || {};
    const verdict = clean(draft.veredito || vote.veredito);
    const comment = clean(draft.dissertacao || vote.dissertacao);
    const votes = promotionVotesFor(item);
    const promote = votes.filter(v => plain(v.veredito).includes('promov')).length;
    const keep = votes.filter(v => plain(v.veredito).includes('mant')).length;
    const license = activeLicense(item.nick);
    const selected = S.compare.some(candidate => norm(candidate.nick) === norm(item.nick) && candidate.cargo === item.cargo);
    const lastPromotion = profile.dataPromocao || profile.ultimaPromocao || profile.data_ultima_promocao;
    const entryDate = firstValue(profile.dataEntrada, profile.data_entrada, profile.entrada);
    const approvedProposals = firstValue(profile.propostas, profile.propostasAprovadas, profile.propostasAprovadasSubgrupos, 0);
    const isGraduator = item.cargo === 'graduador' || normalizeCargo(profile.cargo) === 'graduador';
    const bestResult = isGraduator
      ? firstValue(performance.melhorSemanaAulas, performance.maiorQuantidadeGraduacoes, performance.maiorQuantidadeGraduacao, performance.maiorQuantidade, performance.aulasAplicadas)
      : firstValue(performance.maiorPorcentagem, performance.maiorPercentual, profile.maiorPorcentagem, profile.maiorPercentual);
    const bestResultLabel = isGraduator ? numberLabel(bestResult) : percentLabel(bestResult);
    const bestResultTitle = isGraduator ? 'Maior nº de graduações' : 'Maior porcentagem';
    const bestWeekTitle = isGraduator ? 'Melhor semana' : 'Semana da maior %';
    const goal = performance.porcentagemTotal ?? performance.meta ?? profile.meta ?? 'Não disponível';
    const lessons = performance.aulasAplicadas ?? performance.atividades ?? profile.aulasAplicadas ?? 'Não disponível';
    return `<section class="nca-editor"><div class="nca-editor-scroll"><header class="nca-editor-head"><div class="nca-member-heading"><img src="${avatar(item.nick, false)}" alt=""><div><p class="nca-kicker">Candidato a promoção</p><h2>${esc(item.nick)}</h2><p>${cargoLabel(item.cargo)} · ${item.vagas} vaga${item.vagas === 1 ? '' : 's'} no próximo cargo</p></div></div><span class="nca-status-pill ${sent(vote) ? 'is-sent' : ''}">${sent(vote) ? 'Parecer enviado' : draft.veredito || draft.dissertacao ? 'Rascunho' : 'Pendente'}</span></header><section class="nca-section"><div class="nca-section-title"><h3>Ficha do membro</h3><button id="nca-compare-toggle" class="nca-button nca-button--ghost"><i class="fa-solid fa-scale-balanced"></i>${selected ? 'Remover da comparação' : 'Adicionar ao comparador'}</button></div><div class="nca-info-grid"><div class="nca-info"><span>Cargo atual</span><strong>${esc(profile.cargo || cargoLabel(item.cargo))}</strong></div><div class="nca-info"><span>Data de entrada</span><strong>${dateLabel(entryDate)}</strong></div><div class="nca-info"><span>Última promoção</span><strong>${dateLabel(lastPromotion)}</strong></div><div class="nca-info"><span>Tempo no cargo</span><strong>${daysSince(lastPromotion)}</strong></div><div class="nca-info"><span>Propostas aprovadas</span><strong>${numberLabel(approvedProposals)}</strong></div><div class="nca-info"><span>Licença</span><strong>${license ? esc(license.motivo || license.tipo || 'Ativa') : 'Sem licença ativa'}</strong></div><div class="nca-info"><span>Meta recente</span><strong>${esc(goal)}${typeof goal === 'number' ? '%' : ''}</strong></div><div class="nca-info"><span>Atividades</span><strong>${esc(lessons)}</strong></div><div class="nca-info"><span>${bestResultTitle}</span><strong>${esc(bestResultLabel)}</strong></div><div class="nca-info"><span>${bestWeekTitle}</span><strong>${esc(bestWeekLabel(performance))}</strong></div><div class="nca-info"><span>Vagas</span><strong>${item.vagas}</strong></div></div></section><section class="nca-section"><div class="nca-section-title"><h3>Votos do Conselho</h3><button id="nca-open-comments" class="nca-button nca-button--ghost"><i class="fa-solid fa-comments"></i>Ver ${votes.length} parecer${votes.length === 1 ? '' : 'es'}</button></div><div class="nca-votes"><div class="nca-vote-total"><strong>${promote}</strong><span>Votaram para promover</span></div><div class="nca-vote-total"><strong>${keep}</strong><span>Votaram para manter</span></div></div></section><form id="nca-evaluation-form"><section class="nca-section"><div class="nca-section-title"><h3>Seu veredito</h3></div><div class="nca-verdicts">${[['Promovido', 'Promover', 'fa-arrow-up'], ['Mantém', 'Manter', 'fa-minus']].map(([value, label, icon]) => `<label class="nca-choice"><input type="radio" name="veredito" value="${value}" ${verdict === value ? 'checked' : ''}><span><i class="fa-solid ${icon}"></i>${label}</span></label>`).join('')}</div></section><section class="nca-section"><label class="nca-field-label" for="nca-comment">Justificativa obrigatória <small><span id="nca-count">${comment.length}</span>/5000</small></label><textarea id="nca-comment" class="nca-textarea" maxlength="5000" placeholder="Explique os fatos que fundamentam seu parecer.">${esc(comment)}</textarea></section><footer class="nca-editor-actions"><span id="nca-save-label" class="nca-save-state"><i class="fa-solid fa-cloud"></i>${draft.veredito || draft.dissertacao ? 'Rascunho recuperado. Envie para contabilizar.' : 'O preenchimento será salvo automaticamente.'}</span><button class="nca-button nca-button--gold" type="submit" ${cycleOpen() ? '' : 'disabled'}><i class="fa-solid fa-paper-plane"></i>${sent(vote) ? 'Atualizar avaliação' : 'Enviar avaliação'}</button></footer></form></div></section>`;
  }

  function bindPromotion(items, item) {
    root.querySelectorAll('[data-index]').forEach(button => button.onclick = () => { S.selectedPromotion = Number(button.dataset.index); render(); });
    root.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => { S.promotionFilter = button.dataset.filter; S.selectedPromotion = 0; render(); });
    document.getElementById('nca-compare-toggle').onclick = () => toggleCompare(item);
    document.getElementById('nca-open-comments').onclick = () => showPromotionComments(item);
    const form = document.getElementById('nca-evaluation-form');
    form.addEventListener('input', () => {
      document.getElementById('nca-count').textContent = document.getElementById('nca-comment').value.length;
      scheduleDraft('promotion', item);
    });
    form.onsubmit = event => submitPromotion(event, item);
  }

  async function renderPromotions() {
    const items = promotionItems();
    if (!items.length) { shell('<div class="nca-empty"><p>Nenhum candidato nesta categoria.</p></div>', 'Avaliação de <em>promoções.</em>', 'Consulte os dados, compare candidatos e registre seu parecer.'); return; }
    S.selectedPromotion = Math.min(S.selectedPromotion, items.length - 1);
    const item = items[S.selectedPromotion];
    const performance = await loadPerformance(item);
    shell(`<div class="nca-compare-bar"><div class="nca-compare-list">${S.compare.map(candidate => `<span class="nca-compare-chip">${esc(candidate.nick)}<button data-remove-compare="${esc(candidate.nick)}" data-cargo="${candidate.cargo}"><i class="fa-solid fa-xmark"></i></button></span>`).join('') || '<span class="nca-save-state">Selecione até três membros para comparar.</span>'}</div><button id="nca-show-compare" class="nca-button nca-button--primary" ${S.compare.length < 2 ? 'disabled' : ''}><i class="fa-solid fa-scale-balanced"></i>Comparar ${S.compare.length || ''}</button></div><div class="nca-workspace">${promotionIndex(items, S.selectedPromotion)}${promotionEditor(item, performance)}</div>`, 'Avaliação de <em>promoções.</em>', 'Pareceres visíveis ao Conselho e comparação livre de até três membros.');
    bindPromotion(items, item);
    document.getElementById('nca-show-compare').onclick = () => { S.screen = 'compare'; render(); };
    root.querySelectorAll('[data-remove-compare]').forEach(button => button.onclick = () => { S.compare = S.compare.filter(candidate => !(norm(candidate.nick) === norm(button.dataset.removeCompare) && candidate.cargo === button.dataset.cargo)); render(); });
  }

  function toggleCompare(item) {
    const index = S.compare.findIndex(candidate => norm(candidate.nick) === norm(item.nick) && candidate.cargo === item.cargo);
    if (index >= 0) S.compare.splice(index, 1);
    else if (S.compare.length >= 3) return toast('O comparador aceita no máximo três membros.', true);
    else S.compare.push(item);
    render();
  }

  function showPromotionComments(item) {
    const votes = promotionVotesFor(item);
    showModal(`Pareceres de ${item.nick}`, votes.length ? votes.map(v => `<article class="nca-comment"><header><strong>${esc(v.avaliador || 'Conselho')}</strong><span>${plain(v.veredito).includes('promov') ? 'Promover' : 'Manter'}</span></header><p>${esc(v.dissertacao || 'Sem comentário.')}</p></article>`).join('') : '<div class="nca-locked">Ainda não há pareceres enviados para este membro.</div>');
  }

  async function renderCompare() {
    const cards = await Promise.all(S.compare.map(async item => {
      const profile = memberProfile(item); const performance = await loadPerformance(item); const license = activeLicense(item.nick); const votes = promotionVotesFor(item);
      return `<article class="nca-compare-card"><header><img src="${avatar(item.nick)}" alt=""><div><h3>${esc(item.nick)}</h3><small>${esc(profile.cargo || cargoLabel(item.cargo))}</small></div></header><dl><div><dt>Tempo no cargo</dt><dd>${daysSince(profile.dataPromocao || profile.ultimaPromocao)}</dd></div><div><dt>Meta recente</dt><dd>${esc(performance.porcentagemTotal ?? performance.meta ?? '—')}</dd></div><div><dt>Atividades</dt><dd>${esc(performance.aulasAplicadas ?? '—')}</dd></div><div><dt>Licença</dt><dd>${license ? 'Ativa' : 'Não'}</dd></div><div><dt>Promover</dt><dd>${votes.filter(v => plain(v.veredito).includes('promov')).length}</dd></div><div><dt>Manter</dt><dd>${votes.filter(v => plain(v.veredito).includes('mant')).length}</dd></div></dl><button class="nca-button nca-button--ghost" data-comments="${esc(item.nick)}" data-cargo="${item.cargo}"><i class="fa-solid fa-comments"></i>Ver pareceres</button></article>`;
    }));
    shell(`<div class="nca-compare-bar"><button id="nca-back-promotions" class="nca-button"><i class="fa-solid fa-arrow-left"></i>Voltar às promoções</button><span class="nca-save-state">${S.compare.length} de 3 membros selecionados</span></div><section class="nca-compare-grid">${cards.join('')}</section>`, 'Comparador de <em>membros.</em>', 'Compare desempenho, situação e votação dos candidatos selecionados.');
    document.getElementById('nca-back-promotions').onclick = () => { S.screen = 'promotions'; render(); };
    root.querySelectorAll('[data-comments]').forEach(button => button.onclick = () => showPromotionComments(S.compare.find(item => norm(item.nick) === norm(button.dataset.comments) && item.cargo === button.dataset.cargo)));
  }

  function proposalIndex(items, active) {
    return `<aside class="nca-index"><div class="nca-index-head"><h2>Propostas</h2><p>${items.length} pauta${items.length === 1 ? '' : 's'} disponíveis</p></div><div class="nca-index-list">${items.map((item, index) => { const vote = ownProposalVote(item); return `<button class="nca-index-item ${index === active ? 'is-active' : ''}" data-index="${index}"><span class="nca-brand-mark" style="width:36px;height:36px;border-radius:10px;font-size:14px">${item.ordem}</span><span><strong>${esc(item.titulo)}</strong><small>${esc(item.autor)}</small></span><i class="nca-dot ${sent(vote) ? 'is-done' : vote?.rascunho ? 'is-draft' : ''}"></i></button>`; }).join('')}</div></aside>`;
  }

  function proposalEditor(item) {
    const vote = ownProposalVote(item) || {};
    const draft = vote.rascunho || {};
    const verdict = clean(draft.veredito || vote.Veredito || vote.veredito);
    const comment = clean(draft.comentario || vote.Comentario || vote.comentario);
    const otherVotes = proposalVotesFor(item);
    const canSee = sent(vote);
    return `<section class="nca-editor"><div class="nca-editor-scroll"><header class="nca-editor-head"><div><p class="nca-kicker">Proposta nº ${item.ordem}</p><h2>${esc(item.titulo)}</h2><p>${esc(item.autor)} · ${esc(item.tipo)} · ${dateLabel(item.data)}</p></div><span class="nca-status-pill ${sent(vote) ? 'is-sent' : ''}">${sent(vote) ? 'Parecer enviado' : draft.veredito || draft.comentario ? 'Rascunho' : 'Pendente'}</span></header><section class="nca-section"><div class="nca-section-title"><h3>Conteúdo da proposta</h3></div><div class="nca-proposal-body">${esc(item.conteudo)}</div></section><form id="nca-evaluation-form"><section class="nca-section"><div class="nca-section-title"><h3>Seu veredito</h3></div><div class="nca-verdicts">${PROPOSAL_VERDICTS.map(([value, icon]) => `<label class="nca-choice"><input type="radio" name="veredito" value="${value}" ${verdict === value ? 'checked' : ''}><span><i class="fa-solid ${icon}"></i>${value}</span></label>`).join('')}</div></section><section class="nca-section"><label class="nca-field-label" for="nca-comment">Justificativa obrigatória <small><span id="nca-count">${comment.length}</span>/5000</small></label><textarea id="nca-comment" class="nca-textarea" maxlength="5000" placeholder="Explique os fundamentos do seu parecer e os ajustes necessários.">${esc(comment)}</textarea></section><section class="nca-section"><div class="nca-section-title"><h3>Pareceres do Conselho</h3></div>${canSee ? `<div class="nca-comments">${otherVotes.map(v => `<article class="nca-comment"><header><strong>${esc(v.Nick ?? v.nick ?? 'Conselho')}</strong><span>${esc(v.Veredito ?? v.veredito)}</span></header><p>${esc(v.Comentario ?? v.comentario ?? 'Sem comentário.')}</p></article>`).join('') || '<div class="nca-locked">Nenhum outro parecer foi enviado.</div>'}</div>` : '<div class="nca-locked"><i class="fa-solid fa-lock"></i><br>Envie seu próprio parecer para consultar os votos dos demais.</div>'}</section><footer class="nca-editor-actions"><span id="nca-save-label" class="nca-save-state"><i class="fa-solid fa-cloud"></i>${draft.veredito || draft.comentario ? 'Rascunho recuperado. Envie para contabilizar.' : 'O preenchimento será salvo automaticamente.'}</span><button class="nca-button nca-button--gold" type="submit"><i class="fa-solid fa-paper-plane"></i>${sent(vote) ? 'Atualizar avaliação' : 'Enviar avaliação'}</button></footer></form></div></section>`;
  }

  function renderProposals() {
    if (!S.proposals.length) { renderHome(); return; }
    S.selectedProposal = Math.min(S.selectedProposal, S.proposals.length - 1);
    const item = S.proposals[S.selectedProposal];
    shell(`<div class="nca-workspace">${proposalIndex(S.proposals, S.selectedProposal)}${proposalEditor(item)}</div>`, 'Avaliação de <em>propostas.</em>', 'Leia a proposta completa e registre um parecer fundamentado.');
    root.querySelectorAll('[data-index]').forEach(button => button.onclick = () => { S.selectedProposal = Number(button.dataset.index); render(); });
    const form = document.getElementById('nca-evaluation-form');
    form.addEventListener('input', () => { document.getElementById('nca-count').textContent = document.getElementById('nca-comment').value.length; scheduleDraft('proposal', item); });
    form.onsubmit = event => submitProposal(event, item);
  }

  function formDraft() {
    return {
      veredito: document.querySelector('input[name="veredito"]:checked')?.value || '',
      comentario: document.getElementById('nca-comment')?.value.trim() || '',
    };
  }

  function scheduleDraft(kind, item) {
    clearTimeout(S.saveTimer);
    setSaveLabel('Salvando rascunho…', 'fa-spinner fa-spin');
    S.saveTimer = setTimeout(() => saveDraft(kind, item), 700);
  }

  function setSaveLabel(text, icon = 'fa-cloud') {
    const label = document.getElementById('nca-save-label');
    if (label) label.innerHTML = `<i class="fa-solid ${icon}"></i>${esc(text)}`;
  }

  async function saveDraft(kind, item) {
    const draft = formDraft();
    if (!draft.veredito && !draft.comentario) return setSaveLabel('Preencha a avaliação para criar o rascunho.');
    try {
      if (kind === 'promotion') {
        const ref = S.db.collection('avaliacoes_nexus').doc(`${item.cargo}_${item.nick}_${S.nick.replace(/[^a-zA-Z0-9_]/g, '')}`);
        const existing = ownPromotionVote(item);
        await ref.set({ avaliador: S.nick, avaliadorCargo: S.profile.cargo, nick_avaliado: item.nick, cargo: item.cargo, ciclo_id: S.cycle?.id || '', status: sent(existing) ? 'enviado' : 'rascunho', rascunho: { veredito: draft.veredito, dissertacao: draft.comentario, atualizadoEm: new Date().toISOString() }, rascunhoAtualizadoEm: serverTime() }, { merge: true });
        upsert(S.promotionVotes, ref.id, { ...(existing || {}), avaliador: S.nick, avaliadorCargo: S.profile.cargo, nick_avaliado: item.nick, cargo: item.cargo, ciclo_id: S.cycle?.id || '', status: sent(existing) ? 'enviado' : 'rascunho', rascunho: { veredito: draft.veredito, dissertacao: draft.comentario, atualizadoEm: new Date().toISOString() } });
      } else {
        const ref = S.db.collection('nexus_config').doc('Propostas').collection('votos_conselho').doc(`voto_${item.ordem}_${S.nick.replace(/[^a-zA-Z0-9_]/g, '')}`);
        const existing = ownProposalVote(item);
        await ref.set({ Nick: S.nick, Ordem: item.ordem, status: sent(existing) ? 'enviado' : 'rascunho', rascunho: { veredito: draft.veredito, comentario: draft.comentario, atualizadoEm: new Date().toISOString() }, rascunhoAtualizadoEm: serverTime() }, { merge: true });
        upsert(S.proposalVotes, ref.id, { ...(existing || {}), Nick: S.nick, Ordem: item.ordem, status: sent(existing) ? 'enviado' : 'rascunho', rascunho: { veredito: draft.veredito, comentario: draft.comentario, atualizadoEm: new Date().toISOString() } });
      }
      setSaveLabel(`Rascunho salvo às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Ainda não foi enviado.`, 'fa-circle-check');
    } catch (error) {
      console.error(error); setSaveLabel('Falha ao salvar. Seu texto continua nesta tela.', 'fa-triangle-exclamation'); toast(error.message || 'Falha ao salvar rascunho.', true);
    }
  }

  function upsert(list, id, data) {
    const index = list.findIndex(item => item.id === id);
    if (index < 0) list.push({ id, ...data });
    else list[index] = { ...list[index], ...data, id };
  }

  async function confirmForumUser() {
    const current = await forumUser();
    if (norm(current) !== norm(S.nick)) throw new Error('A conta conectada no fórum mudou. Recarregue a página.');
  }

  function historyOf(record, fields) {
    const history = Array.isArray(record?.historico) ? record.historico.slice(-19) : [];
    if (sent(record)) history.push({ ...Object.fromEntries(fields.map(field => [field, record[field] ?? ''])), salvoEm: new Date().toISOString() });
    return history;
  }

  async function submitPromotion(event, item) {
    event.preventDefault();
    if (S.busy) return;
    const draft = formDraft();
    if (!draft.veredito || !draft.comentario) return toast('Escolha Promover ou Manter e escreva a justificativa.', true);
    if (!cycleOpen()) return toast('O ciclo de promoções está encerrado.', true);
    S.busy = true;
    try {
      await confirmForumUser();
      const id = `${item.cargo}_${item.nick}_${S.nick.replace(/[^a-zA-Z0-9_]/g, '')}`;
      const ref = S.db.collection('avaliacoes_nexus').doc(id);
      const current = ownPromotionVote(item) || {};
      const payload = { avaliador: S.nick, avaliadorCargo: S.profile.cargo, nick_avaliado: item.nick, cargo: item.cargo, ciclo_id: S.cycle?.id || '', veredito: draft.veredito, dissertacao: draft.comentario, status: 'enviado', timestamp: serverTime(), finalizadoEm: current.finalizadoEm || serverTime(), atualizadoEm: serverTime(), rascunho: firebase.firestore.FieldValue.delete(), historico: historyOf(current, ['veredito', 'dissertacao']) };
      await ref.set(payload, { merge: true });
      upsert(S.promotionVotes, id, { ...payload, finalizadoEm: current.finalizadoEm || new Date().toISOString(), timestamp: new Date().toISOString(), atualizadoEm: new Date().toISOString(), rascunho: null });
      toast('Avaliação enviada e contabilizada.'); render();
    } catch (error) { console.error(error); toast(error.message || 'Não foi possível enviar a avaliação.', true); }
    finally { S.busy = false; }
  }

  async function submitProposal(event, item) {
    event.preventDefault();
    if (S.busy) return;
    const draft = formDraft();
    if (!draft.veredito || !draft.comentario) return toast('Escolha o veredito e escreva a justificativa.', true);
    S.busy = true;
    try {
      await confirmForumUser();
      const id = `voto_${item.ordem}_${S.nick.replace(/[^a-zA-Z0-9_]/g, '')}`;
      const ref = S.db.collection('nexus_config').doc('Propostas').collection('votos_conselho').doc(id);
      const current = ownProposalVote(item) || {};
      const payload = { Nick: S.nick, Ordem: item.ordem, Veredito: draft.veredito, Comentario: draft.comentario, status: 'enviado', Timestamp: serverTime(), finalizadoEm: current.finalizadoEm || serverTime(), atualizadoEm: serverTime(), rascunho: firebase.firestore.FieldValue.delete(), historico: historyOf(current, ['Veredito', 'Comentario']) };
      await ref.set(payload, { merge: true });
      upsert(S.proposalVotes, id, { ...payload, finalizadoEm: current.finalizadoEm || new Date().toISOString(), Timestamp: new Date().toISOString(), atualizadoEm: new Date().toISOString(), rascunho: null });
      toast('Parecer enviado. Os resultados foram liberados.'); render();
    } catch (error) { console.error(error); toast(error.message || 'Não foi possível enviar o parecer.', true); }
    finally { S.busy = false; }
  }

  function showModal(title, content) {
    const modal = document.getElementById('nca-modal');
    modal.hidden = false;
    modal.innerHTML = `<section class="nca-modal-card"><header class="nca-modal-head"><h2>${esc(title)}</h2><button id="nca-close-modal" class="nca-icon-button"><i class="fa-solid fa-xmark"></i></button></header><div class="nca-comments">${content}</div></section>`;
    document.getElementById('nca-close-modal').onclick = () => { modal.hidden = true; };
    modal.onclick = event => { if (event.target === modal) modal.hidden = true; };
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch (_) { /* armazenamento indisponível */ }
    render();
  }

  function render() {
    if (S.screen === 'promotions') return void renderPromotions();
    if (S.screen === 'proposals') return renderProposals();
    if (S.screen === 'compare') return void renderCompare();
    renderHome();
  }

  function loadLocalPreview() {
    S.nick = 'Sr.Gabriel.';
    S.profile = { name: S.nick, cargo: 'Vice-Líder', status: 'Ativo', dataPromocao: '2026-07-14' };
    S.users = [
      S.profile,
      { name: 'Bach', cargo: 'Professor(a)', status: 'Ativo', dataEntrada: '2025-11-02', dataPromocao: '2026-08-20', propostas: 4 },
      { name: 'mirinha345', cargo: 'Coordenador(a)', status: 'Ativo', dataPromocao: '2026-06-18' },
      { name: 'Kha.xin', cargo: 'Graduador(a)', status: 'Ativo', dataEntrada: '2025-08-11', dataPromocao: '2026-05-03', propostas: 2 },
    ];
    S.promotions = [
      { nick: 'Bach', cargo: 'professor', vagas: 2 },
      { nick: 'mirinha345', cargo: 'coordenador', vagas: 1 },
      { nick: 'Kha.xin', cargo: 'graduador', vagas: 1 },
    ];
    S.proposals = [{ ordem: 1521, titulo: 'Atualização do programa de aulas', autor: 'Bach', tipo: 'Melhoria', conteudo: 'Proposta demonstrativa para validar a leitura, o parecer e a responsividade da Central.', data: new Date().toISOString() }];
    S.promotionVotes = [
      { id: 'preview-1', avaliador: 'Conselheiro.Exemplo', nick_avaliado: 'Bach', cargo: 'professor', veredito: 'Promovido', dissertacao: 'Apresentou constância, boa participação e evolução durante o ciclo.', status: 'enviado' },
      { id: 'preview-2', avaliador: 'Estagiario.Exemplo', nick_avaliado: 'Bach', cargo: 'professor', veredito: 'Mantém', dissertacao: 'Ainda precisa consolidar os resultados das metas recentes.', status: 'enviado' },
    ];
    S.proposalVotes = [];
    S.licenses = [];
    S.cycle = { id: 'preview', status: 'open', start: new Date(Date.now() - 86400000).toISOString(), end: new Date(Date.now() + 604800000).toISOString() };
    S.performance.set(key('Bach'), { porcentagemTotal: 92, maiorPorcentagem: 118, aulasAplicadas: 18, melhorSemanaLabel: '21 a 27 set.' });
    S.performance.set(key('Kha.xin'), { aulasAplicadas: 23, melhorSemanaAulas: 7, melhorSemanaLabel: '14 a 20 set.' });
  }

  async function init() {
    stateScreen('fa-circle-notch fa-spin', 'Carregando a Central', 'Confirmando sua conta do fórum e sincronizando o Firebase.');
    try {
      try { document.documentElement.dataset.theme = localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch (_) { document.documentElement.dataset.theme = 'dark'; }
      if (/^(localhost|127\.0\.0\.1)$/i.test(location.hostname)) {
        loadLocalPreview();
        render();
        return;
      }
      S.nick = await forumUser();
      if (!window.firebase) throw new Error('A biblioteca do Firebase não foi carregada.');
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      if (!firebase.auth().currentUser) await firebase.auth().signInAnonymously();
      S.db = firebase.firestore();
      await load();
      render();
    } catch (error) {
      console.error(error);
      stateScreen('fa-lock', 'Acesso indisponível', error.message || 'Não foi possível abrir a Central.', true);
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { norm, plain, normalizeCargo, allowedRole, sent, key, numberLabel, percentLabel, bestWeekLabel };
  } else {
    root = document.getElementById('app') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'app' }));
    init();
  }
})();
