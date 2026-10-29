import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Desmonta o que cada teste renderizou (o Vitest não expõe globals para o RTL limpar sozinho).
afterEach(() => cleanup());
