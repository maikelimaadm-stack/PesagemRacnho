import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArchiveRestore, FolderOutput, HardDriveDownload, Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { AccessDenied } from '@/components/auth/RequirePermission';
import { useAuth } from '@/components/auth/useAuth';
import { ModeloBase1PageContainer, ModeloBase1PageHeader } from '@/components/modelobase1';
import * as center from '@/modules/backup/application/backupCenterService';
import * as maintenanceService from '@/modules/maintenance/application/maintenanceService';
import { logout } from '@/modules/auth/application/authSession';
import { describeError, fmtInt } from '@/components/rebanho/rebanhoModel';
import '@/styles/rebanho.css';

// Menu SISTEMA › Backup e Restauração (F19–F23; fecha P14, P20, P22, P26). Botão único "Criar backup agora"
// (gravado e VERIFICADO pela leitura de volta), situação da proteção local × cópia externa, backup periódico com o
// app aberto, destino independente, retenção, backup protegido por senha e restauração em passos. Nada destrutivo
// fica aqui além da restauração guiada (ADMIN, confirmação digitada e backup de segurança antes).
const POR_PAGINA = 15;
const fmtDataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');
const fmtTam = (n) => (n == null ? '—' : n > 1048576 ? `${(n / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const ESTADO_LABEL = { VERIFICADO: 'Verificado', FALHOU: 'Falhou', NAO_VERIFICADO: 'Não verificado', ALTERADO: 'Alterado/indisponível agora', PARCIAL: 'Parcial — anexos ausentes na origem; não é proteção completa' };
const MOTIVO_LABEL = (r) => ({ 'manual-ui': 'Manual', periodico: 'Periódico', 'pre-restore': 'Antes de restaurar', 'pre-import': 'Antes de importar', 'pre-clear-operational': 'Antes de limpar', 'pre-reset-all': 'Antes do reset', protegido: 'Protegido' }[r] || (r && r.startsWith('pre-migration') ? 'Antes da migração' : r || '—'));

// R03: quatro fatos separados — quando foi verificado (histórico), se está disponível agora, se está íntegro
// agora (relido) e se a cópia externa confere agora. "Protegido" só com o backup íntegro agora.
function Cobertura({ ov }) {
  const local = ov?.cobertura?.local;
  const copia = ov?.cobertura?.copia;
  const st = ov?.status || {};
  const sim = (v) => (v ? 'Sim' : 'Não');
  const titulo = { OK: 'Protegido', NAO_VERIFICADO: 'Atenção', ALTERADO: 'Atenção', INDISPONIVEL: 'Pasta inacessível', PARCIAL: 'Só backup parcial' }[local] || 'Sem backup';
  const textoLocal = {
    OK: `Backup íntegro agora (verificado em ${fmtDataHora(st.lastVerified?.verifiedAt)}).`,
    NAO_VERIFICADO: 'Há backups, mas nenhum verificado.',
    ALTERADO: st.motivo || 'O backup verificado não está mais íntegro.',
    INDISPONIVEL: st.motivo || 'A pasta de backups não pode ser lida agora.',
    PARCIAL: st.motivo || 'Só há backup parcial: não é proteção completa.',
  }[local] || 'Nenhum backup ainda.';
  const textoCopia = { OK: `Cópia externa conferida agora (${ov?.copiaExterna?.destino || ov?.externo?.destino || ''})`, PENDENTE: ov?.copiaExterna?.motivo ? `Cópia externa pendente: ${ov.copiaExterna.motivo}` : 'Cópia externa pendente: copie o último backup para o destino', INDISPONIVEL: 'Destino externo desconectado: cópia não conferida', NAO_CONFIGURADA: 'Sem destino externo: o backup está só neste computador' }[copia] || '—';
  const maisNovoAlterado = st.lastVerified && st.ultimaVerificacao && st.lastVerified.path !== st.ultimaVerificacao.path;
  return (
    <>
      <div className="rb-summary" aria-label="Situação da proteção">
        <div className="rb-summary__item" data-protecao={local}><strong>{titulo}</strong><span>{textoLocal}</span></div>
        <div className="rb-summary__item" data-copia={copia}><strong>{copia === 'OK' ? 'Cópia OK' : copia === 'NAO_CONFIGURADA' ? 'Só local' : 'Pendente'}</strong><span>{textoCopia}</span></div>
        <div className="rb-summary__item"><strong>{ov?.policy?.periodico_ativo ? `A cada ${ov.policy.intervalo_horas} h` : 'Desligado'}</strong><span>Backup periódico (só com o aplicativo aberto). {ov?.periodico?.proximo?.proximo ? `Próximo após ${fmtDataHora(ov.periodico.proximo.proximo)}.` : ov?.periodico?.proximo?.motivo || ''}</span></div>
      </div>
      <dl className="rb-dl" aria-label="Conferência do backup agora">
        <div><dt>Verificado em</dt><dd>{st.ultimaVerificacao ? `${fmtDataHora(st.ultimaVerificacao.verifiedAt)} (${st.ultimaVerificacao.name || '—'})` : '—'}</dd></div>
        <div><dt>Disponível agora</dt><dd data-r03="disponivel">{sim(st.disponivelAgora)}</dd></div>
        <div><dt>Íntegro agora</dt><dd data-r03="integro">{sim(st.integroAgora)}{st.conferencia?.em ? ` (conferido ${fmtDataHora(st.conferencia.em)})` : ''}</dd></div>
        <div><dt>Cópia externa válida</dt><dd data-r03="copia">{ov?.externo?.configurado ? sim(ov?.copiaExterna?.valida === true) : 'Sem destino'}</dd></div>
      </dl>
      {st.ultimoParcial ? <p className="rb-note rb-note--warn" data-r2="parcial">Backup parcial de {fmtDataHora(st.ultimoParcial.verifiedAt)} ({st.ultimoParcial.name}): guardado para recuperação, sem {(st.ultimoParcial.anexosAusentesNaOrigem || []).length} anexo(s) que já faltavam. Não conta como proteção completa.</p> : null}
      {st.conferenciaLimitada ? <p className="rb-note rb-note--warn">{fmtInt(st.conferenciaLimitada.naoConferidos)} backup(s) verificado(s) mais antigo(s) não foram relidos agora: use Verificar na lista.</p> : null}
      {maisNovoAlterado ? <p className="rb-note rb-note--warn">O backup verificado mais recente ({st.ultimaVerificacao.name}) não confere agora; a proteção vale pelo anterior, de {fmtDataHora(st.lastVerified.verifiedAt)}.</p> : null}
    </>
  );
}

function RestauracaoGuiada({ onDone }) {
  const [passo, setPasso] = useState(1);
  const [arquivo, setArquivo] = useState(null); // { fileName, payload }
  const [senha, setSenha] = useState('');
  const [insp, setInsp] = useState(null);
  const [confirmacao, setConfirmacao] = useState('');
  const [resultado, setResultado] = useState(null);
  const [busy, setBusy] = useState(false);
  // R01/R02: exceções explícitas, oferecidas só depois de a restauração ter sido recusada pelo motivo exato.
  const [recusa, setRecusa] = useState(null); // { code, causa, message }
  const [aceites, setAceites] = useState({ ausentesNaOrigem: false, faltandoNoPacote: false });

  const selecionar = async () => {
    try {
      const sel = await maintenanceService.selectBackupFile();
      if (sel?.canceled) return;
      setArquivo(sel);
      setInsp(null);
      setSenha('');
      const r = await center.inspectBackup(sel.payload, { selecao: sel.selecao });
      setInsp(r.precisaSenha ? null : r);
      setPasso(2);
      if (r.precisaSenha) toast.message('Backup protegido: informe a senha para inspecionar.');
    } catch (error) { toast.error(describeError(error, 'Não foi possível ler o arquivo.')); }
  };
  const abrirProtegido = async () => {
    try { setInsp(await center.inspectBackup(arquivo.payload, { senha, selecao: arquivo.selecao })); } catch (error) { toast.error(describeError(error)); }
  };
  const restaurar = async () => {
    setBusy(true);
    try {
      const r = await center.restoreGuided(insp, {
        confirmacao,
        onLogout: () => setTimeout(() => logout(), 4000),
        aceitarAnexosAusentesNaOrigem: aceites.ausentesNaOrigem,
        aceitarAnexosFaltandoNoPacote: aceites.faltandoNoPacote,
      });
      setResultado(r);
      setRecusa(null);
      setPasso(4);
      onDone?.();
    } catch (error) {
      setRecusa({ code: error?.code || null, causa: error?.causa || null, message: describeError(error, 'Não foi possível restaurar.'), faltando: error?.faltando || [], corrompidos: error?.corrompidos || [] });
      toast.error(describeError(error, 'Não foi possível restaurar.'));
      onDone?.();
    } finally { setBusy(false); }
  };

  return (
    <section className="rb-card" aria-label="Restaurar backup">
      <div className="rb-section-head"><h3>Restaurar backup</h3><span className="rb-note">Passo {passo} de 4</span></div>
      <ol className="rb-steps">
        <li className={passo === 1 ? 'is-active' : ''}>Selecionar</li><li className={passo === 2 ? 'is-active' : ''}>Inspecionar e comparar</li><li className={passo === 3 ? 'is-active' : ''}>Confirmar</li><li className={passo === 4 ? 'is-active' : ''}>Resultado</li>
      </ol>
      {passo === 1 ? (
        <div>
          <p className="rb-note">Escolha um backup completo (<code>.json</code>, com a pasta <code>.anexos</code> ao lado) ou um backup protegido (<code>.pbk</code>). Nada é alterado nesta etapa.</p>
          <button type="button" className="rb-btn" onClick={selecionar}><ArchiveRestore size={14} aria-hidden="true" /> Selecionar arquivo</button>
        </div>
      ) : null}
      {passo === 2 ? (
        <div>
          <p className="rb-note">Arquivo: <strong>{arquivo?.fileName}</strong></p>
          {!insp ? (
            <div className="rb-inline">
              <input type="password" className="rb-control rb-control--compact" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha do backup protegido" aria-label="Senha do backup protegido" autoComplete="off" />
              <button type="button" className="rb-btn" onClick={abrirProtegido} disabled={senha.length < 10}>Abrir</button>
            </div>
          ) : (
            <>
              <dl className="rb-dl">
                <div><dt>Criado em</dt><dd>{fmtDataHora(insp.criadoEm)}</dd></div>
                <div><dt>Versão do app</dt><dd>{insp.appVersion || '—'}</dd></div>
                <div><dt>Banco do backup</dt><dd>{insp.dry.sourceDbVersion}{insp.dry.schemaUpgradeRequired ? ' — Backup de esquema anterior: será convertido automaticamente' : ''}</dd></div>
                <div><dt>Usuários no backup</dt><dd>{fmtInt(insp.usuarios)}</dd></div>
                <div><dt>Documentos com anexo</dt><dd>{fmtInt(insp.anexos)}{insp.protegido ? ' (dentro do arquivo protegido)' : ''}</dd></div>
                <div><dt>Restaurável</dt><dd>{insp.dry.restorable ? 'Sim' : 'Não'}</dd></div>
              </dl>
              <table className="rb-table"><thead><tr><th>Dados</th><th className="rb-num">Hoje</th><th className="rb-num">No backup</th></tr></thead>
                <tbody>{insp.comparacao.filter((c) => c.atual || c.backup).map((c) => <tr key={c.store}><td>{c.store}</td><td className="rb-num">{fmtInt(c.atual)}</td><td className="rb-num">{fmtInt(c.backup)}</td></tr>)}</tbody>
              </table>
              <div className="rb-inline">
                <button type="button" className="rb-btn" onClick={() => setPasso(1)}>Voltar</button>
                <button type="button" className="rb-btn rb-btn--primary" onClick={() => setPasso(3)} disabled={!insp.dry.restorable}>Continuar</button>
              </div>
            </>
          )}
        </div>
      ) : null}
      {passo === 3 && insp ? (
        <div>
          <ul className="rb-alerts rb-alerts--warn">
            <li>TODOS os dados atuais serão substituídos pelos do backup — inclusive usuários, senhas e configurações.</li>
            <li>Antes de alterar qualquer dado, o aplicativo confere os anexos do backup escolhido e grava e verifica um backup da situação de hoje (pré-restauração). Se algo falhar, nada é alterado.</li>
            {insp.usuarios ? <li>Depois de restaurar, entre de novo com um usuário do backup.</li> : null}
          </ul>
          {recusa ? (
            <div className="rb-alerts rb-alerts--warn" role="alert">
              <p>{recusa.message}</p>
              {recusa.code === 'BACKUP_PRE_OPERACAO_FALHOU' && recusa.causa === 'BACKUP_ANEXOS_INCOMPLETO' ? (
                <label className="rb-check"><input type="checkbox" checked={aceites.ausentesNaOrigem} onChange={(e) => setAceites((a) => ({ ...a, ausentesNaOrigem: e.target.checked }))} /> Anexos que JÁ faltam neste computador ficam fora do backup de segurança (ele será marcado incompleto).</label>
              ) : null}
              {recusa.code === 'BACKUP_ANEXOS_PREFLIGHT' && recusa.faltando.length && !recusa.corrompidos.length ? (
                <label className="rb-check"><input type="checkbox" checked={aceites.faltandoNoPacote} onChange={(e) => setAceites((a) => ({ ...a, faltandoNoPacote: e.target.checked }))} /> Restaurar mesmo sem {recusa.faltando.length} anexo(s) que faltam no backup (a recuperação NÃO será completa).</label>
              ) : null}
            </div>
          ) : null}
          <div className="rb-inline">
            <input className="rb-control rb-control--compact" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} placeholder={`Digite ${center.CONFIRMACAO_RESTAURAR}`} aria-label="Confirmação da restauração" />
            <button type="button" className="rb-btn" onClick={() => setPasso(2)}>Voltar</button>
            <button type="button" className="rb-btn rb-btn--danger" onClick={restaurar} disabled={busy || confirmacao !== center.CONFIRMACAO_RESTAURAR}>{busy ? 'Restaurando…' : 'Restaurar agora'}</button>
          </div>
        </div>
      ) : null}
      {passo === 4 && resultado ? (
        <div>
          <p className={`rb-note ${resultado.recuperacaoCompleta ? 'rb-note--ok' : 'rb-note--warn'}`} data-recuperacao={resultado.recuperacaoCompleta ? 'completa' : 'incompleta'}>{resultado.recuperacaoCompleta ? 'Recuperação completa: banco e anexos conferidos depois da restauração.' : 'Recuperação INCOMPLETA: veja abaixo o que não voltou.'}</p>
          {resultado.contagensDivergentes?.length ? <p className="rb-note rb-note--warn">Contagens diferentes do backup: {resultado.contagensDivergentes.map((c) => `${c.store} (${c.atual} de ${c.esperado})`).join(', ')}.</p> : null}
          <p className={`rb-note ${resultado.integridade.ok ? 'rb-note--ok' : 'rb-note--warn'}`}>{resultado.integridade.ok ? 'Integridade do banco: OK.' : `Integridade do banco: ${resultado.integridade.issues.length} pendência(s) — veja Manutenção avançada.`}</p>
          {resultado.anexos ? <p className={`rb-note ${resultado.anexos.faltando?.length || resultado.anexos.corrompidos?.length ? 'rb-note--warn' : ''}`}>Anexos: {resultado.anexos.ok} de {resultado.anexos.total} conferidos na pasta do aplicativo{resultado.anexos.faltando?.length ? `; ${resultado.anexos.faltando.length} faltando` : ''}{resultado.anexos.corrompidos?.length ? `; ${resultado.anexos.corrompidos.length} corrompido(s)` : ''}.</p> : null}
          {resultado.sessaoEncerrada ? <p className="rb-note rb-note--warn">O backup trouxe os usuários dele: a sessão será encerrada; entre de novo.</p> : null}
          <button type="button" className="rb-btn" onClick={() => { setPasso(1); setArquivo(null); setInsp(null); setResultado(null); setConfirmacao(''); setRecusa(null); setAceites({ ausentesNaOrigem: false, faltandoNoPacote: false }); }}>Concluir</button>
        </div>
      ) : null}
    </section>
  );
}

export default function BackupRestauracao() {
  const auth = useAuth();
  const can = (action) => (auth ? Boolean(auth.can?.(action)) : true);
  const podeVer = can('maintenance.backup');
  const [ov, setOv] = useState(null);
  const [busy, setBusy] = useState('');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [policy, setPolicy] = useState(null);
  const [senha, setSenha] = useState({ a: '', b: '' });

  const refresh = useCallback(async () => {
    try {
      const o = await center.getOverview();
      setOv(o);
      setPolicy((p) => p || o.policy);
    } catch (error) { toast.error(describeError(error, 'Não foi possível ler a situação do backup.')); }
  }, []);
  useEffect(() => { if (podeVer) refresh(); }, [podeVer, refresh]);

  const run = async (key, fn, okMsg) => {
    setBusy(key);
    try { const r = await fn(); if (okMsg) toast.success(okMsg); await refresh(); return r; } catch (error) { toast.error(describeError(error)); return null; } finally { setBusy(''); }
  };

  const catalogo = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (ov?.status?.files || []).filter((f) => !t || `${f.name} ${MOTIVO_LABEL(f.reason)} ${ESTADO_LABEL[f.estado]}`.toLowerCase().includes(t));
  }, [ov, busca]);
  const paginas = Math.max(1, Math.ceil(catalogo.length / POR_PAGINA));
  const visiveis = catalogo.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  if (!podeVer) return <AccessDenied role={auth?.user?.role} permission="maintenance.backup" />;

  return (
    <ModeloBase1PageContainer variant="table" className="d17b-page rb-page">
      <ModeloBase1PageHeader title="Backup e Restauração" description="Proteja os dados: backup verificado, cópia em outro disco, agendamento e restauração guiada." />
      <div className="rb-toolbar" role="toolbar" aria-label="Ações de backup">
        <button type="button" className="rb-btn rb-btn--primary" onClick={() => run('agora', async () => { const r = await center.createBackupNow(); if (r.copiaExterna && !r.copiaExterna.ok) toast.error(`Cópia externa: ${r.copiaExterna.error}`); return r; }, 'Backup criado e verificado.')} disabled={Boolean(busy)}><ShieldCheck size={14} aria-hidden="true" /> {busy === 'agora' ? 'Criando…' : 'Criar backup agora'}</button>
        <button type="button" className="rb-btn" onClick={() => run('copia', () => center.copyToExternal(), 'Cópia externa gravada e conferida.')} disabled={Boolean(busy) || !ov?.externo?.configurado}><FolderOutput size={14} aria-hidden="true" /> Copiar para o destino externo</button>
        <span className="rb-toolbar__spacer" />
        <button type="button" className="rb-btn" onClick={refresh} disabled={Boolean(busy)}><RefreshCw size={14} aria-hidden="true" /> Atualizar</button>
      </div>
      <div className="rb-scroll">
        <Cobertura ov={ov} />
        <p className="rb-note">O arquivo de backup contém todos os dados, inclusive valores comerciais e os usuários (com a senha protegida por hash). Guarde-o em local seguro; para proteger o conteúdo com senha, use o backup protegido abaixo.</p>

        <section className="rb-card" aria-label="Catálogo de backups">
          <div className="rb-section-head">
            <h3>Backups neste computador ({fmtInt(catalogo.length)})</h3>
            <input className="rb-control rb-control--compact" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} placeholder="Buscar" aria-label="Buscar backup" />
          </div>
          <table className="rb-table">
            <thead><tr><th>Arquivo</th><th>Data</th><th>Motivo</th><th className="rb-num">Tamanho</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {visiveis.map((f) => (
                <tr key={f.name} data-backup-estado={f.estado}>
                  <td className="rb-cell--text">{f.name}</td>
                  <td>{fmtDataHora(f.modifiedAt)}</td>
                  <td>{MOTIVO_LABEL(f.reason)}</td>
                  <td className="rb-num">{fmtTam(f.size)}</td>
                  <td>{ESTADO_LABEL[f.estado] || f.estado}{f.erro ? <span className="rb-tag rb-tag--warn" title={f.erro}>{f.erro.slice(0, 60)}</span> : null}</td>
                  <td><button type="button" className="rb-btn" disabled={Boolean(busy)} onClick={() => run(`v-${f.name}`, async () => { const r = await maintenanceService.verifyBackupFile({ name: f.name }); if (!r.ok) throw new Error(r.error); return r; }, 'Backup verificado: íntegro e restaurável.')}>Verificar</button></td>
                </tr>
              ))}
              {!visiveis.length ? <tr><td colSpan={6} className="rb-empty">Nenhum backup.</td></tr> : null}
            </tbody>
          </table>
          {paginas > 1 ? <div className="rb-inline"><button type="button" className="rb-btn" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button><span className="rb-note">Página {pagina} de {paginas}</span><button type="button" className="rb-btn" disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Próxima</button></div> : null}
          {ov?.protegidos?.length ? <p className="rb-note">Backups protegidos por senha: {ov.protegidos.map((p) => p.name).join(', ')}</p> : null}
          <p className="rb-note">Retenção: os backups periódicos mais antigos que os {policy?.manter_periodicos ?? 14} mais recentes são removidos; backups manuais, de segurança (antes de migrar, restaurar, limpar) e o último verificado nunca são removidos por regra.</p>
        </section>

        <section className="rb-card" aria-label="Destino externo">
          <h3 className="rb-subtitle">Cópia em outro disco ou pendrive</h3>
          <p className="rb-note">{ov?.externo?.configurado ? `Destino: ${ov.externo.destino} — ${ov.externo.disponivel ? 'conectado' : 'DESCONECTADO'}${ov.externo.livreBytes ? ` (${fmtTam(ov.externo.livreBytes)} livres)` : ''}.` : 'Nenhum destino escolhido: o backup fica só neste computador (se o computador quebrar, perde-se tudo).'} A cópia é conferida lendo de volta (SHA-256). Sem envio para internet.</p>
          {ov?.ultimaCopiaExterna ? <p className="rb-note">Última cópia conferida: {ov.ultimaCopiaExterna.backupName} em {fmtDataHora(ov.ultimaCopiaExterna.created_at)}.</p> : null}
          {ov?.ultimaFalhaCopia && (!ov.ultimaCopiaExterna || ov.ultimaFalhaCopia.created_at > ov.ultimaCopiaExterna.created_at) ? <p className="rb-note rb-note--warn">Última tentativa falhou: {ov.ultimaFalhaCopia.error}</p> : null}
          {can('settings.manage') ? (
            <div className="rb-inline">
              <button type="button" className="rb-btn" onClick={() => run('dest', () => center.selectExternalDir(), 'Destino escolhido.')} disabled={Boolean(busy)}><HardDriveDownload size={14} aria-hidden="true" /> Escolher destino</button>
              {ov?.externo?.configurado ? <button type="button" className="rb-btn" onClick={() => run('dest-x', () => center.clearExternalDir(), 'Destino removido.')} disabled={Boolean(busy)}>Remover destino</button> : null}
            </div>
          ) : null}
        </section>

        {policy && can('settings.manage') ? (
          <section className="rb-card" aria-label="Agendamento e retenção">
            <h3 className="rb-subtitle">Agendamento e retenção</h3>
            <div className="rb-inline rb-inline--wrap">
              <label className="rb-check"><input type="checkbox" checked={policy.periodico_ativo} onChange={(e) => setPolicy((p) => ({ ...p, periodico_ativo: e.target.checked }))} /> Backup periódico com o aplicativo aberto</label>
              <label className="rb-field"><span className="rb-field__label">A cada (horas)</span><input className="rb-control rb-control--compact" inputMode="numeric" value={policy.intervalo_horas} onChange={(e) => setPolicy((p) => ({ ...p, intervalo_horas: Number(e.target.value) || '' }))} aria-label="Intervalo do backup periódico em horas" /></label>
              <label className="rb-field"><span className="rb-field__label">Manter periódicos</span><input className="rb-control rb-control--compact" inputMode="numeric" value={policy.manter_periodicos} onChange={(e) => setPolicy((p) => ({ ...p, manter_periodicos: Number(e.target.value) || '' }))} aria-label="Quantidade de backups periódicos mantidos" /></label>
              <label className="rb-check"><input type="checkbox" checked={policy.copia_externa_automatica} onChange={(e) => setPolicy((p) => ({ ...p, copia_externa_automatica: e.target.checked }))} /> Copiar para o destino externo depois de cada backup</label>
              <button type="button" className="rb-btn rb-btn--primary" onClick={() => run('pol', async () => { const p = await center.savePolicy(policy); setPolicy(p); return p; }, 'Agendamento salvo.')} disabled={Boolean(busy)}>Salvar agendamento</button>
            </div>
            <p className="rb-note">O backup periódico só acontece com o aplicativo aberto: na primeira oportunidade depois do intervalo (por exemplo, ao abrir no dia seguinte). Com o computador desligado, não há backup.</p>
          </section>
        ) : null}

        <section className="rb-card" aria-label="Backup protegido por senha">
          <h3 className="rb-subtitle"><Lock size={14} aria-hidden="true" /> Backup protegido por senha</h3>
          <p className="rb-note">Gera um arquivo <code>.pbk</code> cifrado (AES-GCM 256, chave derivada da senha) com o banco e os anexos. A senha não é guardada em lugar nenhum: sem ela, o arquivo não abre.</p>
          <div className="rb-inline">
            <input type="password" className="rb-control rb-control--compact" value={senha.a} onChange={(e) => setSenha((s) => ({ ...s, a: e.target.value }))} placeholder="Senha (mín. 10)" aria-label="Senha do backup protegido" autoComplete="new-password" />
            <input type="password" className="rb-control rb-control--compact" value={senha.b} onChange={(e) => setSenha((s) => ({ ...s, b: e.target.value }))} placeholder="Repita a senha" aria-label="Repita a senha do backup protegido" autoComplete="new-password" />
            <button type="button" className="rb-btn" disabled={Boolean(busy) || senha.a.length < 10 || senha.a !== senha.b} onClick={() => run('prot', async () => { const r = await center.exportProtectedBackup(senha.a); setSenha({ a: '', b: '' }); return r; }, 'Backup protegido gravado e conferido.')}>Gerar backup protegido</button>
          </div>
        </section>

        {can('maintenance.restore') ? <RestauracaoGuiada onDone={refresh} /> : <p className="rb-note">Restaurar backup: somente Administrador.</p>}
      </div>
    </ModeloBase1PageContainer>
  );
}
