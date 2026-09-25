```
ETAPA: E0 — Fechar o trabalho em andamento     VERSÃO: 1.3.2     BRANCH: program/sanity-launch-import
STATUS: CONCLUÍDA (commits feitos em 25/09/2026 depois de reinstalar o Git; sem push, main intocada)
```

Histórico: a primeira versão deste REPORT saiu PARCIAL porque o Git tinha sido apagado do PC sem
desinstalar (o registro do Windows ainda apontava `C:\Program Files\Git`). Reinstalado com autorização
da responsável (`winget install --id Git.Git -e --force`, Git 2.55.0.3) e os commits foram feitos.

Data: 25/09/2026. Base: `program/sanity-launch-import` @ `76e02ef` (esquema Dexie 8, backup formato 3).

## 1. O que foi feito

- Levantei tudo o que estava sem commit (46 arquivos: 16 alterados + 30 novos) e expliquei cada um
  (tabela abaixo). Nada foi descartado.
- `test:quick` estava **vermelho** em 3 gates. Corrigi só o necessário, sem funcionalidade nova:
  1. **Bug real na Relação** — o ícone `Layers` saiu do import, mas o diálogo *Ações em lote › Data,
     apartação e lote* ainda o usa: a tela quebrava ao abrir o diálogo (`ReferenceError`; o build
     não acusa). Import restaurado. O instalador 1.3.2 já gerado **tem esse bug** (confirmado no
     `dist/` de 24/09: `e.jsx(Layers,…)` sem ligação). Registrado em `docs/release/1.3.2/RELEASE-NOTES.md`.
  2. `ui:locale-dialog:verify` esperava 11 diálogos; a 1.3.1 criou 2 (ações em lote), ambos no
     contrato padrão → contagem 13.
  3. `reports:relation-parity:verify` não previa a coluna nova "Frete compra", que é comercial e
     fica oculta para CONSULTA (comportamento correto) → gate atualizado.
  4. `import:idempotency:verify` era **intermitente** (~20 %): no teste de duplo clique as duas
     gravações podem criar job e a perdedora fica `FALHOU` ("refaça a análise"); às vezes ela cai entre
     os 3 jobs mais recentes. Provado em 25 execuções (5 com o perdedor no topo). O app está certo;
     a asserção passou a aceitar só esse caso. 20/20 verdes depois.
- O gate `weighing:bulk-actions:verify` (criado na 1.3.1) não estava no `test:quick` → registrado
  (também no `test:full`) e passou a barrar componente JSX sem import na Relação.
- `.gitignore` passa a cobrir `*.exe`, `*.blockmap` e qualquer `/release*/` na raiz.
- Contrato de versão coerente (package.json, lock, appVersion.js, CHANGELOG, docs/release/1.3.2,
  manifesto de release-unsigned — todos 1.3.2).
- Branches, tags e a pasta `../MAKGESTAO-1.1.18` analisadas (seções 5 e 6).

### O que mudou em cada arquivo pendente (antes da E0)

