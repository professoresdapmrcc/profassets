const CHAVE_API = 'AIzaSyBQhWdy4iyFCk9Lh89x8weSIyl0knXgA34';
const ID_PLANILHA = '1KQXx7TFtbNzMYHzOM5LMT7Fh61hiGOKZHux4K3Q6YpM';
const INTERVALO_DADOS = 'Gerador!B4:J193';

const LISTA_PROXIES = [
    'https://proxydopegas.lipe81444.workers.dev/?url=',
    'https://api.allorigins.win/raw?url=',
    'https://thingproxy.freeboard.io/fetch/',
    'https://api.codetabs.com/v1/proxy?quest='
];

const URL_API_HABBO = 'https://www.habbo.com.br/api/public/users';
const ID_GRUPO_HABBO = 'g-hhbr-77d2964628f63fce5f105b7be518b1d6';
const ID_GRUPO_GRADUADORES = 'g-hhbr-4678e9d206cb74d9696d39a17660d51a';
const ID_GRUPO_SPP = 'g-hhbr-c8b78c26bbe3494726111806bc26c2c6';
const ID_GRUPO_DEP_APLICACAO = 'g-hhbr-d6c10ba3ac926a89d16c46c217960b6f';
const ID_GRUPO_CDC = 'g-hhbr-b7293bcaf77d1a7ef22ee7b274bc78a9';
const ID_GRUPO_CORREGEDORIA = 'g-hhbr-8e057e366f037ccbc2a5de1bdbb8f6a0';
const ID_GRUPO_GATE = 'g-hhbr-6a69ea77637188b67832c7b8e034bf5c';
const ID_GRUPO_GSS = 'g-hhbr-4d2f8fa6bad619fb52f9f9b97de71a87';
const GRUPOS_OUTRAS_COMPANHIAS = [
    { id: 'g-hhbr-ccab1135a807c68fe344847aa48bc5e7', nome: 'Treinadores' },
    { id: 'g-hhbr-c8daaf22635518663d1581e027d47f83', nome: 'Escola de Formação de Executivos' },
    { id: 'g-hhbr-26df51cf81290fd762ad389b72b95ab6', nome: 'Instrutores' },
    { id: 'g-hhbr-b8c5904238ca6050d159bfa7736ff7b8', nome: 'Supervisores' }
];

const ID_TOPICO_FORUM = 32243;
const ID_TOPICO_MEDALHA = 36745;
const REQUEST_TIMEOUT_MS = 8000;
const INTERVALO_MODO_INDIVIDUAL_MS = 1500;
const ESTIMATIVA_INICIAL_CONSULTA_MS = 1000;

