# Validação responsiva

| Viewport | Rotas/estados | Resultado |
|---|---|---|
| 1440 × 900 | lista, filtro, lançamento, manutenção, três dialogs, produção | aprovado |
| 1366 × 768 | lista e shell; documento `scrollWidth = clientWidth = 1366` | aprovado |
| 390 × 844 | lista, filtros, menu, lançamento e manutenção | aprovado |

## Comportamento

- Desktop: header fixo, sidebar 220 px recolhível, conteúdo fluido e tabelas com scroll interno.
- Mobile: header 48 px, bottom nav 56 px, drawer de navegação e drawer de filtros com backdrop.
- KPIs viram trilho horizontal; formulários viram uma coluna; dialogs respeitam `100dvh`.
- Targets móveis em action bars/dialogs têm 36 px; foco permanece visível.
- Não foi observado overflow horizontal do documento em 1366 ou na build final 1440. A tabela ampla mantém overflow próprio por necessidade de domínio.
