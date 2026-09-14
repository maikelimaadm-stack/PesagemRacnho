import { Suspense } from 'react';
import { Toaster } from "sonner";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { pagesConfig } from './pages.config';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import DbBootstrap from '@/components/DbBootstrap';
import AuthGate from '@/components/auth/AuthGate';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) =>
  Layout ? <Layout currentPageName={currentPageName}>{children}</Layout> : <>{children}</>;

// Ordem obrigatória (ADR-035/038): banco pronto e migrado → autenticação local →
// só então o roteador e qualquer tela de dados são montados.
function App() {
  return (
    <QueryClientProvider client={queryClientInstance}>
      <DbBootstrap>
        <AuthGate>
          <Router>
            <Suspense fallback={<div className="min-h-screen grid place-items-center bg-slate-50 text-sm text-slate-500">Carregando tela…</div>}>
            <Routes>
              <Route
                path="/"
                element={
                  <LayoutWrapper currentPageName={mainPageKey}>
                    <MainPage />
                  </LayoutWrapper>
                }
              />
              {Object.entries(Pages).map(([path, Page]) => (
                <Route
                  key={path}
                  path={`/${path}`}
                  element={
                    <LayoutWrapper currentPageName={path}>
                      <Page />
                    </LayoutWrapper>
                  }
                />
              ))}
              <Route path="*" element={<PageNotFound />} />
            </Routes>
            </Suspense>
          </Router>
        </AuthGate>
        <Toaster
          richColors
          position="top-right"
          expand
          visibleToasts={5}
          offset={16}
          gap={10}
          className="d17b-toaster"
        />
      </DbBootstrap>
    </QueryClientProvider>
  );
}

export default App;
