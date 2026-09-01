// =========================================================
// PAINEL DE GESTÃO - FIREBASE + INTEGRAÇÃO TRATAMENTO
// =========================================================

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzTHOBFaiSFvtbIhfEwU_14F53LDhOV2H_pw6qj6dy9EmS4LkHUZhrImG_2GWgjup9p/exec';

const ALLOWED_ROLES = ["Estagiário(a)", "Conselheiro(a)", "Líder", "Vice-Líder", "Liderança"]; 
let currentUserNick = "";
let currentUserRole = ""; 
let todosOsBackups = {}; 
window.allVotesRaw = []; 
let globalLideresNicks = new Set(); 

function showToast(msg, type = 'success') {
    const div = document.createElement('div');
    div.className = `toast-modern ${type}`;
    div.innerHTML = `<i class="fas ${type === 'loading' ? 'fa-circle-notch fa-spin text-purple-400' : type === 'success' ? 'fa-check text-purple-400' : 'fa-times text-red-400'}"></i> <span>${msg}</span>`;
    document.body.appendChild(div);
    if (type !== 'loading') setTimeout(() => div.remove(), 3000);
    return div;
}

function toggleDisplay(id, show) {
    const el = document.getElementById(id);
    if(el) show ? el.classList.remove('hidden') : el.classList.add('hidden');
}

