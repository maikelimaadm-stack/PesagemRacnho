# CLEAN-MACHINE-TEST-RECORD

Registro **assinável** do teste real em máquina limpa. Este documento é o
comprovante; o roteiro passo a passo está em `docs/user/TESTE-MAQUINA-LIMPA.md`.

> **Status: PENDENTE — teste físico ainda não executado.**
>
> **ATUAL (2026-08-03): use `Pesagens Individuais Setup 1.1.2.exe` — SHA256
> `6ccc9f9a7c99eb68375ca98d22cca02fcf92da0ead04eafd6b730ff2b4d7a13f`.**
> NÃO usar 1.1.1 (abria travada) nem anteriores. Confirme **Versão 1.1.2** na Manutenção.
>
> Atualização D.14 (hotfix): o backup ainda falhava no 1.0.1. Introduzido runtime
> SSOT de caminhos + diagnóstico na tela + log local. Versão agora **1.0.2**.
> **Use SOMENTE** `Pesagens Individuais Setup 1.0.2.exe` — SHA256
> `eea84a05896f437cc0862925044c9255b55aa4a94bddf43a17fcf1b69d8d0303`.
> Confirme **Versão: 1.0.2** na tela de Manutenção (Diagnóstico), veja o caminho
> do banco e do log. Se o backup falhar, use "Copiar diagnóstico" e envie
> `%APPDATA%\pesagens-individuais\logs\app.log`. Ver
> `docs/evidence/slice-d14-runtime-db-diagnostic-hotfix/`.
>
> **Atualização D.16 (mudança de arquitetura — ATUAL):** armazenamento operacional
> migrado de SQLite para **IndexedDB/Dexie**. Não há mais SQLite no fluxo do
> usuário → "Banco SQLite não inicializado" não pode ocorrer. Versão **1.1.0**.
> **Use SOMENTE** `Pesagens Individuais Setup 1.1.0.exe` — SHA256
> `616a3059566a5f9a2f7f1a0e68967c891dd18991111eb54c74f634531ba04a49`. Confirme
> **Versão 1.1.0** + "Armazenamento: IndexedDB local" na Manutenção. Ver
> `docs/evidence/slice-d16-dexie-operational-cutover/`.
>
> Tentativa de teste físico (2026-07-20): **NÃO EXECUTADO** — o ambiente do agente
> não permite instalar o Setup interativamente nem clicar no app instalado
> (launch do exe travou/bloqueado). Todos os itens abaixo seguem PENDENTE até a
> Maike executar numa máquina real. SHA256 do 1.0.2 confirmado.

> IMPORTANTE: este teste **não pôde ser executado automaticamente** — exige um
> Windows limpo (ou outro usuário) e cliques físicos. A validação automatizável
> (artefatos + launch do exe empacotado) está em `VALIDATION-RESULTS.md`.
> Preencha e "assine" abaixo após rodar o checklist em uma máquina real.

## Identificação
- Versão do Setup testada: `Pesagens Individuais Setup 1.0.0.exe`
- Data do teste: __________________
- Computador / usuário: __________________
- Executado por: __________________

## Resultado por item (do checklist)
| # | Item | OK? | Observação |
|---|------|-----|------------|
| 1 | Instalar o .exe | [ ] | |
| 2 | Abrir pelo atalho | [ ] | |
| 3 | Janela abre como "Pesagens Individuais" | [ ] | |
| 4 | Criar uma pesagem | [ ] | |
| 5 | Fechar o app | [ ] | |
| 6 | Abrir novamente | [ ] | |
| 7 | Pesagem persistiu | [ ] | |
| 8 | Backup do banco (Manutenção) | [ ] | |
| 9 | Exportar CSV | [ ] | |
| 10 | Exportar JSON | [ ] | |
| 11 | Verificar integridade → "Banco íntegro." | [ ] | |
| 12 | (Opcional) Reiniciar o computador | [ ] | |
| 13 | Abrir o app após reinício | [ ] | |
| 14 | Dados persistiram após reinício | [ ] | |
| 15 | Reinstalar Setup por cima | [ ] | |
| 16 | Dados preservados após reinstalação | [ ] | |
| 17 | Analisar backup .db (Manutenção) | [ ] | |
| 18 | Restaurar backup válido | [ ] | |
| 19 | App abre normal após restore | [ ] | |

## Notas esperadas
- No item 1, o **SmartScreen** pode alertar (sem assinatura). Ver `CODE-SIGNING.md`.
- Dados ficam em `%APPDATA%\pesagens-individuais\data\pesagens.db`.

## Conclusão
- Resultado geral: [ ] OK   [ ] Problema encontrado
- Problemas / pendências: __________________
- Assinatura (responsável): __________________
