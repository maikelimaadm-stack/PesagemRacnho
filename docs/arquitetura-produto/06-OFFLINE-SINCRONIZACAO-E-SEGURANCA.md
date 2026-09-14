# 06 — Offline, sincronização, login e segurança

## 1. Decisão central

Login e base online serão adicionados sem retirar a autonomia local. O servidor
não participa do caminho crítico entre clicar em Salvar e receber a confirmação
do lançamento.

```text
UI → caso de uso → transação local
                    ├─ fato/projeções/auditoria
                    └─ evento na outbox
                              ↓ quando possível
                         sincronizador
                              ↓
                            API
```

## 2. Estados de sincronização

- `local_only`: criado antes de uma conta/base online existir;
- `pending`: aguardando envio;
- `syncing`: tentativa em andamento;
- `synced`: confirmado pelo servidor;
- `retry`: falha transitória;
- `conflict`: requer política ou decisão;
- `rejected`: servidor rejeitou por regra não transitória.

O estado de sincronização não altera a validade local do fato, mas pode impedir o
fechamento corporativo até a reconciliação.

## 3. Outbox transacional

Toda mutação sincronizável grava, na mesma transação:

- ID da operação;
- entidade e ID;
- ação;
- versão anterior/nova;
- payload mínimo;
- usuário/dispositivo;
- instante e data operacional;
- chave de idempotência;
- dependências;
- número de tentativas e último erro.

Se a gravação do fato ocorrer e a outbox falhar, a transação inteira falha. Isso
evita dado local que nunca possa ser sincronizado.

## 4. Recebimento e idempotência

O servidor mantém a chave de idempotência e devolve a mesma resposta quando uma
operação já confirmada for reenviada. Retries usam backoff com jitter e não
dependem de o aplicativo permanecer aberto continuamente.

Ordem de dependência:

```text
Empresa/Fazenda → Cadastros → Animal → Sessão → Pesagem/Movimento → Fechamento
```

Operações independentes podem ser agrupadas; dependências não são enviadas fora
de ordem.

## 5. Política de conflitos

| Tipo | Política inicial |
|---|---|
| Dois cadastros editados | comparação de versão + resolução de campos |
| Mesmo identificador em animais distintos | conflito crítico, nunca mesclar automaticamente |
| Nova pesagem em dois dispositivos | manter fatos distintos; detectar duplicidade de negócio |
| Alteração de pesagem já editada | revisão manual com antes/depois |
| Lote atual divergente | reconstruir de movimentos após reconciliar eventos |
| Configuração | última versão publicada; rascunhos permanecem locais |
| Exclusão versus nova operação | conflito crítico e auditoria |

“Última gravação vence” não será regra global, porque pode perder fatos do
curral.

## 6. Multiempresa e isolamento

Toda entidade de negócio carrega `tenant_id`/empresa e, quando aplicável,
`fazenda_id`. A API deriva o tenant da autorização, não aceita que o cliente
escolha livremente outro tenant.

Controles:

- isolamento em consultas e comandos;
- índices compostos por tenant;
- armazenamento local separado ou logicamente particionado;
- backup identificado por empresa/fazenda;
- testes automatizados de acesso cruzado;
- exportação sujeita a permissão.

## 7. Login

### Desktop offline

Depois do primeiro login online bem-sucedido, o aplicativo pode emitir uma sessão
offline local protegida, com prazo e políticas definidas. Senha nunca é armazenada
localmente em texto puro.

Requisitos:

- autenticação moderna via provedor próprio/OIDC;
- tokens no armazenamento seguro do sistema operacional;
- refresh token rotacionado;
- bloqueio local configurável;
- recuperação administrada;
- revogação de dispositivo na próxima conexão;
- modo de contingência documentado.

### Papéis iniciais

- administrador;
- gerente;
- operador;
- administrativo/comercial;
- consulta;
- auditor.

Permissão é capacidade, por exemplo `weighing.create`, `session.close`,
`weighing.correct`, `commercial.view_values`, `audit.read`.

## 8. Identidade de dispositivo

Cada instalação recebe UUID e chave local protegida. O servidor mantém:

- nome amigável;
- empresa/fazenda permitida;
- último acesso;
- versão do app;
- estado ativo/revogado;
- posição da sincronização.

O ID do dispositivo participa da auditoria, mas não substitui o usuário.

## 9. Proteção de dados

- TLS em trânsito;
- criptografia gerenciada no servidor;
- segredos fora do repositório;
- princípio do menor privilégio;
- logs sem credenciais;
- anexos com URL temporária;
- backups com controle de acesso e retenção;
- política de exportação;
- exclusão/anonimização somente conforme requisitos legais e históricos.

Criptografia integral do banco local é uma decisão separada: IndexedDB do
Chromium não oferece automaticamente um cofre de domínio. Se necessária, avaliar
ameaça, desempenho, recuperação de chave e migração antes de prometer.

## 10. Auditoria

Registrar:

- login, logout e falhas relevantes;
- criação, edição, cancelamento e reabertura;
- importação/exportação;
- mudança de regra/configuração;
- fechamento de sessão/operação;
- resolução de conflito;
- concessão de permissão;
- backup/restauração;
- integração externa.

Auditoria é append-only do ponto de vista da aplicação. A visualização deve
mascarar dados conforme permissão.

## 11. Backup no modelo híbrido

Mesmo com nuvem, continuar oferecendo backup local verificável. A nuvem não
substitui restauração testada.

Camadas:

1. transação e recuperação do IndexedDB;
2. backup local automático/manual;
3. sincronização com servidor;
4. backup do servidor;
5. teste periódico de restauração.

## 12. Atualização do aplicativo

Antes de ativar atualização automática:

- assinatura Authenticode confiável;
- canal estável/beta;
- manifesto assinado;
- verificação de versão e checksum;
- migração do banco testada;
- rollback de binário compatível com esquema;
- preservação do banco local;
- bloqueio de downgrade perigoso.

## 13. Critérios de aceite da sincronização

- criar 10.000 operações offline e sincronizar sem perda/duplicidade;
- interromper rede em cada etapa e retomar;
- reenviar lote já confirmado sem duplicar;
- dois dispositivos editarem o mesmo cadastro e gerar conflito controlado;
- duas pesagens legítimas não serem apagadas por merge;
- revogar dispositivo;
- impedir acesso entre empresas;
- reinstalar app preservando dados e retomando fila;
- restaurar backup e reconciliar posição de sync;
- observabilidade suficiente para suporte sem expor segredos.

## 14. LGPD e governança

O produto trata principalmente dados operacionais e de pessoas relacionadas à
empresa, transporte e usuários. Antes da nuvem:

- mapear finalidade e base legal;
- definir controlador/operador;
- minimizar dados pessoais;
- política de retenção;
- canal de atendimento;
- contrato com provedores;
- resposta a incidente;
- registro de exportação e acesso.

Este documento define arquitetura, não substitui avaliação jurídica.

