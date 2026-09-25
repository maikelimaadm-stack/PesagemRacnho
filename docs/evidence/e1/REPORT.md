# REPORT — E1 Relatórios resumidos + catálogo enxuto

**ETAPA:** E1 · **VERSÃO:** 1.4.0 (esquema Dexie 8 e backup formato 3, sem mudança) · **BRANCH:**
`program/e1-relatorios` (a partir de main `6cccb5f`) · **DATA:** 25/09/2026

**STATUS: CONCLUÍDA** — gates verdes, instalador sem assinatura gerado. Faltam o teste da responsável
no app instalado e a autorização para avançar main (perguntas 1–4 no fim).

---

## 1. O que foi feito

1. **Modo Resumido no domínio.** Relatório agrupado abre com uma linha por grupo e as métricas em
   colunas (Cabeças, Peso médio, GMD…). Cada grupo é recalculado sobre a sua própria população, e o
   Total geral sobre a população inteira: nunca é a soma das linhas. O layout é um só
   (`summaryLayout.js`) e alimenta tela, CSV, XLSX, JSON e impressão A4. A ordem dos grupos pode
   seguir uma métrica, sempre entre irmãos. Clicar no grupo abre o Detalhado com um recorte exato pela
   chave do grupo, inclusive para "Não informado".
2. **Tela.**
   - `ReportSummaryTable` segue o ModeloBase1 (`emp-table-pro`).
   - Segmento **Resumido | Detalhado**.
   - **Agrupar por** rápido, que sempre inclui o agrupamento padrão do relatório.
   - **Filtros rápidos**: "Sem pesagem há mais de 30 dias", "Somente entradas e saídas", "Somente
     perdendo peso", "Somente mudanças de lote no período" e "Somente mortes".
   - Selo "Detalhe: …" com volta ao Resumido.
   - Modelos guardam o modo e a ordem dos grupos.
   - As ações secundárias viraram ícones e a barra quebra linha em vez de cobrir a faixa de filtros.
3. **Catálogo de 51 para 12 relatórios.** Os 33 relatórios antigos viraram visões
   (`LEGACY_REPORT_ALIASES`), e o id antigo abre o relatório novo com a mesma seleção. O gate prova
   isso relatório a relatório: linhas, árvore, totais e modo iguais.
   - Favoritos, recentes e modelos são convertidos na primeira abertura de Relatórios. A conversão
     roda em tempo de execução, é idempotente, é auditada ("Relatório consolidado: … → …") e não muda
     o esquema.
   - Os 4 relatórios de controle foram para **Backup e Manutenção › aba Controle**.
   - `cadastros.*` e os bloqueados ficaram ocultos. Nada foi apagado: são 33 definições mais 33 visões.
4. **`docs/user/RELATORIOS.md` reescrito** em linguagem simples: Resumido, Agrupar por, clique no
   grupo, filtros rápidos, os 12 relatórios, onde foram parar os antigos e a aba Controle.
5. **CHANGELOG `[1.4.0] — 2026-09-25`.** Inclui:
   - **05e6d33**: a Relação quebrava ao abrir o diálogo "Data, apartação e lote", defeito do
     instalador 1.3.2;
   - **70f43c6**: a importação ganhou trava contra clique duplo;
   - a sobreposição dos cartões da Manutenção em 1440×900 (defeito anterior à E1, visto na medição);
   - as correções da revisão.

   Também foram criados `docs/release/1.4.0/` (notas, checklist, migração) e atualizados
   INSTALACAO-WINDOWS e TESTE-MAQUINA-LIMPA.
6. **Versão 1.4.0** em package.json, lock e appVersion. Contrato de versão verde, test:quick 79/79,
   build e instalador sem assinatura (seção 3). Os artefatos 1.3.2 foram **movidos** para
   `release-archive/1.3.2/` (nada apagado).