async function fetchComTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (erro) {
        if (erro.name === 'AbortError') {
            let destino = String(url);
            try {
                destino = new URL(url, window.location.href).hostname;
            } catch (e) { }
            throw new Error(`Tempo limite excedido ao acessar ${destino}`);
        }
        throw erro;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function fetchWithProxy(url, options = {}, prioridadeDireto = false) {
    let ultimoErro = null;

    try {
        const directResponse = await fetchComTimeout(url, options);
        if (directResponse.ok) return directResponse;
        if (directResponse.status === 404) return directResponse;
    } catch (e) {
        console.log('[Proxy] Fetch direto inicial falhou, usando proxies...');
        ultimoErro = e;
    }

    for (const proxy of LISTA_PROXIES) {
        try {
            const targetUrl = proxy + encodeURIComponent(url);
            const response = await fetchComTimeout(targetUrl, options);
            if (response.ok) return response;
            if (response.status === 404) return response;
            console.warn(`[Proxy] Falha no proxy ${proxy}: ${response.status}`);
        } catch (e) {
            console.warn(`[Proxy] Erro ao conectar com ${proxy}`);
            ultimoErro = e;
        }
    }

    throw ultimoErro || new Error('Todos os proxies falharam');
}

let m_modoVerificacao = 'direto';

window.atualizarEstiloModo = function () {
    const radios = document.getElementsByName('modo-verificacao');
    radios.forEach(r => {
        const elementosPorModo = {
            direto: ['label-modo-rapido', 'dot-rapido'],
            proxy: ['label-modo-estavel', 'dot-estavel'],
            individual: ['label-modo-individual', 'dot-individual']
        };
        const [labelId, dotId] = elementosPorModo[r.value];
        const label = document.getElementById(labelId);
        const dot = document.getElementById(dotId);

        if (r.checked) {
            label.classList.add('border-purple-500', 'bg-purple-50/50', 'dark:bg-purple-500/10');
            label.classList.remove('border-slate-200', 'dark:border-slate-800', 'bg-white', 'dark:bg-[#0f172a]');
            dot.classList.add('bg-purple-500');
            dot.classList.remove('bg-transparent');
            m_modoVerificacao = r.value;
        } else {
            label.classList.remove('border-purple-500', 'bg-purple-50/50', 'dark:bg-purple-500/10');
            label.classList.add('border-slate-200', 'dark:border-slate-800', 'bg-white', 'dark:bg-[#0f172a]');
            dot.classList.remove('bg-purple-500');
            dot.classList.add('bg-transparent');
        }
    });
};

const SHEETS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzzEUQN5twPDbTAbUQA27ysVi-PAwbgoQe1w8BQwY2f8_jzlhI2NPvYpETkYgfe5qdl/exec';

let estadoAtualGlobal = {
    verificador: '',
    timestamp: null,
    resultados: {},
    checkboxes: {},
    avisosPerfilIrregular: {}
};

const CHAVE_AVISOS_PERFIL_IRREGULAR = 'profAvisosPerfilIrregularV1';
const PRAZO_PERFIL_IRREGULAR_MS = 24 * 60 * 60 * 1000;

function carregarAvisosPerfilIrregular() {
    try {
        const dados = JSON.parse(localStorage.getItem(CHAVE_AVISOS_PERFIL_IRREGULAR) || '{}');
        return dados && typeof dados === 'object' && !Array.isArray(dados) ? dados : {};
    } catch (e) {
        console.warn('[Perfil irregular] Não foi possível carregar o histórico local:', e);
        return {};
    }
}

let avisosPerfilIrregular = carregarAvisosPerfilIrregular();

function salvarAvisosPerfilIrregular() {
    localStorage.setItem(CHAVE_AVISOS_PERFIL_IRREGULAR, JSON.stringify(avisosPerfilIrregular));
    estadoAtualGlobal.avisosPerfilIrregular = { ...avisosPerfilIrregular };
    agendarSalvamentoEstado();
}

function obterStatusAvisoPerfilIrregular(nick, agora = Date.now()) {
    const chave = normalizarNick(nick);
    const registro = avisosPerfilIrregular[chave];
    if (!registro?.enviadoEm) {
        return { situacao: 'sem-aviso', podePunir: false, registro: null };
    }

    const referenciaEm = registro.ultimaPunicaoEm || registro.enviadoEm;
    const referenciaMs = new Date(referenciaEm).getTime();
    if (!Number.isFinite(referenciaMs)) {
        delete avisosPerfilIrregular[chave];
        salvarAvisosPerfilIrregular();
        return { situacao: 'sem-aviso', podePunir: false, registro: null };
    }

    const prazoEmMs = referenciaMs + PRAZO_PERFIL_IRREGULAR_MS;
    const restanteMs = prazoEmMs - agora;
    return {
        situacao: restanteMs > 0 ? 'aguardando' : 'prazo-vencido',
        podePunir: restanteMs <= 0,
        restanteMs: Math.max(0, restanteMs),
        referenciaEm,
        prazoEm: new Date(prazoEmMs).toISOString(),
        registro
    };
}

function registrarAvisoPerfilIrregular(nick, cargo) {
    const chave = normalizarNick(nick);
    avisosPerfilIrregular[chave] = {
        nick,
        cargo,
        enviadoEm: new Date().toISOString(),
        ultimaPunicaoEm: null,
        quantidadePunicoes: 0
    };
    salvarAvisosPerfilIrregular();
}

function registrarPunicaoPerfilIrregular(nick, cargo) {
    const chave = normalizarNick(nick);
    const registro = avisosPerfilIrregular[chave];
    if (!registro) return;
    registro.nick = nick;
    registro.cargo = cargo;
    registro.ultimaPunicaoEm = new Date().toISOString();
    registro.quantidadePunicoes = (Number(registro.quantidadePunicoes) || 0) + 1;
    salvarAvisosPerfilIrregular();
}

function limparAvisoPerfilIrregular(nick) {
    const chave = normalizarNick(nick);
    if (!avisosPerfilIrregular[chave]) return;
    delete avisosPerfilIrregular[chave];
    salvarAvisosPerfilIrregular();
}

function formatarDataHoraPerfilIrregular(dataISO) {
    return new Date(dataISO).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function formatarTempoRestantePerfilIrregular(ms) {
    const totalMinutos = Math.max(0, Math.ceil(ms / (60 * 1000)));
    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;
    if (horas <= 0) return `${minutos} min`;
    return `${horas}h ${String(minutos).padStart(2, '0')}min`;
}

let todosOsLogsCache = [];
let timeoutSalvamentoEstado = null;

function salvarEstadoAtual() {
    if (!estadoAtualGlobal.timestamp) return;

    const checkboxes = document.querySelectorAll('input[type="checkbox"][id^="chk-"]');
    checkboxes.forEach(chk => {
        estadoAtualGlobal.checkboxes[chk.id] = chk.checked;
    });

    const payload = {
        action: 'SAVE_LOG',
        id: estadoAtualGlobal.id,
        verificador: localStorage.getItem('verificadorNick'),
        resumo: gerarResumoLog(),
        estado: estadoAtualGlobal,
        nicksSystem: extrairNicksDaListagemMembros(document.getElementById('lista-gratificacoes').value).join('\n')
    };

    enviarLogBackground(payload);
}

function agendarSalvamentoEstado() {
    clearTimeout(timeoutSalvamentoEstado);
    timeoutSalvamentoEstado = setTimeout(salvarEstadoAtual, 350);
}

function gerarResumoLog() {
    const r = estadoAtualGlobal.resultados;
    if (!r) return 'Sem dados';
    let resumo = [];
    if (r.inativos?.length) resumo.push(`${r.inativos.length} Inativos`);
    if (r.graduacao?.length) resumo.push(`${r.graduacao.length} Grad.`);
    if (r.offline?.length) resumo.push(`${r.offline.length} Off.`);
    if (r.perfisIrregulares?.length) resumo.push(`${r.perfisIrregulares.length} Perfil irregular`);
    if (r.removerForum?.length) resumo.push(`${r.removerForum.length} Fórum`);
    if (r.retirarDosGrupos?.outros?.length) resumo.push(`${r.retirarDosGrupos.outros.length} Outras companhias`);
    return resumo.join(', ') || 'Nenhuma pendência';
}

function enviarLogBackground(dados) {
    if (!SHEETS_WEB_APP_URL || SHEETS_WEB_APP_URL.includes('COLE_SUA_URL_AQUI')) return;

    fetch(SHEETS_WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
    }).then(() => console.log('[Log] Estado salvo/atualizado.'))
        .catch(e => console.warn('[Log] Falha ao salvar:', e));
}

function registrarVerificacaoNaPlanilha(inativos, graduacao, offline, perfisIrregulares, removerForum, retirarDosGrupos, textoSystem, erros = []) {

    estadoAtualGlobal = {
        id: crypto.randomUUID(),
        verificador: localStorage.getItem('verificadorNick'),
        timestamp: new Date().toISOString(),
        resultados: {
            inativos: inativos.map(m => ({ ...m, _idx: undefined })),
            graduacao: graduacao.map(m => ({ ...m, _idx: undefined })),
            offline: offline.map(m => ({ ...m, _idx: undefined })),
            perfisIrregulares: perfisIrregulares.map(m => ({ ...m, _idx: undefined })),
            removerForum: removerForum,
            retirarDosGrupos: retirarDosGrupos,
            erros: erros
        },
        checkboxes: {},
        avisosPerfilIrregular: { ...avisosPerfilIrregular }
    };

    salvarEstadoAtual();
}

document.addEventListener('change', (e) => {
    if (e.target.matches('input[type="checkbox"][id^="chk-"]')) {
        const conteudoAba = e.target.closest('.tab-content[id^="content-"]');
        if (conteudoAba) {
            verificarProgressoAba(conteudoAba.id.replace('content-', ''));
        }
        agendarSalvamentoEstado();
    }
});

function registrarAcaoNaPlanilha(categoria, nickMembro, cargoMembro, tipoAcao, marcado, observacoes = '') {
    agendarSalvamentoEstado();
}

let clicksLogo = 0;
let timeoutLogo;

function setupAdminTrigger() {
    const logo = document.getElementById('logo-professores');
    if (logo) {

        const newLogo = logo.cloneNode(true);
        logo.parentNode.replaceChild(newLogo, logo);

        newLogo.addEventListener('click', (e) => {

            newLogo.style.transform = 'scale(0.9)';
            setTimeout(() => newLogo.style.transform = '', 100);

            clicksLogo++;
            if (clicksLogo === 1) {

                timeoutLogo = setTimeout(() => {
                    clicksLogo = 0;
                }, 2000);
            }

            if (clicksLogo >= 5) {
                clearTimeout(timeoutLogo);
                clicksLogo = 0;
                abrirModalLogs();
            }
        });
        console.log('Admin trigger configurado no logo.');
    } else {
        console.warn('Logo não encontrado para trigger Admin.');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAdminTrigger);
} else {
    setupAdminTrigger();
}

async function abrirModalLogs() {

    if (!document.getElementById('modal-logs')) {
        criarModalLogsHTML();
    }

    const modal = document.getElementById('modal-logs');
    const lista = document.getElementById('lista-logs-conteudo');

    modal.classList.remove('hidden');
    lista.innerHTML = Array.from({ length: 4 }, () => `
        <div class="animate-pulse rounded-2xl border border-slate-200/70 dark:border-white/5 bg-white/70 dark:bg-white/[0.025] p-4">
            <div class="flex items-center gap-4">
                <div class="h-12 w-12 rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
                <div class="flex-1 space-y-2">
                    <div class="h-3 w-28 rounded-full bg-slate-200 dark:bg-slate-800"></div>
                    <div class="h-2.5 w-36 rounded-full bg-slate-100 dark:bg-slate-800/70"></div>
                </div>
                <div class="hidden sm:block h-8 w-48 rounded-xl bg-slate-100 dark:bg-slate-800/70"></div>
            </div>
        </div>`).join('');

    try {
        const response = await fetchComTimeout(`${SHEETS_WEB_APP_URL}?action=GET_LOGS`);
        const data = await response.json();

        renderizarListaLogs(data.logs);
    } catch (e) {
        lista.innerHTML = `
            <div class="rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 px-5 py-8 text-center">
                <div class="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-900/40 text-rose-500">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>
                <p class="font-bold text-rose-700 dark:text-rose-300">Não foi possível carregar o histórico</p>
                <p class="mt-1 text-xs text-rose-600/80 dark:text-rose-400/80">${escaparHtmlSeguro(e.message)}</p>
            </div>`;
    }
}

function criarModalLogsHTML() {
    const html = `
    <div id="modal-logs" class="fixed inset-0 z-[60] hidden" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="fixed inset-0 bg-slate-950/85 transition-opacity backdrop-blur-md" onclick="fecharModalLogs()"></div>
        <div class="fixed inset-0 z-10 w-screen overflow-y-auto">
            <div class="flex min-h-full items-end justify-center p-3 text-center sm:items-center sm:p-6">
                <div class="relative flex max-h-[90vh] w-full max-w-5xl transform flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white text-left shadow-[0_30px_100px_-25px_rgba(15,23,42,0.75)] transition-all dark:border-white/10 dark:bg-[#0b0b10]">
                    <div class="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-violet-700 via-purple-700 to-indigo-800 px-5 py-6 sm:px-7">
                        <div class="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-fuchsia-400/20 blur-3xl"></div>
                        <div class="absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-indigo-300/15 blur-3xl"></div>
                        <div class="relative flex items-start justify-between gap-4">
                            <div class="flex min-w-0 items-center gap-4">
                                <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 shadow-lg shadow-violet-950/20 backdrop-blur-sm">
                                    <i class="fa-solid fa-clock-rotate-left text-xl text-white"></i>
                                </div>
                                <div class="min-w-0">
                                    <div class="mb-1 flex flex-wrap items-center gap-2">
                                        <span class="text-[10px] font-black uppercase tracking-[0.2em] text-violet-200">Registros salvos</span>
                                        <span id="contador-logs-visiveis" class="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/90">0 registros</span>
                                    </div>
                                    <h3 class="text-xl font-black leading-tight tracking-tight text-white sm:text-2xl" id="modal-title">
                                        Histórico de Fiscalizações
                                    </h3>
                                    <p class="mt-1 text-xs text-violet-100/80 sm:text-sm">Selecione um registro para restaurar aquela verificação.</p>
                                </div>
                            </div>
                            <button type="button" aria-label="Fechar histórico" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-violet-100 transition-all hover:rotate-90 hover:bg-white/15 hover:text-white" onclick="fecharModalLogs()">
                                <i class="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>
                    </div>

                    <div class="border-b border-slate-200/80 bg-slate-50/80 px-4 py-4 dark:border-white/5 dark:bg-white/[0.025] sm:px-6">
                        <div class="relative">
                            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                                <i class="fa-solid fa-magnifying-glass text-sm text-violet-500"></i>
                            </div>
                            <input type="text" id="busca-logs"
                                class="block w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-20 text-sm leading-5 text-slate-700 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-200 dark:placeholder:text-slate-600"
                                placeholder="Buscar fiscal, data ou pendência..."
                                oninput="filtrarLogs(this.value)">
                            <span class="pointer-events-none absolute inset-y-0 right-4 hidden items-center text-[9px] font-black uppercase tracking-widest text-slate-400 sm:flex">Buscar</span>
                        </div>
                    </div>

                    <div class="min-h-0 flex-1 bg-slate-100/70 p-3 dark:bg-black/20 sm:p-5">
                        <div id="lista-logs-conteudo" class="grid max-h-[58vh] grid-cols-1 gap-2.5 overflow-y-auto pr-1 custom-scrollbar sm:pr-2"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function fecharModalLogs() {
    document.getElementById('modal-logs').classList.add('hidden');
}

let logsCacheGlobal = [];

function renderizarListaLogs(logs) {
    logsCacheGlobal = logs || [];
    atualizarListaVisual(logsCacheGlobal);
}

function filtrarLogs(termo) {
    if (!termo) {
        atualizarListaVisual(logsCacheGlobal);
        return;
    }
    const termoLower = termo.toLowerCase();
    const filtrados = logsCacheGlobal.filter(log =>
        (log.verificador && log.verificador.toLowerCase().includes(termoLower)) ||
        (log.resumo && log.resumo.toLowerCase().includes(termoLower)) ||
        (formatarDataLegivel(log.data).toLowerCase().includes(termoLower))
    );
    atualizarListaVisual(filtrados);
}

function formatarDataLegivel(dataISO) {
    if (!dataISO) return 'Data desconhecida';
    try {
        const data = new Date(dataISO);
        return data.toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch (e) {
        return dataISO;
    }
}

function renderizarEtiquetasResumoHistorico(resumo) {
    const textoResumo = resumo || 'Nenhuma pendência';
    const itens = textoResumo.split(/,\s*/).filter(Boolean);

    return itens.map(item => {
        const itemNormalizado = item.toLowerCase();
        let estilo = 'border-slate-200 bg-slate-100 text-slate-600 dark:border-white/5 dark:bg-white/5 dark:text-slate-300';
        let icone = 'fa-list-check';

        if (itemNormalizado.includes('nenhuma pendência')) {
            estilo = 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300';
            icone = 'fa-circle-check';
        } else if (itemNormalizado.includes('inativo')) {
            estilo = 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300';
            icone = 'fa-user-slash';
        } else if (itemNormalizado.includes('grad')) {
            estilo = 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300';
            icone = 'fa-graduation-cap';
        } else if (itemNormalizado.includes('off')) {
            estilo = 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300';
            icone = 'fa-clock';
        } else if (itemNormalizado.includes('fórum')) {
            estilo = 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300';
            icone = 'fa-comments';
        } else if (itemNormalizado.includes('outras companhias')) {
            estilo = 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300';
            icone = 'fa-people-arrows';
        } else if (itemNormalizado.includes('perfil irregular')) {
            estilo = 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-900/50 dark:bg-fuchsia-950/30 dark:text-fuchsia-300';
            icone = 'fa-user-lock';
        }

        return `<span class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${estilo}">
            <i class="fa-solid ${icone} text-[9px]"></i>${escaparHtmlSeguro(item)}
        </span>`;
    }).join('');
}

function atualizarListaVisual(logs) {
    const container = document.getElementById('lista-logs-conteudo');
    const contador = document.getElementById('contador-logs-visiveis');
    const quantidadeVisivel = logs?.length || 0;
    const quantidadeTotal = logsCacheGlobal.length;

    if (contador) {
        contador.textContent = quantidadeVisivel === quantidadeTotal
            ? `${quantidadeTotal} ${quantidadeTotal === 1 ? 'registro' : 'registros'}`
            : `${quantidadeVisivel} de ${quantidadeTotal}`;
    }

    if (!logs || logs.length === 0) {
        container.innerHTML = `
            <div class="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center dark:border-white/10 dark:bg-white/[0.02]">
                <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/5 dark:text-slate-500">
                    <i class="fa-solid fa-magnifying-glass text-xl"></i>
                </div>
                <p class="font-bold text-slate-700 dark:text-slate-300">Nenhum registro encontrado</p>
                <p class="mt-1 max-w-xs text-xs text-slate-500">Tente buscar por outro fiscal, data ou tipo de pendência.</p>
            </div>`;
        return;
    }

    let html = '';
    logs.forEach(log => {
        const dataFormatada = formatarDataLegivel(log.data);
        const inicial = log.verificador ? log.verificador.charAt(0).toUpperCase() : '?';
        const verificador = log.verificador || 'Desconhecido';
        const verificadorSeguro = escaparHtmlSeguro(verificador);
        const idSeguro = String(log.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        html += `
        <button type="button" onclick="carregarLogDetalhado('${idSeguro}')"
            class="group relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-3.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-500/5 dark:border-white/[0.07] dark:bg-white/[0.025] dark:hover:border-violet-500/40 dark:hover:bg-white/[0.045] sm:p-4">
            <div class="absolute inset-y-3 left-0 w-0.5 rounded-r-full bg-violet-500 opacity-0 transition-opacity group-hover:opacity-100"></div>
            <div class="grid items-center gap-3 sm:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.5fr)_32px] sm:gap-5">
                <div class="flex min-w-0 items-center gap-3.5">
                    <div class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-violet-100 bg-violet-50 shadow-inner dark:border-violet-500/10 dark:bg-violet-500/10">
                        <img src="https://www.habbo.com.br/habbo-imaging/avatarimage?img_format=png&user=${encodeURIComponent(verificador)}&direction=2&head_direction=3&size=M&headonly=1"
                            alt="${verificadorSeguro}"
                            class="h-full w-full translate-y-1 scale-150 object-contain"
                            onerror="this.classList.add('hidden'); this.nextElementSibling.classList.remove('hidden')">
                        <span class="hidden text-sm font-black text-violet-500">${escaparHtmlSeguro(inicial)}</span>
                    </div>
                    <div class="min-w-0">
                        <h4 class="truncate text-sm font-black text-slate-800 dark:text-slate-100">${verificadorSeguro}</h4>
                        <p class="mt-1 flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                            <i class="fa-regular fa-calendar text-[9px]"></i>${escaparHtmlSeguro(dataFormatada)}
                        </p>
                    </div>
                </div>
                <div class="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3 dark:border-white/5 sm:border-0 sm:pt-0">
                    ${renderizarEtiquetasResumoHistorico(log.resumo)}
                </div>
                <div class="hidden h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition-all group-hover:bg-violet-500 group-hover:text-white dark:bg-white/5 dark:text-slate-500 sm:flex">
                    <i class="fa-solid fa-chevron-right text-[10px]"></i>
                </div>
            </div>
        </button>`;
    });
    container.innerHTML = html;
}

async function carregarLogDetalhado(id) {
    const btn = document.activeElement;

    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('hidden');
    if (overlay) overlay.classList.add('flex');

    try {
        const response = await fetchComTimeout(`${SHEETS_WEB_APP_URL}?action=GET_LOG_DETAILS&id=${id}`);
        const data = await response.json();

        if (data.success && data.estado) {

            await new Promise(r => setTimeout(r, 800));

            restaurarEstado(data.estado);
            fecharModalLogs();

            showToast(`Sessão restaurada com sucesso!`, 'success');
            showToast(`Verificador: ${data.estado.verificador}`, 'info');
        } else {
            showToast('Erro ao carregar detalhes do log.', 'error');
        }
    } catch (e) {
        showToast('Erro ao buscar log: ' + e.message, 'error');
    } finally {
        if (overlay) {
            overlay.classList.add('opacity-0');
            setTimeout(() => {
                overlay.classList.remove('flex', 'opacity-0');
                overlay.classList.add('hidden');
            }, 300);
        }
    }
}

function showToast(mensagem, tipo = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const id = 'toast-' + Math.random().toString(36).substr(2, 9);

    let icon = '<i class="fa-solid fa-circle-info"></i>';
    let colors = 'bg-slate-800 border-slate-700 text-white';

    if (tipo === 'success') {
        icon = '<i class="fa-solid fa-circle-check"></i>';
        colors = 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-500/20';
    } else if (tipo === 'error') {
        icon = '<i class="fa-solid fa-circle-xmark"></i>';
        colors = 'bg-rose-600 border-rose-500 text-white shadow-rose-500/20';
    }

    const html = `
    <div id="${id}" class="pointer-events-auto transform transition-all duration-500 translate-x-full opacity-0 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${colors} min-w-[300px] max-w-md">
        <div class="text-xl shrink-0">${icon}</div>
        <div class="text-sm font-medium">${mensagem}</div>
    </div>`;

    container.insertAdjacentHTML('beforeend', html);
    const toastElement = document.getElementById(id);

    requestAnimationFrame(() => {
        toastElement.classList.remove('translate-x-full', 'opacity-0');
    });

    setTimeout(() => {
        toastElement.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toastElement.remove(), 500);
    }, 4000);
}

function restaurarEstado(estado) {
    estadoAtualGlobal = estado;

    exibirResultados(
        estado.resultados.inativos || [],
        estado.resultados.offline || [],
        (estado.resultados.perfisIrregulares || []).map(m => ({
            ...m,
            ...obterStatusAvisoPerfilIrregular(m.nick)
        })),
        estado.resultados.graduacao || [],
        estado.resultados.removerForum || [],
        estado.resultados.retirarDosGrupos || { retirar: [], subgrupos: [], outros: [], sets: {} },
        estado.resultados.erros || []
    );

    setTimeout(() => {
        if (estado.checkboxes) {
            Object.entries(estado.checkboxes).forEach(([id, checked]) => {
                const el = document.getElementById(id);
                if (el) {
                    el.checked = checked;

                }
            });
        }
        Object.keys(CONFIG_PROGRESSO_ABAS).forEach(verificarProgressoAba);
    }, 500);
}

const TEMPLATE_MP_EXPULSAO = `[font=Poppins]<div style="border:1.5rem solid #821F88;border-radius:8px;font-family:Poppins;">[/font][table][tr][td][center][img]https://i.imgur.com/hU7bn8R.gif[/img][/center]

[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][center][img]https://3.bp.blogspot.com/-xgw9Ywvq-kQ/V1ZwrYykphI/AAAAAAAAp0Q/SB7rlT08K3Mqd_vx06J9yXI-GPPuoJwEwCPcB/s1600/ES54A.gif[/img][/center][size=20][font=Poppins][color=white][b]CARTA DE EXPULSÃO[/b][/color][/font][/size][/td][/tr][/table]
<div style="padding:1.5%;border:1px solid #bdbdbd;border-radius:8px;">[justify]Saudações, [b]{USERNAME}[/b].

Informa-se que você foi[b] expulso(a) de nossa companhia e penalizado com cem (100) medalhas negativas[/b] pelo(s) seguinte(s) motivo(s):

[b]{MOTIVO}[/b]

[color=#821F88][b]COMENTÁRIOS:[/b][/color] {CONSIDERACOES}
[color=#821F88][b]ANEXOS:[/b][/color] {LINK_PROVA}

Leia as documentações que regem a companhia [url=https://sites.google.com/view/nexusprof/documenta%C3%A7%C3%B5es?authuser=3]clicando aqui[/url]. Caso queira recorrer da punição recebida, procure a Liderança apresentando argumentos factuais e plausíveis. Sinta-se à vontade para refazer o teste de admissão para a companhia ou ingressar em uma outra.[/justify]</div>[/td][/tr][/table]</div>
[font=Poppins][center]Atentamente,
[img]https://i.imgur.com/1kZvQHs.png[/img][/center][/font]`;

const TEMPLATE_MP_REBAIXAMENTO = `[font=Poppins]<div style="border:1.5rem solid #821F88;border-radius:8px;font-family:Poppins;">[/font][table][tr][td][center][img]https://i.imgur.com/hU7bn8R.gif[/img][/center]

[table style="color: rgb(0, 0, 0);border-radius:10px; overflow:hidden; border-color: rgb(0, 0, 0);" bgcolor="#821F88" border="1"][tr][td][center][img]https://3.bp.blogspot.com/-xgw9Ywvq-kQ/V1ZwrYykphI/AAAAAAAAp0Q/SB7rlT08K3Mqd_vx06J9yXI-GPPuoJwEwCPcB/s1600/ES54A.gif[/img][/center][size=20][font=Poppins][color=white][b]CARTA DE REBAIXAMENTO[/b][/color][/font][/size][/td][/tr][/table]
<div style="padding:1.5%;border:1px solid #bdbdbd;border-radius:8px;">[justify]Saudações, [b]{USERNAME}[/b].

Informa-se que você foi [b]rebaixado(a) na companhia e penalizado com cinquenta (50) medalhas negativas[/b] pelo(s) seguinte(s) motivo(s):

[b]{MOTIVO}[/b]

[color=#821F88][b]COMENTÁRIOS:[/b][/color] {CONSIDERACOES}
[color=#821F88][b]ANEXOS:[/b][/color] {LINK_PROVA}

Leia as documentações que regem a companhia [url=https://sites.google.com/view/nexusprof/documenta%C3%A7%C3%B5es?authuser=3]clicando aqui[/url] e procure manter-se atento para evitar mais punições. Caso queira recorrer da punição recebida, procure a Liderança apresentando argumentos factuais e plausíveis.[/justify]</div>[/td][/tr][/table]</div>
[font=Poppins][center]Atentamente,
[img]https://i.imgur.com/1kZvQHs.png[/img][/center][/font]`;

const TEMPLATE_MP_AVISO_PERFIL = `[table style="width: 100%; max-width: 900px; margin: 0 auto; border: none!important; border-radius: 15px; overflow: hidden; box-shadow: 0 0 0 4px #821F88, 0 3px 8px rgba(34, 5, 37, 0.90);" bgcolor="#57125B"][tr style="border: none!important"][td style="border: none!important; padding: 7px"][img]https://i.imgur.com/hfxVWaJ.gif[/img]

[table style="width: auto; border: none!important; border-radius: 15px; overflow: hidden; position: relative; top: -23px; margin: 0 auto -10px auto; z-index: 1; box-shadow: 0 4px 12px rgba(130, 31, 136, 0.35); font-family: 'Syne', sans-serif; background: linear-gradient(135deg, #A22CA9 0%, #821F88 100%);"][tr style="border: none!important"][td style="border: none!important; width: 42px; padding: 6px 4px 6px 12px; vertical-align: middle; text-align: center; line-height: 1; position: relative; left: 4px; z-index: 1; color: #FFFFFF; font-size: 21px; overflow: visible; opacity: 0.30;"]<i class="fas fa-exclamation-triangle"></i>[/td][td style="border: none!important; padding: 12px 18px 12px 6px; vertical-align: middle; white-space: nowrap; color: #FFFFFF; font-size: 15px; letter-spacing: 0.7px; position: relative; left: -13px; z-index: 2;"][b]NOTIFICAÇÃO DE IRREGULARIDADE[/b][/td][/tr][/table][table style="width: 100%; margin: -45px auto 0 auto; border: none!important; border-radius: 15px; overflow: hidden; position: relative; box-shadow: inset 0 0 0 1.7px #F0F0F0, inset 0 0 0 6px #DACBDB;" bgcolor="#F8F4F8"][tr style="border: none!important"][td style="border: none!important; padding: 0px; position: relative; overflow: hidden"][table style="width: auto; height: auto; border: none!important; position: absolute; top: -200px; right: -8px; z-index: 1; overflow: visible; opacity: 0.05; display: inline-block; transform: rotate(26deg);"][tr style="border: none!important"][td style="border: none!important; padding: 0; line-height: 1; color: #821F88; font-size: 280px"]
<i class="fas fa-exclamation-triangle"></i>[/td][/tr][/table]

[table style="width: 100%; border: none!important; border-collapse: collapse; position: relative; z-index: 2; background: transparent;"][tr style="border: none!important"][td style="border: none!important; padding: 20px 26px; color: #302331; font-size: 13.5px; line-height: 1.65em; text-align: justify; font-family: 'Poppins', sans-serif;"][center][size=16]Saudações, [color=#821F88][b]{USERNAME}[/b][/color][/size]
[table style="width: 70px; border: none!important; border-radius: 100px; overflow: hidden; margin: 9px auto 18px auto;" bgcolor="#A22CA9"][tr style="border: none!important"][td style="border: none!important; height: 4px; padding: 0; font-size: 0"][/td][/tr][/table][/center]

Venho, por meio desta mensagem privada, notificá-lo(a) acerca de uma irregularidade identificada em seu perfil no Habbo Hotel: [color=#821F88][b]visibilidade do perfil desativada[/b][/color].

Conforme previsto no Código Penal dos Professores, os membros da companhia devem regularizar a situação no prazo de [b]vinte e quatro (24) horas[/b] após o recebimento desta notificação.
[center][table style="width: auto; border: none!important; border-radius: 20px; overflow: hidden; position: relative; margin: 35px auto -14px auto; z-index: 2; background: linear-gradient(135deg, #A22CA9 0%, #821F88 100%); font-family: 'Poppins', sans-serif;"][tr style="border: none!important"][td style="border: none!important; padding: 7px 18px; vertical-align: middle; color: #FFFFFF; font-size: 10.5px; letter-spacing: 1px; white-space: nowrap;"]<i class="fas fa-gavel"></i> [b]FUNDAMENTAÇÃO[/b][/td][/tr][/table][/center]
[table style="width: 100%; border-radius: 16px!important; border: 1.5px dashed #A22CA9!important; border-collapse: separate!important; border-spacing: 0!important; overflow: hidden; margin: 0 0 20px 0; position: relative; z-index: 1; background: linear-gradient(160deg, #FBF8FB 0%, #EADFEB 100%);"][tr style="border: none!important"][td style="border: none!important; padding: 28px 22px 18px 22px; text-align: justify;"][size=13][color=#821F88][b]SEÇÃO X - INSUFICIÊNCIA PARA O CARGO[/b][/color][/size]

[size=11][color=#554156]Art. 1º - O Código Penal dos Professores define o crime de insuficiência para o cargo nos seguintes termos:

III - Pela permanência em modo offline ou com a visibilidade do perfil desativada no Habbo Hotel após vinte e quatro (24) horas da notificação para regularização.

§ 2º - Constatada qualquer das irregularidades previstas no inciso III, o membro deverá ser notificado por Mensagem Privada para regularizá-la no prazo de vinte e quatro (24) horas. Persistindo a irregularidade, será expulso, caso seja professor, ou rebaixado, caso seja coordenador+, repetindo-se a punição a cada vinte e quatro (24) horas até a regularização ou expulsão da companhia.[/size][/color][/td][/tr][/table]
Dessa forma, você dispõe de [b]vinte e quatro (24) horas[/b], contadas a partir desta notificação, para regularizar a irregularidade indicada. Caso a situação permaneça após o término do prazo, será aplicada a punição correspondente ao seu cargo, nos termos da normativa supracitada.
[table style="width: auto; border: none!important; border-radius: 12px; overflow: hidden; margin: 20px auto 8px auto; position: relative; z-index: 3; opacity: 1; font-family: 'Poppins', sans-serif;" bgcolor="#EADFEB"][tr style="border: none!important"][td style="border: none!important; width: 44px; padding: 12px 4px 12px 14px; vertical-align: middle; text-align: center; color: #821F88; font-size: 17px"]<i class="fas fa-info-circle"></i>[/td][td style="border: none!important; padding: 12px 16px 12px 8px; vertical-align: middle; color: #554156; font-size: 12px; line-height: 1.5em"]Em caso de dúvidas ou objeções, permaneço à disposição.[/td][/tr][/table]
[center][table style="width: auto; border: 1.5px dashed #D8B6DA!important; border-radius: 100px; overflow: hidden; margin: 10px auto 5px auto; background: linear-gradient(135deg, #A22CA9 0%, #821F88 100%);"][tr style="border: none!important"][td style="border: none!important; width: 34px; padding: 10px 4px 10px 16px; vertical-align: middle; text-align: center; color: #FFFFFF; font-size: 15px"]<i class="fas fa-clock-o"></i>[/td][td style="border: none!important; padding: 10px 22px 10px 6px; vertical-align: middle; white-space: nowrap; color: #FFFFFF; font-size: 12px; letter-spacing: 0.4px"][b]PRAZO PARA REGULARIZAÇÃO: 24 HORAS[/b][/td][/tr][/table][/center][/td][/tr][/table][/td][/tr][/table][table style="font-family: 'Poppins', sans-serif; width: 100%; border: none!important; margin: 0; border-collapse: collapse;" bgcolor="#57125B"][tr style="border: none!important"][td style="border: none!important; padding: 0 0 10px 0; text-align: center; color: #FFFFFF; font-size: 11px; line-height: 1.5em"]
<i class="far fa-copyright"></i> Todos os direitos reservados à [b]Companhia dos Professores[/b]
[color=#D8B6DA]<i class="fas fa-palette"></i> Design desenvolvido por [b].Brendon[/b][/color]
[/td][/tr][/table][/td][/tr][/table]`;

const HIERARQUIA = ['Líder', 'Vice-líder', 'Conselheiro(a) da Contabilidade', 'Conselheiro(a) das Finanças', 'Conselheiro(a) da Administração', 'Conselheiro(a) da Documentação', 'Conselheiro(a) da Segurança', 'Conselheiro(a) da Atualização²', 'Conselheiro(a) da Atualização¹', 'Estagiário(a)', 'Graduador(a)', 'Coordenador(a)', 'Professor(a)'];

const botaoVerificar = document.getElementById('botaoVerificar');
const listaGratificacoes = document.getElementById('lista-gratificacoes');
const listaForum = document.getElementById('lista-forum');
const carregador = document.getElementById('carregador');
const containerResultados = document.getElementById('container-resultados');
const statusProcesso = document.getElementById('status-processo');

const sobreposicaoModal = document.getElementById('sobreposicao-modal');
const fundoModal = document.getElementById('fundo-modal');
const painelModal = document.getElementById('painel-modal');
const conteudoModal = document.getElementById('conteudo-modal');
const tituloModal = document.getElementById('titulo-modal');

const modalMP = document.getElementById('modal-mp');
const fundoModalMP = document.getElementById('fundo-modal-mp');
const painelModalMP = document.getElementById('painel-modal-mp');
const mpDestinatario = document.getElementById('mp-destinatario');
const mpTipo = document.getElementById('mp-tipo');
const mpMotivo = document.getElementById('mp-motivo');
const mpConsideracoes = document.getElementById('mp-consideracoes');
const mpProva = document.getElementById('mp-prova');
const botaoEnviarMP = document.getElementById('botao-enviar-mp');

const modalConfirmacao = document.getElementById('modal-confirmacao');

let membrosInativos = [];
let membrosOffline = [];
let membrosPerfilIrregular = [];
let graduacoesPendentes = [];
let membrosRemoverForum = [];
let topicoRedirecionamento = '';
let checkboxMPAtual = '';

document.documentElement.classList.add('dark');

function extrairNicksDaListagemMembros(texto) {
    if (!texto) return [];
    const lines = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const nicks = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].replace(/[\u200B-\u200D\uFEFF]/g, '');

        const colsPipe = line.split('|').map(col => col.trim());
        if (colsPipe.length >= 5) {
            const primeiraColuna = colsPipe[0].match(/^\d+\.\s*(.+)$/);
            const possuiCamposEsperados =
                /^Medalhas Efetivas\s*:/i.test(colsPipe[2]) &&
                /^Medalhas Tempor[aá]rias\s*:/i.test(colsPipe[3]) &&
                /^Sal[aá]rio\s*:/i.test(colsPipe[4]);

            if (primeiraColuna && possuiCamposEsperados) {
                const nick = primeiraColuna[1].trim();
                if (nick) nicks.push(nick);
                continue;
            }
        }

        const cols = line.split('\t');
        if (cols.length >= 3) {
            const numeracao = cols[0].trim();
            const nick = cols[1] ? cols[1].replace(/[\u200B-\u200D\uFEFF]/g, '').trim() : '';

            if (/^-?\d+$/.test(numeracao) && nick && nick.length >= 1) {
                nicks.push(nick);
            }
        }
    }
    return Array.from(new Set(nicks));
}

function normalizarNick(nick) {
    return String(nick || '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .normalize('NFC')
        .trim()
        .toLowerCase();
}

function extrairNicksDoSubforum(texto) {
    if (!texto) return [];
    const nicks = new Map();

    texto.split(/\r?\n/).forEach(linha => {
        linha = linha.trim();
        if (!linha) return;

        let nick = '';
        if (linha.includes('Enviar uma mensagem privada')) {
            const partes = linha.split('\t');
            if (partes.length >= 2 && partes[1].trim()) {
                nick = partes[1].trim();
            } else {
                const match = linha.match(/^\d+[\s\t]+([^\t\n]+?)(?:[\s\t]+Enviar uma mensagem privada|\s*$)/i);
                nick = match && match[1] ? match[1].trim() : '';
            }
        } else if (linha.includes('\t')) {
            const partes = linha.split('\t');
            if (/^\d+$/.test(partes[0].trim()) && partes[1]) {
                nick = partes[1].trim();
            } else if (partes[0]) {
                nick = partes[0].trim();
            }
        } else {
            const matchNum = linha.match(/^(?:\d+[\.\)\s-]+)?(.+)$/);
            nick = matchNum && matchNum[1] ? matchNum[1].trim() : linha;
        }

        const nickNormalizado = normalizarNick(nick);
        const ehIgnorado = typeof CONTAS_FORUM_IGNORADAS !== 'undefined'
            ? CONTAS_FORUM_IGNORADAS.has(nickNormalizado)
            : false;

        if (nickNormalizado.length >= 2 && !ehIgnorado && !nicks.has(nickNormalizado)) {
            nicks.set(nickNormalizado, nick);
        }
    });

    return Array.from(nicks.values());
}

const CONTAS_FORUM_IGNORADAS = new Set([
    'admin', 'professores', 'graduadores', 'coordenadores dos professores',
    'com. de desenv. cultural', 'dep. ap. intendência',
    'serv. proteção prof', '[prof] liderança'
].map(normalizarNick));

function atualizarEstadoDasFontes() {
    const fontes = [
        { id: 'lista-gratificacoes', statusId: 'status-gratificacoes', extrair: extrairNicksDaListagemMembros, singular: 'policial', plural: 'policiais' },
        { id: 'lista-forum-professores', statusId: 'status-forum-professores', extrair: extrairNicksDoSubforum, singular: 'membro', plural: 'membros' },
        { id: 'lista-forum-coordenadores', statusId: 'status-forum-coordenadores', extrair: extrairNicksDoSubforum, singular: 'membro', plural: 'membros' },
        { id: 'lista-forum-graduadores', statusId: 'status-forum-graduadores', extrair: extrairNicksDoSubforum, singular: 'membro', plural: 'membros' }
    ];

    let fontesValidas = 0;
    fontes.forEach(fonte => {
        const campo = document.getElementById(fonte.id);
        const status = document.getElementById(fonte.statusId);
        if (!campo || !status) return;

        const quantidade = fonte.extrair(campo.value).length;
        const preenchido = campo.value.trim().length > 0;
        const valido = quantidade > 0;
        if (valido) fontesValidas++;

        campo.classList.toggle('is-valid', valido);
        campo.classList.toggle('is-invalid', preenchido && !valido);
        status.className = `source-status ${valido ? 'is-ready' : preenchido ? 'has-error' : ''}`;
        status.innerHTML = valido
            ? `<i class="fa-solid fa-circle-check"></i> ${quantidade} ${quantidade === 1 ? fonte.singular : fonte.plural} reconhecido${quantidade === 1 ? '' : 's'}`
            : preenchido
                ? '<i class="fa-solid fa-triangle-exclamation"></i> Formato não reconhecido'
                : '<i class="fa-regular fa-circle"></i> Aguardando dados';
    });

    const progresso = document.getElementById('progresso-fontes');
    if (progresso) progresso.textContent = `${fontesValidas}/4 fontes prontas`;
}

['lista-gratificacoes', 'lista-forum-professores', 'lista-forum-coordenadores', 'lista-forum-graduadores']
    .forEach(id => document.getElementById(id)?.addEventListener('input', atualizarEstadoDasFontes));

atualizarEstadoDasFontes();

window.atualizarEstadoDasFontes = atualizarEstadoDasFontes;
window.extrairNicksDoSubforum = extrairNicksDoSubforum;
window.extrairNicksDaListagemMembros = extrairNicksDaListagemMembros;

function converterDataPlanilha(dataStr) {
    if (!dataStr) return null;
    const meses = { 'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5, 'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11 };
    try {
        const strLimpa = dataStr.replace('.', '').toLowerCase().trim();
        const partes = strLimpa.split(' ');
        if (partes.length >= 3) {
            const mes = meses[partes[1].substring(0, 3)];
            const dia = parseInt(partes[0], 10);
            const ano = parseInt(partes[2], 10);
            if (mes === undefined || !Number.isInteger(dia) || !Number.isInteger(ano)) return null;
            const data = new Date(ano, mes, dia);
            return Number.isNaN(data.getTime()) ? null : data;
        }
    } catch (e) { }
    return null;
}

function obterDataMedalha() {
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const d = new Date();
    return `${d.getDate().toString().padStart(2, '0')} ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

function ativarCooldownGlobal() {
    const botoes = document.querySelectorAll('#conteudo-modal button:not(:disabled)');
    botoes.forEach(btn => {
        btn.disabled = true;
        btn.dataset.original = btn.innerHTML;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        btn.innerHTML = '<i class="fa-regular fa-clock fa-spin"></i> 5s';
    });

    let contagem = 5;
    const intervalo = setInterval(() => {
        contagem--;
        if (contagem <= 0) {
            clearInterval(intervalo);
            botoes.forEach(btn => {
                btn.innerHTML = btn.dataset.original;
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            });
        } else {
            botoes.forEach(btn => btn.innerHTML = `<i class="fa-regular fa-clock fa-spin"></i> ${contagem}s`);
        }
    }, 1000);
}

botaoVerificar.addEventListener('click', () => {
    const textoSystem = document.getElementById('lista-gratificacoes').value;
    const textoForumProfessores = document.getElementById('lista-forum-professores').value;
    const textoForumCoordenadores = document.getElementById('lista-forum-coordenadores').value;
    const textoForumGraduadores = document.getElementById('lista-forum-graduadores').value;

    if (!textoSystem.trim()) return showToast('Por favor, cole a lista do System primeiro.', 'error');
    if (extrairNicksDaListagemMembros(textoSystem).length === 0) {
        return showToast('Nenhum policial foi reconhecido na lista do System. Copie novamente pelo botão da listagem.', 'error');
    }
    if (!textoForumProfessores.trim() || !textoForumCoordenadores.trim() || !textoForumGraduadores.trim()) {
        if (typeof ParserGruposForum !== 'undefined' && typeof ParserGruposForum.obterPromessaSincronizacao === 'function') {
            const promessa = ParserGruposForum.obterPromessaSincronizacao();
            if (promessa) {
                showToast('Aguarde um instante: finalizando sincronização dos subfóruns...', 'info');
                botaoVerificar.disabled = true;
                promessa.then(() => {
                    botaoVerificar.disabled = false;
                    const prof = document.getElementById('lista-forum-professores')?.value;
                    const coord = document.getElementById('lista-forum-coordenadores')?.value;
                    const grad = document.getElementById('lista-forum-graduadores')?.value;
                    if (prof?.trim() && coord?.trim() && grad?.trim()) {
                        abrirModalVerificador();
                    } else {
                        if (typeof ParserGruposForum.alternarContainerManual === 'function') {
                            ParserGruposForum.alternarContainerManual(true);
                        }
                        showToast('Não foi possível sincronizar todos os subfóruns. Cole as listas manualmente nos campos abaixo.', 'error');
                    }
                }).catch(() => {
                    botaoVerificar.disabled = false;
                    if (typeof ParserGruposForum.alternarContainerManual === 'function') {
                        ParserGruposForum.alternarContainerManual(true);
                    }
                    showToast('Falha na sincronização dos grupos. Cole as listas manualmente nos campos abaixo.', 'error');
                });
                return;
            }
        }

        if (typeof ParserGruposForum !== 'undefined' && typeof ParserGruposForum.alternarContainerManual === 'function') {
            ParserGruposForum.alternarContainerManual(true);
        }
        return showToast('Por favor, cole as listas dos 3 subfóruns nos campos abertos abaixo.', 'error');
    }

    abrirModalVerificador();
});

function abrirModalAvisoInicial() {
    const modal = document.getElementById('modal-aviso-inicial');
    const fundo = document.getElementById('fundo-aviso-inicial');
    const painel = document.getElementById('painel-aviso-inicial');

    modal.classList.remove('hidden');

    setTimeout(() => {
        fundo.classList.remove('opacity-0');
        painel.classList.remove('scale-95', 'opacity-0');
        painel.classList.add('scale-100', 'opacity-100');
    }, 10);
}

window.fecharModalAvisoInicial = function () {
    const modal = document.getElementById('modal-aviso-inicial');
    const fundo = document.getElementById('fundo-aviso-inicial');
    const painel = document.getElementById('painel-aviso-inicial');

    fundo.classList.add('opacity-0');
    painel.classList.remove('scale-100', 'opacity-100');
    painel.classList.add('scale-95', 'opacity-0');

    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);

};

window.addEventListener('load', () => {

});

function abrirModalVerificador() {
    const modal = document.getElementById('modal-verificador');
    const fundo = document.getElementById('fundo-modal-verificador');
    const painel = document.getElementById('painel-modal-verificador');
    const input = document.getElementById('input-verificador-nick');

    input.value = localStorage.getItem('verificadorNick') || '';

    modal.classList.remove('hidden');
    setTimeout(() => {
        fundo.classList.remove('opacity-0');
        painel.classList.remove('scale-95', 'opacity-0');
        painel.classList.add('scale-100', 'opacity-100');
        input.focus();
    }, 10);

    input.onkeydown = (e) => {
        if (e.key === 'Enter') {
            confirmarVerificador();
        }
    };
}

window.fecharModalVerificador = function () {
    const modal = document.getElementById('modal-verificador');
    const fundo = document.getElementById('fundo-modal-verificador');
    const painel = document.getElementById('painel-modal-verificador');

    fundo.classList.add('opacity-0');
    painel.classList.remove('scale-100', 'opacity-100');
    painel.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
};

window.confirmarVerificador = function () {
    const input = document.getElementById('input-verificador-nick');
    const nick = input.value.trim();

    if (!nick) {
        showToast('Por favor, digite seu nickname para continuar.', 'error');
        input.focus();
        return;
    }

    verificadorAtual = nick;
    localStorage.setItem('verificadorNick', nick);

    const modoEscolhido = m_modoVerificacao;

    fecharModalVerificador();

    setTimeout(() => {
        iniciarVerificacao(modoEscolhido);
    }, 350);
};

async function iniciarVerificacao(modo) {
    const prioridadeDireto = modo === 'direto' || modo === 'individual';
    const textoSystem = document.getElementById('lista-gratificacoes').value;
    const textoForumProfessores = document.getElementById('lista-forum-professores').value;
    const textoForumCoordenadores = document.getElementById('lista-forum-coordenadores').value;
    const textoForumGraduadores = document.getElementById('lista-forum-graduadores').value;

    const nicksPorSubforum = {
        professores: new Set(extrairNicksDoSubforum(textoForumProfessores).map(normalizarNick)),
        coordenadores: new Set(extrairNicksDoSubforum(textoForumCoordenadores).map(normalizarNick)),
        graduadores: new Set(extrairNicksDoSubforum(textoForumGraduadores).map(normalizarNick))
    };

    const obterSubforunsDoMembro = (nick) => {
        const nickLower = normalizarNick(nick);
        const subforuns = [];
        if (nicksPorSubforum.professores.has(nickLower)) {
            subforuns.push('professores');
        }
        if (nicksPorSubforum.coordenadores.has(nickLower)) {
            subforuns.push('coordenadores');
        }
        if (nicksPorSubforum.graduadores.has(nickLower)) {
            subforuns.push('graduadores');
        }
        return subforuns;
    };

    alternarCarregamento(true);

    const nicksAtivos = new Set(extrairNicksDaListagemMembros(textoSystem).map(normalizarNick));

    try {

        const urlSheets = `https://sheets.googleapis.com/v4/spreadsheets/${ID_PLANILHA}/values/${encodeURIComponent(INTERVALO_DADOS)}?key=${CHAVE_API}`;
        statusProcesso.innerText = 'Carregando listagem oficial...';
        const resSheets = await fetchComTimeout(urlSheets);

        if (!resSheets.ok) {
            const errorData = await resSheets.json();
            throw new Error(errorData.error ? errorData.error.message : 'Erro ao acessar planilha');
        }

        const dataSheets = await resSheets.json();
        const linhas = dataSheets.values || [];
        const membrosParaVerificar = [];
        const inativosFinal = [];
        const graduacaoFinal = [];

        const mapaMembrosOficiais = new Map();

        linhas.forEach(linha => {
            const nick = linha[1] ? linha[1].trim() : '';
            const cargo = linha[0] ? linha[0].trim() : '';

            if (!nick) return;
            if (cargo.toLowerCase().includes('consultor') || cargo.toLowerCase().includes('honrosa')) return;

            const estaLicenciado = (linha[7] && linha[7].trim().length > 0);
            const nickNormalizado = normalizarNick(nick);

            mapaMembrosOficiais.set(nickNormalizado, {
                nick,
                cargo,
                cargoLower: cargo.toLowerCase(),
                estaLicenciado
            });

            const subforunsDoMembro = obterSubforunsDoMembro(nick);
            const estaNoForum = subforunsDoMembro.length > 0;

            if (nicksAtivos.has(nickNormalizado)) {
                membrosParaVerificar.push({ nick, cargo, estaLicenciado, estaNoForum, subforunsDoMembro });

                const graduacaoPendente = (linha[4] === 'TRUE' || linha[4] === true);
                if (graduacaoPendente && !estaLicenciado) {
                    const ehProfessor = cargo.toLowerCase().includes('professor') && !cargo.toLowerCase().includes('geral');
                    const dataReferencia = ehProfessor ? converterDataPlanilha(linha[2]) : converterDataPlanilha(linha[3]);

                    if (dataReferencia) {
                        const diferencaTempo = Date.now() - dataReferencia.getTime();
                        if (diferencaTempo < 0) return;
                        const diasDiferenca = Math.floor(diferencaTempo / (1000 * 60 * 60 * 24));

                        if (diasDiferenca > 7) {
                            graduacaoFinal.push({
                                nick, cargo, dias: diasDiferenca,
                                diasAtraso: Math.max(0, diasDiferenca - 7),
                                tipo: ehProfessor ? 'expulsao' : 'rebaixamento',
                                estaNoForum,
                                subforunsDoMembro
                            });
                        }
                    }
                }
            } else {

                inativosFinal.push({ nick, cargo, status: 'Sem registro no System', estaNoForum, subforunsDoMembro });
            }
        });

        const dadosSubforuns = {
            professores: textoForumProfessores,
            coordenadores: textoForumCoordenadores,
            graduadores: textoForumGraduadores
        };
        const removerDoForum = extrairNicksExtrasForum(dadosSubforuns, mapaMembrosOficiais);

        const retirarDosGrupos = await verificarMembrosGruposHabbo(mapaMembrosOficiais, nicksAtivos, prioridadeDireto);

        const resultadoOffline = await verificarAtividadeHabbo(
            membrosParaVerificar,
            prioridadeDireto,
            retirarDosGrupos.sets,
            modo === 'individual'
        );
        const offline = resultadoOffline.offline;
        const perfisIrregulares = resultadoOffline.perfisIrregulares;
        const errosVerificacao = resultadoOffline.erros;

        const enriquecerComDadosHabbo = (lista) => {
            lista.forEach(m => {
                m.subgruposHabbo = [];
                const nickLower = m.nick.toLowerCase();
                if (retirarDosGrupos.sets.spp.has(nickLower)) m.subgruposHabbo.push('SPP');
                if (retirarDosGrupos.sets.dep.has(nickLower)) m.subgruposHabbo.push('Dep. Aplicação');
                if (retirarDosGrupos.sets.cdc.has(nickLower)) m.subgruposHabbo.push('CDC');

                m.noProfessores = retirarDosGrupos.sets.prof.has(nickLower);
                m.noGraduadores = retirarDosGrupos.sets.grad.has(nickLower);
                m.noGrupo = m.noProfessores || m.noGraduadores;

                m.isAdminNoGrupo = retirarDosGrupos.sets.admins.has(nickLower);
            });
        };
        enriquecerComDadosHabbo(inativosFinal);
        enriquecerComDadosHabbo(graduacaoFinal);
        enriquecerComDadosHabbo(offline);
        enriquecerComDadosHabbo(perfisIrregulares);

        alternarCarregamento(false);
        exibirResultados(inativosFinal, offline, perfisIrregulares, graduacaoFinal, removerDoForum, retirarDosGrupos, errosVerificacao);

        registrarVerificacaoNaPlanilha(inativosFinal, graduacaoFinal, offline, perfisIrregulares, removerDoForum, retirarDosGrupos, textoSystem, errosVerificacao);

    } catch (erro) {
        alternarCarregamento(false);
        showToast('Erro na verificação: ' + erro.message, 'error');
    }
}

window.iniciarVerificacao = iniciarVerificacao;

function extrairNicksExtrasForum(dadosSubforuns, mapaMembrosOficiais) {

    const nickMap = new Map();

    const obterNivelCargo = (cargo) => {
        if (!cargo) return 0;
        const c = cargo.toLowerCase();
        if (c.includes('líder') || c.includes('lider') || c.includes('vice')) return 7;
        if (c.includes('conselheiro')) return 6;
        if (c.includes('estagiári')) return 5;
        if (c.includes('graduador')) return 4;
        if (c.includes('coordenador')) return 3;
        if (c.includes('professor')) return 2;
        return 0;
    };

    const processarSubforum = (textoForum, nomeSubforum) => {
        if (!textoForum) return;

        extrairNicksDoSubforum(textoForum).forEach(nick => {
                    if (CONTAS_FORUM_IGNORADAS.has(normalizarNick(nick))) return;

                    const nickLower = normalizarNick(nick);
                    const dadosOficiais = mapaMembrosOficiais.get(nickLower);

                    let temPermissao = false;

                    if (dadosOficiais) {
                        const nivel = obterNivelCargo(dadosOficiais.cargo);

                        if (nomeSubforum === 'professores') {
                            temPermissao = nivel >= 2;
                        } else if (nomeSubforum === 'coordenadores') {

                            temPermissao = (nivel === 3) || (nivel >= 5);
                        } else if (nomeSubforum === 'graduadores') {
                            temPermissao = (nivel === 4) || (nivel >= 7);
                        }
                    }

                    if (temPermissao) return;

                    if (!nickMap.has(nickLower)) {
                        nickMap.set(nickLower, {
                            nick: nick,
                            subforuns: new Set(),
                            cargo: dadosOficiais ? dadosOficiais.cargo : 'Não consta na listagem'
                        });
                    }
                    nickMap.get(nickLower).subforuns.add(nomeSubforum);
        });
    };

    processarSubforum(dadosSubforuns.professores, 'professores');
    processarSubforum(dadosSubforuns.coordenadores, 'coordenadores');
    processarSubforum(dadosSubforuns.graduadores, 'graduadores');

    const extras = [];
    nickMap.forEach((dados, nickLower) => {
        const subforunsArray = Array.from(dados.subforuns);
        extras.push({
            nick: dados.nick,
            subforuns: subforunsArray,
            status: 'Não consta na listagem dos professores'
        });
    });

    return extras;
}

async function buscarMembrosGrupoHabbo(groupId, prioridadeDireto = false) {
    const api = `https://www.habbo.com.br/api/public/groups/${groupId}/members`;
    try {
        const response = await fetchWithProxy(api, {}, prioridadeDireto);
        const dados = await response.json();
        if (!Array.isArray(dados)) throw new Error('Resposta inesperada da API de grupos');
        return dados;
    } catch (e) {
        console.warn('[Grupos] Erro crítico ao buscar membros do grupo', groupId, e);
        return [];
    }
}

async function verificarMembrosGruposHabbo(mapaMembrosOficiais, nicksNoSystem, prioridadeDireto = false) {

    const contasEspeciais = ['professores', 'graduadores', '-professores-'];
    const contasImunesHardcoded = ['rccemblemas', 'arquitetocdc'];

    try {

        const promises = [
            buscarMembrosGrupoHabbo(ID_GRUPO_HABBO, prioridadeDireto),
            buscarMembrosGrupoHabbo(ID_GRUPO_GRADUADORES, prioridadeDireto),
            buscarMembrosGrupoHabbo(ID_GRUPO_CORREGEDORIA, prioridadeDireto),
            buscarMembrosGrupoHabbo(ID_GRUPO_GATE, prioridadeDireto),
            buscarMembrosGrupoHabbo(ID_GRUPO_GSS, prioridadeDireto),
            buscarMembrosGrupoHabbo(ID_GRUPO_SPP, prioridadeDireto),
            buscarMembrosGrupoHabbo(ID_GRUPO_DEP_APLICACAO, prioridadeDireto),
            buscarMembrosGrupoHabbo(ID_GRUPO_CDC, prioridadeDireto),
            ...GRUPOS_OUTRAS_COMPANHIAS.map(grupo =>
                buscarMembrosGrupoHabbo(grupo.id, prioridadeDireto)
            )
        ];

        const [
            membrosProf, membrosGrad,
            membrosCorregedoria, membrosGate, membrosGss,
            membrosSpp, membrosDep, membrosCdc,
            ...membrosOutrasCompanhias
        ] = await Promise.all(promises);
        const detalhesOutrasCompanhias = await Promise.all(
            GRUPOS_OUTRAS_COMPANHIAS.map(grupo => buscarDadosGrupoHabbo(grupo.id, prioridadeDireto))
        );

        const nomesParaSet = membros => new Set(membros.filter(m => m && m.name).map(m => normalizarNick(m.name)));
        const setCorregedoria = nomesParaSet(membrosCorregedoria);
        const setGate = nomesParaSet(membrosGate);
        const setGss = nomesParaSet(membrosGss);
        const setSpp = nomesParaSet(membrosSpp);
        const setDep = nomesParaSet(membrosDep);
        const setCdc = nomesParaSet(membrosCdc);
        const setProf = nomesParaSet(membrosProf);
        const setGrad = nomesParaSet(membrosGrad);
        const setsOutrasCompanhias = membrosOutrasCompanhias.map(nomesParaSet);
        const outros = [];

        mapaMembrosOficiais.forEach((dadosOficiais, nickLower) => {
            const eImune = contasImunesHardcoded.includes(nickLower)
                || setCorregedoria.has(nickLower)
                || setGate.has(nickLower)
                || setGss.has(nickLower);
            if (eImune) return;

            const grupos = GRUPOS_OUTRAS_COMPANHIAS
                .filter((grupo, indice) => setsOutrasCompanhias[indice].has(nickLower))
                .map(grupo => ({
                    nome: grupo.nome,
                    badgeCode: detalhesOutrasCompanhias[GRUPOS_OUTRAS_COMPANHIAS.indexOf(grupo)]?.badgeCode || ''
                }));

            if (grupos.length > 0) {
                outros.push({
                    nick: dadosOficiais.nick,
                    cargo: dadosOficiais.cargo,
                    grupos
                });
            }
        });

        outros.sort((a, b) => a.nick.localeCompare(b.nick, 'pt-BR', { sensitivity: 'base' }));

        const nickMap = new Map();

        const validarPermissaoGrupo = (nomeGrupo, cargo) => {
            if (!cargo) return false;
            const cargoLower = cargo.toLowerCase();

            if (nomeGrupo === 'professores') return true;

            if (nomeGrupo === 'graduadores') {
                if (cargoLower === 'professor') return false;
                return true;
            }

            return true;
        };

        const processarGrupoAlvo = (listaMembros, nomeGrupo) => {
            listaMembros.forEach(membro => {
                const nick = membro.name;
                if (!nick) return;
                const nickLower = normalizarNick(nick);

                if (contasEspeciais.includes(nickLower)) return;

                const eContaImuneHardcoded = contasImunesHardcoded.includes(nickLower);
                const estaCorregedoria = setCorregedoria.has(nickLower);
                const estaGate = setGate.has(nickLower);
                const estaGss = setGss.has(nickLower);
                const eImune = eContaImuneHardcoded || estaCorregedoria || estaGate || estaGss;

                const dadosOficiais = mapaMembrosOficiais.get(nickLower);
                const isOfficial = !!dadosOficiais;
                const isNoSystem = nicksNoSystem && nicksNoSystem.has(nickLower);

                const isRegular = isOfficial;

                let temPermissaoParaEsteGrupo = true;
                if (isOfficial) {
                    temPermissaoParaEsteGrupo = validarPermissaoGrupo(nomeGrupo, dadosOficiais.cargo);
                }

                if (!eImune && isRegular && temPermissaoParaEsteGrupo) return;

                if (!nickMap.has(nickLower)) {
                    nickMap.set(nickLower, {
                        nick,
                        grupos: new Set(),
                        eImune: false,
                        motivoImune: '',
                        subgrupos: [],
                        isAdminNoGrupo: membro.isAdmin || false,
                        cargo: dadosOficiais ? dadosOficiais.cargo : 'Não consta na listagem'
                    });
                }
                nickMap.get(nickLower).grupos.add(nomeGrupo);
                if (membro.isAdmin) nickMap.get(nickLower).isAdminNoGrupo = true;
            });
        };

        processarGrupoAlvo(membrosProf, 'professores');
        processarGrupoAlvo(membrosGrad, 'graduadores');

        const retirar = [];
        const imunes = [];
        const subgrupos = [];
        const admins = new Set();

        for (const [nickLower, dados] of nickMap) {

            if (dados.isAdminNoGrupo) admins.add(nickLower);

            const eContaImune = contasImunesHardcoded.includes(nickLower);
            const estaCorregedoria = setCorregedoria.has(nickLower);
            const estaGate = setGate.has(nickLower);
            const estaGss = setGss.has(nickLower);

            if (eContaImune || estaCorregedoria || estaGate || estaGss) {
                dados.eImune = true;
                if (eContaImune) dados.motivoImune = 'Conta Especial';
                else if (estaCorregedoria) dados.motivoImune = 'Corregedoria';
                else if (estaGate) dados.motivoImune = 'GATE';
                else dados.motivoImune = 'GSS';

                imunes.push({
                    nick: dados.nick,
                    grupos: Array.from(dados.grupos),
                    motivoImune: dados.motivoImune,
                    isAdminNoGrupo: dados.isAdminNoGrupo
                });
                continue;
            }

            if (setSpp.has(nickLower)) dados.subgrupos.push('SPP');
            if (setDep.has(nickLower)) dados.subgrupos.push('Dep. Aplicação');
            if (setCdc.has(nickLower)) dados.subgrupos.push('CDC');

            if (dados.subgrupos.length > 0) {
                subgrupos.push({
                    nick: dados.nick,
                    grupos: Array.from(dados.grupos),
                    subgrupos: dados.subgrupos,
                    isAdminNoGrupo: dados.isAdminNoGrupo
                });
            }

            retirar.push({
                nick: dados.nick,
                grupos: Array.from(dados.grupos),
                isAdminNoGrupo: dados.isAdminNoGrupo,
                status: 'Não consta na listagem dos professores'
            });
        }

        return {
            retirar,
            imunes,
            subgrupos,
            outros,
            sets: { spp: setSpp, dep: setDep, cdc: setCdc, prof: setProf, grad: setGrad, admins }
        };

    } catch (erro) {
        console.error('Erro crítico na verificação de grupos:', erro);
        showToast('Erro ao buscar dados dos grupos do Habbo. Verifique o console ou tente novamente.', 'error');
        return {
            retirar: [], imunes: [], subgrupos: [], outros: [],
            sets: {
                spp: new Set(), dep: new Set(), cdc: new Set(),
                prof: new Set(), grad: new Set(), admins: new Set()
            }
        };
    }
}

async function verificarAtividadeHabbo(membros, prioridadeDireto = false, setsHabbo = null, modoIndividual = false) {
    const listaOffline = [];
    const listaPerfisIrregulares = [];
    const listaErros = [];
    const BATCH_SIZE = 5;
    const MAX_TENTATIVAS = 6;

    const processarMembro = async (m) => {
        if (m.estaLicenciado) return { tipo: 'ok' };

        let ultimoErroMsg = '';
        for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
            try {
                const targetUrl = `${URL_API_HABBO}?name=${m.nick}`;
                const res = await fetchWithProxy(targetUrl, {}, prioridadeDireto || modoIndividual);

                if (res.status === 404) {
                    return { tipo: 'erro', nick: m.nick, cargo: m.cargo, motivo: 'Usuário não encontrado (Nome alterado/banido)' };
                }

                const texto = await res.text();

                if (!texto.startsWith('{') && !texto.startsWith('[')) {
                    ultimoErroMsg = 'Resposta inválida (não-JSON)';
                    console.warn(`[Offline] ${ultimoErroMsg} para ${m.nick}, tentativa ${tentativa}/${MAX_TENTATIVAS}`);
                    statusProcesso.innerText = `Analisando: ${m.nick} (Aviso: Proxy retornou não-JSON na tent. ${tentativa}/${MAX_TENTATIVAS})`;
                    if (tentativa < MAX_TENTATIVAS) {
                        await new Promise(r => setTimeout(r, 600 * tentativa));
                        continue;
                    }
                    return { tipo: 'erro', nick: m.nick, cargo: m.cargo, motivo: ultimoErroMsg };
                }

                const dados = JSON.parse(texto);

                if (!dados || typeof dados !== 'object' || !dados.uniqueId) {
                    ultimoErroMsg = 'Dados incompletos da API';
                    console.warn(`[Offline] ${ultimoErroMsg} para ${m.nick}, tentativa ${tentativa}/${MAX_TENTATIVAS}`);
                    statusProcesso.innerText = `Analisando: ${m.nick} (Aviso: JSON malformado na tent. ${tentativa}/${MAX_TENTATIVAS})`;
                    if (tentativa < MAX_TENTATIVAS) {
                        await new Promise(r => setTimeout(r, 600 * tentativa));
                        continue;
                    }
                    return { tipo: 'erro', nick: m.nick, cargo: m.cargo, motivo: ultimoErroMsg };
                }

                if (dados.lastAccessTime) {
                    limparAvisoPerfilIrregular(m.nick);
                    const diasDiferenca = Math.floor((new Date() - new Date(dados.lastAccessTime)) / (1000 * 60 * 60 * 24));
                    if (diasDiferenca >= 5) {
                        const nickLower = m.nick.toLowerCase();
                        const noProfessores = setsHabbo ? setsHabbo.prof.has(nickLower) : false;
                        const noGraduadores = setsHabbo ? setsHabbo.grad.has(nickLower) : false;
                        const noGrupo = noProfessores || noGraduadores;

                        return {
                            tipo: 'offline',
                            nick: m.nick, cargo: m.cargo, dias: diasDiferenca,
                            estaNoForum: m.estaNoForum, subforunsDoMembro: m.subforunsDoMembro,
                            noGrupo, noProfessores, noGraduadores,
                            ultimoAcesso: dados.lastAccessTime
                        };
                    }
                    return { tipo: 'ok' };
                } else {
                    const statusAviso = obterStatusAvisoPerfilIrregular(m.nick);
                    return {
                        tipo: 'perfil-irregular',
                        nick: m.nick,
                        cargo: m.cargo,
                        motivo: 'Perfil privado (último acesso oculto)',
                        irregularidade: 'Visibilidade do perfil desativada',
                        estaNoForum: m.estaNoForum,
                        subforunsDoMembro: m.subforunsDoMembro,
                        ...statusAviso
                    };
                }
            } catch (e) {
                ultimoErroMsg = e.message || 'Erro desconhecido';
                console.warn(`[Offline] Erro ao verificar ${m.nick} (tentativa ${tentativa}/${MAX_TENTATIVAS}):`, ultimoErroMsg);
                statusProcesso.innerText = `Analisando: ${m.nick} (Erro na tent. ${tentativa}/${MAX_TENTATIVAS}: ${ultimoErroMsg})`;
                if (tentativa < MAX_TENTATIVAS) {
                    await new Promise(r => setTimeout(r, 600 * tentativa));
                }
            }
        }
        return { tipo: 'erro', nick: m.nick, cargo: m.cargo, motivo: ultimoErroMsg };
    };

    if (modoIndividual) {
        let tempoTotalConsultasMs = 0;

        const formatarTempoRestante = tempoMs => {
            const totalSegundos = Math.max(0, Math.ceil(tempoMs / 1000));
            if (totalSegundos < 60) return `${totalSegundos}s`;

            const minutos = Math.floor(totalSegundos / 60);
            const segundos = totalSegundos % 60;
            return segundos > 0 ? `${minutos}min ${segundos}s` : `${minutos}min`;
        };

        const estimarTempoRestante = (quantidadeRestante, concluidos, incluirPausaAntesDeCada = false) => {
            const mediaConsultaMs = concluidos > 0
                ? tempoTotalConsultasMs / concluidos
                : ESTIMATIVA_INICIAL_CONSULTA_MS;
            const quantidadePausas = incluirPausaAntesDeCada
                ? quantidadeRestante
                : Math.max(0, quantidadeRestante - 1);
            return quantidadeRestante * mediaConsultaMs
                + quantidadePausas * INTERVALO_MODO_INDIVIDUAL_MS;
        };

        for (let i = 0; i < membros.length; i++) {
            const membro = membros[i];
            const restantesIncluindoAtual = membros.length - i;
            const estimativaAntes = estimarTempoRestante(restantesIncluindoAtual, i);
            statusProcesso.innerText = `Analisando professor ${i + 1}/${membros.length}: ${membro.nick} • Tempo restante aprox.: ${formatarTempoRestante(estimativaAntes)}`;

            const inicioConsulta = Date.now();
            const res = await processarMembro(membro);
            tempoTotalConsultasMs += Date.now() - inicioConsulta;
            if (res.tipo === 'offline') listaOffline.push(res);
            else if (res.tipo === 'perfil-irregular') listaPerfisIrregulares.push(res);
            else if (res.tipo === 'erro') listaErros.push(res);

            const concluidos = i + 1;
            const restantes = membros.length - concluidos;
            const estimativaDepois = estimarTempoRestante(restantes, concluidos, true);
            statusProcesso.innerText = `Concluídos ${concluidos}/${membros.length} • Tempo restante aprox.: ${formatarTempoRestante(estimativaDepois)}`;

            if (restantes > 0) {
                await new Promise(r => setTimeout(r, INTERVALO_MODO_INDIVIDUAL_MS));
            }
        }

        return { offline: listaOffline, perfisIrregulares: listaPerfisIrregulares, erros: listaErros };
    }

    for (let i = 0; i < membros.length; i += BATCH_SIZE) {
        const lote = membros.slice(i, i + BATCH_SIZE);
        statusProcesso.innerText = `Analisando membros: ${Math.min(i + BATCH_SIZE, membros.length)}/${membros.length}`;

        const resultados = await Promise.all(lote.map(m => processarMembro(m)));

        resultados.forEach(res => {
            if (res.tipo === 'offline') listaOffline.push(res);
            else if (res.tipo === 'perfil-irregular') listaPerfisIrregulares.push(res);
            else if (res.tipo === 'erro') listaErros.push(res);
        });

        if (i + BATCH_SIZE < membros.length) {
            await new Promise(r => setTimeout(r, 300));
        }
    }

    return { offline: listaOffline, perfisIrregulares: listaPerfisIrregulares, erros: listaErros };
}

async function verificarGrupo(nick, uniqueId = null, prioridadeDireto = false) {
    try {
        let uid = uniqueId;
        if (!uid) {
            const targetUrl = `${URL_API_HABBO}?name=${nick}`;
            const r = await fetchWithProxy(targetUrl, {}, prioridadeDireto);
            const d = await r.json();
            uid = d.uniqueId;
        }

        if (uid) {
            const targetGrupoUrl = `${URL_API_HABBO}/${uid}/groups`;
            const gr = await fetchWithProxy(targetGrupoUrl, {}, prioridadeDireto);
            const grupos = await gr.json();
            const noProfessores = grupos.some(g => g.id === ID_GRUPO_HABBO);
            const noGraduadores = grupos.some(g => g.id === ID_GRUPO_GRADUADORES);
            return { noGrupo: noProfessores || noGraduadores, noProfessores, noGraduadores };
        }
    } catch (e) {
        console.warn(`[Grupos] Erro ao verificar grupos de ${nick}:`, e.message);
    }
    return { noGrupo: false, noProfessores: false, noGraduadores: false };
}

window.desconsiderarMembro = function (botao, tipo, idx) {

    if (typeof botao === 'string') {
        idx = tipo;
        tipo = botao;
        botao = null;
    }

    const card = botao?.closest('[id^="card-"]') || document.getElementById(`card-${tipo}-${idx}`);
    if (!card) return;

    const btn = botao || card.querySelector('[data-action="desconsiderar"]');
    const icone = btn?.querySelector('i');
    const textoBotao = btn?.querySelector('[data-desconsiderar-label]');
    const iconePadrao = btn?.dataset.desconsiderarIcone || 'fa-trash-can';
    const rotuloPadrao = btn?.dataset.desconsiderarStatus || 'Desconsiderado';
    const textoBotaoPadrao = btn?.dataset.desconsiderarLabel || rotuloPadrao;
    const isDesconsiderado = card.dataset.desconsiderado === 'true';

    if (isDesconsiderado) {

        card.classList.remove('opacity-40');
        card.classList.remove('is-disregarded');
        card.dataset.desconsiderado = 'false';
        card.style.opacity = '';
        card.style.pointerEvents = '';
        card.querySelector('[data-desconsiderado-status]')?.remove();

        card.querySelectorAll('.checkbox-wrapper').forEach(label => {
            const spanX = label.querySelector('span.bg-red-500');
            if (spanX) spanX.remove();

            const spanTexto = label.querySelector('span[class*="ml-"]');
            if (spanTexto) {
                spanTexto.classList.remove('line-through', 'text-red-400');
            }
        });

        card.querySelectorAll('input[type="checkbox"]').forEach(chk => {
            if (chk.dataset.estadoAntesDesconsiderar !== undefined) {
                chk.checked = chk.dataset.estadoAntesDesconsiderar === 'true';
                chk.disabled = chk.dataset.disabledAntesDesconsiderar === 'true';
                delete chk.dataset.estadoAntesDesconsiderar;
                delete chk.dataset.disabledAntesDesconsiderar;
            }
        });

        icone?.classList.remove('fa-rotate-left');
        icone?.classList.add(iconePadrao);
        if (textoBotao) textoBotao.textContent = textoBotaoPadrao;
        if (btn) {
            btn.title = tipo === 'outros' ? 'Marcar como falso positivo' : 'Desconsiderar (dado incorreto)';
            btn.setAttribute('aria-label', tipo === 'outros' ? 'Marcar como falso positivo' : 'Desconsiderar membro');
        }
    } else {

        card.classList.add('opacity-40');
        card.classList.add('is-disregarded');
        card.dataset.desconsiderado = 'true';
        card.style.opacity = '';

        const status = document.createElement('span');
        status.dataset.desconsideradoStatus = 'true';
        status.className = 'desconsiderado-status';
        status.innerHTML = `<i class="fa-solid fa-eye-slash"></i> ${rotuloPadrao}`;
        (btn?.parentElement || card).appendChild(status);

        card.querySelectorAll('.checkbox-wrapper').forEach(label => {
            const spanTexto = label.querySelector('span[class*="ml-"]');
            if (spanTexto) {
                spanTexto.classList.remove('line-through', 'text-red-400');
            }
        });

        card.querySelectorAll('input[type="checkbox"]').forEach(chk => {
            chk.dataset.estadoAntesDesconsiderar = String(chk.checked);
            chk.dataset.disabledAntesDesconsiderar = String(chk.disabled);
            chk.disabled = true;
        });

        icone?.classList.remove('fa-trash-can', 'fa-eye-slash');
        icone?.classList.add('fa-rotate-left');
        if (textoBotao) textoBotao.textContent = 'Restaurar';
        if (btn) {
            btn.title = tipo === 'outros' ? 'Restaurar conflito' : 'Restaurar membro';
            btn.setAttribute('aria-label', tipo === 'outros' ? 'Restaurar conflito' : 'Restaurar membro');
        }
    }

    verificarProgressoAba(tipo);

    const nickElement = card.querySelector('h4');
    const cargoElement = card.querySelector('p.font-mono');
    if (nickElement) {
        const nick = nickElement.textContent;
        const cargo = cargoElement ? cargoElement.textContent : '';
        registrarAcaoNaPlanilha(tipo, nick, cargo, 'desconsiderado', !isDesconsiderado, isDesconsiderado ? 'Membro restaurado' : tipo === 'outros' ? 'Falso positivo' : 'Dado incorreto');
    }
};

window.alternarTab = function (tipo) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));

    const tab = document.getElementById('tab-' + tipo);
    const content = document.getElementById('content-' + tipo);
    if (!tab || !content) return;
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    content.classList.remove('hidden');
};

