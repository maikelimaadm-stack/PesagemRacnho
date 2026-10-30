// Política de backup (F20 periódico, F21 cópia externa, F22 retenção) — puro.
// Periódico roda SÓ com o aplicativo aberto: na primeira oportunidade depois do intervalo (ex.: ao abrir no dia
// seguinte) e de novo a cada intervalo de uso. Nunca promete backup com o computador desligado.
// Retenção conservadora: só backups PERIÓDICOS entram na rotação; manuais e de segurança (pré-migração,
// pré-restauração, pré-limpeza…) nunca são apagados por regra; o último backup verificado nunca é apagado.

export const BACKUP_POLICY_KEY = 'backup-policy:local';
export const BACKUP_POLICY_DEFAULTS = Object.freeze({
  periodico_ativo: true,
  intervalo_horas: 24,
  manter_periodicos: 14,
  copia_externa_automatica: false,
});
export const TENTATIVAS_POR_DIA = 3;
export const ESPERA_APOS_FALHA_MIN = 60;

export class BackupPolicyError extends Error {
  constructor(message) {
    super(message);
    this.code = 'POLITICA_BACKUP_INVALIDA';
  }
}

export function normalizePolicy(raw = {}) {
  const p = { ...BACKUP_POLICY_DEFAULTS, ...(raw || {}) };
  const intervalo = Number(p.intervalo_horas);
  const manter = Number(p.manter_periodicos);
  if (!Number.isInteger(intervalo) || intervalo < 1 || intervalo > 24 * 30) throw new BackupPolicyError('Intervalo do backup periódico: de 1 a 720 horas.');
  if (!Number.isInteger(manter) || manter < 3 || manter > 365) throw new BackupPolicyError('Manter de 3 a 365 backups periódicos.');
  return { periodico_ativo: p.periodico_ativo !== false, intervalo_horas: intervalo, manter_periodicos: manter, copia_externa_automatica: p.copia_externa_automatica === true };
}

/**
 * Decide se o backup periódico deve rodar agora.
 * @param {{ agora: Date, ultimoOk: string|null, tentativas: string[], policy }} s  tentativas = ISO das falhas recentes
 */
export function shouldRunPeriodic({ agora, ultimoOk = null, falhas = [], policy }) {
  if (!policy?.periodico_ativo) return { run: false, motivo: 'Backup periódico desligado.' };
  const ms = agora.getTime();
  if (ultimoOk && ms - new Date(ultimoOk).getTime() < policy.intervalo_horas * 3600000) {
    return { run: false, motivo: 'Dentro do intervalo.', proximo: new Date(new Date(ultimoOk).getTime() + policy.intervalo_horas * 3600000).toISOString() };
  }
  const hoje = agora.toISOString().slice(0, 10);
  const falhasHoje = falhas.filter((f) => String(f).slice(0, 10) === hoje).sort();
  if (falhasHoje.length >= TENTATIVAS_POR_DIA) return { run: false, motivo: `Backup periódico falhou ${falhasHoje.length} vezes hoje; tente o botão "Criar backup agora".` };
  const ultimaFalha = falhasHoje.at(-1);
  if (ultimaFalha && ms - new Date(ultimaFalha).getTime() < ESPERA_APOS_FALHA_MIN * 60000) return { run: false, motivo: 'Aguardando para tentar de novo após falha.' };
  return { run: true, motivo: ultimoOk ? 'Intervalo vencido.' : 'Sem backup verificado.' };
}

const PROTEGIDOS = /^pre-|migra|restor|manual|clear|reset/i;

/**
 * Backups a remover pela retenção. `catalogo`: [{ name, reason, automatic, estado, createdAt }] (mais novo
 * primeiro ou não — ordena). Só periódicos (reason 'periodico'); mantém os N mais novos; nunca o último
 * VERIFICADO do catálogo inteiro; nunca reason protegida.
 */
export function planRetention(catalogo = [], { manter = BACKUP_POLICY_DEFAULTS.manter_periodicos } = {}) {
  const ordenado = [...catalogo].sort((a, b) => String(b.createdAt || b.modifiedAt || '').localeCompare(String(a.createdAt || a.modifiedAt || '')));
  const ultimoVerificado = ordenado.find((c) => c.estado === 'VERIFICADO')?.name || null;
  const periodicos = ordenado.filter((c) => c.reason === 'periodico' && !PROTEGIDOS.test(c.reason || ''));
  return periodicos.slice(manter).filter((c) => c.name !== ultimoVerificado).map((c) => c.name);
}

/** Situação de cobertura para a tela: local × cópia externa. */
/**
 * Quadro de cobertura (R03). `local`: OK só com backup ÍNTEGRO AGORA (status.protecao VERIFICADO, que já relê o
 * arquivo); ALTERADO quando o último verificado foi apagado/renomeado/alterado; INDISPONIVEL quando a pasta não
 * pode ser lida. `copia`: OK só com a cópia externa conferida AGORA (`copiaExterna.valida`), não pelo registro.
 */
export function coverage({ status, externo, copiaExterna = null }) {
  // R2-01: PARCIAL (só backup de segurança sem anexos que já faltavam) nunca é OK.
  const LOCAL = { VERIFICADO: 'OK', NAO_VERIFICADO: 'NAO_VERIFICADO', ALTERADO: 'ALTERADO', INDISPONIVEL: 'INDISPONIVEL', PARCIAL: 'PARCIAL' };
  const local = LOCAL[status?.protecao] || 'SEM_BACKUP';
  let copia = 'NAO_CONFIGURADA';
  if (externo?.configurado) {
    copia = !externo.disponivel ? 'INDISPONIVEL' : (local === 'OK' && copiaExterna?.valida === true) ? 'OK' : 'PENDENTE';
  }
  return { local, copia };
}
