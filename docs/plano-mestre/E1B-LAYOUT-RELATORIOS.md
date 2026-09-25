# E1B — Layout dos relatórios em formato de documento + cabeçalho da propriedade com logo

Versão alvo: entra na **1.4.0** (continua a branch `program/e1-relatorios` depois do REPORT da E1).
Esquema Dexie: **sem mudança** (campos novos não indexados em `propriedades`).
Referência visual: `docs/evidence/e1b/referencia-responsavel.png` (print enviado pela responsável em 25/09/2026).

## 1. O que a responsável quer

Todo relatório aparece como uma **folha pronta para imprimir**, com filtros em cima e o documento embaixo:

```
┌ Barra de filtros ─────────────────────────────────────────────────── [Imprimir] [Excel] [PDF] ┐
│ Data início | Data fim | Orientação | Tipo de relatório | Ordenar por | Pesagem anterior      │
│ [Lotes] [Apartações] [Sexo] [Raças] [Era] [Marcas] [Proprietário] [Categoria] [Status] [Limpar]│
└───────────────────────────────────────────────────────────────────────────────────────────────┘
┌ Folha (pré-visualização do que sai na impressora) ────────────────────────────────────────────┐
│ [LOGO]          NOME DO PRODUTOR (negrito)                                                     │
│                 NOME DA FAZENDA                                                               │
│                 ENDEREÇO – MUNICÍPIO-UF                                                        │
│ Relatório de Pesagens Individuais (Sintético)                     Período: dd/mm – dd/mm      │
│ ───────────────────────────────────────────────────────────────────────────────────────────── │
│ APARTAÇÃO: APARTE 02/06                                                                        │
│   DATA: 02/06/2026                                                                             │
│   Lote | Qtd | Faixa exigida | Menor | Maior | Peso médio | Média @ | Peso total | Total @ |    │
│        Ganho médio | Ganho total | Dias médios | GMD médio | Machos | Fêmeas                   │
│   Subtotal 02/06/2026: 103 animais · Peso médio · Peso total · GMD médio · Lotes: 3           │
│ TOTAL POR LOTE – APARTE 02/06   (mesma tabela consolidada)                                    │
│ Total geral …                                                                                 │
│ Rodapé: filtros aplicados · emitido por <usuário> em dd/mm/aaaa hh:mm · página X de Y · versão │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Cabeçalho vindo do cadastro da Propriedade

Cadastros › Propriedades ganha a seção **"Cabeçalho dos relatórios"** (campos não indexados, sem bump de esquema):

| Campo | Exemplo | Obrigatório |
|---|---|---|
| `titular_nome` (produtor/razão social) | ZIGOMAR FERREIRA FRANCO FILHO | não (sem ele usa o nome da propriedade) |
| `nome` (já existe) | FAZENDA KAIMAN | sim |
| `endereco` | GLEBA RICARDO FRANCO SN - ZONA RURAL | não |
| `municipio` + `uf` (já existem) | VILA BELA DA SST. TRINDADE-MT | não |
| `documento` (CPF/CNPJ) e `inscricao_estadual` | — | não; opção "mostrar no cabeçalho" |
| `telefone` | — | não |
| `logo` | imagem PNG/JPG | não |

Regras do logo:
- Upload na ficha da propriedade; o app redimensiona para no máximo 400 px de largura e guarda como
  data URL (limite 300 KB depois de redimensionar); recusa arquivo que não seja imagem.
- Pré-visualização do cabeçalho na própria ficha ("Assim vai sair nos relatórios").
- Entra no backup/restauração (é campo do registro); gate confere que backup → restore mantém o logo.

Qual propriedade vai no cabeçalho:
- Padrão: a propriedade marcada como **Padrão** (`temPadrao` já existe).
- Se o relatório estiver filtrado por uma propriedade, usa a dela.
- Sem nenhuma preenchida: cabeçalho só com o nome do sistema (nunca quebra a impressão).

## 3. Barra de filtros (padrão para todos os relatórios)

- Linha 1: período (início/fim com atalhos Hoje, 7 dias, Mês, Personalizado), Orientação (Automática,
  Retrato, Paisagem), **Tipo de relatório** (lista das visões daquele relatório — ex.: Por apartação
  (resumo por data), Por lote, Por data, Analítico por animal), Ordenar por, Pesagem anterior
  (Todos, Com pesagem anterior, Sem pesagem anterior).
- Linha 2: botões de filtro com multisseleção e contador ("Lotes (2)"); Limpar filtros.
- "Tipo de relatório" é só um atalho para os agrupamentos/modo da E1 (ex.: Por apartação (resumo por
  data) = agrupar Apartação › Data › Lote, modo Resumido). Nada de conta nova fora do motor da E1.
- Filtros e tipo escolhidos ficam salvos por usuário (volta do jeito que deixou).

## 4. Documento (folha)

- A mesma folha é usada na tela, na impressão e no PDF (um só componente de layout; CSS de impressão
  A4 retrato/paisagem com margens de 10 mm).
- Seções por nível de agrupamento com título em maiúsculas (APARTAÇÃO: …, DATA: …), tabela do nível
  folha, linha de **Subtotal** por seção e bloco **"TOTAL POR <nível 1>"** consolidado no fim da seção,
  depois **Total geral**.
- Cabeçalho da tabela repete em cada página; quebra de página nunca separa o título da seção da tabela.
- Números em fonte monoespaçada alinhados à direita; kg com 1 casa, @ com 2, GMD com 3 (kg/dia).

### Colunas do resumo de pesagens (nível lote)

| Coluna | Cálculo |
|---|---|
| Qtd | animais únicos |
| Faixa exigida | faixa de peso do lote (`peso_min`–`peso_max`); vazio → "—" |
| Menor / Maior | menor e maior peso |
| Peso médio (kg) | média simples dos pesos |
| Média (@) | peso médio ÷ divisor da arroba. Divisor em Configurações › Relatórios: **30 (@ viva, padrão)** ou 15; o rodapé mostra qual foi usado ("@ = peso vivo ÷ 30") |
| Peso total (kg) | soma dos pesos |
| Total (@) | peso total ÷ divisor da arroba |
| Ganho médio / Ganho total (kg e @) | só animais com pesagem anterior |
| Dias médios | média dos dias entre a pesagem e a anterior |
| GMD médio | ganho total ÷ soma dos dias (ponderado, `weightedGmd`) |
| Machos / Fêmeas | contagem por sexo |

**Erros do modelo antigo que NÃO podem se repetir** (vistos no print de referência):
1. Colunas desalinhadas: na 1ª tabela o valor do Peso total aparece em "Média (@)" e a Qtd em "Total (@)".
   Gate obrigatório: cada célula renderizada está sob o cabeçalho da sua coluna (teste por índice de coluna).
2. GMD "0,000" quando não existe pesagem anterior: o certo é "—" e o animal fica fora da média, com
   nota "GMD calculado com N de M animais".
3. Colunas vazias ("-") ocupando espaço: coluna sem nenhum valor no relatório inteiro some
   automaticamente (opção "mostrar colunas vazias" desligada por padrão).

## 4.1 Folha × grade (como convivem com a E1)

- **Resumido** aparece como a folha (seções + subtotais + total por nível 1 + total geral). A folha
  continua interativa: clicar na linha de um grupo abre o Detalhado recortado (drill-down da E1);
  ordenar por coluna continua valendo dentro da seção.
- **Detalhado** continua na grade atual (muitas linhas), com o botão "Ver como folha" que mostra a
  mesma folha com as linhas por animal.
- "Tipo de relatório" reaproveita o "Agrupar por" rápido e os filtros rápidos da E1 (presets); a barra
  de botões de filtro (Lotes, Apartações…) reaproveita o motor de filtros existente — nada de segundo
  caminho de filtro.
- A barra de filtros e o cabeçalho da folha valem para os 12 relatórios; as colunas de cada folha vêm
  das métricas do próprio relatório (a tabela de colunas da seção 4 é a do relatório Pesagens, visão
  "Por apartação (resumo por data)").
- Se existirem imagens em `docs/evidence/e1b/design/` (modelo gerado no Claude Design e aprovado pela
  responsável), elas são a referência visual; em conflito com o print antigo, vale o modelo aprovado.

## 5. Gates

- `reports:document-layout:verify` — alinhamento célula × coluna, subtotal = soma das seções, total por
  nível 1 = soma dos subtotais, colunas vazias ocultas, GMD "—" sem pesagem anterior.
- `registry:property-header:verify` — campos novos, logo redimensionado/limite, cabeçalho padrão ×
  filtrado × vazio, backup/restore com logo.
- `reports:print-contract:verify` e `reports:pdf-contract:verify` atualizados (cabeçalho com logo, rodapé
  com página X de Y).

## 6. Aceite humano

1. Cadastrar a propriedade com produtor, endereço e logo → a pré-visualização mostra o cabeçalho.
2. Abrir Pesagens › "Por apartação (resumo por data)" de 02/06/2026 → folha igual ao modelo do print,
   com as colunas no lugar certo.
3. Imprimir em paisagem → 1 página por apartação quando couber; cabeçalho e rodapé em todas.
4. Animal sem pesagem anterior não puxa o GMD para zero.
