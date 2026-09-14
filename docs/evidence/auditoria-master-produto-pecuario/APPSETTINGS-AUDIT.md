# APPSETTINGS-AUDIT — O que vive em `appSettings` e em `localStorage`

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Chaves em `appSettings` (Dexie, store `key → value`)

| Chave | Conteúdo | Escrita por | Lida por | Classificação | Destino |
|---|---|---|---|---|---|
| `cadastros-auxiliares:comerciais:<empresa>` | `{compradores[], vendedores[], frigorificos[]}` | `registryService.saveRegistryGroup` (via `CadastroAuxiliarPage`) | `LancamentoPesagensIndividuais` (`auxiliaryCatalogs`) | **DEVERIA VIRAR STORE** | `parceiros` (v7) |
| `cadastros-auxiliares:mortalidade:<empresa>` | `{causasMorte[]}` | idem | Lançamento (causa da morte) | **DEVERIA VIRAR STORE** | `causasMorte` (v7) |
| `cadastros-auxiliares:sanidade:<empresa>` | `{programasSanidade[], medicamentos[]}` | idem | ninguém operacionalmente | **LEGADO** (contradiz ADR-007) | remover (`SANITY-ADR-REVIEW.md`) |
| `perfis-saida:<empresa>` | `{compradores[], venda[], abate[]}` | `GerenciarSaidasDialog`; `registryService` reescreve `compradores` a cada gravação | `GerenciarSaidasDialog`, `registryService.loadRegistryGroup` (compat) | **LEGADO** e DUPLICADO | migrar compradores para `parceiros`; descartar perfis |
| `resumo-personalizado:<empresa>` | lista de resumos configurados (campo, operação, escopo, agrupamento) | `ConfigurarResumosDialog` via Lançamento | Lançamento (`ResumoPersonalizado`) | **CONFIGURAÇÃO REAL** | manter |

Não há outras chaves gravadas pelo código atual (grep em `src/`: só `settingsService`, `registryService`, `GerenciarSaidasDialog`, Lançamento).

## 2. Chaves em `localStorage` (fora do backup)

| Chave | Conteúdo | Classificação | Observação |
|---|---|---|---|
| `empresa_selecionada_id` | `'local'` | CONFIGURAÇÃO REAL (de instalação) | fixa até F7 |
| `erp-tema` | claro/escuro | CONFIGURAÇÃO REAL (de usuário) | |
| `pesagens-colunas-*`, `aux-colunas:<grupo>:ordem|visiveis`, filtros salvos das telas | ordem/visibilidade de colunas | CONFIGURAÇÃO REAL (de usuário) | aceitável fora do backup; documentar que reinstalar perde |

## 3. Regras propostas

1. `appSettings` guarda **somente** configuração: preferências, políticas com versão (`politica-avisos`, `exigir_documento_venda`), resumos personalizados, última sessão aberta. Nada com id, histórico, contagem ou vínculo.
2. Catálogo com poucos valores e sem vínculo (ex.: lista de UFs) pode ser **CATÁLOGO SIMPLES** em `appSettings` — hoje não existe nenhum caso; sexo (`M/F`) e motivos de saída são enums de código, e devem continuar assim.
3. Toda chave nova recebe versão no valor (`{versao: 1, ...}`) para permitir migração sem tabela.
4. `registryService` é substituído por serviços de store; `CadastroAuxiliarPage` recebe uma porta de persistência.

## 4. Migração

Ordem: exportar as chaves atuais para JSON (evidência) → criar stores → semear → validar contagens → apagar chaves `cadastros-auxiliares:*` e `perfis-saida:*`. `resumo-personalizado` permanece.

## 5. Risco

`registryService.saveRegistryGroup` regrava o JSON inteiro por gravação e mantém sincronismo com `perfis-saida`; enquanto a migração não acontece, qualquer nova funcionalidade que grave nesses catálogos aumenta a dívida. Recomendação: **congelar** novas chaves de catálogo em `appSettings` a partir desta auditoria.
