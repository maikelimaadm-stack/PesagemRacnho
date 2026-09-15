# S-00.0 — Baseline recovery: diagnóstico e correção dos dois gates vermelhos

**Marco:** 1.1.18 · **Data dos fatos:** 14/09/2026 · **Ponto de partida:** tag `v1.1.17-baseline`
(commit `77eeb3b`) · **Correção:** commit `8c79022` · **Evidência histórica referenciada:**
`docs/evidence/program-2.0/phase-00/GATES.md` e `docs/evidence/STATE-OF-REPO-BEFORE.md` §2.

## 1. Situação encontrada

Na tag `v1.1.17-baseline`, `npm run test:quick` falhava em dois gates; os outros 26 scripts
individuais (incluindo os que não entram em `test:quick`) estavam verdes. Tabela completa por gate,
com exit e tempo, em `program-2.0/phase-00/GATES.md` §1.

| Gate | Erro | Resultado |
|---|---|---|
| `ui:operational-customization:verify` | `AssertionError: venda e abate devem abrir cadastro em diálogo` | vermelho |
| `ui:consistency:verify` | `AssertionError: alternância Registro/Tabela reutiliza a estrutura segmentada oficial` | vermelho |

Ambos foram introduzidos pelo trabalho paralelo de 14/09 (Tela Mãe do ModeloBase1 e página
Cadastros Comerciais), que mudou o contrato das telas sem atualizar os testes.

## 2. Diagnóstico: a causa está no teste, não no código

### 2.1 `ui:operational-customization:verify`

O gate exigia `assert.match(launch, /GerenciarSaidasDialog/)` sobre
`src/pages/LancamentoPesagensIndividuais.jsx` e testava a persistência da chave legada
`perfis-saida`. O código do Lançamento, porém, já lia compradores, vendedores e frigoríficos do
registry (`loadRegistryGroup('comerciais')`) e os oferecia em `<SelectItem>`; o popup
`GerenciarSaidasDialog.jsx` continuava no repositório, mas órfão.

Prova, executada nesta worktree (comando git de leitura):

```text
$ git show v1.1.17-baseline:src/pages/LancamentoPesagensIndividuais.jsx | grep -c GerenciarSaidasDialog
0
```

Zero ocorrências na tag de baseline: o teste pedia um componente que a tela já não usava.
Documentado também em `docs/auditoria/AUDITORIA-ESTADO-2026-09-14.md` §3 e
`docs/evidence/auditoria-master-produto-pecuario/UX-FLOW-AUDIT.md`.

### 2.2 `ui:consistency:verify`

Uma única regex acoplada à sintaxe: exigia ``className={`view-seg aux-view-seg`` (template literal)
e os rótulos literais `aria-label="Visualizar registro"` / `"Visualizar tabela"`. O componente usa
`className="view-seg aux-view-seg"` (string simples) e gera os rótulos a partir de `VIEW_MODES`
(``aria-label={`Visualizar ${view.title…`}``). A estrutura oficial estava presente; o teste
verificava a forma, não o contrato.

## 3. Correção aplicada (commit `8c79022`, sem alterar código de produto)

```text
$ git show 8c79022 --stat
 scripts/verify-operational-customization.mjs | 29 +++++++++++++++++++++-------
 scripts/verify-ui-consistency.mjs            |  7 ++++++-
 2 files changed, 28 insertions(+), 8 deletions(-)
```

Regra aplicada: o gate valida o contrato **real** do código; nunca é afrouxado apenas para passar.

- `verify-operational-customization.mjs`: passa a afirmar que o popup legado **não** está no
  Lançamento (`assert.doesNotMatch(launch, /GerenciarSaidasDialog/)`); que compradores, vendedores
  e frigoríficos são carregados do registry (`loadRegistryGroup('comerciais'`) e **selecionados**
  (`auxiliaryCatalogs.* → <SelectItem>`), não digitados; e que o registry
  (`cadastros-auxiliares:comerciais:<empresa>`) persiste após reabrir o banco. As demais asserções
  (resumos configuráveis, operações do resumo, foco suave, tabela gerencial) permanecem. Como
  `registryService.js` usa o alias `@/` e não roda em Node, o gate grava a mesma chave/shape pelo
  `settingsService`.
- `verify-ui-consistency.mjs`: a regex única foi substituída por quatro asserções estruturais —
  `.view-seg aux-view-seg` com `role="group"` e `aria-label="Modo de visualização"`; slider
  `view-seg-slider aux-view-seg__slider`; `VIEW_MODES` declara `registro` e `tabela`; cada modo
  expõe ``aria-label={`Visualizar ${view.title``.

Diff integral: `git show 8c79022`.

## 4. Resultado

`npm run test:quick` em `8c79022`: **exit 0, 20/20** verificações verdes (lista em
`program-2.0/phase-00/GATES.md` §3). Reproduzido nesta worktree para o marco 1.1.18 com o gate
adicional `release:version-contract:verify`: 21/21 — ver
`docs/evidence/s00-versioning-auth-contract/TESTS.md`.

## 5. Consequências para o programa

- `ui:operational-customization:verify` valida o contrato vigente até a migração dos cadastros para
  stores; será substituído por `launch:contract:verify` no marco 1.4.0 (ADR-031/ADR-034).
- `GerenciarSaidasDialog.jsx` permanece no repositório sem uso; remoção prevista em 1.4.0
  (ADR-031). Registrado no CHANGELOG 1.1.18 › Removed.
- Lição registrada em `docs/engineering/RELEASE-POLICY.md` §6: quando um gate falha por mudança
  legítima de contrato, o gate é atualizado para o contrato real e a mudança vai para a evidência.
