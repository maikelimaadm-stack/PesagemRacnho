# PHYSICAL-FAILURE-REPORT

## Erro
Após o D.12, Maike testou o app instalado em outra máquina e o botão de backup
ainda exibiu: **"Banco SQLite não inicializado"**.

## D.12 considerado reprovado fisicamente
SIM. Os scripts do D.12 passaram, mas o app instalado real falhou. Portanto o
D.12 não está aprovado em uso físico.

## Causa mais provável (diagnóstico)
A mensagem exata "Banco SQLite não inicializado" é a do `getConnection()`
(`sqliteConnection.cjs`). Com a correção do D.12, o caminho passa por
`ensureDatabaseReady` ANTES de `getConnection`; se o banco fosse inabrível, a
mensagem seria outra ("Falha ao abrir banco SQLite"). Logo, o app instalado que
falhou **não continha a correção D.12** — provavelmente porque:
- Todos os instaladores anteriores tinham o mesmo nome/versão **1.0.0**
  (D.10.1, D.11, D.12), então o Windows/usuário pode ter mantido/instalado um
  binário antigo (sem o fix), sem forma de distinguir qual build estava rodando.

## Causa comprovada
Não é possível, deste ambiente, provar qual binário rodou na máquina da Maike.
O que foi comprovado tecnicamente:
1. O **fluxo real do botão** de backup passa pelo handler corrigido e por
   `ensureDatabaseReady` (contrato + teste via handler IPC real — PASS).
2. O **pacote 1.0.1** contém a correção no `app.asar`
   (`packaged:source:verify` — PASS).
3. Reproduzindo o cenário do bug (conexão fechada), o backup agora funciona.

## Resolução adotada
- **Bump para 1.0.1** → novo nome de artefato `Pesagens Individuais Setup 1.0.1.exe`
  (elimina a ambiguidade de instaladores "1.0.0").
- **Versão visível** na tela de Manutenção (Diagnóstico) — Maike confirma "1.0.1".
- **Log local** `userData/logs/app.log` — se ainda falhar, o log mostra
  `[maintenance] ensureDatabaseReady start/ok` e o erro exato.
- **Prova de pacote** (`packaged:source:verify`) — garante que o build 1.0.1
  contém o fix.
