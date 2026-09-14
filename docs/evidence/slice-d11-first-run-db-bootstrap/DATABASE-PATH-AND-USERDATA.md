# DATABASE-PATH-AND-USERDATA

## Caminho do banco
- **Packaged (instalado)**: `app.getPath('userData')/data/pesagens.db`
  → no Windows: `%APPDATA%\pesagens-individuais\data\pesagens.db`
- **Dev**: `<repo>/data/pesagens.db` (apenas desenvolvimento)

Definido em `electron/main.cjs`:
```js
const getDataDir = () =>
  isDev ? path.join(__dirname, '..', 'data')
        : path.join(app.getPath('userData'), 'data');
```

## Garantias
- O app **nunca** grava banco dentro de `Program Files` (usa `userData`).
- A pasta `data/` é criada automaticamente na primeira abertura.
- Nenhum `pesagens.db` "de fábrica" é empacotado como fonte principal; o
  instalador leva apenas código + migrations, e o banco é criado novo, local,
  na primeira abertura.

## Override test-only: PESAGENS_USER_DATA_DIR
Somente para testes automatizados. Se a variável de ambiente existir, o main
faz `app.setPath('userData', <valor>)` antes de resolver o `dataDir`:
```js
if (process.env.PESAGENS_USER_DATA_DIR) {
  app.setPath('userData', process.env.PESAGENS_USER_DATA_DIR);
}
```
Regras:
- Não é exposto na UI.
- Não é configuração para o usuário final.
- Serve para simular "máquina limpa" apontando o userData para uma pasta
  temporária vazia e verificar que o banco é criado do zero.
- Usado por `scripts/verify-first-run-database-bootstrap.mjs`
  (modo `FIRST_RUN_LAUNCH_PACKAGED=1`).
