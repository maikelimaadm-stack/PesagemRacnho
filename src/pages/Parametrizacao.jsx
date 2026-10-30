import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { AccessDenied } from '@/components/auth/RequirePermission';
import { useAuth } from '@/components/auth/useAuth';
import { ModeloBase1PageContainer, ModeloBase1PageHeader } from '@/components/modelobase1';
import { AGE_POLICY_DEFAULTS, getAgePolicy, saveAgePolicy } from '@/modules/livestock/application/animalProfileService';
import { describeError } from '@/components/rebanho/rebanhoModel';
import '@/styles/rebanho.css';

// Menu SISTEMA › Parametrização (F25): regras de negócio por seção, cada uma salva isolada. Esta versão traz
// "Idade, era e categorias" (F05); as demais regras novas da missão entram aqui como seções próprias.
// Mudança de regra não reescreve histórico: idade e era são calculadas na hora, para a data consultada.
const toText = (list) => list.join(', ');
const fromNumbers = (text) => text.split(/[,;\s]+/).filter(Boolean).map(Number);
const fromLabels = (text) => text.split(/[,;]/).map((t) => t.trim());

function AgePolicySection({ canEdit }) {
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [erros, setErros] = useState([]);

  const load = async () => {
    const policy = await getAgePolicy();
    const next = {
      faixas: toText(policy.faixas_meses),
      eras: toText(policy.eras),
      sugerir: policy.sugerir_categoria_produtiva,
      catM: toText(policy.categorias_produtivas.M),
      catF: toText(policy.categorias_produtivas.F),
    };
    setForm(next);
    setSaved(next);
  };
  useEffect(() => { load().catch((error) => toast.error(describeError(error))); }, []);

  if (!form) return <section className="rb-card"><p className="rb-empty">Carregando…</p></section>;
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const salvar = async () => {
    setBusy(true);
    setErros([]);
    try {
      await saveAgePolicy({
        faixas_meses: fromNumbers(form.faixas),
        eras: fromLabels(form.eras),
        sugerir_categoria_produtiva: form.sugerir,
        categorias_produtivas: { M: fromLabels(form.catM), F: fromLabels(form.catF) },
      });
      toast.success('Idade, era e categorias salvas.');
      await load();
    } catch (error) {
      setErros(error?.erros?.length ? error.erros : [describeError(error)]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rb-card" aria-label="Idade, era e categorias">
      <div className="rb-section-head"><h3>Idade, era e categorias</h3>{dirty ? <span className="rb-tag rb-tag--warn">alterações não salvas</span> : null}</div>
      <p className="rb-note">A era é o rótulo da faixa de idade (não do peso). A classe por peso dos lançamentos antigos continua guardada como histórico. A idade é sempre calculada para a data consultada.</p>
      <div className="rb-grid">
        <label className="rb-field rb-field--wide"><span className="rb-field__label is-required">Limites das faixas (meses, crescentes)</span><input className="rb-control" value={form.faixas} onChange={set('faixas')} disabled={!canEdit} aria-label="Limites das faixas em meses" /></label>
        <label className="rb-field rb-field--wide"><span className="rb-field__label is-required">Rótulo de cada era (uma a mais que os limites)</span><input className="rb-control" value={form.eras} onChange={set('eras')} disabled={!canEdit} aria-label="Rótulos das eras" /></label>
        <label className="rb-check rb-field--wide"><input type="checkbox" checked={form.sugerir} onChange={set('sugerir')} disabled={!canEdit} /> Sugerir categoria produtiva pela idade e sexo (a categoria informada no animal sempre prevalece)</label>
        {form.sugerir ? (
          <>
            <label className="rb-field rb-field--wide"><span className="rb-field__label">Categorias por faixa — machos</span><input className="rb-control" value={form.catM} onChange={set('catM')} disabled={!canEdit} aria-label="Categorias de machos por faixa" /></label>
            <label className="rb-field rb-field--wide"><span className="rb-field__label">Categorias por faixa — fêmeas</span><input className="rb-control" value={form.catF} onChange={set('catF')} disabled={!canEdit} aria-label="Categorias de fêmeas por faixa" /></label>
          </>
        ) : null}
      </div>
      {erros.length ? <ul className="rb-alerts rb-alerts--error">{erros.map((e) => <li key={e}>{e}</li>)}</ul> : null}
      {canEdit ? (
        <div className="rb-inline">
          <button type="button" className="rb-btn rb-btn--primary" onClick={salvar} disabled={busy || !dirty}><Save size={14} aria-hidden="true" /> Salvar seção</button>
          <button type="button" className="rb-btn" onClick={() => setForm(saved)} disabled={busy || !dirty}>Descartar alterações</button>
          <button type="button" className="rb-btn" onClick={() => setForm({ faixas: toText(AGE_POLICY_DEFAULTS.faixas_meses), eras: toText(AGE_POLICY_DEFAULTS.eras), sugerir: false, catM: toText(AGE_POLICY_DEFAULTS.categorias_produtivas.M), catF: toText(AGE_POLICY_DEFAULTS.categorias_produtivas.F) })} disabled={busy}>Restaurar padrão</button>
        </div>
      ) : null}
    </section>
  );
}

export default function Parametrizacao() {
  const auth = useAuth();
  const can = (action) => (auth ? Boolean(auth.can?.(action)) : true);
  if (!can('animal.read')) return <AccessDenied role={auth?.user?.role} permission="animal.read" />;
  return (
    <ModeloBase1PageContainer variant="table" className="d17b-page rb-page">
      <ModeloBase1PageHeader title="Parametrização" description="Regras de negócio, cada seção salva separadamente." />
      <div className="rb-scroll">
        <AgePolicySection canEdit={can('settings.manage')} />
      </div>
    </ModeloBase1PageContainer>
  );
}
