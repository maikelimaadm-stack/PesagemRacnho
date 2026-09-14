# Fase 0 — Gates: baseline individual e correção

**Data:** 14/09/2026 · **Branch:** `program/2.0` (a partir de `v1.1.17-baseline`) · **Aplicação:** 1.1.17 · **Dexie:** v6

## 1. Baseline individual (antes de qualquer correção)

Cada script executado isoladamente (`npm.cmd run <gate>`), em sequência, na árvore da tag `v1.1.17-baseline`.

| Gate | Exit | s | Situação |
|---|---|---|---|
| lint | 0 | 11 | verde |
| build | 0 | 22 | verde (`vite build`) |
| release:current-only:verify | 0 | 1 | verde |
| runtime:legacy:verify | 0 | 1 | verde |
| ui:locale-dialog:verify | 0 | 1 | verde |
| **ui:operational-customization:verify** | **1** | 1 | **vermelho** — `AssertionError: venda e abate devem abrir cadastro em diálogo` (esperava `GerenciarSaidasDialog` no Lançamento; o código já não o usa) |
| animal:history-integrity:verify | 0 | 2 | verde |
| import:selection:verify | 0 | 1 | verde |
| ui:scrollbar-contract:verify | 0 | 1 | verde |
| **ui:consistency:verify** | **1** | 1 | **vermelho** — `AssertionError: alternância Registro/Tabela reutiliza a estrutura segmentada oficial` (regex exigia template literal `className={\`view-seg aux-view-seg` e rótulos literais; o código usa `className="view-seg aux-view-seg"` e rótulos gerados de `VIEW_MODES`) |
| weighing:calculations:verify | 0 | 1 | verde |
| perf:contract:verify | 0 | 2 | verde |
| enterprise:hardening:verify | 0 | 2 | verde |
| main:boot:verify | 0 | 2 | verde |
| preload:contract:verify | 0 | 1 | verde |
| storage:dexie:verify | 0 | 1 | verde |
| storage:first-run:verify | 0 | 2 | verde |
| storage:ui-first-run-persistence:verify | 0 | 1 | verde |
| storage:maintenance-ui-flow:verify | 0 | 1 | verde |
| storage:legacy-detached:verify | 0 | 2 | verde |
| desktop:smoke:verify | 0 | 1 | verde |
| storage:backup:verify | 0 | 2 | verde |
| storage:import-restore:verify | 0 | 1 | verde |
| storage:ui-contract:verify | 0 | 2 | verde |
| weighing:mapper:verify | 0 | 1 | verde |
| maintenance:ui:verify | 0 | 1 | verde |
| maintenance:dialog:verify | 0 | 2 | verde |
| docs:user:verify | 0 | 1 | verde |

Resultado: 26 verdes, 2 vermelhos (os dois já conhecidos, introduzidos pelo trabalho paralelo de 14/09). Gates não executados individualmente: `e2e:installed:verify` (exige pacote instalado) e `packaged:*` (exigem release).

## 2. Correções (commit `8c79022`)

Regra aplicada: o gate valida o **contrato real** do código, nunca é ajustado apenas para passar.

### ui:operational-customization

- Antes: exigia `GerenciarSaidasDialog` no Lançamento e testava a persistência da chave legada `perfis-saida`.
- Depois: afirma que o popup legado **não** está no Lançamento; que compradores, vendedores e frigoríficos são carregados do registry (`loadRegistryGroup('comerciais'`) e **selecionados** (`auxiliaryCatalogs.* → <SelectItem>`), não digitados; e que o registry (`cadastros-auxiliares:comerciais:<empresa>`) persiste após reabrir o banco. As demais asserções (resumos configuráveis, operações do resumo, foco suave, tabela gerencial) permanecem.
- Observação: `registryService.js` usa o alias `@/` e não é importável em Node; o gate grava a mesma chave/shape pelo `settingsService`.
- Este gate será substituído por `launch:contract:verify` na Fase 2 (Lançamento enxuto), conforme ADR-031/ADR-034.

### ui:consistency

- Antes: uma única regex acoplada à sintaxe (`className={\`…`, rótulos literais).
- Depois: quatro asserções estruturais — `.view-seg aux-view-seg` com `role="group"` e `aria-label="Modo de visualização"`; slider `view-seg-slider aux-view-seg__slider`; `VIEW_MODES` declara `registro` e `tabela`; cada modo expõe `aria-label={\`Visualizar ${view.title…`.

## 3. Resultado após a correção

`npm.cmd run test:quick` → **exit 0**, 20/20 verificações verdes:

```
lint · release:current-only · runtime:legacy · ui:locale-dialog · ui:operational-customization ·
animal:history-integrity · import:selection · ui:scrollbar-contract · ui:consistency ·
weighing:calculations · perf:contract · enterprise:hardening · main:boot · preload:contract ·
storage:dexie · storage:first-run · storage:ui-first-run-persistence · storage:maintenance-ui-flow ·
storage:legacy-detached · desktop:smoke
```

Log integral: `phase0-gates.log` e `phase0-testquick.log` (scratch da sessão); o resumo acima é a evidência permanente.
