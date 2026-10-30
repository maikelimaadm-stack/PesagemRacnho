# Migração 8 → 9 e como voltar

## O que a migração faz

A versão 1.6.0 abre o banco da 1.5.x (versão 8) e o atualiza para a versão **9**.

1. **Antes de mudar qualquer coisa,** grava o **backup pré-migração** (`backups/pre-migration-v9-AAAAMMDD-HHMMSS.json`)
   e o confere.
2. **Cria as tabelas novas, vazias:** operações, itens, dentição, livro de identificadores, posologias,
   calendário, metas e documentos.
3. **Acrescenta índices.** Nenhum registro existente é reescrito pelo esquema.
4. **Roda o passo de dados v9**, que é resumível e idempotente:
   - classifica cada movimento como entrada, saída ou interno;
   - cria **operações legadas** a partir dos Cadastros (por dia) e das Saídas (por dia e motivo), com um item
     por pesagem. Nenhum parceiro, preço ou documento é inventado: elas ficam "Sem documento".

Se o computador desligar no meio, a migração continua de onde parou na próxima abertura. Repetir a migração não
duplica operações. O andamento aparece em **Manutenção avançada › Sistema › Migração**.

## Como voltar para a 1.5.x

O banco não volta de versão sozinho: não existe downgrade. A volta é feita pelo backup:

1. Desinstale a 1.6.0 **sem** apagar a pasta de dados. O instalador nunca apaga o banco.
2. Instale a 1.5.x.
3. Na 1.5.x, a abertura recusa o banco 9 ("backup/banco mais novo"). Use **Backup e Manutenção › Restaurar
   backup** e escolha o arquivo **`pre-migration-v9-…json`** da pasta `backups`.
4. Confira as contagens e faça login.

**Atenção:** o que foi lançado na 1.6.0 depois da migração **não** está no backup pré-migração. Antes de voltar,
anote ou exporte esses lançamentos (Relação de Pesagens › Exportar).

## Conferências feitas pelos testes automáticos

| Teste | O que confere |
|---|---|
| `migration:v9:verify` | upgrade 8 → 9 com backup; dados intactos; natureza; operações legadas; idempotência; backup da v8 restaurado no app v9 |
| `migration:v8:verify` e `migration:v7:verify` | a cadeia 7 → 8 → 9 inteira |
| `documents:backup:verify` e `backup:center:verify` | restauração em base limpa, com anexos e backup protegido |
