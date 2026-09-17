# 19 — Navegação

## Estado atual (`src/Layout.jsx`)

Grupos: **Operação** (Lançamento, Relação, Fechamento) · **Rebanho** (Ficha) · **Comercial** · **Cadastros** ·
**Sistema** (usuários, configurações, manutenção). Não existe entrada de relatórios.

## Proposta

1. **Novo grupo “Relatórios”** entre Comercial e Cadastros, visível com `reports.read`.
   - Item único **“Relatórios”** → `/relatorios` (catálogo). Não criar um item de menu por relatório.
2. **Catálogo** (`/relatorios`): cartões agrupados por família (Rebanho, Pesagens, Desempenho, Movimentação, Saídas,
   Comercial, Embarques, Controle, Cadastros), filtrados pela permissão; seção “Meus modelos” e “Modelos da empresa”;
   busca por nome.
3. **Pré-visualização** (`/relatorios/:reportId?modelo=<id>`): URL com id do relatório e do modelo — nunca filtros
   na URL (podem conter dados sensíveis; ver regra de privacidade).
4. **Atalhos contextuais** (sem duplicar lógica):
   - Relação → “Emitir relatório” abre `pesagens.periodo` com os filtros/colunas atuais;
   - Fechamento → “Imprimir fechamento”;
   - Ficha do animal → “Extrato do animal”.
5. Voltar do relatório retorna ao catálogo mantendo a família aberta.

OPERADOR: hoje sem `reports.read`. Decisão pendente (ver `22`): liberar só família Pesagens do dia/Fechamento, ou manter sem acesso.
