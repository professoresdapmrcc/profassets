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
          <img src="https://i.imgur.com/ioADcOs.gif" alt="">
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
              <textarea id="comments" name="comments" maxlength="1000" placeholder="Escreva uma observação objetiva para o membro..."></textarea>
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
    <footer class="spp-footer">
      <p>Desenvolvido por Sr.Gabriel.</p>
      <p>Todos os direitos reservados a Companhia dos Professores</p>
    </footer>
  </div>

  <div id="modalBackdrop" class="modal-backdrop" aria-hidden="true">
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" aria-describedby="modalDescription">
      <div class="modal-head">
        <div><p class="eyebrow">Confirmação</p><h2 id="modalTitle">Revise antes de publicar</h2><p id="modalDescription">Confira os dados e confirme para iniciar o envio.</p></div>
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

const sppAppRoot = document.getElementById('app') || document.getElementById('spp-app');
if (!sppAppRoot) throw new Error('Elemento #app não encontrado.');
sppAppRoot.innerHTML = SPP_APP_MARKUP;

const API_URL = 'https://script.google.com/macros/s/AKfycbw-Fjt34t6ueyt6NUm4QCT3ABy3IKVEFrZcaFQ__3CYHhOQ4a-A4ArcJfg5J_pzOqW-Gw/exec';
// CARTAS ORIGINAIS: conteúdo integral enviado pelo usuário.
// Os placeholders abaixo recebem os dados do caso; não reescrever os textos das cartas.
const CARTA_SPP_ERRO_TEMPLATE = `[font=Poppins][table style="width: 100%; border: none!important; overflow: hidden; line-height: 0.6em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="2d0f37"][table style="width: 100%; border: none!important; overflow: hidden; line-height: 0.6em; border-radius: 15px" bgcolor="#4e1a5f"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden"][img]https://i.imgur.com/N4a5Cg5.gif[/img][/td][/tr][/table]\n\n[table style="width: 100%; border: none!important; overflow: hidden; line-height: 0.6em; border-radius: 15px" bgcolor="#4e1a5f"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden"][img]https://i.imgur.com/fGALWSp.gif[/img]\n[color=white][b][size=18][SPP] CARTA DE AVISO[/size][/b][/color]\n\n\n[table style="width: 100%; border: none!important; overflow: hidden; line-height: 1.2em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="ffffff"][table style="width: 100%; border: none!important; overflow: hidden; line-height: 1.4em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="EDF1F2"]\n[center]Olá, [color=#4e1a5f][b]{USERNAME}[/b][/color].[/center]\n\n[center]<div><hr style="border-top:2px solid #4e1a5f;width:25%;margin-top:.3px;padding:1.3%;" /></div>[/center]\n[justify][b][color=#4e1a5f]O Serviço de Proteção de Professores[/color][/b] vem, por meio desta Mensagem Privada, informar que você cometeu uma infração. Confira a ocorrência abaixo:\n\n[color=#4e1a5f][b]Número do caso/erro:[/b][/color] {SPP_NUMERO_CASO_ERRO}\n[color=#4e1a5f][b]Planilha da postagem:[/b][/color] {SPP_PLANILHA_POSTAGEM}\n[color=#4e1a5f][b]Linha(s) onde há o erro:[/b][/color] {SPP_LINHAS_ERRO}\n[color=#4e1a5f][b]Ocorrência:[/b][/color] {SPP_OCORRENCIA}\n[color=#4e1a5f][b]Provas:[/b][/color] {SPP_PROVAS}\n[color=#4e1a5f][b]Comentários:[/b][/color] {SPP_COMENTARIOS}[/justify]\n\n[table style="width: 100%; border: none!important; overflow: hidden; line-height: 1.2em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="E1E5E6"][size=10][justify]Pedimos o redobro da atenção para evitar futuras punições. Caso queira contestar esta ocorrência, é necessário recorrer ao Comando do Serviço de Proteção dos Professores apresentando motivos plausíveis e coerentes. Poderá ainda recorrer à Liderança da companhia como última instância.[url=https://sites.google.com/view/nexusprof/documenta%C3%A7%C3%B5es?authuser=3][color=#4e1a5f][b] Clique aqui[/b][/color][/url] para acessar os documentos da companhia dos Professores e ficar a conhecer todas as normativas.[/justify][/size][/td][/tr][/table][/td][/tr][/table][/td][/tr][/table][/td][/tr][/table][/td][/tr][/table][/font]`;

