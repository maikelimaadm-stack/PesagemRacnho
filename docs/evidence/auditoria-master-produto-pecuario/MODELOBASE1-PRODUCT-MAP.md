# MODELOBASE1-PRODUCT-MAP — Aderência ao contrato visual ModeloBase1

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Contrato disponível no código

| Peça | Arquivo | Origem |
|---|---|---|
| Estilos base | `src/styles/modelobase1/*.css` (`mg-layout.css` etc.) | copiados do PROJETOMG-main |
| Composição do app | `src/styles/d17b-modelobase1.css` (blocos até `D.17D.2R34`) | específico do Pesagens |
| Tela Mãe (lista) | `MgFilterPanel`, `MgDesktopSearch`, `MgSearchResultsDropdown`, `MgSpeedDialMenu`, `MgTablePanelStrip`, `MakTh`, `MakColumnMenu`, `MakFilterRail/Pill`, `MakColumnConfigDialog`, `MakTableSelectCheck`, `MakDateControl` | `src/components/mak/` |
| Registro (formulário) | `FormCard`, `ModeloBase1ViewSeg`, `ModeloBase1PageContainer/Header/ActionBar` | `src/components/modelobase1/`, `CadastroAuxiliarPage.jsx` |
| Diálogos | `d17b-standard-dialog` (`--compact`, `--medium`, `--large`), `d17d-management-dialog` | CSS |
| Evidência de referência | `docs/evidence/modelobase1-referencia/` (01–08 png, `estrutura-dom.json`) | renderização do projeto base |
| Gate | `scripts/verify-ui-consistency.mjs` (R34 + asserções da sessão paralela) | uma asserção paralela em vermelho |

## 2. Mapa por tela

| Tela | Lista (Tela Mãe) | Registro | Diálogos | Escuro | Situação |
|---|---|---|---|---|---|
| Relação de pesagens | ✔ R34 | n/a | colunas, importação | ✔ | conforme |
| Cadastros auxiliares (comerciais, causas, sanidade) | ✔ R34 | ✔ FormCard | excluir | ✔ | conforme |
| Lançamento | barra `mg-action-bar` + grade v2 | formulário v2 | vários `d17b-standard-dialog` | ✔ | conforme no visual; **não** na estrutura (cadastros em popup) |
| Fechamento do dia | ✘ `op-toolbar`/`op-kpis`/`op-card` | n/a | — | parcial (`operational-insights.css`) | **fora do contrato** |
| Ficha do animal | ✘ `op-screen` | ✘ | — | parcial | **fora do contrato** |
| Manutenção | cartões `Card` (shadcn) | n/a | confirmação | ✔ | aceitável para administrativo; migrar quando houver fatia livre |
| Gerenciar Apartações/Lotes (popup) | tabela shadcn dentro de dialog | inline | — | ✔ | substituir por tela própria |
| Gerenciar Embarques/Documentos (popup) | idem | inline | — | ✔ | substituir por tela própria |
| Compradores/Vendas/Abates (popup legado) | idem | inline | — | ✔ | **remover** |

## 3. Telas novas previstas e o padrão a usar

| Tela | Padrão | Componente base |
|---|---|---|
| Marcas, Raças, Categorias, Causas de morte, Parceiros, Propriedades | Tela Mãe + registro | `CadastroAuxiliarPage` com adaptador de persistência para store (hoje só `appSettings`) |
| Faixas de identificadores | Tela Mãe + registro com painel de saldo | idem + faixa de resumo |
| Apartações e lotes | Tela Mãe com duas abas (apartações, lotes) | idem |
| Embarques | Tela Mãe + registro com documentos e animais | idem + tabela secundária |
| Operações comerciais (compra/venda/abate) | Tela Mãe + registro com itens | idem |
| Animais | Tela Mãe + registro (ficha) | idem |
| Fechamento (por sessão) | Tela Mãe com painel de pendências | Relação como referência |

`CadastroAuxiliarPage` precisa de uma **porta de persistência** (`loadGroup/saveGroup` hoje presos ao `registryService`) para servir stores Dexie. Isso é um requisito do plano, não desta auditoria.

## 4. Desvios a corrigir por prioridade

1. Cadastros em popup no Lançamento (estrutura).
2. Fechamento e Ficha fora do contrato (visual).
3. Popup legado de Compradores/Vendas/Abates (duplicidade).
4. Manutenção em cartões (baixa prioridade).

## 5. Regra para o plano

Nenhuma tela nova sem: barra de ações padrão, painel de filtros, pesquisa em pílula, faixa de pílulas, configuração de colunas, modo escuro e asserção no `verify-ui-consistency.mjs` (ADR-016).
