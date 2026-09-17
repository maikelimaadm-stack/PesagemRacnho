import { useRef } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fmtInt } from '@/components/common/formatNumber';
import { delimiterLabel, formatFileSize, modelosParaTipo } from './importacaoModel';

// Etapa 1 — Arquivo. A leitura é do motor (readImportFile): aqui só se escolhe o arquivo,
// mostra-se o que foi lido e oferece-se o modelo de planilha.
export default function StepArquivo({ fileName, fileSize, file, lendo, erro, delimiter, type, onEscolherArquivo, onDelimiterChange, onBaixarModelo, podeBaixarModelo }) {
  const inputRef = useRef(null);
  const modelos = modelosParaTipo(type);

  return (
    <section className="importacao-step" aria-labelledby="importacao-step-arquivo-titulo">
      <h2 id="importacao-step-arquivo-titulo" className="importacao-step__title">Escolha o arquivo</h2>
      <p className="importacao-step__lead">
        Aceita planilha salva como CSV ou TXT, com as colunas separadas por ponto e vírgula, vírgula ou tabulação.
        Nada é gravado agora: o sistema só lê o arquivo.
      </p>

      <div className="importacao-file-box">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="sr-only"
          aria-label="Arquivo da importação"
          data-testid="importacao-arquivo"
          onChange={(event) => {
            const escolhido = event.target.files?.[0];
            event.target.value = '';
            if (escolhido) onEscolherArquivo(escolhido);
          }}
        />
        <Button type="button" className="emp-toolbar-btn emp-toolbar-btn-save" onClick={() => inputRef.current?.click()} disabled={lendo}>
          <Upload className="w-4 h-4 mr-1" aria-hidden="true" />
          {fileName ? 'Trocar arquivo' : 'Escolher arquivo'}
        </Button>
        {podeBaixarModelo ? modelos.map((modelo) => (
          <Button key={modelo.kind} type="button" variant="outline" data-modelo={modelo.kind} onClick={() => onBaixarModelo(modelo.kind)}>
            <FileSpreadsheet className="w-4 h-4 mr-1" aria-hidden="true" />
            {modelo.rotulo}
          </Button>
        )) : null}
      </div>

      {lendo ? <p className="importacao-hint" role="status">Lendo o arquivo…</p> : null}
      {erro ? <p className="importacao-alert importacao-alert--erro" role="alert">{erro}</p> : null}

      {!fileName && !lendo && !erro ? (
        <p className="importacao-empty">Nenhum arquivo escolhido ainda. Use “Escolher arquivo” ou baixe um modelo para preencher.</p>
      ) : null}

      {file ? (
        <dl className="importacao-facts" data-testid="importacao-arquivo-resumo">
          <div><dt>Arquivo</dt><dd>{fileName}</dd></div>
          <div><dt>Tamanho</dt><dd>{formatFileSize(fileSize)}</dd></div>
          <div><dt>Linhas de dados</dt><dd>{fmtInt(file.rows.length)}</dd></div>
          <div><dt>Colunas</dt><dd>{fmtInt(file.headers.length)}</dd></div>
          <div><dt>Separador reconhecido</dt><dd>{delimiterLabel(file.delimiter)}</dd></div>
        </dl>
      ) : null}

      {file ? (
        <div className="importacao-field importacao-field--inline">
          <label htmlFor="importacao-delimitador">Separador das colunas</label>
          <select
            id="importacao-delimitador"
            className="importacao-select"
            value={delimiter}
            onChange={(event) => onDelimiterChange(event.target.value)}
          >
            <option value="auto">Reconhecer sozinho</option>
            <option value=";">Ponto e vírgula (;)</option>
            <option value=",">Vírgula (,)</option>
            <option value="tab">Tabulação</option>
          </select>
          <span className="importacao-hint">Troque só se as colunas vieram embaralhadas.</span>
        </div>
      ) : null}
    </section>
  );
}
