# Gerador de Pontos Internos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar uma página de fórum que gere, confira e envie lançamentos para `Respostas ao formulário`, com configuração no Firebase e um Apps Script instalável pelo usuário.

**Architecture:** O frontend estático reutiliza a sessão do fórum e o Firebase da Central de Avaliações, lê fontes oficiais por adaptadores isolados e converte resultados em candidatos. Funções puras cuidam de normalização, destaque, agrupamento e duplicidades; o Apps Script valida e acrescenta o lote na planilha fixa usando trava e idempotência.

**Tech Stack:** HTML5, CSS3, JavaScript sem framework, Firebase Auth/Firestore v8, Google Sheets CSV/gviz, Google Apps Script, Node.js test runner.

**Spec:** `docs/superpowers/specs/2026-10-12-pontos-internos-forum-design.md`

## Global Constraints

- Criar `pontosinternos.html`, `pontosinternos.css` e `pontosinternos.js` no repositório `D:\profassets`.
- O destino é a planilha `1qL4S-vNDI2iONCVtl6fUuWo6EK0v62IWFGydrLKhlbQ`, aba `Respostas ao formulário`, colunas A:I.
- Nunca editar `Controle`, `Dados`, `Ranking Interno`, `Quadro de Pontos`, fórmulas, aprovações ou totais.
- O frontend não calcula pontuação numérica; envia a categoria e o rótulo exato configurado.
- Print é opcional e fica vazio em lançamentos automáticos.
- Responsável vem da sessão autenticada e não é editável.
- Novos candidatos começam marcados; duplicidades começam desmarcadas.
- Nicks equivalentes são comparados sem acentos e sem diferença de maiúsculas, mas escritos com a grafia da fonte.
- O Apps Script deve ser instalado manualmente pelo usuário; nenhuma credencial ficará no frontend.

## Review Focus

- Nicknames com vírgula, ponto, hífen, interrogação e espaços devem sobreviver à normalização e ao agrupamento.
- Uma fonte disponível mas com cabeçalho inesperado deve falhar explicitamente e produzir zero candidatos.
- O último período vazio não pode ocultar o último período válido nem ser tratado como resultado zero.
- Um lote repetido com o mesmo `requestId` deve retornar o recibo anterior sem acrescentar linhas.
- Se dois usuários gerarem simultaneamente, a trava do Apps Script deve manter os lotes inteiros e sem sobreposição.

---

### Task 1: Núcleo puro de candidatos e duplicidades

**Files:**
- Create: `pontosinternos.js`
- Create: `tests/pontosinternos-core.test.cjs`

**Interfaces:**
- Produces: `normalizeNick(value)`, `splitNicks(value)`, `selectHighlights(rows, limit)`, `duplicateKey(entry)`, `markDuplicates(candidates, history, sheetRows)`, `groupSelected(candidates)`.
- Consumes: objetos `{ nick, sourceId, periodId, category, label, selected, duplicate }`.

- [ ] **Step 1: Escrever testes que fixam caracteres de nick, empate, duplicidade e agrupamento**

```js
test('preserva grafia e agrupa por categoria e rótulo', () => {
  const grouped = app.groupSelected([
    { nick: ',Majesty', category: 'C', label: 'META CUMPRIDA (PROFESSOR)', selected: true },
    { nick: '!weniyori?', category: 'C', label: 'META CUMPRIDA (PROFESSOR)', selected: true },
  ]);
  assert.equal(grouped[0].nicks, ',Majesty / !weniyori?');
});

test('empate conserva a primeira ocorrência da fonte', () => {
  assert.deepEqual(app.selectHighlights([{ nick: 'A', score: 10 }, { nick: 'B', score: 10 }], 1).map(x => x.nick), ['A']);
});

test('duplicidade precisa começa desmarcada', () => {
  const [item] = app.markDuplicates(
    [{ nick: 'Pegas', sourceId: 'prof', periodId: '2026-W41', category: 'C', label: 'META CUMPRIDA (PROFESSOR)' }],
    [{ nick: 'pegas', sourceId: 'prof', periodId: '2026-W41', category: 'C', label: 'META CUMPRIDA (PROFESSOR)' }],
    [],
  );
  assert.equal(item.selected, false);
  assert.equal(item.duplicate, 'exact');
});
```

