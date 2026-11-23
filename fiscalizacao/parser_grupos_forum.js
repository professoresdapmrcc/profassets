/**
 * =========================================================================================
 * PARSER E SINCRONIZADOR AUTOMÁTICO DE GRUPOS DO FÓRUM RCC
 * Arquivo: parser_grupos_forum.js
 * 
 * Funcionalidades:
 * 1. Consulta automática dos 3 subfóruns: Professores (g10), Coordenadores (g458) e Graduadores (g231).
 * 2. Suporte completo a paginação: descobre e navega automaticamente por todas as páginas de cada grupo.
 * 3. Extração resiliente de membros através do HTML do fórum (DOM e Fallback Regex).
 * 4. Preenchimento automático dos textareas da ferramenta de fiscalização.
 * 5. Formatação 100% compatível com a verificação de nicks do script.js (extrairNicksDoSubforum).
 * 6. Suporte multiplataforma:
 *    - Integrado diretamente na ferramenta de fiscalização (index.html).
 *    - Colado no painel do fórum ("Gestão dos códigos JavaScript").
 *    - Executável como Bookmarklet ou no Console do navegador.
 *    - Cópia real para a Área de Transferência (Clipboard).
 *    - Comunicação entre abas (BroadcastChannel e localStorage).
 * =========================================================================================
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ParserGruposForum = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /**
     * Configurações dos 3 grupos oficiais no fórum da RCC
     */
    const CONFIG_GRUPOS = {
        professores: {
            id: 10,
            chave: 'professores',
            nome: 'Professores',
            urlPadrao: 'https://www.policiarcc.com/g10-professores',
            caminhoRelativo: '/g10-professores',
            textareaId: 'lista-forum-professores',
            statusId: 'status-forum-professores',
            cor: '#9333ea' // Purple
        },
        coordenadores: {
            id: 458,
            chave: 'coordenadores',
            nome: 'Coordenadores',
            urlPadrao: 'https://www.policiarcc.com/g458-coordenadores-dos-professores',
            caminhoRelativo: '/g458-coordenadores-dos-professores',
            textareaId: 'lista-forum-coordenadores',
            statusId: 'status-forum-coordenadores',
            cor: '#db2777' // Pink
        },
        graduadores: {
            id: 231,
            chave: 'graduadores',
            nome: 'Graduadores',
            urlPadrao: 'https://www.policiarcc.com/g231-graduadores-dos-professores',
            caminhoRelativo: '/g231-graduadores-dos-professores',
            textareaId: 'lista-forum-graduadores',
            statusId: 'status-forum-graduadores',
            cor: '#4f46e5' // Indigo
        }
    };

    /**
     * Contas do sistema / bots a serem ignoradas na listagem de membros
     */
    const CONTAS_IGNORADAS = new Set([
        'admin',
        'professores',
        'graduadores',
        'coordenadores dos professores',
        'com. de desenv. cultural',
        'dep. ap. intendência',
        'serv. proteção prof',
        '[prof] liderança'
    ].map(nick => normalizarNick(nick)));

    const CANAL_SINCRONIZACAO = 'rcc_fiscalizacao_sync';
    const CHAVE_STORAGE = 'rcc_fiscalizacao_grupos_cache';
    let canalSincronizacaoGlobal = null;

    function fecharCanalSincronizacao() {
        if (canalSincronizacaoGlobal) {
            try { canalSincronizacaoGlobal.close(); } catch (e) { }
            canalSincronizacaoGlobal = null;
        }
    }

    /**
     * Obtém a origem segura do fórum (mesmo domínio quando no navegador)
     */
    function obterOrigemForum() {
        if (typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname.includes('policiarcc.com')) {
            return window.location.origin;
        }
        return 'https://www.policiarcc.com';
    }

    /**
     * Normaliza nicks (remove caracteres invisíveis, espaços extras e normaliza NFC)
     */
    function normalizarNick(nick) {
        return String(nick || '')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .normalize('NFC')
            .trim()
            .toLowerCase();
    }

    /**
     * Decodifica entidades HTML comuns em strings (&amp;, &#039;, etc.)
     */
    function decodificarEntidadesHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/&apos;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&nbsp;/g, ' ')
            .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
            .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    }

    /**
     * Formata lista de membros para o formato esperado pelo script.js
     * Cada linha: "[num]\t[Nick]\tEnviar uma mensagem privada"
     */
    function formatarMembrosParaSubforum(membros) {
        if (!Array.isArray(membros) || membros.length === 0) return '';
        return membros
            .map((nick, idx) => `${idx + 1}\t${nick}\tEnviar uma mensagem privada`)
            .join('\n');
    }

    /**
     * Detecta se o HTML recebido é uma página de login (sessão expirada / não autenticado)
     */
    function verificarSePaginaDeLogin(html) {
        if (!html || typeof html !== 'string') return false;
        return (
            /<title>\s*Entrar\s*<\/title>/i.test(html) ||
            /name="login"|action=".*\/login.*"/i.test(html) ||
            (html.includes('Você precisa estar logado') || html.includes('login_box'))
        );
    }

    /**
     * Extrai os membros da página de grupo do fórum.
     * Suporta estrutura DOM (navegador) e Fallback Regex (Node / sem DOMParser).
     */
    function parsearMembrosDaPagina(html) {
        if (!html) return [];
        if (verificarSePaginaDeLogin(html)) {
            const erro = new Error('Usuário não autenticado no fórum. É necessário fazer login no fórum da RCC.');
            erro.tipo = 'AUTENTICACAO_NECESSARIA';
            throw erro;
        }

        const mapaMembros = new Map();

        // 1. Abordagem via DOMParser (se disponível no ambiente)
        if (typeof DOMParser !== 'undefined') {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                // Encontra todas as linhas de tabela (<tr>) que representam membros
                const linhas = doc.querySelectorAll('tr');
                linhas.forEach(linha => {
                    const temLinkMp = linha.querySelector('a[href*="/privmsg"], a[href*="mode=post"], [title*="mensagem privada" i], [alt*="mensagem privada" i]');
                    const temTextoMp = linha.textContent.includes('Enviar uma mensagem privada') || linha.textContent.includes('Mensagem privada');
                    const temInputMembro = linha.querySelector('input[name*="member"]');

                    if (temLinkMp || temTextoMp || temInputMembro) {
                        // Procura links de perfil de usuário (/u\d+ ou ?u=\d+) na linha
                        // Itera por todos os links para não pegar imagem/avatar com texto vazio antes do nick
                        const linksLinha = linha.querySelectorAll('a[href*="/u"]');
                        for (let i = 0; i < linksLinha.length; i++) {
                            const link = linksLinha[i];
                            const href = link.getAttribute('href') || '';
                            if (!/\/u\d+|[?&]u=\d+/i.test(href)) continue;

                            const nick = link.textContent.trim();
                            const nickNorm = normalizarNick(nick);
                            if (nickNorm.length >= 2 && !CONTAS_IGNORADAS.has(nickNorm) && !mapaMembros.has(nickNorm)) {
                                mapaMembros.set(nickNorm, nick);
                                break; // Encontrou o nick desta linha
                            }
                        }
                    }
                });

                // Fallback secundário no DOM: links de usuários dentro do formulário de grupo
                if (mapaMembros.size === 0) {
                    const containerGrupo = doc.querySelector('form[action*="groupcp"], table.forumline, #cp-main, .memberlist, table.table1');
                    if (containerGrupo) {
                        const links = containerGrupo.querySelectorAll('a[href*="/u"]');
                        links.forEach(link => {
                            if (link.closest('#header, #page-header, .navbar, #pun-navlinks, footer')) return;
                            const href = link.getAttribute('href') || '';
                            if (!/\/u\d+|[?&]u=\d+/i.test(href)) return;

                            const nick = link.textContent.trim();
                            const nickNorm = normalizarNick(nick);
                            if (nickNorm.length >= 2 && !CONTAS_IGNORADAS.has(nickNorm) && !mapaMembros.has(nickNorm)) {
                                mapaMembros.set(nickNorm, nick);
                            }
                        });
                    }
                }

                if (mapaMembros.size > 0) {
                    return Array.from(mapaMembros.values());
                }
            } catch (e) {
                // Se falhar o parser DOM, segue para o fallback regex
            }
        }

        // 2. Abordagem via Expressão Regular (universal, funciona no Node.js e no navegador)
        const regexLinha = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let matchLinha;
        while ((matchLinha = regexLinha.exec(html)) !== null) {
            const conteudoLinha = matchLinha[1];
            const temMp = /privmsg|mensagem privada|members\[\]/i.test(conteudoLinha);

            if (temMp) {
                const regexUsuario = /<a[^>]+href=["'][^"']*(?:\/u\d+|[?&]u=\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
                let matchUsuario;
                while ((matchUsuario = regexUsuario.exec(conteudoLinha)) !== null) {
                    const textoLimpo = decodificarEntidadesHtml(matchUsuario[1].replace(/<[^>]+>/g, '')).trim();
                    const nickNorm = normalizarNick(textoLimpo);
                    if (nickNorm.length >= 2 && !CONTAS_IGNORADAS.has(nickNorm) && !mapaMembros.has(nickNorm)) {
                        mapaMembros.set(nickNorm, textoLimpo);
                        break; // Encontrou nick da linha
                    }
                }
            }
        }

        // Fallback amplo com regex para links de perfil
        if (mapaMembros.size === 0) {
            const regexUserLink = /<a[^>]+href=["'][^"']*(?:\/u\d+|[?&]u=\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
            let matchUser;
            while ((matchUser = regexUserLink.exec(html)) !== null) {
                const textoLimpo = decodificarEntidadesHtml(matchUser[1].replace(/<[^>]+>/g, '')).trim();
                const nickNorm = normalizarNick(textoLimpo);
                if (nickNorm.length >= 2 && !CONTAS_IGNORADAS.has(nickNorm) && !mapaMembros.has(nickNorm)) {
                    if (!/^(perfil|profile|login|logout|entrar|sair|membros)$/i.test(textoLimpo)) {
                        mapaMembros.set(nickNorm, textoLimpo);
                    }
                }
            }
        }

        return Array.from(mapaMembros.values());
    }

    /**
     * Extrai todos os links de paginação válidos pertencentes a um determinado grupo.
     * Suporta padrões Forumeiros: /g10p50-..., ?start=50, etc.
     * Garante resolução absoluta da URL sem falhas de URL relativa.
     */
    function extrairLinksDePaginacao(html, urlBase, idGrupo) {
        if (!html) return [];
        const linksEncontrados = new Set();
        const baseOrigin = obterOrigemForum();

        // Garante que a base para resolução de URL seja sempre absoluta
        let baseAbsoluta;
        try {
            baseAbsoluta = new URL(urlBase || '', baseOrigin).href;
        } catch (e) {
            baseAbsoluta = baseOrigin + '/';
        }

        // Expressão para validar estritamente o grupo solicitado
        const regexPadraoGrupo = idGrupo
            ? new RegExp(`(?:/g${idGrupo}(?:p\\d+)?(?:-[^"\\s>]*)?|[?&](?:g|group_id)=${idGrupo}\\b)`, 'i')
            : /\/g\d+/i;

        // Extrai todos os hrefs presentes em <a>
        const regexHref = /<a[^>]+href=["']?([^"'\s>]+)["']?[^>]*>([\s\S]*?)<\/a>/gi;
        let match;

        while ((match = regexHref.exec(html)) !== null) {
            const href = match[1].trim();
            const texto = match[2].replace(/<[^>]+>/g, '').trim();

            if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;

            let urlAbsoluta;
            try {
                urlAbsoluta = new URL(href, baseAbsoluta);
                urlAbsoluta.hash = ''; // remove âncoras
            } catch (e) {
                continue;
            }

            const caminhoEQuery = urlAbsoluta.pathname + urlAbsoluta.search;

            // Verifica se pertence ao grupo específico (ou se é paginação relativa no mesmo grupo)
            const eDoGrupo = regexPadraoGrupo.test(caminhoEQuery) || (
                idGrupo && /[?&]start=\d+/i.test(href) && baseAbsoluta.includes(`g${idGrupo}`)
            );

            // Verifica se tem características de paginação
            const temPadraoPaginacao = (
                /[?&]start=\d+/i.test(urlAbsoluta.search) ||
                /\/g\d+p\d+/i.test(urlAbsoluta.pathname) ||
                /[?&]page=\d+/i.test(urlAbsoluta.search) ||
                /^\d+$/.test(texto) ||
                /seguinte|próximo|next|>|»/i.test(texto)
            );

            if (eDoGrupo && temPadraoPaginacao) {
                // Normaliza removendo barra final
                const normalizada = urlAbsoluta.href.replace(/\/$/, '');
                linksEncontrados.add(normalizada);
            }
        }

        return Array.from(linksEncontrados);
    }

    /**
     * Busca todos os membros de um grupo específico no fórum,
     * percorrendo automaticamente todas as páginas disponíveis.
     */
    async function buscarTodosMembrosDoGrupo(tipoOuConfig, opcoes = {}) {
        const config = typeof tipoOuConfig === 'string'
            ? CONFIG_GRUPOS[tipoOuConfig.toLowerCase()]
            : tipoOuConfig;

        if (!config) {
            throw new Error(`Configuração de grupo inválida: ${tipoOuConfig}`);
        }

        const fetchFn = opcoes.fetchFn || (typeof window !== 'undefined' && window.fetch ? window.fetch.bind(window) : null);
        if (!fetchFn) {
            throw new Error('Função de fetch não disponível no ambiente.');
        }

        const delayMs = typeof opcoes.delayMs === 'number' ? opcoes.delayMs : 250;
        const maxPaginas = opcoes.maxPaginas || 50;
        const onProgress = typeof opcoes.onProgress === 'function' ? opcoes.onProgress : () => { };

        const baseOrigin = obterOrigemForum();
        const urlInicial = new URL(config.caminhoRelativo, baseOrigin).href.replace(/\/$/, '');

        const filaUrls = [urlInicial];
        const urlsVisitadas = new Set();
        const mapaMembros = new Map();
        let totalPaginasEstimadas = 1;

        onProgress({
            fase: 'iniciando',
            grupo: config.chave,
            nomeGrupo: config.nome,
            paginaAtual: 1,
            totalPaginas: 1,
            membrosEncontrados: 0,
            mensagem: `Iniciando consulta de ${config.nome}...`
        });

        while (filaUrls.length > 0 && urlsVisitadas.size < maxPaginas) {
            const urlAtual = filaUrls.shift();
            const urlNormalizada = urlAtual.replace(/#.*$/, '').replace(/\/$/, '');

            if (urlsVisitadas.has(urlNormalizada)) continue;
            urlsVisitadas.add(urlNormalizada);

            const numeroPagina = urlsVisitadas.size;
            totalPaginasEstimadas = Math.max(totalPaginasEstimadas, numeroPagina + filaUrls.length);

            onProgress({
                fase: 'carregando_pagina',
                grupo: config.chave,
                nomeGrupo: config.nome,
                paginaAtual: numeroPagina,
                totalPaginas: totalPaginasEstimadas,
                membrosEncontrados: mapaMembros.size,
                mensagem: `Consultando página ${numeroPagina} de ${config.nome}...`
            });

            let html = '';
            try {
                const resposta = await fetchFn(urlAtual, {
                    credentials: 'include',
                    headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml' }
                });

                if (!resposta.ok) {
                    throw new Error(`Falha HTTP ${resposta.status} ao carregar ${urlAtual}`);
                }

                html = await resposta.text();
            } catch (erro) {
                // Erro de rede ou CORS
                if (erro.name === 'TypeError' && erro.message.includes('Failed to fetch')) {
                    const erroCors = new Error('Bloqueio de CORS detectado. Para sincronização direta, utilize a ferramenta hospedada no próprio fórum ou via Bookmarklet.');
                    erroCors.tipo = 'CORS_OU_ORIGEM';
                    throw erroCors;
                }
                throw erro;
            }

            // Extrai membros da página atual
            const membrosDaPagina = parsearMembrosDaPagina(html);
            membrosDaPagina.forEach(nick => {
                const norm = normalizarNick(nick);
                if (!mapaMembros.has(norm)) {
                    mapaMembros.set(norm, nick);
                }
            });

            // Extrai links de paginação e enfileira novas páginas
            const linksPaginacao = extrairLinksDePaginacao(html, urlAtual, config.id);
            linksPaginacao.forEach(link => {
                const linkNorm = link.replace(/#.*$/, '').replace(/\/$/, '');
                if (!urlsVisitadas.has(linkNorm) && !filaUrls.includes(linkNorm)) {
                    filaUrls.push(linkNorm);
                }
            });

            totalPaginasEstimadas = urlsVisitadas.size + filaUrls.length;

            // Pausa educada entre requisições
            if (filaUrls.length > 0 && delayMs > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        const membrosFinais = Array.from(mapaMembros.values());
        const textoFormatado = formatarMembrosParaSubforum(membrosFinais);

        onProgress({
            fase: 'concluido',
            grupo: config.chave,
            nomeGrupo: config.nome,
            paginaAtual: urlsVisitadas.size,
            totalPaginas: urlsVisitadas.size,
            membrosEncontrados: membrosFinais.length,
            mensagem: `${config.nome}: ${membrosFinais.length} membros encontrados em ${urlsVisitadas.size} página(s).`
        });

        return {
            chave: config.chave,
            nome: config.nome,
            id: config.id,
            membros: membrosFinais,
            totalMembros: membrosFinais.length,
            paginasConsultadas: urlsVisitadas.size,
            textoFormatado: textoFormatado
        };
    }

    /**
     * Sincroniza todos os 3 grupos oficiais em sequência.
     */
    async function sincronizarTodosOsGrupos(opcoes = {}) {
        const onProgress = typeof opcoes.onProgress === 'function' ? opcoes.onProgress : () => { };
        const resultados = {};
        const chaves = ['professores', 'coordenadores', 'graduadores'];

        onProgress({
            fase: 'iniciando_todos',
            mensagem: 'Iniciando sincronização automática de todos os grupos do fórum...'
        });

        for (let i = 0; i < chaves.length; i++) {
            const chave = chaves[i];
            const config = CONFIG_GRUPOS[chave];

            onProgress({
                fase: 'progresso_geral',
                indiceGrupo: i + 1,
                totalGrupos: chaves.length,
                grupoAtual: config.nome,
                mensagem: `[${i + 1}/3] Buscando membros de ${config.nome}...`
            });

            resultados[chave] = await buscarTodosMembrosDoGrupo(config, {
                ...opcoes,
                onProgress: progressoSub => {
                    onProgress({
                        ...progressoSub,
                        indiceGrupo: i + 1,
                        totalGrupos: chaves.length
                    });
                }
            });
        }

        onProgress({
            fase: 'todos_concluidos',
            resultados,
            mensagem: 'Todos os 3 grupos foram sincronizados com sucesso!'
        });

        // Salva cache em localStorage e notifica canal se estiver no navegador
        salvarCacheGrupos(resultados);
        notificarOutrasAbas(resultados);

        return resultados;
    }

    let preenchendoProgramaticamente = false;

    /**
     * Preenche os campos textareas na interface da fiscalização e dispara os eventos de input
     */
    function preencherCamposFiscalizacao(resultados) {
        if (typeof document === 'undefined') return 0;
        let preenchidos = 0;
        preenchendoProgramaticamente = true;

        try {
            Object.keys(CONFIG_GRUPOS).forEach(chave => {
                const config = CONFIG_GRUPOS[chave];
                const resultado = resultados[chave];
                if (!resultado) return;

                const textarea = document.getElementById(config.textareaId);
                if (textarea) {
                    textarea.value = resultado.textoFormatado;
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    textarea.dispatchEvent(new Event('change', { bubbles: true }));
                    preenchidos++;
                }
            });

            // Atualiza contadores globais se a função existir
            if (typeof window.atualizarEstadoDasFontes === 'function') {
                window.atualizarEstadoDasFontes();
            }
        } finally {
            preenchendoProgramaticamente = false;
        }

        return preenchidos;
    }

    /**
     * Salva o cache de resultados no localStorage para persistência e compartilhamento
     */
    function salvarCacheGrupos(resultados) {
        if (typeof localStorage === 'undefined') return;
        try {
            const payload = {
                timestamp: Date.now(),
                resultados: {
                    professores: resultados.professores ? {
                        membros: resultados.professores.membros,
                        total: resultados.professores.totalMembros,
                        texto: resultados.professores.textoFormatado
                    } : null,
                    coordenadores: resultados.coordenadores ? {
                        membros: resultados.coordenadores.membros,
                        total: resultados.coordenadores.totalMembros,
                        texto: resultados.coordenadores.textoFormatado
                    } : null,
                    graduadores: resultados.graduadores ? {
                        membros: resultados.graduadores.membros,
                        total: resultados.graduadores.totalMembros,
                        texto: resultados.graduadores.textoFormatado
                    } : null
                }
            };
            localStorage.setItem(CHAVE_STORAGE, JSON.stringify(payload));
        } catch (e) {
            // Ignora erro de cota de armazenamento
        }
    }

    /**
     * Carrega cache do localStorage se existir e for recente (menos de 2 horas)
     */
    function carregarCacheGrupos() {
        if (typeof localStorage === 'undefined') return null;
        try {
            const raw = localStorage.getItem(CHAVE_STORAGE);
            if (!raw) return null;
            const dados = JSON.parse(raw);
            const idadeMs = Date.now() - (dados.timestamp || 0);
            if (idadeMs < 2 * 60 * 60 * 1000) {
                return dados.resultados;
            }
        } catch (e) {
            return null;
        }
        return null;
    }

    /**
     * Restaura os dados do cache local nos textareas caso estejam vazios
     */
    function restaurarCacheSeDisponivel() {
        const cache = carregarCacheGrupos();
        if (!cache) return false;

        const resFormatado = {
            professores: cache.professores ? { textoFormatado: cache.professores.texto, totalMembros: cache.professores.total } : null,
            coordenadores: cache.coordenadores ? { textoFormatado: cache.coordenadores.texto, totalMembros: cache.coordenadores.total } : null,
            graduadores: cache.graduadores ? { textoFormatado: cache.graduadores.texto, totalMembros: cache.graduadores.total } : null
        };

        const preenchidos = preencherCamposFiscalizacao(resFormatado);
        return preenchidos > 0;
    }

    /**
     * Notifica outras abas através do BroadcastChannel
     */
    function notificarOutrasAbas(resultados) {
        if (typeof BroadcastChannel === 'undefined') return;
        try {
            const canal = new BroadcastChannel(CANAL_SINCRONIZACAO);
            canal.postMessage({
                tipo: 'SINCRONIZACAO_CONCLUIDA',
                timestamp: Date.now(),
                resultados: {
                    professores: resultados.professores ? resultados.professores.textoFormatado : '',
                    coordenadores: resultados.coordenadores ? resultados.coordenadores.textoFormatado : '',
                    graduadores: resultados.graduadores ? resultados.graduadores.textoFormatado : ''
                }
            });
            const timer = setTimeout(() => {
                try { canal.close(); } catch (e) { }
            }, 200);
            if (timer && typeof timer.unref === 'function') timer.unref();
        } catch (e) { }
    }

    /**
     * Copia texto unificado ou de grupo específico para a área de transferência
     */
    async function copiarParaAreaDeTransferencia(texto) {
        if (!texto) return false;
        if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            try {
                await navigator.clipboard.writeText(texto);
                return true;
            } catch (e) {
                // Fallback para document.execCommand se falhar permissão assíncrona
            }
        }
        if (typeof document !== 'undefined') {
            try {
                const temp = document.createElement('textarea');
                temp.value = texto;
                temp.setAttribute('readonly', '');
                temp.style.position = 'fixed';
                temp.style.left = '-9999px';
                temp.style.top = '-9999px';
                const container = document.body || document.documentElement;
                if (!container) return false;
                container.appendChild(temp);
                temp.select();
                const sucesso = document.execCommand('copy');
                container.removeChild(temp);
                return sucesso;
            } catch (e) {
                return false;
            }
        }
        return false;
    }

    /**
     * Busca um único grupo (com todas as páginas) e copia diretamente para a Área de Transferência
     */
    async function copiarGrupoParaTransferencia(tipoOuConfig, opcoes = {}) {
        const resultado = await buscarTodosMembrosDoGrupo(tipoOuConfig, opcoes);
        const copiado = await copiarParaAreaDeTransferencia(resultado.textoFormatado);
        return {
            ...resultado,
            copiado
        };
    }

    /**
     * Gera o código do Bookmarklet para os usuários utilizarem na barra de favoritos
     */
    function gerarCodigoBookmarklet() {
        return `javascript:(async function(){
            const btn = document.createElement('div');
            btn.style.cssText = 'position:fixed;top:20px;right:20px;z-index:999999;background:#4f46e5;color:#fff;padding:12px 20px;border-radius:12px;font-family:sans-serif;font-weight:bold;box-shadow:0 10px 25px rgba(0,0,0,0.3);cursor:pointer;';
            btn.innerText = '⚡ Sincronizando Grupos RCC...';
            document.body.appendChild(btn);
            try {
                const res = await window.ParserGruposForum.sincronizarTodosOsGrupos();
                const total = (res.professores?.totalMembros || 0) + (res.coordenadores?.totalMembros || 0) + (res.graduadores?.totalMembros || 0);
                const copiou = await window.ParserGruposForum.copiarParaAreaDeTransferencia(
                    '--- PROFESSORES ---\\n' + (res.professores?.textoFormatado || '') + '\\n\\n--- COORDENADORES ---\\n' + (res.coordenadores?.textoFormatado || '') + '\\n\\n--- GRADUADORES ---\\n' + (res.graduadores?.textoFormatado || '')
                );
                btn.innerText = copiou ? ('✅ ' + total + ' membros sincronizados e copiados!') : ('✅ ' + total + ' membros sincronizados!');
                btn.style.background = '#10b981';
                setTimeout(() => btn.remove(), 4000);
            } catch(e) {
                btn.innerText = '❌ Erro: ' + e.message;
                btn.style.background = '#ef4444';
                setTimeout(() => btn.remove(), 5000);
            }
        })();`;
    }

    /**
     * =========================================================================
     * INTEGRAÇÃO COM A INTERFACE VISUAL (DOM)
     * Monta o painel e botão mestre "Sincronizar Grupos" no topo dos subfóruns
     * =========================================================================
     */
    function integrarInterfaceFiscalizacao() {
        if (typeof document === 'undefined') return;

        // Escuta mensagens de outras abas via BroadcastChannel
        if (typeof BroadcastChannel !== 'undefined' && !canalSincronizacaoGlobal) {
            try {
                canalSincronizacaoGlobal = new BroadcastChannel(CANAL_SINCRONIZACAO);
                canalSincronizacaoGlobal.onmessage = (evento) => {
                    if (typeof document === 'undefined') return;
                    if (evento.data && evento.data.tipo === 'SINCRONIZACAO_CONCLUIDA' && evento.data.resultados) {
                        const res = evento.data.resultados;
                        let preencheu = false;
                        if (res.professores && document.getElementById('lista-forum-professores')) {
                            document.getElementById('lista-forum-professores').value = res.professores;
                            document.getElementById('lista-forum-professores').dispatchEvent(new Event('input', { bubbles: true }));
                            preencheu = true;
                        }
                        if (res.coordenadores && document.getElementById('lista-forum-coordenadores')) {
                            document.getElementById('lista-forum-coordenadores').value = res.coordenadores;
                            document.getElementById('lista-forum-coordenadores').dispatchEvent(new Event('input', { bubbles: true }));
                            preencheu = true;
                        }
                        if (res.graduadores && document.getElementById('lista-forum-graduadores')) {
                            document.getElementById('lista-forum-graduadores').value = res.graduadores;
                            document.getElementById('lista-forum-graduadores').dispatchEvent(new Event('input', { bubbles: true }));
                            preencheu = true;
                        }
                        if (preencheu && typeof window !== 'undefined' && typeof window.showToast === 'function') {
                            window.showToast('Grupos sincronizados automaticamente a partir da outra aba do fórum!', 'success');
                        }
                    }
                };
            } catch (e) { }
        }

        const campoProfessores = document.getElementById('lista-forum-professores');
        const campoCoordenadores = document.getElementById('lista-forum-coordenadores');
        const campoGraduadores = document.getElementById('lista-forum-graduadores');

        // Se os campos da ferramenta de fiscalização existem na página
        if (campoProfessores && campoCoordenadores && campoGraduadores) {
            // Remove qualquer resquício do banner antigo se presente
            const painelAntigo = document.getElementById('painel-sincronizacao-forum');
            if (painelAntigo) painelAntigo.remove();

            configurarControlesFiscalizacao();

            const camposTinhamDados = Boolean(
                campoProfessores.value.trim() ||
                campoCoordenadores.value.trim() ||
                campoGraduadores.value.trim()
            );

            // 1. Restauração imediata de cache caso os campos estejam vazios (0 atrito)
            if (!camposTinhamDados) {
                restaurarCacheSeDisponivel();
            }

            atualizarIndicadorStatusEBadge();

            // 2. Auto-importação imediata e transparente ao vivo no domínio do fórum
            if (typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname.includes('policiarcc.com') && typeof window.fetch === 'function') {
                if (!camposTinhamDados) {
                    executarSincronizacaoSilenciosa().catch(erro => {
                        console.warn('[ParserGruposForum] Auto-sincronização em segundo plano:', erro);
                    });
                }
            }
        } else {
            // Se estiver em outra página do fórum (ex: navegando normalmente em policiarcc.com)
            montarWidgetFlutuanteNoForum();
        }
    }

    let usuarioEditouManualmente = false;
    let abaModalAtiva = 'todos';
    let filtroTextoModal = '';
    let controlesConfigurados = false;

    /**
     * Extrai nicks de um texto de subfórum no formato da ferramenta
     */
    function extrairNicksDeTextoSubforum(texto) {
        if (!texto || typeof texto !== 'string') return [];
        const linhas = texto.split('\n');
        const nicks = [];
        const nicksNormalizados = new Set();
        for (let linha of linhas) {
            linha = linha.trim();
            if (!linha) continue;
            let candidato = '';
            if (linha.includes('Enviar uma mensagem privada')) {
                const partes = linha.split('\t');
                if (partes.length >= 2 && partes[1].trim()) {
                    candidato = partes[1].trim();
                } else {
                    const match = linha.match(/^\d+[\s\t]+([^\t\n]+?)(?:[\s\t]+Enviar uma mensagem privada|\s*$)/i);
                    candidato = match && match[1] ? match[1].trim() : linha;
                }
            } else if (linha.includes('\t')) {
                const partes = linha.split('\t');
                if (/^\d+$/.test(partes[0].trim()) && partes[1]) {
                    candidato = partes[1].trim();
                } else {
                    candidato = partes[0].trim();
                }
            } else {
                const matchNum = linha.match(/^(?:\d+[\.\)\s-]+)?(.+)$/);
                candidato = matchNum && matchNum[1] ? matchNum[1].trim() : linha;
            }

            const norm = normalizarNick(candidato);
            if (norm.length >= 2 && !CONTAS_IGNORADAS.has(norm) && !nicksNormalizados.has(norm)) {
                const limpo = candidato.replace(/\s*Enviar uma mensagem privada\s*$/i, '').trim();
                nicks.push(limpo);
                nicksNormalizados.add(norm);
            }
        }
        return nicks;
    }

    /**
     * Retorna os membros carregados atualmente (priorizando textareas e fallback para cache)
     */
    function obterMembrosCarregados() {
        const dados = {
            professores: [],
            coordenadores: [],
            graduadores: [],
            total: 0
        };

        const cache = carregarCacheGrupos();
        if (cache) {
            if (cache.professores && Array.isArray(cache.professores.membros)) {
                dados.professores = [...cache.professores.membros];
            }
            if (cache.coordenadores && Array.isArray(cache.coordenadores.membros)) {
                dados.coordenadores = [...cache.coordenadores.membros];
            }
            if (cache.graduadores && Array.isArray(cache.graduadores.membros)) {
                dados.graduadores = [...cache.graduadores.membros];
            }
        }

        if (typeof document !== 'undefined') {
            const taProf = document.getElementById('lista-forum-professores');
            const taCoord = document.getElementById('lista-forum-coordenadores');
            const taGrad = document.getElementById('lista-forum-graduadores');

            if (taProf && taProf.value.trim()) {
                const nicks = extrairNicksDeTextoSubforum(taProf.value);
                if (nicks.length > 0) dados.professores = nicks;
            }
            if (taCoord && taCoord.value.trim()) {
                const nicks = extrairNicksDeTextoSubforum(taCoord.value);
                if (nicks.length > 0) dados.coordenadores = nicks;
            }
            if (taGrad && taGrad.value.trim()) {
                const nicks = extrairNicksDeTextoSubforum(taGrad.value);
                if (nicks.length > 0) dados.graduadores = nicks;
            }
        }

        dados.total = dados.professores.length + dados.coordenadores.length + dados.graduadores.length;
        return dados;
    }

    /**
     * Atualiza o badge numérico e a mensagem de status da sincronização
     */
    function atualizarIndicadorStatusEBadge(resultados, ehAoVivo = false) {
        if (typeof document === 'undefined') return;

        const dados = resultados ? {
            professores: resultados.professores?.membros || [],
            coordenadores: resultados.coordenadores?.membros || [],
            graduadores: resultados.graduadores?.membros || [],
            total: (resultados.professores?.totalMembros || 0) +
                   (resultados.coordenadores?.totalMembros || 0) +
                   (resultados.graduadores?.totalMembros || 0)
        } : obterMembrosCarregados();

        const badge = document.getElementById('badge-total-membros-importados');
        if (badge) {
            badge.textContent = String(dados.total);
        }

        const modalBadge = document.getElementById('modal-badge-total');
        if (modalBadge) {
            modalBadge.textContent = `${dados.total} membros`;
        }

        const textoStatus = document.getElementById('texto-status-forum');
        if (textoStatus) {
            if (dados.total > 0) {
                const tipoTexto = ehAoVivo ? 'sincronizados' : 'carregados';
                textoStatus.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span> Subfóruns: ${tipoTexto} (${dados.total} membros)`;
            } else {
                textoStatus.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-slate-400 mr-1.5"></span> Subfóruns: aguardando importação`;
            }
        }

        const modal = document.getElementById('modal-membros-forum');
        if (modal && !modal.classList.contains('hidden')) {
            renderizarListaMembrosModal();
        }
    }

    /**
     * Alterna a visibilidade do container de subfóruns manuais
     */
    function alternarContainerManual(forcar) {
        if (typeof document === 'undefined') return;
        const container = document.getElementById('container-subforuns-manual');
        const btnToggle = document.getElementById('btn-toggle-edicao-manual');
        const textoToggle = document.getElementById('texto-btn-toggle-manual');
        const iconeChevron = document.getElementById('icone-chevron-manual');

        if (!container) return;

        const deveAbrir = typeof forcar === 'boolean' ? forcar : container.classList.contains('hidden');

        if (deveAbrir) {
            container.classList.remove('hidden');
            if (textoToggle) textoToggle.textContent = 'Ocultar listas manuais';
            if (iconeChevron) iconeChevron.classList.add('rotate-180');
            container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            container.classList.add('hidden');
            if (textoToggle) textoToggle.textContent = 'Inserir listas manualmente';
            if (iconeChevron) iconeChevron.classList.remove('rotate-180');
        }
    }

    /**
     * Obtém a lista de membros filtrada de acordo com a aba e o filtro de busca ativos
     */
    function obterItensFiltradosParaExibicao(filtro = filtroTextoModal, grupo = abaModalAtiva) {
        const dados = obterMembrosCarregados();
        const filtroNorm = normalizarNick(filtro || '');
        const itens = [];

        if (grupo === 'todos' || grupo === 'professores') {
            dados.professores.forEach(nick => {
                if (!filtroNorm || normalizarNick(nick).includes(filtroNorm)) {
                    itens.push({ nick, grupo: 'Professores', corBadge: 'purple' });
                }
            });
        }
        if (grupo === 'todos' || grupo === 'coordenadores') {
            dados.coordenadores.forEach(nick => {
                if (!filtroNorm || normalizarNick(nick).includes(filtroNorm)) {
                    itens.push({ nick, grupo: 'Coordenadores', corBadge: 'pink' });
                }
            });
        }
        if (grupo === 'todos' || grupo === 'graduadores') {
            dados.graduadores.forEach(nick => {
                if (!filtroNorm || normalizarNick(nick).includes(filtroNorm)) {
                    itens.push({ nick, grupo: 'Graduadores', corBadge: 'indigo' });
                }
            });
        }
        return itens;
    }

    /**
     * Abre o modal de visualização de membros importados do fórum
     */
    function abrirModalMembrosForum() {
        if (typeof document === 'undefined') return;
        const modal = document.getElementById('modal-membros-forum');
        if (!modal) return;

        renderizarListaMembrosModal();
        modal.classList.remove('hidden');
        if (document.body) {
            document.body.classList.add('overflow-hidden');
        }

        const inputFiltro = document.getElementById('filtro-membros-modal');
        if (inputFiltro) {
            inputFiltro.value = '';
            filtroTextoModal = '';
            setTimeout(() => inputFiltro.focus(), 50);
        }
    }

    /**
     * Fecha o modal de visualização de membros importados
     */
    function fecharModalMembrosForum() {
        if (typeof document === 'undefined') return;
        const modal = document.getElementById('modal-membros-forum');
        if (modal) modal.classList.add('hidden');
        if (document.body) {
            document.body.classList.remove('overflow-hidden');
        }
    }

    /**
     * Renderiza os membros na lista do modal com suporte a filtro e abas
     */
    function renderizarListaMembrosModal(filtro = filtroTextoModal, grupo = abaModalAtiva) {
        if (typeof document === 'undefined') return;
        const containerLista = document.getElementById('modal-lista-membros-conteudo');
        if (!containerLista) return;

        const dados = obterMembrosCarregados();

        const contTodos = document.getElementById('aba-cont-todos');
        const contProf = document.getElementById('aba-cont-professores');
        const contCoord = document.getElementById('aba-cont-coordenadores');
        const contGrad = document.getElementById('aba-cont-graduadores');

        if (contTodos) contTodos.textContent = `(${dados.total})`;
        if (contProf) contProf.textContent = `(${dados.professores.length})`;
        if (contCoord) contCoord.textContent = `(${dados.coordenadores.length})`;
        if (contGrad) contGrad.textContent = `(${dados.graduadores.length})`;

        const itensParaExibir = obterItensFiltradosParaExibicao(filtro, grupo);

        if (itensParaExibir.length === 0) {
            containerLista.innerHTML = `
                <div class="text-center py-10">
                    <div class="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 text-xl mb-2">
                        <i class="fa-solid fa-user-slash"></i>
                    </div>
                    <p class="text-xs font-bold text-slate-500 dark:text-slate-400">Nenhum membro encontrado</p>
                    <p class="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        ${filtro ? 'Nenhum nick corresponde ao filtro digitado.' : 'Aguardando sincronização dos subfóruns ou insira as listas manualmente.'}
                    </p>
                </div>
            `;
            return;
        }

        const CORES_BADGE = {
            purple: {
                bg: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
                text: 'text-purple-600 dark:text-purple-400'
            },
            pink: {
                bg: 'bg-pink-500/10 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400',
                text: 'text-pink-600 dark:text-pink-400'
            },
            indigo: {
                bg: 'bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
                text: 'text-indigo-600 dark:text-indigo-400'
            }
        };

        containerLista.innerHTML = `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                ${itensParaExibir.map(item => {
                    const estilo = CORES_BADGE[item.corBadge] || CORES_BADGE.purple;
                    return `
                    <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 hover:border-purple-500/40 transition-colors">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <div class="w-7 h-7 rounded-lg ${estilo.bg} flex items-center justify-center text-xs shrink-0 font-bold">
                                <i class="fa-solid fa-user"></i>
                            </div>
                            <div class="truncate">
                                <span class="text-xs font-bold text-slate-800 dark:text-slate-100 block truncate" title="${item.nick}">${item.nick}</span>
                                <span class="text-[10px] font-semibold ${estilo.text}">${item.grupo}</span>
                            </div>
                        </div>
                        <button type="button" class="btn-copiar-nick-individual p-1.5 rounded-lg text-slate-400 hover:text-purple-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all shrink-0" data-nick="${item.nick}" title="Copiar nick">
                            <i class="fa-regular fa-copy text-xs"></i>
                        </button>
                    </div>
                `;}).join('')}
            </div>
        `;

        if (typeof containerLista.querySelectorAll === 'function') {
            containerLista.querySelectorAll('.btn-copiar-nick-individual').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const nick = btn.getAttribute('data-nick');
                    if (nick) {
                        await copiarParaAreaDeTransferencia(nick);
                        const icone = btn.querySelector('i');
                        if (icone) icone.className = 'fa-solid fa-check text-emerald-400 text-xs';
                        setTimeout(() => {
                            if (icone) icone.className = 'fa-regular fa-copy text-xs';
                        }, 2000);
                    }
                });
            });
        }
    }

    /**
     * Configura interações visuais e eventos de controle da ferramenta
     */
    function configurarControlesFiscalizacao() {
        if (typeof document === 'undefined' || controlesConfigurados) return;
        controlesConfigurados = true;

        // Garante que a barra de ações e o status fiquem sempre em linha única (sem quebra)
        const statusElem = document.getElementById('status-sincronizacao-forum');
        const barraAcoes = statusElem ? statusElem.parentElement : null;
        if (barraAcoes) {
            barraAcoes.classList.remove('flex-wrap');
            barraAcoes.classList.add('flex-nowrap');
            if (barraAcoes.style) barraAcoes.style.flexWrap = 'nowrap';
        }
        if (statusElem && statusElem.style) {
            statusElem.style.whiteSpace = 'nowrap';
            statusElem.style.overflow = 'hidden';
            statusElem.style.textOverflow = 'ellipsis';
            statusElem.style.minWidth = '0';
        }
        const containerBotoes = statusElem ? statusElem.nextElementSibling : null;
        if (containerBotoes) {
            containerBotoes.classList.add('shrink-0');
            if (containerBotoes.style) containerBotoes.style.flexShrink = '0';
        }

        if (typeof document !== 'undefined' && document.head && !document.getElementById('estilo-parser-linha-unica')) {
            const estilo = document.createElement('style');
            estilo.id = 'estilo-parser-linha-unica';
            estilo.textContent = `
                #status-sincronizacao-forum {
                    white-space: nowrap !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                    min-width: 0 !important;
                }
                #status-sincronizacao-forum + div,
                #status-sincronizacao-forum ~ div {
                    flex-shrink: 0 !important;
                }
            `;
            document.head.appendChild(estilo);
        }

        const btnToggleManual = document.getElementById('btn-toggle-edicao-manual');
        if (btnToggleManual) {
            btnToggleManual.addEventListener('click', () => alternarContainerManual());
        }

        const btnFecharManual = document.getElementById('btn-fechar-edicao-manual');
        if (btnFecharManual) {
            btnFecharManual.addEventListener('click', () => alternarContainerManual(false));
        }

        const btnReSyncManual = document.getElementById('btn-re-sincronizar-manual');
        if (btnReSyncManual) {
            btnReSyncManual.addEventListener('click', async () => {
                try {
                    await executarSincronizacaoCompleta();
                } catch (e) { }
            });
        }

        const btnVerMembros = document.getElementById('btn-ver-membros-forum');
        if (btnVerMembros) {
            btnVerMembros.addEventListener('click', abrirModalMembrosForum);
        }

        const btnFecharModal = document.getElementById('btn-fechar-modal-membros');
        if (btnFecharModal) {
            btnFecharModal.addEventListener('click', fecharModalMembrosForum);
        }

        const btnFecharModalRodape = document.getElementById('btn-fechar-modal-rodape');
        if (btnFecharModalRodape) {
            btnFecharModalRodape.addEventListener('click', fecharModalMembrosForum);
        }

        const modalMembros = document.getElementById('modal-membros-forum');
        if (modalMembros) {
            modalMembros.addEventListener('click', (e) => {
                if (e.target === modalMembros) fecharModalMembrosForum();
            });
        }

        if (typeof document.addEventListener === 'function') {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && modalMembros && !modalMembros.classList.contains('hidden')) {
                    fecharModalMembrosForum();
                }
            });
        }

        const tabBtns = typeof document.querySelectorAll === 'function' ? document.querySelectorAll('.tab-grupo-btn') : [];
        if (tabBtns && typeof tabBtns.forEach === 'function') {
            tabBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const grupo = btn.getAttribute('data-aba-grupo') || 'todos';
                    abaModalAtiva = grupo;
                    tabBtns.forEach(b => {
                        b.classList.remove('bg-purple-600', 'text-white', 'shadow-sm');
                        b.classList.add('text-slate-600', 'dark:text-slate-300');
                    });
                    btn.classList.add('bg-purple-600', 'text-white', 'shadow-sm');
                    btn.classList.remove('text-slate-600', 'dark:text-slate-300');
                    renderizarListaMembrosModal();
                });
            });
        }

        const inputFiltro = document.getElementById('filtro-membros-modal');
        if (inputFiltro) {
            inputFiltro.addEventListener('input', (e) => {
                filtroTextoModal = e.target.value.trim();
                renderizarListaMembrosModal();
            });
        }

        const btnCopiarTodos = document.getElementById('btn-copiar-todos-modal');
        if (btnCopiarTodos) {
            btnCopiarTodos.addEventListener('click', async () => {
                const itens = obterItensFiltradosParaExibicao(filtroTextoModal, abaModalAtiva);
                if (itens.length === 0) return;

                const nicksUnicos = Array.from(new Set(itens.map(i => i.nick)));
                const texto = nicksUnicos.join('\n');
                const copiou = await copiarParaAreaDeTransferencia(texto);
                if (copiou) {
                    const original = btnCopiarTodos.innerHTML;
                    btnCopiarTodos.innerHTML = `<i class="fa-solid fa-check text-emerald-400"></i> ${nicksUnicos.length} nicks copiados!`;
                    setTimeout(() => { btnCopiarTodos.innerHTML = original; }, 2500);
                }
            });
        }

        const btnReSync = document.getElementById('btn-re-sincronizar-modal');
        if (btnReSync) {
            btnReSync.addEventListener('click', async () => {
                try {
                    await executarSincronizacaoCompleta();
                } catch (e) { }
            });
        }

        ['lista-forum-professores', 'lista-forum-coordenadores', 'lista-forum-graduadores'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', () => {
                    if (preenchendoProgramaticamente) return;
                    usuarioEditouManualmente = true;
                    atualizarIndicadorStatusEBadge();
                });
            }
        });
    }

    let promessaSincronizacaoAtiva = null;

    /**
     * Retorna a promessa ativa de sincronização em segundo plano, se houver
     */
    function obterPromessaSincronizacao() {
        return promessaSincronizacaoAtiva;
    }

    /**
     * Indica se uma sincronização está ocorrendo agora
     */
    function estaSincronizando() {
        return Boolean(promessaSincronizacaoAtiva);
    }

    /**
     * Executa sincronização em segundo plano silenciosa (ao vivo na inicialização)
     */
    async function executarSincronizacaoSilenciosa() {
        if (promessaSincronizacaoAtiva) return promessaSincronizacaoAtiva;

        const textoStatus = document.getElementById('texto-status-forum');
        if (textoStatus) {
            textoStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-purple-400 mr-1.5"></i> Consultando subfóruns em tempo real...';
        }

        promessaSincronizacaoAtiva = (async () => {
            try {
                const resultados = await sincronizarTodosOsGrupos({
                    onProgress: prog => {
                        if (prog.grupoAtual && textoStatus) {
                            textoStatus.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-purple-400 mr-1.5"></i> Atualizando ${prog.grupoAtual} (${prog.indiceGrupo}/3)...`;
                        }
                    }
                });

                if (!usuarioEditouManualmente) {
                    preencherCamposFiscalizacao(resultados);
                    atualizarIndicadorStatusEBadge(resultados, true);
                }
                return resultados;
            } catch (erro) {
                const temDados = Boolean(
                    document.getElementById('lista-forum-professores')?.value.trim()
                );
                if (temDados) {
                    atualizarIndicadorStatusEBadge();
                } else if (textoStatus) {
                    textoStatus.innerHTML = '<span class="inline-block w-2 h-2 rounded-full bg-slate-400 mr-1.5"></span> Subfóruns: use a inserção manual se necessário';
                }
                throw erro;
            } finally {
                promessaSincronizacaoAtiva = null;
            }
        })();

        return promessaSincronizacaoAtiva;
    }

    /**
     * Executa a sincronização completa de todos os 3 grupos com feedback visual no modal e status
     */
    async function executarSincronizacaoCompleta(opcoes = {}) {
        const btnReSync = document.getElementById('btn-re-sincronizar-modal');
        const btnReSyncManual = document.getElementById('btn-re-sincronizar-manual');
        const textoStatus = document.getElementById('texto-status-forum');
        const iconeOriginal = btnReSync ? btnReSync.innerHTML : '';
        const textoOriginalManual = btnReSyncManual ? btnReSyncManual.innerHTML : '';

        if (btnReSync) {
            btnReSync.disabled = true;
            btnReSync.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Sincronizando grupos...';
        }
        if (btnReSyncManual) {
            btnReSyncManual.disabled = true;
            btnReSyncManual.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Importando...';
        }
        if (textoStatus) {
            textoStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-purple-400 mr-1.5"></i> Sincronizando subfóruns em tempo real...';
        }

        try {
            const resultados = await sincronizarTodosOsGrupos({
                ...opcoes,
                onProgress: prog => {
                    if (prog.grupoAtual) {
                        const msg = `Puxando ${prog.grupoAtual} (${prog.indiceGrupo}/3)...`;
                        if (btnReSync) btnReSync.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> ${msg}`;
                        if (btnReSyncManual) btnReSyncManual.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> ${msg}`;
                        if (textoStatus) textoStatus.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-purple-400 mr-1.5"></i> ${msg}`;
                    }
                }
            });

            usuarioEditouManualmente = false;
            preencherCamposFiscalizacao(resultados);
            atualizarIndicadorStatusEBadge(resultados, true);

            const total = (resultados.professores?.totalMembros || 0) +
                (resultados.coordenadores?.totalMembros || 0) +
                (resultados.graduadores?.totalMembros || 0);

            if (btnReSync) {
                btnReSync.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400 mr-1"></i> Sincronizado (${total} membros)`;
            }
            if (btnReSyncManual) {
                btnReSyncManual.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400 mr-1"></i> Sincronizado (${total})`;
            }

            if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
                window.showToast(`Sucesso! ${total} membros importados dos 3 subfóruns.`, 'success');
            }

            setTimeout(() => {
                if (btnReSync) {
                    btnReSync.disabled = false;
                    btnReSync.innerHTML = iconeOriginal || '<i class="fa-solid fa-rotate"></i> Consultar e atualizar do fórum agora';
                }
                if (btnReSyncManual) {
                    btnReSyncManual.disabled = false;
                    btnReSyncManual.innerHTML = textoOriginalManual || '<i class="fa-solid fa-rotate"></i> Tentar importar do fórum';
                }
            }, 3500);

            return resultados;
        } catch (erro) {
            lidarComErroSincronizacao(erro);
            if (btnReSync) {
                btnReSync.disabled = false;
                btnReSync.innerHTML = iconeOriginal || '<i class="fa-solid fa-rotate"></i> Consultar e atualizar do fórum agora';
            }
            if (btnReSyncManual) {
                btnReSyncManual.disabled = false;
                btnReSyncManual.innerHTML = textoOriginalManual || '<i class="fa-solid fa-rotate"></i> Tentar importar do fórum';
            }
            throw erro;
        }
    }

    /**
     * Trata erros com mensagens orientativas caso haja erro de CORS ou falta de login
     */
    function lidarComErroSincronizacao(erro) {
        console.error('[ParserGruposForum] Erro:', erro);

        if (erro.tipo === 'AUTENTICACAO_NECESSARIA' || (erro.message && erro.message.includes('autenticado'))) {
            if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
                window.showToast('Faça login no fórum da RCC para que os grupos possam ser consultados.', 'error');
            } else if (typeof alert === 'function') {
                alert('Faça login no fórum da RCC para que os grupos possam ser consultados.');
            } else {
                console.error('[ParserGruposForum] Faça login no fórum da RCC para que os grupos possam ser consultados.');
            }
            return;
        }

        if (erro.tipo === 'CORS_OU_ORIGEM' || (erro.message && erro.message.includes('CORS'))) {
            exibirModalInstrucoesCors();
            return;
        }

        if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
            window.showToast(`Erro ao sincronizar grupos: ${erro.message}`, 'error');
        } else if (typeof alert === 'function') {
            alert(`Erro ao sincronizar grupos: ${erro.message}`);
        } else {
            console.error(`[ParserGruposForum] Erro ao sincronizar grupos: ${erro.message}`);
        }
    }

    /**
     * Exibe modal amigável quando o usuário testa fora de policiarcc.com e encontra bloqueio de CORS
     */
    function exibirModalInstrucoesCors() {
        if (typeof document === 'undefined') return;
        const modalExistente = document.getElementById('modal-instrucoes-parser-cors');
        if (modalExistente) modalExistente.remove();

        const bookmarkletCode = gerarCodigoBookmarklet();

        const modal = document.createElement('div');
        modal.id = 'modal-instrucoes-parser-cors';
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in';
        modal.innerHTML = `
            <div class="card-standard max-w-lg w-full p-6 rounded-2xl shadow-2xl border border-purple-500/30 bg-slate-900 text-slate-100">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-2xl">
                        <i class="fa-solid fa-shield-halved"></i>
                    </div>
                    <div>
                        <h3 class="text-base font-bold">Origem Externa Detectada</h3>
                        <p class="text-xs text-slate-400">Por que a sincronização direta não carregou?</p>
                    </div>
                </div>
                <p class="text-xs text-slate-300 mb-4 leading-relaxed">
                    O fórum da RCC exige que o usuário esteja autenticado com seus cookies de sessão para visualizar os grupos de Professores, Coordenadores e Graduadores.
                    Quando esta ferramenta é acessada dentro do próprio domínio <strong>policiarcc.com</strong> (onde ela é hospedada), a sincronização é 100% automática e direta!
                </p>
                <div class="bg-slate-950/70 p-3 rounded-xl border border-slate-800 mb-4">
                    <p class="text-[11px] font-bold text-purple-300 mb-1">Como usar se estiver testando fora do fórum:</p>
                    <p class="text-[11px] text-slate-400 mb-2">
                        Arraste ou crie um favorito no navegador com o Bookmarklet abaixo. Ao clicar nele em qualquer página do fórum RCC, ele coleta todos os grupos de todas as páginas, copia para a Área de Transferência e sincroniza automaticamente com esta aba!
                    </p>
                    <button type="button" id="btn-copiar-bookmarklet" class="w-full py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2">
                        <i class="fa-solid fa-copy"></i> Copiar Código do Bookmarklet
                    </button>
                </div>
                <div class="flex justify-end">
                    <button type="button" id="btn-fechar-modal-cors" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300">
                        Entendi
                    </button>
                </div>
            </div>
        `;

        const containerAlvo = document.body || document.documentElement;
        if (containerAlvo && typeof containerAlvo.appendChild === 'function') {
            containerAlvo.appendChild(modal);
        }

        const btnFechar = document.getElementById('btn-fechar-modal-cors');
        if (btnFechar) {
            btnFechar.addEventListener('click', () => modal.remove());
        }

        const btnCopiar = document.getElementById('btn-copiar-bookmarklet');
        if (btnCopiar) {
            btnCopiar.addEventListener('click', async () => {
                await copiarParaAreaDeTransferencia(bookmarkletCode);
                btnCopiar.innerHTML = '<i class="fa-solid fa-check text-emerald-300"></i> Código Copiado!';
                setTimeout(() => {
                    btnCopiar.innerHTML = '<i class="fa-solid fa-copy"></i> Copiar Código do Bookmarklet';
                }, 2500);
            });
        }
    }

    /**
     * Identifica se a página atual do navegador é de um dos 3 grupos
     */
    function identificarGrupoDaPaginaAtual() {
        if (typeof window === 'undefined' || !window.location) return null;
        const path = window.location.pathname || '';
        const search = window.location.search || '';
        const full = path + search;

        if (/\/g10\b|g10-|g=10\b/i.test(full)) return CONFIG_GRUPOS.professores;
        if (/\/g458\b|g458-|g=458\b/i.test(full)) return CONFIG_GRUPOS.coordenadores;
        if (/\/g231\b|g231-|g=231\b/i.test(full)) return CONFIG_GRUPOS.graduadores;
        return null;
    }

    /**
     * Monta widget flutuante quando o script é executado nas páginas padrão do fórum
     * (ex: instalado no fórum via Gestão dos códigos JavaScript ou Console)
     */
    function montarWidgetFlutuanteNoForum() {
        if (typeof document === 'undefined') return;
        if (document.getElementById('widget-rcc-parser-grupos')) return;

        const grupoAtual = identificarGrupoDaPaginaAtual();

        const widget = document.createElement('div');
        widget.id = 'widget-rcc-parser-grupos';
        widget.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999;font-family:sans-serif;display:flex;flex-direction:column;gap:8px;align-items:flex-end;';

        let botaoGrupoAtualHtml = '';
        if (grupoAtual) {
            botaoGrupoAtualHtml = `
                <button id="btn-rcc-copiar-grupo-atual" style="background:linear-gradient(135deg, #059669, #10b981);color:#fff;border:none;padding:10px 16px;border-radius:50px;font-size:12px;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(0,0,0,0.3);display:flex;align-items:center;gap:8px;transition:transform 0.2s;" title="Copia todos os membros de ${grupoAtual.nome} (todas as páginas) para colar na fiscalização">
                    <span style="font-size:14px;">📋</span> Copiar ${grupoAtual.nome} (Todas as Págs)
                </button>
            `;
        }

        widget.innerHTML = `
            ${botaoGrupoAtualHtml}
            <button id="btn-rcc-parser-flutuante" style="background:linear-gradient(135deg, #7c3aed, #4f46e5);color:#fff;border:none;padding:10px 16px;border-radius:50px;font-size:12px;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(0,0,0,0.3);display:flex;align-items:center;gap:8px;transition:transform 0.2s;" title="Sincroniza os 3 subfóruns para a ferramenta de fiscalização">
                <span style="font-size:14px;">⚡</span> Fiscalização: Puxar 3 Grupos
            </button>
        `;

        const containerAlvo = document.body || document.documentElement;
        if (containerAlvo && typeof containerAlvo.appendChild === 'function') {
            containerAlvo.appendChild(widget);
        }

        // Ação para copiar grupo atual se estiver em uma página de grupo
        if (grupoAtual) {
            const btnAtual = document.getElementById('btn-rcc-copiar-grupo-atual');
            if (btnAtual) {
                btnAtual.addEventListener('click', async () => {
                    const textoOriginal = btnAtual.innerHTML;
                    btnAtual.disabled = true;
                    btnAtual.innerHTML = '<span>⏳</span> Coletando páginas...';

                    try {
                        const res = await buscarTodosMembrosDoGrupo(grupoAtual, {
                            onProgress: p => {
                                btnAtual.innerHTML = `<span>⏳</span> Pág. ${p.paginaAtual || 1}...`;
                            }
                        });

                        const copiou = await copiarParaAreaDeTransferencia(res.textoFormatado);
                        btnAtual.innerHTML = copiou
                            ? `<span>✅</span> ${res.totalMembros} membros copiados!`
                            : `<span>✅</span> ${res.totalMembros} membros prontos!`;

                        // Também notifica aba da fiscalização se estiver aberta
                        const syncObj = {};
                        syncObj[grupoAtual.chave] = res;
                        salvarCacheGrupos(syncObj);
                        notificarOutrasAbas(syncObj);

                        setTimeout(() => {
                            btnAtual.disabled = false;
                            btnAtual.innerHTML = textoOriginal;
                        }, 4000);
                    } catch (e) {
                        btnAtual.innerHTML = `<span>❌</span> ${e.message}`;
                        setTimeout(() => {
                            btnAtual.disabled = false;
                            btnAtual.innerHTML = textoOriginal;
                        }, 4000);
                    }
                });
            }
        }

        // Ação para sincronizar todos os 3 grupos
        const btnTodos = document.getElementById('btn-rcc-parser-flutuante');
        if (btnTodos) {
            btnTodos.addEventListener('click', async () => {
                const originalText = btnTodos.innerHTML;
                btnTodos.disabled = true;
                btnTodos.innerHTML = '<span>⏳</span> Coletando grupos...';

                try {
                    const resultados = await sincronizarTodosOsGrupos({
                        onProgress: prog => {
                            if (prog.grupoAtual) {
                                btnTodos.innerHTML = `<span>⏳</span> ${prog.grupoAtual}...`;
                            }
                        }
                    });

                    const total = (resultados.professores?.totalMembros || 0) +
                        (resultados.coordenadores?.totalMembros || 0) +
                        (resultados.graduadores?.totalMembros || 0);

                    // Efetua a cópia para a área de transferência do usuário
                    const textoUnificado = (
                        `--- PROFESSORES ---\n${resultados.professores?.textoFormatado || ''}\n\n` +
                        `--- COORDENADORES ---\n${resultados.coordenadores?.textoFormatado || ''}\n\n` +
                        `--- GRADUADORES ---\n${resultados.graduadores?.textoFormatado || ''}`
                    );
                    await copiarParaAreaDeTransferencia(textoUnificado);

                    btnTodos.innerHTML = `<span>✅</span> ${total} membros copiados!`;
                    btnTodos.style.background = '#10b981';

                    setTimeout(() => {
                        btnTodos.disabled = false;
                        btnTodos.style.background = 'linear-gradient(135deg, #7c3aed, #4f46e5)';
                        btnTodos.innerHTML = originalText;
                    }, 4000);
                } catch (e) {
                    btnTodos.innerHTML = `<span>❌</span> ${e.message}`;
                    btnTodos.style.background = '#ef4444';
                    setTimeout(() => {
                        btnTodos.disabled = false;
                        btnTodos.style.background = 'linear-gradient(135deg, #7c3aed, #4f46e5)';
                        btnTodos.innerHTML = originalText;
                    }, 4000);
                }
            });
        }
    }

    // Inicialização automática quando o DOM estiver pronto
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', integrarInterfaceFiscalizacao);
        } else {
            integrarInterfaceFiscalizacao();
        }
    }

    // Exportação da API Pública
    return {
        CONFIG_GRUPOS,
        CONTAS_IGNORADAS,
        normalizarNick,
        decodificarEntidadesHtml,
        formatarMembrosParaSubforum,
        verificarSePaginaDeLogin,
        parsearMembrosDaPagina,
        extrairLinksDePaginacao,
        buscarTodosMembrosDoGrupo,
        sincronizarTodosOsGrupos,
        executarSincronizacaoCompleta,
        preencherCamposFiscalizacao,
        copiarParaAreaDeTransferencia,
        copiarGrupoParaTransferencia,
        gerarCodigoBookmarklet,
        integrarInterfaceFiscalizacao,
        carregarCacheGrupos,
        restaurarCacheSeDisponivel,
        identificarGrupoDaPaginaAtual,
        obterOrigemForum,
        fecharCanalSincronizacao,
        obterMembrosCarregados,
        abrirModalMembrosForum,
        fecharModalMembrosForum,
        alternarContainerManual,
        renderizarListaMembrosModal,
        atualizarIndicadorStatusEBadge,
        extrairNicksDeTextoSubforum,
        executarSincronizacaoSilenciosa,
        obterPromessaSincronizacao,
        estaSincronizando,
        obterItensFiltradosParaExibicao
    };
}));