const CONFIG_PROGRESSO_ABAS = {
    inativos: { seletor: '[id^="card-inativos-"]', alerta: 'status-alert-red' },
    graduacao: { seletor: '[id^="card-graduacao-"]', alerta: 'status-alert-red' },
    offline: { seletor: '[id^="card-offline-"]', alerta: 'status-alert-red' },
    'perfil-irregular': { seletor: '[id^="card-perfil-irregular-"]', alerta: 'status-alert-amber' },
    'remover-forum': { seletor: '[id^="card-remover-forum-"]', alerta: 'status-alert-amber' },
    'retirar-grupos': { seletor: '[id^="card-retirar-groups-"]', alerta: 'status-alert-amber' },
    outros: { seletor: '[id^="card-outros-"]', alerta: 'status-alert-amber' }
};

function atualizarContagemPendenteAba(tipo, quantidade) {
    const config = CONFIG_PROGRESSO_ABAS[tipo];
    const aba = document.getElementById(`tab-${tipo}`);
    const badge = document.getElementById(`badge-count-${tipo}`);
    if (!config || !aba || !badge) return;

    aba.classList.remove('status-ok', 'status-alert-red', 'status-alert-amber');
    badge.classList.remove('pulse-active');
    badge.textContent = quantidade > 0 ? String(quantidade) : '✓';
    badge.setAttribute('aria-label', quantidade > 0 ? `${quantidade} pendente${quantidade === 1 ? '' : 's'}` : 'Tudo concluído');

    if (quantidade > 0) {
        aba.classList.add(config.alerta);
        badge.classList.add('pulse-active');
    } else {
        aba.classList.add('status-ok');
    }
}

