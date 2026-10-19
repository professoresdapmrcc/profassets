// 1. CONFIGURAÇÃO DO FIREBASE (Cole suas chaves reais aqui)
const firebaseConfig = {
  apiKey: "AIzaSyDo4DagZchii1cPKFighZU5KAjppp98HJE",
  authDomain: "nexusprof.firebaseapp.com",
  databaseURL: "https://nexusprof-default-rtdb.firebaseio.com",
  projectId: "nexusprof",
  storageBucket: "nexusprof.firebasestorage.app",
  messagingSenderId: "268861178598",
  appId: "1:268861178598:web:9686b81bb003f9514fb127",
  measurementId: "G-MY150DZMTM"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// 2. FUNÇÃO PARA CARREGAR USUÁRIO LOGADO NO FIREBASE
function carregarUsuarioLogado() {
    firebase.auth().onAuthStateChanged(async (user) => {
        const userNameEl = document.getElementById('user-name');
        const userAvatarEl = document.getElementById('user-avatar');

        if (user) {
            // Tenta obter o nome pelo displayName nativo do Firebase Auth
            let nickname = user.displayName;

            // Se o displayName não estiver configurado, busca na coleção 'users'
            if (!nickname) {
                try {
                    const doc = await firebase.firestore().collection('users').doc(user.uid).get();
                    if (doc.exists && doc.data().nickname) {
                        nickname = doc.data().nickname;
                    } else {
                        nickname = "Policial";
                    }
                } catch (e) {
                    nickname = "Policial";
                }
            }

            userNameEl.innerText = nickname;
            // API do Habbo configurada para puxar apenas o rosto do avatar
            userAvatarEl.src = `https://www.habbo.com.br/habbo-imaging/avatarimage?user=${nickname}&action=std&direction=2&head_direction=2&gesture=sml&size=m&headonly=1`;
        } else {
            // Caso não esteja logado
            userNameEl.innerText = "Visitante";
            userAvatarEl.src = "https://www.habbo.com.br/habbo-imaging/avatarimage?user=Habbo&action=std&direction=2&head_direction=2&gesture=sml&size=m&headonly=1";
        }
    });
}

// 3. FUNÇÃO PARA ATUALIZAR OS LINKS ÚTEIS CONFORME A TRILHA
function atualizarRodape(idAula) {
    const container = document.getElementById('tools-container');
    if (!container) return;

    const trilhaCoord = ['ca', 'acompanhamento', 'orientacao', 'cop', 'cda'];
    const trilhaGrad = ['grad1', 'grad2'];

    let html = '';

    if (trilhaGrad.includes(idAula)) {
        html = `
            <a href="https://www.policiarcc.com/h222-prof-grad-relatorio" target="_blank" class="tool-card">
                <div class="tool-icon"><i class="fa-solid fa-file-circle-plus"></i></div>
                <div class="tool-content">
                    <strong>Postar Relatórios</strong>
                    <p>Registre as graduações aplicadas.</p>
                </div>
                <i class="fa-solid fa-arrow-up-right-from-square tool-external"></i>
            </a>
            <a href="https://docs.google.com/spreadsheets/u/1/d/154ToDPq8wakIM9W0LIiM_TExwAjunT696pqq0xmP2I8/edit?gid=230455547#gid=230455547" target="_blank" class="tool-card">
                <div class="tool-icon"><i class="fa-solid fa-file-magnifying-glass"></i></div>
                <div class="tool-content">
                    <strong>Verificar Relatórios</strong>
                    <p>Consulte a planilha oficial dos relatórios.</p>
                </div>
                <i class="fa-solid fa-arrow-up-right-from-square tool-external"></i>
            </a>
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSfoB27_eFNrEIZ_esGVs1mcrm1nLiVTcuRhXPJVsVgnmT0qZQ/viewform" target="_blank" class="tool-card">
                <div class="tool-icon"><i class="fa-solid fa-pen-to-square"></i></div>
                <div class="tool-content">
                    <strong>Postar Correções</strong>
                    <p>Envie correções de registros quando necessário.</p>
                </div>
                <i class="fa-solid fa-arrow-up-right-from-square tool-external"></i>
            </a>
            <a href="https://docs.google.com/spreadsheets/d/1-JinKLWlxa2nVRTJ-QIrQsYa4lkxX57NBWzrs1U-0kQ/edit#gid=1849101510" target="_blank" class="tool-card">
                <div class="tool-icon"><i class="fa-solid fa-clipboard-check"></i></div>
                <div class="tool-content">
                    <strong>Verificar Correções</strong>
                    <p>Acompanhe as correções postadas pela equipe.</p>
                </div>
                <i class="fa-solid fa-arrow-up-right-from-square tool-external"></i>
            </a>
        `;
    } else if (trilhaCoord.includes(idAula)) {
        html = `
            <a href="https://www.policiarcc.com/h223-prof-coord-relatorio" target="_blank" class="tool-card">
                <div class="tool-icon"><i class="fa-solid fa-file-circle-plus"></i></div>
                <div class="tool-content">
                    <strong>Postar Relatórios</strong>
                    <p>Registe as aulas aplicadas pelos coordenadores.</p>
                </div>
                <i class="fa-solid fa-arrow-up-right-from-square tool-external"></i>
            </a>
            <a href="https://system.policercc.com.br/companhia/professores" target="_blank" class="tool-card">
                <div class="tool-icon"><i class="fa-solid fa-desktop"></i></div>
                <div class="tool-content">
                    <strong>Postar no System</strong>
                    <p>Lance a atividade no sistema oficial da RCC.</p>
                </div>
                <i class="fa-solid fa-arrow-up-right-from-square tool-external"></i>
            </a>
            <a href="https://docs.google.com/spreadsheets/d/1EzyhvK4zEI_940ATXnaNQ8KUCxr-2Xj0qRY1MS6extI/edit?usp=sharing" target="_blank" class="tool-card">
                <div class="tool-icon"><i class="fa-solid fa-file-magnifying-glass"></i></div>
                <div class="tool-content">
                    <strong>Verificar Relatórios</strong>
                    <p>Consulte as entregas e acompanhe a grelha.</p>
                </div>
                <i class="fa-solid fa-arrow-up-right-from-square tool-external"></i>
            </a>
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSfoB27_eFNrEIZ_esGVs1mcrm1nLiVTcuRhXPJVsVgnmT0qZQ/viewform" target="_blank" class="tool-card">
                <div class="tool-icon"><i class="fa-solid fa-pen-to-square"></i></div>
                <div class="tool-content">
                    <strong>Postar Correções</strong>
                    <p>Envie correções de registos e atividades.</p>
                </div>
                <i class="fa-solid fa-arrow-up-right-from-square tool-external"></i>
            </a>
            <a href="https://docs.google.com/spreadsheets/d/1-JinKLWlxa2nVRTJ-QIrQsYa4lkxX57NBWzrs1U-0kQ/edit#gid=1849101510" target="_blank" class="tool-card">
                <div class="tool-icon"><i class="fa-solid fa-clipboard-check"></i></div>
                <div class="tool-content">
                    <strong>Verificar Correções</strong>
                    <p>Acompanhe as correções postadas pela equipa.</p>
                </div>
                <i class="fa-solid fa-arrow-up-right-from-square tool-external"></i>
            </a>
        `;
    } else {
        html = `
            <a href="https://www.policiarcc.com/h217-prof-relatorio" target="_blank" class="tool-card">
                <div class="tool-icon"><i class="fa-solid fa-file-circle-plus"></i></div>
                <div class="tool-content">
                    <strong>Postar Relatórios</strong>
                    <p>Registe as aulas aplicadas pelos professores.</p>
                </div>
                <i class="fa-solid fa-arrow-up-right-from-square tool-external"></i>
            </a>
            <a href="https://system.policercc.com.br/companhia/professores" target="_blank" class="tool-card">
                <div class="tool-icon"><i class="fa-solid fa-desktop"></i></div>
                <div class="tool-content">
                    <strong>Postar no System</strong>
                    <p>Lance a atividade no sistema oficial da RCC.</p>
                </div>
                <i class="fa-solid fa-arrow-up-right-from-square tool-external"></i>
            </a>
            <a href="https://docs.google.com/spreadsheets/d/1L5t72kbIlRnHRp_OaOMbHdDjkOy_3QlGJdYqarhh-ac/edit" target="_blank" class="tool-card">
                <div class="tool-icon"><i class="fa-solid fa-file-magnifying-glass"></i></div>
                <div class="tool-content">
                    <strong>Verificar Relatórios</strong>
                    <p>Consulte as entregas e acompanhe a grelha.</p>
                </div>
                <i class="fa-solid fa-arrow-up-right-from-square tool-external"></i>
            </a>
            <a href="https://drive.google.com/drive/u/1/folders/13APldv68spVkoekt8kmoFJsIRhsyAnGe" target="_blank" class="tool-card">
                <div class="tool-icon"><i class="fa-solid fa-box-archive"></i></div>
                <div class="tool-content">
                    <strong>Histórico de Aulas</strong>
                    <p>Aceda ao arquivo histórico das aulas da companhia.</p>
                </div>
                <i class="fa-solid fa-arrow-up-right-from-square tool-external"></i>
            </a>
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSfoB27_eFNrEIZ_esGVs1mcrm1nLiVTcuRhXPJVsVgnmT0qZQ/viewform" target="_blank" class="tool-card">
                <div class="tool-icon"><i class="fa-solid fa-pen-to-square"></i></div>
                <div class="tool-content">
                    <strong>Postar Correções</strong>
                    <p>Envie correções de registos e atividades.</p>
                </div>
                <i class="fa-solid fa-arrow-up-right-from-square tool-external"></i>
            </a>
            <a href="https://docs.google.com/spreadsheets/d/1-JinKLWlxa2nVRTJ-QIrQsYa4lkxX57NBWzrs1U-0kQ/edit#gid=1849101510" target="_blank" class="tool-card">
                <div class="tool-icon"><i class="fa-solid fa-clipboard-check"></i></div>
                <div class="tool-content">
                    <strong>Verificar Correções</strong>
                    <p>Acompanhe as correções postadas pela equipa.</p>
                </div>
                <i class="fa-solid fa-arrow-up-right-from-square tool-external"></i>
            </a>
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSdldkHKb875_DPNRr9JcP_p93uv7upfuLMuvSx8SHb80l01HA/viewform" target="_blank" class="tool-card">
                <div class="tool-icon"><i class="fa-solid fa-calendar-xmark"></i></div>
                <div class="tool-content">
                    <strong>Justificar Meta</strong>
                    <p>Registe justificativas de meta semanal.</p>
                </div>
                <i class="fa-solid fa-arrow-up-right-from-square tool-external"></i>
            </a>
            <a href="https://profstatusv2.netlify.app/" target="_blank" class="tool-card">
                <div class="tool-icon"><i class="fa-solid fa-graduation-cap"></i></div>
                <div class="tool-content">
                    <strong>Verificar Cursos</strong>
                    <p>Confira a situação de cursos obrigatórios e complementares.</p>
                </div>
                <i class="fa-solid fa-arrow-up-right-from-square tool-external"></i>
            </a>
            <a href="https://www.policiarcc.com/h240-prof-central-prof" target="_blank" class="tool-card" style="grid-column: 1 / -1; max-width: 400px; justify-self: center;">
                <div class="tool-icon"><i class="fa-solid fa-share-nodes"></i></div>
                <div class="tool-content">
                    <strong>Central Prof</strong>
                    <p>Abra a central externa dos professores.</p>
                </div>
                <i class="fa-solid fa-arrow-up-right-from-square tool-external"></i>
            </a>
        `;
    }

    container.innerHTML = html;
}

// 4. FUNÇÃO PARA TROCAR O CURSO PELO MENU LATERAL
function trocarCurso(idAula, elementoClicado) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (elementoClicado) elementoClicado.classList.add('active');
    
    document.body.setAttribute("data-aula", idAula);
    atualizarRodape(idAula);
    
    document.getElementById("corpo-script").innerHTML = '<p class="instruction" style="text-align: center; color: var(--muted); padding: 40px;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 10px;"></i><br>Buscando script...</p>';
    document.getElementById("aula-titulo").innerText = "Carregando...";
    document.getElementById("aula-subtitulo").innerText = "";
    
    carregarConteudoAulaLocal(idAula);
}

