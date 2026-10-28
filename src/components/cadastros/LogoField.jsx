// Campo "imagem" da ficha de cadastro (E1B 1.4.0) — hoje só o Logo da propriedade.
// Botão "Escolher logo"/"Trocar" aciona um input de arquivo escondido; o arquivo é
// ajustado no navegador (logoImage.js) e o formulário recebe o data URL. "Remover"
// limpa. O id do input NÃO usa o prefixo `aux-` (não herda o estilo de campo de texto).
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { isAcceptedLogo } from '@/modules/catalog/domain/propertyHeader';
import { prepareLogoFromFile } from './logoImage.js';

export default function LogoField({ campo, value, onChange, disabled }) {
  const inputRef = useRef(null);
  // Ajuste da imagem é assíncrono: se a ficha trocar de registro (o cartão remonta por registro) antes de
  // terminar, o resultado é descartado — nunca cai no formulário de outra propriedade.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState(null);
  const inputId = `arquivo-${campo.id}`;
  const labelId = `aux-label-${campo.id}`;
  const current = typeof value === 'string' ? value : '';
  const hasImage = current !== '';
  // Só desenha o que é logo válido (um backup adulterado pode trazer qualquer texto).
  const showImage = hasImage && isAcceptedLogo(current);

  const choose = () => {
    if (disabled || busy) return;
    inputRef.current?.click();
  };
  const handleFile = async (event) => {
    const file = event.target.files?.[0] ?? null;
    // Limpa a escolha para o mesmo arquivo poder ser escolhido de novo.
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setErro(null);
    try {
      const { dataUrl } = await prepareLogoFromFile(file);
      if (mountedRef.current) onChange(dataUrl);
    } catch (error) {
      if (!mountedRef.current) return;
      const message = error?.message || 'Não foi possível usar esta imagem.';
      setErro(message);
      toast.error(message);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };
  const remove = () => {
    setErro(null);
    onChange('');
  };

  return (
    <div className={`aux-model-field aux-logo-field${hasImage ? ' mg-has-value' : ''}`} data-field={campo.id} data-width-type="CAMPO_PRINCIPAL">
      <span id={labelId} className="aux-logo-field__label">{campo.label}</span>
      <div className="aux-logo-field__body">
        <div className="aux-logo-field__preview" aria-live="polite">
          {showImage
            ? <img src={current} alt="Logo atual" />
            : <span className="aux-logo-field__empty">{hasImage ? 'Logo inválido' : 'Sem logo'}</span>}
        </div>
        <div className="aux-logo-field__actions">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            tabIndex={-1}
            aria-labelledby={labelId}
            disabled={disabled || busy}
            onChange={handleFile}
          />
          <button type="button" className="ios-btn tb-btn tb-btn-icon tb-btn-ghost aux-logo-field__button" onClick={choose} disabled={disabled || busy} aria-controls={inputId} title={busy ? 'Ajustando…' : hasImage ? 'Trocar logo' : 'Escolher logo'} aria-label={busy ? 'Ajustando…' : hasImage ? 'Trocar logo' : 'Escolher logo'}>
            {busy ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" /> : hasImage ? <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <ImagePlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
          </button>
          {hasImage ? (
            <button type="button" className="ios-btn tb-btn tb-btn-icon tb-btn-ghost tb-btn-danger aux-logo-field__button" onClick={remove} disabled={disabled || busy} title="Remover logo" aria-label="Remover logo">
              <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </button>
          ) : null}
          <span className={`aux-logo-field__help${erro ? ' is-error' : ''}`} role={erro ? 'alert' : undefined}>
            {erro || campo.ajuda || 'PNG ou JPG. Ajustamos o tamanho automaticamente.'}
          </span>
        </div>
      </div>
    </div>
  );
}
