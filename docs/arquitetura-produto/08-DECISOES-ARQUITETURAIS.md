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

## ADRs do Programa Pesagens Individuais 2.0 (14/09/2026)

Origem: Auditoria Master (`docs/evidence/auditoria-master-produto-pecuario/DECISION-REGISTER.md`,
DEC-001…DEC-022) e programa mestre aprovado pelo responsável em 14/09/2026. Todas as ADRs
abaixo estão **aceitas**. Nenhuma ADR anterior é sobrescrita; quando uma decisão nova
complementa uma antiga, a referência é indicada.

## ADR-018 — Cadastros mestres são stores Dexie (DEC-001)

**Decisão:** marcas, raças, categorias, parceiros, propriedades, causas de morte, faixas de
identificadores e usuários locais são stores versionadas do Dexie, com `id` de domínio,
`nome_normalizado`, `ativo` e `deleted_at`. `appSettings` fica restrito a preferências,
políticas, resumos, modelos de importação e estado técnico de migração.
**Consequência:** `registryService` e as chaves `cadastros-auxiliares:*` são migrados e removidos.
**Migração:** esquema v7 (ADR-034); dry-run obrigatório; chaves legadas apagadas só após validação.
**Rollback:** backup físico pré-migração (ADR-038).

## ADR-019 — Estoque de identificadores por faixas e exceções (DEC-002, DEC-015, DEC-017)

**Decisão:** o estoque é representado por `faixasIdentificadores` (tipo, marca, prefixo, início,
fim, dígitos, direção, cursor `proximo`) e `excecoesIdentificadores` (número, motivo). O item só se
materializa em `animalIdentificadores` quando é usado. Numeração = prefixo + número com padding.
"Estoque" no produto significa **somente identificadores**; nada de medicamentos, ração ou sal.
**Consequência:** `SequenciaBrincos` vira visão do `identifierInventoryService`; `window.__sequenciaBrincos` é removido.

## ADR-020 — Identidade visual número + marca_id e unicidade por tipo (DEC-003, DEC-005; complementa ADR-004)

**Decisão:** identificador VISUAL é único por `(marca_id, valor_normalizado)`; o mesmo número pode
existir em marcas diferentes. RFID e SISBOV são únicos globalmente; SISBOV não é reutilizado. A
unicidade é verificada no serviço, dentro da transação, e também pelo diagnóstico de integridade.
**Consequência:** `animalIdentificadores` ganha `tipo` (VISUAL, RFID, SISBOV, MANEJO, TEMPORARIO,
LEGADO), `marca_id`, `faixa_id`, `inicio`, `fim`, `motivo_troca`.

## ADR-021 — Migração de marca e raça com dry-run (DEC-004)

**Decisão:** valores livres de marca são agrupados por normalização; a fusão de grafias só ocorre
após verificar colisões `NÚMERO::MARCA` resultantes e com dry-run registrado em evidência. Raça
normaliza automaticamente quando não houver ambiguidade. Snapshots históricos nos eventos não são
reescritos (regra de leitura: coluna nova → legado → nulo).

## ADR-022 — Sanidade retirada do produto neste ciclo (DEC-006; reafirma ADR-007)

**Decisão:** a tela "Configurações de Sanidade", o grupo `sanidade` do registry e a chave
`cadastros-auxiliares:sanidade:*` são removidos. Se houver dados, são exportados para JSON em
`docs/evidence/program-2.0/` antes da remoção, com registro. Retorno exige nova ADR e módulo próprio.

## ADR-023 — `loteApartacoes` é a store canônica de lote; `lotes` é removida (DEC-007)

**Decisão:** remover a store `lotes` (sem uso na UI) no esquema v7 após verificar que está vazia.
`loteApartacoes` recebe `codigo`, `situacao`, `categoria_id`, `data_abertura`, `data_fechamento`,
`ativo`, `ordem`. Ocupação de lote é calculada por `animalLotes` com permanência aberta, nunca por
contagem de pesagens. Renomear apartação ou lote não reescreve `nome_lote`/`nome_apartacao` nos eventos.

## ADR-024 — Parceiro único com papéis (DEC-008)

**Decisão:** store `parceiros` com `papeis[]` (COMPRADOR, VENDEDOR, FRIGORIFICO, TRANSPORTADOR,
PROPRIETARIO). Operações, embarques e marcas referenciam `parceiro_id`, nunca o nome.

