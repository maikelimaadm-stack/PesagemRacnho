# D.17D.1 — Relatório de execução

## Resultado

A fundação visual isolada do ModeloBase1 foi criada em `src/components/modelobase1/` e exposta somente pela rota direta `#/ModeloBase1VisualLab`. Nenhuma página operacional, regra de negócio, adaptador, banco, rotina de backup/importação/restauração ou arquivo Electron foi alterado.

## Entregas

- tokens extraídos do `mg-prototype.css` real;
- reset e CSS de componentes integralmente escopados por `.mb1-scope`;
- botões, campos, select, combobox e calendário customizado;
- trilho e chips de filtros com popover;
- shell de tabela, cabeçalho, seleção, paginação e rodapé de registros;
- dialog em portal com estrutura de transferência de colunas;
- popover, badges e estados vazio/carregando/erro;
- laboratório visual sem persistência e sem item no menu principal;
- plano de migração gradual D.17D.2 a D.17D.9.

## Limite confirmado

Arquivos operacionais preservados:

- `src/pages/PesagensIndividuais.jsx`;
- `src/pages/LancamentoPesagensIndividuais.jsx`;
- `src/pages/ManutencaoSistema.jsx`;
- `src/storage/**`;
- `src/modules/**`;
- `src/api/db.js`;
- `electron/**`;
- `package.json` e `package-lock.json`.

## Verificação

- `npm.cmd run lint`: passou com 0 erros e 1 aviso preexistente em arquivo proibido para este slice;
- `npm.cmd run build`: passou;
- `npm.cmd run test`: passou integralmente;
- regressão de Dexie, backup, import/restore, manutenção e desktop: passou.

## Bloqueio externo

Os servidores locais responderam em `5173` e `5174`, porém o controle do navegador recusou o acesso a `http://127.0.0.1:5173` por política de segurança. Conforme a regra de não contornar essa decisão, as capturas multirresolução e a comparação visual foram classificadas como `BLOQUEADO`. Nenhum componente foi declarado `IGUAL` sem essas evidências.
