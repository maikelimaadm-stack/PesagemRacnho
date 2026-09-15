# Pesagens Individuais 1.1.9

Correção dos cadastros persistentes de apartação, lote e sanidade, mantendo a
moldura visual de 3 px do ModeloBase1.

## Inclui

- cadastro, edição e exclusão de apartações persistidos no IndexedDB/Dexie;
- cadastro, edição e exclusão de lotes persistidos e vinculados à apartação;
- cadastro, edição e exclusão de configurações e itens de sanidade persistidos;
- listagens filtradas corretamente pela empresa ativa;
- compatibilidade com registros antigos salvos como `empresaId` ou `empresa_id`;
- releitura do banco aguardada pelos diálogos depois de salvar;
- ensaio automático que fecha e reabre o banco antes de conferir os dados;
- recuos inferior e direito de 3 px visualmente preservados;
- marcador `d17d2r14-persistent-auxiliary-crud-spacing-installer-2026-08-05`.

## Diagnóstico esperado

```text
Versão: 1.1.9
Interface: D.17D.2R14 · ModeloBase1 · d17d2r14-persistent-auxiliary-crud-spacing-installer-2026-08-05
```
