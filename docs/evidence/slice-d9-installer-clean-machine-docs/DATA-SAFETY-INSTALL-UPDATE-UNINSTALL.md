# DATA-SAFETY-INSTALL-UPDATE-UNINSTALL

## Local do banco
Produção: `app.getPath('userData')/data` → tipicamente  
`%APPDATA%\pesagens-individuais\data\pesagens.db`

Dev: `{repo}/data`

## Local dos backups
`{dataDir}/backups/sqlite/` e `{dataDir}/backups/full/`

## Instalação
NSIS per-user (`perMachine: false`). App em pasta escolhida pelo usuário; dados **fora** de Program Files.

## Atualização
Instalar Setup novo por cima. userData permanece → `pesagens.db`, JSON legado, backups e exportações preservados.

## Reinstalação
Mesmo comportamento: dados em AppData não são apagados pelo instalador.

## Desinstalação
`deleteAppDataOnUninstall: false` — desinstalar o programa **não** remove userData automaticamente.

## Risco de apagar dados
Baixo no fluxo padrão. Risco se o usuário apagar manualmente `%APPDATA%\pesagens-individuais`.

## Mitigação
Tela Manutenção (backup/export); docs usuário; checklist máquina limpa.

## Limitações
Desinstalação real não executada automaticamente neste ambiente — checklist manual cobre o passo.
