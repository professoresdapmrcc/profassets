/*
 * SPP Central de Envios
 * O formulário, o modal e toda a lógica da interface são montados por este arquivo.
 * Não coloque senhas, tokens administrativos ou segredos neste JavaScript público.
 */

const SPP_APP_MARKUP = String.raw`<a class="skip-link" href="#main">Ir para o formulário</a>

  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">
          <img src="./ioADcOs.gif" alt="">
        </div>
        <div class="brand-copy">
          <strong>SPP CENTRAL DE ENVIOS</strong>
          <span>Serviço de Proteção dos Professores</span>
        </div>
      </div>
    </header>

    <div class="layout">
      <aside class="panel sidebar" aria-label="Etapas do formulário">
        <p class="eyebrow">Novo registro</p>
        <h2>Fluxo da ocorrência</h2>
        <ol class="steps">
          <li class="step active" data-step="1"><span class="step-number">01</span><span><strong>Carta</strong><span>Escolha a medida</span></span></li>
          <li class="step" data-step="2"><span class="step-number">02</span><span><strong>Caso</strong><span>Consulte a planilha</span></span></li>
          <li class="step" data-step="3"><span class="step-number">03</span><span><strong>Dados</strong><span>Confira o registro</span></span></li>
          <li class="step" data-step="4"><span class="step-number">04</span><span><strong>Revisão</strong><span>Confirme o fluxo</span></span></li>
        </ol>
        <div class="permission-card">
          <span>Permissão aplicada automaticamente</span>
          <strong>Serviço de Proteção dos Professores</strong>
        </div>
      </aside>

      <main id="main" class="panel main-panel">
        <section class="hero">
          <div>
            <p class="eyebrow">Central administrativa</p>
            <h1>Registrar ocorrência</h1>
            <p>Selecione a carta, consulte o caso e revise todas as informações antes de iniciar qualquer publicação.</p>
          </div>
        </section>

        <form id="occurrenceForm" class="form-body" novalidate>
          <section class="letter-stage" aria-labelledby="letter-title">
            <div class="section-head">
              <div>
              <h2 id="letter-title">1. Selecione a carta</h2>
              <p>A escolha é manual e não será alterada pela ação sugerida na planilha.</p>
              </div>
            </div>
            <div class="letter-select-wrap">
              <label class="helper" for="letterSelect">Tipo de carta</label>
              <select id="letterSelect" class="letter-select" name="letter" required>
                <option value="">Selecione uma carta...</option>
                <option value="Aviso">Aviso — erro de postagem</option>
                <option value="Notificação">Notificação — registro por infração</option>
                <option value="Advertência interna">Advertência interna — reincidência formal</option>
                <option value="Medalhas negativas">Medalhas negativas — aplicação de 10 medalhas</option>
                <option value="Rebaixamento">Rebaixamento — 50 medalhas + rebaixamento</option>
                <option value="Expulsão">Expulsão — 100 medalhas + desligamento</option>
              </select>
            </div>
            <div id="selectedLetterPreview" class="selected-letter-preview" aria-live="polite"></div>
          </section>

          <section id="caseSection" class="case-stage" aria-labelledby="case-title">
            <div class="section-head">
              <div><h2 id="case-title">2. Consulte o caso</h2><p>Use o prefixo da equipe, como A1, B76, D34 ou O1.</p></div>
            </div>
            <div class="case-search">
              <div class="field">
                <label for="caseId">Número do caso</label>
                <input id="caseId" name="caseId" type="text" inputmode="text" autocomplete="off" maxlength="8" placeholder="Ex.: B76" aria-describedby="caseHelp caseStatus">
              </div>
              <button id="searchButton" class="btn btn-secondary" type="button">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
                Consultar caso
              </button>
              <span id="caseHelp" class="helper">Casos cancelados serão bloqueados automaticamente.</span>
            </div>
            <div id="caseStatus" class="status" role="status" aria-live="polite"></div>
            <div id="caseData" class="case-data" aria-live="polite"></div>
          </section>

          <section id="detailsSection" class="details-stage" aria-labelledby="comments-title">
            <div class="section-head">
              <div><h2 id="comments-title">3. Comentários do responsável</h2><p>Este texto acompanhará o registro e a carta selecionada.</p></div>
            </div>
            <div class="field">
              <label for="comments">Comentários</label>
              <textarea id="comments" name="comments" placeholder="Escreva uma observação objetiva para o membro..."></textarea>
              <span class="helper">Revise nomes, links e informações sensíveis antes de prosseguir.</span>
            </div>
          </section>

          <section class="summary details-stage" aria-labelledby="review-title">
            <div>
              <h2 id="review-title">Pronto para revisar?</h2>
              <p id="summaryText">Selecione uma carta e consulte um caso válido para continuar.</p>
            </div>
            <button id="reviewButton" class="btn btn-primary" type="button" disabled>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
              Revisar envio
            </button>
          </section>
        </form>
      </main>
    </div>
  </div>

  <div id="modalBackdrop" class="modal-backdrop" aria-hidden="true">
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" aria-describedby="modalDescription">
      <div class="modal-head">
        <div><p class="eyebrow">Confirmação</p><h2 id="modalTitle">Revise antes de publicar</h2><p id="modalDescription">Na versão final, essa confirmação antecederá qualquer ação externa.</p></div>
        <button id="closeModal" class="icon-btn" type="button" aria-label="Fechar revisão">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-review-content">
        <div id="reviewList" class="review-list"></div>
        <div class="flow-preview" aria-label="Ordem planejada do envio">
          <div class="flow-item"><span>01</span><strong>Publicar no Quadro de Erros e Advertências</strong></div>
          <div class="flow-item"><span>02</span><strong>Enviar a carta por Mensagem Privada</strong></div>
          <div class="flow-item"><span>03</span><strong>Registrando ocorrência...</strong></div>
        </div>
        <div class="modal-actions">
          <button id="cancelModal" class="btn btn-secondary" type="button">Voltar e editar</button>
          <button id="demoConfirm" class="btn btn-primary" type="button">Confirmar envio</button>
        </div>
      </div>
      <div id="processingState" class="processing-state" role="status" aria-live="polite">
        <div>
          <div class="processing-spinner" aria-hidden="true"></div>
          <strong id="processingTitle">Confirmando o envio...</strong>
          <p id="processingMessage">Registrando ocorrência...</p>
        </div>
      </div>
    </section>
  </div>`;

