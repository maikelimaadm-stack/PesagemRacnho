# PROMPT MESTRE PARA CLAUDE CODE — PROJETO PESAGENS
## Missão única de execução integral: estabilizar o sistema e depois implementar a gestão pecuária, rastreabilidade interna, inteligência gerencial e reorganização de backup/configurações

**Autorização expressa do proprietário:** este prompt AUTORIZA o Claude Code a planejar tecnicamente, programar, criar e modificar arquivos, adicionar testes, documentar, executar comandos, criar uma branch dedicada, fazer commits e abrir **uma PR DRAFT** com TODA a missão descrita. A autorização cobre, na ordem, **P01–P26 (correções/investigações)** e **F01–F26 (novas capacidades/melhorias)**. NÃO é autorização para fazer merge, aplicar migrations destrutivas em dados de produção, publicar uma release/tag, modificar a configuração administrativa da conta do GitHub, acessar serviços externos ou aprovar a própria entrega. O proprietário fará o merge manualmente após receber as evidências.

**Instrução importante:** o anexo de levantamento foi escrito quando a implantação AINDA não estava autorizada. Essa restrição histórica do anexo está expressamente REVOGADA por esta autorização atual. Todas as demais salvaguardas do anexo continuam obrigatórias. O anexo está incorporado integralmente ao fim deste arquivo, portanto este prompt é autossuficiente.

---

## 00 — Identidade da missão, referências e resultado obrigatório

- **Repositório:** `maikelimaadm-stack/projeto-pesagens` — NÃO confundir com `MAIKE`, `CONTROLE-DE-ESTOQUE`, `MAK Gestão` ou `Makpesca`.
- **Último snapshot auditado:** `origin/main` no SHA `9392274972d41efb29007122c7a9ed826be9b283`, app `1.5.6`, banco local IndexedDB/Dexie **v8**, desktop React/Vite/Electron, test workflow `Testes` verde no run `40916259078` de 29/10/2026. **Revalidar `main` no início; nunca assumir que permanece nesse SHA.**
- **PR #1 de distribuição Supabase:** antiga, com conflito; **ignorar e não tocar**, não usar como base, não atualizar, não resolver, não mesclar, não trazer Supabase ou feed de releases para esta missão. Se houver outras PRs/branches em andamento, identificar colisões e manter o trabalho isolado.
- **Nova branch:** sugerida `claude/pesagens-estabilizacao-e-gestao-integrada-01` baseada na `origin/main` atual. Uma única **PR DRAFT** para esta autorização, com **commits temáticos e checkpoints internos**, não 52 PRs. Se já houver uma PR DRAFT criada por este mesmo trabalho, **continuar na mesma branch/PR**, não abrir outra. Não forçar merge ou dar ready.
- **Resultado de produto:** aplicativo offline desktop Windows utilizável em curral, com pesagem segura, eventos e inventário animal confiáveis, cadastros/rastreio, sanidade opcional com referências responsáveis, análise sazonal e projeções, backup/restauração claros e parametrização organizada.
- **Resultado de engenharia:** código realmente implementado, telas navegáveis, persistência local, migrações reversíveis no sentido operacional por restauração de backup, testes reproduzíveis, evidências, documentação atualizada, CI verde, instalador diagnóstico quando possível; nenhuma funcionalidade vazia/fictícia.
- **Filosofia:** sistema simples e gratuito, sem servidor obrigatório, nuvem, assinatura, SaaS, novos logins, controle de acesso empresarial extra ou telemetria. **Preservar** o modelo de usuários/permissões locais já existente em `main` — não removê-lo por conta própria — e não ampliá-lo sem necessidade funcional.

### Regra de execução contínua

1. Este é **um pedido de IMPLEMENTAÇÃO**, não de simples auditoria, protótipo ou planejamento. Audite rapidamente para reproduzir e delimitar, depois **implemente**.
2. Execute **todas as correções primeiro**; só entre nas implantações depois de estabilizar a base e passar os gates de correção. Em seguida implemente **todas as 26 melhorias** com seus gates. Mantenha a mesma missão, branch e PR DRAFT.
3. Faça commits pequenos, coerentes e recuperáveis por subetapa, para isolar regressões; mantenha a PR DRAFT até o proprietário revisar tudo. Uma missão única não significa um commit monolítico.
4. **Não interrompa a execução somente para recomendar melhorias ou perguntar o que fazer em seguida.** Decida detalhes reversíveis e documente ADRs. Quando houver necessidade de informação que não possa ser inferida com segurança (ex.: bula específica, regra oficial, firmware real, dia de nascimento desconhecido), implemente a experiência de cadastro/validação e deixe o valor **desconhecido/pendente** em vez de inventar dados.
5. Se recursos do ambiente ou limites de contexto impedirem terminar os 52 itens, **registre a cobertura exata**, estado por item, commits, testes e próximos comandos em `docs/evidence/pesagens-integrada/CONTINUIDADE.md`; deixe a PR **DRAFT**, nunca diga que a missão está completa sem prova. Retome da última etapa, não recomece a análise.

---

## 01 — Contratos inegociáveis de segurança e de domínio

### 01.1 Integridade, SSOT, persistência e compatibilidade

- **SSOT:** `animal.id`/`animal_id` é a identidade canônica. Número visual, marca a fogo, RFID e identificador oficial são **atributos e vínculos temporais**, não identidade primária. Números repetidos/SN não autorizam vinculação implícita. O catálogo de referência (raças, marcas a fogo, categorias, propriedades etc.) permanece normalizado com IDs estáveis.
- Diferencie **fato imutável/auditável** (entrada, saída, pesagem, sanidade, movimento, troca de brinco), **projeção** (peso atual, lote atual, saldo, status), **parâmetro** (regra vigente) e **estimativa** (nascimento aproximado, GMD previsto, projeção); nenhuma estimativa pode ser gravada como fato.
- Defina invariantes numa camada de domínio/serviço e aplique-os nas escrituras Dexie **dentro da transação**; validação só em `jsx` é insuficiente. Nenhuma dupla baixa de animal/identificador, nem dois movimentos para um único evento.
- Preserve soft-delete/auditoria, identidade das entidades, associação da sanidade e os dados comerciais. Correção/cancelamento de fato histórico deve produzir nova projeção e cancelar ou retificar relacionamentos dependentes sem apagar o rastro original.
- Mantenha os contratos corretos de GMD (zero real, negativo real, `null` se sem base; qualidade de intervalo configurável 7/14/21/28), formato pt-BR, saída sem peso e exclusão dos GMDs não confiáveis de agregações; preserve distinção kg vivo/@ vivo/kg carcaça/@ carcaça.
- **Dexie schema:** nunca editar retrospectivamente `STORES_V7`, `STORES_V8`, nem alterar histórico de versão existente. Se houver novas stores/índices, introduza versão aditiva e migração idempotente/retomável (`v9` ou a próxima vigente real), com manifest/backup/versioning, lista de stores, limpeza operacional, restore, testes de upgrade v6/v7/v8 e prova de que nenhum dado legado se perdeu. Não deixar dados duplicados pelas tentativas de backfill.
- Backup existente de `v8` deve ser restaurável em versão nova; bloqueie arquivos de esquema mais recente. Atualização do desktop nunca pode apagar IndexedDB. Teste migração e restauração em **instâncias sintéticas isoladas** com backup físico durável; **não** manipule perfis/arquivos reais do proprietário. Acesso do app aos arquivos sempre por Electron IPC seguro, sem expor Node ao renderer.
- Captura de balança e entradas manuais coexistem, **mas seus estados e origens precisam ser explícitos**. Nenhum peso deve ser promovido artificialmente a estável.
- Não criar sincronização remota, contas online, dependência de rede, APIs pagas ou certificação oficial fictícia.
- Não assumir assinatura de instalador. O build diagnóstico Windows atual é não assinado; preservar e relatar.

### 01.2 Segurança operacional e regras veterinárias/regulatórias

- **Sanidade:** um motor opcional de **sugestão de dose** não é prescrição. Regra exige cadastro explícito e validado pelo responsável veterinário, produto/apresentação/concentração, espécie, indicação, via, unidade, bula de origem e versão, validade e política de faixas/arredondamento; se incompleto, **não calcular nem sugerir uma dose inventada**. Dose aplicada só é registrada após confirmação humana. Não assumir regra de Dectomax como universal nem embutir dose clínica não validada.
- **Carência:** distinguir carne e leite, espécie, produto e regime, registrar data de aplicação, data de liberação, pendência e evidência; **bloquear ou exigir liberação técnica explícita nas operações de abate conforme regra cadastrada**, deixando pendência visível quando o cadastro não é confiável; nunca equiparar doação, venda para recria, morte e abate.
- **Rastreabilidade:** compatibilidade de dados não equivale a homologação. O **SISBOV** é programa oficial, o **PNIB** possui cronograma de implementação, e a **EUDR** possui obrigações próprias. Não exibir selo “certificado UE”, “conforme SISBOV”, “habilitado para exportar” ou integração oficial sem auditoria, credenciais, base legal e comprovação real. Permitir coleta de proveniência/geolocalização/documentos com origem, data e qualidade conhecidos; exportar dossiê **interno** como preparo.
- Fontes oficiais para consulta quando necessário: `https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/cgtqa/dpc/sisbov`, `https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/rastreabilidade-animal/pnib`, `https://environment.ec.europa.eu/topics/forests/deforestation/regulation-deforestation-free-products_en`. Verificar atualização antes de documentar qualquer prazo; não codificar prazos regulamentares como constantes eternas.
- Arquivos JSON de backup podem conter dados sensíveis e hashes de senha. Não enviar para rede/servidores, não expor via logs/diagnósticos, proteger arquivos externos, respeitar permissões existentes e não destruir backups anteriores. Se houver opção de criptografia, exigir frase-senha e fluxo de recuperação explicados, com envelope versionado e sem armazenamento da senha em texto puro.

### 01.3 Experiência de uso

- Manter identidade visual existente (ModeloBase1, componentes locais, tokens de CSS), navegação intuitiva e densidade adequada a desktop/curral; telas não podem virar catálogos gigantes de campos.
- **Lançamento de Pesagens permanece operacionalmente rápido**: identificação → leitura estável/captura manual → apartação/lote/sanidade opcionais → confirmar → próximo animal. Entrada/saída por documento em novas telas próprias; o lançamento pode iniciar/associar operação existente, sem duplicar dados de cabeçalho a cada animal.
- Otimizar para teclado, Enter, navegação, popups e múltiplos animais. Estados carregando/vazio/erro distintos; confirmações destrutivas claras; experiência responsiva também em janelas menores.
- Não quebrar atalhos existentes, seleção de animal, SN, repesagem ou relatório impresso.

---

## 02 — Preparação obrigatória e auditoria inicial de execução (sem gastar dias só auditando)

