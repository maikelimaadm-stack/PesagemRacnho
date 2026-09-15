# Migração 1.1.17 → 1.2.0

Contrato: `docs/arquitetura-produto/14-MIGRACOES.md` e `12-MODELO-DADOS-V7-V8.md` §5
(ADR-018, ADR-021, ADR-023, ADR-034, ADR-038).

| | De (1.1.17) | Para (1.2.0) |
|---|---|---|
| Esquema Dexie | 6 | **7** |
| Formato de backup | 2 | **3** |
| Contrato de dados | 1 | **2** |
| Build de dados | — | `schema-v7` |
| Usuários locais | não existiam | obrigatórios (Configuração Inicial após a migração) |

A migração roda **sozinha na primeira abertura** da 1.2.0. Ela nunca destrói
dados: antes de abrir o banco na versão nova, grava e confere um backup físico;
se o backup falhar, o banco não é aberto na versão nova (fail closed).

## 1. Pré-requisitos

- [ ] Backup completo criado **na 1.1.17** (Manutenção › Criar backup completo),
      SHA-256 anotado e cópia guardada fora do computador.
- [ ] Espaço livre em disco: pelo menos 3 vezes o tamanho desse backup (o
      programa grava outro backup pré-migração e o banco cresce durante o backfill).
- [ ] Aplicativo desktop instalado (a migração exige a ponte de arquivos do
      Electron; no navegador de desenvolvimento ela é bloqueada, salvo a chave de
      desenvolvimento `pesagens.dev.allowUnsafeMigration`, nunca no pacote).
- [ ] Tabela `lotes` vazia. Se houver registros, a migração é bloqueada com
      `MIGRATION_BLOCKED_LOTES`: exporte/limpe pela Manutenção da 1.1.17 antes.
- [ ] Programa fechado durante a instalação do Setup 1.2.0.
- [ ] Tempo disponível conforme a tabela da seção 10 (não desligue no meio; se
      acontecer, a migração continua do ponto em que parou).

## 2. Backup pré-migração (automático)

Na primeira abertura da 1.2.0, antes de qualquer alteração:

1. O programa detecta o banco na versão 6.
2. Gera um backup completo **no formato da versão de origem** (formato 2),
   calcula o SHA-256, grava em `data\backups\pre-migration-v7-AAAAMMDD-HHmmss.json`
   (pasta de dados do aplicativo), relê o arquivo e confere tamanho e hash.
3. Registra o backup no catálogo (`backupHistory`, tipo `pre-migration`).
4. Só então abre o banco na versão 7.

Se o passo 2 falhar (disco cheio, pasta sem permissão, ponte indisponível):
**MIGRAÇÃO BLOQUEADA** — o banco continua na versão 6, a tela mostra o
diagnóstico e o programa não aceita gravações. Corrija a causa e abra de novo.

## 3. O que a migração faz

### 3.1 Upgrade leve (dentro da transação de versão do Dexie)

Somente conversões idempotentes de enumerações: `sessoesPesagem.status`
(Aberta/Fechada/Cancelada → ABERTA/FECHADA/CANCELADA), `loteApartacoes.situacao`
(de `fechado`), `apartacoes.ativo`. Remoção da tabela `lotes` (vazia). Criação das
tabelas novas (cadastros, faixas, usuários). Nenhum dado é apagado aqui.

### 3.2 Backfill resumível (após a abertura, em lotes de 500 registros)

| Passo | O que faz | Regra de segurança |
|---|---|---|
| **B1 marcas** | Coleta os textos de marca em animais, identificadores e pesagens; cria a tabela de marcas | Grafias que normalizam igual são unidas **só** quando a união não gerar dois animais diferentes com o mesmo número; caso contrário ficam marcas separadas e entram no relatório (`colisoesMarca`) |
| **B2 raças** | Cria raças a partir dos textos; `Nelore` como padrão se não existir | fusão automática por normalização |
| **B3 categorias** | Cria Bezerro, Bezerra, Garrote, Novilha, Boi, Vaca, Touro | ids gerados, nunca fixos |
| **B4 causas de morte** | Move as causas da configuração antiga para a tabela | ids preservados |
| **B5 parceiros** | Une compradores, vendedores e frigoríficos (e os compradores do diálogo legado) em parceiros com papéis | união por CPF/CNPJ ou nome normalizado |
| **B6 propriedades** | Cria "Propriedade principal" (própria, padrão); vendedores com propriedade em texto geram propriedade de terceiro | — |
| **B7 animais** | Preenche `marca_id`, `raca_id`, situação em enum, nascimento estimado a partir da "era" numérica | campos de texto antigos continuam como legado somente-leitura; saídas sem motivo mapeável viram `INATIVO` e são contadas |
| **B8 identificadores** | Tipo, `marca_id`, número normalizado, início | unicidade por (marca, número) |
| **B9 sessões e lotes** | Enumerações e campos novos | idempotente |
| **B10 payload** | Remove chaves redundantes do `legacy_payload` (`_localId`, `peso_kg`, `created_date`, `updated_date`, `status_animal`) | lista permitida (ADR-027) |
| **B11 limpeza** | Apaga as chaves `cadastros-auxiliares:*` e `perfis-saida:*` da configuração | só depois de B4/B5 validados por contagem; sanidade exportada antes |
| **B12 verificação** | Integridade lógica estendida + contagens; grava `status = CONCLUIDA` | — |

Cada passo só grava o que ainda falta; fechar o programa no meio e reabrir
continua do último checkpoint sem duplicar nada.

