import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { ensureEmpresaId } from "@/api/db";
import * as weighingService from "@/modules/weighing/application/weighingService";
import * as apartacaoService from "@/modules/auxiliary/application/apartacaoService";
import * as shipmentService from "@/modules/shipments/application/shipmentService";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import MakTh, { makRowClass } from "@/components/mak/MakTh";
import { matchesMakColumnFilter, isMakColumnFilterActive } from "@/components/mak/MakColumnMenu";
import MakColumnConfigDialog from "@/components/mak/MakColumnConfigDialog";
import MakDateControl from "@/components/mak/MakDateControl";
import {
  ModeloBase1ActionBar,
  ModeloBase1PageContainer,
  ModeloBase1PageHeader,
} from "@/components/modelobase1";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff } from "lucide-react";
import { Scale, Save, RefreshCw, Settings, Plus, ChevronLeft, ChevronRight, MoreVertical, X, ArrowUpDown, ArrowUp, ArrowDown, Truck, FolderOpen, Tag, AlertTriangle, Syringe } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { format } from "date-fns";
import ConfigurarResumosDialog from "../components/pesagens/ConfigurarResumosDialog";
import ResumoPersonalizado from "../components/pesagens/ResumoPersonalizado";
import { getSetting, setSetting } from "@/modules/settings/application/settingsService";
import GerenciarEmbarquesDialog from "../components/embarque/GerenciarEmbarquesDialog";
import ResumoEmbarque from "../components/embarque/ResumoEmbarque";
import ResumoVendaDia from "../components/pesagens/ResumoVendaDia";
import { useAuth } from "@/components/auth/useAuth";
import SequenciaBrincos from "../components/pesagens/SequenciaBrincos";
import GerenciarApartacoesDialog from "../components/pesagens/GerenciarApartacoesDialog";
import ResumoLotes from "../components/pesagens/ResumoLotes";
import PesagensResumoRodape from "../components/pesagens/PesagensResumoRodape";
import ConfirmarAnimalSnDialog from "../components/pesagens/ConfirmarAnimalSnDialog";
import { criarMensagemAnimal } from "../components/pesagens/animalLookup";
import SelecionarAnimalDialog from "../components/pesagens/SelecionarAnimalDialog";
import { buildAnimalLookupIndex, buildDeletionPlan, createAnimalId, getAnimalHistory, getRegisteredAnimals, legacyAnimalKey, normalizeAnimalText } from "@/modules/animals/domain/animalHistory";
import { findLatestSnProfile, isSnIdentifier, normalizeAnimalIdentifier } from "@/modules/animals/domain/snAnimal";
import { calculateWeightGain } from "@/modules/weighing/domain/weighingCalculations";
import { receivesWeightGain } from "@/modules/weighing/domain/weighingSeries";
import { deleteEntriesRespectingHistory, propagateAnimalProfile } from "@/modules/animals/application/animalHistoryService";
import { fmtCurrency, fmtDateBR, fmtInt, fmtNum } from "@/components/common/formatNumber";
import { isFutureCivilDate, parseBrazilianNumber, parseCivilDate } from "@/modules/weighing/domain/brazilianValues";
import { calculateCarcassTrade, normalizeCarcassYield } from "@/modules/weighing/domain/commercialCalculations";
import { DEFAULT_WEIGHT_WARNING_POLICY, evaluateWeighingWarnings } from "@/modules/weighing/domain/weighingWarnings";
import { buildWeightPreview } from "@/components/pesagens/weightPreview";
import { loadAuxiliaryCatalogs } from "@/modules/auxiliary/application/legacyCatalogBridge";
import { brandService, breedService, categoryService } from "@/modules/catalog/application/index";
import { normalizeName } from "@/modules/catalog/domain/normalize";
import { RENDIMENTO_ORIGEM_INFORMADO, RENDIMENTO_ORIGEM_PADRAO_EMPRESA, exitRequiresDocument, formatRendimento, loadOperationalPolicies, resolveDefaultRegistry } from "@/modules/operations/application/operationalPolicies";
import { getAnimalRecord } from "@/modules/operations/application/operationalInsightsService";
import { categoriesForSex, eraOfCategory, suggestCategory } from "@/modules/operations/domain/categorySuggestion";
import SanidadeLancamentoPanel from "../components/pesagens/SanidadeLancamentoPanel";
import { listApplications, listMedicamentos, listProgramas } from "@/modules/sanity/application/sanityService";
import { exportWeighingCsv } from "@/modules/weighing/export/weighingExportService";
import { downloadCsvFile } from "@/modules/weighing/export/csvDownload";
// Contexto fixo por sequência: o que fica e o que sai entre um animal e o próximo
// é decidido pelo módulo puro launchContext (matriz STICKY_FIELDS/ANIMAL_FIELDS por modo).
import {
  CATEGORIA_AUTOMATICA,
  FORM_FIELDS,
  beginEdit,
  buildSanityPayload,
  changeExitReason,
  endEdit,
  exitReasonUsesShipment,
  focusAfterSave,
  launchContextStorageKey,
  mergeDefaults,
  modeSupportsSanity,
  readStoredLaunchState,
  restoreLaunchState,
  serializeLaunchState,
  stateAfterSave,
  switchMode,
  writeStoredLaunchState,
} from "@/modules/weighing/domain/launchContext";
const formatarData = fmtDateBR;
const n = fmtNum;
const m = fmtCurrency;
// Padrões da empresa (marca/raça/apartação/rendimento) vêm da configuração e dos
// cadastros mestres; nunca de valores fixos no código (ADR-025, S-01.5).
const PADROES_VAZIOS = Object.freeze({ marca: "", marcaId: "", raca: "", racaId: "", apartacaoSelecionada: "", rendimento: "" });
const CATALOGOS_VAZIOS = Object.freeze({ marcas: [], racas: [], categorias: [] });
const CATALOGO_SANIDADE_VAZIO = Object.freeze({ programas: [], medicamentos: [], carregado: false, erro: false });
// sessionStorage pode faltar (ou lançar) fora do Electron/navegador: o contexto só não persiste.
const armazenamentoSessao = () => {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
};
const POLITICAS_INICIAIS = Object.freeze({
  defaults: { marca_padrao_id: null, raca_padrao_id: null, propriedade_padrao_id: null, apartacao_padrao_id: null },
  sales: { exigir_documento_venda: false, rendimento_padrao: null, rendimento_padrao_origem: RENDIMENTO_ORIGEM_PADRAO_EMPRESA },
  weightWarnings: null,
  weightWarningPolicy: DEFAULT_WEIGHT_WARNING_POLICY,
});
const SEM_SELECAO = '__none__';
// Categoria do Cadastro (CATEGORIA_AUTOMATICA, de launchContext): "Automático" escolhe pelo sexo e pela faixa de peso da categoria.
const COMMERCIAL_VALUE_FIELDS = new Set(["valor_pago_cabeca", "valor_venda_total", "valor_arroba", "quantidade_arrobas", "valor_arroba_abate", "valor_total_abate", "peso_carcaca_estimado", "rendimento_carcaca"]);
const NUMBER_COLUMN_IDS = new Set(["numero_registro", "peso", "peso_anterior", "valor_pago_cabeca", "valor_venda_total", "valor_arroba", "quantidade_arrobas", "doc_qtd", "dias", "ganho", "gmd"]);
const DATE_COLUMN_IDS = new Set(["data_pesagem", "data_anterior"]);
const getColumnFilterType = (id) => DATE_COLUMN_IDS.has(id) ? "date" : NUMBER_COLUMN_IDS.has(id) ? "number" : "text";

