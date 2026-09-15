# Política de release — Pesagens Individuais

**Vigente desde 1.1.18 (14/09/2026).** Base normativa: ADR-039, ADR-047 e ADR-048; contrato
`docs/arquitetura-produto/13-VERSIONAMENTO-RELEASE.md` §4. Complementa
`docs/engineering/VERSIONING.md`. Vale para todo marco do programa 1.1.18 → 1.6.0.

## 1. Princípios

1. **Build limpo.** Nenhum artefato de release é reaproveitado entre versões: `release:clean`
   remove Setups e `win-unpacked` de versões antigas antes de `build` e do electron-builder.
2. **Um pacote, uma versão.** `release/` e `release-unsigned/` só podem conter o Setup da versão
   atual; `release:current-only:verify` e `release:version-contract:verify` falham se houver
   qualquer artefato de outra versão. Um `.exe` antigo nunca é declarado "current".
3. **Prova antes de tag.** Tag `vX.Y.Z` só depois de todos os gates da release verdes.
4. **Nada remoto sem autorização.** Nenhum push, publicação, upload ou release remota sem
   autorização explícita do responsável. Tags são locais até essa autorização.
5. **Honestidade de evidência.** Teste físico (máquina limpa, balança, RFID) só é declarado
   EXECUTADO com evidência humana (quem, quando, resultado). Caso contrário, o checklist diz
   NÃO EXECUTADO.

## 2. Pastas de saída

| Pasta | Conteúdo | Status |
|---|---|---|
| `release/` | Setup assinado com Authenticode (`npm run dist`) | única distribuição oficial |
| `release-unsigned/` | Setup sem assinatura (`npm run dist:unsigned`), com checksum e manifesto `distribution: unsigned-diagnostic` | diagnóstico local; pode ser bloqueado por Defender/SmartScreen/WDAC e **não** é release oficial |
| `docs/release/<versão>/` | notas, checklist, `MIGRATION-*.md` quando aplicável | documentação versionada (rastreada no git) |

Ambas as pastas de artefatos são ignoradas pelo git (`/release/`, `/release-unsigned/`, ancoradas
na raiz). `docs/release/` é rastreada.

## 3. Assinatura

- `signed` no manifesto é **sempre `false` até existir certificado Authenticode válido** e o
  gate `release:signature:verify` confirmar a assinatura do Setup. O gerador do manifesto não
  aceita override desse campo.
- Enquanto não houver certificado, `npm run dist` é bloqueado pelo preflight de credenciais
  (`release:signing:preflight`) e o único pacote possível é o de diagnóstico em `release-unsigned/`.
- Nunca orientar o usuário a desativar Defender, SmartScreen, WDAC ou App Control.

## 4. Sequência obrigatória de uma release

```text
 1. package.json + package-lock.json + fallback de appVersion.js na versão nova
 2. CHANGELOG consolidado: "## [X.Y.Z] — AAAA-MM-DD" (sem blocos "Não lançado")
 3. docs/release/X.Y.Z/RELEASE-NOTES.md + RELEASE-CHECKLIST.md (+ MIGRATION-*.md se esquema mudou)
 4. docs/user atualizado; npm run docs:user:verify
 5. npm run test:quick  (lint, release:current-only, release:version-contract, gates de contrato)
 6. npm run release:clean → npm run build → electron-builder
      assinado:      npm run dist           → release/
      sem certificado: npm run dist:unsigned → release-unsigned/  (signed=false)
 7. gates de pacote: packaged:source:verify, packaged:ui-build:verify
      (versão do package.json = app.asar = manifesto; UI_BUILD_ID no bundle e no asar;
       Setup não anterior aos bundles; nome "Pesagens Individuais Setup X.Y.Z.exe")
 8. release:checksum (.sha256) e release:manifest (release-manifest.json, versão 2)
 9. e2e instalado (e2e:installed:verify / diagnostic:e2e:verify)
10. teste físico: EXECUTADO só com evidência humana; senão NÃO EXECUTADO no checklist
11. evidência em docs/evidence/<slice>/ (REPORT, FILES-CHANGED, TESTS, RISKS, ROLLBACK, …)
12. commit da release; tag local vX.Y.Z após o gate
13. publicação remota: somente com autorização explícita
```

Um marco que não gera instalador (caso de 1.1.18) executa 1–5 e 11–12, registra
"instalador: não gerado neste marco" nas notas e no checklist e deixa os passos 6–10 como
pendentes explícitos.

## 5. Checksum e manifesto

- `release:checksum` grava `<Setup>.sha256` ao lado do instalador.
- `release:manifest` grava `release-manifest.json` (formato 2, ver `VERSIONING.md` §4) e em
  seguida roda `packaged:ui-build:verify`. O manifesto inclui SHA-256, tamanho e `builtAt`
  (mtime) do Setup, `gitCommit` e `buildTimestamp`; com git indisponível, `gitCommit` é `null`.
- Quem instala confere o SHA-256 publicado com o do arquivo recebido antes de executar.

## 6. Gates e o que cada um protege

| Gate | Protege |
|---|---|
| `release:current-only:verify` | nenhum Setup/`win-unpacked` de outra versão nas pastas de saída |
| `release:version-contract:verify` | uma só versão em package/lock/fallback/notas/CHANGELOG/manifesto; `RELEASE_MANIFEST_VERSION` único |
| `docs:user:verify` | documentação do usuário e da release presente e não vazia |
| `packaged:source:verify` / `packaged:ui-build:verify` | o pacote contém exatamente a árvore e o bundle da versão |
| `release:signature:verify` | assinatura Authenticode do Setup (release oficial) |
| `e2e:installed:verify` | app instalado abre, cria dados, faz backup e restaura |

Gates nunca são afrouxados para passar. Se um gate falha por mudança legítima de contrato, o
gate é atualizado para o contrato real e a mudança é registrada na evidência (exemplo: S-00.0).

## 7. Rollback

- Rollback de código: `git checkout vX.Y.Z-anterior` (ou revert dos commits do marco). Cada marco
  deixa tag, CHANGELOG e evidência coerentes para `git bisect`.
- Rollback de dados: só é necessário quando o esquema mudou. A migração cria backup físico
  pré-migração validado (documento 14); o formato de backup anterior continua restaurável pela
  versão anterior do app. Em 1.1.18 não há migração, logo o rollback é apenas de código.
- Um Setup de versão anterior pode ser reinstalado por cima; os dados ficam em `userData`, fora
  da pasta do programa.

## 8. Fora da política

Não fazem parte de release: pacotes portáteis, atualização automática, canal de pré-lançamento,
telemetria e publicação em lojas. Qualquer um desses itens exigirá nova ADR.
