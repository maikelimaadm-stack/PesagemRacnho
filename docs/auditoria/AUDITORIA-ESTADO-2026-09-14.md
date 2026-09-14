# Auditoria de estado — Pesagens Individuais

**Data:** 14/09/2026  
**Aplicação:** 1.1.17 (package.json) — Electron 35, React 18, Vite 6, Dexie 4 (IndexedDB), esquema v6  
**Distribuição:** `release-unsigned/Pesagens Individuais Setup 1.1.17.exe` (diagnóstico local, sem assinatura Authenticode; release oficial bloqueada pelo preflight de assinatura)  
**Finalidade deste documento:** resumo fiel do que existe, do que foi feito, do que está em andamento e do que falta, para orientar a próxima etapa (cadastros de marcas, raças e estoque de identificadores).

---

## 1. Resumo executivo

| Tema | Situação |
|---|---|
| Produto | App desktop offline de pesagem individual, lotes/apartações, saídas comerciais, embarques, backup e manutenção. Roda sem servidor; dados em IndexedDB/Dexie no renderer. |
| Arquitetura | Pacote `docs/arquitetura-produto/` (00–09) é a fonte de verdade. Roadmap F0→F8. **F0 concluída** (08/09). **F1 em andamento** (salvamento otimizado; faltam cache de animais, resumos incrementais, benchmark no Chromium, pacote instalado). |
| Interface | Contrato visual ModeloBase1 (Cadastro de Empresas do PROJETOMG-main). Hoje: Lançamento no design v2 aprovado (09/09); Relação e cadastros com a **Tela Mãe** portada do modelo real (barra de ações, painel lateral de filtros, pesquisa expansível, pílulas por coluna, configuração de colunas). |
| Qualidade | `lint` limpo; `build` de produção OK (2 157 módulos, 40 s); `test:quick` com **14 de 16 gates verdes**. Os dois vermelhos pertencem a trabalho paralelo ainda em andamento (ver §7). |
| Dados | 16 stores Dexie; cadastros auxiliares (parceiros, mortalidade, sanidade) guardados em `appSettings` como catálogos JSON; marca e raça ainda são **texto livre** dentro da pesagem. |
| Pendências de decisão | P-001 balança, P-002 leitor RFID, P-003 estrutura empresa/fazenda, P-004 custo, P-005/P-006 nuvem/autenticação, P-007 SISBOV, P-008 relatórios; **sanidade voltou ao produto** por outra frente e contraria a ADR-007 (precisa decisão expressa). |

---

## 2. Telas existentes (8 rotas em `src/pages.config.js`)

| Rota | Título no menu | Estado | Origem |
|---|---|---|---|
| `PesagensIndividuais` (inicial) | Pesagens | Relação com Tela Mãe ModeloBase1: barra `mg-action-bar` (Filtrar, Lançar pesagem, Editar/Excluir da seleção, pesquisa expansível com resultados, "Mais opções" com Atualizar/Exportar/Importar/modelo), faixa de pílulas + configurar colunas, painel lateral de 260 px com campos por coluna, datas e seleções (Sexo/Tipo/Status), tabela com menu por coluna, seleção, paginação. | Porte concluído em 14/09 (esta sessão) |
| `LancamentoPesagensIndividuais` | Lançar | Lançamento operacional: Cadastro/Manejo/Saída, identificação número+marca, peso, apartação/lote automático, avisos de outlier, dados de compra/venda/abate, embarque/documento, tabela do dia, resumos laterais. Visual no design `Lançamento de Pesagens v2.dc.html` (blocos CSS R30–R33). | 09/09 (esta sessão, v1) → 10–11/09 (sessão paralela, v2 + F1) |
| `ManutencaoSistema` | Manutenção | Status do banco, backup completo com SHA-256, exportação CSV/JSON, importação, restauração com dry-run, verificação de integridade, diagnóstico. | Estável desde 1.1.16 |
| `FechamentoDia` | Fechar | Pendências antes de fechar, conferência por lote e por marca, gravação do fechamento do dia (`closeWeighingDay`/`reopenWeighingDay`). | Novo (sessão paralela, 10/09) |
| `FichaAnimal` | Animal | Curva de peso, linha do tempo e histórico de pesagens do animal, exportação. | Novo (sessão paralela, 10/09) |
| `CadastrosComerciais` | Parceiros | Compradores, vendedores e frigoríficos (nome, CPF/CNPJ, telefone, e-mail, cidade, propriedade/SIF, situação). Modo lista com Tela Mãe; modo registro com cartões do ModeloBase1. | Novo (sessão paralela) + porte da Tela Mãe (14/09, esta sessão) |
| `CausasMorte` | Mortalidade | Catálogo de causas de morte (categoria, orientação, exigir observação, situação). | Idem |
| `ConfiguracoesSanidade` | Sanidade | Programas sanitários e medicamentos. **Atenção:** a ADR-007 declarou sanidade fora de escopo e o esquema v6 removeu as stores; esta tela guarda os dados em `appSettings`. Exige decisão do responsável (manter e registrar nova ADR, ou retirar). | Novo (sessão paralela) |