## ADR-025 — Operações comerciais como entidade e rendimento com origem (DEC-009, DEC-022; complementa ADR-012)

**Decisão:** compra, venda e abate são registros de `operacoesComerciais` (esquema v8) com status
RASCUNHO → CONFERIDA → FECHADA / CANCELADA; os eventos do animal apontam `operacao_id`. O rendimento
de carcaça é gravado por operação com origem `INFORMADO`, `PADRAO_EMPRESA` ou `PADRAO_PARCEIRO`;
nunca um 50 % silencioso. Nenhum valor monetário é digitado no curral.

## ADR-026 — Embarque com máquina de estados (DEC-010)

**Decisão:** estados PLANEJADO → EM_CARREGAMENTO → CONFERIDO → CONCLUIDO, além de CANCELADO;
transições exclusivamente no serviço. Saída só entra em embarque EM_CARREGAMENTO; embarque concluído
é somente leitura; reabrir exige motivo e auditoria. O evento de saída com `embarque_id` é o item do
embarque; não existe store de itens.

## ADR-027 — `legacy_payload` congelado com lista permitida (DEC-011)

**Decisão:** nenhuma chave estrutural nova entra em `legacy_payload`. Um gate
(`payload:allowlist:verify`) prova a lista permitida e a ausência de `_localId`, `peso_kg`,
`created_date`, `updated_date` e `status_animal` redundantes. Campos com consulta ou regra são
promovidos a colunas (`motivo_saida`, `operacao_id`, `causa_morte_id`, `marca_id`, `categoria_id`,
`apartacao_id`, `versao_formula`). O legado só é removido com zero consumidores, gate e backup.

## ADR-028 — Classificação do animal: nascimento opcional/estimado e categoria (DEC-012)

**Decisão:** `animais` ganha `nascimento`, `nascimento_estimado`, `categoria_id`, `marca_id`,
`raca_id`, `propriedade_id`; `situacao` passa a ATIVO, VENDIDO, ABATIDO, MORTO, DOADO, TRANSFERIDO,
CANCELADO (projeção derivada dos eventos). "Era" vira campo legado somente-leitura. Categoria é
cadastro (`categoriasAnimal`) com sexo aplicável e faixa etária; a sugestão por idade é explicável e
nunca sobrescreve valor informado.

## ADR-029 — Propriedades no modelo v7, sem multi-fazenda avançada (DEC-013; parcial de P-003)

**Decisão:** store `propriedades` (PROPRIA/TERCEIRO, parceiro, município/UF, código oficial,
padrão). `empresa_id` permanece `'local'`; nenhum `fazenda_id` é adicionado às demais stores até P-003.

## ADR-030 — Sessão única por data + local, fechada bloqueia, reabertura com motivo (DEC-014; complementa ADR-005)

**Decisão:** `sessoesPesagem` com status ABERTA, CONFERENCIA, FECHADA, CANCELADA; índice
`[data+local]`; sessão fechada recusa novos eventos no serviço; reabertura grava
`motivo_reabertura` e auditoria; fechamento persiste `snapshot`. Sessões de importação nascem FECHADA.

## ADR-031 — Remoção de `GerenciarSaidasDialog` e `perfis-saida` (DEC-016)

**Decisão:** após migrar compradores para `parceiros`, o diálogo legado e a chave
`perfis-saida:*` são removidos; perfis de venda/abate não são migrados (substituídos por operações).

## ADR-032 — Limpeza de dados em dois níveis (DEC-018)

**Decisão:** "Limpar dados operacionais" preserva usuários, configurações e cadastros mestres.
"Reset completo" apaga tudo, é exclusivo do ADMIN e exige backup físico validado, senha do usuário
atual e confirmação textual.

## ADR-033 — Documento obrigatório na venda é configuração (DEC-019)

**Decisão:** `exigir_documento_venda` em configurações (padrão `false`), aplicado no serviço e no
fechamento, encerrando a divergência entre Lançamento e Fechamento.

## ADR-034 — Corte das migrações: v7 e v8; cadastros antes do restante da F1 (DEC-020, DEC-021)