1. `git status --short; git branch --show-current; git fetch origin --prune; git rev-parse origin/main; git log -5 --oneline origin/main; git remote -v`. Se working tree tiver mudanças estranhas, **não apagá-las**. Criar branch isolada a partir da main limpa, com segurança para não perder trabalho paralelo.
2. Ler `package.json`, workflows `.github/workflows/testes.yml` e `instalador.yml`, schema atual, documentação/ADRs recentes, serviços de pesagem, sanidade, autenticação, importação, relatórios, equipamento, backup, opções de manutenção e navegação. Verificar se há `CLAUDE.md` ou instruções de repo (no snapshot auditado não havia raiz `CLAUDE.md`); respeitá-los caso existam.
3. Executar baseline: `npm ci`, `npm run build`, `npm run test:unit`, `npm run test:quick`, `npm run e2e:electron:verify` (em Linux CI usar `xvfb-run -a ...` como o workflow). Fazer relatório curto de problemas **anteriores** à missão e tempos medidos, não usar testes velhos como prova de funcionalidade nova.
4. Criar `docs/evidence/pesagens-integrada/MATRIZ-52-ITENS.md` com **52 linhas explícitas**, ID, diagnóstico (`confirmado / risco reproduzido / risco não reproduzido / decisão preservada`), código modificado, teste automatizado, evidência, status final (`PASS / FAIL / BLOQUEADO / PREEXISTENTE`) e justificativa. NUNCA apagar IDs ou converter hipótese em fato sem teste.
5. Montar fixture de migração/backup em perfis Dexie efêmeros; criar teste de restauração real sobre cópia sintética (incluindo v6/v7/v8 quando fixtures existem). Inspecionar esquema e checagem de saúde, e criar rollback operacional por restauração. Registrar hashes das amostras sem conteúdo sensível.
6. Fixar arquitetura simples em `docs/arquitetura-produto/`: entidades, relacionamentos, eventos e projeções, invariantes temporais, precisão de idade/era e termos, política de categorias, contrato de status, política de anexos e arquivos, e matriz de navegação. **Arquitetura e implementação devem evoluir juntas; não parar em desenhos.**
7. Criar branch sugerida e PR DRAFT assim que houver commits reais + escopo descrito. **Não usar a PR #1**. Desabilitar qualquer CI que publique tag/release no decorrer da missão? **Não**: apenas evitar acioná-lo; não desativar proteções legítimas.

---

# FASE A — PRIMEIRO CORRIGIR TODOS OS PROBLEMAS P01–P26

**Barreira:** não iniciar recursos F01–F26 até concluir os itens P relevantes com implementação/testes e obter baseline dos gates de estabilidade. Uma hipótese não reproduzida pode ser fechada com teste negativo e evidência, sem inventar modificação. P15 é decisão intencional: não mudar o truncamento só para “fechar item”; registrar a política e a compatibilidade.

## A1 — Captura segura de peso e S3 (P01, P02, P03, P15, P16)

**Arquivos-alvo iniciais:** `src/modules/equipment/application/scaleService.js`, `domain/scaleContract.js`, `domain/stabilityTracker.js`, adaptadores `s3BluetoothAdapter.js`, `s3SerialAdapter.js`, `simulatorAdapter.js`, `src/pages/LancamentoPesagensIndividuais.jsx` e ciclo do contexto.

Implementar **máquina de estados explícita da captura**, com `connectionEpoch`, `readingSequence` monotônica, timestamp/instante monotônico da leitura, `captureCycleId` ou token do animal/lançamento, origem (`S3/BLE/USB/simulador/manual`), indicação de estabilidade e indicador de leitura já consumida. Sempre invalidar leitura estável na desconexão, erro do adaptador, troca de dispositivo, troca de ciclo, reinicialização e situação de leitura vencida. Uma leitura instável nunca pode virar estável por `timeout`; o timer do S3 só poderá concluir estabilidade se houver sequência de leitura vigente, conexão ativa, janela e critérios do tracker satisfeitos — documentar firmware que transmite apenas quando varia, tratar silêncio por desconexão e telemetria ausente. O próximo animal **não herda** peso validado do animal anterior. Conferir identificação, sessão e token no instante da confirmação; debounce/duplicate submit e concorrência devem ser idempotentes. Usar caminho manual explicitamente, com campo peso habilitado e origem gravada. O monitor pode mostrar peso transitório sem liberá-lo automaticamente para salvar. Se for mantida a apresentação de peso inteiro com `Math.floor`, não perder metadados da leitura bruta, não recalcular histórico silenciosamente e documentar política — sem mudar o contrato intencional sem comprovação de necessidade. Permitir edição manual consciente sem o próximo tick da balança sobrescrever o operador.

Testes: animal A=420 depois B com campo limpo; sem nova leitura estável B não salva por engano; leitura instável por >5s não vira estável; fonte desconectada e reconectada invalida cache; zero ou peso ausente não vira pesagem; cancelamento do animal não consome peso indevidamente; troca de dispositivo e evento BLE/USB; dois cliques Enter; repesagem e leitura tardia; peso bruto 328,9 mostra política atual e metadados; S3 simulador emite só em mudança. Deixar **roteiro manual para equipamento físico** que exija teste de plataforma vazia, oscilação, dois bois consecutivos, falha do Bluetooth e firmware; não afirmar ter feito teste físico sem balança disponível.

## A2 — Integridade de identidade, cronologia e lançamentos (P04–P13, P17)

**Arquivos-alvo:** `src/modules/weighing/application/weighingService.js`, `infrastructure/weighingDataAdapter.js`, `domain/repesagem.js`, `domain/weighingSeries.js`, `domain/weighingCalculations.js`, `src/modules/animals/domain/animalHistory.js`, `src/modules/import/domain/animalIdentity.js`, importadores, armazenamento, sanidade, projeções e consumidores.

1. Formalizar uma função/regra de **linha temporal por animal**: Cadastro/entrada antes dos Manejos e Saídas, uma saída definitiva efetiva, sem lançamentos depois dela; ao mover a data do Cadastro para frente ou da Saída para trás, validar TODA série. Eventos no mesmo dia precisam de precedência sem inventar horário. Rejeitar inconsistência antes do commit, sem mutação parcial.
2. Garantir que `createEntry`/import/bulk/repesagem compartilhem validação **transacional e idempotente** de uma pesagem oficial de Manejo por animal e dia, sem bloquear por engano operação distinta de entrada/saída quando permitida. Não depender exclusivamente do formulário. A substituição usa fluxo de repesagem e motivo auditável, com sanidade vinculada tratada conforme regra já existente.
3. Para cancelamento, atualização, bulk, retroatividade e repesagem, reconciliar no mesmo contrato: pesagens ativas, `movimentosAnimais`, `animalLotes`, `animais` projeção, estado e derivados. Movimentos cuja pesagem geradora foi cancelada não podem ficar ativos; operações legítimas de movimentação sem pesagem (fase B) não podem ser apagadas pela reconstrução de pesagens. O identificador de origem do evento deve ser rastreável.
4. Se recálculo de série falhar após commit, usar unidade transacional conjunta **ou** protocolo durável de pendência + reparação idempotente; nunca retornar sucesso integral com GMD obsoleto invisível. Preservar desempenho para histórico longo.
5. Edição de número/marca/identificadores: conferir colisão entre animais, corrigir `animalIdentificadores` e perfil na mesma transação; não renomear número no passado como se tivesse sido sempre assim, salvo compatibilidade explicitamente separada de fato histórico. Não fundir registros legados por coincidência ambígua de número+marca; oferecer lista de exceções/reconciliação sem atribuição silenciosa.
6. Validar datas históricas pelo `parseCivilDate` (inclusive dia 30/02). GMD inválido é `null` com anomalia explicada; nunca normalizar data impossivelmente. Preservar GMD negativo/zero real, faixas e advertências.
7. `listEntries` e agregadores: erro de armazenamento deve propagar estado **error**, jamais lista vazia e total zero. Integrar feedback UI, impedir exportar relatório como vazio em falha de DB. Revisar caches, abertura/fechamento de sessão e refresh pós-importação/repesagem.
8. Reconstrução de permanência em lote idempotente: reaplicar ao mesmo estado lógico não deve gerar novo conjunto de soft-delete e inserções indefinidamente; respeitar datas, origem dos eventos, vínculo independente de pesagem, auditoria e desempenho.

Testes com fake-indexeddb ou Dexie real sintético: primeira entrada; Cadastro retroativo correto/ilegal; alteração de Cadastro posterior a Manejo; Saída antes de Manejo e depois de Saída; duas solicitações iguais concorrentes; mesma data diferentes animais e tipos; idempotência por ID/nonce; cancelamento de evento com mudança de lote; edição de lote retroativa; troca de marca e duplicação de brinco; SN e identificação legada; cancelamento de pesagem com medicamento; falha injetada durante commit/recalculo; reparação na reabertura; falha de storage, datas impossíveis, 10/100/10k eventos, preservar sinais do GMD.

## A3 — Proteção de backup existente, manutenção e configurações (P14, P19–P26)

**Correções antes das inovações:** eliminar duas ações de backup indistinguíveis da página (`createDatabaseBackup` e `createFullDataBackup` chamam a mesma persistência); usar **um comando** que explicitamente realiza backup completo. Preservar APIs antigas compatíveis, se testes/consumidores necessitarem, com delegação ao mesmo SSOT. Corrigir rótulos enganosos e diferenciação de JSON de exportação de pesagens vs JSON de backup restaurável. Remover erro de UX de `listBackups`: apresentar último backup **realmente verificado** separado de “arquivo encontrado”, e estado `falha/indisponível/não verificado`. Corrigir docs de versões antigas/banquinho v7, sem expor detalhes técnicos ao operador. A proteção já existente de backups pré-migração/import/restore/limpeza e suas permissões **não pode enfraquecer**. Não introduzir ainda todo o redesenho F19–F26 neste estágio, apenas estabilizar estrutura, nomenclatura, integridade e serviços que suportarão a evolução.

**Risco de dados:** não assuma que backup local no mesmo PC protege contra incêndio/defeito do disco. Testar backup/restauração offline, integridade de hash, truncamento, caminho inválido, arquivo do esquema mais novo, legado v6/v7/v8, espaço insuficiente, arquivo sensível, privilégios ADMIN/GESTOR, confirmação de restauração. Restauração que substitui usuários deve seguir o contrato de login pós-restore.

## A4 — Operação, entrega e evidências da FASE A (P18 e cobertura residual)

- Atualizar testes e scripts existentes que legitimamente dependem da tela antiga; não fazer testes passarem apenas alterando `assert.match` sem garantir comportamento equivalente. Manter os perfis de usuário, dados comerciais, importação/reconciliação, sanidade, relatório, versão e build.
- Validar **A1+A2+A3** no aplicativo Electron, conferir restauração e integridade dos dados. Rodar `npm run build`, `npm run test:quick`, `npm run e2e:electron:verify`, `npm run storage:backup:verify`, `npm run storage:import-restore:verify`, `npm run weighing:repesagem:verify`, `npm run animal:history-integrity:verify`, mais gates novos.
- Comparar massa média e alta com baseline; não aceitar regressão significativa sem justificativa e plano. Não executar massa de 250k sempre na CI rápida se arriscar timeout: manter benchmark completo em gate dedicado e um smoke de performance estável em CI.
- P18 branch protection é configuração administrativa do GitHub: **não tentar alterá-la sem permissão/admin**. Registrar recomendação exata de checks a tornar obrigatórios na `main`, mas não marcar P18 como alteração efetiva da conta se não foi feita. Instalador Windows: validar workflow e artefato diagnóstico por Actions quando viável; **sem criar tag/release**.
- Atualizar `MATRIZ-52-ITENS.md` com P01–P26 e links para testes. **Gate A = só prosseguir quando todas as correções comprováveis estiverem tratadas e gates A verdes; bloqueios externos identificados, nunca escondidos.**

---

