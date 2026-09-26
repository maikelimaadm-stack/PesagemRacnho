# Changelog — Pesagens Individuais

Todas as mudanças relevantes deste app desktop offline são registradas aqui.
Formato baseado em "Keep a Changelog"; versionamento semântico (MAJOR.MINOR.PATCH).

## [1.4.0] — 2026-09-25

Etapas E1, E1B e os ajustes finais (E1C) do Plano Mestre 2. Esquema Dexie **8** e backup **formato 3**,
**sem mudança de esquema**. A única conversão é das preferências de relatório (favoritos, recentes e
modelos salvos), feita ao abrir Relatórios, repetível e registrada na auditoria. Instalador de
diagnóstico não assinado em `release-unsigned/`. Notas em `docs/release/1.4.0/RELEASE-NOTES.md`.

### Added (E1C — ajustes finais pedidos no REPORT da E1B)
- **CPF/CNPJ com máscara** nas fichas de Parceiros e de Propriedades: 000.000.000-00, 00.000.000/0000-00
  e o CNPJ alfanumérico (em maiúsculas), ao digitar e ao colar (com ou sem pontuação, até com o rótulo
  "CPF"/"CNPJ" na frente, com espaço, dois-pontos ou hífen); no máximo 14 posições; o cursor fica onde a
  pessoa edita. O que é gravado não muda (sem pontuação), e o documento aparece formatado ao abrir a
  ficha. CNPJ alfanumérico incompleto ou com dígito verificador errado não é salvo pela ficha (aviso),
  em vez de virar só números calado.
- **Excel com o bloco TOTAL POR:** o XLSX do Resumido com 3 níveis (ex.: Pesagens › Por apartação) traz,
  no fim de cada apartação, o mesmo bloco "TOTAL POR LOTE – <apartação>" da folha, com os mesmos números
  (a mesma função calcula os dois). O CSV continua uma linha por grupo + total geral.
- **Configurações › Relatórios liberada para o GESTOR:** o GESTOR vê Configurações no menu e, na tela, só o
  cartão Relatórios (divisor da @). O resto de Configurações continua do ADMIN — também por dentro: o
  serviço recusa o GESTOR em Geral, Curral e Comercial (`settings.manage`; antes aceitava, embora a tela
  nunca os mostrasse a ele). Permissão nova `settings.reports` (ADMIN e GESTOR).
- Título da folha de Pesagens: **"Relatório de Pesagens Individuais (Sintético/Analítico)"**; os outros
  relatórios continuam com o próprio nome.
- Gates novos: `registry:document-mask`, `reports:sheet-xlsx-parity` e `ui:dark-field-text`.

### Fixed (E1C)
- **Tema escuro:** o texto digitado nas fichas (e o valor dos seletores, como "Própria", "Sim", "MT") ficava
  escuro sobre fundo escuro em todas as fichas; agora segue a cor do campo. Os seletores de Configurações
  (inclusive o divisor da @) ganharam o fundo de campo escuro (antes, branco). O tema claro não muda.
- **Configurações:** com o "Rendimento de carcaça padrão (%)" em branco (o padrão), o Salvar de qualquer
  seção era recusado; agora branco é "sem rendimento padrão".
- Gates antigos do Dexie (`verify-dexie-backup.mjs`, `verify-dexie-import-restore.mjs`) esperavam 7
  categorias semeadas; a semente tem 12 desde a 1.3.0. Passam a ler a quantidade da própria semente
  (`storage:all:verify` verde).
- Documentação de perfis: o OPERADOR abre os relatórios de curral (sem valores), só não imprime nem
  exporta; a tabela oficial de permissões (doc 11 §4) voltou a bater com o código.

### Added (E1B — relatório em formato de folha)
- **A folha do relatório:** o Resumido aparece na tela como a folha que sai na impressão e no PDF —
  cabeçalho da propriedade com logo, título "Relatório de … (Sintético/Analítico)", seções por nível
  (APARTAÇÃO › DATA › tabela por lote), subtotal alinhado sob cada coluna, bloco **TOTAL POR LOTE – <apartação>**
  com três níveis, **TOTAL GERAL**, notas e rodapé com filtros, "@ = peso vivo ÷ 30", quem emitiu, data/hora,
  versão e **Página X de Y**. Um documento e um renderizador só para tela, impressão e PDF. CSV, XLSX e
  JSON continuam com uma linha por grupo e o Total geral (mesmos números); o bloco TOTAL POR e as notas
  existem só na folha.
