import { useEffect, useRef, useState } from 'react';
import { ClipboardCopy, KeyRound } from 'lucide-react';

// Exibição ÚNICA da Recovery Key (ADR-044): a key só existe nesta tela — o banco guarda o
// verificador. "Continuar" fica bloqueado até o usuário confirmar que guardou a chave.
export default function RecoveryKeyReveal({ recoveryKey, title = 'Guarde a chave de recuperação', continueLabel = 'Continuar', onContinue }) {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const keyRef = useRef(null);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
    } catch {
      // Sem área de transferência: seleciona o texto para o usuário copiar manualmente.
      const selection = window.getSelection?.();
      if (selection && keyRef.current) {
        const range = document.createRange();
        range.selectNodeContents(keyRef.current);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  };

  return (
    <div className="auth-recovery" role="region" aria-labelledby="auth-recovery-title">
      <p id="auth-recovery-title" className="auth-recovery__title"><KeyRound aria-hidden="true" />{title}</p>
      <p className="auth-hint">
        Esta chave redefine a senha do administrador se ela for esquecida. Ela é mostrada <strong>uma única vez</strong>:
        anote ou copie e guarde em local seguro. O sistema não a exibe de novo.
      </p>
      <output ref={keyRef} className="auth-recovery__key" aria-label="Chave de recuperação">{recoveryKey}</output>
      <div className="auth-actions auth-actions--start">
        <button type="button" className="auth-button auth-button--ghost" onClick={copy}>
          <ClipboardCopy aria-hidden="true" />{copied ? 'Copiada' : 'Copiar'}
        </button>
      </div>
      <label className="auth-check">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
        <span>Guardei a chave</span>
      </label>
      <div className="auth-actions">
        <button type="button" className="auth-button" disabled={!confirmed} onClick={() => onContinue?.()}>{continueLabel}</button>
      </div>
    </div>
  );
}
