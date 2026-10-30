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

## ADR-053 — Linha do tempo do animal validada na transação (P05, P07, P12)

**Decisão.** `domain/animalTimeline.js` define as invariantes de uma série de pesagens:
1. um Cadastro e nada antes dele;
2. uma Saída e nada depois dela;
3. no mesmo dia vale a ordem Cadastro → Manejo → Saída;
4. no máximo um Manejo oficial por animal e dia;
5. toda data é um dia civil válido.

**Como é aplicada.** `assertAnimalTimeline` roda **dentro** da transação de `createEntry`, `updateEntry`,
edição em massa e repesagem. Ela valida a série inteira depois da mudança, e o IndexedDB serializa as
gravações concorrentes do mesmo animal.

**O que é recusado.** Só a violação **criada pela mudança**. Uma anomalia antiga (por exemplo, dois Manejos
no mesmo dia aceitos de propósito na importação) não trava lançamento em outra data.

**Importação.** A importação inteligente mantém a opção explícita "aceitar duplicatas" (decisão já
existente); só o caminho de lançamento, edição e repesagem segue a regra de um Manejo por dia.

**Data impossível.** `calculateWeightGain` passa a validar também a data anterior com `parseCivilDate`.

## ADR-054 — Derivados das pesagens reconciliados, idempotentes e na mesma transação (P04, P08, P09, P13)

**Decisão.** Lotes, movimentos, GMD e estado do animal são reconciliados, e não refeitos do zero.

**Regra pura.** `domain/weighingMovements.js` deriva da série ativa:
- os movimentos esperados (Entrada, motivo da Saída, Mudança de lote);
- as permanências em lote.

**Reconciliação no adapter.**
- `reconcileWeighingMovements` cancela, com auditoria, o movimento cuja pesagem saiu ou mudou, e cria o
  que falta.
- Movimento sem `pesagem_id` (movimentação própria, fase B) nunca é tocado.
- `rebuildAnimalLotProjection` só grava a diferença.
- `recalculateAnimalSeriesInTransaction` recalcula os derivados na mesma transação.

**Uso.** `reconcileAnimalAfterChange` (lotes → movimentos → derivados → estado) roda no fim de toda
gravação de pesagem. Se algo falhar, nada fica gravado: não existe "gravou, mas o GMD ficou velho".

**Reparo.** `reconcileAllAnimalDerivations` limpa bancos com resíduo de versões anteriores, em blocos e de
forma idempotente. A manutenção chama com backup antes.

**Custo medido.** `salvamento_local` com 36 mil pesagens: p95 de 164 → 189 ms (orçamento de 250 ms).

## ADR-055 — Falha do banco local é erro, nunca lista vazia (P10)

**Decisão.**
- **Serviço:** `weighingService.listEntries` lança `WEIGHING_STORAGE_001` com mensagem para o operador
  ("Nada foi apagado…"), em vez de devolver `[]`.
- **Lançamento:** mostra um aviso com "Tentar de novo" e bloqueia o salvar enquanto os dados não carregam.
- **Relação e relatórios:** já propagavam o erro (react-query `isError`, `loadEventRows`).

## ADR-056 — Identidade legada cautelosa (P11) e fechamento do dia (P17)

**Identidade legada.** Uma pesagem antiga sem `animal_id` só é ligada a um animal pelo número + marca quando
essa identificação pertence a **um** animal.
- **Caso ambíguo** (número reaproveitado na marca): ela não entra em nenhum histórico
  (`ambiguousLegacyKeys`) e aparece em `logicalIntegrity().warnings` para conciliação manual.

**Fechamento do dia.**
- **Fechar:** fecha **todas** as sessões abertas da data. Antes fechava só a primeira; um lançamento depois
  do fechamento abria outra sessão, que ficava aberta.
- **Reabrir:** reabre a sessão mais recente.
- **Preservado:** lançar num dia fechado continua permitido, como antes. Mudar isso é decisão de produto.

## ADR-057 — Backup: comando único verificado por leitura de volta (P19, P21, P24, P26)

**Decisão.**
- **Comando único.** `createBackupNow` grava o backup completo e o lê de volta pelo IPC `app:readUserFile`.
  Esse canal tem a mesma contenção da gravação: só a pasta de dados do usuário, sem caminho vindo do renderer.
  Na leitura de volta são conferidos:
  - o SHA-256 do arquivo contra o gravado;
  - o JSON;
  - o formato, o SHA-256 do conteúdo e as contagens;
  - o esquema (`dryRunRestore`).

  Só então o backup conta como **verificado**, e o resultado vai para `backupHistory` (`verify`).
- **Compatibilidade.** `createDatabaseBackup` e `createFullDataBackup` passam a delegar ao comando único.
- **Situação da proteção.** `getBackupStatus` informa a proteção (`VERIFICADO`, `NAO_VERIFICADO` ou
  `SEM_BACKUP`), o último backup verificado e o estado de cada arquivo da pasta (verificado, falhou ou não
  verificado).