function formatDateFull(dateStr) {
    const d = dateStr ? new Date(dateStr) : new Date();
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${String(d.getDate()).padStart(2, '0')} ${meses[d.getMonth()].toUpperCase()} ${d.getFullYear()}`;
}

// ==========================================
// 1. INICIALIZAÇÃO E CONTROLE DE ACESSO
// ==========================================
document.addEventListener('userDataReady', async (e) => {
    const userData = e.detail.userData;
    
    if (!userData) {
        document.getElementById('access-title').innerText = "Acesso Negado";
        document.getElementById('access-message').innerText = "Sua conta não foi identificada no fórum.";
        const loader = document.querySelector('.loader');
        if(loader) loader.style.display = 'none';
        return;
    }

    const userCargo = userData.cargo || "";
    const isAuthorized = ALLOWED_ROLES.some(role => userCargo.includes(role));

    if (!isAuthorized) {
        document.getElementById('access-title').innerText = "Acesso Negado";
        document.getElementById('access-message').innerText = "Seu cargo não possui permissão para acessar a Central.";
        const loader = document.querySelector('.loader');
        if(loader) loader.style.display = 'none';
        return;
    }

    // Configuração Inicial de Acesso Liberado
    currentUserNick = userData.name || userData.nick;
    currentUserRole = userCargo; 
    db = firebase.firestore();

    // Oculta a tela de carregamento (Nomes dos IDs corrigidos)
    const accessScreen = document.getElementById('access-screen');
    if(accessScreen) accessScreen.classList.add('hidden');
    
    // Atualiza a interface com os dados do usuário (na topbar)
    const currentNickEl = document.getElementById('current-nick');
    if(currentNickEl) currentNickEl.textContent = currentUserNick;
    
    const currentRoleEl = document.getElementById('current-role');
    if(currentRoleEl) currentRoleEl.textContent = currentUserRole;
    
    const currentAvatarEl = document.getElementById('current-avatar');
    if(currentAvatarEl) currentAvatarEl.src = `https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(currentUserNick)}&direction=2&head_direction=3&gesture=sml&size=m&headonly=1`;

    // Inicia a aplicação na aba principal
    switchPanel('nav-resultados');
});

// Fallback de segurança caso a página carregue depois do evento disparar
setTimeout(() => {
    if (window.isUserDataReady && window.currentUserData && !currentUserNick) {
        document.dispatchEvent(new CustomEvent('userDataReady', { detail: { userData: window.currentUserData } }));
    }
}, 1500);

// ==========================================
// 2. NAVEGAÇÃO ENTRE ABAS
// ==========================================
window.switchPanel = function(tabId) {
    const panels = ['view-cadastro', 'view-resultados', 'view-historico'];
    const buttons = ['nav-cadastro', 'nav-resultados', 'nav-historico'];
    
    panels.forEach(id => document.getElementById(id).classList.add('hidden'));
    buttons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.classList.remove('active-cargo', 'text-white');
            btn.classList.add('text-slate-400');
        }
    });
    
    const activeView = tabId.replace('tab-', 'view-').replace('nav-', 'view-');
    const targetPanel = document.getElementById(activeView);
    if (targetPanel) targetPanel.classList.remove('hidden');

    const activeBtn = document.getElementById(tabId);
    if (activeBtn) {
        activeBtn.classList.add('active-cargo', 'text-white');
        activeBtn.classList.remove('text-slate-400');
    }

    // Gatilhos de carregamento forçado
    if(activeView === 'view-resultados') carregarResultados();
    if(activeView === 'view-historico') carregarListaBackups();
}

document.getElementById('nav-cadastro')?.addEventListener('click', (e) => switchPanel(e.currentTarget.id));
document.getElementById('nav-resultados')?.addEventListener('click', (e) => switchPanel(e.currentTarget.id));
document.getElementById('nav-historico')?.addEventListener('click', (e) => switchPanel(e.currentTarget.id));

// ==========================================
// 3. ABA DE CADASTRO DE PROPOSTA
// ==========================================
document.getElementById('form-proposta')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-submit');
    const originalBtnText = btnSubmit.innerHTML;

    const ordem = parseInt(document.getElementById('prop-ordem').value);
    const autor = document.getElementById('prop-autor').value.trim();
    const tipo = document.getElementById('prop-tipo').value;
    const titulo = document.getElementById('prop-titulo').value.trim();
    const conteudo = document.getElementById('prop-conteudo').value.trim();

    try {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Lançando...';
        
        await db.collection("nexus_config").doc("Propostas").collection("lista_propostas").doc(ordem.toString()).set({
            ordem: ordem, autor: autor, tipo: tipo, titulo: titulo, conteudo: conteudo,
            data: new Date().toISOString()
        });

        showToast("Proposta registrada no banco ativo!", "success");
        document.getElementById('form-proposta').reset();
    } catch (error) {
        showToast("Erro ao conectar no banco.", "error");
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalBtnText;
    }
});

// ==========================================
// 4. ABA DE MONITORAMENTO DE VOTOS
// ==========================================
async function fetchLideresNicks() {
    if (globalLideresNicks.size > 0) return globalLideresNicks;
    const usersSnap = await db.collection('users').where('cargo', 'in', ['Líder', 'Vice-Líder', 'Liderança']).get();
    usersSnap.forEach(doc => {
        const u = doc.data();
        if (u.status !== 'Ativo') return; // Apenas Ativos
        if (u.name) globalLideresNicks.add(u.name.toLowerCase());
        if (u.nick) globalLideresNicks.add(u.nick.toLowerCase());
    });
    return globalLideresNicks;
}

async function carregarResultados() {
    const grid = document.getElementById('resultados-grid');
    grid.innerHTML = '<div class="col-span-full text-center py-10"><i class="fas fa-circle-notch fa-spin text-3xl text-purple-500 mb-4"></i><p class="text-slate-400 font-bold uppercase tracking-widest">Coletando votos do conselho...</p></div>';

    try {
        const now = typeof dayjs !== 'undefined' ? dayjs() : null;
        let lastTuesday = null;
        if(now) {
            let daysSinceTuesday = now.day() - 2;
            if (daysSinceTuesday < 0) daysSinceTuesday += 7;
            lastTuesday = now.subtract(daysSinceTuesday, 'day').startOf('day');
        }

        const propsSnap = await db.collection("nexus_config").doc("Propostas").collection("lista_propostas").orderBy("ordem", "desc").get();
        const votosSnap = await db.collection("nexus_config").doc("Propostas").collection("votos_conselho").get();
        const usersSnap = await db.collection('users').where('cargo', 'in', ['Estagiário(a)', 'Conselheiro(a)', 'Vice-Líder', 'Líder', 'Liderança']).get();
        
        // --- BUSCA DE LICENÇAS ATIVAS ---
        const licencasSnap = await db.collection('licencas').where('status_licenca', '==', 'Ativa').get();
        const licencasAtivas = new Set();
        licencasSnap.forEach(doc => {
            const data = doc.data();
            if(data.nickname) licencasAtivas.add(data.nickname.toLowerCase());
        });

        const conselheiros = [];
        globalLideresNicks.clear();
        
        usersSnap.forEach(doc => {
            const u = doc.data();
            const cargo = u.cargo || "";
            const cargoLow = cargo.toLowerCase();
            
            // ----------------------------------------------------
            // FILTRO RIGOROSO: Apenas status 'Ativo' e ignora 'Ex'
            // ----------------------------------------------------
            if (u.status !== 'Ativo') return; 
            if (cargoLow.includes('ex-') || cargoLow.startsWith('ex ')) return;
            
            conselheiros.push(u);
            if (cargo === 'Líder' || cargo === 'Vice-Líder' || cargo === 'Liderança') {
                if (u.name) globalLideresNicks.add(u.name.toLowerCase());
                if (u.nick) globalLideresNicks.add(u.nick.toLowerCase());
            }
        });

        const propostas = [];
        window.allVotesRaw = []; 
        
        propsSnap.forEach(doc => {
            let dataProp = doc.data();
            dataProp.isLeftover = (dataProp.data && lastTuesday) ? dayjs(dataProp.data).isBefore(lastTuesday) : false;
            dataProp.id = doc.id;
            propostas.push(dataProp);
        });
        votosSnap.forEach(doc => window.allVotesRaw.push({ id: doc.id, ...doc.data() }));

        renderizarParticipacaoConselhoComDados(window.allVotesRaw, conselheiros, 'conselho-tracker-placeholder', licencasAtivas);
        renderizarGradePropostas(propostas, window.allVotesRaw, globalLideresNicks, 'resultados-grid');

    } catch (error) {
        console.error(error);
        grid.innerHTML = '<div class="col-span-full text-red-500 font-bold text-center py-10">Erro ao carregar dados do Firebase.</div>';
    }
}

function renderizarParticipacaoConselhoComDados(votos, conselheiros, targetId, licencasAtivas = new Set()) {
    const trackerDiv = document.getElementById(targetId);
    if(!trackerDiv) return;
    
    const RobsonCargos = { 'Liderança': 1, 'Líder': 2, 'Vice-Líder': 3, 'Conselheiro(a)': 4, 'Estagiário(a)': 5 };
    conselheiros.sort((a,b) => (RobsonCargos[a.cargo] || 99) - (RobsonCargos[b.cargo] || 99));

    const votosPorAvaliador = {};
    votos.forEach(v => {
        const av = (v.Nick || v.nick || '').toLowerCase();
        if(!votosPorAvaliador[av]) votosPorAvaliador[av] = { fav:0, rep:0, neu:0, total:0 };
        
        const vVer = (v.Veredito || v.veredito || '');
        if(vVer.includes('Aprovada')) votosPorAvaliador[av].fav++;
        else if(vVer.includes('Reprovada')) votosPorAvaliador[av].rep++;
        else votosPorAvaliador[av].neu++;
        
        votosPorAvaliador[av].total++;
    });

    let html = '';
    conselheiros.forEach(c => {
        const nick = c.name || c.nick || 'Desconhecido';
        const nickLower = nick.toLowerCase();
        const cargo = c.cargo || 'Membro';
        const stats = votosPorAvaliador[nickLower] || { fav:0, rep:0, neu:0, total:0 };
        
        const isAltoComando = (cargo === 'Líder' || cargo === 'Vice-Líder' || cargo === 'Liderança');
        const isEmLicenca = licencasAtivas.has(nickLower);
        const votou = stats.total > 0;
        
        let bgClass = '';
        let statusHtml = '';

        if (isEmLicenca) {
            bgClass = 'bg-yellow-900/10 border-yellow-500/30 opacity-80';
            statusHtml = `<p class="text-[10px] font-bold mt-0.5 text-yellow-500"><i class="fas fa-plane"></i> Licença Ativa</p>`;
        } else if (votou) {
            bgClass = 'bg-emerald-900/10 border-emerald-500/30';
            statusHtml = `
            <div class="flex items-center gap-2 mt-1 text-[10px] font-bold">
                <span class="text-emerald-400"><i class="fas fa-check"></i> ${stats.fav}</span>
                <span class="text-red-400"><i class="fas fa-times"></i> ${stats.rep}</span>
                <span class="text-blue-400"><i class="fas fa-minus"></i> ${stats.neu}</span>
            </div>`;
        } else {
            bgClass = isAltoComando ? 'bg-purple-900/10 border-purple-500/30' : 'bg-red-900/10 border-red-500/30';
            statusHtml = isAltoComando 
                ? `<p class="text-[10px] font-bold mt-0.5 text-purple-400 opacity-80"><i class="fas fa-eye"></i> Acompanhamento</p>` 
                : `<p class="text-[10px] font-bold mt-0.5 text-red-500"><i class="fas fa-times"></i> Pendente</p> `;
        }

        html += `
        <div class="border ${bgClass} rounded-xl p-3 flex items-center gap-3 shadow-inner transition hover:scale-105">
            <img src="https://www.habbo.com.br/habbo-imaging/avatarimage?user=${encodeURIComponent(nick)}&direction=2&head_direction=2&gesture=sml&size=s&headonly=1" class="w-10 h-10 rounded-full bg-slate-900 drop-shadow-md">
            <div class="overflow-hidden w-full">
                <p class="text-xs font-black text-white truncate w-full leading-tight">${nick}</p>
                <p class="text-[9px] text-slate-500 uppercase tracking-widest truncate w-full mt-0.5">${cargo}</p>
                ${statusHtml}
            </div>
        </div>`;
    });

    trackerDiv.innerHTML = html || '<div class="col-span-full text-center text-slate-500 text-xs py-4">Nenhum conselheiro ativo registrado.</div>';
}

function renderizarGradePropostas(listaProps, todosVotos, lideresNicks, gridId) {
    const grid = document.getElementById(gridId);
    if(!grid) return;
    let html = '';
    
    // Verifica se o usuário logado tem permissão para usar o botão
    const isUserLideranca = ['Líder', 'Vice-Líder', 'Liderança'].includes(currentUserRole);

    listaProps.forEach(p => {
        const votosDesta = todosVotos.filter(v => parseInt(v.Ordem || v.ordem) === parseInt(p.ordem || p.Ordem));
        const votoDoLider = votosDesta.find(v => lideresNicks.has((v.Nick || v.nick || '').toLowerCase()));
        
        let bgStyle = 'bg-[#0b0f19] border-slate-800';
        let badgeHtml = '<span class="text-[10px] uppercase tracking-widest bg-slate-900 text-slate-500 px-2 py-1 rounded border border-slate-800 font-bold">Sem Votos</span>';
        
        if (votosDesta.length > 0) {
            if (votoDoLider) {
                const vVeredito = votoDoLider.Veredito || votoDoLider.veredito || '';
                if (vVeredito.includes('Aprovada')) {
                    bgStyle = 'bg-emerald-900/10 border-emerald-500/30';
                    badgeHtml = `<span class="text-[10px] uppercase tracking-widest bg-emerald-900/50 text-emerald-400 px-2 py-1 rounded border border-emerald-500 font-bold"><i class="fas fa-crown mr-1"></i> Aprovada Liderança</span>`;
                } else {
                    bgStyle = 'bg-red-900/10 border-red-500/30';
                    badgeHtml = `<span class="text-[10px] uppercase tracking-widest bg-red-900/50 text-red-400 px-2 py-1 rounded border border-red-500 font-bold"><i class="fas fa-crown mr-1"></i> Reprovada Liderança</span>`;
                }
            } else {
                let contagem = { aprovada: 0, reprovada: 0, tutela: 0, reuniao: 0, lideranca: 0, autoria: 0 };
                
                votosDesta.forEach(v => { 
                    const vVer = (v.Veredito || v.veredito || '').toLowerCase();
                    if (vVer.includes('aprovada')) contagem.aprovada++; 
                    else if (vVer.includes('reprovada')) contagem.reprovada++; 
                    else if (vVer.includes('tutela')) contagem.tutela++;
                    else if (vVer.includes('reunião') || vVer.includes('reuniao')) contagem.reuniao++;
                    else if (vVer.includes('liderança') || vVer.includes('lideranca')) contagem.lideranca++;
                    else if (vVer.includes('autoria')) contagem.autoria++;
                });

                let maxVotos = 0;
                let vencedores = [];
                for (const [tipo, qtd] of Object.entries(contagem)) {
                    if (qtd > maxVotos) {
                        maxVotos = qtd;
                        vencedores = [tipo];
                    } else if (qtd === maxVotos && qtd > 0) {
                        vencedores.push(tipo);
                    }
                }

                if (vencedores.length > 1 || vencedores.length === 0) {
                    bgStyle = 'bg-blue-900/10 border-blue-500/30';
                    badgeHtml = `<span class="text-[10px] uppercase tracking-widest bg-blue-900/50 text-blue-400 px-2 py-1 rounded border border-blue-500 font-bold"><i class="fas fa-balance-scale mr-1"></i> Empate Técnico</span>`;
                } else {
                    const maioria = vencedores[0];
                    if (maioria === 'aprovada') {
                        bgStyle = 'bg-emerald-900/10 border-emerald-500/30';
                        badgeHtml = `<span class="text-[10px] uppercase tracking-widest bg-emerald-900/50 text-emerald-400 px-2 py-1 rounded border border-emerald-500 font-bold"><i class="fas fa-check-circle mr-1"></i> Maioria Aprovou</span>`;
                    } else if (maioria === 'reprovada') {
                        bgStyle = 'bg-red-900/10 border-red-500/30';
                        badgeHtml = `<span class="text-[10px] uppercase tracking-widest bg-red-900/50 text-red-400 px-2 py-1 rounded border border-red-500 font-bold"><i class="fas fa-times-circle mr-1"></i> Maioria Reprovou</span>`;
                    } else if (maioria === 'tutela') {
                        bgStyle = 'bg-yellow-900/10 border-yellow-500/30';
                        badgeHtml = `<span class="text-[10px] uppercase tracking-widest bg-yellow-900/50 text-yellow-400 px-2 py-1 rounded border border-yellow-500 font-bold"><i class="fas fa-shield-alt mr-1"></i> Maioria Tutela</span>`;
                    } else if (maioria === 'reuniao') {
                        bgStyle = 'bg-purple-900/10 border-purple-500/30';
                        badgeHtml = `<span class="text-[10px] uppercase tracking-widest bg-purple-900/50 text-purple-400 px-2 py-1 rounded border border-purple-500 font-bold"><i class="fas fa-users mr-1"></i> Maioria Reunião</span>`;
                    } else if (maioria === 'lideranca') {
                        bgStyle = 'bg-pink-900/10 border-pink-500/30';
                        badgeHtml = `<span class="text-[10px] uppercase tracking-widest bg-pink-900/50 text-pink-400 px-2 py-1 rounded border border-pink-500 font-bold"><i class="fas fa-arrow-up mr-1"></i> Maioria Liderança</span>`;
                    } else if (maioria === 'autoria') {
                        bgStyle = 'bg-orange-900/10 border-orange-500/30';
                        badgeHtml = `<span class="text-[10px] uppercase tracking-widest bg-orange-900/50 text-orange-400 px-2 py-1 rounded border border-orange-500 font-bold"><i class="fas fa-pen-nib mr-1"></i> Maioria Autoria</span>`;
                    }
                }
                
                if (p.isLeftover && (vencedores.length > 1 || vencedores.length === 0 || !['aprovada', 'reprovada'].includes(vencedores[0]))) {
                    bgStyle = 'bg-blue-900/10 border-blue-500/30';
                    badgeHtml = `<span class="text-[10px] uppercase tracking-widest bg-blue-900/50 text-blue-400 px-2 py-1 rounded border border-blue-500 font-bold"><i class="fas fa-clock mr-1"></i> Pendente Liderança</span>`;
                }
            }
        }

        // BOTAO DE FORÇAR RESULTADO PARA A LIDERANÇA
        let btnForcar = '';
        if (isUserLideranca) {
            const backupStr = gridId === 'historico-grid' ? `'${document.getElementById('hist-backup-select').value}'` : 'null';
            btnForcar = `<button onclick="abrirModalForcarVoto(${p.ordem || p.Ordem}, ${backupStr})" title="Forçar Veredito da Liderança" class="ml-2 text-[10px] bg-fuchsia-900/50 text-fuchsia-400 px-2 py-1 rounded border border-fuchsia-500 hover:bg-fuchsia-500 hover:text-white transition shadow"><i class="fas fa-gavel"></i></button>`;
        }

        html += `
        <div class="glass-panel border ${bgStyle} rounded-2xl p-5 shadow-lg flex flex-col relative transition hover:scale-[1.02]">
            <div class="flex justify-between items-start mb-4">
                <div class="flex items-center gap-3">
                    <span class="bg-[#05070c] text-purple-400 px-3 py-1.5 rounded-lg text-xs font-black border border-slate-800">Nº ${p.ordem || p.Ordem}</span>
                    <div class="overflow-hidden">
                        <span class="text-[8px] uppercase tracking-wider text-purple-400 bg-purple-900/30 px-1.5 py-0.5 rounded border border-purple-500/30">${p.tipo || p.Categoria || 'Proposta'}</span>
                        <h4 class="font-black text-white text-sm leading-none truncate max-w-[150px] mt-1" title="${p.titulo || p.Titulo}">${p.titulo || p.Titulo}</h4>
                        <p class="text-[9px] text-slate-500 uppercase tracking-widest mt-1 truncate">Por ${p.autor || p.Autor}</p>
                    </div>
                </div>
                <div class="flex items-center">
                    ${badgeHtml}
                    ${btnForcar}
                </div>
            </div>

            <div class="my-2 text-[11px] text-slate-400 line-clamp-2 bg-black/20 p-2 rounded-lg border border-slate-800/50 flex-1 relative group cursor-help">
                <b class="text-slate-300">Síntese:</b> <span class="italic">${(p.conteudo || p.Conteudo || 'Nenhum conteúdo detalhado fornecido.').replace(/\\n/g, '\n')}</span>
                <div class="hidden group-hover:block absolute z-10 bg-slate-900 border border-slate-700 p-2 rounded shadow-2xl min-w-[200px] -top-8 left-0 whitespace-pre-line">
                    ${(p.conteudo || p.Conteudo || 'Sem síntese').replace(/\\n/g, '\n')}
                </div>
            </div>

            <button onclick='abrirModalVotos(${JSON.stringify(votosDesta).replace(/'/g, "&#39;")})' class="w-full bg-slate-800 hover:bg-purple-600 text-slate-300 hover:text-white py-2 rounded-xl text-xs font-bold uppercase transition mt-auto">
                <i class="fas fa-comments mr-1"></i> Ler ${votosDesta.length} Pareceres
            </button>
        </div>`;
    });

    if (listaProps.length === 0) html = '<div class="col-span-full text-slate-500 font-bold text-center py-10">Nenhuma proposta encontrada.</div>';
    grid.innerHTML = html;
}

window.abrirModalVotos = function(votos) {
    const container = document.getElementById('modal-votos-conteudo');
    if(votos.length === 0) {
        container.innerHTML = '<p class="text-slate-500 text-center py-6">Ninguém votou ainda.</p>';
    } else {
        let html = '';
        votos.forEach(v => {
            let color = "text-slate-400";
            const vVer = (v.Veredito || v.veredito || '').toLowerCase();
            
            if(vVer.includes('aprovada')) color = "text-emerald-400";
            else if(vVer.includes('reprovada')) color = "text-red-400";
            else if(vVer.includes('tutela')) color = "text-yellow-400";
            else if(vVer.includes('reunião') || vVer.includes('reuniao')) color = "text-purple-400";
            else if(vVer.includes('liderança') || vVer.includes('lideranca')) color = "text-pink-400";
            else if(vVer.includes('autoria')) color = "text-orange-400";

            html += `
            <div class="bg-[#05070c] border border-slate-800 rounded-xl p-4 flex flex-col mb-3 shadow-inner">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-black text-white">${v.Nick || v.nick}</span>
                    <span class="text-[10px] font-bold ${color} bg-slate-800 px-2 py-1 rounded border border-slate-700">${v.Veredito || v.veredito}</span>
                </div>
                <p class="text-xs text-slate-400 italic whitespace-pre-line">"${(v.Comentario || v.comentario || '').replace(/\\n/g, '\n')}"</p>
            </div>`;
        });
        container.innerHTML = html;
    }
    document.getElementById('modal-leitura-votos').classList.remove('hidden');
}
window.fecharModalVotos = () => document.getElementById('modal-leitura-votos').classList.add('hidden');

// ==========================================
// FUNÇÕES DO QUADRO: FORÇAR DECISÃO
// ==========================================
window.abrirModalForcarVoto = function(ordem, backupId = null) {
    let modal = document.getElementById('modal-forcar-voto');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-forcar-voto';
        modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50 hidden';
        modal.innerHTML = `
            <div class="bg-[#0b0f19] border border-slate-800 rounded-2xl p-6 shadow-2xl w-full max-w-md">
                <h2 class="text-white font-black text-lg mb-4"><i class="fas fa-gavel text-fuchsia-500 mr-2"></i> Veredito da Liderança</h2>
                <input type="hidden" id="forcar-ordem">
                <input type="hidden" id="forcar-backup">
                
                <div class="mb-4">
                    <label class="block text-slate-400 text-xs font-bold mb-2">Decisão Soberana</label>
                    <select id="forcar-veredito" class="w-full bg-[#05070c] border border-slate-700 text-white text-sm rounded-xl p-3 focus:border-fuchsia-500 outline-none transition">
                        <option value="Aprovada">Aprovada</option>
                        <option value="Reprovada">Reprovada</option>
                    </select>
                </div>
                
                <div class="mb-6">
                    <label class="block text-slate-400 text-xs font-bold mb-2">Comentário / Justificativa</label>
                    <textarea id="forcar-comentario" rows="3" class="w-full bg-[#05070c] border border-slate-700 text-white text-sm rounded-xl p-3 focus:border-fuchsia-500 outline-none transition" placeholder="Motivação da decisão..."></textarea>
                </div>
                
                <div class="flex justify-end gap-3">
                    <button onclick="fecharModalForcarVoto()" class="bg-slate-800 hover:bg-slate-700 text-white font-bold py-2 px-4 rounded-xl text-xs uppercase transition">Cancelar</button>
                    <button onclick="salvarVotoForcado()" class="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-2 px-4 rounded-xl text-xs uppercase transition shadow-lg"><i class="fas fa-save mr-1"></i> Decretar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    document.getElementById('forcar-ordem').value = ordem;
    document.getElementById('forcar-backup').value = backupId || '';
    document.getElementById('forcar-veredito').value = 'Aprovada';
    document.getElementById('forcar-comentario').value = 'Decisão final decretada via painel de Liderança.';
    
    modal.classList.remove('hidden');
};

