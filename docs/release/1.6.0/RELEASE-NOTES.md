# Notas da versão 1.6.0

A versão **1.6.0** junta as correções de estabilidade (P01–P26) e a gestão do rebanho (F01–F26) da missão
pesagens-integrada.

- **Banco:** passa da versão 8 para a **9**.
- **Atualização:** na primeira abertura, a **migração automática** grava e confere um backup da versão anterior.
  Os dados existentes não são reescritos.
- **Formato do backup:** continua o 3. Quando há documentos com arquivo, o backup leva também a pasta `.anexos`.

## O que muda para quem usa

- **Rebanho:**
  - Entradas, Saídas e Movimentações, inclusive sem pesagem;
  - Inventário do período;
  - Identificadores (estoque de brincos);
  - ficha do animal com idade, dentição, documentos e dossiê.
- **Sanidade:** posologias aprovadas, dose sugerida e carência no abate.
- **Relatórios › Desempenho:** ranking com amostra, quem perde peso, seca por lote, metas e projeção.
- **Sistema:**
  - **Backup e Restauração**, com backup periódico, cópia externa, backup protegido e restauração guiada;
  - **Manutenção avançada**;
  - **Parametrização**;
  - **Balança e Equipamentos**.

## Antes de atualizar

1. Na 1.5.x, use **Criar backup agora** e copie o arquivo para um pendrive.
2. Instale a 1.6.0 por cima.
3. Na primeira abertura, aguarde a migração terminar.

Para voltar à versão anterior, veja `docs/evidence/pesagens-integrada/MIGRACAO-ROLLBACK.md`.

## Pendente de homologação

| Item | O que falta | Roteiro |
|---|---|---|
| **P16** | Teste com a balança S3 física, no Windows | `VALIDACAO-MANUAL-WINDOWS-S3.md` |
| **P18** | Proteção da branch main no GitHub, que é ação do proprietário | `RECOMENDACAO-P18.md` |

Esta versão **não é publicada** (sem tag nem release) até a revisão do proprietário.
