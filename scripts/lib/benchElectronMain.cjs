// Processo principal mínimo para medir no Electron real (R08): janela oculta carregando a URL do Vite, perfil
// temporário isolado (PESAGENS_BENCH_USER_DATA) — nunca o perfil do usuário.
const { app, BrowserWindow } = require('electron');

if (process.env.PESAGENS_BENCH_USER_DATA) app.setPath('userData', process.env.PESAGENS_BENCH_USER_DATA);
app.whenReady().then(() => {
  const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true } });
  win.loadURL(process.env.PESAGENS_BENCH_URL);
});
app.on('window-all-closed', () => app.quit());