- Regras da folha: cada célula sob o cabeçalho da sua coluna (gate por índice); coluna sem nenhum valor
  no relatório some (botão **Mostrar colunas vazias**); GMD sem pesagem anterior é "—", nunca "0,000",
  com a nota "GMD calculado com N de M animais"; kg com 1 casa, @ com 2, GMD com 3.
- **Pesagens › Tipo "Por apartação (resumo por data)"** (Apartação › Data › Lote, Resumido) com Qtd,
  Faixa exigida, Menor, Maior, Peso médio, Média @, Peso total, Total @, Ganho médio (kg e @), Ganho total
  (kg e @), Dias médios, GMD médio, Machos e Fêmeas. Também "Resumo por Sessão", "Por lote", "Por data" e
  "Analítico por animal".
- **Barra de filtros padrão** nos 12 relatórios: Data início/fim, Período com atalhos, Orientação,
  **Tipo de relatório**, Agrupar por, **Ordenar por**, **Pesagem anterior** (Todos/Com/Sem) e os botões
  Lotes, Apartações, Sexo, Raças, Era, Marcas, Categoria e Status com várias escolhas e contador
  ("Lotes (2)"), mais Limpar filtros. O relatório reabre como o usuário deixou (estado por usuário).
- Clique num grupo da folha abre o Detalhado filtrado; o Detalhado continua na grade e ganha **Ver como
  folha**. Botões **Imprimir**, **Excel**, **PDF** e **⋯** (CSV, JSON).
- **Cadastro de Propriedade › Cabeçalho dos relatórios:** produtor/razão social, endereço, CPF/CNPJ
  (inclusive CNPJ alfanumérico), inscrição estadual, "mostrar CPF/CNPJ e IE", telefone e **logo** (PNG/JPG
  reduzido para até 400 px e 300 KB), com pré-visualização. Vai no backup e volta na restauração.
- **Configurações › Relatórios › Divisor da arroba** (30, padrão, ou 15) para as colunas em @ de peso vivo;
  aparece no rodapé da folha e no manifesto.
- Gates `reports:sheet-data`, `reports:document-layout` e `registry:property-header` no `test:quick`.

### Added (E1)
- **Relatórios resumidos:** os relatórios agrupados abrem no modo **Resumido**, com uma linha por grupo
  (lote, categoria, raça…) e os totais em colunas (Cabeças, Peso médio, GMD…). O botão **Resumido |
  Detalhado** alterna a visão; clicar no grupo abre o Detalhado só daquele grupo, com selo de volta. A
  tela, o CSV, o XLSX, o JSON e a impressão A4 saem com a mesma tabela resumida, e o Total geral é
  calculado sobre a população inteira.