window.fecharModalForcarVoto = function() {
    const modal = document.getElementById('modal-forcar-voto');
    if (modal) modal.classList.add('hidden');
};

window.salvarVotoForcado = async function() {
    const ordem = document.getElementById('forcar-ordem').value;
    const backupId = document.getElementById('forcar-backup').value;
    const veredito = document.getElementById('forcar-veredito').value;
    const comentario = document.getElementById('forcar-comentario').value.trim();

    if (!comentario) {
        showToast("O comentário é obrigatório.", "error");
        return;
    }

    const safeNick = currentUserNick.replace(/[^a-zA-Z0-9_]/g, '');
    const votoId = `voto_${ordem}_${safeNick}`;
    const novoVoto = {
        Nick: currentUserNick,
        Ordem: parseInt(ordem),
        Comentario: comentario,
        Veredito: veredito,
        Timestamp: new Date().toISOString()
    };

    const t = showToast("Forçando veredito...", "loading");
    fecharModalForcarVoto();

    try {
        if (backupId) {
            const docRef = db.collection("nexus_config").doc("backup_respostas").collection("historico").doc(backupId);
            const doc = await docRef.get();
            if (doc.exists) {
                const data = doc.data();
                let votos = data.votos || [];
                // Evita duplicar voto da liderança na mesma proposta
                votos = votos.filter(v => !(parseInt(v.Ordem) === parseInt(ordem) && (v.Nick === currentUserNick || v.nick === currentUserNick)));
                votos.push(novoVoto);
                await docRef.update({ votos: votos });
                
                t.remove();
                showToast("Resultado alterado no cofre de backup!", "success");
                
                if (todosOsBackups[backupId]) { todosOsBackups[backupId].votos = votos; }
                document.getElementById('hist-backup-select').dispatchEvent(new Event('change'));
            }
        } else {
            await db.collection("nexus_config").doc("Propostas").collection("votos_conselho").doc(votoId).set({
                ...novoVoto,
                Timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            t.remove();
            showToast("Resultado ativo alterado com sucesso!", "success");
            carregarResultados();
        }
    } catch (err) {
        console.error(err);
        t.remove();
        showToast("Erro ao forçar decisão.", "error");
    }
};

// ==========================================
// 5. ABA 3: CRIAÇÃO DO BACKUP E INTEGRAÇÃO DE HISTÓRICO
// ==========================================
window.encerrarCicloEArquivar = async () => {
    const confirmation = confirm("CONFIRMAR OPERAÇÃO DE ENCERRAMENTO?\n\n1. As propostas RESOLVIDAS serão apagadas da tela.\n2. O Backup completo será salvo.\n3. As aprovadas vão para a planilha Tratamento e atualizarão o perfil/histórico dos autores.\n4. Os EMPATES / PENDENTES continuarão na tela.");
    if (!confirmation) return;

    const btn = document.getElementById('btn-arquivar');
    const originalText = btn.innerHTML;
    const t = showToast('Gerando Backup e Distribuindo Recompensas...', 'loading');

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Processando...';

        const propsSnap = await db.collection("nexus_config").doc("Propostas").collection("lista_propostas").get();
        const votosSnap = await db.collection("nexus_config").doc("Propostas").collection("votos_conselho").get();
        const usersSnap = await db.collection('users').where('cargo', 'in', ['Líder', 'Vice-Líder', 'Liderança']).get();

        const lideresNicks = new Set();
        usersSnap.forEach(doc => {
            const u = doc.data();
            if (u.status !== 'Ativo') return; // Apenas ativos
            if (u.name) lideresNicks.add(u.name.toLowerCase());
            if (u.nick) lideresNicks.add(u.nick.toLowerCase());
        });

        const propostas = []; const votos = [];
        propsSnap.forEach(doc => propostas.push({ id: doc.id, ...doc.data() }));
        votosSnap.forEach(doc => votos.push({ id: doc.id, ...doc.data() }));

        if (propostas.length === 0 && votos.length === 0) {
            t.remove(); showToast('O sistema já está vazio.', 'error'); return;
        }

        const ordens = propostas.map(p => parseInt(p.ordem)).filter(n => !isNaN(n));
        let nomeBackup = "Backup Geral";
        if (ordens.length > 0) {
            const minOrdem = Math.min(...ordens);
            const maxOrdem = Math.max(...ordens);
            nomeBackup = minOrdem === maxOrdem ? `Nº ${minOrdem}` : `Nº ${minOrdem} a ${maxOrdem}`;
        }

        const dataAtual = new Date();
        const docId = dataAtual.getTime().toString();
        
        // Salvamento do Backup
        await db.collection("nexus_config").doc("backup_respostas").collection("historico").doc(docId).set({
            nome_backup: nomeBackup,
            data_formatada: formatDateFull(dataAtual),
            timestamp: dataAtual.toISOString(),
            propostas: propostas,
            votos: votos
        });

        const aprovadasParaTratamento = [];
        const propostasParaDeletarIds = [];

        propostas.forEach(p => {
            const votosDesta = votos.filter(v => parseInt(v.Ordem) === parseInt(p.ordem));
            const votoDoLider = votosDesta.find(v => lideresNicks.has((v.Nick || '').toLowerCase()));

            if (votoDoLider) {
                propostasParaDeletarIds.push(p.id);
                if (votoDoLider.Veredito.includes('Aprovada')) {
                    aprovadasParaTratamento.push({ ordem: p.ordem, autor: p.autor, categoria: p.tipo, titulo: p.titulo, conteudo: p.conteudo });
                }
            } else if (votosDesta.length > 0) {
                let contagem = { aprovada: 0, reprovada: 0, tutela: 0, reuniao: 0, lideranca: 0, autoria: 0 };
                
                votosDesta.forEach(v => { 
                    const vVer = (v.Veredito || v.veredito || '').toLowerCase();
                    if (vVer.includes('aprovada')) contagem.aprovada++; 
                    else if (vVer.includes('reprovada')) contagem.reprovada++; 
                    else if (vVer.includes('tutela')) contagem.tutela++;
                    else if (vVer.includes('reunião') || vVer.includes('reuniao')) contagem.reuniao++;
                    else if (vVer.includes('liderança') || vVer.includes('lideranca')) contagem.lideranca++;
                    else if (vVer.includes('autoria')) contagem.autoria++;
                });

                let maxVotos = 0;
                let vencedores = [];
                for (const [tipo, qtd] of Object.entries(contagem)) {
                    if (qtd > maxVotos) { maxVotos = qtd; vencedores = [tipo]; } 
                    else if (qtd === maxVotos && qtd > 0) { vencedores.push(tipo); }
                }

                if (vencedores.length === 1) {
                    const maioria = vencedores[0];
                    if (maioria === 'aprovada') {
                        aprovadasParaTratamento.push({ ordem: p.ordem, autor: p.autor, categoria: p.tipo, titulo: p.titulo, conteudo: p.conteudo });
                        propostasParaDeletarIds.push(p.id); 
                    } else if (maioria === 'reprovada') {
                        propostasParaDeletarIds.push(p.id); 
                    }
                }
            }
        });

        // -----------------------------------------------------
        // INJEÇÃO DE MULTINICK / HISTÓRICO DAS APROVADAS
        // -----------------------------------------------------
        if (aprovadasParaTratamento.length > 0) {
            for (const p of aprovadasParaTratamento) {
                const listaNicknames = (p.autor || '').split('/').map(n => n.trim()).filter(n => n !== "");
                
                for (const nickname of listaNicknames) {
                    try {
                        let userRefDoc = null;
                        const userQuery = await db.collection('users').where('name', '==', nickname).get();
                        
                        if (!userQuery.empty) { userRefDoc = userQuery.docs[0]; }
                        else {
                            const userQueryNick = await db.collection('users').where('nick', '==', nickname).get();
                            if (!userQueryNick.empty) userRefDoc = userQueryNick.docs[0];
                        }

                        if (userRefDoc) {
                            const userId = userRefDoc.id;
                            const userRef = db.collection('users').doc(userId);

                            await userRef.update({ propostas: firebase.firestore.FieldValue.increment(1) });

                            const sintese = p.conteudo || '';
                            const conteudoHTML = `<b>Tipo:</b> ${p.categoria || 'Proposta'}<br><b>Ordem:</b> ${p.ordem}<br><b>Título:</b> ${p.titulo}<br><br><b>Síntese:</b> ${sintese}`;

                            await userRef.collection('historico').add({
                                titulo: 'Proposta Aprovada pelo Conselho',
                                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                                data: formatDateFull(new Date()),
                                autor: currentUserNick,
                                conteudo: conteudoHTML,
                                dados: { 
                                    departamento: 'Companhia', 
                                    tipo: p.categoria || 'Proposta', 
                                    ordem: p.ordem, 
                                    titulo: p.titulo, 
                                    sintese: sintese,
                                    parceiros: p.autor 
                                }
                            });

                            await db.collection('notificacoes').add({
                                tipo: 'companhia_ouvidoria',
                                dados: { nomeUsuario: nickname, tipoProposta: p.categoria || 'Proposta' },
                                link: `/membros/${encodeURIComponent(nickname)}`,
                                userId: userId,
                                lida: false,
                                timestamp: firebase.firestore.FieldValue.serverTimestamp()
                            });
                        }
                    } catch (error) {
                        console.error(`Erro ao salvar histórico para o autor ${nickname}:`, error);
                    }
                }
            }

            // Dispara para o Sheets
            fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'enviarTratamento', dados: aprovadasParaTratamento }),
                headers: { "Content-Type": "text/plain;charset=utf-8" }
            }).catch(e => console.error("Falha ao enviar webhook AppScript:", e));
        }

        // Limpeza do Painel
        if (propostasParaDeletarIds.length > 0) {
            const batch = db.batch();
            propsSnap.docs.forEach(doc => {
                if (propostasParaDeletarIds.includes(doc.id)) batch.delete(doc.ref);
            });
            votosSnap.docs.forEach(doc => {
                const pOrdem = doc.data().Ordem;
                if (propostasParaDeletarIds.includes(pOrdem.toString())) batch.delete(doc.ref);
            });
            await batch.commit();
        }

        t.remove();
        showToast(`Backup Concluído! ${propostasParaDeletarIds.length} propostas foram limpas e os perfis atualizados.`, 'success');
        carregarResultados(); 

    } catch (error) {
        t.remove(); showToast('Erro Crítico ao processar.', 'error'); console.error(error);
    } finally {
        btn.disabled = false; btn.innerHTML = originalText;
    }
};

