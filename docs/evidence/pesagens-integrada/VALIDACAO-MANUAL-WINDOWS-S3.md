# Validação manual — Windows + balança Tru-Test/Datamars S3

**Estado:** PENDENTE DE HOMOLOGAÇÃO FÍSICA. Nenhum item abaixo foi executado com o equipamento real
nesta missão: o ambiente de desenvolvimento não tem balança. O que foi provado automaticamente está no fim.

Roteiro para o proprietário, no computador do curral, com o instalador diagnóstico do PR (artifact
`instalador-windows` do workflow *Gerar instalador*).

## Preparação
1. Fazer backup completo antes (Backup e Manutenção › Criar backup agora) e guardar o arquivo fora do PC.
2. Anotar a versão do firmware da S3 (menu do indicador ou app Datamars Pro/Data Link). A partir da 1.2.6
   o S3 só envia o peso pelo Bluetooth quando ele muda.
3. Configurações › Equipamentos: conectar a S3 (Bluetooth) e conferir "Conectado a …".

## Cenários (marcar OK / FALHOU e anotar o que apareceu)

| # | Cenário | Esperado |
|---|---|---|
| 1 | Plataforma vazia, pesagem automática ligada | campo Peso mostra 0/vazio, sem "estável"; Salvar recusa ("Ainda não chegou peso" ou "Peso ainda não estabilizou") |
| 2 | Boi A sobe e se mexe | campo acompanha o monitor, borda girando ("estabilizando"); Salvar recusa enquanto o monitor oscila |
| 3 | Monitor da S3 trava o número (LED vermelho) | em até ~0,5 s o campo fica estável; Salvar grava o peso inteiro do monitor (ex.: 328,4 → 328) |
| 4 | Logo após salvar o A, com o A ainda na balança, identificar o boi B e Salvar | **recusa**: "Esse peso já foi usado no animal anterior…"; o campo fica cinza (aguardando) |
| 5 | A desce (plataforma vazia), B sobe e estabiliza | Salvar grava o peso do B |
| 6 | A desce e B sobe quase junto (sem zerar) | depois de estabilizar num peso diferente do A, Salvar grava o B |
| 7 | B com peso igual ao do A (± 1 kg) sem esvaziar a plataforma | recusa com "O peso estável é o mesmo do animal anterior…"; esvaziar a plataforma libera |
| 8 | Desligar o Bluetooth do PC (ou a S3) com o boi na balança | status "Bluetooth caiu — reconectando…"; Salvar recusa ("Balança desconectada…") |
| 9 | Religar; o mesmo boi continua na balança | ao reconectar, Salvar pede leitura nova; se o peso já tinha sido usado, continua pedindo o próximo animal |
| 10 | Desligar a pesagem automática e digitar o peso | grava com origem MANUAL; os ticks da balança não sobrescrevem o que foi digitado |
| 11 | Enter duas vezes rápido no Salvar | uma pesagem só |
| 12 | Repesagem do mesmo animal no mesmo dia (Manejo) | diálogo "Repesar?"; confirma → uma pesagem valendo |

Para os casos 3 a 7, conferir na Relação de Pesagens que o peso gravado é o inteiro do monitor. A leitura
bruta fica gravada em `balanca_leitura.kg_bruto` (ex.: 328,4), com a origem `peso_origem = BALANCA`.

## Ajustes, se o comportamento não bater

- **Estável cedo demais ou tarde demais:** ajustar `stabilityMs` (padrão 500 ms) e `stabilityKg` (tolerância,
  padrão 0,5 kg) da configuração da balança.
- **O curral não passa por plataforma vazia entre os animais:** ajustar `emptyThresholdKg` (padrão 10 kg)
  ou `rearmDeltaKg` (variação que conta como troca de animal, padrão 30 kg).

## O que já está provado sem a balança (automático)

- **Unidade:** `src/modules/equipment/domain/stabilityTracker.test.js` (estável pelo silêncio, tolerância e
  firmware antigo) e `src/modules/equipment/domain/captureGate.test.js` (A→B sem leitura nova, plataforma
  vazia, troca sem esvaziar, mesmo peso, oscilação, queda, reconexão, zero e cancelamento).
- **Serviço:** `src/modules/equipment/application/scaleService.test.js`, com adaptador controlado, cobre:
  - leitura numerada e época;
  - P01, com o animal seguinte sem leitura nova;
  - P02: oscilação por mais de 5 s faz `captureWeightForLaunch` rejeitar, sem inventar estável;
  - P03: queda do link, desconectar pela tela e troca de aparelho;
  - sequência monotônica.
- **App real (Electron, simulador no modo S3):** `scripts/verify-electron-e2e.mjs` cobre:
  - campo chegando a estável;
  - animal 7003 salvo com `peso_origem = BALANCA` e bruto 328,4;
  - animal 7004 recusado sem a balança mudar.

  Esse teste falha se o portão for desligado.