**Decisão:** v7 = cadastros mestres + identidade + identificadores + login local; v8 = operações
comerciais + embarques com estados + colunas promovidas em `pesagens`. Os cadastros mestres entram
antes das pendências restantes da F1; a resolução do animal por índice de identificadores é parte
do slice de identificação.

## ADR-035 — Login local com usuários locais

**Decisão:** autenticação 100 % offline com store `usuariosLocais` (nome, login,
`login_normalizado`, `senha_hash`, `senha_salt`, `senha_iteracoes`, algoritmo, perfil, ativo,
`deve_trocar_senha`, `ultimo_login_at`). Hash PBKDF2-SHA-256 via Web Crypto, salt ≥ 16 bytes
aleatório por usuário, ≥ 310 000 iterações, 32 bytes. Sem módulo nativo, sem servidor, sem OAuth.
Primeira execução sem usuários abre "Configuração Inicial" para criar o ADMIN (sem senha padrão).
Sessão autenticada em memória + `sessionStorage` (userId, nome, perfil, loginAt, lastActivityAt);
bloqueio por inatividade configurável (padrão 60 min; 0 desliga); bloqueio temporário de 30 s após
5 tentativas incorretas (memória de runtime). Senhas nunca aparecem em logs, backups textuais de
diagnóstico ou CSV. Não desativar o último ADMIN ativo. Usuário referenciado em auditoria nunca é
apagado, apenas inativado. Substitui a parte "desktop offline" de ADR-013 para este ciclo;
P-006 (provedor OIDC) permanece para a fase online.

## ADR-036 — Controle de acesso simples por perfis fixos

**Decisão:** perfis ADMIN, GESTOR e OPERADOR com mapa estático de permissões em
`src/modules/auth/domain/accessPolicy.js` (`launch.use`, `weighing.*`, `animal.*`, `registry.*`,
`commercial.*`, `shipment.*`, `session.close/reopen`, `reports.read`, `maintenance.backup/restore/clear`,
`users.manage`, `settings.manage`). Não existe store de permissões nem editor. A UI esconde o que o
perfil não pode; o serviço valida as ações críticas (restore, limpeza, usuários, fechamento,
operações). Auditoria grava `actor_user_id`, `actor_user_name`, `actor_user_profile`; registros
antigos ficam com `actor_user_id = null`.

## ADR-037 — Versionamento em cinco eixos e identificadores de build

**Decisão:** `src/versioning/versionInfo.js` expõe `APP_VERSION` (derivada de `package.json`),
`DB_SCHEMA_VERSION`, `BACKUP_FORMAT_VERSION`, `UI_CONTRACT_VERSION`, `DATA_CONTRACT_VERSION`,
`UI_BUILD_ID` e `DATA_BUILD_ID`. A tela de Manutenção e o diagnóstico exibem todos. O gate
`packaged:build:verify` prova que o Setup contém os marcadores e não é anterior aos bundles.

## ADR-038 — Migrações resumíveis, backup pré-migração e fail closed

**Decisão:** `src/storage/migrations/migrationCoordinator.js` detecta a versão do banco, gera e
valida backup físico (`pre-migration-vN-<data>.json`, SHA-256) **antes** de abrir na versão nova;
se o backup falhar, a migração é bloqueada. Backfills grandes rodam como migração resumível após a
abertura, com checkpoints em `appSettings['migration:vN']` (status, processados, total, erro), podendo
parar e continuar sem duplicar. Em falha: escrita bloqueada, diagnóstico exibido, backup preservado.
Backups de formato anterior continuam restauráveis; restore de banco anterior dispara o backfill.

## ADR-039 — Política de release

**Decisão:** cada versão nasce de build limpo (`release:clean` → `build` → electron-builder), com
verificação do `app.asar` (versão, `UI_BUILD_ID`, `DB_SCHEMA_VERSION`), checksum SHA-256, manifesto
(`version`, `dbSchema`, `backupFormat`, `uiContract`, `dataContract`, `installer`, `sha256`,
`signed`) e nome `Pesagens Individuais Setup X.Y.Z.exe`. `release/` é reservado à distribuição
assinada; `release-unsigned/` ao diagnóstico; `signed=false` enquanto não houver Authenticode, e
nenhum pacote sem assinatura é declarado release oficial. Roadmap: 1.2.0 → 1.3.0 → 1.4.0 → 1.5.0 → 2.0.0.
Tags só após o gate da release. CHANGELOG em seções consolidadas (Added/Changed/Fixed/Removed/Migration/Security).