| Arquivo | O que mudou |
|---|---|
| `CHANGELOG.md` | Blocos [1.3.1] (ações em lote na Relação) e [1.3.2] (versão visível na barra e no título). |
| `docs/arquitetura-produto/08-DECISOES-ARQUITETURAIS.md` | ADR-050: atualização automática via electron-updater + Supabase Storage. |
| `docs/arquitetura-produto/README.md` | Link para o doc 15. |
| `docs/arquitetura-produto/15-ATUALIZACAO-AUTOMATICA-SUPABASE.md` (novo) | Arquitetura do atualizador (bucket, canais, assinatura, gates). |
| `docs/plano-mestre/**` (novos, 21) | Pacote do Plano Mestre 2 (visão, E1–E9, regras, prompts). |
| `docs/release/1.3.1/*`, `docs/release/1.3.2/*` (novos) | Notas e checklist das duas versões. |
| `electron/main.cjs` | Título da janela com a versão instalada (`app.getVersion()`). |
| `package.json` / `package-lock.json` | Versão 1.3.0 → 1.3.2; script `weighing:bulk-actions:verify`. |
| `scripts/verify-bulk-weighing-actions.mjs` (novo) | Gate das ações em lote (histórico sincronizado, colisão número + marca, auditoria). |
| `scripts/verify-desktop-smoke.mjs` | Espera o título com versão. |
| `scripts/verify-shell-settings-ui.mjs` | Exige o selo de versão visível (computador e celular). |
| `scripts/verify-weighing-access.mjs` | Cobre a permissão de `bulkUpdateAnimalProfiles`. |
| `src/components/modelobase1/layout/ModeloBase1AppShell.jsx` | Selo "v1.3.2" na barra; "Local · v1.3.2" no celular. |
| `src/components/modelobase1/layout/modelo-base1-shell.css` | Estilo do selo de versão. |
| `src/lib/appVersion.js` | Versão reserva 1.3.2. |
| `src/modules/reporting/definitions/columns/eventColumns.js` | Colunas GTA compra, NF-e compra e Frete compra (lidas de `documentacao`). |
| `src/modules/weighing/application/weighingService.js` | `bulkUpdateAnimalProfiles`; frete da compra some para quem não vê valores. |
| `src/modules/weighing/infrastructure/weighingDataAdapter.js` | Edição coletiva do animal: marca/raça/sexo/era/categoria, sincroniza pesagens e brinco visual, recusa colisão, audita. |
| `src/pages/PesagensIndividuais.jsx` | Menu de ações em lote no cabeçalho Ações + diálogos de identificação e de dados comerciais. |
| `src/styles/d17b-modelobase1.css` | Estilos do menu e dos diálogos de ações em lote. |

## 2. Arquivos criados / alterados pela E0

- `src/pages/PesagensIndividuais.jsx` — import de `Layers` restaurado.
- `scripts/verify-bulk-weighing-actions.mjs` — checagem "componente JSX sem import".
- `scripts/verify-brazilian-format-contract.mjs` — 13 diálogos.
- `scripts/verify-reports-relation-parity.mjs` — `compra_frete` oculto para CONSULTA.
- `scripts/verify-import-idempotency.mjs` — tolera só o perdedor do duplo clique.
- `package.json` — `weighing:bulk-actions:verify` no `test:quick` e no `test:full`.
- `.gitignore` — `/release*/`, `*.exe`, `*.blockmap`.
- `docs/release/1.3.2/RELEASE-NOTES.md` — problema conhecido do instalador 1.3.2.
- `docs/evidence/e0/REPORT.md` — este arquivo.

## 3. Gates

| Comando | Resultado |
|---|---|
| `npm run test:quick` (antes) | vermelho — parou no passo 5 (`ui:locale-dialog`); rodando passo a passo: 74/76 verdes, vermelhos `import:idempotency` (intermitente) e `reports:relation-parity` |
| `npm run test:quick` (depois) | **verde** — 76/76 passos, EXIT 0 |
| `npm run test:quick` sobre o HEAD commitado (`8313fea`) | **verde** — 76/76 passos, EXIT 0 |
| `npm run release:version-contract:verify` | verde |
| `npm run weighing:bulk-actions:verify` | verde |
| `node scripts/verify-import-idempotency.mjs` ×20 | 20/20 verdes |
| `npx vite build` (pasta temporária, `dist/` intocado) | verde; `Layers` ligado ao import no bundle |

## 4. Migração

Não há. Esquema Dexie 8, backup formato 3.

## 5. O que NÃO foi feito e por quê

- Commits (tarefa 3) — **feitos**, na branch `program/sanity-launch-import`, sem push:
  1. `1bb027c` release(1.3.2): ações em lote na Relação (1.3.1) e versão visível (1.3.2) — o código
     como estava no build de `release-unsigned/` (sem as correções da E0).
  2. `05e6d33` fix(e0): Layers importado na Relação e test:quick verde.
  3. `ef03f71` docs(arquitetura): ADR-050 e doc 15 — atualização automática via Supabase.
  4. `6564077` docs(plano-mestre): pacote de execução do Plano Mestre 2.
  5. `8313fea` chore(git): ignora instaladores e pastas release* na raiz.
  6. docs(evidence): REPORT da E0 (este arquivo).
