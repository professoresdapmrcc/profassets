const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../centralavaliacoes.js');

test('response labels distinguish complete drafts, incomplete edits and sent votes', () => {
  assert.equal(app.responseLabel({}), 'Pendente');
  assert.equal(app.responseLabel({ rascunho: { veredito: 'Promovido', dissertacao: '  ' } }), 'Resposta incompleta');
  assert.equal(app.responseLabel({ rascunho: { veredito: 'Mantém', comentario: 'Motivo' } }), 'Respondida — aguardando envio');
  assert.equal(app.responseLabel({ status: 'enviado', veredito: 'Promovido', dissertacao: 'Motivo' }), 'Avaliação enviada');
  assert.equal(app.responseLabel({ status: 'enviado', rascunho: { veredito: 'Mantém' } }), 'Resposta incompleta');
});

test('leadership counts submitted votes only and identifies pending evaluators by candidate and role', () => {
  app.S.promotions = [{ nick: ',Membro', cargo: 'professor' }, { nick: 'Segundo', cargo: 'professor' }];
  app.S.users = [{ name: 'Conselheiro', cargo: 'Conselheiro(a)', status: 'Ativo' }, { name: 'Estagiario', cargo: 'Estagiário(a)', status: 'Ativo' }, { name: 'Inativo', cargo: 'Líder', status: 'Inativo' }];
  app.S.promotionVotes = [
    { avaliador: 'conselheiro', nick_avaliado: ',Membro', cargo: 'professor', status: 'enviado', veredito: 'Promovido', dissertacao: 'Sim' },
    { avaliador: 'Estagiario', nick_avaliado: ',Membro', cargo: 'professor', status: 'rascunho', rascunho: { veredito: 'Mantém', dissertacao: 'Motivo' } },
    { avaliador: 'Estagiario', nick_avaliado: 'Segundo', cargo: 'coordenador', status: 'enviado', veredito: 'Mantém', dissertacao: 'Motivo' },
  ];
  const data = app.leadershipData('professor');
  assert.equal(data.results[0].promotes, 1);
  assert.equal(data.results[0].keeps, 0);
  assert.equal(data.results[1].verdict, 'Pendente');
  assert.equal(data.participation.length, 2);
  assert.deepEqual(data.participation[0].pending, ['Segundo']);
  assert.equal(data.participation[1].done, 0);
  assert.equal(app.leadershipData('graduador').results.length, 0);
});

test('history keeps prior sent verdict and date without mutating previous history', () => {
  const previous = { status: 'enviado', veredito: 'Mantém', dissertacao: 'Anterior', atualizadoEm: '2026-10-01T12:00:00Z', historico: [] };
  const history = app.historyOf(previous, ['veredito', 'dissertacao']);
  assert.equal(history[0].veredito, 'Mantém');
  assert.equal(history[0].salvoEm, '2026-10-01T12:00:00.000Z');
  assert.equal(previous.historico.length, 0);
  assert.deepEqual(app.historyOf({ status: 'rascunho' }, ['veredito']), []);
});

test('weekly evolution compares chronological periods and preserves zero results', () => {
  const html = app.weeklyEvolution([
    { data: '06 SET 2026 A 12 SET 2026', metaValue: 100, aulasAplicadas: 2 },
    { data: '20 SET 2026 A 26 SET 2026', metaValue: 0, aulasAplicadas: 0 },
    { data: '13 SET 2026 A 19 SET 2026', metaValue: 150, aulasAplicadas: 3 },
  ], 'professor');
  assert.match(html, /-150 pontos percentuais/);
  assert.match(html, /-3 aulas aplicadas/);
  assert.match(app.weeklyEvolution([], 'professor'), /dois períodos/);
});
