# LEGACY-OFFLINE-CLEANUP — Slice D.1

## Referências removidas

| Referência | Arquivo(s) |
|------------|------------|
| `const pendingPesagensDB = []` | `LancamentoPesagensIndividuais.jsx` |
| Merge pendentes + sincronizadas em `pesagensDia` | `LancamentoPesagensIndividuais.jsx` |
| `_numero_registro` prefixo `P` para pendentes | `LancamentoPesagensIndividuais.jsx` |
| `_offlineId` em key, className, badge | `LancamentoPesagensIndividuais.jsx` |
| `editingOfflineId` / `setEditingOfflineId` | `LancamentoPesagensIndividuais.jsx` |
| Prop `pendingPesagensDB` | `ResumoVendaDia.jsx`, `ResumoLotes.jsx` |
| Prop `pendingPesagens` | `ResumoEmbarque.jsx`, `GerenciarEmbarquesDialog.jsx` |
| Parâmetro `editingOfflineId` | `animalLookup.jsx` |
| Check `p._offlineId !== editingOfflineId` | `animalLookup.jsx` |
| Comentário "pendentes offline" | `GerenciarEmbarquesDialog.jsx` |

## Referências mantidas

| Referência | Motivo |
|------------|--------|
| `editingId` | Chave real de edição via `db.entities.PesagemIndividual.update(id, ...)` |
| `_numero_registro` (numérico) | Campo derivado em memória para exibição/ordenação na tabela; não persistido |
| `db.entities.*` | Camada de acesso atual ao JSON via IPC |
| Badge "Banco local" na UI | Indicador visual de modo desktop; sem relação com fila offline |

## Motivo

A fila offline (`pendingPesagensDB = []`) era resíduo da arquitetura Base44/indexedDB. Estava sempre vazia, mas mantinha código morto que:
- Referenciava variáveis inexistentes (`editingOfflineId`, `setEditingOfflineId`) causando erros de lint
- Exibia UI de "pendente" (badge P, linha amber) que nunca apareceria
- Complicava useMemos e props de componentes filhos sem benefício

## Impacto no fluxo de pesagem

- **Criar:** inalterado — grava via IPC → `pesagens.json`
- **Listar:** inalterado — apenas pesagens persistidas (como já era na prática)
- **Editar:** simplificado — usa só `editingId` (id do registro JSON)
- **Excluir:** inalterado
- **Persistência:** inalterada — `%APPDATA%/pesagens-individuais/data/pesagens.json` (prod) ou `./data/` (dev)

## Risco de regressão

**Baixo.** A fila offline estava hardcoded como array vazio; nenhum dado real era armazenado nela. Remoção é puramente de código morto.

## Como validar manualmente

1. Abrir app via Electron (`npm run electron:dev` ou instalador)
2. Criar lançamento de pesagem (Cadastro ou Manejo)
3. Verificar registro na tabela do dia
4. Editar registro — botão "Atualizar" deve funcionar
5. Excluir registro
6. Fechar e reabrir app — dados devem persistir em `pesagens.json`
7. Confirmar ausência de badge "P" e linhas amber (eram só para offline morto)

**Limitação:** Validação manual interativa não executada neste ambiente; validação via lint + build + revisão de código confirma integridade do fluxo IPC existente.
