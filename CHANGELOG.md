# Changelog — Pesagens Individuais

Todas as mudanças relevantes deste app desktop offline são registradas aqui.
Formato baseado em "Keep a Changelog"; versionamento semântico (MAJOR.MINOR.PATCH).

## [Não lançado] — Tela Mãe do ModeloBase1 na Relação e nos cadastros (14/09/2026)

### Alterado
- Relação de Pesagens e cadastros auxiliares (Parceiros, Mortalidade, Sanidade)
  passam a usar a Tela Mãe do Cadastro de Empresas do PROJETOMG-main: barra de
  ações `mg-action-bar` (Filtrar, ação principal, Editar/Excluir da seleção;
  pesquisa expansível com lista de resultados e "Buscar todos"; modos de
  visualização; menu "Mais opções" com Atualizar, exportar, importar, modelo e
  configuração de colunas), faixa `mg-table-panel-strip` com uma pílula de filtro
  por coluna e o botão de configurar colunas, e painel lateral `filter-panel`
  (260 px, campos rotulados por coluna, seleções e datas, Limpar/Aplicar).
- Cadastros auxiliares ganharam configuração de colunas (ordem e visibilidade
  guardadas por grupo) e pílulas de filtro por coluna, antes limitadas ao tipo.
- Componentes portados do modelo para `src/components/mak/`: `MgFilterPanel`,
  `MgDesktopSearch`, `MgSearchResultsDropdown`, `MgSpeedDialMenu`,
  `MgTablePanelStrip`, `MgCmdSelect`, `MgPortalPanel`, `useMgPanelPosition`,
  `mgSearchHighlight`. Bloco `D.17D.2R34` no `d17b-modelobase1.css` compõe a
  página; os estilos dos componentes já existiam em `mg-layout.css`.
- Contratos R34 em `ui:consistency:verify` protegem a estrutura das duas telas.
- Pesquisa expansível corrigida após revisão: a barra passa a usar os 28 px do
  modelo e o campo dentro da pílula deixa de herdar fundo, altura de 38 px, raio
  e anel de foco dos inputs globais; a abertura não depende mais de
  `requestAnimationFrame` (aba sem pintura não travava mais a pílula fechada).

### Verificado
- Referência renderizada do ModeloBase1 real (Cadastro de Empresas com API
  simulada) em `docs/evidence/modelobase1-referencia/`; capturas das telas
  portadas em `docs/evidence/modelobase1-relacao-2026-09-14/` e
  `docs/evidence/modelobase1-cadastros-2026-09-14/`.

## [Não lançado] — Design "Lançamento de Pesagens" (Claude Design, 09/09/2026)

### Alterado
- Revisão R33: a tabela da tela de lançamento voltou a reutilizar o contrato
  visual da tabela Pesagens Individuais — cabeçalho, linhas, tipografia, cores,
  grade, zebra e modo escuro — preservando apenas os dados próprios da tela.
- Revisão R32: o campo Data do lançamento e o botão do calendário agora formam
  uma única superfície contínua, sem divisor interno, sombra duplicada ou troca
  de fundo no hover, tanto no tema claro quanto no escuro.
- Revisão R31 refeita diretamente sobre o HTML final de 09/09/2026: controles
  com 28 px, faixa operacional com 32 px, contornos verdes suaves, valores de
  identificação/peso em âmbar, ganho em verde, alerta em âmbar, tabela e painel
  lateral na proporção 3:1 e rodapé de 44 px.
- A visualização inicial passou a reproduzir as 14 colunas do modelo (as demais
  continuam disponíveis no configurador). Configurações da versão anterior são
  migradas uma vez para esse padrão, sem alterar registros de pesagem.
- A prévia do ganho aceita decimal e data brasileiros, ignora lançamentos
  futuros/mesmo dia e não conta o peso ainda não salvo como pesagem histórica.
- O campo composto Peso usa uma única borda de foco suave; corrigidos conflitos
  antigos que deixavam os títulos da faixa azuis e os rótulos de ganho escuros.