Diálogos e componentes de apoio: Gerenciar Apartações/Lotes, Gerenciar Embarques/Documentos, Selecionar Animal (número em várias marcas), Confirmar animal SN, Configurar resumos, Configuração de colunas/filtros, confirmação de exclusão.

---

## 3. Dados e regras

### 3.1 Esquema Dexie v6 (`src/storage/indexedDb/schema.js`)

`pesagens` (fato; campos indexados + `legacy_payload` com o lançamento inteiro), `animais` (projeção: situação, último peso, lote atual), `animalIdentificadores` (hoje só `visual_marca` = número::marca), `sessoesPesagem` (automática por data), `animalLotes` (permanência), `movimentosAnimais`, `apartacoes`, `loteApartacoes`, `lotes` (sem uso na UI), `embarques`, `documentosEmbarque`, `auditoria`, `importacoes`, `appSettings`, `backupHistory`.

Mapa completo campo a campo → modelo-alvo: `docs/arquitetura-produto/F0-01-MAPA-DE-CAMPOS.md`.

### 3.2 Catálogos em `appSettings` (não são stores)

- `perfis-saida:<empresa>` — compradores, perfis de venda e de abate (popup antigo);
- `cadastros-auxiliares:comerciais|mortalidade|sanidade:<empresa>` — catálogos das três telas novas (`registryService.js`), com migração dos compradores legados;
- `resumo-personalizado:<empresa>` — métricas do painel lateral.

### 3.3 Regras centrais em vigor

- identidade do animal = UUID; número visual + marca desambiguam; mesmo número em marcas diferentes abre seleção ao concluir a identificação;
- um Cadastro por animal; nenhum evento antes do cadastro nem após a saída definitiva; saída retroativa recusada se houver eventos posteriores;
- ganho, dias e GMD recalculados por animal (F1: só a série do animal, sem varrer a base);
- carcaça = peso vivo × rendimento; arrobas = carcaça / 15; valor = arrobas × preço;
- importação CSV/JSON atômica, idempotente por SHA-256; backup com manifesto e SHA-256; restauração confere contagens;
- catálogo de fórmulas e divergências D1–D8: `F0-02-CATALOGO-DE-FORMULAS.md`.

### 3.4 Marca e raça hoje (relevante para a próxima etapa)

- `marca` e `raca` são **texto livre** gravado em cada pesagem (`legacy_payload`) e na projeção `animais`; a tela sugere valores já usados (`marcasExistentes`, `racasExistentes`) via `ComboboxComNovo`;
- não existe cadastro de marcas, raças, categorias ou eras; não existe controle de estoque de identificadores (brincos/RFID) — apenas `SequenciaBrincos` para digitar números em sequência no Cadastro;
- `animalIdentificadores` já prevê `tipo`, `valor`, `valor_normalizado`, `principal`, `ativo`; a arquitetura (03 §3.3) pede tipos visual, RFID/EID, SISBOV, manejo, legado, temporário, com validade temporal.

---

## 4. Interface e componentes ModeloBase1

- CSS original do modelo em `src/styles/modelobase1/` (mg-layout, emp-scope, erp-*); composição da nossa UI em `src/styles/d17b-modelobase1.css` (blocos até `D.17D.2R34`);
- componentes já portados em `src/components/mak/`: `MakTh` (menu de coluna), `MakColumnMenu`, `MakColumnConfigDialog`, `MakFilterRail`/`MakFilterPill`, `MakTableSelectCheck`, `MakDateControl`, e de 14/09: `MgFilterPanel`, `MgDesktopSearch`, `MgSearchResultsDropdown`, `MgSpeedDialMenu`, `MgTablePanelStrip`, `MgCmdSelect`, `MgPortalPanel`, `useMgPanelPosition`, `mgSearchHighlight`;
- `CadastroAuxiliarPage.jsx` é a base genérica de cadastro (abas/tipos, campos declarativos, lista/cards/registro) e é o ponto natural para os novos cadastros de marcas, raças e identificadores;
- referência real renderizada do modelo: `docs/evidence/modelobase1-referencia/` (o projeto base roda localmente com API simulada; método documentado no relatório de 14/09).

---

## 5. Desempenho (baseline e ganho)

Massa de 36 mil pesagens, Node + fake-indexeddb, p95 em ms:

| Métrica | F0 (08/09) | F1 parcial | Orçamento |
|---|---:|---:|---|
| Busca indexada por animal | 1,8 | 0,24 | < 100 |
| Identificação → peso | 8 | 2,8 | < 100 |
| Salvamento local | 4 980 | 76 | < 250 |

No navegador real (Chromium, IndexedDB) a F0 mediu salvamento de 3 169 ms em 36 mil; a repetição pós-F1 no Chromium ainda não foi registrada. Massa de 250 mil e capturas formais também pendentes. Evidências: `docs/evidence/f0-baseline/`, `f1-trace/`, `f1-optimized*/`. Gerador e bench: `src/modules/perf/`, `npm run perf:baseline`.

