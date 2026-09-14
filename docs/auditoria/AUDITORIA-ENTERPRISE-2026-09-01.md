# Auditoria Enterprise — Pesagens Individuais

**Data:** 01/09/2026  
**Versão do código auditado:** `1.1.13`  
**Escopo:** aplicação React/Vite, Electron/Windows, armazenamento offline Dexie/IndexedDB, rotinas de backup/importação, integridade de animais, UI, empacotamento e governança de release.  
**Método:** inspeção estática do código e da configuração, execução da suíte automatizada disponível e auditoria de dependências. Esta avaliação não substitui a homologação humana em máquina limpa.

## Resultado executivo

O produto tem uma base funcional consistente para operação **offline local**: o build passa, os contratos automatizados de dados passaram e a ponte Electron é restrita. Porém, na fotografia auditada, ele **não está pronto para uma liberação enterprise formal**. Há bloqueios objetivos de release e itens de segurança/governança que precisam ser tratados antes de distribuir a versão `1.1.13`.

| Pilar | Situação | Conclusão |
|---|---|---|
| Funcionalidade offline e dados | Aprovado com evidências automatizadas | CRUD, backup, restauração, importação, histórico e regras de pesagem passaram nos contratos. |
| Build e qualidade estática | Aprovado com ressalvas | Build de produção gerado; lint sem erros, mas com 1 aviso. |
| UI, locale e acessibilidade básica | Aprovado por contrato; requer aceite visual | Formato brasileiro, diálogos, foco, personalização e scrollbars passaram. Ainda falta teste visual humano em resoluções-alvo. |
| Segurança de dependências | Reprovado | `npm audit --omit=dev` encontrou 8 alertas altos e 1 moderado. |
| Release e instalador | Reprovado | O Setup existente é 1.1.12/1.1.11, não 1.1.13; faltam documentos obrigatórios da versão. |
| Segurança desktop | Parcial | Isolamento de contexto e preload mínimo estão corretos; sandbox Electron está desligado e o executável não é assinado. |
| Governança e rastreabilidade | Reprovado | A cópia auditada não está dentro de um repositório Git. |

**Decisão de gate:** `NÃO LIBERAR 1.1.13` até que os itens P0 e P1 deste relatório estejam resolvidos e revalidados.

## Atualização de remediação — 01/09/2026

As remediações técnicas controláveis foram aplicadas e revalidadas após a
emissão inicial deste relatório:

| Item anterior | Estado atual | Evidência |
|---|---|---|
| Vulnerabilidades de produção | Resolvido | `npm audit --omit=dev --json`: 0 vulnerabilidades (0 alta, 0 crítica). |
| Documentação 1.1.13 | Resolvido | Notas e checklist criados em `docs/release/1.1.13/`; `docs:user:verify` passou. |
| Suíte integral | Resolvido | `npm run test:full` passou integralmente. |
| Instalador correspondente | Resolvido | `Pesagens Individuais Setup 1.1.13.exe` gerado e validado contra o `app.asar`. |
| Integridade do pacote | Resolvido | `packaged:source:verify` e `packaged:ui-build:verify` passaram. SHA-256: `4145d193ec9b37baeb35075472ccd1f755ab4f00859fbc9eefeb9464926bb27e`. |
| Sandbox Electron | Resolvido | A janela usa `sandbox: true`, preservando `contextIsolation: true` e `nodeIntegration: false`; contratos de boot, preload e storage passaram. |
| CSP | Resolvido | Política de segurança local adicionada ao HTML e build aprovado. |
| Aviso de lint | Resolvido | `npm run lint` passou sem erros nem avisos. |

**Gate atualizado:** tecnicamente apto para **homologação externa controlada**.
Ainda não é possível declarar distribuição enterprise final porque assinatura de
code signing, ícone de marca, homologação em máquina limpa e governança remota
Git dependem de insumos ou decisões fora deste workspace.

## Evidências de execução

