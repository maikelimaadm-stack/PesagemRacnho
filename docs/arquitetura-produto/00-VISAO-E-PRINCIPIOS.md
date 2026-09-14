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