## ADR-040 — Governança Git e trabalho multiagente

**Decisão:** repositório inicializado em 14/09/2026 (tag `v1.1.17-baseline`). Desenvolvimento em
`program/2.0`; `main` só recebe integrações de release. Arquivos compartilhados têm dono único
(`schema.js`, `package.json`, `pages.config.js`, `Layout.jsx`, `d17b-modelobase1.css`,
`verify-ui-consistency.mjs`, `CHANGELOG.md`): agentes trabalham em áreas disjuntas e devolvem
patches ao coordenador, que integra sequencialmente, roda os gates e faz commits semânticos.
Nenhuma edição concorrente de arquivo compartilhado.

## ADRs do Programa Master de Evolução 1.1.17 → 1.6.0 (14/09/2026, DEC-023…DEC-030)

Refinam as ADR-035…ADR-040 do mesmo dia. Onde houver diferença, estas prevalecem.

## ADR-041 — Autenticação local e offline (DEC-023; substitui a parte correspondente de ADR-035)

**Decisão:** login LOCAL, sem servidor, Supabase, Firebase, OAuth, e-mail ou SMS; a autenticação nunca impede o app de trabalhar sem rede. **Threat model** (docs/engineering/AUTH-THREAT-MODEL.md): o login local melhora controle e auditoria; **não** é fronteira contra quem tem acesso completo ao perfil do sistema operacional e aos arquivos do usuário; não há criptografia total do banco.

## ADR-042 — Quatro papéis fixos (DEC-024; substitui ADR-036)

**Decisão:** ADMIN (tudo), GESTOR (operação, rebanho, comercial, relatórios, fechamento/reabertura, configurações operacionais; sem usuários, restore total, limpar tudo ou política de autenticação), OPERADOR (lançamento, consulta operacional, cadastro rápido, rotinas de curral; sem valores comerciais, usuários, manutenção, restore, limpeza, fechamento gerencial, configuração global), **CONSULTA** (somente leitura). Sem permissões por usuário. `permissionService` central com ações nomeadas e `authorize(action)` no boundary de serviço; nenhum `if (role === …)` espalhado pelas telas.

## ADR-043 — Credenciais (DEC-025)

**Decisão:** store **`usuarios`** no esquema v7 (`id`, `empresa_id`, `nome`, `login`, `login_normalizado` único por empresa, `role`, `ativo`, `password_hash`, `password_salt`, `password_algorithm='PBKDF2-SHA256'`, `password_iterations`, `password_version`, `must_change_password`, `recovery_hash`/`recovery_salt` só para o ADMIN de bootstrap, `failed_login_count`, `locked_until`, `last_login_at`, timestamps). Web Crypto PBKDF2-HMAC-SHA-256 com salt aleatório por usuário; parâmetros de custo centralizados, versionados no registro e calibrados para desktop. Senha mínima simples (6 caracteres, sem regras artificiais; triviais recusadas). Reset por ADMIN gera senha temporária e `must_change_password=true`. Sem backdoor, sem `admin/admin`. Hash e salt nunca indexados, logados, exportados em CSV ou incluídos em diagnóstico.

## ADR-044 — Bootstrap e recuperação (DEC-026)

**Decisão:** ao abrir uma instalação sem usuários (migração ou banco novo) o app mostra o FIRST-RUN ADMIN SETUP antes da tela principal (nome, login, senha, confirmação). Gera uma **Recovery Key** aleatória exibida uma única vez, com botão para copiar/salvar mediante confirmação; o banco guarda só o verificador (hash + salt). A key redefine a senha do ADMIN local, invalida a anterior e gera uma nova. Backup restaurado com usuários válidos não executa bootstrap.

## ADR-045 — Sessão de usuário (DEC-027; substitui os parâmetros de ADR-035)

**Decisão:** sessão em memória; nenhuma senha ou token em `localStorage`; `sessionStorage` apenas para a recarga técnica do renderer, nunca para sobreviver ao fechamento do app. Auto-bloqueio por inatividade configurável, padrão **30 min**. Ações Bloquear, Trocar usuário, Sair. Restore, limpeza destrutiva ou alteração do próprio usuário invalidam a sessão. Bloqueio temporário após tentativas incorretas (`failed_login_count`, `locked_until` persistidos; limite e duração em `auth-policy`).

