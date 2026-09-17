# 23 — Modelo de grão do relatório

## Princípio

Cada relatório declara **um único grão**: o que é uma linha. Métricas de outro grão só entram como agregados
calculados a partir da população do grão declarado. **Não existe um dataset único para todos os relatórios.**

Exemplo com um animal que tem 8 pesagens no período:

| Relatório | Grão | Linhas desse animal |
|---|---|---|
| Pesagens por período | `event` | 8 |
| Inventário do rebanho | `animal_current` | 1 |
| Desempenho por animal | `animal_period` | 1 (agregando as 8) |
| Fechamento de sessão | `session` | as pesagens daquela sessão entram como detalhe; 1 linha de resumo por sessão |

## Grãos suportados pelos dados atuais

| Grão | Linha = | Fonte primária | Pré-filtro indexado | Chave de unicidade | Uso |
|---|---|---|---|---|---|
| `event` | uma pesagem (Cadastro, Manejo, Saída) | `pesagens` + payload | `data_pesagem`, `animal_id`, `lote_id`, `sessao_id`, `tipo_pesagem` | `pesagens.id` (linha ativa mais recente) | relação, pendências, saídas, conferência |
| `animal_current` | um animal no estado atual | `animais` (projeção) | `situacao`, `marca_id`, `raca_id`, `categoria_id`, `lote_atual_id`, `ultima_pesagem_data` | `animais.id` | inventário, rebanho por dimensão, faixa de peso, pesagem vencida |
| `animal_period` | um animal dentro de um período | `pesagens` do período agregadas por `animal_id` (+ `animais` para dimensões atuais) | `data_pesagem` | `animal_id` | desempenho, GMD, ganho, perda de peso |
| `session` | uma sessão de pesagem | `sessoesPesagem` + `pesagens` por `sessao_id` | `sessoesPesagem.data`, `pesagens.sessao_id` | `sessoesPesagem.id` | fechamento/resumo de sessão |
| `lot` | um lote | `loteApartacoes` + `animais.lote_atual_id` (atual) ou `animalLotes` (por data) | `animais.lote_atual_id`, `animalLotes.lote_id` | `loteApartacoes.id` | inventário por lote, ocupação |
| `lot_stay` | uma permanência animal×lote | `animalLotes` | `animal_id`, `lote_id`, `inicio` | `animalLotes.id` (ativo) | movimentação entre lotes |
| `exit` | uma saída definitiva | `pesagens` com `tipo_pesagem = Saída` | `tipo_pesagem`, `data_pesagem` | `pesagens.id` | mortalidade, vendas, abates |
| `shipment_document` | um documento de embarque | `documentosEmbarque` + Saídas por `documento_embarque_id` | `embarque_id` (documentos) | `documentosEmbarque.id` | romaneio, previsto × realizado |
| `audit_entry` | um registro de auditoria | `auditoria` | `entidade`, `acao`, `usuario_id`, `created_at` | `auditoria.id` | auditoria |
| `data_issue` | uma inconsistência | `logicalIntegrity` (`health.js`) | — | tipo + id | qualidade dos dados |

Grãos **não suportados**: `operation` (não existe `operacoesComerciais`), `movement` confiável
(`movimentosAnimais` não acompanha edição/exclusão — usar `event` + `lot_stay`), `identifier` (sem gravador de faixas).

## Regras obrigatórias

1. **Animais únicos nunca somam entre grupos**; o total recalcula `countDistinct` sobre a população.
2. **Peso total de eventos não é estoque**: estoque de peso vem de `animal_current`.
3. `animal_period` exige declarar o critério de entrada (ter ≥1 pesagem no período? ter Cadastro antes do fim?).
4. Dimensão **atual** (do animal) e **histórica** (do evento) são colunas distintas.
5. A definição do relatório guarda o grão; o motor recusa colunas e métricas incompatíveis com ele.
