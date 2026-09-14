# WEIGHING-MAPPER — Slice D.4

## Campos de entrada (UI)
`data_pesagem`, `peso`, `numero_animal`, `sexo`, `raca`, `era`, `marca`, `tipo_manejo`, `lote_id`, `apartacao_id`, campos compra/venda/abate, etc.

## Campos SQLite (weighing_entries)
`id`, `data_pesagem`, `peso_kg`, `lote_id`, `animal_id`, `tipo_pesagem`, `observacao`, `legacy_payload`

## Campos ViewModel (UI)
Mesmos nomes que a tela já usa: `peso`, `data_pesagem`, `numero_animal`, `created_date`, `updated_date`, + `__source`

## Aliases suportados
| Alias | Campo canônico |
|-------|----------------|
| dataPesagem, data | data_pesagem |
| pesoKg, peso | peso_kg |
| loteId | lote_id |
| animalId | animal_id |
| tipo_manejo, tipo | tipo_pesagem |
| observação, obs | observacao |

## Campos preservados em legacy_payload
Snapshot completo do payload UI (todos os campos do formulário), exceto `__source`.

## Validações
- data obrigatória (create)
- peso numérico > 0
- id consistente (tipo)

## Limitações
- `animal_id` não populado automaticamente (D.5+)
- Filtro `empresa_id` pós-merge client-side