# FASE B — DEPOIS IMPLANTAR TODAS AS NOVAS CAPACIDADES F01–F26

**Não transformar as fases B em maquetes.** Uma nova tela só conta como entrega se existir serviço de domínio, persistência, validações, auditoria, dados recuperáveis em backup, testes de integração e fluxo real de criação/edição/cancelamento/consulta apropriado.

## B0 — Fundação do novo domínio e migração segura (transversal)

1. Modelo de **operações** com cabeçalho e participantes/itens, identidade técnica estável, tipo, status, data civil, parceiros, origem/destino, propriedades, documentos, valor/quantidade e auditoria. Vincular pesagens, animais e movimentos existentes com chaves; **não clonar animal** nem gerar automaticamente segundo movimento.
2. O livro canônico de movimentações deve ser derivado ou integrado a `movimentosAnimais` de maneira inequívoca. Desenhar relação entre evento operacional e peso: um peso pode estar associado à compra/venda, **mas não é pré-requisito para existir entrada/saída**. Uma operação que movimenta 80 animais deve gerar exatamente 80 efeitos de saldo, não 80 cópias divergentes de cabeçalho; cancelamento/revisão reconciliam todos os vínculos.
3. Extensão de schema versionada, índices para `animal_id`, período, tipo, `operacao_id`, identificadores, lotes; manter escalabilidade. Fazer migrações com projeção inicial derivada dos lançamentos legados: **marcar eventos convertidos e deduplicar por origem**; não transformar uma venda legada em segunda venda real nem criar compra financeira indevida. Registros não inferíveis ficam `LEGADO/SEM_DOCUMENTO/PENDENTE_CONCILIACAO`, jamais inventar informação.
4. Criar integrações de navegação com guardas de permissão local existente. Campos de data/valor/documento opcionais ou obrigatórios conforme evento, sem impor GTAs a casos que não se aplicam; validação por situação e política.

## B1 — Gestão real do rebanho (F01, F02, F03, F04, F05, F06, F07, F15, F17)

### F01 — Entradas: Compra, Transferência recebida, Nascimento e Ajuste

- Tela dedicada de **Entradas** com lista, filtros, cabeçalho (data, origem, propriedade, fornecedor/parceiro, número de animais, tipo, GTA/NF quando pertinente, preço total/per capita, frete, observações) e grade de animais; rascunho, conferência, confirmação, cancelamento e correção auditável.
- Permitir animais novos e animais previamente cadastrados quando movimento legalmente coerente. Entrada **sem peso** e/ou ainda sem identificação definitiva gera registro de rebanho pendente de pesagem/identificação, sem `peso=0` e com fluxo de identificação posterior. Atribuição de número deve impedir duplicidade no escopo pertinente. Nascimento pode registrar mãe quando conhecida, mas sem forçar genealogia inexistente.
- Resumo: número esperado versus confirmado, totais, valores, lote/propriedade de destino, divergências de documento/identidade; sem registros financeiros de fantasia.

### F02 — Saídas: Venda, Abate, Transferência enviada, Morte, Doação e Ajuste

- Tela dedicada de **Saídas** com cabeçalho compartilhado, seleção em massa de animais ativos (brinco, marca a fogo, raça, categoria, lote), documentos e destino; controle de elegibilidade, quantidade, peso disponível quando medido, carência sanitária, conferência e fechamento. Uma saída efetiva por animal, com motivo e data, e histórico preservado.
- Saída por morte/doação/transferência não exige peso; Venda/Abate sem peso só quando política/fluxo permite, não inventar peso; distinguir peso aferido de peso informado de negócio e de carcaça estimada. Vincular GTA, NF-e, comprador, frigorífico e transporte quando informados/aplicáveis. Cancelamento de saída reabre estado apenas se cronologia permitir.

### F03 / F17 — Movimentações e inventário conciliado

- Tela de **Movimentações** sem obrigatoriedade de pesagem: lote/pasto/propriedade de origem e destino, data, motivo, animais, operador e documentos. Evitar lote duplo aberto e fechamento incorreto; temporalidade verdadeira e reconciliação retroativa.
- Inventário por período e filtros: `saldo_inicial + entradas + nascimentos - saídas - mortes ± ajustes = saldo_final`, sem contar transferência interna como entrada/saída global. Conferir por propriedade, lote, raça, sexo, era/categoria e identificação; ajustes exigem justificativa e trilha auditável. Totais devem reconciliar com animais ativos e eventos na data, não apenas status atual. A emissão de relatórios de saldo não pode contar cancelados.

### F04 / F05 — Nascimento, idade, era, dentição e categoria produtiva

- Adicionar **data completa** OU **mês+ano estimado** OU **idade declarada em uma data de referência**, incluindo fonte e grau de precisão. Se não informado, `idade = desconhecida`; não inventar dia/mês exato ou converter uma estimativa em fato. Idade em meses deve ser calculada para a data de consulta (ou data histórica da pesagem), incluindo limites de meses e aniversários.
- Separar no domínio: `idade_meses`/`idade_estimativa`, `faixa_etaria` (idade), `era` (rótulo bovino configurável referente à faixa de idade/uso local), `categoria_produtiva` (decisão de manejo/sexo/idade), `faixa_de_peso` (derivada de peso) e **dentição observada** (0,2,4,6,8 dentes + data/origem). Nunca usar peso para “fazer o animal envelhecer”. **Preservar** categoria histórica calculada por peso do v8 como snapshot legível; migrar sem sobrescrever erroneamente `era` antiga. Criar opções para configurar faixa etária e regra de categorização sem impor automaticamente um padrão não validado.
- Demonstrar idade mudando ao avançar calendário **sem nova pesagem**, e comportamento de animal cujo mês de nascimento é estimado. Na ficha mostrar fonte/certeza de cada atributo e permitir correção auditada.

### F06 — Saldo de brincos e identificadores

- Aproveitar `faixasIdentificadores`, `excecoesIdentificadores`, `animalIdentificadores`; completar **recebimento, faixa/lote, reserva, aplicação, troca, perda, dano, devolução, bloqueio e inventário físico**. Saldos de itens/numeração devem ser derivados de movimentos imutáveis ou de um saldo com reconciliação transacional. Histórico “brinco anterior → brinco novo” conserva animal_id. Configurar unicidade por tipo/escopo/identificador oficial, impedir reutilização indevida, não confundir `SN` com um código de estoque real.
- Tela de **Identificadores** com filtros e ações, incluindo `disponíveis, reservados, aplicados, perdidos, danificados, devolvidos, total`; ao aplicar em animal, mudar saldo exatamente uma vez. Testes de concorrência, lote parcial, identificador reaplicado e backup/restore.

### F07 / F15 — Marcas a Fogo e rastreabilidade interna

- Renomear **rótulos visuais** `Marcas` → `Marcas a Fogo`, distinguindo marca física a ferro de marca empresarial/propriedade. Não renomear tabelas/chaves do banco sem razão; manter APIs/legacy e importações.
- **Ficha de rastreabilidade** por animal: origem, propriedade de nascimento (se conhecida), datas e janelas de permanência, operações e documentos, lotes, pesagens, mudanças de identificação, tratamentos, carência, destino/saída, exceções de informação. Dossiê CSV/PDF ou formato estrutural interno sem selo/certificação. Se quiser preparar geolocalização para futuras exigências, guardar coordenada/documento de origem e fonte com precisão e consentimento, sem geofencing fictício nem integração oficial falsa.

## B2 — Sanidade operacional segura (F08, F09, F10)

- Completar `medicamentos` com **posologia estruturada opcional**, versionada por apresentação, espécie, indicação e via: regra proporcional OU tabela de faixas da bula, unidades, arredondamento específico, fonte, revisão/aprovação responsável, validade, datas de início/fim e carência separada carne/leite; diferenciar produto comercial de princípio ativo. Não calcular com cadastro incompleto; impedir prescrição autônoma a partir do nome da marca. Se dados legados só tiverem `dose_padrao` texto livre, migrar como **referência textual não validada**, sem habilitar sugestão automática.
- Painel opcional durante pesagem/aplicação avulsa, semelhante ao painel de apartação: animal, peso usado e procedência/data da medição, produto, regra configurada, **dose sugerida** e **dose efetivamente aplicada**, unidade e via, alerta de fonte inadequada, confirmação humana, observação; o operador pode não usar essa função. Leitura de balança **tem de passar pelo gate de peso novo estável da FASE A**. Histórico de aplicação guarda snapshot do produto/regra/via/dose real, para alterações futuras do cadastro não alterarem o passado.
- Carência: calcular `data de aplicação + intervalo` respeitando calendário civil e regra validada; prever pendências em venda/transferência e **conferência de liberação para abate**, com motivo e evidência de eventual liberação técnica; risco sanitário não pode ser ignorado via simples clique sem autorização pertinente. Distinguir ausência de dado de carência zero. Testes: peso inexistente, bula inválida, regra alterada no futuro, retorno a tela, dosagem de referência percentual/tabela de faixas e sem arredondamento universal. Não hardcode marca Dectomax ou dose médica como padrão do app.

## B3 — Dados sazonais, indicadores, metas e projeções (F11, F12, F13, F14, F18)

- **Calendário da propriedade** por ano: período real/configurável de águas, seca e transição, fonte, início/fim, sobreposição e ausência de sobreposição, datas diferentes em anos e propriedades, revisão auditável. Não impor maio–setembro como fato universal.
- **Desempenho comparativo** por raça, sexo, idade/era na data do evento, categoria produtiva, lote, origem, regime/período e coorte temporal; `n_animais`, `n_pesagens`, dias de exposição observados, base de amostra, GMD individual e consolidado confiável, perdas/ganhos absolutos e médias positivas/negativas, animais sem GMD, animais que mantiveram peso, tendência/regressão com incerteza. Tratar animal que entra/sai durante janela e mudança de lote/era durante intervalo sem atribuição indevida. Exibir 'sem dados suficientes', não zero arbitrário.
- **Meta de desempenho** por propriedade, lote, sexo, raça, faixa de idade, período sazonal e data/horizonte com precedência explícita entre regras (ex.: individual > lote+coorte > propriedade; nenhuma meta conflituosa aplicada silenciosamente). Metas opcionais, versionadas/efetivas por período; conservar cenário usado para reprodução histórica.
- **Projeção diária, não fórmula simplista mensal**, desde último peso REAL e data conhecida, com GMD por dia/coorte/calendário em cenários conservador/base/otimista, transições de seca/águas, mudança de idade, lotes/regime explicitamente planejados. Não persistir peso previsto como nova pesagem; distinguir previsão de observado, intervalo de confiança/limitação da amostra e data da última pesagem. Permitir comparar meta para janeiro/fevereiro/etc.
- **Oráculo obrigatório de aceitação:** animal de 300 kg em 01/01 de ano comum com previsão janeiro `0,200 kg/dia` × 31 dias = 6,2 kg; fevereiro `0,300 kg/dia` × 28 dias = 8,4 kg; projetado em 01/03 = **314,6 kg**. Testar ano bissexto (29 dias) e troca de regime no meio do mês. Dois pontos em 01/01 e 01/03 **não** autorizam declarar GMD mensal observado de janeiro/fevereiro; o sistema só pode indicar interpolação/modelo quando usada e destacar isso.
- **Dashboard do gestor** com perguntas objetivas: qual raça/era/lote está rendendo mais? Quais perdem peso? Quando começa e termina a seca? Quantos dias expostos por animal/lote? O peso projetado bate a meta de venda? Quantos acima/abaixo da meta? Ranking com amostra, filtros, comparação entre safras e exportação PDF/Excel/CSV usando o motor de relatórios já existente, com paridade de dados e nenhuma linha sensível indevida.

