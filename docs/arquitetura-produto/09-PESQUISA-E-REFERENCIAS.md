# 09 — Pesquisa e referências

## 1. Escopo da pesquisa

Benchmark funcional realizado em 08/09/2026. Foram usadas páginas oficiais de
produtos e documentação de fabricantes para identificar padrões de mercado. As
afirmações comerciais não foram tratadas como validação independente de qualidade.

## 2. Sistemas e aprendizados

### JetBov

- pesagem rápida;
- offline;
- Bluetooth e equipamentos;
- cadastro no curral;
- múltiplos manejos;
- histórico e GMD.

Fonte: [Novo JetBov de Curral](https://jetbov.com/novo-app-de-curral/)

### iRancho

- operação online/offline;
- coleta centralizada;
- pesagem, apartação e outros manejos na mesma atividade;
- foco em produtividade de curral.

Fonte: [iRancho](https://www.irancho.com.br/)

### Datamars/Tru-Test

- sessões de pesagem;
- VID/EID/LID;
- peso estável;
- desempenho por animal, grupo e sessão;
- metas e animais perdendo peso;
- apartação por peso/GMD e múltiplos critérios;
- transferência com dispositivos e nuvem;
- importação de arquivos de sessão.

Fontes:

- [Uso com indicadores e leitores](https://support.livestock.datamars.com/en/articles/12874640-using-datamars-livestock-with-weigh-scale-indicators-and-eid-readers)
- [Captura no Windows](https://support.livestock.datamars.com/en/articles/9949505-recording-weights-from-the-s2-or-s3-indicator-using-your-windows-computer)
- [Apartação por peso](https://support.livestock.datamars.com/en/articles/9949540-drafting-sorting-by-weight-using-a-5000-indicator)
- [Informação de sessões anteriores](https://support.livestock.datamars.com/en/articles/15593157-using-previous-session-information-on-an-xr5000-indicator)
- [Importação de sessão](https://support.livestock.datamars.com/en/articles/14190116-uploading-files-from-a-pc-to-datamars-livestock)
- [Walk Over Weighing](https://support.livestock.datamars.com/en/articles/9918979-what-is-walk-over-weighing-wow)

### Gallagher Animal Performance

- metas e previsão de peso;
- comparação de grupos;
- filtros e cálculos personalizados;
- listas de apartação;
- integração Bluetooth com barras/balanças compatíveis.

Fonte: [Animal Performance Plus](https://am.gallagher.com/en-US/Products/Animal-Performance-Plus)

### CattleMax

- cadastro individual;
- inventário e medições;
- histórico e GMD derivado de pesos de desmama;
- visão integrada do animal.

Fonte: [CattleMax Cow-Calf](https://www.cattlemax.com/cow-calf)

### Curral Tech

- offline-first;
- sincronização ao recuperar conexão;
- RFID;
- histórico e gráficos;
- romaneio e baixa automática.

Fontes: [produto](https://curraltech.com/) e
[arquitetura operacional declarada](https://curraltech.com/sobre/)

### Prozear

- pesagem, apartação e embarque offline;
- GMD e custo por arroba;
- NF-e, GTA e SISBOV;
- módulos integrados da fazenda.

Fonte: [Prozear](https://iryon.com.br/prozear/)

### MecBov

- pesagens evolutivas;
- curva de ganho por lote;
- importação com conferência de brincos;
- apartação e transferências.

Fonte: [MecBov](https://www.mecsis.com.br/solucoes)

## 3. Referências oficiais brasileiras

- [SISBOV — Ministério da Agricultura e Pecuária](https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/cgtqa/dpc/sisbov)
- [Instrução Normativa MAPA nº 51/2018](https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/transito-animal/cgtqa-legis/in-mapa-no-51-1-10-2018.pdf)
- [Guia da API SISBOV 2.0](https://manual-api-treinamento-sisbov.agricultura.gov.br/solucoes/guia/)
- [Visão geral da API SISBOV 2.0](https://manual-api-treinamento-sisbov.agricultura.gov.br/)

## 4. Conclusões usadas na arquitetura

1. sessão é unidade operacional comum em sistemas de pesagem avançados;
2. histórico anterior precisa aparecer durante a decisão atual;
3. metas e exceções são mais úteis que somente médias gerais;
4. integração exige modelo/firmware e capability matrix;
5. apartação pode ocorrer automaticamente ao estabilizar peso, mas precisa de
   política para identificação ausente;
6. grupo, sessão e animal são eixos complementares de análise;
7. importação precisa resolver identificadores e estrutura das colunas;
8. offline com sincronização posterior é requisito de campo;
9. rastreabilidade oficial usa identidade individual e eventos;
10. integração SISBOV não deve ser prometida sem acesso/homologação.

## 5. Próxima rodada de pesquisa

Depois de escolher o primeiro hardware:

- manual técnico e protocolo do fabricante;
- disponibilidade de SDK/API;
- unidade, frame e sinal de estabilidade;
- requisitos Windows e drivers;
- modelos de RFID suportados;
- teste físico e contrato de homologação.

Depois de definir o módulo comercial:

- metodologia de custo e rateio adotada pelo responsável;
- retorno real de frigoríficos utilizados;
- formatos de romaneio exigidos;
- integrações fiscais/documentais efetivamente disponíveis.

