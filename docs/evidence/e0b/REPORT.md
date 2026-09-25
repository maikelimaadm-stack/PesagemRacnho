```
ETAPA: E0B — Aplicar as decisões da E0 (Git + plano)     VERSÃO: 1.3.2 (sem bump)     BRANCH: program/sanity-launch-import
STATUS: CONCLUÍDA
```

Data: 25/09/2026. Base: `6ccf960` (REPORT da E0). Nada foi enviado (sem push); sem build/instalador;
nada da E1.

## 1. O que foi feito

1. Status limpo. O único arquivo novo era o `PROMPT-00B-DECISOES-E0.txt` que a responsável colocou
   (idêntico ao texto recebido); commitado sozinho como documentação (`6b13143`).
2. **main avançou só por fast-forward**: `77eeb3b → 6b13143` (`git merge --ff-only`, sem merge
   comum). Depois dos commits desta etapa, novo fast-forward até o HEAD da linha (autorizado no prompt).
3. **Tag anotada `v1.3.2`** no `1bb027c` (código do instalador 1.3.2), com a mensagem pedida. Sem `v1.3.1`.
4. **4 branches arquivadas**: tag `archive/*` criada, conferido que aponta para o mesmo commit da
   branch, e só então `git branch -D`:

   | Tag | Commit | Branch apagada |
   |---|---|---|
   | `archive/program-reporting-1.3.0` | `d44d5b9` | program/reporting-1.3.0 |
   | `archive/program-pesagens-master-evolution` | `a465123` | program/pesagens-master-evolution |
   | `archive/preview-1.2.0-demo` | `8977497` | preview/1.2.0-demo |
   | `archive/release-1.1.18` | `4d81b50` | release/1.1.18 (apagada depois do passo 5: o Git não apaga branch em uso por worktree) |

5. **Worktree `../MAKGESTAO-1.1.18` removido do jeito seguro**: junção `node_modules` removida com
   `cmd /c rmdir` (confirmado antes: `LinkType=Junction`, alvo `MAKGESTAO-main\node_modules`);
   `git worktree remove` **sem --force** aceitou (worktree limpo); `git worktree prune`.
   `MAKGESTAO-main\node_modules`: **antes 29.807 arquivos / 747.853.841 bytes; depois 29.807 /
   747.853.841 — igual.** A pasta 1.1.18 e `.git/worktrees/MAKGESTAO-1.1.18` não existem mais.
6. **Regra de branch unificada** — o mesmo texto em `00-LEIA-PRIMEIRO.md` §4.9 e em
   `_REGRAS-COMUNS.txt`: "Cada etapa cria sua branch program/e<N>-<nome> a partir de main. Ao concluir
   com gates verdes, main só avança (fast-forward) para a branch da etapa com autorização da
   responsável, dada na resposta ao REPORT. Nunca push sem autorização." (`b9fcb63`)
7. **Trava de "gravação em andamento" na importação** (`70f43c6`): o mesmo plano (tipo + hash do
   arquivo + mapeamento, regras e separador) chamado de novo enquanto grava devolve a **mesma**
   gravação — mesmo job, sem criar outro. A asserção do histórico voltou ao estrito original (todos
   CONCLUIDA). Correção pequena: um embrulho de ~30 linhas em `importService.js`; a gravação em si não
   mudou.
   - Revisão adversarial (3 revisores com ângulos diferentes + 1 cético por achado) confirmou 3 pontos,
     todos corrigidos antes do commit:
     a) (baixa) quem pegava carona pulava checagens do plano (registry.write para criar cadastros
        ausentes, plano bloqueante, somente leitura) → agora todas rodam **antes** da trava;
     b) (baixa) o comentário exagerava: na tela o botão "Gravar agora" já fica desabilitado; o duplo
        clique simultâneo vinha do gate/chamada programática → comentário corrigido;
     c) (média) o gate deixou de exercitar a guarda interna do gravador ("animal cadastrado depois da
        análise"), que continua sendo a proteção quando as chaves diferem (mesmo arquivo com separador
        `auto` × `;`) → caso determinístico novo no gate.
   - Casos novos no gate: carona em recusa recebe a mesma recusa e a trava é liberada; OPERADOR não
     pega carona em plano que exige registry.write; guarda do gravador fora da trava; chave da trava
     (ordem das chaves, regra/mapeamento/arquivo diferentes, `Set`).

