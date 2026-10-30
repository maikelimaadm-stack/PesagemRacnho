import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import * as maintenanceService from "@/modules/maintenance/application/maintenanceService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ModeloBase1ActionBar,
  ModeloBase1PageContainer,
  ModeloBase1PageHeader,
} from "@/components/modelobase1";
import { fmtDateTimeBR, fmtInt } from "@/components/common/formatNumber";
import ConfirmActionDialog from "@/components/common/ConfirmActionDialog";
import { useAuth } from "@/components/auth/useAuth";
import MakSegTabs from "@/components/mak/MakSegTabs";
import MaintenanceControlReports from "@/components/reports/MaintenanceControlReports";
import ReportView from "@/components/reports/ReportView";
import { useReportActor } from "@/components/reports/reportUi";
import { resolveReportId } from "@/modules/reporting/definitions/reportCatalog";
import { PESAGENS_CONFERIR_ACOES, PESAGENS_CONFERIR_ID } from "@/modules/reporting/definitions/controle";
import { createPageUrl } from "@/utils";

// Abas (E1 1.4.0): "Sistema" = banco, backup, migração e diagnóstico (como antes); "Controle" =
// relatórios de conferência que saíram do catálogo de Relatórios, abertos na mesma tela de relatório.
// "Sistema" são os próprios cartões da grade da página (sem painel envolvente): a aba não aponta
// aria-controls para um id que não existe.
// F24/P20: Manutenção avançada = integridade, diagnóstico, migração (Sistema), limpeza e reset (Dados — perigoso,
// em aba própria, longe do backup) e relatórios de conferência (Controle). Backup e restauração têm página
// própria (Sistema › Backup e Restauração); importação e exportação ficam nas telas de origem.
const MANUTENCAO_ABAS = [
  { id: "sistema", label: "Sistema", panelId: null },
  { id: "dados", label: "Dados (limpeza e reset)" },
  { id: "controle", label: "Controle" },
];

function fileLabel(result) {
  return result?.backupPath || result?.filePath || result?.path || result?.fileName || "";
}

const MIGRATION_LABELS = {
  CONCLUIDA: "Concluída",
  EM_ANDAMENTO: "Em andamento",
  PENDENTE: "Pendente",
  FALHOU: "Falhou",
  SEM_REGISTRO: "Sem registro",
};

function migrationLabel(status) {
  return MIGRATION_LABELS[status] || status || "—";
}

function migrationTone(status) {
  if (status === "CONCLUIDA") return "font-semibold text-emerald-700";
  if (status === "FALHOU") return "font-semibold text-red-700";
  return "font-semibold text-amber-700";
}

