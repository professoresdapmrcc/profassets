const { test } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../centralavaliacoes.js');

const date = text => new Date(text + 'T12:00:00-03:00');
const week = (data, metaValue = 100, aulasAplicadas = 2) => ({ data, metaValue, porcentagem: `${metaValue}%`, aulasAplicadas });
const csv = (label, nick, metrics, total = '100%') => [
  [`${label} Nick`, ...app.CONSULTA_SHEETS.professor.metrics, 'Total (%)', 'Status', 'Motivo'],
  [nick, ...metrics, total, 'Excelente', ''],
].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');

test('uses latest readmission and returns null for missing entry dates', () => {
  assert.equal(app.latestEntryDate({}), null);
  const entry = app.latestEntryDate({ dataEntrada: '01/02/2026', historico: [{ acao: 'Readmissão', data: '23/09/2026' }, { acao: 'Promoção', data: '30/09/2026' }] });
  assert.equal(entry.getTime(), date('2026-09-23').getTime());
});

test('includes entry week, excludes old and future weeks, and deduplicates', () => {
  const current = week('20 SET 2026 A 26 SET 2026');
  const result = app.filterCareerWeeks([week('13 SET 2026 A 19 SET 2026'), current, current, week('27 SET 2026 A 03 OUT 2026'), week('04 OUT 2026 A 10 OUT 2026')], date('2026-09-23'), date('2026-10-03'));
  assert.deepEqual(result.map(item => item.data), ['27 SET 2026 A 03 OUT 2026', current.data]);
});

test('understands actual fortnight labels from the graduador sheet', () => {
  assert.equal(app.weekPeriod({ data: '01 Set. 2026 a 15 de Set. 2026' }), '1 Set a 15 Set');
  assert.equal(app.weekPeriod({ data: '16 Set. 2026 a 30 de Set. 2026' }), '16 Set a 30 Set');
});

test('loads month tabs from admission, including cross-year overlap', () => {
  assert.deepEqual(app.performanceMonthNames(date('2026-08-17'), date('2026-10-03')), ['Julho', 'Agosto', 'Setembro', 'Outubro']);
  assert.deepEqual(app.performanceMonthNames(date('2025-12-23'), date('2026-01-03')), ['Novembro', 'Dezembro', 'Janeiro']);
  assert.equal(app.performanceMonthNames(date('2020-01-01'), date('2026-10-03')).length, 12);
});

test('matches punctuation in nickname and distinguishes zero from blank', () => {
  const input = csv('20 SET 2026 A 26 SET 2026', ',Membro', [0, 0, 0, 0], '0%');
  const records = app.consultaWeeks(input, app.CONSULTA_SHEETS.professor, ',membro');
  assert.equal(records[0].metaValue, 0);
  assert.equal(records[0].aulasAplicadas, 0);
  assert.equal(app.consultaWeeks(input, app.CONSULTA_SHEETS.professor, 'Membro').length, 0);
  const missing = app.consultaWeeks(csv('20 SET 2026 A 26 SET 2026', 'Membro', ['', '', '', ''], ''), app.CONSULTA_SHEETS.professor, 'Membro');
  assert.equal(missing[0].aulasAplicadas, null);
  assert.equal(missing[0].metaValue, null);
});

test('computes totals and best week from filtered weekly values only', () => {
  const weeks = [week('20 SET 2026 A 26 SET 2026', 1575, 12), week('27 SET 2026 A 03 OUT 2026', 250, 3)];
  const result = app.summarizeWeeks(weeks, 'professor');
  assert.equal(result.aulasCargoAtual, 15);
  assert.equal(result.maiorPorcentagem, 1575);
  assert.match(result.melhorSemanaLabel, /20 Set a 26 Set/);
  assert.equal(app.summarizeWeeks([], 'professor').aulasCargoAtual, undefined);
});

test('does not count coordinator orientations as lessons', () => {
  const config = app.CONSULTA_SHEETS.coordenador;
  const input = [`"20 SET 2026 A 26 SET 2026 Nick",${config.metrics.map(name => `"${name}"`).join(',')},"Total (%)","Status","Motivo"`, '"Membro",10,20,30,2,3,"500%","Ótimo",""'].join('\n');
  assert.equal(app.consultaWeeks(input, config, 'Membro')[0].aulasAplicadas, 5);
});

test('excludes licenses before readmission and licenses without a start date', () => {
  app.S.users = [{ name: '.Fernandess', dataEntrada: '07/09/2026' }];
  app.S.licenses = [
    { nick: '.Fernandess', data_inicio: '13/04/2026', data_fim: '28/04/2026' },
    { nick: '.Fernandess', data_inicio: '07/09/2026' },
    { nick: '.Fernandess', data_inicio: '25/09/2026' },
    { nick: '.Fernandess' },
    { nick: 'Outro', data_inicio: '25/09/2026' },
  ];
  assert.deepEqual(app.licenseHistory('.Fernandess').map(item => item.data_inicio), ['25/09/2026', '07/09/2026']);
  assert(!app.licenseSummary('.Fernandess').includes('13/04'));
  assert.equal(app.licenseHistory('SemEntrada').length, 0);
});

test('rejects the default January tab when Google silently falls back for October', () => {
  const january = csv('28 Dez 2025 a 03 de Jan 2026', 'Membro', [1, 0, 0, 0]);
  assert.throws(() => app.validateSheetMonth(january, 'Outubro'), /outro período/);
  assert.doesNotThrow(() => app.validateSheetMonth(january, 'Janeiro'));
});

test('missing entry requests manual review without fetching or old totals', async () => {
  app.S.users = [{ name: 'SemData', cargo: 'Professor(a)', aulasAplicadas: 999 }];
  const result = await app.loadPerformance({ nick: 'SemData', cargo: 'professor' });
  assert.equal(result.manualReview, true);
  assert.match(app.performancePanel(result, app.S.users[0], { nick: 'SemData' }), /Veja manualmente/);
  assert.deepEqual(app.performanceWeeks(result, { historicoMetas: [week('01 JAN 2020 A 07 JAN 2020')] }), []);
});

test('sheet loader uses current role and applies entry filter without Firestore aggregate fallback', async () => {
  const originalFetch = global.fetch;
  const urls = [];
  app.S.performance.clear();
  app.S.users = [{ name: 'Teste', cargo: 'Coordenador(a)', dataEntrada: '23/09/2026', aulasAplicadas: 999 }];
  const config = app.CONSULTA_SHEETS.coordenador;
  const input = [`"20 SET 2026 A 26 SET 2026 Nick",${config.metrics.map(name => `"${name}"`).join(',')},"Total (%)","Status","Motivo"`, '"Teste",10,20,30,2,3,"500%","Ótimo",""'].join('\n');
  global.fetch = async url => { urls.push(url); return { ok: true, text: async () => input }; };
  try {
    const result = await app.loadPerformance({ nick: 'Teste', cargo: 'professor' });
    assert(urls.length > 0);
    assert(urls.every(url => url.includes(config.sheetId)));
    assert.equal(result.semanas.length, 1);
    assert.equal(result.aulasCargoAtual, 5);
    assert.equal(result.cargo, 'coordenador');
  } finally { global.fetch = originalFetch; app.S.performance.clear(); }
});
