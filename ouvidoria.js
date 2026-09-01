/**
 * COMPANHIA DOS PROFESSORES - OUVIDORIA / PROPOSTAS
 * Lógica da Aplicação, Editor BBCode e Integrações
 */

$(document).ready(function () {
    const editor = document.getElementById('proposta-editor');
    let blocoSelecionado = null;
    let blocoArrastando = null;
    let forumUsername = '';
    let formDirty = false;

    const LEADERSHIP_GROUP_ID = '11';
    const TOPIC_ID = '35734';
    const GOOGLE_SCRIPT = 'https://script.google.com/macros/s/AKfycbx9W5aKQRA2ft9WsctXFXi9EvVWO3pbCe3B0UonyUp8ATkqLDlRIqA-fEhIphQVtrrC/exec';
    const FIREBASE_CONFIG = {
        apiKey: 'AIzaSyDo4DagZchii1cPKFighZU5KAjppp98HJE',
        authDomain: 'nexusprof.firebaseapp.com',
        projectId: 'nexusprof',
        storageBucket: 'nexusprof.appspot.com',
        messagingSenderId: '268861178598',
        appId: '1:268861178598:web:9686b81bb003f9514fb127',
        measurementId: 'G-MY150DZMTM'
    };

    let proposalDb = null;
    try {
        if (typeof firebase !== 'undefined' && !firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
            proposalDb = firebase.firestore();
        }
    } catch (error) {
        console.error('Falha ao inicializar o Firebase:', error);
    }

    // --- Alternador de Tema ---
    function syncThemeButton() {
        const isDark = document.documentElement.dataset.theme === 'dark';
        $('#theme-toggle i').attr('class', isDark ? 'fas fa-sun' : 'fas fa-moon');
        $('#theme-toggle').attr('aria-label', isDark ? 'Usar tema claro' : 'Usar tema escuro');
    }
    syncThemeButton();

    $('#theme-toggle').on('click', function () {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem('PROF_PROPOSTA_THEME', next); } catch (_) { }
        syncThemeButton();
    });

    // --- Sistema de Toast ---
    function showToast(message, type = 'success') {
        const toastContainer = $('#toast-container');
        let iconHtml = '';
        if (type === 'success') iconHtml = '<i class="fas fa-check-circle"></i>';
        else if (type === 'error') iconHtml = '<i class="fas fa-times-circle"></i>';
        else if (type === 'warning') iconHtml = '<i class="fas fa-exclamation-triangle"></i>';
        const toast = $(`<div class="toast ${type}">${iconHtml}<span>${message}</span></div>`);
        toastContainer.append(toast);
        setTimeout(() => toast.addClass('show'), 10);
        setTimeout(() => {
            toast.removeClass('show');
            toast.on('transitionend', () => toast.remove());
        }, 4000);
    }

    // --- Gerenciador de Modal ---
    const GerenciadorModal = {
        elemento: $('#modal-overlay'),
        mostrar: function (titulo, conteudo, botoes = []) {
            $('#modal-titulo').html(titulo);
            $('#modal-conteudo').html(conteudo);
            const rodape = $('#modal-rodape').empty();
            botoes.forEach(btn => {
                $('<button>').addClass(`modal-btn ${btn.classe || 'secundario'}`)
                    .html(btn.texto)
                    .on('click', function (e) {
                        if (btn.acao) {
                            btn.acao.call(this, e);
                        } else {
                            GerenciadorModal.fechar();
                        }
                    })
                    .appendTo(rodape);
            });
            this.elemento.addClass('show');
        },
        fechar: function () {
            $('#modal-overlay').removeClass('show');
        },
        alerta: function (titulo, msg) {
            this.mostrar(titulo, msg, [{ texto: 'Entendi', classe: 'primario', acao: GerenciadorModal.fechar }]);
        }
    };

    $('#modal-close-btn').on('click', function () {
        GerenciadorModal.fechar();
    });

    $('#modal-overlay').on('click', function (e) {
        if (e.target === this) {
            GerenciadorModal.fechar();
        }
    });

    // --- Auto-Preenchimento do Usuário via Fórum ---
    async function obterUsuario(enableSubmit = true) {
        try {
            const resposta = await fetch('/forum', {
                credentials: 'same-origin',
                cache: 'no-store'
            });
            if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
            const textoHtml = await resposta.text();
            const regex = /_userdata\[['"]username['"]\]\s*=\s*['"]([^'"]+)['"]/;
            const correspondencia = textoHtml.match(regex);
            if (correspondencia && correspondencia[1]) {
                const decoder = document.createElement('textarea');
                decoder.innerHTML = correspondencia[1];
                forumUsername = decoder.value.trim();
                if (!forumUsername || forumUsername.toLowerCase() === 'convidado') {
                    throw new Error('Sessão de convidado');
                }
                $('#nickname').val(forumUsername).removeClass('invalid');
                if (enableSubmit) $('#submit-button').prop('disabled', false);
                return true;
            }
            throw new Error('Usuário não localizado');
        } catch (erro) {
            forumUsername = '';
            $('#nickname').val('').attr('placeholder', 'Entre no fórum para continuar');
            $('#submit-button').prop('disabled', true);
            showToast('Não foi possível identificar sua sessão. Entre no fórum e recarregue a página.', 'error');
            console.error('Falha ao identificar usuário do fórum:', erro);
            return false;
        }
    }
    obterUsuario();

    // --- Lógica do Editor de Texto ---
    function atualizarEstadoBotoes() {
        $('.bbcode-btn[data-cmd]').each(function () {
            const comando = $(this).data('cmd');
            try {
                if (document.queryCommandState(comando)) {
                    $(this).addClass('active');
                } else {
                    $(this).removeClass('active');
                }
            } catch (e) { }
        });
    }
    $('#proposta-editor').on('keyup mouseup', atualizarEstadoBotoes);

    // Proteção contra Ctrl + V (Apenas texto simples)
    if (editor) {
        editor.addEventListener('paste', function (e) {
            e.preventDefault();
            const text = (e.originalEvent || e).clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
        });
    }

    $('.bbcode-btn[data-cmd]').on('mousedown', function (e) {
        e.preventDefault();
        if (document.activeElement !== editor) editor.focus();
        const comando = $(this).data('cmd');
        document.execCommand(comando, false, null);
        atualizarEstadoBotoes();
    });

    $('#seletor-cor').on('input', function (e) {
        if (document.activeElement !== editor) editor.focus();
        document.execCommand('foreColor', false, e.target.value);
    });

    // --- Movimentação e Seleção de Blocos ---
    function selecionarBloco(bloco) {
        $('.bbcode-bloco').removeClass('selecionado');
        blocoSelecionado = bloco;
        if (bloco) $(bloco).addClass('selecionado');
    }

    function moverBlocoParaCima(bloco) {
        const anterior = $(bloco).prev('.bbcode-bloco, br, div:not(.bbcode-bloco)');
        if (anterior.length) $(bloco).insertBefore(anterior);
    }

    function moverBlocoParaBaixo(bloco) {
        const proximo = $(bloco).next('.bbcode-bloco, br, div:not(.bbcode-bloco)');
        if (proximo.length) $(bloco).insertAfter(proximo);
    }

    function removerBloco(bloco) {
        $(bloco).remove();
        blocoSelecionado = null;
    }

    $(document).on('click', '.bbcode-bloco', function (e) {
        if (!$(e.target).hasClass('bbcode-ctrl-btn') && !$(e.target).closest('.bbcode-ctrl-btn').length) {
            e.stopPropagation();
            selecionarBloco(this);
        }
    });

    $(document).on('click', function (e) {
        if (!$(e.target).closest('.bbcode-bloco').length && !$(e.target).closest('.bbcode-editor-toolbar').length) {
            selecionarBloco(null);
        }
    });

    $(document).on('click', '.bbcode-ctrl-btn.cima', function (e) {
        e.stopPropagation();
        moverBlocoParaCima($(this).closest('.bbcode-bloco'));
    });

    $(document).on('click', '.bbcode-ctrl-btn.baixo', function (e) {
        e.stopPropagation();
        moverBlocoParaBaixo($(this).closest('.bbcode-bloco'));
    });

    $(document).on('click', '.bbcode-ctrl-btn.remover', function (e) {
        e.stopPropagation();
        removerBloco($(this).closest('.bbcode-bloco'));
    });

    $(document).on('keydown', function (e) {
        if (blocoSelecionado && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault();
            if (e.key === 'ArrowUp') moverBlocoParaCima(blocoSelecionado);
            else moverBlocoParaBaixo(blocoSelecionado);
        }
        if (blocoSelecionado && (e.key === 'Delete' || e.key === 'Backspace')) {
            const activeEl = document.activeElement;
            const isInContentEditable = activeEl && (
                activeEl.getAttribute('contenteditable') === 'true' ||
                activeEl.closest('[contenteditable="true"]') !== null
            );
            if (!isInContentEditable) {
                e.preventDefault();
                removerBloco(blocoSelecionado);
            }
        }
    });

    // --- Drag and Drop ---
    $(document).on('mousedown', '.bbcode-ctrl-btn.mover', function (e) {
        e.preventDefault();
        e.stopPropagation();
        blocoArrastando = $(this).closest('.bbcode-bloco')[0];
        $(blocoArrastando).addClass('arrastando');

        $(document).on('mousemove.drag', function (e) {
            if (!blocoArrastando) return;
            const blocos = $('.bbcode-bloco').not(blocoArrastando);
            blocos.removeClass('bbcode-bloco-alvo');
            blocos.each(function () {
                const rect = this.getBoundingClientRect();
                const meio = rect.top + rect.height / 2;
                if (e.clientY < meio && e.clientY > rect.top - 20) {
                    $(this).addClass('bbcode-bloco-alvo');
                    $(this).data('posicao', 'antes');
                } else if (e.clientY >= meio && e.clientY < rect.bottom + 20) {
                    $(this).addClass('bbcode-bloco-alvo');
                    $(this).data('posicao', 'depois');
                }
            });
        });

        $(document).on('mouseup.drag', function () {
            if (blocoArrastando) {
                const alvo = $('.bbcode-bloco-alvo').first();
                if (alvo.length) {
                    if (alvo.data('posicao') === 'antes') {
                        $(blocoArrastando).insertBefore(alvo);
                    } else {
                        $(blocoArrastando).insertAfter(alvo);
                    }
                }
                $(blocoArrastando).removeClass('arrastando');
                $('.bbcode-bloco').removeClass('bbcode-bloco-alvo');
                blocoArrastando = null;
            }
            $(document).off('mousemove.drag mouseup.drag');
        });
    });

    function criarControlesBloco() {
        return `
            <div class="bbcode-controles" contenteditable="false">
                <button type="button" class="bbcode-ctrl-btn mover" title="Arrastar"><i class="fas fa-grip-vertical"></i></button>
                <button type="button" class="bbcode-ctrl-btn cima" title="Mover para cima"><i class="fas fa-chevron-up"></i></button>
                <button type="button" class="bbcode-ctrl-btn baixo" title="Mover para baixo"><i class="fas fa-chevron-down"></i></button>
                <button type="button" class="bbcode-ctrl-btn remover" title="Remover"><i class="fas fa-times"></i></button>
            </div>
        `;
    }

    // --- Handlers BBCode Especiais ---
    $('.bbcode-btn[data-bbcode]').on('click', function (e) {
        e.preventDefault();
        const tipo = $(this).data('bbcode');
        switch (tipo) {
            case 'hr': inserirHR(); break;
            case 'list': mostrarModalLista(); break;
            case 'quote': mostrarModalQuote(); break;
            case 'spoiler': mostrarModalSpoiler(); break;
            case 'code': inserirCode(); break;
            case 'hide': inserirHide(); break;
            case 'table': mostrarModalTabela(); break;
            case 'url': mostrarModalURL(); break;
        }
    });

    function inserirNoEditor(elemento) {
        editor.focus();
        const selecao = window.getSelection();
        if (selecao.rangeCount > 0) {
            const range = selecao.getRangeAt(0);
            range.deleteContents();
            range.insertNode(elemento);
            range.setStartAfter(elemento);
            range.setEndAfter(elemento);
            selecao.removeAllRanges();
            selecao.addRange(range);
        } else {
            editor.appendChild(elemento);
        }
        if ($(elemento).hasClass('bbcode-bloco')) {
            const br = document.createElement('br');
            elemento.after(br);
        }
    }

    function inserirHR() {
        const container = document.createElement('div');
        container.className = 'bbcode-bloco';
        container.innerHTML = criarControlesBloco() + '<hr class="bbcode-hr">';
        container.setAttribute('data-tipo', 'hr');
        inserirNoEditor(container);
    }

    function inserirCode() {
        const selecao = window.getSelection();
        const texto = (selecao.rangeCount > 0 && !selecao.isCollapsed) ? selecao.toString() : '';
        const container = document.createElement('div');
        container.className = 'bbcode-bloco';
        container.setAttribute('data-tipo', 'code');
        container.innerHTML = criarControlesBloco() + `<div class="bbcode-code" contenteditable="true">${texto || 'Seu código aqui...'}</div>`;
        inserirNoEditor(container);
    }

    function inserirHide() {
        const selecao = window.getSelection();
        const texto = (selecao.rangeCount > 0 && !selecao.isCollapsed) ? selecao.toString() : '';
        const container = document.createElement('div');
        container.className = 'bbcode-bloco';
        container.setAttribute('data-tipo', 'hide');
        container.innerHTML = criarControlesBloco() + `<div class="bbcode-hide" contenteditable="true">${texto || 'Conteúdo oculto...'}</div>`;
        inserirNoEditor(container);
    }

    function mostrarModalLista() {
        const html = `
            <label class="modal-label">Itens da lista (um por linha):</label>
            <textarea class="modal-input" id="input-lista-itens" rows="5" placeholder="Item 1&#10;Item 2&#10;Item 3"></textarea>
        `;
        GerenciadorModal.mostrar('<i class="fas fa-list-ul"></i> Inserir Lista', html, [
            {
                texto: 'Inserir', classe: 'primario', acao: function () {
                    const itens = $('#input-lista-itens').val().split('\n').filter(i => i.trim());
                    if (itens.length > 0) {
                        const container = document.createElement('div');
                        container.className = 'bbcode-bloco';
                        container.setAttribute('data-tipo', 'list');
                        let listaHtml = '<ul class="bbcode-list">';
                        itens.forEach(item => { listaHtml += `<li>${item.trim()}</li>`; });
                        listaHtml += '</ul>';
                        container.innerHTML = criarControlesBloco() + listaHtml;
                        inserirNoEditor(container);
                    }
                    GerenciadorModal.fechar();
                }
            },
            { texto: 'Cancelar', classe: 'secundario', acao: GerenciadorModal.fechar }
        ]);
    }

    function mostrarModalQuote() {
        const selecao = window.getSelection();
        const textoSelecionado = (selecao.rangeCount > 0 && !selecao.isCollapsed) ? selecao.toString() : '';
        const html = `
            <label class="modal-label">Autor da citação:</label>
            <input type="text" class="modal-input" id="input-quote-autor" placeholder="Nome do autor (opcional)">
            <label class="modal-label">Texto da citação:</label>
            <textarea class="modal-input" id="input-quote-texto" rows="4" placeholder="Texto da citação...">${textoSelecionado}</textarea>
        `;
        GerenciadorModal.mostrar('<i class="fas fa-quote-left"></i> Inserir Citação', html, [
            {
                texto: 'Inserir', classe: 'primario', acao: function () {
                    const autor = $('#input-quote-autor').val().trim();
                    const texto = $('#input-quote-texto').val().trim();
                    if (texto) {
                        const container = document.createElement('div');
                        container.className = 'bbcode-bloco';
                        container.setAttribute('data-tipo', 'quote');
                        container.setAttribute('data-autor', autor);
                        container.innerHTML = criarControlesBloco() + `
                            <div class="bbcode-quote">
                                <div class="bbcode-quote-header">
                                    <i class="fas fa-quote-left"></i> <span contenteditable="false">Citando:</span> <span class="bbcode-quote-autor" contenteditable="true" data-placeholder="Autor">${autor || 'Autor'}</span>
                                </div>
                                <div class="bbcode-quote-content" contenteditable="true">${texto}</div>
                            </div>
                        `;
                        inserirNoEditor(container);
                    }
                    GerenciadorModal.fechar();
                }
            },
            { texto: 'Cancelar', classe: 'secundario', acao: GerenciadorModal.fechar }
        ]);
    }

    function mostrarModalSpoiler() {
        const selecao = window.getSelection();
        const textoSelecionado = (selecao.rangeCount > 0 && !selecao.isCollapsed) ? selecao.toString() : '';
        const html = `
            <label class="modal-label">Título do Spoiler:</label>
            <input type="text" class="modal-input" id="input-spoiler-titulo" placeholder="Clique para ver...">
            <label class="modal-label">Conteúdo do Spoiler:</label>
            <textarea class="modal-input" id="input-spoiler-conteudo" rows="4" placeholder="Conteúdo oculto...">${textoSelecionado}</textarea>
        `;
        GerenciadorModal.mostrar('<i class="fas fa-eye-slash"></i> Inserir Spoiler', html, [
            {
                texto: 'Inserir', classe: 'primario', acao: function () {
                    const titulo = $('#input-spoiler-titulo').val().trim() || 'Spoiler';
                    const conteudo = $('#input-spoiler-conteudo').val().trim();
                    if (conteudo) {
                        const container = document.createElement('div');
                        container.className = 'bbcode-bloco';
                        container.setAttribute('data-tipo', 'spoiler');
                        container.setAttribute('data-titulo', titulo);
                        container.innerHTML = criarControlesBloco() + `
                            <div class="bbcode-spoiler">
                                <div class="bbcode-spoiler-header">
                                    <i class="fas fa-eye-slash"></i> <span class="bbcode-spoiler-titulo" contenteditable="true">${titulo}</span>
                                </div>
                                <div class="bbcode-spoiler-content" contenteditable="true">${conteudo}</div>
                            </div>
                        `;
                        inserirNoEditor(container);
                    }
                    GerenciadorModal.fechar();
                }
            },
            { texto: 'Cancelar', classe: 'secundario', acao: GerenciadorModal.fechar }
        ]);
    }

    function mostrarModalTabela() {
        const html = `
            <div style="display: flex; gap: 15px; margin-bottom: 15px;">
                <div style="flex:1;">
                    <label class="modal-label">Linhas:</label>
                    <input type="number" class="modal-input" id="input-tabela-linhas" value="3" min="1" max="20">
                </div>
                <div style="flex:1;">
                    <label class="modal-label">Colunas:</label>
                    <input type="number" class="modal-input" id="input-tabela-colunas" value="3" min="1" max="10">
                </div>
            </div>
        `;
        GerenciadorModal.mostrar('<i class="fas fa-table"></i> Inserir Tabela', html, [
            {
                texto: 'Inserir', classe: 'primario', acao: function () {
                    const linhas = parseInt($('#input-tabela-linhas').val()) || 3;
                    const colunas = parseInt($('#input-tabela-colunas').val()) || 3;
                    const container = document.createElement('div');
                    container.className = 'bbcode-bloco';
                    container.setAttribute('data-tipo', 'table');
                    let tabelaHtml = '<table class="bbcode-table">';
                    for (let i = 0; i < linhas; i++) {
                        tabelaHtml += '<tr>';
                        for (let j = 0; j < colunas; j++) {
                            tabelaHtml += '<td contenteditable="true">&nbsp;</td>';
                        }
                        tabelaHtml += '</tr>';
                    }
                    tabelaHtml += '</table>';
                    container.innerHTML = criarControlesBloco() + tabelaHtml;
                    inserirNoEditor(container);
                    GerenciadorModal.fechar();
                }
            },
            { texto: 'Cancelar', classe: 'secundario', acao: GerenciadorModal.fechar }
        ]);
    }

    function mostrarModalURL() {
        const selecao = window.getSelection();
        const textoSelecionado = (selecao.rangeCount > 0 && !selecao.isCollapsed) ? selecao.toString() : '';
        const html = `
            <label class="modal-label">URL (endereço do link):</label>
            <input type="text" class="modal-input" id="input-url-endereco" placeholder="https://exemplo.com">
            <label class="modal-label">Texto do link:</label>
            <input type="text" class="modal-input" id="input-url-texto" placeholder="Clique aqui" value="${textoSelecionado}">
        `;
        GerenciadorModal.mostrar('<i class="fas fa-link"></i> Inserir Link', html, [
            {
                texto: 'Inserir', classe: 'primario', acao: function () {
                    const url = $('#input-url-endereco').val().trim();
                    const texto = $('#input-url-texto').val().trim() || url;
                    if (url) {
                        const link = document.createElement('span');
                        link.className = 'bbcode-url';
                        link.setAttribute('data-url', url);
                        link.textContent = texto;
                        inserirNoEditor(link);
                    }
                    GerenciadorModal.fechar();
                }
            },
            { texto: 'Cancelar', classe: 'secundario', acao: GerenciadorModal.fechar }
        ]);
    }

    $(document).on('dblclick', '.bbcode-url', function (e) {
        e.preventDefault();
        e.stopPropagation();
        const linkElement = $(this);
        const urlAtual = linkElement.attr('data-url') || '';
        const textoAtual = linkElement.text();
        const html = `
            <label class="modal-label">URL (endereço do link):</label>
            <input type="text" class="modal-input" id="input-url-editar-endereco" placeholder="https://exemplo.com" value="${urlAtual}">
            <label class="modal-label">Texto do link:</label>
            <input type="text" class="modal-input" id="input-url-editar-texto" placeholder="Clique aqui" value="${textoAtual}">
        `;
        GerenciadorModal.mostrar('<i class="fas fa-edit"></i> Editar Link', html, [
            {
                texto: 'Salvar', classe: 'primario', acao: function () {
                    const novaUrl = $('#input-url-editar-endereco').val().trim();
                    const novoTexto = $('#input-url-editar-texto').val().trim() || novaUrl;
                    if (novaUrl) {
                        linkElement.attr('data-url', novaUrl);
                        linkElement.text(novoTexto);
                    }
                    GerenciadorModal.fechar();
                }
            },
            {
                texto: 'Remover Link', classe: 'secundario', acao: function () {
                    linkElement.replaceWith(linkElement.text());
                    GerenciadorModal.fechar();
                }
            },
            { texto: 'Cancelar', classe: 'secundario', acao: GerenciadorModal.fechar }
        ]);
    });

    // --- Conversor HTML para BBCode ---
    function converterHtmlParaBbcode(conteiner) {
        function formatarTag(conteudo, tagAbre, tagFecha) {
            if (!conteudo || !conteudo.trim()) return conteudo;
            const espacoAntes = conteudo.match(/^\s*/)[0];
            const espacoDepois = conteudo.match(/\s*$/)[0];
            return espacoAntes + tagAbre + conteudo.trim() + tagFecha + espacoDepois;
        }

        function elementoVazioOuSoBr(el) {
            const filhos = $(el).contents().filter(function () {
                return !(this.nodeType === 3 && !this.textContent.trim());
            });
            if (filhos.length === 0) return true;
            return filhos.length === 1 && filhos[0].nodeType === 1 && filhos[0].tagName.toLowerCase() === 'br';
        }

        let bbcode = '';
        $(conteiner).contents().each(function () {
            const no = this;
            if (no.nodeType === 1) {
                const el = $(no);
                const nomeTag = no.tagName.toLowerCase();
                if (el.hasClass('bbcode-controles')) return;

                if (el.hasClass('bbcode-bloco')) {
                    const tipo = el.attr('data-tipo');
                    switch (tipo) {
                        case 'hr':
                            bbcode += '[hr]\n';
                            break;
                        case 'spoiler':
                            bbcode += `[spoiler="${el.find('.bbcode-spoiler-titulo').text().trim() || 'Spoiler'}"]${el.find('.bbcode-spoiler-content').text().trim()}[/spoiler]\n`;
                            break;
                        case 'quote':
                            const autorQuote = el.find('.bbcode-quote-autor').text().trim();
                            const conteudoQuote = el.find('.bbcode-quote-content').text().trim();
                            bbcode += (autorQuote && autorQuote !== 'Autor') ? `[quote="${autorQuote}"]${conteudoQuote}[/quote]\n` : `[quote]${conteudoQuote}[/quote]\n`;
                            break;
                        case 'code':
                            bbcode += `[code]${el.find('.bbcode-code').text().trim()}[/code]\n`;
                            break;
                        case 'hide':
                            bbcode += `[hide]${el.find('.bbcode-hide').text().trim()}[/hide]\n`;
                            break;
                        case 'list':
                            bbcode += '[list]\n';
                            el.find('li').each(function () { bbcode += `[*]${$(this).text().trim()}\n`; });
                            bbcode += '[/list]\n';
                            break;
                        case 'table':
                            bbcode += '[table]\n';
                            el.find('tr').each(function () {
                                bbcode += '[tr]';
                                $(this).find('td').each(function () { bbcode += `[td]${$(this).text().trim()}[/td]`; });
                                bbcode += '[/tr]\n';
                            });
                            bbcode += '[/table]\n';
                            break;
                    }
                    return;
                }

                if (el.hasClass('bbcode-url')) {
                    bbcode += `[url=${el.attr('data-url')}]${el.text().trim()}[/url]`;
                    return;
                }

                let conteudo = converterHtmlParaBbcode(no);
                const estiloAlinhamento = no.style.textAlign;
                let prefixo = '', sufixo = '';
                if (estiloAlinhamento === 'center') { prefixo = '[center]'; sufixo = '[/center]'; }
                else if (estiloAlinhamento === 'right') { prefixo = '[right]'; sufixo = '[/right]'; }
                else if (estiloAlinhamento === 'justify') { prefixo = '[justify]'; sufixo = '[/justify]'; }

                switch (nomeTag) {
                    case 'b': case 'strong': bbcode += prefixo + formatarTag(conteudo, '[b]', '[/b]') + sufixo; break;
                    case 'i': case 'em': bbcode += prefixo + formatarTag(conteudo, '[i]', '[/i]') + sufixo; break;
                    case 'u': bbcode += prefixo + formatarTag(conteudo, '[u]', '[/u]') + sufixo; break;
                    case 'strike': case 's': bbcode += prefixo + formatarTag(conteudo, '[strike]', '[/strike]') + sufixo; break;
                    case 'font':
                        bbcode += no.color ? prefixo + formatarTag(conteudo, `[color=${no.color}]`, '[/color]') + sufixo : prefixo + conteudo + sufixo;
                        break;
                    case 'span':
                        let resultado = conteudo;
                        if (no.style.color) resultado = formatarTag(resultado, `[color=${no.style.color}]`, '[/color]');
                        if (no.style.textDecoration && no.style.textDecoration.includes('line-through')) resultado = formatarTag(resultado, '[strike]', '[/strike]');
                        bbcode += prefixo + resultado + sufixo;
                        break;
                    case 'div':
                        bbcode += elementoVazioOuSoBr(no) ? '\n' : (conteudo.endsWith('\n') ? prefixo + conteudo + sufixo : prefixo + conteudo + sufixo + '\n');
                        break;
                    case 'p':
                        bbcode += elementoVazioOuSoBr(no) ? '\n' : prefixo + conteudo + sufixo + '\n\n';
                        break;
                    case 'br': bbcode += '\n'; break;
                    case 'hr': bbcode += '[hr]\n'; break;
                    default: bbcode += prefixo + conteudo + sufixo;
                }
            } else if (no.nodeType === 3) {
                bbcode += no.textContent;
            }
        });
        return bbcode;
    }

    // --- Geradores de Envio ---
    function getProposalData() {
        const editorClonado = $('#proposta-editor').clone();
        editorClonado.find('.bbcode-controles').remove();
        const editorContent = converterHtmlParaBbcode(editorClonado[0]).trim().replace(/\n{3,}/g, '\n\n');
        const classificacaoChecked = $('input[name="classificacao"]:checked').val();
        const check = (val) => val === classificacaoChecked ? '(X)' : '( )';
        const classificacaoString = `${check('Correção')} Correção    ${check('Sugestão')} Sugestão    ${check('Projeto')} Projeto`;

        return {
            autor: forumUsername,
            numero: $('#ordem').val().trim(),
            classificacao: classificacaoChecked,
            classificacaoString,
            tema: $('#tema_proposta').val().trim(),
            descricaoBbcode: editorContent || 'Sem descrição.',
            descricaoTexto: $('#proposta-editor').text().trim()
        };
    }

    function generateProposalBody(data = getProposalData()) {
        return `[b]Autor(a):[/b] ${data.autor}
[b]Classificação:[/b] ${data.classificacaoString}
[b]Número:[/b] ${data.numero}
[b]Tema:[/b] ${data.tema}
[spoiler="Descrição da proposta"]${data.descricaoBbcode}[/spoiler]
[b]Veredito:[/b] [color=#c7c7c7][b]Proposta em análise.[/b][/color]`;
    }

    function generateFullBbcode(data = getProposalData()) {
        return `[font=Poppins]${generateProposalBody(data)}[/font]`;
    }

    function generateLeadershipTopicBbcode(data = getProposalData()) {
        return `[font=Poppins][b]Autor(a):[/b] ${data.autor}
[b]Classificação:[/b] ${data.classificacaoString}
[b]Número:[/b] ${data.numero}
[b]Tema:[/b] ${data.tema}
[spoiler="Descrição da proposta"]Enviado à Liderança[/spoiler]
[b]Veredito:[/b] [color=#c7c7c7][b]Proposta em análise.[/b][/color][/font]`;
    }

    function generateLeadershipPrivateMessage(data = getProposalData()) {
        return `[table style="border-color: black; border-radius: 15px; overflow: hidden; width: 100%;" bgcolor="821F88"]
[tr][td][table style="border-color: black; border-radius: 15px; overflow: hidden; width: 100%;" bgcolor="FFFFFF"]
[tr][td][center][img]https://2img.net/i.imgur.com/hU7bn8R.gif[/img][/center]
[/td][/tr][/table]
[table style="border-color: black; border-radius: 15px; overflow: hidden; width: 100%;" bgcolor="FFFFFF"]
[tr][td][font=poppins][center]Saudações, [color=#821F88][b]${data.autor}[/b][/color]![/center]
${generateProposalBody(data)}
[/font][/td][/tr][/table][/td][/tr][/table]`;
    }

    function validateForm() {
        $('.form-container .invalid').removeClass('invalid');
        $('.input-group .invalid-radio').removeClass('invalid-radio');
        let isValid = true;
        const missingFields = [];

        if (!forumUsername || $('#nickname').val().trim() !== forumUsername) {
            $('#nickname').addClass('invalid');
            missingFields.push("sessão do fórum");
            isValid = false;
        }

        const ordemVal = $('#ordem').val().trim();
        if (ordemVal === "" || !/^\d+$/.test(ordemVal) || parseInt(ordemVal, 10) <= 0) {
            $('#ordem').addClass('invalid');
            missingFields.push("Ordem");
            isValid = false;
        }

        if (!$('input[name="classificacao"]:checked').val()) {
            $('.radio-button-group').closest('.input-group').find('.radio-group-label').addClass('invalid-radio');
            missingFields.push("Classificação");
            isValid = false;
        }

        if ($('#tema_proposta').val().trim() === "") {
            $('#tema_proposta').addClass('invalid');
            missingFields.push("Tema");
            isValid = false;
        }

        const editorClonado = $('#proposta-editor').clone();
        editorClonado.find('.bbcode-controles').remove();
        if (converterHtmlParaBbcode(editorClonado[0]).trim() === "") {
            $('.editor-wrapper').addClass('invalid');
            missingFields.push("Desenvolvimento");
            isValid = false;
        } else {
            $('.editor-wrapper').removeClass('invalid');
        }

        if (!isValid) {
            showToast('Por favor, preencha os campos: ' + missingFields.join(', ') + '.', 'warning');
        }
        return isValid;
    }

    $('#generate-bbcode-btn').on('click', function (e) {
        e.preventDefault();
        if (!validateForm()) return;
        const fullBbcode = generateFullBbcode();
        GerenciadorModal.mostrar(
            '<i class="fas fa-code"></i> BBCode Gerado',
            `<pre style="text-align: left; white-space: pre-wrap; word-break: break-all; background: var(--surface-muted); color: var(--text); padding: 15px; border-radius: 8px; max-height: 45vh; overflow-y: auto; border: 1px solid var(--border);">${fullBbcode}</pre>`,
            [
                {
                    texto: '<i class="fas fa-copy"></i> Copiar Código', classe: 'primario', acao: function () {
                        navigator.clipboard.writeText(fullBbcode).then(() => {
                            showToast("BBCode copiado com sucesso!", "success");
                            $(this).html('<i class="fas fa-check"></i> Copiado!');
                        }).catch(() => showToast("Falha ao copiar o código.", "error"));
                    }
                },
                { texto: 'Fechar', classe: 'secundario', acao: GerenciadorModal.fechar }
            ]
        );
    });

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getForumResponseError(response, xhr) {
        const responseUrl = String(xhr?.responseURL || '').toLowerCase();
        const responseHtml = typeof response === 'string' ? response : '';
        if (responseUrl.includes('/login') || /name=["']form_login["']/i.test(responseHtml)) {
            return 'Sua sessão do fórum expirou. Entre novamente antes de enviar.';
        }
        const parsedPage = new DOMParser().parseFromString(responseHtml, 'text/html');
        const explicitError = parsedPage.querySelector('.errorbox, .message-die, .panel .error, .block-error');
        if (explicitError?.textContent?.trim()) {
            return explicitError.textContent.trim().replace(/\s+/g, ' ').slice(0, 240);
        }
        const pageText = (parsedPage.body?.textContent || '').replace(/\s+/g, ' ').toLowerCase();
        const failures = [
            'não está autorizado',
            'não tem permissão',
            'mensagem privada não foi enviada',
            'nenhum destinatário',
            'tópico não existe',
            'modo de tópico especificado não existe'
        ];
        return failures.some(pattern => pageText.includes(pattern)) ? 'O fórum recusou a operação.' : '';
    }

    function requestForum(url, data) {
        return new Promise((resolve, reject) => {
            $.ajax({
                url,
                type: 'POST',
                data,
                timeout: 30000,
                success: function (response, _status, xhr) {
                    const forumError = getForumResponseError(response, xhr);
                    if (forumError) reject(new Error(forumError));
                    else resolve(response);
                },
                error: function (_xhr, status, error) {
                    reject(new Error(error || status || 'Falha de comunicação com o fórum.'));
                }
            });
        });
    }

    function postTopic(bbcode) {
        return requestForum('/post', {
            mode: 'reply',
            t: TOPIC_ID,
            message: bbcode,
            post: 'Enviar'
        });
    }

    function sendLeadershipPrivateMessage(data) {
        return requestForum('/privmsg', {
            folder: 'inbox',
            mode: 'post',
            usergroup: LEADERSHIP_GROUP_ID,
            subject: `[PROF] Proposta nº ${data.numero}`,
            message: generateLeadershipPrivateMessage(data),
            post: 'Enviar'
        });
    }

    async function saveProposalToFirebase(data) {
        if (!proposalDb) throw new Error('O Firebase não foi inicializado.');
        await proposalDb
            .collection('nexus_config')
            .doc('Propostas')
            .collection('lista_propostas')
            .doc(String(data.numero))
            .set({
                ordem: Number(data.numero),
                autor: data.autor,
                tipo: data.classificacao,
                titulo: data.tema,
                conteudo: data.descricaoTexto,
                data: new Date().toISOString()
            });
    }

    function saveProposalToSheet(data) {
        const sheetData = new URLSearchParams();
        sheetData.append('action', 'saveProposal');
        sheetData.append('autor', data.autor);
        sheetData.append('numero', data.numero);
        sheetData.append('classificacao', data.classificacao);
        sheetData.append('tema', data.tema);
        sheetData.append('descricao', data.descricaoTexto);
        return fetch(GOOGLE_SCRIPT, {
            method: 'POST',
            mode: 'no-cors',
            body: sheetData
        });
    }

    function showForumFallback(error, bbcode) {
        GerenciadorModal.mostrar(
            '<i class="fas fa-exclamation-triangle" style="color:#ff9800"></i> Envio não concluído',
            `<div style="padding:10px 0;">
                <p style="margin-bottom:10px;">${escapeHtml(error.message || error)}</p>
                <p style="margin-bottom:15px;">Copie o conteúdo abaixo para realizar a publicação manual:</p>
                <textarea id="bbcode-fallback" readonly style="width:100%;height:190px;background:var(--surface-muted);color:var(--text);border:1px solid var(--border);border-radius:10px;padding:12px;font-family:monospace;font-size:.82rem;resize:vertical;">${escapeHtml(bbcode)}</textarea>
            </div>`,
            [
                {
                    texto: '<i class="fas fa-copy"></i> Copiar BBCode',
                    classe: 'primario',
                    acao: function () {
                        navigator.clipboard.writeText(bbcode).finally(() => showToast('BBCode copiado!', 'success'));
                    }
                },
                { texto: 'Fechar', classe: 'secundario', acao: GerenciadorModal.fechar }
            ]
        );
    }

    $('#ouvidoria-form').on('submit', async function (event) {
        event.preventDefault();
        const submitButton = $('#submit-button');
        const restoreButton = () => submitButton
            .prop('disabled', !forumUsername)
            .html('<i class="fas fa-paper-plane"></i> Enviar proposta');

        submitButton.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Verificando sessão...');
        const sessionOk = await obterUsuario(false);
        if (!sessionOk || !validateForm()) {
            restoreButton();
            return;
        }

        const data = getProposalData();
        const sendLeadership = $('#send-leadership').is(':checked');
        const topicBbcode = sendLeadership ? generateLeadershipTopicBbcode(data) : generateFullBbcode(data);

        if (sendLeadership && !window.confirm(
            `ATENÇÃO: ENVIO PARA GRUPO\n\nA proposta completa será enviada por MP para todos os membros do grupo Liderança (ID ${LEADERSHIP_GROUP_ID}). No tópico, a descrição aparecerá como “Enviado à Liderança”.\n\nConfirma o envio?`
        )) {
            restoreButton();
            return;
        }

        try {
            if (sendLeadership) {
                submitButton.html('<i class="fas fa-spinner fa-spin"></i> Enviando à Liderança...');
                try {
                    await sendLeadershipPrivateMessage(data);
                } catch (error) {
                    showForumFallback(error, generateLeadershipPrivateMessage(data));
                    return;
                }
            }

            submitButton.html('<i class="fas fa-spinner fa-spin"></i> Publicando no tópico...');
            try {
                await postTopic(topicBbcode);
            } catch (error) {
                showForumFallback(error, topicBbcode);
                return;
            }

            submitButton.html('<i class="fas fa-spinner fa-spin"></i> Salvando registros...');
            const [firebaseResult, sheetResult] = await Promise.allSettled([
                saveProposalToFirebase(data),
                saveProposalToSheet(data)
            ]);

            const warnings = [];
            if (firebaseResult.status === 'rejected') {
                console.error('Falha ao salvar no Firebase:', firebaseResult.reason);
                warnings.push('O Firebase recusou a gravação.');
            }
            if (sheetResult.status === 'rejected') {
                console.error('Falha ao salvar na planilha:', sheetResult.reason);
                warnings.push('Não foi possível encaminhar o registro para a planilha.');
            }

            formDirty = false;
            dispararConfetti();

            const persistenceText = warnings.length
                ? `<div style="margin-top:16px;padding:12px;border:1px solid #d6a94f;border-radius:10px;text-align:left;"><strong>Atenção:</strong><br>${warnings.map(escapeHtml).join('<br>')}</div>`
                : '<p style="margin-top:12px;color:var(--success);">Fórum, Firebase e registro atual concluídos.</p>';

            GerenciadorModal.mostrar(
                '<i class="fas fa-check-circle" style="color:var(--success)"></i> Proposta enviada!',
                `<div style="text-align:center;padding:16px 0;">
                    <i class="fas fa-paper-plane" style="font-size:48px;color:var(--accent);margin-bottom:18px;"></i>
                    <p>Obrigado por sua contribuição, <strong>${escapeHtml(data.autor)}</strong>.</p>
                    ${persistenceText}
                </div>`,
                [
                    {
                        texto: '<i class="fas fa-plus"></i> Enviar outra proposta',
                        classe: 'primario',
                        acao: function () {
                            $('#ouvidoria-form')[0].reset();
                            $('#nickname').val(forumUsername);
                            $('#proposta-editor').html('');
                            $('#char-count').text('0');
                            GerenciadorModal.fechar();
                        }
                    },
                    {
                        texto: '<i class="fas fa-external-link-alt"></i> Ver no fórum',
                        classe: 'secundario',
                        acao: function () {
                            window.location.href = `https://www.policiarcc.com/t${TOPIC_ID}-prof-ouvidoria?view=newest#newest`;
                        }
                    }
                ]
            );
        } finally {
            restoreButton();
        }
    });

    $('input').on('input', function () { $(this).removeClass('invalid'); });
    $('#proposta-editor').on('input', function () { $('.editor-wrapper').removeClass('invalid'); });

    // Contador de Caracteres
    function atualizarContadorCaracteres() {
        const texto = $('#proposta-editor').text().trim();
        $('#char-count').text(texto.length);
    }
    $('#proposta-editor').on('input keyup', atualizarContadorCaracteres);
    atualizarContadorCaracteres();

    // Preview
    $('#preview-btn').on('click', function (e) {
        e.preventDefault();
        const fullBbcode = generateFullBbcode();
        let previewHtml = fullBbcode
            .replace(/\[font=(.*?)\]/gi, '<span style="font-family:$1,sans-serif">')
            .replace(/\[\/font\]/gi, '</span>')
            .replace(/\[b\](.*?)\[\/b\]/gi, '<strong>$1</strong>')
            .replace(/\[i\](.*?)\[\/i\]/gi, '<em>$1</em>')
            .replace(/\[u\](.*?)\[\/u\]/gi, '<span style="text-decoration:underline">$1</span>')
            .replace(/\[strike\](.*?)\[\/strike\]/gi, '<span style="text-decoration:line-through">$1</span>')
            .replace(/\[color=(.*?)\](.*?)\[\/color\]/gi, '<span style="color:$1">$2</span>')
            .replace(/\[center\](.*?)\[\/center\]/gis, '<div style="text-align:center">$1</div>')
            .replace(/\[right\](.*?)\[\/right\]/gis, '<div style="text-align:right">$1</div>')
            .replace(/\[justify\](.*?)\[\/justify\]/gis, '<div style="text-align:justify">$1</div>')
            .replace(/\[spoiler="?(.*?)"?\]([\s\S]*?)\[\/spoiler\]/gi,
                '<div style="background:var(--surface-muted);border:1px solid var(--border);border-radius:6px;margin:8px 0;">' +
                '<div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'block\':\'none\'" style="background:color-mix(in srgb, var(--accent) 12%, transparent);padding:8px 12px;cursor:pointer;font-weight:bold;color:var(--accent);border-radius:6px 6px 0 0;">▶ $1</div>' +
                '<div style="padding:10px 12px;display:block;">$2</div></div>')
            .replace(/\[quote="?(.*?)"?\]([\s\S]*?)\[\/quote\]/gi,
                '<div style="background:var(--surface-muted);border-left:3px solid var(--accent);padding:10px 15px;margin:8px 0;border-radius:0 4px 4px 0;">' +
                '<div style="color:var(--muted);font-size:12px;margin-bottom:5px;"><strong>$1</strong> escreveu:</div>' +
                '<div>$2</div></div>')
            .replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi,
                '<div style="background:var(--surface-muted);border-left:3px solid var(--accent);padding:10px 15px;margin:8px 0;border-radius:0 4px 4px 0;"><div>$1</div></div>')
            .replace(/\[code\]([\s\S]*?)\[\/code\]/gi,
                '<pre style="background:var(--surface-muted);color:var(--accent);padding:12px;border-radius:4px;font-family:\'Courier New\',monospace;font-size:13px;overflow-x:auto;border:1px solid var(--border);">$1</pre>')
            .replace(/\[hide\]([\s\S]*?)\[\/hide\]/gi,
                '<div style="background:var(--surface-muted);border:1px dashed var(--accent);padding:12px;border-radius:4px;margin:8px 0;"><span style="color:var(--accent);font-weight:bold;">🔒 Conteúdo oculto:</span><br>$1</div>')
            .replace(/\[hr\]/gi, '<hr style="border:none;height:1px;background:var(--border);margin:12px 0;">')
            .replace(/\[list\]([\s\S]*?)\[\/list\]/gi, function (match, content) {
                return '<ul style="padding-left:25px;margin:8px 0;">' +
                    content.replace(/\[\*\](.*?)(?=\[\*\]|\[\/list\]|$)/g, '<li style="margin:4px 0;">$1</li>') + '</ul>';
            })
            .replace(/\[table\]([\s\S]*?)\[\/table\]/gi, '<table style="border-collapse:collapse;width:100%;margin:8px 0;background:var(--surface);">$1</table>')
            .replace(/\[tr\]([\s\S]*?)\[\/tr\]/gi, '<tr>$1</tr>')
            .replace(/\[td\]([\s\S]*?)\[\/td\]/gi, '<td style="border:1px solid var(--border);padding:8px;">$1</td>')
            .replace(/\[url=(.*?)\](.*?)\[\/url\]/gi, '<a href="$1" style="color:var(--accent);text-decoration:underline;" target="_blank">$2</a>')
            .replace(/\n/g, '<br>');

        const forumPreview = `
            <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;font-family:'Poppins',sans-serif;overflow:hidden;">
                <div style="background:var(--surface-muted);padding:12px 16px;border-bottom:1px solid var(--border);">
                    <span style="color:var(--muted);font-size:12px;font-weight:600;">Preview do post no fórum</span>
                </div>
                <div style="padding:20px;color:var(--text);font-size:14px;line-height:1.65;max-height:45vh;overflow-y:auto;">
                    ${previewHtml || '<span style="opacity:0.5">Preencha os campos para ver o preview.</span>'}
                </div>
            </div>
        `;
        GerenciadorModal.mostrar(
            '<i class="fas fa-eye"></i> Preview da Proposta',
            forumPreview,
            [{ texto: 'Fechar', classe: 'primario', acao: GerenciadorModal.fechar }]
        );
    });

    // Confirmação antes de sair
    $('input, #proposta-editor').on('input', function () { formDirty = true; });
    window.addEventListener('beforeunload', function (e) {
        if (formDirty) {
            e.preventDefault();
            e.returnValue = '';
            return '';
        }
    });

    // Confetti
    function dispararConfetti() {
        const container = $('#confetti-container');
        const cores = ['#821f88', '#a747ad', '#c16bc6', '#318e52', '#ffe66d'];
        for (let i = 0; i < 80; i++) {
            const confetti = $('<div>').addClass('confetti');
            confetti.css({
                left: Math.random() * 100 + '%',
                background: cores[Math.floor(Math.random() * cores.length)],
                width: Math.random() * 10 + 5 + 'px',
                height: Math.random() * 10 + 5 + 'px',
                borderRadius: Math.random() > 0.5 ? '50%' : '0',
                animationDelay: Math.random() * 0.5 + 's',
                animationDuration: (Math.random() * 2 + 2) + 's'
            });
            container.append(confetti);
        }
        setTimeout(() => container.empty(), 5000);
    }

    // Modo Foco
    $('#focus-mode-btn').on('click', function () {
        $('body').toggleClass('focus-mode');
        if ($('body').hasClass('focus-mode')) {
            $(this).find('i').removeClass('fa-expand').addClass('fa-compress');
            showToast('Modo foco ativado! Pressione ESC para sair.', 'success');
        } else {
            $(this).find('i').removeClass('fa-compress').addClass('fa-expand');
            showToast('Modo foco desativado.', 'success');
        }
    });

    $(document).on('keydown', function (e) {
        if (e.key === 'Escape' && $('body').hasClass('focus-mode')) {
            $('body').removeClass('focus-mode');
            $('#focus-mode-btn').find('i').removeClass('fa-compress').addClass('fa-expand');
            showToast('Modo foco desativado.', 'success');
        }
    });
});
