# Resumo da implementação

## Sistema visual

- Tokens D.17B escopados: fundo, superfícies, verde `#40de63`, bordas, sombras, radius, densidade, foco e motion.
- Shell React full-height com header desktop, breadcrumbs, status offline, sidebar recolhível, drawer e bottom navigation mobile.
- Lista com action bar, KPIs, filtro lateral recolhível/drawer mobile e tabela densa.
- Lançamento com barra, cartões, campos de 38 px, seções compactas e layout mobile de uma coluna.
- Manutenção em grid de cartões no desktop e pilha no mobile.
- Dialog Radix unificado: overlay, header, corpo rolável, X visível, Escape e retorno de foco.
- Sonner configurado para stack consistente.

## Decisões funcionais

- Registro/Cards/Tabela não foram inventados para Pesagens Individuais: os KPIs e a tabela existentes foram compostos no padrão visual equivalente.
- Controles empresariais não foram copiados.
- Menu de coluna da listagem foi ocultado onde não havia callback. No lançamento, as opções reais permanecem; “Auto ajustar” fica oculto sem callback.
- Tipografia usa fallback local offline, sem download de fonte.
