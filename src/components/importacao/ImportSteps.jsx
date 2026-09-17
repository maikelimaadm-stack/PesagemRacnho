import { Check } from 'lucide-react';

// Trilha das 7 etapas do assistente, na estrutura de abas do ModeloBase1
// (mg-panel-tabs-strip → seg-control), a mesma da Sanidade. Etapa concluída pode ser
// reaberta; etapa à frente só abre quando a atual está válida (a página decide).
export default function ImportSteps({ steps, activeStep, onSelect, isEnabled }) {
  return (
    <div className="mg-panel-tabs-strip mg-panel-tabs-strip--no-bg importacao-steps" data-mak-region="tabs">
      <div className="mg-panel-tabs-rail">
        <div className="mg-panel-tabs-rail__viewport">
          <div className="seg-control importacao-steps__control" role="tablist" aria-label="Etapas da importação">
            {steps.map((step, index) => {
              const active = step.id === activeStep;
              const concluida = index < steps.findIndex((item) => item.id === activeStep);
              const habilitada = active || isEnabled(step.id);
              return (
                <button
                  key={step.id}
                  id={`importacao-step-${step.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`importacao-panel-${step.id}`}
                  tabIndex={active ? 0 : -1}
                  disabled={!habilitada}
                  data-step={step.id}
                  data-concluida={concluida ? 'true' : 'false'}
                  className={`seg-tab importacao-steps__tab${active ? ' active' : ''}`}
                  onClick={() => { if (habilitada) onSelect(step.id); }}
                >
                  <span className="importacao-steps__badge" aria-hidden="true">
                    {concluida ? <Check size={11} /> : step.numero}
                  </span>
                  {step.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