- [ ] **Step 2: Executar os testes e confirmar falha por módulo ausente**

Run: `node --test tests/pontosinternos-core.test.cjs`
Expected: FAIL porque `pontosinternos.js` ainda não exporta as funções.

- [ ] **Step 3: Implementar funções puras e exportação CommonJS protegida**

```js
function normalizeNick(value) {
  return String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function duplicateKey(entry) {
  return [entry.sourceId, entry.periodId, entry.category, entry.label, normalizeNick(entry.nick)].join('|');
}
function groupSelected(items) {
  const groups = new Map();
  items.filter(item => item.selected).forEach(item => {
    const key = `${item.category}|${item.label}`;
    const group = groups.get(key) || { category: item.category, label: item.label, nickList: [] };
    if (!group.nickList.some(nick => normalizeNick(nick) === normalizeNick(item.nick))) group.nickList.push(item.nick.trim());
    groups.set(key, group);
  });
  return [...groups.values()].map(group => ({ ...group, nicks: group.nickList.join(' / ') }));
}
```

- [ ] **Step 4: Executar testes do núcleo**

Run: `node --test tests/pontosinternos-core.test.cjs`
Expected: PASS.

- [ ] **Step 5: Commitar o núcleo**

```bash
git add pontosinternos.js tests/pontosinternos-core.test.cjs
git commit -m "feat: criar nucleo do gerador de pontos"
```

### Task 2: Adaptadores das fontes oficiais

**Files:**
- Modify: `pontosinternos.js`
- Create: `tests/pontosinternos-sources.test.cjs`
- Create: `tests/fixtures/pontos-internos/*.json`

**Interfaces:**
- Consumes: `fetchCsv(source, period)`, registros do Firebase de propostas e configuração `{ id, kind, sheetId, tabs, mappings }`.
- Produces: `parseRolePerformance`, `parseGroupPerformance`, `evaluateProposals`, `generateCandidates(source, period, options)`.

- [ ] **Step 1: Salvar fixtures anonimizadas dos formatos de Professores, Coordenadores, Graduadores, Conselho, SPP, CDC e DA**

Cada fixture deve manter cabeçalhos, ordem, status e campos de período, substituindo somente os nicks por `MembroA`, `MembroB` e `MembroC`.

- [ ] **Step 2: Escrever testes dos últimos períodos, metas e falha de cabeçalho**

```js
test('último período vazio recua ao último período com dados', () => {
  const result = app.parseRolePerformance(fixture, config);
  assert.equal(result.periodId, '2026-W41');
  assert.deepEqual(result.candidates.map(item => item.nick), ['MembroA', 'MembroB']);
});

test('cabeçalho desconhecido interrompe a geração', () => {
  assert.throws(() => app.parseRolePerformance([['coluna inesperada']], config), /estrutura da fonte mudou/i);
});
```

- [ ] **Step 3: Implementar leitor CSV robusto e adaptadores por tipo**

O leitor deve aceitar BOM, CRLF, campos citados, zeros reais e células vazias. Cada adaptador valida sentinelas de cabeçalho antes de produzir candidatos.

- [ ] **Step 4: Implementar propostas concluídas e parciais**

```js
function evaluateProposal(proposal, votes, leaderNicks) {
  const submitted = votes.filter(vote => vote.status !== 'rascunho' && Number(vote.order) === Number(proposal.order));
  const leader = submitted.find(vote => leaderNicks.has(normalizeNick(vote.nick)));
  if (leader) return verdictResult(leader.verdict);
  return majorityResult(submitted.map(vote => vote.verdict));
}
```

