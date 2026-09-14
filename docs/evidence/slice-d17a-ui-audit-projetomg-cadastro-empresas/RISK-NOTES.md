# Notas de risco

| Risco | Nível | Mitigação exigida na D.17B |
|---|---|---|
| Copiar o runtime ModeloBase1 completo e importar domínio/backend/preferências | Crítico | Copiar somente apresentação/tokens; componentes recebem props e callbacks locais. |
| Alterar Dexie, schemas ou bootstrap durante uma mudança visual | Crítico | Bloquear `src/storage/**` e `DbBootstrap`; revisar diff e rodar regressão. |
| Quebrar backup/export/import/restore na tela de manutenção | Crítico | Não mover handlers; roteiro manual com arquivo de teste e conferência de contagens. |
| CSS ModeloBase1 global afetar todas as rotas | Alto | Escopar seletores, documentar cascata e testar as três páginas após cada etapa. |
| Declarar fidelidade sem screenshot da referência | Alto | Usar a expressão “aderência ao contrato”; obter baseline antes do aceite final. |
| DM Sans depender da rede em aplicativo offline | Alto | Asset local licenciado ou fallback formalmente aceito; teste offline. |
| Header/sidebar reduzirem área útil em janela pequena | Alto | Chrome mobile dedicado e testes em 390×844/768×1024. |
| Dialogs com grids fixos extrapolarem viewport | Alto | Layout responsivo, corpo rolável e alvos de 44 px. |
| Reescrever páginas de 1.700–2.180 linhas junto com a UI | Alto | Alterações regionais, wrappers e commits/etapas pequenos; sem refatoração funcional. |
| Ações visuais sem comportamento, como autofit atual | Médio | Toda ação deve ter callback real ou ser removida/ocultada. |
| Atualizar Lucide e quebrar ícones/API | Médio | Manter versão atual inicialmente; inventário de ícones antes de qualquer upgrade. |
| Virtualização alterar seleção, foco e navegação | Médio | Só adicionar por necessidade comprovada, com testes de volume/interação. |
| Primitivos UI globais mudarem telas auxiliares involuntariamente | Médio | Preferir wrappers escopados a editar `components/ui` globalmente. |
| Tokens legados azuis serem usados como referência por engano | Médio | Tratar `mg-prototype.css` no escopo Empresas como autoridade da cascata. |
| Build gerar artefatos fora da documentação | Baixo | Comando é obrigatório de validação; não versionar ou editar artefatos manualmente. |

## Pontos de parada

Interromper a D.17B e pedir decisão se: for necessária dependência nova; um componente visual exigir mudança de schema/query; o fluxo de backup mudar; o comportamento da referência não puder ser observado; ou a solução exigir conexão em runtime.
