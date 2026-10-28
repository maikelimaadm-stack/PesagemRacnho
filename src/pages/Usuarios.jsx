import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCopy, KeyRound, Pencil, Plus, Power, RefreshCw, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import MakTableSelectCheck from '@/components/mak/MakTableSelectCheck';
import ConfirmActionDialog from '@/components/common/ConfirmActionDialog';
import { fmtDateTimeBR } from '@/components/common/formatNumber';
import { ModeloBase1PageContainer, ModeloBase1PageHeader } from '@/components/modelobase1';
import RequirePermission from '@/components/auth/RequirePermission';
import { useAuth } from '@/components/auth/useAuth';
import { ROLES, roleLabel } from '@/modules/auth/domain/permissionService';
import * as localAuthService from '@/modules/auth/application/localAuthService';
import '@/components/auth/auth-screens.css';

const EMPTY_FORM = { nome: '', login: '', role: 'OPERADOR', senha: '', confirmar: '' };
const EMPTY_RESET = { modo: 'gerar', senha: '', confirmar: '' }; // modo: gerar (temporária) | definir

function FormField({ id, label, children }) {
  return (
    <div className="auth-field">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function UsuariosContent() {
  const { user: actor } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [formDialog, setFormDialog] = useState(null); // { mode: 'novo' | 'editar', record }
  const [form, setForm] = useState(EMPTY_FORM);
  const [resetDialog, setResetDialog] = useState(null); // registro alvo
  const [resetForm, setResetForm] = useState(EMPTY_RESET);
  const [temporary, setTemporary] = useState(null); // { nome, login, senha } — exibida uma única vez
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(null); // { title, description, confirmLabel, destructive, run }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await localAuthService.listUsers(actor));
    } catch (err) {
      toast.error(err?.message || 'Não foi possível carregar os usuários.');
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => { load(); }, [load]);

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) || null, [rows, selectedId]);
  const isSelf = Boolean(selected && actor && selected.id === actor.id);
  const activeCount = rows.filter((row) => row.ativo).length;

  const setField = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const openNew = () => {
    setForm(EMPTY_FORM);
    setFormDialog({ mode: 'novo', record: null });
  };

  const openEdit = (record) => {
    if (!record) return;
    setForm({ ...EMPTY_FORM, nome: record.nome || '', login: record.login || '', role: record.role || 'OPERADOR' });
    setFormDialog({ mode: 'editar', record });
  };

  const runAction = async (action, successMessage) => {
    if (busy) return null;
    setBusy(true);
    try {
      const result = await action();
      if (successMessage) toast.success(successMessage);
      await load();
      return result ?? true;
    } catch (err) {
      toast.error(err?.message || 'A operação não pôde ser concluída.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const saveForm = async (event) => {
    event?.preventDefault?.();
    if (!formDialog) return;
    if (formDialog.mode === 'novo') {
      if (form.senha !== form.confirmar) {
        toast.error('A confirmação não confere com a senha inicial.');
        return;
      }
      const ok = await runAction(
        () => localAuthService.createUser(actor, { nome: form.nome, login: form.login, senha: form.senha, role: form.role }),
        'Usuário criado. A troca de senha será exigida no primeiro acesso.',
      );
      if (ok) setFormDialog(null);
      return;
    }
    const ok = await runAction(
      () => localAuthService.updateUser(actor, formDialog.record.id, { nome: form.nome, login: form.login, role: form.role }),
      'Usuário atualizado.',
    );
    if (ok) setFormDialog(null);
  };

  const saveReset = async (event) => {
    event?.preventDefault?.();
    if (!resetDialog) return;
    const generate = resetForm.modo === 'gerar';
    if (!generate && resetForm.senha !== resetForm.confirmar) {
      toast.error('A confirmação não confere com a nova senha.');
      return;
    }
    const target = resetDialog;
    const result = await runAction(
      () => localAuthService.resetPassword(actor, target.id, generate ? null : resetForm.senha),
      generate ? null : 'Senha redefinida. O usuário deverá trocá-la no próximo acesso.',
    );
    if (result) {
      setResetDialog(null);
      setResetForm(EMPTY_RESET);
      if (result.temporaryPassword) {
        setCopied(false);
        setTemporary({ nome: target.nome, login: target.login, senha: result.temporaryPassword });
      }
    }
  };

  const copyTemporary = async () => {
    if (!temporary) return;
    try {
      await navigator.clipboard.writeText(temporary.senha);
      setCopied(true);
    } catch {
      toast.error('Não foi possível copiar. Anote a senha temporária.');
    }
  };

  const askToggleActive = () => {
    if (!selected) return;
    if (isSelf) {
      toast.error('Você não pode inativar o próprio usuário.');
      return;
    }
    const next = !selected.ativo;
    setConfirm({
      title: next ? 'Ativar usuário' : 'Inativar usuário',
      description: next
        ? `O usuário “${selected.nome}” voltará a poder entrar no sistema.`
        : `O usuário “${selected.nome}” não poderá mais entrar no sistema. O histórico de auditoria é preservado.`,
      confirmLabel: next ? 'Ativar' : 'Inativar',
      destructive: !next,
      run: () => localAuthService.setActive(actor, selected.id, next),
      successMessage: next ? 'Usuário ativado.' : 'Usuário inativado.',
    });
  };

  const askForceChange = () => {
    if (!selected) return;
    setConfirm({
      title: 'Forçar troca de senha',
      description: `“${selected.nome}” terá de trocar a senha no próximo acesso. A senha atual continua válida até lá.`,
      confirmLabel: 'Forçar troca',
      destructive: false,
      run: () => localAuthService.forcePasswordChange(actor, selected.id),
      successMessage: 'Troca de senha exigida no próximo acesso.',
    });
  };

  const runConfirm = async () => {
    if (!confirm) return;
    const ok = await runAction(confirm.run, confirm.successMessage);
    if (ok) setConfirm(null);
  };

  return (
    <ModeloBase1PageContainer variant="table" className="d17b-page d17b-list-page d17b-list-page--mother cadastro-emp-scope mg-empresas-scope auth-users-page">
      <ModeloBase1PageHeader title="Usuários" description="Contas locais, papéis de acesso e senhas." visuallyHidden />

      {/* Barra de ações da Tela Mãe (ModeloBase1): Novo usuário + ações sobre o usuário selecionado. */}
      <div className="mak-mother-page__toolbar mg-subtoolbar-stack" data-mak-region="toolbar">
        <div data-template-id="action-bar" className="mg-action-bar canva-section flex w-full shrink-0 items-center" style={{ background: 'var(--bg-card)' }}>
          <div className="mg-action-bar__actions flex min-w-0 items-center">
            <div className="mg-action-slot is-visible" style={{ '--slot-width': '25px' }}>
              <button type="button" className="ios-btn tb-btn tb-btn-icon tb-btn-green" onClick={openNew} title="Novo usuário" aria-label="Novo usuário">
                <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" strokeWidth={2.5} />
              </button>
            </div>
            <div className={`mg-action-slot${selected ? ' is-visible' : ''}`} style={{ '--slot-width': '25px' }} aria-hidden={!selected}>
              <button type="button" className="ios-btn tb-btn tb-btn-icon tb-btn-ghost" onClick={() => openEdit(selected)} title="Editar" aria-label="Editar" tabIndex={selected ? 0 : -1}>
                <Pencil className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </button>
            </div>
            <div className={`mg-action-slot${selected ? ' is-visible' : ''}`} style={{ '--slot-width': '25px' }} aria-hidden={!selected}>
              <button
                type="button"
                className={`ios-btn tb-btn tb-btn-icon tb-btn-ghost${selected?.ativo ? ' tb-btn-danger' : ''}`}
                onClick={askToggleActive}
                title={selected?.ativo ? 'Inativar usuário' : 'Ativar usuário'}
                aria-label={selected?.ativo ? 'Inativar usuário' : 'Ativar usuário'}
                tabIndex={selected ? 0 : -1}
                disabled={isSelf}
              >
                <Power className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </button>
            </div>
            <div className={`mg-action-slot${selected ? ' is-visible' : ''}`} style={{ '--slot-width': '25px' }} aria-hidden={!selected}>
              <button type="button" className="ios-btn tb-btn tb-btn-icon tb-btn-ghost" onClick={() => { setResetForm(EMPTY_RESET); setResetDialog(selected); }} title="Redefinir senha" aria-label="Redefinir senha" tabIndex={selected ? 0 : -1}>
                <KeyRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </button>
            </div>
            <div className={`mg-action-slot${selected && !selected.must_change_password ? ' is-visible' : ''}`} style={{ '--slot-width': '25px' }} aria-hidden={!selected || selected.must_change_password}>
              <button type="button" className="ios-btn tb-btn tb-btn-icon tb-btn-ghost" onClick={askForceChange} title="Forçar troca de senha no próximo acesso" aria-label="Forçar troca de senha no próximo acesso" tabIndex={selected ? 0 : -1}>
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="mg-action-bar__end">
            <div className="mg-action-bar__tools mg-action-bar__tools--visible">
              <button type="button" className="ios-btn tb-btn tb-btn-ghost tb-btn-icon" onClick={load} title="Atualizar" aria-label="Atualizar" disabled={loading}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="d17b-list-body">
        <section className="d17b-table-card">
          <div className="mg-view-panel emp-table-root emp-table-shell emp-table-body-scroll d17c-table-scroll">
            <Table className="emp-table-pro d17c-data-table">
              <colgroup>
                <col style={{ width: '36px' }} />
                <col style={{ width: '260px' }} />
                <col style={{ width: '180px' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '150px' }} />
                <col style={{ width: '170px' }} />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead className="emp-th-select"><span className="sr-only">Seleção</span></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Login</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Último acesso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow
                    key={row.id}
                    className={`${index % 2 ? 'emp-row-odd' : 'emp-row-even'} emp-table-data-row${selectedId === row.id ? ' emp-row-selected' : ''}`}
                    onClick={() => setSelectedId((current) => (current === row.id ? null : row.id))}
                    onDoubleClick={() => openEdit(row)}
                  >
                    <TableCell className="emp-td-select" onClick={(event) => event.stopPropagation()}>
                      <div className="emp-table-select-wrap">
                        <MakTableSelectCheck checked={selectedId === row.id} onChange={(checked) => setSelectedId(checked ? row.id : null)} ariaLabel={`Selecionar ${row.nome}`} />
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {row.nome}
                      {actor && row.id === actor.id ? <span className="auth-users__self">(você)</span> : null}
                    </TableCell>
                    <TableCell>{row.login}</TableCell>
                    <TableCell>{roleLabel(row.role)}</TableCell>
                    <TableCell>
                      <span className={`auth-users__status${row.ativo ? ' is-active' : ''}`}>{row.ativo ? 'Ativo' : 'Inativo'}</span>
                      {row.must_change_password ? <span className="auth-users__flag" title="Troca de senha obrigatória no próximo acesso">troca pendente</span> : null}
                      {row.locked_until && Date.parse(row.locked_until) > Date.now() ? <span className="auth-users__flag" title="Bloqueado temporariamente por tentativas incorretas">bloqueado</span> : null}
                    </TableCell>
                    <TableCell>{fmtDateTimeBR(row.last_login_at, 'Nunca')}</TableCell>
                  </TableRow>
                ))}
                {!loading && !rows.length ? <TableRow><TableCell colSpan={6} className="d17d-empty-row" role="status">Nenhum usuário cadastrado. Inclua um usuário para liberar o acesso.</TableCell></TableRow> : null}
                {loading ? <TableRow><TableCell colSpan={6} className="d17d-empty-row" role="status">Carregando usuários...</TableCell></TableRow> : null}
              </TableBody>
            </Table>
          </div>
          <footer className="d17c-table-footer">
            <span><strong>Usuários:</strong> {rows.length}</span>
            <span><strong>Ativos:</strong> {activeCount}</span>
            <span><strong>Selecionado:</strong> {selected ? selected.nome : '—'}</span>
          </footer>
        </section>
      </div>

      <Dialog open={Boolean(formDialog)} onOpenChange={(open) => { if (!open) setFormDialog(null); }}>
        <DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact">
          <DialogHeader>
            <DialogTitle>{formDialog?.mode === 'novo' ? 'Novo usuário' : 'Editar usuário'}</DialogTitle>
            <DialogDescription>
              {formDialog?.mode === 'novo'
                ? 'O usuário deverá trocar a senha inicial no primeiro acesso.'
                : 'Nome, login e papel. A senha é alterada por “Redefinir senha”.'}
            </DialogDescription>
          </DialogHeader>
          <form className="d17b-standard-dialog__body auth-users__form" onSubmit={saveForm}>
            <FormField id="usuario-nome" label="Nome"><Input id="usuario-nome" value={form.nome} onChange={(event) => setField('nome')(event.target.value)} autoFocus autoComplete="off" /></FormField>
            <FormField id="usuario-login" label="Login"><Input id="usuario-login" value={form.login} onChange={(event) => setField('login')(event.target.value)} autoComplete="off" spellCheck={false} /></FormField>
            <FormField id="usuario-papel" label="Papel">
              <Select value={form.role} onValueChange={setField('role')}>
                <SelectTrigger id="usuario-papel" aria-label="Papel"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => <SelectItem key={role} value={role}>{roleLabel(role)}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
            {formDialog?.mode === 'novo' ? (
              <>
                <FormField id="usuario-senha" label="Senha inicial"><Input id="usuario-senha" type="password" value={form.senha} onChange={(event) => setField('senha')(event.target.value)} autoComplete="new-password" /></FormField>
                <FormField id="usuario-confirmar" label="Confirmar senha"><Input id="usuario-confirmar" type="password" value={form.confirmar} onChange={(event) => setField('confirmar')(event.target.value)} autoComplete="new-password" /></FormField>
                <p className="auth-users__hint">Mínimo de 6 caracteres; senhas triviais ou iguais ao login não são aceitas.</p>
              </>
            ) : null}
            <button type="submit" className="sr-only">Salvar</button>
          </form>
          <DialogFooter className="d17b-standard-dialog__footer">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setFormDialog(null)}>Cancelar</Button>
            <Button type="button" className="emp-toolbar-btn emp-toolbar-btn-save" disabled={busy} onClick={saveForm}>{busy ? 'Salvando…' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resetDialog)} onOpenChange={(open) => { if (!open) setResetDialog(null); }}>
        <DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact">
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
            <DialogDescription>{resetDialog ? `Nova senha para “${resetDialog.nome}”. A troca será exigida no próximo acesso e o bloqueio temporário é zerado.` : ''}</DialogDescription>
          </DialogHeader>
          <form className="d17b-standard-dialog__body auth-users__form" onSubmit={saveReset}>
            <FormField id="reset-modo" label="Como redefinir">
              <Select value={resetForm.modo} onValueChange={(modo) => setResetForm((current) => ({ ...current, modo }))}>
                <SelectTrigger id="reset-modo" aria-label="Como redefinir"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gerar">Gerar senha temporária (mostrada uma única vez)</SelectItem>
                  <SelectItem value="definir">Definir a nova senha agora</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            {resetForm.modo === 'definir' ? (
              <>
                <FormField id="reset-senha" label="Nova senha"><Input id="reset-senha" type="password" value={resetForm.senha} onChange={(event) => setResetForm((current) => ({ ...current, senha: event.target.value }))} autoFocus autoComplete="new-password" /></FormField>
                <FormField id="reset-confirmar" label="Confirmar nova senha"><Input id="reset-confirmar" type="password" value={resetForm.confirmar} onChange={(event) => setResetForm((current) => ({ ...current, confirmar: event.target.value }))} autoComplete="new-password" /></FormField>
              </>
            ) : (
              <p className="auth-users__hint">Uma senha temporária legível será gerada e exibida uma única vez para você repassar ao usuário.</p>
            )}
            <button type="submit" className="sr-only">Redefinir</button>
          </form>
          <DialogFooter className="d17b-standard-dialog__footer">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setResetDialog(null)}>Cancelar</Button>
            <Button type="button" className="emp-toolbar-btn emp-toolbar-btn-save" disabled={busy} onClick={saveReset}>{busy ? 'Salvando…' : 'Redefinir'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(temporary)} onOpenChange={(open) => { if (!open) setTemporary(null); }}>
        <DialogContent className="d17b-standard-dialog d17b-standard-dialog--compact">
          <DialogHeader>
            <DialogTitle>Senha temporária</DialogTitle>
            <DialogDescription>{temporary ? `Repasse esta senha a “${temporary.nome}” (login ${temporary.login}). Ela é mostrada uma única vez e deverá ser trocada no primeiro acesso.` : ''}</DialogDescription>
          </DialogHeader>
          <div className="d17b-standard-dialog__body auth-users__form">
            <output className="auth-users__secret" aria-label="Senha temporária">{temporary?.senha}</output>
            <div>
              <Button type="button" variant="outline" size="sm" onClick={copyTemporary}><ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />{copied ? 'Copiada' : 'Copiar'}</Button>
            </div>
          </div>
          <DialogFooter className="d17b-standard-dialog__footer">
            <Button type="button" className="emp-toolbar-btn emp-toolbar-btn-save" onClick={() => setTemporary(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmActionDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => { if (!open) setConfirm(null); }}
        title={confirm?.title}
        description={confirm?.description}
        confirmLabel={confirm?.confirmLabel}
        destructive={Boolean(confirm?.destructive)}
        busy={busy}
        onConfirm={runConfirm}
      />
    </ModeloBase1PageContainer>
  );
}

// Somente ADMIN (users.manage): OPERADOR e CONSULTA (e GESTOR) veem "Acesso não permitido".
// O serviço valida de novo cada ação.
export default function Usuarios() {
  return (
    <RequirePermission permission="users.manage">
      <UsuariosContent />
    </RequirePermission>
  );
}
