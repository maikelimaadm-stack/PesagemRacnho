# Pesagens Individuais 1.3.0 — notas da versão (candidato RC1)

Data: 17/09/2026 · Esquema Dexie 8 · Backup formato 3 · Instalador não assinado (diagnóstico).
Status: **candidato**. Não é versão final sem o teste físico em máquina limpa
(`docs/release/1.3.0/RELEASE-CHECKLIST.md` §4).

## O que muda para quem usa

### Sanidade (novo)
- Menu **Sanidade** com três abas: Programas/Procedimentos, Medicamentos/Produtos e Aplicações.
- No **Lançamento**, botão **Sanidade** abre uma tabela compacta: Programa, Medicamento, Dose,
  Unidade, Via e Observação, uma linha por aplicação. Marque **Aplicar esta configuração aos
  próximos animais** para repetir a mesma aplicação na sequência.
- A **Ficha do animal** mostra o histórico de aplicações.
- Não controla estoque, compras, prescrição nem calendário veterinário.

### Lançamento
- Depois de salvar, ficam os dados da sequência (tipo, data, marca, raça, sexo, categoria
  escolhida à mão, apartação/lote, motivo de saída, embarque, sanidade marcada) e limpam os do
  animal (identificação, peso, observação, valores, causa de morte não repetida).
- Identificação e peso em fonte maior; identificação em negrito.

### Importação e exportação
- Modelo de planilha só com o que se digita: Data, NumeroAnimal, Marca, Sexo, Raça, Categoria,
  Peso, Apartação, Lote, Observação. Peso anterior, dias, ganho e GMD são calculados.
- Relação exporta **relatório (CSV)** e **arquivo para reimportação (CSV)**.

### Relatórios
- Menu **Relatórios** com catálogo por família, filtros, agrupamento, totais, modelos salvos,
  impressão, PDF, CSV, JSON e XLSX.

## Banco de dados
- Atualização automática 7 → 8 (aditiva: só cria as stores de sanidade). Antes de atualizar o
  sistema grava e confere um backup completo; se não conseguir, não atualiza e nada é alterado.
- Backups das versões 1.1.x e 1.2.0 continuam restauráveis (sanidade vem vazia).
- "Limpar dados operacionais" apaga as aplicações de sanidade e preserva programas e medicamentos.

## Ainda não incluído nesta RC
- Assistente de importação novo (histórico conciliado Cadastro + Manejos, conciliação e
  prévia): em desenvolvimento; a Relação continua com a importação atual.