- Ações Editar e Excluir da tabela são exibidas somente por texto.
- Tela de Lançamento de Pesagens alinhada ao design `Lançamento de Pesagens.dc.html`
  do projeto Claude Design (`formulario-escopo`): malha única de nove colunas
  iguais nas linhas de campos e de Apartação/Transferência para todos os tipos
  de movimentação; indicação automática do lote ocupa três colunas como pílula;
  ações redondas da barra com fundo branco e borda `#d8dde5`; campo de
  identificação com borda verde translúcida; tabela em 12 px com cabeçalho
  `#17243a`/`#dfe5eb`, linhas de 26 px `#5f6f82`/`#e5e9ee` e zebrado `#fafbfc`;
  coluna Tipo em texto simples; rodapé com rótulos `#6b7280` e marcas em pílulas
  de 10 px; painel Distribuição de Lotes com título 12 px, seletor Dia/Total em
  pílula verde, contexto centralizado e tabela 9 px/10 px.
- Bloco `D.17D.2R29` no `d17b-modelobase1.css` concentra a paridade, com
  variantes de modo escuro; contratos `ui:consistency:verify` atualizados
  (lote em três colunas, resumos em 10 px) e novas verificações R29.

### Verificado
- Estilos computados conferidos no navegador (1440 px, claro e escuro) e
  capturas em `docs/evidence/design-lancamento-2026-09-09/`.

## [Não lançado] — F0 Contratos e baseline

### Adicionado
- Massa de teste anônima e determinística (`src/modules/perf/testMass.js`) nos
  tamanhos vazia, pequena, 36 mil e 250 mil pesagens, no formato das stores
  Dexie, com `npm run perf:testmass`.
- Bench de baseline (`src/modules/perf/baselineBench.js`) que mede p50/p95/p99
  de carga inicial, índice de animais, identificação → peso, busca indexada por
  animal e por período, salvamento local e recarga após salvar; roda em Node
  (`npm run perf:baseline`) e no navegador/Electron (IndexedDB real).
- Captura visual das três telas em tema claro e escuro com massa pequena e
  userData isolado (`npm run evidence:screens`).
- Contrato `perf:contract:verify` incluído em `test:quick` e `test:full`.
- Documentos F0: mapa de campos atual → modelo-alvo, catálogo de fórmulas com
  divergências D1–D7 e status da fase em `docs/arquitetura-produto/`.

### Corrigido
- `main:boot:verify` voltou a passar: o stub do Electron em Node não definia
  `process.resourcesPath`, e o caminho do ícone empacotado (`main.cjs`)
  derrubava a verificação de boot desde a 1.1.16.

### Verificado
- `npm run test:quick` integral (19 gates) aprovado com os novos contratos.
- Baseline registrado em `docs/evidence/f0-baseline/`. Busca indexada e
  identificação → peso ficam dentro do orçamento; o salvamento local sai do
  orçamento a partir de 36 mil registros porque o recálculo da série relê a
  base inteira (divergência D3, alvo da F1).

## [1.1.16] — 2026-09-04

### Corrigido
- Importações CSV e JSON passam pelo mesmo serviço transacional dos lançamentos,
  resolvem a identidade canônica por número e marca e recusam duplicidade de
  arquivo por SHA-256.
- A cronologia também é validada dentro do lote importado: segundo cadastro,
  evento anterior ao cadastro, evento após saída e saída retroativa com eventos
  posteriores abortam a transação inteira.
- A situação atual do animal, o lote vigente, o último peso e o histórico de
  lotes são reconstruídos a partir dos eventos válidos após criar, editar,
  cancelar ou importar.
- Aplicações de sanidade e medicamentos passam a ser persistidas e encerradas
  logicamente junto da pesagem, preservando a trilha histórica.
- Exclusões de cadastros auxiliares verificam vínculos antes da confirmação e as
  ações destrutivas usam o diálogo visual padrão.

### Alterado
- Rendimento de carcaça de venda e abate tornou-se configurável; peso vivo, peso
  de carcaça, arrobas e valor estimado são calculados com rótulos explícitos.
- Listagem do lançamento pagina 50 linhas e consultas por animal, data e lote
  utilizam índices Dexie; as rotas principais são carregadas sob demanda.
- A verificação de integridade cobre sessões, movimentos, lotes históricos,
  sanidade e propriedade dos identificadores, além das referências existentes.
- Backup físico validado passou a ser pré-condição de restauração, importação e
  limpeza; restauração confere SHA-256, versão, manifesto e contagem por store.
- Removidos nomes e caminhos ativos do backend legado; o runtime opera somente
  sobre IndexedDB/Dexie. Nenhum dado existente foi migrado ou regravado em massa,
  conforme decisão do responsável.

