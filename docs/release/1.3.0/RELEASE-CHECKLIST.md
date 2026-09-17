# Checklist de release — 1.3.0 (Relatórios profissionais)

Versão 1.3.0 · esquema Dexie 7 · backup formato 3 · `signed=false` (sem Authenticode).

## Automatizado (agente)

- [ ] `npm run lint` verde
- [ ] `npm run build` verde
- [ ] `npm run test:quick` verde (inclui todos os gates `reports:*` exceto performance)
- [ ] `npm run reports:performance:verify` verde (36 mil) e medição 250 mil registrada
- [ ] `npm run dist:unsigned` verde (checksum, manifesto, `packaged:source`, `packaged:build`, `installed-app-e2e`)
- [ ] Manifesto: `appVersion 1.3.0`, `dbSchemaVersion 7`, `backupFormatVersion 3`, `gitCommit` sem `-dirty`, `signed false`
- [ ] SHA-256 do Setup e do `app.asar` registrados em `RC1.md`
- [ ] Tag `v1.3.0-rc1` (não promover a `v1.3.0` sem o teste físico)

## Teste físico (Windows real — responsável)

1. Instalar o Setup 1.3.0 RC (conferir SHA-256 com `certutil -hashfile ... SHA256`).
2. Login ADMIN.
3. Abrir **Relatórios** (menu lateral, uma entrada).
4. Abrir **Pesagens por período**.
5. Aplicar período (Personalizado).
6. Aplicar filtros (pílula de Marca e menu da coluna Peso).
7. Ocultar e reordenar colunas (Colunas).
8. Agrupar **Apartação → Lote** (Agrupar).
9. Configurar subtotais (Totais: animais únicos, peso médio, GMD ponderado).
10. Conferir o **total geral** contra a soma manual de uma amostra pequena.
11. **Salvar modelo** (pessoal).
12. Fechar e abrir o aplicativo.
13. Relatórios › Meus relatórios: modelo persistido e reaberto com a mesma configuração.
14. Exportar **CSV** (abrir no Excel: acentos, separador, números).
15. Exportar **JSON** (manifesto com SHA-256).
16. **Imprimir** (diálogo do Windows; cabeçalho repetido nas páginas).
17. Gerar **PDF** (escolher pasta; conferir “Página X de Y” e rodapé).
18. Gerar **XLSX** (abrir no Excel; números à direita e somáveis).
19. Login **CONSULTA**.
20. Relação de Pesagens sem Lançar/Editar/Excluir/Importar.
21. Exportar um relatório não sensível (ex.: Inventário atual).
22. Tentar **Vendas do período**: não aparece no catálogo; colunas de valor não aparecem em Pesagens por período.
23. Login **GESTOR**.
24. **Vendas do período** e **Abates do período** abrem com valores.
25. Manutenção: Restaurar / Limpar / Reset **não** aparecem.
26. Fechar e reabrir; dados, modelos e favoritos preservados.
