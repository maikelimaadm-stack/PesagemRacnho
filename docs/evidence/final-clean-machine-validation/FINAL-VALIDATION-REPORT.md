# FINAL VALIDATION REPORT — Pesagens Individuais 1.0.2

> **Tentativa de teste físico 1.0.2 (2026-07-20): NÃO EXECUTADO.**
> - Instalador confirmado: `release/Pesagens Individuais Setup 1.0.2.exe`,
>   SHA256 `eea84a05896f437cc0862925044c9255b55aa4a94bddf43a17fcf1b69d8d0303`
>   (recalculado do arquivo — confere).
> - Motivo: este ambiente não permite instalação interativa do wizard NSIS nem
>   cliques na janela do Electron instalado. A tentativa de lançar o binário
>   empacotado travou e precisou ser encerrada (mesmo bloqueio de
>   antivírus/sandbox das etapas anteriores).
> - Portanto, TODOS os itens físicos (abrir, versão na tela, backup, pesagem,
>   reinstalação) permanecem **PENDENTE** e dependem da Maike numa máquina real.


> **Atualização D.14 (2026-07-20):** o backup ainda falhava fisicamente no 1.0.1.
> Hotfix **1.0.2**: runtime SSOT de caminhos (`databaseRuntime.cjs`), diagnóstico
> na tela de Manutenção (versão, caminho do banco, caminho do log, "Copiar
> diagnóstico"), log local `userData/logs/app.log`, e prova do pacote
> (`packaged:source:verify` + `installed:runtime:diagnostic:verify`). Instalador:
> **`Pesagens Individuais Setup 1.0.2.exe`**, SHA256
> `eea84a05896f437cc0862925044c9255b55aa4a94bddf43a17fcf1b69d8d0303`. Teste
> físico com o 1.0.2 PENDENTE. Ver `docs/evidence/slice-d14-runtime-db-diagnostic-hotfix/`.

> **Atualização D.13 (2026-07-20):** o backup no app instalado ainda falhava no
> D.12 por ambiguidade de build (todos "1.0.0"). Versão subiu para **1.0.1**,
> com prova de que o pacote contém a correção (`packaged:source:verify`), versão
> visível na tela de Manutenção e log local. Instalador:
> **`Pesagens Individuais Setup 1.0.1.exe`**, SHA256
> `23863975d321b08c9efbef32f9678a1931c7e62683896fa484c1dba8731d05a7`. Teste
> físico em máquina limpa com o 1.0.1 permanece PENDENTE. Ver
> `docs/evidence/slice-d13-installed-backup-fix/`.

> **Atualização D.12 (2026-07-20):** corrigido o bug físico "Banco SQLite não
> inicializado" no backup logo após instalar. Instalador regenerado — novo
> **SHA256 `292c399d87835c89bb50cb55102407f39a34712040d8004019f983807ef05e52`**
> (substitui o 9d8c97bc... do D.11). Novo gate de regressão
> `maintenance:first-run-backup:verify` → PASS. Detalhes em
> `docs/evidence/slice-d12-maintenance-backup-db-initialization/`. O teste físico
> em máquina limpa continua PENDENTE (agora com o instalador D.12).

Data: 2026-07-16 (revalidação pós-D.11)
Ambiente: desenvolvimento (Windows 11, ambiente automatizado do Claude Code)
Windows: build de desenvolvimento — NÃO é uma máquina limpa
Instalador: `release/Pesagens Individuais Setup 1.0.0.exe` — **PRESENTE e validado**
SHA256: `9d8c97bc71ff6e7a51c873e26bc67155fd7bb815df54d7ed16f661a3cb75945a`
(recalculado do arquivo e confere com .sha256 e manifesto)

## Histórico
No D.10.1 o instalador (SHA256 e1315fee...) sumiu do `release/` (antivírus/sandbox).
No D.11 foi **regenerado** com `npm run dist` — novo SHA256 `9d8c97bc...945a`. O
instalador antigo NÃO deve mais ser usado.

## Parte 1 — Arquivos da release
- Setup.exe: PRESENTE (93.849.464 bytes)
- .sha256: PRESENTE — bate com o hash recalculado
- release-manifest.json: PRESENTE — version 1.0.0, aponta para o instalador novo,
  preservesDataOnUninstall=true, login=false, permissions=false, cloud=false

## Parte 2 — Testes automatizados (execução real 2026-07-16)
- npm run lint: PASS
- npm run build: PASS
- npm run test: PASS (= test:full)
- npm run test:quick: PASS
- npm run test:full: PASS
- npm run first-run:db:verify: PASS
- npm run desktop:smoke:verify: PASS
- npm run installer:sqlite:verify: PASS
- npm run e2e:installed:verify: PASS (modo estrito — Setup.exe obrigatório)
- npm run data:preservation:verify: PASS
- npm run docs:user:verify: PASS
- npm run release:checksum: PASS
- npm run release:manifest: PASS

## Parte 3 — First-run do banco (automatizado)
- pasta data criada automaticamente: SIM
- pesagens.db criado automaticamente: SIM
- migrations 001/002/003 aplicadas: SIM
- integrity_check: ok
- quick_check: ok
- tabelas verificadas: 15 exigidas (16 no total)
- usuário precisa configurar banco: NÃO
- usuário precisa instalar SQLite: NÃO
- caminho: `app.getPath('userData')/data/pesagens.db`
  (Windows instalado: `C:\Users\<USUARIO>\AppData\Roaming\pesagens-individuais\data\pesagens.db`)

## Parte 4 — App empacotado
- Execução real do app empacotado: **BLOQUEADA pelo ambiente** (`spawn UNKNOWN` —
  antivírus/sandbox, mesmo motivo do instalador ter sumido antes).
- Artefatos do app empacotado (validados por e2e):
  - app.asar: PRESENTE
  - app.asar.unpacked: PRESENTE
  - better_sqlite3.node: PRESENTE (N-API)

## Parte 6 — Busca final (rg)
- Program Files: 0 (nunca grava banco em Program Files) → esperado
- db.entities. operacional em src/electron: 0 → esperado
- legacyWeighingBridge em src/electron: 0 → esperado
- login/senha/permiss/auth/admin/cloud/server reais em src/electron: 0
  (apenas `role=` ARIA) → falso positivo
- PESAGENS_USER_DATA_DIR: só em electron/main.cjs (guardado) e no script de
  first-run → teste / esperado
- pesagens.db: criado em userData/data → esperado
- deleteAppDataOnUninstall=false: confirmado (package.json) → esperado

## Teste físico (máquina limpa, interativo)
NÃO EXECUTADO. Motivo: sem Windows limpo dedicado; sem cliques/UI; execução do
exe bloqueada neste ambiente. Itens de instalação/uso na UI instalada:
todos PENDENTE. Registro assinável:
`docs/evidence/slice-d10-final-packaging-clean-machine/CLEAN-MACHINE-TEST-RECORD.md`.

## Resultado
**PENDENTE TESTE FÍSICO.** Toda a validação automatizável está APROVADA
(instalador novo íntegro, gates verdes, first-run cria o banco do zero). Falta
apenas a confirmação física em máquina limpa real — responsabilidade da Maike.

## Problemas encontrados
- Nenhum problema funcional nos testes automatizados.
- Limitação de ambiente: execução do `.exe` empacotado bloqueada (antivírus/sandbox).

## Próximo passo recomendado
Maike instalar o novo `.exe` (SHA256 9d8c97bc...945a) em outra máquina e confirmar,
na primeira abertura, a criação automática do banco (pesagens.db em
`%APPDATA%\pesagens-individuais\data`), o status "banco OK" na Manutenção, e o
ciclo criar pesagem → fechar → reabrir → dados salvos → backup → export →
reinstalar por cima → dados preservados. Se o antivírus quarentenar o instalador
não assinado, adicionar exclusão.
