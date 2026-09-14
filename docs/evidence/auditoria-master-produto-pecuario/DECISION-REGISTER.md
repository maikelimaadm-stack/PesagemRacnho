# DECISION-REGISTER — Decisões que o responsável precisa tomar

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

Nenhuma decisão abaixo foi tomada nesta auditoria. A coluna "Recomendação" é proposta técnica; a decisão é do responsável. Decisões P-001…P-008 do pacote de arquitetura continuam válidas e são referenciadas quando dependem.

| ID | Decisão | Opções | Recomendação | Impacto se adiar |
|---|---|---|---|---|
| DEC-001 | Onde persistir cadastros mestres (marca, raça, categoria, parceiro, causa, faixas) | (a) stores Dexie v7; (b) continuar em `appSettings` | **(a)** — têm id, histórico, vínculo, contagem e unicidade | cada cadastro novo em `appSettings` aumenta a migração futura e mantém vínculo por nome |
| DEC-002 | Estratégia do estoque de identificadores | (A) item a item; (B) faixas + exceções | **(B)** (`IDENTIFIER-INVENTORY-MODEL.md` §3) | sem estoque, a sequência de brincos continua a depender da lista de pesagens |
| DEC-003 | Identidade visual | (a) número + marca (marca por id); (b) número único por empresa | **(a)** — dados atuais dependem disso | (b) obrigaria renumerar animais existentes |
| DEC-004 | Migração de marca/raça em texto livre | (a) dry-run com fusão confirmada por grupo normalizado; (b) fusão automática | **(a)** para marca (identidade); (b) aceitável para raça | sem migração, telas novas convivem com texto e id |
| DEC-005 | Unicidade de identificador | (a) VISUAL única por marca; RFID/SISBOV únicos globais, verificados no serviço; (b) manter verificação só no diagnóstico | **(a)** | duplicidades silenciosas continuam possíveis |
| DEC-006 | Sanidade | (A) cumprir ADR-007 e remover tela/chave; (B) ADR-018 módulo mínimo; (C) manter como está | **(A)** (`SANITY-ADR-REVIEW.md`) | contradição permanente; dado estrutural em configuração |
| DEC-007 | Store `lotes` | (a) remover em v7; (b) migrar `loteApartacoes` para `lotes` | **(a)** | store morta no backup e nos gates |
| DEC-008 | Cadastros comerciais | (a) `parceiros` com papéis; (b) três stores separadas | **(a)** | duplicidade de pessoas |
| DEC-009 | Operação comercial | (a) entidade `operacoesComerciais` (v8); (b) manter campos por pesagem | **(a)**, após os cadastros mestres | relatórios comerciais permanecem inviáveis; valores repetidos por animal |
| DEC-010 | Embarque | (a) máquina de estados no serviço + parceiro por id; (b) status livre | **(a)** (v8) | embarque concluído continua aceitando saídas |
| DEC-011 | `legacy_payload` | (a) congelar + promover colunas + lista permitida; (b) deixar crescer | **(a)** | tamanho de banco/backup cresce com edições |
| DEC-012 | Era/idade/categoria | (a) nascimento estimado + categoria sugerida; (b) categoria informada, sem idade | **(a)**; (b) é aceitável se o responsável não usar idade | (b) fecha relatórios por idade |
| DEC-013 | Propriedade | (a) store mínima na v7; (b) adiar para F7 (P-003) | **(a)** se compra/transferência forem usadas em breve; senão (b) | origem/destino continuam texto |
| DEC-014 | Sessão | (a) manter automática por data com enum/snapshot/bloqueio (v7); (b) esperar F2 completa | **(a)** | fechamento continua sem efeito sobre novos lançamentos |
| DEC-015 | Regra de numeração de identificadores | (a) prefixo + número + padding por faixa; (b) livre | **(a)** (`SequenciaBrincos` já usa esse formato) | — |
| DEC-016 | `GerenciarSaidasDialog` / `perfis-saida` | (a) remover após migrar compradores; (b) manter | **(a)** | duplicidade e sincronismo legado |
| DEC-017 | Escopo de "estoque" | (a) só identificadores; (b) insumos genéricos | **(a)** (`INVENTORY-SCOPE-DECISION.md`) | (b) abre WMS |
| DEC-018 | `clearAllData` com cadastros em stores | (a) "limpar dados" preserva cadastros mestres; (b) apaga tudo exceto configuração | **(a)** com opção explícita "apagar também cadastros" | usuário perde marcas/raças ao limpar |
| DEC-019 | Documento obrigatório na venda | (a) configuração `exigir_documento_venda` (padrão falso); (b) sempre obrigatório; (c) nunca | **(a)** | regra divergente entre Lançamento e Fechamento persiste |
| DEC-020 | Corte das migrações | (a) v7 cadastros + identificadores; v8 comercial + embarque; (b) tudo em v7 | **(a)** | migração grande, difícil de validar |
| DEC-021 | Ordem entre cadastros e correção da F1 pendente (índice de animais na tela) | (a) cadastros primeiro, com a leitura por `animalIdentificadores` entrando junto; (b) concluir F1 antes | **(a)** — o índice por identificador é parte natural do slice de identificação | (b) adia os cadastros sem ganho |
| DEC-022 | Rendimento de carcaça | (a) por operação com origem (`informado`/`padrao` da empresa ou do parceiro); (b) 50 % fixo | **(a)** (resolve D4) | @ estimada continua sem rastreio |

## Como registrar a decisão

Para cada DEC aceita: nova ADR em `docs/arquitetura-produto/08-DECISOES-ARQUITETURAIS.md` (ADR-018 em diante), com contexto, opção escolhida, migração, rollback e testes (processo definido em 08). Sem ADR, o plano de slices não deve começar.