document.addEventListener("DOMContentLoaded", () => {
    carregarUsuarioLogado(); // Chama a verificação do usuário ao carregar

    const aulaParaCarregar = document.body?.getAttribute("data-aula") || "cac";
    const navInicial = document.getElementById('nav-' + aulaParaCarregar);
    if (navInicial) navInicial.classList.add('active');
    
    atualizarRodape(aulaParaCarregar);
    carregarConteudoAulaLocal(aulaParaCarregar);
});

function obterBancoFirestore() {
    if (window.db) return window.db;
    if (window.firebase && firebase.apps && firebase.apps.length && firebase.firestore) {
        window.db = firebase.firestore();
        return window.db;
    }
    return null;
}

function aguardarBancoFirestore(tentativas = 40, intervalo = 100) {
    return new Promise((resolve, reject) => {
        const tentar = () => {
            const banco = obterBancoFirestore();
            if (banco) {
                resolve(banco);
                return;
            }
            tentativas -= 1;
            if (tentativas <= 0) {
                reject(new Error("Banco de dados não inicializado."));
                return;
            }
            setTimeout(tentar, intervalo);
        };
        tentar();
    });
}

async function carregarConteudoAulaLocal(idAula) {
    const container = document.getElementById("corpo-script");
    const titulo = document.getElementById("aula-titulo");
    const subtitulo = document.getElementById("aula-subtitulo");

    let banco;

    try {
        banco = await aguardarBancoFirestore();
    } catch (err) {
        console.error("Banco de dados não inicializado:", err);
        if (container) container.innerHTML = '<p class="instruction" style="color: var(--danger)">Não foi possível conectar ao servidor.</p>';
        return;
    }

    banco.collection("scripts_aulas").doc(idAula).get().then((doc) => {
        if (doc.exists) {
            const dados = doc.data();

            if (container) {
                container.innerHTML = dados.conteudo || "<p>Conteúdo vazio.</p>";
                requestAnimationFrame(() => {
                    processarScriptCompleto(container);
                });
            }

            if (titulo) titulo.innerText = dados.titulo || "Sem título";
            if (subtitulo) subtitulo.innerText = dados.subtitulo || "";

        } else {
            if (container) container.innerHTML = "<p>Aula não encontrada no servidor.</p>";
            if (titulo) titulo.innerText = "Não encontrado";
            if (subtitulo) subtitulo.innerText = "";
        }
    }).catch(err => {
        console.error("Erro ao buscar aula:", err);
        if (container) container.innerHTML = '<p class="instruction" style="color: var(--danger)">Erro ao buscar a aula no servidor.</p>';
    });
}

