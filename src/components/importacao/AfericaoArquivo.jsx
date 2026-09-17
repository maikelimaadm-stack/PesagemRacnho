import { Button } from '@/components/ui/button';
import { fmtInt } from '@/components/common/formatNumber';
import { IMPORT_TYPES } from './importacaoModel';

// Aferição do próprio arquivo, mostrada ANTES da análise: quantas linhas, quantos animais
// diferentes e quantos aparecem mais de uma vez. Quando há animais repetidos e o modo
// escolhido não é o conciliado, oferece a troca com um clique (17/09/2026).
export default function AfericaoArquivo({ afericao, type, onConciliarAutomaticamente }) {
  if (!afericao || !afericao.mapeado) return null;
  const repetidos = afericao.repetidos || 0;
  const alerta = repetidos > 0 && type !== IMPORT_TYPES.HISTORICO;
  return (
    <div className="importacao-afericao" data-testid="importacao-afericao">
      <p className="importacao-afericao__linha">
        <strong>{fmtInt(afericao.linhas)}</strong> {afericao.linhas === 1 ? 'linha' : 'linhas'} ·{' '}
        <strong>{fmtInt(afericao.animais)}</strong> {afericao.animais === 1 ? 'animal diferente' : 'animais diferentes'} ·{' '}
        <strong>{fmtInt(repetidos)}</strong> {repetidos === 1 ? 'animal com mais de uma linha' : 'animais com mais de uma linha'}
        {repetidos > 0 ? ` (máx. ${fmtInt(afericao.maxLinhas)} linhas para o mesmo animal)` : ''}
      </p>
      {alerta ? (
        <div className="importacao-alert importacao-alert--aviso" data-testid="importacao-aviso-repetidos" role="alert">
          <span>
            Este arquivo tem {fmtInt(repetidos)} {repetidos === 1 ? 'animal repetido' : 'animais repetidos'}. Em “Cadastros” isso vira conflito. Quer conciliar automaticamente?
          </span>
          <Button
            type="button"
            className="emp-toolbar-btn emp-toolbar-btn-save"
            data-testid="importacao-trocar-para-historico"
            onClick={onConciliarAutomaticamente}
          >
            Conciliar automaticamente
          </Button>
        </div>
      ) : null}
    </div>
  );
}