## 4. Andamento na tela

Durante o backfill a tela de inicialização mostra o passo atual, o total
processado e o total previsto. Ao terminar, o programa segue para a
**Configuração Inicial** (criação do administrador), pois a 1.1.17 não tinha
usuários.

## 5. Relatório esperado

Estado técnico em `appSettings['migration:v7']` (visível em Backup e
Manutenção e no "Copiar diagnóstico"):

```json
{
  "versao": 7,
  "status": "CONCLUIDA",
  "started_at": "2026-..-..T..:..:..Z",
  "finished_at": "2026-..-..T..:..:..Z",
  "processed": 36000,
  "total": 36000,
  "last_checkpoint": "B12",
  "error": null,
  "backup": { "path": "...\\data\\backups\\pre-migration-v7-....json", "sha256": "...", "size": 123456 },
  "relatorio": {
    "marcas": 5, "racas": 4, "categorias": 7, "causasMorte": 3, "parceiros": 3, "propriedades": 1,
    "animaisAtualizados": 12000, "identificadores": 12000,
    "colisoesMarca": [], "saidasSemMotivo": 0
  }
}
```

Como ler:

- `status = CONCLUIDA` e `error = null`: migração completa.
- `colisoesMarca` não vazio: grafias de marca que **não** foram unidas porque
  uniriam animais diferentes; revise em Cadastros › Marcas.
- `saidasSemMotivo` maior que zero: animais com saída antiga sem motivo
  mapeável, marcados como `INATIVO`; revise na Ficha do Animal.
- Contagens de animais e pesagens iguais às da 1.1.17 (compare com o backup
  criado antes).

## 6. Verificação após a migração

- [ ] Backup e Manutenção › Status: aplicativo 1.2.0, banco 7, backup formato 3, `schema-v7`.
- [ ] **Verificar integridade**: "Banco íntegro."
- [ ] Contagens de pesagens e animais iguais às anteriores.
- [ ] Cadastros › Marcas, Raças, Parceiros, Causas de Morte, Propriedades preenchidos.
- [ ] Lançamento: escolher animal existente mostra a marca e a raça cadastradas.
- [ ] Criar um backup completo novo (formato 3) e guardar.

## 7. Falha no meio da migração

- O passo com erro grava `status = FALHOU` e `error`; o backup pré-migração
  é mantido; a **escrita fica bloqueada** (`MIGRATION_BLOCKED`) para não
  misturar dados; a tela mostra o diagnóstico com **Copiar diagnóstico**.
- Depois de corrigir a causa (por exemplo, espaço em disco), um ADMIN usa
  **Continuar migração** em Backup e Manutenção. O processo retoma do checkpoint.
- Se a causa não for resolvível, faça o rollback (seção 8) e registre o
  diagnóstico para suporte.

## 8. Rollback

**Rollback lógico (permanece na 1.2.0):** em Backup e Manutenção, restaure o
backup pré-migração (`pre-migration-v7-...json`). Como é um backup de esquema
anterior, o programa grava os dados e executa o backfill novamente (mesma
rotina, mesmas garantias). Use quando o problema estiver nos dados, não no
programa.

**Voltar para a 1.1.17:** a 1.1.17 não consegue abrir um banco na versão 7.
Passos:

1. Guarde o diagnóstico e o backup pré-migração.
2. Desinstale a 1.2.0 (os dados não são apagados na desinstalação).
3. Renomeie ou mova a pasta `IndexedDB` dentro da pasta de dados do
   aplicativo (perfil do usuário do Windows; a tela de Manutenção da 1.2.0 mostra
   o caminho em `userDataPath`), para a 1.1.17 nascer com banco vazio.
4. Instale a 1.1.17 e restaure o backup criado antes da atualização (ou o
   pré-migração, que é do mesmo formato 2).
5. Confira contagens e integridade.

Nunca edite o JSON do backup manualmente.

## 9. Restauração cruzada (backup 1.1.17 em uma 1.2.0 já migrada)

`dryRunRestore` indica `schemaUpgradeRequired`, tabelas ignoradas (`lotes`) e
tabelas novas. Ao aplicar, o programa grava os dados, converte as enumerações
mínimas e executa o backfill (B1…B12) antes de registrar sucesso. Como o backup
não tem usuários, a Configuração Inicial volta a aparecer.

## 10. Tempos medidos

Preenchido pelo coordenador com `npm run migration:v7:verify` (Node) e com o
aplicativo instalado (Chromium), nas massas de `src/modules/perf/testMass.js`.

| Massa | Pesagens | Backup pré-migração | Upgrade + backfill | Total | Tamanho do backup | Ambiente |
|---|---|---|---|---|---|---|
| vazia | 0 | a medir | a medir | a medir | a medir | Node / instalado |
| pequena | a medir | a medir | a medir | a medir | a medir | Node / instalado |
| 36 mil | 36 000 | a medir | a medir | a medir | a medir | Node / instalado |
| 250 mil (`test:full`) | 250 000 | a medir | a medir | a medir | a medir | Node |

Critério de parada (documento 10 §6): perda de dados, migração irreversível,
backup inválido, integridade vermelha, duplicação de animal/identificador,
falha de restore ou corrupção do IndexedDB interrompem a release.

## 11. Evidências

`docs/evidence/program-2.0/phase-01/migration-v7/`: saída do gate por massa,
relatórios `migration:v7`, capturas da tela de andamento e do Status, e este
documento com a seção 10 preenchida.
