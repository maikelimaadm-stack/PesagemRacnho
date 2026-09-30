# E1F — Colunas que funcionam, cabeçalho interativo, mais filtros e "Novo relatório" (versão 1.4.1)

Pedido da responsável (30/09/2026), depois da E1E:
> "Colunas dos painéis você precisa melhorar, tem algumas que não funcionam; também tem que ter opções de eu criar
> um novo relatório; esse novo relatório ele é padrão, tem que ter opções de eu colocar mais filtros; nos
> cabeçalhos dos relatórios eu posso colocar colunas, agrupar, subtotal, média, soma, total, redimensionar."

Decisões dela:
- botão **"Novo relatório"** (nome, base, quem vê); o relatório aparece no campo "Relatório", no grupo
  "Meus relatórios";
- a versão passa a ser **1.4.1**.

Continuam valendo: tela única do MAKGESTAO, "igual no visual, contas certas", Excel/CSV com números de verdade,
sem mudança de esquema, e rapidez.

## Requisitos

1. **Colunas (Colunas Painel / Colunas Detalhes / Colunas Visíveis):**
   - todas as opções de todos os tipos de todos os relatórios precisam funcionar: marcar faz a coluna aparecer
     com valor e formato certos na tela, na impressão, no PDF e no Excel; desmarcar tira; a ordem escolhida vale;
     a escolha fica guardada;
   - levantar sistematicamente as que falham e corrigir, com gate.
2. **Cabeçalho da folha interativo** (em todos os relatórios): clicar no título de uma coluna abre um menu com:
   - **Ordenar** maior/menor (A-Z/Z-A);
   - **Calcular** (Soma, Média, Mínimo, Máximo, Contagem — só o que faz sentido para o tipo da coluna, pelo motor);
   - **Agrupar por esta coluna** (vira nível de agrupamento, até 3; com subtotal);
   - **Subtotal / Total** dessa coluna na linha de total;
   - **Ocultar coluna**;
   - **Adicionar coluna…**.

   Arrastar a borda do título **redimensiona** a coluna; a largura fica guardada e vale na impressão e no PDF.
   Mexer no agrupamento pelo cabeçalho sai do tipo ("Personalizado"), levando junto a população fixa do tipo,
   como na E1D.
3. **Mais filtros:** um botão "Mais filtros…" no quadro lista todas as colunas filtráveis do relatório (as que
   não têm botão próprio), com a mesma lista de marcar e o mesmo contador.
4. **Novo relatório:**
   - no fim do seletor "Relatório", "➕ Novo relatório…" pede Nome, Base (os relatórios do catálogo que o perfil
     abre) e Quem vê ("Só eu" ou "A empresa" — só ADMIN/GESTOR);
   - cria um modelo (sem esquema novo) que abre como um relatório: título "Relatório de <nome>", ajustável pelo
     cabeçalho e pelos filtros;
   - mudanças não salvas mostram "Salvar alterações";
   - no menu ⋯, "Renomear" e "Excluir";
   - o grupo "Meus relatórios" do seletor lista os pessoais e os da empresa;
   - nunca amplia permissão (a mesma regra dos modelos).
5. **Versão 1.4.1:** package, lock e appVersion; CHANGELOG `[1.4.1]`; `docs/release/1.4.1/`; guia de Relatórios.

## Gates

- `reports:colunas-todas:verify`
- `reports:cabecalho-interativo:verify`
- `reports:novo-relatorio:verify`
- atualizar os que a mudança tocar.
