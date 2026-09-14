# STATE-OF-REPO-BEFORE — estado real do repositório antes do programa de evolução

**Gerado em:** 14/09/2026 (noite) · **Programa:** Pesagens Individuais 1.1.17 → 1.6.0 (prompt "Programa Master de Evolução", que refina o "Programa Mestre 2.0" do mesmo dia).

## 1. Ponto de partida imutável (tag `v1.1.17-baseline`, commit `77eeb3b`, branch `main`)

| Item | Valor real | Confere com a auditoria? |
|---|---|---|
| Versão do app (`package.json`) | 1.1.17 | sim |
| Electron / React / Vite / Dexie | 35 / 18 / 6 / 4 | sim |
| Esquema Dexie | `DB_VERSION = 6`, 16 stores (`lotes` sem uso) | sim |
| Backup | formato `pesagens-individuais-indexeddb-backup`, `formatVersion 2` | sim |
| Git | **não existia**; inicializado neste programa (`git init`, `.gitignore`, 671 arquivos rastreados) | auditoria já apontava a ausência |
| lint / build | verdes (11 s / 22 s) | sim |
| `test:quick` | vermelho em `ui:operational-customization:verify` e `ui:consistency:verify`; 26 de 28 verificações individuais verdes | sim |
| Instalador existente | `release-unsigned/Pesagens Individuais Setup 1.1.17.exe` (diagnóstico, sem assinatura) | sim |
| Nome do banco / origem | `pesagens-individuais` (IndexedDB do renderer), `userData` do Electron; **não alterados** por este programa | — |
| Sanidade | tela ativa no menu contra ADR-007 | sim (contradição C-01) |
| Cadastros comerciais/causas | em `appSettings` via `registryService`; `GerenciarSaidasDialog.jsx` existe mas o Lançamento não o importa (`perfis-saida` só por compatibilidade) | sim |
| Auth / usuários / versionamento formal | inexistentes | sim |

Arquivos divergentes da auditoria: nenhum de conteúdo. Duas divergências de leitura foram confirmadas no código: (1) o gate `ui:operational-customization` exigia `GerenciarSaidasDialog` que a tela já não usa desde o trabalho paralelo de 14/09 (documentado em `docs/auditoria/AUDITORIA-ESTADO-2026-09-14.md` §3 e em `UX-FLOW-AUDIT.md`); (2) o gate `ui:consistency` exigia sintaxe de template literal que o componente nunca teve na tag.

## 2. Diagnóstico dos dois gates vermelhos (S-00.0)

| Gate | Causa | Código ou teste? | Ação tomada | Prova |
|---|---|---|---|---|
| `ui:operational-customization:verify` | asserção `assert.match(launch, /GerenciarSaidasDialog/)` sobre `LancamentoPesagensIndividuais.jsx`, que em `v1.1.17-baseline` já lê compradores/vendedores/frigoríficos de `loadRegistryGroup('comerciais')` (registry) e não importa o popup | **teste desatualizado** (o contrato da tela mudou em 14/09 com a página Cadastros Comerciais; o popup ficou órfão) | gate reescrito para o contrato vigente: popup ausente, seleção do registry, persistência do registry após reabrir | `git show v1.1.17-baseline:src/pages/LancamentoPesagensIndividuais.jsx | grep -c GerenciarSaidasDialog` → 0; `docs/evidence/program-2.0/phase-00/GATES.md` |
| `ui:consistency:verify` | regex acoplada à sintaxe (`className={\`view-seg…` e rótulos literais) | **teste frágil** | asserções estruturais (`.view-seg` + slider + `VIEW_MODES` + rótulo acessível gerado) | idem |

Resultado: `test:quick` 20/20 verde no commit `8c79022`, sem alterar código de produto.

## 3. Estado no momento deste documento (branch `program/2.0` → renomeada `program/pesagens-master-evolution`)