## B4 — Documentos e anexos offline (F16)

- Cadastro de documentos vinculados às operações/animais/propriedades (GTA, NF-e, laudo, comprovante, certificado, evidência sanitária) com tipo, número/data, emissor, referência, hash, origem e status; arquivo opcional anexado por seletor seguro Electron. Limitar tamanho, extensão permitida e nomes sanitizados. Guardar bytes em armazenamento apropriado **offline**, não como string gigante no snapshot Dexie sem planejamento.
- **Mudança obrigatória do backup:** garantir que o backup **COMPLETO** preserve documentos/anexos e metadados e que a restauração recupere os arquivos com hash verificado. Considerar pacote versionado com manifesto + objetos externos e compatibilidade dos antigos JSON v6/v7/v8; não chamar de “backup completo” se os arquivos faltarem. Copiar/restaurar de maneira fail-safe e com recuperação após crash. Não apagar anexos de fatos cancelados sem política de retenção. Se volume inviabilizar JSON monolítico, usar pacote adequado e manter leitor legado; testes com anexos faltantes/corrompidos.

## B5 — Backup, configurações, parametrização e manutenção reorganizados (F19–F26)

### F19 / F20 / F21 / F22 / F23 — Backup utilizável e proteção periódica

- **Página dedicada `Backup e Restauração`**: estado de proteção; último backup verificado (não só existente); tamanho/data/local/motivo; botão único **`Criar backup agora`**; catálogo de backups manuais/automáticos/pré-operação; verificar backup; selecionar destino; assistente de restauração em passos `Selecionar → Inspecionar → Comparar versão/usuários/escopo → Pré-backup obrigatório → Confirmar → Restaurar → Integridade pós-restore`. Proteger usuário de confundir CSV/JSON de pesagem com backup íntegro.
- **Backups periódicos quando o aplicativo está aberto**: agendamento configurável (p.ex. diário na primeira oportunidade em que abrir, e após intervalo de uso), reentrada idempotente, não gerar cópias a cada render; snapshot coerente apesar de novas pesagens, sem travar manejo por tempo excessivo; status de sucesso/falha, retentativas com limites e aviso simples de cobertura. Nunca prometer execução com app fechado/desligado.
- **Destino independente opcional**, pasta escolhida via IPC seguro (pendrive, segundo disco, outro caminho), persistir preferência conforme privilégio, detectar indisponibilidade, recusar path traversal, validar permissões, checar espaço quando possível e verificar hash de cópia física por leitura de volta. Principal local continua funcionando se externo falhar; sinalizar claramente `backup local OK / cópia externa pendente`.
- **Retenção segura**: política conservadora parametrizada com rotação, não eliminar última cópia válida, não excluir backups de segurança pré-migração/restore sem regra explícita, catálogo paginado/pesquisável, integridade por item e erro de leitura. Mostrar material sensível somente ao usuário autorizado; se export protegido implementado, envelope com criptografia autenticada (WebCrypto AES-GCM, KDF configurado, salt e nonce por arquivo) e export/import sem guardar segredo em texto puro; manter legado compatível. Nunca alegar seguro apenas por SHA-256 (hash garante integridade, não confidencialidade).
- **Restauração segura**: usuário entende que todos os dados atuais serão substituídos, inclusive usuários/configurações; valida compatibilidade e anexos, cria e verifica backup da situação presente, confirma, restaura atômica/recuperavelmente, revalida integrity e login. Ensaiar crash/falha/disco cheio e plano de recuperação. Exigir ADMIN e permissões atuais.

### F24 — Separação por responsabilidade

- **Importação** de animais/pesagens permanece em sua tela própria (importação inteligente), **Exportação** junto a Pesagens/Relatórios, **Relatórios de conferência/controle** no agrupamento de análise, **Manutenção Avançada** (acesso secundário) somente integridade, diagnóstico, migração, limpeza e reset perigoso; botões destrutivos jamais colados ao backup simples. Preservar links/deep links antigos com redirecionamento e permissão.

### F25 / F26 — Configurações x Parametrização x Equipamentos

- **Configurações Gerais** = preferências e padrões do estabelecimento/lançamento. **Parametrização** = regras de negócio `Pesagens e alertas`, `GMD/indicadores`, `Comercial e saídas`, `Idade/era/categorias`, `Sanidade/carência`, `Calendário de seca/águas`, `Metas/projeções` (mostrar se e somente se implementadas). **Balança e Equipamentos** = S3, conexão, estabilidade, leitura, simulador. **Usuários e Segurança** permanecem com permissões atuais e a política auth separada.
- Reutilizar as **cinco chaves existentes** (`auth-policy`, `operational-defaults`, `sales-policy`, `weight-warning-policy`, `report-settings`) e migrar aditivamente só novos parâmetros. **Não** criar duplicidade entre `appSettings` e novas tabelas para o mesmo valor. Quando novas regras forem coleções temporais (calendário anual, metas, posologia/versionamento), armazená-las em entidades próprias com intervalos de vigência e exibir controles apenas como link/editor do cadastro, não em vários lugares.
- Salvamento isolado por seção, validação de limites e combinações, aviso de alterações pendentes, descarte e reinício seguro, permissão real no backend/serviço, feedback de efeito em relatórios e comportamentos futuros. Mudança de parâmetro **não reescreve pesagem histórica** sem política explícita de recomposição auditável.
- Visual desktop coeso com o estilo já existente, toolbar simples, títulos claros, sem excesso de telas/“enterprise”; testar layout pequeno, scroll, modal, teclado e acessibilidade.

---

## 03 — Matriz de testes e ORÁCULOS OBRIGATÓRIOS (além dos existentes)

### Cenários mínimos de integração que precisam de código de teste

**Peso/equipamento**
1. Captura S3 estável nova para A, salvar; abrir B sem nova leitura, não reutilizar peso A.
2. Oscilação por >5s não gera estabilidade artificial; sinal de balança ausente não vira estável após temporizador.
3. Desconectar/reconectar e alternar simulador/USB/BLE invalida sessão e último peso.
4. Leitura tardia de animal A após começar B não autoriza salvar B; troca manual protege valor digitado.
5. Peso nulo, zero, valor acima de limite e truncamento intencional com metadados; duplo clique/Enter idempotente.

**Cronologia/identidade/lotes/sanidade**
6. Editar data de Cadastro para depois de Manejo falha sem mudanças.
7. Cancelar pesagem de mudança de lote elimina movimento ativo órfão, mantém auditoria.
8. Editar lote passado recalcula intervalos e movimentos sem afetar transferência independente.
9. Repesagem no mesmo dia preserva uma oficial, audita substituição e reconcilia sanidade.
10. Duas requests simultâneas criam no máximo uma pesagem oficial por animal+data+tipo.
11. Falha injetada após escrita mas antes de derivados é recuperável e não mostra GMD incorreto como confiável.
12. Troca número/marca e depois busca por brinco novo, sem colisão de outro animal.
13. Identidade SN e números repetidos na marca diferente mantêm históricos separados.
14. Data histórica 30/02 é rejeitada/ignorada com aviso; GMD negativo e zero verdadeiros mantidos.
15. Falha de IndexedDB apresenta ERRO, nunca 0 animais/pesagens.

**Ciclo de vida/inventário/documentos**
16. Compra de 80 animais sem peso gera 80 novos animais e uma operação, zero peso NÃO inventado, rebanho +80.
17. Uma venda de 50 animais gera uma operação e 50 baixas, não 50 cabeçalhos; saldo -50.
18. Transferência interna entre lotes não altera saldo global, nem cria 2 lotes abertos.
19. Saída por morte sem peso e rastreio do motivo; retorno indevido após saída é bloqueado.
20. Cancelar a venda e corrigir documentação reproduz status, saldo e trilha sem duplicação.
21. Migrar legado v8 com pesagens/saídas sem gerar entrada/venda dupla; conciliação explícita quando dados ausentes.
22. Brincos: 1000 recebidos, 670 aplicados, 20 perdas/baixas, 310 disponíveis; duas aplicações concorrentes do mesmo código não passam; troca preserva histórico.
23. Anexar GTA PDF, restaurar backup integral em base limpa de teste, hashes e vínculos iguais; anexo faltante é erro visível.

**Idade/era/sanidade/indicadores**
24. Data nascimento exata versus somente mês/ano; idade evolui com calendário, não com peso; rebanho sem data fica desconhecido.
25. Animal muda de faixa etária com o tempo sem pesagem, categoria produtiva não muda indevidamente; dentição registrada não é inventada.
26. Posologia textual legado não ativa dose automática; regra validada de faixa calcula e mostra sugestão separada da dose aplicada; sem peso válido bloqueia sugestão.
27. Tratamento com carência futura sinaliza e bloqueia abate conforme política cadastrada; venda para recria, morte e transferência tratadas conforme suas regras.
28. Dois pesos em 01/01 e 01/03: GMD do intervalo, nunca “GMD real por mês” fictício.
29. Projeção de 300 kg + 31 dias×0,200 + 28×0,300 = **314,6 kg**; fevereiro bissexto varia corretamente; mudança de seca/idade/lote no meio do mês ajusta o cenário.
30. Ranking por raça/era/lote explicita n, janela e confiabilidade, não mistura GMD irreal e não zera valores ausentes.
31. Saldo inicial + movimentos por período corresponde ao saldo final e às fichas do animal.

**Backup/configuração/desktop**
32. Um só botão de backup, comprovação de arquivo completo e hash.
33. Reabrir app após intervalo gera backup periódico na primeira oportunidade, sem duplicata.
34. Pasta externa ausente: backup local sucesso, réplica pendente, sem falso positivo.
35. Criptografia opcional com senha correta/incorreta, envelope autenticado, backup legado compatível.
36. Restaurar backup que contém usuários invalida sessão antiga, preserva integridade e documentos.
37. Falha de escrita/arquivo truncado/sem espaço não marca backup como concluído.
38. `v6`/`v7`/`v8` fixtures upgrade→novo esquema com registros e hashes consistentes; migração repetida não duplica.
39. Parâmetros reabrem persistidos; trocar regra de GMD altera exibição/aggregates derivados, sem corromper fatos históricos.
40. Menus novos e antigos, deep links, back/forward, janelas estreitas, acessos limitados por permissão, export PDF/XLSX/CSV em paridade, atualizar e reabrir o Electron, sem console errors.
41. Compare performance de 36k e perfil maior sem bloquear a tela; use índices e projeções incrementais, não O(n²) em tela/lançamento.

### Comandos e qualidade

