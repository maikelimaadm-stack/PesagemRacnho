// Campo CPF/CNPJ da ficha (PROMPT-01C item 8, 1.4.0) — Propriedades e Parceiros. Máscara ao digitar
// (000.000.000-00 / 00.000.000/0000-00, CNPJ alfanumérico com letras), colar texto formatado ou cru, no
// máximo 14 posições, e o cursor fica onde a pessoa está editando. As regras são as funções puras de
// documentMask.js (gate scripts/verify-document-mask.mjs); o formulário recebe o texto mascarado e o
// serviço grava normalizeDocument como antes.
import { useEffect, useRef, useState } from 'react';
import { DOCUMENT_PLACEHOLDER, applyDocumentInput } from '@/modules/catalog/domain/documentMask';

export default function DocumentInput({ id, value, onChange, disabled }) {
  // Dica do formato só com o campo em foco: vazio e sem foco, o rótulo flutuante do ModeloBase1 fica
  // dentro do campo e a dica ficaria por cima dele.
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  // Onde a seleção começava antes da edição (beforeinput vem antes de o navegador trocar o texto): colar
  // sobre uma seleção é lido inteiro, mesmo quando o colado começa igual ao que estava selecionado.
  const editRef = useRef(null);
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return undefined;
    const remember = () => { editRef.current = { value: input.value, start: input.selectionStart }; };
    input.addEventListener('beforeinput', remember);
    return () => input.removeEventListener('beforeinput', remember);
  }, []);
  const current = typeof value === 'string' ? value : String(value ?? '');
  const handleChange = (event) => {
    const input = event.target;
    const edit = editRef.current;
    editRef.current = null;
    const start = edit && edit.value === current ? edit.start : null;
    const next = applyDocumentInput({ previous: current, value: input.value, caret: input.selectionEnd, inputType: event.nativeEvent?.inputType, start });
    // Texto e cursor escritos já no campo: o React encontra o mesmo valor e não o reescreve (o cursor não
    // pula para o fim), inclusive quando a tecla é ignorada e o texto volta ao anterior.
    if (input.value !== next.value) input.value = next.value;
    if (input.ownerDocument?.activeElement === input) input.setSelectionRange(next.caret, next.caret);
    onChange(next.value);
  };
  return (
    <input
      ref={inputRef}
      id={id}
      value={current}
      onChange={handleChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      type="text"
      inputMode="text"
      autoComplete="off"
      spellCheck={false}
      disabled={disabled}
      placeholder={focused ? DOCUMENT_PLACEHOLDER : ' '}
      data-mask="documento"
    />
  );
}
