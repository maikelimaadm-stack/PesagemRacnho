import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { ensureEmpresaId } from '@/api/db';
import { AccessDenied } from '@/components/auth/RequirePermission';
import { useAuth } from '@/components/auth/useAuth';
import { Button } from '@/components/ui/button';
import {
  ModeloBase1ActionBar,
  ModeloBase1PageContainer,
  ModeloBase1PageHeader,
} from '@/components/modelobase1';
import ConfirmarImportacaoDialog from '@/components/importacao/ConfirmarImportacaoDialog';
import ImportacaoJsonTecnica from '@/components/importacao/ImportacaoJsonTecnica';
import ImportSteps from '@/components/importacao/ImportSteps';
import StepArquivo from '@/components/importacao/StepArquivo';
import StepColunas from '@/components/importacao/StepColunas';
import StepConciliacao from '@/components/importacao/StepConciliacao';
import StepConferencia from '@/components/importacao/StepConferencia';
import StepRegras from '@/components/importacao/StepRegras';
import StepResultado from '@/components/importacao/StepResultado';
import StepTipo from '@/components/importacao/StepTipo';
import {
  CATEGORY_MODES,
  CONCILIACAO_OPCOES,
  IMPORT_STEPS,
  IMPORT_TYPES,
  afericaoDoArquivo,
  camposObrigatoriosFaltando,
  describeImportError,
  respostaDoTipo,
  stepIndex,
} from '@/components/importacao/importacaoModel';
import {
  analyzeImport,
  applyImport,
  deleteImportTemplate,
  listImportTemplates,
  listMappableFields,
  planToCsv,
  readImportFile,
  resultToCsv,
  saveImportTemplate,
  suggestMapping,
} from '@/modules/import/application/importService';
import { TEMPLATE_KINDS, buildImportTemplateCsv } from '@/modules/import/domain/spreadsheetTemplate';
import { downloadCsvFile } from '@/modules/weighing/export/csvDownload';
import { brandService, breedService, categoryService } from '@/modules/catalog/application/index';
import { listApartacoes, listLoteApartacoes } from '@/modules/auxiliary/application/apartacaoService';
import '@/styles/importacao.css';
import '@/styles/launch-visual.css';

// OPERAÇÃO › Importação. Assistente em 7 etapas sobre o motor de importação conciliada
// (src/modules/import/**): a tela só orquestra — ler o arquivo, conciliar (dry-run) e
// gravar são do serviço. Rota protegida por weighing.write no Layout; o serviço repete a
// checagem e cadastros mestres exigem registry.write.
const WEIGHING_WRITE = 'weighing.write';
const REGISTRY_WRITE = 'registry.write';

const REGRAS_INICIAIS = Object.freeze({
  dateFormat: 'auto',
  decimal: 'auto',
  categoryMode: CATEGORY_MODES.PLANILHA,
  fixedValues: {},
  createMissingMasters: false,
});

const CATALOGOS_VAZIOS = Object.freeze({ marcas: [], racas: [], categorias: [], apartacoes: [], lotes: [] });

// \D em vez de colchetes com hífen, dois-pontos e T: o Tailwind lia aquele trecho como classe e gerava CSS inválido.
const carimbo = () => new Date().toISOString().slice(0, 19).replace(/\D/g, '');

// Tipo pré-escolhido pela tela que abriu o assistente (hoje: Sanidade › Aplicações →
// #/Importacao?tipo=SANIDADE). Valor desconhecido é ignorado: o assistente abre normal.
function tipoDaRota(search) {
  const pedido = new URLSearchParams(search || '').get('tipo');
  return pedido && Object.values(IMPORT_TYPES).includes(pedido) ? pedido : null;
}

