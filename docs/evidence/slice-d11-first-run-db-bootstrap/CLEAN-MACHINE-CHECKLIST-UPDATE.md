# CLEAN-MACHINE-CHECKLIST-UPDATE

## Documentos atualizados
- `docs/user/TESTE-MAQUINA-LIMPA.md` — nova seção "Banco automático na primeira
  abertura (D.11)" com itens 3a–3d.
- `docs/release/1.0.0/RELEASE-CHECKLIST.md` — automáticos remarcados (instalador
  regenerado, checksum/manifest OK, first-run:db:verify OK); manuais ganharam
  itens de first-run; tudo manual permanece PENDENTE.
- `docs/evidence/slice-d10-final-packaging-clean-machine/CLEAN-MACHINE-TEST-RECORD.md`
  — nota de status atualizada (instalador regenerado, novo SHA256, first-run
  validado por automação; físico PENDENTE).

## Itens de first-run adicionados (manuais, PENDENTE)
```
[ ] Na primeira abertura, o banco foi criado automaticamente.
[ ] O usuário não precisou configurar banco.
[ ] O arquivo pesagens.db apareceu em userData/data.
[ ] A tela de manutenção mostrou banco OK.
```

## Status do teste físico
PENDENTE — não executado fisicamente. A execução do binário empacotado foi
bloqueada neste ambiente (antivírus/sandbox), então a confirmação real na UI
instalada continua sendo responsabilidade da Maike, em máquina limpa.
