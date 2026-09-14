# Análise de gaps de UI

| Área | Cadastro de Empresas / PROJETOMG | Pesagens atual | Diferença | Ação necessária na D.17B | Risco |
|---|---|---|---|---|---|
| Layout geral | Shell full-height, chrome MAK e views empilhadas | Header próprio + conteúdo max-width | Arquitetura visual distinta | Criar shell/adaptadores visuais e aplicar por página | Alto |
| Menu/sidebar | Sidebar 220 px, grupos, ativo e pinagem | Três links horizontais | Ausente | Reproduzir sidebar com apenas rotas do Pesagens | Médio |
| Header | Desktop verde 36 px, breadcrumbs e ações; mobile 48 px | Header branco sticky, sem versão móvel própria | Cor, densidade, navegação e responsividade divergem | Criar header desktop/mobile fiel, sem ações inexistentes | Alto |
| Cards | Branco, borda sutil, radius 12, sombra mínima, gap 12 | shadcn `rounded-xl`, KPIs e cores utilitárias variadas | Hierarquia e decoração inconsistentes | Normalizar shell de cards sem alterar conteúdo | Médio |
| Formulários | Grid 12 colunas, cards/seções, abas e estados | Grids Tailwind específicos e campos condicionais | Sem padrão único e sem estados visuais equivalentes | Criar wrappers de seção/campo; migrar página por página | Alto |
| Tabelas | Engine completo: sticky, menu funcional, resize, pin, filtros, virtualização, footer | `MakTh`/menu parcial, tabela tradicional e paginação local | Sem engine completo; ação de autofit inerte | Replicar aparência e só portar funções comprovadamente necessárias | Alto |
| Filtros | Painel 260 px / drawer 280 px, Limpar/Aplicar | Card grande embutido no fluxo | Ocupa layout e não responde como referência | Adaptar filtros da listagem para painel/drawer | Alto |
| Botões | 28 px desktop/36 px mobile, verde/ghost/destrutivo | Kit local h-9/h-8 e várias cores | Altura, radius, ícones e variantes variam | Criar variantes visuais comuns e mapear ações existentes | Médio |
| Inputs | 38 px, idle/fill/readonly/lock/focus/error definidos | Input genérico h-9 e estilos locais | Estados e geometria incompletos | Aplicar contrato de campo sem mudar validação | Médio |
| Modais | Shell MAK/Radix consistente, corpo rolável, footer | Radix genérico e layouts próprios por domínio | Densidade e responsividade inconsistentes | Criar shell visual comum e adaptar conteúdo existente | Alto |
| Ícones | Lucide consistente, tamanhos de toolbar | Lucide em versão anterior e usos variados | Inconsistência de escala; possível diferença de API | Manter versão atual inicialmente e padronizar props/tamanho | Baixo/Médio |
| Cores | Verde `#40de63`, neutros definidos, vermelho/âmbar semânticos | Verde parcial + slate/emerald/blue/purple e HSL shadcn | Paleta misturada | Consolidar tokens ativos no escopo | Médio |
| Tipografia | DM Sans 13 px, UI compacta | Fallback sans; títulos/cards maiores | Métrica e hierarquia divergem | Definir estratégia offline da fonte e escala | Médio |
| Espaçamentos | Insets 8/10, gaps 10/12, toolbar 36 | `p-4`, `md:p-6`, `space-y-4` e variações | UI atual mais espaçada e irregular | Mapear densidade por região | Médio |
| Bordas/sombras | 1 px sutil, radius 8/12, sombras mínimas | rounded-xl e sombras do kit local | Elevação/radius variam | Normalizar via primitivas/wrappers escopados | Baixo |
| Busca | Pill + dropdown/favoritos | Campo dentro do card de filtros | Posição e interação diferem | Levar busca para toolbar quando seguro | Médio |
| Toolbar | Action bar contextual desktop/mobile | Títulos com ações dispersas | Ausente | Criar action bar visual alimentada por callbacks existentes | Alto |
| Empty/loading | Componentes e overlays estáveis | Texto/linha simples em vários pontos | Feedback menos consistente | Adicionar componentes presentacionais | Baixo |
| Toasts | `ErpToaster`, limites e classes semânticas | `Toaster` genérico top-right | Configuração e aparência parcial | Adaptar wrapper/config sem mudar chamadas | Baixo |
| Responsividade | Breakpoint estrutural 768, chrome mobile dedicado | Quebras ad hoc Tailwind; grids fixos em dialogs | Risco de overflow e ações cobertas | Implementar matriz de viewports e chrome móvel | Alto |
| Manutenção/diagnóstico | Não é uma tela idêntica na referência; linguagem de cards/actions é reutilizável | Tela operacional própria | Exige tradução visual, não cópia estrutural cega | Aplicar shell/cards/dialogs preservando fluxos | Alto |

## Síntese

O Pesagens já possui quase toda a camada CSS visual da referência e uma aproximação da tabela, mas não possui a composição real do ModeloBase1. O maior gap é estrutural: shell, action bar, filtros, modos de view, formulários e responsividade. A D.17B deve reduzir esse gap com componentes presentacionais pequenos e adaptadores, não com a cópia integral do framework MAK.