export default function Importacao() {
  const auth = useAuth();
  const { search } = useLocation();
  const tipoPedido = tipoDaRota(search);
  const empresaId = ensureEmpresaId();
  // Fora do AuthGate (harness de UI) não há sessão: nada é restringido; o serviço checa de novo.
  const pode = (action) => (auth ? Boolean(auth.can?.(action)) : true);
  const podeImportar = pode(WEIGHING_WRITE);
  const podeCadastrosMestres = pode(REGISTRY_WRITE);
  const actor = auth?.user || null;

  const [passo, setPasso] = useState('arquivo');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [texto, setTexto] = useState('');
  const [delimiter, setDelimiter] = useState('auto');
  const [file, setFile] = useState(null);
  const [lendo, setLendo] = useState(false);
  const [erroArquivo, setErroArquivo] = useState('');

  const [resposta, setResposta] = useState(() => respostaDoTipo(tipoPedido));
  const [type, setType] = useState(tipoPedido);
  const [mapping, setMapping] = useState({});
  const [rules, setRules] = useState({ ...REGRAS_INICIAIS, fixedValues: {} });

  const [plan, setPlan] = useState(null);
  const [analisando, setAnalisando] = useState(false);
  const [erroAnalise, setErroAnalise] = useState('');

  const [confirmando, setConfirmando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [progresso, setProgresso] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [erroGravacao, setErroGravacao] = useState('');

  const [templates, setTemplates] = useState([]);
  const [templatesCarregando, setTemplatesCarregando] = useState(false);
  const [catalogos, setCatalogos] = useState(CATALOGOS_VAZIOS);

  const campos = useMemo(() => (type ? listMappableFields(type) : []), [type]);
  const faltando = useMemo(() => (type ? camposObrigatoriosFaltando(campos, mapping, type) : []), [campos, mapping, type]);
  const afericao = useMemo(() => (file ? afericaoDoArquivo(file, mapping) : null), [file, mapping]);

  // Cadastros usados nos valores fixos. Carregados uma vez; erro não trava o assistente.
  useEffect(() => {
    if (!podeImportar) return;
    let vivo = true;
    Promise.all([
      brandService.list({ empresaId }).catch(() => []),
      breedService.list({ empresaId }).catch(() => []),
      categoryService.list({ empresaId }).catch(() => []),
      listApartacoes({ empresaId }).catch(() => []),
      listLoteApartacoes({ empresaId }).catch(() => []),
    ]).then(([marcas, racas, categorias, apartacoes, lotes]) => {
      if (vivo) setCatalogos({ marcas, racas, categorias, apartacoes, lotes });
    });
    return () => { vivo = false; };
  }, [empresaId, podeImportar]);

  useEffect(() => {
    if (!tipoPedido) return;
    setType(tipoPedido);
    setResposta(respostaDoTipo(tipoPedido));
  }, [tipoPedido]);

  const recarregarModelos = useCallback(async () => {
    setTemplatesCarregando(true);
    try {
      setTemplates(await listImportTemplates(empresaId));
    } catch (error) {
      toast.error(describeImportError(error, 'Não foi possível carregar os modelos de mapeamento.'));
    } finally {
      setTemplatesCarregando(false);
    }
  }, [empresaId]);
  useEffect(() => { if (podeImportar) recarregarModelos(); }, [podeImportar, recarregarModelos]);

  const limparPlano = () => { setPlan(null); setErroAnalise(''); setResultado(null); setErroGravacao(''); };

  const lerTexto = useCallback((conteudo, separador, tipoAtual) => {
    try {
      const lido = readImportFile(conteudo, { delimiter: separador });
      setFile(lido);
      setErroArquivo(lido.rows.length ? '' : 'O arquivo não tem linhas de dados abaixo do cabeçalho.');
      if (tipoAtual) setMapping(suggestMapping(lido.headers, tipoAtual));
      return lido;
    } catch (error) {
      setFile(null);
      setErroArquivo(error.message || 'Não foi possível ler o arquivo.');
      return null;
    }
  }, []);

  const escolherArquivo = (arquivo) => {
    setLendo(true);
    setErroArquivo('');
    limparPlano();
    const leitor = new FileReader();
    leitor.onerror = () => { setLendo(false); setErroArquivo('Não foi possível abrir o arquivo.'); };
    leitor.onload = (evento) => {
      const conteudo = String(evento.target?.result ?? '');
      setTexto(conteudo);
      setFileName(arquivo.name);
      setFileSize(arquivo.size);
      lerTexto(conteudo, delimiter, type);
      setLendo(false);
    };
    leitor.readAsText(arquivo, 'UTF-8');
  };

  const trocarDelimitador = (valor) => {
    setDelimiter(valor);
    limparPlano();
    if (texto) lerTexto(texto, valor, type);
  };

  const escolherTipo = (novoTipo) => {
    setType(novoTipo);
    limparPlano();
    if (file) setMapping(suggestMapping(file.headers, novoTipo));
  };

  const responder = (opcaoId) => {
    setResposta(opcaoId);
    const opcao = CONCILIACAO_OPCOES.find((item) => item.id === opcaoId);
    if (opcao?.tipo) escolherTipo(opcao.tipo);
    else setType(null);
  };

  const baixarModelo = (kind) => {
    const { content, fileName: nome } = buildImportTemplateCsv(TEMPLATE_KINDS[kind]);
    downloadCsvFile({ content, fileName: nome });
    toast.success('Modelo baixado.');
  };

  // Dry-run: nada é gravado. Aceita sobreposições para a troca de modo com refazer análise.
  const executarAnalise = useCallback(async ({ tipo = type, mapeamento = mapping, regras = rules } = {}) => {
    if (!texto || !tipo) return null;
    setAnalisando(true);
    setErroAnalise('');
    try {
      const novo = await analyzeImport(
        { text: texto, type: tipo, mapping: mapeamento, rules: { ...regras, empresaId }, fileName, fileSize, delimiter },
        actor,
      );
      setPlan(novo);
      return novo;
    } catch (error) {
      setPlan(null);
      setErroAnalise(describeImportError(error, 'Não foi possível analisar o arquivo.'));
      return null;
    } finally {
      setAnalisando(false);
    }
  }, [actor, delimiter, empresaId, fileName, fileSize, mapping, rules, texto, type]);

  const conciliarAutomaticamente = async () => {
    const novoMapeamento = file ? suggestMapping(file.headers, IMPORT_TYPES.HISTORICO) : mapping;
    setResposta('SIM');
    setType(IMPORT_TYPES.HISTORICO);
    setMapping(novoMapeamento);
    setResultado(null);
    toast.success('Modo trocado para conciliação automática.');
    if (passo === 'conciliacao' || plan) await executarAnalise({ tipo: IMPORT_TYPES.HISTORICO, mapeamento: novoMapeamento });
  };

  const alterarMapeamento = (header, fieldId) => {
    setMapping((atual) => ({ ...atual, [header]: fieldId }));
    limparPlano();
  };

  const alterarRegras = (patch) => {
    setRules((atual) => ({ ...atual, ...patch }));
    limparPlano();
  };

  const salvarModelo = async (nome) => {
    try {
      await saveImportTemplate({
        nome,
        tipoImportacao: type,
        delimiter,
        columnMapping: mapping,
        categoryMode: rules.categoryMode,
        fixedValues: rules.fixedValues,
        dateFormat: rules.dateFormat,
        decimalFormat: rules.decimal,
        empresaId,
      }, actor);
      await recarregarModelos();
      toast.success('Modelo salvo.');
      return true;
    } catch (error) {
      toast.error(describeImportError(error, 'Não foi possível salvar o modelo.'));
      return false;
    }
  };

  const carregarModelo = (id) => {
    const modelo = templates.find((item) => item.id === id);
    if (!modelo) return;
    if (modelo.tipoImportacao !== type) escolherTipo(modelo.tipoImportacao);
    const cabecalhos = new Set(file?.headers || []);
    const ausentes = Object.keys(modelo.columnMapping || {}).filter((header) => !cabecalhos.has(header) && modelo.columnMapping[header]);
    const aplicado = Object.fromEntries(Object.entries(modelo.columnMapping || {}).filter(([header]) => cabecalhos.has(header)));
    setMapping((atual) => ({ ...atual, ...aplicado }));
    setDelimiter(modelo.delimiter || 'auto');
    setRules((atual) => ({
      ...atual,
      categoryMode: modelo.categoryMode,
      fixedValues: modelo.fixedValues || {},
      dateFormat: modelo.dateFormat,
      decimal: modelo.decimalFormat,
    }));
    limparPlano();
    if (ausentes.length) toast.warning(`O modelo cita colunas que este arquivo não tem: ${ausentes.join(', ')}.`);
    else toast.success('Modelo aplicado.');
  };

  const excluirModelo = async (id) => {
    try {
      await deleteImportTemplate(id, actor, { empresaId });
      await recarregarModelos();
      toast.success('Modelo excluído.');
    } catch (error) {
      toast.error(describeImportError(error, 'Não foi possível excluir o modelo.'));
    }
    return true;
  };

  const baixarRelatorio = () => {
    if (!plan) return;
    downloadCsvFile({ content: planToCsv(plan), fileName: `conciliacao_${carimbo()}.csv` });
    toast.success('Relatório de conciliação baixado.');
  };

  const baixarResultado = () => {
    if (!resultado) return;
    downloadCsvFile({ content: resultToCsv(resultado, plan), fileName: `importacao_${carimbo()}.csv` });
    toast.success('Resultado baixado.');
  };

  const gravar = async () => {
    if (!plan || plan.blocking) return;
    setGravando(true);
    setErroGravacao('');
    setProgresso(null);
    try {
      const saida = await applyImport(plan, actor, { onProgress: (etapa) => setProgresso(etapa) });
      setResultado(saida);
      setConfirmando(false);
      setPasso('resultado');
      toast.success(saida.status === 'SEM_ALTERACOES' ? 'Nada novo para gravar: o arquivo já estava no sistema.' : 'Importação concluída.');
    } catch (error) {
      const mensagem = describeImportError(error, 'Não foi possível gravar a importação.');
      setErroGravacao(mensagem);
      toast.error(mensagem);
    } finally {
      setGravando(false);
      setProgresso(null);
    }
  };

  const novaImportacao = () => {
    setPasso('arquivo');
    setFileName(''); setFileSize(0); setTexto(''); setFile(null); setDelimiter('auto');
    setResposta(respostaDoTipo(tipoPedido)); setType(tipoPedido); setMapping({}); setRules({ ...REGRAS_INICIAIS, fixedValues: {} });
    limparPlano();
  };

  // Etapa válida = pode sair dela. Etapa à frente só abre com todas as anteriores válidas.
  const etapaValida = useCallback((id) => {
    switch (id) {
      case 'arquivo': return Boolean(file && file.rows.length);
      case 'tipo': return Boolean(type);
      case 'colunas': return Boolean(type) && faltando.length === 0;
      case 'regras':
        if (rules.categoryMode === CATEGORY_MODES.FIXA && !rules.fixedValues?.categoria_id) return false;
        if (rules.createMissingMasters && !podeCadastrosMestres) return false;
        return true;
      case 'conciliacao': return Boolean(plan);
      case 'conferencia': return Boolean(plan) && !plan.blocking;
      case 'resultado': return Boolean(resultado);
      default: return false;
    }
  }, [faltando.length, file, plan, podeCadastrosMestres, resultado, rules, type]);

  const podeAbrir = useCallback((id) => {
    const alvo = stepIndex(id);
    for (let indice = 0; indice < alvo; indice += 1) {
      if (!etapaValida(IMPORT_STEPS[indice].id)) return false;
    }
    return true;
  }, [etapaValida]);

  const indiceAtual = stepIndex(passo);
  const proximo = IMPORT_STEPS[indiceAtual + 1] || null;
  const anterior = IMPORT_STEPS[indiceAtual - 1] || null;

  const avancar = async () => {
    if (!proximo || !etapaValida(passo)) return;
    setPasso(proximo.id);
    if (proximo.id === 'conciliacao' && !plan && !analisando) await executarAnalise();
  };

  if (!podeImportar) return <AccessDenied role={auth?.user?.role} permission={WEIGHING_WRITE} />;

  return (
    <ModeloBase1PageContainer
      variant="maintenance"
      className="d17b-page importacao-page cadastro-emp-scope mg-empresas-scope"
    >
      <ModeloBase1PageHeader
        visuallyHidden
        title="Importação"
        description="Traga pesagens, saídas e cadastros de uma planilha para o sistema, conferindo tudo antes de gravar."
      />
      <ImportSteps steps={IMPORT_STEPS} activeStep={passo} onSelect={setPasso} isEnabled={podeAbrir} />

      <div className="importacao-body" id={`importacao-panel-${passo}`} role="tabpanel" aria-labelledby={`importacao-step-${passo}`}>
        {passo === 'arquivo' ? (
          <StepArquivo
            fileName={fileName}
            fileSize={fileSize}
            file={file}
            lendo={lendo}
            erro={erroArquivo}
            delimiter={delimiter}
            type={type}
            podeBaixarModelo
            onEscolherArquivo={escolherArquivo}
            onDelimiterChange={trocarDelimitador}
            onBaixarModelo={baixarModelo}
          />
        ) : null}

        {passo === 'tipo' ? (
          <StepTipo
            resposta={resposta}
            type={type}
            podeCadastrosMestres={podeCadastrosMestres}
            onResponder={responder}
            onEscolherTipo={escolherTipo}
          />
        ) : null}

        {passo === 'colunas' ? (
          <StepColunas
            file={file}
            campos={campos}
            mapping={mapping}
            faltando={faltando}
            afericao={afericao}
            type={type}
            onAlterar={alterarMapeamento}
            onRestaurarSugestao={() => { setMapping(suggestMapping(file?.headers || [], type)); limparPlano(); }}
            onConciliarAutomaticamente={conciliarAutomaticamente}
          />
        ) : null}

        {passo === 'regras' ? (
          <StepRegras
            type={type}
            rules={rules}
            catalogos={catalogos}
            podeCadastrosMestres={podeCadastrosMestres}
            templates={templates.filter((modelo) => modelo.tipoImportacao === type)}
            templatesCarregando={templatesCarregando}
            onAlterar={alterarRegras}
            onSalvarModelo={salvarModelo}
            onCarregarModelo={carregarModelo}
            onExcluirModelo={excluirModelo}
          />
        ) : null}

        {passo === 'conciliacao' ? (
          <StepConciliacao
            plan={plan}
            analisando={analisando}
            erro={erroAnalise}
            afericao={afericao}
            type={type}
            onAnalisar={() => executarAnalise()}
            onConciliarAutomaticamente={conciliarAutomaticamente}
          />
        ) : null}

        {passo === 'conferencia' ? (
          <StepConferencia
            plan={plan}
            erro={erroGravacao}
            podeImportar={podeImportar}
            gravando={gravando}
            onBaixarRelatorio={baixarRelatorio}
            onImportar={() => setConfirmando(true)}
          />
        ) : null}

        {passo === 'resultado' ? (
          <StepResultado
            resultado={resultado}
            erro={erroGravacao}
            onBaixarResultado={baixarResultado}
            onNovaImportacao={novaImportacao}
          />
        ) : null}
      </div>

      <ModeloBase1ActionBar
        className="mb1-operational-actionbar importacao-navbar"
        aria-label="Navegação do assistente de importação"
        end={
          <>
            <Button type="button" variant="outline" disabled={!anterior} onClick={() => anterior && setPasso(anterior.id)}>Voltar</Button>
            <Button
              type="button"
              className="emp-toolbar-btn emp-toolbar-btn-save"
              disabled={!proximo || !etapaValida(passo)}
              onClick={avancar}
            >
              Avançar
            </Button>
          </>
        }
      >
        <span className="importacao-navbar__passo">
          Etapa {indiceAtual + 1} de {IMPORT_STEPS.length} · {IMPORT_STEPS[indiceAtual].titulo}
        </span>
      </ModeloBase1ActionBar>

      <ConfirmarImportacaoDialog
        open={confirmando}
        plan={plan}
        progresso={progresso}
        gravando={gravando}
        onOpenChange={setConfirmando}
        onConfirmar={gravar}
      />
      {pode('maintenance.backup') ? <ImportacaoJsonTecnica /> : null}
    </ModeloBase1PageContainer>
  );
}