Projeto, Sugestão e Correção produzem somente o rótulo configurado; nenhuma função retorna quantidade de pontos.

- [ ] **Step 5: Executar testes das fontes e do núcleo**

Run: `node --test tests/pontosinternos-core.test.cjs tests/pontosinternos-sources.test.cjs`
Expected: PASS.

- [ ] **Step 6: Commitar os adaptadores**

```bash
git add pontosinternos.js tests/pontosinternos-sources.test.cjs tests/fixtures/pontos-internos
git commit -m "feat: importar fontes oficiais de desempenho"
```

### Task 3: Interface do fórum e fluxo de conferência

**Files:**
- Create: `pontosinternos.html`
- Create: `pontosinternos.css`
- Modify: `pontosinternos.js`
- Create: `tests/pontosinternos-ui.test.cjs`

**Interfaces:**
- Consumes: funções da Task 1, `generateCandidates` da Task 2 e configuração Firestore.
- Produces: navegação `Gerar`, `Manual`, `Histórico`, `Configurações`; renderização e eventos de seleção.

- [ ] **Step 1: Escrever testes estáticos do contrato da página**

```js
test('página expõe as quatro áreas e não permite editar responsável', () => {
  assert.match(html, /data-view="generate"/);
  assert.match(html, /data-view="manual"/);
  assert.match(html, /data-view="history"/);
  assert.match(html, /data-view="settings"/);
  assert.match(html, /id="pi-responsible"[^>]*readonly/);
});
```

- [ ] **Step 2: Criar shell HTML compatível com injeção no fórum**

O HTML deve carregar Firebase v8, Font Awesome, `pontosinternos.css` e `pontosinternos.js`, sem incluir segredos ou IDs de implantação privados.

- [ ] **Step 3: Implementar a interface responsiva e estados explícitos**

Desktop usa barra lateral de fontes e painel de trabalho; mobile usa controles empilhados. Incluir carregamento, vazio, indisponível, duplicado, parcial, erro e recibo.

- [ ] **Step 4: Implementar seleção padrão e comparação de duplicidades**

Cada candidato recebe checkbox individual. O card duplicado exibe `registro novo` e `registro encontrado`. Alterar a checkbox nunca remove o candidato da prévia.

- [ ] **Step 5: Implementar formulário manual e agrupamento final**

Aceitar nicks por linha ou `/`, validar catálogo ativo, print opcional e passar os registros pela mesma prévia antes de enviar.

- [ ] **Step 6: Executar testes e verificação sintática**

Run: `node --check pontosinternos.js && node --test tests/pontosinternos-core.test.cjs tests/pontosinternos-sources.test.cjs tests/pontosinternos-ui.test.cjs`
Expected: PASS.

- [ ] **Step 7: Commitar a interface**

```bash
git add pontosinternos.html pontosinternos.css pontosinternos.js tests/pontosinternos-ui.test.cjs
git commit -m "feat: criar central de pontos internos no forum"
```

### Task 4: Configuração, acesso e auditoria no Firebase

**Files:**
- Modify: `pontosinternos.js`
- Create: `tests/pontosinternos-config.test.cjs`
- Modify: `D:\NEXUS V2.0\nexus-app\firestore.rules`
- Create: `D:\NEXUS V2.0\nexus-app\scripts\test-internal-points-rules.cjs`

**Interfaces:**
- Consumes: sessão do fórum, Firebase Auth e perfil em `usuarios`.
- Produces: `loadConfig()`, `savePointType()`, `saveSource()`, `saveExtraNick()`, `appendAudit()`, `appendReceipt()`.

- [ ] **Step 1: Escrever testes do seed, desativação e acesso**

```js
test('tipo usado é desativado em vez de removido', () => {
  assert.deepEqual(app.removePointType({ id: 'meta-prof', usageCount: 3 }), { id: 'meta-prof', active: false, usageCount: 3 });
});
```

