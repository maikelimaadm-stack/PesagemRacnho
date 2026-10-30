# P18 — Proteção da `main` e publicação do instalador (recomendação)

**Estado:** a recomendação está registrada, mas **não foi aplicada**. A proteção de branch é configuração
administrativa da conta do GitHub. Esta missão não tem essa permissão, e o prompt proíbe alterá-la.

## Configurar a proteção da `main`

Em **Settings → Branches** (ou **Rules → Rulesets**), crie uma regra para a branch `main`:

1. **Require a pull request before merging.**
   - Esta é a forma de trabalho atual: tudo entra por PR.
2. **Require status checks to pass**, marcando os checks:
   - **`testes`**, do workflow *Testes*. Ele roda lint, build, `test:quick` (testes unitários, integridade das
     pesagens, backup e todos os gates) e o E2E do app no Electron.
   - **`instalador`**, do workflow *Gerar instalador*. Ele só roda em PR que muda o `package.json` ou o
     próprio workflow. Por isso, marque-o como obrigatório **apenas** se quiser exigir um build do Windows em
     toda mudança de versão. Do contrário, PR sem essa mudança fica esperando um check que nunca roda.
3. **Require branches to be up to date before merging**, para que o check rode sobre a base atual.
4. **Block force pushes** e **restrict deletions**.

## Publicar o instalador

A publicação em **Releases** acontece **só** quando uma tag `vX.Y.Z` é criada. A tag precisa ser igual à
versão do `package.json`; se não for, o workflow falha. O passo de publicar é um job separado, que roda com
permissão de escrita e baixa o artifact já gerado.

Recomendações antes de criar a tag:
- Fazer o merge do PR com os checks verdes.
- Concluir a homologação manual da balança (`VALIDACAO-MANUAL-WINDOWS-S3.md`) quando a versão mexer na captura.
- Fazer um backup verificado no computador do curral antes de instalar a versão nova.

O instalador continua **sem assinatura** (`dist:unsigned`). A assinatura de código depende de certificado,
que o proprietário decide quando comprar.
