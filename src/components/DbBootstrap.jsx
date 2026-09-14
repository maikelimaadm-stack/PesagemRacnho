import { useEffect, useState } from 'react';
import { bootstrapLocalDb } from '@/api/db';

export default function DbBootstrap({ children }) {
  const [ready, setReady] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    bootstrapLocalDb()
      .then(() => ativo && setReady(true))
      .catch((err) => ativo && setErro(err?.message || 'Falha ao preparar o armazenamento local'));
    return () => {
      ativo = false;
    };
  }, []);

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center space-y-3 max-w-lg">
          <p className="text-red-600 font-medium">Não foi possível preparar o armazenamento local</p>
          <p className="text-sm text-slate-600">
            Feche e abra o sistema novamente. Se continuar, envie o arquivo de diagnóstico
            em <strong>Manutenção</strong>.
          </p>
          <p className="text-xs text-slate-400">{erro}</p>
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

  return children;
}
