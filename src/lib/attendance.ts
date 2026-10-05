import { minutesBetween, timeToMinutes, weekdayOfISO } from "./time-utils";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  employee_code: string | null;
  department: string | null;
  active: boolean;
  manager_admin_id: string | null;
  created_at: string;
};

export type PointAdjustmentRequest = {
  id: string;
  employee_id: string;
  assigned_admin_id: string;
  work_date: string;
  requested_clock_in: string | null;
  requested_lunch_start: string | null;
  requested_lunch_end: string | null;
  requested_clock_out: string | null;
  status: string;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type WorkSchedule = {
  id: string;
  user_id: string;
  weekday: number;
  is_working: boolean;
  work_start: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  work_end: string | null;
};

export type TimeRecord = {
  id: string;
  user_id: string;
  work_date: string;
  clock_in: string | null;
  lunch_start: string | null;
  lunch_end: string | null;
  clock_out: string | null;
  notes: string | null;
};

export type Holiday = {
  id: string;
  holiday_date: string;
  description: string;
  holiday_type: string;
  overtime_percent: number;
};

export type DaySummary = {
  date: string;
  isHoliday: boolean;
  holidayName: string | null;
  isWeekend: boolean;
  scheduledMinutes: number;
  workedMinutes: number;
  balanceMinutes: number;
  overtimeMinutes: number;
  owedMinutes: number;
  overtime50: number;
  overtime100: number;
  regularMinutes: number;
  incomplete: boolean;
  record: TimeRecord | null;
};

export function scheduledMinutesFor(schedule: WorkSchedule | undefined | null): number {
  if (!schedule || !schedule.is_working) return 0;
  const start = timeToMinutes(schedule.work_start);
  const end = timeToMinutes(schedule.work_end);
  if (start === null || end === null) return 0;
  const ls = timeToMinutes(schedule.lunch_start);
  const le = timeToMinutes(schedule.lunch_end);
  if (ls !== null && le !== null) {
    return Math.max(0, ls - start) + Math.max(0, end - le);
  }
  return Math.max(0, end - start);
}

export function workedMinutesFor(record: TimeRecord | null | undefined): number {
  if (!record || !record.clock_in) return 0;
  if (record.lunch_start && record.lunch_end && record.clock_out) {
    return (
      minutesBetween(record.clock_in, record.lunch_start) +
      minutesBetween(record.lunch_end, record.clock_out)
    );
  }
  if (record.clock_out) return minutesBetween(record.clock_in, record.clock_out);
  return 0;
}

export function summarizeDay(
  date: string,
  record: TimeRecord | null,
  schedules: Map<number, WorkSchedule>,
  holidays: Map<string, Holiday>,
): DaySummary {
  const weekday = weekdayOfISO(date);
  const schedule = schedules.get(weekday);
  const holiday = holidays.get(date) ?? null;
  const isWeekend = !schedule || !schedule.is_working;
  const scheduled = holiday ? 0 : scheduledMinutesFor(schedule);
  const worked = workedMinutesFor(record);
  const balance = worked - scheduled;

  const overtime100 = holiday ? worked : 0;
  const overtime50 = holiday ? 0 : Math.max(0, balance);
  const owed = holiday ? 0 : Math.max(0, -balance);

  const incomplete = Boolean(record?.clock_in) && !record?.clock_out;

  return {
    date,
    isHoliday: Boolean(holiday),
    holidayName: holiday?.description ?? null,
    isWeekend,
    scheduledMinutes: scheduled,
    workedMinutes: worked,
    balanceMinutes: holiday ? worked : balance,
    overtimeMinutes: overtime50 + overtime100,
    owedMinutes: owed,
    overtime50,
    overtime100,
    regularMinutes: Math.max(0, worked - overtime50 - overtime100),
    incomplete,
    record,
  };
}

export type MonthTotals = {
  worked: number;
  scheduled: number;
  balance: number;
  overtime50: number;
  overtime100: number;
  owed: number;
  regular: number;
  holidaysWorked: number;
  daysWorked: number;
};

export function totalsFrom(days: DaySummary[]): MonthTotals {
  return days.reduce<MonthTotals>(
    (acc, d) => {
      acc.worked += d.workedMinutes;
      acc.scheduled += d.scheduledMinutes;
      acc.balance += d.balanceMinutes;
      acc.overtime50 += d.overtime50;
      acc.overtime100 += d.overtime100;
      acc.owed += d.owedMinutes;
      acc.regular += d.regularMinutes;
      if (d.isHoliday && d.workedMinutes > 0) acc.holidaysWorked += 1;
      if (d.workedMinutes > 0) acc.daysWorked += 1;
      return acc;
    },
    {
      worked: 0,
      scheduled: 0,
      balance: 0,
      overtime50: 0,
      overtime100: 0,
      owed: 0,
      regular: 0,
      holidaysWorked: 0,
      daysWorked: 0,
    },
  );
}

export type PunchStatus =
  | "nao_iniciado"
  | "trabalhando"
  | "intervalo"
  | "pos_intervalo"
  | "encerrado";

export function punchStatus(record: TimeRecord | null | undefined): PunchStatus {
  if (!record || !record.clock_in) return "nao_iniciado";
  if (record.clock_out) return "encerrado";
  if (record.lunch_start && !record.lunch_end) return "intervalo";
  if (record.lunch_end) return "pos_intervalo";
  return "trabalhando";
}

export const STATUS_LABEL: Record<PunchStatus, string> = {
  nao_iniciado: "Ponto não iniciado",
  trabalhando: "Trabalhando",
  intervalo: "Em intervalo",
  pos_intervalo: "Trabalhando (pós-intervalo)",
  encerrado: "Expediente encerrado",
};

export type PunchAction = "clock_in" | "lunch_start" | "lunch_end" | "clock_out";

export const ACTION_LABEL: Record<PunchAction, string> = {
  clock_in: "Entrada",
  lunch_start: "Início do intervalo",
  lunch_end: "Retorno do intervalo",
  clock_out: "Saída",
};

export function canPunch(action: PunchAction, status: PunchStatus): boolean {
  switch (action) {
    case "clock_in":
      return status === "nao_iniciado";
    case "lunch_start":
      return status === "trabalhando";
    case "lunch_end":
      return status === "intervalo";
    case "clock_out":
      return status === "trabalhando" || status === "pos_intervalo";
  }
}
