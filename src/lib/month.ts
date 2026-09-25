import { summarizeDay, type DaySummary, type Holiday, type TimeRecord, type WorkSchedule } from "./attendance";
import { monthDays, todayISO } from "./time-utils";

export function currentYearMonth() {
  const [y, m] = todayISO().split("-").map(Number);
  return { year: y, month: m };
}

export function buildMonth(
  year: number,
  month: number,
  userId: string,
  records: TimeRecord[],
  schedules: WorkSchedule[],
  holidays: Map<string, Holiday>,
): DaySummary[] {
  const today = todayISO();
  const sched = new Map<number, WorkSchedule>();
  schedules.filter((s) => s.user_id === userId).forEach((s) => sched.set(s.weekday, s));
  const recs = new Map<string, TimeRecord>();
  records.filter((r) => r.user_id === userId).forEach((r) => recs.set(r.work_date, r));
  return monthDays(year, month)
    .filter((d) => d <= today)
    .map((d) => summarizeDay(d, recs.get(d) ?? null, sched, holidays));
}
