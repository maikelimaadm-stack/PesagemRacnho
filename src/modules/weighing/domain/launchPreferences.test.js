import { describe, expect, it } from 'vitest';
import { LAUNCH_PREFERENCES_VERSION, launchPreferencesStorageKey, sanitizeLaunchPreferences } from './launchPreferences';

const SUBTIPOS = ['COMPRA', 'NASCIMENTO'];

describe('preferências do Lançamento na sessão', () => {
  it('guarda motivo da entrada, pesagem automática e a sequência com o cursor', () => {
    const p = sanitizeLaunchPreferences({
      versao: LAUNCH_PREFERENCES_VERSION, subtipoEntrada: 'NASCIMENTO', pesagemAuto: true,
      sequencia: { usar: true, inicial: '7000', final: '7500', direcao: 'crescente', cursor: { prefixo: '', numeroAtual: 7003, numeroInicial: 7000, digitos: 4, numeroFinal: 7500, direcao: 'crescente' } },
    }, { subtiposEntrada: SUBTIPOS });
    expect(p).toMatchObject({ subtipoEntrada: 'NASCIMENTO', pesagemAuto: true });
    expect(p.sequencia).toEqual({ usar: true, inicial: '7000', final: '7500', direcao: 'crescente', cursor: { prefixo: '', numeroAtual: 7003, numeroInicial: 7000, digitos: 4, numeroFinal: 7500, direcao: 'crescente' } });
  });

  it('dado estranho vira o padrão (nunca quebra a tela)', () => {
    expect(sanitizeLaunchPreferences(null, { subtiposEntrada: SUBTIPOS })).toMatchObject({ subtipoEntrada: null, pesagemAuto: false, sequencia: null });
    expect(sanitizeLaunchPreferences({ versao: 99, pesagemAuto: true }).pesagemAuto).toBe(false);
    const p = sanitizeLaunchPreferences({ versao: LAUNCH_PREFERENCES_VERSION, subtipoEntrada: 'XYZ', pesagemAuto: 'sim', sequencia: { usar: true, inicial: 7000, direcao: 'lado', cursor: { prefixo: 'BR', numeroAtual: -1, numeroInicial: 1, digitos: 3 } } }, { subtiposEntrada: SUBTIPOS });
    expect(p.subtipoEntrada).toBeNull();
    expect(p.pesagemAuto).toBe(false);
    expect(p.sequencia).toEqual({ usar: true, inicial: '', final: '', direcao: 'crescente', cursor: null });
  });

  it('sequência desmarcada não leva cursor', () => {
    const p = sanitizeLaunchPreferences({ versao: LAUNCH_PREFERENCES_VERSION, sequencia: { usar: false, inicial: '10', cursor: { prefixo: '', numeroAtual: 12, numeroInicial: 10, digitos: 2 } } });
    expect(p.sequencia.cursor).toBeNull();
  });

  it('chave por empresa e usuário', () => {
    expect(launchPreferencesStorageKey({ empresaId: 'E1', usuarioId: 'U1' })).toBe('lancamento-pesagens:preferencias:E1:U1');
    expect(launchPreferencesStorageKey({})).toBe('lancamento-pesagens:preferencias:local:sem-usuario');
  });
});
