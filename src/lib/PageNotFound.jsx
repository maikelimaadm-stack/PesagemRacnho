import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function PageNotFound() {
  return (
    <div className="gate-status gate-status--inset">
      <div className="gate-status__card">
        <h1>Essa página não existe</h1>
        <p>O endereço não corresponde a nenhuma tela do sistema.</p>
        <Link className="gate-status__action" to={createPageUrl('PesagensIndividuais')}>
          Abrir a relação de pesagens
        </Link>
      </div>
    </div>
  );
}
