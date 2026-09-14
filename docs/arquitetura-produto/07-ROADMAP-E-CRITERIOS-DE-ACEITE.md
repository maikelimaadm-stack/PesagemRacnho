# 07 — Roadmap e critérios de aceite

## 1. Estratégia de entrega

Cada fase será dividida em slices verticais pequenos, preservando dados e
mantendo o sistema utilizável. Nenhuma fase mistura uma grande migração de banco,
redesign completo e integração física no mesmo corte.

## 2. Ordem das fases

```text
F0 Contratos e baseline
 → F1 Desempenho e confiabilidade do fluxo atual
 → F2 Modo Curral e sessões
 → F3 Relatórios operacionais/zootécnicos
 → F4 Apartação avançada
 → F5 Equipamentos e RFID
 → F6 Comercial e embarque avançados
 → F7 Login, multiempresa e sincronização
 → F8 Integrações oficiais/opcionais
```

## 3. F0 — Contratos e baseline

Entregas:

- aprovar este pacote documental;
- mapear campos atuais para o modelo-alvo;
- catalogar fórmulas existentes;
- gerar massa de teste anônima: vazia, pequena, 36 mil e 250 mil pesagens;
- medir p50/p95/p99 de busca, troca de campo e salvamento;
- registrar capturas visuais das telas atuais;
- definir marcas/modelos de equipamentos prioritários.

Aceite:

- nenhuma ambiguidade de identidade, fórmula ou escopo P0;
- baseline reproduzível em desenvolvimento e pacote instalado;
- decisão explícita sobre hardware inicial.

## 4. F1 — Desempenho e confiabilidade

Entregas:

- índice/cache de animais ativos;
- busca sem percorrer todo histórico;
- seletores memoizados;
- atualização incremental de resumos;
- paginação/virtualização conforme medição;
- desambiguação somente ao concluir identificação;
- prevenção de duplo salvamento;
- centralização das validações restantes.

Aceite:

- p95 da busca indexada menor que 100 ms na massa homologada;
- Tab da identificação ao peso sem travamento perceptível;
- salvamento local p95 menor que 250 ms;
- resultados de GMD e histórico iguais antes/depois;
- testes de regressão e UI aprovados.

## 5. F2 — Modo Curral

Slices:

1. ciclo de vida da sessão;
2. recuperação de sessão aberta;
3. lançamento vinculado à sessão;
4. atalhos e foco;
5. duplicidade e pendências;
6. fechamento e snapshot;
7. relatório REP-001/002/003.

Aceite:

- sessão recuperável após reiniciar;
- nenhuma pesagem operacional sem sessão, salvo importação/legado marcado;
- duplicidade detectada antes da persistência;
- encerramento bloqueia pendência crítica;
- reabertura exige permissão/motivo;
- fechamento confere com registros de origem.

## 6. F3 — Relatórios

Primeiro pacote:

- histórico individual;
- desempenho e inventário de lote;
- ranking/exceções;
- pesagens vencidas;
- movimentação entre lotes;
- auditoria e qualidade de dados;
- painel inicial navegável.

Aceite:

- métricas canônicas testadas;
- drill-down de todos os totais;
- PDF/XLSX ou CSV conforme contrato;
- mesma população na tela e exportação;
- desempenho aceitável na massa grande.

## 7. F4 — Apartação avançada

Slices:

- modelo versionado de regras;
- editor com `E`/`OU` e validação;
- motor puro e testável;
- prioridade e conflito;
- capacidade;
- explicação da decisão;
- simulação/what-if;
- substituição manual auditada;
- REP-203/204.

Aceite:

- regras determinísticas;
- mesma entrada + versão produz mesmo resultado;
- ausência de dado segue política;
- simulação não altera dados;
- 100% das substituições guardam motivo.

## 8. F5 — Equipamentos e RFID

Slices:

1. portas e simuladores;
2. diagnóstico de conexão;
3. primeiro adaptador de balança;
4. captura estável;
5. primeiro leitor RFID;
6. correlação ID/peso;
7. reconexão e fallback manual;
8. produtividade e logs.

Aceite:

- matriz de capacidades por modelo;
- testes de frame parcial, ruído e desconexão;
- nenhuma captura duplicada após reconectar;
- peso manual continua disponível;
- sessão real confrontada com relatório físico;
- adaptador experimental não aparece como homologado.

