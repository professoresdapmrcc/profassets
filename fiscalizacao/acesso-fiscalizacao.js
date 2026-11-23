/* Permissões da nova Central de Fiscalização. Executar no domínio do fórum. */
(function (root) {
  'use strict';
  const CFG = Object.freeze({
    GRUPOS: Object.freeze([
      { nome: 'Estagiários dos Professores', endereco: '/g397-estagiarios-dos-professores', id: 397 },
      { nome: 'Conselho dos Professores', endereco: '/g72-conselho-dos-professores', id: 72 },
      { nome: 'Liderança dos Professores', endereco: '/g11-lideranca-dos-professores', id: 11 },
      { nome: 'Corregedoria', endereco: '/g9-corregedoria', id: 9 },
      { nome: 'Corregedoria Suplente', endereco: '/g633-corregedoria-suplente', id: 633 },
      { nome: 'Procuradoria Militar de Justiça', endereco: '/g721-procuradoria-militar-de-justica', id: 721 },
      { nome: 'Grupamento de Ações Táticas Especiais', endereco: '', id: null },
      { nome: 'Ministério da Defesa', endereco: '/g22-ministerio-da-defesa', id: 22 },
      { nome: 'Supremacia', endereco: '/g47-supremacia', id: 47 },
    ].map(Object.freeze)),
    ACESSO_MINUTOS: 30,
    VERIFICAR_GRUPOS: true,
    ATUALIZAR_SEGUNDOS: 300,
  });
  const identity = value => String(value || '').normalize('NFC').trim().toLocaleLowerCase('pt-BR');
  const nameKey = value => identity(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  function avaliarPermissoes(usuario, gruposConfirmados, cfg = CFG) {
    if (!usuario || !Number.isSafeInteger(usuario.id) || usuario.id < 1 || !identity(usuario.nick)) {
      return { podeVer: false, podeEditar: false, mensagem: 'Entre na sua conta do fórum para continuar.' };
    }
    const grupos = new Set(gruposConfirmados);
    const podeVer = !cfg.VERIFICAR_GRUPOS || cfg.GRUPOS.some(grupo => grupos.has(grupo.id));
    return {
      podeVer,
      podeEditar: podeVer,
      mensagem: 'Use Gerenciar no fórum para abrir o grupo. A retirada é feita na página do fórum com as permissões da sua conta.',
    };
  }

  async function fetchForum(path) {
    if (root.location.origin !== 'https://www.policiarcc.com') throw new Error('Abra esta ferramenta dentro do fórum para conferir sua sessão.');
    const url = new URL(path, root.location.origin);
    if (url.origin !== root.location.origin) throw new Error('Endereço de grupo inválido.');
    const response = await root.fetch(url.href, { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('Não foi possível consultar o fórum.');
    const html = await response.text();
    if (new URL(response.url).pathname.startsWith('/login')) throw new Error('Sua sessão do fórum expirou. Entre novamente.');
    return html;
  }

  async function usuarioLogado() {
    const html = await fetchForum('/forum');
    function field(key) {
      const match = html.match(new RegExp('_userdata\\s*\\[\\s*["\x27]' + key + '["\x27]\\s*\\]\\s*=\\s*("(?:\\\\.|[^"\\\\])*"|\x27(?:\\\\.|[^\x27\\\\])*\x27|[0-9]+)'));
      if (!match) return null;
      if (/^[0-9]+$/.test(match[1])) return Number(match[1]);
      return match[1][0] === '"' ? JSON.parse(match[1]) : match[1].slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    }
    const id = Number(field('user_id'));
    const nick = field('username');
    if (!Number.isSafeInteger(id) || id < 1 || !nick || nick === 'Anonymous') throw new Error('Não foi possível confirmar o usuário logado no fórum.');
    const text = new DOMParser().parseFromString('<!doctype html><body></body>', 'text/html').createElement('textarea');
    text.innerHTML = nick;
    return { id, nick: text.value };
  }

  async function perfilNexus(nick) {
    const response = await root.fetch('https://firestore.googleapis.com/v1/projects/nexusprof/databases/(default)/documents:runQuery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(20000),
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'public_members' }], where: { fieldFilter: { field: { fieldPath: 'nameKey' }, op: 'EQUAL', value: { stringValue: nameKey(nick) } } }, limit: 10 } }),
    });
    if (!response.ok) throw new Error('O cargo no NEXUS não pôde ser consultado.');
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('O NEXUS retornou uma resposta inválida.');
    const matches = data.flatMap(item => {
      const f = item.document?.fields;
      if (!f) return [];
      const name = f.name?.stringValue || f.nick?.stringValue || '';
      if (identity(name) !== identity(nick)) return [];
      return [{ uid: item.document.name.split('/').pop(), nick: name, cargo: f.cargo?.stringValue || '', status: f.status?.stringValue || '' }];
    });
    const active = matches.filter(item => ['ativo', 'active'].includes(identity(item.status)));
    if (active.length === 1) return active[0];
    if (matches.length === 1) return matches[0];
    throw new Error(matches.length ? 'Há cadastros conflitantes no NEXUS. Confira o perfil antes de editar.' : 'Usuário não encontrado no diretório do NEXUS.');
  }

  async function resolverGrupo(grupo) {
    if (grupo.endereco) return { ...grupo, caminhoRelativo: grupo.endereco, chave: String(grupo.id) };
    const doc = new DOMParser().parseFromString(await fetchForum('/groups'), 'text/html');
    const links = [...doc.querySelectorAll('a[href]')].filter(a => identity(a.textContent) === identity(grupo.nome));
    const groupId = url => url.pathname.match(/^\/g(\d+)/)?.[1] || (['/groups','/groupcp'].includes(url.pathname) ? url.searchParams.get('g') : null);
    const found = links.map(a => new URL(a.getAttribute('href'), root.location.origin)).filter(url => url.origin === root.location.origin && /^\d+$/.test(groupId(url) || ''));
    const unique = [...new Map(found.map(url => [groupId(url), url])).values()];
    if (unique.length !== 1) throw new Error('Não foi possível identificar com segurança o grupo ' + grupo.nome + '.');
    return { ...grupo, id: Number(groupId(unique[0])), caminhoRelativo: unique[0].pathname + unique[0].search, chave: unique[0].pathname };
  }

  // O adaptador deve conferir TODAS as páginas da lista real de membros.
  // Não aceitar grupos vindos do localStorage nem cargo como prova de associação.
  function criarControlador({ conferirGrupo, cfg = CFG }) {
    if (typeof conferirGrupo !== 'function') throw new Error('Configure o verificador de membros dos grupos.');
    async function conferir() {
      const usuario = await usuarioLogado();
      const confirmed = [];
      const resolved = [];
      const failures = [];
      const groups = cfg.GRUPOS;
      for (const raw of groups) {
        try {
          const group = await resolverGrupo(raw);
          resolved.push(group);
          if (await conferirGrupo(group, usuario) === true) confirmed.push(group.id);
        } catch (error) { failures.push({ grupo: raw.nome, mensagem: error.message }); }
      }
      const perfil = await perfilNexus(usuario.nick).catch(error => ({ nick: usuario.nick, cargo: '', erro: error.message }));
      const permissoes = avaliarPermissoes(usuario, confirmed, { ...cfg, GRUPOS: resolved });
      return { usuario, perfil, grupos: confirmed, falhas: failures, ...permissoes };
    }
    return Object.freeze({ conferir });
  }
  const api = Object.freeze({ CFG, avaliarPermissoes, criarControlador, perfilNexus, usuarioLogado });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AcessoFiscalizacao = api;
})(typeof window === 'undefined' ? globalThis : window);
