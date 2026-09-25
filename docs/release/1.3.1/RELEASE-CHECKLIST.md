# Checklist da release 1.3.1

Versão 1.3.1 · esquema Dexie 8 · backup formato 3 · `signed=false`.

## 1. Versões e documentação
- [x] `package.json`, `package-lock.json` e `src/lib/appVersion.js` em 1.3.1.
- [x] `CHANGELOG.md` contém `## [1.3.1] — 2026-09-23`.
- [x] Notas e checklist próprios da versão 1.3.1.

## 2. Validação automatizada
- [x] Lint.
- [x] Build de produção.
- [x] Gate das ações em lote.
- [x] Permissões de pesagens e valores comerciais.
- [x] Consistência visual e definições dos relatórios.
- [x] Empacotamento, conferência do código no `app.asar` e smoke launch do executável empacotado.

## 3. Artefatos esperados
- [x] `release-unsigned/Pesagens Individuais Setup 1.3.1.exe`.
- [x] Arquivo `.sha256` e `release-manifest.json` referentes ao mesmo instalador.
- [x] Manifesto com `appVersion: 1.3.1`, `dbSchemaVersion: 8` e `signed: false`.

## 4. Teste físico — manual
1. Instalar sobre a versão anterior sem marcar remoção de dados.
2. Abrir a Relação de Pesagens e selecionar registros de Cadastro, Venda e Abate.
3. Conferir o menu no cabeçalho Ações e seus contadores por tipo.
4. Validar uma alteração em lote em uma cópia de segurança dos dados.
5. Fechar e abrir o aplicativo, confirmando a persistência.
