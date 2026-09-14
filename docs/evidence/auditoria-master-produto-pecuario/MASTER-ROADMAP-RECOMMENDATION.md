# MASTER-ROADMAP-RECOMMENDATION — Roadmap recomendado (modelagem do produto)

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 0. Relação com o roadmap F0–F8

O roadmap de arquitetura (07) continua válido. Esta recomendação **insere** uma trilha de modelagem de produto (M0–M5) entre a F1 (em andamento) e a F2 (Modo Curral), porque sessões, apartação avançada e equipamentos dependem de cadastros mestres e identidade limpa. M4 corresponde à parte inicial da F6; M5 antecipa fatias da F2/F3 sem o hardware.

```text
F0 ✔ → F1 (parcial) → M0 → M1 → M2 → M3 → M4 → M5 → F2 (restante) → F3 → F4 → F5 → F6 (restante) → F7 → F8
```

## M0 — Decisões e contratos

- **Objetivo:** fechar DEC-001…DEC-022 como ADRs; fixar orçamentos.
- **Escopo:** ADR-018+ em `08-DECISOES-ARQUITETURAIS.md`; medições de `LEGACY-PAYLOAD` e migração simulada (`TARGET-PERFORMANCE-RISKS.md` §5).
- **Stores:** nenhuma. **UI:** nenhuma.
- **Contratos:** lista permitida do payload; enums; formato de backup v3.
- **Gates:** nenhum novo; `test:quick` deve estar verde (os dois gates vermelhos da sessão paralela resolvidos por quem os introduziu).
- **Riscos:** decisões adiadas travam M1.
- **Dependências:** esta auditoria.
- **Critério de aceite:** ADRs publicadas; medições registradas em `docs/evidence`.

## M1 — Cadastros mestres (Dexie v7, parte 1)

- **Objetivo:** marcas, raças, categorias, causas de morte, parceiros (e propriedades se DEC-013) como stores com telas ModeloBase1.
- **Escopo:** migração v7 com dry-run e backup físico; porta de persistência em `CadastroAuxiliarPage`; `animais.marca_id/raca_id/categoria_id`; `animalIdentificadores.marca_id`; Lançamento passa a **selecionar** marca/raça/categoria (comboboxes livres removidos); `registryService` e `GerenciarSaidasDialog` retirados; sanidade removida (DEC-006).
- **Stores:** `marcas`, `racas`, `categoriasAnimal`, `causasMorte`, `parceiros`, (`propriedades`); remoção de `lotes`.
- **UI:** 5–6 telas com a mesma página genérica; ajustes no Lançamento.
- **Contratos:** `catalogResolver` (nome normalizado → id) compartilhado por migração e importação; mapper lê coluna → payload → nulo.
- **Gates:** `storage:dexie:verify` (v7), `storage:backup:verify` (formato 3, restore v6 + backfill), `animal:history-integrity:verify` (marca por id), `ui:consistency:verify` (telas novas), novo `registry:master:verify` (unicidade, inativação, resolução por nome).
- **Riscos:** fusão indevida de marcas (mitigado por dry-run); migração lenta em 250 mil (medir em M0).
- **Dependências:** M0.
- **Critério de aceite:** nenhuma marca/raça digitada livre em tela alguma; backup v6 restaurado em v7 com backfill validado; `test:quick` verde; capturas claro/escuro.

## M2 — Estoque de identificadores (Dexie v7, parte 2)

