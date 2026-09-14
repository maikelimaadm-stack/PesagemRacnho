# FINAL-STATUS — D.10.1

## Situação
Release candidate **1.0.0** formalmente empacotado e revalidado por automação.
Falta apenas a validação física em máquina limpa (responsabilidade da Maike).

## Validado automaticamente
- lint, build, test:quick, test:full (30 passos OK).
- installer:sqlite:verify, e2e:installed:verify, desktop:smoke:verify.
- data:preservation:verify (migração idempotente + backup/restore round-trip).
- docs:user:verify (8 documentos).
- Checksum SHA256 e manifesto da release gerados a partir do artefato real.
- Busca de conformidade: sem login/permissões/cloud/servidor; sem bridge legado;
  sem `db.entities` operacional.

## Depende de máquina limpa real (PENDENTE)
Instalar o Setup.exe do zero, abrir, criar pesagem, persistência entre
reaberturas, backup/CSV/JSON/integridade pela UI, reinstalação por cima,
restauração de backup. Registro assinável:
`docs/evidence/slice-d10-final-packaging-clean-machine/CLEAN-MACHINE-TEST-RECORD.md`.

## Decisões fixadas
- **Versão: 1.0.0** (primeira release; sem bump para 1.0.1).
- **Ícone: default do Electron** (sem asset de marca).
- **Code signing: pendente** (sem certificado) — SmartScreen pode alertar.
- **Instalador: não rebuildado** (sem mudança funcional).
- **Sem login, permissões, usuários/admin, cloud, servidor ou sync.**

## Entidades SQLite-only (confirmado pelas suítes)
PesagemIndividual, Apartacao, LoteApartacao, Sanidade, Embarque — todas
operando em SQLite; `db.entities` fora do fluxo operacional.

## Próximo passo recomendado
Maike executar o checklist de máquina limpa
(`docs/user/TESTE-MAQUINA-LIMPA.md`) e preencher o registro assinável **antes**
de qualquer novo slice funcional. Só depois disso criar
`docs/HANDOFF-CLAUDE-CODE.md`.
