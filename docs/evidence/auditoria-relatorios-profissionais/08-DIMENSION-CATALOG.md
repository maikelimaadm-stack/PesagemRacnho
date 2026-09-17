# 08 — Catálogo de dimensões

Legenda: **Indexada** = existe índice Dexie utilizável na prática. **Pode filtrar/agrupar/subtotalizar**:
✔ confiável; ◐ possível com ressalva (texto, snapshot, parcial); ✖ não suportado com os dados atuais.

| Dimensão | ID canônico | Nome exibido | Store | Histórico ou atual | Indexada | Pode filtrar | Pode agrupar | Pode subtotalizar | Ressalva |
|---|---|---|---|---|---|---|---|---|---|
| Data | `data_pesagem` | Data | pesagens | histórico | ✔ | ✔ | ✔ (dia/mês/ano) | ✔ | data civil `YYYY-MM-DD` |
| Período | `data_pesagem` (intervalo) | Período | pesagens | histórico | ✔ | ✔ | ✔ | ✔ | inclusivo |
| Animal | `animal_id` | Animal | pesagens, animais | ambos | ✔ | ✔ | ✔ | ✔ | SN em Manejo/Saída aponta para animal inexistente |
| Identificador | `animais.numero_animal` + marca | Identificação | animais | atual | ◐ (`identificacao_normalizada`, sem marca) | ✔ | ✖ (alta cardinalidade) | ✖ | número repete entre marcas |
| Marca | `marca_id` | Marca | animais (id); pesagens (**texto**) | atual (animal) / histórico (texto) | ✔ em animais | ✔ animal; ◐ evento | ✔ animal; ◐ evento | ✔ animal; ◐ evento | pesagem não guarda `marca_id` |
| Raça | `raca_id` | Raça | animais (id); pesagens (texto) | idem | ✔ em animais | ✔/◐ | ✔/◐ | ✔/◐ | idem; `racas.grupo` permite agrupar por grupo racial |
| Categoria | `categoria_id` | Categoria | animais (atual); pesagens.payload (histórico desde 16/09) | ambos | ✔ em animais (null fora) | ◐ | ◐ | ◐ | eventos anteriores a 16/09 sem categoria; categoria some em Saída sem peso |
| Sexo | `sexo` | Sexo | animais; pesagens.payload | atual/snapshot | ✖ | ✔ | ✔ | ✔ | exibir Macho/Fêmea, filtrar M/F |
| Situação | `animais.situacao` | Situação | animais | atual | ✔ | ✔ | ✔ | ✔ | enum ATIVO/VENDIDO/ABATIDO/MORTO/DOADO/TRANSFERIDO/CANCELADO/INATIVO |
| Tipo de evento | `tipo_pesagem` | Tipo | pesagens | histórico | ✔ | ✔ | ✔ | ✔ | Cadastro/Manejo/Saída |
| Motivo da saída | `legacy_payload.motivo_saida` | Motivo da saída | pesagens (Saída); animais.motivo_saida (atual) | ambos | ✖ | ✔ | ✔ | ✔ | texto enum; unificar rótulo (“Tipo de Saída” × “Motivo Saída”) |
| Apartação | `apartacao_id` | Apartação | pesagens.payload; animais.apartacao_atual_id; loteApartacoes | ambos | ✖ | ✔ | ✔ | ✔ | usar id, nunca nome |
| Lote | `lote_id` | Lote | pesagens; animais.lote_atual_id; animalLotes | ambos | ✔ | ✔ | ✔ | ✔ | nome do lote não é único entre apartações |
| Sessão | `sessao_id` | Sessão | pesagens; sessoesPesagem | histórico | ✔ | ✔ | ✔ | ✔ | pode haver 2 sessões na mesma data |
| Operador | `created_by_user_id` | Operador | pesagens | histórico | ✖ | ◐ | ◐ | ◐ | registros antigos null; `payload.operador` texto (Lançamento não envia) |
| Propriedade | `propriedade_id` | Propriedade | animais | atual | ✔ | ◐ | ◐ | ◐ | sempre a padrão hoje (sem valor analítico) |
| Parceiro | — | Parceiro | parceiros (sem referência) | — | ✖ | ✖ | ✖ | ✖ | nada referencia `parceiros.id` |
| Comprador | `payload.comprador` (texto) | Comprador | pesagens | snapshot | ✖ | ◐ | ◐ | ◐ | agrupar por texto separa grafias |
| Vendedor/origem | `payload.origem_animal` (texto) | Origem | pesagens (Cadastro) | snapshot | ✖ | ◐ | ◐ | ◐ | idem |
| Frigorífico | `payload.frigorifico` (texto) | Frigorífico | pesagens (Abate); embarques.frigorifico | snapshot | ✖ | ◐ | ◐ | ◐ | idem |
| Transportador | — | — | não existe | — | ✖ | ✖ | ✖ | ✖ | só motorista/placa em texto |
| Embarque | `payload.embarque_id` | Embarque | pesagens; embarques | histórico | ✖ (índice vazio) | ✔ | ✔ | ✔ | varredura das Saídas |
| Documento | `payload.documento_embarque_id` | Documento | pesagens; documentosEmbarque | histórico | ✖ | ✔ | ✔ | ✔ | — |
| Operação comercial | — | — | **não existe** | — | ✖ | ✖ | ✖ | ✖ | requer modelagem (v8) |
| Causa de morte | `payload.causa_morte` (nome) | Causa da morte | pesagens (Saída/Morte) | snapshot | ✖ | ◐ | ◐ | ◐ | cadastro existe, pesagem guarda só o nome |
| Origem do registro | `payload.origem` | Origem do registro | pesagens | histórico | ✖ | ✔ | ✔ | ✔ | `importacao`/`massa-teste`/ausente (= manual) |
| Era | `era` | Era | animais (atual); pesagens.payload (snapshot) | ambos | ✖ | ✔ | ✔ | ✔ | vem da categoria desde 16/09 |
| Faixa de peso | derivada de `peso_kg` | Faixa de peso | pesagens / animais.ultimo_peso_kg | ambos | ✖ (peso não indexado) | ✔ | ✔ | ✔ | faixas definidas no relatório (ou pelas categorias) |

## Regras para o motor

1. Dimensões com id agrupam e filtram **por id** e exibem o **nome atual** do cadastro.
2. Quando só existe texto (comprador, frigorífico, causa, origem), o relatório deve **rotular a coluna como
   “informado no lançamento”** e agrupar por texto normalizado (`normalizeName`), mostrando a contagem de grafias.
3. Dimensão histórica (snapshot do evento) × atual (estado do animal) são **colunas diferentes** e nunca se misturam
   no mesmo agrupamento sem aviso.
