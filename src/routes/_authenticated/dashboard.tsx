import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Clock, TrendingDown, TrendingUp, Users, UserCheck, Timer } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  useAllSchedules,
  useEmployees,
  useHolidayMap,
  useHolidays,
  useMonthRecords,
  useSchedules,
  useTodayRecord,
} from "@/hooks/useAttendance";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, punchStatus, totalsFrom } from "@/lib/attendance";
import { buildMonth, currentYearMonth } from "@/lib/month";
import { MONTH_LABELS, formatMinutes, formatTime, isoToDisplay, todayISO } from "@/lib/time-utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Ponto Certo" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { isAdmin, profile } = useAuth();
  return (
    <div>
      <PageHeader
        title={`Olá, ${profile?.full_name?.split(" ")[0] ?? ""}`}
        description={isAdmin ? "Visão geral da empresa neste mês." : "Seu resumo de jornada neste mês."}
        actions={
          <Button asChild>
            <Link to="/ponto"><Timer className="mr-2 h-4 w-4" />Bater ponto</Link>
          </Button>
        }
      />
      {isAdmin ? <AdminDashboard /> : <EmployeeDashboard />}
      <UpcomingHolidays />
    </div>
  );
}

function EmployeeDashboard() {
  const { user } = useAuth();
  const { year, month } = currentYearMonth();
  const today = useTodayRecord(user?.id);
  const records = useMonthRecords(user?.id, year, month);
  const schedules = useSchedules(user?.id);
  const { map } = useHolidayMap();
  const t = totalsFrom(user ? buildMonth(year, month, user.id, records.data ?? [], schedules.data ?? [], map) : []);
  const status = punchStatus(today.data);

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Status de hoje" value={STATUS_LABEL[status]} hint={today.data?.clock_in ? `Entrada às ${formatTime(today.data.clock_in)}` : undefined} icon={Clock} />
        <StatCard label={`Trabalhado em ${MONTH_LABELS[month - 1]}`} value={formatMinutes(t.worked)} icon={UserCheck} />
        <StatCard label="Horas extras" value={formatMinutes(t.overtime50 + t.overtime100)} icon={TrendingUp} tone="success" />
        <StatCard label="Saldo do mês" value={formatMinutes(t.balance, true)} icon={TrendingDown} tone={t.balance < 0 ? "destructive" : "success"} />
      </div>
    </>
  );
}

function AdminDashboard() {
  const { year, month } = currentYearMonth();
  const employees = useEmployees();
  const records = useMonthRecords(null, year, month, true);
  const schedules = useAllSchedules();
  const { map } = useHolidayMap();
  const today = todayISO();
  const active = (employees.data ?? []).filter((e) => e.active);
  const todayRecs = (records.data ?? []).filter((r) => r.work_date === today);
  const present = todayRecs.filter((r) => r.clock_in).length;
  const incomplete = (records.data ?? []).filter((r) => r.work_date < today && r.clock_in && !r.clock_out);

  const perEmployee = active.map((e) => ({
    e,
    t: totalsFrom(buildMonth(year, month, e.id, records.data ?? [], schedules.data ?? [], map)),
  }));
  const totalOT = perEmployee.reduce((a, p) => a + p.t.overtime50 + p.t.overtime100, 0);
  const totalWorked = perEmployee.reduce((a, p) => a + p.t.worked, 0);
  const nameOf = (id: string) => employees.data?.find((e) => e.id === id)?.full_name ?? "—";

  return (
    <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Funcionários ativos" value={String(active.length)} icon={Users} />
        <StatCard label="Presentes hoje" value={`${present}/${active.length}`} icon={UserCheck} tone="success" />
        <StatCard label="Horas no mês" value={formatMinutes(totalWorked)} icon={Clock} />
        <StatCard label="Horas extras no mês" value={formatMinutes(totalOT)} icon={TrendingUp} tone="warning" />
      </div>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader><CardTitle className="text-base">Status de hoje</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {active.length === 0 && <p className="text-sm text-muted-foreground">Nenhum funcionário cadastrado.</p>}
            {active.map((e) => {
              const s = punchStatus(todayRecs.find((r) => r.user_id === e.id));
              return (
                <div key={e.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{e.full_name}</span>
                  <Badge variant={s === "nao_iniciado" ? "outline" : "secondary"}>{STATUS_LABEL[s]}</Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" />Registros incompletos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {incomplete.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pendência no mês.</p>}
            {incomplete.map((r) => (
              <div key={r.id} className="flex justify-between text-sm">
                <span className="truncate">{nameOf(r.user_id)}</span>
                <span className="text-clock text-muted-foreground">{isoToDisplay(r.work_date)} · sem saída</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function UpcomingHolidays() {
  const { data } = useHolidays();
  const today = todayISO();
  const next = (data ?? []).filter((h) => h.holiday_date >= today).slice(0, 4);
  if (next.length === 0) return null;
  return (
    <Card className="shadow-card">
      <CardHeader><CardTitle className="text-base">Próximos feriados</CardTitle></CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {next.map((h) => (
          <div key={h.id} className="flex justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <span>{h.description}</span>
            <span className="text-clock text-muted-foreground">{isoToDisplay(h.holiday_date)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
