# Pesagens Individuais 1.1.15

Data: 03/09/2026  
Interface: D.17D.2R20 · ModeloBase1 · `d17d2r20-indexed-animal-lookup-sn-profile-2026-09-03`

## Destaques

- Busca de animais indexada por identificação e identidade, removendo a pausa ao
  concluir o campo com `Tab` em bases com muitos lançamentos.
- Identificações numéricas ou nominais são convertidas e persistidas em letras
  maiúsculas.
- Ao salvar um animal `SN`, o sistema solicita Sexo, Raça, Era e Marca.
- Os dados do `SN` anterior são usados como preenchimento inicial para o próximo
  `SN`, podendo ser conferidos e alterados antes da gravação.
- Backup JSON completo com manifesto, versão única, contagens e SHA-256; escrita
  temporária, sincronização, renomeação atômica e validação do arquivo final.
- Importação CSV compatível com aspas, delimitadores internos, campos multilinha,
  BOM, números e datas brasileiras, com commit atômico.
- Novo modelo aditivo com identidade canônica, identificadores, movimentos,
  sessões de pesagem, auditoria e registro de importações.
- Histórico factual preservado e exclusão de cadastro bloqueada quando há eventos
  posteriores; alterações retroativas recompõem a cadeia de ganho e GMD.

## Desempenho verificado

O contrato automatizado usa 36.000 lançamentos e 12.000 animais. A seleção após
digitar a identificação usa um índice em memória, evitando a antiga reconstrução
quadrática do cadastro.

## Observação sobre os dados existentes

O esquema foi ampliado de forma aditiva. A conversão dos registros legados para as
novas projeções canônicas foi dispensada pelo responsável nesta execução; nenhum
registro existente foi apagado ou regravado em massa.

## Distribuição

- Produto: Pesagens Individuais
- Versão: 1.1.15
- Plataforma: Windows x64
- Armazenamento: IndexedDB/Dexie, offline
- Instalador oficial: gerado somente após assinatura Authenticode confiável

## Assinatura e política corporativa do Windows

O pacote inicialmente gerado não possuía assinatura Authenticode e foi bloqueado
corretamente pelo App Control. Ele não é mais considerado uma release oficial.

`npm run dist` agora exige `WIN_CSC_LINK` e `WIN_CSC_KEY_PASSWORD`, habilita
assinatura obrigatória e valida o executável interno e o Setup antes de gerar
checksum e manifesto. O certificado deve ser de assinatura de código, emitido
por uma autoridade confiável e acompanhado de carimbo de tempo.

Para diagnóstico local existe `npm run dist:unsigned`, cuja saída é isolada em
`release-unsigned/` e não deve ser distribuída.
