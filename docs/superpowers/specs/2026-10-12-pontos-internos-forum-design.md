# Gerador de Pontos Internos no Fórum

## Objetivo

Criar uma página independente em HTML, CSS e JavaScript, carregada no fórum como a Central de Avaliações, para reunir resultados das fontes oficiais, permitir conferência humana e acrescentar os lançamentos selecionados na aba `Respostas ao formulário` da planilha oficial do Ranking Interno.

O sistema não calcula o total de pontos. Ele envia a categoria e o nome exato do evento. As fórmulas existentes na planilha continuam responsáveis pela conversão e pelo ranking.

## Escopo

O módulo terá quatro áreas:

1. geração automática;
2. conferência e tratamento de duplicidades;
3. lançamento manual;
4. configurações e histórico.

Os arquivos públicos serão `pontosinternos.html`, `pontosinternos.css` e `pontosinternos.js`. O projeto também entregará um `Code.gs` independente para implantação manual como aplicativo web do Google Apps Script.

## Acesso

O acesso será permitido a membros ativos com um destes cargos:

- Estagiário;
- Conselheiro;
- Vice-Líder;
- Líder.

Também será permitido a nicknames presentes na lista de exceções da configuração. O nickname e o cargo serão obtidos pelo mesmo fluxo de sessão e perfil usado pela Central de Avaliações. O responsável por cada lançamento será sempre o nickname autenticado e não poderá ser editado.

Todos os usuários autorizados poderão abrir as configurações, gerenciar fontes, tipos de lançamento e nicks avulsos. Cada alteração gerará um registro de auditoria com autor, data, ação e estado anterior e posterior.

## Fontes automáticas

A configuração inicial conterá as fontes já publicadas em `/consulta`:

- Professores;
- Coordenadores;
- Graduadores;
- Conselho;
- SPP;
- CDC;
- DA.

As propostas serão lidas diretamente das coleções atuais do NEXUS. Cada fonte terá um adaptador isolado que transforma seu formato em candidatos de lançamento. Uma falha em uma fonte não poderá gerar registros parciais ou silenciosamente incompletos.

O usuário escolherá uma fonte por execução. Qualquer usuário autorizado poderá selecionar qualquer fonte.

## Período

O período mais recente disponível será selecionado por padrão. Períodos anteriores permanecerão disponíveis para correções ou republicações.

Para propostas haverá dois modos:

- `Última semana lançada`: usa o último ciclo concluído disponível;
- `Votação em andamento`: calcula o resultado parcial atual.

Na votação em andamento, o voto da Liderança prevalece. Na ausência dele, vale a maioria dos votos enviados. Empates e propostas sem resultado aprovado serão exibidos como pendentes e ficarão desmarcados para postagem.

## Regras de destaque

A geração automática selecionará, pela ordem original da fonte:

- dois destaques de Professores;
- um destaque de Coordenadores;
- um destaque de Graduadores.

Estagiários e Conselheiros não terão destaque automático. Em caso de empate na posição de corte, será escolhido o primeiro registro na ordem original da fonte.

## Catálogo de lançamentos

O catálogo ficará no Firebase, dentro da configuração do módulo. Ele será iniciado com os nomes atuais do `Quadro de Pontos`, preservando exatamente acentos, parênteses e categorias.

Cada item terá:

- identificador estável;
- categoria A, B, C ou D;
- rótulo exato enviado à planilha;
- origem responsável;
- estado ativo ou inativo;
- data e autor da última alteração.

Usuários autorizados poderão adicionar e editar itens. Itens já utilizados serão desativados em vez de excluídos, para preservar o histórico. O sistema não armazenará nem enviará uma quantidade de pontos.

## Geração e conferência

Depois de selecionar fonte e período, o usuário clicará em `Gerar pontos`. A prévia mostrará cada candidato individualmente com:

- checkbox de inclusão;
- nickname;
- fonte;
- período;
- categoria;
- nome exato do lançamento;
- estado de novidade, duplicidade, pendência ou erro;
- explicação da origem do resultado.

Itens novos virão marcados. Duplicidades virão desmarcadas. O aviso mostrará o candidato novo ao lado do lançamento igual encontrado, e o usuário poderá marcar individualmente os registros que deseja repetir.

Antes do envio, os candidatos marcados que possuírem a mesma categoria e o mesmo tipo serão agrupados em uma única linha. Os nicknames serão unidos com ` / `, seguindo o padrão atual da planilha.

## Duplicidades

O histórico do Firebase usará a chave lógica `fonte + período + tipo + nickname` para detectar com precisão lançamentos feitos por este módulo.

