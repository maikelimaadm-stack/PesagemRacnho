# Notas de risco

1. **Captura pós-implementação bloqueada.** É o único bloqueio relevante deste slice. Exige captura manual ou liberação do navegador local para fechar a prova visual.
2. **Referência não compila.** O import default/named de `ErpOperationBadge` impede nova captura do Cadastro de Empresas; a referência não foi alterada.
3. **CSS D.17B continua carregado.** Apenas conflitos estruturais renderizados foram neutralizados. A remoção global poderia afetar componentes internos fora do escopo.
4. **Toolbar da listagem ainda tem duas faixas de 88 px.** Isso é intencional e será tratado no D.17D.3.
5. **Tabelas e formulários móveis não estão finalizados.** O shell mobile está pronto, mas os componentes internos permanecem no contrato anterior.
6. **Sem repositório Git.** Não há branch, commit ou diff Git disponível neste diretório.

Os testes completos reduzem o risco funcional: callbacks, Dexie, manutenção e desktop smoke passaram sem regressão detectada.
