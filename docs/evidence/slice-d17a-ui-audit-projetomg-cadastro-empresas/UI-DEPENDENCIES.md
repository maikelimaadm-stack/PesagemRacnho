# Dependências visuais

## Já compartilhadas

Ambos possuem React 18.2, React DOM 18.2, React Router 7.2, TanStack Query 5.84.1, Sonner 2.0.1, `clsx`, CVA, `date-fns`, `tailwind-merge`, `tailwindcss-animate` e os pacotes Radix de checkbox, dialog, dropdown-menu, label, popover, select e slot.

Isso já cobre shell, cards, botões, campos, dialogs, menus, popovers, selects, ícones e toasts necessários à primeira implementação visual.

## Diferenças de versão

| Pacote | PROJETOMG | Pesagens | Decisão D.17A |
|---|---:|---:|---|
| `lucide-react` | `^1.21.0` | `^0.475.0` | Não atualizar apenas por estética. Validar ícones utilizados e manter a versão atual se a API atender. |

## Somente no Pesagens

- `dexie ^4.4.4`: dependência operacional e intocável na migração visual.
- `@hello-pangea/dnd ^17.0.0`: pode apoiar rearranjo já existente; não deve ser removida por comparação com a referência.

## Somente no PROJETOMG — potencialmente relacionada à UI

- `@tanstack/react-virtual ^3.14.2`: usada pela listagem virtualizada. Candidata somente se o volume e a UX do Pesagens comprovarem necessidade.
- Pacotes Radix adicionais: accordion, alert-dialog, avatar, collapsible, context-menu, hover-card, menubar, navigation-menu, progress, radio-group, scroll-area, separator, slider, switch, tabs, toast, toggle/group e tooltip.
- `cmdk`, `embla-carousel-react`, `input-otp`, `react-day-picker`, `react-hook-form`, `react-resizable-panels`, `recharts`, `vaul`, `zod`.

A mera existência desses pacotes na referência não justifica copiá-los. Tabs, scroll area e tooltip podem ser candidatos se um requisito funcional específico aparecer; a primeira opção deve ser o subconjunto já instalado e componentes simples acessíveis.

## Não copiar para a D.17B visual

- `@supabase/supabase-js`: backend/cloud incompatível com o escopo offline.
- `next-themes`: o Pesagens não precisa importar o provider de tema da referência para reproduzir o visual alvo.
- `recharts`, carousel, OTP, day picker, resizable panels, form engine e `zod`: não são requisitos para o shell visual auditado.
- O conjunto completo de Radix: aumentaria superfície e bundle sem necessidade demonstrada.

## CSS e fonte

Tailwind e os estilos ModeloBase1 já existem no Pesagens. As três folhas principais copiadas foram encontradas idênticas à referência; `mg-layout.css` difere apenas pela retirada do import remoto de DM Sans. Essa retirada é coerente com desktop offline. Para fidelidade tipográfica, a D.17B pode incluir um asset de fonte local somente após verificar licença, peso e impacto de bundle; não deve reativar dependência de rede.

## Decisão

**Nenhuma instalação é necessária para iniciar a D.17B.** Implementar primeiro com as dependências atuais. Avaliar `@tanstack/react-virtual` separadamente apenas se testes de volume mostrarem que a tabela não atende; qualquer instalação deve ser aprovada fora da D.17A e acompanhada de justificativa, lockfile e testes.
