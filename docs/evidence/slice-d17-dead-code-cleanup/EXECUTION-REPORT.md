# EXECUTION-REPORT — Limpeza de código morto (1.1.1)

## Data
2026-08-03

## Objetivo
Remover o código e os artefatos que deixaram de ser usados após o cutover Dexie
(D.16), e revalidar tudo.

## Rede de segurança criada ANTES de remover
`scripts/verify-main-boot.mjs` (npm run `main:boot:verify`): carrega o
`electron/main.cjs` em Node com o módulo `electron` **stubado**, aguarda o
`whenReady`, e verifica que o app registra os IPCs e cria a janela.
- Baseline (main com SQLite): PASS — 106 canais IPC.
- Depois da limpeza: PASS — **8 canais IPC**, janela criada, diagnóstico e
  gravação de arquivo funcionando.
Era exatamente esta prova que faltava no D.16 para autorizar a remoção.

## Removido
- `electron/database/**` (conexão, migrations 001–003, 11 repositories,
  manutenção SQLite, migrações legadas, runtime/ready SQLite) — ~4.300 LOC.
- `electron/db.cjs` (armazenamento JSON legado).
- 5 handlers IPC de banco: database, weighing, maintenance, auxiliary,
  sanidadeEmbarque.
- Handler `dialog:select-sqlite-backup` (órfão após o restore por JSON).
- Dependência **better-sqlite3** + `build.asarUnpack` + entrada de
  `build.files` + `postinstall` (não há mais módulo nativo).
- 36 scripts de verificação do SQLite + 4 helpers (de 53 para 18 scripts).
- UI: botão "Abrir pesagens.json" e caminho do banco no cabeçalho; proxy morto
  `db.entities` e `getDbPath`/`openDbFile` em `src/api/db.js`.

## Corrigido no caminho
- **"Limpar todos os dados"** apagava o JSON legado (sem efeito real após o
  cutover). Agora limpa o Dexie (`storage.clearAllData`, com backup antes).

## Reorganizado
- `electron/ipcErrors.cjs` (wrapper de IPC, extraído de `sqliteErrors`).
- `electron/appRuntime.cjs` (caminhos do app; era `database/databaseRuntime`).
- `electron/diagnostics.cjs` sem campos SQLite; reporta "IndexedDB local (Dexie)".
- `packaged:source:verify` reescrito: exige pacote **sem** better-sqlite3 e main enxuto.
- `e2e:installed:verify`: agora exige **nenhum** módulo nativo em app.asar.unpacked.
- `test:quick`/`test:full` sem gates SQLite (que deixaram de existir).

## Resultado (antes → depois)
| Item | Antes | Depois |
|---|---|---|
| arquivos em electron/ | ~40 | **7** |
| scripts de verificação | 53 | **18** |
| canais IPC no boot | 106 | **8** |
| dependência nativa | better-sqlite3 | **nenhuma** |
| instalador | 93.852.331 B (1.1.0) | **91.395.143 B (1.1.1)** |
| app.asar.unpacked | com native | **não existe** |

## Release
- Versão **1.1.1** (evita dois instaladores 1.1.0 diferentes).
- `release/Pesagens Individuais Setup 1.1.1.exe`
- SHA256 `496fc581dca6e40cc4a5542ba2932519ce552577d8dd7cee3f594ec5edbdf545`
- `release/` e `dist/` foram apagados antes do build (artefato limpo).

## Gates (todos PASS)
lint, build, main:boot:verify, storage:all:verify (8), weighing:mapper,
maintenance:ui, maintenance:dialog, desktop:smoke, packaged:source,
e2e:installed, docs:user, test:quick, test:full.

## Limite honesto
Continuo sem conseguir instalar/abrir o app empacotado neste ambiente. O
`main:boot:verify` prova que o processo principal sobe e registra os IPCs (com
Electron stubado), e o build/gates cobrem o renderer — mas a confirmação visual
das telas segue sendo o teste físico da Maike, agora com o **1.1.1**.

---

# ADENDO — bug encontrado pela Maike e correção (1.1.2)

## O que aconteceu
Ao abrir o app, ficava preso na tela **"Aplicativo desktop necessário"**.

## Causa (bug introduzido por esta limpeza)
`src/components/DbBootstrap.jsx` liberava a UI só se `window.pesagemApp?.entities`
existisse. Ao enxugar o `preload.cjs` (remoção das APIs de dados, já inúteis após
o cutover Dexie), `entities` deixou de existir → a condição nunca era satisfeita.
Afetou a **1.1.1**. Nenhum gate pegou porque nenhum renderizava a UI.

## Correção
- `DbBootstrap` não depende mais de API de dados do preload: apenas prepara o
  armazenamento local (Dexie), com estado "Preparando o sistema…" e mensagem de
  erro clara em caso de falha.
- Novo gate **`preload:contract:verify`**: cruza todo `window.pesagemApp.X` usado
  no renderer com o que o preload expõe, e falha se a UI pedir API removida
  (lista explícita das APIs de dados aposentadas). Em `test:quick` e `test:full`.

## Verificação visual real (inédita neste projeto)
Como o armazenamento agora é IndexedDB, o app roda em navegador comum. Rodando o
dev server e abrindo a aplicação:
- **Lançamento de Pesagens**: tela renderiza completa (sem tela de erro); a regra
  de negócio funcionou ("Brinco 1234 NÃO CADASTRADO" no modo Manejo).
- **Persistência**: pesagem criada pelo mesmo service da UI, página recarregada,
  dado permaneceu (peso 412), `storage: IndexedDB/Dexie v1`.
- **Manutenção**: "Status: OK", "Banco de dados: funcionando", "Pesagens: 1",
  "Banco íntegro." — sem qualquer erro de SQLite.
- Console sem erros.

## Ajustes de rótulo
- "Selecionar backup .db" → "Selecionar backup (.json)".
- "Tamanho aproximado" → "Armazenamento: IndexedDB local (Dexie)".

## Release
- **1.1.2** — `Setup 1.1.2.exe`, SHA256
  `6ccc9f9a7c99eb68375ca98d22cca02fcf92da0ead04eafd6b730ff2b4d7a13f`.
- **A 1.1.1 não deve ser usada** (tela travada); seus artefatos foram removidos.
