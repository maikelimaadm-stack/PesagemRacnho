# REPORT — E1B Relatórios em formato de folha + cabeçalho da propriedade com logo

**ETAPA:** E1B (continua a 1.4.0) · **VERSÃO:** 1.4.0 (esquema Dexie 8 e backup formato 3, sem mudança) ·
**BRANCH:** `program/e1-relatorios` (E1 em `c6aa8c3`; main continua em `6cccb5f`) · **DATA:** 25/09/2026

**STATUS: CONCLUÍDA.** O test:quick está verde (82/82) e o instalador 1.4.0 (E1 + E1B) foi gerado de novo.
Falta o seu teste único no app instalado. Depois dele vem o fast-forward da main (resposta 1).

---

## 1. O que foi feito

1. **Respostas 2 e 3 do REPORT da E1** (commit `3d079f4`):
   - OPERADOR e CONSULTA, que não abrem a Manutenção, veem **Pendências de pesagem** e **Qualidade dos
     dados** em Relatórios, no grupo **Controle**. ADMIN e GESTOR continuam com os 12 relatórios e a aba
     Controle. O gate de permissões foi atualizado.
   - Modelo antigo sem modo abre no **Resumido só se tiver agrupamento**; sem agrupamento, abre no
     Detalhado.
   - A resposta 4 ("mais de N dias") ficou como estava.
2. **Cabeçalho da propriedade.** A ficha da Propriedade ganhou o cartão **Cabeçalho dos relatórios**
   (commit `c68d3ed`):
   - Campos: produtor/razão social, endereço, CPF/CNPJ (inclusive o CNPJ alfanumérico), IE, "mostrar
     CPF/CNPJ e IE", telefone e **logo**. São campos não indexados, sem mudança de esquema.
   - O logo é ajustado no próprio programa: até **400 px** de largura e **300 KB**, só PNG ou JPG, com
     a assinatura do arquivo conferida.
   - A **pré-visualização** mostra o cabeçalho como ele sai na folha.
   - Qual propriedade vai no cabeçalho: a do filtro do relatório, quando ele escolhe uma só propriedade
     por lista marcada ou "igual a"; senão, a Padrão; sem nenhuma, o nome do sistema.
   - O gate `registry:property-header` faz backup e restauração com o logo, e os bytes voltam idênticos.
