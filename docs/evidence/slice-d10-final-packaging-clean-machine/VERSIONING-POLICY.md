# VERSIONING-POLICY

## Formato
Versionamento semântico: **MAJOR.MINOR.PATCH** (ex.: 1.0.0).

- **PATCH** (1.0.x): correção de bug, ajuste de distribuição, doc — sem mudança
  de comportamento visível relevante.
- **MINOR** (1.x.0): nova funcionalidade compatível (nova tela, novo campo,
  novo relatório).
- **MAJOR** (x.0.0): mudança incompatível (formato de dados/migração que quebra
  compatibilidade, remoção de recurso).

## Versão atual
**1.0.0** — primeira release distribuível (ver CHANGELOG.md).

## Por que o D.10 não fez bump
D.10 adicionou apenas documentação (changelog, registros, política) e revalidou
os artefatos. **Nenhum código do app mudou.** Subir para 1.0.1 pularia o 1.0.0
sem que ele tivesse sido distribuído. Portanto 1.0.0 permanece.

## Procedimento para a próxima versão
1. Implementar a mudança (código) no slice correspondente.
2. Atualizar `version` em `package.json`.
3. Adicionar uma seção no topo do `CHANGELOG.md` com a nova versão e a data.
4. `npm run test` (test:full) → verde.
5. `npm run dist` → gera `release/Pesagens Individuais Setup <versão>.exe`.
6. Registrar evidência em `docs/evidence/slice-dXX-.../`.

## Observação sobre o instalador atual
O arquivo `release/Pesagens Individuais Setup 1.0.0.exe` é o artefato oficial de
1.0.0. Não foi rebuildado no D.10 porque o conteúdo empacotado é idêntico.
