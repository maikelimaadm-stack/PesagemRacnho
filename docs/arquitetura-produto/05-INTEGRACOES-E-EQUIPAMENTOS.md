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

