# Pesagens Individuais 1.6.2 — notas da versão

Data: 2026-11-05 · Banco: Dexie **9** (sem migração a partir da 1.6.0/1.6.1) · Backup: formato **3** · Pacote não
assinado.

## Lançamento de Pesagens

- **"Esse peso já foi usado no animal anterior" sem ter lançado.** Com a balança sem tara, o próximo animal não era
  liberado porque a plataforma vazia nunca ficava abaixo de 10 kg. Agora o peso cair para menos de 1/4 do peso
  salvo também libera. Se ainda assim aparecer com outro animal na balança, o aviso traz **Liberar peso**.
- **"Selecione o animal cadastrado" com o animal cadastrado.** Digitar o número e salvar na hora agora reconhece o
  animal.
- **Animal que entrou sem peso.** No Manejo, em vez de "não cadastrado", o sistema avisa que ele entrou sem peso e
  oferece **Pesar em Entrada** (a 1ª pesagem usa o mesmo animal).

## Filtros

- **Condição do filtro vale.** Maior que, Menor que, Começa com, Termina com, Antes de e Depois de pedem um valor
  digitado; a lista de valores fica nas condições Contém, Não contém, É igual a e É diferente de.
- **Listas não ficam mais atrás do filtro.** A lista de condições e os demais menus abrem por cima.

## Atualização

Execute o **Pesagens Individuais Setup 1.6.2.exe** por cima da versão instalada. Faça antes um backup em Backup e
Restauração. Vindo da 1.5.x, vale o roteiro de migração da 1.6.0 (`docs/user/INSTALACAO-WINDOWS.md`).

## Testes

- `e2e:filters-scale:verify` (novo, Electron real com dados sintéticos e balança simulada).
- `captureGate.test.js`: balança sem tara, o mesmo animal mexendo, Liberar peso (estável e vazio).
- `test:quick`, `lint`, `test:unit` e os E2E do Lançamento.
- Homologação física pendente: balança S3 real no Windows.