- Gates preexistentes mínimos: `npm ci`, `npm run lint`, `npm run test:unit`, `npm run build`, `npm run test:quick`, `npm run e2e:electron:verify`, `npm run storage:all:verify`, `npm run weighing:repesagem:verify`, `npm run weighing:interval-rule:verify`, `npm run weighing:regression:verify`, `npm run animal:history-integrity:verify`, `npm run sanity:launch-integration:verify`, `npm run import:idempotency:verify`, `npm run reports:weighted-gmd:verify`, `npm run reports:xlsx-parity:verify`, `npm run docs:user:verify`. Verifique nomes pelo `package.json` vigente antes de executar; não mascarar testes inexistentes.
- Criar scripts novos organizados por contrato (exemplo: `weighing:cycle:verify`, `livestock:lifecycle:verify`, `identifiers:ledger:verify`, `sanity:dose:verify`, `analytics:forecast:verify`, `backup:recovery:verify`, `settings:navigation:verify`) e integrar ao `test:quick`/CI com orçamento realista de execução; testes pesados em workflow dedicado quando necessário.
- A CI `.github/workflows/testes.yml` hoje executa build, `test:quick` e Electron E2E em Ubuntu/Xvfb; não remover gates antigos. Validar empacotamento Windows via `dist:unsigned`/workflow em executor apropriado; `npm run dist` exige assinatura e não é substituto automático. **Nenhuma release/tag automática.**
- Exigir análise de regressão de tamanho de DB após edições repetidas, consumo de memória, duração de lançamentos e relatórios, integridade das novas stores, qualidade de dados, status de erros de leitura, segurança de IPC/file dialogs e nenhuma credencial em logs.
- **Não aceitar “CI verde” como sinônimo de 52 itens entregues**: validar E2E e matriz funcional. Evidências com logs redigidos, dados sintéticos, screenshots dos fluxos principais, amostras de relatórios e hash do artefato em `docs/evidence/pesagens-integrada/`.

---

## 04 — Estratégia de commits, checkpoints, CI e PR

**Sequência preferida na mesma branch/PR DRAFT:**

1. `A0-baseline` — baseline, matriz 52, fixtures e documentação mínima de contrato.
2. `A1-weighing` — P01–P03, P15–P16, gates da balança e curral.
3. `A2-consistency` — P04–P13, P17, transações e coerência de histórico.
4. `A3-maintenance-fixes` — P14, P19–P26, correções de UX e backup base.
5. `A4-acceptance` — gates finais das correções, controle de P18; somente então **B**.
6. `B1-lifecycle` — entidades de operação, compras/entradas, saídas, movimentações, inventário.
7. `B1-identity-age` — idade/era/dentição, identificadores, Marcas a Fogo, rastreabilidade interna.
8. `B2-sanidade` — posologia estruturada, aplicação opcional, carência.
9. `B3-analytics` — seca/águas, metas, projeções, indicadores/relatórios.
10. `B4-documents` — anexos e contratos de backup completos.
11. `B5-ux-system` — Backup e Restauração, automação externa, Parametrização, Equipamentos, Manutenção Avançada.
12. `final-hardening` — migração final, testes end-to-end, compatibilidade, docs, screenshots, performance, build, relatório de auditoria 52/52.

Após cada checkpoint, atualizar matriz e executar gate afetado **antes** de iniciar o próximo. Não rodar `test:quick` pesado a cada arquivo editado; usar teste focado no ciclo de desenvolvimento e gate completo por checkpoint. Se um gate quebrar, corrigir na MESMA BRANCH/PR; sem inventar PR corretiva nova. Se `main` avançar, revalidar diferenças e tratar colisões sem descartar trabalho do usuário. Evitar `git push --force` e qualquer comando destrutivo em branches de terceiros.

**Condições para dizer “pronto para revisão do proprietário”:** todos os 52 IDs têm evidência/tratamento concluído ou decisão preservada tecnicamente justificada; testes automatizados que dependem do código passam; migrações e recuperação real de fixture verificadas; CI verde no HEAD final da PR; artefato diagnóstico verificado onde possível; nenhuma quebra grave conhecida ou status enganoso. P16 (balança física) e P18 (proteção administrativa) podem depender de ação externa, mas devem ficar **explicitamente PENDENTES DE HOMOLOGAÇÃO** e **bloquear qualquer afirmação de liberação total para produção**. A PR permanece DRAFT para decisão humana. Se gate falhar ou houver funcionalidade incompleta, mantenha DRAFT e relatório `BLOCKED/INCOMPLETE` com causa e próximos passos, sem maquiar o escopo.

---

## 05 — Documentação exigida no repositório

Criar/atualizar, sem apagar documentação histórica necessária:

- `docs/evidence/pesagens-integrada/MATRIZ-52-ITENS.md` — 26 P + 26 F; evidências por linha.
- `docs/evidence/pesagens-integrada/BASELINE-E-GATES.md` — comandos, versões, amostras, tempo, falhas e hashes redigidos.
- `docs/arquitetura-produto/` — arquitetura vigente, modelos/eventos/SSOT, schema e migrações, invariantes, UX/navegação, regras de projeção, alcance/não alcance de rastreabilidade regulatória.
- `docs/user/` — operação de Entradas, Saídas, Movimentações, Identificadores, Nascimento/Era, Sanidade e carência, Desempenho/Metas/Previsões, Backup/Restauração, Parametrização, Equipamentos; distinguir campos obrigatórios e opcionais, evitar jargão técnico em ajuda do operador.
- `docs/evidence/pesagens-integrada/MIGRACAO-ROLLBACK.md` — compatibilidade, backup, restauração, recuperação após falha, limites de downgrade, implicações de anexos, parâmetros e conta local.
- `docs/evidence/pesagens-integrada/VALIDACAO-MANUAL-WINDOWS-S3.md` — roteiro do que foi/precisa ser testado no aparelho de verdade, sem alegar que rodou se não rodou.
- `docs/evidence/pesagens-integrada/CONTINUIDADE.md` — atualizar apenas se a missão precisar continuar por falta de tempo/contexto/recursos; checkpoints, arquivos, comandos, lacunas.

---

## 06 — Formato FINAL da resposta ao proprietário (obrigatório)

**Responder no chat do Claude Code em um único bloco literal ` ```text ... ``` `**, sem texto solto antes/depois, com este conteúdo preenchido de verdade:

```text
MISSÃO: PESAGENS-52-ITENS-CORRECOES-IMPLANTACOES-2026-10-29
REPOSITÓRIO: maikelimaadm-stack/projeto-pesagens
BRANCH / PR DRAFT / BASE MAIN / HEAD FINAL:
STATUS FINAL: PASS / BLOCKED / INCOMPLETE (justificado)
RESUMO DE IMPLEMENTAÇÃO FASE A — P01–P26:
- Quais itens foram corrigidos, quais hipóteses foram refutadas, o que foi preservado intencionalmente; evidência.
GATE A: comandos, saída, integridade e estado.
RESUMO DE IMPLEMENTAÇÃO FASE B — F01–F26:
- O que foi realmente implementado com backend/local DB, UI, testes, migracões e arquivos.
GATE B: comandos, saída, integridade e estado.
COBERTURA: 26/26 P, 26/26 F, linha a linha referida em MATRIZ-52-ITENS.md; nunca marcar fictício como concluído.
BANCO: versões, stores novas, backfill, restore v6/v7/v8, fixture, evidência, compatibilidade.
BALANÇA S3: simulado/E2E/real; lacunas físicas explícitas.
SANIDADE: dados de produto validados, estado do motor; limitações veterinárias.
RASTREABILIDADE: interna, sem afirmação de certificação oficial.
BACKUP: formatos, política de retenção, armazenamento local/externo, arquivos anexados, criptografia se houver e teste de restauração.
RELATÓRIOS: paridade PDF/CSV/XLSX, GMD, inventário, sazonal, projeção.
CI: URLs/número da execução, conclusão, commit testado; não confundir CI antigo com HEAD final.
INSTALADOR WINDOWS: artefato, status, assinatura, testes E2E reais versus diagnóstico.
PERFORMANCE: 36k e massa alta, baseline e regressões.
ARQUIVOS E COMMITS PRINCIPAIS:
RISCOS / PENDÊNCIAS EXTERNAS / DECISÕES DE PRODUTO:
CHECKLIST DE HOMOLOGAÇÃO MANUAL PELO PROPRIETÁRIO:
RECOMENDAÇÃO FINAL: não mergear enquanto BLOCKED; se PASS condicionado apenas à S3/Windows, indicar condições exatas. O MERGE É EXCLUSIVAMENTE MANUAL PELO PROPRIETÁRIO.
```

**Nunca dizer “mergeei”, “pronto para produção”, “S3 testada fisicamente” ou “certificado para Europa” sem comprovação correspondente.** Não criar tag e não marcar PR como ready automaticamente.

---

# ANEXO A — BACKLOG COMPLETO DO PROPRIETÁRIO (26 P + 26 F)

O texto a seguir é o levantamento original incorporado integralmente como referência de requisitos. Suas frases históricas indicando “ainda não implementar”, “apenas quando solicitado” etc. foram superadas pela **autorização explícita de implementação no início deste prompt**. As descrições e limites de segurança continuam vinculantes. Em caso de conflito de interpretação, valem as instruções executivas acima, e não o status histórico do levantamento.

# Projeto Pesagens Individuais — Lista-mestra de correções

**Data de consolidação:** 29/10/2026  
**Repositório:** `maikelimaadm-stack/projeto-pesagens`  
**Referência analisada:** `main`, app 1.5.6, IndexedDB/Dexie v8.  
**Estado:** EM COLETA — auditoria estática preliminar. Nenhuma alteração autorizada/executada.  
**Instrução do proprietário:** reunir as novas observações que serão enviadas e, apenas quando solicitado, planejar e executar uma correção integrada. **Ignorar a PR antiga com conflito na definição do escopo.**

## Importante: nível de evidência

- **Código confirmado** = há caminho específico no código que sustenta o diagnóstico; o defeito operacional pode ainda exigir reproduzir.
- **Risco a reproduzir** = possibilidade apontada pela inspeção; precisa de fixture/E2E para verificar alcance e evitar correção de falso positivo.
- **Decisão de produto** = comportamento intencional, mas requer confirmação de regra antes de mudar.

## Registro das correções e investigações

