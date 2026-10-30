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
  const [critico, setCritico] = useState(null);

  // R3-01: a faixa acompanha os bloqueios durante a sessão (restauração crítica ou recuperação conferida).
  useEffect(() => {
    const atualizar = () => {
      const estado = getMigrationBootstrapState();
      setWriteBlocked(Boolean(estado?.writeBlocked));
      setCritico(estado?.criticalBlock || null);
    };
    window.addEventListener('pesagens:bloqueio-escrita', atualizar);
    return () => window.removeEventListener('pesagens:bloqueio-escrita', atualizar);
  }, []);

  useEffect(() => {
    let ativo = true;
    bootstrapLocalDb()
      .then((result) => {
        if (!ativo) return;
        const estado = getMigrationBootstrapState();
        setWriteBlocked(Boolean(result?.blocked) || Boolean(estado?.writeBlocked));
        setCritico(estado?.criticalBlock || null);
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
      <div className="gate-status">
        <div className="gate-status__card" role="alert">
          <h1>{migrationBlocked ? 'Atualização do banco bloqueada por segurança' : 'Não foi possível preparar o armazenamento local'}</h1>
          {orientation ? <p>{orientation}</p> : null}
          <p>
            Feche e abra o sistema novamente. Se continuar, envie o arquivo de diagnóstico
            em <strong>Manutenção</strong>.
          </p>
          <p className="gate-status__detail">{erro.message}</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="gate-status" role="status">
        <div className="gate-status__card">
          <h1>Preparando o armazenamento local</h1>
          <p>O sistema abre em seguida, neste computador.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {critico ? (
        <div className="db-write-blocked-banner" role="alert" data-estado-critico-global="RESTAURACAO_CRITICA">
          A última restauração falhou e a volta automática também. As gravações estão bloqueadas, inclusive ao reabrir o
          sistema: abra <strong>Sistema › Backup e Restauração</strong> e restaure o backup de segurança
          {critico.backupNome ? <> <code>{critico.backupNome}</code></> : ' indicado'} ou outro backup verificado. Não use
          reset nem limpeza de dados.
        </div>
      ) : writeBlocked ? (
        <div className="db-write-blocked-banner" role="status">
          A migração do banco não foi concluída. O sistema está em modo somente leitura: abra
          <strong> Backup e Manutenção › Migração › Continuar migração</strong>. Seus dados e o backup de segurança estão preservados.
        </div>
      ) : null}
      {children}
    </>
  );
}