- **Exportação não é backup.** A exportação de pesagens (`type: weighing-entries-export`) é recusada na
  restauração com mensagem própria (`DEXIE_BACKUP_007`).
- **Dado sensível.** O aviso aparece na tela e no guia. A criptografia opcional fica para F22.
- **Reparo geral.** `reconcileDerivations` (ADMIN, `maintenance.migrate`) cria um backup verificado antes de
  rodar `reconcileAllAnimalDerivations`.

## ADR-058 — Operações de rebanho com efeito único no livro (F01, F02, F03, F17)

**Decisão.**
- **Operação.** Uma operação tem cabeçalho (`operacoes`) e itens por animal (`operacaoItens`). A confirmação
  roda numa **única transação Dexie** sobre todas as stores. As pesagens geradas usam o mesmo
  `createEntry`/`bulkDeleteEntries` do Lançamento: o Dexie aninha essas transações na da operação. Assim a
  operação herda linha do tempo, movimentos, lotes, derivados e estado. Um animal inválido desfaz a operação
  inteira.
- **Efeito no livro.** Cada item gera um único efeito:
  - **ENTRADA:** movimento da operação, com o tipo real (Compra, Nascimento…) e sem pesagem. Se houver peso, o
    Cadastro gerado **adota** esse movimento. A reconciliação casa o movimento adotado pela pesagem, não pelo
    tipo, e por isso não cria uma segunda entrada.
  - **SAÍDA:** pesagem de Saída com `operacao_id`. O movimento SAIDA deriva dela, e "uma saída por animal"
    continua valendo.
  - **MOVIMENTAÇÃO:** movimento INTERNO sem pesagem. Ele entra como `lotEvents` na derivação de permanências e
    movimentos (`weighingMovements`): a projeção não desfaz a movimentação e a pesagem seguinte no lote novo
    não gera outra mudança de lote.
- **Entrada sem peso.** O animal fica `PENDENTE_PESAGEM`; sem número, fica `PENDENTE_IDENTIFICACAO`. O
  primeiro Cadastro com o mesmo número e marca, sem `animal_id`, usa o animal pendente: não cria outro.
- **Peso.**
  - Venda e Abate exigem peso, medido ou informado no negócio.
  - Morte, Doação e Transferência aceitam saída sem peso.
  - O Ajuste de saída (motivo "Outros", só por operação) aceita saída sem peso.
- **Cancelamento.**
  - Exige motivo; a operação não é apagada.
  - **Entrada** com pesagens ou movimentações posteriores não pode ser cancelada. Sem histórico posterior, o
    animal sai junto.
  - **Saída** cancelada reabre o animal.
  - **Operação legada** se corrige pela Relação de Pesagens.
- **Inventário (F17).** É calculado puro sobre o livro (`domain/inventory.js`), pela **data do evento**:
  `saldo_inicial + entradas − saídas = saldo_final`, com a classe tirada do subtipo da operação ou do tipo.
  - **Por lote ou propriedade:** permanências, com transferências internas separadas.
  - **Conferência:** compara com o cadastro (entrada e `data_saida`) e lista divergências por animal, sem
    corrigir nada.
- **Permissões.** Valem as ações existentes (`weighing.read`, `weighing.write`, `weighing.edit`), checadas no
  serviço.

**Limites desta versão.**
- Retorno de um animal que já saiu do rebanho não é aceito na Entrada.
- A categoria no filtro do inventário é a **atual** do animal; a era e a categoria na data entram com F05.
- Pasto não tem cadastro próprio; a movimentação é por lote e propriedade.

## ADR-059 — Idade com precisão, era por idade, dentição, livro de identificadores e dossiê (F04–F07, F15)

**Decisão.**
- **Nascimento.** O animal guarda:
  - `nascimento_data`;
  - `nascimento_precisao` (DIA, MES, IDADE_DECLARADA ou DESCONHECIDA);
  - `nascimento_fonte`;
  - `idade_declarada_meses` e `idade_referencia_data`.
- **Idade.** É calculada na hora para a data pedida (`ageAt`), em meses completos por aniversário. O fim de mês
  conta como aniversário de quem nasceu num dia que aquele mês não tem.
  - **Mês estimado** dá uma faixa (mínimo e máximo).
  - **Idade declarada** soma os meses desde a data de referência.
  - **Sem dado**, a idade é desconhecida.
  - A idade nunca é gravada como fato e nunca vem do peso.
- **Era.** É o rótulo da faixa de idade, vindo da política `age-policy:local`. Essa é uma chave nova e aditiva:
  não duplica as cinco chaves existentes. O campo `era` legado (classe por peso) não muda.
- **Categoria produtiva.** A informada no animal prevalece. A sugestão por sexo e faixa só existe com a
  política ligada, e vem desligada por padrão.
