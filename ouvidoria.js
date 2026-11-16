/* Bloco 1 */
(function () {
            let theme = 'light';
            try {
                const saved = localStorage.getItem('PROF_PROPOSTA_THEME');
                theme = saved === 'dark' || saved === 'light'
                    ? saved
                    : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            } catch (_) {
                theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            document.documentElement.dataset.theme = theme;
        })();

/* Bloco 2 */
$(document).ready(function () {
            const editor = document.getElementById('proposta-editor');
            let blocoSelecionado = null;
            let blocoArrastando = null;
            let forumUsername = '';

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
            let proposalAuth = null;
            try {
                if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
                proposalDb = firebase.firestore();
                proposalAuth = firebase.auth();
            } catch (error) {
                console.error('Falha ao inicializar o Firebase:', error);
            }

            function syncThemeButton() {
                const isDark = document.documentElement.dataset.theme === 'dark';
                $('#theme-toggle i').attr('class', isDark ? 'ti ti-sun' : 'ti ti-moon');
                $('#theme-toggle').attr('aria-label', isDark ? 'Usar tema claro' : 'Usar tema escuro');
                const cor = document.getElementById('seletor-cor');
                if (cor && !cor.dataset.userColor) {
                    cor.value = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
                }
                document.getElementById('color-trigger')?.style.setProperty('--chosen-color', cor.value);
            }

            syncThemeButton();
            $('#theme-toggle').on('click', function () {
                const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
                document.documentElement.dataset.theme = next;
                try { localStorage.setItem('PROF_PROPOSTA_THEME', next); } catch (_) { }
                syncThemeButton();
            });

            // Feedback de interação isolado do conteúdo editável.
            const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
            document.addEventListener('click', function (event) {
                const button = event.target.closest('button');
                if (!button || button.disabled || motionPreference.matches ||
                    !button.closest('.main-scroll, .modal-backdrop')) return;
                const rect = button.getBoundingClientRect();
                const wrap = document.createElement('span');
                wrap.className = 'ui-wave-wrap';
                wrap.setAttribute('aria-hidden', 'true');
                const wave = document.createElement('span');
                wave.className = 'ui-wave';
                wave.style.left = (event.detail ? event.clientX - rect.left : rect.width / 2) + 'px';
                wave.style.top = (event.detail ? event.clientY - rect.top : rect.height / 2) + 'px';
                wrap.appendChild(wave);
                button.appendChild(wrap);
                wave.addEventListener('animationend', () => wrap.remove(), { once: true });
                setTimeout(() => wrap.remove(), 650);
            });


            // --- Toast System ---
            function showToast(message, type = 'success') {
                const toastContainer = $('#toast-container');
                const icons = { success: 'circle-check', error: 'circle-x', warning: 'alert-triangle' };
                if (!icons[type]) type = 'success';
                const toast = $(`<div class="toast ${type}" role="${type === 'error' ? 'alert' : 'status'}"><span class="toast-icon" aria-hidden="true"><i class="ti ti-${icons[type]}"></i></span><span class="toast-message"></span><button type="button" class="toast-close" aria-label="Fechar notificação"><i class="ti ti-x" aria-hidden="true"></i></button></div>`);
                toast.find('.toast-message').text(message);
                toastContainer.append(toast);
                toastContainer.children('.toast').slice(0, -3).remove();
                let timer;
                const dismiss = () => {
                    clearTimeout(timer);
                    toast.removeClass('show');
                    toast.one('transitionend', () => toast.remove());
                    setTimeout(() => toast.remove(), 240);
                };
                toast.find('.toast-close').on('click', dismiss);
                setTimeout(() => toast.addClass('show'), 10);
                timer = setTimeout(dismiss, type === 'success' ? 4500 : 6500);
            }

            // --- Gerenciador de Modal ---
            const GerenciadorModal = {
                elemento: $('#modal-overlay'),
                aoFechar: null,
                focoAnterior: null,
                mostrar: function (titulo, conteudo, botoes = [], opcoes = {}) {
                    const previousClose = this.aoFechar;
                    this.aoFechar = null;
                    if (previousClose) previousClose();
                    this.focoAnterior = document.activeElement;
                    this.aoFechar = opcoes.aoFechar || null;
                    this.elemento.toggleClass('is-notice', opcoes.tipo === 'notice').attr('data-status', opcoes.status || 'info');
                    document.body.classList.toggle('has-bottom-notice', opcoes.tipo === 'notice');
                    $('#modal-titulo').html(titulo);
                    $('#modal-conteudo').html(conteudo);

                    const rodape = $('#modal-rodape').empty();
                    botoes.forEach(btn => {
                        $('<button>').addClass(`modal-btn ${btn.classe || 'secundario'}`)
                            .attr('type', 'button')
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
                    const initialFocus = this.elemento[0].querySelector('input:not([readonly]), textarea:not([readonly]), select') || this.elemento[0].querySelector('#modal-rodape button, #modal-close-btn');
                    if (initialFocus) initialFocus.focus({ preventScroll: true });
                },
                fechar: function () {
                    const callback = GerenciadorModal.aoFechar;
                    const restoreFocus = GerenciadorModal.elemento[0].contains(document.activeElement);
                    GerenciadorModal.aoFechar = null;
                    $('#modal-overlay').removeClass('show');
                    document.body.classList.remove('has-bottom-notice');
                    if (restoreFocus && GerenciadorModal.focoAnterior?.isConnected) {
                        if (editor.contains(GerenciadorModal.focoAnterior)) { restaurarSelecao(); salvarSelecao(); }
                        else GerenciadorModal.focoAnterior.focus({ preventScroll: true });
                    }
                    if (callback) callback();
                },
                alerta: function (titulo, msg) {
                    this.mostrar(titulo, msg, [{ texto: 'Entendi', classe: 'primario', acao: GerenciadorModal.fechar }], { tipo: 'notice', status: 'info' });
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
            $(document).on('keydown.propostaModal', function (event) {
                if (!GerenciadorModal.elemento.hasClass('show')) return;
                event.stopImmediatePropagation();
                if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    GerenciadorModal.fechar();
                } else if (event.key === 'Tab') {
                    const controls = Array.from(GerenciadorModal.elemento[0].querySelectorAll('button, input, textarea, select, a[href]')).filter(el => !el.disabled && el.getClientRects().length);
                    const first = controls[0], last = controls[controls.length - 1];
                    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
                }
            });

            function confirmarEnvioLideranca() {
                return new Promise(resolve => {
                    const finish = accepted => {
                        GerenciadorModal.aoFechar = null;
                        GerenciadorModal.fechar();
                        resolve(accepted);
                    };
                    GerenciadorModal.mostrar(
                        '<i class="ti ti-send" aria-hidden="true"></i> Enviar à Liderança?',
                        `<p>A proposta completa será enviada por mensagem privada a <strong>todos os membros da Liderança</strong> (grupo ${LEADERSHIP_GROUP_ID}).</p><p style="margin-top:10px">No tópico público, a descrição aparecerá apenas como <strong>Enviado à Liderança</strong>.</p>`,
                        [
                            { texto: 'Cancelar', classe: 'secundario', acao: () => finish(false) },
                            { texto: 'Confirmar envio', classe: 'primario', acao: () => finish(true) }
                        ],
                        { tipo: 'notice', status: 'warning', aoFechar: () => resolve(false) }
                    );
                });
            }

            // --- Auto-Preenchimento do Usuário ---
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
            let selecaoSalva = null;
            function rangeNoEditor(range) {
                return range && editor.contains(range.startContainer) && editor.contains(range.endContainer);
            }
            function salvarSelecao() {
                const selecao = window.getSelection();
                if (selecao.rangeCount && rangeNoEditor(selecao.getRangeAt(0))) {
                    selecaoSalva = selecao.getRangeAt(0).cloneRange();
                }
            }
            function restaurarSelecao() {
                const range = rangeNoEditor(selecaoSalva) ? selecaoSalva.cloneRange() : document.createRange();
                if (!rangeNoEditor(selecaoSalva)) {
                    range.selectNodeContents(editor);
                    range.collapse(false);
                }
                const host = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
                (host.closest('[contenteditable="true"]') || editor).focus();
                const selecao = window.getSelection();
                selecao.removeAllRanges();
                selecao.addRange(range);
                return range;
            }
            document.addEventListener('selectionchange', salvarSelecao);
            $('.bbcode-editor-toolbar').on('mousedown', function (e) {
                salvarSelecao();
                if ($(e.target).closest('button').length) e.preventDefault();
            });
            $('.bbcode-btn').each(function () {
                $(this).attr('aria-label', $(this).attr('data-tooltip'));
            });
            editor.setAttribute('role', 'textbox');
            editor.setAttribute('aria-label', 'Conteúdo da proposta');
            editor.setAttribute('aria-multiline', 'true');
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

            // --- Proteção contra Ctrl + V (Colar apenas texto simples) ---
            editor.addEventListener('paste', function (e) {
                e.preventDefault();
                const text = (e.originalEvent || e).clipboardData.getData('text/plain');
                document.execCommand('insertText', false, text);
            });

            // Comandos básicos do execCommand
            $('.bbcode-btn[data-cmd]').on('click', function (e) {
                e.preventDefault();
                restaurarSelecao();
                const comando = $(this).data('cmd');
                document.execCommand(comando, false, null);
                salvarSelecao();
                editor.dispatchEvent(new Event('input', { bubbles: true }));
                atualizarEstadoBotoes();
            });

            // Cor do texto
            $('#seletor-cor').on('input', function (e) {
                e.target.dataset.userColor = 'true';
                restaurarSelecao();
                document.execCommand('foreColor', false, e.target.value);
                salvarSelecao();
                document.getElementById('color-trigger').style.setProperty('--chosen-color', e.target.value);
                editor.dispatchEvent(new Event('input', { bubbles: true }));
            });

            // Popovers no body: não são recortados pelo overflow do editor.
            const colorTrigger = document.getElementById('color-trigger');
            const colorPanel = document.createElement('section');
            colorPanel.id = 'editor-color-panel';
            colorPanel.className = 'editor-color-panel';
            colorPanel.hidden = true;
            colorPanel.setAttribute('role', 'dialog');
            colorPanel.setAttribute('aria-labelledby', 'editor-color-title');
            colorPanel.innerHTML = `
                <div class="color-panel-header"><strong id="editor-color-title">Cor do texto</strong><button type="button" class="color-panel-close" aria-label="Fechar seletor de cores"><i class="ti ti-x" aria-hidden="true"></i></button></div>
                <div class="color-panel-body">
                    <div class="color-spectrum" role="slider" tabindex="0" aria-label="Saturação e luminosidade" aria-valuemin="0" aria-valuemax="100" aria-describedby="color-spectrum-help"><span class="color-spectrum-handle"></span></div>
                    <span id="color-spectrum-help" class="visually-hidden">Use as setas esquerda e direita para a saturação; cima e baixo para a luminosidade.</span>
                    <label class="color-field-label" for="color-hue">Tonalidade</label><input type="range" id="color-hue" min="0" max="360" value="0">
                    <div class="color-presets" aria-label="Cores sugeridas"></div>
                    <div class="color-hex-row"><span class="color-preview" aria-hidden="true"></span><label class="color-field-label" for="color-hex">HEX<input type="text" id="color-hex" maxlength="7" spellcheck="false" autocomplete="off" value="#FFFFFF"></label></div>
                    <div class="color-rgb-row"><label class="color-field-label" for="color-red">R<input type="number" id="color-red" min="0" max="255" step="1"></label><label class="color-field-label" for="color-green">G<input type="number" id="color-green" min="0" max="255" step="1"></label><label class="color-field-label" for="color-blue">B<input type="number" id="color-blue" min="0" max="255" step="1"></label></div>
                    <p class="color-validation" role="status"></p>
                </div>
                <div class="color-panel-footer"><button type="button" class="color-default">Cor do tema</button><button type="button" class="color-apply">Aplicar cor</button></div>`;
            document.body.appendChild(colorPanel);
            let draftColor = '#ffffff';
            let hsv = { h: 0, s: 0, v: 100 };
            const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
            const rgbFromHex = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
            function setDraftHex(value, syncHue = true) {
                let hex = value.trim();
                if (!hex.startsWith('#')) hex = '#' + hex;
                if (/^#[\da-f]{3}$/i.test(hex)) hex = '#' + hex.slice(1).split('').map(c => c + c).join('');
                if (!/^#[\da-f]{6}$/i.test(hex)) return false;
                draftColor = hex.toLowerCase();
                const rgb = rgbFromHex(draftColor);
                if (syncHue) {
                    const [r, g, b] = rgb.map(c => c / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
                    let h = hsv.h;
                    if (delta) h = (max === r ? (g - b) / delta + (g < b ? 6 : 0) : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60;
                    hsv = { h, s: max ? delta / max * 100 : 0, v: max * 100 };
                }
                colorPanel.style.setProperty('--draft-color', draftColor);
                colorPanel.style.setProperty('--hue-color', `hsl(${hsv.h} 100% 50%)`);
                colorPanel.querySelector('.color-spectrum-handle').style.left = hsv.s + '%';
                colorPanel.querySelector('.color-spectrum-handle').style.top = (100 - hsv.v) + '%';
                const spectrum = colorPanel.querySelector('.color-spectrum');
                spectrum.setAttribute('aria-valuenow', String(Math.round(hsv.s)));
                spectrum.setAttribute('aria-valuetext', `Saturação ${Math.round(hsv.s)}%, luminosidade ${Math.round(hsv.v)}%`);
                colorPanel.querySelector('#color-hue').value = hsv.h;
                colorPanel.querySelector('#color-hex').value = draftColor.toUpperCase();
                ['red', 'green', 'blue'].forEach((name, index) => colorPanel.querySelector('#color-' + name).value = rgb[index]);
                colorPanel.querySelector('.color-validation').textContent = '';
                colorPanel.querySelector('.color-apply').disabled = false;
                return true;
            }
            function updateFromHsv() {
                const s = hsv.s / 100, v = hsv.v / 100, sector = hsv.h / 60;
                const c = v * s, x = c * (1 - Math.abs(sector % 2 - 1)), m = v - c;
                const rgb = sector < 1 ? [c,x,0] : sector < 2 ? [x,c,0] : sector < 3 ? [0,c,x] : sector < 4 ? [0,x,c] : sector < 5 ? [x,0,c] : [c,0,x];
                setDraftHex('#' + rgb.map(value => Math.round((value + m) * 255).toString(16).padStart(2, '0')).join(''), false);
            }
            function positionColorPanel() {
                if (colorPanel.hidden) return;
                const anchor = colorTrigger.getBoundingClientRect();
                const box = colorPanel.getBoundingClientRect();
                colorPanel.style.left = clamp(anchor.left, 8, Math.max(8, innerWidth - box.width - 8)) + 'px';
                const below = anchor.bottom + 8;
                colorPanel.style.top = clamp(below + box.height <= innerHeight - 8 ? below : anchor.top - box.height - 8, 8, Math.max(8, innerHeight - box.height - 8)) + 'px';
            }
            function closeColorPanel(restoreFocus = false) {
                if (colorPanel.hidden) return;
                colorPanel.hidden = true;
                colorTrigger.setAttribute('aria-expanded', 'false');
                if (restoreFocus) colorTrigger.focus({ preventScroll: true });
            }
            colorTrigger.addEventListener('click', () => {
                if (!colorPanel.hidden) { closeColorPanel(true); return; }
                salvarSelecao();
                setDraftHex(document.getElementById('seletor-cor').value);
                colorPanel.hidden = false;
                colorTrigger.setAttribute('aria-expanded', 'true');
                positionColorPanel();
                colorPanel.querySelector('#color-hex').focus({ preventScroll: true });
            });
            colorPanel.querySelector('.color-panel-close').addEventListener('click', () => closeColorPanel(true));
            colorPanel.querySelector('.color-apply').addEventListener('click', () => {
                const input = document.getElementById('seletor-cor');
                input.value = draftColor;
                closeColorPanel();
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
            colorPanel.querySelector('.color-default').addEventListener('click', () => setDraftHex(getComputedStyle(document.documentElement).getPropertyValue('--text').trim()));
            const presets = ['#821f88','#a747ad','#c16bc6','#f8eff9','#1a0b1f','#d13948','#277747','#2563c3'];
            presets.forEach(hex => {
                const button = document.createElement('button');
                button.type = 'button'; button.className = 'color-preset'; button.style.setProperty('--preset-color', hex);
                button.setAttribute('aria-label', 'Escolher ' + hex.toUpperCase());
                button.addEventListener('click', () => setDraftHex(hex));
                colorPanel.querySelector('.color-presets').appendChild(button);
            });
            function invalidColor(message) {
                colorPanel.querySelector('.color-validation').textContent = message;
                colorPanel.querySelector('.color-apply').disabled = true;
            }
            colorPanel.querySelector('#color-hex').addEventListener('input', event => {
                const raw = event.target.value, caret = event.target.selectionStart;
                if (!setDraftHex(raw)) invalidColor('Informe uma cor HEX válida.');
                event.target.value = raw;
                event.target.setSelectionRange(caret, caret);
            });
            ['red','green','blue'].forEach(name => colorPanel.querySelector('#color-' + name).addEventListener('input', () => {
                const values = ['red','green','blue'].map(channel => colorPanel.querySelector('#color-' + channel).value);
                if (values.some(value => value === '' || !Number.isInteger(Number(value)) || Number(value) < 0 || Number(value) > 255)) { invalidColor('Use valores RGB de 0 a 255.'); return; }
                setDraftHex('#' + values.map(value => Number(value).toString(16).padStart(2,'0')).join(''));
            }));
            colorPanel.querySelector('#color-hue').addEventListener('input', event => { hsv.h = Number(event.target.value); updateFromHsv(); });
            const spectrum = colorPanel.querySelector('.color-spectrum');
            function spectrumPointer(event) {
                const box = spectrum.getBoundingClientRect();
                hsv.s = clamp((event.clientX - box.left) / box.width * 100, 0, 100);
                hsv.v = 100 - clamp((event.clientY - box.top) / box.height * 100, 0, 100);
                updateFromHsv();
            }
            spectrum.addEventListener('pointerdown', event => { if (event.button !== 0) return; event.preventDefault(); spectrum.focus(); spectrum.setPointerCapture(event.pointerId); spectrumPointer(event); });
            spectrum.addEventListener('pointermove', event => { if (spectrum.hasPointerCapture(event.pointerId)) spectrumPointer(event); });
            spectrum.addEventListener('pointerup', event => { if (spectrum.hasPointerCapture(event.pointerId)) spectrum.releasePointerCapture(event.pointerId); });
            spectrum.addEventListener('keydown', event => {
                if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
                event.preventDefault(); const step = event.shiftKey ? 10 : 1;
                if (event.key === 'ArrowLeft') hsv.s = clamp(hsv.s - step, 0, 100);
                if (event.key === 'ArrowRight') hsv.s = clamp(hsv.s + step, 0, 100);
                if (event.key === 'ArrowUp') hsv.v = clamp(hsv.v + step, 0, 100);
                if (event.key === 'ArrowDown') hsv.v = clamp(hsv.v - step, 0, 100);
                updateFromHsv();
            });
            colorPanel.addEventListener('keydown', event => {
                if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeColorPanel(true); }
                if (event.key === 'Enter' && event.target.matches('input:not([type="range"])')) { event.preventDefault(); colorPanel.querySelector('.color-apply').click(); }
                if (event.key === 'Tab') {
                    const controls = Array.from(colorPanel.querySelectorAll('button:not(:disabled), input, [tabindex="0"]'));
                    if ((!event.shiftKey && event.target === controls.at(-1)) || (event.shiftKey && event.target === controls[0])) { event.preventDefault(); closeColorPanel(true); }
                }
            });
            document.addEventListener('pointerdown', event => { if (!colorPanel.hidden && !colorPanel.contains(event.target) && !colorTrigger.contains(event.target)) closeColorPanel(); });
            document.addEventListener('focusin', event => { if (!colorPanel.hidden && !colorPanel.contains(event.target) && !colorTrigger.contains(event.target)) closeColorPanel(); });

            const tooltip = document.createElement('div');
            tooltip.id = 'editor-ui-tooltip'; tooltip.className = 'editor-ui-tooltip'; tooltip.hidden = true; tooltip.setAttribute('role','tooltip');
            document.body.appendChild(tooltip);
            let tooltipOwner = null, tooltipTimer;
            function hideTooltip() {
                clearTimeout(tooltipTimer); tooltip.hidden = true;
                if (tooltipOwner) {
                    const ids = (tooltipOwner.getAttribute('aria-describedby') || '').split(' ').filter(id => id && id !== tooltip.id);
                    if (ids.length) tooltipOwner.setAttribute('aria-describedby', ids.join(' ')); else tooltipOwner.removeAttribute('aria-describedby');
                }
                tooltipOwner = null;
            }
            function positionTooltip() {
                if (!tooltipOwner || tooltip.hidden) return;
                const anchor = tooltipOwner.getBoundingClientRect(), box = tooltip.getBoundingClientRect();
                if (anchor.bottom < 0 || anchor.top > innerHeight || anchor.right < 0 || anchor.left > innerWidth) { hideTooltip(); return; }
                tooltip.style.left = clamp(anchor.left + anchor.width / 2 - box.width / 2, 8, Math.max(8, innerWidth - box.width - 8)) + 'px';
                tooltip.style.top = clamp(anchor.top - box.height - 8 >= 8 ? anchor.top - box.height - 8 : anchor.bottom + 8, 8, Math.max(8, innerHeight - box.height - 8)) + 'px';
            }
            function showTooltip(owner, immediate = false) {
                if (owner === tooltipOwner || !colorPanel.hidden) return;
                hideTooltip(); tooltipOwner = owner;
                const reveal = () => {
                    if (!owner.isConnected || tooltipOwner !== owner) return;
                    tooltip.textContent = owner.dataset.tooltip; tooltip.hidden = false;
                    owner.setAttribute('aria-describedby', ((owner.getAttribute('aria-describedby') || '') + ' ' + tooltip.id).trim());
                    positionTooltip();
                };
                if (immediate) reveal(); else tooltipTimer = setTimeout(reveal, 160);
            }
            document.addEventListener('pointerover', event => { const owner = event.target.closest('.tooltip-container[data-tooltip]'); if (owner) showTooltip(owner); });
            document.addEventListener('pointermove', event => { const owner = event.target.closest('.tooltip-container[data-tooltip]'); if (owner && !tooltipOwner) showTooltip(owner); });
            document.addEventListener('pointerout', event => { if (tooltipOwner && !tooltipOwner.contains(event.relatedTarget)) hideTooltip(); });
            document.addEventListener('focusin', event => { const owner = event.target.closest('.tooltip-container[data-tooltip]'); if (owner) showTooltip(owner, true); else hideTooltip(); });
            document.addEventListener('click', hideTooltip);
            document.addEventListener('keydown', event => { if (event.key === 'Escape') hideTooltip(); });
            document.addEventListener('scroll', event => { positionTooltip(); if (!colorPanel.contains(event.target)) positionColorPanel(); }, true);
            window.addEventListener('resize', () => { hideTooltip(); positionColorPanel(); });

            // --- Sistema de Seleção e Movimentação de Blocos ---
            function selecionarBloco(bloco) {
                $('.bbcode-bloco').removeClass('selecionado');
                blocoSelecionado = bloco;
                if (bloco) {
                    $(bloco).addClass('selecionado');
                }
            }

            function moverBlocoParaCima(bloco) {
                bloco = $(bloco)[0];
                if (bloco.previousSibling) bloco.parentNode.insertBefore(bloco, bloco.previousSibling);
                editor.dispatchEvent(new Event('input', { bubbles: true }));
            }

            function moverBlocoParaBaixo(bloco) {
                bloco = $(bloco)[0];
                if (bloco.nextSibling) bloco.parentNode.insertBefore(bloco, bloco.nextSibling.nextSibling);
                editor.dispatchEvent(new Event('input', { bubbles: true }));
            }

            function removerBloco(bloco) {
                $(bloco).remove();
                blocoSelecionado = null;
                editor.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // Clique para selecionar bloco
            $(document).on('click', '.bbcode-bloco', function (e) {
                if (!$(e.target).hasClass('bbcode-ctrl-btn') && !$(e.target).closest('.bbcode-ctrl-btn').length) {
                    e.stopPropagation();
                    selecionarBloco(this);
                }
            });

            // Deselecionar ao clicar fora
            $(document).on('click', function (e) {
                if (!$(e.target).closest('.bbcode-bloco').length && !$(e.target).closest('.bbcode-editor-toolbar').length) {
                    selecionarBloco(null);
                }
            });

            // Controles dos blocos
            $(document).on('click', '.bbcode-ctrl-btn.cima', function (e) {
                e.stopPropagation();
                const bloco = $(this).closest('.bbcode-bloco');
                moverBlocoParaCima(bloco);
            });

            $(document).on('click', '.bbcode-ctrl-btn.baixo', function (e) {
                e.stopPropagation();
                const bloco = $(this).closest('.bbcode-bloco');
                moverBlocoParaBaixo(bloco);
            });

            $(document).on('click', '.bbcode-ctrl-btn.remover', function (e) {
                e.stopPropagation();
                const bloco = $(this).closest('.bbcode-bloco');
                removerBloco(bloco);
            });

            // Navegação por teclado
            $(document).on('keydown', function (e) {
                if (blocoSelecionado && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                    e.preventDefault();
                    if (e.key === 'ArrowUp') {
                        moverBlocoParaCima(blocoSelecionado);
                    } else {
                        moverBlocoParaBaixo(blocoSelecionado);
                    }
                }
                if (blocoSelecionado && (e.key === 'Delete' || e.key === 'Backspace')) {
                    // Verifica se estamos dentro de um elemento contenteditable
                    const activeEl = document.activeElement;
                    const isInContentEditable = activeEl && (
                        activeEl.getAttribute('contenteditable') === 'true' ||
                        activeEl.closest('[contenteditable="true"]') !== null
                    );

                    // Só remove o bloco se NÃO estiver editando texto dentro dele
                    if (!isInContentEditable) {
                        e.preventDefault();
                        removerBloco(blocoSelecionado);
                    }
                }
            });

            // O destino é um cursor no texto, inclusive entre blocos comuns.
            function destinoDoArraste(x, y) {
                const bounds = editor.getBoundingClientRect();
                if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return null;
                let range;
                if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(x, y);
                else if (document.caretPositionFromPoint) {
                    const pos = document.caretPositionFromPoint(x, y);
                    if (pos) {
                        range = document.createRange();
                        range.setStart(pos.offsetNode, pos.offset);
                        range.collapse(true);
                    }
                }
                if (!rangeNoEditor(range)) return null;
                const node = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
                const bloco = node.closest('.bbcode-bloco');
                if (bloco === blocoArrastando || blocoArrastando.contains(node)) return null;
                if (bloco) {
                    const rect = bloco.getBoundingClientRect();
                    if (y < rect.top + rect.height / 2) range.setStartBefore(bloco);
                    else range.setStartAfter(bloco);
                    range.collapse(true);
                }
                return range;
            }
            $(document).on('pointerdown', '.bbcode-ctrl-btn.mover', function (e) {
                if (e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                blocoArrastando = $(this).closest('.bbcode-bloco')[0];
                selecionarBloco(blocoArrastando);
                $(blocoArrastando).addClass('arrastando');
                const indicador = document.createElement('div');
                indicador.className = 'editor-drop-marker';
                document.body.appendChild(indicador);
                let destino = null;
                function atualizar(e) {
                    destino = destinoDoArraste(e.clientX, e.clientY);
                    indicador.hidden = !destino;
                    if (!destino) return;
                    const rect = destino.getClientRects()[0] || destino.startContainer.getBoundingClientRect?.() || editor.getBoundingClientRect();
                    indicador.style.left = rect.left + 'px';
                    indicador.style.top = rect.top + 'px';
                    indicador.style.height = Math.max(rect.height, 20) + 'px';
                }
                function terminar(e) {
                    if (e.type === 'pointerup') {
                        atualizar(e);
                        if (destino) {
                            selecaoSalva = destino;
                            inserirNoEditor(blocoArrastando);
                        }
                    }
                    $(blocoArrastando).removeClass('arrastando');
                    blocoArrastando = null;
                    indicador.remove();
                    $(document).off('.editorDrag');
                    $(window).off('.editorDrag');
                }
                $(document).on('pointermove.editorDrag', atualizar)
                    .on('pointerup.editorDrag pointercancel.editorDrag', terminar);
                $(window).on('blur.editorDrag', terminar);
            });

            // --- Criar controles do bloco ---
            function criarControlesBloco() {
                return `
            <div class="bbcode-controles" contenteditable="false">
                <button type="button" class="bbcode-ctrl-btn mover" title="Arrastar"><i class="ti ti-grip-vertical"></i></button>
                <button type="button" class="bbcode-ctrl-btn cima" title="Mover para cima"><i class="ti ti-chevron-up"></i></button>
                <button type="button" class="bbcode-ctrl-btn baixo" title="Mover para baixo"><i class="ti ti-chevron-down"></i></button>
                <button type="button" class="bbcode-ctrl-btn remover" title="Remover"><i class="ti ti-x"></i></button>
            </div>
        `;
            }

            // --- Handlers BBCode Especiais ---
            $('.bbcode-btn[data-bbcode]').on('click', function (e) {
                e.preventDefault();
                restaurarSelecao();
                const tipo = $(this).data('bbcode');

                switch (tipo) {
                    case 'hr':
                        inserirHR();
                        break;
                    case 'list':
                        mostrarModalLista();
                        break;
                    case 'quote':
                        mostrarModalQuote();
                        break;
                    case 'spoiler':
                        mostrarModalSpoiler();
                        break;
                    case 'code':
                        inserirCode();
                        break;
                    case 'hide':
                        inserirHide();
                        break;
                    case 'table':
                        mostrarModalTabela();
                        break;
                    case 'url':
                        mostrarModalURL();
                        break;
                }
            });

            function inserirHR() {
                const container = document.createElement('div');
                container.className = 'bbcode-bloco';
                container.innerHTML = criarControlesBloco() + '<hr class="bbcode-hr">';
                container.setAttribute('data-tipo', 'hr');
                inserirNoEditor(container);
            }

            function inserirCode() {
                const selecao = window.getSelection();
                let texto = '';
                if (selecao.rangeCount > 0 && !selecao.isCollapsed) {
                    texto = selecao.toString();
                }

                const container = document.createElement('div');
                container.className = 'bbcode-bloco';
                container.setAttribute('data-tipo', 'code');
                container.innerHTML = criarControlesBloco() + `
            <div class="bbcode-code" contenteditable="true">${escapeHtml(texto || 'Seu código aqui...')}</div>
        `;
                inserirNoEditor(container);
            }

            function inserirHide() {
                const selecao = window.getSelection();
                let texto = '';
                if (selecao.rangeCount > 0 && !selecao.isCollapsed) {
                    texto = selecao.toString();
                }

                const container = document.createElement('div');
                container.className = 'bbcode-bloco';
                container.setAttribute('data-tipo', 'hide');
                container.innerHTML = criarControlesBloco() + `
            <div class="bbcode-hide" contenteditable="true">${escapeHtml(texto || 'Conteúdo oculto...')}</div>
        `;
                inserirNoEditor(container);
            }

            function mostrarModalLista() {
                const html = `
            <label class="modal-label">Itens da lista (um por linha):</label>
            <textarea class="modal-input" id="input-lista-itens" rows="5" placeholder="Item 1&#10;Item 2&#10;Item 3"></textarea>
        `;
                GerenciadorModal.mostrar('<i class="ti ti-list"></i> Inserir Lista', html, [
                    {
                        texto: 'Inserir', classe: 'primario', acao: function () {
                            const itens = $('#input-lista-itens').val().split('\n').filter(i => i.trim());
                            if (itens.length > 0) {
                                const container = document.createElement('div');
                                container.className = 'bbcode-bloco';
                                container.setAttribute('data-tipo', 'list');

                                let listaHtml = '<ul class="bbcode-list">';
                                itens.forEach(item => {
                                    listaHtml += `<li>${escapeHtml(item.trim())}</li>`;
                                });
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
                let textoSelecionado = '';
                if (selecao.rangeCount > 0 && !selecao.isCollapsed) {
                    textoSelecionado = selecao.toString();
                }

                const html = `
            <label class="modal-label">Autor da citação:</label>
            <input type="text" class="modal-input" id="input-quote-autor" placeholder="Nome do autor (opcional)">
            <label class="modal-label">Texto da citação:</label>
            <textarea class="modal-input" id="input-quote-texto" rows="4" placeholder="Texto da citação...">${escapeHtml(textoSelecionado)}</textarea>
        `;
                GerenciadorModal.mostrar('<i class="ti ti-quote"></i> Inserir Citação', html, [
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
                                <i class="ti ti-quote"></i> <span contenteditable="false">Citando:</span> <span class="bbcode-quote-autor" contenteditable="true" data-placeholder="Autor">${escapeHtml(autor || 'Autor')}</span>
                            </div>
                            <div class="bbcode-quote-content" contenteditable="true">${escapeHtml(texto)}</div>
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
                let textoSelecionado = '';
                if (selecao.rangeCount > 0 && !selecao.isCollapsed) {
                    textoSelecionado = selecao.toString();
                }

                const html = `
            <label class="modal-label">Título do Spoiler:</label>
            <input type="text" class="modal-input" id="input-spoiler-titulo" placeholder="Clique para ver...">
            <label class="modal-label">Conteúdo do Spoiler:</label>
            <textarea class="modal-input" id="input-spoiler-conteudo" rows="4" placeholder="Conteúdo oculto...">${escapeHtml(textoSelecionado)}</textarea>
        `;
                GerenciadorModal.mostrar('<i class="ti ti-eye-off"></i> Inserir Spoiler', html, [
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
                                <i class="ti ti-eye-off"></i> <span class="bbcode-spoiler-titulo" contenteditable="true">${escapeHtml(titulo)}</span>
                            </div>
                            <div class="bbcode-spoiler-content" contenteditable="true">${escapeHtml(conteudo)}</div>
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
                GerenciadorModal.mostrar('<i class="ti ti-table"></i> Inserir Tabela', html, [
                    {
                        texto: 'Inserir', classe: 'primario', acao: function () {
                            const linhas = Number($('#input-tabela-linhas').val());
                            const colunas = Number($('#input-tabela-colunas').val());
                            if (!Number.isInteger(linhas) || linhas < 1 || linhas > 20 ||
                                !Number.isInteger(colunas) || colunas < 1 || colunas > 10) {
                                showToast('Use de 1 a 20 linhas e de 1 a 10 colunas.', 'warning');
                                return;
                            }

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

            function urlPermitida(url) {
                try { return ['http:', 'https:', 'mailto:'].includes(new URL(url).protocol); }
                catch (_) { return false; }
            }

            function mostrarModalURL() {
                const selecao = window.getSelection();
                let textoSelecionado = '';
                if (selecao.rangeCount > 0 && !selecao.isCollapsed) {
                    textoSelecionado = selecao.toString();
                }

                const html = `
            <label class="modal-label">URL (endereço do link):</label>
            <input type="text" class="modal-input" id="input-url-endereco" placeholder="https://exemplo.com">
            <label class="modal-label">Texto do link:</label>
            <input type="text" class="modal-input" id="input-url-texto" placeholder="Clique aqui" value="${escapeHtml(textoSelecionado)}">
        `;
                GerenciadorModal.mostrar('<i class="ti ti-link"></i> Inserir Link', html, [
                    {
                        texto: 'Inserir', classe: 'primario', acao: function () {
                            const url = $('#input-url-endereco').val().trim();
                            const texto = $('#input-url-texto').val().trim() || url;
                            if (!urlPermitida(url)) {
                                showToast('Informe um link válido (http, https ou mailto).', 'warning');
                                return;
                            }
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

            // Editar link ao clicar duas vezes
            $(document).on('dblclick', '.bbcode-url', function (e) {
                e.preventDefault();
                e.stopPropagation();
                const linkElement = $(this);
                const urlAtual = linkElement.attr('data-url') || '';
                const textoAtual = linkElement.text();

                const html = `
            <label class="modal-label">URL (endereço do link):</label>
            <input type="text" class="modal-input" id="input-url-editar-endereco" placeholder="https://exemplo.com" value="${escapeHtml(urlAtual)}">
            <label class="modal-label">Texto do link:</label>
            <input type="text" class="modal-input" id="input-url-editar-texto" placeholder="Clique aqui" value="${escapeHtml(textoAtual)}">
            <div style="margin-top: 10px; padding: 10px; background: rgba(140, 95, 222, .1); border-radius: 8px; display: flex; align-items: center; gap: 8px;">
                <i class="ti ti-info-circle" style="color: var(--cor-primaria);"></i>
                <span style="font-size: 0.85rem; color: var(--texto-suave);">Dica: Clique duas vezes em qualquer link para editá-lo.</span>
            </div>
        `;
                GerenciadorModal.mostrar('<i class="ti ti-edit"></i> Editar Link', html, [
                    {
                        texto: 'Salvar', classe: 'primario', acao: function () {
                            const novaUrl = $('#input-url-editar-endereco').val().trim();
                            const novoTexto = $('#input-url-editar-texto').val().trim() || novaUrl;
                            if (!urlPermitida(novaUrl)) {
                                showToast('Informe um link válido (http, https ou mailto).', 'warning');
                                return;
                            }
                            if (novaUrl) {
                                linkElement.attr('data-url', novaUrl);
                                linkElement.text(novoTexto);
                                editor.dispatchEvent(new Event('input', { bubbles: true }));
                            }
                            GerenciadorModal.fechar();
                        }
                    },
                    {
                        texto: 'Remover Link', classe: 'secundario', acao: function () {
                            const textoPlano = linkElement.text();
                            linkElement.replaceWith(document.createTextNode(textoPlano));
                            editor.dispatchEvent(new Event('input', { bubbles: true }));
                            GerenciadorModal.fechar();
                        }
                    },
                    { texto: 'Cancelar', classe: 'secundario', acao: GerenciadorModal.fechar }
                ]);
            });

            function inserirNoEditor(elemento) {
                const range = restaurarSelecao();
                range.deleteContents();
                const node = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
                let paragrafo = node;
                while (paragrafo !== editor && paragrafo.parentElement !== editor) paragrafo = paragrafo.parentElement;
                if (elemento.classList.contains('bbcode-bloco') && paragrafo !== editor &&
                    !paragrafo.classList.contains('bbcode-bloco') && /^(DIV|P)$/.test(paragrafo.tagName)) {
                    const final = range.cloneRange();
                    final.setEnd(paragrafo, paragrafo.childNodes.length);
                    const depois = paragrafo.cloneNode(false);
                    depois.appendChild(final.extractContents());
                    paragrafo.after(elemento, depois);
                } else {
                    range.insertNode(elemento);
                }
                range.setStartAfter(elemento);
                range.collapse(true);
                if (elemento.classList.contains('bbcode-bloco') && !elemento.nextSibling) {
                    const linha = document.createElement('div');
                    linha.appendChild(document.createElement('br'));
                    elemento.after(linha);
                    range.setStart(linha, 0);
                }
                window.getSelection().removeAllRanges();
                window.getSelection().addRange(range);
                salvarSelecao();
                editor.dispatchEvent(new Event('input', { bubbles: true }));
            }

            // --- Conversor HTML para BBCode ---
            function textoLiteral(node) {
                if (node.nodeType === 3) return node.textContent;
                if (node.nodeName === 'BR') return '\n';
                let texto = '';
                Array.from(node.childNodes).forEach(child => {
                    const bloco = /^(DIV|P)$/.test(child.nodeName);
                    if (bloco && texto && !texto.endsWith('\n')) texto += '\n';
                    texto += textoLiteral(child);
                    if (bloco && child.nextSibling && !texto.endsWith('\n')) texto += '\n';
                });
                return texto;
            }

            function textoDaProposta() {
                const clone = editor.cloneNode(true);
                clone.querySelectorAll('.bbcode-controles').forEach(node => node.remove());
                return textoLiteral(clone).trim();
            }

            function converterHtmlParaBbcode(conteiner, alinhamentoPai = '') {
                function formatarTag(conteudo, tagAbre, tagFecha) {
                    if (!conteudo || !conteudo.trim()) return conteudo;
                    const espacoAntes = conteudo.match(/^\s*/)[0];
                    const espacoDepois = conteudo.match(/\s*$/)[0];
                    const textoLimpo = conteudo.trim();
                    return espacoAntes + tagAbre + textoLimpo + tagFecha + espacoDepois;
                }

                function elementoVazioOuSoBr(el) {
                    const filhos = $(el).contents().filter(function () {
                        if (this.nodeType === 3 && !this.textContent.trim()) return false;
                        return true;
                    });
                    if (filhos.length === 0) return true;
                    if (filhos.length === 1 && filhos[0].nodeType === 1 && filhos[0].tagName.toLowerCase() === 'br') return true;
                    return false;
                }

                let bbcode = '';
                let alinhamentoAberto = '';
                function alinhar(alinhamento) {
                    if (alinhamento === alinhamentoAberto) return;
                    if (alinhamentoAberto) bbcode += '[/' + alinhamentoAberto + ']';
                    alinhamentoAberto = alinhamento;
                    if (alinhamento) bbcode += '[' + alinhamento + ']';
                }
                $(conteiner).contents().each(function () {
                    const no = this;
                    if (no.nodeType === 1 && no.classList.contains('bbcode-controles')) return;
                    if (no.nodeType === 1 && /^(DIV|P)$/.test(no.tagName) && no.previousSibling &&
                        no.previousSibling.nodeType === 3 && no.previousSibling.textContent.trim() && !bbcode.endsWith('\n')) bbcode += '\n';
                    const alinhamento = no.nodeType === 1 ? no.style.textAlign : '';
                    const tagAlinhamento = { center: 'center', right: 'right', justify: 'justify', left: 'left' }[alinhamento] || '';
                    if (no.nodeType !== 3 || no.textContent.trim()) alinhar(alinhamento === alinhamentoPai ? '' : tagAlinhamento);

                    if (no.nodeType === 1) {
                        const el = $(no);
                        const nomeTag = no.tagName.toLowerCase();

                        // Ignorar controles
                        if (el.hasClass('bbcode-controles')) return;

                        // BBCode Especiais (Blocos)
                        if (el.hasClass('bbcode-bloco')) {
                            const tipo = el.attr('data-tipo');

                            switch (tipo) {
                                case 'hr':
                                    bbcode += '[hr]\n';
                                    break;
                                case 'spoiler':
                                    const tituloSpoiler = el.children('.bbcode-spoiler').children('.bbcode-spoiler-header').find('.bbcode-spoiler-titulo').first().text().trim() || 'Spoiler';
                                    const conteudoSpoiler = converterHtmlParaBbcode(el.children('.bbcode-spoiler').children('.bbcode-spoiler-content')[0]).trim();
                                    bbcode += `[spoiler="${tituloSpoiler}"]${conteudoSpoiler}[/spoiler]\n`;
                                    break;
                                case 'quote':
                                    const autorQuote = el.children('.bbcode-quote').children('.bbcode-quote-header').find('.bbcode-quote-autor').first().text().trim();
                                    const conteudoQuote = converterHtmlParaBbcode(el.children('.bbcode-quote').children('.bbcode-quote-content')[0]).trim();
                                    if (autorQuote && autorQuote !== 'Autor') {
                                        bbcode += `[quote="${autorQuote}"]${conteudoQuote}[/quote]\n`;
                                    } else {
                                        bbcode += `[quote]${conteudoQuote}[/quote]\n`;
                                    }
                                    break;
                                case 'code':
                                    bbcode += `[code]${textoLiteral(el.children('.bbcode-code')[0])}[/code]\n`;
                                    break;
                                case 'hide':
                                    bbcode += `[hide]${converterHtmlParaBbcode(el.children('.bbcode-hide')[0]).trim()}[/hide]\n`;
                                    break;
                                case 'list':
                                    bbcode += '[list]\n';
                                    el.children('ul, ol').children('li').each(function () {
                                        bbcode += `[*]${converterHtmlParaBbcode(this).trim()}\n`;
                                    });
                                    bbcode += '[/list]\n';
                                    break;
                                case 'table':
                                    bbcode += '[table]\n';
                                    el.children('table').find('> tbody > tr, > thead > tr, > tfoot > tr, > tr').each(function () {
                                        bbcode += '[tr]';
                                        $(this).children('td, th').each(function () {
                                            bbcode += `[td]${converterHtmlParaBbcode(this).trim()}[/td]`;
                                        });
                                        bbcode += '[/tr]\n';
                                    });
                                    bbcode += '[/table]\n';
                                    break;
                            }
                            return;
                        }

                        if (el.hasClass('bbcode-url')) {
                            const url = el.attr('data-url');
                            const texto = el.text().trim();
                            bbcode += `[url=${url}]${texto}[/url]`;
                            return;
                        }

                        let conteudo = converterHtmlParaBbcode(no, alinhamento || alinhamentoPai);

                        let prefixo = '';
                        let sufixo = '';


                        switch (nomeTag) {
                            case 'b': case 'strong':
                                bbcode += prefixo + formatarTag(conteudo, '[b]', '[/b]') + sufixo;
                                break;
                            case 'i': case 'em':
                                bbcode += prefixo + formatarTag(conteudo, '[i]', '[/i]') + sufixo;
                                break;
                            case 'u':
                                bbcode += prefixo + formatarTag(conteudo, '[u]', '[/u]') + sufixo;
                                break;
                            case 'strike': case 's':
                                bbcode += prefixo + formatarTag(conteudo, '[strike]', '[/strike]') + sufixo;
                                break;
                            case 'font':
                                if (no.color) {
                                    bbcode += prefixo + formatarTag(conteudo, `[color=${no.color}]`, `[/color]`) + sufixo;
                                } else {
                                    bbcode += prefixo + conteudo + sufixo;
                                }
                                break;
                            case 'span':
                                let resultado = conteudo;
                                if (no.style.color) {
                                    resultado = formatarTag(resultado, `[color=${no.style.color}]`, `[/color]`);
                                }
                                if (no.style.textDecoration && no.style.textDecoration.includes('line-through')) {
                                    resultado = formatarTag(resultado, `[strike]`, `[/strike]`);
                                }
                                bbcode += prefixo + resultado + sufixo;
                                break;
                            case 'div':
                                if (elementoVazioOuSoBr(no)) {
                                    bbcode += '\n';
                                } else {
                                    if (conteudo.endsWith('\n')) {
                                        bbcode += prefixo + conteudo + sufixo;
                                    } else {
                                        bbcode += prefixo + conteudo + sufixo + '\n';
                                    }
                                }
                                break;
                            case 'p':
                                if (elementoVazioOuSoBr(no)) {
                                    bbcode += '\n';
                                } else {
                                    bbcode += prefixo + conteudo + sufixo + '\n\n';
                                }
                                break;
                            case 'br': bbcode += '\n'; break;
                            case 'hr': bbcode += '[hr]\n'; break;
                            default: bbcode += prefixo + conteudo + sufixo;
                        }
                    }
                    else if (no.nodeType === 3) {
                        bbcode += no.textContent;
                    }
                });
                alinhar('');
                return bbcode;
            }

            // --- Geradores dos conteúdos de envio ---
            function getProposalData() {
                const editorClonado = $('#proposta-editor').clone();
                editorClonado.find('.bbcode-controles').remove();
                const editorContent = converterHtmlParaBbcode(editorClonado[0]).trim();

                const classificacaoChecked = $('#classificacao').val();
                const check = (val) => val === classificacaoChecked ? '(X)' : '( )';
                const classificacaoString = `${check('Correção')} Correção    ${check('Sugestão')} Sugestão    ${check('Projeto')} Projeto`;

                return {
                    autor: forumUsername,
                    numero: $('#ordem').val().trim(),
                    classificacao: classificacaoChecked,
                    classificacaoString,
                    tema: $('#tema_proposta').val().trim(),
                    descricaoBbcode: editorContent || 'Sem descrição.',
                    descricaoTexto: textoDaProposta()
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

                if (!forumUsername || $('#nickname').val().trim() !== forumUsername) { $('#nickname').addClass('invalid'); missingFields.push("sessão do fórum"); isValid = false; }
                const ordemVal = $('#ordem').val().trim();
                if (ordemVal === "" || !/^\d+$/.test(ordemVal) || parseInt(ordemVal, 10) <= 0) { $('#ordem').addClass('invalid'); missingFields.push("Ordem"); isValid = false; }
                if (!['Correção', 'Sugestão', 'Projeto'].includes($('#classificacao').val())) { $('#classificacao').addClass('invalid'); missingFields.push("Classificação"); isValid = false; }
                if ($('#tema_proposta').val().trim() === "") { $('#tema_proposta').addClass('invalid'); missingFields.push("Tema"); isValid = false; }

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
                    '<i class="ti ti-code"></i> BBCode Gerado',
                    `<pre class="bbcode-output">${escapeHtml(fullBbcode)}</pre>`,
                    [
                        {
                            texto: '<i class="ti ti-copy"></i> Copiar Código', classe: 'primario', acao: function () {
                                const tempTextarea = document.createElement('textarea');
                                tempTextarea.value = fullBbcode;
                                document.body.appendChild(tempTextarea);
                                tempTextarea.select();
                                try {
                                    document.execCommand('copy');
                                    showToast("BBCode copiado com sucesso!", "success");
                                    $(this).html('<i class="ti ti-check"></i> Copiado!');
                                } catch (err) {
                                    showToast("Falha ao copiar o código.", "error");
                                }
                                document.body.removeChild(tempTextarea);
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
                return failures.some(pattern => pageText.includes(pattern))
                    ? 'O fórum recusou a operação.'
                    : '';
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

            async function ensureAnonymousFirebaseSession() {
                if (!proposalAuth) throw new Error('O Firebase Authentication não foi inicializado.');
                if (proposalAuth.currentUser) return proposalAuth.currentUser;

                await proposalAuth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
                const credential = await proposalAuth.signInAnonymously();
                if (!credential.user) throw new Error('O Firebase não criou a sessão de gravação.');
                return credential.user;
            }

            function saoPauloParts(value = new Date()) {
                return new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'America/Sao_Paulo',
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
                }).formatToParts(value).reduce((result, part) => {
                    if (part.type !== 'literal') result[part.type] = Number(part.value);
                    return result;
                }, {});
            }

            function saoPauloMidnight(year, month, day) {
                const desired = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
                let candidate = new Date(desired + 3 * 60 * 60 * 1000);
                for (let attempt = 0; attempt < 2; attempt++) {
                    const parts = saoPauloParts(candidate);
                    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, 0);
                    candidate = new Date(candidate.getTime() + (desired - represented));
                }
                candidate.setUTCMilliseconds(0);
                return candidate;
            }

            function getProposalWeek(value = new Date()) {
                const parts = saoPauloParts(value);
                const calendar = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
                const daysSinceFriday = (calendar.getUTCDay() - 5 + 7) % 7;
                calendar.setUTCDate(calendar.getUTCDate() - daysSinceFriday);
                const year = calendar.getUTCFullYear();
                const month = calendar.getUTCMonth() + 1;
                const day = calendar.getUTCDate();
                const pad = number => String(number).padStart(2, '0');
                const start = saoPauloMidnight(year, month, day);
                const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
                return { id: `semana_${year}-${pad(month)}-${pad(day)}`, start, end };
            }

            function getCycleWeekId(cycle) {
                const source = cycle?.semanaEnvioInicio?.toDate
                    ? cycle.semanaEnvioInicio.toDate()
                    : (cycle?.semanaEnvioInicio || cycle?.inicioIso || new Date());
                return cycle?.semanaEnvioId || getProposalWeek(new Date(source)).id;
            }

            function proposalWeekFields(week) {
                return {
                    semanaEnvioId: week.id,
                    semanaEnvioInicio: firebase.firestore.Timestamp.fromDate(week.start),
                    semanaEnvioFim: firebase.firestore.Timestamp.fromDate(week.end)
                };
            }

            async function getCurrentProposalCycle() {
                const snapshot = await proposalDb
                    .collection('nexus_config')
                    .doc('Propostas')
                    .collection('configuracoes')
                    .doc('ciclo_atual')
                    .get();

                const cycle = snapshot.exists ? snapshot.data() : null;
                if (!cycle || cycle.status !== 'aberto' || !cycle.id) {
                    throw new Error('A Central ainda não abriu o ciclo atual de propostas.');
                }
                return cycle;
            }

            async function saveProposalToFirebase(data, sendLeadership) {
                if (!proposalDb) throw new Error('O Firebase não foi inicializado.');

                const firebaseUser = await ensureAnonymousFirebaseSession();
                const currentCycle = await getCurrentProposalCycle();
                const proposalWeek = getProposalWeek();
                const cycleId = getCycleWeekId(currentCycle) === proposalWeek.id
                    ? currentCycle.id
                    : proposalWeek.id;
                const proposalId = String(data.numero);
                const proposalRef = proposalDb
                    .collection('nexus_config')
                    .doc('Propostas')
                    .collection('lista_propostas')
                    .doc(proposalId);

                const proposalPayload = {
                        ordem: Number(data.numero),
                        ordemId: proposalId,
                        autor: data.autor,
                        autorUid: firebaseUser.uid,
                        tipo: data.classificacao,
                        titulo: data.tema,
                        conteudo: escapeHtml(data.descricaoTexto),
                        data: new Date().toISOString(),
                        origem: 'forum-ouvidoria',
                        enviadoLideranca: sendLeadership === true,
                        cicloId: cycleId,
                        ...proposalWeekFields(proposalWeek),
                        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
                };

                try {
                    await proposalRef.set(proposalPayload);
                } catch (error) {
                    if (error?.code === 'permission-denied') {
                        const refreshedCycle = await getCurrentProposalCycle();
                        const refreshedWeek = getProposalWeek();
                        const refreshedDestination = getCycleWeekId(refreshedCycle) === refreshedWeek.id
                            ? refreshedCycle.id
                            : refreshedWeek.id;
                        if (refreshedDestination !== cycleId || refreshedWeek.id !== proposalWeek.id) {
                            await proposalRef.set({
                                ...proposalPayload,
                                cicloId: refreshedDestination,
                                ...proposalWeekFields(refreshedWeek)
                            });
                            return;
                        }
                        throw new Error('O número já existe ou as regras do Firebase ainda não foram publicadas.');
                    }
                    throw error;
                }
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
                TelaEnvio.ocultar();
                GerenciadorModal.mostrar(
                    '<i class="ti ti-alert-triangle" aria-hidden="true"></i> Envio não concluído',
                    `<div style="padding:10px 0;">
                        <p style="margin-bottom:10px;">${escapeHtml(error.message || error)}</p>
                        <p style="margin-bottom:15px;">Copie o conteúdo abaixo para realizar a publicação manual:</p>
                        <textarea id="bbcode-fallback" readonly style="width:100%;height:190px;background:var(--surface-muted);color:var(--text);border:1px solid var(--border);border-radius:10px;padding:12px;font-family:monospace;font-size:.82rem;resize:vertical;">${escapeHtml(bbcode)}</textarea>
                    </div>`,
                    [
                        {
                            texto: '<i class="ti ti-copy"></i> Copiar BBCode',
                            classe: 'primario',
                            acao: function () {
                                const fallback = document.getElementById('bbcode-fallback');
                                navigator.clipboard.writeText(bbcode).catch(() => {
                                    fallback.select();
                                    document.execCommand('copy');
                                }).finally(() => showToast('BBCode copiado!', 'success'));
                            }
                        },
                        { texto: 'Fechar', classe: 'secundario', acao: GerenciadorModal.fechar }
                    ], { tipo: 'notice', status: 'error' }
                );
            }

            const TelaEnvio = {
                elemento: document.getElementById('proposal-delivery'),
                iniciar: function () {
                    closeColorPanel();
                    hideTooltip();
                    this.elemento.hidden = false;
                    this.elemento.dataset.state = 'sending';
                    this.elemento.setAttribute('aria-busy', 'true');
                    this.elemento.querySelector('.delivery-screen-actions').hidden = true;
                    document.getElementById('delivery-warning').hidden = true;
                    document.getElementById('delivery-title').textContent = 'Enviando sua proposta';
                    document.getElementById('delivery-description').textContent = 'Aguarde enquanto sua proposta é encaminhada.';
                    document.body.classList.add('is-delivering');
                    document.querySelector('.main-scroll').inert = true;
                    this.etapa(8, 'Preparando o envio…');
                    document.getElementById('delivery-title').focus({ preventScroll: true });
                },
                etapa: function (progress, message) {
                    const track = this.elemento.querySelector('.delivery-progress');
                    track.setAttribute('aria-valuenow', String(progress));
                    track.setAttribute('aria-valuetext', message);
                    track.style.setProperty('--delivery-progress', progress / 100);
                    document.getElementById('delivery-phase').textContent = message;
                },
                concluir: function (warnings) {
                    this.elemento.dataset.state = warnings.length ? 'warning' : 'success';
                    this.elemento.setAttribute('aria-busy', 'false');
                    document.getElementById('delivery-title').textContent = 'Proposta enviada!';
                    document.getElementById('delivery-description').textContent = 'Sua proposta foi publicada. Obrigado por contribuir com a Companhia.';
                    this.etapa(100, 'Envio concluído');
                    const warning = document.getElementById('delivery-warning');
                    warning.textContent = warnings.join(' ');
                    warning.hidden = !warnings.length;
                    this.elemento.querySelector('.delivery-screen-actions').hidden = false;
                    document.getElementById('delivery-again').focus({ preventScroll: true });
                },
                ocultar: function () {
                    const restoreFocus = this.elemento.contains(document.activeElement);
                    this.elemento.hidden = true;
                    document.body.classList.remove('is-delivering');
                    document.querySelector('.main-scroll').inert = false;
                    if (restoreFocus) document.getElementById('ordem').focus({ preventScroll: true });
                }
            };
            document.getElementById('delivery-again').addEventListener('click', () => {
                $('#ouvidoria-form')[0].reset();
                $('#nickname').val(forumUsername);
                $('#proposta-editor').empty();
                $('.bbcode-btn').removeClass('active');
                $('#char-count').text('0');
                selecaoSalva = null;
                selecionarBloco(null);
                delete document.getElementById('seletor-cor').dataset.userColor;
                syncThemeButton();
                formDirty = false;
                TelaEnvio.ocultar();
                document.getElementById('ordem').focus();
            });
            document.getElementById('delivery-forum').addEventListener('click', () => {
                window.location.href = `https://www.policiarcc.com/t${TOPIC_ID}-prof-ouvidoria?view=newest#newest`;
            });
            TelaEnvio.elemento.addEventListener('keydown', event => {
                event.stopPropagation();
                if (event.key === 'Escape') event.preventDefault();
                if (event.key === 'Tab') {
                    const controls = Array.from(TelaEnvio.elemento.querySelectorAll('button')).filter(button => button.getClientRects().length);
                    if (!controls.length) { event.preventDefault(); return; }
                    if (event.shiftKey && (document.activeElement === controls[0] || document.activeElement.id === 'delivery-title')) { event.preventDefault(); controls.at(-1).focus(); }
                    else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
                }
            });
            let envioEmAndamento = false;
            $('#ouvidoria-form').on('submit', async function (event) {
                event.preventDefault();
                if (envioEmAndamento) return;
                envioEmAndamento = true;

                const submitButton = $('#submit-button');
                const restoreButton = () => {
                    envioEmAndamento = false;
                    submitButton.prop('disabled', !forumUsername).html('<i class="ti ti-send"></i> Enviar Proposta');
                };

                submitButton.prop('disabled', true).html('<i class="ti ti-loader-2 ti-spin"></i> Verificando sessão...');

                const sessionOk = await obterUsuario(false);
                if (!sessionOk || !validateForm()) {
                    restoreButton();
                    return;
                }

                const data = getProposalData();
                const sendLeadership = $('#send-leadership').is(':checked');
                const topicBbcode = sendLeadership
                    ? generateLeadershipTopicBbcode(data)
                    : generateFullBbcode(data);

                if (sendLeadership && !await confirmarEnvioLideranca()) {
                    restoreButton();
                    return;
                }

                try {
                    TelaEnvio.iniciar();
                    if (sendLeadership) {
                        TelaEnvio.etapa(20, 'Encaminhando à Liderança…');
                        submitButton.html('<i class="ti ti-loader-2 ti-spin"></i> Enviando à Liderança...');
                        try {
                            await sendLeadershipPrivateMessage(data);
                        } catch (error) {
                            showForumFallback(error, generateLeadershipPrivateMessage(data));
                            return;
                        }
                    }

                    TelaEnvio.etapa(sendLeadership ? 48 : 25, 'Enviando sua proposta ao fórum…');
                    submitButton.html('<i class="ti ti-loader-2 ti-spin"></i> Publicando no tópico...');
                    try {
                        await postTopic(topicBbcode);
                    } catch (error) {
                        showForumFallback(error, topicBbcode);
                        return;
                    }

                    TelaEnvio.etapa(85, 'Finalizando seu envio…');
                    submitButton.html('<i class="ti ti-loader-2 ti-spin"></i> Finalizando envio...');
                    const [firebaseResult, sheetResult] = await Promise.allSettled([
                        saveProposalToFirebase(data, sendLeadership),
                        saveProposalToSheet(data)
                    ]);

                    const warnings = [];
                    if (firebaseResult.status === 'rejected') {
                        console.error('Falha ao salvar no Firebase:', firebaseResult.reason);
                        warnings.push('A Central ainda não confirmou o recebimento da proposta. Confira o tópico antes de tentar novamente.');
                    }
                    if (sheetResult.status === 'rejected') {
                        console.error('Falha ao salvar na planilha:', sheetResult.reason);
                        warnings.push('Uma etapa complementar não foi concluída. Confira o envio no fórum antes de tentar novamente.');
                    }

                    formDirty = false;
                    TelaEnvio.concluir(warnings);
                } finally {
                    restoreButton();
                }
            });

            $('input, select').on('input change', function () { $(this).removeClass('invalid'); });
            $('#proposta-editor').on('input', function () { $('.editor-wrapper').removeClass('invalid'); });

            // --- Contador de Caracteres ---
            function atualizarContadorCaracteres() {
                const texto = textoDaProposta();
                $('#char-count').text(texto.length);
            }
            $('#proposta-editor').on('input keyup', atualizarContadorCaracteres);
            atualizarContadorCaracteres();

            // --- Preview do BBCode ---
            $('#preview-btn').on('click', function (e) {
                e.preventDefault();

                // O preview usa a árvore do editor: preserva blocos aninhados e código literal.
                const clone = editor.cloneNode(true);
                clone.querySelectorAll('.bbcode-controles').forEach(node => node.remove());
                const tagsPermitidas = new Set(['DIV','P','BR','SPAN','B','STRONG','I','EM','U','S','STRIKE','FONT','UL','OL','LI','TABLE','TBODY','THEAD','TR','TD','TH','HR','PRE','CODE']);
                Array.from(clone.querySelectorAll('*')).reverse().forEach(node => {
                    if (!tagsPermitidas.has(node.tagName)) {
                        node.replaceWith(document.createTextNode(node.textContent));
                        return;
                    }
                    const classes = Array.from(node.classList).filter(name => name.startsWith('bbcode-') || name === 'ti' || /^ti-[a-z-]+$/.test(name));
                    const color = node.style.color || (node.tagName === 'FONT' ? node.color : '');
                    const align = node.style.textAlign;
                    const decoration = node.style.textDecoration;
                    const url = node.classList.contains('bbcode-url') ? node.getAttribute('data-url') : null;
                    Array.from(node.attributes).forEach(attr => node.removeAttribute(attr.name));
                    node.className = classes.join(' ');
                    node.style.color = color;
                    node.style.textAlign = align;
                    node.style.textDecoration = decoration;
                    if (url && urlPermitida(url)) {
                        const link = document.createElement('a');
                        link.href = url;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.textContent = node.textContent;
                        node.replaceWith(link);
                    }
                });
                const data = getProposalData();
                const previewHtml = '<p><strong>Autor(a):</strong> ' + escapeHtml(data.autor) +
                    '<br><strong>Classificação:</strong> ' + escapeHtml(data.classificacaoString) +
                    '<br><strong>Número:</strong> ' + escapeHtml(data.numero) +
                    '<br><strong>Tema:</strong> ' + escapeHtml(data.tema) +
                    '</p><div class="proposal-preview-content">' + clone.innerHTML + '</div>';

                // Container com visual do fórum
                const forumPreview = `
                    <div class="forum-preview">
                        <div class="forum-preview__header">
                            <span>Preview do post no fórum</span>
                        </div>
                        <div class="forum-preview__body">
                            ${previewHtml || '<span style="opacity:0.5">Preencha os campos para ver o preview.</span>'}
                        </div>
                        <div class="forum-preview__note">
                            <i class="ti ti-info-circle" aria-hidden="true"></i>
                            <span>Esta é uma <strong>simulação</strong> de como ficará. Para ver o resultado real, utilize a pré-visualização no fórum.</span>
                        </div>
                    </div>
                `;

                GerenciadorModal.mostrar(
                    '<i class="ti ti-eye"></i> Preview da Proposta',
                    forumPreview,
                    [{ texto: 'Fechar', classe: 'primario', acao: GerenciadorModal.fechar }]
                );
            });

            // --- Confirmação antes de sair ---
            let formDirty = false;
            $('input, select, #proposta-editor').on('input change', function () {
                formDirty = true;
            });

            window.addEventListener('beforeunload', function (e) {
                if (formDirty) {
                    e.preventDefault();
                    e.returnValue = '';
                    return '';
                }
            });

            // Resetar flag quando enviar com sucesso
            const originalDone = $.fn.done;
            $('#ouvidoria-form').data('formSent', false);

            // --- Função de Confetti ---
            function dispararConfetti() {
                const container = $('#confetti-container');
                const cores = ['#8c5fde', '#a37fe4', '#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#f38181'];

                for (let i = 0; i < 100; i++) {
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

                // Limpar confetti após a animação
                setTimeout(() => container.empty(), 5000);
            }

            // --- Modo Foco ---
            $('#focus-mode-btn').on('click', function () {
                $('body').toggleClass('focus-mode');
                const active = $('body').hasClass('focus-mode');
                $(this).attr('data-tooltip', active ? 'Sair do modo foco' : 'Modo Foco').attr('aria-label', active ? 'Sair do modo foco' : 'Modo Foco').attr('aria-pressed', String(active));

                if ($('body').hasClass('focus-mode')) {
                    $(this).find('i').removeClass('ti-arrows-maximize').addClass('ti-arrows-minimize');
                    showToast('Modo foco ativado! Pressione ESC para sair.', 'success');
                } else {
                    $(this).find('i').removeClass('ti-arrows-minimize').addClass('ti-arrows-maximize');
                    showToast('Modo foco desativado.', 'success');
                }
            });

            // ESC para sair do modo foco
            $(document).on('keydown', function (e) {
                if (e.key === 'Escape' && $('body').hasClass('focus-mode')) {
                    $('body').removeClass('focus-mode');
                    $('#focus-mode-btn').attr('data-tooltip', 'Modo Foco').attr('aria-label', 'Modo Foco').attr('aria-pressed', 'false');
                    $('#focus-mode-btn').find('i').removeClass('ti-arrows-minimize').addClass('ti-arrows-maximize');
                    showToast('Modo foco desativado.', 'success');
                }
            });
        });
