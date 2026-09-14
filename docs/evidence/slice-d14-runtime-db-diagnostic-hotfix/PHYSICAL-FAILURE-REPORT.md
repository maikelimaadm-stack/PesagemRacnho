# PHYSICAL-FAILURE-REPORT (D.14)

## Erro
Após o D.13 / versão 1.0.1, o app instalado ainda mostra "Banco SQLite não
inicializado" no backup.

## D.13 reprovado fisicamente
SIM.

## Diagnóstico (perguntas obrigatórias)
Sem acesso à máquina física da Maike, não é possível responder por observação
direta. Por isso o D.14 entrega **ferramentas para a Maike responder facilmente**:
1. Manutenção mostra **Versão 1.0.1/1.0.2?** → agora há linha "Versão" na tela.
2. app.log criado? → agora `userData/logs/app.log` é criado no bootstrap.
3. app.log registra bootstrap? → sim (app version, isPackaged, paths).
4. database path no log? → sim.
5. backup requested no log? → sim (`[maintenance] ... requested`).
6. ensureDatabaseReady no log? → sim (`[db] ensureDatabaseReady start/success`).
7. erro no backup do banco, completo ou ambos? → o log registra por canal.
8. app.asar 1.0.1 ou antigo? → botão "Copiar diagnóstico" + versão na tela
   permitem confirmar; `packaged:source:verify` prova o build 1.0.2.

## Causa raiz comprovada
Comprovado tecnicamente (não na máquina física):
- O fluxo real do botão passa por `withDatabaseReady → ensureDatabaseReady`
  (contrato + handler IPC real + runtime diagnostic — todos PASS).
- O pacote **1.0.2** contém a correção e o diagnóstico (packaged:source:verify).

## Causa provável (não comprovável daqui)
O app instalado que falhou não era o build corrigido — instaladores anteriores
todos "1.0.0", e o 1.0.1 pode não ter sido efetivamente instalado/rodado. A
mensagem exata (do getConnection) reforça "build sem o fix".

## Resolução
Bump para **1.0.2** (novo artefato), **versão visível** na tela, **diagnóstico
copiável** e **app.log** — para que, se ainda falhar, a Maike envie evidência
concreta em vez de tentarmos correção às cegas.
