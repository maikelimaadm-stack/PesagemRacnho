# D7A-SCOPE-DECISION — Slice D.7A

## Entidades escolhidas

1. **Apartacao** → tabela `apartacoes`
2. **LoteApartacao** → tabela `lote_apartacoes`
3. **Animal / Lote (SQLite)** — já existentes desde D.3; documentados como prontos (sem entidade JSON correspondente)

## Motivo

- Aparecem diretamente em `PesagensIndividuais`, `LancamentoPesagensIndividuais` e `GerenciarApartacoesDialog`
- Sem elas o fluxo de pesagens ainda depende do JSON para filtros/CRUD operacional
- Schema real de Apartacao/LoteApartacao ≠ `separations` genérico (domínio = nome + lotes com faixas de peso)

## Entidades adiadas

- SanidadeAnimal, ConfiguracaoSanidade, ItemSanidade
- Embarque, DocumentoEmbarque

## Motivo

Escopo cresceria além de 3 grupos com qualidade. São P2 — operação próxima, não bloqueiam listagem/CRUD de pesagens.

## Risco de escopo

Migrar Sanidade+Embarque no mesmo slice aumentaria superfície de UI e risco de regressão visual.

## Como evitar refatoração gigante

- Só trocar fonte de dados (service/adapter)
- Schema alinhado aos campos da UI atual
- Não redesenhar dialogs
- Manter JSON para entidades fora do escopo
