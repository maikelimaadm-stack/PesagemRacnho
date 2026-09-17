import React, { useMemo, useState } from "react";
import MakTh, { makRowClass } from "@/components/mak/MakTh";
import { isMakColumnFilterActive } from "@/components/mak/MakColumnMenu";
import MakColumnConfigDialog from "@/components/mak/MakColumnConfigDialog";
import MakDateControl from "@/components/mak/MakDateControl";
import MakFilterRail from "@/components/mak/MakFilterRail";
import MakFilterPill from "@/components/mak/MakFilterPill";
import MakTableSelectCheck from "@/components/mak/MakTableSelectCheck";
import MgDesktopSearch from "@/components/mak/MgDesktopSearch";
import MgSpeedDialMenu from "@/components/mak/MgSpeedDialMenu";
import MgTablePanelStrip from "@/components/mak/MgTablePanelStrip";
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
  Upload, Search, Trash2, FileSpreadsheet, Download, FileDown,
  ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, X, Scale,
  Settings, MoreVertical, Layers, ListFilter, ChevronLeft, ChevronRight
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import { fmtDateBR, fmtInt, fmtNum } from "@/components/common/formatNumber";
import { TEMPLATE_KINDS, buildImportTemplateCsv } from "@/modules/import/domain/spreadsheetTemplate";
import { buildDeletionPlan } from "@/modules/animals/domain/animalHistory";
import { deleteEntriesRespectingHistory } from "@/modules/animals/application/animalHistoryService";
import { useAuth } from "@/components/auth/useAuth";
import { avg as avgValues, sum as sumValues, weightedGmd } from "@/modules/reporting/domain/aggregateEngine";
import { normalizeText } from "@/modules/reporting/domain/filterEngine";
import { formatCell } from "@/modules/reporting/domain/reportFormatting";
import { EVENT_COLUMNS, RELATION_COLUMN_IDS } from "@/modules/reporting/definitions/columns/eventColumns";
import { SENSITIVITY } from "@/modules/reporting/domain/columnDefinition";
import { relationPopulation, resolveEventColumn } from "@/modules/reporting/application/relationPopulation";
import { loadEventRows } from "@/modules/reporting/infrastructure/reportSources/eventSource";
import { EXPORT_PROFILES } from "@/modules/weighing/export/weighingExportContract";
import { exportWeighingCsv } from "@/modules/weighing/export/weighingExportService";
import { downloadCsvFile } from "@/modules/weighing/export/csvDownload";

// Importação (17/09/2026): a Relação não lê mais arquivo nenhum. "Importar CSV" leva ao
// assistente de Importação (src/pages/Importacao.jsx), onde a leitura, o mapeamento de
// colunas, a escolha de tipo/lote, a conciliação (dry-run) e a gravação acontecem sobre o
// motor de src/modules/import. Aqui ficam só a exportação e o modelo de planilha.

// Colunas da Relação = ColumnDefinition compartilhada do grão EVENT (mesma definição dos
// relatórios): filtro, ordenação e formatação vêm do núcleo de reporting.

const COLUNAS_DISPONIVEIS = [
  { id: "selecao", label: "Seleção", default: true, fixo: true },
  { id: "acoes", label: "Ações", default: true, fixo: true },
  ...RELATION_COLUMN_IDS.map((id) => {
    const { column } = resolveEventColumn(id);
    return { id, label: column.label, default: column.defaultVisible, sortable: column.sortable, align: column.align };
  }),
];

// Valores comerciais (preço, valor, arrobas): só perfis com commercial.values os veem, filtram
// ou exportam; as demais colunas comerciais (comprador, destino, frigorífico) são texto operacional.
// Sensibilidade declarada nas colunas canônicas: valores, arrobas, carcaça e rendimento.
const COMMERCIAL_VALUE_COLUMN_IDS = new Set(EVENT_COLUMNS.filter((column) => column.sensitive === SENSITIVITY.COMMERCIAL).map((column) => column.id));



