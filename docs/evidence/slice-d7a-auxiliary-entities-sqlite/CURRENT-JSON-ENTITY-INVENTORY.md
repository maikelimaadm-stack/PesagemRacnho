# CURRENT-JSON-ENTITY-INVENTORY — Slice D.7A

## Comando usado

```bash
rg -n "db\.entities\.|writeFileSync|readFileSync|\.json" src electron scripts package.json
```

## Entidades encontradas

| Entidade | Arquivos | Telas/componentes | Uso atual | Risco | Prioridade | Migrar neste slice | Motivo |
|----------|----------|-------------------|-----------|-------|------------|--------------------|--------|
| PesagemIndividual | legacyWeighingBridge, db.cjs | — (bridge inativa) | SQLite-only pós D.5 | Baixo | — | Não | Já migrada |
| Apartacao | GerenciarApartacoesDialog, PesagensIndividuais, Lancamento | Telas pesagens | CRUD JSON | Alto | P1 | **Sim** | Ligada direto ao fluxo |
| LoteApartacao | Idem | Telas pesagens | CRUD JSON | Alto | P1 | **Sim** | Ligada a Apartacao |
| animals (SQLite) | animalRepository, IPC | — | Já em SQLite D.3 | Baixo | P1 | Completar/doc | Sem entidade JSON Animal |
| lots (SQLite) | lotRepository, IPC | — | Já em SQLite D.3 | Baixo | P1 | Completar/doc | Diferente de LoteApartacao |
| SanidadeAnimal | GerenciarSanidades, Lancamento | Sanidade | CRUD JSON | Médio | P2 | Não | D.7B |
| ConfiguracaoSanidade | GerenciarSanidades | Sanidade | CRUD JSON | Médio | P2 | Não | D.7B |
| ItemSanidade | GerenciarSanidades | Sanidade | CRUD JSON | Médio | P2 | Não | D.7B |
| Embarque | GerenciarEmbarquesDialog, Lancamento | Embarque | CRUD JSON | Médio | P2 | Não | D.7B |
| DocumentoEmbarque | Idem | Embarque | CRUD JSON | Médio | P2 | Não | D.7B |

## Categorias

- **P1** — Apartacao, LoteApartacao (+ animals/lots já SQLite)
- **P2** — Sanidade*, Embarque*
- **Fora de escopo** — nada adicional neste inventário
