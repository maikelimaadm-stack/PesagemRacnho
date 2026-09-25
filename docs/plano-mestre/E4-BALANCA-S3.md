# E4 — Balança Tru-Test S3, fase A: contrato, simulador, importação e captura (sem mudança de esquema)

## Fatos (fontes no 00-LEIA-PRIMEIRO §7)

- S3: conector serial, USB e Bluetooth; ~100 sessões; sem EID embutido (bastão externo via Bluetooth).
- Caminho oficial Datamars: Data Link PC por USB, gravação por sessão em arquivo. Protocolo de
  comunicação ao vivo NÃO é publicado → precisa ser capturado no aparelho da responsável.

## 1. Contrato único de balança — `src/modules/equipment/`

```
ScaleReading = { weightKg: number|null, stable: boolean, unit: 'kg', at: ISOString,
                 source: 'S3' | 'SIMULADOR' | 'MANUAL' | 'ARQUIVO', raw?: string, animalEid?: string }
ScaleAdapter = { id, label, connect(opts), disconnect(), onReading(cb) → unsubscribe, status() }
```
- `scaleService` escolhe o adaptador configurado, repassa leituras ao Lançamento e detecta
  estabilidade própria (mesmo valor ± 0,5 kg por 1,0 s, configurável) quando o aparelho não informa.
- Campos novos na pesagem (não indexados, sem bump de esquema): `peso_origem`
  (BALANCA | MANUAL | ARQUIVO), `balanca_id`, `peso_bruto_raw` (opcional, só em modo diagnóstico).
- Relatório "Pesagens" ganha coluna/agrupamento "Origem do peso" (auditoria de peso digitado).

## 2. Simulador

`SimulatorAdapter`: gera pesos com oscilação, estabiliza, repete; atalhos no modo dev
(`ELECTRON_DEV=1`) e usado nos gates. Permite desenvolver E9 sem o aparelho.

## 3. Importar sessão do Data Link

- Assistente em Importação › "Sessão de balança (Tru-Test)": reusa o motor `src/modules/import`
  (idempotência por hash, reconciliação, relatório de importação).
- Mapeamento: VID/ID visual → número do animal; EID → identificador RFID; peso; data/hora.
- **Pendência da responsável:** exportar uma sessão real no Data Link e colocar o arquivo em
  `docs/evidence/e4/amostras/`. Sem amostra, implementar o mapeamento configurável e marcar o layout
  exato como NÃO VALIDADO no REPORT.

## 4. Diagnóstico e captura do protocolo (Manutenção › Equipamentos)

- Usar **Web Serial** e **Web Bluetooth** nativos do Electron (handlers `select-serial-port` e
  `select-bluetooth-device` no main; permissões restritas a esta tela). Sem módulo nativo nesta fase.
- Tela lista portas/dispositivos, abre com velocidade selecionável (9600, 19200, 38400, 57600, 115200;
  8N1), mostra bytes em HEX + ASCII com carimbo de hora e botão "Salvar captura" →
  `userData/equipment-captures/<data>-s3.log`.
- Roteiro na tela para a responsável: ligar S3 por USB; pesar 10 vezes um objeto de peso conhecido;
  anotar os pesos exibidos; salvar captura; repetir por Bluetooth.
- A captura volta para o repositório em `docs/evidence/e4/capturas/` e é a entrada da E9.

## 5. Configuração

Configurações › Equipamentos: balança ativa (Nenhuma, Simulador, Tru-Test S3), conexão (USB/Serial,
Bluetooth), porta, velocidade, critério de estabilidade, "confirmar peso com Enter" ou
"gravar automaticamente ao estabilizar".

## 6. Gates

`equipment:contract:verify` (adaptadores cumprem o contrato), `equipment:simulator:verify`
(estabilidade, queda de conexão não trava o lançamento), `import:scale-session:verify`,
`preload:contract:verify` atualizado (nada de acesso livre a portas pelo renderer fora da tela).

## 7. Aceite humano

1. Com Simulador ativo, o peso aparece sozinho no Lançamento e grava ao Enter.
2. Desligar o simulador no meio: o lançamento continua aceitando peso digitado (marcado MANUAL).
3. Importar uma sessão real do Data Link → animais e pesos corretos, reimportar não duplica.
4. Fazer a captura com o S3 e salvar o arquivo de log.
