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

