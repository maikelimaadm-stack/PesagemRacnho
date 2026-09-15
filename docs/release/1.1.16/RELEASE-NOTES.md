# Pesagens Individuais 1.1.16

Data: 04/09/2026  
Arquitetura: Electron + React/Vite + IndexedDB/Dexie, operação local offline

## Escopo entregue

- Modelo canônico de animal por número e marca, identificadores, movimentos,
  sessões, auditoria, importações e histórico de lotes.
- Projeções atuais de situação, lote, apartação, último peso e saída reconstruídas
  pelo histórico factual depois de inclusão, edição, cancelamento e importação.
- Cronologia protegida contra cadastro duplicado, data anterior ao cadastro,
  eventos depois da saída e saída retroativa conflitante.
- Sanidades e medicamentos persistentes, seleção múltipla no lançamento e
  aplicações ligadas à pesagem com exclusão lógica auditável.
- Importação CSV/JSON canônica, atômica e idempotente por SHA-256; qualquer erro
  estrutural ou cronológico reverte o lote inteiro.
- Backup completo das 18 stores com manifesto, versão, contagens e SHA-256.
  Importação, restauração e limpeza exigem evidência de um backup físico válido.
- Rendimento de carcaça configurável em venda e abate, com separação explícita
  entre peso vivo, peso de carcaça, arrobas e valor estimado.
- Consultas indexadas, paginação da tabela de lançamento e divisão do bundle por
  rota para manter resposta previsível em bases maiores.
- Padronização de botões, hover, campos, filtros, checkboxes, tabelas, tipografia,
  diálogos, modo escuro e barras de rolagem protegida por contrato automatizado.

## Dados existentes

O esquema evolui de forma aditiva. Por decisão expressa do responsável, esta
execução não migra, apaga nem regrava em massa os dados operacionais existentes.
Antes de qualquer restauração, importação ou limpeza, o aplicativo exige um
backup físico validado.

## Distribuição Windows

- Produto: Pesagens Individuais
- Versão: 1.1.16
- Plataforma: Windows x64
- Instalador oficial: permitido somente com assinatura Authenticode confiável
- Diagnóstico sem assinatura: `release-unsigned/`, não destinado à distribuição

Sem certificado de assinatura de código aceito pela política do Windows, não é
tecnicamente possível garantir instalação sem bloqueio do Defender/App Control.
O pipeline oficial falha de propósito nesse cenário, em vez de publicar um
executável que pareça aprovado.

## Limites da homologação automática

A inspeção visual automatizada da URL local foi impedida pela política do
ambiente. A consistência está coberta por contratos estáticos e build, mas a
homologação visual humana em claro/escuro e a instalação em máquina Windows limpa
continuam obrigatórias antes da publicação oficial.