3. **Configurações › Relatórios › Divisor da arroba** (commit `871bfcc`): 30 (padrão) ou 15. Vale
   para Média @, Total @ e o ganho em @ na folha e nos arquivos. Aparece no rodapé ("@ = peso vivo ÷
   30") e no manifesto. A @ de carcaça do Comercial (÷ 15) não muda.
4. **Uma folha só para tela, impressão e PDF** (commit `95ad0f1`, `reportDocument.js` + `sheetHtml.js` +
   `sheetStyles.js`):
   - **Cabeçalho** com o logo, que se repete em todas as páginas.
   - **Título**: "Relatório de Pesagens (Sintético)" no Resumido, "(Analítico)" no Detalhado.
   - **Seções**: APARTAÇÃO › DATA › tabela por lote.
   - **Subtotal** na mesma coluna de cada valor.
   - **TOTAL POR LOTE – <apartação>**, com o total da apartação.
   - **TOTAL GERAL**, notas e rodapé: filtros, "@ = peso vivo ÷ 30", emitido por, data e hora, versão e
     **Página X de Y**.

   Os três erros da §4 não voltam, e cada um tem gate:
   - **Colunas desalinhadas:** cada linha é gerada coluna por coluna, e o gate confere célula × coluna
     por índice em todas as linhas.
   - **GMD "0,000":** sem pesagem anterior o GMD é **"—"**, com a nota "GMD calculado com N de M animais".
   - **Colunas vazias:** coluna sem nenhum valor no relatório inteiro **some**. O botão **Mostrar
     colunas vazias** traz de volta, e ele vale também para a impressão.

   Outras regras da folha:
   - kg com 1 casa, @ com 2 e GMD com 3.
   - Orientação automática: retrato, depois paisagem com letra menor. Se nada couber, aparece um aviso;
     nenhuma coluna é cortada sem você saber.
   - Impressão e PDF usam `@page` A4 com margens de 10 mm e "Página X de Y" nas margens da página. O
     IPC passou a `displayHeaderFooter: false` e `preferCSSPageSize: true`. A CSP permite só a imagem
     embutida (`img-src data:`).
5. **Barra de filtros padrão nos 12 relatórios** (commit `62bc5fb`):
   - Data início/fim, Período com atalhos, **Orientação**, **Tipo de relatório** (os presets da E1),
     **Agrupar por**, **Ordenar por** e **Pesagem anterior** (Todos/Com/Sem).
   - Botões **Lotes, Apartações, Sexo, Raças, Era, Marcas, Categoria e Status**, com várias escolhas e
     contador ("Lotes (2)"), e **Limpar filtros**. Usam o mesmo motor de filtros e o mesmo Agrupar por
     da E1.
   - **Proprietário** fica para a E3 (o botão só aparece quando a coluna existir).
   - O relatório reabre como cada usuário o deixou (último estado por usuário).
6. **Pesagens › Tipo "Por apartação (resumo por data)"** (commit `8451db4`): Apartação › Data › Lote,
   Resumido, com as colunas da tabela da §4:
   - Qtd, **Faixa exigida** (a faixa do cadastro do lote, só na linha do lote), Menor, Maior;
   - Peso médio, Média @, Peso total, Total @;
   - Ganho médio (kg e @), Ganho total (kg e @), Dias médios, GMD médio;
   - Machos e Fêmeas.

   Pesagens também tem os tipos "Resumo por Sessão" (como abre), "Por lote", "Por data" (sem a Faixa) e
   "Analítico por animal". As sessões agora saem em **ordem de data**; antes saíam em ordem de texto.
7. **Resumido = folha interativa; Detalhado = grade + "Ver como folha".**
   - No Resumido, clicar num grupo ou no título da seção abre o Detalhado filtrado, e clicar num total
     ordena.
   - O Detalhado continua na grade e ganha **Ver como folha**, só leitura.
   - Na grade, a data do grupo sai como 28/02/2026 (antes 2026-02-28), e os totais usam os mesmos
     rótulos da folha.
8. **Documentação:**
   - print-contract e pdf-contract refeitos para a folha.
   - `docs/user/RELATORIOS.md` ganhou as seções "A folha do relatório" e "Cabeçalho da propriedade", a
     barra de filtros e o Tipo de relatório.
   - `CADASTROS.md` e `BACKUP-E-RESTAURACAO.md` atualizados.
   - Contratos: EXPORT §9, REPORT-DEFINITION §4.2, COLUMN-DEFINITION, AGGREGATION e PERMISSIONS.
   - CHANGELOG `[1.4.0]` e `docs/release/1.4.0` foram acrescidos (mesma versão, ainda não distribuída).
   - `test:quick` verde e `dist:unsigned` refeito (seção 3).
9. **Revisões adversariais.**
   - **Durante o trabalho**, cada bloco teve revisão. Os achados foram corrigidos:
     - a faixa do lote aparecia agrupando só por data (agora sai de todos os canais);
     - colunas só de cálculo (Machos, Fêmeas, com anterior) apareciam no seletor e nas exportações;
     - CNPJ alfanumérico;
     - corrida no ajuste do logo ao trocar de ficha;
     - logo com assinatura falsa.
   - **Revisão final** com 4 dimensões (números, tela, segurança, docs) e 8 agentes: **17 achados
     confirmados, 3 refutados**, todos corrigidos nos commits `2e3d9c6`, `8efb541` e `ea7fa2a`.
     - Tela e números:
       - **(média)** Resumido sem totais escondia a coluna de contagem; a folha ficava sem nenhum
         número.
       - **(média)** "Ordenar por" um total criado no diálogo (id com ":") era ignorado.
       - **(média)** Um filtro fixo de modelo convertido vazava para o último estado e não podia ser
         tirado.
       - **(média)** O botão Status do Rebanho mostrava "Status (1)" sem nada marcado e somava ATIVO ao
         que se marcava.
       - **(baixa)** O Tipo aparecia escolhido com outros totais, e escolhê-lo de novo não fazia nada.
       - **(baixa)** Um clique na folha do Detalhado mudava o modo gravado.
       - **(baixa)** Sair em menos de 600 ms perdia o último estado.
     - Cadastro:
       - **(média)** O cabeçalho pegava a propriedade errada com filtro "contém" ou nome sem acento.
       - **(baixa)** "CPF 699.577.406-01" virava CNPJ alfanumérico (≈ 0,23 % dos CPFs).
     - **8 achados de docs** (afirmações que não batiam com o código) foram corrigidos. O principal: o
       bloco "TOTAL POR" e as notas existem só na folha, e os arquivos têm uma linha por grupo com os
       mesmos números.
     - Os 3 refutados são escolhas documentadas, não defeitos. Por exemplo, os rótulos dos totais
       diferem entre a grade e os arquivos, mas os valores são idênticos.
   - **Conferência extra minha:** no Detalhado impresso faltava "@ = peso vivo ÷ 30" no rodapé, e o
     zero de Machos/Fêmeas saía como 0 em vez de "—" (commit `31310a0`).

**Capturas.** Foram feitas no harness de desenvolvimento (`.tmp/e1-harness`, ignorado pelo git), que
monta as telas reais:
- a sessão ADMIN é simulada, **sem senha**;
- a massa é determinística: 100 animais e 300 pesagens;
- a propriedade é de **teste**: "PRODUTOR DE TESTE", "FAZENDA BOA VISTA (TESTE)", o CNPJ fictício de
  testes 11.222.333/0001-81 e um logo "ZF" desenhado pelo script;
- o Electron roda com perfil isolado e recriado, e nunca toca o seu banco.

Os arquivos, em `docs/evidence/e1b/`:
- **(a)** `a1-pesagens-por-apartacao-data-paisagem-tela.png`, `a2-…-total-por-lote.png` (o bloco TOTAL
  POR LOTE – ENGORDA) e `a3-…-tela-escuro.png`;
- **(b)** `b-pesagens-por-apartacao-data-a4-retrato.pdf` (12 páginas, retrato, fonte 6,8 pt, 17 colunas
  cabem em 679 de 718 px), com `b1-pdf-a4-retrato-pagina-1.png` e `b2-pdf-a4-retrato-pagina-12.png` (TOTAL
  POR LOTE – VENDA, TOTAL GERAL, notas, rodapé e "Página 12 de 12"). O PDF foi gerado com as **mesmas
  opções do IPC do app** (`pdfOptions`);
- **(c)** `c-propriedade-cabecalho-logo-previa.png`;
- `capture-report.json` com os passos e as medidas.

## 2. Arquivos criados / alterados (76 arquivos, `c6aa8c3..HEAD`)

**Novos:**
- **Domínio:**
  - `src/modules/reporting/domain/reportDocument.js`: documento da folha, página, TOTAL POR e notas;
  - `domain/reportViews.js`: tipos de relatório, `matchView`, `parseSortChoice`, `filtersForDisplay`;
  - `infrastructure/exporters/sheetHtml.js` e `sheetStyles.js`.
- **Cadastro:**
  - `src/modules/catalog/domain/propertyHeader.js`;
  - `application/propertyHeaderService.js`;
  - `src/components/cadastros/LogoField.jsx`, `PropertyHeaderPreview.jsx` e `logoImage.js`.
- **Tela:** `src/components/reports/ReportFilterBar.jsx` e `ReportSheetView.jsx`.
- **Gates:** `scripts/verify-reports-sheet-data.mjs`, `verify-reports-document-layout.mjs` e
  `verify-property-header.mjs`.

**Removido:** `src/components/reports/ReportSummaryTable.jsx`, substituído pela folha, e o CSS que só
ele usava.

**Alterados:**
- **Relatórios:**
  - `reportService.js` (Controle para OPERADOR/CONSULTA, divisor, pares de métricas);
  - `reportTemplateService.js` (modo de modelo antigo, último estado);
  - `reportExportService.js` e `reportPrintService.js`;
  - `eventColumns.js`, `pesagens.js`, `eventRows.js`, `eventSource.js` e `reportSources/index.js`;
  - `reportDefinition.js`, `columnDefinition.js` (`groupOrder`), `groupEngine.js` (ordem das sessões);
  - `summaryLayout.js`, `aggregateLabels.js`, `reportLayout.js`, `printDocument.js` e `xlsxExporter.js`;
  - `electron/ipc/reportIpc.cjs`.
- **Tela:** `ReportView.jsx`, `ReportTable.jsx`, `reportUi.js`, `Relatorios.jsx`, `MakFilterPill.jsx`
  (contador) e `reports.css`.
- **Cadastro:** `registryDefinitions.js`, `normalize.js`, `CadastroAuxiliarPage.jsx`,
  `registryFormModel.js` e `auxiliary-registries.css`.
- **Configurações:** `appConfigService.js` e `Configuracoes.jsx`.
- **Gates ajustados:**
  - print-contract, pdf-contract e summary-export-parity;
  - summary-mode, sensitive-data e templates;
  - permissions, master-registry e registry-ui;
  - local-auth, shell-settings-ui e `lib/reportFixtures.mjs`.
- **Scripts do npm:** `package.json` (3 gates novos no test:quick e no test:full).
- **Docs:** CHANGELOG, `docs/user/{RELATORIOS,CADASTROS,BACKUP-E-RESTAURACAO}`,
  `docs/reporting/{EXPORT,REPORT-DEFINITION,COLUMN-DEFINITION,AGGREGATION}-CONTRACT` e `PERMISSIONS`,
  `docs/release/1.4.0/*` e o pacote `docs/plano-mestre` da E1B (1º commit).

**Commits (13):**
- `072543e` plano-mestre E1B
- `3d079f4` respostas 2 e 3
- `871bfcc` divisor da @
- `c68d3ed` cabeçalho da propriedade
- `8451db4` dados da folha
- `95ad0f1` a folha (tela, impressão e PDF)
- `62bc5fb` barra de filtros e tela
- `602808a` gates no test:quick
- `31310a0` Detalhado como folha
- `e89c4d7` docs
- `2e3d9c6` correções da revisão (relatórios)
- `8efb541` correções da revisão (cadastro)
- `ea7fa2a` docs da revisão
- mais o commit deste REPORT e das evidências

**Sem push. A main continua em `6cccb5f`.**

## 3. Gates

| Comando | Resultado |
|---|---|
| `npm run test:quick` (82 passos, rodados um a um) | **82/82 verdes**, depois das correções da revisão final |
| `npm run reports:document-layout:verify` (novo) | OK: célula × coluna por índice em todas as linhas; Σ das linhas = subtotal nas somáveis (média, mínimo, máximo, Qtd distinta e GMD nunca somados); TOTAL POR = motor sobre a população da seção; colunas vazias e o botão; GMD "—" e a nota N de M; 0 a 3 níveis e Detalhado como folha; retrato (6,8 pt) e paisagem (8,5 pt) cabem |
| `npm run reports:sheet-data:verify` (novo) | OK: 8 colunas novas; 17 métricas da folha; divisor 30/15 (recusa outro); faixa pelo `lote_id`; Machos/Fêmeas/com anterior; "Pesagem anterior"; 5 tipos de Pesagens; faixa só no lote (folha, CSV, XLSX, Detalhado); sessões por data; `matchView` com totais e colunas; `parseSortChoice`; filtro "Ativo" = "ATIVO" (mesma população) |
| `npm run registry:property-header:verify` (novo) | OK: campos, logo (400 px, 300 KB, qualidades JPEG 0,9 a 0,5, assinatura), CPF/CNPJ (inclusive o alfanumérico e o "CPF …" com prefixo), propriedade do cabeçalho (lista, igual a, sem acento, homônimas, "contém" não escolhe), backup → restore com bytes do logo idênticos |
| `npm run reports:print-contract:verify` / `reports:pdf-contract:verify` | OK: estrutura da folha, CSP `img-src data:`, escape, cabeçalho e rodapé, `@page`, `displayHeaderFooter: false`, `preferCSSPageSize: true` |
| `npm run reports:summary-export-parity:verify` | OK: mesmos números em folha, CSV, XLSX e JSON; a contagem de linhas (sem totais) nunca some |
| `npm run reports:templates:verify` | OK: incluído o último estado (por usuário, sem condição fixa, respeita o perfil) |
| `npm run docs:user:verify` / `release:version-contract:verify` | OK: 12 documentos, 1.4.0 |
| `npm run lint` (no test:quick) | 0 problemas |
| `npm run dist:unsigned` | OK (exit 0): build de produção, electron-builder sem assinatura, checksum, manifesto (`appVersion 1.4.0`, esquema 8, backup 3, `signed: false`), `diagnostic:packaged:source:verify`, `diagnostic:packaged:build:verify` e `diagnostic:e2e:verify` (artefatos do Setup 1.4.0). O manifesto diz `gitCommit: ea7fa2a-dirty` porque o REPORT e as evidências ainda não estavam commitados; o código empacotado é o de `ea7fa2a` |
| `release:current-only:verify` / `release:version-contract:verify` (depois do build) | OK: só o Setup 1.4.0 em `release-unsigned/`, manifesto 1.4.0 |

**Instalador 1.4.0 (E1 + E1B, sem assinatura, para o seu teste; nada publicado):**
- `C:\Users\maike\Desktop\projeto\MAKGESTAO-main\release-unsigned\Pesagens Individuais Setup 1.4.0.exe`
- tamanho 92.169.562 bytes, gerado em 25/09/2026 às 13:29, hora do computador (17:29 UTC)
- **SHA-256 `ee7c40b87faaf98d173a5bca0d496d056ffcd7ef1ee50f19b789f3456430a700`** (igual ao `.sha256` e ao
  manifesto). Ele substitui o instalador da E1
  (`d4d15aa0…`), que não chegou a ser distribuído.

**Fora do test:quick, já vermelhos antes da E1B:** `scripts/verify-dexie-backup.mjs:171` e
`verify-dexie-import-restore.mjs` ("seeds criados"). Eles esperam 7 categorias semeadas, e a semente
tem 12 desde uma versão anterior. Rodei os dois também na main `6cccb5f`, num worktree temporário, e
falham igual. Não mexi porque é fora do escopo; só entram no `test:full` (`storage:all:verify`).

## 4. Migração

- **Banco:** nenhuma. Esquema Dexie 8 e backup formato 3, sem pré-migração nem backfill.
- **Dados novos, todos opcionais e sem conversão:**
  - campos **não indexados** na `propriedades` (`titular_nome`, `endereco`, `documento`,
    `inscricao_estadual`, `mostrar_documento_no_cabecalho`, `telefone`, `logo`). Só existem depois que
    alguém preenche o cartão;
  - `appSettings` `report-settings:local`: o divisor da @; sem a chave vale 30;
  - `appSettings` `report-view-state:<empresa>:<usuário>`: o último jeito de ver cada relatório. Nunca
    guarda dados nem condição fixa, e não gera auditoria.
- **Backup e restauração:** tudo vai e volta inteiro. O gate `registry:property-header` faz backup →
  restore com o logo.
- **Rollback para a 1.3.2:**
  - os campos ficam guardados no registro. A 1.3.2 não os mostra e, se você editar a propriedade nela,
    não os apaga. Conferi no código da `v1.3.2`: a gravação só altera os campos que a versão conhece;
  - as chaves novas são ignoradas.
  - Detalhes em `docs/release/1.4.0/MIGRATION-1.3.0-TO-1.4.0.md` §3.1 e §6.

## 5. O que NÃO foi feito e por quê

- **Não fiz:** push, avanço da main, mudança de esquema, nem itens da E2/E3. Foi o que o prompt pediu.
- **Botão Proprietário:** fica para a **E3**. A coluna de dono do animal ainda não existe, e o botão
  aparece sozinho quando ela existir.
- **Teste físico (balança, impressora, curral): NÃO EXECUTADO.**
  - A folha foi conferida só em PDF gerado pelo Electron do projeto com as opções do app (12 páginas em
    retrato; o Detalhado em paisagem, 4 páginas).
  - Impressão numa impressora real: é o passo 8 do seu teste.
- **Teste no app instalado: NÃO EXECUTADO por mim.**
  - O `dist:unsigned` confere artefatos, conteúdo do pacote e manifesto.
  - O smoke que abre o executável (`D9_LAUNCH_PACKAGED`) usaria o seu perfil e o seu banco reais, por
    isso não rodei.
- **O bloco "TOTAL POR" nos arquivos (CSV/XLSX/JSON):** não entra. Os arquivos têm uma linha por grupo
  (apartação, data, lote) e o total geral, com os mesmos números da folha; o bloco é só da folha. Está
  documentado. Se quiser o bloco no Excel, é pergunta 9.
- **A folha do Detalhado na tela mostra até 2.000 linhas**, com nota avisando; a impressão e o PDF levam
  todas.
- **Sem máscara de CPF/CNPJ ao digitar** na ficha: guarda só os dígitos, e a folha e a pré-visualização
  formatam (pergunta 8).

## 6. Riscos e pendências

- **Instalador sem assinatura.** O Defender ou o SmartScreen podem avisar ou retirar o arquivo da pasta.
- **"Página X de Y"** usa as margens do `@page` do Chromium do Electron 35. Funcionou no PDF. O driver de
  uma impressora real não foi testado.
- **Logo:** um logo grande é reduzido para 400 px. Um JPG pode perder nitidez (qualidade de 0,9 até 0,5
  para caber em 300 KB). Confira na pré-visualização.
- **Cabeçalho em Pesagens usa sempre a propriedade Padrão.** Os eventos de pesagem não têm a coluna
  propriedade; só o Rebanho tem esse filtro. Veja a pergunta 7.
- **Defeito antigo, não é da E1B:** no tema escuro, o texto digitado nas fichas de Cadastros fica
  escuro sobre fundo escuro. Vale para todos os campos, inclusive os antigos. Não mexi e deixei
  sugerida uma tarefa separada.
- **Gates antigos vermelhos fora do test:quick:** os dois da seção 3.
- **As capturas vêm do harness de dev**, com o mesmo código da versão instalada. Elas não substituem o
  seu teste.

## 7. Como a responsável testa (no app instalado — o teste único de E1 + E1B)

1. **Antes de instalar:** na 1.3.2, use **Backup e Manutenção › Criar backup completo** e guarde o
   arquivo fora do computador.
2. **Instalar:** feche o programa e rode `Pesagens Individuais Setup 1.4.0.exe` (caminho e SHA-256 na
   seção 3). A barra deve mostrar **v1.4.0**.
3. **Cabeçalho da propriedade:** em **Cadastros › Propriedades**, abra a propriedade padrão e preencha
   **Cabeçalho dos relatórios**. **Escolha logo** (PNG ou JPG). Confira a pré-visualização e salve.
4. **A folha de Pesagens:** em **Relatórios › Pesagens**, escolha um período com pesagens, **Tipo "Por
   apartação (resumo por data)"** e **Orientação Paisagem**. Confira:
   - logo e dados no alto;
   - colunas alinhadas;
   - Faixa exigida na linha do lote;
   - GMD "—" onde não há pesagem anterior;
   - **TOTAL POR LOTE** e **TOTAL GERAL**.
5. **Clique numa apartação da folha:** abre o Detalhado só dela. Use **Ver como folha** e o **x** do selo
   para voltar.
6. **PDF** da mesma folha em **Retrato**: confira o rodapé com "Página X de Y".
7. **Imprimir:** mande a folha para uma impressora de verdade. É o teste físico.
8. **Divisor da @:** em Configurações › Relatórios, troque para 15 e veja Média (@) dobrar e o rodapé
   dizer "@ = peso vivo ÷ 15". Depois volte para 30.
9. **Rebanho atual:** o botão **Status (1)** deve vir com "Ativo" marcado. Troque o **Tipo de relatório**
   e os botões de filtro; saia e volte: o relatório deve reabrir como você deixou.
10. **Itens da E1:**
    - Relação de Pesagens › Ações em lote › **Data, apartação e lote** abre sem erro;
    - Backup e Manutenção › aba **Controle** mostra os 4 relatórios;
    - **Verificar integridade** diz "Banco íntegro.", com as contagens iguais às de antes.

## 8. Perguntas para a responsável

1. **Colunas vazias:** segui a especificação: a coluna some quando não tem valor **no relatório inteiro**.
   O prompt de design sugeria sumir por seção. Isso deixaria tabelas com colunas diferentes na mesma
   folha, e por isso não fiz. Confirma?
2. **Subtotal:** saiu como **linha alinhada sob as colunas**, em negrito. O print de referência usava uma
   linha de texto ("Peso Médio: … Peso Total: …"). Confirma a linha alinhada?
3. **Unidades:** ficaram no **cabeçalho da coluna** ("Peso médio (kg)"), e não em cada célula ("286,9 kg"
   como no print). Isso dá mais espaço e alinha melhor. Confirma?
4. **Contagem zero** em Machos/Fêmeas aparece "—", e a coluna só com zeros some. Exemplo: Fêmeas num lote
   só de machos. Confirma?
5. **Faixa exigida** vem do **cadastro atual** do lote, não da faixa no dia da pesagem, porque esse
   histórico não existe. Confirma?
6. **"Com pesagem anterior"** conta só as pesagens que dão ganho e GMD; Cadastro e Saída ficam de fora.
   A **Qtd** conta cabeças distintas, inclusive uma saída por morte sem peso (ela entra na Qtd, mas não
   no peso). Confirma as duas regras?
7. **Mais de uma propriedade:** o cabeçalho de **Pesagens** usa sempre a propriedade **Padrão**, porque
   as pesagens não têm a coluna propriedade. Você pesa em mais de uma fazenda e precisa do cabeçalho (ou
   de um filtro) por propriedade em Pesagens? Se sim, é trabalho para a E3.
8. **CPF/CNPJ na ficha:** hoje guarda e mostra só os dígitos; a folha formata. Quer **máscara ao
   digitar**?
9. **Excel com o bloco TOTAL POR:** quer esse bloco também no XLSX/CSV? Hoje os arquivos têm uma linha
   por grupo e o total geral, com os mesmos números.
10. **Configurações › Relatórios:** pelo menu, só o **ADMIN** chega em Configurações (`settings.manage`),
    embora o GESTOR tenha `settings.operational`. Na prática, o divisor da @ fica com o ADMIN. Libera
    para o GESTOR?
11. **Título:** saiu "Relatório de **Pesagens** (Sintético)", com o nome do relatório. O print dizia
    "Relatório de Pesagens **Individuais** (Sintético)". Prefere com "Individuais"?