7. **Revisão adversarial.** 4 lentes (domínio, exportação, interface, compatibilidade) e 18 agentes. Os
   **14 achados verificados foram confirmados**, nenhum refutado. Todos corrigidos no commit `25f62fc`,
   exceto os que viraram perguntas. Os principais:
   - **(alta)** Um modelo antigo que filtrava a mesma coluna da condição do relatório antigo
     (ex.: "Só saídas" em "Entradas e saídas") perdia o próprio filtro na conversão e passava a mostrar
     mais animais, e isso ficava gravado. Agora as duas regras valem, como na 1.3.x: a condição antiga
     vai para `fixedFilters` e aparece com cadeado.
   - **(média)** Impressão do Resumido: os cabeçalhos se sobrepunham e textos eram cortados com "…".
     Agora a largura vem do conteúdo, o cabeçalho quebra entre palavras e nada é cortado.
   - **(média)** Rótulos de grupo crus ("2026-08-01", "true"). Agora dd/mm/aaaa e Sim/Não.
   - **(média)** Modelos, favoritos e recentes dos relatórios que foram para a aba Controle ficavam
     inalcançáveis. Agora aparecem em Relatórios para abrir ou excluir; na aba Controle não há
     "Salvar modelo" nem estrela.
   - **(baixa, antes média)**:
     - auditoria da conversão triplicada: agora uma por item;
     - filtro rápido aparecia desligado mesmo aplicado;
     - CSV deixava passar "-1+1" como fórmula (a importação foi espelhada);
     - dois modelos com o mesmo nome colidiam: o segundo ganha a visão antiga entre parênteses.
   - Outros ajustes baixos:
     - modelo sem totais ganhava totais;
     - recente duplicado;
     - média de coluna inteira arredondada (34 em vez de 33,5);
     - `presetId` não chegava ao manifesto;
     - CSV do Resumido sem o caminho do grupo (nova coluna `grupo`);
     - rótulos de métrica: "Carcaça média", "Amplitude do peso", "Frete compra (R$)", "Saídas" ×
       "Cabeças" no romaneio;
     - "Situação" saiu do Agrupar por rápido do Rebanho atual, que abre só com ativos;
     - voltar da aba Controle não remonta mais a Manutenção;
     - `aria-controls` quebrado na aba Sistema;
     - a asserção "Usuários só ADMIN" voltou ao gate, também por link;
     - docs de contrato (PERMISSIONS, REPORT-DEFINITION-CONTRACT).

**Como as capturas foram feitas.** Usei um harness de desenvolvimento (`.tmp/e1-harness`, ignorado
pelo git) que monta o Layout, Relatórios e Manutenção reais. A sessão ADMIN é simulada, **sem digitar
senha em lugar nenhum**. A massa determinística é a "pequena" (100 animais e 300 pesagens, de jan/2025
a ago/2026). O perfil do Electron é isolado e nunca toca o banco da responsável.

## 2. Arquivos criados / alterados (60 arquivos, main..HEAD)

**Novos:**
- `src/modules/reporting/domain/summaryLayout.js`
- `src/modules/reporting/domain/aggregateLabels.js`
- `src/modules/reporting/definitions/legacyAliases.js`
- `src/components/reports/ReportSummaryTable.jsx`
- `src/components/reports/MaintenanceControlReports.jsx`
- `src/components/mak/MakSegTabs.jsx`: abas no padrão oficial do ModeloBase1 (`mg-panel-tabs-strip`
  → `seg-control`), com a mesma estrutura e as mesmas classes de SanidadeTabs; generaliza a marcação
  que já existia e não cria visual novo.
- `scripts/verify-reports-summary-mode.mjs`
- `scripts/verify-reports-summary-export-parity.mjs`
- `scripts/verify-reports-catalog-consolidation.mjs`
- `docs/release/1.4.0/{RELEASE-NOTES,RELEASE-CHECKLIST,MIGRATION-1.3.0-TO-1.4.0}.md`
- `docs/evidence/e1/*`

**Alterados:**
- **Domínio e serviço:** `reportDefinition.js`, `filterEngine.js`, `reportService.js`,
  `reportTemplateService.js`, `reportExportService.js`, `reportCatalog.js`, `rebanho.js`,
  `pesagens.js`, `desempenho.js`, `operacional.js`, `controle.js`, `controlColumns.js`,
  `controlSources.js`.
- **Exportadores:** `reportLayout.js`, `csvExporter.js`, `xlsxExporter.js`, `jsonExporter.js`,
  `printDocument.js`.
- **Importação:** `importFile.js`, com a regra do apóstrofo espelhada.
- **Tela:** `ReportView.jsx`, `ReportCatalog.jsx`, `reportUi.js`, `Relatorios.jsx`,
  `ManutencaoSistema.jsx`, `reports.css`, `page-scroll.css`.
- **Gates existentes ajustados:** catalog, templates, print-contract, json-manifest, xlsx-parity,
  permissions, sensitive-data, definitions, grain.
- **Versão:** `package.json` (3 gates novos em test:quick e test:full), `package-lock.json`,
  `appVersion.js`.
- **Docs:** `CHANGELOG.md`, `docs/user/{RELATORIOS,INSTALACAO-WINDOWS,TESTE-MAQUINA-LIMPA}.md`,
  `docs/reporting/{REPORT-CATALOG,EXPORT-CONTRACT,PERMISSIONS,REPORT-DEFINITION-CONTRACT}.md`,
  `docs/plano-mestre/prompts/PROMPT-01/03` (primeiro commit, como pedido).

