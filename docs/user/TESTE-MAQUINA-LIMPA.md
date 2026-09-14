# Teste em máquina limpa

Este roteiro valida o pacote Windows oficial em um computador ou usuário sem uma
instalação anterior. Use somente um instalador assinado e acompanhado de SHA-256.

## Instalação e segurança

- [ ] Conferir nome, versão e SHA-256 publicados para o instalador.
- [ ] Em **Propriedades > Assinaturas Digitais**, validar assinatura Authenticode,
      cadeia confiável e carimbo de tempo.
- [ ] Instalar sem desativar Defender, SmartScreen, WDAC ou App Control.
- [ ] Abrir pelo atalho e confirmar **Pesagens Individuais**.
- [ ] Em **Manutenção**, confirmar versão **1.1.16** e armazenamento
      **IndexedDB local (Dexie)**.
- [ ] Confirmar que não há erro no `app.log` informado no diagnóstico.

## Persistência na primeira execução

- [ ] Criar um animal e uma pesagem de teste.
- [ ] Fechar completamente o aplicativo.
- [ ] Abrir novamente e confirmar que ambos permanecem.
- [ ] Confirmar que nenhum SQLite, servidor ou configuração manual foi solicitado.

## Backup e restauração

- [ ] Criar um backup completo JSON logo após a abertura.
- [ ] Conferir o arquivo no catálogo com tamanho e data.
- [ ] Guardar o SHA-256 apresentado.
- [ ] Exportar CSV e JSON e abrir os arquivos.
- [ ] Executar **Verificar integridade**.
- [ ] Em uma base isolada, analisar e restaurar o backup.
- [ ] Reabrir e comparar contagens e somas.

## Fluxos funcionais mínimos

- [ ] Cadastro e manejo do mesmo animal.
- [ ] Mesmo número em duas marcas, com escolha explícita.
- [ ] Pesagem retroativa e recálculo da cadeia de ganho/GMD.
- [ ] Saída por venda e por abate.
- [ ] Morte sem peso.
- [ ] Apartação e transferência de lote.
- [ ] Importação CSV com `1.000,00`, data brasileira e campo entre aspas.
- [ ] Tema claro/escuro, filtros, modais e rolagem horizontal.

## Atualização e reinstalação

- [ ] Instalar a mesma versão por cima e confirmar a preservação dos dados.
- [ ] Se houver uma versão anterior suportada, atualizar e revalidar os dados.
- [ ] Desinstalar e confirmar a política esperada para os dados do usuário.

## Resultado

- Data: _______________
- Computador/Windows: _______________
- Versão do instalador: _______________
- SHA-256: _______________
- Signatário: _______________
- Resultado: [ ] aprovado  [ ] reprovado
- Evidências/observações: _______________
