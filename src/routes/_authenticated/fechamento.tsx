import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useClosings, useMonthRecords } from "@/hooks/useAttendance";
import { AdminOnly } from "@/components/AdminOnly";
import { PageHeader } from "@/components/PageHeader";
import { MonthPicker } from "@/components/MonthPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { logAudit } from "@/lib/audit";
import { currentYearMonth } from "@/lib/month";
import { formatDateTime, MONTH_LABELS } from "@/lib/time-utils";

export const Route = createFileRoute("/_authenticated/fechamento")({
  head: () => ({ meta: [{ title: "Fechamento mensal — ID Point" }] }),
  component: () => (
    <AdminOnly>
      <Fechamento />
    </AdminOnly>
  ),
});

function Fechamento() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [ym, setYm] = useState(currentYearMonth());
  const [notes, setNotes] = useState("");
  const closings = useClosings();
  const records = useMonthRecords(null, ym.year, ym.month, true);
  const current = (closings.data ?? []).find((c) => c.year === ym.year && c.month === ym.month);
  const openNoExit = (records.data ?? []).filter((r) => r.clock_in && !r.clock_out).length;
  const label = `${MONTH_LABELS[ym.month - 1]}/${ym.year}`;

  const audit = (action: string, details: Record<string, unknown>) =>
    user && logAudit({ actorId: user.id, actorName: profile?.full_name ?? "", action, entity: "monthly_closing", entityId: `${ym.year}-${ym.month}`, details });

  async function close() {
    if (!user) return;
    if (!confirm(`Fechar ${label}? Funcionários não poderão mais alterar registros deste mês.`)) return;
    const { error } = await supabase.from("monthly_closings").insert({ year: ym.year, month: ym.month, closed_by: user.id, notes: notes.trim() || null });
    if (error) { toast.error(error.message); return; }
    await audit("month_closed", { period: label, notes });
    toast.success(`${label} fechado.`);
    setNotes("");
    qc.invalidateQueries({ queryKey: ["closings"] });
  }

  async function reopen() {
    if (!current || !confirm(`Reabrir ${label}?`)) return;
    const { error } = await supabase.from("monthly_closings").delete().eq("id", current.id);
    if (error) { toast.error(error.message); return; }
    await audit("month_reopened", { period: label });
    toast.success(`${label} reaberto.`);
    qc.invalidateQueries({ queryKey: ["closings"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Fechamento mensal" description="Meses fechados ficam travados para os funcionários." actions={<MonthPicker year={ym.year} month={ym.month} onChange={(year, month) => setYm({ year, month })} />} />
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">{label}</h2>
            {current ? <Badge><Lock className="mr-1 h-3 w-3" />Fechado</Badge> : <Badge variant="secondary"><LockOpen className="mr-1 h-3 w-3" />Aberto</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{(records.data ?? []).length} registros no mês{openNoExit > 0 && ` · ${openNoExit} sem saída — revise antes de fechar`}.</p>
          {current ? (
            <>
              <p className="text-sm">Fechado em {formatDateTime(current.closed_at)}{current.notes && ` — ${current.notes}`}</p>
              <Button variant="outline" onClick={reopen}><LockOpen className="mr-2 h-4 w-4" />Reabrir mês</Button>
            </>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input placeholder="Observação (opcional)" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
              <Button onClick={close}><Lock className="mr-2 h-4 w-4" />Fechar mês</Button>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader><TableRow><TableHead>Período</TableHead><TableHead>Fechado em</TableHead><TableHead>Observação</TableHead></TableRow></TableHeader>
          <TableBody>
            {(closings.data ?? []).map((c) => (
              <TableRow key={c.id}><TableCell>{MONTH_LABELS[c.month - 1]}/{c.year}</TableCell><TableCell>{formatDateTime(c.closed_at)}</TableCell><TableCell>{c.notes ?? "—"}</TableCell></TableRow>
            ))}
            {(closings.data ?? []).length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhum mês fechado.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
