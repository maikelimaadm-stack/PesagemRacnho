# Checklist da release 1.1.2

## Automático (execução real)
- [x] lint / build
- [x] main:boot:verify (main process sobe e registra IPCs)
- [x] preload:contract:verify (NOVO — renderer só usa APIs que o preload expõe)
- [x] storage:all:verify (8 gates Dexie)
- [x] weighing:mapper / maintenance:ui / maintenance:dialog / desktop:smoke
- [x] packaged:source:verify (pacote sem better-sqlite3)
- [x] e2e:installed:verify (sem módulo nativo)
- [x] docs:user:verify
- [x] **Verificação visual no navegador**: telas Lançamento e Manutenção
      renderizam; pesagem criada e **persistiu após recarregar**; Manutenção
      mostrou "Status: OK / Pesagens: 1 / Banco íntegro."
- [x] instalador Setup 1.1.2.exe + checksum + manifesto

## Manual (máquina real — Maike)
- [ ] PENDENTE — instalar o Setup 1.1.2 (desinstalar anteriores)
- [ ] PENDENTE — abrir: deve entrar direto no sistema (sem tela de erro)
- [ ] PENDENTE — Manutenção → confirmar Versão 1.1.2
- [ ] PENDENTE — backup do banco ANTES de criar pesagem
- [ ] PENDENTE — criar pesagem → fechar → reabrir → dados salvos
- [ ] PENDENTE — exportar CSV/JSON, restaurar backup
