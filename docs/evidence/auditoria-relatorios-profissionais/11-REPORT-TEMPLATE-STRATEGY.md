# 11 — Estratégia de modelos de relatório

## 1. Três níveis de modelo

| Modelo | O que é | Quem define | Pode mudar | Persistência |
|---|---|---|---|---|
| **Modelo 1 — Padrão (sistema)** | Definição em código: grão, fonte, colunas permitidas, colunas padrão, filtros obrigatórios, agrupamentos permitidos, métricas, permissões | desenvolvimento | não (versionado com o app) | código (`reportDefinitions`) |
| **Modelo 2 — Personalizado do usuário** | Ajustes sobre um Modelo 1: colunas visíveis/ordem, filtros, agrupamento (até 3 níveis), ordenação, subtotais, orientação da página | o usuário | sim | serializado (ver §3) |
| **Modelo 3 — Compartilhado da empresa** | Modelo 2 publicado para todos os perfis autorizados | ADMIN/GESTOR (`reports.templates.share`) | só quem publicou/ADMIN | serializado |

Um modelo **nunca** contém código, fórmula livre, SQL ou expressão; só referências a ids declarados no Modelo 1.

## 2. Forma serializada

```json
{
  "schema": 1,
  "id": "uuid",
  "report_id": "pesagens.periodo",
  "report_version": 1,
  "nome": "Pesagens do mês por lote",
  "escopo": "usuario | empresa",
  "owner_user_id": "…",
  "empresa_id": "local",
  "periodo": { "tipo": "relativo", "preset": "mes_atual" },
  "filtros": [{ "columnId": "tipo_pesagem", "operator": "in", "values": ["Manejo"] }],
  "colunas": ["data_pesagem", "animal", "lote", "peso_kg", "gmd"],
  "agrupamento": ["lote_id"],
  "ordenacao": [{ "columnId": "data_pesagem", "dir": "asc" }],
  "subtotais": { "metricas": ["count", "peso_kg.avg", "gmd.weighted"] },
  "pagina": { "orientacao": "paisagem" },
  "created_at": "…", "updated_at": "…"
}
```

Validação ao abrir: coluna/filtro/métrica desconhecida ou não autorizada é **removida com aviso**; `report_version`
maior que a do app → modelo abre só leitura.

## 3. Persistência: `appSettings` × store `reportTemplates`

| Critério | `appSettings` (chave `report-templates:<empresa>`) | Nova store `reportTemplates` |
|---|---|---|
| Schema | **sem mudança** (padrão já usado por `resumo-personalizado:<empresa>`) | exige Dexie v8 + migração + backup format |
| Backup/restauração | já coberto | incluir na lista de stores do backup e gates |
| Consulta | ler 1 documento e filtrar em memória | índices `report_id`, `owner_user_id`, `escopo` |
| Volume esperado | dezenas de modelos | idem |
| Concorrência | último grava vence no documento inteiro (monousuário local: aceitável) | por registro |
| Auditoria | `appSettings` não audita | pode auditar |
| Custo | baixo | médio |

**Recomendação: `appSettings`**, uma chave por empresa contendo a lista de modelos (ou uma chave por escopo:
`report-templates:<empresa>:empresa` e `report-templates:<empresa>:user:<id>`).
**Justificativa para NÃO criar store agora**: volume de dezenas, sem necessidade de índice, sem schema, backup já
coberto, padrão idêntico ao `ResumoPersonalizado`. Reavaliar store própria somente se houver mais de ~200 modelos,
necessidade de auditoria por modelo ou multiusuário concorrente.

## 4. Regras

1. Período relativo é gravado como **preset**; resolvido em datas na emissão e registrado no manifesto.
2. Modelo não salva dados, só a definição. **Sem cache de resultado.**
3. Excluir modelo compartilhado exige confirmação; modelos do usuário excluído permanecem visíveis para ADMIN.
4. O antigo `resumo-personalizado:<empresa>` pode ser convertido em Modelo 2 numa fatia futura (não obrigatório).
