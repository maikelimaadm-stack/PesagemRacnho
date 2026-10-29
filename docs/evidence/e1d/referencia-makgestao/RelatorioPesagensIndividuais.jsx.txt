import React, { useState, useMemo } from "react";
// NOTE: filtros adicionais (status, tipo, peso) movidos para popovers menores para não alterar estrutura
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Printer, Settings, Eye, EyeOff, GripVertical } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger } from
"@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle } from
"@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RelatorioConfigDialogs from "../components/relatorios/RelatorioConfigDialogs";
const formatarNumero = (numero) => {
  if (!numero && numero !== 0) return "";
  return Number(numero).toLocaleString('pt-BR');
};
const formatarDecimal = (numero, casas = 2) => {
  if (numero === null || numero === undefined || numero === "" || isNaN(numero)) return "-";
  return Number(numero).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
};
const formatarMoeda = (numero) => {
  if (numero === null || numero === undefined || numero === "" || isNaN(numero)) return "-";
  return Number(numero).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};
const COLUNAS_DISPONIVEIS = [
{ id: 'data_pesagem', label: 'Data', default: true },
{ id: 'numero_animal', label: 'Animal', default: true },
{ id: 'sexo', label: 'Sexo', default: true },
{ id: 'raca', label: 'Raça', default: true },
{ id: 'peso', label: 'Peso (kg)', default: true },
{ id: 'nome_lote', label: 'Lote', default: true },
{ id: 'nome_apartacao', label: 'Apartação', default: true },
{ id: 'data_anterior', label: 'Data Anterior', default: false },
{ id: 'peso_anterior', label: 'Peso Anterior', default: false },
{ id: 'dias', label: 'Dias', default: true },
{ id: 'ganho', label: 'Ganho (kg)', default: true },
{ id: 'gmd', label: 'GMD', default: true },
{ id: 'observacao', label: 'Observação', default: false }];

// Colunas de detalhes para o relatório de apartação com detalhes
const COLUNAS_DETALHES_APARTACAO = [
{ id: 'numero_animal', label: 'Animal', default: true },
{ id: 'data_pesagem', label: 'Data', default: true },
{ id: 'tipo_manejo', label: 'Tipo', default: false },
{ id: 'motivo_saida', label: 'Motivo', default: false },
{ id: 'sexo', label: 'Sexo', default: true },
{ id: 'raca', label: 'Raça', default: false },
{ id: 'era', label: 'Era', default: false },
{ id: 'marca', label: 'Marca', default: false },
{ id: 'nome_apartacao', label: 'Apartação', default: false },
{ id: 'nome_lote', label: 'Lote', default: false },
{ id: 'peso', label: 'Peso (kg)', default: true },
{ id: 'peso_anterior', label: 'Peso Ant.', default: false },
{ id: 'dias', label: 'Dias', default: true },
{ id: 'ganho', label: 'Ganho', default: true },
{ id: 'gmd', label: 'GMD', default: true },
{ id: 'frigorifico', label: 'Frigorífico', default: false },
{ id: 'embarque_nome', label: 'Embarque', default: false },
{ id: 'documento_tipo', label: 'Doc', default: false },
{ id: 'documento_numero', label: 'Nº Doc', default: false },
{ id: 'motorista_nome', label: 'Motorista', default: false },
{ id: 'placa_carreta', label: 'Placa', default: false },
{ id: 'comprador', label: 'Comprador', default: false },
{ id: 'destino_venda', label: 'Destino', default: false },
{ id: 'valor_arroba', label: 'Valor @', default: false },
{ id: 'valor_venda_total', label: 'Valor Venda (R$)', default: false },
{ id: 'quantidade_arrobas', label: 'Qtd @', default: false },
{ id: 'origem_animal', label: 'Origem', default: false },
{ id: 'valor_pago_cabeca', label: 'Vlr Cabeça (R$)', default: false },
{ id: 'observacao', label: 'Obs', default: false }];

// Colunas de detalhes para relatório de Vendas (detalhes por boi)
const COLUNAS_DETALHES_VENDAS = [
{ id: 'comprador', label: 'Comprador', default: true },
{ id: 'data_pesagem', label: 'Data', default: true },
{ id: 'numero_animal', label: 'Animal', default: true },
{ id: 'peso', label: 'Peso (kg)', default: true },
{ id: 'quantidade_arrobas_calc', label: 'Qtd @', default: true },
{ id: 'valor_arroba', label: 'Valor @', default: true },
{ id: 'valor_total_calc', label: 'Valor Total', default: true },
{ id: 'destino_venda', label: 'Destino', default: false },
{ id: 'nome_lote', label: 'Lote', default: false },
{ id: 'nome_apartacao', label: 'Apartação', default: false },
{ id: 'sexo', label: 'Sexo', default: false },
{ id: 'raca', label: 'Raça', default: false },
{ id: 'era', label: 'Era', default: false },
{ id: 'marca', label: 'Marca', default: false },
{ id: 'observacao', label: 'Obs', default: false }];

const EIXO_X_OPCOES = [
{ value: 'nome_lote', label: 'Lote' },
{ value: 'nome_apartacao', label: 'Apartação' },
{ value: 'sexo', label: 'Sexo' },
{ value: 'raca', label: 'Raça' },
{ value: 'mes', label: 'Mês' }];

const EIXO_Y_OPCOES = [
{ value: 'nome_lote', label: 'Lote' },
{ value: 'nome_apartacao', label: 'Apartação' },
{ value: 'sexo', label: 'Sexo' },
{ value: 'raca', label: 'Raça' },
{ value: 'mes', label: 'Mês' }];

const ORDENACAO_OPCOES = [
{ value: 'data_desc', label: 'Data (Mais Recente)' },
{ value: 'data_asc', label: 'Data (Mais Antiga)' },
{ value: 'peso_desc', label: 'Peso (Maior)' },
{ value: 'peso_asc', label: 'Peso (Menor)' },
{ value: 'gmd_desc', label: 'GMD (Maior)' },
{ value: 'gmd_asc', label: 'GMD (Menor)' },
{ value: 'animal_asc', label: 'Animal (A-Z)' },
{ value: 'lote_asc', label: 'Lote (A-Z)' }];

