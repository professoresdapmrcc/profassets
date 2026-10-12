# Instalação do endpoint de Pontos Internos

Este script escreve exclusivamente nas colunas A:I da aba `Respostas ao formulário` da planilha oficial. Ele não altera `Controle`, `Dados`, `Ranking Interno`, `Quadro de Pontos`, fórmulas ou aprovações.

1. Abra a planilha oficial e acesse **Extensões → Apps Script**.
2. Substitua o conteúdo de `Code.gs` pelo arquivo `Code.gs` desta pasta.
3. Em **Configurações do projeto**, habilite a exibição do manifesto e substitua `appsscript.json` pelo arquivo desta pasta.
4. No editor, selecione a função `setup` e clique em **Executar**. Autorize o acesso solicitado.
5. Abra o **Registro de execução** e copie a chave exibida depois de `Chave de acesso:`.
6. Clique em **Implantar → Nova implantação → Aplicativo da Web**.
7. Configure **Executar como: eu** e **Quem pode acessar: qualquer pessoa**. Clique em **Implantar**.
8. Copie a URL terminada em `/exec`.
9. Na Central de Pontos Internos, abra **Configurações → Integração**, cole a URL e a chave e salve.

Se o código for alterado depois, crie uma nova versão em **Gerenciar implantações**. O `requestId` impede que uma repetição do mesmo envio acrescente as linhas duas vezes.
