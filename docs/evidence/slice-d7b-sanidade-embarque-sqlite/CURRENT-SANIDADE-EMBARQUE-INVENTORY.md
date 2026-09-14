# CURRENT-SANIDADE-EMBARQUE-INVENTORY

## Comando usado

```bash
rg -n "SanidadeAnimal|ConfiguracaoSanidade|ItemSanidade|Embarque|DocumentoEmbarque|db\.entities\.(SanidadeAnimal|ConfiguracaoSanidade|ItemSanidade|Embarque|DocumentoEmbarque)" src electron scripts package.json
```

## Entidades encontradas

| Entidade JSON | Tabela SQLite | Alias spec EN |
|---|---|---|
| ConfiguracaoSanidade | configuracoes_sanidade | health_configs |
| ItemSanidade | itens_sanidade | health_items |
| SanidadeAnimal | sanidades_animal | animal_health_events |
| Embarque | embarques | shipments |
| DocumentoEmbarque | documentos_embarque | shipment_documents |

**Nota:** `shipment_animals` do spec genérico **não** foi criada — animais embarcados vinculam-se via `weighing_entries.embarque_id` / `documento_embarque_id`.

## Arquivos / uso / risco

| entidade | arquivo | tela/componente | uso atual | CRUD/listagem | risco | migrar | observação |
|---|---|---|---|---|---|---|---|
| ConfiguracaoSanidade | GerenciarSanidades.jsx | Sanidade | CRUD config | CRUD | alto | sim | agora healthService |
| ItemSanidade | GerenciarSanidades.jsx | Sanidade | CRUD itens | CRUD | alto | sim | agora healthService |
| SanidadeAnimal | GerenciarSanidades.jsx / LancamentoPesagensIndividuais.jsx | Sanidade + lançamento | list/create/delete | CRUD | alto | sim | agora healthService |
| Embarque | GerenciarEmbarquesDialog.jsx | Embarque | CRUD | CRUD | alto | sim | agora shipmentService |
| DocumentoEmbarque | GerenciarEmbarquesDialog.jsx | Embarque | CRUD | CRUD | alto | sim | agora shipmentService |
| Embarque/Doc | ResumoEmbarque.jsx | resumo | props only | resumo | baixo | n/a | não acessa JSON |
| * | electron/db.cjs, legacyJsonStorage | legado | read/write JSON | backup | médio | não (preservar) | fonte legado |
| * | sanidadeEmbarqueLegacyMigration.cjs | migração | dry-run/apply | migração | baixo | sim | D.7B |

## Status antes

Todas as 5 entidades em `pesagens.json` via `db.entities.*`.

## Status depois

Telas operacionais usam `healthService` / `shipmentService` → IPC → repositories SQLite. JSON preservado como legado/backup.
