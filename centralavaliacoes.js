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
  const WEEK_MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  function weekDates(week) {
    const text = String(firstValue(week.data, week.dataFim, week.fim, week.timestamp) || '');
    const matches = [...text.toUpperCase().matchAll(/(\d{1,2})\s+(?:DE\s+)?(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\.?\s+(?:DE\s+)?(\d{4})/g)];
    const parsed = matches.map(match => new Date(Date.UTC(Number(match[3]), WEEK_MONTHS.indexOf(match[2]), Number(match[1]), 12)));
    return { start: docTime(week.dataInicio || week.inicio) || parsed[0], end: docTime(week.dataFim || week.fim) || parsed[1] || parsed[0] || docTime(text) };
  }
  function weekPeriod(week) {
    const { start, end } = weekDates(week);
    const label = date => date.getUTCDate() + ' ' + WEEK_MONTHS[date.getUTCMonth()].slice(0, 1) + WEEK_MONTHS[date.getUTCMonth()].slice(1).toLowerCase();
    if (start && end) return label(start) + ' a ' + label(end) + (start.getUTCFullYear() !== end.getUTCFullYear() ? ' (' + start.getUTCFullYear() + '/' + end.getUTCFullYear() + ')' : '');
    return end ? label(end) : 'Período não informado';
  }
  const sortWeeks = (a, b) => (weekDates(b).end?.getTime() || 0) - (weekDates(a).end?.getTime() || 0);
  function latestEntryDate(profile) {
    const history = [profile.historicoCargos, profile.historico_cargos, profile.historico, profile.movimentacoes].filter(Array.isArray).flat();
    const dates = [profile.dataEntrada, profile.data_entrada, profile.entrada, profile.ultimaEntrada, profile.dataUltimaEntrada, profile.dataReentrada, profile.dataReadmissao];
    history.forEach(record => {
      if (/\b(entrada|reentrada|admissao|readmissao)\b/.test(plain(`${record.tipo || ''} ${record.acao || ''} ${record.titulo || ''}`))) {
        dates.push(firstValue(record.data, record.dataEvento, record.timestamp));
      }
    });
    return dates.map(docTime).filter(date => date && Number.isFinite(date.getTime())).sort((a, b) => b - a)[0] || null;
  }
  const dayKey = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  function performanceMonthNames(entry, now = new Date()) {
    const start = new Date(`${dayKey(entry).slice(0, 7)}-01T12:00:00Z`);
    start.setUTCMonth(start.getUTCMonth() - 1); // A semana da entrada pode começar na aba anterior.
    const end = new Date(`${dayKey(now).slice(0, 7)}-01T12:00:00Z`);
    const months = new Set();
    for (let cursor = start; cursor <= end && months.size < 12; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) months.add(CONSULTA_MONTHS[cursor.getUTCMonth()]);
    return [...months];
  }
  function filterCareerWeeks(weeks, entry, now = new Date()) {
    if (!entry) return [];
    const filtered = weeks.filter(week => {
      const { start, end } = weekDates(week);
      return start && end && dayKey(end) >= dayKey(entry) && dayKey(start) <= dayKey(now);
    });
    return [...new Map(filtered.map(week => [dayKey(weekDates(week).start) + ':' + dayKey(weekDates(week).end), week])).values()].sort(sortWeeks);
  }
  function sheetNumber(value) {
    if (value === undefined || value === null || !String(value).trim()) return null;
    let text = String(value).replace(/[%\s]/g, '');
    if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
    const result = Number(text);
    return Number.isFinite(result) ? result : null;
  }
  function summarizeWeeks(weeks, cargo) {
    const goals = weeks.filter(week => week.metaValue !== null && week.metaValue !== undefined);
    const bestGoal = goals.reduce((best, week) => !best || week.metaValue > best.metaValue ? week : best, null);
    const bestLessons = weeks.reduce((best, week) => week.aulasAplicadas === null ? best : !best || week.aulasAplicadas > best.aulasAplicadas ? week : best, null);
    const completeLessons = weeks.length > 0 && weeks.every(week => week.aulasAplicadas !== null);
    const best = cargo === 'graduador' ? bestLessons : bestGoal;
    return {
      aulasCargoAtual: completeLessons ? weeks.reduce((sum, week) => sum + week.aulasAplicadas, 0) : undefined,
      aulasAplicadas: completeLessons ? weeks.reduce((sum, week) => sum + week.aulasAplicadas, 0) : undefined,
      maiorPorcentagem: bestGoal?.metaValue,
      melhorSemanaAulas: bestLessons?.aulasAplicadas,
      melhorSemanaLabel: best ? `${weekPeriod(best)} · ${weekDates(best).end.getUTCFullYear()}` : 'Sem registro',
    };
  }
  const recentMetaLabel = (performance, profile) => {
    if (performance.manualReview) return 'Veja manualmente';
    if (performance.sourceKind === 'consulta' && !performanceWeeks(performance, profile).length) return 'Sem registro';
    const rawHistory = firstValue(performance.historicoMetas, performance.historico_metas, performance.metas, performance.semanas, profile.historicoMetas, []);
    const history = performance.sourceKind === 'consulta' ? rawHistory.filter(week => week.metaValue !== null && week.metaValue !== undefined) : rawHistory;
    if (Array.isArray(history) && history.length) {
      return history.slice().sort(sortWeeks).slice(0, 2).map(item => {
        const value = firstValue(item.porcentagem, item.percentual, item.porcentagemTotal, item.meta);
        return `${performance.cargo === 'graduador' ? numberLabel(sheetNumber(value)) + ' graduações' : percentLabel(value)} - ${weekPeriod(item)}`;
      }).join(' | ');
    }
    if (performance.sourceKind === 'consulta') return 'Sem registro';
    const value = firstValue(performance.porcentagemTotal, performance.meta, profile.meta);
    const date = firstValue(performance.metaData, performance.dataMeta, performance.data_meta, performance.semanaMeta, performance.dataSemana, profile.metaData);
    return value === undefined ? 'Não disponível' : `${percentLabel(value)}${date ? ` - ${dateLabel(date)}` : ''}`;
  };
  const performanceWeeks = (performance, profile) => {
    if (performance.sourceKind === 'consulta') return performance.semanas || [];
    const values = firstValue(performance.historicoMetas, performance.historico_metas, performance.metas, performance.semanas, profile.historicoMetas, []);
    return Array.isArray(values) ? values.slice().sort(sortWeeks) : [];
  };
  const performancePanel = (performance, profile, item) => {
    const manualLink = '<a class="nca-button nca-button--ghost" href="' + esc(performance.sourceUrl || 'https://nexusprof.netlify.app/consulta') + '" target="_blank" rel="noopener noreferrer">Abrir planilha original <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>';
    if (performance.manualReview) return '<section id="nca-member-performance" class="nca-performance-panel" hidden><div class="nca-locked"><strong>Veja manualmente</strong><p>Data da última entrada não cadastrada ou cargo não identificado. Confira o desempenho na planilha original.</p>' + manualLink + '</div></section>';
    const cargo = performance.cargo || item.cargo;
    const weeks = performanceWeeks(performance, profile);
    const valueLabel = value => value === undefined || value === null ? '—' : numberLabel(value);
    const goalLabel = week => week.metaValue == null ? 'Sem registro' : cargo === 'graduador' ? numberLabel(week.metaValue) : percentLabel(week.porcentagem);
    const metrics = CONSULTA_SHEETS[cargo]?.metrics || [];
    const rows = weeks.map(week => '<tr><th scope="row"><strong>' + esc(weekPeriod(week)) + '</strong><small>' + weekDates(week).end.getUTCFullYear() + '</small></th><td class="nca-meta-value">' + esc(goalLabel(week)) + '</td>' + metrics.map((_, index) => '<td>' + valueLabel(week.metrics?.[index]) + '</td>').join('') + '<td><span class="nca-performance-status">' + esc(week.status || 'Sem classificação') + '</span>' + (week.motivo ? '<small>' + esc(week.motivo) + '</small>' : '') + '</td></tr>').join('');
    const recent = weeks.filter(week => week.metaValue != null).slice(0, 2).map(week => '<div class="nca-recent-goal"><span>' + esc(weekPeriod(week)) + '</span><strong>' + esc(goalLabel(week)) + '</strong></div>').join('');
    return '<section id="nca-member-performance" class="nca-performance-panel" hidden><div class="nca-performance-intro"><div><h4>Desempenho de ' + esc(cargoLabel(cargo)) + '</h4><p>Desde ' + dateLabel(performance.entryDate) + ', incluindo o período da entrada.</p></div>' + manualLink + '</div><div class="nca-performance-summary"><div class="nca-info"><span>' + (cargo === 'graduador' ? 'Graduações' : 'Aulas aplicadas') + '</span><strong>' + valueLabel(performance.aulasCargoAtual) + '</strong><small>Nos períodos encontrados</small></div><div class="nca-info"><span>Maior resultado</span><strong>' + (cargo === 'graduador' ? valueLabel(performance.melhorSemanaAulas) : performance.maiorPorcentagem === undefined ? '—' : percentLabel(performance.maiorPorcentagem)) + '</strong><small>' + esc(performance.melhorSemanaLabel || 'Sem registro') + '</small></div><div class="nca-info"><span>Períodos registrados</span><strong>' + weeks.length + '</strong><small>Após a última entrada</small></div></div><section class="nca-performance-block"><h4>' + (cargo === 'graduador' ? 'Últimos dois resultados' : 'Últimas duas metas') + '</h4><div class="nca-recent-goals">' + (recent || '<p>Sem resultados disponíveis.</p>') + '</div></section><section class="nca-performance-block"><div class="nca-section-title"><h4>Histórico por período</h4><span class="nca-save-state">' + weeks.length + ' períodos</span></div>' + (performance.failedMonths?.length ? '<p class="nca-performance-warning" role="status">Dados indisponíveis em ' + esc(performance.failedMonths.join(', ')) + '. A aba não foi acessada ou retornou datas de outro mês. Confira a planilha original.</p>' : '') + (rows ? '<div class="nca-performance-table-wrap" tabindex="0" role="region" aria-label="Metas e atividades por período"><table class="nca-performance-table"><caption>Metas e atividades desde a última entrada</caption><thead><tr><th scope="col">Período</th><th scope="col">' + (cargo === 'graduador' ? 'Total' : 'Meta') + '</th>' + metrics.map(label => '<th scope="col">' + esc(label) + '</th>').join('') + '<th scope="col">Classificação</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="nca-locked">Nenhum desempenho encontrado neste período. Veja manualmente na planilha original.</div>') + '</section><section class="nca-performance-block"><div class="nca-section-title"><h4>Licenças após a entrada</h4><span class="nca-save-state">' + licenseHistory(item.nick).length + ' registros</span></div><p>' + esc(licenseSummary(item.nick)) + '</p><p class="nca-save-state">Propostas aprovadas: ' + numberLabel(profile.propostas ?? profile.propostasAprovadas ?? profile.propostasAprovadasSubgrupos ?? 0) + '</p></section><details class="nca-performance-source"><summary>Fonte e atualização dos dados</summary><p>' + esc(performance.sourceLabel) + ' · Consulta em ' + esc(new Date(performance.consultedAt).toLocaleString('pt-BR')) + '.</p><p>Totais dos períodos disponíveis. Históricos arquivados em outras planilhas precisam de consulta manual. — indica ausência de registro.</p></details></section>';
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
      const metrics = config.metrics.map((metric, metricIndex) => sheetNumber(row[index + 1 + metricIndex]));
      const total = String(row[totalIndex] ?? '').trim();
      if (!weekDates({ data: label }).end) return [];
      if (!total && metrics.every(value => value === null) && !row[totalIndex + 1] && !row[totalIndex + 2]) return [];
      const lessonIndexes = config.metrics.length === 5 ? [3, 4] : config.metrics.map((_, index) => index);
      const aulasAplicadas = lessonIndexes.every(index => metrics[index] !== null) ? lessonIndexes.reduce((sum, index) => sum + metrics[index], 0) : null;
      return [{ data: label, porcentagem: total || undefined, percentual: total || undefined, metaValue: sheetNumber(total), aulasAplicadas, metrics, status: row[totalIndex + 1] || 'Sem classificação', motivo: row[totalIndex + 2] || '' }];
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


  const localDraftKey = () => 'NCA_DRAFTS:' + norm(S.nick) + ':' + (S.cycle?.id || 'current');
  const draftId = (kind, item) => kind + ':' + (kind === 'promotion' ? item.cargo + ':' + item.nick : item.ordem);
  function effectiveVote(kind, item) {
    const vote = (kind === 'promotion' ? ownPromotionVote(item) : ownProposalVote(item)) || {};
    const local = readLocalDrafts()[draftId(kind, item)];
    return local ? { ...vote, rascunho: local.draft } : vote;
  }
  function responseLabel(vote) {
    if (vote?.rascunho) return answered(vote) ? 'Respondida — aguardando envio' : 'Resposta incompleta';
    return sent(vote) ? 'Avaliação enviada' : answered(vote) ? 'Respondida — aguardando envio' : 'Pendente';
  }
  function updateResponseState(kind, item) {
    const vote = effectiveVote(kind, item);
    const pill = root.querySelector('.nca-editor-head .nca-status-pill');
    if (pill) { pill.textContent = responseLabel(vote); pill.classList.toggle('is-sent', answered(vote)); pill.setAttribute('role', 'status'); }
    const active = root.querySelector('.nca-index-item.is-active');
    if (active) {
      const dot = active.querySelector('.nca-dot');
      if (dot) { dot.classList.toggle('is-done', answered(vote)); dot.classList.toggle('is-draft', !answered(vote)); dot.title = responseLabel(vote); }
      let label = active.querySelector('.nca-response-label');
      if (!label) { label = document.createElement('small'); label.className = 'nca-response-label'; active.querySelector('span').append(label); }
      label.textContent = responseLabel(vote);
    }
  }
  function readLocalDrafts() {
    try { return JSON.parse(localStorage.getItem(localDraftKey()) || '{}'); } catch (_) { return {}; }
  }
  function storeLocalDraft(kind, item, draft) {
    const records = readLocalDrafts();
    const id = kind + ':' + (kind === 'promotion' ? item.cargo + ':' + item.nick : item.ordem);
    records[id] = { kind, item, draft, savedAt: new Date().toISOString() };
    try { localStorage.setItem(localDraftKey(), JSON.stringify(records)); }
    catch (_) { setSaveLabel('Não foi possível guardar uma cópia neste navegador.', 'fa-triangle-exclamation'); }
    return id;
  }
  async function recoverLocalDrafts() {
    if (S.recovering || !S.db || !cycleOpen()) return;
    S.recovering = true;
    try {
      for (const record of Object.values(readLocalDrafts())) {
        const item = record.kind === 'promotion'
          ? S.promotions.find(item => item.nick === record.item.nick && item.cargo === record.item.cargo)
          : S.proposals.find(item => item.ordem === record.item.ordem);
        if (!item) continue;
        const vote = record.kind === 'promotion' ? ownPromotionVote(item) : ownProposalVote(item);
        const remoteDate = docTime(vote?.rascunho?.atualizadoEm || vote?.atualizadoEm);
        if (remoteDate && remoteDate.getTime() > Date.parse(record.savedAt)) { const records = readLocalDrafts(); delete records[record.kind + ':' + (record.kind === 'promotion' ? item.cargo + ':' + item.nick : item.ordem)]; try { localStorage.setItem(localDraftKey(), JSON.stringify(records)); } catch (_) {} continue; }
        await saveDraft(record.kind, item, record.draft);
      }
    } finally { S.recovering = false; }
  }
  function deadlineText() {
    const end = docTime(S.cycle?.end || S.cycle?.fim);
    if (!end) return 'Prazo de promoções não informado.';
    const remaining = end.getTime() - Date.now();
    const hours = Math.max(0, Math.ceil(remaining / 3600000));
    return 'Promoções: ' + end.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ' (Brasília) · ' + (remaining <= 0 ? 'Prazo encerrado' : hours <= 24 ? 'Atenção: faltam ' + hours + ' horas' : 'Faltam ' + Math.ceil(hours / 24) + ' dias');
  }
  function showReceipt(receipt = S.lastReceipt) {
    if (!receipt) return toast('Nenhum comprovante disponível neste navegador.');
    showModal('Comprovante de envio', '<p>Envio confirmado pelo Firebase.</p><p>' + esc(receipt.user) + ' · ' + esc(new Date(receipt.at).toLocaleString('pt-BR')) + '</p><p>Referência: ' + esc(receipt.id) + '</p>' + receipt.items.map(item => '<article class="nca-comment"><strong>' + esc(item.title) + '</strong><p>' + esc(item.verdict) + '</p><p>' + esc(item.comment) + '</p></article>').join('') + '<button id="nca-download-receipt" class="nca-button">Baixar comprovante</button>');
    document.getElementById('nca-download-receipt').onclick = () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'comprovante-' + receipt.id + '.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
  }
  function bindHistory(vote) {
    const form = document.getElementById('nca-evaluation-form');
    if (!form) return;
    const button = document.createElement('button'); button.type = 'button'; button.className = 'nca-button nca-button--ghost'; button.textContent = 'Meu histórico de alterações';
    button.onclick = () => showModal('Meu histórico de alterações', (vote?.historico || []).slice().reverse().map(record => '<article class="nca-comment"><strong>' + esc(record.veredito || record.Veredito || '') + '</strong><p>' + esc(record.dissertacao || record.Comentario || '') + '</p><small>' + esc(docTime(record.salvoEm)?.toLocaleString('pt-BR') || 'Data não registrada') + '</small></article>').join('') || '<p>Nenhuma versão anterior enviada.</p>');
    form.append(button);
  }

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
    S.promotionLists = lists;
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
    return `<header class="nca-header"><div class="nca-brand"><img class="nca-brand-logo" src="https://i.imgur.com/yTV30Lk.png" alt="NEXUS"><div><strong>NEXUS</strong><small>Central de avaliações</small></div></div><div class="nca-actions"><button id="nca-home" class="nca-icon-button" title="Voltar ao início"><i class="fa-solid fa-house"></i></button><button id="nca-theme" class="nca-icon-button" title="Alternar tema"><i class="fa-solid ${document.documentElement.dataset.theme === 'light' ? 'fa-moon' : 'fa-sun'}"></i></button><div class="nca-user"><img src="${avatar(S.nick)}" alt=""><div><strong>${esc(S.nick)}</strong><small>${esc(S.profile?.cargo)}</small></div></div></div></header>`;
  }

  function progress() {
    const ownPromotions = S.promotions.filter(item => sent(ownPromotionVote(item))).length;
    const ownProposals = S.proposals.filter(item => sent(ownProposalVote(item))).length;
    const total = S.promotions.length + S.proposals.length;
    const done = ownPromotions + ownProposals;
    const percentage = total ? Math.round((done / total) * 100) : 0;
    return `<aside class="nca-progress-card"><div class="nca-progress-head"><span>Seu progresso</span><strong>${done} de ${total}</strong></div><div class="nca-progress-track"><span style="width:${percentage}%"></span></div><small>${percentage}% das avaliações disponíveis foram enviadas.</small></aside>`;
  }
  const answered = vote => {
    const value = vote?.rascunho ?? vote ?? {};
    return Boolean(String(value.veredito ?? value.Veredito ?? '').trim() && String(value.dissertacao ?? value.comentario ?? value.Comentario ?? '').trim());
  };
  const completeDrafts = () => [
    ...S.promotions.filter(item => { const vote = ownPromotionVote(item); return vote?.rascunho && answered(vote); }).map(item => ({ kind: 'promotion', item })),
    ...S.proposals.filter(item => { const vote = ownProposalVote(item); return vote?.rascunho && answered(vote); }).map(item => ({ kind: 'proposal', item })),
  ];

  function shell(content, title = 'Central de <em>Avaliações.</em>', description = 'Analise propostas e candidatos sem sair do Forumeiros.') {
    root.innerHTML = `<div class="nca-app"><div class="nca-topline"></div><div class="nca-shell">${header()}<section class="nca-hero"><div><p class="nca-kicker">Conselho da Companhia dos Professores</p><h1>${title}</h1><p class="nca-hero-copy">${esc(description)}</p></div>${progress()}</section>${content}</div>${footer()}<div id="nca-toast" class="nca-toast" aria-live="polite"></div><div id="nca-modal" class="nca-modal" hidden></div></div>`;
    document.getElementById('nca-home').onclick = () => { S.screen = 'home'; render(); };
    document.getElementById('nca-theme').onclick = toggleTheme;
    const batchButton = document.createElement('button');
    batchButton.id = 'nca-submit-all'; batchButton.className = 'nca-button nca-button--gold nca-batch-button';
    batchButton.innerHTML = `<i class="fa-solid fa-paper-plane"></i>Enviar preenchidos (${completeDrafts().length})`;
    batchButton.disabled = completeDrafts().length === 0;
    batchButton.onclick = submitAllDrafts;
    document.querySelector('.nca-actions')?.prepend(batchButton);
    const summaryButton = document.createElement('button');
    summaryButton.className = 'nca-button nca-button--ghost';
    summaryButton.textContent = 'Resumo de pendências';
    summaryButton.onclick = () => showPendingSummary();
    const deadline = document.createElement('p'); deadline.className = 'nca-save-state'; deadline.textContent = deadlineText();
    root.querySelector('.nca-hero').after(deadline);
    if (S.lastReceipt) { const receipt = document.createElement('button'); receipt.className = 'nca-button'; receipt.textContent = 'Último comprovante'; receipt.onclick = () => showReceipt(); batchButton.before(receipt); }
    batchButton.before(summaryButton);
    if (isLeadership()) {
      const leadership = document.createElement('button'); leadership.className = 'nca-button'; leadership.textContent = 'Painel da liderança';
      leadership.onclick = () => { S.screen = 'leadership'; render(); };
      batchButton.before(leadership);
    }
  }

  function renderHome() {
    const promotionReady = cycleOpen() && S.promotions.length > 0;
    const proposalReady = S.proposals.length > 0;
    const promotionDone = S.promotions.filter(item => sent(ownPromotionVote(item))).length;
    const proposalDone = S.proposals.filter(item => sent(ownProposalVote(item))).length;
    shell(`<section class="nca-home-grid"><button class="nca-entry" data-open="promotions" ${promotionReady ? '' : 'disabled'}><span class="nca-entry-icon"><i class="fa-solid fa-user-graduate"></i></span><span class="nca-entry-meta">${promotionReady ? `${promotionDone}/${S.promotions.length}` : 'Indisponível'}</span><h2>Avaliação de promoções</h2><p>${promotionReady ? 'Avalie os candidatos, consulte os pareceres e compare até três membros.' : 'Não há um ciclo de promoções aberto com candidatos cadastrados.'}</p></button><button class="nca-entry" data-open="proposals" ${proposalReady ? '' : 'disabled'}><span class="nca-entry-icon"><i class="fa-solid fa-file-signature"></i></span><span class="nca-entry-meta">${proposalReady ? `${proposalDone}/${S.proposals.length}` : 'Indisponível'}</span><h2>Avaliação de propostas</h2><p>${proposalReady ? 'Leia as propostas ativas e registre o parecer obrigatório.' : 'Não há propostas disponíveis para avaliação.'}</p></button></section>`);
    root.querySelectorAll('[data-open]').forEach(button => button.onclick = () => { S.screen = button.dataset.open; render(); });
  }

  const isLeadership = () => ['lider', 'vice-lider', 'lider da companhia'].includes(plain(S.profile?.cargo));
  const normalizeCouncilRole = value => {
    const role = plain(value);
    if (role.includes('conselheir')) return 'conselheiro';
    if (role.includes('estagiari')) return 'estagiario';
    return role;
  };
  function leadershipData(cargo = 'professor') {
    const candidates = S.promotions.filter(item => item.cargo === cargo);
    const evaluators = [...new Map(S.users.filter(user => plain(user.status) === 'ativo' && allowedRole(user.cargo)).map(user => [norm(nickOf(user)), user])).values()];
    const results = candidates.map(item => {
      const votes = promotionVotesFor(item);
      const promotes = votes.filter(vote => plain(vote.veredito).includes('promov')).length;
      const keeps = votes.filter(vote => plain(vote.veredito).includes('mant')).length;
      return { item, votes, promotes, keeps, verdict: !votes.length ? 'Pendente' : promotes > keeps ? 'Promovido' : keeps > promotes ? 'Mantém' : 'Empate' };
    });
    const participation = evaluators.map(user => {
      const nick = nickOf(user);
      const done = candidates.filter(item => promotionVotesFor(item).some(vote => norm(vote.avaliador) === norm(nick))).length;
      return { nick, done, total: candidates.length, pending: candidates.filter(item => !promotionVotesFor(item).some(vote => norm(vote.avaliador) === norm(nick))).map(item => item.nick) };
    });
    return { results, participation };
  }

  function managementResults(cargo, backup) {
    const lists = backup?.listas || S.promotionLists || [];
    const votes = (backup?.avaliacoes || S.promotionVotes).filter(sent);
    return (lists.find(list => list.id === cargo)?.nicks || []).map(nick => {
      const selected = votes.filter(v => norm(v.nick_avaliado) === norm(nick) && normalizeCargo(v.cargo) === cargo);
      const promotes = selected.filter(v => plain(v.veredito).includes('promov')).length;
      const keeps = selected.filter(v => plain(v.veredito).includes('mant')).length;
      return { nick, votes: selected, promotes, keeps, verdict: !selected.length ? 'Pendente' : promotes > keeps ? 'Promovido' : keeps > promotes ? 'Mantém' : 'Empate' };
    });
  }

  async function leadershipDatabase() {
    if (!isLeadership()) throw new Error('Acesso exclusivo da liderança.');
    const app = firebase.apps.find(app => app.name === 'nca-leadership') || firebase.initializeApp(FIREBASE_CONFIG, 'nca-leadership');
    const auth = app.auth();
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      await confirmForumUser();
      const profile = await app.firestore().collection('users').doc(auth.currentUser.uid).get();
      if (profile.exists && norm(nickOf(profile.data())) === norm(S.nick) && plain(profile.data().status) === 'ativo' && ['lider', 'vice-lider'].includes(plain(profile.data().cargo))) return app.firestore();
      await auth.signOut();
    }
    const nonce = crypto.randomUUID();
    const popup = window.open('https://nexusprof.netlify.app/auth/central-lideranca?nonce=' + encodeURIComponent(nonce), 'nca-leadership-login', 'width=560,height=720');
    if (!popup) throw new Error('Permita a janela de autorização para conectar sua conta de liderança.');
    return new Promise((resolve, reject) => {
      let readyTimer;
      const finish = () => { clearTimeout(timeout); clearInterval(readyTimer); window.removeEventListener('message', receive); };
      const timeout = setTimeout(() => { finish(); reject(new Error('A autorização expirou. Tente novamente.')); }, 180000);
      const sendReady = () => { try { popup.postMessage({ type: 'nca-leadership-ready', nonce }, 'https://nexusprof.netlify.app'); } catch (_) {} };
      const receive = async event => {
        if (event.origin !== 'https://nexusprof.netlify.app' || event.source !== popup || event.data?.type !== 'nca-leadership-session' || event.data?.nonce !== nonce) return;
        finish();
        try {
          await confirmForumUser();
          if (norm(event.data.nickname) !== norm(S.nick)) throw new Error('Autorize a mesma conta que está conectada no fórum.');
          if (typeof event.data.customToken !== 'string' || !event.data.customToken) throw new Error('O Nexus não devolveu a autorização. Abra a janela novamente.');
          await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
          await auth.signInWithCustomToken(event.data.customToken);
          resolve(app.firestore());
        } catch (error) { reject(error); }
      };
      window.addEventListener('message', receive);
      sendReady();
      readyTimer = setInterval(sendReady, 250);
    });
  }

  function managementCards(rows) {
    return `<div class="nca-management-stats">${[['Total', rows.length], ['Promovidos', rows.filter(r => r.verdict === 'Promovido').length], ['Mantidos', rows.filter(r => r.verdict === 'Mantém').length], ['Pendentes / empates', rows.filter(r => ['Pendente', 'Empate'].includes(r.verdict)).length]].map(([label, value]) => `<div class="nca-info"><span>${label}</span><strong>${value}</strong></div>`).join('')}</div><div class="nca-management-grid">${rows.map(row => `<article class="nca-management-card" data-verdict="${esc(row.verdict)}"><header><img src="${avatar(row.nick)}" alt=""><div><h3>${esc(row.nick)}</h3><small>${row.promotes} promove · ${row.keeps} mantém</small></div><span class="nca-status-pill">${esc(row.verdict)}</span></header><div class="nca-management-comments">${row.votes.map(vote => `<article><strong>${esc(vote.avaliador)} · ${esc(vote.veredito)}</strong><p>${esc(vote.dissertacao || 'Sem justificativa.')}</p></article>`).join('') || '<p>Aguardando avaliações.</p>'}</div><button class="nca-button nca-button--ghost" data-copy-nick="${esc(row.nick)}">Copiar nick</button></article>`).join('') || '<p>Nenhum membro neste cargo.</p>'}</div>`;
  }

  function managementParticipation(rows) {
    const roleOrder = { 'conselheiro': 1, 'estagiario': 2 };
    const users = S.users
      .filter(user => plain(user.status) === 'ativo' && allowedRole(user.cargo))
      .filter(user => !['pmjrcc'].includes(plain(nickOf(user))))
      .filter(user => ['conselheiro', 'estagiario'].includes(normalizeCouncilRole(user.cargo)))
      .sort((a, b) => (roleOrder[normalizeCouncilRole(a.cargo)] || 99) - (roleOrder[normalizeCouncilRole(b.cargo)] || 99) || norm(nickOf(a)).localeCompare(norm(nickOf(b)), 'pt-BR'));
    return `<section class="nca-management-block"><h3>Participação do Conselho</h3><p>Votos enviados no cargo selecionado</p><div class="nca-management-team">${users.map(user => {
      const nick = nickOf(user); const done = rows.filter(row => row.votes.some(v => norm(v.avaliador) === norm(nick))).length;
      const leave = licenseHistory(nick).some(record => { const start = docTime(firstValue(record.data_inicio, record.dataInicio, record.data_iso, record.data)); const end = docTime(firstValue(record.data_fim, record.dataFim, record.data_termino, record.dataTermino)); return start && start <= new Date() && (!end || end >= new Date()); });
      const status = leave ? 'Em licença' : rows.length && done === rows.length ? 'Concluído' : done ? 'Em andamento' : 'Pendente';
      return `<article class="nca-management-person ${leave ? 'is-leave' : done === rows.length && rows.length ? 'is-complete' : 'is-pending'}"><img src="${avatar(nick)}" alt=""><div><strong>${esc(nick)}</strong><small>${esc(user.cargo)}</small><span>${leave ? 'Afastado no período' : `${done}/${rows.length} enviadas`}</span></div><b>${status}</b></article>`;
    }).join('')}</div></section>`;
  }

  async function managementCopy(text) {
    try { await navigator.clipboard.writeText(text); toast('Copiado.'); }
    catch (_) { showModal('Copiar texto', `<textarea class="nca-textarea" readonly>${esc(text)}</textarea>`); }
  }

  function renderLeadership() {
    if (!isLeadership()) { S.screen = 'home'; return renderHome(); }
    const tab = S.managementTab || 'listas'; const cargo = S.leadershipCargo || 'professor';
    const backup = S.managementBackups?.find(item => item.id === S.managementBackup);
    const rows = tab === 'historico' && !backup ? [] : managementResults(cargo, tab === 'historico' ? backup : null);
    const rankOptions = PROMOTION_RANKS.map(rank => `<option value="${rank}" ${rank === cargo ? 'selected' : ''}>${cargoLabel(rank)}</option>`).join('');
    let content;
    if (tab === 'listas') content = `<div class="nca-management-grid">${PROMOTION_RANKS.map(rank => {
      const list = S.promotionLists?.find(item => item.id === rank) || { nicks: [], vagas: 0 };
      return `<form data-management-list="${rank}" class="nca-management-card nca-announcement"><h3>${cargoLabel(rank)}</h3><label>Um nick por linha<textarea name="nicks" rows="10">${esc(list.nicks.join('\n'))}</textarea></label><label>Vagas<input name="vagas" type="number" min="0" step="1" value="${Number(list.vagas) || 0}" required></label><button class="nca-button nca-button--primary" type="submit">Salvar no Firebase</button></form>`;
    }).join('')}</div>`;
    else content = `${tab === 'historico' ? `<section class="nca-management-block"><label>Selecionar backup anterior<select id="nca-backup-select"><option value="">Selecione uma data</option>${(S.managementBackups || []).map(item => `<option value="${esc(item.id)}" ${item.id === S.managementBackup ? 'selected' : ''}>${esc(item.data_formatada || item.timestamp || item.id)}</option>`).join('')}</select></label><button id="nca-load-backups" class="nca-button">Carregar histórico</button></section>` : `<section class="nca-management-block nca-management-tools"><div><h3>Relatórios e Exportação</h3><p>Copie o relatório para WhatsApp ou baixe os votos em CSV.</p></div><button id="nca-copy-report" class="nca-button">Copiar Relatório</button><button id="nca-export-votes" class="nca-button">Exportar Planilha</button></section>`}<section class="nca-management-tools"><label>Visualizar detalhes<select id="nca-management-cargo">${rankOptions}</select></label><button data-copy-verdict="Mantém" class="nca-button">Copiar Mantidos</button><button data-copy-verdict="Pendente" class="nca-button">Copiar Pendentes</button></section>${managementParticipation(rows)}${managementCards(rows)}${tab === 'resultados' ? '<section class="nca-management-danger"><h3>Encerrar Ciclo de Avaliações</h3><p>Cria um backup das listas e votos atuais e esvazia a base ativa para um novo ciclo.</p><button id="nca-archive-promotions" class="nca-button">Gerar Backup e Zerar Sistema</button></section>' : ''}`;
    shell(`<section class="nca-management"><header class="nca-management-heading"><div><h2><i class="fa-solid fa-database"></i> Painel de Gerenciamento</h2><p>Controle de Listas, Resultados e Backups</p></div><nav>${[['listas', 'Inserir Listas'], ['resultados', 'Ver Resultados'], ['historico', 'Histórico']].map(([id, label]) => `<button data-management-tab="${id}" class="nca-button ${tab === id ? 'nca-button--primary' : ''}">${label}</button>`).join('')}</nav></header><div class="nca-management-tools"><button id="nca-management-notice" class="nca-button nca-button--gold">Enviar aviso de promoções ao Conselho</button><button id="nca-management-refresh" class="nca-button">Atualizar dados</button></div>${content}</section>`, 'Gestão de <em>promoções.</em>', 'Controle de listas, resultados e backups da Companhia.');
    root.querySelector('.nca-hero').hidden = true;
    root.querySelectorAll('[data-management-tab]').forEach(button => button.onclick = () => { S.managementTab = button.dataset.managementTab; renderLeadership(); });
    document.getElementById('nca-management-notice').onclick = showPromotionAnnouncement;
    document.getElementById('nca-management-refresh').onclick = async () => { try { await load(); renderLeadership(); } catch (error) { toast(error.message, true); } };
    document.getElementById('nca-management-cargo')?.addEventListener('change', event => { S.leadershipCargo = event.target.value; renderLeadership(); });
    root.querySelectorAll('[data-copy-nick]').forEach(button => button.onclick = () => managementCopy(button.dataset.copyNick));
    root.querySelectorAll('[data-copy-verdict]').forEach(button => button.onclick = () => managementCopy(rows.filter(row => row.verdict === button.dataset.copyVerdict).map(row => row.nick).join('\n') || 'Nenhum membro.'));
    root.querySelectorAll('[data-management-list]').forEach(form => form.onsubmit = async event => {
      event.preventDefault(); const rank = form.dataset.managementList;
      const nicks = [...new Map(form.elements.nicks.value.split(/\r?\n/).map(nick => clean(nick)).filter(Boolean).map(nick => [norm(nick), nick])).values()];
      const vagas = Number(form.elements.vagas.value); if (!Number.isSafeInteger(vagas) || vagas < 0) return;
      try { const db = await leadershipDatabase(); await db.collection('listas_promocao').doc(rank).set({ nicks, vagas, atualizadoEm: serverTime() }, { merge: true }); await load(); renderLeadership(); toast('Lista salva.'); }
      catch (error) { toast(error.message, true); }
    });
    document.getElementById('nca-copy-report')?.addEventListener('click', () => {
      const sections = PROMOTION_RANKS.map(rank => {
        const promoted = managementResults(rank).filter(row => row.verdict === 'Promovido').map(row => row.nick);
        return promoted.length ? '*' + cargoLabel(rank) + '*\n' + promoted.join('\n') : '';
      }).filter(Boolean);
      managementCopy('*Promovidos da semana #PROF - ' + new Date().toLocaleDateString('pt-BR') + '*\n\n' + (sections.join('\n\n') || 'Nenhum membro promovido.'));
    });
    document.getElementById('nca-export-votes')?.addEventListener('click', () => {
      const cell = value => '"' + String(value ?? '').replace(/^[=+@-]/, "'$&").replace(/"/g, '""') + '"';
      const csv = '\uFEFF' + [['Avaliador', 'Membro Avaliado', 'Status', 'Comentário', 'Data'], ...rows.flatMap(row => row.votes.map(vote => [vote.avaliador, row.nick, vote.veredito, vote.dissertacao, docTime(vote.atualizadoEm || vote.timestamp)?.toLocaleString('pt-BR') || '']))].map(row => row.map(cell).join(';')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'avaliacoes-' + cargo + '.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    document.getElementById('nca-load-backups')?.addEventListener('click', async () => { try { const db = await leadershipDatabase(); const snapshot = await db.collection('historico_promocoes').orderBy('timestamp', 'desc').get(); S.managementBackups = snapshot.docs.map(dataOf); renderLeadership(); } catch (error) { toast(error.message, true); } });
    document.getElementById('nca-backup-select')?.addEventListener('change', event => { S.managementBackup = event.target.value; renderLeadership(); });
    document.getElementById('nca-archive-promotions')?.addEventListener('click', archiveManagementCycle);
  }

  async function archiveManagementCycle() {
    if (S.archiving) return;
    if (!window.confirm('Criar um backup completo e remover as listas e votos do ciclo atual?')) return;
    S.archiving = true;
    try {
      const db = await leadershipDatabase();
      const [lists, votes] = await Promise.all([db.collection('listas_promocao').get(), db.collection('avaliacoes_nexus').get()]);
      if (!lists.size && !votes.size) return toast('O ciclo já está vazio.');
      if (lists.size + votes.size > 450) throw new Error('Este ciclo excede o limite de encerramento em uma operação. Nenhum dado foi alterado.');
      const refs = [...lists.docs, ...votes.docs];
      const history = db.collection('historico_promocoes').doc();
      await db.runTransaction(async transaction => {
        const current = await Promise.all(refs.map(doc => transaction.get(doc.ref)));
        if (current.some(doc => !doc.exists)) throw new Error('O ciclo foi alterado durante o encerramento. Atualize os dados antes de continuar.');
        const now = new Date();
        transaction.set(history, { data_formatada: now.toLocaleString('pt-BR'), timestamp: now.toISOString(), listas: current.slice(0, lists.size).map(dataOf), avaliacoes: current.slice(lists.size).map(dataOf), criadoEm: serverTime() });
        current.forEach(doc => transaction.delete(doc.ref));
      });
      await load(); S.managementTab = 'historico'; S.managementBackup = history.id;
      S.managementBackups = (await db.collection('historico_promocoes').orderBy('timestamp', 'desc').get()).docs.map(dataOf);
      renderLeadership(); toast('Backup criado e ciclo encerrado.');
    } catch (error) { toast(error.message || 'Não foi possível encerrar o ciclo.', true); }
    finally { S.archiving = false; }
  }

  function weeklyEvolution(weeks, cargo) {
    const ordered = weeks.slice().sort(sortWeeks).filter(week => week.metaValue != null).slice(0, 2);
    if (ordered.length < 2) return '<p>São necessários dois períodos com dados para comparar a evolução.</p>';
    const [latest, previous] = ordered;
    const delta = latest.metaValue - previous.metaValue;
    const lessons = latest.aulasAplicadas != null && previous.aulasAplicadas != null ? latest.aulasAplicadas - previous.aulasAplicadas : null;
    const signed = value => (value > 0 ? '+' : '') + numberLabel(value);
    return `<p>${esc(weekPeriod(previous))} → ${esc(weekPeriod(latest))}</p><p><strong>${signed(delta)} ${cargo === 'graduador' ? 'graduações' : 'pontos percentuais de meta'}</strong>${lessons === null ? '' : ' · ' + signed(lessons) + (cargo === 'graduador' ? ' graduações aplicadas' : ' aulas aplicadas')}</p><small>Variação entre os dois períodos mais recentes disponíveis.</small>`;
  }

  function promotionAnnouncement({ period, deadline, url }) {
    const safe = value => esc(value).replace(/\[/g, '&#91;').replace(/\]/g, '&#93;');
    const link = new URL(url);
    if (link.protocol !== 'https:' || !/(^|\.)policiarcc\.com$/i.test(link.hostname)) throw new Error('Informe o link HTTPS da Central no fórum policiarcc.com.');
    if (!clean(period) || !clean(deadline)) throw new Error('Preencha o período e o prazo.');
    return `[font=Poppins]<div style="border:1.5rem solid #821F88;border-radius:8px;font-family:Poppins;">[/font][table][tr][td][center][img]https://i.imgur.com/hU7bn8R.gif[/img][/center]
[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][center][img]https://i.imgur.com/yDjLGXX.png[/img][/center][size=20][font=Poppins][color=white][b]AVALIAÇÃO DE PROMOÇÕES[/b][/color][/font][/size][/td][/tr][/table]
<div style="padding:1.5%;border:1px solid #bdbdbd;border-radius:8px;">[center]Olá, [b]{USERNAME}[/b].

[justify]A Liderança dos Professores vem, por este meio, informá-lo da [b]atualização da Central de Avaliações de Promoções[/b], referente às promoções a serem realizadas no período de [b]${safe(period)}[/b].

Todos os estagiários e conselheiros têm a obrigação de realizar a avaliação, tendo [b]prazo até ${safe(deadline)}[/b]. Estão isentos da avaliação todos aqueles que estejam de licença ou reserva.[/justify]

[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][size=16][font=Poppins][b][url=${safe(link.href)}][color=#ffffff]CLIQUE AQUI PARA ACESSAR[/color][/url][/b][/font][/size][/td][/tr][/table][/center]</div>[/td][/tr][/table]</div>
[font=Poppins][center]Atentamente,
[img]https://i.imgur.com/1kZvQHs.png[/img][/center][/font]`;
  }

  async function sendPromotionAnnouncement(message) {
    if (!isLeadership()) throw new Error('Somente a liderança pode enviar este aviso.');
    await confirmForumUser();
    const compose = await fetch('/privmsg?mode=post', { credentials: 'same-origin', signal: AbortSignal.timeout(20000) });
    if (!compose.ok) throw new Error('Não foi possível abrir o formulário de MP.');
    const page = new DOMParser().parseFromString(await compose.text(), 'text/html');
    const form = page.querySelector('textarea[name="message"]')?.closest('form');
    if (!form) throw new Error('Entre novamente no fórum. O formulário de MP não foi encontrado.');
    const action = new URL(form.getAttribute('action') || '/privmsg', location.href);
    if (action.origin !== location.origin || action.pathname !== '/privmsg') throw new Error('O formulário retornou um destino inesperado.');
    const body = new URLSearchParams();
    new FormData(form).forEach((value, key) => { if (typeof value === 'string') body.append(key, value); });
    for (const key of [...body.keys()]) if (/^(username|usergroup|preview)/.test(key)) body.delete(key);
    body.set('usergroup', '397'); body.set('mode', 'post'); body.set('folder', 'inbox');
    body.set('subject', '[PROF] AVALIAÇÃO DE PROMOÇÕES'); body.set('message', message); body.set('post', 'Enviar');
    const response = await fetch(action.href, { method: 'POST', credentials: 'same-origin', body, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('O fórum recusou a MP (HTTP ' + response.status + ').');
    const result = new DOMParser().parseFromString(await response.text(), 'text/html');
    const text = result.body.textContent.replace(/\s+/g, ' ').trim();
    if (!/(mensagem (?:privada )?foi enviada|mensagem enviada com sucesso|message has been sent)/i.test(text)) {
      const error = result.querySelector('.error, .alert-error, .gen.error')?.textContent?.trim();
      throw new Error(error || 'O fórum não confirmou o envio. Confira sua caixa de saída antes de tentar novamente.');
    }
  }

  function showPromotionAnnouncement() {
    if (!isLeadership()) return;
    showModal('Aviso de promoções — grupo g397', `<p>A MP será enviada pela sua conta do fórum aos membros do grupo g397, incluindo estagiários e conselheiros.</p><form id="nca-announcement" class="nca-announcement"><label>Período das promoções<input name="period" required maxlength="150" placeholder="Ex.: 07 Out 2026 a 09 Out 2026"></label><label>Prazo, com data e horários BR/PT<input name="deadline" required maxlength="200" placeholder="Ex.: 11 Out 2026, às 13h59 BR / 17h59 PT"></label><label>Link da Central no fórum<input name="url" type="url" required value="${esc(location.origin + location.pathname)}"></label><button class="nca-button" type="submit">Revisar BBCode</button><label>Mensagem que será enviada<textarea id="nca-announcement-code" readonly rows="12"></textarea></label><p id="nca-announcement-status" role="status"></p><button id="nca-announcement-send" type="button" class="nca-button nca-button--gold" disabled>Confirmar envio da MP ao grupo g397</button></form>`);
    const form = document.getElementById('nca-announcement');
    const code = document.getElementById('nca-announcement-code');
    const send = document.getElementById('nca-announcement-send');
    const status = document.getElementById('nca-announcement-status');
    form.oninput = () => { send.disabled = true; code.value = ''; status.textContent = 'Revise novamente após alterar os dados.'; };
    form.onsubmit = event => {
      event.preventDefault();
      try { code.value = promotionAnnouncement(Object.fromEntries(new FormData(form))); send.disabled = false; status.textContent = 'Confira período, prazo e link antes de confirmar.'; }
      catch (error) { status.textContent = error.message; }
    };
    send.onclick = async () => {
      if (S.sendingAnnouncement) return;
      S.sendingAnnouncement = true;
      form.querySelectorAll('input, button').forEach(node => node.disabled = true);
      status.textContent = 'Enviando MP… Aguarde a confirmação do fórum.';
      try { await sendPromotionAnnouncement(code.value); status.textContent = 'O fórum confirmou o envio da MP ao grupo g397.'; }
      catch (error) { status.textContent = error.message + ' O BBCode permanece disponível para cópia.'; }
      finally { S.sendingAnnouncement = false; }
    };
  }

  function memberProfile(item) {
    return S.users.find(user => norm(nickOf(user)) === norm(item.nick)) || {};
  }

  function licenseHistory(nick) {
    const entry = latestEntryDate(memberProfile({ nick }));
    if (!entry) return [];
    return S.licenses
      .filter(item => norm(item.nickname ?? item.nick ?? item.name) === norm(nick))
      .filter(item => {
        const start = docTime(firstValue(item.data_inicio, item.dataInicio, item.data_iso, item.data));
        return start && dayKey(start) >= dayKey(entry);
      })
      .sort((a, b) => docTime(firstValue(b.data_inicio, b.dataInicio, b.data_iso, b.data)) - docTime(firstValue(a.data_inicio, a.dataInicio, a.data_iso, a.data)));
  }

  function licenseSummary(nick) {
    if (!latestEntryDate(memberProfile({ nick }))) return 'Veja manualmente: data de entrada não cadastrada.';
    const history = licenseHistory(nick);
    if (!history.length) return 'Nenhuma licença registrada após a última entrada.';
    return history.map(item => {
      const type = clean(firstValue(item.tipo_licenca, item.tipoLicenca, item.tipo, item.motivo, item.status_licenca), 'Licença');
      const start = firstValue(item.data_inicio, item.dataInicio, item.data_iso, item.data);
      const end = firstValue(item.data_fim, item.dataFim, item.data_termino, item.dataTermino);
      return `${type} · ${dateLabel(start)}${end ? ` até ${dateLabel(end)}` : ''}`;
    }).join(' | ');
  }

  const sheetCache = new Map();
  function validateSheetMonth(csv, month) {
    const header = parseCsv(csv)[0] || [];
    const periods = header.filter(cell => /nick/i.test(cell)).map(cell => weekDates({ data: cell }));
    const monthIndex = CONSULTA_MONTHS.indexOf(month);
    if (!periods.some(({ start, end }) => start && end && (start.getUTCMonth() === monthIndex || end.getUTCMonth() === monthIndex))) {
      throw new Error('A aba ' + month + ' não foi encontrada ou retornou outro período.');
    }
  }
  async function readPerformanceSheet(config, month) {
    const cacheKey = config.sheetId + ':' + month;
    const cached = sheetCache.get(cacheKey);
    if (cached && Date.now() - cached.time < 60000) return cached.promise;
    const promise = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const url = 'https://docs.google.com/spreadsheets/d/' + config.sheetId + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(month);
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Planilha indisponível');
        const csv = await response.text();
        if (!parseCsv(csv)[0]?.some(cell => /nick/i.test(cell))) throw new Error('A aba não retornou uma planilha de desempenho');
        validateSheetMonth(csv, month);
        return csv;
      } finally { clearTimeout(timeout); }
    })();
    sheetCache.set(cacheKey, { time: Date.now(), promise });
    try { return await promise; } catch (error) { sheetCache.delete(cacheKey); throw error; }
  }
  async function loadPerformance(item) {
    const profile = memberProfile(item);
    const cargo = normalizeCargo(profile.cargo) || item.cargo;
    const config = CONSULTA_SHEETS[cargo];
    const entry = latestEntryDate(profile);
    const cacheKey = norm(item.nick) + ':' + cargo + ':' + (entry?.toISOString() || 'missing');
    const cached = S.performance.get(cacheKey);
    if (cached && Date.now() - Date.parse(cached.consultedAt) < 60000 && !cached.failedMonths.length) return cached;
    const result = {
      sourceKind: 'consulta', cargo, entryDate: entry, manualReview: !entry,
      sourceLabel: 'Planilha oficial de ' + cargoLabel(cargo),
      sourceUrl: config ? 'https://docs.google.com/spreadsheets/d/' + config.sheetId + '/edit' : 'https://nexusprof.netlify.app/consulta',
      semanas: [], historicoMetas: [], failedMonths: [], consultedAt: new Date().toISOString(),
    };
    if (!entry || !config) { result.manualReview = true; return result; }
    const months = performanceMonthNames(entry);
    const records = [];
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(3, months.length) }, async () => {
      while (cursor < months.length) {
        const month = months[cursor++];
        try { records.push(...consultaWeeks(await readPerformanceSheet(config, month), config, item.nick)); }
        catch (error) { result.failedMonths.push(month); console.warn('Consulta de desempenho indisponível:', month, error); }
      }
    }));
    result.semanas = filterCareerWeeks(records, entry);
    result.historicoMetas = result.semanas;
    Object.assign(result, summarizeWeeks(result.semanas, cargo));
    S.performance.set(cacheKey, result);
    return result;
  }

  function hasPromotionCandidates(filter) {
    return S.promotions.some(item => filter === 'todos' || item.cargo === filter);
  }

  function promotionItems() {
    if (!hasPromotionCandidates(S.promotionFilter)) { S.promotionFilter = 'todos'; S.selectedPromotion = 0; }
    return S.promotionFilter === 'todos' ? S.promotions : S.promotions.filter(item => item.cargo === S.promotionFilter);
  }

  function promotionIndex(items, active) {
    const filters = [['todos', 'Todos'], ['professor', 'Professores'], ['coordenador', 'Coordenadores'], ['graduador', 'Graduadores']];
    return `<aside class="nca-index"><div class="nca-index-head"><h2>Candidatos</h2><p>${items.length} membro${items.length === 1 ? '' : 's'} nesta visualização</p><div class="nca-filters">${filters.map(([value, label]) => `<button class="nca-filter ${S.promotionFilter === value ? 'is-active' : ''}" data-filter="${value}" ${hasPromotionCandidates(value) ? '' : 'disabled aria-disabled="true" title="Nenhum membro para avaliar"'}>${label}</button>`).join('')}</div></div><div class="nca-index-list">${items.map((item, index) => { const vote = effectiveVote('promotion', item); return `<button class="nca-index-item ${index === active ? 'is-active' : ''}" data-index="${index}"><img src="${avatar(item.nick)}" alt=""><span><strong>${esc(item.nick)}</strong><small>${cargoLabel(item.cargo)}</small><small class="nca-response-label">${responseLabel(vote)}</small></span><i class="nca-dot ${answered(vote) ? 'is-done' : 'is-draft'}"></i></button>`; }).join('')}</div></aside>`;
  }

  function promotionEditor(item, performance = {}) {
    const profile = memberProfile(item);
    const vote = ownPromotionVote(item) || {};
    const local = readLocalDrafts()['promotion:' + item.cargo + ':' + item.nick];
    const draft = local?.draft ? { veredito: local.draft.veredito, dissertacao: local.draft.comentario } : vote.rascunho || {};
    const verdict = clean(draft.veredito ?? vote.veredito);
    const comment = clean(draft.dissertacao ?? vote.dissertacao);
    const votes = promotionVotesFor(item);
    const promote = votes.filter(v => plain(v.veredito).includes('promov')).length;
    const keep = votes.filter(v => plain(v.veredito).includes('mant')).length;
    const selected = S.compare.some(candidate => norm(candidate.nick) === norm(item.nick) && candidate.cargo === item.cargo);
    const lastCareerDate = careerDate(profile, 'promov') || careerDate(profile, 'rebaix');
    const entryDate = latestEntryDate(profile);
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
    root.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => { if (!hasPromotionCandidates(button.dataset.filter)) return; S.promotionFilter = button.dataset.filter; S.selectedPromotion = 0; render(); });
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
      const evolution = document.createElement('section'); evolution.className = 'nca-performance-block';
      evolution.innerHTML = '<h4>Evolução entre semanas</h4>' + weeklyEvolution(performanceWeeks(performance, memberProfile(item)), item.cargo);
      performanceNode.append(evolution);
      const refresh = document.createElement('button'); refresh.type = 'button'; refresh.className = 'nca-button'; refresh.textContent = 'Atualizar desempenho';
      refresh.onclick = async () => {
        refresh.disabled = true; refresh.textContent = 'Atualizando…';
        try {
          sheetCache.clear(); S.performance.clear();
          const updated = await loadPerformance(item);
          if (!infoSection.isConnected) return;
          document.getElementById('nca-member-performance').outerHTML = performancePanel(updated, memberProfile(item), item);
          const next = document.getElementById('nca-member-performance'); next.hidden = false;
          evolution.innerHTML = '<h4>Evolução entre semanas</h4>' + weeklyEvolution(performanceWeeks(updated, memberProfile(item)), item.cargo);
          next.append(evolution, refresh);
        } catch (error) { toast('Não foi possível atualizar o desempenho.', true); }
        finally { refresh.disabled = false; refresh.textContent = 'Atualizar desempenho'; }
      };
      performanceNode.append(refresh);
      tabs.querySelectorAll('[data-member-tab]').forEach(button => button.onclick = () => {
        const showPerformance = button.dataset.memberTab === 'desempenho';
        infoGrid.hidden = showPerformance;
        document.getElementById('nca-member-performance').hidden = !showPerformance;
        tabs.querySelectorAll('.nca-member-tab').forEach(tab => tab.classList.toggle('is-active', tab === button));
      });
    }
    const form = document.getElementById('nca-evaluation-form');
    form.addEventListener('input', () => {
      document.getElementById('nca-count').textContent = document.getElementById('nca-comment').value.length;
      scheduleDraft('promotion', item);
    });
    form.onsubmit = event => { event.preventDefault(); submitAllDrafts(); };
    form.querySelector('[type=submit]').textContent = 'Enviar preenchidos';
  }

  async function renderPromotions() {
    const items = promotionItems();
    if (!items.length) { shell(`<div class="nca-workspace">${promotionIndex([], 0)}<div class="nca-empty"><p>Nenhum candidato disponível para avaliação.</p></div></div>`, 'Avaliação de <em>promoções.</em>', 'Consulte os dados, compare candidatos e registre seu parecer.'); return; }
    S.selectedPromotion = Math.min(S.selectedPromotion, items.length - 1);
    const item = items[S.selectedPromotion];
    const performance = await loadPerformance(item);
    shell(`<div class="nca-compare-bar"><div class="nca-compare-list">${S.compare.map(candidate => `<span class="nca-compare-chip">${esc(candidate.nick)}<button data-remove-compare="${esc(candidate.nick)}" data-cargo="${candidate.cargo}"><i class="fa-solid fa-xmark"></i></button></span>`).join('') || '<span class="nca-save-state">Selecione até três membros para comparar.</span>'}</div><button id="nca-show-compare" class="nca-button nca-button--primary" ${S.compare.length < 2 ? 'disabled' : ''}><i class="fa-solid fa-scale-balanced"></i>Comparar ${S.compare.length || ''}</button></div><div class="nca-workspace">${promotionIndex(items, S.selectedPromotion)}${promotionEditor(item, performance)}</div>`, 'Avaliação de <em>promoções.</em>', 'Pareceres visíveis ao Conselho e comparação livre de até três membros.');
    bindPromotion(items, item, performance);
    bindHistory(ownPromotionVote(item));
    bindRecovery('promotion', item);
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
    const datasets = await Promise.all(S.compare.map(item => loadPerformance(item)));
    const weeks = [...new Set(datasets.flatMap((data, index) => performanceWeeks(data, memberProfile(S.compare[index])).map(week => String(week.data || week.dataFim || week.fim || ''))))].filter(Boolean);
    if (!weeks.includes(S.compareWeek)) S.compareWeek = weeks[0] || '';
    const weekControls = '<label class="nca-week-select">Semana da comparação<select id="nca-compare-week">' + weeks.map(week => '<option ' + (week === S.compareWeek ? 'selected' : '') + ' value="' + esc(week) + '">' + esc(week) + '</option>').join('') + '</select></label>';
    const cards = await Promise.all(S.compare.map(async item => {
      const profile = memberProfile(item); const performance = await loadPerformance(item); const selectedWeek = performanceWeeks(performance, profile).find(week => String(week.data || week.dataFim || week.fim || '') === S.compareWeek); const votes = promotionVotesFor(item);
      return `<article class="nca-compare-card"><header><img src="${avatar(item.nick)}" alt=""><div><h3>${esc(item.nick)}</h3><small>${esc(profile.cargo || cargoLabel(item.cargo))}</small></div></header><dl><div><dt>Tempo no cargo</dt><dd>${daysSince(item.cargo === 'professor' ? firstValue(profile.dataEntrada, profile.data_entrada, profile.entrada) : careerDate(profile, 'promov') || careerDate(profile, 'rebaix'))}</dd></div><div><dt>Meta na semana selecionada</dt><dd>${performance.manualReview ? 'Veja manualmente' : selectedWeek ? performance.cargo === 'graduador' ? numberLabel(selectedWeek.metaValue) : percentLabel(selectedWeek.porcentagem) : 'Sem registro'}</dd></div><div><dt>Aulas aplicadas</dt><dd>${performance.manualReview ? 'Veja manualmente' : selectedWeek?.aulasAplicadas != null ? numberLabel(selectedWeek.aulasAplicadas) : 'Sem registro'}</dd></div><div><dt>Licença</dt><dd>${esc(licenseSummary(item.nick))}</dd></div><div><dt>Promover</dt><dd>${votes.filter(v => plain(v.veredito).includes('promov')).length}</dd></div><div><dt>Manter</dt><dd>${votes.filter(v => plain(v.veredito).includes('mant')).length}</dd></div></dl><button class="nca-button nca-button--ghost" data-comments="${esc(item.nick)}" data-cargo="${item.cargo}"><i class="fa-solid fa-comments"></i>Ver pareceres</button></article>`;
    }));
    shell(`<div class="nca-compare-bar"><button id="nca-back-promotions" class="nca-button"><i class="fa-solid fa-arrow-left"></i>Voltar às promoções</button><span class="nca-save-state">${S.compare.length} de 3 membros selecionados</span></div><div class="nca-compare-controls">${[0, 1, 2].map(slot => `<label>Membro ${slot + 1}<select data-compare-slot="${slot}"><option value="">Selecione um membro</option>${S.promotions.map((candidate, index) => `<option value="${index}" ${S.compare[slot] === candidate ? 'selected' : ''}>${esc(candidate.nick)} · ${cargoLabel(candidate.cargo)}</option>`).join('')}</select></label>`).join('')}</div>${weekControls}<section class="nca-compare-grid">${cards.join('')}</section>`, 'Comparador de <em>membros.</em>', 'Compare desempenho, situação e votação dos candidatos selecionados.');
    document.getElementById('nca-compare-week').onchange = event => { S.compareWeek = event.target.value; render(); };
    root.querySelectorAll('[data-compare-slot]').forEach(select => select.onchange = () => {
      const candidate = S.promotions[Number(select.value)]; const slot = Number(select.dataset.compareSlot);
      if (select.value && S.compare.includes(candidate) && S.compare[slot] !== candidate) { render(); return toast('Este membro já está no comparador.', true); }
      if (select.value) S.compare[slot] = candidate; else S.compare.splice(slot, 1);
      S.compare = S.compare.filter(Boolean); render();
    });
    document.getElementById('nca-back-promotions').onclick = () => { S.screen = 'promotions'; render(); };
    root.querySelectorAll('[data-comments]').forEach(button => button.onclick = () => showPromotionComments(S.compare.find(item => norm(item.nick) === norm(button.dataset.comments) && item.cargo === button.dataset.cargo)));
  }

  function proposalIndex(items, active) {
    return `<aside class="nca-index"><div class="nca-index-head"><h2>Propostas</h2><p>${items.length} pauta${items.length === 1 ? '' : 's'} disponíveis</p></div><div class="nca-index-list">${items.map((item, index) => { const vote = effectiveVote('proposal', item); return `<button class="nca-index-item ${index === active ? 'is-active' : ''}" data-index="${index}"><span class="nca-brand-mark" style="width:36px;height:36px;border-radius:10px;font-size:14px">${item.ordem}</span><span><strong>${esc(item.titulo)}</strong><small>${esc(item.autor)}</small><small class="nca-response-label">${responseLabel(vote)}</small></span><i class="nca-dot ${answered(vote) ? 'is-done' : 'is-draft'}"></i></button>`; }).join('')}</div></aside>`;
  }

  function canReadProposalVotes(profile, vote) {
    const role = plain(profile?.cargo).replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
    return /^(?:vice[ -]+)?lider(?: da companhia)?$/.test(role) || sent(vote);
  }

  function proposalEditor(item) {
    const vote = ownProposalVote(item) || {};
    const draft = effectiveVote('proposal', item).rascunho || {};
    const verdict = clean(draft.veredito ?? vote.Veredito ?? vote.veredito);
    const comment = clean(draft.comentario ?? vote.Comentario ?? vote.comentario);
    const otherVotes = proposalVotesFor(item);
    const canSee = canReadProposalVotes(S.profile, vote);
    return `<section class="nca-editor"><div class="nca-editor-scroll"><header class="nca-editor-head"><div><p class="nca-kicker">Proposta nº ${item.ordem}</p><h2>${esc(item.titulo)}</h2><p>${esc(item.autor)} · ${esc(item.tipo)} · ${dateLabel(item.data)}</p></div><span class="nca-status-pill ${sent(vote) ? 'is-sent' : ''}">${sent(vote) ? 'Parecer enviado' : draft.veredito || draft.comentario ? 'Rascunho' : 'Pendente'}</span></header><section class="nca-section"><div class="nca-section-title"><h3>Conteúdo da proposta</h3></div><div class="nca-proposal-body">${esc(item.conteudo)}</div></section><form id="nca-evaluation-form"><section class="nca-section"><div class="nca-section-title"><h3>Seu veredito</h3></div><div class="nca-verdicts">${PROPOSAL_VERDICTS.map(([value, icon]) => `<label class="nca-choice"><input type="radio" name="veredito" value="${value}" ${verdict === value ? 'checked' : ''}><span><i class="fa-solid ${icon}"></i>${value}</span></label>`).join('')}</div></section><section class="nca-section"><label class="nca-field-label" for="nca-comment">Justificativa obrigatória <small><span id="nca-count">${comment.length}</span>/5000</small></label><textarea id="nca-comment" class="nca-textarea" maxlength="5000" placeholder="Explique os fundamentos do seu parecer e os ajustes necessários.">${esc(comment)}</textarea></section><section class="nca-section"><div class="nca-section-title"><h3>Pareceres do Conselho</h3></div>${canSee ? `<div class="nca-comments">${otherVotes.map(v => `<article class="nca-comment"><header><strong>${esc(v.Nick ?? v.nick ?? 'Conselho')}</strong><span>${esc(v.Veredito ?? v.veredito)}</span></header><p>${esc(v.Comentario ?? v.comentario ?? 'Sem comentário.')}</p></article>`).join('') || '<div class="nca-locked">Nenhum outro parecer foi enviado.</div>'}</div>` : '<div class="nca-locked"><i class="fa-solid fa-lock"></i><br>Envie seu próprio parecer para consultar os votos dos demais.</div>'}</section><footer class="nca-editor-actions"><span id="nca-save-label" class="nca-save-state"><i class="fa-solid fa-cloud"></i>${draft.veredito || draft.comentario ? 'Rascunho recuperado. Envie para contabilizar.' : 'O preenchimento será salvo automaticamente.'}</span><button class="nca-button nca-button--gold" type="submit"><i class="fa-solid fa-paper-plane"></i>${sent(vote) ? 'Atualizar avaliação' : 'Enviar avaliação'}</button></footer></form></div></section>`;
  }

  function renderProposals() {
    if (!S.proposals.length) { renderHome(); return; }
    S.selectedProposal = Math.min(S.selectedProposal, S.proposals.length - 1);
    const item = S.proposals[S.selectedProposal];
    shell(`<div class="nca-workspace">${proposalIndex(S.proposals, S.selectedProposal)}${proposalEditor(item)}</div>`, 'Avaliação de <em>propostas.</em>', 'Leia a proposta completa e registre um parecer fundamentado.');
    root.querySelectorAll('[data-index]').forEach(button => button.onclick = () => { S.selectedProposal = Number(button.dataset.index); render(); });
    const form = document.getElementById('nca-evaluation-form');
    bindHistory(ownProposalVote(item));
    bindRecovery('proposal', item);
    form.addEventListener('input', () => { document.getElementById('nca-count').textContent = document.getElementById('nca-comment').value.length; scheduleDraft('proposal', item); });
    form.onsubmit = event => { event.preventDefault(); submitAllDrafts(); };
    form.querySelector('[type=submit]').textContent = 'Enviar preenchidos';
  }

  function formDraft() {
    return {
      veredito: document.querySelector('input[name="veredito"]:checked')?.value || '',
      comentario: document.getElementById('nca-comment')?.value.trim() || '',
    };
  }

  function scheduleDraft(kind, item) {
    clearTimeout(S.saveTimer);
    const draft = formDraft();
    if (S.busy) return;
    storeLocalDraft(kind, item, draft);
    updateResponseState(kind, item);
    const dot = root.querySelector('.nca-index-item.is-active .nca-dot');
    if (dot) { dot.classList.toggle('is-done', Boolean(draft.veredito && draft.comentario)); dot.classList.toggle('is-draft', !draft.veredito || !draft.comentario); dot.title = draft.veredito && draft.comentario ? 'Resposta completa' : 'Resposta incompleta'; }
    setSaveLabel('Salvando rascunho…', 'fa-spinner fa-spin');
    S.pendingDrafts ||= new Map();
    const draftKey = draftId(kind, item);
    S.pendingDrafts.set(draftKey, { kind, item, draft });
    if (!S.savingDrafts) {
      S.savingDrafts = true;
      S.saveQueue = (async () => {
        try {
          while (S.pendingDrafts.size) {
            await new Promise(resolve => setTimeout(resolve, 350));
            const [id, pending] = S.pendingDrafts.entries().next().value;
            S.pendingDrafts.delete(id);
            await saveDraft(pending.kind, pending.item, pending.draft);
          }
        } finally { S.savingDrafts = false; }
      })();
    }
  }

  function setSaveLabel(text, icon = 'fa-cloud') {
    const label = document.getElementById('nca-save-label');
    if (label) label.innerHTML = `<i class="fa-solid ${icon}"></i>${esc(text)}`;
  }

  function bindRecovery(kind, item) {
    S.activeDraftId = draftId(kind, item);
    updateResponseState(kind, item);
    const label = document.getElementById('nca-save-label');
    label?.setAttribute('role', 'status');
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'nca-button nca-button--ghost';
    button.textContent = 'Tentar salvar novamente';
    button.onclick = async () => {
      button.disabled = true;
      await S.saveQueue;
      storeLocalDraft(kind, item, formDraft());
      await recoverLocalDrafts();
      button.disabled = false;
      updateResponseState(kind, item);
    };
    label?.after(button);
    const vote = effectiveVote(kind, item);
    if (readLocalDrafts()[draftId(kind, item)]) setSaveLabel('Cópia recuperada neste navegador. Aguardando sincronização.', 'fa-laptop');
    else if (vote.rascunho?.atualizadoEm) setSaveLabel('Rascunho salvo em ' + new Date(vote.rascunho.atualizadoEm).toLocaleString('pt-BR') + '. Aguardando envio.');
    else if (sent(vote)) setSaveLabel('Avaliação enviada e contabilizada.', 'fa-circle-check');
  }

  async function saveDraft(kind, item, draft = formDraft()) {
    try {
      if (!cycleOpen()) throw new Error('Prazo encerrado. A cópia local foi preservada.');
      if (!navigator.onLine) throw new Error('Sem conexão. Rascunho guardado neste navegador.');
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
      const batchButton = document.getElementById('nca-submit-all');
      if (batchButton) { batchButton.disabled = completeDrafts().length === 0; batchButton.textContent = 'Enviar preenchidos (' + completeDrafts().length + ')'; }
      const local = readLocalDrafts();
      const localId = kind + ':' + (kind === 'promotion' ? item.cargo + ':' + item.nick : item.ordem);
      if (JSON.stringify(local[localId]?.draft) === JSON.stringify(draft)) {
        delete local[localId];
        try { localStorage.setItem(localDraftKey(), JSON.stringify(local)); } catch (_) {}
      }
      S.draftError = Object.keys(readLocalDrafts()).length > 0;
      if (S.activeDraftId === draftId(kind, item)) {
        updateResponseState(kind, item);
        if (readLocalDrafts()[draftId(kind, item)]) setSaveLabel('Salvando as últimas alterações…', 'fa-spinner fa-spin');
        else setSaveLabel(`Rascunho salvo às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Ainda não foi enviado.`, 'fa-circle-check');
      }
    } catch (error) {
      S.draftError = true; console.error(error);
      if (S.activeDraftId === draftId(kind, item)) setSaveLabel('Falha ao salvar. Tente novamente; a cópia local foi preservada.', 'fa-triangle-exclamation');
      toast(error.message || 'Falha ao salvar rascunho.', true);
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
    const history = Array.isArray(record?.historico) ? record.historico.slice() : [];
    if (sent(record)) history.push({ ...Object.fromEntries(fields.map(field => [field, record[field] ?? ''])), salvoEm: docTime(record.atualizadoEm || record.timestamp || record.Timestamp)?.toISOString() || new Date().toISOString() });
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
      await S.saveQueue;
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
      await S.saveQueue;
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

  async function showPendingSummary() {
    await S.saveQueue;
    const entries = [
      ...S.promotions.map((item, index) => ({ kind: 'promotion', index, title: item.nick, vote: effectiveVote('promotion', item) })),
      ...S.proposals.map((item, index) => ({ kind: 'proposal', index, title: `Proposta ${item.ordem}: ${item.titulo}`, vote: effectiveVote('proposal', item) })),
    ].map(entry => {
      const value = entry.vote?.rascunho ?? entry.vote ?? {};
      const missing = [];
      if (!String(value.veredito ?? value.Veredito ?? '').trim()) missing.push('veredito');
      if (!String(value.dissertacao ?? value.comentario ?? value.Comentario ?? '').trim()) missing.push('justificativa');
      return { ...entry, missing, submitted: sent(entry.vote) && !entry.vote?.rascunho };
    });
    const pending = entries.filter(entry => entry.missing.length).length;
    const ready = completeDrafts().length;
    const submitted = entries.filter(entry => entry.submitted).length;
    showModal('Resumo de pendências', `<p>${ready} prontas para enviar · ${pending} incompletas · ${submitted} já enviadas.</p><p>Verde: resposta completa. Amarelo: faltam campos obrigatórios. Os rascunhos só contam como votos após o envio.</p>${S.draftError ? '<p role="alert">Há uma falha ao salvar um rascunho. Volte à avaliação e tente salvar novamente.</p>' : ''}<div class="nca-pending-list">${entries.map(entry => `<article class="nca-pending-row"><i aria-hidden="true" class="nca-dot ${entry.missing.length ? 'is-draft' : 'is-done'}"></i><div><strong>${esc(entry.title)}</strong><p>${entry.missing.length ? `Falta: ${entry.missing.join(' e ')}.` : entry.submitted ? 'Já enviada.' : 'Completa, aguardando envio.'}</p></div><button class="nca-button nca-button--ghost" data-pending-kind="${entry.kind}" data-pending-index="${entry.index}">${entry.missing.length ? 'Completar' : 'Revisar'}</button></article>`).join('') || '<p>Nenhuma avaliação disponível.</p>'}</div><p>${pending ? 'As avaliações incompletas continuarão como pendentes.' : 'Todas as respostas estão completas.'}</p><button id="nca-confirm-batch" class="nca-button nca-button--gold" ${!ready || S.draftError || !cycleOpen() ? 'disabled' : ''}>Confirmar envio de ${ready} avaliação(ões)</button>`);
    root.querySelectorAll('[data-pending-kind]').forEach(button => button.onclick = () => {
      if (button.dataset.pendingKind === 'promotion') {
        S.screen = 'promotions'; S.promotionFilter = 'todos'; S.selectedPromotion = Number(button.dataset.pendingIndex);
      } else {
        S.screen = 'proposals'; S.selectedProposal = Number(button.dataset.pendingIndex);
      }
      render();
    });
    document.getElementById('nca-confirm-batch').onclick = async event => {
      event.currentTarget.disabled = true;
      await submitAllDrafts(true);
      const button = document.getElementById('nca-confirm-batch');
      if (button) button.disabled = false;
    };
  }

  async function submitAllDrafts(confirmed = false) {
    if (confirmed !== true) return showPendingSummary();
    await S.saveQueue;
    if (S.draftError) return toast('Há um rascunho que não foi salvo. Tente novamente antes de enviar.', true);
    if (!cycleOpen()) return toast('O prazo de avaliação terminou.', true);
    const drafts = completeDrafts();
    if (!drafts.length) return toast('Preencha e salve pelo menos uma avaliação completa antes de enviar.', true);
    if (S.busy) return;
    S.busy = true;
    try {
      await S.saveQueue;
      await confirmForumUser();
      const batch = S.db.batch();
      drafts.forEach(({ kind, item }) => {
        const current = kind === 'promotion' ? ownPromotionVote(item) : ownProposalVote(item);
        const draft = current.rascunho;
        const id = kind === 'promotion' ? `${item.cargo}_${item.nick}_${S.nick.replace(/[^a-zA-Z0-9_]/g, '')}` : `voto_${item.ordem}_${S.nick.replace(/[^a-zA-Z0-9_]/g, '')}`;
        const ref = kind === 'promotion'
          ? S.db.collection('avaliacoes_nexus').doc(id)
          : S.db.collection('nexus_config').doc('Propostas').collection('votos_conselho').doc(id);
        const payload = kind === 'promotion'
          ? { avaliador: S.nick, avaliadorCargo: S.profile.cargo, nick_avaliado: item.nick, cargo: item.cargo, ciclo_id: S.cycle?.id || '', veredito: draft.veredito, dissertacao: draft.dissertacao, status: 'enviado', timestamp: serverTime(), finalizadoEm: serverTime(), atualizadoEm: serverTime(), rascunho: firebase.firestore.FieldValue.delete(), historico: historyOf(current, ['veredito', 'dissertacao']) }
          : { Nick: S.nick, Ordem: item.ordem, Veredito: draft.veredito, Comentario: draft.comentario, status: 'enviado', Timestamp: serverTime(), finalizadoEm: serverTime(), atualizadoEm: serverTime(), rascunho: firebase.firestore.FieldValue.delete(), historico: historyOf(current, ['Veredito', 'Comentario']) };
        batch.set(ref, payload, { merge: true });
      });
      const receipt = { id: crypto.randomUUID(), user: S.nick, cycle: S.cycle?.id || '', at: new Date().toISOString(), items: drafts.map(({ kind, item }) => { const vote = kind === 'promotion' ? ownPromotionVote(item) : ownProposalVote(item); return { title: kind === 'promotion' ? item.nick : 'Proposta ' + item.ordem, verdict: vote.rascunho.veredito, comment: vote.rascunho.dissertacao ?? vote.rascunho.comentario }; }) };
      await batch.commit();
      S.lastReceipt = receipt;
      try { localStorage.setItem('NCA_RECEIPT:' + norm(S.nick), JSON.stringify(receipt)); } catch (_) {}
      drafts.forEach(({ kind, item }) => { const current = kind === 'promotion' ? ownPromotionVote(item) : ownProposalVote(item); if (current) { const savedDraft = current.rascunho || {}; current.historico = historyOf(current, kind === 'promotion' ? ['veredito', 'dissertacao'] : ['Veredito', 'Comentario']); current.atualizadoEm = new Date().toISOString(); current.status = 'enviado'; if (kind === 'promotion') { current.veredito = savedDraft.veredito; current.dissertacao = savedDraft.dissertacao; } else { current.Veredito = savedDraft.veredito; current.Comentario = savedDraft.comentario; } current.rascunho = null; } });
      S.screen = 'home'; render(); showReceipt(receipt);
    } catch (error) { console.error(error); toast(error.message || 'Não foi possível enviar as avaliações.', true); }
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
    if (S.screen === 'leadership') return renderLeadership();
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
      if (location.hash === '#lideranca' && isLeadership()) S.screen = 'leadership';
      try { S.lastReceipt = JSON.parse(localStorage.getItem('NCA_RECEIPT:' + norm(S.nick)) || 'null'); } catch (_) {}
      render();
      recoverLocalDrafts().then(() => { if (!document.getElementById('nca-evaluation-form')) render(); });
      window.addEventListener('online', () => recoverLocalDrafts());
    } catch (error) {
      console.error(error);
      stateScreen('fa-lock', 'Acesso indisponível', error.message || 'Não foi possível abrir a Central.', true);
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { responseLabel, leadershipData, weeklyEvolution, answered, historyOf, canReadProposalVotes, hasPromotionCandidates, promotionItems, promotionIndex, licenseHistory, licenseSummary, validateSheetMonth, latestEntryDate, performanceMonthNames, filterCareerWeeks, summarizeWeeks, consultaWeeks, weekDates, weekPeriod, performancePanel, performanceWeeks, recentMetaLabel, loadPerformance, CONSULTA_SHEETS, S, norm, plain, normalizeCargo, allowedRole, sent, key, numberLabel, percentLabel, bestWeekLabel };
  } else {
    root = document.getElementById('app') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'app' }));
    init();
  }
})();
