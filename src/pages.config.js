import { lazy } from 'react';
import __Layout from './Layout.jsx';

// Cada tela operacional é carregada somente quando a rota é aberta. Isso reduz
// o custo de inicialização e impede que os dois grids mais pesados sejam
// avaliados juntos na abertura do aplicativo.
const LancamentoPesagensIndividuais = lazy(() => import('./pages/LancamentoPesagensIndividuais'));
const PesagensIndividuais = lazy(() => import('./pages/PesagensIndividuais'));
// Importação inteligente: assistente em etapas sobre o motor de src/modules/import.
const Importacao = lazy(() => import('./pages/Importacao'));
const ManutencaoSistema = lazy(() => import('./pages/ManutencaoSistema'));
const FechamentoDia = lazy(() => import('./pages/FechamentoDia'));
const FichaAnimal = lazy(() => import('./pages/FichaAnimal'));
// Relatórios profissionais (programa reporting 1.3.0): catálogo + emissão numa única rota.
const Relatorios = lazy(() => import('./pages/Relatorios'));
// Sanidade (stores próprias da v8): programas, medicamentos e aplicações numa única rota.
const Sanidade = lazy(() => import('./pages/Sanidade'));
// Rebanho (missão pesagens-integrada, Fase B): operações e inventário pelo livro de movimentos.
const Entradas = lazy(() => import('./pages/Entradas'));
const Saidas = lazy(() => import('./pages/Saidas'));
const Movimentacoes = lazy(() => import('./pages/Movimentacoes'));
const Inventario = lazy(() => import('./pages/Inventario'));
const Identificadores = lazy(() => import('./pages/Identificadores'));
const Parametrizacao = lazy(() => import('./pages/Parametrizacao'));
const Desempenho = lazy(() => import('./pages/Desempenho'));
// Cadastros mestres (Programa 2.0 · ADR-018)
const Marcas = lazy(() => import('./pages/Marcas'));
const Racas = lazy(() => import('./pages/Racas'));
const Categorias = lazy(() => import('./pages/Categorias'));
const Parceiros = lazy(() => import('./pages/Parceiros'));
const Propriedades = lazy(() => import('./pages/Propriedades'));
const CausasMorte = lazy(() => import('./pages/CausasMorte'));
// Sistema (ADR-035/036)
const Usuarios = lazy(() => import('./pages/Usuarios'));
const Configuracoes = lazy(() => import('./pages/Configuracoes'));

export const PAGES = {
    "LancamentoPesagensIndividuais": LancamentoPesagensIndividuais,
    "PesagensIndividuais": PesagensIndividuais,
    "Importacao": Importacao,
    "FechamentoDia": FechamentoDia,
    "FichaAnimal": FichaAnimal,
    "Entradas": Entradas,
    "Saidas": Saidas,
    "Movimentacoes": Movimentacoes,
    "Inventario": Inventario,
    "Identificadores": Identificadores,
    "Parametrizacao": Parametrizacao,
    "Desempenho": Desempenho,
    "Sanidade": Sanidade,
    "Relatorios": Relatorios,
    "Marcas": Marcas,
    "Racas": Racas,
    "Categorias": Categorias,
    "Parceiros": Parceiros,
    "Propriedades": Propriedades,
    "CausasMorte": CausasMorte,
    "Usuarios": Usuarios,
    "Configuracoes": Configuracoes,
    "ManutencaoSistema": ManutencaoSistema,
}

export const pagesConfig = {
    mainPage: "PesagensIndividuais",
    Pages: PAGES,
    Layout: __Layout,
};