## ADR-046 — Autorização e auditoria por usuário (DEC-028, DEC-029)

**Decisão:** ações críticas exigem checagem explícita de permissão no serviço. `auditoria` grava `usuario_id` e `usuario_nome_snapshot` (o nome no momento do fato) e `resumo`; `created_by_user_id`/`updated_by_user_id` onde fizer sentido (sem índice); `sessoesPesagem.operador_usuario_id`; fechamento/reabertura e operações comerciais com usuário. Eventos LOGIN_SUCESSO, LOGOUT, BLOQUEIO, RESET_SENHA e ALTERACAO_USUARIO registrados de forma resumida. Nunca gravar senha, hash, recovery key ou segredo. Registros anteriores ficam com `usuario_id = null`.

## ADR-047 — Versionamento em quatro eixos e política SemVer (DEC-030; complementa ADR-037/039)

**Decisão:** App SemVer (`package.json`/Electron `app.getVersion()`), `DB_SCHEMA_VERSION` (schema.js), `BACKUP_FORMAT_VERSION` (módulo de backup) e `RELEASE_MANIFEST_VERSION` (gerador do manifesto) nunca se confundem; `UI_BUILD_ID`/`DATA_BUILD_ID`/contratos continuam como marcadores de build. PATCH = correção sem contrato persistente; MINOR = funcionalidade/store/migração compatível; MAJOR = quebra deliberada de backup/export/API local. Manifesto de release com `appVersion`, `dbSchemaVersion`, `backupFormatVersion`, `releaseManifestVersion`, `gitCommit`, `buildTimestamp`, `platform`, `arch`, instalador e SHA-256. Gate `release:version-contract:verify`. Marcos: **1.1.18** (baseline + contrato de versão, sem esquema novo) → 1.2.0 (v7, usuários, cadastros, backfill, lançamento seleciona cadastros) → 1.3.0 (identificadores) → 1.4.0 (lançamento enxuto + lotes) → 1.5.0 (v8 comercial/embarque) → 1.6.0 (sessão/fechamento/animais/auditoria). Cada marco deixa versão, CHANGELOG, notas e evidência coerentes para rollback e bisect; nenhum marco é publicado remotamente sem autorização.

## ADR-048 — Governança de fatias e evidências (complementa ADR-040)

**Decisão:** branch `program/pesagens-master-evolution`; fatias `slice/sNN-…` quando possível; um dono por fatia; integração sequencial; fatia só entra na linha de integração com gates verdes; evidência em `docs/evidence/<slice>/` (REPORT, FILES-CHANGED, TESTS, MIGRATION, PERF, SCREENSHOTS, RISKS, ROLLBACK). Migração real registra contagens antes/depois, ids não resolvidos, colisões, duração, hash do backup e integridade antes/depois. Teste físico só é declarado EXECUTADO com evidência humana.

## Decisões pendentes

| ID | Decisão | Informação necessária |
|---|---|---|
| P-001 | Primeira balança | fabricante, modelo, firmware, cabo/protocolo |
| P-002 | Primeiro leitor RFID | fabricante, modelo e padrão do brinco |
| P-003 | Estrutura organizacional | empresas, fazendas e currais reais (propriedades mínimas já decididas em ADR-029; multi-fazenda continua pendente) |
| P-004 | Método de custo | insumos considerados e regra de rateio (rateio por cabeça é o padrão provisório da compra) |
| P-005 | Canal online | provedor, região, orçamento e SLA |
| P-006 | Autenticação online | identidade própria ou provedor OIDC (login local decidido em ADR-035) |
| P-007 | Escopo SISBOV | propriedade certificada, parceiro/certificadora e acesso |
| P-008 | Relatórios iniciais | ordem entre PDF, XLSX e painéis (tabela + CSV é o mínimo do 2.0) |

## Processo para nova decisão

Registrar contexto, opções, decisão, consequências, migração, rollback, impacto
em dados, segurança, testes e documentação. Alteração de uma decisão aceita não é
uma edição silenciosa: criar nova ADR que substitui a anterior.

