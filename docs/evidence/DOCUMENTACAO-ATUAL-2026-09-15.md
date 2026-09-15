# Pesagens Individuais — documentação vigente (consolidado de 15/09/2026, pausa do programa)

Ordem: checkpoint da pausa · estado inicial · arquitetura (00–14, ADRs) · engenharia · evidências fase 0 e s00 · releases 1.1.18 e 1.2.0 (rascunho) · docs do usuário. A Auditoria Master (45 documentos) está em AUDITORIA-MASTER-COMPLETA.md.

---

<!-- docs/evidence/program-2.0/CHECKPOINT-2026-09-15-PAUSA.md -->

# Checkpoint — pausa do programa em 15/09/2026 07:45

Pedido do responsável: "quero fechar por enquanto". Estado gravado para retomada.

## Onde o trabalho está

| Item | Estado |
|---|---|
| `main` | baseline 1.1.17 (tag `v1.1.17-baseline`, commit `77eeb3b`) — intocado |
| `release/1.1.18` | marco 1.1.18 fechado e etiquetado (`v1.1.18`, commit `4d81b50`): baseline verde, contrato de versão, docs de engenharia; sem esquema novo; sem instalador |
| `program/pesagens-master-evolution` | integração da 1.2.0 em andamento. Último commit íntegro: `10aa042`. **Este checkpoint** acrescenta um commit "wip" com o estado parcial da onda 1 de correções (ver abaixo) |
| Worktree `../MAKGESTAO-1.1.18` | branch `release/1.1.18`; `node_modules` é uma junção para o repositório principal; pode ser removida com `git worktree remove ../MAKGESTAO-1.1.18` |

## O que está pronto na 1.2.0 (commits até `10aa042`)

- Dexie v7 (23 stores), coordinator de migração v6→v7 com backup físico prévio e backfill resumível, backup formato 3, restore v6→v7 com backfill, dois níveis de limpeza, integridade v7.
- Login local e usuários (revisão 1: 3 perfis, store nomeada no esquema já como `usuarios`), AuthGate, RequirePermission, UserMenu, tela Usuários, Configurações.
- Cadastros mestres como stores + telas Marcas, Raças, Categorias, Parceiros, Propriedades, Causas de morte; sanidade removida.
- Menu por grupos e permissões; Lançamento lendo compradores/frigoríficos/causas das stores.
- Massa de teste v7, gate de pacote, docs do usuário e notas 1.2.0 (rascunho), contrato de versão rev.2, ADR-041…048.

## O que ficou parcial (onda 1 de correções, interrompida)

A onda 1 (AUTH, STORAGE, CATALOG, LAUNCH) foi interrompida três vezes (queda de sessão na noite de 14/09 e interrupções em 15/09) e parada a pedido. O commit `wip(onda-1)` guarda o estado parcial: `lint` verde; **gates vermelhos esperados** até a conclusão:

- `storage:dexie:verify`, `storage:backup:verify` — ainda referenciam a store `usuariosLocais` (o esquema já é `usuarios`);
- `auth:local:verify`, `auth:access:verify` — módulo de auth em transição da revisão 1 para a 2 (arquivos duplicados: `authSession.js`/`sessionService.js`, `localAuthService.js`/`authService.js`, `accessPolicy.js`/`permissionService.js`; `loginLockout.js` removido; novos `passwordPolicy.js`, `recoveryKey.js`, `authAudit.js`, `authErrors.js`);
- `registry:master:verify` — gate ainda espera `actor_user_id` (auditoria rev.2 usa `usuario_id`);
- `ui:shell-settings:verify` — regex do menu lateral ajustada; rótulo "Trocar senha" pendente no UserMenu;
- `catalog`: `catalogResolver.js` existe em `domain/` e `application/`; `registryServices.js` novo; `seeds.js` alterado;
- `Lançamento`, `ConfirmarAnimalSnDialog`, `weighingWarnings`, `operations/*`: edições parciais para seletores de marca/raça/categoria e políticas de configuração; `operationalPolicies.js` novo.

Findings das revisões ainda abertos: ver `docs/evidence/program-2.0/phase-01/` (quando gerado) e os resultados no journal do workflow `wf_9b0eb29b-943` (P1: login impossível com escrita bloqueada por migração; alinhamento rev.2; P2: padrão em registro inativo, exclusão com vínculo histórico, reset sem senha, restore sem logout, docs prometendo comportamento inexistente, parser numérico de Configurações, LockScreen desmontando o app, manifesto rev.2, rótulos).

## Como retomar

1. `git checkout program/pesagens-master-evolution` (repositório principal); `git log --oneline | head`.
2. Ler este checkpoint, `docs/evidence/STATE-OF-REPO-BEFORE.md`, `docs/arquitetura-produto/10…14` (rev.2) e `docs/evidence/ui-parity/USER-SAMPLE-2026-09-14.md`.
3. Concluir a onda 1 em fatias curtas (um agente por área, prompts do script `workflows/scripts/pesagens-1-2-0-onda-1-*.js`, com a nota de reconciliação), começando por AUTH (rev.2) e STORAGE (renome `usuarios`), depois CATALOG e LAUNCH.
4. Coordenador: `package.json` (scripts `auth:crypto/bootstrap/permissions/recovery`, `audit:actor`), `verify-ui-consistency.mjs` se o Lançamento mudar, `npm.cmd run test:quick` verde.
5. Onda 2: paridade de UI ModeloBase1 (amostra do responsável; harness em `scripts/ui-parity/`) e docs coerentes.
6. Bump 1.2.0 (`package.json`, `package-lock.json`, `src/lib/appVersion.js`), `release:clean`, `dist:unsigned`, `packaged:build:verify`, checksum/manifesto, capturas, evidências em `docs/evidence/s01-*`, checkpoint no formato do programa, tag `v1.2.0`.

## Modo de trabalho recomendado na retomada (custo)

Modo enxuto: um agente por fatia, sem revisores paralelos; fatias de ≤ 45 min; integração e correções pequenas pelo coordenador; gates como verificação. Estimativa para fechar a 1.2.0: 3,5–4 h.

---

<!-- docs/evidence/STATE-OF-REPO-BEFORE.md -->

# STATE-OF-REPO-BEFORE — estado real do repositório antes do programa de evolução

**Gerado em:** 14/09/2026 (noite) · **Programa:** Pesagens Individuais 1.1.17 → 1.6.0 (prompt "Programa Master de Evolução", que refina o "Programa Mestre 2.0" do mesmo dia).

## 1. Ponto de partida imutável (tag `v1.1.17-baseline`, commit `77eeb3b`, branch `main`)

| Item | Valor real | Confere com a auditoria? |
|---|---|---|
| Versão do app (`package.json`) | 1.1.17 | sim |
| Electron / React / Vite / Dexie | 35 / 18 / 6 / 4 | sim |
| Esquema Dexie | `DB_VERSION = 6`, 16 stores (`lotes` sem uso) | sim |
| Backup | formato `pesagens-individuais-indexeddb-backup`, `formatVersion 2` | sim |
| Git | **não existia**; inicializado neste programa (`git init`, `.gitignore`, 671 arquivos rastreados) | auditoria já apontava a ausência |
| lint / build | verdes (11 s / 22 s) | sim |
| `test:quick` | vermelho em `ui:operational-customization:verify` e `ui:consistency:verify`; 26 de 28 verificações individuais verdes | sim |
| Instalador existente | `release-unsigned/Pesagens Individuais Setup 1.1.17.exe` (diagnóstico, sem assinatura) | sim |
| Nome do banco / origem | `pesagens-individuais` (IndexedDB do renderer), `userData` do Electron; **não alterados** por este programa | — |
| Sanidade | tela ativa no menu contra ADR-007 | sim (contradição C-01) |
| Cadastros comerciais/causas | em `appSettings` via `registryService`; `GerenciarSaidasDialog.jsx` existe mas o Lançamento não o importa (`perfis-saida` só por compatibilidade) | sim |
| Auth / usuários / versionamento formal | inexistentes | sim |

Arquivos divergentes da auditoria: nenhum de conteúdo. Duas divergências de leitura foram confirmadas no código: (1) o gate `ui:operational-customization` exigia `GerenciarSaidasDialog` que a tela já não usa desde o trabalho paralelo de 14/09 (documentado em `docs/auditoria/AUDITORIA-ESTADO-2026-09-14.md` §3 e em `UX-FLOW-AUDIT.md`); (2) o gate `ui:consistency` exigia sintaxe de template literal que o componente nunca teve na tag.

## 2. Diagnóstico dos dois gates vermelhos (S-00.0)

| Gate | Causa | Código ou teste? | Ação tomada | Prova |
|---|---|---|---|---|
| `ui:operational-customization:verify` | asserção `assert.match(launch, /GerenciarSaidasDialog/)` sobre `LancamentoPesagensIndividuais.jsx`, que em `v1.1.17-baseline` já lê compradores/vendedores/frigoríficos de `loadRegistryGroup('comerciais')` (registry) e não importa o popup | **teste desatualizado** (o contrato da tela mudou em 14/09 com a página Cadastros Comerciais; o popup ficou órfão) | gate reescrito para o contrato vigente: popup ausente, seleção do registry, persistência do registry após reabrir | `git show v1.1.17-baseline:src/pages/LancamentoPesagensIndividuais.jsx | grep -c GerenciarSaidasDialog` → 0; `docs/evidence/program-2.0/phase-00/GATES.md` |
| `ui:consistency:verify` | regex acoplada à sintaxe (`className={\`view-seg…` e rótulos literais) | **teste frágil** | asserções estruturais (`.view-seg` + slider + `VIEW_MODES` + rótulo acessível gerado) | idem |

Resultado: `test:quick` 20/20 verde no commit `8c79022`, sem alterar código de produto.

## 3. Estado no momento deste documento (branch `program/2.0` → renomeada `program/pesagens-master-evolution`)

| Commit | Conteúdo |
|---|---|
| `8c79022` | gates alinhados ao contrato real (S-00.0) |
| `39a2071` | ADR-018…ADR-040 |
| `c2a1a06` | medição de payload/auditoria |
| `e4d4278` | contratos 10–14 + evidências da fase 0 (gates, perf Node 36k/250k, perf Chromium 36k) |
| `986c502` | **esquema v7 estrutural** (stores novas, `lotes` removida) — ponto a partir do qual o marco 1.1.18 "sem esquema novo" precisa ser derivado do commit anterior |
| `deac4a3` | `versionInfo.js`, `auditActor.js`, evidências |
| árvore de trabalho | ~70 arquivos não commitados dos agentes da Fase 1 (storage/migração, auth, cadastros, perf, QA/docs, telas) — integração em andamento |

## 4. Riscos identificados antes das alterações

1. **Trabalho paralelo na mesma árvore** (sessão anterior de 14/09 deixou gates vermelhos): mitigado por dono único de arquivo e commits sequenciais do coordenador.
2. **Migração v6 → v7 sem backup físico** seria irreversível: contrato de preflight (documento 14) obriga backup validado antes de abrir na versão nova; sem ponte de arquivos (navegador de desenvolvimento) a migração é bloqueada.
3. **Marca em texto livre compõe a identidade**: fusão automática pode unir animais; regra "colisão não funde" (ADR-021).
4. **Store `lotes`**: removida na v7 só com verificação de vazio no preflight.
5. **Nome do banco/origem**: qualquer mudança faria os dados "sumirem"; proibido (regra 25 do programa).
6. **Assinatura Authenticode ausente**: nenhum pacote é release oficial; `signed=false`.
7. **Desempenho**: reconstrução do índice de animais na tela (0,9 s no Chromium, 36 mil) só se resolve no marco 1.3.0.

## 5. Reconciliação entre os dois programas do dia 14/09

O "Programa Mestre 2.0" (releases 1.2.0…2.0.0) e o "Programa Master de Evolução" (marcos 1.1.18…1.6.0) têm o mesmo conteúdo técnico; o segundo prevalece. Diferenças aplicadas:

| Tema | Programa 2.0 | Programa de Evolução (vigente) |
|---|---|---|
| Marcos | 1.2.0 → 1.3.0 → 1.4.0 → 1.5.0 → 2.0.0 | **1.1.18** (baseline + contrato de versão) → 1.2.0 (v7+auth+cadastros+lançamento seleciona cadastros) → 1.3.0 (identificadores) → 1.4.0 (lançamento enxuto + lotes) → 1.5.0 (v8 comercial/embarque) → **1.6.0** (sessão/fechamento/animais/auditoria) |
| Perfis | ADMIN, GESTOR, OPERADOR | + **CONSULTA** (somente leitura) |
| Store de usuários | `usuariosLocais` (perfil, senha_*) | **`usuarios`** (role, password_*, recovery_*, failed_login_count, locked_until, last_login_at) |
| Auditoria | `actor_user_id/name/profile` | **`usuario_id`, `usuario_nome_snapshot`**; eventos de login resumidos |
| Sessão | inatividade 60 min | **30 min**; sem localStorage; sessionStorage só para recarga técnica |
| Recuperação do ADMIN | — | **Recovery Key** exibida uma vez, só hash/verificador no banco |
| Versionamento | 5 eixos + build ids | App SemVer, DB_SCHEMA_VERSION, BACKUP_FORMAT_VERSION, **RELEASE_MANIFEST_VERSION** (os demais marcadores continuam como informação de build) |
| Evidências | `docs/evidence/program-2.0/<fase>/` | **`docs/evidence/<slice>/`** (REPORT, FILES-CHANGED, TESTS, MIGRATION, PERF, SCREENSHOTS, RISKS, ROLLBACK); `program-2.0/phase-00` permanece como histórico e é referenciado por `s00-baseline-recovery` |
| Branches | `program/2.0` | `program/pesagens-master-evolution` + `slice/*` quando possível |

Nenhuma decisão DEC-001…DEC-022 mudou.

---

<!-- docs/arquitetura-produto/README.md -->

# Arquitetura de Produto — Pesagens Individuais

**Versão documental:** 1.0  
**Data-base:** 08/09/2026  
**Estado do produto analisado:** 1.1.17  
**Responsabilidade:** fonte de verdade para evolução funcional e técnica

## Finalidade

Este diretório descreve o produto que será construído a partir da aplicação
desktop atual. Ele separa claramente:

- o que já existe e pode ser reutilizado;
- o que é requisito futuro;
- o que está fora de escopo;
- como os domínios se relacionam;
- quais cadastros, relatórios e integrações serão entregues;
- em que ordem o trabalho deve ocorrer;
- quais evidências são necessárias para considerar cada entrega concluída.

Auditorias em `docs/auditoria` e registros em `docs/evidence` continuam válidos
como evidência histórica, mas não definem a arquitetura futura. Alguns desses
documentos retratam versões antigas baseadas em JSON, SQLite ou sanidade. Para
decisões novas, este diretório prevalece.

## Norte do produto

> Ser a ferramenta mais rápida e confiável para pesagem individual, histórico
> de desempenho, apartação, lotes e fechamento comercial no curral, funcionando
> sem internet e preparada para sincronização e equipamentos.

O produto não será transformado imediatamente em um ERP rural genérico. Toda
funcionalidade deve melhorar pelo menos um destes resultados:

1. velocidade de trabalho no curral;
2. qualidade e rastreabilidade do dado;
3. decisão sobre desempenho e destino dos animais;
4. conferência operacional e comercial;
5. segurança de operação offline.

## Mapa da documentação

| Documento | Pergunta respondida |
|---|---|
| [00-VISAO-E-PRINCIPIOS.md](./00-VISAO-E-PRINCIPIOS.md) | Que produto estamos construindo e sob quais princípios? |
| [01-ESTADO-ATUAL-E-LACUNAS.md](./01-ESTADO-ATUAL-E-LACUNAS.md) | O que existe hoje e o que falta? |
| [02-ARQUITETURA-DE-DOMINIO.md](./02-ARQUITETURA-DE-DOMINIO.md) | Quais são os módulos, entidades e regras centrais? |
| [03-CADASTROS-E-FLUXOS.md](./03-CADASTROS-E-FLUXOS.md) | Quais cadastros e operações existirão? |
| [04-RELATORIOS-E-INDICADORES.md](./04-RELATORIOS-E-INDICADORES.md) | Quais relatórios serão produzidos e como serão calculados? |
| [05-INTEGRACOES-E-EQUIPAMENTOS.md](./05-INTEGRACOES-E-EQUIPAMENTOS.md) | Como balanças, RFID, arquivos e serviços externos entrarão no sistema? |
| [06-OFFLINE-SINCRONIZACAO-E-SEGURANCA.md](./06-OFFLINE-SINCRONIZACAO-E-SEGURANCA.md) | Como preservar o offline e adicionar login/base online com segurança? |
| [07-ROADMAP-E-CRITERIOS-DE-ACEITE.md](./07-ROADMAP-E-CRITERIOS-DE-ACEITE.md) | Em qual ordem implementar e como provar que ficou pronto? |
| [08-DECISOES-ARQUITETURAIS.md](./08-DECISOES-ARQUITETURAIS.md) | Quais decisões são obrigatórias e quais estão pendentes? |
| [09-PESQUISA-E-REFERENCIAS.md](./09-PESQUISA-E-REFERENCIAS.md) | Quais produtos e fontes embasaram o desenho? |

## Entregas por fase

| Documento | Fase | Conteúdo |
|---|---|---|
| [F0-STATUS.md](./F0-STATUS.md) | F0 | Situação das entregas da fase, evidências e decisões pendentes |
| [F0-01-MAPA-DE-CAMPOS.md](./F0-01-MAPA-DE-CAMPOS.md) | F0 | Campos atuais (Dexie v6) → modelo-alvo, com status e lacunas |
| [F0-02-CATALOGO-DE-FORMULAS.md](./F0-02-CATALOGO-DE-FORMULAS.md) | F0 | Fórmulas implementadas, testes que as protegem e divergências D1–D7 |
| [../evidence/f0-baseline/BASELINE.md](../evidence/f0-baseline/BASELINE.md) | F0 | Baseline p50/p95/p99 nas massas vazia, pequena, 36 mil e 250 mil |
| [F1-STATUS.md](./F1-STATUS.md) | F1 | Avanço de desempenho, contrato visual v2, evidências e pendências da fase |
| [../evidence/f1-optimized-final/BASELINE.md](../evidence/f1-optimized-final/BASELINE.md) | F1 | Benchmark otimizado de 36 mil registros após o recálculo incremental |

## Convenções de status

- **Atual:** existe no código ativo e foi localizado na revisão.
- **Parcial:** existe uma fundação, mas o fluxo não está completo.
- **Planejado:** aprovado para o roadmap, ainda sem implementação.
- **Opcional:** somente entra após decisão expressa e análise de custo.
- **Fora de escopo:** não deve ser implementado sem nova decisão arquitetural.

## Regra de manutenção

Toda mudança relevante deve atualizar, no mesmo trabalho:

1. o documento de domínio ou integração afetado;
2. o roadmap e seus critérios de aceite;
3. o registro de decisões, quando houver mudança de direção;
4. os testes automatizados correspondentes;
5. a documentação do usuário, quando o comportamento ficar disponível.

---

<!-- docs/arquitetura-produto/00-VISAO-E-PRINCIPIOS.md -->

# 00 — Visão e princípios do produto

## 1. Problema central

O trabalho de pesagem acontece em ambiente com pressão de tempo, ruído, poeira,
conexão instável e animais em movimento. Um sistema correto para esse ambiente
não pode depender de múltiplas telas, consultas demoradas ou confirmação manual
de cada detalhe.

O sistema deve registrar rapidamente o fato ocorrido no curral e, ao mesmo
tempo, impedir que velocidade produza dados incorretos. Seu valor não termina no
peso: ele precisa transformar o histórico em decisão de lote, apartação,
desempenho e resultado comercial.

## 2. Usuários principais

| Perfil | Necessidade principal |
|---|---|
| Operador de curral | Identificar, pesar, apartar e seguir para o próximo animal sem demora |
| Gerente da fazenda | Conferir a sessão, corrigir pendências e acompanhar lotes |
| Proprietário/gestor | Ver desempenho, projeções e resultado econômico |
| Administrativo | Organizar compradores, embarques, GTA, NF-e e exportações |
| Consultor/auditor | Consultar histórico e evidência sem alterar fatos |
| Administrador do sistema | Configurar dispositivos, usuários, backup e integrações |

## 3. Proposta de valor

O sistema deve entregar:

- lançamento rápido e previsível;
- operação integral sem internet;
- histórico individual confiável;
- identificação por múltiplos códigos;
- ganho e GMD recalculáveis com consistência cronológica;
- apartação automática explicável;
- fechamento de sessão com pendências explícitas;
- relatórios que permitem abrir a lista de origem de cada número;
- integração desacoplada com balanças, leitores e serviços;
- preparação para uso por várias fazendas e vários usuários.

## 4. Princípios obrigatórios

### 4.1 Offline primeiro

A ação do operador é confirmada somente depois de persistida localmente. A futura
base online será uma réplica sincronizada, não uma dependência para salvar.

### 4.2 Evento histórico não é cadastro atual

Sexo, raça, marca, situação e lote atual pertencem ao cadastro/projeção do
animal. Peso, data, origem, destino e decisão tomada pertencem ao evento de
pesagem/movimentação. Alterar o cadastro atual não pode falsificar o fato
histórico.

### 4.3 Identidade não depende de texto exibido

Todo animal possui UUID interno estável. Número visual, marca, RFID e SISBOV são
identificadores vinculados ao UUID. O mesmo número visual pode existir em marcas
diferentes; um RFID ou número SISBOV ativo não pode pertencer simultaneamente a
dois animais.

### 4.4 Cálculo precisa ser explicável

GMD, carcaça, arrobas, valor, previsão e apartação devem informar dados de
entrada, fórmula, data de cálculo e regra aplicada. Nenhuma decisão automática
pode ser uma caixa-preta.

### 4.5 Relatório deve permitir conferência

Todo total deve oferecer drill-down até os registros que o formaram. Exportação
deve manter filtros, unidade, data de emissão e responsável.

### 4.6 Correção deixa rastro

Edição e cancelamento exigem auditoria. Eventos relevantes usam exclusão lógica
ou revisão; não desaparecem silenciosamente.

### 4.7 Integração é adaptador, não dependência do domínio

Balanças, RFID, nuvem, SISBOV e arquivos entram por contratos versionados. Uma
falha externa não pode corromper nem paralisar o banco local.

### 4.8 Desempenho é requisito funcional

Trocar da identificação para o peso, salvar e preparar o próximo animal deve ser
imediato no volume homologado. Recalcular toda a base a cada tecla é considerado
defeito funcional.

### 4.9 Interface densa, consistente e orientada ao teclado

O ModeloBase1 permanece como contrato visual. Campos, pop-ups, tabelas, hover,
tipografia e modo escuro usam os mesmos componentes. O fluxo principal deve ser
operável sem mouse.

### 4.10 Escopo controlado

Reprodução, nutrição, lavoura, máquinas, contabilidade geral e sanidade não entram
automaticamente. Sanidade permanece explicitamente fora do produto atual por
decisão do responsável. Uma eventual retomada exigirá módulo separado e nova
decisão.

## 5. Indicadores de sucesso do produto

As metas numéricas serão calibradas em hardware real, mas a arquitetura adota os
seguintes indicadores:

| Indicador | Objetivo inicial |
|---|---|
| Tempo de resposta da busca indexada | p95 menor que 100 ms em base homologada |
| Troca identificação → peso | sem bloqueio perceptível da interface |
| Salvamento local | p95 menor que 250 ms |
| Duplicidade na mesma sessão | detectada antes de novo salvamento |
| Operação sem internet | 100% do lançamento e fechamento local disponíveis |
| Perda de registros após falha | zero em testes de encerramento controlado |
| Total sem origem conferível | zero nos relatórios oficiais |
| Alteração crítica sem auditoria | zero |
| Integração indisponível | fluxo manual continua funcionando |

## 6. Limites do produto

O sistema fornece gestão e evidência operacional; ele não substitui:

- aferição ou certificação metrológica da balança;
- documentos fiscais oficiais;
- emissão oficial de GTA;
- certificadora SISBOV;
- decisão veterinária;
- contabilidade legal.


---

<!-- docs/arquitetura-produto/01-ESTADO-ATUAL-E-LACUNAS.md -->

# 01 — Estado atual e mapa de lacunas

## 1. Base analisada

- Aplicação: Pesagens Individuais 1.1.17
- Shell: Electron 35
- Interface: React 18 + Vite + Radix/Tailwind
- Persistência ativa: IndexedDB com Dexie, esquema versão 6
- Distribuição atual: NSIS x64
- Funcionamento: local/offline

Documentos antigos que descrevem JSON ou SQLite são históricos. Não devem ser
usados como representação do runtime atual.

## 2. Capacidades atuais confirmadas

| Capacidade | Estado | Observação |
|---|---|---|
| Banco local versionado | Atual | Dexie/IndexedDB, esquema v6 |
| Pesagem individual | Atual | Cadastro, manejo e saída |
| Animal canônico | Atual | UUID e projeção de situação |
| Número + marca | Atual | Desambiguação de números repetidos |
| Identificadores do animal | Parcial | Estrutura existe; falta UI completa para RFID/SISBOV |
| Histórico de peso | Atual | Peso anterior, ganho, dias e GMD |
| Recálculo retroativo | Atual | Série recomposta após alterações |
| Histórico de lote | Atual | Intervalos de permanência reconstruídos |
| Sessão de pesagem | Parcial | Entidade e vínculo existem; falta experiência de abrir/fechar sessão |
| Auditoria | Parcial | Persistência existe; falta consulta administrativa completa |
| Apartações e lotes | Atual | Capacidade e faixa de peso |
| Motor de regras | Parcial | Regra básica de lote; falta composição, prioridade e explicação |
| Compra, venda e abate | Atual | Dados e cálculos comerciais básicos |
| Embarque e documentos | Atual | Cadastros e vínculos locais |
| Importação | Atual | Controle transacional e hash |
| Exportação | Atual | CSV/JSON e relatórios operacionais pontuais |
| Backup/restauração | Atual | Integridade SHA-256 e confirmação segura |
| Verificação de integridade | Atual | Referências e identificadores |
| Relatórios analíticos | Parcial | Resumos existem; falta catálogo formal e drill-down uniforme |
| Integração com balança | Planejado | Nenhum driver ativo |
| RFID/EID | Planejado | Modelo de identificadores ajuda, mas falta adaptador |
| Login e permissões | Planejado | Ainda não implementado |
| Base online/sincronização | Planejado | Deve preservar o offline-first |
| SISBOV/GTA/NF-e oficial | Opcional | Depende de acesso, homologação e regras externas |
| Sanidade | Fora de escopo | Removida do esquema v6 por decisão expressa |

## 3. Forças que devem ser preservadas

1. funcionamento local sem servidor;
2. identidade animal separada dos lançamentos;
3. transações e recálculo do histórico;
4. exclusão lógica e auditoria;
5. importação idempotente por arquivo;
6. backup verificável;
7. formatação brasileira;
8. separação entre peso vivo, carcaça, arrobas e valor;
9. ModeloBase1 como contrato visual;
10. suíte automatizada existente.

## 4. Lacunas de maior impacto

### L1 — Sessão não é o centro da operação

Embora o banco tenha `sessoesPesagem`, a interface ainda trabalha
principalmente como lançamento de registros do dia. Falta ciclo explícito:
rascunho → aberta → em conferência → encerrada → reaberta sob auditoria.

### L2 — Equipamento ainda exige operação manual

Sem adaptador para balança e leitor, peso e identificação dependem de digitação
ou importação. Isso limita velocidade e aumenta risco de erro.

### L3 — Apartação ainda é pouco expressiva

Faixa de peso e capacidade são um começo. O produto precisa combinar critérios,
prioridades, exceções, simulação e registro da decisão manual.

### L4 — Informação não está organizada como catálogo de relatórios

Existem resumos, mas ainda não há contrato único de métricas, filtros,
agrupamentos, exportação e rastreabilidade de cada indicador.

### L5 — Economia está concentrada na saída

Há cálculo comercial de venda/abate, mas falta custo por kg ganho, custo por
arroba produzida, margem por animal/lote e ponto de equilíbrio.

### L6 — Preparação online ainda incompleta

UUID e timestamps ajudam, porém serão necessários versão do registro, dispositivo,
usuário, fila de operações, idempotência e política de conflitos.

### L7 — Páginas centrais ainda são grandes

As duas páginas principais concentram apresentação, estado e orquestração. A
evolução deve extrair casos de uso e seletores sem alterar o comportamento de uma
só vez.

## 5. Matriz de oportunidade contra o mercado pesquisado

| Tema | Mercado observado | Nosso estado | Direção |
|---|---|---|---|
| Pesagem rápida offline | Comum nos produtos de curral | Atual, mas aprimorável | Modo Curral 2.0 |
| Sessões formais | Forte em Datamars/Gallagher | Parcial | Tornar agregado central |
| Metas e previsão | Forte em Gallagher/Datamars | Ausente | Criar metas e projeção |
| Apartação multi-regra | Forte em equipamentos avançados | Parcial | Motor explicável |
| RFID/balança | Diferencial recorrente | Ausente | Adaptadores plugáveis |
| Análise por grupo | Comum | Parcial | Catálogo de relatórios |
| Exceções/baixo desempenho | Comum | Parcial | Central de alertas |
| Comercial por arroba | Presente em produtos brasileiros | Parcial | Rentabilidade completa |
| Rastreabilidade oficial | Presente em soluções especializadas | Ausente | Preparar, integrar depois |
| Offline + nuvem | Padrão emergente | Somente offline | Sincronização posterior |

## 6. Dívida documental identificada

- `README.md` da raiz ainda não descreve o produto atual.
- Auditorias antigas entram em conflito com o esquema v6.
- Não havia índice arquitetural permanente.
- Não havia catálogo formal de cadastros.
- Não havia catálogo formal de relatórios.
- Não havia contratos para hardware e sincronização.
- Não havia ADR registrando sanidade como fora de escopo.

Este pacote corrige a lacuna documental. A atualização do README da raiz deve ser
feita quando a equipe decidir promover esta arquitetura a plano de implementação
ativo.


---

<!-- docs/arquitetura-produto/02-ARQUITETURA-DE-DOMINIO.md -->

# 02 — Arquitetura de domínio e dados

## 1. Estilo arquitetural

A evolução seguirá um **monólito modular offline-first**. Não serão criados
microserviços antes de existir uma necessidade operacional comprovada.

```text
Interface React
    ↓ comandos / consultas
Camada de aplicação (casos de uso)
    ↓
Domínio (regras, cálculos e políticas)
    ↓ portas
Infraestrutura local (Dexie)
    ├─ adaptadores de balança/RFID
    ├─ importação/exportação
    └─ futura fila de sincronização
```

Regras de negócio não devem depender de React, Electron, Dexie ou de uma marca
de equipamento.

## 2. Contextos de domínio

| Contexto | Responsabilidade | Entidades principais |
|---|---|---|
| Organização | Separar empresa, fazenda, curral e usuários | Empresa, Fazenda, Curral, Usuário, Papel |
| Rebanho | Identidade e situação atual | Animal, Identificador, Raça, Marca, Categoria |
| Pesagem | Capturar o fato e calcular desempenho | Sessão, Pesagem, Leitura, Pendência |
| Lotação | Localização e agrupamento temporal | Lote, Apartação, Permanência, Movimento |
| Regras | Recomendar destinos e detectar exceções | Perfil de Regra, Regra, Resultado |
| Comercial | Compra, venda, abate e resultado | Operação Comercial, Parte, Composição de Custo |
| Embarque | Conferência e documentação da saída | Embarque, Documento, Item de Embarque |
| Analytics | Métricas, projeções e relatórios | Definição de Métrica, Meta, Snapshot |
| Integrações | Traduzir protocolos externos | Dispositivo, Conexão, Importação, Job |
| Plataforma | Segurança, sincronização e manutenção | Auditoria, Outbox, Conflito, Backup |

Sanidade não faz parte dos contextos ativos.

## 3. Modelo conceitual

```text
Empresa 1──N Fazenda 1──N Curral
                    └──N Lote

Animal 1──N Identificador
Animal 1──N Pesagem N──1 Sessão de Pesagem
Animal 1──N Permanência em Lote N──1 Lote
Animal 1──N Movimento

Sessão 1──N Leitura de Equipamento
Sessão 1──N Pendência
Sessão 1──N Resultado de Apartação

Apartação 1──N Regras
Resultado de Apartação N──1 Regra aplicada

Operação Comercial 1──N Animais/Pesagens
Embarque 1──N Documento
Embarque 1──N Itens

Toda alteração relevante 1──N Auditoria
Toda mutação sincronizável 1──1 Evento Outbox
```

## 4. Entidades e invariantes

### 4.1 Animal

Campos mínimos planejados:

- `id` UUID imutável;
- `empresa_id` e `fazenda_id`;
- `situacao`: ativo, vendido, abatido, transferido, morto, cancelado;
- `sexo`, `raca_id`, `marca_id`, `categoria_id`;
- nascimento/data estimada ou era calculável;
- lote atual como projeção, nunca como única fonte histórica;
- origem e observações;
- `created_at`, `updated_at`, `deleted_at`, `version`.

Invariantes:

- todo lançamento pertence a um animal, salvo rascunho/pendência explícita;
- uma saída definitiva impede eventos posteriores sem religamento auditado;
- alteração cadastral não reescreve silenciosamente o evento histórico;
- exclusão de cadastro com histórico exige plano de cancelamento em cascata e
  confirmação explícita.

### 4.2 Identificador animal

Tipos planejados: visual, RFID/EID, SISBOV, manejo SISBOV, legado e temporário.

Invariantes:

- valor normalizado por tipo;
- somente um vínculo ativo por identificador globalmente único;
- número visual pode se repetir quando a política permitir desambiguação por
  marca;
- troca de identificador mantém validade temporal e histórico;
- identificador SISBOV não é reutilizado.

### 4.3 Sessão de pesagem

É o agregado operacional central.

Campos:

- `id`, empresa, fazenda, curral, operador e dispositivo;
- nome, data operacional, início e término;
- tipo de manejo, lote de origem e perfil de apartação;
- modo de captura: manual, serial, Bluetooth, arquivo ou simulado;
- status: rascunho, aberta, conferência, encerrada, cancelada;
- contadores projetados e observações;
- versão e auditoria.

Transições:

```text
RASCUNHO → ABERTA → CONFERÊNCIA → ENCERRADA
                ↘ CANCELADA
ENCERRADA → REABERTA (somente permissão especial + motivo)
```

Uma sessão não pode encerrar com pendência crítica. Pendência de atenção pode ser
aceita com justificativa conforme política.

### 4.4 Pesagem

É um fato histórico, não o cadastro do animal.

Campos essenciais:

- `id`, `animal_id`, `sessao_id`;
- data/hora operacional e instante de captura;
- peso em kg armazenado como número, sem unidade no valor;
- origem da captura e dispositivo;
- peso anterior elegível;
- ganho, dias e GMD derivados/versionados;
- lote/apartação de origem e destino;
- observação, operador e estado de sincronização;
- auditoria e cancelamento lógico.

Invariantes:

- peso deve ser finito e maior que zero;
- data civil deve ser válida;
- eventos anteriores ao cadastro ou posteriores à saída são rejeitados;
- duplicidade por animal/sessão segue política configurada;
- cálculo retroativo recompõe a série posterior de forma transacional;
- valores derivados podem ser reconstruídos a partir dos fatos.

### 4.5 Leitura de equipamento

Guarda evidência técnica opcional:

- peso bruto e peso normalizado;
- unidade recebida;
- estabilidade;
- sequência da leitura;
- instante do equipamento e do computador;
- protocolo, porta e dispositivo;
- leitura descartada, capturada ou associada a uma pesagem.

Não é necessário conservar indefinidamente toda oscilação. A política de retenção
deve manter, pelo menos, leituras capturadas e amostras necessárias para auditoria
ou diagnóstico.

### 4.6 Lote, apartação e permanência

Lote representa agrupamento/localização; apartação representa intenção/regra de
separação. A permanência registra intervalo temporal do animal no lote.

Invariantes:

- um animal não possui duas permanências abertas incompatíveis na mesma fazenda;
- transferência fecha origem e abre destino na mesma transação;
- lote fechado não recebe novos animais sem reabertura;
- capacidade excedida gera conflito, não ajuste silencioso.

### 4.7 Regra de apartação

Composição:

- escopo e período de validade;
- prioridade;
- condições agrupadas com `E`/`OU`;
- destino;
- ação quando faltar identificação ou dado;
- capacidade e política de excedente;
- versão publicada.

Operadores mínimos:

- igual/diferente;
- contém/não contém;
- maior/menor/entre;
- pertence/não pertence;
- vazio/não vazio;
- dias desde evento;
- comparação com meta, média do lote ou último valor.

O resultado armazena regra, versão, entradas usadas, destino sugerido, decisão
final e eventual justificativa de substituição.

### 4.8 Operação comercial

Compra, venda e abate compartilham base comum, mas não são o mesmo fato.

Campos:

- tipo, contraparte, destino e data;
- animais envolvidos;
- peso vivo total;
- rendimento informado/estimado;
- carcaça e arrobas;
- preço, receita, frete, comissão, descontos e outros ajustes;
- documentos;
- status: rascunho, conferida, fechada, cancelada.

O sistema deve distinguir valor informado de valor calculado.

## 5. Fórmulas canônicas

### Ganho de peso

```text
ganho_kg = peso_atual_kg - peso_anterior_kg
```

### Dias entre pesagens

Diferença de datas civis, sem sofrer alteração por fuso horário.

### Ganho médio diário

```text
gmd_kg_dia = ganho_kg / dias
```

Somente quando `dias > 0`. Pesagem no mesmo dia não produz GMD.

### Carcaça estimada

```text
carcaca_kg = peso_vivo_kg × rendimento_percentual / 100
```

### Arrobas de carcaça

```text
arrobas = carcaca_kg / 15
```

### Valor estimado

```text
valor_estimado = arrobas × preco_por_arroba
```

### Previsão de meta simples

```text
kg_faltantes = meta_kg - peso_atual_kg
dias_estimados = kg_faltantes / gmd_elegivel
```

Não calcular quando GMD for nulo, zero, negativo ou não confiável. A versão
futura pode usar regressão robusta, mas deve continuar mostrando a metodologia.

## 6. Fatos, projeções e derivados

| Tipo | Exemplos | Política |
|---|---|---|
| Fato | pesagem, movimento, saída | imutável ou cancelável com auditoria |
| Cadastro | animal, lote, comprador | editável e versionado |
| Projeção | situação atual, lote atual | reconstruível dos fatos |
| Derivado | ganho, GMD, arrobas | fórmula e versão conhecidas |
| Snapshot | fechamento de sessão | congelado para conferência, regenerável com versão |

## 7. Serviços de aplicação planejados

- `OpenWeighingSession`
- `IdentifyAnimal`
- `CaptureStableWeight`
- `CreateWeighing`
- `RecalculateAnimalSeries`
- `EvaluateDraftingRules`
- `ResolveWeighingPendingIssue`
- `CloseWeighingSession`
- `TransferAnimalLot`
- `CloseCommercialOperation`
- `GenerateOperationalReport`
- `ImportWeighingSession`
- `QueueSyncOperation`

Cada caso de uso recebe comandos simples, executa regra de domínio, persiste em
transação e devolve DTO próprio para a interface.

## 8. Estratégia de evolução do esquema