function cardDaAbaEstaResolvido(card, tipo) {
    if (card.dataset.desconsiderado === 'true') return true;
    if (tipo === 'system') return Boolean(card.dataset.resolucao);
    if (tipo === 'perfil-irregular' && card.dataset.aguardando === 'true') return true;

    if (tipo === 'outros') {
        const tipoConflito = card.dataset.tipoConflito || '';
        const saida = card.querySelector('[id^="chk-saida-conflito-"]');
        const expulsao = card.querySelector('[id^="chk-expulsao-conflito-"]');
        const medalha = card.querySelector('[id^="chk-medal-conflito-"]');
        const carta = card.querySelector('[id^="chk-mp-conflito-"]');
        if (tipoConflito === 'migracao') return Boolean(saida?.checked);
        if (tipoConflito === 'sem-permissao') return Boolean(expulsao?.checked && medalha?.checked && carta?.checked);
        if (saida?.checked) return true;
        return Boolean(expulsao?.checked && medalha?.checked && carta?.checked);
    }

    const tarefas = Array.from(card.querySelectorAll('input[type="checkbox"][id^="chk-"]'));
    return tarefas.length > 0 && tarefas.every(tarefa => tarefa.checked);
}

window.verificarProgressoAba = function (tipo) {
    const config = CONFIG_PROGRESSO_ABAS[tipo];
    const container = document.getElementById(`content-${tipo}`);
    if (!config || !container) return;

    const cards = Array.from(container.querySelectorAll(config.seletor));
    const quantidadePendente = cards.filter(card => !cardDaAbaEstaResolvido(card, tipo)).length;
    atualizarContagemPendenteAba(tipo, quantidadePendente);
};

window.registrarCheckbox = function (checkbox, categoria, nickMembro, cargoMembro, tipoAcao) {

    verificarProgressoAba(categoria);

    registrarAcaoNaPlanilha(categoria, nickMembro, cargoMembro, tipoAcao, checkbox.checked);
};

window.atualizarProgressoPorCheckboxId = function (chkId) {
    if (!chkId) return;
    const firstId = chkId.split(',')[0];
    const checkbox = document.getElementById(firstId);
    const conteudoAba = checkbox?.closest('.tab-content[id^="content-"]');
    if (conteudoAba) {
        verificarProgressoAba(conteudoAba.id.replace('content-', ''));
        return;
    }
    if (firstId.includes('inativos')) verificarProgressoAba('inativos');
    else if (firstId.includes('graduacao')) verificarProgressoAba('graduacao');
    else if (firstId.includes('offline')) verificarProgressoAba('offline');
    else if (firstId.includes('perfil-irregular')) verificarProgressoAba('perfil-irregular');
    else if (firstId.includes('remover-forum')) verificarProgressoAba('remover-forum');
    else if (firstId.includes('conflito')) verificarProgressoAba('outros');
};