// ==========================================
// 6. HISTÓRICO COFRE & SISTEMA DE REVERSÃO
// ==========================================
async function carregarListaBackups() {
    const select = document.getElementById('hist-backup-select');
    if (!select) return;

    select.innerHTML = '<option value="" disabled selected>Buscando no cofre...</option>';

    try {
        const snap = await db.collection("nexus_config").doc("backup_respostas").collection("historico").orderBy('timestamp', 'desc').get();
        
        if (snap.empty) { 
            select.innerHTML = '<option value="" disabled selected>Nenhum backup encontrado</option>'; 
            return; 
        }

        let options = '<option value="" disabled selected>Selecione um backup para visualizar ou restaurar</option>';
        todosOsBackups = {}; 
        
        snap.forEach(doc => {
            const data = doc.data();
            todosOsBackups[doc.id] = data; 
            const nomeExibicao = data.nome_backup || data.data_formatada || "Lote de Propostas";
            options += `<option value="${doc.id}">${nomeExibicao} (${data.data_formatada || ''})</option>`;
        });
        
        select.innerHTML = options;

        const gridHistorico = document.getElementById('historico-grid');
        if (gridHistorico && !document.getElementById('btn-restaurar-container')) {
            const containerBotao = document.createElement('div');
            containerBotao.id = 'btn-restaurar-container';
            containerBotao.className = 'col-span-full mb-4 hidden';
            containerBotao.innerHTML = `
                <div class="glass-panel p-5 rounded-2xl border border-blue-500/30 bg-blue-900/10 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-xl">
                    <div class="text-center sm:text-left">
                        <h4 class="text-white font-black text-sm uppercase tracking-wide"><i class="fas fa-undo-alt mr-2 text-blue-400"></i> Restaurar Lote por Movimentação de Coleção</h4>
                        <p class="text-slate-400 text-xs mt-1">Deseja mover as propostas e pareceres arquivados desse documento de volta para as tabelas ativas?</p>
                    </div>
                    <button onclick="restaurarBackupAtivo()" id="btn-restaurar-acao" class="bg-blue-600 hover:bg-blue-500 text-white font-black px-6 py-3 rounded-xl text-xs uppercase tracking-wider transition-colors shadow-lg flex items-center gap-2">
                        Mover para o Painel Ativo <i class="fas fa-exchange-alt"></i>
                    </button>
                </div>`;
            gridHistorico.parentNode.insertBefore(containerBotao, gridHistorico);
        }

    } catch (e) {
        console.error("Erro ao puxar histórico:", e);
        select.innerHTML = '<option value="" disabled selected>Erro de conexão com o banco.</option>'; 
    }
}

