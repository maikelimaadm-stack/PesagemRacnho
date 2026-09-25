# Checklist da release 1.3.2

Versão 1.3.2 · esquema Dexie 8 · backup formato 3 · `signed=false`.

## Versão
- [x] `package.json`, `package-lock.json` e `src/lib/appVersion.js` em 1.3.2.
- [x] Versão visível na barra superior desktop e móvel.
- [x] Título da janela usa `app.getVersion()`.
- [x] Changelog e notas da versão 1.3.2.

## Validações automatizadas
- [x] Contrato único de versão.
- [x] Shell e título nativo.
- [x] Lint e build de produção.
- [x] Conteúdo do `app.asar`, manifesto e SHA-256.
- [x] Smoke launch do executável empacotado em perfil isolado.

## Teste manual de atualização
1. Fechar todas as janelas e processos da versão 1.3.0.
2. Executar `Pesagens Individuais Setup 1.3.2.exe`.
3. Confirmar **v1.3.2** na barra superior e **Pesagens Individuais 1.3.2** no título da janela.
4. Confirmar versão 1.3.2 em Aplicativos instalados do Windows.
5. Conferir a permanência dos dados locais.