### Verificado
- Contratos de cálculo brasileiro, datas civis, ganho/GMD retroativo, identidade
  por marca, sanidade, importação atômica, backup, restauração, auditoria,
  cronologia e desempenho em base volumosa.
- Contrato visual protege hover dos botões primários, células de seleção,
  tipografia, campos, filtros, diálogos, modo escuro e rolagem de tabelas.
- Distribuição oficial continua bloqueada sem certificado Authenticode confiável;
  pacote sem assinatura é somente diagnóstico local.

## [1.1.15] — 2026-09-03

### Corrigido
- A conclusão da identificação do animal deixa de reconstruir todo o cadastro a
  cada `Tab`: animais registrados são indexados uma única vez por ID e número.
- O cálculo dos dados exibidos do animal selecionado reutiliza o histórico já
  memorizado e não percorre todos os lançamentos a cada alteração do peso.
- Identificação numérica ou nominal é normalizada em maiúsculas durante a
  digitação e também antes da persistência.

### Adicionado
- Animais identificados como `SN` solicitam Sexo, Raça, Era e Marca em um diálogo
  padrão antes de salvar.
- O novo `SN` recebe como valores iniciais os dados zootécnicos do `SN` salvo mais
  recentemente; os campos continuam editáveis antes da confirmação.
- Ensaio de desempenho com 36 mil lançamentos, 12 mil animais e 5 mil consultas
  indexadas, além de contratos de herança do perfil `SN` e caixa alta.

### Empacotamento
- `npm run dist` agora exige credenciais de assinatura, habilita
  `forceCodeSigning`, valida Authenticode no aplicativo e no instalador e somente
  então gera checksum e manifesto. Uma release oficial não pode mais ser gerada
  silenciosamente sem assinatura.
- Builds sem certificado foram isoladas no comando explícito
  `npm run dist:unsigned`, com saída em `release-unsigned/`, somente para testes
  locais e nunca para distribuição.
- A verificação final rejeita assinatura ausente, inválida, expirada,
  autoassinada ou sem carimbo de tempo.

## [1.1.14] — 2026-09-02

### Corrigido
- Hovers brancos dos botões de ícone do shell foram substituídos pelo estado
  neutro padrão do ModeloBase1, sem mudança de cor brusca ao passar o mouse.
- A escolha de animal quando o mesmo número existe em mais de uma marca é aberta
  assim que o número identifica o conflito, sem depender de perder o foco.
- Ganho de peso igual a zero passa a ser preservado como `0,00`, em vez de ficar
  vazio; cálculo ignora registros futuros e registros do mesmo dia.

### Adicionado
- Contrato de consistência visual para hovers de botão, pop-ups padronizados e
  abertura imediata da escolha de marca.
- Contrato de cálculo de ganho/GMD cobrindo datas, identidade por marca, ganho
  zero, ausência de histórico e exclusão de referências futuras.

## [1.1.11] — 2026-08-06

### Alterado
- Campos de lançamento, filtros e diálogos passam a usar uma borda única de
  1 px e brilho suave de 2 px no foco, sem `outline` espesso acumulado.
- O cadastro de sanidade foi separado em duas abas: `Sanidades` e
  `Medicamentos`, seguindo o mesmo shell de Apartações/Lotes.
- Sanidades aceitam condições por apartação e faixa de peso; o lançamento
  permite selecionar várias sanidades e aplicar sugestões compatíveis.
- Venda e abate deixam de depender de botões de olho e passam a usar cadastros
  reutilizáveis em popup, com ação `Usar no lançamento`.
- O painel direito recebe resumo personalizado com contagem, soma, média,
  mínimo, máximo e divisão de totais, filtrável por dia, apartação, venda ou abate.
- Tabelas internas de cadastros usam bordas, cabeçalhos, linhas, estados vazios
  e cantos arredondados uniformes.

### Verificado
- Persistência de regras de sanidade, perfis de venda/abate e configurações de
  resumo depois de fechar e reabrir o IndexedDB.
- Instalador Windows atualizado para 1.1.11 e marcador técnico
  `d17d2r16-configurable-health-exits-summaries-focus-installer-2026-08-06`.

## [1.1.10] — 2026-08-06

### Alterado
- Números inteiros passam a usar separador brasileiro de milhar (`1.000`) e
  decimais passam a usar vírgula (`1.000,00`) nas duas telas e nos resumos.
