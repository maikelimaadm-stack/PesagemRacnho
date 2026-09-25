# E9 — Balança ao vivo + bastão EID (próxima MINOR após E4 com captura real)

Entrada obrigatória: capturas reais do S3 em `docs/evidence/e4/capturas/` (USB e, se possível, Bluetooth).
Sem capturas: PARAR e reportar.

1. `S3SerialAdapter` (Web Serial) com parser escrito a partir das capturas: identifica o frame de peso,
   unidade e marcador de estabilidade (se o S3 enviar); senão usa a estabilidade do `scaleService`.
2. `S3BluetoothAdapter` (Web Bluetooth/BLE) se a captura BLE for viável; senão documentar e manter USB.
3. Leitor EID: adaptador de bastão (Bluetooth SPP/BLE ou modo teclado). Leitura de EID localiza o animal
   por `animalIdentificadores` (tipo RFID); EID desconhecido → oferece cadastro rápido com o próximo
   número visual livre do estoque (E6).
4. Fluxo de curral alvo: animal entra → EID lido → ficha aparece → peso estabiliza → grava sozinho (ou
   Enter) → apartação sugerida na tela grande → próximo. Meta: ≤ 8 s por animal sem digitar nada.
5. Modo "tela de curral": fonte grande, alto contraste, só peso, número, lote destino e alertas
   (carência, perdendo peso, brinco a repor).
6. Reconexão automática; indicador de conexão sempre visível; nunca bloqueia digitação manual.
7. Gates: `equipment:s3-parser:verify` contra as capturas reais (fixtures), `equipment:eid:verify`,
   `launch:hands-free:verify` com simulador (100 animais seguidos sem teclado).
8. Aceite humano: 50 animais reais no tronco, tempo médio por animal medido e registrado no REPORT.
