import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAllSchedules, useEmployees, useHolidayMap, useMonthRecords } from "@/hooks/useAttendance";
import { AdminOnly } from "@/components/AdminOnly";
import { PageHeader } from "@/components/PageHeader";
import { MonthPicker } from "@/components/MonthPicker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { scheduledMinutesFor, workedMinutesFor, type WorkSchedule } from "@/lib/attendance";
import { currentYearMonth } from "@/lib/month";
import { MONTH_LABELS, WEEKDAY_LABELS, formatDate, formatMinutes, formatTime, weekdayOfISO } from "@/lib/time-utils";
import { reviewRecords } from "@/lib/ai-review.functions";

export const Route = createFileRoute("/_authenticated/registros")({
  head: () => ({
    meta: [
      { title: "Registros de ponto — ID Point" },
      { name: "description", content: "Registros de ponto do mês com revisão de inconsistências por IA." },
      { property: "og:title", content: "Registros de ponto — ID Point" },
      { property: "og:description", content: "Registros de ponto do mês com revisão por IA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AdminOnly>
      <Registros />
    </AdminOnly>
  ),
});

function Registros() {
  const [ym, setYm] = useState(currentYearMonth());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const employees = useEmployees();
  const records = useMonthRecords(null, ym.year, ym.month, true);
  const schedules = useAllSchedules();
  const { map } = useHolidayMap();
  const review = useServerFn(reviewRecords);

  const names = useMemo(() => new Map((employees.data ?? []).map((e) => [e.id, e.full_name])), [employees.data]);
  const schedFor = (uid: string, wd: number) =>
    (schedules.data ?? []).find((s: WorkSchedule) => s.user_id === uid && s.weekday === wd);
  const rows = records.data ?? [];
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function analyze() {
    const chosen = rows.filter((r) => selected.has(r.id));
    if (chosen.length === 0) { toast.error("Selecione ao menos um registro."); return; }
    setLoading(true);
    setSummary(null);
    try {
      const payload = chosen.map((r) => {
        const wd = weekdayOfISO(r.work_date);
        const s = schedFor(r.user_id, wd);
        const h = map.get(r.work_date);
        return {
          employee: names.get(r.user_id) ?? "Desconhecido",
          date: formatDate(r.work_date),
          weekday: WEEKDAY_LABELS[wd],
          holiday: h?.description ?? null,
          scheduled: s?.is_working ? `${s.work_start ?? "?"}-${s.work_end ?? "?"} (intervalo ${s.lunch_start ?? "-"}-${s.lunch_end ?? "-"})` : null,
          clock_in: r.clock_in ? formatTime(r.clock_in) : null,
          lunch_start: r.lunch_start ? formatTime(r.lunch_start) : null,
          lunch_end: r.lunch_end ? formatTime(r.lunch_end) : null,
          clock_out: r.clock_out ? formatTime(r.clock_out) : null,
          worked_minutes: workedMinutesFor(r),
          scheduled_minutes: h ? 0 : scheduledMinutesFor(s),
          notes: r.notes,
        };
      });
      const res = await review({ data: { period: `${MONTH_LABELS[ym.month - 1]}/${ym.year}`, records: payload } });
      setSummary(res.summary);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na análise.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Registros de ponto" description="Selecione registros e peça à IA para apontar inconsistências." />
      <div className="flex flex-wrap items-center gap-3">
        <MonthPicker year={ym.year} month={ym.month} onChange={(y, m) => { setYm({ year: y, month: m }); setSelected(new Set()); setSummary(null); }} />
        <span className="text-sm text-muted-foreground">{selected.size} selecionado(s)</span>
        <Button onClick={analyze} disabled={loading || selected.size === 0} className="ml-auto">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Analisar com IA
        </Button>
      </div>

      {summary && (
        <div className="rounded-xl border border-primary/40 bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Casos para revisão</h2>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{summary}</div>
        </div>
      )}

      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allChecked} onCheckedChange={(v) => setSelected(v ? new Set(rows.map((r) => r.id)) : new Set())} aria-label="Selecionar todos" />
              </TableHead>
              <TableHead>Funcionário</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Entrada</TableHead>
              <TableHead>Intervalo</TableHead>
              <TableHead>Saída</TableHead>
              <TableHead className="text-right">Trabalhado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{records.isLoading ? "Carregando…" : "Nenhum registro neste mês."}</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                <TableCell><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} aria-label="Selecionar registro" /></TableCell>
                <TableCell>{names.get(r.user_id) ?? "—"}</TableCell>
                <TableCell>{formatDate(r.work_date)}</TableCell>
                <TableCell className="font-mono">{formatTime(r.clock_in) || "—"}</TableCell>
                <TableCell className="font-mono">{formatTime(r.lunch_start) || "—"} – {formatTime(r.lunch_end) || "—"}</TableCell>
                <TableCell className="font-mono">{formatTime(r.clock_out) || "—"}</TableCell>
                <TableCell className="text-right font-mono">{formatMinutes(workedMinutesFor(r))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
