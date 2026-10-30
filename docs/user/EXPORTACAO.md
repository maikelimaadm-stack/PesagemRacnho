# Exportação de pesagens (CSV)

O sistema gera dois tipos de arquivo CSV com as pesagens. Eles têm objetivos diferentes — escolha pelo que você vai
fazer com o arquivo:

| Arquivo | Para que serve | Como sai |
|---|---|---|
| **Relatório (CSV)** | Abrir no Excel, conferir, imprimir, mandar para alguém | Nomes das colunas em português, datas `dd/mm/aaaa`, vírgula nos decimais, as colunas que estão na tela |
| **Para reimportação (CSV)** | Levar as pesagens para outra instalação ou reimportar depois pelo assistente de importação | Colunas técnicas fixas, datas `AAAA-MM-DD`, ponto nos decimais, com o código (ID) de cada pesagem |

> Não edite no Excel o arquivo **para reimportação** e salve por cima: o Excel troca datas e decimais. Se precisar
> conferir, abra o **Relatório (CSV)**.

## 1. Relação de Pesagens

1. Abra **Pesagens Individuais** (Relação de Pesagens).
2. Se quiser, pesquise, filtre as colunas e ordene a tabela. **O arquivo leva exatamente as linhas filtradas, na ordem da
   tela, de todas as páginas** — não só a página que aparece.
3. Para o relatório, escolha na tela quais colunas mostrar (botão de configurar colunas). O arquivo segue as colunas
   visíveis e a ordem delas.
4. Clique em **Mais opções** (os três pontos, à direita) e escolha:
   - **Exportar relatório (CSV)**; ou
   - **Exportar para reimportação (CSV)**.
5. O arquivo é baixado com um nome como `pesagens-20260917-143005.csv` (relatório) ou
   `pesagens-reimportacao-20260917-143005.csv` (reimportação) — data e hora em que foi gerado.

### O que vai no relatório

- As colunas visíveis, na ordem da tela.
- **Tipo** e **Motivo da saída** entram sempre, mesmo que estejam ocultos na tela (sem eles não dá para saber se a
  linha é um Cadastro, um Manejo ou uma Saída). Se estiverem ocultos, aparecem logo depois da **Data**.
- O número do animal aparece com o título **Identificação**.
- **Valores comerciais** (valor de compra e de venda, preço da arroba, arrobas, rendimento, carcaça) só aparecem para
  quem tem permissão de ver valores (Administrador e Gestor). Para os outros perfis essas colunas nunca saem, mesmo que
  alguém tente pedir.

Exemplo real (colunas de fábrica da Relação, um animal com Cadastro, Manejo e Saída por morte sem peso):

```
Data;Tipo;Motivo da saída;Identificação;Marca;Sexo;Raça;Era;Peso;Lote;Apartação;GMD
01/08/2026;Cadastro;;4368;ALFA;Macho;NELORE;12;300,50;MEIO;ROTINA;
31/08/2026;Manejo;;4368;ALFA;Macho;NELORE;24;341,25;BOIADA;ROTINA;1,358
10/09/2026;Saída;Morte;4368;ALFA;Macho;NELORE;;;;;
```

Repare:

- campo sem informação fica **vazio** — nunca `0`, `0,00` ou `--/--/----`. A Saída por morte sem peso tem o Peso vazio;
- o Cadastro não tem GMD (GMD só existe em Manejo);
- números com vírgula e **sem ponto de milhar** (`1234,50`, não `1.234,50`), para o Excel somar direto.

### O que vai no arquivo para reimportação

Sempre estas colunas, nesta ordem (não dependem das colunas da tela):

```
id;animal_id;id_externo;data;tipo;motivo_saida;causa_morte;numero;marca;marca_id;sexo;raca;raca_id;categoria;categoria_id;peso;apartacao;lote;observacao
```

Exemplo real (as mesmas três pesagens):

```
id;animal_id;id_externo;data;tipo;motivo_saida;causa_morte;numero;marca;marca_id;sexo;raca;raca_id;categoria;categoria_id;peso;apartacao;lote;observacao
e1-cadastro;5f3e-animal-4368;;2026-08-01;Cadastro;;;4368;ALFA;7d0c1f7e-marca-alfa;M;NELORE;b1a2-raca-nelore;Bezerro;cat-bezerro;300.5;ROTINA;MEIO;"Chegou do lote ""B""; conferido"
e2-manejo;5f3e-animal-4368;;2026-08-31;Manejo;;;4368;ALFA;7d0c1f7e-marca-alfa;M;NELORE;b1a2-raca-nelore;Garrote;cat-garrote;341.25;ROTINA;BOIADA;
e3-saida;5f3e-animal-4368;;2026-09-10;Saída;Morte;Raio;4368;ALFA;7d0c1f7e-marca-alfa;M;NELORE;b1a2-raca-nelore;Garrote;cat-garrote;;;;
```

(Os códigos reais são longos, como `3f2b8c1e-…`; no exemplo foram encurtados.)

Repare:

- **não há** Peso anterior, Data anterior, Dias, Ganho nem GMD: ao importar, o sistema **recalcula** tudo isso com as
  mesmas regras do Lançamento. Assim nunca entra um GMD errado vindo de planilha;
- também não há valores comerciais, era nem sessão;
- a coluna `id` é o código da pesagem: reimportar o mesmo arquivo na mesma base mostra todas as linhas como
  **JÁ EXISTE** e não grava nada em dobro;
- o texto com `;` ou aspas vai entre aspas (`"Chegou do lote ""B""; conferido"`) — é o formato normal de CSV, o Excel e
  o importador leem certo.

## 2. Fechamento do Dia

1. Abra **Fechamento do Dia** e escolha a data (e a apartação, se quiser).
2. Clique em **Exportar CSV**.
3. O arquivo `fechamento-2026-09-17-20260917-180210.csv` traz as pesagens do dia com as colunas
   `Data;Identificação;Marca;Tipo;Motivo da saída;Peso;GMD;Apartação;Lote;Observação`, no mesmo formato do relatório
   (datas `dd/mm/aaaa`, vírgula, peso vazio quando não houve pesagem). As linhas saem na ordem do dia: Cadastros,
   Manejos e depois Saídas.

O botão só aparece para quem tem permissão de exportar.

## 3. Quem pode exportar

| Perfil | Exporta relatório e reimportação | Vê valores comerciais no relatório |
|---|---|---|
| Administrador | Sim | Sim |
| Gestor | Sim | Sim |
| Operador | Não | — |
| Consulta | Sim | Não |

A permissão é conferida também no momento de gerar o arquivo, não só no botão.

## 4. Abrir no Excel

- Dê dois cliques no arquivo: o Excel em português separa as colunas pelo `;` e mostra os acentos corretamente.
- Um texto que começa com `=`, `+`, `@` ou `-` (por exemplo uma observação `=1+1`) aparece com um apóstrofo na frente
  (`'=1+1`). Isso é proteção: impede que o Excel execute o texto como fórmula. Vale para os dois arquivos.
- O título da coluna **@ carcaça estimada** também aparece com apóstrofo pelo mesmo motivo.

## 5. Outras exportações

- A exportação técnica em JSON está na **Relação de Pesagens** (Mais opções › Exportar JSON técnico), e o backup completo em **Sistema › Backup e Restauração** — veja
  [EXPORTAR-DADOS.md](EXPORTAR-DADOS.md) e [BACKUP-E-RESTAURACAO.md](BACKUP-E-RESTAURACAO.md).
- **Relatórios** têm a própria exportação (CSV, Excel, PDF) — veja [RELATORIOS.md](RELATORIOS.md).
