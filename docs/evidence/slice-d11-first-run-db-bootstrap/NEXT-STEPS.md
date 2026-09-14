# NEXT-STEPS (após D.11)

1. **Maike testar o instalador em outra máquina limpa** e confirmar, na primeira
   abertura:
   - o banco é criado automaticamente (sem configurar nada);
   - `pesagens.db` aparece em `%APPDATA%\pesagens-individuais\data\`;
   - a tela de Manutenção mostra banco OK / "Banco íntegro.".
   Preencher o registro assinável em
   `docs/evidence/slice-d10-final-packaging-clean-machine/CLEAN-MACHINE-TEST-RECORD.md`.

2. **Antivírus**: se o Windows/Defender quarentenar o instalador não assinado,
   adicionar exclusão ou orientar o usuário (o Setup.exe já sumiu uma vez neste
   ambiente). Considerar code signing quando houver certificado.

3. **Se o banco NÃO for criado na máquina real**: capturar o log do app
   (`[bootstrap] dataDir:` e `[sqlite] init failed:`) — ele dirá se foi permissão
   de pasta ou falha do módulo nativo. Só então avaliar ajuste adicional.

4. **Somente depois** do teste físico OK, criar `docs/HANDOFF-CLAUDE-CODE.md`.

## Pendências que permanecem (não bloqueiam distribuição inicial)
- Ícone default do Electron.
- Code signing (SmartScreen).
- Teste físico completo em máquina limpa assinado.