window.alternarAula = function(tipo) {
    const container = document.getElementById("corpo-script");
    const secaoFinal = document.getElementById('secao-final');
    const todasAbas = ['slide', 'habbo', 'ori_1', 'ori_2', 'ori_3', 'ori_4', 'ori_5'];
    
    todasAbas.forEach(id => {
        const el = document.getElementById('conteudo-' + id);
        if (el) el.style.display = 'none';
    });

    const abaAlvo = document.getElementById('conteudo-' + tipo);
    if (abaAlvo) {
        abaAlvo.style.display = 'block';
        abaAlvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    if (secaoFinal) secaoFinal.style.display = 'block';

    if (typeof processarScriptCompleto === "function") {
        processarScriptCompleto(container);
    }
};

function normalizarLinhasSoltas(root) {
    const parents = [root, ...root.querySelectorAll("div, section, article, details")];
    const inlineTags = new Set(["A", "B", "CODE", "EM", "I", "MARK", "SMALL", "SPAN", "STRONG", "U", "BR"]);

    parents.forEach(parent => {
        if (parent.closest(".bbcode-block, .script-line, .script-text, .aula-selector, .tabs-buttons, .instruction, .script-action-button")) return;

        const nodes = Array.from(parent.childNodes);
        let grupo = [];

        const ehTextoUtil = node => node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0;
        const ehInline = node => node.nodeType === Node.ELEMENT_NODE && inlineTags.has(node.tagName);

        const fecharGrupo = () => {
            if (!grupo.length) return;
            const temConteudo = grupo.some(node => node.nodeType !== Node.TEXT_NODE || node.textContent.trim().length > 0);
            const primeiro = grupo[0];

            if (temConteudo && primeiro.parentNode === parent) {
                const p = document.createElement("p");
                parent.insertBefore(p, primeiro);
                grupo.forEach(node => p.appendChild(node));
            }
            grupo = [];
        };

        nodes.forEach(node => {
            if (ehTextoUtil(node) || ehInline(node)) {
                grupo.push(node);
                return;
            }
            if (node.nodeType === Node.TEXT_NODE) {
                if (grupo.length) grupo.push(node);
                return;
            }
            fecharGrupo();
        });
        fecharGrupo();
    });
}

function ehLinhaCopiavel(elemento) {
    if (!elemento || !elemento.innerText || elemento.innerText.trim().length < 2) return false;
    if (elemento.closest(".bbcode-block, .script-line, .script-text, .instruction, summary, button, .script-action-button")) return false;

    const possuiBlocoInterno = elemento.querySelector(
        "article, button, details, div, form, h1, h2, h3, h4, h5, h6, ol, p, section, table, ul, .bbcode-block, .script-line, .aula-selector"
    );

    return !possuiBlocoInterno;
}

function normalizeText(value) {
    return typeof value === 'string'
        ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        : '';
}

function processarScriptCompleto(container) {
    normalizarLinhasSoltas(container);

    const linhas = container.querySelectorAll("p, li, div");
    
    linhas.forEach(elemento => {
        if (!ehLinhaCopiavel(elemento)) return;

        const textPuro = elemento.innerText.trim();
        
        if (textPuro.startsWith('[') && textPuro.endsWith(']')) {
            const instrucaoWrap = document.createElement("div");
            instrucaoWrap.className = "instruction";
            instrucaoWrap.innerHTML = elemento.innerHTML;
            elemento.parentNode.replaceChild(instrucaoWrap, elemento);
            return;
        }

        const textoNorm = normalizeText(textPuro);
        if (textoNorm.includes('clique aqui') && (textoNorm.includes('enviar') || textoNorm.includes('apostila') || textoNorm.includes('slide') || textoNorm.includes('orientacao'))) {
            const btnAcao = document.createElement("button");
            btnAcao.className = "script-action-button";
            btnAcao.innerHTML = `<span>${elemento.innerHTML}</span><i class="fa-regular fa-copy"></i>`;
            btnAcao.onclick = () => copiarTexto(textPuro, btnAcao, false);
            elemento.parentNode.replaceChild(btnAcao, elemento);
            return;
        }

        criarEstruturaCopia(elemento, elemento.innerHTML);
    });

    const bbcodeBlocks = container.querySelectorAll(".bbcode-block");
    bbcodeBlocks.forEach(bloco => {
        const irmaoAnterior = bloco.previousElementSibling;
        if (irmaoAnterior && irmaoAnterior.classList.contains('btn-copy-all')) return;

        const btnAll = document.createElement("button");
        btnAll.className = "btn-copy-all";
        btnAll.innerHTML = '<i class="fa-solid fa-code"></i> COPIAR CÓDIGO';
        btnAll.onclick = (e) => {
            e.preventDefault();
            copiarTexto(bloco.innerText.trim(), btnAll, true);
        };
        bloco.parentNode.insertBefore(btnAll, bloco);
    });

    container.querySelectorAll("details").forEach(d => {
        if (!d.classList.contains('indice-wrapper')) {
            d.removeAttribute("open");
        }
    });
}

function criarEstruturaCopia(elemento, htmlOriginal) {
    const wrapper = document.createElement("div");
    wrapper.className = "script-line";

    const textoDiv = document.createElement("div");
    textoDiv.className = "script-text";
    textoDiv.innerHTML = htmlOriginal;

    const btn = document.createElement("button");
    btn.className = "btn-copy-line";
    btn.innerHTML = '<i class="fa-regular fa-copy"></i>';
    
    const textoPuro = elemento.innerText.trim();
    btn.onclick = () => copiarTexto(textoPuro, btn, false);

    wrapper.appendChild(textoDiv);
    wrapper.appendChild(btn);
    elemento.parentNode.replaceChild(wrapper, elemento);
}

function copiarTexto(texto, btnElement, isCode) {
    const copiarComFallback = () => {
        const textarea = document.createElement("textarea");
        textarea.value = texto;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
        return Promise.resolve();
    };

    const acaoCopiar = navigator.clipboard && window.isSecureContext
        ? navigator.clipboard.writeText(texto)
        : copiarComFallback();

    acaoCopiar.then(() => {
        const originalHTML = btnElement.innerHTML;
        btnElement.classList.add("copied");
        btnElement.innerHTML = '<i class="fa-solid fa-check"></i>';
        
        setTimeout(() => {
            btnElement.classList.remove("copied");
            btnElement.innerHTML = originalHTML;
        }, 2000);
    }).catch(err => {
        console.error("Erro ao copiar texto:", err);
    });
}
