// R3-01: estado CRÍTICO de restauração durável. Duas cópias do marcador:
//   1. arquivo de nome fixo na pasta de dados, gravado pelo processo principal (window.pesagemApp.criticalState) —
//      fora do banco, que pode estar inconsistente; é a fonte principal;
//   2. chave `restauracao:critica` em appSettings — reforço para quando o arquivo não puder ser gravado.
// Na abertura (antes de qualquer gravação) qualquer uma das duas reinstala o bloqueio; marcador ilegível ou IPC com
// erro também bloqueiam (fail-closed). Só uma restauração CONFERIDA (conteúdo e anexos) libera — fechar e reabrir não.
import { clearCriticalBlock, getCriticalBlock, setCriticalBlock } from './migrations/migrationState.js';

export const CHAVE_CRITICA = 'restauracao:critica';
const api = () => (typeof window !== 'undefined' ? window.pesagemApp?.criticalState ?? null : null);
const dadosDe = (r) => (r && typeof r === 'object' && 'ok' in r ? (r.ok === false ? Promise.reject(Object.assign(new Error(r.error?.message || 'IPC'), { code: r.error?.code })) : r.data) : r);

/** Lê os marcadores e reinstala o bloqueio crítico. Nunca lança. Devolve o marcador encontrado (ou null). */
export async function carregarBloqueioCritico(db) {
  let marcador = null;
  try {
    if (api()?.get) marcador = await dadosDe(await api().get());
  } catch (err) {
    marcador = { codigo: 'RESTAURACAO_CRITICA', fase: 'desconhecida', ilegivel: true, erro: err.message };
  }
  if (!marcador && db) {
    try { marcador = (await db.table('appSettings').get(CHAVE_CRITICA))?.value || null; } catch { /* banco ilegível: o arquivo decide */ }
  }
  if (marcador) {
    setCriticalBlock({
      message: marcador.ilegivel ? 'marcador de restauração crítica ilegível — trate como crítico' : `restauração anterior falhou (${marcador.fase || 'fase desconhecida'}) e a volta automática também`,
      fase: marcador.fase || null, backupNome: marcador.backupNome || null, backupSha256: marcador.backupSha256 || null, persistido: { arquivo: !marcador.origemBanco, banco: true },
    });
  }
  return marcador;
}

/** Grava o marcador nas duas cópias (melhor esforço em cada). Devolve onde conseguiu gravar. */
export async function persistirBloqueioCritico(db, { fase, backupNome, backupSha256 }) {
  const persistido = { arquivo: false, banco: false, erros: [] };
  try {
    if (api()?.set) { await dadosDe(await api().set({ fase, backupNome, backupSha256 })); persistido.arquivo = true; }
    else persistido.erros.push('marcador em arquivo indisponível fora do aplicativo desktop');
  } catch (err) { persistido.erros.push(`arquivo: ${err.message}`); }
  try {
    await db.table('appSettings').put({ key: CHAVE_CRITICA, value: { codigo: 'RESTAURACAO_CRITICA', fase, backupNome, backupSha256, em: new Date().toISOString(), origemBanco: true } });
    persistido.banco = true;
  } catch (err) { persistido.erros.push(`banco: ${err.message}`); }
  return persistido;
}

/**
 * Libera o estado crítico depois de uma restauração conferida. `conteudoSha256` é o SHA-256 do conteúdo do backup
 * restaurado (integrity.sha256), anotado no histórico do processo principal. Lança se o arquivo não puder ser
 * removido — nesse caso o bloqueio continua (a próxima abertura voltaria a bloquear).
 */
export async function liberarBloqueioCritico(db, { conteudoSha256 }) {
  const havia = Boolean(getCriticalBlock());
  if (api()?.clear) await dadosDe(await api().clear({ motivo: 'restauracao-verificada', conteudoSha256 }));
  try { await db.table('appSettings').delete(CHAVE_CRITICA); } catch { /* restaurado do backup, normalmente já ausente */ }
  clearCriticalBlock();
  return { liberado: havia };
}
