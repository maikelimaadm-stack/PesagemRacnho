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