| Verificação | Resultado | Evidência resumida |
|---|---:|---|
| `npm run lint` | Aprovado com aviso | 0 erros; 1 aviso em `electron/logging/appLogger.cjs` por `eslint-disable` não usado. |
| `npm run build` | Aprovado com ressalvas | Produção gerada. Bundle JavaScript de 887,63 kB minificado; acima do limiar de 500 kB. |
| Contrato de locale e diálogos | Aprovado | `pt-BR`, `DD/MM/AAAA`, inteiros `1.000`, decimais `1.000,00`, 11 diálogos padronizados. |
| Personalização e UI operacional | Aprovado | Perfis de saída, resumos configuráveis, persistência e foco suave validados. |
| Integridade de histórico animal | Aprovado | Marca+número duplicável, propagação canônica, exclusão em cascata, persistência e seleção operacional validadas. |
| Importação | Aprovado | Seleção persistente, lotes rejeitados excluídos, lotes aceitos vinculados e motivo de saída selecionável. |
| Scrollbar | Aprovado | 10 px, gutter estável, prioridade Electron e modo escuro validados. |
| Inicialização Electron | Aprovado | Janela criada, 7 canais IPC, versão e escrita controlada de arquivo verificadas. |
| Contrato do preload | Aprovado | Apenas diagnóstico, pasta de dados, escrita de arquivo e diálogos são expostos. |
| Armazenamento Dexie | Aprovado | 9 stores, CRUD, primeira execução, backup, CSV/JSON, importação/restauração e manutenção passaram. |
| Mapper de pesagem e manutenção | Aprovado | Contratos de mapeamento, UI e diálogos passaram. |
| Smoke desktop | Aprovado | Script `desktop:smoke:verify` passou. |
| Artefato instalado em modo permissivo | Parcial | Estrutura do artefato foi validada, mas não houve instalação/execução real. O instalador localizado foi `1.1.11`, não `1.1.13`. |
| `npm run test:full` | Reprovado (gate documental) | Interrompido pela ausência de `docs/release/1.1.13/RELEASE-NOTES.md` e `RELEASE-CHECKLIST.md`. |
| `npm audit --omit=dev --json` | Reprovado | 9 vulnerabilidades: 8 altas e 1 moderada. |

## Achados e plano de correção

| Prioridade | Achado | Evidência | Risco | Ação exigida | Critério de aceite |
|---|---|---|---|---|---|
| P0 | Dependências com vulnerabilidades conhecidas | `npm audit --omit=dev`: 8 altas, 1 moderada; inclui `react-router-dom`/`react-router`, `postcss`, `glob`, `minimatch`, `brace-expansion`, `nanoid`, `picomatch` e `yaml`. | Exposição a XSS, redirecionamento, DoS ou leitura indevida conforme o pacote e o cenário de execução. | Atualizar dependências diretas e lockfile de maneira compatível; revisar mudanças de rota e build. | `npm audit --omit=dev` sem vulnerabilidades alta/crítica; suíte integral e teste de rotas aprovados. |
| P0 | Gate de release 1.1.13 quebrado | A suíte falhou porque não existem os dois documentos de release requeridos pelo próprio projeto. | Não há rastreabilidade, instrução de rollback nem evidência de homologação da versão. | Criar notas e checklist da versão, com mudanças, riscos conhecidos, SHA-256, instalação limpa e rollback. | `npm run docs:user:verify` passa; checklist preenchido com evidências reais. |
| P0 | Instalador não corresponde ao código atual | `package.json` está em 1.1.13; `release/` contém Setups 1.1.11 e 1.1.12. | Usuário pode instalar uma versão diferente da que foi aprovada/testada. | Gerar o Setup 1.1.13 após aprovação da segurança, criar manifesto e checksum e validar o `app.asar`. | Setup, manifesto, SHA-256 e diagnóstico interno apontam para 1.1.13; `packaged:source:verify` e `packaged:ui-build:verify` passam. |
| P1 | Executável sem assinatura de código | `build.win.signAndEditExecutable` está `false` e não há configuração de certificado. | Alertas SmartScreen, menor confiança e risco de adulteração percebida. | Obter certificado de code signing, assinar Setup e executável, armazenando segredo fora do código. | Assinatura válida no Windows e cadeia de certificado verificada em máquina limpa. |
| P1 | Sandbox Electron desligado | `electron/main.cjs` define `sandbox: false`, embora `nodeIntegration: false` e `contextIsolation: true` estejam corretos. | Aumenta a superfície de impacto caso o renderer seja comprometido. | Avaliar e habilitar `sandbox: true`; adaptar apenas APIs necessárias do preload e executar smoke completo. | Janela inicia com sandbox ativo; fluxos de backup/importação/manutenção continuam aprovados. |
| P1 | Não há repositório Git nesta cópia | `git status` retorna “not a git repository”. | Sem histórico auditável, revisão de mudanças, tag de release ou rollback confiável. | Inicializar/restaurar repositório remoto privado, adicionar `.gitignore`, branch protegida e tags de release. | `git status`, pull request revisado e tag imutável `v1.1.13` disponíveis. |
| P2 | Teste de instalação real não foi executado | O verificador de artefato informa explicitamente execução não realizada; depende de checklist manual. | Falhas de permissões, atalho, upgrade, dados de usuário ou primeira execução podem passar despercebidas. | Rodar a instalação em VM/Windows limpo, com usuário sem privilégios administrativos e também cenário de upgrade. | Evidência de instalação, abertura, cadastro, backup, restauração, desinstalação e preservação de dados. |
| P2 | Bundle principal acima do limiar | Vite reportou JS minificado de 887,63 kB. | Inicialização e manutenção futura menos eficientes. | Dividir páginas pesadas por `lazy()`/`dynamic import`, sem alterar fluxos. | Bundle inicial abaixo do limiar definido pelo time ou justificativa formal registrada. |
| P3 | Avisos de manutenção | ESLint: 1 `eslint-disable` não utilizado. Browserslist/baseline data desatualizados. | Ruído no CI e qualidade de manutenção inferior. | Remover o disable obsoleto e atualizar bases de compatibilidade em mudança dedicada. | Lint sem avisos e build sem alertas de base desatualizada. |
| P3 | CSP ausente no HTML | `index.html` não declara Content Security Policy. | Defesa em profundidade menor contra injeção de conteúdo, principalmente se futuramente houver conteúdo remoto. | Definir CSP compatível com Vite/Electron e testar produção. | Política restritiva registrada; app empacotado e desenvolvimento aprovados. |

