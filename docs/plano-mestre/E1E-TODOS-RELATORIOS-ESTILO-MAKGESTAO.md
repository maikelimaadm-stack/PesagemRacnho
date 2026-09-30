# E1E — Todos os relatórios no estilo do MAKGESTAO, numa tela só com seletor

Versão alvo: ainda a **1.4.0**, não distribuída. Branch `program/e1-relatorios`. Sem mudança de esquema.

**Pedido da responsável (30/09/2026):**
> "Você fez os relatórios apenas igual o meu que pedi do sistema, porém agora eu quero todos os relatórios do
> mesmo estilo, entendeu, e separado. Em vez de ser vários relatórios separados, poderia escolher na seleção."

**Decisões dela nas perguntas de hoje:**
1. **Uma tela só com seletor.** O menu Relatórios abre direto numa tela no estilo do MAKGESTAO. O quadro de filtros
   ganha o campo **"Relatório"**, com os relatórios que o perfil pode abrir, e ao lado vem o **"Tipo Relatório"**
   de cada um. A folha aparece embaixo, no mesmo estilo.
2. **Comercial com tipos.** Vendas do período, Abates do período e Compras do período viram **um relatório
   "Comercial"** com os tipos Vendas, Abates e Compras. O de Vendas fica igual ao PDF da W3
   (`docs/evidence/e1d/referencia-makgestao/print-responsavel-vendas-w3.pdf`). Em Pesagens, o tipo Vendas continua.

**Continua valendo da E1D:**
- "igual no visual, contas certas": animais distintos, GMD ponderado, totais recalculados;
- Excel, CSV e JSON continuam com números de verdade;
- a responsável quer rapidez.

## Requisitos

1. **Tela única** (`/Relatorios`):
   - abre direto no último relatório usado; sem histórico, em Pesagens;
   - campo **Relatório** primeiro no cartão, com a lista do perfil (o catálogo de hoje em forma de seletor,
     inclusive "Controle" para OPERADOR/CONSULTA; o Comercial só para quem tem `commercial.values`);
   - trocar o relatório abre o outro com o último estado dele (`?r=<id>`);
   - links antigos (`?r=`, `&m=`, `&v=`) continuam abrindo;
   - a lista em cartões (catálogo) sai da navegação;
   - modelos salvos: dá para abrir e salvar pelo menu ⋯.
2. **Mesma tela para todos**, a do MAKGESTAO:
   - título "Relatório de <nome>", botão verde Imprimir, Excel, PDF e ⋯;
   - no cartão: Relatório, Data Início, Data Fim (só se o relatório tem período; senão "Estado atual (hoje)"),
     Orientação, Tipo Relatório, os controles do tipo, Ordenar Por, Pesagem Anterior (se houver), os parâmetros
     do relatório (ex.: dias) e os botões de filtro que o relatório tem, mais Limpar Filtros;
   - sempre a folha embaixo.
3. **Tipos para cada relatório**, no lugar do "Agrupar por" genérico:
   - os agrupamentos úteis de hoje viram tipos nomeados (os antigos relatórios separados da 1.3.x, os aliases
     da E1, são uma boa base), sempre com um tipo **Analítico** (lista);
   - cada relatório tem o seu tipo padrão;
   - modelo ou estado antigo que não bater com nenhum tipo abre como "Personalizado".
4. **Folha no estilo do MAKGESTAO em todos**, com o desenho da E1D (título com linha grossa, "Período",
   seções, tabela com cabeçalho cinza, unidades nas células e totais em linha de texto):
   - resumo genérico, igual ao "Por Apartação (Resumo por Data)" para N níveis;
   - lista genérica, igual ao "Analítico";
   - Pesagens continua com os seus 5 desenhos.
5. **Comercial:**
   - uma definição só, com os tipos Vendas (desenho do PDF da W3, as mesmas contas da E1D), Abates (o mesmo
     desenho, por frigorífico) e Compras (por origem/vendedor);
   - os ids antigos `comercial.vendas/abates/compras` continuam abrindo, e modelos, favoritos e recentes são
     convertidos, com auditoria como na E1.

## Gates

- `reports:tela-unica:verify`
- `reports:tipos-todos:verify`
- `reports:comercial:verify`
- `reports:folha-makgestao-todos:verify`
- atualizar os que a mudança tocar.