const CARTA_SPP_ADV_VERBAL_TEMPLATE = `[font=Poppins][table style="width: 100%; border: none!important; overflow: hidden; line-height: 0.6em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="2d0f37"][table style="width: 100%; border: none!important; overflow: hidden; line-height: 0.6em; border-radius: 15px" bgcolor="#4e1a5f"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden"][img]https://i.imgur.com/N4a5Cg5.gif[/img][/td][/tr][/table]\n\n[table style="width: 100%; border: none!important; overflow: hidden; line-height: 0.6em; border-radius: 15px" bgcolor="#4e1a5f"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden"][img]https://i.imgur.com/fGALWSp.gif[/img]\n[color=white][b][size=18][SPP] CARTA DE NOTIFICAÇÃO[/size][/b][/color]\n\n\n[table style="width: 100%; border: none!important; overflow: hidden; line-height: 1.2em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="ffffff"][table style="width: 100%; border: none!important; overflow: hidden; line-height: 1.4em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="EDF1F2"]\n[center]Olá, [color=#4e1a5f][b]{USERNAME}[/b][/color].[/center]\n\n[center]<div><hr style="border-top:2px solid #4e1a5f;width:25%;margin-top:.3px;padding:1.3%;" /></div>[/center]\n[justify][b][color=#4e1a5f]O Serviço de Proteção de Professores[/color][/b] vem, por meio desta Mensagem Privada, informar que você cometeu uma infração. Confira a ocorrência abaixo:\n\n[color=#4e1a5f][b]Número do caso/erro:[/b][/color] {SPP_NUMERO_CASO_ERRO}\n[color=#4e1a5f][b]Planilha da postagem:[/b][/color] {SPP_PLANILHA_POSTAGEM}\n[color=#4e1a5f][b]Linha(s) onde há o erro:[/b][/color] {SPP_LINHAS_ERRO}\n[color=#4e1a5f][b]Ocorrência:[/b][/color] {SPP_OCORRENCIA}\n[color=#4e1a5f][b]Provas:[/b][/color] {SPP_PROVAS}\n[color=#4e1a5f][b]Comentários:[/b][/color] {SPP_COMENTARIOS}[/justify]\n\n[table style="width: 100%; border: none!important; overflow: hidden; line-height: 1.2em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="E1E5E6"][size=10][justify]Note que [b][color=#4e1a5f]o acúmulo de 03 (três) notificações resultam numa advertência interna[/color][/b]. Pedimos o redobro da atenção para evitar futuras punições. Caso queira contestar esta ocorrência, é necessário recorrer ao Comando do Serviço de Proteção dos Professores apresentando motivos plausíveis e coerentes. Poderá ainda recorrer à Liderança da companhia como última instância.[url=https://sites.google.com/view/nexusprof/documenta%C3%A7%C3%B5es?authuser=3][color=#4e1a5f][b] Clique aqui[/b][/color][/url] para acessar os documentos da companhia dos Professores e ficar a conhecer todas as normativas. [b][color=#4e1a5f]Se a ocorrência em causa incorrer de anulação de aula, o seu relatório não contabilizará para a meta vigente.[/color][/b][/justify][/size][/td][/tr][/table][/td][/tr][/table][/td][/tr][/table][/td][/tr][/table][/td][/tr][/table][/font]`;

