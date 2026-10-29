import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
      networkMode: 'always',
      staleTime: Infinity,
      gcTime: Infinity,
      // Os dados são locais (IndexedDB) e quem grava (Lançamento, Cadastros, Importação,
      // restauração) não invalida as chaves daqui: sem isto, uma tela reaberta mostrava a
      // lista de antes (pesagens, marcas, lotes, embarques). Relê ao montar; o cache
      // aparece enquanto isso.
      refetchOnMount: 'always',
    },
    mutations: {
      retry: false,
      networkMode: 'always',
    },
  },
});