## 2. Arquivos criados / alterados

- `docs/plano-mestre/prompts/PROMPT-00B-DECISOES-E0.txt` (novo, da responsável)
- `docs/plano-mestre/00-LEIA-PRIMEIRO.md`, `docs/plano-mestre/prompts/_REGRAS-COMUNS.txt`
- `src/modules/import/application/importService.js`
- `scripts/verify-import-idempotency.mjs`
- `docs/evidence/e0b/REPORT.md` (este)

Commits (sobre `6ccf960`): `6b13143` PROMPT-00B · `b9fcb63` regra de branch · `70f43c6` trava da
importação · REPORT da E0B.

## 3. Gates

| Comando | Resultado |
|---|---|
| `node scripts/verify-import-idempotency.mjs` ×20 (primeira versão da trava) | 20/20 verdes |
| idem ×25 (versão final, com os achados da revisão) | **25/25 verdes** |
| Controle negativo: trava desligada | 10/10 vermelhos ("refaça a análise" no 2º clique) |
| Controle negativo: registry.write só dentro da gravação (estado pré-correção) | vermelho ("OPERADOR não pega carona") |
| Controle negativo: guarda do importWriter desligada | vermelho ("uma gravação conclui") |
| `npx eslint` nos 2 arquivos | limpo |
| Gates de importação rodados pelos revisores na 1ª versão da trava (sanity, reconciliation, chronology, category-resolution, mapping, template, ui, selection, export-reimport, operational-customization) | verdes (os do test:quick rodaram de novo na versão final) |
| `npm run test:quick` (com `70f43c6`) | **verde — 76/76 passos, EXIT 0** |

## 4. Migração

Não há. Esquema Dexie 8, backup formato 3.

## 5. O que NÃO foi feito e por quê

- CHANGELOG: o contrato de versão proíbe bloco "Não lançado"; a correção do diálogo (`05e6d33`) e a
  trava (`70f43c6`) entram no bloco **[1.4.0]** da E1 (decisão da responsável: sem 1.3.3).
- `docs/user`: nada muda para quem usa (o botão já impedia o duplo clique na tela).
- Sem build/instalador, sem push, nada da E1 (conforme o prompt).

## 6. Riscos e pendências

- A trava vale dentro do processo (uma janela do app). Duas janelas/instâncias simultâneas continuam
  protegidas só pela guarda dentro da transação do importWriter (agora coberta pelo gate).
- A chave da trava usa a entrada crua do plano: o mesmo arquivo com regras equivalentes escritas de
  outro jeito (ex.: `ignoredLines` em outra ordem) não pega carona — cai na guarda do writer (seguro).
- Texto residual: `PROMPT-03` fala em "test:quick verde na linha de integração"; com a regra nova, a
  linha de integração é `main`. Não alterei (fora do escopo do 00B).
- E1 deve registrar no CHANGELOG [1.4.0] as duas correções acima.

## 7. Como a responsável testa

1. `git log --oneline -6 main` → mesmo HEAD de `program/sanity-launch-import`.
2. `git tag -n1 -l v1.3.2 "archive/*"` → `v1.3.2` com a mensagem do instalador e as 4 tags archive.
3. `git branch -a` → só `main` e `program/sanity-launch-import`.
4. `git worktree list` → só `MAKGESTAO-main`; a pasta `projeto\MAKGESTAO-1.1.18` não existe mais.
5. `npm run test:quick` → termina sem erro.
6. No app de desenvolvimento, importar um CSV pelo assistente e dar duplo clique em "Gravar agora" →
   um só registro no histórico de importações.

## 8. Perguntas para a responsável

1. Autoriza o PROMPT-01 (E1) a partir de `main`, criando `program/e1-relatorios`?
2. Ajusto o texto do PROMPT-03 ("linha de integração" → `main`) quando chegar a E3, ou agora?