Os testes de regras devem permitir os quatro cargos e nicks avulsos, negar membros comuns e exigir auditoria na mesma operação de configuração.

- [ ] **Step 2: Implementar seed idempotente do catálogo atual**

O seed usa IDs estáveis e `set(..., { merge: true })`, sem reativar ou sobrescrever itens já editados.

- [ ] **Step 3: Implementar CRUD com auditoria**

Configurações usam batch Firestore para gravar a alteração e criar `auditoria/{autoId}`. O histórico de envios aceita criação e leitura, nunca edição ou exclusão pelo frontend.

- [ ] **Step 4: Acrescentar regras mínimas ao ruleset completo**

Criar matches específicos sob `nexus_config/pontos_internos`, preservando integralmente as regras existentes. Validar campos permitidos, cargo ativo, nickname extra e imutabilidade dos recibos.

- [ ] **Step 5: Rodar testes de regras sem escrita em produção**

Run: `node scripts/test-internal-points-rules.cjs`
Expected: todos os casos allow/deny passam pela Rules API.

- [ ] **Step 6: Commitar frontend e regras nos respectivos repositórios**

```bash
git -C D:\profassets add pontosinternos.js tests/pontosinternos-config.test.cjs
git -C D:\profassets commit -m "feat: configurar pontos internos pelo firebase"
git -C "D:\NEXUS V2.0\nexus-app" add firestore.rules scripts/test-internal-points-rules.cjs
git -C "D:\NEXUS V2.0\nexus-app" commit -m "feat: proteger configuracao de pontos internos"
```

### Task 5: Backend instalável em Google Apps Script

**Files:**
- Create: `apps-script/pontos-internos/Code.gs`
- Create: `apps-script/pontos-internos/appsscript.json`
- Create: `apps-script/pontos-internos/README.md`
- Create: `tests/pontosinternos-appsscript.test.cjs`

**Interfaces:**
- Consumes: JSON `{ action: 'appendPoints', requestId, responsible, rows[] }`.
- Produces: JSON `{ ok, duplicateRequest, firstRow, rowCount, requestId }`.

- [ ] **Step 1: Escrever teste contratual do payload e das colunas A:I**

```js
test('linha C recebe nicks agrupados e somente a coluna da categoria recebe o rótulo', () => {
  assert.deepEqual(app.toSheetRow({ responsible: 'Pegas', nicks: 'A / B', category: 'C', label: 'META CUMPRIDA (PROFESSOR)', print: '' }, now), [now, 'Pegas', 'A / B', '[C] HIERARQUIA & METAS', '', '', 'META CUMPRIDA (PROFESSOR)', '', '']);
});
```

- [ ] **Step 2: Implementar validação antes da escrita**

Validar `requestId`, responsável, 1 a 100 grupos, categoria A-D, rótulo até 160 caracteres, nicks até 5000 caracteres e URL HTTPS opcional para print.

- [ ] **Step 3: Implementar trava, idempotência e escrita única**

```js
const lock = LockService.getScriptLock();
lock.waitLock(20000);
try {
  const properties = PropertiesService.getScriptProperties();
  const receipt = properties.getProperty(`request:${requestId}`);
  if (receipt) return json_(JSON.parse(receipt));
  const firstRow = sheet.getLastRow() + 1;
  sheet.getRange(firstRow, 1, values.length, 9).setValues(values);
  const result = { ok: true, duplicateRequest: false, firstRow, rowCount: values.length, requestId };
  properties.setProperty(`request:${requestId}`, JSON.stringify(result));
  return json_(result);
} finally {
  lock.releaseLock();
}
```

- [ ] **Step 4: Escrever instruções exatas de implantação**

O README deve explicar: abrir Apps Script na planilha, substituir `Code.gs`, ajustar manifest, executar `setup`, implantar como aplicativo web executando como proprietário e copiar a URL `/exec` para Configurações.

