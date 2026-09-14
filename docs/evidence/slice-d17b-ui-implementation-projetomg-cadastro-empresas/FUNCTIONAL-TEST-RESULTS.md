# Resultados dos testes funcionais

Resultado: **APROVADO COM DESVIOS DE COBERTURA MANUAL DOCUMENTADOS**.

## Navegador — perfil descartável

- as três rotas principais abriram em desenvolvimento e na build de produção;
- busca/filtros, drawer mobile, menu mobile, recolhimento da sidebar e menu funcional de coluna responderam;
- dialogs de Apartação, Sanidade e Embarque abriram e fecharam; `Escape` retornou o foco ao acionador;
- foi criada pela UI uma pesagem sintética `D17B-TESTE`, peso 321 kg;
- a listagem e o toast confirmaram o salvamento;
- reload confirmou persistência no IndexedDB do perfil descartável;
- o mesmo registro foi excluído pela ação real da linha e a exclusão permaneceu após novo reload;
- o perfil de teste terminou sem o registro sintético;
- não houve overflow horizontal ou erro de runtime nas telas inspecionadas.

## Suítes automatizadas

- CRUD em 12 stores Dexie;
- primeira execução sem configuração, login, servidor ou dependência nativa;
- contrato UI → services → Dexie;
- persistência após reabertura, atualização e soft delete;
- backup de 2 registros, exportação CSV/JSON, importação, restore e integridade;
- fluxo de manutenção e contratos dos dialogs;
- mapper de pesagens;
- main boot, preload/IPC e desktop smoke;
- verificação de SQLite destacado sem ofensores operacionais.

## Desvios honestos

- criação/edição de Apartação, Sanidade e Embarque não foi repetida manualmente em cada dialog no navegador; a abertura/fechamento foi validada visualmente e o CRUD das stores correspondentes foi coberto pela suíte Dexie em banco descartável;
- o teste E2E instalado rodou em modo `E2E_DEV_PERMISSIVE=1`, validando o artefato disponível; não houve lançamento de instalador real;
- nenhum restore destrutivo foi executado em dados do usuário.
