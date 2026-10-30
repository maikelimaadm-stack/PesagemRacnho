// Backup periódico (F20): só com o aplicativo desktop aberto e uma sessão ativa. Confere pouco depois de abrir
// (primeira oportunidade do dia) e a cada 15 minutos; o serviço decide se o intervalo venceu, não duplica e
// espera depois de falha. Falha vira aviso discreto; o botão "Criar backup agora" continua disponível.
import { useEffect } from 'react';
import { toast } from 'sonner';
import { runPeriodicIfDue } from '@/modules/backup/application/backupCenterService';

const PRIMEIRA_CONFERENCIA_MS = 3 * 60 * 1000;
const INTERVALO_MS = 15 * 60 * 1000;

export default function PeriodicBackupScheduler({ ativo }) {
  useEffect(() => {
    if (!ativo || typeof window === 'undefined' || !window.pesagemApp?.files?.writeUserFile) return undefined;
    let cancelado = false;
    const conferir = async () => {
      if (cancelado) return;
      try {
        const r = await runPeriodicIfDue();
        if (r?.run && r.ok === false) toast.error('Backup periódico falhou. Use Sistema › Backup e Restauração › Criar backup agora.', { description: r.error });
      } catch { /* o próximo ciclo tenta de novo */ }
    };
    const primeira = setTimeout(conferir, PRIMEIRA_CONFERENCIA_MS);
    const ciclo = setInterval(conferir, INTERVALO_MS);
    return () => { cancelado = true; clearTimeout(primeira); clearInterval(ciclo); };
  }, [ativo]);
  return null;
}
