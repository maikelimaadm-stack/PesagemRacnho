# R0 — Correções de base (16/09/2026)

Branch `program/pesagens-master-evolution`. Checkpoint `d389f06`; commits R0 `9349a8f..872d6b2`.
Dexie v7, backup formato 3 — **sem mudança de schema**.

| P0/P1 | Correção | Commit | Prova |
|---|---|---|---|
| G-P0-01 trava ADMIN da manutenção inefetiva (lia papel de `getActor()`, que não o traz) | `requireMaintenanceAction` usa `getCurrentActor()` + `can()` da matriz; falha fechada com sessão sem papel; UI esconde restaurar/limpar/reset/continuar migração | `9349a8f` | `auth:maintenance-access:verify` (GESTOR/OPERADOR/CONSULTA/sem papel recusados; ADMIN passa) |
| Permissões genéricas de relatório | `reports.read` (A/G/O/C), `reports.export` (A/G/C), `reports.templates.share` (A/G); `audit.read` só A/G | `ae0b3c9` | `auth:permissions:verify` (agora no test:quick), `auth:access:verify` |
| G-P0-02 categoria apagada por Saída sem peso (regressão de 16/09) | projeção usa o último evento **com peso**; peso fora de faixa preserva a última categoria; pesagem sem peso herda a categoria conhecida; `ultimo_peso_kg` não zera | `30d9071` | `category-projection:verify` — falha contra o código anterior (“Saída sem peso preserva a última categoria válida”) |
| G-P0-03 `marca_id`/`raca_id`/`rendimento_origem` descartados | allowlist inclui `marca_id`, `raca_id`, `causa_morte_id`, `rendimento_origem` (continua fechada); Cadastro prefere id existente ao texto (menos cadastro duplicado por grafia) | `9214fff` | `payload:allowlist:verify` (ids preservados; chave desconhecida descartada) |
| G-P1-03 três fórmulas de arroba / 50 % silencioso | domínio único `commercialCalculations`: 1 @ = 15 kg de carcaça; sem rendimento → carcaça/arrobas/valor `null`; `resolveCarcassYield` (informado → padrão empresa → padrão parceiro → ausente); padrão da empresa agora `null` até ser configurado; removidos `peso/30` (ResumoLotes), `×0,5/15` (Ficha), `peso/15` (Relação) | `01289d4` | `enterprise:hardening:verify`, `ui:operational-customization:verify`, `auth:local:verify` |
| G-P1-01 null→0 em resumos | `aggregateEngine` canônico (ausente excluído, `n_validos`/`n_ausentes`, `weightedAvg`, `ratio`, `weightedGmd`) usado por ResumoLotes, ResumoVendaDia (preço médio da @ ponderado por arrobas) e estatísticas da Relação; Ficha sem “0 kg” para Saída sem peso e sem busca O(n²) | `01289d4`, `872d6b2` | gates matemáticos completos em R2 |
| G-P0-04 / G-P1-10 escrita da CONSULTA e valores expostos | `weighingService` autoriza `weighing.write`/`weighing.edit` no serviço; Relação esconde lançar/editar/excluir/importar/exportar conforme a matriz e colunas de valor sem `commercial.values`; Lançamento esconde colunas, campos de valor e resumo de venda sem `commercial.values` | `872d6b2` | `auth:weighing-access:verify` |

## Critério de conclusão R0

| Critério | Resultado |
|---|---|
| P0 corrigidos | ✔ (4 de 4) |
| lint | ✔ |
| build | ✔ (`vite build`, aviso de chunk > 500 kB preexistente) |
| test:quick | ✔ 33 gates (29 anteriores + 4 novos no agregador) |
| permissões administrativas corretas | ✔ |
| categoria não some | ✔ |
| ids estruturais preservados | ✔ |
| valores comerciais protegidos | ✔ (Relação/Lançamento/resumos; relatórios em R3) |

Verificação visual: Relação e Lançamento renderizam no navegador de desenvolvimento (sessão ADMIN) sem erro novo no console.

## Fora do R0 (registrado)

- Fechamento do Dia ainda soma `peso || 0` e média simples de GMD → tratado na fatia do fechamento imprimível (R5), que reutilizará o motor.
- `resolveRegistryId` ainda cria marca/raça por texto quando não há id (G-P1-04) — reduzido, não eliminado.
- Commits `9349a8f..872d6b2` têm o trailer Co-Authored-By antes do corpo (formatação); conteúdo correto, sem reescrita de histórico.
