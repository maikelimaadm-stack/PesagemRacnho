# Pesagens Individuais 1.1.13

Atualização de estabilidade visual, segurança de execução desktop e cadeia de release.

## Inclui

- barra de rolagem padronizada entre navegador de desenvolvimento e aplicativo
  Electron instalado, com largura fixa de 10 px, trilho, cursor, canto e modo
  escuro explicitamente definidos;
- contrato automatizado que impede prioridades de CSS divergentes para a tabela
  de pesagens no pacote instalado;
- atualização compatível das dependências de produção, com auditoria de produção
  sem vulnerabilidades conhecidas;
- Electron executando a janela com sandbox ativo, preservando isolamento de
  contexto e sem integração Node no renderer;
- Content Security Policy local para restringir scripts, objetos, frames,
  formulários, fontes, imagens e conexões da aplicação;
- limpeza do aviso de lint do registrador de diagnóstico.

## Diagnóstico esperado

```text
Versão: 1.1.13
Interface: D.17D.2R18 · ModeloBase1 · d17d2r18-scrollbar-parity-installer-2026-08-13
```

## Limites conhecidos

- O sistema é offline/local: não oferece login, permissões, sincronização em
  nuvem nem uso colaborativo centralizado.
- A assinatura digital do executável depende de certificado de code signing da
  MAKGESTAO e é uma etapa externa à compilação deste repositório.
- A liberação exige a evidência manual de instalação em Windows limpo descrita
  no checklist desta versão.

