# Notas da versão 1.1.0

Pesagens Individuais — sistema desktop offline. Mudança de armazenamento.

## Mudança principal
- Banco operacional alterado para **IndexedDB/Dexie** (armazenamento local do
  sistema, embutido no app).
- Removida a dependência **operacional** de SQLite nativo — o app não exige
  instalação nem configuração de banco.
- Backup, exportação (CSV/JSON), importação e restauração agora usam o
  armazenamento local (Dexie).
- Corrige o problema físico "Banco SQLite não inicializado": não há mais SQLite
  no fluxo do usuário.
- A tela de Manutenção mostra: Versão 1.1.0, Armazenamento local, contagens,
  backup completo, exportações, importação (com análise) e restauração.

## Não inclui
- login
- permissões
- usuários/admin
- cloud
- servidor
- sincronização online

## Importante
- Use SOMENTE `Pesagens Individuais Setup 1.1.0.exe`.
- Na tela de Manutenção, confirme **Versão: 1.1.0** e "Armazenamento: IndexedDB local".
- Dados de versões SQLite anteriores não são migrados automaticamente (ver
  restauração por backup, se você tiver um export/backup).
