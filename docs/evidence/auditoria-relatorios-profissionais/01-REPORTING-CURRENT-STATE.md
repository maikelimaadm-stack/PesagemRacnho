# 01 — Estado atual de relatórios

Busca em `src/`, `scripts/`, `electron/` e `docs/` por report, relatorio, resumo, subtotal, total, agrup, group,
aggregate, sum/avg/min/max/count, unique/distinct, export, CSV, JSON, PDF, XLSX, manifest, sha256, print, imprimir,
`window.print`, `Blob`, download. Código lido na árvore de trabalho de 16/09/2026.

## 1. Conclusão em uma linha

**Não existe módulo, serviço, rota nem tela de relatórios.** Existem resumos embutidos em telas, dois painéis
analíticos (Fechamento do Dia e Ficha do Animal) e **cinco exportações CSV com regras diferentes**. Não há PDF, XLSX,
impressão nem biblioteca para isso.

## 2. Serviços e bibliotecas

| Item | Existe? | Evidência |
|---|---|---|
| `reportExportService` ou serviço de relatório | **Não** | nenhuma ocorrência |
| “relatório” no código | só relatório de migração/backfill | `v7Backfill.js:495`; `maintenanceDataAdapter.js:177-183`; `ManutencaoSistema.jsx:358,461-481` |
| Biblioteca PDF/XLSX/CSV/gráfico | **Não** | `package.json` (dependências: radix, react-query, date-fns, dexie, lucide, react-router, sonner, tailwind) |
| `window.print`, `printToPDF`, `@media print` | **Não** | nenhuma ocorrência em `src/` e `electron/` |
| Gráfico | SVG manual (curva de peso) | `FichaAnimal.jsx:94-107`; `weightPreview.js:6-30` |
| `weighing.summary` / `getSummary` (soma/média/min/max de `peso_kg > 0`) | existe, **não usado por nenhuma tela** | `storage/indexedDb/repositories/index.js:94-105`; `weighingService.js:221-231` |

## 3. Inventário de resumos, painéis e exportações

| Tela / componente | Conteúdo | Evidência |
|---|---|---|
| Relação — rodapé | Selecionados, Listados, Filtrados, Totais, Animais únicos, Animais ativos, Peso atual estimado, Média da última pesagem | `PesagensIndividuais.jsx:356-387,1180-1187` |
| Relação — coluna `doc_qtd` “Qtd Doc (Dia)” | contagem de pesagens por documento em **todas as datas** (rótulo enganoso) | `PesagensIndividuais.jsx:95,290-298` |
| Relação — CSV, modelo CSV, importação CSV | ver `13-EXPORT-AUDIT.md` | `PesagensIndividuais.jsx:754-801,920-925` |
| Lançamento — rodapé `PesagensResumoRodape` | lançamentos do dia, Total Machos/Fêmeas (**lançamentos**), peso médio, chips por marca; no Abate totais por documento/embarque | `PesagensResumoRodape.jsx:9-92`; `LancamentoPesagensIndividuais.jsx:680-720` |
| Lançamento — painel lateral | Apartação (`ResumoLotes`), Venda (`ResumoVendaDia`), Abate (`ResumoEmbarque`), Personalizado (`ResumoPersonalizado`) | `LancamentoPesagensIndividuais.jsx:1385-1395,2269-2298` |
| `ResumoPersonalizado` + `ConfigurarResumosDialog` | métricas configuráveis (campo × operação × escopo × agrupamento de 1 nível), salvas em `resumo-personalizado:<empresaId>` | `ResumoPersonalizado.jsx:7-44`; `ConfigurarResumosDialog.jsx:11-35` |
| `FechamentoDia` | KPIs do dia, pendências, conferência por lote e por marca, peso total, @ estimadas, fechar/reabrir sessão, CSV e JSON “backup do dia” | `FechamentoDia.jsx:65-195` |
| `FichaAnimal` | peso atual, ganho total, GMD médio (primeiro→último), GMD da última, @ (50% fixo), curva, linha do tempo, CSV | `FichaAnimal.jsx:26-161` |
| Manutenção | backup completo JSON com manifesto e SHA-256, exportar pesagens CSV/JSON pelo IPC, contagens por store, integridade | `ManutencaoSistema.jsx:133-159,343,461-481,545-548`; `health.js:145-158` |