- **Objetivo:** faixas + exceções; sequência do curral alimentada pelo estoque; identificadores com validade temporal e tipos.
- **Escopo:** `faixasIdentificadores`, `excecoesIdentificadores`; `animalIdentificadores.tipo/faixa_id/inicio/fim`; unicidade no serviço (DEC-005); resolução do animal por índice de identificadores (encerra R-01/D8); tela Faixas; `SequenciaBrincos` como visão do serviço; troca de identificador na ficha.
- **UI:** 1 tela + ajuste do Lançamento.
- **Contratos:** `identifierInventoryService` (`nextFree`, `useNumber`, `markLost`, `balance`).
- **Gates:** novo `identifier:inventory:verify` (próximo livre com exceções, uso único, saldo); `perf:contract:verify` com identificação por índice.
- **Riscos:** faixas sobrepostas; números já usados fora de faixa (tratados como exceções na criação).
- **Dependências:** M1 (marcas).
- **Critério de aceite:** abrir Lançamento < 1 s em 36 mil (navegador); nenhum número duplicado por marca aceito pelo serviço; saldo por faixa confere com contagem.

## M3 — Lançamento enxuto

- **Objetivo:** curral só seleciona; Manejo em três campos; sem popups nem ações ocultas.
- **Escopo:** remover blocos de compra/venda/abate da tela (mantendo leitura dos dados legados na Relação); contexto de sessão (marca/apartação padrão) persistido; cadastro rápido mínimo; validações de peso/duplicidade no domínio (D6); ocupação de lote por `animalLotes`; parar de propagar renomeação.
- **Stores:** nenhuma nova; `sessoesPesagem` ganha padrões (parte do enum de DEC-014).
- **UI:** Lançamento reduzido; telas Apartações/Lotes próprias.
- **Gates:** `ui:operational-customization:verify` e `ui:consistency:verify` reescritos para o contrato novo; `enterprise:hardening:verify` com duplicidade no serviço.
- **Riscos:** perder funcionalidade usada (compra por animal) antes de M4 existir → manter leitura e edição dos campos legados **somente** pela Relação até M4.
- **Dependências:** M1, M2.
- **Critério de aceite:** `CORRAL-USABILITY-AUDIT.md` §5; teste humano de 50 animais sem mouse.

## M4 — Comercial e embarque (Dexie v8)

- **Objetivo:** operações de compra/venda/abate como entidade; embarque com máquina de estados e parceiro por id.
- **Escopo:** `operacoesComerciais`; enum de status em `embarques`; migração agrupando saídas/compras legadas; Lançamento seleciona operação aberta; telas Operações e Embarques; retorno de frigorífico; REP-302/303/401 mínimos (tabela + CSV com manifesto).
- **Gates:** `storage:dexie:verify` (v8), novo `commercial:operations:verify` (estados, totais calculados × informados, cancelamento com reversão), `shipment:state:verify`.
- **Riscos:** agrupamento de saídas legadas ambíguo → operações "migração" revisáveis.
- **Dependências:** M1 (parceiros), M3.
- **Critério de aceite:** nenhum valor monetário no Lançamento; total da operação = Σ eventos; embarque concluído recusa saída.

## M5 — Sessão, fechamento e ficha

- **Objetivo:** fechamento por sessão com snapshot e bloqueio; ficha do animal por projeções; ambas na Tela Mãe.
- **Escopo:** enum/snapshot/`motivo_reabertura` em `sessoesPesagem`; catálogo de pendências no serviço; REP-001/002/003 mínimos; Animais (lista + ficha) absorvendo Ficha do Animal; auditoria com resumo.
- **Gates:** novo `session:closing:verify` (bloqueio, snapshot, reabertura com motivo); `ui:consistency:verify`.
- **Dependências:** M3 (contexto de sessão), M4 (pendências comerciais).
- **Critério de aceite:** sessão fechada recusa eventos; snapshot igual à consulta de origem; abertura do fechamento < 500 ms.

## Depois de M5

Retomar F2 (captura, pausa, produtividade), F3 (catálogo de relatórios com GMD ponderado, ranking, vencidas), F4 (motor de regras), F5 (hardware, após P-001/P-002).

## Riscos transversais

1. Trabalho paralelo na mesma base de código (já observado em 14/09): cada slice precisa de dono único e gate verde antes de começar o próximo.
2. Assinatura Authenticode pendente: nenhuma fase acima depende dela, mas o teste em máquina limpa sim.
3. Baseline do navegador após F1 ainda não registrado: fazer em M0.