document.getElementById('hist-backup-select')?.addEventListener('change', async () => {
    const backupId = document.getElementById('hist-backup-select').value;
    if(!backupId) return;
    const data = todosOsBackups[backupId];
    toggleDisplay('btn-restaurar-container', true);
    
    // Assegura que o cargo/badge 'Aprovada Liderança' será lido corretamente no Histórico
    const lideres = await fetchLideresNicks(); 
    renderizarGradePropostas(data.propostas, data.votos, lideres, 'historico-grid');
});

window.restaurarBackupAtivo = async () => {
    const backupId = document.getElementById('hist-backup-select').value;
    if (!backupId || !todosOsBackups[backupId]) { showToast("Selecione um lote primeiro.", "error"); return; }
    
    const confirmation = confirm("⚠️ ATENÇÃO - MOVIMENTAÇÃO DE DADOS!\n\nO sistema vai ler os dados guardados dentro deste documento do histórico e vai reinjetá-los diretamente nas coleções de propostas e pareceres ativos.\n\nDeseja realizar essa movimentação?");
    if (!confirmation) return;

    const btn = document.getElementById('btn-restaurar-acao');
    const originalText = btn.innerHTML;
    const t = showToast("Movendo documentos entre coleções...", "loading");

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Movendo dados...';

        const lote = todosOsBackups[backupId];
        const propostasParaRestaurar = lote.propostas || [];
        const votosParaRestaurar = lote.votos || [];

        const batch = db.batch();

        propostasParaRestaurar.forEach(p => {
            const ordemStr = (p.ordem || p.Ordem || '').toString();
            if(ordemStr) {
                const ref = db.collection("nexus_config").doc("Propostas").collection("lista_propostas").doc(ordemStr);
                batch.set(ref, {
                    ordem: p.ordem || p.Ordem,
                    autor: p.autor || p.Autor || '',
                    tipo: p.tipo || p.Categoria || 'Sugestão',
                    titulo: p.titulo || p.Titulo || '',
                    conteudo: p.conteudo || p.Conteudo || '',
                    data: p.data || p.Data || new Date().toISOString()
                }, { merge: true });
            }
        });

        votosParaRestaurar.forEach(v => {
            const ordemVoto = v.Ordem || v.ordem;
            const nickVoto = v.Nick || v.nick || '';
            const safeNick = nickVoto.replace(/[^a-zA-Z0-9_]/g, '');
            
            if (ordemVoto && safeNick) {
                const ref = db.collection("nexus_config").doc("Propostas").collection("votos_conselho").doc(`voto_${ordemVoto}_${safeNick}`);
                batch.set(ref, {
                    Nick: nickVoto,
                    Ordem: parseInt(ordemVoto),
                    Comentario: v.Comentario || v.comentario || '',
                    Veredito: v.Veredito || v.veredito || 'Pendente',
                    Timestamp: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
        });

        await batch.commit();
        t.remove();
        showToast("Movimentação concluída! Dados reativados na base.", "success");
        
        document.getElementById('nav-resultados').click();

    } catch (err) {
        console.error("Erro na movimentação interna:", err);
        t.remove();
        showToast("Falha ao mover documentos.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};