**Commits:**
- `9fee918` PROMPT-01/03
- `fada2b8` domínio + gates
- `6232ef1` tela
- `5d32fba` docs de relatórios
- `5c85b26` versão 1.4.0
- `25f62fc` correções da revisão
- `9e67161` docs da revisão
- mais o commit deste REPORT e das evidências

**Sem push. main continua em `6cccb5f`.**

## 3. Gates

| Comando | Resultado |
|---|---|
| `npm run test:quick` (79 passos, rodados um a um) | **79/79 verdes** (depois das correções da revisão) |
| `npx eslint src --quiet` | 0 problemas |
| `npm run reports:summary-mode:verify` (novo) | OK: 39 relatórios/visões agrupados, 95 nós; casos à mão (Rebanho por lote; Desempenho GMD 45/40, 30/31, 75/71); detalhe; ordem; modos padrão |
| `npm run reports:summary-export-parity:verify` (novo) | OK: 8 casos (1–3 níveis, ordem por métrica, ausentes, sem agregação) × CSV/XLSX/impressão/JSON; mais data/sim-não, média fracionária, proteção contra fórmula com ida e volta da importação, impressão sem reticências |
| `npm run reports:catalog-consolidation:verify` (novo) | OK: 12 ids exatos; 33 visões equivalentes; comportamento antigo; migração (8 auditorias); idempotente; aceite 6 ("Nelore", "Não informado"); casos da revisão (filtro + condição, sem totais, nomes repetidos, leituras simultâneas = 1 auditoria por item, id antigo + filtros, comparação por código) |
| `npm run release:version-contract:verify` | OK: 1.4.0 em package/lock/appVersion, notas/checklist, CHANGELOG datado sem "Não lançado", manifesto release-unsigned |
| `npm run docs:user:verify` | OK: 12 documentos, inclusive MIGRATION-1.3.0-TO-1.4.0 |
| `npm run dist:unsigned` | OK (exit 0): build de produção, electron-builder sem assinatura, checksum, manifesto (`appVersion 1.4.0`, `signed: false`), `diagnostic:packaged:source:verify`, `diagnostic:packaged:build:verify` (marcadores de UI/dados no pacote, manifesto confere) e `diagnostic:e2e:verify` (artefatos do Setup 1.4.0) |
| `release:current-only:verify` / `release:version-contract:verify` (depois do build) | OK: só o Setup 1.4.0 em `release-unsigned/`, manifesto 1.4.0 |

**Instalador 1.4.0 (sem assinatura, para teste; nada publicado):**
- `C:\Users\maike\Desktop\projeto\MAKGESTAO-main\release-unsigned\Pesagens Individuais Setup 1.4.0.exe`
- tamanho 92.154.468 bytes
- **SHA-256 `d4d15aa0e477c716772c88450346804bda315d8941a7fb0b16cd828290897893`** (igual ao `.sha256` e ao
  manifesto)

## 4. Migração

- **Banco:** nenhuma. O esquema Dexie continua 8 e o backup continua no formato 3; não há
  pré-migração nem backfill.
- **Preferências de relatório:** a conversão é feita em tempo de execução, quando cada pessoa abre
  Relatórios.
  - Os ids antigos passam para o relatório novo; favoritos ficam como `novo#antigo`.
  - Os modelos guardam `migratedFrom`, e `fixedFilters` quando o modelo filtrava a coluna da condição
    antiga.
  - Nomes repetidos ganham `renamedFrom`.
  - A conversão é idempotente, gera uma auditoria por item (`origem = relatorios-consolidacao-1.4.0`) e
    nada é apagado.
  - Rollback para a 1.3.2: os dados abrem normalmente. Os modelos e favoritos já convertidos ficam
    **escondidos** na 1.3.2 (não somem) e voltam ao reinstalar a 1.4.0. Detalhes em
    `docs/release/1.4.0/MIGRATION-1.3.0-TO-1.4.0.md`.

## 5. O que NÃO foi feito e por quê

- **Não fiz:** push; avançar main; mudar o esquema; relatórios de outras etapas. Foi o que o prompt
  pediu.
- **Teste físico (balança, impressora, curral): NÃO EXECUTADO.** Não houve mudança nessas partes. A
  impressão A4 foi conferida só em PDF gerado pelo próprio app (`desempenho-resumido-a4.pdf`: 1
  página, retrato, 7 colunas, 6 grupos).
