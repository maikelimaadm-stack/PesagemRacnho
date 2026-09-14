import { lazy } from 'react';
import __Layout from './Layout.jsx';

// Cada tela operacional é carregada somente quando a rota é aberta. Isso reduz
// o custo de inicialização e impede que os dois grids mais pesados sejam
// avaliados juntos na abertura do aplicativo.
const LancamentoPesagensIndividuais = lazy(() => import('./pages/LancamentoPesagensIndividuais'));
const PesagensIndividuais = lazy(() => import('./pages/PesagensIndividuais'));
const ManutencaoSistema = lazy(() => import('./pages/ManutencaoSistema'));
const FechamentoDia = lazy(() => import('./pages/FechamentoDia'));
const FichaAnimal = lazy(() => import('./pages/FichaAnimal'));
const CadastrosComerciais = lazy(() => import('./pages/CadastrosComerciais'));
const CausasMorte = lazy(() => import('./pages/CausasMorte'));
const ConfiguracoesSanidade = lazy(() => import('./pages/ConfiguracoesSanidade'));

export const PAGES = {
    "LancamentoPesagensIndividuais": LancamentoPesagensIndividuais,
    "PesagensIndividuais": PesagensIndividuais,
    "ManutencaoSistema": ManutencaoSistema,
    "FechamentoDia": FechamentoDia,
    "FichaAnimal": FichaAnimal,
    "CadastrosComerciais": CadastrosComerciais,
    "CausasMorte": CausasMorte,
    "ConfiguracoesSanidade": ConfiguracoesSanidade,
}

export const pagesConfig = {
    mainPage: "PesagensIndividuais",
    Pages: PAGES,
    Layout: __Layout,
};
