# Checklist da release 1.1.16

## Automatizado

- [x] Runtime ativo sem páginas, componentes ou rotas antigas
- [x] Backend operacional único em IndexedDB/Dexie
- [x] Esquema versão 5 com 18 stores
- [x] Identidade canônica por número e marca
- [x] Situação atual e lotação reconstruídas pelo histórico
- [x] Cronologia individual e de importação validada
- [x] Ganho e GMD recalculados após alteração retroativa
- [x] Sanidades e medicamentos persistentes e auditáveis
- [x] Importação CSV/JSON atômica e idempotente por SHA-256
- [x] Backup com manifesto, contagens, SHA-256 e escrita física validada
- [x] Restauração transacional com conferência de contagens
- [x] Consultas indexadas, paginação e carregamento de rotas sob demanda
- [x] Contratos brasileiros de números, valores e datas
- [x] Contrato de consistência de UI e modo escuro
- [x] Pipeline oficial recusa pacote sem assinatura confiável
- [x] Artefatos de instaladores antigos removidos das duas pastas de saída
- [x] Dependências de produção: `npm audit --omit=dev` sem vulnerabilidades
- [x] Bundle empacotado confere com a versão, o modelo visual e o manifesto
- [x] Executável empacotado iniciou com sucesso em perfil de dados isolado

## Homologação humana e externa

- [ ] Revisão visual em 100%, 125% e 150%, temas claro e escuro
- [ ] Fluxo completo com teclado, mouse e leitor de tela
- [ ] Instalação, atualização, desinstalação e reinstalação em Windows limpo
- [ ] Backup físico, restauração e reabertura validados no aplicativo instalado
- [ ] Certificado Authenticode confiável fornecido ao pipeline
- [ ] Setup e aplicativo interno assinados, com cadeia e carimbo de tempo válidos
- [ ] Execução aprovada sob a política WDAC/App Control do ambiente de destino
- [ ] SHA-256 e manifesto do instalador oficial publicados

## Decisão de publicação

Enquanto os itens externos acima não estiverem concluídos, o código pode ser
usado em desenvolvimento e o pacote sem assinatura apenas em diagnóstico local.
Ele não deve ser classificado nem distribuído como release enterprise oficial.
