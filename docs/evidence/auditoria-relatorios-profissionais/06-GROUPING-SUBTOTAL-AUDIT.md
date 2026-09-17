# 06 — Agrupamento e subtotais

## 1. Respostas

| Pergunta | Resposta | Evidência |
|---|---|---|
| Existe `groupBy` genérico? | **Não.** Só um agrupamento de 1 nível dentro de `ResumoPersonalizado`, restrito a 6 campos fixos | `ResumoPersonalizado.jsx:36-37`; `ConfigurarResumosDialog.jsx:30-34` |
| Existe subtotal? | Só no Personalizado: linha da métrica = total, linhas de grupo = subtotais; vazio vira “Não informado”; **sem ordenação** | `ResumoPersonalizado.jsx:37-42` |
| Subtotal hierárquico? | **Não** | — |
| Collapse/expand? | **Não** (só o toggle “mostrar média por marca”) | `PesagensResumoRodape.jsx:67-93` |
| Ordenação por grupo? | Não genérica: marcas por nome (rodapé), por contagem (Fechamento), lotes por nome (`ResumoLotes`) | `PesagensResumoRodape.jsx:21`; `FechamentoDia.jsx:112`; `ResumoLotes.jsx:25` |
| Total geral? | Só em cartões: `ResumoLotes` (`:68`), `ResumoEmbarque` (`:31-38,74`), Fechamento “Peso total do dia” (`:192`) | — |

## 2. Agrupamentos implícitos (escritos à mão, não reutilizáveis)

| Dimensão | Onde |
|---|---|
| Data | `pesagensDia` (`Lancamento…jsx:571-574`), Fechamento (`:66`), `ResumoVendaDia` (`:9`), escopo `dia` do Personalizado |
| Animal | `weighingSeries.js:11-18`, `FichaAnimal.jsx:26-34`, Relação `:361-367`, `animalHistory.getRegisteredAnimals` (`:22-90`) |
| Documento | `doc_qtd` (Relação, sobre tudo) × `docCountsDia` (Lançamento, sobre o dia filtrado) — **mesma dimensão, populações diferentes** |
| Lote | `ResumoLotes`, Fechamento |
| Marca | rodapé do Lançamento, Fechamento |
| Apartação | filtro do Fechamento, escopo do Personalizado |
| Sexo | contagens M/F |

## 3. O que faltaria para os agrupamentos pedidos

| Hierarquia pedida | Dados | Viável agora? |
|---|---|---|
| Marca → Raça → Categoria → Lote | marca/raça/categoria têm id no animal e no payload (`marca_id`, `raca_id`, `categoria_id`); lote tem `lote_id` na pesagem | **sim**, grão evento ou animal; categoria só confiável após 16/09 (registros antigos: `null`) |
| Apartação → Lote | `apartacao_id` no payload e `loteApartacoes.apartacao_id` | **sim** |
| Comprador → Operação | comprador é **texto** no payload; não existe `operacoesComerciais` | **não** (requer modelagem) |
| Data → Sessão | `data_pesagem` e `sessao_id` (indexados) | **sim** |

## 4. Recomendação

Motor de agrupamento puro (entrada: linhas já filtradas e ordenadas; saída: árvore com chave, rótulo, linhas-folha e
agregados por nó):

- **Nível 0** total geral sempre calculado sobre a mesma população das linhas (nunca somando subtotais arredondados).
- **Níveis 1–2** por padrão; **nível 3** permitido só para dimensões de baixa cardinalidade (ex.: sexo, situação).
- Valor ausente vira grupo explícito “Não informado” (chave estável, ordenável).
- Ordenação do grupo: por rótulo ou por agregado escolhido; dentro do grupo: a ordenação das linhas.
- **Animais únicos não se somam entre grupos**: o total geral recalcula `countDistinct` sobre a população, porque o
  mesmo animal pode aparecer em dois grupos (ex.: dois lotes no período).
- Collapse/expand é estado de visualização, fora do motor.
