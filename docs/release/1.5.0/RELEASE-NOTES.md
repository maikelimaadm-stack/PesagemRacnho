# Pesagens Individuais 1.5.0 — notas da versão

Data: 02/10/2026 · Esquema Dexie 8 (sem mudança) · Backup formato 3 · Instalador não assinado.

A 1.5.0 é a 1.4.2 com a M1 — fundação do número: nenhum GMD mentiroso sai do programa.

## MUDANÇA VISÍVEL — leia antes
**GMD de intervalo menor que 21 dias aparece em cinza e não entra na média, porque o enchimento do boi atrapalha a
conta.** Por isso, relatórios de períodos com pesagens próximas (ex.: uma repesagem dias depois) mostram um **GMD médio
diferente do da 1.4.2**. Não é erro: é o número certo. O mínimo pode ser 7, 14, 21 ou 28 dias, em
**Configurações › Relatórios › Intervalo mínimo do GMD** (padrão 21).

## O que muda para quem usa
- O GMD de intervalo curto continua aparecendo, apagado, com o aviso "intervalo curto (N dias)"; o rodapé diz
  "GMD de N de M cab." quando nem todos entram na conta. Vale na tela, na impressão, no PDF, no Excel e no CSV.
- **GMD (regressão)**: coluna opcional (Adicionar coluna…) no Desempenho e no Rebanho atual, e na Ficha do Animal — usa
  todas as pesagens dos últimos 120 dias, com as mais novas pesando mais.
- **Pesagens para conferir** (Manutenção › Controle): lista as pesagens que parecem erro de balança ou digitação, fora
  da curva do lote ou perda de peso a verificar. Só aponta: nada é apagado nem corrigido sozinho. Botões Corrigir e Ver
  ficha do animal.
- **Repesar no mesmo dia**: o Lançamento pergunta "Esse animal já foi pesado hoje. Repesar?" e a pesagem nova
  substitui a de hoje (a antiga fica cancelada com o motivo "repesagem").
- **As duas arrobas com nome**: "@ vivo ÷30" (peso ÷ divisor) e "@ carcaça" (o que o frigorífico paga: peso ×
  rendimento ÷ 15). Nunca se somam.

## Atualização
- Da 1.4.x: faça o backup, feche o programa e rode o **Setup 1.5.0** por cima. Nada muda no banco.

## Assinatura
- Instalador sem assinatura: o SmartScreen avisa ("Mais informações › Executar assim mesmo").
