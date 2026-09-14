# RELEASE-NOTES-AND-CHECKLIST

## Documentos oficiais da release
- `docs/release/1.0.0/RELEASE-NOTES.md` — o que a versão 1.0.0 inclui e o que
  não inclui (em português simples).
- `docs/release/1.0.0/RELEASE-CHECKLIST.md` — checklist separando itens
  automáticos e manuais.
- `CHANGELOG.md` — histórico de versões (ancorado em 1.0.0).

## Estado do checklist (2026-07-16)

### Automático — TODOS marcados (execução real)
lint, build, test, test:quick, test:full, instalador validado (sem rebuild),
checksum, manifesto, installer:sqlite:verify, e2e:installed:verify,
desktop:smoke:verify, data:preservation:verify, docs:user:verify.

### Manual — PENDENTE
Instalação em máquina limpa, uso real, persistência, backup, exportações,
integridade, restauração, reinstalação por cima. **Não marcados** porque não
foram executados fisicamente.

## Honestidade
Nenhum item manual foi marcado como aprovado. O registro assinável está em
`docs/evidence/slice-d10-final-packaging-clean-machine/CLEAN-MACHINE-TEST-RECORD.md`
e o roteiro em `docs/user/TESTE-MAQUINA-LIMPA.md`.
