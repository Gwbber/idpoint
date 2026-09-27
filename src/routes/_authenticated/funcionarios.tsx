import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAllSchedules, useEmployees, useRoles } from "@/hooks/useAttendance";
import { AdminOnly } from "@/components/AdminOnly";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createEmployee, deleteEmployee, resetEmployeePassword, setEmployeeRole } from "@/lib/admin.functions";
import { logAudit } from "@/lib/audit";
import type { Profile } from "@/lib/attendance";
import { WEEKDAY_SHORT } from "@/lib/time-utils";

export const Route = createFileRoute("/_authenticated/funcionarios")({
  head: () => ({ meta: [{ title: "Funcionários — Ponto Certo" }] }),
  component: () => (
    <AdminOnly>
      <Funcionarios />
    </AdminOnly>
  ),
});

type Sched = { weekday: number; is_working: boolean; work_start: string; lunch_start: string; lunch_end: string; work_end: string };
const defaultScheds = (): Sched[] =>
  [0, 1, 2, 3, 4, 5, 6].map((d) => ({
    weekday: d, is_working: d >= 1 && d <= 5,
    work_start: "08:00", lunch_start: "12:00", lunch_end: "13:00", work_end: "17:48",
  }));

type FormState = { id?: string; full_name: string; email: string; password: string; employee_code: string; department: string; active: boolean; is_admin: boolean; schedules: Sched[] };

