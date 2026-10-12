const test = require('node:test');
const assert = require('node:assert/strict');
const { writePromotionBackup } = require('../centralavaliacoes.js');

global.firebase = { firestore: { FieldValue: { serverTimestamp: () => 'SERVER_TIMESTAMP' } } };
function fixture({ missing = false, denied = false } = {}) {
  const writes = [];
  const reads = [];
  const doc = (path) => ({ path, id: path.split('/').at(-1), collection: name => collection(path + '/' + name) });
  const collection = path => ({ doc: id => doc(path + '/' + (id || 'ABCDEFGHIJKLMNOPQRST')) });
  const lists = { size: 1, docs: [{ ref: doc('listas_promocao/professor') }] };
  const votes = { size: 1, docs: [{ ref: doc('avaliacoes_nexus/professor_Membro_Lider') }] };
  const currentVote = { nick_avaliado: 'Membro', dissertacao: 'Última alteração', timestamp: { seconds: 123 }, historico: [{ dissertacao: 'Anterior' }] };
  const db = {
    collection,
    async runTransaction(callback) {
      const pending = [];
      await callback({
        async get(ref) {
          assert.equal(pending.length, 0, 'all reads must precede writes');
          reads.push(ref.path);
          return { ref, id: ref.id, exists: !missing, data: () => ref.path.startsWith('listas_promocao/') ? { nicks: ['Membro'], vagas: 1 } : currentVote };
        },
        set(ref, data) { pending.push({ operation: 'set', path: ref.path, data }); },
        delete(ref) { pending.push({ operation: 'delete', path: ref.path }); },
      });
      if (denied) throw new Error('permission-denied');
      writes.push(...pending);
    },
  };
  return { db, lists, votes, writes, reads, currentVote };
}

test('archives fresh snapshots, proof and deletions in one transaction', async () => {
  const f = fixture();
  const history = await writePromotionBackup(f.db, f.lists, f.votes, 'session-uid');
  assert.equal(f.reads.length, 2);
  assert.equal(f.writes.length, 4);
  const backup = f.writes[0].data;
  assert.deepEqual(backup.avaliacoesOriginais.professor_Membro_Lider, f.currentVote);
  assert.deepEqual(backup.avaliacoes[0], { id: 'professor_Membro_Lider', ...f.currentVote });
  assert.deepEqual(backup.listas[0], { id: 'professor', nicks: ['Membro'], vagas: 1 });
  assert.equal(backup.autorUid, 'session-uid');
  assert.equal(f.writes[1].path, 'nexus_config/avaliacoes/encerramentos/session-uid');
  assert.equal(f.writes[1].data.backupId, history.id);
  assert.deepEqual(f.writes.slice(2).map(write => write.path), f.reads);
});

test('concurrent removal aborts before any write', async () => {
  const f = fixture({ missing: true });
  await assert.rejects(writePromotionBackup(f.db, f.lists, f.votes, 'session-uid'), /ciclo foi alterado/);
  assert.deepEqual(f.writes, []);
});

test('denied transaction leaves both backup and active documents unchanged', async () => {
  const f = fixture({ denied: true });
  await assert.rejects(writePromotionBackup(f.db, f.lists, f.votes, 'session-uid'), /permission-denied/);
  assert.deepEqual(f.writes, []);
});
