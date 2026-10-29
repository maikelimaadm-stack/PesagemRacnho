import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function SelecionarAnimalDialog({ open, onOpenChange, numero, animais = [], onSelect }) {
  const escolher = (animal) => {
    if (!animal) return;
    onSelect(animal);
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const key = event.key;
      if (!/^[1-9]$/.test(key)) return;
      const index = Number(key) - 1;
      if (index < 0 || index >= animais.length || index > 8) return;
      event.preventDefault();
      event.stopPropagation();
      escolher(animais[index]);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, animais, onSelect, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="d17b-standard-dialog d17b-standard-dialog--compact d17d-animal-choice-dialog overflow-hidden flex flex-col"
        // Evita o Radix devolver o foco ao Nº Ident. — o Lançamento foca Peso/Salvar.
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Qual é o animal {numero}?</DialogTitle>
          <DialogDescription className="sr-only">
            Escolha a marca do animal {numero}.
          </DialogDescription>
        </DialogHeader>
        <div className="d17b-standard-dialog__body d17d-animal-choice-dialog__body">
          <div className="d17d-animal-choice-list" role="listbox" aria-label={`Opções do animal ${numero}`}>
            {animais.map((animal, index) => {
              const atalho = index < 9 ? String(index + 1) : null;
              return (
                <button
                  key={animal.animal_id || animal.id || `${animal.marca}-${index}`}
                  type="button"
                  role="option"
                  className="d17d-animal-choice-option"
                  aria-label={`Opção ${atalho || index + 1}: Marca ${animal.marca || 'Sem marca'}`}
                  onClick={() => escolher(animal)}
                >
                  <span className="d17d-animal-choice-option__key" aria-hidden="true">
                    {atalho || '·'}
                  </span>
                  <span className="d17d-animal-choice-option__content">
                    <span className="d17d-animal-choice-option__brand">
                      <span className="d17d-animal-choice-option__brand-label">Marca </span>
                      <strong>{animal.marca || 'Sem marca'}</strong>
                    </span>
                    <span>
                      {[animal.sexo || '-', animal.raca || '-', animal.era || '-'].join(' · ')}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
