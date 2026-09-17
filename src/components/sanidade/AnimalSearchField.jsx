// Busca de animal por número e/ou marca sobre o índice local (buildAnimalIndex) e devolve
// o animal escolhido (id = animal_id). Digitar desfaz a escolha; Enter escolhe o primeiro
// resultado; Esc fecha a lista; o botão × limpa.
import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { searchAnimals } from './sanidadeModel.js';

export default function AnimalSearchField({ id, index, value, onChange, loading = false, disabled = false, autoFocus = false, compact = false, placeholder = 'Número ou marca do animal' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(() => (open ? searchAnimals(index, query) : []), [open, index, query]);
  const listId = `${id}-resultados`;

  const choose = (animal) => {
    onChange(animal);
    setQuery('');
    setOpen(false);
  };
  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActiveIndex((current) => Math.min(current + 1, Math.max(0, results.length - 1))); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((current) => Math.max(0, current - 1)); }
    if (event.key === 'Enter') {
      // Dentro de um formulário, Enter com a lista aberta escolhe o animal e não envia.
      if (open && results.length) { event.preventDefault(); choose(results[Math.min(activeIndex, results.length - 1)]); }
    }
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
  };

  return (
    <div className={`sanidade-animal-search${compact ? ' sanidade-animal-search--compact' : ''}${value ? ' has-value' : ''}`}>
      <Search className="sanidade-animal-search__icon" aria-hidden="true" />
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        className="sanidade-animal-search__input"
        value={value && !query ? value.label : query}
        placeholder={loading ? 'Carregando animais…' : placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
        onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); setOpen(true); if (value) onChange(null); }}
        onFocus={(event) => { setOpen(true); if (value) event.target.select(); }}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {value ? (
        <button type="button" className="sanidade-animal-search__clear" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(null)} aria-label="Limpar animal" title="Limpar animal" disabled={disabled}>
          <X aria-hidden="true" />
        </button>
      ) : null}
      {open && !disabled ? (
        <div className="sanidade-animal-search__results" id={listId} role="listbox" aria-label="Animais encontrados">
          {results.map((animal, position) => (
            <button
              key={animal.id}
              type="button"
              role="option"
              aria-selected={position === activeIndex}
              className={`sanidade-animal-search__option${position === activeIndex ? ' is-active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(animal)}
            >
              <strong>{animal.numero}</strong>
              <span className="sanidade-animal-search__brand">{animal.marca}</span>
              {animal.situacao && animal.situacao !== 'ATIVO' ? <small>{animal.situacao}</small> : null}
            </button>
          ))}
          {!results.length ? <div className="sanidade-animal-search__empty">{loading ? 'Carregando animais…' : index?.list?.length ? 'Nenhum animal com esse número ou marca.' : 'Nenhum animal cadastrado.'}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