// Controles de filtro da tela conhecem texto/número/data; enum e entidade usam o controle de texto.
const getColumnFilterType = (id) => {
  const type = resolveEventColumn(id)?.filterType ?? "text";
  return type === "number" || type === "date" ? type : "text";
};
const COLUMN_WIDTHS = {
  // Colunas de controle não recebem a folga padrão das colunas de texto:
  // o checkbox fica centralizado, com apenas a área clicável necessária.
  selecao: 36,
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
const getPesagemColumnValue = (pesagem, columnId) => resolveEventColumn(columnId)?.valueOf(pesagem);

const CAMPOS_RESULTADO_PESQUISA = [
  { key: "marca", label: "Marca" },
  { key: "data", label: "Data" },
  { key: "peso", label: "Peso" },
  { key: "lote", label: "Lote" },
  { key: "apartacao", label: "Apartação" },
];
const textoContem = (value, term) => normalizeText(value).includes(normalizeText(term));

export default function PesagensIndividuais() {
  const empresaSelecionadaId = ensureEmpresaId();
  const queryClient = useQueryClient();

  // Estados
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'data_pesagem', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [selectedItems, setSelectedItems] = useState([]);
  const [deleteRequest, setDeleteRequest] = useState({ open: false, ids: [] });
  const [showQuickSearch, setShowQuickSearch] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [colunaMenuAberto, setColunaMenuAberto] = useState(null);
  const [filtrosColuna, setFiltrosColuna] = useState({});
  const [showConfigColunas, setShowConfigColunas] = useState(false);
  const navigate = useNavigate();
  const auth = useAuth();
  // Fora do AuthGate (harness de UI) não há sessão: nada é restringido; o serviço repete a checagem.
  const pode = (action) => (auth ? Boolean(auth.can?.(action)) : true);
  const podeLancar = pode('launch.use');
  const podeEditar = pode('weighing.edit');
  const podeImportar = pode('weighing.write');
  const podeExportar = pode('reports.export');
  const podeVerValores = pode('commercial.values');
  const colunasPermitidas = useMemo(
    () => COLUNAS_DISPONIVEIS.filter((coluna) => podeVerValores || !COMMERCIAL_VALUE_COLUMN_IDS.has(coluna.id)),
    [podeVerValores],
  );

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
    .map(id => colunasPermitidas.find(c => c.id === id))
    .filter(c => c && colunasVisiveis.includes(c.id));
  const tableMinWidth = colunasOrdenadas.reduce((total, coluna) => total + getColumnWidth(coluna.id), 0);

  // Fetch pesagens
  const { data: pesagens = [], isLoading, refetch } = useQuery({
    queryKey: ['pesagens-individuais', empresaSelecionadaId],
    queryFn: async () => {
      // Mesma transformação dos relatórios (deduplicação, nomes de cadastro, doc_qtd).
      return (await loadEventRows({ empresaId: empresaSelecionadaId })).rows;
    },
    enabled: !!empresaSelecionadaId,
  });



  // Valores únicos para filtros e autocomplete
  const lotesUnicos = [...new Set(pesagens.map(p => p.nome_lote).filter(Boolean))].sort();
  const apartacoesUnicas = [...new Set(pesagens.map(p => p.nome_apartacao).filter(Boolean))].sort();
  const marcasExistentes = [...new Set(pesagens.map(p => p.marca).filter(Boolean))].sort();
  const racasExistentes = [...new Set(pesagens.map(p => p.raca).filter(Boolean))].sort();
  const erasExistentes = [...new Set(pesagens.map(p => p.era).filter(Boolean))].sort();

  // Filtrar e ordenar
  const pesagensFiltradas = useMemo(() => {
    // Motor compartilhado: pesquisa + filtros de coluna (AND) e ordenação com ausentes por último.
    return relationPopulation(pesagens, { searchTerm, filtrosColuna, sortConfig });
  }, [pesagens, searchTerm, filtrosColuna, sortConfig]);


  // Paginação
  const totalPages = Math.ceil(pesagensFiltradas.length / itemsPerPage);
  const pesagensPaginadas = pesagensFiltradas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Estatísticas
  const stats = useMemo(() => {
    // Motor canônico: ausente ≠ 0 (sem valor → null, a tela mostra "-"); animais únicos por
    // animal_id (fallback legado número+marca só para registros sem id); GMD de grupo ponderado.
    const total = pesagensFiltradas.length;
    const latestByAnimal = new Map();
    for (const entry of pesagensFiltradas) {
      const key = entry.animal_id || `${String(entry.numero_animal || '').trim().toUpperCase()}::${String(entry.marca || '').trim().toUpperCase()}`;
      const current = latestByAnimal.get(key);
      if (!current || String(entry.data_pesagem || '') > String(current.data_pesagem || '')) latestByAnimal.set(key, entry);
    }
    const ativos = [...latestByAnimal.values()].filter((entry) => (entry.status_animal || 'Ativo') === 'Ativo');
    return {
      total,
      animaisUnicos: latestByAnimal.size,
      animaisAtivos: ativos.length,
      pesoTotal: sumValues(pesagensFiltradas, 'peso').value,
      pesoMedio: avgValues(pesagensFiltradas, 'peso').value,
      pesoAtual: sumValues(ativos, 'peso').value,
      pesoMedioAtual: avgValues(ativos, 'peso').value,
      gmdMedio: weightedGmd(pesagensFiltradas).value,
      ganhoMedio: avgValues(pesagensFiltradas, 'ganho').value,
      diasMedio: avgValues(pesagensFiltradas, 'dias').value,
    };
  }, [pesagensFiltradas]);



  // Handlers
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
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
    setFiltrosColuna({});
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(searchTerm || Object.values(filtrosColuna).some(isMakColumnFilterActive));

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

  // Modelo só com o que se digita; peso anterior, dias, ganho e GMD são calculados na importação.
  const baixarModelo = () => {
    const { content, fileName } = buildImportTemplateCsv(TEMPLATE_KINDS.PESAGENS);
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Modelo baixado!');
  };

  // Exportação pelo contrato de colunas de pesagens (src/modules/weighing/export): a população é
  // a mesma da tela (pesquisa, filtros e ordenação, todas as páginas). O relatório leva as colunas
  // visíveis na ordem da tela (Tipo e Motivo da saída sempre; valores só com commercial.values);
  // a reimportação leva o contrato técnico fixo, sem derivados. O serviço repete reports.export.
  const exportarCSV = (profile) => {
    try {
      const arquivo = exportWeighingCsv(pesagensFiltradas, {
        profile,
        columns: colunasOrdenadas.map((coluna) => coluna.id),
        canSeeCommercial: podeVerValores,
      });
      downloadCsvFile(arquivo);
      toast.success(`${fmtInt(arquivo.rowCount)} registro(s) exportado(s).`);
    } catch (error) {
      toast.error(error.message || 'Não foi possível exportar.');
    }
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

  const uniqueOptionsCache = useMemo(() => new Map(), [pesagens]);
  const uniqueOptionsOf = (columnId) => {
    if (!uniqueOptionsCache.has(columnId)) {
      const values = new Set();
      for (const pesagem of pesagens) {
        const value = getPesagemColumnValue(pesagem, columnId);
        if (value !== null && value !== undefined && value !== "") values.add(value);
      }
      uniqueOptionsCache.set(columnId, [...values]);
    }
    return uniqueOptionsCache.get(columnId);
  };

  // Uma pílula por coluna visível da tabela, na mesma ordem (ModeloBase1).
  // Valores únicos: calculados sob demanda (ao abrir) e guardados até a lista de pesagens mudar.
  const renderQuickFilter = (coluna) => {
    const filterId = coluna.id;
    const listOptions = () => uniqueOptionsOf(filterId);
    return (
      <MakFilterPill
        key={filterId}
        label={coluna.label}
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
      className="d17b-page d17b-list-page d17b-list-page--mother cadastro-emp-scope mg-empresas-scope"
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
            {podeLancar && (
            <div className="mg-action-slot is-visible" style={{ "--slot-width": "122px" }}>
              <Link to={createPageUrl("LancamentoPesagensIndividuais")} className="mg-action-slot__link">
                <button type="button" className="ios-btn tb-btn tb-btn-labeled tb-btn-green" title="Lançar pesagem">
                  Lançar pesagem
                </button>
              </Link>
            </div>
            )}
            {podeEditar && (<>
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
            </>)}
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
                  ...(podeExportar ? [
                    { id: "exportar", label: "Exportar relatório (CSV)", icon: Download, onClick: () => exportarCSV(EXPORT_PROFILES.FRIENDLY) },
                    { id: "exportar-reimportacao", label: "Exportar para reimportação (CSV)", icon: FileDown, onClick: () => exportarCSV(EXPORT_PROFILES.REIMPORT) },
                  ] : []),
                  ...(podeImportar ? [
                    { id: "importar", label: "Importar CSV", icon: Upload, onClick: () => navigate(createPageUrl("Importacao")) },
                    { id: "modelo", label: "Baixar modelo CSV", icon: FileSpreadsheet, onClick: baixarModelo },
                  ] : []),
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Faixa de pílulas de filtro + configuração de colunas (ModeloBase1). */}
      <div className="mak-mother-page__panel-strip" data-mak-region="panel-strip">
        <MgTablePanelStrip onConfigColumns={() => setShowConfigColunas(true)}>
          <MakFilterRail hasActiveFilters={hasActiveFilters} onClear={limparFiltros}>
            {colunasOrdenadas.filter((coluna) => !coluna.fixo).map(renderQuickFilter)}
          </MakFilterRail>
        </MgTablePanelStrip>
      </div>

      <div className="d17b-list-body">

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
                          listOptions: colunaMenuAberto === coluna.id ? uniqueOptionsOf(coluna.id) : [],
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
                          if (!podeEditar) return <TableCell key="acoes" className="text-xs !p-0 text-center" />;
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
                        // Célula genérica: valor e formatação da ColumnDefinition compartilhada
                        // (mesma formatação da emissão); só a apresentação visual fica aqui.
                        const accessor = resolveEventColumn(coluna.id);
                        const texto = accessor ? formatCell(accessor.column, accessor.column.type === 'entity' ? accessor.displayOf(p) : accessor.valueOf(p), 'screen') : '—';
                        const alinhamento = coluna.align === 'right' ? ' text-right font-mono' : '';
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
                        if (coluna.id === 'numero_animal') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3 font-semibold">{texto}</TableCell>;
                        }
                        if (coluna.id === 'peso') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3 text-right font-mono font-semibold">{texto}</TableCell>;
                        }
                        if (coluna.id === 'gmd') {
                          return <TableCell key={coluna.id} className={`text-xs py-2 px-3 text-right font-mono ${p.gmd && p.gmd > 0 ? 'text-emerald-600' : p.gmd && p.gmd < 0 ? 'text-red-600' : ''}`}>{texto}</TableCell>;
                        }
                        if (coluna.id === 'placa_carreta') {
                          return <TableCell key={coluna.id} className="text-xs py-2 px-3 uppercase">{texto}</TableCell>;
                        }
                        return <TableCell key={coluna.id} className={`text-xs py-2 px-3${alinhamento}`}>{texto}</TableCell>;
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
          columns={colunasPermitidas}
          order={colunasOrdem}
          visible={colunasVisiveis}
          onApply={aplicarConfiguracaoColunas}
        />
      ) : null}

    </ModeloBase1PageContainer>
  );
}
