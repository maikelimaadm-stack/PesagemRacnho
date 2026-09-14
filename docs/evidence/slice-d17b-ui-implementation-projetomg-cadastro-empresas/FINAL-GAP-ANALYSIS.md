# Análise final de gaps

## Fechados

- shell antigo substituído por shell full-height com header e sidebar equivalentes à referência;
- cores, superfícies, radius, bordas, gaps e densidade consolidados em tokens escopados;
- ação/filtro/listagem/KPIs alinhados ao modelo MAK;
- formulário de lançamento reorganizado no mesmo ritmo visual sem alterar handlers;
- manutenção alinhada por cards e seções;
- dialogs de Apartação, Sanidade e Embarque padronizados;
- mobile passou a usar header, drawer e navegação inferior coerentes;
- menus inertes foram removidos; menu de coluna permanece onde há ações reais;
- nomes acessíveis e retorno de foco foram fortalecidos;
- build de produção validada no navegador sem console warning/error.

## Desvios aceitos

1. **Tipografia:** fallback local de sistema em vez de DM Sans, para manter o app totalmente offline sem introduzir fonte remota ou asset de licença incerta.
2. **Referência isolada:** a rota foi renderizada com os componentes e estilos reais por harness visual temporário porque o App original dependia de backend/ambiente e apresentava colisão de caixa de arquivo no Windows. O harness foi removido após as capturas.
3. **Estado de edição da referência:** não alcançado com segurança sem backend; o estado de leitura e os componentes equivalentes foram medidos.
4. **E2E instalado:** validação permissiva do artefato, sem smoke de instalador empacotado.

## Pendências

Nenhuma pendência crítica de UI, persistência, Electron, offline, lint, build ou testes. Os itens acima são riscos/aperfeiçoamentos opcionais, não regressões do slice.
