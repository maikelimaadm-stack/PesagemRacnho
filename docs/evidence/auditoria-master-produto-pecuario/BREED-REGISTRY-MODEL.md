# BREED-REGISTRY-MODEL — Cadastro de raças

**Auditoria master · 14/09/2026 · 1.1.17 · Dexie v6 · documento de auditoria, sem implementação**

## 1. Situação atual

- Valor padrão `'Nelore'` fixado em três lugares (`useState('Nelore')`, `criarConfiguracaoPadraoMovimentacao`, `snAnimal.findLatestSnProfile`).
- Lista de opções derivada de `pesagens.map(p => p.raca)`; qualquer texto pode ser adicionado no `ComboboxComNovo`.
- Gravado em `legacy_payload.raca` e `animais.raca`; importado do CSV pela coluna `Raça`/`Raca`.
- Não participa da identidade; usado como descrição na `SelecionarAnimalDialog`, `FichaAnimal` e resumos.
- Não há "Anelorado", "Cruzado", composição racial nem grupo genético, e o produto **não precisa** deles agora.

## 2. Modelo alvo

### 2.1 Store `racas` (Dexie v7)

| Campo | Regra |
|---|---|
| `id` | UUID |
| `empresa_id` | `'local'` |
| `nome` | obrigatório; único por empresa após normalização |
| `nome_normalizado` | índice |
| `abreviacao` | opcional |
| `grupo` | opcional, lista curta: `ZEBUINO`, `TAURINO`, `CRUZADO`, `OUTRO` (apenas para agrupar relatórios) |
| `padrao` | uma por empresa (substitui o `'Nelore'` fixo no código) |
| `ativo` | boolean |
| `ordem` | inteiro; ordem de exibição na seleção |
| timestamps | padrão |

Índices: `++localId, &id, empresa_id, nome_normalizado, ativo`.

### 2.2 Regras

1. Raça padrão é configuração da empresa, não constante de código.
2. Inativar não apaga; animais existentes continuam a exibir a raça.
3. Renomear não altera o snapshot `raca` dos eventos.
4. O cadastro rápido no curral pré-seleciona a raça padrão e permite trocar por teclado.

### 2.3 Sementes iniciais

Ao criar a store na migração v7, semear apenas as raças encontradas nos dados existentes mais a padrão `Nelore` se ausente. Não carregar catálogo nacional completo: cadastro pequeno é mais rápido no curral.

## 3. Migração

Mesmo procedimento da marca (`BRAND-REGISTRY-MODEL.md` §3), sem risco de identidade: raça não participa da chave. Colisões de grafia (`Nelore` × `NELORE` × `nelore `) fundem automaticamente pelo `nome_normalizado`.

## 4. Fora de escopo

Genealogia, composição racial percentual, registro em associação de criadores e características fenotípicas.