- Datas exibidas no sistema passam pelo contrato `DD/MM/AAAA`.
- Peso, ganho e arrobas deixam de anexar `kg` ou `@` ao valor; a unidade permanece
  somente no rótulo ou cabeçalho correspondente.
- Valores monetários usam o formato brasileiro de Real (`R$ 1.000,00`).
- Todos os oito diálogos adotam o mesmo shell visual, com três dimensões oficiais:
  compacto, médio e grande.

### Verificado
- Novo ensaio automatizado protege formatação brasileira, datas, unidades
  separadas e cobertura integral do contrato de diálogos.
- Instalador Windows atualizado para 1.1.10 e marcador técnico
  `d17d2r15-ptbr-format-standard-dialogs-installer-2026-08-06`.

## [1.1.9] — 2026-08-05

### Corrigido
- Apartações, lotes e configurações de sanidade voltam a aparecer imediatamente
  depois de salvar e continuam disponíveis ao fechar e reabrir o aplicativo.
- Padronizado o identificador de empresa entre formulários (`empresa_id`) e consultas
  (`empresaId`), com leitura compatível dos registros criados pelas versões anteriores.
- Criar, editar e excluir apartação, lote, sanidade e medicamento passam pelo mesmo
  contrato persistente do IndexedDB/Dexie.
- Atualização dos diálogos agora aguarda a releitura do banco antes de liberar uma
  nova operação.
- A sombra da tabela e da Distribuição de Lotes foi reduzida para deixar visíveis
  os recuos inferior e direito de 3 px.

### Verificado
- Novo ensaio automatizado fecha e reabre o banco e valida persistência, edição,
  exclusão e compatibilidade legada dos cadastros auxiliares.
- Instalador Windows atualizado para 1.1.9 e marcador técnico
  `d17d2r14-persistent-auxiliary-crud-spacing-installer-2026-08-05`.

## [1.1.8] — 2026-08-05

### Alterado
- Contrato D.17D.2R13: todos os recuos estruturais passam a 3 px em Relação de
  Pesagens, Lançamento, Manutenção, filtros, calendários e diálogos.
- Faixas, formulários, workspaces, tabelas, resumos e grids internos deixam de
  combinar espaçamentos diferentes; os contêineres usam a escala global de 3 px.
- A faixa operacional perde a borda superior verde de 3 px e volta a usar borda
  neutra uniforme de 1 px em todos os lados.
- O workspace cresce para ocupar toda a altura restante da janela.
- A Distribuição de Lotes atravessa a linha do resumo e termina no mesmo rodapé
  da tabela, enquanto o rodapé de totais permanece fixado na base da coluna.

### Corrigido
- Eliminado o espaço vazio abaixo de tabela, totais e painel de distribuição.
- Bordas externas da tabela, resumo e distribuição normalizadas pelo mesmo token.
- Instalador Windows atualizado para 1.1.8 e marcador técnico
  `d17d2r13-global-3px-full-height-installer-2026-08-05`.

## [1.1.7] — 2026-08-05

### Alterado
- Contrato D.17D.2R10: a linha de Tipo de Movimentação, visualização do resumo,
  Configurar colunas e Atualizar passa a ocupar uma faixa operacional autônoma.
- O formulário agora é um segundo card, contendo somente os campos do lançamento;
  a borda superior verde deixa o formulário e permanece no shell da faixa.
- Faixa, formulário e workspace usam recuos de 8 px entre si e acabamento de
  superfície, raio, borda e sombra equivalente à Relação de Pesagens.
- Os botões somente com ícone da faixa adotam o botão circular cinza oficial,
  sem contorno colorido ou fundo branco no hover.

### Corrigido
- Normalizados os recuos superior, inferior, esquerdo e direito do conteúdo de
  lançamento, incluindo o espaço inferior do shell rolável.
- Instalador Windows atualizado para 1.1.7 e marcador técnico
  `d17d2r10-separated-toolbar-shell-installer-2026-08-05`.

## [1.1.6] — 2026-08-05

### Alterado
- Contrato D.17D.2R9: o seletor Apartação/Venda/Abate e as ações de colunas e
  atualização foram reunidos na linha de Tipo de Movimentação.
- Atualizar e Configurar colunas agora são ações circulares somente com ícone;
  Atualizar deixa de ocupar uma faixa superior exclusiva.
