// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { BACKUP_POLICY_DEFAULTS, coverage, normalizePolicy, shouldRunPeriodic } from './backupPolicy.js';
import { decryptBackup, encryptBackup } from './protectedBackup.js';

const policy = normalizePolicy(BACKUP_POLICY_DEFAULTS);

describe('backup periódico', () => {
  it('roda sem backup verificado; respeita o intervalo', () => {
    const agora = new Date('2026-03-02T09:00:00Z');
    expect(shouldRunPeriodic({ agora, ultimoOk: null, policy }).run).toBe(true);
    expect(shouldRunPeriodic({ agora, ultimoOk: '2026-03-02T01:00:00Z', policy }).run).toBe(false);
    expect(shouldRunPeriodic({ agora, ultimoOk: '2026-03-01T08:00:00Z', policy }).run).toBe(true);
  });
  it('espera depois de falha e para após 3 falhas no dia', () => {
    const agora = new Date('2026-03-02T09:00:00Z');
    expect(shouldRunPeriodic({ agora, falhas: ['2026-03-02T08:30:00Z'], policy }).run).toBe(false);
    expect(shouldRunPeriodic({ agora, falhas: ['2026-03-02T06:00:00Z'], policy }).run).toBe(true);
    expect(shouldRunPeriodic({ agora, falhas: ['2026-03-02T01:00:00Z', '2026-03-02T03:00:00Z', '2026-03-02T05:00:00Z'], policy }).run).toBe(false);
  });
  it('desligado não roda; cobertura sem destino é "só local"', () => {
    expect(shouldRunPeriodic({ agora: new Date(), policy: { ...policy, periodico_ativo: false } }).run).toBe(false);
    expect(coverage({ status: { protecao: 'VERIFICADO' }, externo: { configurado: false } })).toEqual({ local: 'OK', copia: 'NAO_CONFIGURADA' });
  });
  it('R03: cobertura usa o estado de AGORA, não o registro', () => {
    const ext = { configurado: true, disponivel: true };
    expect(coverage({ status: { protecao: 'ALTERADO' }, externo: ext, copiaExterna: { valida: true } })).toEqual({ local: 'ALTERADO', copia: 'PENDENTE' });
    expect(coverage({ status: { protecao: 'INDISPONIVEL' }, externo: ext })).toEqual({ local: 'INDISPONIVEL', copia: 'PENDENTE' });
    expect(coverage({ status: { protecao: 'VERIFICADO' }, externo: ext, copiaExterna: { valida: false } }).copia).toBe('PENDENTE');
    expect(coverage({ status: { protecao: 'VERIFICADO' }, externo: ext, copiaExterna: { valida: true } }).copia).toBe('OK');
    expect(coverage({ status: { protecao: 'VERIFICADO' }, externo: { configurado: true, disponivel: false }, copiaExterna: { valida: true } }).copia).toBe('INDISPONIVEL');
  });
});

describe('backup protegido', () => {
  it('ida e volta; senha errada falha', async () => {
    const env = await encryptBackup({ backup: { stores: { a: [1] }, integrity: { sha256: 'x' } }, anexos: [] }, 'senha-forte-123', { iterations: 1000 });
    expect(env.ciphertext).not.toContain('integrity');
    expect((await decryptBackup(env, 'senha-forte-123')).backup.integrity.sha256).toBe('x');
    await expect(decryptBackup(env, 'outra-senha-123')).rejects.toThrow(/Senha incorreta/);
  });
});
