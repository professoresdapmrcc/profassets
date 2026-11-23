(function (root) {
  'use strict';
  const tipos = { REBAIXAMENTO: 'rebaixamento', SAIDA: 'saida', EXPULSAO: 'expulsao' };
  const normalize = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  const registry = new Map();
  function registrar(codigo, titulo, campos) {
    const tipo = tipos[normalize(titulo).split(' ')[0]];
    if (tipo) registry.set(codigo, { tipo, campos: { ...campos } });
  }
  function acoes(codigo) {
    // Grouped requests retain each original block; do not extract identities from HTML.
    const found = [...registry].filter(([block]) => codigo.includes(block)).sort((a, b) => b[0].length - a[0].length);
    const selected = [];
    for (const [block, action] of found) {
      if (!selected.some(item => item.block.includes(block))) selected.push({ block, ...action });
    }
    return selected.map(({ campos, tipo }) => ({ tipo, campos, nicks: [...new Set(String(campos.Nickname || '').split(/\s*\/\s*/).map(s => s.trim()).filter(Boolean))] }));
  }
  function cofre({ nick, tipo, cargo, responsavel, periodo }) {
    const motivos = { rebaixamento: 'rebaixamento', expulsao: 'expulsao', saida: 'saida', infracao: 'infracao' };
    if (!motivos[tipo] || !nick || !cargo || !responsavel || !periodo) throw new Error('Confira nick, cargo, motivo, período e responsável antes de abrir o cofre.');
    const url = new URL('https://www.policiarcc.com/h17-postagem-de-medalhas-af');
    for (const [key, value] of Object.entries({ grupo: 'Professores', motivo: motivos[tipo], cargo, policiais: nick, responsavel, periodo })) url.searchParams.set(key, value);
    return url.href;
  }
  function firebasePayload(action, nick, autor, idempotencyKey) {
    const { tipo, campos } = action;
    const base = { nicknames: nick, motivo: String(campos.Motivo || ''), autor, idempotencyKey };
    if (tipo === 'rebaixamento') {
      if (!campos['Novo cargo']) throw new Error('O novo cargo não foi identificado.');
      return { route: 'rebaixamento', payload: { ...base, novoCargo: campos['Novo cargo'] } };
    }
    // Same departure endpoint used by the Company's requests; expulsion is a departure with its reason.
    return { route: 'saida', payload: { ...base, tipo, data: campos.Data || new Date().toLocaleDateString('pt-BR'), motivo: tipo === 'expulsao' ? 'Expulsão: ' + base.motivo : base.motivo } };
  }
  function criar({ storage, postar, firebase, carta, planilha, onChange = () => {} }) {
    const STORAGE = 'PROF_FISCALIZACAO_ENVIOS_V1';
    let busy = false;
    function ler() {
      const raw = storage.getItem(STORAGE);
      if (!raw) return [];
      const rows = JSON.parse(raw);
      if (!Array.isArray(rows)) throw new Error('Histórico de envios inválido. Confira o fórum antes de continuar.');
      return rows;
    }
    function salvar(rows) { storage.setItem(STORAGE, JSON.stringify(rows)); onChange(rows); }
    async function etapa(rows, record, key, send) {
      const state = record.etapas[key];
      if (state === 'concluido' || state === 'dispensado') return;
      if (state === 'enviando' || state === 'incerto') throw new Error('Resultado incerto em ' + key + '. Confira o destino antes de qualquer novo envio.');
      record.etapas[key] = 'enviando'; salvar(rows); // Persist BEFORE transmission.
      try { await send(); record.etapas[key] = 'concluido'; salvar(rows); }
      catch (error) {
        record.etapas[key] = error.naoEnviado === true ? 'pendente' : 'incerto';
        record.erro = error.message; salvar(rows); throw error;
      }
    }
    async function enviar({ codigo, autor, topic, operacoes, informacoesCarta = {} }) {
      if (busy) throw new Error('Aguarde o envio em andamento.');
      if (!autor || !codigo || !operacoes?.length || operacoes.some(a => !a.nicks?.length)) throw new Error('Não foi possível identificar todos os membros e ações. Reabra a revisão.');
      for (const action of operacoes) for (const nick of action.nicks) firebasePayload(action, nick, autor, 'validar');
      busy = true;
      try {
        const rows = ler();
        let record = rows.find(item => item.codigo === codigo && item.autor === autor && item.topic === topic);
        if (!record) {
          record = { id: root.crypto.randomUUID(), criadoEm: new Date().toISOString(), codigo, autor, topic, operacoes, informacoesCarta, etapas: {} };
          rows.unshift(record); salvar(rows);
        }
        await etapa(rows, record, 'forum', () => postar(topic, codigo));
        for (const [index, action] of record.operacoes.entries()) {
          for (const [recipient, nick] of action.nicks.entries()) {
            const suffix = `${index}-${recipient}`;
            await etapa(rows, record, 'firebase-' + suffix, () => firebase(firebasePayload(action, nick, autor, record.id + ':' + suffix)));
            if (['rebaixamento', 'expulsao'].includes(action.tipo)) {
              await etapa(rows, record, 'carta-' + suffix, () => carta(nick, action.tipo, action.campos.Motivo, record.informacoesCarta));
            }
          }
        }
        // The previous sheet logger is retained, including its no-cors behavior.
        await etapa(rows, record, 'planilha', async () => { await planilha(record); });
        record.concluido = true; delete record.erro; salvar(rows);
        return record;
      } finally { busy = false; }
    }
    return { enviar, historico: ler };
  }
  const api = { registrar, acoes, cofre, firebasePayload, criar };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FluxoFiscalizacao = api;
})(typeof window === 'undefined' ? globalThis : window);