function Funcionarios() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const employees = useEmployees();
  const roles = useRoles();
  const schedules = useAllSchedules();
  const createFn = useServerFn(createEmployee);
  const deleteFn = useServerFn(deleteEmployee);
  const resetFn = useServerFn(resetEmployeePassword);
  const roleFn = useServerFn(setEmployeeRole);

  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Profile | null>(null);
  const [resetting, setResetting] = useState<Profile | null>(null);
  const [newPass, setNewPass] = useState("");
  const [search, setSearch] = useState("");

  const isAdminId = (id: string) => (roles.data ?? []).some((r) => r.user_id === id && r.role === "admin");
  const audit = (action: string, entityId: string, details: Record<string, unknown> = {}) =>
    user && logAudit({ actorId: user.id, actorName: profile?.full_name ?? "", action, entity: "employee", entityId, details });
  const refresh = () => ["employees", "roles", "schedules"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  function openNew() {
    setForm({ full_name: "", email: "", password: "", employee_code: "", department: "", active: true, is_admin: false, schedules: defaultScheds() });
  }
  function openEdit(p: Profile) {
    const own = (schedules.data ?? []).filter((s) => s.user_id === p.id);
    setForm({
      id: p.id, full_name: p.full_name, email: p.email, password: "",
      employee_code: p.employee_code ?? "", department: p.department ?? "",
      active: p.active, is_admin: isAdminId(p.id),
      schedules: defaultScheds().map((d) => {
        const s = own.find((x) => x.weekday === d.weekday);
        if (!s) return { ...d, is_working: own.length ? false : d.is_working };
        return {
          weekday: d.weekday, is_working: s.is_working,
          work_start: s.work_start?.slice(0, 5) ?? "", lunch_start: s.lunch_start?.slice(0, 5) ?? "",
          lunch_end: s.lunch_end?.slice(0, 5) ?? "", work_end: s.work_end?.slice(0, 5) ?? "",
        };
      }),
    });
  }

  const schedPayload = (list: Sched[]) =>
    list.map((s) => ({
      weekday: s.weekday, is_working: s.is_working,
      work_start: s.is_working ? s.work_start || null : null,
      lunch_start: s.is_working ? s.lunch_start || null : null,
      lunch_end: s.is_working ? s.lunch_end || null : null,
      work_end: s.is_working ? s.work_end || null : null,
    }));

  async function save() {
    if (!form) return;
    if (form.full_name.trim().length < 2) { toast.error("Informe o nome completo."); return; }
    setSaving(true);
    try {
      if (!form.id) {
        const email = form.email.trim();
        if (/[^\x00-\x7F]/.test(email))
          throw new Error("O e-mail não pode ter acentos ou cedilha (ex.: use \"expedicao\" em vez de \"expedição\").");
        if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) throw new Error("Informe um e-mail válido.");
        form.email = email;
        if (form.password.length < 6) throw new Error("A senha deve ter ao menos 6 caracteres.");
        const res = await createFn({
          data: {
            email: form.email, password: form.password, full_name: form.full_name,
            employee_code: form.employee_code || null, department: form.department || null,
            is_admin: form.is_admin, schedules: schedPayload(form.schedules),
          },
        });
        await audit("employee_created", res.id, { name: form.full_name, email: form.email });
        toast.success("Funcionário criado.");
      } else {
        const { error } = await supabase.from("profiles").update({
          full_name: form.full_name.trim(), employee_code: form.employee_code || null,
          department: form.department || null, active: form.active,
        }).eq("id", form.id);
        if (error) throw error;
        await supabase.from("work_schedules").delete().eq("user_id", form.id);
        const { error: sErr } = await supabase.from("work_schedules").insert(
          schedPayload(form.schedules).map((s) => ({ ...s, user_id: form.id! })),
        );
        if (sErr) throw sErr;
        if (form.is_admin !== isAdminId(form.id)) {
          if (form.id === user?.id && !form.is_admin) throw new Error("Você não pode remover seu próprio acesso de administrador.");
          await roleFn({ data: { user_id: form.id, is_admin: form.is_admin } });
        }
        await audit("employee_updated", form.id, { name: form.full_name, active: form.active, is_admin: form.is_admin });
        toast.success("Funcionário atualizado.");
      }
      setForm(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await deleteFn({ data: { user_id: toDelete.id } });
      await audit("employee_deleted", toDelete.id, { name: toDelete.full_name });
      toast.success("Funcionário excluído.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir.");
    }
    setToDelete(null);
  }

  async function confirmReset() {
    if (!resetting) return;
    if (newPass.length < 6) { toast.error("A senha deve ter ao menos 6 caracteres."); return; }
    try {
      await resetFn({ data: { user_id: resetting.id, password: newPass } });
      await audit("password_reset", resetting.id, { name: resetting.full_name });
      toast.success("Senha redefinida.");
      setResetting(null);
      setNewPass("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao redefinir.");
    }
  }

  const list = (employees.data ?? []).filter((e) =>
    `${e.full_name} ${e.email} ${e.employee_code ?? ""} ${e.department ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  const setSched = (i: number, patch: Partial<Sched>) =>
    setForm((f) => f && { ...f, schedules: f.schedules.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  return (
    <div>
      <PageHeader
        title="Funcionários"
        description="Cadastro, jornada semanal e permissões."
        actions={
          <>
            <Input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
            <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo funcionário</Button>
          </>
        }
      />
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Matrícula</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <p className="font-medium">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                </TableCell>
                <TableCell>{p.employee_code ?? "—"}</TableCell>
                <TableCell>{p.department ?? "—"}</TableCell>
                <TableCell>{isAdminId(p.id) ? <Badge>Administrador</Badge> : <Badge variant="secondary">Funcionário</Badge>}</TableCell>
                <TableCell>{p.active ? <Badge variant="outline" className="border-success text-success">Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Redefinir senha" onClick={() => setResetting(p)}><KeyRound className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Excluir" disabled={p.id === user?.id} onClick={() => setToDelete(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {list.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum funcionário encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{form?.id ? "Editar funcionário" : "Novo funcionário"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Nome completo</Label>
                  <Input maxLength={120} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input type="email" disabled={!!form.id} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                {!form.id && (
                  <div className="space-y-1.5">
                    <Label>Senha inicial</Label>
                    <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Matrícula</Label>
                  <Input maxLength={40} value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Departamento</Label>
                  <Input maxLength={80} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm"><Switch checked={form.is_admin} onCheckedChange={(v) => setForm({ ...form, is_admin: v })} />Administrador</label>
                {form.id && <label className="flex items-center gap-2 text-sm"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />Ativo</label>}
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Jornada semanal</p>
                <div className="space-y-2">
                  {form.schedules.map((s, i) => (
                    <div key={s.weekday} className="grid grid-cols-[3rem_auto_1fr] items-center gap-2 sm:grid-cols-[3rem_auto_repeat(4,1fr)]">
                      <span className="text-sm font-medium">{WEEKDAY_SHORT[s.weekday]}</span>
                      <Switch checked={s.is_working} onCheckedChange={(v) => setSched(i, { is_working: v })} />
                      {s.is_working ? (
                        <div className="col-span-1 grid grid-cols-4 gap-1 sm:col-span-4">
                          {(["work_start", "lunch_start", "lunch_end", "work_end"] as const).map((k) => (
                            <Input key={k} type="time" className="text-clock h-8 px-1 text-xs" value={s[k]} onChange={(e) => setSched(i, { [k]: e.target.value })} />
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground sm:col-span-4">Folga</span>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">Entrada · Início intervalo · Fim intervalo · Saída</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetting} onOpenChange={(o) => !o && setResetting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Redefinir senha de {resetting?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Nova senha</Label>
            <Input value={newPass} onChange={(e) => setNewPass(e.target.value)} />
          </div>
          <DialogFooter><Button onClick={confirmReset}>Redefinir</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {toDelete?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>O acesso será removido. Prefira marcar como inativo para manter o histórico.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
