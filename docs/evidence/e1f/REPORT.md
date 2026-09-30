# REPORT — E1F Colunas, cabeçalho interativo, mais filtros e "Novo relatório" (versão 1.4.1)

**ETAPA:** E1F, pedido direto da responsável em 30/09/2026 (`docs/plano-mestre/E1F-COLUNAS-CABECALHO-NOVO-RELATORIO.md`).
**VERSÃO:** **1.4.1**, esquema Dexie 8 e backup formato 3, sem mudança. **BRANCH:** `program/e1-relatorios`, de
`2150d8e` até o build em `0aeae9d` (1º build em `319b23f`; o 2º traz as respostas da §3), mais o commit deste
REPORT; a main continua em `6cccb5f`.

**STATUS: CONCLUÍDA.** test:quick **96/96 verdes**; instalador **Setup 1.4.1** gerado de novo (com as respostas
da §3) e copiado para `..\INSTALAR-ESTE-1.4.1\`, no lugar do primeiro.

## 1. O que foi feito

**Colunas (Painel/Detalhes/Visíveis).** Uma sonda percorreu 10 relatórios × 60 tipos × cada opção de coluna
(2.159 combinações). Ela achou três falhas, e todas foram corrigidas na causa:
- coluna marcada **sumia da folha** quando não tinha valor no período. Agora aparece com "-"; no padrão do
  tipo, a coluna vazia continua escondida;
- os tipos de lista (Analíticos, Mortes, Perdendo Peso, Sem Pesagem Recente, listas do Romaneio) usavam o
  seletor genérico e **perdiam a escolha** ao trocar de tipo. Agora cada um tem o seu, guardado por tipo e usuário;
- no Romaneio, a contagem aparecia com o **rótulo errado**. Agora aparece "Saídas".

**Cabeçalho interativo**, em todos os relatórios. Clique no título de uma coluna para:
- **Ordenar**;
- **Calcular**: Soma, Média, Mínimo, Máximo ou Contagem, só as que a coluna permite;
- **Agrupar por esta coluna**, até 3 níveis;
- pôr o **Subtotal/Total** da coluna;
- **Ocultar coluna**;
- **Adicionar coluna…**.

Arrastar a borda do título muda a **largura**; duplo clique volta ao automático. A largura vale na tela, na
impressão e no PDF, e fica guardada no último estado e nos modelos.

**Mais filtros…** filtra por qualquer coluna do relatório.

**Novo relatório.** "➕ Novo relatório…" no campo Relatório pede nome, base e quem vê (só eu ou a empresa).
- O relatório criado aparece em **Meus relatórios**, com "Salvar alterações", "Salvar como…", "Renomear" e "Excluir".
- A folha sai com o nome dele no título.
- Por dentro é um modelo salvo, sem esquema novo. Nunca amplia permissão.

**Respostas da responsável (§3), "organize do jeito que achar melhor"** — commit `2e8d990`:
- relatório seu com alterações não salvas: trocar de relatório ou voltar pergunta **"Salvar as alterações em
  …?"** (Salvar e sair / Sair sem salvar / Cancelar) — captura `aviso-salvar-alteracoes.png`;
- Excel, CSV e PDF de um relatório seu saem com o **nome dele** (arquivo, aba e título do Excel);
- menu ⋯ sem o "Abrir modelo" repetido; "Salvar modelo…" virou **"Salvar como meu relatório…"**;
- colunas do padrão sem valor com uma coluna mudada: ficam com "-", igual ao MAKGESTAO.

**Versão 1.4.1:** mudança pedida para não confundir com os instaladores de teste da 1.4.0.

Foram 3 agentes em paralelo (colunas, cabeçalho e novo relatório), sem revisão automática, a seu pedido. Eu juntei
as partes e conferi pelos gates e pelas capturas. Evidências de TESTE em `docs/evidence/e1f/`.

## 2. Gates e instalador

| Comando | Resultado |
|---|---|
| `npm run test:quick` | **96/96 verdes** no commit do build `0aeae9d` (e antes em `319b23f`) |
| `reports:colunas-todas` (novo) | OK: 2.159 combinações; os casos negativos reprovam o código anterior |
| `reports:cabecalho-interativo` (novo) | OK |
| `reports:novo-relatorio` (novo) | OK: 40 relatórios criados, todas as bases dos 4 perfis; pergunta ao sair e nome no Excel |
| `reports:tela-unica` | OK: "Salvar como meu relatório…" e nenhum "Abrir modelo" no menu ⋯ |
| `dist:unsigned` / `release:current-only` / `release:version-contract` | OK |

**Instalador 1.4.1:**
- `C:\Users\maike\Desktop\projeto\INSTALAR-ESTE-1.4.1\Pesagens Individuais Setup 1.4.1.exe`
- 92.207.313 bytes
- **SHA-256 `839760834a39c9e0f77180474acce1230b5c50cb7ed5483d6dd949fd576b3aad`**, igual ao do `.sha256`, do manifesto e da cópia
- manifesto: `appVersion 1.4.1`, `gitCommit 0aeae9d`, sem "-dirty"
- o primeiro 1.4.1 (`513b0bae…`, commit `319b23f`) foi substituído na pasta: não chegou a ser instalado.

A pasta `INSTALAR-ESTE-1.4.0` ficou com o instalador anterior (E1E): não apaguei nada.

## 3. Perguntas para a responsável

As quatro perguntas da primeira entrega foram respondidas ("organize do jeito que achar melhor") e estão
feitas (§1). Continuam abertas só as perguntas dos REPORTs da E1D e da E1E.
