import { Download, RefreshCw, X } from 'lucide-react';
import { useReleaseUpdateCheck } from '@/modules/updates/useReleaseUpdateCheck.js';
import { APP_VERSION } from '@/lib/appVersion.js';

async function openDownload(url) {
  if (!url) return;
  if (window.pesagemApp?.openExternalUrl) {
    await window.pesagemApp.openExternalUrl(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function ReleaseUpdateNotice({ compact = false }) {
  const { visible, feed, loading, refresh, dismiss, status } = useReleaseUpdateCheck();

  if (status === 'disabled') return null;
  if (!visible || !feed) {
    if (compact || loading) return null;
    return null;
  }

  const title = `Versão ${feed.appVersion} disponível (instalada: v${APP_VERSION})`;

  if (compact) {
    return (
      <button
        type="button"
        className="mb1-shell-update-badge"
        title={title}
        onClick={() => openDownload(feed.installer.downloadUrl)}
      >
        <Download aria-hidden="true" />
        Nova v{feed.appVersion}
      </button>
    );
  }

  return (
    <div className="mb1-shell-update-banner" role="status" aria-live="polite">
      <div className="mb1-shell-update-banner__text">
        <strong>Nova versão {feed.appVersion}</strong>
        <span>Instalada: v{APP_VERSION}. Baixe o instalador e execute por cima da instalação atual.</span>
      </div>
      <div className="mb1-shell-update-banner__actions">
        <button type="button" className="mb1-shell-update-btn mb1-shell-update-btn--primary" onClick={() => openDownload(feed.installer.downloadUrl)}>
          <Download aria-hidden="true" /> Baixar instalador
        </button>
        <button type="button" className="mb1-shell-update-btn" onClick={refresh} title="Verificar de novo">
          <RefreshCw aria-hidden="true" />
        </button>
        <button type="button" className="mb1-shell-update-btn" onClick={dismiss} aria-label="Ocultar aviso desta versão">
          <X aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