const CARTA_SPP_ADV_INTERNA_TEMPLATE = `[font=Poppins][table style="width: 100%; border: none!important; overflow: hidden; line-height: 0.6em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="2d0f37"][table style="width: 100%; border: none!important; overflow: hidden; line-height: 0.6em; border-radius: 15px" bgcolor="#4e1a5f"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden"][img]https://i.imgur.com/N4a5Cg5.gif[/img][/td][/tr][/table]\n\n[table style="width: 100%; border: none!important; overflow: hidden; line-height: 0.6em; border-radius: 15px" bgcolor="#4e1a5f"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden"][img]https://i.imgur.com/fGALWSp.gif[/img]\n[color=white][b][size=18][SPP] CARTA DE ADVERTÊNCIA INTERNA[/size][/b][/color]\n\n\n[table style="width: 100%; border: none!important; overflow: hidden; line-height: 1.2em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="ffffff"][table style="width: 100%; border: none!important; overflow: hidden; line-height: 1.4em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="EDF1F2"]\n[center]Olá, [color=#4e1a5f][b]{USERNAME}[/b][/color].[/center]\n\n[center]<div><hr style="border-top:2px solid #4e1a5f;width:25%;margin-top:.3px;padding:1.3%;" /></div>[/center]\n[justify][b][color=#4e1a5f]O Serviço de Proteção de Professores[/color][/b] vem, por meio desta Mensagem Privada, informar que você cometeu uma infração. Confira a ocorrência abaixo:\n\n[color=#4e1a5f][b]Número do caso/erro:[/b][/color] {SPP_NUMERO_CASO_ERRO}\n[color=#4e1a5f][b]Planilha da postagem:[/b][/color] {SPP_PLANILHA_POSTAGEM}\n[color=#4e1a5f][b]Linha(s) onde há o erro:[/b][/color] {SPP_LINHAS_ERRO}\n[color=#4e1a5f][b]Ocorrência:[/b][/color] {SPP_OCORRENCIA}\n[color=#4e1a5f][b]Provas:[/b][/color] {SPP_PROVAS}\n[color=#4e1a5f][b]Comentários:[/b][/color] {SPP_COMENTARIOS}[/justify]\n\n[table style="width: 100%; border: none!important; overflow: hidden; line-height: 1.2em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="E1E5E6"][size=10][justify]Note que [b][color=#4A185D]o acúmulo de 03 (três) advertências internas resultam na expulsão da companhia, caso seja professor, ou rebaixamento, caso seja coordenador+[/color][/b]. Pedimos o redobro da atenção para evitar futuras punições. Caso queira contestar esta ocorrência, é necessário recorrer ao Comando do Serviço de Proteção dos Professores apresentando motivos plausíveis e coerentes. Poderá ainda recorrer à Liderança da companhia como última instância.[url=https://sites.google.com/view/nexusprof/documenta%C3%A7%C3%B5es?authuser=3][color=#4A185D][b] Clique aqui[/b][/color][/url] para acessar os documentos da companhia dos Professores e ficar a conhecer todas as normativas. [b][color=#4A185D]Se a ocorrência em causa incorrer de anulação de aula, a sua aula não contabilizará para a meta semanal.[/color][/b][/justify][/size][/td][/tr][/table][/td][/tr][/table][/td][/tr][/table][/td][/tr][/table][/td][/tr][/table][/font]`;

const CARTA_SPP_MEDALHAS_NEGATIVAS_TEMPLATE = `[font=Poppins][table style="width: 100%; border: none!important; overflow: hidden; line-height: 0.6em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="2d0f37"][table style="width: 100%; border: none!important; overflow: hidden; line-height: 0.6em; border-radius: 15px" bgcolor="#4e1a5f"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden"][img]https://i.imgur.com/N4a5Cg5.gif[/img][/td][/tr][/table]  [table style="width: 100%; border: none!important; overflow: hidden; line-height: 0.6em; border-radius: 15px" bgcolor="#4e1a5f"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden"][img]https://i.imgur.com/fGALWSp.gif[/img] [color=white][b][size=18][SPP] CARTA DE MEDALHAS NEGATIVAS[/size][/b][/color]   [table style="width: 100%; border: none!important; overflow: hidden; line-height: 1.2em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="ffffff"][table style="width: 100%; border: none!important; overflow: hidden; line-height: 1.4em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="EDF1F2"] [center]Olá, [color=#4e1a5f][b]{USERNAME}[/b][/color].[/center]  [center]<div><hr style="border-top:2px solid #4e1a5f;width:25%;margin-top:.3px;padding:1.3%;" /></div>[/center] [justify][b][color=#4e1a5f]O Serviço de Proteção de Professores[/color][/b] vem, por meio desta Mensagem Privada, informar que você foi punido com 10 medalhas negativas efetivas. Confira a ocorrência abaixo:  [color=#4e1a5f][b]Número do caso/erro:[/b][/color] {SPP_NUMERO_CASO_ERRO}
[color=#4e1a5f][b]Planilha da postagem:[/b][/color] {SPP_PLANILHA_POSTAGEM} [color=#4e1a5f][b]Linha(s) onde há o erro:[/b][/color] {SPP_LINHAS_ERRO} [color=#4e1a5f][b]Ocorrência:[/b][/color] {SPP_OCORRENCIA} [color=#4e1a5f][b]Provas:[/b][/color] {SPP_PROVAS} [color=#4e1a5f][b]Comentários:[/b][/color] {SPP_COMENTARIOS}[/justify]  [table style="width: 100%; border: none!important; overflow: hidden; line-height: 1.2em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="E1E5E6"][size=10][justify]Note que [b][color=#4e1a5f]a reincidência futura desta infração resultará na receção de 10 medalhas negativas efetivas adicionais. Ao atingir-se o teto de 30 medalhas negativas efetivas, o membro passará a ser punido com advertências internas pela reincidência deste crime.[/color][/b]. Pedimos o redobro da atenção para evitar futuras punições. Caso queira contestar esta ocorrência, é necessário recorrer ao Comando do Serviço de Proteção dos Professores apresentando motivos plausíveis e coerentes. Poderá ainda recorrer à Liderança da companhia como última instância.[url=https://sites.google.com/view/nexusprof/documenta%C3%A7%C3%B5es?authuser=3][color=#4e1a5f][b]] Clique aqui[/b][/color][/url] para acessar os documentos da companhia dos Professores e ficar a conhecer todas as normativas. [b][color=#4A185D]Se a ocorrência em causa incorrer de anulação de aula, o seu relatório não contabilizará para a meta vigente.[/color][/b][/justify][/size][/td][/tr][/table][/td][/tr][/table][/td][/tr][/table][/td][/tr][/table][/td][/tr][/table][/font]`;

