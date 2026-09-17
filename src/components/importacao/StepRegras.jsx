import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CATEGORY_MODES,
  CATEGORY_MODE_OPTIONS,
  DATE_FORMATS,
  DATE_FORMAT_LABELS,
  DECIMAL_FORMATS,
  DECIMAL_LABELS,
  EXIT_REASONS,
  IMPORT_TYPES,
} from './importacaoModel';

function Campo({ id, label, hint, children }) {
  return (
    <div className="importacao-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint ? <span className="importacao-hint">{hint}</span> : null}
    </div>
  );
}

// Etapa 4 — Regras. Tudo aqui vira o objeto `rules` que o motor normaliza
// (normalizeImportRules): formato de data, decimal, modo de categoria, valores fixos e a
// opção de criar cadastros ausentes. Modelos de mapeamento ficam em appSettings pelo
// próprio serviço (listImportTemplates/saveImportTemplate/deleteImportTemplate).
export default function StepRegras({
  type,
  rules,
  onAlterar,
  catalogos,
  podeCadastrosMestres,
  templates,
  templatesCarregando,
  onSalvarModelo,
  onCarregarModelo,
  onExcluirModelo,
}) {
  const [nomeModelo, setNomeModelo] = useState('');
  const [modeloSelecionado, setModeloSelecionado] = useState('');
  const mestres = type === IMPORT_TYPES.MESTRES;
  const saidas = type === IMPORT_TYPES.SAIDAS;
  const fixos = rules.fixedValues || {};
  const alterarFixo = (chave, valor) => onAlterar({ fixedValues: { ...fixos, [chave]: valor || null } });

  return (
    <section className="importacao-step" aria-labelledby="importacao-step-regras-titulo">
      <h2 id="importacao-step-regras-titulo" className="importacao-step__title">Como o sistema deve ler os valores</h2>
      <p className="importacao-step__lead">
        Estas escolhas valem para o arquivo inteiro. Em caso de dúvida, deixe em “Reconhecer sozinho”.
      </p>

      <div className="importacao-field-grid">
        <Campo id="importacao-data" label="Formato das datas" hint="Como as datas estão escritas na planilha.">
          <select id="importacao-data" className="importacao-select" value={rules.dateFormat} onChange={(event) => onAlterar({ dateFormat: event.target.value })}>
            {DATE_FORMATS.map((valor) => <option key={valor} value={valor}>{DATE_FORMAT_LABELS[valor]}</option>)}
          </select>
        </Campo>
        <Campo id="importacao-decimal" label="Separador dos decimais" hint="Como o peso está escrito: 238,5 ou 238.5.">
          <select id="importacao-decimal" className="importacao-select" value={rules.decimal} onChange={(event) => onAlterar({ decimal: event.target.value })}>
            {DECIMAL_FORMATS.map((valor) => <option key={valor} value={valor}>{DECIMAL_LABELS[valor]}</option>)}
          </select>
        </Campo>
      </div>

      {!mestres ? (
        <>
          <h3 className="importacao-step__subtitle">Categoria dos animais</h3>
          <div className="importacao-choice-grid importacao-choice-grid--compacta" role="radiogroup" aria-label="Como definir a categoria">
            {CATEGORY_MODE_OPTIONS.map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                role="radio"
                aria-checked={rules.categoryMode === opcao.id}
                data-modo-categoria={opcao.id}
                className={`importacao-choice${rules.categoryMode === opcao.id ? ' importacao-choice--ativa' : ''}`}
                onClick={() => onAlterar({ categoryMode: opcao.id })}
              >
                <strong>{opcao.label}</strong>
                <span>{opcao.hint}</span>
              </button>
            ))}
          </div>
          <p className="importacao-hint" data-testid="importacao-aviso-categoria-automatica">
            A categoria automática pelo peso só vale para os animais criados no Cadastro. Manejos e saídas nunca mudam a categoria de um animal que já existe.
          </p>

          <h3 className="importacao-step__subtitle">Valores iguais para todas as linhas</h3>
          <p className="importacao-step__lead">
            Use quando a informação não está na planilha. O que vier na coluna do arquivo sempre vence o valor fixo.
          </p>
          <div className="importacao-field-grid">
            {rules.categoryMode === CATEGORY_MODES.FIXA ? (
              <Campo id="importacao-fixo-categoria" label="Categoria para todos" hint="Obrigatória neste modo.">
                <select id="importacao-fixo-categoria" className="importacao-select" value={fixos.categoria_id || ''} onChange={(event) => alterarFixo('categoria_id', event.target.value)}>
                  <option value="">Escolha a categoria</option>
                  {catalogos.categorias.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
              </Campo>
            ) : null}
            <Campo id="importacao-fixo-marca" label="Marca" hint="Identidade do animal é número + marca.">
              <select id="importacao-fixo-marca" className="importacao-select" value={fixos.marca_id || ''} onChange={(event) => alterarFixo('marca_id', event.target.value)}>
                <option value="">Sem valor fixo</option>
                {catalogos.marcas.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
            </Campo>
            <Campo id="importacao-fixo-raca" label="Raça">
              <select id="importacao-fixo-raca" className="importacao-select" value={fixos.raca_id || ''} onChange={(event) => alterarFixo('raca_id', event.target.value)}>
                <option value="">Sem valor fixo</option>
                {catalogos.racas.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
              </select>
            </Campo>
            <Campo id="importacao-fixo-sexo" label="Sexo">
              <select id="importacao-fixo-sexo" className="importacao-select" value={fixos.sexo || ''} onChange={(event) => alterarFixo('sexo', event.target.value)}>
                <option value="">Sem valor fixo</option>
                <option value="M">Macho</option>
                <option value="F">Fêmea</option>
              </select>
            </Campo>
            <Campo id="importacao-fixo-apartacao" label="Apartação">
              <select id="importacao-fixo-apartacao" className="importacao-select" value={fixos.apartacao_id || ''} onChange={(event) => alterarFixo('apartacao_id', event.target.value)}>
                <option value="">Sem valor fixo</option>
                {catalogos.apartacoes.map((item) => <option key={item.id} value={item.id}>{item.nome_apartacao || item.nome}</option>)}
              </select>
            </Campo>
            <Campo id="importacao-fixo-lote" label="Lote">
              <select id="importacao-fixo-lote" className="importacao-select" value={fixos.lote_id || ''} onChange={(event) => alterarFixo('lote_id', event.target.value)}>
                <option value="">Sem valor fixo</option>
                {catalogos.lotes
                  .filter((item) => !fixos.apartacao_id || String(item.apartacao_id) === String(fixos.apartacao_id))
                  .map((item) => <option key={item.id} value={item.id}>{item.nome_lote || item.nome}</option>)}
              </select>
            </Campo>
            {saidas ? (
              <Campo id="importacao-fixo-motivo" label="Motivo da saída" hint="Usado nas linhas em que a planilha não traz o motivo.">
                <select id="importacao-fixo-motivo" className="importacao-select" value={fixos.motivo_saida || ''} onChange={(event) => alterarFixo('motivo_saida', event.target.value)}>
                  <option value="">Sem valor fixo</option>
                  {EXIT_REASONS.map((motivo) => <option key={motivo} value={motivo}>{motivo}</option>)}
                </select>
              </Campo>
            ) : null}
          </div>
        </>
      ) : null}

      <h3 className="importacao-step__subtitle">Cadastros que ainda não existem</h3>
      <label className="importacao-check" htmlFor="importacao-criar-cadastros">
        <input
          id="importacao-criar-cadastros"
          type="checkbox"
          checked={Boolean(rules.createMissingMasters)}
          disabled={!podeCadastrosMestres}
          onChange={(event) => onAlterar({ createMissingMasters: event.target.checked })}
        />
        <span>Criar marcas, raças e causas de morte que o arquivo citar e o sistema ainda não tiver</span>
      </label>
      {!podeCadastrosMestres ? (
        <p className="importacao-hint" data-testid="importacao-sem-registry-write">
          Seu perfil não pode criar cadastros. Peça a um gestor para cadastrar marcas, raças e causas antes de importar.
        </p>
      ) : null}

      <h3 className="importacao-step__subtitle">Modelos de mapeamento</h3>
      <p className="importacao-step__lead">
        Guarde este mapeamento com um nome e reaproveite na próxima planilha do mesmo formato. O modelo guarda só as escolhas, nunca os dados do arquivo.
      </p>
      <div className="importacao-template-row">
        <select
          className="importacao-select"
          aria-label="Modelo de mapeamento salvo"
          value={modeloSelecionado}
          disabled={templatesCarregando || !templates.length}
          onChange={(event) => setModeloSelecionado(event.target.value)}
        >
          <option value="">{templates.length ? 'Escolha um modelo salvo' : 'Nenhum modelo salvo ainda'}</option>
          {templates.map((modelo) => <option key={modelo.id} value={modelo.id}>{modelo.nome}</option>)}
        </select>
        <Button type="button" variant="outline" disabled={!modeloSelecionado} onClick={() => onCarregarModelo(modeloSelecionado)}>Usar modelo</Button>
        <Button type="button" variant="outline" disabled={!modeloSelecionado} onClick={() => onExcluirModelo(modeloSelecionado).then(() => setModeloSelecionado(''))}>
          <Trash2 className="w-4 h-4 mr-1" aria-hidden="true" />
          Excluir
        </Button>
      </div>
      <div className="importacao-template-row">
        <Input
          className="importacao-input"
          aria-label="Nome do novo modelo"
          placeholder="Nome do modelo (ex.: planilha da balança)"
          value={nomeModelo}
          onChange={(event) => setNomeModelo(event.target.value)}
        />
        <Button
          type="button"
          className="emp-toolbar-btn emp-toolbar-btn-save"
          disabled={!nomeModelo.trim()}
          onClick={() => onSalvarModelo(nomeModelo.trim()).then((ok) => { if (ok) setNomeModelo(''); })}
        >
          Salvar modelo
        </Button>
      </div>
    </section>
  );
}