- Removidos o título redundante `Pesagens do Dia` e a pesquisa de animal/lote.
- Tabela e painel de distribuição passam a iniciar na mesma coordenada e o botão
  Exportar adota o mesmo acabamento verde pill do botão Salvar.
- A tabela do lançamento passa a encostar na moldura, sem padding branco lateral;
  sua altura fica vinculada à altura do painel de distribuição.
- O formulário recebe a linha superior verde, a superfície e a sombra do mesmo
  contrato visual usado na barra da Relação de Pesagens.
- Campos e seletores operacionais usam fundo, altura, raio e contraste uniformes,
  incluindo o modo escuro.

### Corrigido
- O filtro avançado de cabeçalho passa a medir sua altura real e abre junto à
  coluna acionada, sem saltar para o topo da tela.
- Hovers neutros do lançamento deixam de usar fundo branco nos seletores, ícones,
  calendários, combos e ações auxiliares.
- Instalador Windows atualizado para 1.1.6 e marcador técnico
  `d17d2r9-launch-toolbar-filter-installer-2026-08-05`.

## [1.1.5] — 2026-08-05

### Corrigido
- Contrato D.17D.2R8: remoção do padding horizontal duplicado no container
  interno do Lançamento de Pesagens.
- Formulário, barra de ações, tabela e painel de distribuição passam a usar
  os mesmos recuos laterais de 10 px da Relação de Pesagens.
- Reserva invisível do `scrollbar-gutter` removida no estado sem rolagem,
  garantindo alinhamento idêntico também na lateral direita.
- Botões Editar/Excluir passam a exibir somente o nome, com 28 px de altura,
  padding horizontal de 14 px e formato pill idêntico a `Lançar pesagem`.
- Hovers de ações e botões de ícone deixam de trocar para fundo branco.
- Instalador Windows atualizado para 1.1.5 e marcador técnico
  `d17d2r8-launch-shell-gutter-installer-2026-08-05`.

## [1.1.4] — 2026-08-05

### Alterado
- Contrato D.17D.2R7: todos os campos principais do lançamento passam a ocupar
  colunas iguais, com 28 px de altura, raio de 8 px e espaçamento uniforme.
- Data, identificação, sexo, raça, era, marca, peso e observação deixam de usar
  larguras especiais; os campos condicionais de venda e abate seguem a mesma matriz.
- Botões exclusivos de ícone usam 28×28 px e formato circular em todos os estados.
- Ações Salvar/Atualizar/Cancelar ficam agrupadas na coluna oficial, sem alterar a grade.
- Tema escuro ajustado para rótulos, status, botões de ícone, seletor de resumo e barra de ações.
- Instalador Windows atualizado para 1.1.4 e marcador técnico
  `d17d2r7-launch-grid-icons-dark-installer-2026-08-05`.

## [1.1.3] — 2026-08-05

### Adicionado
- Checkpoint de empacotamento da migração visual ModeloBase1 D.17D.1/D.17D.2.
- Marcador técnico `d17d2r3-full-ui-audit-2026-08-05`, incluído no diagnóstico copiado pela
  tela de Manutenção e verificável nos bundles e no `app.asar`.
- Gate `packaged:ui-build:verify`, que bloqueia release com versão, manifesto,
  instalador ou bundle visual desatualizado.
- Refinamento de densidade D.17D.2R: filtros e botões em 28 px, cabeçalho/linha
  de tabela em 30/26 px, rodapé de registros reorganizado e calendário visual
  padronizado em Pesagens.
- Paridade D.17D.2R2 da consulta de Pesagens com o Cadastro de Empresas: faixa
  de filtros personalizados recolhível, navegação horizontal, pílulas compactas,
  ação `Novo` e menu de cabeçalho separado do filtro avançado.
- Auditoria D.17D.2R3: pop-ups de filtros com rascunho e confirmação, pesquisa e
  seleção múltipla de valores, intervalo de datas sem aplicação prematura,
  rolagem horizontal real da tabela, diálogos compactos e tema escuro persistente.
- Contrato D.17D.2R4: faixa personalizada e cabeçalho passam a reutilizar o mesmo
  editor de filtro; condições usam a listagem visual do ModeloBase1, datas não
  exibem ícone interno e todos os campos da tabela ficam disponíveis na configuração.
  Filtros numéricos oferecem intervalo com `Entre` inicial e `Peso` substitui os
  antigos filtros separados de mínimo e máximo.
