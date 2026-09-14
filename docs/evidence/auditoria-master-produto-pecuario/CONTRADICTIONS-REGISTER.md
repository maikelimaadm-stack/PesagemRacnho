# CONTRADICTIONS-REGISTER — Contradições entre arquitetura, código e documentação

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

| ID | Contradição | Lado A | Lado B | Gravidade | Resolução proposta |
|---|---|---|---|---|---|
| C-01 | Sanidade | ADR-007 e 00 §4.10: fora de escopo; v6 removeu stores | `ConfiguracoesSanidade.jsx` no menu; `registryService` grupo `sanidade` em `appSettings` | Alta | DEC-006: cumprir ADR-007 (`SANITY-ADR-REVIEW.md`) |
| C-02 | Store `lotes` | 02 §8 "nenhuma store é removida sem decisão"; F0-01 §10 pede ADR antes da F2 | store existe sem uso; UI usa `loteApartacoes` | Média | DEC-007: ADR + remoção em v7 |
| C-03 | Compradores em dois lugares | `CadastrosComerciais` (registry) é o cadastro atual | `GerenciarSaidasDialog` (`perfis-saida`) continua ativo e sincronizado | Média | DEC-016: remover legado após migrar |
| C-04 | Documento obrigatório na venda | `FechamentoDia`: venda sem embarque/documento é pendência **crítica** | Lançamento: documento obrigatório só no abate | Média | DEC-019: configuração única aplicada no serviço |
| C-05 | Sessão fechada | `FechamentoDia` grava `Fechada` | `createEntry` cria **outra** sessão `Aberta` na mesma data e aceita o lançamento | Alta | DEC-014: bloqueio no serviço; uma sessão por data+local |
| C-06 | Identidade depende de texto | ADR-004 / 00 §4.3: identidade não depende de texto exibido | marca (texto livre) compõe `valor_normalizado` do identificador | Alta | `marca_id` na chave (M1/M2) |
| C-07 | Cadastro × evento | 00 §4.2: evento histórico não é cadastro | Cadastro do animal é um evento de pesagem com peso obrigatório; compra dentro dele | Alta | `ANIMAL-REGISTRATION-FLOW.md` |
| C-08 | Rendimento explícito | ADR-012 / 02 §4.8: valor informado ≠ calculado; rendimento explícito | `FichaAnimal` e `FechamentoDia` usam 50 % fixo para "@ carcaça"; D4 fallback silencioso | Média | DEC-022 |
| C-09 | Peso obrigatório por motivo | regra única desejada (02 §4.4) | três cópias da lista `['Morte','Doação','Transferência']` (mapper, tela, health) | Baixa | `weightRequiredFor` no domínio (M3) |
| C-10 | Duplicidade no dia | 02 §4.4: política no domínio | só na tela (D6) | Média | M3 |
| C-11 | `exige_observacao` da causa de morte | cadastrado com o campo | nenhuma validação lê o campo | Baixa | serviço valida (M1) |
| C-12 | Ocupação de lote | 02 §4.6: permanência é a fonte | `isLoteCheio` e `FechamentoDia` contam pesagens | Média | `animalLotes` (M3) |
| C-13 | Renomear apartação/lote | 00 §4.2: alterar cadastro não reescreve o fato | `propagateApartacaoRename` reescreve `nome_apartacao`/`nome_lote` em todas as pesagens com auditoria | Média | parar de propagar; junção por id (M3) |
| C-14 | Contrato visual | ADR-016: toda tela no ModeloBase1 | `FechamentoDia`, `FichaAnimal` em `op-screen`; cadastros em popups shadcn | Média | M5 / M3 |
| C-15 | Configuração × cadastro | 03 §1: entidades com histórico/vínculo têm cadastro próprio | parceiros, causas, sanidade em `appSettings` | Alta | DEC-001 |
| C-16 | `legacy_payload` como fonte de regra | F0-01 §1: promover campos quando houver consulta/regra | adapter lê `tipo_manejo`, `motivo_saida`, `apartacao_id`, `operador` do payload; `updateEntry` copia `_localId`/`peso_kg` para dentro | Média | DEC-011 |
| C-17 | Gate vermelho | 07 §13: lint/build/testes aprovados para entrega | dois gates de `test:quick` vermelhos desde 14/09 (sessão paralela) | Alta (processo) | resolver antes de M0 terminar; regra de dono único |
| C-18 | Documentação do usuário | `TESTE-MAQUINA-LIMPA.md` cita versão **1.1.16** | `package.json` e notas em 1.1.17 | Baixa | atualizar na próxima release |
| C-19 | Release checklist | "Suíte integral executada" não marcado; assinatura pendente | `RELEASE-NOTES.md` chama build de diagnóstico | Informativa | manter transparência; não é bloqueio da modelagem |
| C-20 | Auditoria append-only e leve | 06 §10: append-only, mascarável | `antes/depois` completos, inclusive payload, para toda edição coletiva | Baixa | `resumo` de campos (M5) |
| C-21 | Estoque de brincos | pedido do responsável: "cadastro de estoque de identificadores" | `SequenciaBrincos` é auxiliar de tela com `window` global | Média | M2 |
| C-22 | `situacao` do animal | 02 §4.1: ativo, vendido, abatido, transferido, morto, cancelado | só `Ativo`/`Inativo` | Baixa | derivar de `motivo_saida` (M1) |
| C-23 | Era | 03 §3.1: nascimento conhecido ou estimado; categoria | texto livre sem cálculo | Média | DEC-012 |

## Leitura

As contradições de gravidade Alta (C-01, C-05, C-06, C-07, C-15, C-17) são exatamente as que a orientação final do responsável já apontou: cadastros antes do lançamento, identidade permanente, nada estrutural em `appSettings`, sessão com efeito real, e disciplina de gates. Todas têm decisão proposta em `DECISION-REGISTER.md` e fatia em `IMPLEMENTATION-SLICE-PLAN.md`.