---

## 6. Qualidade e verificação

- 37 scripts em `scripts/` (gates de domínio, storage, UI, empacotamento, docs); `npm run test:quick` e `test:full`;
- estado em 14/09: lint limpo; build OK; `test:quick` 14/16 verdes;
- gates vermelhos (ambos do trabalho paralelo, não desta frente):
  1. `ui:operational-customization:verify` — exige `GerenciarSaidasDialog` no Lançamento, que a frente paralela removeu ao criar Cadastros Comerciais;
  2. `ui:consistency:verify` — asserção "alternância Registro/Tabela" espera `className={\`view-seg aux-view-seg` e o código tem `className="view-seg aux-view-seg"`;
- contratos novos R34 (Relação e cadastros com Tela Mãe) aprovados;
- evidências visuais de 14/09: `docs/evidence/modelobase1-relacao-2026-09-14/` e `modelobase1-cadastros-2026-09-14/` (claro/escuro; painel, pesquisa, mais opções).

---

## 7. Trabalho paralelo e conflitos

Duas frentes editaram o mesmo repositório em 09–14/09:

- **Esta frente:** F0 (massa, bench, catálogos), design v1 do Lançamento (09/09), Tela Mãe na Relação e nos cadastros (14/09), correção da pesquisa.
- **Frente paralela:** F1 parcial (salvamento), design v2 do Lançamento (R30–R33), Fechamento do Dia, Ficha do Animal, Cadastros Comerciais, Causas de Morte, Configurações de Sanidade, `registryService`, `operationalInsightsService`, release 1.1.17 (unsigned), asserções adicionais em `verify-ui-consistency.mjs`.

Riscos: arquivos compartilhados (`d17b-modelobase1.css`, `verify-ui-consistency.mjs`, `CadastroAuxiliarPage.jsx`) sofrem edições concorrentes; contratos da frente paralela estão fora de sincronia com o próprio código; sanidade reintroduzida sem ADR. Recomendação: uma frente por arquivo de contrato e CHANGELOG único por sessão; decidir a ADR de sanidade antes de novos cadastros.

---

## 8. Documentação e evidências

- `docs/arquitetura-produto/` — 00–09, F0-01, F0-02, F0-STATUS, F1-STATUS;
- `docs/PORTE-UI-MODELOBASE1.md` — plano e status do porte do ModeloBase1;
- `docs/user/` — guia rápido, instalação, backup/restauração, exportação, teste em máquina limpa;
- `docs/release/1.1.17/` — notas e checklist (pacote unsigned);
- `docs/evidence/` — 39 pastas (slices D1–D17, design, baselines, referência do modelo, portes);
- `CHANGELOG.md` — três seções "Não lançado" (F0, design v1, Tela Mãe) acima de 1.1.16.

---

## 9. Pendências abertas (ordem sugerida)

1. **Decisão sobre sanidade** (ADR-007) — manter tela com nova ADR ou remover.
2. **Sincronizar os dois gates vermelhos** com o código da frente paralela.
3. **Concluir a F1**: cache de animais ativos, resumos incrementais, benchmark no Chromium (36 mil e 250 mil), decisão de virtualização, pacote instalado.
4. **Teste físico em máquina limpa** do instalador (responsável) e assinatura Authenticode.
5. **Decisões P-001/P-002** (balança e leitor RFID) — destravam a F5 e influenciam o cadastro de identificadores.
6. Lançamento de Pesagens: avaliar painel lateral/pesquisa da Tela Mãe (hoje só na Relação e cadastros).

---

## 10. Próxima etapa solicitada: marcas, raças e estoque de identificadores

Escopo proposto (a confirmar antes de implementar):

| Cadastro | Campos mínimos | Onde entra |
|---|---|---|
| Marca | nome, abreviação, ativo, ordem, observação | substitui o texto livre em Cadastro/Manejo/Saída; `animais.marca_id`; pílulas e filtros por marca |
| Raça | nome, abreviação, ativo, ordem | idem para `raca`; mantém valores históricos nas pesagens |
| Categoria (opcional, 03 §3.2) | nome, regra por sexo/idade | pode ficar para depois |
| Estoque de identificadores | tipo (brinco visual, RFID/EID, SISBOV, manejo), lote/série, faixa inicial–final, fornecedor, data de entrada, quantidade, situação (disponível/usado/perdido/reservado), marca vinculada | alimenta `animalIdentificadores`; `SequenciaBrincos` passa a consumir o estoque; baixa automática ao cadastrar animal; relatório de saldo |

Pontos a decidir com o responsável: (a) persistir como stores Dexie v7 (recomendado: histórico, integridade e backup por store) ou como catálogos em `appSettings` como os cadastros atuais; (b) migração dos valores livres já gravados (criar marcas/raças a partir do histórico, sem reescrever fatos); (c) numeração dos brincos (faixa numérica simples, prefixo por marca, ou lote com série); (d) regra quando um número já está em uso em outra marca.
