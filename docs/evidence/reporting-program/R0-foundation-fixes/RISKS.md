# R0 — Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Empresas que dependiam do rendimento padrão 50 implícito passam a ver “—” em carcaça/arrobas até configurar | cálculo comercial some até a configuração | é a decisão §8; texto no Lançamento orienta “Informe o rendimento de carcaça”; configuração em Configurações → Rendimento de carcaça padrão |
| Configuração já gravada com 50 continua 50 | nenhum (é configuração explícita gravada) | — |
| `ultima_pesagem_data` agora ignora Saída sem peso | “dias sem pesagem” mais correto; telas que mostravam a data da saída como última pesagem mudam | situação/data de saída continuam em `data_saida` |
| OPERADOR não vê campos de valor na Saída | valores de venda/abate lançados pelo OPERADOR ficam vazios; GESTOR completa | decisão de permissões fechada |
| Autorização no `weighingService` exige sessão com papel válido | sessão corrompida sem papel não grava | falha fechada é o comportamento desejado |
| Fechamento do Dia ainda com somas `|| 0` | resumo do fechamento pode tratar ausente como 0 | R5 (fechamento imprimível pelo motor) |
