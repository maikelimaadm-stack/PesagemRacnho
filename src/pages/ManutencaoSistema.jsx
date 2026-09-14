import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import * as maintenanceService from "@/modules/maintenance/application/maintenanceService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ModeloBase1ActionBar,
  ModeloBase1PageContainer,
  ModeloBase1PageHeader,
} from "@/components/modelobase1";
import { UI_BUILD_ID, UI_MODEL, UI_VERSION } from "@/components/modelobase1/uiBuildInfo";
import { fmtDateTimeBR, fmtInt } from "@/components/common/formatNumber";
import ConfirmActionDialog from "@/components/common/ConfirmActionDialog";

function fileLabel(result) {
  return result?.backupPath || result?.filePath || result?.path || result?.fileName || "";
}

export default function ManutencaoSistema() {
  const [statusLabel, setStatusLabel] = useState("—");
  const [lastCheckAt, setLastCheckAt] = useState("");
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState("");
  const [diagText, setDiagText] = useState("");
  const [importDry, setImportDry] = useState(null);
  const [importPayload, setImportPayload] = useState(null);
  const [importFileName, setImportFileName] = useState("");
  const [restoreDry, setRestoreDry] = useState(null);
  const [restorePath, setRestorePath] = useState("");
  const [restoreFileName, setRestoreFileName] = useState("");
  const [diag, setDiag] = useState(null);
  const [backups, setBackups] = useState([]);
  const [confirmation, setConfirmation] = useState(null);

  const refreshStatus = useCallback(async () => {
    try {
      const available = await maintenanceService.isMaintenanceAvailable();
      if (!available) {
        setStatusLabel("Atenção");
        setDiagText("Manutenção disponível apenas no app desktop.");
        return;
      }
      const [s, integrity, backupList] = await Promise.all([
        maintenanceService.getDatabaseStats(),
        maintenanceService.runIntegrityCheck().catch((err) => ({ ok: false, error: err.message })),
        maintenanceService.listBackups().catch(() => ({ full: [] })),
      ]);
      setStats(s);
      setBackups(backupList?.full || []);
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

  const onBackupDatabase = () =>
    run(
      "bak-db",
      () => maintenanceService.createDatabaseBackup({ reason: "manual-ui" }),
      "Backup criado com sucesso.",
      "Não foi possível criar o backup."
    );

  const onBackupFull = () =>
    run(
      "bak-full",
      () => maintenanceService.createFullDataBackup({ reason: "manual-ui" }),
      "Backup completo criado com sucesso.",
      "Não foi possível criar o backup completo."
    );

  const onExportCsv = () =>
    run(
      "exp-csv",
      () => maintenanceService.exportWeighingCsv({}),
      "Exportação CSV concluída.",
      "Não foi possível exportar CSV."
    );

  const onExportJson = () =>
    run(
      "exp-json",
      () => maintenanceService.exportWeighingJson({}),
      "Exportação JSON concluída.",
      "Não foi possível exportar JSON."
    );

  const onIntegrity = () =>
    run(
      "integrity",
      async () => {
        const r = await maintenanceService.runIntegrityCheck();
        setDiagText("Banco íntegro.");
        return r;
      },
      "Banco íntegro.",
      "Foi encontrado um problema. Faça backup e envie o relatório técnico."
    );

  const onQuick = () =>
    run(
      "quick",
      () => maintenanceService.runQuickCheck(),
      "Verificação rápida OK.",
      "Verificação rápida encontrou problema."
    );

  const onSelectImport = async () => {
    setBusy("imp-select");
    try {
      const selected = await maintenanceService.selectImportJsonFile();
      if (selected?.canceled) return;
      const dry = await maintenanceService.dryRunImportWeighingJson(selected.payload);
      setImportPayload(selected.payload);
      setImportFileName(selected.fileName || "arquivo.json");
      setImportDry(dry);
      toast.success("Análise concluída (dry-run).");
    } catch (err) {
      toast.error("Não foi possível analisar o arquivo.", { description: err.message });
      setImportDry(null);
      setImportPayload(null);
    } finally {
      setBusy("");
    }
  };

  const onApplyImport = async () => {
    if (!importPayload || !importDry) return;
    setConfirmation('import');
  };

  const applyImportConfirmed = async () => {
    setConfirmation(null);
    await run(
      "imp-apply",
      async () => {
        const result = await maintenanceService.applyImportWeighingJson(importPayload, {
          skipDuplicates: true,
        });
        setImportDry(null);
        setImportPayload(null);
        setImportFileName("");
        return result;
      },
      "Importação concluída.",
      "Não foi possível importar os dados."
    );
  };

  const onSelectRestore = async () => {
    setBusy("res-select");
    try {
      const selected = await maintenanceService.selectBackupFile();
      if (selected?.canceled) return;
      const dry = await maintenanceService.dryRunRestoreBackup(selected.payload);
      setRestorePath(selected.payload);
      setRestoreFileName(selected.fileName || "backup.json");
      setRestoreDry(dry);
      if (dry?.restorable) toast.success("Backup válido (dry-run).");
      else toast.error("Backup inválido ou não restaurável.");
    } catch (err) {
      toast.error("Não foi possível analisar o backup.", { description: err.message });
      setRestoreDry(null);
      setRestorePath("");
    } finally {
      setBusy("");
    }
  };

  const onApplyRestore = async () => {
    if (!restorePath || !restoreDry?.restorable) return;
    setConfirmation('restore');
  };

  const applyRestoreConfirmed = async () => {
    setConfirmation(null);
    await run(
      "res-apply",
      async () => {
        const result = await maintenanceService.applyRestoreBackup(restorePath);
        setRestoreDry(null);
        setRestorePath("");
        setRestoreFileName("");
        return result;
      },
      "Restauração concluída.",
      "Não foi possível restaurar o backup."
    );
  };

  const copyDiag = async () => {
    const text = [
      diag ? `Versão: ${diag.version}` : "",
      diag ? `Empacotado: ${diag.isPackaged ? "sim" : "não (dev)"}` : "",
      `Interface: ${UI_VERSION} · ${UI_MODEL} · ${UI_BUILD_ID}`,
      `Armazenamento: ${stats?.dbType || "IndexedDB local (Dexie)"} · versão ${stats?.dbVersion ?? 1}`,
      `Status do banco: ${statusLabel}`,
      diag ? `Caminho do log: ${diag.logPath || "—"}` : "",
      `Última verificação: ${lastCheckAt}`,
      diagText,
      stats ? JSON.stringify(stats, null, 2) : "",
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

  return (
    <ModeloBase1PageContainer
      variant="maintenance"
      className="d17b-page d17b-maintenance-page cadastro-emp-scope mg-empresas-scope"
    >
      <ModeloBase1PageHeader
        visuallyHidden
        title="Backup e Manutenção"
        description="Proteja seus dados: backup, exportação, restauração e verificação do banco."
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
            <li className="col-span-2">
              Armazenamento: {stats?.dbType || "IndexedDB local (Dexie)"}
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="emp-content-card">
        <CardHeader className="emp-form-section-panel--corp">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide">Backup</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" className="emp-toolbar-btn emp-toolbar-btn-save px-4" onClick={onBackupDatabase} disabled={!!busy}>
            {busy === "bak-db" ? "Criando…" : "Criar backup do banco"}
          </Button>
          <Button type="button" className="emp-toolbar-btn px-4" onClick={onBackupFull} disabled={!!busy}>
            {busy === "bak-full" ? "Criando…" : "Criar backup completo"}
          </Button>
          <p className="w-full text-xs text-slate-500">
            Inclui todos os stores, manifesto, versão, contagens e SHA-256. A gravação usa arquivo temporário e valida o conteúdo antes de concluir.
          </p>
          <div className="w-full border border-slate-200 rounded-md overflow-hidden">
            <div className="px-3 py-2 text-xs font-semibold bg-slate-50">Backups físicos encontrados</div>
            {backups.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-500">Nenhum backup físico catalogado neste ambiente.</p>
            ) : backups.slice(0, 10).map((backup) => (
              <div key={backup.path} className="px-3 py-2 border-t border-slate-100 text-xs flex flex-wrap justify-between gap-2">
                <span className="font-medium break-all">{backup.name}</span>
                <span>{fmtInt(backup.size)} bytes · {fmtDateTimeBR(backup.modifiedAt)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="emp-content-card">
        <CardHeader className="emp-form-section-panel--corp">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide">Exportação</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" className="emp-toolbar-btn px-4" onClick={onExportCsv} disabled={!!busy}>
            Exportar pesagens em CSV
          </Button>
          <Button type="button" className="emp-toolbar-btn px-4" onClick={onExportJson} disabled={!!busy}>
            Exportar pesagens em JSON
          </Button>
        </CardContent>
      </Card>

      <Card className="emp-content-card">
        <CardHeader className="emp-form-section-panel--corp">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide">Importação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button type="button" className="emp-toolbar-btn px-4" onClick={onSelectImport} disabled={!!busy}>
            Selecionar JSON e analisar
          </Button>
          {importDry && (
            <div className="text-sm text-slate-700 space-y-1 border border-slate-200 rounded-md p-3 bg-slate-50">
              <p className="font-medium">Arquivo: {importFileName}</p>
              <p>Registros: {(importDry.totalRecords ?? importDry.total) != null ? fmtInt(importDry.totalRecords ?? importDry.total) : "—"}</p>
              <p>Válidos: {(importDry.validRecords ?? importDry.valid) != null ? fmtInt(importDry.validRecords ?? importDry.valid) : "—"}</p>
              <p>Inválidos: {(importDry.invalidRecords ?? importDry.invalid) != null ? fmtInt(importDry.invalidRecords ?? importDry.invalid) : "—"}</p>
              <p>Duplicados: {importDry.duplicates != null ? fmtInt(importDry.duplicates) : "—"}</p>
              <p>Conflitos: {fmtInt(importDry.conflicts ?? 0)}</p>
              <p className="text-xs text-slate-500">
                Antes da importação, o sistema criará um backup automático.
              </p>
              <Button type="button" className="emp-toolbar-btn emp-toolbar-btn-save px-4" onClick={onApplyImport} disabled={!!busy || !importPayload}>
                Importar dados
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="emp-content-card">
        <CardHeader className="emp-form-section-panel--corp">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide">Restauração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button type="button" className="emp-toolbar-btn px-4" onClick={onSelectRestore} disabled={!!busy}>
            Selecionar backup (.json)
          </Button>
          {restoreDry && (
            <div className="text-sm text-slate-700 space-y-1 border border-slate-200 rounded-md p-3 bg-slate-50">
              <p className="font-medium">Arquivo: {restoreFileName}</p>
              <p>Backup válido: {restoreDry.restorable ? "sim" : "não"}</p>
              <p>Integridade: {restoreDry.integrity || "—"}</p>
              <p>
                Data:{" "}
                {restoreDry.manifest?.createdAt || restoreDry.createdAt
                  ? fmtDateTimeBR(restoreDry.manifest?.createdAt || restoreDry.createdAt)
                  : "não informada no manifesto"}
              </p>
              <Button
                type="button"
                variant="destructive"
                onClick={onApplyRestore}
                disabled={!!busy || !restoreDry.restorable}
              >
                Restaurar backup
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="emp-content-card">
        <CardHeader className="emp-form-section-panel--corp">
          <CardTitle className="text-xs font-semibold uppercase tracking-wide">Diagnóstico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="emp-toolbar-btn px-3" onClick={onIntegrity} disabled={!!busy}>
              Verificar integridade
            </Button>
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
          {diag && (
            <div className="pt-2 mt-1 border-t border-slate-100 text-xs text-slate-500 space-y-0.5">
              <p>Versão: {diag.version}</p>
              <p>Armazenamento: {stats?.dbType || "IndexedDB local (Dexie)"} · versão {stats?.dbVersion ?? 1}</p>
              <p>Banco: {statusLabel === "OK" ? "OK" : "verificar"}</p>
              <p className="break-all">Log: {diag.logPath || "—"}</p>
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmActionDialog
        open={Boolean(confirmation)}
        onOpenChange={(nextOpen) => { if (!nextOpen) setConfirmation(null); }}
        title={confirmation === 'restore' ? 'Restaurar backup' : 'Importar dados'}
        description={confirmation === 'restore'
          ? 'O banco atual será substituído somente depois que um backup físico de segurança for criado e validado. Deseja continuar?'
          : 'Antes da importação, o sistema criará e validará um backup físico automático. Deseja continuar?'}
        confirmLabel={confirmation === 'restore' ? 'Restaurar' : 'Importar'}
        destructive={confirmation === 'restore'}
        busy={Boolean(busy)}
        onConfirm={confirmation === 'restore' ? applyRestoreConfirmed : applyImportConfirmed}
      />
    </ModeloBase1PageContainer>
  );
}