function escaparHtmlSeguro(valor) {
    return String(valor || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function exibirResultados(inativos, offline, perfisIrregulares, graduacao, removerForum = [], retirarDosGrupos = { retirar: [], imunes: [], subgrupos: [], outros: [] }, errosVerificacao = []) {
    retirarDosGrupos.outros = retirarDosGrupos.outros || [];
    membrosInativos = inativos;
    membrosOffline = offline;
    membrosPerfilIrregular = perfisIrregulares;
    graduacoesPendentes = graduacao;
    membrosRemoverForum = removerForum;

    atualizarContagemPendenteAba('inativos', inativos.length);
    atualizarContagemPendenteAba('graduacao', graduacao.length);
    atualizarContagemPendenteAba('offline', offline.length);
    atualizarContagemPendenteAba('perfil-irregular', perfisIrregulares.filter(m => m.situacao !== 'aguardando').length);
    atualizarContagemPendenteAba('remover-forum', removerForum.length);
    atualizarContagemPendenteAba('retirar-grupos', retirarDosGrupos.retirar.length);
    atualizarContagemPendenteAba('outros', retirarDosGrupos.outros.length);

    const counterInativos = document.getElementById('contador-inativos');
    if (counterInativos) counterInativos.innerText = inativos.length + " encontrados";

    const counterOffline = document.getElementById('contador-offline');
    if (counterOffline) counterOffline.innerText = offline.length + " encontrados";

    const counterPerfilIrregular = document.getElementById('contador-perfil-irregular');
    if (counterPerfilIrregular) counterPerfilIrregular.innerText = perfisIrregulares.length + " encontrados";

    const counterGraduacao = document.getElementById('contador-graduacao');
    if (counterGraduacao) counterGraduacao.innerText = graduacao.length + " encontrados";

    const counterRemoverForum = document.getElementById('contador-remover-forum');
    if (counterRemoverForum) counterRemoverForum.innerText = removerForum.length + " encontrados";

    const contadorRetirarGrupos = document.getElementById('contador-retirar-grupos');
    if (contadorRetirarGrupos) contadorRetirarGrupos.innerText = retirarDosGrupos.retirar.length + " encontrados";

    const contadorOutros = document.getElementById('contador-outros');
    if (contadorOutros) contadorOutros.innerText = retirarDosGrupos.outros.length + " encontrados";

    const renderizarLista = (lista, containerId, tipo) => {
        const container = document.getElementById(containerId);
        const divAcoes = document.getElementById('acoes-' + tipo);

        if (lista.length > 0) {
            if (divAcoes) divAcoes.classList.remove('hidden');
            container.innerHTML = lista.map((m, idx) => criarCardMembro(m, idx, tipo)).join('');
        } else {
            if (divAcoes) divAcoes.classList.add('hidden');
            container.innerHTML = `
                        <div class="col-span-1 text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                            <i class="fa-solid fa-check-circle text-4xl text-emerald-500 mb-2 opacity-50"></i>
                            <p class="text-slate-500 dark:text-slate-400 text-sm">Nenhum membro encontrado nesta categoria.</p>
                        </div>
                    `;
        }
    };

    renderizarLista(inativos, 'lista-inativos', 'inativos');
    renderizarLista(graduacao, 'lista-graduacao', 'graduacao');
    renderizarLista(offline, 'lista-offline', 'offline');
    renderizarLista(perfisIrregulares, 'lista-perfil-irregular', 'perfil-irregular');
    renderizarLista(removerForum, 'lista-remover-forum', 'remover-forum');

    const abasCondicionais = [
        { tipo: 'remover-forum', possuiResultados: removerForum.length > 0 },
        { tipo: 'retirar-grupos', possuiResultados: retirarDosGrupos.retirar.length > 0 }
    ];
    abasCondicionais.forEach(({ tipo, possuiResultados }) => {
        const aba = document.getElementById(`tab-${tipo}`);
        if (!aba) return;
        if (!possuiResultados && aba.classList.contains('active')) alternarTab('inativos');
        aba.classList.toggle('hidden', !possuiResultados);
        aba.classList.toggle('flex', possuiResultados);
    });

    const tabPerfilIrregular = document.getElementById('tab-perfil-irregular');
    if (tabPerfilIrregular) {
        if (perfisIrregulares.length > 0) {
            tabPerfilIrregular.classList.remove('hidden');
            tabPerfilIrregular.classList.add('flex');
        } else {
            if (tabPerfilIrregular.classList.contains('active')) alternarTab('inativos');
            tabPerfilIrregular.classList.add('hidden');
            tabPerfilIrregular.classList.remove('flex');
        }
    }

    const acoesPerfilIrregular = document.getElementById('acoes-perfil-irregular');
    if (acoesPerfilIrregular) {
        acoesPerfilIrregular.classList.toggle('hidden', !perfisIrregulares.some(m => m.podePunir));
        acoesPerfilIrregular.classList.toggle('flex', perfisIrregulares.some(m => m.podePunir));
    }

    const tabOutros = document.getElementById('tab-outros');
    const listaOutros = document.getElementById('lista-outros');
    if (tabOutros && listaOutros) {
        if (retirarDosGrupos.outros.length > 0) {
            tabOutros.classList.remove('hidden');
            tabOutros.classList.add('flex');
            listaOutros.innerHTML = retirarDosGrupos.outros.map((m, idx) => criarCardOutraCompanhia(m, idx)).join('');
        } else {
            if (tabOutros.classList.contains('active')) {
                alternarTab('inativos');
            }
            tabOutros.classList.add('hidden');
            tabOutros.classList.remove('flex');
            listaOutros.innerHTML = '';
        }
    }

    const tabErros = document.getElementById('tab-erros');
    const badgeErros = document.getElementById('badge-count-erros');
    const contadorErros = document.getElementById('contador-erros');
    const listaErros = document.getElementById('lista-erros');
    if (tabErros && listaErros) {
        if (errosVerificacao.length > 0) {
            tabErros.classList.remove('hidden');
            tabErros.classList.add('flex');
            if (badgeErros) {
                badgeErros.innerText = errosVerificacao.length;
                badgeErros.classList.add('pulse-active');
            }
            if (contadorErros) contadorErros.innerText = errosVerificacao.length + ' encontrados';
            listaErros.innerHTML = errosVerificacao.map((e, idx) => `
                <li class="bg-red-50/50 dark:bg-red-950/10 border border-red-200/60 dark:border-red-900/30 rounded-xl p-4 flex items-center gap-3 group hover:border-red-400 dark:hover:border-red-700 transition-all">
                    <img src="https://www.habbo.com.br/habbo-imaging/avatarimage?img_format=png&user=${e.nick}&direction=2&head_direction=3&size=s&headonly=1"
                        class="w-10 h-10 rounded-lg border border-red-200 dark:border-red-800 bg-red-100 dark:bg-red-900/30 object-contain scale-150 translate-y-0.5"
                        onerror="this.style.display='none'">
                    <div class="flex-grow min-w-0">
                        <h4 class="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">${e.nick}</h4>
                        <p class="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">${e.cargo}</p>
                        <p class="text-[10px] text-red-500 dark:text-red-400 mt-0.5 flex items-center gap-1"><i class="fa-solid fa-circle-xmark text-[8px]"></i>${e.motivo}</p>
                    </div>
                    <a href="https://www.habbo.com.br/profile/${e.nick}" target="_blank"
                        class="shrink-0 w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center text-red-500 hover:scale-110 transition-transform"
                        title="Ver perfil no Habbo">
                        <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                    </a>
                </li>
            `).join('');
        } else {
            if (badgeErros) {
                badgeErros.innerText = '0';
                badgeErros.classList.remove('pulse-active');
            }
            if (tabErros.classList.contains('active')) {
                alternarTab('inativos');
            }
            tabErros.classList.add('hidden');
            tabErros.classList.remove('flex');
        }
    }

    const listaRetirarGrupos = document.getElementById('lista-retirar-grupos');
    if (listaRetirarGrupos) {
        if (retirarDosGrupos.retirar.length > 0) {
            listaRetirarGrupos.innerHTML = retirarDosGrupos.retirar.map((m, idx) => criarCardGrupo(m, idx)).join('');
        } else {
            listaRetirarGrupos.innerHTML = `
                <div class="col-span-1 text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                    <i class="fa-solid fa-check-circle text-4xl text-emerald-500 mb-2 opacity-50"></i>
                    <p class="text-slate-500 dark:text-slate-400 text-sm">Nenhum membro excedente encontrado nos grupos.</p>
                </div>
            `;
        }
    }

    const secaoImunes = document.getElementById('secao-imunes');
    const listaImunes = document.getElementById('lista-imunes');
    const contadorImunes = document.getElementById('contador-imunes');
    if (secaoImunes && listaImunes) {
        if (retirarDosGrupos.imunes.length > 0) {
            secaoImunes.classList.remove('hidden');
            if (contadorImunes) contadorImunes.innerText = retirarDosGrupos.imunes.length;
            listaImunes.innerHTML = retirarDosGrupos.imunes.map(m => `
                <li class="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 flex items-center gap-3">
                    <img src="https://www.habbo.com.br/habbo-imaging/avatarimage?img_format=png&user=${m.nick}&direction=2&head_direction=3&size=s&headonly=1" class="w-8 h-8 rounded-full border border-emerald-300 dark:border-emerald-600 bg-emerald-100 dark:bg-emerald-900">
                    <div>
                        <p class="font-semibold text-sm text-emerald-700 dark:text-emerald-300">${m.nick}</p>
                        <p class="text-[10px] text-emerald-600 dark:text-emerald-400"><i class="fa-solid fa-shield-halved mr-1"></i>${m.motivoImune}</p>
                    </div>
                </li>
            `).join('');
        } else {
            secaoImunes.classList.add('hidden');
        }
    }

    const secaoSubgrupos = document.getElementById('secao-subgrupos');
    const listaSubgrupos = document.getElementById('lista-subgrupos');
    const contadorSubgrupos = document.getElementById('contador-subgrupos');
    if (secaoSubgrupos && listaSubgrupos) {
        if (retirarDosGrupos.subgrupos.length > 0) {
            secaoSubgrupos.classList.remove('hidden');
            if (contadorSubgrupos) contadorSubgrupos.innerText = retirarDosGrupos.subgrupos.length;
            listaSubgrupos.innerHTML = retirarDosGrupos.subgrupos.map(m => {

                const cores = [];
                if (m.subgrupos.includes('SPP')) cores.push('#2e1065');
                if (m.subgrupos.includes('Dep. Aplicação')) cores.push('#581c87');
                if (m.subgrupos.includes('CDC')) cores.push('#7e22ce');

                let cardStyle = '';
                let cardClass = 'bg-white dark:bg-[#1e293b] border-l-4 border-l-slate-300 dark:border-l-slate-600';

                if (cores.length > 1) {

                    cardStyle = `style="background-image: linear-gradient(135deg, ${cores.join(', ')}); border-left: none;"`;
                    cardClass = 'text-white border-0';
                } else if (cores.length === 1) {

                    if (m.subgrupos.includes('SPP')) {
                        cardClass = 'bg-slate-50 dark:bg-[#0f0518] border-l-4 border-l-[#2e1065]';
                    } else if (m.subgrupos.includes('Dep. Aplicação')) {
                        cardClass = 'bg-purple-50 dark:bg-[#1a0b2e] border-l-4 border-l-[#facc15]';
                    } else if (m.subgrupos.includes('CDC')) {
                        cardClass = 'bg-purple-50 dark:bg-[#150a1f] border-l-4 border-l-[#d8b4fe]';
                    }
                }

                const badges = m.subgrupos.map(sg => {
                    let styleClass = '';
                    let icon = '';
                    let sigla = sg;

                    if (sg === 'SPP') {
                        styleClass = 'bg-[#2e1065] text-white border border-purple-900 shadow-sm shadow-[#2e1065]/30';
                        icon = '<i class="fa-solid fa-shield-cat mr-1.5 text-purple-300"></i>';
                        sigla = 'SPP';
                    } else if (sg === 'Dep. Aplicação') {
                        styleClass = 'bg-[#581c87] text-[#facc15] border border-[#facc15]/40 shadow-sm shadow-[#581c87]/30';
                        icon = '<i class="fa-solid fa-book-open mr-1.5 text-[#facc15]"></i>';
                        sigla = 'DA';
                    } else if (sg === 'CDC') {
                        styleClass = 'bg-[#d8b4fe] text-[#4c1d95] border border-[#c084fc] shadow-sm shadow-[#d8b4fe]/30';
                        icon = '<i class="fa-solid fa-palette mr-1.5 text-[#6b21a8]"></i>';
                        sigla = 'CDC';
                    }
                    return `<div class="${styleClass} px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-bold flex items-center w-fit transition-transform hover:scale-105">${icon}${sigla}</div>`;
                }).join('');

                const isGradient = cores.length > 1;
                const textColor = isGradient ? 'text-white' : 'text-slate-800 dark:text-slate-200';
                const subTextColor = isGradient ? 'text-white/80' : 'text-slate-500 dark:text-slate-400';
                const avatarBorder = isGradient ? 'border-white/20' : 'border-slate-200 dark:border-slate-700';
                const bgAvatar = isGradient ? 'bg-white/10' : 'bg-slate-100 dark:bg-slate-900';

                return `
                <li ${cardStyle} class="${cardClass} ${!isGradient ? 'border-y border-r border-slate-200 dark:border-slate-800' : ''} rounded-xl p-4 flex flex-col md:flex-row items-center gap-4 shadow-lg hover:shadow-xl transition-all group relative overflow-hidden">
                    ${isGradient ? '<div class="absolute inset-0 bg-black/10 hover:bg-transparent transition-colors"></div>' : ''}
                    <div class="flex items-center gap-4 w-full md:w-auto relative z-10">
                        <div class="w-12 h-12 rounded-full border-2 ${avatarBorder} ${bgAvatar} shrink-0 overflow-hidden flex items-center justify-center backdrop-blur-sm">
                            <img src="https://www.habbo.com.br/habbo-imaging/avatarimage?img_format=png&user=${m.nick}&direction=2&head_direction=3&size=m&headonly=1" class="-mt-2">
                        </div>
                        <div>
                             <p class="font-bold text-base ${textColor}">${m.nick}</p>
                        </div>
                    </div>

                    <div class="flex-grow w-full md:ml-4 border-t md:border-t-0 md:border-l ${isGradient ? 'border-white/20' : 'border-slate-200 dark:border-slate-700'} pt-3 md:pt-0 md:pl-6 relative z-10">
                        <div class="flex flex-wrap gap-2 items-center justify-start md:justify-end">
                            ${badges}
                        </div>
                    </div>
                </li>
            `;
            }).join('');
        } else {
            secaoSubgrupos.classList.add('hidden');
        }
    }

    containerResultados.classList.remove('hidden');
    containerResultados.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (inativos.length > 0) alternarTab('inativos');
    else if (graduacao.length > 0) alternarTab('graduacao');
    else if (offline.length > 0) alternarTab('offline');
    else if (perfisIrregulares.length > 0) alternarTab('perfil-irregular');
    else if (removerForum.length > 0) alternarTab('remover-forum');
    else if (retirarDosGrupos.retirar.length > 0) alternarTab('retirar-grupos');
    else if (retirarDosGrupos.outros.length > 0) alternarTab('outros');
}

async function buscarDadosGrupoHabbo(groupId, prioridadeDireto = false) {
    const api = `https://www.habbo.com.br/api/public/groups/${groupId}`;
    try {
        const response = await fetchWithProxy(api, {}, prioridadeDireto);
        const dados = await response.json();
        if (!dados || !dados.id) throw new Error('Resposta inesperada da API de grupos');
        return dados;
    } catch (e) {
        console.warn('[Grupos] Não foi possível buscar o emblema do grupo', groupId, e);
        return null;
    }
}

function criarCardOutraCompanhia(m, idx) {
    const urlAvatar = `https://www.habbo.com.br/habbo-imaging/avatarimage?img_format=png&user=${encodeURIComponent(m.nick)}&direction=2&head_direction=3&size=l&headonly=0`;
    const nickSeguro = escaparHtmlSeguro(m.nick);
    const cargoSeguro = escaparHtmlSeguro(m.cargo);
    const estilosGrupos = {
        'Supervisores': 'border-emerald-400 dark:border-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200',
        'Treinadores': 'border-red-400 dark:border-red-700 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
        'Instrutores': 'border-blue-950 dark:border-blue-800 bg-blue-950 dark:bg-blue-950 text-blue-100 dark:text-blue-100',
        'Escola de Formação de Executivos': 'border-cyan-400 dark:border-cyan-700 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200'
    };
    const badges = m.grupos.map(grupo => {
        const nomeGrupo = typeof grupo === 'string' ? grupo : grupo.nome;
        const badgeCode = typeof grupo === 'string' ? '' : grupo.badgeCode;
        const urlEmblema = badgeCode ? `https://www.habbo.com.br/habbo-imaging/badge/${encodeURIComponent(badgeCode)}.gif` : '';
        return `
            <span class="inline-flex items-center gap-2 rounded-xl border ${estilosGrupos[nomeGrupo] || 'border-amber-300 dark:border-amber-700 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'} px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide">
                ${urlEmblema ? `<img src="${urlEmblema}" alt="Emblema de ${nomeGrupo}" class="w-5 h-5 object-contain" onerror="this.remove()">` : '<i class="fa-solid fa-people-arrows"></i>'}
                ${nomeGrupo}
            </span>
        `;
    }).join('');

    return `
    <li id="card-outros-${idx}" data-nick="${nickSeguro}" data-cargo="${cargoSeguro}" class="card-standard group rounded-2xl overflow-hidden animate-fade-in border border-amber-200 dark:border-amber-900/50" style="animation-delay: ${idx * 0.05}s">
        <div class="flex flex-col sm:flex-row sm:items-center gap-4 p-4">
            <div class="w-16 h-20 shrink-0 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 overflow-hidden flex items-center justify-center self-center sm:self-auto">
                <img src="${urlAvatar}" alt="${m.nick}" class="w-14 h-20 object-contain drop-shadow-lg transition-transform group-hover:scale-105 duration-300">
            </div>
            <div class="flex-grow min-w-0 text-center sm:text-left">
                <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h4 class="text-lg font-black text-slate-800 dark:text-white leading-none">${nickSeguro}</h4>
                    <span class="inline-flex items-center gap-1 rounded-md bg-red-100 dark:bg-red-950/30 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-red-700 dark:text-red-300">
                        <i class="fa-solid fa-triangle-exclamation"></i> Outra companhia
                    </span>
                </div>
                <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">Na listagem: <strong>${cargoSeguro}</strong></p>
                <p class="mt-3 mb-1 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">Achado em:</p>
                <div class="flex flex-wrap justify-center sm:justify-start gap-2">${badges}</div>
            </div>
            <div class="flex flex-wrap items-center justify-center gap-2 shrink-0 self-center sm:self-auto">
                <a href="https://system.policercc.com.br/perfil/${encodeURIComponent(m.nick)}" target="_blank"
                    class="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-amber-400 hover:text-amber-600 transition-all">
                    Perfil no RCCSystem <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </a>
                <button type="button" data-action="desconsiderar" data-desconsiderar-icone="fa-eye-slash"
                    data-desconsiderar-status="Falso positivo" data-desconsiderar-label="Falso positivo"
                    onclick="desconsiderarMembro(this, 'outros', ${idx})"
                    class="inline-flex items-center gap-2 rounded-lg border border-purple-800/70 bg-purple-950/20 px-3 py-2 text-xs font-bold text-purple-300 transition-colors hover:bg-purple-900/30"
                    title="Marcar como falso positivo" aria-label="Marcar como falso positivo">
                    <i class="fa-solid fa-eye-slash"></i><span data-desconsiderar-label>Falso positivo</span>
                </button>
            </div>
        </div>
        <div data-conflict-actions class="border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-black/10 p-4 transition-opacity">
            <div class="flex flex-col lg:flex-row lg:items-center gap-3">
                <div class="shrink-0">
                    <p class="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Situação confirmada</p>
                    <p class="mt-1 text-xs text-slate-500 dark:text-slate-500">Escolha o caso para liberar as ações.</p>
                </div>
                <div class="flex flex-wrap gap-2 lg:ml-auto">
                    <button type="button" id="btn-conflito-migracao-${idx}" onclick="selecionarTipoConflito(${idx}, 'migracao')"
                        class="btn px-3 py-2 rounded-lg border border-cyan-700/60 bg-cyan-950/20 text-cyan-300 text-xs font-bold flex items-center gap-2">
                        <i class="fa-solid fa-right-left"></i> Migração de corpo
                    </button>
                    <button type="button" id="btn-conflito-sem-permissao-${idx}" onclick="selecionarTipoConflito(${idx}, 'sem-permissao')"
                        class="btn px-3 py-2 rounded-lg border border-red-800/60 bg-red-950/20 text-red-300 text-xs font-bold flex items-center gap-2">
                        <i class="fa-solid fa-user-slash"></i> Saída sem permissão
                    </button>
                </div>
            </div>

            <div id="acoes-conflito-migracao-${idx}" class="hidden mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <p class="mb-3 text-xs text-cyan-700 dark:text-cyan-300"><i class="fa-solid fa-circle-info mr-1"></i>A saída será postada com o motivo <strong>Sem vínculo</strong>.</p>
                <button type="button" onclick="postarSaidaConflito(this, ${idx})"
                    class="btn btn-primary px-4 py-2.5 rounded-lg text-xs font-bold inline-flex items-center gap-2">
                    <i class="fa-solid fa-file-export"></i> Postar saída
                </button>
            </div>

            <div id="acoes-conflito-sem-permissao-${idx}" class="hidden mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <p class="mb-3 text-xs text-red-700 dark:text-red-300"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Use as três ações: requerimento de expulsão, 100 medalhas negativas no cofre e carta ao membro.</p>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button type="button" onclick="postarExpulsaoConflito(this, ${idx})"
                        class="btn bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                        <i class="fa-solid fa-gavel"></i> Postar expulsão
                    </button>
                    <button type="button" onclick="postarCofreConflito(this, ${idx})"
                        class="btn bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                        <i class="fa-solid fa-vault"></i> Postar no cofre
                    </button>
                    <button type="button" id="btn-carta-conflito-${idx}" onclick="abrirCartaConflito(this, ${idx})"
                        class="btn bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                        <i class="fa-solid fa-envelope"></i> Enviar carta
                    </button>
                </div>
            </div>

            <input type="checkbox" id="chk-saida-conflito-${idx}" class="hidden" disabled>
            <input type="checkbox" id="chk-expulsao-conflito-${idx}" class="hidden" disabled>
            <input type="checkbox" id="chk-medal-conflito-${idx}" class="hidden" disabled>
            <input type="checkbox" id="chk-mp-conflito-${idx}" class="hidden" disabled>
        </div>
    </li>`;
}

function obterDadosCardConflito(idx) {
    const card = document.getElementById(`card-outros-${idx}`);
    if (!card) return null;
    return { card, nick: card.dataset.nick || '', cargo: card.dataset.cargo || '' };
}

window.selecionarTipoConflito = function (idx, tipo) {
    const card = document.getElementById(`card-outros-${idx}`);
    const painelMigracao = document.getElementById(`acoes-conflito-migracao-${idx}`);
    const painelSemPermissao = document.getElementById(`acoes-conflito-sem-permissao-${idx}`);
    const btnMigracao = document.getElementById(`btn-conflito-migracao-${idx}`);
    const btnSemPermissao = document.getElementById(`btn-conflito-sem-permissao-${idx}`);
    const chkSaida = document.getElementById(`chk-saida-conflito-${idx}`);
    const chkExpulsao = document.getElementById(`chk-expulsao-conflito-${idx}`);
    const chkMedal = document.getElementById(`chk-medal-conflito-${idx}`);
    const chkMp = document.getElementById(`chk-mp-conflito-${idx}`);
    const ehMigracao = tipo === 'migracao';

    if (card) card.dataset.tipoConflito = tipo;

    painelMigracao?.classList.toggle('hidden', !ehMigracao);
    painelSemPermissao?.classList.toggle('hidden', ehMigracao);
    btnMigracao?.classList.toggle('ring-2', ehMigracao);
    btnMigracao?.classList.toggle('ring-cyan-500', ehMigracao);
    btnSemPermissao?.classList.toggle('ring-2', !ehMigracao);
    btnSemPermissao?.classList.toggle('ring-red-500', !ehMigracao);

    if (chkSaida && !chkSaida.checked) chkSaida.disabled = !ehMigracao;
    if (chkExpulsao && !chkExpulsao.checked) chkExpulsao.disabled = ehMigracao;
    if (chkMedal && !chkMedal.checked) chkMedal.disabled = ehMigracao;
    if (chkMp && !chkMp.checked) chkMp.disabled = ehMigracao;
    verificarProgressoAba('outros');
};

window.postarSaidaConflito = function (btn, idx) {
    const dados = obterDadosCardConflito(idx);
    if (!dados) return;
    const codigo = criarBBCode('SAÍDA', {
        Nickname: dados.nick,
        Cargo: dados.cargo,
        Permissão: 'Conselho da Segurança',
        Motivo: 'Sem vínculo.',
        Data: obterDataMedalha()
    });
    postarAcao(btn, encodeURIComponent(codigo), ID_TOPICO_FORUM, `chk-saida-conflito-${idx}`);
};

window.postarExpulsaoConflito = function (btn, idx) {
    const dados = obterDadosCardConflito(idx);
    if (!dados) return;
    const codigo = criarBBCode('EXPULSÃO', {
        Nickname: dados.nick,
        Cargo: dados.cargo,
        Permissão: 'Conselho da Segurança',
        Motivo: 'Saída sem permissão.',
        Data: obterDataMedalha()
    });
    postarAcao(btn, encodeURIComponent(codigo), ID_TOPICO_FORUM, `chk-expulsao-conflito-${idx}`);
};

window.postarCofreConflito = function (btn, idx) {
    const dados = obterDadosCardConflito(idx);
    if (!dados) return;
    const responsavel = localStorage.getItem('nickResponsavel') || localStorage.getItem('verificadorNick') || '';
    if (!responsavel) {
        showToast('Informe seu nickname ao iniciar a verificação antes de postar no cofre.', 'error');
        return;
    }

    const motivo = 'Expulsão do grupo de tarefas.';
    const codigo = criarBBCodeMedalha('expulsao', dados.nick, motivo, responsavel, dados.cargo);
    const chkId = `chk-medal-conflito-${idx}`;
    if (document.getElementById(chkId)?.checked) {
        abrirModalVerificacao(ID_TOPICO_MEDALHA, codigo);
        return;
    }

    btn.dataset.macroData = JSON.stringify({ nick: dados.nick, cargo: dados.cargo, motivo, qtd: -100 });
    abrirModalRevisaoBBCode('Revisar Medalha', codigo, () => {
        fecharModalRevisaoBBCode();
        confirmarPostagemMedalha(btn, codigo, chkId);
    });
};

window.abrirCartaConflito = function (btn, idx) {
    const dados = obterDadosCardConflito(idx);
    if (!dados) return;
    abrirModalMP(dados.nick, 'expulsao', 'Saída sem permissão.', `chk-mp-conflito-${idx}`);
};

function criarCardGrupo(m, idx) {
    const urlAvatar = `https://www.habbo.com.br/habbo-imaging/avatarimage?img_format=png&user=${m.nick}&direction=2&head_direction=3&size=l&headonly=0`;

    return `
    <li id="card-retirar-groups-${idx}" class="card-standard group rounded-2xl overflow-hidden animate-fade-in" style="animation-delay: ${idx * 0.05}s">
        <div class="flex flex-col md:flex-row">
            <div class="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-950/20 p-6 flex flex-col items-center justify-center gap-3 md:w-32 shrink-0 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800">
                <img src="${urlAvatar}" class="w-16 h-24 object-contain drop-shadow-xl transition-transform group-hover:scale-110 duration-500">
                <button type="button" data-action="desconsiderar" onclick="desconsiderarMembro(this, 'retirar-grupos', ${idx})"
                    class="group/trash w-10 h-10 rounded-xl bg-white/60 dark:bg-slate-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-all flex items-center justify-center border border-purple-200 dark:border-purple-800/40 hover:border-red-200 dark:hover:border-red-800 shadow-sm"
                    title="Desconsiderar" aria-label="Desconsiderar membro">
                    <i class="fa-solid fa-trash-can text-sm"></i>
                </button>
            </div>
            <div class="flex-grow p-6">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                    <div class="flex items-center gap-3">
                        <h4 class="font-bold text-xl text-slate-800 dark:text-white">${m.nick}</h4>
                        <span class="text-[10px] px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 font-bold uppercase tracking-wider">
                            <i class="fa-solid fa-triangle-exclamation mr-1.5"></i>${m.cargo && m.cargo !== 'Não consta na listagem' ? 'Cargo Irregular' : 'Não é professor'}
                        </span>
                        ${m.isAdminNoGrupo ? `
                        <span class="text-[10px] px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                            <i class="fa-solid fa-star text-[10px]"></i> ADMIN DO GRUPO
                        </span>` : ''}
                    </div>
                </div>
                ${m.isAdminNoGrupo ? `
                <div class="mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-2.5 shadow-sm">
                    <i class="fa-solid fa-circle-exclamation mt-0.5 shrink-0"></i>
                    <span><strong>Atenção:</strong> Este usuário é administrador do grupo no Habbo. Tenha cautela ao realizar a remoção manual ou ignore se considerar necessário.</span>
                </div>` : ''}
                <p class="text-sm text-slate-500 dark:text-slate-400 mb-5 flex items-center gap-2">
                    <i class="fa-solid fa-circle-info text-slate-400"></i>${m.cargo && m.cargo !== 'Não consta na listagem' ? 'Cargo atual: ' + m.cargo : m.status}
                </p>

                <div class="flex flex-wrap gap-3">
                    ${m.grupos.includes('professores') ? `
                    <label class="checkbox-wrapper flex items-center text-xs font-medium text-slate-600 dark:text-slate-300 bg-purple-50/50 dark:bg-purple-900/10 p-3 rounded-xl cursor-pointer hover:bg-purple-100/50 dark:hover:bg-purple-900/20 transition-all border border-purple-100 dark:border-purple-800/30">
                        <input type="checkbox" id="chk-ret-prof-${idx}">
                        <span class="ml-3"><i class="fa-solid fa-users mr-1.5 text-purple-500"></i>Tirei do Grupo Professores</span>
                    </label>` : ''}
                    ${m.grupos.includes('graduadores') ? `
                    <label class="checkbox-wrapper flex items-center text-xs font-medium text-slate-600 dark:text-slate-300 bg-teal-50/50 dark:bg-teal-900/10 p-3 rounded-xl cursor-pointer hover:bg-teal-100/50 dark:hover:bg-teal-900/20 transition-all border border-teal-100 dark:border-teal-800/30">
                        <input type="checkbox" id="chk-ret-grad-${idx}">
                        <span class="ml-3"><i class="fa-solid fa-user-group mr-1.5 text-teal-500"></i>Tirei do Grupo Graduadores</span>
                    </label>` : ''}
                </div>
            </div>
        </div>
    </li>`;
}

function criarCardMembro(m, idx, tipo) {
    const urlAvatar = `https://www.habbo.com.br/habbo-imaging/avatarimage?img_format=png&user=${m.nick}&direction=2&head_direction=3&size=l&headonly=0`;

    const subgruposBadges = (m.subgruposHabbo || []).map(sg => {
        let styleClass = '';
        let icon = '';
        if (sg === 'SPP') {
            styleClass = 'bg-[#2e1065] text-white border border-purple-900/50';
            icon = 'fa-shield-cat text-purple-300';
        } else if (sg === 'Dep. Aplicação') {
            styleClass = 'bg-[#581c87] text-[#facc15] border border-[#facc15]/30';
            icon = 'fa-book-open text-[#facc15]';
        } else if (sg === 'CDC') {
            styleClass = 'bg-[#d8b4fe] text-[#4c1d95] border border-[#c084fc]/50';
            icon = 'fa-palette text-[#6b21a8]';
        }
        return `<span class="${styleClass} px-2.5 py-1 rounded text-[10px] uppercase font-bold flex items-center gap-1.5 shadow-sm"><i class="fa-solid ${icon}"></i>${sg}</span>`;
    }).join('');

    let badgeAdmin = '';
    let avisoAdmin = '';

    if (m.isAdminNoGrupo) {
        badgeAdmin = `
            <span class="text-[10px] px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                <i class="fa-solid fa-star text-[10px]"></i> ADMIN DO GRUPO
            </span>`;
        avisoAdmin = `
            <div class="mb-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-2.5 shadow-sm">
                <i class="fa-solid fa-circle-exclamation mt-0.5 shrink-0"></i>
                <span><strong>Aviso de Segurança:</strong> Este usuário possui cargo de Administrador no grupo do Habbo. Recomenda-se cautela extra.</span>
            </div>`;
    }

    let badgeStatus = '';
    let tipoAcao = 'rebaixamento';

    if (tipo === 'inativos') {
        badgeStatus = `<a href="https://system.policercc.com.br/perfil/${encodeURIComponent(m.nick)}" target="_blank" rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-700 transition-all hover:border-indigo-400 hover:bg-indigo-100 dark:border-indigo-800/70 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:border-indigo-600 dark:hover:bg-indigo-900/40"
            title="Abrir o perfil no RCCSystem para confirmar a inatividade">
            <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i> Conferir no System
        </a>`;
    }

    if (tipo === 'graduacao') {
        const diasPendentes = Number.isFinite(m.dias) ? m.dias : 0;
        const diasAtraso = Number.isFinite(m.diasAtraso) ? m.diasAtraso : Math.max(0, diasPendentes - 7);
        const textoAtraso = `${diasAtraso} ${diasAtraso === 1 ? 'dia' : 'dias'} após o prazo`;
        const tipoGraduacao = m.tipo === 'expulsao' ? 'Expulsão' : 'Rebaixamento';
        badgeStatus = `<span class="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">${tipoGraduacao} · ${textoAtraso}</span>`;
        tipoAcao = m.tipo;
    }
    if (tipo === 'offline') {
        let tempoOffline = `${m.dias}d`;
        let acessoInfo = '';
        if (m.ultimoAcesso) {
            const dataAcesso = new Date(m.ultimoAcesso);
            const diffMs = Date.now() - dataAcesso.getTime();
            const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHoras = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            tempoOffline = diffHoras > 0 ? `${diffDias}d ${diffHoras}h` : `${diffDias}d`;
            const dia = dataAcesso.getDate().toString().padStart(2, '0');
            const mesNum = (dataAcesso.getMonth() + 1).toString().padStart(2, '0');
            const hora = dataAcesso.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            acessoInfo = `<div class="h-4 w-px bg-purple-500/20"></div>
                <div class="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <i class="fa-regular fa-calendar text-purple-500/50 text-[9px]"></i>
                    <span>${dia}/${mesNum} às ${hora}</span>
                </div>`;
        }
        badgeStatus = `<div class="inline-flex items-center gap-2.5 bg-purple-950/40 dark:bg-purple-950/30 pl-1 pr-3 py-1 rounded-full border border-purple-500/20">
            <span class="bg-purple-500/20 text-purple-400 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wide"><i class="fa-solid fa-clock-rotate-left mr-1 text-[8px]"></i>${tempoOffline}</span>
            ${acessoInfo}
        </div>`;
        const ehProfessor = m.cargo.toLowerCase().includes('professor') && !m.cargo.toLowerCase().includes('geral');
        tipoAcao = ehProfessor ? 'expulsao' : 'rebaixamento';
    }
    if (tipo === 'perfil-irregular') {
        const ehProfessor = m.cargo.toLowerCase().includes('professor') && !m.cargo.toLowerCase().includes('geral');
        tipoAcao = ehProfessor ? 'expulsao' : 'rebaixamento';
        if (m.situacao === 'sem-aviso') {
            badgeStatus = '<span class="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider"><i class="fa-solid fa-envelope mr-1.5"></i>Aguardando aviso</span>';
        } else if (m.situacao === 'aguardando') {
            badgeStatus = `<span class="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider"><i class="fa-solid fa-hourglass-half mr-1.5"></i>${formatarTempoRestantePerfilIrregular(m.restanteMs)} restantes</span>`;
        } else {
            badgeStatus = `<span class="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider"><i class="fa-solid fa-gavel mr-1.5"></i>${ehProfessor ? 'Expulsão liberada' : 'Rebaixamento liberado'}</span>`;
        }
    }
    if (tipo === 'remover-forum') {
        const subforunsBadges = [];
        if (m.subforuns && m.subforuns.length > 0) {
            m.subforuns.forEach(sub => {
                if (sub === 'professores') {
                    subforunsBadges.push('<span class="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider"><i class="fa-solid fa-chalkboard-user mr-1.5"></i>Professores</span>');
                } else if (sub === 'coordenadores') {
                    subforunsBadges.push('<span class="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider"><i class="fa-solid fa-user-tie mr-1.5"></i>Coordenadores</span>');
                } else if (sub === 'graduadores') {
                    subforunsBadges.push('<span class="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider"><i class="fa-solid fa-graduation-cap mr-1.5"></i>Graduadores</span>');
                }
            });
        }
        badgeStatus = subforunsBadges.length > 0 ? `<div class="flex flex-wrap gap-1.5">${subforunsBadges.join('')}</div>` :
            `<span class="bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                ${m.cargo && m.cargo !== 'Não consta na listagem' ? 'Cargo Irregular' : 'Não é professor'}
             </span>`;
    }

    const mostrarOpcoesTirar = tipo === 'inativos' || tipo === 'offline' || tipo === 'graduacao' || (tipo === 'perfil-irregular' && m.podePunir);
    const nickArgumento = JSON.stringify(m.nick).replace(/"/g, '&quot;');
    const conteudoPerfilAguardando = tipo === 'perfil-irregular' && !m.podePunir ? `
        <p class="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tighter bg-slate-100 dark:bg-slate-800/50 px-2.5 py-1 rounded-full inline-block mb-4 border border-transparent dark:border-slate-800/50">${m.cargo}</p>
        <div class="rounded-2xl border ${m.situacao === 'sem-aviso' ? 'border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/20' : 'border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/20'} p-5">
            <div class="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                <div class="text-left">
                    <h5 class="font-bold ${m.situacao === 'sem-aviso' ? 'text-amber-700 dark:text-amber-300' : 'text-blue-700 dark:text-blue-300'} flex items-center gap-2">
                        <i class="fa-solid ${m.situacao === 'sem-aviso' ? 'fa-user-lock' : 'fa-clock'}"></i>
                        ${m.situacao === 'sem-aviso' ? 'Notificação necessária' : 'Prazo de regularização em andamento'}
                    </h5>
                    <p class="mt-2 text-xs text-slate-600 dark:text-slate-400">${m.situacao === 'sem-aviso'
                        ? 'O último acesso está oculto. Envie a MP de aviso para iniciar oficialmente o prazo de 24 horas.'
                        : `MP enviada em <strong>${formatarDataHoraPerfilIrregular(m.registro.enviadoEm)}</strong>. ${m.registro.ultimaPunicaoEm ? `Última punição em <strong>${formatarDataHoraPerfilIrregular(m.registro.ultimaPunicaoEm)}</strong>. ` : ''}Nova verificação/punição disponível em <strong>${formatarDataHoraPerfilIrregular(m.prazoEm)}</strong>.`}</p>
                </div>
                <div class="flex flex-col sm:flex-row gap-2 shrink-0">
                    <a href="https://www.habbo.com.br/profile/${encodeURIComponent(m.nick)}" target="_blank" rel="noopener noreferrer"
                        class="btn bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i> Conferir perfil
                    </a>
                    ${m.situacao === 'sem-aviso' ? `
                    <button type="button" onclick="abrirModalMPAviso(${nickArgumento}, ${idx})"
                        class="btn bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2">
                        <i class="fa-solid fa-envelope"></i> Enviar MP de aviso
                    </button>
                    <input type="checkbox" id="chk-aviso-perfil-irregular-${idx}" class="hidden">` : ''}
                </div>
            </div>
        </div>` : '';

    const contentHtml = conteudoPerfilAguardando || (tipo === 'remover-forum' ? `
        <p class="text-[11px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded-md inline-block mb-4 border border-slate-200 dark:border-slate-700/50">${m.status || 'Verificar manualmente'}</p>
        <div class="space-y-3">
            ${m.subforuns && m.subforuns.includes('professores') ? `
            <div class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800/40 transition-all hover:bg-slate-100 dark:hover:bg-slate-800/30">
                <label class="checkbox-wrapper flex items-center text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer flex-grow">
                    <input type="checkbox" onchange="registrarCheckbox(this, '${tipo}', '${m.nick}', 'professores', 'remover-prof')" id="chk-remover-prof-${idx}">
                    <span class="ml-3"><i class="fa-solid fa-chalkboard-user mr-1.5 text-purple-500"></i>Removi do Subfórum dos Professores</span>
                </label>
                <a href="https://www.policiarcc.com/g10-professores" target="_blank" class="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center text-purple-500 hover:scale-110 transition-transform">
                    <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                </a>
            </div>` : ''}
            ${m.subforuns && m.subforuns.includes('coordenadores') ? `
            <div class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800/40 transition-all hover:bg-slate-100 dark:hover:bg-slate-800/30">
                <label class="checkbox-wrapper flex items-center text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer flex-grow">
                    <input type="checkbox" onchange="registrarCheckbox(this, '${tipo}', '${m.nick}', 'coordenadores', 'remover-coord')" id="chk-remover-coord-${idx}">
                    <span class="ml-3"><i class="fa-solid fa-user-tie mr-1.5 text-pink-500"></i>Removi do Subfórum dos Coordenadores</span>
                </label>
                <a href="https://www.policiarcc.com/g458-coordenadores-dos-professores" target="_blank" class="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center text-pink-500 hover:scale-110 transition-transform">
                    <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                </a>
            </div>` : ''}
            ${m.subforuns && m.subforuns.includes('graduadores') ? `
            <div class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800/40 transition-all hover:bg-slate-100 dark:hover:bg-slate-800/30">
                <label class="checkbox-wrapper flex items-center text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer flex-grow">
                    <input type="checkbox" onchange="registrarCheckbox(this, '${tipo}', '${m.nick}', 'graduadores', 'remover-grad')" id="chk-remover-grad-${idx}">
                    <span class="ml-3"><i class="fa-solid fa-graduation-cap mr-1.5 text-violet-700"></i>Removi do Subfórum dos Graduadores</span>
                </label>
                <a href="https://www.policiarcc.com/g231-graduadores-dos-professores" target="_blank" class="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center text-violet-700 hover:scale-110 transition-transform">
                    <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                </a>
            </div>` : ''}
        </div>
    ` : `
        <p class="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tighter bg-slate-100 dark:bg-slate-800/50 px-2.5 py-1 rounded-full inline-block mb-4 border border-transparent dark:border-slate-800/50 transition-colors">${m.cargo}</p>

        <div class="space-y-4">

            <div>
                <div class="flex items-center gap-2 mb-2.5">
                    <i class="fa-solid fa-list-check text-slate-400 text-[10px]"></i>
                    <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ações Necessárias</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <label class="checkbox-wrapper flex items-center text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/20 p-2.5 rounded-xl cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all border border-slate-100 dark:border-slate-800/30">
                        <input type="checkbox" onchange="registrarCheckbox(this, '${tipo}', '${m.nick}', '${m.cargo}', 'req')" id="chk-req-${tipo}-${idx}">
                        <span class="ml-2.5">Requerimento</span>
                    </label>
                    ${tipo !== 'inativos' ? `
                    <label class="checkbox-wrapper flex items-center text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/20 p-2.5 rounded-xl cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all border border-slate-100 dark:border-slate-800/30">
                        <input type="checkbox" onchange="registrarCheckbox(this, '${tipo}', '${m.nick}', '${m.cargo}', 'mp')" id="chk-mp-${tipo}-${idx}">
                        <span class="ml-2.5">MP Enviada</span>
                    </label>
                    <label class="checkbox-wrapper flex items-center text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/20 p-2.5 rounded-xl cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/40 transition-all border border-slate-100 dark:border-slate-800/30">
                        <input type="checkbox" onchange="registrarCheckbox(this, '${tipo}', '${m.nick}', '${m.cargo}', 'medal')" id="chk-medal-${tipo}-${idx}">
                        <span class="ml-2.5">Medalha postada</span>
                    </label>` : ''}
                </div>
            </div>


            ${mostrarOpcoesTirar ? `
            <div class="pt-1">
                <div class="flex items-center gap-2 mb-2.5">
                    <i class="fa-solid fa-hotel text-purple-500/60 text-[10px]"></i>
                    <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Grupos do Habbo</span>
                    ${m.noGrupo ? '<span class="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse ml-1"></span>' : ''}
                </div>
                ${m.noGrupo ? `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                    ${tipoAcao === 'expulsao' || tipo === 'inativos' ? `
                        ${m.noProfessores ? `
                        <label class="checkbox-wrapper flex items-center text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-purple-50/50 dark:bg-purple-900/10 p-2.5 rounded-xl cursor-pointer hover:bg-purple-100/50 dark:hover:bg-purple-900/20 transition-all border border-purple-100/30 dark:border-purple-800/30">
                            <input type="checkbox" onchange="registrarCheckbox(this, '${tipo}', '${m.nick}', '${m.cargo}', 'grupo-prof')" id="chk-grupo-prof-${tipo}-${idx}">
                            <span class="ml-2.5"><i class="fa-solid fa-users mr-1 text-purple-500"></i>Tirei de Professores</span>
                        </label>` : `<div class="text-[10px] flex items-center gap-2 p-2.5 text-slate-400 bg-slate-50 dark:bg-slate-800/10 rounded-xl italic border border-dashed border-slate-200 dark:border-slate-800"><i class="fa-solid fa-circle-minus"></i>Não está em Professores</div>`}
                        ${m.noGraduadores ? `
                        <label class="checkbox-wrapper flex items-center text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-teal-50/50 dark:bg-teal-900/10 p-2.5 rounded-xl cursor-pointer hover:bg-teal-100/50 dark:hover:bg-teal-900/20 transition-all border border-teal-100/30 dark:border-teal-800/30">
                            <input type="checkbox" onchange="registrarCheckbox(this, '${tipo}', '${m.nick}', '${m.cargo}', 'grupo-grad')" id="chk-grupo-grad-${tipo}-${idx}">
                            <span class="ml-2.5"><i class="fa-solid fa-user-group mr-1 text-teal-500"></i>Tirei de Graduadores</span>
                        </label>` : `<div class="text-[10px] flex items-center gap-2 p-2.5 text-slate-400 bg-slate-50 dark:bg-slate-800/10 rounded-xl italic border border-dashed border-slate-200 dark:border-slate-800"><i class="fa-solid fa-circle-minus"></i>Não está em Graduadores</div>`}
                    ` : `
                        <div class="text-[11px] p-2.5 bg-emerald-50/30 dark:bg-emerald-950/20 rounded-xl border border-emerald-100/50 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center gap-2.5">
                            <i class="fa-solid fa-circle-check"></i><span>Mantém em Professores</span>
                        </div>
                        ${m.noGraduadores ? `
                        <label class="checkbox-wrapper flex items-center text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-teal-50/50 dark:bg-teal-900/10 p-2.5 rounded-xl cursor-pointer hover:bg-teal-100/50 dark:hover:bg-teal-900/20 transition-all border border-teal-100/30 dark:border-teal-800/30">
                            <input type="checkbox" onchange="registrarCheckbox(this, '${tipo}', '${m.nick}', '${m.cargo}', 'grupo-grad')" id="chk-grupo-grad-${tipo}-${idx}">
                            <span class="ml-2.5"><i class="fa-solid fa-user-group mr-1 text-teal-500"></i>Tirei de Graduadores</span>
                        </label>` : `<div class="text-[10px] flex items-center gap-2 p-2.5 text-slate-400 bg-slate-50 dark:bg-slate-800/10 rounded-xl italic border border-dashed border-slate-200 dark:border-slate-800"><i class="fa-solid fa-circle-minus"></i>Não está em Graduadores</div>`}
                    `}
                </div>` : `
                <div class="text-[11px] p-2.5 text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800/50">
                    <i class="fa-solid fa-circle-minus mr-2"></i>Sem grupos associados no Habbo
                </div>`}
            </div>` : ''}


            ${mostrarOpcoesTirar ? `
            <div class="pt-1">
                <div class="flex items-center gap-2 mb-2.5 text-left">
                    <i class="fa-solid fa-users-rectangle text-slate-400 text-[10px]"></i>
                    <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Subfóruns</span>
                    ${m.subforunsDoMembro && m.subforunsDoMembro.length > 0 ? `<span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold ml-1">${m.subforunsDoMembro.length} ativo(s)</span>` : ''}
                </div>
                ${m.subforunsDoMembro && m.subforunsDoMembro.length > 0 ? `
                <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                    ${m.subforunsDoMembro.join('').includes('professores') ? `
                    <label class="checkbox-wrapper flex items-center text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/20 p-2 rounded-lg cursor-pointer hover:bg-purple-100/50 dark:hover:bg-purple-900/20 transition-all border border-slate-200 dark:border-slate-700/50 group">
                        <input type="checkbox" onchange="registrarCheckbox(this, '${tipo}', '${m.nick}', 'professores', 'remover-prof')" id="chk-remover-prof-${tipo}-${idx}">
                        <span class="ml-2 group-hover:text-purple-600">PROFESSORES</span>
                    </label>` : ''}
                    ${m.subforunsDoMembro.join('').includes('coordenadores') ? `
                    <label class="checkbox-wrapper flex items-center text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/20 p-2 rounded-lg cursor-pointer hover:bg-pink-100/50 dark:hover:bg-pink-900/20 transition-all border border-slate-200 dark:border-slate-700/50 group">
                        <input type="checkbox" onchange="registrarCheckbox(this, '${tipo}', '${m.nick}', 'coordenadores', 'remover-coord')" id="chk-remover-coord-${tipo}-${idx}">
                        <span class="ml-2 group-hover:text-pink-600">COORDENADORES</span>
                    </label>` : ''}
                    ${m.subforunsDoMembro.join('').includes('graduadores') ? `
                    <label class="checkbox-wrapper flex items-center text-[10px] font-bold text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/20 p-2 rounded-lg cursor-pointer hover:bg-violet-100/50 dark:hover:bg-violet-900/20 transition-all border border-slate-200 dark:border-slate-700/50 group">
                        <input type="checkbox" onchange="registrarCheckbox(this, '${tipo}', '${m.nick}', 'graduadores', 'remover-grad')" id="chk-remover-grad-${tipo}-${idx}">
                        <span class="ml-2 group-hover:text-violet-700">GRADUADORES</span>
                    </label>` : ''}
                </div>` : `
                <div class="text-[11px] p-2.5 text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800/50">
                    <i class="fa-solid fa-circle-minus mr-2"></i>Sem subfóruns registrados
                </div>`}
            </div>` : ''}


            ${m.subgruposHabbo && m.subgruposHabbo.length > 0 && (tipo === 'inativos' || tipoAcao === 'expulsao') ? `
            <div class="pt-1">
                <div class="flex items-center gap-2 mb-2.5">
                    <i class="fa-solid fa-bullhorn text-amber-500/80 text-[10px]"></i>
                    <span class="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest">Subgrupos (Avisar Liderança)</span>
                </div>
                <div class="flex flex-wrap gap-2">
                     ${subgruposBadges}
                </div>
            </div>` : ''}
        </div>
    `);

    return `
    <div id="card-${tipo}-${idx}" data-aguardando="${tipo === 'perfil-irregular' && m.situacao === 'aguardando'}" class="card-standard group relative rounded-2xl overflow-hidden p-6 animate-fade-in transition-opacity" style="animation-delay: ${idx * 0.05}s">
        <div class="flex flex-col md:flex-row gap-6 items-center md:items-start">
            <div class="relative shrink-0 flex flex-col items-center gap-4">
                <div class="w-20 h-20 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-center overflow-hidden transition-all group-hover:border-primary/30 avatar-glow relative">
                    <img src="${urlAvatar}" alt="${m.nick}" class="object-contain -mt-2 drop-shadow-lg transition-transform group-hover:scale-110 duration-500">
                </div>
                <button type="button" data-action="desconsiderar" aria-label="Desconsiderar membro" onclick="desconsiderarMembro(this, '${tipo}', ${idx})"
                    class="group/trash w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-all flex items-center justify-center border border-slate-100 dark:border-slate-800 hover:border-red-200 dark:hover:border-red-800 shadow-sm"
                    title="Desconsiderar">
                    <i class="fa-solid fa-trash-can text-sm group-hover/trash:shake transition-transform"></i>
                </button>
            </div>

            <div class="flex-grow text-center md:text-left w-full">
                <div class="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                    <div class="flex flex-wrap items-center gap-3">
                        <h4 class="font-bold text-2xl text-slate-800 dark:text-white tracking-tight">${m.nick}</h4>
                        ${badgeAdmin}
                    </div>
                    ${badgeStatus}
                </div>

                ${avisoAdmin}

                ${contentHtml}
            </div>
        </div>
    </div>`;
}

function alternarCarregamento(ativo) {
    const containerVerificar = document.getElementById('container-verificar');
    if (ativo) {
        carregador.classList.remove('hidden');
        containerResultados.classList.add('hidden');
        if (containerVerificar) containerVerificar.classList.add('hidden');
        botaoVerificar.disabled = true;
        botaoVerificar.classList.add('opacity-70');
    } else {
        carregador.classList.add('hidden');
        if (containerVerificar) containerVerificar.classList.remove('hidden');
        botaoVerificar.disabled = false;
        botaoVerificar.classList.remove('opacity-70');
    }
}

function obterAcao(cargo) {
    const indiceCargoAtual = HIERARQUIA.findIndex(rank => cargo.toLowerCase().includes(rank.toLowerCase()));
    if (indiceCargoAtual === -1 || indiceCargoAtual === HIERARQUIA.length - 1) {
        return { nome: 'EXPULSÃO', novoCargo: null, tipo: 'expulsao' };
    }
    const novoCargo = HIERARQUIA[indiceCargoAtual + 1];
    return { nome: 'REBAIXAMENTO', novoCargo: novoCargo, tipo: 'rebaixamento' };
}

function criarBBCode(titulo, campos) {
    const codigo = criarBBCodeOriginal(titulo, campos);
    window.FluxoFiscalizacao.registrar(codigo, titulo, campos);
    return codigo;
}

function criarBBCodeOriginal(titulo, campos) {
    const tituloUpper = (titulo || '').trim().toUpperCase();
    const nick = campos["Nickname"] || "";
    const motivo = campos["Motivo"] || "";
    const data = campos["Data"] || obterDataMedalha();

    if (tituloUpper === "SAÍDA" || tituloUpper === "SAIDA") {
        const cargo = campos["Cargo"] || "";
        const permissao = campos["Permissão"] || "Conselho da Segurança";
        return `[table  style="width: max-content; min-width: 420px; max-width: 100%; margin: 10% auto 0 auto; border: none!important; position: relative; border-radius: 14px; box-sizing: border-box;" bgcolor="#2C1830"][tr style="border: none!important"][td style="border: none!important; padding: 0; position: relative; overflow: visible"][table  style="width: 100%; border: none!important; border-radius: 14px; overflow: hidden; position: relative; box-sizing: border-box;" bgcolor="#2C1830"][tr style="border: none!important"][td style="border: none!important; padding: 0; position: relative; overflow: hidden"][table  style="width: auto; height: auto; border: none!important; position: absolute; top: -20px; right: -65px; z-index: 1; overflow: visible; opacity: 0.22; display: inline-block;"][tr style="border: none!important"][td style="border: none!important; padding: 0; line-height: 1; transform: rotate(-25deg)"]<img src="https://2img.net/i.imgur.com/D1mUb7O.png" style="width:230px;height:auto;display:block;" alt="D1mUb7O.png" />[/td][/tr][/table][table  style="width: 100%; border: none!important; border-collapse: collapse; position: relative; z-index: 2; RCC - SÓ A VERDADEIRA: transparent; box-sizing: border-box;"][tr style="border: none!important"][td style="border: none!important; padding: clamp(20px, 6vw, 28px) clamp(14px, 4vw, 18px) clamp(14px, 4vw, 18px) clamp(14px, 4vw, 18px); color: #E7DCEA; font-family: 'Nunito', Arial, sans-serif; font-size: clamp(12.5px, 3.2vw, 14px); line-height: 1.7em; text-align: justify; box-sizing: border-box; white-space: nowrap"]<i class="ph ph-user" style="color:#B896C4;font-size:16px;"></i> [b][color=#FFFFFF]${nick}[/color][/b]
<i class="ti ti-id-badge-2" style="color:#B896C4;font-size:16px;"></i> ${cargo}
<i class="ph ph-key" style="color:#B896C4;font-size:16px;"></i> ${permissao}
<i class="ph ph-chat-dots" style="color:#B896C4;font-size:16px;"></i> ${motivo}
<i class="ph ph-calendar-blank" style="color:#B896C4;font-size:16px;"></i> ${data}[/td][/tr][/table][/td][/tr][/table][table  style="width: auto; border: none!important; border-radius: 20px; overflow: hidden; position: absolute; top: -14px; left: 16px; z-index: 5;" bgcolor="#A22CA9"][tr style="border: none!important"][td style="border: none!important; padding: 6px 16px 6px 12px; white-space: nowrap; vertical-align: middle; font-family: 'Syne', sans-serif;"][size=14][color=#FFFFFF]<i class="ph-fill ph-sign-out"></i> [b]SAÍDA[/b][/color][/size][/td][/tr][/table][/td][/tr][/table]`;
    }

    if (tituloUpper === "EXPULSÃO" || tituloUpper === "EXPULSAO") {
        const cargo = campos["Cargo"] || campos["Cargo atual"] || "";
        const permissao = campos["Permissão"] || "Conselho da Segurança";
        return `[table  style="width: max-content; min-width: 420px; max-width: 100%; margin: 10% auto 0 auto; border: none!important; position: relative; border-radius: 14px; box-sizing: border-box;" bgcolor="#2C1830"][tr style="border: none!important"][td style="border: none!important; padding: 0; position: relative; overflow: visible"][table  style="width: 100%; border: none!important; border-radius: 14px; overflow: hidden; position: relative; box-sizing: border-box;" bgcolor="#2C1830"][tr style="border: none!important"][td style="border: none!important; padding: 0; position: relative; overflow: hidden"][table  style="width: auto; height: auto; border: none!important; position: absolute; top: -20px; right: -65px; z-index: 1; overflow: visible; opacity: 0.22; display: inline-block;"][tr style="border: none!important"][td style="border: none!important; padding: 0; line-height: 1; transform: rotate(-25deg)"]<img src="https://2img.net/i.imgur.com/D1mUb7O.png" style="width:230px;height:auto;display:block;" alt="D1mUb7O.png" />[/td][/tr][/table][table  style="width: 100%; border: none!important; border-collapse: collapse; position: relative; z-index: 2; RCC - SÓ A VERDADEIRA: transparent; box-sizing: border-box;"][tr style="border: none!important"][td style="border: none!important; padding: clamp(20px, 6vw, 28px) clamp(14px, 4vw, 18px) clamp(14px, 4vw, 18px) clamp(14px, 4vw, 18px); color: #E7DCEA; font-family: 'Nunito', Arial, sans-serif; font-size: clamp(12.5px, 3.2vw, 14px); line-height: 1.7em; text-align: justify; box-sizing: border-box; white-space: nowrap"]<i class="ph ph-user" style="color:#B896C4;font-size:16px;"></i> [b][color=#FFFFFF]${nick}[/color][/b]
<i class="ti ti-id-badge-2" style="color:#B896C4;font-size:16px;"></i> ${cargo}
<i class="ph ph-key" style="color:#B896C4;font-size:16px;"></i> ${permissao}
<i class="ph ph-chat-dots" style="color:#B896C4;font-size:16px;"></i> ${motivo}
<i class="ph ph-calendar-blank" style="color:#B896C4;font-size:16px;"></i> ${data}[/td][/tr][/table][/td][/tr][/table][table  style="width: auto; border: none!important; border-radius: 20px; overflow: hidden; position: absolute; top: -14px; left: 16px; z-index: 5;" bgcolor="#A22CA9"][tr style="border: none!important"][td style="border: none!important; padding: 6px 16px 6px 12px; white-space: nowrap; vertical-align: middle; font-family: 'Syne', sans-serif;"][size=14][color=#FFFFFF]<i class="ph-fill ph-user-minus"></i> [b]EXPULSÃO[/b][/color][/size][/td][/tr][/table][/td][/tr][/table]`;
    }

    if (tituloUpper.startsWith("REBAIXAMENTO")) {
        const cargoAtual = campos["Cargo atual"] || campos["Cargo"] || "";
        const novoCargo = campos["Novo cargo"];
        const cargoTexto = novoCargo ? `${cargoAtual} [color=#8C6B94]›[/color] ${novoCargo}` : cargoAtual;
        return `[table  style="width: max-content; min-width: 420px; max-width: 100%; margin: 10% auto 0 auto; border: none!important; position: relative; border-radius: 14px; box-sizing: border-box;" bgcolor="#2C1830"][tr style="border: none!important"][td style="border: none!important; padding: 0; position: relative; overflow: visible"][table  style="width: 100%; border: none!important; border-radius: 14px; overflow: hidden; position: relative; box-sizing: border-box;" bgcolor="#2C1830"][tr style="border: none!important"][td style="border: none!important; padding: 0; position: relative; overflow: hidden"][table  style="width: auto; height: auto; border: none!important; position: absolute; top: -20px; right: -65px; z-index: 1; overflow: visible; opacity: 0.22; display: inline-block;"][tr style="border: none!important"][td style="border: none!important; padding: 0; line-height: 1; transform: rotate(-25deg)"]<img src="https://2img.net/i.imgur.com/D1mUb7O.png" style="width:230px;height:auto;display:block;" alt="D1mUb7O.png" />[/td][/tr][/table][table  style="width: 100%; border: none!important; border-collapse: collapse; position: relative; z-index: 2; RCC - SÓ A VERDADEIRA: transparent; box-sizing: border-box;"][tr style="border: none!important"][td style="border: none!important; padding: clamp(20px, 6vw, 28px) clamp(14px, 4vw, 18px) clamp(14px, 4vw, 18px) clamp(14px, 4vw, 18px); color: #E7DCEA; font-family: 'Nunito', Arial, sans-serif; font-size: clamp(12.5px, 3.2vw, 14px); line-height: 1.7em; text-align: justify; box-sizing: border-box; white-space: nowrap"]<i class="ph ph-user" style="color:#B896C4;font-size:16px;"></i> [b][color=#FFFFFF]${nick}[/color][/b]
<i class="ti ti-id-badge-2" style="color:#B896C4;font-size:16px;"></i> ${cargoTexto}
<i class="ph ph-chat-dots" style="color:#B896C4;font-size:16px;"></i> ${motivo}
<i class="ph ph-calendar-blank" style="color:#B896C4;font-size:16px;"></i> ${data}[/td][/tr][/table][/td][/tr][/table][table  style="width: auto; border: none!important; border-radius: 20px; overflow: hidden; position: absolute; top: -14px; left: 16px; z-index: 5;" bgcolor="#A22CA9"][tr style="border: none!important"][td style="border: none!important; padding: 6px 16px 6px 12px; white-space: nowrap; vertical-align: middle; font-family: 'Syne', sans-serif;"][size=14][color=#FFFFFF]<i class="ph-fill ph-trend-down"></i> [b]REBAIXAMENTO[/b][/color][/size][/td][/tr][/table][/td][/tr][/table]`;
    }

    return '';
}

function criarBBCodeMedalha(tipo, nickMembro, motivo, nickResponsavel, cargoAlvo) {
    const quantidadeMedalha = (tipo === 'expulsao') ? '(-100)' : '(-50)';
    return `[font=Poppins][color=#004d1a][b][size=17]✗ DADOS DO RESPONSÁVEL[/size][/b][/color]

[b]Nickname:[/b] ${nickResponsavel}
[b]Grupo de tarefas:[/b] Professores
[b]Cargo referente:[/b] ${cargoAlvo}

[color=#004d1a][b][size=17]✗ MEDALHAS ATRIBUÍDAS[/size][/b][/color]

[b]Período de referência:[/b] ${obterDataMedalha()}
[b]Policiais:[/b] ${nickMembro}
[b]Número de medalhas:[/b] [color=red]${quantidadeMedalha}[/color]

[b]Motivo:[/b] ${motivo}[/font]`;
}

function agruparMembros(lista, tipoModal) {
    const grupos = {};
    const hoje = obterDataMedalha();

    lista.forEach((m, idx) => {
        let dadosAcao = { nome: '', novoCargo: null, tipo: null };
        let motivo = '';
        let acaoNome = '';
        const campos = {};

        if (tipoModal === 'req-inativos') {
            acaoNome = 'SAÍDA';
            motivo = "Sem vínculo.";
            campos["Nickname"] = m.nick;
            campos["Cargo"] = m.cargo;
            campos["Permissão"] = "Conselho da Segurança";
            campos["Motivo"] = motivo;
            campos["Data"] = hoje;
        } else {
            dadosAcao = obterAcao(m.cargo);
            acaoNome = dadosAcao.nome;
            motivo = tipoModal === 'req-grad'
                ? "Não realizou a graduação no prazo"
                : tipoModal === 'actions-perfil-irregular'
                    ? "Permanência com a visibilidade do perfil desativada após notificação"
                    : "Limite de dias offline";

            if (acaoNome === 'EXPULSÃO') {
                campos["Nickname"] = m.nick;
                campos["Cargo"] = m.cargo;
                campos["Motivo"] = motivo;
                campos["Permissão"] = "Conselho da Segurança";
                campos["Data"] = hoje;
            } else {
                campos["Nickname"] = m.nick;
                campos["Cargo atual"] = m.cargo;
                if (dadosAcao.novoCargo) campos["Novo cargo"] = dadosAcao.novoCargo;
                campos["Motivo"] = motivo;
                campos["Data"] = hoje;
            }
        }

        const chave = `${acaoNome}-${motivo}-${m.cargo}-${dadosAcao.novoCargo || ''}`;

        if (!grupos[chave]) {
            grupos[chave] = {
                membros: [],
                indices: [],
                camposBase: { ...campos },
                acaoNome: acaoNome,
                tipoAcao: dadosAcao.tipo || (tipoModal === 'req-inativos' ? 'saida' : ''),
                motivoMedalha: (dadosAcao.tipo === 'expulsao' || acaoNome === 'EXPULSÃO') ? "Expulsão do grupo de tarefas." : "Infração cometida no grupo de tarefas.",
                motivoReq: motivo,
                cargoOriginal: m.cargo
            };
        }
        grupos[chave].membros.push(m);
        grupos[chave].indices.push(idx);
    });
    return grupos;
}

function agruparMembrosComIdx(lista, tipoModal) {
    const grupos = {};
    const hoje = obterDataMedalha();

    lista.forEach(m => {
        const idx = m._idx;
        let dadosAcao = { nome: '', novoCargo: null, tipo: null };
        let motivo = '';
        let acaoNome = '';
        const campos = {};

        if (tipoModal === 'req-inativos') {
            acaoNome = 'SAÍDA';
            motivo = "Sem vínculo.";
            campos["Nickname"] = m.nick;
            campos["Cargo"] = m.cargo;
            campos["Permissão"] = "Conselho da Segurança";
            campos["Motivo"] = motivo;
            campos["Data"] = hoje;
        } else {
            dadosAcao = obterAcao(m.cargo);
            acaoNome = dadosAcao.nome;
            motivo = tipoModal === 'req-grad'
                ? "Não realizou a graduação no prazo"
                : tipoModal === 'actions-perfil-irregular'
                    ? "Permanência com a visibilidade do perfil desativada após notificação"
                    : "Limite de dias offline";

            if (acaoNome === 'EXPULSÃO') {
                campos["Nickname"] = m.nick;
                campos["Cargo"] = m.cargo;
                campos["Motivo"] = motivo;
                campos["Permissão"] = "Conselho da Segurança";
                campos["Data"] = hoje;
            } else {
                campos["Nickname"] = m.nick;
                campos["Cargo atual"] = m.cargo;
                if (dadosAcao.novoCargo) campos["Novo cargo"] = dadosAcao.novoCargo;
                campos["Motivo"] = motivo;
                campos["Data"] = hoje;
            }
        }

        const chave = `${acaoNome}-${motivo}-${m.cargo}-${dadosAcao.novoCargo || ''}`;

        if (!grupos[chave]) {
            grupos[chave] = {
                membros: [],
                indices: [],
                camposBase: { ...campos },
                acaoNome: acaoNome,
                tipoAcao: dadosAcao.tipo || (tipoModal === 'req-inativos' ? 'saida' : ''),
                motivoMedalha: (dadosAcao.tipo === 'expulsao' || acaoNome === 'EXPULSÃO') ? "Expulsão do grupo de tarefas." : "Infração cometida no grupo de tarefas.",
                motivoReq: motivo,
                cargoOriginal: m.cargo
            };
        }
        grupos[chave].membros.push(m);
        grupos[chave].indices.push(idx);
    });
    return grupos;
}

let filaMPLote = [];
let indexFilaMP = -1;

function abrirModal(tipo) {
    sobreposicaoModal.classList.remove('hidden');
    setTimeout(() => {
        fundoModal.classList.remove('opacity-0');
        painelModal.classList.remove('scale-95', 'opacity-0');
        painelModal.classList.add('scale-100', 'opacity-100');
    }, 10);

    const hoje = obterDataMedalha();
    let conteudoHTML = '';
    let listaFonte = [];
    let prefixoId = '';

    if (tipo === 'req-inativos') {
        listaFonte = membrosInativos.map((m, i) => ({ ...m, _idx: i }));
        prefixoId = 'req-inativos';
    } else if (tipo === 'req-grad') {
        listaFonte = graduacoesPendentes.map((m, i) => ({ ...m, _idx: i }));
        prefixoId = 'req-graduacao';
    } else if (tipo === 'actions-offline') {
        listaFonte = membrosOffline.map((m, i) => ({ ...m, _idx: i }));
        prefixoId = 'req-offline';
    } else if (tipo === 'actions-perfil-irregular') {
        listaFonte = membrosPerfilIrregular.map((m, i) => ({ ...m, _idx: i })).filter(m => m.podePunir);
        prefixoId = 'req-perfil-irregular';
    }

    const tipoCard = tipo === 'req-inativos'
        ? 'inativos'
        : tipo === 'req-grad'
            ? 'graduacao'
            : tipo === 'actions-perfil-irregular' ? 'perfil-irregular' : 'offline';
    listaFonte = listaFonte.filter(m => {
        const card = document.getElementById(`card-${tipoCard}-${m._idx}`);
        return !card || !card.classList.contains('opacity-40');
    });

    if (listaFonte.length === 0) {
        showToast('Nenhum membro para processar (todos foram desconsiderados ou já processados).', 'error');
        fecharModal();
        return;
    }

    if (tipo !== 'req-inativos') {
        conteudoHTML += `
                <div class="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 mb-6">
                    <label class="block text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase mb-2">Responsável pela Postagem</label>
                    <input type="text" id="nick-responsavel" value="${localStorage.getItem('nickResponsavel') || ''}" onchange="localStorage.setItem('nickResponsavel', this.value)" class="w-full bg-white dark:bg-[#1e293b] border border-slate-300 dark:border-slate-600 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Digite seu nickname aqui (será salvo automaticamente)...">
                </div>`;
    }

    const grupos = agruparMembrosComIdx(listaFonte, tipo);
    let coletivaHTML = '';
    Object.values(grupos).forEach(g => {
        if (g.membros.length > 1) {
            const nicks = g.membros.map(m => m.nick).join(' / ');
            const camposLote = { ...g.camposBase, Nickname: nicks };
            const bbcodeLote = criarBBCode(g.acaoNome, camposLote);
            const idsReq = g.indices.map(idx => `chk-${prefixoId}-${idx}`).join(',');
            const idsMedalPrefix = prefixoId === 'req-graduacao'
                ? 'graduacao'
                : prefixoId === 'req-offline'
                    ? 'offline'
                    : prefixoId === 'req-perfil-irregular' ? 'perfil-irregular' : '';
            const idsMedal = g.indices.map(idx => `chk-medal-${idsMedalPrefix}-${idx}`).join(',');

            const mpsData = g.membros.map((m, idx) => ({
                nick: m.nick,
                tipo: g.tipoAcao,
                motivo: g.motivoReq,
                chkId: `chk-mp-${prefixoId.replace('req-', '')}-${g.indices[idx]}`
            }));

            const todosReqFeitos = g.indices.every(idx => document.getElementById(`chk-${prefixoId}-${idx}`)?.checked);
            const todosMedalFeitos = g.indices.every(idx => document.getElementById(`chk-medal-${idsMedalPrefix}-${idx}`)?.checked);
            const todasMPsFeitas = g.indices.every(idx => document.getElementById(`chk-mp-${prefixoId.replace('req-', '')}-${idx}`)?.checked);

            coletivaHTML += `
                        <div class="bg-purple-50 dark:bg-purple-900/10 p-5 rounded-2xl border-2 border-purple-200 dark:border-purple-800/50 mb-8 shadow-sm">
                            <div class="flex justify-between items-center mb-4">
                                <h4 class="font-bold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                                    <i class="fa-solid fa-users-viewfinder"></i> Postagem Coletiva (${g.membros.length} membros)
                                </h4>
                                <span class="bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-200 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">${g.acaoNome}</span>
                            </div>
                            <div class="bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-purple-100 dark:border-purple-800/30 mb-4">
                                <p class="text-[11px] text-slate-500 dark:text-slate-400 mb-1 font-semibold uppercase">Membros do lote:</p>
                                <p class="text-sm font-medium text-slate-700 dark:text-slate-200">${nicks}</p>
                            </div>
                            <div class="flex flex-col md:flex-row gap-3">
                                <button class="btn ${todosReqFeitos ? 'bg-green-600' : 'bg-purple-600 hover:bg-purple-700'} text-white flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
                                    ${todosReqFeitos ? 'disabled' : ''}
                                    onclick="postarAcao(this, '${encodeURIComponent(bbcodeLote).replace(/'/g, '%27')}', '${ID_TOPICO_FORUM}', '${idsReq}')">
                                    <i class="fa-solid ${todosReqFeitos ? 'fa-check' : 'fa-file-signature'}"></i> ${todosReqFeitos ? 'Requerimentos Postados' : 'Postar Requerimentos'}
                                </button>
                                ${g.tipoAcao && g.tipoAcao !== 'saida' ? `
                                <button class="btn ${todosMedalFeitos ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'} text-white flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                                    ${todosMedalFeitos ? 'disabled' : ''}
                                    onclick="postarMedalha(this, '${nicks}', '${g.tipoAcao}', '${g.motivoMedalha}', '${g.cargoOriginal}', '${idsMedal},${idsReq}')">
                                    <i class="fa-solid ${todosMedalFeitos ? 'fa-check' : 'fa-medal'}"></i> ${todosMedalFeitos ? 'Medalhas Postadas' : 'Postar Medalhas'}
                                </button>
                                <button class="btn ${todasMPsFeitas ? 'bg-green-600' : 'bg-amber-500 hover:bg-amber-600'} text-white flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                                    ${todasMPsFeitas ? 'disabled' : ''}
                                    onclick="iniciarMPLote(${JSON.stringify(mpsData).replace(/"/g, '&quot;')})">
                                    <i class="fa-solid ${todasMPsFeitas ? 'fa-check' : 'fa-envelopes-bulk'}"></i> ${todasMPsFeitas ? 'MPs Enviadas' : 'Enviar MPs'}
                                </button>` : ''}
                            </div>
                        </div>
                    `;
        }
    });

    if (coletivaHTML) {
        conteudoHTML += `
                    <div class="mb-4">
                        <h5 class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[2px] mb-4 flex items-center gap-2">
                             <div class="h-[1px] flex-grow bg-slate-200 dark:bg-slate-800"></div>
                             OPÇÕES EM LOTE
                             <div class="h-[1px] flex-grow bg-slate-200 dark:bg-slate-800"></div>
                        </h5>
                        ${coletivaHTML}
                        <h5 class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[2px] mt-8 mb-4 flex items-center gap-2">
                             <div class="h-[1px] flex-grow bg-slate-200 dark:bg-slate-800"></div>
                             POSTAGENS INDIVIDUAIS
                             <div class="h-[1px] flex-grow bg-slate-200 dark:bg-slate-800"></div>
                        </h5>
                    </div>
                `;
    }

  function escaparHTML(texto) {
    if (!texto) return '';
    return String(texto)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

    const gerarItem = (m, titulo, bbcode, tipoAcao, motivo, motivoReq, chkId, medalChkId, tipoModal) => {
        const bbCodificado = encodeURIComponent(bbcode).replace(/'/g, '%27');

        const reqFeito = document.getElementById(chkId)?.checked;
        const medalFeita = document.getElementById(medalChkId)?.checked;
        const mpFeita = document.getElementById(chkId?.replace('chk-req-', 'chk-mp-'))?.checked;

        let botoes = `
                    <button class="btn ${reqFeito ? 'bg-green-600 cursor-default' : 'btn-primary'} flex-1 py-2 rounded-lg text-sm flex items-center justify-center gap-2"
                        ${reqFeito ? 'disabled' : ''}
                        onclick="postarAcao(this, '${bbCodificado}', '${ID_TOPICO_FORUM}', '${chkId}')">
                        <i class="fa-solid ${reqFeito ? 'fa-check' : 'fa-paper-plane'}"></i> ${reqFeito ? 'Postado' : 'Postar Requerimento'}
                    </button>`;

        if (tipoAcao) {
            botoes += `
                    <button class="btn ${medalFeita ? 'bg-green-600 cursor-default' : 'bg-purple-600 hover:bg-purple-700'} text-white flex-1 py-2 rounded-lg text-sm flex items-center justify-center gap-2"
                        ${medalFeita ? 'disabled' : ''}
                        onclick="postarMedalha(this, '${m.nick}', '${tipoAcao}', '${motivo}', '${m.cargo}', '${medalChkId}')">
                        <i class="fa-solid ${medalFeita ? 'fa-check' : 'fa-medal'}"></i> ${medalFeita ? 'Postada' : 'Postar Medalha'}
                    </button>`;
        }

        if (tipoModal !== 'req-inativos') {
            const mpChkId = chkId ? chkId.replace('chk-req-', 'chk-mp-') : '';
            botoes += `
                    <button class="btn ${mpFeita ? 'bg-green-600 cursor-default' : 'bg-amber-500 hover:bg-amber-600'} text-white flex-1 py-2 rounded-lg text-sm flex items-center justify-center gap-2"
                        ${mpFeita ? 'disabled' : ''}
                        onclick="abrirModalMP('${m.nick}', '${tipoAcao || 'rebaixamento'}', '${motivoReq}', '${mpChkId}')">
                        <i class="fa-solid ${mpFeita ? 'fa-check' : 'fa-envelope'}"></i> ${mpFeita ? 'Enviada' : 'Enviar MP'}
                    </button>`;
        }

        return `
                <div class="bg-white dark:bg-[#1e293b] p-5 rounded-xl border border-slate-200 dark:border-slate-700 mb-4 shadow-sm">
                    <div class="flex justify-between items-start mb-3">
                        <h4 class="font-bold text-slate-800 dark:text-slate-100">${m.nick}</h4>
                        <span class="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">${titulo}</span>
                    </div>
                    <pre class="bg-slate-50 dark:bg-[#020617] p-3 rounded-lg text-[10px] text-slate-600 dark:text-slate-400 font-mono mb-4 overflow-x-auto border border-slate-200 dark:border-slate-800 custom-scrollbar">${escaparHTML(bbcode)}</pre>
                    <div class="flex flex-col md:flex-row gap-3">${botoes}</div>
                </div>`;
    };

    if (tipo === 'req-inativos') {
        tituloModal.innerHTML = '<i class="fa-solid fa-user-xmark text-rose-500"></i> Postar Saídas';
        listaFonte.forEach(m => {
            const i = m._idx;
            const campos = { "Nickname": m.nick, "Cargo": m.cargo, "Permissão": "Conselho da Segurança", "Motivo": "Sem vínculo.", "Data": hoje };
            conteudoHTML += gerarItem(m, 'SAÍDA', criarBBCode("SAÍDA", campos), null, null, "Sem vínculo.", `chk-req-inativos-${i}`, null, tipo);
        });
    } else if (tipo === 'req-grad') {
        tituloModal.innerHTML = '<i class="fa-solid fa-user-graduate text-purple-500"></i> Postar Punições (Graduação)';
        listaFonte.forEach(m => {
            const i = m._idx;
            const acao = m.tipo === 'expulsao' ? 'EXPULSÃO' : 'REBAIXAMENTO';
            const dadosAcao = obterAcao(m.cargo);
            const campos = {};

            if (acao === 'EXPULSÃO') {
                campos["Nickname"] = m.nick;
                campos["Cargo"] = m.cargo;
                campos["Motivo"] = "Não realizou a graduação no prazo";
                campos["Permissão"] = "Conselho da Segurança";
                campos["Data"] = hoje;
            } else {
                campos["Nickname"] = m.nick;
                campos["Cargo atual"] = m.cargo;
                if (dadosAcao.novoCargo) campos["Novo cargo"] = dadosAcao.novoCargo;
                campos["Motivo"] = "Não realizou a graduação no prazo";
                campos["Data"] = hoje;
            }

            const motivoMedalha = m.tipo === 'expulsao' ? "Expulsão do grupo de tarefas." : "Infração cometida no grupo de tarefas.";
            conteudoHTML += gerarItem(m, acao, criarBBCode(acao, campos), m.tipo, motivoMedalha, campos["Motivo"], `chk-req-graduacao-${i}`, `chk-medal-graduacao-${i}`, tipo);
        });
    } else if (tipo === 'actions-offline') {
        tituloModal.innerHTML = '<i class="fa-solid fa-clock text-amber-500"></i> Postar Ações Offline';
        listaFonte.forEach(m => {
            const i = m._idx;
            const dadosAcao = obterAcao(m.cargo);
            const acao = dadosAcao.nome;
            const campos = {};

            if (acao === 'EXPULSÃO') {
                campos["Nickname"] = m.nick;
                campos["Cargo"] = m.cargo;
                campos["Motivo"] = "Limite de dias offline";
                campos["Permissão"] = "Conselho da Segurança";
                campos["Data"] = hoje;
            } else {
                campos["Nickname"] = m.nick;
                campos["Cargo atual"] = m.cargo;
                if (dadosAcao.novoCargo) campos["Novo cargo"] = dadosAcao.novoCargo;
                campos["Motivo"] = "Limite de dias offline";
                campos["Data"] = hoje;
            }

            const motivoMedalha = dadosAcao.tipo === 'expulsao' ? "Expulsão do grupo de tarefas." : "Infração cometida no grupo de tarefas.";
            conteudoHTML += gerarItem(m, `${acao} (${m.dias}d)`, criarBBCode(acao, campos), dadosAcao.tipo, motivoMedalha, campos["Motivo"], `chk-req-offline-${i}`, `chk-medal-offline-${i}`, tipo);
        });
    } else if (tipo === 'actions-perfil-irregular') {
        tituloModal.innerHTML = '<i class="fa-solid fa-user-lock text-rose-500"></i> Postar Punições (Perfil irregular)';
        listaFonte.forEach(m => {
            const i = m._idx;
            const dadosAcao = obterAcao(m.cargo);
            const acao = dadosAcao.nome;
            const motivo = 'Permanência com a visibilidade do perfil desativada após notificação';
            const campos = { "Nickname": m.nick };

            if (acao === 'EXPULSÃO') {
                campos["Cargo"] = m.cargo;
                campos["Motivo"] = motivo;
                campos["Permissão"] = "Conselho da Segurança";
                campos["Data"] = hoje;
            } else {
                campos["Cargo atual"] = m.cargo;
                if (dadosAcao.novoCargo) campos["Novo cargo"] = dadosAcao.novoCargo;
                campos["Motivo"] = motivo;
                campos["Data"] = hoje;
            }

            const motivoMedalha = dadosAcao.tipo === 'expulsao' ? "Expulsão do grupo de tarefas." : "Infração cometida no grupo de tarefas.";
            conteudoHTML += gerarItem(m, acao, criarBBCode(acao, campos), dadosAcao.tipo, motivoMedalha, motivo, `chk-req-perfil-irregular-${i}`, `chk-medal-perfil-irregular-${i}`, tipo);
        });
    }

    conteudoModal.innerHTML = conteudoHTML;
}

function fecharModal() {
    fundoModal.classList.add('opacity-0');
    painelModal.classList.remove('scale-100', 'opacity-100');
    painelModal.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        sobreposicaoModal.classList.add('hidden');
    }, 300);
}

