# Mapa de execução local

Data: 03/08/2026 (America/Cuiaba).

| Projeto | Comando | Porta | URL/rota | Status |
|---|---|---:|---|---|
| Pesagens dev | `npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort` | 5173 | `http://127.0.0.1:5173/#/PesagensIndividuais` | aberto e validado; processo encerrado ao final |
| PROJETOMG tentativa direta | script Vite real com env local seguro | 5174 | `/CadastroEmpresas` | bloqueado por colisão de caixa no Windows |
| PROJETOMG harness visual | config Vite temporária + App/rota/componentes reais | 5175 | `http://127.0.0.1:5175/CadastroEmpresas` | aberto e capturado; harness removido |
| Pesagens produção | `npm.cmd exec vite -- preview --host 127.0.0.1 --port 5176 --strictPort` | 5176 | rotas HashRouter | três telas aprovadas; processo encerrado ao final |

## Caminhos confirmados

- Pesagens: `C:\Users\maike\Desktop\projeto\MAKGESTAO-main`
- PROJETOMG: `C:\Users\maike\Desktop\projeto\arquivos do projetomgdomodelobase1\PROJETOMG-main`
- Tela: `src/modules/empresas/pages/PAGEMP.jsx`
- Rota: `/CadastroEmpresas`

O projeto alvo real está na versão 1.1.2, apesar de o prompt mencionar 1.1.0. Nenhum Git foi encontrado nos projetos.
