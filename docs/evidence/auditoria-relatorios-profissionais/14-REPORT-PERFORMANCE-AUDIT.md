# 14 — Performance dos relatórios

## 1. Medições existentes (não refeitas nesta auditoria)

| Fonte | listEntries | índice por animal | abrir Lançamento | salvar | recarregar | período 30d |
|---|---|---|---|---|---|---|
| phase-01, node, v7, 36k | 551 ms | 2.260 ms | 2.866 ms (orçamento 1.000) | 264 ms (orçamento 250, **estourado**) | 502 ms | 91 ms |
| phase-00, node, 250k | 6.446 ms | 15.528 ms | — | 1.411 ms | — | 1.122 ms |
| navegador, 36k | 560 ms | 883 ms | — | — | — | 72 ms |

Valores p95. **Não existe medição v7 com 250k nem medição 250k no navegador.** F1 de performance ficou parcial:
sem cache de projeção de animal e sem paginação de consulta.

Leituras atuais relevantes:
- `listEntries` lê **todas** as pesagens (`toArray`) e converte payload — usado por Relação, Lançamento, Fechamento, Ficha e diálogo de apartações.
- `genericRepository.list` é sempre `toArray` + filtro.
- N+1 em `bulkUpdate`/`bulkDelete`/`bulkCreate`, contagem de uso de cadastros e `CadastroAuxiliarPage.countUsage`.
- `FichaAnimal.jsx:39` quadrático (`catalog.animais.find` por animal).
- **Consulta por período indexada (`listByPeriodo`) é 6× mais rápida que ler tudo (91 × 551 ms) e não é usada pela UI.**

## 2. Análise por relatório

Massas: **P** = pequena (≤5k eventos), **M** = 36k eventos/12k animais, **G** = 250k eventos/62,5k animais.

| Relatório | Fonte | Índice | Filtros indexáveis | Joins | Agregação | Quantidade (P/M/G) | Memória | Paginação | Streaming/chunk | Cache |
|---|---|---|---|---|---|---|---|---|---|---|
| B1 Pesagens por período | pesagens | `data_pesagem` | período, (animal, lote, sessão, tipo como alternativa) | mapas id→nome de cadastros (pequenos) | 1 passada | período típico: 0,3k / 3k / 20k linhas | linhas do período | **SIM** na tela (virtualizar) | não na consulta; chunk na exportação ≥20k | NÃO |
| B2 Por sessão | pesagens | `sessao_id` | sessão | sessoesPesagem | 1 passada | ~100–500 / sessão | baixa | NÃO | NÃO | NÃO |
| A1–A5 Rebanho atual | animais | `situacao`/`lote_atual_id`/`ultima_pesagem_data` | situação, marca, raça, categoria, lote | cadastros | 1 passada | 2k / 12k / 62,5k | ~12 MB em G | SIM na tela | NÃO | NÃO |
| C1–C3 Desempenho | pesagens | `data_pesagem` | período | animais (map) | group by animal + ordenação por data | M: ~3k animais | eventos do período agrupados | SIM | NÃO | NÃO |
| C2 período longo (1 ano, G) | pesagens | `data_pesagem` | período | animais | idem | até 250k eventos | **alta** (~100–150 MB estimados com payload) | SIM | **SIM** (percorrer em blocos com `each`/`offset`, agregando incrementalmente) | NÃO |
| D1 Entradas/saídas | pesagens | `data_pesagem` (+ filtro tipo em memória) | período | — | contagem | baixa | baixa | NÃO | NÃO | NÃO |
| D2 Mudanças de lote | animalLotes | `inicio`/`lote_id` | lote | loteApartacoes | 1 passada | 15k em G | baixa | SIM | NÃO | NÃO |
| E1–E2 Saídas/mortes | pesagens | `tipo_pesagem` ou `data_pesagem` | tipo **ou** período (sem composto) | — | group by motivo | baixa | baixa | NÃO | NÃO | NÃO |
| F1–F3 Comercial | pesagens | `data_pesagem` | período | — | somas ponderadas | baixa | baixa | NÃO | NÃO | NÃO |
| G1–G3 Embarques | documentosEmbarque + pesagens | `tipo_pesagem` (Saídas) | — | documento→Saídas em memória | contagem | baixa | média (todas as Saídas) | NÃO | NÃO | NÃO |
| H1 Fechamento | pesagens | hoje `toArray`; deveria ser `data_pesagem` | data | lotes/apartações | várias | 1 dia | baixa | NÃO | NÃO | NÃO |
| H2 Auditoria | auditoria | `created_at`/`entidade`/`usuario_id` | período, entidade, usuário | — | — | **maior store em bytes** | alta se sem período | **SIM obrigatório** | SIM na exportação | NÃO |
| H3 Qualidade | várias | — | — | muitos | — | varre tudo | alta em G | SIM | SIM | NÃO |

## 3. Conclusões

1. **O maior ganho é usar o índice de período** — é a regra para todo relatório de grão `event`/`animal_period`.
   Período obrigatório (com padrão) para B, C, D, E, F, H2.
2. Estado atual deve ler `animais`, **nunca** reconstruir a partir de `pesagens`.
3. `[data_pesagem+tipo_pesagem]` ajudaria E/F em G, mas **não é necessário na primeira onda** (período + filtro em memória basta).
4. **Cache: NÃO** em nenhuma fatia inicial. Justificativa: dados locais, invalidação complexa (recálculo em cascata),
   e o custo dominante é leitura sem índice — resolvido pelo pré-filtro.
5. Paginação é de **apresentação** (virtualização/“mostrar mais”), não de consulta; exportação percorre tudo em blocos.
6. Orçamentos propostos para gates futuros (navegador, massa M): período de 30 dias ≤ 300 ms p95 até a tabela;
   rebanho atual ≤ 500 ms; exportação CSV de 36k linhas ≤ 3 s sem travar a UI.
7. **Risco aberto**: nenhuma medição v7 em 250k; medir antes de liberar relatórios de período longo (R5).
