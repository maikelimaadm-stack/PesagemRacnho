# RISK-NOTES (D.16)

## Riscos eliminados (para o usuário)
- "Banco SQLite não inicializado": impossível no fluxo operacional (não há SQLite
  no caminho do usuário).
- Módulo nativo/conexão no main no caminho do usuário: não usados operacionalmente.

## Riscos ainda existentes
- **Validação física da UI**: não consigo rodar o app instalado/Electron.
  lint+build+gates cobrem imports, contratos e comportamento Dexie em Node — não
  as telas renderizadas. Confirmação final = teste físico da Maike com o 1.1.0.
- **better-sqlite3 ainda empacotado** (legado): instalador ainda carrega o native
  e o main ainda inicializa SQLite (em try/catch, não-operacional). A superfície
  de antivírus não foi reduzida ainda; remoção é o próximo slice, com boot validado.
- **Migração de dados** de instalações SQLite antigas: não automática (foco em
  instalação nova). Backup/restore JSON cobre portabilidade.
- **Consultas**: Dexie usa índices (sem SQL/JOIN). As consultas do app são simples.
- Ícone default; sem code signing.

## Riscos aceitos
- better-sqlite3 legado mantido (justificado em SQLITE-DETACHMENT.md).
