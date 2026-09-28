import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAllSchedules, useEmployees, useHolidayMap, useMonthRecords, useSettings } from "@/hooks/useAttendance";
import { AdminOnly } from "@/components/AdminOnly";
import { PageHeader } from "@/components/PageHeader";
import { MonthPicker } from "@/components/MonthPicker";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { totalsFrom } from "@/lib/attendance";
import { buildMonth, currentYearMonth } from "@/lib/month";
import { generateMonthlyReport } from "@/lib/pdf";
import { logAudit } from "@/lib/audit";
import { MONTH_LABELS, formatMinutes } from "@/lib/time-utils";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — Ponto Certo" }] }),
  component: () => (
    <AdminOnly>
      <Relatorios />
    </AdminOnly>
  ),
});

function Relatorios() {
  const { user, profile } = useAuth();
  const [ym, setYm] = useState(currentYearMonth());
  const [who, setWho] = useState("all");
  const employees = useEmployees();
  const records = useMonthRecords(null, ym.year, ym.month, true);
  const schedules = useAllSchedules();
  const settings = useSettings();
  const { map } = useHolidayMap();

  const list = (employees.data ?? []).filter((e) => e.active && (who === "all" || e.id === who));
  const blocks = list.map((employee) => {
    const days = buildMonth(ym.year, ym.month, employee.id, records.data ?? [], schedules.data ?? [], map);
    return { employee, days, totals: totalsFrom(days) };
  });

  async function download() {
    if (blocks.length === 0) { toast.error("Nenhum funcionário selecionado."); return; }
    const suffix = who === "all" ? "" : `-${slugify(blocks[0].employee.full_name)}`;
    const fileName = `espelho-ponto-${ym.year}-${String(ym.month).padStart(2, "0")}${suffix}.pdf`;
    generateMonthlyReport({ companyName: settings.data?.name ?? "Minha Empresa", year: ym.year, month: ym.month, blocks }).save(fileName);
    if (user) {
      await logAudit({
        actorId: user.id,
        actorName: profile?.full_name ?? "",
        action: "report_generated",
        entity: "report",
        details: { year: ym.year, month: ym.month, employees: blocks.length },
      });
    }
    toast.success("Relatório gerado.");
  }

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description={`Espelho de ponto de ${MONTH_LABELS[ym.month - 1]} de ${ym.year}.`}
        actions={
          <>
            <MonthPicker year={ym.year} month={ym.month} onChange={(year, month) => setYm({ year, month })} />
            <Select value={who} onValueChange={setWho}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os funcionários</SelectItem>
                {(employees.data ?? []).filter((e) => e.active).map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={download} disabled={records.isLoading}>
              <FileDown className="mr-2 h-4 w-4" />Baixar PDF
            </Button>
          </>
        }
      />
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Funcionário</TableHead>
              <TableHead>Dias</TableHead>
              <TableHead>Previsto</TableHead>
              <TableHead>Trabalhado</TableHead>
              <TableHead>Extra 50%</TableHead>
              <TableHead>Extra 100%</TableHead>
              <TableHead>Faltas/atrasos</TableHead>
              <TableHead>Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {blocks.map(({ employee, totals: t }) => (
              <TableRow key={employee.id}>
                <TableCell className="font-medium">{employee.full_name}</TableCell>
                <TableCell>{t.daysWorked}</TableCell>
                <TableCell className="text-clock">{formatMinutes(t.scheduled)}</TableCell>
                <TableCell className="text-clock">{formatMinutes(t.worked)}</TableCell>
                <TableCell className="text-clock">{formatMinutes(t.overtime50)}</TableCell>
                <TableCell className="text-clock">{formatMinutes(t.overtime100)}</TableCell>
                <TableCell className="text-clock">{formatMinutes(t.owed)}</TableCell>
                <TableCell className={`text-clock font-semibold ${t.balance < 0 ? "text-destructive" : "text-success"}`}>
                  {formatMinutes(t.balance, true)}
                </TableCell>
              </TableRow>
            ))}
            {blocks.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum funcionário.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
