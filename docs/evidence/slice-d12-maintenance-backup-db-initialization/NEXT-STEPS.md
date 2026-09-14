# NEXT-STEPS (após D.12)

## Estado após D.12
Bug "Banco SQLite não inicializado" no backup corrigido na causa. Toda a
manutenção (backup do banco, backup completo, exportar, restaurar, integridade)
garante o banco pronto de forma idempotente antes de usar a conexão. Instalador
regenerado (SHA256 292c399d...5e52). Gate de regressão criado e verde.

## Pronto para novo teste físico
SIM — com o instalador **D.12** (SHA256 292c399d87835c89bb50cb55102407f39a34712040d8004019f983807ef05e52).
O instalador do D.11 (9d8c97bc...) NÃO deve mais ser usado.

## O que Maike deve testar (na outra máquina)
1. Instalar o novo Setup.exe.
2. Abrir o app (não deve pedir configuração de banco).
3. Ir direto em **Manutenção** → **Criar backup do banco** → deve funcionar.
4. **Criar backup completo** → deve funcionar.
5. Confirmar que NÃO aparece "Banco SQLite não inicializado".
6. Criar uma pesagem → fechar → reabrir → dados salvos.
7. Fazer backup de novo, exportar CSV/JSON.
8. Reinstalar por cima → dados preservados.

## O que ainda está pendente
- Teste físico completo em máquina limpa (assinar o CLEAN-MACHINE-TEST-RECORD).
- Ícone customizado.
- Code signing (SmartScreen / quarentena de antivírus).

## Só depois disso
Criar `docs/HANDOFF-CLAUDE-CODE.md` (não antes do teste físico OK da Maike).
