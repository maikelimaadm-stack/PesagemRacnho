# EXECUTIVE-ASSESSMENT — Avaliação executiva

**Auditoria master · 14/09/2026 · Pesagens Individuais 1.1.17 · Electron 35 · React 18 · Dexie v6 (16 stores) · documento de auditoria, sem implementação**

## 1. Veredito

O produto tem um **núcleo confiável** (identidade canônica do animal, eventos de pesagem com cronologia e recálculo por animal, projeções em transação, backup com integridade, Tela Mãe do ModeloBase1 na Relação e nos cadastros). Sobre esse núcleo foram acrescentados, por atalho, os elementos que o responsável agora quer estruturar: marca, raça, era, identificadores, parceiros, compra/venda/abate, apartação, embarque e sessão. Esses elementos existem, mas como **texto livre no evento, popups dentro do lançamento e listas em `appSettings`**. Nada disso impede o uso diário; tudo isso impede cadastros de verdade, relatórios por dimensão e um curral rápido.

Resultado: **APROVADO PARA PLANEJAMENTO.** Há decisões a tomar (22, em `DECISION-REGISTER.md`), mas nenhuma delas bloqueia o desenho; bloqueariam apenas a implementação.

## 2. Estado por área (classificação em `PRODUCT-CAPABILITY-MAP.md`)

| Área | Estado | Nota |
|---|---|---|
| Identidade e histórico do animal | MADURA no núcleo; MAL MODELADA na marca (texto compõe a identidade) | `ANIMAL-IDENTIFICATION-MODEL.md` |
| Cadastros de marca/raça/era/categoria | MAL MODELADA / AINDA NÃO EXISTE | `BRAND/BREED/ANIMAL-CLASSIFICATION` |
| Estoque de identificadores | AINDA NÃO EXISTE (`SequenciaBrincos` é auxiliar de tela) | `IDENTIFIER-INVENTORY-MODEL.md` |
| Lançamento | MADURA na regra; FUNCIONAL MAS IMPROVISADA na tela (2 182 linhas, 6 fluxos, popups, ações ocultas) | `TARGET-LAUNCH-FLOW.md` |
| Compra/venda/abate | PARCIAL: campos por pesagem, parceiro por nome, dois cadastros de comprador | `TARGET-COMMERCIAL-FLOW.md` |
| Embarque | FUNCIONAL MAS IMPROVISADA: status sem regra, dados copiados por animal | `SHIPMENT-FLOW-MODEL.md` |
| Apartação/lotes | FUNCIONAL MAS IMPROVISADA + store `lotes` DUPLICADA | `HERD-LOT-MODEL.md` |
| Sessão/fechamento/ficha | PARCIAL: fechar não bloqueia; telas fora do ModeloBase1; leem a base inteira | `WEIGHING-SESSION`, `DAY-CLOSING`, `ANIMAL-PROFILE` |
| Sanidade | LEGADA, contradiz ADR-007 | `SANITY-ADR-REVIEW.md` |
| Persistência | MADURA (Dexie, backup, integridade); `legacy_payload` e `appSettings` acumulam estrutura | `LEGACY-PAYLOAD-AUDIT.md`, `APPSETTINGS-AUDIT.md` |
| Desempenho | PARCIAL: salvar 76 ms (Node) após F1; abertura da tela ainda reconstrói índice das pesagens; navegador não remedido | `TARGET-PERFORMANCE-RISKS.md` |

## 3. Principais riscos

1. **Marca em texto livre dentro da chave de identidade** (C-06). Um erro de digitação cria outro animal. Migrar para `marca_id` exige dry-run com fusão confirmada.
2. **Sessão sem efeito** (C-05): fechar o dia não impede lançamentos e pode gerar duas sessões por data.
3. **Crescimento do `legacy_payload` e da auditoria** por edição e por cópia de dados de embarque/parceiro.
4. **Trabalho paralelo** na mesma base deixou dois gates vermelhos no `test:quick` (C-17); sem disciplina de dono único, as fatias de modelagem vão colidir.
5. **Migrações**: v6→v7 com backfill em `animais`/`animalIdentificadores`; precisa de backup físico automático antes da abertura na versão nova e de medição em 250 mil.

## 4. Recomendação de sequência

`MASTER-ROADMAP-RECOMMENDATION.md`: M0 decisões → M1 cadastros mestres (v7) → M2 estoque de identificadores → M3 lançamento enxuto → M4 comercial e embarque (v8) → M5 sessão/fechamento/ficha → retomar F2–F5. Cadastros vêm antes de qualquer mudança no lançamento, como pedido.

## 5. Validação executada nesta auditoria (sem alterar código)

| Comando | Resultado |
|---|---|
| `npm.cmd run lint` | ver `AUDIT-INDEX.md` §3 (registro da execução) |
| `npm.cmd run build` | idem |
| `npm.cmd run test:quick` | idem; dois gates vermelhos conhecidos da sessão paralela, não corrigidos por regra desta missão |

## 6. Confirmação de escopo

Nenhum arquivo em `src/`, `electron/`, `package.json`, `package-lock.json`, esquema Dexie, CSS, serviços, adapters, stores ou release foi alterado. Toda a saída desta auditoria está em `docs/evidence/auditoria-master-produto-pecuario/` (45 documentos, índice em `AUDIT-INDEX.md`).
