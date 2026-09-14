# 04 — Auditoria de Desktop e Empacotamento

## Respostas diretas

| # | Pergunta | Resposta |
|---|----------|----------|
| 1 | Projeto é apenas web? | ❌ — Electron configurado |
| 2 | Desktop shell existe? | ✅ `electron/main.cjs` + preload |
| 3 | O que falta para app instalável? | Distribuição limpa, ícone, dados userData testados, remover scripts dev |
| 4 | Decisões pendentes | SQLite definitivo, auto-update, ícone, assinatura code signing |
| 5 | Menor slice seguro | Finalizar NSIS + userData + remover .bat/.vbs da distribuição |

---

## Configuração Electron existente

### main.cjs
- `BrowserWindow` 1440×900, menu oculto
- `contextIsolation: true`, `nodeIntegration: false`
- `preload.cjs` expõe `window.pesagemApp`
- Dev: `http://localhost:5173`
- Prod: `file://.../dist/index.html` + HashRouter
- Bloqueia navegação externa (`will-navigate`)
- Bloqueia `window.open`

### Diretório de dados
```javascript
// Dev
path.join(__dirname, '..', 'data')
// Produção
path.join(app.getPath('userData'), 'data')
```
✅ Padrão correto para desktop — dados sobrevivem a updates do app.

---

## electron-builder (package.json → build)

| Config | Valor |
|--------|-------|
| appId | `com.pesagens.individuais` |
| productName | Pesagens Individuais |
| output | `release/` |
| target Windows | NSIS x64 |
| oneClick | true |
| desktop shortcut | ✅ createDesktopShortcut |
| start menu | ✅ createStartMenuShortcut |
| idioma instalador | pt_BR (1046) |

### Artefatos gerados (evidência)

```
release/Pesagens Individuais Setup 1.0.0.exe   (~87 MB)
release/win-unpacked/Pesagens Individuais.exe  (~192 MB)
```

**Instalador funcional já existe** — falta processo de distribuição e polish.

---

## Lacunas de desktop

| Item | Status |
|------|--------|
| Ícone customizado (.ico) | ❌ Usa padrão Electron |
| Code signing | ❌ `signAndEditExecutable: false` |
| Auto-update | ❌ |
| Logs locais / crash reporter | ❌ |
| Single instance lock | ❌ — duas instâncias podem escrever no mesmo JSON |
| Backup automático | ❌ |
| Desinstalador preserva dados | ⚠️ Não documentado/testado |
| macOS / Linux | ❌ Não configurado |

---

## Scripts de desenvolvimento expostos (não para usuário final)

```
iniciar-pesagens.bat / .vbs
abrir-banco.bat / .vbs
scripts/init-db.cjs
```

**Problema:** Usuário vê pasta de projeto com código — **não parece aplicativo profissional**.

**Solução:** Distribuir **apenas** `Pesagens Individuais Setup X.X.X.exe`. Manter scripts em branch dev ou pasta `dev/`.

---

## Caminho Windows

✅ **Pronto parcialmente** — NSIS gera instalador com atalho desktop.

### Checklist antes de distribuir

- [ ] Testar instalação em máquina limpa (sem Node.js)
- [ ] Verificar criação de `pesagens.json` em `%APPDATA%`
- [ ] Testar reinstalação sobre versão anterior (dados preservados)
- [ ] Testar desinstalação
- [ ] Adicionar ícone
- [ ] Remover referências a SQLite nos textos (DbBootstrap)

---

## Caminho futuro macOS/Linux

| Plataforma | Electron | Tauri |
|------------|----------|-------|
| Windows | ✅ Configurado | Possível |
| macOS | ⚠️ Adicionar target dmg/zip | Possível |
| Linux | ⚠️ Adicionar AppImage/deb | Possível |

**Recomendação:** Completar Windows primeiro; Electron já está 80% pronto.

---

## Compatibilidade futura (hardware)

| Recurso | Electron | Web/PWA |
|---------|----------|---------|
| Balança serial/USB | ✅ Main process + node serialport | ❌ Limitado |
| Impressora | ✅ | ❌ |
| Export CSV/XLSX | ✅ | ⚠️ |
| Backup arquivo | ✅ | ❌ |

---

## Menor slice seguro (desktop)

**Slice D.7 parcial:** Testar instalador NSIS em VM limpa + single-instance lock + ícone — **sem mudar UI de pesagem**.