## 9. F6 — Comercial e embarque

Primeiro pacote:

- pessoas/empresas e destinos;
- operação comercial versionada;
- custos e descontos;
- romaneio;
- conciliação previsto/realizado;
- retorno de frigorífico;
- relatórios REP-301 a REP-305 e REP-401 a REP-403.

Aceite:

- peso vivo/carcaça/arrobas separados;
- valor informado versus calculado identificado;
- total de animais reconciliado;
- cancelamento recompõe situação com auditoria;
- rateio de custos documentado antes de exibir margem.

## 10. F7 — Login e sincronização

Slices:

- tenant/empresa/fazenda;
- identidade de usuário/dispositivo;
- papéis e permissões;
- outbox local;
- API idempotente;
- sincronização incremental;
- conflitos;
- painel de status;
- backup servidor e recuperação.

Aceite: cumprir integralmente a seção de testes do documento 06, homologar
isolamento multiempresa e manter todo o fluxo de curral offline.

## 11. F8 — Integrações oficiais

Somente após autorização e acesso:

- SISBOV/certificadoras;
- serviços GTA disponíveis;
- importação/retorno de NF-e;
- outros fabricantes e nuvens de equipamentos;
- webhooks/integrações de parceiros.

Cada integração possui projeto, homologação e fallback próprios.

## 12. Backlog priorizado inicial

| ID | Item | Fase | Dependência |
|---|---|---|---|
| PERF-001 | Medir busca e Tab em base grande | F0 | nenhuma |
| PERF-002 | Índice/cache de animais ativos | F1 | PERF-001 |
| SES-001 | Abrir/recuperar sessão | F2 | F1 |
| SES-002 | Fechar/reabrir com auditoria | F2 | SES-001 |
| QLT-001 | Pendências e severidade | F2 | SES-001 |
| REP-001 | Fechamento de sessão | F2 | SES-002 |
| REP-101 | Histórico individual | F3 | métricas canônicas |
| REP-102 | Desempenho do lote | F3 | REP-101 |
| DRF-001 | Motor de regra puro | F4 | domínio aprovado |
| DRF-002 | Simulador de apartação | F4 | DRF-001 |
| DEV-001 | Simulador de balança | F5 | contrato de dispositivo |
| DEV-002 | Primeiro adaptador real | F5 | modelo escolhido |
| EID-001 | Leitor/identificador eletrônico | F5 | modelo escolhido |
| COM-001 | Custos e operação comercial | F6 | regra de rateio |
| SHP-001 | Romaneio/conciliação | F6 | cadastros documentais |
| IAM-001 | Login/papéis | F7 | arquitetura servidor |
| SYNC-001 | Outbox + API idempotente | F7 | IAM-001 |

## 13. Definition of Done

Uma entrega somente está pronta quando:

- regra e UX aprovadas;
- migração de dados testada, quando houver;
- código com lint/build/testes aprovados;
- testes de unidade, integração e regressão proporcionais ao risco;
- teste visual claro/escuro e escalas Windows;
- desempenho comparado ao baseline;
- auditoria e permissão verificadas;
- documentação arquitetural e do usuário atualizadas;
- pacote instalado testado, quando afetar runtime;
- evidências registradas;
- sem reintroduzir domínio fora de escopo.

## 14. Gates de release

### Gate técnico

- suíte completa;
- integridade do banco;
- build e smoke do Electron;
- migração e backup;
- verificação do pacote.

### Gate operacional

- roteiro real de cadastro/manejo/saída;
- base volumosa;
- recuperação após encerramento;
- conferência de cálculos;
- aceite humano da UI.

### Gate de distribuição

- versão e notas;
- instalador único atual;
- checksum/manifesto;
- máquina limpa;
- assinatura quando disponível;
- atualização preservando dados.

## 15. Itens que exigem decisão do responsável

- primeiro fabricante/modelo de balança;
- primeiro leitor RFID;
- necessidade real de SISBOV;
- metodologia e fontes de custo;
- PDF/XLSX prioritários;
- estrutura empresa/fazenda/curral;
- política de sessão offline para usuários;
- provedor online e autenticação;
- se haverá publicação Microsoft Store.