- Contrato D.17D.2R5: checkboxes circulares de 20 px nas tabelas; ação
  `Lançar pesagem`; formulário, seleções e painéis de venda/abate em 28 px;
  seletor Apartação/Venda/Abate sem sobreposição; rolagem horizontal garantida;
  e dialogs de apartações, embarques e sanidades unificados, inclusive no modo escuro.
- Contrato D.17D.2R6: campos de preenchimento com raio oficial de 8 px; remoção
  do botão de rodapé `Fechar` quando o dialog já possui `X`; seleção da linha
  com transição e ações `Editar`/`Excluir`; confirmação de exclusão não nativa;
  e correção das superfícies claras residuais no modo escuro de listagem,
  lançamento, tabelas, resumos, distribuição e dialogs.

### Incluído no pacote
- Fundação visual ModeloBase1, shell, sidebar flutuante, topbar, page containers,
  cabeçalhos e barras de ação no estado atual.

### Nota
- Esta versão não declara igualdade visual final. Toolbar completa, filtros,
  tabela, formulários, dialogs e responsividade final permanecem pendentes.

## [1.1.2] — 2026-08-03

### Corrigido (crítico)
- App abria preso em "Aplicativo desktop necessário" na 1.1.1: o `DbBootstrap`
  ainda exigia `window.pesagemApp.entities`, removido do preload durante a
  limpeza. Agora o bootstrap apenas prepara o Dexie e mostra "Preparando o
  sistema…" / mensagem de erro clara se falhar.
- Rótulos da Manutenção: restauração usa backup `.json`; card de status mostra
  "Armazenamento: IndexedDB local (Dexie)" no lugar do tamanho do arquivo.

### Adicionado
- `preload:contract:verify`: cruza o que o renderer usa (`window.pesagemApp.X`)
  com o que o preload expõe e falha se a UI pedir API removida — teria pego o
  bug acima. Incluído em `test:quick` e `test:full`.

### Removido
- Instalador `Setup 1.0.0.exe` esquecido na raiz do projeto (93 MB — risco de
  ser instalado por engano), 8 arquivos vazios (`src/public/`, componentes
  placeholder, `App.css`) e `release/builder-debug.yml`.

### Nota
A versão **1.1.1 não deve ser usada** (tela travada).

## [1.1.1] — 2026-08-03

### Removido (limpeza de código morto)
- Todo o stack SQLite legado: `electron/database/**` (conexão, migrations,
  repositories, manutenção SQLite, migrações legadas), `electron/db.cjs` (JSON) e
  os 5 handlers IPC de banco (database/weighing/maintenance/auxiliary/sanidade).
- Dependência **better-sqlite3** (e `asarUnpack`/`postinstall` relacionados) —
  o instalador não carrega mais módulo nativo.
- 36 scripts de verificação obsoletos do SQLite (de 53 para 17).
- Botão "Abrir pesagens.json" e caminho do banco no cabeçalho (apontavam para o
  armazenamento legado).

### Corrigido
- "Limpar todos os dados" agora limpa o armazenamento atual (Dexie) — antes ainda
  apagava o JSON legado, sem efeito sobre os dados reais.

### Adicionado
- `main:boot:verify`: inicializa o main process com o Electron stubado e prova
  que o app sobe e registra os IPCs — rede de segurança para o enxugamento.
- `packaged:source:verify` reescrito: garante pacote sem better-sqlite3 e main enxuto.

## [1.1.0] — 2026-07-20

### Mudança principal (arquitetura de armazenamento)
- Banco operacional migrado de SQLite nativo (better-sqlite3) para
  **IndexedDB/Dexie** no renderer. Sem módulo nativo, sem app.asar.unpacked para
  banco, sem conexão SQLite no main, sem "Banco SQLite não inicializado".
- Todos os dataAdapters operacionais (weighing, apartações, sanidade, embarques)
  e a tela de Manutenção passam a usar `src/storage/storageAdapter.js` (Dexie).
- Backup completo (JSON de todos os stores), export CSV/JSON, import (dry-run+apply)
  e restore agora são Dexie; arquivos salvos em userData via IPC de arquivo.

### Notas
- SQLite/better-sqlite3 permanece no repositório como **legado morto** (fora do
  fluxo operacional). Ver docs/evidence/slice-d16-.../SQLITE-DETACHMENT.md.
