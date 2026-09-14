import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, ChevronDown, Check } from "lucide-react";

export default function ComboboxComNovo({ 
  value, 
  onChange, 
  options = [], 
  placeholder = "Selecione ou digite...",
  onAddNew,
  onConfirm,
  className = "",
  inputClassName = "",
  hideIcons = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [filteredOptions, setFilteredOptions] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const sorted = [...options]
      .filter(opt => opt && opt.trim())
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
    
    if (inputValue && isFocused) {
      const filtered = sorted.filter(opt => 
        opt.toLowerCase().includes(inputValue.toLowerCase())
      );
      setFilteredOptions(filtered);
    } else {
      setFilteredOptions(sorted);
    }
  }, [options, inputValue, isFocused]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        if (inputValue && inputValue !== value) {
          onChange(inputValue);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [inputValue, value, onChange]);

  const confirmarValor = (nextValue) => {
    const finalValue = nextValue ?? inputValue ?? value ?? "";
    onChange(finalValue);
    setInputValue(finalValue);
    setIsOpen(false);
    setIsFocused(false);
    setTimeout(() => onConfirm?.(finalValue), 0);
  };

  const handleSelect = (opt) => {
    confirmarValor(opt);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    setIsOpen(true);
  };

  const handleFocus = () => {
    setIsOpen(true);
    setIsFocused(true);
    setInputValue("");
  };

  const handleInputBlur = () => {
    setIsFocused(false);
    setTimeout(() => {
      if (inputValue && inputValue !== value) {
        onChange(inputValue);
      }
    }, 150);
  };

  const handleAddNew = () => {
    if (inputValue && onAddNew) {
      onAddNew(inputValue);
    }
    confirmarValor(inputValue);
  };

  const showAddButton = inputValue && 
    !filteredOptions.some(opt => opt.toLowerCase() === inputValue.toLowerCase());

  const handleInputKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const valorDigitado = (inputValue || value || "").trim();
      if (!valorDigitado) return;
      const matchExato = filteredOptions.find((opt) => opt.toLowerCase() === valorDigitado.toLowerCase());
      confirmarValor(matchExato || valorDigitado);
    }
  };

  return (
    <div ref={wrapperRef} className={`d17d-combobox relative ${className}`}>
      <div className="d17d-combobox__control relative">
        <Input
          value={isFocused ? inputValue : (value || "")}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder}
          className={inputClassName || `h-9 text-sm ${hideIcons ? 'pr-2' : 'pr-8'}`}
        />
        {!hideIcons && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-9 w-8"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={`Abrir opções: ${placeholder}`}
            title={`Abrir opções: ${placeholder}`}
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </Button>
        )}
      </div>

      {isOpen && (
        <div className="d17d-combobox__menu absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-auto" role="listbox" aria-label={placeholder}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => (
              <div
                key={idx}
                className={`d17d-combobox__option px-3 py-2 text-sm cursor-pointer hover:bg-slate-100 flex items-center justify-between ${
                  opt === value ? 'bg-slate-50' : ''
                }`}
                onClick={() => handleSelect(opt)}
                role="option"
                aria-selected={opt === value}
              >
                <span>{opt}</span>
                {!hideIcons && opt === value && <Check className="w-4 h-4 text-emerald-600" />}
              </div>
            ))
          ) : (
            <div className="d17d-combobox__empty px-3 py-2 text-sm text-slate-500">
              Nenhuma opção encontrada
            </div>
          )}
          
          {showAddButton && (
            <div
              className="d17d-combobox__add px-3 py-2 text-sm cursor-pointer hover:bg-emerald-50 border-t flex items-center gap-2 text-emerald-700 font-medium"
              onClick={handleAddNew}
            >
              {!hideIcons && <Plus className="w-4 h-4" />}
              Adicionar "{inputValue}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
