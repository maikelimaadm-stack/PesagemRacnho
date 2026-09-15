# Checklist da release 1.1.3

## Automático

- [ ] lint
- [ ] build limpo
- [ ] suíte completa
- [ ] marcador presente em `dist`
- [ ] marcador presente no `app.asar`
- [ ] pacote 1.1.3 usa `loadFile(dist/index.html)`
- [ ] Setup 1.1.3 gerado pelo Electron Builder
- [ ] SHA256 gerado
- [ ] manifesto aponta para Setup 1.1.3
- [ ] `packaged:ui-build:verify` aprovado

## Manual em máquina real

- [ ] desinstalar a versão anterior;
- [ ] remover atalhos antigos;
- [ ] confirmar que não há processo antigo aberto;
- [ ] instalar `Pesagens Individuais Setup 1.1.3.exe`;
- [ ] abrir pelo novo atalho;
- [ ] confirmar versão 1.1.3 no diagnóstico;
- [ ] confirmar interface D.17D.2 / ModeloBase1;
- [ ] confirmar armazenamento IndexedDB local (Dexie);
- [ ] validar visualmente shell, sidebar, topbar e as três páginas.