- toda alteração incrementa `DB_VERSION`;
- migrações são determinísticas e testadas com base vazia e base volumosa;
- nenhuma store é removida sem decisão registrada;
- antes de transformação destrutiva, produzir backup validado;
- campos novos aceitam registros antigos e possuem backfill explícito;
- projeções podem ser reconstruídas; fatos não são recriados por adivinhação;
- o contrato futuro online usa os mesmos UUIDs locais.

---

<!-- docs/arquitetura-produto/03-CADASTROS-E-FLUXOS.md -->

# 03 — Catálogo de cadastros e fluxos

## 1. Regra de desenho

Cadastro existe para reutilizar informação e aplicar regras; não para aumentar a
quantidade de telas. Listas pequenas e estáveis podem ser configurações. Entidades
com histórico, vínculo ou permissão precisam de cadastro próprio.

Todos os cadastros usam o contrato visual ModeloBase1: listagem, filtros,
configuração de colunas, formulário/popup, validação, auditoria, modo escuro e
comportamento de fechamento padronizados.

## 2. Cadastros fundamentais

| Cadastro | Fase | Campos essenciais | Regras principais |
|---|---|---|---|
| Empresa | Online | razão social, nome, documento, fuso, locale | identidade legal; isolamento de dados |
| Fazenda | Online | nome, propriedade, município/UF, código | pertence a uma empresa |
| Curral/local de pesagem | Modo Curral | nome, fazenda, observação | usado em sessões |
| Operador | Modo Curral | nome, código, ativo | local antes do login completo |
| Usuário | Online | identidade, status, autenticação | nunca armazenar senha em texto puro |
| Papel/permissão | Online | capacidades por módulo | menor privilégio |

## 3. Cadastros do rebanho

### 3.1 Animal

Campos recomendados:

- número/nome visual;
- marca;
- RFID/EID;
- número SISBOV e número de manejo, se usados;
- sexo;
- raça;
- categoria;
- nascimento conhecido ou estimado;
- origem;
- fazenda e lote atual;
- situação;
- observações;
- outros identificadores com validade temporal.

O formulário deve verificar duplicidade enquanto o usuário digita, mas a decisão
de abrir a seleção de animais com mesmo número acontece ao sair do campo ou ao
confirmar a identificação, evitando pop-up prematuro.

### 3.2 Marcas, raças e categorias

Devem possuir nome, abreviação, ativo e ordem de uso. Valores usados no histórico
não são apagados fisicamente. Categoria pode ser calculada ou definida; a origem
do valor precisa ser visível.

### 3.3 Identificadores

Tela de manutenção por animal com:

- tipo;
- valor original e normalizado;
- data de início e fim;
- principal/secundário;
- motivo de troca;
- usuário responsável.

## 4. Cadastros de lote e apartação

### 4.1 Lote

- nome e código curto;
- fazenda/local;
- capacidade;
- peso mínimo/máximo desejado;
- categoria/objetivo;
- data de abertura/fechamento;
- situação;
- meta de peso e data-alvo opcionais.

### 4.2 Apartação

- nome e cor operacional;
- destinos possíveis;
- perfil de regra ativo;
- política para lotes cheios;
- política para dado ausente;
- validade.

### 4.3 Perfil de regras

Deve permitir salvar modelos reutilizáveis, por exemplo:

- classificação em três faixas de peso;
- venda por peso e sexo;
- revisão de baixo GMD;
- transferência por capacidade;
- conferência de animal sem RFID.

Antes de publicar, o usuário executa uma simulação contra uma lista e vê quantos
animais cairiam em cada destino.

## 5. Cadastros comerciais e documentais

| Cadastro | Informações |
|---|---|
| Pessoas/empresas | vendedor, comprador, frigorífico, transportador; documento, contatos e endereço |
| Comprador | condições comerciais, destinos usuais, observações |
| Frigorífico | unidade, município/UF, rendimento padrão opcional |
| Transportador/motorista | documento, contato, placas e veículos |
| Tipo de documento | GTA, NF-e e documentos internos |
| Perfil de compra | origem, custos padrão e campos obrigatórios |
| Perfil de venda/abate | destino, rendimento, preços e campos obrigatórios |
| Embarque | data, destino, capacidade, veículo, motorista, documentos e status |

Dados bancários, fiscais sensíveis ou emissão fiscal não devem ser adicionados sem
análise própria de segurança e conformidade.

## 6. Cadastros operacionais de equipamento

### 6.1 Dispositivo

- tipo: balança, indicador ou leitor RFID;
- fabricante e modelo;
- número de série;
- fazenda/local;
- transporte: serial, USB, Bluetooth, rede ou arquivo;
- protocolo e versão;
- ativo;
- data da última comunicação.

### 6.2 Perfil de conexão

- porta/serviço;
- baud rate, paridade, bits e terminador quando serial;
- unidade recebida;
- expressão/parser do frame;
- intervalo e tolerância de estabilidade;
- modo de captura;
- timeout;
- política de reconexão.

Segredos de rede ou tokens não ficam expostos na UI nem em backup comum.

## 7. Configurações controladas

- unidades e formatação regional;
- faixas aceitáveis de peso/GMD;
- política de duplicidade;
- campos obrigatórios por tipo de manejo;
- atalhos de teclado;
- som e feedback operacional;
- tamanho de página e densidade visual;
- colunas/filtros salvos;
- modelos de exportação;
- política de backup;
- retenção de leitura bruta;
- metas e critérios de confiança.

Configurações críticas são versionadas e auditadas.

## 8. Fluxo — abrir sessão de curral

1. escolher empresa/fazenda/curral;
2. informar operador e data operacional;
3. escolher tipo de manejo;
4. selecionar lote de origem, se aplicável;
5. escolher perfil de apartação;
6. conectar ou selecionar equipamento;
7. executar teste de leitura;
8. abrir a sessão;
9. focar automaticamente na identificação.

Critério: uma sessão aberta deve poder ser recuperada depois de fechar ou reiniciar
o aplicativo.

## 9. Fluxo — processar animal

1. receber/digitar identificador;
2. resolver animal único ou solicitar desambiguação;
3. mostrar informação essencial e alertas;
4. receber peso manual/automático;
5. validar estabilidade, cronologia, duplicidade e outlier;
6. calcular ganho/GMD e meta;
7. avaliar apartação;
8. operador confirma ou substitui com motivo;
9. persistir fato, projeções, auditoria e outbox na mesma transação;
10. feedback visual/sonoro;
11. limpar somente os campos transitórios e preparar o próximo animal.

## 10. Fluxo — animal desconhecido ou ambíguo

### Desconhecido

- oferecer cadastro rápido;
- ou criar pendência sem inventar um animal;
- cadastro rápido exige os mínimos definidos para o tipo de manejo;
- “SN” usa o último perfil explicitamente aceito, mas exige confirmação dos dados.

### Mesmo número em várias marcas

- abrir seleção somente após conclusão da identificação;
- mostrar marca, sexo, raça, lote, situação e última pesagem;
- seleção por teclado;
- lembrar apenas dentro da operação atual quando seguro;
- nunca escolher silenciosamente por ordem da lista.

## 11. Fluxo — conferência e fechamento

1. pausar novas capturas;
2. recalcular estatísticas da sessão;
3. listar erros e pendências;
4. reconciliar contagem por lote/destino;
5. resolver ou justificar exceções permitidas;
6. gerar snapshot do fechamento;
7. encerrar sessão;
8. disponibilizar relatório, exportação e romaneio;
9. disparar backup e futura sincronização.

## 12. Fluxo — compra

- cadastrar/selecionar origem e vendedor;
- informar custos e documentos;
- registrar animais e peso de entrada;
- criar cadastro quando necessário;
- definir lote inicial;
- guardar custo individual alocado e custo não alocado;
- fechar somente após conferência de quantidade e valores.

## 13. Fluxo — venda, abate e transferência

- selecionar animais elegíveis;
- impedir animal já inativo;
- calcular peso vivo e, se aplicável, carcaça/arrobas;
- vincular destino, embarque e documentos;
- comparar previsto e realizado;
- registrar saída e fechar permanência em lote;
- permitir cancelamento somente com auditoria e recomposição das projeções.

## 14. Fora de escopo deste catálogo

- sanidade e medicamentos;
- reprodução e genealogia avançada;
- dieta, cocho e confinamento completo;
- folha de pagamento;
- gestão de máquinas;
- emissão fiscal própria;
- diagnóstico veterinário automatizado.


---

<!-- docs/arquitetura-produto/04-RELATORIOS-E-INDICADORES.md -->

# 04 — Arquitetura de relatórios e indicadores

## 1. Princípios

Todo relatório deve declarar:

- objetivo e público;
- período e data operacional;
- população incluída e excluída;
- filtros aplicados;
- unidade de cada métrica;
- fórmula e versão;
- data/hora de emissão;
- usuário emissor;
- possibilidade de abrir os registros de origem;
- exportação consistente com a tela.

Um painel é uma visão navegável. Um relatório oficial é um resultado reproduzível,
com parâmetros e versão. Um snapshot de fechamento não muda silenciosamente
depois da emissão.

## 2. Dimensões padronizadas

- empresa, fazenda e curral;
- sessão e operador;
- animal e identificadores;
- lote, apartação e permanência;
- sexo, raça, categoria, marca e origem;
- tipo de manejo e situação;
- data, semana, mês, trimestre e safra configurável;
- comprador, frigorífico, destino e embarque;
- dispositivo e método de captura;
- qualidade/estado do registro.

## 3. Métricas canônicas

| Métrica | Definição |
|---|---|
| Animais únicos | quantidade distinta de `animal_id` no escopo |
| Pesagens | quantidade de fatos de pesagem válidos |
| Peso total | soma dos pesos em kg |
| Peso médio | peso total / pesagens elegíveis |
| Ganho total | soma dos ganhos elegíveis |
| Ganho médio | média dos ganhos elegíveis, sem converter nulo em zero |
| GMD médio simples | média dos GMDs elegíveis |
| GMD ponderado | soma dos ganhos / soma dos dias elegíveis, quando metodologicamente aplicável |
| Dias médios | média dos intervalos elegíveis |
| Arrobas estimadas | carcaça estimada / 15 |
| Lotação atual | animais com permanência aberta no lote |
| Produtividade da sessão | registros concluídos / duração efetiva em horas |
| Taxa de pendência | pendências / animais processados |
| Taxa de captura automática | pesos automáticos / pesos totais |

O relatório deve diferenciar GMD médio simples de GMD ponderado. Não apresentar
valor quando a população não for elegível.

## 4. Catálogo de relatórios operacionais

### REP-001 — Fechamento da sessão de pesagem

**Objetivo:** conferir o trabalho realizado antes de encerrar.

Conteúdo:

- início, término, duração e pausas;
- operador, curral e dispositivo;
- animais processados e pesagens válidas;
- produtividade por hora;
- peso mínimo, máximo, médio e total;
- ganho e GMD;
- distribuição por destino/lote;
- desconhecidos, duplicados, outliers e pendências;
- substituições manuais de apartação;
- integridade do fechamento.

Drill-down obrigatório para cada grupo. Fase: Modo Curral.

### REP-002 — Relação operacional da sessão

Uma linha por animal processado, com sequência, hora, identificadores, peso,
histórico anterior, ganho, GMD, origem, destino, regra, alertas e estado.

Fase: Modo Curral.

### REP-003 — Pendências e exceções

Agrupa:

- animal não resolvido;
- identificador duplicado;
- pesagem repetida;
- peso/GMD fora da faixa;
- data incompatível;
- destino sem capacidade;
- documento ausente;
- falha de dispositivo;
- conflito de sincronização futuro.

Deve permitir atribuir responsável, resolver, justificar e auditar. Fase: Modo
Curral.

### REP-004 — Produtividade do curral

- animais por hora;
- tempo médio e percentis por animal;
- pausas;
- falhas por equipamento;
- capturas manuais versus automáticas;
- comparação por operador, sessão e dispositivo.

Fase: Integração de equipamentos.

## 5. Catálogo de relatórios zootécnicos de peso

### REP-101 — Histórico individual do animal

- cadastro e identificadores atuais/históricos;
- linha do tempo de pesagens e movimentos;
- peso, ganho, dias e GMD em cada intervalo;
- lote em cada período;
- gráfico da evolução;
- metas e previsão;
- operações de compra/saída;
- auditoria associada.

Fase: Relatórios 1.

### REP-102 — Desempenho do lote

- inventário inicial e atual;
- entradas e saídas;
- peso e GMD médio;
- mediana, mínimo, máximo e dispersão;
- distribuição por faixa;
- animais acima/abaixo da meta;
- melhores e piores desempenhos;
- comparação com período anterior;
- custo e valor estimado quando disponíveis.

Fase: Relatórios 1; economia na fase Comercial.

### REP-103 — Ranking e exceções de desempenho

Filtros por lote/período e listas de:

- maior e menor GMD;
- perda de peso;
- sem pesagem recente;
- peso parado;
- previsão atrasada;
- fora da curva do grupo.

Cada exceção deve abrir a lista, não apenas mostrar um cartão. Fase: Relatórios 1.

### REP-104 — Evolução por grupo/coorte

Comparar lote, marca, raça, sexo, categoria ou origem ao longo do tempo. Para
evitar comparação enganosa, exibir tamanho da amostra e política de inclusão.

Fase: Relatórios 2.

### REP-105 — Metas e projeções

- peso atual e meta;
- kg restantes;
- GMD usado;
- dias e data estimados;
- nível de confiança;
- animais que atingirão a meta no prazo;
- simulação por GMD desejado.

Projeção é estimativa, nunca fato. Fase: Relatórios 2.

### REP-106 — Pesagens vencidas

Animais sem nova pesagem após intervalo configurável, agrupados por lote e
prioridade. Fase: Relatórios 1.

## 6. Relatórios de lote e apartação

### REP-201 — Inventário atual por lote

- capacidade, ocupação e percentual;
- animais atuais;
- peso total/médio;
- faixas de peso;
- entradas/saídas recentes;
- metas;
- inconsistências de permanência.

Fase: Relatórios 1.

### REP-202 — Movimentação entre lotes

Livro cronológico de origem, destino, motivo, sessão, operador e animais.
Suporta conciliação de saldo inicial + entradas − saídas = saldo final.

Fase: Relatórios 1.

### REP-203 — Resultado da apartação

- perfil e versão das regras;
- quantidades e peso por destino;
- capacidade prevista/real;
- animais sem destino;
- conflitos;
- sugestões substituídas manualmente.

Fase: Motor de apartação.

### REP-204 — Simulação de apartação

Executa regras sem alterar dados. Compara cenário atual e proposto, inclusive
reprocessamento com limites diferentes. Fase: Motor de apartação.

## 7. Relatórios comerciais

### REP-301 — Desempenho da compra

- animais, peso e valor de entrada;
- frete e custos adicionais;
- custo médio por cabeça/kg;
- situação atual;
- ganho desde a compra;
- valor estimado e margem, quando configurados.

Fase: Comercial.

### REP-302 — Resultado de venda

- animais vendidos;
- peso vivo;
- carcaça estimada/real claramente separada;
- rendimento;
- arrobas;
- preço por arroba ou cabeça;
- receita bruta, descontos, frete, comissão e receita líquida;
- margem por animal e lote, quando custos existirem.

Fase: Comercial.

### REP-303 — Resultado de abate

Além do conteúdo de venda, deve permitir importar retorno real do frigorífico:
peso de carcaça, rendimento, classificação, preço e descontos. Comparar estimado
versus realizado. Fase: Comercial 2.

### REP-304 — Custo do ganho

- custo total elegível;
- kg ganhos;
- custo por kg ganho;
- arrobas produzidas;
- custo por arroba produzida;
- ponto de equilíbrio;
- margem estimada/real.

Não implementar antes de definir origem e rateio dos custos. Fase: Comercial 2.

### REP-305 — Posição estimada do rebanho

Valor indicativo por lote/animal com preço e data da referência. Deve carregar a
expressão “estimado” e jamais ser tratado como contabilidade oficial.

Fase: Comercial 2.

## 8. Relatórios de embarque e documentação

### REP-401 — Romaneio de embarque

- empresa/fazenda;
- comprador/destino;
- motorista, veículo e placas;
- GTA/NF-e e demais referências;
- animais, sexo, marca, lote e peso;
- totais, médias e observações;
- responsável, emissão e código de verificação.

Saídas: PDF, impressão, XLSX/CSV e JSON de integração. Fase: Embarque.

### REP-402 — Conciliação de embarque

Compara quantidade/peso previstos e realizados, documentos, animais duplicados,
ausentes ou inelegíveis. Fase: Embarque.

### REP-403 — Livro de saídas

Venda, abate, transferência e outras baixas por período, com situação e motivo de
cancelamento. Fase: Embarque.

## 9. Relatórios de governança e qualidade

### REP-501 — Trilha de auditoria

Filtros por usuário, entidade, ação, data e sessão. Exibe antes/depois de forma
legível e exportável. Campos sensíveis são mascarados conforme permissão.

### REP-502 — Integridade e qualidade dos dados

- referências órfãs;
- identificadores conflitantes;
- animais sem cadastro completo;
- séries cronológicas inválidas;
- projeções divergentes;
- campos legados;
- duplicidades e documentos inconsistentes.

### REP-503 — Backup e recuperação

Último backup, tamanho, checksum, destino, resultado de verificação e testes de
restauração.

### REP-504 — Sincronização

Operações pendentes, falhas, conflitos, última sincronização por dispositivo e
volume enviado/recebido. Somente na fase online.

## 10. Painel inicial

O painel deve usar apenas métricas do catálogo:

- animais ativos;
- lotação por lote;
- sessões abertas;
- pesagens recentes;
- animais sem pesagem no prazo;
- GMD e tendência;
- animais perdendo peso;
- próximos da meta;
- pendências;
- embarques em preparação;
- último backup e sincronização.

Não criar cartão sem ação. Clicar deve abrir o relatório/lista filtrada.

## 11. Filtros e comparação

Todos os relatórios devem usar o mesmo motor de filtros das tabelas:

- condições por tipo de dado;
- múltiplas condições;
- período relativo e absoluto;
- filtros salvos;
- compartilhamento futuro por usuário/equipe;
- comparação com período anterior ou grupo de referência;
- indicação visível de filtros ativos.

## 12. Exportação

| Formato | Uso |
|---|---|
| PDF | relatório fechado, romaneio e impressão |
| XLSX | análise administrativa preservando tipos e abas |
| CSV UTF-8 | interoperabilidade e grandes volumes |
| JSON versionado | backup e integração máquina a máquina |

Toda exportação inclui manifesto: versão do relatório, filtros, fuso, locale,
gerador e checksum quando aplicável.

## 13. Critérios de aceite para qualquer relatório

- total confere com consulta de origem;
- nulos não viram zero indevidamente;
- datas e números seguem pt-BR na apresentação;
- valores exportados continuam numéricos;
- mesma população na tela e arquivo;
- teste com zero, um e muitos registros;
- teste com cancelados e retroativos;
- desempenho homologado;
- permissão aplicada;
- fórmula documentada e testada.


---

<!-- docs/arquitetura-produto/05-INTEGRACOES-E-EQUIPAMENTOS.md -->

# 05 — Arquitetura de integrações e equipamentos

## 1. Estratégia

O domínio não conhece fabricantes. Cada integração implementa uma porta estável,
possui versão, simulador e capacidade declarada. O fluxo manual permanece
disponível quando hardware ou rede falhar.

```text
Domínio de pesagem
        ↓
WeighingDevicePort / AnimalIdReaderPort / ExternalServicePort
        ↓
Adaptador específico
        ↓
Serial | USB | Bluetooth | TCP | Arquivo | API
```

## 2. Contrato de balança

Interface conceitual:

```text
connect(profile)
disconnect()
getStatus()
subscribeReadings(handler)
requestStableWeight()
zero()       [se suportado]
tare()       [se suportado]
diagnostics()
```

Leitura normalizada:

```json
{
  "deviceId": "uuid",
  "sequence": 1234,
  "capturedAt": "2026-09-08T13:40:25.123-04:00",
  "rawFrame": "opcional/mascarado",
  "rawWeight": 451.8,
  "unit": "kg",
  "weightKg": 451.8,
  "stable": true,
  "quality": "valid",
  "protocolVersion": "1"
}
```

Requisitos:

- normalizar unidade para kg;
- nunca inferir estabilidade apenas por aparência da tela;
- suportar configuração do fabricante;
- rejeitar frame incompleto com diagnóstico;
- lidar com reconexão sem duplicar captura;
- manter contador/ID da leitura;
- não bloquear a thread da interface;
- permitir simulador determinístico para testes.

## 3. Política de estabilidade

Quando o protocolo não informar estabilidade, o perfil pode aplicar janela:

- número mínimo de amostras;
- duração mínima;
- variação máxima em kg;
- faixa aceitável;
- timeout;
- tempo morto após salvar para impedir recaptura do mesmo animal.

Essa política é configuração do dispositivo e sua versão deve ficar ligada à
pesagem capturada.

