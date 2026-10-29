# Pesagens Individuais 1.5.6 — notas da versão

Data: 29/10/2026 · Esquema Dexie 8 (sem mudança) · Backup formato 3 · Instalador não assinado.

Estabilização da balança S3, segurança (Electron 44) e listas atualizadas entre telas.

## O que muda para quem usa
- **Balança S3 mostra "estável" de novo:** quando o monitor trava o peso, o campo Peso do
  Lançamento passa a estável em meio segundo. O S3 (firmware 1.2.6 ou mais novo) só envia o
  peso quando ele muda, e o programa ficava esperando uma leitura que não vinha.
- **Relação de Pesagens sempre atualizada:** depois de lançar no Lançamento (ou importar,
  ou restaurar um backup), a Relação já mostra as pesagens novas ao voltar para ela.
  Antes era preciso clicar em Atualizar ou reiniciar o programa.
- **Edições em lote da Relação com os cadastros novos:** marcas, categorias, apartações,
  lotes e embarques criados depois de abrir a Relação aparecem nas listas das edições em lote.
- **Mais seguro:** Electron 44 (o 35 estava sem atualizações de segurança) e nenhuma
  vulnerabilidade conhecida nas bibliotecas.

## Conferir com a balança
- A troca do Electron mexe na base do programa. Na primeira pesagem com a balança
  (serial ou Bluetooth), confira a conexão, a pesagem automática e a estabilização:
  com o LED vermelho do S3 aceso, o campo Peso deve ficar estável em até meio segundo.

## Atualização
- Da 1.5.5 (ou anterior): backup, feche o programa e rode o **Setup 1.5.6** por cima.

## Assinatura
- Instalador sem assinatura: SmartScreen → "Mais informações › Executar assim mesmo".