- **Teste no app instalado: NÃO EXECUTADO por mim.** O `dist:unsigned` confere os artefatos e o
  conteúdo do pacote (app.asar, marcadores, manifesto, SHA-256). **O executável empacotado não foi
  aberto:** o smoke launch opcional (`D9_LAUNCH_PACKAGED=1`) abre o app com o perfil real do Windows,
  ou seja, com o banco da responsável, e por isso não rodei. O teste instalado é da responsável
  (seção 7).
- **XLSX do Resumido com o caminho do grupo:** o CSV ganhou a coluna `grupo`; o XLSX continua com o
  rótulo só na coluna do próprio nível (achado baixo). Fica para uma próxima versão, se for útil.
- **Mudanças que dependem de decisão** (perguntas 2 a 4) não foram feitas.

## 6. Riscos e pendências

- **OPERADOR e CONSULTA não abrem mais "Pendências de pesagem" nem "Qualidade dos dados".** A
  especificação manda esses relatórios para a Manutenção, e a Manutenção exige `maintenance.backup`
  (pergunta 2).
- **Instalador sem assinatura.** O Defender/SmartScreen pode avisar ou retirar o arquivo da pasta.
- **A conversão de preferências grava no banco real** na primeira abertura de Relatórios. Mitigação:
  um backup completo antes de instalar (checklist, passo 2).
- As capturas vêm do harness de dev, com a mesma tela e o mesmo código da versão instalada. Elas não
  substituem o teste no app instalado.

## 7. Como a responsável testa (no app instalado)

1. Na 1.3.2: **Backup e Manutenção › Criar backup completo** e guarde o arquivo fora do computador.
   Se tiver favoritos antigos (ex.: "Rebanho por raça") ou modelos salvos, anote quais são.
2. Feche o programa e rode `Pesagens Individuais Setup 1.4.0.exe` (caminho e SHA-256 na seção 3). A
   barra superior deve mostrar **v1.4.0**.
3. **Relatórios:** devem aparecer 12 cartões. Os favoritos antigos aparecem com o nome de antes e a
   marca "Visão salva de antes da 1.4.0".
4. **Rebanho atual:** abre resumido por lote. Clique num lote: aparecem só os animais dele e o selo
   "Detalhe"; o **x** volta ao resumo. Troque **Agrupar por** para Categoria.
5. **Desempenho:** escolha "Últimos 365 dias" e depois **Imprimir**. Deve sair 1 página A4 em pé,
   igual à tela, sem texto cortado.
6. **Exportar › XLSX** do Rebanho atual e abra no Excel: a mesma tabela resumida, com números de
   verdade.
7. Abra um **modelo salvo antigo**: deve mostrar os mesmos animais de antes (compare com o que você
   anotou).
8. **Relação de Pesagens › Ações em lote › Data, apartação e lote:** deve abrir sem erro (correção do
   1.3.2).
9. **Backup e Manutenção › aba Controle:** os 4 relatórios abrem, e o botão **Manutenção** volta.
10. **Verificar integridade:** deve dar "Banco íntegro.", com as contagens iguais às de antes.

## 8. Perguntas para a responsável

1. **main:** autoriza o fast-forward de main para `program/e1-relatorios`
   (`git merge --ff-only`, sem push) depois do seu teste?
2. **OPERADOR/CONSULTA e a aba Controle.** A E1 manda "Pendências de pesagem" e "Qualidade dos dados"
   para a Manutenção, que só ADMIN/GESTOR abrem (`maintenance.backup`). Na 1.3.2, OPERADOR e CONSULTA
   abriam os dois pela tela de Relatórios. Não improvisei. Opções:
   - (a) manter assim;
   - (b) **(recomendo)** para quem não pode abrir a Manutenção, mostrar esses dois em Relatórios, numa
     família "Controle", ficando ADMIN/GESTOR com os 12 do jeito que está;
   - (c) liberar só a aba Controle da Manutenção para quem tem `reports.read`.
3. **Modelo antigo sem modo, salvo sem agrupamento.** A E1 §7 diz que modelo antigo sem `mode` abre no
   modo padrão do relatório. Segui isso. Mas em relatórios que nascem resumidos (Romaneio, Ocupação),
   um modelo antigo salvo **como lista** abre num Resumido só com o Total geral (um clique em
   "Detalhado" mostra a lista). Recomendo: sem modo, abrir Resumido **só se o modelo tiver
   agrupamento**, que é a mesma regra usada na conversão dos 33 antigos. Autoriza?
4. **"Dias sem pesagem ≥ N" × "> N".** A tabela da E1 diz "≥ N", mas o relatório antigo "Animais sem
   pesagem recente" usava **"> N"** (mais de N dias), e o gate prova a equivalência com o antigo.
   Mantive "> N" e o botão diz "Sem pesagem há mais de 30 dias". Confirma?
