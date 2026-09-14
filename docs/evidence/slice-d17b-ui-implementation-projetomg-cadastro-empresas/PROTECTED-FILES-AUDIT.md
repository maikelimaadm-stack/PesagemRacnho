# Auditoria de arquivos protegidos

Hashes agregados SHA-256 calculados sobre caminho relativo + hash individual, antes da auditoria final e repetidos após a suíte final.

| Grupo | Arquivos | Antes | Depois | Resultado |
|---|---:|---|---|---|
| `electron/**` | 7 | `8902CCC000CDC1C1AF09C7E1087D9C0BCEEAE94693EA242E7E7F0C6D17729164` | igual | intacto |
| `src/storage/**`, `src/api/db.js`, `DbBootstrap.jsx` | 9 | `B5F2E59EF1DAECEEF138D4D38E34C5490849EC456EADDE982D8131BDEDD1ABBF` | igual | intacto |
| `src/modules/**` | 14 | `B7E7520A5B33D246241C4DCAFA3A39E6AF07B5FC3B76475FE57FFA816C78CC72` | igual | intacto |
| `package.json`, `package-lock.json` | 2 | `47417B967C935DBFCFEC50F34E7BFB601CD90BECBF6C0DBCCF3F2C67CEE3DB29` | igual | intacto |

Não existem `data/**`, `schemas/**` ou `migrations/**` ativos alterados pelo slice. A busca final não encontrou import absoluto do PROJETOMG, CDN, Google Fonts, TODO/FIXME novo, handler vazio ou harness esquecido no alvo.

As ocorrências `Sqlite` em nomes legados da UI de Manutenção foram classificadas como nomenclatura de compatibilidade preexistente: `storage:sqlite-detached:verify` confirmou 0 offenders operacionais e a tela apresenta IndexedDB/Dexie.
