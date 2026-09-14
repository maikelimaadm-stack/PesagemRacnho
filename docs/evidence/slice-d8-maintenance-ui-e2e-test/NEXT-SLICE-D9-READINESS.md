# NEXT-SLICE-D9-READINESS

## Estado após D.8
Produto desktop utilizável offline: entidades operacionais em SQLite, manutenção na UI, instalador com native module, `npm run test` verde.

## O que está pronto para uso real
- Pesagens / apartações / sanidade / embarque SQLite-only
- Backup, export, import (dry-run), restore (confirm), integrity
- Setup.exe gerado

## O que ainda falta
- Polimento instalador (ícone, atalho, nome)
- Teste em máquina limpa
- Documentação simples para usuário final
- Remoção física do stub legado e limpeza de `db.cjs` se seguro

## Recomendação D.9
**Slice D.9 — Polimento do instalador, teste em máquina limpa, documentação simples para usuário e remoção final de legado inativo.**

## Possíveis próximos focos
- polimento do instalador
- ícone/nome/atalho
- teste em máquina limpa
- documentação simples para usuário
- remoção final de código legado
