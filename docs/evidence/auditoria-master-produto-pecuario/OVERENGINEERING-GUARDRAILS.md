# OVERENGINEERING-GUARDRAILS — Limites contra excesso de engenharia

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Regras de corte

| # | Regra | Teste rápido |
|---|---|---|
| G1 | Só existe cadastro para o que é referenciado por id em evento, relatório ou regra | "Se eu apagar este cadastro, alguma tela quebra?" Se não, é enum ou configuração |
| G2 | Só existe store para o que tem histórico, contagem ou vínculo | lista curta, sem vínculo → `appSettings` versionado |
| G3 | Nenhuma tela nova sem consumidor no fluxo de curral, comercial ou fechamento | "Quem abre isso na semana?" |
| G4 | Nenhum campo obrigatório que o operador não saiba na hora | obrigatório só no fechamento/conferência |
| G5 | Nenhum valor monetário no curral | ver `TARGET-COMMERCIAL-FLOW.md` |
| G6 | Nenhuma integração antes de P-001/P-002/P-005/P-007 | ADR-009, ADR-015 |
| G7 | Nenhuma store de cache/snapshot antes de medir (ADR-017) | baseline primeiro |
| G8 | Uma migração por corte; nunca migração + redesign + integração juntos (07 §1) | v7 ≠ v8 |
| G9 | Nada em `legacy_payload` novo; nada em `appSettings` com id | `LEGACY-PAYLOAD-AUDIT.md`, `APPSETTINGS-AUDIT.md` |
| G10 | Toda regra automática é explicável e substituível com motivo (ADR-010) | "sugerido × decidido" gravado |
| G11 | ModeloBase1 sem variações: nova tela reutiliza `CadastroAuxiliarPage`/Tela Mãe | ADR-016 |
| G12 | Offline permanece integral: nada depende de rede para salvar (ADR-003) | |

## 2. Lista do que NÃO entra (com o motivo)

| Tentação | Por que não | Onde está a decisão |
|---|---|---|
| ERP: contas a pagar/receber, caixa, centro de custo | 00 §6 e §4.10; P-004 pendente | `TARGET-COMMERCIAL-FLOW.md` §8 |
| CRM: funil, contatos múltiplos, histórico de negociação | parceiro é cadastro, não relacionamento | `COMMERCIAL-REGISTRY-MODEL.md` §4 |
| Fiscal: emissão NF-e/GTA, tributos | ADR-015; exige projeto próprio | `SHIPMENT-FLOW-MODEL.md` §4 |
| WMS: estoque de insumos, unidades, valorização | DEC-017 | `INVENTORY-SCOPE-DECISION.md` |
| Veterinário: sanidade, carência, protocolo, necropsia | ADR-007 | `SANITY-ADR-REVIEW.md` |
| Genealogia, reprodução, escore corporal | 03 §14 | `ANIMAL-CLASSIFICATION-MODEL.md` §5 |
| Pasto, piquete, UA/ha, dieta | 03 §14 | `HERD-LOT-MODEL.md` §5 |
| Motor de regras de apartação completo agora | F4; só corrigir custo e registrar decisão | `HERD-LOT-MODEL.md` §3.3 |
| Multiempresa/fazenda em todas as stores agora | P-003; só `empresa_id='local'` | `PROPERTY-FARM-MODEL.md` §3 |
| Item de embarque como store | evento de saída já é o item | `SHIPMENT-FLOW-MODEL.md` §2.1 |
| Store de snapshots de relatório | ADR-011/017 | `REPORTING-DATA-REQUIREMENTS.md` §6 |
| Renomear store `pesagens` para "eventos" | custo em backup/gates sem ganho funcional | `WEIGHING-DOMAIN-MODEL.md` §3.1 |
| Reescrever o Lançamento do zero | risco; enxugar por remoção de blocos com gates | `TARGET-LAUNCH-FLOW.md` §4 |
| Framework de formulários genérico / gerador de CRUD | `CadastroAuxiliarPage` com porta de persistência basta | `MODELOBASE1-PRODUCT-MAP.md` §3 |
| Sincronização, login, outbox | F7 | 06 |
| PDF/XLSX agora | P-008 | `REPORTING-DATA-REQUIREMENTS.md` §5 |
| Índice único composto "inteligente" no Dexie | não existe condicional a `ativo`; verificação no serviço | `ANIMAL-IDENTIFICATION-MODEL.md` §2.2 |

## 3. Sinais de alerta durante a implementação

- Uma fatia toca mais de uma store nova **e** uma tela **e** uma migração: dividir.
- Um campo "para o futuro" sem leitor: retirar.
- Um `Select` com mais de ~30 opções no curral: precisa de pesquisa, não de lista.
- Uma regra com três cópias (tela, mapper, health): centralizar antes de estender.
- Um gate "ajustado" para passar com o comportamento antigo: reescrever o gate para o contrato novo, com evidência.

## 4. Orçamento de complexidade por fase (proposta)

| Fase | Stores novas | Telas novas | Migração |
|---|---|---|---|
| M1 cadastros mestres | ≤ 6 | ≤ 6 (mesma página genérica) | v7 |
| M2 identificadores | ≤ 2 | 1 | v7 (mesma) |
| M3 lançamento enxuto | 0 | 0 (redução) | — |
| M4 comercial + embarque | 1 | 2 | v8 |
| M5 sessão/fechamento/ficha | 0 | 2 (refeitas) | — |

Estourar o orçamento exige atualizar este documento e a ADR correspondente.
