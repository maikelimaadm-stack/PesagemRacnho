# Riscos restantes

- A ausência de DM Sans local produz pequena diferença métrica em relação à referência; o fallback foi escolhido deliberadamente para preservar offline e licenciamento.
- O PROJETOMG original possui uma colisão de caixa entre arquivos do badge ERP no Windows; a referência foi observada em harness isolado com os componentes reais, não em uma sessão autenticada completa.
- A cobertura de navegador foi manual e direcionada; não foi criada infraestrutura nova de regressão visual ou axe.
- O bundle principal continua acima de 500 kB minificado, warning já existente e sem regressão funcional demonstrada.
- O E2E de aplicativo instalado depende de artefato/ambiente de instalação; nesta execução foi usado o modo permissivo já previsto pelo projeto.
- O workspace não possui Git, portanto não há diff/commit nativo. Hashes antes/depois e inventário de arquivos foram usados como trilha de auditoria.