- **Dentição.** Fica em `avaliacoesDenticao` (0, 2, 4, 6 ou 8 dentes, `origem OBSERVADA`), com cancelamento
  auditado.
- **Identificadores (F06).** Usam o livro imutável `movimentosIdentificadores`: a situação de um código é a da
  última ação válida (`identifierStock.TRANSICOES`).
  - **Recebimento:** por faixa, atômico.
  - **Aplicação:** grava um movimento e um `animalIdentificadores` na mesma transação. Aplicações
    concorrentes são serializadas.
  - **SISBOV e RFID:** um ativo por animal; um código já aplicado nunca volta a ficar disponível.
  - **Troca:** fecha o identificador antigo com motivo e mantém o `animal_id`.
  - **Conferência física:** só compara; não ajusta nada.
- **Marcas a Fogo (F07).** Só os rótulos da tela, do menu e do campo do cadastro mudam. A store `marcas`, as
  chaves, as colunas dos relatórios e os cabeçalhos de importação não mudam, por compatibilidade.
- **Dossiê (F15).** É montado de forma pura (`traceability.buildDossier`). A carência é a data da aplicação
  mais os dias do medicamento ou do snapshot da posologia; sem esse dado, ela é desconhecida, nunca zero. O
  que não é sabido vai para a lista de desconhecidos. O dossiê traz o aviso explícito de que não é
  certificação.
- **Permissões.** Valem as ações existentes, checadas no serviço:
  - `animal.read` para ler;
  - `weighing.write` para dentição e aplicação;
  - `weighing.edit` para corrigir;
  - `registry.write` para receber, devolver, bloquear e liberar;
  - `settings.manage` para a política.

**Limites.**
- A identificação **principal** (número visual da pesagem) continua sendo corrigida pela edição do Cadastro. O
  estoque controla os brincos e códigos adicionais.
- A propriedade de nascimento e a geolocalização da origem ficam como "não informado" até haver dado real.

## ADR-060 — Posologia versionada, dose sugerida × aplicada e carência no abate (F08, F09, F10)

**Decisão.**
- **Posologia.** Fica na store `posologias` (v9), por medicamento, com versão e status: RASCUNHO, APROVADA,
  SUBSTITUIDA ou SUSPENSA.
  - **Modos:** PROPORCIONAL (dose ÷ kg) ou FAIXAS da bula, validadas sem sobreposição.
  - **Arredondamento:** é da regra (NENHUM, PROXIMO, ACIMA ou ABAIXO, com passo); não há arredondamento
    universal. A regra pode ter dose mínima e máxima.
  - **Carência:** de carne e de leite, separadas. `null` significa desconhecida, nunca zero.
  - **Aprovação:** exige a regra completa (`missingForApproval`) e um responsável técnico.
  - **Imutável depois de aprovada:** a nova versão aprovada fecha a anterior na véspera (SUBSTITUIDA).
  - **Legado:** o `dose_padrao` em texto continua só como referência.
- **Cálculo.** `computeDose` é puro e nunca lança exceção. Ele só calcula com posologia APROVADA, completa e
  vigente na data, e com peso real.
  - Peso de BALANCA, MANUAL, PESAGEM_REGISTRADA ou INFORMADO calcula. ESTIMADO ou PROJETADO bloqueia.
  - Peso antigo (mais de 30 dias) e peso informado geram aviso.
  - Não há produto nem dose fixa no código: o gate procura nomes comerciais.
- **Aplicação.** `posologia_id` exige a dose aplicada e `dose_confirmada`. O registro guarda:
  - `posologia_snapshot`, a cópia da regra;
  - `dose_sugerida` e `dose_aplicada`;
  - `peso_base_*`, o peso usado;
  - `carencia_carne_ate` e `carencia_leite_ate`, calculadas na transação (`withdrawalEnd`), e
    `carencia_conhecida`.
- **Lançamento.** O painel pede a sugestão ao serviço e não faz conta de dose.
  - Na pesagem automática, só sugere com o peso **estável** da Fase A.
  - Ao salvar, se o peso liberado pelo portão for diferente do peso usado na dose, a gravação é recusada.
  - Os campos de dose calculada nunca seguem para o próximo animal nem para o `sessionStorage`.
- **Carência na saída (F10).** A confirmação da Saída verifica as aplicações ativas na data
  (`withdrawalStatus`):
  - **ABATE** com carência de carne aberta é **bloqueio**, salvo `liberacao_carencia` registrada. A
    liberação exige `registry.write`, responsável técnico, motivo, evidência e data, e é auditada como
    `LIBERAR_CARENCIA`.
  - **Venda, transferência e doação** com carência aberta geram **aviso**.
  - **Carência desconhecida** recente (120 dias) gera **aviso**.
  - **Morte e ajuste** não são verificados.
