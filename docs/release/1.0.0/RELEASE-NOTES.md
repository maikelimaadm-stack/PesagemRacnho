# Notas da versão 1.0.0

Pesagens Individuais — sistema desktop offline. Primeira versão distribuível.

## Inclui
- Sistema desktop offline.
- Banco local SQLite.
- Lançamento de pesagens individuais.
- Apartações.
- Sanidade.
- Embarques.
- Tela de backup e manutenção.
- Backup do banco.
- Backup completo.
- Exportação CSV/JSON.
- Importação JSON com validação.
- Restauração de backup.
- Verificação de integridade.
- Instalador Windows.

## Não inclui
- Login.
- Permissões.
- Usuários/admin.
- Cloud.
- Servidor.
- Sincronização online.
- Assinatura digital do instalador.

## Observações
- Os dados ficam em `%APPDATA%\pesagens-individuais\data\pesagens.db`.
- Atualizar ou reinstalar **não apaga** os dados do usuário.
- O instalador não é assinado; o Windows pode exibir aviso do SmartScreen
  ("Editor desconhecido"). Ver `docs/user/INSTALACAO-WINDOWS.md`.
- Ícone: default do Electron (pendência de asset de marca).
