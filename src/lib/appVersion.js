// Vite injeta a versão do package.json. O fallback mantém os testes Node e
// ferramentas de migração independentes do bundler.
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined'
  ? __APP_VERSION__
  : '1.3.2';
