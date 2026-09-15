# Notas da versão 1.1.1

Limpeza técnica (sem mudança de uso).

## O que mudou
- Removido todo o código do banco SQLite antigo, que não era mais usado desde a
  versão 1.1.0 (o app já guardava os dados no armazenamento local do sistema).
- O instalador não carrega mais o componente nativo do SQLite: ficou **menor** e
  com menos chance de alarme falso de antivírus.
- Limpeza de arquivos técnicos e testes obsoletos.

## Comportamento para o usuário
Nada muda: instalar, abrir e usar. Backup, exportação CSV/JSON, importação e
restauração continuam iguais. Nenhuma configuração de banco.

## Não inclui
- login, permissões, usuários/admin, cloud, servidor, sincronização online.

## Importante
- Use SOMENTE `Pesagens Individuais Setup 1.1.1.exe`.
- Na tela de Manutenção, confirme **Versão: 1.1.1**.