## Avaliação da arquitetura atual

### Pontos fortes

- O sistema tem escopo local/offline coerente: dados operacionais ficam em IndexedDB/Dexie e os contratos confirmaram primeira execução, CRUD, backup e restauração.
- O processo principal do Electron mantém `nodeIntegration: false` e `contextIsolation: true`.
- O preload é pequeno e específico; a UI não recebe acesso genérico a Node, filesystem ou IPC.
- Diálogos de importação aceitam JSON e validam extensão, arquivo regular e JSON antes da devolução ao renderer.
- Escrita de arquivos é centralizada no processo principal, com normalização de subdiretório e `basename` do nome do arquivo.
- Há um conjunto útil de verificadores de regressão para domínio de pesagens, formatação brasileira, persistência, UI e empacotamento.

### Limites de arquitetura a aceitar ou evoluir

- O aplicativo **não implementa autenticação, perfis, permissões, servidor ou sincronização**. Isso é coerente para uso local individual, mas não atende por si só uma operação multiusuário, auditável por usuário ou centralizada.
- Como os dados estão no perfil local do Windows/IndexedDB, backup frequente e procedimento de restauração são controles operacionais indispensáveis.
- A validação automática de UI garante contratos de código, não substitui comparação visual humana em telas, zoom e resoluções usadas pelos operadores.

## Checklist de homologação manual obrigatório

Executar em Windows limpo antes da próxima distribuição:

1. Instalar o Setup com usuário padrão, confirmar atalho, ícone, nome e versão em Diagnóstico.
2. Abrir o sistema, criar apartação, lote, sanidade/medicamento e animal; fechar e abrir novamente para confirmar persistência.
3. Criar lançamento de cadastro, manejo e saída; confirmar que sexo, raça, era e marca são propagados conforme a regra de histórico.
4. Validar identificação repetida em marcas diferentes e a confirmação/efeito de exclusão em cascata.
5. Testar filtros de cabeçalho, filtros personalizados, datas simples/entre datas, ordenação, configuração de colunas e rolagem horizontal.
6. Validar todos os pop-ups em modo claro e escuro, teclado, foco, fechamento pelo X e ausência de botões duplicados.
7. Fazer backup JSON, exportar CSV/JSON, restaurar em perfil limpo e comparar quantidades/somas de registros.
8. Testar importação com seleção parcial, arquivo inválido e cancelamento do diálogo.
9. Atualizar de uma versão anterior preservando dados; desinstalar sem excluir dados; reinstalar e confirmar recuperação.
10. Verificar assinatura digital, SHA-256, versão do executável e ausência de alertas inesperados do Windows.

## Sequência recomendada de estabilização

1. Corrigir vulnerabilidades e congelar um lockfile auditado.
2. Corrigir os documentos de release 1.1.13 e eliminar o aviso de lint.
3. Habilitar sandbox e CSP em uma alteração pequena, com regressão completa.
4. Gerar e assinar o instalador 1.1.13, checksum e manifesto.
5. Executar a homologação em máquina limpa e de upgrade.
6. Versionar o estado aprovado em Git e publicar somente o artefato com a mesma versão/documentação.

## Reexecução da auditoria

Após as correções, o gate mínimo é:

```powershell
npm audit --omit=dev
npm run test:full
npm run dist
npm run packaged:source:verify
npm run packaged:ui-build:verify
npm run release:checksum
npm run release:manifest
```

Depois desses comandos, anexar a evidência da instalação limpa ao checklist da release. Somente então a decisão de liberação deve mudar para **APROVADO**.