| ID | Prioridade | Problema / hipótese | Evidência / referência | Aceite esperado |
|---|---|---|---|---|
| P01 | Crítica | **Peso automático reutilizado para outro animal:** último peso estável permanece em memória; o formulário conserva valor no ciclo seguinte e pode aceitar salvar sem nova leitura. | `src/modules/equipment/application/scaleService.js` (variáveis `lastStable`, `lastReading`, `captureWeightForLaunch`); `src/pages/LancamentoPesagensIndividuais.jsx` (sincronização do peso e pós-save). Código confirmado; reproduzir ciclo com simulador/S3. | Atribuir cada captura a novo ciclo, exigir leitura válida e nova; preservar lançamento manual explícito. |
| P02 | Crítica | **Timeout força estabilidade artificial:** `captureWeightForLaunch()` após 5 s converte `lastReading` em `stable: true` mesmo se ainda instável. | `src/modules/equipment/application/scaleService.js` linhas aprox. 202–240. Código confirmado; verificar usos reais da função. | Timeout retorna erro/estado inconclusivo, nunca inventa estabilidade. |
| P03 | Alta | **Leituras antigas sobrevivem à desconexão:** `disconnectScale()` limpa `lastReading`, mas não `lastStable`; revisar `tearDown`, reconexão e troca de dispositivo. | `scaleService.js` linhas aprox. 64–80, 196–201. Código confirmado; testar reconexão. | Limpar ou invalidar leitura por sessão/época da conexão; nunca reaproveitar peso vencido. |
| P04 | Crítica | **Cancelar pesagem pode deixar movimento ativo:** `bulkDeleteEntries()` soft-delete na pesagem, recálculo de lotes e projeção, mas não reconcilia necessariamente `movimentosAnimais` da pesagem excluída. | `src/modules/weighing/infrastructure/weighingDataAdapter.js` `bulkDeleteEntries`; o próprio comentário em `replaceEntries` admite limitação do cancelamento comum. Código confirmado. | Conciliação auditável de movimentos, lotes e situação, na mesma transação. |
| P05 | Crítica | **Editar data de Cadastro pode invalidar cronologia:** `validateAnimalChronology` barra eventos anteriores ao Cadastro, mas não parece barrar mover Cadastro para depois dos Manejos já gravados. | `weighingDataAdapter.js`, `validateAnimalChronology` linhas aprox. 171–200. Risco a reproduzir. | Proibir evolução cronológica inválida antes da gravação; testes de Cadastro/Manejo/Saída retroativos. |
| P06 | Alta | **Editar identificação e marca pode desalinhar identificador visual:** `updateEntry` altera `animais`, não atualiza em conjunto `animalIdentificadores`; caminho coletivo trata parte dessa reconciliação. | `weighingDataAdapter.js`, `updateEntry` aprox. 446–488, `bulkUpdateAnimalProfiles`. Código confirmado, efeito a reproduzir. | Identidade e identificadores consistentes, validação de unicidade, histórico preservado. |
| P07 | Alta | **Duplicidade no mesmo dia pode atravessar serviço:** proteção da tela/repesagem não é invariante obrigatória em `createEntry`, inclusive potencial concorrência dupla. | `weighingService.createEntry` e `weighingDataAdapter.createEntry`. Risco a reproduzir. | Regra transacional, uma pesagem oficial de Manejo por animal/data, substituição somente pela repesagem autorizada. |
| P08 | Alta | **Repesagem gravada e recálculo posterior falha:** gravação e recálculo posteriores em duas etapas, com possibilidade de derivados obsoletos. | `weighingService.replaceSameDayEntry()` linhas aprox. 157–190. Código confirmado; simular falha. | Transação conjunta ou recuperação determinística de pendência, indicadores bloqueados/sinalizados até recomposição. |
| P09 | Alta | **Edição de lote sem reconciliar movimentos:** `updateEntry` reconstrói lotes, mas não atualiza/cancela os movimentos associados à versão anterior da pesagem. | `weighingDataAdapter.updateEntry` e `rebuildAnimalLotProjection`. Código confirmado; reproduzir histórico. | Histórico de movimentações consistente e auditável após edição. |
| P10 | Alta | **Falha de leitura aparenta base vazia:** `weighingService.listEntries` captura exceção e retorna `[]`. | `weighingService.js` aprox. 353–369. Código confirmado. | Diferenciar banco indisponível, carregando e zero resultados; jamais total falso. |
| P11 | Média | **Identidade legada ambígua:** `sameAnimal` pode comparar número+marca quando há ID ausente; risco de cruzar históricos com identificações reaproveitadas/ambíguas. | `src/modules/animals/domain/animalHistory.js`; importação usa resolvedor canônico mais cauteloso. Risco a reproduzir. | Não mesclar animais sem confirmação da identidade; oferecer conciliação segura. |
| P12 | Média | **Validação histórica de datas no GMD:** `calculateWeightGain` valida completamente a data atual, mas só parcialmente a data da entrada histórica (`toUtcDay` pode normalizar 30/02). | `src/modules/weighing/domain/weighingCalculations.js`. Risco a reproduzir. | Ignorar data histórica impossível e sinalizar anomalia; nenhuma conta fictícia. |
| P13 | Média | **Reconstrução de lotes expande histórico técnico:** `rebuildAnimalLotProjection` soft-delete nos vínculos e recria todos. | `weighingDataAdapter.js` aprox. 297–323. Código confirmado; benchmark e verificação de cardinalidade necessários. | Reconstrução idempotente/determinística, sem efeitos colaterais desnecessários, histórico auditável. |
| P14 | Média | **Rotina de backup periódico externo não confirmada:** existem backups antes de migrações e operações perigosas, mas não foi confirmada agenda diária com retenção externa. | `src/modules/maintenance/infrastructure/maintenanceDataAdapter.js`; `docs/user/BACKUP-E-RESTAURACAO.md`. Lacuna a confirmar. | Backup periódico configurável, verificado e recuperável; cópia externa, sem dependência de nuvem. |
| P15 | Decisão de produto | **Peso inteiro com truncamento:** balança 328,9 vira 328; comportamento intencional e testado. | `src/modules/equipment/domain/scaleContract.js` (`Math.floor`), `LancamentoPesagensIndividuais.jsx`, script de verificação. | Confirmar se truncamento é realmente desejado antes de alterar. |
| P16 | Alta (validação) | **Cobertura física da S3:** testes existentes demonstram simulador e estabilidade, não substituem homologação em hardware e firmware real. | `stabilityTracker.test.js`; `scripts/verify-electron-e2e.mjs`. | Cenários reais com conexão, oscilações, boi sai/plataforma vazia, reconexão e captura consecutiva. |
| P17 | Média | **Datas, ganchos de sessão e sincronização de cache:** auditar mudanças em fechamento/reabertura de sessão, atualização dos relatórios e após importação, conforme novos sintomas. | Aguardando relatos do usuário; sem defeito confirmado. | Testes direcionados ao comportamento observado. |
| P18 | Média | **Proteção de branch e publicação de instalador:** `main` observada sem proteção; CI passou; publicação em Releases não confirmada. | Metadados do GitHub consultados em 29/10/2026. | Exigir gates, backups e evidências de empacotamento/instalação antes de liberar versões. |

## Regras que já parecem corretas e devem ser preservadas

- Offline-first, dados locais Dexie v8, operações de escrita transacionais onde já implementadas.
- Pesagens de Saída sem peso não devem virar 0 kg; GMD com intervalo zero/ausente deve ser nulo.
- GMD com intervalo mínimo configurável (7, 14, 21, 28 dias; padrão 21) e qualidade separada do fato histórico.
- Distinção entre peso vivo, carcaça, arrobas e valores comerciais.
- Repesagem com cancelamento lógico, auditoria e sanidade vinculada.
- Backups pré-migração, pré-importação, pré-restore e pré-limpeza; validação de hash SHA-256.
- Sem reescrever/descaracterizar o produto e sem recursos empresariais desnecessários.

## Plano de trabalho futuro — somente mediante autorização

1. **Continuar recebendo relatos do usuário**, acrescentando evidências e prioridade; nenhuma alteração agora.
2. Congelar base técnica a usar; revisar todos os itens e confirmar hipóteses em testes reproduzíveis.
3. Antes de mutações, preparar backup real/fixture de homologação e restauração verificada; nunca testar destrutivamente em dados reais sem cópia válida.
4. Construir correção **integrada** cobrindo capturas, identidade, cronologia, eventos, lotes, movimentos, derived GMD, importações e tratamento de falhas, com limites claros de escopo e a menor mudança possível.
5. Adicionar testes unitários, integração IndexedDB, cenários E2E Electron e simulação da S3; exigir verificações de integridade, performance e regressão.
6. Homologar em Windows, fazer testes físicos com Tru-Test S3 e testar atualização/rollback de aplicativo sem fazer downgrade do esquema local.
7. Publicar uma PR controlada apenas quando o usuário autorizar execução; **merge sempre manual pelo proprietário**, com CI e evidências. Não mexer na PR antiga com conflitos.

## Casos de teste obrigatórios (registro inicial)

- Animal A pesado -> animal B selecionado sem nova leitura: impedir reutilização de peso.
- Balança oscilando por 5+ segundos: não forçar leitura estável.
- Desconectar/reconectar/trocar balança: invalidar última leitura vencida.
- Duas solicitações de pesagem do mesmo animal na mesma data: não duplicar.
- Cancelar pesagem de movimentação A -> B: não deixar movimento ativo órfão.
- Editar Cadastro para data posterior a Manejo: recusar sem efeitos parciais.
- Alterar brinco e marca: manter identificador ativo e evitar colisões.
- Editar lote ou data retroativamente: conciliar histórico e projeção atual.
- Repesagem bem-sucedida seguida de falha de recálculo: recuperação segura.
- Falha ao abrir IndexedDB: erro claro, não base aparentemente vazia.
- Data histórica impossível (30/02): não gerar ganho/GMD.
- Repetidas reconstruções de lotes: idempotência e volume de histórico.
- Backup íntegro -> restore -> verificação de contagens, vínculos e GMD.
- Carga alta com dezenas de milhares de registros: operação responsiva.

## Observações que o usuário ainda enviará

_Aguardando novas constatações. Registrar aqui antes de fechar o escopo da correção integrada._

---

# Ampliação de escopo — Gestão pecuária, rastreabilidade, idade, sanidade e desempenho

**Registro:** 29/10/2026. **Status:** pesquisa de referências e proposta funcional; **não autorizada a implementação**. Estes itens se somam a P01–P18 e devem ser reavaliados com o usuário antes de fechar requisitos. Não alterar a PR antiga em conflito.

## Evidência de pesquisa de mercado

- **TGC / Ponta Agro (GA)**: gestão de entrada/saída, contratos de compra/venda, nutrição, protocolos, lotes, curva diária de peso estimado, rastreio por SISBOV/NCF/chip. https://pontaagro.com/tgc-ga/
- **Rastreabilidade GA**: separa os comunicados de compra, transferência, nascimento, abate, venda e morte; controle de numeração/estoque de brincos, reidentificação, GTA, dados BND e carência sanitária. https://pontaagro.com/rastreabilidade-ga/
- **MultBovinos / MultSoft**: módulos e eventos independentes de entrada, venda, morte, identificação, inventário, movimentação, sanidade e pesagem, com coleta offline. https://www.multsoft.agr.br/multbovinos-administracao-rural/
- **JetBov**: pastos, identificação, pesagem/GMD, mapas sanitários, indicadores, simulações de venda e previsão de peso (varia por plano). https://jetbov.com/planos-e-precos-v2/
- **DataCollection / TraceSys**: estimativas individuais com ajuste por estação, sexo, idade e disponibilidade de alimento por lote; reidentificação e carência. https://secure.agrosoftware.inf.br/produto.htm
- **MAPA**: SISBOV é o mecanismo oficial de identificação/certificação aplicável a programas e mercados específicos; PNIB tem implantação nacional gradual 2025–2032. https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/cgtqa/dpc/sisbov e https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/rastreabilidade-animal/pnib
- **EUDR**: requisitos europeus de diligência e origem geolocalizada **não se confundem** com SISBOV nem podem ser autodeclarados certificados pelo software. Para bovinos, documentar os estabelecimentos onde o animal esteve; legislação europeia/obrigações oficiais e cronograma atual devem ser reavaliados antes de alegações de conformidade. https://green-forum.ec.europa.eu/nature-and-biodiversity/deforestation-regulation-implementation/understand-due-diligence_en e https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ%3AC_202603896
- **Zoetis / Dectomax**: para a apresentação bovina de Dectomax descrita pelo fabricante, 1 mL/50 kg, carência carne bovina 35 dias; a bula contém tabela de doses por faixas, e a dose matemática não substitui a dose indicada na bula para cada faixa/formulação. Prescrição/aplicação sob responsabilidade veterinária. https://www.zoetis.com.br/especies/bovinos/dectomax/
- **Embrapa / sazonalidade**: no Centro-Oeste o período seco costuma ocorrer aproximadamente maio–setembro, variável por fazenda/ano; não hardcodar como verdade histórica. https://www.embrapa.br/en/web/gado-de-corte/busca-de-noticias/-/noticia/116066264/estrategia-alimentar-ajuda-a-manter-rebanho-bovino-durante-a-seca
- **Dentição e idade**: maturidade dentária é informação observada/estimada, não igual à idade cronológica exata. https://www.merckvetmanual.com/digestive-system/dental-development-and-anatomy/estimation-of-age-by-examination-of-the-teeth-in-animals

