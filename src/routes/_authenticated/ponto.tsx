import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Coffee, LogIn, LogOut, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useHolidayMap, useSchedules, useTodayRecord } from "@/hooks/useAttendance";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ACTION_LABEL,
  STATUS_LABEL,
  canPunch,
  punchStatus,
  summarizeDay,
  type PunchAction,
  type WorkSchedule,
  type Holiday,
} from "@/lib/attendance";
import { formatLongDate, formatMinutes, formatTime, formatTimeWithSeconds, todayISO } from "@/lib/time-utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ponto")({
  component: PontoPage,
  head: () => ({
    meta: [
      { title: "Bater ponto — Ponto Certo" },
      { name: "description", content: "Registre entrada, intervalo e saída do seu expediente." },
      { property: "og:title", content: "Bater ponto — Ponto Certo" },
      {
        property: "og:description",
        content: "Registre entrada, intervalo e saída do seu expediente.",
      },
    ],
  }),
});

const ACTIONS: { action: PunchAction; icon: typeof LogIn }[] = [
  { action: "clock_in", icon: LogIn },
  { action: "lunch_start", icon: UtensilsCrossed },
  { action: "lunch_end", icon: Coffee },
  { action: "clock_out", icon: LogOut },
];

function PontoPage() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  const { data: record } = useTodayRecord(user?.id);
  const { data: schedules } = useSchedules(user?.id);
  const { map: holidayMap } = useHolidayMap();

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const status = punchStatus(record ?? null);

  const scheduleMap = new Map<number, WorkSchedule>();
  (schedules ?? []).forEach((s) => scheduleMap.set(s.weekday, s));
  const summary = summarizeDay(
    todayISO(),
    record ?? null,
    scheduleMap,
    holidayMap as Map<string, Holiday>,
  );

  const punch = useMutation({
    mutationFn: async (action: PunchAction) => {
      if (!user) throw new Error("Sessão expirada");
      const stamp = new Date().toISOString();
      const date = todayISO();
      if (!record) {
        const { error } = await supabase
          .from("time_records")
          .insert({ user_id: user.id, work_date: date, [action]: stamp });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("time_records")
          .update({ [action]: stamp })
          .eq("id", record.id);
        if (error) throw error;
      }
      return action;
    },
    onSuccess: (action) => {
      toast.success(`${ACTION_LABEL[action]} registrada às ${formatTime(new Date())}`);
      void queryClient.invalidateQueries({ queryKey: ["record"] });
      void queryClient.invalidateQueries({ queryKey: ["records"] });
    },
    onError: (error: Error) => toast.error(error.message || "Não foi possível registrar o ponto."),
  });

  const statusTone =
    status === "intervalo"
      ? "bg-warning/15 text-warning"
      : status === "encerrado"
        ? "bg-muted text-muted-foreground"
        : status === "nao_iniciado"
          ? "bg-muted text-muted-foreground"
          : "bg-success/15 text-success";

  const startedAt =
    status === "intervalo"
      ? `Intervalo iniciado às ${formatTime(record?.lunch_start)}`
      : status === "encerrado"
        ? `Saída registrada às ${formatTime(record?.clock_out)}`
        : record?.clock_in
          ? `Entrada às ${formatTime(record.clock_in)}`
          : "Nenhum registro hoje";

  return (
    <>
      <PageHeader
        title={`Olá, ${profile?.full_name?.split(" ")[0] ?? "colaborador"}`}
        description="Registre sua jornada de hoje."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden shadow-card lg:col-span-2">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <p className="text-sm text-muted-foreground">{formatLongDate(now)}</p>
              <p className="text-clock mt-2 text-6xl font-bold sm:text-7xl">
                {formatTimeWithSeconds(now)}
              </p>
              <div
                className={cn(
                  "mt-5 flex flex-col items-center gap-1 rounded-xl px-4 py-2.5",
                  statusTone,
                )}
              >
                <span className="text-sm font-semibold">{STATUS_LABEL[status]}</span>
                <span className="text-xs opacity-80">{startedAt}</span>
              </div>
              {summary.isHoliday && (
                <Badge className="mt-3 bg-primary/15 text-primary hover:bg-primary/15">
                  Feriado: {summary.holidayName} — horas com 100% de adicional
                </Badge>
              )}
            </div>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ACTIONS.map(({ action, icon: Icon }) => {
                const enabled = canPunch(action, status);
                const done = Boolean(record?.[action]);
                return (
                  <Button
                    key={action}
                    size="lg"
                    variant={enabled ? "default" : "secondary"}
                    disabled={!enabled || punch.isPending}
                    onClick={() => punch.mutate(action)}
                    className="h-auto justify-start gap-3 py-4"
                  >
                    <Icon className="h-5 w-5" />
                    <span className="flex flex-col items-start">
                      <span className="font-semibold">{ACTION_LABEL[action]}</span>
                      <span className="text-xs opacity-80">
                        {done ? `Registrado às ${formatTime(record?.[action])}` : "Aguardando"}
                      </span>
                    </span>
                    {done && <CheckCircle2 className="ml-auto h-4 w-4 opacity-80" />}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="space-y-4 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Resumo de hoje
            </h2>
            <Row label="Entrada" value={formatTime(record?.clock_in)} />
            <Row label="Início do intervalo" value={formatTime(record?.lunch_start)} />
            <Row label="Retorno do intervalo" value={formatTime(record?.lunch_end)} />
            <Row label="Saída" value={formatTime(record?.clock_out)} />
            <div className="border-t border-border pt-4">
              <Row label="Jornada prevista" value={formatMinutes(summary.scheduledMinutes)} />
              <Row label="Horas trabalhadas" value={formatMinutes(summary.workedMinutes)} />
              <Row
                label="Saldo do dia"
                value={formatMinutes(summary.balanceMinutes, true)}
                tone={summary.balanceMinutes < 0 ? "negative" : "positive"}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-clock text-sm font-semibold",
          tone === "positive" && "text-success",
          tone === "negative" && "text-destructive",
        )}
      >
        {value}
      </span>
    </div>
  );
}