- [ ] **Step 5: Executar testes do contrato e lint sintático compatível**

Run: `node --test tests/pontosinternos-appsscript.test.cjs`
Expected: PASS para validação, mapeamento, idempotência simulada e falha sem escrita.

- [ ] **Step 6: Commitar o Apps Script**

```bash
git add apps-script/pontos-internos tests/pontosinternos-appsscript.test.cjs
git commit -m "feat: adicionar endpoint de pontos internos"
```

### Task 6: Integração, recibos e recuperação

**Files:**
- Modify: `pontosinternos.js`
- Modify: `pontosinternos.css`
- Create: `tests/pontosinternos-submit.test.cjs`

**Interfaces:**
- Consumes: `groupSelected`, URL `/exec`, `appendReceipt`.
- Produces: `submitSelected(candidates)`, recibo visível e recuperação de confirmação.

- [ ] **Step 1: Escrever testes de clique duplo, erro e confirmação**

```js
test('clique duplo compartilha a mesma promessa e requestId', async () => {
  const first = app.submitSelected(items);
  const second = app.submitSelected(items);
  assert.equal(first, second);
  await first;
  assert.equal(fetchCalls.length, 1);
});
```

- [ ] **Step 2: Implementar envio e estado pendente local**

Gerar UUID uma vez, persistir rascunho do lote no `localStorage`, desabilitar o botão e reutilizar o mesmo ID em retry até obter resposta conclusiva.

- [ ] **Step 3: Registrar recibo no Firebase após confirmação**

O recibo grava os candidatos individuais, agrupamentos enviados, autor, período, fonte, linhas retornadas e `requestId`. A mensagem final será `Enviado para conferência na planilha`, nunca `Pontos aprovados`.

- [ ] **Step 4: Executar toda a suíte do módulo**

Run: `node --check pontosinternos.js && node --test tests/pontosinternos-*.test.cjs`
Expected: PASS.

- [ ] **Step 5: Commitar a integração**

```bash
git add pontosinternos.js pontosinternos.css tests/pontosinternos-submit.test.cjs
git commit -m "feat: enviar e registrar lotes de pontos"
```

### Task 7: Verificação, regras e publicação

**Files:**
- Modify only if a verified defect is found in the files above.

**Interfaces:**
- Consumes: módulo completo e ruleset completo.
- Produces: commits remotos e regras implantadas com evidência.

- [ ] **Step 1: Rodar testes novos e regressão do repositório**

Run: `node --test tests/pontosinternos-*.test.cjs tests/centralavaliacoes-backup.test.cjs`
Expected: todos os testes selecionados passam.

- [ ] **Step 2: Comparar regras e confirmar que apenas o bloco de pontos internos mudou**

Run: `git -C "D:\NEXUS V2.0\nexus-app" diff -- firestore.rules`
Expected: nenhuma alteração em matches existentes.

- [ ] **Step 3: Implantar regras Firestore**

Run: `firebase deploy --only firestore:rules --project nexusprof --non-interactive`
Expected: compilação bem-sucedida e `Deploy complete!`.

- [ ] **Step 4: Fazer verificação visual local em desktop e mobile**

Servir `D:\profassets`, abrir `pontosinternos.html`, verificar as quatro áreas, preview, duplicidade, formulário manual, configurações e estados sem efetuar postagem real.

- [ ] **Step 5: Enviar os commits aos remotos corretos**

```bash
git -C D:\profassets push origin main
git -C "D:\NEXUS V2.0\nexus-app" push production HEAD:main
```

- [ ] **Step 6: Confirmar os assets públicos e entregar instalação**

Verificar que GitHub Pages contém `pontosinternos.js`, `pontosinternos.css` e `pontosinternos.html`. Entregar ao usuário o caminho de `apps-script/pontos-internos/README.md` e informar que nenhuma postagem real foi feita antes da implantação do `/exec`.