function exibirModalConfirmacao(topicoId) {
    topicoRedirecionamento = topicoId;
    modalConfirmacao.classList.remove('hidden');
}

function fecharModalConfirmacao() {
    modalConfirmacao.classList.add('hidden');
    topicoRedirecionamento = '';
}

function confirmarERedirecionar() {
    if (topicoRedirecionamento === 'mp') {
        window.open('https://www.policiarcc.com/privmsg?folder=outbox', '_blank');
    } else if (topicoRedirecionamento) {
        window.open(`https://www.policiarcc.com/t${topicoRedirecionamento}-?view=newest`, '_blank');
    }
    fecharModalConfirmacao();
}

function abrirModalRevisaoBBCode(titulo, conteudo, callback) {
    document.getElementById('titulo-revisao-bbcode').innerText = titulo;
    document.getElementById('bbcode-revisao-conteudo').innerText = conteudo;

    const btnConfirmar = document.getElementById('btn-confirmar-postagem');
    const novoBtnConfirmar = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(novoBtnConfirmar, btnConfirmar);

    novoBtnConfirmar.addEventListener('click', callback);

    const modal = document.getElementById('modal-revisao-bbcode');
    const fundo = document.getElementById('fundo-revisao-bbcode');
    const painel = document.getElementById('painel-revisao-bbcode');

    modal.classList.remove('hidden');
    setTimeout(() => {
        fundo.classList.remove('opacity-0');
        painel.classList.remove('scale-95', 'opacity-0');
        painel.classList.add('scale-100', 'opacity-100');
    }, 10);
}

