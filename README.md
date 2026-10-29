# Pesagens Individuais

Aplicação desktop offline para cadastro, manejo, pesagem individual, histórico de
desempenho, lotes, apartações, operações de saída, embarques e manutenção dos
dados.

## Arquitetura do produto

A fonte de verdade para a evolução funcional e técnica está em
[docs/arquitetura-produto/README.md](./docs/arquitetura-produto/README.md).

Ela contém:

- visão e princípios;
- estado atual e lacunas;
- arquitetura de domínio e dados;
- catálogo de cadastros e fluxos;
- catálogo de relatórios e indicadores;
- contratos de integrações e equipamentos;
- estratégia offline, sincronização, login e segurança;
- roadmap e critérios de aceite;
- decisões arquiteturais;
- benchmark e referências.

## Desenvolvimento

```powershell
npm install
npm run dev
```

Aplicação desktop em desenvolvimento:

```powershell
npm run desktop:dev
```

Validação completa:

```powershell
npm run test:full
```

O build de distribuição oficial exige credenciais válidas de assinatura de
código. O build sem assinatura existe apenas para diagnóstico local.

## Instalador pelo GitHub (sem precisar de máquina local)

O workflow **Gerar instalador** (`.github/workflows/instalador.yml`) monta o
instalador do Windows numa máquina Windows do GitHub:

- **Manual:** aba *Actions* → *Gerar instalador* → *Run workflow*. O `.exe`
  fica em *Artifacts*, no fim da página da execução (guardado por 30 dias).
- **Versão publicada:** atualize a versão no `package.json`, faça o merge na
  `main` e crie a tag igual à versão (ex.: `v1.5.5`). O `.exe` também vai para a
  página *Releases*.

Por enquanto o instalador sai **sem assinatura de código** (`dist:unsigned`):
o Windows mostra "Editor desconhecido" ao instalar ("Mais informações" →
"Executar assim mesmo").

O workflow **Testes** (`.github/workflows/testes.yml`) roda lint, build e
`test:quick` em todo PR e em todo push na `main`.