export default function RelatorioPesagensIndividuais() {
  const [tipoRelatorio, setTipoRelatorio] = useState("analitico");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [orientacao, setOrientacao] = useState("paisagem");
  const [agrupamentosAtivos, setAgrupamentosAtivos] = useState([]);
  const [ordenacao, setOrdenacao] = useState('data_desc');
  const [eixoXSintetico, setEixoXSintetico] = useState('nome_lote');
  const [eixoYSintetico, setEixoYSintetico] = useState('sexo');
  const [colunasVisiveis, setColunasVisiveis] = useState(() => {
    const saved = localStorage.getItem('colunas_relatorio_pesagens_ind');
    if (saved) {
      try {return JSON.parse(saved);} catch {}
    }
    return COLUNAS_DISPONIVEIS.filter((c) => c.default).map((c) => c.id);
  });
  // Estado para mostrar detalhes no relatório de apartação
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false);
  const [showConfigColunasDetalhes, setShowConfigColunasDetalhes] = useState(false);
  // Vendas: toggle detalhes
  const [mostrarDetalhesVendas, setMostrarDetalhesVendas] = useState(false);
  const [showConfigColunasVendas, setShowConfigColunasVendas] = useState(false);

  // Colunas de detalhes visíveis e ordem
  const [colunasDetalhesVisiveis, setColunasDetalhesVisiveis] = useState(() => {
    const saved = localStorage.getItem('colunas_detalhes_apartacao');
    if (saved) {
      try {return JSON.parse(saved);} catch {}
    }
    return COLUNAS_DETALHES_APARTACAO.filter((c) => c.default).map((c) => c.id);
  });
  // Vendas: colunas visíveis
  const [colunasVendasVisiveis, setColunasVendasVisiveis] = useState(() => {
    const saved = localStorage.getItem('colunas_detalhes_vendas');
    if (saved) {
      try {return JSON.parse(saved);} catch {}
    }
    return COLUNAS_DETALHES_VENDAS.filter((c) => c.default).map((c) => c.id);
  });

  const [colunasDetalhesOrdem, setColunasDetalhesOrdem] = useState(() => {
    const saved = localStorage.getItem('colunas_detalhes_ordem_apartacao');
    const base = COLUNAS_DETALHES_APARTACAO.map((c) => c.id);
    if (saved) {
      try {
        const arr = JSON.parse(saved) || [];
        // Garante que novas colunas sejam adicionadas ao fim
        return [...arr, ...base.filter((id) => !arr.includes(id))];
      } catch {}
    }
    return base;
  });
  // Vendas: ordem das colunas
  const [colunasVendasOrdem, setColunasVendasOrdem] = useState(() => {
    const saved = localStorage.getItem('colunas_detalhes_ordem_vendas');
    const base = COLUNAS_DETALHES_VENDAS.map((c) => c.id);
    if (saved) {
      try {
        const arr = JSON.parse(saved) || [];
        return [...arr, ...base.filter((id) => !arr.includes(id))];
      } catch {}
    }
    return base;
  });
  // Colunas do painel principal (Resumo por Lote) no relatório Apartação
  const COLUNAS_PAINEL_APARTACAO = [
  { id: 'lote', label: 'Lote' },
  { id: 'qtd', label: 'Qtd' },
  { id: 'faixa', label: 'Faixa Exigida' },
  { id: 'menor', label: 'Menor' },
  { id: 'maior', label: 'Maior' },
  { id: 'peso_medio', label: 'Peso Médio' },
  { id: 'arroba_media', label: 'Média (@)' },
  { id: 'peso_total', label: 'Peso Total' },
  { id: 'arroba_total', label: 'Total (@)' },
  { id: 'ganho_medio', label: 'Ganho Médio' },
  { id: 'ganho_medio_arroba', label: 'Ganho Médio (@)' },
  { id: 'ganho_total', label: 'Ganho Total' },
  { id: 'ganho_total_arroba', label: 'Ganho Total (@)' },
  { id: 'dias_medio', label: 'Dias Médios' },
  { id: 'gmd_medio', label: 'GMD Médio' },
  { id: 'machos', label: 'Machos' },
  { id: 'femeas', label: 'Fêmeas' }];

  // Colunas do painel (Vendas)
  const COLUNAS_PAINEL_VENDAS = [
  { id: 'qtd', label: 'Animais' },
  { id: 'peso_medio', label: 'Peso Médio' },
  { id: 'peso_total', label: 'Peso Total' },
  { id: 'media_arrobas', label: 'Média (@)' },
  { id: 'valor_total', label: 'Valor Total' }];

  const [showConfigColunasPainel, setShowConfigColunasPainel] = useState(false);
  const [colunasPainelVisiveis, setColunasPainelVisiveis] = useState(() => {
    const base = tipoRelatorio === 'vendas' ? COLUNAS_PAINEL_VENDAS : COLUNAS_PAINEL_APARTACAO;
    const saved = localStorage.getItem(tipoRelatorio === 'vendas' ? 'colunas_painel_vendas' : 'colunas_painel_apartacao');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const missing = base.map((c) => c.id).filter((id) => !parsed.includes(id));
        return [...parsed, ...missing];
      } catch {}
    }
    return base.map((c) => c.id);
  });
  const [colunasPainelOrdem, setColunasPainelOrdem] = useState(() => {
    const saved = localStorage.getItem(tipoRelatorio === 'vendas' ? 'colunas_painel_ordem_vendas' : 'colunas_painel_ordem_apartacao');
    const base = (tipoRelatorio === 'vendas' ? COLUNAS_PAINEL_VENDAS : COLUNAS_PAINEL_APARTACAO).map((c) => c.id);
    if (saved) {
      try {
        const arr = JSON.parse(saved) || [];
        return [...arr, ...base.filter((id) => !arr.includes(id))];
      } catch {}
    }
    return base;
  });
  const colunasPainelOrdenadas = useMemo(() => {
    const ordemCompletada = [...colunasPainelOrdem, ...colunasPainelVisiveis.filter((id) => !colunasPainelOrdem.includes(id))];
    const baseCols = tipoRelatorio === 'vendas' ? COLUNAS_PAINEL_VENDAS : COLUNAS_PAINEL_APARTACAO;
    return ordemCompletada.
    map((id) => baseCols.find((c) => c.id === id)).
    filter((c) => c && colunasPainelVisiveis.includes(c.id));
  }, [colunasPainelOrdem, colunasPainelVisiveis]);
  const toggleColunaPainel = (colunaId) => {
    const habilitando = !colunasPainelVisiveis.includes(colunaId);
    const novas = habilitando ?
    [...colunasPainelVisiveis, colunaId] :
    colunasPainelVisiveis.filter((id) => id !== colunaId);
    setColunasPainelVisiveis(novas);
    localStorage.setItem(tipoRelatorio === 'vendas' ? 'colunas_painel_vendas' : 'colunas_painel_apartacao', JSON.stringify(novas));
    if (habilitando && !colunasPainelOrdem.includes(colunaId)) {
      const novaOrdem = [...colunasPainelOrdem, colunaId];
      setColunasPainelOrdem(novaOrdem);
      localStorage.setItem(tipoRelatorio === 'vendas' ? 'colunas_painel_ordem_vendas' : 'colunas_painel_ordem_apartacao', JSON.stringify(novaOrdem));
    }
  };
  const handleDragEndPainel = (result) => {
    if (!result.destination) return;
    const items = Array.from(colunasPainelOrdem);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setColunasPainelOrdem(items);
    localStorage.setItem(tipoRelatorio === 'vendas' ? 'colunas_painel_ordem_vendas' : 'colunas_painel_ordem_apartacao', JSON.stringify(items));
  };
  // Garante que novas colunas do painel entrem na ordem salva
  React.useEffect(() => {
    const base = COLUNAS_PAINEL_APARTACAO.map((c) => c.id);
    const nova = [...colunasPainelOrdem, ...base.filter((id) => !colunasPainelOrdem.includes(id))];
    if (nova.length !== colunasPainelOrdem.length) {
      setColunasPainelOrdem(nova);
      localStorage.setItem('colunas_painel_ordem_apartacao', JSON.stringify(nova));
    }
  }, []);
  const [lotesSelecionados, setLotesSelecionados] = useState([]);
  const [apartacoesSelecionadas, setApartacoesSelecionadas] = useState([]);
  const [sexosSelecionados, setSexosSelecionados] = useState([]);
  const [racasSelecionadas, setRacasSelecionadas] = useState([]);
  const [erasSelecionadas, setErasSelecionadas] = useState([]);
  const [marcasSelecionadas, setMarcasSelecionadas] = useState([]);
  const [statusSelecionados, setStatusSelecionados] = useState([]);
  const [historicoPesoFiltro, setHistoricoPesoFiltro] = useState('todos');
  const empresaSelecionadaId = localStorage.getItem('empresa_selecionada_id');
  const { data: pesagens = [], isLoading } = useQuery({
    queryKey: ['pesagens-individuais-relatorio', empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.PesagemIndividual.list('-data_pesagem');
      return all.filter((p) => p.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId
  });
  const { data: empresaAtual } = useQuery({
    queryKey: ['empresa-atual-relatorio', empresaSelecionadaId],
    queryFn: async () => {
      if (!empresaSelecionadaId) return null;
      const empresas = await base44.entities.Empresa.list();
      return empresas.find((e) => e.id === empresaSelecionadaId) || null;
    },
    enabled: !!empresaSelecionadaId
  });
  const { data: lotesApartacaoCadastrados = [] } = useQuery({
    queryKey: ['lotes-apartacao-relatorio', empresaSelecionadaId],
    queryFn: async () => {
      const all = await base44.entities.LoteApartacao.list();
      return all.filter((l) => l.empresa_id === empresaSelecionadaId);
    },
    enabled: !!empresaSelecionadaId
  });
  const lotesUnicos = [...new Set(pesagens.map((p) => p.nome_lote))].filter(Boolean).sort();
  const apartacoesUnicas = [...new Set(pesagens.map((p) => p.nome_apartacao))].filter(Boolean).sort();
  const sexosUnicos = [...new Set(pesagens.map((p) => p.sexo))].filter(Boolean).sort();
  const racasUnicas = [...new Set(pesagens.map((p) => p.raca))].filter(Boolean).sort();
  const erasUnicas = [...new Set(pesagens.map((p) => p.era))].filter(Boolean).sort();
  const marcasUnicas = [...new Set(pesagens.map((p) => p.marca))].filter(Boolean).sort();
  const statusUnicos = [...new Set(pesagens.map((p) => p.status_animal || (p.tipo_manejo === 'Saída' ? 'Inativo' : 'Ativo')))].filter(Boolean).sort();
  const formatarData = (dataString) => {
    if (!dataString) return '--/--/----';
    try {
      const dataStr = dataString.split('T')[0];
      const [ano, mes, dia] = dataStr.split('-');
      if (!ano || !mes || !dia) return '--/--/----';
      return `${dia}/${mes}/${ano}`;
    } catch {return '--/--/----';}
  };
  const temHistoricoPeso = (p) => p.peso_anterior != null && p.ganho != null && p.dias != null && Number(p.dias) > 0;
  const pesagensFiltradas = useMemo(() => {
    let filtered = pesagens.filter((p) => {
      if (dataInicio && p.data_pesagem) {
        const pDate = new Date(p.data_pesagem);
        const iDate = new Date(dataInicio);
        iDate.setHours(0, 0, 0, 0);
        if (pDate < iDate) return false;
      }
      if (dataFim && p.data_pesagem) {
        const pDate = new Date(p.data_pesagem);
        const fDate = new Date(dataFim);
        fDate.setHours(23, 59, 59, 999);
        if (pDate > fDate) return false;
      }
      if (lotesSelecionados.length > 0 && !lotesSelecionados.includes(p.nome_lote)) return false;
      if (apartacoesSelecionadas.length > 0 && !apartacoesSelecionadas.includes(p.nome_apartacao)) return false;
      if (sexosSelecionados.length > 0 && !sexosSelecionados.includes(p.sexo)) return false;
      if (racasSelecionadas.length > 0 && !racasSelecionadas.includes(p.raca)) return false;
      if (erasSelecionadas.length > 0 && !erasSelecionadas.includes(p.era)) return false;
      if (marcasSelecionadas.length > 0 && !marcasSelecionadas.includes(p.marca)) return false;
      if (historicoPesoFiltro === 'com' && !temHistoricoPeso(p)) return false;
      if (historicoPesoFiltro === 'sem' && temHistoricoPeso(p)) return false;
      return true;
    });
    filtered.sort((a, b) => {
      switch (ordenacao) {
        case 'data_desc':return new Date(b.data_pesagem || 0) - new Date(a.data_pesagem || 0);
        case 'data_asc':return new Date(a.data_pesagem || 0) - new Date(b.data_pesagem || 0);
        case 'peso_desc':return (b.peso || 0) - (a.peso || 0);
        case 'peso_asc':return (a.peso || 0) - (b.peso || 0);
        case 'gmd_desc':return (b.gmd || 0) - (a.gmd || 0);
        case 'gmd_asc':return (a.gmd || 0) - (b.gmd || 0);
        case 'animal_asc':return (a.numero_animal || '').localeCompare(b.numero_animal || '');
        case 'lote_asc':return (a.nome_lote || '').localeCompare(b.nome_lote || '');
        default:return 0;
      }
    });
    return filtered;
  }, [pesagens, dataInicio, dataFim, lotesSelecionados, apartacoesSelecionadas, sexosSelecionados, racasSelecionadas, erasSelecionadas, marcasSelecionadas, historicoPesoFiltro, ordenacao]);
  const pesagensAgrupadas = useMemo(() => {
    if (agrupamentosAtivos.length === 0) {
      return { "Todos os Registros": pesagensFiltradas };
    }
    const grupos = {};
    pesagensFiltradas.forEach((p) => {
      let chaveArray = [];
      agrupamentosAtivos.forEach((tipo) => {
        let valor;
        switch (tipo) {
          case "lote":valor = p.nome_lote || "Sem lote";break;
          case "apartacao":valor = p.nome_apartacao || "Sem apartação";break;
          case "sexo":valor = p.sexo === 'M' ? 'Macho' : p.sexo === 'F' ? 'Fêmea' : 'Sem sexo';break;
          case "raca":valor = p.raca || "Sem raça";break;
          default:valor = "Sem classificação";
        }
        chaveArray.push(valor);
      });
      const chave = chaveArray.join(" → ");
      if (!grupos[chave]) grupos[chave] = [];
      grupos[chave].push(p);
    });
    return grupos;
  }, [pesagensFiltradas, agrupamentosAtivos]);
  const toggleColuna = (colunaId) => {
    setColunasVisiveis((prev) => {
      const novas = prev.includes(colunaId) ? prev.filter((id) => id !== colunaId) : [...prev, colunaId];
      localStorage.setItem('colunas_relatorio_pesagens_ind', JSON.stringify(novas));
      return novas;
    });
  };
  // Toggle para colunas de detalhes da apartação
  const toggleColunaDetalhe = (colunaId) => {
    const habilitando = !colunasDetalhesVisiveis.includes(colunaId);
    const novas = habilitando ?
    [...colunasDetalhesVisiveis, colunaId] :
    colunasDetalhesVisiveis.filter((id) => id !== colunaId);
    setColunasDetalhesVisiveis(novas);
    localStorage.setItem('colunas_detalhes_apartacao', JSON.stringify(novas));
    if (habilitando && !colunasDetalhesOrdem.includes(colunaId)) {
      const novaOrdem = [...colunasDetalhesOrdem, colunaId];
      setColunasDetalhesOrdem(novaOrdem);
      localStorage.setItem('colunas_detalhes_ordem_apartacao', JSON.stringify(novaOrdem));
    }
  };
  const toggleColunaDetalheVendas = (colunaId) => {
    const habilitando = !colunasVendasVisiveis.includes(colunaId);
    const novas = habilitando ?
    [...colunasVendasVisiveis, colunaId] :
    colunasVendasVisiveis.filter((id) => id !== colunaId);
    setColunasVendasVisiveis(novas);
    localStorage.setItem('colunas_detalhes_vendas', JSON.stringify(novas));
    if (habilitando && !colunasVendasOrdem.includes(colunaId)) {
      const novaOrdem = [...colunasVendasOrdem, colunaId];
      setColunasVendasOrdem(novaOrdem);
      localStorage.setItem('colunas_detalhes_ordem_vendas', JSON.stringify(novaOrdem));
    }
  };
  // Drag and drop para reordenar colunas de detalhes
  const handleDragEndDetalhes = (result) => {
    if (!result.destination) return;
    const items = Array.from(colunasDetalhesOrdem);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setColunasDetalhesOrdem(items);
    localStorage.setItem('colunas_detalhes_ordem_apartacao', JSON.stringify(items));
  };
  const handleDragEndDetalhesVendas = (result) => {
    if (!result.destination) return;
    const items = Array.from(colunasVendasOrdem);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setColunasVendasOrdem(items);
    localStorage.setItem('colunas_detalhes_ordem_vendas', JSON.stringify(items));
  };
  // Colunas de detalhes ordenadas
  const colunasDetalhesOrdenadas = useMemo(() => {
    const ordemCompletada = [...colunasDetalhesOrdem, ...colunasDetalhesVisiveis.filter((id) => !colunasDetalhesOrdem.includes(id))];
    return ordemCompletada.
    map((id) => COLUNAS_DETALHES_APARTACAO.find((c) => c.id === id)).
    filter((c) => c && colunasDetalhesVisiveis.includes(c.id));
  }, [colunasDetalhesOrdem, colunasDetalhesVisiveis]);
  const colunasVendasOrdenadas = useMemo(() => {
    const ordemCompletada = [...colunasVendasOrdem, ...colunasVendasVisiveis.filter((id) => !colunasVendasOrdem.includes(id))];
    return ordemCompletada.
    map((id) => COLUNAS_DETALHES_VENDAS.find((c) => c.id === id)).
    filter((c) => c && colunasVendasVisiveis.includes(c.id));
  }, [colunasVendasOrdem, colunasVendasVisiveis]);
  const toggleFiltro = (lista, setLista, valor) => {
    setLista((prev) => prev.includes(valor) ? prev.filter((v) => v !== valor) : [...prev, valor]);
  };
  const toggleAgrupamento = (tipo) => {
    setAgrupamentosAtivos((prev) => prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]);
  };
  const limparFiltros = () => {
    setDataInicio("");
    setDataFim("");
    setLotesSelecionados([]);
    setApartacoesSelecionadas([]);
    setSexosSelecionados([]);
    setRacasSelecionadas([]);
    setErasSelecionadas([]);
    setMarcasSelecionadas([]);
    setAgrupamentosAtivos([]);
    setOrdenacao('data_desc');
    setStatusSelecionados([]);
    setHistoricoPesoFiltro('todos');
    // Mantém o tipo de relatório atual
  };
  // Estatísticas gerais
  const totalAnimais = pesagensFiltradas.length;
  const pesagensComHistorico = pesagensFiltradas.filter(temHistoricoPeso);
  const totalAnimaisComHistorico = pesagensComHistorico.length;
  const pesoMedio = totalAnimais > 0 ? pesagensFiltradas.reduce((s, p) => s + (p.peso || 0), 0) / totalAnimais : 0;
  const gmdMedio = totalAnimaisComHistorico > 0 ?
  pesagensComHistorico.reduce((s, p) => s + (p.gmd || 0), 0) / totalAnimaisComHistorico :
  0;
  const ganhoTotal = pesagensComHistorico.reduce((s, p) => s + (p.ganho || 0), 0);
  const ganhoMedioGeral = totalAnimaisComHistorico > 0 ? ganhoTotal / totalAnimaisComHistorico : 0;
  const diasMedioGeral = totalAnimaisComHistorico > 0 ?
  pesagensComHistorico.reduce((s, p) => s + (p.dias || 0), 0) / totalAnimaisComHistorico :
  0;
  const pesoTotalGeral = pesagensFiltradas.reduce((s, p) => s + (p.peso || 0), 0);
  const arrobaMediaGeral = pesoMedio / 30;
  const arrobaTotalGeral = pesoTotalGeral / 30;
  const ganhoArrobaMedioGeral = ganhoMedioGeral / 30;
  const ganhoArrobaTotalGeral = ganhoTotal / 30;
  return (
    <div className="absolute inset-0 overflow-y-auto p-4 md:p-6 space-y-2">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Relatório de Pesagens Individuais</h1>
          <p className="text-xs text-slate-600">Análise e impressão</p>
        </div>
        <Button onClick={() => window.print()} size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700">
          Imprimir
        </Button>
      </div>
      {/* Filtros */}
      <Card className="print:hidden">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Data Início</Label>
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Fim</Label>
              <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Orientação</Label>
              <Select value={orientacao} onValueChange={setOrientacao}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="retrato">Retrato</SelectItem>
                  <SelectItem value="paisagem">Paisagem</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo Relatório</Label>
              <Select value={tipoRelatorio} onValueChange={setTipoRelatorio}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="analitico">Analítico (Detalhado)</SelectItem>
                  <SelectItem value="sintetico">Sintético (Matriz)</SelectItem>
                  <SelectItem value="apartacao">Por Apartação/Lote</SelectItem>
                  <SelectItem value="apartacao_data">Por Apartação (Resumo por Data)</SelectItem>
                  <SelectItem value="vendas">Vendas (Detalhado)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tipoRelatorio === 'sintetico' &&
            <>
                <div className="space-y-1">
                  <Label className="text-xs">Linhas (Eixo Y)</Label>
                  <Select value={eixoYSintetico} onValueChange={setEixoYSintetico}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EIXO_Y_OPCOES.map((opt) =>
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Colunas (Eixo X)</Label>
                  <Select value={eixoXSintetico} onValueChange={setEixoXSintetico}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EIXO_X_OPCOES.map((opt) =>
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    )}
                    </SelectContent>
                  </Select>
                </div>
              </>
            }
            <div className="space-y-1">
              <Label className="text-xs">Ordenar Por</Label>
              <Select value={ordenacao} onValueChange={setOrdenacao}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORDENACAO_OPCOES.map((opt) =>
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pesagem Anterior</Label>
              <Select value={historicoPesoFiltro} onValueChange={setHistoricoPesoFiltro}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="com">Com pesagem anterior</SelectItem>
                  <SelectItem value="sem">Sem pesagem anterior</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {tipoRelatorio === 'analitico' &&
          <div className="space-y-1">
              <Label className="text-xs">Agrupar Por</Label>
              <div className="flex flex-wrap gap-1">
                {['lote', 'apartacao', 'sexo', 'raca'].map((tipo) =>
              <Button
                key={tipo}
                variant={agrupamentosAtivos.includes(tipo) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleAgrupamento(tipo)}
                className={`h-7 text-xs ${agrupamentosAtivos.includes(tipo) ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}>
                
                    {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                  </Button>
              )}
              </div>
            </div>
          }
          <div className="flex gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">Lotes {lotesSelecionados.length > 0 && `(${lotesSelecionados.length})`}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 max-h-96 overflow-auto">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm mb-2">Lotes</h4>
                  {lotesUnicos.map((l) =>
                  <div key={l} className="flex items-center space-x-2">
                      <Checkbox checked={lotesSelecionados.includes(l)} onCheckedChange={() => toggleFiltro(lotesSelecionados, setLotesSelecionados, l)} />
                      <label className="text-sm cursor-pointer">{l}</label>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">Apartações {apartacoesSelecionadas.length > 0 && `(${apartacoesSelecionadas.length})`}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 max-h-96 overflow-auto">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm mb-2">Apartações</h4>
                  {apartacoesUnicas.map((a) =>
                  <div key={a} className="flex items-center space-x-2">
                      <Checkbox checked={apartacoesSelecionadas.includes(a)} onCheckedChange={() => toggleFiltro(apartacoesSelecionadas, setApartacoesSelecionadas, a)} />
                      <label className="text-sm cursor-pointer">{a}</label>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">Sexo {sexosSelecionados.length > 0 && `(${sexosSelecionados.length})`}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-48">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm mb-2">Sexo</h4>
                  {sexosUnicos.map((s) =>
                  <div key={s} className="flex items-center space-x-2">
                      <Checkbox checked={sexosSelecionados.includes(s)} onCheckedChange={() => toggleFiltro(sexosSelecionados, setSexosSelecionados, s)} />
                      <label className="text-sm cursor-pointer">{s === 'M' ? 'Macho' : s === 'F' ? 'Fêmea' : s}</label>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">Raças {racasSelecionadas.length > 0 && `(${racasSelecionadas.length})`}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 max-h-96 overflow-auto">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm mb-2">Raças</h4>
                  {racasUnicas.map((r) =>
                  <div key={r} className="flex items-center space-x-2">
                      <Checkbox checked={racasSelecionadas.includes(r)} onCheckedChange={() => toggleFiltro(racasSelecionadas, setRacasSelecionadas, r)} />
                      <label className="text-sm cursor-pointer">{r}</label>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">Era {erasSelecionadas.length > 0 && `(${erasSelecionadas.length})`}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 max-h-96 overflow-auto">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm mb-2">Era</h4>
                  {erasUnicas.map((e) =>
                  <div key={e} className="flex items-center space-x-2">
                      <Checkbox checked={erasSelecionadas.includes(e)} onCheckedChange={() => toggleFiltro(erasSelecionadas, setErasSelecionadas, e)} />
                      <label className="text-sm cursor-pointer">{e}</label>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">Marcas {marcasSelecionadas.length > 0 && `(${marcasSelecionadas.length})`}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 max-h-96 overflow-auto">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm mb-2">Marcas</h4>
                  {marcasUnicas.map((m) =>
                  <div key={m} className="flex items-center space-x-2">
                      <Checkbox checked={marcasSelecionadas.includes(m)} onCheckedChange={() => toggleFiltro(marcasSelecionadas, setMarcasSelecionadas, m)} />
                      <label className="text-sm cursor-pointer">{m}</label>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs">Status {statusSelecionados.length > 0 && `(${statusSelecionados.length})`}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 max-h-96 overflow-auto">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm mb-2">Status</h4>
                  {statusUnicos.map((s) =>
                  <div key={s} className="flex items-center space-x-2">
                      <Checkbox checked={statusSelecionados.includes(s)} onCheckedChange={() => toggleFiltro(statusSelecionados, setStatusSelecionados, s)} />
                      <label className="text-sm cursor-pointer">{s}</label>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            {tipoRelatorio === 'analitico' &&
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                    <Settings className="w-3.5 h-3.5" />
                    Colunas
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 max-h-96 overflow-y-auto">
                  <DropdownMenuLabel>Colunas Visíveis</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {COLUNAS_DISPONIVEIS.map((coluna) =>
                <DropdownMenuCheckboxItem
                  key={coluna.id}
                  checked={colunasVisiveis.includes(coluna.id)}
                  onCheckedChange={() => toggleColuna(coluna.id)}>
                  
                      {coluna.label}
                    </DropdownMenuCheckboxItem>
                )}
                </DropdownMenuContent>
              </DropdownMenu>
            }
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={limparFiltros}>Limpar Filtros</Button>
          </div>
        </CardContent>
      </Card>
      {/* Área de Impressão */}
      <div className={`bg-white print:shadow-none ${orientacao === 'paisagem' ? 'print:landscape' : ''}`}>
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page { size: ${orientacao === 'paisagem' ? 'A4 landscape' : 'A4 portrait'}; margin: 1.5cm 1cm 2cm 1cm; }
            body * { visibility: hidden; }
            .print-area, .print-area * { visibility: visible; }
            .print-area { position: absolute; left: 0; top: 0; width: 100%; }
            header, nav, .no-print, .print\\:hidden { display: none !important; }
          }
        ` }} />
        <div className="print-area p-8 print:p-0">
          {/* Cabeçalho */}
          <div className="border-b-2 border-black pb-1 mb-2">
            <div className="flex items-center justify-between gap-3">
              {empresaAtual?.logotipo_url &&
              <img src={empresaAtual.logotipo_url} alt={empresaAtual.apelido || "Logo"} className="h-24 w-24 object-contain" />
              }
              <div className="flex-1 text-center">
                <h1 className="text-base font-bold leading-tight uppercase">{empresaAtual?.nome || 'Empresa'}</h1>
                {empresaAtual?.apelido && empresaAtual.apelido !== empresaAtual.nome &&
                <p className="text-xs leading-tight">{empresaAtual.apelido}</p>
                }
                {empresaAtual?.endereco &&
                <p className="text-xs leading-tight">
                    {empresaAtual.endereco}
                    {empresaAtual?.cidade && empresaAtual?.estado && `, ${empresaAtual.cidade}-${empresaAtual.estado}`}
                  </p>
                }
              </div>
            </div>
            <div>
              <h2 className="text-base font-bold">Relatório de Pesagens Individuais {tipoRelatorio === 'analitico' ? '(Analítico)' : '(Sintético)'}</h2>
              {(dataInicio || dataFim) &&
              <p className="text-xs text-gray-600">
                  Período: {dataInicio ? formatarData(dataInicio) : "Início"} a {dataFim ? formatarData(dataFim) : "Hoje"}
                </p>
              }
            </div>
          </div>
          {pesagensFiltradas.length === 0 ?
          <div className="text-center py-12 text-slate-400">
              <p>Nenhuma pesagem encontrada com os filtros aplicados.</p>
            </div> :
          tipoRelatorio === 'apartacao_data' ? (
          /* RELATÓRIO POR APARTAÇÃO COM RESUMO POR DATA - IGUAL AO MODELO POR APARTAÇÃO/LOTE */
          (() => {
            // Formatação de números
            const fmtInteiro = (n) => Math.round(n).toLocaleString('pt-BR');
            const fmtDecimal = (n, casas = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
            // Função para buscar faixa de peso cadastrada do lote
            const getFaixaPesoCadastrada = (nomeLote, nomeApartacao) => {
              if (!lotesApartacaoCadastrados || lotesApartacaoCadastrados.length === 0) return null;
              const lote = lotesApartacaoCadastrados.find((l) =>
              l.nome_lote === nomeLote && l.nome_apartacao === nomeApartacao
              );
              return lote ? { min: lote.peso_minimo, max: lote.peso_maximo } : null;
            };
            // Agrupar por apartação
            const porApartacao = {};
            pesagensFiltradas.forEach((p) => {
              const apt = p.nome_apartacao || 'Sem Apartação';
              if (!porApartacao[apt]) porApartacao[apt] = [];
              porApartacao[apt].push(p);
            });
            return (
              <div className="space-y-4">
                  {Object.entries(porApartacao).sort((a, b) => a[0].localeCompare(b[0])).map(([apartacao, animaisApartacao]) => {
                  // Agrupar por data dentro da apartação
                  const porData = {};
                  animaisApartacao.forEach((p) => {
                    const data = p.data_pesagem || 'Sem Data';
                    if (!porData[data]) porData[data] = {};
                    const lote = p.nome_lote || 'Sem Lote';
                    if (!porData[data][lote]) porData[data][lote] = [];
                    porData[data][lote].push(p);
                  });
                  // Calcular totais da apartação
                  const totalApt = animaisApartacao.length;
                  const pesoMedioApt = totalApt > 0 ? animaisApartacao.reduce((s, p) => s + (p.peso || 0), 0) / totalApt : 0;
                  const pesoTotalApt = animaisApartacao.reduce((s, p) => s + (p.peso || 0), 0);
                  const gmdMedioApt = animaisApartacao.filter((p) => p.gmd).length > 0 ?
                  animaisApartacao.filter((p) => p.gmd).reduce((s, p) => s + p.gmd, 0) / animaisApartacao.filter((p) => p.gmd).length :
                  0;
                  // Agrupar por lote para totais
                  const porLote = {};
                  animaisApartacao.forEach((p) => {
                    const lote = p.nome_lote || 'Sem Lote';
                    if (!porLote[lote]) porLote[lote] = [];
                    porLote[lote].push(p);
                  });
                  return (
                    <div key={apartacao} className="mb-6">
                        <div className="border-b-2 border-slate-200 pb-2 mb-3">
                          <h3 className="font-bold text-sm text-slate-800 uppercase">APARTAÇÃO: {apartacao}</h3>
                        </div>
                        {/* Para cada data, mostrar lotes */}
                        {Object.entries(porData).
                      sort((a, b) => a[0].localeCompare(b[0])).
                      map(([data, lotes]) => {
                        const animaisData = Object.values(lotes).flat();
                        const totalData = animaisData.length;
                        const pesoMedioData = totalData > 0 ? animaisData.reduce((s, p) => s + (p.peso || 0), 0) / totalData : 0;
                        const pesoTotalData = animaisData.reduce((s, p) => s + (p.peso || 0), 0);
                        const gmdMedioData = animaisData.filter((p) => p.gmd).length > 0 ?
                        animaisData.filter((p) => p.gmd).reduce((s, p) => s + p.gmd, 0) / animaisData.filter((p) => p.gmd).length :
                        0;
                        return (
                          <div key={data} className="border-t border-slate-200">
                                {/* Subtítulo da Data */}
                                <div className="py-2 mb-1">
                                  <span className="font-semibold text-xs text-slate-700 uppercase">Data: {formatarData(data)}</span>
                                </div>
                                {/* Tabela de Lotes desta Data */}
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-gray-50">
                                      {colunasPainelOrdenadas.map((col) =>
                                  <TableHead key={col.id} className={`text-xs font-bold py-2 ${['qtd', 'faixa', 'menor', 'maior', 'peso_medio', 'arroba_media', 'peso_total', 'arroba_total', 'gmd_medio', 'machos', 'femeas'].includes(col.id) ? 'text-center' : ''}`}>
                                          {col.label}
                                        </TableHead>
                                  )}
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {Object.entries(lotes).sort((a, b) => a[0].localeCompare(b[0])).map(([lote, animais]) => {
                                  const qtd = animais.length;
                                  const pesos = animais.map((a) => a.peso || 0).filter((p) => p > 0);
                                  const menorPeso = pesos.length > 0 ? Math.min(...pesos) : 0;
                                  const maiorPeso = pesos.length > 0 ? Math.max(...pesos) : 0;
                                  const pesoMedioLote = qtd > 0 ? animais.reduce((s, a) => s + (a.peso || 0), 0) / qtd : 0;
                                  const pesoTotalLote = animais.reduce((s, a) => s + (a.peso || 0), 0);
                                  const gmdMedioLote = animais.filter((a) => a.gmd).length > 0 ?
                                  animais.filter((a) => a.gmd).reduce((s, a) => s + a.gmd, 0) / animais.filter((a) => a.gmd).length :
                                  0;
                                  const machos = animais.filter((a) => a.sexo === 'M').length;
                                  const femeas = animais.filter((a) => a.sexo === 'F').length;
                                  const faixaCadastrada = getFaixaPesoCadastrada(lote, apartacao);
                                  return (
                                    <TableRow key={lote} className="hover:bg-gray-50">
                                          <TableCell className="text-xs font-semibold py-2">{lote}</TableCell>
                                          <TableCell className="text-xs text-center font-bold py-2">{fmtInteiro(qtd)}</TableCell>
                                          <TableCell className="text-xs text-center py-2 font-mono">
                                            {faixaCadastrada ? `${fmtInteiro(faixaCadastrada.min)}-${fmtInteiro(faixaCadastrada.max)} kg` : '-'}
                                          </TableCell>
                                          <TableCell className="text-xs text-center py-2 font-mono">{fmtInteiro(menorPeso)} kg</TableCell>
                                          <TableCell className="text-xs text-center py-2 font-mono">{fmtInteiro(maiorPeso)} kg</TableCell>
                                          <TableCell className="text-xs text-center py-2 font-mono font-semibold">{fmtDecimal(pesoMedioLote)} kg</TableCell>
                                          <TableCell className="text-xs text-center py-2 font-mono">{fmtDecimal(pesoTotalLote)} kg</TableCell>
                                          <TableCell className="text-xs text-center py-2 font-mono font-semibold">
                                            {gmdMedioLote > 0 ? fmtDecimal(gmdMedioLote, 3) : '-'}
                                          </TableCell>
                                          <TableCell className="text-xs text-center py-2">{machos > 0 ? fmtInteiro(machos) : '-'}</TableCell>
                                          <TableCell className="text-xs text-center py-2">{femeas > 0 ? fmtInteiro(femeas) : '-'}</TableCell>
                                        </TableRow>);

                                })}
                                  </TableBody>
                                </Table>
                                {/* Subtotal da Data */}
                                <div className="py-2 border-t border-slate-200">
                                  <div className="grid grid-cols-5 gap-4 text-xs text-slate-700">
                                    <div><strong>Subtotal {formatarData(data)}:</strong> {fmtInteiro(totalData)} animais</div>
                                    <div><strong>Peso Médio:</strong> {fmtDecimal(pesoMedioData)} kg</div>
                                    <div><strong>Peso Total:</strong> {fmtDecimal(pesoTotalData)} kg</div>
                                    <div><strong>GMD Médio:</strong> {fmtDecimal(gmdMedioData, 3)} kg/dia</div>
                                    <div><strong>Lotes:</strong> {fmtInteiro(Object.keys(lotes).length)}</div>
                                  </div>
                                </div>
                              </div>);

                      })}
                        {/* TOTAL DE LOTES DA APARTAÇÃO */}
                        <div className="mt-4">
                          <div className="border-b border-slate-200 pb-2 mb-2">
                            <span className="font-bold text-xs text-slate-700 uppercase">TOTAL POR LOTE - {apartacao}</span>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gray-100">
                                <TableHead className="text-xs font-bold py-2">Lote</TableHead>
                                <TableHead className="text-xs font-bold text-center py-2">Qtd</TableHead>
                                <TableHead className="text-xs font-bold text-center py-2">Faixa Exigida</TableHead>
                                <TableHead className="text-xs font-bold text-center py-2">Menor</TableHead>
                                <TableHead className="text-xs font-bold text-center py-2">Maior</TableHead>
                                <TableHead className="text-xs font-bold text-center py-2">Peso Médio</TableHead>
                                <TableHead className="text-xs font-bold text-center py-2">Peso Total</TableHead>
                                <TableHead className="text-xs font-bold text-center py-2">GMD Médio</TableHead>
                                <TableHead className="text-xs font-bold text-center py-2">Machos</TableHead>
                                <TableHead className="text-xs font-bold text-center py-2">Fêmeas</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {Object.entries(porLote).sort((a, b) => a[0].localeCompare(b[0])).map(([lote, animais]) => {
                              const qtd = animais.length;
                              const pesos = animais.map((a) => a.peso || 0).filter((p) => p > 0);
                              const menorPeso = pesos.length > 0 ? Math.min(...pesos) : 0;
                              const maiorPeso = pesos.length > 0 ? Math.max(...pesos) : 0;
                              const pesoMedioLote = qtd > 0 ? animais.reduce((s, a) => s + (a.peso || 0), 0) / qtd : 0;
                              const pesoTotalLote = animais.reduce((s, a) => s + (a.peso || 0), 0);
                              const gmdMedioLote = animais.filter((a) => a.gmd).length > 0 ?
                              animais.filter((a) => a.gmd).reduce((s, a) => s + a.gmd, 0) / animais.filter((a) => a.gmd).length :
                              0;
                              const machos = animais.filter((a) => a.sexo === 'M').length;
                              const femeas = animais.filter((a) => a.sexo === 'F').length;
                              const faixaCadastrada = getFaixaPesoCadastrada(lote, apartacao);
                              return (
                                <TableRow key={lote} className="hover:bg-gray-50">
                                    {colunasPainelOrdenadas.map((col) => {
                                    switch (col.id) {
                                      case 'lote':
                                        return <TableCell key="lote" className="text-xs font-semibold py-2">{lote}</TableCell>;
                                      case 'qtd':
                                        return <TableCell key="qtd" className="text-xs text-center font-bold py-2">{fmtInteiro(qtd)}</TableCell>;
                                      case 'faixa':
                                        return <TableCell key="faixa" className="text-xs text-center py-2 font-mono">{faixaCadastrada ? `${fmtInteiro(faixaCadastrada.min)}-${fmtInteiro(faixaCadastrada.max)} kg` : '-'}</TableCell>;
                                      case 'menor':
                                        return <TableCell key="menor" className="text-xs text-center py-2 font-mono">{fmtInteiro(menorPeso)} kg</TableCell>;
                                      case 'maior':
                                        return <TableCell key="maior" className="text-xs text-center py-2 font-mono">{fmtInteiro(maiorPeso)} kg</TableCell>;
                                      case 'peso_medio':
                                        return <TableCell key="peso_medio" className="text-xs text-center py-2 font-mono font-semibold">{fmtDecimal(pesoMedioLote)} kg</TableCell>;
                                      case 'peso_total':
                                        return <TableCell key="peso_total" className="text-xs text-center py-2 font-mono">{fmtDecimal(pesoTotalLote)} kg</TableCell>;
                                      case 'gmd_medio':
                                        return <TableCell key="gmd_medio" className="text-xs text-center py-2 font-mono font-semibold">{gmdMedioLote > 0 ? fmtDecimal(gmdMedioLote, 3) : '-'}</TableCell>;
                                      case 'machos':
                                        return <TableCell key="machos" className="text-xs text-center py-2">{machos > 0 ? fmtInteiro(machos) : '-'}</TableCell>;
                                      case 'femeas':
                                        return <TableCell key="femeas" className="text-xs text-center py-2">{femeas > 0 ? fmtInteiro(femeas) : '-'}</TableCell>;
                                      default:
                                        return null;
                                    }
                                  })}
                                  </TableRow>);

                            })}
                            </TableBody>
                          </Table>
                        </div>
                        <div className="py-3 border-t-2 border-slate-200 mt-2">
                          <div className="grid grid-cols-5 gap-4 text-xs text-slate-700">
                            <div><strong>Total:</strong> {fmtInteiro(totalApt)} animais</div>
                            <div><strong>Peso Médio:</strong> {fmtDecimal(pesoMedioApt)} kg</div>
                            <div><strong>Peso Total:</strong> {fmtDecimal(pesoTotalApt)} kg</div>
                            <div><strong>GMD Médio:</strong> {fmtDecimal(gmdMedioApt, 3)} kg/dia</div>
                            <div><strong>Lotes:</strong> {fmtInteiro(Object.keys(porLote).length)}</div>
                          </div>
                        </div>
                      </div>);

                })}
                  <div className="mt-6 border-t border-slate-300 pt-4">
                    <h4 className="font-bold text-sm text-slate-800 uppercase mb-2">RESUMO GERAL</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs font-bold py-2">Apartação</TableHead>
                          <TableHead className="text-xs font-bold text-center py-2">Datas</TableHead>
                          <TableHead className="text-xs font-bold text-center py-2">Lotes</TableHead>
                          <TableHead className="text-xs font-bold text-center py-2">Animais</TableHead>
                          <TableHead className="text-xs font-bold text-center py-2">Menor Peso</TableHead>
                          <TableHead className="text-xs font-bold text-center py-2">Maior Peso</TableHead>
                          <TableHead className="text-xs font-bold text-center py-2">Peso Médio</TableHead>
                          <TableHead className="text-xs font-bold text-center py-2">Peso Total</TableHead>
                          <TableHead className="text-xs font-bold text-center py-2">GMD Médio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(porApartacao).sort((a, b) => a[0].localeCompare(b[0])).map(([apartacao, animais]) => {
                        const qtd = animais.length;
                        const datasUnicas = [...new Set(animais.map((a) => a.data_pesagem))].length;
                        const lotesUnicos = [...new Set(animais.map((a) => a.nome_lote))].length;
                        const pesos = animais.map((a) => a.peso || 0).filter((p) => p > 0);
                        const menorPeso = pesos.length > 0 ? Math.min(...pesos) : 0;
                        const maiorPeso = pesos.length > 0 ? Math.max(...pesos) : 0;
                        const pesoMedioApt = qtd > 0 ? animais.reduce((s, a) => s + (a.peso || 0), 0) / qtd : 0;
                        const pesoTotalApt = animais.reduce((s, a) => s + (a.peso || 0), 0);
                        const gmdMedioApt = animais.filter((a) => a.gmd).length > 0 ?
                        animais.filter((a) => a.gmd).reduce((s, a) => s + a.gmd, 0) / animais.filter((a) => a.gmd).length :
                        0;
                        return (
                          <TableRow key={apartacao}>
                              <TableCell className="text-xs font-semibold py-2">{apartacao}</TableCell>
                              <TableCell className="text-xs text-center py-2">{fmtInteiro(datasUnicas)}</TableCell>
                              <TableCell className="text-xs text-center py-2">{fmtInteiro(lotesUnicos)}</TableCell>
                              <TableCell className="text-xs text-center font-bold py-2">{fmtInteiro(qtd)}</TableCell>
                              <TableCell className="text-xs text-center py-2 font-mono">{fmtInteiro(menorPeso)} kg</TableCell>
                              <TableCell className="text-xs text-center py-2 font-mono">{fmtInteiro(maiorPeso)} kg</TableCell>
                              <TableCell className="text-xs text-center py-2 font-mono font-semibold">{fmtDecimal(pesoMedioApt)} kg</TableCell>
                              <TableCell className="text-xs text-center py-2 font-mono">{fmtDecimal(pesoTotalApt)} kg</TableCell>
                              <TableCell className="text-xs text-center py-2 font-mono font-semibold">
                                {gmdMedioApt > 0 ? fmtDecimal(gmdMedioApt, 3) : '-'}
                              </TableCell>
                            </TableRow>);

                      })}
                        <TableRow className="font-bold bg-slate-50 border-t-2 border-slate-200">
                          <TableCell className="text-xs font-bold py-2 text-slate-800">TOTAL GERAL</TableCell>
                          <TableCell className="text-xs text-center font-bold py-2 text-slate-800">{[...new Set(pesagensFiltradas.map((p) => p.data_pesagem))].length}</TableCell>
                          <TableCell className="text-xs text-center font-bold py-2 text-slate-800">{[...new Set(pesagensFiltradas.map((p) => p.nome_lote))].length}</TableCell>
                          <TableCell className="text-xs text-center font-bold py-2 text-slate-800">{totalAnimais.toLocaleString('pt-BR')}</TableCell>
                          <TableCell className="text-xs text-center py-2 font-mono text-slate-800">{pesagensFiltradas.length > 0 ? Math.min(...pesagensFiltradas.map((p) => p.peso || 999999).filter((p) => p > 0)).toLocaleString('pt-BR') : 0}</TableCell>
                          <TableCell className="text-xs text-center py-2 font-mono text-slate-800">{pesagensFiltradas.length > 0 ? Math.max(...pesagensFiltradas.map((p) => p.peso || 0)).toLocaleString('pt-BR') : 0}</TableCell>
                          <TableCell className="text-xs text-center py-2 font-mono font-bold text-slate-800">{pesoMedio.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</TableCell>
                          <TableCell className="text-xs text-center py-2 font-mono font-bold text-slate-800">{arrobaMediaGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-xs text-center py-2 font-mono text-slate-800">{pesoTotalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</TableCell>
                          <TableCell className="text-xs text-center py-2 font-mono text-slate-800">{arrobaTotalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-xs text-center py-2 font-mono text-slate-800">{ganhoMedioGeral.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</TableCell>
                          <TableCell className="text-xs text-center py-2 font-mono text-slate-800">{ganhoArrobaMedioGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-xs text-center py-2 font-mono text-slate-800">{ganhoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</TableCell>
                          <TableCell className="text-xs text-center py-2 font-mono text-slate-800">{ganhoArrobaTotalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-xs text-center py-2 font-mono text-slate-800">{diasMedioGeral.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</TableCell>
                          <TableCell className="text-xs text-center py-2 font-mono font-bold text-slate-800">{gmdMedio.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-6 pt-2 border-t border-gray-300 text-center text-xs text-gray-500">
                    <p>Impresso em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                  </div>
                </div>);

          })()) :
          tipoRelatorio === 'apartacao' ? (
          /* RELATÓRIO POR APARTAÇÃO/LOTE */
          (() => {
            // Agrupar por apartação e lote
            const porApartacao = {};
            pesagensFiltradas.forEach((p) => {
              const apt = p.nome_apartacao || 'Sem Apartação';
              const lote = p.nome_lote || 'Sem Lote';
              if (!porApartacao[apt]) porApartacao[apt] = {};
              if (!porApartacao[apt][lote]) porApartacao[apt][lote] = [];
              porApartacao[apt][lote].push(p);
            });
            // Função para buscar faixa de peso cadastrada do lote
            const getFaixaPesoCadastrada = (nomeLote, nomeApartacao) => {
              if (!lotesApartacaoCadastrados || lotesApartacaoCadastrados.length === 0) return null;
              const lote = lotesApartacaoCadastrados.find((l) =>
              l.nome_lote === nomeLote && l.nome_apartacao === nomeApartacao
              );
              return lote ? { min: lote.peso_minimo, max: lote.peso_maximo } : null;
            };
            // Formatação de números
            const fmtInteiro = (n) => Math.round(n).toLocaleString('pt-BR');
            const fmtDecimal = (n, casas = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
            // Renderizar célula de detalhe
            const renderCelulaDetalhe = (animal, colunaId) => {
              const fmtNum = (n, casas = 0) => typeof n === 'number' ? n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }) : '-';
              const fmtMoney = (n) => typeof n === 'number' ? formatarMoeda(n) : '-';
              switch (colunaId) {
                case 'numero_animal':return <TableCell className="text-xs font-medium py-1 border border-gray-200">{animal.numero_animal}</TableCell>;
                case 'data_pesagem':return <TableCell className="text-xs py-1 border border-gray-200">{formatarData(animal.data_pesagem)}</TableCell>;
                case 'tipo_manejo':return <TableCell className="text-xs py-1 border border-gray-200">{animal.tipo_manejo || '-'}</TableCell>;
                case 'motivo_saida':return <TableCell className="text-xs py-1 border border-gray-200">{animal.motivo_saida || '-'}</TableCell>;
                case 'sexo':return <TableCell className="text-xs py-1 border border-gray-200">{animal.sexo || '-'}</TableCell>;
                case 'raca':return <TableCell className="text-xs py-1 border border-gray-200">{animal.raca || '-'}</TableCell>;
                case 'era':return <TableCell className="text-xs py-1 border border-gray-200">{animal.era || '-'}</TableCell>;
                case 'marca':return <TableCell className="text-xs py-1 border border-gray-200">{animal.marca || '-'}</TableCell>;
                case 'nome_apartacao':return <TableCell className="text-xs py-1 border border-gray-200">{animal.nome_apartacao || '-'}</TableCell>;
                case 'nome_lote':return <TableCell className="text-xs py-1 border border-gray-200">{animal.nome_lote || '-'}</TableCell>;
                case 'peso':return <TableCell className="text-xs text-right font-mono py-1 border border-gray-200">{fmtNum(animal.peso)}</TableCell>;
                case 'peso_anterior':return <TableCell className="text-xs text-right font-mono py-1 border border-gray-200">{animal.peso_anterior != null ? fmtNum(animal.peso_anterior) : '-'}</TableCell>;
                case 'dias':return <TableCell className="text-xs text-right font-mono py-1 border border-gray-200">{animal.dias ?? '-'}</TableCell>;
                case 'ganho':return <TableCell className="text-xs text-right font-mono py-1 border border-gray-200">{animal.ganho != null ? fmtNum(animal.ganho, 2) : '-'}</TableCell>;
                case 'gmd':return <TableCell className={`text-xs text-right font-mono py-1 border border-gray-200 ${animal.gmd && animal.gmd > 0 ? 'text-emerald-600' : animal.gmd && animal.gmd < 0 ? 'text-red-600' : ''}`}>{animal.gmd != null ? fmtNum(animal.gmd, 3) : '-'}</TableCell>;
                case 'frigorifico':return <TableCell className="text-xs py-1 border border-gray-200">{animal.frigorifico || '-'}</TableCell>;
                case 'embarque_nome':return <TableCell className="text-xs py-1 border border-gray-200">{animal.embarque_nome || '-'}</TableCell>;
                case 'documento_tipo':return <TableCell className="text-xs py-1 border border-gray-200">{animal.documento_tipo || '-'}</TableCell>;
                case 'documento_numero':return <TableCell className="text-xs py-1 border border-gray-200">{animal.documento_numero || '-'}</TableCell>;
                case 'motorista_nome':return <TableCell className="text-xs py-1 border border-gray-200">{animal.motorista_nome || '-'}</TableCell>;
                case 'placa_carreta':return <TableCell className="text-xs py-1 border border-gray-200">{animal.placa_carreta || '-'}</TableCell>;
                case 'comprador':return <TableCell className="text-xs py-1 border border-gray-200">{animal.comprador || '-'}</TableCell>;
                case 'destino_venda':return <TableCell className="text-xs py-1 border border-gray-200">{animal.destino_venda || '-'}</TableCell>;
                case 'valor_arroba':return <TableCell className="text-xs text-right font-mono py-1 border border-gray-200">{animal.valor_arroba != null ? fmtMoney(animal.valor_arroba) : '-'}</TableCell>;
                case 'valor_venda_total':return <TableCell className="text-xs text-right font-mono py-1 border border-gray-200">{animal.valor_venda_total != null ? fmtMoney(animal.valor_venda_total) : '-'}</TableCell>;
                case 'quantidade_arrobas':return <TableCell className="text-xs text-right font-mono py-1 border border-gray-200">{animal.quantidade_arrobas != null ? `${formatarDecimal(animal.quantidade_arrobas, 2)} @` : '-'}</TableCell>;
                case 'origem_animal':return <TableCell className="text-xs py-1 border border-gray-200">{animal.origem_animal || '-'}</TableCell>;
                case 'valor_pago_cabeca':return <TableCell className="text-xs text-right font-mono py-1 border border-gray-200">{animal.valor_pago_cabeca != null ? fmtMoney(animal.valor_pago_cabeca) : '-'}</TableCell>;
                case 'observacao':return <TableCell className="text-xs py-1 border border-gray-200 max-w-[120px] truncate">{animal.observacao || '-'}</TableCell>;
                default:return <TableCell className="text-xs py-1 border border-gray-200">-</TableCell>;
              }
            };
            return (
              <div className="space-y-">
                  <div className="flex gap-2 print:hidden">
                    <Button
                    variant={mostrarDetalhes ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMostrarDetalhes(!mostrarDetalhes)}
                    className="h-8 text-xs gap-1">
                    
                      {mostrarDetalhes ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {mostrarDetalhes ? 'Ocultar Detalhes' : 'Mostrar Detalhes'}
                    </Button>
                    {mostrarDetalhes &&
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowConfigColunasDetalhes(true)}
                    className="h-8 text-xs gap-1">
                    
                        <Settings className="w-3.5 h-3.5" />
                        Colunas Detalhes
                      </Button>
                  }
                    <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowConfigColunasPainel(true)}
                    className="h-8 text-xs gap-1">
                    
                      <Settings className="w-3.5 h-3.5" />
                      Colunas Painel
                    </Button>
                  </div>
                  {Object.entries(porApartacao).sort((a, b) => a[0].localeCompare(b[0])).map(([apartacao, lotes]) => {
                  // Calcular totais da apartação
                  const todosAnimaisApt = Object.values(lotes).flat();
                  const totalApt = todosAnimaisApt.length;
                  const pesoMedioApt = totalApt > 0 ? todosAnimaisApt.reduce((s, p) => s + (p.peso || 0), 0) / totalApt : 0;
                  const pesoTotalApt = todosAnimaisApt.reduce((s, p) => s + (p.peso || 0), 0);
                  const animaisAptComHistorico = todosAnimaisApt.filter(temHistoricoPeso);
                  const ganhoTotalApt = animaisAptComHistorico.reduce((s, p) => s + (p.ganho || 0), 0);
                  const ganhoMedioApt = animaisAptComHistorico.length > 0 ? ganhoTotalApt / animaisAptComHistorico.length : 0;
                  const diasMedioApt = animaisAptComHistorico.length > 0 ?
                  animaisAptComHistorico.reduce((s, p) => s + (p.dias || 0), 0) / animaisAptComHistorico.length :
                  0;
                  const gmdMedioApt = animaisAptComHistorico.length > 0 ?
                  animaisAptComHistorico.reduce((s, p) => s + (p.gmd || 0), 0) / animaisAptComHistorico.length :
                  0;
                  return (
                    <div key={apartacao}>
                        <div className="my-1 border-b-1 border-slate-200">
                          <h3 className="text-slate-800 text-sm font-bold normal-case">APARTAÇÃO: {apartacao}</h3>
                        </div>
                        <Table>
                          <TableHeader className="[&_tr]:border">
                            <TableRow>
                              {colunasPainelOrdenadas.map((col) =>
                            <TableHead key={col.id} className="h-10 text-left font-medium p-2 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] px-2 py-1 text-gray-700 text-xs align-middle border-r border-b border-a gray-300 whitespace-normal break-words">
                                  {col.label}
                                </TableHead>
                            )}
                            </TableRow>
                          </TableHeader>
                          <TableBody className="p-2 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] px-2 py-1 text-gray-700 text-xs align-middle border-r border-b border-gray-300 whitespace-normal break-words">
                            {Object.entries(lotes).sort((a, b) => a[0].localeCompare(b[0])).map(([lote, animais]) => {
                            const qtd = animais.length;
                            const pesos = animais.map((a) => a.peso || 0).filter((p) => p > 0);
                            const menorPeso = pesos.length > 0 ? Math.min(...pesos) : 0;
                            const maiorPeso = pesos.length > 0 ? Math.max(...pesos) : 0;
                            const pesoMedioLote = qtd > 0 ? animais.reduce((s, a) => s + (a.peso || 0), 0) / qtd : 0;
                            const pesoTotalLote = animais.reduce((s, a) => s + (a.peso || 0), 0);
                            const animaisComHistorico = animais.filter(temHistoricoPeso);
                            const ganhoTotalLote = animaisComHistorico.reduce((s, a) => s + (a.ganho || 0), 0);
                            const ganhoMedioLote = animaisComHistorico.length > 0 ? ganhoTotalLote / animaisComHistorico.length : 0;
                            const diasMedioLote = animaisComHistorico.length > 0 ? animaisComHistorico.reduce((s, a) => s + (a.dias || 0), 0) / animaisComHistorico.length : 0;
                            const gmdMedioLote = animaisComHistorico.length > 0 ?
                            animaisComHistorico.reduce((s, a) => s + (a.gmd || 0), 0) / animaisComHistorico.length :
                            0;
                            const machos = animais.filter((a) => a.sexo === 'M').length;
                            const femeas = animais.filter((a) => a.sexo === 'F').length;
                            const faixaCadastrada = getFaixaPesoCadastrada(lote, apartacao);
                            return (
                              <React.Fragment key={lote}>
                                  <TableRow className="hover:bg-gray-50">
                                    {colunasPainelOrdenadas.map((col) => {
                                    switch (col.id) {
                                      case 'lote':
                                        return <TableCell key="lote" className="p-2 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] px-2 py-1 text-gray-700 text-xs align-middle border gray-300 whitespace-normal break-words">{lote}</TableCell>;
                                      case 'qtd':
                                        return <TableCell key="qtd" className="p-2 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] px-2 py-1 text-gray-700 text-xs align-middle border-r border-b border-gray-300 whitespace-normal break-words">{fmtInteiro(qtd)}</TableCell>;
                                      case 'faixa':
                                        return <TableCell key="faixa" className="p-2 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] px-2 py-1 text-gray-700 text-xs align-middle border gray-300 whitespace-normal break-words">{faixaCadastrada ? `${fmtInteiro(faixaCadastrada.min)}-${fmtInteiro(faixaCadastrada.max)}` : '-'}</TableCell>;
                                      case 'menor':
                                        return <TableCell key="menor" className="p-2 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] px-2 py-1 text-gray-700 text-xs align-middle border-r border-b border-gray-300 whitespace-normal break-words">{fmtInteiro(menorPeso)}</TableCell>;
                                      case 'maior':
                                        return <TableCell key="maior" className="p-2 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] px-2 py-1 text-gray-700 text-xs align-middle border-r border-b border-gray-300 whitespace-normal break-words">{fmtInteiro(maiorPeso)}</TableCell>;
                                      case 'peso_medio':
                                        return <TableCell key="peso_medio" className="p-2 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] px-2 py-1 text-gray-700 text-xs align-middle border-r border-b border-gray-300 whitespace-normal break-words">{fmtDecimal(pesoMedioLote)}</TableCell>;
                                      case 'arroba_media':
                                        return <TableCell key="arroba_media" className="p-2 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] px-2 py-1 text-gray-700 text-xs align-middle border-r border-b border-gray-300 whitespace-normal break-words">{fmtDecimal(pesoMedioLote / 30, 2)}</TableCell>;
                                      case 'peso_total':
                                        return <TableCell key="peso_total" className="p-2 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] px-2 py-1 text-gray-700 text-xs align-middle border-r border-b border-gray-300 whitespace-normal break-words">{fmtDecimal(pesoTotalLote)}</TableCell>;
                                      case 'arroba_total':
                                        return <TableCell key="arroba_total" className="p-2 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] px-2 py-1 text-gray-700 text-xs align-middle border-r border-b border-gray-300 whitespace-normal break-words">{fmtDecimal(pesoTotalLote / 30, 2)}</TableCell>;
                                      case 'ganho_medio':
                                        return <TableCell key="ganho_medio" className="p-2 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] px-2 py-1 text-gray-700 text-xs align-middle border-r border-b border-gray-300 whitespace-normal break-words">{ganhoMedioLote ? fmtDecimal(ganhoMedioLote, 1) : '-'}</TableCell>;
                                      case 'ganho_medio_arroba':
                                        return <TableCell key="ganho_medio_arroba" className="p-2 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] px-2 py-1 text-gray-700 text-xs align-middle border-r border-b border-gray-300 whitespace-normal break-words">{ganhoMedioLote ? fmtDecimal(ganhoMedioLote / 30, 2) : '-'}</TableCell>;
                                      case 'ganho_total':
                                        return <TableCell key="ganho_total" className="p-2 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] px-2 py-1 text-gray-700 text-xs align-middle border-r border-b border-gray-300 whitespace-normal break-words">{ganhoTotalLote ? fmtDecimal(ganhoTotalLote, 1) : '-'}</TableCell>;
                                      case 'ganho_total_arroba':
                                        return <TableCell key="ganho_total_arroba" className="p-2 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] px-2 py-1 text-gray-700 text-xs align-middle border-r border-b border-gray-300 whitespace-normal break-words">{ganhoTotalLote ? fmtDecimal(ganhoTotalLote / 30, 2) : '-'}</TableCell>;
                                      case 'dias_medio':
                                        return <TableCell key="dias_medio" className="p-2 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] px-2 py-1 text-gray-700 text-xs align-middle border-r border-b border-gray-300 whitespace-normal break-words">{diasMedioLote ? fmtDecimal(diasMedioLote, 1) : '-'}</TableCell>;
                                      case 'gmd_medio':
                                        return <TableCell key="gmd_medio" className="p-2 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] px-2 py-1 text-gray-700 text-xs align-middle border-r border-b border-gray-300 whitespace-normal break-words">{gmdMedioLote > 0 ? fmtDecimal(gmdMedioLote, 3) : '-'}</TableCell>;
                                      case 'machos':
                                        return <TableCell key="machos" className="p-2 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] px-2 py-1 text-gray-700 text-xs align-middle border-r border-b border-gray-300 whitespace-normal break-words">{machos > 0 ? fmtInteiro(machos) : '-'}</TableCell>;
                                      case 'femeas':
                                        return <TableCell key="femeas" className="p-2 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] px-2 py-1 text-gray-700 text-xs align-middle border-r border-b border-gray-300 whitespace-normal break-words">{femeas > 0 ? fmtInteiro(femeas) : '-'}</TableCell>;
                                      default:
                                        return null;
                                    }
                                  })}
                                  </TableRow>
                                  
                                  {/* Detalhes dos animais do lote */}
                                  {mostrarDetalhes &&
                                <TableRow>
                                      <TableCell colSpan={10} className="p-0 bg-white">
                                        <div className="p-2 ml-4">
                                          <Table>
                                            <TableHeader>
                                              <TableRow className="bg-gray-100">
                                                {colunasDetalhesOrdenadas.map((col) =>
                                            <TableHead key={col.id} className={`text-[10px] font-bold py-1 border border-gray-200 ${['peso', 'peso_anterior', 'dias', 'ganho', 'gmd'].includes(col.id) ? 'text-right' : ''}`}>
                                                    {col.label}
                                                  </TableHead>
                                            )}
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {animais.sort((a, b) => (a.numero_animal || '').localeCompare(b.numero_animal || '')).map((animal, idx) =>
                                          <TableRow key={animal.id || idx} className="hover:bg-gray-50">
                                                  {colunasDetalhesOrdenadas.map((col) => renderCelulaDetalhe(animal, col.id))}
                                                </TableRow>
                                          )}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                }
                                </React.Fragment>);

                          })}
                          </TableBody>
                        </Table>
                        <div className="py-1 border-t-1 border-slate-200">
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-xs text-slate-700">
                            <div><strong>Total:</strong> {fmtInteiro(totalApt)} animais</div>
                            <div><strong>Peso Médio:</strong> {fmtDecimal(pesoMedioApt)} kg</div>
                            <div><strong>Média (@):</strong> {fmtDecimal(pesoMedioApt / 30, 2)} @</div>
                            <div><strong>Peso Total:</strong> {fmtDecimal(pesoTotalApt)} kg</div>
                            <div><strong>Total (@):</strong> {fmtDecimal(pesoTotalApt / 30, 2)} @</div>
                            <div><strong>Lotes:</strong> {fmtInteiro(Object.keys(lotes).length)}</div>
                          </div>
                        </div>
                      </div>);

                })}
                  
















































































                
                </div>);

          })()) :
          tipoRelatorio === 'vendas' ?
          (() => {
            const vendas = pesagensFiltradas.filter((p) => p.tipo_manejo === 'Saída' && p.motivo_saida === 'Venda');
            if (vendas.length === 0) {
              return (
                <div className="text-center py-12 text-slate-400">
                    <p>Nenhuma venda encontrada com os filtros aplicados.</p>
                  </div>);

            }
            const fmtNum = (n, d = 2) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
            const fmtInt = (n) => Number(n || 0).toLocaleString('pt-BR');
            const fmtBRL = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const total = vendas.length;
            const pesoTotal = vendas.reduce((s, v) => s + (Number(v.peso) || 0), 0);
            const pesoMedio = total ? pesoTotal / total : 0;
            const mediaArrobasPeso = pesoMedio / 30;
            const arrobasInformadas = vendas.
            map((v) => Number(v.valor_arroba)).
            filter((n) => !isNaN(n) && n > 0);
            const mediaValorArroba = arrobasInformadas.length ?
            arrobasInformadas.reduce((s, n) => s + n, 0) / arrobasInformadas.length :
            0;
            const valorTotal = vendas.reduce((s, v) => {
              const direto = Number(v.valor_venda_total);
              if (!isNaN(direto) && direto > 0) return s + direto;
              const calc = (Number(v.peso) || 0) / 30 * (Number(v.valor_arroba) || 0);
              return s + (isNaN(calc) ? 0 : calc);
            }, 0);
            // Agrupar por Marca
            const porMarca = vendas.reduce((acc, v) => {
              const k = v.marca || 'Sem Marca';
              if (!acc[k]) acc[k] = [];
              acc[k].push(v);
              return acc;
            }, {});
            // Agrupar por Comprador
            const porComprador = vendas.reduce((acc, v) => {
              const k = v.comprador || 'Sem Comprador';
              if (!acc[k]) acc[k] = [];
              acc[k].push(v);
              return acc;
            }, {});
            return (
              <div className="space-y-4">
                  <div className="flex gap-2 print:hidden">
                    <Button
                    variant={mostrarDetalhesVendas ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMostrarDetalhesVendas(!mostrarDetalhesVendas)}
                    className="h-8 text-xs gap-1">
                    
                      {mostrarDetalhesVendas ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {mostrarDetalhesVendas ? 'Ocultar Detalhes' : 'Mostrar Detalhes'}
                    </Button>
                    {mostrarDetalhesVendas &&
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowConfigColunasVendas(true)}
                    className="h-8 text-xs gap-1">
                    
                        <Settings className="w-3.5 h-3.5" />
                        Colunas Detalhes
                      </Button>
                  }
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs font-bold py-2">Métrica</TableHead>
                        <TableHead className="text-xs font-bold text-right py-2">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow className="hover:bg-gray-50">
                        <TableCell className="text-xs py-2">Animais vendidos</TableCell>
                        <TableCell className="text-xs text-right font-mono py-2">{fmtInt(total)}</TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-gray-50">
                        <TableCell className="text-xs py-2">Peso total (kg)</TableCell>
                        <TableCell className="text-xs text-right font-mono py-2">{fmtNum(pesoTotal)}</TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-gray-50">
                        <TableCell className="text-xs py-2">Peso médio (kg)</TableCell>
                        <TableCell className="text-xs text-right font-mono py-2">{fmtNum(pesoMedio)}</TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-gray-50">
                        <TableCell className="text-xs py-2">Média (@)</TableCell>
                        <TableCell className="text-xs text-right font-mono py-2">{fmtNum(mediaArrobasPeso)}</TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-gray-50">
                        <TableCell className="text-xs py-2">Média valor da arroba</TableCell>
                        <TableCell className="text-xs text-right font-mono py-2">{fmtBRL(mediaValorArroba)}</TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-gray-50">
                        <TableCell className="text-xs py-2 font-bold text-slate-800">Valor total</TableCell>
                        <TableCell className="text-xs text-right font-mono py-2 font-bold text-slate-800">{fmtBRL(valorTotal)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                  <div className="mt-8 mb-4">
                    <div className="border-b border-slate-200 pb-2 mb-2"><span className="font-bold text-sm text-slate-800 uppercase">TOTAIS POR MARCA</span></div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs font-bold py-2">Marca</TableHead>
                          <TableHead className="text-xs font-bold text-center py-2">Qtd</TableHead>
                          <TableHead className="text-xs font-bold text-right py-2">Peso Total (kg)</TableHead>
                          <TableHead className="text-xs font-bold text-right py-2">Peso Médio (kg)</TableHead>
                          <TableHead className="text-xs font-bold text-right py-2">Média (@)</TableHead>
                          <TableHead className="text-xs font-bold text-right py-2">Média Valor @</TableHead>
                          <TableHead className="text-xs font-bold text-right py-2">Valor Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(porMarca).sort((a, b) => a[0].localeCompare(b[0])).map(([marca, items]) => {
                        const qtd = items.length;
                        const pTot = items.reduce((s, i) => s + (Number(i.peso) || 0), 0);
                        const pMed = qtd ? pTot / qtd : 0;
                        const atMed = pMed / 30;
                        const arrs = items.map((i) => Number(i.valor_arroba)).filter((n) => !isNaN(n) && n > 0);
                        const medValAt = arrs.length ? arrs.reduce((s, n) => s + n, 0) / arrs.length : 0;
                        const vTot = items.reduce((s, v) => {
                          const d = Number(v.valor_venda_total);
                          if (!isNaN(d) && d > 0) return s + d;
                          const calc = (Number(v.peso) || 0) / 30 * (Number(v.valor_arroba) || 0);
                          return s + (isNaN(calc) ? 0 : calc);
                        }, 0);
                        return (
                          <TableRow key={marca} className="hover:bg-gray-50">
                              <TableCell className="text-xs py-2">{marca}</TableCell>
                              <TableCell className="text-xs text-center py-2">{fmtInt(qtd)}</TableCell>
                              <TableCell className="text-xs text-right font-mono py-2">{fmtNum(pTot)}</TableCell>
                              <TableCell className="text-xs text-right font-mono py-2">{fmtNum(pMed)}</TableCell>
                              <TableCell className="text-xs text-right font-mono py-2">{fmtNum(atMed)}</TableCell>
                              <TableCell className="text-xs text-right font-mono py-2">{fmtBRL(medValAt)}</TableCell>
                              <TableCell className="text-xs text-right font-mono py-2 font-semibold">{fmtBRL(vTot)}</TableCell>
                            </TableRow>);

                      })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-8 mb-4">
                    <div className="border-b border-slate-200 pb-2 mb-2"><span className="font-bold text-sm text-slate-800 uppercase">TOTAIS POR COMPRADOR</span></div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs font-bold py-2">Comprador</TableHead>
                          <TableHead className="text-xs font-bold text-center py-2">Qtd</TableHead>
                          <TableHead className="text-xs font-bold text-right py-2">Peso Total (kg)</TableHead>
                          <TableHead className="text-xs font-bold text-right py-2">Valor Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(porComprador).sort((a, b) => a[0].localeCompare(b[0])).map(([comprador, items]) => {
                        const qtd = items.length;
                        const pTot = items.reduce((s, i) => s + (Number(i.peso) || 0), 0);
                        const vTot = items.reduce((s, v) => {
                          const d = Number(v.valor_venda_total);
                          if (!isNaN(d) && d > 0) return s + d;
                          const calc = (Number(v.peso) || 0) / 30 * (Number(v.valor_arroba) || 0);
                          return s + (isNaN(calc) ? 0 : calc);
                        }, 0);
                        return (
                          <TableRow key={comprador} className="hover:bg-gray-50">
                              <TableCell className="text-xs py-2">{comprador}</TableCell>
                              <TableCell className="text-xs text-center py-2">{fmtInt(qtd)}</TableCell>
                              <TableCell className="text-xs text-right font-mono py-2">{fmtNum(pTot)}</TableCell>
                              <TableCell className="text-xs text-right font-mono py-2 font-semibold">{fmtBRL(vTot)}</TableCell>
                            </TableRow>);

                      })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-8">
                    <div className="border-b border-slate-200 pb-2 mb-4"><span className="font-bold text-sm text-slate-800 uppercase">VENDAS POR COMPRADOR (DETALHADO)</span></div>
                    {Object.entries(porComprador).sort((a, b) => a[0].localeCompare(b[0])).map(([comprador, items]) => {
                    const qtd = items.length;
                    const pTot = items.reduce((s, i) => s + (Number(i.peso) || 0), 0);
                    const pMed = qtd ? pTot / qtd : 0;
                    const atMed = pMed / 30;
                    const vTot = items.reduce((s, v) => {
                      const d = Number(v.valor_venda_total);
                      if (!isNaN(d) && d > 0) return s + d;
                      const calc = (Number(v.peso) || 0) / 30 * (Number(v.valor_arroba) || 0);
                      return s + (isNaN(calc) ? 0 : calc);
                    }, 0);
                    return (
                      <div key={comprador} className="mb-6">
                          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 mb-2">
                            <h3 className="font-bold text-sm text-slate-800 uppercase mb-2">COMPRADOR: {comprador}</h3>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs text-slate-600">
                              <div><strong>Total:</strong> {fmtInt(qtd)} animais</div>
                              <div><strong>Peso Médio:</strong> {fmtNum(pMed)} kg</div>
                              <div><strong>Peso Total:</strong> {fmtNum(pTot)} kg</div>
                              <div><strong>Média (@):</strong> {fmtNum(atMed)}</div>
                              <div><strong>Valor Total:</strong> {fmtBRL(vTot)}</div>
                            </div>
                          </div>
                          {mostrarDetalhesVendas &&
                        <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    {colunasVendasOrdenadas.map((col) =>
                                <TableHead key={col.id} className={`text-xs font-bold py-2 ${['peso', 'quantidade_arrobas_calc', 'valor_arroba', 'valor_total_calc'].includes(col.id) ? 'text-right' : ''}`}>{col.label}</TableHead>
                                )}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {items.map((v) => {
                                const qtdAt = (Number(v.peso) || 0) / 30;
                                const vTotal = !isNaN(Number(v.valor_venda_total)) && Number(v.valor_venda_total) > 0 ?
                                Number(v.valor_venda_total) :
                                (Number(v.peso) || 0) / 30 * (Number(v.valor_arroba) || 0);
                                const renderCell = (id) => {
                                  switch (id) {
                                    case 'comprador':return <TableCell key={id} className="text-xs py-2">{v.comprador || '-'}</TableCell>;
                                    case 'data_pesagem':return <TableCell key={id} className="text-xs py-2">{v.data_pesagem ? v.data_pesagem.split('T')[0].split('-').reverse().join('/') : '-'}</TableCell>;
                                    case 'numero_animal':return <TableCell key={id} className="text-xs font-medium py-2">{v.numero_animal}</TableCell>;
                                    case 'peso':return <TableCell key={id} className="text-xs text-right font-mono py-2">{fmtNum(v.peso, 0)}</TableCell>;
                                    case 'quantidade_arrobas_calc':return <TableCell key={id} className="text-xs text-right font-mono py-2">{fmtNum(qtdAt, 2)}</TableCell>;
                                    case 'valor_arroba':return <TableCell key={id} className="text-xs text-right font-mono py-2">{fmtBRL(v.valor_arroba)}</TableCell>;
                                    case 'valor_total_calc':return <TableCell key={id} className="text-xs text-right font-mono py-2 font-semibold">{fmtBRL(vTotal)}</TableCell>;
                                    case 'destino_venda':return <TableCell key={id} className="text-xs py-2">{v.destino_venda || '-'}</TableCell>;
                                    case 'nome_lote':return <TableCell key={id} className="text-xs py-2">{v.nome_lote || '-'}</TableCell>;
                                    case 'nome_apartacao':return <TableCell key={id} className="text-xs py-2">{v.nome_apartacao || '-'}</TableCell>;
                                    case 'sexo':return <TableCell key={id} className="text-xs py-2">{v.sexo || '-'}</TableCell>;
                                    case 'raca':return <TableCell key={id} className="text-xs py-2">{v.raca || '-'}</TableCell>;
                                    case 'era':return <TableCell key={id} className="text-xs py-2">{v.era || '-'}</TableCell>;
                                    case 'marca':return <TableCell key={id} className="text-xs py-2">{v.marca || '-'}</TableCell>;
                                    case 'observacao':return <TableCell key={id} className="text-xs py-2 max-w-[160px] truncate">{v.observacao || '-'}</TableCell>;
                                    default:return <TableCell key={id} className="text-xs py-2">-</TableCell>;
                                  }
                                };
                                return (
                                  <TableRow key={v.id} className="hover:bg-gray-50">
                                        {colunasVendasOrdenadas.map((col) => renderCell(col.id))}
                                      </TableRow>);

                              })}
                                </TableBody>
                              </Table>
                            </div>
                        }
                        </div>);

                  })}
                  </div>
                  <div className="mt-2 text-xs text-right font-semibold">
                    TOTAL GERAL: {fmtInt(total)} animais | Peso Total: {fmtNum(pesoTotal)} kg | Peso Médio: {fmtNum(pesoMedio)} kg | Média (@): {fmtNum(mediaArrobasPeso)} | Valor Total: {fmtBRL(valorTotal)}
                  </div>
                </div>);

          })() :
          tipoRelatorio === 'sintetico' ? (
          /* RELATÓRIO SINTÉTICO - MATRIZ */
          (() => {
            const getValorEixo = (p, eixo) => {
              switch (eixo) {
                case 'nome_lote':return p.nome_lote || 'Sem Lote';
                case 'nome_apartacao':return p.nome_apartacao || 'Sem Apartação';
                case 'sexo':return p.sexo === 'M' ? 'Macho' : p.sexo === 'F' ? 'Fêmea' : 'Sem Sexo';
                case 'raca':return p.raca || 'Sem Raça';
                case 'mes':
                  if (!p.data_pesagem) return 'Sem Data';
                  return format(new Date(p.data_pesagem), 'MMM/yyyy', { locale: ptBR });
                default:return 'N/A';
              }
            };
            const linhasY = [...new Set(pesagensFiltradas.map((p) => getValorEixo(p, eixoYSintetico)))].sort();
            const colunasX = [...new Set(pesagensFiltradas.map((p) => getValorEixo(p, eixoXSintetico)))].sort();
            const matriz = {};
            const totaisLinha = {};
            const totaisColuna = {};
            linhasY.forEach((linha) => {
              matriz[linha] = {};
              totaisLinha[linha] = { qtd: 0, pesoTotal: 0, gmdTotal: 0, gmdCount: 0 };
              colunasX.forEach((col) => {
                matriz[linha][col] = { qtd: 0, pesoTotal: 0, gmdTotal: 0, gmdCount: 0 };
              });
            });
            colunasX.forEach((col) => {
              totaisColuna[col] = { qtd: 0, pesoTotal: 0, gmdTotal: 0, gmdCount: 0 };
            });
            pesagensFiltradas.forEach((p) => {
              const linha = getValorEixo(p, eixoYSintetico);
              const col = getValorEixo(p, eixoXSintetico);
              matriz[linha][col].qtd++;
              matriz[linha][col].pesoTotal += p.peso || 0;
              if (p.gmd) {
                matriz[linha][col].gmdTotal += p.gmd;
                matriz[linha][col].gmdCount++;
              }
              totaisLinha[linha].qtd++;
              totaisLinha[linha].pesoTotal += p.peso || 0;
              if (p.gmd) {
                totaisLinha[linha].gmdTotal += p.gmd;
                totaisLinha[linha].gmdCount++;
              }
              totaisColuna[col].qtd++;
              totaisColuna[col].pesoTotal += p.peso || 0;
              if (p.gmd) {
                totaisColuna[col].gmdTotal += p.gmd;
                totaisColuna[col].gmdCount++;
              }
            });
            const totalGeral = {
              qtd: pesagensFiltradas.length,
              pesoMedio: pesoMedio,
              gmdMedio: gmdMedio
            };
            const eixoYLabel = EIXO_Y_OPCOES.find((o) => o.value === eixoYSintetico)?.label || 'Linha';
            const eixoXLabel = EIXO_X_OPCOES.find((o) => o.value === eixoXSintetico)?.label || 'Coluna';
            return (
              <div className="overflow-x-auto">
                  <div className="text-xs mb-1">
                    <strong>Linhas:</strong> {eixoYLabel} | <strong>Colunas:</strong> {eixoXLabel} | <strong>Valores:</strong> Qtd / Peso Médio / GMD Médio
                  </div>
                  
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs font-bold py-2 min-w-[120px]">
                          {eixoYLabel}
                        </TableHead>
                        {colunasX.map((col) =>
                      <TableHead key={col} className="text-xs font-bold text-center py-2 min-w-[100px] whitespace-nowrap">
                            {col}
                          </TableHead>
                      )}
                        <TableHead className="text-xs font-bold text-center py-2 min-w-[100px]">
                          TOTAL
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linhasY.map((linha) =>
                    <TableRow key={linha} className="hover:bg-gray-50">
                          <TableCell className="text-xs font-semibold py-2">
                            {linha}
                          </TableCell>
                          {colunasX.map((col) => {
                        const celula = matriz[linha][col];
                        const pesoMed = celula.qtd > 0 ? celula.pesoTotal / celula.qtd : 0;
                        const gmdMed = celula.gmdCount > 0 ? celula.gmdTotal / celula.gmdCount : 0;
                        return (
                          <TableCell key={col} className="text-xs text-center py-2 font-mono border-l border-slate-100">
                                {celula.qtd > 0 ?
                            <div className="leading-tight">
                                    <div className="font-semibold">{celula.qtd}</div>
                                    <div className="text-[10px] text-slate-500">{pesoMed.toFixed(0)}kg</div>
                                    <div className="text-[10px] text-emerald-600">{gmdMed.toFixed(3)}</div>
                                  </div> :
                            ''}
                              </TableCell>);

                      })}
                          <TableCell className="text-xs text-center font-mono py-2 bg-slate-50 border-l border-slate-200">
                            <div className="leading-tight">
                              <div className="font-bold text-slate-800">{totaisLinha[linha].qtd}</div>
                              <div className="text-[10px] text-slate-500">{(totaisLinha[linha].pesoTotal / totaisLinha[linha].qtd).toFixed(0)}kg</div>
                              <div className="text-[10px] text-slate-500">{totaisLinha[linha].gmdCount > 0 ? (totaisLinha[linha].gmdTotal / totaisLinha[linha].gmdCount).toFixed(3) : '-'}</div>
                            </div>
                          </TableCell>
                        </TableRow>
                    )}
                      {/* Linha de Total */}
                      <TableRow className="font-bold bg-slate-50">
                        <TableCell className="text-xs font-bold py-2 border-t border-slate-200">
                          TOTAL
                        </TableCell>
                        {colunasX.map((col) => {
                        const tc = totaisColuna[col];
                        const pesoMed = tc.qtd > 0 ? tc.pesoTotal / tc.qtd : 0;
                        const gmdMed = tc.gmdCount > 0 ? tc.gmdTotal / tc.gmdCount : 0;
                        return (
                          <TableCell key={col} className="text-xs text-center font-mono py-2 border-t border-slate-200 border-l border-slate-100">
                              <div className="leading-tight">
                                <div className="font-bold text-slate-800">{tc.qtd}</div>
                                <div className="text-[10px] text-slate-500">{pesoMed.toFixed(0)}kg</div>
                                <div className="text-[10px] text-slate-500">{gmdMed.toFixed(3)}</div>
                              </div>
                            </TableCell>);

                      })}
                        <TableCell className="text-xs text-center font-mono font-bold py-2 bg-slate-100 border-t border-l border-slate-200">
                          <div className="leading-tight">
                            <div className="font-bold text-slate-900">{totalGeral.qtd}</div>
                            <div className="text-[10px] text-slate-600">{totalGeral.pesoMedio.toFixed(0)}kg</div>
                            <div className="text-[10px] text-slate-600">{totalGeral.gmdMedio.toFixed(3)}</div>
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>);

          })()) : (

          /* RELATÓRIO ANALÍTICO */
          <>
              {Object.entries(pesagensAgrupadas).map(([grupo, registros], idx) => {
              const totalGrupo = registros.length;
              const pesoMedioGrupo = totalGrupo > 0 ? registros.reduce((s, r) => s + (r.peso || 0), 0) / totalGrupo : 0;
              const gmdMedioGrupo = registros.filter((r) => r.gmd).length > 0 ?
              registros.filter((r) => r.gmd).reduce((s, r) => s + r.gmd, 0) / registros.filter((r) => r.gmd).length :
              0;
              return (
                <div key={idx} className="mb-4">
                    {agrupamentosAtivos.length > 0 &&
                  <div className="border-b border-slate-200 pb-2 mb-2 mt-4">
                        <h3 className="font-bold text-sm text-slate-700 uppercase">{grupo}</h3>
                      </div>
                  }
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {colunasVisiveis.includes('data_pesagem') && <TableHead className="text-xs font-bold py-2">Data</TableHead>}
                          {colunasVisiveis.includes('numero_animal') && <TableHead className="text-xs font-bold py-2">Animal</TableHead>}
                          {colunasVisiveis.includes('sexo') && <TableHead className="text-xs font-bold py-2">Sexo</TableHead>}
                          {colunasVisiveis.includes('raca') && <TableHead className="text-xs font-bold py-2">Raça</TableHead>}
                          {colunasVisiveis.includes('peso') && <TableHead className="text-xs font-bold text-right py-2">Peso</TableHead>}
                          {colunasVisiveis.includes('nome_lote') && <TableHead className="text-xs font-bold py-2">Lote</TableHead>}
                          {colunasVisiveis.includes('nome_apartacao') && <TableHead className="text-xs font-bold py-2">Apartação</TableHead>}
                          {colunasVisiveis.includes('data_anterior') && <TableHead className="text-xs font-bold py-2">Dt.Ant.</TableHead>}
                          {colunasVisiveis.includes('peso_anterior') && <TableHead className="text-xs font-bold text-right py-2">Peso Ant.</TableHead>}
                          {colunasVisiveis.includes('dias') && <TableHead className="text-xs font-bold text-right py-2">Dias</TableHead>}
                          {colunasVisiveis.includes('ganho') && <TableHead className="text-xs font-bold text-right py-2">Ganho</TableHead>}
                          {colunasVisiveis.includes('gmd') && <TableHead className="text-xs font-bold text-right py-2">GMD</TableHead>}
                          {colunasVisiveis.includes('observacao') && <TableHead className="text-xs font-bold py-2">Obs</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {registros.map((p) =>
                      <TableRow key={p.id} className="hover:bg-gray-50">
                            {colunasVisiveis.includes('data_pesagem') && <TableCell className="text-xs py-2">{formatarData(p.data_pesagem)}</TableCell>}
                            {colunasVisiveis.includes('numero_animal') && <TableCell className="text-xs font-medium py-2">{p.numero_animal}</TableCell>}
                            {colunasVisiveis.includes('sexo') && <TableCell className="text-xs py-2">{p.sexo === 'M' ? 'M' : p.sexo === 'F' ? 'F' : '-'}</TableCell>}
                            {colunasVisiveis.includes('raca') && <TableCell className="text-xs py-2">{p.raca || '-'}</TableCell>}
                            {colunasVisiveis.includes('peso') && <TableCell className="text-xs text-right font-mono py-2">{formatarDecimal(p.peso, 2)}</TableCell>}
                            {colunasVisiveis.includes('nome_lote') && <TableCell className="text-xs py-2">{p.nome_lote || '-'}</TableCell>}
                            {colunasVisiveis.includes('nome_apartacao') && <TableCell className="text-xs py-2">{p.nome_apartacao || '-'}</TableCell>}
                            {colunasVisiveis.includes('data_anterior') && <TableCell className="text-xs py-2">{formatarData(p.data_anterior)}</TableCell>}
                            {colunasVisiveis.includes('peso_anterior') && <TableCell className="text-xs text-right font-mono py-2">{p.peso_anterior != null ? formatarDecimal(p.peso_anterior, 2) : '-'}</TableCell>}
                            {colunasVisiveis.includes('dias') && <TableCell className="text-xs text-right font-mono py-2">{p.dias || '-'}</TableCell>}
                            {colunasVisiveis.includes('ganho') && <TableCell className="text-xs text-right font-mono py-2">{p.ganho != null ? formatarDecimal(p.ganho, 2) : '-'}</TableCell>}
                            {colunasVisiveis.includes('gmd') && <TableCell className={`text-xs text-right font-mono py-2 ${p.gmd && p.gmd > 0 ? 'text-emerald-600' : p.gmd && p.gmd < 0 ? 'text-red-600' : ''}`}>{p.gmd != null ? formatarDecimal(p.gmd, 3) : '-'}</TableCell>}
                            {colunasVisiveis.includes('observacao') && <TableCell className="text-xs py-2 max-w-[80px] truncate">{p.observacao || '-'}</TableCell>}
                          </TableRow>
                      )}
                      </TableBody>
                    </Table>
                    <div className="mt-2 text-xs font-bold text-slate-700 bg-slate-50 py-2 px-3 border border-slate-200 rounded-md">
                      Subtotal: {totalGrupo} animais | Peso Médio: {pesoMedioGrupo.toFixed(1)} kg | GMD Médio: {gmdMedioGrupo.toFixed(3)} kg/dia
                    </div>
                  </div>);

            })}
              <div className="mt-4 pt-3 border-t-2 border-slate-300">
                <div className="text-xs font-bold text-slate-800 bg-slate-50 p-3 rounded-md border border-slate-200">
                  TOTAL GERAL: {totalAnimais} pesagens | Peso Médio: {pesoMedio.toFixed(1)} kg | GMD Médio: {gmdMedio.toFixed(3)} kg/dia | Ganho Total: {formatarNumero(ganhoTotal.toFixed(1))} kg
                </div>
              </div>
              <div className="mt-6 pt-2 border-t border-gray-300 text-center text-xs text-gray-500">
                <p>Impresso em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              </div>
            </>)
          }
        </div>
      </div>
      
      <RelatorioConfigDialogs
        showConfigColunasDetalhes={showConfigColunasDetalhes}
        setShowConfigColunasDetalhes={setShowConfigColunasDetalhes}
        COLUNAS_DETALHES_APARTACAO={COLUNAS_DETALHES_APARTACAO}
        colunasDetalhesVisiveis={colunasDetalhesVisiveis}
        toggleColunaDetalhe={toggleColunaDetalhe}
        colunasDetalhesOrdem={colunasDetalhesOrdem}
        handleDragEndDetalhes={handleDragEndDetalhes}
        showConfigColunasVendas={showConfigColunasVendas}
        setShowConfigColunasVendas={setShowConfigColunasVendas}
        COLUNAS_DETALHES_VENDAS={COLUNAS_DETALHES_VENDAS}
        colunasVendasVisiveis={colunasVendasVisiveis}
        toggleColunaDetalheVendas={toggleColunaDetalheVendas}
        colunasVendasOrdem={colunasVendasOrdem}
        handleDragEndDetalhesVendas={handleDragEndDetalhesVendas}
        showConfigColunasPainel={showConfigColunasPainel}
        setShowConfigColunasPainel={setShowConfigColunasPainel}
        COLUNAS_PAINEL_APARTACAO={COLUNAS_PAINEL_APARTACAO}
        colunasPainelVisiveis={colunasPainelVisiveis}
        toggleColunaPainel={toggleColunaPainel}
        colunasPainelOrdem={colunasPainelOrdem}
        handleDragEndPainel={handleDragEndPainel} />
      
    </div>);

}