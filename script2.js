        // === CONFIGURAÇÃO DA API (BACKEND INTERMEDIÁRIO) ===
        const API_BASE_URL = "https://api-7ljxwrvhpa-uc.a.run.app";
        let autorLogado = "Sistema de Requerimentos (Fórum)";

        // === SOLUÇÃO PARA O COLD START (ACORDAR A API) ===
        let apiAcordada = false;
        function acordarAPI() {
            if (!apiAcordada) {
                apiAcordada = true;
                // Faz uma requisição leve apenas para tirar a API da hibernação
                fetch(API_BASE_URL, { mode: 'no-cors' })
                    .then(() => console.log("Sinal de despertar enviado para a API (Cold Start evitado)."))
                    .catch(() => console.log("Sinal de despertar enviado para a API (Cold Start evitado)."));
            }
        }

        // Acorda a API no primeiro clique ou ao focar em qualquer input da página
        document.addEventListener('click', acordarAPI, { once: true });
        document.addEventListener('focusin', acordarAPI, { once: true });

        // FUNÇÃO PARA BUSCAR O NICKNAME NO FORUMEIROS
        async function pegarUsername() {
            try {
                let resposta = await fetch("/forum");
                let html = await resposta.text();
                let regex = /_userdata\["username"\]\s*=\s*"([^"]+)"/;
                let match = html.match(regex);
                if (match && match[1]) {
                    const username = match[1];
                    if (username === "Anonymous") return null; 
                    return username;
                }
                return null;
            } catch (err) {
                console.error("Erro ao buscar o username do fórum:", err);
                return null;
            }
        }

        // === FUNÇÕES DE LÓGICA DA API (FIREBASE) ===

        // Função para formatar o cargo com (a) no final
        function formatarCargo(cargo) {
            if (!cargo) return cargo;
            const cargosComA = ["Professor", "Coordenador", "Graduador", "Estagiário", "Conselheiro"];
            
            // Se o cargo estiver na lista acima, adiciona o (a)
            if (cargosComA.includes(cargo)) {
                return cargo + "(a)";
            }
            // Caso contrário (Vice-Líder, Líder), retorna como está
            return cargo;
        }

        async function enviarParaFirebase(rota, payload) {
            const endpoint = `${API_BASE_URL}/${rota}`;
            try {
                await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } catch (error) {
                console.error(error);
            }
        }

        async function processarFirebaseForm4() {
            const nicknamesRaw = document.querySelector('#form4 input[name="nick_pro"]').value;
            let novoCargo = document.querySelector('#form4 select[name="cargo_pro2"]').value;
            
            novoCargo = formatarCargo(novoCargo); // Aplica a formatação
            
            await enviarParaFirebase('promocao', { nicknames: nicknamesRaw, novoCargo: novoCargo, autor: autorLogado });
        }

        async function processarFirebaseForm5() {
            const nicknamesRaw = document.querySelector('#form5 input[name="nick_reb"]').value;
            let novoCargo = document.querySelector('#form5 select[name="cargo_reb2"]').value;
            
            novoCargo = formatarCargo(novoCargo); // Aplica a formatação
            
            const motivo = document.querySelector('#form5 input[name="motivo_reb"]').value;
            await enviarParaFirebase('rebaixamento', { nicknames: nicknamesRaw, novoCargo: novoCargo, motivo: motivo, autor: autorLogado });
        }

        async function processarFirebaseForm6() {
            const nicknamesRaw = document.querySelector('#form6 input[name="nick_sai"]').value;
            const motivo = document.querySelector('#form6 input[name="motivo_sai"]').value;
            const dataSaida = formatDate();
            await enviarParaFirebase('saida', { nicknames: nicknamesRaw, motivo: motivo, data: dataSaida, autor: autorLogado });
        }

        async function processarFirebaseForm10() {
            const oldNick = document.querySelector('#form10 input[name="nick_atual_transf"]').value;
            const newNick = document.querySelector('#form10 input[name="nick_novo_transf"]').value;
            const dataTransf = formatDate();
            await enviarParaFirebase('transferencia', { oldNick: oldNick, newNick: newNick, data: dataTransf, autor: autorLogado });
        }

        async function registrarLicencaFirebase(nicknamesRaw, diasStr, permissao) {
            const dias = parseInt(diasStr, 10);
            if (isNaN(dias)) return;
            await enviarParaFirebase('licenca', { nicknames: nicknamesRaw, dias: dias, permissao: permissao, autor: autorLogado });
        }

        async function registrarRetornoFirebase(nicknamesRaw) {
            const dataRetorno = formatDate();
            await enviarParaFirebase('retorno', { nicknames: nicknamesRaw, data: dataRetorno, autor: autorLogado });
        }

        const customModalOverlay = document.getElementById('customModalOverlay');
        const modalTitle = document.getElementById('modalTitle');
        const modalText = document.getElementById('modalText');
        const modalCloseBtn = document.getElementById('modalCloseBtn');
        const modalIcon = document.querySelector('.modal-icon i');
        let modalTimer = null;

        function showCustomModal(title, text, options = {}) {
            if (modalTimer) clearTimeout(modalTimer);
            modalTitle.textContent = title;
            modalText.innerHTML = text;

            const iconType = options.icon || 'success';
            const button = modalCloseBtn;

            if (iconType === 'success') {
                modalIcon.className = 'fas fa-check-circle'; modalIcon.style.color = 'var(--success)'; button.style.backgroundColor = 'var(--success)';
            } else if (iconType === 'error') {
                modalIcon.className = 'fas fa-times-circle'; modalIcon.style.color = 'var(--error)'; button.style.backgroundColor = 'var(--error)';
            } else if (iconType === 'warning') {
                modalIcon.className = 'fas fa-exclamation-triangle'; modalIcon.style.color = 'var(--warning)'; button.style.backgroundColor = 'var(--warning)';
            } else if (iconType === 'info') {
                modalIcon.className = 'fas fa-info-circle'; modalIcon.style.color = 'var(--info)'; button.style.backgroundColor = 'var(--info)';
            }

            customModalOverlay.classList.add('show');
            if (options.timer) { modalTimer = setTimeout(hideCustomModal, options.timer); }
            button.style.display = options.buttons === false ? 'none' : 'inline-block';
        }

        function hideCustomModal() {
            customModalOverlay.classList.remove('show');
            if (modalTimer) clearTimeout(modalTimer);
        }

        modalCloseBtn.addEventListener('click', hideCustomModal);
        customModalOverlay.addEventListener('click', (event) => { if (event.target === customModalOverlay) hideCustomModal(); });

        const WELCOME_LETTER_SUBJECT = "[PROF] Carta de boas-vindas";
        const WELCOME_LETTER_BBCODE = `[font=Poppins][table style="border-color: black; border-radius: 15px; overflow: hidden; width: 100%;" bgcolor="821F88"][tr][td][table style="border-color: black; border-radius: 15px; overflow: hidden; width: 100%;" bgcolor="FFFFFF"][tr][td][img]https://i.imgur.com/hU7bn8R.gif[/img]

[table class="rank" style="border: none!important; margin: 0em; line-height: 1em;" bgcolor="#821F88"][tr style="border: none;"][td style="border: none!important;"][img(35px,35px)]https://imgur.com/NHjvyXk.png[/img]

[size=18][color=white][b]CARTA DE BOAS-VINDAS[/b][/color][/size][/td][/tr][/table]
[center]Olá, {USERNAME}!

[center]<div><hr style="border-top:2px solid #821F88;width:25%;margin-top:0px;padding:1%;" /></div>[/center]
Que jogada brilhante a sua de se juntar à galera dos Professores! A família está completa agora, e é uma [b][color=#821F88]HONRA[/color][/b] ter você com a gente.[/center]

<div style="padding:1.5%;border:1px solid #821F88;border-radius:8px;">[table style="border-radius: 15px; border: none; overflow: hidden; width: 100%; font-family: Poppins, sans-serif; line-height: 1.2em"][tr style="overflow: hidden; border: none !important;"][td style="border: none!important; overflow: hidden" bgcolor="f0f0f0"][center][font=Poppins][table class="rank" style="width: 60%; border: none!important; margin: auto; line-height: 1.2em; border-radius: 10px;" bgcolor="#821F88"][tr style="border: none;"][td style="border: none!important; padding: 1%;"][color=#FFFFFF][b][size=16]PODE CONTAR CONOSCO![/size][/b][/color][/td][/tr][/table]

[/font][/center][justify]Nossa missão é clara: te apoiar nessa jornada e garantir que você se sinta em casa. Adaptar-se é normal, mas aqui estamos todos prontos para responder suas dúvidas e te ajudar a mergulhar de cabeça nessa aventura.

Agora, não perca tempo! Aguarde ansiosamente ser [color=#821F88][b]adicionado no subfórum da companhia, no grupo do Habbo[/b][/color] e crie sua conta no [b][color=#821F88]NEXUS[/color][/b]! Não sabe como criar? Fica tranquilo, vamos te ensinar![/justify]


[center][font=Poppins][table class="rank" style="width: 60%; border: none!important; margin: auto; line-height: 1.2em; border-radius: 10px;" bgcolor="#821F88"][tr style="border: none;"][td style="border: none!important; padding: 1%;"][color=#FFFFFF][b][size=16]CRIANDO A CONTA NO NEXUS[/size][/b][/color][/td][/tr][/table][/font][/center]


[justify]O [color=#821F88][b]Nexus[/b][/color] é o principal site da Companhia dos Professores, por lá você poderá encontrar todos os [b][color=#821F88]scripts das aulas, documentações, acessos para funções[/color][/b], além de diversas coisas divertidas para fazer, como [b][color=#821F88]mural de fotos, personalização de perfil pessoal e mural de aniversários![/color][/b]

É indispensável a criação da conta, e por isso deverá criar antes de qualquer outra coisa! Vamos lá?[/justify]

[center][font=Poppins][table class="rank" style="width: 30%; border: none!important; margin: auto; line-height: 1.2em; border-radius: 20px;" bgcolor="#da56e1"][tr style="border: none;"][td style="border: none!important; padding: 5%;"][color=#FFFFFF][b][size=12][url=https://nexusprof.netlify.app/login][img(80px,80px)]https://i.imgur.com/tZybaYR.png[/img][/url]
Para acessar o Nexus, clique aqui.[/size][/b][/color][/td][/tr][/table][/font][/center]

[justify][color=#821f88][b]➣ 1° passo:[/b] [/color] Acesse o Nexus e vá em "CRIAR UMA CONTA";
[color=#821f88][b]➣ 2° passo:[/b] [/color] Preencha as informações solicitadas. O aniversário é opcional;
[color=#821f88][b]➣ 3° passo:[/b] [/color] Coloque o código disponível na missão do Habbo e clique em "Verificar e Cadastrar".[/justify]

Pronto! Agora basta esperar um [b][color=#821F88]administrador do Nexus[/color][/b] (fiscais+ e membros do conselho) aceitar sua conta para você ter acesso à todos os conteúdos e funcionalidades do Nexus!


[center][font=Poppins][table class="rank" style="width: 60%; border: none!important; margin: auto; line-height: 1.2em; border-radius: 10px;" bgcolor="#821F88"][tr style="border: none;"][td style="border: none!important; padding: 1%;"][color=#FFFFFF][b][size=16]O QUE FAZER AGORA??[/size][/b][/color][/td][/tr][/table][/font][/center]


[center] Próxima missão? Realizar a [b][color=#821F88]GRADUAÇÃO I[/color][/b]![/center]


[justify]É só [url=https://docs.google.com/presentation/d/12WB721tarq9DR6ECDq_jIsV1Vdv8pHi8CxVC3kLvxEw/edit][b][color=#821F88]CLICAR AQUI[/color][/b][/url], ler o conteúdo do slide com atenção e, quando se sentir preparado(a), procurar um graduador para realizar a avaliação teórica.

Caso tenha dificuldades para achar um graduador, acesse o tópico [b]"[url=https://www.policiarcc.com/t35035-prof-lista-de-membros][color=#821F88][PROF] Lista de Membros[/color][/url]"[/b] e consulte os nicks de todos os graduadores ativos. Lembre-se: faça o mais rápido possível a sua graduação, senão, pode acabar sendo expulso! [/justify]

[center]Você tem o [b][color=#821F88]prazo de 07 (sete) dias[/color][/b] para a realizar.[/center]

[justify]Além disso, após concluir a sua Graduação I você pode conferir o tópico "[b][url=https://www.policiarcc.com/t34765-prof-inscricoes-departamentais][color=#821F88][PROF] Inscrições Departamentais[/color][/url][/b]" e conhecer os SUBGRUPOS da companhia ou através do nosso slide [url=https://docs.google.com/presentation/d/1wirLOfB2fjIprNEGR35_8AUcE5KF4ZBRcY4YBSo0v5I]"[b][color=#821F88][PROF] Departamentos dos Professores[/color][/b]"[/url].[/justify]


[center][font=Poppins][table class="rank" style="width: 60%; border: none!important; margin: auto; line-height: 1.2em; border-radius: 10px;" bgcolor="#821F88"][tr style="border: none;"][td style="border: none!important; padding: 1%;"][color=#FFFFFF][b][size=16]HORA DA LEITURA!![/size][/b][/color][/td][/tr][/table][/font][/center]

[center]Coisas novas são um pouco assustadoras...[/center]

[justify]But não se preocupe! Através das páginas [url=https://sites.google.com/view/nexusprof/explorando-o-subf%C3%B3rum?authuser=3][color=#821F88][b]"EXPLORANDO O SUBFÓRUM"[/b][/color][/url] e [url=https://sites.google.com/view/profr5654456/manual][color=#821F88][b]"MANUAL DO PROFESSOR"[/b][/color][/url], você ficará mais do que pronto para começar a aplicar aulas, assim que terminar a sua Graduação I! Entre no nosso [color=#821F88][b]grupo do WhatsApp[/b][/color] e no [color=#821F88][b]Discord dos Professores[/b][/color] para se enturmar e retirar dúvidas com facilidade.[/justify]


[table style="width: 100%; border: none!important; overflow: hidden"][tr style="border: none!important; overflow: hidden"][td style="width: 30%; padding-right: 3px; border: none!important; overflow: hidden"][table class="rank attprof" style="border: none!important; line-height: 0.5em; "][tr style="border: none!important; overflow: hidden"][td style="border: none!important; overflow: hidden"][url=https://chat.whatsapp.com/FL4zJpMfdusLW4RxOuQ3Hl][img(35px,35px)]https://i.imgur.com/VVjSWkr.png[/img]

[size=14][color=white][b][color=#ffffff][font=Poppins]GRUPO GERAL[/font][/color][/b][/color][/size]

[color=#ffffff][size=11][b][color=#ffffff]Clique aqui para entrar no grupo do WhatsApp.[/color][/b][/url][/size][/color]

[/td][/tr][/table][/td][td style="width: 30%; padding-right: 10px; border: none!important;"][table class="rank attprof" style="border: none!important; line-height: 0.6em;"][tr style="border: none!important;"][td style="border: none!important;"][url=https://discord.com/invite/DQ8QwpZCyJ][img(35px,35px)]https://i.imgur.com/qj6TMPG.png[/img]

[size=14][color=white][b][color=#ffffff][font=Poppins]DISCORD[/font][/color][/b][/color][/size]

[color=#ffffff][size=11][b][color=#ffffff]Clique aqui para entrar no grupo do Discord.[/color][/b][/url][/size][/color][/td][/tr][/table][/td][/tr][/table][/td][/tr][/table][/td][/tr][/table][/td][/tr][/table][/font]

[font=Poppins][scroll][b][color=#821F88]Estamos torcendo por você. Agora é contigo![/color][/b][/scroll][/font]


[font=Poppins][center][img]https://i.imgur.com/rrsuEHi.gif[/img]

[size=11][font=Poppins][b]Companhia dos Professores[/b>

[b]#[/b]SoberaniaROXA[/font][/size][/center][/font]</div>`;
        const PROMOTION_LETTERS = {
            coordinator: {
                subject: "[PROF] Você foi promovido para Coordenador! LEIA",
                message: `[font=Poppins]<div style="border:1.5rem solid #821F88;border-radius:8px;font-family:Poppins;">[/font][table][tr][td][center][img]https://i.imgur.com/hU7bn8R.gif[/img][/center]

[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][center][img(35px,35px)]https://imgur.com/3Ew0rra.png[/img][/center]
[size=20][font=Poppins][color=white][b]CARTA DE PROMOÇÃO[/b][/color][/font][/size][/td][/tr][/table]
<div style="padding:1.5%;border:1px solid #bdbdbd;border-radius:8px;">[center]Saudações, novo(a) coordenador(a)  [b][color=#821F88]{USERNAME}[/color][/b]![/center]

A [color=#821F88][size=14][b]Comissão de Desenvolvimento Cultural[/b][/size][/color] vem, por meio desta Mensagem Privada, parabenizá-lo por sua promoção a [color=#821F88][size=14][b]Coordenador[/b][/size][/color]!

[justify]A partir de agora você terá novas responsabilidades e atribuições, bem como será visto como um exemplo para o cargo de Professor. Seja sempre íntegro, cumpra suas metas e busque ajudar aqueles que estiveram no mesmo lugar que você.

[center]Entre no grupo do [color=#821F88][size=14][b]WhatsApp[/b][/size][/color] clicando [url=https://chat.whatsapp.com/L9LYJLR7M76I1AcHJlzGw7][color=#821F88][size=14][b]aqui[/b][/size][/color][/url].[/center]

Não se esqueça de realizar sua [color=#821F88][size=14][b]Graduação II[/b][/size][/color] em até [color=#821F88][size=14][b]07 dias[/b][/size][/color] ou poderá ser punido com um rebaixamento ao cargo de Professor. Além disso, caso seja Aspirante+/Analista+, lembre-se de atualizar suas tarefas no RCC System, adicionando [color=#821F88][size=14][b]”Coord.PROF”[/b][/size][/color] a elas. Este procedimento é obrigatório para Oficiais do Corpo Militar e do Corpo Executivo (com Especialização Intermediária+).

Esta Mensagem Privada pretende orientá-lo(a) em detalhes sobre suas novas atribuições, bem como dar dicas para o aprimoramento de seu desempenho na companhia em relação às novas metas semanais e outras contribuições.[/justify]</div>
[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][size=20][font=Poppins][color=white][b]META SEMANAL E ATIVIDADES DISPONÍVEIS[/b][/color][/font][/size][/td][/tr][/table]
<div style="padding:1.5%;border:1px solid #bdbdbd;border-radius:8px;">[justify]Os coordenadores são responsáveis pelo acompanhamento e orientação dos professores. Sendo assim, devem possuir um contato direto com os membros, auxiliando-os e orientando sobre suas metas e responsabilidades. 

A meta semanal do coordenador é de [color=#821F88][size=14][b]100%[/b][/size][/color]. De forma objetiva, as aplicações disponíveis ao complemento de meta dos coordenadores estão subdivididas abaixo:[/justify]</div>
[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][size=20][font=Poppins][color=white][b]CARTA DE AUXÍLIO[/b][/color][/font][/size][/td][/tr][/table]
<div style="padding:1.5%;border:1px solid #bdbdbd;border-radius:8px;">[justify]A cada semana o coordenador é escalado com um professor. O coordenador deverá, então, enviar a Carta a esse professor através do fórum da RCC, cujo BBCODE está disponível no NEXUS, no subfórum dos coordenadores.

O envio desta Mensagem Privada é [color=#821F88][size=14][b]OBRIGATÓRIO[/b][/size][/color], sendo necessário fazê-lo, no máximo, até [color=#821F88][size=14][b]QUARTA-FEIRA[/b][/size][/color] às [color=#821F88][size=14][b]23h59[/b][/size][/color] no fuso horário de Brasília. Clique [url=https://docs.google.com/spreadsheets/d/1EzyhvK4zEI_940ATXnaNQ8KUCxr-2Xj0qRY1MS6extI/edit#gid=686941394][color=#821F88][size=14][b]AQUI[/b][/size][/color][/url] para acessar a escala.

[b]↝[/b] Para comprovar o envio da Carta de Auxílio é necessário tirar um print da caixa de envio do fórum da RCC, devendo a MP em causa ficar devidamente enquadrada.[/justify]

[center][spoiler="Exemplo de comprovação"][img]https://i.ibb.co/6425ByT/1-Ts-Vpq-Tb.png[/img][/spoiler][/center]</div>
[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][size=20][font=Poppins][color=white][b]ACOMPANHAMENTO DE AULA[/b][/color][/font][/size][/td][/tr][/table]
<div style="padding:1.5%;border:1px solid #bdbdbd;border-radius:8px;">[justify]Outra atividade disponível ao coordenador é o acompanhamento de aulas dos professores. Você deverá estar presente na sala de aplicação enquanto um professor aplica um dos cursos de comunicação e, após isso, chamará o professor e realizará uma apreciação da aula aplicada, avaliando os pontos positivos e os pontos negativos que observou. Note que existe um leque de pontos que devem ser mencionados ao longo da sua apreciação.

O acompanhamento de aula vale [color=#821F88][size=14][b]50%[/b][/size][/color] na meta semanal.

Não é permitido acompanhar uma aula onde o professor já foi acompanhado anteriormente durante a mesma semana. [color=#821F88][size=14][b]Por exemplo:[/b][/size][/color] se a professora Amy.Love.Girl teve a aplicação do curso CAC acompanhado pela coordenadora ,Novembro, o coordenador Abismy só poderá acompanhar as aplicações dos cursos restantes, ou seja, CAP, CRO e ACL da professora Amy.Love.Girl.

[b]↝[/b] Para comprovar a realização do acompanhamento de aula é necessário tirar 02 (dois) prints: o primeiro deverá evidenciar a sua presença durante a aplicação do curso de aplicação pelo professor e o segundo deverá conter o desenvolvimento do acompanhamento com o histórico aberto, ou seja, a avaliação da aula já em contacto com o professor.[/justify]

[center][spoiler="Exemplo de comprovação"][img]https://i.ibb.co/PtYGY0t/1-g-Mg-R7-NL.png[/img]
[img]https://i.ibb.co/5TtyzNm/2-e-JEot-Lu.png[/img][/spoiler][/center]</div>
[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][size=20][font=Poppins][color=white][b]ORIENTAÇÕES[/b][/color][/font][/size][/td][/tr][/table]
<div style="padding:1.5%;border:1px solid #bdbdbd;border-radius:8px;">[justify]As orientações são aplicações que devem ser aplicadas aos professores da companhia. Existem 05 (cinco) tipos de orientações, cada um abordando um tema diferente sobre o funcionamento dos Professores.

Não é permitido aplicar uma mesma orientação a um professor que já a obteve anteriormente. Também só poderá aplicar uma orientação a um mesmo professor. [color=#821F88][size=14][b]Por exemplo:[/b][/size][/color] o coordenador :_Wanderson_: aplicou a Orientação I à professora ,Novembro, ou seja, o coordenador :_Wanderson_: não poderá aplicar mais nenhum tipo de orientação à professora ,Novembro. Já você, coordenador {USERNAME}, só poderá aplicar-lhe as orientações II, III, IV ou V.

A aplicação de uma orientação vale [color=#821F88][size=14][b]50%[/b][/size][/color] na meta semanal.

[b]↝[/b] Para comprovar a realização da orientação é necessário tirar 03 (três) prints: o primeiro do início da orientação, o segundo do meio da orientação e o terceiro do fim da orientação. Todos os prints devem ser com o histórico aberto.[/justify]

[center][spoiler="Exemplo de comprovação"][img]https://i.ibb.co/cQB2QyQ/1-gri-Cfj7.png[/img]
[img]https://i.ibb.co/k4mcNzJ/2-ve-Qw-Hcu.png[/img]
[img]https://i.ibb.co/7nV4ZYj/3-t-Ya-RJXu.png[/img][/spoiler][/center]</div>
[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][size=20][font=Poppins][color=white][b]CURSOS OPCIONAIS: CDA E COP[/b][/color][/font][/size][/td][/tr][/table]
<div style="padding:1.5%;border:1px solid #bdbdbd;border-radius:8px;">[justify]Por fim, os coordenadores também possuem dois cursos opcionais para aplicar aos militares da RCC que podem ajudar a complementar a meta: o Curso de Oratória Pública (COP) e o Curso de Desenvolvimento Argumentativo (CDA).

Não é permitido aplicar qualquer um dos cursos a um mesmo militar que já o obteve anteriormente em menos de 15 (quinze) dias. [color=#821F88][size=14][b]Por exemplo:[/b][/size][/color] se a coordenadora lyafrosa aplicou o COP ao capitão Abismy no dia 1 de abril, o capitão Abismy só poderá receber o COP novamente no dia 16 de abril, 15 (quinze) dias depois. A planilha de relatórios dos coordenadores possui um filtro que permite realizar esta verificação facilmente.

Cada aplicação de um curso vale [color=#821F88][size=14][b]35%[/b][/size][/color] na meta semanal.[/justify]</div>
[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][size=20][font=Poppins][color=white][b]FORMAS DE SE DESTACAR[/b][/color][/font][/size][/td][/tr][/table]
<div style="padding:1.5%;border:1px solid #bdbdbd;border-radius:8px;">[justify][b]↝[/b] É claro que, para continuar seu ótimo trabalho, é esperado que você esteja sempre evoluindo em suas responsabilidades. Uma forma de mostrar sua dedicação para além do cumprimento da meta de seu cargo é por meio da utilização da [url=https://www.policiarcc.com/t35734-prof-ouvidoria][color=#821F88][size=14][b]Ouvidoria[/b][/size][/color][/url].

[b]↝[/b] Para cada projeto aprovada, você será gratificado com [color=#821F88][size=14][b]Medalhas Temporárias[/b][/size][/color] e com a aprovação de qualquer proposta, receberá pontuações no [url=https://docs.google.com/spreadsheets/d/1qL4S-vNDI2iONCVtl6fUuWo6EK0v62IWFGydrLKhlbQ/edit#gid=135616877][color=#821F88][size=14][b]Ranking Interno[/b][/size][/color][/url] mostrando sua visão administrativa e habilidade de inovação.

[b]↝[/b] Além disso, a participação em atividades internas, comunicação com membros mais novos e a demonstração de interesse pelos assuntos da Companhia são formas adicionais de exibir seu profissionalismo. Invista nessas pequenas atitudes![/justify]</div>
[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][size=20][font=Poppins][color=white][b]MANUAL E F.A.Q.[/b][/color][/font][/size][/td][/tr][/table]
<div style="padding:1.5%;border:1px solid #bdbdbd;border-radius:8px;">[justify]Para acessar instruções mais específicas do cargo de coordenador ou caso tenha alguma dúvida referente às suas novas atribuições, acesse o [color=#821F88][size=14][b]Manual do Coordenador[/b][/size][/color] e o [color=#821F88][size=14][b]F.A.Q do Coordenador[/b][/size][/color] clicando [url=https://www.policiarcc.com/t36563-nexus-coordenadores][color=#821F88][size=14][b]AQUI[/b][/size][/color][/url] ou procure um Conselheiro+.[/justify]</div>
[table class="rank" style="border: none!important; margin: 0em; line-height: 1.4em;" bgcolor="#821F88"][tr style="border: none;"][td style="border:none!important;"][color=#ffffff][size=11][center][img(40px,40px)]https://i.imgur.com/KCYyTx3.gif[/img]
Atenciosamente,
Comissão de Desenvolvimento Cultural
Companhia dos Professores
[b]#[/b]ConectandoPessoas [b]#[/b]CompartilhandoMomentos[/center][/size][/color][/td][/tr][/table][/td][/tr][/table]</div>`
            },
            graduate: {
                subject: "[PROF] Você foi promovido para Graduador! LEIA",
                message: `[font=Poppins]<div style="border:1.5rem solid #821F88;border-radius:8px;font-family:Poppins;">[/font][table][tr][td][center][img]https://i.imgur.com/hU7bn8R.gif[/img][/center]

[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][center][img(35px,35px)]https://imgur.com/3Ew0rra.png[/img][/center]
[size=20][font=Poppins][color=white][b]CARTA DE PROMOÇÃO[/b][/color][/font][/size][/td][/tr][/table]
<div style="padding:1.5%;border:1px solid #bdbdbd;border-radius:8px;">[center]Saudações, novo(a) graduador(a)  [b][color=#821F88]{USERNAME}[/color][/b]![/center]

A [color=#821F88][size=14][b]Comissão de Desenvolvimento Cultural[/b][/size][/color] vem, por meio desta Mensagem Privada, parabenizá-lo por sua promoção a [color=#821F88][size=14][b]Graduador[/b][/size][/color]!

[justify]A partir de agora você terá novas responsabilidades e atribuições, bem como será visto como um exemplo para o cargo de Professor. Seja sempre íntegro, cumpra suas metas e busque ajudar aqueles que estiveram no mesmo lugar que você.

[center]Entre no grupo do [color=#821F88][size=14][b]WhatsApp[/b][/size][/color] clicando [url=https://chat.whatsapp.com/HJ8xbKwj8HkGEFmnXkwhUM][color=#821F88][size=14][b]aqui[/b][/size][/color][/url].[/center]

Esta Mensagem Privada pretende orientá-lo(a) em detalhes sobre suas novas atribuições, bem como dar dicas para o aprimoramento de seu desempenho na companhia em relação às novas metas quinzenais e outras contribuições. Além disso, caso seja Aspirante+/Analista+, lembre-se de atualizar suas tarefas no RCC System, adicionando [color=#821F88][size=14][b]”Grad.PROF”[/b][/size][/color] a elas. Este procedimento é obrigatório para Oficiais do Corpo Militar e do Corpo Executivo (com Especialização Intermediária+).[/justify]</div>
[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][size=20][font=Poppins][color=white][b]META QUINZENAL E ATIVIDADES DISPONÍVEIS[/b][/color][/font][/size][/td][/tr][/table]
<div style="padding:1.5%;border:1px solid #bdbdbd;border-radius:8px;">[justify]O respectivo cargo responsabiliza-se pela aptidão, assim como formação, dos professores e coordenadores da companhia; dessa forma, a principal finalidade é ensinar e repassar conhecimento e informações essenciais para que os membros, ocupantes dos cargos iniciais, exerçam suas funções e responsabilidades de modo íntegro. Dito isto, dispõe-se as orientações abaixo para o cumprimento das responsabilidades incumbidas a este relevante cargo. 

A meta quinzenal do graduador é de [color=#821F88][size=14][b]02 (duas)[/b][/size][/color] graduações e pode ser acompanhada por meio da [url=https://docs.google.com/spreadsheets/d/154ToDPq8wakIM9W0LIiM_TExwAjunT696pqq0xmP2I8/edit?resourcekey#gid=969911820][color=#821F88][size=14][b]Planilha de Relatórios[/b][/size][/color][/url]. De forma objetiva, as aplicações disponíveis ao complemento de meta dos graduadores estão subdivididas abaixo:[/justify]</div>
[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][size=20][font=Poppins][color=white][b]GRADUAÇÃO I - PROFESSORES[/b][/color][/font][/size][/td][/tr][/table]
<div style="padding:1.5%;border:1px solid #bdbdbd;border-radius:8px;">[justify]Esta graduação é a mais básica e mais recorrente, sendo aplicada aos novos membros da companhia, ou seja, os Professores. É importante que o graduador tenha atenção às seguintes orientações para a aplicação:

[b]↝[/b] Antes de aplicar, confira se realmente o membro faz parte da companhia e está com sua graduação pendente por meio da [url=https://www.policiarcc.com/t33731-prof-lista-de-membros][color=#821F88][size=14][b]Lista de Membros[/b][/size][/color][/url].

[b]↝[/b] Veja se ele foi aprovado na parte teórica da graduação por meio do filtro localizado na [url=https://docs.google.com/spreadsheets/d/154ToDPq8wakIM9W0LIiM_TExwAjunT696pqq0xmP2I8/edit?resourcekey#gid=969911820][color=#821F88][size=14][b]Planilha de Relatórios[/b][/size][/color][/url] ou por meio da [url=https://docs.google.com/spreadsheets/d/1xsGG7qAE4SKqMKWNDv37MxyvqqwJFoJJedwibmAwDTc/edit?resourcekey#gid=1115380793][color=#821F88][size=14][b]Consulta[/b][/size][/color][/url].

[b]↝[/b] A parte prática da graduação I não reprova o(a) professor(a).

[b]↝[/b] Seja paciente e ajude-os com dificuldades, alguns militares podem ser inexperientes e ainda estarem aprendendo a manusear o fórum.[/justify]</div>
[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][size=20][font=Poppins][color=white][b]GRADUAÇÃO II - COORDENADORES[/b][/color][/font][/size][/td][/tr][/table]
<div style="padding:1.5%;border:1px solid #bdbdbd;border-radius:8px;">[justify]Esta graduação é aplicada para os novos coordenadores da companhia. Ainda assim, é importante que o graduador tenha atenção às seguintes orientações para a aplicação:

[b]↝[/b] Antes de aplicar, confira se realmente o membro está com sua graduação pendente por meio da [url=https://www.policiarcc.com/t33731-prof-lista-de-membros][color=#821F88][size=14][b]Lista de Membros[/b][/size][/color][/url].

[b]↝[/b] Seja paciente caso estejam com dificuldades, a mudança de atribuições é de fato considerável e dúvidas podem surgir.[/justify]</div>
[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][size=20][font=Poppins][color=white][b]MANUAL E F.A.Q.[/b][/color][/font][/size][/td][/tr][/table]
<div style="padding:1.5%;border:1px solid #bdbdbd;border-radius:8px;">[justify]Para acessar instruções mais específicas do cargo de graduador ou caso tenha alguma dúvida referente às suas novas atribuições, acesse o [color=#821F88][size=14][b]Manual do Graduador[/b][/size][/color] e o [color=#821F88][size=14][b]F.A.Q do Graduador[/b][/size][/color] clicando [url=https://www.policiarcc.com/t35796-nexus-graduadores][color=#821F88][size=14][b]AQUI[/b][/size][/color][/url] ou procure um Conselheiro+.[/justify]</div>
[table class="rank" style="border: none!important; margin: 0em; line-height: 1.4em;" bgcolor="#821F88"][tr style="border: none;"][td style="border:none!important;"][color=#ffffff][size=11][center][img(40px,40px)]https://i.imgur.com/KCYyTx3.gif[/img]
Atenciosamente,
Comissão de Desenvolvimento Cultural
Companhia dos Professores
[b]#[/b]ConectandoPessoas [b]#[/b]CompartilhandoMomentos[/center][/size][/color][/td][/tr][/table][/td][/tr][/table]</div>`
            }
        };
        const EXPULSION_LETTER = {
            subject: "[PROF] Carta de Expulsão",
            message: `[font=Poppins]<div style="border:1.5rem solid #821F88;border-radius:8px;font-family:Poppins;">[/font][table][tr][td][center][img]https://i.imgur.com/hU7bn8R.gif[/img][/center]

[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][center][img]https://3.bp.blogspot.com/-xgw9Ywvq-kQ/V1ZwrYykphI/AAAAAAAAp0Q/SB7rlT08K3Mqd_vx06J9yXI-GPPuoJwEwCPcB/s1600/ES54A.gif[/img][/center][size=20][font=Poppins][color=white][b]CARTA DE EXPULSÃO[/b][/color][/font][/size][/td][/tr][/table]
<div style="padding:1.5%;border:1px solid #bdbdbd;border-radius:8px;">[justify]Saudações, [b]{USERNAME}[/b].

Informa-se que você foi[b] expulso(a) de nossa companhia e penalizado com cem (100) medalhas negativas[/b] pelo(s) seguinte(s) motivo(s):

[b]{{REASON}}[/b]

[color=#821F88][b]COMENTÁRIOS:[/b][/color] {{COMMENTS}}
[color=#821F88][b]ANEXOS:[/b][/color] {{ATTACHMENTS}}

Leia as documentações que regem a companhia [url=https://sites.google.com/view/nexusprof/documenta%C3%A7%C3%B5es?authuser=3]clicando aqui[/url]. Caso queira recorrer da punição recebida, procure a Liderança apresentando argumentos factuais e plausíveis. Sinta-se à vontade para refazer o teste de admissão para a companhia ou ingressar em uma outra.[/justify]</div>[/td][/tr][/table]</div>
[font=Poppins][center]Atentamente,
[img]https://i.imgur.com/1kZvQHs.png[/img][/center][/font]`
        };
        const DEMOTION_LETTER = {
            subject: "[PROF] Carta de Rebaixamento",
            message: `[font=Poppins]<div style="border:1.5rem solid #821F88;border-radius:8px;font-family:Poppins;">[/font][table][tr][td][center][img]https://i.imgur.com/hU7bn8R.gif[/img][/center]

[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][center][img]https://3.bp.blogspot.com/-xgw9Ywvq-kQ/V1ZwrYykphI/AAAAAAAAp0Q/SB7rlT08K3Mqd_vx06J9yXI-GPPuoJwEwCPcB/s1600/ES54A.gif[/img][/center][size=20][font=Poppins][color=white][b]CARTA DE REBAIXAMENTO[/b][/color][/font][/size][/td][/tr][/table]
<div style="padding:1.5%;border:1px solid #bdbdbd;border-radius:8px;">[justify]Saudações, [b]{USERNAME}[/b].

Informa-se que você foi [b]rebaixado(a) na companhia e penalizado com cinquenta (50) medalhas negativas[/b] pelo(s) seguinte(s) motivo(s):

[b]{{REASON}}[/b]

[color=#821F88][b]COMENTÁRIOS:[/b][/color] {{COMMENTS}}
[color=#821F88][b]ANEXOS:[/b][/color] {{ATTACHMENTS}}

Leia as documentações que regem a companhia [url=https://sites.google.com/view/nexusprof/documenta%C3%A7%C3%B5es?authuser=3]clicando aqui[/url] e procure manter-se atento para evitar mais punições. Caso queira recorrer da punição recebida, procure a Liderança apresentando argumentos factuais e plausíveis.[/justify]</div>[/td][/tr][/table]</div>
[font=Poppins][center]Atentamente,
[img]https://i.imgur.com/1kZvQHs.png[/img][/center][/font]`
        };
        const CONFIG = {
            forumBaseUrl: 'https://www.policiarcc.com',
            mainTopicId: 32243,
            subgroups: { spp: { topicId: 37743, color: '#351241' }, cdc: { topicId: 36345, color: '#560c7e' }, da: { topicId: 32450, color: '#8c54cc' } },
            antifloodDelay: 5000,
            redirectDelay: 2000,

            // Cole aqui a URL /exec gerada ao implantar o arquivo app.gs.
            // Vazio = o site continua normal, apenas sem a cópia no Apps Script.
            appsScriptUrl: "https://script.google.com/macros/s/AKfycbxHAFBDgs3G6xwnNVFRl0cbLGJ0rMw58plEnVo0w4zyEL-KyWy1MhFvIkdkEuTbfuNl1w/exec",
            appsScriptSchemaVersion: 1
        };

        const FORUM_DESTINATIONS = {
            main: { name: 'Companhia dos Professores', shortName: 'PROF', logo: 'https://i.imgur.com/cSDkEWg.png' },
            spp: { name: 'Serviço de Proteção dos Professores', shortName: 'SPP', logo: 'https://i.imgur.com/VEWeefe.png' },
            cdc: { name: 'Comissão de Desenvolvimento Cultural', shortName: 'CDC', logo: 'https://i.imgur.com/F0exubV.png' },
            da: { name: 'Departamento de Aplicação', shortName: 'DA', logo: 'https://i.imgur.com/FAdDQfx.png' }
        };

        function getForumDestinationUrl(path) {
            return new URL(path, CONFIG.forumBaseUrl).href;
        }

        function setSubmitButtonLoading(form) {
            const button = form?.querySelector?.('.btn-submit');
            if (!button) return;
            button.classList.remove('sent');
            button.classList.add('loading');
            button.disabled = true;
        }

        function resetActiveSubmitButton() {
            const button = activeFormGlobal?.querySelector?.('.btn-submit');
            if (!button) return;
            button.classList.remove('loading', 'sent');
            button.disabled = false;
        }

        function markActiveSubmitButtonSent(label = 'Enviado com sucesso') {
            const button = activeFormGlobal?.querySelector?.('.btn-submit.loading, .btn-submit.sent');
            if (!button) return;
            button.classList.remove('loading');
            button.classList.add('sent');
            button.disabled = true;
            button.innerHTML = `<i class="fas fa-check"></i> ${escapeHtml(label)}`;
        }

        function showSubmissionDestinationModal(hasPrivateMessage, title = 'Requerimento enviado!', forumPosts = []) {
            markActiveSubmitButtonSent();
            const requirementsPath = '/t32243-prof-requerimentos-da-companhia';
            const sentboxPath = '/privmsg?folder=outbox';
            const seenTopics = new Set();
            const subgroupPosts = forumPosts.filter(post => {
                const topic = Number(post.topic);
                if (topic === Number(CONFIG.mainTopicId) || seenTopics.has(topic)) return false;
                seenTopics.add(topic);
                return true;
            });

            const actions = [
                `<a class="toast-text-link" href="${getForumDestinationUrl(requirementsPath)}" target="_blank" rel="noopener">ver os requerimentos</a>`
            ];
            if (hasPrivateMessage) {
                actions.push(`<a class="toast-text-link" href="${getForumDestinationUrl(sentboxPath)}" target="_blank" rel="noopener">ver as MPs enviadas</a>`);
            }
            actions.push('<a class="toast-text-link" href="#" id="resetAfterSubmission">postar novamente</a>');

            const inlineActions = actions.length === 2
                ? actions.join(' ou ')
                : `${actions.slice(0, -1).join(', ')} ou ${actions.at(-1)}`;

            const subgroupLinks = subgroupPosts.map(post => {
                const destination = getForumDestination(post);
                return `<a class="toast-text-link" href="${getForumDestinationUrl(`/t${post.topic}-`)}" target="_blank" rel="noopener">${escapeHtml(destination.shortName)}</a>`;
            });
            const subgroupText = subgroupLinks.length
                ? ` Também foi enviado para ${subgroupLinks.join(subgroupLinks.length === 2 ? ' e ' : ', ')}.`
                : '';

            showCustomModal(
                '',
                `${hasPrivateMessage ? 'O requerimento e as mensagens privadas foram enviados com sucesso.' : 'O requerimento foi postado com sucesso.'}${subgroupText} Deseja ${inlineActions}?`,
                { icon: 'success', buttons: false }
            );

            document.getElementById('resetAfterSubmission')?.addEventListener('click', event => {
                event.preventDefault();
                window.location.reload();
            });
        }

        const formTitles = {
            form1: "ENTRADA DE MEMBROS", form2: "EXPULSÃO", form3: "LICENÇA", form4: "PROMOÇÃO", form5: "REBAIXAMENTO", form6: "SAÍDA",
            form7: "PROLONGAMENTO DE LICENÇA", form8: "RETORNO DE LICENÇA", form9: "MIGRAÇÃO DE CORPO", form10: "TRANSFERÊNCIA DE CONTA",
            form11: "REINTEGRAÇÃO", form12: "ATUALIZAÇÃO DA LISTAGEM", form13: "MUDANÇA DE CONSELHO"
        };

        const DRAFT_FORM_CONFIG = {
            form2: { apiUrl: 'https://api.apispreadsheets.com/data/pHa1CnxWpNXxiYfH/', noun: 'expulsão' },
            form4: { apiUrl: 'https://api.apispreadsheets.com/data/oXRMUfskXwCbyArY/', noun: 'promoção' },
            form5: { apiUrl: 'https://api.apispreadsheets.com/data/8LnLGL6kMgWWfopK/', noun: 'rebaixamento' }
        };

        const draftStates = Object.fromEntries(Object.keys(DRAFT_FORM_CONFIG).map(formId => [formId, {
            active: false,
            posting: false,
            items: [],
            originalSubmitHtml: ''
        }]));

        function isDraftModeActive(formId) {
            return Boolean(draftStates[formId]?.active);
        }

        function getDraftActualReason(formId, form) {
            if (formId !== 'form2') return form.querySelector('[name="motivo_reb"], [name="motivo_pro"]')?.value.trim() || '';
            const reasonSelect = form.querySelector('[name="motivo_ex"]');
            return reasonSelect?.selectedOptions[0]?.dataset.customReason === 'true'
                ? document.getElementById('expulsion_custom_reason')?.value.trim() || 'Outro'
                : reasonSelect?.value.trim() || '';
        }

        function buildDraftPrivateMessage(formId, form, details) {
            if (formId === 'form4' && document.getElementById('send_promotion_pm')?.checked) {
                const letterType = document.getElementById('promotion_pm_option')?.dataset.letterType || '';
                const letter = PROMOTION_LETTERS[letterType];
                if (letter) {
                    return {
                        recipients: getPrivateMessageRecipients(details.nicknames),
                        subject: letter.subject,
                        message: letter.message,
                        label: `Carta de promoção para ${details.newRole}`,
                        role: details.newRole,
                        letterType
                    };
                }
            }

            if (formId === 'form5' && document.getElementById('send_demotion_pm')?.checked) {
                const comments = document.getElementById('demotion_comments')?.value.trim() || '';
                const attachments = document.getElementById('demotion_attachments')?.value.trim() || '';
                return {
                    recipients: getPrivateMessageRecipients(details.nicknames),
                    subject: DEMOTION_LETTER.subject,
                    message: DEMOTION_LETTER.message
                        .replace('{{REASON}}', () => details.reason)
                        .replace('{{COMMENTS}}', () => comments)
                        .replace('{{ATTACHMENTS}}', () => attachments),
                    label: 'Carta de rebaixamento',
                    role: details.newRole
                };
            }

            if (formId === 'form2' && document.getElementById('send_expulsion_pm')?.checked) {
                const comments = document.getElementById('expulsion_comments')?.value.trim() || '';
                const attachments = document.getElementById('expulsion_attachments')?.value.trim() || '';
                return {
                    recipients: getPrivateMessageRecipients(details.nicknames),
                    subject: EXPULSION_LETTER.subject,
                    message: EXPULSION_LETTER.message
                        .replace('{{REASON}}', () => details.reason)
                        .replace('{{COMMENTS}}', () => comments)
                        .replace('{{ATTACHMENTS}}', () => attachments),
                    label: 'Carta de expulsão',
                    role: details.currentRole
                };
            }

            return null;
        }

        function captureDraftItem(formId, form, bbcode) {
            const value = selector => form.querySelector(selector)?.value.trim() || '';
            const details = {
                nicknames: value('[name="TAG_ex"], [name="nick_pro"], [name="nick_reb"]'),
                currentRole: value('[name="cargo_ex"], [name="cargo_pro"], [name="cargo_reb"]'),
                newRole: value('[name="cargo_pro2"], [name="cargo_reb2"]'),
                reason: getDraftActualReason(formId, form),
                date: value('input[type="date"]') || formatDate()
            };

            let firebase = null;
            if (formId === 'form4') {
                firebase = {
                    route: 'promocao',
                    payload: { nicknames: details.nicknames, novoCargo: formatarCargo(details.newRole), autor: autorLogado }
                };
            } else if (formId === 'form5') {
                firebase = {
                    route: 'rebaixamento',
                    payload: { nicknames: details.nicknames, novoCargo: formatarCargo(details.newRole), motivo: details.reason, autor: autorLogado }
                };
            }

            return {
                id: createSubmissionEventId(),
                formId,
                formTitle: formTitles[formId],
                capturedAt: new Date().toISOString(),
                details,
                fields: collectAllFormFields(form),
                processedData: processFields($(form).serializeArray()),
                firebase,
                privateMessage: buildDraftPrivateMessage(formId, form, details),
                bbcode
            };
        }

        function getDraftItemSummary(item) {
            if (item.formId === 'form4' || item.formId === 'form5') {
                return `${item.details.currentRole} → ${item.details.newRole}`;
            }
            return `${item.details.currentRole} • ${item.details.reason}`;
        }

        function syncDraftFormHeight(formId) {
            const updateHeight = () => {
                if (!formWrapper || activeFormGlobal?.id !== formId || !activeFormGlobal.classList.contains('active')) return;
                formWrapper.style.minHeight = `${activeFormGlobal.scrollHeight + 36}px`;
            };
            requestAnimationFrame(updateHeight);
            setTimeout(updateHeight, 120);
            setTimeout(updateHeight, 320);
        }

        function renderDraftItems(formId) {
            const state = draftStates[formId];
            const panel = document.querySelector(`[data-draft-panel="${formId}"]`);
            if (!panel) return;
            const list = panel.querySelector('[data-draft-list]');
            const count = panel.querySelector('[data-draft-count]');
            const postButton = panel.querySelector('[data-draft-post-all]');

            list.innerHTML = state.items.length
                ? state.items.map((item, index) => `
                    <div class="draft-item">
                        <span class="draft-item-index">${index + 1}</span>
                        <div class="draft-item-copy">
                            <strong>${escapeHtml(item.details.nicknames)}</strong>
                            <span>${escapeHtml(getDraftItemSummary(item))}</span>
                            ${item.privateMessage ? '<span class="draft-pm-badge"><i class="fas fa-envelope"></i> MP incluída</span>' : ''}
                        </div>
                        <button type="button" class="draft-remove" data-draft-remove="${item.id}" aria-label="Remover do rascunho"><i class="fas fa-times"></i></button>
                    </div>`).join('')
                : '<div class="draft-empty">Nenhum bloco adicionado ainda.</div>';

            count.textContent = `${state.items.length} ${state.items.length === 1 ? 'bloco salvo' : 'blocos salvos'}`;
            postButton.disabled = state.items.length === 0 || state.posting;
            syncDraftFormHeight(formId);
        }

        function resetFormAfterDraft(formId, form) {
            form.reset();
            form.querySelectorAll('select, input[type="checkbox"]').forEach(field => field.dispatchEvent(new Event('change', { bubbles: true })));
            form.querySelectorAll('.invalid').forEach(field => field.classList.remove('invalid'));
            form.querySelector('input:not([type="checkbox"]):not([type="hidden"]), select, textarea')?.focus();
            syncDraftFormHeight(formId);
        }

        function addCurrentFormToDraft(formId, form, bbcode) {
            const state = draftStates[formId];
            state.items.push(captureDraftItem(formId, form, bbcode));
            renderDraftItems(formId);
            resetFormAfterDraft(formId, form);
            showCustomModal(
                'Adicionado ao rascunho',
                `O bloco foi salvo. Você já pode preencher a próxima ${DRAFT_FORM_CONFIG[formId].noun}.`,
                { icon: 'success', buttons: false, timer: 1150 }
            );
        }

        function setDraftMode(formId, active) {
            const state = draftStates[formId];
            if (!active && state.items.length) {
                showCustomModal('Rascunho em andamento', 'Remova os blocos ou use <b>Postar tudo</b> antes de desativar o modo rascunho.', { icon: 'warning' });
                return;
            }

            state.active = active;
            const panel = document.querySelector(`[data-draft-panel="${formId}"]`);
            const form = document.querySelector(`#${formId} form`);
            const submitButton = form?.querySelector('button[type="submit"]');
            panel?.classList.toggle('active', active);
            if (panel) {
                panel.querySelector('[data-draft-workspace]').hidden = !active;
                panel.querySelector('.draft-toggle-state').textContent = active ? 'Ativado' : 'Desativado';
                panel.querySelector('[data-draft-toggle]').setAttribute('aria-pressed', String(active));
            }
            if (submitButton) {
                submitButton.innerHTML = active
                    ? '<i class="fas fa-plus text-xs"></i> Adicionar ao rascunho'
                    : state.originalSubmitHtml;
            }
            renderDraftItems(formId);
            syncDraftFormHeight(formId);
        }

        function initializeDraftModes() {
            Object.keys(DRAFT_FORM_CONFIG).forEach(formId => {
                const form = document.querySelector(`#${formId} form`);
                if (!form || document.querySelector(`[data-draft-panel="${formId}"]`)) return;
                const submitButton = form.querySelector('button[type="submit"]');
                draftStates[formId].originalSubmitHtml = submitButton?.innerHTML || '<i class="fas fa-paper-plane"></i> Enviar requerimento';
                form.insertAdjacentHTML('beforebegin', `
                    <div class="draft-mode-panel" data-draft-panel="${formId}">
                        <div class="draft-mode-heading">
                            <div class="draft-mode-identity">
                                <span class="draft-mode-icon"><i class="fas fa-layer-group"></i></span>
                                <span class="draft-mode-copy">
                                    <strong>Modo rascunho</strong>
                                    <small>Agrupe vários blocos em uma única postagem. O conteúdo é temporário.</small>
                                </span>
                            </div>
                            <button type="button" class="draft-mode-toggle" data-draft-toggle aria-pressed="false">
                                <span class="draft-toggle-state">Desativado</span><span class="draft-switch" aria-hidden="true"></span>
                            </button>
                        </div>
                        <div class="draft-workspace" data-draft-workspace hidden>
                            <div data-draft-list></div>
                            <div class="draft-footer">
                                <span class="draft-count" data-draft-count>0 blocos salvos</span>
                                <button type="button" class="draft-post-all" data-draft-post-all disabled><i class="fas fa-paper-plane"></i> Postar tudo</button>
                            </div>
                        </div>
                    </div>`);

                const panel = document.querySelector(`[data-draft-panel="${formId}"]`);
                panel.querySelector('[data-draft-toggle]').addEventListener('click', () => setDraftMode(formId, !draftStates[formId].active));
                panel.querySelector('[data-draft-post-all]').addEventListener('click', () => postDraftBatch(formId));
                panel.querySelector('[data-draft-list]').addEventListener('click', event => {
                    const removeButton = event.target.closest('[data-draft-remove]');
                    if (!removeButton || draftStates[formId].posting) return;
                    draftStates[formId].items = draftStates[formId].items.filter(item => item.id !== removeButton.dataset.draftRemove);
                    renderDraftItems(formId);
                });
                renderDraftItems(formId);
            });
        }

        let activeFormGlobal = null;

        const formatDate = (date = new Date()) => {
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        };

        // === CÓPIA ASSÍNCRONA E INDEPENDENTE PARA O GOOGLE APPS SCRIPT ===
        let appsScriptUrlWarningShown = false;

        function createSubmissionEventId() {
            if (window.crypto?.randomUUID) return window.crypto.randomUUID();
            return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
        }

        const FIELD_LABEL_OVERRIDES = {
            nick_ent: 'Nickname',
            TAG_ex: 'Nickname',
            nick_pro: 'Nickname',
            nick_reb: 'Nickname',
            nick_sai: 'Nickname',
            nick_mig: 'Nickname',
            nick_reint: 'Nickname',
            nick_conselho: 'Nickname',
            nick_lic: 'Nickname',
            nick_licpro: 'Nickname',
            nick_retlic: 'Nickname',
            nick_atual_transf: 'Nickname atual',
            nick_novo_transf: 'Novo nickname'
        };

        function getFieldLabel(field) {
            if (FIELD_LABEL_OVERRIDES[field.name]) return FIELD_LABEL_OVERRIDES[field.name];
            if (field.id) {
                const explicitLabel = Array.from(document.querySelectorAll('label')).find(label => label.htmlFor === field.id);
                if (explicitLabel) return explicitLabel.innerText.replace(/\s+/g, ' ').trim();
            }

            const parentLabel = field.closest('label');
            if (parentLabel) return parentLabel.innerText.replace(/\s+/g, ' ').trim();
            if (field.placeholder) return field.placeholder;
            if (field.tagName === 'SELECT' && field.options.length) return field.options[0].textContent.trim();
            return field.name || field.id || 'Campo sem identificação';
        }

        function collectAllFormFields(form) {
            return Array.from(form.querySelectorAll('input, select, textarea')).map((field, index) => {
                const type = field.type || field.tagName.toLowerCase();
                const isCheckable = type === 'checkbox' || type === 'radio';
                let displayValue = field.value ?? '';

                if (field.tagName === 'SELECT') {
                    displayValue = Array.from(field.selectedOptions).map(option => option.textContent.trim()).join(' / ');
                    if (field.name === 'motivo_ex' && field.selectedOptions[0]?.dataset.customReason === 'true') {
                        displayValue = document.getElementById('expulsion_custom_reason')?.value.trim() || 'Outro';
                    }
                } else if (isCheckable) {
                    displayValue = field.checked ? 'Sim' : 'Não';
                }

                return {
                    key: field.name || field.id || `field_${index + 1}`,
                    name: field.name || '',
                    id: field.id || '',
                    label: getFieldLabel(field),
                    type,
                    displayValue,
                    rawValue: isCheckable ? field.value : (field.value ?? ''),
                    checked: isCheckable ? field.checked : null,
                    hidden: field.hidden || type === 'hidden' || Boolean(field.closest('[hidden]')),
                    privateMessageOnly: field.hasAttribute('data-private-message-only')
                };
            });
        }

        function getRequestSummary(formId, form) {
            const value = selector => form.querySelector(selector)?.value?.trim() || '';
            const checked = id => Boolean(document.getElementById(id)?.checked);
            const nicknameSelectors = {
                form1: '[name="nick_ent"]', form2: '[name="TAG_ex"]', form3: '[name="nick_lic"]',
                form4: '[name="nick_pro"]', form5: '[name="nick_reb"]', form6: '[name="nick_sai"]',
                form7: '[name="nick_licpro"]', form8: '[name="nick_retlic"]', form9: '[name="nick_mig"]',
                form11: '[name="nick_reint"]', form12: '[name="attlist_tag"]', form13: '[name="nick_conselho"]'
            };

            let nicknames = nicknameSelectors[formId] ? value(nicknameSelectors[formId]) : '';
            if (formId === 'form10') nicknames = `${value('[name="nick_atual_transf"]')} → ${value('[name="nick_novo_transf"]')}`;

            let reason = value('[name="motivo_ex"], [name="motivo_reb"], [name="motivo_sai"]');
            if (formId === 'form2' && form.querySelector('[name="motivo_ex"]')?.selectedOptions[0]?.dataset.customReason === 'true') {
                reason = document.getElementById('expulsion_custom_reason')?.value.trim() || 'Outro';
            }

            const permissions = Array.from(form.querySelectorAll('[name^="perm"]'))
                .map(field => field.value.trim())
                .filter(Boolean);

            const internalGroups = [
                ...Array.from(form.querySelectorAll('[data-license-group].active')).map(button => button.dataset.licenseGroup),
                ...Array.from(form.querySelectorAll('[data-prolong-group].active')).map(button => button.dataset.prolongGroup),
                ...Array.from(form.querySelectorAll('[data-return-group].active')).map(button => button.dataset.returnGroup)
            ].map(group => group.toUpperCase());

            return {
                nicknames,
                currentRole: value('[name="cargo_pro"], [name="cargo_reb"], [name="cargo_sai"], [name="conselho_atual"]'),
                newRole: value('[name="cargo_pro2"], [name="cargo_reb2"], [name="conselho_novo"]'),
                reason,
                permission: permissions.join(' / '),
                days: value('[name="dias_lic"], [name="dias_licpro"]'),
                requestDate: value('input[type="date"]') || formatDate(),
                sendPrivateMessage: checked('send_welcome_pm') || checked('send_promotion_pm') || checked('send_demotion_pm') || checked('send_expulsion_pm'),
                internalGroups
            };
        }

        function buildAppsScriptPayload(form, options = {}) {
            const container = form.closest('.form-container');
            const formId = container?.id || form.id || 'formulario_desconhecido';
            const selectedPrivateMessageType = formId === 'form4'
                ? document.getElementById('promotion_pm_option')?.dataset.letterType || ''
                : ({ form1: 'boas_vindas', form2: 'expulsao', form5: 'rebaixamento' }[formId] || '');

            return {
                schemaVersion: CONFIG.appsScriptSchemaVersion,
                eventId: createSubmissionEventId(),
                sentAt: new Date().toISOString(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
                formId,
                formTitle: formTitles[formId] || formId,
                author: autorLogado,
                pageUrl: window.location.href,
                forumOrigin: window.location.origin,
                userAgent: navigator.userAgent,
                summary: getRequestSummary(formId, form),
                fields: collectAllFormFields(form),
                uiState: {
                    privateMessageType: selectedPrivateMessageType,
                    promotionLetterType: document.getElementById('promotion_pm_option')?.dataset.letterType || '',
                    selectedLicenseGroups: Array.from(form.querySelectorAll('[data-license-group].active')).map(button => button.dataset.licenseGroup),
                    selectedProlongGroups: Array.from(form.querySelectorAll('[data-prolong-group].active')).map(button => button.dataset.prolongGroup),
                    selectedReturnGroups: Array.from(form.querySelectorAll('[data-return-group].active')).map(button => button.dataset.returnGroup)
                },
                forumPosts: Array.isArray(options.forumPosts) ? options.forumPosts : [],
                draftMode: options.draftMode === true,
                draftItems: Array.isArray(options.draftItems) ? options.draftItems : []
            };
        }

        function queueAppsScriptSubmission(form, options = {}) {
            const endpoint = CONFIG.appsScriptUrl.trim();
            if (!endpoint) {
                if (!appsScriptUrlWarningShown) {
                    console.info('ℹ️ Apps Script ainda não configurado. Cole a URL /exec em CONFIG.appsScriptUrl.');
                    appsScriptUrlWarningShown = true;
                }
                return;
            }

            const payload = buildAppsScriptPayload(form, options);

            // Fire-and-forget: não há await. Falha aqui nunca bloqueia fórum,
            // Firebase, API Spreadsheets, MPs ou redirecionamento.
            void fetch(endpoint, {
                method: 'POST',
                mode: 'no-cors',
                keepalive: true,
                headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
                body: JSON.stringify(payload)
            }).catch(error => console.error('❌ Apps Script indisponível; os demais envios continuam normalmente:', error));
        }

        const validateForm = ($form) => {
            let isValid = true;
            $form.find('[required]').each(function () {
                const $field = $(this); let fieldIsValid = true;
                if ($field.is(':checkbox')) { fieldIsValid = $field.is(':checked'); } else { const value = $field.val(); fieldIsValid = value !== null && value.trim() !== ''; }
                if (!fieldIsValid) { $field.addClass('invalid'); isValid = false; } else { $field.removeClass('invalid'); }
            });
            return isValid;
        };

        $(document).on('input change', 'input.invalid, select.invalid, textarea.invalid', function () { $(this).removeClass('invalid'); });

        const mainButton = document.querySelector('.btn');
        const formWrapper = document.querySelector('.form-wrapper');

        if ('ResizeObserver' in window && formWrapper) {
            const activeFormResizeObserver = new ResizeObserver(entries => {
                entries.forEach(entry => {
                    if (entry.target.classList.contains('active')) {
                        formWrapper.style.minHeight = `${entry.target.scrollHeight + 36}px`;
                    }
                });
            });
            document.querySelectorAll('.form-container').forEach(container => activeFormResizeObserver.observe(container));
        }

        function updateButtonDisplay(formId) {
            const buttonTextElement = mainButton.querySelector('span'); const imageDisplay = document.getElementById('imageDisplay');
            const selectedImageDiv = document.getElementById('selectedImage'); const selectedListItem = formId ? document.querySelector(`.dropdown li[onclick="toggleForm('${formId}')"]`) : null;
            document.querySelectorAll('.dropdown li.active').forEach(li => li.classList.remove('active'));

            if (selectedListItem && activeFormGlobal) {
                buttonTextElement.textContent = formTitles[formId]; const iconImgElement = selectedListItem.querySelector('.icon');
                if (iconImgElement?.src && iconImgElement.src !== '' && !iconImgElement.src.endsWith('#') && iconImgElement.src !== window.location.href) {
                    imageDisplay.src = iconImgElement.src; imageDisplay.alt = iconImgElement.alt || `Ícone ${formTitles[formId]}`; selectedImageDiv.classList.add('show');
                } else { selectedImageDiv.classList.remove('show'); imageDisplay.src = ''; imageDisplay.alt = ''; }
                selectedListItem.classList.add('active');
            } else { buttonTextElement.textContent = "Selecione um Requerimento"; selectedImageDiv.classList.remove('show'); imageDisplay.src = ''; imageDisplay.alt = ''; }
        }

        function closeDropdown() { mainButton.classList.remove('active-dropdown'); mainButton.setAttribute('aria-expanded', 'false'); }
        function toggleDropdown() { const isActive = mainButton.classList.toggle('active-dropdown'); mainButton.setAttribute('aria-expanded', isActive.toString()); }

        function toggleForm(formId) {
            closeDropdown(); const newForm = document.getElementById(formId); const formBeingHidden = activeFormGlobal;
            if (formBeingHidden && formBeingHidden !== newForm) { formBeingHidden.classList.remove("active"); }

            if (newForm) {
                if (formBeingHidden === newForm && newForm.classList.contains("active")) {
                    newForm.classList.remove("active"); activeFormGlobal = null; if (formWrapper) formWrapper.style.minHeight = '0px';
                } else {
                    if (formWrapper) { Array.from(formWrapper.children).forEach(child => { if (child.classList.contains('form-container') && child.id !== formId) { child.classList.remove('active'); } }); }
                    newForm.classList.add("active"); activeFormGlobal = newForm;
                    if (formWrapper && activeFormGlobal) { setTimeout(() => { if (activeFormGlobal?.classList.contains('active')) { formWrapper.style.minHeight = `${activeFormGlobal.scrollHeight + 20}px`; } }, 50); }
                }
            } else { if (activeFormGlobal) activeFormGlobal.classList.remove("active"); activeFormGlobal = null; if (formWrapper) formWrapper.style.minHeight = '0px'; }
            updateButtonDisplay(activeFormGlobal ? formId : null);
        }

        mainButton.addEventListener('click', function (event) { if (event.target.closest('li')) return; toggleDropdown(); });
        document.addEventListener('click', function (event) {
            const clickedOutsideButton = !mainButton.contains(event.target); const clickedOutsideForm = (!activeFormGlobal || !activeFormGlobal.contains(event.target)) && (!formWrapper || !formWrapper.contains(event.target));
            if (clickedOutsideButton && clickedOutsideForm && mainButton.classList.contains('active-dropdown')) { closeDropdown(); }
        });
        document.querySelectorAll('.dropdown li').forEach(item => { item.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.click(); } }); });

        const postSubgruposCheckbox = document.getElementById('post_subgrupos');
        const licenseGroupButtons = document.querySelectorAll('#form3 [data-license-group]');
        licenseGroupButtons.forEach(button => {
            button.addEventListener('click', function () {
                const group = this.dataset.licenseGroup;
                const panel = document.querySelector(`#form3 [data-license-panel="${group}"]`);
                const permissionInput = panel?.querySelector('input');
                const selected = !this.classList.contains('active');

                this.classList.toggle('active', selected);
                this.setAttribute('aria-pressed', selected.toString());
                panel?.classList.toggle('show', selected);

                if (permissionInput) {
                    permissionInput.required = selected;
                    if (!selected) {
                        permissionInput.value = '';
                        permissionInput.classList.remove('invalid');
                    } else {
                        setTimeout(() => permissionInput.focus(), 180);
                    }
                }

                if (postSubgruposCheckbox) {
                    postSubgruposCheckbox.checked = document.querySelectorAll('#form3 [data-license-group].active').length > 0;
                }
                if (formWrapper && activeFormGlobal?.id === 'form3') {
                    setTimeout(() => { formWrapper.style.minHeight = `${activeFormGlobal.scrollHeight + 20}px`; }, 100);
                }
            });
        });

        const promotionCurrentRole = document.getElementById('promotion_current_role');
        const promotionNewRole = document.getElementById('promotion_new_role');
        const promotionPmOption = document.getElementById('promotion_pm_option');
        const promotionPmCheckbox = document.getElementById('send_promotion_pm');
        const promotionPmLabel = document.getElementById('promotion_pm_label');
        const promotionPortalNotice = document.getElementById('promotion_portal_notice');

        function updatePromotionMessageOption() {
            const currentRole = promotionCurrentRole?.value || '';
            const newRole = promotionNewRole?.value || '';
            let letterType = '';

            if (currentRole === 'Professor' && newRole === 'Coordenador') letterType = 'coordinator';
            if (currentRole === 'Coordenador' && newRole === 'Graduador') letterType = 'graduate';

            if (promotionPmCheckbox) promotionPmCheckbox.checked = false;
            if (promotionPmOption) {
                promotionPmOption.hidden = !letterType;
                promotionPmOption.dataset.letterType = letterType;
            }
            if (promotionPmLabel && letterType) {
                promotionPmLabel.textContent = letterType === 'coordinator'
                    ? 'Deseja enviar a carta de promoção para Coordenador ao(s) promovido(s)?'
                    : 'Deseja enviar a carta de promoção para Graduador ao(s) promovido(s)?';
            }
            if (promotionPortalNotice) promotionPortalNotice.hidden = !currentRole || !newRole || Boolean(letterType);

            if (formWrapper && activeFormGlobal?.id === 'form4') {
                setTimeout(() => { formWrapper.style.minHeight = `${activeFormGlobal.scrollHeight + 20}px`; }, 100);
            }
        }

        promotionCurrentRole?.addEventListener('change', updatePromotionMessageOption);
        promotionNewRole?.addEventListener('change', updatePromotionMessageOption);

        const demotionPmCheckbox = document.getElementById('send_demotion_pm');
        const demotionPmFields = document.getElementById('demotion_pm_fields');
        demotionPmCheckbox?.addEventListener('change', function () {
            if (demotionPmFields) demotionPmFields.hidden = !this.checked;
            if (!this.checked) {
                const comments = document.getElementById('demotion_comments');
                const attachments = document.getElementById('demotion_attachments');
                if (comments) comments.value = '';
                if (attachments) attachments.value = '';
            } else {
                setTimeout(() => document.getElementById('demotion_comments')?.focus(), 180);
            }
            if (formWrapper && activeFormGlobal?.id === 'form5') {
                setTimeout(() => { formWrapper.style.minHeight = `${activeFormGlobal.scrollHeight + 20}px`; }, 100);
            }
        });

        const expulsionPmCheckbox = document.getElementById('send_expulsion_pm');
        const expulsionPmFields = document.getElementById('expulsion_pm_fields');
        expulsionPmCheckbox?.addEventListener('change', function () {
            if (expulsionPmFields) expulsionPmFields.hidden = !this.checked;
            if (!this.checked) {
                const comments = document.getElementById('expulsion_comments');
                const attachments = document.getElementById('expulsion_attachments');
                if (comments) comments.value = '';
                if (attachments) attachments.value = '';
            } else {
                setTimeout(() => document.getElementById('expulsion_comments')?.focus(), 180);
            }
            if (formWrapper && activeFormGlobal?.id === 'form2') {
                setTimeout(() => { formWrapper.style.minHeight = `${activeFormGlobal.scrollHeight + 20}px`; }, 100);
            }
        });

        const expulsionReasonSelect = document.getElementById('expulsion_reason');
        const expulsionCustomReason = document.getElementById('expulsion_custom_reason');
        const expulsionCustomReasonOption = expulsionReasonSelect?.querySelector('[data-custom-reason="true"]');

        function updateExpulsionCustomReason() {
            const usesCustomReason = expulsionReasonSelect?.selectedOptions[0]?.dataset.customReason === 'true';
            if (expulsionCustomReason) {
                expulsionCustomReason.hidden = !usesCustomReason;
                expulsionCustomReason.required = usesCustomReason;
                if (!usesCustomReason) {
                    expulsionCustomReason.value = '';
                    expulsionCustomReason.classList.remove('invalid');
                    if (expulsionCustomReasonOption) expulsionCustomReasonOption.value = 'Outro';
                }
            }
            if (formWrapper && activeFormGlobal?.id === 'form2') {
                setTimeout(() => { formWrapper.style.minHeight = `${activeFormGlobal.scrollHeight + 20}px`; }, 100);
            }
            if (usesCustomReason) setTimeout(() => expulsionCustomReason?.focus(), 180);
        }

        expulsionReasonSelect?.addEventListener('change', updateExpulsionCustomReason);
        expulsionCustomReason?.addEventListener('input', function () {
            if (expulsionCustomReasonOption) expulsionCustomReasonOption.value = this.value.trim() || 'Outro';
        });

        const prolongPostSubgruposCheckbox = document.getElementById('prolong_post_subgrupos');
        const prolongGroupButtons = document.querySelectorAll('#form7 [data-prolong-group]');
        prolongGroupButtons.forEach(button => {
            button.addEventListener('click', function () {
                const group = this.dataset.prolongGroup;
                const panel = document.querySelector(`#form7 [data-prolong-panel="${group}"]`);
                const permissionInput = panel?.querySelector('input');
                const selected = !this.classList.contains('active');

                this.classList.toggle('active', selected);
                this.setAttribute('aria-pressed', selected.toString());
                panel?.classList.toggle('show', selected);

                if (permissionInput) {
                    permissionInput.required = selected;
                    if (!selected) {
                        permissionInput.value = '';
                        permissionInput.classList.remove('invalid');
                    } else {
                        setTimeout(() => permissionInput.focus(), 180);
                    }
                }

                if (prolongPostSubgruposCheckbox) {
                    prolongPostSubgruposCheckbox.checked = document.querySelectorAll('#form7 [data-prolong-group].active').length > 0;
                }
                if (formWrapper && activeFormGlobal?.id === 'form7') {
                    setTimeout(() => { formWrapper.style.minHeight = `${activeFormGlobal.scrollHeight + 20}px`; }, 100);
                }
            });
        });

        const retornoPostSubgruposCheckbox = document.getElementById('retorno_post_subgrupos');
        const returnGroupButtons = document.querySelectorAll('#form8 [data-return-group]');
        returnGroupButtons.forEach(button => {
            button.addEventListener('click', function () {
                const group = this.dataset.returnGroup;
                const groupCheckbox = document.getElementById(`post_retorno_${group}_cb`);
                const selected = !this.classList.contains('active');

                this.classList.toggle('active', selected);
                this.setAttribute('aria-pressed', selected.toString());
                if (groupCheckbox) groupCheckbox.checked = selected;
                if (retornoPostSubgruposCheckbox) {
                    retornoPostSubgruposCheckbox.checked = document.querySelectorAll('#form8 [data-return-group].active').length > 0;
                }
            });
        });

        function processFields(data) {
            let categorizedData = {};
            data.forEach(item => {
                if (item.name === "TAG") {
                    let values = item.value.split("/").filter(value => value.trim() !== "");
                    values.forEach(value => {
                        let category = value.trim().charAt(0).toUpperCase();
                        if (!categorizedData[category]) categorizedData[category] = [];
                        categorizedData[category].push({ name: item.name, value: value.trim() });
                    });
                } else if (item.name !== "adicionarCampo" && item.name !== "addCampo") {
                    if (!categorizedData[item.name]) categorizedData[item.name] = [];
                    categorizedData[item.name].push(item);
                }
            });
            let processedData = []; Object.values(categorizedData).forEach(categoryItems => { processedData = processedData.concat(categoryItems); }); return processedData;
        }

        function submitToAPI(formId, apiUrl) {
            const $form = $(`#${formId} form`);
            if (!validateForm($form)) { showCustomModal("Atenção!", "Por favor, preencha todos os campos obrigatórios.", { icon: 'warning' }); return false; }
            if (isDraftModeActive(formId)) return false;
            const formData = $form.serializeArray(); const processedData = processFields(formData);
            $.ajax({ url: apiUrl, type: "post", data: processedData, success: function (response) { console.log(`✅ Sheets (${formId}) atualizado!`); }, error: function (xhr, status, error) { console.error(`❌ Erro no Sheets (${formId}):`, error); } });
            return true;
        }

        // Funções que disparam para o Google Sheets E para o Firebase
        function submitForm1() { submitToAPI("form1", "https://api.apispreadsheets.com/data/JV9cVb1igUCGeELy/"); }
        function submitForm2() { submitToAPI("form2", "https://api.apispreadsheets.com/data/pHa1CnxWpNXxiYfH/"); }
        function submitForm4() { if (submitToAPI("form4", "https://api.apispreadsheets.com/data/oXRMUfskXwCbyArY/")) processarFirebaseForm4(); }
        function submitForm5() { if (submitToAPI("form5", "https://api.apispreadsheets.com/data/8LnLGL6kMgWWfopK/")) processarFirebaseForm5(); }
        function submitForm6() { if (submitToAPI("form6", "https://api.apispreadsheets.com/data/S8pqWcmccOyEJRDO/")) processarFirebaseForm6(); }

        function parseForumDocument(html) {
            return new DOMParser().parseFromString(html, 'text/html');
        }

        function forumLoginRequired(documentNode, responseUrl) {
            return /\/login(?:\?|$)/i.test(responseUrl || '')
                || Boolean(documentNode.querySelector('form[action*="/login"] input[name="username"]'));
        }

        function findForumPostingForm(documentNode) {
            return Array.from(documentNode.forms).find(form =>
                form.querySelector('textarea[name="message"], textarea#text_editor_textarea, textarea')
            );
        }

        async function submitForumReply(payload) {
            const forumOrigin = new URL(CONFIG.forumBaseUrl).origin;
            if (window.location.origin !== forumOrigin) {
                throw new Error(`Abra esta página em ${forumOrigin} e entre na sua conta antes de postar.`);
            }

            const replyUrl = new URL('/post', forumOrigin);
            replyUrl.searchParams.set('t', String(payload.t));
            replyUrl.searchParams.set('mode', payload.mode || 'reply');

            const formResponse = await fetch(replyUrl, {
                credentials: 'include',
                redirect: 'follow',
                cache: 'no-store'
            });
            const formHtml = await formResponse.text();
            const formDocument = parseForumDocument(formHtml);

            if (!formResponse.ok) {
                throw new Error(`O fórum respondeu com status ${formResponse.status}.`);
            }
            if (forumLoginRequired(formDocument, formResponse.url)) {
                throw new Error('Entre no fórum antes de usar a postagem automática.');
            }

            const form = findForumPostingForm(formDocument);
            if (!form) {
                throw new Error('O formulário de resposta não foi encontrado. Confirme se o tópico existe, está aberto e você possui permissão para responder.');
            }

            const textarea = form.querySelector('textarea[name="message"], textarea#text_editor_textarea, textarea');
            const body = new FormData(form);
            body.set(textarea.name || 'message', payload.message || '');
            body.set('t', String(payload.t));
            body.set('mode', payload.mode || 'reply');
            body.delete('preview');
            body.set('post', 'Enviar');

            // O requerimento usa HTML dentro do BBCode para renderizar os ícones.
            // A ausência deste campo equivale a deixar "Desativar HTML" desmarcado.
            body.delete('disable_html');

            const actionUrl = new URL(form.getAttribute('action') || '/post', forumOrigin);
            if (actionUrl.origin !== forumOrigin) {
                throw new Error('O formulário do fórum apontou para uma origem inesperada.');
            }

            const postResponse = await fetch(actionUrl, {
                method: 'POST',
                credentials: 'include',
                redirect: 'follow',
                body
            });
            const resultHtml = await postResponse.text();
            const resultDocument = parseForumDocument(resultHtml);

            if (!postResponse.ok) {
                throw new Error(`O fórum recusou o envio com status ${postResponse.status}.`);
            }
            if (forumLoginRequired(resultDocument, postResponse.url)) {
                throw new Error('Sua sessão do fórum expirou. Entre novamente.');
            }
            if (/\/post(?:\?|$)/i.test(postResponse.url || '') && findForumPostingForm(resultDocument)) {
                const forumError = resultDocument.querySelector(
                    '.message-die, .error, .panel .error, .block-error'
                )?.textContent?.trim();
                throw new Error(forumError || 'O fórum não confirmou a publicação.');
            }

            return postResponse.url;
        }

        function postToForum(payload) {
            const deferred = $.Deferred();
            submitForumReply(payload)
                .then(result => deferred.resolve(result))
                .catch(error => deferred.reject(null, 'error', error?.message || String(error)));
            return deferred.promise();
        }

        function getForumDestination(post) {
            if (Number(post.topic) === Number(CONFIG.subgroups.spp.topicId)) return FORUM_DESTINATIONS.spp;
            if (Number(post.topic) === Number(CONFIG.subgroups.cdc.topicId)) return FORUM_DESTINATIONS.cdc;
            if (Number(post.topic) === Number(CONFIG.subgroups.da.topicId)) return FORUM_DESTINATIONS.da;
            return FORUM_DESTINATIONS.main;
        }

        function showForumPostProgress(posts, index, status = 'sending', delayMs = 0) {
            const post = posts[index];
            const destination = getForumDestination(post);
            const isSent = status === 'sent';
            const destinationName = `<strong class="toast-text-emphasis">${escapeHtml(destination.name)}</strong>`;
            let message = `Publicando o requerimento em ${destinationName}. Aguarde um instante.`;
            if (isSent && index < posts.length - 1) {
                message = `Publicado em ${destinationName}. O próximo destino será enviado em <strong class="toast-text-emphasis" id="forumCountdown">${Math.ceil(delayMs / 1000)}</strong>s.`;
            } else if (isSent) {
                message = `Publicação confirmada em ${destinationName}.`;
            }

            showCustomModal(
                '',
                message,
                { icon: isSent ? 'success' : 'info', buttons: false }
            );
        }

        let forumCountdownTimer = null;
        function startForumCountdown(delayMs, onComplete) {
            if (forumCountdownTimer) clearInterval(forumCountdownTimer);
            const endsAt = Date.now() + delayMs;

            const updateCountdown = () => {
                const remainingMs = Math.max(0, endsAt - Date.now());
                const countdownElement = document.getElementById('forumCountdown');
                if (countdownElement) countdownElement.textContent = String(Math.ceil(remainingMs / 1000));

                if (remainingMs <= 0) {
                    clearInterval(forumCountdownTimer);
                    forumCountdownTimer = null;
                    onComplete();
                }
            };

            updateCountdown();
            forumCountdownTimer = setInterval(updateCountdown, 200);
        }

        function postWithDelay(posts, index = 0) {
            if (index >= posts.length) {
                if (forumCountdownTimer) {
                    clearInterval(forumCountdownTimer);
                    forumCountdownTimer = null;
                }
                showSubmissionDestinationModal(false, posts.length > 1 ? 'Todos os destinos foram enviados!' : 'Requerimento enviado!', posts);
                return;
            }
            const post = posts[index]; const isLast = index === posts.length - 1;
            const nextDelay = CONFIG.antifloodDelay;
            showForumPostProgress(posts, index, 'sending');
            postToForum({ t: post.topic, message: post.message, mode: "reply", post: 1 })
                .done(function () {
                    console.log(`✅ Postado em ${post.name}`);
                    showForumPostProgress(posts, index, 'sent', isLast ? 0 : CONFIG.antifloodDelay);
                    if (isLast) {
                        setTimeout(() => postWithDelay(posts, index + 1), 450);
                    } else {
                        startForumCountdown(nextDelay, () => postWithDelay(posts, index + 1));
                    }
                })
                .fail(function (xhr, status, error) {
                    if (forumCountdownTimer) clearInterval(forumCountdownTimer);
                    forumCountdownTimer = null;
                    resetActiveSubmitButton();
                    console.error(`❌ Erro ao postar em ${post.name}:`, error);
                    showCustomModal("Erro!", `Falha ao postar em ${post.name}! Tente novamente.`, { icon: 'error' });
                });
        }

        $(document).ready(function () {
            // Formulário 3 (Licença)
            $('#form3_licenca').on('submit', function (e) {
                e.preventDefault(); if (!validateForm($(this))) { showCustomModal("Atenção!", "Por favor, preencha todos os campos obrigatórios.", { icon: 'warning' }); return; }
                setSubmitButtonLoading(this);
                const nickname = $('#nick_lic').val().trim(); const dias = $('#dias_lic').val().trim(); const permissao = $('#perm_lic').val().trim(); const postSubgrupos = $('#post_subgrupos').is(':checked'); const dataFormatada = formatDate();
                const mainBBCode = `[font=Poppins][center][table style="border-color: black; border-radius: 10px; overflow: hidden; width: auto;" bgcolor="#560c7e"][tr][td][size=16][center][color=#ffffff][b]LICENÇA[/b][/color][/center][/size][/td][/tr][/table][/center][size=13][left][color=#560c7e][b]Nickname[/b][/color]: ${nickname}\n[color=#560c7e][b]Quantidade de dias[/b][/color]: ${dias}\n[color=#560c7e][b]Permissão[/b][/color]: ${permissao}\n[color=#560c7e][b]Data[/b][/color]: ${dataFormatada}\n[color=#560c7e][b]☒[/b][/color] Estou ciente de que, ao término da minha licença, serei automaticamente reintegrado às minhas funções, não sendo necessário postar um requerimento de retorno.[/size][/font][/left]`;
                const postsToMake = [{ topic: CONFIG.mainTopicId, message: mainBBCode, name: "Companhia dos Professores" }];

                if (postSubgrupos) {
                    const permSPP = $('#perm_spp').val().trim();
                    if (permSPP) { const sppBBCode = `[font=Poppins][center][table  style="border-color: black; border-radius: 10px; overflow: hidden; width: auto;" bgcolor="${CONFIG.subgroups.spp.color}"][tr][td][size=16][center][color=#ffffff][b]LICENÇA/RESERVA[/b][/color][/center][/size][/td][/tr][/table][/center]\n[size=13][left][color=${CONFIG.subgroups.spp.color}][b]Nickname[/b][/color]: ${nickname}\n[color=${CONFIG.subgroups.spp.color}][b]Dias[/b][/color]: ${dias}\n[color=${CONFIG.subgroups.spp.color}][b]Permissão[/b][/color]: ${permSPP}\n[color=${CONFIG.subgroups.spp.color}][b]Data[/b][/color]: ${dataFormatada}\n[color=${CONFIG.subgroups.spp.color}][b]☒[/b][/color] Estou ciente de que, ao término da minha licença, serei automaticamente reintegrado às minhas funções, não sendo necessário postar um requerimento de retorno.\n[/size][/font][/left]`; postsToMake.push({ topic: CONFIG.subgroups.spp.topicId, message: sppBBCode, name: "SPP" }); }
                    const permCDC = $('#perm_cdc').val().trim();
                    if (permCDC) { const cdcBBCode = `[font=Poppins][center][table style="border-color: black; border-radius: 10px; overflow: hidden; width: auto;" bgcolor="${CONFIG.subgroups.cdc.color}"][tr][td][size=16][center][color=#ffffff][b]LICENÇA/RESERVA[/b][/color][/center][/size][/td][/tr][/table][/center][size=13][left][color=${CONFIG.subgroups.cdc.color}][b]Nickname[/b][/color]: ${nickname}\n[color=${CONFIG.subgroups.cdc.color}][b]Quantidade de dias[/b][/color]: ${dias}\n[color=${CONFIG.subgroups.cdc.color}][b]Permissão[/b][/color]: ${permCDC}[/size][/font][/left]`; postsToMake.push({ topic: CONFIG.subgroups.cdc.topicId, message: cdcBBCode, name: "CDC" }); }
                    const permDA = $('#perm_da').val().trim();
                    if (permDA) { const daBBCode = `[font=Poppins][center][table style="border-color: black; border-radius: 10px; overflow: hidden; width: auto;" bgcolor="${CONFIG.subgroups.da.color}"][tr][td][size=16][center][color=#ffffff][b]LICENÇA/RESERVA[/b][/color][/center][/size][/td][/tr][/table][/center][size=13][left][color=${CONFIG.subgroups.da.color}][b]Nickname[/b][/color]: ${nickname}\n[color=${CONFIG.subgroups.da.color}][b]Quantidade de dias[/b][/color]: ${dias}\n[color=${CONFIG.subgroups.da.color}][b]Permissão[/b][/color]: ${permDA}[/size][/font][/left]`; postsToMake.push({ topic: CONFIG.subgroups.da.topicId, message: daBBCode, name: "DA" }); }
                }

                queueAppsScriptSubmission(this, { forumPosts: postsToMake });
                registrarLicencaFirebase(nickname, dias, permissao);
                postWithDelay(postsToMake);
            });

            // Formulário 7 (Prolongamento)
            $('#form7_prolong_licenca').on('submit', function (e) {
                e.preventDefault(); if (!validateForm($(this))) { showCustomModal("Atenção!", "Por favor, preencha todos os campos obrigatórios.", { icon: 'warning' }); return; }
                setSubmitButtonLoading(this);
                const nickname = $('#nick_licpro').val().trim(); const dias = $('#dias_licpro').val().trim(); const permissao = $('#perm_licpro').val().trim(); const postSubgrupos = $('#prolong_post_subgrupos').is(':checked'); const dataFormatada = formatDate();
                const mainBBCode = `[font=Poppins][center][table style="border-color: black; border-radius: 10px; overflow: hidden; width: auto;" bgcolor="#560c7e"][tr][td][size=16][center][color=#ffffff][b]PROLONGAMENTO DE LICENÇA[/b][/color][/center][/size][/td][/tr][/table][/center][size=13][left][color=#560c7e][b]Nickname[/b][/color]: ${nickname}\n[color=#560c7e][b]Quantidade de dias[/b][/color]: ${dias}\n[color=#560c7e][b]Permissão[/b][/color]: ${permissao}\n[color=#560c7e][b]Data[/b][/color]: ${dataFormatada}\n[color=#560c7e][b]☒[/b][/color] Estou ciente de que, ao término da minha licença, serei automaticamente reintegrado às minhas funções, não sendo necessário postar um requerimento de retorno.[/size][/font][/left]`;
                const postsToMake = [{ topic: CONFIG.mainTopicId, message: mainBBCode, name: "Companhia dos Professores" }];

                if (postSubgrupos) {
                    const permSPP = $('#perm_spp_prolong').val().trim();
                    if (permSPP) { const sppBBCode = `[font=Poppins][center][table  style="border-color: black; border-radius: 10px; overflow: hidden; width: auto;" bgcolor="${CONFIG.subgroups.spp.color}"][tr][td][size=16][center][color=#ffffff][b]PROLONGAMENTO DE LICENÇA/RESERVA[/b][/color][/center][/size][/td][/tr][/table][/center]\n[size=13][left][color=${CONFIG.subgroups.spp.color}][b]Nickname[/b][/color]: ${nickname}\n[color=${CONFIG.subgroups.spp.color}][b]Dias[/b][/color]: ${dias}\n[color=${CONFIG.subgroups.spp.color}][b]Permissão[/b][/color]: ${permSPP}\n[color=${CONFIG.subgroups.spp.color}][b]Data[/b][/color]: ${dataFormatada}\n[color=${CONFIG.subgroups.spp.color}][b]☒[/b][/color] Estou ciente de que, ao término da minha licença, serei automaticamente reintegrado às minhas funções, não sendo necessário postar um requerimento de retorno.\n[/size][/font][/left]`; postsToMake.push({ topic: CONFIG.subgroups.spp.topicId, message: sppBBCode, name: "SPP" }); }
                    const permCDC = $('#perm_cdc_prolong').val().trim();
                    if (permCDC) { const cdcBBCode = `[font=Poppins][center][table style="border-color: black; border-radius: 10px; overflow: hidden; width: auto;" bgcolor="${CONFIG.subgroups.cdc.color}"][tr][td][size=16][center][color=#ffffff][b]PROLONGAMENTO DE LICENÇA/RESERVA[/b][/color][/center][/size][/td][/tr][/table][/center][size=13][left][color=${CONFIG.subgroups.cdc.color}][b]Nickname[/b][/color]: ${nickname}\n[color=${CONFIG.subgroups.cdc.color}][b]Quantidade de dias[/b][/color]: ${dias}\n[color=${CONFIG.subgroups.cdc.color}][b]Permissão[/b][/color]: ${permCDC}[/size][/font][/left]`; postsToMake.push({ topic: CONFIG.subgroups.cdc.topicId, message: cdcBBCode, name: "CDC" }); }
                    const permDA = $('#perm_da_prolong').val().trim();
                    if (permDA) { const daBBCode = `[font=Poppins][center][table style="border-color: black; border-radius: 10px; overflow: hidden; width: auto;" bgcolor="${CONFIG.subgroups.da.color}"][tr][td][size=16][center][color=#ffffff][b]PROLONGAMENTO DE LICENÇA/RESERVA[/b][/color][/center][/size][/td][/tr][/table][/center][size=13][left][color=${CONFIG.subgroups.da.color}][b]Nickname[/b][/color]: ${nickname}\n[color=${CONFIG.subgroups.da.color}][b]Quantidade de dias[/b][/color]: ${dias}\n[color=${CONFIG.subgroups.da.color}][b]Permissão[/b][/color]: ${permDA}[/size][/font][/left]`; postsToMake.push({ topic: CONFIG.subgroups.da.topicId, message: daBBCode, name: "DA" }); }
                }

                queueAppsScriptSubmission(this, { forumPosts: postsToMake });
                registrarLicencaFirebase(nickname, dias, permissao);
                postWithDelay(postsToMake);
            });

            // Formulário 8 (Retorno de Licença)
            $('#form8_retorno_licenca').on('submit', function (e) {
                e.preventDefault(); if (!validateForm($(this))) { showCustomModal("Atenção!", "Por favor, preencha o seu nickname.", { icon: 'warning' }); return; }
                setSubmitButtonLoading(this);
                const nickname = $('#nick_retlic').val().trim(); const postSubgrupos = $('#retorno_post_subgrupos').is(':checked'); const dataFormatada = formatDate();
                const mainBBCode = `[font=Poppins][center][table style="border-color: black; border-radius: 10px; overflow: hidden; width: auto;" bgcolor="#560c7e"][tr][td][size=16][center][color=#ffffff][b]RETORNO DE LICENÇA[/b][/color][/center][/size][/td][/tr][/table][/center][size=13][left][color=#560c7e][b]Nickname[/b][/color]: ${nickname}\n[color=#560c7e][b]Data[/b][/color]: ${dataFormatada}[/size][/font][/left]`;
                const postsToMake = [{ topic: CONFIG.mainTopicId, message: mainBBCode, name: "Companhia dos Professores" }];

                if (postSubgrupos) {
                    if ($('#post_retorno_spp_cb').is(':checked')) { const sppBBCode = `[font=Poppins][center][table style="border-color: black; border-radius: 10px; overflow: hidden; width: auto;" bgcolor="${CONFIG.subgroups.spp.color}"][tr][td][size=16][center][color=#ffffff][b]RETORNO DE LICENÇA/RESERVA[/b][/color][/center][/size][/td][/tr][/table][/center][size=13][left][color=${CONFIG.subgroups.spp.color}][b]Nickname[/b][/color]: ${nickname}[/size][/font][/left]`; postsToMake.push({ topic: CONFIG.subgroups.spp.topicId, message: sppBBCode, name: "SPP" }); }
                    if ($('#post_retorno_cdc_cb').is(':checked')) { const cdcBBCode = `[font=Poppins][center][table style="border-color: black; border-radius: 10px; overflow: hidden; width: auto;" bgcolor="${CONFIG.subgroups.cdc.color}"][tr][td][size=16][center][color=#ffffff][b]RETORNO DE LICENÇA/RESERVA[/b][/color][/center][/size][/td][/tr][/table][/center][size=13][left][color=${CONFIG.subgroups.cdc.color}][b]Nickname[/b][/color]: ${nickname}[/size][/font][/left]`; postsToMake.push({ topic: CONFIG.subgroups.cdc.topicId, message: cdcBBCode, name: "CDC" }); }
                    if ($('#post_retorno_da_cb').is(':checked')) { const daBBCode = `[font=Poppins][center][table style="border-color: black; border-radius: 10px; overflow: hidden; width: auto;" bgcolor="${CONFIG.subgroups.da.color}"][tr][td][size=16][center][color=#ffffff][b]RETORNO DE LICENÇA/RESERVA[/b][/color][/center][/size][/td][/tr][/table][/center][size=13][left][color=${CONFIG.subgroups.da.color}][b]Nickname[/b][/color]: ${nickname}[/size][/font][/left]`; postsToMake.push({ topic: CONFIG.subgroups.da.topicId, message: daBBCode, name: "DA" }); }
                }

                queueAppsScriptSubmission(this, { forumPosts: postsToMake });
                registrarRetornoFirebase(nickname);
                postWithDelay(postsToMake);
            });
        });

        function gatherFormData() {
            if (!activeFormGlobal) return ""; const formId = activeFormGlobal.id; if (!validateForm($(activeFormGlobal).find('form'))) { return null; }
            let formData = "";
            if (formId !== "form12") {
                const title = formTitles[formId];
                formData += `[font=Poppins][center][table style="border-color: black; border-radius: 10px; overflow: hidden; width: auto;" bgcolor="#560c7e"][tr][td][size=16][center][color=#ffffff][b]${title}[/b][/color][/center][/size][/td][/tr][/table][/center]\n[size=13][left]`;
            }
            const inputs = activeFormGlobal.querySelectorAll("input:not([type=hidden]):not(#fa-generated-message):not([data-private-message-only]):not([data-form-helper]), select:not([data-private-message-only]), textarea:not([data-private-message-only])"); let placeholdersData = "";
            inputs.forEach((input) => {
                if (input.type !== "checkbox") {
                    let placeholder = FIELD_LABEL_OVERRIDES[input.name] || input.getAttribute("placeholder") || (input.tagName.toLowerCase() === "select" && input.options.length > 0 && input.options[0].disabled ? input.options[0].innerText : input.name);
                    const value = input.value ? input.value.trim() : "";
                    if (value || input.type === "date") {
                        let formattedValue = value;
                        if (input.type === "date" && value) { const [year, month, day] = value.split("-"); formattedValue = `${day}/${month}/${year}`; }
                        if (input.tagName.toLowerCase() === "select") {
                            placeholder = (input.options.length > 0 && input.options[0].disabled && input.value === "") ? input.options[0].innerText : placeholder;
                            formattedValue = input.options[input.selectedIndex].innerText;
                            if (input.name === 'motivo_ex' && input.selectedOptions[0]?.dataset.customReason === 'true') {
                                formattedValue = document.getElementById('expulsion_custom_reason')?.value.trim() || 'Outro';
                            }
                        }
                        const isTagField = placeholder.toLowerCase() === "tag";
                        if (isTagField && formId === "form12") { placeholdersData += `${formattedValue}`; } else if (isTagField) {
                            const lines = formattedValue.split("/").map(s => s.trim()).filter(s => s);
                            lines.forEach(l => { placeholdersData += `[font=Poppins][b][color=#000000]${l}[/color][/b][/font]\n`; });
                        } else if (formId !== "form12") { placeholdersData += `[color=#560c7e][b]${placeholder}[/b][/color]: ${formattedValue}\n`; }
                    }
                }
            });
            formData += placeholdersData;
            if (["form1", "form2", "form6", "form9", "form10", "form11", "form13"].includes(formId)) {
                let hasDateField = false; activeFormGlobal.querySelectorAll("input[type='date']").forEach(dIn => { if (dIn.value) hasDateField = true; });
                if (!hasDateField) { formData += `[color=#560c7e][b]Data[/b][/color]: ${formatDate()}\n`; }
            }
            activeFormGlobal.querySelectorAll('input[type="checkbox"]:not(#send_welcome_pm):not(#send_promotion_pm):not(#send_demotion_pm):not(#send_expulsion_pm)').forEach((cb) => {
                if (cb.checked) { const label = cb.nextElementSibling ? cb.nextElementSibling.innerText.trim() : "Termo aceito"; formData += `[color=#560c7e][b]☒[/b][/color] ${label}\n`; }
            });
            if (formId !== "form12") formData += `[/size][/font][/left]`;
            return formData;
        }

        function getPrivateMessageRecipients(rawNicknames) {
            return [...new Set(rawNicknames.split('/').map(nickname => nickname.trim()).filter(Boolean))];
        }

        function escapeHtml(value) {
            const element = document.createElement('div');
            element.textContent = String(value);
            return element.innerHTML;
        }

        async function sendForumPrivateMessage(recipient, subject, message) {
            const composeResponse = await fetch('/privmsg?mode=post', { credentials: 'same-origin' });
            if (!composeResponse.ok) throw new Error(`Não foi possível abrir o formulário de MP (${composeResponse.status}).`);

            const composeHtml = await composeResponse.text();
            const composeDocument = new DOMParser().parseFromString(composeHtml, 'text/html');
            const privateMessageForm = composeDocument.querySelector('textarea[name="message"]')?.closest('form');
            if (!privateMessageForm) throw new Error('O formulário de mensagem privada não foi encontrado. Verifique se a conta está conectada ao fórum.');

            const recipientInput = privateMessageForm.querySelector('input[name^="username"]');
            const recipientFieldName = recipientInput?.name || 'username[]';
            const formData = new FormData(privateMessageForm);
            const payload = new URLSearchParams();

            formData.forEach((value, key) => {
                if (typeof value === 'string') payload.append(key, value);
            });

            ['username', 'username[]', 'subject', 'message', 'mode', 'post'].forEach(key => payload.delete(key));
            payload.append(recipientFieldName, recipient);
            payload.set('subject', subject);
            payload.set('message', message);
            payload.set('mode', 'post');
            payload.set('post', '1');

            const action = new URL(privateMessageForm.getAttribute('action') || '/privmsg', window.location.href);
            const sendResponse = await fetch(action.href, {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                body: payload.toString(),
                redirect: 'follow'
            });

            if (!sendResponse.ok) throw new Error(`O fórum recusou a MP para ${recipient} (${sendResponse.status}).`);

            const responseHtml = await sendResponse.text();
            const responseDocument = new DOMParser().parseFromString(responseHtml, 'text/html');
            const errorElement = responseDocument.querySelector('.error, .message_die, .msgdie, .alert-error');
            const errorMessage = errorElement?.textContent?.replace(/\s+/g, ' ').trim();
            if (errorMessage) throw new Error(`MP para ${recipient}: ${errorMessage}`);
        }

        function getHabboAvatarUrl(username) {
            return `https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(username)}&direction=2&head_direction=3&gesture=sml&size=m`;
        }

        let privateMessageProgress = null;
        function renderPrivateMessageProgress() {
            if (!privateMessageProgress) return;
            const { recipients, letterLabel, statuses } = privateMessageProgress;
            const sent = statuses.filter(status => status === 'sent').length;
            const failed = statuses.filter(status => status === 'error').length;
            const finished = sent + failed;
            const totalLabel = `${recipients.length} ${recipients.length === 1 ? 'destinatário' : 'destinatários'}`;
            const message = finished < recipients.length
                ? `Enviando <strong class="toast-text-emphasis">${escapeHtml(letterLabel)}</strong> para ${totalLabel}. <strong class="toast-text-emphasis">${finished}/${recipients.length}</strong> concluídas.`
                : failed
                    ? `O envio terminou com <strong class="toast-text-emphasis">${failed}</strong> ${failed === 1 ? 'falha' : 'falhas'}.`
                    : `<strong class="toast-text-emphasis">${escapeHtml(letterLabel)}</strong> enviada para ${totalLabel}.`;
            showCustomModal('', message, {
                icon: failed ? 'error' : finished === recipients.length ? 'success' : 'info',
                buttons: false
            });
        }

        function showPrivateMessageProgress(recipients, letterLabel) {
            privateMessageProgress = {
                recipients,
                letterLabel,
                statuses: recipients.map(() => 'sending')
            };
            renderPrivateMessageProgress();
        }

        function updatePrivateMessageProgress(index, status) {
            if (!privateMessageProgress?.statuses[index]) return;
            privateMessageProgress.statuses[index] = status;
            renderPrivateMessageProgress();
        }

        async function sendPrivateMessagesWithProgress(recipients, subject, message, letterLabel) {
            showPrivateMessageProgress(recipients, letterLabel);
            await Promise.all(recipients.map(async (recipient, index) => {
                try {
                    await sendForumPrivateMessage(recipient, subject, message);
                    updatePrivateMessageProgress(index, 'sent');
                } catch (error) {
                    updatePrivateMessageProgress(index, 'error');
                    throw error;
                }
            }));
            await new Promise(resolve => setTimeout(resolve, 650));
        }

        async function sendWelcomePrivateMessages(rawNicknames) {
            const recipients = getPrivateMessageRecipients(rawNicknames);
            if (!recipients.length) throw new Error('Nenhum nickname foi informado para receber a carta.');
            await sendPrivateMessagesWithProgress(recipients, WELCOME_LETTER_SUBJECT, WELCOME_LETTER_BBCODE, 'Carta de boas-vindas');
        }

        async function sendPromotionPrivateMessages(rawNicknames, letterType) {
            const recipients = getPrivateMessageRecipients(rawNicknames);
            const letter = PROMOTION_LETTERS[letterType];
            if (!recipients.length) throw new Error('Nenhum nickname foi informado para receber a carta.');
            if (!letter) throw new Error('A carta de promoção selecionada não foi encontrada.');

            await sendPrivateMessagesWithProgress(recipients, letter.subject, letter.message, 'Carta de promoção');
        }

        async function sendDemotionPrivateMessages(rawNicknames, reason, comments, attachments) {
            const recipients = getPrivateMessageRecipients(rawNicknames);
            if (!recipients.length) throw new Error('Nenhum nickname foi informado para receber a carta.');

            const message = DEMOTION_LETTER.message
                .replace('{{REASON}}', () => reason)
                .replace('{{COMMENTS}}', () => comments)
                .replace('{{ATTACHMENTS}}', () => attachments);

            await sendPrivateMessagesWithProgress(recipients, DEMOTION_LETTER.subject, message, 'Carta de rebaixamento');
        }

        async function sendExpulsionPrivateMessages(rawNicknames, reason, comments, attachments) {
            const recipients = getPrivateMessageRecipients(rawNicknames);
            if (!recipients.length) throw new Error('Nenhum nickname foi informado para receber a carta.');

            const message = EXPULSION_LETTER.message
                .replace('{{REASON}}', () => reason)
                .replace('{{COMMENTS}}', () => comments)
                .replace('{{ATTACHMENTS}}', () => attachments);

            await sendPrivateMessagesWithProgress(recipients, EXPULSION_LETTER.subject, message, 'Carta de expulsão');
        }

        function submitDraftItemToLegacyApi(item) {
            const apiUrl = DRAFT_FORM_CONFIG[item.formId].apiUrl;
            $.ajax({
                url: apiUrl,
                type: 'post',
                data: item.processedData,
                success: () => console.log(`✅ Sheets (${item.formId} / rascunho) atualizado!`),
                error: (xhr, status, error) => console.error(`❌ Erro no Sheets (${item.formId} / rascunho):`, error)
            });
        }

        function getDraftPrivateMessageTasks(formId, items) {
            const tasks = items.map(item => item.privateMessage).filter(task => task?.recipients?.length);
            if (formId !== 'form4') return tasks;

            const groupedByRole = new Map();
            tasks.forEach(task => {
                const key = `${task.role}|${task.letterType}|${task.subject}`;
                if (!groupedByRole.has(key)) {
                    groupedByRole.set(key, { ...task, recipients: [...task.recipients] });
                    return;
                }
                const current = groupedByRole.get(key);
                current.recipients = [...new Set([...current.recipients, ...task.recipients])];
            });
            return Array.from(groupedByRole.values());
        }

        function waitForDraftPromotionCooldown(nextTask) {
            return new Promise(resolve => {
                const delayMs = CONFIG.antifloodDelay;
                const endsAt = Date.now() + delayMs;
                showCustomModal(
                    '',
                    `As MPs anteriores foram enviadas. O próximo cargo, <strong class="toast-text-emphasis">${escapeHtml(nextTask.role)}</strong>, será processado em <strong class="toast-text-emphasis" id="draftPmCountdown">${Math.ceil(delayMs / 1000)}</strong>s.`,
                    { icon: 'info', buttons: false }
                );

                const timer = setInterval(() => {
                    const remaining = Math.max(0, endsAt - Date.now());
                    const countdown = document.getElementById('draftPmCountdown');
                    if (countdown) countdown.textContent = String(Math.ceil(remaining / 1000));
                    if (remaining <= 0) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 200);
            });
        }

        async function sendDraftPrivateMessages(formId, items) {
            const tasks = getDraftPrivateMessageTasks(formId, items);
            for (let index = 0; index < tasks.length; index += 1) {
                if (formId === 'form4' && index > 0) {
                    await waitForDraftPromotionCooldown(tasks[index]);
                }
                const task = tasks[index];
                await sendPrivateMessagesWithProgress(task.recipients, task.subject, task.message, task.label);
            }
            return tasks;
        }

        async function postDraftBatch(formId) {
            const state = draftStates[formId];
            if (!state || state.posting) return;
            if (!state.items.length) {
                showCustomModal('Rascunho vazio', 'Adicione pelo menos um bloco antes de usar <b>Postar tudo</b>.', { icon: 'warning' });
                return;
            }

            state.posting = true;
            renderDraftItems(formId);
            const items = [...state.items];
            const form = document.querySelector(`#${formId} form`);
            const unifiedBbcode = items.map(item => item.bbcode).join('\n\n[hr]\n\n');
            const forumPosts = [{ topic: CONFIG.mainTopicId, name: 'Companhia dos Professores', message: unifiedBbcode }];
            const appsScriptItems = items.map(item => ({
                id: item.id,
                formId: item.formId,
                formTitle: item.formTitle,
                capturedAt: item.capturedAt,
                details: item.details,
                fields: item.fields,
                processedData: item.processedData,
                privateMessage: item.privateMessage,
                bbcode: item.bbcode
            }));

            queueAppsScriptSubmission(form, {
                forumPosts,
                draftMode: true,
                draftItems: appsScriptItems
            });
            items.forEach(item => {
                submitDraftItemToLegacyApi(item);
                if (item.firebase) void enviarParaFirebase(item.firebase.route, item.firebase.payload);
            });

            showForumPostProgress(forumPosts, 0, 'sending');
            postToForum({ t: CONFIG.mainTopicId, message: unifiedBbcode, mode: 'reply', post: 1 })
                .done(async function () {
                    showForumPostProgress(forumPosts, 0, 'sent');
                    let privateMessageTasks = [];
                    try {
                        privateMessageTasks = await sendDraftPrivateMessages(formId, items);
                    } catch (error) {
                        console.error('❌ Lote publicado, mas uma das MPs falhou:', error);
                        showCustomModal(
                            'Lote publicado, mas uma MP falhou',
                            `${escapeHtml(error.message)}<br><br>O requerimento unificado já foi publicado. <b>Não use “Postar tudo” novamente.</b><br><br>Procure a carta no <b>Portal de Envio</b> ou peça o modelo a outro membro para enviar a MP manualmente.`,
                            { icon: 'error' }
                        );
                        return;
                    }

                    showSubmissionDestinationModal(
                        privateMessageTasks.length > 0,
                        'Lote publicado com sucesso!',
                        forumPosts
                    );
                })
                .fail(function (xhr, status, error) {
                    state.posting = false;
                    renderDraftItems(formId);
                    console.error('❌ Erro ao publicar o lote:', error);
                    showCustomModal('Erro ao publicar o lote', 'Nenhum requerimento foi postado no fórum. Confira sua conexão e tente novamente.', { icon: 'error' });
                });
        }

        (function ($) {
            "use strict";
            $(window).on("load", function () {
                $("form").not("#attlist_postagem, #form3_licenca, #form7_prolong_licenca, #form8_retorno_licenca").on("submit", function (event) {
                    event.preventDefault(); const $submitButton = $(this).find('button[type="submit"]'); $submitButton.prop('disabled', true).addClass('loading');
                    const bbcodeMessage = gatherFormData();
                    if (bbcodeMessage === null) { showCustomModal("Atenção!", "Por favor, preencha todos os campos obrigatórios.", { icon: 'warning' }); $submitButton.prop('disabled', false).removeClass('loading'); return; }
                    const shouldSendWelcomeMessage = activeFormGlobal?.id === 'form1' && document.getElementById('send_welcome_pm')?.checked;
                    const welcomeRecipients = shouldSendWelcomeMessage ? activeFormGlobal.querySelector('input[name="nick_ent"]').value.trim() : '';
                    const shouldSendPromotionMessage = activeFormGlobal?.id === 'form4' && document.getElementById('send_promotion_pm')?.checked;
                    const promotionRecipients = shouldSendPromotionMessage ? activeFormGlobal.querySelector('input[name="nick_pro"]').value.trim() : '';
                    const promotionLetterType = shouldSendPromotionMessage ? document.getElementById('promotion_pm_option')?.dataset.letterType : '';
                    const shouldSendDemotionMessage = activeFormGlobal?.id === 'form5' && document.getElementById('send_demotion_pm')?.checked;
                    const demotionRecipients = shouldSendDemotionMessage ? activeFormGlobal.querySelector('input[name="nick_reb"]').value.trim() : '';
                    const demotionReason = shouldSendDemotionMessage ? activeFormGlobal.querySelector('input[name="motivo_reb"]').value.trim() : '';
                    const demotionComments = shouldSendDemotionMessage ? document.getElementById('demotion_comments').value.trim() : '';
                    const demotionAttachments = shouldSendDemotionMessage ? document.getElementById('demotion_attachments').value.trim() : '';
                    const shouldSendExpulsionMessage = activeFormGlobal?.id === 'form2' && document.getElementById('send_expulsion_pm')?.checked;
                    const expulsionRecipients = shouldSendExpulsionMessage ? activeFormGlobal.querySelector('input[name="TAG_ex"]').value.trim() : '';
                    const expulsionReason = shouldSendExpulsionMessage ? getDraftActualReason('form2', activeFormGlobal.querySelector('form')) : '';
                    const expulsionComments = shouldSendExpulsionMessage ? document.getElementById('expulsion_comments').value.trim() : '';
                    const expulsionAttachments = shouldSendExpulsionMessage ? document.getElementById('expulsion_attachments').value.trim() : '';

                    const submittedFormId = activeFormGlobal?.id || '';
                    if (bbcodeMessage && isDraftModeActive(submittedFormId)) {
                        addCurrentFormToDraft(submittedFormId, this, bbcodeMessage);
                        $submitButton.prop('disabled', false).removeClass('loading');
                        return;
                    }
                     
                    if (bbcodeMessage) {
                        const mainForumPosts = [{ topic: CONFIG.mainTopicId, name: "Companhia dos Professores", message: bbcodeMessage }];
                        queueAppsScriptSubmission(this, {
                            forumPosts: mainForumPosts
                        });
                        $(this).find('.invalid').removeClass('invalid');
                        showForumPostProgress(mainForumPosts, 0, 'sending');
                        
                        // Executa as rotas de API adicionais que não têm botão com função específica
                        if (activeFormGlobal) {
                            if (activeFormGlobal.id === 'form10') processarFirebaseForm10();
                        }

                        setTimeout(function () {
                            postToForum({ t: CONFIG.mainTopicId, message: bbcodeMessage, mode: "reply", post: 1 })
                                .done(async function () {
                                    showForumPostProgress(mainForumPosts, 0, 'sent');
                                    if (shouldSendWelcomeMessage) {
                                        try {
                                            await sendWelcomePrivateMessages(welcomeRecipients);
                                        } catch (error) {
                                            console.error("❌ Requerimento postado, mas houve erro ao enviar a carta:", error);
                                            markActiveSubmitButtonSent('Requerimento enviado');
                                            showCustomModal(
                                                "Requerimento postado, mas a MP falhou",
                                                `${escapeHtml(error.message)}<br><br>O requerimento já foi publicado. <b>Não envie o formulário novamente.</b><br><br>Procure a carta no <b>Portal de Envio</b> ou peça o modelo a outro membro para enviar a MP manualmente.`,
                                                { icon: 'error' }
                                            );
                                            return;
                                        }
                                    }
                                    if (shouldSendPromotionMessage) {
                                        try {
                                            await sendPromotionPrivateMessages(promotionRecipients, promotionLetterType);
                                        } catch (error) {
                                            console.error("❌ Promoção postada, mas houve erro ao enviar a carta:", error);
                                            markActiveSubmitButtonSent('Requerimento enviado');
                                            showCustomModal(
                                                "Promoção postada, mas a MP falhou",
                                                `${escapeHtml(error.message)}<br><br>A promoção já foi publicada. <b>Não envie o formulário novamente.</b><br><br>Procure a carta no <b>Portal de Envio</b> ou peça o modelo a outro membro para enviar a MP manualmente.`,
                                                { icon: 'error' }
                                            );
                                            return;
                                        }
                                    }
                                    if (shouldSendDemotionMessage) {
                                        try {
                                            await sendDemotionPrivateMessages(demotionRecipients, demotionReason, demotionComments, demotionAttachments);
                                        } catch (error) {
                                            console.error("❌ Rebaixamento postado, mas houve erro ao enviar a carta:", error);
                                            markActiveSubmitButtonSent('Requerimento enviado');
                                            showCustomModal(
                                                "Rebaixamento postado, mas a MP falhou",
                                                `${escapeHtml(error.message)}<br><br>O rebaixamento já foi publicado. <b>Não envie o formulário novamente.</b><br><br>Procure a carta no <b>Portal de Envio</b> ou peça o modelo a outro membro para enviar a MP manualmente.`,
                                                { icon: 'error' }
                                            );
                                            return;
                                        }
                                    }
                                    if (shouldSendExpulsionMessage) {
                                        try {
                                            await sendExpulsionPrivateMessages(expulsionRecipients, expulsionReason, expulsionComments, expulsionAttachments);
                                        } catch (error) {
                                            console.error("❌ Expulsão postada, mas houve erro ao enviar a carta:", error);
                                            markActiveSubmitButtonSent('Requerimento enviado');
                                            showCustomModal(
                                                "Expulsão postada, mas a MP falhou",
                                                `${escapeHtml(error.message)}<br><br>A expulsão já foi publicada. <b>Não envie o formulário novamente.</b><br><br>Procure a carta no <b>Portal de Envio</b> ou peça o modelo a outro membro para enviar a MP manualmente.`,
                                                { icon: 'error' }
                                            );
                                            return;
                                        }
                                    }
                                    const sentPrivateMessage = shouldSendWelcomeMessage || shouldSendPromotionMessage || shouldSendDemotionMessage || shouldSendExpulsionMessage;
                                    showSubmissionDestinationModal(sentPrivateMessage, sentPrivateMessage ? 'Requerimento e MP enviados!' : 'Requerimento enviado!', mainForumPosts);
                                })
                                .fail(function (xhr, status, error) { console.error("❌ Erro ao postar:", error); showCustomModal("Erro!", "Erro ao postar no fórum! Tente novamente.", { icon: 'error' }); $submitButton.prop('disabled', false).removeClass('loading'); });
                        }, 300);
                    }
                });
            });
        })(jQuery);

        $(document).ready(function () {
            const attlistTagInput = document.getElementById('attlist_tag');
            if (attlistTagInput) {
                attlistTagInput.maxLength = 3;
                attlistTagInput.minLength = 3;
                attlistTagInput.addEventListener('input', function () {
                    const characters = Array.from(this.value);
                    if (characters.length > 3) this.value = characters.slice(0, 3).join('');
                });
            }

            $("#attlist_postagem").submit(function (e) {
                e.preventDefault(); const $submitButton = $(this).find('button[type="submit"]'); $submitButton.prop('disabled', true).addClass('loading');
                const attlist_tag_value = $("#attlist_tag").val().trim();
                if (attlist_tag_value === "") { showCustomModal("Atenção!", "Preencha o campo TAG!", { icon: 'warning' }); $("#attlist_tag").addClass('invalid'); $submitButton.prop('disabled', false).removeClass('loading'); return; }
                if (Array.from(attlist_tag_value).length !== 3) { showCustomModal("Atenção!", "A TAG deve conter exatamente 3 caracteres.", { icon: 'warning' }); $("#attlist_tag").addClass('invalid'); $submitButton.prop('disabled', false).removeClass('loading'); return; }
                $("#attlist_tag").removeClass('invalid');
                const texto = `[table class="rank attprof" style="border: none!important; margin: 1em; line-height: 1.4em;"][tr style="border: none;"][td style="border: none!important;"][img]https://i.imgur.com/1nRwKhI.gif[/img]\n[font=Poppins][size=15][color=white][b][PROF] ATUALIZADO [${attlist_tag_value}][/b][/color][/size][color=white]\nEm virtude do Conselho da Documentação, foi realizada uma atualização neste horário. \nEm caso de erros consulte um conselheiro+ da companhia dos Professores.\n\n[b]#SoberaniaROXA[/b][/color][/font][/td][/tr][/table]`;
                queueAppsScriptSubmission(this, {
                    forumPosts: [{ topic: CONFIG.mainTopicId, name: "Companhia dos Professores", message: texto }]
                });
                const updateForumPosts = [{ topic: CONFIG.mainTopicId, name: "Companhia dos Professores", message: texto }];
                $("#fa-generated-message").val(texto); showForumPostProgress(updateForumPosts, 0, 'sending');
                postToForum({ t: CONFIG.mainTopicId, message: texto, mode: "reply", post: 1 })
                    .done(function () {
                        showForumPostProgress(updateForumPosts, 0, 'sent');
                        $("#attlist_tag").val("");
                        showSubmissionDestinationModal(false, 'Atualização enviada!', updateForumPosts);
                    })
                    .fail(function (xhr, status, error) { console.error("❌ Erro ao postar atualização:", error); showCustomModal("Erro!", "Erro ao postar atualização! Tente novamente.", { icon: 'error' }); $submitButton.prop('disabled', false).removeClass('loading'); });
            });
        });

        function handleUrlParameters() {
            const params = new URLSearchParams(window.location.search); const formToOpen = params.get('form');
            if (formToOpen && document.getElementById(formToOpen)) {
                toggleForm(formToOpen);
                setTimeout(() => {
                    const activeForm = document.getElementById(formToOpen); if (!activeForm) return;
                    params.forEach((value, key) => {
                        if (key === 'form') return;
                        const field = activeForm.querySelector(`[name="${key}"]`);
                        if (field) {
                            if (field.type === 'checkbox') { field.checked = value === 'true' || value === '1'; } else { field.value = decodeURIComponent(value); }
                            const event = new Event('change', { 'bubbles': true }); field.dispatchEvent(event);
                        }
                    });
                }, 150);
            }
        }

        document.addEventListener('DOMContentLoaded', async function () {
            activeFormGlobal = null; const initialButtonText = mainButton.querySelector('span'); const initialSelectedImageDiv = document.getElementById('selectedImage'); const initialImageDisplay = document.getElementById('imageDisplay');
            if (initialButtonText) initialButtonText.textContent = "Selecione um Requerimento"; if (initialSelectedImageDiv) initialSelectedImageDiv.classList.remove('show');
            if (initialImageDisplay) { initialImageDisplay.src = ''; initialImageDisplay.alt = ''; } if (formWrapper) { formWrapper.style.minHeight = '0px'; }

            initializeDraftModes();
            handleUrlParameters();
            
            // BUSCA QUEM ESTÁ LOGADO NO FÓRUM PARA USAR NO FIREBASE
            const username = await pegarUsername();
            if (username) {
                autorLogado = username;
                console.log(`✅ Sistema de Requerimentos inicializado. Autor: ${autorLogado}`);
            } else {
                console.log('✅ Sistema inicializado, mas nenhum usuário logado encontrado.');
            }
        });
