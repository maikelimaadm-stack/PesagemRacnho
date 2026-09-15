# S-00.0 — Rollback

A fatia altera apenas dois scripts de verificação. Não há dados, esquema, migração ou código de
produto envolvidos.

## Desfazer

```text
git revert 8c79022
```

ou, para voltar integralmente ao ponto de partida:

```text
git checkout v1.1.17-baseline
```

## Efeito do rollback

- `test:quick` volta a falhar em `ui:operational-customization:verify` e `ui:consistency:verify`
  (os testes voltam a exigir um contrato que o código não tem).
- Nenhum efeito sobre o aplicativo instalado, o banco IndexedDB ou backups.

## Quando não fazer rollback

Não reverter o gate para "consertar" uma tela que voltou a usar `GerenciarSaidasDialog`: a decisão
ADR-031 é remover o popup, não reintroduzi-lo.
