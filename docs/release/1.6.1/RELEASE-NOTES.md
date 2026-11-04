# Pesagens Individuais 1.6.1 — notas da versão

Data: 2026-11-04 · Banco: Dexie **9** (sem migração a partir da 1.6.0) · Backup: formato **3** · Pacote não assinado.

## O que mudou no Lançamento de Pesagens

- **O peso não zera ao trocar de modo.** Com a pesagem automática ligada e o animal parado na balança, trocar entre
  Entrada, Manejo e Saída mantém o Peso e o estado da balança. Salvar continua exigindo peso estável e novo.
- **Quadro de peso e lote destino.** Opcional, ao lado da Distribuição de Lotes (ícone de balança no título). Mostra
  o peso do campo e o lote destino em letra grande, em verde (estável), amarelo (estabilizando), cinza (peso já usado)
  ou azul (digitado). Alterna Grande/Pequeno; fica lembrado no computador.
- **Bip de peso estável.** Um toque de 1 s quando o peso estabiliza; não toca com a balança vazia nem duas vezes
  para o mesmo animal. Liga/desliga em Sistema › Balança e Equipamentos.
- **A lida é lembrada.** Sair do Lançamento e voltar mantém o Motivo da Entrada, a sequência de brincos com o próximo
  número e a pesagem automática.

## Atualização

Execute o **Pesagens Individuais Setup 1.6.1.exe** por cima da 1.6.0. Faça antes um backup em Backup e Restauração.
Vindo da 1.5.x, vale o roteiro de migração da 1.6.0 (`docs/user/INSTALACAO-WINDOWS.md`).

## Testes

- `e2e:weight-board:verify` (novo): troca Entrada → Manejo → Entrada com a balança estável, o Peso continua 328 e
  salva; quadro desligado por padrão, mesmo peso e lote do formulário, Grande/Pequeno lembrado, sem rolagem
  horizontal em 1440 e 1024 px.
- `e2e:launch-session:verify`, `e2e:electron:verify`, `e2e:launch-integration:verify`, `test:unit`, `lint`.
- Homologação física pendente: balança S3 real no Windows.
