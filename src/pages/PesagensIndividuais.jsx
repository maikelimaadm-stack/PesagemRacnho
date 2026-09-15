import React, { useMemo, useRef, useState } from "react";
import MakTh, { makRowClass } from "@/components/mak/MakTh";
import { matchesMakColumnFilter, isMakColumnFilterActive } from "@/components/mak/MakColumnMenu";
import MakColumnConfigDialog from "@/components/mak/MakColumnConfigDialog";
import MakDateControl from "@/components/mak/MakDateControl";
import MakFilterRail from "@/components/mak/MakFilterRail";
import MakFilterPill from "@/components/mak/MakFilterPill";
import MakTableSelectCheck from "@/components/mak/MakTableSelectCheck";
import MgFilterPanel from "@/components/mak/MgFilterPanel";
import MgDesktopSearch from "@/components/mak/MgDesktopSearch";
import MgSpeedDialMenu from "@/components/mak/MgSpeedDialMenu";
import MgTablePanelStrip from "@/components/mak/MgTablePanelStrip";
import { normalizeSearchQuery } from "@/components/mak/mgSearchHighlight";
import {
  ModeloBase1ActionBar,
  ModeloBase1PageContainer,
  ModeloBase1PageHeader,
} from "@/components/modelobase1";
import { ensureEmpresaId } from "@/api/db";
import * as weighingService from "@/modules/weighing/application/weighingService";
import * as apartacaoService from "@/modules/auxiliary/application/apartacaoService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Upload, Search, Trash2, FileSpreadsheet, Download, 
  ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Filter, X, Scale,
  AlertTriangle, CheckCircle2, Settings, MoreVertical, Layers, ListFilter, ChevronLeft, ChevronRight
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { fmtCurrency, fmtDateBR, fmtInt, fmtNum } from "@/components/common/formatNumber";
import { buildDeletionPlan } from "@/modules/animals/domain/animalHistory";
import { deleteEntriesRespectingHistory } from "@/modules/animals/application/animalHistoryService";
import { applyImportLotSelection, importLotKey } from "@/modules/weighing/domain/importLotSelection";
import { parseCsv } from "@/modules/weighing/domain/csvParser";
import { parseBrazilianNumber, parseCivilDate } from "@/modules/weighing/domain/brazilianValues";
import { isSnIdentifier, normalizeAnimalIdentifier } from "@/modules/animals/domain/snAnimal";
import { sha256Hex } from "@/lib/sha256";
import { useAuth } from "@/components/auth/useAuth";
import { REGISTRY_WRITE_PERMISSION, brandService, breedService, resolveMany } from "@/modules/catalog/application/index";
import { collectRegistryTexts, countUnknownRegistries, splitImportRowsByRegistry } from "@/modules/operations/domain/importRegistryResolution";

// Importação (S-01.5 / IMPORT-TARGET-MODEL §2.2): marca e raça das linhas são
// resolvidas por nome normalizado contra os cadastros mestres no dry-run. Texto
// sem cadastro fica como erro por linha; só a opção explícita "Criar estes
// cadastros ao importar" (exige registry.write) cria marcas/raças — e antes da
// gravação das pesagens. Nenhuma criação silenciosa.
const RESOLUCAO_CADASTROS_VAZIA = Object.freeze({ resolved: {}, desconhecidos: { marcas: [], racas: [] }, rejeitadas: [] });

const COLUNAS_DISPONIVEIS = [
  { id: "selecao", label: "Seleção", default: true, fixo: true },
  { id: "acoes", label: "Ações", default: true, fixo: true },
  { id: "data_pesagem", label: "Data", default: true, sortable: true, align: "left" },
  { id: "tipo_manejo", label: "Tipo", default: true, sortable: true, align: "left" },
  { id: "motivo_saida", label: "Tipo de Saída", default: true, sortable: true, align: "left" },
  { id: "numero_animal", label: "Animal", default: true, sortable: true, align: "left" },
  // A identidade do animal é o par (número, marca): sem a marca, dois animais
  // diferentes com o mesmo número ficam indistinguíveis na listagem.
  { id: "marca", label: "Marca", default: true, sortable: true, align: "left" },
  { id: "sexo", label: "Sexo", default: true, sortable: true, align: "left" },
  { id: "raca", label: "Raça", default: true, sortable: true, align: "left" },
  { id: "era", label: "Era", default: true, sortable: true, align: "left" },
  { id: "peso", label: "Peso", default: true, sortable: true, align: "right" },
  { id: "nome_lote", label: "Lote", default: true, sortable: true, align: "left" },
  { id: "nome_apartacao", label: "Apartação", default: true, sortable: true, align: "left" },
  { id: "valor_pago_cabeca", label: "Valor Compra", default: false, sortable: true, align: "right" },
  { id: "origem_animal", label: "Origem", default: false, sortable: true, align: "left" },
  { id: "comprador", label: "Comprador", default: false, sortable: true, align: "left" },
  { id: "destino_venda", label: "Destino", default: false, sortable: true, align: "left" },
  { id: "valor_venda_total", label: "Valor Venda", default: false, sortable: true, align: "right" },
  { id: "valor_arroba", label: "Preço/@ carcaça", default: false, sortable: true, align: "right" },
  { id: "quantidade_arrobas", label: "@ carcaça estimada", default: false, sortable: true, align: "right" },
  { id: "frigorifico", label: "Frigorífico", default: false, sortable: true, align: "left" },
  { id: "embarque_nome", label: "Embarque", default: false, sortable: true, align: "left" },
  { id: "documento_tipo", label: "Doc", default: false, sortable: true, align: "left" },
  { id: "documento_numero", label: "Nº Doc", default: false, sortable: true, align: "left" },
  { id: "motorista_nome", label: "Motorista", default: false, sortable: true, align: "left" },
  { id: "placa_carreta", label: "Placa", default: false, sortable: true, align: "left" },
  { id: "doc_qtd", label: "Qtd Doc (Dia)", default: false, sortable: true, align: "right" },
  { id: "dias", label: "Dias", default: false, sortable: true, align: "right" },
  { id: "ganho", label: "Ganho", default: false, sortable: true, align: "right" },
  { id: "gmd", label: "GMD", default: true, sortable: true, align: "right" },
  { id: "observacao", label: "Observação", default: false, sortable: true, align: "left" },
];

const DEFAULT_CUSTOM_FILTER_IDS = new Set([
  "data_pesagem", "tipo_manejo", "numero_animal", "sexo", "peso", "nome_lote", "nome_apartacao",
]);
const FILTROS_DISPONIVEIS = COLUNAS_DISPONIVEIS
  .filter((coluna) => !coluna.fixo)
  .map((coluna) => ({ ...coluna, default: DEFAULT_CUSTOM_FILTER_IDS.has(coluna.id) }));

const NUMBER_COLUMN_IDS = new Set(["peso", "peso_anterior", "valor_pago_cabeca", "valor_venda_total", "valor_arroba", "quantidade_arrobas", "doc_qtd", "dias", "ganho", "gmd"]);
const DATE_COLUMN_IDS = new Set(["data_pesagem", "data_anterior"]);
const getColumnFilterType = (id) => DATE_COLUMN_IDS.has(id) ? "date" : NUMBER_COLUMN_IDS.has(id) ? "number" : "text";
const COLUMN_WIDTHS = {
  // Colunas de controle não recebem a folga padrão das colunas de texto:
  // o checkbox fica centralizado, com apenas a área clicável necessária.
  selecao: 32,
  acoes: 36,
  data_pesagem: 108,
  data_anterior: 108,
  sexo: 92,
  era: 88,
  peso: 108,
  dias: 82,
  ganho: 100,
  gmd: 92,
  numero_animal: 116,
  tipo_manejo: 112,
  documento_tipo: 92,
  documento_numero: 120,
  placa_carreta: 108,
};
const getColumnWidth = (id) => COLUMN_WIDTHS[id] || 138;
const getPesagemColumnValue = (pesagem, columnId, documentCounts = {}) => {
  if (columnId === "doc_qtd") {
    return pesagem.documento_embarque_id ? documentCounts[pesagem.documento_embarque_id] || 0 : "";
  }
  return pesagem[columnId];
};

const asFilterValues = (value) => Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
const filterHasValue = (value) => asFilterValues(value).length > 0;
const filterMatchesValue = (filter, value) => {
  const selected = asFilterValues(filter);
  return selected.length === 0 || selected.includes(String(value ?? ""));
};
const firstFilterValue = (value) => asFilterValues(value)[0] || "";

// Painel lateral de filtros (ModeloBase1): texto "contém", datas e seleções.
const CAMPOS_TEXTO_PAINEL = [
  { key: "animal", label: "Animal" },
  { key: "marca", label: "Marca" },
  { key: "lote", label: "Lote" },
  { key: "apartacao", label: "Apartação" },
  { key: "raca", label: "Raça" },
  { key: "observacao", label: "Observação" },
];
const CAMPOS_DATA_PAINEL = [
  { key: "dataInicio", label: "Data inicial" },
  { key: "dataFim", label: "Data final" },
];
const CAMPOS_SELECAO_PAINEL = [
  { key: "sexo", label: "Sexo", options: [{ value: "Todos", label: "Todos" }, { value: "M", label: "Macho" }, { value: "F", label: "Fêmea" }] },
  { key: "tipo", label: "Tipo", options: [{ value: "Todos", label: "Todos" }, { value: "Cadastro", label: "Cadastro" }, { value: "Manejo", label: "Manejo" }, { value: "Saída", label: "Saída" }] },
  { key: "status", label: "Status", options: [{ value: "Todos", label: "Todos" }, { value: "Ativo", label: "Ativo" }, { value: "Inativo", label: "Inativo" }] },
];
const CAMPOS_RESULTADO_PESQUISA = [
  { key: "marca", label: "Marca" },
  { key: "data", label: "Data" },
  { key: "peso", label: "Peso" },
  { key: "lote", label: "Lote" },
  { key: "apartacao", label: "Apartação" },
];
const FILTRO_PAINEL_VAZIO = Object.freeze({ animal: [], marca: [], lote: [], apartacao: [], raca: [], observacao: [], dataInicio: [], dataFim: [], sexo: [], tipo: [], status: [] });
const textoContem = (value, term) => normalizeSearchQuery(value).includes(normalizeSearchQuery(term));

