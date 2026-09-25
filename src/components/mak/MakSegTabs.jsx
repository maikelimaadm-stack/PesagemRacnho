// Abas na estrutura oficial do ModeloBase1 (mg-panel-tabs-strip → mg-panel-tabs-rail → seg-control
// com seg-tab-slider) — a mesma de SanidadeTabs e dos painéis dos cadastros mestres, sem nome de
// tela. Setas esquerda/direita trocam de aba (padrão tablist).
import { useLayoutEffect, useRef } from 'react';

export default function MakSegTabs({ tabs, activeTab, onChange, idPrefix, label, className = '' }) {
  const controlRef = useRef(null);
  const sliderRef = useRef(null);

  useLayoutEffect(() => {
    const control = controlRef.current;
    const slider = sliderRef.current;
    const active = control?.querySelector('.seg-tab.active');
    if (!control || !slider || !active) return;
    slider.style.width = `${active.offsetWidth}px`;
    slider.style.transform = `translateX(${active.offsetLeft}px)`;
  }, [activeTab, tabs]);

  const onKeyDown = (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === activeTab);
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    onChange(next.id);
    controlRef.current?.querySelector(`#${idPrefix}-tab-${next.id}`)?.focus();
  };

  return (
    <div className={`mg-panel-tabs-strip mg-panel-tabs-strip--no-bg ${className}`.trim()} data-mak-region="tabs">
      <div className="mg-panel-tabs-rail">
        <div className="mg-panel-tabs-rail__viewport">
          <div className="seg-control" role="tablist" aria-label={label} ref={controlRef} onKeyDown={onKeyDown}>
            <div className="seg-tab-slider" ref={sliderRef} aria-hidden="true" />
            {tabs.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  id={`${idPrefix}-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`${idPrefix}-panel-${tab.id}`}
                  tabIndex={active ? 0 : -1}
                  className={`seg-tab${active ? ' active' : ''}`}
                  onClick={() => onChange(tab.id)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