O sistema também consultará os registros atuais da aba `Respostas ao formulário` para sinalizar coincidências de nickname e tipo criadas fora do módulo. Como a planilha atual não possui colunas de fonte e período, essas coincidências externas serão apresentadas como aviso aproximado, nunca como bloqueio automático.

Uma duplicidade não será descartada. Ela poderá ser enviada quando sua checkbox for marcada explicitamente.

## Lançamento manual

O formulário manual aceitará um ou mais nicknames, separados por linha ou `/`. O usuário escolherá a categoria e um item ativo do catálogo. O campo de print será opcional.

Entradas manuais passarão pela mesma normalização, prévia, verificação de duplicidade, seleção individual e agrupamento das entradas automáticas.

## Escrita na planilha

O destino fixo será a planilha com ID `1qL4S-vNDI2iONCVtl6fUuWo6EK0v62IWFGydrLKhlbQ`, aba `Respostas ao formulário`.

O backup mensal é uma cópia e não altera esse ID. O Apps Script acrescentará apenas novas linhas nas colunas A a I:

1. Carimbo de data/hora;
2. NICKNAME DO RESPONSÁVEL;
3. NICKNAME DO PONTUADOR;
4. TIPO DE PONTOS;
5. [A] CATEGORIA;
6. [B] CATEGORIA;
7. [C] CATEGORIA;
8. [D] CATEGORIA;
9. PRINT.

Somente a coluna correspondente à categoria escolhida receberá o nome do evento. O print ficará vazio nos lançamentos automáticos e será opcional nos manuais.

O módulo não editará `Controle`, `Dados`, `Ranking Interno`, `Quadro de Pontos`, fórmulas, aprovações ou totais. O Conselho continuará aprovando os registros manualmente na aba `Controle`.

## Apps Script e consistência

O `Code.gs` será entregue pronto para o usuário implantar como aplicativo web. O endpoint:

- aceitará somente `POST`;
- validará o formato e o tamanho do lote;
- recusará categorias e campos fora do contrato;
- utilizará `LockService` durante a gravação;
- exigirá um identificador único por requisição;
- impedirá a repetição acidental do mesmo identificador;
- gravará o lote inteiro com uma única operação `setValues`;
- retornará JSON com sucesso, linhas criadas ou erro.

O lote será tratado como unidade: uma falha de validação ocorrerá antes da escrita. Depois de confirmado pelo Apps Script, o frontend registrará no Firebase o recibo, o conteúdo lógico e o responsável.

## Estado e dados no Firebase

O módulo terá documentos separados para:

- configuração geral e versão do esquema;
- fontes e parâmetros de leitura;
- catálogo de tipos;
- nicks avulsos autorizados;
- histórico de gerações e envios;
- auditoria de configurações.

As regras permitirão leitura e escrita somente a usuários autenticados que passem pelo controle de acesso do módulo. O histórico será append-only para usuários comuns; alterações administrativas gerarão auditoria imutável.

## Interface

A página seguirá a identidade visual da Central de Avaliações e será responsiva. A navegação principal terá `Gerar`, `Manual`, `Histórico` e `Configurações`.

Estados de carregamento, fonte indisponível, período vazio, nickname inválido, duplicidade e erro de envio serão explícitos. O botão de postagem ficará bloqueado durante o envio. Após sucesso, a tela mostrará o recibo e as linhas acrescentadas, sem afirmar que os pontos já foram aprovados ou contabilizados.

## Testes e aceitação

Os testes cobrirão:

- parsing de cada fonte com amostras reais anonimizadas;
- período mais recente e seleção histórica;
- regra de destaques e empate pela primeira ocorrência;
- propostas concluídas e votação parcial;
- catálogo e correspondência exata dos rótulos;
- normalização e agrupamento com ` / `;
- duplicidade interna precisa e coincidência externa aproximada;
- seleção padrão de novos e duplicados;
- autorização por cargo e nick avulso;
- lote idempotente, bloqueio de clique duplo e falha sem escrita parcial;
- preservação integral das abas e fórmulas fora de `Respostas ao formulário`;
- layout em desktop e celular.

A entrega só será considerada concluída após testes locais, implantação das regras necessárias, publicação dos arquivos e uma postagem controlada de homologação feita pelo usuário depois de instalar o Apps Script.

## Fora de escopo

- calcular pontos no navegador;
- aprovar registros na aba `Controle`;
- alterar fórmulas ou estrutura do Ranking Interno;
- editar a planilha de backup;
- publicar automaticamente itens sem conferência humana;
- apagar registros já enviados.