export default function PesagensIndividuais() {
  const empresaSelecionadaId = ensureEmpresaId();
  const queryClient = useQueryClient();

  // Estados
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'data_pesagem', direction: 'desc' });
  const [filtroLote, setFiltroLote] = useState("");
  const [filtroApartacao, setFiltroApartacao] = useState("");
  const [filtroSexo, setFiltroSexo] = useState("");
  const [filtroTipoManejo, setFiltroTipoManejo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [filtroMarca, setFiltroMarca] = useState("");
  const [filtroObservacao, setFiltroObservacao] = useState("");
  const [filtroDataEspecifica, setFiltroDataEspecifica] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [selectedItems, setSelectedItems] = useState([]);
  const [deleteRequest, setDeleteRequest] = useState({ open: false, ids: [] });
  const [showFilters, setShowFilters] = useState(false);
  const [showQuickSearch, setShowQuickSearch] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState(() => ({ ...FILTRO_PAINEL_VAZIO }));
  const [filtrosPainel, setFiltrosPainel] = useState(() => ({ ...FILTRO_PAINEL_VAZIO }));
  const importInputRef = useRef(null);
  const [colunaMenuAberto, setColunaMenuAberto] = useState(null);
  const [filtrosColuna, setFiltrosColuna] = useState({});
  
  // Import states
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importData, setImportData] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importFileInfo, setImportFileInfo] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [showConfigColunas, setShowConfigColunas] = useState(false);
  const [showConfigFiltros, setShowConfigFiltros] = useState(false);
  const [tipoManejoImport, setTipoManejoImport] = useState('Manejo');
  const [motivoSaidaImport, setMotivoSaidaImport] = useState('');
  const [destinoVendaImport, setDestinoVendaImport] = useState('');
  // Cadastros (marca/raça) não encontrados no dry-run e a opção de criá-los.
  const [importResolucaoCadastros, setImportResolucaoCadastros] = useState(RESOLUCAO_CADASTROS_VAZIA);
  const [criarCadastrosNaImportacao, setCriarCadastrosNaImportacao] = useState(false);
  const auth = useAuth();
  const podeCriarCadastros = Boolean(auth?.can?.(REGISTRY_WRITE_PERMISSION));
  const totalCadastrosDesconhecidos = countUnknownRegistries(importResolucaoCadastros.desconhecidos);
  // Linhas que dependem de cadastros ainda inexistentes: só entram com a opção ligada.
  const linhasPendentesCadastro = useMemo(() => importResolucaoCadastros.rejeitadas.map((item) => item.row), [importResolucaoCadastros]);
  const importErrosExibidos = useMemo(
    () => (criarCadastrosNaImportacao ? importErrors : [...importErrors, ...importResolucaoCadastros.rejeitadas.map(({ linha, erro }) => ({ linha, erro }))]),
    [criarCadastrosNaImportacao, importErrors, importResolucaoCadastros],
  );
  const totalLinhasImportaveis = importData.length + (criarCadastrosNaImportacao ? linhasPendentesCadastro.length : 0);
  
  // Estado para vinculação de lotes
  const [showVincularLotes, setShowVincularLotes] = useState(false);
  const [lotesParaVincular, setLotesParaVincular] = useState([]);
  const [vincularLotesSelecionados, setVincularLotesSelecionados] = useState({});

  const [filtrosOrdem, setFiltrosOrdem] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("filtros_ordem_pesagens_individuais_v3")) || FILTROS_DISPONIVEIS.map((filtro) => filtro.id);
    } catch {
      return FILTROS_DISPONIVEIS.map((filtro) => filtro.id);
    }
  });
  const [filtrosVisiveis, setFiltrosVisiveis] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("filtros_visiveis_pesagens_individuais_v3")) || FILTROS_DISPONIVEIS.filter((filtro) => filtro.default).map((filtro) => filtro.id);
    } catch {
      return FILTROS_DISPONIVEIS.filter((filtro) => filtro.default).map((filtro) => filtro.id);
    }
  });

  const aplicarConfiguracaoFiltros = ({ order, visible }) => {
    setFiltrosOrdem(order);
    setFiltrosVisiveis(visible);
    localStorage.setItem("filtros_ordem_pesagens_individuais_v3", JSON.stringify(order));
    localStorage.setItem("filtros_visiveis_pesagens_individuais_v3", JSON.stringify(visible));
  };

  // Estado para edição em lote
  const [showEditarLote, setShowEditarLote] = useState(false);
  const [edicaoLote, setEdicaoLote] = useState({ data_pesagem: "", sexo: "", raca: "", era: "", marca: "", apartacao: "", lote: "" });
  
  // Fetch apartações e lotes
  const { data: apartacoesData = [] } = useQuery({
    queryKey: ['apartacoes', empresaSelecionadaId],
    queryFn: async () => {
      return apartacaoService.listApartacoes({ empresaId: empresaSelecionadaId });
    },
    enabled: !!empresaSelecionadaId,
  });

  const { data: lotesData = [] } = useQuery({
    queryKey: ['lotes', empresaSelecionadaId],
    queryFn: async () => {
      return apartacaoService.listLoteApartacoes({ empresaId: empresaSelecionadaId });
    },
    enabled: !!empresaSelecionadaId,
  });

  // Lotes filtrados pela apartação selecionada na edição
  const lotesEdicaoFiltrados = useMemo(() => {
    if (!edicaoLote.apartacao) return [];
    return lotesData.filter(l => l.apartacao_id === edicaoLote.apartacao);
  }, [lotesData, edicaoLote.apartacao]);

  // Configuração de colunas
  const [colunasOrdem, setColunasOrdem] = useState(() => {
    const saved = localStorage.getItem('colunas_ordem_pesagens_individuais');
    if (saved) {
      try {
        const salvas = JSON.parse(saved);
        // A ordem salva também precisa conhecer a Marca: uma coluna visível que
        // não está na ordem simplesmente não é desenhada.
        if (Array.isArray(salvas) && !salvas.includes('marca')) {
          const posicao = salvas.indexOf('numero_animal');
          const migradas = [...salvas];
          migradas.splice(posicao >= 0 ? posicao + 1 : migradas.length, 0, 'marca');
          localStorage.setItem('colunas_ordem_pesagens_individuais', JSON.stringify(migradas));
          return migradas;
        }
        return salvas;
      } catch {
        return COLUNAS_DISPONIVEIS.map(c => c.id);
      }
    }
    return COLUNAS_DISPONIVEIS.map(c => c.id);
  });

  const [colunasVisiveis, setColunasVisiveis] = useState(() => {
    const saved = localStorage.getItem('colunas_visiveis_pesagens_individuais');
    if (saved) {
      try {
        const salvas = JSON.parse(saved);
        // Quem já usava o sistema tem uma lista salva sem a Marca. Como ela
        // passou a fazer parte da identidade do animal, incluímos uma única vez
        // sem descartar o resto da configuração do usuário.
        if (Array.isArray(salvas) && !salvas.includes('marca')) {
          const posicao = salvas.indexOf('numero_animal');
          const migradas = [...salvas];
          migradas.splice(posicao >= 0 ? posicao + 1 : migradas.length, 0, 'marca');
          localStorage.setItem('colunas_visiveis_pesagens_individuais', JSON.stringify(migradas));
          return migradas;
        }
        return salvas;
      } catch {
        return COLUNAS_DISPONIVEIS.filter(c => c.default).map(c => c.id);
      }
    }
    return COLUNAS_DISPONIVEIS.filter(c => c.default).map(c => c.id);
  });

  const aplicarConfiguracaoColunas = ({ order, visible }) => {
    setColunasOrdem(order);
    setColunasVisiveis(visible);
    localStorage.setItem('colunas_ordem_pesagens_individuais', JSON.stringify(order));
    localStorage.setItem('colunas_visiveis_pesagens_individuais', JSON.stringify(visible));
  };

  const ocultarColuna = (colunaId) => {
    const novasColunas = colunasVisiveis.filter((id) => id !== colunaId);
    setColunasVisiveis(novasColunas);
    localStorage.setItem('colunas_visiveis_pesagens_individuais', JSON.stringify(novasColunas));
    setColunaMenuAberto(null);
  };

  const colunasOrdenadas = colunasOrdem
    .map(id => COLUNAS_DISPONIVEIS.find(c => c.id === id))
    .filter(c => c && colunasVisiveis.includes(c.id));
  const tableMinWidth = colunasOrdenadas.reduce((total, coluna) => total + getColumnWidth(coluna.id), 0);

  // Fetch pesagens
  const { data: pesagens = [], isLoading, refetch } = useQuery({
    queryKey: ['pesagens-individuais', empresaSelecionadaId],
    queryFn: async () => {
      return weighingService.listEntries({ empresaId: empresaSelecionadaId });
    },
    enabled: !!empresaSelecionadaId,
  });

  const documentCounts = useMemo(() => {
    const counts = {};
    pesagens.forEach((pesagem) => {
      if (pesagem.documento_embarque_id) {
        counts[pesagem.documento_embarque_id] = (counts[pesagem.documento_embarque_id] || 0) + 1;
      }
    });
    return counts;
  }, [pesagens]);

  // Valores únicos para filtros e autocomplete
  const lotesUnicos = [...new Set(pesagens.map(p => p.nome_lote).filter(Boolean))].sort();
  const apartacoesUnicas = [...new Set(pesagens.map(p => p.nome_apartacao).filter(Boolean))].sort();
  const marcasExistentes = [...new Set(pesagens.map(p => p.marca).filter(Boolean))].sort();
  const racasExistentes = [...new Set(pesagens.map(p => p.raca).filter(Boolean))].sort();
  const erasExistentes = [...new Set(pesagens.map(p => p.era).filter(Boolean))].sort();
  
  // Datas únicas por apartação selecionada
  const datasUnicasApartacao = useMemo(() => {
    let pesagensFiltro = pesagens;
    if (filterHasValue(filtroApartacao)) {
      pesagensFiltro = pesagens.filter(p => filterMatchesValue(filtroApartacao, p.nome_apartacao));
    }
    return [...new Set(pesagensFiltro.map(p => p.data_pesagem).filter(Boolean))].sort().reverse();
  }, [pesagens, filtroApartacao]);

  // Filtrar e ordenar
  const pesagensFiltradas = useMemo(() => {
    let filtered = pesagens.filter(p => {
      if (searchTerm) {
        const alvo = [p.numero_animal, p.marca, p.nome_lote, p.nome_apartacao, p.raca].map((value) => String(value ?? "")).join(" ");
        if (!textoContem(alvo, searchTerm)) return false;
      }
      for (const campo of CAMPOS_TEXTO_PAINEL) {
        const termo = firstFilterValue(filtrosPainel[campo.key]);
        if (!termo) continue;
        const valor = campo.key === "animal" ? p.numero_animal : campo.key === "lote" ? p.nome_lote : campo.key === "apartacao" ? p.nome_apartacao : p[campo.key];
        if (!textoContem(valor, termo)) return false;
      }
      if (!filterMatchesValue(filtroLote, p.nome_lote)) return false;
      if (!filterMatchesValue(filtroApartacao, p.nome_apartacao)) return false;
      if (!filterMatchesValue(filtroDataEspecifica, p.data_pesagem)) return false;
      if (!filterMatchesValue(filtroSexo, p.sexo)) return false;
      if (!filterMatchesValue(filtroTipoManejo, p.tipo_manejo)) return false;
      const statusCalc = p.status_animal || (p.tipo_manejo === 'Saída' ? 'Inativo' : 'Ativo');
      if (!filterMatchesValue(filtroStatus, statusCalc)) return false;
      if (filtroDataInicio && p.data_pesagem < filtroDataInicio) return false;
      if (filtroDataFim && p.data_pesagem > filtroDataFim) return false;
      // Filtro de marca: "sem_marca" mostra os sem marca, ou filtra por marca específica
      if (filterHasValue(filtroMarca)) {
        const marcasSelecionadas = asFilterValues(filtroMarca);
        const semMarca = !p.marca || p.marca.trim() === '';
        if (!(marcasSelecionadas.includes(String(p.marca || "")) || (marcasSelecionadas.includes("sem_marca") && semMarca))) return false;
      }
      // Filtro de observação: "sem_observacao" mostra os sem obs, "com_observacao" mostra os com obs
      if (filterHasValue(filtroObservacao)) {
        const observacoesSelecionadas = asFilterValues(filtroObservacao);
        const temObservacao = Boolean(p.observacao && p.observacao.trim() !== '');
        if (!((observacoesSelecionadas.includes("com_observacao") && temObservacao) || (observacoesSelecionadas.includes("sem_observacao") && !temObservacao))) return false;
      }
      for (const [columnId, value] of Object.entries(filtrosColuna)) {
        if (!isMakColumnFilterActive(value)) continue;
        if (!matchesMakColumnFilter(getPesagemColumnValue(p, columnId, documentCounts), value, getColumnFilterType(columnId))) return false;
      }
      return true;
    });

    // Ordenar
    filtered.sort((a, b) => {
      let aVal = getPesagemColumnValue(a, sortConfig.key, documentCounts);
      let bVal = getPesagemColumnValue(b, sortConfig.key, documentCounts);
      
      if (sortConfig.key === 'data_pesagem' || sortConfig.key === 'data_anterior') {
        aVal = aVal ? new Date(aVal) : new Date(0);
        bVal = bVal ? new Date(bVal) : new Date(0);
      } else if (NUMBER_COLUMN_IDS.has(sortConfig.key)) {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [pesagens, documentCounts, searchTerm, filtrosPainel, filtroLote, filtroApartacao, filtroDataEspecifica, filtroSexo, filtroTipoManejo, filtroStatus, filtroDataInicio, filtroDataFim, filtroMarca, filtroObservacao, filtrosColuna, sortConfig]);

  // Contagem estável por documento (também usada por filtro, ordenação e célula).
  const docCounts = documentCounts;

  // Paginação
  const totalPages = Math.ceil(pesagensFiltradas.length / itemsPerPage);
  const pesagensPaginadas = pesagensFiltradas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Estatísticas
  const stats = useMemo(() => {
    const total = pesagensFiltradas.length;
    const pesoTotal = pesagensFiltradas.reduce((s, p) => s + (Number(p.peso) || 0), 0);
    const registrosComPeso = pesagensFiltradas.filter((p) => Number.isFinite(Number(p.peso)) && Number(p.peso) > 0);
    const pesoMedio = registrosComPeso.length > 0 ? pesoTotal / registrosComPeso.length : 0;
    const latestByAnimal = new Map();
    for (const entry of pesagensFiltradas) {
      const key = entry.animal_id || `${String(entry.numero_animal || '').trim().toUpperCase()}::${String(entry.marca || '').trim().toUpperCase()}`;
      const current = latestByAnimal.get(key);
      if (!current || String(entry.data_pesagem || '') > String(current.data_pesagem || '')) latestByAnimal.set(key, entry);
    }
    const animaisUnicos = latestByAnimal.size;
    const ativos = [...latestByAnimal.values()].filter((entry) => (entry.status_animal || 'Ativo') === 'Ativo');
    const pesoAtual = ativos.reduce((sum, entry) => sum + (Number(entry.peso) || 0), 0);
    const pesoMedioAtual = ativos.length ? pesoAtual / ativos.length : 0;
    const arrobaTotal = pesoTotal / 15;
    const arrobaMedia = pesoMedio / 15;
    const registrosComGmd = pesagensFiltradas.filter((p) => p.gmd !== null && p.gmd !== undefined && p.gmd !== '');
    const registrosComGanho = pesagensFiltradas.filter((p) => p.ganho !== null && p.ganho !== undefined && p.ganho !== '');
    const registrosComDias = pesagensFiltradas.filter((p) => p.dias !== null && p.dias !== undefined && p.dias !== '');
    const gmdMedio = registrosComGmd.length > 0
      ? registrosComGmd.reduce((s, p) => s + (Number(p.gmd) || 0), 0) / registrosComGmd.length
      : 0;
    const ganhoMedio = registrosComGanho.length > 0
      ? registrosComGanho.reduce((s, p) => s + (Number(p.ganho) || 0), 0) / registrosComGanho.length
      : 0;
    const diasMedio = registrosComDias.length > 0
      ? registrosComDias.reduce((s, p) => s + (Number(p.dias) || 0), 0) / registrosComDias.length
      : 0;
    const arrobaGanhaMedia = ganhoMedio / 15;
    return { total, animaisUnicos, animaisAtivos: ativos.length, pesoMedio, pesoTotal, pesoAtual, pesoMedioAtual, arrobaMedia, arrobaTotal, gmdMedio, ganhoMedio, diasMedio, arrobaGanhaMedia };
  }, [pesagensFiltradas]);



  // Handlers
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const fileHash = await sha256Hex(text);
        setImportFileInfo({ id: crypto.randomUUID(), name: file.name, size: file.size, hash: fileHash, origin: 'csv' });
        const { rows } = parseCsv(text);
         
        if (rows.length < 2) {
          toast.error('Arquivo vazio ou sem dados');
          return;
        }

        const headers = rows[0].map(h => h.trim().toLowerCase());
        
        // Mapear colunas (normaliza removendo espaços, acentos e underscores)
        const normalizar = (str) => str.toLowerCase().replace(/[_\s]/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        
        const colMap = {
          id_sistema: headers.findIndex(h => normalizar(h) === 'id'),
          id_externo: headers.findIndex(h => normalizar(h) === 'idexterno'),
          data: headers.findIndex(h => normalizar(h) === 'data'),
          numero_animal: headers.findIndex(h => normalizar(h) === 'numeroanimal' || normalizar(h) === 'animal'),
          sexo: headers.findIndex(h => normalizar(h) === 'sexo'),
          raca: headers.findIndex(h => normalizar(h) === 'raca' || normalizar(h) === 'raça'),
          era: headers.findIndex(h => normalizar(h) === 'era'),
          marca: headers.findIndex(h => normalizar(h) === 'marca'),
          peso: headers.findIndex(h => normalizar(h) === 'peso'),
          nome_lote: headers.findIndex(h => normalizar(h) === 'lote' || normalizar(h) === 'nomelote'),
          nome_apartacao: headers.findIndex(h => normalizar(h) === 'apartacao' || normalizar(h) === 'nomeapartacao'),
          observacao: headers.findIndex(h => normalizar(h) === 'observacao' || normalizar(h) === 'obs'),
          data_anterior: headers.findIndex(h => normalizar(h) === 'dataanterior'),
          peso_anterior: headers.findIndex(h => normalizar(h) === 'pesoanterior'),
          dias: headers.findIndex(h => normalizar(h) === 'dias'),
          ganho: headers.findIndex(h => normalizar(h) === 'ganho'),
          gmd: headers.findIndex(h => normalizar(h) === 'gmd'),
        };

        const dados = [];
        const erros = [];

        for (let i = 1; i < rows.length; i++) {
          const valores = rows[i];
          
          const registro = {
            linha: i + 1,
            id_externo: colMap.id_externo >= 0 ? valores[colMap.id_externo] : null,
            data_pesagem: colMap.data >= 0 ? parseCivilDate(valores[colMap.data]) : null,
            numero_animal: colMap.numero_animal >= 0 ? normalizeAnimalIdentifier(valores[colMap.numero_animal]) : null,
            sexo: colMap.sexo >= 0 ? valores[colMap.sexo]?.toUpperCase() : null,
            raca: colMap.raca >= 0 ? valores[colMap.raca] : null,
            era: colMap.era >= 0 ? valores[colMap.era] : null,
            marca: colMap.marca >= 0 ? valores[colMap.marca] : null,
            peso: colMap.peso >= 0 ? parseBrazilianNumber(valores[colMap.peso]) : null,
            nome_lote: colMap.nome_lote >= 0 ? valores[colMap.nome_lote] : null,
            nome_apartacao: colMap.nome_apartacao >= 0 ? valores[colMap.nome_apartacao] : null,
            observacao: colMap.observacao >= 0 ? valores[colMap.observacao] : null,
            // Derivados do arquivo são deliberadamente ignorados. O serviço
            // recompõe a série após o commit atômico da importação.
            data_anterior: null,
            peso_anterior: null,
            dias: null,
            ganho: null,
            gmd: null,
          };

          // Validar campos obrigatórios
          if (!registro.numero_animal) {
            erros.push({ linha: i + 1, erro: 'Número do animal não informado' });
            continue;
          }
          if (!Number.isFinite(registro.peso) || registro.peso <= 0) {
            erros.push({ linha: i + 1, erro: `Animal ${registro.numero_animal}: Peso não informado` });
            continue;
          }
          if (!registro.data_pesagem) {
            erros.push({ linha: i + 1, erro: `Animal ${registro.numero_animal}: Data inválida` });
            continue;
          }

          // Se for SN, limpar campos de ganho/GMD
          const isSN = isSnIdentifier(registro.numero_animal);
          if (isSN) {
            registro.data_anterior = null;
            registro.peso_anterior = null;
            registro.dias = null;
            registro.ganho = null;
            registro.gmd = null;
          }

          dados.push(registro);
        }

        // Dry-run de cadastros: marca/raça resolvidas por nome normalizado
        // (resolvedor único). Texto não cadastrado sai da lista elegível e vira
        // erro por linha até o responsável optar por criar os cadastros.
        const resolucao = await resolveMany(collectRegistryTexts(dados), { empresaId: empresaSelecionadaId });
        const { elegiveis, rejeitadas, desconhecidos } = splitImportRowsByRegistry(dados, resolucao, { criarDesconhecidos: false });
        setImportResolucaoCadastros({ resolved: resolucao, desconhecidos, rejeitadas });
        setCriarCadastrosNaImportacao(false);
        const dadosElegiveis = elegiveis;

        // Verificar se há lotes/apartações no arquivo que existem no sistema
        const lotesNoArquivo = [...new Set(dados.filter(d => d.nome_lote && d.nome_apartacao).map(d => `${d.nome_lote}|${d.nome_apartacao}`))];
        const lotesEncontrados = [];
        
        for (const loteKey of lotesNoArquivo) {
          const [nomeLote, nomeApartacao] = loteKey.split('|');
          
          // Buscar apartação pelo nome
          const apartacao = apartacoesData.find(a => a.nome_apartacao?.toUpperCase() === nomeApartacao?.toUpperCase());
          if (apartacao) {
            // Buscar lote pelo nome dentro da apartação
            const lote = lotesData.find(l => 
              l.apartacao_id === apartacao.id && 
              l.nome_lote?.toUpperCase() === nomeLote?.toUpperCase()
            );
            if (lote) {
              lotesEncontrados.push({
                nome_lote: nomeLote,
                nome_apartacao: nomeApartacao,
                lote_id: lote.id,
                apartacao_id: apartacao.id,
                quantidade: dados.filter(d => d.nome_lote === nomeLote && d.nome_apartacao === nomeApartacao).length
              });
            }
          }
        }

        setImportData(dadosElegiveis);
        setImportErrors(erros);
        
        if (lotesEncontrados.length > 0) {
          setLotesParaVincular(lotesEncontrados);
          // Inicializar todos como selecionados para vincular
          const selecionados = {};
          lotesEncontrados.forEach((lote) => { selecionados[importLotKey(lote)] = true; });
          setVincularLotesSelecionados(selecionados);
          setShowVincularLotes(true);
        } else {
          setShowImportDialog(true);
        }
      } catch (error) {
        toast.error('Erro ao processar arquivo: ' + error.message);
      }
    };
    reader.readAsText(file, 'UTF-8');
    event.target.value = '';
  };

  const confirmarVinculacaoLotes = () => {
    const dadosAtualizados = applyImportLotSelection(importData, lotesParaVincular, vincularLotesSelecionados);
    const removidos = importData.length - dadosAtualizados.length;
    if (removidos > 0) toast.info(`${fmtInt(removidos)} registro(s) removido(s) por não vincular aos lotes existentes.`);
    setImportData(dadosAtualizados);
    // As linhas pendentes de cadastro seguem a mesma decisão de lotes.
    setImportResolucaoCadastros((atual) => {
      const linhasMantidas = new Set(applyImportLotSelection(atual.rejeitadas.map((item) => item.row), lotesParaVincular, vincularLotesSelecionados).map((row) => row.linha));
      return { ...atual, rejeitadas: atual.rejeitadas.filter((item) => linhasMantidas.has(item.row.linha)) };
    });
    setShowVincularLotes(false);
    setShowImportDialog(true);
  };

  // Estado para texto de progresso detalhado
  const [importProgressText, setImportProgressText] = useState("");

  // Cria as marcas/raças desconhecidas (opção explícita, registry.write) e
  // devolve TODAS as linhas com os ids resolvidos — sempre antes de bulkCreateEntries.
  const criarCadastrosDesconhecidos = async () => {
    if (!podeCriarCadastros) throw new Error('Seu perfil não pode criar cadastros. Peça a um gestor para cadastrar as marcas/raças antes de importar.');
    const actor = auth?.user || null;
    const { marcas = [], racas = [] } = importResolucaoCadastros.desconhecidos;
    setImportProgressText(`Criando ${fmtInt(marcas.length + racas.length)} cadastro(s) informado(s) no arquivo...`);
    for (const nome of marcas) await brandService.create(actor, { nome, empresa_id: empresaSelecionadaId });
    for (const nome of racas) await breedService.create(actor, { nome, empresa_id: empresaSelecionadaId });
    const todas = [...importData, ...linhasPendentesCadastro];
    const resolucao = await resolveMany(collectRegistryTexts(todas), { empresaId: empresaSelecionadaId });
    const { elegiveis, rejeitadas } = splitImportRowsByRegistry(todas, resolucao, { criarDesconhecidos: false });
    if (rejeitadas.length) throw new Error(`Cadastros ainda não encontrados após a criação: ${rejeitadas[0].erro}`);
    return elegiveis;
  };

  const confirmarImportacao = async () => {
    if (totalLinhasImportaveis === 0) {
      toast.error('Nenhum dado válido para importar');
      return;
    }
    if (criarCadastrosNaImportacao && !podeCriarCadastros) {
      toast.error('Seu perfil não pode criar cadastros. Desmarque a opção ou peça a um gestor.');
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setImportProgressText("Iniciando importação...");

    try {
      // Sem a opção, só as linhas com marca/raça cadastradas (ou em branco) entram.
      const linhasParaImportar = criarCadastrosNaImportacao && totalCadastrosDesconhecidos > 0
        ? await criarCadastrosDesconhecidos()
        : importData;
      const registros = linhasParaImportar.map(({ linha: _linha, ...item }) => ({
          ...item,
          empresa_id: empresaSelecionadaId,
          tipo_manejo: tipoManejoImport,
          motivo_saida: tipoManejoImport === 'Saída' ? motivoSaidaImport : null,
          status_animal: tipoManejoImport === 'Saída' ? 'Inativo' : 'Ativo',
          destino_venda: (tipoManejoImport === 'Saída' && motivoSaidaImport === 'Venda') ? destinoVendaImport : null,
        }));
      setImportProgressText(`Validando e gravando ${fmtInt(registros.length)} registros em uma única transação...`);
      const importReport = await weighingService.bulkCreateEntries(registros, {
        importMetadata: { ...importFileInfo, totalRows: registros.length + importErrosExibidos.length, operador: 'LOCAL' },
      });
      const importados = registros.length;
      setImportProgress(100);

      setImportProgressText("Finalizando...");
      toast.success(`${importados} pesagens importadas; ${fmtInt(importReport.animais_criados || 0)} animais e ${fmtInt(importReport.movimentos_criados || 0)} movimentos criados.`);
      setShowImportDialog(false);
      setImportData([]);
      setImportErrors([]);
      setImportFileInfo(null);
      setLotesParaVincular([]);
      setVincularLotesSelecionados({});
      setImportResolucaoCadastros(RESOLUCAO_CADASTROS_VAZIA);
      setCriarCadastrosNaImportacao(false);
      setTipoManejoImport('Manejo');
      setMotivoSaidaImport('');
      setDestinoVendaImport('');
      queryClient.invalidateQueries({ queryKey: ['pesagens-individuais'] });
    } catch (error) {
      toast.error('Erro ao importar: ' + error.message);
    } finally {
      setIsImporting(false);
      setImportProgressText("");
    }
  };

  const deletePlan = useMemo(() => buildDeletionPlan(pesagens, deleteRequest.ids), [pesagens, deleteRequest.ids]);
  const deleteMutation = useMutation({
    mutationFn: async (ids) => {
      return deleteEntriesRespectingHistory({ entries: pesagens, ids, empresaId: empresaSelecionadaId });
    },
    onSuccess: () => {
      toast.success('Registros excluídos!');
      setSelectedItems([]);
      setDeleteRequest({ open: false, ids: [] });
      queryClient.invalidateQueries({ queryKey: ['pesagens-individuais'] });
    },
    onError: () => toast.error('Erro ao excluir'),
  });

  const handleEditarLote = () => {
    if (selectedItems.length === 0) {
      toast.error('Selecione ao menos um registro!');
      return;
    }
    setShowEditarLote(true);
  };

  const [progressoEdicao, setProgressoEdicao] = useState({ show: false, current: 0, total: 0, texto: "" });

  const confirmarEdicaoLote = async () => {
    const dadosParaAtualizar = {};
    if (edicaoLote.data_pesagem) dadosParaAtualizar.data_pesagem = edicaoLote.data_pesagem;
    
    // Apartação e Lote
    if (edicaoLote.apartacao) {
      const apt = apartacoesData.find(a => a.id === edicaoLote.apartacao);
      dadosParaAtualizar.apartacao_id = edicaoLote.apartacao;
      dadosParaAtualizar.nome_apartacao = apt?.nome_apartacao || "";
      // Evita deixar um lote pertencente à apartação anterior.
      if (!edicaoLote.lote) {
        dadosParaAtualizar.lote_id = null;
        dadosParaAtualizar.nome_lote = "";
      }
    }
    if (edicaoLote.lote) {
      const lote = lotesData.find(l => l.id === edicaoLote.lote);
      dadosParaAtualizar.lote_id = edicaoLote.lote;
      dadosParaAtualizar.nome_lote = lote?.nome_lote || "";
    }

    if (Object.keys(dadosParaAtualizar).length === 0) {
      toast.error('Preencha ao menos um campo!');
      return;
    }

    setProgressoEdicao({ show: true, current: 0, total: selectedItems.length, texto: "Iniciando atualização..." });
    
    try {
      setProgressoEdicao((prev) => ({ ...prev, texto: 'Atualizando e recalculando as séries afetadas...' }));
      await weighingService.bulkUpdateEntries(selectedItems.map((id) => ({ id, patch: dadosParaAtualizar })), { recalculate: true });
      setProgressoEdicao((prev) => ({ ...prev, current: selectedItems.length }));

      toast.success(`✓ ${fmtInt(selectedItems.length)} registro(s) atualizado(s)!`);
      setShowEditarLote(false);
      setEdicaoLote({ data_pesagem: "", sexo: "", raca: "", era: "", marca: "", apartacao: "", lote: "" });
      setSelectedItems([]);
    } catch (error) {
      toast.error('Erro na atualização: ' + error.message);
    } finally {
      setProgressoEdicao({ show: false, current: 0, total: 0, texto: "" });
    }
  };

  const handleExcluirPesagem = (id) => {
    setDeleteRequest({ open: true, ids: [id] });
  };

  const handleDeleteSelected = () => {
    if (selectedItems.length === 0) return;
    setDeleteRequest({ open: true, ids: [...selectedItems] });
  };

  const limparFiltros = () => {
    setSearchTerm("");
    setSearchInput("");
    setFilterDraft({ ...FILTRO_PAINEL_VAZIO });
    setFiltrosPainel({ ...FILTRO_PAINEL_VAZIO });
    setFiltroLote("");
    setFiltroApartacao("");
    setFiltroSexo("");
    setFiltroDataInicio("");
    setFiltroDataFim("");
    setFiltroMarca("");
    setFiltroObservacao("");
    setFiltroDataEspecifica("");
    setFiltroTipoManejo("");
    setFiltroStatus("");
    setFiltrosColuna({});
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    searchTerm || filterHasValue(filtroLote) || filterHasValue(filtroApartacao) || filterHasValue(filtroSexo) || filterHasValue(filtroTipoManejo) ||
    filterHasValue(filtroStatus) || filtroDataInicio || filtroDataFim ||
    filterHasValue(filtroMarca) || filterHasValue(filtroObservacao) || filterHasValue(filtroDataEspecifica) || Object.values(filtrosColuna).some(isMakColumnFilterActive)
    || Object.values(filtrosPainel).some(filterHasValue)
  );
  const painelFiltrosAtivo = Object.values(filtrosPainel).some(filterHasValue);

  // "Aplicar" do painel: os campos de seleção e datas alimentam os filtros já
  // existentes; os campos de texto ("contém") ficam em filtrosPainel.
  const aplicarFiltrosPainel = () => {
    setFiltrosPainel({ ...filterDraft });
    setFiltroSexo(filterDraft.sexo);
    setFiltroTipoManejo(filterDraft.tipo);
    setFiltroStatus(filterDraft.status);
    setFiltroDataInicio(firstFilterValue(filterDraft.dataInicio));
    setFiltroDataFim(firstFilterValue(filterDraft.dataFim));
    setCurrentPage(1);
  };

  // Resultados da pesquisa expansível (ModeloBase1): um item por animal.
  const resultadosPesquisa = useMemo(() => {
    const termo = searchInput.trim();
    if (!termo) return { items: [], total: 0 };
    const porAnimal = new Map();
    for (const p of pesagens) {
      const alvo = [p.numero_animal, p.marca, p.nome_lote, p.nome_apartacao, p.raca].map((value) => String(value ?? "")).join(" ");
      if (!textoContem(alvo, termo)) continue;
      const chave = `${String(p.numero_animal || "").trim().toUpperCase()}::${String(p.marca || "").trim().toUpperCase()}`;
      const atual = porAnimal.get(chave);
      if (!atual || String(p.data_pesagem || "") > String(atual.data_pesagem || "")) porAnimal.set(chave, p);
    }
    const lista = [...porAnimal.values()].sort((a, b) => String(a.numero_animal || "").localeCompare(String(b.numero_animal || ""), "pt-BR", { numeric: true }));
    const items = lista.slice(0, 30).map((p) => ({
      id: p.id,
      numero_animal: p.numero_animal,
      codigo: p.numero_animal,
      titulo: [p.raca, p.sexo === "M" ? "Macho" : p.sexo === "F" ? "Fêmea" : null].filter(Boolean).join(" · ") || "Animal",
      marca: p.marca || "—",
      data: fmtDateBR(p.data_pesagem),
      peso: p.peso != null ? fmtNum(p.peso) : "—",
      lote: p.nome_lote || "—",
      apartacao: p.nome_apartacao || "—",
    }));
    return { items, total: lista.length };
  }, [pesagens, searchInput]);

  const baixarModelo = () => {
    const headers = ['ID', 'ID_Externo', 'Data', 'NumeroAnimal', 'Sexo', 'Raça', 'Era', 'Marca', 'Peso', 'Lote', 'Apartação', 'Observação', 'DataAnterior', 'PesoAnterior', 'Dias', 'Ganho', 'GMD'];
    const exemplo1 = ['', '22207', '01/12/2025', '4368', 'M', 'Nelore', '2A', 'ABC', '206', 'MEIO', 'ROTINA', '', '15/11/2025', '180', '16', '26', '1.625'];
    const exemplo2 = ['', '22206', '01/12/2025', '4369', 'M', 'Nelore', '3A', 'XYZ', '287', 'BOIADA', 'ROTINA', '', '15/11/2025', '260', '16', '27', '1.687'];
    const exemplo3 = ['', '22205', '01/12/2025', '4370', 'F', 'Nelore', '1A', '', '212', 'MEIO', 'ROTINA', '', '', '', '', '', ''];
    
    const csv = [headers.join(';'), exemplo1.join(';'), exemplo2.join(';'), exemplo3.join(';')].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_pesagens_individuais.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Modelo baixado!');
  };

  const exportarCSV = () => {
    const headers = ['ID', 'ID_Externo', 'Data', 'NumeroAnimal', 'Sexo', 'Raça', 'Era', 'Marca', 'Peso', 'Lote', 'Apartação', 'Observação', 'DataAnterior', 'PesoAnterior', 'Dias', 'Ganho', 'GMD'];
    const rows = pesagensFiltradas.map(p => [
      p.id || '',
      p.id_externo || '',
      fmtDateBR(p.data_pesagem),
      p.numero_animal || '',
      p.sexo || '',
      p.raca || '',
      p.era || '',
      p.marca || '',
      p.peso != null ? fmtNum(p.peso) : '',
      p.nome_lote || '',
      p.nome_apartacao || '',
      p.observacao || '',
      fmtDateBR(p.data_anterior),
      p.peso_anterior != null ? fmtNum(p.peso_anterior) : '',
      p.dias != null ? fmtInt(p.dias) : '',
      p.ganho != null ? fmtNum(p.ganho) : '',
      p.gmd != null ? fmtNum(p.gmd, 3) : '',
    ]);

    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pesagens_individuais_${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === pesagensFiltradas.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(pesagensFiltradas.map(p => p.id));
    }
  };

  const handleRowSelection = (id, event) => {
    if (event.target.closest("button, a, input, [role='menuitem']")) return;
    setSelectedItems((current) => {
      if (event.ctrlKey || event.metaKey) {
        return current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id];
      }
      return current.length === 1 && current[0] === id ? [] : [id];
    });
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    }
    return sortConfig.direction === 'asc' ?
      <ArrowUp className="w-3 h-3 ml-1 text-emerald-600" /> :
      <ArrowDown className="w-3 h-3 ml-1 text-emerald-600" />;
  };

  const renderQuickFilter = (filterId) => {
    const filtro = FILTROS_DISPONIVEIS.find((item) => item.id === filterId);
    if (!filtro) return null;
    const listOptions = [...new Set(
      pesagens
        .map((pesagem) => getPesagemColumnValue(pesagem, filterId, documentCounts))
        .filter((value) => value !== null && value !== undefined && value !== "")
    )];
    return (
      <MakFilterPill
        key={filterId}
        label={filtro.label}
        value={filtrosColuna[filterId] || null}
        filterType={getColumnFilterType(filterId)}
        listOptions={listOptions}
        onChange={(value) => {
          setFiltrosColuna((current) => {
            const next = { ...current };
            if (value && isMakColumnFilterActive(value)) next[filterId] = value;
            else delete next[filterId];
            return next;
          });
          setCurrentPage(1);
        }}
      />
    );
  };

  return (
    <ModeloBase1PageContainer
      variant="table"
      className={`d17b-page d17b-list-page d17b-list-page--mother cadastro-emp-scope mg-empresas-scope${showFilters ? " d17b-filters-open" : ""}`}
    >
      <ModeloBase1PageHeader
        title="Pesagens Individuais"
        visuallyHidden
        description="Consulta, filtros e gestão dos registros de pesagem."
      />

      {/* Barra de ações do ModeloBase1 (Cadastro de Empresas): filtrar, ação principal,
          ações da seleção; à direita, pesquisa expansível e "Mais opções". */}
      <div className="mak-mother-page__toolbar mg-subtoolbar-stack" data-mak-region="toolbar">
        <div data-template-id="action-bar" className="mg-action-bar canva-section flex w-full shrink-0 items-center" style={{ background: "var(--bg-card)" }}>
          <div className="mg-action-bar__actions flex min-w-0 items-center">
            <div className="mg-action-slot is-visible" style={{ "--slot-width": "28px" }}>
              <div className="mg-action-bar__filter-slot">
                <button
                  type="button"
                  className={`ios-btn tb-btn tb-btn-ghost tb-btn-filter tb-btn-icon${painelFiltrosAtivo ? " tb-btn-filter-active" : ""}`}
                  onClick={() => setShowFilters((visible) => !visible)}
                  title="Filtrar"
                  aria-label="Filtrar"
                  aria-pressed={showFilters}
                  aria-controls="filter-panel"
                >
                  <Filter className="h-3.5 w-3.5" />
                  {painelFiltrosAtivo ? <span className="tb-filter-active-dot" aria-hidden="true" /> : null}
                </button>
              </div>
            </div>
            <div className="mg-action-slot is-visible" style={{ "--slot-width": "122px" }}>
              <Link to={createPageUrl("LancamentoPesagensIndividuais")} className="mg-action-slot__link">
                <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-green" title="Lançar pesagem">
                  Lançar pesagem
                </button>
              </Link>
            </div>
            <div className={`mg-action-slot${selectedItems.length === 1 ? " is-visible" : ""}`} style={{ "--slot-width": "66px" }} aria-hidden={selectedItems.length !== 1}>
              <Link to={createPageUrl(`LancamentoPesagensIndividuais?editar=${selectedItems[0] || ""}`)} className="mg-action-slot__link" tabIndex={selectedItems.length === 1 ? 0 : -1}>
                <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost" title="Editar" tabIndex={-1}>
                  Editar
                </button>
              </Link>
            </div>
            <div className={`mg-action-slot${selectedItems.length > 0 ? " is-visible" : ""}`} style={{ "--slot-width": "84px" }} aria-hidden={selectedItems.length === 0}>
              <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-ghost tb-btn-danger" onClick={handleDeleteSelected} title="Excluir" tabIndex={selectedItems.length > 0 ? 0 : -1}>
                <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Excluir
              </button>
            </div>
          </div>

          <div className="mg-action-bar__end">
            <div className="mg-action-bar__tools mg-action-bar__tools--visible">
              <MgDesktopSearch
                value={searchInput}
                onValueChange={setSearchInput}
                hasFilter={Boolean(searchTerm)}
                onClear={() => { setSearchInput(""); setSearchTerm(""); setCurrentPage(1); }}
                results={resultadosPesquisa.items}
                resultsTotal={resultadosPesquisa.total}
                titleField="titulo"
                codeField="codigo"
                detailFields={CAMPOS_RESULTADO_PESQUISA}
                getFieldValue={(record, key) => record?.[key]}
                onSelectResult={(record) => { setSearchInput(record.numero_animal); setSearchTerm(record.numero_animal); setCurrentPage(1); }}
                onApplyAll={() => { setSearchTerm(searchInput.trim()); setCurrentPage(1); }}
              />
            </div>
            <div className="relative">
              <MgSpeedDialMenu
                open={moreOpen}
                onOpenChange={setMoreOpen}
                items={[
                  { id: "atualizar", label: "Atualizar", icon: RefreshCw, onClick: () => refetch() },
                  { id: "exportar", label: "Exportar CSV", icon: Download, onClick: exportarCSV },
                  { id: "importar", label: "Importar CSV", icon: Upload, onClick: () => importInputRef.current?.click() },
                  { id: "modelo", label: "Baixar modelo CSV", icon: FileSpreadsheet, onClick: baixarModelo },
                ]}
              />
              <input ref={importInputRef} type="file" accept=".csv,.txt" className="sr-only" tabIndex={-1} aria-label="Importar CSV" onChange={handleFileUpload} />
            </div>
          </div>
        </div>
      </div>

      {/* Faixa de pílulas de filtro + configuração de colunas (ModeloBase1). */}
      <div className="mak-mother-page__panel-strip" data-mak-region="panel-strip">
        <MgTablePanelStrip onConfigColumns={() => setShowConfigColunas(true)}>
          <MakFilterRail
            hasActiveFilters={hasActiveFilters}
            onClear={limparFiltros}
            onConfigureFilters={() => setShowConfigFiltros(true)}
          >
            {filtrosOrdem.filter((id) => filtrosVisiveis.includes(id)).map(renderQuickFilter)}
          </MakFilterRail>
        </MgTablePanelStrip>
      </div>

      <div className="d17b-list-body">
        <MgFilterPanel
          open={showFilters}
          values={filterDraft}
          onChange={(key, next) => setFilterDraft((current) => ({ ...current, [key]: next }))}
          onClose={() => setShowFilters(false)}
          onClear={limparFiltros}
          onApply={aplicarFiltrosPainel}
          textFields={CAMPOS_TEXTO_PAINEL}
          dateFields={CAMPOS_DATA_PAINEL}
          selectFields={CAMPOS_SELECAO_PAINEL}
        />

      {/* Tabela */}
      <Card className="d17b-table-card">
        <CardContent className="p-0">
          <div className="mg-view-panel emp-table-root emp-table-shell emp-table-body-scroll d17c-table-scroll max-h-[500px]">
            <Table className="emp-table-pro d17c-data-table" style={{ minWidth: `${tableMinWidth}px` }}>
              <colgroup>
                {colunasOrdenadas.map((coluna) => <col key={coluna.id} style={{ width: `${getColumnWidth(coluna.id)}px` }} />)}
              </colgroup>
              <TableHeader>
                <TableRow className="bg-white border-b">
                  {colunasOrdenadas.map((coluna) => {
                    if (coluna.id === 'selecao') {
                      return (
                        <TableHead key="selecao" className="text-xs !p-0 text-center">
                          <MakTableSelectCheck
                            checked={selectedItems.length === pesagensFiltradas.length && pesagensFiltradas.length > 0}
                            indeterminate={selectedItems.length > 0 && selectedItems.length < pesagensFiltradas.length}
                            onChange={toggleSelectAll}
                            ariaLabel="Selecionar todos os registros filtrados"
                          />
                        </TableHead>
                      );
                    }
                    if (coluna.id === 'acoes') {
                      return <TableHead key="acoes" className="text-xs !p-0 text-center"></TableHead>;
                    }
                    const isRight = coluna.align === 'right';
                    return (
                      <MakTh
                        key={coluna.id}
                        label={coluna.label}
                        className={isRight ? "text-right" : ""}
                        sortDirection={sortConfig.key === coluna.id ? sortConfig.direction : null}
                        onSort={coluna.sortable ? () => handleSort(coluna.id) : undefined}
                        menuOpen={colunaMenuAberto === coluna.id}
                        onOpenMenu={() => setColunaMenuAberto(colunaMenuAberto === coluna.id ? null : coluna.id)}
                        menu={{
                          onFechar: () => setColunaMenuAberto(null),
                          valorFiltro: filtrosColuna[coluna.id] || "",
                          filterType: getColumnFilterType(coluna.id),
                          listOptions: [...new Set(pesagens.map((item) => getPesagemColumnValue(item, coluna.id, documentCounts)).filter((value) => value !== null && value !== undefined && value !== ""))],
                          onFiltrar: (value) => { setFiltrosColuna((current) => ({ ...current, [coluna.id]: value })); setCurrentPage(1); },
                          onOcultar: () => ocultarColuna(coluna.id),
                        }}
                      />
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={20} className="text-center py-8 text-xs text-slate-400">Carregando...</TableCell>
                  </TableRow>
                ) : pesagensPaginadas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={20} className="text-center py-8 text-xs text-slate-400">
                      <FileSpreadsheet className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      Nenhuma pesagem encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  pesagensPaginadas.map((p, idx) => (
                    <TableRow
                      key={p.id}
                      className={`${makRowClass(idx)} emp-table-data-row${selectedItems.includes(p.id) ? " emp-row-selected" : ""}`}
                      aria-selected={selectedItems.includes(p.id)}
                      tabIndex={0}
                      onClick={(event) => handleRowSelection(p.id, event)}
                      onKeyDown={(event) => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedItems((current) => current.length === 1 && current[0] === p.id ? [] : [p.id]);
                        }
                      }}
                    >
                      {colunasOrdenadas.map((coluna) => {
                        if (coluna.id === 'selecao') {
                          return (
                            <TableCell key="selecao" className="text-xs !p-0 text-center">
                              <MakTableSelectCheck
                                checked={selectedItems.includes(p.id)}
                                ariaLabel={`Selecionar pesagem ${p.numero_animal || p.id}`}
                                onChange={(checked) => {
                                  setSelectedItems(prev => checked ? [...prev, p.id] : prev.filter(id => id !== p.id));
                                }}
                              />
                            </TableCell>
                          );
                        }
                        if (coluna.id === 'acoes') {
                          return (
                            <TableCell key="acoes" className="text-xs !p-0 text-center">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <MoreVertical className="w-3.5 h-3.5 text-slate-600" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                 <DropdownMenuItem asChild className="text-xs">
                                   <Link to={createPageUrl(`LancamentoPesagensIndividuais?editar=${p.id}`)}>
                                     Editar
                                   </Link>
                                 </DropdownMenuItem>
                                 <DropdownMenuItem onClick={() => {
                                   setSelectedItems([p.id]);
                                   setShowEditarLote(true);
                                 }} className="text-xs">
                                   Alterar Lote
                                 </DropdownMenuItem>
                                 <DropdownMenuItem onClick={() => handleExcluirPesagem(p.id)} className="text-xs text-red-600">
                                   Excluir
                                 </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          );
                        }
                        if (coluna.id === 'data_pesagem') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3">{fmtDateBR(p.data_pesagem)}</TableCell>;
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
                            </TableCell>
                          );
                        }
                        if (coluna.id === 'motivo_saida') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3">{p.motivo_saida || '-'}</TableCell>;
                        }
                        if (coluna.id === 'numero_animal') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3 font-semibold">{p.numero_animal}</TableCell>;
                        }
                        if (coluna.id === 'sexo') {
                          return (
                            <TableCell key={coluna.id} className="text-xs py-2 px-3">
                              {p.sexo === 'M' ? 'Macho' : p.sexo === 'F' ? 'Fêmea' : '-'}
                            </TableCell>
                          );
                        }
                        if (coluna.id === 'valor_pago_cabeca') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3 text-right font-mono">{p.valor_pago_cabeca != null ? fmtCurrency(p.valor_pago_cabeca) : '-'}</TableCell>;
                        }
                        if (coluna.id === 'origem_animal') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3">{p.origem_animal || '-'}</TableCell>;
                        }
                        if (coluna.id === 'comprador') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3">{p.comprador || '-'}</TableCell>;
                        }
                        if (coluna.id === 'destino_venda') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3">{p.destino_venda || '-'}</TableCell>;
                        }
                        if (coluna.id === 'valor_venda_total') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3 text-right font-mono">{p.valor_venda_total != null ? fmtCurrency(p.valor_venda_total) : '-'}</TableCell>;
                        }
                        if (coluna.id === 'valor_arroba') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3 text-right font-mono">{p.valor_arroba != null ? fmtCurrency(p.valor_arroba) : '-'}</TableCell>;
                        }
                        if (coluna.id === 'quantidade_arrobas') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3 text-right font-mono">{p.quantidade_arrobas != null ? fmtNum(p.quantidade_arrobas) : '-'}</TableCell>;
                        }
                        if (coluna.id === 'frigorifico') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3">{p.frigorifico || '-'}</TableCell>;
                        }
                        if (coluna.id === 'embarque_nome') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3">{p.embarque_nome || '-'}</TableCell>;
                        }
                        if (coluna.id === 'documento_tipo') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3">{p.documento_tipo || '-'}</TableCell>;
                        }
                        if (coluna.id === 'documento_numero') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3">{p.documento_numero || '-'}</TableCell>;
                        }
                        if (coluna.id === 'motorista_nome') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3">{p.motorista_nome || '-'}</TableCell>;
                        }
                        if (coluna.id === 'placa_carreta') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3 uppercase">{p.placa_carreta || '-'}</TableCell>;
                        }
                        if (coluna.id === 'doc_qtd') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3 text-center">{p.documento_embarque_id ? fmtInt(docCounts[p.documento_embarque_id] || 0) : '-'}</TableCell>;
                        }
                        if (coluna.id === 'raca') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3">{p.raca || '-'}</TableCell>;
                        }
                        if (coluna.id === 'era') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3">{p.era || '-'}</TableCell>;
                        }
                        if (coluna.id === 'peso') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3 text-right font-mono font-semibold">{fmtNum(p.peso)}</TableCell>;
                        }
                        if (coluna.id === 'nome_lote') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3">{p.nome_lote || '-'}</TableCell>;
                        }
                        if (coluna.id === 'nome_apartacao') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3">{p.nome_apartacao || '-'}</TableCell>;
                        }
                        if (coluna.id === 'dias') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3 text-right font-mono">{p.dias != null ? fmtInt(p.dias) : '-'}</TableCell>;
                        }
                        if (coluna.id === 'ganho') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3 text-right font-mono">{p.ganho != null ? fmtNum(p.ganho) : '-'}</TableCell>;
                        }
                        if (coluna.id === 'gmd') {
                          return (
                            <TableCell key={coluna.id} className={`text-xs py-2 px-3 text-right font-mono ${p.gmd && p.gmd > 0 ? 'text-emerald-600' : p.gmd && p.gmd < 0 ? 'text-red-600' : ''}`}>
                              {p.gmd != null ? fmtNum(p.gmd, 3) : '-'}
                            </TableCell>
                          );
                        }
                        if (coluna.id === 'marca') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3">{p.marca || '-'}</TableCell>;
                        }
                        if (coluna.id === 'observacao') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3">{p.observacao || '-'}</TableCell>;
                        }
                        return <TableCell key={coluna.id} className="text-xs py-2 px-3">-</TableCell>;
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="d17c-table-footer">
            <span><strong>Selecionados:</strong> {fmtInt(selectedItems.length)}</span>
            <span><strong>Listados:</strong> {fmtInt(pesagensPaginadas.length)}</span>
            <span><strong>Filtrados:</strong> {fmtInt(pesagensFiltradas.length)}</span>
            <span><strong>Totais:</strong> {fmtInt(pesagens.length)}</span>
            <span className="d17c-table-footer__metric"><strong>Animais únicos:</strong> {fmtInt(stats.animaisUnicos)}</span>
            <span className="d17c-table-footer__metric"><strong>Animais ativos:</strong> {fmtInt(stats.animaisAtivos)}</span>
            <span className="d17c-table-footer__metric"><strong>Peso atual estimado:</strong> {fmtNum(stats.pesoAtual)}</span>
            <span className="d17c-table-footer__metric"><strong>Média da última pesagem:</strong> {fmtNum(stats.pesoMedioAtual)}</span>
            <div className="d17c-table-footer__pagination">
              <Select value={String(itemsPerPage)} onValueChange={(value) => { setItemsPerPage(Number(value)); setCurrentPage(1); }}>
                <SelectTrigger aria-label="Itens por página"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[25, 50, 100, 200].map((amount) => <SelectItem key={amount} value={String(amount)}>{amount}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" variant="ghost" size="icon" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => page - 1)} aria-label="Página anterior"><ChevronLeft aria-hidden="true" /></Button>
              <span>{fmtInt(Math.min(currentPage, Math.max(totalPages, 1)))}/{fmtInt(Math.max(totalPages, 1))}</span>
              <Button type="button" variant="ghost" size="icon" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((page) => page + 1)} aria-label="Próxima página"><ChevronRight aria-hidden="true" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>

      <Dialog
        open={deleteRequest.open}
        onOpenChange={(open) => {
          if (!deleteMutation.isPending) setDeleteRequest((current) => ({ ...current, open }));
        }}
      >
        <DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact d17e-confirm-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Trash2 className="h-4 w-4 text-red-600" aria-hidden="true" />
              Excluir {deleteRequest.ids.length === 1 ? "registro" : "registros"}
            </DialogTitle>
          </DialogHeader>
          <p className="d17e-confirm-dialog__copy">
            {deleteRequest.ids.length === 1
              ? deletePlan.cascades.some((cascade) => cascade.blocked)
                ? "Este cadastro possui histórico e não pode ser excluído. Cancele apenas um evento ou inative o animal para preservar a rastreabilidade."
                : "Este lançamento será excluído. O cadastro e os demais registros do animal serão preservados."
              : deletePlan.cascades.some((cascade) => cascade.blocked)
                ? "A seleção contém cadastro com histórico. Remova os cadastros da seleção ou inative os animais; o histórico não será apagado."
                : `${fmtInt(deleteRequest.ids.length)} lançamentos serão excluídos.`}
          </p>
          <DialogFooter className="d17b-standard-dialog__footer d17e-confirm-dialog__footer">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteRequest({ open: false, ids: [] })}
              disabled={deleteMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="emp-toolbar-btn-delete"
              onClick={() => deleteMutation.mutate(deleteRequest.ids)}
              disabled={deleteMutation.isPending || deleteRequest.ids.length === 0 || deletePlan.cascades.some((cascade) => cascade.blocked)}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição em Lote */}
      <Dialog open={showEditarLote} onOpenChange={setShowEditarLote}>
        <DialogContent className="d17b-standard-dialog d17b-standard-dialog--medium">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              Editar {fmtInt(selectedItems.length)} Registro(s) em Lote
            </DialogTitle>
          </DialogHeader>
          
          <div className="d17b-standard-dialog__body space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded p-2">
              <p className="text-xs text-blue-800">Apenas data, apartação e lote podem ser alterados em lote. Sexo, raça, era e marca pertencem ao cadastro atual; fatos históricos não são reescritos.</p>
            </div>

            {progressoEdicao.show && (
              <div className="bg-emerald-50 border border-emerald-200 rounded p-3">
                <div className="flex justify-between text-xs text-emerald-800 mb-1">
                  <span className="font-medium">{progressoEdicao.texto}</span>
                  <span className="font-bold">{Math.round((progressoEdicao.current / progressoEdicao.total) * 100)}%</span>
                </div>
                <div className="w-full bg-emerald-200 rounded-full h-2">
                  <div className="bg-emerald-600 h-2 rounded-full transition-all" style={{ width: `${(progressoEdicao.current / progressoEdicao.total) * 100}%` }} />
                </div>
                <div className="text-[10px] text-emerald-600 mt-1 text-center">
                  {fmtInt(progressoEdicao.current)} de {fmtInt(progressoEdicao.total)} concluídos
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Data</Label>
                <MakDateControl
                  value={edicaoLote.data_pesagem}
                  onChange={(e) => setEdicaoLote({ ...edicaoLote, data_pesagem: e.target.value })}
                  ariaLabel="Data da edição em lote"
                />
              </div>

              <div className="border-t pt-2 mt-2">
                <p className="text-xs font-semibold text-slate-600 mb-2">Apartação e Lote</p>
                
                <div className="space-y-1">
                  <Label className="text-xs">Apartação</Label>
                  <Select value={edicaoLote.apartacao || '__unchanged__'} onValueChange={(v) => setEdicaoLote({ ...edicaoLote, apartacao: v === '__unchanged__' ? '' : v, lote: "" })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Não alterar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unchanged__" className="text-xs">Não alterar</SelectItem>
                      {apartacoesData.map(a => (
                        <SelectItem key={a.id} value={a.id} className="text-xs">{a.nome_apartacao}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 mt-2">
                  <Label className="text-xs">Lote</Label>
                  <Select 
                    value={edicaoLote.lote || '__unchanged__'} 
                    onValueChange={(v) => setEdicaoLote({ ...edicaoLote, lote: v === '__unchanged__' ? '' : v })}
                    disabled={!edicaoLote.apartacao}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder={edicaoLote.apartacao ? "Selecione o lote" : "Selecione apartação primeiro"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unchanged__" className="text-xs">Não alterar</SelectItem>
                      {lotesEdicaoFiltrados.map(l => (
                      <SelectItem key={l.id} value={l.id} className="text-xs">{l.nome_lote} (Peso: {fmtNum(l.peso_minimo)} a {fmtNum(l.peso_maximo)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setShowEditarLote(false)} size="sm" className="h-7 text-xs" disabled={progressoEdicao.show}>
                Cancelar
              </Button>
              <Button onClick={confirmarEdicaoLote} size="sm" className="emp-toolbar-btn emp-toolbar-btn-save" disabled={progressoEdicao.show}>
                {progressoEdicao.show ? 'Atualizando...' : `Atualizar ${fmtInt(selectedItems.length)}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showConfigColunas ? (
        <MakColumnConfigDialog
          open={showConfigColunas}
          onOpenChange={setShowConfigColunas}
          columns={COLUNAS_DISPONIVEIS}
          order={colunasOrdem}
          visible={colunasVisiveis}
          onApply={aplicarConfiguracaoColunas}
        />
      ) : null}

      {showConfigFiltros ? (
        <MakColumnConfigDialog
          open={showConfigFiltros}
          onOpenChange={setShowConfigFiltros}
          title="Configurar campos de filtros"
          description="Escolha os filtros exibidos na barra e organize a ordem de uso."
          availableLabel="Campos disponíveis"
          usedLabel="Campos em uso"
          usedCountSingular="filtro"
          usedCountPlural="filtros"
          availableSearchPlaceholder="Procurar campo"
          usedSearchPlaceholder="Procurar campo em uso"
          emptyAvailableMessage="Nenhum campo disponível."
          emptyUsedMessage="Nenhum filtro em uso."
          ItemIcon={ListFilter}
          columns={FILTROS_DISPONIVEIS}
          order={filtrosOrdem}
          visible={filtrosVisiveis}
          onApply={aplicarConfiguracaoFiltros}
        />
      ) : null}

      {/* Dialog de Vinculação de Lotes */}
      <Dialog open={showVincularLotes} onOpenChange={setShowVincularLotes}>
        <DialogContent className="d17b-standard-dialog d17b-standard-dialog--medium">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
              Lotes Encontrados no Sistema
            </DialogTitle>
          </DialogHeader>
          
          <div className="d17b-standard-dialog__body space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded p-3">
              <p className="text-xs text-amber-800">
                ⚠️ Foram encontrados lotes no arquivo que já existem no sistema. 
                Selecione quais deseja vincular. <strong>Registros de lotes não selecionados serão removidos da importação.</strong>
              </p>
            </div>
            
            <div className="max-h-64 overflow-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-10"><MakTableSelectCheck checked={lotesParaVincular.length > 0 && lotesParaVincular.every((lote) => vincularLotesSelecionados[importLotKey(lote)])} ariaLabel="Selecionar todos os lotes encontrados" onChange={(checked) => setVincularLotesSelecionados(Object.fromEntries(lotesParaVincular.map((lote) => [importLotKey(lote), checked])))} /></TableHead>
                    <TableHead className="text-xs">Lote</TableHead>
                    <TableHead className="text-xs">Apartação</TableHead>
                    <TableHead className="text-xs text-right">Qtd. Registros</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lotesParaVincular.map((lote) => {
                    const key = importLotKey(lote);
                    return (
                      <TableRow key={key} className="hover:bg-gray-50">
                        <TableCell className="text-xs py-1 border border-gray-300">
                          <MakTableSelectCheck
                            checked={vincularLotesSelecionados[key] || false}
                            ariaLabel={`Vincular lote ${lote.nome_lote}`}
                            onChange={(checked) => {
                              setVincularLotesSelecionados(prev => ({
                                ...prev,
                                [key]: checked
                              }));
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 font-semibold">{lote.nome_lote}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300">{lote.nome_apartacao}</TableCell>
                        <TableCell className="text-xs py-1 border border-gray-300 text-right">{fmtInt(lote.quantidade)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            
            <div className="text-xs text-slate-600">
              {fmtInt(Object.values(vincularLotesSelecionados).filter(v => v).length)} de {fmtInt(lotesParaVincular.length)} lotes selecionados para vincular
            </div>
          </div>

          <DialogFooter className="d17b-standard-dialog__footer">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowVincularLotes(false);
                setImportData([]);
                setLotesParaVincular([]);
                setImportResolucaoCadastros(RESOLUCAO_CADASTROS_VAZIA);
                setCriarCadastrosNaImportacao(false);
                toast.info('Importação cancelada');
              }}
            >
              Cancelar Importação
            </Button>
            <Button onClick={confirmarVinculacaoLotes} className="emp-toolbar-btn emp-toolbar-btn-save">
              Continuar com Importação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Importação */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="d17b-standard-dialog d17b-standard-dialog--large overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Importar Pesagens Individuais
            </DialogTitle>
          </DialogHeader>
          
          <div className="d17b-standard-dialog__body flex-1 overflow-auto space-y-4">
            {/* Seleção de Tipo de Manejo */}
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="p-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Tipo de Movimentação *</Label>
                    <Select value={tipoManejoImport} onValueChange={(v) => { setTipoManejoImport(v); setMotivoSaidaImport(''); setDestinoVendaImport(''); }}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cadastro">Cadastro (Novo Animal)</SelectItem>
                        <SelectItem value="Manejo">Manejo (Pesagem)</SelectItem>
                        <SelectItem value="Saída">Saída (Venda/Morte/Doação)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {tipoManejoImport === 'Saída' && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Motivo da Saída *</Label>
                        <Select value={motivoSaidaImport || undefined} onValueChange={setMotivoSaidaImport}>
                          <SelectTrigger className="h-8 text-xs">
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
                      </div>

                      {motivoSaidaImport === 'Venda' && (
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">Destino da Venda</Label>
                          <Input
                            value={destinoVendaImport}
                            onChange={(e) => setDestinoVendaImport(e.target.value)}
                            placeholder="Ex: Fazenda XYZ"
                            className="h-8 text-xs"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="bg-white border border-emerald-300 rounded p-2">
                  <p className="text-xs text-emerald-800">
                    ℹ️ <strong>{tipoManejoImport}:</strong> {
                      tipoManejoImport === 'Cadastro' 
                        ? 'Novos animais serão marcados como ATIVOS (não calcula ganho de peso)' 
                        : tipoManejoImport === 'Saída'
                        ? 'Animais serão marcados como INATIVOS automaticamente'
                        : 'Pesagem periódica com cálculo de ganho de peso'
                    }
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Resumo */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="bg-emerald-50">
                <CardContent className="p-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <div className="text-xs text-emerald-600">Registros Válidos</div>
                    <div className="text-lg font-bold text-emerald-800">{fmtInt(totalLinhasImportaveis)}</div>
                  </div>
                </CardContent>
              </Card>
              {importErrosExibidos.length > 0 && (
                <Card className="bg-red-50">
                  <CardContent className="p-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <div>
                      <div className="text-xs text-red-600">Erros</div>
                      <div className="text-lg font-bold text-red-800">{fmtInt(importErrosExibidos.length)}</div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Cadastros não encontrados (marca/raça): nunca criados em silêncio */}
            {totalCadastrosDesconhecidos > 0 && (
              <Card className="border-amber-200" data-import-unknown-registries>
                <CardHeader className="py-2 px-3 bg-amber-50">
                  <CardTitle className="text-sm text-amber-800">Cadastros não encontrados ({fmtInt(totalCadastrosDesconhecidos)})</CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                  <p className="text-xs text-slate-600">
                    Estes valores do arquivo não existem nos cadastros mestres. As {fmtInt(linhasPendentesCadastro.length)} linha(s) que os usam só entram na importação se você optar por criá-los.
                  </p>
                  {importResolucaoCadastros.desconhecidos.marcas.length > 0 && (
                    <div className="text-xs"><strong>Marcas:</strong> {importResolucaoCadastros.desconhecidos.marcas.join(', ')}</div>
                  )}
                  {importResolucaoCadastros.desconhecidos.racas.length > 0 && (
                    <div className="text-xs"><strong>Raças:</strong> {importResolucaoCadastros.desconhecidos.racas.join(', ')}</div>
                  )}
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-800">
                    <input
                      type="checkbox"
                      checked={criarCadastrosNaImportacao}
                      disabled={!podeCriarCadastros || isImporting}
                      onChange={(e) => setCriarCadastrosNaImportacao(e.target.checked)}
                      aria-label="Criar estes cadastros ao importar"
                    />
                    Criar estes cadastros ao importar
                  </label>
                  {!podeCriarCadastros && (
                    <p className="text-xs text-amber-700">Seu perfil não pode criar cadastros (permissão registry.write). Peça a um gestor para cadastrá-los antes de importar.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Erros */}
            {importErrosExibidos.length > 0 && (
              <Card className="border-red-200">
                <CardHeader className="py-2 px-3 bg-red-50">
                  <CardTitle className="text-sm text-red-700">Erros na Importação</CardTitle>
                </CardHeader>
                <CardContent className="p-2 max-h-32 overflow-auto">
                  {importErrosExibidos.slice(0, 10).map((err, idx) => (
                    <div key={idx} className="text-xs text-red-600 py-1">
                      Linha {err.linha}: {err.erro}
                    </div>
                  ))}
                  {importErrosExibidos.length > 10 && (
                    <div className="text-xs text-red-500 font-semibold">... e mais {importErrosExibidos.length - 10} erros</div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Preview */}
            {importData.length > 0 && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">Preview (primeiros 20 registros)</Label>
                <div className="overflow-auto max-h-64 border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Data</TableHead>
                        <TableHead className="text-xs">Animal</TableHead>
                        <TableHead className="text-xs">Sexo</TableHead>
                        <TableHead className="text-xs">Marca</TableHead>
                        <TableHead className="text-xs">Raça</TableHead>
                        <TableHead className="text-xs text-right">Peso</TableHead>
                        <TableHead className="text-xs">Lote</TableHead>
                        <TableHead className="text-xs">Apartação</TableHead>
                        <TableHead className="text-xs text-right">GMD</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importData.slice(0, 20).map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs">{fmtDateBR(item.data_pesagem)}</TableCell>
                          <TableCell className="text-xs font-medium">{item.numero_animal}</TableCell>
                          <TableCell className="text-xs">{item.sexo}</TableCell>
                          <TableCell className="text-xs">{item.marca || '-'}</TableCell>
                          <TableCell className="text-xs">{item.raca || '-'}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{fmtNum(item.peso)}</TableCell>
                          <TableCell className="text-xs">{item.nome_lote}</TableCell>
                          <TableCell className="text-xs">{item.nome_apartacao}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{item.gmd != null ? fmtNum(item.gmd, 3) : '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Progress */}
            {isImporting && (
              <div className="space-y-2 bg-blue-50 border border-blue-200 rounded p-3">
                <div className="flex justify-between text-xs text-slate-700">
                  <span className="font-medium">{importProgressText || 'Importando...'}</span>
                  <span className="font-bold text-blue-700">{importProgress}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div className="bg-emerald-600 h-3 rounded-full transition-all" style={{ width: `${importProgress}%` }} />
                </div>
                <div className="text-[10px] text-slate-500 text-center">
                  Aguarde, não feche esta janela...
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="d17b-standard-dialog__footer">
            <Button variant="outline" onClick={() => {
              setShowImportDialog(false);
              setTipoManejoImport('Manejo');
              setMotivoSaidaImport('');
              setDestinoVendaImport('');
            }} disabled={isImporting}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarImportacao}
              disabled={isImporting || totalLinhasImportaveis === 0 || (tipoManejoImport === 'Saída' && !motivoSaidaImport) || (criarCadastrosNaImportacao && !podeCriarCadastros)}
              className="emp-toolbar-btn emp-toolbar-btn-save"
            >
              {isImporting ? 'Importando...' : `Importar ${fmtInt(totalLinhasImportaveis)} Registros`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModeloBase1PageContainer>
  );
}