- Use `Pesagens Individuais Setup 1.1.0.exe`. Sem login/permissões/cloud.

## [1.0.2] — 2026-07-20

### Corrigido (hotfix)
- Falha persistente "Banco SQLite não inicializado" no app instalado ao fazer
  backup. Introduzido um **runtime central de caminhos** (SSOT,
  `electron/database/databaseRuntime.cjs`) configurado no bootstrap; o
  `ensureDatabaseReady` passa a usar esse runtime.
- Todos os handlers de Manutenção usam o wrapper `withDatabaseReady`; o
  backupService também garante o banco pronto.

### Adicionado
- Tela de Manutenção mostra diagnóstico local (Versão, caminho do banco, caminho
  do log, status) + "Copiar diagnóstico". IPC `app:getDiagnosticInfo`.
- Log local em `userData/logs/app.log` (offline, sem telemetria) com eventos de
  bootstrap e de manutenção.
- Testes: `installed:runtime:diagnostic:verify`; `packaged:source:verify`
  ampliado (runtime + diagnóstico + versão do pacote).

### Notas
- Use somente `Pesagens Individuais Setup 1.0.2.exe`. Confirme "Versão: 1.0.2"
  na tela de Manutenção. Sem login/permissões/cloud; dados preservados.

## [1.0.1] — 2026-07-20

### Corrigido
- Backup no app instalado podia exibir "Banco SQLite não inicializado". A tela de
  Manutenção agora garante o banco pronto (`ensureDatabaseReady`) antes de
  backup/exportação/importação/restauração/integridade.
- Inicializador central `ensureDatabaseReady` extraído para um módulo
  independente (`electron/database/databaseReady.cjs`) — sem dependência circular.

### Adicionado
- Teste de regressão que exercita o handler IPC real do botão de backup.
- Verificação de que a correção entrou no pacote (`app.asar`).
- Identificação de Versão e caminho do Banco na seção de Diagnóstico da tela de
  Manutenção.
- Log local simples em `userData/logs/app.log` (offline, sem telemetria).

### Notas
- Use somente o instalador `Pesagens Individuais Setup 1.0.1.exe`.
- Sem login/permissões/cloud/servidor. Dados preservados na atualização.

## [1.0.0] — 2026-07-16

Primeira versão distribuível.

### Adicionado
- App desktop Electron + React (Vite) + better-sqlite3, offline e local.
- Persistência SQLite (`pesagens.db`) em `%APPDATA%\pesagens-individuais\data`.
- Migrations 001–003 (schema inicial, entidades auxiliares, sanidade/embarque).
- Entidades operacionais SQLite-only: Pesagem Individual, Apartação/Lote,
  Sanidade (configuração, itens, animal), Embarque/Documentos.
- Tela **Manutenção**: backup do banco, exportar CSV/JSON, importar,
  restaurar (`.db`) e verificar integridade.
- Instalador NSIS x64 (wizard, pasta alterável, atalhos de área de trabalho e
  menu iniciar), preservando dados do usuário na reinstalação/desinstalação.
- Documentação de usuário em `docs/user/` (guia rápido, backup/restauração,
  exportação, instalação Windows, checklist de máquina limpa).

### Notas
- `pesagens.json` mantido apenas como legado/backup (não é apagado).
- Sem login, permissões, cloud ou servidor — por decisão de simplicidade.
- Ícone: default do Electron (pendência de asset de marca).
- Sem assinatura digital (SmartScreen pode alertar) — ver
  `docs/evidence/slice-d10-final-packaging-clean-machine/CODE-SIGNING.md`.

[1.0.0]: primeira release
## [1.1.12] — 2026-08-13

- Corrigida a seleção de lotes na importação: lotes desmarcados não retornam ao processamento.
- Adicionada seleção coletiva de lotes encontrados no arquivo importado.
- Normalização de nomes de lote/apartação na importação, tolerando diferenças de caixa e espaços.
- Atualizados os seletores de importação de saída e o pacote visual D.17D.2R17.
## [1.1.13] — 2026-08-13

- Barra de rolagem padronizada entre o navegador de desenvolvimento e o aplicativo Electron instalado.
- Largura fixa de 10 px, trilho, cursor, canto e modo escuro explicitamente aplicados à tabela de pesagens.
- Adicionado contrato automatizado para impedir que prioridades de CSS alterem a scrollbar no pacote instalado.