const CARTA_SPP_REBAIXAMENTO_TEMPLATE = `[font=Poppins][table style="width: 100%; border: none!important; overflow: hidden; line-height: 0.6em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="2d0f37"][table style="width: 100%; border: none!important; overflow: hidden; line-height: 0.6em; border-radius: 15px" bgcolor="#4e1a5f"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden"][img]https://i.imgur.com/N4a5Cg5.gif[/img][/td][/tr][/table]  [table style="width: 100%; border: none!important; overflow: hidden; line-height: 0.6em; border-radius: 15px" bgcolor="#4e1a5f"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden"][img]https://i.imgur.com/fGALWSp.gif[/img] [color=white][b][size=18][SPP] CARTA DE REBAIXAMENTO[/size][/b][/color]   [table style="width: 100%; border: none!important; overflow: hidden; line-height: 1.2em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="ffffff"][table style="width: 100%; border: none!important; overflow: hidden; line-height: 1.4em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="EDF1F2"] [center]Olá, [color=#4e1a5f][b]{USERNAME}[/b][/color].[/center]  [center]<div><hr style="border-top:2px solid #4e1a5f;width:25%;margin-top:.3px;padding:1.3%;" /></div>[/center] [justify][b][color=#4e1a5f]O Serviço de Proteção de Professores[/color][/b] vem, por meio desta Mensagem Privada, informar que você foi [b]rebaixado[/b] na companhia dos Professores e penalizado com [b]50 (cinquenta) medalhas efetivas negativas.[/b] Confira a ocorrência abaixo:  [color=#4e1a5f][b]Número do caso/erro:[/b][/color] {SPP_NUMERO_CASO_ERRO}
[color=#4e1a5f][b]Planilha da postagem:[/b][/color] {SPP_PLANILHA_POSTAGEM} [color=#4e1a5f][b]Linha(s) onde há o erro:[/b][/color] {SPP_LINHAS_ERRO} [color=#4e1a5f][b]Ocorrência:[/b][/color] {SPP_OCORRENCIA} [color=#4e1a5f][b]Provas:[/b][/color] {SPP_PROVAS} [color=#4e1a5f][b]Comentários:[/b][/color] {SPP_COMENTARIOS}[/justify]  [table style="width: 100%; border: none!important; overflow: hidden; line-height: 1.2em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="E1E5E6"][size=10][justify]Você tem total direito de procurar algum conselheiro+ para retirar dúvidas, apresentar justificativas ou qualquer problema. Caso queira revogar o seu rebaixamento, é necessário recorrer à Liderança da companhia apresentando motivos plausíveis e coerentes.[url=https://sites.google.com/view/nexusprof/documenta%C3%A7%C3%B5es?authuser=3][color=#4A185D][b]] Clique aqui[/b][/color][/url] para acessar os documentos da companhia dos Professores e ficar a conhecer todas as normativas.[/justify][/size][/td][/tr][/table][/td][/tr][/table][/td][/tr][/table][/td][/tr][/table][/td][/tr][/table][/font]`;