- Verificação visual do diálogo corrigido no navegador: exigiria criar um administrador com senha no
  banco local do navegador; substituída pela prova no bundle de produção + gate novo.
- Nada foi apagado, arquivado ou movido (branches, worktree, instaladores).

## 6. Riscos e pendências

- **Instalador 1.3.2 com bug** no diálogo "Data, apartação e lote". Precisa de novo build (1.3.3 PATCH
  ou a próxima versão).
- **Branches** (tarefa 5):

| Branch | Último commit | Contida na linha atual? | Recomendação |
|---|---|---|---|
| `program/sanity-launch-import` | `76e02ef` 17/09 "docs(release): RC1 hashes…" | — (é a atual) | **Linha de integração do Plano Mestre 2** |
| `main` | `77eeb3b` 14/09 "baseline" (= tag `v1.1.17-baseline`) | sim (82 commits atrás) | Avançar para a linha atual (fast-forward, sem merge) — **precisa da sua autorização** |
| `program/reporting-1.3.0` | `d44d5b9` 17/09 checkpoint | sim, inteira | Pode ser arquivada |
| `program/pesagens-master-evolution` | `a465123` 17/09 1.2.0-rc1 | sim, inteira | Pode ser arquivada |
| `preview/1.2.0-demo` | `8977497` 15/09 "demo… not for integration" | 1 commit fora | Pode ser arquivada (a própria mensagem diz que não é para integrar) |
| `release/1.1.18` | `4d81b50` 15/09 bloco [1.1.17] no CHANGELOG | 1 commit fora (conteúdo já existe no CHANGELOG atual) | Pode ser arquivada; a tag `v1.1.18` guarda o commit |

  Tags `v1.2.0-rc1` e `v1.3.0-rc1` estão contidas na linha atual; não há tag para 1.3.1/1.3.2.
- **`../MAKGESTAO-1.1.18`** (tarefa 7): não é cópia solta, é um **worktree Git** da branch
  `release/1.1.18`. Nenhum arquivo modificado; todo conteúdo (700 arquivos) já existe no histórico.
  Nada se perde ao arquivar. **Cuidado:** a pasta `node_modules` dela é uma *junção* para
  `MAKGESTAO-main\node_modules`; apagar a pasta com `Remove-Item -Recurse` do PowerShell 5.1 pode
  apagar o `node_modules` do projeto principal. Forma segura (quando decidir):
  `cmd /c rmdir "..\MAKGESTAO-1.1.18\node_modules"` e depois `git worktree remove ../MAKGESTAO-1.1.18`.
- Fora do repositório, na pasta `projeto\`, estão `Pesagens Individuais Setup 1.3.0.exe` (+ `.sha256`)
  e `PLANO-MESTRE-COMPLETO.txt`. Não estão no Git; deixei como estão.
- Conflito entre os documentos do plano: `00-LEIA-PRIMEIRO` §4.9 manda criar as branches a partir de
  `main` atualizada; `_REGRAS-COMUNS` manda criar a partir da linha de integração. Com `main` 82
  commits atrás, as duas só coincidem se `main` avançar.

## 7. Como a responsável testa

1. Na pasta `MAKGESTAO-main`, `git log --oneline -7` → os 6 commits da E0 sobre `76e02ef`.
2. `git status` → nada pendente.
3. `npm run test:quick` → termina sem erro.
4. No app de desenvolvimento, na Relação: selecionar 2 lançamentos → três pontos do cabeçalho Ações →
   "Data, apartação e lote" → o diálogo abre (antes a tela quebrava).
5. No mesmo menu, "Identificação e classificação" e "Venda" abrem normalmente.

## 8. Perguntas para a responsável

1. Autoriza avançar `main` até a linha atual (fast-forward, sem merge, sem push)? Assim as etapas
   partem de `main`, como diz o 00-LEIA-PRIMEIRO.
2. Gero a **1.3.3** (PATCH) só com a correção do diálogo, ou a correção entra direto na 1.4.0 (E1)?
3. Posso arquivar as 4 branches antigas (criar tag `archive/<nome>` e apagar a branch) e remover o
   worktree 1.1.18 do jeito seguro descrito acima?
4. Crio as tags `v1.3.1` e `v1.3.2` depois dos commits?
