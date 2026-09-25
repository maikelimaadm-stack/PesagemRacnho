# E8 — Sanidade completa (1.9.0, Dexie v12)

Base atual (v8): `programasSanidade`, `medicamentos`, `aplicacoesSanidade` (com `carencia_dias`),
painel de sanidade no Lançamento, importação de aplicações. E5 já bloqueia venda em carência; E6 já dá
baixa de estoque. Aqui entram protocolo com doses, calendário, dose pelo peso, tratamentos e custo.

## 1. Esquema v12

| Store | Campos | Índices |
|---|---|---|
| `protocolosSanidade` | `programa_id`, `nome`, `alvo` (categorias[], fases[], sexo, idade_min_meses, idade_max_meses), `doses[]` ({ordem, medicamento_id, dias_apos_anterior, dose_modo: FIXA|POR_KG, dose_valor, via}), `obrigatorio` (campanha oficial), `ativo` | `++localId, &id, empresa_id, programa_id, ativo, created_at, updated_at, deleted_at` |
| `agendaSanidade` | `animal_id`, `protocolo_id`, `dose_ordem`, `previsto_para`, `status` (PENDENTE, APLICADA, DISPENSADA, ATRASADA), `aplicacao_id` | `++localId, &id, empresa_id, animal_id, protocolo_id, previsto_para, status, created_at, updated_at, deleted_at` |
| `ocorrenciasSanidade` | `animal_id`, `data`, `tipo` (DOENCA, LESAO, OUTRO), `diagnostico`, `sintomas`, `tratamento_aplicacoes_ids[]`, `desfecho` (CURADO, CRONICO, MORTE, DESCARTE), `causa_morte_id` | `++localId, &id, empresa_id, animal_id, data, desfecho, created_at, updated_at, deleted_at` |

`aplicacoesSanidade` ganha (não indexados): `dose_aplicada`, `unidade`, `peso_base_kg`,
`protocolo_id`, `dose_ordem`, `custo`.

## 2. Regras

- **Agenda**: aplicar dose N de um protocolo gera a dose N+1 em `agendaSanidade`; animais que entram
  no alvo (idade/categoria) ganham a dose 1 pendente. Atrasada = previsto_para < hoje.
- **Dose pelo peso**: dose POR_KG usa o peso lido no Lançamento/balança (ou última pesagem ≤ 30 dias,
  com aviso); mostra "6,5 ml (325 kg × 2 ml/100 kg)"; arredonda para a graduação configurada (0,5 ml).
- **Carência**: fim da carência = data da aplicação + `carencia_dias` do medicamento; aparece na ficha,
  no curral (E9) e bloqueia venda/abate (regra da E5, agora com data exata).
- **Tratamento**: ocorrência → aplicações → desfecho; desfecho MORTE leva à saída com causa.
- **Custo**: custo da aplicação = consumo de estoque (E6) → custo sanitário por animal, lote, dono.

## 3. Telas

Rota Sanidade com abas: **Calendário** (esta semana / atrasadas, por lote, com "aplicar no lote"),
Aplicações, Ocorrências, Carência (animais bloqueados e data de liberação). Programas/Medicamentos
ficam em Cadastros › Sanidade (E3). No Lançamento, o painel de sanidade mostra as doses pendentes do
animal e aplica com um toque.

## 4. Relatórios

`sanidade.pendencias` (Resumido por lote/protocolo), `sanidade.aplicacoes` (período), `sanidade.carencia`,
`sanidade.custo` (por animal/lote/dono), `sanidade.ocorrencias` (morbidade por período/lote),
desbloquear `saidas.taxa-mortalidade` se o denominador de rebanho médio estiver disponível.

## 5. Gates

`migration:v12:verify`, `sanity:protocol-schedule:verify` (geração da agenda, atraso, dispensa),
`sanity:dose-by-weight:verify`, `sanity:withdrawal:verify` (carência bloqueia venda/abate),
`sanity:cost:verify` (custo a partir do estoque).

## 6. Aceite humano

1. Protocolo "Vermifugação" com 2 doses (21 dias) → aplicar dose 1 num lote → agenda mostra dose 2.
2. Dose por kg: animal de 325 kg recebe 6,5 ml calculado; estoque baixa.
3. Animal tratado com antibiótico de 30 dias de carência → venda bloqueada até a data exibida.
4. Custo sanitário do lote no relatório bate com as entradas de estoque.