const CARTA_SPP_EXPULSAO_TEMPLATE = `[font=Poppins][table style="width: 100%; border: none!important; overflow: hidden; line-height: 0.6em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="2d0f37"][table style="width: 100%; border: none!important; overflow: hidden; line-height: 0.6em; border-radius: 15px" bgcolor="#4e1a5f"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden"][img]https://i.imgur.com/N4a5Cg5.gif[/img][/td][/tr][/table]  [table style="width: 100%; border: none!important; overflow: hidden; line-height: 0.6em; border-radius: 15px" bgcolor="#4e1a5f"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden"][img]https://i.imgur.com/fGALWSp.gif[/img] [color=white][b][size=18][SPP] CARTA DE EXPULSÃO[/size][/b][/color]   [table style="width: 100%; border: none!important; overflow: hidden; line-height: 1.2em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="ffffff"][table style="width: 100%; border: none!important; overflow: hidden; line-height: 1.4em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="EDF1F2"] [center]Olá, [color=#4e1a5f][b]{USERNAME}[/b][/color].[/center]  [center]<div><hr style="border-top:2px solid #4e1a5f;width:25%;margin-top:.3px;padding:1.3%;" /></div>[/center] [justify][b][color=#4e1a5f]O Serviço de Proteção de Professores[/color][/b] vem, por meio desta Mensagem Privada, informar que você foi [b]expulso[/b] da companhia dos Professores e penalizado com [b]100 (cem) medalhas efetivas negativas.[/b] Confira a ocorrência abaixo:  [color=#4e1a5f][b]Número do caso/erro:[/b][/color] {SPP_NUMERO_CASO_ERRO}
[color=#4e1a5f][b]Planilha da postagem:[/b][/color] {SPP_PLANILHA_POSTAGEM} [color=#4e1a5f][b]Linha(s) onde há o erro:[/b][/color] {SPP_LINHAS_ERRO} [color=#4e1a5f][b]Ocorrência:[/b][/color] {SPP_OCORRENCIA} [color=#4e1a5f][b]Provas:[/b][/color] {SPP_PROVAS} [color=#4e1a5f][b]Comentários:[/b][/color] {SPP_COMENTARIOS}[/justify]  [table style="width: 100%; border: none!important; overflow: hidden; line-height: 1.2em; border-radius: 15px"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="E1E5E6"][size=10][justify]Você tem total direito de procurar algum conselheiro+ para retirar dúvidas, apresentar justificativas ou qualquer problema. Caso queira revogar a sua expulsão, é necessário recorrer à Liderança da companhia apresentando motivos plausíveis e coerentes. No mais, sinta-se à vontade para refazer o teste de admissão para os Professores ou ingressar em outra companhia.[url=https://sites.google.com/view/nexusprof/documenta%C3%A7%C3%B5es?authuser=3][color=#4e1a5f][b]] Clique aqui[/b][/color][/url] para acessar os documentos da companhia dos Professores e ficar a conhecer todas as normativas.[/justify][/size][/td][/tr][/table][/td][/tr][/table][/td][/tr][/table][/td][/tr][/table][/td][/tr][/table][/font]`;