## Estado confirmado do código atual (base para gap-analysis)

- `src/modules/operations/domain/categorySuggestion.js`: categoria automática baseada em **faixa de peso e sexo**; `eraOfCategory()` herda o texto da categoria. **Não há evolução cronológica automática**.
- `src/modules/weighing/infrastructure/weighingDataAdapter.js`: `newAnimal()` grava `nascimento: null` e `nascimento_estimado: false`; `Cadastro` é evento que cria animal e hoje exige peso pela validação (`weighingMapper.validateUiPayload`).
- `src/modules/catalog/domain/registryDefinitions.js`: `marcas` já tem descrição de **marcas a ferro**, mas o menu e campo usam nome genérico “Marcas”; alteração de rótulo não deve renomear store/ids existentes.
- `src/modules/sanity/domain/sanityRules.js` e `src/components/sanidade/MedicamentoFormDialog.jsx`: `dose_padrao` é texto livre, não é uma fórmula; dose por peso **não implementada**. `carencia_dias` é **informativa e não bloqueia** abate ou venda.
- `src/storage/indexedDb/schema.js`: já existe **infraestrutura parcial** para `faixasIdentificadores` e `excecoesIdentificadores`, mas não equivale a uma rotina completa de estoque de brincos com recebimento, reserva, aplicação, baixas e conciliação.
- `src/components/pesagens/GerenciarSaidasDialog.jsx`: mantém **perfis** de venda/abate pré-preenchíveis nas configurações; não é módulo de operações de saída/cabeçalho com N animais e conferência de saldo; no `LancamentoPesagensIndividuais.jsx` a compra, venda, abate e sanidade são detalhes do evento de pesagem.
- `src/modules/reporting/definitions/columns/animalColumns.js`: há GMD por período, por entrada e regressão, mas não há modelo sazonal de cenário planejado versus realizado por raça, idade/era, lote e estação climática.

## Novos requisitos candidatos — identificar sempre como intenção, não funcionalidade pronta

| ID | Prioridade | Requisito | Regra essencial / aceite |
|---|---|---|---|
| F01 | Fundação | **Entrada de animais (Compra, Transferência recebida, Nascimento, Ajuste de inventário)** em rotina própria | Documento de cabeçalho + itens/animais + origem/propriedade + parceiro + data + motivo + preço/frete/documento opcional; aceitar entrada sem pesagem e identificação posterior; sem inventar peso zero. Fechamento com conferência de quantidade e duplicidade. |
| F02 | Fundação | **Saída (Venda, Abate, Transferência enviada, Morte, Doação, Ajuste)** em rotina própria | Cabeçalho + seleção de animais + conferência de lote/propriedade + GTA/NF/romaneio conforme evento + validação de carência para destino abate; altera situação e saldo do rebanho uma vez; nunca confundir peso da balança com existência da operação. |
| F03 | Fundação | **Livro de movimentos/cadeia de custódia única** | Eventos imutáveis/canceláveis com origem, destino, quando, responsáveis e documentos; entradas/saídas/transferências/mortes reconciliação com saldo e fichas; evitar duplo lançamento quando pesagem está vinculada ao mesmo manejo. |
| F04 | Fundação | **Nascimento/idade com precisão conhecida** | Registrar data exata ou mês/ano estimado ou idade declarada na compra + data de referência; guardar fonte e qualidade da estimativa; nenhuma data exata fictícia para idade desconhecida. Idade e faixa etária derivadas da data de referência, sem mutar histórico. |
| F05 | Fundação | **Separar idade, “era”, categoria produtiva e dentição** | Era etária derivada das faixas configuráveis de meses; classe de peso independente; categoria produtiva (bezerro/garrote/boi etc.) com política explícita; dentição real observada (0/2/4/6/8 dentes) separada e nunca inferida como fato do calendário. Avaliar sentidos exatos de “era” com usuário. |
| F06 | Alta | **Identificadores / estoque de brincos** | Recebimento por faixa/lote/tipo/fornecedor; disponível/reservado/aplicado/perdido/danificado/devolvido, vínculo por animal e histórico de substituição, não reaproveitamento indevido de códigos oficiais, inventário físico x sistema, consistência da identificação e documentos. Reusar stores existentes quando corretas. |
| F07 | Alta | **Cadastro “Marcas a fogo”** | Renomear apenas rótulo de menu/campo de forma consistente, sem alterar armazenamento ou chaves; diferenciar marca a fogo, marca/propriedade e tipo de identificador (brinco visual, RFID, SISBOV etc.). |
| F08 | Alta | **Medicamentos com posologia estruturada opcional** | Produto/apresentação/concentração, espécie, indicação, unidade, regra validada (ex. mL/50 kg), via, versão da bula, fonte, arredondamento conforme bula, validade, lote, carência carne/leite e data de vigência; bloqueio da sugestão se faltam dados confiáveis. |
| F09 | Alta | **Painel de dose sugerida por animal** | Peso efetivamente atual da balança válida na sessão ou pesagem recente com data explícita; cálculo reproduzível com fonte e precisão; mostrar fórmula, sugestão e dose aplicada como campos separados, confirmação do operador/veterinário e possibilidade de não utilizar o recurso. Nunca aplicar automaticamente. |
| F10 | Alta | **Carência sanitária operacional** | Calcular data mínima de liberação conforme produto/esquema/via e doses; alertar/bloquear destino abate quando aplicável, avisar transferência/venda e registrar reconhecimento; não tratar saída por morte como abate. Regras respaldadas por bula e veterinário. |
| F11 | Alta | **Desempenho por raça, sexo, idade/era, lote, origem e época** | Grupo comparável e estável por referência histórica, n animais, nº pesagens, períodos e cobertura; GMD negativo/zero legítimos, intervalo mínimo e pesos confiáveis; permitir ranking por coortes sem misturar raça/categoria/idade por engano. |
| F12 | Alta | **Calendário de águas, transição e seca por ano/propriedade** | Data real de início/fim **configurável/observada** com fonte; sobreposição de período de cada animal, dias expostos e GMD dos intervalos cobertos. Não atribuir GMD mensal real a intervalos que atravessam meses sem observações suficientes. |
| F13 | Alta | **Metas e cenários de peso/GMD** | Meta de peso/data ou GMD por mês/safra/raça/sexo/era/lote/estação; cenário conservador/base/otimista; projeção por dia desde última pesagem válida, atualizando faixa etária e estação conforme calendário. Mostrar data e qualidade da base, horizonte e incerteza. |
| F14 | Alta | **Planejado x realizado por coorte** | Separar previsão (nunca gravar como pesagem) de fatos observados; metas por data/coorte, desvio kg/dia, projeção de atingimento da meta, animais abaixo/acima, casos com amostra insuficiente; filtros cruzados. |
| F15 | Evolução | **Rastreabilidade interna completa e preparada para padrões oficiais** | Animal ID estável; propriedades de origem/nascimento/permanência/destino, janelas temporais, documentos e parceiros, troca de brinco, mortalidade, sanidade, carência, vínculos de lote. Dados desconhecidos marcados como tal, sem presumir certificação Sisbov/EUDR/ERAS. |
| F16 | Evolução | **Documentos/anexos offline seguros** | GTA, NF-e, laudos, comprovantes, certificados, lote de medicamentos e documentos de origem com referências estáveis, verificação de backup/restauração e exportação auditável. Considerar tamanho/armazenamento local e evitar perdas de arquivos anexos. |
| F17 | Evolução | **Conciliação de inventário** | Saldo inicial + entradas + nascimentos − saídas − mortes ± ajustes = saldo final por período, sexo, categoria, raça, lote e origem; conferência por identificação e documentos; nunca corrigir estoque alterando histórico silenciosamente. |
| F18 | Evolução | **Relatório gestor: resposta a perguntas reais** | Qual raça/era/lote supera meta na seca? Quais perdem peso? Quantos dias ficaram expostos à seca? Projeção até a próxima apartação ou venda? Relatórios PDF/Excel reutilizando motor existente e verificações de paridade. |

## Exemplo conceitual de projeção

Cenário, **não fato**: animal com 300 kg aferidos em 01/01; janeiro com meta de 0,200 kg/dia por 31 dias; fevereiro com meta de 0,300 kg/dia por 28 dias. Ganho projetado = 31×0,200 + 28×0,300 = 14,6 kg; peso projetado em 01/03 = 314,6 kg. Se animal mudar de era, lote, regime nutricional ou estação no meio do período, recalcular o GMD projetado **por dia** com regra de precedência explícita. Comparar só com pesagens reais, jamais usar peso previsto como nova pesagem.

**Cuidado estatístico:** dois pesos medidos em 01/01 e 01/03 permitem calcular GMD do intervalo inteiro; **não** demonstram, sozinhos, qual foi o GMD real em janeiro e fevereiro separadamente. Para relatório mensal real, precisa de eventos próximos às fronteiras/um modelo de estimativa explicitamente identificado. Medir cobertura e viés de seleção (animais pesados não são necessariamente amostra representativa de todo o lote).

## Exemplo conceitual de dose — sem prescrição

Para formulação bovina específica de Dectomax com regra de bula 1 mL/50 kg: um animal de 420 kg produz valor **matemático** de 8,4 mL. A tabela de faixas da bula pode indicar **9 mL na faixa de 401–450 kg**. Portanto, **não programar arredondamento genérico** nem fornecer automaticamente uma dose clínica: usar regra explícita homologada para a apresentação, indicação e via; manter sugestão, dose efetivamente aplicada, fonte e carência separados. Veterinário responsável define protocolos; dados da bula precisam de verificação de versão/apresentação. Não recomendar dosagem aos animais fora do contexto veterinário.

## Sequência arquitetural sugerida, ainda sem programação

1. **Correções de integridade P01–P18** como requisito fundamental, incluindo transações/migrations/testes e salvamento automático sem pesos repetidos.
2. **Invariantes operacionais F01–F07, F15, F17**: ciclo de vida, cronologia, identificação, inventário e taxonomias coerentes, com backups antes de migração.
3. **Sanidade F08–F10**: produto, sugestão opcional de dose, carências, testes de farmácia/segurança operacional.
4. **Inteligência gerencial F11–F14, F18**: calendário sazonal, dados confiáveis, metas e projeções, comparativos e exportações.
5. **Interoperabilidade oficial e anexos F16** só depois de modelo de dados sólido; requer verificação regulatória, homologação externa e não prometer certificação.

**Diretriz de execução futura:** uma visão/arquitetura consolidada, mas mudanças implementadas por fatias transacionais testáveis (podem compor uma grande versão final), sem uma PR monolítica arriscada. Manter desktop/offline e escopo enxuto; nenhuma implementação, merge ou migração de dados sem autorização explícita do proprietário.

---

# Etapa de levantamento — Backup, Configurações e Parametrização (29/10/2026)

