# Estratégia de escopo CSS

## Escopo mestre

Toda a fundação é montada dentro de:

```html
<div class="mb1-scope cadastro-emp-scope mg-empresas-scope">...</div>
```

`.mb1-scope` é o limite de segurança local. As classes adicionais preservam o vínculo semântico com o ModeloBase1 real, mas o novo CSS não depende dos seletores globais da referência.

## Regras adotadas

1. Variáveis ficam somente em `.mb1-scope`.
2. Regras de reset usam `.mb1-scope`, nunca `body`, `button`, `input` ou `table` globalmente.
3. Todos os componentes usam prefixo `.mb1-`.
4. Conteúdos portaled de Dialog e Popover recebem `.mb1-scope` na própria raiz do portal.
5. A importação acontece pelo wrapper `ModeloBase1Tokens`, usado apenas no laboratório.
6. `src/main.jsx` e os CSS globais existentes não foram alterados.
7. Não há seletores contra componentes operacionais atuais.

## Riscos mitigados

- colisão com `.d17b-*` existente: evitada pelo prefixo;
- vazamento em tabelas operacionais: inexistente; todas as regras partem de `.mb1-scope`;
- Radix fora do escopo por portal: resolvido adicionando `.mb1-scope` no `Content`;
- alteração de `body`/root: nenhuma;
- `!important` global: não usado na fundação nova.

## Verificação estática

`rg` sobre `modelo-base1-components.css` confirma que todos os seletores de componente começam com `.mb1-scope` ou `.mb1-dialog-overlay`. O overlay é deliberadamente global apenas como uma classe única e exclusiva do componente.
