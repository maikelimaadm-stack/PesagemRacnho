# 16 — Missão pesagens-integrada: arquitetura e decisões (ADR-051 em diante)

**Base:** 1.5.6 (Dexie v8). **Origem:** prompt mestre em `docs/evidence/pesagens-integrada/PROMPT-MISSAO.md`.
Este documento cresce junto com a implementação: cada decisão entra aqui no checkpoint em que é programada.
As decisões anteriores (ADR-001 a ADR-050) continuam em `08-DECISOES-ARQUITETURAIS.md`.

## Princípios que valem para toda a missão

- **Identidade:** `animal.id` / `animal_id` é a identidade do animal. Número, marca a fogo, RFID e
  identificador oficial são atributos com vigência (`animalIdentificadores`), nunca identidade.
- **Tipos de dado:** separamos fato (evento auditável), projeção (estado atual derivado), parâmetro (regra
  vigente) e estimativa (idade aproximada, projeção de peso). Estimativa nunca é gravada como fato.
- **Onde as regras vivem:** as invariantes ficam no domínio e no serviço e são aplicadas dentro da transação
  Dexie. A tela só repete a regra para dar retorno rápido ao operador.
- **Esquema do banco:** é aditivo. `STORES_V7` e `STORES_V8` nunca são editadas; store ou índice novo entra
  numa versão nova, com migração idempotente e backup antes.

---

## ADR-051 — Portão da captura de peso pela balança (P01, P02, P03)

**Contexto.** Na 1.5.4 o campo Peso passou a espelhar o monitor da S3 e a não zerar depois de salvar.
Com isso, o animal B podia ser salvo com o peso do animal A, que continuava na balança (P01). Além disso:
- `captureWeightForLaunch` transformava a última leitura em estável depois de 5 s (P02);
- desconectar não limpava o último estável (P03).

**Decisão.**
1. **Leitura numerada.** O `scaleService` numera toda leitura com `seq` (monotônica), `epoch` (época da
   conexão; muda a cada conexão, queda, troca de aparelho ou desconexão) e `receivedAt`.
2. **Invalidação.** Troca de época invalida o último estável. O timer do "estável pelo silêncio"
   (`stabilityTracker`, firmware ≥ 1.2.6 só envia quando muda) só confirma com a balança conectada e na
   mesma época.
3. **Portão puro.** `domain/captureGate.js` decide se há leitura estável **nova**:
   - é estável, da época atual e com a balança conectada;
   - ainda não foi consumida por outro salvamento;
   - depois de um salvamento, a balança precisa mostrar troca de animal: plataforma vazia
     (`emptyThresholdKg`, padrão 10 kg) ou variação grande (`rearmDeltaKg`, padrão 30 kg) seguida de
     estável em peso diferente do consumido (± 1 kg).
4. **Lançamento automático.** Na pesagem automática, o Lançamento salva o peso da leitura liberada, não o
   texto do campo. Só depois do salvamento dar certo a leitura é consumida. Sem leitura liberada, o
   salvamento é recusado com a explicação do motivo.
5. **Campo continua espelhando.** O campo Peso segue espelhando o monitor (pedido do proprietário na 1.5.4).
   O estado visual `is-waiting` (cinza) indica peso já usado.
6. **Sem estável inventado.** `captureWeightForLaunch` nunca promove leitura instável: no tempo-limite,
   rejeita com `SCALE_NOT_STABLE`.
7. **Envio único por ciclo.** Cada ciclo de lançamento tem um id (`cicloLancamentoRef`) que vira o `id` da
   pesagem. O adapter recusa id repetido, e a trava `salvandoRef` barra o Enter duplo antes do novo render.
8. **Origem gravada.** `legacy_payload.peso_origem` recebe `BALANCA` ou `MANUAL`. Em `balanca_leitura`
   ficam `{ kg_bruto, seq, epoch, fonte, lida_em }`. Ambos entraram na allowlist do payload (ADR-027).

**Consequências.**
- **Manual:** o peso manual continua livre: desligar a pesagem automática libera o campo, e os ticks da
  balança não sobrescrevem o que foi digitado.
- **Plataforma que não esvazia:** um curral que nunca esvazia a plataforma entre animais depende do
  `rearmDeltaKg`. Os dois limites são configuráveis.
- **Homologação física:** fica pendente (P16, `VALIDACAO-MANUAL-WINDOWS-S3.md`).

## ADR-052 — Peso inteiro no campo e na pesagem; leitura bruta guardada (P15)

**Contexto.** O peso do sistema é inteiro desde a 1.5.x: o monitor mostra 328,9 e o campo fica com 328
(`formatWeightForField` e `Math.floor`). Essa política é testada (`equipment:contract:verify`) e usada nos
relatórios.

**Decisão.**
- **Truncamento mantido.** Não houve comprovação de necessidade de mudar o contrato, e mudá-lo alteraria
  GMD e arrobas históricos.
- **Metadado preservado.** O valor bruto da balança fica em `balanca_leitura.kg_bruto` na pesagem nova.
- **Histórico intacto.** Nada do histórico é recalculado.

**Revisão futura.** Se o proprietário decidir por arredondamento ou decimal, a mudança vale só para as
pesagens novas. A regra precisa de versão própria e de relatório de impacto.
