# TARGET-ENTITY-MAP — Mapa de entidades alvo e classificação

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Escala

| Classe | Critério |
|---|---|
| ESSENCIAL | sem ela o lançamento fica lento, ambíguo ou perde rastreabilidade |
| ÚTIL | melhora conferência ou relatório; pode entrar depois da essencial |
| FUTURO | depende de decisão pendente (P-00x) ou de fase F5+ |
| DESNECESSÁRIO | não deve existir no produto (evita ERP/CRM/WMS/veterinário) |

## 2. Entidades

| Entidade | Store | Classe | Fase sugerida | Depende de | Documento |
|---|---|---|---|---|---|
| Animal (cadastro + projeção) | `animais` | ESSENCIAL (existe) | v7 ajustes | marcas, raças, categorias | `ANIMAL-LIFECYCLE-TARGET.md` |
| Identificador do animal | `animalIdentificadores` | ESSENCIAL (existe) | v7 ajustes | marcas, faixas | `ANIMAL-IDENTIFICATION-MODEL.md` |
| Marca | `marcas` | ESSENCIAL | v7 | — | `BRAND-REGISTRY-MODEL.md` |
| Raça | `racas` | ESSENCIAL | v7 | — | `BREED-REGISTRY-MODEL.md` |
| Categoria animal | `categoriasAnimal` | ESSENCIAL | v7 | DEC-012 | `ANIMAL-CLASSIFICATION-MODEL.md` |
| Faixa de identificadores | `faixasIdentificadores` | ESSENCIAL | v7 | marcas, DEC-002 | `IDENTIFIER-INVENTORY-MODEL.md` |
| Exceção de identificador | `excecoesIdentificadores` | ESSENCIAL (com a faixa) | v7 | faixas | idem |
| Evento do animal (pesagem/cadastro/saída) | `pesagens` | ESSENCIAL (existe) | v7 índices | — | `WEIGHING-DOMAIN-MODEL.md` |
| Sessão de pesagem | `sessoesPesagem` | ESSENCIAL (existe) | v7 enum/snapshot | — | `WEIGHING-SESSION-MODEL.md` |
| Apartação | `apartacoes` | ESSENCIAL (existe) | v7 pequenos ajustes | — | `HERD-LOT-MODEL.md` |
| Lote | `loteApartacoes` | ESSENCIAL (existe) | v7 | categorias | idem |
| Permanência em lote | `animalLotes` | ESSENCIAL (existe) | — | — | idem |
| Movimento | `movimentosAnimais` | ESSENCIAL (existe) | preencher origem | — | idem |
| Parceiro (comprador/vendedor/frigorífico/transportador/proprietário) | `parceiros` | ESSENCIAL | v7 | — | `COMMERCIAL-REGISTRY-MODEL.md` |
| Causa de morte | `causasMorte` | ESSENCIAL (existe em appSettings) | v7 | — | `MORTALITY-MODEL.md` |
| Propriedade | `propriedades` | ÚTIL | v7 (opcional) / F7 | DEC-013 | `PROPERTY-FARM-MODEL.md` |
| Operação comercial (compra/venda/abate) | `operacoesComerciais` | ÚTIL → ESSENCIAL para relatório comercial | v8 | parceiros | `PURCHASE/SALE/SLAUGHTER-FLOW-MODEL.md` |
| Embarque | `embarques` | ESSENCIAL (existe) | v8 enum/parceiro | parceiros | `SHIPMENT-FLOW-MODEL.md` |
| Documento de embarque | `documentosEmbarque` | ESSENCIAL (existe) | v8 | — | idem |
| Auditoria | `auditoria` | ESSENCIAL (existe) | v7 resumo | — | `TARGET-PERFORMANCE-RISKS.md` |
| Importação (job) | `importacoes` | ESSENCIAL (existe) | — | — | `IMPORT-TARGET-MODEL.md` |
| Configuração | `appSettings` | ESSENCIAL (existe) | v7 limpeza | — | `APPSETTINGS-AUDIT.md` |
| Backup (histórico) | `backupHistory` | ESSENCIAL (existe) | — | — | `BACKUP-V7-IMPACT.md` |
| Regra de apartação versionada | — | FUTURO (F4) | — | ADR-010 | 02 §4.7 |
| Dispositivo / leitura de equipamento | — | FUTURO (F5) | — | P-001/P-002 | 05 |
| Empresa / fazenda / curral / usuário / papel | — | FUTURO (F7) | — | P-003/P-006 | 06 |
| Outbox / conflito | — | FUTURO (F7) | — | P-005 | 06 |
| Store `lotes` | `lotes` | DESNECESSÁRIO | remover v7 | DEC-007 | `HERD-LOT-MODEL.md` |
| Programa sanitário / medicamento | (appSettings) | DESNECESSÁRIO (ADR-007) | remover | DEC-006 | `SANITY-ADR-REVIEW.md` |
| Perfil de venda/abate (`perfis-saida`) | (appSettings) | DESNECESSÁRIO | remover | — | `SALE-FLOW-MODEL.md` |
| Estoque de insumos, unidade de medida, movimentação de estoque | — | DESNECESSÁRIO | — | DEC-017 | `INVENTORY-SCOPE-DECISION.md` |
| Item de embarque como store | — | DESNECESSÁRIO (o evento de saída é o item) | — | — | `SHIPMENT-FLOW-MODEL.md` |
| Snapshot/cache de relatório | — | DESNECESSÁRIO agora | — | ADR-017 | `REPORTING-DATA-REQUIREMENTS.md` |
| Contas a pagar/receber, NF-e, contrato, CRM | — | DESNECESSÁRIO | — | 00 §6 | — |

## 3. Diagrama alvo (v7 + v8)

```text
marcas ◄──── animais ────► racas
   ▲            │ ▲  └────► categoriasAnimal
   │            │ └──────── propriedades (opcional)
faixasIdentificadores ◄── animalIdentificadores ──► animais
   └── excecoesIdentificadores
animais 1──N pesagens (eventos) N──1 sessoesPesagem
pesagens ──► loteApartacoes ──► apartacoes
pesagens ──► operacoesComerciais ──► parceiros
pesagens ──► embarques ──► documentosEmbarque ; embarques ──► parceiros
pesagens (SAÍDA/Morte) ──► causasMorte
animais 1──N animalLotes ; animais 1──N movimentosAnimais
auditoria, importacoes, appSettings, backupHistory (plataforma)
```

## 4. Contagem

- Stores hoje: 16 (15 de domínio/plataforma + `lotes` sem uso).
- Stores alvo v7: 16 − 1 (`lotes`) + 8 (`marcas`, `racas`, `categoriasAnimal`, `parceiros`, `causasMorte`, `faixasIdentificadores`, `excecoesIdentificadores`, `propriedades` opcional) = 23.
- v8: + `operacoesComerciais` = 24.

Cada store nova tem uma tela ModeloBase1 correspondente ou é auxiliar de outra (`excecoesIdentificadores` aparece dentro da faixa).