function ManutencaoSistemaPainel({ aba, onAba, actor, onOpenReport }) {
  const navigate = useNavigate();
  // Ações destrutivas seguem a matriz (maintenance.restore/clear/reset/migrate = ADMIN);
  // o serviço recusa de novo — esconder aqui só evita oferecer o que será negado.
  const auth = useAuth();
  const allowed = (action) => (auth ? auth.can(action) : true);
  const [statusLabel, setStatusLabel] = useState("—");
  const [lastCheckAt, setLastCheckAt] = useState("");
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState("");
  const [diagText, setDiagText] = useState("");
  const [diag, setDiag] = useState(null);
  const [backups, setBackups] = useState([]);
  // P21: situação da proteção (último backup VERIFICADO × arquivos encontrados).
  const [backupStatus, setBackupStatus] = useState(null);
  const [versions, setVersions] = useState(null);
  const [migration, setMigration] = useState(null);
  const [migrationDry, setMigrationDry] = useState(null);
  const [migrationProgress, setMigrationProgress] = useState("");
  const [clearText, setClearText] = useState("");
  const [resetText, setResetText] = useState("");

  const refreshStatus = useCallback(async () => {
    try {
      const available = await maintenanceService.isMaintenanceAvailable();
      if (!available) {
        setStatusLabel("Atenção");
        setDiagText("Manutenção disponível apenas no app desktop.");
        return;
      }
      const [s, integrity, backupList, migrationStatus] = await Promise.all([
        maintenanceService.getDatabaseStats(),
        maintenanceService.runIntegrityCheck().catch((err) => ({ ok: false, error: err.message })),
        maintenanceService.getBackupStatus().catch(() => maintenanceService.listBackups().then((r) => ({ files: r?.full || [], protecao: null })).catch(() => ({ files: [], protecao: null }))),
        maintenanceService.getMigrationStatus().catch(() => null),
      ]);
      setStats(s);
      setBackups(backupList?.files || []);
      setBackupStatus(backupList || null);
      setMigration(migrationStatus);
      const ok = integrity?.ok !== false && integrity?.result === "ok";
      setStatusLabel(ok ? "OK" : "Erro");
      setLastCheckAt(fmtDateTimeBR(new Date()));
      setDiagText(
        ok
          ? "Banco íntegro."
          : "Foi encontrado um problema. Faça backup e envie o relatório técnico."
      );
    } catch (err) {
      setStatusLabel("Erro");
      setDiagText(err.message || "Falha ao verificar o banco.");
      toast.error("Não foi possível verificar o banco.");
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    try {
      setVersions(maintenanceService.getVersionInfo());
    } catch {
      setVersions(null);
    }
    let active = true;
    (async () => {
      try {
        const info = await window.pesagemApp?.getDiagnosticInfo?.();
        if (active) setDiag(info || null);
      } catch {
        /* diagnóstico é auxiliar; ignora falha */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const run = async (key, fn, okMsg, errMsg) => {
    setBusy(key);
    try {
      const result = await fn();
      toast.success(okMsg, { description: fileLabel(result) || undefined });
      await refreshStatus();
      return result;
    } catch (err) {
      toast.error(errMsg || "Operação falhou.", { description: err.message });
      return null;
    } finally {
      setBusy("");
    }
  };

  const onIntegrity = () =>
    run(
      "integrity",
      async () => {
        const r = await maintenanceService.runIntegrityCheck();
        setDiagText(r?.ok ? "Banco íntegro." : `Problemas encontrados: ${fmtInt(r?.issues?.length || 0)}.`);
        return r;
      },
      "Verificação de integridade concluída.",
      "Foi encontrado um problema. Faça backup e envie o relatório técnico."
    );

  const onReconcile = () =>
    run(
      "reconcile",
      async () => {
        const r = await maintenanceService.reconcileDerivations();
        const integ = await maintenanceService.runIntegrityCheck();
        setDiagText(integ?.ok ? `Derivados reconciliados (${fmtInt(r.animais)} animais). Banco íntegro.` : `Derivados reconciliados; restam ${fmtInt(integ?.issues?.length || 0)} problema(s).`);
        return r;
      },
      "Lotes, movimentos e GMD reconciliados (backup criado antes).",
      "Não foi possível reconciliar."
    );

  const onQuick = () =>
    run(
      "quick",
      () => maintenanceService.runQuickCheck(),
      "Verificação rápida OK.",
      "Verificação rápida encontrou problema."
    );

  const onMigrationDryRun = () =>
    run(
      "mig-dry",
      async () => {
        const report = await maintenanceService.dryRunMigration();
        setMigrationDry(report);
        return report;
      },
      "Simulação da migração concluída (nada foi gravado).",
      "Não foi possível simular a migração."
    );

  const onResumeMigration = () =>
    run(
      "mig-resume",
      async () => {
        setMigrationProgress("");
        const result = await maintenanceService.resumeMigration({
          onProgress: (p) => setMigrationProgress(`${p.passo}: ${p.message} (${fmtInt(p.processed || 0)}/${fmtInt(p.total || 0)})`),
        });
        setMigrationDry(null);
        return result;
      },
      "Migração continuada com sucesso.",
      "A migração não pôde ser concluída. Veja o diagnóstico."
    );

  const onClearOperational = () =>
    run(
      "clear-op",
      async () => {
        const result = await maintenanceService.clearOperationalData({ confirmationText: clearText });
        setClearText("");
        return result;
      },
      "Dados operacionais limpos. Usuários, configurações e cadastros foram preservados.",
      "Não foi possível limpar os dados operacionais."
    );

  const onResetAll = () =>
    run(
      "reset-all",
      async () => {
        const result = await maintenanceService.resetAllData({ confirmationText: resetText });
        setResetText("");
        return result;
      },
      "Reset completo concluído. O sistema voltou ao estado inicial.",
      "Não foi possível executar o reset completo."
    );

  const copyDiag = async () => {
    let snapshot = null;
    try {
      snapshot = await maintenanceService.getDiagnosticSnapshot();
    } catch {
      snapshot = null;
    }
    const v = snapshot?.versoes || versions || {};
    const m = snapshot?.migracao || null;
    const text = [
      `Aplicativo: ${v.app ?? diag?.version ?? "—"}`,
      `Banco (schema): ${v.dbSchema ?? stats?.dbVersion ?? "—"}`,
      `Backup (formato): ${v.backupFormat ?? "—"}`,
      `Build UI: ${v.uiBuildId ?? "—"}`,
      `Build dados: ${v.dataBuildId ?? "—"}`,
      `Contrato UI: ${v.uiContract ?? "—"}`,
      `Contrato dados: ${v.dataContract ?? "—"}`,
      diag ? `Empacotado: ${diag.isPackaged ? "sim" : "não (dev)"}` : "",
      `Armazenamento: ${stats?.dbType || "IndexedDB local (Dexie)"} · versão ${stats?.dbVersion ?? v.dbSchema ?? "—"}`,
      `Status do banco: ${statusLabel}`,
      m ? `Migração v${m.versao ?? v.dbSchema}: ${migrationLabel(m.status)}${m.last_checkpoint ? ` · checkpoint ${m.last_checkpoint}` : ""}${m.processed != null ? ` · ${fmtInt(m.processed)}/${fmtInt(m.total || 0)}` : ""}` : "",
      m?.error ? `Erro da migração: ${m.error.code || ""} ${m.error.message || ""}`.trim() : "",
      m?.writeBlocked ? "Escrita bloqueada: sim" : "",
      m?.backup?.path ? `Backup pré-migração: ${m.backup.path}` : "",
      diag ? `Caminho do log: ${diag.logPath || "—"}` : "",
      `Última verificação: ${lastCheckAt}`,
      diagText,
      snapshot ? JSON.stringify({ migracao: snapshot.migracao, armazenamento: snapshot.armazenamento, integridade: snapshot.integridade }, null, 2) : (stats ? JSON.stringify(stats, null, 2) : ""),
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Diagnóstico copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const migrationState = migration?.state || null;
  const migrationStatus = migrationState?.status || "SEM_REGISTRO";
  const canResume = ["PENDENTE", "EM_ANDAMENTO", "FALHOU"].includes(migrationStatus) || Boolean(migration?.blocked);
  const relatorio = migrationState?.relatorio || null;

  return (
    <ModeloBase1PageContainer
      variant="maintenance"
      className="d17b-page d17b-maintenance-page cadastro-emp-scope mg-empresas-scope"
    >
      <ModeloBase1PageHeader
        visuallyHidden
        title="Manutenção avançada"
        description="Integridade, diagnóstico, migração, limpeza e reset. Backup e restauração ficam em Sistema › Backup e Restauração."
      />
      <ModeloBase1ActionBar
        className="mb1-operational-actionbar"
        aria-label="Ações de manutenção"
        end={
          <Button type="button" size="sm" className="emp-toolbar-btn px-3" onClick={refreshStatus} disabled={!!busy}>
            Atualizar status
          </Button>
        }
      />
      <MakSegTabs tabs={MANUTENCAO_ABAS} activeTab={aba} onChange={onAba} idPrefix="manutencao" label="Seções da Manutenção" className="manutencao-tabs" />

      {aba === "controle" ? (
        <MaintenanceControlReports actor={actor} onOpen={onOpenReport} />
      ) : (<>
      {aba === "sistema" && (<>
      <Card className="emp-content-card">
        <CardHeader className="emp-form-section-panel--corp">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide">Status do banco</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p>
            Status:{" "}
            <span
              className={
                statusLabel === "OK"
                  ? "font-semibold text-emerald-700"
                  : statusLabel === "Erro"
                    ? "font-semibold text-red-700"
                    : "font-semibold text-amber-700"
              }
            >
              {statusLabel}
            </span>
          </p>
          <p>Banco de dados: {statusLabel === "OK" ? "funcionando" : "verificar"}</p>
          <p>Última verificação: {lastCheckAt || "—"}</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
            <li>Pesagens: {stats?.weighingEntries != null ? fmtInt(stats.weighingEntries) : "—"}</li>
            <li>Apartações: {stats?.apartacoes != null ? fmtInt(stats.apartacoes) : "—"}</li>
            <li>Embarques: {stats?.shipments != null ? fmtInt(stats.shipments) : "—"}</li>
            <li>Animais: {stats?.counts?.animais != null ? fmtInt(stats.counts.animais) : "—"}</li>
            <li>Aplicações de sanidade: {stats?.counts?.aplicacoesSanidade != null ? fmtInt(stats.counts.aplicacoesSanidade) : "—"}</li>
            <li>Programas de sanidade: {stats?.counts?.programasSanidade != null ? fmtInt(stats.counts.programasSanidade) : "—"}</li>
            <li className="col-span-2">
              Armazenamento: {stats?.dbType || "IndexedDB local (Dexie)"}
            </li>
          </ul>
          <div className="pt-2 mt-1 border-t border-slate-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Versões</p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600 text-xs">
              <li>Aplicativo: {versions?.app ?? diag?.version ?? "—"}</li>
              <li>Banco: {versions?.dbSchema ?? stats?.dbVersion ?? "—"}</li>
              <li>Backup: {versions?.backupFormat ?? "—"}</li>
              <li>Build UI: {versions?.uiBuildId ?? "—"}</li>
              <li>Build dados: {versions?.dataBuildId ?? "—"}</li>
              <li>Contrato UI: {versions?.uiContract ?? "—"}</li>
              <li>Contrato dados: {versions?.dataContract ?? "—"}</li>
              <li>
                Migração:{" "}
                <span className={migrationTone(migrationStatus)}>{migrationLabel(migrationStatus)}</span>
                {migration?.blocked ? " · escrita bloqueada" : ""}
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="emp-content-card">
        <CardHeader className="emp-form-section-panel--corp">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide">Migração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <div className="space-y-1">
            <p>
              Migração v{migration?.versao ?? versions?.dbSchema ?? "—"}:{" "}
              <span className={migrationTone(migrationStatus)}>{migrationLabel(migrationStatus)}</span>
            </p>
            {(migration?.cadeia || []).length > 1 && (
              <p className="text-xs text-slate-500">
                Cadeia: {migration.cadeia.map((item) => `v${item.versao} ${migrationLabel(item.status || "SEM_REGISTRO")}`).join(" · ")}
              </p>
            )}
            {migrationState?.last_checkpoint && <p className="text-xs text-slate-500">Checkpoint: {migrationState.last_checkpoint}</p>}
            {migrationState?.processed != null && migrationState?.total > 0 && (
              <p className="text-xs text-slate-500">Progresso: {fmtInt(migrationState.processed)} de {fmtInt(migrationState.total)} registros</p>
            )}
            {migrationState?.backup?.path && <p className="text-xs text-slate-500 break-all">Backup pré-migração: {migrationState.backup.path}</p>}
            {migrationState?.error && (
              <p className="text-xs text-red-700">Erro: {migrationState.error.code ? `${migrationState.error.code} — ` : ""}{migrationState.error.message}</p>
            )}
            {migration?.blocked && (
              <p className="text-xs text-red-700">A escrita está bloqueada até a migração ser concluída. Os dados e o backup pré-migração estão preservados.</p>
            )}
            {migrationProgress && <p className="text-xs text-slate-500">{migrationProgress}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="emp-toolbar-btn px-4" onClick={onMigrationDryRun} disabled={!!busy}>
              {busy === "mig-dry" ? "Simulando…" : "Simular migração (dry-run)"}
            </Button>
            <Button type="button" className="emp-toolbar-btn emp-toolbar-btn-save px-4" onClick={onResumeMigration} disabled={!!busy || !canResume || !allowed("maintenance.migrate")}>
              {busy === "mig-resume" ? "Migrando…" : "Continuar migração"}
            </Button>
          </div>
          {relatorio && (
            <div className="border border-slate-200 rounded-md p-3 bg-slate-50 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-700">Relatório da migração</p>
              {relatorio.operacoesLegadasEntrada !== undefined ? (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                <li className="col-span-2">Stores criadas: {(relatorio.storesCriadas || []).join(", ") || "—"}</li>
                <li>Movimentos classificados: {fmtInt(relatorio.movimentosComNatureza || 0)}</li>
                <li>Movimentos sem classificação: {fmtInt(relatorio.movimentosSemNatureza || 0)}</li>
                <li>Entradas legadas (operações): {fmtInt(relatorio.operacoesLegadasEntrada || 0)}</li>
                <li>Saídas legadas (operações): {fmtInt(relatorio.operacoesLegadasSaida || 0)}</li>
                <li>Itens legados: {fmtInt(relatorio.itensLegados || 0)}</li>
                <li>Pesagens já convertidas: {fmtInt(relatorio.pesagensJaConvertidas || 0)}</li>
              </ul>
              ) : relatorio.storesCriadas !== undefined ? (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                <li className="col-span-2">Stores criadas: {(relatorio.storesCriadas || []).join(", ") || "—"}</li>
                <li>Programas de sanidade: {fmtInt(relatorio.programasSanidade || 0)}</li>
                <li>Medicamentos: {fmtInt(relatorio.medicamentos || 0)}</li>
                <li>Aplicações de sanidade: {fmtInt(relatorio.aplicacoesSanidade || 0)}</li>
              </ul>
              ) : (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                <li>Marcas criadas: {fmtInt(relatorio.marcas || 0)}</li>
                <li>Raças criadas: {fmtInt(relatorio.racas || 0)}</li>
                <li>Categorias: {fmtInt(relatorio.categorias || 0)}</li>
                <li>Parceiros: {fmtInt(relatorio.parceiros || 0)}</li>
                <li>Propriedades: {fmtInt(relatorio.propriedades || 0)}</li>
                <li>Causas de morte: {fmtInt(relatorio.causasMorte || 0)}</li>
                <li>Animais atualizados: {fmtInt(relatorio.animaisAtualizados || 0)}</li>
                <li>Identificadores: {fmtInt(relatorio.identificadores || 0)}</li>
                <li>Saídas sem motivo: {fmtInt(relatorio.saidasSemMotivo || 0)}</li>
                <li>Colisões de marca: {fmtInt((relatorio.colisoesMarca || []).length)}</li>
                <li className="col-span-2">Chaves legadas removidas: {fmtInt((relatorio.chavesLegadasRemovidas || []).length)}</li>
              </ul>
              )}
              {(relatorio.colisoesMarca || []).length > 0 && (
                <div className="pt-1">
                  <p className="font-semibold text-amber-700">Grafias de marca mantidas separadas (revisar no cadastro de marcas):</p>
                  <ul className="list-disc pl-4">
                    {relatorio.colisoesMarca.map((c) => (
                      <li key={c.nome_normalizado}>{c.nome_normalizado}: {(c.grafias || []).join(" · ")} — números em conflito: {(c.numeros || []).map((n) => n.numero).join(", ")}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {migrationDry && (
            <div className="border border-slate-200 rounded-md p-3 bg-slate-50 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-700">Simulação (nada foi gravado) — pendente: {migrationDry.pendente ? "sim" : "não"}</p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                <li>Marcas a criar: {fmtInt(migrationDry.marcas?.novas || 0)}</li>
                <li>Colisões de marca: {fmtInt((migrationDry.marcas?.colisoes || []).length)}</li>
                <li>Raças a criar: {fmtInt(migrationDry.racas?.novas || 0)}</li>
                <li>Categorias faltantes: {fmtInt((migrationDry.categorias?.faltantes || []).length)}</li>
                <li>Parceiros a criar: {fmtInt(migrationDry.parceiros?.novos || 0)}</li>
                <li>Causas de morte a criar: {fmtInt(migrationDry.causasMorte?.novas || 0)}</li>
                <li>Animais pendentes: {fmtInt(migrationDry.animais?.pendentes || 0)} de {fmtInt(migrationDry.animais?.total || 0)}</li>
                <li>Identificadores pendentes: {fmtInt(migrationDry.identificadores?.pendentes || 0)} de {fmtInt(migrationDry.identificadores?.total || 0)}</li>
                <li>Pesagens com payload a limpar: {fmtInt(migrationDry.pesagens?.payloadsPendentes || 0)}</li>
                <li>Sessões a converter: {fmtInt(migrationDry.sessoes?.pendentes || 0)}</li>
                <li>Saídas sem motivo: {fmtInt(migrationDry.animais?.saidasSemMotivo || 0)}</li>
                <li>Chaves legadas: {fmtInt((migrationDry.chavesLegadas || []).length)}</li>
                {(migrationDry.cadeia || []).length > 0 && (
                  <li className="col-span-2">
                    Cadeia: {migrationDry.cadeia.map((item) => `v${item.versao} ${item.pendente ? "pendente" : "concluída"}`).join(" · ")}
                  </li>
                )}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="emp-content-card">
        <CardHeader className="emp-form-section-panel--corp">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide">Backup, restauração, importação e exportação</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <p className="w-full" data-backup-protecao={backupStatus?.protecao || "desconhecida"}>
            {backupStatus?.lastVerified ? <>Último backup verificado: {fmtDateTimeBR(backupStatus.lastVerified.verifiedAt)}.</> : <>Nenhum backup verificado ainda.</>}{" "}
            Backup e restauração têm página própria; a importação fica em Operação › Importação e a exportação de pesagens na Relação de Pesagens.
          </p>
          <Button type="button" className="emp-toolbar-btn emp-toolbar-btn-save px-4" onClick={() => navigate(createPageUrl("BackupRestauracao"))}>
            Abrir Backup e Restauração
          </Button>
          <Button type="button" className="emp-toolbar-btn px-4" onClick={() => navigate(createPageUrl("Importacao"))}>
            Abrir Importação
          </Button>
        </CardContent>
      </Card>

      </>)}
      {aba === "dados" && (allowed("maintenance.clear") || allowed("maintenance.reset")) && (
      <Card className="emp-content-card">
        <CardHeader className="emp-form-section-panel--corp">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide">Limpeza de dados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-700">
          {allowed("maintenance.clear") && (
          <div className="space-y-2 border border-slate-200 rounded-md p-3">
            <p className="font-medium">Limpar dados operacionais</p>
            <p className="text-xs text-slate-500">
              Apaga pesagens, animais, sessões, lotes, embarques e aplicações de sanidade. Preserva usuários, configurações, histórico de backups e os cadastros (marcas, raças, categorias, parceiros, propriedades, causas de morte, programas de sanidade e medicamentos). Um backup físico é criado e validado antes.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={clearText}
                onChange={(event) => setClearText(event.target.value)}
                placeholder={`Digite ${maintenanceService.CLEAR_CONFIRMATION_TEXT} para confirmar`}
                className="max-w-xs"
                aria-label="Confirmação da limpeza de dados operacionais"
              />
              <Button
                type="button"
                variant="destructive"
                onClick={onClearOperational}
                disabled={!!busy || clearText.trim().toUpperCase() !== maintenanceService.CLEAR_CONFIRMATION_TEXT}
              >
                {busy === "clear-op" ? "Limpando…" : "Limpar dados operacionais"}
              </Button>
            </div>
          </div>
          )}
          {allowed("maintenance.reset") && (
          <div className="space-y-2 border border-red-200 rounded-md p-3">
            <p className="font-medium text-red-700">Reset completo (ADMIN)</p>
            <p className="text-xs text-slate-500">
              Apaga tudo — inclusive usuários, configurações e cadastros — e mantém apenas o histórico de backups. Exclusivo do perfil ADMIN. Um backup físico é criado e validado antes; ao terminar o sistema volta à configuração inicial.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={resetText}
                onChange={(event) => setResetText(event.target.value)}
                placeholder={`Digite ${maintenanceService.RESET_CONFIRMATION_TEXT} para confirmar`}
                className="max-w-xs"
                aria-label="Confirmação do reset completo"
              />
              <Button
                type="button"
                variant="destructive"
                onClick={onResetAll}
                disabled={!!busy || resetText.trim().toUpperCase() !== maintenanceService.RESET_CONFIRMATION_TEXT}
              >
                {busy === "reset-all" ? "Executando…" : "Reset completo (ADMIN)"}
              </Button>
            </div>
          </div>
          )}
        </CardContent>
      </Card>
      )}

      {aba === "sistema" && (
      <Card className="emp-content-card">
        <CardHeader className="emp-form-section-panel--corp">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide">Diagnóstico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="emp-toolbar-btn px-3" onClick={onIntegrity} disabled={!!busy}>
              Verificar integridade
            </Button>
            {allowed("maintenance.migrate") && (
              <Button type="button" className="emp-toolbar-btn px-3" onClick={onReconcile} disabled={!!busy} title="Recompõe lotes, movimentos e GMD a partir das pesagens (cria backup antes)">
                {busy === "reconcile" ? "Reconciliando…" : "Reconciliar derivados"}
              </Button>
            )}
            <Button type="button" className="emp-toolbar-btn px-3" onClick={onQuick} disabled={!!busy}>
              Verificação rápida
            </Button>
            <Button type="button" className="emp-toolbar-btn px-3" onClick={refreshStatus} disabled={!!busy}>
              Ver estatísticas do banco
            </Button>
            <Button type="button" size="sm" className="emp-toolbar-btn px-3" onClick={copyDiag}>
              Copiar diagnóstico
            </Button>
          </div>
          <p className="text-sm text-slate-600">{diagText || "—"}</p>
          <p className="text-xs text-slate-400">O diagnóstico copiado inclui versões, estado da migração, contagens e integridade — nunca dados de usuários.</p>
          {diag && (
            <div className="pt-2 mt-1 border-t border-slate-100 text-xs text-slate-500 space-y-0.5">
              <p>Versão: {diag.version}</p>
              <p>Armazenamento: {stats?.dbType || "IndexedDB local (Dexie)"} · versão {stats?.dbVersion ?? versions?.dbSchema ?? 1}</p>
              <p>Banco: {statusLabel === "OK" ? "OK" : "verificar"}</p>
              <p className="break-all">Log: {diag.logPath || "—"}</p>
            </div>
          )}
        </CardContent>
      </Card>
      )}
      </>)}
    </ModeloBase1PageContainer>
  );
}

// `?aba=controle` abre a aba Controle; `&r=<relatório>` abre um relatório de controle na mesma tela
// de relatório (a URL leva só identificadores, como em Relatórios).
export default function ManutencaoSistema() {
  const location = useLocation();
  const navigate = useNavigate();
  const actor = useReportActor();
  const auth = useAuth();
  const query = new URLSearchParams(location.search);
  const aba = ["controle", "dados"].includes(query.get("aba")) ? query.get("aba") : "sistema";
  const base = createPageUrl("ManutencaoSistema");
  const report = aba === "controle" && query.get("r") ? resolveReportId(query.get("r")) : null;
  const reportOpen = Boolean(report?.definition && actor);
  const openReportId = report?.definition?.id ?? null;
  // M1: "Pesagens para conferir" — Corrigir (Lançamento com a pesagem aberta para edição) e Ver ficha do animal,
  // por linha, só as ações que o perfil pode (o Lançamento e a ficha repetem a verificação).
  const rowActions = useMemo(() => {
    if (openReportId !== PESAGENS_CONFERIR_ID) return null;
    const allowed = (action) => (auth ? auth.can(action) : true);
    return {
      title: (row) => `Ações da pesagem do animal ${row?.numero_animal ?? ""}`.trim(),
      items: PESAGENS_CONFERIR_ACOES.filter((action) => allowed(action.permission)).map((action) => ({
        id: action.id,
        label: action.label,
        enabled: (row) => Boolean(action.page(row)),
        onSelect: (row) => {
          const page = action.page(row);
          if (page) navigate(createPageUrl(page));
        },
      })),
    };
  }, [openReportId, auth, navigate]);
  // O painel continua montado (só escondido) enquanto o relatório está aberto: voltar não refaz a
  // verificação de integridade nem perde simulação/diagnóstico em andamento.
  return (
    <>
      <div style={{ display: reportOpen ? "none" : "contents" }}>
        <ManutencaoSistemaPainel
          aba={aba}
          actor={actor}
          onAba={(id) => navigate(id === "sistema" ? base : `${base}?aba=${id}`)}
          onOpenReport={(id) => navigate(`${base}?aba=controle&r=${encodeURIComponent(id)}`)}
        />
      </div>
      {reportOpen ? (
        <ReportView
          key={report.definition.id}
          reportId={report.definition.id}
          actor={actor}
          backLabel="Manutenção"
          allowPreferences={false}
          onBack={() => navigate(`${base}?aba=controle`)}
          rowActions={rowActions}
        />
      ) : null}
    </>
  );
}