window.fecharModalRevisaoBBCode = function () {
    const modal = document.getElementById('modal-revisao-bbcode');
    const fundo = document.getElementById('fundo-revisao-bbcode');
    const painel = document.getElementById('painel-revisao-bbcode');

    fundo.classList.add('opacity-0');
    painel.classList.remove('scale-100', 'opacity-100');
    painel.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
};

window.postarAcao = function (btn, bbcode, topicoId, chkId) {
    const codigo = decodeURIComponent(bbcode);
    const jaFeito = chkId.split(',').every(id => document.getElementById(id)?.checked);

    if (jaFeito) {
        abrirModalVerificacao(topicoId, codigo);
        return;
    }

    abrirModalRevisaoBBCode('Revisar Requerimento', codigo, () => {
        fecharModalRevisaoBBCode();
        processarPostagem(btn, codigo, topicoId, chkId);
    });
};

function processarPostagem(btnOriginal, codigo, topicoId, chkId) {
    btnOriginal.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btnOriginal.disabled = true;

    $.post("/post", { t: topicoId, message: codigo, mode: "reply", post: 1 })
        .done(() => {
            btnOriginal.innerHTML = '<i class="fa-solid fa-check"></i> Sucesso';
            btnOriginal.className = "btn bg-green-600 text-white flex-1 py-2 rounded-lg text-sm flex items-center justify-center gap-2";
            if (chkId) {
                const ids = chkId.split(',');
                ids.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) { el.checked = true; el.disabled = true; }
                    const matchPerfil = id.match(/^chk-req-perfil-irregular-(\d+)$/);
                    if (matchPerfil) {
                        const membro = membrosPerfilIrregular[Number(matchPerfil[1])];
                        if (membro) registrarPunicaoPerfilIrregular(membro.nick, membro.cargo);
                    }
                });
                atualizarProgressoPorCheckboxId(chkId);
            }
            ativarCooldownGlobal();
            exibirModalConfirmacao(topicoId);
        }).fail(() => {
            btnOriginal.innerHTML = '<i class="fa-solid fa-xmark"></i> Erro';
            btnOriginal.className = "btn bg-red-600 text-white flex-1 py-2 rounded-lg text-sm flex items-center justify-center gap-2";
            setTimeout(() => {
                btnOriginal.disabled = false;
                btnOriginal.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Tentar Novamente';
                btnOriginal.className = "btn btn-primary flex-1 py-2 rounded-lg text-sm flex items-center justify-center gap-2";
            }, 2000);
        });
}