### FechamentoDia (candidato natural a relatório operacional)
- População: pesagens com `data_pesagem === date` e, opcionalmente, a apartação (`:65-70`); **não filtra por empresa**.
- KPIs: lançamentos; animais únicos (`animal_id || NUM::MARCA`); peso médio **dividido por lançamentos** com legenda
  “kg por animal”; GMD médio simples (vazio mostra `0,000`); lotes movimentados; pendências (`:77-91,142-149`).
- Fechar/Reabrir grava só `status/operador/fim/justificativas` na sessão (`operationalInsightsService.js:16-42`) —
  **não congela os números**.
- Texto “Backup do dia gerado e validado” (`:126`) não corresponde a validação nem hash.

### FichaAnimal
- Agrupa todas as pesagens por animal (`:26-54`). O filtro de período (90 dias/6 meses/tudo) afeta **só o gráfico**,
  não os KPIs (`:82-92`). Arroba com rendimento **50% fixo** (`:142`).

## 4. Divergências `04-RELATORIOS-E-INDICADORES.md` × código

| Promessa do doc 04 | Estado real |
|---|---|
| §1 todo relatório declara período, população, filtros, fórmula/versão, emissão, usuário, drill-down, exportação igual à tela | **não existe** |
| §3 GMD ponderado Σganho/Σdias e distinção simples × ponderado | **não existe** (só `ratio` manual não emparelhado) |
| §3 “não converter nulo em zero” / “não apresentar valor para população não elegível” | **violado** em `ResumoPersonalizado.jsx:21-22` e ~15 pontos com `||0` |
| §3 lotação atual por permanência aberta | **não**: ocupações contam pesagens |
| REP-001 Fechamento da sessão | parcial (`FechamentoDia`), sem congelamento |
| REP-003 Pendências | parcial (GMD<0, sem lote, sem documento) |
| REP-101 Histórico individual | parcial (`FichaAnimal`) |
| REP-201 Inventário por lote | parcial fraco (contagem de pesagens) |
| REP-302 Resultado de venda | parcial (`ResumoVendaDia`, estimado e informado misturados) |
| REP-401 Romaneio (PDF/XLSX/impressão) | **não existe** |
| REP-402 Conciliação de embarque | parcial (Previsto × Embarcado × Falta) |
| REP-501/502/503 Auditoria, integridade, backup | só integridade e histórico de backup |
| §10 Painel inicial | **não existe** (`mainPage` = Relação) |
| §12 PDF / XLSX / manifesto em toda exportação | **não existem** (manifesto só no backup completo) |
| §13 valores exportados numéricos | **violado** (`fmtNum` com milhar, `R$` em CSV) |

Divergências de `F0-02-CATALOGO-DE-FORMULAS.md` estão em `05-AGGREGATION-ENGINE-AUDIT.md` §5.

## 5. O que existe e interessa ao módulo

- Domínio puro e testado: `calculateWeightGain` (`weighingCalculations.js`), `recalculateWeightSeries`
  (`weighingSeries.js`), `calculateCarcassTrade` (`commercialCalculations.js`), `suggestCategory`/`eraOfCategory`
  (`categorySuggestion.js`), avisos (`weighingWarnings.js`).
- Motor de filtros de coluna `matchesMakColumnFilter` (ver `04`).
- Rastreabilidade: manifesto + SHA-256 do backup (`backupService.js:55-81`), `app:writeUserFile` com SHA-256
  (`electron/main.cjs:118-139`), `src/lib/sha256.js`.
- Referência externa: o ModeloBase1 original (`PROJETOMG-main/src/framework/cadastro/exports/`) tem impressão de
  tabela A4 paisagem (`tableExportUtils.jsx:21,49-55`) e **gerador XLSX sem dependência** (OOXML + zip escritos à mão,
  `xlsxExportUtils.jsx:47-148`). Ver `13`.