const CARTAS_ORIGINAIS = Object.freeze({
  'Aviso': CARTA_SPP_ERRO_TEMPLATE,
  'Notificação': CARTA_SPP_ADV_VERBAL_TEMPLATE,
  'Advertência interna': CARTA_SPP_ADV_INTERNA_TEMPLATE,
  'Medalhas negativas': CARTA_SPP_MEDALHAS_NEGATIVAS_TEMPLATE,
  'Rebaixamento': CARTA_SPP_REBAIXAMENTO_TEMPLATE,
  'Expulsão': CARTA_SPP_EXPULSAO_TEMPLATE
});

    const PERMISSION = 'Serviço de Proteção dos Professores';
    // Ativar somente depois de publicar a regra específica spp_envios no Firestore.
    // Mantém o envio ao fórum bloqueado enquanto a gravação final não está autorizada.
    const SPP_DEPLOYMENT = { firebaseRulesReady: false };
    const TOPIC_ID = '32246';
    const TOPIC_URL = `https://www.policiarcc.com/t${TOPIC_ID}-?view=newest`;
    const OUTBOX_URL = 'https://www.policiarcc.com/privmsg?folder=outbox';
    const LETTERS = Object.freeze({
      'Aviso': { type: 'erro', punishment: 'ERRO', title: 'AVISO' },
      'Notificação': { type: 'adv_verbal', punishment: 'NOTIFICAÇÃO', title: 'NOTIFICAÇÃO' },
      'Advertência interna': { type: 'adv_interna', punishment: 'ADVERTÊNCIA INTERNA', title: 'ADVERTÊNCIA INTERNA' },
      'Medalhas negativas': { type: 'medalhas_negativas', punishment: 'MEDALHAS NEGATIVAS', title: 'MEDALHAS NEGATIVAS' },
      'Rebaixamento': { type: 'rebaixamento', punishment: 'REBAIXAMENTO', title: 'REBAIXAMENTO' },
      'Expulsão': { type: 'expulsao', punishment: 'EXPULSÃO', title: 'EXPULSÃO' }
    });
    let firebaseConnection;
    async function connectFirebase() {
      if (!firebaseConnection) firebaseConnection = (async () => {
        const firebase = window.firebase;
        if (!firebase?.auth || !firebase?.firestore) throw new Error('As bibliotecas Firebase não carregaram. Atualize a página.');
        const app = firebase.apps.find(item => item.name === 'spp-envios') || firebase.initializeApp({
          apiKey: 'AIzaSyDo4DagZchii1cPKFighZU5KAjppp98HJE',
          authDomain: 'nexusprof.firebaseapp.com', projectId: 'nexusprof',
          appId: '1:268861178598:web:9686b81bb003f9514fb127'
        }, 'spp-envios');
        const auth = app.auth();
        await new Promise((resolve, reject) => {
          let unsubscribe;
          unsubscribe = auth.onAuthStateChanged(() => { unsubscribe?.(); resolve(); }, reject);
        });
        if (!auth.currentUser) await auth.signInAnonymously();
        const sdk = {
          collection: (db, name) => db.collection(name),
          getDocs: reference => reference.get(),
          doc: (db, collection, id) => db.collection(collection).doc(id),
          getDoc: async reference => {
            const snapshot = await reference.get();
            return { exists: () => snapshot.exists };
          },
          setDoc: (reference, data) => reference.set(data),
          serverTimestamp: () => firebase.firestore.FieldValue.serverTimestamp()
        };
        return { db: app.firestore(), sdk };
      })().catch(error => { firebaseConnection = null; throw error; });
      return firebaseConnection;
    }
    async function findFirebaseMember(nickname) {
      const { db, sdk } = await connectFirebase();
      const result = await sdk.getDocs(sdk.collection(db, 'public_members'));
      const key = String(nickname).trim().toLowerCase();
      const matches = result.docs.map(document => document.data())
        .filter(member => String(member.name || '').trim().toLowerCase() === key);
      if (matches.length !== 1 || !matches[0].cargo) throw new Error('Membro não encontrado de forma única no Firebase. Envio bloqueado.');
      if (!['Professor(a)', 'Coordenador(a)', 'Graduador(a)', 'Estagiário(a)', 'Conselheiro(a)', 'PMJ', 'COR', 'Vice-Líder', 'Líder'].includes(matches[0].cargo)) throw new Error('Cargo do membro não autorizado para este formulário.');
      return matches[0];
    }
    function requireForum() {
      if (location.protocol !== 'https:' || !/^(www\.)?policiarcc\.com$/.test(location.hostname)) {
        throw new Error('Abra este formulário no fórum policiarcc.com e entre na sua conta para enviar.');
      }
    }
    async function forumAuthor() {
      requireForum();
      const direct = window._userdata?.username;
      if (direct && !/^(anonymous|guest|convidado)$/i.test(direct)) return direct;
      const response = await fetch('/forum', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('Não foi possível verificar sua sessão do fórum.');
      const html = await response.text();
      const match = html.match(/_userdata\s*(?:\[\s*['"]username['"]\s*\]|\.username)\s*=\s*['"]([^'"]+)['"]/i)
        || html.match(/['"]username['"]\s*:\s*['"]([^'"]+)['"]/i);
      if (!match || /^(anonymous|guest|convidado)$/i.test(match[1])) throw new Error('Entre na sua conta do fórum antes de enviar.');
      const decoder = document.createElement('textarea');
      decoder.innerHTML = match[1];
      return decoder.value;
    }
    function bbText(value) {
      return String(value || '').replace(/\[/g, '［').replace(/\]/g, '］').replace(/</g, '‹').replace(/>/g, '›');
    }
    function fillOriginalLetter({ data, letter, comments }) {
      const template = CARTAS_ORIGINAIS[letter];
      if (!template) throw new Error('Carta original não encontrada. Envio bloqueado.');
      const values = {
        USERNAME: data.infrator,
        SPP_NUMERO_CASO_ERRO: data.caso,
        SPP_PLANILHA_POSTAGEM: data.planilha,
        SPP_LINHAS_ERRO: data.linha || 'Não informado',
        SPP_OCORRENCIA: data.ocorrencia || data.comentarios || comments,
        SPP_PROVAS: data.provas,
        SPP_COMENTARIOS: comments || 'Sem comentários adicionais.'
      };
      return template.replace(/\{(USERNAME|SPP_[A-Z_]+)\}/g, (placeholder, key) => bbText(values[key]));
    }
    function buildMessages(snapshot) {
      const { data, letter, comments, date } = snapshot;
      const definition = LETTERS[letter];
      const reason = data.ocorrencia || data.comentarios || comments;
      if (!reason) throw new Error('Preencha os comentários da ocorrência.');
      const details = `[b]Número do caso:[/b] ${bbText(data.caso)}\n[b]Planilha da postagem:[/b] ${bbText(data.planilha)}\n[b]Ocorrência:[/b] ${bbText(reason)}\n[b]Provas:[/b] ${bbText(data.provas)}\n[b]Comentários:[/b] ${bbText(comments || 'Sem comentários adicionais.')}`;
      return {
        subject: `[SPP] CARTA DE ${definition.title}`,
        board: `[font=Poppins][size=18][center][color=#560c7e][b]${definition.punishment}[/b][/color][/center][/size]\n[justify][b]Cargo e nick:[/b] ${bbText(data.cargo)} ${bbText(data.infrator)}\n[b]Motivo(s):[/b] ${bbText(reason)}\n${details}\n[b]Data:[/b] ${date}\n[b]Permissão:[/b] ${PERMISSION}[/justify][/font]`,
        letter: fillOriginalLetter(snapshot)
      };
    }
    async function forumForm(url) {
      const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('Não foi possível carregar o formulário de envio do fórum.');
      const html = await response.text();
      const page = new DOMParser().parseFromString(html, 'text/html');
      const form = [...page.forms].find(item => item.querySelector('[name="message"]'));
      if (!form || /\/login(?:\?|$)/.test(response.url)) throw new Error('Sessão expirada ou sem permissão para publicar.');
      const values = new URLSearchParams();
      form.querySelectorAll('input[type="hidden"][name]').forEach(input => values.append(input.name, input.value));
      return values;
    }
    async function postForum(endpoint, values, kind) {
      const response = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', body: values });
      if (!response.ok) throw new Error(`O fórum não confirmou ${kind}. Confira o fórum antes de repetir.`);
      const html = await response.text();
      const text = new DOMParser().parseFromString(html, 'text/html').body.textContent.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const confirmed = /mensagem (?:foi )?(?:enviada|publicada|registrada)(?: com sucesso)?|your message has been (?:sent|entered)|message (?:has been )?sent successfully/.test(text);
      if (!confirmed || /\/login(?:\?|$)/.test(response.url)) throw new Error(`Não foi possível confirmar ${kind}. O processo foi interrompido. Verifique se a publicação existe antes de repetir.`);
    }
    function operationKey(data, letter) { return `spp-envio:${data.caso}:${encodeURIComponent(data.infrator)}:${LETTERS[letter].type}`; }
    function saveOperation(key, operation) { localStorage.setItem(key, JSON.stringify(operation)); }
    async function persistOccurrence(snapshot, operation) {
      const { db, sdk } = await connectFirebase();
      const reference = sdk.doc(db, 'assistencia_registros', operation.id);
      if ((await sdk.getDoc(reference)).exists()) return;
      const { data, letter, comments, author, date } = snapshot;
      const [day, month, year] = date.split('/');
      const end = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) + 30));
      await sdk.setDoc(reference, {
        cargo: data.cargo, nick: data.infrator, punicao: LETTERS[letter].punishment,
        caso: data.caso, planilha: data.planilha,
        motivo: data.ocorrencia || data.comentarios || comments, permissao: PERMISSION,
        data_formatada: date, data_iso: `${year}-${month}-${day}`,
        data_termino: `${String(end.getUTCDate()).padStart(2, '0')}/${String(end.getUTCMonth() + 1).padStart(2, '0')}/${end.getUTCFullYear()}`,
        decisao: 'PENDENTE', observacao: comments, carta_enviada: true,
        autor_postagem: author, sincronizado_sheets: false, tipo_ocorrencia: LETTERS[letter].type,
        origem: 'spp_envios', anexo: String(data.provas || '').match(/https?:\/\/[^\s\[\]<>]+/)?.[0] || '',
        timestamp: sdk.serverTimestamp(), atualizadoEm: sdk.serverTimestamp()
      });
    }
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
      const cards = [
        dataCard('Cargo + nick', `${data.cargo} ${data.infrator}`),
        dataCard('Planilha do erro', data.planilha),
        dataCard('Provas', data.provas)
      ];

      if (isOmega) {
        cards.push(dataCard('Comentários da ocorrência', data.comentarios, true));
      } else {
        cards.push(dataCard('Ocorrência', data.ocorrencia, true));
      }

      caseData.innerHTML = cards.join('');
      caseData.className = 'case-data visible';
      form.classList.add('has-case');
      setStatus('success', `Caso ${data.caso} localizado em ${data.planilha}. Membro confirmado no Firebase.`);
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

        const member = await findFirebaseMember(payload.data.infrator);
        state.caseData = { ...payload.data, cargo: member.cargo, infrator: member.name };
        renderCase(state.caseData);
      } catch (error) {
        setStatus('error', error.message || 'Não foi possível consultar o caso.');
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
        ['Membro', `${data.cargo} ${data.infrator}`],
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
      modal.querySelector('.processing-spinner').hidden = false;
      $('#modalTitle').textContent = 'Revise antes de publicar';
      $('#modalDescription').textContent = 'Confira os dados e confirme para iniciar o envio.';
    }

    async function confirmSubmission() {
      if (processingActive || !state.caseData || !LETTERS[state.letter]) return;
      processingActive = true;
      modal.classList.add('processing');
      processingState.classList.add('visible');
      $('#modalTitle').textContent = 'Confirmando o envio';
      $('#modalDescription').textContent = 'Não feche esta janela durante o processamento.';
      processingTitle.textContent = 'Confirmando o envio...';
      processingMessage.textContent = 'Registrando ocorrência...';

      try {
        requireForum();
        if (!SPP_DEPLOYMENT.firebaseRulesReady) throw new Error('Envio bloqueado: a regra de gravação SPP no Firebase precisa ser publicada antes da ativação. Nenhuma postagem ou carta foi enviada.');
        const key = operationKey(state.caseData, state.letter);
        let operation = JSON.parse(localStorage.getItem(key) || 'null');
        if (operation?.pending) throw new Error('Um envio anterior ficou sem confirmação. Confira o tópico e a caixa de envios antes de repetir.');
        if (!operation) {
          const author = await forumAuthor();
          await connectFirebase();
          const member = await findFirebaseMember(state.caseData.infrator);
          const snapshot = {
            data: { ...state.caseData, cargo: member.cargo, infrator: member.name },
            letter: state.letter, comments: $('#comments').value.trim(), author,
            date: new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date())
          };
          if (snapshot.comments.length > 1000 || String(snapshot.data.ocorrencia || snapshot.data.comentarios || snapshot.comments).length > 1500) throw new Error('Comentários: máximo de 1000 caracteres. Ocorrência: máximo de 1500 caracteres.');
          buildMessages(snapshot);
          operation = { id: `spp_${crypto.randomUUID()}`, snapshot, board: false, pm: false, firebase: false, pending: '' };
          saveOperation(key, operation);
        }
        const messages = buildMessages(operation.snapshot);
        if (!operation.board) {
          processingMessage.textContent = 'Publicando no Quadro de Erros e Advertências...';
          const values = await forumForm(`/post?t=${TOPIC_ID}&mode=reply`);
          values.set('t', TOPIC_ID); values.set('mode', 'reply'); values.set('post', 'Enviar'); values.set('message', messages.board);
          operation.pending = 'board'; saveOperation(key, operation);
          await postForum('/post', values, 'a postagem no quadro');
          operation.board = true; operation.pending = ''; saveOperation(key, operation);
        }
        if (!operation.pm) {
          processingMessage.textContent = 'Enviando a carta por Mensagem Privada...';
          const values = await forumForm('/privmsg?mode=post');
          values.set('folder', 'inbox'); values.set('mode', 'post'); values.set('post', '1');
          values.set('username[]', operation.snapshot.data.infrator);
          values.set('subject', messages.subject); values.set('message', messages.letter);
          operation.pending = 'pm'; saveOperation(key, operation);
          await postForum('/privmsg', values, 'o envio da carta');
          operation.pm = true; operation.pending = ''; saveOperation(key, operation);
        }
        if (!operation.firebase) {
          processingMessage.textContent = 'Registrando ocorrência...';
          await persistOccurrence(operation.snapshot, operation);
          operation.firebase = true; saveOperation(key, operation);
        }
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
          modal.querySelector('.processing-spinner').hidden = true;
          processingMessage.textContent = 'Envio concluído. Abrindo o Quadro de Erros e a caixa de envios.';
          processingMessage.insertAdjacentHTML('beforeend', `<br><a href="${OUTBOX_URL}" target="_blank" rel="noopener">Abrir caixa de envios</a> · <a href="${TOPIC_URL}" target="_blank" rel="noopener">Abrir quadro</a>`);
          window.open(OUTBOX_URL, '_blank', 'noopener');
          window.location.assign(TOPIC_URL);
        }, 1000);
      } catch (error) {
        processingActive = false;
        modal.classList.add('processing-complete');
        modal.querySelector('.processing-spinner').hidden = true;
        processingTitle.textContent = 'Envio interrompido';
        processingMessage.textContent = error.message || 'O envio não foi concluído. Confira as etapas antes de tentar novamente.';
        $('#modalTitle').textContent = 'Não foi possível concluir';
        $('#modalDescription').textContent = 'As etapas confirmadas foram preservadas para evitar duplicações.';
      }
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