export default function LancamentoPesagensIndividuais() {
  const empresaSelecionadaId = ensureEmpresaId();
  const queryClient = useQueryClient();

  // Verificar se veio para editar
  const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?').slice(1).join('?') : '';
  const urlParams = new URLSearchParams(window.location.search || hashQuery);
  const editarId = urlParams.get('editar');

  const [dbReady, setDbReady] = useState(true);
  const auth = useAuth();
  // Painel de Sanidade só para quem registra pesagens (o serviço repete a verificação).
  const podeRegistrarSanidade = auth ? Boolean(auth.can?.('weighing.write')) : true;

  // Contexto da sequência guardado na sessão (R-03): por empresa + usuário, só campos
  // de contexto (serializeLaunchState nunca leva dado do animal). Lido uma vez na montagem.
  const chaveContextoSessao = launchContextStorageKey({ empresaId: empresaSelecionadaId, usuarioId: auth?.user?.id });
  const contextoSessaoRef = useRef(undefined);
  if (contextoSessaoRef.current === undefined) {
    contextoSessaoRef.current = restoreLaunchState(readStoredLaunchState(armazenamentoSessao(), chaveContextoSessao));
  }
  // Contexto de cada modo já visitado (troca de modo guarda/restaura) e contexto anterior à edição.
  const contextosPorModoRef = useRef(contextoSessaoRef.current?.contexts || {});
  const contextoAntesEdicaoRef = useRef(null);
  const sequenciaBrincosRef = useRef(null);

  // Refs para navegação rápida
  const numeroInputRef = useRef(null);
  const pesoInputRef = useRef(null);
  const ignorarProximoBlurIdentificacaoRef = useRef(false);

  // Dados em cache (offline-first)
  const [pesagens, setPesagens] = useState([]);
  const [apartacoes, setApartacoes] = useState([]);
  const [lotesApartacao, setLotesApartacao] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estado do formulário
  const [editingId, setEditingId] = useState(null);
  const [dataPesagem, setDataPesagem] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [numeroAnimal, setNumeroAnimal] = useState("");
  const [animalIdSelecionado, setAnimalIdSelecionado] = useState("");
  const [opcoesAnimal, setOpcoesAnimal] = useState([]);
  const [seletorAnimalOpen, setSeletorAnimalOpen] = useState(false);
  const [snDialogOpen, setSnDialogOpen] = useState(false);
  const [snDialogInitialValue, setSnDialogInitialValue] = useState(null);
  const [snDialogInherited, setSnDialogInherited] = useState(false);
  const [peso, setPeso] = useState("");
  const [sexo, setSexo] = useState("M");
  // Marca/raça: nome (snapshot) + id do cadastro mestre selecionado.
  const [raca, setRaca] = useState("");
  const [racaId, setRacaId] = useState("");
  const [marca, setMarca] = useState("");
  const [marcaId, setMarcaId] = useState("");
  // Era vem da categoria; o estado guarda a era de registros antigos sem categoria.
  const [era, setEra] = useState("");
  const [categoriaSelecao, setCategoriaSelecao] = useState(CATEGORIA_AUTOMATICA);
  const [catalogos, setCatalogos] = useState(CATALOGOS_VAZIOS);
  const [politicas, setPoliticas] = useState(POLITICAS_INICIAIS);
  const [animalRegistro, setAnimalRegistro] = useState(null);
  const padroesEmpresaRef = useRef(PADROES_VAZIOS);
  const apartacaoPadraoAplicadaRef = useRef(false);
  const [observacao, setObservacao] = useState("");
  const [apartacaoSelecionada, setApartacaoSelecionada] = useState("");
  const [loteTransferencia, setLoteTransferencia] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [tipoManejo, setTipoManejo] = useState('Manejo');
  const [motivoSaida, setMotivoSaida] = useState("");
  const [causaMorte, setCausaMorte] = useState("");
  // Causa da morte só segue para o próximo animal com esta opção marcada (V-03).
  const [repetirCausaMorte, setRepetirCausaMorte] = useState(false);
  const [auxiliaryCatalogs, setAuxiliaryCatalogs] = useState({ compradores: [], vendedores: [], frigorificos: [], causasMorte: [] });

  // Sanidade: rascunhos de aplicação do animal atual, sequência e cadastros ativos.
  const [mostrarSanidade, setMostrarSanidade] = useState(false);
  const [sanidadeSequencia, setSanidadeSequencia] = useState(false);
  const [sanidadeAplicacoes, setSanidadeAplicacoes] = useState([]);
  const [catalogoSanidade, setCatalogoSanidade] = useState(CATALOGO_SANIDADE_VAZIO);
  const [aplicacoesRegistradasEdicao, setAplicacoesRegistradasEdicao] = useState([]);

  const [mostrarDadosCompra, setMostrarDadosCompra] = useState(false);
  const [mostrarSequenciaBrinco, setMostrarSequenciaBrinco] = useState(false);
  const [valorPagoCabeca, setValorPagoCabeca] = useState("");
  const [origemAnimal, setOrigemAnimal] = useState("");
  const [numeroGTA, setNumeroGTA] = useState("");
  const [numeroNFeCompra, setNumeroNFeCompra] = useState("");
  const [valorFreteCompra, setValorFreteCompra] = useState("");
  const [observacoesCompra, setObservacoesCompra] = useState("");

  // Campos de Saída (Venda/Abate)
  const [mostrarDadosVenda, setMostrarDadosVenda] = useState(false);
  const [comprador, setComprador] = useState("");
  const [valorVendaTotal, setValorVendaTotal] = useState("");
  const [valorArroba, setValorArroba] = useState("");
  // Rendimento de carcaça: valor inicial = padrão da empresa (origem
  // PADRAO_EMPRESA); ao digitar, origem INFORMADO. Nunca um percentual fixo.
  const [rendimentoCarcacaVenda, setRendimentoCarcacaVenda] = useState("");
  const [rendimentoOrigemVenda, setRendimentoOrigemVenda] = useState(RENDIMENTO_ORIGEM_PADRAO_EMPRESA);
  const [destinoVenda, setDestinoVenda] = useState("");
  const [numeroGTAVenda, setNumeroGTAVenda] = useState("");
  const [numeroNFeVenda, setNumeroNFeVenda] = useState("");
  const [valorFreteVenda, setValorFreteVenda] = useState("");
  const [observacoesVenda, setObservacoesVenda] = useState("");
  const [mostrarDadosAbate, setMostrarDadosAbate] = useState(false);
  const [frigorifico, setFrigorifico] = useState("");
  const [valorArrobaAbate, setValorArrobaAbate] = useState("");
  const [rendimentoCarcacaAbate, setRendimentoCarcacaAbate] = useState("");
  const [rendimentoOrigemAbate, setRendimentoOrigemAbate] = useState(RENDIMENTO_ORIGEM_PADRAO_EMPRESA);
  const [valorTotalAbate, setValorTotalAbate] = useState("");
  const [numeroGTAAbate, setNumeroGTAAbate] = useState("");
  const [observacoesAbate, setObservacoesAbate] = useState("");
  // Embarque/Documentação (para Saída Abate)
  const [embarques, setEmbarques] = useState([]);
  const [documentosEmbarque, setDocumentosEmbarque] = useState([]);
  const [embarqueSelecionadoDoc, setEmbarqueSelecionadoDoc] = useState("");
  const [documentoSelecionado, setDocumentoSelecionado] = useState("");
  const [dialogEmbarqueOpen, setDialogEmbarqueOpen] = useState(false);
  const [avisoTela, setAvisoTela] = useState(null);

  // Ordenação
  const [colunaMenuAberto, setColunaMenuAberto] = useState(null);
  const [filtrosColuna, setFiltrosColuna] = useState({});
  const [sortColumn, setSortColumn] = useState("created_date");
  const [sortDirection, setSortDirection] = useState("desc");
  const [launchPage, setLaunchPage] = useState(1);
  const launchItemsPerPage = 50;

  // Dialog
  const [showApartacoesDialog, setShowApartacoesDialog] = useState(false);
  const [showConfigColunas, setShowConfigColunas] = useState(false);
  const [showResumoConfig, setShowResumoConfig] = useState(false);
  const [resumoPersonalizado, setResumoPersonalizado] = useState([]);
  const [deleteLaunchRequest, setDeleteLaunchRequest] = useState(null);
  const [outlierDialog, setOutlierDialog] = useState({ open: false, warnings: [], options: null });
  const [outlierJustification, setOutlierJustification] = useState("");

  // Painel direito: modo de visualização (apartacao | venda | abate)
  const [painelResumoTipo, setPainelResumoTipo] = useState('apartacao');

  // ========== CONTEXTO DA SEQUÊNCIA ==========
  // Snapshot dos estados do formulário (chaves = FORM_FIELDS de launchContext) e
  // aplicação de um formulário calculado pelo módulo. A página não decide o que fica
  // entre animais: stateAfterSave, switchMode, beginEdit/endEdit e mergeDefaults decidem.
  const formularioAtual = { editingId, tipoManejo, dataPesagem, numeroAnimal, animalIdSelecionado, peso, observacao, avisoTela, era, sexo, raca, racaId, marca, marcaId, categoriaSelecao, apartacaoSelecionada, loteTransferencia, mostrarSequenciaBrinco, mostrarDadosCompra, valorPagoCabeca, origemAnimal, numeroGTA, numeroNFeCompra, valorFreteCompra, observacoesCompra, motivoSaida, causaMorte, repetirCausaMorte, mostrarDadosVenda, comprador, valorVendaTotal, valorArroba, rendimentoCarcacaVenda, rendimentoOrigemVenda, destinoVenda, numeroGTAVenda, numeroNFeVenda, valorFreteVenda, observacoesVenda, mostrarDadosAbate, frigorifico, valorArrobaAbate, rendimentoCarcacaAbate, rendimentoOrigemAbate, valorTotalAbate, numeroGTAAbate, observacoesAbate, embarqueSelecionadoDoc, documentoSelecionado, mostrarSanidade, sanidadeSequencia, sanidadeAplicacoes };
  const formRef = useRef(formularioAtual);
  formRef.current = formularioAtual;
  const settersFormulario = { editingId: setEditingId, tipoManejo: setTipoManejo, dataPesagem: setDataPesagem, numeroAnimal: setNumeroAnimal, animalIdSelecionado: setAnimalIdSelecionado, peso: setPeso, observacao: setObservacao, avisoTela: setAvisoTela, era: setEra, sexo: setSexo, raca: setRaca, racaId: setRacaId, marca: setMarca, marcaId: setMarcaId, categoriaSelecao: setCategoriaSelecao, apartacaoSelecionada: setApartacaoSelecionada, loteTransferencia: setLoteTransferencia, mostrarSequenciaBrinco: setMostrarSequenciaBrinco, mostrarDadosCompra: setMostrarDadosCompra, valorPagoCabeca: setValorPagoCabeca, origemAnimal: setOrigemAnimal, numeroGTA: setNumeroGTA, numeroNFeCompra: setNumeroNFeCompra, valorFreteCompra: setValorFreteCompra, observacoesCompra: setObservacoesCompra, motivoSaida: setMotivoSaida, causaMorte: setCausaMorte, repetirCausaMorte: setRepetirCausaMorte, mostrarDadosVenda: setMostrarDadosVenda, comprador: setComprador, valorVendaTotal: setValorVendaTotal, valorArroba: setValorArroba, rendimentoCarcacaVenda: setRendimentoCarcacaVenda, rendimentoOrigemVenda: setRendimentoOrigemVenda, destinoVenda: setDestinoVenda, numeroGTAVenda: setNumeroGTAVenda, numeroNFeVenda: setNumeroNFeVenda, valorFreteVenda: setValorFreteVenda, observacoesVenda: setObservacoesVenda, mostrarDadosAbate: setMostrarDadosAbate, frigorifico: setFrigorifico, valorArrobaAbate: setValorArrobaAbate, rendimentoCarcacaAbate: setRendimentoCarcacaAbate, rendimentoOrigemAbate: setRendimentoOrigemAbate, valorTotalAbate: setValorTotalAbate, numeroGTAAbate: setNumeroGTAAbate, observacoesAbate: setObservacoesAbate, embarqueSelecionadoDoc: setEmbarqueSelecionadoDoc, documentoSelecionado: setDocumentoSelecionado, mostrarSanidade: setMostrarSanidade, sanidadeSequencia: setSanidadeSequencia, sanidadeAplicacoes: setSanidadeAplicacoes };
  const aplicarForm = (form) => {
    if (!form) return;
    const atual = formRef.current;
    for (const campo of FORM_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(form, campo) && form[campo] !== atual[campo]) settersFormulario[campo](form[campo]);
    }
  };

  // Restauração do contexto da sessão antes da primeira pintura; a gravação só
  // começa depois, para o formulário padrão da montagem não sobrescrever o guardado.
  const [contextoSessaoAplicado, setContextoSessaoAplicado] = useState(!contextoSessaoRef.current);
  useLayoutEffect(() => {
    if (!contextoSessaoRef.current) return;
    aplicarForm(contextoSessaoRef.current.form);
    setContextoSessaoAplicado(true);
  }, []);
  const contextoSerializado = JSON.stringify(serializeLaunchState({ form: formularioAtual, contexts: contextosPorModoRef.current, savedContext: contextoAntesEdicaoRef.current }));
  useEffect(() => {
    if (!contextoSessaoAplicado) return;
    writeStoredLaunchState(armazenamentoSessao(), chaveContextoSessao, JSON.parse(contextoSerializado));
  }, [contextoSessaoAplicado, chaveContextoSessao, contextoSerializado]);

  const animaisCadastrados = useMemo(() => getRegisteredAnimals(pesagens), [pesagens]);
  const animalLookupIndex = useMemo(() => buildAnimalLookupIndex(animaisCadastrados), [animaisCadastrados]);
  const animalSelecionado = useMemo(
    () => animalLookupIndex.byId.get(String(animalIdSelecionado)) || null,
    [animalLookupIndex, animalIdSelecionado]
  );
  const historicoAnimalSelecionado = useMemo(
    () => animalSelecionado ? getAnimalHistory(pesagens, animalSelecionado) : [],
    [pesagens, animalSelecionado]
  );
  const ultimoPerfilSn = useMemo(() => findLatestSnProfile(pesagens), [pesagens]);
  const deleteLaunchPlan = useMemo(
    () => buildDeletionPlan(pesagens, deleteLaunchRequest ? [deleteLaunchRequest.id] : []),
    [pesagens, deleteLaunchRequest]
  );
  const calculoVendaVisual = useMemo(
    () => calculateCarcassTrade({ weight: peso, yieldPercent: rendimentoCarcacaVenda, pricePerArroba: valorArroba }),
    [peso, rendimentoCarcacaVenda, valorArroba],
  );
  const calculoAbateVisual = useMemo(
    () => calculateCarcassTrade({ weight: peso, yieldPercent: rendimentoCarcacaAbate, pricePerArroba: valorArrobaAbate }),
    [peso, rendimentoCarcacaAbate, valorArrobaAbate],
  );
  const { gain: ganhoVisual, trend: sparklinePeso } = useMemo(
    () => buildWeightPreview({ history: historicoAnimalSelecionado, date: dataPesagem, weight: peso, editingId }),
    [historicoAnimalSelecionado, dataPesagem, peso, editingId],
  );
  // Política de avisos de conferência carregada uma vez com a configuração da empresa.
  const weightWarningPolicy = politicas.weightWarningPolicy || DEFAULT_WEIGHT_WARNING_POLICY;
  const avisosPesoVisual = useMemo(() => {
    if (!animalSelecionado || !Number.isFinite(parseBrazilianNumber(peso))) return [];
    return evaluateWeighingWarnings({ weight: peso, date: dataPesagem, history: historicoAnimalSelecionado, policy: weightWarningPolicy });
  }, [animalSelecionado, dataPesagem, historicoAnimalSelecionado, peso, weightWarningPolicy]);

  // Cadastros mestres: só registros ativos entram nos seletores; a busca por
  // nome normalizado serve para restaurar registros antigos (snapshot em texto).
  const marcasAtivas = useMemo(() => catalogos.marcas.filter((item) => item.ativo !== false), [catalogos.marcas]);
  const racasAtivas = useMemo(() => catalogos.racas.filter((item) => item.ativo !== false), [catalogos.racas]);
  const categoriasAtivas = useMemo(() => catalogos.categorias.filter((item) => item.ativo !== false), [catalogos.categorias]);
  const marcaIdPorNome = (nome) => catalogos.marcas.find((item) => item.nome_normalizado === normalizeName(nome))?.id || '';
  const racaIdPorNome = (nome) => catalogos.racas.find((item) => item.nome_normalizado === normalizeName(nome))?.id || '';
  const nomeCategoria = (id) => catalogos.categorias.find((item) => item.id === id)?.nome || '';
  // Só as categorias do sexo escolhido; "Automático" usa a faixa de peso delas.
  const categoriasDoSexo = useMemo(() => categoriesForSex(categoriasAtivas, sexo), [categoriasAtivas, sexo]);
  const categoriaAutomatica = useMemo(
    () => suggestCategory({ categorias: categoriasAtivas, sexo, peso: parseBrazilianNumber(peso) }),
    [categoriasAtivas, sexo, peso],
  );
  const categoriaEfetiva = categoriaSelecao === CATEGORIA_AUTOMATICA
    ? categoriaAutomatica
    : categoriasDoSexo.find((item) => item.id === categoriaSelecao) || null;
  const selecionarMarca = (id) => {
    const registro = marcasAtivas.find((item) => item.id === id) || null;
    setMarcaId(registro?.id || '');
    setMarca(registro?.nome || '');
    setAvisoTela(null);
  };
  const selecionarRaca = (id) => {
    const registro = racasAtivas.find((item) => item.id === id) || null;
    setRacaId(registro?.id || '');
    setRaca(registro?.nome || '');
  };
  // Descrição do cadastro do animal na faixa (Manejo/Saída): categoria e era do registro v7.
  const descricaoCadastroAnimal = useMemo(() => {
    if (!animalSelecionado) return '';
    const categoria = animalRegistro?.categoria_id ? nomeCategoria(animalRegistro.categoria_id) : '';
    const eraAtual = animalRegistro?.era || animalSelecionado.era;
    return [animalSelecionado.marca || 'Sem marca', animalSelecionado.raca || '-', categoria || '-', eraAtual ? `era ${eraAtual}` : '', animalSelecionado.sexo || '-'].filter(Boolean).join(' · ');
  }, [animalSelecionado, animalRegistro, catalogos.categorias]);

  // Perfil do animal selecionado (Manejo/Saída) fica em animalSelecionado/animalRegistro:
  // sexo, raça, marca e era do animal NÃO são escritos nos estados de contexto do
  // Cadastro (V-08) — o payload lê o perfil direto do cadastro escolhido.
  const aplicarAnimalSelecionado = (animal) => {
    if (!animal) return false;
    setAnimalIdSelecionado(animal.animal_id || animal.id);
    setNumeroAnimal(normalizeAnimalIdentifier(animal.numero_animal));
    setAvisoTela(criarMensagemAnimal({ numero: animal.numero_animal, dadosCadastro: animal, ultimo: animal, tipoManejo, editingId, formatarData }));
    setTimeout(() => pesoInputRef.current?.focus(), 0);
    return true;
  };

  // Padrões da empresa chegando depois da abertura (R-04): só trocam o que ainda está
  // com o padrão anterior — no formulário (ou no contexto guardado antes de uma edição)
  // e nos contextos por modo. Contexto restaurado da sessão já foi escolhido: fica.
  const aplicarPadroesEmpresa = (padroes, padroesAnteriores) => {
    if (contextoSessaoRef.current) return;
    contextosPorModoRef.current = Object.fromEntries(Object.entries(contextosPorModoRef.current)
      .map(([modo, contexto]) => [modo, mergeDefaults(contexto, padroesAnteriores, padroes)]));
    if (contextoAntesEdicaoRef.current) {
      contextoAntesEdicaoRef.current = { ...contextoAntesEdicaoRef.current, context: mergeDefaults(contextoAntesEdicaoRef.current.context, padroesAnteriores, padroes) };
      return;
    }
    aplicarForm(mergeDefaults(formRef.current, padroesAnteriores, padroes));
  };

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const [carregadas, marcas, racas, categorias] = await Promise.all([
          loadOperationalPolicies(empresaSelecionadaId),
          brandService.list({ empresaId: empresaSelecionadaId }),
          breedService.list({ empresaId: empresaSelecionadaId }),
          categoryService.list({ empresaId: empresaSelecionadaId }),
        ]);
        if (!ativo) return;
        setCatalogos({ marcas, racas, categorias });
        setPoliticas(carregadas);
        const marcaPadrao = resolveDefaultRegistry(marcas, carregadas.defaults.marca_padrao_id);
        const racaPadrao = resolveDefaultRegistry(racas, carregadas.defaults.raca_padrao_id);
        const padroes = {
          marca: marcaPadrao?.nome || '', marcaId: marcaPadrao?.id || '',
          raca: racaPadrao?.nome || '', racaId: racaPadrao?.id || '',
          apartacaoSelecionada: carregadas.defaults.apartacao_padrao_id || '',
          rendimento: formatRendimento(carregadas.sales.rendimento_padrao),
        };
        const padroesAnteriores = padroesEmpresaRef.current;
        padroesEmpresaRef.current = padroes;
        // Um registro em edição (?editar=) não é sobrescrito: os padrões vão para o contexto guardado.
        aplicarPadroesEmpresa(padroes, padroesAnteriores);
      } catch (error) {
        if (ativo) toast.error(error.message || 'Não foi possível carregar os cadastros e a configuração da empresa.');
      }
    })();
    return () => { ativo = false; };
  }, [empresaSelecionadaId]);

  // Apartação padrão da configuração pré-selecionada ao abrir a tela (só quando
  // a apartação existe na lista carregada).
  useEffect(() => {
    if (apartacaoPadraoAplicadaRef.current || !apartacoes.length || !politicas.weightWarnings) return;
    apartacaoPadraoAplicadaRef.current = true;
    const padraoId = politicas.defaults.apartacao_padrao_id;
    if (padraoId && !editarId && !contextoSessaoRef.current && !apartacaoSelecionada && apartacoes.some((item) => item.id === padraoId)) setApartacaoSelecionada(padraoId);
  }, [apartacoes, politicas]);

  // Registro do animal (store `animais`): ids de cadastro, categoria e era para a faixa e o payload.
  useEffect(() => {
    let ativo = true;
    if (!animalIdSelecionado) { setAnimalRegistro(null); return undefined; }
    getAnimalRecord(animalIdSelecionado).then((registro) => { if (ativo) setAnimalRegistro(registro || null); });
    return () => { ativo = false; };
  }, [animalIdSelecionado]);

  // Edição de um Cadastro: a categoria vem do registro v7 do animal — automática
  // continua automática; escolhida à mão volta selecionada.
  const registroRestauradoRef = useRef('');
  useEffect(() => {
    if (!editingId || tipoManejo !== 'Cadastro' || !animalRegistro) return;
    const chave = `${editingId}:${animalRegistro.id}`;
    if (registroRestauradoRef.current === chave) return;
    registroRestauradoRef.current = chave;
    if (animalRegistro.marca_id) { setMarcaId(animalRegistro.marca_id); }
    if (animalRegistro.raca_id) { setRacaId(animalRegistro.raca_id); }
    setCategoriaSelecao(animalRegistro.categoria_automatica === false && animalRegistro.categoria_id ? animalRegistro.categoria_id : CATEGORIA_AUTOMATICA);
  }, [editingId, tipoManejo, animalRegistro]);

  // Trocar o sexo invalida uma categoria escolhida do outro sexo: volta para Automático.
  useEffect(() => {
    if (categoriaSelecao === CATEGORIA_AUTOMATICA || !categoriasAtivas.length) return;
    if (!categoriasDoSexo.some((item) => item.id === categoriaSelecao)) setCategoriaSelecao(CATEGORIA_AUTOMATICA);
  }, [categoriaSelecao, categoriasDoSexo, categoriasAtivas.length]);

  const resolverAnimalDigitado = (value = numeroAnimal) => {
    if (tipoManejo === 'Cadastro' || isSnIdentifier(value)) return true;
    const matches = animalLookupIndex.byNumber.get(normalizeAnimalText(value)) || [];
    if (matches.length === 1) return aplicarAnimalSelecionado(matches[0]);
    if (matches.length > 1) {
      setOpcoesAnimal(matches);
      setSeletorAnimalOpen(true);
      setAvisoTela(null);
      toast.warning(`O número ${String(value).trim()} existe em mais de uma marca. Escolha o animal correto.`);
      return false;
    }
    setAnimalIdSelecionado('');
    setAvisoTela(null);
    toast.error(`Animal ${String(value || '').trim()} não cadastrado. Faça o Cadastro antes do manejo ou da saída.`);
    return false;
  };

  useEffect(() => {
    getSetting(`resumo-personalizado:${empresaSelecionadaId}`, []).then((value) => setResumoPersonalizado(Array.isArray(value) ? value : []));
  }, [empresaSelecionadaId]);

  useEffect(() => {
    loadAuxiliaryCatalogs(empresaSelecionadaId)
      .then(setAuxiliaryCatalogs)
      .catch((error) => toast.error(error.message || 'Não foi possível carregar os cadastros auxiliares.'));
  }, [empresaSelecionadaId]);

  const salvarResumoPersonalizado = async (value) => {
    setResumoPersonalizado(value);
    await setSetting(`resumo-personalizado:${empresaSelecionadaId}`, value);
    setPainelResumoTipo('personalizado');
  };

  // Cadastros ativos de sanidade para os seletores do painel. A chegada tardia não
  // mexe nos rascunhos já escolhidos; programa/medicamento inativo é recusado ao salvar.
  useEffect(() => {
    if (!podeRegistrarSanidade) return undefined;
    let ativo = true;
    Promise.all([
      listProgramas({ empresaId: empresaSelecionadaId }),
      listMedicamentos({ empresaId: empresaSelecionadaId }),
    ])
      .then(([programas, medicamentos]) => {
        if (ativo) setCatalogoSanidade({ programas: programas || [], medicamentos: medicamentos || [], carregado: true, erro: false });
      })
      .catch(() => {
        if (ativo) setCatalogoSanidade({ ...CATALOGO_SANIDADE_VAZIO, carregado: true, erro: true });
      });
    return () => { ativo = false; };
  }, [empresaSelecionadaId, podeRegistrarSanidade]);

  // Em edição, o painel mostra (somente leitura) as aplicações gravadas com esta pesagem.
  useEffect(() => {
    if (!editingId || !animalIdSelecionado || !podeRegistrarSanidade) {
      setAplicacoesRegistradasEdicao([]);
      return undefined;
    }
    let ativo = true;
    listApplications({ animalId: animalIdSelecionado, includeCancelled: true, empresaId: empresaSelecionadaId })
      .then((linhas) => {
        if (ativo) setAplicacoesRegistradasEdicao((linhas || []).filter((linha) => linha.pesagem_id === editingId));
      })
      .catch(() => {
        if (ativo) setAplicacoesRegistradasEdicao([]);
      });
    return () => { ativo = false; };
  }, [editingId, animalIdSelecionado, empresaSelecionadaId, podeRegistrarSanidade]);

  // Troca de modo: guarda o contexto do modo atual e restaura o do novo (switchMode).
  // Com uma edição aberta a troca é recusada: nada da edição se perde (R-02).
  const handleTipoManejoChange = (novoTipo) => {
    if (novoTipo === tipoManejo) return;
    if (editingId) {
      toast.warning('Conclua (Atualizar) ou cancele a edição antes de trocar o tipo de movimentação.');
      return;
    }
    const proximoNumero = novoTipo === 'Cadastro' ? sequenciaBrincosRef.current?.atual?.() || null : null;
    const { form, contexts } = switchMode(formRef.current, novoTipo, contextosPorModoRef.current, { defaults: padroesEmpresaRef.current, proximoNumero });
    contextosPorModoRef.current = contexts;
    aplicarForm(form);
    setTimeout(() => (proximoNumero ? pesoInputRef : numeroInputRef).current?.focus(), 0);
  };

  // Configuração de colunas
  const COLUNAS_DISPONIVEIS = [
  { id: 'acoes', label: 'Ações', default: true, fixo: true },
  { id: 'numero_registro', label: 'Nº', default: true },
  { id: 'tipo_manejo', label: 'Tipo', default: true },
  { id: 'motivo_saida', label: 'Motivo Saída', default: true },
  { id: 'numero_animal', label: 'Identificação', default: true },
  { id: 'peso', label: 'Peso', default: true },
  { id: 'data_pesagem', label: 'Data', default: true },
  { id: 'sexo', label: 'Sexo', default: true },
  { id: 'raca', label: 'Raça', default: true },
  { id: 'era', label: 'Era', default: true },
  { id: 'marca', label: 'Marca', default: true },
  { id: 'nome_apartacao', label: 'Apartação', default: true },
  { id: 'nome_lote', label: 'Lote', default: true },
  { id: 'valor_pago_cabeca', label: 'Valor Compra', default: false },
  { id: 'origem_animal', label: 'Origem', default: false },
  { id: 'comprador', label: 'Comprador', default: false },
  { id: 'destino_venda', label: 'Destino', default: false },
  { id: 'valor_venda_total', label: 'Valor Venda', default: false },
  { id: 'valor_arroba', label: 'Preço/@ carcaça', default: false },
  { id: 'quantidade_arrobas', label: '@ carcaça estimada', default: false },
  { id: 'frigorifico', label: 'Frigorífico', default: false },
  { id: 'embarque_nome', label: 'Embarque', default: false },
  { id: 'documento_tipo', label: 'Doc', default: false },
  { id: 'documento_numero', label: 'Nº Doc', default: false },
  { id: 'motorista_nome', label: 'Motorista', default: false },
  { id: 'placa_carreta', label: 'Placa', default: false },
  { id: 'doc_qtd', label: 'Qtd Doc (Dia)', default: false },
  { id: 'data_anterior', label: 'Data Anterior', default: false },
  { id: 'peso_anterior', label: 'Peso Anterior', default: false },
  { id: 'dias', label: 'Dias', default: false },
  { id: 'ganho', label: 'Ganho', default: false },
  { id: 'gmd', label: 'GMD', default: true },
  { id: 'observacao', label: 'Observação', default: false }];

  const podeVerValores = auth ? Boolean(auth.can?.('commercial.values')) : true;
  const COLUMN_MODEL_VERSION = 'd17d2r31';
  const defaultVisibleColumns = COLUNAS_DISPONIVEIS.filter((column) => column.default).map((column) => column.id);


  const [colunasOrdem, setColunasOrdem] = useState(() => {
    const saved = localStorage.getItem('colunas_ordem_lancamento_pesagens');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return COLUNAS_DISPONIVEIS.map((c) => c.id);
      }
    }
    return COLUNAS_DISPONIVEIS.map((c) => c.id);
  });

  const [colunasVisiveis, setColunasVisiveis] = useState(() => {
    if (localStorage.getItem('colunas_modelo_lancamento_pesagens') !== COLUMN_MODEL_VERSION) return defaultVisibleColumns;
    const saved = localStorage.getItem('colunas_visiveis_lancamento_pesagens');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return COLUNAS_DISPONIVEIS.filter((c) => c.default).map((c) => c.id);
      }
    }
    return COLUNAS_DISPONIVEIS.filter((c) => c.default).map((c) => c.id);
  });

  const aplicarConfiguracaoColunas = ({ order, visible }) => {
    setColunasOrdem(order);
    setColunasVisiveis(visible);
    localStorage.setItem('colunas_ordem_lancamento_pesagens', JSON.stringify(order));
    localStorage.setItem('colunas_visiveis_lancamento_pesagens', JSON.stringify(visible));
    localStorage.setItem('colunas_modelo_lancamento_pesagens', COLUMN_MODEL_VERSION);
  };

  useEffect(() => {
    if (localStorage.getItem('colunas_modelo_lancamento_pesagens') === COLUMN_MODEL_VERSION) return;
    localStorage.setItem('colunas_visiveis_lancamento_pesagens', JSON.stringify(defaultVisibleColumns));
    localStorage.setItem('colunas_modelo_lancamento_pesagens', COLUMN_MODEL_VERSION);
  }, []);

  const ocultarColuna = (colunaId) => {
    const novasColunas = colunasVisiveis.filter((id) => id !== colunaId);
    setColunasVisiveis(novasColunas);
    localStorage.setItem('colunas_visiveis_lancamento_pesagens', JSON.stringify(novasColunas));
    setColunaMenuAberto(null);
  };

  // Valores comerciais só com commercial.values (OPERADOR lança a saída; o gestor vê/ajusta valores).
  const colunasPermitidas = COLUNAS_DISPONIVEIS.filter((c) => podeVerValores || !COMMERCIAL_VALUE_FIELDS.has(c.id));
  const colunasOrdenadas = colunasOrdem.
  map((id) => colunasPermitidas.find((c) => c.id === id)).
  filter((c) => c && colunasVisiveis.includes(c.id));

  // ========== CARREGAR REGISTRO PARA EDIÇÃO ==========
  useEffect(() => {
    const carregarParaEdicao = async () => {
      if (editarId && pesagens.length > 0) {
        const pesagem = pesagens.find((p) => p.id === editarId);
        if (pesagem) {
          // Mesma restauração da edição feita pela própria tela: quando as duas
          // divergiam, editar um Cadastro vindo da Relação abria como Manejo e
          // escondia sexo/raça/era/marca.
          handleEditar(pesagem);
          setDataPesagem(pesagem.data_pesagem || format(new Date(), 'yyyy-MM-dd'));

          // Limpar o parâmetro da URL para evitar recarregar
          window.history.replaceState({}, '', `${window.location.pathname}#/LancamentoPesagensIndividuais`);
        }
      }
    };
    carregarParaEdicao();
  }, [editarId, pesagens, animaisCadastrados]);

  useEffect(() => {
    loadAllData();
  }, [empresaSelecionadaId]);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [allPesagens, allApartacoes, allLotes, allEmbarques, allDocs] = await Promise.all([
        weighingService.listEntries({ empresaId: empresaSelecionadaId }),
        apartacaoService.listApartacoes({ empresaId: empresaSelecionadaId }),
        apartacaoService.listLoteApartacoes({ empresaId: empresaSelecionadaId }),
        shipmentService.listShipments({ empresaId: empresaSelecionadaId }),
        shipmentService.listDocuments({ empresaId: empresaSelecionadaId }),
      ]);

      setPesagens(allPesagens);
      setApartacoes(allApartacoes);
      setLotesApartacao(allLotes);
      setEmbarques(allEmbarques);
      setDocumentosEmbarque(allDocs);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAnimalSeries = async (...animalIds) => {
    const ids = [...new Set(animalIds.filter(Boolean).map(String))];
    if (!ids.length) {
      await loadAllData();
      return;
    }

    const refreshedSeries = (await Promise.all(
      ids.map((animalId) => weighingService.listEntries({
        empresaId: empresaSelecionadaId,
        animalId,
      })),
    )).flat();
    const affected = new Set(ids);
    setPesagens((current) => [
      ...current.filter((entry) => !affected.has(String(entry.animal_id || ''))),
      ...refreshedSeries,
    ]);
  };

  // ========== PESAGENS DO DIA + FILTRO + ORDENAÇÃO ==========
  const pesagensDia = useMemo(() => {
    let resultado = pesagens
      .filter((p) => p.data_pesagem === dataPesagem)
      .sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0))
      .map((p, idx) => ({ ...p, _numero_registro: idx + 1 }));

    resultado.sort((a, b) => {
      let valA, valB;
      switch (sortColumn) {
        case 'numero_animal':
          valA = a.numero_animal || '';
          valB = b.numero_animal || '';
          break;
        case 'peso':
          valA = a.peso || 0;
          valB = b.peso || 0;
          break;
        case 'sexo':
          valA = a.sexo || '';
          valB = b.sexo || '';
          break;
        case 'raca':
          valA = a.raca || '';
          valB = b.raca || '';
          break;
        case 'marca':
          valA = a.marca || '';
          valB = b.marca || '';
          break;
        case 'nome_apartacao':
          valA = a.nome_apartacao || '';
          valB = b.nome_apartacao || '';
          break;
        case 'nome_lote':
          valA = a.nome_lote || '';
          valB = b.nome_lote || '';
          break;
        case 'numero_registro': {
          valA = a._numero_registro;
          valB = b._numero_registro;
          break;
        }
        case 'created_date':
        default:
          valA = new Date(a.created_date || 0);
          valB = new Date(b.created_date || 0);
          break;
      }

      if (typeof valA === 'string') {
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    const ativos = Object.entries(filtrosColuna).filter(([, value]) => isMakColumnFilterActive(value));
    if (ativos.length) {
      resultado = resultado.filter((linha) =>
        ativos.every(([campo, valor]) => {
          const alvo = campo === "numero_registro" ? linha._numero_registro : linha[campo];
          return matchesMakColumnFilter(alvo, valor, getColumnFilterType(campo));
        })
      );
    }

    return resultado;
  }, [pesagens, dataPesagem, empresaSelecionadaId, sortColumn, sortDirection, filtrosColuna]);

  const launchTotalPages = Math.max(1, Math.ceil(pesagensDia.length / launchItemsPerPage));
  const launchPageSafe = Math.min(launchPage, launchTotalPages);
  const pesagensDiaPaginadas = useMemo(
    () => pesagensDia.slice((launchPageSafe - 1) * launchItemsPerPage, launchPageSafe * launchItemsPerPage),
    [pesagensDia, launchPageSafe],
  );
  useEffect(() => { setLaunchPage(1); }, [dataPesagem, filtrosColuna, sortColumn, sortDirection]);

  const docCountsDia = useMemo(() => {
    const map = {};
    pesagensDia.forEach((p) => {
      const id = p.documento_embarque_id;
      if (id) map[id] = (map[id] || 0) + 1;
    });
    return map;
  }, [pesagensDia]);

  // Função para alternar ordenação
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Renderizar ícone de ordenação
  const SortIcon = ({ column }) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    return sortDirection === 'asc' ?
    <ArrowUp className="w-3 h-3 ml-1 text-emerald-600" /> :
    <ArrowDown className="w-3 h-3 ml-1 text-emerald-600" />;
  };

  // Marca, raça e categoria vêm dos cadastros mestres (catalogos); não há mais
  // autocomplete por texto livre a partir dos lançamentos (S-01.5).
  const numerosUsados = useMemo(() => { const s = new Set(); pesagens.forEach((p) => { if (p.numero_animal && String(p.marca || '').trim().toUpperCase() === String(marca || '').trim().toUpperCase()) s.add(p.numero_animal); }); return s; }, [pesagens, marca]);
  const lotesApartacaoAtual = useMemo(() => { if (!apartacaoSelecionada) return []; return lotesApartacao.filter((l) => l.apartacao_id === apartacaoSelecionada); }, [apartacaoSelecionada, lotesApartacao]);

  // ========== ESTATÍSTICAS DO DIA ==========
  const estatisticas = useMemo(() => {
    const total = pesagensDia.length;
    const machos = pesagensDia.filter((p) => p.sexo === 'M').length;
    const femeas = pesagensDia.filter((p) => p.sexo === 'F').length;
    const pesoMedio = total > 0 ? pesagensDia.reduce((s, p) => s + (p.peso || 0), 0) / total : 0;
    return { total, machos, femeas, pesoMedio };
  }, [pesagensDia]);
  const ultimoLancamentoDia = useMemo(
    () => pesagens.filter((entry) => entry.data_pesagem === dataPesagem)
      .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0))[0] || null,
    [pesagens, dataPesagem],
  );

  // Estatísticas do documento/embarque selecionados (Abate)
  const pesagensDocSelecionado = useMemo(() => {
    if (!documentoSelecionado) return [];
    return pesagens.filter((p) => p.documento_embarque_id === documentoSelecionado);
  }, [documentoSelecionado, pesagens]);

  const resumoDoc = useMemo(() => {
    const total = pesagensDocSelecionado.length;
    const machos = pesagensDocSelecionado.filter((p) => p.sexo === 'M').length;
    const femeas = pesagensDocSelecionado.filter((p) => p.sexo === 'F').length;
    const pesoTotal = pesagensDocSelecionado.reduce((s, p) => s + (p.peso || 0), 0);
    const pesoMedio = total > 0 ? pesoTotal / total : 0;
    return { total, machos, femeas, pesoTotal, pesoMedio };
  }, [pesagensDocSelecionado]);

  const pesagensEmbarqueSelecionado = useMemo(() => {
    if (!embarqueSelecionadoDoc) return [];
    return pesagens.filter((p) => p.embarque_id === embarqueSelecionadoDoc);
  }, [embarqueSelecionadoDoc, pesagens]);

  const resumoEmbarque = useMemo(() => {
    const total = pesagensEmbarqueSelecionado.length;
    const machos = pesagensEmbarqueSelecionado.filter((p) => p.sexo === 'M').length;
    const femeas = pesagensEmbarqueSelecionado.filter((p) => p.sexo === 'F').length;
    const pesoTotal = pesagensEmbarqueSelecionado.reduce((s, p) => s + (p.peso || 0), 0);
    const pesoMedio = total > 0 ? pesoTotal / total : 0;
    return { total, machos, femeas, pesoTotal, pesoMedio };
  }, [pesagensEmbarqueSelecionado]);

  // Resumo por Documento do Embarque selecionado (para tabela Doc/Nº/Prev/Emb/Faltam)
  const documentosDoEmbarqueSel = useMemo(() => {
    if (!embarqueSelecionadoDoc) return [];
    return documentosEmbarque.filter((d) => d.embarque_id === embarqueSelecionadoDoc);
  }, [documentosEmbarque, embarqueSelecionadoDoc]);

  const todasPesagensAbate = useMemo(() => {
    return pesagens;
  }, [pesagens]);

  const resumoDocsAbate = useMemo(() => {
    return documentosDoEmbarqueSel.map((d) => {
      const pesDoc = todasPesagensAbate.filter((p) => p.documento_embarque_id === d.id);
      const pesoTotal = pesDoc.reduce((s, p) => s + (p.peso || 0), 0);
      const pesoMedio = pesDoc.length ? pesoTotal / pesDoc.length : 0;
      return {
        id: d.id,
        gta: d.numero_gta || '-',
        nfe: d.numero_nfe || '-',
        prevM: d.qtd_prev_machos || 0,
        prevF: d.qtd_prev_femeas || 0,
        pesoTotal,
        pesoMedio,
      };
    });
  }, [documentosDoEmbarqueSel, todasPesagensAbate]);

  const totaisDocsAbate = useMemo(() => {
    return resumoDocsAbate.reduce((acc, r) => ({
      prevM: acc.prevM + r.prevM,
      prevF: acc.prevF + r.prevF,
      embM: acc.embM + r.embM,
      embF: acc.embF + r.embF,
      faltamM: acc.faltamM + r.faltamM,
      faltamF: acc.faltamF + r.faltamF,
    }), { prevM: 0, prevF: 0, embM: 0, embF: 0, faltamM: 0, faltamF: 0 });
  }, [resumoDocsAbate]);


  // ========== VERIFICAR SE LOTE ESTÁ CHEIO ==========
  const isLoteCheio = (lote) => {
    if (!lote) return false;
    if (lote.fechado) return true;

    // Contar animais no lote
    const animaisNoLote = pesagens.filter((p) => p.lote_id === lote.id).length;

    return animaisNoLote >= (lote.quantidade_maxima || 999999);
  };

  // ========== DETERMINAR LOTE AUTOMATICAMENTE ==========
  const getLoteAutomatico = (pesoNum) => {
    if (!apartacaoSelecionada || !pesoNum) return null;
    // Não sugerir lotes fechados ou cheios
    const lote = lotesApartacaoAtual.find((l) =>
    pesoNum >= l.peso_minimo && pesoNum <= l.peso_maximo && !l.fechado && !isLoteCheio(l)
    );
    return lote;
  };

  // ========== SALVAR PESAGEM ==========
  const handleSalvar = async (options = {}) => {
    const skipSnConfirmation = options?.skipSnConfirmation === true;
    const snProfile = options?.snProfile || null;
    // Evitar cliques duplos
    if (isSaving) return;

    // Validações com avisos
    if (!parseCivilDate(dataPesagem)) {
      toast.error("⚠️ Campo obrigatório: Data da Pesagem");
      return;
    }
    if (isFutureCivilDate(dataPesagem)) {
      toast.error("A data da pesagem não pode estar no futuro.");
      return;
    }
    if (!numeroAnimal?.trim()) {
      toast.error("⚠️ Campo obrigatório: Nº Identificação");
      numeroInputRef.current?.focus();
      return;
    }
    const pesoInformado = parseBrazilianNumber(peso);
    const permiteMovimentoSemPeso = tipoManejo === 'Saída' && ['Morte', 'Doação', 'Transferência'].includes(motivoSaida);
    if (!permiteMovimentoSemPeso && (!Number.isFinite(pesoInformado) || pesoInformado <= 0)) {
      toast.error("⚠️ Campo obrigatório: Peso (deve ser maior que zero)");
      pesoInputRef.current?.focus();
      return;
    }
    if (tipoManejo === 'Saída' && !motivoSaida) {
      toast.error("⚠️ Campo obrigatório: Motivo da Saída");
      return;
    }
    if (tipoManejo === 'Saída' && motivoSaida === 'Morte' && !causaMorte) {
      toast.error("⚠️ Campo obrigatório: Causa da Morte");
      return;
    }
    // Abate exige sempre embarque + documento; Venda só quando a política da
    // empresa (`exigir_documento_venda`) estiver ligada (ADR-033).
    if (tipoManejo === 'Saída' && exitRequiresDocument(motivoSaida, politicas.sales)) {
      if (!embarqueSelecionadoDoc || !documentoSelecionado) {
        toast.error(motivoSaida === 'Venda'
          ? "A empresa exige documento na venda: selecione o Embarque e o Documento (GTA/NF-e)"
          : "Selecione o Embarque e o Documento (GTA/NF-e)");
        return;
      }
    }
    // Sanidade (opcional): aplicações do painel viram payload.aplicacoes_sanidade do
    // createEntry, gravadas na mesma transação da pesagem. Edição não regrava aplicações.
    const sanidadeNoLancamento = !editingId && podeRegistrarSanidade && modeSupportsSanity(tipoManejo);
    const sanidadeValidada = sanidadeNoLancamento
      ? buildSanityPayload(sanidadeAplicacoes, catalogoSanidade.carregado && !catalogoSanidade.erro
        ? { programaIds: catalogoSanidade.programas.map((item) => item.id), medicamentoIds: catalogoSanidade.medicamentos.map((item) => item.id) }
        : {})
      : { ok: true, errors: [], payload: [] };
    if (!sanidadeValidada.ok) {
      setMostrarSanidade(true);
      toast.error(sanidadeValidada.errors[0]);
      return;
    }

    // Snapshot submetido: o contexto seguinte nasce dele, nunca de um fechamento antigo (V-01).
    const formularioSubmetido = formRef.current;
    const isSN = isSnIdentifier(numeroAnimal);
    const numeroDigitado = normalizeAnimalIdentifier(numeroAnimal).trim();
    const numeroNorm = normalizeAnimalText(numeroDigitado);
    if (isSN && !skipSnConfirmation) {
      // O último SN traz só os textos (snapshot); os ids são resolvidos pelo
      // nome normalizado nos cadastros ativos — sem cadastro, fica em branco.
      const inheritedProfile = ultimoPerfilSn
        ? { sexo: ultimoPerfilSn.sexo, marca: ultimoPerfilSn.marca, marcaId: marcaIdPorNome(ultimoPerfilSn.marca), raca: ultimoPerfilSn.raca, racaId: racaIdPorNome(ultimoPerfilSn.raca) }
        : { sexo, raca, racaId, marca, marcaId, categoriaSelecao };
      setSnDialogInitialValue(inheritedProfile);
      setSnDialogInherited(Boolean(ultimoPerfilSn));
      setSnDialogOpen(true);
      return;
    }
    if (tipoManejo === 'Cadastro' && !isSN && !marcaId) {
      toast.error('Selecione a marca cadastrada. A identidade do animal é formada pelo número e pela marca.');
      return;
    }
    if (tipoManejo !== 'Cadastro' && !isSN && !animalIdSelecionado) {
      resolverAnimalDigitado(numeroDigitado);
      toast.error('Selecione o animal cadastrado antes de salvar.');
      return;
    }

    const cadastroSelecionado = tipoManejo === 'Cadastro'
      ? (editingId ? pesagens.find((entry) => entry.id === editingId) : null)
      : animalSelecionado;
    const marcaComparacao = cadastroSelecionado?.marca || marca;
    const marcaNorm = normalizeAnimalText(marcaComparacao);
    const registrosMesmaIdentidade = cadastroSelecionado
      ? getAnimalHistory(pesagens, cadastroSelecionado)
      : pesagens.filter((entry) => normalizeAnimalText(entry.numero_animal) === numeroNorm && normalizeAnimalText(entry.marca) === marcaNorm);

    if (!editingId && !isSN) {
      const duplicado = pesagensDia.find((entry) => getAnimalHistory([entry], cadastroSelecionado || { numero_animal: numeroDigitado, marca: marcaComparacao })[0]);
      if (duplicado) {
        setAvisoTela(null);
        toast.error(`Animal ${numeroDigitado} / Marca ${marcaComparacao || '-'} já possui lançamento hoje. Peso: ${fmtNum(duplicado.peso)}`);
        return;
      }
    }

    const ultimoRegistro = [...registrosMesmaIdentidade].sort((a, b) => String(b.data_pesagem || '').localeCompare(String(a.data_pesagem || '')))[0];
    if (tipoManejo !== 'Cadastro' && !isSN && ultimoRegistro?.status_animal === 'Inativo' && !editingId) {
      setAvisoTela(null);
      toast.error(`Animal ${numeroDigitado} / Marca ${marcaComparacao || '-'} está inativo porque já possui uma saída.`);
      return;
    }
    if (tipoManejo === 'Cadastro' && !isSN && !editingId && registrosMesmaIdentidade.length > 0) {
      setAvisoTela(null);
      toast.error(`Animal ${numeroDigitado} / Marca ${marcaComparacao} já cadastrado. Use Manejo para um novo lançamento.`);
      return;
    }
    const outlierWarnings = evaluateWeighingWarnings({ weight: pesoInformado, date: dataPesagem, history: registrosMesmaIdentidade, policy: weightWarningPolicy });
    if (outlierWarnings.length > 0 && options?.skipOutlierConfirmation !== true) {
      setOutlierJustification("");
      setOutlierDialog({ open: true, warnings: outlierWarnings, options: { ...options, skipOutlierConfirmation: true } });
      return;
    }
    if (tipoManejo === 'Saída' && ['Venda', 'Abate'].includes(motivoSaida)) {
      const rendimentoOriginal = motivoSaida === 'Abate' ? rendimentoCarcacaAbate : rendimentoCarcacaVenda;
      const rendimentoNumero = parseBrazilianNumber(rendimentoOriginal);
      if (!Number.isFinite(rendimentoNumero) || rendimentoNumero <= 0 || rendimentoNumero > 100) {
        toast.error('Informe um rendimento de carcaça maior que 0% e menor ou igual a 100%.');
        return;
      }
    }

    setIsSaving(true);

    const pesoNum = Number.isFinite(pesoInformado) ? pesoInformado : null;

    // Buscar histórico para cálculo de ganho - exceto SN
    let dataAnterior = null,pesoAnterior = null,dias = null,ganho = null,gmd = null;

    if (!isSN && pesoNum !== null) {
      ({ dataAnterior, pesoAnterior, dias, ganho, gmd } = calculateWeightGain({
        history: cadastroSelecionado ? getAnimalHistory(pesagens, cadastroSelecionado) : registrosMesmaIdentidade,
        date: dataPesagem,
        weight: pesoNum,
      }));
    }

    // Determinar lote
    let loteId = null,nomeLote = null,apartacaoId = null,nomeApartacao = null;

    if (loteTransferencia === "NENHUM") {
      // Usuário optou por não vincular a nenhum lote
      loteId = null;
      nomeLote = null;
      apartacaoId = apartacaoSelecionada || null;
      nomeApartacao = apartacaoSelecionada ? apartacoes.find((a) => a.id === apartacaoSelecionada)?.nome_apartacao || "" : null;
    } else if (loteTransferencia) {
      const lote = lotesApartacaoAtual.find((l) => l.id === loteTransferencia);
      if (lote) {
        loteId = lote.id;
        nomeLote = lote.nome_lote;
        apartacaoId = apartacaoSelecionada;
        nomeApartacao = apartacoes.find((a) => a.id === apartacaoSelecionada)?.nome_apartacao || "";
      }
    } else if (apartacaoSelecionada && pesoNum !== null) {
      const loteAuto = getLoteAutomatico(pesoNum);
      if (loteAuto) {
        loteId = loteAuto.id;
        nomeLote = loteAuto.nome_lote;
        apartacaoId = apartacaoSelecionada;
        nomeApartacao = apartacoes.find((a) => a.id === apartacaoSelecionada)?.nome_apartacao || "";
      }
    }

    // E1G: Manejo e Saída com peso calculam ganho/GMD (Cadastro não). Venda e abate usam rendimento
    // informado, mantendo peso vivo, peso estimado de carcaça e arrobas separados.
    const rendimentoInformado = normalizeCarcassYield(motivoSaida === 'Abate' ? rendimentoCarcacaAbate : rendimentoCarcacaVenda);
    const precoArrobaInformado = motivoSaida === 'Abate' ? valorArrobaAbate : valorArroba;
    const calculoComercial = tipoManejo === 'Saída' && ['Venda', 'Abate'].includes(motivoSaida) && pesoNum
      ? calculateCarcassTrade({ weight: pesoNum, yieldPercent: rendimentoInformado, pricePerArroba: precoArrobaInformado })
      : null;

    const usaEmbarque = tipoManejo === 'Saída' && exitReasonUsesShipment(motivoSaida);
    const selectedDoc = documentosEmbarque.find(d => d.id === documentoSelecionado);
    const selectedEmb = embarques.find(e => e.id === embarqueSelecionadoDoc);
    const registroOriginal = editingId ? pesagens.find((entry) => entry.id === editingId) : null;
    const animalIdAtual = isSN ? (registroOriginal?.animal_id || createAnimalId()) : tipoManejo === 'Cadastro'
      ? (registroOriginal?.animal_id || registroOriginal?.id || createAnimalId())
      : animalIdSelecionado;
    // Perfil do animal: ids dos cadastros mestres + nomes (snapshot) + era
    // legada somente-leitura. Em Manejo/Saída tudo vem do Cadastro escolhido
    // (registro v7 `animais` quando existe, senão o snapshot do lançamento).
    // Categoria do Cadastro/SN: "Automático" usa a faixa de peso do sexo; manual usa a escolhida.
    // A era gravada é a da categoria (registros antigos sem categoria preservam a era).
    const categoriaDoPerfil = (selecao, sexoPerfil) => (selecao && selecao !== CATEGORIA_AUTOMATICA
      ? categoriesForSex(categoriasAtivas, sexoPerfil).find((item) => item.id === selecao) || null
      : suggestCategory({ categorias: categoriasAtivas, sexo: sexoPerfil, peso: pesoNum }));
    const categoriaSn = isSN ? categoriaDoPerfil(snProfile?.categoriaSelecao, snProfile?.sexo || sexo) : null;
    const perfilAnimal = isSN
      ? { numero_animal: numeroDigitado, sexo: snProfile?.sexo || sexo, raca: snProfile?.raca || '', raca_id: snProfile?.racaId || null, era: eraOfCategory(categoriaSn), marca: snProfile?.marca || '', marca_id: snProfile?.marcaId || null, categoria_id: categoriaSn?.id || null, categoria_automatica: (snProfile?.categoriaSelecao || CATEGORIA_AUTOMATICA) === CATEGORIA_AUTOMATICA }
      : tipoManejo === 'Cadastro'
        ? { numero_animal: numeroDigitado, sexo, raca, raca_id: racaId || null, era: eraOfCategory(categoriaEfetiva) ?? (era || null), marca, marca_id: marcaId || null, categoria_id: categoriaEfetiva?.id || null, categoria_automatica: categoriaSelecao === CATEGORIA_AUTOMATICA }
        : {
          numero_animal: animalSelecionado?.numero_animal || numeroDigitado,
          // Sem fallback para o formulário: os seletores de sexo/raça/marca são contexto do Cadastro (V-08).
          sexo: animalSelecionado?.sexo || null,
          raca: animalSelecionado?.raca || '',
          raca_id: animalRegistro?.raca_id || racaIdPorNome(animalSelecionado?.raca) || null,
          // Animal automático: o gravador recalcula categoria e era pelo peso desta pesagem.
          era: animalRegistro?.era || animalSelecionado?.era || null,
          marca: animalSelecionado?.marca || '',
          marca_id: animalRegistro?.marca_id || marcaIdPorNome(animalSelecionado?.marca) || null,
          categoria_id: animalRegistro?.categoria_id || null,
          categoria_automatica: animalRegistro?.categoria_automatica !== false,
        };
    // Origem do rendimento (docs 12 §4): INFORMADO quando digitado, senão o padrão da empresa.
    const rendimentoOrigem = tipoManejo === 'Saída' && ['Venda', 'Abate'].includes(motivoSaida)
      ? (motivoSaida === 'Abate' ? rendimentoOrigemAbate : rendimentoOrigemVenda) || RENDIMENTO_ORIGEM_PADRAO_EMPRESA
      : null;

    const data = {
    empresa_id: empresaSelecionadaId,
    tipo_manejo: tipoManejo,
    motivo_saida: tipoManejo === 'Saída' ? motivoSaida : null,
    causa_morte: tipoManejo === 'Saída' && motivoSaida === 'Morte' ? causaMorte : null,
    status_animal: tipoManejo === 'Saída' ? 'Inativo' : 'Ativo',
    data_pesagem: dataPesagem,
    animal_id: animalIdAtual,
    numero_animal: perfilAnimal.numero_animal?.trim() || numeroAnimal.trim(),
    // Snapshot canônico: em Manejo/Saída sempre vem do Cadastro escolhido.
    sexo: perfilAnimal.sexo || null,
    raca: perfilAnimal.raca || null,
    era: perfilAnimal.era || null,
    marca: perfilAnimal.marca || null,
    // Referências aos cadastros mestres (v7): o adapter usa os ids e recusa
    // marca/raça não cadastradas (MARCA_NAO_CADASTRADA/RACA_NAO_CADASTRADA).
    marca_id: perfilAnimal.marca_id || null,
    raca_id: perfilAnimal.raca_id || null,
    categoria_id: perfilAnimal.categoria_id || null,
    categoria_automatica: perfilAnimal.categoria_automatica !== false,
      peso: pesoNum,
      observacao: observacao || null,
      alertas_confirmados: outlierWarnings.map((warning) => warning.code),
      justificativa_alerta: options?.outlierJustification || null,
      apartacao_id: apartacaoId,
      nome_apartacao: nomeApartacao,
      lote_id: loteId,
      nome_lote: nomeLote,
      // Dados de Cadastro (Compra)
      valor_pago_cabeca: tipoManejo === 'Cadastro' && valorPagoCabeca ? parseBrazilianNumber(valorPagoCabeca) : null,
      origem_animal: tipoManejo === 'Cadastro' ? origemAnimal : null,
      documentacao: tipoManejo === 'Cadastro' ? numeroGTA || numeroNFeCompra || valorFreteCompra || observacoesCompra ? JSON.stringify({
        gta: numeroGTA,
        nfe: numeroNFeCompra,
        frete: valorFreteCompra,
        obs: observacoesCompra
      }) : null : null,
      // Dados de Saída (Venda)
      comprador: tipoManejo === 'Saída' && motivoSaida === 'Venda' ? comprador : null,
      destino_venda: tipoManejo === 'Saída' && motivoSaida === 'Venda' ? destinoVenda : null,
      valor_venda_total: tipoManejo === 'Saída' && motivoSaida === 'Venda' && valorVendaTotal ? parseBrazilianNumber(valorVendaTotal) : null,
      valor_arroba: tipoManejo === 'Saída' && motivoSaida === 'Venda' && valorArroba ? parseBrazilianNumber(valorArroba) : null,
      rendimento_carcaca: calculoComercial?.yieldPercent ?? null,
      rendimento_origem: calculoComercial?.yieldPercent != null ? rendimentoOrigem : null,
      peso_carcaca_estimado: calculoComercial?.carcassWeightKg ?? null,
      quantidade_arrobas: calculoComercial?.arrobas ?? null,
      // Dados de Saída (Abate)
      frigorifico: tipoManejo === 'Saída' && motivoSaida === 'Abate' ? frigorifico : null,
      valor_arroba_abate: tipoManejo === 'Saída' && motivoSaida === 'Abate' && valorArrobaAbate ? parseBrazilianNumber(valorArrobaAbate) : null,
      valor_total_abate: tipoManejo === 'Saída' && motivoSaida === 'Abate' && valorTotalAbate ? parseBrazilianNumber(valorTotalAbate) : null,
      // Embarque/documentação: só nos motivos que usam embarque (Venda/Abate) (V-04).
      embarque_id: usaEmbarque ? (embarqueSelecionadoDoc || null) : null,
      embarque_nome: usaEmbarque ? (selectedEmb?.nome || null) : null,
      documento_embarque_id: usaEmbarque ? (documentoSelecionado || null) : null,
      documento_tipo: usaEmbarque ? (selectedDoc?.tipo_documento || null) : null,
      documento_numero: usaEmbarque ? (selectedDoc ? (selectedDoc.tipo_documento === 'GTA+NF-e' ? `GTA: ${selectedDoc.numero_gta || '-'} | NF-e: ${selectedDoc.numero_nfe || '-'}` : (selectedDoc.numero_gta || selectedDoc.numero_nfe || null)) : null) : null,
      motorista_nome: usaEmbarque ? (selectedDoc?.motorista_nome || null) : null,
      placa_carreta: usaEmbarque ? (selectedDoc?.placa_carreta || null) : null,
      // E1G: Manejo e Saída com peso levam o ganho contra a pesagem anterior; o Cadastro não tem anterior.
      data_anterior: receivesWeightGain(tipoManejo) ? dataAnterior : null,
      peso_anterior: receivesWeightGain(tipoManejo) ? pesoAnterior : null,
      dias: receivesWeightGain(tipoManejo) ? dias : null,
      ganho: receivesWeightGain(tipoManejo) && ganho !== null ? ganho : null,
      gmd: receivesWeightGain(tipoManejo) ? gmd : null
    };

    try {
      if (!editingId) {
        const savedEntry = await weighingService.createEntry({ ...data, aplicacoes_sanidade: sanidadeValidada.payload });
        const aplicacoesGravadas = Array.isArray(savedEntry?.aplicacoes_sanidade) ? savedEntry.aplicacoes_sanidade.length : 0;
        toast.success(aplicacoesGravadas > 0 ? `✓ Salvo! ${fmtInt(aplicacoesGravadas)} ${aplicacoesGravadas === 1 ? 'aplicação' : 'aplicações'} de sanidade.` : '✓ Salvo!');
        await refreshAnimalSeries(savedEntry?.animal_id || data.animal_id);
      } else {
        const updatedEntry = await weighingService.updateEntry(editingId, data);

        if (registroOriginal?.tipo_manejo === 'Cadastro') {
          await propagateAnimalProfile({ entries: pesagens, registration: registroOriginal, profile: data });
        }

        toast.success('✓ Atualizado!');
        await refreshAnimalSeries(
          registroOriginal?.animal_id,
          updatedEntry?.animal_id || data.animal_id,
        );
      }

      // Próximo animal: o módulo launchContext mantém o contexto e limpa o animal.
      // Novo lançamento → stateAfterSave (a sequência de identificadores avança);
      // Atualizar → endEdit volta ao contexto de antes da edição (V-05, R-01).
      const eraEdicao = Boolean(editingId);
      const sequencia = tipoManejo === 'Cadastro' || contextoAntesEdicaoRef.current?.mode === 'Cadastro' ? sequenciaBrincosRef.current : null;
      let proximoNumero = null;
      if (sequencia && !eraEdicao) {
        const usadosAtualizados = new Set(numerosUsados);
        usadosAtualizados.add(numeroDigitado);
        const r = sequencia.avancar(usadosAtualizados);
        if (!r.ok) toast.info("✅ Sequência finalizada!");
        else {
          proximoNumero = r.formatado;
          if (r.pulos > 0) toast.info(`⏭️ ${r.pulos} pulado(s)`);
        }
      } else if (sequencia) {
        proximoNumero = sequencia.atual();
      }
      const opcoesSequencia = { sequenciaAtiva: Boolean(proximoNumero), proximoNumero };
      const proximoFormulario = eraEdicao
        ? endEdit(contextoAntesEdicaoRef.current, { form: formularioSubmetido, defaults: padroesEmpresaRef.current, proximoNumero })
        : stateAfterSave(tipoManejo, formularioSubmetido, {
          ...opcoesSequencia,
          categoriaModo: categoriaSelecao === CATEGORIA_AUTOMATICA ? 'AUTOMATICA' : 'MANUAL',
          repetirCausaMorte,
          sanidadeSequencia,
        });
      const foco = focusAfterSave(proximoFormulario.tipoManejo, opcoesSequencia);
      contextoAntesEdicaoRef.current = null;
      aplicarForm(proximoFormulario);
      if (foco === 'peso') setTimeout(() => pesoInputRef.current?.focus(), 100); else setTimeout(() => numeroInputRef.current?.focus(), 0);
    } catch (error) {
      toast.error('Erro: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ========== EXCLUIR PESAGEM ==========
  const handleExcluir = async (pesagem) => {
    setDeleteLaunchRequest(pesagem);
  };

  const confirmarExclusaoLancamento = async () => {
    const pesagem = deleteLaunchRequest;
    if (!pesagem) return;
    const result = await deleteEntriesRespectingHistory({ entries: pesagens, ids: [pesagem.id], empresaId: empresaSelecionadaId });
    setDeleteLaunchRequest(null);
    setAvisoTela({
      tipo: 'info',
      mensagem: `Exclusão concluída: ${fmtInt(result.ids.length)} registro(s) removido(s).`,
    });
    await loadAllData();
  };

  // ========== EDITAR PESAGEM ==========
  // Restaura o registro INTEIRO no formulário. Campos não restaurados seriam
  // gravados como null ao salvar, apagando dados do lançamento em silêncio.
  // Antes, beginEdit guarda o contexto da sequência e limpa o formulário: o registro
  // não herda apartação/lote do contexto (V-06) e, ao Atualizar ou Cancelar, endEdit
  // devolve exatamente o contexto anterior (V-05, R-01). Editar outra linha durante
  // uma edição mantém o contexto guardado da primeira.
  const handleEditar = (p) => {
    const { form: formularioEdicao, savedContext } = beginEdit(formRef.current, { defaults: padroesEmpresaRef.current });
    if (!contextoAntesEdicaoRef.current) contextoAntesEdicaoRef.current = savedContext;
    aplicarForm(formularioEdicao);
    setEditingId(p.id || null);
    setNumeroAnimal(normalizeAnimalIdentifier(p.numero_animal));
    const cadastroRelacionado = animalLookupIndex.byId.get(String(p.animal_id))
      || (animalLookupIndex.byNumber.get(normalizeAnimalText(p.numero_animal)) || [])
        .find((animal) => normalizeAnimalText(animal.marca) === normalizeAnimalText(p.marca));
    setAnimalIdSelecionado(p.animal_id || cadastroRelacionado?.animal_id || (p.tipo_manejo === 'Cadastro' ? p.id : ''));
    setPeso(String(p.peso ?? ""));
    setSexo(p.sexo || "M");
    // Marca/raça do registro: ids do cadastro resolvidos pelo nome normalizado;
    // a era de registros antigos é preservada. A categoria vem do registro v7
    // do animal (efeito sobre animalRegistro).
    setRaca(p.raca || "");
    setRacaId(p.raca_id || racaIdPorNome(p.raca));
    setEra(p.era || "");
    setMarca(p.marca || "");
    setMarcaId(p.marca_id || marcaIdPorNome(p.marca));
    setCategoriaSelecao(CATEGORIA_AUTOMATICA);
    setObservacao(p.observacao || "");
    setTipoManejo(p.tipo_manejo || 'Manejo');
    setMotivoSaida(p.motivo_saida || "");
    setCausaMorte(p.causa_morte || "");
    if (p.apartacao_id) setApartacaoSelecionada(p.apartacao_id);
    if (p.lote_id) setLoteTransferencia(p.lote_id);

    // Dados de Cadastro (compra)
    setValorPagoCabeca(p.valor_pago_cabeca != null ? String(p.valor_pago_cabeca) : "");
    setOrigemAnimal(p.origem_animal || "");
    let docCompra = {};
    try { docCompra = p.documentacao ? JSON.parse(p.documentacao) : {}; } catch { docCompra = {}; }
    setNumeroGTA(docCompra.gta || "");
    setNumeroNFeCompra(docCompra.nfe || "");
    setValorFreteCompra(docCompra.frete || "");
    setObservacoesCompra(docCompra.obs || "");

    // Dados de Saída (venda / abate)
    setComprador(p.comprador || "");
    setDestinoVenda(p.destino_venda || "");
    setValorVendaTotal(p.valor_venda_total != null ? String(p.valor_venda_total) : "");
    setValorArroba(p.valor_arroba != null ? String(p.valor_arroba) : "");
    // Rendimento gravado no registro (origem informada ou, sem origem gravada,
    // INFORMADO); sem rendimento no registro vale o padrão da empresa.
    const rendimentoRegistro = p.rendimento_carcaca != null ? formatRendimento(p.rendimento_carcaca) : padroesEmpresaRef.current.rendimento;
    const rendimentoOrigemRegistro = p.rendimento_carcaca != null ? (p.rendimento_origem || RENDIMENTO_ORIGEM_INFORMADO) : RENDIMENTO_ORIGEM_PADRAO_EMPRESA;
    setRendimentoCarcacaVenda(rendimentoRegistro); setRendimentoOrigemVenda(rendimentoOrigemRegistro);
    setFrigorifico(p.frigorifico || "");
    setValorArrobaAbate(p.valor_arroba_abate != null ? String(p.valor_arroba_abate) : "");
    setValorTotalAbate(p.valor_total_abate != null ? String(p.valor_total_abate) : "");
    setRendimentoCarcacaAbate(rendimentoRegistro); setRendimentoOrigemAbate(rendimentoOrigemRegistro);
    setEmbarqueSelecionadoDoc(p.embarque_id || "");
    setDocumentoSelecionado(p.documento_embarque_id || "");
    numeroInputRef.current?.focus();
  };

  // Cancelar a edição: volta ao contexto de antes da edição (R-01), sem padrões fixos.
  const cancelarEdicao = () => {
    const sequencia = contextoAntesEdicaoRef.current?.mode === 'Cadastro' ? sequenciaBrincosRef.current : null;
    const proximoNumero = sequencia?.atual?.() || null;
    const formulario = endEdit(contextoAntesEdicaoRef.current, { form: formRef.current, defaults: padroesEmpresaRef.current, proximoNumero });
    contextoAntesEdicaoRef.current = null;
    aplicarForm(formulario);
    const foco = focusAfterSave(formulario.tipoManejo, { sequenciaAtiva: Boolean(proximoNumero), proximoNumero });
    setTimeout(() => (foco === 'peso' ? pesoInputRef : numeroInputRef).current?.focus(), 50);
  };

  // ========== NAVEGAÇÃO POR TECLAS ==========
  const handleKeyDown = (e, nextAction) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextAction === 'salvar') {
        handleSalvar();
      } else {
        nextAction?.current?.focus();
      }
    }
  };

  // ========== EXPORTAR EXCEL ==========
  // Relatório amigável pelo contrato de colunas de pesagens (src/modules/weighing/export):
  // colunas visíveis na ordem da grade (Tipo e Motivo da saída sempre; valores só com
  // commercial.values), BOM/";"/escape canônicos. O serviço repete reports.export.
  const exportarExcel = () => {
    try {
      const linhas = pesagensDia.map((p) => ({
        ...p,
        doc_qtd: p.documento_embarque_id ? (docCountsDia[p.documento_embarque_id] || 0) : null,
      }));
      const arquivo = exportWeighingCsv(linhas, {
        profile: 'FRIENDLY',
        columns: colunasOrdenadas.map((coluna) => coluna.id),
        canSeeCommercial: podeVerValores,
        fileBase: `pesagens-${dataPesagem}`,
      });
      downloadCsvFile(arquivo);
      toast.success(`${fmtInt(arquivo.rowCount)} registro(s) exportado(s).`);
    } catch (error) {
      toast.error(error.message || 'Não foi possível exportar.');
    }
  };

  return (
    <ModeloBase1PageContainer
      variant="form"
      className="d17b-page d17b-launch-page mak-mother-page cadastro-emp-scope mg-empresas-scope flex h-full min-h-0 flex-1 flex-col overflow-hidden"
    >
      <div className="mak-mother-page__chrome flex min-h-0 flex-1 flex-col overflow-auto p-3 pb-24">
      {/* HEADER */}
      <ModeloBase1PageHeader
        className="mak-mother-page__toolbar mg-subtoolbar-stack emp-toolbar"
        data-mak-region="toolbar"
        visuallyHidden
        title="Lançamento de Pesagens"
        description="Registro operacional de movimentação, pesagem e apartação."
      />
      {/* FORMULÁRIO DE LANÇAMENTO */}
      <ModeloBase1ActionBar
        className="d17b-page-actionbar d17d-launch-commandbar"
        aria-label="Operações do lançamento"
      >
          <div className="d17d-launch-typebar flex items-center gap-1 mb-1 pb-1 border-b flex-wrap">
            <Label className="text-xs font-semibold text-slate-700">Tipo de Movimentação:</Label>
            <Select value={tipoManejo} onValueChange={handleTipoManejoChange}>
              <SelectTrigger className="d17d-movement-select h-8 text-xs w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cadastro">Cadastro (Novo Animal)</SelectItem>
                <SelectItem value="Manejo">Manejo (Pesagem Periódica)</SelectItem>
                <SelectItem value="Saída">Saída (Venda/Morte/Doação)</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowApartacoesDialog(true)}
              className="d17d-icon-action h-8 w-8"
              title="Gerenciar Apartações">

              <Scale className="w-8 h-8 text-emerald-700" />
            </Button>
            {/* Motivo da Saída (rente ao Tipo) */}
            {tipoManejo === 'Saída' &&
            <>
                <Label className="text-xs font-medium">Motivo da Saída <span className="text-red-500">*</span></Label>
                <Select value={motivoSaida} onValueChange={(value) => aplicarForm(changeExitReason(formRef.current, value))}>
                  <SelectTrigger className="h-8 text-xs w-44">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Venda">Venda</SelectItem>
                    <SelectItem value="Morte">Morte</SelectItem>
                    <SelectItem value="Doação">Doação</SelectItem>
                    <SelectItem value="Abate">Abate</SelectItem>
                    <SelectItem value="Transferência">Transferência</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>

                {motivoSaida === 'Morte' && (
                  <>
                    <Label className="text-xs font-medium">Causa da Morte <span className="text-red-500">*</span></Label>
                    <Select value={causaMorte || '__none__'} onValueChange={(value) => setCausaMorte(value === '__none__' ? '' : value)}>
                      <SelectTrigger className="h-8 text-xs w-52"><SelectValue placeholder="Selecione a causa" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Selecione a causa</SelectItem>
                        {auxiliaryCatalogs.causasMorte.filter((item) => item.ativo !== false).map((item) => <SelectItem key={item.id} value={item.nome}>{item.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Label htmlFor="repetir-causa-morte" className="text-xs font-medium flex items-center gap-1">
                      <Checkbox id="repetir-causa-morte" checked={repetirCausaMorte} onCheckedChange={(checked) => setRepetirCausaMorte(checked === true)} aria-label="Repetir causa para os próximos" />
                      <span>Repetir causa para os próximos</span>
                    </Label>
                  </>
                )}

                {motivoSaida === 'Venda' &&
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setMostrarDadosVenda((visible) => !visible)}
                className="d17d-data-register-button h-8 text-xs"
                title="Mostrar ou ocultar os dados da venda">
                    {mostrarDadosVenda ? 'Ocultar venda' : 'Dados da venda'}
                  </Button>
              }

                {motivoSaida === 'Abate' &&
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setMostrarDadosAbate((visible) => !visible)}
                      className="d17d-data-register-button h-8 text-xs"
                      title="Mostrar ou ocultar os dados do abate">
                      {mostrarDadosAbate ? 'Ocultar abate' : 'Dados do abate'}
                    </Button>
                  </>
                  }
                {(motivoSaida === 'Venda' || motivoSaida === 'Abate') && <Button type="button" variant="outline" size="sm" onClick={() => setDialogEmbarqueOpen(true)} className="d17d-data-register-button h-8 text-xs" title="Selecionar ou cadastrar documentação de embarque"><FolderOpen className="w-3.5 h-3.5" /> Documentação</Button>}
              </>
            }

            {tipoManejo === 'Cadastro' && <>
              <Button type="button" variant="outline" size="icon" onClick={() => setMostrarSequenciaBrinco(!mostrarSequenciaBrinco)} className="d17d-icon-action h-8 w-8" title={mostrarSequenciaBrinco ? 'Ocultar Sequência de Brincos' : 'Sequência de Brincos'}>
                <Tag className="w-4 h-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={() => setMostrarDadosCompra(!mostrarDadosCompra)} className="d17d-icon-action h-8 w-8" title={mostrarDadosCompra ? 'Ocultar Dados de Compra' : 'Mostrar Dados de Compra'}>
                {mostrarDadosCompra ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </>}
            
            {podeRegistrarSanidade && modeSupportsSanity(tipoManejo) && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setMostrarSanidade((visivel) => !visivel)}
                className="d17d-icon-action d17d-sanity-toggle relative h-8 w-8"
                aria-pressed={mostrarSanidade}
                aria-label={mostrarSanidade ? 'Ocultar Sanidade' : 'Sanidade'}
                title={sanidadeAplicacoes.length > 0 ? `Sanidade: ${fmtInt(sanidadeAplicacoes.length)} ${sanidadeAplicacoes.length === 1 ? 'aplicação' : 'aplicações'} neste lançamento` : (mostrarSanidade ? 'Ocultar Sanidade' : 'Sanidade')}>
                <Syringe className="w-4 h-4" aria-hidden="true" />
                {!mostrarSanidade && sanidadeAplicacoes.length > 0 && (
                  <span className="d17d-sanity-toggle__count absolute -top-1 -right-1 rounded-full bg-emerald-600 px-1 text-[9px] font-semibold leading-4 text-white">{fmtInt(sanidadeAplicacoes.length)}</span>
                )}
              </Button>
            )}
            


            <div className="d17d-launch-typebar__actions" aria-label="Visualização e ações da tabela">
              <Select value={painelResumoTipo} onValueChange={setPainelResumoTipo}>
                <SelectTrigger className="d17d-summary-select" aria-label="Selecionar painel de resumo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="apartacao">Apartação</SelectItem>
                  <SelectItem value="venda">Venda</SelectItem>
                  <SelectItem value="abate">Abate</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowResumoConfig(true)}
                className="d17d-icon-action"
                aria-label="Configurar resumos"
                title="Configurar resumo personalizado">
                <Plus aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowConfigColunas(true)}
                className="d17d-icon-action"
                aria-label="Configurar colunas"
                title="Configurar colunas"
              >
                <Settings aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => loadAllData()}
                className="d17d-icon-action"
                aria-label="Atualizar dados"
                title="Atualizar dados"
              >
                <RefreshCw aria-hidden="true" />
              </Button>
            </div>
          </div>
      </ModeloBase1ActionBar>

      {/* FORMULÁRIO DE LANÇAMENTO */}
      <div className="mak-mother-page__panel-strip" data-mak-region="panel-strip">
      <Card className="emp-content-card d17b-form-card">
        <CardContent className="p-4">
          <div className={`d17d-launch-fields d17d-launch-fields--${tipoManejo === 'Cadastro' ? 'registration' : 'movement'} flex flex-wrap items-end gap-1`}>
            <div className="space-y-1 d17d-field d17d-field--date"><Label className="text-xs font-medium">Data <span className="text-red-500">*</span></Label><MakDateControl value={dataPesagem} onChange={(e) => setDataPesagem(e.target.value)} ariaLabel="Data da pesagem" /></div>
            {tipoManejo === 'Cadastro' && <>
              <div className="space-y-1 d17d-field d17d-field--short d17d-field--sex"><Label className="text-xs font-medium">Sexo <span className="text-red-500">*</span></Label><Select value={sexo} onValueChange={setSexo}><SelectTrigger className="h-9 text-sm" aria-label="Sexo do animal"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="M">M</SelectItem><SelectItem value="F">F</SelectItem></SelectContent></Select></div>
              {/* Categoria, raça e marca são SELECIONADAS dos cadastros mestres (S-01.5): nunca texto livre, nunca criação a partir da tela. */}
              <div className="space-y-1 d17d-field d17d-field--medium d17d-field--category">
                <Label className="text-xs font-medium">
                  Categoria{' '}
                  {categoriaSelecao === CATEGORIA_AUTOMATICA ? (
                    <span className={categoriaAutomatica ? 'text-emerald-700 font-normal' : 'text-slate-500 font-normal'}>
                      {categoriaAutomatica
                        ? `(${categoriaAutomatica.nome}${eraOfCategory(categoriaAutomatica) ? ` · era ${eraOfCategory(categoriaAutomatica)}` : ''})`
                        : parseBrazilianNumber(peso) > 0 ? '(sem faixa para este peso)' : '(pelo peso)'}
                    </span>
                  ) : null}
                </Label>
                <Select value={categoriaSelecao} onValueChange={setCategoriaSelecao}>
                  <SelectTrigger className="h-9 text-sm" aria-label="Categoria do animal"><SelectValue placeholder="Automático" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CATEGORIA_AUTOMATICA}>Automático</SelectItem>
                    {categoriasDoSexo.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 d17d-field d17d-field--medium"><Label className="text-xs font-medium">Raça</Label>
                <Select value={racaId || SEM_SELECAO} onValueChange={(value) => selecionarRaca(value === SEM_SELECAO ? '' : value)}>
                  <SelectTrigger className="h-9 text-sm" aria-label="Raça do animal"><SelectValue placeholder="Selecione a raça" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_SELECAO}>Não informada</SelectItem>
                    {racasAtivas.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 d17d-field d17d-field--short d17d-field--brand"><Label className="text-xs font-medium">Marca <span className="text-red-500">*</span></Label>
                <Select value={marcaId || SEM_SELECAO} onValueChange={(value) => { selecionarMarca(value === SEM_SELECAO ? '' : value); setTimeout(() => numeroInputRef.current?.focus(), 0); }}>
                  <SelectTrigger className="h-9 text-sm" aria-label="Marca do animal"><SelectValue placeholder="Selecione a marca" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_SELECAO}>Selecione a marca</SelectItem>
                    {marcasAtivas.map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>}
            <div className="space-y-1 d17d-field d17d-field--animal">
              <Label className="text-xs font-medium">Nº Ident./Nome <span className="text-red-500">*</span></Label>
              <Input
                ref={numeroInputRef}
                value={numeroAnimal}
                onChange={(e) => {
                  const valor = normalizeAnimalIdentifier(e.target.value);
                  setNumeroAnimal(valor);
                  if (tipoManejo !== 'Cadastro') setAnimalIdSelecionado('');
                  setAvisoTela(null);
                }}
                onBlur={() => {
                  if (ignorarProximoBlurIdentificacaoRef.current) {
                    ignorarProximoBlurIdentificacaoRef.current = false;
                    return;
                  }
                  if (numeroAnimal.trim()) resolverAnimalDigitado(numeroAnimal);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ignorarProximoBlurIdentificacaoRef.current = true; if (resolverAnimalDigitado(numeroAnimal)) pesoInputRef.current?.focus(); } }} className="h-7 text-xs text-amber-500 font-semibold" autoFocus placeholder="Ex: 1234" />

            </div>

            {/* Peso */}
            <div className="space-y-1 d17d-field d17d-field--weight">
              <Label className="text-xs font-medium">Peso (kg) <span className="text-red-500">*</span></Label>
              <div className="d17d-weight-control">
                <Input
                  ref={pesoInputRef}
                  type="text" inputMode="decimal"
                  value={peso}
                  onChange={(e) => setPeso(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, 'salvar')}
                  className="font-bold text-amber-500"
                  placeholder="Ex: 320"
                />
                <button
                  type="button"
                  className="d17d-weight-capture"
                  onClick={() => toast.info('Integração com balança ainda não configurada.')}
                  title="Configurar balança para capturar o peso automaticamente"
                  aria-label="Capturar peso da balança"
                >
                  <span aria-hidden="true" />
                  <Scale aria-hidden="true" />
                </button>
              </div>
            </div>
            
            {/* Observação */}
            <div className="space-y-1 d17d-field d17d-field--observation">
              <Label className="text-xs font-medium">Observação</Label>
              <Input
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                className="h-9 text-sm"
                placeholder="Obs..." />

            </div>

            {/* Botões Salvar e Cancelar */}
            <div className="d17d-launch-actions">
              <Button onClick={handleSalvar} disabled={isSaving} size="sm" className="emp-toolbar-btn emp-toolbar-btn-save d17d-launch-save text-xs px-4">
                <span>{isSaving ? 'Salvando...' : editingId ? 'Atualizar' : 'Salvar'}</span>
                {!isSaving && <span className="d17d-launch-save__shortcut">Enter</span>}
              </Button>
              {editingId &&
              <Button
                variant="outline"
                onClick={cancelarEdicao}
                size="sm"
                className="d17d-launch-cancel text-xs">
                  Cancelar
                </Button>
              }
            </div>

          </div>

          {/* Informações e avisos ficam em uma faixa única, sempre abaixo dos campos. */}
          <div className="d17d-launch-feedbacks" aria-live="polite">
            {avisoTela && (avisoTela.tipo === 'erro' || avisoTela.tipo === 'alerta') && (
              <div className={`d17d-launch-message d17d-launch-message--${avisoTela.tipo || 'info'}`}>
                <span>{avisoTela.mensagem}</span>
                <div className="d17d-launch-message__actions">
                  {/* A escolha entre marcas é feita no SelecionarAnimalDialog; o antigo ramo de botões
                      por marca (inalcançável, D-02) copiava o perfil do animal para o contexto (V-08). */}
                  <button type="button" onClick={() => setAvisoTela(null)} className="d17d-launch-message__close" aria-label="Fechar aviso">
                    <X aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            {tipoManejo !== 'Cadastro' && animalSelecionado && ganhoVisual && (
              <div className="d17d-animal-performance" aria-label="Informações do animal e ganho de peso">
                <section className="d17d-animal-performance__group d17d-animal-performance__animal">
                  <span className="d17d-animal-performance__title">Animal</span>
                  <span><strong>{animalSelecionado.numero_animal || '-'}</strong> · {descricaoCadastroAnimal}</span>
                </section>
                <section className="d17d-animal-performance__group d17d-animal-performance__previous">
                  <span className="d17d-animal-performance__title">Última</span>
                  <span><strong>{ganhoVisual.pesoAnterior !== null ? n(ganhoVisual.pesoAnterior) : '-'}</strong> · {ganhoVisual.dataAnterior ? fmtDateBR(ganhoVisual.dataAnterior) : '-'}</span>
                </section>
                <section className="d17d-animal-performance__group d17d-animal-performance__gain">
                  <span className="d17d-animal-performance__title">Ganho</span>
                  <span className="d17d-animal-performance__metric">Dias <strong>{ganhoVisual.dias !== null ? fmtInt(ganhoVisual.dias) : '-'}</strong></span>
                  <span className="d17d-animal-performance__metric">kg <strong>{ganhoVisual.ganho !== null ? n(ganhoVisual.ganho) : '-'}</strong></span>
                  <span className="d17d-animal-performance__metric">GMD <strong>{ganhoVisual.gmd !== null ? n(ganhoVisual.gmd, 3) : '-'}</strong></span>
                </section>
                {sparklinePeso && (
                  <section className="d17d-animal-performance__trend" aria-label={`Tendência das últimas ${fmtInt(sparklinePeso.count)} pesagens`}>
                    <svg viewBox="0 0 92 22" preserveAspectRatio="none" aria-hidden="true">
                      <polyline points={sparklinePeso.points} />
                      <circle cx={sparklinePeso.end.x} cy={sparklinePeso.end.y} r="2.6" />
                    </svg>
                    <span>{fmtInt(sparklinePeso.count)} {sparklinePeso.count === 1 ? 'pesagem' : 'pesagens'} · <strong>{sparklinePeso.totalGain >= 0 ? '+' : ''}{n(sparklinePeso.totalGain)}</strong></span>
                  </section>
                )}
                {avisosPesoVisual.length > 0 && (
                  <section className="d17d-animal-performance__warning" title={avisosPesoVisual.map((warning) => warning.message).join(' · ')}>
                    <AlertTriangle aria-hidden="true" />
                    <span>{avisosPesoVisual[0].message}</span>
                  </section>
                )}
              </div>
            )}
          </div>

          <SequenciaBrincos visivel={tipoManejo === 'Cadastro' && mostrarSequenciaBrinco} brincoAtual={numeroAnimal} onSetNumeroAnimal={setNumeroAnimal} numerosUsados={numerosUsados} onFocusPeso={() => setTimeout(() => pesoInputRef.current?.focus(), 100)} controllerRef={sequenciaBrincosRef} />
          {tipoManejo === 'Cadastro' && mostrarDadosCompra &&
          <div className="d17d-detail-panel mt-3 p-3 border-t bg-slate-50 rounded">
              <h3 className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Dados de Compra
              </h3>
              <div className="d17d-detail-grid grid grid-cols-4 gap-3">
                {podeVerValores &&
                <div className="space-y-1">
                  <Label className="text-xs">Valor por Cabeça (R$)</Label>
                  <Input
                  type="text" inputMode="decimal"
                  value={valorPagoCabeca}
                  onChange={(e) => setValorPagoCabeca(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="2500,00" />

                </div>
                }
                <div className="space-y-1">
                  <Label className="text-xs">Vendedor/Origem</Label>
                  <Select value={origemAnimal || '__none__'} onValueChange={(value) => setOrigemAnimal(value === '__none__' ? '' : value)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione o vendedor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Não informado</SelectItem>
                      {auxiliaryCatalogs.vendedores.filter((item) => item.ativo !== false).map((item) => <SelectItem key={item.id} value={item.nome}>{item.nome}{item.propriedade ? ` · ${item.propriedade}` : ''}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Número GTA</Label>
                  <Input
                  value={numeroGTA}
                  onChange={(e) => setNumeroGTA(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Ex: 12345" />

                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Número NF-e</Label>
                  <Input
                  value={numeroNFeCompra}
                  onChange={(e) => setNumeroNFeCompra(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Ex: 98765" />

                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor do Frete (R$)</Label>
                  <Input
                  type="text" inputMode="decimal"
                  value={valorFreteCompra}
                  onChange={(e) => setValorFreteCompra(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="0,00" />

                </div>
                <div className="space-y-1 col-span-3">
                  <Label className="text-xs">Observações</Label>
                  <Input
                  value={observacoesCompra}
                  onChange={(e) => setObservacoesCompra(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Observações da compra..." />

                </div>
              </div>
            </div>
          }

          {/* Sanidade (Cadastro/Manejo; somente com weighing.write): aplicações vão em aplicacoes_sanidade do createEntry. */}
          {podeRegistrarSanidade && modeSupportsSanity(tipoManejo) && mostrarSanidade &&
          <SanidadeLancamentoPanel
            aplicacoes={sanidadeAplicacoes}
            onAplicacoesChange={setSanidadeAplicacoes}
            sequencia={sanidadeSequencia}
            onSequenciaChange={setSanidadeSequencia}
            programas={catalogoSanidade.programas}
            medicamentos={catalogoSanidade.medicamentos}
            catalogoCarregado={catalogoSanidade.carregado}
            erroCatalogo={catalogoSanidade.erro}
            modoEdicao={Boolean(editingId)}
            aplicacoesRegistradas={aplicacoesRegistradasEdicao}
            onRecolher={() => setMostrarSanidade(false)} />
          }

          {/* Dados de Saída (Venda) */}
          {tipoManejo === 'Saída' && motivoSaida === 'Venda' && mostrarDadosVenda &&
          <div className="d17d-detail-panel mt-3 p-3 border-t bg-blue-50 rounded">
              <h3 className="text-xs font-semibold text-blue-700 mb-3 flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Dados da Venda
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1 ml-auto"
                  onClick={() => {
                    setComprador("");
                    setDestinoVenda("");
                    setValorArroba("");
                    setValorVendaTotal("");
                    setNumeroGTAVenda("");
                    setNumeroNFeVenda("");
                    setValorFreteVenda("");
                    setObservacoesVenda("");
                  }}
                >
                  <X className="w-3.5 h-3.5" /> Limpar Dados da Venda
                </Button>
              </h3>
              <div className="d17d-detail-grid grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Comprador</Label>
                  <Select value={comprador || '__none__'} onValueChange={(value) => setComprador(value === '__none__' ? '' : value)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione o comprador" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Não informado</SelectItem>
                      {auxiliaryCatalogs.compradores.filter((item) => item.ativo !== false).map((item) => <SelectItem key={item.id} value={item.nome}>{item.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Destino</Label>
                  <Input
                  value={destinoVenda}
                  onChange={(e) => setDestinoVenda(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Ex: Fazenda XYZ" />

                </div>
                {podeVerValores && <>
                <div className="space-y-1">
                  <Label className="text-xs">Valor da Arroba (R$)</Label>
                  <Input
                  type="text" inputMode="decimal"
                  value={valorArroba}
                  onChange={(e) => setValorArroba(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="280,00" />

                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor Total (R$)</Label>
                  <Input
                  type="text" inputMode="decimal"
                  value={valorVendaTotal}
                  onChange={(e) => setValorVendaTotal(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Valor total" />

                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Rendimento de carcaça (%) <span className="font-normal text-slate-500">{rendimentoOrigemVenda === RENDIMENTO_ORIGEM_INFORMADO ? '(informado)' : '(padrão da empresa)'}</span></Label>
                  <Input type="text" inputMode="decimal" value={rendimentoCarcacaVenda} onChange={(e) => { setRendimentoCarcacaVenda(e.target.value); setRendimentoOrigemVenda(RENDIMENTO_ORIGEM_INFORMADO); }} className="h-8 text-xs" placeholder={padroesEmpresaRef.current.rendimento ? `Padrão ${padroesEmpresaRef.current.rendimento}` : 'Informe o rendimento'} aria-label="Rendimento de carcaça da venda" />
                </div>
                {peso && valorArroba &&
              <div className="space-y-1 col-span-4">
                    <Label className="text-xs">Estimativa comercial{calculoVendaVisual.yieldPercent != null ? ` (${n(calculoVendaVisual.yieldPercent)}% de rendimento)` : ''}</Label>
                    <div className="h-8 flex items-center text-xs font-semibold text-blue-700">
                      {calculoVendaVisual.yieldPercent == null ? 'Informe o rendimento de carcaça para estimar carcaça e arrobas' : `${calculoVendaVisual.estimatedValue != null ? m(calculoVendaVisual.estimatedValue) : '—'} · Carcaça (kg): ${n(calculoVendaVisual.carcassWeightKg)} · Arrobas: ${n(calculoVendaVisual.arrobas)}`}
                    </div>
                  </div>
              }
                </>}
                <div className="space-y-1">
                  <Label className="text-xs">Número GTA</Label>
                  <Input
                  value={numeroGTAVenda}
                  onChange={(e) => setNumeroGTAVenda(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Ex: 12345" />

                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Número NF-e</Label>
                  <Input
                  value={numeroNFeVenda}
                  onChange={(e) => setNumeroNFeVenda(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Ex: 98765" />

                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor do Frete (R$)</Label>
                  <Input
                  type="text" inputMode="decimal"
                  value={valorFreteVenda}
                  onChange={(e) => setValorFreteVenda(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="0,00" />

                </div>
                <div className="space-y-1 col-span-4">
                  <Label className="text-xs">Observações</Label>
                  <Input
                  value={observacoesVenda}
                  onChange={(e) => setObservacoesVenda(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Observações da venda..." />

                </div>
              </div>
            </div>
          }

          {/* Dados de Saída (Abate) */}
          {tipoManejo === 'Saída' && motivoSaida === 'Abate' && mostrarDadosAbate &&
          <div className="d17d-detail-panel mt-3 p-3 border-t bg-purple-50 rounded">
              <h3 className="text-xs font-semibold text-purple-700 mb-3 flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Documentação / Abate
              </h3>
              {/* Seleção de Embarque/Documento para o abate */}
              <div className="d17d-detail-grid grid grid-cols-4 gap-3 mb-2">
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Embarque</Label>
                  <Select value={embarqueSelecionadoDoc} onValueChange={(v)=>{setEmbarqueSelecionadoDoc(v);setDocumentoSelecionado('');}}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {embarques.map(e=> <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Documento (GTA/NF-e)</Label>
                  <Select value={documentoSelecionado} onValueChange={setDocumentoSelecionado} disabled={!embarqueSelecionadoDoc}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {documentosEmbarque.filter(d=>d.embarque_id===embarqueSelecionadoDoc).map(d=> {
                        const label = d.tipo_documento === 'GTA+NF-e'
                          ? `${d.tipo_documento} • GTA: ${d.numero_gta || '-'} • NF-e: ${d.numero_nfe || '-'}`
                          : `${d.tipo_documento} • ${d.numero_gta || d.numero_nfe || '-'}`;
                        return (
                          <SelectItem key={d.id} value={d.id}>{label}</SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {embarqueSelecionadoDoc && resumoDocsAbate.length > 0 && (
                <div className="mb-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">GTA</TableHead>
                        <TableHead className="text-[10px]">NF-e</TableHead>
                        <TableHead className="text-[10px] text-center">Prev M/F</TableHead>
                        <TableHead className="text-[10px] text-right">Peso Total</TableHead>
                        <TableHead className="text-[10px] text-right">Peso Médio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resumoDocsAbate.map((r) => (
                        <TableRow key={r.id} className="hover:bg-gray-50">
                          <TableCell className="text-xs py-1">{r.gta}</TableCell>
                          <TableCell className="text-xs py-1">{r.nfe}</TableCell>
                          <TableCell className="text-xs py-1 text-center">{fmtInt(r.prevM)}/{fmtInt(r.prevF)}</TableCell>
                          <TableCell className="text-xs py-1 text-right font-mono">{n(r.pesoTotal)}</TableCell>
                          <TableCell className="text-xs py-1 text-right font-mono">{n(r.pesoMedio)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="d17d-detail-grid grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Frigorífico</Label>
                  <Select value={frigorifico || '__none__'} onValueChange={(value) => setFrigorifico(value === '__none__' ? '' : value)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione o frigorífico" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Não informado</SelectItem>
                      {auxiliaryCatalogs.frigorificos.filter((item) => item.ativo !== false).map((item) => <SelectItem key={item.id} value={item.nome}>{item.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {podeVerValores && <>
                <div className="space-y-1">
                  <Label className="text-xs">Valor por Arroba (R$)</Label>
                  <Input
                  type="text" inputMode="decimal"
                  value={valorArrobaAbate}
                  onChange={(e) => setValorArrobaAbate(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="280,00" />

                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor Total (R$)</Label>
                  <Input
                  type="text" inputMode="decimal"
                  value={valorTotalAbate}
                  onChange={(e) => setValorTotalAbate(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Valor total" />

                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Rendimento de carcaça (%) <span className="font-normal text-slate-500">{rendimentoOrigemAbate === RENDIMENTO_ORIGEM_INFORMADO ? '(informado)' : '(padrão da empresa)'}</span></Label>
                  <Input type="text" inputMode="decimal" value={rendimentoCarcacaAbate} onChange={(e) => { setRendimentoCarcacaAbate(e.target.value); setRendimentoOrigemAbate(RENDIMENTO_ORIGEM_INFORMADO); }} className="h-8 text-xs" placeholder={padroesEmpresaRef.current.rendimento ? `Padrão ${padroesEmpresaRef.current.rendimento}` : 'Informe o rendimento'} aria-label="Rendimento de carcaça do abate" />
                </div>
                {peso && valorArrobaAbate &&
              <div className="space-y-1">
                    <Label className="text-xs">Estimativa comercial{calculoAbateVisual.yieldPercent != null ? ` (${n(calculoAbateVisual.yieldPercent)}% de rendimento)` : ''}</Label>
                    <div className="h-8 flex items-center text-xs font-semibold text-purple-700">
                      {calculoAbateVisual.yieldPercent == null ? 'Informe o rendimento de carcaça para estimar carcaça e arrobas' : `${calculoAbateVisual.estimatedValue != null ? m(calculoAbateVisual.estimatedValue) : '—'} · Carcaça (kg): ${n(calculoAbateVisual.carcassWeightKg)} · Arrobas: ${n(calculoAbateVisual.arrobas)}`}
                    </div>
                  </div>
              }
                </>}
                <div className="space-y-1">
                  <Label className="text-xs">Número GTA</Label>
                  <Input
                  value={numeroGTAAbate}
                  onChange={(e) => setNumeroGTAAbate(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Ex: 12345" />

                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Número NF-e</Label>
                  <Input
                  value={numeroNFeVenda}
                  onChange={(e) => setNumeroNFeVenda(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Ex: 98765" />

                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor do Frete (R$)</Label>
                  <Input
                  type="text" inputMode="decimal"
                  value={valorFreteVenda}
                  onChange={(e) => setValorFreteVenda(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="0,00" />

                </div>
                <div className="space-y-1 col-span-4">
                  <Label className="text-xs">Observações</Label>
                  <Input
                  value={observacoesAbate}
                  onChange={(e) => setObservacoesAbate(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="Observações do abate..." />

                </div>
              </div>
            </div>
          }
          
          {/* Linha 2: Apartação e Transferência de Lote */}
          <div className={`d17d-apartation-fields flex flex-wrap items-end gap-1 mt-1 pt-1 border-t ${tipoManejo === 'Saída' && (motivoSaida === 'Venda' || motivoSaida === 'Abate') ? 'd17d-apartation-fields--documented-exit' : ''}`}>
            <div className="space-y-1 d17d-apartation-field">
              <Label className="text-xs font-medium">Apartação</Label>
              <Select value={apartacaoSelecionada || '__none__'} onValueChange={(v) => {setApartacaoSelecionada(v === '__none__' ? '' : v);setLoteTransferencia("");}}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhuma</SelectItem>
                  {apartacoes.map((a) =>
                  <SelectItem key={a.id} value={a.id}>{a.nome_apartacao}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 d17d-transfer-field">
                              <Label className="text-xs font-medium">Transferência de Lote</Label>
                              <Select value={loteTransferencia || '__auto__'} onValueChange={(value) => setLoteTransferencia(value === '__auto__' ? '' : value)} disabled={!apartacaoSelecionada}>
                                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Automático" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">Automático</SelectItem>
                  <SelectItem value="NENHUM" className="text-slate-500 font-medium">-- Sem Lote --</SelectItem>
                  {lotesApartacaoAtual.map((l) => {
                    const cheio = isLoteCheio(l);
                    return (
                      <SelectItem key={l.id} value={l.id} className={cheio ? "text-red-600" : ""}>
                        {l.nome_lote} (Peso: {fmtNum(l.peso_minimo)} a {fmtNum(l.peso_maximo)}) {cheio ? "[FECHADO]" : ""}
                      </SelectItem>);

                  })}
                </SelectContent>
              </Select>
            </div>
            {peso && apartacaoSelecionada && !loteTransferencia &&
            (() => {
              const loteAuto = getLoteAutomatico(parseBrazilianNumber(peso));
              return (
                <div className="d17d-auto-lot-field space-y-1">
                  <Label className="text-xs font-medium">Lote destino</Label>
                  <div className={`d17d-auto-lot-feedback ${loteAuto ? 'text-orange-700 bg-orange-100 border-orange-300' : 'text-red-700 bg-red-100 border-red-300'}`} title={loteAuto?.nome_lote || 'Não encontrado (todos cheios ou fora da faixa)'}>
                    <ChevronRight className="w-5 h-5 inline" />
                    <span>{loteAuto?.nome_lote || 'Não encontrado (todos cheios ou fora da faixa)'}</span>
                  </div>
                </div>);

            })()
            }
            {tipoManejo === 'Saída' && (motivoSaida === 'Venda' || motivoSaida === 'Abate') && (
              <div className="space-y-1 d17d-embarque-field">
                <Label className="text-xs font-medium">Embarque</Label>
                <Select value={embarqueSelecionadoDoc} onValueChange={(v)=>{setEmbarqueSelecionadoDoc(v);setDocumentoSelecionado('');}}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {embarques.map((e)=> (
                      <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {tipoManejo === 'Saída' && (motivoSaida === 'Venda' || motivoSaida === 'Abate') && (
              <div className="space-y-1 d17d-document-field">
                <Label className="text-xs font-medium">Documento (GTA/NF-e)</Label>
                <Select value={documentoSelecionado} onValueChange={setDocumentoSelecionado} disabled={!embarqueSelecionadoDoc}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {documentosEmbarque.filter(d=>d.embarque_id===embarqueSelecionadoDoc).map((d)=> (
                      <SelectItem key={d.id} value={d.id}>{d.tipo_documento} • {d.numero_gta || d.numero_nfe || '-'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="d17d-apartation-fields__end">
              {ultimoLancamentoDia && (
                <div className="d17d-last-launch">
                  <span>Último <strong>{ultimoLancamentoDia.numero_animal || '-'}</strong> · <strong>{n(ultimoLancamentoDia.peso)}</strong></span>
                  <button type="button" onClick={() => handleExcluir(ultimoLancamentoDia)}>Desfazer</button>
                </div>
              )}
              <span className={`d17d-launch-status d17d-launch-status--${tipoManejo === 'Cadastro' ? 'success' : tipoManejo === 'Manejo' ? 'info' : 'danger'}`}>
                {tipoManejo === 'Cadastro'
                  ? 'Cadastro de novos animais (Ativo)'
                  : tipoManejo === 'Manejo'
                    ? 'Apenas animais já cadastrados (Ativo)'
                    : 'Animal será marcado como INATIVO'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ÁREA PRINCIPAL: TABELA + RESUMO DE LOTES */}
      </div>

      <div className="mak-mother-page__view-stack d17d-launch-workspace" data-mak-region="view-stack">
        {/* TABELA DE PESAGENS */}
        <div className="d17d-launch-table-column">
          <Card className="emp-content-card d17d-launch-table-card">
            <CardContent className="d17d-launch-table-body p-0 flex-1 min-h-0 overflow-hidden">
              <div className="mg-view-panel emp-table-root emp-table-shell emp-table-body-scroll d17c-table-scroll max-h-[620px]">
                <Table className="emp-table-pro d17c-data-table">
                  <TableHeader className="sticky top-0">
                    <TableRow className="bg-white border-b">
                      {colunasOrdenadas.map((coluna) => {
                        if (coluna.id === 'acoes') {
                          return <MakTh key="acoes" label="Ações" className="w-10" onOpenMenu={null} />;
                        }
                        const isSortable = ['numero_registro', 'numero_animal', 'peso', 'sexo', 'raca', 'marca', 'nome_apartacao', 'nome_lote'].includes(coluna.id);
                        return (
                          <MakTh
                            key={coluna.id}
                            label={coluna.label}
                            sortDirection={sortColumn === coluna.id ? sortDirection : null}
                            onSort={() => isSortable && handleSort(coluna.id)}
                            menuOpen={colunaMenuAberto === coluna.id}
                            onOpenMenu={() => setColunaMenuAberto(colunaMenuAberto === coluna.id ? null : coluna.id)}
                            menu={{
                              onFechar: () => setColunaMenuAberto(null),
                              valorFiltro: filtrosColuna[coluna.id] || "",
                              filterType: getColumnFilterType(coluna.id),
                              onFiltrar: (v) => setFiltrosColuna((a) => ({ ...a, [coluna.id]: v })),
                              onOrdenar: (dir) => { setSortColumn(coluna.id); setSortDirection(dir); },
                              onOcultar: () => ocultarColuna(coluna.id),
                            }}
                          />);

                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ?
                    <TableRow><TableCell colSpan={20} className="text-center py-4 text-xs">Carregando...</TableCell></TableRow> :
                    pesagensDia.length === 0 ?
                    <TableRow><TableCell colSpan={20} className="text-center py-4 text-xs text-slate-400">Nenhuma pesagem</TableCell></TableRow> :

                    pesagensDiaPaginadas.map((p, idx) =>
                    <TableRow key={p.id} className={`${makRowClass(((launchPageSafe - 1) * launchItemsPerPage) + idx)} emp-table-data-row`}>
                          {colunasOrdenadas.map((coluna) => {
                        if (coluna.id === 'acoes') {
                          return (
                            <TableCell key="acoes" className="text-xs !p-0 text-center">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        aria-label={`Ações da pesagem ${p.numero_animal || p._numero_registro}`}
                                        title={`Ações da pesagem ${p.numero_animal || p._numero_registro}`}
                                      >
                                        <MoreVertical className="w-3.5 h-3.5 text-slate-600" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                      <DropdownMenuItem onClick={() => handleEditar(p)}>Editar</DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleExcluir(p)} className="text-red-600">
                                        Excluir
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>);

                        }
                        if (coluna.id === 'numero_registro') {
                          return <TableCell key={coluna.id} className="text-xs">{fmtInt(p._numero_registro)}</TableCell>;
                        }
                        if (coluna.id === 'tipo_manejo') {
                          return (
                            <TableCell key={coluna.id} className="text-xs py-2 px-3">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  p.tipo_manejo === 'Cadastro' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                                  p.tipo_manejo === 'Saída' ? 'bg-red-50 text-red-700 border-red-300' :
                                  'bg-blue-50 text-blue-700 border-blue-300'
                                }`}
                              >
                                {p.tipo_manejo || 'Manejo'}
                              </Badge>
                            </TableCell>);

                        }
                        if (coluna.id === 'motivo_saida') {
                          return <TableCell key={coluna.id} className="text-xs">{p.motivo_saida || '-'}</TableCell>;
                        }
                        if (coluna.id === 'valor_pago_cabeca') {
                          return <TableCell key={coluna.id} className="text-xs text-right font-mono">{p.valor_pago_cabeca != null ? m(p.valor_pago_cabeca) : '-'}</TableCell>;
                        }
                        if (coluna.id === 'origem_animal') {
                          return <TableCell key={coluna.id} className="text-xs">{p.origem_animal || '-'}</TableCell>;
                        }
                        if (coluna.id === 'comprador') {
                          return <TableCell key={coluna.id} className="text-xs">{p.comprador || '-'}</TableCell>;
                        }
                        if (coluna.id === 'destino_venda') {
                          return <TableCell key={coluna.id} className="text-xs">{p.destino_venda || '-'}</TableCell>;
                        }
                        if (coluna.id === 'valor_venda_total') {
                          return <TableCell key={coluna.id} className="text-xs text-right font-mono">{p.valor_venda_total != null ? m(p.valor_venda_total) : '-'}</TableCell>;
                        }
                        if (coluna.id === 'valor_arroba') {
                          return <TableCell key={coluna.id} className="text-xs text-right font-mono">{p.valor_arroba != null ? m(p.valor_arroba) : '-'}</TableCell>;
                        }
                        if (coluna.id === 'quantidade_arrobas') {
                          return <TableCell key={coluna.id} className="text-xs text-right font-mono">{p.quantidade_arrobas != null ? n(p.quantidade_arrobas) : '-'}</TableCell>;
                        }
                        if (coluna.id === 'frigorifico') {
                          return <TableCell key={coluna.id} className="text-xs">{p.frigorifico || '-'}</TableCell>;
                        }
                        if (coluna.id === 'embarque_nome') {
                          return <TableCell key={coluna.id} className="text-xs">{p.embarque_nome || '-'}</TableCell>;
                        }
                        if (coluna.id === 'documento_tipo') {
                          return <TableCell key={coluna.id} className="text-xs">{p.documento_tipo || '-'}</TableCell>;
                        }
                        if (coluna.id === 'documento_numero') {
                          return <TableCell key={coluna.id} className="text-xs">{p.documento_numero || '-'}</TableCell>;
                        }
                        if (coluna.id === 'motorista_nome') {
                          return <TableCell key={coluna.id} className="text-xs">{p.motorista_nome || '-'}</TableCell>;
                        }
                        if (coluna.id === 'placa_carreta') {
                          return <TableCell key={coluna.id} className="text-xs">{p.placa_carreta || '-'}</TableCell>;
                        }
                        if (coluna.id === 'doc_qtd') {
                          return <TableCell key={coluna.id} className="text-xs text-center">{p.documento_embarque_id ? fmtInt(docCountsDia[p.documento_embarque_id] || 0) : '-'}</TableCell>;
                        }
                        if (coluna.id === 'numero_animal') {
                          return (
                            <TableCell key={coluna.id} className="text-xs py-2 px-3 font-semibold">
                                  {p.numero_animal}
                                </TableCell>);

                        }
                        if (coluna.id === 'peso') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3 text-right font-mono font-semibold">{n(p.peso)}</TableCell>;
                        }
                        if (coluna.id === 'data_pesagem') {
                          return <TableCell key={coluna.id} className="text-xs">{formatarData(p.data_pesagem)}</TableCell>;
                        }
                        if (coluna.id === 'sexo') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3">{p.sexo === 'M' ? 'Macho' : p.sexo === 'F' ? 'Fêmea' : '-'}</TableCell>;
                        }
                        if (coluna.id === 'raca') {
                          return <TableCell key={coluna.id} className="text-xs">{p.raca || '-'}</TableCell>;
                        }
                        if (coluna.id === 'era') {
                          return <TableCell key={coluna.id} className="text-xs">{p.era || '-'}</TableCell>;
                        }
                        if (coluna.id === 'marca') {
                          return <TableCell key={coluna.id} className="text-xs">{p.marca || '-'}</TableCell>;
                        }
                        if (coluna.id === 'nome_apartacao') {
                          return <TableCell key={coluna.id} className="text-xs">{p.nome_apartacao || '-'}</TableCell>;
                        }
                        if (coluna.id === 'nome_lote') {
                          return <TableCell key={coluna.id} className="text-xs font-medium">{p.nome_lote || '-'}</TableCell>;
                        }
                        if (coluna.id === 'data_anterior') {
                          return <TableCell key={coluna.id} className="text-xs">{formatarData(p.data_anterior) || '-'}</TableCell>;
                        }
                        if (coluna.id === 'peso_anterior') {
                          return <TableCell key={coluna.id} className="text-xs text-right font-mono">{p.peso_anterior != null ? n(p.peso_anterior) : '-'}</TableCell>;
                        }
                        if (coluna.id === 'dias') {
                          return <TableCell key={coluna.id} className="text-xs text-right font-mono">{p.dias != null ? fmtInt(p.dias) : '-'}</TableCell>;
                        }
                        if (coluna.id === 'ganho') {
                          return <TableCell key={coluna.id} className="text-xs text-right font-mono">{p.ganho != null ? n(p.ganho) : '-'}</TableCell>;
                        }
                        if (coluna.id === 'gmd') {
                          return (
                            <TableCell key={coluna.id} className={`text-xs text-right font-mono font-semibold ${p.gmd && p.gmd > 0 ? 'text-emerald-600' : p.gmd && p.gmd < 0 ? 'text-red-600' : ''}`}>
                                  {p.gmd != null ? n(p.gmd, 3) : '-'}
                                </TableCell>);

                        }
                        if (coluna.id === 'observacao') {
                          return <TableCell key={coluna.id} className="text-xs">{p.observacao || '-'}</TableCell>;
                        }
                        return <TableCell key={coluna.id} className="text-xs">-</TableCell>;
                      })}
                        </TableRow>
                    )
                    }
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <PesagensResumoRodape
            estatisticas={estatisticas}
            tipoManejo={tipoManejo}
            motivoSaida={motivoSaida}
            documentoSelecionado={documentoSelecionado}
            resumoDoc={resumoDoc}
            resumoEmbarque={resumoEmbarque}
            pesagensDia={pesagensDia}
            exportarExcel={auth && !auth.can?.('reports.export') ? null : exportarExcel}
            pagination={{
              currentPage: launchPageSafe,
              totalPages: launchTotalPages,
              listed: pesagensDiaPaginadas.length,
              onPrevious: () => setLaunchPage((page) => Math.max(1, page - 1)),
              onNext: () => setLaunchPage((page) => Math.min(launchTotalPages, page + 1)),
              PreviousIcon: ChevronLeft,
              NextIcon: ChevronRight,
            }}
          />
        </div>

        {/* RESUMO: Lotes ou Documentação */}
        {painelResumoTipo === 'personalizado' ? (
          <ResumoPersonalizado
            configuracoes={podeVerValores ? resumoPersonalizado : (resumoPersonalizado || []).filter((item) => !COMMERCIAL_VALUE_FIELDS.has(item.field) && !COMMERCIAL_VALUE_FIELDS.has(item.divisorField))}
            pesagens={pesagens}
            dataPesagem={dataPesagem}
            apartacaoSelecionada={apartacaoSelecionada}
          />
        ) : painelResumoTipo === 'abate' ? (
          <ResumoEmbarque
            embarques={embarques}
            documentos={documentosEmbarque}
            embarqueSelecionado={embarqueSelecionadoDoc}
            pesagens={pesagens}
          />
        ) : painelResumoTipo === 'venda' && podeVerValores ? (
          <ResumoVendaDia
            pesagens={pesagens}
            dataPesagem={dataPesagem}
            mostrarArrobas={podeVerValores}
          />
        ) : (
          <ResumoLotes
            apartacaoSelecionada={apartacaoSelecionada}
            apartacoes={apartacoes}
            lotesApartacaoAtual={lotesApartacaoAtual}
            pesagens={pesagens}
            pesagensDia={pesagensDia}
            dataPesagem={dataPesagem}
            mostrarArrobas={podeVerValores}
          />
        )}
      </div>

      <Dialog open={Boolean(deleteLaunchRequest)} onOpenChange={(open) => { if (!open) setDeleteLaunchRequest(null); }}>
        <DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact d17e-confirm-dialog">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>{deleteLaunchPlan.cascades.some((cascade) => cascade.blocked)
              ? `O cadastro original de ${deleteLaunchRequest?.numero_animal} / Marca ${deleteLaunchRequest?.marca || '-'} possui histórico e não pode ser excluído. Inative o animal ou cancele somente um evento.`
              : `Somente este lançamento de ${deleteLaunchRequest?.numero_animal} / Marca ${deleteLaunchRequest?.marca || '-'} será excluído. O cadastro e os demais registros serão preservados.`}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="d17b-standard-dialog__footer"><Button variant="outline" onClick={() => setDeleteLaunchRequest(null)}>Cancelar</Button><Button className="emp-toolbar-btn-delete" disabled={deleteLaunchPlan.cascades.some((cascade) => cascade.blocked)} onClick={confirmarExclusaoLancamento}>Excluir</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={outlierDialog.open} onOpenChange={(open) => { if (!open) setOutlierDialog({ open: false, warnings: [], options: null }); }}>
        <DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact">
          <DialogHeader>
            <DialogTitle>Conferir peso informado</DialogTitle>
            <DialogDescription>O lançamento pode ser válido, mas está fora das faixas operacionais de conferência.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <ul className="list-disc pl-5 text-xs text-slate-700 space-y-1">{outlierDialog.warnings.map((warning) => <li key={warning.code}>{warning.message}</li>)}</ul>
            <div className="space-y-1"><Label className="text-xs">Justificativa para continuar</Label><Input value={outlierJustification} onChange={(event) => setOutlierJustification(event.target.value)} placeholder="Ex.: peso conferido na balança" /></div>
          </div>
          <DialogFooter className="d17b-standard-dialog__footer">
            <Button variant="outline" onClick={() => setOutlierDialog({ open: false, warnings: [], options: null })}>Cancelar</Button>
            <Button disabled={!outlierJustification.trim()} onClick={() => { const pending = outlierDialog.options || {}; setOutlierDialog({ open: false, warnings: [], options: null }); void handleSalvar({ ...pending, outlierJustification: outlierJustification.trim() }); }}>Confirmar e salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG APARTAÇÕES/LOTES */}
      </div>

      <GerenciarApartacoesDialog
        open={showApartacoesDialog}
        onOpenChange={setShowApartacoesDialog}
        empresaId={empresaSelecionadaId}
        apartacoes={apartacoes}
        lotes={lotesApartacao}
        pesagens={pesagens}
        onRefresh={loadAllData}
        onUseApartacao={(apartacao) => { setApartacaoSelecionada(apartacao.id); setLoteTransferencia(''); }}
        onUseLote={(lote) => { setApartacaoSelecionada(lote.apartacao_id); setLoteTransferencia(lote.id); }}
        dbReady={dbReady} />


      {showConfigColunas ? (
        <MakColumnConfigDialog
          open={showConfigColunas}
          onOpenChange={setShowConfigColunas}
          columns={colunasPermitidas}
          order={colunasOrdem}
          visible={colunasVisiveis}
          onApply={aplicarConfiguracaoColunas}
        />
      ) : null}


      <GerenciarEmbarquesDialog
        open={dialogEmbarqueOpen}
        onOpenChange={setDialogEmbarqueOpen}
        empresaId={empresaSelecionadaId}
        embarques={embarques}
        documentos={documentosEmbarque}
        pesagens={pesagens}
        onRefresh={loadAllData}
        dbReady={dbReady}
        onUseDocument={(shipment, document) => { setEmbarqueSelecionadoDoc(shipment?.id || document.embarque_id); setDocumentoSelecionado(document.id); toast.success('Documentação aplicada ao lançamento.'); }}
      />

      <ConfigurarResumosDialog
        open={showResumoConfig}
        onOpenChange={setShowResumoConfig}
        value={resumoPersonalizado}
        onSave={salvarResumoPersonalizado}
      />

      <SelecionarAnimalDialog
        open={seletorAnimalOpen}
        onOpenChange={setSeletorAnimalOpen}
        numero={numeroAnimal}
        animais={opcoesAnimal}
        onSelect={aplicarAnimalSelecionado}
      />

      <ConfirmarAnimalSnDialog
        open={snDialogOpen}
        onOpenChange={setSnDialogOpen}
        initialValue={snDialogInitialValue}
        inherited={snDialogInherited}
        marcas={marcasAtivas}
        racas={racasAtivas}
        categorias={categoriasAtivas}
        onConfirm={(profile) => {
          // O perfil do SN vai só no snProfile deste salvamento: não é copiado para o
          // contexto do Cadastro, e os próximos animais não herdam o SN (V-07).
          setSnDialogOpen(false);
          void handleSalvar({ skipSnConfirmation: true, snProfile: profile });
        }}
      />


    </ModeloBase1PageContainer>);

}