const sppAppRoot = document.getElementById('spp-app');
if (!sppAppRoot) throw new Error('Elemento #spp-app não encontrado.');
sppAppRoot.innerHTML = SPP_APP_MARKUP;

const API_URL = 'https://script.google.com/macros/s/AKfycbw-Fjt34t6ueyt6NUm4QCT3ABy3IKVEFrZcaFQ__3CYHhOQ4a-A4ArcJfg5J_pzOqW-Gw/exec';
    const state = { letter: '', caseData: null };

    const $ = (selector) => document.querySelector(selector);
    const $$ = (selector) => [...document.querySelectorAll(selector)];
    const form = $('#occurrenceForm');
    const caseInput = $('#caseId');
    const caseStatus = $('#caseStatus');
    const caseData = $('#caseData');
    const searchButton = $('#searchButton');
    const reviewButton = $('#reviewButton');
    const summaryText = $('#summaryText');
    const backdrop = $('#modalBackdrop');
    const modal = backdrop.querySelector('.modal');
    const processingState = $('#processingState');
    const processingTitle = $('#processingTitle');
    const processingMessage = $('#processingMessage');
    let lastFocusedElement = null;
    let processingActive = false;
    let processingTimer = null;
    let countdownTimer = null;

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
    }

    function setStatus(type, message) {
      caseStatus.className = `status visible ${type}`;
      caseStatus.textContent = message;
    }

    function clearCase() {
      state.caseData = null;
      form.classList.remove('has-case');
      caseData.className = 'case-data';
      caseData.replaceChildren();
      updateUi();
    }

    function dataCard(label, value, wide = false) {
      return `<div class="data-card${wide ? ' wide' : ''}"><span>${escapeHtml(label)} · <em class="autofill">automático</em></span><strong>${escapeHtml(value || 'Não informado')}</strong></div>`;
    }

    function renderCase(data) {
      const isOmega = data.tipoRegistro === 'omega';
      const simulatedCargo = 'Professor(a)';
      const cards = [
        dataCard('Cargo + nick', `${simulatedCargo} ${data.infrator}`),
        dataCard('Planilha do erro', data.planilha),
        dataCard('Provas', data.provas)
      ];

      if (isOmega) {
        cards.push(dataCard('Comentários da ocorrência', data.comentarios, true));
      } else {
        cards.splice(2, 0, dataCard('Linha', data.linha));
        cards.push(dataCard('Ocorrência', data.ocorrencia, true));
      }

      caseData.innerHTML = cards.join('');
      caseData.className = 'case-data visible';
      form.classList.add('has-case');
      setStatus('success', `Caso ${data.caso} localizado em ${data.planilha}. Cargo demonstrativo nesta prévia.`);
    }

    function updateSteps() {
      const hasLetter = Boolean(state.letter);
      const hasCase = Boolean(state.caseData);
      $$('.step').forEach((element, index) => {
        const step = index + 1;
        element.classList.toggle('complete', (step === 1 && hasLetter) || (step === 2 && hasCase) || (step === 3 && hasCase));
        element.classList.toggle('active', (step === 1 && !hasLetter) || (step === 2 && hasLetter && !hasCase) || (step === 3 && hasCase) || (step === 4 && hasLetter && hasCase));
      });
    }

    function updateUi() {
      const ready = Boolean(state.letter && state.caseData);
      reviewButton.disabled = !ready;
      summaryText.innerHTML = ready
        ? `Você selecionou <strong>${escapeHtml(state.letter)}</strong> para o caso <strong>${escapeHtml(state.caseData.caso)}</strong>.`
        : 'Selecione uma carta e consulte um caso válido para continuar.';
      updateSteps();
    }

    async function searchCase() {
      const caseId = caseInput.value.trim().replace(/\s+/g, '').toUpperCase();
      caseInput.value = caseId;
      clearCase();

      if (!/^[ABDO]\d{1,6}$/.test(caseId)) {
        setStatus('error', 'Informe um caso válido, como A1, B76, D34 ou O1.');
        caseInput.focus();
        return;
      }

      searchButton.disabled = true;
      searchButton.innerHTML = '<span class="spinner" aria-hidden="true"></span> Consultando';
      setStatus('success', 'Consultando o Boletim de Ocorrências...');

      try {
        const response = await fetch(`${API_URL}?caso=${encodeURIComponent(caseId)}`);
        if (!response.ok) throw new Error('A API não respondeu corretamente.');
        const payload = await response.json();

        if (!payload.ok) {
          setStatus('error', payload.message || 'Não foi possível consultar esse caso.');
          return;
        }

        state.caseData = payload.data;
        renderCase(payload.data);
      } catch (error) {
        setStatus('error', 'Não foi possível consultar o caso. Verifique a conexão e tente novamente.');
      } finally {
        searchButton.disabled = false;
        searchButton.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg> Consultar caso';
        updateUi();
      }
    }

    function openModal() {
      if (!state.letter || !state.caseData) return;
      resetProcessingState();
      const data = state.caseData;
      const rows = [
        ['Carta selecionada', state.letter],
        ['Caso', data.caso],
        ['Planilha', data.planilha],
        ['Membro', `Professor(a) ${data.infrator}`],
        ['Permissão', 'Serviço de Proteção dos Professores']
      ];
      $('#reviewList').innerHTML = rows.map(([label, value]) => `<div class="review-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
      lastFocusedElement = document.activeElement;
      backdrop.classList.add('open');
      backdrop.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      $('#closeModal').focus();
    }

    function closeModal() {
      if (processingActive) return;
      backdrop.classList.remove('open');
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      lastFocusedElement?.focus();
    }

    function resetProcessingState() {
      clearTimeout(processingTimer);
      clearInterval(countdownTimer);
      processingActive = false;
      modal.classList.remove('processing', 'processing-complete');
      processingState.classList.remove('visible');
      processingTitle.textContent = 'Confirmando o envio...';
      processingMessage.textContent = 'Registrando ocorrência...';
      $('#modalTitle').textContent = 'Revise antes de publicar';
      $('#modalDescription').textContent = 'Confira os dados e confirme para iniciar o envio.';
    }

    function confirmSubmission() {
      processingActive = true;
      modal.classList.add('processing');
      processingState.classList.add('visible');
      $('#modalTitle').textContent = 'Confirmando o envio';
      $('#modalDescription').textContent = 'Não feche esta janela durante o processamento.';
      processingTitle.textContent = 'Confirmando o envio...';
      processingMessage.textContent = 'Registrando ocorrência...';

      processingTimer = setTimeout(() => {
        let seconds = 5;
        processingTitle.textContent = 'Envio confirmado';
        processingMessage.innerHTML = `Abrindo o Quadro de Erros e a caixa de mensagem em <span class="countdown-number">${seconds}</span>...`;

        countdownTimer = setInterval(() => {
          seconds -= 1;
          if (seconds > 0) {
            processingMessage.innerHTML = `Abrindo o Quadro de Erros e a caixa de mensagem em <span class="countdown-number">${seconds}</span>...`;
            return;
          }

          clearInterval(countdownTimer);
          processingActive = false;
          modal.classList.add('processing-complete');
          processingMessage.textContent = 'Quadro de Erros e caixa de mensagem prontos para abrir.';
        }, 1000);
      }, 900);
    }

    $('#letterSelect').addEventListener('change', (event) => {
      const previousLetter = state.letter;
      state.letter = event.target.value;
      form.classList.toggle('has-letter', Boolean(state.letter));
      const preview = $('#selectedLetterPreview');
      if (state.letter) {
        preview.innerHTML = `<span>Carta selecionada</span><strong>${escapeHtml(state.letter)}</strong>`;
        preview.classList.add('visible');
        if (previousLetter && previousLetter !== state.letter) clearCase();
        requestAnimationFrame(() => caseInput.focus());
      } else {
        preview.classList.remove('visible');
        clearCase();
      }
      updateUi();
    });

    searchButton.addEventListener('click', searchCase);
    caseInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); searchCase(); } });
    caseInput.addEventListener('input', () => { if (state.caseData && caseInput.value.toUpperCase() !== state.caseData.caso) clearCase(); });
    reviewButton.addEventListener('click', openModal);
    $('#closeModal').addEventListener('click', closeModal);
    $('#cancelModal').addEventListener('click', closeModal);
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeModal(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && backdrop.classList.contains('open')) closeModal(); });
    $('#demoConfirm').addEventListener('click', confirmSubmission);
    form.addEventListener('submit', (event) => event.preventDefault());
    updateUi();