window.iniciarMPLote = function (membros) {
    filaMPLote = membros;
    indexFilaMP = 0;
    document.getElementById('progresso-mp-container').classList.remove('hidden');
    processarProximaMP();
};

function processarProximaMP() {
    if (indexFilaMP >= filaMPLote.length) {
        filaMPLote = [];
        indexFilaMP = -1;
        document.getElementById('progresso-mp-container').classList.add('hidden');
        return;
    }

    const m = filaMPLote[indexFilaMP];
    const total = filaMPLote.length;
    const atual = indexFilaMP + 1;
    const porcentagem = (atual / total) * 100;

    document.getElementById('progresso-mp-texto').innerText = `${atual}/${total}`;
    document.getElementById('progresso-mp-barra').style.width = `${porcentagem}%`;

    abrirModalMP(m.nick, m.tipo, m.motivo, m.chkId);
}

function atualizarListaPerfilIrregular() {
    membrosPerfilIrregular = membrosPerfilIrregular.map(m => ({
        ...m,
        ...obterStatusAvisoPerfilIrregular(m.nick)
    }));

    if (estadoAtualGlobal.resultados) {
        estadoAtualGlobal.resultados.perfisIrregulares = membrosPerfilIrregular.map(m => ({ ...m, _idx: undefined }));
    }

    const lista = document.getElementById('lista-perfil-irregular');
    if (lista) {
        lista.innerHTML = membrosPerfilIrregular.map((m, idx) => criarCardMembro(m, idx, 'perfil-irregular')).join('');
    }

    const possuiPunicao = membrosPerfilIrregular.some(m => m.podePunir);
    const acoes = document.getElementById('acoes-perfil-irregular');
    if (acoes) {
        acoes.classList.toggle('hidden', !possuiPunicao);
        acoes.classList.toggle('flex', possuiPunicao);
    }
    verificarProgressoAba('perfil-irregular');
}

window.abrirModalMPAviso = function (nick, idx) {
    abrirModalMP(
        nick,
        'aviso-perfil',
        'Visibilidade do perfil desativada',
        `chk-aviso-perfil-irregular-${idx}`
    );
};

window.abrirModalMP = function (nick, tipo, motivo, chkId) {
    const jaFeito = chkId && document.getElementById(chkId)?.checked;
    if (jaFeito) {
        abrirModalVerificacao('mp', 'Código de MP indisponível para cópia em modo de verificação.');
        return;
    }

    mpDestinatario.value = nick;
    mpTipo.value = tipo;
    mpMotivo.value = motivo || "Infração";
    mpConsideracoes.value = "";
    mpProva.value = "";
    const ehAvisoPerfil = tipo === 'aviso-perfil';
    mpTipo.disabled = ehAvisoPerfil;
    mpMotivo.readOnly = ehAvisoPerfil;
    mpConsideracoes.closest('div')?.classList.toggle('hidden', ehAvisoPerfil);
    mpProva.closest('div')?.classList.toggle('hidden', ehAvisoPerfil);
    checkboxMPAtual = chkId || '';

    botaoEnviarMP.disabled = false;
    botaoEnviarMP.innerHTML = `<i class="fa-solid fa-paper-plane"></i> ${ehAvisoPerfil ? 'Enviar aviso e iniciar prazo' : 'Enviar MP'}`;
    botaoEnviarMP.className = "w-full btn bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2";

    modalMP.classList.remove('hidden');
    setTimeout(() => {
        fundoModalMP.classList.remove('opacity-0');
        painelModalMP.classList.remove('scale-95', 'opacity-0');
        painelModalMP.classList.add('scale-100', 'opacity-100');
    }, 10);
}

window.fecharModalMP = function () {
    fundoModalMP.classList.add('opacity-0');
    painelModalMP.classList.remove('scale-100', 'opacity-100');
    painelModalMP.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modalMP.classList.add('hidden');
    }, 300);
};

window.enviarMP = function () {
    const nick = mpDestinatario.value;
    const tipo = mpTipo.value;
    const motivo = mpMotivo.value || "Infração";
    const consideracoes = mpConsideracoes.value || "Fundamento";
    const linkProva = mpProva.value || "#";
    const hoje = new Date().toLocaleDateString('pt-BR');

    let template = tipo === 'aviso-perfil'
        ? TEMPLATE_MP_AVISO_PERFIL
        : tipo === 'expulsao' ? TEMPLATE_MP_EXPULSAO : TEMPLATE_MP_REBAIXAMENTO;

    let mensagem = template
        .replace(/{USERNAME}/g, nick)
        .replace(/{MOTIVO}/g, motivo)
        .replace(/{CONSIDERACOES}/g, consideracoes)
        .replace(/{LINK_PROVA}/g, linkProva);

    const assunto = tipo === 'aviso-perfil'
        ? '[PROF] Notificação de irregularidade'
        : `[PROF] Carta de ${tipo === 'expulsao' ? 'Expulsão' : 'Rebaixamento'}`;

    botaoEnviarMP.disabled = true;
    botaoEnviarMP.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

    $.post("/privmsg", {
        "username[]": [nick],
        subject: assunto,
        message: mensagem,
        mode: "post",
        post: 1
    })
        .done(function () {
            botaoEnviarMP.innerHTML = '<i class="fa-solid fa-check"></i> Enviado com Sucesso!';
            botaoEnviarMP.classList.remove('bg-amber-500', 'hover:bg-amber-600');
            botaoEnviarMP.classList.add('bg-green-600', 'hover:bg-green-700');

            if (tipo === 'aviso-perfil') {
                const membro = membrosPerfilIrregular.find(m => normalizarNick(m.nick) === normalizarNick(nick));
                registrarAvisoPerfilIrregular(nick, membro?.cargo || 'Cargo não identificado');
                atualizarListaPerfilIrregular();
            }

            if (checkboxMPAtual) {
                const el = document.getElementById(checkboxMPAtual);
                if (el) {
                    el.checked = true;
                    el.disabled = true;
                }
                atualizarProgressoPorCheckboxId(checkboxMPAtual);
                if (checkboxMPAtual.startsWith('chk-mp-conflito-')) {
                    const idxConflito = checkboxMPAtual.replace('chk-mp-conflito-', '');
                    const btnCarta = document.getElementById(`btn-carta-conflito-${idxConflito}`);
                    if (btnCarta) {
                        btnCarta.disabled = true;
                        btnCarta.className = 'btn bg-green-600 text-white px-4 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2';
                        btnCarta.innerHTML = '<i class="fa-solid fa-check"></i> Carta enviada';
                    }
                }
            }

            agendarSalvamentoEstado();

            ativarCooldownGlobal();

            if (indexFilaMP !== -1 && indexFilaMP < filaMPLote.length - 1) {
                indexFilaMP++;
                botaoEnviarMP.innerHTML = '<i class="fa-solid fa-clock"></i> Aguardando Cooldown (5s)...';
                setTimeout(() => {
                    fecharModalMP();
                    setTimeout(() => processarProximaMP(), 500);
                }, 5000);
            } else {
                setTimeout(() => {
                    fecharModalMP();
                    exibirModalConfirmacao('mp');
                    indexFilaMP = -1;
                    filaMPLote = [];
                    document.getElementById('progresso-mp-container').classList.add('hidden');
                }, 1500);
            }
        })
        .fail(function () {
            botaoEnviarMP.innerHTML = '<i class="fa-solid fa-xmark"></i> Erro ao Enviar';
            botaoEnviarMP.classList.remove('bg-amber-500', 'hover:bg-amber-600');
            botaoEnviarMP.classList.add('bg-red-600', 'hover:bg-red-700');
            setTimeout(() => {
                botaoEnviarMP.disabled = false;
                botaoEnviarMP.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Tentar Novamente';
                botaoEnviarMP.className = "w-full btn bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2";
            }, 2000);
        });
};

window.postarMedalha = function (btn, nick, tipo, motivo, cargo, chkId) {
    const resp = document.getElementById('nick-responsavel').value;
    if (!resp) { showToast('Digite seu nick no topo do modal.', 'error'); return; }

    const codigo = criarBBCodeMedalha(tipo, nick, motivo, resp, cargo);
    const jaFeito = chkId.split(',').every(id => document.getElementById(id)?.checked);

    if (jaFeito) {
        abrirModalVerificacao(ID_TOPICO_MEDALHA, codigo);
        return;
    }


    const qtdMedalhas = (tipo === 'expulsao') ? -100 : -50;
    btn.dataset.macroData = JSON.stringify({ nick, cargo, motivo, qtd: qtdMedalhas });

    abrirModalRevisaoBBCode('Revisar Medalha', codigo, () => {
        fecharModalRevisaoBBCode();
        confirmarPostagemMedalha(btn, codigo, chkId);
    });
};

function abrirModalVerificacao(topicoOuMP, bbcode) {
    const modal = document.getElementById('modal-verificacao-postagem');
    const fundo = document.getElementById('fundo-verificacao-postagem');
    const painel = document.getElementById('painel-verificacao-postagem');
    const link = topicoOuMP === 'mp' ? 'https://www.policiarcc.com/privmsg?folder=outbox' : `https://www.policiarcc.com/t${topicoOuMP}-?view=newest`;

    document.getElementById('bbcode-erro-copia').innerText = bbcode;
    document.getElementById('conteudo-verificacao-normal').classList.remove('hidden');
    document.getElementById('conteudo-verificacao-erro').classList.add('hidden');

    const btnLink = document.getElementById('btn-verificar-link');
    const btnLinkErro = document.getElementById('btn-link-erro');
    const btnCopiar = document.getElementById('btn-copiar-erro');

    btnLink.onclick = () => window.open(link, '_blank');
    btnLinkErro.onclick = () => window.open(link, '_blank');
    btnCopiar.onclick = () => {
        navigator.clipboard.writeText(bbcode);
        btnCopiar.innerHTML = '<i class="fa-solid fa-check"></i> Copiado!';
        setTimeout(() => btnCopiar.innerHTML = '<i class="fa-solid fa-copy"></i> Copiar Código', 2000);
    };

    modal.classList.remove('hidden');
    setTimeout(() => {
        fundo.classList.remove('opacity-0');
        painel.classList.remove('scale-95', 'opacity-0');
        painel.classList.add('scale-100', 'opacity-100');
    }, 10);
}

window.fecharModalVerificacao = function () {
    const modal = document.getElementById('modal-verificacao-postagem');
    const fundo = document.getElementById('fundo-verificacao-postagem');
    const painel = document.getElementById('painel-verificacao-postagem');
    fundo.classList.add('opacity-0');
    painel.classList.remove('scale-100', 'opacity-100');
    painel.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
};

window.exibirErroPostagem = function () {
    document.getElementById('conteudo-verificacao-normal').classList.add('hidden');
    document.getElementById('conteudo-verificacao-erro').classList.remove('hidden');
};

window.voltarVerificacaoNormal = function () {
    document.getElementById('conteudo-verificacao-normal').classList.remove('hidden');
    document.getElementById('conteudo-verificacao-erro').classList.add('hidden');
};


function enviarDadosMacro(nick, cargo, motivo, quantidadeMedalhas) {
    const responsavel = document.getElementById('nick-responsavel').value;
    const periodo = obterDataMedalha();


    const d = new Date();
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const dataFmt = `${d.getDate().toString().padStart(2, '0')} ${meses[d.getMonth()]} ${d.getFullYear()}`;
    const horaFmt = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
    const horarioEnvio = `${dataFmt} ${horaFmt}`;


    const MACRO_URL = "https://script.google.com/macros/s/AKfycbw4EsCXpPs-7ORsxAtcZ4Pul-CaW_01JO0ADw4pwJ9D0PXOxeSMsuCxyxm1WAf1otG9/exec";

    const formData = new FormData();
    formData.append('horario_envio', horarioEnvio);
    formData.append('responsavel_med', responsavel);
    formData.append('grupo_tarefas', 'Professores');
    formData.append('cargo_med', cargo);
    formData.append('periodo_med', periodo);
    formData.append('gratificados_med', nick);
    formData.append('numero_med', quantidadeMedalhas);

    let motivoFinal = motivo;
    if (motivo === 'Cumprimento de meta do cargo de' || motivo === 'Não cumprimento de meta do cargo de') {
        motivoFinal = `${motivo} ${cargo}.`;
    } else {
        motivoFinal = motivo.endsWith('.') ? motivo : `${motivo}.`;
    }
    formData.append('motivo_grat', motivoFinal);

    console.log(`[Macro] Enviando dados para ${nick}...`, Object.fromEntries(formData));

    fetch(MACRO_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: formData
    }).then(() => {
        console.log('[Macro] Dados enviados com sucesso (presumido via no-cors).');

    }).catch(err => {
        console.error('[Macro] Erro ao enviar:', err);

    });
}

function confirmarPostagemMedalha(btnOriginal, codigo, chkId) {
    btnOriginal.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btnOriginal.disabled = true;

    $.post("/post", { t: ID_TOPICO_MEDALHA, message: codigo, mode: "reply", post: 1 })
        .done(() => {
            btnOriginal.innerHTML = '<i class="fa-solid fa-check"></i>';
            btnOriginal.classList.add('bg-green-600');
            if (chkId) {
                const ids = chkId.split(',');
                ids.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) { el.checked = true; el.disabled = true; }
                });
                atualizarProgressoPorCheckboxId(chkId);
            }
            ativarCooldownGlobal();
            exibirModalConfirmacao(ID_TOPICO_MEDALHA);

            if (btnOriginal.dataset.macroData) {
                const data = JSON.parse(btnOriginal.dataset.macroData);
                enviarDadosMacro(data.nick, data.cargo, data.motivo, data.qtd);
            }

        }).fail(() => {
            btnOriginal.innerHTML = '<i class="fa-solid fa-xmark"></i> Erro';
            btnOriginal.className = "btn bg-red-600 text-white flex-1 py-2 rounded-lg text-sm flex items-center justify-center gap-2";
            setTimeout(() => {
                btnOriginal.disabled = false;
                btnOriginal.innerHTML = '<i class="fa-solid fa-medal"></i> Tentar Novamente';
                btnOriginal.className = "btn bg-purple-600 hover:bg-purple-700 text-white flex-1 py-2 rounded-lg text-sm flex items-center justify-center gap-2";
            }, 2000);
        });
}


window.FiscalMotor = { salvarEstadoAtual, agendarSalvamentoEstado, atualizarProgressoPorCheckboxId, abrirModalLogs, TEMPLATE_MP_EXPULSAO, TEMPLATE_MP_REBAIXAMENTO, registrarPunicaoPerfilIrregular, get perfilIrregular(){ return membrosPerfilIrregular; }, setActor(nick){verificadorAtual=nick;localStorage.setItem("verificadorNick",nick);localStorage.setItem("nickResponsavel",nick);}, complete(ids){ids.split(",").forEach(id=>{const el=document.getElementById(id);if(el){el.checked=true;el.disabled=true;}const match=id.match(/^chk-req-perfil-irregular-(\d+)$/);if(match){const m=membrosPerfilIrregular[Number(match[1])];if(m)registrarPunicaoPerfilIrregular(m.nick,m.cargo);}});atualizarProgressoPorCheckboxId(ids);agendarSalvamentoEstado();} };