| Commit | Conteúdo |
|---|---|
| `8c79022` | gates alinhados ao contrato real (S-00.0) |
| `39a2071` | ADR-018…ADR-040 |
| `c2a1a06` | medição de payload/auditoria |
| `e4d4278` | contratos 10–14 + evidências da fase 0 (gates, perf Node 36k/250k, perf Chromium 36k) |
| `986c502` | **esquema v7 estrutural** (stores novas, `lotes` removida) — ponto a partir do qual o marco 1.1.18 "sem esquema novo" precisa ser derivado do commit anterior |
| `deac4a3` | `versionInfo.js`, `auditActor.js`, evidências |
| árvore de trabalho | ~70 arquivos não commitados dos agentes da Fase 1 (storage/migração, auth, cadastros, perf, QA/docs, telas) — integração em andamento |

## 4. Riscos identificados antes das alterações

1. **Trabalho paralelo na mesma árvore** (sessão anterior de 14/09 deixou gates vermelhos): mitigado por dono único de arquivo e commits sequenciais do coordenador.
2. **Migração v6 → v7 sem backup físico** seria irreversível: contrato de preflight (documento 14) obriga backup validado antes de abrir na versão nova; sem ponte de arquivos (navegador de desenvolvimento) a migração é bloqueada.
3. **Marca em texto livre compõe a identidade**: fusão automática pode unir animais; regra "colisão não funde" (ADR-021).
4. **Store `lotes`**: removida na v7 só com verificação de vazio no preflight.
5. **Nome do banco/origem**: qualquer mudança faria os dados "sumirem"; proibido (regra 25 do programa).
6. **Assinatura Authenticode ausente**: nenhum pacote é release oficial; `signed=false`.
7. **Desempenho**: reconstrução do índice de animais na tela (0,9 s no Chromium, 36 mil) só se resolve no marco 1.3.0.

## 5. Reconciliação entre os dois programas do dia 14/09

O "Programa Mestre 2.0" (releases 1.2.0…2.0.0) e o "Programa Master de Evolução" (marcos 1.1.18…1.6.0) têm o mesmo conteúdo técnico; o segundo prevalece. Diferenças aplicadas:

| Tema | Programa 2.0 | Programa de Evolução (vigente) |
|---|---|---|
| Marcos | 1.2.0 → 1.3.0 → 1.4.0 → 1.5.0 → 2.0.0 | **1.1.18** (baseline + contrato de versão) → 1.2.0 (v7+auth+cadastros+lançamento seleciona cadastros) → 1.3.0 (identificadores) → 1.4.0 (lançamento enxuto + lotes) → 1.5.0 (v8 comercial/embarque) → **1.6.0** (sessão/fechamento/animais/auditoria) |
| Perfis | ADMIN, GESTOR, OPERADOR | + **CONSULTA** (somente leitura) |
| Store de usuários | `usuariosLocais` (perfil, senha_*) | **`usuarios`** (role, password_*, recovery_*, failed_login_count, locked_until, last_login_at) |
| Auditoria | `actor_user_id/name/profile` | **`usuario_id`, `usuario_nome_snapshot`**; eventos de login resumidos |
| Sessão | inatividade 60 min | **30 min**; sem localStorage; sessionStorage só para recarga técnica |
| Recuperação do ADMIN | — | **Recovery Key** exibida uma vez, só hash/verificador no banco |
| Versionamento | 5 eixos + build ids | App SemVer, DB_SCHEMA_VERSION, BACKUP_FORMAT_VERSION, **RELEASE_MANIFEST_VERSION** (os demais marcadores continuam como informação de build) |
| Evidências | `docs/evidence/program-2.0/<fase>/` | **`docs/evidence/<slice>/`** (REPORT, FILES-CHANGED, TESTS, MIGRATION, PERF, SCREENSHOTS, RISKS, ROLLBACK); `program-2.0/phase-00` permanece como histórico e é referenciado por `s00-baseline-recovery` |
| Branches | `program/2.0` | `program/pesagens-master-evolution` + `slice/*` quando possível |

Nenhuma decisão DEC-001…DEC-022 mudou.
