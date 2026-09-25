# Pesagens Individuais 1.3.1 — notas da versão

Data: 23/09/2026 · Esquema Dexie 8 · Backup formato 3 · Instalador não assinado.

## O que muda para quem usa

### Relação de Pesagens
- Ao selecionar registros, o cabeçalho da coluna **Ações** mostra um botão verde de ações em lote.
- O menu separa Identificação e cadastro, Movimentação e Dados comerciais.
- Marca, raça, sexo, era e categoria passam a ser alterados no cadastro canônico do animal e em
  todo o histórico relacionado.
- Data, apartação e lote podem ser atualizados nos lançamentos selecionados.

### Compra, venda e abate
- Compra/cadastro: vendedor ou origem, valor por cabeça, GTA, NF-e, frete e observação.
- Venda: comprador, destino, valor total, valor da arroba, embarque e documento.
- Abate: frigorífico, valor total, valor da arroba, embarque e documento.
- Campos vazios significam **não alterar**; operações comerciais só alcançam os tipos de registros
  compatíveis.
- A configuração de colunas passa a oferecer GTA compra, NF-e compra e Frete compra.

## Compatibilidade
- O esquema de dados permanece na versão 8: esta atualização não exige migração destrutiva.
- Os dados existentes são mantidos na instalação sobre a versão anterior.

## Assinatura
- Este pacote é um instalador local não assinado. O SHA-256 e o manifesto acompanham o artefato,
  mas o Windows pode mostrar SmartScreen/Defender até ser usada uma assinatura Authenticode de uma
  autoridade certificadora confiável.
