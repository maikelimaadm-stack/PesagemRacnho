# Medições visuais da referência

Medições obtidas da renderização real no navegador.

| Elemento | Medição/estilo observado | Aplicação em Pesagens |
|---|---|---|
| Header desktop | 36 px; `rgb(64, 222, 99)`; padding 0 12 px | 36 px; `#40de63`; padding 0 10 px |
| Sidebar | aproximadamente 220 px | 220 px |
| Action bar | 36 px no núcleo da referência; padding 4 12 px | 44 px com controles de 28 px e hierarquia preservada |
| Fundo | `#f0f2f5`/cinza muito claro | `#f0f2f5` |
| Superfície | branco | branco |
| Inputs/selects | 38 px; radius 8 px; `#f1f3f4` | 38 px; radius 8 px; `#f1f3f4` |
| Cards | radius ~12 px; borda/sombra sutil | radius 12 px; borda `#e7eaee`; sombra mínima |
| Tabela | header ~30 px; linhas densas | header 30 px; linhas 28 px; sticky/zebra/hover |
| Botões | ~28 px desktop | 28 px em action bars; 32 px em conteúdo |
| Mobile | header 48 px; ação/bottom nav | header 48 px; bottom nav 56 px; targets 36 px |
| Tipografia | DM Sans, base ~13 px | stack DM Sans com fallback local; base 13 px |
| Dialog | overlay, header compacto, corpo rolável | overlay 46%, radius 12 px, X visível, max-height 90 vh |

Breakpoints consolidados: 1024 px para compactação e 767 px para chrome mobile. Não há overflow horizontal no documento em 1366 × 768 ou na build final em 1440 × 900; tabelas usam scroll interno quando necessário.
