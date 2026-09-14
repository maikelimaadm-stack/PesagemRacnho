import { useEffect, useState } from 'react';
import { bootstrapLocalDb, getMigrationBootstrapState } from '@/api/db';

// Fluxo (ADR-038): banco pronto → migração com backup físico prévio → app.
// Bloqueio (backup impossível, store `lotes` com dados) nunca toca nos dados:
// a tela explica o motivo e nada é gravado. Falha de backfill abre o app com a
// escrita bloqueada e aviso fixo apontando para Manutenção › Continuar migração.
export default function DbBootstrap({ children }) {
  const [ready, setReady] = useState(false);
  const [erro, setErro] = useState(null);
  const [writeBlocked, setWriteBlocked] = useState(false);

  useEffect(() => {
    let ativo = true;
    bootstrapLocalDb()
      .then((result) => {
        if (!ativo) return;
        setWriteBlocked(Boolean(result?.blocked) || Boolean(getMigrationBootstrapState()?.writeBlocked));
        setReady(true);
      })
      .catch((err) => {
        if (!ativo) return;
        setErro({
          code: err?.code || null,
          reason: err?.reason || null,
          message: err?.message || 'Falha ao preparar o armazenamento local',
        });
      });
    return () => {
      ativo = false;
    };
  }, []);

  if (erro) {
    const migrationBlocked = erro.code === 'MIGRATION_BLOCKED';
    const orientation = erro.reason === 'MIGRATION_BLOCKED_LOTES'
      ? 'A migração foi bloqueada porque a tabela antiga "lotes" ainda contém registros. Nenhum dado foi alterado. Exporte ou revise esses registros na versão anterior antes de atualizar.'
      : erro.reason === 'MIGRATION_BACKUP_FAILED'
        ? 'A migração foi bloqueada porque o backup de segurança não pôde ser gravado e verificado. Nenhum dado foi alterado. Libere espaço em disco ou verifique a pasta de dados e abra o sistema novamente.'
        : null;
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center space-y-3 max-w-lg" role="alert">
          <p className="text-red-600 font-medium">
            {migrationBlocked ? 'Atualização do banco bloqueada por segurança' : 'Não foi possível preparar o armazenamento local'}
          </p>
          {orientation ? <p className="text-sm text-slate-600">{orientation}</p> : null}
          <p className="text-sm text-slate-600">
            Feche e abra o sistema novamente. Se continuar, envie o arquivo de diagnóstico
            em <strong>Manutenção</strong>.
          </p>
          <p className="text-xs text-slate-400">{erro.message}</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <p className="text-sm text-slate-500">Preparando o sistema…</p>
      </div>
    );
  }

  return (
    <>
      {writeBlocked ? (
        <div className="db-write-blocked-banner" role="status">
          A migração do banco não foi concluída. O sistema está em modo somente leitura: abra
          <strong> Backup e Manutenção › Migração › Continuar migração</strong>. Seus dados e o backup de segurança estão preservados.
        </div>
      ) : null}
      {children}
    </>
  );
}
