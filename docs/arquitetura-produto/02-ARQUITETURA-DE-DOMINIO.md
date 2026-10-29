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
