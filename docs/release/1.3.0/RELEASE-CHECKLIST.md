# Checklist da release 1.3.0 (RC1)

Versão 1.3.0 · esquema Dexie 8 · backup formato 3 · `signed=false` (sem Authenticode).
Política: `docs/arquitetura-produto/13-VERSIONAMENTO-RELEASE.md` (ADR-039). Item automatizado só é
marcado com o comando executado nesta árvore; item manual fica **MANUAL PENDENTE** até o teste físico.

## 1. Versões e documentos
- [ ] `package.json`, `package-lock.json` (inclusive `packages[""]`) e fallback de `src/lib/appVersion.js` em 1.3.0
- [ ] `versionInfo.js`: `DB_SCHEMA_VERSION = 8`, `BACKUP_FORMAT_VERSION = 3`, `DATA_BUILD_ID = 'schema-v8'`
- [ ] `CHANGELOG.md` com `## [1.3.0] — 2026-09-17`, sem bloco "Não lançado"
- [ ] `RELEASE-NOTES.md` desta pasta e `RC1.md` com SHA-256 do Setup e do `app.asar`

## 2. Gates automatizados
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run test:quick`
- [ ] `npm run dist:unsigned` (checksum, manifesto, `packaged:source`, `packaged:build`)
- [ ] Manifesto: `appVersion 1.3.0`, `dbSchemaVersion 8`, `backupFormatVersion 3`, `signed false`

## 3. Artefatos
- [ ] `release-unsigned/Pesagens Individuais Setup 1.3.0.exe` + `.sha256` + `release-manifest.json`
- [ ] Artefatos 1.2.0-rc1 arquivados em `release-archive/1.2.0-rc1/` (não sobrescritos)
- [ ] Tag `v1.3.0-rc1` (não criar `v1.3.0` sem o teste físico)

## 4. Teste físico em máquina limpa — MANUAL PENDENTE
1. Instalar `Pesagens Individuais Setup 1.3.0.exe` sobre a 1.2.0-rc1 com dados (ou restaurar um backup 1.2.0).
2. Abrir: a atualização do banco 7 → 8 conclui; Manutenção mostra esquema 8 e o backup pré-migração.
3. Conferir contagens de pesagens, animais e cadastros iguais às de antes.
4. Sanidade › Programas: cadastrar "Vermifugação"; Medicamentos: "Produto X", dose 10 ml, via SC.
5. Lançamento › Cadastro: escolher marca, raça, sexo, categoria manual e apartação; lançar 3 animais.
   Após cada salvar, contexto permanece; identificação, peso e observação limpam.
6. No 1º animal, abrir Sanidade, adicionar a aplicação e marcar "Aplicar aos próximos"; salvar os 3.
   Sanidade › Aplicações mostra 3 aplicações, uma por animal, com o usuário logado.
7. Manejo: lançar 2 animais com a mesma apartação; contexto permanece; ganho/GMD calculados.
8. Saída: motivo Venda + embarque; lançar 2 animais; motivo e embarque permanecem; valores limpam.
9. Ficha do animal mostra o histórico de pesagens e de sanidade.
10. Relação › Mais opções › Baixar modelo CSV: só Data, NumeroAnimal, Marca, Sexo, Raça, Categoria, Peso, Apartação, Lote, Observação.
11. Relação › Exportar relatório (CSV) e Exportar para reimportação (CSV): abrir no Excel, acentos e colunas corretos, vazio não vira 0.
12. Manutenção: backup completo; restaurar esse backup; dados e sanidade preservados.
13. Limpar dados operacionais: aplicações somem, programas e medicamentos ficam.
14. Login com OPERADOR: lança e aplica sanidade; não edita programas/medicamentos; não exporta.
15. Fechar e abrir: contexto do Lançamento da sessão anterior não traz dados de animal.
