# Arquitetura de Produto — Pesagens Individuais

**Versão documental:** 1.0  
**Data-base:** 08/09/2026  
**Estado do produto analisado:** 1.1.17  
**Responsabilidade:** fonte de verdade para evolução funcional e técnica

## Finalidade

Este diretório descreve o produto que será construído a partir da aplicação
desktop atual. Ele separa claramente:

- o que já existe e pode ser reutilizado;
- o que é requisito futuro;
- o que está fora de escopo;
- como os domínios se relacionam;
- quais cadastros, relatórios e integrações serão entregues;
- em que ordem o trabalho deve ocorrer;
- quais evidências são necessárias para considerar cada entrega concluída.

Auditorias em `docs/auditoria` e registros em `docs/evidence` continuam válidos
como evidência histórica, mas não definem a arquitetura futura. Alguns desses
documentos retratam versões antigas baseadas em JSON, SQLite ou sanidade. Para
decisões novas, este diretório prevalece.

## Norte do produto

> Ser a ferramenta mais rápida e confiável para pesagem individual, histórico
> de desempenho, apartação, lotes e fechamento comercial no curral, funcionando
> sem internet e preparada para sincronização e equipamentos.

O produto não será transformado imediatamente em um ERP rural genérico. Toda
funcionalidade deve melhorar pelo menos um destes resultados:

1. velocidade de trabalho no curral;
2. qualidade e rastreabilidade do dado;
3. decisão sobre desempenho e destino dos animais;
4. conferência operacional e comercial;
5. segurança de operação offline.

## Mapa da documentação

| Documento | Pergunta respondida |
|---|---|
| [00-VISAO-E-PRINCIPIOS.md](./00-VISAO-E-PRINCIPIOS.md) | Que produto estamos construindo e sob quais princípios? |
| [01-ESTADO-ATUAL-E-LACUNAS.md](./01-ESTADO-ATUAL-E-LACUNAS.md) | O que existe hoje e o que falta? |
| [02-ARQUITETURA-DE-DOMINIO.md](./02-ARQUITETURA-DE-DOMINIO.md) | Quais são os módulos, entidades e regras centrais? |
| [03-CADASTROS-E-FLUXOS.md](./03-CADASTROS-E-FLUXOS.md) | Quais cadastros e operações existirão? |
| [04-RELATORIOS-E-INDICADORES.md](./04-RELATORIOS-E-INDICADORES.md) | Quais relatórios serão produzidos e como serão calculados? |
| [05-INTEGRACOES-E-EQUIPAMENTOS.md](./05-INTEGRACOES-E-EQUIPAMENTOS.md) | Como balanças, RFID, arquivos e serviços externos entrarão no sistema? |
| [06-OFFLINE-SINCRONIZACAO-E-SEGURANCA.md](./06-OFFLINE-SINCRONIZACAO-E-SEGURANCA.md) | Como preservar o offline e adicionar login/base online com segurança? |
| [07-ROADMAP-E-CRITERIOS-DE-ACEITE.md](./07-ROADMAP-E-CRITERIOS-DE-ACEITE.md) | Em qual ordem implementar e como provar que ficou pronto? |
| [08-DECISOES-ARQUITETURAIS.md](./08-DECISOES-ARQUITETURAIS.md) | Quais decisões são obrigatórias e quais estão pendentes? |
| [09-PESQUISA-E-REFERENCIAS.md](./09-PESQUISA-E-REFERENCIAS.md) | Quais produtos e fontes embasaram o desenho? |

## Entregas por fase

| Documento | Fase | Conteúdo |
|---|---|---|
| [F0-STATUS.md](./F0-STATUS.md) | F0 | Situação das entregas da fase, evidências e decisões pendentes |
| [F0-01-MAPA-DE-CAMPOS.md](./F0-01-MAPA-DE-CAMPOS.md) | F0 | Campos atuais (Dexie v6) → modelo-alvo, com status e lacunas |
| [F0-02-CATALOGO-DE-FORMULAS.md](./F0-02-CATALOGO-DE-FORMULAS.md) | F0 | Fórmulas implementadas, testes que as protegem e divergências D1–D7 |
| [../evidence/f0-baseline/BASELINE.md](../evidence/f0-baseline/BASELINE.md) | F0 | Baseline p50/p95/p99 nas massas vazia, pequena, 36 mil e 250 mil |
| [F1-STATUS.md](./F1-STATUS.md) | F1 | Avanço de desempenho, contrato visual v2, evidências e pendências da fase |
| [../evidence/f1-optimized-final/BASELINE.md](../evidence/f1-optimized-final/BASELINE.md) | F1 | Benchmark otimizado de 36 mil registros após o recálculo incremental |

## Convenções de status

- **Atual:** existe no código ativo e foi localizado na revisão.
- **Parcial:** existe uma fundação, mas o fluxo não está completo.
- **Planejado:** aprovado para o roadmap, ainda sem implementação.
- **Opcional:** somente entra após decisão expressa e análise de custo.
- **Fora de escopo:** não deve ser implementado sem nova decisão arquitetural.

## Regra de manutenção

Toda mudança relevante deve atualizar, no mesmo trabalho:

1. o documento de domínio ou integração afetado;
2. o roadmap e seus critérios de aceite;
3. o registro de decisões, quando houver mudança de direção;
4. os testes automatizados correspondentes;
5. a documentação do usuário, quando o comportamento ficar disponível.
