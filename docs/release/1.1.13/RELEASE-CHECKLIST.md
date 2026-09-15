# Checklist da release 1.1.13

## Automático

- [x] auditoria de dependências de produção sem vulnerabilidades (`npm audit --omit=dev`)
- [x] lint sem erros e sem avisos
- [x] build de produção
- [x] contrato de locale, diálogos, filtros, scrollbars e personalização
- [x] integridade do histórico de animais e regras de importação
- [x] armazenamento Dexie: CRUD, primeira execução, backup, exportação,
  importação, restauração e manutenção
- [x] Electron boot, preload e smoke desktop
- [x] sandbox Electron ativo e CSP local presente
- [x] suíte integral executada antes do pacote definitivo
- [x] Setup 1.1.13, SHA256 e manifesto gerados
- [x] `app.asar` validado com `packaged:source:verify` e `packaged:ui-build:verify`

## Segurança e distribuição

- [x] versão do código e lockfile: 1.1.13
- [x] sem vulnerabilidades em dependências de produção no momento da auditoria
- [ ] executável e instalador assinados digitalmente com certificado MAKGESTAO
- [x] hash SHA-256 conferido antes da distribuição

## Máquina limpa / atualização

- [ ] instalar `Pesagens Individuais Setup 1.1.13.exe` em Windows limpo
- [ ] confirmar versão 1.1.13 e interface D.17D.2R18 no diagnóstico
- [ ] testar cadastro, lançamento, filtros, modo claro e modo escuro
- [ ] testar backup, exportação, importação e restauração
- [ ] testar atualização preservando os dados do usuário
- [ ] desinstalar e reinstalar confirmando a preservação de dados
- [ ] registrar evidência da assinatura digital e ausência de alertas inesperados
