# Checkpoint — pausa do programa em 15/09/2026 07:45

Pedido do responsável: "quero fechar por enquanto". Estado gravado para retomada.

## Onde o trabalho está

| Item | Estado |
|---|---|
| `main` | baseline 1.1.17 (tag `v1.1.17-baseline`, commit `77eeb3b`) — intocado |
| `release/1.1.18` | marco 1.1.18 fechado e etiquetado (`v1.1.18`, commit `4d81b50`): baseline verde, contrato de versão, docs de engenharia; sem esquema novo; sem instalador |
| `program/pesagens-master-evolution` | integração da 1.2.0 em andamento. Último commit íntegro: `10aa042`. **Este checkpoint** acrescenta um commit "wip" com o estado parcial da onda 1 de correções (ver abaixo) |
| Worktree `../MAKGESTAO-1.1.18` | branch `release/1.1.18`; `node_modules` é uma junção para o repositório principal; pode ser removida com `git worktree remove ../MAKGESTAO-1.1.18` |

## O que está pronto na 1.2.0 (commits até `10aa042`)

- Dexie v7 (23 stores), coordinator de migração v6→v7 com backup físico prévio e backfill resumível, backup formato 3, restore v6→v7 com backfill, dois níveis de limpeza, integridade v7.
- Login local e usuários (revisão 1: 3 perfis, store nomeada no esquema já como `usuarios`), AuthGate, RequirePermission, UserMenu, tela Usuários, Configurações.
- Cadastros mestres como stores + telas Marcas, Raças, Categorias, Parceiros, Propriedades, Causas de morte; sanidade removida.
- Menu por grupos e permissões; Lançamento lendo compradores/frigoríficos/causas das stores.
- Massa de teste v7, gate de pacote, docs do usuário e notas 1.2.0 (rascunho), contrato de versão rev.2, ADR-041…048.

## O que ficou parcial (onda 1 de correções, interrompida)

A onda 1 (AUTH, STORAGE, CATALOG, LAUNCH) foi interrompida três vezes (queda de sessão na noite de 14/09 e interrupções em 15/09) e parada a pedido. O commit `wip(onda-1)` guarda o estado parcial: `lint` verde; **gates vermelhos esperados** até a conclusão:

- `storage:dexie:verify`, `storage:backup:verify` — ainda referenciam a store `usuariosLocais` (o esquema já é `usuarios`);
- `auth:local:verify`, `auth:access:verify` — módulo de auth em transição da revisão 1 para a 2 (arquivos duplicados: `authSession.js`/`sessionService.js`, `localAuthService.js`/`authService.js`, `accessPolicy.js`/`permissionService.js`; `loginLockout.js` removido; novos `passwordPolicy.js`, `recoveryKey.js`, `authAudit.js`, `authErrors.js`);
- `registry:master:verify` — gate ainda espera `actor_user_id` (auditoria rev.2 usa `usuario_id`);
- `ui:shell-settings:verify` — regex do menu lateral ajustada; rótulo "Trocar senha" pendente no UserMenu;
- `catalog`: `catalogResolver.js` existe em `domain/` e `application/`; `registryServices.js` novo; `seeds.js` alterado;
- `Lançamento`, `ConfirmarAnimalSnDialog`, `weighingWarnings`, `operations/*`: edições parciais para seletores de marca/raça/categoria e políticas de configuração; `operationalPolicies.js` novo.

Findings das revisões ainda abertos: ver `docs/evidence/program-2.0/phase-01/` (quando gerado) e os resultados no journal do workflow `wf_9b0eb29b-943` (P1: login impossível com escrita bloqueada por migração; alinhamento rev.2; P2: padrão em registro inativo, exclusão com vínculo histórico, reset sem senha, restore sem logout, docs prometendo comportamento inexistente, parser numérico de Configurações, LockScreen desmontando o app, manifesto rev.2, rótulos).

## Como retomar

1. `git checkout program/pesagens-master-evolution` (repositório principal); `git log --oneline | head`.
2. Ler este checkpoint, `docs/evidence/STATE-OF-REPO-BEFORE.md`, `docs/arquitetura-produto/10…14` (rev.2) e `docs/evidence/ui-parity/USER-SAMPLE-2026-09-14.md`.
3. Concluir a onda 1 em fatias curtas (um agente por área, prompts do script `workflows/scripts/pesagens-1-2-0-onda-1-*.js`, com a nota de reconciliação), começando por AUTH (rev.2) e STORAGE (renome `usuarios`), depois CATALOG e LAUNCH.
4. Coordenador: `package.json` (scripts `auth:crypto/bootstrap/permissions/recovery`, `audit:actor`), `verify-ui-consistency.mjs` se o Lançamento mudar, `npm.cmd run test:quick` verde.
5. Onda 2: paridade de UI ModeloBase1 (amostra do responsável; harness em `scripts/ui-parity/`) e docs coerentes.
6. Bump 1.2.0 (`package.json`, `package-lock.json`, `src/lib/appVersion.js`), `release:clean`, `dist:unsigned`, `packaged:build:verify`, checksum/manifesto, capturas, evidências em `docs/evidence/s01-*`, checkpoint no formato do programa, tag `v1.2.0`.

## Modo de trabalho recomendado na retomada (custo)

Modo enxuto: um agente por fatia, sem revisores paralelos; fatias de ≤ 45 min; integração e correções pequenas pelo coordenador; gates como verificação. Estimativa para fechar a 1.2.0: 3,5–4 h.