- **Agrupar por** rápido na barra do relatório, sem abrir diálogo, e **filtros rápidos** de um clique
  ("Sem pesagem há mais de 30 dias", "Somente entradas e saídas", "Somente perdendo peso", "Somente
  mudanças de lote no período", "Somente mortes").
- Ordenação dos grupos do Resumido pela coluna de total, salva no modelo junto com o modo.
- **Backup e Manutenção › aba Controle**: Trilha de auditoria, Qualidade dos dados, Histórico de backups e
  Pendências de pesagem.
- Gates `reports:summary-mode`, `reports:summary-export-parity` e `reports:catalog-consolidation` no
  `test:quick`.

### Changed
- **Catálogo consolidado de 51 para 12 relatórios** (mais 4 de controle na Manutenção): Rebanho atual, Ocupação de lotes, Pesagens,
  Fechamento do dia, Desempenho, Movimentação de lotes, Saídas, Vendas, Abates e Compras do período,
  Romaneio de embarque e Embarques previsto × realizado. Os 33 relatórios antigos viraram visões
  (`LEGACY_REPORT_ALIASES`): favoritos, recentes, modelos salvos e links antigos abrem o relatório novo
  já agrupado e filtrado como antes. Os relatórios de cadastros saíram do catálogo (as telas de
  Cadastros já listam e exportam).
- Favoritos, recentes e modelos salvos são convertidos para os relatórios novos na primeira abertura de
  Relatórios, sem perder nada; cada conversão fica na auditoria ("Relatório consolidado: … → …"), uma
  vez por item. Modelo que filtrava a mesma coluna da condição do relatório antigo continua com as duas
  regras (a antiga aparece com cadeado); modelo salvo sem totais continua sem totais; dois modelos de
  mesmo nome que caíram no mesmo relatório ganham o nome da visão antiga entre parênteses.
- Modelos, favoritos e recentes dos relatórios que foram para a aba Controle (ou que saíram da lista)
  continuam em Relatórios para abrir e excluir; na aba Controle não há "Salvar modelo" nem estrela.
- CSV do Resumido traz a coluna `grupo` com o caminho completo ("Engorda > Lote 01"), para a
  hierarquia sobreviver a ordenar/filtrar no Excel.
- Barra do relatório: ações secundárias (Níveis, Totais, Colunas, Atualizar, Salvar modelo, Imprimir)
  viram ícones com dica, e a barra quebra linha em vez de cobrir a faixa de filtros.
- E1B: OPERADOR e CONSULTA (que não abrem Backup e Manutenção) veem **Pendências de pesagem** e
  **Qualidade dos dados** em Relatórios, no grupo **Controle**; ADMIN e GESTOR seguem com os 12 + aba
  Controle.
- E1B: modelo salvo antes da 1.4.0 (sem modo) abre no Resumido só se tiver agrupamento; sem agrupamento,
  no Detalhado.
- E1B: impressão e PDF passam a ser a folha: margens de 10 mm, "Página X de Y" pela própria página (sem
  o rodapé nativo do Chromium), logo embutido (CSP `img-src data:`); XLSX com os totais em kg em `#,##0.0`.
- E1B: a **Faixa exigida** (faixa de peso do cadastro atual do lote) só aparece no nível do lote — vazia
  nos subtotais de data/apartação e no total geral, na folha, no CSV/XLSX e nos subtotais do Detalhado.

### Fixed
- **Relação de Pesagens:** a tela quebrava ao abrir o diálogo coletivo "Data, apartação e lote"
  (defeito presente no instalador 1.3.2; commit 05e6d33).
- **Importação:** dois cliques seguidos em "Aplicar" com o mesmo arquivo e a mesma configuração agora
  resultam em uma única gravação (trava de execução em andamento; commit 70f43c6).
- **Backup e Manutenção:** em 1440×900 os cartões Status do banco × Backup e Limpeza × Diagnóstico se
  sobrepunham; as linhas da grade agora têm a altura do conteúdo.
- **Relatórios — CSV:** texto começando com "-" seguido de conta ("-1+1", "-2+3+cmd|…") saía sem o
  apóstrofo de proteção e o Excel o lia como fórmula; só número negativo passa sem apóstrofo (a
  importação desfaz a proteção do mesmo jeito).
- **Relatórios — rótulos de grupo:** agrupar por data mostrava "2026-08-01" e por sim/não mostrava
  "true/false"; agora "01/08/2026" e "Sim/Não" na tela, impressão, CSV e XLSX (JSON segue canônico).
- **Relatórios — médias:** média de coluna inteira (dias no lote, dias sem pesagem) saía arredondada
  para inteiro (34 em vez de 33,5), inclusive no XLSX; agora com uma casa decimal.
- E1B — **Relatórios por sessão:** as sessões saíam em ordem de texto ("01/01/2026" antes de
  "01/10/2025"); agora em ordem de data.
- E1B — **Detalhado (grade):** o grupo por data aparecia como "2026-02-28"; agora "28/02/2026", e os
  totais usam os mesmos rótulos da folha ("Qtd", "Peso médio (kg)", "Faixa exigida (kg): 150–350").
- E1B — o modelo antigo mostrava colunas desalinhadas (Peso total sob "Média (@)"), GMD "0,000" sem
  pesagem anterior e colunas vazias ocupando espaço; a folha nova não tem nenhum dos três.

## [1.3.2] — 2026-09-24

Esquema Dexie **8** e backup **formato 3**, sem migração de dados. Instalador de diagnóstico não
assinado em `release-unsigned/`. Notas em `docs/release/1.3.2/RELEASE-NOTES.md`.

### Changed
- A versão instalada passou a aparecer permanentemente na barra superior, ao lado do selo PI, e na
  barra móvel; antes ficava apenas em tooltip, autenticação, menu do usuário e Configurações.
- O título nativo da janela agora inclui a versão obtida pelo Electron (`app.getVersion()`), evitando
  confusão entre uma instância antiga ainda aberta e o executável recém-instalado.
- O gatilho de ações em lote no cabeçalho da tabela agora é somente o botão de três pontos, igual ao
  menu de ações das linhas; a quantidade selecionada permanece no resumo interno e na descrição.

### Fixed
- Diagnóstico de atualização deixa explícito quando o Windows ainda está executando a versão
  anterior e impede que o usuário interprete a tela antiga como a nova instalação.

## [1.3.1] — 2026-09-23

Esquema Dexie **8** e backup **formato 3**, sem alteração destrutiva no banco. Instalador de
diagnóstico não assinado em `release-unsigned/`; assinatura Authenticode permanece pendente.
Notas em `docs/release/1.3.1/RELEASE-NOTES.md`.

### Added
- Ações em lote diretamente no cabeçalho da coluna Ações da Relação de Pesagens, organizadas em
  Identificação e cadastro, Movimentação e Dados comerciais.
- Edição coletiva do cadastro canônico do animal: marca, raça, sexo, era e categoria, com
  sincronização dos snapshots históricos e bloqueio de colisão número + marca.
- Edição coletiva de compra/cadastro com vendedor/origem, valor por cabeça, GTA, NF-e, frete e
  observação; novas colunas configuráveis GTA compra, NF-e compra e Frete compra.
- Edição coletiva de venda e abate com parceiro, destino, valores, embarque e documento vinculado.
- Gate automatizado específico para ações em lote e integridade do histórico.

### Changed
- Menu coletivo informa quantos registros da seleção são compatíveis com cada operação e desativa
  ações sem registros aplicáveis.
- Pop-ups coletivos seguem o padrão visual da aplicação, inclusive modo escuro, fechamento por X e
  botões verdes que preservam a cor no hover.

### Fixed
- Campos comerciais vazios não sobrescrevem informações existentes durante a atualização em lote.
- Documentos só podem ser vinculados ao embarque ao qual pertencem; a remoção limpa também os
  campos derivados de motorista, placa, tipo e número do documento.

## [1.3.0] — 2026-09-17

Esquema Dexie **8** (aditivo), backup **formato 3**. Instalador candidato (não assinado) em
`release-unsigned/`, tag `v1.3.0-rc1`; teste físico em máquina limpa NÃO EXECUTADO. Notas em
`docs/release/1.3.0/RELEASE-NOTES.md`.

### Added
- **Sanidade** volta ao produto (ADR-049) em stores próprias: programas/procedimentos,
  medicamentos/produtos e aplicações por animal. Tela Sanidade (abas Programas, Medicamentos e
  Aplicações), histórico na Ficha do animal e painel opcional no Lançamento em formato de tabela,
  com "Aplicar esta configuração aos próximos animais". A aplicação é gravada na mesma transação
  da pesagem; cancelar a pesagem cancela as aplicações dela. Sem estoque, compras ou prescrição.
- Relatórios (menu único): catálogo com famílias, filtros, agrupamento, totais, modelos
  salvos, impressão, PDF, CSV, JSON e XLSX sobre a mesma população da tela.
- Exportação da Relação em dois arquivos: relatório amigável e arquivo para reimportação.
- Backup de segurança antes de atualizar o banco também quando o sistema é aberto sem o
  aplicativo desktop (cópia validada por SHA-256 em banco separado do navegador).

### Changed
- Lançamento mantém o contexto da sequência depois de salvar (tipo, data, marca, raça, sexo,
  categoria manual, apartação/lote, motivo de saída, embarque e sanidade marcada) e limpa só os
  dados do animal (identificação, peso, observação, valores individuais, causa de morte não
  repetida). Identificação e peso em fonte 18 px, identificação em negrito.
- Modelo de planilha de importação só com colunas digitadas (Data, NumeroAnimal, Marca, Sexo,
  Raça, Categoria, Peso, Apartação, Lote, Observação); peso anterior, dias, ganho e GMD são
  sempre calculados pelo sistema.
- Ordem canônica do histórico: data, depois Cadastro, Manejo e Saída no mesmo dia.
- CSV com BOM, separador ";" e escape correto; campo vazio nunca vira 0.

### Fixed
- Saída sem peso deixava de contar como pesagem de 0 kg no cálculo de ganho/GMD.
- Valores de venda/abate e causa de morte do animal anterior não passam mais para o próximo.
- Serviços recusam gravação sem sessão quando o login está ativo; exportar e ver arrobas exigem
  permissão; backup/exportação/importação da Manutenção exigem `maintenance.backup`.

## [1.2.0] — 2026-09-16

Marco 1.2.0 do Programa Pesagens Individuais 2.0 (Fase 1). Esquema Dexie **7**,
backup **formato 3** e login local. Instalador de diagnóstico (não assinado) em
`release-unsigned/`; teste físico em máquina limpa NÃO EXECUTADO. Notas completas em
`docs/release/1.2.0/RELEASE-NOTES.md`.

### Added
- Login local com usuários e perfis (ADMIN, GESTOR, OPERADOR): configuração inicial do
  administrador, bloqueio por inatividade, bloqueio temporário após tentativas erradas e
  troca de senha obrigatória na primeira entrada — tudo offline, sem senha padrão.
- Cadastros mestres próprios (Marcas, Raças, Categorias, Parceiros, Propriedades e Causas
  de Morte) com nome único, item padrão, inativação e contagem de uso.
- Identidade do animal por marca cadastrada; migração automática e resumível da 1.1.17,
  com backup conferido antes de qualquer alteração.
- Backup formato 3 (com cadastros e usuários), limpeza em dois níveis e auditoria por
  usuário em lançamentos, backups, restaurações e limpezas.

### Changed
- Relação de pesagens, cadastros e tela de login alinhados ao ModeloBase1 por estilos
  computados: faixa de filtros, tipografia e grade (cabeçalho branco de 12 px, linhas de
  26 px) e moldura da barra de ações. A tabela do Lançamento passou a usar a mesma grade.
- As pílulas de filtro passaram a ser as colunas visíveis da tabela; a configuração
  separada de filtros deixou de existir (permanece a de colunas).
- Menu reorganizado em Operação · Cadastros · Sistema, filtrado pelo perfil.
- Categoria do animal passa a ser **automática pelo peso**: cada categoria tem sexo (Macho ou
  Fêmea), faixa de peso (mínimo/máximo) e era. No Cadastro, "Automático" escolhe, entre as
  categorias do sexo, a de menor ordem cuja faixa contém o peso; a era gravada na pesagem vem
  da categoria. Nas pesagens de Manejo o animal automático é reclassificado pelo novo peso;
  categoria escolhida à mão não muda. A escolha e a origem ficam gravadas no animal e em cada
  pesagem (`categoria_id`, `categoria_automatica`).
- Formulário de Cadastro do Lançamento na ordem Data, Sexo, Categoria, Raça, Marca,
  Identificação, Peso e Observação; a lista de categorias mostra só as do sexo escolhido.

### Fixed
- Restaurar backup, limpar dados, reset completo e continuar migração voltaram a ser
  exclusivos do ADMIN: a verificação lia o perfil de um campo que não o trazia e o GESTOR
  conseguia executá-las. A tela também deixa de oferecer essas ações a outros perfis.
- Uma saída sem peso (morte, doação, transferência) não apaga mais a categoria, a era nem o
  peso atual do animal: vale a última pesagem com peso. Peso fora de todas as faixas mantém
  a última categoria válida.
- Marca, raça, causa de morte (por id) e a origem do rendimento passam a ser gravadas na
  pesagem em vez de descartadas; o cadastro usa a marca/raça escolhida antes de procurar pelo
  texto.
- Arroba única: 1 @ = 15 kg de carcaça, com o rendimento informado ou o padrão configurado.
  Sem rendimento, carcaça e arrobas aparecem como "—" (acabaram o 50 % implícito, o peso/30
  do resumo de lotes e o peso vivo/15). O rendimento padrão da empresa começa vazio.
- Médias e somas dos resumos ignoram valores ausentes em vez de contá-los como zero; o GMD de
  grupo é ponderado (soma dos ganhos ÷ soma dos dias) e o preço médio da arroba é ponderado
  pelas arrobas.
- Perfil Consulta não lança, edita, exclui nem importa pesagens (inclusive chamando o serviço).
  Valores comerciais (compra, venda, preço/@, arrobas) só aparecem para Admin e Gestor.

### Removed
- Painel lateral de filtros da Relação e dos cadastros (filtragem por pílulas e menu de
  coluna).
- Data de nascimento (e "nascimento estimado") do Lançamento, do diálogo SN e da migração:
  nada é mais estimado a partir da era. Saíram também as faixas de idade em meses das
  categorias; as categorias padrão chegam sem faixa de peso e era, para o responsável definir.
- Tela de Configurações de Sanidade, tabela `lotes`, diálogo legado "Gerenciar saídas" e
  as configurações `cadastros-auxiliares:*` (convertidas nos cadastros).

## [1.1.18] — 2026-09-14

Marco 1.1.18 do Programa Master de Evolução (ADR-047): baseline verde, contrato de
versão e governança. **Sem esquema novo** — Dexie 6 e backup formato 2 inalterados.
Instalador não gerado neste marco; teste físico NÃO EXECUTADO.

### Added
- Contrato de versão em quatro eixos (`src/versioning/versionInfo.js`): `APP_VERSION`,
  `DB_SCHEMA_VERSION` (= 6), `BACKUP_FORMAT_VERSION` (= 2), `RELEASE_MANIFEST_VERSION`
  (= 2), marcadores `UI_CONTRACT_VERSION` (`ModeloBase1-R34`), `DATA_CONTRACT_VERSION`
  (1), `DATA_BUILD_ID` (`schema-v6`), `BUILD_INFO` (commit e instante do build via
  `__BUILD_INFO__` do Vite) e `describeVersions()`.
- Gate `release:version-contract:verify` (`scripts/verify-version-contract.mjs`), incluído
  em `test:quick` e `test:full` logo após `release:current-only:verify`: package.json =
  package-lock = fallback de `appVersion.js`; notas e checklist da versão presentes;
  CHANGELOG com bloco datado e sem "Não lançado"; nenhum Setup ou manifesto de outra
  versão em `release/`/`release-unsigned/`; `RELEASE_MANIFEST_VERSION` único. Inclui
  `--self-test` com fixtures positivas e negativas em pasta temporária.
- Manutenção › Status do banco › **Versões**: Aplicativo, Esquema do banco, Formato do
  backup, Manifesto, Build (commit · data) e Contrato UI/dados; "Copiar diagnóstico"
  inclui os mesmos campos.
- Documentos de engenharia: `docs/engineering/VERSIONING.md`, `RELEASE-POLICY.md` e
  `AUTH-THREAT-MODEL.md` (o que o login local de 1.2.0 protege e o que não protege).
- ADR-041 a ADR-048 (DEC-023 a DEC-030), contratos 10–14 em revisão 2 e
  `docs/evidence/STATE-OF-REPO-BEFORE.md` incorporados à árvore do marco; evidências em
  `docs/evidence/s00-baseline-recovery/` e `docs/evidence/s00-versioning-auth-contract/`.
- Repositório Git inicializado em 14/09/2026 com a tag `v1.1.17-baseline` (commit
  `77eeb3b`) como ponto de partida imutável do programa.
- Massa de teste anônima e determinística (`src/modules/perf/testMass.js`) nos tamanhos
  vazia, pequena, 36 mil e 250 mil pesagens, no formato das stores Dexie
  (`npm run perf:testmass`).
- Bench de baseline (`src/modules/perf/baselineBench.js`) com p50/p95/p99 de carga
  inicial, índice de animais, identificação → peso, busca indexada por animal e por
  período, salvamento local e recarga; roda em Node (`npm run perf:baseline`) e no
  navegador/Electron. Contrato `perf:contract:verify` em `test:quick` e `test:full`.
- Captura visual das três telas em tema claro e escuro com massa pequena e userData
  isolado (`npm run evidence:screens`).
- Documentos F0: mapa de campos atual → modelo-alvo, catálogo de fórmulas com
  divergências D1–D7 e status da fase em `docs/arquitetura-produto/`.
- Referência renderizada do ModeloBase1 real em `docs/evidence/modelobase1-referencia/`;
  capturas das telas portadas em `docs/evidence/modelobase1-relacao-2026-09-14/` e
  `docs/evidence/modelobase1-cadastros-2026-09-14/`; estilos computados e capturas do
  design de Lançamento em `docs/evidence/design-lancamento-2026-09-09/`; baseline de
  desempenho em `docs/evidence/f0-baseline/` e `docs/evidence/program-2.0/phase-00/`.

### Changed
- `release-manifest.json` passa ao formato 2: `releaseManifestVersion`, `appVersion`
  (mantido `version` para compatibilidade), `dbSchemaVersion`, `backupFormatVersion`,
  `uiBuildId`, `dataBuildId`, `uiContract`, `dataContract`, `gitCommit`, `buildTimestamp`,
  `platform`, `arch`, `installer{file,sha256,sizeBytes,builtAt}`, `signed` (sempre
  `false` até Authenticode), `distribution` e `features`. O gerador exporta
  `buildReleaseManifest`/`writeReleaseManifest` para teste.
- `backupService.js` importa `BACKUP_FORMAT_VERSION` de `versionInfo.js` em vez de
  declarar a constante localmente (valor 2; comportamento e formato idênticos).
- `vite.config.js` define `__BUILD_INFO__` (commit curto via `git rev-parse`, com
  fallback `null`, e `buildTimestamp` ISO).
- `.gitignore` ancora `/release/` e `/release-unsigned/` na raiz para que
  `docs/release/<versão>/` seja rastreado pelo git.
- Relação de Pesagens e cadastros auxiliares (Parceiros, Mortalidade, Sanidade) passam a
  usar a Tela Mãe do Cadastro de Empresas do PROJETOMG-main: barra de ações
  `mg-action-bar` (Filtrar, ação principal, Editar/Excluir da seleção; pesquisa
  expansível com lista de resultados e "Buscar todos"; modos de visualização; menu "Mais
  opções" com Atualizar, exportar, importar, modelo e configuração de colunas), faixa
  `mg-table-panel-strip` com uma pílula de filtro por coluna e o botão de configurar
  colunas, e painel lateral `filter-panel` (260 px, campos rotulados por coluna, seleções
  e datas, Limpar/Aplicar).
- Cadastros auxiliares ganharam configuração de colunas (ordem e visibilidade guardadas
  por grupo) e pílulas de filtro por coluna, antes limitadas ao tipo.
- Componentes portados do modelo para `src/components/mak/`: `MgFilterPanel`,
  `MgDesktopSearch`, `MgSearchResultsDropdown`, `MgSpeedDialMenu`, `MgTablePanelStrip`,
  `MgCmdSelect`, `MgPortalPanel`, `useMgPanelPosition`, `mgSearchHighlight`. Bloco
  `D.17D.2R34` no `d17b-modelobase1.css` compõe a página; os estilos dos componentes já
  existiam em `mg-layout.css`. Contratos R34 em `ui:consistency:verify` protegem a
  estrutura das duas telas.
- Revisão R33: a tabela da tela de lançamento voltou a reutilizar o contrato visual da
  tabela Pesagens Individuais — cabeçalho, linhas, tipografia, cores, grade, zebra e modo
  escuro — preservando apenas os dados próprios da tela.
- Revisão R32: o campo Data do lançamento e o botão do calendário formam uma única
  superfície contínua, sem divisor interno, sombra duplicada ou troca de fundo no hover,
  nos temas claro e escuro.
- Revisão R31 refeita sobre o HTML final de 09/09/2026 (`Lançamento de Pesagens.dc.html`,
  projeto Claude Design `formulario-escopo`): controles com 28 px, faixa operacional com
  32 px, contornos verdes suaves, valores de identificação/peso em âmbar, ganho em verde,
  alerta em âmbar, tabela e painel lateral na proporção 3:1 e rodapé de 44 px; malha única
  de nove colunas iguais nas linhas de campos e de Apartação/Transferência; indicação
  automática do lote em pílula de três colunas; ações redondas da barra com fundo branco e
  borda `#d8dde5`; tabela em 12 px com cabeçalho `#17243a`/`#dfe5eb`, linhas de 26 px e
  zebrado `#fafbfc`; painel Distribuição de Lotes com seletor Dia/Total em pílula verde.
  Bloco `D.17D.2R29` no `d17b-modelobase1.css` concentra a paridade, com variantes de
  modo escuro; contratos `ui:consistency:verify` atualizados.
- A visualização inicial do lançamento reproduz as 14 colunas do modelo (as demais
  continuam no configurador). Configurações da versão anterior são migradas uma vez para
  esse padrão, sem alterar registros de pesagem.
- Ações Editar e Excluir da tabela de lançamento são exibidas somente por texto.

### Fixed
- Gates `ui:operational-customization:verify` e `ui:consistency:verify` (vermelhos na
  tag `v1.1.17-baseline`) realinhados ao contrato real do código, sem alterar código de
  produto (commit `8c79022`): o Lançamento seleciona compradores, vendedores e
  frigoríficos do registry e não usa mais `GerenciarSaidasDialog`; a alternância
  Registro/Tabela é validada por estrutura (`.view-seg`, slider, `VIEW_MODES`, rótulos
  acessíveis), não por sintaxe de template literal. `test:quick` volta a 20/20 (21/21 com
  o gate de versão).
- `main:boot:verify` voltou a passar: o stub do Electron em Node não definia
  `process.resourcesPath`, e o caminho do ícone empacotado (`main.cjs`) derrubava a
  verificação de boot desde a 1.1.16.
- Pesquisa expansível da Tela Mãe: a barra usa os 28 px do modelo e o campo dentro da
  pílula deixa de herdar fundo, altura de 38 px, raio e anel de foco dos inputs globais; a
  abertura não depende mais de `requestAnimationFrame` (aba sem pintura não trava mais a
  pílula fechada).
- A prévia do ganho aceita decimal e data brasileiros, ignora lançamentos futuros/mesmo dia
  e não conta o peso ainda não salvo como pesagem histórica.
- O campo composto Peso usa uma única borda de foco suave; corrigidos conflitos antigos
  que deixavam os títulos da faixa azuis e os rótulos de ganho escuros.

### Removed
- Nenhuma funcionalidade removida. O popup legado `GerenciarSaidasDialog` continua no
  repositório sem uso pelo Lançamento; sua remoção está prevista para o marco 1.4.0
  (ADR-031).

### Migration
- Nenhuma — esquema Dexie 6 e backup formato 2 inalterados. Backups de 1.1.16/1.1.17
  restauram sem conversão; nenhum dado é regravado.

### Security
- Nenhuma alteração; login local previsto para 1.2.0 (ADR-041…046). O modelo de ameaças
  já está documentado em `docs/engineering/AUTH-THREAT-MODEL.md`. Distribuição oficial
  continua bloqueada sem certificado Authenticode; nenhum pacote foi gerado neste marco.

## [1.1.17] — 2026-09-10

Build de diagnóstico (`release-unsigned/Pesagens Individuais Setup 1.1.17.exe`, sem assinatura
Authenticode), visual D.17D.2R31, baseado no arquivo `Lançamento de Pesagens.dc.html` de 09/09/2026.
Notas em `docs/release/1.1.17/`.

### Added
- Faixa única de Animal, Última, Ganho, tendência e avisos na tela de lançamento.

### Changed
- Tela de lançamento reconstruída com a malha, dimensões, cores, tabela, rodapé e painel lateral do
  modelo aprovado (R29–R33); visualização inicial com 14 colunas e demais campos em Configuração de colunas.
- Modo escuro e pop-ups conferidos com o mesmo sistema de componentes.
- Identificação por múltiplas marcas resolvida ao sair do campo, não durante a digitação.

### Fixed
- Prévia de ganho corrigida para números/datas brasileiros e ordem cronológica.

### Removed
- Nenhum.

### Migration
- Nenhuma — esquema Dexie 6 e backup formato 2 inalterados.

### Security
- Nenhuma alteração; pacote de diagnóstico sem assinatura (não é release oficial).

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