**Contagem anterior validada:** P01–P18 = 18 pontos de correção/investigação; F01–F18 = 18 requisitos de evolução.  
**Contagem após esta rodada:** P01–P26 = **26 pontos de correção/investigação/UX**; F01–F26 = **26 propostas de evolução**. Os itens novos ainda não são bugs reproduzidos; foram classificados conforme evidência e intenção.  
**Estado:** somente levantamento e proposta de arquitetura. **Nenhuma alteração no GitHub, configuração, dado ou backup executada.**

## Evidências de código consultadas

- `src/pages/Configuracoes.jsx` (aprox. 500 linhas): uma mesma tela apresenta **Geral, Curral, Comercial, Segurança, Relatórios, Equipamento/Balança e Dados/atalho para Manutenção** em diversos cartões; cada grupo tem permissões próprias. O campo `intervalo_pesagem_dias` já se diz reservado para relatório futuro, logo não se deve anunciar que está operacional.
- `src/modules/settings/application/appConfigService.js`: já há **cinco grupos versionados** no armazenamento (`auth-policy`, `operational-defaults`, `sales-policy`, `weight-warning-policy`, `report-settings`), apresentados na página como formulário agrupado. É possível reorganizar a interface preservando chaves, contratos, permissões e compatibilidade do banco.
- `src/pages/ManutencaoSistema.jsx` (aprox. 836 linhas): reúne **Status do banco, Migração, Backup, Exportação, Importação JSON, Restauração, Limpeza de dados, Diagnóstico** e ainda uma aba **Controle** com relatórios. Mistura rotinas frequentes, perigosas, administrativas e técnicas.
- `src/modules/maintenance/infrastructure/maintenanceDataAdapter.js` linhas aprox. 41–75: `createDatabaseBackup` e `createFullDataBackup` **chamam a mesma função** `persistFullBackup`; produzem arquivo JSON completo sob `backups` com manifesto e SHA-256. Dois botões sugerem formatos diferentes, mas não o são.
- `maintenanceDataAdapter.listBackups`: lista arquivos JSON da subpasta `backups`; a tela mostra nome, tamanho e data dos **10 primeiros**, sem necessariamente classificar cada arquivo por integridade/restaurabilidade, origem ou localização externa.
- `src/storage/indexedDb/backup/backupService.js`: gera o backup completo de todas as stores, valida SHA-256, faz `dryRunRestore` e restore com transações e checagens; formatos legados são reconhecidos sob regras específicas. O JSON completo inclui cadastros, dados comerciais, usuários locais e hashes/salts de senha (não senha em claro). A **gravação em JSON texto puro** demanda tratar privacidade/proteção do arquivo externo.
- `docs/user/BACKUP-E-RESTAURACAO.md`: documenta backups automáticos **antes de operações perigosas** e recomenda cópia externa; parte do texto ainda faz referências à versão 1.2.0/banco v7 embora a main atual use banco v8. Não confundir os backups de segurança pré-operação com rotina periódica de prevenção de perda de computador/disco.

## Novos itens de correção/investigação (P19–P26)

| ID | Prioridade | Problema demonstrado / hipótese | Aceite esperado |
|---|---|---|---|
| **P19** | Alta — UX | **Duplicidade de botões "Backup do banco" e "Backup completo"** para a mesma função. Confirmado em `maintenanceDataAdapter.js`. | Um comando principal **Criar backup agora**; sem diferença de formato inventada; preservação do serviço e do contrato atual. |
| **P20** | Alta — UX/segurança operacional | **Tela Backup e Manutenção mistura rotinas corriqueiras, importação/exportação, migração, reset, diagnóstico e relatórios** (`ManutencaoSistema.jsx`). | Separar as navegações por objetivo; opções destrutivas não aparecem junto do botão simples de backup; manter proteção atual por permissão e confirmação. |
| **P21** | Alta | **Catálogo insuficiente para saber o que de fato está protegido**: mostra nomes, bytes e data, até dez arquivos, sem resumo persistente de última verificação e possibilidade de restauração por arquivo; não foi confirmado um catálogo de cópias externas. | Exibir último backup **criado e verificado**, horário, tamanho, local, tipo (manual/pré-operação/automático), situação e opções seguras de inspeção. Não inferir "válido" só porque arquivo existe. |
| **P22** | Alta | **Mesmo computador não é segunda cópia independente**: a persistência padrão do backup usa subpasta local do aplicativo; falha física/perda da máquina pode atingir base e backup. É extensão do P14 (rotina externa não confirmada). | Testar e oferecer cópia para destino escolhido pelo usuário (pendrive/disco externo/pasta independente), com confirmação de leitura/hash da cópia; avisar ausência de destino, sem prometer armazenamento remoto. |
| **P23** | Média/Alta — UX | **Configurações em um grande formulário misto** com padrões de lançamento, critérios técnicos de pesagem, comercial, segurança, relatório, hardware e dados. Confirmado em `Configuracoes.jsx`. | Separar `Configurações`, `Parametrização`, `Equipamentos`, `Backup`, sem duplicar fonte de verdade; fluxo simples de localização das regras. |
| **P24** | Média — UX/integridade | **JSON de backup, JSON de exportação das pesagens e JSON de importação na mesma tela** podem gerar expectativa incorreta de que o arquivo de exportação de pesagens é um backup completo. | Nomes e descrições explícitos, importação de pesagens na sua própria tela e exportação junto aos módulos/relatórios; restore aceita apenas formato de backup compatível. |
| **P25** | Média | **Documentação e detalhes técnicos confundem usuário comum:** formatos/migrações descritos por versões antigas e detalhes de DB/build/contrato aparecem em áreas de uso comum. | Atualizar documentação para versão vigente e ocultar detalhes técnicos sob `Avançado / Diagnóstico`, preservando acesso para manutenção. |
| **P26** | Alta — proteção de dados | **Backup completo é JSON sensível**, contendo dados operacionais, financeiros, usuários e derivados de senha sem criptografia do payload nos caminhos inspecionados. Risco ao copiar/compartilhar, não evidência de vazamento. | Alertas claros, permissões mantidas, opção de exportação protegida/criptografada quando apropriada, sem quebrar restauração, legado ou perder a chave de recuperação; não enviar backup automaticamente para nuvem/terceiros. |

## Propostas adicionais de evolução (F19–F26)

| ID | Área | Proposta / comportamento esperado |
|---|---|---|
| **F19** | Backup | **Página exclusiva `Backup e Restauração`**, com status resumido, um botão `Criar backup agora`, último backup e lista pesquisável, sem reset/migração/exportação/importação de eventos nessa tela. |
| **F20** | Proteção periódica | **Backup automático configurável** (ex. na abertura se passou 1 dia, a cada X horas enquanto app aberto, eventos críticos) com verificação. Não prometer execução com app fechado; cadência e retenção visíveis; sem bloquear manejo por backups não essenciais, exceto operações destrutivas que continuam exigindo pré-backup. |
| **F21** | Cópia fora do dispositivo | **Destino externo opcional por pasta escolhida**, por exemplo pendrive ou outro disco. Exigir IPC/Electron seguro para escolher diretório e persistir autorização/caminho; tratar pendrive ausente, destino cheio, falha de permissão, cópia parcial, hash divergente, e não considerar cópia externa concluída até leitura de volta. O backup principal continua local. |
| **F22** | Catálogo e retenção | **Histórico claro e retenção conservadora**, com data, tamanho, motivo, local, esquema e resultado de verificação; exclusão de backups só com proteção, sem apagar última cópia validada; logs de falha e espaço disponível. |
| **F23** | Restauração guiada | Assistente **Selecionar → Analisar → Mostrar o que será substituído → Criar backup da situação atual → Confirmar → Restaurar → Conferir**, incluindo usuários e versionamento; bloqueio quando inválido, relatório da migração e reinício/login conforme contrato vigente. Testar com fixture isolada, nunca com dados produtivos reais sem proteção. |
| **F24** | Separação funcional | **Importação inteligente** permanece em `Importação`; exportações em `Relatórios`/`Pesagens`; relatórios de controle em `Relatórios/Conferência`; **Manutenção avançada** exclusiva para diagnóstico, integridade, migração, limpar e reset sob confirmação/permissões, acesso secundário. |
| **F25** | Parametrização | **Área `Parametrização` de regras operacionais**, agrupando `Pesagem e alertas`, `GMD/Indicadores`, `Comercial e saídas`, e futuros `Idade e categorias`, `Sanidade e carência`, `Seca e águas`, `Metas e projeções`; seções novas apenas quando tiverem funcionalidade efetiva, sem apresentar opções falsas. **Configurações** fica para padrões gerais e preferências; **Balança/Equipamentos** com seção própria; **Usuários/Segurança** mantidos à parte. |
| **F26** | Arquitetura/UX dos parâmetros | Reaproveitar as 5 chaves de appSettings já versionadas, seus validadores/SSOT e permissões. Navegação por seção com salvamento/descarte local e alertas de alterações pendentes; documentar impacto de cada mudança sobre prévias, relatórios e histórico e testar persistência/compatibilidade/backup. Não duplicar configuração nem alterar resultados retroativos sem política explícita. |

## Proposta de navegação (conceitual, não implementada)

```text
CADASTROS
  Marcas a Fogo · Raças · Categorias · Propriedades · Parceiros · Sanidade

OPERAÇÃO
  Lançamento de Pesagens · Entradas · Saídas · Movimentações · Sanidade

ANÁLISE
  Relatórios · Conferências · Metas e Projeções (quando implementado)

SISTEMA
  Configurações Gerais
  Parametrização
     Pesagens e Alertas
     Indicadores e GMD
     Comercial
     (demais seções apenas após implementadas)
  Balança e Equipamentos
  Backup e Restauração
  Usuários e Segurança
  Manutenção Avançada  (secundária)
```

## Gates para a futura correção integrada

1. Inventariar todas as configurações e consumidores, antes de reorganizar UI; não alterar chave/valor/default nem permissão sem aprovação expressa.
2. Backup v8 com todas as stores, auditActor, sanidade, configurações e usuários continua idêntico/restaurável; testar v6/v7/v8 conforme contratos suportados; hash+manifests+contagens continuam íntegros.
3. Resiliência: falta de espaço, sem permissão, backup corrompido, diretório externo removido, arquivo parcial, retenção sem espaço, recuperação após interrupção, e restore sem login local após troca de usuários.
4. Ao salvar parâmetros, nenhum campo invisível é zerado por acidente; seções e perfis têm os mesmos direitos que antes; regressão de regras de GMD, carcaça e arredondamento de peso.
5. Uma ação destrutiva exige pre-backup físico válido, revisão explícita e proteção atual; backup periódico que falha gera aviso e nunca declara sucesso.
6. E2E Electron no Windows, caminhos de arquivo reais (local e externo), bateria offline e dados históricos; antes de liberar versão, simular backup em um PC e restauração em ambiente isolado com dados reais anonimizados.
7. Nada é implementado nesta etapa; usuários trazem novas observações para consolidar o escopo antes de prompts/PRs.

**Fonte complementar de boas práticas:** ENISA, *Technical implementation guidance on cybersecurity risk management measures* (2025), e CISA, *#StopRansomware Guide*, recomendam redundância/isolamento de cópias e teste periódico de restauração. Não é requisito obrigatório do produto aplicar um padrão complexo de backup em nuvem; oferecer cópia offline separada já aumenta a proteção.
