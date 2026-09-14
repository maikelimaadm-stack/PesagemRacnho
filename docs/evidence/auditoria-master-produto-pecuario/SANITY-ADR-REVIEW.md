# SANITY-ADR-REVIEW — Sanidade × ADR-007

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. O que a arquitetura diz

- **00 §4.10:** "Sanidade permanece explicitamente fora do produto atual por decisão do responsável."
- **ADR-007 (aceita):** "não recriar cadastros, seleção, aplicação ou relatórios de sanidade. O esquema v6 removeu as stores correspondentes. Retorno exige nova ADR e módulo independente."
- **Dexie v6:** removeu `configuracoesSanidade`, `itensSanidade`, `sanidadesAnimal` e limpa `sanidade_ids`/`sanidades` de `legacy_payload` na migração e na leitura (`weighingMapper`).
- **F0-01 §11:** "Campos que não serão criados: sanidade, medicamentos…".

## 2. O que o código faz

| Item | Evidência |
|---|---|
| Tela ativa no menu | `Layout.jsx`: "Sanidade — Configurações de Sanidade" → `ConfiguracoesSanidade.jsx` |
| Cadastro de programas sanitários | campos nome, tipo (Vacinação, Vermifugação, Tratamento, Preventivo, Outro), intervalo em dias, orientação, ativo |
| Cadastro de medicamentos | nome, princípio ativo, fabricante, unidade, dose padrão, carência, via de aplicação, ativo |
| Persistência | `registryService.REGISTRY_GROUPS.sanidade = ['programasSanidade','medicamentos']` → `appSettings['cadastros-auxiliares:sanidade:local']` |
| Uso operacional | **nenhum**: o Lançamento não lê `sanidade`; `loadAuxiliaryCatalogs` carrega o grupo mas a tela usa só comerciais e mortalidade |
| Gate | `ui:consistency:verify` do trabalho paralelo cobre a página de cadastro genérica, não a sanidade em si |

Conclusão: a tela é um cadastro sem consumidor, criado depois da ADR-007, guardado em `appSettings` (contorna a remoção das stores). É uma **contradição registrada**: viola a ADR sem ADR nova.

## 3. Opções

| Opção | Descrição | Custo | Consequência |
|---|---|---|---|
| A — Cumprir ADR-007 | remover a rota e o item de menu; remover `sanidade` de `REGISTRY_GROUPS`; migração v7 apaga a chave `appSettings` após exportar o conteúdo para um JSON em `docs/evidence` (se houver dados) | baixo | coerência com a arquitetura; zero manutenção |
| B — Nova ADR-018 "Sanidade como módulo mínimo" | manter apenas os dois cadastros como stores próprias (`programasSanidade`, `medicamentos`) e adicionar **um** evento "aplicação sanitária" por animal; sem carência aplicada a venda, sem estoque de medicamento, sem calendário | médio | reabre domínio; precisa de tela de aplicação, relatório e gates; entra em competição com cadastros mestres prioritários |
| C — Manter como está | tela sem uso, em `appSettings` | zero agora | contradição permanente; dado estrutural em configuração; confusão para o usuário |

## 4. Recomendação

**Opção A.** Motivos: (1) a decisão do responsável está registrada e não foi revogada; (2) nenhum fluxo consome o cadastro; (3) a prioridade declarada é cadastros de marca, raça e identificadores; (4) sanidade completa (carência × venda, calendário, estoque de medicamento) é exatamente o tipo de expansão veterinária que a orientação final pede para evitar.

Se o responsável quiser sanidade, o caminho correto é a Opção B com ADR-018 escrita antes de qualquer código, e **depois** dos cadastros mestres.

## 5. O que fazer com dados existentes

Antes de remover: verificar em Manutenção › Diagnóstico se `appSettings['cadastros-auxiliares:sanidade:local']` tem registros. Se tiver, exportar para `docs/evidence/auditoria-master-produto-pecuario/sanidade-export-<data>.json` e só então limpar. Isso é parte do slice de migração v7 (`IMPLEMENTATION-SLICE-PLAN.md`), não desta auditoria.

## 6. Registro

Contradição C-01 em `CONTRADICTIONS-REGISTER.md`; decisão DEC-006 em `DECISION-REGISTER.md`.
