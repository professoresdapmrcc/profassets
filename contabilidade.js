(() => {
  'use strict';
  if (!document.getElementById('accounting-app')) return;

  const CONFIG = Object.freeze({
    workerProxy: 'https://nexus.nexusdevrcc.workers.dev/',
    nexusApi: 'https://script.google.com/macros/s/AKfycbxwJPauO1fizPCgI5zfkpZSP58KSNJEVbFdX0-w8J4ZtOisV6cleL4J3Ep_gW432JyhmQ/exec',
    warningTopicId: '32246',
    warningSubject: '[PROF] Advertência Interna por Meta Negativa LEIA!',
    postIntervalMs: 3500,
    storageKey: 'CONTABILIDADE_PROF_V1',
    sendStorageKey: 'CONTABILIDADE_PROF_ENVIOS_V1',
    themeKey: 'CONTABILIDADE_PROF_THEME'
  });

  const ROLE_CONFIG = Object.freeze({
    professores: {
      label: 'Professores', cargo: 'Professor(a)', icon: 'ti-school',
      description: 'Analise CRO, CAC, CAP e ACL com os mesmos pesos da planilha da Contabilidade.',
      columns: ['Nick', 'CRO', 'CAC', 'CAP', 'ACL', 'Total (%)', 'Status', 'Motivo'],
      inputColumns: ['Nick', 'CRO', 'CAC', 'CAP', 'ACL'],
      help: 'Ordem aceita: Nick, CRO, CAC, CAP e ACL. Se a origem trouxer Total (%), o valor original será preservado.',
      placeholder: 'Nick\tCRO\tCAC\tCAP\tACL\nGarfarDias\t2\t15\t7\t2',
      example: 'Nick\tCRO\tCAC\tCAP\tACL\tTotal (%)\nGarfarDias\t2\t15\t7\t2\t1375%\nmirinha345\t2\t7\t3\t3\t725%\nItsmebiell\t0\t4\t4\t1\t445%\nmick244\t1\t5\t1\t1\t390%\nBe0002\t1\t1\t1\t0\t145%\nDanzyon\t0\t1\t1\t0\t100%\nTioJesse\t0\t2\t0\t0\t100%\nx-arthurlin\t0\t1\t1\t0\t100%\n902938garra\t1\t0\t1\t0\t95%\nJoca..\t0\t0\t0\t2\t90%\nAntecanis\t0\t0\t1\t0\t50%\nLooysx\t0\t1\t0\t0\t50%\nSah-.-3\t0\t1\t0\t0\t50%',
      recentDays: 8
    },
    coordenadores: {
      label: 'Coordenadores', cargo: 'Coordenador(a)', icon: 'ti-user-star',
      description: 'Registre a Carta de Auxílio e as atividades de acompanhamento, orientação, COP e CDA.',
      columns: ['Nick', 'Carta de Auxílio', 'Acompanhamentos', 'Orientações', 'COP', 'CDA', 'Total (%)', 'Status', 'Motivo'],
      inputColumns: ['Nick', 'Carta de Auxílio', 'Acompanhamentos', 'Orientações', 'COP', 'CDA'],
      help: 'Ordem aceita: Nick, Carta de Auxílio, Acompanhamentos, Orientações, COP e CDA.',
      placeholder: 'Nick\tCarta de Auxílio\tAcompanhamentos\tOrientações\tCOP\tCDA\nJoca..\tENVIADA\t0\t0\t5\t4',
      example: 'Nick\tCarta de Auxílio\tAcompanhamentos\tOrientações\tCOP\tCDA\tTotal (%)\nJoca..\tENVIADA\t0\t0\t5\t4\t450%\nGustavo010364\tENVIADA\t1\t0\t2\t1\t200%\nBarbaluxe\tENVIADA\t1\t0\t1\t0\t100%\nDeimoos\tENVIADA\t0\t0\t1\t1\t100%\nElzumbi\tENVIADA\t0\t0\t0\t2\t100%\nLauzinho\tENVIADA\t1\t1\t0\t0\t100%\n.Brendon\tENVIADA\t0\t0\t0\t0\t0%\nLkzspd\tNÃO ENVIADA\t0\t0\t0\t0\t0%\nIsaac.Machado\tNÃO ENVIADA\t0\t0\t0\t0\t0%',
      recentDays: 8
    },
    graduadores: {
      label: 'Graduadores', cargo: 'Graduador(a)', icon: 'ti-certificate',
      description: 'Some Graduação I e Graduação II, destacando o maior resultado do período.',
      columns: ['Nick', 'Grad. I', 'Grad. II', 'Total', 'Status', 'Motivo'],
      inputColumns: ['Nick', 'Grad. I', 'Grad. II'],
      help: 'Ordem aceita: Nick, Grad. I e Grad. II. O maior total elegível recebe o status Melhor.',
      placeholder: 'Nick\tGrad. I\tGrad. II\nPanikiller\t8\t2',
      example: 'Nick\tGrad. I\tGrad. II\nPanikiller\t8\t2\nGraduadorRegular\t2\t0\nGraduadorTeste\t0\t0',
      recentDays: 15
    }
  });

  const state = {
    nick: '', nexusRows: new Map(), nexusHeaders: [], nexusReady: false,
    results: { professores: [], coordenadores: [], graduadores: [] },
    raw: { professores: '', coordenadores: '', graduadores: '' },
    warnings: [], reviewIds: [], posting: false, testMode: !/(^|\.)policiarcc\.com$/i.test(location.hostname)
  };

  const $ = id => document.getElementById(id);
  const clean = value => String(value ?? '').trim();
  const normalize = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('pt-BR');
  const key = value => normalize(value).replace(/[^A-Z0-9]/g, '');
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
  const sleep = milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds));
  const avatar = nick => `https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(nick)}&direction=2&head_direction=3&gesture=sml&size=m&headonly=1`;

  function toast(message, type = 'info') {
    const labels = { success:'Sucesso', error:'Erro', warning:'Atenção', info:'Informação' };
    const icons = { success:'ti-circle-check', error:'ti-circle-x', warning:'ti-alert-triangle', info:'ti-info-circle' };
    const element = document.createElement('div');
    element.className = 'toast'; element.dataset.type = type;
    element.innerHTML = `<i class="ti ${icons[type] || icons.info}"></i><div><strong>${labels[type] || labels.info}</strong><span>${esc(message)}</span></div>`;
    $('toast-container').append(element);
    window.setTimeout(() => element.remove(), type === 'error' ? 7200 : 5000);
  }

  function setBusy(button, enabled, label = 'Processando…') {
    if (!button) return;
    if (enabled) {
      button.dataset.original = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `<span class="button-loader"></span>${esc(label)}`;
    } else {
      button.disabled = false;
      if (button.dataset.original) button.innerHTML = button.dataset.original;
      delete button.dataset.original;
    }
  }

  function persist() {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify({
        raw: state.raw, results: state.results,
        periodStart: $('period-start').value, periodEnd: $('period-end').value
      }));
    } catch (_) {}
  }

  function loadPersisted() {
    try {
      const data = JSON.parse(localStorage.getItem(CONFIG.storageKey) || '{}');
      if (data.raw) state.raw = { ...state.raw, ...data.raw };
      if (data.results) state.results = { ...state.results, ...data.results };
      $('period-start').value = clean(data.periodStart);
      $('period-end').value = clean(data.periodEnd);
    } catch (_) {}
  }

  function sentStates() {
    try { return JSON.parse(localStorage.getItem(CONFIG.sendStorageKey) || '{}') || {}; }
    catch (_) { return {}; }
  }

  function saveWarningState(warning) {
    const saved = sentStates();
    saved[warning.id] = { topicSent: warning.topicSent, privateSent: warning.privateSent, attachment: warning.attachment };
    localStorage.setItem(CONFIG.sendStorageKey, JSON.stringify(saved));
  }

  function defaultPeriod() {
    if ($('period-start').value && $('period-end').value) return;
    const now = new Date(), day = now.getDay(), end = new Date(now);
    end.setDate(now.getDate() - ((day + 1) % 7));
    const start = new Date(end); start.setDate(end.getDate() - 6);
    const iso = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    $('period-start').value = iso(start); $('period-end').value = iso(end);
  }

  function buildRoleViews() {
    const template = $('role-view-template');
    Object.entries(ROLE_CONFIG).forEach(([role, config]) => {
      const view = $(`view-${role}`), fragment = template.content.cloneNode(true);
      fragment.querySelector('.role-title').textContent = `${config.label}.`;
      fragment.querySelector('.role-description').textContent = config.description;
      fragment.querySelector('.role-eyebrow').textContent = `Consulta de eficiência · ${config.label}`;
      fragment.querySelector('.input-label').textContent = `Dados de ${config.label} *`;
      fragment.querySelector('.input-help').textContent = config.help;
      fragment.querySelector('.role-input').placeholder = config.placeholder;
      fragment.querySelector('.role-input').value = state.raw[role] || '';
      fragment.querySelector('.result-title').textContent = `Tabela de ${config.label}`;
      fragment.querySelector('.process-role').dataset.role = role;
      fragment.querySelector('.copy-table').dataset.role = role;
      fragment.querySelector('.load-example').dataset.role = role;
      fragment.querySelector('.role-input').dataset.role = role;
      fragment.querySelector('.result-table').dataset.role = role;
      view.append(fragment);
    });
  }

  function navigate(view) {
    const target = $(`view-${view}`) ? view : 'inicio';
    document.querySelectorAll('.view').forEach(section => { section.hidden = section.id !== `view-${target}`; });
    document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === target));
    const labels = { inicio:'Visão geral', professores:'Eficiência · Professores', coordenadores:'Eficiência · Coordenadores', graduadores:'Eficiência · Graduadores', advertencias:'Advertências' };
    $('page-label').textContent = labels[target];
    location.hash = target;
    $('sidebar').classList.remove('open');
    document.querySelector('.stage').scrollTop = 0;
  }

  function setTheme(theme, save = false) {
    const value = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = value;
    $('theme-button').innerHTML = `<i class="ti ${value === 'dark' ? 'ti-sun' : 'ti-moon'}"></i>`;
    document.querySelector('meta[name=theme-color]').content = value === 'dark' ? '#0f0512' : '#821f88';
    if (save) localStorage.setItem(CONFIG.themeKey, value);
  }

  function validNick(value) {
    const nick = clean(value);
    return nick && !['CONVIDADO','GUEST','ANONYMOUS','ANONIMO'].includes(normalize(nick)) ? nick : '';
  }

  function decodeForumValue(value) {
    const decoded = clean(value).replace(/\\x([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex,16))).replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex,16))).replace(/\\(['"\\])/g, '$1');
    const area = document.createElement('textarea'); area.innerHTML = decoded;
    return validNick(area.value);
  }

  async function forumNick() {
    const data = window._userdata || {}, direct = validNick(data.username);
    if (direct && Number(data.session_logged_in) !== 0 && Number(data.user_id) !== -1) return direct;
    const response = await fetch('/forum', { credentials:'same-origin', cache:'no-store' });
    if (!response.ok) throw new Error(`O fórum respondeu com HTTP ${response.status}.`);
    const html = await response.text();
    const patterns = [/_userdata\s*\[\s*['"]username['"]\s*\]\s*=\s*['"]([^'"]+)['"]/i, /_userdata\.username\s*=\s*['"]([^'"]+)['"]/i, /["']username["']\s*:\s*["']([^"']+)["']/i];
    for (const pattern of patterns) { const match = html.match(pattern), nick = match ? decodeForumValue(match[1]) : ''; if (nick) return nick; }
    throw new Error('Não foi possível identificar a conta conectada ao fórum.');
  }

  function workerUrl(target) { const url = new URL(CONFIG.workerProxy); url.searchParams.set('url', target); return url.toString(); }

  async function syncNexus(force = false) {
    const button = $('sync-nexus'), source = $('nexus-state');
    setBusy(button, true, ''); source.dataset.state = 'loading'; source.querySelector('i').className = 'ti ti-loader-2'; source.querySelector('strong').textContent = 'Sincronizando NexusList';
    if (state.testMode) {
      ingestMockNexus();
      state.nick = 'Prévia local';
      $('current-nick').textContent = state.nick;
      source.dataset.state = 'preview';
      source.querySelector('i').className = 'ti ti-device-desktop';
      source.querySelector('strong').textContent = `${state.nexusRows.size} membros simulados`;
      button.title = 'A NexusList é sincronizada quando a página está hospedada no fórum';
      setBusy(button, false);
      Object.keys(ROLE_CONFIG).forEach(role => { if (clean(state.raw[role])) processRole(role,{quiet:true}); });
      if (force) toast('Você está no simulador local. A NexusList e os envios reais serão ativados somente dentro do fórum.', 'info');
      return;
    }
    try {
      if (!state.nick) state.nick = await forumNick();
      $('current-nick').textContent = state.nick;
      $('current-avatar').src = avatar(state.nick);
      const target = new URL(CONFIG.nexusApi); target.searchParams.set('action', 'bootstrap'); target.searchParams.set('username', state.nick);
      if (force) { target.searchParams.set('force','1'); target.searchParams.set('_',String(Date.now())); }
      const response = await fetch(workerUrl(target.toString()), { cache:'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.ok || !payload.data) throw new Error(payload.error || 'A NexusList não retornou dados válidos.');
      ingestNexus(payload.data);
      source.dataset.state = 'ready'; source.querySelector('i').className = 'ti ti-circle-check'; source.querySelector('strong').textContent = `${state.nexusRows.size} membros carregados`;
      toast('Dados funcionais e licenças atualizados.', 'success');
      Object.keys(ROLE_CONFIG).forEach(role => { if (state.results[role].length) processRole(role, { quiet:true }); });
    } catch (error) {
      state.nexusReady = false;
      source.dataset.state = 'error'; source.querySelector('i').className = 'ti ti-alert-circle'; source.querySelector('strong').textContent = 'Sincronização indisponível';
      if (!state.nick) { $('current-nick').textContent = 'Sessão não identificada'; }
      toast(`${error.message} A consulta pode ser montada, mas casos especiais devem ser conferidos.`, 'warning');
    } finally { setBusy(button, false); }
  }

  function ingestNexus(data) {
    state.nexusHeaders = Array.isArray(data.headers) ? data.headers.map(key) : [];
    state.nexusRows.clear();
    (Array.isArray(data.rows) ? data.rows : []).forEach(row => {
      const values = ['values','source','saved'].map(field => row && Array.isArray(row[field]) ? row[field] : null).find(list => list && list.some(value => clean(value))) || [];
      const record = {};
      state.nexusHeaders.forEach((header,index) => { if (header && record[header] === undefined) record[header] = values[index]; });
      const nick = field(record, ['NICKNAME','NICK','USUARIO']);
      if (clean(nick)) state.nexusRows.set(normalize(nick), record);
    });
    state.nexusReady = state.nexusRows.size > 0;
  }

  function ingestMockNexus() {
    const oldDate = '01/01/2026', recentDate = new Intl.DateTimeFormat('pt-BR').format(new Date());
    const records = [
      ['GarfarDias','Professor(a)','ATIVO',oldDate],['mirinha345','Professor(a)','ATIVO',oldDate],
      ['Itsmebiell','Professor(a)','ATIVO',oldDate],['mick244','Professor(a)','ATIVO',oldDate],
      ['Be0002','Professor(a)','ATIVO',oldDate],['Danzyon','Professor(a)','ATIVO',oldDate],
      ['TioJesse','Professor(a)','ATIVO',oldDate],['x-arthurlin','Professor(a)','ATIVO',oldDate],
      ['902938garra','Professor(a)','ATIVO',recentDate],['Antecanis','Professor(a)','ATIVO',recentDate],
      ['Looysx','Professor(a)','ATIVO',recentDate],['onicin','Professor(a)','LICENÇA',oldDate],
      ['VitorJoaquin','Professor(a)','LICENÇA',oldDate],['nqqz','Professor(a)','ATIVO',recentDate],
      ['gowther616','Professor(a)','ATIVO',recentDate],['Kimcho','Professor(a)','ATIVO',oldDate],
      ['BlueSkies.','Professor(a)','ATIVO',oldDate],['Joca..','Coordenador(a)','ATIVO',oldDate],
      ['Gustavo010364','Coordenador(a)','ATIVO',oldDate],['Barbaluxe','Coordenador(a)','ATIVO',oldDate],
      ['Deimoos','Coordenador(a)','ATIVO',oldDate],['Elzumbi','Coordenador(a)','ATIVO',oldDate],
      ['Lauzinho','Coordenador(a)','ATIVO',oldDate],['.Brendon','INATIVO','INATIVO',oldDate],
      ['Lkzspd','Coordenador(a)','LICENÇA',oldDate],['Isaac.Machado','Coordenador(a)','ATIVO',oldDate],
      ['Panikiller','Graduador(a)','ATIVO',oldDate],
      ['GraduadorRegular','Graduador(a)','ATIVO',oldDate],['GraduadorTeste','Graduador(a)','ATIVO',oldDate],
      ['Sah-.-3','INATIVO','INATIVO',oldDate]
    ];
    state.nexusRows.clear();
    records.forEach(([nick,cargo,status,entrada]) => state.nexusRows.set(normalize(nick), { NICKNAME:nick, CARGO:cargo, STATUS:status, ENTRADA:entrada, DATAPROMOREB:entrada }));
    state.nexusReady = true;
  }

  function field(record, candidates) {
    for (const candidate of candidates) {
      const exact = record[key(candidate)]; if (exact !== undefined && clean(exact) !== '') return exact;
      const found = Object.keys(record).find(header => header.includes(key(candidate))); if (found && clean(record[found]) !== '') return record[found];
    }
    return '';
  }

  function parseDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    const text = clean(value); if (!text) return null;
    const br = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/); if (br) return new Date(Number(br[3]),Number(br[2])-1,Number(br[1]),12);
    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (iso) return new Date(Number(iso[1]),Number(iso[2])-1,Number(iso[3]),12);
    const parsed = new Date(text); return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function daysSince(value) {
    const date = parseDate(value), reference = parseDate($('period-end').value) || new Date();
    return date ? Math.floor((reference.getTime() - date.getTime()) / 86400000) : Infinity;
  }

  function currentRoleReason(current, expected) {
    const role = normalize(current);
    if (!role) return 'INATIVO';
    if (role.includes(normalize(expected.replace('(a)','')))) return '';
    if (role.includes('COORDENADOR')) return 'COORDENADOR';
    if (role.includes('GRADUADOR')) return 'GRADUADOR';
    if (role.includes('CONSELHEIRO')) return 'CONSELHO';
    if (role.includes('ESTAGIARIO')) return 'ESTAGIÁRIO';
    if (role.includes('LIDER') || role.includes('LIDERANCA')) return 'LIDERANÇA';
    return 'INATIVO';
  }

  function nexusException(nick, role, belowGoal) {
    if (!state.nexusReady) return '';
    const config = ROLE_CONFIG[role], record = state.nexusRows.get(normalize(nick));
    if (!record) return 'INATIVO';
    const mismatch = currentRoleReason(field(record,['CARGO','FUNCAO']), config.cargo);
    if (mismatch) return mismatch;
    const graduation = normalize(field(record,['GRADUACAO','STATUSGRADUACAO']));
    const functionalStatus = normalize(field(record,['STATUS','SITUACAO']));
    const licenseDays = clean(field(record,['DIASDELICENCA','DIASLICENCA']));
    if (functionalStatus.includes('INATIVO') || functionalStatus.includes('DESLIGADO')) return 'INATIVO';
    if (!belowGoal) return '';
    if (graduation.includes('PENDENTE')) return 'GRADUAÇÃO PENDENTE';
    if (functionalStatus.includes('LICENCA') || licenseDays) return 'LICENÇA';
    const entry = field(record,['ENTRADA','DATADEENTRADA']);
    const promotion = field(record,['DATAPROMOREB','PROMOREBAIX','DATAPROMOCAO','PROMOCAO','DATADEGRADUACAO']);
    if (daysSince(entry) < config.recentDays || daysSince(promotion) < config.recentDays) return role === 'coordenadores' ? 'GRADUAÇÃO RECENTE' : role === 'graduadores' ? 'PROMOÇÃO RECENTE' : 'ADAPTAÇÃO';
    const returnLeave = normalize(field(record,['RL','RETORNODELICENCA']));
    if (['SIM','TRUE','1'].includes(returnLeave)) return 'RETORNO DE LICENÇA';
    return '';
  }

  function splitRows(text) {
    return clean(text).split(/\r?\n/).map(line => {
      if (line.includes('\t')) return line.split('\t').map(clean);
      if (line.includes(';')) return line.split(';').map(clean);
      return line.trim().split(/\s{2,}/).map(clean);
    }).filter(row => row.some(Boolean));
  }

  function headerIndex(headers, names) {
    const normalized = headers.map(key);
    for (const name of names) { const index = normalized.findIndex(header => header === key(name) || header.includes(key(name))); if (index >= 0) return index; }
    return -1;
  }

  function parseNumber(value) {
    const text = clean(value).replace(/%/g,'').replace(/\s/g,'').replace(',','.');
    const number = Number(text); return Number.isFinite(number) ? number : 0;
  }

  function parseRoleRows(role, text) {
    const rows = splitRows(text); if (!rows.length) return [];
    const config = ROLE_CONFIG[role], first = rows[0];
    const hasHeader = first.some(cell => ['NICK','NICKNAME','CRO','CARTADEAUXILIO','GRADI','GRADII'].some(name => key(cell) === name));
    const headers = hasHeader ? first : config.inputColumns;
    const body = hasHeader ? rows.slice(1) : rows;
    const aliases = {
      nick:['NICK','NICKNAME'], cro:['CRO'], cac:['CAC'], cap:['CAP'], acl:['ACL'],
      carta:['CARTA DE AUXÍLIO','CARTA'], acompanhamentos:['ACOMPANHAMENTOS','ACOMPANHAMENTO'], orientacoes:['ORIENTAÇÕES','ORIENTACOES','ORIENTAÇÃO'], cop:['COP'], cda:['CDA'], total:['TOTAL (%)','TOTAL','PORCENTAGEM'],
      grad1:['GRAD. I','GRAD I','GRAD.I','GRADUAÇÃO I'], grad2:['GRAD. II','GRAD II','GRAD.II','GRADUAÇÃO II']
    };
    const index = {}; Object.entries(aliases).forEach(([name,names]) => { index[name] = headerIndex(headers,names); });
    return body.map(cells => {
      const take = name => index[name] >= 0 ? clean(cells[index[name]]) : '';
      const nick = take('nick').replace(/[^a-zA-Z0-9_.:\-?!,]/g,'');
      if (!nick || normalize(nick) === 'TOTAL') return null;
      const suppliedTotal = take('total'), sourceTotal = suppliedTotal ? (suppliedTotal.includes('%') ? parseNumber(suppliedTotal)/100 : parseNumber(suppliedTotal)) : null;
      if (role === 'professores') return { nick, cro:parseNumber(take('cro')), cac:parseNumber(take('cac')), cap:parseNumber(take('cap')), acl:parseNumber(take('acl')), sourceTotal };
      if (role === 'coordenadores') return { nick, carta:normalize(take('carta')).includes('NAO') ? 'NÃO ENVIADA' : 'ENVIADA', acompanhamentos:parseNumber(take('acompanhamentos')), orientacoes:parseNumber(take('orientacoes')), cop:parseNumber(take('cop')), cda:parseNumber(take('cda')), sourceTotal };
      return { nick, grad1:parseNumber(take('grad1')), grad2:parseNumber(take('grad2')) };
    }).filter(Boolean);
  }

  function classify(role, rows) {
    const preliminary = rows.map(row => {
      if (role === 'professores') {
        const total = Number.isFinite(row.sourceTotal) ? row.sourceTotal : row.cro * .45 + row.cac * .5 + row.cap * .5 + row.acl * .45;
        const baseStatus = total >= 3.5 ? 'EXCELENTE' : total >= 1.55 ? 'ÓTIMO' : total >= 1 ? 'REGULAR' : 'IRREGULAR';
        const reason = nexusException(row.nick, role, total < 1);
        return { ...row, total, status:reason ? 'CASO ESPECIAL' : baseStatus, motivo:reason };
      }
      if (role === 'coordenadores') {
        const total = Number.isFinite(row.sourceTotal) ? row.sourceTotal : (row.acompanhamentos + row.orientacoes + row.cop + row.cda) * .5;
        const failed = total < 1 || row.carta === 'NÃO ENVIADA';
        const baseStatus = !failed ? (total >= 2 ? 'EXCELENTE' : total >= 1.25 ? 'ÓTIMO' : 'REGULAR') : 'IRREGULAR';
        const reason = nexusException(row.nick, role, failed);
        return { ...row, total, status:reason ? 'CASO ESPECIAL' : baseStatus, motivo:reason };
      }
      const total = row.grad1 + row.grad2, reason = nexusException(row.nick, role, total < 2);
      return { ...row, total, status:reason ? 'CASO ESPECIAL' : total >= 2 ? 'REGULAR' : 'IRREGULAR', motivo:reason };
    });
    if (role === 'graduadores') {
      const eligible = preliminary.filter(row => row.status === 'REGULAR');
      const maximum = eligible.length ? Math.max(...eligible.map(row => row.total)) : -1;
      preliminary.forEach(row => { if (row.status === 'REGULAR' && row.total === maximum && maximum >= 2) row.status = 'MELHOR'; });
    }
    const rank = { EXCELENTE:1, MELHOR:1, 'ÓTIMO':2, REGULAR:3, 'CASO ESPECIAL':4, IRREGULAR:5 };
    return preliminary.sort((a,b) => (rank[a.status]-rank[b.status]) || (b.total-a.total) || a.nick.localeCompare(b.nick,'pt-BR'));
  }

  function mergeMemberRoster(role, submittedRows) {
    if (!state.nexusReady) return submittedRows;
    const config = ROLE_CONFIG[role], byNick = new Map(submittedRows.map(row => [normalize(row.nick), row]));
    state.nexusRows.forEach(record => {
      const nick = clean(field(record,['NICKNAME','NICK','USUARIO']));
      const cargo = field(record,['CARGO','FUNCAO']);
      if (!nick || currentRoleReason(cargo,config.cargo) !== '' || byNick.has(normalize(nick))) return;
      if (role === 'professores') byNick.set(normalize(nick),{nick,cro:0,cac:0,cap:0,acl:0});
      else if (role === 'coordenadores') byNick.set(normalize(nick),{nick,carta:'NÃO ENVIADA',acompanhamentos:0,orientacoes:0,cop:0,cda:0});
      else byNick.set(normalize(nick),{nick,grad1:0,grad2:0});
    });
    return [...byNick.values()];
  }

  function processRole(role, options = {}) {
    const view = $(`view-${role}`), input = view.querySelector('.role-input');
    const raw = input.value; state.raw[role] = raw;
    if (!clean(raw)) { if (!options.quiet) toast(`Cole os dados de ${ROLE_CONFIG[role].label}.`, 'warning'); return; }
    const rows = mergeMemberRoster(role,parseRoleRows(role,raw));
    if (!rows.length) { if (!options.quiet) toast('Nenhuma linha válida foi identificada. Confira as colunas.', 'error'); return; }
    state.results[role] = classify(role, rows);
    persist(); renderRole(role); rebuildWarnings(); updateSummaries();
    if (!options.quiet) toast(`Consulta de ${ROLE_CONFIG[role].label} gerada com ${rows.length} membro(s).`, 'success');
  }

  function outputRow(role, row) {
    if (role === 'professores') return [row.nick,row.cro,row.cac,row.cap,row.acl,`${Math.round(row.total*100)}%`,row.status,row.status === 'CASO ESPECIAL' ? row.motivo : ''];
    if (role === 'coordenadores') return [row.nick,row.carta,row.acompanhamentos,row.orientacoes,row.cop,row.cda,`${Math.round(row.total*100)}%`,row.status,row.status === 'CASO ESPECIAL' ? row.motivo : ''];
    return [row.nick,row.grad1,row.grad2,row.total,row.status,row.status === 'CASO ESPECIAL' ? row.motivo : ''];
  }

  function statusClass(status) { return normalize(status).toLocaleLowerCase('pt-BR').replace(/\s+/g,'-').normalize('NFD').replace(/[\u0300-\u036f]/g,''); }

  function renderRole(role) {
    const view = $(`view-${role}`), config = ROLE_CONFIG[role], results = state.results[role] || [], table = view.querySelector('.result-table');
    table.querySelector('thead').innerHTML = results.length ? `<tr>${config.columns.map(column => `<th>${esc(column)}</th>`).join('')}</tr>` : '';
    table.querySelector('tbody').innerHTML = results.map(row => `<tr>${outputRow(role,row).map((value,index) => {
      const statusIndex = config.columns.indexOf('Status'), numeric = index > 0 && index < statusIndex;
      return `<td class="${numeric?'numeric':''}">${index === statusIndex ? `<span class="status-pill ${statusClass(value)}">${esc(value)}</span>` : esc(value)}</td>`;
    }).join('')}</tr>`).join('');
    table.hidden = results.length === 0;
    view.querySelector('.empty-table').hidden = results.length > 0;
    view.querySelector('.copy-table').disabled = !results.length;
    const counts = status => results.filter(row => row.status === status).length;
    view.querySelector('.metric-total').textContent = results.length;
    view.querySelector('.metric-best').textContent = counts('EXCELENTE') + counts('MELHOR');
    view.querySelector('.metric-regular').textContent = counts('ÓTIMO') + counts('REGULAR');
    view.querySelector('.metric-special').textContent = counts('CASO ESPECIAL');
    view.querySelector('.metric-irregular').textContent = counts('IRREGULAR');
  }

  async function copyRole(role) {
    const results = state.results[role], config = ROLE_CONFIG[role]; if (!results.length) return;
    const text = [config.columns, ...results.map(row => outputRow(role,row))].map(row => row.join('\t')).join('\n');
    try { await navigator.clipboard.writeText(text); toast('Consulta copiada em colunas para a área de transferência.', 'success'); }
    catch (_) { const area = document.createElement('textarea'); area.value=text; document.body.append(area); area.select(); document.execCommand('copy'); area.remove(); toast('Consulta copiada.', 'success'); }
  }

  function loadExample(role) {
    const config = ROLE_CONFIG[role], input = $(`view-${role}`).querySelector('.role-input');
    input.value = config.example;
    state.raw[role] = config.example;
    processRole(role);
  }

  function warningId(role, nick) { return `${role}|${normalize(nick)}|${$('period-start').value}|${$('period-end').value}`; }

  function rebuildWarnings() {
    const previous = new Map(state.warnings.map(item => [item.id,item])), saved = sentStates(), warnings = [];
    Object.entries(state.results).forEach(([role,rows]) => rows.filter(row => row.status === 'IRREGULAR').forEach(row => {
      const id = warningId(role,row.nick), old = previous.get(id) || saved[id] || {};
      warnings.push({ id, role, nick:row.nick, cargo:ROLE_CONFIG[role].cargo, attachment:clean(old.attachment), topicSent:old.topicSent===true, privateSent:old.privateSent===true });
    }));
    state.warnings = warnings; renderWarnings();
  }

  function warningStateText(item) {
    if (item.topicSent && item.privateSent) return 'Tópico e MP concluídos';
    if (item.topicSent) return 'Tópico publicado · MP pendente';
    if (item.privateSent) return 'MP enviada · tópico pendente';
    return 'Aguardando print e confirmação';
  }

  function renderWarnings() {
    const grid = $('warning-grid');
    if (!state.warnings.length) grid.innerHTML = '<div class="empty-warnings"><i class="ti ti-shield-check"></i><strong>Nenhum membro irregular</strong><small>As advertências aparecerão aqui após o processamento das consultas.</small></div>';
    else grid.innerHTML = state.warnings.map(item => {
      const complete = item.topicSent && item.privateSent;
      return `<article class="warning-card-item ${complete?'complete':''}" data-warning-id="${esc(item.id)}"><div class="warning-member"><img src="${avatar(item.nick)}" alt="Cabeça de ${esc(item.nick)}"><span><strong>${esc(item.nick)}</strong><small>${esc(item.cargo)} · Não cumpriu a meta semanal</small></span></div><label><span>Link do print comprobatório *</span><input class="warning-attachment" type="url" value="${esc(item.attachment)}" placeholder="https://i.imgur.com/exemplo.png" ${complete?'readonly':''}></label><div class="send-state"><i class="ti ${complete?'ti-circle-check':'ti-clock'}"></i><span>${esc(warningStateText(item))}</span></div><div class="warning-actions"><button class="secondary-button preview-warning" type="button" ${complete?'disabled':''}><i class="ti ti-eye"></i> Revisar envio</button></div></article>`;
    }).join('');
    updateWarningCounts();
  }

  function updateWarningCounts() {
    const pending = state.warnings.filter(item => !(item.topicSent && item.privateSent)).length;
    $('warning-nav-count').textContent = pending; $('warning-hero-count').textContent = `${pending} pendência${pending===1?'':'s'}`;
    $('summary-advertencias').textContent = pending ? `${pending} aguardando revisão` : 'Nenhuma pendência';
    $('review-warnings').disabled = pending === 0;
  }

  function updateSummaries() {
    Object.keys(ROLE_CONFIG).forEach(role => {
      const rows = state.results[role], irregular = rows.filter(row => row.status === 'IRREGULAR').length;
      $(`summary-${role}`).textContent = rows.length ? `${rows.length} membros · ${irregular} irregular${irregular===1?'':'es'}` : 'Aguardando dados';
    });
  }

  function validUrl(value) { try { const url = new URL(clean(value)); return ['http:','https:'].includes(url.protocol) ? url.href : ''; } catch (_) { return ''; } }

  function postingDate() { return new Intl.DateTimeFormat('pt-BR',{ timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric' }).format(new Date()); }

  function warningPeriod() {
    const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const format = value => {
      const date = parseDate(value);
      return date ? `${String(date.getDate()).padStart(2,'0')} ${months[date.getMonth()]} ${date.getFullYear()}` : '';
    };
    const start = format($('period-start').value), end = format($('period-end').value);
    return start && end ? `${start} a ${end}` : start || end || 'período analisado';
  }

  function negativeMedals(cargo) {
    if (normalize(cargo).includes('GRADUADOR')) return 25;
    return 10;
  }

  function warningTopicBBCode(item) {
    return `[font=Poppins][size=18][center][color=#560c7e][b]ADVERTÊNCIA INTERNA[/b][/color][/center][/size]\n\n[justify][b]Cargo e nick do(a) advertido(a):[/b] ${item.cargo} ${item.nick}\n[b]Motivo(s):[/b] Não cumprimento da meta semanal como ${item.cargo}\n[b]Data:[/b] ${postingDate()}\n[b]Permissão:[/b] Conselho da Contabilidade\n[/justify][/font]`;
  }

  function warningPrivateBBCode(item) {
    return `[font=Poppins]<div style="border:1.5rem solid #821F88;border-radius:8px;font-family:Poppins;">[table][tr][td][center][img]https://i.imgur.com/hU7bn8R.gif[/img][/center]\n[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][center][img]https://1.bp.blogspot.com/-B9E3PHlTarQ/WKKCvnOjK_I/AAAAAAAA000/7zCNpKFgyhI8SXCbJsXUIoQalokpydSJwCPcB/s1600/BR889.gif[/img][/center][size=20][font=Poppins][color=white][b]CARTA DE ADVERTÊNCIA INTERNA[/b][/color][/font][/size][/td][/tr][/table]<div style="padding:1.5%;border:1px solid #bdbdbd;border-radius:8px;">[justify]Saudações, [b]${item.nick}[/b].\n\nInforma-se que você [b]recebeu uma advertência interna, resultando na penalidade de ${negativeMedals(item.cargo)} medalhas negativas[/b] pelo seguinte motivo:\n\n[b]Não cumprimento da meta semanal no período ${warningPeriod()}[/b]\n\n[color=#821F88][b]COMENTÁRIOS:[/b][/color] Não cumprimento da meta semanal como ${item.cargo}.\n[color=#821F88][b]ANEXOS:[/b][/color] ${item.attachment}\n\nLeia as documentações que regem a companhia [url=https://sites.google.com/view/nexusprof/documenta%C3%A7%C3%B5es?authuser=3]clicando aqui[/url] e procure manter-se atento para evitar mais punições. Caso queira recorrer da punição recebida, procure a Liderança apresentando argumentos factuais e plausíveis.[/justify]</div>[/td][/tr][/table]</div>[/font]\n[font=Poppins][center]Atentamente,\n[img]https://i.imgur.com/1kZvQHs.png[/img][/center][/font]`;
  }

  function captureAttachments() {
    document.querySelectorAll('[data-warning-id]').forEach(card => {
      const item = state.warnings.find(entry => entry.id === card.dataset.warningId);
      if (item && !(item.topicSent && item.privateSent)) { item.attachment = clean(card.querySelector('.warning-attachment').value); saveWarningState(item); }
    });
  }

  function openReview(ids) {
    captureAttachments();
    const items = state.warnings.filter(item => ids.includes(item.id) && !(item.topicSent && item.privateSent));
    if (!items.length) { toast('Não há advertências pendentes nessa seleção.', 'warning'); return; }
    const invalid = items.find(item => !validUrl(item.attachment));
    if (invalid) { toast(`Informe um link de print válido para ${invalid.nick}.`, 'warning'); return; }
    state.reviewIds = items.map(item => item.id);
    $('review-list').innerHTML = items.map(item => `<article class="review-item"><header><h3>${esc(item.nick)}</h3><span>${esc(item.cargo)}</span></header><details><summary>Ver postagem do tópico</summary><pre>${esc(warningTopicBBCode(item))}</pre></details><details><summary>Ver mensagem privada</summary><pre>${esc(warningPrivateBBCode(item))}</pre></details></article>`).join('');
    $('review-dialog').showModal();
  }

  async function forumSubmit(path, data) {
    if (state.testMode) {
      await sleep(650);
      console.info('[SIMULADOR CONTABILIDADE]', path, { ...data, message:'BBCode omitido no console do simulador.' });
      return { ok:true, simulated:true };
    }
    if (!/^https?:$/.test(location.protocol)) throw new Error('Abra esta página dentro do fórum para realizar os envios reais.');
    const body = new URLSearchParams(); Object.entries(data).forEach(([name,value]) => body.append(name,clean(value)));
    const response = await fetch(path,{ method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:body.toString(),redirect:'follow' });
    if (!response.ok) throw new Error(`O fórum recusou ${path} (HTTP ${response.status}).`);
    return response;
  }

  async function sendWarning(item) {
    if (!item.topicSent) {
      await forumSubmit('/post',{ t:CONFIG.warningTopicId,message:warningTopicBBCode(item),mode:'reply',post:'Enviar' });
      item.topicSent = true; saveWarningState(item); renderWarnings();
      await sleep(900);
    }
    if (!item.privateSent) {
      await forumSubmit('/privmsg',{ folder:'inbox',mode:'post',post:'1','username[]':item.nick,subject:CONFIG.warningSubject,message:warningPrivateBBCode(item) });
      item.privateSent = true; saveWarningState(item); renderWarnings();
    }
  }

  async function sendReviewedWarnings() {
    if (state.posting) return;
    const items = state.reviewIds.map(id => state.warnings.find(item => item.id === id)).filter(Boolean);
    if (!items.length) return;
    state.posting = true; const button = $('send-warnings'); setBusy(button,true,'Enviando…');
    try {
      for (let index=0; index<items.length; index++) {
        const item = items[index]; toast(`Enviando advertência de ${item.nick}…`, 'info');
        await sendWarning(item);
        if (index < items.length-1) await sleep(CONFIG.postIntervalMs);
      }
      $('review-dialog').close();
      toast(state.testMode ? 'Simulação concluída: tópico e MPs foram marcados como enviados, mas nada foi publicado.' : 'Todas as advertências selecionadas foram enviadas ao tópico e por MP.', 'success');
    } catch (error) {
      toast(`${error.message} O progresso concluído foi salvo; tente novamente para continuar do ponto pendente.`, 'error');
    } finally { state.posting=false; setBusy(button,false); renderWarnings(); }
  }

  function resetSimulation() {
    if (!state.testMode) return;
    const saved = sentStates();
    state.warnings.forEach(item => {
      delete saved[item.id];
      item.topicSent = false;
      item.privateSent = false;
      item.attachment = '';
    });
    localStorage.setItem(CONFIG.sendStorageKey, JSON.stringify(saved));
    renderWarnings();
    toast('Simulação reiniciada. Você pode preencher os prints e testar novamente.', 'success');
  }

  function bind() {
    document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click',() => navigate(button.dataset.view)));
    $('menu-button').onclick = () => $('sidebar').classList.toggle('open'); $('sidebar-overlay').onclick = () => $('sidebar').classList.remove('open');
    $('theme-button').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark',true);
    $('sync-nexus').onclick = () => syncNexus(true);
    document.querySelectorAll('.process-role').forEach(button => button.onclick = () => processRole(button.dataset.role));
    document.querySelectorAll('.load-example').forEach(button => button.onclick = () => loadExample(button.dataset.role));
    document.querySelectorAll('.copy-table').forEach(button => button.onclick = () => copyRole(button.dataset.role));
    document.querySelectorAll('.role-input').forEach(input => input.addEventListener('input',() => { state.raw[input.dataset.role]=input.value; persist(); }));
    ['period-start','period-end'].forEach(id => $(id).addEventListener('change',() => { persist(); rebuildWarnings(); }));
    $('warning-grid').addEventListener('input', event => { if (event.target.classList.contains('warning-attachment')) captureAttachments(); });
    $('warning-grid').addEventListener('click', event => { const button=event.target.closest('.preview-warning'); if (!button) return; const card=button.closest('[data-warning-id]'); openReview([card.dataset.warningId]); });
    $('review-warnings').onclick = () => openReview(state.warnings.filter(item => !(item.topicSent&&item.privateSent)).map(item => item.id));
    $('reset-simulation').onclick = resetSimulation;
    $('send-warnings').onclick = sendReviewedWarnings;
    document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => $(button.dataset.close).close());
    document.querySelectorAll('.dialog').forEach(dialog => dialog.addEventListener('click',event => { if (event.target===dialog && !state.posting) dialog.close(); }));
  }

  function init() {
    loadPersisted(); defaultPeriod(); buildRoleViews(); bind();
    setTheme(localStorage.getItem(CONFIG.themeKey) === 'light' ? 'light' : 'dark');
    Object.keys(ROLE_CONFIG).forEach(renderRole); rebuildWarnings(); updateSummaries();
    if (state.testMode) {
      $('reset-simulation').hidden = false;
      $('send-warnings').innerHTML = '<i class="ti ti-flask"></i> Simular tópico e MPs';
    }
    navigate(location.hash.slice(1) || 'inicio');
    syncNexus(false);
  }

  init();
})();
