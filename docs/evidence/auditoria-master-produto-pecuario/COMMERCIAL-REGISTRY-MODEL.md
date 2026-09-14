# COMMERCIAL-REGISTRY-MODEL — Parceiros comerciais (comprador, vendedor, frigorífico, transportador)

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual — duas implementações

| Implementação | Persistência | Campos | Uso |
|---|---|---|---|
| `CadastrosComerciais.jsx` via `registryService` | `appSettings['cadastros-auxiliares:comerciais:local']` = `{compradores[], vendedores[], frigorificos[]}` | nome, documento, telefone, email, cidade, ativo, observacoes; vendedor: propriedade; frigorífico: sif | Lançamento (`auxiliaryCatalogs`) seleciona por **nome** |
| `GerenciarSaidasDialog.jsx` | `appSettings['perfis-saida:local']` = `{compradores[], venda[], abate[]}` | comprador: nome, documento, telefone, cidade; venda/abate: perfis com preços | botão "Usar no lançamento"; `registryService` copia compradores para cá em toda gravação |

Consequências:

- a mesma pessoa pode existir em três listas (comprador, vendedor, frigorífico) com ids diferentes;
- o lançamento grava o **nome** (`comprador: 'Frigorífico X'`), então renomear quebra o vínculo;
- o JSON único cresce e é regravado inteiro a cada alteração (sem índice, sem paginação);
- não há transportador/motorista como cadastro;
- o `registryService` mantém sincronismo com uma chave legada — dívida em dobro.

## 2. Modelo alvo — Parceiro com papéis

### 2.1 Store `parceiros` (Dexie v7)

| Campo | Regra |
|---|---|
| `id`, `empresa_id` | padrão |
| `nome` | obrigatório; `nome_normalizado` indexado |
| `tipo_pessoa` | `FISICA` / `JURIDICA` |
| `documento` | CPF/CNPJ só dígitos; opcional; único por empresa quando informado |
| `papeis` | array: `COMPRADOR`, `VENDEDOR`, `FRIGORIFICO`, `TRANSPORTADOR`, `PROPRIETARIO` (dono de marca) — multiEntry index |
| `telefone`, `email`, `cidade`, `uf` | opcionais |
| `registro_sif` | opcional; só faz sentido para FRIGORIFICO |
| `rendimento_padrao` | opcional; FRIGORIFICO/COMPRADOR; usado como sugestão na operação |
| `observacao`, `ativo`, timestamps | padrão |

Índices: `++localId, &id, empresa_id, nome_normalizado, *papeis, ativo`.

### 2.2 Regras

1. Um parceiro, vários papéis: o frigorífico que também compra bezerros é um registro.
2. Operações e embarques referenciam `parceiro_id`, nunca o nome.
3. Inativar não apaga; exclusão só quando nenhum vínculo existir (mesma regra atual do `GerenciarSaidasDialog`, agora no serviço).
4. A tela lista por papel (aba/filtro) usando a Tela Mãe já portada; a ficha é única.

### 2.3 Propriedade do vendedor

`vendedor.propriedade` (texto) vira vínculo opcional com `propriedades` (`PROPERTY-FARM-MODEL.md`). Um parceiro pode ter várias propriedades de origem.

## 3. Migração

1. Ler os três buckets de `cadastros-auxiliares:comerciais` e `perfis-saida.compradores`.
2. Unir por `documento` (quando houver) ou `nome_normalizado`; consolidar `papeis`.
3. Criar `parceiros`; gerar tabela de correspondência `nome antigo → parceiro_id`.
4. Resolver nomes gravados nas pesagens (`comprador`, `frigorifico`, `origem_animal`) para `parceiro_id` **nas operações comerciais migradas**, não no payload.
5. Após validar: remover as chaves `cadastros-auxiliares:comerciais:*` e `perfis-saida:*` de `appSettings`, retirar `GerenciarSaidasDialog.jsx` e a sincronização legada do `registryService`.

## 4. Fora de escopo

Endereço completo com CEP/logradouro, dados bancários, limite de crédito, histórico de negociação, CRM. Dados fiscais sensíveis exigem análise própria (03 §5).
