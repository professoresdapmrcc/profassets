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
  const CONSULTA_SHEETS = {
    professor: { sheetId: '1EQ2_6q0lrA4XIQQhaeJNmp9esYItkN6GKlIou9TkEZo', metrics: ['CRO', 'CAC', 'CAP', 'ACL'] },
    coordenador: { sheetId: '1n3mMltgY0AmDCeO1vRDaYuz-jLaZ--4hO5f9UnTdtEw', metrics: ['Carta de auxílio', 'Acompanhamentos', 'Orientações', 'COP', 'CDA'] },
    graduador: { sheetId: '1-jR5kLgKHPJuRsXl3PBnz3sbi4mkDeRiQ9rWmmp8uAk', metrics: ['Grad. I', 'Grad. II'] },
  };
  const CONSULTA_MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
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
  const encodeNickname = nickname => {
    const lower = clean(nickname).toLocaleLowerCase('pt-BR');
    try { return btoa(unescape(encodeURIComponent(lower))); } catch (_) { return btoa(lower); }
  };
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
  const careerDate = (profile, action) => {
    const history = firstValue(profile.historicoCargos, profile.historico_cargos, profile.historico, profile.movimentacoes, []);
    if (Array.isArray(history)) {
      const record = history
        .filter(item => plain(`${item?.tipo || ''} ${item?.acao || ''} ${item?.titulo || ''} ${item?.cargo || ''}`).includes(action))
        .sort((a, b) => String(firstValue(b.data, b.dataEvento, b.dataPromocao, b.timestamp) || '').localeCompare(String(firstValue(a.data, a.dataEvento, a.dataPromocao, a.timestamp) || '')))[0];
      const date = record && firstValue(record.data, record.dataEvento, record.dataPromocao, record.timestamp);
      if (date) return date;
    }
    return action === 'promov' ? firstValue(profile.dataPromocao, profile.ultimaPromocao, profile.data_ultima_promocao) : firstValue(profile.dataRebaixamento, profile.ultimoRebaixamento, profile.data_ultimo_rebaixamento);
  };
  const recentMetaLabel = (performance, profile) => {
    const history = firstValue(performance.historicoMetas, performance.historico_metas, performance.metas, performance.semanas, profile.historicoMetas, []);
    if (Array.isArray(history) && history.length) {
      return history.slice().sort((a, b) => String(firstValue(b.data, b.dataFim, b.fim, b.timestamp) || '').localeCompare(String(firstValue(a.data, a.dataFim, a.fim, a.timestamp) || ''))).slice(0, 2).map(item => {
        const value = firstValue(item.porcentagem, item.percentual, item.porcentagemTotal, item.meta);
        const date = firstValue(item.data, item.dataFim, item.fim, item.timestamp);
        return `${percentLabel(value)}${date ? ` - ${dateLabel(date)}` : ''}`;
      }).join(' | ');
    }
    const value = firstValue(performance.porcentagemTotal, performance.meta, profile.meta);
    const date = firstValue(performance.metaData, performance.dataMeta, performance.data_meta, performance.semanaMeta, performance.dataSemana, profile.metaData);
    return value === undefined ? 'Não disponível' : `${percentLabel(value)}${date ? ` - ${dateLabel(date)}` : ''}`;
  };
  const performanceWeeks = (performance, profile) => {
    const values = firstValue(performance.historicoMetas, performance.historico_metas, performance.metas, performance.semanas, profile.historicoMetas, []);
    return Array.isArray(values) ? values.slice().sort((a, b) => String(firstValue(b.data, b.dataFim, b.fim, b.timestamp) || '').localeCompare(String(firstValue(a.data, a.dataFim, a.fim, a.timestamp) || ''))) : [];
  };
  const performancePanel = (performance, profile, item) => {
    const weeks = performanceWeeks(performance, profile);
    const careerLessons = firstValue(performance.aulasCargoAtual, performance.aulasAplicadasCargo, performance.aulasAplicadas, profile.aulasAplicadas, 0);
    const rows = weeks.map((week, index) => `<article class="nca-week-card"><header><strong>Semana ${weeks.length - index}</strong><span>${dateLabel(firstValue(week.data, week.dataFim, week.fim, week.timestamp))}</span></header><div><b>${percentLabel(firstValue(week.porcentagem, week.percentual, week.porcentagemTotal, week.meta))}</b><small>Meta cumprida</small></div><div><b>${numberLabel(firstValue(week.aulasAplicadas, week.aulas, week.quantidade, week.graduacoes))}</b><small>${item.cargo === 'graduador' ? 'Graduações' : 'Aulas aplicadas'}</small></div></article>`).join('');
    return `<section id="nca-member-performance" class="nca-performance-panel" hidden><div class="nca-performance-summary"><div class="nca-info"><span>Aulas aplicadas na carreira atual</span><strong>${numberLabel(careerLessons)}</strong></div><div class="nca-info"><span>Semanas registradas</span><strong>${weeks.length}</strong></div><div class="nca-info"><span>Propostas aprovadas</span><strong>${numberLabel(profile.propostas ?? profile.propostasAprovadas ?? profile.propostasAprovadasSubgrupos ?? 0)}</strong></div><div class="nca-info"><span>Licenças registradas</span><strong>${licenseHistory(item.nick).length}</strong></div><div class="nca-info"><span>Maior resultado</span><strong>${esc(item.cargo === 'graduador' ? numberLabel(firstValue(performance.melhorSemanaAulas, performance.maiorQuantidadeGraduacoes, performance.maiorQuantidade)) : percentLabel(firstValue(performance.maiorPorcentagem, performance.maiorPercentual)))}</strong></div></div><h4>Metas por semana</h4><div class="nca-week-grid">${rows || '<div class="nca-locked">Nenhum histórico semanal de metas foi encontrado.</div>'}</div></section>`;
  };
  const parseCsv = csv => {
    const rows = []; let row = []; let value = ''; let quoted = false;
    for (let index = 0; index < csv.length; index += 1) {
      const char = csv[index]; const next = csv[index + 1];
      if (char === '"' && quoted && next === '"') { value += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === ',' && !quoted) { row.push(value.trim()); value = ''; }
      else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && next === '\n') index += 1; row.push(value.trim()); if (row.some(Boolean)) rows.push(row); row = []; value = ''; }
      else value += char;
    }
    if (value || row.length) { row.push(value.trim()); if (row.some(Boolean)) rows.push(row); }
    return rows;
  };
  const consultaWeeks = (csv, config, nick) => {
    const rows = parseCsv(csv); const header = rows[0] || [];
    const starts = header.map((cell, index) => ({ cell, index })).filter(({ cell, index }) => /nick/i.test(cell) && plain(header[index + 1] || '') === plain(config.metrics[0]));
    return starts.flatMap(({ cell, index }) => {
      const label = clean(cell.replace(/nick/gi, '').replace(/\s+/g, ' '), 'Semana');
      const totalIndex = index + 1 + config.metrics.length;
      const row = rows.slice(1).find(values => norm(values[index]) === norm(nick));
      if (!row) return [];
      const metrics = config.metrics.map((metric, metricIndex) => Number(String(row[index + 1 + metricIndex] || '').replace('%', '').replace(',', '.')) || 0);
      const total = String(row[totalIndex] || '0').trim();
      return [{ data: label, porcentagem: total, percentual: total, aulasAplicadas: metrics.reduce((sum, value) => sum + value, 0), metrics, status: row[totalIndex + 1] || '' }];
    });
  };
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

  function footer() {
    return `<footer class="nca-footer"><p><span aria-hidden="true">&lt;/&gt;</span> por <strong>Sr.Gabriel.</strong> Com base no desenvolvido por <strong>Aloscon.</strong></p><p>Todos os direitos reservados à Companhia dos Professores.</p></footer>`;
  }

  function stateScreen(icon, title, message, retry = false) {
    root.innerHTML = `<div class="nca-app"><div class="nca-topline"></div><main class="nca-state"><section class="nca-state-card"><i class="fa-solid ${icon}"></i><h1>${esc(title)}</h1><p>${esc(message)}</p>${retry ? '<button id="nca-retry" class="nca-button nca-button--primary"><i class="fa-solid fa-rotate-right"></i>Tentar novamente</button>' : ''}</section></main>${footer()}</div>`;
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
    const nicknameIds = Array.from(new Set([encodeNickname(S.nick), norm(S.nick), clean(S.nick)]));
    const nicknameSnapshots = await Promise.all(nicknameIds.map(id => safeGet(S.db.collection('nicknames').doc(id).get(), null)));
    const mappedUid = nicknameSnapshots.map(snapshot => snapshot?.exists ? snapshot.data()?.uid : '').find(Boolean);
    const mappedProfile = mappedUid ? S.users.find(user => user.id === mappedUid) : null;
    const matches = S.users.filter(user => norm(nickOf(user)) === norm(S.nick));
    const activeMatches = matches.filter(user => plain(user.status || 'ativo') === 'ativo');
    const eligibleMatches = activeMatches.filter(user => allowedRole(user.cargo));
    S.profile = mappedProfile || eligibleMatches[0] || activeMatches[0] || matches[0];
    if (!S.profile) throw new Error(`O nickname ${S.nick} não foi localizado no cadastro do Nexus.`);
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
    root.innerHTML = `<div class="nca-app"><div class="nca-topline"></div><div class="nca-shell">${header()}<section class="nca-hero"><div><p class="nca-kicker">Conselho da Companhia dos Professores</p><h1>${title}</h1><p class="nca-hero-copy">${esc(description)}</p></div>${progress()}</section>${content}</div>${footer()}<div id="nca-toast" class="nca-toast" aria-live="polite"></div><div id="nca-modal" class="nca-modal" hidden></div></div>`;
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

  function licenseHistory(nick) {
    return S.licenses
      .filter(item => norm(item.nickname ?? item.nick ?? item.name) === norm(nick))
      .sort((a, b) => String(firstValue(b.data_inicio, b.dataInicio, b.data_iso, b.data) || '').localeCompare(String(firstValue(a.data_inicio, a.dataInicio, a.data_iso, a.data) || '')));
  }

  function licenseSummary(nick) {
    const history = licenseHistory(nick);
    if (!history.length) return 'Sem histórico de licença';
    return history.slice(0, 3).map(item => {
      const type = clean(firstValue(item.tipo_licenca, item.tipoLicenca, item.tipo, item.motivo, item.status_licenca), 'Licença');
      const start = firstValue(item.data_inicio, item.dataInicio, item.data_iso, item.data);
      const end = firstValue(item.data_fim, item.dataFim, item.data_termino, item.dataTermino);
      return `${type} · ${dateLabel(start)}${end ? ` até ${dateLabel(end)}` : ''}`;
    }).join(' | ');
  }

  async function loadPerformance(item) {
    const id = key(item.nick).replace(/[/\\#[\].]/g, '_');
    if (S.performance.has(id)) return S.performance.get(id);
    try {
      const snapshot = await S.db.collection('desempenho_membros').doc(id).get();
      const data = snapshot.exists ? snapshot.data() : {};
      const consultaConfig = CONSULTA_SHEETS[item.cargo];
      let weekly = [];
      if (consultaConfig) {
        const month = CONSULTA_MONTHS[new Date().getMonth()];
        const url = `https://docs.google.com/spreadsheets/d/${consultaConfig.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(month)}`;
        try { weekly = consultaWeeks(await (await fetch(url, { cache: 'no-store' })).text(), consultaConfig, item.nick); } catch (error) { console.warn('Consulta semanal indisponível:', error); }
      }
      const merged = weekly.length ? { ...data, semanas: weekly, historicoMetas: weekly } : data;
      S.performance.set(id, merged);
      return merged;
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
    const selected = S.compare.some(candidate => norm(candidate.nick) === norm(item.nick) && candidate.cargo === item.cargo);
    const lastCareerDate = careerDate(profile, 'promov') || careerDate(profile, 'rebaix');
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
    const goalLabel = recentMetaLabel(performance, profile);
    const lessons = performance.aulasAplicadas ?? performance.atividades ?? profile.aulasAplicadas ?? 'Não disponível';
    const timeBase = item.cargo === 'professor' ? entryDate : lastCareerDate;
    return `<section class="nca-editor"><div class="nca-editor-scroll"><header class="nca-editor-head"><div class="nca-member-heading"><img src="${avatar(item.nick, false)}" alt=""><div><p class="nca-kicker">Candidato a promoção</p><h2>${esc(item.nick)}</h2><p>${cargoLabel(item.cargo)} · ${item.vagas} vaga${item.vagas === 1 ? '' : 's'} no próximo cargo</p></div></div><span class="nca-status-pill ${sent(vote) ? 'is-sent' : ''}">${sent(vote) ? 'Parecer enviado' : draft.veredito || draft.dissertacao ? 'Rascunho' : 'Pendente'}</span></header><section class="nca-section"><div class="nca-section-title"><h3>Ficha do membro</h3><button id="nca-compare-toggle" class="nca-button nca-button--ghost"><i class="fa-solid fa-scale-balanced"></i>${selected ? 'Remover da comparação' : 'Adicionar ao comparador'}</button></div><div class="nca-info-grid"><div class="nca-info"><span>Cargo atual</span><strong>${esc(profile.cargo || cargoLabel(item.cargo))}</strong></div><div class="nca-info"><span>Data de entrada</span><strong>${dateLabel(entryDate)}</strong></div><div class="nca-info"><span>Última promoção/rebaixamento</span><strong>${lastCareerDate ? dateLabel(lastCareerDate) : '-'}</strong></div><div class="nca-info"><span>Tempo no cargo</span><strong>${timeBase ? daysSince(timeBase) : '-'}</strong></div><div class="nca-info"><span>Propostas aprovadas</span><strong>${numberLabel(approvedProposals)}</strong></div><div class="nca-info"><span>Licenças</span><strong>${esc(licenseSummary(item.nick))}</strong></div><div class="nca-info"><span>Meta recente</span><strong>${esc(goalLabel)}</strong></div><div class="nca-info"><span>Aulas aplicadas</span><strong>${esc(lessons)}</strong></div><div class="nca-info"><span>${bestResultTitle}</span><strong>${esc(bestResultLabel)}</strong></div><div class="nca-info"><span>${bestWeekTitle}</span><strong>${esc(bestWeekLabel(performance))}</strong></div><div class="nca-info"><span>Vagas</span><strong>${item.vagas}</strong></div></div></section><section class="nca-section"><div class="nca-section-title"><h3>Votos do Conselho</h3><button id="nca-open-comments" class="nca-button nca-button--ghost"><i class="fa-solid fa-comments"></i>Ver ${votes.length} parecer${votes.length === 1 ? '' : 'es'}</button></div><div class="nca-votes"><div class="nca-vote-total"><strong>${promote}</strong><span>Votaram para promover</span></div><div class="nca-vote-total"><strong>${keep}</strong><span>Votaram para manter</span></div></div></section><form id="nca-evaluation-form"><section class="nca-section"><div class="nca-section-title"><h3>Seu veredito</h3></div><div class="nca-verdicts">${[['Promovido', 'Promover', 'fa-arrow-up'], ['Mantém', 'Manter', 'fa-minus']].map(([value, label, icon]) => `<label class="nca-choice"><input type="radio" name="veredito" value="${value}" ${verdict === value ? 'checked' : ''}><span><i class="fa-solid ${icon}"></i>${label}</span></label>`).join('')}</div></section><section class="nca-section"><label class="nca-field-label" for="nca-comment">Justificativa obrigatória <small><span id="nca-count">${comment.length}</span>/5000</small></label><textarea id="nca-comment" class="nca-textarea" maxlength="5000" placeholder="Explique os fatos que fundamentam seu parecer.">${esc(comment)}</textarea></section><footer class="nca-editor-actions"><span id="nca-save-label" class="nca-save-state"><i class="fa-solid fa-cloud"></i>${draft.veredito || draft.dissertacao ? 'Rascunho recuperado. Envie para contabilizar.' : 'O preenchimento será salvo automaticamente.'}</span><button class="nca-button nca-button--gold" type="submit" ${cycleOpen() ? '' : 'disabled'}><i class="fa-solid fa-paper-plane"></i>${sent(vote) ? 'Atualizar avaliação' : 'Enviar avaliação'}</button></footer></form></div></section>`;
  }

  function bindPromotion(items, item, performance) {
    root.querySelectorAll('[data-index]').forEach(button => button.onclick = () => { S.selectedPromotion = Number(button.dataset.index); render(); });
    root.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => { S.promotionFilter = button.dataset.filter; S.selectedPromotion = 0; render(); });
    document.getElementById('nca-compare-toggle').onclick = () => toggleCompare(item);
    document.getElementById('nca-open-comments').onclick = () => showPromotionComments(item);
    const infoSection = root.querySelector('.nca-editor .nca-section');
    const sectionTitle = infoSection?.querySelector('.nca-section-title');
    const infoGrid = infoSection?.querySelector('.nca-info-grid');
    if (sectionTitle && infoGrid) {
      infoGrid.classList.add('nca-ficha-grid');
      const heading = sectionTitle.querySelector('h3');
      const tabs = document.createElement('div');
      tabs.className = 'nca-member-tabs';
      tabs.innerHTML = '<button type="button" class="nca-member-tab is-active" data-member-tab="ficha">Ficha do membro</button><button type="button" class="nca-member-tab" data-member-tab="desempenho">Desempenho</button>';
      heading?.replaceWith(tabs);
      infoSection.insertAdjacentHTML('beforeend', performancePanel(performance, memberProfile(item), item));
      const performanceNode = document.getElementById('nca-member-performance');
      tabs.querySelectorAll('[data-member-tab]').forEach(button => button.onclick = () => {
        const showPerformance = button.dataset.memberTab === 'desempenho';
        infoGrid.hidden = showPerformance;
        performanceNode.hidden = !showPerformance;
        tabs.querySelectorAll('.nca-member-tab').forEach(tab => tab.classList.toggle('is-active', tab === button));
      });
    }
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
    bindPromotion(items, item, performance);
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
      const profile = memberProfile(item); const performance = await loadPerformance(item); const hasLicense = licenseHistory(item.nick).length > 0; const votes = promotionVotesFor(item);
      return `<article class="nca-compare-card"><header><img src="${avatar(item.nick)}" alt=""><div><h3>${esc(item.nick)}</h3><small>${esc(profile.cargo || cargoLabel(item.cargo))}</small></div></header><dl><div><dt>Tempo no cargo</dt><dd>${daysSince(profile.dataPromocao || profile.ultimaPromocao)}</dd></div><div><dt>Meta recente</dt><dd>${esc(performance.porcentagemTotal ?? performance.meta ?? '—')}</dd></div><div><dt>Aulas aplicadas</dt><dd>${esc(performance.aulasAplicadas ?? '—')}</dd></div><div><dt>Licença</dt><dd>${hasLicense ? 'Histórico' : 'Não'}</dd></div><div><dt>Promover</dt><dd>${votes.filter(v => plain(v.veredito).includes('promov')).length}</dd></div><div><dt>Manter</dt><dd>${votes.filter(v => plain(v.veredito).includes('mant')).length}</dd></div></dl><button class="nca-button nca-button--ghost" data-comments="${esc(item.nick)}" data-cargo="${item.cargo}"><i class="fa-solid fa-comments"></i>Ver pareceres</button></article>`;
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

  async function init() {
    stateScreen('fa-circle-notch fa-spin', 'Carregando a Central', 'Confirmando sua conta do fórum e sincronizando o Firebase.');
    try {
      try { document.documentElement.dataset.theme = localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch (_) { document.documentElement.dataset.theme = 'dark'; }
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
