# 01 — Estado atual e mapa de lacunas

## 1. Base analisada

- Aplicação: Pesagens Individuais 1.1.17
- Shell: Electron 35
- Interface: React 18 + Vite + Radix/Tailwind
- Persistência ativa: IndexedDB com Dexie, esquema versão 6
- Distribuição atual: NSIS x64
- Funcionamento: local/offline

Documentos antigos que descrevem JSON ou SQLite são históricos. Não devem ser
usados como representação do runtime atual.

## 2. Capacidades atuais confirmadas

| Capacidade | Estado | Observação |
|---|---|---|
| Banco local versionado | Atual | Dexie/IndexedDB, esquema v6 |
| Pesagem individual | Atual | Cadastro, manejo e saída |
| Animal canônico | Atual | UUID e projeção de situação |
| Número + marca | Atual | Desambiguação de números repetidos |
| Identificadores do animal | Parcial | Estrutura existe; falta UI completa para RFID/SISBOV |
| Histórico de peso | Atual | Peso anterior, ganho, dias e GMD |
| Recálculo retroativo | Atual | Série recomposta após alterações |
| Histórico de lote | Atual | Intervalos de permanência reconstruídos |
| Sessão de pesagem | Parcial | Entidade e vínculo existem; falta experiência de abrir/fechar sessão |
| Auditoria | Parcial | Persistência existe; falta consulta administrativa completa |
| Apartações e lotes | Atual | Capacidade e faixa de peso |
| Motor de regras | Parcial | Regra básica de lote; falta composição, prioridade e explicação |
| Compra, venda e abate | Atual | Dados e cálculos comerciais básicos |
| Embarque e documentos | Atual | Cadastros e vínculos locais |
| Importação | Atual | Controle transacional e hash |
| Exportação | Atual | CSV/JSON e relatórios operacionais pontuais |
| Backup/restauração | Atual | Integridade SHA-256 e confirmação segura |
| Verificação de integridade | Atual | Referências e identificadores |
| Relatórios analíticos | Parcial | Resumos existem; falta catálogo formal e drill-down uniforme |
| Integração com balança | Planejado | Nenhum driver ativo |
| RFID/EID | Planejado | Modelo de identificadores ajuda, mas falta adaptador |
| Login e permissões | Planejado | Ainda não implementado |
| Base online/sincronização | Planejado | Deve preservar o offline-first |
| SISBOV/GTA/NF-e oficial | Opcional | Depende de acesso, homologação e regras externas |
| Sanidade | Fora de escopo | Removida do esquema v6 por decisão expressa |

## 3. Forças que devem ser preservadas

1. funcionamento local sem servidor;
2. identidade animal separada dos lançamentos;
3. transações e recálculo do histórico;
4. exclusão lógica e auditoria;
5. importação idempotente por arquivo;
6. backup verificável;
7. formatação brasileira;
8. separação entre peso vivo, carcaça, arrobas e valor;
9. ModeloBase1 como contrato visual;
10. suíte automatizada existente.

## 4. Lacunas de maior impacto

### L1 — Sessão não é o centro da operação

Embora o banco tenha `sessoesPesagem`, a interface ainda trabalha
principalmente como lançamento de registros do dia. Falta ciclo explícito:
rascunho → aberta → em conferência → encerrada → reaberta sob auditoria.

### L2 — Equipamento ainda exige operação manual

Sem adaptador para balança e leitor, peso e identificação dependem de digitação
ou importação. Isso limita velocidade e aumenta risco de erro.

### L3 — Apartação ainda é pouco expressiva

Faixa de peso e capacidade são um começo. O produto precisa combinar critérios,
prioridades, exceções, simulação e registro da decisão manual.

### L4 — Informação não está organizada como catálogo de relatórios

Existem resumos, mas ainda não há contrato único de métricas, filtros,
agrupamentos, exportação e rastreabilidade de cada indicador.

### L5 — Economia está concentrada na saída

Há cálculo comercial de venda/abate, mas falta custo por kg ganho, custo por
arroba produzida, margem por animal/lote e ponto de equilíbrio.

### L6 — Preparação online ainda incompleta

UUID e timestamps ajudam, porém serão necessários versão do registro, dispositivo,
usuário, fila de operações, idempotência e política de conflitos.

### L7 — Páginas centrais ainda são grandes

As duas páginas principais concentram apresentação, estado e orquestração. A
evolução deve extrair casos de uso e seletores sem alterar o comportamento de uma
só vez.

## 5. Matriz de oportunidade contra o mercado pesquisado

| Tema | Mercado observado | Nosso estado | Direção |
|---|---|---|---|
| Pesagem rápida offline | Comum nos produtos de curral | Atual, mas aprimorável | Modo Curral 2.0 |
| Sessões formais | Forte em Datamars/Gallagher | Parcial | Tornar agregado central |
| Metas e previsão | Forte em Gallagher/Datamars | Ausente | Criar metas e projeção |
| Apartação multi-regra | Forte em equipamentos avançados | Parcial | Motor explicável |
| RFID/balança | Diferencial recorrente | Ausente | Adaptadores plugáveis |
| Análise por grupo | Comum | Parcial | Catálogo de relatórios |
| Exceções/baixo desempenho | Comum | Parcial | Central de alertas |
| Comercial por arroba | Presente em produtos brasileiros | Parcial | Rentabilidade completa |
| Rastreabilidade oficial | Presente em soluções especializadas | Ausente | Preparar, integrar depois |
| Offline + nuvem | Padrão emergente | Somente offline | Sincronização posterior |

## 6. Dívida documental identificada

- `README.md` da raiz ainda não descreve o produto atual.
- Auditorias antigas entram em conflito com o esquema v6.
- Não havia índice arquitetural permanente.
- Não havia catálogo formal de cadastros.
- Não havia catálogo formal de relatórios.
- Não havia contratos para hardware e sincronização.
- Não havia ADR registrando sanidade como fora de escopo.

Este pacote corrige a lacuna documental. A atualização do README da raiz deve ser
feita quando a equipe decidir promover esta arquitetura a plano de implementação
ativo.

