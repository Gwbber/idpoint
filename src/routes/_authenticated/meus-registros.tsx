import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, TrendingDown, TrendingUp, CalendarCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useHolidayMap, useMonthRecords, useSchedules } from "@/hooks/useAttendance";
import { PageHeader } from "@/components/PageHeader";
import { MonthPicker } from "@/components/MonthPicker";
import { DaysTable } from "@/components/DaysTable";
import { StatCard } from "@/components/StatCard";
import { totalsFrom } from "@/lib/attendance";
import { buildMonth, currentYearMonth } from "@/lib/month";
import { formatMinutes } from "@/lib/time-utils";

export const Route = createFileRoute("/_authenticated/meus-registros")({
  head: () => ({ meta: [{ title: "Meus registros — ID Point" }] }),
  component: MeusRegistros,
});

function MeusRegistros() {
  const { user } = useAuth();
  const [ym, setYm] = useState(currentYearMonth());
  const records = useMonthRecords(user?.id, ym.year, ym.month);
  const schedules = useSchedules(user?.id);
  const { map } = useHolidayMap();
  const days = user
    ? buildMonth(ym.year, ym.month, user.id, records.data ?? [], schedules.data ?? [], map)
    : [];
  const t = totalsFrom(days);

  return (
    <div>
      <PageHeader
        title="Meus registros"
        description="Seu espelho de ponto do mês, com saldo diário acumulado."
        actions={<MonthPicker year={ym.year} month={ym.month} onChange={(year, month) => setYm({ year, month })} />}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Horas trabalhadas" value={formatMinutes(t.worked)} icon={Clock} />
        <StatCard label="Dias trabalhados" value={String(t.daysWorked)} icon={CalendarCheck} />
        <StatCard label="Horas extras" value={formatMinutes(t.overtime50 + t.overtime100)} hint={`50%: ${formatMinutes(t.overtime50)} · 100%: ${formatMinutes(t.overtime100)}`} icon={TrendingUp} tone="success" />
        <StatCard label="Saldo do mês" value={formatMinutes(t.balance, true)} icon={TrendingDown} tone={t.balance < 0 ? "destructive" : "success"} />
      </div>
      {records.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <DaysTable days={days} />
      )}
    </div>
  );
}
