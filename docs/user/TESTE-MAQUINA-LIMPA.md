# Teste em máquina limpa

Este roteiro valida o pacote Windows da versão **1.6.2** em um computador ou
usuário sem uma instalação anterior, a atualização a partir da 1.3.2 e, em
máquina separada, a atualização histórica a partir da 1.1.17.
Use somente um instalador acompanhado de `release-manifest.json` e SHA-256.
Se o instalador não tiver assinatura Authenticode, o resultado vale apenas como
diagnóstico, nunca como release oficial.

## Instalação e segurança

- [ ] Conferir nome (`Pesagens Individuais Setup 1.6.2.exe`), tamanho e SHA-256
      contra `release-manifest.json` (`installer.sha256`, `installer.sizeBytes`).
- [ ] Em **Propriedades > Assinaturas Digitais**, validar assinatura Authenticode,
      cadeia confiável e carimbo de tempo (ou registrar `signed: false`).
- [ ] Instalar sem desativar Defender, SmartScreen, WDAC ou App Control.
- [ ] Abrir pelo atalho e confirmar **Pesagens Individuais**.
- [ ] Confirmar que não há erro no `app.log` informado no diagnóstico.

## Primeira execução e login

- [ ] A primeira tela é a **Configuração Inicial** (nenhuma tela de dados aparece antes).
- [ ] Senha fraca (`123456`) e senha igual ao login são recusadas.
- [ ] Criar o administrador; a tela de **login** aparece com a versão **1.6.0** no rodapé.
- [ ] Login com senha errada mostra "Login ou senha inválidos"; 5 erros seguidos bloqueiam por 30 s.
- [ ] Login correto abre o sistema com nome, perfil ADMIN e versão na barra superior.
- [ ] **Bloquear** pede a senha do mesmo usuário; **Trocar usuário** volta ao login; **Sair** encerra.
- [ ] Em **Sistema › Usuários**, criar um GESTOR e um OPERADOR; cada um deve trocar a senha na primeira entrada.
- [ ] Como OPERADOR, o menu não mostra Usuários, Backup e Manutenção nem os botões de editar cadastros.
- [ ] Tentar desativar o único ADMIN é recusado.
- [ ] Em **Backup e Manutenção › Status**, confirmar versão **1.6.0**, banco **9**,
      backup formato **3**, build UI e build de dados e armazenamento
      **IndexedDB local (Dexie)**.

## Cadastros

- [ ] Cadastrar uma marca, uma raça e um parceiro; marcar marca e raça como padrão.
- [ ] Nome repetido (mesmo nome com maiúsculas/espaços diferentes) é recusado.
- [ ] Categorias iniciais existem (Bezerro, Bezerra, Garrote, Novilha, Boi, Vaca, Touro).
- [ ] Propriedade "Propriedade principal" existe como própria e padrão.
- [ ] Inativar uma marca usada por um animal: some da seleção, animal continua exibindo a marca.
- [ ] Excluir só é permitido para item sem uso.

## Persistência na primeira execução

- [ ] Lançar um cadastro de animal (marca e raça escolhidas da lista) e uma pesagem.
- [ ] Fechar completamente o aplicativo.
- [ ] Abrir novamente, fazer login e confirmar que animal, pesagem e cadastros permanecem.
- [ ] Confirmar que nenhum SQLite, servidor, internet ou configuração manual foi solicitado.

## Backup e restauração

- [ ] Criar um backup completo JSON logo após a abertura; conferir formato 3 e usuários incluídos.
- [ ] Conferir o arquivo no catálogo com tamanho, data e SHA-256.
- [ ] Exportar CSV e JSON e abrir os arquivos.
- [ ] Executar **Verificar integridade**.
- [ ] Em uma base isolada, analisar e restaurar o backup; o programa pede login de novo.
- [ ] Restaurar um backup da **1.1.17** (formato 2): a análise avisa a conversão, a
      restauração converte e o programa volta para a Configuração Inicial.
- [ ] Reabrir e comparar contagens e somas.
- [ ] **Limpar dados operacionais**: pesagens somem, cadastros e usuários permanecem.
- [ ] **Reset completo**: exige backup validado, senha e confirmação; volta à Configuração Inicial.

## Atualização 1.3.2 → 1.6.0

- [ ] Na 1.3.2: marcar como favoritos "Rebanho por raça" e "Mortes por causa", salvar um modelo de
      "Desempenho por lote" e criar um backup completo.
- [ ] Instalar a 1.6.0 por cima e abrir: nenhuma migração de banco; barra superior com **v1.6.0**.
- [ ] Relatórios: 12 cartões; os dois favoritos aparecem com o nome antigo e abrem agrupados como antes;
      o modelo abre no relatório **Desempenho**, com o selo "Convertido na 1.4.0".
- [ ] Trilha de auditoria (Backup e Manutenção › Controle): linhas "Relatório consolidado".
- [ ] Rebanho atual abre **resumido** por lote; clicar num lote mostra só os animais dele.
- [ ] Imprimir o Resumido de Desempenho em A4; exportar XLSX e abrir.
- [ ] Relação de Pesagens › Ações em lote › **Data, apartação e lote** abre sem erro.
- [ ] Verificar integridade verde; contagens iguais às da 1.3.2.

## Atualização 1.1.17 → 1.2.0 (segunda máquina ou usuário)

- [ ] Instalar a 1.1.17, lançar dados de teste (marcas com grafias diferentes, uma morte, um comprador) e criar backup.
- [ ] Instalar a 1.2.0 por cima e abrir: backup pré-migração gravado e conferido; migração concluída sem erro.
- [ ] Fechar o programa no meio da migração e reabrir: continua de onde parou, sem duplicar.
- [ ] Configuração Inicial após a migração; cadastros montados a partir dos dados; relatório da migração legível.
- [ ] Verificar integridade verde; contagens iguais às da 1.1.17.

## Fluxos funcionais mínimos

- [ ] Cadastro e manejo do mesmo animal.
- [ ] Mesmo número em duas marcas, com escolha explícita.
- [ ] Pesagem retroativa e recálculo da cadeia de ganho/GMD.
- [ ] Saída por venda e por abate.
- [ ] Morte sem peso, com causa que exige observação.
- [ ] Apartação e transferência de lote.
- [ ] Importação CSV com `1.000,00`, data brasileira e campo entre aspas.
- [ ] Tema claro/escuro, filtros, modais e rolagem horizontal.

## Atualização e reinstalação

- [ ] Instalar a mesma versão por cima e confirmar a preservação de dados e usuários.
- [ ] Desinstalar e confirmar a política esperada para os dados do usuário.

## Resultado

- Data: _______________
- Computador/Windows: _______________
- Versão do instalador: _______________
- SHA-256: _______________
- Signatário (ou "sem assinatura — diagnóstico"): _______________
- Resultado: [ ] aprovado  [ ] reprovado  [ ] MANUAL PENDENTE
- Evidências/observações: _______________
