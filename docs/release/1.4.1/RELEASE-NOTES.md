# Pesagens Individuais 1.4.1 — notas da versão

Data: 30/09/2026 · Esquema Dexie 8 (sem mudança) · Backup formato 3 · Instalador não assinado.

A 1.4.1 é a 1.4.0 (relatórios no estilo do MAKGESTAO, numa tela só — ver `docs/release/1.4.0/RELEASE-NOTES.md`)
com os pedidos de 30/09/2026 (E1F). O número mudou para não confundir com os instaladores de teste da 1.4.0.

## O que muda para quem usa
- **Colunas Painel / Colunas Detalhes / Colunas Visíveis** funcionando em todos os tipos de todos os relatórios.
- **Cabeçalho da folha interativo:** clique no título de uma coluna para ordenar, trocar o cálculo (soma, média,
  mínimo, máximo, contagem), agrupar por ela, pôr o total dela, ocultar ou adicionar colunas; arraste a borda
  para alargar (vale também na impressão e no PDF).
- **Mais filtros…:** filtre por qualquer coluna do relatório.
- **Novo relatório:** no campo "Relatório", "➕ Novo relatório…" cria um relatório seu (nome, base e quem vê);
  ele aparece em "Meus relatórios", com "Salvar alterações", "Renomear" e "Excluir".
- Saiu de um relatório seu sem salvar? O programa pergunta **"Salvar as alterações?"**.
- O Excel, o CSV e o PDF de um relatório seu saem com o nome dele.
- Menu ⋯ mais limpo: sem o "Abrir modelo" repetido (os seus relatórios abrem pelo campo "Relatório").

## Atualização
- Da 1.3.x ou de uma 1.4.0 de teste: faça o backup, feche o programa e rode o **Setup 1.4.1** por cima. Nada
  muda no banco.

## Assinatura
- Instalador sem assinatura: o SmartScreen avisa ("Mais informações › Executar assim mesmo").
