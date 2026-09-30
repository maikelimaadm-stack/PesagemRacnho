# REPORT — E1F Colunas, cabeçalho interativo, mais filtros e "Novo relatório" (versão 1.4.1)

**ETAPA:** E1F, pedido direto da responsável em 30/09/2026 (`docs/plano-mestre/E1F-COLUNAS-CABECALHO-NOVO-RELATORIO.md`).
**VERSÃO:** **1.4.1**, esquema Dexie 8 e backup formato 3, sem mudança. **BRANCH:** `program/e1-relatorios`, de
`2150d8e` até o build em `319b23f`, mais o commit deste REPORT; a main continua em `6cccb5f`.

**STATUS: CONCLUÍDA.** test:quick **96/96 verdes**; instalador **Setup 1.4.1** gerado e copiado para
`..\INSTALAR-ESTE-1.4.1\`.

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

**Versão 1.4.1:** mudança pedida para não confundir com os instaladores de teste da 1.4.0.

Foram 3 agentes em paralelo (colunas, cabeçalho e novo relatório), sem revisão automática, a seu pedido. Eu juntei
as partes e conferi pelos gates e pelas capturas. Evidências de TESTE em `docs/evidence/e1f/`.

## 2. Gates e instalador

| Comando | Resultado |
|---|---|
| `npm run test:quick` | **96/96 verdes** no commit do build `319b23f` |
| `reports:colunas-todas` (novo) | OK: 2.159 combinações; os casos negativos reprovam o código anterior |
| `reports:cabecalho-interativo` (novo) | OK |
| `reports:novo-relatorio` (novo) | OK: 40 relatórios criados, todas as bases dos 4 perfis |
| `dist:unsigned` / `release:current-only` / `release:version-contract` | OK |

**Instalador 1.4.1:**
- `C:\Users\maike\Desktop\projeto\INSTALAR-ESTE-1.4.1\Pesagens Individuais Setup 1.4.1.exe`
- 92.207.297 bytes
- **SHA-256 `513b0baee7c7bafecd2c089c19249208abf4c07100a8609b9fa0208eea07e81b`**, igual ao do `.sha256`, do manifesto e da cópia
- manifesto: `appVersion 1.4.1`, `gitCommit 319b23f`, sem "-dirty"

A pasta `INSTALAR-ESTE-1.4.0` ficou com o instalador anterior (E1E): não apaguei nada.

## 3. Perguntas para a responsável

1. Com uma coluna qualquer mudada (ex.: ocultou Raça), as colunas do padrão sem valor (Dias, Ganho, GMD sem
   pesagem anterior) aparecem com "-". Prefere assim, igual ao MAKGESTAO?
2. Sair de um relatório seu com alterações não salvas descarta as alterações sem avisar. Quer a pergunta
   "Salvar alterações?"
3. O Excel e o CSV de um relatório seu saem com o nome da base. Quer o nome do seu relatório?
4. Com "Meus relatórios" no seletor, o "Abrir modelo" do menu ⋯ ficou repetido. Pode sair?
5. As perguntas dos REPORTs da E1D e da E1E continuam abertas.
