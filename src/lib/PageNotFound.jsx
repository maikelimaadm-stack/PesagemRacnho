import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function PageNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-light text-slate-300">404</h1>
        <p className="text-slate-600">Página não encontrada.</p>
        <Link
          to={createPageUrl('PesagensIndividuais')}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
        >
          Ir para Pesagens Individuais
        </Link>
      </div>
    </div>
  );
}