Produtos Tru-Test trabalham com sessão e captura após estabilização do peso; a
documentação também descreve apartação automática quando o peso fica estável.
Referências: [captura de peso no computador](https://support.livestock.datamars.com/en/articles/9949505-recording-weights-from-the-s2-or-s3-indicator-using-your-windows-computer)
e [apartação por peso](https://support.livestock.datamars.com/en/articles/9949540-drafting-sorting-by-weight-using-a-5000-indicator).

## 4. Contrato de leitor RFID/EID

```text
connect(profile)
disconnect()
subscribeIdentifiers(handler)
triggerScan()        [se suportado]
setFeedback(result)  [se suportado]
diagnostics()
```

Evento normalizado:

```json
{
  "deviceId": "uuid",
  "capturedAt": "2026-09-08T13:40:22.000-04:00",
  "type": "EID",
  "value": "valor-original",
  "normalizedValue": "valor-normalizado",
  "quality": "valid"
}
```

Regras:

- uma leitura abre o animal sem simular digitação de teclado internamente;
- repetição em janela curta é debounced;
- animal já processado na sessão gera alerta específico;
- desconhecido segue para cadastro rápido ou pendência;
- conflito nunca escolhe um animal arbitrariamente.

## 5. Matriz de capacidades do dispositivo

Cada adaptador declara:

| Capacidade | Exemplo |
|---|---|
| leitura contínua | sim/não |
| indicador de estabilidade | nativo/calculado/ausente |
| zero/tara remotos | sim/não |
| identificação EID | sim/não |
| escrita de sessão | sim/não |
| apartação/saídas físicas | quantidade e protocolo |
| transporte | serial/USB/Bluetooth/TCP |
| plataformas | Windows/Android/etc. |

Não prometer compatibilidade apenas porque o conector físico encaixa. Cada modelo
deve passar por homologação.

## 6. Processo de homologação de hardware

1. registrar fabricante, modelo e firmware;
2. obter manual/protocolo autorizado;
3. capturar amostras sem dados sensíveis;
4. implementar parser e simulador;
5. testar desconexão, ruído, frame parcial e reconexão;
6. testar peso estável/instável, zero e limites;
7. validar com equipamento real;
8. registrar matriz de capacidades;
9. publicar adaptador como experimental;
10. promover a homologado após sessão real conferida.

## 7. Importação e exportação por arquivo

Importação de sessão deve aceitar inicialmente CSV UTF-8 e JSON versionado;
XLSX pode ser adicionado no fluxo administrativo.

Contrato de entrada:

- mapeamento explícito de colunas;
- pelo menos um identificador do animal;
- peso e data/hora;
- preview/dry-run;
- erros por linha;
- normalização pt-BR configurável;
- hash do arquivo;
- transação única ou lotes com checkpoint explícito;
- relatório final de inseridos, atualizados, ignorados e rejeitados.

A Datamars usa arquivos de sessão associados por VID/EID/LID e exige cabeçalhos e
datas consistentes; essa experiência reforça a necessidade de um assistente de
mapeamento e validação antes da aplicação. [Importação Datamars](https://support.livestock.datamars.com/en/articles/14190116-uploading-files-from-a-pc-to-datamars-livestock)

## 8. Apartador físico

Integração futura e opcional:

- resultado de regra produz uma direção lógica;
- adaptador traduz para porta física;
- confirmar recebimento/estado da saída;
- falha deixa instrução visual e sonora disponível;
- nunca considerar movimentação concluída apenas porque o comando foi enviado;
- guardar decisão lógica e confirmação física separadamente.

## 9. Serviços oficiais e documentais

### SISBOV

Preparar o modelo para número SISBOV, ERAS, propriedades, eventos, movimentação e
GTA. A integração oficial não é um endpoint público genérico para qualquer app:
depende de credenciamento, papéis e homologação aplicáveis. O sistema deve operar
sem essa integração.

Fontes: [SISBOV — MAPA](https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/cgtqa/dpc/sisbov)
e [API SISBOV 2.0](https://manual-api-treinamento-sisbov.agricultura.gov.br/).

### GTA

No curto prazo, guardar referência e anexos/metadados. Emissão ou consulta oficial
depende do serviço estadual/federal e de autorização. Não automatizar navegador
como substituto de API oficial.

### NF-e

No curto prazo, referência de chave/número e importação controlada de retorno.
Emissão fiscal exige projeto separado: certificado, regras tributárias, segurança
e contingência.

## 10. API futura do produto

Quando houver servidor, expor API versionada para:

- autenticação e organizações;
- animais/identificadores;
- sessões e pesagens;
- lotes/movimentos;
- apartações/regras;
- operações comerciais/embarques;
- relatórios assíncronos;
- sincronização por lote;
- webhooks assinados.

Padrões:

- UUID como chave externa;
- idempotency key em mutações;
- paginação por cursor;
- timestamps ISO 8601 com offset;
- data operacional civil separada do instante;
- erro estruturado e código estável;
- limite e retry documentados;
- OpenAPI versionada.

## 11. Observabilidade de integração

Cada integração registra:

- início/fim e duração;
- dispositivo/serviço e versão;
- volume recebido/enviado;
- sucesso, retry, falha e motivo;
- correlação com sessão;
- dados brutos somente quando necessários e sob retenção;
- ação recomendada ao operador.

Logs nunca contêm senha, token, chave privada ou documento completo sem
necessidade.

## 12. Ordem recomendada de integrações

1. simulador de balança;
2. primeiro modelo real de balança;
3. leitor RFID em modo teclado/serial controlado;
4. importação de sessões de equipamento;
5. outros fabricantes por adaptador;
6. apartador físico;
7. nuvem do próprio produto;
8. serviços oficiais mediante acesso/homologação.


---

<!-- docs/arquitetura-produto/06-OFFLINE-SINCRONIZACAO-E-SEGURANCA.md -->

# 06 — Offline, sincronização, login e segurança

## 1. Decisão central

Login e base online serão adicionados sem retirar a autonomia local. O servidor
não participa do caminho crítico entre clicar em Salvar e receber a confirmação
do lançamento.

```text
UI → caso de uso → transação local
                    ├─ fato/projeções/auditoria
                    └─ evento na outbox
                              ↓ quando possível
                         sincronizador
                              ↓
                            API
```

## 2. Estados de sincronização

- `local_only`: criado antes de uma conta/base online existir;
- `pending`: aguardando envio;
- `syncing`: tentativa em andamento;
- `synced`: confirmado pelo servidor;
- `retry`: falha transitória;
- `conflict`: requer política ou decisão;
- `rejected`: servidor rejeitou por regra não transitória.

O estado de sincronização não altera a validade local do fato, mas pode impedir o
fechamento corporativo até a reconciliação.

## 3. Outbox transacional

Toda mutação sincronizável grava, na mesma transação:

- ID da operação;
- entidade e ID;
- ação;
- versão anterior/nova;
- payload mínimo;
- usuário/dispositivo;
- instante e data operacional;
- chave de idempotência;
- dependências;
- número de tentativas e último erro.

Se a gravação do fato ocorrer e a outbox falhar, a transação inteira falha. Isso
evita dado local que nunca possa ser sincronizado.

## 4. Recebimento e idempotência

O servidor mantém a chave de idempotência e devolve a mesma resposta quando uma
operação já confirmada for reenviada. Retries usam backoff com jitter e não
dependem de o aplicativo permanecer aberto continuamente.

Ordem de dependência:

```text
Empresa/Fazenda → Cadastros → Animal → Sessão → Pesagem/Movimento → Fechamento
```

Operações independentes podem ser agrupadas; dependências não são enviadas fora
de ordem.

## 5. Política de conflitos

| Tipo | Política inicial |
|---|---|
| Dois cadastros editados | comparação de versão + resolução de campos |
| Mesmo identificador em animais distintos | conflito crítico, nunca mesclar automaticamente |
| Nova pesagem em dois dispositivos | manter fatos distintos; detectar duplicidade de negócio |
| Alteração de pesagem já editada | revisão manual com antes/depois |
| Lote atual divergente | reconstruir de movimentos após reconciliar eventos |
| Configuração | última versão publicada; rascunhos permanecem locais |
| Exclusão versus nova operação | conflito crítico e auditoria |

“Última gravação vence” não será regra global, porque pode perder fatos do
curral.

## 6. Multiempresa e isolamento

Toda entidade de negócio carrega `tenant_id`/empresa e, quando aplicável,
`fazenda_id`. A API deriva o tenant da autorização, não aceita que o cliente
escolha livremente outro tenant.

Controles:

- isolamento em consultas e comandos;
- índices compostos por tenant;
- armazenamento local separado ou logicamente particionado;
- backup identificado por empresa/fazenda;
- testes automatizados de acesso cruzado;
- exportação sujeita a permissão.

## 7. Login

### Desktop offline

Depois do primeiro login online bem-sucedido, o aplicativo pode emitir uma sessão
offline local protegida, com prazo e políticas definidas. Senha nunca é armazenada
localmente em texto puro.

Requisitos:

- autenticação moderna via provedor próprio/OIDC;
- tokens no armazenamento seguro do sistema operacional;
- refresh token rotacionado;
- bloqueio local configurável;
- recuperação administrada;
- revogação de dispositivo na próxima conexão;
- modo de contingência documentado.

### Papéis iniciais

- administrador;
- gerente;
- operador;
- administrativo/comercial;
- consulta;
- auditor.

Permissão é capacidade, por exemplo `weighing.create`, `session.close`,
`weighing.correct`, `commercial.view_values`, `audit.read`.

## 8. Identidade de dispositivo

Cada instalação recebe UUID e chave local protegida. O servidor mantém:

- nome amigável;
- empresa/fazenda permitida;
- último acesso;
- versão do app;
- estado ativo/revogado;
- posição da sincronização.

O ID do dispositivo participa da auditoria, mas não substitui o usuário.

## 9. Proteção de dados

- TLS em trânsito;
- criptografia gerenciada no servidor;
- segredos fora do repositório;
- princípio do menor privilégio;
- logs sem credenciais;
- anexos com URL temporária;
- backups com controle de acesso e retenção;
- política de exportação;
- exclusão/anonimização somente conforme requisitos legais e históricos.

Criptografia integral do banco local é uma decisão separada: IndexedDB do
Chromium não oferece automaticamente um cofre de domínio. Se necessária, avaliar
ameaça, desempenho, recuperação de chave e migração antes de prometer.

## 10. Auditoria

Registrar:

- login, logout e falhas relevantes;
- criação, edição, cancelamento e reabertura;
- importação/exportação;
- mudança de regra/configuração;
- fechamento de sessão/operação;
- resolução de conflito;
- concessão de permissão;
- backup/restauração;
- integração externa.

Auditoria é append-only do ponto de vista da aplicação. A visualização deve
mascarar dados conforme permissão.

## 11. Backup no modelo híbrido

Mesmo com nuvem, continuar oferecendo backup local verificável. A nuvem não
substitui restauração testada.

Camadas:

1. transação e recuperação do IndexedDB;
2. backup local automático/manual;
3. sincronização com servidor;
4. backup do servidor;
5. teste periódico de restauração.

## 12. Atualização do aplicativo

Antes de ativar atualização automática:

- assinatura Authenticode confiável;
- canal estável/beta;
- manifesto assinado;
- verificação de versão e checksum;
- migração do banco testada;
- rollback de binário compatível com esquema;
- preservação do banco local;
- bloqueio de downgrade perigoso.

## 13. Critérios de aceite da sincronização

- criar 10.000 operações offline e sincronizar sem perda/duplicidade;
- interromper rede em cada etapa e retomar;
- reenviar lote já confirmado sem duplicar;
- dois dispositivos editarem o mesmo cadastro e gerar conflito controlado;
- duas pesagens legítimas não serem apagadas por merge;
- revogar dispositivo;
- impedir acesso entre empresas;
- reinstalar app preservando dados e retomando fila;
- restaurar backup e reconciliar posição de sync;
- observabilidade suficiente para suporte sem expor segredos.

## 14. LGPD e governança

O produto trata principalmente dados operacionais e de pessoas relacionadas à
empresa, transporte e usuários. Antes da nuvem:

- mapear finalidade e base legal;
- definir controlador/operador;
- minimizar dados pessoais;
- política de retenção;
- canal de atendimento;
- contrato com provedores;
- resposta a incidente;
- registro de exportação e acesso.

Este documento define arquitetura, não substitui avaliação jurídica.


---

<!-- docs/arquitetura-produto/07-ROADMAP-E-CRITERIOS-DE-ACEITE.md -->

# 07 — Roadmap e critérios de aceite

## 1. Estratégia de entrega

Cada fase será dividida em slices verticais pequenos, preservando dados e
mantendo o sistema utilizável. Nenhuma fase mistura uma grande migração de banco,
redesign completo e integração física no mesmo corte.

## 2. Ordem das fases

```text
F0 Contratos e baseline
 → F1 Desempenho e confiabilidade do fluxo atual
 → F2 Modo Curral e sessões
 → F3 Relatórios operacionais/zootécnicos
 → F4 Apartação avançada
 → F5 Equipamentos e RFID
 → F6 Comercial e embarque avançados
 → F7 Login, multiempresa e sincronização
 → F8 Integrações oficiais/opcionais
```

## 3. F0 — Contratos e baseline

Entregas:

- aprovar este pacote documental;
- mapear campos atuais para o modelo-alvo;
- catalogar fórmulas existentes;
- gerar massa de teste anônima: vazia, pequena, 36 mil e 250 mil pesagens;
- medir p50/p95/p99 de busca, troca de campo e salvamento;
- registrar capturas visuais das telas atuais;
- definir marcas/modelos de equipamentos prioritários.

Aceite:

- nenhuma ambiguidade de identidade, fórmula ou escopo P0;
- baseline reproduzível em desenvolvimento e pacote instalado;
- decisão explícita sobre hardware inicial.

## 4. F1 — Desempenho e confiabilidade

Entregas:

- índice/cache de animais ativos;
- busca sem percorrer todo histórico;
- seletores memoizados;
- atualização incremental de resumos;
- paginação/virtualização conforme medição;
- desambiguação somente ao concluir identificação;
- prevenção de duplo salvamento;
- centralização das validações restantes.

Aceite:

- p95 da busca indexada menor que 100 ms na massa homologada;
- Tab da identificação ao peso sem travamento perceptível;
- salvamento local p95 menor que 250 ms;
- resultados de GMD e histórico iguais antes/depois;
- testes de regressão e UI aprovados.

## 5. F2 — Modo Curral

Slices:

1. ciclo de vida da sessão;
2. recuperação de sessão aberta;
3. lançamento vinculado à sessão;
4. atalhos e foco;
5. duplicidade e pendências;
6. fechamento e snapshot;
7. relatório REP-001/002/003.

Aceite:

- sessão recuperável após reiniciar;
- nenhuma pesagem operacional sem sessão, salvo importação/legado marcado;
- duplicidade detectada antes da persistência;
- encerramento bloqueia pendência crítica;
- reabertura exige permissão/motivo;
- fechamento confere com registros de origem.

## 6. F3 — Relatórios

Primeiro pacote:

- histórico individual;
- desempenho e inventário de lote;
- ranking/exceções;
- pesagens vencidas;
- movimentação entre lotes;
- auditoria e qualidade de dados;
- painel inicial navegável.

Aceite:

- métricas canônicas testadas;
- drill-down de todos os totais;
- PDF/XLSX ou CSV conforme contrato;
- mesma população na tela e exportação;
- desempenho aceitável na massa grande.

## 7. F4 — Apartação avançada

Slices:

- modelo versionado de regras;
- editor com `E`/`OU` e validação;
- motor puro e testável;
- prioridade e conflito;
- capacidade;
- explicação da decisão;
- simulação/what-if;
- substituição manual auditada;
- REP-203/204.

Aceite:

- regras determinísticas;
- mesma entrada + versão produz mesmo resultado;
- ausência de dado segue política;
- simulação não altera dados;
- 100% das substituições guardam motivo.

## 8. F5 — Equipamentos e RFID

Slices:

1. portas e simuladores;
2. diagnóstico de conexão;
3. primeiro adaptador de balança;
4. captura estável;
5. primeiro leitor RFID;
6. correlação ID/peso;
7. reconexão e fallback manual;
8. produtividade e logs.

Aceite:

- matriz de capacidades por modelo;
- testes de frame parcial, ruído e desconexão;
- nenhuma captura duplicada após reconectar;
- peso manual continua disponível;
- sessão real confrontada com relatório físico;
- adaptador experimental não aparece como homologado.

## 9. F6 — Comercial e embarque

Primeiro pacote:

- pessoas/empresas e destinos;
- operação comercial versionada;
- custos e descontos;
- romaneio;
- conciliação previsto/realizado;
- retorno de frigorífico;
- relatórios REP-301 a REP-305 e REP-401 a REP-403.

Aceite:

- peso vivo/carcaça/arrobas separados;
- valor informado versus calculado identificado;
- total de animais reconciliado;
- cancelamento recompõe situação com auditoria;
- rateio de custos documentado antes de exibir margem.

## 10. F7 — Login e sincronização

Slices:

- tenant/empresa/fazenda;
- identidade de usuário/dispositivo;
- papéis e permissões;
- outbox local;
- API idempotente;
- sincronização incremental;
- conflitos;
- painel de status;
- backup servidor e recuperação.

Aceite: cumprir integralmente a seção de testes do documento 06, homologar
isolamento multiempresa e manter todo o fluxo de curral offline.

## 11. F8 — Integrações oficiais

Somente após autorização e acesso:

- SISBOV/certificadoras;
- serviços GTA disponíveis;
- importação/retorno de NF-e;
- outros fabricantes e nuvens de equipamentos;
- webhooks/integrações de parceiros.

Cada integração possui projeto, homologação e fallback próprios.

## 12. Backlog priorizado inicial

| ID | Item | Fase | Dependência |
|---|---|---|---|
| PERF-001 | Medir busca e Tab em base grande | F0 | nenhuma |
| PERF-002 | Índice/cache de animais ativos | F1 | PERF-001 |
| SES-001 | Abrir/recuperar sessão | F2 | F1 |
| SES-002 | Fechar/reabrir com auditoria | F2 | SES-001 |
| QLT-001 | Pendências e severidade | F2 | SES-001 |
| REP-001 | Fechamento de sessão | F2 | SES-002 |
| REP-101 | Histórico individual | F3 | métricas canônicas |
| REP-102 | Desempenho do lote | F3 | REP-101 |
| DRF-001 | Motor de regra puro | F4 | domínio aprovado |
| DRF-002 | Simulador de apartação | F4 | DRF-001 |
| DEV-001 | Simulador de balança | F5 | contrato de dispositivo |
| DEV-002 | Primeiro adaptador real | F5 | modelo escolhido |
| EID-001 | Leitor/identificador eletrônico | F5 | modelo escolhido |
| COM-001 | Custos e operação comercial | F6 | regra de rateio |
| SHP-001 | Romaneio/conciliação | F6 | cadastros documentais |
| IAM-001 | Login/papéis | F7 | arquitetura servidor |
| SYNC-001 | Outbox + API idempotente | F7 | IAM-001 |

## 13. Definition of Done

Uma entrega somente está pronta quando:

- regra e UX aprovadas;
- migração de dados testada, quando houver;
- código com lint/build/testes aprovados;
- testes de unidade, integração e regressão proporcionais ao risco;
- teste visual claro/escuro e escalas Windows;
- desempenho comparado ao baseline;
- auditoria e permissão verificadas;
- documentação arquitetural e do usuário atualizadas;
- pacote instalado testado, quando afetar runtime;
- evidências registradas;
- sem reintroduzir domínio fora de escopo.

## 14. Gates de release

### Gate técnico

- suíte completa;
- integridade do banco;
- build e smoke do Electron;
- migração e backup;
- verificação do pacote.

### Gate operacional

- roteiro real de cadastro/manejo/saída;
- base volumosa;
- recuperação após encerramento;
- conferência de cálculos;
- aceite humano da UI.

### Gate de distribuição

- versão e notas;
- instalador único atual;
- checksum/manifesto;
- máquina limpa;
- assinatura quando disponível;
- atualização preservando dados.

## 15. Itens que exigem decisão do responsável

- primeiro fabricante/modelo de balança;
- primeiro leitor RFID;
- necessidade real de SISBOV;
- metodologia e fontes de custo;
- PDF/XLSX prioritários;
- estrutura empresa/fazenda/curral;
- política de sessão offline para usuários;
- provedor online e autenticação;
- se haverá publicação Microsoft Store.


---

<!-- docs/arquitetura-produto/08-DECISOES-ARQUITETURAIS.md -->

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


---

<!-- docs/arquitetura-produto/09-PESQUISA-E-REFERENCIAS.md -->

# 09 — Pesquisa e referências

## 1. Escopo da pesquisa

Benchmark funcional realizado em 08/09/2026. Foram usadas páginas oficiais de
produtos e documentação de fabricantes para identificar padrões de mercado. As
afirmações comerciais não foram tratadas como validação independente de qualidade.

## 2. Sistemas e aprendizados

### JetBov

- pesagem rápida;
- offline;
- Bluetooth e equipamentos;
- cadastro no curral;
- múltiplos manejos;
- histórico e GMD.

Fonte: [Novo JetBov de Curral](https://jetbov.com/novo-app-de-curral/)

### iRancho

- operação online/offline;
- coleta centralizada;
- pesagem, apartação e outros manejos na mesma atividade;
- foco em produtividade de curral.

Fonte: [iRancho](https://www.irancho.com.br/)

### Datamars/Tru-Test

- sessões de pesagem;
- VID/EID/LID;
- peso estável;
- desempenho por animal, grupo e sessão;
- metas e animais perdendo peso;
- apartação por peso/GMD e múltiplos critérios;
- transferência com dispositivos e nuvem;
- importação de arquivos de sessão.

Fontes:

- [Uso com indicadores e leitores](https://support.livestock.datamars.com/en/articles/12874640-using-datamars-livestock-with-weigh-scale-indicators-and-eid-readers)
- [Captura no Windows](https://support.livestock.datamars.com/en/articles/9949505-recording-weights-from-the-s2-or-s3-indicator-using-your-windows-computer)
- [Apartação por peso](https://support.livestock.datamars.com/en/articles/9949540-drafting-sorting-by-weight-using-a-5000-indicator)
- [Informação de sessões anteriores](https://support.livestock.datamars.com/en/articles/15593157-using-previous-session-information-on-an-xr5000-indicator)
- [Importação de sessão](https://support.livestock.datamars.com/en/articles/14190116-uploading-files-from-a-pc-to-datamars-livestock)
- [Walk Over Weighing](https://support.livestock.datamars.com/en/articles/9918979-what-is-walk-over-weighing-wow)

### Gallagher Animal Performance

- metas e previsão de peso;
- comparação de grupos;
- filtros e cálculos personalizados;
- listas de apartação;
- integração Bluetooth com barras/balanças compatíveis.

Fonte: [Animal Performance Plus](https://am.gallagher.com/en-US/Products/Animal-Performance-Plus)

### CattleMax

- cadastro individual;
- inventário e medições;
- histórico e GMD derivado de pesos de desmama;
- visão integrada do animal.

Fonte: [CattleMax Cow-Calf](https://www.cattlemax.com/cow-calf)

### Curral Tech

- offline-first;
- sincronização ao recuperar conexão;
- RFID;
- histórico e gráficos;
- romaneio e baixa automática.

Fontes: [produto](https://curraltech.com/) e
[arquitetura operacional declarada](https://curraltech.com/sobre/)

### Prozear

- pesagem, apartação e embarque offline;
- GMD e custo por arroba;
- NF-e, GTA e SISBOV;
- módulos integrados da fazenda.

Fonte: [Prozear](https://iryon.com.br/prozear/)

### MecBov

- pesagens evolutivas;
- curva de ganho por lote;
- importação com conferência de brincos;
- apartação e transferências.

Fonte: [MecBov](https://www.mecsis.com.br/solucoes)

## 3. Referências oficiais brasileiras

- [SISBOV — Ministério da Agricultura e Pecuária](https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/cgtqa/dpc/sisbov)
- [Instrução Normativa MAPA nº 51/2018](https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/transito-animal/cgtqa-legis/in-mapa-no-51-1-10-2018.pdf)
- [Guia da API SISBOV 2.0](https://manual-api-treinamento-sisbov.agricultura.gov.br/solucoes/guia/)
- [Visão geral da API SISBOV 2.0](https://manual-api-treinamento-sisbov.agricultura.gov.br/)

## 4. Conclusões usadas na arquitetura

1. sessão é unidade operacional comum em sistemas de pesagem avançados;
2. histórico anterior precisa aparecer durante a decisão atual;
3. metas e exceções são mais úteis que somente médias gerais;
4. integração exige modelo/firmware e capability matrix;
5. apartação pode ocorrer automaticamente ao estabilizar peso, mas precisa de
   política para identificação ausente;
6. grupo, sessão e animal são eixos complementares de análise;
7. importação precisa resolver identificadores e estrutura das colunas;
8. offline com sincronização posterior é requisito de campo;
9. rastreabilidade oficial usa identidade individual e eventos;
10. integração SISBOV não deve ser prometida sem acesso/homologação.

## 5. Próxima rodada de pesquisa

Depois de escolher o primeiro hardware:

- manual técnico e protocolo do fabricante;
- disponibilidade de SDK/API;
- unidade, frame e sinal de estabilidade;
- requisitos Windows e drivers;
- modelos de RFID suportados;
- teste físico e contrato de homologação.

Depois de definir o módulo comercial:

- metodologia de custo e rateio adotada pelo responsável;
- retorno real de frigoríficos utilizados;
- formatos de romaneio exigidos;
- integrações fiscais/documentais efetivamente disponíveis.


---

<!-- docs/arquitetura-produto/10-MODELO-PRODUTO-2.0.md -->

# 10 — Modelo do produto (visão de execução) — Programa 1.1.17 → 1.6.0

**Programa Master de Evolução · iniciado em 14/09/2026 (refina o "Programa 2.0" do mesmo dia) · base 1.1.17 / Dexie v6.**
Estado real de partida: `docs/evidence/STATE-OF-REPO-BEFORE.md`. Entrada oficial: Auditoria Master
(`docs/evidence/auditoria-master-produto-pecuario/`). Este documento resume o que o produto final é, a ordem de
construção e a divisão de trabalho; os contratos detalhados estão nos documentos 11 (autenticação), 12 (dados),
13 (versionamento/release) e 14 (migrações). Os documentos 00–09 continuam válidos; onde houver diferença, as
ADR-018…048 prevalecem.

## 1. Cadeia do domínio

```text
CADASTROS → ANIMAIS → IDENTIFICADORES → LOTAÇÃO/LOTES → SESSÃO → PESAGEM/MANEJO
         → OPERAÇÕES COMERCIAIS → EMBARQUE → SAÍDA → FECHAMENTO → HISTÓRICO/RELATÓRIOS
```

Regra: cadastros são feitos antes; o lançamento seleciona; o curral pesa; o escritório configura e confere.

## 2. O que o produto final é e não é

É: offline-first, desktop Electron, IndexedDB/Dexie, login local com usuários e quatro papéis (ADMIN, GESTOR,
OPERADOR, CONSULTA), cadastros mestres como stores, identidade permanente do animal, estoque de identificadores
por faixas, pesagem rápida por sessão, animais com ficha, apartações/lotes, compras/vendas/abates como operações,
embarques com estados, fechamento de sessão, relatórios operacionais básicos (tabela + CSV/JSON com manifesto),
backup/restauração, auditoria por usuário, versionamento em quatro eixos, migrações com backup físico prévio,
UI ModeloBase1, instalador versionado e gates automatizados.

Não é: ERP financeiro, CRM, WMS, fiscal, veterinário, nem dependente de internet.

## 3. Menu final

```text
OPERAÇÃO   Lançamento de pesagens · Relação de pesagens · Fechamento da sessão
REBANHO    Animais · Apartações e lotes · Faixas de identificadores
COMERCIAL  Operações · Embarques
CADASTROS  Marcas · Raças · Categorias · Parceiros · Propriedades · Causas de morte
SISTEMA    Usuários · Configurações · Backup e manutenção · Auditoria · Sobre/Versão (pode ficar em Manutenção)
```

Removidos: Sanidade, Cadastros Comerciais legado, popups de cadastro que viraram telas. Itens respeitam a matriz
do documento 11 §4. Topbar: usuário e papel discretos, versão, Bloquear, Trocar usuário, Sair, tema.

## 4. Marcos (ADR-047)

| Marco | Fatias | Escopo | Gate de saída |
|---|---|---|---|
| 1.1.18 | S-00.0 baseline recovery · S-00.1 contrato de versão, ADRs, docs de engenharia | gates verdes no contrato 1.1.17, `versionInfo`, manifesto, `release:version-contract`, Sobre/Status; **sem esquema novo** | `test:quick` verde, lint, build, notas, CHANGELOG |
| 1.2.0 | S-01.1 v7 + preflight/backfill · S-01.2 auth · S-01.3 serviços de cadastro · S-01.4 telas · S-01.5 Lançamento seleciona cadastros | documentos 11, 12, 14 | + `migration:v7`, `auth:*`, `registry:master`, `payload:allowlist`, restore v6→v7, `test:full` (físicos declarados) |
| 1.3.0 | S-02.1 faixas/exceções · S-02.2 animalIdentifierService · S-02.3 resolução indexada · S-02.4 tela Faixas | identificadores e desempenho | + `identifier:inventory`, `identifier:uniqueness`, `perf:contract` (Chromium: abrir Lançamento < 1 s em 36 mil) |
| 1.4.0 | S-03.x lançamento enxuto, Apartações/Lotes, contexto de sessão | Manejo = Nº → Enter → Peso → Enter | + `launch:contract`; aceite humano de 50 animais só com evidência |
| 1.5.0 | S-04.1 v8 · S-04.2 comercial · S-04.3 embarques · S-04.4 UI · S-04.5 relatórios | operações e embarques separados do curral | + `migration:v8`, `commercial:operations`, `shipment:state`, `reports:manifest` |
| 1.6.0 | S-05.1 sessão · S-05.2 fechamento · S-05.3 Animais · S-05.4 auditoria | sessão fechada bloqueia; ficha por projeções; auditoria consultável | + `session:closing`, `audit:actor`; `test:full`; 36k/250k; backup v6→v8; máquina limpa declarada |

## 5. Divisão de trabalho (ADR-040/048)

| Agente | Área | Arquivos que pode editar |
|---|---|---|
| A orquestrador/integrador | programa, branch de integração, conflitos, CHANGELOG, aceite | `docs/arquitetura-produto/**`, `CHANGELOG.md`, `package.json`, `vite.config.js`, `src/pages.config.js`, `src/Layout.jsx`, `src/App.jsx`, `src/storage/indexedDb/schema.js`, `src/styles/d17b-modelobase1.css`, `scripts/verify-ui-consistency.mjs` |
| B revisor de arquitetura/governança | read-only: ADRs, SSOT, escopo, dependências, riscos | nenhum |
| C storage/migrações | Dexie v7/v8, preflight, backfill, backup, restore, integridade | `src/storage/**` (exceto `schema.js`), `src/api/db.js`, `scripts/verify-dexie-*.mjs`, `scripts/verify-v7-migration.mjs`, `scripts/verify-payload-allowlist.mjs` |
| D auth/versionamento | login, usuários, papéis, sessão, recovery, `versionInfo`, manifesto | `src/modules/auth/**`, `src/components/auth/**`, `src/pages/Usuarios.jsx`, `src/versioning/**`, `scripts/verify-auth-*.mjs`, `scripts/verify-version-contract.mjs`, `scripts/generate-release-manifest.mjs` |
| E domínio/cadastros | marcas, raças, categorias, parceiros, causas, propriedades, identificadores | `src/modules/catalog/**`, `src/modules/identifiers/**`, `src/modules/animals/**`, `scripts/verify-master-registry.mjs`, `scripts/verify-identifier-*.mjs` |
| F UX/ModeloBase1 | telas, menu, lançamento, fluxo de curral, teclado | `src/components/cadastros/**`, `src/components/mak/**`, `src/components/modelobase1/**`, páginas em `src/pages/**` (exceto as de outros donos) |
| G QA/gates | scripts de verificação, massas, regressão, performance, evidências | `src/modules/perf/**`, `scripts/measure-*.mjs`, gates novos quando não pertencem a outro dono |
| H release/docs | docs do usuário, notas, instalação, hashes, compatibilidade | `docs/user/**`, `docs/release/**`, `docs/engineering/**`, `scripts/verify-packaged-build.mjs`, `scripts/verify-user-docs.mjs` |

Agentes não executam `npm run build`, `test:quick` nem comandos git (o orquestrador executa); podem rodar
`npx eslint <arquivos>` e os próprios scripts de verificação. Escrita de código em uma fatia tem um único dono;
integração é sequencial; uma fatia só entra na linha de integração com gates verdes.

## 6. Definition of Done de uma fatia/marco

Código, migração, testes, gates, evidências (`docs/evidence/<slice>/`: REPORT, FILES-CHANGED, TESTS, MIGRATION,
PERF, SCREENSHOTS, RISKS, ROLLBACK), docs do usuário, versão, build, `app.asar`, instalador, checksum, manifesto
e checkpoint do orquestrador. Condições de parada: perda de dados, migração irreversível, backup inválido,
integridade vermelha, duplicação de animal/identificador, falha de restore, corrupção do IndexedDB. Teste físico
só é declarado EXECUTADO com evidência humana.

---

<!-- docs/arquitetura-produto/11-AUTENTICACAO-LOCAL.md -->

# 11 — Autenticação local, papéis e sessão (contrato de implementação)

**Programa 1.1.17 → 1.6.0 · ADR-041…ADR-046 (DEC-023…DEC-029) · revisão 2 (14/09/2026).**
Substitui a revisão 1 (três perfis, store `usuariosLocais`). Nada desta revisão depende de rede.

## 1. Princípios

- 100 % offline: sem servidor, Supabase, Firebase, OAuth, e-mail, SMS; a autenticação nunca impede o trabalho sem rede.
- Sem módulo nativo: Web Crypto (`crypto.subtle`), disponível no renderer e no Node dos gates.
- Senha, hash, salt, recovery key e tokens nunca vão para log, auditoria, CSV, diagnóstico ou `localStorage`.
- A UI esconde o que o papel não pode; o **serviço** autoriza (`authorize(action)`) antes de gravar.
- Threat model (docs/engineering/AUTH-THREAT-MODEL.md): controle e auditoria dentro do app; não protege contra quem tem acesso total ao perfil do SO e aos arquivos; sem criptografia total do banco.

## 2. Store `usuarios` (esquema v7)

Índices: `++localId, &id, empresa_id, &login_normalizado, role, ativo, created_at, updated_at, deleted_at` (hash e salt nunca indexados).

| Campo | Regra |
|---|---|
| `id`, `empresa_id='local'` | padrão |
| `nome`, `login`, `login_normalizado` | login normalizado = `trim` + minúsculas; único por empresa |
| `role` | `ADMIN` · `GESTOR` · `OPERADOR` · `CONSULTA` |
| `ativo` | inativo não entra; nunca apagar usuário referenciado em auditoria |
| `password_hash`, `password_salt` | base64; salt aleatório de 16 bytes por usuário |
| `password_algorithm` | `PBKDF2-SHA256` |
| `password_iterations` | valor persistido (padrão 310 000; centralizado em `passwordPolicy.js` e testado) |
| `password_version` | inteiro; permite recalibrar custo/algoritmo com rehash no próximo login |
| `must_change_password` | `true` após criação por ADMIN ou reset |
| `recovery_hash`, `recovery_salt` | só no ADMIN de bootstrap; verificador da Recovery Key |
| `failed_login_count`, `locked_until` | bloqueio temporário persistido (limite e duração em `auth-policy`) |
| `last_login_at` | atualizado no login |
| `created_at`, `updated_at`, `deleted_at` | padrão |

## 3. Módulo

```text
src/modules/auth/
  domain/passwordHasher.js      hashPassword(senha, { iterations?, salt? }) → { algorithm, salt, iterations, hash, version }; verifyPassword(senha, record); constantTimeEqual
  domain/passwordPolicy.js      PBKDF2_ITERATIONS, PASSWORD_VERSION, MIN_PASSWORD_LENGTH=6, TRIVIAL_PASSWORDS, validatePassword(senha, login)
  domain/recoveryKey.js         generateRecoveryKey() → texto legível (ex.: 5 grupos de 5), hashRecoveryKey, verifyRecoveryKey
  domain/permissionService.js   ROLES, ACTIONS, MATRIX, can(role, action), authorize(role, action) → lança AUTH_FORBIDDEN, listActions(role)
  application/authService.js    countActiveUsers, bootstrapFirstAdmin, authenticate, findActiveUser, createUser, updateUser, setActive, resetPassword, forcePasswordChange, changeOwnPassword, recoverAdminPassword, listUsers
  application/sessionService.js sessão em memória (+ sessionStorage para recarga técnica), inatividade, lock/unlock/logout/switchUser, subscribe; registra o provedor de ator
  application/auditContext.js   getActor() → { usuario_id, usuario_nome_snapshot } | nulos
  application/authAudit.js      registra LOGIN_SUCESSO, LOGOUT, BLOQUEIO, RESET_SENHA, ALTERACAO_USUARIO (resumidos, sem segredos)
src/components/auth/            AuthGate, FirstRunAdminSetupScreen (com exibição única da Recovery Key), LoginScreen, LockScreen, TrocarSenhaScreen, RecuperarSenhaScreen, RequirePermission, UserMenu, useAuth
src/pages/Usuarios.jsx          ação users.manage (ADMIN)
```

## 4. Matriz de permissões (`permissionService`)

| Ação | ADMIN | GESTOR | OPERADOR | CONSULTA |
|---|---|---|---|---|
| `launch.use` | ✔ | ✔ | ✔ | ✘ |
| `weighing.read` | ✔ | ✔ | ✔ | ✔ |
| `weighing.write` / `weighing.edit` | ✔ | ✔ | ✔ | ✘ |
| `animal.read` | ✔ | ✔ | ✔ | ✔ |
| `animal.write` (cadastro rápido) | ✔ | ✔ | ✔ | ✘ |
| `registry.read` | ✔ | ✔ | ✔ | ✔ |
| `registry.write` | ✔ | ✔ | ✘ | ✘ |
| `commercial.read` | ✔ | ✔ | ✘ | ✔ (sem valores) |
| `commercial.write` | ✔ | ✔ | ✘ | ✘ |
| `commercial.values` (ver preços) | ✔ | ✔ | ✘ | ✘ |
| `shipment.read` / `shipment.write` | ✔ / ✔ | ✔ / ✔ | ✔ / ✘ | ✔ / ✘ |
| `session.close` / `session.reopen` | ✔ | ✔ | ✘ | ✘ |
| `reports.read` | ✔ | ✔ | ✘ | ✔ |
| `maintenance.backup` | ✔ | ✔ | ✘ | ✘ |
| `maintenance.restore` / `maintenance.clear` / `maintenance.reset` / `maintenance.migrate` | ✔ | ✘ | ✘ | ✘ |
| `users.manage` | ✔ | ✘ | ✘ | ✘ |
| `settings.operational` | ✔ | ✔ | ✘ | ✘ |
| `settings.auth` / `settings.manage` | ✔ | ✘ | ✘ | ✘ |
| `audit.read` | ✔ | ✔ | ✘ | ✔ |

Regra: ações destrutivas/administrativas chamam `authorize` no serviço; `RequirePermission` na UI é conveniência.

## 5. Fluxo

```text
Splash/preflight de storage → (migração: backup físico → v7 → backfill → integridade)
  → usuarios.count === 0 ? FirstRunAdminSetup (nome, login, senha, confirmação → Recovery Key exibida uma vez)
  → Login (login + senha; Enter envia; erro genérico; falhas contam; bloqueio temporário; inativo não entra)
  → must_change_password ? TrocarSenha : App principal
Bloqueio por inatividade (padrão 30 min; 0 desliga) → LockScreen (senha do mesmo usuário) · Trocar usuário · Sair
Recuperação: Login › "Esqueci a senha do administrador" → Recovery Key → nova senha → nova key gerada e exibida
```

Nenhuma tela de dados é montada antes da autenticação. Restore, reset ou alteração do próprio usuário encerram a sessão. Fechar o app encerra a sessão.

## 6. Tela Sistema › Usuários (ModeloBase1)

Lista: Nome, Login, Papel, Ativo, Último acesso. Ações: Novo usuário, Editar (nome/papel/ativo), Redefinir senha (temporária + `must_change_password`), Forçar troca. Nunca mostrar hash/salt. Não desativar/remover o último ADMIN ativo. OPERADOR e CONSULTA não abrem a tela.

## 7. Auditoria por usuário

`auditoria`: `usuario_id`, `usuario_nome_snapshot`, `resumo`, `campos_alterados[]`. `sessoesPesagem.operador_usuario_id`. Eventos de acesso resumidos (`entidade='usuarios'`, `acao` ∈ {LOGIN_SUCESSO, LOGOUT, BLOQUEIO, RESET_SENHA, ALTERACAO_USUARIO}). Registros antigos: `usuario_id = null`.

## 8. Configuração `auth-policy:<empresa>` (appSettings, versionada)

`{ versao, inactivity_lock_minutes: 30, failed_attempt_limit: 5, lock_minutes: 0.5 }` — alterável só por `settings.auth` (ADMIN).

## 9. Backup e restauração

`usuarios` entra no backup (hash/salt, nunca senha nem sessão). Restore com usuários exige `maintenance.restore` e encerra a sessão. Backup formato 2 restaurado em v7 nasce sem usuários → FirstRunAdminSetup.

## 10. Gates

- `auth:crypto:verify` — hash/verify, salt aleatório, iterações ≥ política, comparação constante, `password_version`, senha errada não autentica.
- `auth:bootstrap:verify` — banco vazio abre bootstrap; cria ADMIN; recovery key exibida uma vez e só hash gravado; backup com usuários não faz bootstrap; `admin/admin` impossível.
- `auth:permissions:verify` — matriz completa (4 papéis × ações); `authorize` lança `AUTH_FORBIDDEN`; serviços críticos recusam ator sem permissão; OPERADOR/CONSULTA não abrem Usuários.
- `auth:recovery:verify` — key válida redefine e gera nova; key antiga invalidada; key inválida recusada e conta falha.
- `audit:actor:verify` — eventos gravam `usuario_id`/`usuario_nome_snapshot`; nenhum segredo na auditoria; login events resumidos.

---

<!-- docs/arquitetura-produto/12-MODELO-DADOS-V7-V8.md -->

# 12 — Modelo de dados v7 e v8 (contrato de implementação)

**Programa 1.1.17 → 1.6.0 · revisão 2 (14/09/2026) · dono do arquivo `schema.js`: orquestrador (ADR-040/048).**
Fonte: Auditoria Master (`DEXIE-V7-TARGET-MODEL.md` e modelos por domínio), ADR-018…ADR-034 e ADR-043/046.

## 1. Convenções

- Toda store: `++localId` (chave técnica), `id` UUID de domínio, `created_at`, `updated_at`, `deleted_at` (exclusão lógica), `empresa_id` (`'local'` até P-003).
- Cadastros mestres usam `&id` (único), `nome`, `nome_normalizado` (`trim` → maiúsculas pt-BR → espaços internos únicos), `ativo`.
- Enums em MAIÚSCULAS e ASCII (`ATIVO`, `EM_CARREGAMENTO`).
- Regra de leitura de campo migrado: **coluna nova → legado → nulo**.
- `legacy_payload` congelado (ADR-027): nenhuma chave nova; lista permitida em §6.
- Nome do banco (`pesagens-individuais`), origem do renderer, appId e `userData` **não mudam** (regra 25 do programa).

## 2. Esquema v7 (`DB_VERSION = 7`, `DATA_CONTRACT_VERSION = 2`, `BACKUP_FORMAT_VERSION = 3`)

```js
export const STORES_V7 = {
  // existentes (índices acrescentados marcados com +)
  pesagens: '++localId, id, data_pesagem, animal_id, [animal_id+data_pesagem], lote_id, embarque_id, sessao_id, tipo_pesagem, created_at, updated_at, deleted_at',
  apartacoes: '++localId, id, nome, ativo, created_at, updated_at, deleted_at',                       // + ativo
  loteApartacoes: '++localId, id, apartacao_id, situacao, categoria_id, created_at, updated_at, deleted_at', // + situacao, categoria_id (lote_id removido: era índice sem campo)
  embarques: '++localId, id, data, status, parceiro_id, created_at, updated_at, deleted_at',            // + parceiro_id
  documentosEmbarque: '++localId, id, embarque_id, tipo, created_at, updated_at, deleted_at',
  animais: '++localId, &id, empresa_id, identificacao_normalizada, situacao, marca_id, raca_id, categoria_id, propriedade_id, lote_atual_id, ultima_pesagem_data, created_at, updated_at, deleted_at',
  animalIdentificadores: '++localId, &id, animal_id, tipo, [tipo+valor_normalizado], [marca_id+valor_normalizado], faixa_id, ativo, created_at, updated_at, deleted_at',
  movimentosAnimais: '++localId, &id, animal_id, tipo, data_evento, lote_origem_id, lote_destino_id, created_at, updated_at, deleted_at',
  animalLotes: '++localId, &id, animal_id, lote_id, inicio, fim, created_at, updated_at, deleted_at',
  sessoesPesagem: '++localId, &id, data, [data+local], status, operador, operador_usuario_id, created_at, updated_at, deleted_at',
  auditoria: '++localId, &id, entidade, entidade_id, acao, usuario_id, created_at',
  importacoes: '++localId, &id, &arquivo_hash, status, created_at, updated_at',
  appSettings: 'key',
  backupHistory: '++localId, id, tipo, created_at',
  // cadastros mestres (ADR-018)
  marcas: '++localId, &id, empresa_id, nome_normalizado, ativo, created_at, updated_at, deleted_at',
  racas: '++localId, &id, empresa_id, nome_normalizado, ativo, created_at, updated_at, deleted_at',
  categoriasAnimal: '++localId, &id, empresa_id, nome_normalizado, ativo, created_at, updated_at, deleted_at',
  parceiros: '++localId, &id, empresa_id, nome_normalizado, documento, *papeis, ativo, created_at, updated_at, deleted_at',
  propriedades: '++localId, &id, empresa_id, nome_normalizado, tipo, parceiro_id, ativo, created_at, updated_at, deleted_at',
  causasMorte: '++localId, &id, empresa_id, nome_normalizado, ativo, created_at, updated_at, deleted_at',
  // estoque de identificadores (ADR-019)
  faixasIdentificadores: '++localId, &id, empresa_id, tipo, marca_id, situacao, ativo, created_at, updated_at, deleted_at',
  excecoesIdentificadores: '++localId, &id, faixa_id, [faixa_id+numero], motivo, created_at, updated_at, deleted_at',
  // autenticação local (ADR-043) — hash/salt nunca indexados
  usuarios: '++localId, &id, empresa_id, &login_normalizado, role, ativo, created_at, updated_at, deleted_at',
};
export const REMOVED_STORES_V7 = { lotes: null };
```

`db.js` mantém `version(5)`, `version(6)` e acrescenta `version(7).stores({...STORES_V7, ...REMOVED_STORES_V7})`. O `upgrade()` da v7 faz **somente** transformações leves e idempotentes (enums de `status`/`situacao`, `fechado→situacao`); o backfill pesado é resumível após a abertura (14-MIGRACOES). **Preflight obrigatório**: o código v7 nunca abre um banco v6 antes do backup físico validado (documento 14 §1–2).

Pré-condição da v7: `lotes` sem dado útil não migrado (o preflight verifica; se houver registros, bloqueia e reporta).

## 3. Campos por store (v7)

### 3.1 Cadastros mestres e usuários

| Store | Campos além dos padrão |
|---|---|
| `marcas` | `nome`, `nome_normalizado`, `abreviacao`, `proprietario_parceiro_id`, `propriedade_id`, `padrao` (bool; uma por empresa), `observacao` |
| `racas` | `nome`, `nome_normalizado`, `abreviacao`, `grupo` (`ZEBUINO`/`TAURINO`/`CRUZADO`/`OUTRO`/null), `padrao`, `ordem` |
| `categoriasAnimal` | `nome`, `nome_normalizado`, `sexo_aplicavel` (`M`/`F`/`AMBOS`), `idade_min_meses`, `idade_max_meses`, `ordem` |
| `parceiros` | `nome`, `nome_normalizado`, `tipo_pessoa` (`FISICA`/`JURIDICA`), `documento` (só dígitos ou null), `papeis[]` (`COMPRADOR`,`VENDEDOR`,`FRIGORIFICO`,`TRANSPORTADOR`,`PROPRIETARIO`), `telefone`, `email`, `cidade`, `uf`, `registro_sif`, `rendimento_padrao`, `observacao` |
| `propriedades` | `nome`, `nome_normalizado`, `tipo` (`PROPRIA`/`TERCEIRO`), `parceiro_id`, `municipio`, `uf`, `codigo_oficial`, `padrao` |
| `causasMorte` | `nome`, `nome_normalizado`, `categoria` (`Doença`,`Acidente`,`Predação`,`Parto`,`Desconhecida`,`Outra`), `descricao`, `exige_observacao`, `ordem` |
| `faixasIdentificadores` | `tipo` (`VISUAL`,`RFID`,`SISBOV`,`MANEJO`), `marca_id` (obrigatório para VISUAL), `prefixo`, `inicio`, `fim`, `digitos`, `proximo`, `direcao` (`CRESCENTE`/`DECRESCENTE`), `origem`, `data_entrada`, `situacao` (`ATIVA`,`ESGOTADA`,`BLOQUEADA`), `observacao` |
| `excecoesIdentificadores` | `faixa_id`, `numero`, `motivo` (`USADO_FORA_DE_ORDEM`,`PERDIDO`,`DANIFICADO`,`RESERVADO`,`DEVOLVIDO`), `animal_id`, `observacao` |
| `usuarios` | `nome`, `login`, `login_normalizado`, `role` (`ADMIN`,`GESTOR`,`OPERADOR`,`CONSULTA`), `ativo`, `password_hash`, `password_salt`, `password_algorithm` (`PBKDF2-SHA256`), `password_iterations`, `password_version`, `must_change_password`, `recovery_hash`, `recovery_salt` (só ADMIN de bootstrap), `failed_login_count`, `locked_until`, `last_login_at` — documento 11 §2 |

Seeds na migração: categorias `Bezerro, Bezerra, Garrote, Novilha, Boi, Vaca, Touro` (ids gerados, nunca fixos); uma propriedade `PROPRIA` padrão "Propriedade principal"; raça padrão `Nelore` se não existir nos dados; marca padrão = a mais usada nos dados (ou nenhuma).

### 3.2 Stores existentes alteradas

| Store | Campos novos / alterados |
|---|---|
| `animais` | `marca_id`, `raca_id`, `categoria_id`, `propriedade_id`, `nascimento` (civil ou null), `nascimento_estimado` (bool), `situacao` enum (§3.3). Campos `marca`, `raca`, `era` permanecem como legado somente-leitura |
| `animalIdentificadores` | `tipo` enum (`VISUAL`,`RFID`,`SISBOV`,`MANEJO`,`TEMPORARIO`,`LEGADO`), `marca_id`, `faixa_id`, `inicio`, `fim`, `motivo_troca`; `valor_normalizado` de VISUAL passa a ser só o número normalizado (a marca vai em `marca_id`; o índice `[marca_id+valor_normalizado]` garante a unicidade por marca); campo legado `marca` (texto) mantido |
| `sessoesPesagem` | `status` enum (`ABERTA`,`CONFERENCIA`,`FECHADA`,`CANCELADA`), `local` (null), `operador_usuario_id`, `marca_padrao_id`, `apartacao_padrao_id`, `tipo_manejo_padrao`, `snapshot`, `motivo_reabertura` |
| `loteApartacoes` | `codigo`, `situacao` (`ABERTO`/`FECHADO`, de `fechado`), `categoria_id`, `data_abertura`, `data_fechamento`, `ativo`, `ordem`; `nome_apartacao` desnormalizado deixa de ser gravado (leitura por junção) |
| `apartacoes` | `ativo`, `ordem`, `observacao` |
| `auditoria` | `usuario_id`, `usuario_nome_snapshot`, `resumo`, `campos_alterados[]`; `antes/depois` completos só em ações críticas (ADR-046) |
| `embarques` | `parceiro_id` (preenchido na v8) |
| `pesagens` | `created_by_user_id`, `updated_by_user_id` (sem índice, gravados daqui em diante) |

### 3.3 Enum de `animais.situacao`

`ATIVO`, `VENDIDO`, `ABATIDO`, `MORTO`, `DOADO`, `TRANSFERIDO`, `CANCELADO`, `INATIVO` (somente para saídas legadas sem motivo mapeável; o relatório de migração conta). Mapeamento no backfill: Venda→VENDIDO, Abate→ABATIDO, Morte→MORTO, Doação→DOADO, Transferência→TRANSFERIDO, Outros/nulo→INATIVO.

## 4. Esquema v8 (marco 1.5.0)

```js
STORES_V8 = {
  ...STORES_V7,
  pesagens: '++localId, id, data_pesagem, animal_id, [animal_id+data_pesagem], lote_id, embarque_id, sessao_id, tipo_pesagem, motivo_saida, operacao_id, created_at, updated_at, deleted_at',
  embarques: '++localId, id, data, status, parceiro_id, transportador_id, created_at, updated_at, deleted_at',
  operacoesComerciais: '++localId, &id, empresa_id, tipo, status, parceiro_id, embarque_id, data, created_at, updated_at, deleted_at',
};
```

Colunas promovidas em `pesagens` (lidas do payload no backfill v8): `motivo_saida`, `operacao_id`, `causa_morte_id`, `marca_id`, `raca_id`, `categoria_id`, `apartacao_id`, `versao_formula`. `operacoesComerciais`: `tipo`, `data`, `parceiro_id`, `propriedade_origem_id`, `propriedade_destino_id`, `preco_arroba`, `rendimento_percentual`, `rendimento_origem` ∈ {`INFORMADO`,`PADRAO_EMPRESA`,`PADRAO_PARCEIRO`}, `valor_total_informado`, `valor_total_calculado`, `valor_frete`, `descontos`, `outros_custos`, `quantidade_prevista`, `embarque_id`, `documentos[]`, `retorno_frigorifico`, `status`, `observacao`, `created_by_user_id`. `embarques.status` enum `PLANEJADO`,`EM_CARREGAMENTO`,`CONFERIDO`,`CONCLUIDO`,`CANCELADO`.

## 5. Backfill v7 (resumível; ver 14-MIGRACOES)

| Passo | Origem | Destino | Regra |
|---|---|---|---|
| B1 marcas | valores distintos de `animais.marca`, `animalIdentificadores.marca`, `pesagens.legacy_payload.marca` | `marcas` | agrupar por `nome_normalizado`; **não fundir** grupos cuja fusão gere `(marca_id, numero)` duplicado entre animais distintos — nesses casos criar marcas separadas com o texto bruto e listar no relatório (ADR-021) |
| B2 raças | `animais.raca`, payload `raca` | `racas` | fusão automática por normalização; `Nelore` padrão |
| B3 categorias | seed fixo | `categoriasAnimal` | ids gerados |
| B4 causas | `appSettings['cadastros-auxiliares:mortalidade:*'].causasMorte` | `causasMorte` | ids preservados |
| B5 parceiros | `appSettings['cadastros-auxiliares:comerciais:*']` + `perfis-saida:*.compradores` | `parceiros` | união por `documento` ou `nome_normalizado`; papéis consolidados; ids do registry preservados quando possível |
| B6 propriedades | seed | `propriedades` | uma `PROPRIA` padrão; vendedores com `propriedade` texto geram `TERCEIRO` ligada ao parceiro |
| B7 animais | texto → ids | `animais` | `marca_id`, `raca_id` por normalização; `categoria_id` null; `situacao` enum; `nascimento` estimado a partir de `era` numérica (meses) com `nascimento_estimado=true`; lote de 500 por cursor `localId` |
| B8 identificadores | `tipo`, `marca_id`, `valor_normalizado` só número, `inicio=created_at` | `animalIdentificadores` | lote de 500 |
| B9 sessões/lotes | enums | `sessoesPesagem`, `loteApartacoes`, `apartacoes` | idempotente |
| B10 payload | remover `_localId`, `peso_kg`, `created_date`, `updated_date`, `status_animal` do `legacy_payload` | `pesagens` | lote de 500; o mapper já cai para `created_at/updated_at` e projeção |
| B11 limpeza | chaves `cadastros-auxiliares:*`, `perfis-saida:*` | `appSettings` | só após B4/B5 validados (contagens); sanidade exportada antes (ADR-022) |
| B12 verificação | `logicalIntegrity` estendido + contagens | relatório | grava `migration:v7.status='CONCLUIDA'` |

Usuários não são criados pelo backfill: o app abre o FIRST-RUN ADMIN SETUP quando `usuarios` está vazia (ADR-044).

## 6. Lista permitida de `legacy_payload` (gate `payload:allowlist:verify`)

Permitidas: `id, empresa_id, tipo_manejo, motivo_saida, causa_morte, data_pesagem, animal_id, sessao_id, numero_animal, sexo, raca, era, marca, peso, observacao, apartacao_id, nome_apartacao, lote_id, nome_lote, origem, operador, id_externo, data_anterior, peso_anterior, dias, ganho, gmd, alertas_confirmados, justificativa_alerta, valor_pago_cabeca, origem_animal, documentacao, comprador, destino_venda, valor_venda_total, valor_arroba, rendimento_carcaca, peso_carcaca_estimado, quantidade_arrobas, frigorifico, valor_arroba_abate, valor_total_abate, embarque_id, embarque_nome, documento_embarque_id, documento_tipo, documento_numero, motorista_nome, placa_carreta`.

Proibidas em gravação nova: `_localId`, `peso_kg`, `created_date`, `updated_date`, `status_animal`, `sanidade_ids`, `sanidades`, cópias novas de parceiro/embarque/documento/sessão/usuário e qualquer chave fora da lista. `status_animal` existente em registros antigos permanece legível (o view model o projeta a partir do evento: Saída → `Inativo`), mas nunca volta a ser gravado. O mapper (`uiToStorageRecord`) filtra pela lista; o gate prova o filtro e a ausência das proibidas após criar, editar e recalcular. Snapshots históricos não são reescritos "para ficar bonito".

## 7. Contagem de stores

| Versão | Stores | Observação |
|---|---|---|
| v6 (1.1.17) | 16 | inclui `lotes` sem uso |
| v7 (1.2.0) | **23** | 14 existentes (sem `lotes`) + `marcas`, `racas`, `categoriasAnimal`, `parceiros`, `propriedades`, `causasMorte`, `faixasIdentificadores`, `excecoesIdentificadores`, `usuarios` |
| v8 (1.5.0) | **24** | + `operacoesComerciais` |

Contagens diferentes citadas na Auditoria Master ficam superadas por esta tabela.

---

<!-- docs/arquitetura-produto/13-VERSIONAMENTO-RELEASE.md -->

# 13 — Versionamento e política de release (contrato de implementação)

**Programa 1.1.17 → 1.6.0 · ADR-047, ADR-048 (DEC-030) · revisão 2 (14/09/2026).**

## 1. Quatro versões que nunca se confundem

| Eixo | Onde vive | Valor no início | Regra |
|---|---|---|---|
| App SemVer | `package.json` → Electron `app.getVersion()`; renderer via constante de build (`__APP_VERSION__`, Vite) | 1.1.17 | PATCH correção; MINOR funcionalidade/store/migração compatível; MAJOR quebra deliberada de backup/export/API local |
| `DB_SCHEMA_VERSION` | `src/storage/indexedDb/schema.js` (`DB_VERSION`) | 6 → 7 (1.2.0) → 8 (1.5.0) | só muda com migração testada e backup prévio |
| `BACKUP_FORMAT_VERSION` | módulo de backup (importado de `src/versioning/versionInfo.js`) | 2 → 3 (1.2.0) | formato anterior continua restaurável |
| `RELEASE_MANIFEST_VERSION` | `scripts/generate-release-manifest.mjs` | 1 → 2 (1.1.18) | muda quando o manifesto ganha/perde campos |

Marcadores de build (não são versões): `UI_BUILD_ID`, `DATA_BUILD_ID`, `UI_CONTRACT_VERSION`, `DATA_CONTRACT_VERSION`, `gitCommit`, `buildTimestamp` — todos reunidos por `describeVersions()` em `src/versioning/versionInfo.js`. `gitCommit`/`buildTimestamp` entram como constantes de build (`__BUILD_INFO__`, Vite) quando disponíveis.

## 2. Onde aparecem

| Lugar | Conteúdo |
|---|---|
| Sistema › Backup e Manutenção › Status (e "Sobre") | app, esquema, formato de backup, manifesto, commit/build, contrato UI/dados |
| Copiar diagnóstico | idem + papel do usuário atual + estado de migração + último backup; nunca senha/hash/recovery |
| Login e topbar | versão do app, discreta |
| `release-manifest.json` | `releaseManifestVersion, appVersion, dbSchemaVersion, backupFormatVersion, gitCommit, buildTimestamp, platform, arch, installer{file,sha256,sizeBytes,builtAt}, signed, distribution, uiBuildId, dataBuildId, uiContract, dataContract` |
| Backup JSON | `manifest.appVersion, dbVersion, formatVersion, dataContractVersion, uiBuildId` |

## 3. Marcos

| Marco | Conteúdo | Esquema | Backup |
|---|---|---|---|
| 1.1.18 | baseline verde (S-00.0), contrato de versão, ADRs, docs de engenharia, gate `release:version-contract`, notas e CHANGELOG; **sem esquema novo** | 6 | 2 |
| 1.2.0 | Dexie v7 (usuários, cadastros, identidade), preflight/backfill, backup 3, login/papéis/recovery, telas de cadastros, Lançamento seleciona cadastros | 7 | 3 |
| 1.3.0 | faixas/exceções, identificadores, resolução indexada, tela Faixas | 7 | 3 |
| 1.4.0 | lançamento enxuto, Apartações/Lotes, contexto de sessão | 7 | 3 |
| 1.5.0 | Dexie v8, operações comerciais, embarques, relatórios mínimos | 8 | 3 |
| 1.6.0 | sessão real, fechamento, Animais/ficha, auditoria consolidada | 8 | 3 |

Cada marco deixa `package.json`, CHANGELOG, `docs/release/<versão>/` e evidência coerentes (rollback/bisect). Nenhum marco é publicado remotamente sem autorização; tags locais só após o gate do marco.

## 4. Política de release

1. `package.json` e `package-lock.json` sincronizados.
2. `release:clean` → `build` → electron-builder (assinado em `release/`; sem certificado, `dist:unsigned` em `release-unsigned/`, `signed=false`).
3. `packaged:build:verify` (versões = `app.asar` = manifesto; marcadores no bundle e no asar; Setup não anterior aos bundles; nome `Pesagens Individuais Setup X.Y.Z.exe`).
4. `release:version-contract:verify`: `package.json` = manifesto = `docs/release/<versão>/`; nenhum release anterior sobrescrito; artefatos antigos nunca aparecem como "current"; CHANGELOG com bloco `## [versão]` e data real.
5. `release:checksum` (`.sha256`) e `release:manifest`.
6. Notas, checklist e `MIGRATION-*.md` em `docs/release/<versão>/`; `docs/user` atualizado; `docs:user:verify` verde.
7. Teste instalado automatizado (smoke) + teste físico declarado EXECUTADO só com evidência humana; caso contrário NÃO EXECUTADO.
8. Tag `vX.Y.Z` após o gate.

## 5. CHANGELOG

Um bloco por versão com data real: `## [X.Y.Z] — AAAA-MM-DD` e seções Added / Changed / Fixed / Removed / Migration / Security. Sem múltiplos "Não lançado".

## 6. Git e fatias

`main` = baseline; `program/pesagens-master-evolution` = integração; `slice/sNN-*` quando possível. Dono único por fatia; arquivos compartilhados (`schema.js`, `package.json`, `pages.config.js`, `Layout.jsx`, `App.jsx`, `d17b-modelobase1.css`, `verify-ui-consistency.mjs`, `CHANGELOG.md`, `vite.config.js`) pertencem ao orquestrador. Sem merge/push em `main` e sem release remota sem autorização.

---

<!-- docs/arquitetura-produto/14-MIGRACOES.md -->

# 14 — Migrações (contrato de implementação)

**Programa 2.0 · 14/09/2026 · ADR-038, ADR-021, ADR-022, ADR-023, ADR-034.**

## 1. Regra central

O upgrade do Dexie não pode destruir dados. Antes de abrir o banco numa versão que exige migração:

```text
detectar versão atual → backup lógico completo → SHA-256 → gravar fisicamente →
validar (tamanho + hash relidos) → só então abrir na versão nova → backfill resumível → verificar
```

Se o backup falhar: **MIGRAÇÃO BLOQUEADA** (fail closed) — o banco não é aberto na versão nova, a tela mostra o diagnóstico e o app não aceita escrita.

## 2. `src/storage/migrations/migrationCoordinator.js`

```js
export async function inspectDatabase()                 // { exists, currentVersion, targetVersion, needsMigration, blockers[] }
export async function prepareMigration({ files })       // backup pré-migração + validação; devolve { backupPath, sha256, size } ou lança MIGRATION_BACKUP_FAILED
export async function openWithMigration({ files, onProgress }) // inspect → prepare (se necessário) → db.open() → runPendingBackfills → { migrated, report }
export async function runPendingBackfills({ onProgress })      // reentrante; lê appSettings['migration:vN'] e continua do checkpoint
export async function getMigrationState(version)        // estado técnico
export async function dryRunBackfill(version)           // relatório sem gravar (usado em Manutenção e na evidência)
```

Detecção: `Dexie.exists(DB_NAME)`; versão atual via `new Dexie(DB_NAME).open()` em modo dinâmico (`db.verno`), fechado em seguida. Bloqueios pré-v7: store `lotes` com registros → `MIGRATION_BLOCKED_LOTES` (o usuário exporta/limpa pela Manutenção antes).

Backup pré-migração: mesmo formato do backup completo (`createFullBackup` sobre a instância dinâmica, formato da versão de origem), nome `pre-migration-v<alvo>-YYYYMMDD-HHmmss.json`, gravado por `window.pesagemApp.files.writeUserFile({ subdir: 'backups' })`, validado por tamanho e SHA-256 relidos; registrado em `backupHistory('pre-migration')`. Sem ponte de arquivos (navegador de desenvolvimento): bloqueado, salvo `localStorage['pesagens.dev.allowUnsafeMigration']==='1'` — nunca no pacote.

## 3. Estado técnico (`appSettings`)

Chaves `migration:v7`, `migration:v8` (estado técnico, não catálogo):

```json
{ "versao": 7, "status": "PENDENTE|EM_ANDAMENTO|CONCLUIDA|FALHOU", "started_at": "...", "last_checkpoint": "B7:localId=12500",
  "processed": 12500, "total": 36000, "finished_at": null, "error": null, "backup": { "path": "...", "sha256": "...", "size": 123 },
  "relatorio": { "marcas": 5, "racas": 4, "parceiros": 3, "animaisAtualizados": 12000, "identificadores": 12000, "colisoesMarca": [], "saidasSemMotivo": 0 } }
```

## 4. Reentrância

- Cada passo (B1…B12 do documento 12 §5) é idempotente: só grava o que ainda falta (verifica por `nome_normalizado`, por `marca_id == null`, por `tipo === 'visual_marca'`, etc.).
- Lotes de 500 registros por cursor de `localId`; checkpoint após cada lote.
- Fechar o app no meio e reabrir → `runPendingBackfills` continua do checkpoint; nunca duplica.
- O `upgrade()` do Dexie só faz o que é seguro dentro da transação de versão (enums simples); o pesado é backfill.

## 5. Falha

- Erro em um lote: registra `status='FALHOU'`, `error`, mantém o backup, **bloqueia escrita** (flag `migrationBlocked` no `storageAdapter`; serviços de escrita lançam `MIGRATION_BLOCKED`), mostra diagnóstico com "Copiar diagnóstico".
- Retomada manual em Manutenção (ADMIN, `maintenance.migrate`): "Continuar migração" chama `runPendingBackfills`.
- Rollback lógico: restaurar o backup pré-migração pelo próprio Manutenção (o restore de formato anterior grava e depois roda o backfill novamente).

## 6. Restore cruzado

- `dryRunRestore` devolve `schemaUpgradeRequired`, `ignoredStores`, `newStores`.
- `applyRestore` de backup com `dbVersion < atual`: grava, converte enums mínimos e agenda `runPendingBackfills` na sequência; só então registra sucesso.
- Backups `formatVersion 2` continuam restauráveis; `formatVersion 3` acrescenta `dataContractVersion`, `uiBuildId`, `schemaVersion`.

## 7. Documentação por release

`docs/release/<versão>/MIGRATION-<de>-TO-<para>.md` (1.1.17→1.2.0; 1.3.0; 1.4.0; 2.0.0) com: pré-requisitos, backup, passos, relatório esperado, rollback, tempo medido nas massas (vazia, pequena, 36 mil, 250 mil).

## 8. Gates

- `migration:v7:verify` (`scripts/verify-v7-migration.mjs`): massas vazia, pequena e 36 mil (a 250 mil em `test:full`): contagens, ids preenchidos, payload limpo, `lotes` removida, enums, reentrância (interromper no meio e continuar sem duplicar), bloqueio sem backup, colisão de marca não fundida, tempo registrado.
- `storage:backup:verify` e `storage:import-restore:verify` atualizados: formato 3; restore de backup v2/v6 → backfill; usuários no backup.

---

<!-- docs/arquitetura-produto/F0-01-MAPA-DE-CAMPOS.md -->

# F0-01 — Mapa de campos: estado atual → modelo-alvo

**Base analisada:** aplicação 1.1.17, esquema Dexie v6 (`src/storage/indexedDb/schema.js`).  
**Modelo-alvo:** [02-ARQUITETURA-DE-DOMINIO.md](./02-ARQUITETURA-DE-DOMINIO.md) §4 e [03-CADASTROS-E-FLUXOS.md](./03-CADASTROS-E-FLUXOS.md).  
**Convenção de status:** a mesma do [README](./README.md): Atual, Parcial, Planejado, Opcional, Fora de escopo.

## 1. Como o dado é persistido hoje

Cada store Dexie tem chave primária técnica `localId` (autoincremento) e o
`id` de domínio (UUID) como índice. A store `pesagens` guarda os campos
indexados em colunas próprias e **o restante do lançamento inteiro dentro de
`legacy_payload`** (objeto com o shape da tela). O mapper
`storageRecordToViewModel` funde `legacy_payload` + colunas ao ler.

Consequência para o modelo-alvo: a maior parte dos campos de negócio já existe,
mas vive num objeto não indexado. A evolução deve promover campos para colunas
próprias somente quando houver consulta, índice ou regra sobre eles, com
`DB_VERSION` incrementado e backfill explícito (02 §8).

## 2. Pesagem (fato) — store `pesagens`

| Campo atual | Onde vive | Campo-alvo (02 §4.4) | Status | Observação |
|---|---|---|---|---|
| `id` | coluna (índice) | `id` | Atual | UUID |
| `animal_id` | coluna (índice, composto `[animal_id+data_pesagem]`) | `animal_id` | Atual | |
| `sessao_id` | coluna (índice) | `sessao_id` | Parcial | criado automaticamente por data; UI não expõe |
| `data_pesagem` | coluna (índice) | data operacional civil | Atual | `YYYY-MM-DD` |
| — | — | instante de captura | Planejado | hoje só `created_at` |
| `peso_kg` | coluna | `peso_kg` numérico | Atual | também `peso` no payload |
| `tipo_pesagem` | coluna (índice) | tipo de manejo | Atual | valores: `Cadastro`, `Manejo`, `Saída` (`legacy_payload.tipo_manejo` é a fonte lida pela UI) |
| `lote_id` | coluna (índice) | lote/apartação de destino | Atual | aponta para `loteApartacoes.id` |
| `embarque_id` | coluna (índice) | vínculo de embarque | Atual | somente em Saída |
| `observacao` | coluna | observação | Atual | |
| `legacy_payload.motivo_saida` | payload | motivo/tipo de saída | Atual | `Venda`, `Abate`, `Morte`, `Doação`, `Transferência` |
| `legacy_payload.apartacao_id`, `nome_apartacao`, `nome_lote` | payload | apartação/lote de origem e destino | Parcial | nomes desnormalizados; origem não é gravada |
| `legacy_payload.data_anterior`, `peso_anterior`, `dias`, `ganho`, `gmd` | payload | derivados versionados | Parcial | recalculados pelo `weighingSeries`; falta versão da fórmula |
| `legacy_payload.sexo`, `raca`, `era`, `marca`, `numero_animal` | payload | snapshot do animal no evento | Atual | preserva o fato mesmo se o cadastro mudar |
| `legacy_payload.status_animal` | payload | — | Atual | redundante com projeção em `animais.situacao` |
| `legacy_payload.alertas_confirmados`, `justificativa_alerta` | payload | pendência/justificativa | Parcial | só outliers de peso/GMD |
| `legacy_payload.valor_pago_cabeca`, `origem_animal`, `documentacao` (JSON) | payload | operação comercial de compra | Parcial | compra gravada dentro do Cadastro |
| `legacy_payload.comprador`, `destino_venda`, `valor_venda_total`, `valor_arroba`, `rendimento_carcaca`, `peso_carcaca_estimado`, `quantidade_arrobas` | payload | operação comercial de venda | Parcial | venda gravada dentro da Saída |
| `legacy_payload.frigorifico`, `valor_arroba_abate`, `valor_total_abate` | payload | operação comercial de abate | Parcial | abate gravado dentro da Saída |
| `legacy_payload.embarque_nome`, `documento_embarque_id`, `documento_tipo`, `documento_numero`, `motorista_nome`, `placa_carreta` | payload | item de embarque + documento | Parcial | desnormalizado a partir de `documentosEmbarque` |
| `legacy_payload.operador`, `origem` | payload | operador, origem da captura | Parcial | valores `manual`/`importacao`; sem dispositivo |
| `created_at`, `updated_at`, `deleted_at` | colunas (índices) | auditoria temporal + cancelamento lógico | Atual | |
| — | — | `version` | Planejado | necessário para sincronização (06 §3) |
| — | — | `dispositivo_id`, `estado_sync` | Planejado | 06 §2 e §8 |
| — | — | `empresa_id`/`fazenda_id` na coluna | Parcial | `legacy_payload.empresa_id = 'local'`; não indexado |

## 3. Animal (cadastro/projeção) — store `animais`

| Campo atual | Campo-alvo (02 §4.1) | Status | Observação |
|---|---|---|---|
| `id` | `id` UUID imutável | Atual | |
| `empresa_id` | `empresa_id` | Parcial | sempre `'local'` ou nulo; sem `fazenda_id` |
| `numero_animal`, `identificacao_normalizada` | identificador visual | Atual | também em `animalIdentificadores` |
| `marca` | `marca_id` | Parcial | texto livre, não é cadastro |
| `sexo` | `sexo` | Atual | `M`/`F` |
| `raca` | `raca_id` | Parcial | texto livre, não é cadastro |
| `era` | nascimento/era calculável | Parcial | texto livre (meses) |
| — | `categoria_id` | Planejado | |
| `situacao` | `situacao` | Parcial | só `Ativo`/`Inativo`; alvo distingue vendido, abatido, transferido, morto, cancelado (`motivo_saida` já permite derivar) |
| `data_saida`, `motivo_saida` | projeção de saída | Atual | reconstruída dos eventos |
| `ultima_pesagem_data`, `ultimo_peso_kg` | projeção | Atual | |
| `lote_atual_id`, `apartacao_atual_id` | lote atual como projeção | Atual | reconstruída de `animalLotes` |
| `origem`, `nome` | origem/observações | Parcial | |
| `created_at`, `updated_at`, `deleted_at` | auditoria temporal | Atual | |
| — | `version` | Planejado | |

## 4. Identificador — store `animalIdentificadores`

| Campo atual | Campo-alvo (02 §4.2) | Status | Observação |
|---|---|---|---|
| `tipo` | tipo | Parcial | só `visual_marca`; alvo: visual, RFID/EID, SISBOV, manejo SISBOV, legado, temporário |
| `valor`, `valor_normalizado` | valor original/normalizado | Atual | normalizado = `NÚMERO::MARCA` |
| `marca` | — | Atual | parte da chave de identidade visual |
| `principal`, `ativo` | principal/secundário, ativo | Atual | |
| índice `[tipo+valor_normalizado]` | unicidade global por tipo | Parcial | índice não é único; unicidade verificada só no `health.js` |
| — | `inicio`, `fim`, `motivo_troca`, `usuario` | Planejado | validade temporal (03 §3.3) |

## 5. Sessão de pesagem — store `sessoesPesagem`

| Campo atual | Campo-alvo (02 §4.3) | Status | Observação |
|---|---|---|---|
| `id`, `data`, `inicio` | id, data operacional, início | Atual | criada automaticamente na primeira pesagem do dia |
| `status` | rascunho/aberta/conferência/encerrada/cancelada | Parcial | só `Aberta`; nunca é encerrada |
| `operador` | operador | Parcial | `LOCAL`, `IMPORTACAO` ou o operador do payload |
| — | empresa, fazenda, curral, dispositivo | Planejado | |
| — | tipo de manejo, lote de origem, perfil de apartação | Planejado | |
| — | modo de captura, contadores, término, snapshot | Planejado | F2 |

## 6. Lote, apartação e permanência

| Store atual | Campos atuais | Entidade-alvo (02 §4.6, 03 §4) | Status | Observação |
|---|---|---|---|---|
| `apartacoes` | `nome_apartacao`, `empresa_id` | Apartação | Parcial | falta destino, perfil de regra, política de lote cheio, validade |
| `loteApartacoes` | `nome_lote`, `apartacao_id`, `peso_minimo`, `peso_maximo`, `quantidade_maxima`, `fechado` | Lote | Parcial | falta fazenda/local, categoria, datas, meta |
| `lotes` | store existe sem uso ativo | Lote | Parcial | referenciada só em `health.js`; a UI usa `loteApartacoes` |
| `animalLotes` | `animal_id`, `lote_id`, `apartacao_id`, `inicio`, `fim`, `origem` | Permanência | Atual | reconstruída dos eventos (`origem` = lancamento/importacao/projecao) |
| `movimentosAnimais` | `animal_id`, `pesagem_id`, `tipo`, `data_evento`, `lote_origem_id` (sempre nulo), `lote_destino_id`, `motivo` | Movimento | Parcial | origem não é gravada |
| — | — | Regra de apartação (02 §4.7) | Parcial | só faixa `peso_minimo..peso_maximo` + capacidade, em `getLoteAutomatico` na tela |

## 7. Comercial, embarque e documentos

| Store/chave atual | Campos | Entidade-alvo | Status | Observação |
|---|---|---|---|---|
| `embarques` | `nome`, `data`, `status`, `frigorifico`, `empresa_id` | Embarque | Parcial | falta destino, capacidade, veículo, motorista no embarque |
| `documentosEmbarque` | `embarque_id`, `tipo_documento` (`GTA`, `NF-e`, `GTA+NF-e`), `numero_gta`, `numero_nfe`, `motorista_nome`, `placa_carreta` | Documento | Parcial | |
| `appSettings['perfis-saida:<empresa>']` | `compradores[]` (nome, documento, cidade, telefone), `venda[]`, `abate[]` | Pessoas/Comprador/Frigorífico, Perfil de venda/abate | Parcial | vivem como configuração, não como cadastro com histórico |
| dentro de `pesagens.legacy_payload` | ver §2 | Operação comercial (02 §4.8) | Parcial | não existe entidade própria com status rascunho/conferida/fechada |

## 8. Plataforma

| Store/mecanismo atual | Entidade-alvo | Status | Observação |
|---|---|---|---|
| `auditoria` (`entidade`, `entidade_id`, `acao` CRIAR/ATUALIZAR/CANCELAR, `antes`, `depois`, `origem`, `operador`, `motivo`) | Auditoria | Parcial | sem usuário/dispositivo; sem consulta administrativa |
| `importacoes` (`arquivo_hash` único, nome, tamanho, origem, status, contagens) | Importação/Job | Atual | idempotente por SHA-256 |
| `backupHistory`, `appSettings` | Backup, Configuração | Atual | |
| `localStorage` (`empresa_selecionada_id`, `erp-tema`, colunas/filtros das telas) | Configuração de UI | Atual | por navegador/instalação, fora do backup |
| — | Outbox, Conflito, Dispositivo, Usuário, Papel | Planejado | F7 |
| — | Empresa, Fazenda, Curral | Planejado | hoje `empresa_id = 'local'` fixo |
| — | Leitura de equipamento, Dispositivo, Perfil de conexão | Planejado | F5 |

## 9. Contrato de importação/exportação por arquivo (05 §7)

Cabeçalhos CSV aceitos hoje (normalização remove acentos, espaços e `_`):
`ID`, `ID_Externo`, `Data`, `NumeroAnimal`/`Animal`, `Sexo`, `Raça`, `Era`,
`Marca`, `Peso`, `Lote`, `Apartação`, `Observação`, `DataAnterior`,
`PesoAnterior`, `Dias`, `Ganho`, `GMD`. Delimitador detectado entre `;`, tab e
`,`. Exportação usa a mesma lista de cabeçalhos. **Lacuna:** não há mapeamento
explícito de colunas nem preview por linha com erro estruturado além da lista
`erros[]` na tela.

## 10. Ambiguidades P0 resolvidas nesta revisão

| Tema | Decisão registrada |
|---|---|
| Identidade visual | `numero_animal` + `marca` (normalizados em maiúsculas) → `animal_id` UUID. Mesmo número pode existir em marcas diferentes; conflito abre `SelecionarAnimalDialog`. |
| Tipo do evento | A UI lê `legacy_payload.tipo_manejo`; a coluna `tipo_pesagem` é espelho. Ao promover para coluna, `tipo_pesagem` passa a ser a fonte e `tipo_manejo` vira alias de leitura. |
| Lote de referência | `pesagens.lote_id` referencia `loteApartacoes.id` (não `lotes`). A store `lotes` deve ser reaproveitada ou removida por ADR antes da F2. |
| Empresa | Valor único `'local'` até a F7; todas as consultas filtram por ele. |
| Sessão | Existe uma sessão automática por data operacional com status `Aberta`; a F2 introduz o ciclo de vida sem quebrar `sessao_id` existente. |

## 11. Campos que **não** serão criados (fora de escopo)

Sanidade, medicamentos, reprodução, nutrição, máquinas, folha e contabilidade
(00 §4.10 e ADR-007).

---

<!-- docs/arquitetura-produto/F0-02-CATALOGO-DE-FORMULAS.md -->

# F0-02 — Catálogo de fórmulas existentes

Levantamento das fórmulas **implementadas** na 1.1.17, com o arquivo de origem,
o teste que as protege e a comparação com as fórmulas canônicas do
[02-ARQUITETURA-DE-DOMINIO.md](./02-ARQUITETURA-DE-DOMINIO.md) §5 e das
métricas do [04-RELATORIOS-E-INDICADORES.md](./04-RELATORIOS-E-INDICADORES.md) §3.

## 1. Ganho, dias e GMD

**Origem:** `src/modules/weighing/domain/weighingCalculations.js` (`calculateWeightGain`)  
**Série:** `src/modules/weighing/domain/weighingSeries.js` (`recalculateWeightSeries`)  
**Teste:** `scripts/verify-weighing-calculations.mjs`, `verify-enterprise-hardening.mjs`

| Item | Implementação atual | Canônico (02 §5) | Divergência |
|---|---|---|---|
| Referência anterior | última pesagem **do mesmo animal** com `data_pesagem < data atual` e peso numérico; registros futuros e do mesmo dia são ignorados | idem | nenhuma |
| `ganho_kg` | `peso_atual − peso_anterior`, arredondado a 2 casas | `peso_atual_kg − peso_anterior_kg` | arredondamento não está no canônico (registrar como regra de apresentação) |
| `dias` | diferença de datas civis em UTC (`Date.UTC`), sem fuso | diferença de datas civis | nenhuma |
| `gmd_kg_dia` | `ganho / dias` a 3 casas **quando `dias > 0`; caso contrário `0`** | somente quando `dias > 0`; mesmo dia **não produz GMD** | **D1:** o código devolve `0` onde o canônico pede ausência (`null`). Como registros do mesmo dia nunca são escolhidos como anterior, `dias` nunca é 0 na prática; alinhar para `null` na F1 sem impacto de dados |
| Elegibilidade por tipo | só `tipo_manejo === 'Manejo'` recebe ganho/GMD; `Cadastro` e `Saída` gravam `null` | pesagem é fato; derivados reconstruíveis | **D2:** Saída com peso não recebe ganho/GMD; o relatório REP-302 (peso vivo na venda) precisa decidir se o ganho até a saída entra na série. Registrar decisão em ADR antes da F3 |
| Recálculo retroativo | após criar/editar/excluir, a série do animal (ou de todos) é recomposta e gravada em `legacy_payload` | recomposição transacional | **D3:** o recálculo lê a base inteira (`listEntries()`), ver baseline F0; corrigir na F1 |
| Chave da série | `id:<animal_id>` ou `legacy:<NÚMERO::MARCA>` para registros sem `animal_id` | animal canônico | compatibilidade legada preservada |

## 2. Alertas de conferência (outliers)

**Origem:** `src/modules/weighing/domain/weighingWarnings.js`  
**Teste:** `scripts/verify-enterprise-hardening.mjs`

| Alerta | Regra | Parâmetro padrão |
|---|---|---|
| `WEIGHT_RANGE` | peso fora de `[minimumWeightKg, maximumWeightKg]` | 20 a 1500 kg |
| `WEIGHT_CHANGE` | `|ganho| / peso_anterior × 100 > maximumWeightChangePercent` | 35 % |
| `GMD_RANGE` | `|gmd| > maximumAbsoluteGmdKg` | 5 kg/dia |

Os limites são constantes em código (`DEFAULT_WEIGHT_WARNING_POLICY`). O alvo
(03 §7) pede configuração controlada e versionada; a justificativa digitada é
gravada em `justificativa_alerta` e os códigos em `alertas_confirmados`.

## 3. Carcaça, arrobas e valor estimado

**Origem:** `src/modules/weighing/domain/commercialCalculations.js` (`calculateCarcassTrade`, `normalizeCarcassYield`)  
**Teste:** `scripts/verify-enterprise-hardening.mjs`

| Item | Implementação | Canônico | Divergência |
|---|---|---|---|
| Rendimento | informado pela UI; inválido (≤ 0, > 100 ou não numérico) cai no padrão **50 %** | rendimento informado/estimado explícito | **D4:** o fallback silencioso para 50 % contraria "valor informado ≠ valor calculado" (02 §4.8). A tela bloqueia rendimento inválido antes de salvar, então o fallback só age em importação/dados legados; registrar origem do rendimento (`informado`/`padrao`) na F6 |
| `carcaca_kg` | `peso_vivo × rendimento / 100` | idem | nenhuma |
| `arrobas` | `carcaca_kg / 15` | idem | nenhuma |
| `valor_estimado` | `arrobas × preco_por_arroba` quando preço ≥ 0 | idem | nenhuma |
| Separação de conceitos | `liveWeightKg`, `carcassWeightKg`, `arrobas`, `estimatedValue` gravados separadamente | ADR-012 | nenhuma |

Campos gravados na Saída: `rendimento_carcaca`, `peso_carcaca_estimado`,
`quantidade_arrobas`, `valor_arroba`/`valor_arroba_abate`,
`valor_venda_total`/`valor_total_abate`. Não existe cálculo de receita líquida,
frete, comissão ou margem (REP-302/304 — Planejado).

## 4. Regra de apartação automática

**Origem:** `src/pages/LancamentoPesagensIndividuais.jsx` (`getLoteAutomatico`, `isLoteCheio`)  
**Teste:** nenhum unitário (só contratos de UI)

```text
lote_sugerido = primeiro lote da apartação selecionada, na ordem de cadastro, tal que
  peso_minimo ≤ peso ≤ peso_maximo
  e lote não fechado
  e contagem(pesagens com lote_id = lote) < quantidade_maxima (padrão 999999)
```

Divergências com 02 §4.7 (ADR-010): sem prioridade explícita (usa ordem da
lista), sem `E`/`OU`, sem política de dado ausente, sem versão de regra, sem
registro de "sugerido × decidido". A contagem de ocupação percorre **todas as
pesagens** a cada avaliação (custo O(N) por animal). A regra deve migrar para um
motor puro em `src/modules/drafting/` na F4; a F1 deve ao menos usar a projeção
`animalLotes` aberta em vez de contar pesagens.

## 5. Resumos e métricas existentes na tela

**Origem:** `src/components/pesagens/ConfigurarResumosDialog.jsx`, `ResumoPersonalizado.jsx`, `PesagensResumoRodape.jsx`, `ResumoLotes.jsx`, `ResumoVendaDia.jsx`; `src/storage/indexedDb/repositories/index.js` (`weighing.summary`)

| Métrica atual | Definição implementada | Métrica canônica (04 §3) | Observação |
|---|---|---|---|
| Contar registros | quantidade de linhas no escopo | Pesagens | não distingue animais únicos |
| Somar / Média / Menor / Maior | sobre `peso`, valores comerciais, `dias`, `ganho`, `gmd` | Peso total, Peso médio, Ganho total, Ganho médio, GMD médio simples | **D5:** "Média" é soma ÷ quantidade de registros com valor numérico; para GMD isso é o *GMD médio simples*. Não existe *GMD ponderado* (Σganho ÷ Σdias) |
| Maior menos menor | amplitude | — | não canônica; manter como métrica de painel |
| Dividir a soma por outro campo | Σcampo ÷ Σdivisor | permite Σganho ÷ Σdias = GMD ponderado manualmente | documentar como caminho provisório |
| Escopos | dia, histórico, apartação, cadastro, manejo, saída, venda, abate | população explícita | falta período livre e lote |
| Agrupamentos | apartação, lote, tipo, motivo de saída, sexo, marca | dimensões 04 §2 | falta raça, era, sessão, comprador |
| `weighing.summary` (repositório) | total, soma, média, mínimo e máximo de `peso_kg > 0` | Peso total/médio | nulos são excluídos (correto) |

## 6. Regras de validação cronológica

**Origem:** `src/modules/weighing/infrastructure/weighingDataAdapter.js` (`validateAnimalChronology`) e `weighingMapper.js` (`validateUiPayload`)  
**Teste:** `verify-enterprise-hardening.mjs`, `verify-brazilian-format-contract.mjs`

- data civil válida, nunca futura (`isFutureCivilDate` usa a data local do computador);
- peso finito e > 0, exceto Saída por Morte, Doação ou Transferência;
- um único Cadastro por animal;
- nenhum evento anterior ao Cadastro;
- nenhum evento em data ≥ Saída definitiva;
- Saída retroativa recusada se houver eventos posteriores;
- duplicidade no mesmo dia: **só na UI** (`pesagensDia`), não no serviço — **D6:** a política de duplicidade (02 §4.4) precisa descer para o domínio na F1/F2.

## 7. Formatação e parsing brasileiro

**Origem:** `src/modules/weighing/domain/brazilianValues.js`, `src/components/common/formatNumber.js`  
**Teste:** `verify-brazilian-format-contract.mjs`

- `parseBrazilianNumber`: aceita `1.000,00`, `1,000.50`, `-10,50`; um único ponto seguido de 1–2 casas é decimal;
- `parseCivilDate`: aceita ISO `YYYY-MM-DD` e `DD/MM/AAAA`, valida bissexto, ano 1900–2200;
- apresentação: inteiro `1.000`, decimal `1.000,00`, moeda `R$ 1.000,00`, data `DD/MM/AAAA`; unidade só no rótulo.

## 8. Integridade e backup

- `logicalIntegrity` (`src/storage/indexedDb/health/health.js`): ids ausentes/duplicados por store, referências órfãs (animal, lote, embarque, documento, sessão), datas inválidas, identificador ativo duplicado entre animais, intervalos de lote inválidos;
- backup: SHA-256 do JSON sem o bloco `integrity`, manifesto com contagem por store, versão do banco e do app; restauração recusa banco mais novo e divergência de contagem.

## 9. Divergências a resolver (resumo)

| ID | Divergência | Fase | Impacto em dados |
|---|---|---|---|
| D1 | GMD `0` em vez de `null` quando `dias = 0` | F1 | nenhum (caso não ocorre) |
| D2 | Saída com peso não entra na série de ganho | ADR antes da F3 | recálculo se mudar |
| D3 | recálculo lê a base inteira a cada gravação | F1 | nenhum |
| D4 | rendimento inválido cai silenciosamente em 50 % | F6 | marcar origem do rendimento |
| D5 | não existe GMD ponderado; "média" é simples | F3 | nenhum |
| D6 | duplicidade do dia só na UI | F1/F2 | nenhum |
| D7 | apartação sem prioridade, versão nem explicação; ocupação por contagem O(N) | F1 (custo) / F4 (motor) | nenhum |
| D8 | `getRegisteredAnimals` ordena 12 mil animais com `localeCompare('pt-BR', { numeric: true })` criando um collator a cada comparação: 1,7 s dos 2,0 s da reconstrução do índice na massa de 36 mil (perfil de CPU). O gate `animal:history-integrity` não detecta porque sua massa já nasce ordenada. Reutilizar `Intl.Collator` e ordenar só na apresentação | F1 | nenhum |

---

<!-- docs/arquitetura-produto/F0-STATUS.md -->

# F0 — Contratos e baseline: status

**Data:** 08/09/2026  
**Aplicação:** 1.1.17 (esquema Dexie v6)  
**Referência:** [07-ROADMAP-E-CRITERIOS-DE-ACEITE.md](./07-ROADMAP-E-CRITERIOS-DE-ACEITE.md) §3

## 1. Entregas

| Entrega (07 §3) | Situação | Evidência |
|---|---|---|
| Aprovar este pacote documental | Em uso como fonte de verdade desde 08/09/2026 | `README.md` da raiz aponta para o pacote |
| Mapear campos atuais para o modelo-alvo | Concluída | [F0-01-MAPA-DE-CAMPOS.md](./F0-01-MAPA-DE-CAMPOS.md) |
| Catalogar fórmulas existentes | Concluída, com 7 divergências registradas (D1–D7) | [F0-02-CATALOGO-DE-FORMULAS.md](./F0-02-CATALOGO-DE-FORMULAS.md) |
| Massa de teste anônima: vazia, pequena, 36 mil e 250 mil | Concluída; determinística por semente, regenerável a qualquer momento | `src/modules/perf/testMass.js`, `npm run perf:testmass -- --mass=36k` |
| Medir p50/p95/p99 de busca, troca de campo e salvamento | Concluída em Node e no navegador (Chromium/IndexedDB real) | [../evidence/f0-baseline/BASELINE.md](../evidence/f0-baseline/BASELINE.md) |
| Capturas visuais das telas atuais | Concluída: 3 telas × claro/escuro, massa pequena, userData isolado | `docs/evidence/f0-baseline/screens/` |
| Definir marcas/modelos de equipamentos prioritários | **Pendente — decisão do responsável** (P-001, P-002) | [08-DECISOES-ARQUITETURAIS.md](./08-DECISOES-ARQUITETURAIS.md) |

## 2. O que o baseline mostrou

Números completos em `docs/evidence/f0-baseline/BASELINE.md`. Resumo (p95 em
milissegundos; "navegador" = Chromium com IndexedDB real, "Node" =
fake-indexeddb em memória):

| Massa | Runtime | Carga inicial | Índice de animais | Identificação → peso | Busca por animal | Salvamento local | Recarga após salvar |
|---|---|---|---|---|---|---|---|
| Pequena (300) | navegador | 37 | 152 | 0,3 | 7 | **138** | 226 |
| Pequena (300) | Node | 3 | 5 | 0,4 | 1,5 | 16 | 5 |
| 36 mil | navegador | 2 835 | 7 423 | 20 | 13 | **3 169** | 3 249 |
| 36 mil | Node | 354 | 4 622 | 8 | 1,8 | 4 980 | 1 693 |
| 250 mil | Node | 12 140 | 25 908 | 40 | 4,6 | 64 502 | 14 677 |

Orçamento: busca indexada e identificação → peso p95 < 100 ms (**dentro** em
todas as massas); salvamento local p95 < 250 ms (**dentro** só na massa
pequena; **fora** a partir de 36 mil). Leitura:

- **Busca indexada por animal** (Dexie, índice `animal_id`) fica dentro do
  orçamento (p95 < 100 ms) em todas as massas, inclusive 250 mil.
- **Identificação → peso** (índice em memória por número + histórico do animal
  + ganho/GMD) fica dentro do orçamento por operação. O custo escondido está na
  **reconstrução do índice** (`getRegisteredAnimals` + `buildAnimalLookupIndex`),
  que acontece a cada recarga da tela e cresce com a base: 2,0 s na massa de
  36 mil em Node, dos quais 1,7 s são a ordenação final com `localeCompare`
  `pt-BR` numérico (divergência D8). O gate existente não enxerga isso porque
  sua massa já nasce ordenada.
- **Salvamento local sai do orçamento a partir de 36 mil registros.** Causa
  localizada: `createEntry` chama `recalculateWeightSeriesForKeys`, que executa
  `listEntries()` sobre a base inteira (leitura + mapeamento de todos os
  registros) para recalcular a série de um único animal. Além disso a tela faz
  `loadAllData()` (nova leitura completa) depois de cada gravação.
- **Busca por período de 30 dias** usa índice, mas devolve milhares de linhas
  em bases grandes; a paginação da Relação já limita a renderização, não a
  consulta.
- No navegador real (IndexedDB em disco), a massa **pequena** já apresenta
  salvamento com p95 próximo de 230 ms; isso confirma que o orçamento de 250 ms
  precisa ser medido no runtime real, não só em memória.

Esses resultados fixam a prioridade da F1: PERF-002 (índice/cache de animais
ativos) e a correção do recálculo por animal (D3) sem varrer a base.

## 3. Aceite da F0 (07 §3)

| Critério | Resultado |
|---|---|
| Nenhuma ambiguidade de identidade, fórmula ou escopo P0 | Identidade e escopo fechados em F0-01 §10; fórmulas com divergências D1–D7 listadas e atribuídas a fases (D2 exige ADR antes da F3) |
| Baseline reproduzível em desenvolvimento e pacote instalado | Reproduzível em Node (`npm run perf:baseline`) e no navegador/Electron dev (`runBaseline` via `import('/src/modules/perf/baselineBench.js')`). **No pacote instalado ainda não foi executado**: exige o teste físico em máquina limpa do responsável (ver docs/user/TESTE-MAQUINA-LIMPA.md) |
| Decisão explícita sobre hardware inicial | **Pendente** (P-001 balança, P-002 leitor RFID) |

## 4. Como reproduzir

```powershell
npm run perf:contract:verify          # contrato do gerador e do bench (rápido)
npm run perf:baseline                 # vazia, pequena e 36 mil em Node
npm run perf:baseline:full            # inclui 250 mil (demorado; heap de 8 GB)
npm run evidence:screens              # capturas claro/escuro com massa pequena
```

No aplicativo em desenvolvimento (`npm run desktop:dev` ou navegador em
`http://localhost:5173`), no console:

```js
const m = await import('/src/modules/perf/baselineBench.js');
const r = await m.runBaseline({ massKey: '36k' });
console.log(m.formatReportTable(r));
await m.clearMass(); // apaga o banco de teste
```

Atenção: `runBaseline` e `seedMass` **apagam o banco IndexedDB da origem em
que rodam**. Nunca executar no aplicativo instalado com dados reais sem backup
validado.

## 5. Pendências herdadas encontradas durante a F0

- `npm run docs:user:verify` falha porque `package.json` está em 1.1.17 e não
  existe `docs/release/1.1.17/`. A F0 não cria notas de release; a pasta deve
  ser criada quando a versão for de fato preparada para distribuição.
- A store `lotes` existe no esquema mas a interface usa `loteApartacoes`
  (F0-01 §6). Decidir reaproveitamento ou remoção por ADR antes da F2.
- `npm run main:boot:verify` falhava porque o stub do Electron em Node não
  definia `process.resourcesPath` (usado pelo caminho do ícone empacotado em
  `electron/main.cjs`). Corrigido no próprio stub; `test:quick` integral
  (19 gates) aprovado em 08/09/2026.

## 6. Próximo passo

Iniciar a **F1 — Desempenho e confiabilidade** com PERF-002 e a correção do
recálculo por animal, usando este baseline como comparação obrigatória
(ADR-017). Em paralelo, o responsável decide P-001/P-002 para destravar a F5.

---

<!-- docs/arquitetura-produto/F1-STATUS.md -->

# F1 — Desempenho e confiabilidade: status parcial

**Data:** 08/09/2026  
**Aplicação:** 1.1.17 (Dexie v6)  
**Referência:** [07-ROADMAP-E-CRITERIOS-DE-ACEITE.md](./07-ROADMAP-E-CRITERIOS-DE-ACEITE.md) §4

## Resultado desta iteração

A primeira fatia da F1 removeu o bloqueio no salvamento do fluxo operacional e
consolidou a organização visual do formulário segundo o protótipo
`Lançamento de Pesagens v2.dc.html`. Regras de negócio, identidade do animal e
política cronológica foram preservadas.

## Alterações concluídas

- recálculo de ganho/GMD consulta somente a série indexada por `animal_id`;
- inserção cronológica normal calcula os campos derivados antes da gravação e
  não regrava o histórico inteiro;
- inserção retroativa continua recalculando os lançamentos posteriores;
- atualização após Salvar substitui somente a série do animal no estado da
  tela, sem executar `loadAllData()` sobre toda a base;
- atualizações derivadas usam a chave primária local já conhecida;
- o formulário passou a ter contrato visual canônico do v2: barra de 36 px,
  controles de 28 px, raio de 8 px, grade de nove colunas no Cadastro, grade
  fluida de cinco campos em Manejo/Saída, espaçamento interno de 6 px e margem
  externa de 8/10 px;
- o mesmo contrato foi conferido nos temas claro e escuro.

## Comparação obrigatória de desempenho

Massa de 36 mil pesagens, Node + fake-indexeddb, dez salvamentos:

| Métrica p95 | F0 | F1 atual | Orçamento | Resultado |
|---|---:|---:|---:|---|
| Busca indexada por animal | 1,8 ms | 0,238 ms | < 100 ms | Dentro |
| Identificação → peso | 8 ms | 2,848 ms | < 100 ms | Dentro |
| Salvamento local | 4.980 ms | **76,334 ms** | < 250 ms | Dentro |

Evidência integral:
[docs/evidence/f1-optimized-final/BASELINE.md](../evidence/f1-optimized-final/BASELINE.md).

O ganho medido no salvamento foi de aproximadamente 65 vezes em relação ao
baseline Node da F0. O baseline do navegador da F0 era 3.169 ms; uma nova
rodada volumosa no Chromium ainda será registrada para comparar runtimes
equivalentes.

## Gates executados

- `npm run test:quick`: aprovado integralmente;
- `npm run build`: aprovado;
- recálculo retroativo: aprovado por `enterprise:hardening:verify`;
- histórico, número repetido por marca, formato brasileiro, importação,
  persistência offline e smoke do Electron: aprovados;
- inspeção visual em 1280 × 720, claro/escuro: aprovada para a composição dos
  campos do v2.

## Pendências para concluir a F1

- substituir a reconstrução de `getRegisteredAnimals(pesagens)` por projeção ou
  cache incremental de animais ativos;
- atualizar resumos da tela sem percorrer toda a lista;
- medir e decidir paginação/virtualização com a massa de 250 mil;
- repetir o benchmark de 36 mil e 250 mil no IndexedDB real do Chromium;
- validar escalas Windows adicionais e registrar capturas formais;
- executar o roteiro de aceite humano e o pacote instalado.

Até essas pendências serem comprovadas, a F1 permanece **em andamento**.

---

<!-- docs/engineering/AUTH-THREAT-MODEL.md -->

# Modelo de ameaças da autenticação local — Pesagens Individuais

**Escrito em 1.1.18 (14/09/2026) para o login local previsto em 1.2.0.** Base normativa: ADR-041 a
ADR-046 e o contrato `docs/arquitetura-produto/11-AUTENTICACAO-LOCAL.md` (revisão 2). Este documento
diz, sem rodeios, o que o login local protege e o que ele **não** protege, para que ninguém compre
uma garantia que o produto não dá.

> Estado em 1.1.18: **não existe login**. O app abre direto na tela principal, não há usuários,
> papéis nem auditoria por usuário. Tudo abaixo descreve o desenho decidido para 1.2.0.

## 1. O que o app é

- Aplicativo desktop Electron, 100 % offline, um computador por instalação.
- Dados em IndexedDB (Dexie) dentro do perfil do usuário do Windows (`userData`), em texto claro.
- Backups em JSON legível, gravados onde o usuário escolher.
- Não há servidor, conta online, sincronização, e-mail, SMS ou provedor de identidade.

Consequência direta: **a fronteira de segurança real é a conta do Windows e o disco.** Quem entra
no perfil do sistema operacional que roda o app tem, na prática, acesso a todos os dados.

## 2. Objetivo do login local (o que ele entrega)

| Objetivo | Como |
|---|---|
| Saber **quem** fez cada operação | auditoria com `usuario_id` e `usuario_nome_snapshot`; eventos de acesso resumidos |
| Impedir uso **acidental ou não autorizado dentro do app** | papéis fixos ADMIN, GESTOR, OPERADOR e CONSULTA; `authorize(action)` no serviço antes de gravar; a UI apenas esconde |
| Proteger operações destrutivas | restore total, limpeza, reset, migração e gestão de usuários só para ADMIN |
| Evitar sessão esquecida no curral | bloqueio automático por inatividade (padrão 30 min), Bloquear, Trocar usuário, Sair |
| Não guardar senha em lugar nenhum | apenas hash PBKDF2-HMAC-SHA-256 com salt aleatório por usuário (Web Crypto, sem módulo nativo) |
| Recuperar o ADMIN sem backdoor | Recovery Key aleatória exibida uma única vez no bootstrap; o banco guarda só o verificador (hash + salt) |

É um controle de **uso responsável e rastreabilidade** entre pessoas que compartilham o mesmo
computador de trabalho. Não é um cofre.

## 3. Ameaças cobertas

| Ameaça | Cobertura |
|---|---|
| Operador lança, edita ou apaga algo que não deveria | papéis + `authorize` no serviço; auditoria registra o autor |
| Alguém usa a sessão aberta de outra pessoa | bloqueio por inatividade; Bloquear/Trocar usuário; sessão só em memória (sessionStorage apenas para recarga técnica do renderer; nunca sobrevive ao fechamento) |
| Tentativa de adivinhar senha pela tela de login | contagem de falhas persistida, bloqueio temporário (`failed_login_count`, `locked_until`), erro genérico sem dizer se o login existe |
| Leitura **casual** do banco ou de um backup por alguém curioso | a senha não está lá; só hash + salt; PBKDF2 com custo calibrado torna a recuperação por força bruta lenta para senhas razoáveis |
| Senha trivial | mínimo de 6 caracteres e lista de senhas triviais recusadas; `admin/admin` impossível; senha temporária obriga troca |
| Segredo vazando por log, CSV, diagnóstico ou auditoria | regra de código e gates: senha, hash, salt, recovery key e tokens nunca são gravados nesses canais |
| Perda do único ADMIN | Recovery Key; regra de não desativar o último ADMIN ativo |
| Restore trazendo usuários de outra instalação | restore exige `maintenance.restore` e encerra a sessão; backup sem usuários cai no bootstrap |

## 4. Ameaças NÃO cobertas (ler com atenção)

1. **Quem tem acesso total ao perfil do Windows ou ao disco.** Pode ler o IndexedDB, copiar ou
   editar os dados, apagar a store de usuários, trocar o hash do ADMIN ou substituir o próprio
   aplicativo. O login não impede nada disso. **Não há criptografia total do banco.**
2. **Administrador local da máquina, malware, acesso físico sem BitLocker.** Idem.
3. **Backup JSON em pen drive, e-mail ou pasta compartilhada.** O backup contém todos os dados
   em texto claro (mais hash + salt dos usuários). Quem tem o arquivo tem os dados. Proteger o
   arquivo é responsabilidade de quem o guarda (pasta com permissão, disco cifrado).
4. **Força bruta offline contra um hash copiado, com senha fraca.** PBKDF2 encarece, não
   impede. Uma senha de 6 caracteres previsível pode ser recuperada por quem tem o hash e
   tempo. A política mínima é deliberadamente simples para o curral; senhas melhores ficam a
   critério do ADMIN.
5. **Captura de tela, keylogger, câmera sobre o teclado, alguém olhando a Recovery Key.**
6. **Recovery Key perdida e ADMIN esquecido.** Sem servidor não existe "esqueci minha senha" por
   e-mail. O caminho é restaurar um backup com usuários válidos ou reiniciar o bootstrap por
   procedimento de manutenção documentado (com perda dos usuários, nunca dos dados operacionais).
7. **Adulteração da auditoria.** Quem edita o IndexedDB pode editar a auditoria. A auditoria é
   evidência operacional, não prova forense.
8. **Múltiplas máquinas.** Usuários são locais a cada instalação; não há identidade central,
   sincronização de papéis nem revogação remota.

## 5. Decisões de desenho e por quê

| Decisão | Motivo |
|---|---|
| Sem criptografia do banco | o app precisa abrir sem senha de disco, funcionar com o Dexie padrão e permitir backup/restore/integridade simples; a fronteira real já é o perfil do SO; cifrar exigiria chave em algum lugar do mesmo perfil, o que não muda a ameaça 1 |
| PBKDF2-HMAC-SHA-256 via Web Crypto | disponível no renderer e no Node dos gates, sem módulo nativo (o instalador N-API já deu problema com antivírus); parâmetros centralizados e versionados (`password_version`) permitem recalibrar com rehash no próximo login |
| Salt de 16 bytes aleatório por usuário | dois usuários com a mesma senha têm hashes diferentes; tabelas prontas não servem |
| Sessão em memória, sem `localStorage` | fechar o app encerra a sessão; nada de token persistente para roubar |
| Recovery Key só como verificador | a key nunca fica no banco; se vazar o banco, a key não vaza |
| Bloqueio temporário curto (segundos) e persistido | desestimula tentativa manual sem trancar o curral por horas; reiniciar o app não zera o contador |
| Papéis fixos, sem permissões por usuário | matriz pequena, testável por gate, sem tela de permissões para errar |
| Senha mínima de 6 caracteres | pessoas do curral com luvas e pressa; regras artificiais geram senhas em papel colado no monitor |

## 6. Fora do escopo (não prometido)

- Autenticação online, OIDC, Active Directory, SSO, MFA, biometria, cartão.
- Criptografia do banco ou de backups; assinatura digital de backups.
- Auditoria imutável, WORM ou carimbo de tempo externo.
- Gestão centralizada de usuários entre máquinas.
- Proteção contra administrador local, malware ou acesso físico.

Qualquer um desses itens exige nova ADR, não um "ajuste".

## 7. Obrigações de implementação (checagem em 1.2.0)

- Gates `auth:crypto:verify`, `auth:bootstrap:verify`, `auth:permissions:verify`,
  `auth:recovery:verify` e `audit:actor:verify` (documento 11 §10).
- Nenhuma tela de dados montada antes da autenticação; nenhum `if (role === …)` espalhado.
- Copiar diagnóstico mostra o papel do usuário, nunca hash, salt ou key.
- Documentação do usuário explica, em uma frase, que o login organiza o uso e a auditoria e que
  a proteção dos dados depende da conta do Windows e do disco.

---

<!-- docs/engineering/RELEASE-POLICY.md -->

# Política de release — Pesagens Individuais

**Vigente desde 1.1.18 (14/09/2026).** Base normativa: ADR-039, ADR-047 e ADR-048; contrato
`docs/arquitetura-produto/13-VERSIONAMENTO-RELEASE.md` §4. Complementa
`docs/engineering/VERSIONING.md`. Vale para todo marco do programa 1.1.18 → 1.6.0.

## 1. Princípios

1. **Build limpo.** Nenhum artefato de release é reaproveitado entre versões: `release:clean`
   remove Setups e `win-unpacked` de versões antigas antes de `build` e do electron-builder.
2. **Um pacote, uma versão.** `release/` e `release-unsigned/` só podem conter o Setup da versão
   atual; `release:current-only:verify` e `release:version-contract:verify` falham se houver
   qualquer artefato de outra versão. Um `.exe` antigo nunca é declarado "current".
3. **Prova antes de tag.** Tag `vX.Y.Z` só depois de todos os gates da release verdes.
4. **Nada remoto sem autorização.** Nenhum push, publicação, upload ou release remota sem
   autorização explícita do responsável. Tags são locais até essa autorização.
5. **Honestidade de evidência.** Teste físico (máquina limpa, balança, RFID) só é declarado
   EXECUTADO com evidência humana (quem, quando, resultado). Caso contrário, o checklist diz
   NÃO EXECUTADO.

## 2. Pastas de saída

| Pasta | Conteúdo | Status |
|---|---|---|
| `release/` | Setup assinado com Authenticode (`npm run dist`) | única distribuição oficial |
| `release-unsigned/` | Setup sem assinatura (`npm run dist:unsigned`), com checksum e manifesto `distribution: unsigned-diagnostic` | diagnóstico local; pode ser bloqueado por Defender/SmartScreen/WDAC e **não** é release oficial |
| `docs/release/<versão>/` | notas, checklist, `MIGRATION-*.md` quando aplicável | documentação versionada (rastreada no git) |

Ambas as pastas de artefatos são ignoradas pelo git (`/release/`, `/release-unsigned/`, ancoradas
na raiz). `docs/release/` é rastreada.

## 3. Assinatura

- `signed` no manifesto é **sempre `false` até existir certificado Authenticode válido** e o
  gate `release:signature:verify` confirmar a assinatura do Setup. O gerador do manifesto não
  aceita override desse campo.
- Enquanto não houver certificado, `npm run dist` é bloqueado pelo preflight de credenciais
  (`release:signing:preflight`) e o único pacote possível é o de diagnóstico em `release-unsigned/`.
- Nunca orientar o usuário a desativar Defender, SmartScreen, WDAC ou App Control.

## 4. Sequência obrigatória de uma release

```text
 1. package.json + package-lock.json + fallback de appVersion.js na versão nova
 2. CHANGELOG consolidado: "## [X.Y.Z] — AAAA-MM-DD" (sem blocos "Não lançado")
 3. docs/release/X.Y.Z/RELEASE-NOTES.md + RELEASE-CHECKLIST.md (+ MIGRATION-*.md se esquema mudou)
 4. docs/user atualizado; npm run docs:user:verify
 5. npm run test:quick  (lint, release:current-only, release:version-contract, gates de contrato)
 6. npm run release:clean → npm run build → electron-builder
      assinado:      npm run dist           → release/
      sem certificado: npm run dist:unsigned → release-unsigned/  (signed=false)
 7. gates de pacote: packaged:source:verify, packaged:ui-build:verify
      (versão do package.json = app.asar = manifesto; UI_BUILD_ID no bundle e no asar;
       Setup não anterior aos bundles; nome "Pesagens Individuais Setup X.Y.Z.exe")
 8. release:checksum (.sha256) e release:manifest (release-manifest.json, versão 2)
 9. e2e instalado (e2e:installed:verify / diagnostic:e2e:verify)
10. teste físico: EXECUTADO só com evidência humana; senão NÃO EXECUTADO no checklist
11. evidência em docs/evidence/<slice>/ (REPORT, FILES-CHANGED, TESTS, RISKS, ROLLBACK, …)
12. commit da release; tag local vX.Y.Z após o gate
13. publicação remota: somente com autorização explícita
```

Um marco que não gera instalador (caso de 1.1.18) executa 1–5 e 11–12, registra
"instalador: não gerado neste marco" nas notas e no checklist e deixa os passos 6–10 como
pendentes explícitos.

## 5. Checksum e manifesto

- `release:checksum` grava `<Setup>.sha256` ao lado do instalador.
- `release:manifest` grava `release-manifest.json` (formato 2, ver `VERSIONING.md` §4) e em
  seguida roda `packaged:ui-build:verify`. O manifesto inclui SHA-256, tamanho e `builtAt`
  (mtime) do Setup, `gitCommit` e `buildTimestamp`; com git indisponível, `gitCommit` é `null`.
- Quem instala confere o SHA-256 publicado com o do arquivo recebido antes de executar.

## 6. Gates e o que cada um protege

| Gate | Protege |
|---|---|
| `release:current-only:verify` | nenhum Setup/`win-unpacked` de outra versão nas pastas de saída |
| `release:version-contract:verify` | uma só versão em package/lock/fallback/notas/CHANGELOG/manifesto; `RELEASE_MANIFEST_VERSION` único |
| `docs:user:verify` | documentação do usuário e da release presente e não vazia |
| `packaged:source:verify` / `packaged:ui-build:verify` | o pacote contém exatamente a árvore e o bundle da versão |
| `release:signature:verify` | assinatura Authenticode do Setup (release oficial) |
| `e2e:installed:verify` | app instalado abre, cria dados, faz backup e restaura |

Gates nunca são afrouxados para passar. Se um gate falha por mudança legítima de contrato, o
gate é atualizado para o contrato real e a mudança é registrada na evidência (exemplo: S-00.0).

## 7. Rollback

- Rollback de código: `git checkout vX.Y.Z-anterior` (ou revert dos commits do marco). Cada marco
  deixa tag, CHANGELOG e evidência coerentes para `git bisect`.
- Rollback de dados: só é necessário quando o esquema mudou. A migração cria backup físico
  pré-migração validado (documento 14); o formato de backup anterior continua restaurável pela
  versão anterior do app. Em 1.1.18 não há migração, logo o rollback é apenas de código.
- Um Setup de versão anterior pode ser reinstalado por cima; os dados ficam em `userData`, fora
  da pasta do programa.

## 8. Fora da política

Não fazem parte de release: pacotes portáteis, atualização automática, canal de pré-lançamento,
telemetria e publicação em lojas. Qualquer um desses itens exigirá nova ADR.

---

<!-- docs/engineering/VERSIONING.md -->

# Versionamento — Pesagens Individuais

**Vigente desde 1.1.18 (14/09/2026).** Base normativa: ADR-037, ADR-039, ADR-047 e ADR-048
(`docs/arquitetura-produto/08-DECISOES-ARQUITETURAIS.md`) e o contrato
`docs/arquitetura-produto/13-VERSIONAMENTO-RELEASE.md` (revisão 2). Este documento explica, em
linguagem de engenharia, como os números são usados no código e nos gates. Onde houver diferença,
as ADRs prevalecem.

## 1. Quatro eixos que nunca se confundem

| Eixo | Constante | Onde vive (fonte única) | Valor em 1.1.18 | Quando muda |
|---|---|---|---|---|
| Versão do aplicativo | `APP_VERSION` | `package.json` → Vite injeta `__APP_VERSION__`; fallback literal em `src/lib/appVersion.js`; Electron lê `app.getVersion()` do mesmo `package.json` | 1.1.18 | a cada release (SemVer, §2) |
| Esquema do banco | `DB_SCHEMA_VERSION` (= `DB_VERSION`) | `src/storage/indexedDb/schema.js` | 6 | só com migração testada e backup físico prévio (documento 14) |
| Formato do backup | `BACKUP_FORMAT_VERSION` | `src/versioning/versionInfo.js` (o módulo de backup importa daqui) | 2 | quando o JSON de backup ganha/perde campos ou stores; o formato anterior continua restaurável |
| Formato do manifesto de release | `RELEASE_MANIFEST_VERSION` | `scripts/generate-release-manifest.mjs` (dono); `versionInfo.js` reexporta o mesmo valor para a UI | 2 | quando `release-manifest.json` ganha/perde campos |

Os quatro números são independentes. Uma release PATCH pode subir o app sem tocar no esquema; uma
release MINOR pode subir esquema e formato de backup ao mesmo tempo; o manifesto muda por razões
de ferramenta, não de produto. O gate `release:version-contract:verify` prova que
`RELEASE_MANIFEST_VERSION` é o mesmo no gerador e em `versionInfo.js`.

`src/versioning/versionInfo.js` reúne tudo em `describeVersions()`:

```js
{
  app, dbSchema, backupFormat, releaseManifest,
  uiContract, dataContract, uiBuildId, dataBuildId, uiModel, uiVersion,
  gitCommit, buildTimestamp
}
```

## 2. SemVer do aplicativo

| Parte | Regra | Exemplos |
|---|---|---|
| **PATCH** (1.1.17 → 1.1.18) | correção, refatoração, documentação, gates, marcadores de build; **nenhum** contrato persistente muda (esquema, formato de backup, export/import, IPC) | 1.1.18: contrato de versão, gate novo, docs de engenharia, correção de dois gates |
| **MINOR** (1.1.x → 1.2.0) | funcionalidade nova; store nova; migração de esquema **compatível** (backup anterior continua restaurável; dados existentes preservados por backfill) | 1.2.0: Dexie v7, usuários, cadastros mestres, backup formato 3 |
| **MAJOR** (1.x → 2.0) | quebra deliberada de backup, export/import ou API local; exige plano de conversão documentado | ainda não previsto no roadmap |

Regras práticas:

- Toda versão nasce de `package.json` e `package-lock.json` sincronizados (`version` e
  `packages[""].version`). O fallback de `src/lib/appVersion.js` acompanha para que gates Node e
  ferramentas de migração vejam a mesma versão sem o bundler.
- Nunca reutilizar um número: se 1.1.18 foi taggeada e algo precisa mudar, nasce 1.1.19.
- Pré-release (`1.2.0-rc.1`) só se houver distribuição de candidato; hoje não há.

## 3. Marcadores de build (não são versões)

| Marcador | Onde | Uso |
|---|---|---|
| `UI_BUILD_ID`, `UI_MODEL`, `UI_VERSION` | `src/components/modelobase1/uiBuildInfo.js` (dono: agente de UI) | prova que o bundle empacotado é o mesmo da árvore (`packaged:ui-build:verify`) |
| `UI_CONTRACT_VERSION` | `versionInfo.js` (`ModeloBase1-R34` em 1.1.18) | identifica o contrato visual protegido por `ui:consistency:verify` |
| `DATA_CONTRACT_VERSION` | `versionInfo.js` (1 em 1.1.18) | identifica o contrato de campos/fórmulas (documento 12 passa a 2 em 1.2.0) |
| `DATA_BUILD_ID` | `versionInfo.js` (`schema-v6`) | rótulo derivado do esquema, para logs e manifesto |
| `gitCommit`, `buildTimestamp` | `__BUILD_INFO__` injetado por `vite.config.js` (`git rev-parse --short HEAD`, ISO do build); em Node ficam `null` | exibidos em Manutenção › Status › Versões e no manifesto |

Marcadores mudam sem SemVer e sem migração; servem para responder "que build é este?".

## 4. Onde cada número aparece

| Lugar | Conteúdo |
|---|---|
| Sistema › Backup e Manutenção › Status do banco › **Versões** | Aplicativo, Esquema do banco, Formato do backup, Manifesto, Build (commit · data), Contrato UI/dados |
| Botão **Copiar diagnóstico** | os mesmos campos, em texto, mais estatísticas e caminho do log |
| `release-manifest.json` | `releaseManifestVersion, productName, appVersion, version, dbSchemaVersion, backupFormatVersion, uiBuildId, dataBuildId, uiContract, dataContract, gitCommit, buildTimestamp, platform, arch, installer{file,sha256,sizeBytes,builtAt}, signed, distribution, features` |
| Backup JSON (`manifest`) | `appVersion`, `dbVersion`, `formatVersion` (= `BACKUP_FORMAT_VERSION`) |
| `CHANGELOG.md` | um bloco `## [X.Y.Z] — AAAA-MM-DD` por versão, seções Added / Changed / Fixed / Removed / Migration / Security |
| `docs/release/<versão>/` | `RELEASE-NOTES.md`, `RELEASE-CHECKLIST.md` (e `MIGRATION-*.md` quando o esquema muda) |

## 5. Gate `release:version-contract:verify`

`scripts/verify-version-contract.mjs` (em `test:quick` e `test:full`, logo após
`release:current-only:verify`) falha se:

- `package.json`, `package-lock.json` (`version` e `packages[""].version`) ou o fallback de
  `appVersion.js` divergirem;
- `docs/release/<versão>/RELEASE-NOTES.md` ou `RELEASE-CHECKLIST.md` faltarem ou não citarem a versão;
- `CHANGELOG.md` não tiver `## [<versão>] — AAAA-MM-DD` com data ISO real, ou ainda tiver bloco
  "Não lançado";
- `release/` ou `release-unsigned/` tiverem `release-manifest.json` de outra versão ou um Setup de
  outra versão (artefato antigo nunca é "current"; pastas ausentes são aceitas);
- `RELEASE_MANIFEST_VERSION` divergir entre gerador e `versionInfo.js`.

`node scripts/verify-version-contract.mjs --self-test` prova o próprio gate com fixtures positivas e
negativas em pasta temporária.

## 6. Marcos do programa (ADR-047)

| Marco | App | Esquema | Backup | Manifesto | Conteúdo |
|---|---|---|---|---|---|
| **1.1.18** | 1.1.18 | 6 | 2 | 2 | baseline verde, contrato de versão, ADRs 041–048, docs de engenharia, gate `release:version-contract`; **sem esquema novo** |
| 1.2.0 | 1.2.0 | 7 | 3 | 2 | usuários e login local, cadastros mestres, preflight/backfill, Lançamento seleciona cadastros |
| 1.3.0 | 1.3.0 | 7 | 3 | 2 | faixas/exceções de identificadores, resolução indexada, tela Faixas |
| 1.4.0 | 1.4.0 | 7 | 3 | 2 | lançamento enxuto, Apartações/Lotes, contexto de sessão |
| 1.5.0 | 1.5.0 | 8 | 3 | 2 | operações comerciais, embarques com estados, relatórios mínimos |
| 1.6.0 | 1.6.0 | 8 | 3 | 2 | sessão real, fechamento, Animais/ficha, auditoria consolidada |

Valores de esquema/backup dos marcos futuros são os previstos no documento 13; só valem quando o
respectivo marco for taggeado com gates verdes. Cada marco deixa `package.json`, CHANGELOG,
`docs/release/<versão>/` e `docs/evidence/<slice>/` coerentes para rollback e `git bisect`.

## 7. Como subir a versão (passo a passo)

1. Decidir PATCH/MINOR/MAJOR pela tabela do §2.
2. Editar `package.json`, `package-lock.json` (dois campos) e o fallback de `src/lib/appVersion.js`.
3. Se o esquema mudar: `DB_VERSION` em `schema.js`, `BACKUP_FORMAT_VERSION` em `versionInfo.js`,
   `DATA_CONTRACT_VERSION`, migração conforme documento 14 e `MIGRATION-*.md` na pasta da release.
4. Consolidar o CHANGELOG no bloco da versão com a data real.
5. Criar `docs/release/<versão>/RELEASE-NOTES.md` e `RELEASE-CHECKLIST.md`; atualizar `docs/user`.
6. `npm run test:quick` (inclui o gate de versão) e `npm run build`.
7. Seguir `docs/engineering/RELEASE-POLICY.md` para pacote, checksum, manifesto e tag.

---

<!-- docs/evidence/program-2.0/phase-00/EXECUTION-REPORT.md -->

# Programa Pesagens Individuais 2.0 — Fase 0: baseline e governança

**Data:** 14/09/2026 · **Base:** 1.1.17 / Dexie v6 · **Branch:** `program/2.0`

## 1. Entregas

| Item (programa §22) | Resultado | Evidência |
|---|---|---|
| Ler a Auditoria Master | lida integralmente (45 documentos) | `docs/evidence/auditoria-master-produto-pecuario/` |
| Estado real do workspace | sem Git; 1.1.17; `release-unsigned/` com Setup 1.1.17; `.tmp/formulario-escopo` (designs); `data/` legado ignorado | `.gitignore` |
| Inicializar Git | `git init`, `main`, `.gitignore`, commit `77eeb3b` "chore: baseline before professional product migration", tag `v1.1.17-baseline` (671 arquivos) | `git log`, `git tag` |
| lint / build | verdes (11 s / 22 s) | `GATES.md` |
| Gates individuais | 28 verificações: 26 verdes, 2 vermelhos conhecidos | `GATES.md` §1 |
| Correção dos dois gates | contrato real validado (registry selecionado no Lançamento; estrutura do segmento Registro/Tabela); commit `8c79022` | `GATES.md` §2 |
| `test:quick` | **20/20 verde** | `GATES.md` §3 |
| Medições | payload, auditoria, 36k e 250k em Node, 36k no Chromium | `PERFORMANCE.md` |
| ADRs | ADR-018…ADR-040 (22 decisões + login local, RBAC, versionamento, migrações, release, Git) — commit `39a2071` | `docs/arquitetura-produto/08-DECISOES-ARQUITETURAIS.md` |
| Contratos da Fase 1 | documentos 10–14 (produto 2.0, autenticação local, dados v7/v8, versionamento/release, migrações) — commit `e4d4278` | `docs/arquitetura-produto/` |
| Esquema v7 (estrutura) | `schema.js`/`db.js` com STORES_V7, remoção de `lotes`, gates de storage verdes — commit `986c502` | `12-MODELO-DADOS-V7-V8.md` |

## 2. Commits da fase

```
77eeb3b chore: baseline before professional product migration            (main, tag v1.1.17-baseline)
8c79022 test(gates): align operational-customization and ui-consistency … (program/2.0)
39a2071 docs(adr): register ADR-018..ADR-040 …
c2a1a06 test(perf): add legacy_payload and audit size measurement
e4d4278 docs(program): phase 0 contracts … and gate/perf evidence
986c502 feat(storage): introduce Dexie v7 schema (structure only)
```

## 3. Decisão de governança aplicada

`main` guarda o baseline; todo o programa acontece em `program/2.0` (ADR-040). Agentes trabalham em áreas disjuntas na mesma árvore; arquivos compartilhados pertencem ao coordenador; commits são sequenciais e semânticos.

## 4. Riscos observados

- O trabalho paralelo de 14/09 deixou gates vermelhos por desalinhamento entre gate e código; a regra "gate valida contrato real" foi aplicada e registrada.
- A reconstrução do índice de animais na tela ainda custa 0,9 s no Chromium (36 mil) e 15,5 s em Node (250 mil): a Fase 2 resolve pela leitura por identificadores (ADR-034).
- `salvamento_local` está dentro do orçamento em 36 mil (Node 198 ms; Chromium 19 ms) e fora em 250 mil (Node 1,4 s): medir no Chromium na Fase 2 antes de decidir paginação/virtualização.

## 5. Próxima fase

Fase 1 (release 1.2.0): login local, usuários/RBAC, Dexie v7 completo (migration coordinator, backfill, backup v3), cadastros mestres com telas ModeloBase1, sanidade removida, versionamento, instalador 1.2.0.

---

<!-- docs/evidence/program-2.0/phase-00/GATES.md -->

# Fase 0 — Gates: baseline individual e correção

**Data:** 14/09/2026 · **Branch:** `program/2.0` (a partir de `v1.1.17-baseline`) · **Aplicação:** 1.1.17 · **Dexie:** v6

## 1. Baseline individual (antes de qualquer correção)

Cada script executado isoladamente (`npm.cmd run <gate>`), em sequência, na árvore da tag `v1.1.17-baseline`.

| Gate | Exit | s | Situação |
|---|---|---|---|
| lint | 0 | 11 | verde |
| build | 0 | 22 | verde (`vite build`) |
| release:current-only:verify | 0 | 1 | verde |
| runtime:legacy:verify | 0 | 1 | verde |
| ui:locale-dialog:verify | 0 | 1 | verde |
| **ui:operational-customization:verify** | **1** | 1 | **vermelho** — `AssertionError: venda e abate devem abrir cadastro em diálogo` (esperava `GerenciarSaidasDialog` no Lançamento; o código já não o usa) |
| animal:history-integrity:verify | 0 | 2 | verde |
| import:selection:verify | 0 | 1 | verde |
| ui:scrollbar-contract:verify | 0 | 1 | verde |
| **ui:consistency:verify** | **1** | 1 | **vermelho** — `AssertionError: alternância Registro/Tabela reutiliza a estrutura segmentada oficial` (regex exigia template literal `className={\`view-seg aux-view-seg` e rótulos literais; o código usa `className="view-seg aux-view-seg"` e rótulos gerados de `VIEW_MODES`) |
| weighing:calculations:verify | 0 | 1 | verde |
| perf:contract:verify | 0 | 2 | verde |
| enterprise:hardening:verify | 0 | 2 | verde |
| main:boot:verify | 0 | 2 | verde |
| preload:contract:verify | 0 | 1 | verde |
| storage:dexie:verify | 0 | 1 | verde |
| storage:first-run:verify | 0 | 2 | verde |
| storage:ui-first-run-persistence:verify | 0 | 1 | verde |
| storage:maintenance-ui-flow:verify | 0 | 1 | verde |
| storage:legacy-detached:verify | 0 | 2 | verde |
| desktop:smoke:verify | 0 | 1 | verde |
| storage:backup:verify | 0 | 2 | verde |
| storage:import-restore:verify | 0 | 1 | verde |
| storage:ui-contract:verify | 0 | 2 | verde |
| weighing:mapper:verify | 0 | 1 | verde |
| maintenance:ui:verify | 0 | 1 | verde |
| maintenance:dialog:verify | 0 | 2 | verde |
| docs:user:verify | 0 | 1 | verde |

Resultado: 26 verdes, 2 vermelhos (os dois já conhecidos, introduzidos pelo trabalho paralelo de 14/09). Gates não executados individualmente: `e2e:installed:verify` (exige pacote instalado) e `packaged:*` (exigem release).

## 2. Correções (commit `8c79022`)

Regra aplicada: o gate valida o **contrato real** do código, nunca é ajustado apenas para passar.

### ui:operational-customization

- Antes: exigia `GerenciarSaidasDialog` no Lançamento e testava a persistência da chave legada `perfis-saida`.
- Depois: afirma que o popup legado **não** está no Lançamento; que compradores, vendedores e frigoríficos são carregados do registry (`loadRegistryGroup('comerciais'`) e **selecionados** (`auxiliaryCatalogs.* → <SelectItem>`), não digitados; e que o registry (`cadastros-auxiliares:comerciais:<empresa>`) persiste após reabrir o banco. As demais asserções (resumos configuráveis, operações do resumo, foco suave, tabela gerencial) permanecem.
- Observação: `registryService.js` usa o alias `@/` e não é importável em Node; o gate grava a mesma chave/shape pelo `settingsService`.
- Este gate será substituído por `launch:contract:verify` na Fase 2 (Lançamento enxuto), conforme ADR-031/ADR-034.

### ui:consistency

- Antes: uma única regex acoplada à sintaxe (`className={\`…`, rótulos literais).
- Depois: quatro asserções estruturais — `.view-seg aux-view-seg` com `role="group"` e `aria-label="Modo de visualização"`; slider `view-seg-slider aux-view-seg__slider`; `VIEW_MODES` declara `registro` e `tabela`; cada modo expõe `aria-label={\`Visualizar ${view.title…`.

## 3. Resultado após a correção

`npm.cmd run test:quick` → **exit 0**, 20/20 verificações verdes:

```
lint · release:current-only · runtime:legacy · ui:locale-dialog · ui:operational-customization ·
animal:history-integrity · import:selection · ui:scrollbar-contract · ui:consistency ·
weighing:calculations · perf:contract · enterprise:hardening · main:boot · preload:contract ·
storage:dexie · storage:first-run · storage:ui-first-run-persistence · storage:maintenance-ui-flow ·
storage:legacy-detached · desktop:smoke
```

Log integral: `phase0-gates.log` e `phase0-testquick.log` (scratch da sessão); o resumo acima é a evidência permanente.

---

<!-- docs/evidence/program-2.0/phase-00/PERFORMANCE.md -->

# Fase 0 — Medições

**14/09/2026 · commit `986c502` (runtime da F1 + esquema v7 estrutural) · `saves=10`, `samples=200` · seed 20260908**

## 1. Tamanho do `legacy_payload` e da auditoria (massa 36 mil, Node)

| Medida | Valor |
|---|---|
| Linhas em `pesagens` | 36 000 |
| Bytes por linha (JSON) — média / p95 | 1 136 / 1 140 |
| Bytes do `legacy_payload` — média / p95 | 723 / 728 |
| Participação do payload na linha | **63,7 %** |
| Chaves no payload | 28 (constante) |
| Uma edição via `weighingService.updateEntry` | payload passa de 28 para **29 chaves** (`peso_kg` copiado do view model), 725 → 753 B |
| Auditoria gerada por uma edição | 1 linha de **2 550 B** (antes/depois completos = 2,2× a linha) |

Fonte: `payload-size-36k.json` (`scripts/measure-payload-size.mjs`). Confirma ADR-027 (congelar + lista permitida) e a mudança da auditoria para resumo de campos (documento 12 §3.2).

## 2. Desempenho em Node (fake-indexeddb) — p95 em ms

| Métrica | Pequena (300) | 36 mil | 250 mil | Orçamento |
|---|---:|---:|---:|---:|
| Carga inicial (`listEntries`) | 5,2 | 1 029 | 6 446 | — |
| Reconstrução do índice de animais (tela) | 6,6 | 4 141 | 15 528 | — |
| Identificação → peso | 0,02 | 4,6 | 28,1 | < 100 |
| Busca indexada por animal | 0,19 | 0,50 | 3,5 | < 100 |
| Busca por período (30 d) | 0,39 | 143 | 1 122 | — |
| **Salvamento local** | 10,6 | **198** | **1 411** | < 250 |
| Recarga após salvar | 3,4 | 1 000 | 5 866 | — |

Tempo total: 36 mil = 37 s; 250 mil = 195 s (heap 8 GB). Arquivos: `perf/baseline-node-*.json`, `perf/BASELINE.md`.

## 3. Desempenho no Chromium (IndexedDB real) — 36 mil

| Métrica | p50 | p95 | Orçamento | Veredito |
|---|---:|---:|---:|---|
| Carga inicial (`listEntries`) | 519 | 560 | — | — |
| Reconstrução do índice de animais | 860 | 883 | — | pendência da F1 (ler por identificadores na Fase 2) |
| Identificação → peso | 1,1 | 1,8 | < 100 | dentro |
| Busca indexada por animal | 0,3 | 0,6 | < 100 | dentro |
| Busca por período (30 d) | 38 | 72 | — | — |
| **Salvamento local** | 4,5 | **19,1** | < 250 | dentro (F0: 3 169) |
| Recarga após salvar | 495 | 538 | — | — |

Semeadura de 36 mil no IndexedDB real: 5,4 s. Arquivo: `perf/baseline-browser-36k.json`. Ambiente: Chromium do Claude Desktop sobre o servidor Vite (`npm run dev`), sem Electron.

## 4. Comparação com F0/F1

| Salvamento p95 | F0 | F1 (Node) | Fase 0 do 2.0 (Node) | Fase 0 do 2.0 (Chromium) |
|---|---:|---:|---:|---:|
| 36 mil | 4 980 (Node) / 3 169 (navegador) | 76 | 198 | 19 |

A diferença Node 76 → 198 ms decorre de `saves=10` com amostras mais dispersas e da carga do sistema durante a medição (outra bateria de gates rodou em paralelo no início); o valor do Chromium é o de referência para o orçamento do produto.

## 5. Orçamentos adotados para as próximas fases (programa §84)

36 mil: identificação < 100 ms; salvar p95 < 250 ms; abrir Lançamento < 1 s; abrir Fechamento < 500 ms. 250 mil: medir a cada fase; sem travamento; sem carregar catálogo inteiro.

---

<!-- docs/evidence/s00-baseline-recovery/REPORT.md -->

# S-00.0 — Baseline recovery: diagnóstico e correção dos dois gates vermelhos

**Marco:** 1.1.18 · **Data dos fatos:** 14/09/2026 · **Ponto de partida:** tag `v1.1.17-baseline`
(commit `77eeb3b`) · **Correção:** commit `8c79022` · **Evidência histórica referenciada:**
`docs/evidence/program-2.0/phase-00/GATES.md` e `docs/evidence/STATE-OF-REPO-BEFORE.md` §2.

## 1. Situação encontrada

Na tag `v1.1.17-baseline`, `npm run test:quick` falhava em dois gates; os outros 26 scripts
individuais (incluindo os que não entram em `test:quick`) estavam verdes. Tabela completa por gate,
com exit e tempo, em `program-2.0/phase-00/GATES.md` §1.

| Gate | Erro | Resultado |
|---|---|---|
| `ui:operational-customization:verify` | `AssertionError: venda e abate devem abrir cadastro em diálogo` | vermelho |
| `ui:consistency:verify` | `AssertionError: alternância Registro/Tabela reutiliza a estrutura segmentada oficial` | vermelho |

Ambos foram introduzidos pelo trabalho paralelo de 14/09 (Tela Mãe do ModeloBase1 e página
Cadastros Comerciais), que mudou o contrato das telas sem atualizar os testes.

## 2. Diagnóstico: a causa está no teste, não no código

### 2.1 `ui:operational-customization:verify`

O gate exigia `assert.match(launch, /GerenciarSaidasDialog/)` sobre
`src/pages/LancamentoPesagensIndividuais.jsx` e testava a persistência da chave legada
`perfis-saida`. O código do Lançamento, porém, já lia compradores, vendedores e frigoríficos do
registry (`loadRegistryGroup('comerciais')`) e os oferecia em `<SelectItem>`; o popup
`GerenciarSaidasDialog.jsx` continuava no repositório, mas órfão.

Prova, executada nesta worktree (comando git de leitura):

```text
$ git show v1.1.17-baseline:src/pages/LancamentoPesagensIndividuais.jsx | grep -c GerenciarSaidasDialog
0
```

Zero ocorrências na tag de baseline: o teste pedia um componente que a tela já não usava.
Documentado também em `docs/auditoria/AUDITORIA-ESTADO-2026-09-14.md` §3 e
`docs/evidence/auditoria-master-produto-pecuario/UX-FLOW-AUDIT.md`.

### 2.2 `ui:consistency:verify`

Uma única regex acoplada à sintaxe: exigia ``className={`view-seg aux-view-seg`` (template literal)
e os rótulos literais `aria-label="Visualizar registro"` / `"Visualizar tabela"`. O componente usa
`className="view-seg aux-view-seg"` (string simples) e gera os rótulos a partir de `VIEW_MODES`
(``aria-label={`Visualizar ${view.title…`}``). A estrutura oficial estava presente; o teste
verificava a forma, não o contrato.

## 3. Correção aplicada (commit `8c79022`, sem alterar código de produto)

```text
$ git show 8c79022 --stat
 scripts/verify-operational-customization.mjs | 29 +++++++++++++++++++++-------
 scripts/verify-ui-consistency.mjs            |  7 ++++++-
 2 files changed, 28 insertions(+), 8 deletions(-)
```

Regra aplicada: o gate valida o contrato **real** do código; nunca é afrouxado apenas para passar.

- `verify-operational-customization.mjs`: passa a afirmar que o popup legado **não** está no
  Lançamento (`assert.doesNotMatch(launch, /GerenciarSaidasDialog/)`); que compradores, vendedores
  e frigoríficos são carregados do registry (`loadRegistryGroup('comerciais'`) e **selecionados**
  (`auxiliaryCatalogs.* → <SelectItem>`), não digitados; e que o registry
  (`cadastros-auxiliares:comerciais:<empresa>`) persiste após reabrir o banco. As demais asserções
  (resumos configuráveis, operações do resumo, foco suave, tabela gerencial) permanecem. Como
  `registryService.js` usa o alias `@/` e não roda em Node, o gate grava a mesma chave/shape pelo
  `settingsService`.
- `verify-ui-consistency.mjs`: a regex única foi substituída por quatro asserções estruturais —
  `.view-seg aux-view-seg` com `role="group"` e `aria-label="Modo de visualização"`; slider
  `view-seg-slider aux-view-seg__slider`; `VIEW_MODES` declara `registro` e `tabela`; cada modo
  expõe ``aria-label={`Visualizar ${view.title``.

Diff integral: `git show 8c79022`.

## 4. Resultado

`npm run test:quick` em `8c79022`: **exit 0, 20/20** verificações verdes (lista em
`program-2.0/phase-00/GATES.md` §3). Reproduzido nesta worktree para o marco 1.1.18 com o gate
adicional `release:version-contract:verify`: 21/21 — ver
`docs/evidence/s00-versioning-auth-contract/TESTS.md`.

## 5. Consequências para o programa

- `ui:operational-customization:verify` valida o contrato vigente até a migração dos cadastros para
  stores; será substituído por `launch:contract:verify` no marco 1.4.0 (ADR-031/ADR-034).
- `GerenciarSaidasDialog.jsx` permanece no repositório sem uso; remoção prevista em 1.4.0
  (ADR-031). Registrado no CHANGELOG 1.1.18 › Removed.
- Lição registrada em `docs/engineering/RELEASE-POLICY.md` §6: quando um gate falha por mudança
  legítima de contrato, o gate é atualizado para o contrato real e a mudança vai para a evidência.

---

<!-- docs/evidence/s00-versioning-auth-contract/REPORT.md -->

# S-00.1 — Contrato de versão, ADRs e governança (marco 1.1.18)

**Marco:** 1.1.18 (PATCH; ADR-047) · **Data:** 14/09/2026 · **Worktree:**
`C:\Users\maike\Desktop\projeto\MAKGESTAO-1.1.18`, branch `release/1.1.18`, derivada de `e4d4278`
(baseline verde + ADRs 018–040 + contratos fase 0, **antes** do esquema v7) · **Regra do marco:**
baseline verde + contrato de versão + governança, **sem esquema novo** — `DB_VERSION = 6`,
`BACKUP_FORMAT_VERSION = 2`, sem login, stores ou telas novas.

## 1. Objetivo

Deixar 1.1.18 coerente para rollback e `git bisect`: uma só versão em todos os lugares, quatro eixos
de versão que nunca se confundem, manifesto de release com identidade de build, gate que prova tudo
isso, decisões (ADR-041…048) e documentos de engenharia que os marcos 1.2.0…1.6.0 vão seguir, e o
diagnóstico dos dois gates vermelhos registrado como evidência (S-00.0).

## 2. O que foi feito

| Entrega | Onde | Resultado |
|---|---|---|
| Contrato de versão | `src/versioning/versionInfo.js` | `APP_VERSION` (1.1.18), `DB_SCHEMA_VERSION` (6), `BACKUP_FORMAT_VERSION` (2), `RELEASE_MANIFEST_VERSION` (2), `UI_CONTRACT_VERSION` (`ModeloBase1-R34`), `DATA_CONTRACT_VERSION` (1), `DATA_BUILD_ID` (`schema-v6`), reexport de `UI_BUILD_ID/UI_MODEL/UI_VERSION`, `BUILD_INFO` (`__BUILD_INFO__`, fallback nulo em Node), `describeVersions()` |
| Fallback do app | `src/lib/appVersion.js` | `'1.1.18'` |
| Marcadores de build | `vite.config.js` | `__BUILD_INFO__ = { gitCommit: git rev-parse --short HEAD (try/catch → null), buildTimestamp: ISO }`; bundle gerado contém `gitCommit:"e4d4278"` |
| Fonte única do formato de backup | `src/storage/indexedDb/backup/backupService.js` | importa `BACKUP_FORMAT_VERSION` de `versionInfo.js` (2); `schema.js` intacto; backup idêntico |
| Manifesto formato 2 | `scripts/generate-release-manifest.mjs` | `releaseManifestVersion`, `productName`, `appVersion` (+ `version` para `verify-packaged-ui-build.mjs`), `dbSchemaVersion`, `backupFormatVersion`, `uiBuildId`, `dataBuildId`, `uiContract`, `dataContract`, `gitCommit`, `buildTimestamp`, `platform`, `arch`, `installer{file,sha256,sizeBytes,builtAt}`, `signed:false` (fixo até Authenticode, ADR-039), `distribution`, `features`; `buildReleaseManifest`/`writeReleaseManifest` exportados |
| Gate | `scripts/verify-version-contract.mjs` + `release:version-contract:verify` em `test:quick`/`test:full` | checagens (a)–(f); `--self-test` com 2 fixtures positivas e 11 negativas |
| UI | `src/pages/ManutencaoSistema.jsx` | bloco **Versões** no cartão Status do banco e no "Copiar diagnóstico" (Aplicativo, Esquema do banco, Formato do backup, Manifesto, Build commit · data, Contrato UI/dados); sem as palavras proibidas pelos gates de Manutenção/smoke |
| Docs de engenharia | `docs/engineering/VERSIONING.md`, `RELEASE-POLICY.md`, `AUTH-THREAT-MODEL.md` | português claro; nada prometido que não exista (o threat model declara que em 1.1.18 não há login) |
| CHANGELOG | `CHANGELOG.md` | três blocos "Não lançado" → `## [1.1.18] — 2026-09-14` com Added/Changed/Fixed/Removed/Migration/Security; 1.1.16 e anteriores intactos |
| Release docs | `docs/release/1.1.18/RELEASE-NOTES.md`, `RELEASE-CHECKLIST.md` | instalador "não gerado neste marco"; teste físico NÃO EXECUTADO; só o executado está marcado |
| Docs do usuário | `docs/user/INSTALACAO-WINDOWS.md`, `TESTE-MAQUINA-LIMPA.md` | citam 1.1.18 sem afirmar que existe instalador |
| Versão | `package.json`, `package-lock.json` | 1.1.18 nos três campos (edição sincronizada; diff de 2 linhas no lock) |
| ADRs e contratos | `docs/arquitetura-produto/08, 10, 11, 12, 13, 14`, `docs/evidence/STATE-OF-REPO-BEFORE.md` | copiados do repositório principal (14 já era idêntico) |
| Evidências | `docs/evidence/s00-baseline-recovery/`, `docs/evidence/s00-versioning-auth-contract/` | REPORT, FILES-CHANGED, TESTS, RISKS, ROLLBACK |
| Governança Git | `.gitignore` | `release/` → `/release/` e `/release-unsigned/`: o padrão antigo ignorava `docs/release/**` (confirmado com `git check-ignore`), o que deixaria notas e checklist fora do commit |

## 3. Decisões tomadas durante a fatia

1. **`RELEASE_MANIFEST_VERSION` tem dono: o gerador.** `versionInfo.js` declara o mesmo valor para a
   UI, e o gate (f) prova a igualdade importando os dois módulos. Se um dia divergirem, `test:quick`
   falha antes de qualquer pacote.
2. **`signed` não aceita override.** O gerador grava `false` sempre; quando houver certificado, a
   mudança será de código, com ADR, não de variável de ambiente.
3. **O gate também entra em `test:full`.** O enunciado pedia `test:quick`; `test:full` é o gate de
   release e já exigia `docs:user:verify`, então o gate de versão só antecipa a mesma falha.
4. **`.gitignore` corrigido** (ver §2). Sem isso o marco não seria coerente: `docs:user:verify` passa
   na árvore local e falharia em qualquer clone.
5. **`database` mantido no manifesto** (`engine`, `storage`, `preservesDataOnUninstall`): informação
   útil já existente no formato 1; não conflita com os campos exigidos.
6. **Bloco Versões calculado no carregamento do módulo** (constantes de build), não por IPC: a página
   continua mostrando `Versão:` do Electron (`getDiagnosticInfo`) ao lado de `Aplicativo:` do bundle,
   o que permite detectar pacote inconsistente.

## 4. Resultado dos gates (detalhe em `TESTS.md`)

| Comando | Exit | Tempo |
|---|---|---|
| `npm.cmd run lint` | 0 | 18 s |
| `npm.cmd run build` | 0 | 71 s |
| `npm.cmd run release:version-contract:verify` | 0 | < 1 s |
| `node scripts/verify-version-contract.mjs --self-test` | 0 (13/13) | < 1 s |
| `npm.cmd run docs:user:verify` | 0 | 2 s |
| `npm.cmd run test:quick` | 0 (**21/21**) | 40 s |
| `npx eslint src/pages/ManutencaoSistema.jsx` | 0 | — |

Nenhum gate foi afrouxado; nenhum gate existente precisou de alteração.

## 5. Não feito / pendente (deliberado)

- Instalador 1.1.18 **não gerado** (`dist`/`dist:unsigned` proibidos no marco); gates de pacote,
  checksum, manifesto real e e2e instalado não executados. Teste físico **NÃO EXECUTADO**.
- Commit e tag `v1.1.18`: responsabilidade do orquestrador (nenhum comando git de escrita executado
  aqui; apenas `git show`, `git log`, `git status`, `git diff`, `git check-ignore`, `git rev-parse`).
- Integração com `program/pesagens-master-evolution`: `versionInfo.js` daquela branch (backup 3,
  `ModeloBase1-2.0`, `DATA_CONTRACT_VERSION = 2`) vai conflitar com este; ver `RISKS.md` #2.
- `docs/release/1.1.17/` existe apenas no repositório principal e continua fora do git de lá (o
  `.gitignore` antigo); este marco não a recria.

## 6. Referências

ADR-037, ADR-039, ADR-047, ADR-048 (`docs/arquitetura-produto/08-DECISOES-ARQUITETURAIS.md`);
`13-VERSIONAMENTO-RELEASE.md` rev. 2; `10-MODELO-PRODUTO-2.0.md` §4; `docs/evidence/STATE-OF-REPO-BEFORE.md`;
`docs/evidence/program-2.0/phase-00/GATES.md`; `docs/evidence/s00-baseline-recovery/REPORT.md`.

---

<!-- docs/evidence/ui-parity/USER-SAMPLE-2026-09-14.md -->

# Amostra de estilo enviada pelo responsável (14/09/2026)

Captura enviada por Maike no chat como "estilo de exemplo": uma listagem do ModeloBase1 (PROJETOMG-main),
tela de documentos fiscais/notas de compra. É a **referência de paridade** para todas as telas de lista
(cadastros, Relação, Usuários, Faixas, Operações, Embarques). Descrição elemento a elemento, para
comparação com estilos computados:

## Linha 1 — barra de ações (`mg-action-bar`, ~36 px, fundo branco, cantos arredondados)

| Posição | Elemento | Detalhes observados |
|---|---|---|
| esquerda | botão primário **"+ Novo"** | cápsula verde (`tb-btn-green`), ícone "+" à esquerda, texto branco em negrito leve, altura ~28 px, primeiro item da barra (não há botão "Filtrar" nesta linha) |
| direita | segmento de modos de visualização | três ícones em um controle segmentado cinza-claro: registro (documento), **tabela (ativo, fundo verde-claro e ícone verde)**, cards (grade); altura ~28 px |
| direita | "Mais opções" | botão redondo com "…" |

## Linha 2 — faixa de pílulas de filtro (`mg-table-panel-strip`, ~36 px)

| Posição | Elemento | Detalhes observados |
|---|---|---|
| esquerda | ícone do painel de filtros | ícone de "filtro/painel" **verde** em botão quadrado com fundo verde-claro (é o toggle do `aside.filter-panel`) |
| esquerda | chevron "‹" | navegação da faixa de pílulas (rolagem) |
| centro | pílulas | uma por coluna filtrável: Período, Documento fiscal, Empresa, Fornecedor, Código, Valor total, Data de emissão, Data de entrega, Emissão, Situação — cápsula cinza-claro, texto escuro médio, chevron "⌄" à direita, altura ~30 px, espaçamento ~8 px |
| direita | chevron "›" | rolagem |
| direita | ícone "limpar filtros" (funil com x, cinza) e ícone "colunas" (painel) | separados por divisor vertical fino |

## Tabela (`emp-table-pro` / `MakCadastroTable`)

| Elemento | Detalhes observados |
|---|---|
| cabeçalho | fundo cinza muito claro, altura ~36 px, texto em negrito escuro; cada coluna com menu "⋮" alinhado à direita; coluna de seleção com checkbox redondo |
| coluna "ID Global" | badge cinza-claro em cápsula (`#39`, `#40`) |
| coluna "Código" | **borda vertical verde** à esquerda da célula (destaque da coluna principal), texto normal |
| linhas | altura ~34 px, zebra branca/cinza muito claro, separadores finos; textos escuros; valores monetários alinhados à direita (`R$ 350,00`) |
| coluna "Emissão" | ícone + texto: ⚠️ Manual, ✅ Automática |
| coluna "Situação" | pílula de status verde-claro com texto verde escuro: "Confirmado" |

## Tokens visíveis

- verde primário ≈ `#40de63` (botões, ícone ativo, borda da coluna principal, pílula de status);
- cinzas de superfície: fundo da página cinza muito claro, cartões brancos com sombra suave e raio ~10–12 px;
- tipografia sem serifa, 12–13 px, cabeçalhos em negrito 600;
- ícones de 14–16 px em botões de 28 px.

## O que difere hoje no Pesagens (a corrigir na fatia de paridade)

1. Nossa barra de ações tem um botão "Filtrar" textual à esquerda e a pesquisa em pílula; a amostra coloca **"+ Novo" como primeiro item** e o toggle de filtros **na faixa de pílulas** (ícone verde). Conferir no PROJETOMG-main qual variante é a oficial para listas (`MgActionBar` × `MgTablePanelStrip`) e aplicar a mesma.
2. A faixa de pílulas da amostra tem chevrons de rolagem, ícone "limpar filtros" e ícone "colunas" à direita com divisor; a nossa tem só as pílulas + botão de colunas.
3. A tabela da amostra tem coluna de id em badge, **borda verde na coluna principal**, pílulas de status e ícones em células; nossas grades de cadastro mostram texto plano.
4. Segmento de modos com o modo ativo em verde-claro (fundo + ícone).
5. Tela de login: campos com borda vermelha antes de digitar (validação nativa `:invalid`), fora do padrão de campos do modelo.

Método de fechamento: renderizar a tela equivalente do PROJETOMG-main (mesmo harness usado em
`docs/evidence/modelobase1-referencia/`), extrair `getComputedStyle` de cada elemento acima e igualar
no Pesagens; evidência lado a lado em 1440/1366/390, claro e escuro, em `docs/evidence/ui-parity/`.

---

<!-- docs/release/1.1.18/RELEASE-CHECKLIST.md -->

# Checklist da release 1.1.18

Marco 1.1.18 (baseline + contrato de versão, sem esquema novo). Marcado só o que foi executado de
verdade nesta árvore (`release/1.1.18`, derivada de `e4d4278`). Política:
`docs/engineering/RELEASE-POLICY.md`.

## Versão e documentação

- [x] `package.json` e `package-lock.json` (`version` e `packages[""].version`) em 1.1.18.
- [x] Fallback de `src/lib/appVersion.js` em 1.1.18.
- [x] `CHANGELOG.md` com bloco `## [1.1.18] — 2026-09-14` (Added/Changed/Fixed/Removed/Migration/Security) e
      sem blocos "Não lançado".
- [x] `docs/release/1.1.18/RELEASE-NOTES.md` e este checklist.
- [x] `docs/user/INSTALACAO-WINDOWS.md` e `TESTE-MAQUINA-LIMPA.md` citam 1.1.18 sem afirmar que existe instalador.
- [x] ADR-041…048, contratos 10–14 (rev. 2) e `STATE-OF-REPO-BEFORE.md` presentes na árvore.
- [x] `docs/engineering/VERSIONING.md`, `RELEASE-POLICY.md`, `AUTH-THREAT-MODEL.md`.

## Automatizado (executado nesta árvore em 14/09/2026)

- [x] `npm run lint`.
- [x] `npm run build` (vite build; `__APP_VERSION__` e `__BUILD_INFO__` injetados).
- [x] `npm run release:version-contract:verify`.
- [x] `node scripts/verify-version-contract.mjs --self-test` (fixtures positivas e negativas).
- [x] `npm run docs:user:verify`.
- [x] `npm run test:quick` (21 verificações, incluindo o gate de versão).
- [x] `npx eslint src/pages/ManutencaoSistema.jsx`.
- [x] Gates que inspecionam a página de Manutenção (`maintenance:ui`, `desktop:smoke`,
      `storage:maintenance-ui-flow`, `storage:legacy-detached`) verdes após o cartão Versões.

Resultados e tempos: `docs/evidence/s00-versioning-auth-contract/TESTS.md`.

## Pacote (não executado neste marco)

- [ ] `npm run release:clean` → `npm run build` → electron-builder — **instalador não gerado neste marco**.
- [ ] `packaged:source:verify` / `packaged:ui-build:verify` — exigem pacote.
- [ ] `release:checksum` / `release:manifest` — exigem pacote.
- [ ] `e2e:installed:verify` — exige pacote instalado.
- [ ] Assinatura Authenticode e carimbo de tempo — sem certificado; `signed=false`.

## Manual / físico

- [ ] Instalação interativa em máquina limpa — **NÃO EXECUTADO**.
- [ ] Teste com balança real — **NÃO EXECUTADO**.
- [ ] Teste com bastão RFID real — **NÃO EXECUTADO**.
- [ ] Conferência visual do cartão Versões no app empacotado — **NÃO EXECUTADO** (verificado só por
      gates estáticos e build).

## Git (responsabilidade do orquestrador)

- [ ] Commit do marco na branch `release/1.1.18`.
- [ ] Tag local `v1.1.18` após o gate.
- [ ] Nenhuma publicação remota sem autorização.

---

<!-- docs/release/1.1.18/RELEASE-NOTES.md -->

# Pesagens Individuais 1.1.18

**Data:** 14/09/2026 · **Tipo:** PATCH (marco 1.1.18 do Programa Master de Evolução, ADR-047)
· **Esquema Dexie:** 6 (inalterado) · **Formato de backup:** 2 (inalterado) · **Manifesto:** formato 2
· **Interface:** D.17D.2R33 / `ModeloBase1-R34`.

## O que esta versão é

1.1.18 é a versão de **baseline e governança** do programa que leva o produto até 1.6.0. Ela
consolida o estado verde dos gates sobre o código 1.1.17, formaliza o contrato de versão em quatro
eixos e registra as decisões (ADR-041 a ADR-048) e os documentos de engenharia que os próximos marcos
vão seguir. **Não há esquema novo, login, stores novas nem telas novas.**

## Principais alterações

- **Contrato de versão** (`src/versioning/versionInfo.js`): versão do app, esquema do banco, formato
  do backup e formato do manifesto nunca se confundem; marcadores de build (commit, data, contrato
  UI/dados) reunidos em `describeVersions()`.
- **Manutenção › Status do banco › Versões** mostra Aplicativo, Esquema do banco, Formato do backup,
  Manifesto, Build (commit · data) e Contrato UI/dados; "Copiar diagnóstico" inclui os mesmos campos.
- **Gate `release:version-contract:verify`** em `test:quick`: package.json, package-lock, fallback,
  notas, checklist, CHANGELOG e pastas de release precisam concordar na versão 1.1.18.
- **Manifesto de release formato 2** com `appVersion`, `dbSchemaVersion`, `backupFormatVersion`,
  `gitCommit`, `buildTimestamp`, `arch`, `installer.builtAt` e `signed` (sempre `false` até
  Authenticode).
- **Correção de dois gates** que estavam vermelhos na tag `v1.1.17-baseline`
  (`ui:operational-customization`, `ui:consistency`): a causa estava no teste, não no código.
- **Documentos de engenharia:** `VERSIONING.md`, `RELEASE-POLICY.md` e `AUTH-THREAT-MODEL.md`.
- Consolidação no CHANGELOG das mudanças de interface já presentes no código 1.1.17 (Tela Mãe do
  ModeloBase1 na Relação e nos cadastros; design "Lançamento de Pesagens" R29–R33; F0 baseline).

Detalhe completo: `CHANGELOG.md`, bloco `[1.1.18] — 2026-09-14`.

## Compatibilidade e dados

- Backups criados por 1.1.16 e 1.1.17 restauram sem conversão (formato 2).
- Nenhum dado é migrado ou regravado. O banco IndexedDB `pesagens-individuais` e a pasta `userData`
  não mudam.
- Rollback: reinstalar/rodar a versão anterior; não há migração a desfazer.

## Distribuição

- **Instalador: não gerado neste marco.** Não existe `Pesagens Individuais Setup 1.1.18.exe`; as
  pastas `release/` e `release-unsigned/` desta árvore estão vazias.
- Quando for gerado, o pacote sem assinatura em `release-unsigned/` continua sendo diagnóstico local
  (`signed: false`); a distribuição oficial depende de certificado Authenticode (ADR-039).
- Teste físico em máquina limpa, balança e RFID: **NÃO EXECUTADO** nesta versão.

## Evidências

- `docs/evidence/s00-baseline-recovery/` — diagnóstico e correção dos dois gates.
- `docs/evidence/s00-versioning-auth-contract/` — este marco (arquivos, testes, riscos, rollback).
- `docs/evidence/STATE-OF-REPO-BEFORE.md` e `docs/evidence/program-2.0/phase-00/GATES.md` — estado
  de partida.

---

<!-- docs/release/1.2.0/MIGRATION-1.1.17-TO-1.2.0.md -->

# Migração 1.1.17 → 1.2.0

Contrato: `docs/arquitetura-produto/14-MIGRACOES.md` e `12-MODELO-DADOS-V7-V8.md` §5
(ADR-018, ADR-021, ADR-023, ADR-034, ADR-038).

| | De (1.1.17) | Para (1.2.0) |
|---|---|---|
| Esquema Dexie | 6 | **7** |
| Formato de backup | 2 | **3** |
| Contrato de dados | 1 | **2** |
| Build de dados | — | `schema-v7` |
| Usuários locais | não existiam | obrigatórios (Configuração Inicial após a migração) |

A migração roda **sozinha na primeira abertura** da 1.2.0. Ela nunca destrói
dados: antes de abrir o banco na versão nova, grava e confere um backup físico;
se o backup falhar, o banco não é aberto na versão nova (fail closed).

## 1. Pré-requisitos

- [ ] Backup completo criado **na 1.1.17** (Manutenção › Criar backup completo),
      SHA-256 anotado e cópia guardada fora do computador.
- [ ] Espaço livre em disco: pelo menos 3 vezes o tamanho desse backup (o
      programa grava outro backup pré-migração e o banco cresce durante o backfill).
- [ ] Aplicativo desktop instalado (a migração exige a ponte de arquivos do
      Electron; no navegador de desenvolvimento ela é bloqueada, salvo a chave de
      desenvolvimento `pesagens.dev.allowUnsafeMigration`, nunca no pacote).
- [ ] Tabela `lotes` vazia. Se houver registros, a migração é bloqueada com
      `MIGRATION_BLOCKED_LOTES`: exporte/limpe pela Manutenção da 1.1.17 antes.
- [ ] Programa fechado durante a instalação do Setup 1.2.0.
- [ ] Tempo disponível conforme a tabela da seção 10 (não desligue no meio; se
      acontecer, a migração continua do ponto em que parou).

## 2. Backup pré-migração (automático)

Na primeira abertura da 1.2.0, antes de qualquer alteração:

1. O programa detecta o banco na versão 6.
2. Gera um backup completo **no formato da versão de origem** (formato 2),
   calcula o SHA-256, grava em `data\backups\pre-migration-v7-AAAAMMDD-HHmmss.json`
   (pasta de dados do aplicativo), relê o arquivo e confere tamanho e hash.
3. Registra o backup no catálogo (`backupHistory`, tipo `pre-migration`).
4. Só então abre o banco na versão 7.

Se o passo 2 falhar (disco cheio, pasta sem permissão, ponte indisponível):
**MIGRAÇÃO BLOQUEADA** — o banco continua na versão 6, a tela mostra o
diagnóstico e o programa não aceita gravações. Corrija a causa e abra de novo.

## 3. O que a migração faz

### 3.1 Upgrade leve (dentro da transação de versão do Dexie)

Somente conversões idempotentes de enumerações: `sessoesPesagem.status`
(Aberta/Fechada/Cancelada → ABERTA/FECHADA/CANCELADA), `loteApartacoes.situacao`
(de `fechado`), `apartacoes.ativo`. Remoção da tabela `lotes` (vazia). Criação das
tabelas novas (cadastros, faixas, usuários). Nenhum dado é apagado aqui.

### 3.2 Backfill resumível (após a abertura, em lotes de 500 registros)

| Passo | O que faz | Regra de segurança |
|---|---|---|
| **B1 marcas** | Coleta os textos de marca em animais, identificadores e pesagens; cria a tabela de marcas | Grafias que normalizam igual são unidas **só** quando a união não gerar dois animais diferentes com o mesmo número; caso contrário ficam marcas separadas e entram no relatório (`colisoesMarca`) |
| **B2 raças** | Cria raças a partir dos textos; `Nelore` como padrão se não existir | fusão automática por normalização |
| **B3 categorias** | Cria Bezerro, Bezerra, Garrote, Novilha, Boi, Vaca, Touro | ids gerados, nunca fixos |
| **B4 causas de morte** | Move as causas da configuração antiga para a tabela | ids preservados |
| **B5 parceiros** | Une compradores, vendedores e frigoríficos (e os compradores do diálogo legado) em parceiros com papéis | união por CPF/CNPJ ou nome normalizado |
| **B6 propriedades** | Cria "Propriedade principal" (própria, padrão); vendedores com propriedade em texto geram propriedade de terceiro | — |
| **B7 animais** | Preenche `marca_id`, `raca_id`, situação em enum, nascimento estimado a partir da "era" numérica | campos de texto antigos continuam como legado somente-leitura; saídas sem motivo mapeável viram `INATIVO` e são contadas |
| **B8 identificadores** | Tipo, `marca_id`, número normalizado, início | unicidade por (marca, número) |
| **B9 sessões e lotes** | Enumerações e campos novos | idempotente |
| **B10 payload** | Remove chaves redundantes do `legacy_payload` (`_localId`, `peso_kg`, `created_date`, `updated_date`, `status_animal`) | lista permitida (ADR-027) |
| **B11 limpeza** | Apaga as chaves `cadastros-auxiliares:*` e `perfis-saida:*` da configuração | só depois de B4/B5 validados por contagem; sanidade exportada antes |
| **B12 verificação** | Integridade lógica estendida + contagens; grava `status = CONCLUIDA` | — |

Cada passo só grava o que ainda falta; fechar o programa no meio e reabrir
continua do último checkpoint sem duplicar nada.

## 4. Andamento na tela

Durante o backfill a tela de inicialização mostra o passo atual, o total
processado e o total previsto. Ao terminar, o programa segue para a
**Configuração Inicial** (criação do administrador), pois a 1.1.17 não tinha
usuários.

## 5. Relatório esperado

Estado técnico em `appSettings['migration:v7']` (visível em Backup e
Manutenção e no "Copiar diagnóstico"):

```json
{
  "versao": 7,
  "status": "CONCLUIDA",
  "started_at": "2026-..-..T..:..:..Z",
  "finished_at": "2026-..-..T..:..:..Z",
  "processed": 36000,
  "total": 36000,
  "last_checkpoint": "B12",
  "error": null,
  "backup": { "path": "...\\data\\backups\\pre-migration-v7-....json", "sha256": "...", "size": 123456 },
  "relatorio": {
    "marcas": 5, "racas": 4, "categorias": 7, "causasMorte": 3, "parceiros": 3, "propriedades": 1,
    "animaisAtualizados": 12000, "identificadores": 12000,
    "colisoesMarca": [], "saidasSemMotivo": 0
  }
}
```

Como ler:

- `status = CONCLUIDA` e `error = null`: migração completa.
- `colisoesMarca` não vazio: grafias de marca que **não** foram unidas porque
  uniriam animais diferentes; revise em Cadastros › Marcas.
- `saidasSemMotivo` maior que zero: animais com saída antiga sem motivo
  mapeável, marcados como `INATIVO`; revise na Ficha do Animal.
- Contagens de animais e pesagens iguais às da 1.1.17 (compare com o backup
  criado antes).

## 6. Verificação após a migração

- [ ] Backup e Manutenção › Status: aplicativo 1.2.0, banco 7, backup formato 3, `schema-v7`.
- [ ] **Verificar integridade**: "Banco íntegro."
- [ ] Contagens de pesagens e animais iguais às anteriores.
- [ ] Cadastros › Marcas, Raças, Parceiros, Causas de Morte, Propriedades preenchidos.
- [ ] Lançamento: escolher animal existente mostra a marca e a raça cadastradas.
- [ ] Criar um backup completo novo (formato 3) e guardar.

## 7. Falha no meio da migração

- O passo com erro grava `status = FALHOU` e `error`; o backup pré-migração
  é mantido; a **escrita fica bloqueada** (`MIGRATION_BLOCKED`) para não
  misturar dados; a tela mostra o diagnóstico com **Copiar diagnóstico**.
- Depois de corrigir a causa (por exemplo, espaço em disco), um ADMIN usa
  **Continuar migração** em Backup e Manutenção. O processo retoma do checkpoint.
- Se a causa não for resolvível, faça o rollback (seção 8) e registre o
  diagnóstico para suporte.

## 8. Rollback

**Rollback lógico (permanece na 1.2.0):** em Backup e Manutenção, restaure o
backup pré-migração (`pre-migration-v7-...json`). Como é um backup de esquema
anterior, o programa grava os dados e executa o backfill novamente (mesma
rotina, mesmas garantias). Use quando o problema estiver nos dados, não no
programa.

**Voltar para a 1.1.17:** a 1.1.17 não consegue abrir um banco na versão 7.
Passos:

1. Guarde o diagnóstico e o backup pré-migração.
2. Desinstale a 1.2.0 (os dados não são apagados na desinstalação).
3. Renomeie ou mova a pasta `IndexedDB` dentro da pasta de dados do
   aplicativo (perfil do usuário do Windows; a tela de Manutenção da 1.2.0 mostra
   o caminho em `userDataPath`), para a 1.1.17 nascer com banco vazio.
4. Instale a 1.1.17 e restaure o backup criado antes da atualização (ou o
   pré-migração, que é do mesmo formato 2).
5. Confira contagens e integridade.

Nunca edite o JSON do backup manualmente.

## 9. Restauração cruzada (backup 1.1.17 em uma 1.2.0 já migrada)

`dryRunRestore` indica `schemaUpgradeRequired`, tabelas ignoradas (`lotes`) e
tabelas novas. Ao aplicar, o programa grava os dados, converte as enumerações
mínimas e executa o backfill (B1…B12) antes de registrar sucesso. Como o backup
não tem usuários, a Configuração Inicial volta a aparecer.

## 10. Tempos medidos

Preenchido pelo coordenador com `npm run migration:v7:verify` (Node) e com o
aplicativo instalado (Chromium), nas massas de `src/modules/perf/testMass.js`.

| Massa | Pesagens | Backup pré-migração | Upgrade + backfill | Total | Tamanho do backup | Ambiente |
|---|---|---|---|---|---|---|
| vazia | 0 | a medir | a medir | a medir | a medir | Node / instalado |
| pequena | a medir | a medir | a medir | a medir | a medir | Node / instalado |
| 36 mil | 36 000 | a medir | a medir | a medir | a medir | Node / instalado |
| 250 mil (`test:full`) | 250 000 | a medir | a medir | a medir | a medir | Node |

Critério de parada (documento 10 §6): perda de dados, migração irreversível,
backup inválido, integridade vermelha, duplicação de animal/identificador,
falha de restore ou corrupção do IndexedDB interrompem a release.

## 11. Evidências

`docs/evidence/program-2.0/phase-01/migration-v7/`: saída do gate por massa,
relatórios `migration:v7`, capturas da tela de andamento e do Status, e este
documento com a seção 10 preenchida.

---

<!-- docs/release/1.2.0/RELEASE-CHECKLIST.md -->

# Checklist da release 1.2.0

Política: `docs/arquitetura-produto/13-VERSIONAMENTO-RELEASE.md` §4 (ADR-039).
Nenhum item automatizado é marcado sem o comando ter sido executado nesta árvore;
itens manuais sem GUI disponível ficam como **MANUAL PENDENTE**, nunca "aprovado".

## 1. Versões e documentos

- [ ] `package.json` e `package-lock.json` (inclusive `packages[""]`) em **1.2.0**.
- [ ] `src/versioning/versionInfo.js`: `DB_SCHEMA_VERSION = 7`, `BACKUP_FORMAT_VERSION = 3`,
      `DATA_CONTRACT_VERSION = 2`, `DATA_BUILD_ID = 'schema-v7'`.
- [ ] `uiBuildInfo.js` com o `UI_BUILD_ID` desta release.
- [ ] `CHANGELOG.md` com o bloco `## [1.2.0]` consolidado
      (Added/Changed/Fixed/Removed/Migration/Security), sem blocos "Não lançado" pendentes.
- [ ] `docs/user/*` atualizados (LOGIN, USUARIOS, CADASTROS, GUIA-RAPIDO,
      INSTALACAO-WINDOWS, BACKUP-E-RESTAURACAO, TESTE-MAQUINA-LIMPA).
- [ ] `docs/release/1.2.0/RELEASE-NOTES.md` e `MIGRATION-1.1.17-TO-1.2.0.md` com tempos medidos.
- [ ] `npm run docs:user:verify` verde.

## 2. Gates automatizados

- [ ] `npm run lint`
- [ ] `npm run test:quick` (todos os gates, inclusive os novos da Fase 1)
- [ ] `npm run migration:v7:verify` (massas vazia, pequena e 36 mil; reentrância; bloqueio sem backup)
- [ ] `npm run auth:local:verify` e `npm run auth:access:verify`
- [ ] `npm run master-registry:verify` (cadastros mestres)
- [ ] `npm run storage:backup:verify` e `npm run storage:import-restore:verify` (formato 3; restore v6 → backfill; usuários)
- [ ] `npm run ui:consistency:verify` (menu novo, RequirePermission, telas de cadastro)
- [ ] `npm run packaged:build:verify -- --self-test` (fixtures positivas e negativas do gate de pacote)
- [ ] `npm run test:full` após as últimas alterações (inclui build e `e2e:installed:verify:dev`).

## 3. Build e pacote

- [ ] `npm run release:clean` (nenhum Setup de outra versão em `release/` ou `release-unsigned/`).
- [ ] `npm run build` limpo; `dist/assets` contém `UI_BUILD_ID`, `schema-v7` e `"1.2.0"`.
- [ ] `electron-builder --win` (assinado em `release/`; sem certificado, `npm run dist:unsigned`).
- [ ] `npm run packaged:build:verify` (ou `diagnostic:packaged:build:verify`): versão, marcadores,
      manifesto com os cinco eixos, SHA-256, tamanho, `builtAt`, `signed`, Setup não anterior aos bundles.
- [ ] `npm run release:checksum` gera `Pesagens Individuais Setup 1.2.0.exe.sha256`.
- [ ] `npm run release:manifest` gera `release-manifest.json` com `version`, `dbSchema`, `backupFormat`,
      `uiContract`, `dataContract`, `uiBuildId`, `dataBuildId`, `installer{file,sha256,sizeBytes,builtAt}`,
      `signed`, `distribution`.
- [ ] `npm run release:current-only:verify` (um único Setup, da versão atual).
- [ ] `npm run packaged:source:verify` (main enxuto, preload, sem módulo nativo).

## 4. Evidências

- [ ] `docs/evidence/program-2.0/phase-01/` com: saída dos gates, relatório da migração nas massas
      (vazia, pequena, 36 mil; 250 mil em `test:full`), capturas de Login, Configuração Inicial,
      Usuários, cadastros e Status da Manutenção (claro e escuro), manifesto e checksum.

## 5. Teste instalado (manual)

- [ ] Máquina limpa: instalar, Configuração Inicial, login, cadastros, lançamento, fechar/abrir,
      backup, restauração, versão e UI (`docs/user/TESTE-MAQUINA-LIMPA.md`).
- [ ] Atualização 1.1.17 → 1.2.0 com dados reais de teste: backup pré-migração, migração,
      relatório, integridade, contagens.
- [ ] Restauração de um backup 1.1.17 na 1.2.0 (conversão automática).
- [ ] Teste com balança real. **MANUAL PENDENTE**
- [ ] Teste com bastão RFID real. **MANUAL PENDENTE**

## 6. Distribuição oficial

- [ ] Assinatura Authenticode e carimbo de tempo (`npm run release:signature:verify`).
- [ ] Reputação SmartScreen do publicador.
- [ ] `signed: true` no manifesto **somente** após a assinatura ser verificada.

## 7. Fechamento

- [ ] Commit semântico de release em `program/2.0`; merge em `main`.
- [ ] Tag `v1.2.0` **somente** após todos os gates acima.
- [ ] Relatório do coordenador da Fase 1.

Os itens de hardware não são simulados: enquanto não houver driver e conexão
reais, a interface informa que os equipamentos não estão configurados.

---

<!-- docs/release/1.2.0/RELEASE-NOTES.md -->

# Pesagens Individuais 1.2.0

Primeira release do Programa Pesagens Individuais 2.0 (Fase 1). Base: 1.1.17.

| Eixo | Valor |
|---|---|
| Aplicativo | 1.2.0 |
| Banco (esquema Dexie) | 7 (antes: 6) |
| Formato de backup | 3 (antes: 2) |
| Contrato de dados | 2 (antes: 1) |
| Contrato de UI | ModeloBase1-2.0 |
| Build de dados | `schema-v7` |
| Build de UI | conforme `uiBuildId` em `release-manifest.json` |
| Instalador | `Pesagens Individuais Setup 1.2.0.exe` (SHA-256 e tamanho no manifesto) |

## Principais novidades

- **Login local com usuários e perfis.** Primeira execução cria o administrador
  (Configuração Inicial). Perfis fixos ADMIN, GESTOR e OPERADOR; bloqueio da
  tela por inatividade; bloqueio temporário após 5 tentativas erradas; troca de
  senha obrigatória na primeira entrada. Tudo offline, sem senha padrão.
  (`docs/user/LOGIN.md`, `docs/user/USUARIOS.md`)
- **Cadastros próprios**: Marcas, Raças, Categorias, Parceiros, Propriedades e
  Causas de Morte deixam de ser texto livre ou configuração e viram cadastros
  com nome único, item padrão, inativação e contagem de uso.
  (`docs/user/CADASTROS.md`)
- **Identidade do animal por marca cadastrada**: o mesmo número continua
  podendo existir em marcas diferentes; agora o vínculo é pelo cadastro, e uma
  grafia errada não cria mais um "animal novo".
- **Migração automática e segura** na primeira abertura: backup pré-migração
  gravado e conferido antes de qualquer alteração; migração resumível (fechar
  e reabrir continua do ponto em que parou); bloqueio de escrita em caso de
  falha; relatório da migração. (`MIGRATION-1.1.17-TO-1.2.0.md`)
- **Backup formato 3**, com cadastros e usuários. Backups da 1.1.x continuam
  restauráveis e são convertidos automaticamente.
- **Limpeza em dois níveis**: "Limpar dados operacionais" preserva usuários,
  configurações e cadastros; "Reset completo" apaga tudo e exige backup
  validado, senha e confirmação por extenso.
- **Versionamento em cinco eixos** visível em Backup e Manutenção › Status e no
  diagnóstico copiado (aplicativo, banco, backup, contrato de UI, contrato de
  dados, builds).
- **Auditoria por usuário**: todo lançamento, alteração, backup, restauração e
  limpeza registra quem fez.
- **Menu reorganizado**: Operação · Cadastros · Sistema, filtrado pelo perfil.

## Removido

- Tela **Configurações de Sanidade** e o grupo de sanidade da configuração
  (ADR-022). Dados existentes, se houver, são exportados para
  `docs/evidence/program-2.0/` antes da remoção.
- Tabela `lotes` (sem uso; `loteApartacoes` é a tabela de lotes).
- Diálogo legado "Gerenciar saídas" e os perfis de venda/abate
  (`perfis-saida`). Os compradores foram convertidos em parceiros.
- Configurações `cadastros-auxiliares:*` (convertidas nas tabelas de cadastro).

## Atualização a partir da 1.1.17

1. Criar e guardar um backup completo na 1.1.17.
2. Instalar a 1.2.0 por cima e abrir: a migração roda sozinha.
3. Criar o administrador na Configuração Inicial e conferir o Status.

Roteiro completo, relatório esperado e rollback em `MIGRATION-1.1.17-TO-1.2.0.md`.

## Compatibilidade

- Banco migrado para a versão 7 **não abre** na 1.1.x. Para voltar, use o
  backup criado antes da atualização (ver rollback).
- Backups formato 2 (1.1.x) são restauráveis na 1.2.0 (conversão automática).
- Backups formato 3 não são aceitos pela 1.1.x.

## Limitações conhecidas

- Não há recuperação automática de senha: outro ADMIN redefine; se o único
  ADMIN esquecer a senha, não há como entrar. Recomenda-se dois ADMIN.
- Os grupos **Rebanho** (Animais, Apartações e Lotes, Identificadores) e
  **Comercial** (Operações, Embarques) chegam nas versões 1.3.0 e 1.4.0.
- Balança e bastão RFID continuam sem driver homologado: a interface informa
  que os equipamentos não estão configurados.
- Assinatura Authenticode pendente: o pacote em `release-unsigned/` é
  diagnóstico local (`signed: false` no manifesto) e não substitui uma release
  oficial assinada.

## Verificação da release

| Verificação | Resultado |
|---|---|
| `npm run test:quick` | a preencher pelo coordenador |
| `npm run migration:v7:verify` | a preencher |
| `npm run auth:local:verify` / `auth:access:verify` | a preencher |
| `npm run storage:backup:verify` / `storage:import-restore:verify` | a preencher |
| `npm run docs:user:verify` | a preencher |
| `npm run packaged:build:verify` | a preencher |
| Teste em máquina limpa (`docs/user/TESTE-MAQUINA-LIMPA.md`) | MANUAL PENDENTE |

Evidências em `docs/evidence/program-2.0/phase-01/`.

---

<!-- docs/user/BACKUP-E-RESTAURACAO.md -->

# Backup e restauração

## O que é protegido

O armazenamento operacional é o **IndexedDB local, administrado pelo Dexie**. O
backup completo é um arquivo JSON portátil que contém **todas** as tabelas do
sistema: pesagens, animais, identificadores, movimentos, sessões, apartações,
lotes, embarques, histórico, importações, **cadastros** (marcas, raças,
categorias, parceiros, propriedades, causas de morte, faixas de identificadores)
e **usuários** (com o código derivado da senha, nunca a senha).

O arquivo traz um manifesto com a versão do programa, a versão do banco, o
formato do backup, o contrato de dados, o identificador de build da interface e
a contagem de registros por tabela, além de um SHA-256 do conteúdo. Na
gravação, o aplicativo usa um arquivo temporário, sincroniza a escrita, renomeia
de forma atômica, relê o arquivo final e confere tamanho e hash antes de
registrar o backup como concluído.

## Formato 3 (versão 1.2.0)

A versão 1.2.0 grava backups no **formato 3**. Em relação ao formato 2 (até a
1.1.17), o formato 3:

- inclui as tabelas novas (cadastros e usuários);
- registra `formatVersion: 3`, a versão do banco (7), o contrato de dados e o
  identificador de build;
- continua com o mesmo mecanismo de SHA-256 e contagens.

Backups antigos (formato 2, banco versão 6) **continuam restauráveis**: veja
"Restaurar um backup de versão antiga" abaixo.

## Quem pode

| Ação | Perfis |
|---|---|
| Criar backup completo, exportar CSV/JSON | ADMIN e GESTOR |
| Restaurar backup | somente ADMIN |
| Limpar dados operacionais, Reset completo | somente ADMIN |
| Continuar uma migração interrompida | somente ADMIN |

## Como criar um backup completo

1. Abra **Backup e Manutenção**.
2. Clique em **Criar backup completo**.
3. Aguarde a confirmação com nome, tamanho e SHA-256.
4. Confira o arquivo no catálogo de backups exibido na mesma tela.

Faça um backup regularmente e sempre antes de uma importação, restauração,
limpeza ou **atualização do programa**. Guarde uma cópia fora do computador.
Não edite manualmente o JSON.

## Backups automáticos

O programa cria backups sozinho, no mesmo formato, antes de qualquer operação
que altere o banco inteiro:

- **pré-migração**: na primeira abertura de uma versão que muda o banco
  (arquivo `pre-migration-v7-<data>.json`); se ele não puder ser gravado e
  conferido, a migração não começa;
- **pré-restauração** e **pré-limpeza**: antes de restaurar ou limpar.

Todos aparecem no catálogo da tela, com tipo, data, tamanho e SHA-256. Eles
ficam na pasta de dados do aplicativo, subpasta `backups` (botão
**Abrir pasta data**).

## Como restaurar

1. Abra **Backup e Manutenção** (perfil ADMIN).
2. Em **Restauração**, selecione um backup `.json`.
3. Confira a análise (dry-run): manifesto, versão do programa e do banco,
   formato, integridade, contagens por tabela, tabelas que serão ignoradas e
   tabelas novas.
4. Somente se a análise estiver aprovada, clique em **Restaurar backup**.

Antes de alterar o banco, o aplicativo grava e valida um pré-backup físico. A
restauração ocorre em transação: uma falha aborta a operação e não deve deixar
uma base parcial. A restauração é **integral**: tudo o que existe hoje é
substituído pelo conteúdo do backup.

Depois do commit, execute **Verificar integridade** e reabra o aplicativo para
confirmar as contagens.

### Usuários no backup

- Se o backup **tem usuários** (formato 3), eles **substituem** os usuários
  atuais. Ao terminar, a sessão é encerrada e o programa pede login de novo,
  com os usuários do backup.
- Se o backup **não tem usuários** (formato 2, das versões 1.1.x), a tabela de
  usuários fica vazia e o programa volta para a **Configuração Inicial**, para
  criar o administrador de novo. Isso é esperado.

### Restaurar um backup de versão antiga

Um backup criado pela 1.1.x (banco versão 6, formato 2) pode ser restaurado na
1.2.0. A análise avisa "backup de esquema anterior: será convertido". Ao
restaurar, o programa:

1. grava os dados do backup;
2. executa a mesma **conversão** da atualização (monta os cadastros a partir
   dos textos, preenche os vínculos dos animais, converte situações e limpa
   dados redundantes) — o andamento aparece na tela;
3. só então registra a restauração como concluída.

A tabela `lotes` (sem uso, retirada na 1.2.0) é ignorada; a análise lista isso.
Um backup criado por uma versão **mais nova** do banco é recusado: atualize o
programa antes.

## Arquivo recusado

O aplicativo bloqueia arquivos truncados, JSON inválido, hash divergente,
contagem divergente, banco mais novo que o do programa ou sem as tabelas
obrigatórias. Backups legados sem hash podem ser analisados com aviso, mas
devem ser convertidos por uma restauração controlada e um novo backup.

## Dois níveis de limpeza

A tela de Backup e Manutenção tem duas limpezas diferentes (somente ADMIN):

| | Limpar dados operacionais | Reset completo |
|---|---|---|
| Apaga | pesagens, animais, identificadores, movimentos, sessões, apartações, lotes, embarques, importações | **tudo** |
| Preserva | usuários, configurações, cadastros (marcas, raças, categorias, parceiros, propriedades, causas, faixas) e o catálogo de backups | nada |
| Exige | backup físico validado antes | backup físico validado, a **senha do usuário atual** e a digitação de uma confirmação por extenso |
| Depois | continua logado; cadastros prontos para uso | volta para a **Configuração Inicial** |

Use "Limpar dados operacionais" para recomeçar o rebanho sem perder o
trabalho de cadastro. Use "Reset completo" só para entregar o computador
"zerado".

## Cuidados

- Não apague a pasta de dados do aplicativo.
- Não use a base operacional para testes destrutivos.
- Não confunda exportação CSV com backup completo: CSV é para intercâmbio e não
  contém toda a estrutura necessária à restauração.
- No navegador de desenvolvimento, a gravação física pode estar indisponível; o
  backup oficial deve ser criado pelo aplicativo desktop, que possui a ponte
  segura de arquivos. Sem essa ponte, a migração também é bloqueada.

---

<!-- docs/user/CADASTROS.md -->

# Cadastros

Desde a versão 1.2.0 o programa tem cadastros próprios para as informações que
se repetem em muitos lançamentos. A regra é simples: **cadastre antes, escolha
no lançamento**. Em vez de digitar "Nelore" ou o nome do comprador toda vez,
você escolhe em uma lista, e o programa passa a saber que se trata sempre do
mesmo item.

Menu **Cadastros**:

| Cadastro | Serve para |
|---|---|
| **Marcas** | Marca a fogo (ou marca do dono) que identifica de quem é o animal. Faz parte da identidade do animal junto com o número. |
| **Raças** | Raça do animal (Nelore, Angus, Cruzado etc.). |
| **Categorias** | Classificação do animal por sexo e idade (Bezerro, Garrote, Novilha, Boi, Vaca, Touro...). |
| **Parceiros** | Compradores, vendedores, frigoríficos, transportadores e donos de marca. Uma pessoa ou empresa é um único parceiro, mesmo que tenha vários papéis. |
| **Propriedades** | Fazendas/propriedades: a sua (própria) e as de terceiros (origem de compras, destino de transferências). |
| **Causas de Morte** | Motivos usados na saída por morte. |

Quem pode alterar: **ADMIN** e **GESTOR**. **OPERADOR** só consulta (as listas
aparecem, mas sem os botões de criar, editar e inativar).

## Regras comuns a todos os cadastros

- **Nome único.** O programa compara os nomes ignorando maiúsculas/minúsculas e
  espaços a mais. "Nelore", "NELORE" e " nelore " são o mesmo nome; o segundo é
  recusado com uma mensagem clara.
- **Padrão.** Alguns cadastros aceitam **um** item marcado como padrão (marca,
  raça e propriedade). O padrão já vem escolhido no cadastro rápido do curral,
  para digitar menos; você troca quando o animal for diferente.
- **Inativar em vez de excluir.** Se o item já foi usado em algum animal ou
  lançamento, ele **não pode ser excluído**: use **Inativar**. O item inativo
  some das listas de escolha, mas continua aparecendo nos registros antigos.
  Para voltar a usar, **Reative**.
- **Excluir** só funciona quando nada usa o item. Mesmo assim o programa apenas
  marca o registro como excluído (não apaga fisicamente), e a ação fica no
  histórico.
- **Renomear não reescreve o passado.** Se você renomear uma marca ou raça, os
  lançamentos antigos continuam guardando o texto da época; as telas passam a
  mostrar o nome atual porque o vínculo é feito pelo cadastro, não pelo texto.
- **Histórico.** Criar, alterar, inativar e excluir ficam registrados com o
  usuário que fez.
- **Contagem de uso.** A lista mostra quantos animais (ou operações) usam cada
  item, para você saber o impacto antes de inativar.

## Marcas

Campos: **Nome** (obrigatório), **Abreviação** (até 6 letras, aparece nas
tabelas), **Proprietário** (um parceiro com o papel "dono de marca"),
**Propriedade**, **Padrão** e **Observação**.

A marca é parte da identidade do animal: o **mesmo número pode existir em
marcas diferentes**, e o programa pergunta qual você quer quando encontra o
número em mais de uma marca. Por isso uma marca digitada errada em versões
antigas criava um "animal novo". Com o cadastro isso deixa de acontecer.

## Raças

Campos: **Nome**, **Abreviação**, **Grupo** (Zebuíno, Taurino, Cruzado, Outro;
serve só para agrupar relatórios), **Padrão** e **Ordem** (posição na lista).

A raça padrão substitui o antigo "Nelore" fixo do programa. Cadastre só as raças
que você usa: lista curta é mais rápida no curral.

## Categorias

Campos: **Nome**, **Sexo aplicável** (Macho, Fêmea ou Ambos), **Idade mínima**
e **Idade máxima** em meses (opcionais) e **Ordem**.

O programa já vem com as categorias usuais (Bezerro, Bezerra, Garrote, Novilha,
Boi, Vaca, Touro). Você pode editar, inativar ou criar outras. Quando o animal
tem data de nascimento, o programa **sugere** a categoria pela idade e pelo
sexo, mas nunca troca sozinho uma categoria que você informou.

## Parceiros

Campos: **Nome**, **Tipo** (pessoa física ou jurídica), **CPF/CNPJ** (só
números, opcional, mas único quando informado), **Papéis** (Comprador,
Vendedor, Frigorífico, Transportador, Proprietário de marca; pode marcar
vários), **Telefone**, **E-mail**, **Cidade**, **UF**, **Registro SIF** (só para
frigorífico), **Rendimento padrão** (sugestão de rendimento de carcaça para
frigorífico/comprador) e **Observação**.

Um frigorífico que também compra bezerros é **um único** parceiro com dois
papéis. Nas versões seguintes, vendas, abates e embarques apontam para o
parceiro, e não para o nome digitado.

Os antigos "Cadastros Comerciais" (compradores, vendedores e frigoríficos em
listas separadas) foram convertidos automaticamente em parceiros na primeira
abertura da versão 1.2.0, unindo registros com o mesmo CPF/CNPJ ou o mesmo nome.

## Propriedades

Campos: **Nome**, **Tipo** (Própria ou Terceiro), **Parceiro** (dono, quando
for de terceiro), **Município**, **UF**, **Código oficial** (o código usado na
GTA, sem validação) e **Padrão**.

O programa cria uma propriedade própria chamada **"Propriedade principal"** na
primeira abertura, marcada como padrão. Renomeie para o nome da sua fazenda.
Vendedores que tinham "propriedade" escrita em texto ganham uma propriedade de
terceiro ligada a eles.

## Causas de Morte

Campos: **Nome**, **Categoria** (Doença, Acidente, Predação, Parto,
Desconhecida, Outra), **Descrição**, **Exige observação** (quando marcado, a
saída por morte só é aceita com uma observação preenchida) e **Ordem**.

As causas cadastradas na versão anterior foram mantidas com os mesmos
registros.

## De onde vieram os dados na atualização

Na primeira abertura da versão 1.2.0 o programa monta os cadastros a partir do
que já existia nos seus lançamentos:

- **Marcas** e **raças**: cada texto diferente que aparecia nos animais vira um
  item. Grafias que só diferem em maiúsculas/espaços são unidas em um item só
  (para marcas, apenas quando a união não fizer dois animais diferentes ficarem
  com o mesmo número; nesse caso o programa mantém as marcas separadas e avisa
  no relatório da migração).
- **Categorias**: as sete categorias usuais são criadas.
- **Parceiros**: vindos dos Cadastros Comerciais e dos compradores antigos.
- **Propriedades**: a "Propriedade principal" e as propriedades dos vendedores.
- **Causas de morte**: as mesmas do cadastro anterior.

Depois da atualização, revise as listas: junte, renomeie ou inative o que
estiver duplicado ou fora de uso. Veja também `docs/release/1.2.0/MIGRATION-1.1.17-TO-1.2.0.md`.

---

<!-- docs/user/EXPORTAR-DADOS.md -->

# Exportar dados

## Diferença entre CSV e JSON

| Formato | Melhor para |
|---|---|
| **CSV** | Abrir no Excel / planilhas |
| **JSON** | Guardar/importar dados no próprio sistema |

## Quando usar CSV

Use CSV quando quiser analisar ou imprimir pesagens em planilha.

## Quando usar JSON

Use JSON quando quiser guardar uma cópia estruturada das pesagens ou importar depois no app.

## Como exportar pesagens

1. Abra **Backup e Manutenção**.
2. Clique em **Exportar pesagens em CSV** ou **Exportar pesagens em JSON**.
3. Aguarde a mensagem de sucesso.

## Onde os arquivos ficam

Os arquivos são salvos na pasta de dados do aplicativo (junto com backups e exportações).

Você também pode abrir a pasta de dados pelo botão **Abrir pasta data** no topo do app.

---

<!-- docs/user/GUIA-RAPIDO.md -->

# Guia rápido — Pesagens Individuais

Sistema **offline e gratuito** para controlar pesagens individuais no computador. Não precisa de internet nem de conta na nuvem.

## Como abrir e entrar

1. Clique no atalho **Pesagens Individuais** na área de trabalho, ou abra pelo Menu Iniciar.
2. Na tela de **login**, digite o seu usuário e a sua senha e clique em **Entrar**.
3. Na primeira vez que o programa é aberto, aparece a **Configuração Inicial** para criar o administrador. Veja `LOGIN.md`.

Cada pessoa tem o próprio usuário e um perfil (**ADMIN**, **GESTOR** ou **OPERADOR**). O menu mostra só o que o seu perfil pode usar. Veja `USUARIOS.md`.

## O menu

| Grupo | Telas |
|---|---|
| **Operação** | Lançamento · Relação de Pesagens · Fechamento · Ficha do Animal |
| **Cadastros** | Marcas · Raças · Categorias · Parceiros · Propriedades · Causas de Morte |
| **Sistema** | Usuários · Backup e Manutenção |

Na barra superior ficam o seu nome e perfil, a versão do programa, o tema claro/escuro e o menu do usuário (**Bloquear**, **Trocar senha**, **Sair**).

A tela de Sanidade foi retirada nesta versão; os grupos **Rebanho** (Animais, Apartações e Lotes, Identificadores) e **Comercial** (Operações, Embarques) chegam nas versões seguintes.

## Antes de pesar: os cadastros

Cadastre uma vez e escolha no lançamento: **Marcas**, **Raças**, **Categorias**, **Parceiros**, **Propriedades** e **Causas de Morte**. Marque a marca, a raça e a propriedade **padrão** para digitar menos no curral. Veja `CADASTROS.md`.

## Como lançar uma pesagem

1. No menu, abra **Lançamento**.
2. Informe o número do animal e a marca (a padrão já vem escolhida), o peso e o que mais for pedido.
3. Salve o lançamento.

Animal novo é cadastrado ali mesmo (cadastro rápido), com raça e categoria escolhidas da lista.

## Como consultar registros

1. Abra **Relação de Pesagens**.
2. Use os filtros da tela para encontrar o que precisa.

## Embarque

Na tela de lançamento, use a documentação de embarque para organizar saídas (GTA, NF-e etc.).

## Como fazer backup

1. Abra **Backup e Manutenção**.
2. Clique em **Criar backup completo**.
3. Confira nome, tamanho e SHA-256 na mensagem de sucesso e no catálogo da tela.

O backup leva tudo: pesagens, animais, cadastros e usuários. Veja `BACKUP-E-RESTAURACAO.md`.

## Como verificar se o banco está saudável

1. Abra **Backup e Manutenção**.
2. Clique em **Verificar integridade**.
3. Se aparecer "Banco íntegro.", está tudo certo.

Na mesma tela, o **Status** mostra a versão do programa, a versão do banco, o formato de backup e os identificadores de build. Essas informações vão junto no **Copiar diagnóstico**.

## Se algo der errado

1. Faça um **backup** imediatamente (ADMIN ou GESTOR).
2. Anote a mensagem de erro (use **Copiar diagnóstico** na tela de Backup e Manutenção; a senha nunca vai no diagnóstico).
3. Não apague a pasta de dados do programa nem edite manualmente o backup JSON.
4. Consulte também `BACKUP-E-RESTAURACAO.md`, `INSTALACAO-WINDOWS.md` e `LOGIN.md`.

---

<!-- docs/user/INSTALACAO-WINDOWS.md -->

# Instalação no Windows

Versão deste guia: **1.2.0**. O instalador chama-se
**Pesagens Individuais Setup 1.2.0.exe**.

## Como instalar

1. Execute o arquivo **Pesagens Individuais Setup 1.2.0.exe**.
2. Siga as telas do instalador.
3. Você pode escolher a pasta de instalação.
4. Ao terminar, o atalho é criado.

## Como abrir

- Atalho na **área de trabalho**, ou
- **Menu Iniciar** → Pesagens Individuais

## Primeira abertura

Em um computador novo, o programa abre na **Configuração Inicial** para você
criar o primeiro administrador (nome, login e senha). Depois disso, toda
abertura pede login. Veja `LOGIN.md`.

## Segurança do instalador

A distribuição oficial exige assinatura digital Authenticode válida. Antes de
instalar, confira em **Propriedades > Assinaturas Digitais** o publicador, a
cadeia confiável e o carimbo de tempo, e compare o SHA-256 com o
`release-manifest.json` da release (campos `installer.sha256`,
`installer.sizeBytes` e `signed`).

Não desative Defender, SmartScreen, WDAC ou App Control para executar um pacote.
Um build sem assinatura pode ser gerado em `release-unsigned/` apenas para
diagnóstico local (`signed: false` no manifesto); ele não é instalador oficial
e pode ser corretamente bloqueado por uma política corporativa do Windows.

## Como atualizar sem perder dados (1.1.x → 1.2.0)

1. Abra a versão antiga e crie um **backup completo** em **Manutenção**.
   Confira o nome, o tamanho e o SHA-256 e guarde o arquivo fora do computador
   (pen drive ou outra pasta). Este passo é obrigatório.
2. Feche o programa.
3. Execute o **Setup 1.2.0** por cima da instalação atual.
4. Abra o programa. Na **primeira abertura**, a versão 1.2.0 faz uma
   **migração automática** do banco:
   - primeiro ela grava e confere um **backup pré-migração** na pasta de dados
     (subpasta `backups`, arquivo `pre-migration-v7-<data>.json`);
   - só depois converte os dados para o novo formato e monta os cadastros
     (marcas, raças, categorias, parceiros, propriedades, causas de morte) a
     partir do que já existia;
   - a tela mostra o andamento. **Não feche o programa** durante a migração.
     Se o computador desligar no meio, abra de novo: a migração continua de onde
     parou, sem duplicar nada.
5. Ao terminar, aparece a **Configuração Inicial** para criar o administrador
   (as versões antigas não tinham usuários). Depois, faça o login.
6. Em **Backup e Manutenção**, clique em **Verificar integridade** e confira
   o **Status** (versão 1.2.0, banco versão 7).

Se o backup pré-migração não puder ser gravado, a migração **não começa**: o
programa mostra o motivo e não altera o banco. Nesse caso, libere espaço em
disco ou verifique permissões da pasta de dados e abra de novo.

Se a mensagem for sobre a tabela `lotes` com registros, abra a versão antiga,
exporte/limpe esses dados pela Manutenção e repita a atualização.

**Atenção:** depois da migração o banco fica no formato novo (versão 7) e a
versão antiga (1.1.x) **não consegue abri-lo**. Para voltar, use o backup
criado antes da atualização. O passo a passo está em
`docs/release/1.2.0/MIGRATION-1.1.17-TO-1.2.0.md`.

Os dados operacionais ficam no perfil local do aplicativo, **fora** da pasta do
programa. Atualizar ou reinstalar não deve apagá-los. Mesmo assim, crie e valide
um backup completo antes de atualizar.

## Desinstalação

Desinstalar o programa **não apaga automaticamente** os dados do usuário (configuração do instalador).

Se quiser apagar tudo, faça isso manualmente só depois de confirmar que tem backup.

---

<!-- docs/user/LOGIN.md -->

# Login e usuários: como entrar no programa

A partir da versão 1.2.0 o programa pede **login e senha**. Isso funciona
totalmente **sem internet**: os usuários ficam guardados no próprio computador,
junto com os dados das pesagens. Não existe conta na nuvem nem senha padrão.

## Primeira execução (Configuração Inicial)

Na primeira vez que o programa abre em um computador (ou depois de um
"Reset completo"), ele não tem nenhum usuário. Aparece a tela
**Configuração Inicial**, que cria o primeiro administrador:

1. Informe o **Nome do administrador** (como você quer aparecer no sistema).
2. Informe o **Login** (nome curto, sem espaços; ele não diferencia
   maiúsculas de minúsculas).
3. Informe a **Senha** e repita em **Confirmar senha**.
   - Mínimo de 6 caracteres.
   - Senhas fracas são recusadas (por exemplo `123`, `123456`, `admin` ou
     uma senha igual ao login).
4. Clique em **Criar administrador**. O programa volta para a tela de login.

Esse primeiro usuário tem o perfil **ADMIN** (veja `USUARIOS.md`). Guarde a
senha em um lugar seguro: **não existe recuperação automática de senha**.
Se o único administrador esquecer a senha, ninguém consegue entrar. Por isso,
recomendamos criar um segundo usuário ADMIN logo após a configuração inicial.

Se você atualizou de uma versão anterior (1.1.x), a Configuração Inicial
aparece uma única vez, depois que a migração dos dados terminar. Seus dados
de pesagem não mudam.

## Entrar (login)

1. Digite o **Login** e a **Senha**.
2. Clique em **Entrar**.

Se o login ou a senha estiverem errados, o programa mostra a mesma mensagem
("Login ou senha inválidos") sem dizer qual dos dois falhou. Isso é proposital.

Depois de **5 tentativas erradas seguidas** com o mesmo login, o programa
bloqueia novas tentativas por **30 segundos**. Espere e tente de novo.

A tela de login mostra a versão do programa no rodapé, para conferência.

## Trocar a senha na primeira entrada

Quando um administrador cria o seu usuário ou redefine a sua senha, o
programa exige que você **troque a senha na primeira entrada**. Você informa a
senha atual (a que recebeu) e a nova senha duas vezes. Só depois disso as telas
do sistema aparecem.

## Trocar a própria senha

Qualquer usuário pode trocar a própria senha quando quiser:

1. Clique no seu nome, no canto superior da tela (menu do usuário).
2. Escolha **Trocar senha**.
3. Informe a senha atual, a nova senha e a confirmação.

As regras são as mesmas da senha inicial (mínimo 6 caracteres, nada trivial).

## Bloquear a tela

Quando você se afasta do computador, use **Bloquear** no menu do usuário. A
tela de bloqueio esconde os dados e pede a **senha do mesmo usuário** para
continuar. Nada é perdido: o que estava aberto continua onde estava.

O programa também **bloqueia sozinho** depois de um tempo sem uso (padrão:
**60 minutos** sem teclado ou mouse). O administrador pode mudar esse tempo nas
configurações do sistema; o valor `0` desliga o bloqueio automático.

Na tela de bloqueio, **Trocar usuário** volta para a tela de login, para outra
pessoa entrar com o próprio login.

## Sair

**Sair**, no menu do usuário, encerra a sessão e volta para a tela de login.
Fechar o programa também encerra a sessão: ao abrir de novo, é preciso entrar.

## O que fica registrado

Cada lançamento, alteração, exclusão, backup, restauração e limpeza guarda
**quem fez** (nome e perfil do usuário). Isso aparece no histórico e no
diagnóstico. Registros feitos antes da versão 1.2.0 ficam sem usuário.

## Segurança das senhas

- A senha **nunca** é gravada em texto. O programa guarda apenas um código
  derivado dela (hash com sal aleatório por usuário), que não permite descobrir
  a senha original.
- A senha não aparece em backups textuais de diagnóstico, exportações CSV nem
  em mensagens de erro.
- O backup completo leva os usuários junto (com o código derivado, nunca a
  senha). Veja `BACKUP-E-RESTAURACAO.md`.

---

<!-- docs/user/TESTE-MAQUINA-LIMPA.md -->

# Teste em máquina limpa

Este roteiro valida o pacote Windows da versão **1.2.0** em um computador ou
usuário sem uma instalação anterior, e também a atualização a partir da 1.1.17.
Use somente um instalador acompanhado de `release-manifest.json` e SHA-256.
Se o instalador não tiver assinatura Authenticode, o resultado vale apenas como
diagnóstico, nunca como release oficial.

## Instalação e segurança

- [ ] Conferir nome (`Pesagens Individuais Setup 1.2.0.exe`), tamanho e SHA-256
      contra `release-manifest.json` (`installer.sha256`, `installer.sizeBytes`).
- [ ] Em **Propriedades > Assinaturas Digitais**, validar assinatura Authenticode,
      cadeia confiável e carimbo de tempo (ou registrar `signed: false`).
- [ ] Instalar sem desativar Defender, SmartScreen, WDAC ou App Control.
- [ ] Abrir pelo atalho e confirmar **Pesagens Individuais**.
- [ ] Confirmar que não há erro no `app.log` informado no diagnóstico.

## Primeira execução e login

- [ ] A primeira tela é a **Configuração Inicial** (nenhuma tela de dados aparece antes).
- [ ] Senha fraca (`123456`) e senha igual ao login são recusadas.
- [ ] Criar o administrador; a tela de **login** aparece com a versão **1.2.0** no rodapé.
- [ ] Login com senha errada mostra "Login ou senha inválidos"; 5 erros seguidos bloqueiam por 30 s.
- [ ] Login correto abre o sistema com nome, perfil ADMIN e versão na barra superior.
- [ ] **Bloquear** pede a senha do mesmo usuário; **Trocar usuário** volta ao login; **Sair** encerra.
- [ ] Em **Sistema › Usuários**, criar um GESTOR e um OPERADOR; cada um deve trocar a senha na primeira entrada.
- [ ] Como OPERADOR, o menu não mostra Usuários, Backup e Manutenção nem os botões de editar cadastros.
- [ ] Tentar desativar o único ADMIN é recusado.
- [ ] Em **Backup e Manutenção › Status**, confirmar versão **1.2.0**, banco **7**,
      backup formato **3**, build UI e build de dados (`schema-v7`) e armazenamento
      **IndexedDB local (Dexie)**.

## Cadastros

- [ ] Cadastrar uma marca, uma raça e um parceiro; marcar marca e raça como padrão.
- [ ] Nome repetido (mesmo nome com maiúsculas/espaços diferentes) é recusado.
- [ ] Categorias iniciais existem (Bezerro, Bezerra, Garrote, Novilha, Boi, Vaca, Touro).
- [ ] Propriedade "Propriedade principal" existe como própria e padrão.
- [ ] Inativar uma marca usada por um animal: some da seleção, animal continua exibindo a marca.
- [ ] Excluir só é permitido para item sem uso.

## Persistência na primeira execução

- [ ] Lançar um cadastro de animal (marca e raça escolhidas da lista) e uma pesagem.
- [ ] Fechar completamente o aplicativo.
- [ ] Abrir novamente, fazer login e confirmar que animal, pesagem e cadastros permanecem.
- [ ] Confirmar que nenhum SQLite, servidor, internet ou configuração manual foi solicitado.

## Backup e restauração

- [ ] Criar um backup completo JSON logo após a abertura; conferir formato 3 e usuários incluídos.
- [ ] Conferir o arquivo no catálogo com tamanho, data e SHA-256.
- [ ] Exportar CSV e JSON e abrir os arquivos.
- [ ] Executar **Verificar integridade**.
- [ ] Em uma base isolada, analisar e restaurar o backup; o programa pede login de novo.
- [ ] Restaurar um backup da **1.1.17** (formato 2): a análise avisa a conversão, a
      restauração converte e o programa volta para a Configuração Inicial.
- [ ] Reabrir e comparar contagens e somas.
- [ ] **Limpar dados operacionais**: pesagens somem, cadastros e usuários permanecem.
- [ ] **Reset completo**: exige backup validado, senha e confirmação; volta à Configuração Inicial.

## Atualização 1.1.17 → 1.2.0 (segunda máquina ou usuário)

- [ ] Instalar a 1.1.17, lançar dados de teste (marcas com grafias diferentes, uma morte, um comprador) e criar backup.
- [ ] Instalar a 1.2.0 por cima e abrir: backup pré-migração gravado e conferido; migração concluída sem erro.
- [ ] Fechar o programa no meio da migração e reabrir: continua de onde parou, sem duplicar.
- [ ] Configuração Inicial após a migração; cadastros montados a partir dos dados; relatório da migração legível.
- [ ] Verificar integridade verde; contagens iguais às da 1.1.17.

## Fluxos funcionais mínimos

- [ ] Cadastro e manejo do mesmo animal.
- [ ] Mesmo número em duas marcas, com escolha explícita.
- [ ] Pesagem retroativa e recálculo da cadeia de ganho/GMD.
- [ ] Saída por venda e por abate.
- [ ] Morte sem peso, com causa que exige observação.
- [ ] Apartação e transferência de lote.
- [ ] Importação CSV com `1.000,00`, data brasileira e campo entre aspas.
- [ ] Tema claro/escuro, filtros, modais e rolagem horizontal.

## Atualização e reinstalação

- [ ] Instalar a mesma versão por cima e confirmar a preservação de dados e usuários.
- [ ] Desinstalar e confirmar a política esperada para os dados do usuário.

## Resultado

- Data: _______________
- Computador/Windows: _______________
- Versão do instalador: _______________
- SHA-256: _______________
- Signatário (ou "sem assinatura — diagnóstico"): _______________
- Resultado: [ ] aprovado  [ ] reprovado  [ ] MANUAL PENDENTE
- Evidências/observações: _______________

---

<!-- docs/user/USUARIOS.md -->

# Usuários e perfis

Cada pessoa que usa o programa tem o seu próprio **usuário** (login + senha) e
um **perfil**, que define o que ela pode fazer. Existem três perfis fixos:

| Perfil | Para quem | Resumo |
|---|---|---|
| **ADMIN** | Responsável pelo sistema | Faz tudo, inclusive gerenciar usuários, restaurar backup, limpar dados e alterar configurações. |
| **GESTOR** | Escritório / gerência | Lança e consulta pesagens, mantém os cadastros, fecha sessões, consulta relatórios e cria backups. Não gerencia usuários nem restaura/limpa dados. |
| **OPERADOR** | Curral / campo | Lança pesagens e faz o cadastro rápido de animais. Consulta os cadastros, mas não os altera. Não acessa relatórios, backup nem configurações. |

Não é possível criar outros perfis nem editar permissões: o programa esconde
o que o perfil não pode fazer e também recusa a ação por dentro, mesmo que
alguém tente pelo caminho errado.

## O que cada perfil pode fazer

| Ação | ADMIN | GESTOR | OPERADOR |
|---|---|---|---|
| Lançar pesagens e manejos | sim | sim | sim |
| Consultar e editar pesagens | sim | sim | sim |
| Cadastrar animal (cadastro rápido no lançamento) | sim | sim | sim |
| Consultar cadastros (marcas, raças, parceiros etc.) | sim | sim | sim |
| Criar, alterar e inativar cadastros | sim | sim | não |
| Operações comerciais e embarques (versões seguintes) | sim | sim | não |
| Fechar e reabrir sessão de pesagem | sim | sim | não |
| Relatórios | sim | sim | não |
| Criar backup completo | sim | sim | não |
| Restaurar backup | sim | não | não |
| Limpar dados operacionais / Reset completo | sim | não | não |
| Continuar migração manualmente (Manutenção) | sim | não | não |
| Gerenciar usuários | sim | não | não |
| Configurações do sistema | sim | não | não |

## Tela Usuários (somente ADMIN)

Menu **Sistema › Usuários**.

### Criar um usuário

1. Clique em **Novo usuário**.
2. Informe **Nome**, **Login**, **Perfil** e uma **senha inicial**.
3. Salve.

O login precisa ser único (o programa ignora maiúsculas/minúsculas ao
comparar). Na primeira entrada, a pessoa é obrigada a trocar a senha inicial.

### Alterar nome, login ou perfil

Selecione o usuário e clique em **Editar**. A senha **não** é alterada por aqui.

### Redefinir a senha de alguém

Selecione o usuário e use **Redefinir senha**. Informe uma senha temporária; a
pessoa terá de trocá-la na próxima entrada. Use isso quando alguém esquecer a
senha.

### Desativar e reativar

Um usuário que saiu da equipe deve ser **desativado**, nunca excluído. O
usuário desativado não consegue entrar, mas continua aparecendo no histórico
de tudo o que fez. Para voltar, basta **reativar**.

**Regra importante:** o programa **nunca deixa desativar o último ADMIN
ativo**. Sempre precisa existir pelo menos um administrador que consiga entrar.
Se quiser trocar o administrador, primeiro crie o novo ADMIN e só depois
desative o antigo.

### Excluir

Usuários não são apagados. Isso protege o histórico (auditoria) de lançamentos,
backups e restaurações, que guarda quem fez cada ação.

## Lista de usuários

A lista mostra nome, login, perfil, situação (ativo/inativo) e o último acesso.
Ela **nunca** mostra senhas nem o código derivado da senha.

## Usuários e backup

- O backup completo inclui os usuários. Ao restaurar um backup, os usuários
  do backup **substituem** os atuais e o programa pede login de novo.
- Um backup de versão antiga (1.1.x) não tem usuários: depois de restaurá-lo,
  o programa volta para a **Configuração Inicial** e é preciso criar o
  administrador de novo. Isso é esperado. Veja `BACKUP-E-RESTAURACAO.md`.
- "Limpar dados operacionais" **preserva** os usuários. Só o "Reset completo"
  apaga tudo, inclusive usuários.

## Dicas

- Tenha pelo menos **dois** usuários ADMIN, para nunca ficar trancado fora.
- Use OPERADOR para quem só pesa no curral: menos opções na tela e menos
  risco de alteração acidental de cadastros.
- Cada pessoa com o próprio usuário: assim o histórico mostra quem fez o quê.

---

<!-- CHANGELOG.md -->

# Changelog — Pesagens Individuais

Todas as mudanças relevantes deste app desktop offline são registradas aqui.
Formato baseado em "Keep a Changelog"; versionamento semântico (MAJOR.MINOR.PATCH).

## [1.1.18] — 2026-09-14

Marco 1.1.18 do Programa Master de Evolução (ADR-047): baseline verde, contrato de
versão e governança. **Sem esquema novo** — Dexie 6 e backup formato 2 inalterados.
Instalador não gerado neste marco; teste físico NÃO EXECUTADO.

### Added
- Contrato de versão em quatro eixos (`src/versioning/versionInfo.js`): `APP_VERSION`,
  `DB_SCHEMA_VERSION` (= 6), `BACKUP_FORMAT_VERSION` (= 2), `RELEASE_MANIFEST_VERSION`
  (= 2), marcadores `UI_CONTRACT_VERSION` (`ModeloBase1-R34`), `DATA_CONTRACT_VERSION`
  (1), `DATA_BUILD_ID` (`schema-v6`), `BUILD_INFO` (commit e instante do build via
  `__BUILD_INFO__` do Vite) e `describeVersions()`.
- Gate `release:version-contract:verify` (`scripts/verify-version-contract.mjs`), incluído
  em `test:quick` e `test:full` logo após `release:current-only:verify`: package.json =
  package-lock = fallback de `appVersion.js`; notas e checklist da versão presentes;
  CHANGELOG com bloco datado e sem "Não lançado"; nenhum Setup ou manifesto de outra
  versão em `release/`/`release-unsigned/`; `RELEASE_MANIFEST_VERSION` único. Inclui
  `--self-test` com fixtures positivas e negativas em pasta temporária.
- Manutenção › Status do banco › **Versões**: Aplicativo, Esquema do banco, Formato do
  backup, Manifesto, Build (commit · data) e Contrato UI/dados; "Copiar diagnóstico"
  inclui os mesmos campos.
- Documentos de engenharia: `docs/engineering/VERSIONING.md`, `RELEASE-POLICY.md` e
  `AUTH-THREAT-MODEL.md` (o que o login local de 1.2.0 protege e o que não protege).
- ADR-041 a ADR-048 (DEC-023 a DEC-030), contratos 10–14 em revisão 2 e
  `docs/evidence/STATE-OF-REPO-BEFORE.md` incorporados à árvore do marco; evidências em
  `docs/evidence/s00-baseline-recovery/` e `docs/evidence/s00-versioning-auth-contract/`.
- Repositório Git inicializado em 14/09/2026 com a tag `v1.1.17-baseline` (commit
  `77eeb3b`) como ponto de partida imutável do programa.
- Massa de teste anônima e determinística (`src/modules/perf/testMass.js`) nos tamanhos
  vazia, pequena, 36 mil e 250 mil pesagens, no formato das stores Dexie
  (`npm run perf:testmass`).
- Bench de baseline (`src/modules/perf/baselineBench.js`) com p50/p95/p99 de carga
  inicial, índice de animais, identificação → peso, busca indexada por animal e por
  período, salvamento local e recarga; roda em Node (`npm run perf:baseline`) e no
  navegador/Electron. Contrato `perf:contract:verify` em `test:quick` e `test:full`.
- Captura visual das três telas em tema claro e escuro com massa pequena e userData
  isolado (`npm run evidence:screens`).
- Documentos F0: mapa de campos atual → modelo-alvo, catálogo de fórmulas com
  divergências D1–D7 e status da fase em `docs/arquitetura-produto/`.
- Referência renderizada do ModeloBase1 real em `docs/evidence/modelobase1-referencia/`;
  capturas das telas portadas em `docs/evidence/modelobase1-relacao-2026-09-14/` e
  `docs/evidence/modelobase1-cadastros-2026-09-14/`; estilos computados e capturas do
  design de Lançamento em `docs/evidence/design-lancamento-2026-09-09/`; baseline de
  desempenho em `docs/evidence/f0-baseline/` e `docs/evidence/program-2.0/phase-00/`.

### Changed
- `release-manifest.json` passa ao formato 2: `releaseManifestVersion`, `appVersion`
  (mantido `version` para compatibilidade), `dbSchemaVersion`, `backupFormatVersion`,
  `uiBuildId`, `dataBuildId`, `uiContract`, `dataContract`, `gitCommit`, `buildTimestamp`,
  `platform`, `arch`, `installer{file,sha256,sizeBytes,builtAt}`, `signed` (sempre
  `false` até Authenticode), `distribution` e `features`. O gerador exporta
  `buildReleaseManifest`/`writeReleaseManifest` para teste.
- `backupService.js` importa `BACKUP_FORMAT_VERSION` de `versionInfo.js` em vez de
  declarar a constante localmente (valor 2; comportamento e formato idênticos).
- `vite.config.js` define `__BUILD_INFO__` (commit curto via `git rev-parse`, com
  fallback `null`, e `buildTimestamp` ISO).
- `.gitignore` ancora `/release/` e `/release-unsigned/` na raiz para que
  `docs/release/<versão>/` seja rastreado pelo git.
- Relação de Pesagens e cadastros auxiliares (Parceiros, Mortalidade, Sanidade) passam a
  usar a Tela Mãe do Cadastro de Empresas do PROJETOMG-main: barra de ações
  `mg-action-bar` (Filtrar, ação principal, Editar/Excluir da seleção; pesquisa
  expansível com lista de resultados e "Buscar todos"; modos de visualização; menu "Mais
  opções" com Atualizar, exportar, importar, modelo e configuração de colunas), faixa
  `mg-table-panel-strip` com uma pílula de filtro por coluna e o botão de configurar
  colunas, e painel lateral `filter-panel` (260 px, campos rotulados por coluna, seleções
  e datas, Limpar/Aplicar).
- Cadastros auxiliares ganharam configuração de colunas (ordem e visibilidade guardadas
  por grupo) e pílulas de filtro por coluna, antes limitadas ao tipo.
- Componentes portados do modelo para `src/components/mak/`: `MgFilterPanel`,
  `MgDesktopSearch`, `MgSearchResultsDropdown`, `MgSpeedDialMenu`, `MgTablePanelStrip`,
  `MgCmdSelect`, `MgPortalPanel`, `useMgPanelPosition`, `mgSearchHighlight`. Bloco
  `D.17D.2R34` no `d17b-modelobase1.css` compõe a página; os estilos dos componentes já
  existiam em `mg-layout.css`. Contratos R34 em `ui:consistency:verify` protegem a
  estrutura das duas telas.
- Revisão R33: a tabela da tela de lançamento voltou a reutilizar o contrato visual da
  tabela Pesagens Individuais — cabeçalho, linhas, tipografia, cores, grade, zebra e modo
  escuro — preservando apenas os dados próprios da tela.
- Revisão R32: o campo Data do lançamento e o botão do calendário formam uma única
  superfície contínua, sem divisor interno, sombra duplicada ou troca de fundo no hover,
  nos temas claro e escuro.
- Revisão R31 refeita sobre o HTML final de 09/09/2026 (`Lançamento de Pesagens.dc.html`,
  projeto Claude Design `formulario-escopo`): controles com 28 px, faixa operacional com
  32 px, contornos verdes suaves, valores de identificação/peso em âmbar, ganho em verde,
  alerta em âmbar, tabela e painel lateral na proporção 3:1 e rodapé de 44 px; malha única
  de nove colunas iguais nas linhas de campos e de Apartação/Transferência; indicação
  automática do lote em pílula de três colunas; ações redondas da barra com fundo branco e
  borda `#d8dde5`; tabela em 12 px com cabeçalho `#17243a`/`#dfe5eb`, linhas de 26 px e
  zebrado `#fafbfc`; painel Distribuição de Lotes com seletor Dia/Total em pílula verde.
  Bloco `D.17D.2R29` no `d17b-modelobase1.css` concentra a paridade, com variantes de
  modo escuro; contratos `ui:consistency:verify` atualizados.
- A visualização inicial do lançamento reproduz as 14 colunas do modelo (as demais
  continuam no configurador). Configurações da versão anterior são migradas uma vez para
  esse padrão, sem alterar registros de pesagem.
- Ações Editar e Excluir da tabela de lançamento são exibidas somente por texto.

### Fixed
- Gates `ui:operational-customization:verify` e `ui:consistency:verify` (vermelhos na
  tag `v1.1.17-baseline`) realinhados ao contrato real do código, sem alterar código de
  produto (commit `8c79022`): o Lançamento seleciona compradores, vendedores e
  frigoríficos do registry e não usa mais `GerenciarSaidasDialog`; a alternância
  Registro/Tabela é validada por estrutura (`.view-seg`, slider, `VIEW_MODES`, rótulos
  acessíveis), não por sintaxe de template literal. `test:quick` volta a 20/20 (21/21 com
  o gate de versão).
- `main:boot:verify` voltou a passar: o stub do Electron em Node não definia
  `process.resourcesPath`, e o caminho do ícone empacotado (`main.cjs`) derrubava a
  verificação de boot desde a 1.1.16.
- Pesquisa expansível da Tela Mãe: a barra usa os 28 px do modelo e o campo dentro da
  pílula deixa de herdar fundo, altura de 38 px, raio e anel de foco dos inputs globais; a
  abertura não depende mais de `requestAnimationFrame` (aba sem pintura não trava mais a
  pílula fechada).
- A prévia do ganho aceita decimal e data brasileiros, ignora lançamentos futuros/mesmo dia
  e não conta o peso ainda não salvo como pesagem histórica.
- O campo composto Peso usa uma única borda de foco suave; corrigidos conflitos antigos
  que deixavam os títulos da faixa azuis e os rótulos de ganho escuros.

### Removed
- Nenhuma funcionalidade removida. O popup legado `GerenciarSaidasDialog` continua no
  repositório sem uso pelo Lançamento; sua remoção está prevista para o marco 1.4.0
  (ADR-031).

### Migration
- Nenhuma — esquema Dexie 6 e backup formato 2 inalterados. Backups de 1.1.16/1.1.17
  restauram sem conversão; nenhum dado é regravado.

### Security
- Nenhuma alteração; login local previsto para 1.2.0 (ADR-041…046). O modelo de ameaças
  já está documentado em `docs/engineering/AUTH-THREAT-MODEL.md`. Distribuição oficial
  continua bloqueada sem certificado Authenticode; nenhum pacote foi gerado neste marco.

## [1.1.17] — 2026-09-10

Build de diagnóstico (`release-unsigned/Pesagens Individuais Setup 1.1.17.exe`, sem assinatura
Authenticode), visual D.17D.2R31, baseado no arquivo `Lançamento de Pesagens.dc.html` de 09/09/2026.
Notas em `docs/release/1.1.17/`.

### Added
- Faixa única de Animal, Última, Ganho, tendência e avisos na tela de lançamento.

### Changed
- Tela de lançamento reconstruída com a malha, dimensões, cores, tabela, rodapé e painel lateral do
  modelo aprovado (R29–R33); visualização inicial com 14 colunas e demais campos em Configuração de colunas.
- Modo escuro e pop-ups conferidos com o mesmo sistema de componentes.
- Identificação por múltiplas marcas resolvida ao sair do campo, não durante a digitação.

### Fixed
- Prévia de ganho corrigida para números/datas brasileiros e ordem cronológica.

### Removed
- Nenhum.

### Migration
- Nenhuma — esquema Dexie 6 e backup formato 2 inalterados.

### Security
- Nenhuma alteração; pacote de diagnóstico sem assinatura (não é release oficial).

## [1.1.16] — 2026-09-04

### Corrigido
- Importações CSV e JSON passam pelo mesmo serviço transacional dos lançamentos,
  resolvem a identidade canônica por número e marca e recusam duplicidade de
  arquivo por SHA-256.
- A cronologia também é validada dentro do lote importado: segundo cadastro,
  evento anterior ao cadastro, evento após saída e saída retroativa com eventos
  posteriores abortam a transação inteira.
- A situação atual do animal, o lote vigente, o último peso e o histórico de
  lotes são reconstruídos a partir dos eventos válidos após criar, editar,
  cancelar ou importar.
- Aplicações de sanidade e medicamentos passam a ser persistidas e encerradas
  logicamente junto da pesagem, preservando a trilha histórica.
- Exclusões de cadastros auxiliares verificam vínculos antes da confirmação e as
  ações destrutivas usam o diálogo visual padrão.

### Alterado
- Rendimento de carcaça de venda e abate tornou-se configurável; peso vivo, peso
  de carcaça, arrobas e valor estimado são calculados com rótulos explícitos.
- Listagem do lançamento pagina 50 linhas e consultas por animal, data e lote
  utilizam índices Dexie; as rotas principais são carregadas sob demanda.
- A verificação de integridade cobre sessões, movimentos, lotes históricos,
  sanidade e propriedade dos identificadores, além das referências existentes.
- Backup físico validado passou a ser pré-condição de restauração, importação e
  limpeza; restauração confere SHA-256, versão, manifesto e contagem por store.
- Removidos nomes e caminhos ativos do backend legado; o runtime opera somente
  sobre IndexedDB/Dexie. Nenhum dado existente foi migrado ou regravado em massa,
  conforme decisão do responsável.

### Verificado
- Contratos de cálculo brasileiro, datas civis, ganho/GMD retroativo, identidade
  por marca, sanidade, importação atômica, backup, restauração, auditoria,
  cronologia e desempenho em base volumosa.
- Contrato visual protege hover dos botões primários, células de seleção,
  tipografia, campos, filtros, diálogos, modo escuro e rolagem de tabelas.
- Distribuição oficial continua bloqueada sem certificado Authenticode confiável;
  pacote sem assinatura é somente diagnóstico local.

## [1.1.15] — 2026-09-03

### Corrigido
- A conclusão da identificação do animal deixa de reconstruir todo o cadastro a
  cada `Tab`: animais registrados são indexados uma única vez por ID e número.
- O cálculo dos dados exibidos do animal selecionado reutiliza o histórico já
  memorizado e não percorre todos os lançamentos a cada alteração do peso.
- Identificação numérica ou nominal é normalizada em maiúsculas durante a
  digitação e também antes da persistência.

### Adicionado
- Animais identificados como `SN` solicitam Sexo, Raça, Era e Marca em um diálogo
  padrão antes de salvar.
- O novo `SN` recebe como valores iniciais os dados zootécnicos do `SN` salvo mais
  recentemente; os campos continuam editáveis antes da confirmação.
- Ensaio de desempenho com 36 mil lançamentos, 12 mil animais e 5 mil consultas
  indexadas, além de contratos de herança do perfil `SN` e caixa alta.

### Empacotamento
- `npm run dist` agora exige credenciais de assinatura, habilita
  `forceCodeSigning`, valida Authenticode no aplicativo e no instalador e somente
  então gera checksum e manifesto. Uma release oficial não pode mais ser gerada
  silenciosamente sem assinatura.
- Builds sem certificado foram isoladas no comando explícito
  `npm run dist:unsigned`, com saída em `release-unsigned/`, somente para testes
  locais e nunca para distribuição.
- A verificação final rejeita assinatura ausente, inválida, expirada,
  autoassinada ou sem carimbo de tempo.

## [1.1.14] — 2026-09-02

### Corrigido
- Hovers brancos dos botões de ícone do shell foram substituídos pelo estado
  neutro padrão do ModeloBase1, sem mudança de cor brusca ao passar o mouse.
- A escolha de animal quando o mesmo número existe em mais de uma marca é aberta
  assim que o número identifica o conflito, sem depender de perder o foco.
- Ganho de peso igual a zero passa a ser preservado como `0,00`, em vez de ficar
  vazio; cálculo ignora registros futuros e registros do mesmo dia.

### Adicionado
- Contrato de consistência visual para hovers de botão, pop-ups padronizados e
  abertura imediata da escolha de marca.
- Contrato de cálculo de ganho/GMD cobrindo datas, identidade por marca, ganho
  zero, ausência de histórico e exclusão de referências futuras.

## [1.1.11] — 2026-08-06

### Alterado
- Campos de lançamento, filtros e diálogos passam a usar uma borda única de
  1 px e brilho suave de 2 px no foco, sem `outline` espesso acumulado.
- O cadastro de sanidade foi separado em duas abas: `Sanidades` e
  `Medicamentos`, seguindo o mesmo shell de Apartações/Lotes.
- Sanidades aceitam condições por apartação e faixa de peso; o lançamento
  permite selecionar várias sanidades e aplicar sugestões compatíveis.
- Venda e abate deixam de depender de botões de olho e passam a usar cadastros
  reutilizáveis em popup, com ação `Usar no lançamento`.
- O painel direito recebe resumo personalizado com contagem, soma, média,
  mínimo, máximo e divisão de totais, filtrável por dia, apartação, venda ou abate.
- Tabelas internas de cadastros usam bordas, cabeçalhos, linhas, estados vazios
  e cantos arredondados uniformes.

### Verificado
- Persistência de regras de sanidade, perfis de venda/abate e configurações de
  resumo depois de fechar e reabrir o IndexedDB.
- Instalador Windows atualizado para 1.1.11 e marcador técnico
  `d17d2r16-configurable-health-exits-summaries-focus-installer-2026-08-06`.

## [1.1.10] — 2026-08-06

### Alterado
- Números inteiros passam a usar separador brasileiro de milhar (`1.000`) e
  decimais passam a usar vírgula (`1.000,00`) nas duas telas e nos resumos.
- Datas exibidas no sistema passam pelo contrato `DD/MM/AAAA`.
- Peso, ganho e arrobas deixam de anexar `kg` ou `@` ao valor; a unidade permanece
  somente no rótulo ou cabeçalho correspondente.
- Valores monetários usam o formato brasileiro de Real (`R$ 1.000,00`).
- Todos os oito diálogos adotam o mesmo shell visual, com três dimensões oficiais:
  compacto, médio e grande.

### Verificado
- Novo ensaio automatizado protege formatação brasileira, datas, unidades
  separadas e cobertura integral do contrato de diálogos.
- Instalador Windows atualizado para 1.1.10 e marcador técnico
  `d17d2r15-ptbr-format-standard-dialogs-installer-2026-08-06`.

## [1.1.9] — 2026-08-05

### Corrigido
- Apartações, lotes e configurações de sanidade voltam a aparecer imediatamente
  depois de salvar e continuam disponíveis ao fechar e reabrir o aplicativo.
- Padronizado o identificador de empresa entre formulários (`empresa_id`) e consultas
  (`empresaId`), com leitura compatível dos registros criados pelas versões anteriores.
- Criar, editar e excluir apartação, lote, sanidade e medicamento passam pelo mesmo
  contrato persistente do IndexedDB/Dexie.
- Atualização dos diálogos agora aguarda a releitura do banco antes de liberar uma
  nova operação.
- A sombra da tabela e da Distribuição de Lotes foi reduzida para deixar visíveis
  os recuos inferior e direito de 3 px.

### Verificado
- Novo ensaio automatizado fecha e reabre o banco e valida persistência, edição,
  exclusão e compatibilidade legada dos cadastros auxiliares.
- Instalador Windows atualizado para 1.1.9 e marcador técnico
  `d17d2r14-persistent-auxiliary-crud-spacing-installer-2026-08-05`.

## [1.1.8] — 2026-08-05

### Alterado
- Contrato D.17D.2R13: todos os recuos estruturais passam a 3 px em Relação de
  Pesagens, Lançamento, Manutenção, filtros, calendários e diálogos.
- Faixas, formulários, workspaces, tabelas, resumos e grids internos deixam de
  combinar espaçamentos diferentes; os contêineres usam a escala global de 3 px.
- A faixa operacional perde a borda superior verde de 3 px e volta a usar borda
  neutra uniforme de 1 px em todos os lados.
- O workspace cresce para ocupar toda a altura restante da janela.
- A Distribuição de Lotes atravessa a linha do resumo e termina no mesmo rodapé
  da tabela, enquanto o rodapé de totais permanece fixado na base da coluna.

### Corrigido
- Eliminado o espaço vazio abaixo de tabela, totais e painel de distribuição.
- Bordas externas da tabela, resumo e distribuição normalizadas pelo mesmo token.
- Instalador Windows atualizado para 1.1.8 e marcador técnico
  `d17d2r13-global-3px-full-height-installer-2026-08-05`.

## [1.1.7] — 2026-08-05

### Alterado
- Contrato D.17D.2R10: a linha de Tipo de Movimentação, visualização do resumo,
  Configurar colunas e Atualizar passa a ocupar uma faixa operacional autônoma.
- O formulário agora é um segundo card, contendo somente os campos do lançamento;
  a borda superior verde deixa o formulário e permanece no shell da faixa.
- Faixa, formulário e workspace usam recuos de 8 px entre si e acabamento de
  superfície, raio, borda e sombra equivalente à Relação de Pesagens.
- Os botões somente com ícone da faixa adotam o botão circular cinza oficial,
  sem contorno colorido ou fundo branco no hover.

### Corrigido
- Normalizados os recuos superior, inferior, esquerdo e direito do conteúdo de
  lançamento, incluindo o espaço inferior do shell rolável.
- Instalador Windows atualizado para 1.1.7 e marcador técnico
  `d17d2r10-separated-toolbar-shell-installer-2026-08-05`.

## [1.1.6] — 2026-08-05

### Alterado
- Contrato D.17D.2R9: o seletor Apartação/Venda/Abate e as ações de colunas e
  atualização foram reunidos na linha de Tipo de Movimentação.
- Atualizar e Configurar colunas agora são ações circulares somente com ícone;
  Atualizar deixa de ocupar uma faixa superior exclusiva.
- Removidos o título redundante `Pesagens do Dia` e a pesquisa de animal/lote.
- Tabela e painel de distribuição passam a iniciar na mesma coordenada e o botão
  Exportar adota o mesmo acabamento verde pill do botão Salvar.
- A tabela do lançamento passa a encostar na moldura, sem padding branco lateral;
  sua altura fica vinculada à altura do painel de distribuição.
- O formulário recebe a linha superior verde, a superfície e a sombra do mesmo
  contrato visual usado na barra da Relação de Pesagens.
- Campos e seletores operacionais usam fundo, altura, raio e contraste uniformes,
  incluindo o modo escuro.

### Corrigido
- O filtro avançado de cabeçalho passa a medir sua altura real e abre junto à
  coluna acionada, sem saltar para o topo da tela.
- Hovers neutros do lançamento deixam de usar fundo branco nos seletores, ícones,
  calendários, combos e ações auxiliares.
- Instalador Windows atualizado para 1.1.6 e marcador técnico
  `d17d2r9-launch-toolbar-filter-installer-2026-08-05`.

## [1.1.5] — 2026-08-05

### Corrigido
- Contrato D.17D.2R8: remoção do padding horizontal duplicado no container
  interno do Lançamento de Pesagens.
- Formulário, barra de ações, tabela e painel de distribuição passam a usar
  os mesmos recuos laterais de 10 px da Relação de Pesagens.
- Reserva invisível do `scrollbar-gutter` removida no estado sem rolagem,
  garantindo alinhamento idêntico também na lateral direita.
- Botões Editar/Excluir passam a exibir somente o nome, com 28 px de altura,
  padding horizontal de 14 px e formato pill idêntico a `Lançar pesagem`.
- Hovers de ações e botões de ícone deixam de trocar para fundo branco.
- Instalador Windows atualizado para 1.1.5 e marcador técnico
  `d17d2r8-launch-shell-gutter-installer-2026-08-05`.

## [1.1.4] — 2026-08-05

### Alterado
- Contrato D.17D.2R7: todos os campos principais do lançamento passam a ocupar
  colunas iguais, com 28 px de altura, raio de 8 px e espaçamento uniforme.
- Data, identificação, sexo, raça, era, marca, peso e observação deixam de usar
  larguras especiais; os campos condicionais de venda e abate seguem a mesma matriz.
- Botões exclusivos de ícone usam 28×28 px e formato circular em todos os estados.
- Ações Salvar/Atualizar/Cancelar ficam agrupadas na coluna oficial, sem alterar a grade.
- Tema escuro ajustado para rótulos, status, botões de ícone, seletor de resumo e barra de ações.
- Instalador Windows atualizado para 1.1.4 e marcador técnico
  `d17d2r7-launch-grid-icons-dark-installer-2026-08-05`.

## [1.1.3] — 2026-08-05

### Adicionado
- Checkpoint de empacotamento da migração visual ModeloBase1 D.17D.1/D.17D.2.
- Marcador técnico `d17d2r3-full-ui-audit-2026-08-05`, incluído no diagnóstico copiado pela
  tela de Manutenção e verificável nos bundles e no `app.asar`.
- Gate `packaged:ui-build:verify`, que bloqueia release com versão, manifesto,
  instalador ou bundle visual desatualizado.
- Refinamento de densidade D.17D.2R: filtros e botões em 28 px, cabeçalho/linha
  de tabela em 30/26 px, rodapé de registros reorganizado e calendário visual
  padronizado em Pesagens.
- Paridade D.17D.2R2 da consulta de Pesagens com o Cadastro de Empresas: faixa
  de filtros personalizados recolhível, navegação horizontal, pílulas compactas,
  ação `Novo` e menu de cabeçalho separado do filtro avançado.
- Auditoria D.17D.2R3: pop-ups de filtros com rascunho e confirmação, pesquisa e
  seleção múltipla de valores, intervalo de datas sem aplicação prematura,
  rolagem horizontal real da tabela, diálogos compactos e tema escuro persistente.
- Contrato D.17D.2R4: faixa personalizada e cabeçalho passam a reutilizar o mesmo
  editor de filtro; condições usam a listagem visual do ModeloBase1, datas não
  exibem ícone interno e todos os campos da tabela ficam disponíveis na configuração.
  Filtros numéricos oferecem intervalo com `Entre` inicial e `Peso` substitui os
  antigos filtros separados de mínimo e máximo.
- Contrato D.17D.2R5: checkboxes circulares de 20 px nas tabelas; ação
  `Lançar pesagem`; formulário, seleções e painéis de venda/abate em 28 px;
  seletor Apartação/Venda/Abate sem sobreposição; rolagem horizontal garantida;
  e dialogs de apartações, embarques e sanidades unificados, inclusive no modo escuro.
- Contrato D.17D.2R6: campos de preenchimento com raio oficial de 8 px; remoção
  do botão de rodapé `Fechar` quando o dialog já possui `X`; seleção da linha
  com transição e ações `Editar`/`Excluir`; confirmação de exclusão não nativa;
  e correção das superfícies claras residuais no modo escuro de listagem,
  lançamento, tabelas, resumos, distribuição e dialogs.

### Incluído no pacote
- Fundação visual ModeloBase1, shell, sidebar flutuante, topbar, page containers,
  cabeçalhos e barras de ação no estado atual.

### Nota
- Esta versão não declara igualdade visual final. Toolbar completa, filtros,
  tabela, formulários, dialogs e responsividade final permanecem pendentes.

## [1.1.2] — 2026-08-03

### Corrigido (crítico)
- App abria preso em "Aplicativo desktop necessário" na 1.1.1: o `DbBootstrap`
  ainda exigia `window.pesagemApp.entities`, removido do preload durante a
  limpeza. Agora o bootstrap apenas prepara o Dexie e mostra "Preparando o
  sistema…" / mensagem de erro clara se falhar.
- Rótulos da Manutenção: restauração usa backup `.json`; card de status mostra
  "Armazenamento: IndexedDB local (Dexie)" no lugar do tamanho do arquivo.

### Adicionado
- `preload:contract:verify`: cruza o que o renderer usa (`window.pesagemApp.X`)
  com o que o preload expõe e falha se a UI pedir API removida — teria pego o
  bug acima. Incluído em `test:quick` e `test:full`.

### Removido
- Instalador `Setup 1.0.0.exe` esquecido na raiz do projeto (93 MB — risco de
  ser instalado por engano), 8 arquivos vazios (`src/public/`, componentes
  placeholder, `App.css`) e `release/builder-debug.yml`.

### Nota
A versão **1.1.1 não deve ser usada** (tela travada).

## [1.1.1] — 2026-08-03

### Removido (limpeza de código morto)
- Todo o stack SQLite legado: `electron/database/**` (conexão, migrations,
  repositories, manutenção SQLite, migrações legadas), `electron/db.cjs` (JSON) e
  os 5 handlers IPC de banco (database/weighing/maintenance/auxiliary/sanidade).
- Dependência **better-sqlite3** (e `asarUnpack`/`postinstall` relacionados) —
  o instalador não carrega mais módulo nativo.
- 36 scripts de verificação obsoletos do SQLite (de 53 para 17).
- Botão "Abrir pesagens.json" e caminho do banco no cabeçalho (apontavam para o
  armazenamento legado).

### Corrigido
- "Limpar todos os dados" agora limpa o armazenamento atual (Dexie) — antes ainda
  apagava o JSON legado, sem efeito sobre os dados reais.

### Adicionado
- `main:boot:verify`: inicializa o main process com o Electron stubado e prova
  que o app sobe e registra os IPCs — rede de segurança para o enxugamento.
- `packaged:source:verify` reescrito: garante pacote sem better-sqlite3 e main enxuto.

## [1.1.0] — 2026-07-20

### Mudança principal (arquitetura de armazenamento)
- Banco operacional migrado de SQLite nativo (better-sqlite3) para
  **IndexedDB/Dexie** no renderer. Sem módulo nativo, sem app.asar.unpacked para
  banco, sem conexão SQLite no main, sem "Banco SQLite não inicializado".
- Todos os dataAdapters operacionais (weighing, apartações, sanidade, embarques)
  e a tela de Manutenção passam a usar `src/storage/storageAdapter.js` (Dexie).
- Backup completo (JSON de todos os stores), export CSV/JSON, import (dry-run+apply)
  e restore agora são Dexie; arquivos salvos em userData via IPC de arquivo.

### Notas
- SQLite/better-sqlite3 permanece no repositório como **legado morto** (fora do
  fluxo operacional). Ver docs/evidence/slice-d16-.../SQLITE-DETACHMENT.md.
- Use `Pesagens Individuais Setup 1.1.0.exe`. Sem login/permissões/cloud.

## [1.0.2] — 2026-07-20

### Corrigido (hotfix)
- Falha persistente "Banco SQLite não inicializado" no app instalado ao fazer
  backup. Introduzido um **runtime central de caminhos** (SSOT,
  `electron/database/databaseRuntime.cjs`) configurado no bootstrap; o
  `ensureDatabaseReady` passa a usar esse runtime.
- Todos os handlers de Manutenção usam o wrapper `withDatabaseReady`; o
  backupService também garante o banco pronto.

### Adicionado
- Tela de Manutenção mostra diagnóstico local (Versão, caminho do banco, caminho
  do log, status) + "Copiar diagnóstico". IPC `app:getDiagnosticInfo`.
- Log local em `userData/logs/app.log` (offline, sem telemetria) com eventos de
  bootstrap e de manutenção.
- Testes: `installed:runtime:diagnostic:verify`; `packaged:source:verify`
  ampliado (runtime + diagnóstico + versão do pacote).

### Notas
- Use somente `Pesagens Individuais Setup 1.0.2.exe`. Confirme "Versão: 1.0.2"
  na tela de Manutenção. Sem login/permissões/cloud; dados preservados.

## [1.0.1] — 2026-07-20

### Corrigido
- Backup no app instalado podia exibir "Banco SQLite não inicializado". A tela de
  Manutenção agora garante o banco pronto (`ensureDatabaseReady`) antes de
  backup/exportação/importação/restauração/integridade.
- Inicializador central `ensureDatabaseReady` extraído para um módulo
  independente (`electron/database/databaseReady.cjs`) — sem dependência circular.

### Adicionado
- Teste de regressão que exercita o handler IPC real do botão de backup.
- Verificação de que a correção entrou no pacote (`app.asar`).
- Identificação de Versão e caminho do Banco na seção de Diagnóstico da tela de
  Manutenção.
- Log local simples em `userData/logs/app.log` (offline, sem telemetria).

### Notas
- Use somente o instalador `Pesagens Individuais Setup 1.0.1.exe`.
- Sem login/permissões/cloud/servidor. Dados preservados na atualização.

## [1.0.0] — 2026-07-16

Primeira versão distribuível.

### Adicionado
- App desktop Electron + React (Vite) + better-sqlite3, offline e local.
- Persistência SQLite (`pesagens.db`) em `%APPDATA%\pesagens-individuais\data`.
- Migrations 001–003 (schema inicial, entidades auxiliares, sanidade/embarque).
- Entidades operacionais SQLite-only: Pesagem Individual, Apartação/Lote,
  Sanidade (configuração, itens, animal), Embarque/Documentos.
- Tela **Manutenção**: backup do banco, exportar CSV/JSON, importar,
  restaurar (`.db`) e verificar integridade.
- Instalador NSIS x64 (wizard, pasta alterável, atalhos de área de trabalho e
  menu iniciar), preservando dados do usuário na reinstalação/desinstalação.
- Documentação de usuário em `docs/user/` (guia rápido, backup/restauração,
  exportação, instalação Windows, checklist de máquina limpa).

### Notas
- `pesagens.json` mantido apenas como legado/backup (não é apagado).
- Sem login, permissões, cloud ou servidor — por decisão de simplicidade.
- Ícone: default do Electron (pendência de asset de marca).
- Sem assinatura digital (SmartScreen pode alertar) — ver
  `docs/evidence/slice-d10-final-packaging-clean-machine/CODE-SIGNING.md`.

[1.0.0]: primeira release
## [1.1.12] — 2026-08-13

- Corrigida a seleção de lotes na importação: lotes desmarcados não retornam ao processamento.
- Adicionada seleção coletiva de lotes encontrados no arquivo importado.
- Normalização de nomes de lote/apartação na importação, tolerando diferenças de caixa e espaços.
- Atualizados os seletores de importação de saída e o pacote visual D.17D.2R17.
## [1.1.13] — 2026-08-13

- Barra de rolagem padronizada entre o navegador de desenvolvimento e o aplicativo Electron instalado.
- Largura fixa de 10 px, trilho, cursor, canto e modo escuro explicitamente aplicados à tabela de pesagens.
- Adicionado contrato automatizado para impedir que prioridades de CSS alterem a scrollbar no pacote instalado.
