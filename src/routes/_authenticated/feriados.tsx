import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useHolidays } from "@/hooks/useAttendance";
import { AdminOnly } from "@/components/AdminOnly";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { logAudit } from "@/lib/audit";
import { formatDate, WEEKDAY_LABELS, weekdayOfISO } from "@/lib/time-utils";

export const Route = createFileRoute("/_authenticated/feriados")({
  head: () => ({ meta: [{ title: "Feriados — Ponto Certo" }] }),
  component: () => (
    <AdminOnly>
      <Feriados />
    </AdminOnly>
  ),
});

const TYPES: Record<string, string> = { nacional: "Nacional", estadual: "Estadual", municipal: "Municipal", empresa: "Empresa" };

function Feriados() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const { data = [] } = useHolidays();
  const [form, setForm] = useState<{ holiday_date: string; description: string; holiday_type: string; overtime_percent: number } | null>(null);

  const audit = (action: string, id: string, details: Record<string, unknown>) =>
    user && logAudit({ actorId: user.id, actorName: profile?.full_name ?? "", action, entity: "holiday", entityId: id, details });

  async function save() {
    if (!form) return;
    if (!form.holiday_date || form.description.trim().length < 2) { toast.error("Informe data e descrição."); return; }
    const { data: row, error } = await supabase.from("holidays").insert({ ...form, description: form.description.trim() }).select("id").single();
    if (error) { toast.error(error.message); return; }
    await audit("holiday_created", row.id, form);
    toast.success("Feriado adicionado.");
    setForm(null);
    qc.invalidateQueries({ queryKey: ["holidays"] });
  }

  async function remove(id: string, description: string) {
    if (!confirm(`Excluir o feriado "${description}"?`)) return;
    const { error } = await supabase.from("holidays").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await audit("holiday_deleted", id, { description });
    toast.success("Feriado excluído.");
    qc.invalidateQueries({ queryKey: ["holidays"] });
  }

  return (
    <div>
      <PageHeader
        title="Feriados"
        description="Dias trabalhados em feriados contam como hora extra."
        actions={<Button onClick={() => setForm({ holiday_date: "", description: "", holiday_type: "municipal", overtime_percent: 100 })}><Plus className="mr-2 h-4 w-4" />Novo feriado</Button>}
      />
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead>Extra</TableHead><TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((h) => (
              <TableRow key={h.id}>
                <TableCell><p className="text-clock">{formatDate(h.holiday_date)}</p><p className="text-xs text-muted-foreground">{WEEKDAY_LABELS[weekdayOfISO(h.holiday_date)]}</p></TableCell>
                <TableCell>{h.description}</TableCell>
                <TableCell><Badge variant="secondary">{TYPES[h.holiday_type] ?? h.holiday_type}</Badge></TableCell>
                <TableCell>{h.overtime_percent}%</TableCell>
                <TableCell className="text-right"><Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => remove(h.id, h.description)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
              </TableRow>
            ))}
            {data.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum feriado cadastrado.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo feriado</DialogTitle></DialogHeader>
          {form && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={form.holiday_date} onChange={(e) => setForm({ ...form, holiday_date: e.target.value })} /></div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.holiday_type} onChange={(e) => setForm({ ...form, holiday_type: e.target.value })}>
                  {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Descrição</Label><Input maxLength={120} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Hora extra (%)</Label><Input type="number" min={0} max={200} value={form.overtime_percent} onChange={(e) => setForm({ ...form, overtime_percent: Number(e.target.value) })} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
