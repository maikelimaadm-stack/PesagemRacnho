# 08 — Registro de decisões arquiteturais

## ADR-001 — Desktop Electron permanece

**Status:** aceita.  
**Decisão:** manter Electron no ciclo atual.  
**Motivo:** runtime, instalador, testes e operação offline já consolidados. Trocar o
shell não melhora diretamente o trabalho de pesagem e adicionaria risco.

## ADR-002 — IndexedDB/Dexie é a persistência local vigente

**Status:** aceita.  
**Decisão:** evoluir o esquema Dexie versionado; documentos JSON/SQLite são
históricos.  
**Condição:** reavaliar somente se medição real demonstrar limite incontornável.

## ADR-003 — Offline-first é requisito permanente

**Status:** aceita.  
**Decisão:** futura nuvem replica operações locais por outbox; salvar pesagem não
depende de servidor.

## ADR-004 — Animal possui identidade canônica

**Status:** aceita.  
**Decisão:** UUID interno é a identidade; número, marca, RFID e SISBOV são
identificadores. Não voltar ao modelo em que cada pesagem representa um animal.

## ADR-005 — Sessão é o agregado operacional central

**Status:** proposta aprovada para roadmap.  
**Decisão:** formalizar abertura, operação, conferência e encerramento da sessão.

## ADR-006 — Fatos, projeções e cálculos são separados

**Status:** aceita.  
**Decisão:** pesagem/movimento são fatos; lote/situação atuais são projeções;
GMD/arrobas são derivados reconstruíveis.

## ADR-007 — Sanidade permanece fora de escopo

**Status:** aceita por decisão expressa.  
**Decisão:** não recriar cadastros, seleção, aplicação ou relatórios de sanidade.
O esquema v6 removeu as stores correspondentes. Retorno exige nova ADR e módulo
independente.

## ADR-008 — Monólito modular antes de microserviços

**Status:** aceita.  
**Decisão:** separar contextos e portas dentro do produto. Servidor futuro pode
ser modular sem distribuir prematuramente as transações.

## ADR-009 — Hardware entra por adaptadores homologados

**Status:** aceita.  
**Decisão:** contrato comum, capability matrix, simulador e homologação por
modelo/firmware. Conector físico sozinho não significa compatibilidade.

## ADR-010 — Apartação é determinística e explicável

**Status:** aceita.  
**Decisão:** regras versionadas, prioridade, simulação e justificativa de override.
Nenhuma decisão opaca.

## ADR-011 — Relatórios usam catálogo de métricas

**Status:** aceita.  
**Decisão:** fórmulas canônicas, população explícita, drill-down e exportação
equivalente à tela.

## ADR-012 — Peso vivo, carcaça e arroba não se confundem

**Status:** aceita.  
**Decisão:** armazenar/apresentar separadamente, com rendimento explícito.

## ADR-013 — Login não elimina operação offline

**Status:** proposta para fase online.  
**Decisão:** sessão offline protegida após autenticação, tokens em armazenamento
seguro e revogação na conexão seguinte.

## ADR-014 — Não usar “última gravação vence” globalmente

**Status:** proposta para fase online.  
**Decisão:** conflitos de fatos e identificadores exigem políticas específicas;
nunca apagar uma pesagem legítima silenciosamente.

## ADR-015 — Integração oficial depende de autorização

**Status:** aceita.  
**Decisão:** preparar modelo para SISBOV/GTA/NF-e, mas não simular integração por
automação frágil nem prometer acesso sem credenciamento.

## ADR-016 — ModeloBase1 permanece contrato visual

**Status:** aceita.  
**Decisão:** novas telas e pop-ups reutilizam componentes/tokens existentes e
entram nos testes de consistência visual.

## ADR-017 — Desempenho tem orçamento mensurável

**Status:** aceita.  
**Decisão:** toda fase mede p50/p95/p99 nas massas homologadas; otimização deve ser
baseada em perfil, não em impressão isolada.

## Decisões pendentes

| ID | Decisão | Informação necessária |
|---|---|---|
| P-001 | Primeira balança | fabricante, modelo, firmware, cabo/protocolo |
| P-002 | Primeiro leitor RFID | fabricante, modelo e padrão do brinco |
| P-003 | Estrutura organizacional | empresas, fazendas e currais reais |
| P-004 | Método de custo | insumos considerados e regra de rateio |
| P-005 | Canal online | provedor, região, orçamento e SLA |
| P-006 | Autenticação | identidade própria ou provedor OIDC |
| P-007 | Escopo SISBOV | propriedade certificada, parceiro/certificadora e acesso |
| P-008 | Relatórios iniciais | ordem entre PDF, XLSX e painéis |

## Processo para nova decisão

Registrar contexto, opções, decisão, consequências, migração, rollback, impacto
em dados, segurança, testes e documentação. Alteração de uma decisão aceita não é
uma edição silenciosa: criar nova ADR que substitui a anterior.

